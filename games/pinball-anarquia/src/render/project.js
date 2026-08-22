// The table is simulated flat, from above, and drawn tilted away from you.
//
// Canvas 2D has no perspective transform, so the picture is built in two
// halves: the painted playfield is a flat texture warped one scanline at a
// time (the trick every mode-7 racer used), and everything that moves is
// *projected* — its position and its size come from this module, and it is
// drawn round in screen space.
//
// The projection is a real pinhole camera looking down at a horizontal plane.
// For a plane at a constant height below the eye, both the horizontal scale
// and the screen row are proportional to 1/depth, which is why a single scale
// `s` carries all of it. Depth falls linearly along the table, so:
//
//   s(t) = 1 / (D0 - (D0 - 1)·t)     t = 0 at the far end, 1 at the near one
//
// and the screen row is affine in s. Nothing here is guesswork you can tune
// into looking wrong: give it the far/near width ratio and the two screen
// rows the table has to land on, and the rest follows.

export const VIEW = {
  srcW: 524,
  srcH: 720,
  cx: 300, // where the table's centreline sits on screen
  halfW: 288, // half the table's width at the NEAR edge
  // The far edge stops well short of the frame: the backboard stands behind it
  // and the lockdown bar juts out in front, and both of those are off the
  // playfield. Pinning the table to the very top clipped the pair of them.
  top: 62, // screen row of the far edge
  bottom: 686, // screen row of the near edge
  far: 0.6, // how wide the far edge is, as a fraction of the near one
};

export function createProjection(v = VIEW) {
  const D0 = 1 / v.far;
  const span = D0 - 1;
  const kx = (v.halfW * 2) / v.srcW;
  // screenY = A + B·s, pinned so s = far lands on `top` and s = 1 on `bottom`
  const B = (v.bottom - v.top) / (1 - v.far);
  const A = v.top - B * v.far;

  const scaleFor = (t) => 1 / (D0 - span * clamp01(t));

  /** The width scale at a source row. */
  const sAt = (y) => scaleFor(y / v.srcH);

  /** A source point, on screen. `s` is what to multiply a radius by. */
  const at = (x, y) => {
    const s = sAt(y);
    return { x: v.cx + (x - v.srcW / 2) * kx * s, y: A + B * s, s };
  };

  /** Where a source row lands, and how wide it is drawn. */
  const row = (t) => {
    const s = scaleFor(t);
    return { y: A + B * s, s, w: v.srcW * kx * s };
  };

  /** The inverse — which source row a screen row is showing. The warp walks
   *  destination rows and pulls from here, so no row is ever skipped. */
  const rowAt = (screenY) => (D0 - B / (screenY - A)) / span;

  /** The table's outline on screen, near corners first. */
  const corners = () => {
    const n = row(1);
    const f = row(0);
    return {
      bl: { x: v.cx - n.w / 2, y: n.y },
      br: { x: v.cx + n.w / 2, y: n.y },
      tr: { x: v.cx + f.w / 2, y: f.y },
      tl: { x: v.cx - f.w / 2, y: f.y },
    };
  };

  return { view: v, sAt, at, row, rowAt, corners, kx, cx: v.cx, top: v.top, bottom: v.bottom };
}

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
