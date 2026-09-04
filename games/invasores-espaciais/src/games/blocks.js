// Block Breaker: one paddle, one ball, and a wall that pays by the row.
//
// The ball leaves the paddle at an angle set by where it lands — the edge is
// the aim. Bricks pay more the higher they sit, and every cleared wall comes
// back faster.

import { PLAY_W } from '../config.js';
import { t } from '../i18n.js';
import { field, hud, banner, makeStars, backdrop } from '../draw.js';

export const COLS = 10;
export const ROWS = 6;
const BRICK_W = 88;
const BRICK_H = 26;
const GAP = 4;
const TOP = 120;
const WALL_W = COLS * (BRICK_W + GAP) - GAP;
const WALL_X = (PLAY_W - WALL_W) / 2;

const PADDLE = { w: 110, h: 16, y: 648, speed: 560 };
const ROW_PAY = [60, 50, 40, 30, 20, 10];
const ROW_COLOUR = ['#ff5555', '#ff9955', '#ffee55', '#55ff88', '#55aaff', '#cc88ff'];

const BALL_R = 7;
// A bounce that leaves the ball nearly horizontal never comes back down:
// walls and bricks only mirror one axis, so a tiny |vy| survives every
// wall-to-wall trip unchanged (a probe ball with vy=25 flew 6 s without
// dropping 150 px). Every bounce below re-asserts this floor and rescales
// vx, so the wave pace is kept and only the dead angle is forbidden.
const MIN_VY_FRAC = 0.3;
// Second net for the same trap: if the ball flies this long without touching
// paddle or brick and its y-range stalls inside this band, steer it back
// into open play. Wall bounces deliberately do NOT reset the window —
// a pure wall-wall-top loop is exactly what this has to catch.
const LOOP_WINDOW = 3;
const LOOP_RANGE = 140;
const NUDGE_VY_FRAC = 0.55;
// Feel, all of it pure numbers in the sim: brick sparks, the ball's trail,
// paddle squash on impact, a red sting on a lost ball.
const MAX_PARTICLES = 240;
const TRAIL_N = 10;
const SQUASH_T = 0.14;
const HURT_T = 0.7;

export function ballSpeed(wave) {
  return 430 + (wave - 1) * 45;
}

function buildWall() {
  const bricks = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      bricks.push({
        x: WALL_X + c * (BRICK_W + GAP),
        y: TOP + r * (BRICK_H + GAP),
        pay: ROW_PAY[r],
        colour: ROW_COLOUR[r],
      });
    }
  }
  return bricks;
}

export function create(rand = Math.random) {
  return {
    wave: 1,
    rand,
    score: 0,
    lives: 3,
    over: false,
    events: [],
    paddleX: PLAY_W / 2,
    ball: null, // stuck until the first fire
    bricks: buildWall(),
    clearT: 0,
    particles: [], // brick sparks: { x, y, vx, vy, life, max, colour }
    trail: [], // last ball positions, oldest first
    squashT: 0, // paddle squash left to draw
    hurtT: 0, // red sting left to draw after a lost ball
    loopT: 0, // unproductive flight since the last paddle/brick touch
    loopMin: 0, // lowest ball y seen inside this window
    loopMax: 0, // highest ball y seen inside this window
  };
}

function emit(game, name, data) {
  game.events.push({ name, ...data });
}

// Minimum vertical bite after a bounce, at constant speed: the wave pace
// never changes, only the dead angle is forbidden. A zero ball (parked
// inside a brick by a test) is left alone — there is no pace to keep.
function enforceVertical(b) {
  const speed = Math.hypot(b.vx, b.vy);
  if (speed <= 0) return;
  const floor = MIN_VY_FRAC * speed;
  if (Math.abs(b.vy) < floor) {
    const sy = b.vy < 0 ? -1 : 1;
    b.vy = sy * floor;
    b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, speed * speed - b.vy * b.vy));
  }
}

