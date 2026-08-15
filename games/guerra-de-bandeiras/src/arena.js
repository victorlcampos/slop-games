// The six fields, and the one rule they all obey: **half is authored, the other
// half is its mirror.**
//
// A capture-the-flag field that is not symmetric is not a match, it is a
// handicap — and a symmetry produced by hand is a symmetry that drifts on the
// third edit. So every arena here describes the left nineteen columns only, in
// rectangles, and the builder writes column `c` and column `37 - c` from the
// same line. Whatever advantage a corner gives, it gives to both squads.
//
// Rectangles rather than a picture in ASCII, for a reason that showed up while
// drawing the first one: a row of characters has to be counted to be trusted,
// and a rectangle can be read. The test walks the result anyway — every flag
// reachable from both sets of spawns, no spawn inside a wall, and the two
// halves identical under the mirror.

import { COLS, ROWS, TILE, HALF, makeRng, PHASES } from './config.js';
import { createGrid, centreOf, flowField, cellOf, WALL, FLOOR, PIT, BASE_H, BASE_A } from './grid.js';

/**
 * Each entry is one half-field. `walls` and `pits` are `[x, y, w, h]` in tiles;
 * everything else is a tile coordinate in the same half.
 */
export const LAYOUTS = {
  /**
   * Twin Corridors — the field everything else is a variation of. Three lanes,
   * three ways between them, and nothing in the way that is not a wall.
   */
  corridors: {
    walls: [
      [5, 2, 1, 3], [5, 12, 1, 3],       // the bay the flag sits in, wide open at the middle
      [7, 4, 6, 1], [7, 12, 6, 1],       // the lane separators, with the gaps at both ends
      [10, 7, 1, 3],                     // the pillar the mid lane splits around
    ],
    flag: [3, 8],
    spawns: [[2, 8], [2, 5], [2, 11], [4, 6], [4, 10]],
  },

  /**
   * The Bridge — eight tiles of nothing down the middle of the field, crossed
   * at two places. A pit stops a body and lets a bullet through, so both sides
   * spend the whole match looking at each other across it.
   */
  bridge: {
    walls: [
      [5, 5, 1, 3], [5, 9, 1, 3],
      [8, 1, 1, 3], [8, 13, 1, 3],
      [8, 7, 1, 3],
    ],
    pits: [[10, 1, 4, 4], [10, 6, 4, 5], [10, 12, 4, 4]],
    flag: [3, 8],
    spawns: [[2, 8], [2, 4], [2, 12], [4, 6], [4, 10]],
  },

  /**
   * The Maze — grown rather than drawn, from a fixed seed, then braided hard:
   * **half** the walls between neighbouring cells are knocked through, because
   * a perfect maze is a corridor with one answer, and in the dark a corridor
   * with one answer is a killing floor. At a third, two squads spent a hundred
   * and fifty seconds shooting each other in doorways and took the flag three
   * times between them, for nought a side.
   *
   * The one night arena: you read it through a torch, and so do they.
   */
  maze: {
    maze: { seed: 20260815, braid: 0.52 },
    walls: [],
    flag: [3, 8],
    spawns: [[2, 8], [2, 7], [2, 9], [4, 7], [4, 9]],
  },

  /**
   * Turret Nest — two guns bolted to the deck on either side of each flag. They
   * shoot whoever they can see and they are not yours to command; they can be
   * shot down, and twenty seconds later they are back. Killing one buys a
   * window, not the base.
   */
  turrets: {
    walls: [
      [6, 5, 1, 3], [6, 10, 1, 3],
      [9, 2, 2, 2], [9, 13, 2, 2],
      [11, 6, 1, 5],
    ],
    flag: [3, 8],
    turrets: [[6, 3], [6, 13]],
    spawns: [[2, 8], [2, 5], [2, 11], [4, 4], [4, 12]],
  },

  /**
   * The Gates — four pads, and each one throws you at its mirror on the far
   * side of the field. A carrier who reaches one is home in a second; so is
   * whoever was waiting at the other end of it.
   */
  gates: {
    walls: [
      [5, 5, 1, 7],
      [8, 1, 1, 4], [8, 12, 1, 4],
      [10, 5, 3, 1], [10, 11, 3, 1],
      [12, 7, 1, 3],
    ],
    pads: [[5, 2], [5, 14]],
    flag: [3, 8],
    spawns: [[2, 8], [2, 5], [2, 11], [4, 6], [4, 10]],
  },

  /**
   * Open Field — no lanes, no corridors, nowhere to hide but behind a block.
   * Five a side and the fastest squad in the game: the arena where knowing
   * where everybody is stops being enough.
   *
   * The blocks are not decoration. Without them ten soldiers who can all see
   * each other fought fifty times a minute and captured once in ten; cover is
   * what a runner needs, and this is the arena with the least of it.
   */
  open: {
    walls: [
      [5, 6, 1, 5],
      [8, 3, 1, 2], [8, 12, 1, 2],
      [10, 7, 2, 3],
      [11, 1, 1, 2], [11, 14, 1, 2],
      [8, 8, 1, 1],
    ],
    flag: [3, 8],
    spawns: [[2, 8], [2, 4], [2, 12], [4, 6], [4, 10]],
  },
};

