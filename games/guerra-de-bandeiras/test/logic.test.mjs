// The rules of the war: how a field is put together, what a capture is, and
// the two promises the game makes — that the six arenas get harder, and that
// neither side of a mirrored field has an edge over the other.

import { scenario, check, run } from 'slopkit/testing';
import { missingKeys } from 'slopkit/i18n';

import {
  PHASES, COLS, ROWS, HALF, TILE, TARGET, GUNS, UNIT, FLAG, BOT_RANGE, REGEN, ROLL, ASSIST, VISION,
  botStats, difficulty, cameraFor, eyesOf, dps, ARENA_W, ARENA_H, HUD_H, H, makeRng, other,
} from '../src/config.js';
import { buildArena, auditArena, LAYOUTS } from '../src/arena.js';
import { visibilityFan, wallCorners } from '../src/vision.js';
import {
  createGrid, flowField, stepAlong, castRay, lineOfSight, cellOf, nearestOpen,
  WALL, FLOOR, PIT, BASE_H, BASE_A,
} from '../src/grid.js';
import { dict } from '../src/i18n.js';

// ------------------------------------------------------------- the six fields

scenario('every arena builds, and everything on it can be walked to', () => {
  for (let i = 0; i < PHASES.length; i++) {
    const arena = buildArena(i);
    const problems = auditArena(arena);
    check(problems.length === 0, `${arena.id}: ${problems.slice(0, 3).join(' · ')}`);
  }
});

scenario('the two halves are the same field, cell for cell', () => {
  for (let i = 0; i < PHASES.length; i++) {
    const arena = buildArena(i);
    const kind = (v) => (v === BASE_H || v === BASE_A ? FLOOR : v);
    let differs = 0;
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < HALF; cx++) {
        if (kind(arena.grid.at(cx, cy)) !== kind(arena.grid.at(COLS - 1 - cx, cy))) differs++;
      }
    }
    check(differs === 0, `${arena.id}: ${differs} cells are not mirrored — one squad has a field the other has not`);
    // and the two stands are the same distance from their own spawns
    const walk = (from, to) => flowField(arena.grid, [cellOf(from.x, from.y)]).at(to.cx, to.cy);
    const mine = walk(arena.spawns.human[0], arena.flags.alien);
    const theirs = walk(arena.spawns.alien[0], arena.flags.human);
    check(mine === theirs, `${arena.id}: the raid is ${mine} tiles one way and ${theirs} the other`);
  }
});

scenario('a flag is far enough from home to be worth taking', () => {
  for (let i = 0; i < PHASES.length; i++) {
    const arena = buildArena(i);
    const steps = flowField(arena.grid, [cellOf(arena.spawns.human[0].x, arena.spawns.human[0].y)])
      .at(arena.flags.alien.cx, arena.flags.alien.cy);
    // in metres rather than tiles: the tile doubled when the camera arrived,
    // and a threshold written in tiles quietly halved with it
    check(steps * TILE >= 1400,
      `${arena.id}: the enemy stand is ${steps} tiles (${steps * TILE}px) from the spawn — that is not a raid, it is a walk`);
  }
});

scenario('an arena is the same arena every time it is opened', () => {
  for (let i = 0; i < PHASES.length; i++) {
    const a = buildArena(i);
    const b = buildArena(i);
    check(String(a.grid.cells) === String(b.grid.cells), `${a.id} was laid out differently the second time`);
  }
});

scenario('the maze is a maze: corridors, junctions and no room to hide a squad in', () => {
  const arena = buildArena(PHASES.findIndex((p) => p.id === 'maze'));
  let open = 0;
  for (const c of arena.grid.cells) if (c !== WALL) open++;
  const share = open / arena.grid.cells.length;
  check(share > 0.3 && share < 0.72, `${(share * 100).toFixed(0)}% of the maze is floor — that is a room, not a maze`);
  // and it is corridors rather than a hall: most of the open ground has walls
  // on at least two sides of it
  let tight = 0;
  for (let cy = 1; cy < ROWS - 1; cy++) {
    for (let cx = 1; cx < COLS - 1; cx++) {
      if (arena.grid.at(cx, cy) === WALL) continue;
      let walls = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (arena.grid.at(cx + dx, cy + dy) === WALL) walls++;
      }
      if (walls >= 2) tight++;
    }
  }
  check(tight / open > 0.25, `only ${(tight / open * 100).toFixed(0)}% of the maze has walls on two sides — that is a field`);
  check(arena.dark, 'the maze is not the dark arena any more, and its whole point was the dark');
});

