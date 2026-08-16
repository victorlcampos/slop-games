// The living and the dead, one step at a time.
//
// Everything here is a plain function over the world's state — no canvas, no
// clock of its own — which is what lets a test march a zombie across the board
// and read what it chewed through on the way.

import { BUILDINGS, buildingAt, centerOf } from './buildings.js';
import { ZOMBIES } from './hordes.js';
import { dist } from './config.js';

// A soldier costs bread and a spear — never gold. Gold is the market's late
// game (towers, archers): gating the basic sword on it left every playtest
// with a two-man army and a year-three grave.
export const UNITS = {
  soldier: { hp: 60, dps: 13, range: 0.7, speed: 2.2, aggro: 6, cost: { food: 20, wood: 8 } },
  archer: { hp: 40, dps: 7, range: 4.5, speed: 2.2, aggro: 7, cost: { food: 15, wood: 12, gold: 6 }, shot: true },
};

let nextId = 1;
export function makeUnit(kind, x, y, squad = 0) {
  return { id: nextId++, kind, x, y, squad, hp: UNITS[kind].hp, cool: 0, jx: Math.random() - 0.5, jy: Math.random() - 0.5 };
}

export function makeZombie(kind, x, y, hpScale = 1) {
  const spec = ZOMBIES[kind];
  const hp = Math.round(spec.hp * hpScale);
  const id = nextId++;
  return {
    id, kind, x, y, hp, max: hp, cool: 0, wob: Math.random() * Math.PI * 2,
    // each of the dead walks its own walk: a personal pace dealt from the id
    gait: 0.8 + ((id * 37) % 41) / 100,
    ph: (id % 13) / 2,
  };
}

