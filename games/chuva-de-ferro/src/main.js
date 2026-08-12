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
import { createTouchControls } from './controls.js';
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

// The touch controls appear where the thumb lands: left half is the stick,
// right half is the trigger (see src/controls.js).
const touch = createTouchControls(() => vp.W);

for (const [type, handler] of [
  ['touchstart', (e) => {
    sound.resume();
    for (const t of e.changedTouches) {
      const p = vp.point(t.clientX, t.clientY);
      touch.start(t.identifier, p.x, p.y);
    }
  }],
  ['touchmove', (e) => {
    for (const t of e.changedTouches) {
      const p = vp.point(t.clientX, t.clientY);
      touch.move(t.identifier, p.x, p.y);
    }
  }],
  ['touchend', (e) => { for (const t of e.changedTouches) touch.end(t.identifier); }],
  ['touchcancel', (e) => { for (const t of e.changedTouches) touch.end(t.identifier); }],
]) {
  canvas.addEventListener(type, (e) => { e.preventDefault(); handler(e); }, { passive: false });
}

function applyTouch() {
  const asked = touch.read();
  input.left = input.left || asked.left;
  input.right = input.right || asked.right;
  input.down = input.down || asked.down;
  input.jump = input.jump || asked.jump;
  input.fire = input.fire || asked.fire;
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
  touch.clear();
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
    applyTouch();
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
      renderer.draw(ctx, game, vp.W, { best, touch: vp.touch ? touch : null });
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
