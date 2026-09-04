// Neon Snake: eat, grow, and do not bite yourself.
//
// Turns ride a 2-deep queue: the first input steers the next step, a second
// input waits for the step after, and reversals never get in line. Every food
// shortens the clock; the bonus shows its face every fifth meal and fades
// after BONUS_TTL seconds. One life: the run is the score. The paint glides
// between steps from prevBody, so the sim stays on tiles while the eyes see
// motion.

import { PLAY_W } from '../config.js';
import { t } from '../i18n.js';
import { field, hud, banner, makeStars, backdrop } from '../draw.js';

export const COLS = 24;
export const ROWS = 18;
export const CELL = 32;
export const OX = (PLAY_W - COLS * CELL) / 2;
export const OY = 86;

export const BASE_INTERVAL = 0.13;
export const MIN_INTERVAL = 0.055;

/** Seconds a bonus stays on the board before fading away. */
export const BONUS_TTL = 10;
/** Seconds of remaining bonus life that blink as a warning. */
export const BONUS_WARN = 3;
/** Seconds the death flash runs before the run is marked over. */
export const DYING_TIME = 1.0;
/** How many turns the queue remembers between steps. */
export const QUEUE_MAX = 2;

const DIRS = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** Seconds per step after `eaten` meals. */
export function stepInterval(eaten) {
  return Math.max(MIN_INTERVAL, BASE_INTERVAL * Math.pow(0.985, eaten));
}

/** 0..1 how far the pace has fallen from base to the floor. */
export function speedT(eaten) {
  const span = BASE_INTERVAL - MIN_INTERVAL;
  if (span <= 0) return 1;
  const v = 1 - (stepInterval(eaten) - MIN_INTERVAL) / span;
  return Math.min(1, Math.max(0, v));
}

export function create(rand = Math.random) {
  const body = [
    [11, 9], [10, 9], [9, 9],
  ];
  const game = {
    rand,
    score: 0,
    lives: 1,
    over: false,
    events: [],
    eaten: 0,
    meals: 0,
    clock: 0,
    dir: 'right',
    want: 'right',
    queue: [],
    body,
    prevBody: body.map(([c, r]) => [c, r]),
    food: null,
    bonus: null,
    bonusT: 0,
    dying: 0,
  };
  placeFood(game);
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

function freeCells(game) {
  const busy = new Set(game.body.map(([c, r]) => c + ',' + r));
  if (game.food) busy.add(game.food.join(','));
  if (game.bonus) busy.add(game.bonus.join(','));
  const free = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!busy.has(c + ',' + r)) free.push([c, r]);
    }
  }
  return free;
}

function placeFood(game) {
  const free = freeCells(game);
  if (!free.length) return;
  game.food = free[Math.floor(game.rand() * free.length)];
}

function placeBonus(game) {
  const free = freeCells(game);
  if (!free.length) return;
  game.bonus = free[Math.floor(game.rand() * free.length)];
  game.bonusT = BONUS_TTL;
  game.meals = 0;
}

/** Queue a turn unless it repeats the tail of the line or turns straight back. */
function pushTurn(game, d) {
  if (!DIRS[d]) return;
  if (!Array.isArray(game.queue)) game.queue = [];
  const last = game.queue.length ? game.queue[game.queue.length - 1] : game.dir;
  if (d === last) return;
  if (d === OPP[last]) return;
  if (game.queue.length >= QUEUE_MAX) return;
  game.queue.push(d);
  game.want = d;
}

/** One direction per update: the swipe wins, otherwise the last held key. */
function inputDir(input = {}) {
  if (input.swipe && DIRS[input.swipe]) return input.swipe;
  let found = null;
  for (const d of ['up', 'down', 'left', 'right']) {
    if (input[d]) found = d;
  }
  return found;
}

function die(game) {
  game.lives = 0;
  game.dying = DYING_TIME;
  if (Array.isArray(game.queue)) game.queue.length = 0;
  game.want = game.dir;
}

