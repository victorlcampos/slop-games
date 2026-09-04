// Hop Across: road, river and hurry — reach the other side.
//
// Five lanes of traffic, four of river, five bays up top. Logs carry, water
// and bumpers kill, and an occupied bay is as deadly as a truck: there is no
// room for two. Filling all five bays clears the wave and the whole machine
// speeds up.

import { PLAY_W } from '../config.js';
import { t } from '../i18n.js';
import { field, hud, banner, makeStars, backdrop } from '../draw.js';

export const COLS = 13;
export const ROWS = 12;
export const CELL = 48;
export const OX = (PLAY_W - COLS * CELL) / 2;
export const OY = 80;

export const HOME_ROW = 0;
export const START = { c: 6, r: 11 };
export const SLOTS = [0, 3, 6, 9, 12];
export const TIME_LIMIT = 40;
const HOP_GAP = 0.12;

// Wave pace: wave 1 is gentle, wave 3 runs ~1.44x. Measured with a scripted
// careful crossing (60 seeds): wave 1 fills the first bay 60/60 and clears
// the wave 29/30; wave 3 fills 10/20 and clears 5/20 — hard but possible.
function pace(wave) {
  return 1 + (wave - 1) * 0.22;
}

// row → traffic. Cars kill, logs carry; the banks and the grass are safe.
// Tuned by measurement (see pace): the old road rows ran 3–5 cells/s at
// ~50% cover over five unbroken lanes, so a frog resting between hops died
// WAITING (108 of 125 baseline deaths). Road rows are sparser and slower
// now; river rows run longer logs so a rider can fix alignment mid-stream.
function lanes(wave) {
  const p = pace(wave);
  return [
    { row: 1, kind: 'river', dir: 1, speed: 1.2 * p, len: 4, count: 3 },
    { row: 2, kind: 'river', dir: -1, speed: 1.7 * p, len: 3, count: 3 },
    { row: 3, kind: 'river', dir: 1, speed: 2.1 * p, len: 4, count: 2 },
    { row: 4, kind: 'river', dir: -1, speed: 1.5 * p, len: 3, count: 3 },
    { row: 6, kind: 'road', dir: -1, speed: 2.6 * p, len: 2, count: 2 },
    { row: 7, kind: 'road', dir: 1, speed: 3.4 * p, len: 1, count: 3 },
    { row: 8, kind: 'road', dir: -1, speed: 3.8 * p, len: 1, count: 2 },
    { row: 9, kind: 'road', dir: 1, speed: 3.2 * p, len: 2, count: 2 },
    { row: 10, kind: 'road', dir: -1, speed: 3.6 * p, len: 2, count: 2 },
  ];
}

const CAR_COLOURS = ['#ff5555', '#ff9955', '#ffee55', '#55aaff', '#cc88ff', '#55ff88'];

