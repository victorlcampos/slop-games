// The table itself: every wall, post, bumper, lane and sensor, as data.
//
// It is authored once, in frame coordinates (see config.js), and both the
// simulation and the renderer read the same lists — the picture and the
// physics cannot drift apart because they are the same numbers.

import { TABLE, FLIPPER, C } from './config.js';

const T = TABLE;

/** A capsule wall. */
const wall = (x1, y1, x2, y2, rad = 6, extra = {}) => ({ x1, y1, x2, y2, rad, ...extra });

export function createTable() {
  const walls = [
    // outer shell
    wall(T.left, T.arch.cy, T.left, T.bottom, 6, { id: 'left' }),
    wall(T.right, T.arch.cy, T.right, 700, 6, { id: 'laneOuter' }),
    wall(T.laneWall, 700, T.right, 700, 6, { id: 'laneFloor' }),
    wall(T.laneWall, 300, T.laneWall, T.bottom, 6, { id: 'laneInner' }),

    // one-way gate at the lane's mouth: solid from the playfield side, open to
    // a ball on its way up. The normal points up-left, out of the lane.
    wall(470, 298, 508, 278, 4, { id: 'gate', oneway: norm(-20, -38), e: 0.2 }),

    // top rollover lane guides, hanging from the arch
    wall(136, 56, 136, 140, 5, { id: 'lg0', e: 0.35 }),
    wall(208, 30, 208, 140, 5, { id: 'lg1', e: 0.35 }),
    wall(280, 30, 280, 140, 5, { id: 'lg2', e: 0.35 }),
    wall(352, 56, 352, 140, 5, { id: 'lg3', e: 0.35 }),

    // the wall the drop targets stand in front of
    wall(44, 310, 102, 442, 6, { id: 'targetBack', e: 0.3 }),

    // inlane dividers and the shoes that feed the flippers
    wall(88, 545, 118, 640, 5, { id: 'inL' }),
    wall(118, 640, 154, 662, 5, { id: 'shoeL' }),
    wall(400, 545, 370, 640, 5, { id: 'inR' }),
    wall(370, 640, 334, 662, 5, { id: 'shoeR' }),
  ];

  // slingshots: the long face kicks, the other two sides are plain wall
  const slings = [
    // they sit 12px higher than they look like they should: any lower and a
    // ball wedges into the notch between their bottom corner and the shoe
    {
      id: 'slingL',
      face: wall(142, 544, 186, 612, 5, { e: 0.4 }),
      body: [wall(186, 612, 142, 612, 5), wall(142, 612, 142, 544, 5)],
      n: norm(68, -44),
      flash: 0,
    },
    {
      id: 'slingR',
      face: wall(346, 544, 302, 612, 5, { e: 0.4 }),
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

  // round posts scatter what falls off the arch — without the guard above the
  // wormhole, every full-power launch fell straight into it, same path every time
  const posts = [
    { x: 438, y: 322, r: 9 },
    { x: 396, y: 250, r: 8 },
    { x: 62, y: 232, r: 8 },
  ];

  const hole = { x: 426, y: 352, r: 15, eject: { vx: -520, vy: -640 }, flash: 0 };
  const kickback = { x: 44, y: 688, r: 18, lit: true, flash: 0 };
  const skillShot = { x: 492, y: 320, r: 16 };

  const flippers = [
    makeFlipper('L', 158, 662, 1),
    makeFlipper('R', 330, 662, -1),
  ];

  return { walls, slings, bumpers, targets, rollovers, posts, hole, kickback, skillShot, flippers, arch: T.arch };
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
