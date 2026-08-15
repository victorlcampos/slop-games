// The match: two castles, one shot at a time, and everything that shot does on
// the way down.
//
// Nothing in here draws or plays a sound. What it does instead is push plain
// objects onto `events`, which whoever is driving the match picks up once a
// frame — that is what lets the whole game be played in Node, at full speed,
// with no canvas anywhere (CLAUDE.md, section 6).

import {
  CASTLE_X, CELL, CLIMB_COST, CLIMB_LIMIT, COLS, DRIVE_FUEL, GRAVITY, GUN_HEIGHT, LEASH,
  LEVELS, MAX_SEG, MIN_POWER, POWER_SPEED, TURN_LIMIT, W, WIND_MAX, clamp, makeRng, other,
} from './config.js';
import { material } from './materials.js';
import { ARSENAL, WEAPONS, craterRadius, damageAgainst, groundBonus, loadout } from './weapons.js';
import { FLOOR_Y, buildTerrain } from './terrain.js';
import { createCastle, grounded, gunSeat, settle, surfaceAt } from './structure.js';
import { WAVE_EVERY, reapMinions, spawnWave, tickMinions, unlockedMinions } from './minions.js';

const DEG = Math.PI / 180;
/** How far past the edge of the map a shell may still be coming down. */
const OFF_MAP = 280;

/**
 * @param {object} cfg
 * @param {object} cfg.level        one entry of LEVELS
 * @param {string} cfg.faction      the side the player is on
 * @param {object} cfg.blueprint    the player's castle, from the workshop
 * @param {object} cfg.foeBlueprint the enemy's, from `castles.js`
 * @param {object} [cfg.loadout]    the munitions the player bought, by id
 * @param {number} [cfg.seed]
 */
