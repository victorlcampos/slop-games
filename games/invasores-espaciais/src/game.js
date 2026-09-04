// The match: one cannon against the descending swarm.
//
// Everything here is pure simulation — no canvas, no DOM, no audio — so the
// tests play whole waves in Node. Side effects leave through `events`, a drain
// the wiring reads for sounds and screen shakes: 'shoot', 'kill', 'drop',
// 'boom' (the cannon died), 'saucer', 'saucerKill', 'clear', 'wave', 'lose',
// 'breach', 'shieldChip'.

import {
  PLAY_W, COLS, CELL_W, PLAYER, SHOT, BOLT, SAUCER, DEADLINE_Y,
  INVADER_W, INVADER_H,
} from './config.js';
import {
  createFormation, march, lowestY, shooters, killAt, totalInvaders,
} from './invaders.js';
import { createShields, rebuildShields, damage, impact } from './shields.js';

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function rect(x, y, w, h) {
  return { x, y, w, h };
}

export function originX(playW = PLAY_W) {
  return (playW - (COLS - 1) * CELL_W) / 2;
}

export function createGame(options = {}) {
  const { playW = PLAY_W, wave = 1, rand = Math.random } = options;
  const game = {
    playW,
    wave,
    rand,
    phase: 'playing',
    score: 0,
    lives: PLAYER.lives,
    killed: 0,
    shotsFired: 0,
    player: { x: playW / 2 },
    cooldown: 0,
    invuln: 0,
    shots: [],
    bolts: [],
    particles: [],
    formation: createFormation(originX(playW)),
    shields: createShields(playW),
    saucer: null,
    saucerClock: SAUCER.period * (0.5 + rand()),
    shotsSinceSaucer: 0,
    boltClock: 1.2,
    cleared: false,
    clearTimer: 0,
    over: false,
    overReason: null,
    events: [],
  };
  return game;
}

function emit(game, name, data) {
  game.events.push({ name, ...data });
}

/** Read and clear the pending side effects. */
export function drain(game) {
  const out = game.events;
  game.events = [];
  return out;
}

function burst(game, x, y, n, colour, speed = 160) {
  for (let i = 0; i < n; i++) {
    const a = game.rand() * Math.PI * 2;
    const v = speed * (0.4 + game.rand() * 0.8);
    game.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 60,
      life: 0.4 + game.rand() * 0.4,
      age: 0,
      colour,
    });
  }
}

/** Seconds between enemy bolts for `remaining` invaders on `wave`. */
export function boltInterval(remaining, wave) {
  const share = remaining / totalInvaders();
  const paced = BOLT.period * (0.25 + 0.75 * share);
  const wavePace = Math.pow(0.9, wave - 1);
  return Math.max(BOLT.minPeriod, paced * wavePace);
}

function fireBolt(game) {
  const alive = shooters(game.formation);
  if (!alive.length) return;
  const maxBolts = Math.min(8, 3 + game.wave);
  if (game.bolts.length >= maxBolts) return;
  const gun = alive[Math.floor(game.rand() * alive.length)];
  const drift = (game.player.x - gun.x) * 0.12;
  game.bolts.push({
    x: gun.x - BOLT.w / 2,
    y: gun.y + INVADER_H / 2,
    vx: Math.max(-90, Math.min(90, drift + (game.rand() - 0.5) * 40)),
    vy: BOLT.speed + BOLT.waveBonus * (game.wave - 1),
  });
}

function spawnSaucer(game) {
  const dir = game.rand() < 0.5 ? 1 : -1;
  game.saucer = {
    x: dir === 1 ? -SAUCER.w : game.playW + SAUCER.w,
    dir,
    shotsSince: 0,
  };
  game.shotsSinceSaucer = 0;
  emit(game, 'saucer');
}

function saucerPay(shotsSince) {
  return SAUCER.pay[Math.min(shotsSince, SAUCER.pay.length - 1)];
}

