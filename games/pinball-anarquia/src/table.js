// The table itself: every wall, post, bumper, lane and sensor, as data.
//
// It is authored once, in frame coordinates (see config.js), and both the
// simulation and the renderer read the same lists — the picture and the
// physics cannot drift apart because they are the same numbers.

import { TABLE, FLIPPER, PLUNGER, C } from './config.js';

const T = TABLE;

/** A capsule wall. */
const wall = (x1, y1, x2, y2, rad = 6, extra = {}) => ({ x1, y1, x2, y2, rad, friction: 0.06, ...extra });

export function createTable() {
  const walls = [
    // outer shell
    wall(T.left, T.arch.cy, T.left, T.bottom, 6, { id: 'left' }),
    // the lane runs past the ball's resting place, because the plunger draws
    // the ball down with it — and the floor is a backstop under the rod's
    // lowest reach, not the thing the ball normally sits on
    wall(T.right, T.arch.cy, T.right, PLUNGER.baseY, 6, { id: 'laneOuter' }),
    wall(T.laneWall, PLUNGER.baseY, T.right, PLUNGER.baseY, 6, { id: 'laneFloor' }),
    wall(T.laneWall, 300, T.laneWall, PLUNGER.baseY, 6, { id: 'laneInner' }),

    // one-way gate at the lane's mouth: solid from the playfield side, open to
    // a ball on its way up. The normal points up-left, out of the lane.
    wall(470, 298, 508, 278, 4, { id: 'gate', oneway: norm(-20, -38), e: 0.2 }),

    // Top rollover lane guides, hanging from the arch. Their tops follow the
    // arch, and they have to: a ball riding the arch round the top clears a
    // guide only if its cap is more than a ball's diameter below the arch's
    // inner surface at that x, and lg0 and lg1 used to stand three and seven
    // pixels *proud* of it. The top orbit was sealed. Nothing on screen said
    // so — the guides look like a comb you could whip a ball over — and it is
    // why every launch, at every strength, dribbled down the right-hand side
    // into the outlane instead of going round.
    wall(136, 74, 136, 140, 5, { id: 'lg0', e: 0.35 }),
    wall(208, 44, 208, 140, 5, { id: 'lg1', e: 0.35 }),
    wall(280, 38, 280, 140, 5, { id: 'lg2', e: 0.35 }),
    wall(352, 56, 352, 140, 5, { id: 'lg3', e: 0.35 }),

    // The wall the drop targets stand in front of. It reaches the left rail:
    // the gap it used to leave was exactly one ball wide, so everything that
    // came round the top orbit slipped down the outside of the target bank and
    // straight into the left outlane. An orbit should return the ball to the
    // playfield; an outlane is fed from below, by a ball that missed a flipper.
    wall(22, 290, 102, 442, 6, { id: 'targetBack', e: 0.3 }),

    // The lower half of the right habitrail, which the renderer has always
    // drawn as "the one that brings the ball back down" and the physics has
    // always ignored. It is a wall now, and together with the divider below it
    // the right outlane is an outlane instead of a funnel: everything that came
    // over the top of the table used to cross seventy pixels of open air and
    // drop straight into it.
    // It runs along the rail the renderer already draws down that side of the
    // habitrail, and it has to *reach* the lane wall: an end cap eight pixels
    // short of it is a notch a ball drops into and stays in, which is the same
    // mistake as the flipper's pivot in a different corner of the table.
    wall(463, 352, 455, 440, 5, { id: 'railR0', e: 0.3 }),
    wall(455, 440, 404, 524, 5, { id: 'railR1', e: 0.3 }),

    // Inlane dividers and the shoes that feed the flippers. The shoe used to
    // aim straight at the flipper's pivot, which meant the pivot's round cap
    // stood six pixels proud of the surface the ball was rolling down — a
    // curb, with a pocket behind it, and a ball that reached it stopped there
    // for good. It runs tangent to that cap now, so the ball rolls over the
    // pivot and onto the flipper instead of into a corner.
    wall(88, 545, 118, 640, 5, { id: 'inL' }),
    wall(118, 640, 158, 652, 5, { id: 'shoeL' }),
    wall(404, 524, 370, 640, 5, { id: 'inR' }),
    wall(370, 640, 330, 652, 5, { id: 'shoeR' }),
  ];

  // slingshots: the long face kicks, the other two sides are plain wall
  const slings = [
    // they sit 12px higher than they look like they should: any lower and a
    // ball wedges into the notch between their bottom corner and the shoe
    {
      id: 'slingL',
      face: wall(142, 544, 186, 612, 5, { e: 0.4, friction: 0.34 }),
      body: [wall(186, 612, 142, 612, 5), wall(142, 612, 142, 544, 5)],
      n: norm(68, -44),
      flash: 0,
    },
    {
      id: 'slingR',
      face: wall(346, 544, 302, 612, 5, { e: 0.4, friction: 0.34 }),
      body: [wall(302, 612, 346, 612, 5), wall(346, 612, 346, 544, 5)],
      n: norm(-68, -44),
      flash: 0,
    },
  ];

  const bumpers = [
    { id: 'b0', x: 170, y: 240, r: 27, color: C.blue, flash: 0 },
    { id: 'b1', x: 298, y: 215, r: 27, color: C.purple, flash: 0 },
    { id: 'b2', x: 232, y: 335, r: 27, color: C.green, flash: 0 },
  ];

  // three drop targets on a diagonal in front of targetBack
  const targets = seq3(52, 318, 108, 432).map((s, i) => ({
    id: 't' + i,
    ...s,
    rad: 4,
    e: 0.3,
    up: true,
    flash: 0,
  }));

  const rollovers = [
    { id: 'r0', x: 172, y: 108, r: 14, lit: false, flash: 0 },
    { id: 'r1', x: 244, y: 100, r: 14, lit: false, flash: 0 },
    { id: 'r2', x: 316, y: 108, r: 14, lit: false, flash: 0 },
  ];

  // Round posts scatter what falls off the arch. Without the guard above the
  // wormhole every full-power launch fell straight into it, on the same path
  // every time — and where exactly it stands turns out to decide what the whole
  // launch does: twelve pixels to the right of here, nine launches in ten came
  // down the right-hand side and out of the outlane without touching a single
  // thing on the table. From here, half of them find something.
  const posts = [
    { x: 418, y: 298, r: 9 },
    { x: 396, y: 250, r: 8 },
    { x: 62, y: 232, r: 8 },
  ];

  const hole = { x: 426, y: 352, r: 15, eject: { vx: -520, vy: -640 }, flash: 0 };

  // Everything below is a *sensor*: it notices the ball and never touches it.
  // That is the whole reason this many scoring shots could be added to a table
  // that was already tuned — a sensor cannot wedge a ball, cannot change a
  // bounce, and cannot turn a good playfield into a trap.
  const spinner = { x: 120, y: 205, r: 17, angle: 0, spin: 0, flash: 0 };
  const inlanes = [
    { id: 'inL', x: 130, y: 604, r: 13, lit: false, flash: 0 },
    { id: 'inR', x: 358, y: 604, r: 13, lit: false, flash: 0 },
  ];
  const outlanes = [
    { id: 'outL', x: 50, y: 618, r: 13, flash: 0 },
    { id: 'outR', x: 440, y: 618, r: 13, flash: 0 },
  ];
  // the two ends of the orbit: touch one, then the other, and you went round
  const loops = [
    { id: 'loopL', x: 58, y: 272, r: 24, flash: 0 },
    { id: 'loopR', x: 456, y: 268, r: 24, flash: 0 },
  ];
  const kickback = { x: 44, y: 688, r: 18, lit: true, flash: 0 };
  const skillShot = { x: 492, y: 320, r: 16 };

  const flippers = [
    makeFlipper('L', 158, 662, 1),
    makeFlipper('R', 330, 662, -1),
  ];

  // The rod. `p` is how far back it is drawn from the stop, `v` how fast it is
  // travelling (down positive). Its tip is a capsule stretched across the lane
  // and it is in the collision list like any other wall — the ball rests on it
  // and rides it, which is the whole point.
  const plunger = {
    p: 0,
    v: 0,
    face: {
      x1: T.laneWall, y1: PLUNGER.restY, x2: T.right, y2: PLUNGER.restY,
      rad: PLUNGER.tipRad,
      // Dead: a rubber tip does not bounce, and more importantly a springy one
      // would flick the ball off the moment the rod started moving. With e=0
      // the ball simply takes the rod's speed, stays in contact all the way up
      // the stroke, and leaves with everything the spring had.
      e: 0,
      sx: 0, sy: 0, friction: 0.25,
    },
  };

  return {
    walls, slings, bumpers, targets, rollovers, posts, hole, kickback, skillShot, flippers, plunger,
    spinner, inlanes, outlanes, loops,
    arch: T.arch,
  };
}

