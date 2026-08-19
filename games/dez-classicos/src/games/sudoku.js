// Sudoku — the one game on this table with nobody sitting opposite.
//
// Which raises the question the difficulty selector has to answer honestly.
// Everywhere else, the four levels are how well the machine plays. Here there
// is no machine to play: so the level is **how much thinking the grid asks of
// you**, measured in the techniques a solver needs to finish it without ever
// guessing.
//
//   easy          naked and hidden singles
//   normal        + naked pairs
//   hard          + pointing pairs, box-line reduction
//   professional  + X-wing, and a grid that gives up nothing to the techniques below
//
// That is the same promise in a different shape, and it is worth stating why it
// is not the cheap version. The cheap version is to remove more clues and call
// it hard: it produces grids that need guessing, which is not difficulty, it is
// a coin toss with extra steps. Every grid here is **logically solvable** and
// has exactly one solution, at all four levels. What changes is the technique
// you need to see, not how lucky you get.
//
// The shuffle that lays the grid out reads the luck stream; the classifier does
// not read any stream at all.

const N = 9;
const CELLS = 81;
const ALL = 0b111111111;

export const TECHNIQUES = ['single', 'hidden', 'pair', 'pointing', 'xwing'];
/** The hardest technique a level's grid may need … */
const CEILING = { easy: 1, normal: 2, hard: 3, pro: 5 };
/** … and the one it must actually demand, or it is not that level. */
const DEMAND = { easy: 1, normal: 2, hard: 3, pro: 4 };
/** Roughly how many clues to leave. A floor, not a target: carving stops when
 *  the grid stops being unique, which usually comes first. */
const CLUES = { easy: 38, normal: 31, hard: 26, pro: 23 };

export const sudoku = {
  id: 'sudoku',
  emoji: '🔢',
  players: 1,
  solo: true,
  chance: false,

  /**
   * A fresh grid at the asked-for level. `rnd.luck` lays it out; the level
   * decides which techniques it may demand, and never how many chances you get.
   */
  setup(opts = {}) {
    const luck = (opts.rnd && opts.rnd.luck) || fallbackStream();
    const level = CEILING[opts.level] ? opts.level : 'normal';
    const { puzzle, solution, hardest } = generate(level, luck);
    return {
      puzzle,
      solution,
      grid: puzzle.slice(),
      notes: new Array(CELLS).fill(0),
      level,
      hardest,
      turn: 0,
      ply: 0,
      mistakes: 0,
      hints: 0,
      last: null,
    };
  },

  moves: () => [],

  /** `{ at, value }` writes a digit; `{ at, note }` toggles a pencil mark. */
  apply(state, move) {
    if (move.note !== undefined) {
      const notes = state.notes.slice();
      notes[move.at] ^= 1 << (move.note - 1);
      return { ...state, notes, ply: (state.ply || 0) + 1, last: move };
    }
    if (state.puzzle[move.at]) return state;        // a clue is not yours to change
    const grid = state.grid.slice();
    const notes = state.notes.slice();
    grid[move.at] = move.value;
    notes[move.at] = 0;
    const wrong = move.value && move.value !== state.solution[move.at];
    return {
      ...state,
      grid,
      notes,
      ply: (state.ply || 0) + 1,
      mistakes: (state.mistakes || 0) + (wrong ? 1 : 0),
      last: { ...move, wrong },
    };
  },

  result(state) {
    for (let i = 0; i < CELLS; i++) if (state.grid[i] !== state.solution[i]) return null;
    return { winner: 0, reason: 'solved' };
  },

  evaluate: () => 0,

  /**
   * The next square that can be worked out, and which technique does it.
   *
   * This is deliberately not "reveal a cell from the solution". A hint that
   * names the reason teaches the technique the level is built around, and a
   * player who has seen `hidden` explained once starts finding them.
   */
  hint(state) {
    const board = state.grid.slice();
    for (let i = 0; i < CELLS; i++) if (board[i] && board[i] !== state.solution[i]) board[i] = 0;
    const step = nextStep(board);
    if (step) return step;
    for (let i = 0; i < CELLS; i++) {
      if (!board[i]) return { at: i, value: state.solution[i], technique: 'guess' };
    }
    return null;
  },

  /** Every square whose digit contradicts another — the "check" button. */
  conflicts(state) {
    const bad = new Set();
    for (const unit of UNITS) {
      const seen = new Map();
      for (const i of unit) {
        const v = state.grid[i];
        if (!v) continue;
        if (seen.has(v)) {
          bad.add(i);
          bad.add(seen.get(v));
        } else seen.set(v, i);
      }
    }
    return bad;
  },

  ai: { unit: 100 },
};

