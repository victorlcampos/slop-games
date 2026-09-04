// Hop Across, played in Node: the hop, the traffic, the river, the bays.

import { scenario, check, checkEqual, headlessContext, run } from 'slopkit/testing';

import {
  COLS, ROWS, SLOTS, START, TIME_LIMIT,
  create, update, drain, isOver, draw, logUnder, carAt,
} from '../src/games/hopper.js';

const H = 1 / 60;
const HALF = () => 0.5;

scenario('twenty-two movers, nine lanes, five bays', () => {
  const game = create(HALF);
  checkEqual(game.movers.length, 22, `${game.movers.length} movers, not 22`);
  checkEqual(game.movers.filter((m) => m.kind === 'road').length, 11, 'the road lost a car');
  checkEqual(game.movers.filter((m) => m.kind === 'river').length, 11, 'the river lost a log');
  check(game.movers.some((m) => m.kind === 'road'), 'no traffic on the road');
  check(game.movers.some((m) => m.kind === 'river'), 'nothing floats on the river');
  checkEqual(SLOTS.length, 5, 'the far bank has the wrong number of bays');
  checkEqual(game.frog.c, START.c, 'the frog does not open at the start');
});

scenario('one press, one hop, ten points of fare', () => {
  const game = create(HALF);
  update(game, H, { up: true });
  checkEqual(game.frog.r, START.r - 1, 'the first hop went nowhere');
  checkEqual(game.score, 10, 'the hop paid no fare');
  check(drain(game).some((e) => e.name === 'hop'), 'no hop event left the road');
  // holding the key does not teleport: the gap throttles it
  const r = game.frog.r;
  update(game, H, { up: true });
  checkEqual(game.frog.r, r, 'holding up hopped twice in two frames');
});

scenario('traffic kills and sends the frog home', () => {
  const game = create(HALF);
  game.movers = [{ row: 6, kind: 'road', dir: 1, speed: 0, len: 2, x: 5.5, colour: '#fff' }];
  game.frog = { c: 6, r: 6, x: 6, y: 6 };
  check(carAt(game, 6, 6), 'the test truck misses the frog');
  update(game, H, {});
  checkEqual(game.lives, 2, 'the truck cost the wrong number of lives');
  checkEqual(game.frog.r, START.r, 'the frog did not walk home');
  check(drain(game).some((e) => e.name === 'boom'), 'no boom event left the road');
});

scenario('open water kills, a log carries', () => {
  // drown
  const wet = create(HALF);
  wet.movers = [];
  wet.frog = { c: 5, r: 2, x: 5, y: 2 };
  check(!logUnder(wet, 2, 5), 'open water floats something');
  update(wet, H, {});
  checkEqual(wet.lives, 2, 'the river cost the wrong number of lives');
  check(drain(wet).some((e) => e.name === 'splash'), 'no splash event left the river');

  // carried
  const dry = create(HALF);
  dry.movers = [{ row: 2, kind: 'river', dir: 1, speed: 2, len: 3, x: 4, colour: null }];
  dry.frog = { c: 5, r: 2, x: 5, y: 2 };
  update(dry, H, {});
  checkEqual(dry.lives, 3, 'a log ride drowned the frog');
  check(dry.frog.x > 5, `the log did not carry: ${dry.frog.x}`);
});

scenario('carried off the world drowns like the water does', () => {
  const game = create(HALF);
  game.movers = [{ row: 2, kind: 'river', dir: 1, speed: 60, len: 3, x: COLS - 1.6, colour: null }];
  game.frog = { c: COLS - 1, r: 2, x: COLS - 1, y: 2 };
  update(game, H, {});
  checkEqual(game.lives, 2, 'the edge of the world let the frog through');
});

scenario('an empty bay fills and pays five hundred', () => {
  const game = create(HALF);
  game.movers = [];
  game.frog = { c: 0, r: 1, x: 0, y: 1 };
  const score = game.score;
  update(game, H, { up: true });
  check(game.slots[0], 'the bay stayed empty');
  checkEqual(game.score, score + 510, `the bay paid ${game.score - score}, not 500 + fare`);
  checkEqual(game.frog.r, START.r, 'the next frog never walked out');
  check(drain(game).some((e) => e.name === 'goal'), 'no goal event left the bank');
});