const rect = (grid, x, y, w, h, value) => {
  for (let cy = y; cy < y + h; cy++) {
    for (let cx = x; cx < x + w; cx++) grid.set(cx, cy, value);
  }
};

/** The same rectangle on both halves — every write to the field goes through here. */
function mirrorRect(grid, [x, y, w, h], value) {
  rect(grid, x, y, w, h, value);
  rect(grid, COLS - x - w, y, w, h, value);
}

/**
 * A maze over the half-field, carved on the odd cells and then braided.
 *
 * The centre columns are opened afterwards whatever the maze did with them:
 * mirrored, that is the one hall both squads have to come through, and a maze
 * that happened to wall it off would be two arenas rather than one.
 */
function carveMaze(grid, { seed, braid }) {
  const rng = makeRng(seed);
  const cells = { cols: 7, rows: 8 };                   // odd tiles from 1..13 and 1..15
  const at = (cx, cy) => ({ x: 1 + cx * 2, y: 1 + cy * 2 });
  const seen = new Set();
  const stack = [{ cx: 0, cy: 3 }];
  seen.add('0,3');
  const p0 = at(0, 3);
  grid.set(p0.x, p0.y, FLOOR);

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.cx + dx;
      const ny = cur.cy + dy;
      if (nx < 0 || ny < 0 || nx >= cells.cols || ny >= cells.rows) continue;
      if (seen.has(`${nx},${ny}`)) continue;
      options.push({ nx, ny, dx, dy });
    }
    if (!options.length) {
      stack.pop();
      continue;
    }
    const pick = options[Math.floor(rng() * options.length)];
    const a = at(cur.cx, cur.cy);
    const b = at(pick.nx, pick.ny);
    grid.set(b.x, b.y, FLOOR);
    grid.set((a.x + b.x) / 2, (a.y + b.y) / 2, FLOOR);
    seen.add(`${pick.nx},${pick.ny}`);
    stack.push({ cx: pick.nx, cy: pick.ny });
  }

  // the braid: knock through walls between neighbouring cells, which turns dead
  // ends into loops — a corridor you can only leave the way you came in is
  // where a match goes to die
  for (let cy = 0; cy < cells.rows; cy++) {
    for (let cx = 0; cx < cells.cols; cx++) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (cx + dx >= cells.cols || cy + dy >= cells.rows) continue;
        if (rng() > braid) continue;
        const a = at(cx, cy);
        const b = at(cx + dx, cy + dy);
        grid.set((a.x + b.x) / 2, (a.y + b.y) / 2, FLOOR);
      }
    }
  }
}

/**
 * Build the field of phase `index`, mirrored, garrisoned and ready to play.
 *
 * Nothing here is random unless the layout asked for it: the same phase is the
 * same field every time it is opened, which is what lets a player learn one.
 */
