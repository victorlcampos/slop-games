// The shell: one neon sign, seven machines.
//
// The menu lists the registry, the loop routes to the selected module, and
// the save keeps one best per game id. The shell never learns the rules of
// any machine — input is one shared shape, side effects leave as events.

import { createViewport } from 'slopkit/viewport';
import { createLoop } from 'slopkit/loop';
import { mountLangPicker, bindText } from 'slopkit/langpicker';

import { H, PLAY_W } from './config.js';
import { i18n, t } from './i18n.js';
import { gameIds, loadGame } from './registry.js';
import { createVault } from './savegame.js';
import { toPlayfield } from './draw.js';
import { sound, playEvents } from './audio.js';

const canvas = document.getElementById('canvas');
const menu = document.getElementById('menu');
const over = document.getElementById('over');
const pick = document.getElementById('pick');

bindText(i18n);
mountLangPicker(i18n, { width: 30 });
const applyTitle = () => { document.title = t('page.title'); };
applyTitle();

const vp = createViewport(canvas, { height: H, minWidth: 480, maxWidth: 1400 });

const vault = createVault();
let best = vault.load();

let phase = 'menu';
let mod = null;
let modId = null;
let state = null;
let bannerText = '';
let bannerTtl = 0;
let time = 0;

// ------------------------------------------------------------------ input

const keys = new Set();
let swipe = null;
let pointerDown = false;
let pointerStart = null;
let pointerPos = null;
let firePulse = 0;

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyM') {
    const on = sound.toggle();
    document.getElementById('btn-sound').textContent = on ? '🔊' : '🔇';
  }
  if (e.code === 'Escape' && phase !== 'menu') toMenu();
  if (phase === 'over' && e.code === 'Enter' && modId) start(modId);
});

addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

function readKeys() {
  return {
    left: keys.has('ArrowLeft') || keys.has('KeyA'),
    right: keys.has('ArrowRight') || keys.has('KeyD'),
    up: keys.has('ArrowUp') || keys.has('KeyW'),
    down: keys.has('ArrowDown') || keys.has('KeyS'),
    fire: keys.has('Space') || keys.has('KeyJ') || keys.has('KeyZ'),
  };
}

/**
 * One shared input shape for seven machines. The pointer means something
 * different per cabinet: drag aims the cannon and the paddle, halves turn
 * the ship, and everywhere else a swipe steers while a tap fires.
 */
function readInput(id) {
  const k = readKeys();
  const input = { ...k, fire: k.fire || firePulse > 0, targetX: null, targetY: null, swipe };
  if (!pointerDown || !pointerPos) return input;
  const fx = toPlayfield(pointerPos.x, vp.W);
  const fy = (pointerPos.y / vp.H) * H;
  if (id === 'swarm' || id === 'blocks') {
    input.targetX = fx;
    input.fire = true;
  } else if (id === 'bounce') {
    input.targetY = fy;
  } else if (id === 'rocks') {
    // whichever half the thumb holds turns the ship; the engine burns itself
    input.left = fx < PLAY_W / 2;
    input.right = fx >= PLAY_W / 2;
    input.up = true;
    input.fire = true;
  }
  return input;
}

canvas.addEventListener('pointerdown', (e) => {
  sound.resume();
  pointerDown = true;
  const p = vp.point(e.clientX, e.clientY);
  pointerStart = { x: e.clientX, y: e.clientY, t: performance.now() };
  pointerPos = p;
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (pointerDown) pointerPos = vp.point(e.clientX, e.clientY);
});
function release(e) {
  if (!pointerDown) return;
  pointerDown = false;
  // a short stroke is a swipe to steer by; a tap is a shot
  if (pointerStart && e) {
    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    if (Math.hypot(dx, dy) > 24) {
      swipe = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down' : 'up');
    } else if (performance.now() - pointerStart.t < 300) {
      firePulse = 0.2;
    }
  }
  pointerStart = null;
  pointerPos = null;
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', () => release(null));

// ------------------------------------------------------------------ screens

function show(el, on) { el.hidden = !on; }

function renderPick() {
  pick.innerHTML = '';
  for (const id of gameIds()) {
    const b = document.createElement('button');
    b.className = 'machine';
    const name = document.createElement('b');
    name.textContent = t(`games.${id}.name`);
    const desc = document.createElement('span');
    desc.textContent = t(`games.${id}.desc`);
    const controls = document.createElement('span');
    controls.textContent = t(`games.${id}.controls`);
    const record = document.createElement('em');
    record.textContent = `${t('menu.best')}: ${best.bests[id] || 0}`;
    b.append(name, desc, controls, record);
    b.addEventListener('click', () => start(id));
    pick.appendChild(b);
  }
}

function start(id) {
  const m = loadGame(id);
  if (!m) return;
  sound.resume();
  mod = m;
  modId = id;
  state = m.create(Math.random);
  phase = 'playing';
  bannerText = '';
  bannerTtl = 0;
  swipe = null;
  show(menu, false);
  show(over, false);
}

function toMenu() {
  phase = 'menu';
  mod = null;
  modId = null;
  state = null;
  renderPick();
  show(over, false);
  show(menu, true);
}

function finish() {
  phase = 'over';
  const record = state.score > (best.bests[modId] || 0);
  best = {
    bests: { ...best.bests, [modId]: Math.max(best.bests[modId] || 0, state.score) },
    runs: best.runs + 1,
  };
  vault.save(best);
  document.getElementById('o-title').textContent = t(`games.${modId}.name`);
  document.getElementById('o-score').textContent = String(state.score);
  document.getElementById('o-best').textContent = String(best.bests[modId]);
  show(document.getElementById('o-record'), record);
  show(over, true);
}

document.getElementById('btn-again').addEventListener('click', () => modId && start(modId));
document.getElementById('btn-menu').addEventListener('click', toMenu);
document.getElementById('btn-sound').addEventListener('click', (e) => {
  const on = sound.toggle();
  e.currentTarget.textContent = on ? '🔊' : '🔇';
});

// ------------------------------------------------------------------ the loop

// behind the menu, a still swarm keeps the arcade from ever being a blank
let idle = null;
function idleSwarm() {
  if (!idle) idle = loadGame('swarm').create(() => 0.5);
  return idle;
}

renderPick();
i18n.onChange(() => {
  applyTitle();
  if (phase === 'menu') renderPick();
});

createLoop({
  step: 1 / 60,
  update: (h) => {
    time += h;
    if (firePulse > 0) firePulse -= h;
    if (bannerTtl > 0) bannerTtl -= h;
    if (phase !== 'playing' || !mod || !state) return;
    const input = readInput(modId);
    mod.update(state, h, input);
    swipe = null;
    const events = mod.drain(state);
    for (const e of events) {
      if (e.name === 'banner') {
        bannerText = e.text || '';
        bannerTtl = bannerText ? 2.2 : 0;
      }
    }
    playEvents(events);
    if (mod.isOver(state)) finish();
  },
  draw: () => {
    vp.begin();
    const ctx = vp.ctx;
    if (phase === 'playing' && mod && state) {
      mod.draw(ctx, state, {
        time, W: vp.W, best: best.bests[modId] || 0,
        banner: bannerTtl > 0 ? bannerText : '', bannerAlpha: Math.min(1, bannerTtl),
      });
    } else {
      loadGame('swarm').draw(ctx, idleSwarm(), {
        time, W: vp.W, best: 0, banner: '', bannerAlpha: 0, menu: true,
      });
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
  get game() { return state; },
  get machine() { return modId; },
  start,
  toMenu,
  state: () => state,
  best: () => best,
};
