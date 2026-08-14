// The rules of the Fortress: how a ring is put together, what can see what,
// and the promise the game's own description makes — that ring N+1 is worse
// than ring N, for every N there is.

import { scenario, check, run, headlessContext } from 'slopkit/testing';
import { missingKeys } from 'slopkit/i18n';

import { plan, threat, floorSeed, TILE, makeRng } from '../src/config.js';
import { generateFloor } from '../src/levelgen.js';
import {
  createGrid, flowField, stepAlong, castRay, lineOfSight, clearFor, cellOf, WALL, ROOM, HALL,
} from '../src/grid.js';
import { canSee, visibilityFan } from '../src/vision.js';
import { WEAPONS, lootGuns, guardGun, droppedAmmo } from '../src/weapons.js';
import { dict } from '../src/i18n.js';
import { SCENES, SKIP_HINT, createCutscene } from '../src/cutscene.js';

const cell = (x, y) => cellOf(x, y);

// ------------------------------------------------------------- the fortress

scenario('every ring builds, and everything on it can be walked to', () => {
  for (let f = 1; f <= 40; f++) {
    const lv = generateFloor(f, floorSeed(20260813, f));
    const start = cell(lv.spawn.x, lv.spawn.y);
    const field = flowField(lv.grid, [start]);
    const reach = (o, what) => {
      const c = cell(o.x, o.y);
      check(field.at(c.cx, c.cy) >= 0, `ring ${f}: a ${what} at ${c.cx},${c.cy} is walled off from the cell`);
    };
    reach(lv.vault, 'seal');
    for (const g of lv.guards) reach(g, 'sentinel');
    for (const it of lv.items) reach(it, lv.items.kind || 'pickup');
    for (const a of lv.alarms) reach(a, 'alarm node');
    for (const c of lv.cameras) reach(c, 'eye');
    check(!lv.grid.solidAt(lv.spawn.x, lv.spawn.y), `ring ${f}: the player spawns inside a wall`);
  }
});

scenario('the seal is put at the far end, not next to the cell', () => {
  let worst = Infinity;
  for (let f = 1; f <= 25; f++) {
    const lv = generateFloor(f, floorSeed(4242, f));
    const field = flowField(lv.grid, [cell(lv.spawn.x, lv.spawn.y)]);
    const steps = field.at(lv.vault.cx, lv.vault.cy);
    // in tiles: anything under ten is "the seal is in the cell block"
    worst = Math.min(worst, steps);
    check(steps >= 10, `ring ${f}: the seal is only ${steps} tiles from the cell`);
  }
  check(worst > 0, `the nearest seal of the 25 was ${worst} tiles away`);
});

scenario('a ring is the same ring twice, and two runs are two fortresses', () => {
  const a = generateFloor(7, floorSeed(1000, 7));
  const b = generateFloor(7, floorSeed(1000, 7));
  check(String(a.grid.cells) === String(b.grid.cells), 'the same seed built two different rings');
  check(a.guards.length === b.guards.length, 'the same seed garrisoned the ring differently');
  const other = generateFloor(7, floorSeed(1001, 7));
  check(String(a.grid.cells) !== String(other.grid.cells), 'two different runs built the identical ring');
});

scenario('a ring has rooms and the corridors that join them', () => {
  const lv = generateFloor(6, floorSeed(88, 6));
  let rooms = 0;
  let halls = 0;
  for (const c of lv.grid.cells) {
    if (c === ROOM) rooms++;
    if (c === HALL) halls++;
  }
  check(halls > 20, `only ${halls} corridor tiles — the rooms are touching, not connected`);
  check(rooms > halls, `${rooms} room tiles against ${halls} of corridor: this is a maze, not a fortress`);
});

// ------------------------------------------------------------ the staircase

scenario('every ring is harder than the one before it, for two hundred rings', () => {
  let prev = -Infinity;
  for (let f = 1; f <= 200; f++) {
    const t = threat(f);
    check(t > prev, `ring ${f} is no worse than ring ${f - 1} (${t.toFixed(2)} against ${prev.toFixed(2)})`);
    prev = t;
  }
  check(threat(10) > threat(1) * 3, `ring 10 is only ${(threat(10) / threat(1)).toFixed(1)}x ring 1`);
});

