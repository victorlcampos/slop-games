// Neon Snake: eat, grow, and do not bite yourself.
//
// The head turns on a queue — the want is remembered until the next step, so
// a quick up-left on a corner does what the thumb meant. Every food shortens
// the clock; the bonus only shows its face every fifth meal. One life: the
// run is the score.

import { PLAY_W } from '../config.js';
import { t } from '../i18n.js';
import { field, hud, banner, makeStars, backdrop } from '../draw.js';

export const COLS = 24;
export const ROWS = 18;
export const CELL = 32;
export const OX = (PLAY_W - COLS * CELL) / 2;
export const OY = 72;

export const BASE_INTERVAL = 0.13;
export const MIN_INTERVAL = 0.055;

const DIRS = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** Seconds per step after `eaten` meals. */
export function stepInterval(eaten) {
  return Math.max(MIN_INTERVAL, BASE_INTERVAL * Math.pow(0.985, eaten));
}

export function create(rand = Math.random) {
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
    body: [
      [11, 9], [10, 9], [9, 9],
    ],
    food: null,
    bonus: null,
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

function step(game) {
  for (const d of ['up', 'down', 'left', 'right']) {
    if (game['in_' + d]) game.want = d;
  }
  if (game.swipe && DIRS[game.swipe]) game.want = game.swipe;
  if (game.want !== OPP[game.dir]) game.dir = game.want;

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
    game.lives = 0;
    game.over = true;
    emit(game, 'lose');
    return;
  }

  game.body.unshift(head);
  if (eating) {
    if (game.bonus && head[0] === game.bonus[0] && head[1] === game.bonus[1]) {
      game.score += 50;
      game.bonus = null;
      game.meals = 0;
      emit(game, 'power');
    } else {
      game.score += 10;
      game.eaten += 1;
      game.meals += 1;
      game.food = null;
      placeFood(game);
      if (game.meals >= 5 && !game.bonus) {
        const free = freeCells(game);
        if (free.length) {
          game.bonus = free[Math.floor(game.rand() * free.length)];
          game.meals = 0;
        }
      }
      emit(game, 'eat');
    }
  } else {
    game.body.pop();
  }
}

export function update(game, h, input = {}) {
  if (game.over) return;
  game.in_up = input.up;
  game.in_down = input.down;
  game.in_left = input.left;
  game.in_right = input.right;
  game.swipe = input.swipe || null;
  game.clock += h;
  const interval = stepInterval(game.eaten);
  while (game.clock >= interval && !game.over) {
    game.clock -= interval;
    step(game);
  }
}

const stars = makeStars(1979);

export function draw(ctx, game, view) {
  backdrop(ctx, view.W, view.time, stars);
  hud(ctx, view.W,
    `${t('hud.score')}: ${game.score}`,
    `${t('hud.level')} ${game.eaten + 1}`,
    `${t('hud.best')}: ${view.best}`);
  field(ctx, view.W, () => {
    // the pit
    ctx.fillStyle = '#060a08';
    ctx.fillRect(OX - 6, OY - 6, COLS * CELL + 12, ROWS * CELL + 12);
    ctx.strokeStyle = '#2fae5c';
    ctx.lineWidth = 3;
    ctx.strokeRect(OX - 6, OY - 6, COLS * CELL + 12, ROWS * CELL + 12);

    const dot = ([c, r], colour, size) => {
      ctx.fillStyle = colour;
      ctx.fillRect(OX + c * CELL + (CELL - size) / 2, OY + r * CELL + (CELL - size) / 2, size, size);
    };
    if (game.food) dot(game.food, '#ff5555', 16);
    if (game.bonus) {
      const pulse = 18 + 3 * Math.sin(view.time * 6);
      dot(game.bonus, '#ffd88a', pulse);
    }
    game.body.forEach(([c, r], i) => {
      const glow = 1 - (i / game.body.length) * 0.5;
      ctx.fillStyle = i === 0 ? '#aaffbb'
        : `rgb(${Math.round(47 * glow)},${Math.round(174 * glow)},${Math.round(92 * glow)})`;
      ctx.fillRect(OX + c * CELL + 2, OY + r * CELL + 2, CELL - 4, CELL - 4);
    });
    // the head looks where it is going
    const [hx, hy] = game.body[0];
    const [dx, dy] = DIRS[game.dir];
    ctx.fillStyle = '#06130a';
    const ex = OX + hx * CELL + CELL / 2 + dx * 6;
    const ey = OY + hy * CELL + CELL / 2 + dy * 6;
    const px = -dy * 7;
    const py = dx * 7;
    ctx.beginPath();
    ctx.arc(ex + px, ey + py, 3.4, 0, Math.PI * 2);
    ctx.arc(ex - px, ey - py, 3.4, 0, Math.PI * 2);
    ctx.fill();
  });
  banner(ctx, view.W, view.banner, view.bannerAlpha);
}
