// Wiring: the viewport, the loop, the save, the two flags, and the thumbs.

import { createViewport } from 'slopkit/viewport';
import { createLoop } from 'slopkit/loop';
import { createSave } from 'slopkit/save';
import { mountLangPicker, bindText } from 'slopkit/langpicker';

import { H, PLAY_W } from './config.js';
import { i18n, t } from './i18n.js';
import { createGame, update, drain } from './game.js';
import { createRenderer } from './render.js';
import { sound, playEvents } from './audio.js';

const canvas = document.getElementById('canvas');
const menu = document.getElementById('menu');
const over = document.getElementById('over');

bindText(i18n);
mountLangPicker(i18n, { width: 30 });
const applyTitle = () => { document.title = t('page.title'); };
applyTitle();
i18n.onChange(applyTitle);

// portrait-friendly: the playfield scales down and centers on a narrow screen
// (see the frame in render.js), so the game never asks anyone to turn a phone
const vp = createViewport(canvas, { height: H, minWidth: 480, maxWidth: 1400 });

const vault = createSave({
  game: 'invasores-espaciais',
  version: 1,
  key: 'invasores-espaciais.best.v1',
  initial: () => ({ score: 0, wave: 1, runs: 0 }),
  normalize: (raw, base) => {
    if (!raw || typeof raw !== 'object') return base;
    const n = (v, d) => (Number.isFinite(v) && v >= 0 ? v : d);
    return { ...base, score: n(raw.score, 0), wave: n(raw.wave, 1), runs: n(raw.runs, 0) };
  },
});
let best = vault.load();

const renderer = createRenderer();
let game = null;
let phase = 'menu';
let bannerText = '';
let bannerTtl = 0;
let time = 0;

// ------------------------------------------------------------------ input

const keys = new Set();
const input = { left: false, right: false, fire: false, targetX: null };
let pointerDown = false;

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyM') {
    const on = sound.toggle();
    document.getElementById('btn-sound').textContent = on ? '🔊' : '🔇';
  }
  if (phase === 'menu' && (e.code === 'Enter' || e.code === 'Space')) start();
  else if (phase === 'over' && e.code === 'Enter') start();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

function readKeys() {
  input.left = keys.has('ArrowLeft') || keys.has('KeyA');
  input.right = keys.has('ArrowRight') || keys.has('KeyD');
  input.fire = keys.has('Space') || keys.has('KeyJ') || keys.has('KeyZ') || pointerDown;
  if (input.left || input.right) input.targetX = null;
}

// drag to move, and the cannon fires on its own while the finger is down
function pointToPlayfield(clientX) {
  const p = vp.point(clientX, window.innerHeight / 2);
  return renderer.toPlayfield(p.x, vp.W);
}

canvas.addEventListener('pointerdown', (e) => {
  sound.resume();
  pointerDown = true;
  input.targetX = pointToPlayfield(e.clientX);
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (pointerDown) input.targetX = pointToPlayfield(e.clientX);
});
const release = () => { pointerDown = false; input.targetX = null; };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

// ------------------------------------------------------------------ screens

function show(el, on) { el.hidden = !on; }

function start() {
  sound.resume();
  game = createGame({ playW: PLAY_W });
  phase = 'playing';
  bannerText = t('wave.next', { n: 1 });
  bannerTtl = 2;
  show(menu, false);
  show(over, false);
}

function finish() {
  phase = 'over';
  const record = game.score > best.score;
  best = {
    score: Math.max(best.score, game.score),
    wave: Math.max(best.wave, game.wave),
    runs: best.runs + 1,
  };
  vault.save(best);
  document.getElementById('o-score').textContent = String(game.score);
  document.getElementById('o-wave').textContent = String(game.wave);
  document.getElementById('o-killed').textContent = String(game.killed);
  document.getElementById('o-best').textContent = `${best.score} · ${t('hud.wave')} ${best.wave}`;
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

// a still swarm for the menu: the starfield is never a blank screen
let idle = null;
function idleGame() {
  if (!idle) idle = createGame({ playW: PLAY_W, rand: () => 0.5 });
  return idle;
}

createLoop({
  step: 1 / 60,
  update: (h) => {
    time += h;
    if (bannerTtl > 0) bannerTtl -= h;
    if (phase !== 'playing' || !game) return;
    readKeys();
    const waveBefore = game.wave;
    update(game, h, input);
    const events = drain(game);
    for (const e of events) {
      if (e.name === 'wave') {
        bannerText = t('wave.next', { n: e.wave });
        bannerTtl = 2;
      } else if (e.name === 'clear') {
        bannerText = t('wave.clear', { n: waveBefore });
        bannerTtl = 2.2;
      }
    }
    playEvents(events);
    if (game.over) finish();
  },
  draw: () => {
    vp.begin();
    const ctx = vp.ctx;
    if (phase === 'playing' && game) {
      renderer.draw(ctx, game, vp.W, time, best.score,
        bannerTtl > 0 ? bannerText : '', Math.min(1, bannerTtl));
    } else {
      renderer.drawMenu(ctx, vp.W, time, idleGame());
    }
  },
}).start();

document.getElementById('boot').hidden = true;
document.getElementById('btn-sound').textContent = sound.on ? '🔊' : '🔇';

// the bridge: a handle for the console while playing, and what the tests read
window.__game = {
  name: 'invasores-espaciais',
  viewport: vp,
  i18n,
  get game() { return game; },
  start,
  state: () => game,
  best: () => best,
};
