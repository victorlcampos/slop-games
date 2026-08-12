// From an OpenStreetMap answer to a world you can drive on — in Node, offline.
//
// This is the path that shipped broken twice: the game loaded nothing and the
// only test that could have seen it was the one that drove a real city, which
// depends on a public server that queues and rate-limits. Cut into pieces, it is
// all pure: a JSON goes in, streets, buildings and trees come out, and the
// street index answers questions about them.
//
// So the response is canned here — a real Overpass shape, written by hand — and
// every step after the network is exercised without one.

import { installHeadlessDom, scenario, check, checkEqual, run } from 'slopkit/testing';

installHeadlessDom();

const { parseOSM } = await import('../src/overpass.js');
const { buildRoads, RoadIndex } = await import('../src/roads.js');
const { buildBuildings } = await import('../src/buildings.js');
const { buildTrees } = await import('../src/trees.js');
const { makeProjection, HALF_DEFAULT } = await import('../src/geo.js');
const { HALF, CollisionGrid, loadWorld } = await import('../src/world.js');

const LAT = -22.96888;
const LON = -43.18647;
const D = 0.0009;                          // ~100 m
const proj = makeProjection(LAT, LON);
const flat = () => 0;

/** A small district: a grid of named streets, a footpath, a tunnel, a square,
 *  two buildings (one of them a relation) and a tree. */
const DISTRICT = {
  version: 0.6,
  elements: [
    ...[-2, -1, 0, 1, 2].flatMap((i, n) => [
      {
        type: 'way', id: 100 + n, tags: { highway: 'residential', name: `Rua ${n + 1}` },
        geometry: [
          { lat: LAT + i * D, lon: LON - 3 * D },
          { lat: LAT + i * D, lon: LON + 3 * D },
        ],
      },
      {
        type: 'way', id: 200 + n, tags: { highway: 'secondary', name: `Avenida ${n + 1}`, oneway: 'yes' },
        geometry: [
          { lat: LAT - 3 * D, lon: LON + i * D },
          { lat: LAT + 3 * D, lon: LON + i * D },
        ],
      },
    ]),
    // not for a car: a footpath, and a road inside a tunnel
    {
      type: 'way', id: 301, tags: { highway: 'footway', name: 'Passarela' },
      geometry: [{ lat: LAT, lon: LON }, { lat: LAT + D, lon: LON + D }],
    },
    {
      type: 'way', id: 302, tags: { highway: 'residential', name: 'Túnel', tunnel: 'yes' },
      geometry: [{ lat: LAT, lon: LON }, { lat: LAT, lon: LON + D }],
    },
    // a pedestrian square is an area, not a street
    {
      type: 'way', id: 303, tags: { highway: 'pedestrian', area: 'yes' },
      geometry: [
        { lat: LAT, lon: LON }, { lat: LAT + D, lon: LON },
        { lat: LAT + D, lon: LON + D }, { lat: LAT, lon: LON },
      ],
    },
    // a street far outside the loaded square
    {
      type: 'way', id: 304, tags: { highway: 'residential', name: 'Longe' },
      geometry: [{ lat: LAT + 0.2, lon: LON + 0.2 }, { lat: LAT + 0.2, lon: LON + 0.21 }],
    },
    {
      type: 'way', id: 401, tags: { building: 'yes', 'building:levels': '4' },
      geometry: [
        { lat: LAT + D * 0.2, lon: LON + D * 0.2 }, { lat: LAT + D * 0.5, lon: LON + D * 0.2 },
        { lat: LAT + D * 0.5, lon: LON + D * 0.5 }, { lat: LAT + D * 0.2, lon: LON + D * 0.5 },
        { lat: LAT + D * 0.2, lon: LON + D * 0.2 },
      ],
    },
    {
      type: 'relation', id: 501, tags: { building: 'church' },
      members: [{
        type: 'way', role: 'outer',
        geometry: [
          { lat: LAT - D, lon: LON - D }, { lat: LAT - D * 0.6, lon: LON - D },
          { lat: LAT - D * 0.6, lon: LON - D * 0.6 }, { lat: LAT - D, lon: LON - D * 0.6 },
          { lat: LAT - D, lon: LON - D },
        ],
      }],
    },
    { type: 'node', id: 601, lat: LAT + D * 0.1, lon: LON - D * 0.1, tags: { natural: 'tree' } },
    {
      type: 'way', id: 701, tags: { leisure: 'park' },
      geometry: [
        { lat: LAT - D * 2, lon: LON - D * 2 }, { lat: LAT - D, lon: LON - D * 2 },
        { lat: LAT - D, lon: LON - D }, { lat: LAT - D * 2, lon: LON - D * 2 },
      ],
    },
  ],
};