function step(game) {
  game.prevBody = game.body.map(([c, r]) => [c, r]);
  if (Array.isArray(game.queue) && game.queue.length) {
    let next = null;
    while (game.queue.length) {
      const cand = game.queue.shift();
      if (cand === game.dir) continue;
      if (cand === OPP[game.dir]) continue;
      next = cand;
      break;
    }
    if (next) game.dir = next;
    game.want = game.queue.length ? game.queue[game.queue.length - 1] : game.dir;
  } else if (game.want !== OPP[game.dir]) {
    game.dir = game.want;
  }

  const [dx, dy] = DIRS[game.dir];
  const head = [game.body[0][0] + dx, game.body[0][1] + dy];

  // walls and the tail (minus the tip that is about to move away) end the run
  const out = head[0] < 0 || head[1] < 0 || head[0] >= COLS || head[1] >= ROWS;
  const eating = (game.food && head[0] === game.food[0] && head[1] === game.food[1])
    || (game.bonus && head[0] === game.bonus[0] && head[1] === game.bonus[1]);
  const hitsSelf = game.body.some(([c, r], i) => {
    if (!eating && i === game.body.length - 1) return false; // the tip moves away
    return c === head[0] && r === head[1];
  });
  if (out || hitsSelf) {
    die(game);
    return;
  }

  game.body.unshift(head);
  if (eating) {
    if (game.bonus && head[0] === game.bonus[0] && head[1] === game.bonus[1]) {
      game.score += 50;
      game.bonus = null;
      game.bonusT = 0;
      game.meals = 0;
      emit(game, 'power');
    } else {
      game.score += 10;
      game.eaten += 1;
      game.meals += 1;
      game.food = null;
      placeFood(game);
      if (game.meals >= 5 && !game.bonus) placeBonus(game);
      emit(game, 'eat');
    }
  } else {
    game.body.pop();
  }
}

export function update(game, h, input = {}) {
  if (game.over) return;
  if (game.dying > 0) {
    game.dying -= h;
    if (game.dying <= 0) {
      game.dying = 0;
      game.lives = 0;
      game.over = true;
      emit(game, 'lose');
    }
    return;
  }
  const d = inputDir(input);
  if (d) pushTurn(game, d);
  if (game.bonus) {
    game.bonusT -= h;
    if (game.bonusT <= 0) {
      game.bonus = null;
      game.bonusT = 0;
      game.meals = 0;
    }
  }
  game.clock += h;
  const interval = stepInterval(game.eaten);
  while (game.clock >= interval && !game.over && !(game.dying > 0)) {
    game.clock -= interval;
    step(game);
  }
}

