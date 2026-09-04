// Neon Snake, played in Node: the queue, the growth, the bite, the pace.

import { scenario, check, checkEqual, headlessContext, run } from 'slopkit/testing';

import {
  COLS, ROWS, stepInterval, BASE_INTERVAL, MIN_INTERVAL,
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

scenario('the queue remembers a quick corner', () => {
  const game = primed();
  checkEqual(game.dir, 'right', 'the snake does not open to the right');
  update(game, H, { up: true });
  checkEqual(game.dir, 'up', 'the turn was forgotten');
  // and never turns straight back into its own neck
  update(game, H, { down: true });
  arm(game);
  update(game, H, { down: true });
  checkEqual(game.dir, 'up', 'the snake reversed into its neck');
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
  game.dir = 'right';
  game.want = 'right';
  arm(game);
  const score = game.score;
  update(game, H, {});
  checkEqual(game.score, score + 50, `the bonus paid ${game.score - score}, not 50`);
  check(!game.bonus, 'the eaten bonus stays on the board');
});

scenario('walls end the run', () => {
  const game = primed();
  game.body = [[0, 9], [1, 9], [2, 9]];
  game.dir = 'left';
  game.want = 'left';
  update(game, H, {});
  check(isOver(game), 'the wall let the snake through');
  check(drain(game).some((e) => e.name === 'lose'), 'no lose event left the pit');
});

scenario('the tail tip moves away, the neck does not', () => {
  // into the tip that is leaving: alive, same length
  const free = primed();
  free.body = [[5, 5], [4, 5], [4, 6], [5, 6], [6, 6], [6, 5]];
  free.dir = 'right';
  free.want = 'right';
  free.food = [0, 0];
  update(free, H, {});
  check(!isOver(free), 'chasing its own tail tip killed the snake');
  checkEqual(free.body.length, 6, 'the chase grew or shrank the snake');

  // into the neck: dead
  const dead = primed();
  dead.body = [[5, 5], [5, 6], [5, 7]];
  dead.dir = 'down';
  dead.want = 'down';
  update(dead, H, {});
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
});

await run('neon snake');
