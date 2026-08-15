// Wiring: the viewport, the fixed-step loop, the save, the three screens and
// the two flags.
//
// The rules live in `battle.js`, `structure.js` and `workshop.js`, and none of
// them knows this file exists — which is what lets the whole game be played in
// Node by a test that never opens a window.

import { createViewport } from 'slopkit/viewport';
import { createLoop } from 'slopkit/loop';
import { createSave } from 'slopkit/save';
import { mountLangPicker, bindText } from 'slopkit/langpicker';

import { CASTLE_X, CELL, COLS, GAUGE_SPEED, GUN_HEIGHT, H, LEVELS, STEP, W, clamp, viewWidth } from './config.js';
import { i18n, t } from './i18n.js';
import { createMatch } from './battle.js';
import { buildTerrain } from './terrain.js';
import { createScene } from './scene.js';
import { createFx } from './fx.js';
import { createCamera, focusOf } from './camera.js';
import { createCastle, gunSeat } from './structure.js';
import { foeCastle } from './castles.js';
import { createWorkshop, suggestBlueprint } from './workshop.js';
import { planShot, skillNow } from './ai.js';
import { freshRun, levelOf, normalizeRun, reward } from './run.js';
import { drawAim, drawBattleHud, drawField, drawShopGrid, drawShopHud } from './render.js';
import { drawBlock, drawLauncher } from './art.js';
import { hit } from './ui.js';
import { createInput, gaugeAt } from './controls.js';
import { MATERIALS, material } from './materials.js';
import { sfx, sound } from './audio.js';

const canvas = document.getElementById('canvas');
const menuCard = document.getElementById('menu');
const pickCard = document.getElementById('pick');
const overCard = document.getElementById('over');

bindText(i18n);
mountLangPicker(i18n, { width: 30 });
const applyTitle = () => {
  document.title = t('page.title');
};
applyTitle();
i18n.onChange(applyTitle);

// The field is 16:9 and drawn whole — upright, the kit lays the canvas on its
// side instead of asking anybody to unlock rotation (CLAUDE.md, section 2b).
const vp = createViewport(canvas, { height: H, frame: W, landscape: true });

const vault = createSave({
  game: 'reis-e-engrenagens',
  version: 1,
  initial: () => freshRun('knights'),
  normalize: normalizeRun,
  i18n,
});
let run = vault.load();

const fx = createFx();
const cam = createCamera();

let screen = 'menu';
let level = levelOf(run);
let terrain = null;
let scene = null;
let shop = null;
let match = null;
let foePreview = null;
let previewCastle = null;

let phase = 'aim'; // aim · charging · flight
let gaugeT = 0;
let power = 0;
let hudRects = [];
let hover = null;
let message = '';
let messageT = 0;
let shake = 0;
let time = 0;
let overT = 0;
const enemy = { stage: 'idle', t: 0, plan: null };

const seedOf = (r) => 101 + r.level * 13 + (r.faction === 'knights' ? 0 : 5);
const foeFaction = () => (run.faction === 'knights' ? 'machines' : 'knights');
const foeBlueprint = () =>
  foeCastle({
    style: level.foe.style,
    budget: level.foe.budget,
    tier: level.foe.tier,
    faction: foeFaction(),
    seed: seedOf(run) + 3,
  });

// ------------------------------------------------------------------ screens

function setScreen(next) {
  screen = next;
  menuCard.hidden = next !== 'menu';
  pickCard.hidden = next !== 'pick';
  overCard.hidden = next !== 'over';
}

function buildStage() {
  level = levelOf(run);
  terrain = buildTerrain({ kind: level.terrain, seed: seedOf(run), middle: level.middle });
  scene = createScene(level, terrain, seedOf(run));
}

/** The menu is not a blank screen: it is the siege you are about to walk into. */
function showcase() {
  buildStage();
  cam.follow(menuFocus(), viewWidth(vp), 1, true);
  previewCastle = createCastle('player', run.blueprint || suggestBlueprint(run.coins));
  foePreview = createCastle('enemy', foeBlueprint());
  match = null;
  shop = null;
}

