// Backgammon. Dice, and the reason this cabinet has two random streams.
//
// The promise on the difficulty screen is that the levels change the opponent's
// head and never the player's luck, and a dice game is where that promise is
// either kept or exposed. It is kept structurally, not by good intentions:
//
//   * `roll(state, luck)` is the only function here that touches randomness,
//     and the search never calls it — it cannot, it is not reachable from
//     `moves`/`apply`/`evaluate`;
//   * the dice live *in the state* as a list of pips still to be used, so
//     thinking about a position and playing it are the same operation on the
//     same numbers;
//   * the two streams are separate, so however many numbers the professional
//     draws while deliberating, the next throw is the one the easy opponent
//     would have got (see engine/rng.js).
//
// The other decision worth knowing: a turn is several moves, not one. `moves`
// returns single checker moves and `apply` spends one die, so the search walks
// into the turn one die at a time — and because `state.turn` only changes when
// the dice run out, the minimax in engine/ai.js keeps maximising through the
// whole turn without knowing anything about backgammon. That is also what makes
// the levels honest here: at depth 1 the machine plays the first half of its
// turn without looking at the second half, which is exactly how a beginner
// plays it.

import { other } from './shared.js';

export const POINTS = 24;
export const CHECKERS = 15;
export const BAR = -1;
export const OFF = -2;

/** Direction of travel: player 0 walks 23 → 0, player 1 walks 0 → 23. */
export const stepOf = (player) => (player === 0 ? -1 : 1);
/** The six points a player bears off from. */
export const homeOf = (player) => (player === 0 ? [0, 5] : [18, 23]);

