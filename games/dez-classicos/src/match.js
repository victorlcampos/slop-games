// A match: one game, one level, one seat for the player and the rest for the
// machine.
//
// This is the only place that knows about time. The rules modules are pure
// functions and the views only draw, so everything that happens *between* two
// states — the piece sliding, the dice rattling, the machine thinking without
// freezing the tab — happens here.
//
// Two decisions shape the whole file:
//
//   1. **The state is already the new one while the animation runs.** The view
//      is handed the position after the move plus an `anim` describing what
//      just changed, and draws the difference. The alternative — animating from
//      the old state and swapping at the end — means every view has to hold two
//      states and agree about when to switch, and it goes wrong the first time
//      a move is undone mid-slide.
//   2. **Rolling is a human action.** The machine throws by itself after a
//      beat, but the player taps to throw. It costs a tap and buys the only
//      moment in a dice game that feels like the player did something.

import { bestMove, think, profileFor, LEVELS } from './engine/ai.js';
import { createRandom, freshSeed } from './engine/rng.js';
import { layout, drawSeat } from './views/seats.js';
import { drawTable } from './views/board.js';
import { t } from './i18n.js';
import { sfx } from './audio.js';

const ANIM = { fast: 0.16, normal: 0.26, long: 0.5 };

export function createMatch(def, { level = 'normal', side = 0, seed = null, onChange = () => {} } = {}) {
  const rules = def.rules;
  const view = def.view();
  const rnd = createRandom(seed === null ? freshSeed() : seed);

  const match = {
    def,
    view,
    level,
    side,
    rnd,
    state: rules.setup({ level, rnd }),
    history: [],
    sel: null,
    anim: null,
    thinking: 0,
    pending: null,      // a promotion waiting on the player
    hover: null,
    result: null,
    sinceEnd: 0,
    elapsed: 0,
    // The hint the player asked for. It is `tip` and not `hint` because the
    // method that asks for one is `hint()`, and hanging both off the same name
    // meant `Object.assign` below quietly replaced the field with the function
    // — so the status bar read `sudoku.technique.undefined` for ever, and the
    // second press of the button replaced the function with its own result.
    tip: null,
    pencil: false,
    message: null,
    seats: [],
  };

  /** Whose turn it is, from the player's point of view. */
  const isMine = () => def.solo || match.state.turn === match.side;
  const legal = () => (match.result ? [] : rules.moves(match.state));

  // ------------------------------------------------------------------ moving

  function play(move, { byMachine = false } = {}) {
    if (match.result) return;
    const prev = match.state;
    const next = rules.apply(prev, move);
    match.history.push({ state: prev, sel: null });
    if (match.history.length > 120) match.history.shift();
    match.state = next;
    match.sel = null;
    match.tip = null;
    match.anim = {
      move,
      prev,
      next,
      player: prev.turn,
      t: 0,
      dur: durationOf(move, prev, next),
      byMachine,
    };
    voice(move, prev, next);
    onChange();
  }

  /** How long this particular move should take to show. */
  function durationOf(move, prev, next) {
    if (move.path && move.path.length > 2) return ANIM.normal * (move.path.length - 1) * 0.7;
    if (next.flipped && next.flipped.length) return ANIM.normal + next.flipped.length * 0.05;
    if (move.pass) return ANIM.fast;
    return ANIM.normal;
  }

  /** The noise a move makes. */
  function voice(move, prev, next) {
    if (move.pass) return sfx.deny();
    if (def.id === 'connect4') return sfx.drop();
    if (def.id === 'mancala') {
      const seeds = Math.min(6, prev.b[move.pit] || 1);
      for (let i = 0; i < seeds; i++) sfx.seed(i);
      return;
    }
    if (def.id === 'reversi') {
      sfx.place();
      (next.flipped || []).forEach((_, i) => sfx.flip(i));
      return;
    }
    if (def.id === 'sudoku') {
      if (move.note !== undefined) return sfx.place();
      return next.last && next.last.wrong ? sfx.wrong() : sfx.write();
    }
    const took = move.cap || (move.caps && move.caps.length) || move.take !== undefined || (next.last && next.last.captured);
    return took ? sfx.capture() : sfx.place();
  }

  // ------------------------------------------------------------------ the AI

  let searching = false;
  async function machineMove() {
    if (searching || match.result || match.anim) return;
    searching = true;
    match.thinking = 0.001;
    onChange();
    try {
      const { move } = await think(rules, match.state, match.level, match.rnd);
      // the position can have moved on while it thought — a restart, an undo
      if (!searching || match.result) return;
      match.thinking = 0;
      if (move) play(move, { byMachine: true });
      else if (rules.needsRoll) match.state = { ...match.state, turn: nextSeat(match.state.turn) };
    } finally {
      searching = false;
      match.thinking = 0;
    }
  }

  const nextSeat = (turn) => (turn + 1) % (def.seats || 2);

  // ---------------------------------------------------------------- the dice

  let rollDelay = 0;

  function roll() {
    if (!rules.needsRoll || !rules.needsRoll(match.state)) return false;
    match.history.push({ state: match.state, sel: null });
    match.state = rules.roll(match.state, match.rnd.luck);
    match.tip = null;
    sfx.dice();
    // A throw with nothing playable is not a bug and has to be seen: the turn
    // is spent on the board rather than skipped behind the player's back.
    const moves = rules.moves(match.state);
    match.message = moves.length === 1 && moves[0].pass ? 'match.noMoves' : null;
    onChange();
    return true;
  }

  // ------------------------------------------------------------------- input

  /**
   * A tap, in logical coordinates. Everything the player can do goes through
   * here — the views decide what a coordinate means, and hand back either a new
   * selection or a move.
   */
  function tap(x, y) {
    if (match.anim || match.result) return;
    if (match.pending) return;

    if (rules.needsRoll && rules.needsRoll(match.state)) {
      if (isMine()) roll();
      return;
    }
    if (!isMine()) return;

    const target = view.hit(x, y, { flip: match.flip, side: match.side, state: match.state });
    if (target === null || target === -1) return;

    // sudoku's keypad comes back as an object rather than a square
    if (def.id === 'sudoku') return sudokuTap(target);

    const out = view.pick(match.state, target, match.sel, legal());
    if (out.promote) {
      match.pending = { options: out.promote };
      onChange();
      return;
    }
    match.sel = out.sel === undefined ? match.sel : out.sel;
    if (out.move) play(out.move);
    else onChange();
  }

  /** Sudoku: a square, a digit, the rubber or the pencil. */
  function sudokuTap(target) {
    if (typeof target === 'object' && target.key !== undefined) {
      const key = target.key;
      if (key === 'note') {
        match.pencil = !match.pencil;
        return onChange();
      }
      if (match.sel === null || match.sel === undefined) return;
      if (key === 'x') return play({ at: match.sel, value: 0 });
      const value = Number(key);
      if (match.pencil) return play({ at: match.sel, note: value });
      return play({ at: match.sel, value });
    }
    match.sel = target;                 // clues are selectable too, to light their peers
    match.tip = null;
    onChange();
  }

  /** The keyboard, for the games where one helps. */
  function key(code) {
    if (def.id === 'sudoku') {
      if (match.sel === null || match.sel === undefined) return;
      if (/^Digit[1-9]$/.test(code) || /^Numpad[1-9]$/.test(code)) {
        const value = Number(code.slice(-1));
        return play(match.pencil ? { at: match.sel, note: value } : { at: match.sel, value });
      }
      if (code === 'Backspace' || code === 'Delete' || code === 'Digit0') return play({ at: match.sel, value: 0 });
      if (code === 'KeyN') {
        match.pencil = !match.pencil;
        return onChange();
      }
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[code];
      if (step) {
        match.sel = Math.max(0, Math.min(80, match.sel + step));
        return onChange();
      }
    }
  }

  /** Finish a promotion the player was asked about. */
  function choose(option) {
    if (!match.pending) return;
    match.pending = null;
    play(option);
  }

  // ------------------------------------------------------------------- clock

  function tick(dt) {
    match.elapsed += dt;

    if (match.anim) {
      match.anim.t += dt / match.anim.dur;
      if (match.anim.t >= 1) {
        match.anim = null;
        finish();
        onChange();
      }
      return;
    }
    if (match.result) {
      match.sinceEnd += dt;
      return;
    }
    if (match.pending) return;

    if (rules.needsRoll && rules.needsRoll(match.state)) {
      if (isMine()) return;                 // the player throws by tapping
      rollDelay += dt;
      if (rollDelay > 0.45) {
        rollDelay = 0;
        roll();
      }
      return;
    }
    rollDelay = 0;

    // A throw with nothing playable is still a move, and it is the player's to
    // watch rather than to make: there is nothing to tap. It is shown for a
    // beat — long enough to read "no legal move" and see the dice that caused
    // it — and then it plays itself.
    const moves = legal();
    if (moves.length === 1 && moves[0].pass) {
      passWait += dt;
      if (passWait > 0.9) {
        passWait = 0;
        match.message = null;
        play(moves[0], { byMachine: !isMine() });
      }
      return;
    }
    passWait = 0;

    if (!isMine() && !match.thinking) machineMove();
  }

  let passWait = 0;

  /** After a move lands: is it over, and does anything need saying? */
  function finish() {
    const over = rules.result(match.state);
    if (over) {
      match.result = over;
      match.sinceEnd = 0;
      const won = def.solo ? true : over.winner === match.side;
      if (over.winner === null || over.winner === undefined) sfx.draw();
      else if (won) sfx.win();
      else sfx.lose();
      onChange();
      return;
    }
    // a throw with nothing to play spends itself
    const moves = rules.moves(match.state);
    if (moves.length === 1 && moves[0].pass && !isMine()) return;
  }

  // ----------------------------------------------------------------- drawing

  function draw(ctx, W, H, { top = 54, bottom = 46 } = {}) {
    drawTable(ctx, W, H);
    const L = layout(W, H, { top, bottom: bottom + 4, solo: !!def.solo });

    // the seats: the player's own first, so it is the one at the bottom
    match.seats = [];
    const count = def.solo ? 1 : def.seats || 2;
    for (let i = 0; i < Math.min(2, count); i++) {
      // With four players there is one panel for three machines, so it shows
      // the one that is actually winning — which is the opponent the player
      // needs to be watching anyway.
      const who = i === 0 ? match.side : otherSeat();
      const extra = def.seat ? def.seat(match.state, who) : {};
      drawSeat(ctx, L.seats[i], {
        name: i === 0 ? t('match.you') : t('match.machine'),
        level: i === 0 ? sideName(who) : t('level.' + match.level),
        palette: def.palettes[who] || def.palettes[0],
        ...extra,
      }, {
        active: !match.result && (def.solo || match.state.turn === who),
        sideways: L.sideways,
        thinking: i === 1 ? match.thinking : 0,
      });
    }

    view.draw(ctx, L.board, match.state, {
      sel: match.sel,
      hints: isMine() && !match.result && !match.anim ? view.hints(match.state, match.sel, legal()) : [],
      anim: match.anim,
      flip: match.flip,
      result: match.result,
      sinceEnd: match.sinceEnd,
      hover: match.hover,
      conflicts: def.id === 'sudoku' ? rules.conflicts(match.state) : null,
      pencil: match.pencil,
      hint: match.tip,
      side: match.side,
      state: match.state,
      time: match.elapsed,
    });
  }

  function otherSeat() {
    const count = def.seats || 2;
    if (count === 2) return match.side === 0 ? 1 : 0;
    let best = -1;
    let bestScore = -Infinity;
    for (let p = 0; p < count; p++) {
      if (p === match.side) continue;
      const score = rules.evaluate(match.state, p);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best < 0 ? (match.side + 1) % count : best;
  }
  const sideName = (who) => (def.sides && def.sides[who] ? t(def.sides[who]) : '');

  // --------------------------------------------------------------- the words

  /** One line for the status bar: what is happening, or what just happened. */
  function status() {
    if (match.result) return endText();
    if (match.pending) return t('ui.promoteTo');
    if (rules.needsRoll && rules.needsRoll(match.state)) {
      return isMine() ? t('match.tapToRoll') : t('match.rolling');
    }
    if (match.message) return t(match.message);
    if (!isMine()) return t('match.thinking');
    if (def.solo) return match.tip ? t('sudoku.technique.' + match.tip.technique) : t('game.' + def.id + '.how');
    // "check" is chess's alone, and the registry is where a game declares the
    // extra thing it wants said — the match does not import ten rule modules
    // to ask nine of them a question they do not have
    if (def.check && def.check(match.state)) return t('match.check');
    if (def.id === 'checkers') {
      const moves = legal();
      if (moves.length && moves[0].caps && moves[0].caps.length) return t('match.mustCapture');
    }
    if (typeof match.sel === 'object' && match.sel && match.sel.pending) return t('match.mill');
    if (match.state.dice && match.state.dice.length) {
      return t('match.rolled', { dice: match.state.dice.join(' + ') });
    }
    return t('match.yourTurn');
  }

  function endText() {
    const over = match.result;
    const reason = over.reason ? t('end.' + over.reason) : '';
    if (def.solo) return t('match.solved') + ' · ' + reason;
    if (over.winner === null || over.winner === undefined) return t('match.drew') + ' · ' + reason;
    if (def.seats === 4 && over.winner !== match.side) {
      return t('match.lost') + ' · ' + reason;
    }
    return (over.winner === match.side ? t('match.won') : t('match.lost')) + ' · ' + reason;
  }

  // ------------------------------------------------------------------ undoing

  /** Back to the last position the player was looking at. */
  function undo() {
    if (!match.history.length) return;
    searching = false;
    match.thinking = 0;
    match.anim = null;
    match.pending = null;
    match.result = null;
    match.message = null;
    do {
      const step = match.history.pop();
      match.state = step.state;
    } while (match.history.length && !isMine());
    match.sel = null;
    match.tip = null;
    onChange();
  }

  function hint() {
    if (!rules.hint) return;
    match.tip = rules.hint(match.state);
    if (match.tip) sfx.write();
    onChange();
  }

  Object.assign(match, {
    tap, key, tick, draw, undo, roll, choose, hint, status,
    play,
    legal,
    isMine,
    get thinkingNow() { return match.thinking > 0; },
    /** For the save file: everything needed to sit back down at this table. */
    snapshot: () => ({
      id: def.id,
      level: match.level,
      side: match.side,
      state: match.state,
      elapsed: match.elapsed,
      seed: rnd.seed,
    }),
  });

  match.flip = def.flippable && side === 1;
  return match;
}

/** Restore a match from a snapshot, or return null if it no longer makes sense. */
export function resume(def, snap, onChange) {
  try {
    const match = createMatch(def, { level: snap.level, side: snap.side, seed: snap.seed, onChange });
    // Never trust what came off disk (CLAUDE.md, 2b): the proof that a state is
    // still valid is that the rules can read it. A save from an older version
    // whose shape has changed throws here and is quietly dropped, rather than
    // taking the game down on load.
    const state = snap.state;
    def.rules.moves(state);
    def.rules.result(state);
    match.state = state;
    match.elapsed = snap.elapsed || 0;
    match.result = def.rules.result(state);
    return match;
  } catch {
    return null;
  }
}

export { LEVELS };
