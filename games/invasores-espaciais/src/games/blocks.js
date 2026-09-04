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
  };
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

function launch(game) {
  const speed = ballSpeed(game.wave);
  const a = -Math.PI / 2 + (game.rand() - 0.5) * 0.8;
  game.ball = {
    x: game.paddleX,
    y: PADDLE.y - 12,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
  };
  emit(game, 'shoot');
}

export function update(game, h, input = {}) {
  if (game.over) return;
  if (game.clearT > 0) {
    game.clearT -= h;
    if (game.clearT <= 0) {
      game.wave += 1;
      game.bricks = buildWall();
      game.ball = null;
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

    if (b.x < 12) { b.x = 12; b.vx = Math.abs(b.vx); emit(game, 'wall'); }
    if (b.x > PLAY_W - 12) { b.x = PLAY_W - 12; b.vx = -Math.abs(b.vx); emit(game, 'wall'); }
    if (b.y < 56) { b.y = 56; b.vy = Math.abs(b.vy); emit(game, 'wall'); }

    // the paddle: the edge is the aim
    if (b.vy > 0
      && b.y + 6 >= PADDLE.y - PADDLE.h / 2 && b.y - 6 <= PADDLE.y + PADDLE.h / 2
      && Math.abs(b.x - game.paddleX) <= PADDLE.w / 2 + 6) {
      const off = Math.max(-1, Math.min(1, (b.x - game.paddleX) / (PADDLE.w / 2)));
      const speed = Math.hypot(b.vx, b.vy);
      const a = -Math.PI / 2 + off * 1.05;
      b.vx = Math.cos(a) * speed;
      b.vy = Math.sin(a) * speed;
      b.y = PADDLE.y - PADDLE.h / 2 - 7;
      emit(game, 'paddle');
    }

    // bricks: reflect on the dominant axis and take exactly one
    for (let k = 0; k < game.bricks.length; k++) {
      const br = game.bricks[k];
      const cx = Math.max(br.x, Math.min(b.x, br.x + BRICK_W));
      const cy = Math.max(br.y, Math.min(b.y, br.y + BRICK_H));
      if (Math.hypot(b.x - cx, b.y - cy) < 7) {
        const overlapX = Math.min(b.x + 7 - br.x, br.x + BRICK_W - (b.x - 7));
        const overlapY = Math.min(b.y + 7 - br.y, br.y + BRICK_H - (b.y - 7));
        if (overlapX < overlapY) b.vx *= -1;
        else b.vy *= -1;
        game.bricks.splice(k, 1);
        game.score += br.pay;
        emit(game, 'brick');
        break;
      }
    }
  }

  if (b.y > 720 + 20) {
    game.lives -= 1;
    game.ball = null;
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
    }
    // the paddle
    ctx.fillStyle = '#7dff8a';
    ctx.fillRect(game.paddleX - PADDLE.w / 2, PADDLE.y - PADDLE.h / 2, PADDLE.w, PADDLE.h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(game.paddleX - PADDLE.w / 2, PADDLE.y - PADDLE.h / 2, PADDLE.w, 3);
    // the ball, or its ghost waiting on the paddle
    const bx = game.ball ? game.ball.x : game.paddleX;
    const by = game.ball ? game.ball.y : PADDLE.y - 12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fill();
    // lives under the floor line
    for (let i = 0; i < game.lives; i++) {
      ctx.fillStyle = '#7dff8a';
      ctx.fillRect(24 + i * 26, 690, 18, 5);
    }
  });
  banner(ctx, view.W, view.banner, view.bannerAlpha);
}
