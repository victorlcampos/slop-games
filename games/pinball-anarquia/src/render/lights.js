// Where every lamp on the table lives.
//
// One list, read twice: the felt paints the dark socket each lamp sits in, and
// the live layer paints the ones that are on. Keeping the geometry here is
// what stops the two from drifting — a socket with no lamp over it is a hole
// in the table, and a lamp with no socket floats.
//
// The chases below are what the Space Cadet table actually sold: it was never
// really about which lamp meant what, it was about the whole playfield being
// in motion while you played.

import { C } from '../config.js';
import { RAMPS, rampLamps } from './props.js';

/** Lamps evenly spaced along an arc. */
export function arcLamps(cx, cy, r, a0, a1, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / (n - 1);
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

/** Lamps evenly spaced along a polyline. */
export function pathLamps(pts, n) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    seg.push(d);
    total += d;
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    let want = (total * i) / (n - 1);
    let k = 0;
    while (k < seg.length - 1 && want > seg[k]) {
      want -= seg[k];
      k++;
    }
    const t = seg[k] ? want / seg[k] : 0;
    out.push({
      x: pts[k].x + (pts[k + 1].x - pts[k].x) * t,
      y: pts[k].y + (pts[k + 1].y - pts[k].y) * t,
    });
  }
  return out;
}

const PI = Math.PI;

/**
 * The lamp strings. `chase` picks the animation:
 *   run   — a bead of light travelling along the string
 *   pulse — the whole string breathing together
 *   alt   — every other lamp, swapping
 */
export const STRINGS = [
  {
    id: 'orbit-outer',
    color: C.cyan,
    r: 3.4,
    chase: 'run',
    speed: 5,
    lamps: arcLamps(262, 252, 228, PI * 1.02, PI * 1.98, 28),
  },
  {
    id: 'orbit-inner',
    color: C.purple,
    r: 3,
    chase: 'run',
    speed: -3.4,
    lamps: arcLamps(262, 252, 182, PI * 1.1, PI * 1.9, 20),
  },
  {
    id: 'dome-crown',
    color: C.red,
    r: 2.8,
    chase: 'alt',
    speed: 2.6,
    lamps: arcLamps(262, 252, 205, PI * 1.16, PI * 1.84, 16),
  },
  {
    id: 'rail-left',
    color: C.orange,
    r: 3,
    chase: 'run',
    speed: 2.2,
    lamps: pathLamps([{ x: 30, y: 300 }, { x: 27, y: 400 }, { x: 32, y: 500 }, { x: 44, y: 560 }], 10),
  },
  {
    id: 'rail-right',
    color: C.orange,
    r: 3,
    chase: 'run',
    speed: -2.2,
    lamps: pathLamps([{ x: 462, y: 340 }, { x: 466, y: 430 }, { x: 460, y: 510 }, { x: 448, y: 560 }], 10),
  },
  {
    id: 'fan',
    color: C.yellow,
    r: 3.2,
    chase: 'pulse',
    speed: 1.6,
    lamps: arcLamps(245, 452, 98, PI * 1.14, PI * 1.86, 13),
  },
  // These two ride the ramps, so their positions and their heights come from
  // the ramp geometry rather than from a second list that would drift out of
  // step with it the first time a curve moved.
  {
    id: 'ramp-left',
    color: C.orange,
    r: 2.8,
    chase: 'run',
    speed: 4.2,
    lamps: rampLamps(RAMPS[0]),
  },
  {
    id: 'ramp-right',
    color: C.teal,
    r: 2.8,
    chase: 'run',
    speed: -4.2,
    lamps: rampLamps(RAMPS[1]),
  },
  {
    id: 'outlane-left',
    color: C.red,
    r: 3,
    chase: 'alt',
    speed: 3.2,
    lamps: pathLamps([{ x: 52, y: 590 }, { x: 46, y: 634 }, { x: 52, y: 678 }], 6),
  },
  {
    id: 'outlane-right',
    color: C.red,
    r: 3,
    chase: 'alt',
    speed: -3.2,
    lamps: pathLamps([{ x: 438, y: 590 }, { x: 444, y: 634 }, { x: 438, y: 678 }], 6),
  },
  {
    id: 'drain-fan',
    color: C.magenta,
    r: 3,
    chase: 'run',
    speed: 3,
    lamps: arcLamps(245, 726, 118, PI * 1.08, PI * 1.92, 11),
  },
];

/**
 * The rosette — the big wheel of lamps in the middle of the lower playfield.
 * It is the one piece of the original I would not build this table without:
 * the reactor ring, spinning, right where your eye is while you wait.
 */
export const ROSETTE = {
  x: 245,
  y: 452,
  r: 64,
  lamps: arcLamps(245, 452, 64, 0, PI * 2 - PI / 9, 18),
  colors: [C.blue, C.orange],
};

/**
 * The lane inserts. TILT is the word on purpose: it is spelled the same in
 * both languages, so the felt never has to be repainted when the flag changes
 * — and the whole texture is cached, so a repaint is exactly what a translated
 * word would cost.
 */
export const INSERTS = [
  { x: 199, y: 548, w: 24, h: 15, label: 'T', color: C.red },
  { x: 229, y: 548, w: 24, h: 15, label: 'I', color: C.red },
  { x: 259, y: 548, w: 24, h: 15, label: 'L', color: C.red },
  { x: 289, y: 548, w: 24, h: 15, label: 'T', color: C.red },
];

/** The bonus ladder up the left edge — five rungs, lit from the bottom. */
export const LADDER = [
  { x: 32, y: 528, w: 20, h: 10, color: C.green },
  { x: 32, y: 512, w: 20, h: 10, color: C.green },
  { x: 32, y: 496, w: 20, h: 10, color: C.yellow },
  { x: 32, y: 480, w: 20, h: 10, color: C.yellow },
  { x: 32, y: 464, w: 20, h: 10, color: C.red },
];

/** Standup targets, painted: a bank up each side of the dome. The left pair
 *  exists because the upper left was the last empty corner of the table, and
 *  a playfield with an empty corner reads as unfinished. */
export const STANDUPS = [
  { x: 398, y: 152, a: -0.5, color: C.yellow },
  { x: 418, y: 180, a: -0.5, color: C.yellow },
  { x: 438, y: 208, a: -0.5, color: C.yellow },
  { x: 76, y: 178, a: 0.5, color: C.green },
  { x: 56, y: 206, a: 0.5, color: C.green },
];

/** Is lamp `i` of `n` on, at time `now`? */
export function lampOn(string, i, now) {
  const { chase, speed = 3, lamps } = string;
  const n = lamps.length;
  // Nothing ever goes fully dark: a lamp string with most of its lamps off
  // reads as a broken machine. The floor is a lamp idling, the chase is what
  // moves over the top of it.
  if (chase === 'pulse') return 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * speed));
  if (chase === 'alt') return (i + Math.floor(now * speed)) % 2 === 0 ? 1 : 0.42;
  // run: a comet of light going round
  const head = ((now * speed) % n + n) % n;
  let d = Math.abs(i - head);
  d = Math.min(d, n - d);
  return d < 4 ? 1 - (d / 4) * 0.62 : 0.38;
}
