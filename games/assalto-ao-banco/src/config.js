// The numbers the whole heist agrees on: the size of a tile, what a body can
// take, and — the one that matters most here — how much worse floor N+1 is than
// floor N.

export const H = 720;                 // logical height (slopkit fixes this)
export const TILE = 64;               // a corridor is exactly one tile wide
export const LIFT = 15;               // how tall a wall looks from three-quarters up

export const PLAYER = {
  r: 15,
  speed: 208,
  sneak: 116,                         // slower, and quiet enough to walk a patrol route
  dragging: 0.62,                     // a body on your hands costs this much speed
  accel: 2600,
  friction: 3400,
  hp: 100,
  fov: 104,                           // degrees you can see ahead…
  sight: 470,                         // …and how far
  near: 120,                          // plus a small circle you feel rather than see
  reach: 74,                          // how close you have to be to pick something up
  noiseWalk: 190,                     // footsteps carry this far; sneaking makes none
  hitFlash: 0.35,
};

export const GUARD = {
  r: 15,
  turn: 3.4,                          // rad/s — a guard cannot snap round instantly
  patrolSpeed: 0.62,                  // share of speed while nothing is wrong
  investigateSpeed: 0.88,
  callSpeed: 1.18,                    // and a run once he is sure
  forget: 7,                          // seconds hunting an empty corner before giving up
  suspicionUp: 1.9,                   // how fast the meter fills when you are in the cone
  suspicionDown: 0.42,
  bodyLock: 0.55,                     // a body has to sit in the cone this long to register
  corpseNoise: 0,                     // a body makes none — that is the whole point
  alarmHold: 34,                      // how long the building stays lit up
  deafFor: 0.15,
};

export const CAMERA = {
  fov: 58,
  sweep: 38,                          // degrees either side of where it is bolted
  rate: 0.34,                         // rad/s of sweep
};

export const VAULT = { r: 46 };

/**
 * The floor's shape and its staff. Everything that gets harder reads this, and
 * `threat` below turns it into one number a test can hold to account.
 *
 * Counts hit a ceiling — sixteen guards in a corridor is a crowd, not a
 * challenge — but `guardHp` and `guardDamage` never do. That is what keeps
 * floor 40 harder than floor 39 after the building has run out of room for
 * more staff, and it is why `threat` can promise to rise forever.
 */
export function plan(floor) {
  const f = Math.max(1, Math.floor(floor));
  const k = f - 1;
  const grow = (base, step, cap) => Math.min(cap, base + step * k);
  const odd = (n) => (Math.round(n) | 1);

  return {
    floor: f,
    cols: odd(grow(29, 1.05, 47)),
    rows: odd(grow(21, 0.75, 35)),
    rooms: Math.round(grow(6, 0.52, 15)),
    guards: Math.round(grow(3, 0.82, 16)),
    cameras: f < 2 ? 0 : Math.round(grow(1, 0.5, 11)),
    alarms: Math.round(grow(1, 0.3, 7)),
    loot: Math.round(grow(3, 0.45, 12)),
    medkits: Math.max(1, Math.round(grow(2, -0.06, 2))),
    guns: Math.max(1, Math.round(grow(2, 0.1, 4))),

    guardHp: 30 + 5.5 * k,            // uncapped, on purpose — see above
    guardDamage: 6 + 1.15 * k,        // idem
    guardSight: grow(360, 11, 660),
    guardFov: grow(72, 1.4, 104),
    guardSpeed: grow(118, 2.1, 178),
    guardAim: Math.max(0.16, 0.62 - 0.022 * k),   // seconds between seeing you and firing
    guardHearing: grow(1, 0.02, 1.6), // multiplier on how far a noise reaches them

    cameraLock: Math.max(0.55, 1.7 - 0.05 * k),   // seconds in shot before it calls it in
    cameraRange: grow(320, 9, 520),

    vaultTime: grow(4.5, 0.42, 14),   // seconds of drilling, all of them loud
    tier: Math.min(3, Math.floor(k / 3)),         // what the wreckage is worth picking up
    payday: Math.round(2400 + 950 * k),
  };
}

/**
 * One number for "how bad is this floor", used by the test that guards the
 * promise in the game's description: every floor is harder than the one before.
 *
 * It is a weighted sum of the plan, not a hand-written table — so tuning a
 * constant above cannot quietly flatten the curve without the test noticing.
 */
export function threat(floor) {
  const p = plan(floor);
  return (
    p.guards * (p.guardHp * 0.05 + p.guardDamage * 0.6) +
    p.cameras * 3 +
    p.alarms * 2 +
    p.guardSight * 0.02 +
    p.guardFov * 0.05 +
    p.guardSpeed * 0.03 +
    p.vaultTime * 1.5 +
    (1 / p.guardAim) * 2
  );
}

export const COLOURS = {
  void: '#07080c',
  fog: '#0d1018',
  remembered: '#171c27',
  floor: '#3b4152',
  floorAlt: '#343a49',
  carpet: '#5b2a33',
  wall: '#20242f',
  wallTop: '#4a5164',
  wallEdge: '#151821',
  vault: '#6b5a2a',
  vaultLit: '#c9a03f',
  gold: '#f0c65a',
  ink: '#0a0b10',
  player: '#7fd7c4',
  playerDark: '#3e8d80',
  guard: '#d1607a',
  guardDark: '#8a3a4d',
  guardCalm: '#e0c98a',
  body: '#6e5560',
  blood: '#8e2f3f',
  alarm: '#ff5a4d',
  camera: '#8fa9d6',
  hud: '#e8eef8',
  dim: '#8a93a8',
  good: '#8fd07a',
  loot: '#f0c65a',
};

/** A seeded stream: the same seed builds the same floor, on any machine. */
export function makeRng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The seed of floor N of run S — so a run is one number, not a saved map. */
export const floorSeed = (runSeed, floor) =>
  (Math.imul(runSeed >>> 0 || 1, 0x9e3779b1) ^ Math.imul(floor + 1, 0x85ebca6b)) >>> 0;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const RAD = Math.PI / 180;

/** The shortest way round the circle from `a` to `b`, in radians. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Turn `a` towards `b` by at most `max` radians. */
export function turnTowards(a, b, max) {
  const d = angleDelta(a, b);
  return a + clamp(d, -max, max);
}