scenario('an occupied bay is as deadly as a truck', () => {
  const game = create(HALF);
  game.movers = [];
  game.slots[0] = true;
  game.frog = { c: 0, r: 1, x: 0, y: 1 };
  update(game, H, { up: true });
  checkEqual(game.lives, 2, 'two frogs share one bay');
});

scenario('five filled bays clear the wave', () => {
  const game = create(HALF);
  game.movers = [];
  for (let i = 0; i < 4; i++) game.slots[i] = true;
  game.frog = { c: SLOTS[4], r: 1, x: SLOTS[4], y: 1 };
  update(game, H, { up: true });
  check(drain(game).some((e) => e.name === 'clear'), 'no clear event left the bank');
  for (let t = 0; t < 2.2; t += H) update(game, H, {});
  checkEqual(game.wave, 2, 'the second crossing never opened');
  check(game.slots.every((s) => !s), 'the bays stayed full for wave 2');
});

scenario('the clock kills dawdlers', () => {
  const game = create(HALF);
  check(TIME_LIMIT > 10, 'nobody crosses in a hurry of a deadline');
  game.timer = 0.01;
  update(game, H, {});
  checkEqual(game.lives, 2, 'the clock showed mercy');
});

scenario('three deaths end the run', () => {
  const game = create(HALF);
  game.movers = [];
  for (let death = 1; death <= 3; death++) {
    game.timer = 0.01;
    update(game, H, {});
  }
  check(isOver(game), 'three timeouts did not end the run');
});

scenario('the whole crossing draws without a browser', () => {
  const game = create(HALF);
  update(game, H, { up: true });
  draw(headlessContext(), game, { time: 1.5, W: 500, best: 999, banner: 'Onda 2', bannerAlpha: 1 });
});

scenario('road rows run slower and sparser than the old 3-5 cells/s wall', () => {
  const game = create(HALF);
  const speeds = {};
  for (const m of game.movers) {
    if (m.kind !== 'road') continue;
    speeds[m.row] = m.speed;
  }
  checkEqual(Object.keys(speeds).length, 5, 'a road row went missing');
  for (const [row, speed] of Object.entries(speeds)) {
    check(speed <= 3.8, `row ${row} still runs ${speed} cells/s`);
  }
  checkEqual(speeds[8], 3.8, `row 8 runs ${speeds[8]}, not 3.8`);
  const counts = {};
  for (const m of game.movers) {
    if (m.kind !== 'road') continue;
    counts[m.row] = (counts[m.row] || 0) + 1;
  }
  checkEqual(counts[7], 3, `row 7 still packs ${counts[7]} cars`);
  checkEqual(counts[8], 2, `row 8 still packs ${counts[8]} cars`);
});

scenario('river rows float longer logs', () => {
  const game = create(HALF);
  const byRow = {};
  for (const m of game.movers) {
    if (m.kind !== 'river') continue;
    (byRow[m.row] = byRow[m.row] || []).push(m);
  }
  check(byRow[1].every((m) => m.len === 4), 'row 1 lost its long logs');
  check(byRow[2].every((m) => m.len === 3), 'row 2 still floats toothpicks');
  checkEqual(byRow[1].length, 3, 'row 1 is still sparse');
  checkEqual(byRow[4].length, 3, 'row 4 is still sparse');
});

scenario('a quarter-cell bumper: near misses live, overlaps die', () => {
  const game = create(HALF);
  game.movers = [{ row: 6, kind: 'road', dir: 1, speed: 0, len: 2, x: 5.5, colour: '#fff' }];
  // the ±0.45 wall caught x=5.1; the paint ends at 5.5 - 0.25 = 5.25
  check(!carAt(game, 6, 5.1), 'the bumper still reaches x=5.1');
  check(carAt(game, 6, 5.3), 'x=5.3 should be inside the car');
  check(!carAt(game, 6, 8.0), 'the bumper still reaches past the tail');
});

