// Wiring: viewport, fixed-step loop, save, input and the two DOM cards. The
// rules live in world.js and friends, and none of them knows this file exists
// — which is what lets the tests play the game in Node.

import { createViewport } from 'slopkit/viewport';
import { createLoop } from 'slopkit/loop';
import { createSave } from 'slopkit/save';
import { bindText, mountLangPicker } from 'slopkit/langpicker';

import { H, HUD_H, STEP, TILE, W } from './config.js';
import { BUILDINGS } from './buildings.js';
import { HALL_C, HALL_R } from './map.js';
import {
  DEFAULT_ZOOM, cameraTransform, clampCamera, createCamera, minimapToBoard, toBoard, zoomAt,
} from './camera.js';
import { createWorld } from './world.js';
import { bank, freshSave, normalize } from './run.js';
import { i18n, t } from './i18n.js';
import {
  createTerrainCache, drawBanner, drawBar, drawBoard, drawConfirm, drawMinimap,
  drawQuest, drawToast, drawToolInfo, drawTopBar,
} from './render.js';
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
/** A parked building ghost waiting for its confirm button. */
let pendingBuild = null;
let confirmRects = [];
/** The squad whose flag the next ground tap moves; null = the whole army. */
let selectedSquad = null;
let hudRects = [];
let time = 0;
let saveT = 0;
let notice = null;
let noticeT = 0;
const fx = [];
/** Last time each throttled sound played — a horde biting in chorus is noise. */
const lastSfx = {};
/** Townsfolk going about their day: pure scenery, the sim never sees them. */
const villagers = [];

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
  pendingBuild = null;
  selectedSquad = null;
  fx.length = 0;
  villagers.length = 0; // the old town's people do not haunt the new one
  recenter();
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

// ------------------------------------------------------------------- camera

const cam = createCamera(HALL_C + 1, HALL_R + 1, DEFAULT_ZOOM);
const tr = () => cameraTransform(clampCamera(cam, vp.W, vp.H), vp.W, vp.H);

function recenter() {
  cam.x = HALL_C + 1;
  cam.y = HALL_R + 1;
  cam.zoom = DEFAULT_ZOOM;
}

// -------------------------------------------------------------------- input
//
// One pointer is a tap until it has travelled — then it is a pan. Two are a
// pinch. The buttons act on the way down; the board acts on the way up, so
// that dragging the camera never plants a building at the journey's start.

const pointers = new Map();
let gesture = null; // {kind:'tap'|'pan',...} · {kind:'pinch',...} · {kind:'mini'}
let miniRect = null;
const held = new Set();

const inRect = (r, p) => r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

function barPress(x, y) {
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
  pendingBuild = null;
  sfx.rally();
}

/** Build the parked ghost — the ✓ button and the Enter key both land here. */
function confirmBuild() {
  if (!pendingBuild || !tool || tool.kind !== 'shop') return;
  const why = world.place(tool.id, pendingBuild.c, pendingBuild.r);
  if (why) {
    say(t(why), '#e0563c');
    sfx.deny();
  } else {
    // the tool stays in hand: walls go up in runs, not one at a time
    pendingBuild = null;
  }
}

function tapBoard(x, y) {
  if (screen !== 'play' || !world || world.over) return;
  const p = toBoard(tr(), x, y);

  if (tool && tool.kind === 'shop') {
    // the tap only parks the ghost — building is the ✓ button's job.
    // tap-to-build planted a farm on every mis-tap.
    const spec = BUILDINGS[tool.id];
    pendingBuild = {
      c: Math.floor(p.x - spec.w / 2 + 0.5),
      r: Math.floor(p.y - spec.h / 2 + 0.5),
    };
    sfx.rally();
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

  // a tap near a guard picks their squad; a tap on open ground posts the
  // picked squad there — or the whole army, fanned out, when none is picked
  let nearest = null;
  let nearestD = 1.1;
  for (const u of world.units) {
    const d = Math.hypot(u.x - p.x, u.y - p.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = u;
    }
  }
  if (nearest) {
    selectedSquad = nearest.squad;
    say(t('note.squad', { n: nearest.squad + 1 }), '#ffd97a');
    sfx.select();
    return;
  }
  if (selectedSquad !== null && world.squads[selectedSquad]) {
    world.setRally(p.x, p.y, selectedSquad);
  } else {
    world.setRally(p.x, p.y);
    if (world.squads.length > 1) say(t('note.allSquads'), '#ffd97a');
  }
}

function jumpMini(p) {
  const b = minimapToBoard(miniRect, p.x, p.y);
  cam.x = b.x;
  cam.y = b.y;
  clampCamera(cam, vp.W, vp.H);
}

canvas.addEventListener('pointerdown', (ev) => {
  sound.resume();
  const p = vp.point(ev.clientX, ev.clientY);
  pointers.set(ev.pointerId, p);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    gesture = { kind: 'pinch', dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom: cam.zoom };
    return;
  }
  if (screen === 'play' && world && !world.over) {
    if (p.y >= vp.H - HUD_H) {
      barPress(p.x, p.y);
      gesture = null;
      return;
    }
    const btn = hit(confirmRects, p.x, p.y);
    if (btn) {
      if (btn.kind === 'confirm') confirmBuild();
      else pendingBuild = null;
      gesture = null;
      return;
    }
    if (inRect(miniRect, p)) {
      jumpMini(p);
      gesture = { kind: 'mini' };
      return;
    }
  }
  gesture = { kind: 'tap', sx: p.x, sy: p.y, camX: cam.x, camY: cam.y };
});