scenario('the bridge is crossed in two places, and a bullet crosses anywhere', () => {
  const arena = buildArena(PHASES.findIndex((p) => p.id === 'bridge'));
  let pits = 0;
  for (const c of arena.grid.cells) if (c === PIT) pits++;
  check(pits > 100, `only ${pits} tiles of pit — the field is not split`);

  // a body cannot walk over it…
  const midX = HALF * TILE;
  let crossings = 0;
  for (let cy = 1; cy < ROWS - 1; cy++) {
    if (arena.grid.walkable(HALF - 1, cy) && arena.grid.walkable(HALF, cy)) crossings++;
  }
  check(crossings >= 2 && crossings <= 6, `${crossings} tiles of bridge — one is a queue, ten is not a bridge`);

  // …but a shot crosses the pit, which is what makes the arena a standoff
  const row = 0.5 * TILE + TILE * pitRow(arena);
  check(lineOfSight(arena.grid, midX - 200, row, midX + 200, row),
    'the pit stops bullets — then it is a wall, and the arena has no idea in it');
});

/** A row that is pit all the way across the middle. */
function pitRow(arena) {
  for (let cy = 1; cy < ROWS - 1; cy++) {
    if (arena.grid.at(HALF, cy) === PIT) return cy;
  }
  return 1;
}

scenario('the gates come in pairs, and each one throws you across the field', () => {
  const arena = buildArena(PHASES.findIndex((p) => p.id === 'gates'));
  check(arena.pads.length === 4, `${arena.pads.length} gates — they are authored in pairs and mirrored`);
  for (const p of arena.pads) {
    check(Math.abs((p.x + p.to.x) / 2 - ARENA_W / 2) < 1, 'a gate does not land on its own mirror');
    check(Math.abs(p.x - p.to.x) > ARENA_W / 2, 'a gate that lands on your own half saves nobody any time');
    const c = cellOf(p.to.x, p.to.y);
    check(arena.grid.walkable(c.cx, c.cy), 'a gate drops you inside a wall');
  }
});

scenario('the turrets stand on both sides of both stands', () => {
  const arena = buildArena(PHASES.findIndex((p) => p.id === 'turrets'));
  check(arena.turrets.length === 4, `${arena.turrets.length} turrets — two a side`);
  for (const team of ['human', 'alien']) {
    const mine = arena.turrets.filter((t) => t.team === team);
    check(mine.length === 2, `${team} has ${mine.length} turrets`);
    for (const t of mine) {
      const far = Math.hypot(t.x - arena.flags[team].x, t.y - arena.flags[team].y);
      check(far < 420, `a ${team} turret is ${far.toFixed(0)}px from the stand it is meant to be guarding`);
    }
  }
  // every other arena keeps its guns in the players' hands
  for (let i = 0; i < PHASES.length; i++) {
    if (PHASES[i].id === 'turrets') continue;
    check(buildArena(i).turrets.length === 0, `${PHASES[i].id} grew turrets`);
  }
});

// ------------------------------------------------------------- the staircase

scenario('each arena is harder than the one before it', () => {
  let prev = -Infinity;
  for (let i = 0; i < PHASES.length; i++) {
    const d = difficulty(i);
    check(d > prev, `arena ${i + 1} (${PHASES[i].id}) is no harder than the one before (${d.toFixed(1)} against ${prev.toFixed(1)})`);
    prev = d;
  }
  check(PHASES.length >= 5, `only ${PHASES.length} arenas`);
});

scenario('the skill dial only ever makes a squad better', () => {
  let prev = null;
  for (let k = 0; k <= 1.0001; k += 0.1) {
    const s = botStats(k);
    if (prev) {
      check(s.react <= prev.react, `a better squad is slower on the draw at skill ${k.toFixed(1)}`);
      check(s.spread <= prev.spread, `a better squad shoots wider at skill ${k.toFixed(1)}`);
      check(s.speed >= prev.speed, `a better squad walks slower at skill ${k.toFixed(1)}`);
      check(s.lead >= prev.lead, `a better squad leads its shots less at skill ${k.toFixed(1)}`);
    }
    prev = s;
  }
  const worst = botStats(0);
  const best = botStats(1);
  check(worst.react > best.react * 1.5, 'the easiest squad is not meaningfully slower than the hardest');
  check(best.spread > 1, 'the hardest squad shoots straighter than its own gun, which is not a squad any more');
});

// --------------------------------------------------------------- the balance