function loseLife(game, reason) {
  game.lives -= 1;
  burst(game, game.player.x, PLAYER.y, 26, '#7dff8a', 260);
  game.bolts.length = 0;
  if (game.lives <= 0) {
    game.over = true;
    game.overReason = reason;
    emit(game, 'lose');
  } else {
    game.invuln = 2;
    emit(game, 'boom');
  }
}

/** Start the next wave in place: swarm back, bunkers rebuilt, cannon kept. */
export function nextWave(game) {
  game.wave += 1;
  // same top as a fresh formation: the saucer lane moved down under the HUD,
  // and the swarm followed it so the lane-to-swarm gap never changes
  game.formation = createFormation(originX(game.playW), 172);
  game.shields = rebuildShields(game.playW);
  game.saucer = null;
  game.saucerClock = SAUCER.period * (0.5 + game.rand());
  game.bolts.length = 0;
  game.shots.length = 0;
  game.cleared = false;
  game.clearTimer = 0;
  emit(game, 'wave', { wave: game.wave });
}

export function update(game, h, input = {}) {
  // particles always settle, even on the game-over card behind the menu
  for (const p of game.particles) {
    p.age += h;
    p.x += p.vx * h;
    p.y += p.vy * h;
    p.vy += 320 * h;
  }
  game.particles = game.particles.filter((p) => p.age < p.life);
  if (game.over) return;

  // a cleared wave breathes for a beat, then the next one comes down
  if (game.cleared) {
    game.clearTimer -= h;
    if (game.clearTimer <= 0) nextWave(game);
    return;
  }

  const half = PLAYER.w / 2;
  if (input.targetX !== undefined && input.targetX !== null) {
    const want = Math.max(half + 8, Math.min(game.playW - half - 8, input.targetX));
    const d = want - game.player.x;
    game.player.x += Math.max(-PLAYER.speed * 1.4 * h, Math.min(PLAYER.speed * 1.4 * h, d));
  } else {
    if (input.left) game.player.x -= PLAYER.speed * h;
    if (input.right) game.player.x += PLAYER.speed * h;
    game.player.x = Math.max(half + 8, Math.min(game.playW - half - 8, game.player.x));
  }
  game.cooldown -= h;
  game.invuln -= h;

  // the cannon holds one shell in the air — fire only when the sky is clear
  if (input.fire && game.cooldown <= 0 && game.shots.length === 0) {
    game.shots.push({ x: game.player.x - SHOT.w / 2, y: PLAYER.y - PLAYER.h / 2 - SHOT.h });
    game.cooldown = PLAYER.cooldown;
    game.shotsFired += 1;
    if (game.saucer) game.saucer.shotsSince += 1;
    emit(game, 'shoot');
  }

  const step = march(game.formation, game.formation.list.length, game.wave, h,
    { minX: 24, maxX: game.playW - 24 });
  if (step === 'drop') emit(game, 'drop');

  // the saucer keeps its own appointment
  if (!game.saucer) {
    game.saucerClock -= h;
    if (game.saucerClock <= 0) spawnSaucer(game);
  } else {
    game.saucer.x += game.saucer.dir * SAUCER.speed * h;
    // the exit sits further out than the spawn: the saucer is born fully
    // off-screen, and born past this line it would despawn on arrival
    if (game.saucer.x < -SAUCER.w - 40 || game.saucer.x > game.playW + SAUCER.w + 40) {
      game.saucer = null;
      game.saucerClock = SAUCER.period + (game.rand() * 2 - 1) * SAUCER.jitter;
    }
  }

  game.boltClock -= h;
  if (game.boltClock <= 0) {
    game.boltClock = boltInterval(game.formation.list.length, game.wave);
    fireBolt(game);
  }

  for (const s of game.shots) s.y -= SHOT.speed * h;
  for (const b of game.bolts) {
    b.x += b.vx * h;
    b.y += b.vy * h;
  }

  const playerBox = () => rect(
    game.player.x - half, PLAYER.y - PLAYER.h / 2, PLAYER.w, PLAYER.h);

  // ---- the cannon's shell, upwards
  for (const s of game.shots) {
    const box = rect(s.x, s.y, SHOT.w, SHOT.h);
    s.dead = s.y < 40;
    if (s.dead) continue;
    for (const shield of game.shields) {
      const hit = impact(shield, box.x, box.y, box.w, box.h);
      if (hit) {
        damage(shield, hit.x, hit.y - 4);
        emit(game, 'shieldChip');
        s.dead = true;
        break;
      }
    }
    if (s.dead) continue;
    if (game.saucer) {
      const ufo = rect(game.saucer.x - SAUCER.w / 2, SAUCER.y - SAUCER.h / 2,
        SAUCER.w, SAUCER.h);
      if (overlap(box, ufo)) {
        const pay = saucerPay(game.saucer.shotsSince);
        game.score += pay;
        burst(game, game.saucer.x, SAUCER.y, 18, '#ff5a5a', 220);
        emit(game, 'saucerKill', { pay });
        game.saucer = null;
        game.saucerClock = SAUCER.period + (game.rand() * 2 - 1) * SAUCER.jitter;
        s.dead = true;
        continue;
      }
    }
    for (const inv of game.formation.list) {
      const body = rect(inv.x - INVADER_W / 2, inv.y - INVADER_H / 2,
        INVADER_W, INVADER_H);
      if (overlap(box, body)) {
        const score = killAt(game.formation, inv.row, inv.col);
        game.score += score;
        game.killed += 1;
        burst(game, inv.x, inv.y, 10, '#7dff8a', 180);
        emit(game, 'kill', { score });
        s.dead = true;
        break;
      }
    }
  }
  game.shots = game.shots.filter((s) => !s.dead);

  // ---- enemy bolts, downwards
  const pbox = playerBox();
  for (const b of game.bolts) {
    const box = rect(b.x, b.y, BOLT.w, BOLT.h);
    b.dead = b.y > H_safe();
    if (b.dead) continue;
    // a bolt and a shell cancel each other out, mid-air
    for (const s of game.shots) {
      if (overlap(box, rect(s.x, s.y, SHOT.w, SHOT.h))) {
        b.dead = true;
        s.dead = true;
        burst(game, b.x, b.y, 6, '#ffffff', 120);
        emit(game, 'clash');
        break;
      }
    }
    if (b.dead) continue;
    let eaten = false;
    for (const shield of game.shields) {
      const hit = impact(shield, box.x, box.y, box.w, box.h);
      if (hit) {
        damage(shield, hit.x, hit.y + 4);
        emit(game, 'shieldChip');
        b.dead = true;
        eaten = true;
        break;
      }
    }
    if (eaten) continue;
    if (game.invuln <= 0 && overlap(box, pbox)) {
      b.dead = true;
      loseLife(game, 'shot');
      if (game.over) return;
    }
  }
  game.bolts = game.bolts.filter((b) => !b.dead);
  game.shots = game.shots.filter((s) => !s.dead);

  // ---- the two ways to lose the run outright
  if (lowestY(game.formation) >= DEADLINE_Y) {
    game.over = true;
    game.overReason = 'breach';
    emit(game, 'breach');
    return;
  }
  if (game.invuln <= 0) {
    for (const inv of game.formation.list) {
      const body = rect(inv.x - INVADER_W / 2, inv.y - INVADER_H / 2,
        INVADER_W, INVADER_H);
      if (overlap(body, pbox)) {
        loseLife(game, 'rammed');
        break;
      }
    }
    if (game.over) return;
  }

  if (game.formation.list.length === 0) {
    game.cleared = true;
    game.clearTimer = 2.5;
    emit(game, 'clear');
  }
}

// The floor the bolts fall past: the cannon's feet plus a grace row.
function H_safe() {
  return PLAYER.y + 60;
}
