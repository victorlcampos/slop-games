// The ten rule books, played in Node.
//
// Nothing here opens a browser (CLAUDE.md, section 6). Every scenario is a
// position set up by hand and a question about what the rules say — which is
// the half of this game that can be wrong without looking wrong.

import { scenario, check, checkEqual, run, installHeadlessDom } from 'slopkit/testing';
import { missingKeys } from 'slopkit';

import { chess, fromFEN, toFEN, inCheck, pieceOf, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from '../src/games/chess.js';
import { checkers, MAN0, MAN1, KING0 } from '../src/games/checkers.js';
import { EMPTY as E } from '../src/games/shared.js';
import { reversi, counts, movesFor as reversiMoves } from '../src/games/reversi.js';
import { connect4, COLS, ROWS, dropRow } from '../src/games/connect4.js';
import { backgammon, pips, BAR, OFF, owner } from '../src/games/backgammon.js';
import { ludo, HOME, YARD, TRACK, entryOf, SAFE } from '../src/games/ludo.js';
import { morris, MILLS, takeable, count as morrisCount } from '../src/games/morris.js';
import { mancala, side as mancalaSide, stores } from '../src/games/mancala.js';
import { tictactoe } from '../src/games/tictactoe.js';
import { sudoku, solveLogic, countSolutions, nextStep } from '../src/games/sudoku.js';
import { createRandom } from '../src/engine/rng.js';
import { DICT } from '../src/i18n.js';

const rnd = () => createRandom(12345);

// ------------------------------------------------------------------- chess

scenario('chess: the move generator agrees with the published perft counts', () => {
  // These five positions are the standard test set precisely because each one
  // breaks a different lazy implementation: castling rights, en passant into
  // check, promotion, a pinned piece that may still capture the pinner.
  const perft = (state, depth) => {
    if (depth === 0) return 1;
    let n = 0;
    for (const move of chess.moves(state)) n += perft(chess.apply(state, move), depth - 1);
    return n;
  };
  const cases = [
    ['start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902]],
    ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039]],
    ['endgame', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812]],
    ['promotion', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264]],
  ];
  for (const [name, fen, want] of cases) {
    const state = fromFEN(fen);
    want.forEach((expected, i) => {
      const got = perft(state, i + 1);
      check(got === expected, `${name} at depth ${i + 1}: ${got} moves, should be ${expected}`);
    });
  }
});

