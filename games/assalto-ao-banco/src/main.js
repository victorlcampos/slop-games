// Wiring: the viewport, the loop, the save, the two flags and the thumbs.

import { createViewport } from 'slopkit/viewport';
import { createLoop } from 'slopkit/loop';
import { createSave } from 'slopkit/save';
import { mountLangPicker, bindText } from 'slopkit/langpicker';

import { H } from './config.js';
import { i18n, t } from './i18n.js';
import { createRun } from './run.js';
import { createFx } from './fx.js';
import { createRenderer, clock, screenToWorld } from './render.js';
import { createTouchControls } from './controls.js';
import { sound, sfx } from './audio.js';

const canvas = document.getElementById('canvas');
const menu = document.getElementById('menu');
const cleared = document.getElementById('cleared');
const over = document.getElementById('over');

bindText(i18n);
mountLangPicker(i18n, { width: 30 });
const applyTitle = () => { document.title = t('page.title'); };
applyTitle();
i18n.onChange(applyTitle);

// A bank floor read through a torch needs width — you have to see the corridor
// before you are in it. Upright, the kit lays the canvas on its side rather
// than asking anybody to unlock rotation (CLAUDE.md, section 2b).
const vp = createViewport(canvas, { height: H, frame: 1280, landscape: true });

const vault = createSave({
  game: 'assalto-ao-banco',
  version: 1,
  key: 'assalto-ao-banco.best.v1',
  initial: () => ({ money: 0, floor: 0, silent: 0, runs: 0 }),
  normalize: (raw, base) => {
    if (!raw || typeof raw !== 'object') return base;
    const n = (v, d) => (Number.isFinite(v) && v >= 0 ? v : d);
    return { ...base, money: n(raw.money, 0), floor: n(raw.floor, 0), silent: n(raw.silent, 0), runs: n(raw.runs, 0) };
  },
});
let best = vault.load();

const fx = createFx();
const renderer = createRenderer();
const touch = createTouchControls(() => vp.W, () => vp.H);

let run = null;
let phase = 'menu';                 // menu | playing | cleared | over

// ------------------------------------------------------------------- input

const keys = new Set();
const input = { mx: 0, my: 0, aim: null, aimAngle: null, fire: false, use: false, sneak: false, roll: false };

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyM') sound.toggle();
  if (phase === 'menu' && (e.code === 'Enter' || e.code === 'Space')) start();
  if (phase === 'cleared' && (e.code === 'Enter' || e.code === 'Space')) nextFloor();
  if (phase === 'over' && e.code === 'Enter') start();
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
  input.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
  input.fire = mouseDown || keys.has('KeyJ');
  input.use = keys.has('KeyE') || keys.has('KeyF');
  input.roll = keys.has('Space');
  // cleared every frame: a stale angle from a thumb that has already left the
  // screen would keep him facing a wall for the rest of the floor
  input.aimAngle = null;
}

let mouseDown = false;
let mouse = null;
canvas.addEventListener('mousedown', (e) => { mouseDown = true; mouse = vp.point(e.clientX, e.clientY); sound.resume(); });
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

/**
 * A point on the screen, in the world the renderer is drawing.
 *
 * Computed from where he is *now*, not from the camera the last frame was drawn
 * with. Reading the renderer's copy costs one frame of lag, which is small — and
 * is the same lag, in the same direction, that made aiming while running feel
 * like dragging the cursor along behind him.
 */
const toWorld = (p) => {
  if (!p || !run || !run.game) return null;
  const pl = run.game.player;
  return screenToWorld(p.x, p.y, pl.x, pl.y, vp.W, vp.H);
};

// ------------------------------------------------------------------ screens

const show = (el, on) => { el.hidden = !on; };
const money = (n) => n.toLocaleString(i18n.lang === 'pt' ? 'pt-BR' : 'en-US');

const hooks = {
  onShot: (w) => sfx.shot(w.id),
  onHurt: () => sfx.hurt(),
  onKill: () => sfx.kill(),
  onBreak: () => sfx.break(),
  onAlarm: () => sfx.alarm(),
  onDry: () => sfx.pick(),
  onRoll: () => sfx.roll(),
  onPick: (it) => {
    if (it.kind === 'loot') {
      sfx.cash();
      fx.float(it.x, it.y, `+$${money(it.value)}`);
    } else sfx.pick();
  },
  onCleared: () => { sfx.vault(); finishFloor(); },
  onDead: () => { sfx.dead(); finishRun(); },
};

