// Where the buttons are and which one a finger landed on. Pure layout — the
// renderer draws what this lays out, and the input asks it what got hit.

import { HUD_H, W } from './config.js';
import { SHOP } from './buildings.js';

export const TOOLS = ['rally', 'demolish'];
export const TRAINABLE = ['soldier', 'archer'];

/**
 * The command bar: shop, training, tools — one row of equal buttons across the
 * bottom. `viewW` is the logical width actually on screen; the bar never grows
 * past the board's own width, so it lines up with the town above it.
 */
export function barLayout(viewW, viewH) {
  const ids = [
    ...SHOP.map((id) => ({ kind: 'shop', id })),
    ...TRAINABLE.map((unit) => ({ kind: 'train', id: unit })),
    ...TOOLS.map((id) => ({ kind: 'tool', id })),
  ];
  const barW = Math.min(viewW, W);
  const x0 = (viewW - barW) / 2;
  const gap = 4;
  const bw = (barW - gap * (ids.length + 1)) / ids.length;
  const y = viewH - HUD_H + 8;
  const bh = HUD_H - 16;
  return ids.map((b, i) => ({ ...b, x: x0 + gap + i * (bw + gap), y, w: bw, h: bh }));
}

export function hit(rects, x, y) {
  for (const r of rects) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
  }
  return null;
}
