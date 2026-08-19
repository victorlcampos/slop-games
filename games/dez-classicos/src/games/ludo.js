// Ludo — four players, one die, and the oldest argument in the family.
//
// The rules here are the ones people actually play with: a six to leave the
// yard, a six plays again, a capture plays again, a piece home plays again,
// three sixes in a row lose the turn, and the exact count to enter the final
// column. Landing on an enemy sends it back to its yard, unless it is standing
// on one of the eight safe squares.
//
// This is the one game on the table that does not use the minimax in
// engine/ai.js, and the reason is structural rather than a shortcut: with four
// players there is no "the opponent", so the sign flip that makes minimax work
// has nothing to flip. It scores its own moves — and then hands the list to the
// kit's `chooseScored`, so `easy` here is the same easy as everywhere else.
//
// What separates the levels is one number: risk. Every level can see a capture.
// Only the two upper ones count how many of the thirty-six ways the die can
// fall leave the piece they just moved standing in front of an enemy.

import { chooseScored } from '../engine/ai.js';

export const TRACK = 52;         // squares on the shared ring
export const LANE = 6;           // final column: five squares and the centre
export const HOME = TRACK - 1 + LANE;  // 57 — the step that is the centre itself
export const YARD = -1;
export const PIECES = 4;

/** Where each colour joins the ring. */
export const entryOf = (player) => player * 13;
/** The absolute ring square a step maps to, or -1 while in the lane. */
export const squareAt = (player, step) => (step < 0 || step >= TRACK - 1 + 1 ? -1 : (entryOf(player) + step) % TRACK);

/** The eight squares nothing can be captured on: every entry and every star. */
export const SAFE = (() => {
  const out = new Set();
  for (let p = 0; p < 4; p++) {
    out.add(entryOf(p));
    out.add((entryOf(p) + 8) % TRACK);
  }
  return out;
})();

export const ludo = {
  id: 'ludo',
  emoji: '🎯',
  players: 4,
  chance: true,

  setup() {
    return {
      pawns: [0, 1, 2, 3].map(() => new Array(PIECES).fill(YARD)),
      turn: 0,
      dice: [],
      sixes: 0,
      ply: 0,
      last: null,
    };
  },

  needsRoll: (state) => !state.dice.length && !ludo.result(state),

  /**
   * One die, from the luck stream, and nothing about the level reaches this
   * function — it does not even know what level is playing.
   */
  roll(state, luck) {
    const die = luck.die();
    const sixes = die === 6 ? (state.sixes || 0) + 1 : 0;
    // three sixes in a row and the turn is forfeit, which is the only thing in
    // ludo that punishes a good throw
    if (sixes >= 3) {
      return { ...state, dice: [], sixes: 0, turn: (state.turn + 1) % 4, ply: (state.ply || 0) + 1, last: { burnt: die } };
    }
    return { ...state, dice: [die], sixes, rolled: die };
  },

  moves(state) {
    if (!state.dice.length || ludo.result(state)) return [];
    const die = state.dice[0];
    const me = state.turn;
    const out = [];
    const seen = new Set();

    for (let i = 0; i < PIECES; i++) {
      const step = state.pawns[me][i];
      if (step >= HOME) continue;
      let to;
      if (step === YARD) {
        if (die !== 6) continue;
        to = 0;
      } else {
        to = step + die;
        if (to > HOME) continue;              // the centre needs the exact count
      }
      if (to < TRACK - 1 && blockedBy(state, me, to)) continue;
      // two pieces on the same square are the same move; offering it twice just
      // makes the board look ambiguous
      const tag = step + '>' + to;
      if (seen.has(tag)) continue;
      seen.add(tag);
      out.push({ pawn: i, from: step, to });
    }
    // a throw nobody can use is still a throw: it has to be spent, or the turn
    // never ends (the same trap backgammon has)
    return out.length ? out : [{ pass: true }];
  },

  apply(state, move) {
    const me = state.turn;
    const die = state.dice[0];
    const pawns = state.pawns.map((row) => row.slice());
    let captured = null;

    if (!move.pass) {
      pawns[me][move.pawn] = move.to;
      const square = ringSquare(me, move.to);
      if (square >= 0 && !SAFE.has(square)) {
        for (let p = 0; p < 4; p++) {
          if (p === me) continue;
          for (let i = 0; i < PIECES; i++) {
            if (ringSquare(p, pawns[p][i]) === square) {
              pawns[p][i] = YARD;
              captured = { player: p, pawn: i };
            }
          }
        }
      }
    }

    // a six, a capture, or a piece home: all three buy another throw
    const again = !move.pass && (die === 6 || captured || move.to === HOME);
    return {
      ...state,
      pawns,
      dice: [],
      sixes: die === 6 ? state.sixes : 0,
      turn: again ? me : (me + 1) % 4,
      ply: (state.ply || 0) + 1,
      last: { ...move, die, captured, again },
    };
  },

  result(state) {
    for (let p = 0; p < 4; p++) {
      if (state.pawns[p].every((s) => s >= HOME)) return { winner: p, reason: 'home' };
    }
    return null;
  },

  /**
   * The board from one player's side, in one number. Used by the HUD's standing
   * and by the scoring below.
   */
  evaluate(state, me) {
    let score = 0;
    for (let p = 0; p < 4; p++) {
      const sign = p === me ? 1 : -1;
      for (const step of state.pawns[p]) {
        if (step === YARD) continue;
        score += sign * (step >= HOME ? 120 : step + 20);
      }
    }
    return score;
  },

  /** Four players and a die: it scores its own moves. See the note on top. */
  pickMove(state, level, rnd, legal) {
    const moves = legal || ludo.moves(state);
    if (moves.length <= 1) return moves[0] || null;
    const careful = level === 'hard' || level === 'pro';
    const scored = moves.map((move) => ({ move, score: scoreMove(state, move, careful) }));
    return chooseScored(scored, level, rnd, { unit: 30 });
  },

  ai: { unit: 30, openPlies: 0 },
};

