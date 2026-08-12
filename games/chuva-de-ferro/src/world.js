// The road, which never ends.
//
// There is no level: the ground is a function of x, and the things standing on
// it are decided by the segment they belong to. Both are pure functions of the
// world seed, so the same run gives the same road twice — and a test can walk a
// kilometre of it without a canvas.
//
// Three kinds of obstacle, and each teaches one button:
//   rock     a block on the road          → jump
//   arch     a stone ceiling over the road → crouch
//   cave     a longer, lower arch          → crouch and keep walking
// A landed safe or fridge joins the same list at runtime, which is what makes
// them worth shooting down where you want them.

import { GROUND, hash2 } from './config.js';

export const SEG = 620;             // one segment of road
const FEATURE_START = 900;          // the first stretch is clear: you land running

/** Smooth 1D value noise from the hash — cheap and deterministic. */
function noise(x, seed, scale) {
  const t = x / scale;
  const i = Math.floor(t);
  const f = t - i;
  const s = f * f * (3 - 2 * f);
  const a = hash2(i, seed);
  const b = hash2(i + 1, seed);
  return a + (b - a) * s;
}

export function createWorld(seed = 1) {
  const segments = new Map();

  /** Height of the road at `x`. Lower y is higher ground. */
  function groundAt(x) {
    let y = GROUND;
    y -= noise(x, seed, 900) * 90;          // long dunes
    y -= noise(x, seed + 31, 260) * 34;     // folds
    y -= noise(x, seed + 77, 90) * 9;       // gravel
    return y;
  }

  /**
   * Keeps a roof inside its own segment. It matters more than it looks: a
   * segment holds a roof OR rocks, never both, so a ceiling that spilled into
   * the next one could put a rock under a cave — crouched, unable to jump,
   * nothing to do but walk back and forth. That is a trap, not an obstacle.
   */
  function fit(index, x0, w) {
    const room = Math.max(0, SEG - w - 80);
    return x0 + 40 + hash2(index, seed + 12) * room;
  }

  function buildSegment(index) {
    const x0 = index * SEG;
    const solids = [];
    const roof = [];
    if (x0 >= FEATURE_START) {
      const pick = hash2(index, seed + 991);
      const where = x0 + 120 + hash2(index, seed + 12) * (SEG - 320);
      if (pick < 0.34) {
        // a rock, or a small stack of them: jump
        const n = 1 + Math.floor(hash2(index, seed + 5) * 2.6);
        for (let i = 0; i < n; i++) {
          const w = 44 + hash2(index, seed + 40 + i) * 34;
          const h = 46 + hash2(index, seed + 60 + i) * 58;
          const x = where + i * (w + 6);
          solids.push({ kind: 'rock', x, y: groundAt(x + w / 2) - h, w, h });
        }
      } else if (pick < 0.58) {
        // an arch: a ceiling low enough that standing up under it stops you
        const w = 190 + hash2(index, seed + 7) * 150;
        const clear = 52 + hash2(index, seed + 9) * 14;
        roof.push({ kind: 'arch', x: fit(index, x0, w), w, clear });
      } else if (pick < 0.72) {
        // a cave: the same idea, long enough that you cross it crouched
        const w = 420 + hash2(index, seed + 8) * 90;
        const clear = 48 + hash2(index, seed + 3) * 10;
        roof.push({ kind: 'cave', x: fit(index, x0, w), w, clear });
      }
      // the rest of the segments are open road — the game needs room to breathe
    }
    const seg = { index, x0, solids, roof, props: [] };
    segments.set(index, seg);
    return seg;
  }

  function segment(index) {
    return segments.get(index) || buildSegment(index);
  }

  /** Make sure everything between two x is generated, and forget what is behind. */
  function ensure(from, to) {
    const a = Math.floor(from / SEG) - 1;
    const b = Math.floor(to / SEG) + 1;
    for (let i = a; i <= b; i++) segment(i);
    for (const key of segments.keys()) {
      if (key < a - 3 || key > b + 3) segments.delete(key);
    }
  }

  /** Everything solid near `x`: the road's own rocks plus whatever landed. */
  function solidsNear(x, span = SEG) {
    const out = [];
    const a = Math.floor((x - span) / SEG);
    const b = Math.floor((x + span) / SEG);
    for (let i = a; i <= b; i++) {
      const seg = segments.get(i);
      if (!seg) continue;
      for (const s of seg.solids) out.push(s);
      for (const p of seg.props) out.push(p);
    }
    return out;
  }

  /**
   * The lowest ceiling over `x`, as an absolute y — and **-Infinity is open
   * sky**, not Infinity: a ceiling is a y, and higher up is a smaller number.
   * Getting that backwards left the soldier permanently crouched on an empty
   * road, walking at 45% speed with nothing over his head.
   */
  function ceilingAt(x) {
    let best = -Infinity;
    const a = Math.floor((x - SEG) / SEG);
    const b = Math.floor((x + SEG) / SEG);
    for (let i = a; i <= b; i++) {
      const seg = segments.get(i);
      if (!seg) continue;
      for (const r of seg.roof) {
        if (x >= r.x && x <= r.x + r.w) best = Math.max(best, groundAt(x) - r.clear);
      }
    }
    return best;
  }

  /** Roof spans near `x`, for the renderer. */
  function roofNear(x, span = SEG * 2) {
    const out = [];
    const a = Math.floor((x - span) / SEG);
    const b = Math.floor((x + span) / SEG);
    for (let i = a; i <= b; i++) {
      const seg = segments.get(i);
      if (seg) for (const r of seg.roof) out.push(r);
    }
    return out;
  }

  /** A piece of cargo that landed and stayed: from here on it is scenery. */
  function addProp(prop) {
    const seg = segment(Math.floor(prop.x / SEG));
    seg.props.push(prop);
    return prop;
  }

  ensure(0, SEG * 3);

  return {
    seed, groundAt, ceilingAt, solidsNear, roofNear, ensure, addProp,
    segment, get count() { return segments.size; },
  };
}

/** Where the top of a solid is, under a point — or the road if there is none. */
export function surfaceAt(world, x, fromY) {
  let y = world.groundAt(x);
  for (const s of world.solidsNear(x, 200)) {
    if (x < s.x || x > s.x + s.w) continue;
    if (s.y >= fromY - 4 && s.y < y) y = s.y;
  }
  return y;
}
