// Neon Snake, played in Node: the queue, the growth, the bite, the pace.

import { scenario, check, checkEqual, headlessContext, run } from 'slopkit/testing';

import {
  COLS, ROWS, stepInterval, BASE_INTERVAL, MIN_INTERVAL,
  BONUS_TTL, DYING_TIME,
  create, update, drain, isOver, draw,
} from '../src/games/snake.js';

const H = 1 / 60;
const HALF = () => 0.5;

/** Arm exactly one step: the clock lands half a frame short of the line. */
function arm(game) {
  game.clock = stepInterval(game.eaten) - H / 2;
}

/** A fresh game about to take one step. */
function primed() {
  const game = create(HALF);
  arm(game);
  return game;
}

/** Park the snake in open water heading right, far from anything. */
function park(game) {
  game.body = [[5, 9], [4, 9], [3, 9]];
  game.prevBody = game.body.map(([c, r]) => [c, r]);
  game.dir = 'right';
  game.want = 'right';
  game.queue = [];
  game.food = [0, 0];
  game.bonus = null;
  game.bonusT = 0;
  game.dying = 0;
  game.over = false;
}

function onBody(game, cell) {
  return game.body.some(([c, r]) => c === cell[0] && r === cell[1]);
}

scenario('the queue remembers a quick corner', () => {
  const game = primed();
  checkEqual(game.dir, 'right', 'the snake does not open to the right');
  update(game, H, { up: true });
  checkEqual(game.dir, 'up', 'the turn was forgotten');
  // a reversal never turns straight back into its own neck
  game.queue = [];
  game.dir = 'up';
  game.want = 'up';
  game.body = [[11, 8], [11, 9], [10, 9]];
  game.prevBody = game.body.map(([c, r]) => [c, r]);
  game.food = [0, 0];
  update(game, 0, { down: true });
  checkEqual(game.queue.length, 0, `the reversal got in line: ${JSON.stringify(game.queue)}`);
  arm(game);
  update(game, H, { down: true });
  checkEqual(game.dir, 'up', 'the snake reversed into its neck');
});

scenario('two quick turns between steps both apply', () => {
  const game = primed();
  game.food = [0, 0];
  update(game, 0, { up: true });
  update(game, 0, { left: true });
  checkEqual(game.queue.length, 2, `the second turn was lost: ${JSON.stringify(game.queue)}`);
  arm(game);
  update(game, H, {});
  checkEqual(game.dir, 'up', 'the first buffered turn never applied');
  checkEqual(game.body[0][0], 11, `head c is ${game.body[0][0]}, not 11`);
  checkEqual(game.body[0][1], 8, `head r is ${game.body[0][1]}, not 8`);
  arm(game);
  update(game, H, {});
  checkEqual(game.dir, 'left', 'the second buffered turn never applied');
  checkEqual(game.body[0][0], 10, `head c is ${game.body[0][0]}, not 10`);
  checkEqual(game.body[0][1], 8, `head r is ${game.body[0][1]}, not 8`);
});

scenario('reversals never get in line', () => {
  const game = primed();
  game.food = [0, 0];
  update(game, 0, { up: true });
  update(game, 0, { down: true });
  checkEqual(game.queue.length, 1, `the reversal got in line: ${JSON.stringify(game.queue)}`);
  arm(game);
  update(game, H, {});
  checkEqual(game.dir, 'up', 'the first turn never applied');
  arm(game);
  update(game, H, {});
  checkEqual(game.dir, 'up', 'the dropped reversal came back to life');
});

scenario('the queue holds two turns, not three', () => {
  const game = primed();
  game.food = [0, 0];
  update(game, 0, { up: true });
  update(game, 0, { left: true });
  update(game, 0, { down: true });
  checkEqual(game.queue.length, 2, `the queue held ${game.queue.length}, not 2`);
  arm(game);
  update(game, H, {});
  checkEqual(game.dir, 'up', 'the first turn never applied');
  arm(game);
  update(game, H, {});
  checkEqual(game.dir, 'left', 'the second turn never applied');
  check(game.dir !== 'down', 'the overflow turn leaked through');
});

