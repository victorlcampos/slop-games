// Wiring: the viewport, the loop, the save, the two flags, and the thumbs.

import { createViewport } from 'slopkit/viewport';
import { createLoop } from 'slopkit/loop';
import { createSave } from 'slopkit/save';
import { mountLangPicker, bindText } from 'slopkit/langpicker';

import { H, PLAYER } from './config.js';
import { i18n, t } from './i18n.js';
import { createGame } from './game.js';
import { createFx } from './fx.js';
import { createRenderer, clock } from './render.js';
import { sound, sfx } from './audio.js';

const canvas = document.getElementById('canvas');
const menu = document.getElementById('menu');
const over = document.getElementById('over');

bindText(i18n);
mountLangPicker(i18n, { width: 30 });
const applyTitle = () => { document.title = t('page.title'); };
applyTitle();
i18n.onChange(applyTitle);

// The road is nine hundred metres of screen wide and the soldier needs to see
// what is coming: upright, the kit lays the canvas on its side instead of asking
// anyone to unlock their phone (CLAUDE.md, section 2b).
const vp = createViewport(canvas, { height: H, frame: 1280, landscape: true });

const vault = createSave({
  game: 'chuva-de-ferro',
  version: 1,
  key: 'chuva-de-ferro.best.v1',
  initial: () => ({ score: 0, time: 0, runs: 0 }),
  normalize: (raw, base) => {
    if (!raw || typeof raw !== 'object') return base;
    const n = (v, d) => (Number.isFinite(v) && v >= 0 ? v : d);
    return { ...base, score: n(raw.score, 0), time: n(raw.time, 0), runs: n(raw.runs, 0) };
  },
});
let best = vault.load();

const fx = createFx();
const renderer = createRenderer();
let game = null;
let phase = 'menu';

// ------------------------------------------------------------------ input

const keys = new Set();
const input = { left: false, right: false, jump: false, down: false, up: false, fire: false };
const pads = [];

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyM') { sound.toggle(); }
  if (phase === 'menu' && (e.code === 'Enter' || e.code === 'Space')) start();
  if (phase === 'over' && e.code === 'Enter') start();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

function readKeys() {
  input.left = keys.has('ArrowLeft') || keys.has('KeyA');
  input.right = keys.has('ArrowRight') || keys.has('KeyD');
  input.down = keys.has('ArrowDown') || keys.has('KeyS');
  input.up = keys.has('ArrowUp') || keys.has('KeyW');
  input.jump = keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW');
  input.fire = keys.has('KeyJ') || keys.has('KeyZ') || keys.has('ShiftLeft') || mouseDown;
}

let mouseDown = false;
canvas.addEventListener('mousedown', () => { mouseDown = true; sound.resume(); });
addEventListener('mouseup', () => { mouseDown = false; });

/** The thumbs: five pads drawn on the canvas, in logical coordinates. */
function layoutPads() {
  pads.length = 0;
  const y = H - 96;
  pads.push({ id: 'left', icon: '◀', x: 100, y, r: 52, held: false });
  pads.push({ id: 'right', icon: '▶', x: 216, y, r: 52, held: false });
  pads.push({ id: 'down', icon: '▼', x: 158, y: y - 106, r: 44, held: false });
  pads.push({ id: 'jump', icon: '⤒', x: vp.W - 220, y, r: 56, held: false });
  pads.push({ id: 'fire', icon: '✦', x: vp.W - 96, y: y - 26, r: 66, held: false });
}

const touches = new Map();
function padAt(x, y) {
  for (const p of pads) if (Math.hypot(p.x - x, p.y - y) < p.r * 1.15) return p;
  return null;
}
function applyPads() {
  for (const p of pads) p.held = false;
  for (const id of touches.keys()) {
    const p = touches.get(id);
    if (p) p.held = true;
  }
  if (!vp.touch) return;
  const held = (id) => pads.some((p) => p.id === id && p.held);
  input.left = input.left || held('left');
  input.right = input.right || held('right');
  input.down = input.down || held('down');
  input.jump = input.jump || held('jump');
  input.up = input.up || held('down') === false && false;   // ↑ stays a keyboard-only override
  input.fire = input.fire || held('fire');
}

