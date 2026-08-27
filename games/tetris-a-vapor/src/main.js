import { createViewport } from 'slopkit/viewport';
import { createLoop } from 'slopkit/loop';
import { createSave } from 'slopkit/save';
import { bindText, mountLangPicker } from 'slopkit/langpicker';

import { H } from './config.js';
import { createGame } from './game.js';
import { createFx } from './fx.js';
import { i18n, t } from './i18n.js';
import { drawGame } from './render.js';
import { music, sfx, sound } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const menu = $('menu');
const over = $('over');
const touchbar = $('touchbar');
const pauseButton = $('pause');
const soundButton = $('sound');

bindText(i18n);
mountLangPicker(i18n, { width: 29 });

const vp = createViewport(canvas, { height: H, minWidth: 430, maxWidth: 1600, frame: 1000 });
const fx = createFx();

const vault = createSave({
  game: 'tetris-a-vapor',
  version: 1,
  i18n,
  initial: () => ({ score: 0, lines: 0, level: 1, runs: 0 }),
  normalize: (raw, base) => {
    if (!raw || typeof raw !== 'object') return base;
    const whole = (value, fallback = 0) => Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
    return {
      ...base,
      score: whole(raw.score),
      lines: whole(raw.lines),
      level: Math.max(1, whole(raw.level, 1)),
      runs: whole(raw.runs),
    };
  },
});

let best = vault.load();
let game = null;
let overTimer = null;

function show(element, visible) {
  element.hidden = !visible;
}

function updateTitle() {
  document.title = t('page.title');
  const hasRun = best.runs > 0 || best.score > 0;
  $('best').textContent = hasRun
    ? t('menu.runRecord', { score: best.score.toLocaleString(i18n.lang === 'pt' ? 'pt-BR' : 'en-US'), lines: best.lines })
    : t('menu.noRun');
  soundButton.title = t(sound.on ? 'sound.on' : 'sound.off');
}

function updateSoundButton() {
  soundButton.textContent = sound.on ? '🎸' : '🔇';
  soundButton.title = t(sound.on ? 'sound.on' : 'sound.off');
}

function onGameEvent(event) {
  fx.handle(event);
  if (event.type === 'move') sfx.move();
  if (event.type === 'rotate') sfx.rotate();
  if (event.type === 'hold') sfx.hold();
  if (event.type === 'drop') sfx.drop(event.distance);
  if (event.type === 'lock') sfx.lock();
  if (event.type === 'clear') sfx.clear(event.count);
  if (event.type === 'level') sfx.level();
  if (event.type === 'over') finish(event);
}

function start() {
  if (overTimer) clearTimeout(overTimer);
  overTimer = null;
  sound.resume();
  fx.clear();
  game = createGame({ seed: (Date.now() & 0x7fffffff) || 1, onEvent: onGameEvent });
  show(menu, false);
  show(over, false);
  show(touchbar, true);
  show(pauseButton, true);
  pauseButton.textContent = 'Ⅱ';
  music.start();
}

function finish(result) {
  sfx.over();
  show(touchbar, false);
  show(pauseButton, false);
  const record = result.score > best.score;
  if (record || result.lines > best.lines || result.level > best.level) {
    best = {
      ...best,
      score: Math.max(best.score, result.score),
      lines: Math.max(best.lines, result.lines),
      level: Math.max(best.level, result.level),
      runs: best.runs + 1,
    };
  } else {
    best = { ...best, runs: best.runs + 1 };
  }
  vault.save(best);
  $('over-score').textContent = result.score.toLocaleString(i18n.lang === 'pt' ? 'pt-BR' : 'en-US');
  $('over-lines').textContent = String(result.lines);
  $('over-level').textContent = String(result.level);
  show($('new-record'), record);
  updateTitle();
  // Let the final boiler blast be visible before the score plate closes over it.
  overTimer = setTimeout(() => {
    if (game && game.phase === 'over') show(over, true);
    overTimer = null;
  }, 520);
}

function home() {
  if (overTimer) clearTimeout(overTimer);
  overTimer = null;
  music.stop();
  game = null;
  fx.clear();
  show(over, false);
  show(menu, true);
  show(touchbar, false);
  show(pauseButton, false);
  updateTitle();
}

function togglePause(force = null) {
  if (!game || game.phase === 'over') return;
  const paused = game.togglePause(force);
  pauseButton.textContent = paused ? '▶' : 'Ⅱ';
  if (paused) music.stop(); else music.start();
}