const parsed = parseOSM(DISTRICT);

scenario('the answer is read into streets, buildings, trees and green', () => {
  check(parsed.roads.length === 12, `${parsed.roads.length} ways came out as streets`);
  check(parsed.buildings.length === 2, `${parsed.buildings.length} buildings`);
  check(parsed.trees.length === 1, `${parsed.trees.length} trees`);
  check(parsed.greens.length === 1, `${parsed.greens.length} green areas`);

  // a square is not a street, and neither is a tunnel — the car would drive
  // through the ceiling
  check(!parsed.roads.some((r) => r.name === 'Túnel'), 'a tunnel came out as drivable street');
  check(!parsed.roads.some((r) => r.hw === 'pedestrian'), 'a pedestrian square came out as a street');

  // the footpath is kept, and marked as one: it is scenery, not road
  const foot = parsed.roads.find((r) => r.name === 'Passarela');
  check(foot && foot.kind === 'path', 'the footpath came out as a road for cars');
  check(parsed.roads.filter((r) => r.kind === 'car').length === 11, 'the count of drivable streets moved');
});

scenario('a street carries what the game draws it with', () => {
  const avenue = parsed.roads.find((r) => r.name === 'Avenida 1');
  const street = parsed.roads.find((r) => r.name === 'Rua 1');
  check(avenue && street, 'the named streets did not survive the parsing');
  check(avenue.width > street.width, `a secondary (${avenue.width} m) is not wider than a residential (${street.width} m)`);
  check(avenue.oneway === true && street.oneway === false, 'oneway was read wrong');
  check(avenue.pts.length >= 2, 'a street with no geometry');
});

scenario('a building keeps its height, and a relation becomes one building', () => {
  const [simple, relation] = parsed.buildings;
  check(simple.height > 0, `a building ${simple.height} m tall`);
  check(simple.height >= 10, `four levels came out as ${simple.height} m`);
  check(String(relation.id).startsWith('r'), 'the relation did not come out as its own building');
  check(relation.rings.length >= 1, 'the relation lost its outline');
  // the ring comes back open, with the repeated last point dropped: that is the
  // form the extruder wants, and a ring that still repeats it draws a zero-area
  // wall on top of itself
  for (const b of parsed.buildings) {
    for (const ring of b.rings) {
      check(ring.length >= 3, `${b.id}: an outline with ${ring.length} corners`);
      const first = ring[0], last = ring[ring.length - 1];
      check(first.lat !== last.lat || first.lon !== last.lon,
        `${b.id}: the outline still repeats its first corner`);
    }
  }
});

scenario('the streets become a world with an index that answers', () => {
  const world = buildRoads(parsed.roads, proj, flat, HALF);
  check(world.index instanceof RoadIndex, 'no street index came out of the build');
  check(world.group && world.group.children.length > 0, 'no street mesh came out of the build');
  check(world.minimapLines.length > 0, 'the minimap got no streets to draw');

  // the street 200 m away is outside the loaded square and was left out
  const far = proj.toLocal(LAT + 0.2, LON + 0.2);
  check(world.index.nearest(far[0], far[1], 200) === null, 'a street outside the square was built anyway');

  // and the middle of the district lands on a street with a name
  const here = world.index.nearest(0, 0, 120, true, true);
  check(here && here.name, 'nothing named near the middle of the district');
  check(here.dist < 120, `the nearest named street is ${here.dist.toFixed(0)} m away`);
  check(Number.isFinite(here.heading), 'the street has no heading to spawn the car with');
});