function makeFlipper(id, px, py, dir) {
  return {
    id,
    px,
    py,
    dir, // 1 = left flipper (tip to the right), -1 mirrored
    len: FLIPPER.length,
    r: FLIPPER.r,
    angle: FLIPPER.rest,
    target: FLIPPER.rest,
    omega: 0, // signed, rad/s, set while travelling
  };
}

/**
 * The rod, one slice. `pulling` is the player's hand: it draws the rod back at
 * a constant rate and holds it there. Let go and the only thing acting on it is
 * the spring — a = -k*p — until it reaches the stop, which takes the rest of
 * the energy and is the clack you hear on a real machine.
 */
export function plungerStep(pl, dt, pulling) {
  if (pulling) {
    pl.v = pl.p < PLUNGER.travel ? PLUNGER.travel / PLUNGER.pullTime : 0;
    pl.p = Math.min(PLUNGER.travel, pl.p + pl.v * dt);
  } else if (pl.p > 0 || pl.v !== 0) {
    pl.v -= PLUNGER.k * pl.p * dt;
    pl.p += pl.v * dt;
    if (pl.p <= 0) { pl.p = 0; pl.v = 0; }
  }
  pl.face.y1 = pl.face.y2 = PLUNGER.restY + pl.p;
  pl.face.sy = pl.v;
  return pl;
}

