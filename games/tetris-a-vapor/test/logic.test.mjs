import { scenario, check, checkEqual, headlessContext, run } from 'slopkit/testing';
import { missingKeys } from 'slopkit/i18n';

import { COLS, H, ROWS, dropInterval, scoreForClear } from '../src/config.js';
import { createGame, emptyBoard, fullRows, ghostDistance, isValid } from '../src/game.js';
import { TYPES, createPiece, makeBag, makeRng, pieceCells } from '../src/pieces.js';
import { createFx } from '../src/fx.js';
import { dict } from '../src/i18n.js';
import { drawGame, layoutFor } from '../src/render.js';

scenario('every seven-bag contains every mould exactly once', () => {
  const rng = makeRng(6174);
  for (let round = 0; round < 20; round++) {
    const bag = makeBag(rng);
    check(bag.length === TYPES.length, `bag ${round} contains ${bag.length} pieces`);
    checkEqual([...bag].sort(), [...TYPES].sort(), `bag ${round} repeats or loses a mould`);
  }
});

scenario('all four faces of all seven pieces have four distinct cells', () => {
  for (const type of TYPES) {
    for (let rotation = 0; rotation < 4; rotation++) {
      const cells = pieceCells({ type, rotation, x: 0, y: 0 });
      check(cells.length === 4, `${type}${rotation} has ${cells.length} cells`);
      check(new Set(cells.map(([x, y]) => `${x}:${y}`)).size === 4, `${type}${rotation} overlaps itself`);
    }
  }
});

scenario('the walls and the heap stop a falling piece', () => {
  const board = emptyBoard();
  const piece = createPiece('T');
  piece.x = -1;
  check(!isValid(board, piece), 'a T with a cell through the left wall was accepted');
  piece.x = COLS - 2;
  check(!isValid(board, piece), 'a T with a cell through the right wall was accepted');
  piece.x = 3;
  board[1][4] = 'O';
  check(!isValid(board, piece), 'a T was allowed through a brass block');
});

scenario('rotation kicks a piece away from the wall', () => {
  const game = createGame({ seed: 9 });
  game.active = { type: 'T', rotation: 1, x: -1, y: 5 };
  check(isValid(game.board, game.active), 'the wall-kick setup is already invalid');
  check(game.rotate(1), 'the T refused a rotation that has a free kick');
  check(game.active.rotation === 2, `rotation ended on face ${game.active.rotation}`);
  check(game.active.x === 0, `the kick left the T at x=${game.active.x}`);
});

scenario('the ghost lands on the first solid surface', () => {
  const board = emptyBoard();
  board[20][4] = 'J';
  const piece = { type: 'O', rotation: 0, x: 3, y: 0 };
  const distance = ghostDistance(board, piece);
  check(distance === 18, `the O ghost travelled ${distance} rows instead of 18`);
  const landed = { ...piece, y: piece.y + distance };
  check(isValid(board, landed), 'the ghost ended inside the heap');
  check(!isValid(board, { ...landed, y: landed.y + 1 }), 'the ghost stopped above empty air');
});

scenario('hold banks one mould and cannot be spent twice before a lock', () => {
  const game = createGame({ seed: 4 });
  const first = game.active.type;
  const second = game.next[0];
  check(game.hold(), 'the first hold was refused');
  check(game.holdType === first, `hold contains ${game.holdType}, not ${first}`);
  check(game.active.type === second, `the queue produced ${game.active.type}, not ${second}`);
  const heldActive = game.active.type;
  check(!game.hold(), 'hold was accepted twice for the same falling piece');
  check(game.active.type === heldActive, 'the refused hold still changed the active mould');
  game.hardDrop();
  check(game.canHold, 'locking a piece did not reopen the pressure chamber');
});

scenario('a four-row blast scores a Tetris and empties a perfect boiler', () => {
  const events = [];
  const game = createGame({ seed: 12, onEvent: (event) => events.push(event) });
  for (let y = ROWS - 4; y < ROWS; y++) {
    for (let x = 0; x < COLS - 1; x++) game.board[y][x] = TYPES[(x + y) % TYPES.length];
  }
  game.active = { type: 'I', rotation: 1, x: 7, y: ROWS - 4 };
  game.lock();
  check(game.lines === 4, `the blast cleared ${game.lines} rows`);
  check(game.board.every((row) => row.every((cell) => !cell)), 'the perfect boiler still contains blocks');
  check(game.score === scoreForClear(4, 1, 0, false, true), `the perfect Tetris scored ${game.score}`);
  const blast = events.find((event) => event.type === 'clear');
  check(blast && blast.count === 4, 'the renderer received no four-row blast');
  check(blast.cells.length === 40, `the blast carried ${blast.cells.length} cells instead of 40`);
  check(blast.perfect, 'the clear did not say the boiler was empty');
});