scenario('the buildings and the trees are placed, and they push the car back', () => {
  const walls = new CollisionGrid();
  const built = buildBuildings(parsed.buildings, proj, flat, HALF, walls);
  check(built, 'no building geometry came out');
  check(walls.map.size > 0, 'a building the car can drive straight through');
  // and the wall really pushes: a circle inside it comes back with a contact
  // half a metre off the middle of one of the walls, in the game's own metres —
  // exactly ON the line is the one place the grid answers nothing, and a car
  // never gets there: it is pushed out before
  const wall = proj.toLocal(LAT + D * 0.35, LON + D * 0.2);
  const contacts = walls.collide(wall[0] + 0.6, wall[1], 1.5);
  check(contacts.length > 0, 'driving into a wall, nothing pushed the car back');
  check(contacts[0].depth > 0 && Math.hypot(contacts[0].nx, contacts[0].nz) > 0.99,
    'the wall pushed back with no direction');

  const grid = new CollisionGrid();
  const trees = buildTrees(parsed.trees, parsed.greens, proj, flat, HALF, grid, 1234);
  check(trees, 'no tree geometry came out');
  check(grid.map.size > 0, 'the trees are scenery you can drive through');
});

scenario('the same answer always builds the same world', () => {
  const a = parseOSM(DISTRICT);
  const b = parseOSM(DISTRICT);
  checkEqual(a.roads.map((r) => r.name), b.roads.map((r) => r.name), 'the parsing is not deterministic');
  checkEqual(a.buildings.map((x) => x.height), b.buildings.map((x) => x.height),
    'the building heights change between two reads of the same answer');
});

scenario('an empty answer is a world with no streets, not a crash', () => {
  for (const bad of [null, undefined, {}, { elements: [] }, { elements: [{ type: 'way', id: 1 }] }]) {
    const r = parseOSM(bad);
    check(r && Array.isArray(r.roads) && r.roads.length === 0, `${JSON.stringify(bad)} did not come back empty`);
  }
});

// ------------------------------------------------- the whole load, offline

/** Answers Overpass with `body` and every tile with a blank image. */
function serve(body) {
  const calls = { osm: 0, tiles: 0 };
  globalThis.fetch = async (url) => {
    calls.osm++;
    if (body instanceof Error) throw body;
    return {
      ok: true, status: 200,
      headers: { get: () => String(JSON.stringify(body).length) },
      json: async () => body,
      text: async () => JSON.stringify(body),
      body: null,
    };
  };
  const Blank = globalThis.Image;
  globalThis.Image = class extends Blank {
    set src(u) { calls.tiles++; super.src = u; }
    get src() { return super.src; }
  };
  return calls;
}

scenario('a whole world is loaded and handed over, with no network', async () => {
  const calls = serve(DISTRICT);
  const steps = [];
  const world = await loadWorld(LAT, LON, (phase, value) => steps.push([phase, value]));

  check(world && world.group, 'the load came back with nothing to put in the scene');
  check(world.stats.roads > 0, `${world.stats.roads} streets in the built world`);
  check(world.spawn && Number.isFinite(world.spawn.x), 'the car has nowhere to spawn');
  check(world.spawn.name, 'the car spawns on a street with no name');
  check(typeof world.heightAt === 'function' && Number.isFinite(world.heightAt(10, 10)),
    'the world cannot say how high the ground is');
  check(world.half === HALF, `the loaded square is ${world.half} m from the middle`);
  check(world.roadIndex instanceof RoadIndex, 'the world came without its street index');

  // the loading card is driven by these, and a phase that never reports leaves
  // the player watching a bar that does not move
  const phases = new Set(steps.map(([p]) => p));
  for (const phase of ['osm', 'dem', 'sat', 'build']) {
    check(phases.has(phase), `nothing reported progress for "${phase}"`);
  }
  check(steps.some(([p, v]) => p === 'build' && v === 1), 'the build never reported it was done');
  check(calls.osm > 0, 'the streets were never asked for');
});

scenario('a place with no streets says so, instead of building an empty world', async () => {
  serve({ version: 0.6, elements: [DISTRICT.elements.find((e) => e.tags && e.tags.building)] });
  let failed = null;
  try {
    await loadWorld(LAT, LON, () => {});
  } catch (e) {
    failed = e;
  }
  check(failed, 'a place with no drivable street built a world anyway');
  const message = String(failed.message || failed);
  check(message.length > 5 && !message.includes('undefined'),
    `the failure reads "${message}"`);
});

scenario('the line dropping is a failure the player can read', async () => {
  serve(new Error('net::ERR_INTERNET_DISCONNECTED'));
  let failed = null;
  try {
    await loadWorld(LAT, LON, () => {});
  } catch (e) {
    failed = e;
  }
  check(failed, 'with no network at all, the load reported success');
});

await run('world drive — the world it loads');