const stars = makeStars(1979);

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function draw(ctx, game, view) {
  backdrop(ctx, view.W, view.time, stars);
  hud(ctx, view.W,
    `${t('hud.score')}: ${game.score}`,
    `${t('hud.level')} ${game.eaten + 1}`,
    `${t('hud.best')}: ${view.best}`);
  field(ctx, view.W, () => {
    const interval = stepInterval(game.eaten);
    const speed = speedT(game.eaten);
    const dying = game.dying > 0;
    const flashOn = dying && Math.floor(view.time * 12) % 2 === 0;

    // the pit, glowing hotter as the pace quickens; red while dying
    const border = dying
      ? '#ff4444'
      : speed < 0.33 ? '#2fae5c' : speed < 0.66 ? '#ffd23f' : '#ff6a3d';
    ctx.fillStyle = '#060a08';
    ctx.fillRect(OX - 6, OY - 6, COLS * CELL + 12, ROWS * CELL + 12);
    if (dying) {
      ctx.fillStyle = flashOn ? 'rgba(255,60,70,0.16)' : 'rgba(255,60,70,0.06)';
      ctx.fillRect(OX - 6, OY - 6, COLS * CELL + 12, ROWS * CELL + 12);
    }
    // a faint dotted grid so the glide reads as motion across the black
    ctx.fillStyle = 'rgba(47,174,92,0.10)';
    for (let r = 0; r < ROWS; r += 2) {
      for (let c = 0; c < COLS; c += 2) {
        ctx.fillRect(OX + c * CELL + CELL / 2 - 1, OY + r * CELL + CELL / 2 - 1, 2, 2);
      }
    }
    ctx.strokeStyle = border;
    ctx.lineWidth = 3 + 2 * speed + (dying ? 2 : 0);
    ctx.strokeRect(OX - 6, OY - 6, COLS * CELL + 12, ROWS * CELL + 12);

    const dot = ([c, r], colour, size) => {
      ctx.fillStyle = colour;
      ctx.fillRect(OX + c * CELL + (CELL - size) / 2, OY + r * CELL + (CELL - size) / 2, size, size);
    };

    // food breathes; the bonus blinks its last seconds away
    if (game.food) dot(game.food, '#ff5555', 14 + 3 * Math.sin(view.time * 5));
    if (game.bonus) {
      const left = typeof game.bonusT === 'number' && game.bonusT > 0 ? game.bonusT : BONUS_TTL;
      const warn = left < BONUS_WARN;
      const blinkOff = warn && Math.floor(view.time * 8) % 2 === 0;
      if (!blinkOff) {
        const pulse = 18 + 3 * Math.sin(view.time * 6);
        dot(game.bonus, '#ffd88a', pulse);
        const [bc, br] = game.bonus;
        const cx = OX + bc * CELL + CELL / 2;
        const cy = OY + br * CELL + CELL / 2;
        ctx.strokeStyle = warn ? '#ff6a3d' : '#ffd88a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(left / BONUS_TTL));
        ctx.stroke();
      }
    }

    // glide between steps: each square slides from where it was to where it is
    const alpha = clamp01(game.clock / interval);
    const prev = Array.isArray(game.prevBody) && game.prevBody.length ? game.prevBody : game.body;
    const at = (i) => {
      const [c, r] = game.body[i];
      const p = prev[i] || prev[prev.length - 1] || [c, r];
      return [p[0] + (c - p[0]) * alpha, p[1] + (r - p[1]) * alpha];
    };
    game.body.forEach(([c, r], i) => {
      const [fc, fr] = at(i);
      let x = OX + fc * CELL + 2;
      let y = OY + fr * CELL + 2;
      if (dying) {
        x += Math.sin(view.time * 42 + i * 1.7) * 2.5;
        y += Math.cos(view.time * 38 + i * 2.3) * 2.5;
      }
      if (dying && flashOn) {
        ctx.fillStyle = i === 0 ? '#ffffff' : '#ff6a6a';
      } else {
        const glow = 1 - (i / game.body.length) * 0.5;
        ctx.fillStyle = i === 0 ? '#aaffbb'
          : `rgb(${Math.round(47 * glow)},${Math.round(174 * glow)},${Math.round(92 * glow)})`;
      }
      void c; void r;
      ctx.fillRect(x, y, CELL - 4, CELL - 4);
    });

    // the head looks where it is going, leans with speed, flicks its tongue
    const [hfx, hfy] = at(0);
    const [dx, dy] = DIRS[game.dir] || [1, 0];
    const lean = 4 + 3 * speed;
    const cx = OX + hfx * CELL + CELL / 2 + dx * lean;
    const cy = OY + hfy * CELL + CELL / 2 + dy * lean;
    if ((view.time % 2.2) < 0.45 && !dying) {
      const tx = OX + hfx * CELL + CELL / 2 + dx * (CELL / 2 - 1);
      const ty = OY + hfy * CELL + CELL / 2 + dy * (CELL / 2 - 1);
      const ex2 = tx + dx * 10;
      const ey2 = ty + dy * 10;
      const px2 = -dy * 4;
      const py2 = dx * 4;
      ctx.strokeStyle = '#ff5555';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(ex2, ey2);
      ctx.moveTo(ex2, ey2);
      ctx.lineTo(ex2 + px2 + dx * 3, ey2 + py2 + dy * 3);
      ctx.moveTo(ex2, ey2);
      ctx.lineTo(ex2 - px2 + dx * 3, ey2 - py2 + dy * 3);
      ctx.stroke();
    }
    ctx.fillStyle = dying && flashOn ? '#5a0d12' : '#06130a';
    const ex = cx + dx * 2;
    const ey = cy + dy * 2;
    const px = -dy * 7;
    const py = dx * 7;
    ctx.beginPath();
    ctx.arc(ex + px, ey + py, 3.4, 0, Math.PI * 2);
    ctx.arc(ex - px, ey - py, 3.4, 0, Math.PI * 2);
    ctx.fill();
  });
  banner(ctx, view.W, view.banner, view.bannerAlpha);
}
