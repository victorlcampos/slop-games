// Asteroid Belt: turn, burn, and split the rocks before they split you.
//
// Newtonian drift on a toroidal field — the edges wrap, so there is nowhere
// to hide and no wall to be cornered against. Big rocks break into two
// smaller ones, and the wave only ends when the sky is empty.

import { PLAY_W, H } from '../config.js';
import { t } from '../i18n.js';
import { field, hud, banner, makeStars, backdrop } from '../draw.js';

const SIZES = { 3: 46, 2: 24, 1: 12 };
const PAY = { 3: 20, 2: 50, 1: 100 };
const BULLET_SPEED = 640;
const BULLET_LIFE = 0.9;
const FIRE_GAP = 0.18;

/** Rocks on wave n: four to open, one more per wave, never a crowd. */
export function rockCount(wave) {
  return Math.min(9, 3 + wave);
}

export function rockSpeed(wave, rand) {
  return 40 + wave * 9 + rand() * 50;
}

export function create(rand = Math.random) {
  const game = {
    wave: 1,
    rand,
    score: 0,
    lives: 3,
    over: false,
    events: [],
    ship: { x: PLAY_W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2 },
    thrusting: false,
    bullets: [],
    rocks: [],
    cooldown: 0,
    invuln: 0,
    clearT: 0,
  };
  spawnRocks(game);
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

function makeVerts(rand) {
  const verts = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    verts.push(0.75 + rand() * 0.4);
  }
  return verts;
}

function farFromShip(game, x, y) {
  return Math.hypot(x - game.ship.x, y - game.ship.y) > 170;
}

function spawnRocks(game) {
  const n = rockCount(game.wave);
  let placed = 0;
  let guard = 0;
  while (placed < n && guard++ < 200) {
    const x = game.rand() * PLAY_W;
    const y = 80 + game.rand() * (H - 160);
    if (!farFromShip(game, x, y)) continue;
    const a = game.rand() * Math.PI * 2;
    const sp = rockSpeed(game.wave, game.rand);
    game.rocks.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      size: 3,
      spin: (game.rand() - 0.5) * 1.6,
      rot: game.rand() * Math.PI * 2,
      verts: makeVerts(game.rand),
    });
    placed++;
  }
}

function wrap(o) {
  if (o.x < -60) o.x += PLAY_W + 120;
  if (o.x > PLAY_W + 60) o.x -= PLAY_W + 120;
  if (o.y < -60) o.y += H + 120;
  if (o.y > H + 60) o.y -= H + 120;
}

function split(game, rock) {
  game.score += PAY[rock.size];
  if (rock.size > 1) {
    for (let i = 0; i < 2; i++) {
      const a = game.rand() * Math.PI * 2;
      const sp = rockSpeed(game.wave, game.rand) * 1.3;
      game.rocks.push({
        x: rock.x, y: rock.y,
        vx: rock.vx * 0.4 + Math.cos(a) * sp,
        vy: rock.vy * 0.4 + Math.sin(a) * sp,
        size: rock.size - 1,
        spin: (game.rand() - 0.5) * 2.4,
        rot: game.rand() * Math.PI * 2,
        verts: makeVerts(game.rand),
      });
    }
    emit(game, 'brick');
  } else {
    emit(game, 'explodeBig');
  }
}

function killShip(game) {
  game.lives -= 1;
  game.invuln = 3;
  // the blast clears the neighbourhood, so the respawn is never a trap
  game.rocks = game.rocks.filter((r) => Math.hypot(r.x - game.ship.x, r.y - game.ship.y) > 150);
  game.ship.x = PLAY_W / 2;
  game.ship.y = H / 2;
  game.ship.vx = 0;
  game.ship.vy = 0;
  if (game.lives <= 0) {
    game.over = true;
    emit(game, 'lose');
  } else {
    emit(game, 'boom');
  }
}

