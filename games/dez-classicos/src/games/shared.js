// What the ten rule modules agree on.
//
// A game here is a plain object with a handful of pure functions, and the
// shapes below are the whole contract. Everything is JSON: a state can be
// written to localStorage and read back a version later without a single
// custom serialiser, and a move can be compared with `===` on its fields.
//
//   setup(opts)            a fresh state
//   moves(state)           every legal move for `state.turn`
//   apply(state, move)     the next state — pure, and called a hundred thousand
//                          times a second by the search, so it allocates as
//                          little as it can get away with
//   result(state)          null while it is still a game; { winner } when it is not
//   evaluate(state, me)    how good it looks for player `me`, in the game's own unit
//
// And, for the three that use dice:
//
//   needsRoll(state)       true when the state is waiting on a throw
//   roll(state, luck)      the ONLY function in this folder allowed to touch
//                          the luck stream (see engine/rng.js)
//   outcomes(state)        every throw with its probability, for an expectimax
//                          that must never roll a die to think about one
//
// `winner` is a player index (0 or 1); `null` is a draw.

/** Empty, player 0, player 1 — the three values every board cell here holds. */
export const EMPTY = 0;
export const P0 = 1;
export const P1 = 2;

export const cellOf = (player) => player + 1;
export const playerOf = (cell) => cell - 1;
export const other = (player) => 1 - player;

/** A shallow clone with the bookkeeping every apply has to do anyway. */
export function advance(state, patch, turn) {
  return { ...state, ...patch, turn: turn === undefined ? other(state.turn) : turn, ply: (state.ply || 0) + 1 };
}

/** Sum of a row of small integers, without allocating an intermediate array. */
export function sum(list, from = 0, to = list.length) {
  let t = 0;
  for (let i = from; i < to; i++) t += list[i];
  return t;
}

/** `[0, 1, … n-1]` — spelled out because half these games start from one. */
export function range(n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = i;
  return out;
}
