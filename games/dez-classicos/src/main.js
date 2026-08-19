// Wiring: the viewport, the loop, the save, the two flags, and the three
// screens — the cabinet, the difficulty sheet, and the table itself.
//
// The canvas is never hidden. It paints the felt table on every screen and the
// board only when there is a match on it, so the menu sits on the same table
// the game is played on rather than on a different-coloured page.

import { createViewport } from 'slopkit/viewport';
import { createLoop } from 'slopkit/loop';
import { createSave } from 'slopkit/save';
import { mountLangPicker, bindText } from 'slopkit/langpicker';

import { i18n, t } from './i18n.js';
import { GAMES, byId } from './registry.js';
import { createMatch, resume } from './match.js';
import { LEVELS } from './engine/ai.js';
import { drawTable } from './views/board.js';
import { chessPiece } from './render/pieces.js';
import { PALETTES } from './theme.js';
import { sound, sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const screens = { lobby: $('lobby'), setup: $('setup'), table: $('table') };

bindText(i18n);
mountLangPicker(i18n, { width: 28 });
const applyTitle = () => { document.title = t('page.title'); };
applyTitle();

// Boards are square and a phone is not, so the logical width has to be allowed
// to go narrow: with the kit's default floor of 1040 an upright phone would be
// told it has 1040 units of width and draw two thirds of the board off screen.
const vp = createViewport(canvas, { height: 720, minWidth: 320, maxWidth: 2400, frame: 1280 });

const vault = createSave({
  game: 'dez-classicos',
  version: 1,
  i18n,
  initial: () => ({ record: {}, best: {}, level: {}, side: {}, resume: null }),
  normalize: (raw, base) => {
    if (!raw || typeof raw !== 'object') return base;
    const object = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const record = {};
    for (const [key, value] of Object.entries(object(raw.record))) {
      const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
      record[key] = { won: n(value && value.won), lost: n(value && value.lost), drew: n(value && value.drew) };
    }
    const level = {};
    for (const [key, value] of Object.entries(object(raw.level))) {
      if (LEVELS.includes(value)) level[key] = value;
    }
    return {
      ...base,
      record,
      level,
      best: object(raw.best),
      side: object(raw.side),
      // a half-written match is dropped rather than repaired: `resume()` in
      // match.js proves it by asking the rules to read it
      resume: raw.resume && typeof raw.resume === 'object' ? raw.resume : null,
    };
  },
});

let save = vault.load();
let match = null;
let chosen = { id: null, level: 'normal', side: 0 };
let screen = 'lobby';

// --------------------------------------------------------------------- lobby

/**
 * The cabinet. Every card carries a board drawn by the game itself — the same
 * code that draws it at full size, at 168 pixels. It is why the thumbnails
 * never go stale when a board is restyled, and why there is no image folder.
 */
function buildLobby() {
  const host = $('cards');
  host.textContent = '';
  for (const def of GAMES) {
    const card = document.createElement('button');
    card.className = 'card';
    card.type = 'button';

    const thumb = document.createElement('canvas');
    const size = 168;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    thumb.width = size * dpr;
    thumb.height = size * dpr;
    const tctx = thumb.getContext('2d');
    tctx.scale(dpr, dpr);
    def.view().thumb(tctx, size, size);

    const title = document.createElement('h2');
    title.innerHTML = `<span>${def.emoji}</span>`;
    const name = document.createElement('span');
    name.dataset.t = 'game.' + def.id;
    title.appendChild(name);

    const record = document.createElement('div');
    record.className = 'record';
    record.dataset.game = def.id;

    card.append(thumb, title, record);
    card.addEventListener('click', () => openSetup(def.id));
    host.appendChild(card);
  }
  refreshRecords();
  bindText(i18n, host);
}

/** The line under each card: how the player has done, or where they left off. */
function refreshRecords() {
  for (const el of document.querySelectorAll('.record[data-game]')) {
    const id = el.dataset.game;
    const def = byId(id);
    const level = save.level[id] || 'normal';
    const key = id + ':' + level;
    const r = save.record[key];
    const parts = [];
    if (save.resume && save.resume.id === id) {
      parts.push(`<span class="resume">${t('ui.resume')}</span>`);
    }
    if (def.solo) {
      const best = save.best[key];
      parts.push(best ? t('ui.bestTime', { time: clock(best) }) : t('ui.neverPlayed'));
    } else if (r && r.won + r.lost + r.drew > 0) {
      parts.push(t('ui.record', r));
    } else {
      parts.push(t('ui.neverPlayed'));
    }
    el.innerHTML = parts.join(' · ');
  }
}

const clock = (seconds) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// --------------------------------------------------------------------- setup

function openSetup(id) {
  const def = byId(id);
  chosen = { id, level: save.level[id] || 'normal', side: save.side[id] ?? 0 };
  $('setup-emoji').textContent = def.emoji;
  $('setup-name').dataset.t = 'game.' + id;
  $('setup-about').dataset.t = 'game.' + id + '.about';

  const levels = $('levels');
  levels.textContent = '';
  for (const level of LEVELS) {
    const button = document.createElement('button');
    button.className = 'level';
    button.type = 'button';
    button.dataset.level = level;
    const name = document.createElement('b');
    name.dataset.t = 'level.' + level;
    const what = document.createElement('span');
    // sudoku has no opponent, so the level means something different there and
    // says so in its own words rather than borrowing the machine's
    what.dataset.t = def.solo ? 'level.sudoku.' + level : def.seats === 4 && level === 'easy' ? 'level.ludo.what' : 'level.' + level + '.what';
    button.append(name, what);
    button.addEventListener('click', () => {
      chosen.level = level;
      paintSetup();
      sfx.place();
    });
    levels.appendChild(button);
  }

  const sideRow = $('side-row');
  sideRow.hidden = !def.sides || def.sides.length < 2;
  if (!sideRow.hidden) {
    const sides = $('sides');
    sides.textContent = '';
    def.sides.forEach((phrase, index) => {
      const button = document.createElement('button');
      button.className = 'side';
      button.type = 'button';
      button.dataset.side = String(index);
      button.dataset.t = phrase;
      button.addEventListener('click', () => {
        chosen.side = index;
        paintSetup();
        sfx.place();
      });
      sides.appendChild(button);
    });
  }

  paintSetup();
  bindText(i18n, $('setup'));
  show('setup');
}

function paintSetup() {
  for (const button of document.querySelectorAll('#levels .level')) {
    button.setAttribute('aria-pressed', String(button.dataset.level === chosen.level));
  }
  for (const button of document.querySelectorAll('#sides .side')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.side) === chosen.side));
  }
}

