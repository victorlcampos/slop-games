// Who can see what. One rule, used by everybody: inside the cone, inside the
// range, and nothing solid in between.
//
// It is Infinite Fortress's vision, with the cone's width made a setting. A lit
// arena hands it 360°, which is the whole of "you see the room you are standing
// in": the angle test passes for everything and the walls do all the work. The
// night arena hands it the Fortress's torch — 104° and a small circle you feel
// rather than see. **Neither one lets anybody see through a wall**, because in
// both cases the answer comes from the same ray.

import { castRay, lineOfSight } from './grid.js';
import { angleDelta, RAD } from './config.js';

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
 * The polygon an eye can actually see, as a ring of points around it.
 *
 * A ray every couple of degrees, each one stopped by the first wall it meets.
 * Too few and it is not a soft edge: every pair of rays landing on different
 * walls becomes a long thin triangle, and the light around a body reads as a
 * starfish.
 */
export function visibilityFan(grid, x, y, facing, fov, range, rays = 0) {
  const full = fov >= 360;
  const half = (full ? 360 : fov) * RAD * 0.5;
  const n = rays || Math.max(48, Math.round((full ? 360 : fov) / 2.6));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = facing - half + (2 * half * i) / n;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const t = castRay(grid, x, y, dx, dy, range);
    pts.push({ x: x + dx * t, y: y + dy * t, a, t });
  }
  return pts;
}

/**
 * Everything one body can see this frame: the shape, for the renderer to clip
 * to, and the cheap test that answers "is that man lit" without walking it.
 */
export function createSight(grid, x, y, facing, eyes) {
  const { fov, sight, near } = eyes;
  const fan = visibilityFan(grid, x, y, facing, fov, sight);
  // The near circle is cast too, never drawn as a disc: a disc would let you
  // read the room on the other side of the wall you are leaning against, which
  // is exactly the information the night arena is about not having.
  const nearFan = near > 0 ? visibilityFan(grid, x, y, facing, 360, near, 32) : null;
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
