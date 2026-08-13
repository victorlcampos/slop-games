// Who can see what. One rule, used by everybody: inside the cone, inside the
// range, and nothing solid in between.
//
// The player's own sight is the same rule turned into a shape — a fan of rays
// stopped by walls — which the renderer uses as a clip path. That is the whole
// of the fog: there is no second system deciding what is dark.

import { castRay, lineOfSight } from './grid.js';
import { angleDelta, RAD, TILE } from './config.js';

/**
 * Can an eye at (ex, ey) facing `facing` see the point (tx, ty)?
 *
 * `fov` is the **full** width of the cone in degrees, which is how everybody
 * writes it down and the opposite of what the maths wants — halving it here
 * once is cheaper than remembering to halve it at six call sites.
 */
export function canSee(grid, ex, ey, facing, fov, range, tx, ty) {
  const dx = tx - ex;
  const dy = ty - ey;
  const d2 = dx * dx + dy * dy;
  if (d2 > range * range) return false;
  if (d2 < 1) return true;
  if (Math.abs(angleDelta(facing, Math.atan2(dy, dx))) > fov * RAD * 0.5) return false;
  return lineOfSight(grid, ex, ey, tx, ty);
}

/**
 * The polygon an eye can actually see, as a ring of points around it.
 *
 * `near` is a second, unblocked circle: you always know what is at your feet,
 * even behind you. Without it, standing in a doorway leaves you unable to see
 * the wall you are touching, which reads as a bug rather than as darkness.
 */
export function visibilityFan(grid, x, y, facing, fov, range, rays = 132) {
  const half = fov * RAD * 0.5;
  const pts = [];
  for (let i = 0; i <= rays; i++) {
    const a = facing - half + (2 * half * i) / rays;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const t = castRay(grid, x, y, dx, dy, range);
    pts.push({ x: x + dx * t, y: y + dy * t, a, t });
  }
  return pts;
}

/**
 * Everything the player can see this frame, as one shape plus the cheap test
 * that answers "is this entity lit" without walking the polygon.
 */
export function createSight(grid, x, y, facing, { fov, sight, near }) {
  const fan = visibilityFan(grid, x, y, facing, fov, sight);
  // The near circle is cast too, not drawn as a disc: a disc would let you read
  // the room on the other side of the wall you are leaning against, which is
  // exactly the information the whole game is about not having.
  const nearFan = visibilityFan(grid, x, y, facing, 360, near, 44);
  return {
    x,
    y,
    facing,
    fov,
    sight,
    near,
    fan,
    nearFan,
    /** Lit if it is in the cone, or close enough to touch. */
    sees(tx, ty) {
      const d2 = (tx - x) ** 2 + (ty - y) ** 2;
      if (d2 <= near * near) return lineOfSight(grid, x, y, tx, ty);
      return canSee(grid, x, y, facing, fov, sight, tx, ty);
    },
  };
}

/**
 * Marks every cell the player can see as explored, and returns how many were
 * new — the number the "floor explored" figure on the HUD is made of.
 *
 * It walks the bounding box of the cone rather than the whole grid: on the
 * biggest floor that is a fortieth of the cells, sixty times a second.
 */
export function rememberSeen(grid, seen, sight) {
  let fresh = 0;
  const r = Math.max(sight.sight, sight.near);
  const minX = Math.max(0, Math.floor((sight.x - r) / TILE));
  const maxX = Math.min(grid.cols - 1, Math.floor((sight.x + r) / TILE));
  const minY = Math.max(0, Math.floor((sight.y - r) / TILE));
  const maxY = Math.min(grid.rows - 1, Math.floor((sight.y + r) / TILE));

  for (let cy = minY; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) {
      const i = cy * grid.cols + cx;
      if (seen[i]) continue;
      // a wall is seen when its face is seen, so test the centre and the four
      // edge midpoints — otherwise a wall you are standing against stays black
      const bx = cx * TILE;
      const by = cy * TILE;
      if (
        sight.sees(bx + TILE / 2, by + TILE / 2) ||
        sight.sees(bx + TILE / 2, by + 2) ||
        sight.sees(bx + TILE / 2, by + TILE - 2) ||
        sight.sees(bx + 2, by + TILE / 2) ||
        sight.sees(bx + TILE - 2, by + TILE / 2)
      ) {
        seen[i] = 1;
        fresh++;
      }
    }
  }
  return fresh;
}