function action(name) {
  if (!game || game.phase !== 'playing') return false;
  if (name === 'left') return game.move(-1);
  if (name === 'right') return game.move(1);
  if (name === 'down') return game.stepDown(true);
  if (name === 'rotate') return game.rotate(1);
  if (name === 'rotate-left') return game.rotate(-1);
  if (name === 'drop') return game.hardDrop();
  if (name === 'hold') return game.hold();
  return false;
}

addEventListener('keydown', (event) => {
  const code = event.code;
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'].includes(code)) event.preventDefault();

  if (code === 'KeyM') {
    sound.toggle();
    updateSoundButton();
    if (sound.on && game && game.phase === 'playing') music.start();
    return;
  }
  if (!menu.hidden && (code === 'Enter' || code === 'Space')) {
    start();
    return;
  }
  if (!over.hidden && code === 'Enter') {
    start();
    return;
  }
  if ((code === 'KeyP' || code === 'Escape') && game && game.phase !== 'over') {
    if (!event.repeat) togglePause();
    return;
  }
  if (!game || game.phase !== 'playing') return;

  sound.resume();
  if (code === 'ArrowLeft' || code === 'KeyA') action('left');
  if (code === 'ArrowRight' || code === 'KeyD') action('right');
  if (code === 'ArrowDown' || code === 'KeyS') {
    game.setSoftDrop(true);
    action('down');
  }
  if ((code === 'ArrowUp' || code === 'KeyX' || code === 'KeyW') && !event.repeat) action('rotate');
  if (code === 'KeyZ' && !event.repeat) action('rotate-left');
  if (code === 'Space' && !event.repeat) action('drop');
  if ((code === 'KeyC' || code === 'ShiftLeft' || code === 'ShiftRight') && !event.repeat) action('hold');
});

addEventListener('keyup', (event) => {
  if (game && (event.code === 'ArrowDown' || event.code === 'KeyS')) game.setSoftDrop(false);
});

addEventListener('blur', () => {
  if (game && game.phase === 'playing') togglePause(true);
});

// The three movement valves repeat while held. Rotation, hold and hard drop are
// single mechanical actions, so keeping a thumb down cannot spend the next piece.
const repeats = new Map();
function stopRepeat(pointerId) {
  const timers = repeats.get(pointerId);
  if (!timers) return;
  clearTimeout(timers.delay);
  clearInterval(timers.interval);
  if (game && timers.action === 'down') game.setSoftDrop(false);
  timers.button.classList.remove('pressed');
  repeats.delete(pointerId);
}

for (const button of touchbar.querySelectorAll('[data-action]')) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    sound.resume();
    button.setPointerCapture?.(event.pointerId);
    const name = button.dataset.action;
    button.classList.add('pressed');
    if (name === 'down' && game) game.setSoftDrop(true);
    action(name);
    if (name === 'left' || name === 'right' || name === 'down') {
      const timers = { action: name, button, delay: null, interval: null };
      timers.delay = setTimeout(() => {
        timers.interval = setInterval(() => action(name), name === 'down' ? 45 : 72);
      }, 165);
      repeats.set(event.pointerId, timers);
    }
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, (event) => {
      stopRepeat(event.pointerId);
      button.classList.remove('pressed');
    });
  }
}

$('start').addEventListener('click', start);
$('again').addEventListener('click', start);
$('home').addEventListener('click', home);
pauseButton.addEventListener('click', () => togglePause());
soundButton.addEventListener('click', () => {
  sound.toggle();
  updateSoundButton();
  if (sound.on && game && game.phase === 'playing') music.start();
});

i18n.onChange(() => {
  updateTitle();
  if (!over.hidden && game) {
    $('over-score').textContent = game.score.toLocaleString(i18n.lang === 'pt' ? 'pt-BR' : 'en-US');
  }
});

createLoop({
  step: 1 / 60,
  update: (h) => {
    if (game) game.tick(h);
    fx.update(h);
  },
  draw: () => {
    music.update();
    vp.begin();
    drawGame(vp.ctx, game, vp.W, fx, performance.now() / 1000);
  },
}).start();

updateTitle();
updateSoundButton();

window.__game = {
  name: 'tetris-a-vapor',
  viewport: vp,
  i18n,
  start,
  home,
  get game() { return game; },
  get best() { return best; },
  action,
};