scenario('the garrison stops growing, the sentinels themselves do not', () => {
  const deep = plan(120);
  const deeper = plan(121);
  check(deep.guards === deeper.guards, 'the sentinel count is meant to hit a ceiling — a corridor is only so wide');
  check(deeper.guardHp > deep.guardHp, 'past the ceiling the sentinels themselves have to keep getting harder');
  check(deeper.guardDamage > deep.guardDamage, 'and they have to keep hitting harder');
  check(plan(1).cameras === 0, 'the first ring is meant to be free of eyes');
  check(plan(3).cameras > 0, 'by ring 3 there should be eyes on the walls');
});

scenario('the ring grows, and the overload gets longer', () => {
  const a = plan(1);
  const b = plan(12);
  check(b.cols > a.cols && b.rows > a.rows, `ring 12 (${b.cols}x${b.rows}) is not bigger than ring 1 (${a.cols}x${a.rows})`);
  check(b.rooms > a.rooms, `${b.rooms} rooms against ${a.rooms}`);
  check(b.vaultTime > a.vaultTime + 3, `the seal still gives in ${b.vaultTime.toFixed(1)}s on ring 12`);
  check(b.guardAim < a.guardAim, 'sentinels on ring 12 should shoot sooner than on ring 1');
  check(b.payday > a.payday * 3, `ring 12 pays ${b.payday} against ${a.payday}`);
});

// ------------------------------------------------------------------ looking

/** A room of `cols`x`rows` with a wall down the middle column. */
function splitRoom(cols = 9, rows = 7, wallCol = 4) {
  const g = createGrid(cols, rows, ROOM);
  for (let cy = 0; cy < rows; cy++) g.set(wallCol, cy, WALL);
  return g;
}

scenario('a ray stops at the wall it hits, and not before', () => {
  const g = splitRoom();
  const from = 2.5 * TILE;
  const wall = 4 * TILE;
  const hit = castRay(g, from, 3.5 * TILE, 1, 0, 900);
  check(Math.abs(hit - (wall - from)) < 1, `the ray stopped at ${hit.toFixed(1)}px, the wall is at ${(wall - from).toFixed(1)}px`);
  const clear = castRay(g, from, 3.5 * TILE, -1, 0, 100);
  check(clear === 100, `nothing to the left, but the ray stopped at ${clear}`);
});

scenario('a ray along the grid lines does not divide by zero', () => {
  const g = splitRoom();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const t = castRay(g, 2.5 * TILE, 3.5 * TILE, dx, dy, 600);
    check(Number.isFinite(t), `an axis-aligned ray (${dx},${dy}) came back ${t}`);
  }
});

scenario('sight does not go round a corner', () => {
  const g = splitRoom();
  const left = { x: 2.5 * TILE, y: 3.5 * TILE };
  const right = { x: 6.5 * TILE, y: 3.5 * TILE };
  check(!lineOfSight(g, left.x, left.y, right.x, right.y), 'the wall between them was see-through');
  check(lineOfSight(g, left.x, left.y, left.x + TILE, left.y), 'two tiles of open room were not in sight of each other');
});

scenario('a cone is a cone: behind you, past you and through a wall are all dark', () => {
  const g = createGrid(11, 9, ROOM);
  const eye = { x: 5.5 * TILE, y: 4.5 * TILE };
  const fov = 90;
  const range = 400;
  check(canSee(g, eye.x, eye.y, 0, fov, range, eye.x + 200, eye.y), 'straight ahead was not visible');
  check(!canSee(g, eye.x, eye.y, 0, fov, range, eye.x - 200, eye.y), 'something directly behind was visible');
  check(!canSee(g, eye.x, eye.y, 0, fov, range, eye.x + 600, eye.y), 'something past the range was visible');
  check(!canSee(g, eye.x, eye.y, 0, fov, range, eye.x + 200, eye.y - 300), 'something outside the cone was visible');
  const walled = splitRoom(11, 9, 7);
  check(!canSee(walled, eye.x, eye.y, 0, fov, range, eye.x + 200, eye.y), 'the cone reached through a wall');
});

