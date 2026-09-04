// Bunkers as damage grids, not hit points.
//
// Each shield is a cols×rows grid of solid cells. A bolt chews a circular
// crater out of it from whichever side it arrived — your own shots eat your
// own ceiling, which is the whole lesson of standing under one.

import { SHIELD } from './config.js';

export function createShields(playW) {
  const { count, w, h, y, cols, rows } = SHIELD;
  const gap = (playW - count * w) / (count + 1);
  const shields = [];
  for (let i = 0; i < count; i++) {
    const x = gap + i * (w + gap);
    const cells = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        // an arch: hollow underneath so the cannon fits below, rounded top
        const dx = (c + 0.5) / cols - 0.5;
        const topRound = r === 0 && Math.abs(dx) > 0.32;
        const hollow = r >= rows - 2 && Math.abs(dx) < 0.26;
        row.push(!(topRound || hollow));
      }
      cells.push(row);
    }
    shields.push({ x, y, w, h, cols, rows, cells });
  }
  return shields;
}

function cellXY(shield) {
  return { cw: shield.w / shield.cols, ch: shield.h / shield.rows };
}

/**
 * Chew a crater centered on world point (wx, wy). Returns how many cells fell.
 */
export function damage(shield, wx, wy, radius = SHIELD.crater) {
  const { cw, ch } = cellXY(shield);
  const cc = (wx - shield.x) / cw;
  const cr = (wy - shield.y) / ch;
  let fallen = 0;
  for (let r = 0; r < shield.rows; r++) {
    for (let c = 0; c < shield.cols; c++) {
      if (!shield.cells[r][c]) continue;
      const d = Math.hypot(c + 0.5 - cc, r + 0.5 - cr);
      if (d <= radius) {
        shield.cells[r][c] = false;
        fallen++;
      }
    }
  }
  return fallen;
}

/**
 * Does the world rect (x, y, w, h) touch any solid cell of the shield?
 * Returns the shield-local impact point, or null.
 */
export function impact(shield, x, y, w, h) {
  const { cw, ch } = cellXY(shield);
  const c0 = Math.max(0, Math.floor((x - shield.x) / cw));
  const c1 = Math.min(shield.cols - 1, Math.floor((x + w - shield.x) / cw));
  const r0 = Math.max(0, Math.floor((y - shield.y) / ch));
  const r1 = Math.min(shield.rows - 1, Math.floor((y + h - shield.y) / ch));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (shield.cells[r][c]) {
        return { x: shield.x + (c + 0.5) * cw, y: shield.y + (r + 0.5) * ch };
      }
    }
  }
  return null;
}

/** How many solid cells are left in the whole line of shields. */
export function remainingCells(shields) {
  let n = 0;
  for (const s of shields) {
    for (const row of s.cells) for (const cell of row) if (cell) n++;
  }
  return n;
}

/** A fresh line for the next wave — the bunkers are rebuilt, like 1978. */
export function rebuildShields(playW) {
  return createShields(playW);
}