scenario('half a cell of log: the drifting tip still holds', () => {
  const game = create(HALF);
  game.movers = [{ row: 2, kind: 'river', dir: 1, speed: 0, len: 3, x: 4, colour: null }];
  // the ±0.4 edge let go at 3.55; the log now holds from 3.5
  check(logUnder(game, 2, 3.55), 'the log tip let go at 3.55');
  check(!logUnder(game, 2, 3.4), 'open water floats something at 3.4');
  check(logUnder(game, 2, 7.45), 'the tail tip let go at 7.45');
});

scenario('snappier hops: the second hop leaves after eight frames', () => {
  const game = create(HALF);
  game.movers = [];
  update(game, H, { up: true });
  checkEqual(game.frog.r, START.r - 1, 'the first hop went nowhere');
  for (let i = 0; i < 7; i++) update(game, H, { up: true });
  checkEqual(game.frog.r, START.r - 1, 'the 0.12s gap broke early');
  update(game, H, { up: true });
  checkEqual(game.frog.r, START.r - 2, 'eight frames did not free the second hop');
});

scenario('later waves speed up 22% a wave', () => {
  const game = create(HALF);
  game.movers = [];
  for (let i = 0; i < 4; i++) game.slots[i] = true;
  game.frog = { c: SLOTS[4], r: 1, x: SLOTS[4], y: 1, fx: 0, fy: -1 };
  update(game, H, { up: true });
  for (let t = 0; t < 2.2; t += H) update(game, H, {});
  checkEqual(game.wave, 2, 'the second crossing never opened');
  const row8 = game.movers.find((m) => m.row === 8);
  const want = 3.8 * 1.22;
  check(Math.abs(row8.speed - want) < 1e-9, `wave 2 row 8 runs ${row8.speed}, not ${want}`);
});

scenario('the frog faces its last hop', () => {
  const game = create(HALF);
  game.movers = [];
  checkEqual(game.frog.fx, 0, 'the frog does not open facing the river');
  checkEqual(game.frog.fy, -1, 'the frog does not open facing the river');
  update(game, H, { left: true });
  checkEqual(game.frog.fx, -1, 'hopping left did not turn the frog');
  for (let i = 0; i < 9; i++) update(game, H, {});
  update(game, H, { up: true });
  checkEqual(game.frog.fy, -1, 'hopping up did not turn the frog');
  checkEqual(game.frog.fx, 0, 'hopping up kept the old sideways facing');
  const tall = create(HALF);
  tall.movers = [];
  tall.frog = { c: 6, r: 5, x: 6, y: 5, fx: 0, fy: -1 };
  update(tall, H, { down: true });
  checkEqual(tall.frog.fy, 1, 'hopping down did not turn the frog');
});

scenario('hops kick up dust, river landings ripple', () => {
  const road = create(HALF);
  road.movers = [];
  update(road, H, { up: true });
  check(road.particles.some((p) => p.kind === 'dust'), 'a road hop kicked up nothing');
  const river = create(HALF);
  river.movers = [{ row: 4, kind: 'river', dir: 1, speed: 0, len: 4, x: 4, colour: null }];
  river.frog = { c: 5, r: 5, x: 5, y: 5, fx: 0, fy: -1 };
  update(river, H, { up: true });
  checkEqual(river.lives, 3, 'the log landing drowned the frog');
  check(river.particles.some((p) => p.kind === 'ring'), 'a log landing left no ripple');
});