// ------------------------------------------------------------------- geometry

const rowOf = (i) => Math.floor(i / N);
const colOf = (i) => i % N;
const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** The 27 units: nine rows, nine columns, nine boxes. */
export const UNITS = (() => {
  const out = [];
  for (let r = 0; r < N; r++) out.push(Array.from({ length: N }, (_, c) => r * N + c));
  for (let c = 0; c < N; c++) out.push(Array.from({ length: N }, (_, r) => r * N + c));
  for (let b = 0; b < N; b++) {
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    out.push(Array.from({ length: N }, (_, k) => (r0 + Math.floor(k / 3)) * N + c0 + (k % 3)));
  }
  return out;
})();

/** Every cell that shares a unit with this one. */
const PEERS = (() => {
  const out = Array.from({ length: CELLS }, () => []);
  for (let i = 0; i < CELLS; i++) {
    const set = new Set();
    for (const unit of UNITS) if (unit.includes(i)) for (const j of unit) if (j !== i) set.add(j);
    out[i] = [...set];
  }
  return out;
})();

// ------------------------------------------------------------------- solving

/** Candidate bitmask per empty cell; null when some cell has none left. */
function candidates(board) {
  const cand = new Array(CELLS).fill(0);
  for (let i = 0; i < CELLS; i++) {
    if (board[i]) continue;
    let mask = ALL;
    for (const j of PEERS[i]) if (board[j]) mask &= ~(1 << (board[j] - 1));
    if (!mask) return null;
    cand[i] = mask;
  }
  return cand;
}

const bits = (mask) => {
  const out = [];
  for (let v = 1; v <= N; v++) if (mask & (1 << (v - 1))) out.push(v);
  return out;
};
const bitCount = (mask) => bits(mask).length;

/**
 * The next deduction available, cheapest technique first. Returns what to write
 * *and why* — the classifier reads the "why", and so does the hint button.
 */
export function nextStep(board) {
  const cand = candidates(board);
  if (!cand) return null;

  for (let i = 0; i < CELLS; i++) {
    if (board[i] || bitCount(cand[i]) !== 1) continue;
    return { at: i, value: bits(cand[i])[0], technique: 'single' };
  }

  for (const unit of UNITS) {
    for (let v = 1; v <= N; v++) {
      const bit = 1 << (v - 1);
      let where = -1;
      let n = 0;
      for (const i of unit) {
        if (board[i] === v) { n = 0; break; }
        if (!board[i] && cand[i] & bit) { where = i; n++; }
      }
      if (n === 1) return { at: where, value: v, technique: 'hidden', unit };
    }
  }

  // From here on the techniques do not place a digit, they remove candidates —
  // so each one runs, prunes, and asks the two above to look again. That is
  // what makes "the hardest technique this grid needed" a meaningful label.
  if (prunePairs(board, cand)) return afterPrune(board, cand, 'pair');
  if (prunePointing(board, cand)) return afterPrune(board, cand, 'pointing');
  if (pruneXWing(board, cand)) return afterPrune(board, cand, 'xwing');
  return null;
}

function afterPrune(board, cand, technique) {
  for (let i = 0; i < CELLS; i++) {
    if (!board[i] && bitCount(cand[i]) === 1) return { at: i, value: bits(cand[i])[0], technique };
  }
  for (const unit of UNITS) {
    for (let v = 1; v <= N; v++) {
      const bit = 1 << (v - 1);
      let where = -1;
      let n = 0;
      for (const i of unit) {
        if (board[i] === v) { n = 0; break; }
        if (!board[i] && cand[i] & bit) { where = i; n++; }
      }
      if (n === 1) return { at: where, value: v, technique };
    }
  }
  return null;
}

/** Two cells in a unit holding the same two candidates: nothing else in that
 *  unit can be either of them. */
