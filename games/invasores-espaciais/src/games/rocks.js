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
// second-generation rocks stay outrunnable: about half the ship's terminal
// velocity, so a fast pebble pressures but never outruns a burning ship.
const CHILD_SPEED_CAP = 240;
// sparks are bounded: a full shatter plus a death burst never fills this.
const MAX_PARTICLES = 400;

// the saucer: a classic crossing pest, meaner waves call it back sooner.
const SAUCER_R = 24;
const SAUCER_LIFE = 12;
const SBOLT_SPEED = 250;
const SBOLT_LIFE = 3;
const SBOLT_GAP = 1.3;
const SBOLT_MAX = 3;

/** Rocks on wave n: four to open, one more per wave, never a crowd. */
export function rockCount(wave) {
  return Math.min(9, 3 + wave);
}

export function rockSpeed(wave, rand) {
  // the ramp plateaus past wave 7: sims show ~5s survival standing still at
  // wave 6 already, so the tail buys heat nobody can answer, only numbers.
  return 40 + Math.min(wave, 7) * 9 + rand() * 50;
}

/** Saucer crossings: every ~15s on wave 1, every 6s once the belt boils. */
export function saucerPeriod(wave) {
  return Math.max(6, 17 - wave * 1.5);
}

export function saucerSpeed(wave) {
  return Math.min(200, 130 + wave * 8);
}

