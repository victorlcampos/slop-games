// Wiring: the viewport, the loop, the save, the two flags, the two sides and
// the thumbs.

import { createViewport } from 'slopkit/viewport';
import { createLoop } from 'slopkit/loop';
import { createSave } from 'slopkit/save';
import { mountLangPicker, bindText } from 'slopkit/langpicker';

import { H, PHASES, TEAMS, other, viewWidth } from './config.js';
import { i18n, t, arenaName, arenaNote } from './i18n.js';
import { buildArena } from './arena.js';
import { createGame } from './game.js';
import { createFx } from './fx.js';
import { createRenderer, screenToWorld, clock } from './render.js';
import { createTouchControls } from './controls.js';
import { sound, sfx } from './audio.js';

const canvas = document.getElementById('canvas');
const menu = document.getElementById('menu');
const over = document.getElementById('over');

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
let phase = 'menu';                     // menu | playing | over
let chosen = Math.min(save.unlocked - 1, PHASES.length - 1);
let side = save.team;

// ------------------------------------------------------------------- input

const keys = new Set();
const input = { mx: 0, my: 0, aim: null, aimAngle: null, fire: false, roll: false, autoAim: false };

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyM') toggleSound();
  if (phase === 'menu' && (e.code === 'Enter' || e.code === 'Space')) start(chosen);
  if (phase === 'over' && e.code === 'Enter') start(chosen);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

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

// ------------------------------------------------------------------ screens

const show = (el, on) => { el.hidden = !on; };

/**
 * The arena list, rebuilt whenever anything about it changes — which includes
 * the flag: these are the only buttons on the page whose text is assembled at
 * runtime, so `bindText` cannot reach them.
 */
function paintArenas() {
  const box = document.getElementById('arenas');
  box.textContent = '';
  PHASES.forEach((p, i) => {
    const locked = i >= save.unlocked;
    const b = document.createElement('button');
    b.className = 'arena';
    b.disabled = locked;
    b.setAttribute('aria-pressed', String(i === chosen));
    const num = document.createElement('b');
    num.textContent = `${t('menu.arena')} ${i + 1}${locked ? ` · ${t('menu.locked')}` : ''}`;
    b.append(num, document.createTextNode(arenaName(p.id)));
    b.addEventListener('click', () => {
      chosen = i;
      sfx.click();
      paintArenas();
    });
    box.append(b);
  });
  document.getElementById('arena-note').textContent = arenaNote(PHASES[chosen].id);
}

function paintSides() {
  for (const team of TEAMS) {
    document.getElementById(`side-${team}`).setAttribute('aria-pressed', String(team === side));
  }
}

const hooks = {
  onShot: (u) => sfx.shot(u.team, u === (game && game.player)),
  onHurt: (u) => { if (u === (game && game.player)) { sfx.hurt(); fx.shake(3); } },
  onKill: (u) => sfx.kill(),
  onRoll: () => sfx.roll(),
  onGate: () => sfx.gate(),
  onRespawn: (u) => { if (u === (game && game.player)) sfx.spawn(); },
  onTurretShot: () => sfx.turret(),
  onFlagTaken: (e) => sfx.taken(e.by === side),
  onFlagHome: (e) => sfx.home(e.team === side),
  onFlagDropped: () => sfx.click(),
  onCapture: (team) => {
    sfx.capture(team === side);
    fx.shake(team === side ? 5 : 2);
    const stand = game.flags[team].home;
    fx.ring(stand.x, stand.y, 120, team === 'human' ? '#ff9a4d' : '#4fe0b0');
    fx.float(stand.x, stand.y - 26, '+1', '#ffffff');
  },
  onEnd: (state) => finish(state),
};

function start(index) {
  sound.resume();
  chosen = Math.min(index, save.unlocked - 1);
  fx.clear();
  renderer.reset();
  touch.clear();
  keys.clear();
  mouseDown = false;
  game = createGame({
    arena: buildArena(chosen),
    team: side,
    fx,
    seed: (Date.now() & 0x7fffffff) || 1,
    hooks,
  });
  phase = 'playing';
  show(menu, false);
  show(over, false);
}

