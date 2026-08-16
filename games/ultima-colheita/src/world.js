// The town, the years and the arithmetic between them.
//
// This is the whole game with the pixels removed: seasons turn, farms yield,
// mouths eat, walls stand or don't. It never touches a canvas or a clock —
// `tick(h)` is called with the same `h` forever, by the browser's loop and by
// the tests alike.

import {
  ARMY_EAT, COLS, EAT_RATE, GROW_COST, GROW_EVERY, HORN_LEAD, REPAIR_CREW,
  REPAIR_RATE, REPAIR_WOOD, RES_CAP, ROWS, SEASONS, SEASON_LEN, SQUAD_SIZE,
  STARVE_EVERY, START_POP, START_RES, TRAIN_TIME, QUEUE_MAX, YEAR_LEN, clamp,
} from './config.js';
import { BUILDINGS, buildingAt, centerOf, crewDemand, pay, siteYield, whyNot } from './buildings.js';
import { FARM_SEASON } from './config.js';
import { genMap, HALL_C, HALL_R } from './map.js';
import { TRICKLE, ZOMBIES, firstWave, gatesFor, hordeFor, hpScale, ranksFor, strayEvery } from './hordes.js';
import { UNITS, makeUnit, makeZombie, stepUnit, stepZombie } from './units.js';
import { advanceQuests } from './quests.js';

let nextBuildingId = 1;