canvas.addEventListener('pointermove', (ev) => {
  const p = vp.point(ev.clientX, ev.clientY);
  if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, p);
  hover = screen === 'play' && p.y < vp.H - HUD_H && !inRect(miniRect, p) ? toBoard(tr(), p.x, p.y) : null;
  if (!gesture) return;

  if (gesture.kind === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const want = gesture.zoom * (dist / gesture.dist);
    zoomAt(cam, vp.W, vp.H, want / cam.zoom, (a.x + b.x) / 2, (a.y + b.y) / 2);
    return;
  }
  if (gesture.kind === 'mini' && pointers.size) {
    jumpMini(p);
    return;
  }
  if ((gesture.kind === 'tap' || gesture.kind === 'pan') && pointers.has(ev.pointerId)) {
    const dx = p.x - gesture.sx;
    const dy = p.y - gesture.sy;
    if (gesture.kind === 'tap' && Math.hypot(dx, dy) > 8) gesture.kind = 'pan';
    if (gesture.kind === 'pan') {
      cam.x = gesture.camX - dx / (cam.zoom * TILE);
      cam.y = gesture.camY - dy / (cam.zoom * TILE);
      clampCamera(cam, vp.W, vp.H);
    }
  }
});

function pointerEnd(ev) {
  const p = pointers.get(ev.pointerId);
  pointers.delete(ev.pointerId);
  if (gesture && gesture.kind === 'tap' && p) tapBoard(gesture.sx, gesture.sy);
  if (pointers.size === 0 || (gesture && gesture.kind === 'pinch' && pointers.size < 2)) gesture = null;
}
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);

canvas.addEventListener(
  'wheel',
  (ev) => {
    ev.preventDefault();
    const p = vp.point(ev.clientX, ev.clientY);
    zoomAt(cam, vp.W, vp.H, Math.exp(-ev.deltaY * 0.0014), p.x, p.y);
  },
  { passive: false }
);

window.addEventListener('keydown', (ev) => {
  held.add(ev.code);
  if (ev.code === 'Escape') {
    // one step back per press: the ghost, then the squad, then the tool
    if (pendingBuild) pendingBuild = null;
    else if (selectedSquad !== null) selectedSquad = null;
    else tool = null;
  } else if (ev.code === 'Enter') {
    confirmBuild();
  } else if (ev.code === 'KeyM') {
    sound.toggle();
    paintSoundButton();
  }
});
window.addEventListener('keyup', (ev) => held.delete(ev.code));

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

  if (world) tendVillagers(h);
  if (screen !== 'play' || !world) return;

  // the camera answers the keyboard too — and travels the same ground per
  // second whatever the zoom, which is why the speed divides by it
  const panX = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
  const panY = (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) - (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0);
  if (panX || panY) {
    const spd = (26 / cam.zoom) * h;
    cam.x += panX * spd;
    cam.y += panY * spd;
    clampCamera(cam, vp.W, vp.H);
  }

  world.tick(h);
  drain();

  saveT += h;
  if (saveT >= 5) {
    saveT = 0;
    persist();
  }
}

/**
 * The visible villagers wander between the town's buildings. They are drawn
 * from the population number but live only here — killing the scenery would
 * mean killing sim villagers one by one, and the economy counts heads, not
 * sprites. Up to a dozen on screen keeps the town alive without a crowd.
 */
