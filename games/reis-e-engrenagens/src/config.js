// The measurements of the battlefield and the two numbers every shot obeys.
//
// Everything here is in **world** coordinates: a fixed field that the camera
// looks at a screen's worth of at a time (see `camera.js`). Keeping the world
// fixed is what lets a saved castle, an AI plan and a test all talk about the
// same cell without asking how wide the monitor is.

/**
 * The field is **wider than the screen**, and that is the point.
 *
 * It used to be exactly one viewport across, which made every shot a flat little
 * hop from one side of a still picture to the other. At this width the shell
 * leaves the screen, the camera goes with it, and the valley in between has room
 * for scenery instead of being the gap between two castles.
 */
export const W = 2400;
export const H = 720;

/** Where the two castles stand. Everything above this line is grid, below is dirt. */
export const BASE_Y = 566;

export const CELL = 40;
export const COLS = 7;
export const ROWS = 9;

/**
 * Terrain is a heightmap: one column every 4px, which is finer than a crater.
 *
 * The `+ 1` is what makes the map fair. Without it the last column sits four
 * pixels short of the right edge, so mirroring folds the world half a column
 * off centre — invisible to look at, and enough to give one castle a slightly
 * better hill than the other. One extra column puts the fold on the middle.
 */
export const COL_W = 4;
export const NCOL = W / COL_W + 1;

export const SIDES = ['player', 'enemy'];
export const other = (side) => (side === 'player' ? 'enemy' : 'player');

// The field is mirrored on purpose — a shot from the left has exactly the
// distance a shot from the right has, so a loss is never the map's fault.
export const CASTLE_X = { player: 300, enemy: W - 300 - COLS * CELL };

export const GRAVITY = 520;
export const WIND_MAX = 46;
/**
 * Muzzle speed at power 100, before the weapon's own multiplier. Set so that a
 * full-power 45° shot just carries the width of the valley — the last twenty
 * per cent of the gauge has to be worth something, and a range that overshoots
 * the map makes the whole top half of the gauge identical.
 */
export const POWER_SPEED = 1040;
export const MIN_POWER = 12;

/** How high above the block it stands on a siege engine's pivot sits. */
export const GUN_HEIGHT = 30;

/**
 * Driving, in the shape Gunbound gave it: a tank of fuel per turn, spent by the
 * pixel, and more of it going uphill than along the flat.
 *
 * The numbers are chosen so that one turn's fuel is about a castle and a half of
 * travel — enough to get out from behind your own wall or up onto a tower, and
 * nowhere near enough to drive across the valley. `LEASH` is how far off its own
 * plot an engine may wander; past that it is not defending a castle any more.
 */
export const DRIVE_FUEL = 260;
export const DRIVE_SPEED = 86;
export const CLIMB_COST = 1.8;
/**
 * A step up taller than this is a wall, not a slope.
 *
 * Three cells, and the number was found by getting it wrong twice. Descending
 * has never been limited — it is a fall, and falls do not need permission — so
 * any limit is asymmetric, and a strict one strands the engine wherever it
 * rolled down to. At one cell the *default* castle was a trap: its chamber is a
 * one-storey notch between two four-storey towers, and the first arrow key a new
 * player presses drove the trebuchet into it for good.
 *
 * What stops a player abusing the generous limit is not the limit, it is
 * `CLIMB_COST`: climbing three cells costs about four fifths of a full tank, so
 * getting back up your own battlements is a whole turn's movement and a real
 * decision. Four cells is still a wall.
 */
export const CLIMB_LIMIT = CELL * 3.15;
export const LEASH = 180;

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

/** Power per second while the fire button is held: a full charge in a beat. */
export const CHARGE_RATE = 118;

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
