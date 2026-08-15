// The field as a grid, and the four questions everything else asks of it: can I
// stand here, can I see there, can I shoot through, and which way is the flag.
//
// The one thing that is not inherited from a normal top-down grid is the pit.
// **A pit stops a body and lets a bullet through**, and that single difference
// is the whole of the bridge arena: the two halves are in each other's sight
// the entire time and can only be joined at two tiles.

import { TILE } from './config.js';

export const WALL = 0;
export const FLOOR = 1;
export const PIT = 2;
export const BASE_H = 3;               // the humans' end zone — floor, tinted
export const BASE_A = 4;               // the sentinels' end zone

export function createGrid(cols, rows, fill = WALL) {
  const cells = new Uint8Array(cols * rows).fill(fill);
  return {
    cols,
    rows,
    cells,
    at(cx, cy) {
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return WALL;
      return cells[cy * cols + cx];
    },
    set(cx, cy, v) {
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return;
      cells[cy * cols + cx] = v;
    },
    /** Opaque: stops a bullet and stops an eye. A pit does neither. */
    solid(cx, cy) {
      return this.at(cx, cy) === WALL;
    },
    solidAt(x, y) {
      return this.solid(Math.floor(x / TILE), Math.floor(y / TILE));
    },
    /** Standable: a wall and a pit are both a no, for different reasons. */
    walkable(cx, cy) {
      const v = this.at(cx, cy);
      return v !== WALL && v !== PIT;
    },
    walkableAt(x, y) {
      return this.walkable(Math.floor(x / TILE), Math.floor(y / TILE));
    },
    get width() { return cols * TILE; },
    get height() { return rows * TILE; },
  };
}

export const cellOf = (x, y) => ({ cx: Math.floor(x / TILE), cy: Math.floor(y / TILE) });
export const centreOf = (cx, cy) => ({ x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 });

/**
 * How far a ray travels before a wall stops it, capped at `max`. A DDA over
 * tiles: no sampling, no "close enough" stepping, and the same routine answers
 * for every eye and every bullet in the game.
 */
export function castRay(grid, x, y, dx, dy, max) {
  let cx = Math.floor(x / TILE);
  let cy = Math.floor(y / TILE);
  if (grid.solid(cx, cy)) return 0;

  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  // an axis-aligned ray gives 1/0 = Infinity, which the comparisons handle, but
  // 0/0 = NaN, which they do not
  const invX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const invY = dy === 0 ? Infinity : Math.abs(1 / dy);

  let tMaxX = dx === 0 ? Infinity : (dx > 0 ? (cx + 1) * TILE - x : x - cx * TILE) / Math.abs(dx);
  let tMaxY = dy === 0 ? Infinity : (dy > 0 ? (cy + 1) * TILE - y : y - cy * TILE) / Math.abs(dy);
  const dX = invX * TILE;
  const dY = invY * TILE;

  let t = 0;
  while (t <= max) {
    if (tMaxX < tMaxY) {
      t = tMaxX;
      cx += stepX;
      tMaxX += dX;
    } else {
      t = tMaxY;
      cy += stepY;
      tMaxY += dY;
    }
    if (t > max) return max;
    if (grid.solid(cx, cy)) return t;
  }
  return max;
}

/** Is there a clear line between two world points? */
export function lineOfSight(grid, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return true;
  return castRay(grid, ax, ay, dx / len, dy / len, len) >= len - 0.5;
}

/**
 * A breadth-first distance field from one or more goal cells, in steps.
 *
 * Everything that walks here reads one of these. There are never more than a
 * handful alive at once — the enemy flag, your own base, whoever is carrying
 * something — and a field over 798 cells costs less than the guard that would
 * be needed to avoid recomputing it.
 */