export function createMatch(cfg) {
  const { level, faction, blueprint, foeBlueprint, seed = 7 } = cfg;
  const rng = makeRng(seed * 2654435761);
  const terrain = buildTerrain({ kind: level.terrain, seed, middle: level.middle });

  const match = {
    level,
    terrain,
    rng,
    faction: { player: faction, enemy: other2(faction) },
    castles: {
      player: createCastle('player', blueprint),
      enemy: createCastle('enemy', foeBlueprint),
    },
    // the player's rack is whatever the workshop sold them; the enemy's grows
    // with the campaign tier, because the forge gunner arrives better supplied
    ammo: {
      player: loadout(faction, cfg.loadout),
      enemy: loadout(other2(faction), null, (level.foe && level.foe.tier) || 0),
    },
    weapon: { player: ARSENAL[faction][0], enemy: ARSENAL[other2(faction)][0] },
    launchers: {
      player: { side: 'player', x: 0, y: 0, angle: 45, recoil: 0, dir: 1, fuel: DRIVE_FUEL, wheel: 0, blocked: 0 },
      enemy: { side: 'enemy', x: 0, y: 0, angle: 45, recoil: 0, dir: -1, fuel: DRIVE_FUEL, wheel: 0, blocked: 0 },
    },
    turn: 'player',
    turnCount: 0,
    wind: 0,
    shots: [],
    minions: [],
    /** How far up the campaign this siege is — what the ground war has unlocked. */
    stage: Math.max(0, LEVELS.indexOf(level)),
    events: [],
    over: null,
    pending: false,
    lastShot: { player: null, enemy: null },
  };

  /**
   * A read-only twin of the match, for firing ghosts through.
   *
   * The AI plans a turn by tracing several hundred shots, and a trace is only
   * allowed to *read* the world. It was not: the drill's collision announced
   * itself with `world.say('burrow')`, so every ghost drill the opponent
   * considered threw a spray of dirt onto the real battlefield — a hundred and
   * forty-one of them per turn, appearing along trajectories nobody fired, at
   * spots that never got a crater because nothing had actually landed there.
   *
   * The flag-and-check version of this fix works until the next person adds an
   * event to the collision path. A world whose `say` goes nowhere cannot be got
   * wrong that way.
   */
  match.ghost = {
    terrain,
    get castles() {
      return match.castles;
    },
    get wind() {
      return match.wind;
    },
    say() {},
  };

  match.wind = rollWind(rng);
  for (const side of ['player', 'enemy']) {
    const seat = gunSeat(match.castles[side], terrain);
    match.launchers[side].x = seat.x;
  }
  restand(match);

  // ------------------------------------------------------------------ api

  /** Everything that happened since the last call. */
  match.take = () => {
    const out = match.events;
    match.events = [];
    return out;
  };

  match.say = (kind, data) => {
    match.events.push({ kind, ...data });
  };

  match.ammoFor = (side, id) => match.ammo[side][id];

  match.pick = (side, id) => {
    if (!ARSENAL[match.faction[side]].includes(id)) return false;
    if (!(match.ammo[side][id] > 0)) return false;
    match.weapon[side] = id;
    return true;
  };

  /** Aim, in degrees above the horizon, always measured towards the enemy. */
  match.aim = (side, angle) => {
    match.launchers[side].angle = clamp(angle, 4, 89);
  };

  /**
   * Let one go. Returns the shot, or null if that side has nothing to fire —
   * which cannot happen, because the basic weapon has no ammunition counter.
   */
  match.fire = (side, power) => {
    if (match.over) return null;
    const id = match.weapon[side];
    const w = WEAPONS[id];
    if (!(match.ammo[side][id] > 0)) return null;
    if (match.ammo[side][id] !== Infinity) match.ammo[side][id]--;

    const L = match.launchers[side];
    const p = clamp(power, MIN_POWER, 100);
    const shot = spawnShot(L, w, side, p);
    match.shots.push(shot);
    L.recoil = 1;
    match.lastShot[side] = { angle: L.angle, power: p, weapon: id, path: [] };
    match.say('fire', { side, weapon: id, power: p, x: shot.x, y: shot.y });
    if (!match.ammo[side][id]) {
      // out of this one: fall back to the endless shot so the dock is never empty
      match.weapon[side] = ARSENAL[match.faction[side]][0];
    }
    return shot;
  };

  match.flying = () => match.shots.length > 0;

  /** How far this engine may wander from its own plot. */
  match.leash = (side) => ({
    min: CASTLE_X[side] - LEASH,
    max: CASTLE_X[side] + COLS * CELL + LEASH,
  });

  /**
   * Drive, in the shape Gunbound gave it: hold a direction, watch the fuel go
   * down, and stop when it runs out or the wall in front is too tall to climb.
   *
   * Returns how far it actually moved, which is not always what was asked —
   * running out of fuel mid-step and running into a step are both normal.
   */
  match.drive = (side, dx) => {
    const L = match.launchers[side];
    if (match.over || match.flying() || !dx) return 0;
    if (L.fuel <= 0) return 0;

    const castle = match.castles[side];
    const bounds = match.leash(side);
    const want = clamp(L.x + dx, bounds.min, bounds.max);
    const step = want - L.x;
    if (!step) return 0;

    const ny = surfaceAt(castle, match.terrain, want);
    const climb = L.y - ny; // positive is uphill
    if (climb > CLIMB_LIMIT) {
      L.blocked = 0.4;
      return 0;
    }
    const cost = Math.abs(step) + Math.max(0, climb) * CLIMB_COST;
    if (cost > L.fuel) {
      // spend what is left on a shorter step rather than refusing the whole thing
      const fraction = L.fuel / cost;
      L.fuel = 0;
      L.x += step * fraction;
      L.y = surfaceAt(castle, match.terrain, L.x);
      L.wheel += step * fraction * 0.09;
      return step * fraction;
    }
    L.fuel -= cost;
    L.x = want;
    L.y = ny;
    L.wheel += step * 0.09;
    return step;
  };

  /** One physics step. Call it with the loop's fixed `h` and nothing else. */
  match.tick = (h) => {
    if (match.over) return;
    for (const L of Object.values(match.launchers)) {
      L.recoil = Math.max(0, L.recoil - h * 3);
      L.blocked = Math.max(0, L.blocked - h);
    }

    // the ground war walks in real time, turns or no turns; a bitten-through
    // wall owes the world the same sweep a shell does
    if (tickMinions(match, h)) sweep(match);
    if (match.over) return;

    for (let i = match.shots.length - 1; i >= 0; i--) {
      const s = match.shots[i];

      // A cluster opens at the top of its arc, where the parent stops being a
      // shot and becomes three of them. You aim the middle one.
      if (s.split && !s.child && s.vy >= 0 && s.t > 0.35) {
        match.shots.splice(i, 1);
        const n = s.split;
        for (let k = 0; k < n; k++) {
          const spread = (k - (n - 1) / 2) * 44;
          match.shots.push({ ...s, child: true, split: 0, trail: [], vx: s.vx + spread, vy: s.vy - 30 });
        }
        match.say('split', { x: s.x, y: s.y });
        continue;
      }

      const hit = advance(s, match, h);
      // the ghost trail stops at the surface: a dotted line carrying on *into*
      // a hill is the single most convincing way to look like a collision bug
      const path = match.lastShot[s.side];
      // and the trail stops at the edge of the world as well as at the crust,
      // rather than dangling out over the void where nobody can see it end
      if (path && !s.child && !s.dug && s.x > -20 && s.x < W + 20) {
        path.path.push({ x: s.x, y: s.y });
      }
      if (!hit) continue;
      match.shots.splice(i, 1);
      resolveHit(match, s, hit);
    }
    if (!match.shots.length && match.pending) {
      match.pending = false;
      endTurn(match);
    }
  };

  /** Marks the turn as spent: it ends as soon as the last fragment lands. */
  match.commit = () => {
    match.pending = true;
  };

  /**
   * Where a shot would land, without firing it. The AI's only sense organ, and
   * the same arithmetic the real shot uses — an opponent that aimed with
   * different physics would be cheating in one direction or the other.
   */
  match.trace = (side, id, angle, power) => trace(match, side, id, angle, power);

  // the first wave marches with the first turn, and a siege that just reached
  // a new unlock says so — a mechanic nobody is told about is a bug report
  for (const side of ['player', 'enemy']) spawnWave(match, side, match.stage);
  for (const spec of unlockedMinions(faction, match.stage)) {
    if (spec.unlock === match.stage && match.stage > 0) match.say('recruit', { kind: spec.id });
  }

  return match;
}

