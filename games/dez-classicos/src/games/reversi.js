// Reversi. Every move flips a line, and the disc count means nothing until the
// board is full.
//
// Two things in here are not obvious from the rules and decide every game:
//
//   1. **A player with no legal move passes**, and the turn goes straight back.
//      That is why `apply` decides who moves next by looking, instead of
//      alternating — and why the search in engine/ai.js is written around
//      `state.turn` rather than around negamax's sign flip.
//   2. **Mobility beats material** until the very end. A machine that greedily
//      takes the most discs every turn loses to one that takes the fewest: with
//      few discs on the board you keep options, and options are what force the
//      opponent into a corner-giving move. The weights below sit under that,
//      and the corner/X-square table is what stops it handing the corner over.

import { EMPTY, cellOf, other } from './shared.js';

export const SIZE = 8;
const DIRS = [-9, -8, -7, -1, 1, 7, 8, 9];

/** Positional value of every square: corners are gold, their diagonal is poison. */
const WEIGHT = [
  120, -22, 20, 5, 5, 20, -22, 120,
  -22, -45, -3, -3, -3, -3, -45, -22,
  20, -3, 15, 3, 3, 15, -3, 20,
  5, -3, 3, 3, 3, 3, -3, 5,
  5, -3, 3, 3, 3, 3, -3, 5,
  20, -3, 15, 3, 3, 15, -3, 20,
  -22, -45, -3, -3, -3, -3, -45, -22,
  120, -22, 20, 5, 5, 20, -22, 120,
];

const CORNERS = [0, 7, 56, 63];

export const reversi = {
  id: 'reversi',
  emoji: '⚫',
  players: 2,
  chance: false,

  setup() {
    const b = new Array(64).fill(EMPTY);
    b[27] = cellOf(1);
    b[28] = cellOf(0);
    b[35] = cellOf(0);
    b[36] = cellOf(1);
    return { b, turn: 0, ply: 0, last: -1, passed: false };
  },

  moves: (state) => movesFor(state.b, state.turn),

  apply(state, move) {
    const b = state.b.slice();
    const flipped = flip(b, move.at, state.turn, true);
    const foe = other(state.turn);
    // whoever can move, moves — the turn only alternates when it can
    const turn = movesFor(b, foe).length ? foe : movesFor(b, state.turn).length ? state.turn : foe;
    return {
      ...state,
      b,
      turn,
      ply: (state.ply || 0) + 1,
      last: move.at,
      flipped,
      passed: turn === state.turn,
    };
  },

  result(state) {
    if (movesFor(state.b, 0).length || movesFor(state.b, 1).length) return null;
    const [a, c] = counts(state.b);
    if (a === c) return { winner: null, reason: 'equal', discs: [a, c] };
    return { winner: a > c ? 0 : 1, reason: 'discs', discs: [a, c] };
  },

  evaluate(state, me) {
    const mine = cellOf(me);
    const theirs = cellOf(other(me));
    const [a, c] = counts(state.b);
    const filled = a + c;
    const late = filled > 52;

    let position = 0;
    for (let i = 0; i < 64; i++) {
      const v = state.b[i];
      if (v === mine) position += WEIGHT[i];
      else if (v === theirs) position -= WEIGHT[i];
    }

    const myMoves = movesFor(state.b, me).length;
    const foeMoves = movesFor(state.b, other(me)).length;
    const mobility = myMoves + foeMoves ? (100 * (myMoves - foeMoves)) / (myMoves + foeMoves) : 0;

    let corners = 0;
    for (const i of CORNERS) {
      if (state.b[i] === mine) corners += 100;
      else if (state.b[i] === theirs) corners -= 100;
    }

    // discs only start mattering when there is no time left to lose them again
    const discs = a + c ? (100 * ((me === 0 ? a : c) - (me === 0 ? c : a))) / (a + c) : 0;

    if (late) return position * 0.4 + corners * 4 + mobility * 2 + discs * 14;
    return position + corners * 5 + mobility * 12 + discs * 0.6;
  },

  key: (state) => state.b.join('') + state.turn,

  ai: {
    unit: 90,
    openPlies: 4,
    easy: { depth: 1, slack: 1.4, blunder: 0.3 },
    normal: { depth: 2, slack: 0.5, blunder: 0.1 },
    hard: { depth: 4, slack: 0.1, blunder: 0.01 },
    pro: { depth: 7, slack: 0, blunder: 0, ms: 1800 },
  },
};

export function movesFor(b, player) {
  const out = [];
  for (let i = 0; i < 64; i++) {
    if (b[i] !== EMPTY) continue;
    if (flip(b, i, player, false)) out.push({ at: i });
  }
  return out;
}

/**
 * Flip every line the move closes. With `commit` it writes and returns the list
 * of squares turned; without it, it only answers whether the move is legal —
 * the same walk serves the move generator and the move itself, so the two can
 * never disagree about what is legal.
 */
function flip(b, at, player, commit) {
  const mine = cellOf(player);
  const theirs = cellOf(other(player));
  const col = at % SIZE;
  let turned = commit ? [] : 0;

  for (const d of DIRS) {
    // a step off the left or right edge is not a step: -1 from column 0 lands
    // on the previous row, and without this the flip wraps around the board
    const dc = ((d + 9) % 8) - 1;
    let c = col + dc;
    let i = at + d;
    let run = 0;
    while (i >= 0 && i < 64 && c >= 0 && c < SIZE && b[i] === theirs) {
      run++;
      i += d;
      c += dc;
    }
    if (!run || i < 0 || i >= 64 || c < 0 || c >= SIZE || b[i] !== mine) continue;
    if (!commit) return true;
    let j = at + d;
    for (let k = 0; k < run; k++) {
      b[j] = mine;
      turned.push(j);
      j += d;
    }
  }

  if (!commit) return false;
  if (turned.length) b[at] = mine;
  return turned;
}

export function counts(b) {
  let a = 0;
  let c = 0;
  for (let i = 0; i < 64; i++) {
    if (b[i] === cellOf(0)) a++;
    else if (b[i] === cellOf(1)) c++;
  }
  return [a, c];
}