scenario('ten vented rows raise the pressure level', () => {
  const events = [];
  const game = createGame({ seed: 22, onEvent: (event) => events.push(event) });
  game.lines = 8;
  for (let y = ROWS - 2; y < ROWS; y++) {
    for (let x = 0; x < COLS - 2; x++) game.board[y][x] = 'J';
  }
  game.active = { type: 'O', rotation: 0, x: 7, y: ROWS - 2 };
  game.lock();
  check(game.lines === 10, `two rows took the total to ${game.lines}`);
  check(game.level === 2, `ten rows left pressure at ${game.level}`);
  check(events.some((event) => event.type === 'level' && event.level === 2), 'the pressure gauge received no level event');
  check(dropInterval(2) < dropInterval(1), 'the second pressure level does not fall faster');
});

scenario('gravity advances in fixed steps and the lock delay settles the piece', () => {
  const game = createGame({ seed: 2 });
  const startY = game.active.y;
  for (let i = 0; i < 60; i++) game.tick(1 / 60);
  check(game.active.y > startY, `one second of gravity left the piece at y=${game.active.y}`);

  game.active = { type: 'O', rotation: 0, x: 3, y: ROWS - 2 };
  const type = game.active.type;
  for (let i = 0; i < 31; i++) game.tick(1 / 60);
  check(game.board[ROWS - 1].includes(type), 'the grounded O did not lock after the delay');
  check(game.active.type !== null, 'locking did not feed the next mould');
});

scenario('a blocked mouth ends the shift', () => {
  let over = null;
  const game = createGame({ seed: 7, onEvent: (event) => { if (event.type === 'over') over = event; } });
  for (let y = 0; y < 4; y++) {
    for (let x = 3; x <= 6; x++) game.board[y][x] = 'Z';
  }
  game.active = { type: 'O', rotation: 0, x: 3, y: ROWS - 2 };
  game.lock();
  check(game.phase === 'over', `a blocked spawn left the game ${game.phase}`);
  check(over && over.score === game.score, 'the shift ended without its result event');
});

scenario('combo and back-to-back rewards come from the published scoring rules', () => {
  const plain = scoreForClear(4, 3, 0, false, false);
  const chained = scoreForClear(4, 3, 2, true, false);
  check(plain === 2400, `a level-three Tetris scored ${plain}`);
  check(chained === 3900, `the back-to-back combo scored ${chained}`);
  check(scoreForClear(1, 3, 0, false, false) === 300, 'a level-three single lost the level multiplier');
});

scenario('the layout keeps all twenty rows on phone and desktop widths', () => {
  for (const width of [430, 760, 1000, 1600]) {
    const layout = layoutFor(width);
    check(layout.x >= 0, `${width}px puts the board through the left edge`);
    check(layout.x + layout.boardW <= width, `${width}px puts the board through the right edge`);
    check(layout.y >= 0 && layout.y + layout.boardH < H, `${width}px clips the twenty-row board vertically`);
    check(Math.abs(layout.boardH / layout.cell - 20) < 0.001, `${width}px draws ${layout.boardH / layout.cell} rows`);
  }
});

scenario('the complete foundry scene draws with particles in both layouts', () => {
  const game = createGame({ seed: 31 });
  const fx = createFx(() => 0.5);
  const cells = Array.from({ length: 10 }, (_, x) => ({ x, y: ROWS - 1, type: TYPES[x % TYPES.length] }));
  fx.handle({ type: 'clear', count: 1, rows: [ROWS - 1], cells, perfect: false });
  check(fx.particles.length >= 70, `the blast made only ${fx.particles.length} particles`);
  for (const width of [430, 1000]) {
    const ctx = headlessContext(width, H);
    drawGame(ctx, game, width, fx, 1.25);
  }
  for (let i = 0; i < 120; i++) fx.update(1 / 60);
  check(fx.particles.length === 0, `${fx.particles.length} dead particles stayed in the boiler`);
});

scenario('every player-facing phrase exists in English and Portuguese', () => {
  const missing = missingKeys(dict);
  check(missing.length === 0, `missing translations: ${missing.join(', ')}`);
});

scenario('the row detector returns the actual pressure rows', () => {
  const board = emptyBoard();
  board[5].fill('T');
  board[ROWS - 1].fill('L');
  checkEqual(fullRows(board), [5, ROWS - 1], 'the detector returned the wrong rows');
});

await run('Steam Stack');
