import {
  COLS, ROWS, HIDDEN_ROWS, LOCK_DELAY, MAX_LOCK_RESETS, dropInterval, scoreForClear,
} from './config.js';
import { TYPES, createPiece, kicksFor, makeBag, makeRng, pieceCells } from './pieces.js';

export const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

export function isValid(board, piece) {
  for (const [x, y] of pieceCells(piece)) {
    if (x < 0 || x >= COLS || y >= ROWS) return false;
    if (y >= 0 && board[y][x]) return false;
  }
  return true;
}

export function fullRows(board) {
  const rows = [];
  for (let y = 0; y < board.length; y++) {
    if (board[y].every(Boolean)) rows.push(y);
  }
  return rows;
}

/** Removes rows in place and keeps the board's identity for console tooling. */
export function collapseRows(board, rows) {
  for (const y of [...rows].sort((a, b) => b - a)) {
    board.splice(y, 1);
  }
  // Add the replacement rows only after every old index has been consumed.
  // Unshifting inside the loop moves the remaining targets down and a four-row
  // blast ends up deleting alternating rows from the heap.
  for (let i = 0; i < rows.length; i++) board.unshift(Array(COLS).fill(null));
  return board;
}

export function ghostDistance(board, piece) {
  let distance = 0;
  while (isValid(board, { ...piece, y: piece.y + distance + 1 })) distance++;
  return distance;
}