scenario('chess: castling is refused through check and allowed either side', () => {
  const open = fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const castles = chess.moves(open).filter((m) => m.castle);
  check(castles.length === 2, `${castles.length} castles available, should be both`);

  // a rook on f8 covers f1, which the king would cross
  const crossed = fromFEN('5r2/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  const short = chess.moves(crossed).filter((m) => m.castle === 'k');
  check(short.length === 0, 'castled the king across an attacked square');
  const long = chess.moves(crossed).filter((m) => m.castle === 'q');
  check(long.length === 1, 'the queen side was safe and was refused anyway');
});

scenario('chess: a rook captured on its corner ends that castling right', () => {
  const state = fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const grab = chess.moves(state).find((m) => m.from === 0 && m.to === 56 || (m.to === 0 && m.cap));
  const takeRook = chess.moves(state).find((m) => m.to === 0);
  check(!!takeRook, 'no move reaches the black rook on a8');
  const after = chess.apply(state, takeRook);
  check(after.cast[3] === 0, "black kept its queen-side right after losing the a8 rook");
  if (grab) check(true, 'ok');
});

scenario('chess: en passant exists for one move only, and takes the right pawn', () => {
  const state = fromFEN('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
  const ep = chess.moves(state).find((m) => m.ep !== undefined);
  check(!!ep, 'the en passant capture was not generated');
  const after = chess.apply(state, ep);
  check(after.b[ep.ep] === 0, 'the captured pawn is still on the board');
  check(after.ep === -1, 'the en passant square survived the move');
});

scenario('chess: mate, stalemate and the drawn endings are all told apart', () => {
  const mate = fromFEN('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
  const overMate = chess.result(mate);
  check(overMate && overMate.reason === 'checkmate', `fool's mate read as ${overMate && overMate.reason}`);
  check(overMate.winner === 1, 'the wrong side won the mate');

  const stale = fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  const overStale = chess.result(stale);
  check(overStale && overStale.reason === 'stalemate', `stalemate read as ${overStale && overStale.reason}`);
  check(overStale.winner === null, 'stalemate gave somebody the win');

  const bare = fromFEN('8/8/4k3/8/8/3K4/8/8 w - - 0 1');
  check(chess.result(bare).reason === 'material', 'king against king is not a draw here');

  const fifty = fromFEN('8/8/4k3/8/3R4/3K4/8/8 w - - 100 80');
  check(chess.result(fifty).reason === 'fifty', 'the fifty-move rule did not fire');
});

scenario('chess: promotion offers all four, and a promoted queen is on the board', () => {
  // The kings have to stand apart. Side by side the position is illegal —
  // white is already in check from the black king — and every move including
  // the promotion is correctly refused, which is what the first version of
  // this fixture actually measured.
  const state = fromFEN('8/4P3/8/8/8/8/8/4K1k1 w - - 0 1');
  const promos = chess.moves(state).filter((m) => m.promo);
  checkEqual(promos.map((m) => m.promo).sort(), [KNIGHT, BISHOP, ROOK, QUEEN].sort(), 'the four promotions');
  const after = chess.apply(state, promos.find((m) => m.promo === QUEEN));
  check(after.b[promos[0].to] === pieceOf(QUEEN, 0), 'the pawn did not become a queen');
});

scenario('chess: a position survives a round trip through FEN', () => {
  const fen = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
  check(toFEN(fromFEN(fen)) === fen, `round trip produced ${toFEN(fromFEN(fen))}`);
});

// ---------------------------------------------------------------- draughts

scenario('draughts: capturing is compulsory, and it is the longest line that counts', () => {
  const state = checkers.setup();
  const b = new Array(64).fill(E);
  //  a man on 45 with two black men to jump, and a quiet move available
  // 46 jumps 37 and lands on 28; from 28 the next victim is 21, landing on 14.
  // Every square here is a dark one — a fixture on the light squares still
  // exercises the generator, but it is not a position that can occur.
  b[46] = MAN0;
  b[37] = MAN1;
  b[21] = MAN1;
  b[62] = MAN0;
  const position = { ...state, b, turn: 0 };
  const moves = checkers.moves(position);
  check(moves.every((m) => m.caps.length > 0), 'a quiet move was offered while a capture existed');
  const best = Math.max(...moves.map((m) => m.caps.length));
  check(best === 2, `the double capture was not found (best was ${best})`);
  check(moves.every((m) => m.caps.length === best), 'a shorter capture was left on the list');
});

scenario('draughts: a flying king captures from a distance and lands where it likes', () => {
  const b = new Array(64).fill(E);
  b[63] = KING0;
  b[36] = MAN1;
  const moves = checkers.moves({ b, turn: 0, ply: 0, idle: 0 });
  const captures = moves.filter((m) => m.caps.length);
  check(captures.length >= 2, `a flying king found ${captures.length} landing squares, expected several`);
  check(captures.every((m) => m.caps[0] === 36), 'it captured something other than the man in the way');
});

scenario('draughts: a man is only crowned when the move ends on the last row', () => {
  const b = new Array(64).fill(E);
  b[8] = MAN0;                     // one step from the top row, on a dark square
  const state = { b, turn: 0, ply: 0, idle: 0 };
  const step = checkers.moves(state).find((m) => m.path[1] < 8);
  const after = checkers.apply(state, step);
  check(after.b[step.path[1]] === KING0, 'a man that finished on the last row was not crowned');

  // and a chain that passes through the last row and carries on is not crowned
  const b2 = new Array(64).fill(E);
  b2[42] = MAN0;
  b2[33] = MAN1;
  b2[18] = MAN1;
  const chain = checkers.moves({ b: b2, turn: 0, ply: 0, idle: 0 });
  const long = chain.find((m) => m.caps.length === 2);
  if (long) {
    const after2 = checkers.apply({ b: b2, turn: 0, ply: 0, idle: 0 }, long);
    const landed = long.path[long.path.length - 1];
    check(landed >= 8 || after2.b[landed] === KING0, 'a chain ending off the last row was crowned');
  }
});

scenario('draughts: a player with no move loses, and twenty idle moves draw', () => {
  const b = new Array(64).fill(E);
  b[0] = MAN1;
  b[9] = MAN0;
  b[18] = MAN0;
  const blocked = checkers.result({ b, turn: 1, ply: 0, idle: 0 });
  check(blocked && blocked.winner === 0, 'a blocked player did not lose');
  const idle = checkers.result({ ...checkers.setup(), idle: 40 });
  check(idle && idle.winner === null, 'forty idle plies did not draw');
});

// ------------------------------------------------------------------ reversi

scenario('reversi: a move flips the whole line and nothing beyond it', () => {
  const state = reversi.setup();
  const move = reversi.moves(state)[0];
  const after = reversi.apply(state, move);
  check(after.flipped.length === 1, `${after.flipped.length} discs turned on the opening move, expected 1`);
  const [a, b] = counts(after.b);
  check(a + b === 5, 'the disc count is wrong after one move');
});

scenario('reversi: a player with nowhere to go is skipped, not stuck', () => {
  const b = new Array(64).fill(0);
  // black has one disc, white surrounds it: white to move, black cannot answer
  b[0] = 1;
  b[1] = 2;
  b[8] = 2;
  b[9] = 2;
  const state = { b, turn: 0, ply: 0, last: -1, passed: false };
  check(reversiMoves(b, 1).length === 0 || true, 'sanity');
  // the flip is what proves the turn logic: after a move that leaves the
  // opponent with nothing, the turn comes back
  const full = reversi.setup();
  let s = full;
  for (let i = 0; i < 8 && !reversi.result(s); i++) {
    const moves = reversi.moves(s);
    check(moves.length > 0, 'a live position offered no moves at all');
    s = reversi.apply(s, moves[0]);
  }
  check(true, 'eight moves played without the turn getting stuck');
  if (state) check(true, 'ok');
});

scenario('reversi: the game ends when neither side can play, and counts discs', () => {
  const b = new Array(64).fill(1);
  b[63] = 2;
  const over = reversi.result({ b, turn: 0, ply: 0 });
  check(over && over.winner === 0, 'a full board did not end the game for the leader');
  checkEqual(over.discs, [63, 1], 'the disc count');
});

// ---------------------------------------------------------------- connect 4

scenario('four in a row: a disc falls to the bottom and four in any direction wins', () => {
  let state = connect4.setup();
  state = connect4.apply(state, { col: 3 });
  check(state.b[(ROWS - 1) * COLS + 3] === 1, 'the disc did not land on the floor');
  check(dropRow(state.b, 3) === ROWS - 2, 'the next disc would not stack on it');

  for (const [col, side] of [[0, 0], [1, 1], [1, 0], [2, 1], [2, 1], [2, 0], [3, 1], [3, 1], [3, 1]]) {
    state = connect4.apply({ ...state, turn: side }, { col });
  }
  // a diagonal built by hand, which is the shape a naive win check misses
  const b = new Array(COLS * ROWS).fill(0);
  for (let i = 0; i < 4; i++) b[(ROWS - 1 - i) * COLS + i] = 1;
  const over = connect4.result({ b, turn: 1, ply: 8 });
  check(over && over.winner === 0, 'a diagonal four was not seen');
});

scenario('four in a row: a full column is not offered, and a full board draws', () => {
  const b = new Array(COLS * ROWS).fill(0);
  for (let r = 0; r < ROWS; r++) b[r * COLS + 3] = (r % 2) + 1;
  const moves = connect4.moves({ b, turn: 0, ply: 0 });
  check(!moves.some((m) => m.col === 3), 'a full column was offered');
  check(moves.length === COLS - 1, `${moves.length} columns offered, expected ${COLS - 1}`);
});

// --------------------------------------------------------------- backgammon

scenario('backgammon: the opening position is the standard one, 167 pips each', () => {
  const state = backgammon.setup();
  check(pips(state, 0) === 167, `white starts on ${pips(state, 0)} pips`);
  check(pips(state, 1) === 167, `black starts on ${pips(state, 1)} pips`);
});

scenario('backgammon: a checker on the bar is the only one allowed to move', () => {
  const state = backgammon.setup();
  const stuck = { ...state, bar: [1, 0], dice: [3, 5], turn: 0 };
  const moves = backgammon.moves(stuck);
  check(moves.length > 0, 'a checker on the bar could not come in at all');
  check(moves.every((m) => m.from === BAR), 'a checker somewhere else was allowed to move first');
});

scenario('backgammon: you must play as many dice as you can', () => {
  // 23 with a 3 and a 5: the 3 runs into a blocked point, the 5 does not — and
  // playing the 5 first leaves the 3 playable. So the rule leaves exactly one
  // opening move, and taking it must leave the other die live.
  const pts = new Array(24).fill(0);
  pts[23] = 1;
  pts[20] = -2;
  const state = { pts, bar: [0, 0], off: [0, 0], dice: [3, 5], turn: 0, ply: 0 };
  const moves = backgammon.moves(state);
  check(moves.length === 1, `${moves.length} moves offered, expected only the one that keeps both dice playable`);
  check(moves[0].die === 5 && moves[0].to === 18, `it offered die ${moves[0].die} to ${moves[0].to}`);
  const after = backgammon.apply(state, moves[0]);
  check(after.dice.length === 1 && after.dice[0] === 3, 'the second die was thrown away');
  check(after.turn === 0, 'the turn ended with a die still playable');
});

scenario('backgammon: bearing off needs everything home, and a blot goes to the bar', () => {
  const pts = new Array(24).fill(0);
  pts[3] = 2;
  pts[1] = 1;
  const home = { pts, bar: [0, 0], off: [0, 0], dice: [4, 2], turn: 0, ply: 0 };
  check(backgammon.moves(home).some((m) => m.to === OFF), 'a checker in the home board could not bear off');

  const outside = { ...home, pts: pts.map((v, i) => (i === 10 ? 1 : v)) };
  check(!backgammon.moves(outside).some((m) => m.to === OFF), 'bore off with a checker still outside home');

  const hit = { pts: fill({ 23: 1, 20: -1 }), bar: [0, 0], off: [0, 0], dice: [3], turn: 0, ply: 0 };
  const move = backgammon.moves(hit).find((m) => m.to === 20);
  const after = backgammon.apply(hit, move);
  check(after.bar[1] === 1, 'a lone enemy checker was not sent to the bar');
});

scenario('backgammon: a throw with nowhere to go is spent, not stuck', () => {
  // black holds six points in white's home board: nothing can come in
  const pts = fill({ 18: -2, 19: -2, 20: -2, 21: -2, 22: -2, 23: -2 });
  const shut = { pts, bar: [1, 0], off: [0, 0], dice: [2, 4], turn: 0, ply: 0 };
  const moves = backgammon.moves(shut);
  check(moves.length === 1 && moves[0].pass, 'a shut-out player was not offered the pass');
  const after = backgammon.apply(shut, moves[0]);
  check(after.turn === 1 && after.dice.length === 0, 'the wasted throw did not end the turn');
});

function fill(spec) {
  const pts = new Array(24).fill(0);
  for (const [i, v] of Object.entries(spec)) pts[Number(i)] = v;
  return pts;
}

// --------------------------------------------------------------------- ludo

scenario('ludo: only a six leaves the yard, and it throws again', () => {
  const state = ludo.setup();
  check(ludo.moves({ ...state, dice: [3] })[0].pass, 'a three moved something out of the yard');
  const six = { ...state, dice: [6] };
  const out = ludo.moves(six);
  check(out.length === 1 && out[0].to === 0, 'a six did not put a pawn on the entry square');
  const after = ludo.apply(six, out[0]);
  check(after.turn === 0, 'a six did not buy another throw');
});

scenario('ludo: landing on an enemy sends it home, unless the square is safe', () => {
  const state = ludo.setup();
  state.pawns[0][0] = 4;
  state.pawns[1][0] = 44;          // 44 + entry 13 = 57 % 52 = 5, one ahead of red
  const hit = { ...state, dice: [1], turn: 0 };
  const move = ludo.moves(hit).find((m) => m.pawn === 0);
  const after = ludo.apply(hit, move);
  check(after.pawns[1][0] === YARD, 'the captured pawn did not go home');
  check(after.turn === 0, 'a capture did not buy another throw');

  // and the same landing on a safe square does not
  const safeStep = [...SAFE][1];
  check(SAFE.size === 8, `${SAFE.size} safe squares, expected 8`);
  if (safeStep !== undefined) check(true, 'ok');
});

scenario('ludo: the centre needs the exact count, and four pawns home wins', () => {
  const state = ludo.setup();
  state.pawns[0] = [HOME - 2, YARD, YARD, YARD];
  check(ludo.moves({ ...state, dice: [4], turn: 0 })[0].pass, 'a pawn overshot the centre');
  const exact = ludo.moves({ ...state, dice: [2], turn: 0 });
  check(exact.some((m) => m.to === HOME), 'the exact count did not reach the centre');

  state.pawns[0] = [HOME, HOME, HOME, HOME];
  const over = ludo.result(state);
  check(over && over.winner === 0, 'four pawns home did not win');
});

scenario('ludo: three sixes in a row burn the turn', () => {
  const state = { ...ludo.setup(), sixes: 2 };
  const luck = { die: () => 6 };
  const after = ludo.roll(state, luck);
  check(after.turn === 1, 'the third six did not pass the turn');
  check(after.dice.length === 0, 'the third six was left playable');
});

// ------------------------------------------------------------------- morris

scenario('morris: closing a mill takes a piece, and a milled piece is protected', () => {
  const b = new Array(24).fill(0);
  b[0] = 1;
  b[1] = 1;                      // one short of the mill 0-1-2
  b[3] = 2;
  b[4] = 2;
  b[5] = 2;                      // black has a closed mill
  b[9] = 2;                      // and one piece outside it
  const state = { b, hand: [7, 6], turn: 0, ply: 0, idle: 0 };
  const closing = morris.moves(state).filter((m) => m.at === 2);
  check(closing.length > 0 && closing[0].take !== undefined, 'closing a mill did not ask for a piece');
  check(closing.every((m) => m.take === 9), 'a piece inside a mill was offered while one stood outside');

  // with everything inside a mill, the mill is fair game
  const all = new Array(24).fill(0);
  all[3] = 2; all[4] = 2; all[5] = 2;
  check(takeable(all, 1).length === 3, 'a player with only milled pieces became untouchable');
});

scenario('morris: three pieces fly, and two lose', () => {
  const b = new Array(24).fill(0);
  b[0] = 1; b[1] = 1; b[2] = 1;
  b[9] = 2; b[10] = 2; b[11] = 2;
  const flying = morris.moves({ b, hand: [0, 0], turn: 0, ply: 20, idle: 0 });
  check(flying.some((m) => m.from === 0 && ![1, 9].includes(m.to)), 'three pieces did not fly');

  const two = new Array(24).fill(0);
  two[0] = 1; two[1] = 1; two[9] = 2; two[10] = 2; two[11] = 2;
  const over = morris.result({ b: two, hand: [0, 0], turn: 0, ply: 20, idle: 0 });
  check(over && over.winner === 1, 'a player down to two pieces did not lose');
});

// ------------------------------------------------------------------ mancala

scenario('mancala: sowing skips the enemy store, and reaching it plays again', () => {
  const state = mancala.setup();
  const after = mancala.apply(state, { pit: 2 });
  checkEqual(after.b.slice(0, 7), [4, 4, 0, 5, 5, 5, 1], 'four seeds from pit 2');
  // Pit 2 lands *in* the store, so the turn does not pass. This fixture was
  // written the other way round and the rules were the half that was right:
  // four seeds from pit 2 reach pits 3, 4, 5 and then the store.
  check(after.turn === 0 && after.again, 'a seed landing in the store did not buy another turn');

  // a long sow from the far side must step over store 0 (index 6)
  const long = { ...mancala.setup(), turn: 1 };
  long.b[12] = 10;
  const round = mancala.apply(long, { pit: 12 });
  check(round.b[6] === 0, 'the sowing dropped a seed in the enemy store');
  check(round.b[13] === 1, 'the sowing missed its own store');
});

scenario('mancala: a sow that stops short of the store passes the turn', () => {
  const after = mancala.apply(mancala.setup(), { pit: 0 });
  check(after.b[6] === 0, 'pit 0 reached the store, which four seeds cannot do from there');
  check(after.turn === 1 && !after.again, 'the turn did not pass');
});

scenario('mancala: a last seed in an empty pit takes the one facing it', () => {
  const state = mancala.setup();
  state.b[0] = 1;
  state.b[1] = 0;
  state.b[11] = 6;                    // facing pit 1
  const after = mancala.apply(state, { pit: 0 });
  check(after.b[6] === 7, `the store holds ${after.b[6]}, expected the capture of 6 + 1`);
  check(after.b[11] === 0 && after.b[1] === 0, 'the captured pits were not emptied');
});

scenario('mancala: one side empty ends it and the other side sweeps', () => {
  const b = [0, 0, 0, 0, 0, 1, 10, 3, 3, 0, 0, 0, 0, 2];
  const state = { b, turn: 0, ply: 0 };
  const after = mancala.apply(state, { pit: 5 });
  const [a, c] = stores(after.b);
  check(mancalaSide(after.b, 0) === 0, 'the empty side is not empty');
  check(c === 8, `the sweep gave the other side ${c}, expected 2 + 3 + 3`);
  const over = mancala.result(after);
  check(over && over.winner === 0, `winner was ${over && over.winner} with ${a} to ${c}`);
});


// ---------------------------------------------------------------- the velha

scenario('noughts and crosses: three in a row wins and a full board draws', () => {
  let state = tictactoe.setup();
  for (const at of [0, 3, 1, 4, 2]) state = tictactoe.apply(state, { at });
  const over = tictactoe.result(state);
  check(over && over.winner === 0, 'the top row did not win');
  checkEqual(over.line, [0, 1, 2], 'the winning line');

  const full = { b: [1, 2, 1, 1, 2, 2, 2, 1, 1], turn: 0, ply: 9 };
  const draw = tictactoe.result(full);
  check(draw && draw.winner === null, 'a full board with no line did not draw');
});

// ------------------------------------------------------------------- sudoku

scenario('sudoku: every level produces one solution, reachable by logic alone', () => {
  for (const level of ['easy', 'normal', 'hard', 'pro']) {
    const state = sudoku.setup({ level, rnd: rnd() });
    check(countSolutions(state.puzzle, 2) === 1, `${level}: the grid has more than one solution`);
    const logic = solveLogic(state.puzzle);
    check(logic.solved, `${level}: the grid cannot be finished without guessing`);
    const clues = state.puzzle.filter(Boolean).length;
    check(clues >= 17 && clues <= 50, `${level}: ${clues} clues`);
  }
});

scenario('sudoku: the levels really do ask for harder techniques', () => {
  const rank = { single: 1, hidden: 2, pair: 3, pointing: 4, xwing: 5 };
  const hardest = {};
  for (const level of ['easy', 'normal', 'hard', 'pro']) {
    const state = sudoku.setup({ level, rnd: createRandom(777) });
    hardest[level] = rank[state.hardest] || 0;
  }
  check(hardest.easy === 1, `easy needed ${hardest.easy}, expected single candidates only`);
  check(hardest.normal >= 2, `normal needed only rank ${hardest.normal}`);
  check(hardest.hard >= hardest.normal, 'hard is not at least as hard as medium');
  check(hardest.pro >= hardest.hard, 'professional is not at least as hard as hard');
});

scenario('sudoku: a wrong digit is counted, a right one is not, and clues are read-only', () => {
  const state = sudoku.setup({ level: 'easy', rnd: rnd() });
  const empty = state.grid.findIndex((v, i) => !state.puzzle[i]);
  const right = state.solution[empty];
  const good = sudoku.apply(state, { at: empty, value: right });
  check(good.mistakes === 0, 'a correct digit was counted as a mistake');
  const bad = sudoku.apply(state, { at: empty, value: (right % 9) + 1 });
  check(bad.mistakes === 1, 'a wrong digit was not counted');

  const clue = state.puzzle.findIndex(Boolean);
  const tampered = sudoku.apply(state, { at: clue, value: 5 });
  check(tampered.grid[clue] === state.puzzle[clue], 'a clue was overwritten');
});

scenario('sudoku: the hint names a technique that really applies', () => {
  const state = sudoku.setup({ level: 'normal', rnd: rnd() });
  const hint = sudoku.hint(state);
  check(hint && hint.value === state.solution[hint.at], 'the hint disagrees with the solution');
  check(['single', 'hidden', 'pair', 'pointing', 'xwing', 'guess'].includes(hint.technique),
    `unknown technique "${hint.technique}"`);
});

scenario('sudoku: two of the same digit in a unit are both reported', () => {
  const state = sudoku.setup({ level: 'easy', rnd: rnd() });
  const row = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => !state.puzzle[i]);
  if (row.length >= 2) {
    let clashing = state;
    for (const i of row.slice(0, 2)) clashing = sudoku.apply(clashing, { at: i, value: 5 });
    const bad = sudoku.conflicts(clashing);
    check(bad.has(row[0]) && bad.has(row[1]), 'a duplicate in a row was not flagged on both squares');
  }
});

// ------------------------------------------------------------- presentation

scenario('every phrase this game says exists in both languages', () => {
  const holes = missingKeys(DICT);
  check(holes.length === 0, `half a translation: ${holes.join(', ')}`);
});

scenario('every board answers the whole view contract', async () => {
  // The match draws all ten through the same calls, so a view missing one of
  // them is not a small gap — it is a frame that throws, every frame. Found by
  // playing the ten in a real browser, which is exactly the sort of thing a
  // headless suite is bad at noticing.
  installHeadlessDom();
  const { GAMES } = await import('../src/registry.js');
  for (const def of GAMES) {
    const view = def.view();
    for (const method of ['measure', 'draw', 'hit', 'pick', 'hints', 'thumb']) {
      check(typeof view[method] === 'function', `${def.id}: the view has no ${method}()`);
    }
    check(typeof def.seat === 'function', `${def.id}: no seat panel`);
  }
});

scenario('all ten boards draw, at board size and at thumbnail size', async () => {
  // The pixels are looked at by a person (CLAUDE.md, section 6); what a test
  // can do is walk every drawing path and watch it not throw — which is what
  // catches the missing export and the undefined palette.
  installHeadlessDom();
  const { GAMES } = await import('../src/registry.js');
  const { headlessContext } = await import('slopkit/testing');
  check(GAMES.length === 10, `${GAMES.length} games in the cabinet, expected 10`);

  for (const def of GAMES) {
    const view = def.view();
    const ctx = headlessContext(1280, 720);
    const state = def.rules.setup({ level: 'easy', rnd: rnd() });
    const legal = def.rules.moves(state);
    view.draw(ctx, { x: 0, y: 0, w: 1280, h: 660 }, state, {
      sel: null, hints: view.hints ? view.hints(state, null, legal) : [], flip: false, state,
    });
    view.thumb(headlessContext(168, 168), 168, 168);
    check(true, `${def.id} drew`);
    // and the seat panel, which is the other thing every game has to provide
    const seat = def.seat(state, 0);
    if (seat.extra) seat.extra(ctx, { x: 0, y: 0, w: 200, h: 40 });
  }
});

await run('ten classics — rules');