scenario('turns still register at top speed', () => {
  const game = create(HALF);
  game.eaten = 10000;
  checkEqual(stepInterval(game.eaten), MIN_INTERVAL, 'the pace never hit the floor');
  park(game);
  update(game, 0, { up: true });
  update(game, 0, { left: true });
  arm(game);
  update(game, H, {});
  checkEqual(game.dir, 'up', 'the fast turn was skipped');
  check(Number.isInteger(game.body[0][0]) && Number.isInteger(game.body[0][1]),
    `the head left the tile centers: ${game.body[0]}`);
  arm(game);
  update(game, H, {});
  checkEqual(game.dir, 'left', 'the second fast turn was skipped');
  check(Number.isInteger(game.body[0][0]) && Number.isInteger(game.body[0][1]),
    `the head left the tile centers: ${game.body[0]}`);
  check(!isOver(game), 'the fast corner killed a healthy snake');
});

scenario('food grows the tail by one and pays ten', () => {
  const game = primed();
  const [hx, hy] = game.body[0];
  game.food = [hx + 1, hy]; // dead ahead
  const n = game.body.length;
  update(game, H, {});
  checkEqual(game.body.length, n + 1, 'the meal grew nothing');
  checkEqual(game.score, 10, `the meal paid ${game.score}, not 10`);
  check(drain(game).some((e) => e.name === 'eat'), 'no eat event left the pit');
  check(game.food, 'the next meal never arrived');
});

scenario('every fifth meal hides a bonus worth fifty', () => {
  const game = primed();
  game.meals = 4;
  const [hx, hy] = game.body[0];
  game.food = [hx + 1, hy];
  update(game, H, {});
  check(game.bonus, 'the fifth meal hid no bonus');
  const [bx, by] = game.bonus;
  game.body = [[bx - 1, by], [bx - 2, by]];
  game.prevBody = game.body.map(([c, r]) => [c, r]);
  game.dir = 'right';
  game.want = 'right';
  game.queue = [];
  arm(game);
  const score = game.score;
  update(game, H, {});
  checkEqual(game.score, score + 50, `the bonus paid ${game.score - score}, not 50`);
  check(!game.bonus, 'the eaten bonus stays on the board');
});

scenario('meals and bonuses always land on a free cell', () => {
  const game = primed();
  check(game.food, 'a fresh pit has no meal');
  check(!onBody(game, game.food), `fresh food spawned inside the snake at ${game.food}`);
  for (let k = 0; k < 6; k++) {
    game.body = [[5 + k, 9], [4 + k, 9], [3 + k, 9]];
    game.prevBody = game.body.map(([c, r]) => [c, r]);
    game.dir = 'right';
    game.want = 'right';
    game.queue = [];
    game.dying = 0;
    game.over = false;
    if (k === 4) game.meals = 4; // the next meal hides a bonus
    const [hx, hy] = game.body[0];
    game.food = [hx + 1, hy];
    game.bonus = null;
    game.bonusT = 0;
    arm(game);
    update(game, H, {});
    check(!isOver(game) && game.dying === 0, `meal ${k} killed a healthy snake`);
    if (game.food) {
      check(!onBody(game, game.food), `meal ${k} spawned inside the snake at ${game.food}`);
      check(!(game.bonus && game.food[0] === game.bonus[0] && game.food[1] === game.bonus[1]),
        `meal ${k} spawned on top of the bonus`);
    }
    if (game.bonus) {
      check(!onBody(game, game.bonus), `bonus ${k} spawned inside the snake at ${game.bonus}`);
      check(!(game.food && game.bonus[0] === game.food[0] && game.bonus[1] === game.food[1]),
        `bonus ${k} spawned on top of the food`);
    }
    drain(game);
  }
});

scenario('the bonus fades after ten seconds', () => {
  const game = primed();
  game.meals = 4;
  const [hx, hy] = game.body[0];
  game.food = [hx + 1, hy];
  update(game, H, {});
  check(game.bonus, 'the fifth meal hid no bonus');
  check(game.bonusT > BONUS_TTL - 1 && game.bonusT <= BONUS_TTL,
    `the bonus clock is ${game.bonusT}, not ~${BONUS_TTL}s`);
  drain(game);
  // shrink the wait: the clock, not the odometer, clears the bonus
  park(game);
  game.bonus = [20, 15];
  game.bonusT = 0.2;
  for (let t = 0; t < 0.4; t += H) update(game, H, {});
  check(!game.bonus, 'the stale bonus never faded');
  checkEqual(game.meals, 0, 'the faded bonus left a stale meal count');
  check(!isOver(game), 'waiting out the bonus ended the run');
  check(!drain(game).some((e) => e.name === 'power'), 'an expired bonus paid out');
});

