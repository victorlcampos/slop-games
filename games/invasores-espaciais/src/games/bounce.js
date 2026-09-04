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
export const CPU_SPEED = 300;
export const CPU_ERR = 64;
const BASE_BALL = 470;
const MAX_BALL = 920;
// A dead-center return must still climb: below ~9 degrees a rally can go
// paddle-to-paddle forever with both sides parked, and read as a freeze.
export const MIN_ANGLE = 0.16;
// Consecutive near-center hits before the table injects an angle itself.
const FLAT_OFF = 0.15;
const STALL_HITS = 4;

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
    flat: 0, // consecutive near-center paddle hits (the stall detector)
    flash: 0, // hit-flash clock, with flashX/flashY where it landed
    flashX: 0,
    flashY: H / 2,
    stretchL: 0, // paddle-stretch clocks, one per side
    stretchR: 0,
    pacePulse: 0, // rally-readout pop clock, reset on every return
    party: 0, // jackpot-celebration clock
    trail: [], // recent ball positions, oldest first (sim data, drawn faded)
    parts: [], // celebration/debris sparks {x,y,vx,vy,life,max}
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
  game.cpuErr = (game.rand() * 2 - 1) * CPU_ERR;
}

function burst(game, x, y, n, speed) {
  for (let i = 0; i < n; i++) {
    if (game.parts.length >= 120) return;
    const a = game.rand() * Math.PI * 2;
    const v = speed * (0.4 + game.rand() * 0.8);
    game.parts.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0.5 + game.rand() * 0.5,
      max: 1,
    });
  }
}

function bounceOff(game, paddleY) {
  const b = game.ball;
  const off = Math.max(-1, Math.min(1, (b.y - paddleY) / (PADDLE_H / 2)));
  const speed = ballSpeed(game.rally);
  const dir = b.vx > 0 ? -1 : 1;
  let a = off * 0.96; // the edge is the aim, up to 55°
  if (Math.abs(a) < MIN_ANGLE) {
    // keep the outgoing side it already had so the fix never reverses play
    const sign = a !== 0 ? Math.sign(a) : (b.vy !== 0 ? Math.sign(b.vy) : (game.rand() < 0.5 ? -1 : 1));
    a = MIN_ANGLE * sign;
  }
  if (Math.abs(off) < FLAT_OFF) {
    game.flat += 1;
    if (game.flat >= STALL_HITS) {
      // both sides parked mid-paddle: open the angle so the rally has to move
      game.flat = 0;
      const sign = b.vy !== 0 ? Math.sign(b.vy) : (game.rand() < 0.5 ? -1 : 1);
      a = (0.35 + game.rand() * 0.25) * sign;
    }
  } else {
    game.flat = 0;
  }
  b.vx = Math.cos(a) * speed * dir;
  b.vy = Math.sin(a) * speed;
}

