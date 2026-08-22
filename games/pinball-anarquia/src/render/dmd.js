// The dot-matrix display, the way the real ones are built.
//
// A DMD is a grid of lamps, and text on it is whichever lamps the letters
// happen to cover. So rather than shipping a bitmap font — a table of glyphs
// that would have to grow a row for every accent Portuguese wants — the text
// is drawn once into a canvas exactly as many pixels wide as the display has
// dots, and then read back: a lit pixel is a lit lamp. Any font, any language,
// no glyph table, and `á` costs nothing.
//
// The read-back is the expensive part, so the answer is cached by the exact
// text being shown. Between two frames of the same score, nothing is computed.

import { makeCanvas } from './util.js';

const cache = new Map();
let scratch = null;

/**
 * @param {number} cols  dots across
 * @param {number} rows  dots down
 * @param {function} compose  (ctx) => void, drawing into a cols x rows canvas
 * @param {string} key  what makes this composition unique
 * @returns {Uint8Array} one byte per dot, row-major, 0 or 1
 */
export function dots(cols, rows, key, compose) {
  const id = `${cols}x${rows}:${key}`;
  const hit = cache.get(id);
  if (hit) return hit;

  if (!scratch || scratch.width !== cols || scratch.height !== rows) {
    scratch = makeCanvas(cols, rows);
  }
  const g = scratch.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, cols, rows);
  g.fillStyle = '#fff';
  g.textBaseline = 'alphabetic';
  compose(g);

  const px = g.getImageData(0, 0, cols, rows).data;
  const out = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    // any coverage at all lights the lamp: a DMD has no half-brightness, and
    // thresholding at 50% eats the thin strokes of small text entirely
    out[i] = px[i * 4 + 3] > 60 ? 1 : 0;
  }

  // the cache is keyed by text, and a score changes every hit — so it is
  // bounded rather than unbounded, oldest out first
  if (cache.size > 120) cache.delete(cache.keys().next().value);
  cache.set(id, out);
  return out;
}

/** The dim grid behind the text — every dot the display has, unlit. */
export function gridSprite(cols, rows, pitch, color) {
  const c = makeCanvas(Math.ceil(cols * pitch), Math.ceil(rows * pitch));
  const g = c.getContext('2d');
  g.fillStyle = color;
  const r = pitch * 0.3;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.beginPath();
      g.arc((x + 0.5) * pitch, (y + 0.5) * pitch, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

/**
 * Paint the lit lamps of a composition at (x, y).
 *
 * The drawn result is cached, not just the bit pattern: a score fills five
 * hundred lamps and drawing five hundred arcs every frame for a number that
 * changes a few times a second is the same picture computed sixty times over.
 */
const painted = new Map();

export function paintDots(ctx, bits, cols, rows, x, y, pitch, color, radius = 0.42) {
  const key = `${cols}x${rows}@${pitch.toFixed(2)}:${color}:${hash(bits)}`;
  let layer = painted.get(key);
  if (!layer) {
    layer = makeCanvas(Math.ceil(cols * pitch), Math.ceil(rows * pitch));
    const g = layer.getContext('2d');
    g.fillStyle = color;
    const r = pitch * radius;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!bits[row * cols + col]) continue;
        g.beginPath();
        g.arc((col + 0.5) * pitch, (row + 0.5) * pitch, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (painted.size > 40) painted.delete(painted.keys().next().value);
    painted.set(key, layer);
  }
  ctx.drawImage(layer, x, y);
}

/** Cheap and good enough to tell two dot patterns apart. */
function hash(bits) {
  let h = 2166136261;
  for (let i = 0; i < bits.length; i++) {
    h ^= bits[i];
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
