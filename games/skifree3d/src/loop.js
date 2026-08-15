// How much simulation one drawn frame is worth.

/**
 * The physics never takes a step larger than this. It is not a framerate cap:
 * it is the size past which the skier tunnels through a tree and the drag
 * integration stops behaving.
 */
export const MAX_STEP = 1 / 20;
/**
 * …and never more than this many steps in one frame. Without a ceiling a frame
 * that took a second would ask for a second of physics, which takes longer than
 * a second to compute, which makes the next frame worse: the spiral of death.
 */
export const MAX_STEPS = 4;

/**
 * Splits the time that really passed into steps the simulation can take.
 *
 * The old loop was `dt = min(elapsed, 1/20)` and simply threw the rest away, so
 * a phone drawing 6 frames a second ran the mountain at a third of real time —
 * the skier crawling, the seconds on the HUD limping, everything reading as
 * "the game is stuck" rather than "the phone is slow". Subdividing instead of
 * discarding keeps game time and wall clock together down to ~5 fps, and at
 * 60 fps it is exactly what the loop did before: one step of 1/60.
 */
export function planSteps(elapsed, { maxStep = MAX_STEP, maxSteps = MAX_STEPS } = {}) {
  if (!(elapsed > 0)) return { steps: 0, h: 0, dropped: 0 };
  const steps = Math.min(maxSteps, Math.ceil(elapsed / maxStep));
  const h = Math.min(maxStep, elapsed / steps);
  return { steps, h, dropped: elapsed - steps * h };
}
