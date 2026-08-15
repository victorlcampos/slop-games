// Wiring: the viewport, the loop, the save, the two screens you come in
// through, the two flags and the thumbs.

import { createViewport } from 'slopkit/viewport';
import { createLoop } from 'slopkit/loop';
import { createSave } from 'slopkit/save';
import { mountLangPicker, bindText } from 'slopkit/langpicker';

import { H, PHASES, TEAMS, GUNS, UNIT, other, viewWidth } from './config.js';
import { i18n, t, arenaName, arenaNote } from './i18n.js';
import { buildArena } from './arena.js';
import { createGame } from './game.js';
import { createFx } from './fx.js';
import { createRenderer, screenToWorld, shopCards, clock } from './render.js';
import { createTouchControls } from './controls.js';
import { sound, sfx } from './audio.js';
import { ARMOURY } from './weapons.js';
import { createFlow } from './flow.js';
import { heroPose, drawHero } from './hero.js';
import { drawArenaThumb } from './thumb.js';

const canvas = document.getElementById('canvas');
const menu = document.getElementById('menu');
const pick = document.getElementById('pick');
const over = document.getElementById('over');
const flash = document.getElementById('flash');

bindText(i18n);
mountLangPicker(i18n, { width: 30 });
const applyTitle = () => { document.title = t('page.title'); };
applyTitle();

// The field is wider than it is tall by a long way, and it is drawn whole.
// Upright, the kit lays the canvas on its side rather than asking anybody to
// unlock rotation (CLAUDE.md, section 2b).
const vp = createViewport(canvas, { height: H, frame: 1280, landscape: true });

const vault = createSave({
  game: 'guerra-de-bandeiras',
  version: 1,
  key: 'guerra-de-bandeiras.save.v1',
  initial: () => ({ team: 'human', unlocked: 1, wins: 0, captures: 0 }),
  normalize: (raw, base) => {
    if (!raw || typeof raw !== 'object') return base;
    const n = (v, d, max = Infinity) => (Number.isFinite(v) && v >= 0 ? Math.min(v, max) : d);
    return {
      ...base,
      team: TEAMS.includes(raw.team) ? raw.team : base.team,
      unlocked: Math.max(1, n(raw.unlocked, 1, PHASES.length)),
      wins: n(raw.wins, 0),
      captures: n(raw.captures, 0),
    };
  },
});
let save = vault.load();

const fx = createFx();
const renderer = createRenderer();
// the thumbs are placed against the visible width, not the logical one:
// on a 4:3 screen they are not the same number (see viewWidth)
const touch = createTouchControls(() => viewWidth(vp), () => vp.H);

let game = null;
let menuTime = 0;                       // the clock the two entry screens breathe to

const flow = createFlow({
  unlocked: save.unlocked,
  arena: Math.min(save.unlocked - 1, PHASES.length - 1),
  team: save.team,
  onStart: (index, team) => start(index, team),
});

const playing = () => flow.screen === 'playing';

// ------------------------------------------------------------------- input