export function createWorld(opts = {}) {
  const seed = opts.seed ?? 1;
  const world = {
    seed,
    map: genMap(seed),
    res: { ...START_RES },
    pop: START_POP,
    year: 1,
    tYear: 0,
    growT: 0,
    starveT: 0,
    strayT: 0,
    warned: false,
    hordeIn: false,
    pending: [], // the rest of the horde, still walking in
    trickleT: 0,
    spawned: 0,
    buildings: [],
    units: [],
    zombies: [],
    queue: [],
    questIdx: 0,
    // one flag per squad of five — the army stopped being a single blob the
    // day a player asked why every guard walked everywhere together
    squads: [{ x: HALL_C + 1, y: HALL_R + 3.2 }],
    repairCount: 0,
    stats: { kills: 0, years: 0, hordes: 0, lost: 0 },
    over: null,
    events: [],
  };

  if (opts.state) {
    restore(world, opts.state);
  } else {
    // the manor and the two guards the village starts with — the first winter
    // is small, but it is not free
    world.buildings.push({ uid: nextBuildingId++, id: 'hall', c: HALL_C, r: HALL_R, hp: BUILDINGS.hall.hp, built: 1, cool: 0 });
    world.units.push(makeUnit('soldier', HALL_C - 0.5, HALL_R + 2.5));
    world.units.push(makeUnit('soldier', HALL_C + 2.5, HALL_R + 2.5));
  }

  // ------------------------------------------------------------------ clock

  world.season = () => SEASONS[Math.min(SEASONS.length - 1, Math.floor(world.tYear / SEASON_LEN))];
  world.hall = () => world.buildings.find((b) => b.id === 'hall') || null;
  world.popCap = () =>
    8 + world.buildings.reduce((n, b) => n + (b.built >= 1 ? BUILDINGS[b.id].popCap || 0 : 0), 0);
  /** Every head under the town's roofs: villagers, the army, the training
   *  yard. A soldier does not stop needing a bed by picking up a sword. */
  world.heads = () => world.pop + world.units.length + world.queue.length;
  /** 0..1: how staffed the economy is. The army is villagers who left it,
   *  and every repair site pulls a couple more hands off the fields. */
  world.efficiency = () => {
    const need = crewDemand(world) + world.repairCount * REPAIR_CREW;
    return need === 0 ? 1 : Math.min(1, world.pop / need);
  };

  /** Which squad a fresh recruit joins: the first with room, or a new one. */
  world.pickSquad = () => {
    const members = world.squads.map(() => 0);
    for (const u of world.units) if (members[u.squad] !== undefined) members[u.squad]++;
    for (let i = 0; i < members.length; i++) if (members[i] < SQUAD_SIZE) return i;
    const last = world.squads[world.squads.length - 1];
    world.squads.push({ x: clamp(last.x + 1.5, 1, COLS - 1), y: clamp(last.y + 1, 1, ROWS - 1) });
    return world.squads.length - 1;
  };

  // --------------------------------------------------------------- commands

  world.place = (id, c, r) => {
    const why = whyNot(world, id, c, r);
    if (why) return why;
    pay(world.res, id);
    const spec = BUILDINGS[id];
    world.buildings.push({ uid: nextBuildingId++, id, c, r, hp: spec.hp, built: spec.raise ? 0 : 1, cool: 0 });
    world.events.push({ kind: 'place', x: c + spec.w / 2, y: r + spec.h / 2 });
    return null;
  };

  world.demolish = (c, r) => {
    const b = buildingAt(world, c, r);
    if (!b || b.id === 'hall') return 'why.keep';
    // half the stone comes back out of the rubble
    for (const [k, v] of Object.entries(BUILDINGS[b.id].cost)) {
      world.res[k] = clamp(world.res[k] + Math.floor(v / 2), 0, RES_CAP);
    }
    world.buildings.splice(world.buildings.indexOf(b), 1);
    world.events.push({ kind: 'demolish', ...centerOf(b) });
    return null;
  };

  world.train = (kind) => {
    const spec = UNITS[kind];
    if (!spec) return 'why.unknown';
    const school = world.buildings.find((b) => BUILDINGS[b.id].trains === kind && b.built >= 1);
    if (!school) return kind === 'soldier' ? 'why.needsBarracks' : 'why.needsRange';
    if (world.queue.length >= QUEUE_MAX) return 'why.queueFull';
    if (world.pop <= 1) return 'why.noHands';
    for (const [k, v] of Object.entries(spec.cost)) if ((world.res[k] || 0) < v) return 'why.poor';
    for (const [k, v] of Object.entries(spec.cost)) world.res[k] -= v;
    world.pop -= 1; // a soldier is a villager who put the hoe down
    world.queue.push({ kind, t: TRAIN_TIME });
    return null;
  };

  /**
   * Post a squad's flag — or, with no squad named, the whole army's: each
   * squad fans out around the point instead of stacking on one pixel.
   */
  world.setRally = (x, y, squad = null) => {
    const cx = clamp(x, 0.5, COLS - 0.5);
    const cy = clamp(y, 0.5, ROWS - 0.5);
    if (squad !== null && world.squads[squad]) {
      world.squads[squad] = { x: cx, y: cy };
    } else {
      world.squads.forEach((s, i) => {
        const ring = i === 0 ? 0 : 1.9;
        const ang = i * 2.1;
        world.squads[i] = {
          x: clamp(cx + Math.cos(ang) * ring, 0.5, COLS - 0.5),
          y: clamp(cy + Math.sin(ang) * ring, 0.5, ROWS - 0.5),
        };
      });
    }
    world.events.push({ kind: 'rally', x: cx, y: cy });
  };

  // ------------------------------------------------------------------- tick

  world.tick = (h) => {
    if (world.over) return;
    world.tYear += h;
    const season = world.season();

    repairs(world, h);
    economy(world, h, season);
    people(world, h);
    training(world, h);
    towers(world, h);

    for (const u of world.units) stepUnit(world, u, h);
    for (const z of world.zombies) stepZombie(world, z, h);
    reap(world);

    for (const id of advanceQuests(world)) world.events.push({ kind: 'quest', id });

    calendar(world, h);
  };

  /**
   * What each resource is doing per second, as the standing town earns and
   * eats it. This is the answer to "where does wood come from" written on the
   * screen instead of discovered by staring at a number.
   */
  world.rates = () => {
    const out = { food: 0, wood: 0, stone: 0, gold: 0 };
    const eff = world.efficiency();
    const season = world.season();
    for (const b of world.buildings) {
      const spec = BUILDINGS[b.id];
      if (!spec.yields || b.built < 1) continue;
      const seasonMult = spec.seasonal ? FARM_SEASON[season] : 1;
      const staffed = spec.crew ? eff : 1;
      const site = siteYield(world.map, b);
      for (const [k, rate] of Object.entries(spec.yields)) {
        out[k] += rate * seasonMult * staffed * site;
      }
    }
    out.food -= (world.pop + world.queue.length) * EAT_RATE + world.units.length * ARMY_EAT;
    return out;
  };

  // ----------------------------------------------------------- persistence

  world.serialize = () => ({
    seed: world.seed,
    res: { ...world.res },
    pop: world.pop,
    year: world.year,
    tYear: world.tYear,
    warned: world.warned,
    hordeIn: world.hordeIn,
    pending: world.pending.slice(),
    spawned: world.spawned,
    buildings: world.buildings.map((b) => ({ id: b.id, c: b.c, r: b.r, hp: b.hp, built: b.built })),
    units: world.units.map((u) => ({ kind: u.kind, x: u.x, y: u.y, hp: u.hp, squad: u.squad })),
    zombies: world.zombies.map((z) => ({ kind: z.kind, x: z.x, y: z.y, hp: z.hp, max: z.max, risen: !!z.risen })),
    queue: world.queue.map((q) => ({ ...q })),
    questIdx: world.questIdx,
    squads: world.squads.map((s) => ({ ...s })),
    stats: { ...world.stats },
    over: world.over,
  });

  return world;
}

