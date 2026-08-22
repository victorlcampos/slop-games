// The collision arithmetic, pure and importable from Node.
//
// A pinball is one circle against a list of capsules (segments with a radius)
// and circles. Nothing here knows about scoring or lights — it moves the ball
// and reports what it touched; game.js decides what that means.

/** Closest point on segment (x1,y1)-(x2,y2) to point (px,py). */
export function closestOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return { x: x1 + t * dx, y: y1 + t * dy, t };
}

/**
 * Reflect the ball's velocity off a surface with normal (nx,ny) moving at
 * (sx,sy). Only the approaching half is reflected — a ball already leaving is
 * left alone, which is what stops a resting ball from jittering.
 */
export function reflect(ball, nx, ny, e, sx = 0, sy = 0) {
  const rvx = ball.vx - sx;
  const rvy = ball.vy - sy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  ball.vx = rvx - (1 + e) * vn * nx + sx;
  ball.vy = rvy - (1 + e) * vn * ny + sy;
  return -vn; // how hard the hit was, for whoever wants to score or flash it
}

/**
 * Resolve the ball against one capsule. Returns the impact speed (0 = no
 * contact). `seg` may carry:
 *   rad     — half thickness of the wall (default 0)
 *   e       — restitution (default 0.5)
 *   oneway  — {x,y}: only solid to a ball on that side of the segment
 *   sx, sy  — surface velocity at the contact (flippers pass it per-contact)
 */
export function collideSegment(ball, seg, e = 0.5) {
  const q = closestOnSegment(ball.x, ball.y, seg.x1, seg.y1, seg.x2, seg.y2);
  let nx = ball.x - q.x;
  let ny = ball.y - q.y;
  const dist = Math.hypot(nx, ny);
  const reach = ball.r + (seg.rad || 0);
  if (dist >= reach) return 0;

  if (dist < 1e-6) {
    // dead centre on the line: push out along the segment's left normal
    nx = -(seg.y2 - seg.y1);
    ny = seg.x2 - seg.x1;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
  } else {
    nx /= dist;
    ny /= dist;
  }

  if (seg.oneway && nx * seg.oneway.x + ny * seg.oneway.y <= 0) return 0;

  ball.x = q.x + nx * reach;
  ball.y = q.y + ny * reach;
  return reflect(ball, nx, ny, seg.e !== undefined ? seg.e : e, seg.sx || 0, seg.sy || 0);
}

/** Resolve the ball against a solid circle (post, bumper body). */
export function collideCircle(ball, cx, cy, r, e = 0.6) {
  let nx = ball.x - cx;
  let ny = ball.y - cy;
  const dist = Math.hypot(nx, ny);
  const reach = ball.r + r;
  if (dist >= reach) return 0;
  if (dist < 1e-6) {
    nx = 0;
    ny = -1;
  } else {
    nx /= dist;
    ny /= dist;
  }
  ball.x = cx + nx * reach;
  ball.y = cy + ny * reach;
  return reflect(ball, nx, ny, e);
}

/**
 * Keep the ball inside the top arch: a circle it lives *inside of*, so the
 * normal points back at the centre. Only bites above the arch's centreline —
 * below it the straight walls take over.
 */
export function collideArchInside(ball, arch, e = 0.5) {
  if (ball.y > arch.cy) return 0;
  let dx = ball.x - arch.cx;
  let dy = ball.y - arch.cy;
  const dist = Math.hypot(dx, dy);
  const limit = arch.r - ball.r;
  if (dist <= limit || dist < 1e-6) return 0;
  dx /= dist;
  dy /= dist;
  ball.x = arch.cx + dx * limit;
  ball.y = arch.cy + dy * limit;
  return reflect(ball, -dx, -dy, e);
}

/** True while the ball overlaps a circular sensor (rollover, hole, kicker). */
export function inSensor(ball, s) {
  return Math.hypot(ball.x - s.x, ball.y - s.y) < s.r + ball.r * 0.4;
}

/** One integration slice: gravity, drag, clamp, move. */
export function integrate(ball, dt, gravity, drag, maxSpeed) {
  ball.vy += gravity * dt;
  const k = 1 - drag * dt;
  ball.vx *= k;
  ball.vy *= k;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > maxSpeed) {
    ball.vx *= maxSpeed / speed;
    ball.vy *= maxSpeed / speed;
  }
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
}
