// The opponent, and the promise printed on the difficulty screen.
//
// Two things are under test here and only one of them is "is it any good".
//
// The other is the promise: **the level changes the machine's head and never
// the player's luck.** That is easy to say and easy to break by accident — the
// first version of this cabinet had one random generator, and a professional
// search that sampled a hundred numbers while it thought left the next throw a
// hundred draws down the stream. Same seed, same board, different dice. The
// scenarios below would have caught it, and they are the reason engine/rng.js
// hands out two streams instead of one.

import { scenario, check, run } from 'slopkit/testing';
import { bestMove, profileFor, LEVELS, PROFILE } from '../src/engine/ai.js';
import { createRandom } from '../src/engine/rng.js';

import { chess, fromFEN } from '../src/games/chess.js';
import { checkers, MAN0, MAN1 } from '../src/games/checkers.js';
import { reversi } from '../src/games/reversi.js';
import { connect4, COLS, ROWS } from '../src/games/connect4.js';
import { backgammon } from '../src/games/backgammon.js';
import { ludo, HOME, YARD } from '../src/games/ludo.js';
import { morris } from '../src/games/morris.js';
import { mancala } from '../src/games/mancala.js';
import { tictactoe } from '../src/games/tictactoe.js';
import { sudoku } from '../src/games/sudoku.js';
import { EMPTY } from '../src/games/shared.js';

/**
 * Play a whole game between two levels and say who won.
 *
 * `depth` is here because a millisecond budget is not reproducible. The search
 * deepens until the clock runs out, so how strong a level plays inside 40 ms
 * depends on what else the machine is doing — and a scenario that compares two
 * levels then fails on a busy laptop and passes on an idle one. Handing it a
 * depth instead makes the same duel come out the same way every time; `ms:
 * Infinity` takes the clock out of it entirely.
 */
function duel(game, levels, { seed = 7, ms = 60, depth, cap = 800 } = {}) {
  const rnd = createRandom(seed);
  let state = game.setup({ rnd });
  let guard = 0;
  while (!game.result(state) && guard++ < cap) {
    if (game.needsRoll && game.needsRoll(state)) {
      state = game.roll(state, rnd.luck);
      continue;
    }
    const { move } = bestMove(game, state, levels[state.turn], rnd, { ms, depth });
    if (!move) break;
    state = game.apply(state, move);
  }
  const over = game.result(state);
  return { winner: over ? over.winner : undefined, plies: state.ply || 0, state };
}

/** A short series, because one game of anything proves nothing. */
function series(game, levels, games = 6, opts = {}) {
  const tally = { 0: 0, 1: 0, draw: 0 };
  for (let i = 0; i < games; i++) {
    const { winner } = duel(game, levels, { ...opts, seed: 31 + i * 97 });
    if (winner === null || winner === undefined) tally.draw++;
    else tally[winner]++;
  }
  return tally;
}

// ------------------------------------------------- the promise, four ways

scenario('the dice do not know what level is playing', () => {
  // The same seed, the same throws — whoever is sitting opposite. The AI reads
  // `mind`, the dice read `luck`, and this is the scenario that says so.
  const reference = [];
  for (const level of LEVELS) {
    const rnd = createRandom(4242);
    let state = backgammon.setup();
    const thrown = [];
    for (let turn = 0; turn < 14; turn++) {
      state = backgammon.roll(state, rnd.luck);
      thrown.push(state.rolled.join(''));
      // and the machine thinks between throws, drawing however much it likes
      let guard = 0;
      while (state.dice.length && guard++ < 8) {
        const { move } = bestMove(backgammon, state, level, rnd, { ms: 25 });
        if (!move) break;
        state = backgammon.apply(state, move);
      }
    }
    reference.push(thrown.join(' '));
  }
  const [easy, ...rest] = reference;
  for (let i = 0; i < rest.length; i++) {
    check(rest[i] === easy,
      `${LEVELS[i + 1]} was thrown different dice from easy on the same seed:\n     easy: ${easy}\n     ${LEVELS[i + 1]}: ${rest[i]}`);
  }
});

scenario('the same is true of ludo, where a six is worth the most', () => {
  const rolls = LEVELS.map((level) => {
    const rnd = createRandom(909);
    let state = ludo.setup();
    const thrown = [];
    for (let turn = 0; turn < 40; turn++) {
      if (ludo.needsRoll(state)) {
        state = ludo.roll(state, rnd.luck);
        if (state.rolled) thrown.push(state.rolled);
        continue;
      }
      const { move } = bestMove(ludo, state, level, rnd);
      if (!move) break;
      state = ludo.apply(state, move);
    }
    return thrown.join(',');
  });
  check(new Set(rolls).size === 1, `four levels, ${new Set(rolls).size} different sequences of throws`);
  const sixes = rolls[0].split(',').filter((d) => d === '6').length;
  check(sixes > 0, 'no six in forty throws — the fixture is not exercising anything');
});

