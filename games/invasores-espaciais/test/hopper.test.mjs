// Hop Across, played in Node: the hop, the traffic, the river, the bays.

import { scenario, check, checkEqual, headlessContext, run } from 'slopkit/testing';

import {
  COLS, ROWS, SLOTS, START, TIME_LIMIT,
  create, update, drain, isOver, draw, logUnder, carAt,
} from '../src/games/hopper.js';

const H = 1 / 60;
const HALF = () => 0.5;

scenario('twenty-four movers, nine lanes, five bays', () => {
  const game = create(HALF);
  checkEqual(game.movers.length, 24, `${game.movers.length} movers, not 24`);
  check(game.movers.some((m) => m.kind === 'road'), 'no traffic on the road');
  check(game.movers.some((m) => m.kind === 'river'), 'nothing floats on the river');
  checkEqual(SLOTS.length, 5, 'the far bank has the wrong number of bays');
  checkEqual(game.frog.c, START.c, 'the frog does not open at the start');
});

scenario('one press, one hop, ten points of fare', () => {
  const game = create(HALF);
  update(game, H, { up: true });
  checkEqual(game.frog.r, START.r - 1, 'the first hop went nowhere');
  checkEqual(game.score, 10, 'the hop paid no fare');
  check(drain(game).some((e) => e.name === 'hop'), 'no hop event left the road');
  // holding the key does not teleport: the gap throttles it
  const r = game.frog.r;
  update(game, H, { up: true });
  checkEqual(game.frog.r, r, 'holding up hopped twice in two frames');
});

scenario('traffic kills and sends the frog home', () => {
  const game = create(HALF);
  game.movers = [{ row: 6, kind: 'road', dir: 1, speed: 0, len: 2, x: 5.5, colour: '#fff' }];
  game.frog = { c: 6, r: 6, x: 6, y: 6 };
  check(carAt(game, 6, 6), 'the test truck misses the frog');
  update(game, H, {});
  checkEqual(game.lives, 2, 'the truck cost the wrong number of lives');
  checkEqual(game.frog.r, START.r, 'the frog did not walk home');
  check(drain(game).some((e) => e.name === 'boom'), 'no boom event left the road');
});

scenario('open water kills, a log carries', () => {
  // drown
  const wet = create(HALF);
  wet.movers = [];
  wet.frog = { c: 5, r: 2, x: 5, y: 2 };
  check(!logUnder(wet, 2, 5), 'open water floats something');
  update(wet, H, {});
  checkEqual(wet.lives, 2, 'the river cost the wrong number of lives');
  check(drain(wet).some((e) => e.name === 'splash'), 'no splash event left the river');

  // carried
  const dry = create(HALF);
  dry.movers = [{ row: 2, kind: 'river', dir: 1, speed: 2, len: 3, x: 4, colour: null }];
  dry.frog = { c: 5, r: 2, x: 5, y: 2 };
  update(dry, H, {});
  checkEqual(dry.lives, 3, 'a log ride drowned the frog');
  check(dry.frog.x > 5, `the log did not carry: ${dry.frog.x}`);
});

scenario('carried off the world drowns like the water does', () => {
  const game = create(HALF);
  game.movers = [{ row: 2, kind: 'river', dir: 1, speed: 60, len: 3, x: COLS - 1.6, colour: null }];
  game.frog = { c: COLS - 1, r: 2, x: COLS - 1, y: 2 };
  update(game, H, {});
  checkEqual(game.lives, 2, 'the edge of the world let the frog through');
});

scenario('an empty bay fills and pays five hundred', () => {
  const game = create(HALF);
  game.movers = [];
  game.frog = { c: 0, r: 1, x: 0, y: 1 };
  const score = game.score;
  update(game, H, { up: true });
  check(game.slots[0], 'the bay stayed empty');
  checkEqual(game.score, score + 510, `the bay paid ${game.score - score}, not 500 + fare`);
  checkEqual(game.frog.r, START.r, 'the next frog never walked out');
  check(drain(game).some((e) => e.name === 'goal'), 'no goal event left the bank');
});

scenario('an occupied bay is as deadly as a truck', () => {
  const game = create(HALF);
  game.movers = [];
  game.slots[0] = true;
  game.frog = { c: 0, r: 1, x: 0, y: 1 };
  update(game, H, { up: true });
  checkEqual(game.lives, 2, 'two frogs share one bay');
});

scenario('five filled bays clear the wave', () => {
  const game = create(HALF);
  game.movers = [];
  for (let i = 0; i < 4; i++) game.slots[i] = true;
  game.frog = { c: SLOTS[4], r: 1, x: SLOTS[4], y: 1 };
  update(game, H, { up: true });
  check(drain(game).some((e) => e.name === 'clear'), 'no clear event left the bank');
  for (let t = 0; t < 2.2; t += H) update(game, H, {});
  checkEqual(game.wave, 2, 'the second crossing never opened');
  check(game.slots.every((s) => !s), 'the bays stayed full for wave 2');
});

scenario('the clock kills dawdlers', () => {
  const game = create(HALF);
  check(TIME_LIMIT > 10, 'nobody crosses in a hurry of a deadline');
  game.timer = 0.01;
  update(game, H, {});
  checkEqual(game.lives, 2, 'the clock showed mercy');
});

scenario('three deaths end the run', () => {
  const game = create(HALF);
  game.movers = [];
  for (let death = 1; death <= 3; death++) {
    game.timer = 0.01;
    update(game, H, {});
  }
  check(isOver(game), 'three timeouts did not end the run');
});

scenario('the whole crossing draws without a browser', () => {
  const game = create(HALF);
  update(game, H, { up: true });
  draw(headlessContext(), game, { time: 1.5, W: 500, best: 999, banner: 'Onda 2', bannerAlpha: 1 });
});

await run('hop across');