/** The flipper's tip for its current angle. */
export function flipperTip(f) {
  return { x: f.px + Math.cos(f.angle) * f.len * f.dir, y: f.py + Math.sin(f.angle) * f.len };
}

/** Advance a flipper toward its target angle; sets omega for the collision. */
export function flipperStep(f, dt) {
  const d = f.target - f.angle;
  if (Math.abs(d) < 1e-4) {
    f.omega = 0;
    f.angle = f.target;
    return;
  }
  const step = Math.sign(d) * FLIPPER.omega * dt;
  if (Math.abs(step) >= Math.abs(d)) {
    f.omega = d / dt;
    f.angle = f.target;
  } else {
    f.omega = Math.sign(d) * FLIPPER.omega;
    f.angle += step;
  }
}

/**
 * The velocity of the flipper's surface at a point along its arm — what makes
 * a moving flipper *throw* the ball instead of just being a wall. The angular
 * velocity of the drawn arm is dir * omega (the mirror flips the sense).
 */
export function flipperSurfaceVel(f, qx, qy) {
  const w = f.omega * f.dir;
  return { sx: -w * (qy - f.py), sy: w * (qx - f.px) };
}

function norm(x, y) {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}

/** Three collinear segments with gaps, from (x1,y1) to (x2,y2). */
function seq3(x1, y1, x2, y2) {
  const at = (t) => ({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
  return [
    [0.04, 0.28],
    [0.38, 0.62],
    [0.72, 0.96],
  ].map(([a, b]) => {
    const p = at(a);
    const q = at(b);
    return { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
  });
}