scenario('the search cannot reach the luck stream even if it wants to', () => {
  // Structural, not statistical: the die is booby-trapped, and any level that
  // touches it while thinking fails here rather than in a player's game.
  for (const level of LEVELS) {
    const rnd = createRandom(31337);
    let state = backgammon.roll(backgammon.setup(), rnd.luck);
    const armed = {
      ...rnd,
      luck: new Proxy(rnd.luck, {
        get() {
          throw new Error(`the ${level} search read the luck stream`);
        },
      }),
    };
    for (let i = 0; i < 4 && state.dice.length; i++) {
      const { move } = bestMove(backgammon, state, level, armed, { ms: 25 });
      if (!move) break;
      state = backgammon.apply(state, move);
    }
    check(true, `${level} thought without touching the dice`);
  }
});

scenario("sudoku's levels change the technique, not how the grid is dealt", () => {
  // The generator is deterministic — same level, same seed, same grid — and
  // the levels differ in what they *demand*, not in how generous the deal is.
  //
  // The completed grid behind the puzzle is deliberately *not* compared across
  // levels: a hard grid is carved by trying several layouts and keeping the
  // one that needs the technique, so it draws more numbers than an easy one
  // and lands on a different grid. That is the search doing its job, and it
  // gives nobody an advantage — every level ends up with exactly one solution
  // reachable by logic, which is what test/rules.test.mjs checks.
  for (const level of LEVELS) {
    const a = sudoku.setup({ level, rnd: createRandom(20250819) });
    const b = sudoku.setup({ level, rnd: createRandom(20250819) });
    check(a.puzzle.join('') === b.puzzle.join(''), `${level}: the same seed produced two different grids`);
  }
  const clues = LEVELS.map((level) => sudoku.setup({ level, rnd: createRandom(4321) }).puzzle.filter(Boolean).length);
  check(clues[0] > clues[3], `easy gives ${clues[0]} clues and professional ${clues[3]} — the harder grid should give less away`);
  check(clues[0] >= clues[1], `easy (${clues[0]}) gives fewer clues than medium (${clues[1]})`);
});

// --------------------------------------------------------- the four heads

scenario('the levels are ordered: deeper, longer, and less willing to be wrong', () => {
  for (let i = 1; i < LEVELS.length; i++) {
    const under = PROFILE[LEVELS[i - 1]];
    const over = PROFILE[LEVELS[i]];
    check(over.depth >= under.depth, `${LEVELS[i]} looks less far ahead than ${LEVELS[i - 1]}`);
    check(over.slack <= under.slack, `${LEVELS[i]} is more willing to play a worse move than ${LEVELS[i - 1]}`);
    check(over.blunder <= under.blunder, `${LEVELS[i]} blunders more often than ${LEVELS[i - 1]}`);
  }
  check(PROFILE.pro.blunder === 0 && PROFILE.pro.slack === 0, 'the professional is allowed to throw a game away');
});

scenario('each game can tune the levels, and the tuning is still ordered', () => {
  for (const game of [chess, checkers, reversi, connect4, morris, mancala, tictactoe, backgammon]) {
    let previous = null;
    for (const level of LEVELS) {
      const p = profileFor(game, level);
      check(p.depth > 0 && p.ms > 0, `${game.id}: ${level} has no budget at all`);
      if (previous) check(p.depth >= previous.depth, `${game.id}: ${level} is shallower than the level below it`);
      previous = p;
    }
  }
});

// ------------------------------------------- does it actually play well?

scenario('noughts and crosses: the professional cannot be beaten', () => {
  // A solved game, so this is not a matter of degree: perfect play never loses,
  // from either seat, and two perfect players always draw.
  const asFirst = series(tictactoe, ['pro', 'easy'], 6);
  check(asFirst[1] === 0, `the professional lost ${asFirst[1]} games playing first`);
  const asSecond = series(tictactoe, ['easy', 'pro'], 6);
  check(asSecond[0] === 0, `the professional lost ${asSecond[0]} games playing second`);
  const both = series(tictactoe, ['pro', 'pro'], 3);
  check(both.draw === 3, `two professionals produced ${both[0] + both[1]} decisive games`);
});