for (const [type, handler] of [
  ['touchstart', (e) => {
    sound.resume();
    for (const touch of e.changedTouches) {
      const p = vp.point(touch.clientX, touch.clientY);
      touches.set(touch.identifier, padAt(p.x, p.y));
    }
  }],
  ['touchmove', (e) => {
    for (const touch of e.changedTouches) {
      const p = vp.point(touch.clientX, touch.clientY);
      touches.set(touch.identifier, padAt(p.x, p.y));
    }
  }],
  ['touchend', (e) => { for (const touch of e.changedTouches) touches.delete(touch.identifier); }],
  ['touchcancel', (e) => { for (const touch of e.changedTouches) touches.delete(touch.identifier); }],
]) {
  canvas.addEventListener(type, (e) => { e.preventDefault(); handler(e); }, { passive: false });
}

// ------------------------------------------------------------------ screens

function show(el, on) { el.hidden = !on; }

function start() {
  sound.resume();
  fx.clear();
  renderer.reset();
  game = createGame({ fx, seed: (Date.now() & 0x7fffffff) || 1, onOver: finish });
  phase = 'playing';
  show(menu, false);
  show(over, false);
  canvas.hidden = false;
  layoutPads();
}

function finish(result) {
  phase = 'over';
  sfx.over();
  const record = result.score > best.score || result.time > best.time;
  best = vault.save({
    score: Math.max(best.score, Math.round(result.score)),
    time: Math.max(best.time, result.time),
    runs: best.runs + 1,
  });
  document.getElementById('o-score').textContent = String(Math.round(result.score));
  document.getElementById('o-time').textContent = clock(result.time);
  document.getElementById('o-killed').textContent = String(result.killed);
  document.getElementById('o-best').textContent = `${best.score} · ${clock(best.time)}`;
  show(document.getElementById('o-record'), record);
  show(over, true);
}

document.getElementById('btn-start').addEventListener('click', start);
document.getElementById('btn-again').addEventListener('click', start);
document.getElementById('btn-sound').addEventListener('click', (e) => {
  const on = sound.toggle();
  e.currentTarget.textContent = on ? '🔊' : '🔇';
});

// ------------------------------------------------------------------ the loop

let lastScore = 0;
let lastLives = PLAYER.lives;
let lastShots = 0;

createLoop({
  step: 1 / 120,
  update: (h) => {
    if (phase !== 'playing' || !game) return;
    readKeys();
    applyPads();
    const before = game.shots.length;
    game.update(h, input);
    if (game.shots.length > before) sfx.shot(game.weapon().kind);
    lastShots = game.shots.length;
    if (game.soldier.lives < lastLives) sfx.hurt();
    lastLives = game.soldier.lives;
    if (game.state.score !== lastScore) lastScore = game.state.score;
  },
  draw: () => {
    vp.begin();
    const ctx = vp.ctx;
    if (phase === 'playing' && game) {
      if (pads.length && pads[3].x !== vp.W - 220) layoutPads();
      renderer.draw(ctx, game, vp.W, { best, pads: vp.touch ? pads : null });
    } else {
      // the menu paints the same sky behind the card, so the game is never a blank
      renderer.draw(ctx, idleGame(), vp.W, { best, pads: null, chrome: false });
    }
  },
}).start();

/** A frozen scene for the menu: the road, the wreck overhead, nobody firing. */
let idle = null;
function idleGame() {
  if (!idle) {
    idle = createGame({ fx: { ...fx, spark() {}, smoke() {}, ring() {}, beam() {}, float() {} }, seed: 7 });
    for (let i = 0; i < 240; i++) idle.update(1 / 60, { left: false, right: false, jump: false, down: false, up: false, fire: false });
  }
  idle.update(1 / 60, { left: false, right: true, jump: false, down: false, up: false, fire: false });
  return idle;
}

vp.watch(() => layoutPads());
layoutPads();
document.getElementById('boot').hidden = true;
document.getElementById('btn-sound').textContent = sound.on ? '🔊' : '🔇';

// the bridge: a handle for the console while playing, and what the tests read
window.__game = {
  name: 'chuva-de-ferro',
  viewport: vp,
  i18n,
  get game() { return game; },
  start,
  state: () => (game ? game.state : null),
  best: () => best,
};
