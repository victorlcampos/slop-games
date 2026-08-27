export const COLS = 10;
export const ROWS = 22;
export const HIDDEN_ROWS = 2;
export const VISIBLE_ROWS = ROWS - HIDDEN_ROWS;
export const H = 900;

export const LOCK_DELAY = 0.48;
export const MAX_LOCK_RESETS = 15;

/** Gravity keeps getting faster, but never becomes a teleport through a row. */
export function dropInterval(level) {
  const n = Math.max(1, Math.floor(level));
  return Math.max(0.045, 0.82 * Math.pow(0.82, n - 1));
}

export const LINE_SCORE = [0, 100, 300, 500, 800];

export function scoreForClear(lines, level, combo = 0, backToBack = false, perfect = false) {
  const count = Math.max(0, Math.min(4, Math.floor(lines)));
  const lv = Math.max(1, Math.floor(level));
  const base = LINE_SCORE[count] * lv;
  const chain = Math.max(0, Math.floor(combo)) * 50 * lv;
  const b2b = count === 4 && backToBack ? Math.floor(base * 0.5) : 0;
  const clean = perfect && count > 0 ? 3500 * lv : 0;
  return base + chain + b2b + clean;
}