scenario('the two guns are two guns, not a better one and a worse one', () => {
  const gap = Math.abs(dps(GUNS.human) - dps(GUNS.alien)) / dps(GUNS.human);
  check(gap < 0.15, `${(gap * 100).toFixed(0)}% between the guns' damage a second`);
  check(GUNS.human.spread === GUNS.alien.spread,
    'the guns differ in accuracy — that is a straight advantage on every single shot, not a trade');

  // time to kill, in whole rounds: the number that actually decides a fight
  const rounds = (g) => Math.ceil(UNIT.hp / g.damage);
  const window = (g) => rounds(g) * g.rate;
  const spread = Math.abs(window(GUNS.human) - window(GUNS.alien)) / window(GUNS.human);
  check(spread < 0.45, `one gun empties a body in ${window(GUNS.human).toFixed(2)}s and the other in ${window(GUNS.alien).toFixed(2)}s`);
  check(rounds(GUNS.alien) < rounds(GUNS.human), 'the blaster is meant to be the heavy one');
  check(GUNS.human.rate < GUNS.alien.rate, 'the rifle is meant to be the quick one');
});

scenario('the numbers a match is paced by are all in reach of each other', () => {
  const cross = ARENA_W / UNIT.speed;
  check(cross > 6 && cross < 12, `crossing the field takes ${cross.toFixed(1)}s`);
  check(UNIT.r * 2 < TILE * 0.6, `a body is ${UNIT.r * 2}px across a ${TILE}px corridor`);
  check(ROLL.speed * ROLL.time * UNIT.speed > TILE * 2,
    'the roll does not cross two tiles, which is less than the corridor it is for');
  check(ROLL.cool > ROLL.time, 'the roll costs less than it lasts, which makes it a speed button');
  check(ASSIST.settle < ASSIST.cone && ASSIST.cone < ASSIST.limit,
    'the assist gates are out of order: it would fire before it has finished turning');
  for (const p of PHASES) {
    check(p.respawn > 2 && p.respawn < 6, `${p.id}: ${p.respawn}s to respawn`);
    check(p.squad >= 3 && p.squad <= 5, `${p.id}: ${p.squad} a side`);
    check(p.squad <= LAYOUTS[p.id].spawns.length, `${p.id}: ${p.squad} soldiers and ${LAYOUTS[p.id].spawns.length} places to put them`);
  }
  check(BOT_RANGE < GUNS.human.range, 'a bot opens fire at its gun\'s full reach — nobody will ever cross the open arena');
  check(FLAG.pickR > UNIT.r && FLAG.capR > FLAG.pickR,
    'the reaches are out of order: you would score from further away than you can pick it up');
  check(!('dropTime' in FLAG),
    'a dropped flag still has a clock on it — it is meant to sit there until somebody carries it');
  check(REGEN.delay > 2.5, 'a body knits itself back together mid-fight');
  check(TARGET === 5, `a match is to ${TARGET}`);
});

// ------------------------------------------------------------------- the map

scenario('the camera sits on the soldier, and the field is bigger than the screen', () => {
  check(ARENA_W > 1900 * 0.9, `the field is ${ARENA_W} wide — the widest screen would see all of it`);
  check(ARENA_H > H, `the field is ${ARENA_H} tall against a screen of ${H}`);
  for (const W of [1040, 1280, 1900]) {
    const cam = cameraFor(600, 500, W, H);
    check(Math.abs(600 - (cam.x + W / 2)) < 0.001, `the man is not in the middle of a ${W}-wide screen`);
    const midY = cam.y + HUD_H + (H - HUD_H) / 2;
    check(Math.abs(500 - midY) < 0.001, 'the man is not in the middle of what is left under the scoreboard');
  }
  // and it does not clamp: a soldier in the corner is still in the middle
  const corner = cameraFor(40, 40, 1280, H);
  check(corner.x < 0 && corner.y < 0, 'the camera clamps at the edge of the field, so the cursor and the gun drift apart');
});

scenario('the two settings of the eyes: a room by day, a torch at night', () => {
  const day = eyesOf({ dark: false });
  const night = eyesOf({ dark: true });
  check(day === VISION.day && night === VISION.night, 'an arena picks its eyes from somewhere else');
  check(day.fov >= 360, `by day the cone is ${day.fov}° — the room is not all of it`);
  check(day.sight > TILE * 12, `by day you see ${day.sight}px, which is not across a room`);
  check(night.fov < 180, `at night the cone is ${night.fov}° wide, which is not a torch`);
  check(night.sight < day.sight, 'the torch reaches further than daylight');
  check(night.near > 0 && night.near < night.sight,
    'the torch has no near circle — the doorway you are leaning against would be invisible');
  // only one arena is a night arena, and it is the maze
  const dark = PHASES.filter((p) => p.dark).map((p) => p.id);
  check(dark.length === 1 && dark[0] === 'maze', `the night arenas are ${dark.join(', ')}`);
});