/** The ring square a pawn stands on, or -1 in the yard or the final column. */
export function ringSquare(player, step) {
  if (step < 0 || step > TRACK - 2) return -1;
  return (entryOf(player) + step) % TRACK;
}

/** Two enemy pawns on one square are a block nothing walks past. */
function blockedBy(state, me, step) {
  const square = ringSquare(me, step);
  if (square < 0) return false;
  for (let p = 0; p < 4; p++) {
    if (p === me) continue;
    let n = 0;
    for (const s of state.pawns[p]) if (ringSquare(p, s) === square) n++;
    if (n >= 2) return true;
  }
  return false;
}

/**
 * What a move is worth. Every level reads the same board; only the two upper
 * ones subtract the risk term, and that single difference is most of what a
 * player feels across the table — an easy opponent parks a piece in front of
 * three enemies and never sees it coming.
 */
function scoreMove(state, move, careful) {
  if (move.pass) return -1000;
  const me = state.turn;
  let score = 0;

  if (move.to === HOME) score += 150;
  else if (move.to >= TRACK - 1) score += 55 + (move.to - TRACK) * 4;   // safe in the lane
  if (move.from === YARD) score += 45;                                   // a piece in play is worth having

  const square = ringSquare(me, move.to);
  const capture = captureAt(state, me, square);
  if (capture) score += 70 + capture.step * 1.2;                         // and the further along it was, the better

  if (square >= 0) {
    if (SAFE.has(square)) score += 22;
    // landing on your own piece is a block: nothing walks past two
    for (const s of state.pawns[me]) if (s !== move.from && ringSquare(me, s) === square) score += 18;
    if (careful) {
      score -= threat(state, me, square) * 3.2;
      // and leaving a square where something was about to be hit is worth the same
      const before = ringSquare(me, move.from);
      if (before >= 0 && !SAFE.has(before)) score += threat(state, me, before) * 1.6;
    }
  }

  score += (move.to - Math.max(move.from, 0)) * 0.6;                     // ties go to progress
  return score;
}

function captureAt(state, me, square) {
  if (square < 0 || SAFE.has(square)) return null;
  for (let p = 0; p < 4; p++) {
    if (p === me) continue;
    for (const s of state.pawns[p]) {
      if (ringSquare(p, s) === square) return { player: p, step: s };
    }
  }
  return null;
}

/**
 * Out of thirty-six throws, how many put an enemy on this square next turn.
 * Counted properly rather than guessed: a piece one square in front of an enemy
 * is in far more danger than one six squares in front, and a machine that
 * treats "an enemy is near" as a single fact plays the difference away.
 */
function threat(state, me, square) {
  if (SAFE.has(square)) return 0;
  let ways = 0;
  for (let p = 0; p < 4; p++) {
    if (p === me) continue;
    for (const s of state.pawns[p]) {
      if (s < 0 || s >= TRACK - 1) continue;
      const from = ringSquare(p, s);
      if (from < 0) continue;
      const gap = (square - from + TRACK) % TRACK;
      if (gap >= 1 && gap <= 6) ways += 1;
      // a piece still in the yard needs a six to come out and a second throw to
      // reach — real, but a quarter of the danger
      if (gap === 0) ways += 0.2;
    }
    for (const s of state.pawns[p]) {
      if (s !== YARD) continue;
      const gap = (square - entryOf(p) + TRACK) % TRACK;
      if (gap <= 6) ways += 0.25;
    }
  }
  return ways;
}
