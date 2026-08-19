// Draughts, Brazilian rules — which are the international rules on a small
// board, and are what everybody in this country actually plays:
//
//   * men capture forwards **and** backwards;
//   * a king is a flying king: it slides any distance along a diagonal, and
//     when it captures it may land on any free square beyond the piece it took;
//   * capturing is compulsory, and when there is a choice you must take the
//     line that captures the **most** pieces;
//   * a man that only passes through the last row mid-capture is not crowned —
//     it is crowned when the move *ends* there.
//
// The compulsory-maximum rule is why the move generator is a depth-first walk
// that returns whole capture chains instead of single steps. It is also the
// most common way a draughts implementation is quietly wrong: captured pieces
// stay on the board until the chain ends, blocking the way and forbidding a
// second jump over the same piece, and a generator that removes them as it goes
// will happily invent chains that do not exist.

import { EMPTY, other } from './shared.js';

export const SIZE = 8;
export const MAN0 = 1;
export const MAN1 = 2;
export const KING0 = 3;
export const KING1 = 4;

export const ownerOf = (v) => (v === MAN0 || v === KING0 ? 0 : v === MAN1 || v === KING1 ? 1 : -1);
export const isKing = (v) => v === KING0 || v === KING1;
const manOf = (p) => (p === 0 ? MAN0 : MAN1);
const kingOf = (p) => (p === 0 ? KING0 : KING1);
const rc = (i) => [i >> 3, i & 7];
const idx = (r, c) => r * SIZE + c;
const onBoard = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

const DIAGS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

/** 20 quiet moves each — the standard draw when neither side can make progress. */
const IDLE_LIMIT = 40;

export const checkers = {
  id: 'checkers',
  emoji: '⛀',
  players: 2,
  chance: false,

  setup() {
    const b = new Array(64).fill(EMPTY);
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((r + c) % 2 === 0) continue;          // only the dark squares play
        if (r < 3) b[idx(r, c)] = MAN1;
        else if (r > 4) b[idx(r, c)] = MAN0;
      }
    }
    return { b, turn: 0, ply: 0, idle: 0, last: null };
  },

  moves: (state) => movesFor(state.b, state.turn),

  apply(state, move) {
    const b = state.b.slice();
    const from = move.path[0];
    const to = move.path[move.path.length - 1];
    let piece = b[from];
    b[from] = EMPTY;
    for (const at of move.caps) b[at] = EMPTY;

    // crowned only if the move ENDS on the last row — a chain that merely
    // passes through it carries on as a man
    const [r] = rc(to);
    const promoted = !isKing(piece) && ((state.turn === 0 && r === 0) || (state.turn === 1 && r === SIZE - 1));
    if (promoted) piece = kingOf(state.turn);
    b[to] = piece;

    const quiet = !move.caps.length && isKing(b[to]) && !promoted;
    return {
      ...state,
      b,
      turn: other(state.turn),
      ply: (state.ply || 0) + 1,
      idle: quiet ? (state.idle || 0) + 1 : 0,
      last: move,
    };
  },

  result(state) {
    if ((state.idle || 0) >= IDLE_LIMIT) return { winner: null, reason: 'idle' };
    if (!movesFor(state.b, state.turn).length) {
      // no pieces or nowhere to go: in draughts both lose the same way
      return { winner: other(state.turn), reason: 'blocked' };
    }
    return null;
  },

  /** Captures are the noisy moves — this is what the quiescence search reads. */
  loud(state) {
    const all = movesFor(state.b, state.turn);
    return all[0] && all[0].caps.length ? all : [];
  },

  evaluate(state, me) {
    let score = 0;
    let men = [0, 0];
    let kings = [0, 0];

    for (let i = 0; i < 64; i++) {
      const v = state.b[i];
      if (v === EMPTY) continue;
      const owner = ownerOf(v);
      const sign = owner === me ? 1 : -1;
      const [r, c] = rc(i);

      if (isKing(v)) {
        kings[owner]++;
        score += sign * 340;
        // a king in the middle sees more diagonal than one in the corner
        const centre = 3.5;
        score -= sign * (Math.abs(r - centre) + Math.abs(c - centre)) * 3;
      } else {
        men[owner]++;
        score += sign * 100;
        // advancement, counted from that player's own side
        const advance = owner === 0 ? SIZE - 1 - r : r;
        score += sign * advance * advance * 1.1;
        // the back row is a wall: while it stands, nothing gets crowned behind it
        if ((owner === 0 && r === SIZE - 1) || (owner === 1 && r === 0)) score += sign * 14;
        // the edge is safe but useless — a man there can never be captured, and
        // can never capture either
        if (c === 0 || c === SIZE - 1) score -= sign * 6;
      }
    }

    // with an equal number of pieces, whoever has fewer wants the trade
    const mine = men[me] + kings[me] * 3;
    const theirs = men[other(me)] + kings[other(me)] * 3;
    if (mine > theirs) score += 12 * (mine - theirs);
    return score;
  },

  key: (state) => state.b.join('') + state.turn,

  ai: {
    unit: 100,
    openPlies: 4,
    easy: { depth: 1, slack: 1.2, blunder: 0.3 },
    normal: { depth: 3, slack: 0.5, blunder: 0.1 },
    hard: { depth: 5, slack: 0.12, blunder: 0.01 },
    pro: { depth: 9, slack: 0, blunder: 0, ms: 1800 },
  },
};