function tendVillagers(h) {
  const hall = world.hall();
  const homeX = hall ? hall.c + 1 : 20;
  const homeY = hall ? hall.r + 2.6 : 12;
  const farms = world.buildings.filter((b) => b.id === 'farm' && b.built >= 1);
  const houses = world.buildings.filter((b) => b.id === 'house' && b.built >= 1);

  // people from the population number; livestock from the buildings — a farm
  // earns its sheep, a house its chickens, and the fauna makes the town a farm
  // instead of a diorama
  const want = {
    villager: Math.min(12, world.pop),
    sheep: Math.min(4, farms.length * 2),
    chicken: Math.min(4, houses.length + (farms.length ? 1 : 0)),
  };
  const counts = { villager: 0, sheep: 0, chicken: 0 };
  for (const v of villagers) counts[v.kind] = (counts[v.kind] || 0) + 1;
  for (const kind of ['villager', 'sheep', 'chicken']) {
    while (counts[kind] < want[kind]) {
      const home = kind === 'sheep'
        ? farms[counts[kind] % Math.max(1, farms.length)]
        : kind === 'chicken' && houses.length
          ? houses[counts[kind] % houses.length]
          : null;
      const hx = home ? home.c + 1 : homeX;
      const hy = home ? home.r + 1.5 : homeY;
      villagers.push({
        kind, x: hx, y: hy, tx: hx, ty: hy, hx, hy,
        seed: villagers.length * 7 + 3, wait: Math.random() * 2,
      });
      counts[kind]++;
    }
    if (counts[kind] > want[kind]) {
      let extra = counts[kind] - want[kind];
      for (let i = villagers.length - 1; i >= 0 && extra > 0; i--) {
        if (villagers[i].kind === kind) {
          villagers.splice(i, 1);
          extra--;
        }
      }
    }
  }

  for (const v of villagers) {
    const critter = v.kind !== 'villager';
    // during a horde the townsfolk run indoors; the animals, bless them, don't
    if (world.hordeIn && !critter) {
      v.tx = homeX + (v.seed % 3) - 1;
      v.ty = homeY;
    }
    const speed = critter ? 0.4 : 0.9;
    const d = Math.hypot(v.tx - v.x, v.ty - v.y);
    if (d > 0.15) {
      v.x += ((v.tx - v.x) / d) * speed * h;
      v.y += ((v.ty - v.y) / d) * speed * h;
    } else if (!world.hordeIn || critter) {
      v.wait -= h;
      if (v.wait <= 0) {
        v.wait = 1.5 + Math.random() * 3;
        if (critter) {
          // graze in a small circle around home — tight enough that a sheep
          // stays inside the pen its farm drew
          v.tx = v.hx + (Math.random() - 0.5) * 1.8;
          v.ty = v.hy + (Math.random() - 0.5) * 1.2;
        } else {
          // wander wide around a building, not straight to its doorstep —
          // at full zoom the doorstep crowd read as a scrum
          const spots = world.buildings.filter((b) => b.built >= 1);
          const b = spots[Math.floor(Math.random() * spots.length)];
          if (b) {
            v.tx = b.c - 1.5 + Math.random() * 5;
            v.ty = b.r + 0.5 + Math.random() * 3.5;
          }
        }
      }
    }
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
      case 'turned':
        fx.push({ kind: 'flash', x: ev.x, y: ev.y, t: 0.5, max: 0.5, color: '#87a468' });
        say(t('note.turned'), '#e0563c');
        sfx.turned();
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
      case 'desert':
        say(t('note.desert'), '#e0563c');
        fx.push({ kind: 'puff', x: ev.x, y: ev.y, t: 0.5, max: 0.5, color: '#5b6c9e', seed: Math.random() * 7 });
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
      case 'quest':
        say(t('q.done'), '#8fe08a');
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

  drawBoard(ctx, world, tr(), cache, {
    time, fx, tool: screen === 'play' ? tool : null, hover, villagers,
    pending: screen === 'play' ? pendingBuild : null,
    selectedSquad: screen === 'play' ? selectedSquad : null,
  });

  if (screen === 'play') {
    const status = world.hordeIn ? { text: t('hud.hordeIn'), color: '#e0563c' } : null;
    drawTopBar(ctx, vp.W, world, t, status);
    drawQuest(ctx, world, t);
    drawToast(ctx, vp.W, notice);
    if (world.warned && !world.hordeIn) drawBanner(ctx, vp.W, t('hud.horde'), time);
    miniRect = drawMinimap(ctx, world, cam, vp.W, vp.H, cache);
    // the info strip stops short of the minimap instead of running under it
    drawToolInfo(ctx, miniRect.x - 8, vp.H, t, tool);
    hudRects = drawBar(ctx, vp.W, vp.H, world, t, tool);
    confirmRects = pendingBuild && tool && tool.kind === 'shop'
      ? drawConfirm(ctx, tr(), world, tool.id, pendingBuild, t, vp.W, vp.H)
      : [];
  } else {
    miniRect = null;
    confirmRects = [];
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
  cam,
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
