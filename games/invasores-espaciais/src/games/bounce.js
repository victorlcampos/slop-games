// Neon Bounce: you against the machine — return everything.
//
// Score attack, not a match: every return pays, every ball past the machine
// pays the jackpot, and every ball past you costs a life. The rally sets the
// pace, so the longer you last the less time you have.

import { PLAY_W, H } from '../config.js';
import { t } from '../i18n.js';
import { field, hud, banner, makeStars, backdrop } from '../draw.js';

const PADDLE_W = 14;
const PADDLE_H = 96;
const LEFT_X = 48;
const RIGHT_X = PLAY_W - 48;
const PLAYER_SPEED = 460;
export const CPU_SPEED = 330;
const BASE_BALL = 470;
const MAX_BALL = 920;

export function ballSpeed(rally) {
  return Math.min(MAX_BALL, BASE_BALL + rally * 9);
}

export function create(rand = Math.random) {
  const game = {
    rand,
    score: 0,
    lives: 3,
    over: false,
    events: [],
    playerY: H / 2,
    cpuY: H / 2,
    cpuErr: 0,
    ball: null,
    rally: 0,
    serveT: 1,
    serveDir: rand() < 0.5 ? 1 : -1,
  };
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

function serve(game) {
  const speed = ballSpeed(game.rally);
  const a = (game.rand() - 0.5) * 0.7;
  game.ball = {
    x: PLAY_W / 2,
    y: H / 2,
    vx: Math.cos(a) * speed * game.serveDir,
    vy: Math.sin(a) * speed,
  };
  game.cpuErr = (game.rand() * 2 - 1) * 46;
}

function bounceOff(game, paddleY) {
  const b = game.ball;
  const off = Math.max(-1, Math.min(1, (b.y - paddleY) / (PADDLE_H / 2)));
  const speed = ballSpeed(game.rally);
  const dir = b.vx > 0 ? -1 : 1;
  const a = off * 0.96; // the edge is the aim, up to 55°
  b.vx = Math.cos(a) * speed * dir;
  b.vy = Math.sin(a) * speed;
}

export function update(game, h, input = {}) {
  if (game.over) return;

  if (input.targetY !== undefined && input.targetY !== null) {
    const want = Math.max(PADDLE_H / 2 + 60, Math.min(H - PADDLE_H / 2 - 8, input.targetY));
    const d = want - game.playerY;
    game.playerY += Math.max(-PLAYER_SPEED * 1.6 * h, Math.min(PLAYER_SPEED * 1.6 * h, d));
  } else {
    if (input.up) game.playerY -= PLAYER_SPEED * h;
    if (input.down) game.playerY += PLAYER_SPEED * h;
    game.playerY = Math.max(PADDLE_H / 2 + 60, Math.min(H - PADDLE_H / 2 - 8, game.playerY));
  }

  if (!game.ball) {
    game.serveT -= h;
    if (game.serveT <= 0) serve(game);
    else return;
  }

  const b = game.ball;
  // the machine reads the ball with a fixed error and a capped stride
  const want = b.y + game.cpuErr;
  const d = want - game.cpuY;
  game.cpuY += Math.max(-CPU_SPEED * h, Math.min(CPU_SPEED * h, d));
  game.cpuY = Math.max(PADDLE_H / 2 + 60, Math.min(H - PADDLE_H / 2 - 8, game.cpuY));

  const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * h) / 10));
  for (let i = 0; i < steps; i++) {
    const sh = h / steps;
    b.x += b.vx * sh;
    b.y += b.vy * sh;

    if (b.y < 56 + 6) { b.y = 56 + 6; b.vy = Math.abs(b.vy); emit(game, 'wall'); }
    if (b.y > H - 8 - 6) { b.y = H - 8 - 6; b.vy = -Math.abs(b.vy); emit(game, 'wall'); }

    if (b.vx < 0 && b.x - 6 <= LEFT_X + PADDLE_W / 2 && b.x > LEFT_X
      && Math.abs(b.y - game.playerY) <= PADDLE_H / 2 + 6) {
      b.x = LEFT_X + PADDLE_W / 2 + 7;
      bounceOff(game, game.playerY);
      game.rally += 1;
      game.score += 10;
      emit(game, 'rally');
    }
    if (b.vx > 0 && b.x + 6 >= RIGHT_X - PADDLE_W / 2 && b.x < RIGHT_X
      && Math.abs(b.y - game.cpuY) <= PADDLE_H / 2 + 6) {
      b.x = RIGHT_X - PADDLE_W / 2 - 7;
      bounceOff(game, game.cpuY);
      game.rally += 1;
      emit(game, 'paddle');
    }
  }

  if (b.x < -20) {
    game.lives -= 1;
    game.ball = null;
    game.serveT = 1.2;
    game.serveDir = 1;
    game.rally = 0;
    if (game.lives <= 0) {
      game.over = true;
      emit(game, 'lose');
    } else {
      emit(game, 'boom');
    }
  } else if (b.x > PLAY_W + 20) {
    game.score += 100;
    game.ball = null;
    game.serveT = 0.8;
    game.serveDir = -1;
    emit(game, 'goal');
  }
}

const stars = makeStars(1972);

export function draw(ctx, game, view) {
  backdrop(ctx, view.W, view.time, stars);
  hud(ctx, view.W,
    `${t('hud.score')}: ${game.score}`,
    null,
    `${t('hud.best')}: ${view.best}`);
  field(ctx, view.W, () => {
    // the net
    ctx.fillStyle = '#3a4a3f';
    for (let y = 64; y < H - 8; y += 26) ctx.fillRect(PLAY_W / 2 - 3, y, 6, 14);
    // the paddles
    ctx.fillStyle = '#7dff8a';
    ctx.fillRect(LEFT_X - PADDLE_W / 2, game.playerY - PADDLE_H / 2, PADDLE_W, PADDLE_H);
    ctx.fillStyle = '#ff5555';
    ctx.fillRect(RIGHT_X - PADDLE_W / 2, game.cpuY - PADDLE_H / 2, PADDLE_W, PADDLE_H);
    // the ball with a short streak
    if (game.ball) {
      const b = game.ball;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x - b.vx * 0.03 - 4, b.y - b.vy * 0.03 - 4, 8, 8);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.textAlign = 'center';
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.fillStyle = '#9dc4a4';
      ctx.fillText('···', PLAY_W / 2, H / 2);
      ctx.textAlign = 'left';
    }
    // rally pace and lives
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillStyle = '#9dc4a4';
    ctx.textAlign = 'center';
    ctx.fillText(`${game.rally}`, PLAY_W / 2, 84);
    ctx.textAlign = 'left';
    for (let i = 0; i < game.lives; i++) {
      ctx.fillStyle = '#7dff8a';
      ctx.fillRect(24 + i * 26, 690, 18, 5);
    }
  });
  banner(ctx, view.W, view.banner, view.bannerAlpha);
}
