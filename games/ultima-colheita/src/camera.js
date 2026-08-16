// The camera: where the eye is, how close it stands, and the promise that it
// never leaves the valley. All pure arithmetic — the input handlers feed it,
// the renderer reads it, and the tests can drive it without a screen.
//
// It exists because the game used to show all forty columns at once, and at
// that height a house is a stamp. The reference the game is chasing stands
// about fifteen tiles over the ground.

import { BOARD_H, BOARD_W, COLS, HUD_H, ROWS, TILE, clamp } from './config.js';

export const MAX_ZOOM = 3.2;
export const DEFAULT_ZOOM = 2.1;

export function createCamera(x = COLS / 2, y = ROWS / 2, zoom = DEFAULT_ZOOM) {
  return { x, y, zoom };
}

/** The zoom that fits the whole board above the command bar — the floor. */
export function fitZoom(viewW, viewH) {
  return Math.min(viewW / BOARD_W, (viewH - HUD_H) / BOARD_H);
}

/**
 * Keep the eye inside the valley: zoom between "whole board" and MAX, and the
 * view's edges never past the board's. When the view is wider than the board
 * (only at the fit floor), the board sits centred instead of sliding loose.
 */
export function clampCamera(cam, viewW, viewH) {
  cam.zoom = clamp(cam.zoom, fitZoom(viewW, viewH), MAX_ZOOM);
  const halfW = viewW / (2 * cam.zoom * TILE);
  const halfH = (viewH - HUD_H) / (2 * cam.zoom * TILE);
  cam.x = halfW >= COLS / 2 ? COLS / 2 : clamp(cam.x, halfW, COLS - halfW);
  cam.y = halfH >= ROWS / 2 ? ROWS / 2 : clamp(cam.y, halfH, ROWS - halfH);
  return cam;
}

/** The camera as the renderer wants it: scale and offset in logical pixels. */
export function cameraTransform(cam, viewW, viewH) {
  const k = cam.zoom;
  return {
    k,
    ox: viewW / 2 - cam.x * TILE * k,
    oy: (viewH - HUD_H) / 2 - cam.y * TILE * k,
  };
}

/** A screen point into tile coordinates (fractional). */
export function toBoard(tr, x, y) {
  return { x: (x - tr.ox) / (tr.k * TILE), y: (y - tr.oy) / (tr.k * TILE) };
}

/**
 * Zoom by `factor` keeping the board point under (sx, sy) exactly where it
 * is — the way every map application does it, because anything else makes the
 * world slide out from under the cursor.
 */
export function zoomAt(cam, viewW, viewH, factor, sx, sy) {
  const before = toBoard(cameraTransform(cam, viewW, viewH), sx, sy);
  cam.zoom = clamp(cam.zoom * factor, fitZoom(viewW, viewH), MAX_ZOOM);
  const after = toBoard(cameraTransform(cam, viewW, viewH), sx, sy);
  cam.x += before.x - after.x;
  cam.y += before.y - after.y;
  return clampCamera(cam, viewW, viewH);
}

// ---------------------------------------------------------------- minimap

/** Where the minimap sits: bottom-right, above the command bar. */
export function minimapRect(viewW, viewH) {
  const w = 168;
  const h = Math.round((w * ROWS) / COLS);
  return { x: viewW - w - 12, y: viewH - HUD_H - h - 12, w, h };
}

/** A point on the minimap into tile coordinates — for tap-to-jump. */
export function minimapToBoard(rect, x, y) {
  return {
    x: clamp(((x - rect.x) / rect.w) * COLS, 0, COLS),
    y: clamp(((y - rect.y) / rect.h) * ROWS, 0, ROWS),
  };
}