export const backgammon = {
  id: 'backgammon',
  emoji: '🎲',
  players: 2,
  chance: true,

  setup() {
    const pts = new Array(POINTS).fill(0);
    pts[23] = 2; pts[12] = 5; pts[7] = 3; pts[5] = 5;
    pts[0] = -2; pts[11] = -5; pts[16] = -3; pts[18] = -5;
    return { pts, bar: [0, 0], off: [0, 0], dice: [], turn: 0, ply: 0, last: null };
  },

  /** True while the state is waiting on a throw — the match loop asks this. */
  needsRoll: (state) => !state.dice.length && !backgammon.result(state),

  /**
   * The one place the luck stream is read. Doubles are four moves, which is the
   * rule that makes backgammon swing — and it is the same rule at every level.
   */
  roll(state, luck) {
    const a = luck.die();
    const b = luck.die();
    const dice = a === b ? [a, a, a, a] : [a, b];
    return { ...state, dice, rolled: [a, b] };
  },

  /**
   * Every throw and its probability, so anything that wants to reason about the
   * dice can do it without rolling one. Nothing in the shipped AI needs this —
   * it is what `test/ai.test.mjs` uses to prove the search never touches luck.
   */
  outcomes() {
    const out = [];
    for (let a = 1; a <= 6; a++) {
      for (let b = a; b <= 6; b++) {
        out.push({ dice: a === b ? [a, a, a, a] : [a, b], p: a === b ? 1 / 36 : 2 / 36 });
      }
    }
    return out;
  },

  moves(state) {
    if (!state.dice.length || backgammon.result(state)) return [];
    const legal = movesFor(state);
    // A throw with nowhere to go still has to be spent. Modelling that as an
    // explicit pass rather than as "no moves" is what keeps the turn moving:
    // an empty move list means *the game is over* to everything that consumes
    // this contract, and a player shut out behind a closed board would sit
    // there holding two dice for ever. It is also the honest thing to show —
    // the HUD says which throw was wasted.
    if (!legal.length) return [{ pass: true, die: state.dice[0] }];

    // "Use as many dice as you can, and if only one will go, use the higher."
    // Both halves need looking ahead: a move that is legal on its own can be
    // the one that wastes the other die.
    const best = Math.max(...legal.map((m) => reach(apply(state, m), 1)));
    let pool = legal.filter((m) => reach(apply(state, m), 1) === best);
    if (best === 1 && state.dice.length === 2 && state.dice[0] !== state.dice[1]) {
      const high = Math.max(...state.dice);
      const withHigh = pool.filter((m) => m.die === high);
      if (withHigh.length) pool = withHigh;
    }
    return pool;
  },

  apply,

  result(state) {
    for (const p of [0, 1]) {
      if (state.off[p] < CHECKERS) continue;
      const foe = other(p);
      // gammon and backgammon: worth saying out loud, and worth two or three
      // points in a real match — the HUD reports it
      const home = homeOf(p);
      let inLoserHome = state.bar[foe] > 0;
      for (let i = home[0]; i <= home[1] && !inLoserHome; i++) {
        if (owner(state.pts[i]) === foe) inLoserHome = true;
      }
      const points = state.off[foe] > 0 ? 1 : inLoserHome ? 3 : 2;
      return { winner: p, reason: points === 1 ? 'single' : points === 2 ? 'gammon' : 'backgammon', points };
    }
    return null;
  },

  evaluate(state, me) {
    const foe = other(me);
    let score = 0;

    // The pip count: how many pips each side still has to travel. It is the
    // spine of every backgammon evaluation and on its own it plays a decent
    // racing game — and a terrible contact game.
    score += (pips(state, foe) - pips(state, me)) * 2;
    score += (state.off[me] - state.off[foe]) * 45;
    score -= state.bar[me] * 55;
    score += state.bar[foe] * 55;

    for (let i = 0; i < POINTS; i++) {
      const n = state.pts[i];
      if (!n) continue;
      const p = owner(n);
      const count = Math.abs(n);
      const sign = p === me ? 1 : -1;

      // A point held by two or more is a wall the other side cannot land on;
      // one lonely checker is a target. The whole game is the gap between them.
      if (count >= 2) {
        score += sign * 12;
        // and a wall inside your home board, or right in front of it, is worth
        // several times a wall out in the field
        const home = homeOf(p);
        if (i >= home[0] && i <= home[1]) score += sign * 14;
        if (count > 4) score -= sign * 6 * (count - 4);      // stacking is wasted material
      } else {
        // a blot is only a problem where it can be hit
        score -= sign * (10 + shots(state, i, other(p)) * 4);
      }
    }

    // holding the opponent's bar point, and yours, is the classic anchor
    if (Math.abs(state.pts[me === 0 ? 18 : 5]) >= 2 && owner(state.pts[me === 0 ? 18 : 5]) === me) score += 20;
    return score;
  },

  key: (state) => state.pts.join(',') + '|' + state.bar.join(',') + state.off.join(',') + state.dice.join('') + state.turn,

  ai: {
    unit: 45,
    openPlies: 0,
    // Depth here is measured in *dice*, not in turns: four plies is one turn
    // with doubles. Easy plays the first checker without looking at where the
    // second one has to go, which is the most human mistake in the game.
    easy: { depth: 1, slack: 1.3, blunder: 0.28 },
    normal: { depth: 2, slack: 0.55, blunder: 0.1 },
    hard: { depth: 4, slack: 0.12, blunder: 0.01 },
    pro: { depth: 6, slack: 0, blunder: 0, ms: 1200 },
  },
};

/** Which player owns a signed point count. -1 when it is empty. */
export const owner = (n) => (n > 0 ? 0 : n < 0 ? 1 : -1);

function apply(state, move) {
  if (move.pass) {
    return { ...state, dice: [], turn: other(state.turn), ply: (state.ply || 0) + 1, last: { pass: true } };
  }
  const pts = state.pts.slice();
  const bar = state.bar.slice();
  const off = state.off.slice();
  const me = state.turn;
  const sign = me === 0 ? 1 : -1;

  if (move.from === BAR) bar[me]--;
  else pts[move.from] -= sign;

  let hit = false;
  if (move.to === OFF) {
    off[me]++;
  } else {
    // a lone enemy checker on the landing point goes to the bar
    if (owner(pts[move.to]) === other(me) && Math.abs(pts[move.to]) === 1) {
      pts[move.to] = 0;
      bar[other(me)]++;
      hit = true;
    }
    pts[move.to] += sign;
  }

  const dice = state.dice.slice();
  dice.splice(dice.indexOf(move.die), 1);
  const next = { ...state, pts, bar, off, dice, ply: (state.ply || 0) + 1, last: { ...move, hit } };

  // the turn ends when the dice run out — or when what is left cannot be played
  if (!dice.length || !movesFor(next).length) {
    next.dice = [];
    next.turn = other(me);
  }
  return next;
}