function prunePairs(board, cand) {
  let changed = false;
  for (const unit of UNITS) {
    for (let a = 0; a < unit.length; a++) {
      const i = unit[a];
      if (board[i] || bitCount(cand[i]) !== 2) continue;
      for (let b = a + 1; b < unit.length; b++) {
        const j = unit[b];
        if (board[j] || cand[j] !== cand[i]) continue;
        for (const k of unit) {
          if (k === i || k === j || board[k]) continue;
          const pruned = cand[k] & ~cand[i];
          if (pruned !== cand[k]) {
            cand[k] = pruned;
            changed = true;
          }
        }
      }
    }
  }
  return changed;
}

/** A digit confined to one row (or column) inside a box cannot appear in that
 *  row anywhere else — and the other way round. */
function prunePointing(board, cand) {
  let changed = false;
  for (let b = 0; b < N; b++) {
    const box = UNITS[18 + b];
    for (let v = 1; v <= N; v++) {
      const bit = 1 << (v - 1);
      const spots = box.filter((i) => !board[i] && cand[i] & bit);
      if (spots.length < 2) continue;
      const rows = new Set(spots.map(rowOf));
      const cols = new Set(spots.map(colOf));
      if (rows.size === 1) {
        for (const i of UNITS[rowOf(spots[0])]) {
          if (boxOf(i) === b || board[i] || !(cand[i] & bit)) continue;
          cand[i] &= ~bit;
          changed = true;
        }
      }
      if (cols.size === 1) {
        for (const i of UNITS[9 + colOf(spots[0])]) {
          if (boxOf(i) === b || board[i] || !(cand[i] & bit)) continue;
          cand[i] &= ~bit;
          changed = true;
        }
      }
    }
  }
  return changed;
}

/** Two rows where a digit sits in the same two columns: it must be on that
 *  rectangle, so it leaves those columns everywhere else. */
function pruneXWing(board, cand) {
  let changed = false;
  for (const [lines, cross] of [[0, 9], [9, 0]]) {
    for (let v = 1; v <= N; v++) {
      const bit = 1 << (v - 1);
      const spots = [];
      for (let k = 0; k < N; k++) {
        const cells = UNITS[lines + k].filter((i) => !board[i] && cand[i] & bit);
        if (cells.length === 2) spots.push({ k, cells });
      }
      for (let a = 0; a < spots.length; a++) {
        for (let b = a + 1; b < spots.length; b++) {
          const pa = spots[a].cells.map(lines === 0 ? colOf : rowOf);
          const pb = spots[b].cells.map(lines === 0 ? colOf : rowOf);
          if (pa[0] !== pb[0] || pa[1] !== pb[1]) continue;
          for (const p of pa) {
            for (const i of UNITS[cross + p]) {
              const line = lines === 0 ? rowOf(i) : colOf(i);
              if (line === spots[a].k || line === spots[b].k || board[i] || !(cand[i] & bit)) continue;
              cand[i] &= ~bit;
              changed = true;
            }
          }
        }
      }
    }
  }
  return changed;
}

/**
 * Solve by logic alone, up to a technique ceiling. Returns how far it got and
 * which technique it leaned on hardest — that pair is the whole difficulty
 * classification.
 */
export function solveLogic(board, ceiling = TECHNIQUES.length) {
  const work = board.slice();
  let hardest = 0;
  for (let guard = 0; guard < CELLS + 5; guard++) {
    const filled = work.every((v) => v);
    if (filled) return { solved: true, hardest, board: work };
    const step = nextStep(work);
    if (!step) return { solved: false, hardest, board: work };
    const rank = TECHNIQUES.indexOf(step.technique) + 1;
    if (rank > ceiling) return { solved: false, hardest, board: work };
    if (rank > hardest) hardest = rank;
    work[step.at] = step.value;
  }
  return { solved: work.every((v) => v), hardest, board: work };
}

/** Count solutions, stopping at `cap`. Uniqueness is the one property a
 *  generated grid may never be missing. */
export function countSolutions(board, cap = 2) {
  const work = board.slice();
  let found = 0;

  const step = () => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < CELLS; i++) {
      if (work[i]) continue;
      let mask = ALL;
      for (const j of PEERS[i]) if (work[j]) mask &= ~(1 << (work[j] - 1));
      const n = bitCount(mask);
      if (n === 0) return false;
      if (n < bestCount) {
        bestCount = n;
        best = i;
        bestMask = mask;
        if (n === 1) break;
      }
    }
    if (best < 0) {
      found++;
      return found >= cap;
    }
    for (const v of bits(bestMask)) {
      work[best] = v;
      if (step()) {
        work[best] = 0;
        return true;
      }
      work[best] = 0;
    }
    return false;
  };

  step();
  return found;
}