/** Behind the menu: your castle and a stretch of the valley it is defending. */
const menuFocus = () => ({ x: CASTLE_X.player + COLS * CELL + 190, y: 380 });

/** In the workshop the camera is parked over your own plot and stays there. */
function shopFocus() {
  return { x: CASTLE_X.player + (COLS * CELL) / 2 + 120, y: 400 };
}

function openShop() {
  buildStage();
  shop = createWorkshop({
    blueprint: run.blueprint || suggestBlueprint(run.coins),
    coins: run.coins,
    terrain,
  });
  foePreview = createCastle('enemy', foeBlueprint());
  match = null;
  hover = null;
  message = '';
  fx.clear();
  cam.follow(shopFocus(), viewWidth(vp), 1, true);
  setScreen('shop');
}

function startBattle() {
  run.blueprint = shop ? shop.blueprint() : run.blueprint;
  vault.save(run);
  match = createMatch({
    level,
    faction: run.faction,
    blueprint: run.blueprint,
    foeBlueprint: foeBlueprint(),
    seed: seedOf(run),
  });
  terrain = match.terrain;
  scene = createScene(level, terrain, seedOf(run));
  fx.clear();
  phase = 'aim';
  gaugeT = 0;
  power = 0;
  overT = 0;
  enemy.stage = 'idle';
  cam.follow(focusOf(match, 'player'), viewWidth(vp), 1, true);
  setScreen('battle');
}

function finishBattle() {
  const won = match.over.winner === 'player';
  const last = run.level >= LEVELS.length - 1;
  let gained = 0;

  if (won) {
    gained = reward(level, match.castles.player);
    run.coins += gained;
    run.wins++;
    run.best = Math.max(run.best, run.level + 1);
    if (!last) run.level++;
  } else {
    run.losses++;
  }
  vault.save(run);

  const done = won && last;
  document.getElementById('o-title').textContent =
    match.over.winner === 'draw' ? t('over.draw') : won ? t('over.won') : t('over.lost');
  document.getElementById('o-why').textContent = t(`over.${match.over.reason === 'both' ? 'king' : match.over.reason}`);
  document.getElementById('o-reward').textContent = won ? t('over.reward', { n: gained }) : '';
  document.getElementById('o-level').textContent = done
    ? t('over.campaign')
    : t('over.level', { n: run.level + 1, total: LEVELS.length, name: t(`lv.${levelOf(run).id}`) });

  document.getElementById('btn-next').hidden = !won || done;
  document.getElementById('btn-again').hidden = won;
  document.getElementById('btn-rebuild').hidden = done;
  setScreen('over');
  if (won) sfx.win();
  else sfx.lose();
}

// -------------------------------------------------------------------- input

function say(text) {
  message = text;
  messageT = 2.2;
}

/** The viewport as the player can actually see it — see `viewWidth`. */
const view = () => ({ W: viewWidth(vp), H: vp.H });

const worldPoint = (x, y) => cam.toWorld(x, y);

function aimTowards(x, y) {
  const p = worldPoint(x, y);
  const L = match.launchers.player;
  const dx = (p.x - L.x) * L.dir;
  const dy = L.y - 28 - p.y;
  const a = (Math.atan2(dy, Math.max(dx, 6)) * 180) / Math.PI;
  match.aim('player', clamp(a, 4, 89));
}

function fireNow() {
  match.fire('player', power);
  match.commit();
  phase = 'flight';
}

function shopCellAt(x, y) {
  const p = worldPoint(x, y);
  return shop.castle.cellAt(p.x, p.y);
}