function restore(world, s) {
  world.res = { ...START_RES, ...(s.res || {}) };
  world.pop = s.pop ?? START_POP;
  world.year = s.year ?? 1;
  world.tYear = clamp(s.tYear ?? 0, 0, YEAR_LEN);
  world.warned = !!s.warned;
  world.hordeIn = !!s.hordeIn;
  world.pending = Array.isArray(s.pending) ? s.pending.filter((k) => ZOMBIES[k]) : [];
  world.spawned = Number.isFinite(s.spawned) ? s.spawned : 0;
  world.questIdx = Number.isFinite(s.questIdx) ? Math.max(0, Math.floor(s.questIdx)) : 0;
  // squads from the save; an older save carried a single rally — it becomes
  // squad zero, and nobody loses their run to the upgrade
  if (Array.isArray(s.squads) && s.squads.length) {
    world.squads = s.squads.map((p) => ({ x: clamp(p.x ?? HALL_C, 0.5, COLS - 0.5), y: clamp(p.y ?? HALL_R, 0.5, ROWS - 0.5) }));
  } else if (s.rally) {
    world.squads = [{ x: s.rally.x, y: s.rally.y }];
  }
  world.stats = { kills: 0, years: 0, hordes: 0, lost: 0, ...(s.stats || {}) };
  world.over = s.over || null;
  for (const b of s.buildings || []) {
    if (!BUILDINGS[b.id]) continue;
    world.buildings.push({ uid: nextBuildingId++, id: b.id, c: b.c, r: b.r, hp: b.hp ?? BUILDINGS[b.id].hp, built: b.built ?? 1, cool: 0 });
  }
  for (const u of s.units || []) {
    if (!UNITS[u.kind]) continue;
    const squad = Number.isFinite(u.squad) ? clamp(Math.floor(u.squad), 0, world.squads.length - 1) : 0;
    const m = makeUnit(u.kind, u.x, u.y, squad);
    m.hp = u.hp ?? m.hp;
    world.units.push(m);
  }
  for (const z of s.zombies || []) {
    if (!ZOMBIES[z.kind]) continue;
    const m = makeZombie(z.kind, z.x, z.y);
    m.hp = z.hp ?? m.hp;
    m.max = z.max ?? m.max;
    m.risen = !!z.risen;
    world.zombies.push(m);
  }
  for (const q of s.queue || []) if (UNITS[q.kind]) world.queue.push({ kind: q.kind, t: q.t ?? TRAIN_TIME });
  // a save with no manor is a save from a lost run mid-collapse: end it now
  if (!world.buildings.some((b) => b.id === 'hall')) world.over = { reason: 'hall' };
}

// -------------------------------------------------------------- the economy

/**
 * Villagers mend what the dead chewed — in peacetime only (during a horde
 * the streets belong to the fight), for wood, and each site pulls hands off
 * the fields: `efficiency` counts the repair crews as busy.
 */