export function update(game, h, input = {}) {
  if (game.over) return;

  // juice clocks tick even between serves so celebrations outlive the ball
  if (game.flash > 0) game.flash -= h;
  if (game.stretchL > 0) game.stretchL -= h;
  if (game.stretchR > 0) game.stretchR -= h;
  if (game.pacePulse > 0) game.pacePulse -= h;
  if (game.party > 0) game.party -= h;
  for (let i = game.parts.length - 1; i >= 0; i--) {
    const p = game.parts[i];
    p.life -= h;
    if (p.life <= 0) { game.parts.splice(i, 1); continue; }
    p.x += p.vx * h;
    p.y += p.vy * h;
    p.vy += 320 * h; // a light gravity so sparks arc and fall
  }

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
  game.trail.push({ x: b.x, y: b.y });
  if (game.trail.length > 14) game.trail.shift();
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
      game.flash = 0.14;
      game.flashX = b.x;
      game.flashY = b.y;
      game.stretchL = 0.2;
      game.pacePulse = 0.3;
      burst(game, b.x + 8, b.y, 3, 160);
      emit(game, 'rally');
    }
    if (b.vx > 0 && b.x + 6 >= RIGHT_X - PADDLE_W / 2 && b.x < RIGHT_X
      && Math.abs(b.y - game.cpuY) <= PADDLE_H / 2 + 6) {
      b.x = RIGHT_X - PADDLE_W / 2 - 7;
      bounceOff(game, game.cpuY);
      game.rally += 1;
      game.flash = 0.14;
      game.flashX = b.x;
      game.flashY = b.y;
      game.stretchR = 0.2;
      game.pacePulse = 0.3;
      burst(game, b.x - 8, b.y, 3, 160);
      emit(game, 'paddle');
    }
  }

  if (b.x < -20) {
    game.lives -= 1;
    game.ball = null;
    game.trail.length = 0;
    game.flat = 0;
    game.serveT = 1.2;
    game.serveDir = 1;
    game.rally = 0;
    burst(game, 60, Math.max(108, Math.min(H - 16, b.y)), 16, 260);
    if (game.lives <= 0) {
      game.over = true;
      emit(game, 'lose');
    } else {
      emit(game, 'boom');
    }
  } else if (b.x > PLAY_W + 20) {
    game.score += 100;
    game.ball = null;
    game.trail.length = 0;
    game.flat = 0;
    game.party = 1.4;
    game.pacePulse = 0.6;
    game.serveT = 0.8;
    game.serveDir = -1;
    burst(game, PLAY_W - 60, Math.max(108, Math.min(H - 16, b.y)), 26, 340);
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
    const danger = game.lives === 1 && !game.over;
    // the net
    ctx.fillStyle = '#3a4a3f';
    for (let y = 64; y < H - 8; y += 26) ctx.fillRect(PLAY_W / 2 - 3, y, 6, 14);
    // celebration sparks and return chips, oldest first
    for (const p of game.parts) {
      ctx.fillStyle = `rgba(255,215,94,${Math.max(0, p.life).toFixed(3)})`;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    // the paddles, stretching a beat on every return they make
    const growL = game.stretchL > 0 ? 1 + (game.stretchL / 0.2) * 0.28 : 1;
    const growR = game.stretchR > 0 ? 1 + (game.stretchR / 0.2) * 0.28 : 1;
    if (game.stretchL > 0) {
      ctx.fillStyle = 'rgba(125,255,138,0.3)';
      ctx.fillRect(LEFT_X - PADDLE_W / 2 - 5, game.playerY - (PADDLE_H * growL) / 2 - 5,
        PADDLE_W + 10, PADDLE_H * growL + 10);
    }
    if (game.stretchR > 0) {
      ctx.fillStyle = 'rgba(255,85,85,0.3)';
      ctx.fillRect(RIGHT_X - PADDLE_W / 2 - 5, game.cpuY - (PADDLE_H * growR) / 2 - 5,
        PADDLE_W + 10, PADDLE_H * growR + 10);
    }
    ctx.fillStyle = '#7dff8a';
    ctx.fillRect(LEFT_X - PADDLE_W / 2, game.playerY - (PADDLE_H * growL) / 2, PADDLE_W, PADDLE_H * growL);
    ctx.fillStyle = '#ff5555';
    ctx.fillRect(RIGHT_X - PADDLE_W / 2, game.cpuY - (PADDLE_H * growR) / 2, PADDLE_W, PADDLE_H * growR);
    // the hit flash: a ring that opens where the ball left the paddle
    if (game.flash > 0) {
      const k = 1 - game.flash / 0.14;
      ctx.strokeStyle = `rgba(255,255,255,${(1 - k).toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(game.flashX, game.flashY, 8 + k * 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    // the ball with its streak: last life tints it red
    if (game.ball) {
      const b = game.ball;
      for (let i = 0; i < game.trail.length; i++) {
        const tp = game.trail[i];
        const a = ((i + 1) / game.trail.length) * 0.3;
        ctx.fillStyle = danger
          ? `rgba(255,107,107,${a.toFixed(3)})`
          : `rgba(255,255,255,${a.toFixed(3)})`;
        const r = 3 + (i / Math.max(1, game.trail.length)) * 4;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = danger ? '#ff6b6b' : '#ffffff';
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
    // rally pace, centered: it pops on every return and warms as the ball does
    const pop = game.pacePulse > 0 ? Math.min(1, game.pacePulse / 0.3) : 0;
    const paceColor = game.rally >= 35 ? '#ff8a5e' : game.rally >= 15 ? '#ffd75e' : '#9dc4a4';
    ctx.font = `700 ${Math.round(18 + pop * 12 + Math.min(6, game.rally * 0.15))}px system-ui, sans-serif`;
    ctx.fillStyle = game.party > 0 ? '#ffd75e' : paceColor;
    ctx.textAlign = 'center';
    ctx.fillText(`${game.rally}`, PLAY_W / 2, 84);
    ctx.textAlign = 'left';
    for (let i = 0; i < game.lives; i++) {
      ctx.fillStyle = danger && Math.sin(view.time * 6) > 0 ? '#ff6b6b' : '#7dff8a';
      ctx.fillRect(24 + i * 26, 690, 18, 5);
    }
    // last-life tension: the edges breathe red while the ball is live
    if (danger && game.ball) {
      const a = 0.18 + 0.14 * Math.sin(view.time * 6);
      ctx.fillStyle = `rgba(255,60,60,${a.toFixed(3)})`;
      ctx.fillRect(8, 56, 5, H - 64);
      ctx.fillRect(PLAY_W - 13, 56, 5, H - 64);
    }
    // jackpot celebration: a short full-table wash behind everything above
    if (game.party > 0) {
      ctx.fillStyle = `rgba(255,215,94,${(0.1 * Math.min(1, game.party)).toFixed(3)})`;
      ctx.fillRect(8, 56, PLAY_W - 16, H - 64);
    }
  });
  banner(ctx, view.W, view.banner, view.bannerAlpha);
}
