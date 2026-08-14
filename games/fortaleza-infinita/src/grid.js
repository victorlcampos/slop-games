// The floor plan as a grid, and the three questions everything else asks of it:
// is this solid, can A see B, and which way is the door.
//
// Everything in the game that walks or looks goes through here, so it is worth
// keeping honest and fast: a raycast is a DDA over tiles (no sampling, no
// stepping "close enough"), and a route is a breadth-first field computed once
// per goal and read by every guard heading there.

import { TILE } from './config.js';

export const WALL = 0;
export const ROOM = 1;
export const HALL = 2;
export const VAULT_FLOOR = 3;

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
    solid(cx, cy) {
      return this.at(cx, cy) === WALL;
    },
    /** Solid at a world point — the form every collision test wants. */
    solidAt(x, y) {
      return this.solid(Math.floor(x / TILE), Math.floor(y / TILE));
    },
    get width() { return cols * TILE; },
    get height() { return rows * TILE; },
  };
}

export const cellOf = (x, y) => ({ cx: Math.floor(x / TILE), cy: Math.floor(y / TILE) });
export const centreOf = (cx, cy) => ({ x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 });

/**
 * How far a ray from (x, y) in direction (dx, dy) travels before a wall stops
 * it, capped at `max`. Returns the distance, which is `max` when nothing is in
 * the way.
 *
 * This is the amanuensis of the whole game: the player's cone, every guard's
 * cone, every camera and every bullet ask it the same question.
 */
export function castRay(grid, x, y, dx, dy, max) {
  let cx = Math.floor(x / TILE);
  let cy = Math.floor(y / TILE);
  if (grid.solid(cx, cy)) return 0;

  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  // guard against a perfectly axis-aligned ray: 1/0 is Infinity, which the
  // comparisons below handle correctly, but 0/0 is NaN, which they do not
  const invX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const invY = dy === 0 ? Infinity : Math.abs(1 / dy);

  let tMaxX = dx === 0 ? Infinity : ((dx > 0 ? (cx + 1) * TILE - x : x - cx * TILE) / Math.abs(dx));
  let tMaxY = dy === 0 ? Infinity : ((dy > 0 ? (cy + 1) * TILE - y : y - cy * TILE) / Math.abs(dy));
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
 * Is there a clear line **wide enough for a body of radius `r`** to walk?
 *
 * The thin version of this question is the one that cost the most time here. A
 * guard whose route is "straight there, I can see it" walks the hypotenuse into
 * the corner of a wall, wedges at fifteen pixels — his own radius — and stands
 * there for the rest of the floor, still able to see the alarm he is trying to
 * reach. Three rays instead of one, offset by his width, and the shortcut is
 * only taken where he actually fits.
 */
export function clearFor(grid, ax, ay, bx, by, r) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return true;
  const px = (-dy / len) * r;
  const py = (dx / len) * r;
  return (
    lineOfSight(grid, ax, ay, bx, by) &&
    lineOfSight(grid, ax + px, ay + py, bx + px, by + py) &&
    lineOfSight(grid, ax - px, ay - py, bx - px, by - py)
  );
}

/**
 * A breadth-first distance field from one or more goal cells, in steps.
 *
 * Guards share these: while the building is calm each patrol goal gets its own
 * and it is only recomputed when the goal changes; once the alarm is ringing
 * every guard reads the same one, recomputed a couple of times a second from
 * wherever you were last seen.
 */
export function flowField(grid, goals) {
  const { cols, rows } = grid;
  const dist = new Int32Array(cols * rows).fill(-1);
  const queue = new Int32Array(cols * rows);
  let head = 0;
  let tail = 0;

  for (const g of goals) {
    const cx = g.cx | 0;
    const cy = g.cy | 0;
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
    if (grid.solid(cx, cy)) continue;
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
      if (dist[j] !== -1 || grid.solid(nx, ny)) continue;
      dist[j] = d;
      queue[tail++] = j;
    }
  }

  return {
    cols,
    rows,
    dist,
    at(cx, cy) {
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return -1;
      return dist[cy * cols + cx];
    },
  };
}

/**
 * The next cell to walk to from (cx, cy), or null at the goal / cut off from it.
 *
 * Diagonals are allowed, but only when both orthogonals are open: a guard that
 * cuts a corner walks through the corner, and on a grid of one-tile corridors
 * that reads as walking through the wall.
 */
export function stepAlong(field, grid, cx, cy) {
  const here = field.at(cx, cy);
  if (here <= 0) return null;
  let best = null;
  let bestD = here;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (grid.solid(nx, ny)) continue;
      if (dx && dy && (grid.solid(cx + dx, cy) || grid.solid(cx, cy + dy))) continue;
      const d = field.at(nx, ny);
      if (d === -1) continue;
      // the diagonal tie-break keeps a guard from zig-zagging down a wide room
      const score = d + (dx && dy ? -0.25 : 0);
      if (score < bestD) {
        bestD = score;
        best = { cx: nx, cy: ny };
      }
    }
  }
  return best;
}

/** Every walkable cell, as world points — what the generator scatters things on. */
export function walkableCells(grid) {
  const out = [];
  for (let cy = 0; cy < grid.rows; cy++) {
    for (let cx = 0; cx < grid.cols; cx++) {
      if (!grid.solid(cx, cy)) out.push({ cx, cy });
    }
  }
  return out;
}

/**
 * Slide a circle through the grid: move on X, then on Y, refusing whichever
 * axis puts it inside a wall. Two passes is what makes a corner feel like a
 * corner instead of a full stop.
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
      if (!grid.solid(cx, cy)) continue;
      // closest point on the tile to the circle's centre
      const px = Math.max(cx * TILE, Math.min(x, cx * TILE + TILE));
      const py = Math.max(cy * TILE, Math.min(y, cy * TILE + TILE));
      if ((x - px) ** 2 + (y - py) ** 2 < r * r) return true;
    }
  }
  return false;
}
