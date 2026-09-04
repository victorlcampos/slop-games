// Hop Across: road, river and hurry — reach the other side.
//
// Five lanes of traffic, four of river, five bays up top. Logs carry, water
// and bumpers kill, and an occupied bay is as deadly as a truck: there is no
// room for two. Filling all five bays clears the wave and the whole machine
// speeds up.

import { PLAY_W } from '../config.js';
import { t } from '../i18n.js';
import { field, hud, banner, makeStars, backdrop } from '../draw.js';

export const COLS = 13;
export const ROWS = 12;
export const CELL = 52;
export const OX = (PLAY_W - COLS * CELL) / 2;
export const OY = (720 - ROWS * CELL) / 2;

export const HOME_ROW = 0;
export const START = { c: 6, r: 11 };
export const SLOTS = [0, 3, 6, 9, 12];
export const TIME_LIMIT = 40;
const HOP_GAP = 0.14;

function pace(wave) {
  return 1 + (wave - 1) * 0.14;
}

// row → traffic. Cars kill, logs carry; the banks and the grass are safe.
function lanes(wave) {
  const p = pace(wave);
  return [
    { row: 1, kind: 'river', dir: 1, speed: 1.3 * p, len: 3, count: 2 },
    { row: 2, kind: 'river', dir: -1, speed: 1.9 * p, len: 2, count: 3 },
    { row: 3, kind: 'river', dir: 1, speed: 2.5 * p, len: 4, count: 2 },
    { row: 4, kind: 'river', dir: -1, speed: 1.6 * p, len: 3, count: 2 },
    { row: 6, kind: 'road', dir: -1, speed: 3.0 * p, len: 2, count: 3 },
    { row: 7, kind: 'road', dir: 1, speed: 4.0 * p, len: 1, count: 4 },
    { row: 8, kind: 'road', dir: -1, speed: 5.0 * p, len: 1, count: 3 },
    { row: 9, kind: 'road', dir: 1, speed: 3.6 * p, len: 2, count: 3 },
    { row: 10, kind: 'road', dir: -1, speed: 4.4 * p, len: 2, count: 2 },
  ];
}

const CAR_COLOURS = ['#ff5555', '#ff9955', '#ffee55', '#55aaff', '#cc88ff', '#55ff88'];

export function create(rand = Math.random) {
  const game = {
    wave: 1,
    rand,
    score: 0,
    lives: 3,
    over: false,
    events: [],
    frog: { ...START, x: START.c, y: START.r },
    slots: SLOTS.map(() => false),
    movers: [],
    timer: TIME_LIMIT,
    hopGap: 0,
    hopT: 0,
    clearT: 0,
  };
  buildMovers(game);
  return game;
}

function emit(game, name, data) {
  game.events.push({ name, ...data });
}

export function drain(game) {
  const out = game.events;
  game.events = [];
  return out;
}

export function isOver(game) {
  return game.over;
}

function buildMovers(game) {
  game.movers = [];
  let ci = 0;
  for (const lane of lanes(game.wave)) {
    const span = COLS + lane.len + 2;
    for (let i = 0; i < lane.count; i++) {
      game.movers.push({
        row: lane.row,
        kind: lane.kind,
        dir: lane.dir,
        speed: lane.speed,
        len: lane.len,
        x: (i * span) / lane.count + game.rand() * 2,
        colour: lane.kind === 'road' ? CAR_COLOURS[ci++ % CAR_COLOURS.length] : null,
      });
    }
  }
}

/** The mover under cell x on a river row, or null for open water. */
export function logUnder(game, row, x) {
  for (const m of game.movers) {
    if (m.row !== row || m.kind !== 'river') continue;
    if (x >= m.x - 0.4 && x <= m.x + m.len + 0.4) return m;
  }
  return null;
}

/** A car overlapping cell x on a road row. */
export function carAt(game, row, x) {
  for (const m of game.movers) {
    if (m.row !== row || m.kind !== 'road') continue;
    if (x >= m.x - 0.45 && x <= m.x + m.len + 0.45) return m;
  }
  return null;
}

function resetFrog(game) {
  game.frog = { ...START, x: START.c, y: START.r };
  game.timer = TIME_LIMIT;
  game.hopGap = 0;
}

function die(game, how) {
  game.lives -= 1;
  emit(game, how); // 'splash' for the river, 'boom' for the road
  if (game.lives <= 0) {
    game.over = true;
    emit(game, 'lose');
  } else {
    resetFrog(game);
  }
}

function hop(game, dx, dy) {
  const f = game.frog;
  const nc = f.c + dx;
  const nr = f.r + dy;
  if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return; // the banks hold
  if (nr === HOME_ROW && !SLOTS.includes(nc)) return; // bushes, not bays
  f.c = nc;
  f.r = nr;
  f.x = nc;
  f.y = nr;
  game.hopT = 0.12;
  game.score += 10; // every hop pays the fare
  emit(game, 'hop');
}

