// The valley, dealt from a seed: grass, tree stands to log, rock to quarry,
// and a clearing in the middle where the manor goes. No image, no map file —
// the seed IS the map, which is also what makes it testable.

import { COLS, ROWS, rng } from './config.js';

export const GRASS = 0;
export const TREE = 1;
export const ROCK = 2;

/** Tiles kept clear around the manor so the town has room to be born. */
export const CLEARING = 5;

export const HALL_C = Math.floor(COLS / 2) - 1;
export const HALL_R = Math.floor(ROWS / 2) - 1;

export function genMap(seed) {
  const r = rng(seed);
  const tiles = new Array(COLS * ROWS).fill(GRASS);
  const at = (c, row) => c + row * COLS;

  // tree stands: clusters seeded away from the clearing, grown outward — a
  // forest reads as a place, a uniform sprinkle reads as noise
  const stands = 10 + Math.floor(r() * 4);
  for (let s = 0; s < stands; s++) {
    const cc = Math.floor(r() * COLS);
    const cr = Math.floor(r() * ROWS);
    const size = 4 + Math.floor(r() * 9);
    let c = cc;
    let row = cr;
    for (let i = 0; i < size; i++) {
      if (inBounds(c, row) && !nearHall(c, row)) tiles[at(c, row)] = TREE;
      c += Math.floor(r() * 3) - 1;
      row += Math.floor(r() * 3) - 1;
    }
  }

  // rock outcrops: fewer, tighter
  const crops = 4 + Math.floor(r() * 3);
  for (let s = 0; s < crops; s++) {
    const cc = Math.floor(r() * COLS);
    const cr = Math.floor(r() * ROWS);
    const size = 3 + Math.floor(r() * 4);
    let c = cc;
    let row = cr;
    for (let i = 0; i < size; i++) {
      if (inBounds(c, row) && !nearHall(c, row)) tiles[at(c, row)] = ROCK;
      c += Math.floor(r() * 3) - 1;
      row += Math.floor(r() * 3) - 1;
    }
  }

  // The board's edge stays walkable: hordes are born there, and a zombie born
  // inside a tree is a zombie the player cannot explain.
  for (let c = 0; c < COLS; c++) {
    tiles[at(c, 0)] = GRASS;
    tiles[at(c, ROWS - 1)] = GRASS;
  }
  for (let row = 0; row < ROWS; row++) {
    tiles[at(0, row)] = GRASS;
    tiles[at(COLS - 1, row)] = GRASS;
  }

  return { seed, tiles };
}

export function inBounds(c, r) {
  return c >= 0 && c < COLS && r >= 0 && r < ROWS;
}

function nearHall(c, r) {
  return Math.abs(c - (HALL_C + 0.5)) <= CLEARING && Math.abs(r - (HALL_R + 0.5)) <= CLEARING;
}

export function tileAt(map, c, r) {
  if (!inBounds(c, r)) return GRASS;
  return map.tiles[c + r * COLS];
}

/** How many of the 8 neighbours (and the tile itself) hold the wanted kind. */
export function countAround(map, c, r, kind) {
  let n = 0;
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (tileAt(map, c + dc, r + dr) === kind) n++;
    }
  }
  return n;
}
