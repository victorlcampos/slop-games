// Every building the town can raise: what it costs, what it yields, what it
// asks of the map, and how much of a beating it takes. One table — the shop,
// the placement check, the economy and the renderer all read this and nothing
// else, so a price changed here is changed everywhere.

import { GRASS, ROCK, TREE, countAround, inBounds, tileAt } from './map.js';
import { COLS, ROWS } from './config.js';

export const BUILDINGS = {
  // The manor is the town: it is placed by the world, never bought, and losing
  // it is losing the run. Its trickle of forage is the floor under the whole
  // economy — a town that loses its last sawmill with 20 wood in the barn must
  // be able to claw back to 25, or the run dead-ends with the manor standing.
  hall: { w: 2, h: 2, hp: 600, cost: {}, crew: 0, fixed: true, yields: { wood: 0.12, food: 0.08 } },

  house: { w: 1, h: 1, hp: 120, cost: { wood: 20 }, crew: 0, popCap: 4, raise: 4 },
  farm: { w: 2, h: 2, hp: 100, cost: { wood: 30 }, crew: 2, yields: { food: 0.9 }, seasonal: true, raise: 5 },
  sawmill: { w: 1, h: 1, hp: 120, cost: { wood: 25 }, crew: 2, yields: { wood: 0.65 }, needs: TREE, per: 4, raise: 4 },
  quarry: { w: 1, h: 1, hp: 160, cost: { wood: 40 }, crew: 2, yields: { stone: 0.5 }, needs: ROCK, per: 3, raise: 5 },
  market: { w: 1, h: 1, hp: 120, cost: { wood: 50, stone: 10 }, crew: 2, yields: { gold: 0.4 }, raise: 5 },

  barracks: { w: 2, h: 2, hp: 260, cost: { wood: 60, stone: 30 }, crew: 0, trains: 'soldier', raise: 6 },
  range: { w: 2, h: 2, hp: 200, cost: { wood: 80, stone: 20 }, crew: 0, trains: 'archer', raise: 6 },

  wall: { w: 1, h: 1, hp: 300, cost: { stone: 6 }, crew: 0, raise: 2 },
  tower: { w: 1, h: 1, hp: 220, cost: { stone: 40, gold: 15 }, crew: 1, dps: 9, range: 5.2, shotEvery: 0.9, raise: 6 },
};

/** What the command bar offers, in the order it offers it. */
export const SHOP = ['house', 'farm', 'sawmill', 'quarry', 'market', 'barracks', 'range', 'wall', 'tower'];

export function canAfford(res, id) {
  const cost = BUILDINGS[id].cost;
  return Object.entries(cost).every(([k, v]) => (res[k] || 0) >= v);
}

export function pay(res, id) {
  for (const [k, v] of Object.entries(BUILDINGS[id].cost)) res[k] -= v;
}

/**
 * Whether `id` can stand with its top-left corner on (c, r).
 * Returns null for yes, or the reason for no — the reason is a dictionary key,
 * so the refusal reaches the player in their own language.
 */
export function whyNot(world, id, c, r) {
  const spec = BUILDINGS[id];
  if (c < 0 || r < 0 || c + spec.w > COLS || r + spec.h > ROWS) return 'why.edge';
  for (let dc = 0; dc < spec.w; dc++) {
    for (let dr = 0; dr < spec.h; dr++) {
      if (tileAt(world.map, c + dc, r + dr) !== GRASS) return 'why.ground';
      if (buildingAt(world, c + dc, r + dr)) return 'why.taken';
    }
  }
  if (spec.needs !== undefined && countAround(world.map, c, r, spec.needs) === 0) {
    return spec.needs === TREE ? 'why.needsTrees' : 'why.needsRock';
  }
  if (!canAfford(world.res, id)) return 'why.poor';
  return null;
}

export function buildingAt(world, c, r) {
  for (const b of world.buildings) {
    const spec = BUILDINGS[b.id];
    if (c >= b.c && c < b.c + spec.w && r >= b.r && r < b.r + spec.h) return b;
  }
  return null;
}

/** Centre of a building, in tile coordinates — what zombies walk at. */
export function centerOf(b) {
  const spec = BUILDINGS[b.id];
  return { x: b.c + spec.w / 2, y: b.r + spec.h / 2 };
}

/**
 * How well a resource building is fed by the map: a sawmill in deep forest
 * runs flat out, one next to a single tree limps. 0..1.
 */
export function siteYield(map, b) {
  const spec = BUILDINGS[b.id];
  if (spec.needs === undefined) return 1;
  return Math.min(1, countAround(map, b.c, b.r, spec.needs) / spec.per);
}

/** Everyone the standing economy is asking for, before the army takes its cut. */
export function crewDemand(world) {
  let n = 0;
  for (const b of world.buildings) if (b.built >= 1) n += BUILDINGS[b.id].crew;
  return n;
}

export function inBoundsTile(c, r) {
  return inBounds(c, r);
}
