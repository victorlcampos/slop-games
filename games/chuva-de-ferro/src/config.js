// The numbers the whole game agrees on, and the palette it is painted with.

export const H = 720;               // logical height (slopkit fixes this)
export const GROUND = 545;          // where the road sits, before the terrain moves it
export const GRAVITY = 2300;        // px/s²
export const SKY = 90;              // above this the cargo is still out of reach

export const PLAYER = {
  speed: 330,
  accel: 3200,                      // px/s² on the ground: a shove, not a switch
  airAccel: 1900,                   // less in the air, but never none
  friction: 4200,                   // how fast he stops when nothing is asked
  air: 0.86,                        // ceiling on air steering, as a share of `speed`
  jump: 980,
  cut: 0.42,                        // let go early and the jump is cut short
  coyote: 0.11,                     // grace after walking off an edge
  buffer: 0.13,                     // a jump asked for just before landing still counts
  w: 40,
  h: 112,
  crouchH: 62,
  stepUp: 38,                       // anything lower than this is walked onto, not into
  lives: 3,
  invuln: 2.2,                      // seconds of mercy after a hit
  aimRange: 900,                    // how far the auto-aim looks for a target
};

export const CARGO = {
  first: 3.2,                       // seconds before the first thing falls
  gapStart: 2.4,                    // seconds between drops at the start…
  gapEnd: 0.42,                     // …and once the sky has fully opened
  ramp: 240,                        // seconds to get from one to the other
  terminal: 900,                    // px/s a falling crate settles at
};

/**
 * The run's pressure, 0 at the first second and 1 once the freighter is gutted.
 * Everything that gets harder reads this: what falls, how often, how good the
 * guns in the wreckage are.
 */
export const pressureAt = (seconds) => Math.min(1, seconds / CARGO.ramp);

export const COLOURS = {
  skyTop: '#2b3f5c',
  skyLow: '#f0a862',
  sun: '#ffd9a0',
  duneFar: '#8d7358',
  duneMid: '#6f5945',
  duneNear: '#54432f',
  ground: '#7a6142',
  groundLit: '#a8875c',
  road: '#3a332a',
  ink: '#12100d',
  soldier: '#4c5b3c',
  soldierDark: '#39452e',
  skin: '#c99b6e',
  metal: '#8a8f96',
  hud: '#f0e4c8',
  danger: '#e2593f',
  good: '#8fd07a',
};

/** A deterministic 0..1 from a pair of integers — the terrain's only randomness. */
export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A seeded stream, for everything that is not the terrain. */
export function makeRng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