/**
 * Every legal move for a player — captures if there are any, and among those
 * only the longest, which is the compulsory-maximum rule.
 */
export function movesFor(b, player) {
  const caps = [];
  let best = 0;

  for (let i = 0; i < 64; i++) {
    if (ownerOf(b[i]) !== player) continue;
    const chains = captureChains(b, i, b[i], player, [], []);
    for (const chain of chains) {
      if (chain.caps.length > best) best = chain.caps.length;
      caps.push(chain);
    }
  }
  if (best > 0) return caps.filter((m) => m.caps.length === best);

  const quiet = [];
  for (let i = 0; i < 64; i++) {
    if (ownerOf(b[i]) !== player) continue;
    const [r, c] = rc(i);
    const king = isKing(b[i]);
    for (const [dr, dc] of DIAGS) {
      // a man only walks forwards; it is only backwards that it captures
      if (!king && ((player === 0 && dr > 0) || (player === 1 && dr < 0))) continue;
      let step = 1;
      while (true) {
        const nr = r + dr * step;
        const nc = c + dc * step;
        if (!onBoard(nr, nc) || b[idx(nr, nc)] !== EMPTY) break;
        quiet.push({ path: [i, idx(nr, nc)], caps: [] });
        if (!king) break;
        step++;
      }
    }
  }
  return quiet;
}

/**
 * Depth-first over every jump available from `at`, with the pieces taken so far
 * kept on the board — blocked, but present. Returns whole chains.
 */
function captureChains(b, at, piece, player, taken, path) {
  const king = isKing(piece);
  const [r, c] = rc(at);
  const chains = [];

  for (const [dr, dc] of DIAGS) {
    let step = 1;
    // a flying king slides up to the piece it jumps; a man only looks one square
    if (king) {
      while (true) {
        const nr = r + dr * step;
        const nc = c + dc * step;
        if (!onBoard(nr, nc)) break;
        const j = idx(nr, nc);
        if (taken.includes(j)) break;             // already captured: it still blocks
        if (b[j] !== EMPTY) break;
        step++;
      }
    }
    const vr = r + dr * step;
    const vc = c + dc * step;
    if (!onBoard(vr, vc)) continue;
    const victim = idx(vr, vc);
    if (b[victim] === EMPTY || ownerOf(b[victim]) === player || taken.includes(victim)) continue;

    // every landing square beyond the victim (one, for a man)
    let land = 1;
    while (true) {
      const lr = vr + dr * land;
      const lc = vc + dc * land;
      if (!onBoard(lr, lc)) break;
      const to = idx(lr, lc);
      if (b[to] !== EMPTY || taken.includes(to)) break;

      const nextTaken = taken.concat(victim);
      const nextPath = (path.length ? path : [at]).concat(to);
      const deeper = captureChains(b, to, piece, player, nextTaken, nextPath);
      if (deeper.length) chains.push(...deeper);
      else chains.push({ path: nextPath, caps: nextTaken });

      if (!king) break;
      land++;
    }
  }
  return chains;
}

/** Material, for the HUD's captured-piece tray. */
export function census(b) {
  const out = [{ men: 0, kings: 0 }, { men: 0, kings: 0 }];
  for (const v of b) {
    const o = ownerOf(v);
    if (o < 0) continue;
    if (isKing(v)) out[o].kings++;
    else out[o].men++;
  }
  return out;
}