// --------------------------------------------------------------------- table

function startMatch(snapshot = null) {
  const def = byId(chosen.id);
  $('boot').hidden = false;
  $('boot').textContent = t('ui.building');

  // Sudoku's professional grid takes a fifth of a second to carve, and a frame
  // has to reach the screen before it: without the wait, the "laying out" line
  // is written and painted after the work it was there to cover.
  afterPaint(() => {
    match = snapshot ? resume(def, snapshot, onMatchChange) : null;
    if (!match) {
      match = createMatch(def, { level: chosen.level, side: chosen.side, onChange: onMatchChange });
    }
    chosen.level = match.level;
    chosen.side = match.side;
    save.level[def.id] = match.level;
    save.side[def.id] = match.side;
    vault.save(save);

    $('table-emoji').textContent = def.emoji;
    $('table-name').dataset.t = 'game.' + def.id;
    $('table-level').dataset.t = 'level.' + match.level;
    $('btn-hint').hidden = !def.rules.hint;
    bindText(i18n, $('table'));
    $('boot').hidden = true;
    show('table');
    onMatchChange();
  });
}

/**
 * Run something after the browser has had a chance to paint.
 *
 * `requestAnimationFrame` is the right instrument and it is not enough on its
 * own: **a background tab gets no frames**. Start a match, switch tabs while
 * the grid is being carved, and the callback never runs — you come back to a
 * loading line that will sit there for ever. So the timer races the frame and
 * whichever arrives first wins, which is also what makes this testable in a
 * headless browser, where frames are minutes apart.
 */
function afterPaint(fn) {
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    fn();
  };
  requestAnimationFrame(() => setTimeout(once, 0));
  setTimeout(once, 120);
}

function onMatchChange() {
  if (!match) return;
  const status = $('status');
  status.textContent = match.status();
  status.className = 'status' + (match.result ? (isWin() ? ' good' : match.result.winner === null ? '' : ' bad') : '');
  $('btn-undo').disabled = !match.history.length || !!match.anim;

  if (match.pending) showPromotion();
  if (match.result && $('over').hidden) recordResult();
  saveResume();
}

const isWin = () => match && match.result && (byId(chosen.id).solo || match.result.winner === match.side);

/** The running score, and the board left where the player left it. */
function saveResume() {
  if (!match) return;
  save.resume = match.result ? null : match.snapshot();
  vault.save(save);
}

function recordResult() {
  const def = byId(chosen.id);
  const key = def.id + ':' + match.level;
  const r = save.record[key] || { won: 0, lost: 0, drew: 0 };
  if (def.solo) {
    r.won++;
    const seconds = match.elapsed;
    if (!save.best[key] || seconds < save.best[key]) save.best[key] = seconds;
  } else if (match.result.winner === null || match.result.winner === undefined) r.drew++;
  else if (match.result.winner === match.side) r.won++;
  else r.lost++;
  save.record[key] = r;
  save.resume = null;
  vault.save(save);
  showOver();
}

// -------------------------------------------------------------------- modals

