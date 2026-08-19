// Chess. All of it: castling with its four rights, en passant, promotion to any
// of the four, fifty moves, insufficient material, stalemate.
//
// The board is a plain array of 64 and a piece is one small integer — type in
// the low three bits, colour in the fourth (`v >> 3`). That shape is not for
// elegance: `apply` runs a few hundred thousand times a second inside the
// search, and anything that allocates an object per square shows up as the
// difference between reading three plies and reading five.
//
// Two things a chess engine gets wrong quietly, and where they are handled:
//
//   * **legality**. Moves are generated pseudo-legally and filtered by making
//     them and asking whether the king is attacked. Slower than pinned-piece
//     bookkeeping, and it is right in every case, including the two that catch
//     everyone: a king walking along the line it is being checked on, and an en
//     passant capture that opens a rank onto your own king.
//   * **castling through check**. The rights are not enough: the square the
//     king crosses has to be safe too, and the rook's path merely has to be
//     empty. Those are different squares on the queen's side, which is where
//     the off-by-one lives.

import { other } from './shared.js';

export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export const colorOf = (v) => v >> 3;
export const typeOf = (v) => v & 7;
export const pieceOf = (type, color) => type | (color << 3);

const A = 0, B = 1, C = 2, D = 3, E = 4, F = 5, G = 6, H = 7;
const at = (r, c) => r * 8 + c;

const KNIGHT_STEPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const BISHOP_RAYS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_RAYS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const QUEEN_RAYS = BISHOP_RAYS.concat(ROOK_RAYS);

export const VALUE = { [PAWN]: 100, [KNIGHT]: 320, [BISHOP]: 330, [ROOK]: 500, [QUEEN]: 900, [KING]: 0 };

// Piece-square tables, from white's point of view (rank 0 is black's back row).
// They are the cheapest positional knowledge there is: a knight on the rim and
// a knight in the middle have the same material value and are not the same piece.
const PST = {
  [PAWN]: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [KNIGHT]: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  [BISHOP]: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  [ROOK]: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  [QUEEN]: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  [KING]: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

/** The king wants a corner in the middlegame and the middle in the endgame. */
const KING_LATE = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];

export const chess = {
  id: 'chess',
  emoji: '♛',
  players: 2,
  chance: false,

  setup() {
    const b = new Array(64).fill(0);
    const back = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];
    for (let c = 0; c < 8; c++) {
      b[at(0, c)] = pieceOf(back[c], 1);
      b[at(1, c)] = pieceOf(PAWN, 1);
      b[at(6, c)] = pieceOf(PAWN, 0);
      b[at(7, c)] = pieceOf(back[c], 0);
    }
    return { b, turn: 0, ply: 0, cast: [1, 1, 1, 1], ep: -1, half: 0, last: null };
  },

  moves(state) {
    const out = [];
    for (const move of pseudoMoves(state, state.turn)) {
      const next = make(state, move);
      if (!attacked(next.b, kingSquare(next.b, state.turn), other(state.turn))) out.push(move);
    }
    return out;
  },

  apply: (state, move) => make(state, move),

  result(state) {
    if (chess.moves(state).length === 0) {
      const inCheck = attacked(state.b, kingSquare(state.b, state.turn), other(state.turn));
      return inCheck
        ? { winner: other(state.turn), reason: 'checkmate' }
        : { winner: null, reason: 'stalemate' };
    }
    if (state.half >= 100) return { winner: null, reason: 'fifty' };
    if (thin(state.b)) return { winner: null, reason: 'material' };
    return null;
  },

  /** Captures and promotions — the moves quiescence has to look past. */
  loud(state) {
    return chess.moves(state).filter((m) => m.cap || m.promo);
  },

  evaluate(state, me) {
    let score = 0;
    let material = 0;
    const pawns = [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]];

    for (let i = 0; i < 64; i++) {
      const v = state.b[i];
      if (!v) continue;
      const type = typeOf(v);
      const color = colorOf(v);
      if (type !== KING && type !== PAWN) material += VALUE[type];
      if (type === PAWN) pawns[color][i & 7]++;
    }
    const endgame = material < 1400;

    for (let i = 0; i < 64; i++) {
      const v = state.b[i];
      if (!v) continue;
      const type = typeOf(v);
      const color = colorOf(v);
      const sign = color === me ? 1 : -1;
      // black reads the tables mirrored across the ranks, not rotated: the
      // files are symmetric, the ranks are the whole point of them
      const mirrored = color === 0 ? i : ((7 - (i >> 3)) << 3) | (i & 7);
      score += sign * VALUE[type];
      score += sign * (type === KING && endgame ? KING_LATE[mirrored] : PST[type][mirrored]);
    }

    for (const color of [0, 1]) {
      const sign = color === me ? 1 : -1;
      for (let file = 0; file < 8; file++) {
        const n = pawns[color][file];
        if (n > 1) score -= sign * 18 * (n - 1);          // doubled
        if (n && !pawns[color][file - 1] && !pawns[color][file + 1]) score -= sign * 14;  // isolated
      }
      // the pair of bishops is worth about half a pawn, and always has been
      let bishops = 0;
      for (let i = 0; i < 64; i++) if (state.b[i] === pieceOf(BISHOP, color)) bishops++;
      if (bishops >= 2) score += sign * 35;
    }

    // a rough mobility term, and the tempo: it matters more than it looks
    const mine = pseudoMoves(state, me).length;
    const theirs = pseudoMoves(state, other(me)).length;
    score += (mine - theirs) * 2;
    if (state.turn === me) score += 8;
    return score;
  },

  key: (state) => state.b.join(',') + state.turn + state.cast.join('') + state.ep,

  ai: {
    unit: 100,
    openPlies: 6,
    // Chess is the one game here where depth is bought with real time. The
    // ceilings are high and the millisecond budget is what actually stops the
    // search — iterative deepening keeps whatever ply it finished.
    easy: { depth: 1, ms: 150, slack: 1.4, blunder: 0.3 },
    normal: { depth: 3, ms: 500, slack: 0.55, blunder: 0.08 },
    hard: { depth: 5, ms: 1400, slack: 0.12, blunder: 0.01 },
    pro: { depth: 8, ms: 2600, slack: 0, blunder: 0 },
  },
};

