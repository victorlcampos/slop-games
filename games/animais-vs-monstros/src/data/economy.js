// The reward maths, kept out of the screen so it fits in a unit test.
//
// One function for both winning and losing, because the rules are the same with
// different weights — two functions would diverge on the first change.

/**
 * @param {object} stage   the stage played (uses `coins` and `waves`)
 * @param {object} summary what the battle returned
 * @param {boolean} won
 * @param {boolean} firstTime  whether the stage had not been won before
 */
export function calcReward(stage, summary, won, firstTime) {
  const full = stage.coins;

  let base;
  if (won) {
    base = full;
  } else {
    // Losing pays for what you held: the fraction of waves that went past.
    // Losing on the last wave is worth nearly three times more than giving up
    // on the first, and trying a hard stage stops being time thrown away.
    const total = (stage.waves && stage.waves.length) || 1;
    const progress = Math.min(1, Math.max(0, ((summary.currentWave ?? -1) + 1) / total));
    base = Math.round(full * (0.12 + 0.23 * progress));
  }

  // Replaying a stage already won pays 30%: without that, stage 1 becomes a
  // cash machine.
  if (!firstTime) base = Math.round(base * 0.3);

  // Leftover seed turns into coin at 5 to 1. The 35%-of-full-reward ceiling
  // exists so "don't plant" never becomes a strategy — anyone hoarding seed to
  // convert loses the stage before reaching the till.
  const change = Math.min(Math.floor((summary.leftover || 0) / 5), Math.round(full * 0.35));

  return { base, change, total: base + change };
}