scenario('deaths leave juice: drops for the river, bits and a splat for the road', () => {
  const wet = create(HALF);
  wet.movers = [];
  wet.frog = { c: 5, r: 2, x: 5, y: 2, fx: 0, fy: -1 };
  update(wet, H, {});
  check(wet.particles.some((p) => p.kind === 'drop'), 'the drown left no drops');
  const dry = create(HALF);
  dry.movers = [{ row: 6, kind: 'road', dir: 1, speed: 0, len: 2, x: 5.5, colour: '#fff' }];
  dry.frog = { c: 6, r: 6, x: 6, y: 6, fx: 0, fy: -1 };
  update(dry, H, {});
  check(dry.particles.some((p) => p.kind === 'bit'), 'the roadkill left no bits');
  check(dry.particles.some((p) => p.kind === 'splat'), 'the roadkill left no splat');
  checkEqual(dry.lives, 2, 'the truck cost the wrong number of lives');
});

scenario('a filled bay celebrates, then the ripples fade', () => {
  const game = create(HALF);
  game.movers = [];
  game.frog = { c: 0, r: 1, x: 0, y: 1, fx: 0, fy: -1 };
  update(game, H, { up: true });
  check(game.particles.some((p) => p.kind === 'spark'), 'the bay fill sparked nothing');
  game.movers = [];
  game.frog = { c: 6, r: 5, x: 6, y: 5, fx: 0, fy: -1 };
  for (let t = 0; t < 4; t += H) update(game, H, {});
  checkEqual(game.particles.length, 0, `${game.particles.length} particles never faded`);
});

scenario('the shell only ever hears its own event names', () => {
  const allowed = new Set(['hop', 'splash', 'boom', 'goal', 'clear', 'wave', 'lose', 'banner']);
  const game = create(HALF);
  game.movers = [];
  game.frog = { c: 5, r: 2, x: 5, y: 2, fx: 0, fy: -1 };
  update(game, H, {}); // splash
  game.timer = 0.01;
  update(game, H, {}); // boom (timeout)
  game.frog = { c: 0, r: 1, x: 0, y: 1, fx: 0, fy: -1 };
  update(game, H, { up: true }); // hop + goal
  for (const e of drain(game)) {
    check(allowed.has(e.name), `unknown event left the game: ${e.name}`);
  }
});