/** Cracking the saucer: 200 on wave 1, 300 once wave 6 calls it in. */
export function saucerPay(wave) {
  return Math.min(300, 200 + (wave - 1) * 20);
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
    particles: [],
    saucer: null,
    sbolts: [],
    saucerT: 0,
  };
  game.saucerT = saucerPeriod(1) + game.rand() * 4;
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
  burst(game, rock.x, rock.y, 4 + rock.size * 4, ['#c9b89a', '#efe3cc', '#ff9955'],
    60, 220, 0.4, 0.9, rock.vx, rock.vy);
  if (rock.size > 1) {
    for (let i = 0; i < 2; i++) {
      const a = game.rand() * Math.PI * 2;
      const sp = rockSpeed(game.wave, game.rand) * 1.2;
      let vx = rock.vx * 0.4 + Math.cos(a) * sp;
      let vy = rock.vy * 0.4 + Math.sin(a) * sp;
      // the inherited drift plus a fresh kick compounds over generations;
      // cap the tail so wave 9 pebbles stay dodgeable, not hitscan.
      const v = Math.hypot(vx, vy);
      if (v > CHILD_SPEED_CAP) { vx *= CHILD_SPEED_CAP / v; vy *= CHILD_SPEED_CAP / v; }
      game.rocks.push({
        x: rock.x, y: rock.y,
        vx, vy,
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

// Sparks, debris and blast clouds: pure numbers until draw() reads them.
function burst(game, x, y, n, colors, vMin, vMax, lifeMin, lifeMax, baseVx = 0, baseVy = 0) {
  for (let i = 0; i < n; i++) {
    const a = game.rand() * Math.PI * 2;
    const sp = vMin + game.rand() * (vMax - vMin);
    game.particles.push({
      x, y,
      vx: baseVx * 0.5 + Math.cos(a) * sp,
      vy: baseVy * 0.5 + Math.sin(a) * sp,
      life: lifeMin + game.rand() * (lifeMax - lifeMin),
      max: lifeMax,
      color: colors[(game.rand() * colors.length) | 0],
      size: 2 + game.rand() * 3,
    });
  }
  // a long fight sheds thousands; keep the tail, drop the history.
  if (game.particles.length > MAX_PARTICLES) {
    game.particles.splice(0, game.particles.length - MAX_PARTICLES);
  }
}

function stepParticles(game, h) {
  for (const p of game.particles) {
    p.x += p.vx * h;
    p.y += p.vy * h;
    p.vx *= 1 - 1.6 * h;
    p.vy *= 1 - 1.6 * h;
    p.life -= h;
    wrap(p);
  }
  game.particles = game.particles.filter((p) => p.life > 0);
}

function spawnSaucer(game) {
  const dir = game.rand() < 0.5 ? 1 : -1;
  game.saucer = {
    x: dir === 1 ? -40 : PLAY_W + 40,
    y: 120 + game.rand() * (H - 280),
    vx: dir * saucerSpeed(game.wave) * (0.9 + game.rand() * 0.2),
    fireT: 1,
    life: SAUCER_LIFE,
  };
  emit(game, 'saucer');
}

function saucerShoot(game) {
  const u = game.saucer;
  const s = game.ship;
  const dx = s.x - u.x;
  const dy = s.y - u.y;
  const dist = Math.hypot(dx, dy) || 1;
  // partial lead with a shaky hand: answering requires moving, not luck.
  const t = Math.min(dist / SBOLT_SPEED, 1);
  const aim = Math.atan2(dy + s.vy * t * 0.6, dx + s.vx * t * 0.6)
    + (game.rand() - 0.5) * 0.3;
  game.sbolts.push({
    x: u.x, y: u.y,
    vx: Math.cos(aim) * SBOLT_SPEED,
    vy: Math.sin(aim) * SBOLT_SPEED,
    life: SBOLT_LIFE,
  });
  emit(game, 'shoot');
}

function killSaucer(game, pay) {
  const u = game.saucer;
  game.saucer = null;
  game.saucerT = saucerPeriod(game.wave) + game.rand() * 4;
  burst(game, u.x, u.y, 24, ['#ff5a7a', '#ffb066', '#ffffff'], 60, 300, 0.4, 1, u.vx, 0);
  if (pay > 0) {
    game.score += pay;
    emit(game, 'saucerKill', { pay });
  }
}

function killShip(game) {
  game.lives -= 1;
  game.invuln = 3;
  burst(game, game.ship.x, game.ship.y, 46, ['#7dff8a', '#ff9955', '#ffffff'],
    40, 320, 0.5, 1.2, game.ship.vx, game.ship.vy);
  // the blast clears the neighbourhood, so the respawn is never a trap
  game.rocks = game.rocks.filter((r) => Math.hypot(r.x - game.ship.x, r.y - game.ship.y) > 150);
  game.sbolts = game.sbolts.filter((b) => Math.hypot(b.x - game.ship.x, b.y - game.ship.y) > 150);
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
  // the blast cloud outlives the run: the game-over card rises over debris.
  if (game.over) { stepParticles(game, h); return; }
  stepParticles(game, h);
  if (game.clearT > 0) {
    game.clearT -= h;
    if (game.clearT <= 0) {
      game.wave += 1;
      game.bullets.length = 0;
      game.sbolts.length = 0;
      game.saucer = null;
      game.saucerT = saucerPeriod(game.wave) + game.rand() * 4;
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
  if (game.thrusting && !game.over) {
    // one spark a step: 60 a second, each living ~0.3s, a short comet tail.
    const back = s.a + Math.PI;
    burst(game, s.x + Math.cos(back) * 14, s.y + Math.sin(back) * 14, 1,
      ['#ff9955', '#ffcc66', '#ff6622'], 40, 140, 0.2, 0.4, s.vx, s.vy);
  }

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

  // the saucer keeps its own appointment: one crossing at a time, then gone.
  if (!game.saucer) {
    game.saucerT -= h;
    if (game.saucerT <= 0) spawnSaucer(game);
  } else {
    const u = game.saucer;
    u.x += u.vx * h;
    wrap(u);
    u.life -= h;
    if (u.life <= 0) {
      game.saucer = null;
      game.saucerT = saucerPeriod(game.wave) + game.rand() * 4;
    } else {
      u.fireT -= h;
      if (u.fireT <= 0 && game.sbolts.length < SBOLT_MAX) {
        saucerShoot(game);
        u.fireT = SBOLT_GAP + game.rand() * 0.5;
      }
    }
  }

  for (const b of game.sbolts) {
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.life -= h;
    if (b.life <= 0) b.dead = true;
    wrap(b);
  }

  // bullets split rocks — and crack saucers
  for (const b of game.bullets) {
    if (b.life <= 0) { b.dead = true; continue; }
    if (game.saucer && Math.hypot(b.x - game.saucer.x, b.y - game.saucer.y) < SAUCER_R + 2) {
      b.dead = true;
      killSaucer(game, saucerPay(game.wave));
      continue;
    }
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

  // saucer bolts die on rocks, kill on ships — the mirror of the above.
  for (const b of game.sbolts) {
    if (b.dead) continue;
    for (const r of game.rocks) {
      if (Math.hypot(b.x - r.x, b.y - r.y) < SIZES[r.size]) {
        b.dead = true;
        break;
      }
    }
  }
  game.sbolts = game.sbolts.filter((b) => !b.dead);

  // rocks split ships
  if (game.invuln <= 0) {
    for (const r of game.rocks) {
      if (Math.hypot(s.x - r.x, s.y - r.y) < SIZES[r.size] + 10) {
        killShip(game);
        break;
      }
    }
    // bolts and hulls, same grace period as the rocks
    if (!game.over) {
      for (const b of game.sbolts) {
        if (Math.hypot(s.x - b.x, s.y - b.y) < 12) {
          b.dead = true;
          killShip(game);
          break;
        }
      }
      game.sbolts = game.sbolts.filter((b) => !b.dead);
    }
    if (!game.over && game.saucer
      && Math.hypot(s.x - game.saucer.x, s.y - game.saucer.y) < SAUCER_R + 10) {
      // ramming the pest: no payout, just the wreck and the blast
      killSaucer(game, 0);
      killShip(game);
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

function drawSaucer(ctx, u, time) {
  // the classic pest: a dome riding a disc, three lights chasing its rim
  ctx.strokeStyle = '#ff5a7a';
  ctx.fillStyle = '#3a1420';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(u.x, u.y + 4, SAUCER_R, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(u.x, u.y - 4, 11, 8, 0, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#ff8aa0';
  for (let i = 0; i < 3; i++) {
    const a = time * 6 + (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(u.x + Math.cos(a) * 15, u.y + 4 + Math.sin(a) * 5, 2, 0, Math.PI * 2);
    ctx.fill();
  }
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
    // saucer bolts: slow, red, few — seen in time to sidestep
    ctx.fillStyle = '#ff5a7a';
    for (const b of game.sbolts) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (game.saucer) {
      drawSaucer(ctx, game.saucer, view.time);
    }
    // sparks ride under the ship: the living outshine the debris
    for (const p of game.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
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
