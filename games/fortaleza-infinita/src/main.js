// Wiring: the viewport, the loop, the save, the two flags and the thumbs.

import { createViewport } from 'slopkit/viewport';
import { createLoop } from 'slopkit/loop';
import { createRecords } from 'slopkit/records';
import { mountLangPicker, bindText } from 'slopkit/langpicker';

import { H, RECORD } from './config.js';
import { i18n, t } from './i18n.js';
import { createRun } from './run.js';
import { createFx } from './fx.js';
import { createRenderer, clock, screenToWorld } from './render.js';
import { createTouchControls } from './controls.js';
import { createCutscene } from './cutscene.js';
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

// A ring read through a torch needs width — you have to see the corridor
// before you are in it. Upright, the kit lays the canvas on its side rather
// than asking anybody to unlock rotation (CLAUDE.md, section 2b).
const vp = createViewport(canvas, { height: H, frame: 1280, landscape: true });

// the money, the floor and the quiet floors, plus whether the short has been
// watched — the declaration is in config.js, the mechanism in slopkit/records
const records = createRecords({ ...RECORD, i18n });

const fx = createFx();
const renderer = createRenderer();
const touch = createTouchControls(() => vp.W, () => vp.H);

let run = null;
let cut = null;
let phase = 'menu';                 // intro | menu | playing | cleared | over

// ------------------------------------------------------------------- input

const keys = new Set();
const input = { mx: 0, my: 0, aim: null, aimAngle: null, fire: false, use: false, sneak: false, roll: false, autoAim: false };

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyM') sound.toggle();
  if (phase === 'intro' && cut) {
    if (e.code === 'Escape') cut.skip();
    else if (e.code === 'Enter' || e.code === 'Space') cut.click();
    return;
  }
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
canvas.addEventListener('mousedown', (e) => {
  sound.resume();
  if (phase === 'intro' && cut) {
    cut.click();
    return;
  }
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
    if (phase === 'intro' && cut) {
      cut.click();
      return;
    }
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
  // the siren runs for as long as the alarm does — and stops the moment the
  // ringing node is shot or the timer gives up, which is the game telling you
  onAlarm: () => sfx.alarmStart(),
  onAlarmSilenced: () => sfx.alarmStop(),
  onAlarmOff: () => sfx.alarmStop(),
  onDry: () => sfx.pick(),
  onRoll: () => sfx.roll(),
  onPick: (it) => {
    if (it.kind === 'loot') {
      sfx.cash();
      fx.float(it.x, it.y, `+◆${money(it.value)}`);
    } else sfx.pick();
  },
  onCleared: () => { sfx.vault(); finishFloor(); },
  onDead: () => { sfx.dead(); finishRun(); },
};

function start() {
  sound.resume();
  sfx.alarmStop();
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

/**
 * The opening short. It plays itself on the first ever boot and stays one
 * click away after that — the card that covers the canvas has to come down,
 * because the film *is* the canvas.
 */
function goToIntro() {
  sfx.alarmStop();
  cut = createCutscene(() => {
    cut = null;
    if (!records.best.intro) records.set({ intro: 1 });
    phase = 'menu';
    show(menu, true);
  }, () => sfx.pick());
  phase = 'intro';
  show(menu, false);
  show(cleared, false);
  show(over, false);
}

function nextFloor() {
  sfx.alarmStop();
  fx.clear();
  renderer.reset();
  touch.clear();
  run.advance();
  phase = 'playing';
  show(cleared, false);
}

function finishFloor() {
  // the update loop stops with the card up, so an alarm still ringing here
  // would ring under the whole card — the seal opening ends the argument
  sfx.alarmStop();
  phase = 'cleared';
  const g = run.game;
  const silent = g.stats.alarms === 0;
  document.getElementById('c-floor').textContent = String(g.level.floor);
  document.getElementById('c-money').textContent = `◆ ${money(g.stats.money)}`;
  document.getElementById('c-kills').textContent = String(g.stats.kills);
  show(document.getElementById('c-silent'), silent);
  show(cleared, true);
}

function finishRun() {
  sfx.alarmStop();
  const floors = run.totals.floors;
  const filed = records.file({ money: run.money, floor: floors, silent: run.totals.silent });
  const best = filed.best;
  phase = 'over';
  document.getElementById('o-title').textContent = t('over.title', { n: run.game.level.floor });
  document.getElementById('o-money').textContent = `◆ ${money(Math.round(run.money))}`;
  document.getElementById('o-floors').textContent = String(floors);
  document.getElementById('o-kills').textContent = String(run.totals.kills);
  document.getElementById('o-silent').textContent = String(run.totals.silent);
  document.getElementById('o-best').textContent = `◆ ${money(best.money)} · ${best.floor}`;
  document.getElementById('o-time').textContent = clock(run.totals.time);
  show(document.getElementById('o-record'), filed.record);
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
document.getElementById('btn-intro').addEventListener('click', goToIntro);
document.getElementById('btn-sound').addEventListener('click', (e) => {
  const on = sound.toggle();
  e.currentTarget.textContent = on ? '🔊' : '🔇';
});

// ------------------------------------------------------------------ the loop

createLoop({
  step: 1 / 120,
  update: (h) => {
    if (phase === 'intro' && cut) {
      cut.update(h);
      return;
    }
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
    // A trigger with no direction on it — a tap on a phone, or the fire key
    // with the mouse off the canvas — asks the game for a target instead of
    // firing wherever the body happens to face (see `nearestThreat`).
    input.autoAim = input.fire && !input.aim && typeof input.aimAngle !== 'number';
    run.update(h, input);
    fx.update(h);
  },
  draw: () => {
    vp.begin();
    const ctx = vp.ctx;
    if (phase === 'intro' && cut) {
      cut.draw(ctx, vp.W);
      return;
    }
    if (run && run.game) {
      renderer.draw(ctx, run.game, vp, { fx, touch: vp.touch && phase === 'playing' ? touch : null, dt: 1 / 60 });
    } else {
      ctx.fillStyle = '#05070b';
      ctx.fillRect(0, 0, vp.W, vp.H);
    }
  },
}).start();

document.getElementById('boot').hidden = true;
document.getElementById('btn-sound').textContent = sound.on ? '🔊' : '🔇';

// the first boot opens on the film; every boot after that opens on the menu
if (!records.best.intro) goToIntro();

// the bridge: a handle for the console while playing
window.__game = {
  name: 'fortaleza-infinita',
  viewport: vp,
  i18n,
  get run() { return run; },
  get game() { return run && run.game; },
  start,
  nextFloor,
  best: () => records.best,
  state: () => (run && run.game ? run.game.snapshot() : null),
};