/** Legal single checker moves, before the use-the-most rule filters them. */
function movesFor(state) {
  const me = state.turn;
  const step = stepOf(me);
  const out = [];
  const seen = new Set();
  const dice = [...new Set(state.dice)];

  // The bar comes first, and it comes alone: while a checker is on the bar
  // nothing else may move. Forgetting that is the classic backgammon bug, and
  // it makes the machine look like it is cheating.
  if (state.bar[me] > 0) {
    for (const die of dice) {
      const to = me === 0 ? POINTS - die : die - 1;
      if (open(state, to, me)) out.push({ from: BAR, die, to });
    }
    return out;
  }

  const bearing = canBearOff(state, me);
  for (let i = 0; i < POINTS; i++) {
    if (owner(state.pts[i]) !== me) continue;
    for (const die of dice) {
      const to = i + step * die;
      const tag = i + ':' + die;
      if (seen.has(tag)) continue;
      if (to >= 0 && to < POINTS) {
        if (open(state, to, me)) {
          seen.add(tag);
          out.push({ from: i, die, to });
        }
        continue;
      }
      if (!bearing) continue;
      // exact pip bears off; a bigger die only if nothing is further back
      const need = me === 0 ? i + 1 : POINTS - i;
      if (die === need || (die > need && !behind(state, i, me))) {
        seen.add(tag);
        out.push({ from: i, die, to: OFF });
      }
    }
  }
  return out;
}

/** How many dice can still be spent from here — the look-ahead the
 *  use-the-most rule needs. */
function reach(state, used) {
  if (!state.dice.length) return used;
  const next = movesFor(state);
  if (!next.length) return used;
  let best = used;
  for (const m of next) {
    const deeper = reach(apply(state, m), used + 1);
    if (deeper > best) best = deeper;
  }
  return best;
}

function open(state, point, player) {
  const n = state.pts[point];
  return owner(n) !== other(player) || Math.abs(n) < 2;
}

export function canBearOff(state, player) {
  if (state.bar[player] > 0) return false;
  const [lo, hi] = homeOf(player);
  for (let i = 0; i < POINTS; i++) {
    if (owner(state.pts[i]) === player && (i < lo || i > hi)) return false;
  }
  return true;
}

/** Is anything of this player's further from home than `point`? */
function behind(state, point, player) {
  if (player === 0) {
    for (let i = point + 1; i <= 5; i++) if (owner(state.pts[i]) === 0) return true;
  } else {
    for (let i = point - 1; i >= 18; i--) if (owner(state.pts[i]) === 1) return true;
  }
  return false;
}

/** Pips left to travel — the race, in one number. */
export function pips(state, player) {
  let total = state.bar[player] * 25;
  for (let i = 0; i < POINTS; i++) {
    if (owner(state.pts[i]) !== player) continue;
    const distance = player === 0 ? i + 1 : POINTS - i;
    total += Math.abs(state.pts[i]) * distance;
  }
  return total;
}

/**
 * How many of the 36 throws hit the blot on `point`.
 *
 * This is the cheapest thing in backgammon that looks like deep thought: a
 * one-ply machine that counts shots plays a decent safe game, because leaving a
 * blot eleven shots from an enemy checker is a different mistake from leaving
 * one that only a double reaches.
 */
export function shots(state, point, hunter) {
  if (state.bar[hunter] > 0) {
    const from = hunter === 0 ? POINTS : -1;
    return direct(Math.abs(point - from));
  }
  let hits = 0;
  const step = stepOf(hunter);
  for (let i = 0; i < POINTS; i++) {
    if (owner(state.pts[i]) !== hunter) continue;
    const distance = (point - i) * step;
    if (distance > 0 && distance <= 12) hits += direct(distance);
  }
  return Math.min(hits, 24);
}

/** Roughly how many of the 36 combinations make a given distance. */
function direct(distance) {
  if (distance <= 0) return 0;
  if (distance <= 6) return 11;                 // either die, plus the doubles
  if (distance <= 8) return 6;
  if (distance === 9 || distance === 12) return 5;
  if (distance <= 11) return 2;
  return 1;
}
