// Two random streams, and the reason there are two.
//
// The house rule for this cabinet is that **difficulty changes the opponent's
// head, never the player's luck**. That sounds like it only concerns the dice
// roller, and it doesn't: an AI that draws from the same generator as the dice
// moves the dice by existing. A professional search that samples a hundred
// numbers while it deliberates leaves the next roll a hundred draws further
// down the stream than an easy one would — same seed, same board, different
// dice, and the harder opponent quietly got a different game.
//
// So a table owns two independent streams. `luck` is touched by dice, by the
// shuffle that lays a sudoku out, by nothing else. `mind` is the only one the
// AI is allowed to read, and how much of it it reads is its own business.
// `test/ai.test.mjs` holds a scenario over this: the same seed rolls the same
// dice at all four levels.

/**
 * mulberry32 — 32 bits of state, uniform enough for dice and fast enough to be
 * called inside a search. Written out rather than imported because a whole
 * dependency for nine lines is how a single-file game stops being one.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stream with the handful of shapes the games ask for. */
export function stream(seed) {
  const next = mulberry32(seed);
  const api = {
    next,
    /** 0 … n-1 */
    int: (n) => Math.floor(next() * n) % n,
    /** 1 … 6, which is the only die on this table */
    die: () => 1 + Math.floor(next() * 6),
    pick: (list) => list[Math.floor(next() * list.length) % list.length],
    /** Fisher-Yates, in place, so a shuffle is one pass and no allocation. */
    shuffle(list) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = list[i];
        list[i] = list[j];
        list[j] = t;
      }
      return list;
    },
  };
  return api;
}

/**
 * A table's randomness: two streams that never meet.
 *
 * The seeds are derived from one number so a whole match can be replayed from a
 * single value — and derived with different constants so the two streams don't
 * walk in step.
 */
export function createRandom(seed = Date.now()) {
  const s = seed >>> 0;
  return {
    seed: s,
    luck: stream((s ^ 0x9e3779b9) >>> 0),
    mind: stream((s * 2 + 0x85ebca6b) >>> 0),
  };
}

/** A seed for a fresh table. Kept here so nothing else has to think about it. */
export function freshSeed() {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}