// Productive touch: paddle, brick, launch, loss, fresh wall. Everything the
// stall detector forgives starts the window over.
function resetLoopWindow(game) {
  game.loopT = 0;
  game.loopMin = game.ball ? game.ball.y : PADDLE.y - 12;
  game.loopMax = game.loopMin;
}

// Sparks are game.rand all the way down, so a seeded run bursts identically.
function burst(game, x, y, colour, n, power) {
  for (let i = 0; i < n; i++) {
    if (game.particles.length >= MAX_PARTICLES) return;
    const a = game.rand() * Math.PI * 2;
    const sp = (0.3 + game.rand() * 0.7) * power;
    const life = 0.45 + game.rand() * 0.25;
    game.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - power * 0.35,
      life, max: life, colour,
    });
  }
}

// Visual-only state, still pure numbers: sparks fall, timers run down.
// Runs on every path — waiting, celebrating — so nothing freezes mid-flight.
function updateFx(game, h) {
  if (game.squashT > 0) game.squashT = Math.max(0, game.squashT - h);
  if (game.hurtT > 0) game.hurtT = Math.max(0, game.hurtT - h);
  const ps = game.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.vy += 900 * h;
    p.x += p.vx * h;
    p.y += p.vy * h;
    p.life -= h;
    if (p.life <= 0) ps.splice(i, 1);
  }
}

export function drain(game) {
  const out = game.events;
  game.events = [];
  return out;
}

export function isOver(game) {
  return game.over;
}

function launch(game) {
  const speed = ballSpeed(game.wave);
  const a = -Math.PI / 2 + (game.rand() - 0.5) * 0.8;
  game.ball = {
    x: game.paddleX,
    y: PADDLE.y - 12,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
  };
  game.trail.length = 0;
  resetLoopWindow(game);
  emit(game, 'shoot');
}