export function flowField(grid, goals) {
  goals = Array.from(goals);
  const { cols, rows } = grid;
  const dist = new Int32Array(cols * rows).fill(-1);
  const queue = new Int32Array(cols * rows);
  let head = 0;
  let tail = 0;

  for (const g of goals) {
    const cx = g.cx | 0;
    const cy = g.cy | 0;
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
    if (!grid.walkable(cx, cy)) continue;
    const i = cy * cols + cx;
    if (dist[i] !== -1) continue;
    dist[i] = 0;
    queue[tail++] = i;
  }

  while (head < tail) {
    const i = queue[head++];
    const cx = i % cols;
    const cy = (i / cols) | 0;
    const d = dist[i] + 1;
    for (let k = 0; k < 4; k++) {
      const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx;
      if (dist[j] !== -1 || !grid.walkable(nx, ny)) continue;
      dist[j] = d;
      queue[tail++] = j;
    }
  }

  return {
    cols,
    rows,
    dist,
    // where it was computed towards, so `stepAlong` can break its ties on the
    // straight line rather than on the order of a loop
    goal: goals.length ? { cx: goals[0].cx | 0, cy: goals[0].cy | 0 } : null,
    at(cx, cy) {
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return -1;
      return dist[cy * cols + cx];
    },
  };
}

/**
 * The next cell to walk to, or null at the goal / cut off from it.
 *
 * Diagonals only where both orthogonals are open: a soldier that cuts a corner
 * walks through the corner, and on a field with one-tile corridors that reads
 * as walking through the wall.
 *
 * **Ties are broken by the straight line to the goal, not by the loop order**,
 * and that is not a nicety. The first version took the first strictly-better
 * neighbour it found, which on open ground means up-left wins every tie — so a
 * squad walking left routed a shade more directly than a squad walking right.
 * On a field that mirrors cell for cell it was worth six points a match to
 * whoever defended the right-hand half, and it only showed up in the open
 * arena, because a corridor has no ties to break.
 */
export function stepAlong(field, grid, cx, cy) {
  const here = field.at(cx, cy);
  if (here <= 0) return null;
  let best = null;
  let bestScore = Infinity;
  let bestPull = Infinity;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (!grid.walkable(nx, ny)) continue;
      if (dx && dy && (!grid.walkable(cx + dx, cy) || !grid.walkable(cx, cy + dy))) continue;
      const d = field.at(nx, ny);
      // never a step that does not close the gap: with the straight-line
      // tie-break below, a sideways step that merely points more at the goal
      // would be taken for ever and the body would pace on the spot
      if (d === -1 || d >= here) continue;
      const score = d + (dx && dy ? -0.25 : 0);   // the tie-break that stops a zig-zag
      const pull = field.goal ? (nx - field.goal.cx) ** 2 + (ny - field.goal.cy) ** 2 : 0;
      if (score < bestScore - 1e-6 || (Math.abs(score - bestScore) < 1e-6 && pull < bestPull)) {
        bestScore = score;
        bestPull = pull;
        best = { cx: nx, cy: ny };
      }
    }
  }
  return best;
}

/**
 * Slide a circle through the grid: move on X, then on Y, refusing whichever
 * axis puts it inside something solid. Two passes is what makes a corner feel
 * like a corner instead of a full stop.
 */
export function moveCircle(grid, x, y, r, dx, dy) {
  let nx = x + dx;
  if (blocked(grid, nx, y, r)) nx = x;
  let ny = y + dy;
  if (blocked(grid, nx, ny, r)) ny = y;
  return { x: nx, y: ny };
}

export function blocked(grid, x, y, r) {
  const minX = Math.floor((x - r) / TILE);
  const maxX = Math.floor((x + r) / TILE);
  const minY = Math.floor((y - r) / TILE);
  const maxY = Math.floor((y + r) / TILE);
  for (let cy = minY; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) {
      if (grid.walkable(cx, cy)) continue;
      const px = Math.max(cx * TILE, Math.min(x, cx * TILE + TILE));
      const py = Math.max(cy * TILE, Math.min(y, cy * TILE + TILE));
      if ((x - px) ** 2 + (y - py) ** 2 < r * r) return true;
    }
  }
  return false;
}

/** Every standable cell — what a spawn search and the tests walk. */
export function walkableCells(grid) {
  const out = [];
  for (let cy = 0; cy < grid.rows; cy++) {
    for (let cx = 0; cx < grid.cols; cx++) {
      if (grid.walkable(cx, cy)) out.push({ cx, cy });
    }
  }
  return out;
}

/** The nearest standable cell to (cx, cy) — how anything dropped finds a floor. */
export function nearestOpen(grid, cx, cy, max = 6) {
  if (grid.walkable(cx, cy)) return { cx, cy };
  for (let r = 1; r <= max; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (grid.walkable(cx + dx, cy + dy)) return { cx: cx + dx, cy: cy + dy };
      }
    }
  }
  return null;
}
