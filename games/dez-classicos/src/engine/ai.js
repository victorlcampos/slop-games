// One opponent, four heads.
//
// Every two-player game on this table hands the same three functions to the
// same search — `moves`, `apply`, `evaluate` — and gets back a move. What the
// four difficulty levels change is *this file's* behaviour, and nothing else:
// how deep it looks, how long it is allowed to think, and how willing it is to
// play something it knows is worse.
//
// Three knobs, in the order they matter:
//
//   depth    how far ahead it reads. This is the honest one — a two-ply
//            opponent cannot see a fork, no matter how carefully it evaluates.
//   slack    how much worse than the best move it will happily play, measured
//            in the game's own unit (a pawn in chess, a stone in reversi).
//            Depth alone makes a shallow opponent *consistent*, and a
//            consistent opponent at depth 1 is still unbeatable at tic-tac-toe.
//            Slack is what makes easy feel human: it sees the capture and takes
//            the other one.
//   blunder  the chance of ignoring the search entirely for one move. Rare, and
//            only at the lower levels. It is what leaves a piece hanging.
//
// What none of them touch is the dice. The search reads `rnd.mind`; the dice
// read `rnd.luck` (see rng.js). That separation is the whole promise of the
// difficulty selector, and `test/ai.test.mjs` is where it is nailed down.

export const LEVELS = ['easy', 'normal', 'hard', 'pro'];

/**
 * The four heads, as multipliers over whatever each game declares.
 *
 * `ms` is a ceiling, not a target: the search stops between iterations, so a
 * cheap game finishes its whole tree long before the budget and a heavy one
 * (chess) gets cut mid-ladder and keeps the last completed depth. Nothing here
 * ever returns a move from an unfinished iteration — a half-searched ply is
 * worse than the ply below it, because the moves it did look at are the ones
 * move ordering thought were good.
 */
export const PROFILE = {
  easy: { depth: 1, ms: 90, slack: 1.15, blunder: 0.34, openSlack: 1.15 },
  normal: { depth: 3, ms: 260, slack: 0.4, blunder: 0.1, openSlack: 0.6 },
  hard: { depth: 5, ms: 700, slack: 0.09, blunder: 0.015, openSlack: 0.3 },
  // The professional plays the best move it can find — with one exception, and
  // it is a matter of taste rather than strength: with zero slack it opens the
  // same way every single game, because the same tree gives the same answer.
  // A little room in the first few plies costs nothing measurable and stops the
  // hardest level from being the most predictable one on the table.
  pro: { depth: 8, ms: 1600, slack: 0, blunder: 0, openSlack: 0.16 },
};

const WIN = 1e6;

export function profileFor(game, level) {
  const base = PROFILE[level] || PROFILE.normal;
  const own = (game.ai && game.ai[level]) || {};
  return { ...base, ...own, unit: (game.ai && game.ai.unit) || 100, openPlies: (game.ai && game.ai.openPlies) || 0 };
}

/**
 * The move the machine plays. Synchronous — everything here finishes inside its
 * millisecond budget, and the caller that cares about a smooth frame uses
 * `think()` below instead.
 *
 * @param {object} game   a rules module: moves, apply, evaluate, result
 * @param {object} state
 * @param {string} level  easy | normal | hard | pro
 * @param {object} rnd    the table's randomness; only `mind` is read
 */
export function bestMove(game, state, level, rnd, opts = {}) {
  const legal = game.moves(state);
  if (!legal.length) return { move: null, score: 0, depth: 0, nodes: 0 };
  if (legal.length === 1) return { move: legal[0], score: 0, depth: 0, nodes: 0 };

  // A game that knows better than a general search — dice, four players, a
  // branching factor that makes lookahead meaningless — brings its own head.
  if (game.pickMove) {
    return { move: game.pickMove(state, level, rnd, legal), score: 0, depth: 0, nodes: 0, own: true };
  }

  const p = profileFor(game, level);
  const mind = rnd && rnd.mind ? rnd.mind : null;
  const roll = () => (mind ? mind.next() : Math.random());

  // The blunder: it does not look at the board at all. Deliberately — a mistake
  // picked *by* the search is not a mistake, it is a different search.
  //
  // With one exception, and it is the difference between an easy opponent and a
  // broken one: **a move that wins on the spot is always played**. A beginner
  // misses forks, hangs pieces and walks into traps; a beginner does not fail
  // to deliver mate in one with the rook already on the file. Missing that
  // reads as a bug, so the winning move is looked for first — it costs one
  // pass over the legal moves, and only at the levels that blunder at all.
  if (p.blunder > 0) {
    const kill = winningMove(game, state, legal);
    if (kill) return { move: kill, score: 1e6, depth: 1, nodes: legal.length, forced: true };
    if (roll() < p.blunder) {
      const i = Math.floor(roll() * legal.length) % legal.length;
      return { move: legal[i], score: 0, depth: 0, nodes: 0, blundered: true };
    }
  }

  const scored = scoreMoves(game, state, legal, p, opts);
  return { ...choose(scored, game, state, p, roll), nodes: scored.nodes, depth: scored.depth };
}