/**
 * Every move the pieces can make, ignoring whether the king is left in check.
 * Captures come first: alpha-beta prunes far more when the move that wins a
 * queen is the first one tried.
 */
export function pseudoMoves(state, color) {
  const b = state.b;
  const caps = [];
  const quiet = [];

  for (let i = 0; i < 64; i++) {
    const v = b[i];
    if (!v || colorOf(v) !== color) continue;
    const r = i >> 3;
    const c = i & 7;
    const type = typeOf(v);

    if (type === PAWN) {
      const dir = color === 0 ? -1 : 1;
      const start = color === 0 ? 6 : 1;
      const last = color === 0 ? 0 : 7;
      const one = r + dir;
      if (one >= 0 && one < 8 && !b[at(one, c)]) {
        push(quiet, caps, { from: i, to: at(one, c) }, one === last, false);
        if (r === start && !b[at(r + dir * 2, c)]) {
          quiet.push({ from: i, to: at(r + dir * 2, c), double: true });
        }
      }
      for (const dc of [-1, 1]) {
        const nc = c + dc;
        if (nc < 0 || nc > 7 || one < 0 || one > 7) continue;
        const target = at(one, nc);
        if (b[target] && colorOf(b[target]) !== color) {
          push(quiet, caps, { from: i, to: target, cap: b[target] }, one === last, true);
        } else if (target === state.ep) {
          // the captured pawn is beside the arriving square, not on it
          caps.push({ from: i, to: target, cap: pieceOf(PAWN, other(color)), ep: at(r, nc) });
        }
      }
      continue;
    }

    if (type === KNIGHT) {
      for (const [dr, dc] of KNIGHT_STEPS) step(b, i, r + dr, c + dc, color, quiet, caps);
      continue;
    }
    if (type === KING) {
      for (const [dr, dc] of QUEEN_RAYS) step(b, i, r + dr, c + dc, color, quiet, caps);
      castles(state, color, quiet);
      continue;
    }
    const rays = type === BISHOP ? BISHOP_RAYS : type === ROOK ? ROOK_RAYS : QUEEN_RAYS;
    for (const [dr, dc] of rays) {
      let nr = r + dr;
      let nc = c + dc;
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const target = at(nr, nc);
        if (!b[target]) quiet.push({ from: i, to: target });
        else {
          if (colorOf(b[target]) !== color) caps.push({ from: i, to: target, cap: b[target] });
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }
  return caps.concat(quiet);
}

function step(b, from, nr, nc, color, quiet, caps) {
  if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return;
  const to = at(nr, nc);
  if (!b[to]) quiet.push({ from, to });
  else if (colorOf(b[to]) !== color) caps.push({ from, to, cap: b[to] });
}

/** A pawn arriving on the last rank becomes four different moves. */
function push(quiet, caps, move, promoting, capture) {
  const list = capture ? caps : quiet;
  if (!promoting) {
    list.push(move);
    return;
  }
  // queen first — it is the right answer nearly always, and move ordering
  // wants the best one at the front. The under-promotions are generated
  // because "nearly" is doing work: a knight comes with check, and a rook
  // instead of a queen is sometimes the only way to avoid stalemating them.
  for (const promo of [QUEEN, KNIGHT, ROOK, BISHOP]) list.push({ ...move, promo });
}

/**
 * Castling. The rights say it was never played; the rest has to be checked
 * every time — the squares between are empty, the king is not in check, and it
 * does not *cross* an attacked square. On the queen's side the rook passes over
 * b1 as well, which must be empty but may be attacked.
 */
function castles(state, color, out) {
  const b = state.b;
  const home = color === 0 ? 7 : 0;
  const king = at(home, E);
  if (b[king] !== pieceOf(KING, color)) return;
  const foe = other(color);
  if (attacked(b, king, foe)) return;

  const rights = color === 0 ? [state.cast[0], state.cast[1]] : [state.cast[2], state.cast[3]];
  if (rights[0] && !b[at(home, F)] && !b[at(home, G)] && b[at(home, H)] === pieceOf(ROOK, color)) {
    if (!attacked(b, at(home, F), foe) && !attacked(b, at(home, G), foe)) {
      out.push({ from: king, to: at(home, G), castle: 'k' });
    }
  }
  if (
    rights[1] &&
    !b[at(home, D)] &&
    !b[at(home, C)] &&
    !b[at(home, B)] &&
    b[at(home, A)] === pieceOf(ROOK, color)
  ) {
    if (!attacked(b, at(home, D), foe) && !attacked(b, at(home, C), foe)) {
      out.push({ from: king, to: at(home, C), castle: 'q' });
    }
  }
}

function make(state, move) {
  const b = state.b.slice();
  const color = state.turn;
  const piece = b[move.from];
  const type = typeOf(piece);

  b[move.from] = 0;
  b[move.to] = move.promo ? pieceOf(move.promo, color) : piece;
  if (move.ep !== undefined) b[move.ep] = 0;
  if (move.castle) {
    const home = move.to >> 3;
    if (move.castle === 'k') {
      b[at(home, F)] = b[at(home, H)];
      b[at(home, H)] = 0;
    } else {
      b[at(home, D)] = b[at(home, A)];
      b[at(home, A)] = 0;
    }
  }

  const cast = state.cast.slice();
  if (type === KING) {
    if (color === 0) cast[0] = cast[1] = 0;
    else cast[2] = cast[3] = 0;
  }
  // a rook that moves, and a rook that is captured on its own corner, both end
  // the right — the second one is the half that gets forgotten
  for (const [square, slot] of [[at(7, H), 0], [at(7, A), 1], [at(0, H), 2], [at(0, A), 3]]) {
    if (move.from === square || move.to === square) cast[slot] = 0;
  }

  return {
    ...state,
    b,
    turn: other(color),
    ply: (state.ply || 0) + 1,
    cast,
    ep: move.double ? (move.from + move.to) / 2 : -1,
    half: move.cap || type === PAWN ? 0 : (state.half || 0) + 1,
    last: move,
  };
}

/** Is `square` attacked by `color`? Walked outwards from the square, which is
 *  cheaper than generating every enemy move — and this runs on every legality
 *  test, which is to say constantly. */
export function attacked(b, square, color) {
  if (square < 0) return false;
  const r = square >> 3;
  const c = square & 7;

  for (const [dr, dc] of KNIGHT_STEPS) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
    if (b[at(nr, nc)] === pieceOf(KNIGHT, color)) return true;
  }

  // pawns attack towards the far side, so we look back towards where they came from
  const dir = color === 0 ? 1 : -1;
  for (const dc of [-1, 1]) {
    const nr = r + dir;
    const nc = c + dc;
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
    if (b[at(nr, nc)] === pieceOf(PAWN, color)) return true;
  }

  for (const [dr, dc] of QUEEN_RAYS) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
    if (b[at(nr, nc)] === pieceOf(KING, color)) return true;
  }

  for (const [rays, type] of [[BISHOP_RAYS, BISHOP], [ROOK_RAYS, ROOK]]) {
    for (const [dr, dc] of rays) {
      let nr = r + dr;
      let nc = c + dc;
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const v = b[at(nr, nc)];
        if (v) {
          if (colorOf(v) === color && (typeOf(v) === type || typeOf(v) === QUEEN)) return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }
  return false;
}

export function kingSquare(b, color) {
  const king = pieceOf(KING, color);
  for (let i = 0; i < 64; i++) if (b[i] === king) return i;
  return -1;
}

export function inCheck(state, color = state.turn) {
  return attacked(state.b, kingSquare(state.b, color), other(color));
}

/** King against king, and the two other pairs that cannot mate. */
function thin(b) {
  const pieces = [];
  for (let i = 0; i < 64; i++) if (b[i]) pieces.push(typeOf(b[i]));
  if (pieces.length > 3) return false;
  if (pieces.length === 2) return true;
  return pieces.some((t) => t === BISHOP || t === KNIGHT) && !pieces.some((t) => t === PAWN || t === ROOK || t === QUEEN);
}

/** Algebraic square name, for the move list in the HUD. */
export function squareName(i) {
  return 'abcdefgh'[i & 7] + (8 - (i >> 3));
}

// ------------------------------------------------------------------- notation

/**
 * A position from FEN. Not for the player — nothing in the UI types one — but
 * for the tests: "mate in one" is a sentence in a test file only if a position
 * can be written down in one line, and the perft numbers that prove the move
 * generator are all quoted against known FENs.
 */
export function fromFEN(fen) {
  const [board, side, rights, ep, half, full] = fen.trim().split(/\s+/);
  const b = new Array(64).fill(0);
  const CODE = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING };
  let i = 0;
  for (const ch of board) {
    if (ch === '/') continue;
    if (ch >= '1' && ch <= '8') i += Number(ch);
    else b[i++] = pieceOf(CODE[ch.toLowerCase()], ch === ch.toLowerCase() ? 1 : 0);
  }
  const file = ep && ep !== '-' ? 'abcdefgh'.indexOf(ep[0]) : -1;
  return {
    b,
    turn: side === 'b' ? 1 : 0,
    ply: full ? (Number(full) - 1) * 2 + (side === 'b' ? 1 : 0) : 0,
    cast: [
      rights.includes('K') ? 1 : 0,
      rights.includes('Q') ? 1 : 0,
      rights.includes('k') ? 1 : 0,
      rights.includes('q') ? 1 : 0,
    ],
    ep: file < 0 ? -1 : (8 - Number(ep[1])) * 8 + file,
    half: Number(half) || 0,
    last: null,
  };
}

/** The other direction, for a save file and for a bug report you can paste. */
export function toFEN(state) {
  const CHAR = { [PAWN]: 'p', [KNIGHT]: 'n', [BISHOP]: 'b', [ROOK]: 'r', [QUEEN]: 'q', [KING]: 'k' };
  let out = '';
  for (let r = 0; r < 8; r++) {
    let gap = 0;
    for (let c = 0; c < 8; c++) {
      const v = state.b[r * 8 + c];
      if (!v) { gap++; continue; }
      if (gap) { out += gap; gap = 0; }
      const ch = CHAR[typeOf(v)];
      out += colorOf(v) === 0 ? ch.toUpperCase() : ch;
    }
    if (gap) out += gap;
    if (r < 7) out += '/';
  }
  const rights = ['K', 'Q', 'k', 'q'].filter((_, i) => state.cast[i]).join('') || '-';
  return `${out} ${state.turn ? 'b' : 'w'} ${rights} ${state.ep >= 0 ? squareName(state.ep) : '-'} ${state.half || 0} ${Math.floor((state.ply || 0) / 2) + 1}`;
}
