// The numbers the whole escape agrees on: the size of a tile, what a body can
// take, and — the one that matters most here — how much worse ring N+1 is than
// ring N.

export const H = 720;                 // logical height (slopkit fixes this)
export const TILE = 64;               // a corridor is exactly one tile wide

/**
 * How much of the height you actually see. The view is **almost** straight
 * down, tipped just enough to be looking at something rather than at a plan.
 *
 * A full standing figure was tried and thrown out: a person drawn at their own
 * height spills two tiles up the screen, so what you aim at and what the
 * simulation shoots at stop being the same place — you put the crosshair on a
 * man's chest and the bullet goes over the head of the tile he is standing on.
 * Everybody fits inside their own square now, and the tilt is carried by two
 * small things instead: a lip on every wall, and a head that sits a few pixels
 * above the shoulders with its own shadow.
 */
export const WALL_H = 13;             // the lip on a wall
export const HEAD_LIFT = 7;           // how far a head floats over its shoulders

/**
 * The gun helps. You point it at a man, not at a pixel.
 *
 * A twin-stick game asks for a precision nobody has on a phone and few people
 * want on a mouse: the cursor says roughly where, and inside that "roughly" the
 * gun finds the man itself. `radius` is how far off the line of fire a man can
 * be and still be picked up — a lateral distance, not an angle, because an
 * angle is unforgivably tight up close and absurdly wide at range. `cone` is
 * the same idea from the other end, so a man far away is not out of reach of a
 * shaky thumb; `limit` is the sanity cap that stops it ever spinning him round.
 *
 * It only ever finds what you could see: never further than your own sight, and
 * never through a wall. A gun that swings onto somebody invisible in the dark
 * reads as a bug, and quietly hands away the whole point of the dark.
 */
export const ASSIST = {
  radius: 62,
  cone: 17,
  limit: 55,
  // Once the gun has a man, it holds its fire until the body has turned far
  // enough that the round would actually land (a lateral test, in game.js) —
  // this is the outer cap on that wait, and how far open the brackets draw.
  // Without the gate the first round of every burst leaves mid-turn and
  // misses — which on a phone, where the trigger is a tap, means the tap that
  // should have saved you did nothing.
  settle: 13,
  // Eyes and alarm nodes are targets too, with this many degrees of handicap
  // against a sentinel near the same line: point straight at an eye and you get
  // the eye; point roughly at both and you get the one that shoots back.
  deviceBias: 6,
};

/**
 * How wide a person is to a bullet.
 *
 * A shade wider than the body that is drawn, and deliberately so: a shot that
 * visually clips a shoulder should count. The alternative — a circle narrower
 * than the sprite — is the thing that reads as "the bullet went through him",
 * and no amount of explaining the geometry makes that feel fair.
 */
export const HIT_R = 17;

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
  turn: 18,                           // rad/s — a 180° whip takes 0.17s, felt but never fought
  // How long the body keeps facing the fight after the last shot or aim.
  // Without it, releasing the trigger while backing away snaps him round to
  // face where he is running — and the next tap fires into the corridor ahead
  // instead of at the man behind. The price is honest: while it holds, you are
  // walking backwards into rooms your torch is not pointing at.
  combatHold: 1.0,
};

/**
 * The roll: a shove in one direction, faster than he can ever walk, and loud.
 *
 * It is the only way to cross a lit corridor before the cone comes back round,
 * and it costs you the one thing sneaking buys — a man who rolls is heard.
 */
export const ROLL = {
  speed: 2.2,                         // multiple of the walk
  time: 0.3,
  cool: 0.62,
  noise: 250,
};

/**
 * Picking things up is the vault's mechanism, scaled down: stand on it and a
 * ring fills. Nothing here has a key of its own.
 *
 * `stillSpeed` is what keeps it from being a trap. Below it — stopped, or
 * creeping — the ring fills; sprinting over a panel does not pull the alarm and
 * running past a rifle does not make you drop the gun you are holding.
 */
