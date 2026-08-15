// Who can see what. One rule, used by everybody: inside the cone, inside the
// range, and nothing solid in between.
//
// It is Infinite Fortress's vision, with the cone's width made a setting. A lit
// arena hands it 360°, which is the whole of "you see the room you are standing
// in": the angle test passes for everything and the walls do all the work. The
// night arena hands it the Fortress's torch — 104° and a small circle you feel
// rather than see. **Neither one lets anybody see through a wall**, because in
// both cases the answer comes from the same ray.

import { castRay, lineOfSight, WALL } from './grid.js';
import { angleDelta, RAD, TILE } from './config.js';

/**
 * Can an eye at (ex, ey) facing `facing` see the point (tx, ty)?
 *
 * `fov` is the **full** width of the cone in degrees, which is how everybody
 * writes it down and the opposite of what the maths wants — halving it here
 * once is cheaper than remembering to halve it at six call sites. At 360 the
 * comparison is skipped altogether rather than fudged: half of 360 is 180, and
 * `angleDelta` returns exactly ±180 at the back, so the test would flicker on
 * the one ray directly behind you.
 */
export function canSee(grid, ex, ey, facing, fov, range, tx, ty) {
  const dx = tx - ex;
  const dy = ty - ey;
  const d2 = dx * dx + dy * dy;
  if (d2 > range * range) return false;
  if (d2 < 1) return true;
  if (fov < 360 && Math.abs(angleDelta(facing, Math.atan2(dy, dx))) > fov * RAD * 0.5) return false;
  return lineOfSight(grid, ex, ey, tx, ty);
}

/**
 * Every corner of every wall on the field, as world points.
 *
 * This is the list the visibility polygon is built out of, and it depends only
 * on the grid — so it is worked out once per arena and kept. A node counts as a
 * corner when the four tiles around it are not all wall and not all floor: the
 * places where a wall's silhouette turns, and nowhere else. The middle of a
 * long wall face is not a corner and adds nothing but rays.
 */
const CORNERS = new WeakMap();

export function wallCorners(grid) {
  const kept = CORNERS.get(grid);
  if (kept) return kept;
  const out = [];
  for (let ny = 0; ny <= grid.rows; ny++) {
    for (let nx = 0; nx <= grid.cols; nx++) {
      let walls = 0;
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        if (grid.at(nx + dx, ny + dy) === WALL) walls++;
      }
      if (walls > 0 && walls < 4) out.push({ x: nx * TILE, y: ny * TILE });
    }
  }
  CORNERS.set(grid, out);
  return out;
}

/**
 * The polygon an eye can actually see, as a flat ring of x,y pairs.
 *
 * **The rays go to the corners**, not to a fixed set of angles, and that is the
 * difference between a shadow and a shimmer. A uniform fan puts a ray every
 * couple of degrees, which is twenty pixels apart across a room: as you walk,
 * each ray crosses a wall corner at a slightly different moment and its length
 * jumps from "the far wall" to "this corner", so the whole edge of the light
 * boils. Casting a pair of rays either side of every corner the light can reach
 * pins the polygon to the geometry — the edges are the walls, and they move
 * with the walls rather than with the sampling.
 *
 * The uniform ring is still there underneath, but coarse: all it has to do now
 * is make the open ground round where nothing blocks it.
 *
 * The points go into a Float64Array the caller owns and reuses. A fan is three
 * hundred points and it is rebuilt every frame for every body on your squad;
 * as objects that is a hundred thousand allocations a second, which is a
 * garbage-collector hitch every few seconds — felt as a stutter while standing
 * perfectly still.
 */
const CORNER_NUDGE = 0.0009;             // radians either side of a corner

export function visibilityFan(grid, x, y, facing, fov, range, buffer = null) {
  const full = fov >= 360;
  const half = (full ? 360 : fov) * RAD * 0.5;
  const deltas = [];

  // the coarse ring: what the light does where no wall stops it
  const steps = full ? 30 : Math.max(10, Math.round(fov / 8));
  for (let i = 0; i <= steps; i++) deltas.push(-half + (2 * half * i) / steps);

  const reach = (range + TILE) * (range + TILE);
  for (const c of wallCorners(grid)) {
    const dx = c.x - x;
    const dy = c.y - y;
    if (dx * dx + dy * dy > reach) continue;
    const d = angleDelta(facing, Math.atan2(dy, dx));
    if (d < -half - CORNER_NUDGE || d > half + CORNER_NUDGE) continue;
    deltas.push(Math.max(-half, d - CORNER_NUDGE));
    deltas.push(Math.min(half, d + CORNER_NUDGE));
  }

  deltas.sort((a, b) => a - b);
  const n = deltas.length;
  const out = buffer && buffer.length >= n * 2 ? buffer : new Float64Array(Math.max(n * 2, 512));
  for (let i = 0; i < n; i++) {
    const a = facing + deltas[i];
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const t = castRay(grid, x, y, dx, dy, range);
    out[i * 2] = x + dx * t;
    out[i * 2 + 1] = y + dy * t;
  }
  return { points: out, count: n };
}

/**
 * Everything one body can see this frame: the shape, for the renderer to clip
 * to, and the cheap test that answers "is that man lit" without walking it.
 */
export function createSight(grid, x, y, facing, eyes, reuse = null) {
  const { fov, sight, near } = eyes;
  const fan = visibilityFan(grid, x, y, facing, fov, sight, reuse && reuse.fan.points);
  // The near circle is cast too, never drawn as a disc: a disc would let you
  // read the room on the other side of the wall you are leaning against, which
  // is exactly the information the night arena is about not having.
  const nearFan = near > 0
    ? visibilityFan(grid, x, y, facing, 360, near, reuse && reuse.nearFan && reuse.nearFan.points)
    : null;
  return {
    x,
    y,
    facing,
    fov,
    sight,
    near,
    fan,
    nearFan,
    sees(tx, ty) {
      if (near > 0) {
        const d2 = (tx - x) ** 2 + (ty - y) ** 2;
        if (d2 <= near * near) return lineOfSight(grid, x, y, tx, ty);
      }
      return canSee(grid, x, y, facing, fov, sight, tx, ty);
    },
  };
}
