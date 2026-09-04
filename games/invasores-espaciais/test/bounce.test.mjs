// Neon Bounce, played in Node: the serve, the return, the jackpot, the miss,
// the stall fix, fairness (perfect vs lazy, machine miss curve), and the juice.

import { scenario, check, checkEqual, headlessContext, run } from 'slopkit/testing';

import {
  ballSpeed, CPU_SPEED, CPU_ERR, MIN_ANGLE, create, update, drain, isOver, draw,
} from '../src/games/bounce.js';
import { PLAY_W, H as GAME_H } from '../src/config.js';

const H = 1 / 60;
const HALF = () => 0.5;
const PADDLE_TOP = 48 + 60; // PADDLE_H / 2 + 60: the paddle never climbs into the HUD
const PADDLE_BOTTOM = GAME_H - 48 - 8;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function served(rand = HALF) {
  const game = create(rand);
  for (let t = 0; t < 1.2; t += H) update(game, H, {});
  return game;
}

// One dead-center flat ball into a parked paddle; the rally must count it.
function bounceOnce(game, side) {
  const y = side < 0 ? game.playerY : game.cpuY;
  const speed = ballSpeed(game.rally);
  game.ball = side < 0
    ? { x: 80, y, vx: -speed, vy: 0 }
    : { x: PLAY_W - 80, y, vx: speed, vy: 0 };
  const before = game.rally;
  for (let t = 0; t < 1 && game.rally === before && game.ball; t += H) update(game, H, {});
  return game.rally > before;
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

scenario('a dead-center return still climbs — no flat rally can stall', () => {
  const game = served();
  check(bounceOnce(game, -1), 'the parked paddle missed a ball at its own center');
  const speed = Math.hypot(game.ball.vx, game.ball.vy);
  const slope = Math.abs(game.ball.vy) / speed;
  check(game.ball.vx > 0, 'the return did not come back');
  check(slope >= Math.sin(MIN_ANGLE) - 1e-6,
    `center hit left at ${(Math.asin(slope) * 180 / Math.PI).toFixed(1)}°, below the floor`);
  check(game.ball.vy !== 0, 'vy came back exactly zero: the next rally stalls flat');
});

scenario('four parked-center hits inject a steep angle', () => {
  const game = served();
  let side = -1;
  for (let hit = 1; hit <= 4; hit++) {
    check(bounceOnce(game, side), `flat hit ${hit} missed a parked paddle`);
    side = -side;
  }
  const speed = Math.hypot(game.ball.vx, game.ball.vy);
  const slope = Math.abs(game.ball.vy) / speed;
  check(slope >= Math.sin(0.35) - 1e-6,
    `after four flat hits the angle is ${(Math.asin(slope) * 180 / Math.PI).toFixed(1)}°, no injection`);
  checkEqual(game.flat, 0, 'the stall counter did not reset after injecting');
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

scenario('a perfect player jackpots sometimes', () => {
  // the paddle tracks the ball exactly: only the machine can end the rally,
  // so any jackpot here is the machine beaten fair and square
  let jackpots = 0;
  let returns = 0;
  let scoringSeeds = 0;
  for (let s = 1; s <= 8; s++) {
    const game = create(mulberry(s * 7919));
    let seedJackpots = 0;
    for (let t = 0; t < 120; t += H) {
      if (isOver(game)) break;
      if (game.ball) game.playerY = Math.max(PADDLE_TOP, Math.min(PADDLE_BOTTOM, game.ball.y));
      update(game, H, {});
      for (const e of drain(game)) {
        if (e.name === 'goal') { jackpots++; seedJackpots++; }
        if (e.name === 'rally') returns++;
      }
    }
    if (seedJackpots > 0) scoringSeeds++;
  }
  check(returns > 100, `perfect play barely rallied (${returns} returns)`);
  check(jackpots >= 4, `perfect over 16 minutes took ${jackpots} jackpots: the machine never misses`);
  check(scoringSeeds >= 3, `only ${scoringSeeds}/8 tables paid a jackpot: wins never breathe`);
});

scenario('a lazy player loses the run', () => {
  // the paddle never moves: the table must take all three lives
  for (let s = 1; s <= 8; s++) {
    const game = create(mulberry(s * 7919));
    for (let t = 0; t < 90 && !isOver(game); t += H) update(game, H, {});
    check(isOver(game), `seed ${s}: standing still survived`);
    checkEqual(game.lives, 0, `seed ${s}: standing still kept ${game.lives} lives`);
  }
});

scenario('the machine misses sometimes early, and more at the cap', () => {
  // perfect teleport over 8 tables: every jackpot is the machine beaten, and
  // the rally it fell at says which pace. Winnable early, lethal late means
  // jackpots at every pace, weighted to the fast end.
  const atGoal = [];
  for (let s = 1; s <= 8; s++) {
    const game = create(mulberry(s * 7919));
    for (let t = 0; t < 120; t += H) {
      if (isOver(game)) break;
      if (game.ball) game.playerY = Math.max(PADDLE_TOP, Math.min(PADDLE_BOTTOM, game.ball.y));
      const rally = game.rally;
      update(game, H, {});
      for (const e of drain(game)) if (e.name === 'goal') atGoal.push(rally);
    }
  }
  const low = atGoal.filter((r) => r < 15).length;
  const high = atGoal.filter((r) => r >= 35).length;
  check(atGoal.length >= 4, `16 minutes of perfect play took ${atGoal.length} jackpots: never winnable`);
  check(low >= 1, 'no jackpot fell before rally 15: nothing winnable early');
  check(high > low, `jackpots cluster low (${low}) not late (${high}): the cap is not lethal`);
});

scenario('no serve insta-scores on either side', () => {
  for (const dir of [1, -1]) {
    for (let s = 0; s < 4; s++) {
      const game = create(mulberry(100 + s));
      game.serveDir = dir;
      game.serveT = 0.001;
      update(game, H, {});
      check(game.ball, `serve ${dir} never left the hand`);
      let returned = false;
      let insta = false;
      for (let t = 0; t < 4 && game.ball && !returned && !insta; t += H) {
        if (game.ball) game.playerY = Math.max(PADDLE_TOP, Math.min(PADDLE_BOTTOM, game.ball.y));
        update(game, H, {});
        for (const e of drain(game)) {
          if (e.name === 'rally' || e.name === 'paddle') returned = true;
          if (e.name === 'goal' || e.name === 'boom' || e.name === 'lose') insta = true;
        }
      }
      check(returned, `serve ${dir} (seed ${s}) scored untouched past a tracking paddle`);
      check(!insta, `serve ${dir} (seed ${s}) ended the point before a paddle met it`);
    }
  }
});

scenario('the paddle covers the table but stays under the HUD', () => {
  const game = served();
  // the clamps engage no matter how far off-table the finger asks for
  for (let t = 0; t < 1; t += H) update(game, H, { targetY: -9999 });
  checkEqual(game.playerY, PADDLE_TOP, `the paddle climbed to ${game.playerY}, into the HUD`);
  for (let t = 0; t < 1.5; t += H) update(game, H, { targetY: 9999 });
  checkEqual(game.playerY, PADDLE_BOTTOM, `the paddle sank to ${game.playerY}, past the floor`);
  // touch-drag (460 × 1.6) crosses the whole lane inside one slow-ball crossing
  game.playerY = PADDLE_BOTTOM;
  let arrived = 0;
  for (let t = 0; t < 0.9; t += H) {
    update(game, H, { targetY: PADDLE_TOP });
    if (game.playerY === PADDLE_TOP) { arrived = t + H; break; }
  }
  check(arrived > 0, 'drag could not cross its own lane in 0.9 s');
  // keys (460) get there too, a beat later — lethal late, playable early
  game.playerY = PADDLE_BOTTOM;
  arrived = 0;
  for (let t = 0; t < 1.4; t += H) {
    update(game, H, { up: true });
    if (game.playerY === PADDLE_TOP) { arrived = t + H; break; }
  }
  check(arrived > 0, 'keys could not climb the lane in 1.4 s');
});

scenario('the rally sets the pace, up to the cap', () => {
  check(ballSpeed(30) > ballSpeed(0), 'a long rally plays the same soft ball');
  check(ballSpeed(100000) <= 920, 'the pace broke its own cap');
});

scenario('the machine reads with a fixed error, so long rallies end', () => {
  const game = served();
  check(Math.abs(game.cpuErr) <= CPU_ERR, `the machine sees too well: ${game.cpuErr}`);
  // at the cap the ball covers nearly 3× the machine's stride per frame,
  // so a rally that never ends is not on the menu
  check(ballSpeed(100000) > CPU_SPEED * 2, 'the cap never outruns the machine');
});

scenario('returns flash, jackpots party, last life burns — all as sim data', () => {
  const game = served();
  game.ball = { x: 70, y: game.playerY, vx: -400, vy: 0 };
  for (let t = 0; t < 0.5 && game.ball.vx < 0; t += H) update(game, H, {});
  check(game.flash > 0, 'no hit flash clock after a return');
  check(game.stretchL > 0, 'no paddle stretch clock after a return');
  check(game.pacePulse > 0, 'no pace pop clock after a return');
  check(game.trail.length > 0, 'no ball trail recorded while live');
  check(game.parts.length > 0, 'no return sparks left the paddle');

  game.ball = { x: PLAY_W + 21, y: 300, vx: 400, vy: 0 };
  update(game, H, {});
  check(game.party > 0, 'no celebration clock after a jackpot');
  check(game.parts.length >= 20, `the jackpot burst too small: ${game.parts.length} sparks`);

  // the clocks run down on their own, through the same fixed step
  for (let t = 0; t < 2; t += H) update(game, H, {});
  check(game.flash <= 0 && game.party <= 0, 'juice clocks never decayed');

  // every state draws without a browser: rally pop, celebration, last life
  game.pacePulse = 0.3;
  game.party = 1.0;
  draw(headlessContext(), game, { time: 1.5, W: 1280, best: 999, banner: '', bannerAlpha: 0 });
  game.party = 0;
  game.lives = 1;
  game.ball = { x: PLAY_W / 2, y: 300, vx: 400, vy: 100 };
  game.trail.push({ x: game.ball.x, y: game.ball.y });
  game.flash = 0.1;
  draw(headlessContext(), game, { time: 1.5, W: 1280, best: 999, banner: '', bannerAlpha: 0 });
});

scenario('the whole table draws without a browser', () => {
  const game = served();
  draw(headlessContext(), game, { time: 1.5, W: 1280, best: 999, banner: '', bannerAlpha: 0 });
});

await run('neon bounce');