createInput(canvas, vp, {
  down(x, y) {
    sound.resume();
    if (screen === 'shop') {
      const r = hit(hudRects, x, y);
      if (r) return onShopButton(r);
      const cell = shopCellAt(x, y);
      if (cell) {
        const why = shop.apply(cell.c, cell.r);
        if (why) {
          say(t(`why.${why}`));
          sfx.deny();
        } else {
          sfx.place();
        }
      }
      return;
    }
    if (screen !== 'battle' || !match) return;
    if (hit(hudRects, x, y)) return;
    if (match.over || match.turn !== 'player' || match.flying()) return;
    if (phase === 'aim') aimTowards(x, y);
  },

  move(x, y, pressed) {
    if (screen === 'shop') {
      const cell = shopCellAt(x, y);
      hover = cell ? { ...cell, ok: shopAllowed(cell) } : null;
      return;
    }
    if (screen !== 'battle' || !match) return;
    if (match.over || match.turn !== 'player' || match.flying()) return;
    if (phase === 'aim' && (pressed || !vp.touch)) aimTowards(x, y);
  },

  up(x, y) {
    if (screen !== 'battle' || !match) return;
    if (hit(hudRects, x, y)) {
      const r = hit(hudRects, x, y);
      if (r && r.kind === 'weapon') {
        if (!match.pick('player', r.id)) sfx.deny();
        else sfx.place();
      }
      return;
    }
    if (match.over || match.turn !== 'player' || match.flying()) return;
    if (phase === 'aim') {
      phase = 'charging';
      gaugeT = 0;
    } else if (phase === 'charging') {
      fireNow();
    }
  },

  key(code) {
    if (screen === 'battle' && match && !match.over) {
      if (code === 'Space' || code === 'Enter') {
        if (match.turn !== 'player' || match.flying()) return true;
        if (phase === 'aim') {
          phase = 'charging';
          gaugeT = 0;
        } else if (phase === 'charging') fireNow();
        return true;
      }
      if (phase === 'aim' && match.turn === 'player') {
        const L = match.launchers.player;
        if (code === 'ArrowUp' || code === 'ArrowLeft') {
          match.aim('player', L.angle + 1);
          return true;
        }
        if (code === 'ArrowDown' || code === 'ArrowRight') {
          match.aim('player', L.angle - 1);
          return true;
        }
      }
      const n = /^Digit([1-4])$/.exec(code);
      if (n) {
        const ids = Object.keys(match.ammo.player);
        if (!match.pick('player', ids[+n[1] - 1])) sfx.deny();
        return true;
      }
    }
    if (screen === 'shop') {
      const n = /^Digit([1-7])$/.exec(code);
      if (n) {
        shop.brush = [...Object.keys(MATERIALS), 'king', 'erase'][+n[1] - 1] || shop.brush;
        return true;
      }
      if (code === 'Enter' && !shop.problem()) {
        startBattle();
        return true;
      }
    }
    if (code === 'KeyM') {
      sound.toggle();
      paintSoundButton();
      return true;
    }
    return false;
  },
});

function shopAllowed(cell) {
  const b = shop.castle.at(cell.c, cell.r);
  if (shop.brush === 'erase') return !!b && b.m !== 'king';
  if (shop.brush === 'king') return !b || b.m === 'king';
  return !b && MATERIALS[shop.brush].cost <= shop.left();
}

function onShopButton(r) {
  if (r.kind === 'brush') {
    shop.brush = r.id;
    sfx.place();
    return;
  }
  if (r.id === 'auto') {
    shop.clear();
    const draft = suggestBlueprint(shop.coins);
    for (const c of draft.cells) shop.place(c.c, c.r, c.m);
    shop.placeKing(draft.king.c, draft.king.r);
    sfx.place();
  } else if (r.id === 'clear') {
    shop.clear();
    sfx.place();
  } else if (r.id === 'fight') {
    const why = shop.problem();
    if (why) {
      say(t(`why.${why}`));
      sfx.deny();
    } else {
      startBattle();
    }
  }
}

// ---------------------------------------------------------------- the loop

