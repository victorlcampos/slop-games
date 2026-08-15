// The ground: a heightmap of 320 columns, and a hole punched in it every time
// something lands.
//
// A heightmap cannot hold an overhang, which is the one thing it gives up
// against a pixel field — and in exchange every question a shot asks ("what is
// the surface here", "is this castle still standing on anything") is a single
// array read instead of a scan. Craters are bowls: the surface drops to the
// bottom of the blast circle, which is what a crater looks like anyway.
//
// **The field is mirrored down the middle.** A shot from the left has exactly
// the distance a shot from the right has, and neither side got the better hill.

import { BASE_Y, CASTLE_X, CELL, COLS, COL_W, H, LAUNCH_X, NCOL, W, clamp, makeRng } from './config.js';
import { terrainOf } from './materials.js';

/** The lowest the ground is allowed to go — below this a shot is simply gone. */
export const FLOOR_Y = H - 24;

export function buildTerrain({ kind = 'soil', seed = 1, middle = 'flat' } = {}) {
  const rng = makeRng(seed);
  const spec = terrainOf(kind);
  const h = new Float32Array(NCOL);
  const half = Math.ceil(NCOL / 2);

  // Three octaves of cosine-interpolated value noise. Written over the left
  // half only; the right half is a mirror, so the map is fair by construction.
  // The two plateaus take most of the field, so the noise only has about 350px
  // of open ground to say anything in. Long wavelengths simply do not fit in
  // that window — with a 184px first octave the middle of the map came out as a
  // flat line — hence steps short enough to put two or three humps in the gap.
  const layers = [
    { step: 24, amp: 34 },
    { step: 11, amp: 15 },
    { step: 5, amp: 6 },
  ].map(({ step, amp }) => {
    const nodes = [];
    for (let i = 0; i <= Math.ceil(half / step) + 1; i++) nodes.push(rng() * 2 - 1);
    return { step, amp, nodes };
  });

  for (let i = 0; i < half; i++) {
    let y = BASE_Y;
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

  // The middle is the only piece of the map that is designed rather than
  // rolled: a hill in the way forces a high arc, a pit swallows anything short.
  if (middle !== 'flat') {
    for (let i = 0; i < half; i++) {
      const x = i * COL_W;
      const d = Math.abs(x - W / 2) / 190;
      if (d >= 1) continue;
      const bell = Math.cos(d * Math.PI * 0.5) ** 2;
      h[i] += middle === 'hill' ? -128 * bell : 96 * bell;
    }
  }

  for (let i = 0; i < half; i++) h[NCOL - 1 - i] = h[i];

  const t = {
    kind,
    spec,
    h,
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
    /** Is this point inside the dirt? */
    solid(x, y) {
      return x >= 0 && x <= W && y >= t.yAt(x);
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
      }
    },
    snapshot() {
      return Array.from(h);
    },
    restore(list) {
      for (let i = 0; i < NCOL && i < list.length; i++) h[i] = list[i];
    },
  };

  // One plateau per side, from the back of the castle to in front of its siege
  // engine. Levelling the two separately left a ramp between them whose blend
  // reached back into the castle's footprint and put a 1px slope under a wall —
  // enough for a support test to disagree with the picture on screen.
  flatten(t, CASTLE_X.player - 16, LAUNCH_X.player + 30, BASE_Y);
  flatten(t, LAUNCH_X.enemy - 30, CASTLE_X.enemy + COLS * CELL + 16, BASE_Y);

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

/**
 * Where a launcher's feet are now. It is not fixed: dig the pad out from under
 * a trebuchet and it drops into its own crater, which changes every shot it
 * takes afterwards. That is the cheapest counter-battery fire in the game.
 */
export function standHeight(terrain, x) {
  return Math.min(terrain.minIn(x - 22, x + 22), FLOOR_Y);
}
