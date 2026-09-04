// Neon Bounce, played in Node: the serve, the return, the jackpot, the miss.

import { scenario, check, checkEqual, headlessContext, run } from 'slopkit/testing';

import {
  ballSpeed, CPU_SPEED, create, update, drain, isOver, draw,
} from '../src/games/bounce.js';
import { PLAY_W } from '../src/config.js';

const H = 1 / 60;
const HALF = () => 0.5;

function served() {
  const game = create(HALF);
  for (let t = 0; t < 1.2; t += H) update(game, H, {});
  return game;
}

scenario('the serve comes from the middle, moving', () => {
  const game = served();
  check(game.ball, 'no serve after the countdown');
  check(Math.abs(game.ball.x - PLAY_W / 2) < 200, 'the serve starts off-center');
  check(game.ball.vx !== 0, 'the serve hangs still');
});

scenario('the paddle returns, and the edge aims', () => {
  const game = served();
  // dead center comes straight back — give the ball the steps to arrive
  game.ball = { x: 70, y: game.playerY, vx: -400, vy: 0 };
  for (let t = 0; t < 0.5 && game.ball.vx < 0; t += H) update(game, H, {});
  check(game.ball.vx > 0, 'the paddle did not send it back');
  checkEqual(game.rally, 1, 'the return was not counted');
  checkEqual(game.score, 10, `the return paid ${game.score}, not 10`);
  check(drain(game).some((e) => e.name === 'rally'), 'no rally event left the table');

  // the top edge sends it climbing
  game.ball = { x: 70, y: game.playerY - 40, vx: -400, vy: 0 };
  for (let t = 0; t < 0.5 && game.ball.vx < 0; t += H) update(game, H, {});
  check(game.ball.vy < -50, 'the top edge did not aim up');
});

scenario('past the machine pays the jackpot', () => {
  const game = served();
  const score = game.score;
  game.ball = { x: PLAY_W + 21, y: 300, vx: 400, vy: 0 };
  update(game, H, {});
  check(!game.ball, 'the jackpot ball plays on');
  checkEqual(game.score, score + 100, `the jackpot paid ${game.score - score}, not 100`);
  check(drain(game).some((e) => e.name === 'goal'), 'no goal event left the table');
});

scenario('past you costs a life, three cost the run', () => {
  const game = served();
  for (let miss = 1; miss <= 3; miss++) {
    game.ball = { x: -21, y: 300, vx: -400, vy: 0 };
    update(game, H, {});
    checkEqual(game.lives, 3 - miss, `miss ${miss} cost the wrong number of lives`);
    check(!game.ball, 'the missed ball plays on');
  }
  check(isOver(game), 'three misses did not end the run');
  check(drain(game).some((e) => e.name === 'lose'), 'no lose event left the table');
});

scenario('the rally sets the pace, up to the cap', () => {
  check(ballSpeed(30) > ballSpeed(0), 'a long rally plays the same soft ball');
  check(ballSpeed(100000) <= 920, 'the pace broke its own cap');
});

scenario('the machine reads with a fixed error, so long rallies end', () => {
  const game = served();
  check(Math.abs(game.cpuErr) <= 46, `the machine sees too well: ${game.cpuErr}`);
  // at the cap the ball covers nearly 3× the machine's stride per frame,
  // so a rally that never ends is not on the menu
  check(ballSpeed(100000) > CPU_SPEED * 2, 'the cap never outruns the machine');
});

scenario('the whole table draws without a browser', () => {
  const game = served();
  draw(headlessContext(), game, { time: 1.5, W: 1280, best: 999, banner: '', bannerAlpha: 0 });
});

await run('neon bounce');
