// Wiring: viewport, loop, save, the two flags, the keys and the thumbs.

import { createViewport } from 'slopkit/viewport';
import { createLoop } from 'slopkit/loop';
import { createSave } from 'slopkit/save';
import { mountLangPicker, bindText } from 'slopkit/langpicker';

import { H, C, RANKS } from './config.js';
import { i18n, t } from './i18n.js';
import { createGame } from './game.js';
import { createRenderer } from './render/index.js';
import { sound, sfx, startMusic, stopMusic } from './audio.js';

const canvas = document.getElementById('canvas');
const menu = document.getElementById('menu');
const over = document.getElementById('over');

bindText(i18n);
mountLangPicker(i18n, { width: 30 });
const applyTitle = () => { document.title = t('page.title'); };
applyTitle();
i18n.onChange(applyTitle);

// No forced landscape here, and that is the point. A pinball machine is a tall
// thing and so is a phone held upright: turning the canvas would give the
// player a table lying on its side for no reason. The renderer reads the shape
// of the frame instead — narrow puts the display across the top with the table
// under it, wide stands the backglass beside it (see render/layout.js). The
// kit's minimum width has to come down for that: its default of 1040 is wider
// than a portrait phone's whole logical frame, and the clamp would push half
// the table off the screen.
const vp = createViewport(canvas, { height: H, minWidth: 330, maxWidth: 1900 });

const vault = createSave({
  game: 'pinball-anarquia',
  version: 1,
  initial: () => ({ score: 0, games: 0 }),
  normalize: (raw, base) => {
    if (!raw || typeof raw !== 'object') return base;
    const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    return { ...base, score: n(raw.score), games: n(raw.games) };
  },
  i18n,
});
let best = vault.load();

const renderer = createRenderer(t);
let game = null;
let phase = 'menu';
let clock = 0;

// ------------------------------------------------------------------ events

function onEvent(type) {
  const b = game ? game.ball : null;
  switch (type) {
    case 'bumper': sfx.bumper(); if (b) renderer.spark(b.x, b.y, C.cyan, 10, 260); break;
    case 'sling': sfx.sling(); if (b) renderer.spark(b.x, b.y, C.red, 8); break;
    case 'rollover': sfx.rollover(); break;
    case 'lanes': sfx.lanes(); break;
    case 'target': sfx.target(); if (b) renderer.spark(b.x, b.y, C.red, 6); break;
    case 'bank': sfx.bank(); break;
    case 'hole': sfx.hole(); break;
    case 'eject': sfx.eject(); if (b) renderer.spark(b.x, b.y, C.green, 12, 300); break;
    case 'launch': sfx.launch(); break;
    case 'skill': sfx.skill(); break;
    case 'save': sfx.save(); break;
    case 'kickback': sfx.kickback(); if (b) renderer.spark(b.x, b.y, C.green, 10, 320); break;
    case 'nudge': sfx.nudge(); break;
    case 'spinner': sfx.spinner(game ? game.table.spinner.spin : 8); if (b) renderer.spark(b.x, b.y, C.yellow, 6, 200); break;
    case 'inlane': sfx.inlane(); break;
    case 'inlanes': sfx.inlanes(); break;
    case 'outlane': sfx.outlane(); break;
    case 'orbit': sfx.orbit(); if (b) renderer.spark(b.x, b.y, C.cyan, 14, 300); break;
    case 'tilt': sfx.tilt(); break;
    case 'drain': sfx.drain(); break;
    case 'extra': sfx.extra(); break;
    case 'mission': sfx.mission(); if (b) renderer.spark(b.x, b.y, C.yellow, 20, 340); break;
    case 'over': finish(); break;
  }
}

// ------------------------------------------------------------------ input

const keys = new Set();
const input = { left: false, right: false, plunger: false, nudgeL: false, nudgeR: false, nudgeUp: false };

addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Period'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  sound.resume();
  if (e.code === 'KeyM') sound.toggle();
  if (phase !== 'playing' && (e.code === 'Enter' || e.code === 'Space')) { start(); return; }
  if (phase === 'playing') {
    if (e.code === 'KeyX') input.nudgeL = true;
    if (e.code === 'Period' || e.code === 'KeyN') input.nudgeR = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') input.nudgeUp = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyZ') sfx.flipper();
    if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Slash') sfx.flipper();
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