export function update(game, h, input = {}) {
  if (game.over) return;
  updateFx(game, h);
  if (game.clearT > 0) {
    game.clearT -= h;
    if (game.clearT <= 0) {
      game.wave += 1;
      game.bricks = buildWall();
      game.ball = null;
      game.trail.length = 0;
      resetLoopWindow(game);
      emit(game, 'banner', { text: t('wave.next', { n: game.wave }) });
      emit(game, 'wave');
    }
    return;
  }

  if (input.targetX !== undefined && input.targetX !== null) {
    const want = Math.max(PADDLE.w / 2 + 8, Math.min(PLAY_W - PADDLE.w / 2 - 8, input.targetX));
    const d = want - game.paddleX;
    game.paddleX += Math.max(-PADDLE.speed * 1.5 * h, Math.min(PADDLE.speed * 1.5 * h, d));
  } else {
    if (input.left) game.paddleX -= PADDLE.speed * h;
    if (input.right) game.paddleX += PADDLE.speed * h;
    game.paddleX = Math.max(PADDLE.w / 2 + 8, Math.min(PLAY_W - PADDLE.w / 2 - 8, game.paddleX));
  }

  if (!game.ball) {
    if (input.fire) launch(game);
    return;
  }

  const b = game.ball;
  // substeps: a fast ball must not tunnel a 26 px brick
  const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * h) / 12));
  for (let i = 0; i < steps; i++) {
    const sh = h / steps;
    b.x += b.vx * sh;
    b.y += b.vy * sh;

    if (b.x < 12) { b.x = 12; b.vx = Math.abs(b.vx); enforceVertical(b); emit(game, 'wall'); }
    if (b.x > PLAY_W - 12) { b.x = PLAY_W - 12; b.vx = -Math.abs(b.vx); enforceVertical(b); emit(game, 'wall'); }
    if (b.y < 56) { b.y = 56; b.vy = Math.abs(b.vy); enforceVertical(b); emit(game, 'wall'); }

    // the paddle: the edge is the aim — and dead center refuses to be a groove.
    // A ball leaving at exactly 90° comes back to exactly center, forever: a
    // frozen paddle would clear the wall by itself. Anything inside ±0.08 gets
    // a small random lean instead, so the fixed point cannot hold.
    if (b.vy > 0
      && b.y + 6 >= PADDLE.y - PADDLE.h / 2 && b.y - 6 <= PADDLE.y + PADDLE.h / 2
      && Math.abs(b.x - game.paddleX) <= PADDLE.w / 2 + 6) {
      let off = Math.max(-1, Math.min(1, (b.x - game.paddleX) / (PADDLE.w / 2)));
      if (Math.abs(off) < 0.08) off = (game.rand() < 0.5 ? -1 : 1) * 0.12;
      const speed = Math.hypot(b.vx, b.vy);
      const a = -Math.PI / 2 + off * 1.05;
      b.vx = Math.cos(a) * speed;
      b.vy = Math.sin(a) * speed;
      b.y = PADDLE.y - PADDLE.h / 2 - 7;
      enforceVertical(b);
      game.squashT = SQUASH_T;
      resetLoopWindow(game);
      emit(game, 'paddle');
    }

    // bricks: reflect on the side the ball entered by, and take exactly one.
    // Min penetration is the contact normal, up to the tie-break, so it
    // stays the resolver for corners and for balls already overlapping at
    // the substep start. The entry side only overrules it on a clean
    // single-face entry: a fast ball is detected up to half a substep past
    // first touch, deep enough that the closest face is no longer the one
    // it came through (a near-horizontal ball into a corner reads shallower
    // up than sideways and would wrongly pop up instead of bouncing back).
    // The substep start (px, py) says which face that was.
    for (let k = 0; k < game.bricks.length; k++) {
      const br = game.bricks[k];
      const cx = Math.max(br.x, Math.min(b.x, br.x + BRICK_W));
      const cy = Math.max(br.y, Math.min(b.y, br.y + BRICK_H));
      if (Math.hypot(b.x - cx, b.y - cy) < BALL_R) {
        const px = b.x - b.vx * sh;
        const py = b.y - b.vy * sh;
        const fromTop = py + BALL_R <= br.y && b.vy > 0;
        const fromBottom = py - BALL_R >= br.y + BRICK_H && b.vy < 0;
        const fromLeft = px + BALL_R <= br.x && b.vx > 0;
        const fromRight = px - BALL_R >= br.x + BRICK_W && b.vx < 0;
        const vertical = fromTop || fromBottom;
        const horizontal = fromLeft || fromRight;
        if (vertical !== horizontal) {
          if (vertical) b.vy *= -1;
          else b.vx *= -1;
        } else {
          const overlapX = Math.min(b.x + BALL_R - br.x, br.x + BRICK_W - (b.x - BALL_R));
          const overlapY = Math.min(b.y + BALL_R - br.y, br.y + BRICK_H - (b.y - BALL_R));
          if (overlapX < overlapY) b.vx *= -1;
          else b.vy *= -1;
        }
        enforceVertical(b);
        burst(game, br.x + BRICK_W / 2, br.y + BRICK_H / 2, br.colour, 8, 260);
        resetLoopWindow(game);
        game.bricks.splice(k, 1);
        game.score += br.pay;
        emit(game, 'brick');
        break;
      }
    }
  }

  if (game.ball) {
    game.trail.push({ x: b.x, y: b.y });
    if (game.trail.length > TRAIL_N) game.trail.shift();
    // the stall detector: long flight, nowhere travelled vertically.
    if (b.y < game.loopMin) game.loopMin = b.y;
    if (b.y > game.loopMax) game.loopMax = b.y;
    game.loopT += h;
    if (game.loopT >= LOOP_WINDOW) {
      if (game.loopMax - game.loopMin < LOOP_RANGE) {
        const speed = Math.hypot(b.vx, b.vy);
        if (speed > 0) {
          const sy = b.vy < 0 ? -1 : 1;
          b.vy = sy * NUDGE_VY_FRAC * speed;
          b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, speed * speed - b.vy * b.vy));
        }
      }
      game.loopT = 0;
      game.loopMin = b.y;
      game.loopMax = b.y;
    }
  }

  if (b.y > 720 + 20) {
    game.lives -= 1;
    burst(game, b.x, Math.min(b.y, 706), '#ffffff', 14, 300);
    game.hurtT = HURT_T;
    game.ball = null;
    game.trail.length = 0;
    resetLoopWindow(game);
    if (game.lives <= 0) {
      game.over = true;
      emit(game, 'lose');
    } else {
      emit(game, 'boom');
    }
    return;
  }

  if (game.bricks.length === 0) {
    game.clearT = 2;
    emit(game, 'banner', { text: t('wave.clear', { n: game.wave }) });
    emit(game, 'clear');
  }
}

