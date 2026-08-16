// The numbers everything else agrees on. Tests import these instead of
// hard-coding what they measured once — tune here, and a test only goes red
// when the *behaviour* breaks, not the balance.

export const TILE = 32;
export const COLS = 40;
export const ROWS = 20;

/** The board in logical pixels, plus the command bar underneath it. */
export const BOARD_W = COLS * TILE; // 1280
export const BOARD_H = ROWS * TILE; // 640
export const HUD_H = 80;
export const W = BOARD_W;
export const H = BOARD_H + HUD_H; // 720 — the kit's fixed logical height

export const STEP = 1 / 60;

// ------------------------------------------------------------------ the year
// A year is four seasons; the horde arrives with the first snow. YEAR_LEN is
// real seconds of play per year.
export const YEAR_LEN = 120;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_LEN = YEAR_LEN / SEASONS.length;
/** Farms only grow while something grows: nothing comes out of frozen ground. */
export const FARM_SEASON = { spring: 1, summer: 1.2, autumn: 1.5, winter: 0 };
/** Seconds of horn before the horde walks in. */
export const HORN_LEAD = 10;

// ----------------------------------------------------------------- the people
export const START_POP = 6;
// a little stone in the wagons: the founders did not arrive empty-handed, and
// the first winter's quest chain needs the head start
export const START_RES = { food: 40, wood: 60, stone: 10, gold: 10 };
export const RES = ['food', 'wood', 'stone', 'gold'];
export const RES_CAP = 999;
/** Mouths per second: 10 villagers eat 0.5 food a second. */
export const EAT_RATE = 0.05;
/** A new villager arrives this often when there is food and a roof. */
export const GROW_EVERY = 9;
/** …and eats this much on arrival — growth is paid for, not free. */
export const GROW_COST = 5;
/** With the granary empty someone starves this often. */
export const STARVE_EVERY = 12;

export const TRAIN_TIME = 4.5;
export const QUEUE_MAX = 5;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** mulberry32 — the same seed always deals the same map and the same horde. */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