export function update(game, h, input = {}) {
  if (game.over) return;
  if (game.clearT > 0) {
    game.clearT -= h;
    if (game.clearT <= 0) {
      game.wave += 1;
      game.slots = SLOTS.map(() => false);
      buildMovers(game);
      resetFrog(game);
      emit(game, 'banner', { text: t('wave.next', { n: game.wave }) });
      emit(game, 'wave');
    }
    return;
  }

  for (const m of game.movers) {
    m.x += m.dir * m.speed * h;
    const span = COLS + m.len + 2;
    if (m.dir === 1 && m.x > COLS + 1) m.x -= span;
    if (m.dir === -1 && m.x + m.len < -1) m.x += span;
  }

  game.hopGap -= h;
  game.hopT -= h;
  if (game.hopGap <= 0) {
    let dx = 0;
    let dy = 0;
    if (input.left) dx = -1;
    else if (input.right) dx = 1;
    else if (input.up) dy = -1;
    else if (input.down) dy = 1;
    else if (input.swipe === 'left') dx = -1;
    else if (input.swipe === 'right') dx = 1;
    else if (input.swipe === 'up') dy = -1;
    else if (input.swipe === 'down') dy = 1;
    if (dx || dy) {
      hop(game, dx, dy);
      game.hopGap = HOP_GAP;
    }
  }

  const f = game.frog;
  const lane = lanes(game.wave).find((l) => l.row === f.r);

  if (lane && lane.kind === 'road') {
    if (carAt(game, f.r, f.x)) {
      die(game, 'boom');
      return;
    }
  } else if (lane && lane.kind === 'river') {
    const log = logUnder(game, f.r, f.x);
    if (!log) {
      die(game, 'splash');
      return;
    }
    f.x += log.dir * log.speed * h;
    f.c = Math.round(f.x);
    if (f.x < -0.5 || f.x > COLS - 0.5) {
      die(game, 'splash'); // carried off the world
      return;
    }
  }

  // the far bank: an empty bay fills, anything else is a wall with teeth
  if (f.r === HOME_ROW) {
    const i = SLOTS.indexOf(f.c);
    if (i >= 0 && !game.slots[i]) {
      game.slots[i] = true;
      game.score += 500;
      emit(game, 'goal');
      if (game.slots.every(Boolean)) {
        game.score += 1000;
        game.clearT = 2;
        emit(game, 'banner', { text: t('wave.clear', { n: game.wave }) });
        emit(game, 'clear');
      } else {
        resetFrog(game);
      }
    } else if (i >= 0) {
      die(game, 'splash'); // no room for two
    }
  }

  game.timer -= h;
  if (game.timer <= 0 && !game.over && game.clearT <= 0) {
    die(game, 'boom'); // out of time on the road
  }
}

const stars = makeStars(1981);

function cellXY(c, r) {
  return [OX + (c + 0.5) * CELL, OY + (r + 0.5) * CELL];
}

export function draw(ctx, game, view) {
  backdrop(ctx, view.W, view.time, stars);
  hud(ctx, view.W,
    `${t('hud.score')}: ${game.score}`,
    `${t('hud.wave')} ${game.wave}`,
    `${t('hud.best')}: ${view.best}`);
  field(ctx, view.W, () => {
    const laneOf = (r) => lanes(game.wave).find((l) => l.row === r);
    for (let r = 0; r < ROWS; r++) {
      const y = OY + r * CELL;
      const lane = laneOf(r);
      if (r === HOME_ROW || r === 5 || r === ROWS - 1) {
        ctx.fillStyle = '#0d3a1e';
        ctx.fillRect(OX, y, COLS * CELL, CELL);
      } else if (lane && lane.kind === 'river') {
        ctx.fillStyle = '#0a2a5e';
        ctx.fillRect(OX, y, COLS * CELL, CELL);
      } else {
        ctx.fillStyle = '#1a1a22';
        ctx.fillRect(OX, y, COLS * CELL, CELL);
        ctx.fillStyle = '#555566';
        for (let c = 0; c < COLS; c += 2) {
          ctx.fillRect(OX + c * CELL + 8, y + CELL / 2 - 2, CELL - 16, 4);
        }
      }
    }
    // the bays
    for (let i = 0; i < SLOTS.length; i++) {
      const [x, y] = cellXY(SLOTS[i], HOME_ROW);
      ctx.fillStyle = game.slots[i] ? '#2fae5c' : '#0a2a5e';
      ctx.strokeStyle = '#7dff8a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, CELL * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // logs and cars
    for (const m of game.movers) {
      const x = OX + m.x * CELL;
      const y = OY + m.row * CELL + 6;
      const w = m.len * CELL;
      if (m.kind === 'river') {
        ctx.fillStyle = '#7a5230';
        ctx.fillRect(x, y, w, CELL - 12);
        ctx.fillStyle = '#93703f';
        ctx.fillRect(x, y, w, 6);
      } else {
        ctx.fillStyle = m.colour;
        ctx.fillRect(x + 2, y + 4, w - 4, CELL - 20);
        ctx.fillStyle = 'rgba(180,220,255,0.8)';
        const wx = m.dir === 1 ? x + w - 16 : x + 6;
        ctx.fillRect(wx, y + 8, 10, CELL - 28);
      }
    }
    // the frog, squash-stretched mid-hop
    const [fx, fy] = cellXY(game.frog.x, game.frog.r);
    const squash = game.hopT > 0 ? 1.25 : 1;
    ctx.fillStyle = '#55ff55';
    ctx.beginPath();
    ctx.ellipse(fx, fy, 15 * squash, 15 / squash, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#06130a';
    ctx.beginPath();
    ctx.arc(fx - 6, fy - 8, 3, 0, Math.PI * 2);
    ctx.arc(fx + 6, fy - 8, 3, 0, Math.PI * 2);
    ctx.fill();
    // lives and the clock
    for (let i = 0; i < game.lives; i++) {
      ctx.fillStyle = '#55ff55';
      ctx.beginPath();
      ctx.arc(OX + 18 + i * 28, OY + ROWS * CELL + 24, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = game.timer < 10 ? '#ff5555' : '#9dc4a4';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(game.timer)}s`, OX + COLS * CELL, OY + ROWS * CELL + 18);
    ctx.textAlign = 'left';
  });
  banner(ctx, view.W, view.banner, view.bannerAlpha);
}
