// The dead, and the arithmetic of how many of them each winter brings.
//
// The horde scales on two axes on purpose: the *year* (time makes them worse)
// and the *town* (wealth makes them hungrier). A player who turtles on a tiny
// village is not handed the same wave as one running twelve farms — the second
// one built more to lose, and has more hands to defend it with.

import { COLS, ROWS, rng } from './config.js';

export const ZOMBIES = {
  walker: { hp: 30, speed: 0.75, dps: 8, reach: 0.55, size: 0.32 },
  // runners appear in year 2: fast, soft, and they find the gap in the wall
  runner: { hp: 18, speed: 1.7, dps: 6, reach: 0.5, size: 0.28, fromYear: 2 },
  // brutes appear in year 4: a door with legs, and the door wins
  brute: { hp: 170, speed: 0.45, dps: 26, reach: 0.7, size: 0.46, fromYear: 4 },
};

/** Every winter the whole horde gets tougher — the same walker, more of it. */
export function hpScale(year) {
  return 1 + 0.15 * Math.max(0, year - 1);
}

/**
 * What the horde of a given year is made of.
 * `wealth` is how many buildings stand — the town's own weight on the scale.
 */
export function hordeFor(year, wealth) {
  // Tuned against two scripted playthroughs pulling opposite ways: the
  // quest-following founder must clear the whole chain before winter one and
  // survive it, and the competent long-run player must still lose eventually
  // — an endless game a bot never loses has stopped being a siege.
  // the compounding term is what finally ends a run: an army grows linearly
  // (so many spears a season), so a linear horde reaches an equilibrium the
  // long-run playtest rode to year fourteen without losing a wall
  const count = Math.round((1 + year * 2.5 + wealth * 0.35) * Math.pow(1.07, year - 1));
  const kinds = [];
  // brutes thicken with the years: one in seven at first, one in five later
  const bruteEvery = year >= 6 ? 5 : 7;
  for (let i = 0; i < count; i++) {
    if (ZOMBIES.brute.fromYear <= year && i % bruteEvery === bruteEvery - 1) kinds.push('brute');
    else if (ZOMBIES.runner.fromYear <= year && i % 3 === 2) kinds.push('runner');
    else kinds.push('walker');
  }
  return kinds;
}

/**
 * Where the horde walks in from: 2-4 gates on the board's edge, dealt from the
 * seed and the year — so a replayed year attacks from the same directions, and
 * the next year does not.
 */
export function gatesFor(seed, year) {
  const r = rng(seed * 31 + year * 7);
  const n = Math.min(4, 2 + Math.floor(year / 3));
  const gates = [];
  for (let i = 0; i < n; i++) {
    const side = Math.floor(r() * 4);
    if (side === 0) gates.push({ x: r() * COLS, y: 0.2 });
    else if (side === 1) gates.push({ x: r() * COLS, y: ROWS - 0.2 });
    else if (side === 2) gates.push({ x: 0.2, y: r() * ROWS });
    else gates.push({ x: COLS - 0.2, y: r() * ROWS });
  }
  return gates;
}

/** Strays between winters: a lone walker this often, more often as years pass. */
export function strayEvery(year) {
  return Math.max(8, 26 - year * 2);
}

/**
 * Seconds between horde arrivals. The horde walks in as a procession, not a
 * blob: one clump killed both starting guards in the scripted playtest, and a
 * siege that lasts the winter reads better than one that is over in a bite.
 */
export const TRICKLE = 2.4;

/**
 * How many of the dead step through per arrival. Year one is single file;
 * the late years come in ranks — with a fixed drip a standing army killed
 * each arrival before the next one cleared the treeline, and the long-run
 * playtest literally could not lose.
 */
export function ranksFor(year) {
  return 1 + Math.floor(year / 3);
}

/** How many walk in the moment the snow starts. */
export function firstWave(year) {
  return 2 + Math.floor(year / 2);
}