scenario('the professional beats the beginner, at every game on the table', () => {
  // Short and cheap on purpose: the whole suite has to stay in the seconds
  // (CLAUDE.md, section 6), and a professional that needs twenty games to show
  // up against a beginner is not a professional.
  const table = [
    ['draughts', checkers, 1, 20],
    ['reversi', reversi, 1, 20],
    ['four in a row', connect4, 2, 25],
    ['morris', morris, 2, 20],
    ['mancala', mancala, 2, 20],
    ['backgammon', backgammon, 3, 25],
  ];
  for (const [name, game, games, ms] of table) {
    const first = series(game, ['pro', 'easy'], games, { ms });
    const second = series(game, ['easy', 'pro'], games, { ms });
    const wins = first[0] + second[1];
    const losses = first[1] + second[0];
    check(wins > losses,
      `${name}: the professional won ${wins} and lost ${losses} of ${games * 2} against the beginner`);
  }
});

scenario('chess: the deeper levels do not walk into mate in one', () => {
  // The back rank. White is fine as long as the rook stays on it or a pawn
  // makes room for the king; almost anything else loses to Qd1#. Seeing that
  // needs three plies — move, reply, mate — so it is exactly the line between
  // the two shallow levels and the two deep ones.
  //
  // Measured by result rather than by the move chosen: there are several safe
  // moves and naming one of them would be testing this fixture's taste.
  const state = fromFEN('3q2k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
  const losesToMateInOne = (after) =>
    chess.moves(after).some((reply) => {
      const over = chess.result(chess.apply(after, reply));
      return over && over.reason === 'checkmate' && over.winner === 1;
    });

  for (const level of ['hard', 'pro']) {
    const { move } = bestMove(chess, state, level, createRandom(17), { ms: 600 });
    check(!losesToMateInOne(chess.apply(state, move)),
      `${level} played ${move.from}->${move.to} and allowed mate in one`);
  }
  // and the shallow end is allowed to fall for it — that is what easy is
  check(true, 'the two deep levels saw three plies ahead');
});

scenario('chess: it wins a piece that is there to be won', () => {
  // A queen hanging on d5 with nothing defending it. Every level should take
  // it: seeing a free piece is one ply, and the slack that makes easy play a
  // worse move is measured in pawns, not queens.
  const state = fromFEN('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1');
  for (const level of LEVELS) {
    const { move } = bestMove(chess, state, level, createRandom(23), { ms: 200 });
    check(move.to === 27, `${level} left a free queen on the board (played to ${move.to})`);
  }
});

scenario('ludo: thinking beats not thinking, over a table of four', () => {
  // The one game here decided partly by the die, so it is measured over a
  // series: a professional in a field of beginners should win far more than
  // the one in four that luck alone would give it.
  let wins = 0;
  const games = 16;
  for (let i = 0; i < games; i++) {
    const rnd = createRandom(500 + i * 313);
    let state = ludo.setup();
    let guard = 0;
    while (!ludo.result(state) && guard++ < 3000) {
      if (ludo.needsRoll(state)) {
        state = ludo.roll(state, rnd.luck);
        continue;
      }
      const level = state.turn === 0 ? 'pro' : 'easy';
      const { move } = bestMove(ludo, state, level, rnd);
      if (!move) break;
      state = ludo.apply(state, move);
    }
    const over = ludo.result(state);
    if (over && over.winner === 0) wins++;
  }
  check(wins > games / 4, `the professional won ${wins} of ${games}; chance alone would give it ${games / 4}`);
});

// --------------------------------------------------- and the tactics it sees

scenario('chess: it finds mate in one, at every level', () => {
  // Back-rank mate: Ra8#. Even the easy opponent is not allowed to miss a win
  // it has already found — see `choose` in engine/ai.js.
  const state = fromFEN('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
  for (const level of LEVELS) {
    const { move } = bestMove(chess, state, level, createRandom(5), { ms: 400 });
    const after = chess.apply(state, move);
    const over = chess.result(after);
    check(over && over.reason === 'checkmate', `${level} played ${move.from}->${move.to} instead of mate in one`);
  }
});

scenario('four in a row: hard and above block a three that is about to be four', () => {
  const b = new Array(COLS * ROWS).fill(EMPTY);
  const put = (col, row, side) => (b[row * COLS + col] = side + 1);
  // Player 0 has three across the floor with **one** end open, and it is 1 to
  // move. With both ends open the position is already lost — every reply
  // fails, so a machine playing anywhere is not making a mistake, and the
  // first version of this scenario was measuring nothing.
  put(0, ROWS - 1, 1);
  put(1, ROWS - 1, 0);
  put(2, ROWS - 1, 0);
  put(3, ROWS - 1, 0);
  put(1, ROWS - 2, 1);
  put(2, ROWS - 2, 1);
  const state = { b, turn: 1, ply: 5, last: -1 };
  for (const level of ['hard', 'pro']) {
    const { move } = bestMove(connect4, state, level, createRandom(11), { ms: 300 });
    check(move.col === 4, `${level} answered a three-in-a-row with column ${move.col} instead of the only block`);
  }
});

scenario('draughts: it takes the line that captures the most', () => {
  const b = new Array(64).fill(EMPTY);
  b[46] = MAN0;
  b[37] = MAN1;
  b[21] = MAN1;
  b[54] = MAN0;
  const state = { b, turn: 0, ply: 0, idle: 0, last: null };
  for (const level of LEVELS) {
    const { move } = bestMove(checkers, state, level, createRandom(3), { ms: 200 });
    check(move.caps.length === 2, `${level} took ${move.caps.length} pieces when two were on offer`);
  }
});

scenario('reversi: the professional takes a corner and does not give one away', () => {
  const state = reversi.setup();
  let s = state;
  const rnd = createRandom(99);
  // play a while, then check the corner is not handed over on a plate
  for (let i = 0; i < 14 && !reversi.result(s); i++) {
    const { move } = bestMove(reversi, s, 'pro', rnd, { ms: 60 });
    if (!move) break;
    s = reversi.apply(s, move);
  }
  const corners = [0, 7, 56, 63].filter((i) => s.b[i]).length;
  check(corners <= 1, `${corners} corners were taken inside fourteen moves; the professional is giving them away`);
});

scenario('mancala: it takes the free extra turn when one is there', () => {
  const b = new Array(14).fill(0);
  b[2] = 4;                  // lands in the store: another turn
  b[0] = 1;
  b[7] = 3;
  const state = { b, turn: 0, ply: 0, last: null, again: false };
  const { move } = bestMove(mancala, state, 'pro', createRandom(2), { ms: 200 });
  const after = mancala.apply(state, move);
  check(after.turn === 0, `the professional gave up a free turn (played pit ${move.pit})`);
});

scenario('backgammon: it comes in off the bar before doing anything else', () => {
  const state = backgammon.setup();
  const stuck = { ...state, bar: [1, 0], dice: [2, 4], turn: 0 };
  for (const level of LEVELS) {
    const { move } = bestMove(backgammon, stuck, level, createRandom(6), { ms: 100 });
    check(move.from === -1, `${level} moved something else with a checker on the bar`);
  }
});

scenario('a depth ceiling caps the search without lifting the level under it', () => {
  const state = checkers.setup({ rnd: createRandom(11) });

  const capped = bestMove(checkers, state, 'pro', createRandom(11), { ms: Infinity, depth: 3 });
  check(capped.depth <= 3, `the professional reached depth ${capped.depth} under a ceiling of 3`);

  // A ceiling, never a floor. Asking for 5 must not promote the beginner off
  // its own depth-1 search — otherwise the scenario below would be measuring a
  // beginner that does not exist on the difficulty screen.
  const beginner = bestMove(checkers, state, 'easy', createRandom(11), { ms: Infinity, depth: 5 });
  check(beginner.depth <= PROFILE.easy.depth,
    `the beginner reached depth ${beginner.depth}, past the ${PROFILE.easy.depth} its own profile allows`);
});

scenario('easy really is easy: it hands over material a professional never would', () => {
  // The measurable difference between the two ends of the dial, on the same
  // opponent: how much wood is left standing after twenty plies of draughts.
  //
  // Bounded by depth, not by a 40 ms clock. With the clock this was the one
  // flaky scenario in the repository — roughly one run in five, and on the
  // publish gate too: under load the professional got through fewer plies of
  // search than the seed suggested, played worse than the beginner, and the
  // comparison inverted. Depth 5 is a ceiling, so the beginner keeps the
  // depth-1 search that is most of what makes it a beginner.
  const left = (level) => {
    const { state } = duel(checkers, [level, 'hard'], { seed: 4, ms: Infinity, depth: 5, cap: 24 });
    let mine = 0;
    for (const v of state.b) if (v === MAN0 || v === 3) mine++;
    return mine;
  };
  const beginner = left('easy');
  const professional = left('pro');
  check(professional >= beginner,
    `after twenty plies the beginner still had ${beginner} pieces and the professional ${professional}`);
});

await run('ten classics — the opponent');