/** A move that ends the game in this player's favour right now, if there is one. */
function winningMove(game, state, legal) {
  const me = state.turn;
  for (const move of legal) {
    const over = game.result(game.apply(state, move));
    if (over && over.winner === me) return move;
  }
  return null;
}

/** Iterative deepening: every move at every depth, keeping the last full pass. */
function scoreMoves(game, state, legal, p, opts) {
  const me = state.turn;
  const deadline = now() + (opts.ms || p.ms);
  const tt = game.key ? new Map() : null;
  const ctx = { game, me, nodes: 0, deadline, tt, stop: false };

  let table = legal.map((move) => ({ move, score: 0 }));
  let reached = 0;

  for (let depth = 1; depth <= p.depth; depth++) {
    // best-first from the previous pass: alpha-beta cuts far more when the move
    // that was good last time is tried first
    const order = table.slice().sort((a, b) => b.score - a.score);
    const pass = [];
    let cut = false;

    for (const entry of order) {
      const next = game.apply(state, entry.move);
      // Full window at the root, on purpose. Narrowing it to `alpha` is the
      // textbook saving and it is wrong *here*, because this search does not
      // only want the best move — the level's slack picks among moves by
      // comparing their scores, and a fail-soft alpha-beta returns a **bound**
      // for everything that fails low, not a value. A losing move came back as
      // -5 instead of -1000000, landed inside the window, and the professional
      // played it. The root has a handful of moves and every ply below it still
      // prunes; the cost is small and the numbers mean what they say.
      const score = value(ctx, next, depth - 1, -Infinity, Infinity);
      if (ctx.stop) {
        cut = true;
        break;
      }
      pass.push({ move: entry.move, score });
    }

    if (cut) break;
    table = pass;
    reached = depth;
    // a forced win found: deeper is only going to find the same win later
    if (table.some((e) => e.score >= WIN - 200)) break;
    if (now() > deadline) break;
  }

  table.sort((a, b) => b.score - a.score);
  table.nodes = ctx.nodes;
  table.depth = reached;
  return table;
}

/**
 * Minimax with alpha-beta, written around `state.turn` instead of negamax's
 * sign flip. That is not stylistic: mancala hands the same player another move
 * when a stone lands in the store, and reversi hands the turn straight back
 * when the opponent has nowhere to go. Negamax assumes the side alternates
 * every ply; both of those quietly break it. Asking the state who is to move
 * costs one comparison and is right in every game on the table.
 */
function value(ctx, state, depth, alpha, beta) {
  const { game, me } = ctx;
  if ((++ctx.nodes & 1023) === 0 && now() > ctx.deadline) ctx.stop = true;
  if (ctx.stop) return 0;

  const over = game.result(state);
  if (over) return terminal(over, me, depth);
  if (depth <= 0) {
    return game.loud ? quiesce(ctx, state, alpha, beta, 4) : game.evaluate(state, me);
  }

  // The transposition table, with the bookkeeping that makes it safe.
  //
  // A stored score is only an exact value when the node was searched between
  // its full window. Anything that failed high or low is a **bound**, and a
  // bound reused as a value is not an optimisation, it is a lie: the first
  // version of this file stored bare numbers, and tic-tac-toe's professional
  // announced a forced win from a position where it was the one getting forked.
  // It had read a fail-low bound from a sibling with a different window and
  // believed it. Flags cost one field and one comparison.
  const alpha0 = alpha;
  const beta0 = beta;
  const key = ctx.tt ? game.key(state) : null;
  if (key) {
    const hit = ctx.tt.get(key);
    if (hit && hit.depth >= depth) {
      if (hit.flag === EXACT) return hit.value;
      if (hit.flag === LOWER && hit.value >= beta) return hit.value;
      if (hit.flag === UPPER && hit.value <= alpha) return hit.value;
    }
  }

  const moves = game.moves(state);
  if (!moves.length) return game.evaluate(state, me);

  const maximizing = state.turn === me;
  let best = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    const next = game.apply(state, move);
    const score = value(ctx, next, depth - 1, alpha, beta);
    if (ctx.stop) return best === Infinity || best === -Infinity ? 0 : best;
    if (maximizing) {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }

  // a value found after the clock ran out is a partial search; storing it would
  // poison every later probe of the same position
  if (key && !ctx.stop) {
    const flag = best <= alpha0 ? UPPER : best >= beta0 ? LOWER : EXACT;
    ctx.tt.set(key, { value: best, depth, flag });
  }
  return best;
}