function repairs(world, h) {
  if (world.hordeIn) {
    world.repairCount = 0;
    for (const b of world.buildings) b.repairing = false;
    return;
  }
  const sites = Math.max(0, Math.floor(world.pop / 3));
  let used = 0;
  for (const b of world.buildings) {
    const spec = BUILDINGS[b.id];
    b.repairing = false;
    if (b.built < 1 || b.hp >= spec.hp) continue;
    // nobody hammers a wall something is actively eating — a fresh bite
    // (hurtT still warm) pauses the site until the fight moves on
    if (b.hurtT > 0) continue;
    if (used >= sites || world.res.wood <= 0.5) continue;
    used++;
    b.repairing = true;
    const heal = Math.min(REPAIR_RATE * h, spec.hp - b.hp);
    b.hp += heal;
    world.res.wood = Math.max(0, world.res.wood - heal * REPAIR_WOOD);
  }
  world.repairCount = used;
}

function economy(world, h, season) {
  const eff = world.efficiency();
  for (const b of world.buildings) {
    if (b.hurtT) b.hurtT = Math.max(0, b.hurtT - h);
    const spec = BUILDINGS[b.id];
    if (b.built < 1) {
      b.built = Math.min(1, b.built + h / (spec.raise || 1));
      continue;
    }
    if (!spec.yields) continue;
    const seasonMult = spec.seasonal ? FARM_SEASON[season] : 1;
    const staffed = spec.crew ? eff : 1;
    const site = siteYield(world.map, b);
    for (const [k, rate] of Object.entries(spec.yields)) {
      world.res[k] = clamp(world.res[k] + rate * seasonMult * staffed * site * h, 0, RES_CAP);
    }
  }
}

function people(world, h) {
  // everyone eats; the army eats for two and a half — the granary the autumn
  // banked is what the winter siege actually runs on
  const mouths = (world.pop + world.queue.length) * EAT_RATE + world.units.length * ARMY_EAT;
  world.res.food = Math.max(0, world.res.food - mouths * h);

  if (world.res.food <= 0 && (world.pop > 0 || world.units.length > 0)) {
    world.starveT += h;
    if (world.starveT >= STARVE_EVERY) {
      world.starveT = 0;
      if (world.pop > 0) {
        world.pop -= 1;
        world.events.push({ kind: 'starve' });
      } else {
        // the villagers are gone; a starving soldier walks away — deserters
        // do not rise, because nothing killed them
        const u = world.units.pop();
        if (u) world.events.push({ kind: 'desert', x: u.x, y: u.y });
      }
    }
  } else {
    world.starveT = 0;
  }

  world.growT += h;
  if (world.growT >= GROW_EVERY) {
    world.growT = 0;
    // a new villager needs bread AND a bed — and the army sleeps under the
    // same roofs, so a big garrison in a small town stops the cradles
    if (world.res.food >= GROW_COST * 2 && world.heads() < world.popCap()) {
      world.pop += 1;
      world.res.food -= GROW_COST;
      world.events.push({ kind: 'born' });
    }
  }
}

function training(world, h) {
  if (!world.queue.length) return;
  const job = world.queue[0];
  job.t -= h;
  if (job.t > 0) return;
  world.queue.shift();
  const school = world.buildings.find((b) => BUILDINGS[b.id].trains === job.kind && b.built >= 1);
  const at = school ? centerOf(school) : centerOf(world.hall() || { id: 'hall', c: HALL_C, r: HALL_R });
  const u = makeUnit(job.kind, at.x, at.y + 1.4, world.pickSquad());
  world.units.push(u);
  world.events.push({ kind: 'trained', unit: job.kind, x: u.x, y: u.y });
}

function towers(world, h) {
  for (const b of world.buildings) {
    const spec = BUILDINGS[b.id];
    if (!spec.dps || b.built < 1) continue;
    b.cool = Math.max(0, b.cool - h);
    if (b.cool > 0) continue;
    const c = centerOf(b);
    let best = null;
    let bestD = spec.range;
    for (const z of world.zombies) {
      const d = Math.hypot(z.x - c.x, z.y - c.y);
      if (d < bestD) {
        bestD = d;
        best = z;
      }
    }
    if (!best) continue;
    b.cool = spec.shotEvery;
    best.hp -= spec.dps * spec.shotEvery;
    world.events.push({ kind: 'arrow', x: c.x, y: c.y, tx: best.x, ty: best.y });
  }
}