const other2 = (f) => (f === 'knights' ? 'machines' : 'knights');

function rollWind(rng) {
  return (rng() * 2 - 1) * WIND_MAX;
}

/**
 * Put each siege engine back on top of its own castle.
 *
 * Called after every collapse, and that is the point: shoot the tower out from
 * under an engine and it comes down with the tower, losing the height — and the
 * range — that the tower was buying it.
 */
export function restand(match) {
  for (const side of ['player', 'enemy']) {
    const L = match.launchers[side];
    // it keeps where it drove to; only the height under it is re-read
    const y = surfaceAt(match.castles[side], match.terrain, L.x);
    const dropped = L.y && y > L.y + 1;
    L.y = y;
    if (dropped) match.say('gunfell', { side, x: L.x, y });
  }
}

/** The muzzle, and the speed leaving it. */
export function spawnShot(L, w, side, power) {
  const a = L.angle * DEG;
  const dir = L.dir;
  const speed = (power / 100) * POWER_SPEED * w.speed;
  const px = L.x + dir * Math.cos(a) * 36;
  const py = L.y - GUN_HEIGHT - Math.sin(a) * 36;
  return {
    side,
    w: w.id,
    x: px,
    y: py,
    vx: Math.cos(a) * speed * dir,
    vy: -Math.sin(a) * speed,
    t: 0,
    pierce: w.pierce || 0,
    burrow: 0,
    split: w.split || 0,
    child: false,
    trail: [],
  };
}

/**
 * Move a shot one step and say what it ran into.
 *
 * It mutates the shot and nothing else, which is what lets the AI run it a few
 * hundred times against the live world to plan a turn without disturbing it.
 */
