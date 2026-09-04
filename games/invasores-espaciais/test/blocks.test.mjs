// Block Breaker, played in Node: the launch, the aim, the wall, the floor.

import { scenario, check, checkEqual, headlessContext, run } from 'slopkit/testing';

import {
  COLS, ROWS, ballSpeed, create, update, drain, isOver, draw,
} from '../src/games/blocks.js';

const H = 1 / 60;
const HALF = () => 0.5;

scenario('the wall is sixty bricks, priced top-down', () => {
  const game = create(HALF);
  checkEqual(game.bricks.length, COLS * ROWS, `${game.bricks.length} bricks, not sixty`);
  const pays = game.bricks.map((b) => b.pay);
  checkEqual(Math.max(...pays), 60, 'nothing up top pays 60');
  checkEqual(Math.min(...pays), 10, 'the bottom row pays more than 10');
  const top = game.bricks.filter((b) => b.y < 150);
  const bottom = game.bricks.filter((b) => b.y > 250);
  const avg = (list) => list.reduce((s, b) => s + b.pay, 0) / list.length;
  check(avg(top) > avg(bottom), 'the cheap seats are upstairs');
});

scenario('fire launches upward, and the paddle edge is the aim', () => {
  const game = create(HALF);
  update(game, H, { fire: true });
  check(game.ball, 'the ball never left the paddle');
  check(game.ball.vy < 0, 'the launch goes down, not up');
  // dead center leaves straight
  game.ball = { x: game.paddleX, y: 630, vx: 0, vy: 300 };
  update(game, H, {});
  check(Math.abs(game.ball.vx) < 1, `dead center bent the ball: ${game.ball.vx}`);
  check(game.ball.vy < 0, 'the paddle did not send it back up');
  // the left edge sends it left
  game.ball = { x: game.paddleX - 50, y: 630, vx: 0, vy: 300 };
  update(game, H, {});
  check(game.ball.vx < -50, 'the left edge did not aim left');
  // the right edge sends it right
  game.ball = { x: game.paddleX + 50, y: 630, vx: 0, vy: 300 };
  update(game, H, {});
  check(game.ball.vx > 50, 'the right edge did not aim right');
});

scenario('bricks break, pay, and announce themselves', () => {
  const game = create(HALF);
  const brick = game.bricks[0];
  const n = game.bricks.length;
  // parked inside the brick: the hit registers without travelling through rows
  game.ball = { x: brick.x + 44, y: brick.y + 13, vx: 0, vy: 0 };
  update(game, H, {});
  checkEqual(game.bricks.length, n - 1, 'the brick survived a direct hit');
  checkEqual(game.score, brick.pay, `the brick paid ${game.score}, not ${brick.pay}`);
  check(drain(game).some((e) => e.name === 'brick'), 'no brick event left the wall');
});

scenario('no tunneling at full pace', () => {
  const game = create(HALF);
  const brick = game.bricks.find((b) => b.y < 150);
  const n = game.bricks.length;
  // a 900 px/s ball crosses a 26 px brick in half a step — substeps must hold
  game.ball = { x: brick.x + 44, y: brick.y + 40, vx: 0, vy: -900 };
  update(game, H, {});
  check(game.bricks.length < n, 'the fast ball went straight through the wall');
});

scenario('the floor costs a ball, the last ball costs the run', () => {
  const game = create(HALF);
  for (let lost = 1; lost <= 3; lost++) {
    game.ball = { x: 480, y: 750, vx: 0, vy: 400 };
    update(game, H, {});
    checkEqual(game.lives, 3 - lost, `ball ${lost} cost the wrong number of lives`);
    check(!game.ball, 'the lost ball plays on');
  }
  check(isOver(game), 'three lost balls did not end the run');
  check(drain(game).some((e) => e.name === 'lose'), 'no lose event left the wall');
});

scenario('clearing the wall deals a faster one', () => {
  const game = create(HALF);
  const slow = ballSpeed(1);
  update(game, H, { fire: true }); // the last brick always falls with a ball up
  game.bricks = [];
  update(game, H, {});
  check(drain(game).some((e) => e.name === 'clear'), 'no clear event left the wall');
  for (let t = 0; t < 2.2; t += H) update(game, H, {});
  checkEqual(game.wave, 2, 'the second wall never came down');
  checkEqual(game.bricks.length, COLS * ROWS, 'the second wall came down short');
  check(ballSpeed(2) > slow, 'the second wall throws the same soft ball');
});

scenario('the paddle respects the walls', () => {
  const game = create(HALF);
  update(game, 10, { left: true });
  check(game.paddleX >= 55 + 8, `the paddle left through the left wall: ${game.paddleX}`);
  update(game, 10, { right: true });
  check(game.paddleX <= 960 - 55 - 8, `the paddle left through the right wall: ${game.paddleX}`);
});

scenario('the whole wall draws without a browser', () => {
  const game = create(HALF);
  update(game, H, { fire: true });
  draw(headlessContext(), game, { time: 1.5, W: 1280, best: 999, banner: 'Onda 2', bannerAlpha: 1 });
});

await run('block breaker');