/** Carry out the deaths the step functions decided. */
function reap(world) {
  for (let i = world.zombies.length - 1; i >= 0; i--) {
    const z = world.zombies[i];
    if (z.hp <= 0) {
      world.zombies.splice(i, 1);
      world.stats.kills++;
      world.events.push({ kind: 'die', x: z.x, y: z.y, z: z.kind });
    }
  }
  for (let i = world.units.length - 1; i >= 0; i--) {
    const u = world.units[i];
    if (u.hp <= 0) {
      world.units.splice(i, 1);
      world.stats.lost++;
      // what the dead kill, the dead keep: the guard stands back up on the
      // wrong side, still in the rags of the uniform
      const risen = makeZombie('walker', u.x, u.y, hpScale(world.year));
      risen.risen = true;
      world.zombies.push(risen);
      world.events.push({ kind: 'unitdie', x: u.x, y: u.y });
      world.events.push({ kind: 'turned', x: u.x, y: u.y });
    }
  }
  for (let i = world.buildings.length - 1; i >= 0; i--) {
    const b = world.buildings[i];
    if (b.hp <= 0) {
      world.buildings.splice(i, 1);
      if (b.id === 'hall') {
        world.over = { reason: 'hall' };
        world.stats.years = world.year - 1;
        world.events.push({ kind: 'over' });
      }
    }
  }
  if (world.hordeIn && world.zombies.length === 0 && world.pending.length === 0) {
    world.hordeIn = false;
    world.stats.hordes++;
    world.events.push({ kind: 'cleared', year: world.year });
  }
}

// ------------------------------------------------------------- the calendar

function calendar(world, h) {
  const winterAt = SEASON_LEN * (SEASONS.length - 1);

  if (!world.warned && world.tYear >= winterAt - HORN_LEAD) {
    world.warned = true;
    world.events.push({ kind: 'horn', year: world.year });
  }

  if (world.warned && !world.hordeIn && world.tYear >= winterAt && world.tYear - h < winterAt) {
    spawnHorde(world);
  }

  // the rest of the horde walks in as a procession — one clump was a wall of
  // teeth no starting guard could survive, and a siege should last the winter
  if (world.pending.length) {
    world.trickleT += h;
    if (world.trickleT >= TRICKLE) {
      world.trickleT = 0;
      // year one comes single file; the late years come in ranks
      for (let i = ranksFor(world.year); i > 0 && world.pending.length; i--) {
        admit(world, world.pending.shift());
      }
    }
  }

  // strays keep the guards honest between winters — but not in the first
  // spring, which belongs to the sawmill and the first farm
  world.strayT += h;
  const graceOver = world.year > 1 || world.tYear > SEASON_LEN;
  if (graceOver && !world.hordeIn && world.strayT >= strayEvery(world.year)) {
    world.strayT = 0;
    const gate = gatesFor(world.seed, world.year * 101 + Math.floor(world.tYear))[0];
    world.zombies.push(makeZombie('walker', gate.x, gate.y, hpScale(world.year)));
  }

  if (world.tYear >= YEAR_LEN) {
    world.tYear -= YEAR_LEN;
    world.year += 1;
    world.warned = false;
    world.stats.years = world.year - 1;
    world.events.push({ kind: 'newyear', year: world.year });
  }
}

function spawnHorde(world) {
  const kinds = hordeFor(world.year, world.buildings.length);
  world.pending = kinds.slice();
  world.spawned = 0;
  world.trickleT = 0;
  world.hordeIn = true;
  for (let i = 0; i < firstWave(world.year) && world.pending.length; i++) admit(world, world.pending.shift());
  world.events.push({ kind: 'horde', n: kinds.length, year: world.year });
}

/** One of the dead steps onto the board, at the next gate in the rotation. */
function admit(world, kind) {
  const gates = gatesFor(world.seed, world.year);
  const i = world.spawned++;
  const gate = gates[i % gates.length];
  const j = ((i * 37) % 13) / 13 - 0.5; // deterministic scatter around the gate
  const x = clamp(gate.x + j * 3, 0.2, COLS - 0.2);
  const y = clamp(gate.y + (((i * 53) % 11) / 11 - 0.5) * 3, 0.2, ROWS - 0.2);
  world.zombies.push(makeZombie(kind, x, y, hpScale(world.year)));
}
