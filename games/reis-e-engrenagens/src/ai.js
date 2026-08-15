// The opponent.
//
// It does not know anything the player cannot find out: it fires ghost shots
// through `match.trace`, which is the same integrator, the same wind and the
// same walls the real shot goes through. An opponent that aimed with different
// physics would be either unbeatable or a liar, and both are worse than one
// that simply has good aim.
//
// What makes it beatable is `skill`, and it is a **wobble on a good answer**,
// not a worse answer: the search always finds the shot, and then the hands
// shake. That is why the first level feels like an artillery duel with a drunk
// and the last one feels like being ranged in — the wobble also shrinks with
// every turn, because a gunner who has watched two of his own shells land does
// know where the third one goes.

import { CELL, COLS, ROWS, clamp, other } from './config.js';
import { ARSENAL, WEAPONS } from './weapons.js';
import { gunSeat } from './structure.js';

// Coarse first, then one cell of the grid explored properly. A flat search fine
// enough to land a shell would be about eight thousand ghost shots a turn; this
// is under nine hundred and lands the same one.
const COARSE_ANGLES = [];
for (let a = 14; a <= 86; a += 6) COARSE_ANGLES.push(a);
const COARSE_POWERS = [];
for (let p = 28; p <= 100; p += 6) COARSE_POWERS.push(p);

/**
 * How well the enemy shoots this turn: the level's own skill, plus everything
 * it has learned from watching its previous shells land.
 */
export function skillNow(level, turnCount) {
  return clamp(level.skill + turnCount * 0.035, 0, 1);
}

/**
 * Pick a weapon, an angle and a power.
 *
 * @param {object} match
 * @param {string} side    which launcher is thinking
 * @param {number} skill   0 is a beginner, 1 puts it exactly where it meant to
 * @param {function} [rng] so a test can get the same plan twice
 */
export function planShot(match, side, skill = 0.6, rng = match.rng) {
  const target = pickTarget(match, side);
  const options = ARSENAL[match.faction[side]].filter((id) => match.ammo[side][id] > 0);

  let best = null;
  for (const id of options) {
    const w = WEAPONS[id];
    // specials are worth saving; the endless shot has to be clearly worse before
    // a limited one gets spent
    const upkeep = w.ammo === Infinity ? 0 : 45;

    for (const angle of COARSE_ANGLES) {
      for (const power of COARSE_POWERS) {
        const score = scoreOf(match, side, w, match.trace(side, id, angle, power), target) - upkeep;
        if (!best || score > best.score) best = { id, angle, power, score };
      }
    }
  }
  if (!best) return { weapon: ARSENAL[match.faction[side]][0], angle: 45, power: 60 };

  // and now the fine adjustment, which is where a coarse grid usually loses the
  // shot: one degree either way is a whole cell at this range
  const chosen = best.id;
  const w = WEAPONS[chosen];
  const upkeep = w.ammo === Infinity ? 0 : 45;
  const around = { angle: best.angle, power: best.power };
  for (let a = around.angle - 4; a <= around.angle + 4; a++) {
    for (let p = around.power - 5; p <= around.power + 5; p++) {
      if (p < 12 || p > 100 || a < 6 || a > 89) continue;
      const score = scoreOf(match, side, w, match.trace(side, chosen, a, p), target) - upkeep;
      if (score > best.score) best = { id: chosen, angle: a, power: p, score };
    }
  }

  const wobble = 1 - clamp(skill, 0, 1);
  return {
    weapon: best.id,
    angle: clamp(best.angle + (rng() * 2 - 1) * 8 * wobble, 8, 88),
    power: clamp(best.power + (rng() * 2 - 1) * 10 * wobble, 14, 100),
  };
}

/**
 * Which way the enemy drives before it aims.
 *
 * It wants the high ground of its own castle, and it re-wants it every turn —
 * so shoot the tower out from under its engine and you will watch it spend the
 * next turn climbing back up whatever is left, which is a turn it did not spend
 * shooting at you. That is the whole of its road sense, and it is enough: the
 * seat is the only position from which its own battlements never eat a shot.
 */
export function planDrive(match, side) {
  const L = match.launchers[side];
  const seat = gunSeat(match.castles[side], match.terrain);
  if (Math.abs(L.x - seat.x) < CELL * 0.45) return 0;
  return Math.sign(seat.x - L.x);
}

/** The cell it is actually trying to hit: the king, wherever he ended up. */
export function aimPoint(match, foe) {
  const castle = match.castles[foe];
  const king = castle.king();
  if (king) return castle.centre(king.c, king.r);
  return { x: castle.baseX, y: 0 };
}

/**
 * What this turn is *about* — and it is not always the king.
 *
 * A gunner that shells the same cell every turn is a metronome, and being shot
 * by a metronome is boring even when it hits. Every third turn, if the other
 * engine is perched on a tower worth the shell, the target is the block under
 * *it* instead: knock the seat down and they spend a turn climbing back up —
 * the same counter-battery play the player is invited to make. The schedule is
 * deliberate rather than rolled, so a test can sit on either side of it.
 */
export function pickTarget(match, side) {
  const foe = other(side);
  const counter = counterTarget(match, foe);
  if (counter && match.turnCount % 3 === 2) return counter;
  return aimPoint(match, foe);
}

/** The block under the foe's engine, if it is riding anything worth felling. */
function counterTarget(match, foe) {
  const castle = match.castles[foe];
  const c = Math.floor((match.launchers[foe].x - castle.baseX) / CELL);
  if (c < 0 || c >= COLS) return null;
  for (let r = ROWS - 1; r >= 0; r--) {
    const b = castle.at(c, r);
    // one storey is not a tower — dropping the engine a single cell buys nothing
    if (b) return r >= 1 && b.m !== 'king' ? { ...castle.centre(c, r), counter: true } : null;
  }
  return null;
}

/**
 * How good a landing spot is. Distance to the king is most of it — a shell that
 * lands short of the wall still ate a turn — but a hit that suits the material
 * counts too, which is the whole reason the enemy switches ammunition when it
 * runs into a wall of the wrong stuff.
 */
export function scoreOf(match, side, w, res, target) {
  const foe = other(side);
  let score = -Math.hypot(res.x - target.x, res.y - target.y);

  if (res.kind === 'block') {
    if (res.side === foe) {
      score += 70;
      const mult = w.vs[res.m] === undefined ? 1 : w.vs[res.m];
      score += 110 * (mult - 1);
    } else {
      score -= 900; // its own wall
    }
  }
  if (res.kind === 'terrain') {
    // a drill has no interest in the wall: it wants the cellar
    if (w.burrow && Math.abs(res.x - target.x) < 90) score += 130;
    else score -= 40;
    // and nothing behind its own castle is a shot at anybody
    const home = match.launchers[side].x;
    const away = match.launchers[foe].x;
    if ((res.x - home) * (away - home) < 0) score -= 400;
  }
  if (res.kind === 'out') score -= 260;
  return score;
}