export function advance(s, world, h) {
  const w = WEAPONS[s.w];
  s.vy += GRAVITY * h;
  s.vx += world.wind * w.wind * h;
  s.t += h;

  const dist = Math.hypot(s.vx, s.vy) * h;
  const n = Math.max(1, Math.min(24, Math.ceil(dist / MAX_SEG)));
  for (let i = 0; i < n; i++) {
    s.x += (s.vx * h) / n;
    s.y += (s.vy * h) / n;
    if (s.burrow > 0) {
      s.burrow -= h / n;
      // digging is not flying: it slows as it goes, so the hole ends up under
      // the wall it was aimed at rather than half a screen past it
      const drag = 1 - (w.burrowDrag || 0) * (h / n);
      s.vx *= drag;
      s.vy *= drag;
      if (s.burrow <= 0) return { kind: 'terrain', x: s.x, y: s.y };
      continue;
    }
    const hit = probe(world, s);
    if (hit) return hit;
  }
  // a shot that leaves the field or wanders for a quarter of a minute is over
  if (s.t > 14) return { kind: 'out', x: s.x, y: s.y };
  return null;
}

function probe(world, s) {
  // Generous walls. The ground carries on past both edges of the map (see
  // `terrain.solid`), so the only shells that reach these are the ones still in
  // the air — and giving them a few hundred pixels of run-off turns a fair
  // number of "it vanished" into "it landed over there", which is a much better
  // answer to what just happened to your turn.
  if (s.x < -OFF_MAP || s.x > W + OFF_MAP) return { kind: 'out', x: s.x, y: s.y };
  if (s.y > FLOOR_Y + 40) return { kind: 'out', x: s.x, y: s.y };
  // above the sky is not a wall: it comes back down
  if (s.y < -400) return null;

  for (const side of ['player', 'enemy']) {
    const castle = world.castles[side];
    const cell = castle.cellAt(s.x, s.y);
    if (!cell) continue;
    const b = castle.at(cell.c, cell.r);
    if (b) return { kind: 'block', x: s.x, y: s.y, castle, block: b };
  }

  if (world.terrain.solid(s.x, s.y)) {
    const w = WEAPONS[s.w];
    if (w.burrow && s.burrow <= 0 && !s.dug) {
      // a drill does not stop at the surface, it goes looking for the cellar
      s.dug = true;
      s.burrow = w.burrow;
      world.say('burrow', { x: s.x, y: s.y });
      return null;
    }
    return { kind: 'terrain', x: s.x, y: s.y };
  }
  return null;
}

// ----------------------------------------------------------------- the hit

function resolveHit(match, s, hit) {
  const w = WEAPONS[s.w];

  if (hit.kind === 'out') {
    // A shell that leaves the valley used to do nothing at all: no crater, no
    // noise, no word — the trail just stopped in mid-air and the turn changed
    // hands. Nine per cent of shots end this way and every one of them looked
    // like the game had dropped it.
    match.say('miss', { x: hit.x, y: hit.y, side: s.side, over: s.y < 0 });
    return;
  }

  // A bolt spends itself on one cell rather than on a circle, and keeps going
  // through whatever it breaks.
  if (hit.kind === 'block' && s.pierce > 0) {
    const b = hit.block;
    const dmg = damageAgainst(w, b.m, material(b.m).blast) * groundBonus(w, match.terrain.kind);
    strike(match, hit.castle, b, dmg);
    match.say('pierce', { x: hit.x, y: hit.y, weapon: w.id, dmg: Math.round(dmg) });
    s.pierce--;
    if (b.hp <= 0 && b.m !== 'king') {
      // straight through the hole it just made
      sweep(match);
      s.x += Math.sign(s.vx) * 6;
      match.shots.push(s);
      return;
    }
    // The bolt lodged. It still cracks what is around it — but not the cell it
    // is stuck in: that one already took the full hit a line above, and letting
    // the blast reach it too was quietly doing a bolt's damage twice, which
    // ended matches on turn one.
    detonate(match, s.x, s.y, w, s.side, b, s);
    return;
  }

  detonate(match, s.x, s.y, w, s.side, null, s);
}

/**
 * Everything a blast does, in one place: earth, walls, king, fire and arcs.
 *
 * @param {object} [vel] the shell's velocity on arrival, so the debris can fly
 *                       *away* from where the shot came from instead of evenly
 */