function update(h) {
  time += h;
  // Turned, the game's own top-left corner is the *screen's* top-right — which
  // is where the flags and the mute button live, and they landed on top of the
  // turn indicator. The class moves them to the other end of the phone, over
  // the corner the HUD already keeps clear.
  document.body.classList.toggle('turned', !!vp.turned);
  shake = Math.max(0, shake - h * 3.2);
  if (messageT > 0) {
    messageT -= h;
    if (messageT <= 0) message = '';
  }
  if (scene) scene.update(h);
  fx.update(h, terrain);

  const viewW = viewWidth(vp);
  if (screen === 'battle' && match) cam.follow(focusOf(match), viewW, h);
  else if (screen === 'shop') cam.follow(shopFocus(), viewW, h);
  else cam.follow(menuFocus(), viewW, h);

  if (screen !== 'battle' || !match) return;

  if (phase === 'charging' && match.turn === 'player' && !match.flying()) {
    gaugeT += h;
    const before = power;
    power = gaugeAt(gaugeT, GAUGE_SPEED);
    if (Math.floor(before / 10) !== Math.floor(power / 10)) sfx.tick(power);
  }

  match.tick(h);
  drain();

  // the enemy's turn: a pause to think, an arm swinging round, then a shot
  if (!match.over && match.turn === 'enemy' && !match.flying()) {
    enemy.t += h;
    if (enemy.stage === 'idle') {
      enemy.stage = 'wait';
      enemy.t = 0;
    } else if (enemy.stage === 'wait' && enemy.t > 0.55) {
      enemy.plan = planShot(match, 'enemy', skillNow(level, match.turnCount));
      match.pick('enemy', enemy.plan.weapon);
      enemy.stage = 'turn';
      enemy.t = 0;
    } else if (enemy.stage === 'turn') {
      const L = match.launchers.enemy;
      const wanted = enemy.plan.angle;
      match.aim('enemy', L.angle + clamp(wanted - L.angle, -70 * h, 70 * h));
      if (Math.abs(L.angle - wanted) < 0.6 || enemy.t > 2.2) {
        match.aim('enemy', wanted);
        match.fire('enemy', enemy.plan.power);
        match.commit();
        enemy.stage = 'fired';
      }
    }
  }

  if (match.over) {
    overT += h;
    if (overT > 1.5 && screen === 'battle') finishBattle();
  }
}

/** Turn what the match said into noise, dirt and a shaken camera. */
function drain() {
  for (const ev of match.take()) {
    switch (ev.kind) {
      case 'fire':
        sfx.launch(ev.weapon);
        shake = Math.max(shake, 0.35);
        break;
      case 'boom': {
        const big = Math.min(2, ev.radius / 44);
        fx.boom(ev.x, ev.y, ev.radius, terrain.spec.dust);
        sfx.boom(big);
        shake = Math.max(shake, 0.6 * big);
        break;
      }
      case 'pierce':
        fx.shards(ev.x, ev.y, '#e8e2d0', 6);
        sfx.crack('crystal');
        break;
      case 'split':
        fx.boom(ev.x, ev.y, 14, '#cccccc');
        break;
      case 'break':
        fx.shards(ev.x, ev.y, material(ev.m).face, 14);
        sfx.crack(ev.m);
        break;
      case 'tumble':
        fx.shards(ev.x, ev.y, material(ev.m).dark, 4);
        sfx.tumble();
        break;
      case 'arc':
        fx.arc(ev.x, ev.y, ev.tx, ev.ty);
        sfx.arc();
        break;
      case 'kinghit':
        sfx.kinghit();
        shake = Math.max(shake, 1);
        break;
      case 'turn':
        if (ev.side === 'player') {
          phase = 'aim';
          power = 0;
        } else {
          enemy.stage = 'idle';
          enemy.t = 0;
        }
        break;
      default:
        break;
    }
  }
}