export function nearestZombie(world, x, y, within = Infinity) {
  let best = null;
  let bestD = within;
  for (const z of world.zombies) {
    const d = dist(z.x, z.y, x, y);
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return best;
}

function nearestUnit(world, x, y, within = Infinity) {
  let best = null;
  let bestD = within;
  for (const u of world.units) {
    const d = dist(u.x, u.y, x, y);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

function nearestBuilding(world, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const b of world.buildings) {
    const c = centerOf(b);
    const d = dist(c.x, c.y, x, y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/**
 * What this unit should be fighting: the dead near it — or, failing that, any
 * of the dead with its teeth in a building, wherever that is. Without the
 * second clause a stray on the far side of the map ate the sawmill while the
 * whole army stood at the flag watching (found by the scripted playtest).
 */
function findPrey(world, u, spec) {
  const near = nearestZombie(world, u.x, u.y, spec.aggro);
  if (near) return near;
  let best = null;
  let bestD = Infinity;
  for (const z of world.zombies) {
    if (!z.threat) continue;
    const d = dist(u.x, u.y, z.x, z.y);
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return best;
}

export function stepUnit(world, u, h) {
  const spec = UNITS[u.kind];
  u.cool = Math.max(0, u.cool - h);

  // Peace mends what winter cut — and peace is local: waiting for the whole
  // board to empty meant nobody healed at all once the stray years began.
  if (u.hp < spec.hp && !nearestZombie(world, u.x, u.y, spec.aggro)) {
    u.hp = Math.min(spec.hp, u.hp + 3 * h);
  }

  const prey = findPrey(world, u, spec);

  if (prey) {
    const d = dist(u.x, u.y, prey.x, prey.y);
    if (d > spec.range) {
      walk(u, prey.x, prey.y, spec.speed, h);
    } else if (spec.shot) {
      // an archer looses arrows on a cadence — the event is the arrow the
      // renderer draws and the sound the player hears
      if (u.cool === 0) {
        u.cool = 0.8;
        prey.hp -= spec.dps * 0.8;
        world.events.push({ kind: 'arrow', x: u.x, y: u.y, tx: prey.x, ty: prey.y });
      }
    } else {
      prey.hp -= spec.dps * h;
      if (u.cool === 0) {
        u.cool = 0.45;
        world.events.push({ kind: 'clash', x: prey.x, y: prey.y });
      }
    }
    return;
  }

  // nothing to fight: stand by the squad's own flag — the jitter is each
  // soldier's spot beside it, or the whole squad stacks into a single pixel
  const flag = world.squads[u.squad] || world.squads[0];
  const hx = flag.x + u.jx * 1.6;
  const hy = flag.y + u.jy * 1.6;
  if (dist(u.x, u.y, hx, hy) > 0.3) walk(u, hx, hy, spec.speed, h);
}

/**
 * A zombie wants flesh first, timber second: a defender close by is the meal,
 * otherwise the nearest building. A wall on the way is not an obstacle to walk
 * around — it is the thing between it and dinner, so it eats the wall.
 */
export function stepZombie(world, z, h) {
  const spec = ZOMBIES[z.kind];
  z.cool = Math.max(0, z.cool - h);
  z.ph += h * 3;

  const prey = nearestUnit(world, z.x, z.y, 3.2);
  let tx;
  let ty;
  let target = null;
  let bite = null;

  if (prey) {
    tx = prey.x;
    ty = prey.y;
    target = { unit: prey };
    if (dist(z.x, z.y, tx, ty) <= spec.reach) bite = () => (prey.hp -= spec.dps * h);
  } else {
    const b = nearestBuilding(world, z.x, z.y);
    if (!b) return; // nothing left to eat: the town is already gone
    const c = centerOf(b);
    tx = c.x;
    ty = c.y;
    target = { building: b };
    const bspec = BUILDINGS[b.id];
    // a building is a box, not a point: in reach when at its skirt
    const reachTo = spec.reach + Math.max(bspec.w, bspec.h) / 2;
    if (dist(z.x, z.y, tx, ty) <= reachTo) bite = () => chew(world, b, spec.dps * h, z);
  }

  // a spitter stops short and lobs bile instead of closing in
  if (spec.range && dist(z.x, z.y, tx, ty) <= spec.range && !bite) {
    z.threat = !!target.building;
    if (z.cool === 0) {
      z.cool = spec.spitEvery;
      const dmg = spec.dps * spec.spitEvery;
      if (target.unit) target.unit.hp -= dmg;
      else chew(world, target.building, dmg, z);
      world.events.push({ kind: 'spit', x: z.x, y: z.y - 0.3, tx, ty });
    }
    return;
  }

  if (bite) {
    bite();
    // teeth in the town: this one is now every soldier's business
    z.threat = !prey;
    if (z.cool === 0) {
      z.cool = 0.7;
      world.events.push({ kind: 'bite', x: z.x, y: z.y });
    }
    return;
  }

  const before = { x: z.x, y: z.y };
  // personality in the stride: walkers and crawlers lurch — surge, drag,
  // surge — while runners hold their sprint
  const lurch = z.kind === 'runner' || z.kind === 'brute'
    ? 1
    : 0.55 + 0.75 * Math.abs(Math.sin(z.ph + z.wob));
  walk(z, tx, ty, spec.speed * z.gait * lurch, h);
  // a runner weaves as it comes — harder to love, harder to hit
  if (z.kind === 'runner') {
    const d = dist(before.x, before.y, tx, ty) || 1;
    const sway = Math.sin(z.ph * 2.2) * 0.5 * h;
    z.x += (-(ty - before.y) / d) * sway;
    z.y += ((tx - before.x) / d) * sway;
  }
  // walked into something that is not the target: whatever it is, it is now
  // the target — this is how a wall does its job
  const hit = buildingAt(world, Math.floor(z.x), Math.floor(z.y));
  if (hit) {
    z.x = before.x;
    z.y = before.y;
    chew(world, hit, ZOMBIES[z.kind].dps * h, z);
    z.threat = true;
    if (z.cool === 0) {
      z.cool = 0.7;
      world.events.push({ kind: 'bite', x: z.x, y: z.y });
    }
  }
}

function chew(world, b, dmg, z) {
  const was = b.hp;
  b.hp -= dmg;
  b.hurtT = 0.3;
  // exactly one collapse per building, on the bite that crossed zero — the
  // world removes the wreck on its next pass
  if (was > 0 && b.hp <= 0) {
    world.events.push({ kind: 'collapse', x: z.x, y: z.y, id: b.id });
  }
}

function walk(mob, tx, ty, speed, h) {
  const d = dist(mob.x, mob.y, tx, ty);
  if (d < 1e-6) return;
  mob.x += ((tx - mob.x) / d) * speed * h;
  mob.y += ((ty - mob.y) / d) * speed * h;
}