scenario('walls end the run, after the flash', () => {
  const game = primed();
  game.body = [[0, 9], [1, 9], [2, 9]];
  game.prevBody = game.body.map(([c, r]) => [c, r]);
  game.dir = 'left';
  game.want = 'left';
  game.queue = [];
  update(game, H, {});
  check(!isOver(game), 'the wall skipped the death flash');
  check(game.dying > 0, 'no death flash started at the wall');
  check(!drain(game).some((e) => e.name === 'lose'), 'the lose event fired before the flash');
  for (let t = 0; t < DYING_TIME + H; t += H) update(game, H, {});
  check(isOver(game), 'the wall let the snake through');
  check(drain(game).some((e) => e.name === 'lose'), 'no lose event left the pit');
});

scenario('the tail tip moves away, the neck does not', () => {
  // into the tip that is leaving: alive, same length
  const free = primed();
  free.body = [[5, 5], [4, 5], [4, 6], [5, 6], [6, 6], [6, 5]];
  free.prevBody = free.body.map(([c, r]) => [c, r]);
  free.dir = 'right';
  free.want = 'right';
  free.queue = [];
  free.food = [0, 0];
  update(free, H, {});
  check(!isOver(free) && free.dying === 0, 'chasing its own tail tip killed the snake');
  checkEqual(free.body.length, 6, 'the chase grew or shrank the snake');

  // into the neck: dead, after the flash
  const dead = primed();
  dead.body = [[5, 5], [5, 6], [5, 7]];
  dead.prevBody = dead.body.map(([c, r]) => [c, r]);
  dead.dir = 'down';
  dead.want = 'down';
  dead.queue = [];
  update(dead, H, {});
  check(!isOver(dead), 'the bite skipped the death flash');
  check(dead.dying > 0, 'biting its neck started no flash');
  for (let t = 0; t < DYING_TIME + H; t += H) update(dead, H, {});
  check(isOver(dead), 'the snake bit itself and lived');
});

scenario('the pace quickens with every meal, down to the floor', () => {
  check(stepInterval(100) < stepInterval(0), 'a fat snake is not faster');
  checkEqual(stepInterval(0), BASE_INTERVAL, 'a fresh snake does not run the base pace');
  check(stepInterval(10000) >= MIN_INTERVAL, 'the floor fell out from under the pace');
});

scenario('a full pit still ends gracefully', () => {
  const game = primed();
  check(game.food, 'a fresh pit has no meal');
  check(game.body.length === 3, 'a fresh snake has the wrong length');
});

scenario('the whole pit draws without a browser', () => {
  const game = primed();
  update(game, H, {});
  draw(headlessContext(), game, { time: 1.5, W: 500, best: 999, banner: '', bannerAlpha: 0 });
  // mid-glide, bonus warning blink, and the death flash all draw too
  const mid = primed();
  mid.food = [0, 0];
  update(mid, 0, { up: true });
  arm(mid);
  update(mid, H / 2, {});
  draw(headlessContext(), mid, { time: 0.6, W: 500, best: 0, banner: '', bannerAlpha: 0 });
  const warn = primed();
  warn.bonus = [12, 9];
  warn.bonusT = 1.5;
  draw(headlessContext(), warn, { time: 1.0, W: 500, best: 0, banner: '', bannerAlpha: 0 });
  draw(headlessContext(), warn, { time: 1.1, W: 500, best: 0, banner: '', bannerAlpha: 0 });
  const dying = primed();
  dying.body = [[0, 9], [1, 9], [2, 9]];
  dying.prevBody = dying.body.map(([c, r]) => [c, r]);
  dying.dir = 'left';
  dying.want = 'left';
  dying.queue = [];
  update(dying, H, {});
  draw(headlessContext(), dying, { time: 2.0, W: 500, best: 0, banner: '', bannerAlpha: 0 });
  check(dying.dying > 0, 'the death flash never started for the painter');
});

await run('neon snake');
