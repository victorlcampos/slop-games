// Wiring: viewport, fixed-step loop, save, input and the two DOM cards. The
// rules live in world.js and friends, and none of them knows this file exists
// — which is what lets the tests play the game in Node.

import { createViewport } from 'slopkit/viewport';
import { createLoop } from 'slopkit/loop';
import { createSave } from 'slopkit/save';
import { bindText, mountLangPicker } from 'slopkit/langpicker';

import { H, HUD_H, STEP, W } from './config.js';
import { BUILDINGS } from './buildings.js';
import { createWorld } from './world.js';
import { bank, freshSave, normalize } from './run.js';
import { i18n, t } from './i18n.js';
import { boardTransform, createTerrainCache, drawBanner, drawBar, drawBoard, drawTopBar, toBoard } from './render.js';
import { hit } from './ui.js';
import { sfx, sound } from './audio.js';

const canvas = document.getElementById('canvas');
const menuCard = document.getElementById('menu');
const overCard = document.getElementById('over');

bindText(i18n);
mountLangPicker(i18n, { width: 30 });
const applyTitle = () => {
  document.title = t('page.title');
};
applyTitle();
i18n.onChange(applyTitle);

const vp = createViewport(canvas, { height: H, frame: W, landscape: true });
const vault = createSave({ game: 'ultima-colheita', version: 1, initial: freshSave, normalize, i18n });
let save = vault.load();

const cache = createTerrainCache();
let world = null;
let screen = 'menu'; // menu · play · over
let tool = null;
let hover = null;
let hudRects = [];
let time = 0;
let saveT = 0;
let notice = null;
let noticeT = 0;
const fx = [];
/** Last time each throttled sound played — a horde biting in chorus is noise. */
const lastSfx = {};

function setScreen(next) {
  screen = next;
  menuCard.hidden = next !== 'menu';
  overCard.hidden = next !== 'over';
}

function say(text, color) {
  notice = { text, color };
  noticeT = 3;
}

// ------------------------------------------------------------------ the run

function startRun(fresh) {
  if (fresh || !save.state) {
    save = vault.apply({ ...save, seed: 1 + Math.floor(Math.random() * 999999), state: null });
    world = createWorld({ seed: save.seed });
  } else {
    world = createWorld({ seed: save.seed, state: save.state });
  }
  tool = null;
  fx.length = 0;
  persist();
  setScreen('play');
}

function persist() {
  if (!world || world.over) return;
  save.state = world.serialize();
  vault.save(save);
}

function finishRun() {
  bank(save, world);
  const record = world.stats.years > 0 && world.stats.years >= save.best.years;
  save.state = null;
  vault.save(save);

  document.getElementById('o-years').textContent = t('over.years', { n: world.stats.years });
  document.getElementById('o-kills').textContent = t('over.kills', { n: world.stats.kills });
  document.getElementById('o-record').textContent = record ? t('over.record') : '';
  setScreen('over');
}

/** The menu is not a blank screen: behind it sits the valley you would found. */
function showcase() {
  if (!world || world.over) world = createWorld({ seed: save.seed });
}

// -------------------------------------------------------------------- input

const tr = () => boardTransform(vp.W, vp.H);

function onBoard(x, y) {
  return y < vp.H - HUD_H;
}

function pressAt(x, y) {
  if (screen !== 'play' || !world || world.over) return;

  if (!onBoard(x, y)) {
    const r = hit(hudRects, x, y);
    if (!r) return;
    if (r.kind === 'train') {
      const why = world.train(r.id);
      if (why) {
        say(t(why), '#e0563c');
        sfx.deny();
      } else {
        sfx.place();
      }
      return;
    }
    // shop and tools toggle: tap again to put the tool down
    tool = tool && tool.kind === r.kind && tool.id === r.id ? null : { kind: r.kind, id: r.id };
    sfx.rally();
    return;
  }

  const p = toBoard(tr(), x, y);
  if (tool && tool.kind === 'shop') {
    const spec = BUILDINGS[tool.id];
    const c = Math.floor(p.x - spec.w / 2 + 0.5);
    const r = Math.floor(p.y - spec.h / 2 + 0.5);
    const why = world.place(tool.id, c, r);
    if (why) {
      say(t(why), '#e0563c');
      sfx.deny();
    }
    return;
  }
  if (tool && tool.id === 'demolish') {
    const why = world.demolish(Math.floor(p.x), Math.floor(p.y));
    if (why) {
      say(t(why), '#e0563c');
      sfx.deny();
    }
    return;
  }
  // no tool (or the flag): a tap on the ground is "stand here" — the army is
  // the thing you point, everything else runs itself
  world.setRally(p.x, p.y);
}

canvas.addEventListener('pointerdown', (ev) => {
  sound.resume();
  const p = vp.point(ev.clientX, ev.clientY);
  pressAt(p.x, p.y);
});

canvas.addEventListener('pointermove', (ev) => {
  const p = vp.point(ev.clientX, ev.clientY);
  hover = onBoard(p.x, p.y) ? toBoard(tr(), p.x, p.y) : null;
});

window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Escape') {
    tool = null;
  } else if (ev.code === 'KeyM') {
    sound.toggle();
    paintSoundButton();
  }
});

// ------------------------------------------------------------------ the loop

function update(h) {
  time += h;
  document.body.classList.toggle('turned', !!vp.turned);
  noticeT = Math.max(0, noticeT - h);
  if (noticeT === 0) notice = null;
  for (let i = fx.length - 1; i >= 0; i--) {
    fx[i].t -= h;
    if (fx[i].t <= 0) fx.splice(i, 1);
  }

  if (screen !== 'play' || !world) return;
  world.tick(h);
  drain();

  saveT += h;
  if (saveT >= 5) {
    saveT = 0;
    persist();
  }
}