const EXACT = 0;
const LOWER = 1;
const UPPER = 2;

/**
 * Captures only, past the depth limit. Without it a search stops mid-trade and
 * reports the board one capture into an exchange as a won pawn — the horizon
 * effect, and in chess it is the difference between an opponent that trades
 * pieces and one that hangs the queen every third move.
 */
function quiesce(ctx, state, alpha, beta, depth) {
  const { game, me } = ctx;
  const over = game.result(state);
  if (over) return terminal(over, me, 0);

  const stand = game.evaluate(state, me);
  if (depth <= 0) return stand;

  const maximizing = state.turn === me;
  if (maximizing) {
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
  } else {
    if (stand <= alpha) return stand;
    if (stand < beta) beta = stand;
  }

  const loud = game.loud(state);
  if (!loud.length) return stand;

  let best = stand;
  for (const move of loud) {
    if ((++ctx.nodes & 1023) === 0 && now() > ctx.deadline) ctx.stop = true;
    if (ctx.stop) return best;
    const score = quiesce(ctx, game.apply(state, move), alpha, beta, depth - 1);
    if (maximizing) {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * A finished game, scored from `me`'s side — and scored *sooner is better*, so
 * a mate in one beats a mate in three. Without the depth bonus a machine that
 * has found a forced win will happily shuffle pieces forever: every line wins,
 * so every line looks equal.
 */
function terminal(over, me, depth) {
  if (over.winner === null || over.winner === undefined) return 0;
  return over.winner === me ? WIN + depth : -WIN - depth;
}

/**
 * Which of the scored moves actually gets played.
 *
 * Everything within `slack` of the best is a candidate, and one of them is
 * drawn. That is the level's personality: at `pro` the window is zero and the
 * best move is played; at `easy` it is wider than a pawn, so the machine sees
 * the good move, shrugs, and plays a worse one — which is what a beginner looks
 * like from the other side of the board, and is far more pleasant to play than
 * a perfect opponent that has been lobotomised to depth 1.
 */
/**
 * The same four heads, for a game that brings its own evaluation.
 *
 * Ludo has four players and a die, which makes a minimax tree meaningless — it
 * scores its moves itself. What it must not do is invent its own idea of what
 * "easy" means: the levels have to feel like the same four opponents across the
 * whole cabinet. So it scores, and hands the list here.
 */
export function chooseScored(scored, level, rnd, opts = {}) {
  const p = { ...(PROFILE[level] || PROFILE.normal), ...opts };
  const roll = () => (rnd && rnd.mind ? rnd.mind.next() : Math.random());
  const list = scored.slice().sort((a, b) => b.score - a.score);
  if (!list.length) return null;
  if (p.blunder > 0 && roll() < p.blunder) {
    return list[Math.floor(roll() * list.length) % list.length].move;
  }
  const window = p.slack * (opts.unit || 100);
  if (window <= 0) return list[0].move;
  const pool = list.filter((e) => e.score >= list[0].score - window);
  return pool[Math.floor(roll() * pool.length) % pool.length].move;
}

function choose(scored, game, state, p, roll) {
  const top = scored[0];
  const ply = state.ply || 0;
  const slack = ply < p.openPlies ? Math.max(p.slack, p.openSlack) : p.slack;
  const window = slack * p.unit;

  // never fumble a win, at any level: a machine that finds mate and plays
  // something else reads as broken rather than as easy
  if (top.score >= WIN - 200 || window <= 0) return { move: top.move, score: top.score };

  const pool = scored.filter((e) => e.score >= top.score - window);
  const i = Math.floor(roll() * pool.length) % pool.length;
  return { move: pool[i].move, score: pool[i].score };
}

const now = typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now();

/**
 * The same move, without freezing the tab.
 *
 * The search itself is synchronous and the deepest iteration of a professional
 * chess position is a few hundred milliseconds of straight-line JavaScript —
 * long enough to eat frames. There is no worker to hand it to: a Blob worker is
 * blocked over `file://`, and this game has to open on a double click. So the
 * loop gives the browser a frame before it starts, which is what lets the HUD
 * paint "thinking…" *before* the wait rather than after it.
 */
export async function think(game, state, level, rnd, opts = {}) {
  // A frame, or a timer — whichever comes first. Waiting on the frame alone
  // hangs the machine's turn in a background tab, which gets no frames at all:
  // the player switches away mid-game, comes back, and it is still "thinking".
  const yieldFrame =
    opts.yieldFrame ||
    (() =>
      new Promise((resolve) => {
        let done = false;
        const once = () => {
          if (done) return;
          done = true;
          resolve();
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(once);
        setTimeout(once, 60);
      }));
  await yieldFrame();
  return bestMove(game, state, level, rnd, opts);
}