scenario('the visibility fan is stopped by the walls it is drawn against', () => {
  const g = splitRoom(11, 9, 7);
  const fan = visibilityFan(g, 5.5 * TILE, 4.5 * TILE, 0, 100, 500, 60);
  check(fan.length === 61, `expected 61 points, got ${fan.length}`);
  const deepest = Math.max(...fan.map((p) => p.x));
  check(deepest <= 7 * TILE + 1, `a ray reached x=${deepest.toFixed(0)}, past the wall at ${7 * TILE}`);
});

scenario('a gap narrower than a body is not a way through', () => {
  // the exact shape that wedged a guard on a corner for a whole floor: the
  // centre ray is clear, but he is fifteen pixels wide and the corner is not
  const g = createGrid(9, 9, ROOM);
  g.set(4, 4, WALL);
  const a = { x: 3.5 * TILE, y: 3.5 * TILE };
  const b = { x: 5.5 * TILE, y: 5.5 * TILE };
  check(!lineOfSight(g, a.x, a.y, b.x, b.y), 'the diagonal should be blocked by the pillar itself');

  // and the case that is only wrong once you have a width: skimming the corner
  const c = { x: 4 * TILE - 2, y: 3.5 * TILE };
  const d = { x: 4 * TILE - 2, y: 5.5 * TILE };
  check(lineOfSight(g, c.x, c.y, d.x, d.y), 'the thin line past the pillar is clear');
  check(!clearFor(g, c.x, c.y, d.x, d.y, 15), 'a body 30px wide cannot skim 2px from a pillar');
  check(clearFor(g, 2.5 * TILE, 2.5 * TILE, 2.5 * TILE, 6.5 * TILE, 15), 'a clear column refused a body that fits');
});

// ----------------------------------------------------------------- walking

scenario('the flow field walks downhill all the way to the goal', () => {
  const g = createGrid(15, 11, ROOM);
  for (let cy = 0; cy < 9; cy++) g.set(7, cy, WALL);      // a wall with a gap at the bottom
  const goal = { cx: 12, cy: 2 };
  const field = flowField(g, [goal]);
  let at = { cx: 2, cy: 2 };
  let steps = 0;
  while ((at.cx !== goal.cx || at.cy !== goal.cy) && steps < 500) {
    const next = stepAlong(field, g, at.cx, at.cy);
    check(next, `stuck at ${at.cx},${at.cy} with ${field.at(at.cx, at.cy)} steps still to go`);
    at = next;
    steps++;
  }
  check(steps < 500, 'the walk never arrived');
  // The field counts orthogonal steps; the walk is allowed diagonals, so it
  // arrives sooner — but never in less than half, which is the best a diagonal
  // can ever do, and would otherwise be the signature of a walk through a wall.
  const orthogonal = field.at(2, 2);
  check(steps <= orthogonal, `${steps} steps for a route the field says is ${orthogonal} long`);
  check(steps >= orthogonal / 2, `arrived in ${steps} steps, under half the ${orthogonal} the field says exist`);
});

scenario('a goal behind a wall is reported as unreachable, not walked to', () => {
  const g = createGrid(9, 7, ROOM);
  for (let cy = 0; cy < 7; cy++) g.set(4, cy, WALL);      // no gap at all
  const field = flowField(g, [{ cx: 7, cy: 3 }]);
  check(field.at(1, 3) === -1, 'a sealed-off cell was given a distance');
  check(field.at(6, 3) >= 0, 'a cell on the same side as the goal was called unreachable');
});

// ----------------------------------------------------------------- the guns