export function detonate(match, x, y, w, side, exclude = null, vel = null) {
  const spec = match.terrain.spec;
  const gb = groundBonus(w, match.terrain.kind);
  const crater = craterRadius(w, match.terrain.kind, spec.dig);
  const moved = match.terrain.carve(x, y, crater);
  if (moved > 0 && crater > 26) match.terrain.raise(x, crater * 1.7, Math.min(6, crater * 0.08));

  const reach = w.radius * gb;
  // the hardest-hit walls get their number said out loud — the renderer floats
  // it off the block, which is what makes "did that even do anything" visible
  const told = [];
  for (const castleSide of ['player', 'enemy']) {
    const castle = match.castles[castleSide];
    for (const b of castle.blocks()) {
      if (b === exclude) continue;
      const rect = castle.rect(b.c, b.r);
      const d = rectDistance(rect, x, y);
      if (d >= reach) continue;
      const falloff = (1 - d / reach) ** 0.75;
      const dmg = damageAgainst(w, b.m, material(b.m).blast) * falloff * gb;
      strike(match, castle, b, dmg);
      if (dmg >= 5 && b.m !== 'king') told.push({ dmg, ...castle.centre(b.c, b.r) });
      if (w.fire && material(b.m).burns && falloff > 0.25) b.fire = Math.max(b.fire, w.fire);
      if (w.rust && material(b.m).rusts && falloff > 0.25) b.rust = Math.max(b.rust, w.rust);
    }
  }
  told.sort((a, b) => b.dmg - a.dmg);
  for (const h of told.slice(0, 3)) match.say('hit', { x: h.x, y: h.y, dmg: Math.round(h.dmg) });

  // Walkers are soft on purpose: any shell is an answer to a column of them —
  // theirs, to free your own march, or yours, if you aimed that badly.
  if (match.minions) {
    const kill = reach + 14;
    for (const mn of match.minions) {
      const d = Math.hypot(mn.x - x, mn.y - 12 - y);
      if (d < kill) mn.hp -= w.damage * (1 - d / kill);
    }
    reapMinions(match);
  }

  // The tesla coil looks for metal. On the scrapyard the whole field is metal,
  // which is exactly why the scrapyard is where you want to bring it.
  if (w.arc) {
    const range = w.arc * (spec.conduct ? 1.5 : 1);
    const target = nearestConductor(match, x, y, range);
    if (target) {
      const { castle, block } = target;
      const c = castle.centre(block.c, block.r);
      strike(match, castle, block, damageAgainst(w, block.m, material(block.m).blast) * 0.8 * gb);
      match.say('arc', { x, y, tx: c.x, ty: c.y });
    }
  }

  match.say('boom', { x, y, weapon: w.id, radius: reach, crater, vx: vel ? vel.vx : 0, vy: vel ? vel.vy : 0 });
  sweep(match);
}

function strike(match, castle, b, dmg) {
  if (dmg <= 0) return;
  b.hp -= dmg;
  b.shake = 1;
  if (b.m === 'king') {
    match.say('kinghit', { side: castle.side, damage: dmg, hp: Math.max(0, b.hp), ...castle.centre(b.c, b.r) });
  }
}

function nearestConductor(match, x, y, range) {
  let best = null;
  let bestD = range;
  for (const side of ['player', 'enemy']) {
    const castle = match.castles[side];
    for (const b of castle.blocks()) {
      if (b.m !== 'iron' && b.m !== 'crystal') continue;
      const c = castle.centre(b.c, b.r);
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bestD && d > 6) {
        bestD = d;
        best = { castle, block: b };
      }
    }
  }
  return best;
}

/** Clear the dead, let what is left fall, and see whether a king is under it. */
export function sweep(match) {
  for (const side of ['player', 'enemy']) {
    const castle = match.castles[side];
    const king = castle.king();
    for (const b of castle.blocks()) {
      if (b.m !== 'king' && b.hp <= 0) {
        castle.remove(b.c, b.r);
        match.say('break', { side, m: b.m, ...castle.centre(b.c, b.r) });
      }
    }
    for (const ev of settle(castle, match.terrain)) {
      const c = castle.centre(ev.block.c, ev.block.r);
      match.say(ev.kind === 'fall' ? 'tumble' : 'break', { side, m: ev.block.m, x: c.x, y: c.y });
      if (ev.kind === 'pit' && ev.block.m === 'king') {
        match.say('kinghit', { side, damage: 999, hp: 0, ...castle.centre(ev.block.c, ev.block.r) });
      }
    }

    // The floor going out from under the crown costs him, once — not once per
    // shell that lands anywhere afterwards, which is what the flag is for.
    if (king && king.r === 0 && !king.sunk && !grounded(castle, match.terrain, king.c)) {
      king.sunk = true;
      king.hp -= 44;
      king.shake = 1;
      match.say('kinghit', { side, damage: 44, hp: Math.max(0, king.hp), ...castle.centre(king.c, king.r) });
    }
  }
  restand(match);
  checkOver(match);
}

