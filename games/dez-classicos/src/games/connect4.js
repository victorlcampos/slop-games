// Four in a row, in a seven by six rack.
//
// The cheapest game on the table to search — seven moves a turn, and a move is
// a single write — so the professional reads a dozen plies without noticing.
// That makes the evaluation the only place where anything interesting happens:
// what separates a good four-in-a-row player from a bad one is counting
// *threats*, not discs, and above all whose threat sits on an odd row.

import { EMPTY, cellOf, other, advance } from './shared.js';

export const COLS = 7;
export const ROWS = 6;

/** Every straight run of four cells in the rack, computed once. */
const WINDOWS = (() => {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 3 < COLS) out.push([r * COLS + c, r * COLS + c + 1, r * COLS + c + 2, r * COLS + c + 3]);
      if (r + 3 < ROWS) out.push([r * COLS + c, (r + 1) * COLS + c, (r + 2) * COLS + c, (r + 3) * COLS + c]);
      if (c + 3 < COLS && r + 3 < ROWS)
        out.push([r * COLS + c, (r + 1) * COLS + c + 1, (r + 2) * COLS + c + 2, (r + 3) * COLS + c + 3]);
      if (c - 3 >= 0 && r + 3 < ROWS)
        out.push([r * COLS + c, (r + 1) * COLS + c - 1, (r + 2) * COLS + c - 2, (r + 3) * COLS + c - 3]);
    }
  }
  return out;
})();

/** How central a column is: the middle column sits in more windows than any other. */
const COLUMN_WEIGHT = [3, 4, 5, 7, 5, 4, 3];

export const connect4 = {
  id: 'connect4',
  emoji: '🔴',
  players: 2,
  chance: false,

  setup() {
    return { b: new Array(COLS * ROWS).fill(EMPTY), turn: 0, ply: 0, last: -1 };
  },

  moves(state) {
    if (winnerOf(state.b)) return [];
    const out = [];
    // from the middle outwards: the best move is almost always central, and a
    // search that tries it first prunes the rest of the rack in a fraction
    for (const c of [3, 2, 4, 1, 5, 0, 6]) if (state.b[c] === EMPTY) out.push({ col: c });
    return out;
  },

  apply(state, move) {
    const b = state.b.slice();
    const at = dropRow(b, move.col) * COLS + move.col;
    b[at] = cellOf(state.turn);
    return advance(state, { b, last: at }, other(state.turn));
  },

  result(state) {
    const w = winnerOf(state.b);
    if (w) return { winner: w - 1, line: lineOf(state.b), reason: 'four' };
    if (!state.b.slice(0, COLS).some((c) => c === EMPTY)) return { winner: null, reason: 'full' };
    return null;
  },

  evaluate(state, me) {
    const mine = cellOf(me);
    const theirs = cellOf(other(me));
    let score = 0;

    for (const w of WINDOWS) {
      let m = 0;
      let t = 0;
      for (const i of w) {
        const v = state.b[i];
        if (v === mine) m++;
        else if (v === theirs) t++;
      }
      if (m && t) continue;
      // three-with-a-gap is worth far more than two: it is a move away from
      // being a threat the opponent has to answer
      if (m === 3) score += 90;
      else if (m === 2) score += 12;
      else if (m === 1) score += 2;
      if (t === 3) score -= 105;          // theirs is worth a shade more: it is their move next
      else if (t === 2) score -= 12;
      else if (t === 1) score -= 2;
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = state.b[r * COLS + c];
        if (v === mine) score += COLUMN_WEIGHT[c];
        else if (v === theirs) score -= COLUMN_WEIGHT[c];
      }
    }
    return score;
  },

  key: (state) => state.b.join('') + state.turn,

  ai: {
    unit: 90,
    openPlies: 2,
    easy: { depth: 1, slack: 1.1, blunder: 0.32 },
    normal: { depth: 3, slack: 0.45, blunder: 0.1 },
    hard: { depth: 6, slack: 0.1, blunder: 0.01 },
    pro: { depth: 11, slack: 0, blunder: 0, ms: 1500 },
  },
};

/** The row a disc dropped into this column lands on. -1 when the column is full. */
export function dropRow(b, col) {
  for (let r = ROWS - 1; r >= 0; r--) if (b[r * COLS + col] === EMPTY) return r;
  return -1;
}

function winnerOf(b) {
  for (const w of WINDOWS) {
    const v = b[w[0]];
    if (v !== EMPTY && v === b[w[1]] && v === b[w[2]] && v === b[w[3]]) return v;
  }
  return 0;
}

export function lineOf(b) {
  for (const w of WINDOWS) {
    const v = b[w[0]];
    if (v !== EMPTY && v === b[w[1]] && v === b[w[2]] && v === b[w[3]]) return w;
  }
  return null;
}
