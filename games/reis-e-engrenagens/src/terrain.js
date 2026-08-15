// The ground: a heightmap of one column every four pixels across the whole
// field, and a hole punched in it every time something lands.
//
// A heightmap cannot hold an overhang, which is the one thing it gives up
// against a pixel field — and in exchange every question a shot asks ("what is
// the surface here", "is this castle still standing on anything") is a single
// array read instead of a scan. Craters are bowls: the surface drops to the
// bottom of the blast circle, which is what a crater looks like anyway.
//
// **The field is mirrored down the middle.** A shot from the left has exactly
// the distance a shot from the right has, and neither side got the better hill.

import { BASE_Y, CASTLE_X, CELL, COLS, COL_W, H, NCOL, W, clamp, makeRng } from './config.js';
import { terrainOf } from './materials.js';

/** The lowest the ground is allowed to go — below this a shot is simply gone. */
export const FLOOR_Y = H - 24;

/** How many turn-ends a crater face stays raw before the earth settles. */
export const SCAR_TURNS = 4;

export function buildTerrain({ kind = 'soil', seed = 1, middle = 'flat' } = {}) {
  const rng = makeRng(seed);
  const spec = terrainOf(kind);
  const h = new Float32Array(NCOL);
  const half = Math.ceil(NCOL / 2);

  // Three octaves of cosine-interpolated value noise. Written over the left
  // half only; the right half is a mirror, so the map is fair by construction.
  // The wavelengths are chosen against the open ground between the two plots,
  // and the mirror halves that: the distinct terrain is only the left half of
  // the valley. A first octave long enough to look majestic fitted less than two
  // nodes in there and came out as a straight line.
  const layers = [
    { step: 33, amp: 46 },
    { step: 15, amp: 22 },
    { step: 7, amp: 9 },
  ].map(({ step, amp }) => {
    const nodes = [];
    for (let i = 0; i <= Math.ceil(half / step) + 1; i++) nodes.push(rng() * 2 - 1);
    return { step, amp, nodes };
  });

  for (let i = 0; i < half; i++) {
    // A guaranteed swell under the noise. Three octaves of value noise can roll
    // a set of nodes that all land near zero, and when they do the valley comes
    // out as a table — which happened, on the level the player sees first.
    let y = BASE_Y - Math.cos(i / 17) * 28;
    for (const { step, amp, nodes } of layers) {
      const p = i / step;
      const a = nodes[Math.floor(p)];
      const b = nodes[Math.floor(p) + 1];
      const t = p - Math.floor(p);
      const s = (1 - Math.cos(t * Math.PI)) / 2;
      y -= (a + (b - a) * s) * amp;
    }
    h[i] = y;
  }

  // The middle is the piece of the map that is designed rather than rolled: a
  // hill in the way forces a high arc, a pit swallows anything short — and even
  // "flat" is not flat, it is a pair of shallow rises either side of the centre.
  // Noise alone could not be trusted with this: over the left half of the
  // valley there is room for three or four nodes, and a roll of the dice that
  // puts them all near zero produces a billiard table, which is what the first
  // level came out as.
  const bump = (centre, width, height) => {
    for (let i = 0; i < half; i++) {
      const d = Math.abs(i * COL_W - centre) / width;
      if (d >= 1) continue;
      h[i] -= height * Math.cos(d * Math.PI * 0.5) ** 2;
    }
  };
  if (middle === 'hill') bump(W / 2, 330, 186);
  else if (middle === 'pit') bump(W / 2, 330, -108);
  else bump(W / 2 - 430, 250, 74);

  // the world has a floor, and the map is not allowed to start below it —
  // a pit level that began underneath it swallowed shells on turn one
  for (let i = 0; i < half; i++) h[i] = Math.min(h[i], FLOOR_Y - 34);
  for (let i = 0; i < half; i++) h[NCOL - 1 - i] = h[i];

  // Which columns a shell has chewed, and how recently. Born terrain and
  // blasted terrain look alike to a heightmap, but they are different things
  // to walk on: a walker scrambles any slope the world was born with, and
  // refuses only the *raw* faces a fresh crater leaves behind. Raw is the
  // operative word — loose earth settles, so every scar carries a countdown
  // of turns and an old crater becomes ordinary ground again. Without the
  // countdown the artillery carpeted the valley in permanent roadblocks by
  // turn five, and the whole ground war stood in a queue looking at a lip.
  const scar = new Uint8Array(NCOL);

  const t = {
    kind,
    spec,
    h,
    scar,
    /** Has any column in this span been chewed by a shell, recently? */
    scarred(x0, x1) {
      const a = clamp(Math.floor(Math.min(x0, x1) / COL_W), 0, NCOL - 1);
      const b = clamp(Math.ceil(Math.max(x0, x1) / COL_W), 0, NCOL - 1);
      for (let i = a; i <= b; i++) if (scar[i]) return true;
      return false;
    },
    /** One turn of weather: every scar a step closer to being just ground. */
    settleScars() {
      for (let i = 0; i < NCOL; i++) if (scar[i] > 0) scar[i]--;
    },
    /** The surface at a world x. Off the map, the wall of the world. */
    yAt(x) {
      const i = clamp(Math.round(x / COL_W), 0, NCOL - 1);
      return h[i];
    },
    /** The highest point of ground over a span — what a block would rest on. */
    minIn(x0, x1) {
      const a = clamp(Math.floor(x0 / COL_W), 0, NCOL - 1);
      const b = clamp(Math.ceil(x1 / COL_W), 0, NCOL - 1);
      let m = Infinity;
      for (let i = a; i <= b; i++) if (h[i] < m) m = h[i];
      return m;
    },
    maxIn(x0, x1) {
      const a = clamp(Math.floor(x0 / COL_W), 0, NCOL - 1);
      const b = clamp(Math.ceil(x1 / COL_W), 0, NCOL - 1);
      let m = -Infinity;
      for (let i = a; i <= b; i++) if (h[i] > m) m = h[i];
      return m;
    },
    /**
     * Is this point inside the dirt?
     *
     * Note what is *not* here: a check that x is on the map. `yAt` clamps to the
     * end column, so the ground carries on past both edges — which is what stops
     * a shell that overshoots the last hill from sliding straight through it and
     * being counted a miss. The bounds check that used to be here made the two
     * ends of the world hollow.
     */
    solid(x, y) {
      return y >= t.yAt(x);
    },
    /**
     * Punch a bowl. The surface only ever drops — a heightmap has no way to
     * remember what was hollowed out under an untouched crust, so the crust
     * goes too. Returns how much earth actually moved, for the dust cloud.
     */
    carve(cx, cy, r) {
      if (r <= 0) return 0;
      const a = clamp(Math.floor((cx - r) / COL_W), 0, NCOL - 1);
      const b = clamp(Math.ceil((cx + r) / COL_W), 0, NCOL - 1);
      let moved = 0;
      for (let i = a; i <= b; i++) {
        const dx = i * COL_W - cx;
        if (Math.abs(dx) > r) continue;
        const dy = Math.sqrt(r * r - dx * dx);
        const bottom = Math.min(cy + dy, FLOOR_Y);
        // only where the circle actually reaches the surface: a blast in mid-air
        // over the ground leaves it alone
        if (cy - dy <= h[i] && bottom > h[i]) {
          moved += bottom - h[i];
          h[i] = bottom;
          scar[i] = SCAR_TURNS;
        }
      }
      return moved;
    },
    /** Pile earth back on — the lip a crater throws up around itself. */
    raise(cx, r, amount) {
      const a = clamp(Math.floor((cx - r) / COL_W), 0, NCOL - 1);
      const b = clamp(Math.ceil((cx + r) / COL_W), 0, NCOL - 1);
      for (let i = a; i <= b; i++) {
        const d = Math.abs(i * COL_W - cx) / r;
        if (d > 1) continue;
        h[i] -= amount * (1 - d) ** 2;
        scar[i] = SCAR_TURNS;
      }
    },
    snapshot() {
      return Array.from(h);
    },
    restore(list) {
      for (let i = 0; i < NCOL && i < list.length; i++) h[i] = list[i];
    },
  };

  // Only the two plots are levelled now. The siege engines used to stand on
  // pads of their own out in the open, which meant four flat regions and almost
  // no map left in between; up on the castles they take their ground with them.
  flatten(t, CASTLE_X.player - 20, CASTLE_X.player + COLS * CELL + 20, BASE_Y);
  flatten(t, CASTLE_X.enemy - 20, CASTLE_X.enemy + COLS * CELL + 20, BASE_Y);

  return t;
}

/** A castle needs a floor: level ground across its whole footprint, with a ramp. */
function flatten(t, x0, x1, y) {
  const a = clamp(Math.floor(x0 / COL_W), 0, NCOL - 1);
  const b = clamp(Math.ceil(x1 / COL_W), 0, NCOL - 1);
  for (let i = a; i <= b; i++) t.h[i] = y;
  // blend the 12 columns on each side so the plateau is not a cliff
  for (let k = 1; k <= 12; k++) {
    const w = k / 13;
    const l = a - k;
    const r = b + k;
    if (l >= 0) t.h[l] = t.h[l] * w + y * (1 - w);
    if (r < NCOL) t.h[r] = t.h[r] * w + y * (1 - w);
  }
}
