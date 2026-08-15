// The way in: the arena first, then the body you put in it, then a moment of
// theatre, then the field.
//
// It is a state machine in a module of its own for one reason — there are rules
// in these screens (a locked arena is not a choice, the flourish has a length,
// the skip has a floor, the last body you played is the one waiting for you next
// time) and a rule that lives inside `main.js` is a rule no test can reach.

import { PHASES, TEAMS } from './config.js';

/** How long the pick animation runs before the field opens. */
export const INTRO = 1.55;

/**
 * The first third of the flourish cannot be skipped.
 *
 * Not for drama. The click that chose the side is still on its way up, and on a
 * phone the tap that lands on the card ends as a `touchend` one frame later —
 * with no floor, the animation is a single frame long for everybody who taps
 * quickly, which is everybody.
 */
export const SKIP_AFTER = 0.35;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * @param {object} o
 * @param {number} o.unlocked  how many arenas the save has opened (1..PHASES.length)
 * @param {number} o.arena     the arena the player is looking at
 * @param {string} o.team      the side he played last
 * @param {function} o.onStart called once, when the flourish finishes
 */
export function createFlow({ unlocked = 1, arena = 0, team = 'human', onStart = () => {} } = {}) {
  const flow = {
    /** arena → hero → intro → playing → over */
    screen: 'arena',
    arena: 0,
    team: TEAMS.includes(team) ? team : TEAMS[0],
    unlocked: clamp(Math.round(unlocked), 1, PHASES.length),
    /** seconds into the flourish; `progress` is the same thing from 0 to 1 */
    elapsed: 0,

    get progress() {
      return clamp(flow.elapsed / INTRO, 0, 1);
    },

    locked: (i) => i >= flow.unlocked,

    /** The save reopening a game that has unlocked more since. */
    setUnlocked(n) {
      flow.unlocked = clamp(Math.round(n) || 1, 1, PHASES.length);
      flow.arena = Math.min(flow.arena, flow.unlocked - 1);
    },

    /** Move the highlight without leaving the screen — the arrow keys. */
    hover(i) {
      const n = clamp(Math.round(i), 0, flow.unlocked - 1);
      const moved = n !== flow.arena;
      flow.arena = n;
      return moved;
    },

    /** The arena screen. Returns false — and stays put — on a locked arena. */
    chooseArena(i) {
      if (!Number.isFinite(i) || i < 0 || i >= PHASES.length || flow.locked(i)) return false;
      flow.arena = i;
      flow.screen = 'hero';
      return true;
    },

    /** The character screen. Starts the flourish; the match waits for it. */
    chooseTeam(t) {
      if (!TEAMS.includes(t) || flow.screen !== 'hero') return false;
      flow.team = t;
      flow.screen = 'intro';
      flow.elapsed = 0;
      return true;
    },

    /** The flourish is the only screen with a clock in it. */
    tick(h) {
      if (flow.screen !== 'intro') return;
      flow.elapsed += h;
      if (flow.elapsed >= INTRO) {
        flow.screen = 'playing';
        onStart(flow.arena, flow.team);
      }
    },

    /** Impatience, honoured after `SKIP_AFTER`. */
    skip() {
      if (flow.screen !== 'intro' || flow.elapsed < SKIP_AFTER) return false;
      flow.elapsed = INTRO;
      flow.screen = 'playing';
      onStart(flow.arena, flow.team);
      return true;
    },

    /** Back one screen: from the bodies to the arenas, and no further. */
    back() {
      if (flow.screen !== 'hero') return false;
      flow.screen = 'arena';
      return true;
    },

    toArenas() { flow.screen = 'arena'; },
    /** "Change sides" off the results card — the arena is already decided. */
    toHeroes() { flow.screen = 'hero'; },
    finish() { flow.screen = 'over'; },

    /** Whether a screen is one of the two you can walk back and forth between. */
    get inMenus() {
      return flow.screen === 'arena' || flow.screen === 'hero' || flow.screen === 'intro';
    },
  };

  flow.arena = clamp(Math.round(arena) || 0, 0, flow.unlocked - 1);
  return flow;
}
