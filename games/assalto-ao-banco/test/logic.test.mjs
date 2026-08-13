// The rules of the building: how a floor is put together, what can see what,
// and the promise the game's own description makes — that floor N+1 is worse
// than floor N, for every N there is.

import { scenario, check, run } from 'slopkit/testing';
import { missingKeys } from 'slopkit/i18n';

import { plan, threat, floorSeed, TILE, makeRng } from '../src/config.js';
import { generateFloor } from '../src/levelgen.js';
import {
  createGrid, flowField, stepAlong, castRay, lineOfSight, clearFor, cellOf, WALL, ROOM, HALL,
} from '../src/grid.js';
import { canSee, visibilityFan } from '../src/vision.js';
import { WEAPONS, lootGuns, guardGun, droppedAmmo } from '../src/weapons.js';
import { dict } from '../src/i18n.js';

const cell = (x, y) => cellOf(x, y);

// ------------------------------------------------------------- the building

scenario('every floor builds, and everything on it can be walked to', () => {
  for (let f = 1; f <= 40; f++) {
    const lv = generateFloor(f, floorSeed(20260813, f));
    const start = cell(lv.spawn.x, lv.spawn.y);
    const field = flowField(lv.grid, [start]);
    const reach = (o, what) => {
      const c = cell(o.x, o.y);
      check(field.at(c.cx, c.cy) >= 0, `floor ${f}: a ${what} at ${c.cx},${c.cy} is walled off from the door`);
    };
    reach(lv.vault, 'vault');
    for (const g of lv.guards) reach(g, 'guard');
    for (const it of lv.items) reach(it, lv.items.kind || 'pickup');
    for (const a of lv.alarms) reach(a, 'alarm panel');
    for (const c of lv.cameras) reach(c, 'camera');
    check(!lv.grid.solidAt(lv.spawn.x, lv.spawn.y), `floor ${f}: the player spawns inside a wall`);
  }
});

scenario('the vault is put at the far end, not next to the door', () => {
  let worst = Infinity;
  for (let f = 1; f <= 25; f++) {
    const lv = generateFloor(f, floorSeed(4242, f));
    const field = flowField(lv.grid, [cell(lv.spawn.x, lv.spawn.y)]);
    const steps = field.at(lv.vault.cx, lv.vault.cy);
    // in tiles: anything under ten is "the vault is in the lobby"
    worst = Math.min(worst, steps);
    check(steps >= 10, `floor ${f}: the vault is only ${steps} tiles from the front door`);
  }
  check(worst > 0, `the nearest vault of the 25 was ${worst} tiles away`);
});

scenario('a floor is the same floor twice, and two runs are two banks', () => {
  const a = generateFloor(7, floorSeed(1000, 7));
  const b = generateFloor(7, floorSeed(1000, 7));
  check(String(a.grid.cells) === String(b.grid.cells), 'the same seed built two different floors');
  check(a.guards.length === b.guards.length, 'the same seed staffed the floor differently');
  const other = generateFloor(7, floorSeed(1001, 7));
  check(String(a.grid.cells) !== String(other.grid.cells), 'two different runs built the identical floor');
});

scenario('a floor has rooms and the corridors that join them', () => {
  const lv = generateFloor(6, floorSeed(88, 6));
  let rooms = 0;
  let halls = 0;
  for (const c of lv.grid.cells) {
    if (c === ROOM) rooms++;
    if (c === HALL) halls++;
  }
  check(halls > 20, `only ${halls} corridor tiles — the rooms are touching, not connected`);
  check(rooms > halls, `${rooms} room tiles against ${halls} of corridor: this is a maze, not a bank`);
});

// ------------------------------------------------------------ the staircase

scenario('every floor is harder than the one before it, for two hundred floors', () => {
  let prev = -Infinity;
  for (let f = 1; f <= 200; f++) {
    const t = threat(f);
    check(t > prev, `floor ${f} is no worse than floor ${f - 1} (${t.toFixed(2)} against ${prev.toFixed(2)})`);
    prev = t;
  }
  check(threat(10) > threat(1) * 3, `floor 10 is only ${(threat(10) / threat(1)).toFixed(1)}x floor 1`);
});

scenario('the staff stops growing, the men themselves do not', () => {
  const deep = plan(120);
  const deeper = plan(121);
  check(deep.guards === deeper.guards, 'the guard count is meant to hit a ceiling — a corridor is only so wide');
  check(deeper.guardHp > deep.guardHp, 'past the ceiling the guards themselves have to keep getting harder');
  check(deeper.guardDamage > deep.guardDamage, 'and they have to keep hitting harder');
  check(plan(1).cameras === 0, 'the first floor is meant to be free of cameras');
  check(plan(3).cameras > 0, 'by floor 3 there should be cameras');
});

scenario('the floor grows, and the drilling gets longer', () => {
  const a = plan(1);
  const b = plan(12);
  check(b.cols > a.cols && b.rows > a.rows, `floor 12 (${b.cols}x${b.rows}) is not bigger than floor 1 (${a.cols}x${a.rows})`);
  check(b.rooms > a.rooms, `${b.rooms} rooms against ${a.rooms}`);
  check(b.vaultTime > a.vaultTime + 3, `the vault still opens in ${b.vaultTime.toFixed(1)}s on floor 12`);
  check(b.guardAim < a.guardAim, 'guards on floor 12 should shoot sooner than on floor 1');
  check(b.payday > a.payday * 3, `floor 12 pays ${b.payday} against ${a.payday}`);
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
  const quiet = WEAPONS.silenced;
  for (const w of Object.values(WEAPONS)) {
    if (w === quiet) continue;
    check(w.noise > quiet.noise * 3, `the ${w.id} is only ${w.noise} loud against the silenced pistol's ${quiet.noise}`);
  }
  check(WEAPONS.shotgun.noise > WEAPONS.pistol.noise, 'a shotgun should carry further than a pistol');
  check(!Number.isFinite(quiet.mag), 'the gun you always have should never run out');
  for (const w of Object.values(WEAPONS)) {
    if (w !== quiet) check(Number.isFinite(w.mag), `the ${w.id} has no ammunition limit`);
  }
});

scenario('the wreckage gets better as you go down, and never offers your own gun', () => {
  const rng = makeRng(5);
  for (let tier = 0; tier <= 3; tier++) {
    const pool = lootGuns(tier);
    check(pool.length > 0, `tier ${tier} has nothing to find`);
    check(!pool.includes('silenced'), `tier ${tier} drops the gun you started with`);
    for (const id of pool) check(WEAPONS[id], `tier ${tier} offers "${id}", which is not a gun`);
  }
  check(lootGuns(3).length > lootGuns(0).length, 'the deep floors offer no more than the first');
  check(WEAPONS[guardGun(3, 0)].tier >= WEAPONS[guardGun(0, 0)].tier, 'guards deeper down carry no better');
  const ammo = droppedAmmo('pistol', rng, 0.5);
  check(ammo > 0 && ammo <= WEAPONS.pistol.mag, `a dropped pistol came with ${ammo} rounds`);
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

await run('bank job — the building');
