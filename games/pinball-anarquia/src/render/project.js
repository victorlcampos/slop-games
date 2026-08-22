// The table is simulated flat, from above, and drawn tilted away from you.
//
// Canvas 2D has no perspective transform, so the picture is built in two
// halves: the painted playfield is a flat texture warped one scanline at a
// time (the trick every mode-7 racer used), and everything that moves is
// *projected* — its position, its size and its height come from here.
//
// The projection is a pinhole camera looking down at a horizontal plane from
// above its near edge. For a plane at a constant depth below the eye, both the
// horizontal scale and the screen row are proportional to 1/depth, which is
// why a single scale `s` carries all of it:
//
//   s(t) = 1 / (D0 - (D0 - 1)·t)     t = 0 at the far end, 1 at the near one
//
// Give it the far/near width ratio and the two screen rows the table has to
// land on, and everything else follows.

export function createProjection(v) {
  const D0 = 1 / v.far;
  const span = D0 - 1;
  const kx = (v.halfW * 2) / v.srcW;
  // screenY = A + B·s, pinned so s = far lands on `top` and s = 1 on `bottom`
  const B = (v.bottom - v.top) / (1 - v.far);
  const A = v.top - B * v.far;

  // Screen pixels per source pixel at the near edge, each way. The table is
  // rarely drawn at its own aspect — a phone held upright wants it narrow and
  // tall, a monitor wants it wide — so the two differ, and a round thing sized
  // by either one alone comes out wrong on one of the two layouts.
  const vScale1 = (B * span) / v.srcH;
  // one isotropic number for anything that has to stay round
  const blend = Math.sqrt(kx * vScale1);

  const scaleFor = (t) => 1 / (D0 - span * clamp01(t));

  /** The width scale at a source row. */
  const sAt = (y) => scaleFor(y / v.srcH);

  /** A source point, on the felt, on screen. */
  const at = (x, y) => {
    const s = sAt(y);
    return { x: v.cx + (x - v.srcW / 2) * kx * s, y: A + B * s, s };
  };

  /** What to multiply a radius by, so a circle stays a circle. */
  const sizeAt = (y) => blend * sAt(y);

  /**
   * The same point, `h` units above the playfield.
   *
   * The camera looks straight down the table with no roll, so world verticals
   * stay vertical on screen and standing up is purely a shift toward the
   * horizon — which is up. Drawing the base where the physics is and the top
   * face up here is what turns a bumper from a disc printed on the felt into
   * something the ball can hit the side of.
   */
  const rise = (p, h) => ({ x: p.x, y: p.y - h * 0.55 * blend * p.s, s: p.s });

  /** Where a source row lands, and how wide it is drawn. */
  const row = (t) => {
    const s = scaleFor(t);
    return { y: A + B * s, s, w: v.srcW * kx * s };
  };

  /** The inverse — which source row a screen row is showing. The warp walks
   *  destination rows and pulls from here, so no row is ever skipped. */
  const rowAt = (screenY) => (D0 - B / (screenY - A)) / span;

  /** The table's outline on screen. */
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

  return { view: v, sAt, sizeAt, at, rise, row, rowAt, corners, kx, blend, cx: v.cx };
}

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
