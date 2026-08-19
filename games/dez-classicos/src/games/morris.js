// Nine men's morris — trilha, on this side of the Atlantic. A board older than
// almost everything else on this table: the layout is scratched into a roof
// slab of the temple at Kurna, and it is the same twenty-four points.
//
// Three phases in one game, which is what makes it interesting to search:
//
//   placing  nine pieces each, dropped anywhere free
//   moving   a piece slides to an adjacent point
//   flying   down to three pieces, and they may jump anywhere free — the rule
//            that keeps a lost game alive one more turn
//
// Closing a mill takes an enemy piece off the board, and a piece standing in a
// mill cannot be taken unless every enemy piece is in one. That exception is
// the rule most implementations forget, and without it a player who mills every
// piece becomes untouchable.

import { EMPTY, cellOf, other, advance } from './shared.js';

export const POINTS = 24;

/** The three points of every line, on all four rings and both cross-bars. */
export const MILLS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
  [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23],
];

export const ADJ = [
  [1, 9], [0, 2, 4], [1, 14],
  [4, 10], [1, 3, 5, 7], [4, 13],
  [7, 11], [4, 6, 8], [7, 12],
  [0, 10, 21], [3, 9, 11, 18], [6, 10, 15],
  [8, 13, 17], [5, 12, 14, 20], [2, 13, 23],
  [11, 16], [15, 17, 19], [12, 16],
  [10, 19], [16, 18, 20, 22], [13, 19],
  [9, 22], [19, 21, 23], [14, 22],
];

/** How many mills each point belongs to — the corners of the cross-bars are worth more. */
const REACH = (() => {
  const out = new Array(POINTS).fill(0);
  for (const m of MILLS) for (const i of m) out[i]++;
  return out;
})();

const HAND = 9;
const IDLE_LIMIT = 50;

export const morris = {
  id: 'morris',
  emoji: '⬡',
  players: 2,
  chance: false,

  setup() {
    return { b: new Array(POINTS).fill(EMPTY), hand: [HAND, HAND], turn: 0, ply: 0, idle: 0, last: null };
  },

  moves(state) {
    const me = state.turn;
    const mine = cellOf(me);
    const out = [];

    /** A move is only complete once it says which piece it takes, if any. */
    const emit = (base, board) => {
      const takes = takeable(board, other(me));
      if (!takes.length) out.push(base);
      else for (const take of takes) out.push({ ...base, take });
    };

    if (state.hand[me] > 0) {
      for (let i = 0; i < POINTS; i++) {
        if (state.b[i] !== EMPTY) continue;
        const b = state.b.slice();
        b[i] = mine;
        if (millAt(b, i, mine)) emit({ at: i }, b);
        else out.push({ at: i });
      }
      return out;
    }

    const own = [];
    for (let i = 0; i < POINTS; i++) if (state.b[i] === mine) own.push(i);
    const flying = own.length === 3;

    for (const from of own) {
      const targets = flying ? allFree(state.b) : ADJ[from].filter((i) => state.b[i] === EMPTY);
      for (const to of targets) {
        const b = state.b.slice();
        b[from] = EMPTY;
        b[to] = mine;
        if (millAt(b, to, mine)) emit({ from, to }, b);
        else out.push({ from, to });
      }
    }
    return out;
  },

  apply(state, move) {
    const b = state.b.slice();
    const mine = cellOf(state.turn);
    const hand = state.hand.slice();

    if (move.at !== undefined) {
      b[move.at] = mine;
      hand[state.turn]--;
    } else {
      b[move.from] = EMPTY;
      b[move.to] = mine;
    }
    if (move.take !== undefined) b[move.take] = EMPTY;

    return advance(state, {
      b,
      hand,
      idle: move.take !== undefined || move.at !== undefined ? 0 : (state.idle || 0) + 1,
      last: move,
    });
  },

  result(state) {
    const placing = state.hand[0] > 0 || state.hand[1] > 0;
    if (!placing) {
      // two pieces cannot close a mill: the game is over the moment it happens
      for (const p of [0, 1]) if (count(state.b, p) < 3) return { winner: other(p), reason: 'ground' };
    }
    if (!morris.moves(state).length) return { winner: other(state.turn), reason: 'blocked' };
    if ((state.idle || 0) >= IDLE_LIMIT) return { winner: null, reason: 'idle' };
    return null;
  },

  evaluate(state, me) {
    const foe = other(me);
    const mine = cellOf(me);
    const theirs = cellOf(foe);
    let score = 0;

    score += (count(state.b, me) + state.hand[me] - count(state.b, foe) - state.hand[foe]) * 100;

    for (let i = 0; i < POINTS; i++) {
      if (state.b[i] === mine) score += REACH[i] * 4;
      else if (state.b[i] === theirs) score -= REACH[i] * 4;
    }

    for (const m of MILLS) {
      let a = 0;
      let t = 0;
      for (const i of m) {
        if (state.b[i] === mine) a++;
        else if (state.b[i] === theirs) t++;
      }
      if (a === 3) score += 40;
      else if (t === 3) score -= 40;
      else if (a === 2 && !t) score += 18;      // one move from taking a piece
      else if (t === 2 && !a) score -= 20;
    }

    // room to move is the whole endgame: a player blocked in is a player who lost
    score += (mobility(state, me) - mobility(state, foe)) * 6;
    return score;
  },

  key: (state) => state.b.join('') + state.hand.join('') + state.turn,

  ai: {
    unit: 100,
    openPlies: 4,
    easy: { depth: 1, slack: 1.2, blunder: 0.32 },
    normal: { depth: 2, slack: 0.5, blunder: 0.1 },
    hard: { depth: 4, slack: 0.12, blunder: 0.01 },
    pro: { depth: 6, slack: 0, blunder: 0, ms: 1600 },
  },
};

/** Which enemy pieces may be taken: those outside a mill, or all of them if
 *  every one is inside one. */
export function takeable(b, victim) {
  const cell = cellOf(victim);
  const all = [];
  const free = [];
  for (let i = 0; i < POINTS; i++) {
    if (b[i] !== cell) continue;
    all.push(i);
    if (!millAt(b, i, cell)) free.push(i);
  }
  return free.length ? free : all;
}

export function millAt(b, at, cell) {
  for (const m of MILLS) {
    if (m.includes(at) && b[m[0]] === cell && b[m[1]] === cell && b[m[2]] === cell) return m;
  }
  return null;
}

function allFree(b) {
  const out = [];
  for (let i = 0; i < POINTS; i++) if (b[i] === EMPTY) out.push(i);
  return out;
}

export function count(b, player) {
  const cell = cellOf(player);
  let n = 0;
  for (let i = 0; i < POINTS; i++) if (b[i] === cell) n++;
  return n;
}

function mobility(state, player) {
  if (state.hand[player] > 0) return 8;
  const cell = cellOf(player);
  let n = 0;
  for (let i = 0; i < POINTS; i++) {
    if (state.b[i] !== cell) continue;
    for (const j of ADJ[i]) if (state.b[j] === EMPTY) n++;
  }
  return n;
}