export function create(rand = Math.random) {
  const game = {
    wave: 1,
    rand,
    score: 0,
    lives: 3,
    over: false,
    events: [],
  frog: { ...START, x: START.c, y: START.r, fx: 0, fy: -1 },
  slots: SLOTS.map(() => false),
  movers: [],
  particles: [],
    timer: TIME_LIMIT,
    hopGap: 0,
    hopT: 0,
    clearT: 0,
  };
  buildMovers(game);
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

function buildMovers(game) {
  game.movers = [];
  let ci = 0;
  for (const lane of lanes(game.wave)) {
    const span = COLS + lane.len + 2;
    for (let i = 0; i < lane.count; i++) {
      game.movers.push({
        row: lane.row,
        kind: lane.kind,
        dir: lane.dir,
        speed: lane.speed,
        len: lane.len,
        x: (i * span) / lane.count + game.rand() * 2,
        colour: lane.kind === 'road' ? CAR_COLOURS[ci++ % CAR_COLOURS.length] : null,
      });
    }
  }
}

/** The mover under cell x on a river row, or null for open water. */
export function logUnder(game, row, x) {
  for (const m of game.movers) {
    if (m.row !== row || m.kind !== 'river') continue;
    // half a cell of grace: a hop lands on integer cells while the log
    // underneath keeps drifting, so the tip still holds.
    if (x >= m.x - 0.5 && x <= m.x + m.len + 0.5) return m;
  }
  return null;
}

/** A car overlapping cell x on a road row. */
export function carAt(game, row, x) {
  for (const m of game.movers) {
    if (m.row !== row || m.kind !== 'road') continue;
    // a quarter cell of paint past the bumper: the old ±0.45 turned every
    // len-1 car into a ~2-cell wall and owned most road deaths.
    if (x >= m.x - 0.25 && x <= m.x + m.len + 0.25) return m;
  }
  return null;
}

// Cheap canvas juice, simulated: every particle is { kind, x, y, vx, vy,
// grav, age, life, size, colour }. Only game.rand drives them, so a
// recording of inputs replays pixel-perfect.
function spawn(game, kind, x, y, vx, vy, life, size, colour, grav = 0) {
  if (!game.particles) game.particles = [];
  if (game.particles.length > 140) game.particles.splice(0, game.particles.length - 140);
  game.particles.push({ kind, x, y, vx, vy, grav, age: 0, life, size, colour });
}

function puff(game, c, r, kind, n, speed, life, size, colours, grav = 0) {
  for (let i = 0; i < n; i++) {
    const a = game.rand() * Math.PI * 2;
    const v = speed * (0.4 + game.rand() * 0.8);
    spawn(game, kind, c + (game.rand() - 0.5) * 0.5, r + (game.rand() - 0.5) * 0.5,
      Math.cos(a) * v, Math.sin(a) * v, life * (0.7 + game.rand() * 0.6),
      size, colours[(game.rand() * colours.length) | 0], grav);
  }
}

function resetFrog(game) {
  game.frog = { ...START, x: START.c, y: START.r, fx: 0, fy: -1 };
  game.timer = TIME_LIMIT;
  game.hopGap = 0;
}

function die(game, how) {
  const f = game.frog;
  if (how === 'splash') {
    puff(game, f.x, f.r, 'drop', 9, 3.2, 0.7, 3, ['#9fd0ff', '#ffffff', '#5f9fe8'], 9);
    spawn(game, 'ring', f.x, f.r, 0, 0, 0.6, 4, '#bfe0ff');
  } else {
    puff(game, f.x, f.r, 'bit', 9, 3.6, 0.8, 3.5, ['#55ff55', '#2fae5c', '#ff5555'], 7);
    spawn(game, 'splat', f.x, f.r, 0, 0, 3, 13, '#2fae5c');
  }
  game.lives -= 1;
  emit(game, how); // 'splash' for the river, 'boom' for the road
  if (game.lives <= 0) {
    game.over = true;
    emit(game, 'lose');
  } else {
    resetFrog(game);
  }
}

function hop(game, dx, dy) {
  const f = game.frog;
  const nc = f.c + dx;
  const nr = f.r + dy;
  if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return; // the banks hold
  if (nr === HOME_ROW && !SLOTS.includes(nc)) return; // bushes, not bays
  f.c = nc;
  f.r = nr;
  f.x = nc;
  f.y = nr;
  f.fx = dx;
  f.fy = dy;
  game.hopT = 0.12;
  game.score += 10; // every hop pays the fare
  // landing juice: river landings ripple, everything else kicks up dust
  const lane = lanes(game.wave).find((l) => l.row === nr);
  if (lane && lane.kind === 'river') {
    spawn(game, 'ring', nc, nr, 0, 0, 0.5, 3, '#bfe0ff');
    puff(game, nc, nr, 'drop', 3, 1.4, 0.4, 2.5, ['#9fd0ff', '#ffffff'], 8);
  } else {
    puff(game, nc, nr, 'dust', 3, 1.6, 0.35, 3, ['#d2be96', '#b8a67e']);
  }
  emit(game, 'hop');
}

export function update(game, h, input = {}) {
  if (game.over) return;
  // juice keeps moving even while the wave-clear banner hangs
  if (game.particles) {
    for (const p of game.particles) {
      p.age += h;
      p.life -= h;
      p.vy += (p.grav || 0) * h;
      p.x += p.vx * h;
      p.y += p.vy * h;
    }
    game.particles = game.particles.filter((p) => p.life > 0);
  }
  if (game.clearT > 0) {
    game.clearT -= h;
    if (game.clearT <= 0) {
      game.wave += 1;
      game.slots = SLOTS.map(() => false);
      buildMovers(game);
      resetFrog(game);
      emit(game, 'banner', { text: t('wave.next', { n: game.wave }) });
      emit(game, 'wave');
    }
    return;
  }

  for (const m of game.movers) {
    m.x += m.dir * m.speed * h;
    const span = COLS + m.len + 2;
    if (m.dir === 1 && m.x > COLS + 1) m.x -= span;
    if (m.dir === -1 && m.x + m.len < -1) m.x += span;
  }

  game.hopGap -= h;
  game.hopT -= h;
  if (game.hopGap <= 0) {
    let dx = 0;
    let dy = 0;
    if (input.left) dx = -1;
    else if (input.right) dx = 1;
    else if (input.up) dy = -1;
    else if (input.down) dy = 1;
    else if (input.swipe === 'left') dx = -1;
    else if (input.swipe === 'right') dx = 1;
    else if (input.swipe === 'up') dy = -1;
    else if (input.swipe === 'down') dy = 1;
    if (dx || dy) {
      hop(game, dx, dy);
      game.hopGap = HOP_GAP;
    }
  }

  const f = game.frog;
  const lane = lanes(game.wave).find((l) => l.row === f.r);

  if (lane && lane.kind === 'road') {
    if (carAt(game, f.r, f.x)) {
      die(game, 'boom');
      return;
    }
  } else if (lane && lane.kind === 'river') {
    const log = logUnder(game, f.r, f.x);
    if (!log) {
      die(game, 'splash');
      return;
    }
    f.x += log.dir * log.speed * h;
    f.c = Math.round(f.x);
    if (f.x < -0.5 || f.x > COLS - 0.5) {
      die(game, 'splash'); // carried off the world
      return;
    }
  }

  // the far bank: an empty bay fills, anything else is a wall with teeth
  if (f.r === HOME_ROW) {
    const i = SLOTS.indexOf(f.c);
    if (i >= 0 && !game.slots[i]) {
      game.slots[i] = true;
      game.score += 500;
      puff(game, f.c, f.r, 'spark', 10, 2.6, 0.9, 3, ['#ffe97a', '#7dff8a', '#ffffff'], -2);
      spawn(game, 'ring', f.c, f.r, 0, 0, 0.7, 5, '#ffe97a');
      emit(game, 'goal');
      if (game.slots.every(Boolean)) {
        game.score += 1000;
        game.clearT = 2;
        for (let b = 0; b < SLOTS.length; b++) {
          puff(game, SLOTS[b], HOME_ROW, 'spark', 5, 2.2, 1.4, 3, ['#ffe97a', '#7dff8a', '#ffffff'], -2);
        }
        emit(game, 'banner', { text: t('wave.clear', { n: game.wave }) });
        emit(game, 'clear');
      } else {
        resetFrog(game);
      }
    } else if (i >= 0) {
      die(game, 'splash'); // no room for two
    }
  }

  game.timer -= h;
  if (game.timer <= 0 && !game.over && game.clearT <= 0) {
    die(game, 'boom'); // out of time on the road
  }
}

const stars = makeStars(1981);

function cellXY(c, r) {
  return [OX + (c + 0.5) * CELL, OY + (r + 0.5) * CELL];
}

function drawFrog(ctx, x, y, dx, dy, squash = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dx === 1 ? Math.PI / 2 : dx === -1 ? -Math.PI / 2 : dy === 1 ? Math.PI : 0);
  ctx.scale(squash, 1 / squash);
  // folded back legs sticking out both sides, drawn first so the body overlaps
  ctx.fillStyle = '#2fae5c';
  ctx.beginPath();
  ctx.ellipse(-14, 5, 6.5, 10, 0.45, 0, Math.PI * 2);
  ctx.ellipse(14, 5, 6.5, 10, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-16, 13, 4.5, 3.5, 0.3, 0, Math.PI * 2);
  ctx.ellipse(16, 13, 4.5, 3.5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // body
  ctx.fillStyle = '#55ff55';
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // pale belly patch toward the back
  ctx.fillStyle = '#c9f5b8';
  ctx.beginPath();
  ctx.ellipse(0, 4.5, 8, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // eye bumps that break the top silhouette — the eyes sit ON the head
  ctx.fillStyle = '#55ff55';
  ctx.beginPath();
  ctx.arc(-7, -11, 6.5, 0, Math.PI * 2);
  ctx.arc(7, -11, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-7, -11.5, 5, 0, Math.PI * 2);
  ctx.arc(7, -11.5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#06130a';
  ctx.beginPath();
  ctx.arc(-7, -13, 2.4, 0, Math.PI * 2);
  ctx.arc(7, -13, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // smile under the eyes
  ctx.strokeStyle = '#0b3d1c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -10, 7, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
  ctx.restore();
}

function drawParticles(ctx, particles) {
  if (!particles || !particles.length) return;
  // splats first: they stain the ground the frog lies on
  for (const p of particles) {
    if (p.kind !== 'splat') continue;
    const [x, y] = cellXY(p.x, p.y);
    ctx.globalAlpha = 0.55 * (p.life / (p.life + p.age));
    ctx.fillStyle = p.colour;
    ctx.beginPath();
    ctx.ellipse(x, y + 6, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of particles) {
    if (p.kind === 'splat') continue;
    const [x, y] = cellXY(p.x, p.y);
    const frac = p.life / (p.life + p.age);
    if (p.kind === 'ring') {
      ctx.globalAlpha = frac;
      ctx.strokeStyle = p.colour;
      ctx.lineWidth = 3 * frac + 1;
      ctx.beginPath();
      ctx.arc(x, y, p.size + p.age * 46, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.globalAlpha = Math.min(1, frac * 1.5);
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(x, y, p.size * (p.kind === 'dust' ? 1 + p.age * 2 : 1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function draw(ctx, game, view) {
  backdrop(ctx, view.W, view.time, stars);
  hud(ctx, view.W,
    `${t('hud.score')}: ${game.score}`,
    `${t('hud.wave')} ${game.wave}`,
    `${t('hud.best')}: ${view.best}`);
  field(ctx, view.W, () => {
    const laneOf = (r) => lanes(game.wave).find((l) => l.row === r);
    for (let r = 0; r < ROWS; r++) {
      const y = OY + r * CELL;
      const lane = laneOf(r);
      if (r === HOME_ROW || r === 5 || r === ROWS - 1) {
        ctx.fillStyle = '#0d3a1e';
        ctx.fillRect(OX, y, COLS * CELL, CELL);
      } else if (lane && lane.kind === 'river') {
        ctx.fillStyle = '#0a2a5e';
        ctx.fillRect(OX, y, COLS * CELL, CELL);
      } else {
        ctx.fillStyle = '#1a1a22';
        ctx.fillRect(OX, y, COLS * CELL, CELL);
        ctx.fillStyle = '#555566';
        for (let c = 0; c < COLS; c += 2) {
          ctx.fillRect(OX + c * CELL + 8, y + CELL / 2 - 2, CELL - 16, 4);
        }
      }
    }
    // the bays
    for (let i = 0; i < SLOTS.length; i++) {
      const [x, y] = cellXY(SLOTS[i], HOME_ROW);
      ctx.fillStyle = game.slots[i] ? '#2fae5c' : '#0a2a5e';
      ctx.strokeStyle = '#7dff8a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, CELL * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // logs and cars
    for (const m of game.movers) {
      const x = OX + m.x * CELL;
      const y = OY + m.row * CELL + 6;
      const w = m.len * CELL;
      if (m.kind === 'river') {
        ctx.fillStyle = '#7a5230';
        ctx.fillRect(x, y, w, CELL - 12);
        ctx.fillStyle = '#93703f';
        ctx.fillRect(x, y, w, 6);
      } else {
        ctx.fillStyle = m.colour;
        ctx.fillRect(x + 2, y + 4, w - 4, CELL - 20);
        ctx.fillStyle = 'rgba(180,220,255,0.8)';
        const wx = m.dir === 1 ? x + w - 16 : x + 6;
        ctx.fillRect(wx, y + 8, 10, CELL - 28);
      }
    }
    // the frog, squash-stretched mid-hop, facing its last hop. Local space:
    // -y is forward, so the eyes ride on TOP of the head, the smile sits
    // under them, the belly hangs back and the folded legs stick out both
    // sides. At 52px cells the bumps break the silhouette; shrunk to a pip
    // the two white dots still say frog.
    const [fx, fy] = cellXY(game.frog.x, game.frog.r);
    const squash = game.hopT > 0 ? 1.25 : 1;
    drawFrog(ctx, fx, fy, game.frog.fx || 0, (game.frog.fy ?? -1) || 0, squash);
    drawParticles(ctx, game.particles);
    // lives and the clock
    for (let i = 0; i < game.lives; i++) {
      const px = OX + 18 + i * 28;
      const py = OY + ROWS * CELL + 24;
      ctx.fillStyle = '#55ff55';
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px - 3, py - 6, 2.6, 0, Math.PI * 2);
      ctx.arc(px + 3, py - 6, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#06130a';
      ctx.beginPath();
      ctx.arc(px - 3, py - 6.5, 1.2, 0, Math.PI * 2);
      ctx.arc(px + 3, py - 6.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const urgent = game.timer < 10;
    const pulse = urgent ? 1 + 0.12 * Math.sin((view.time || 0) * 9) : 1;
    ctx.fillStyle = urgent ? '#ff5555' : '#9dc4a4';
    ctx.font = `700 ${Math.round(18 * pulse)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(game.timer)}s`, OX + COLS * CELL, OY + ROWS * CELL + 18);
    ctx.textAlign = 'left';
  });
  banner(ctx, view.W, view.banner, view.bannerAlpha);
}