export function update(game, h, input = {}) {
  if (game.over) return;
  if (game.clearT > 0) {
    game.clearT -= h;
    if (game.clearT <= 0) {
      game.wave += 1;
      game.bullets.length = 0;
      spawnRocks(game);
      emit(game, 'banner', { text: t('wave.next', { n: game.wave }) });
      emit(game, 'wave');
    }
    return;
  }

  const s = game.ship;
  if (input.left) s.a -= 4.6 * h;
  if (input.right) s.a += 4.6 * h;
  game.thrusting = !!input.up;
  if (game.thrusting) {
    s.vx += Math.cos(s.a) * 430 * h;
    s.vy += Math.sin(s.a) * 430 * h;
    // terminal velocity: the belt has a speed limit
    const v = Math.hypot(s.vx, s.vy);
    if (v > 460) { s.vx *= 460 / v; s.vy *= 460 / v; }
  }
  s.vx *= 1 - 0.12 * h;
  s.vy *= 1 - 0.12 * h;
  s.x += s.vx * h;
  s.y += s.vy * h;
  wrap(s);

  game.cooldown -= h;
  game.invuln -= h;
  if (input.fire && game.cooldown <= 0 && game.bullets.length < 4) {
    game.bullets.push({
      x: s.x + Math.cos(s.a) * 18,
      y: s.y + Math.sin(s.a) * 18,
      vx: s.vx + Math.cos(s.a) * BULLET_SPEED,
      vy: s.vy + Math.sin(s.a) * BULLET_SPEED,
      life: BULLET_LIFE,
    });
    game.cooldown = FIRE_GAP;
    emit(game, 'shootRock');
  }

  for (const b of game.bullets) {
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.life -= h;
    wrap(b);
  }

  for (const r of game.rocks) {
    r.x += r.vx * h;
    r.y += r.vy * h;
    r.rot += r.spin * h;
    wrap(r);
  }

  // bullets split rocks
  for (const b of game.bullets) {
    if (b.life <= 0) { b.dead = true; continue; }
    for (const r of game.rocks) {
      if (Math.hypot(b.x - r.x, b.y - r.y) < SIZES[r.size]) {
        b.dead = true;
        r.dead = true;
        split(game, r);
        break;
      }
    }
  }
  game.bullets = game.bullets.filter((b) => !b.dead);
  game.rocks = game.rocks.filter((r) => !r.dead);

  // rocks split ships
  if (game.invuln <= 0) {
    for (const r of game.rocks) {
      if (Math.hypot(s.x - r.x, s.y - r.y) < SIZES[r.size] + 10) {
        killShip(game);
        break;
      }
    }
    if (game.over) return;
  }

  if (game.rocks.length === 0) {
    game.clearT = 2;
    emit(game, 'banner', { text: t('wave.clear', { n: game.wave }) });
    emit(game, 'clear');
  }
}

const stars = makeStars(1979 + 7);

function rockPath(ctx, r) {
  const R = SIZES[r.size];
  ctx.beginPath();
  for (let i = 0; i < r.verts.length; i++) {
    const a = r.rot + (i / r.verts.length) * Math.PI * 2;
    const rr = R * r.verts[i];
    const x = r.x + Math.cos(a) * rr;
    const y = r.y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function draw(ctx, game, view) {
  backdrop(ctx, view.W, view.time, stars);
  hud(ctx, view.W,
    `${t('hud.score')}: ${game.score}`,
    `${t('hud.wave')} ${game.wave}`,
    `${t('hud.best')}: ${view.best}`);
  field(ctx, view.W, () => {
    ctx.lineWidth = 2;
    for (const r of game.rocks) {
      rockPath(ctx, r);
      ctx.strokeStyle = '#c9b89a';
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    for (const b of game.bullets) {
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    }
    // the ship blinks back into existence
    const blink = game.invuln > 0 && Math.floor(view.time * 8) % 2 === 0;
    if (!blink && !game.over) {
      const s = game.ship;
      const nose = 20;
      const tail = 14;
      const wing = 2.2;
      ctx.strokeStyle = '#7dff8a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s.x + Math.cos(s.a) * nose, s.y + Math.sin(s.a) * nose);
      ctx.lineTo(s.x + Math.cos(s.a + wing) * tail, s.y + Math.sin(s.a + wing) * tail);
      ctx.lineTo(s.x + Math.cos(s.a - wing) * tail, s.y + Math.sin(s.a - wing) * tail);
      ctx.closePath();
      ctx.stroke();
      if (game.thrusting) {
        const f = 12 + 8 * Math.abs(Math.sin(view.time * 40));
        ctx.fillStyle = '#ff9955';
        ctx.beginPath();
        ctx.moveTo(s.x - Math.cos(s.a) * tail, s.y - Math.sin(s.a) * tail);
        ctx.lineTo(s.x - Math.cos(s.a) * (tail + f), s.y - Math.sin(s.a) * (tail + f));
        ctx.lineTo(s.x - Math.cos(s.a) * tail + Math.cos(s.a + 1.2) * 6, s.y - Math.sin(s.a) * tail + Math.sin(s.a + 1.2) * 6);
        ctx.closePath();
        ctx.fill();
      }
    }
    for (let i = 0; i < game.lives; i++) {
      const x = 30 + i * 28;
      const y = 694;
      ctx.strokeStyle = '#7dff8a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 9, y);
      ctx.lineTo(x - 6, y + 7);
      ctx.lineTo(x - 6, y - 7);
      ctx.closePath();
      ctx.stroke();
    }
  });
  banner(ctx, view.W, view.banner, view.bannerAlpha);
}