function showOver() {
  const def = byId(chosen.id);
  const over = match.result;
  $('over-title').textContent = def.solo
    ? t('match.solved')
    : over.winner === null || over.winner === undefined
      ? t('match.drew')
      : over.winner === match.side ? t('match.won') : t('match.lost');
  $('over-why').textContent = over.reason ? t('end.' + over.reason) : '';

  const key = def.id + ':' + match.level;
  const r = save.record[key] || { won: 0, lost: 0, drew: 0 };
  const stats = def.solo
    ? [[clock(match.elapsed), t('ui.bestTime', { time: clock(save.best[key] || match.elapsed) })],
       [String(match.state.mistakes || 0), t('ui.mistakes', { n: match.state.mistakes || 0 })]]
    : [[String(r.won), t('match.won')], [String(r.drew), t('match.drew')], [String(r.lost), t('match.lost')]];
  $('over-stats').innerHTML = stats
    .map(([big, small]) => `<div class="stat"><b>${big}</b><span>${small}</span></div>`)
    .join('');
  $('over').hidden = false;
  refreshRecords();
}

/** The four pieces a pawn can become, drawn rather than written. */
function showPromotion() {
  const row = $('promo-row');
  row.textContent = '';
  for (const option of match.pending.options) {
    const button = document.createElement('button');
    button.type = 'button';
    const c = document.createElement('canvas');
    const size = 60;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    chessPiece(ctx, option.promo, size / 2, size / 2, size * 0.92, PALETTES.chess.pieces[match.side], {
      facing: match.side === 0 ? 1 : -1,
    });
    button.appendChild(c);
    button.addEventListener('click', () => {
      $('promote').hidden = true;
      match.choose(option);
    });
    row.appendChild(button);
  }
  $('promote').hidden = false;
}

// ------------------------------------------------------------------ screens

function show(name) {
  screen = name;
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  $('over').hidden = true;
  $('promote').hidden = true;
  if (name !== 'table') match = null;
  if (name === 'lobby') refreshRecords();
}

// -------------------------------------------------------------------- input

const point = (event) => {
  const source = event.touches && event.touches[0] ? event.touches[0] : event;
  return vp.point(source.clientX, source.clientY);
};

canvas.addEventListener('pointerdown', (event) => {
  sound.resume();
  if (screen !== 'table' || !match) return;
  const p = point(event);
  match.tap(p.x, p.y);
});

canvas.addEventListener('pointermove', (event) => {
  if (screen !== 'table' || !match) return;
  const p = point(event);
  // the hover is only used by the two games where a whole column or pit is the
  // target and the pointer needs to say which one
  if (match.view.hit) {
    const target = match.view.hit(p.x, p.y, { flip: match.flip, side: match.side, state: match.state });
    match.hover = typeof target === 'number' && target >= 0 ? target : null;
  }
});

addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey) return;
  if (screen === 'table' && match) {
    if (event.code === 'KeyZ') return match.undo();
    if (event.code === 'KeyH') return match.hint();
    if (event.code === 'KeyR') return restart();
    if (event.code === 'Escape') return show('lobby');
    if (event.code === 'Space' && match.def.rules.needsRoll) {
      event.preventDefault();
      return match.roll();
    }
    match.key(event.code);
    return;
  }
  if (screen === 'setup' && event.code === 'Enter') $('btn-start').click();
  if (screen === 'setup' && event.code === 'Escape') show('lobby');
});

$('btn-start').addEventListener('click', () => {
  const keep = save.resume && save.resume.id === chosen.id && save.resume.level === chosen.level;
  startMatch(keep ? save.resume : null);
});
$('btn-setup-back').addEventListener('click', () => show('lobby'));
$('btn-exit').addEventListener('click', () => show('lobby'));
$('btn-over-lobby').addEventListener('click', () => show('lobby'));
$('btn-rematch').addEventListener('click', () => {
  $('over').hidden = true;
  startMatch(null);
});
$('btn-undo').addEventListener('click', () => match && match.undo());
$('btn-restart').addEventListener('click', restart);
$('btn-hint').addEventListener('click', () => match && match.hint());

function restart() {
  save.resume = null;
  startMatch(null);
}

for (const id of ['btn-sound', 'btn-sound2']) {
  $(id).addEventListener('click', () => {
    const on = sound.toggle();
    for (const other of ['btn-sound', 'btn-sound2']) $(other).textContent = on ? '🔊' : '🔇';
  });
  $(id).textContent = sound.on ? '🔊' : '🔇';
}

i18n.onChange(() => {
  applyTitle();
  refreshRecords();
  if (match) onMatchChange();
});

// --------------------------------------------------------------------- frame

createLoop({
  step: 1 / 60,
  update: (h) => {
    if (match) match.tick(h);
  },
  draw: () => {
    vp.begin();
    if (match && screen === 'table') match.draw(vp.ctx, vp.W, vp.H);
    else drawTable(vp.ctx, vp.W, vp.H);
  },
}).start();

buildLobby();
$('boot').hidden = true;
show('lobby');

/** A handle for the console — the last two rounds of bugs were found here. */
window.__game = {
  name: 'dez-classicos',
  viewport: vp,
  i18n,
  games: GAMES,
  get match() { return match; },
  save: () => save,
  play: (id, level = 'normal', side = 0) => {
    chosen = { id, level, side };
    startMatch(null);
  },
};
