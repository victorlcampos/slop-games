// Noughts and crosses. Three in a row, and a solved game.
//
// Solved is the interesting part: at `pro` the search reads all nine plies, so
// it cannot be beaten and every game is a draw. That would make the whole
// difficulty selector pointless here if depth were the only knob — a depth-1
// tic-tac-toe player still blocks every three-in-a-row, because the block is
// one ply away. What separates the levels on this board is slack and blunder
// (see engine/ai.js): easy sees the fork and plays the corner anyway.

import { EMPTY, P0, P1, cellOf, other, advance } from './shared.js';

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const tictactoe = {
  id: 'tictactoe',
  emoji: '⭕',
  players: 2,
  chance: false,

  setup() {
    return { b: new Array(9).fill(EMPTY), turn: 0, ply: 0 };
  },

  moves(state) {
    if (winnerOf(state.b)) return [];
    const out = [];
    for (let i = 0; i < 9; i++) if (state.b[i] === EMPTY) out.push({ at: i });
    return out;
  },

  apply(state, move) {
    const b = state.b.slice();
    b[move.at] = cellOf(state.turn);
    return advance(state, { b }, other(state.turn));
  },

  result(state) {
    const w = winnerOf(state.b);
    if (w) return { winner: w === P0 ? 0 : 1, line: lineOf(state.b), reason: 'line' };
    if (state.b.every((c) => c !== EMPTY)) return { winner: null, reason: 'full' };
    return null;
  },

  evaluate(state, me) {
    const mine = cellOf(me);
    const theirs = cellOf(other(me));
    let score = 0;
    for (const line of LINES) {
      let m = 0;
      let t = 0;
      for (const i of line) {
        if (state.b[i] === mine) m++;
        else if (state.b[i] === theirs) t++;
      }
      if (m && t) continue;              // a line both sides touch is dead
      if (m) score += m === 2 ? 24 : 5;
      if (t) score -= t === 2 ? 24 : 5;
    }
    // the centre is worth a line and a half: it sits on four of the eight
    if (state.b[4] === mine) score += 8;
    else if (state.b[4] === theirs) score -= 8;
    return score;
  },

  key: (state) => state.b.join('') + state.turn,

  ai: {
    unit: 24,
    openPlies: 2,
    easy: { depth: 1, slack: 2.2, blunder: 0.4 },
    normal: { depth: 2, slack: 0.9, blunder: 0.16 },
    hard: { depth: 5, slack: 0.2, blunder: 0.02 },
    pro: { depth: 9, slack: 0, blunder: 0, openSlack: 0.4 },
  },
};

function winnerOf(b) {
  for (const [a, c, d] of LINES) {
    if (b[a] !== EMPTY && b[a] === b[c] && b[c] === b[d]) return b[a];
  }
  return 0;
}

/** Which three squares won it — the renderer draws a stroke through them. */
export function lineOf(b) {
  for (const line of LINES) {
    const [a, c, d] = line;
    if (b[a] !== EMPTY && b[a] === b[c] && b[c] === b[d]) return line;
  }
  return null;
}

export { LINES };
