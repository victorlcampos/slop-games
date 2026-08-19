// The cabinet: which ten games are in it, and what each one is made of.
//
// A game here is three separate things bolted together, and keeping them
// separate is what makes the whole thing testable: `rules` is pure logic that
// runs in Node, `view` is the drawing, `seat` is what the player panel shows.
// The test suite imports the first and never touches the other two.

import { chess, inCheck } from './games/chess.js';
import { checkers } from './games/checkers.js';
import { reversi } from './games/reversi.js';
import { connect4 } from './games/connect4.js';
import { backgammon } from './games/backgammon.js';
import { ludo } from './games/ludo.js';
import { morris } from './games/morris.js';
import { mancala } from './games/mancala.js';
import { tictactoe } from './games/tictactoe.js';
import { sudoku } from './games/sudoku.js';

import { createChessView, chessSeat } from './views/chess.js';
import { createCheckersView, checkersSeat } from './views/checkers.js';
import { createReversiView, reversiSeat } from './views/reversi.js';
import { createConnect4View, connect4Seat } from './views/connect4.js';
import { createBackgammonView, backgammonSeat } from './views/backgammon.js';
import { createLudoView, ludoSeat } from './views/ludo.js';
import { createMorrisView, morrisSeat } from './views/morris.js';
import { createMancalaView, mancalaSeat } from './views/mancala.js';
import { createTicTacToeView, tictactoeSeat } from './views/tictactoe.js';
import { createSudokuView, sudokuSeat } from './views/sudoku.js';

import { PALETTES } from './theme.js';

/**
 * `sides` names what the two seats are called in this game — chess has white
 * and black, draughts has light and dark, and a game where the player simply
 * goes first or second says that instead. It is one phrase key per side, so
 * both languages come for free.
 */
export const GAMES = [
  {
    id: 'chess', emoji: '♟️', rules: chess, view: createChessView, seat: chessSeat,
    palettes: PALETTES.chess.pieces, sides: ['side.white', 'side.black'], flippable: true,
    // the one extra thing a game can ask the status bar to say for it
    check: inCheck,
  },
  {
    id: 'checkers', emoji: '🟤', rules: checkers, view: createCheckersView, seat: checkersSeat,
    palettes: PALETTES.checkers.pieces, sides: ['side.light', 'side.dark'], flippable: true,
  },
  {
    id: 'reversi', emoji: '⚫', rules: reversi, view: createReversiView, seat: reversiSeat,
    palettes: PALETTES.reversi.pieces, sides: ['side.dark', 'side.light'], flippable: false,
  },
  {
    id: 'connect4', emoji: '🔴', rules: connect4, view: createConnect4View, seat: connect4Seat,
    palettes: PALETTES.connect4.pieces, sides: ['side.first', 'side.second'], flippable: false,
  },
  {
    id: 'backgammon', emoji: '🎲', rules: backgammon, view: createBackgammonView, seat: backgammonSeat,
    palettes: PALETTES.backgammon.pieces, sides: ['side.light', 'side.dark'], flippable: false,
  },
  {
    id: 'ludo', emoji: '🎯', rules: ludo, view: createLudoView, seat: ludoSeat,
    palettes: PALETTES.ludo.colours, sides: ['side.red'], flippable: false, seats: 4,
  },
  {
    id: 'morris', emoji: '🔷', rules: morris, view: createMorrisView, seat: morrisSeat,
    palettes: PALETTES.morris.pieces, sides: ['side.light', 'side.dark'], flippable: false,
  },
  {
    id: 'mancala', emoji: '🫘', rules: mancala, view: createMancalaView, seat: mancalaSeat,
    palettes: [{ light: '#e8d5b0', base: '#c9a052', dark: '#7a5c22', edge: '#4a3712' },
               { light: '#a9603f', base: '#7a3a22', dark: '#4a2010', edge: '#2a1008' }],
    sides: ['side.first', 'side.second'], flippable: false,
  },
  {
    id: 'tictactoe', emoji: '⭕', rules: tictactoe, view: createTicTacToeView, seat: tictactoeSeat,
    palettes: [{ light: '#fffdf6', base: '#f4efe4', dark: '#cdc7b8', edge: '#8d8878' },
               { light: '#b6f0e0', base: '#7fd4c1', dark: '#3f9d89', edge: '#256b5c' }],
    sides: ['side.first', 'side.second'], flippable: false,
  },
  {
    id: 'sudoku', emoji: '🔢', rules: sudoku, view: createSudokuView, seat: sudokuSeat,
    palettes: [PALETTES.sudoku.paper], sides: [], flippable: false, solo: true,
  },
];

export const byId = (id) => GAMES.find((g) => g.id === id) || null;