function start() {
  sound.resume();
  fx.clear();
  renderer.reset();
  touch.clear();
  run = createRun({ seed: (Date.now() & 0x7fffffff) || 1, fx, hooks });
  run.start();
  phase = 'playing';
  show(menu, false);
  show(cleared, false);
  show(over, false);
}

function nextFloor() {
  fx.clear();
  renderer.reset();
  touch.clear();
  run.advance();
  phase = 'playing';
  show(cleared, false);
}

function finishFloor() {
  phase = 'cleared';
  const g = run.game;
  const silent = g.stats.alarms === 0;
  document.getElementById('c-floor').textContent = String(g.level.floor);
  document.getElementById('c-money').textContent = `$ ${money(g.stats.money)}`;
  document.getElementById('c-kills').textContent = String(g.stats.kills);
  show(document.getElementById('c-silent'), silent);
  show(cleared, true);
}

function finishRun() {
  const floors = run.totals.floors;
  const record = run.money > best.money || floors > best.floor;
  // `save` reports whether it managed to write, it does not hand the state
  // back. Assigning its answer to `best` made `best` the boolean `true`, and
  // the first `best.money.toLocaleString()` below threw — with `phase` already
  // set to 'over', so the loop had stopped simulating and the card was never
  // shown. The whole screen froze on the frame he died in.
  const next = {
    money: Math.max(best.money, Math.round(run.money)),
    floor: Math.max(best.floor, floors),
    silent: Math.max(best.silent, run.totals.silent),
    runs: best.runs + 1,
  };
  vault.save(next);
  best = next;
  phase = 'over';
  document.getElementById('o-title').textContent = t('over.title', { n: run.game.level.floor });
  document.getElementById('o-money').textContent = `$ ${money(Math.round(run.money))}`;
  document.getElementById('o-floors').textContent = String(floors);
  document.getElementById('o-kills').textContent = String(run.totals.kills);
  document.getElementById('o-silent').textContent = String(run.totals.silent);
  document.getElementById('o-best').textContent = `$ ${money(best.money)} · ${best.floor}`;
  document.getElementById('o-time').textContent = clock(run.totals.time);
  show(document.getElementById('o-record'), record);
  show(over, true);
}

// The title on the game-over card is assembled at runtime, so it has to be
// rewritten when the flag changes — bindText only reaches the markup.
i18n.onChange(() => {
  if (phase === 'over' && run) {
    document.getElementById('o-title').textContent = t('over.title', { n: run.game.level.floor });
  }
});

document.getElementById('btn-start').addEventListener('click', start);
document.getElementById('btn-next').addEventListener('click', nextFloor);
document.getElementById('btn-again').addEventListener('click', start);
document.getElementById('btn-sound').addEventListener('click', (e) => {
  const on = sound.toggle();
  e.currentTarget.textContent = on ? '🔊' : '🔇';
});

// ------------------------------------------------------------------ the loop

createLoop({
  step: 1 / 120,
  update: (h) => {
    if (phase !== 'playing' || !run) return;
    readKeys();
    input.aim = toWorld(mouse);
    if (vp.touch) {
      touch.offerUse(!!(run.game && run.game.prompt));
      const asked = touch.read();
      if (asked.mx || asked.my) {
        input.mx = asked.mx;
        input.my = asked.my;
        input.sneak = asked.sneak;
      }
      if (asked.aimAngle !== null) {
        input.aimAngle = asked.aimAngle;
        input.aim = null;
      }
      input.fire = input.fire || asked.fire;
      input.use = input.use || asked.use;
      input.roll = input.roll || asked.roll;
    }
    run.update(h, input);
    fx.update(h);
  },
  draw: () => {
    vp.begin();
    const ctx = vp.ctx;
    if (run && run.game) {
      renderer.draw(ctx, run.game, vp, { fx, touch: vp.touch && phase === 'playing' ? touch : null, dt: 1 / 60 });
    } else {
      ctx.fillStyle = '#07080c';
      ctx.fillRect(0, 0, vp.W, vp.H);
    }
  },
}).start();

document.getElementById('boot').hidden = true;
document.getElementById('btn-sound').textContent = sound.on ? '🔊' : '🔇';

// the bridge: a handle for the console while playing
window.__game = {
  name: 'assalto-ao-banco',
  viewport: vp,
  i18n,
  get run() { return run; },
  get game() { return run && run.game; },
  start,
  nextFloor,
  best: () => best,
  state: () => (run && run.game ? run.game.snapshot() : null),
};