const keys = new Set();
const input = { mx: 0, my: 0, aim: null, aimAngle: null, fire: false, roll: false, autoAim: false };

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyM') { toggleSound(); return; }
  if (menuKey(e.code)) return;
  // the armoury: one key a gun, and the game says no if he is not standing on
  // his own ground or cannot afford it
  if (playing() && game && game.player) {
    const slot = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (slot >= 0 && ARMOURY[slot]) game.buy(game.player, ARMOURY[slot].id);
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

/** The keyboard on the way in. Returns true when the key was a screen's. */
function menuKey(code) {
  if (flow.screen === 'arena') {
    const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(code);
    if (digit >= 0) return takeArena(digit);
    if (code === 'ArrowLeft' || code === 'ArrowRight') {
      if (flow.hover(flow.arena + (code === 'ArrowRight' ? 1 : -1))) sfx.click();
      highlightArena();
      return true;
    }
    // the grid is three across on a wide screen and two on a phone; up and down
    // move by three, which is right often enough to be worth having
    if (code === 'ArrowUp' || code === 'ArrowDown') {
      flow.hover(flow.arena + (code === 'ArrowDown' ? 3 : -3));
      highlightArena();
      return true;
    }
    if (code === 'Enter' || code === 'Space') return takeArena(flow.arena);
    return false;
  }

  if (flow.screen === 'hero') {
    if (code === 'ArrowLeft' || code === 'ArrowRight') {
      const want = code === 'ArrowLeft' ? 'human' : 'alien';
      if (flow.team !== want) { flow.team = want; sfx.click(); paintHeroes(); }
      return true;
    }
    if (code === 'Enter' || code === 'Space') { takeHero(flow.team); return true; }
    if (code === 'Escape' || code === 'Backspace') { toArenas(); return true; }
    return false;
  }

  if (flow.screen === 'intro') { flow.skip(); return true; }
  if (flow.screen === 'over' && code === 'Enter') { restart(); return true; }
  return false;
}

let mouseDown = false;
let mouse = null;
canvas.addEventListener('mousedown', (e) => {
  sound.resume();
  mouseDown = true;
  mouse = vp.point(e.clientX, e.clientY);
});
canvas.addEventListener('mousemove', (e) => { mouse = vp.point(e.clientX, e.clientY); });
canvas.addEventListener('mouseleave', () => { mouse = null; });
addEventListener('mouseup', () => { mouseDown = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

for (const [type, handler] of [
  ['touchstart', (e) => {
    sound.resume();
    for (const f of e.changedTouches) {
      const p = vp.point(f.clientX, f.clientY);
      // a tap on a gun in the armoury buys it and goes no further: the thumb
      // hits the same rectangle the eye sees (`shopCards`)
      if (buyByTouch(p)) continue;
      touch.start(f.identifier, p.x, p.y);
    }
  }],
  ['touchmove', (e) => {
    for (const f of e.changedTouches) {
      const p = vp.point(f.clientX, f.clientY);
      touch.move(f.identifier, p.x, p.y);
    }
  }],
  ['touchend', (e) => { for (const f of e.changedTouches) touch.end(f.identifier); }],
  ['touchcancel', (e) => { for (const f of e.changedTouches) touch.end(f.identifier); }],
]) {
  canvas.addEventListener(type, (e) => { e.preventDefault(); handler(e); }, { passive: false });
}

// The card covers the whole screen during the flourish, so a tap anywhere on it
// is impatience — and impatience is honoured, after the floor `flow.skip` keeps
// for the tap that chose the side in the first place.
pick.addEventListener('pointerdown', () => { if (flow.screen === 'intro') flow.skip(); });

/** Did that tap land on a gun in the armoury? */
function buyByTouch(p) {
  if (!playing() || !game || !game.player || game.player.dead) return false;
  if (!game.inBase(game.player)) return false;
  for (const card of shopCards(viewWidth(vp), vp.H)) {
    if (p.x >= card.x && p.x <= card.x + card.w && p.y >= card.y && p.y <= card.y + card.h) {
      game.buy(game.player, card.gun.id);
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------ screens

const show = (el, on) => { el.hidden = !on; };

/** Whichever of the three cards belongs to the screen we are on. */
function paintScreens() {
  show(menu, flow.screen === 'arena');
  show(pick, flow.screen === 'hero' || flow.screen === 'intro');
  show(over, flow.screen === 'over');
  pick.classList.toggle('picking', flow.screen === 'intro');
  if (flow.screen === 'arena') paintArenas();
  if (flow.screen === 'hero') paintHeroes();
}

/**
 * The six arenas, each drawn from the field it actually is.
 *
 * Rebuilt whenever anything about it changes — which includes the flag: these
 * are the only buttons on the page whose text is assembled at runtime, so
 * `bindText` cannot reach them.
 */
function paintArenas() {
  const box = document.getElementById('arenas');
  box.textContent = '';
  PHASES.forEach((p, i) => {
    const locked = flow.locked(i);
    const b = document.createElement('button');
    b.className = 'arena';
    b.disabled = locked;
    b.setAttribute('aria-pressed', String(i === flow.arena));

    const art = document.createElement('canvas');
    const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
    art.width = Math.round(224 * dpr);
    art.height = Math.round(136 * dpr);
    const ctx = art.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      drawArenaThumb(ctx, buildArena(i), 224, 136);
      // the card is already at 40% opacity in CSS; this is the second half of
      // "you cannot go there yet", and much more than this makes the night
      // arena's map disappear altogether
      if (locked) {
        ctx.fillStyle = 'rgba(5,7,11,0.42)';
        ctx.fillRect(0, 0, 224, 136);
      }
    }

    const no = document.createElement('span');
    no.className = 'no';
    no.textContent = [
      `${t('menu.arena')} ${i + 1}`,
      locked ? t('menu.locked') : t('menu.squad', { n: p.squad }),
      p.dark ? t('menu.night') : null,
    ].filter(Boolean).join(' · ');
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = arenaName(p.id);
    // the line that was a paragraph under the old list: on the card it belongs
    // to the arena it describes, which is where you are looking anyway
    const dt = document.createElement('span');
    dt.className = 'dt';
    dt.textContent = arenaNote(p.id);

    b.append(art, no, nm, dt);
    b.addEventListener('click', () => takeArena(i));
    // moving the mouse over a card moves the keyboard's highlight too, so the
    // two ways of choosing never disagree about what Enter would take
    b.addEventListener('pointerenter', () => {
      if (locked || flow.screen !== 'arena') return;
      flow.hover(i);
      highlightArena();
    });
    box.append(b);
  });
}

/**
 * Move the highlight without rebuilding the row.
 *
 * `paintArenas` redraws six maps, and an arrow key held down would rebuild them
 * all thirty times a second for a border that changed colour.
 */
function highlightArena() {
  const box = document.getElementById('arenas');
  [...box.children].forEach((el, i) => el.setAttribute('aria-pressed', String(i === flow.arena)));
}

const heroArt = {};
function heroCanvases() {
  for (const team of TEAMS) {
    const el = document.querySelector(`#hero-${team} .art`);
    if (!el) continue;
    const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
    el.width = Math.round(360 * dpr);
    el.height = Math.round(450 * dpr);
    const ctx = el.getContext('2d');
    if (!ctx) continue;
    ctx.scale(dpr, dpr);
    heroArt[team] = ctx;
  }
}

/** The text on the two cards, and which of them is highlighted. */
function paintHeroes() {
  document.getElementById('pick-arena').textContent =
    `${t('menu.arena')} ${flow.arena + 1} · ${arenaName(PHASES[flow.arena].id)}`;
  for (const team of TEAMS) {
    const card = document.getElementById(`hero-${team}`);
    card.setAttribute('aria-pressed', String(team === flow.team));
    card.classList.remove('chosen', 'away');
    const gun = GUNS[team];
    document.getElementById(`gun-${team}`).textContent = t('hero.gun', {
      gun: t(`gun.${gun.id}`),
      shots: Math.ceil(UNIT.hp / gun.damage),
      rate: Math.round(1 / gun.rate),
    });
  }
  flash.style.opacity = '0';
  pick.style.opacity = '';
}

function takeArena(i) {
  if (!flow.chooseArena(i)) return false;
  sound.resume();
  sfx.taken(true);
  menuTime = 0;
  paintScreens();
  return true;
}

/** The moment of theatre: the card commits, the figure performs, the field opens. */
function takeHero(team) {
  if (!flow.chooseTeam(team)) return false;
  sound.resume();
  save = { ...save, team };
  vault.save(save);
  sfx.pick(team);
  struck = false;
  flash.style.setProperty('--tint', team === 'human' ? '#ffb877' : '#7ff0cd');
  for (const t2 of TEAMS) {
    const card = document.getElementById(`hero-${t2}`);
    card.classList.toggle('chosen', t2 === team);
    card.classList.toggle('away', t2 !== team);
  }
  pick.classList.add('picking');
  return true;
}

let struck = false;                     // has the strike's bang already gone off?

function toArenas() {
  flow.toArenas();
  sfx.click();
  paintScreens();
}

const hooks = {
  onShot: (u) => sfx.shot(u.team, u === (game && game.player)),
  onHurt: (u) => { if (u === (game && game.player)) { sfx.hurt(); fx.shake(3); } },
  onKill: (u) => sfx.kill(),
  onRoll: (u) => {
    sfx.roll();
    // dust off the deck where he threw himself down: at ten pixels across, a
    // body needs something around it for a roll to read as a roll
    fx.ring(u.x, u.y, 46, 'rgba(200,214,240,0.8)');
    fx.spark(u.x, u.y, '#9fb2c4', 7, 150);
  },
  onGate: () => sfx.gate(),
  onRespawn: (u) => { if (u === (game && game.player)) sfx.spawn(); },
  onTurretShot: () => sfx.turret(),
  onBuy: (u) => { if (u === (game && game.player)) { sfx.buy(); fx.ring(u.x, u.y, 60, '#5ce8cf'); } },
  onPickGun: (u) => { if (u === (game && game.player)) sfx.buy(); },
  onDry: (u) => { if (u === (game && game.player)) sfx.dry(); },
  onFlagTaken: (e) => sfx.taken(e.by === flow.team),
  onFlagHome: (e) => sfx.home(e.team === flow.team),
  onFlagDropped: () => sfx.click(),
  onCapture: (team) => {
    sfx.capture(team === flow.team);
    fx.shake(team === flow.team ? 5 : 2);
    const stand = game.flags[team].home;
    fx.ring(stand.x, stand.y, 120, team === 'human' ? '#ff9a4d' : '#4fe0b0');
    fx.float(stand.x, stand.y - 26, '+1', '#ffffff');
  },
  onEnd: (state) => finish(state),
};

function start(index, team) {
  sound.resume();
  fx.clear();
  renderer.reset();
  touch.clear();
  keys.clear();
  mouseDown = false;
  game = createGame({
    arena: buildArena(index),
    team,
    fx,
    seed: (Date.now() & 0x7fffffff) || 1,
    hooks,
  });
  paintScreens();
  // the light the pick left on the screen fades off the field rather than
  // cutting: the match is already running underneath it
  flash.style.transition = 'opacity 0.45s ease-out';
  flash.style.opacity = '0';
  setTimeout(() => { flash.style.transition = ''; }, 500);
}

/** Straight back onto the field with the same arena and the same body. */
function restart() {
  flow.screen = 'playing';
  start(flow.arena, flow.team);
}

function finish(state) {
  const won = state === 'won';
  const last = flow.arena >= PHASES.length - 1;
  const unlocked = won && !last && save.unlocked <= flow.arena + 1;

  const next = {
    team: flow.team,
    unlocked: unlocked ? flow.arena + 2 : save.unlocked,
    wins: save.wins + (won ? 1 : 0),
    captures: save.captures + game.stats.captures,
  };
  vault.save(next);
  save = next;
  flow.setUnlocked(save.unlocked);

  if (won) sfx.win();
  else sfx.lose();

  flow.finish();
  document.getElementById('o-title').textContent = t(won ? 'end.won' : 'end.lost');
  document.getElementById('o-note').textContent = won
    ? (last ? t('end.last') : arenaNote(PHASES[Math.min(flow.arena + 1, PHASES.length - 1)].id))
    : t('end.retry');
  document.getElementById('o-score').textContent = `${game.score[flow.team]} — ${game.score[other(flow.team)]}`;
  document.getElementById('o-caps').textContent = String(game.stats.captures);
  document.getElementById('o-returns').textContent = String(game.stats.returns);
  document.getElementById('o-kills').textContent = String(game.stats.kills);
  document.getElementById('o-time').textContent = clock(game.time);
  show(document.getElementById('o-unlocked'), unlocked);
  show(document.getElementById('btn-next'), won && !last);
  paintScreens();
}

// The cards that are assembled at runtime have to be rewritten when the flag
// changes — bindText only reaches the markup.
i18n.onChange(() => {
  applyTitle();
  if (flow.screen === 'arena') paintArenas();
  if (flow.screen === 'hero') paintHeroes();
  if (flow.screen === 'over' && game) {
    document.getElementById('o-title').textContent = t(game.state === 'won' ? 'end.won' : 'end.lost');
    document.getElementById('o-note').textContent = game.state === 'won'
      ? (flow.arena >= PHASES.length - 1 ? t('end.last') : arenaNote(PHASES[Math.min(flow.arena + 1, PHASES.length - 1)].id))
      : t('end.retry');
  }
});

for (const team of TEAMS) {
  document.getElementById(`hero-${team}`).addEventListener('click', () => takeHero(team));
  document.getElementById(`hero-${team}`).addEventListener('pointerenter', () => {
    if (flow.screen !== 'hero' || flow.team === team) return;
    flow.team = team;
    paintHeroes();
  });
}
document.getElementById('btn-back').addEventListener('click', toArenas);
document.getElementById('btn-again').addEventListener('click', restart);
document.getElementById('btn-side').addEventListener('click', () => {
  flow.toHeroes();
  sfx.click();
  paintScreens();
});
document.getElementById('btn-next').addEventListener('click', () => {
  flow.arena = Math.min(flow.arena + 1, flow.unlocked - 1);
  restart();
});
document.getElementById('btn-menu').addEventListener('click', toArenas);

function toggleSound() {
  const on = sound.toggle();
  document.getElementById('btn-sound').textContent = on ? '🔊' : '🔇';
}
document.getElementById('btn-sound').addEventListener('click', toggleSound);

// ------------------------------------------------------------------ the loop

createLoop({
  step: 1 / 120,
  update: (h) => {
    if (flow.inMenus) {
      menuTime += h;
      const before = flow.screen;
      flow.tick(h);
      // the bang lands on the strike, a third of the way in — not on the click,
      // which is where it would be if the sound were played with the choice
      if (before === 'intro' && !struck && flow.progress >= 0.34) {
        struck = true;
        sfx.commit(flow.team);
      }
      return;
    }
    if (!playing() || !game) return;
    readKeys();
    // from where he is *now*, not from the camera the last frame was drawn
    // with: a frame of lag here is a cursor the gun trails behind
    input.aim = mouse && game.player && !game.player.dead
      ? screenToWorld(mouse.x, mouse.y, vp, game.player)
      : null;
    if (vp.touch) {
      const asked = touch.read();
      if (asked.mx || asked.my) {
        input.mx = asked.mx;
        input.my = asked.my;
      }
      if (asked.aimAngle !== null) {
        input.aimAngle = asked.aimAngle;
        input.aim = null;
      }
      input.fire = input.fire || asked.fire;
      input.roll = input.roll || asked.roll;
    }
    // A trigger with no direction on it — a tap on a phone, or the fire key
    // with the mouse off the canvas — asks the game for a target instead of
    // firing wherever the body happens to face.
    input.autoAim = input.fire && !input.aim && typeof input.aimAngle !== 'number';
    game.update(h, input);
    fx.update(h);
  },
  draw: () => {
    vp.begin();
    const ctx = vp.ctx;
    if (game && !flow.inMenus) {
      renderer.draw(ctx, game, vp, { fx, touch: vp.touch && playing() ? touch : null });
    } else {
      ctx.fillStyle = '#05070b';
      ctx.fillRect(0, 0, vp.W, vp.H);
    }
    if (flow.screen === 'hero' || flow.screen === 'intro') drawHeroes();
  },
}).start();

function readKeys() {
  const left = keys.has('ArrowLeft') || keys.has('KeyA');
  const right = keys.has('ArrowRight') || keys.has('KeyD');
  const up = keys.has('ArrowUp') || keys.has('KeyW');
  const down = keys.has('ArrowDown') || keys.has('KeyS');
  input.mx = (right ? 1 : 0) - (left ? 1 : 0);
  input.my = (down ? 1 : 0) - (up ? 1 : 0);
  input.fire = mouseDown || keys.has('KeyJ');
  input.roll = keys.has('Space') || keys.has('ShiftLeft');
  // cleared every frame: a stale angle from a thumb that has already left the
  // screen would keep him facing a wall for the rest of the match
  input.aimAngle = null;
}

/** Both figures, every frame, on their own canvases inside the cards. */
function drawHeroes() {
  const picking = flow.screen === 'intro';
  for (const team of TEAMS) {
    const ctx = heroArt[team];
    if (!ctx) continue;
    const mine = picking && team === flow.team;
    const pose = heroPose(team, menuTime, mine ? flow.progress : 0);
    ctx.clearRect(0, 0, 360, 450);
    drawHero(ctx, team, 360, 450, pose, {
      picked: !picking && team === flow.team,
      // the one that was not chosen goes dark before it slides away
      dim: picking && !mine ? Math.min(1, flow.progress * 3) : 0,
    });
    if (mine) flash.style.opacity = String(Math.min(0.85, pose.glow * 0.9));
  }
  // the card itself goes out under the light in the last fifth, so the field
  // arrives out of the glow instead of behind a cut
  pick.style.opacity = picking
    ? String(1 - Math.max(0, (flow.progress - 0.8) / 0.2))
    : '';
}

heroCanvases();
paintScreens();
document.getElementById('boot').hidden = true;
document.getElementById('btn-sound').textContent = sound.on ? '🔊' : '🔇';

// the bridge: a handle for the console while playing
window.__game = {
  name: 'guerra-de-bandeiras',
  viewport: vp,
  i18n,
  flow,
  // the two figures, reachable from the console: a pose at any point of the
  // flourish, painted into any canvas, without having to catch it live
  hero: { pose: heroPose, draw: drawHero },
  get game() { return game; },
  start: (i) => { flow.arena = Math.min(i, flow.unlocked - 1); restart(); },
  toMenu: toArenas,
  save: () => save,
  state: () => (game ? game.snapshot() : null),
};