export function createGame({ seed = 1, rng = null, onEvent = () => {} } = {}) {
  const random = rng || makeRng(seed);
  const game = {
    board: emptyBoard(),
    active: null,
    holdType: null,
    next: [],
    bag: [],
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    backToBack: false,
    canHold: true,
    phase: 'playing',
    elapsed: 0,
    dropClock: 0,
    lockClock: 0,
    lockResets: 0,
    softDropping: false,
    lastClear: null,
  };

  function emit(type, detail = {}) {
    onEvent({ type, ...detail, game });
  }

  function takeType() {
    if (!game.bag.length) game.bag.push(...makeBag(random));
    return game.bag.shift();
  }

  function fillQueue() {
    while (game.next.length < 5) game.next.push(takeType());
  }

  function finish() {
    if (game.phase === 'over') return;
    game.phase = 'over';
    emit('over', { score: game.score, lines: game.lines, level: game.level, elapsed: game.elapsed });
  }

  function spawn(type = null) {
    fillQueue();
    const nextType = type || game.next.shift();
    fillQueue();
    game.active = createPiece(nextType);
    game.dropClock = 0;
    game.lockClock = 0;
    game.lockResets = 0;
    if (!isValid(game.board, game.active)) finish();
    else emit('spawn', { piece: { ...game.active } });
    return game.active;
  }

  function grounded() {
    return !!game.active && !isValid(game.board, { ...game.active, y: game.active.y + 1 });
  }

  function resetLock() {
    if (!grounded()) {
      game.lockClock = 0;
      game.lockResets = 0;
    } else if (game.lockResets < MAX_LOCK_RESETS) {
      game.lockClock = 0;
      game.lockResets++;
    }
  }

  function move(dx) {
    if (game.phase !== 'playing' || !game.active) return false;
    const moved = { ...game.active, x: game.active.x + Math.sign(dx) };
    if (!isValid(game.board, moved)) return false;
    game.active = moved;
    resetLock();
    emit('move', { piece: { ...moved } });
    return true;
  }

  function stepDown(manual = false) {
    if (game.phase !== 'playing' || !game.active) return false;
    const moved = { ...game.active, y: game.active.y + 1 };
    if (!isValid(game.board, moved)) return false;
    game.active = moved;
    game.lockClock = 0;
    if (manual) game.score += 1;
    return true;
  }

  function rotate(direction = 1) {
    if (game.phase !== 'playing' || !game.active || game.active.type === 'O') return false;
    const rotation = (game.active.rotation + (direction < 0 ? 3 : 1)) % 4;
    for (const [dx, dy] of kicksFor(game.active.type)) {
      const turned = { ...game.active, rotation, x: game.active.x + dx, y: game.active.y + dy };
      if (!isValid(game.board, turned)) continue;
      game.active = turned;
      resetLock();
      emit('rotate', { piece: { ...turned } });
      return true;
    }
    return false;
  }

  function isPerfect() {
    return game.board.every((row) => row.every((cell) => !cell));
  }

  function lock() {
    if (game.phase !== 'playing' || !game.active) return false;
    const locked = pieceCells(game.active).map(([x, y]) => ({ x, y, type: game.active.type }));
    for (const cell of locked) {
      if (cell.y < 0) {
        finish();
        return false;
      }
      game.board[cell.y][cell.x] = cell.type;
    }
    emit('lock', { cells: locked, piece: { ...game.active } });

    const rows = fullRows(game.board);
    const clearedCells = rows.flatMap((y) => game.board[y].map((type, x) => ({ x, y, type })));
    if (rows.length) {
      collapseRows(game.board, rows);
      game.combo++;
      const wasBackToBack = game.backToBack;
      const perfect = isPerfect();
      const gained = scoreForClear(rows.length, game.level, game.combo, wasBackToBack, perfect);
      game.score += gained;
      game.lines += rows.length;
      const oldLevel = game.level;
      game.level = 1 + Math.floor(game.lines / 10);
      game.backToBack = rows.length === 4;
      game.lastClear = { count: rows.length, gained, combo: game.combo, backToBack: wasBackToBack, perfect };
      emit('clear', { rows, cells: clearedCells, ...game.lastClear });
      if (game.level > oldLevel) emit('level', { level: game.level });
    } else {
      game.combo = -1;
      game.lastClear = null;
    }

    game.canHold = true;
    spawn();
    return true;
  }

  function hardDrop() {
    if (game.phase !== 'playing' || !game.active) return 0;
    const distance = ghostDistance(game.board, game.active);
    game.active = { ...game.active, y: game.active.y + distance };
    game.score += distance * 2;
    emit('drop', { distance, piece: { ...game.active } });
    lock();
    return distance;
  }

  function hold() {
    if (game.phase !== 'playing' || !game.active || !game.canHold) return false;
    const current = game.active.type;
    const replacement = game.holdType;
    game.holdType = current;
    game.canHold = false;
    if (replacement) spawn(replacement);
    else spawn();
    emit('hold', { type: current, replacement });
    return game.phase === 'playing';
  }

  function togglePause(force = null) {
    if (game.phase === 'over') return false;
    const pause = force === null ? game.phase === 'playing' : !!force;
    game.phase = pause ? 'paused' : 'playing';
    emit(pause ? 'pause' : 'resume');
    return pause;
  }

  function tick(dt) {
    if (game.phase !== 'playing' || !game.active) return;
    const h = Math.max(0, Math.min(0.1, Number(dt) || 0));
    game.elapsed += h;
    game.dropClock += h;
    const interval = game.softDropping ? 0.035 : dropInterval(game.level);
    let falls = 0;
    while (game.dropClock >= interval && falls++ < 4) {
      game.dropClock -= interval;
      if (!stepDown(game.softDropping)) break;
    }

    if (grounded()) {
      game.lockClock += h;
      if (game.lockClock >= LOCK_DELAY) lock();
    } else {
      game.lockClock = 0;
    }
  }

  Object.assign(game, {
    move,
    stepDown,
    rotate,
    hardDrop,
    hold,
    lock,
    tick,
    togglePause,
    setSoftDrop(value) { game.softDropping = !!value; },
    ghost() { return game.active ? ghostDistance(game.board, game.active) : 0; },
    grounded,
  });

  fillQueue();
  spawn();
  return game;
}

export { TYPES, HIDDEN_ROWS };