export function buildArena(index) {
  const phase = PHASES[Math.max(0, Math.min(PHASES.length - 1, index))];
  const layout = LAYOUTS[phase.id];
  const grid = createGrid(COLS, ROWS, layout.maze ? WALL : FLOOR);

  if (layout.maze) {
    carveMaze(grid, layout.maze);
    rect(grid, 1, 5, 5, 7, FLOOR);              // the base cavern, whatever the maze decided
    // the maze is grown on the left half only and then reflected, exactly like
    // a wall rectangle — a maze generated twice from the same seed would be two
    // mazes, because the second run starts on a grid the first one left behind
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < HALF; cx++) grid.set(COLS - 1 - cx, cy, grid.at(cx, cy));
    }
    rect(grid, HALF - 2, 1, 4, ROWS - 2, FLOOR);  // and the hall both squads come through
  }

  // the outer shell, always: the field has edges and they are walls
  rect(grid, 0, 0, COLS, 1, WALL);
  rect(grid, 0, ROWS - 1, COLS, 1, WALL);
  rect(grid, 0, 0, 1, ROWS, WALL);
  rect(grid, COLS - 1, 0, 1, ROWS, WALL);

  for (const r of layout.walls || []) mirrorRect(grid, r, WALL);
  for (const r of layout.pits || []) mirrorRect(grid, r, PIT);

  const flagCell = { human: { cx: layout.flag[0], cy: layout.flag[1] } };
  flagCell.alien = { cx: COLS - 1 - flagCell.human.cx, cy: flagCell.human.cy };

  // the end zones: floor, tinted, so "my half" is something you can see rather
  // than something you have to remember
  for (const [team, value] of [['human', BASE_H], ['alien', BASE_A]]) {
    const c = flagCell[team];
    for (let cy = c.cy - 2; cy <= c.cy + 2; cy++) {
      for (let cx = c.cx - 2; cx <= c.cx + 2; cx++) {
        if (grid.at(cx, cy) === FLOOR) grid.set(cx, cy, value);
      }
    }
  }
  // and the stand itself is always floor, whatever a rectangle said
  for (const team of ['human', 'alien']) {
    const c = flagCell[team];
    if (!grid.walkable(c.cx, c.cy)) grid.set(c.cx, c.cy, team === 'human' ? BASE_H : BASE_A);
  }

  const spawns = { human: [], alien: [] };
  for (const [cx, cy] of layout.spawns) {
    spawns.human.push(centreOf(cx, cy));
    spawns.alien.push(centreOf(COLS - 1 - cx, cy));
  }

  const turrets = [];
  for (const [cx, cy] of layout.turrets || []) {
    turrets.push({ ...centreOf(cx, cy), team: 'human' });
    turrets.push({ ...centreOf(COLS - 1 - cx, cy), team: 'alien' });
  }

  // A pad throws you at its own mirror, which is the far side of the field.
  // Both ends work, so the arena is as good to the squad being chased as to
  // the squad chasing.
  const pads = [];
  for (const [cx, cy] of layout.pads || []) {
    const a = centreOf(cx, cy);
    const b = centreOf(COLS - 1 - cx, cy);
    pads.push({ ...a, to: b, side: 'human' });
    pads.push({ ...b, to: a, side: 'alien' });
  }

  return {
    index,
    id: phase.id,
    dark: !!phase.dark,
    squad: phase.squad,
    skill: phase.skill,
    respawn: phase.respawn,
    grid,
    flags: {
      human: { ...centreOf(flagCell.human.cx, flagCell.human.cy), ...flagCell.human },
      alien: { ...centreOf(flagCell.alien.cx, flagCell.alien.cy), ...flagCell.alien },
    },
    spawns,
    turrets,
    pads,
    width: COLS * TILE,
    height: ROWS * TILE,
  };
}

/**
 * Is every flag, spawn, pad and turret standing somewhere the other side can
 * walk to? The test asks this of all six; the builder exports it because a
 * field that fails it is not a hard arena, it is a broken one.
 */
export function auditArena(arena) {
  const problems = [];
  const from = (p) => flowField(arena.grid, [cellOf(p.x, p.y)]);
  for (const team of ['human', 'alien']) {
    if (!arena.spawns[team].length) problems.push(`${team} has nowhere to spawn`);
    for (const s of arena.spawns[team]) {
      if (!arena.grid.walkableAt(s.x, s.y)) problems.push(`${team} spawns inside a wall at ${s.x},${s.y}`);
    }
    const field = from(arena.spawns[team][0]);
    for (const target of ['human', 'alien']) {
      const f = arena.flags[target];
      if (field.at(f.cx, f.cy) < 0) problems.push(`${team} cannot walk to the ${target} flag`);
    }
    for (const p of arena.pads) {
      const c = cellOf(p.x, p.y);
      if (field.at(c.cx, c.cy) < 0) problems.push(`${team} cannot reach a gate at ${c.cx},${c.cy}`);
    }
    for (const t of arena.turrets) {
      const c = cellOf(t.x, t.y);
      if (!arena.grid.walkable(c.cx, c.cy)) problems.push(`a turret stands inside a wall at ${c.cx},${c.cy}`);
    }
  }
  // the mirror, cell by cell: the whole promise of the layout format
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < HALF; cx++) {
      if (mirrorKind(arena.grid.at(cx, cy)) !== mirrorKind(arena.grid.at(COLS - 1 - cx, cy))) {
        problems.push(`the halves differ at ${cx},${cy}`);
      }
    }
  }
  return problems;
}

/** The two end zones are the same kind of ground under the mirror. */
const mirrorKind = (v) => (v === BASE_H || v === BASE_A ? FLOOR : v);