function draw() {
  vp.begin();
  const ctx = vp.ctx;
  const v = view();

  // The field is wider than the screen and exactly as tall, so there is no
  // scaling left to do — only the camera's offset, and the shake on top of it.
  ctx.save();
  const sx = shake ? (Math.random() - 0.5) * 18 * shake : 0;
  const sy = shake ? (Math.random() - 0.5) * 18 * shake : 0;
  ctx.translate(-Math.round(cam.x) + sx, -Math.round(cam.y) + sy);

  if (screen === 'battle' && match) {
    drawField(ctx, { match, scene, fx, time, cam, viewW: v.W });
    if (!match.over && match.turn === 'player' && !match.flying()) {
      drawAim(ctx, match, 'player', match.launchers.player.angle, phase === 'charging' ? power : 55);
    }
  } else if (scene) {
    scene.drawSky(ctx, cam, v.W);
    scene.drawGround(ctx, cam, v.W);
    scene.drawProps(ctx, cam, v.W);
    const castle = shop ? shop.castle : previewCastle;
    if (foePreview) drawStill(ctx, foePreview, foeFaction());
    if (screen === 'shop') drawShopGrid(ctx, shop, hover, run.faction);
    else if (castle) drawStill(ctx, castle, run.faction);
    scene.drawWeather(ctx, cam, v.W);
  }
  ctx.restore();

  if (screen === 'battle' && match) {
    hudRects = drawBattleHud(ctx, v, { match, level, phase, power });
  } else if (screen === 'shop') {
    hudRects = drawShopHud(ctx, v, shop, level, { message, foe: foePreview, foeFaction: foeFaction() });
  } else {
    hudRects = [];
  }
}

/**
 * A castle nobody is shooting at yet — the menu's showcase and the enemy's plot
 * seen from the workshop. The same blocks the battle draws, and the same siege
 * engine on the same seat, so what you design is what you walk into.
 */
function drawStill(ctx, castle, faction) {
  for (const b of castle.blocks()) {
    const top = !castle.at(b.c, b.r + 1);
    drawBlock(ctx, b, castle.rect(b.c, b.r), { faction, top });
  }
  const seat = gunSeat(castle, terrain);
  drawLauncher(
    ctx,
    { x: seat.x, y: seat.y, angle: 46, dir: castle.side === 'player' ? 1 : -1, recoil: 0 },
    faction,
    { loaded: true, time }
  );
}

// ----------------------------------------------------------------- the menu

document.getElementById('btn-start').addEventListener('click', () => {
  sound.resume();
  setScreen('pick');
});
document.getElementById('btn-resume').addEventListener('click', () => {
  sound.resume();
  openShop();
});
document.getElementById('btn-reset').addEventListener('click', () => {
  run = vault.fresh();
  vault.save(run);
  showcase();
  refreshMenu();
});
for (const el of document.querySelectorAll('[data-faction]')) {
  el.addEventListener('click', () => {
    run.faction = el.dataset.faction;
    if (!run.blueprint) run.coins = vault.fresh().coins;
    vault.save(run);
    openShop();
  });
}
document.getElementById('btn-next').addEventListener('click', openShop);
document.getElementById('btn-rebuild').addEventListener('click', openShop);
document.getElementById('btn-again').addEventListener('click', startBattle);
for (const el of document.querySelectorAll('[data-menu]')) {
  el.addEventListener('click', () => {
    showcase();
    refreshMenu();
    setScreen('menu');
  });
}

function refreshMenu() {
  const has = !!run.blueprint;
  document.getElementById('btn-resume').hidden = !has;
  document.getElementById('m-progress').textContent = has
    ? `${t('run.level', { n: run.level + 1 })} · ${t('run.coins', { n: run.coins })}`
    : '';
}

const soundBtn = document.getElementById('btn-sound');
function paintSoundButton() {
  soundBtn.textContent = sound.on ? '🔊' : '🔇';
  soundBtn.setAttribute('aria-label', `${t('slop.sound')}: ${t(sound.on ? 'slop.on' : 'slop.off')}`);
}
soundBtn.addEventListener('click', () => {
  sound.toggle();
  paintSoundButton();
});
paintSoundButton();
i18n.onChange(() => {
  paintSoundButton();
  refreshMenu();
});

// -------------------------------------------------------------------- boot

showcase();
refreshMenu();
setScreen('menu');

createLoop({ step: STEP, update, draw }).start();

// a handle for the browser console, which is where the last two rounds of bugs
// were actually found
window.__game = {
  name: 'reis-e-engrenagens',
  viewport: vp,
  i18n,
  get run() {
    return run;
  },
  get match() {
    return match;
  },
  get shop() {
    return shop;
  },
};