// A careful player, scripted: wait for real gaps, dodge on the road, ride
// the logs and pre-align before the top row. Regression guard for
// "the frog always dies", measured over fixed seeds.
function botInput(game) {
  if (game.hopGap > 0) return {};
  const f = game.frog;
  const rowKind = (r) => {
    if (r === 0 || r === 5 || r === 11) return 'safe';
    for (const m of game.movers) if (m.row === r) return m.kind;
    return 'safe';
  };
  const clearAhead = (row, x, horizon) => {
    const saved = game.movers.map((m) => m.x);
    const dt = 1 / 30;
    let ok = true;
    for (let tt = dt; tt <= horizon + 1e-9; tt += dt) {
      for (const m of game.movers) m.x += m.dir * m.speed * dt;
      for (const m of game.movers) {
        const span = COLS + m.len + 2;
        if (m.dir === 1 && m.x > COLS + 1) m.x -= span;
        if (m.dir === -1 && m.x + m.len < -1) m.x += span;
      }
      if (carAt(game, row, x)) { ok = false; break; }
    }
    game.movers.forEach((m, i) => { m.x = saved[i]; });
    return ok && !carAt(game, row, x);
  };
  const freeBayNear = (c) => {
    let best = -1, bd = 99;
    SLOTS.forEach((s, j) => { if (!game.slots[j]) { const d = Math.abs(s - c); if (d < bd) { bd = d; best = s; } } });
    return best;
  };
  const up = f.r - 1, cur = rowKind(f.r);
  if (cur === 'road') {
    if (up >= 0) {
      const uk = rowKind(up);
      if (uk === 'safe') {
        if (up !== 0) return { up: true };
        if (SLOTS.includes(f.c) && !game.slots[SLOTS.indexOf(f.c)]) return { up: true };
        const b = freeBayNear(f.c);
        return b !== -1 && b < f.c ? { left: true } : { right: true };
      }
      if (uk === 'road' && clearAhead(up, f.c, 0.6)) return { up: true };
      if (uk === 'river' && logUnder(game, up, f.c)) return { up: true };
    }
    if (!clearAhead(f.r, f.x, 0.7)) {
      for (const [k, dx] of [['left', -1], ['right', 1]]) {
        const nx = f.c + dx;
        if (nx >= 0 && nx < COLS && clearAhead(f.r, nx, 0.7)) return { [k]: true };
      }
      if (f.r + 1 <= 11 && rowKind(f.r + 1) === 'safe') return { down: true };
      if (up >= 0 && rowKind(up) === 'road' && !carAt(game, up, f.c)) return { up: true };
    }
    return {};
  }
  if (cur === 'river') {
    if (up >= 0) {
      const uk = rowKind(up);
      if (uk === 'safe') {
        if (up !== 0) return { up: true };
        if (SLOTS.includes(f.c) && !game.slots[SLOTS.indexOf(f.c)]) return { up: true };
        const b = freeBayNear(f.c);
        if (b !== -1) {
          const dirs = b <= f.c ? ['left', 'right'] : ['right', 'left'];
          for (const k of dirs) {
            const nx = f.c + (k === 'left' ? -1 : 1);
            if (nx >= 0 && nx < COLS && logUnder(game, f.r, nx)) return { [k]: true };
          }
        }
        return {};
      }
      if (uk === 'river' && logUnder(game, up, f.c)) return { up: true };
      if (uk === 'river') {
        const b = freeBayNear(f.c);
        const dirs = b !== -1 && b > f.c ? ['right', 'left'] : ['left', 'right'];
        for (const k of dirs) {
          const nx = f.c + (k === 'left' ? -1 : 1);
          if (nx >= 0 && nx < COLS && logUnder(game, f.r, nx) && logUnder(game, up, nx)) {
            return { [k]: true };
          }
        }
      }
    }
    return {};
  }
  if (up < 0) return {};
  const uk = rowKind(up);
  if (uk === 'safe') {
    if (up === 0) {
      const b = freeBayNear(f.c);
      if (b === -1) return {};
      if (b === f.c) return game.slots[SLOTS.indexOf(f.c)] ? {} : { up: true };
      return b < f.c ? { left: true } : { right: true };
    }
    return { up: true };
  }
  if (uk === 'road') return clearAhead(up, f.c, 1.0) ? { up: true } : {};
  if (uk === 'river') {
    if (logUnder(game, up, f.c)) return { up: true };
    for (const [k, dx] of [['left', -1], ['right', 1]]) {
      const nx = f.c + dx;
      if (nx >= 0 && nx < COLS && logUnder(game, up, nx)) return { [k]: true };
    }
  }
  return {};
}

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playCrossing(seed, targetBays, maxT) {
  const game = create(mulberry(seed));
  let t = 0, bays = 0;
  while (t < maxT && !game.over && bays < targetBays) {
    update(game, H, botInput(game));
    for (const e of drain(game)) if (e.name === 'goal') bays++;
    t += H;
  }
  return { game, bays };
}

scenario('a careful crossing fills the first bay on every seed', () => {
  for (const seed of [11, 22, 33, 44, 55, 66]) {
    const { bays, game } = playCrossing(seed * 7919, 1, TIME_LIMIT);
    check(bays >= 1, `seed ${seed}: no bay filled in ${TIME_LIMIT}s (${game.lives} lives left)`);
  }
});

scenario('a careful wave clears all five bays', () => {
  const { bays, game } = playCrossing(104729 + 7, 5, 600);
  check(bays >= 5, `only ${bays}/5 bays filled (${game.lives} lives left)`);
});

scenario('every facing, every particle and the urgent clock draw without a browser', () => {
  const ctx = headlessContext();
  for (const [key, dx, dy] of [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]]) {
    const game = create(HALF);
    game.movers = [];
    game.frog = { c: 6, r: 5, x: 6, y: 5, fx: dx, fy: dy };
    game.timer = 4.5; // urgent clock pulses
    update(game, H, { up: true }); // dust in the air
    draw(ctx, game, { time: 1.5, W: 500, best: 999, banner: '', bannerAlpha: 0 });
    check(true, `facing ${key} drew`);
  }
});

await run('hop across');