scenario('what separates the guns is noise, not damage', () => {
  // Two guns are quiet — the whisper coil you start with and the stasis dart —
  // and everything else is in another league entirely. A gun that sits between
  // the two groups is a gun with no decision attached to it.
  const QUIET = ['whisper', 'stasis'];
  const loudest = Math.max(...QUIET.map((id) => WEAPONS[id].noise));
  for (const w of Object.values(WEAPONS)) {
    if (QUIET.includes(w.id)) {
      check(w.noise <= 150, `the ${w.id} is meant to be quiet and carries ${w.noise}`);
    } else {
      check(w.noise > loudest * 3, `the ${w.id} is only ${w.noise} loud against ${loudest} for the quiet ones`);
    }
  }
  check(WEAPONS.shockwave.noise > WEAPONS.blaster.noise, 'a shockwave should carry further than a blaster');

  // The stasis dart is the quietest thing on the ring, so it has to pay
  // somewhere or there is no reason ever to hold anything else.
  const stasis = WEAPONS.stasis;
  check(stasis.rate > WEAPONS.whisper.rate * 3, `the stasis dart fires every ${stasis.rate}s — as fast as the coil and silent`);
  check(stasis.range < WEAPONS.whisper.range * 0.75, `the stasis dart reaches ${stasis.range}px, as far as the gun you started with`);
  check(Number.isFinite(stasis.mag) && stasis.mag <= 12, `the stasis dart carries ${stasis.mag} rounds`);

  check(!Number.isFinite(WEAPONS.whisper.mag), 'the gun you always have should never run out');
  for (const w of Object.values(WEAPONS)) {
    if (w.id !== 'whisper') check(Number.isFinite(w.mag), `the ${w.id} has no ammunition limit`);
  }
});

scenario('the armoury gets better as you climb, and never offers your own gun', () => {
  const rng = makeRng(5);
  for (let tier = 0; tier <= 3; tier++) {
    const pool = lootGuns(tier);
    check(pool.length > 0, `tier ${tier} has nothing to find`);
    check(!pool.includes('whisper'), `tier ${tier} drops the gun you started with`);
    for (const id of pool) check(WEAPONS[id], `tier ${tier} offers "${id}", which is not a gun`);
  }
  check(lootGuns(3).length > lootGuns(0).length, 'the high rings offer no more than the first');
  check(WEAPONS[guardGun(3, 0)].tier >= WEAPONS[guardGun(0, 0)].tier, 'sentinels higher up carry no better');
  const ammo = droppedAmmo('blaster', rng, 0.5);
  check(ammo > 0 && ammo <= WEAPONS.blaster.mag, `a dropped blaster came with ${ammo} rounds`);
});

// ------------------------------------------------------------- the two flags

scenario('every phrase exists in both languages', () => {
  const missing = missingKeys(dict);
  check(missing.length === 0, `missing translations: ${missing.join(', ')}`);
});

scenario('every gun the game can hand you has a name in both languages', () => {
  for (const id of Object.keys(WEAPONS)) {
    const entry = dict[`gun.${id}`];
    check(entry, `the ${id} has no name in the dictionary — the HUD would print "gun.${id}"`);
    check(entry.pt && entry.en, `the ${id} is named in only one language`);
  }
});

// ------------------------------------------------------------- the opening

scenario('the opening speaks both languages, plays to the end, and can be skipped', () => {
  check(SCENES.length >= 5, `an opening with ${SCENES.length} scenes is a slide, not a film`);
  const missing = missingKeys({
    ...Object.fromEntries(SCENES.map((s, i) => [`scene.${i}`, s.line])),
    skip: SKIP_HINT,
  });
  check(missing.length === 0, `the opening is missing translations: ${missing.join(', ')}`);
  for (const s of SCENES) check(s.duration > 2, `a ${s.duration}s scene cannot be read, let alone watched`);

  // left alone, the film ends exactly once — drawn every frame while it runs,
  // so a scene that throws mid-way turns this red
  const ctx = headlessContext(1280, 720);
  let ended = 0;
  const cut = createCutscene(() => ended++);
  const total = SCENES.reduce((s, c) => s + c.duration, 0);
  for (let t = 0; t < total + 5 && !ended; t += 1 / 30) {
    cut.update(1 / 30);
    cut.draw(ctx, 1280);
  }
  check(ended === 1, `${total + 5} seconds passed and the film never ended`);
  cut.update(1);
  check(ended === 1, 'the film ended twice');

  // ESC is a promise
  let skipped = 0;
  const cut2 = createCutscene(() => skipped++);
  cut2.update(1 / 30);
  cut2.skip();
  check(skipped === 1 && cut2.done, 'ESC did not end the opening');

  // and so is clicking through every page by hand
  let clicked = 0;
  const cut3 = createCutscene(() => clicked++);
  for (let i = 0; i < SCENES.length + 2; i++) cut3.click();
  check(clicked === 1, 'clicking through every page did not end the film');
});

await run('infinite fortress — the ring');
