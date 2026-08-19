// Mancala, in its Kalah shape: six pits a side, four seeds in each, a store at
// your right hand.
//
// Two rules make the whole game, and both are why the search in engine/ai.js
// asks the state whose turn it is instead of assuming it alternates:
//
//   * a seed that lands in your own store buys you another move — chains of
//     five and six turns in a row are normal play at the top level;
//   * a last seed landing in an empty pit on your side captures it together
//     with everything facing it.
//
// The second one is what makes a beginner's greedy "sow the fullest pit" lose
// badly: it is not about the seeds you move, it is about the hole you leave.

import { other } from './shared.js';

export const PITS = 6;
export const SEEDS = 4;
const STORE = [6, 13];

export const mancala = {
  id: 'mancala',
  emoji: '🫘',
  players: 2,
  chance: false,

  setup() {
    const b = new Array(14).fill(SEEDS);
    b[STORE[0]] = 0;
    b[STORE[1]] = 0;
    return { b, turn: 0, ply: 0, last: null, again: false };
  },

  moves(state) {
    if (mancala.result(state)) return [];
    const out = [];
    const from = state.turn === 0 ? 0 : 7;
    for (let i = from; i < from + PITS; i++) if (state.b[i] > 0) out.push({ pit: i });
    return out;
  },

  apply(state, move) {
    const b = state.b.slice();
    const me = state.turn;
    const foeStore = STORE[other(me)];
    let seeds = b[move.pit];
    let at = move.pit;
    b[move.pit] = 0;

    while (seeds > 0) {
      at = (at + 1) % 14;
      if (at === foeStore) continue;      // you never feed the other store
      b[at]++;
      seeds--;
    }

    let captured = null;
    const mineSide = me === 0 ? at >= 0 && at <= 5 : at >= 7 && at <= 12;
    // the empty-pit capture: `b[at] === 1` because the last seed is already in it
    if (mineSide && b[at] === 1) {
      const facing = 12 - at;
      if (b[facing] > 0) {
        b[STORE[me]] += b[facing] + 1;
        captured = { pit: at, facing, seeds: b[facing] + 1 };
        b[facing] = 0;
        b[at] = 0;
      }
    }

    const again = at === STORE[me];
    const next = { ...state, b, ply: (state.ply || 0) + 1, last: { ...move, end: at, captured }, again };
    next.turn = again ? me : other(me);
    sweep(next);
    return next;
  },

  result(state) {
    const a = side(state.b, 0);
    const c = side(state.b, 1);
    if (a > 0 && c > 0) return null;
    // whoever still has seeds keeps them — `sweep` has already done the moving
    const s0 = state.b[STORE[0]];
    const s1 = state.b[STORE[1]];
    if (s0 === s1) return { winner: null, reason: 'equal', stores: [s0, s1] };
    return { winner: s0 > s1 ? 0 : 1, reason: 'seeds', stores: [s0, s1] };
  },

  evaluate(state, me) {
    const foe = other(me);
    let score = (state.b[STORE[me]] - state.b[STORE[foe]]) * 100;
    // seeds still on your side are half-owned: they are yours to sow, and
    // theirs to capture
    score += (side(state.b, me) - side(state.b, foe)) * 12;

    // a pit holding exactly the distance to the store is a free extra turn
    const from = me === 0 ? 0 : 7;
    for (let i = from; i < from + PITS; i++) {
      if (state.b[i] === STORE[me] - i) score += 22;
    }
    if (state.turn === me) score += 30;      // and the extra turn itself is worth having
    return score;
  },

  key: (state) => state.b.join(',') + state.turn,

  ai: {
    unit: 100,
    openPlies: 2,
    easy: { depth: 1, slack: 1.1, blunder: 0.3 },
    normal: { depth: 3, slack: 0.45, blunder: 0.1 },
    hard: { depth: 6, slack: 0.1, blunder: 0.01 },
    pro: { depth: 11, slack: 0, blunder: 0, ms: 1500 },
  },
};

/** Seeds left on a player's own six pits. */
export function side(b, player) {
  let n = 0;
  const from = player === 0 ? 0 : 7;
  for (let i = from; i < from + PITS; i++) n += b[i];
  return n;
}

export function stores(b) {
  return [b[STORE[0]], b[STORE[1]]];
}

/** One side empty ends the game, and the other side's seeds go to its store. */
function sweep(state) {
  for (const p of [0, 1]) {
    if (side(state.b, p) > 0) continue;
    const foe = other(p);
    const from = foe === 0 ? 0 : 7;
    for (let i = from; i < from + PITS; i++) {
      state.b[STORE[foe]] += state.b[i];
      state.b[i] = 0;
    }
    return;
  }
}