export const PICKUP = {
  loot: 0.3,
  medkit: 0.45,
  gun: 0.65,
  alarm: 1.15,
  stillSpeed: 130,                    // slower than a walk (208), faster than a creep (116)
  armAfter: 1.6,                      // a gun you just dropped cannot be picked straight back up
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
 * The ring's shape and its garrison. Everything that gets harder reads this,
 * and `threat` below turns it into one number a test can hold to account.
 *
 * Counts hit a ceiling — sixteen sentinels in a corridor is a crowd, not a
 * challenge — but `guardHp` and `guardDamage` never do. That is what keeps
 * ring 40 harder than ring 39 after the Fortress has run out of room for
 * more of them, and it is why `threat` can promise to rise forever.
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

    cameraLock: Math.max(0.55, 1.7 - 0.05 * k),   // seconds in an eye's stare before it calls it in
    cameraRange: grow(320, 9, 520),

    vaultTime: grow(4.5, 0.42, 14),   // seconds of overloading the seal, all of them loud
    tier: Math.min(3, Math.floor(k / 3)),         // what the armoury is worth picking up
    payday: Math.round(2400 + 950 * k),           // shards, when the seal gives
  };
}

/**
 * One number for "how bad is this ring", used by the test that guards the
 * promise in the game's description: every ring is harder than the one before.
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
  void: '#05070b',
  fog: '#0c1016',
  remembered: '#141b23',
  // The lighting is from above, so the order is: floor lit, wall top a shade
  // lighter still, wall face in shadow. Getting that backwards — which the
  // first pass did, with near-black floors under pale walls — reads as a
  // building made of light standing on a hole.
  floor: '#47545e',
  floorAlt: '#3f4b55',
  grout: '#2f3a44',
  carpet: '#2f5a52',
  wallFace: '#222b35',                // the side turned towards you: in shade
  wallTop: '#5b7079',                 // the side turned towards the ceiling: lit
  wallEdge: '#121820',
  vault: '#1f4a50',                   // the seal, dormant
  vaultLit: '#2a6a6e',                // the seal's collar, faintly alive
  energy: '#5ce8cf',                  // what the whole Fortress runs on
  ink: '#0a0b10',
  skin: '#d9a878',                    // the one human on the ring
  hide: '#8fae9a',                    // sentinel hide, grey-green
  hud: '#e8eef8',
  dim: '#8a93a8',
  good: '#8fd07a',
  alarm: '#ff5a4d',
  camera: '#a98fe0',                  // the eyes on the walls: violet
  blood: '#8e2f3f',                   // his — the sentinels bleed `ichor`
  ichor: '#3fae74',
  loot: '#5ce8cf',                    // the shards, same current as everything
  steel: '#9fb2c4',
};

/** Who wears what. A figure is read by its colours before its shape. */
export const KIT = {
  // the escapee: a prison jumpsuit, a headlamp, and a satchel that only shows
  // up once there is something in it
  player: { coat: '#c96f3a', coatDark: '#8e4a26', legs: '#33291f', head: '#2e2118', skin: COLOURS.skin, trim: '#ffd9a0', bag: '#3d3428', hat: 'headlamp' },
  guard: { coat: '#a04a78', coatDark: '#6c2f52', legs: '#241f30', head: '#8fa5b8', skin: COLOURS.hide, trim: '#ff8fb8', hat: 'dome' },
  guardCalm: { coat: '#3f7a6e', coatDark: '#2a544c', legs: '#20282e', head: '#9db4a6', skin: COLOURS.hide, trim: '#8ff0dc', hat: 'dome' },
  body: { coat: '#4a5a56', coatDark: '#35423f', legs: '#242c2e', head: '#6e8078', skin: '#7a9484', trim: '#4a5a56' },
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

/** The seed of ring N of run S — so a run is one number, not a saved map. */
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
