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

import { BASE_Y, CASTLE_X, CELL, CHARGE_RATE, COLS, DRIVE_SPEED, H, LEVELS, START_COINS, STEP, W, clamp, viewWidth } from './config.js';
import { ammoCost, defaultLoadout, kitCost } from './weapons.js';
import { i18n, t } from './i18n.js';
import { createMatch } from './battle.js';
import { buildTerrain } from './terrain.js';
import { createScene } from './scene.js';
import { createFx } from './fx.js';
import { createCamera, focusOf } from './camera.js';
import { createCastle, gunSeat } from './structure.js';
import { foeCastle } from './castles.js';
import { createWorkshop, suggestBlueprint } from './workshop.js';
import { planDrive, planShot, skillNow } from './ai.js';
import { freshRun, levelOf, normalizeRun, reward } from './run.js';
import { drawAim, drawBattleHud, drawField, drawShopGrid, drawShopHud } from './render.js';
import { drawBlock, drawLauncher } from './art.js';
import { hit } from './ui.js';
import { chargeAt, createInput } from './controls.js';
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
/** Seconds of slow motion left — a hit on a crown is worth dwelling on. */
let slowT = 0;
/** -1, 0 or 1: which way the thumb is holding the engine. */
let driving = 0;
/** -1, 0 or 1: which way the thumb is holding the elevation. */
let aiming = 0;
const enemy = { stage: 'idle', t: 0, plan: null, wait: 0.55 };

const seedOf = (r) => 101 + r.level * 13 + (r.faction === 'knights' ? 0 : 5);
const foeFaction = () => (run.faction === 'knights' ? 'machines' : 'knights');
/** What is left for walls after the rack of munitions is paid for. */
const wallsBudget = (r) => Math.max(0, r.coins - ammoCost(r.faction, r.loadout || {}));
/** The wake behind each munition, so a shell in flight drags its own colour. */
const TRAILS = {
  boulder: '#c9bfa4', firepot: '#ff9a3a', ballista: '#efe8d4', hail: '#cfc5b0',
  railshot: '#8fe0ff', rustshell: '#b6c06a', tesla: '#aef4ff', drill: '#9fb0c4',
};
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

/** Which end of the valley industrialises — it follows the crown you picked. */
const machinesSideOf = () => (run.faction === 'machines' ? 'player' : 'enemy');

function buildStage() {
  level = levelOf(run);
  terrain = buildTerrain({ kind: level.terrain, seed: seedOf(run), middle: level.middle });
  scene = createScene(level, terrain, seedOf(run), { machinesSide: machinesSideOf() });
}

/** The menu is not a blank screen: it is the siege you are about to walk into. */
function showcase() {
  buildStage();
  cam.zoomTo(1, true);
  cam.follow(menuFocus(), viewWidth(vp), 1, true);
  previewCastle = createCastle('player', run.blueprint || suggestBlueprint(wallsBudget(run)));
  foePreview = createCastle('enemy', foeBlueprint());
  match = null;
  shop = null;
}

/** Behind the menu: your castle and a stretch of the valley it is defending. */
const menuFocus = () => ({ x: CASTLE_X.player + COLS * CELL + 190, y: 380 });

/**
 * In the workshop the camera is parked over your own plot and zoomed in.
 *
 * The zoom is not decoration: a 40px cell drawn at 1:1 on a phone held upright
 * is about twenty screen pixels, which is half of what a thumb can reliably hit,
 * and building was the part of the game that suffered most for it.
 */
function shopFocus() {
  return { x: CASTLE_X.player + (COLS * CELL) / 2 + 40, y: BASE_Y - 130 };
}
// The plot is 280 wide and 360 tall; these are those plus room for the top bar
// and the palette. Height is what really binds — a zoom chosen on width alone
// magnified the castle past the top of the screen.
const SHOP_SPAN = 560;
const SHOP_TALL = 486;
const shopZoom = () => clamp(Math.min(viewWidth(vp) / SHOP_SPAN, H / SHOP_TALL), 1, 2.6);

function openShop() {
  buildStage();
  shop = createWorkshop({
    blueprint: run.blueprint || suggestBlueprint(wallsBudget(run)),
    coins: run.coins,
    terrain,
    faction: run.faction,
    loadout: run.loadout,
  });
  foePreview = createCastle('enemy', foeBlueprint());
  match = null;
  hover = null;
  message = '';
  fx.clear();
  cam.zoomTo(shopZoom(), true);
  cam.follow(shopFocus(), viewWidth(vp), 1, true);
  setScreen('shop');
}