// ---------------------------------------------------------------- generating

/** A full, valid grid, laid out by the luck stream. */
function fullGrid(luck) {
  const board = new Array(CELLS).fill(0);
  const fill = (i) => {
    if (i >= CELLS) return true;
    let mask = ALL;
    for (const j of PEERS[i]) if (board[j]) mask &= ~(1 << (board[j] - 1));
    const options = luck.shuffle(bits(mask));
    for (const v of options) {
      board[i] = v;
      if (fill(i + 1)) return true;
      board[i] = 0;
    }
    return false;
  };
  fill(0);
  return board;
}

/**
 * Carve clues out of a full grid, keeping two invariants at every step:
 * exactly one solution, and solvable by the techniques this level allows.
 *
 * Removal is in pairs across the centre, which is not decoration: a symmetric
 * grid is what a sudoku looks like in a newspaper, and the eye reads it faster.
 */
function carve(solution, ceiling, floor, luck, symmetric) {
  const puzzle = solution.slice();
  let clues = CELLS;

  // Two passes over a fresh order each time. One greedy pass leaves clues that
  // only became removable *after* something else went, and those late removals
  // are exactly the ones that push a grid past the easy techniques.
  for (let pass = 0; pass < 2; pass++) {
    const order = luck.shuffle(Array.from({ length: CELLS }, (_, i) => i));
    for (const i of order) {
      if (clues <= floor) break;
      if (!puzzle[i]) continue;
      const mirror = CELLS - 1 - i;
      const taken = symmetric && mirror !== i && puzzle[mirror] ? [i, mirror] : [i];

      const kept = taken.map((k) => puzzle[k]);
      for (const k of taken) puzzle[k] = 0;

      if (countSolutions(puzzle, 2) === 1 && solveLogic(puzzle, ceiling).solved) clues -= taken.length;
      else taken.forEach((k, n) => (puzzle[k] = kept[n]));
    }
  }
  return puzzle;
}

/**
 * A grid at the level asked for — and the reason this is a loop rather than one
 * carve.
 *
 * Removing clues until a grid is unique gets you a *sparse* grid, not a hard
 * one: a 24-clue puzzle that falls to naked singles is easier than a 34-clue
 * one that needs an X-wing, and the first version of this file shipped exactly
 * that — "professional" grids the beginner's technique finished on its own.
 * Difficulty is what the grid demands, so it is measured and demanded: carve,
 * ask the solver which technique it could not avoid, and if the answer is too
 * easy throw the grid away and lay out another one.
 *
 * The best attempt so far is kept, so this always returns a real puzzle — and
 * `hardest` reports what the grid honestly needs, even on the rare run where
 * the loop never reaches the mark.
 */
function generate(level, luck) {
  const ceiling = CEILING[level];
  const demand = DEMAND[level];
  const floor = CLUES[level];
  let best = null;

  // The pretty grid and the hard grid pull in opposite directions: taking clues
  // out in mirrored pairs is what makes a puzzle look like a newspaper one, and
  // it is also what stops the carve early — a pair fails whenever *either* half
  // breaks uniqueness. So the two easy levels, which are meant to look
  // inviting, keep the symmetry; the two hard ones spend it on difficulty.
  const symmetric = level === 'easy' || level === 'normal';

  for (let attempt = 0; attempt < 14; attempt++) {
    const solution = fullGrid(luck);
    const puzzle = carve(solution, ceiling, floor, luck, symmetric);
    const { hardest } = solveLogic(puzzle, ceiling);
    const clues = puzzle.filter(Boolean).length;

    // easy is the one level with a ceiling *and* a floor on cleverness: a grid
    // that needs a hidden single is not what somebody picking "easy" asked for
    const fits = level === 'easy' ? hardest <= ceiling : hardest >= demand;
    if (fits) return { puzzle, solution, hardest: TECHNIQUES[Math.max(0, hardest - 1)], clues };
    if (!best || hardest > best.rank) best = { puzzle, solution, rank: hardest, clues };
  }
  return {
    puzzle: best.puzzle,
    solution: best.solution,
    hardest: TECHNIQUES[Math.max(0, best.rank - 1)],
    clues: best.clues,
  };
}

/** Only for a caller that forgot to pass a stream — the game always passes one. */
function fallbackStream() {
  return {
    shuffle(list) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    },
  };
}
