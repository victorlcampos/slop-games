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
  // dead center refuses the groove: a small lean instead of straight up
  game.ball = { x: game.paddleX, y: 630, vx: 0, vy: 300 };
  update(game, H, {});
  check(game.ball.vx !== 0, 'dead center left at exactly 90° — the eternal groove');
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

scenario('fire-and-freeze cannot grind forever', () => {
  const game = create(HALF);
  for (let t = 0; t < 360; t += H) update(game, H, { fire: true });
  check(game.lives < 3 || game.score === 0, 'a frozen paddle survives and scores untouched');
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

scenario('every bounce leaves a minimum vertical bite, at constant speed', () => {
  const speedOf = (b) => Math.hypot(b.vx, b.vy);
  // until one of these events, or give up after cap frames
  const until = (game, name, cap) => {
    for (let i = 0; i < cap; i++) {
      update(game, H, {});
      if (drain(game).some((e) => e.name === name)) return true;
    }
    return false;
  };
  // side wall with a nearly horizontal ball
  {
    const game = create(HALF);
    update(game, H, { fire: true });
    game.bricks = game.bricks.filter((b) => b.y > 250); // open sky
    const s0 = Math.hypot(380, 18);
    game.ball = { x: 30, y: 400, vx: -380, vy: 18 };
    check(until(game, 'wall', 10), 'the shallow ball never reached the left wall');
    const b = game.ball;
    check(b.vx > 0, 'the left wall did not turn the ball around');
    check(Math.abs(b.vy) / speedOf(b) >= 0.3 - 1e-9, `the wall left a dead angle: vy=${b.vy.toFixed(1)}`);
    check(Math.abs(speedOf(b) - s0) / s0 < 0.01, `the wall changed the pace: ${s0.toFixed(0)} -> ${speedOf(b).toFixed(0)}`);
  }
  // the lid with a nearly horizontal ball
  {
    const game = create(HALF);
    update(game, H, { fire: true });
    game.bricks = game.bricks.filter((b) => b.y > 250);
    const s0 = Math.hypot(380, 18);
    game.ball = { x: 480, y: 70, vx: 380, vy: -18 };
    check(until(game, 'wall', 60), 'the shallow ball never reached the lid');
    const b = game.ball;
    check(b.vy > 0, 'the lid did not send the ball back down');
    check(Math.abs(b.vy) / speedOf(b) >= 0.3 - 1e-9, `the lid left a dead angle: vy=${b.vy.toFixed(1)}`);
    check(Math.abs(speedOf(b) - s0) / s0 < 0.01, `the lid changed the pace: ${s0.toFixed(0)} -> ${speedOf(b).toFixed(0)}`);
  }
  // a brick side grazed at full pace keeps its bite too
  {
    const game = create(HALF);
    update(game, H, { fire: true });
    const brick = game.bricks.find((b) => b.y < 150);
    game.bricks = game.bricks.filter((b) => b === brick);
    const s0 = Math.hypot(400, 15);
    game.ball = { x: brick.x - 20, y: brick.y + 13, vx: 400, vy: 15 };
    check(until(game, 'brick', 10), 'the fast ball never reached the brick side');
    const b = game.ball;
    check(Math.abs(b.vy) / speedOf(b) >= 0.3 - 1e-9, `the brick side left a dead angle: vy=${b.vy.toFixed(1)}`);
    check(Math.abs(speedOf(b) - s0) / s0 < 0.01, `the brick changed the pace: ${s0.toFixed(0)} -> ${speedOf(b).toFixed(0)}`);
  }
});

scenario('a shallow ball comes back down instead of looping forever', () => {
  const game = create(HALF);
  update(game, H, { fire: true });
  game.bricks = game.bricks.filter((b) => b.y > 250); // open sky above
  game.ball = { x: 480, y: 300, vx: 420, vy: 25 };
  let minY = Infinity;
  for (let t = 0; t < 2; t += H) {
    update(game, H, {});
    if (!game.ball) break;
    minY = Math.min(minY, game.ball.y);
  }
  check(game.ball, 'the shallow ball died instead of recovering');
  check(
    Math.abs(game.ball.vy) / Math.hypot(game.ball.vx, game.ball.vy) >= 0.3 - 1e-9,
    `two seconds of walls never gave the ball a bite: vy=${game.ball.vy.toFixed(1)}`,
  );
});

scenario('a stalled ball gets nudged, productive play resets the clock', () => {
  // the nudge: window about to close, y-range stalled tight
  {
    const game = create(HALF);
    update(game, H, { fire: true });
    game.bricks = game.bricks.filter((b) => b.y > 400);
    const s0 = Math.hypot(300, 200);
    game.ball = { x: 480, y: 500, vx: 300, vy: 200 };
    game.loopT = 2.9;
    game.loopMin = 500;
    game.loopMax = 500;
    for (let i = 0; i < 12; i++) update(game, H, {});
    const b = game.ball;
    const s1 = Math.hypot(b.vx, b.vy);
    check(Math.abs(b.vy) / s1 >= 0.55 - 1e-9, `the stalled ball was not nudged: vy=${b.vy.toFixed(1)}`);
    check(Math.abs(s1 - s0) / s0 < 0.01, `the nudge changed the pace: ${s0.toFixed(0)} -> ${s1.toFixed(0)}`);
  }
  // the reset: a brick falling with the clock nearly out starts it over
  {
    const game = create(HALF);
    update(game, H, { fire: true });
    const brick = game.bricks[0];
    game.loopT = 2.9;
    game.ball = { x: brick.x + 44, y: brick.y + 13, vx: 0, vy: 0 };
    update(game, H, {});
    check(game.loopT < 1, `a brick fell and the stall clock kept running: ${game.loopT.toFixed(2)}s`);
  }
});

scenario('corner bricks resolve on the side the ball came through', () => {
  // steep onto the top corner: came from above, goes back up
  {
    const game = create(HALF);
    update(game, H, { fire: true });
    const brick = game.bricks.find((b) => b.y < 150);
    game.bricks = game.bricks.filter((b) => b === brick);
    game.ball = { x: brick.x + 2, y: brick.y - 9, vx: 150, vy: 450 };
    update(game, H, {});
    check(game.ball.vy < 0, `the top corner spat the ball down the wall: vy=${game.ball.vy.toFixed(1)}`);
    checkEqual(game.ball.vx, 150, 'the top corner bent a clean drop sideways');
  }
  // fast and nearly horizontal into the corner's left side: came from the
  // left, bounces back left. Min penetration reads the corner tie the other
  // way (it would pop the ball up); first touch was the left face.
  {
    const game = create(HALF);
    update(game, H, { fire: true });
    const brick = game.bricks.filter((b) => b.y < 150)[5];
    game.bricks = game.bricks.filter((b) => b === brick);
    game.ball = { x: brick.x - 9, y: brick.y + 1, vx: 1100, vy: -100 };
    update(game, H, {});
    check(game.ball.vx < 0, `the side corner let the ball through: vx=${game.ball.vx.toFixed(1)}`);
    check(game.ball.vy < 0, `the side corner turned the ball into the wall: vy=${game.ball.vy.toFixed(1)}`);
  }
});

scenario('no tunneling through the paddle at wave pace', () => {
  for (const v of [ballSpeed(8), 1200]) {
    const game = create(HALF);
    update(game, H, { fire: true });
    game.ball = { x: game.paddleX, y: 620, vx: 0, vy: v };
    let caught = false;
    for (let i = 0; i < 10 && !caught; i++) {
      update(game, H, {});
      caught = drain(game).some((e) => e.name === 'paddle');
    }
    check(caught, `a ${v} px/s ball went through the paddle`);
    check(game.ball.vy < 0, `the paddle did not send the ${v} px/s ball back up`);
  }
});

scenario('wave five is still fair on a keyboard', () => {
  // on paper: even the widest paddle edge leaves the ball slower sideways
  // than the keyboard paddle through wave five
  for (let w = 1; w <= 5; w++) {
    const widest = ballSpeed(w) * Math.sin(1.05);
    check(widest < 560, `wave ${w} throws ${widest.toFixed(0)} px/s sideways at a 560 px/s paddle`);
  }
  // in play: a keyboard-capped paddle tracking the intercept loses nothing
  // in thirty seconds from wave five, with a fixed seed
  let s = 7;
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const game = create(rand);
  game.wave = 5;
  update(game, H, { fire: true });
  for (let t = 0; t < 30 && !isOver(game); t += H) {
    if (!game.ball && game.clearT <= 0) {
      update(game, H, { fire: true });
      continue;
    }
    const b = game.ball;
    let input = {};
    if (b) {
      let target = 480;
      if (b.vy > 0) {
        const tHit = (648 - b.y) / b.vy;
        target = tHit > 0 ? b.x + b.vx * tHit : b.x;
        target = Math.max(63, Math.min(897, target));
      }
      const d = target - game.paddleX;
      input = d > 4 ? { right: true } : d < -4 ? { left: true } : {};
    }
    update(game, H, input);
  }
  checkEqual(game.lives, 3, `wave five cost a keyboard player ${3 - game.lives} balls in 30 s`);
});

scenario('hits feel crunchy: sparks, squash, trail, and the loss stings', () => {
  const game = create(HALF);
  update(game, H, { fire: true });
  // a brick throws sparks in its own colour, and they fall and fade
  const brick = game.bricks[0];
  game.ball = { x: brick.x + 44, y: brick.y + 13, vx: 0, vy: -200 };
  update(game, H, {});
  check(game.particles.length > 0, 'the broken brick threw no sparks');
  check(
    game.particles.every((p) => p.colour === brick.colour && p.life > 0),
    'the sparks carry the wrong colour or arrived dead',
  );
  const falling = game.particles.map((p) => p.vy);
  update(game, H, {});
  check(
    game.particles.every((p, i) => p.vy > falling[i]),
    'gravity does not pull every spark down between frames',
  );
  // the paddle squashes on impact and relaxes back
  game.ball = { x: game.paddleX, y: 630, vx: 0, vy: 300 };
  update(game, H, {});
  check(game.squashT > 0, 'the paddle did not squash on impact');
  // the ball drags a trail behind it
  check(game.trail.length > 0, 'the ball flies with no trail');
  // losing the ball stings, bursts white, and clears the trail
  game.ball = { x: 480, y: 750, vx: 0, vy: 400 };
  update(game, H, {});
  check(game.hurtT > 0, 'the lost ball left no sting');
  check(game.particles.length > 0, 'the lost ball burst into nothing');
  checkEqual(game.trail.length, 0, 'the lost ball drags its trail into the wait');
  // a second of quiet settles everything visual back to zero
  for (let t = 0; t < 1; t += H) update(game, H, {});
  checkEqual(game.particles.length, 0, 'the sparks never faded');
  checkEqual(game.squashT, 0, 'the paddle stayed squashed');
  checkEqual(game.hurtT, 0, 'the sting never faded');
  // every visual state still draws without a browser
  draw(headlessContext(), game, { time: 2.5, W: 1280, best: 0, banner: '', bannerAlpha: 0 });
  game.clearT = 1;
  draw(headlessContext(), game, { time: 2.5, W: 1280, best: 0, banner: 'Onda 1', bannerAlpha: 1 });
});

await run('block breaker');
