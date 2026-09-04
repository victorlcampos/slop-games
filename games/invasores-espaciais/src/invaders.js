// The swarm: a grid of the living that marches as one body.
//
// The march is a timer, not a speed. Every `interval` seconds the formation
// steps STEP_X sideways; touching either wall drops it STEP_Y and reverses it.
// The interval shrinks as invaders die and as waves pass, so the last survivor
// sprints — that acceleration IS the difficulty curve.

import {
  COLS, ROWS, CELL_W, CELL_H, STEP_X, STEP_Y,
  INVADER_W, INVADER_H, ROW_SCORE,
} from './config.js';

/** Seconds between steps with a full swarm on wave 1; the floor is panic. */
export const BASE_INTERVAL = 0.55;
export const MIN_INTERVAL = 0.045;
/** Each wave multiplies the pace by this. */
export const WAVE_PACE = 0.88;

export function totalInvaders() {
  return COLS * ROWS;
}

/**
 * A fresh formation for a wave. `originX` centers the grid on the playfield;
 * `top` is the y of the first row.
 */
export function createFormation(originX, top = 140) {
  const alive = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      alive.push({
        row,
        col,
        x: originX + col * CELL_W,
        y: top + row * CELL_H,
        score: ROW_SCORE[row],
      });
    }
  }
  return { list: alive, dir: 1, clock: 0, frame: 0 };
}

/** Seconds between march steps for `remaining` invaders on `wave`. */
export function stepInterval(remaining, wave) {
  const share = remaining / totalInvaders();
  const paced = BASE_INTERVAL * (0.12 + 0.88 * share);
  return Math.max(MIN_INTERVAL, paced * Math.pow(WAVE_PACE, wave - 1));
}

/**
 * Advance the march clock by h. Returns 'step', 'drop' or null.
 * `bounds` is { minX, maxX } the formation must stay inside (the playfield
 * walls, minus half an invader so the sprite never clips through).
 */
export function march(formation, remaining, wave, h, bounds) {
  formation.clock += h;
  if (formation.clock < stepInterval(remaining, wave)) return null;
  formation.clock = 0;
  formation.frame ^= 1;

  const next = formation.dir * STEP_X;
  let edge = false;
  for (const inv of formation.list) {
    const x = inv.x + next;
    if (x < bounds.minX || x > bounds.maxX) { edge = true; break; }
  }
  if (edge) {
    for (const inv of formation.list) inv.y += STEP_Y;
    formation.dir *= -1;
    return 'drop';
  }
  for (const inv of formation.list) inv.x += next;
  return 'step';
}

/** The lowest y any living invader reaches (its feet). */
export function lowestY(formation) {
  let low = -Infinity;
  for (const inv of formation.list) low = Math.max(low, inv.y + INVADER_H / 2);
  return low;
}

/** Leftmost and rightmost x of the living formation (centers). */
export function spanX(formation) {
  let min = Infinity;
  let max = -Infinity;
  for (const inv of formation.list) {
    min = Math.min(min, inv.x);
    max = Math.max(max, inv.x);
  }
  return { min, max };
}

/**
 * The shooters: the lowest living invader of each column that still has
 * someone in it. Classic rule — only the front rank fires.
 */
export function shooters(formation) {
  const byCol = new Map();
  for (const inv of formation.list) {
    const cur = byCol.get(inv.col);
    if (!cur || inv.y > cur.y) byCol.set(inv.col, inv);
  }
  return [...byCol.values()];
}

/** Remove the invader at (row, col); returns its score, or 0 when absent. */
export function killAt(formation, row, col) {
  const i = formation.list.findIndex((v) => v.row === row && v.col === col);
  if (i < 0) return 0;
  const [dead] = formation.list.splice(i, 1);
  return dead.score;
}