function checkOver(match) {
  if (match.over) return;
  const p = match.castles.player.kingAlive();
  const e = match.castles.enemy.kingAlive();
  if (p && e) return;
  if (!p && !e) match.over = { winner: 'draw', reason: 'both' };
  else match.over = { winner: p ? 'player' : 'enemy', reason: 'king' };
  match.say('over', match.over);
}

// ---------------------------------------------------------------- the turn

function endTurn(match) {
  if (match.over) return;

  // fire and rust are the two weapons that keep working after the turn is over
  for (const side of ['player', 'enemy']) {
    const castle = match.castles[side];
    const catching = [];
    for (const b of castle.blocks()) {
      if (b.fire > 0) {
        b.hp -= 26;
        b.fire--;
        for (const n of neighbours(castle, b)) if (material(n.m).burns && !n.fire) catching.push(n);
      }
      if (b.rust > 0) {
        b.hp -= 30;
        b.rust--;
        for (const n of neighbours(castle, b)) if (material(n.m).rusts && !n.rust) catching.push(n);
      }
    }
    for (const n of catching) {
      if (material(n.m).burns) n.fire = 2;
      else n.rust = 2;
    }
  }
  sweep(match);
  if (match.over) return;

  match.turnCount++;
  if (match.turnCount >= TURN_LIMIT) {
    const p = match.castles.player.king();
    const e = match.castles.enemy.king();
    const dp = p ? p.hp : 0;
    const de = e ? e.hp : 0;
    match.over =
      dp === de
        ? { winner: match.castles.player.integrity() >= match.castles.enemy.integrity() ? 'player' : 'enemy', reason: 'walls' }
        : { winner: dp > de ? 'player' : 'enemy', reason: 'time' };
    match.say('over', match.over);
    return;
  }

  match.turn = other(match.turn);
  match.wind = rollWind(match.rng);
  // a full tank every turn: fuel is a per-turn allowance, not a resource to hoard
  match.launchers[match.turn].fuel = DRIVE_FUEL;
  // both sides muster on the same beat, so neither army ever outnumbers by schedule
  if (match.turnCount % WAVE_EVERY === 0) {
    for (const side of ['player', 'enemy']) spawnWave(match, side, match.stage);
  }
  match.say('turn', { side: match.turn, wind: match.wind });
}

function neighbours(castle, b) {
  const out = [];
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = castle.at(b.c + dc, b.r + dr);
    if (n && n.m !== 'king') out.push(n);
  }
  return out;
}

// --------------------------------------------------------------- prediction

/** The distance from a point to the nearest edge of a rectangle (0 inside). */
export function rectDistance(rect, x, y) {
  const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.w));
  const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.h));
  return Math.hypot(dx, dy);
}

/**
 * Fire a ghost: same launcher, same physics, same world — but the world is only
 * read. Returns where it stopped and what it stopped against.
 */
export function trace(match, side, id, angle, power, step = 1 / 45) {
  const w = WEAPONS[id];
  const L = match.launchers[side];
  const ghostLauncher = { ...L, angle: clamp(angle, 4, 89) };
  const s = spawnShot(ghostLauncher, w, side, clamp(power, MIN_POWER, 100));
  // through the twin, never through the match itself
  const world = match.ghost || match;
  for (let i = 0; i < 900; i++) {
    const hit = advance(s, world, step);
    if (hit) {
      return {
        x: hit.x,
        y: hit.y,
        kind: hit.kind,
        m: hit.block ? hit.block.m : null,
        side: hit.castle ? hit.castle.side : null,
        time: s.t,
      };
    }
  }
  return { x: s.x, y: s.y, kind: 'out', m: null, side: null, time: s.t };
}