function throttled(name, fn, every = 0.09) {
  if (time - (lastSfx[name] || -9) < every) return;
  lastSfx[name] = time;
  fn();
}

/** Turn what the world said into noise, sparks and one-line news. */
function drain() {
  for (const ev of world.events) {
    switch (ev.kind) {
      case 'place':
        sfx.place();
        break;
      case 'demolish':
        sfx.demolish();
        fx.push({ kind: 'puff', x: ev.x, y: ev.y, t: 0.4, max: 0.4, color: '#c8a34e', seed: Math.random() * 7 });
        break;
      case 'rally':
        throttled('rally', sfx.rally, 0.2);
        break;
      case 'arrow':
        fx.push({ kind: 'arrow', x: ev.x, y: ev.y, tx: ev.tx, ty: ev.ty, t: 0.16, max: 0.16 });
        throttled('arrow', sfx.arrow);
        break;
      case 'clash':
        throttled('clash', sfx.clash);
        break;
      case 'bite':
        fx.push({ kind: 'flash', x: ev.x, y: ev.y, t: 0.2, max: 0.2, color: '#e0563c' });
        throttled('bite', sfx.bite, 0.25);
        break;
      case 'die':
        fx.push({ kind: 'puff', x: ev.x, y: ev.y, t: 0.45, max: 0.45, color: '#6f8f52', seed: Math.random() * 7 });
        throttled('die', sfx.die, 0.12);
        break;
      case 'unitdie':
        fx.push({ kind: 'puff', x: ev.x, y: ev.y, t: 0.5, max: 0.5, color: '#5b6c9e', seed: Math.random() * 7 });
        sfx.unitdie();
        break;
      case 'collapse':
        fx.push({ kind: 'puff', x: ev.x, y: ev.y, t: 0.5, max: 0.5, color: '#8d9097', seed: Math.random() * 7 });
        sfx.demolish();
        break;
      case 'born':
        sfx.born();
        break;
      case 'starve':
        say(t('note.starve'), '#e0563c');
        sfx.starve();
        break;
      case 'trained':
        say(t('note.trained', { name: t(`u.${ev.unit}`) }));
        sfx.trained();
        break;
      case 'horn':
        sfx.horn();
        break;
      case 'horde':
        say(t('note.horde', { n: ev.n }), '#e0563c');
        break;
      case 'newyear':
        say(t('note.newyear', { n: ev.year }));
        sfx.bell();
        persist();
        break;
      case 'cleared':
        say(t('hud.cleared'), '#7fce6a');
        sfx.cleared();
        persist();
        break;
      case 'over':
        sfx.over();
        finishRun();
        break;
      default:
        break;
    }
  }
  world.events.length = 0;
}

function draw() {
  vp.begin();
  const ctx = vp.ctx;
  if (!world) return;

  drawBoard(ctx, world, tr(), cache, { time, fx, tool: screen === 'play' ? tool : null, hover });

  if (screen === 'play') {
    const info = world.hordeIn
      ? { text: t('hud.hordeIn'), color: '#e0563c' }
      : notice;
    drawTopBar(ctx, vp.W, world, t, info);
    if (world.warned && !world.hordeIn) drawBanner(ctx, vp.W, t('hud.horde'), time);
    hudRects = drawBar(ctx, vp.W, vp.H, world, t, tool);
  } else {
    hudRects = [];
    // behind a card the valley dims — the card is the screen, the town is set
    ctx.fillStyle = 'rgba(12,14,10,0.5)';
    ctx.fillRect(0, 0, vp.W, vp.H);
  }
}

// ----------------------------------------------------------------- the menu

document.getElementById('btn-start').addEventListener('click', () => {
  sound.resume();
  startRun(true);
});
document.getElementById('btn-resume').addEventListener('click', () => {
  sound.resume();
  startRun(false);
});
document.getElementById('btn-reset').addEventListener('click', () => {
  save = vault.apply({ ...freshSave(), best: save.best });
  vault.save(save);
  world = null;
  showcase();
  refreshMenu();
  flashMenu(t('menu.wiped'));
});
document.getElementById('btn-again').addEventListener('click', () => {
  sound.resume();
  startRun(true);
});
for (const el of document.querySelectorAll('[data-menu]')) {
  el.addEventListener('click', () => {
    world = null;
    showcase();
    refreshMenu();
    setScreen('menu');
  });
}

let menuNoteT = null;
function flashMenu(text) {
  const el = document.getElementById('m-progress');
  el.textContent = text;
  clearTimeout(menuNoteT);
  menuNoteT = setTimeout(refreshMenu, 2400);
}

function refreshMenu() {
  const has = !!save.state;
  document.getElementById('btn-resume').hidden = !has;
  document.getElementById('btn-reset').hidden = !has;
  const lines = [];
  if (has) lines.push(t('menu.now', { year: save.state.year, pop: save.state.pop }));
  if (save.best.years > 0) lines.push(t('menu.best', { years: save.best.years, kills: save.best.kills }));
  document.getElementById('m-progress').textContent = lines.join(' · ');
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

// a handle for the browser console, which is where the last rounds of bugs in
// this repo were actually found
window.__game = {
  name: 'ultima-colheita',
  viewport: vp,
  i18n,
  get world() {
    return world;
  },
  get save() {
    return save;
  },
  get tool() {
    return tool;
  },
};