const stars = makeStars(1976);

export function draw(ctx, game, view) {
  backdrop(ctx, view.W, view.time, stars);
  hud(ctx, view.W,
    `${t('hud.score')}: ${game.score}`,
    `${t('hud.wave')} ${game.wave}`,
    `${t('hud.best')}: ${view.best}`);
  field(ctx, view.W, () => {
    for (const br of game.bricks) {
      ctx.fillStyle = br.colour;
      ctx.fillRect(br.x, br.y, BRICK_W, BRICK_H);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(br.x, br.y, BRICK_W, 4);
      // a shaded foot so the wall reads as stacked, not printed
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(br.x, br.y + BRICK_H - 4, BRICK_W, 4);
    }
    // wave-clear flash: the wall is gone, the field blinks it out
    if (game.clearT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(0.22 * (game.clearT / 2)).toFixed(3)})`;
      ctx.fillRect(12, 56, PLAY_W - 24, 664);
    }
    // brick sparks, oldest dimmest
    for (const p of game.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.colour;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    // the paddle, squashed flat for a blink after every hit
    const sq = Math.max(0, Math.min(1, game.squashT / SQUASH_T));
    const pw = PADDLE.w * (1 + 0.3 * sq);
    const ph = PADDLE.h * (1 - 0.4 * sq);
    const py = PADDLE.y + PADDLE.h / 2 - ph;
    ctx.fillStyle = '#7dff8a';
    ctx.fillRect(game.paddleX - pw / 2, py, pw, ph);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(game.paddleX - pw / 2, py, pw, 3);
    // the ball's trail, newest brightest
    const trail = game.trail;
    for (let i = 0; i < trail.length; i++) {
      const f = (i + 1) / trail.length;
      ctx.fillStyle = `rgba(255,255,255,${(0.22 * f).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, 2 + 4 * f, 0, Math.PI * 2);
      ctx.fill();
    }
    // the ball, or its ghost waiting on the paddle — pulsing, so the wait
    // reads as "press fire" instead of a stuck frame
    const bx = game.ball ? game.ball.x : game.paddleX;
    const by = game.ball ? game.ball.y : PADDLE.y - 12;
    if (game.ball || (!game.over && game.clearT <= 0)) {
      ctx.globalAlpha = game.ball ? 1 : 0.45 + 0.3 * Math.sin(view.time * 6);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // lost ball: a red sting along the floor while the sting lasts
    if (game.hurtT > 0) {
      ctx.fillStyle = `rgba(255,60,60,${(0.3 * (game.hurtT / HURT_T)).toFixed(3)})`;
      ctx.fillRect(12, 664, PLAY_W - 24, 56);
    }
    // lives under the floor line
    for (let i = 0; i < game.lives; i++) {
      ctx.fillStyle = '#7dff8a';
      ctx.fillRect(24 + i * 26, 690, 18, 5);
    }
  });
  banner(ctx, view.W, view.banner, view.bannerAlpha);
}