function startBattle() {
  run.blueprint = shop ? shop.blueprint() : run.blueprint;
  if (shop) run.loadout = { ...shop.ammo };
  vault.save(run);
  match = createMatch({
    level,
    faction: run.faction,
    blueprint: run.blueprint,
    foeBlueprint: foeBlueprint(),
    loadout: run.loadout,
    seed: seedOf(run),
  });
  terrain = match.terrain;
  scene = createScene(level, terrain, seedOf(run), { machinesSide: machinesSideOf() });
  fx.clear();
  phase = 'aim';
  gaugeT = 0;
  power = 0;
  overT = 0;
  enemy.stage = 'idle';
  cam.zoomTo(1, true);
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

/**
 * Aiming by *dragging*, not by pointing.
 *
 * Pointing at the spot you wanted the barrel to face reads well with a mouse and
 * is unusable with a thumb: the same tap that opened the power gauge also
 * snapped the aim to wherever the thumb happened to be, which on a phone is the
 * bottom of the screen — four degrees, every time. Dragging changes the angle by
 * how far you dragged and a tap changes nothing.
 */
function aimBy(dy) {
  if (!dy) return;
  match.aim('player', match.launchers.player.angle + dy * AIM_PER_PX);
}
const AIM_PER_PX = 0.17;
let dragY = null;

function fireNow() {
  match.fire('player', power);
  match.commit();
  phase = 'flight';
}

/** Press and the charge climbs; let go and it leaves. One button, one gesture. */
function startCharge() {
  if (!match || match.over || match.turn !== 'player' || match.flying()) return;
  if (phase !== 'aim') return;
  phase = 'charging';
  gaugeT = 0;
  power = 0;
}

function releaseCharge() {
  if (!match || phase !== 'charging') return;
  fireNow();
}

function shopCellAt(x, y) {
  const p = worldPoint(x, y);
  return shop.castle.cellAt(p.x, p.y);
}

const input = createInput(canvas, vp, {
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
    const r = hit(hudRects, x, y);
    if (r) {
      if (r.kind === 'drive') driving = r.dir;
      else if (r.kind === 'aim') aiming = r.dir;
      else if (r.kind === 'fire') startCharge();
      else if (r.kind === 'weapon') {
        if (!match.pick('player', r.id)) sfx.deny();
        else sfx.place();
      }
      return;
    }
    dragY = y;
  },

  move(x, y, pressed) {
    if (screen === 'shop') {
      const cell = shopCellAt(x, y);
      hover = cell ? { ...cell, ok: shopAllowed(cell) } : null;
      return;
    }
    if (screen !== 'battle' || !match) return;
    if (dragY === null || !pressed) return;
    if (match.over || match.turn !== 'player' || match.flying() || phase !== 'aim') return;
    aimBy(dragY - y);
    dragY = y;
  },

  up() {
    // released anywhere, not just over the button: a thumb that slides off the
    // pad while charging still means "let go", and holding the shot hostage
    // because the finger moved four pixels is the worst kind of unfair
    releaseCharge();
    driving = 0;
    aiming = 0;
    dragY = null;
  },

  keyUp(code) {
    if (code === 'Space' || code === 'Enter') releaseCharge();
  },

  key(code) {
    if (screen === 'battle' && match && !match.over) {
      if (code === 'Space' || code === 'Enter') {
        startCharge();
        return true;
      }
      // all four arrows are *held*, and the update loop reads them: left and
      // right are the engine, up and down the elevation — the layout every
      // artillery game with a mobile has used since Gunbound
      if (/^(Arrow(Up|Down|Left|Right)|Key[WASD])$/.test(code)) return true;
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
  if (r.kind === 'ammo') {
    const why = shop.adjustAmmo(r.id, r.delta);
    if (why) {
      say(t(`why.${why}`));
      sfx.deny();
    } else {
      sfx.place();
    }
    return;
  }
  if (r.id === 'auto') {
    shop.clear();
    const draft = suggestBlueprint(shop.coins - shop.ammoSpent());
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
  // Slow motion: a crown getting hit is the whole point of the match, and at
  // full speed it was over before the eye arrived. Only the *world* slows —
  // the camera and the HUD keep real time, which is what makes it read as
  // emphasis rather than lag.
  slowT = Math.max(0, slowT - h);
  const hw = slowT > 0 ? h * 0.3 : h;
  if (scene) scene.update(hw, screen === 'battle' && match ? match.wind : 6);
  fx.update(hw, terrain);

  const viewW = viewWidth(vp);
  if (screen === 'battle' && match) {
    cam.zoomTo(1);
    cam.follow(focusOf(match), viewW, h);
  } else if (screen === 'shop') {
    cam.zoomTo(shopZoom());
    cam.follow(shopFocus(), viewW, h);
  } else {
    cam.zoomTo(1);
    cam.follow(menuFocus(), viewW, h);
  }

  if (screen !== 'battle' || !match) return;

  // the engine drives while a pad or an arrow is held, and only before the
  // gauge is open: once you have committed to a power you have committed
  if (phase === 'aim' && match.turn === 'player' && !match.flying() && !match.over) {
    const keys = (input.held.has('ArrowLeft') || input.held.has('KeyA') ? -1 : 0) +
      (input.held.has('ArrowRight') || input.held.has('KeyD') ? 1 : 0);
    const dir = keys || driving;
    if (dir) {
      const moved = match.drive('player', dir * DRIVE_SPEED * h);
      if (moved) sfx.roll(match.launchers.player.fuel);
    }
    const tilt = (input.held.has('ArrowUp') || input.held.has('KeyW') ? 1 : 0) +
      (input.held.has('ArrowDown') || input.held.has('KeyS') ? -1 : 0);
    const up = tilt || aiming;
    if (up) match.aim('player', match.launchers.player.angle + up * 42 * h);
  }

  if (phase === 'charging' && match.turn === 'player' && !match.flying()) {
    gaugeT += h;
    const before = power;
    power = chargeAt(gaugeT, CHARGE_RATE);
    if (Math.floor(before / 8) !== Math.floor(power / 8)) sfx.tick(power);
  }

  match.tick(hw);
  // every shell in flight drags a wake in its own colour — with the camera
  // chasing the shot, the trail is what keeps its speed and arc readable
  for (const s of match.shots) {
    if (!(s.burrow > 0)) fx.trail(s.x, s.y, TRAILS[s.w] || '#cfc5b0', s.w === 'boulder' ? 4 : 3);
  }
  // a wounded walker says so from across the map: the machines trail smoke,
  // the kingdom's men kick up the dust of a hard day
  for (const mn of match.minions) {
    if (mn.underground || mn.hp >= mn.max * 0.45) continue;
    if (Math.random() < 0.07) {
      const machine = match.faction[mn.side] === 'machines';
      fx.trail(mn.x + (Math.random() - 0.5) * 10, mn.y - 16, machine ? '#8a97a8' : '#c9bfa4', 2);
    }
  }
  drain();

  // the enemy's turn: a pause to think, an arm swinging round, then a shot —
  // and the pause varies, because a metronome reads as a machine even when
  // the gunnery underneath is good
  if (!match.over && match.turn === 'enemy' && !match.flying()) {
    enemy.t += h;
    if (enemy.stage === 'idle') {
      enemy.stage = 'wait';
      enemy.t = 0;
      enemy.wait = 0.35 + Math.random() * 0.8;
    } else if (enemy.stage === 'wait' && enemy.t > enemy.wait) {
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

/** The last time a walker's swing made a noise — six of them chop in chorus. */
let chopT = -9;

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
        fx.impact(ev.x, ev.y, ev.vx || 0, ev.vy || 0, terrain.spec.dust);
        sfx.boom(big);
        shake = Math.max(shake, 0.6 * big);
        break;
      }
      case 'hit':
        fx.number(ev.x, ev.y - 14, `-${ev.dmg}`, { color: '#ffd27a', size: 12 + Math.min(9, ev.dmg / 9) });
        break;
      case 'pierce':
        fx.shards(ev.x, ev.y, '#e8e2d0', 6);
        if (ev.dmg) fx.number(ev.x, ev.y - 14, `-${ev.dmg}`, { color: '#cfe8ff', size: 14 });
        sfx.crack('crystal');
        break;
      case 'split':
        fx.boom(ev.x, ev.y, 14, '#cccccc');
        break;
      case 'burrow':
        // it went in here, and the only evidence until it goes off is the spray
        fx.shards(ev.x, ev.y, terrain.spec.dust, 14);
        sfx.tumble();
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
      case 'miss':
        say(t('hud.missed'));
        sfx.tumble();
        break;
      case 'gunfell':
        fx.shards(ev.x, ev.y, '#8a6a45', 10);
        sfx.tumble();
        break;
      case 'wave':
        if (ev.side === 'player') {
          say(t('hud.wave'));
          sfx.wave();
        }
        break;
      case 'recruit':
        say(t('hud.newMinion', { name: t(`mn.${ev.kind}`) }));
        break;
      case 'mdie':
        // a pop worth noticing: the side's colour, plus a flash of white
        fx.shards(ev.x, ev.y, match.faction[ev.side] === 'machines' ? '#4ce0ff' : '#c0335a', 10);
        fx.shards(ev.x, ev.y - 4, '#fff2d8', 5);
        sfx.crack(match.faction[ev.side] === 'machines' ? 'iron' : 'wood');
        break;
      case 'mhit':
      case 'mdig':
        if (ev.kind === 'mdig') fx.shards(ev.x, ev.y, terrain.spec.dust, 5);
        if (time - chopT > 0.18) {
          chopT = time;
          sfx.chop();
        }
        break;
      case 'kinghit':
        if (ev.x !== undefined) {
          fx.number(ev.x, ev.y - 26, `-${Math.min(999, Math.round(ev.damage))}`, { color: '#ff7a6a', size: 22 });
        }
        // a shell on the crown earns the slow motion; a walker's bite is a
        // clock ticking, and a clock in permanent slow motion is just lag
        if (ev.damage >= 15) slowT = Math.max(slowT, 0.55);
        sfx.kinghit();
        shake = Math.max(shake, ev.damage >= 15 ? 1 : 0.4);
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
  ctx.translate(sx, sy);
  cam.apply(ctx);

  if (screen === 'battle' && match) {
    drawField(ctx, { match, scene, fx, time, cam, viewW: v.W });
    if (!match.over && match.turn === 'player' && !match.flying()) {
      drawAim(ctx, match, 'player', match.launchers.player.angle, phase === 'charging' ? power : 55);
    }
  } else if (scene) {
    const span = cam.span(v.W);
    scene.drawSky(ctx, cam, span);
    scene.drawGround(ctx, cam, span);
    scene.drawProps(ctx, cam, span);
    const castle = shop ? shop.castle : previewCastle;
    if (foePreview) drawStill(ctx, foePreview, foeFaction());
    if (screen === 'shop') drawShopGrid(ctx, shop, hover, run.faction);
    else if (castle) drawStill(ctx, castle, run.faction);
    scene.drawWeather(ctx, cam, span);
  }
  ctx.restore();

  if (screen === 'battle' && match) {
    hudRects = drawBattleHud(ctx, v, { match, level, phase, power, driving, aiming, message });
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
  // It always worked. What it never did was *look* like it worked: with no run
  // saved there is nothing on the menu for it to clear, so the button read as
  // dead. Now it is only offered when there is something to throw away, and it
  // says what it threw away.
  flashMenu(t('menu.wiped'));
});

let menuNoteT = null;
function flashMenu(text) {
  const el = document.getElementById('m-progress');
  el.textContent = text;
  clearTimeout(menuNoteT);
  menuNoteT = setTimeout(refreshMenu, 2400);
}
for (const el of document.querySelectorAll('[data-faction]')) {
  el.addEventListener('click', () => {
    run.faction = el.dataset.faction;
    // a new crown means a new arsenal: the rack resets to that faction's kit,
    // and a fresh run's purse is the wall budget plus the price of that kit
    run.loadout = defaultLoadout(run.faction);
    if (!run.blueprint) run.coins = START_COINS + kitCost(run.faction);
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
  document.getElementById('btn-reset').hidden = !has;
  document.getElementById('btn-start').textContent = t(has ? 'menu.restart' : 'menu.start');
  document.getElementById('m-progress').textContent = has
    ? `${t('run.level', { n: run.level + 1 })} · ${t('run.coins', { n: run.coins })} · ${t('run.record', { n: run.wins })}`
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
  /** which way the engine is being held, for when a drive pad stops answering */
  get driving() {
    return driving;
  },
};
