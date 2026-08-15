// The measurements of the battlefield and the two numbers every shot obeys.
//
// Everything here is in **world** coordinates: a fixed 1280x720 field, drawn
// into whatever the viewport turns out to be (see `worldBox`). Keeping the
// world fixed is what lets a saved castle, an AI plan and a test all talk about
// the same cell without asking how wide the monitor is.

export const W = 1280;
export const H = 720;

/** Where the two castles stand. Everything above this line is grid, below is dirt. */
export const BASE_Y = 578;

export const CELL = 34;
export const COLS = 7;
export const ROWS = 9;

/**
 * Terrain is a heightmap: one column every 4px, which is finer than a crater.
 *
 * The `+ 1` is what makes the map fair. Sampling 0..1276 and mirroring index i
 * to 319-i folds the world about x=638, not x=640 — half a column out, which is
 * invisible to look at and enough to give one castle a 2px better hill than the
 * other. One extra column puts the fold on the middle of the field.
 */
export const COL_W = 4;
export const NCOL = W / COL_W + 1;

export const SIDES = ['player', 'enemy'];
export const other = (side) => (side === 'player' ? 'enemy' : 'player');

// The field is mirrored on purpose — a shot from the left has exactly the
// distance a shot from the right has, so a loss is never the map's fault.
export const CASTLE_X = { player: 88, enemy: W - 88 - COLS * CELL };
// a multiple of COL_W, so the pad and its mirror land on the same columns
export const LAUNCH_X = { player: 400, enemy: W - 400 };

export const GRAVITY = 520;
export const WIND_MAX = 58;
/** Muzzle speed at power 100, before the weapon's own multiplier. */
export const POWER_SPEED = 690;
export const MIN_POWER = 12;

export const KING_HP = 120;

/**
 * Damage a block takes (and deals) per cell of free fall, and the ceiling on
 * what one falling block can deal however far it came from.
 *
 * The cap is not tidiness. Without it a nine-storey iron girder landed for over
 * two hundred, which is every king in the game twice over — so undermining
 * stopped being a strategy and became the only one, and matches were decided on
 * turn two by a collapse nobody had planned.
 */
export const FALL_DMG = 15;
export const CRUSH_CAP = 85;

/** A full sweep of the power gauge, up and down, per second. */
export const GAUGE_SPEED = 0.82;

/**
 * A match that never ends is a match a test can hang on. Past this many turns
 * the wounded king loses — which is also the honest answer to "who was winning".
 */
export const TURN_LIMIT = 44;

/** Physics substep. Fast bolts move 12px per frame at 60Hz; craters are 20px. */
export const STEP = 1 / 60;
export const MAX_SEG = 5;

// ------------------------------------------------------------------- levels

/**
 * The campaign. Each level is a terrain that changes what your weapons do, an
 * enemy castle a little heavier than the last, and an aim that starts wobbling
 * and ends up not wobbling at all.
 *
 * `reward` is what winning pays into the next castle — the run is a building
 * budget that grows, not an upgrade tree.
 */
export const LEVELS = [
  { id: 'meadow', terrain: 'soil', middle: 'flat', skill: 0.3, foe: { budget: 110, style: 'wall', tier: 0 }, reward: 95 },
  { id: 'dunes', terrain: 'sand', middle: 'hill', skill: 0.42, foe: { budget: 190, style: 'tower', tier: 0 }, reward: 115 },
  { id: 'quarry', terrain: 'rock', middle: 'pit', skill: 0.54, foe: { budget: 290, style: 'bunker', tier: 1 }, reward: 140 },
  { id: 'scrapyard', terrain: 'scrap', middle: 'hill', skill: 0.66, foe: { budget: 400, style: 'tower', tier: 1 }, reward: 165 },
  { id: 'frost', terrain: 'snow', middle: 'flat', skill: 0.78, foe: { budget: 520, style: 'bunker', tier: 2 }, reward: 195 },
  { id: 'forge', terrain: 'ash', middle: 'pit', skill: 0.9, foe: { budget: 680, style: 'keep', tier: 3 }, reward: 240 },
];

/** The coins the first castle is built with. */
export const START_COINS = 175;

// ---------------------------------------------------------------- factions

export const FACTIONS = ['knights', 'machines'];

// --------------------------------------------------------------------- maths

/** mulberry32 — a seeded generator, so a level is the same level every time. */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Where the 1280x720 field lands inside the viewport.
 *
 * The kit's viewport keeps the height fixed and lets the width breathe, so on a
 * 4:3 screen there is less than 1280 of it. A field that assumed 1280 would
 * simply spill off both ends — the castles are at fixed x. So it scales down to
 * fit and sits on the bottom of the screen, where the ground is: the sky is the
 * only thing that gains or loses pixels.
 */
export function worldBox(vpW, vpH) {
  const s = Math.min(vpW / W, vpH / H);
  return { s, ox: (vpW - W * s) / 2, oy: vpH - H * s };
}

/** The inverse of `worldBox`: a finger on the screen, in field coordinates. */
export function toWorld(box, x, y) {
  return { x: (x - box.ox) / box.s, y: (y - box.oy) / box.s };
}

/**
 * How much of the logical width is actually on the screen.
 *
 * The kit's viewport never reports less than 1040 of logical width, so on a 4:3
 * monitor it hands back 1040 and the last eighty of them are past the right edge
 * of the window. Anything anchored to `vp.W` on the right — the coin count, the
 * level name — is therefore anchored somewhere the player cannot see, and so is
 * the right-hand end of the field. Everything in this game measures against this
 * instead. (The same helper, and the same scar, as Flag War's.)
 */
export function viewWidth(vp) {
  if (!vp) return H * (16 / 9);
  if (typeof window === 'undefined') return vp.W;
  const css = vp.turned ? window.innerHeight : window.innerWidth;
  if (!css || !vp.scale) return vp.W;
  return Math.min(vp.W, css / vp.scale);
}
