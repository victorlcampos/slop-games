// The game's viewport — today just a thin adapter over slopkit.
//
// The elastic width was born here and became `slopkit/viewport`; the adaptive
// devicePixelRatio ceiling came back from Zoo Tycoon along with it. This file
// still exists because the rest of the game imports `vp`, `margin()` and
// `HEIGHT` — swapping that in twenty places wouldn't pay for the noise.

import { createViewport } from 'slopkit/viewport';

export const HEIGHT = 720;
export const FRAME = 1280;

/** A stable object: the rest of the game keeps the reference and reads fields. */
export const vp = { W: 1280, H: HEIGHT, scale: 1, dpr: 1, touch: false, turned: false };

let kit = null;

export function resize(canvas) {
  // `landscape`: the board is nine columns wide and never fitted upright. The
  // game used to cover itself with a "turn your device" card, which asks the
  // player to unlock rotation on their phone before they can play. Now the kit
  // lays the canvas on its side and the game runs as it is held.
  if (!kit) kit = createViewport(canvas, { height: HEIGHT, frame: FRAME, landscape: true });
  const widthChanged = kit.resize();
  vp.W = kit.W;
  vp.H = kit.H;
  vp.scale = kit.scale;
  vp.dpr = kit.dpr;
  vp.touch = kit.touch;
  vp.turned = kit.turned;
  return widthChanged;
}

export function begin(ctx) {
  kit.begin();
  // the kit may have re-fitted on its own after spotting a rotation; mirror it
  vp.W = kit.W;
  vp.scale = kit.scale;
  vp.dpr = kit.dpr;
  vp.touch = kit.touch;
  vp.turned = kit.turned;
}

/**
 * Fires when the logical width changes — including when it is the kit's
 * `begin` that notices, rather than the resize event.
 */
export function watch(onChange) {
  return kit.watch(() => {
    vp.W = kit.W;
    vp.scale = kit.scale;
    vp.dpr = kit.dpr;
    vp.touch = kit.touch;
    vp.turned = kit.turned;
    onChange();
  });
}

export function pointIn(canvas, clientX, clientY) {
  return kit.point(clientX, clientY);
}

// Menu screens were composed on a fixed 1280x720 board. The battle doesn't use
// this — there the extra width is real field — but a menu is a diagram: it has
// to fit whole.
//
// Viewport wider than the board: centre it. Viewport narrower (a 16:10 gives
// 1152 of logical width!): shrink to fit. Before this, the world map simply
// spilled off the right edge on any monitor that wasn't 16:9.

function frameFactor() {
  return Math.min(1, vp.W / FRAME);
}

/** Applies the frame to the context. Returns the factor, if you need it. */
export function applyFrame(ctx) {
  const k = frameFactor();
  ctx.translate((vp.W - FRAME * k) / 2, (HEIGHT - HEIGHT * k) / 2);
  ctx.scale(k, k);
  return k;
}

/** Converts a screen point into the frame — the inverse of the above. */
export function pointInFrame(x, y) {
  const k = frameFactor();
  return {
    x: (x - (vp.W - FRAME * k) / 2) / k,
    y: (y - (HEIGHT - HEIGHT * k) / 2) / k,
  };
}

/** Inside the frame the width is always the same: it is a drawing board. */
export function menuWidth() {
  return FRAME;
}

/** @deprecated use applyFrame/pointInFrame */
export function margin() {
  return Math.max(0, (vp.W - FRAME) / 2);
}

export { isTouch } from 'slopkit/viewport';