function readKeys() {
  input.left = keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('KeyZ');
  input.right = keys.has('ArrowRight') || keys.has('KeyD') || keys.has('Slash');
  input.plunger = keys.has('Space') || keys.has('ArrowDown') || keys.has('KeyS');
}

// Touch: while the ball waits on the plunger every finger is the plunger —
// hold to pull, let go to fire. In play, each half of the screen is a flipper.
const touches = new Map(); // identifier -> 'L' | 'R'
let touchPlunger = false;

function touchSide(clientX) {
  // vp.point() untangles the turned canvas; we only need which half
  const p = vp.point(clientX, 0);
  return p.x < vp.W / 2 ? 'L' : 'R';
}

for (const [type, handler] of [
  ['touchstart', (e) => {
    sound.resume();
    for (const tc of e.changedTouches) {
      if (game && game.state.phase === 'plunger') touchPlunger = true;
      else {
        touches.set(tc.identifier, touchSide(tc.clientX));
        sfx.flipper();
      }
    }
  }],
  ['touchend', (e) => { for (const tc of e.changedTouches) touches.delete(tc.identifier); if (e.touches.length === 0) touchPlunger = false; }],
  ['touchcancel', (e) => { for (const tc of e.changedTouches) touches.delete(tc.identifier); if (e.touches.length === 0) touchPlunger = false; }],
]) {
  canvas.addEventListener(type, (e) => { e.preventDefault(); handler(e); }, { passive: false });
}

function applyTouch() {
  if (touchPlunger && game && game.state.phase !== 'plunger') touchPlunger = false;
  input.plunger = input.plunger || touchPlunger;
  for (const side of touches.values()) {
    if (side === 'L') input.left = true;
    else input.right = true;
  }
}

// ------------------------------------------------------------------ screens

function show(el, on) { el.hidden = !on; }

function start() {
  sound.resume();
  game = createGame({ onEvent });
  game.best = best.score;
  phase = 'playing';
  touches.clear();
  touchPlunger = false;
  show(menu, false);
  show(over, false);
  startMusic();
}

function fillOver() {
  if (!game) return;
  document.getElementById('o-score').textContent = String(game.state.score);
  document.getElementById('o-missions').textContent = String(game.state.missionsDone);
  document.getElementById('o-rank').textContent = t('rank.' + RANKS[game.state.rank]);
  document.getElementById('o-best').textContent = String(best.score);
  show(document.getElementById('o-record'), game.state.score >= best.score && game.state.score > 0);
}

function finish() {
  phase = 'over';
  stopMusic();
  sfx.over();
  const record = game.state.score > best.score;
  best = vault.save({ score: Math.max(best.score, game.state.score), games: best.games + 1 });
  fillOver();
  if (record) document.getElementById('o-record').hidden = false;
  show(over, true);
}

i18n.onChange(() => { if (phase === 'over') fillOver(); });

document.getElementById('btn-start').addEventListener('click', start);
document.getElementById('btn-again').addEventListener('click', start);
document.getElementById('btn-sound').addEventListener('click', (e) => {
  const on = sound.toggle();
  e.currentTarget.textContent = on ? '🔊' : '🔇';
});

// ------------------------------------------------------------------ the loop

createLoop({
  step: 1 / 120,
  update: (h) => {
    clock += h;
    if (phase !== 'playing' || !game) return;
    readKeys();
    applyTouch();
    game.update(h, input);
    input.nudgeL = input.nudgeR = input.nudgeUp = false;
  },
  draw: () => {
    vp.begin();
    if (phase === 'playing' && game) {
      renderer.draw(vp.ctx, game, vp, { now: clock });
    } else {
      renderer.draw(vp.ctx, attractGame(), vp, { now: clock, attract: true });
    }
  },
}).start();

/** The idle table behind the menu: lights chasing, ball waiting on the plunger. */
let idle = null;
function attractGame() {
  if (!idle) {
    idle = createGame({});
    idle.best = best.score;
  }
  idle.best = best.score;
  return idle;
}

document.getElementById('boot').hidden = true;
document.getElementById('btn-sound').textContent = sound.on ? '🔊' : '🔇';

// the bridge: a handle for the console while playing, and what the tests read
window.__game = {
  name: 'pinball-anarquia',
  viewport: vp,
  i18n,
  render: renderer,
  get game() { return game; },
  start,
  state: () => (game ? game.state : null),
  best: () => best,
};