scenario('the edge of the light is a wall, not a sampling artefact', () => {
  // The shape is cast at the **corners** of the walls, so it is pinned to the
  // geometry. The version this replaced put a ray every couple of degrees
  // wherever they happened to land, and each one crossed a corner at its own
  // moment: a tenth of a pixel of walking swung up to a tenth of the lit area,
  // which is what "the shadow is shimmering" looks like from the outside.
  const area = (fan, x, y) => {
    const p = fan.points;
    let a = 0;
    let px = x;
    let py = y;
    for (let i = 0; i < fan.count; i++) {
      const qx = p[i * 2];
      const qy = p[i * 2 + 1];
      a += px * qy - qx * py;
      px = qx;
      py = qy;
    }
    return Math.abs(a + px * y - x * py) / 2;
  };

  for (const index of [0, 5]) {
    const arena = buildArena(index);
    const eyes = VISION.day;
    check(wallCorners(arena.grid).length > 40, `${arena.id}: only ${wallCorners(arena.grid).length} corners on the whole field`);
    let worst = 0;
    let sum = 0;
    let n = 0;
    for (let cy = 1; cy < ROWS - 1; cy += 2) {
      for (let cx = 1; cx < COLS - 1; cx += 2) {
        if (!arena.grid.walkable(cx, cy)) continue;
        const y = cy * TILE + TILE / 2;
        let last = null;
        for (let i = -10; i <= 10; i++) {
          const x = cx * TILE + TILE / 2 + i * 0.1;      // a tenth of a pixel a step
          if (!arena.grid.walkableAt(x, y)) { last = null; continue; }
          const a = area(visibilityFan(arena.grid, x, y, 0, eyes.fov, eyes.sight), x, y);
          if (last) {
            const jump = Math.abs(a - last) / last;
            worst = Math.max(worst, jump);
            sum += jump;
            n++;
          }
          last = a;
        }
      }
    }
    check(worst < 0.03, `${arena.id}: a tenth of a pixel of walking moves ${(worst * 100).toFixed(1)}% of the lit area`);
    check(sum / n < 0.001, `${arena.id}: the light boils by ${(sum / n * 100).toFixed(2)}% a step on average`);
  }
});

scenario('a ray stops at a wall and a flow field walks round one', () => {
  const grid = createGrid(10, 10, FLOOR);
  for (let cy = 0; cy < 8; cy++) grid.set(5, cy, WALL);
  check(castRay(grid, 16, 16, 1, 0, 400) < 5 * TILE + 1, 'a ray went through the wall');
  check(!lineOfSight(grid, 16, 16, 9 * TILE, 16), 'there is a clear line through a wall');
  const field = flowField(grid, [{ cx: 9, cy: 1 }]);
  check(field.at(1, 1) > 8, 'the route round the wall is shorter than the wall is long');
  let at = { cx: 1, cy: 1 };
  for (let i = 0; i < 60 && field.at(at.cx, at.cy) > 0; i++) at = stepAlong(field, grid, at.cx, at.cy) || at;
  check(field.at(at.cx, at.cy) === 0, 'following the field does not arrive');
});

scenario('a pit stops a body and lets a shot through', () => {
  const grid = createGrid(6, 3, FLOOR);
  grid.set(3, 1, PIT);
  check(!grid.walkable(3, 1), 'a body can stand in the pit');
  check(!grid.solid(3, 1), 'the pit blocks a bullet, which makes it a wall');
  check(lineOfSight(grid, 16, 48, 5 * TILE, 48), 'a shot did not cross the pit');
  const near = nearestOpen(grid, 3, 1);
  check(near && grid.walkable(near.cx, near.cy), 'nothing dropped in a pit can be recovered');
});

// ------------------------------------------------------------- the two flags

scenario('the game speaks both languages, all the way through', () => {
  const missing = missingKeys(dict);
  check(missing.length === 0, `half a translation: ${missing.join(', ')}`);
  for (const p of PHASES) {
    check(dict[`arena.${p.id}`], `arena ${p.id} has no name`);
    check(dict[`arena.${p.id}.note`], `arena ${p.id} has nothing to say about itself`);
  }
  // the two sides are named, and named differently, in both languages
  check(dict['side.human'].pt !== dict['side.alien'].pt, 'both sides are called the same thing in Portuguese');
  check(dict['side.human'].en !== dict['side.alien'].en, 'both sides are called the same thing in English');
});

scenario('the seeded stream is a stream, and the same one twice', () => {
  const a = makeRng(99);
  const b = makeRng(99);
  let same = 0;
  let inRange = 0;
  for (let i = 0; i < 500; i++) {
    const x = a();
    if (x === b()) same++;
    if (x >= 0 && x < 1) inRange++;
  }
  check(same === 500, 'the same seed produced two different streams');
  check(inRange === 500, 'the stream left [0, 1)');
  check(other('human') === 'alien' && other('alien') === 'human', 'the sides do not know who the other one is');
});

await run('flag war — the rules');