function finish(state) {
  const won = state === 'won';
  const last = chosen >= PHASES.length - 1;
  const unlocked = won && !last && save.unlocked <= chosen + 1;

  const next = {
    team: side,
    unlocked: unlocked ? chosen + 2 : save.unlocked,
    wins: save.wins + (won ? 1 : 0),
    captures: save.captures + game.stats.captures,
  };
  vault.save(next);
  save = next;

  if (won) sfx.win();
  else sfx.lose();

  phase = 'over';
  document.getElementById('o-title').textContent = t(won ? 'end.won' : 'end.lost');
  document.getElementById('o-note').textContent = won
    ? (last ? t('end.last') : arenaNote(PHASES[Math.min(chosen + 1, PHASES.length - 1)].id))
    : t('end.retry');
  document.getElementById('o-score').textContent = `${game.score[side]} — ${game.score[other(side)]}`;
  document.getElementById('o-caps').textContent = String(game.stats.captures);
  document.getElementById('o-returns').textContent = String(game.stats.returns);
  document.getElementById('o-kills').textContent = String(game.stats.kills);
  document.getElementById('o-time').textContent = clock(game.time);
  show(document.getElementById('o-unlocked'), unlocked);
  show(document.getElementById('btn-next'), won && !last);
  show(over, true);
  paintArenas();
}

function toMenu() {
  phase = 'menu';
  game = null;
  renderer.reset();
  fx.clear();
  paintArenas();
  show(over, false);
  show(menu, true);
}

// The cards that are assembled at runtime have to be rewritten when the flag
// changes — bindText only reaches the markup.
i18n.onChange(() => {
  applyTitle();
  paintArenas();
  if (phase === 'over' && game) {
    document.getElementById('o-title').textContent = t(game.state === 'won' ? 'end.won' : 'end.lost');
    document.getElementById('o-note').textContent = game.state === 'won'
      ? (chosen >= PHASES.length - 1 ? t('end.last') : arenaNote(PHASES[Math.min(chosen + 1, PHASES.length - 1)].id))
      : t('end.retry');
  }
});

for (const team of TEAMS) {
  document.getElementById(`side-${team}`).addEventListener('click', () => {
    side = team;
    sfx.click();
    paintSides();
    vault.save({ ...save, team });
    save = { ...save, team };
  });
}
document.getElementById('btn-start').addEventListener('click', () => start(chosen));
document.getElementById('btn-again').addEventListener('click', () => start(chosen));
document.getElementById('btn-next').addEventListener('click', () => start(Math.min(chosen + 1, PHASES.length - 1)));
document.getElementById('btn-menu').addEventListener('click', toMenu);

function toggleSound() {
  const on = sound.toggle();
  document.getElementById('btn-sound').textContent = on ? '🔊' : '🔇';
}
document.getElementById('btn-sound').addEventListener('click', toggleSound);

// ------------------------------------------------------------------ the loop

createLoop({
  step: 1 / 120,
  update: (h) => {
    if (phase !== 'playing' || !game) return;
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
    if (game) {
      renderer.draw(ctx, game, vp, { fx, touch: vp.touch && phase === 'playing' ? touch : null });
    } else {
      ctx.fillStyle = '#05070b';
      ctx.fillRect(0, 0, vp.W, vp.H);
    }
  },
}).start();

paintSides();
paintArenas();
document.getElementById('boot').hidden = true;
document.getElementById('btn-sound').textContent = sound.on ? '🔊' : '🔇';

// the bridge: a handle for the console while playing
window.__game = {
  name: 'guerra-de-bandeiras',
  viewport: vp,
  i18n,
  get game() { return game; },
  start,
  toMenu,
  save: () => save,
  state: () => (game ? game.snapshot() : null),
};
