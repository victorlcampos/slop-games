// The furniture four of these games share: a square board in a wooden frame,
// with the light coming from the upper left.
//
// Chess, draughts, reversi and noughts and crosses are the same object with
// different paint, and the parts that are genuinely shared are the ones that
// are easy to get subtly wrong twice: where the board sits when the window is
// wider than it is tall, which square a finger landed on when the board is
// flipped, and the fact that a wood texture is expensive enough that it must be
// generated once and reused — not once per frame, and not once per square.

import { woodTile, feltTile, marbleTile, roundRect, shadow, fitText } from '../render/paint.js';
import { TABLE } from '../theme.js';

/**
 * Where the board goes. The logical viewport is 720 tall and elastic wide
 * (slopkit), so on a phone held upright the board is as wide as the screen and
 * on a monitor it is as tall as the room allows, with the HUD living in the
 * margin either way.
 */
export function fitBoard(W, H, { top = 96, bottom = 92, side = 24, ratio = 1 } = {}) {
  const roomW = W - side * 2;
  const roomH = H - top - bottom;
  const size = Math.max(120, Math.min(roomW / ratio, roomH));
  const w = size * ratio;
  return {
    x: Math.round((W - w) / 2),
    y: Math.round(top + (roomH - size) / 2),
    w: Math.round(w),
    h: Math.round(size),
  };
}

/** Squares of a grid board, in the order they are drawn. */
export function grid(box, cols, rows = cols) {
  const cell = Math.min(box.w / cols, box.h / rows);
  return {
    ...box,
    cols,
    rows,
    cell,
    x: box.x + (box.w - cell * cols) / 2,
    y: box.y + (box.h - cell * rows) / 2,
    w: cell * cols,
    h: cell * rows,
  };
}

/** Top-left corner of a square, honouring the flip. */
export function cellXY(g, index, flip = false) {
  const i = flip ? g.cols * g.rows - 1 - index : index;
  return { x: g.x + (i % g.cols) * g.cell, y: g.y + Math.floor(i / g.cols) * g.cell };
}

/** Centre of a square. */
export function cellCentre(g, index, flip = false) {
  const p = cellXY(g, index, flip);
  return { x: p.x + g.cell / 2, y: p.y + g.cell / 2 };
}

/** Which square a point landed on, or -1. */
export function cellAt(g, px, py, flip = false) {
  const c = Math.floor((px - g.x) / g.cell);
  const r = Math.floor((py - g.y) / g.cell);
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return -1;
  const i = r * g.cols + c;
  return flip ? g.cols * g.rows - 1 - i : i;
}

// The texture cache. Wood is a few thousand strokes; regenerating it per frame
// costs more than everything else on screen put together. The key carries the
// size and the palette, so a resize builds new tiles and a repaint does not.
const cache = new Map();

export function texture(kind, w, h, palette, opts = {}) {
  const key = `${kind}|${Math.round(w)}x${Math.round(h)}|${palette.base || palette}|${JSON.stringify(opts)}`;
  let hit = cache.get(key);
  if (!hit) {
    hit =
      kind === 'felt'
        ? feltTile(w, h, palette, opts.seed || 5)
        : kind === 'paper'
          ? marbleTile(w, h, palette, opts.seed || 9)
          : woodTile(w, h, palette, opts);
    cache.set(key, hit);
    // a cache that only grows is a leak with good manners
    if (cache.size > 40) cache.delete(cache.keys().next().value);
  }
  return hit;
}

/**
 * The frame around a board: a wooden rim, a bevel that catches the light on two
 * sides, and a shadow under the whole thing so it sits *on* the table rather
 * than being painted on it.
 */
export function drawFrame(ctx, g, palette, { rim = 22, radius = 10, inner = true } = {}) {
  const x = g.x - rim;
  const y = g.y - rim;
  const w = g.w + rim * 2;
  const h = g.h + rim * 2;

  shadow(ctx, () => {
    roundRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = palette.dark;
    ctx.fill();
  }, { blur: 34, y: 16, colour: 'rgba(0,0,0,0.55)' });

  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.drawImage(texture('wood', w, h, palette, { seed: 2, dir: 'h' }), x, y);
  // the bevel
  const light = ctx.createLinearGradient(x, y, x + w * 0.4, y + h * 0.4);
  light.addColorStop(0, 'rgba(255,235,200,0.28)');
  light.addColorStop(1, 'rgba(255,235,200,0)');
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w, h);
  const dark = ctx.createLinearGradient(x + w, y + h, x + w * 0.55, y + h * 0.55);
  dark.addColorStop(0, 'rgba(0,0,0,0.35)');
  dark.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = dark;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  if (inner) {
    // the playing surface is sunk into the frame: a dark line and a light one,
    // in that order, and the board stops looking like a sticker
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(g.x - 1.5, g.y - 1.5, g.w + 3, g.h + 3);
    ctx.strokeStyle = 'rgba(255,230,190,0.18)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(g.x - 3.5, g.y - 3.5, g.w + 7, g.h + 7);
    ctx.restore();
  }
}

/** The chequerboard itself, in two woods. */
export function drawSquares(ctx, g, lightWood, darkWood) {
  const cell = Math.ceil(g.cell);
  const pale = texture('wood', cell, cell, lightWood, { seed: 4, dir: 'h', rings: false });
  const deep = texture('wood', cell, cell, darkWood, { seed: 9, dir: 'v', rings: false });
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const x = g.x + c * g.cell;
      const y = g.y + r * g.cell;
      ctx.drawImage((r + c) % 2 ? deep : pale, Math.round(x), Math.round(y), Math.ceil(g.cell) + 1, Math.ceil(g.cell) + 1);
    }
  }
  // one soft sheen across the whole surface, so the board reads as one varnished
  // panel rather than sixty-four tiles
  const sheen = ctx.createLinearGradient(g.x, g.y, g.x + g.w * 0.7, g.y + g.h);
  sheen.addColorStop(0, 'rgba(255,255,255,0.1)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.02)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = sheen;
  ctx.fillRect(g.x, g.y, g.w, g.h);
}

/** File letters and rank numbers, engraved into the frame. */
export function drawCoords(ctx, g, flip, { files = 'abcdefgh', ranks = '87654321', rim = 22 } = {}) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,230,190,0.42)';
  const size = Math.max(9, Math.min(13, g.cell * 0.22));
  ctx.font = `600 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let c = 0; c < g.cols; c++) {
    const letter = flip ? files[g.cols - 1 - c] : files[c];
    ctx.fillText(letter, g.x + (c + 0.5) * g.cell, g.y + g.h + rim / 2);
  }
  ctx.textAlign = 'center';
  for (let r = 0; r < g.rows; r++) {
    const number = flip ? ranks[g.rows - 1 - r] : ranks[r];
    ctx.fillText(number, g.x - rim / 2, g.y + (r + 0.5) * g.cell);
  }
  ctx.restore();
}

/** The room: felt, a warm pool of light, and the vignette that closes it in. */
export function drawTable(ctx, W, H, { felt = TABLE.felt, seed = 5 } = {}) {
  ctx.drawImage(texture('felt', Math.min(W, 640), Math.min(H, 400), felt, { seed }), 0, 0, W, H);
  const pool = ctx.createRadialGradient(W * 0.5, H * 0.38, 40, W * 0.5, H * 0.5, Math.max(W, H) * 0.62);
  pool.addColorStop(0, 'rgba(255,236,200,0.14)');
  pool.addColorStop(0.55, 'rgba(255,236,200,0.03)');
  pool.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, W, H);
}

/** A square highlight that does not cover the piece standing on it. */
export function markSquare(ctx, g, index, flip, colour, { style = 'ring', alpha = 1 } = {}) {
  const p = cellXY(g, index, flip);
  const cell = g.cell;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (style === 'fill') {
    ctx.fillStyle = colour;
    ctx.fillRect(p.x, p.y, cell, cell);
  } else if (style === 'dot') {
    ctx.beginPath();
    ctx.arc(p.x + cell / 2, p.y + cell / 2, cell * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
  } else if (style === 'target') {
    // a ring, for a square that already has a piece to be taken on it
    ctx.beginPath();
    ctx.arc(p.x + cell / 2, p.y + cell / 2, cell * 0.44, 0, Math.PI * 2);
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(3, cell * 0.08);
    ctx.stroke();
  } else {
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(2, cell * 0.05);
    ctx.strokeRect(p.x + ctx.lineWidth / 2, p.y + ctx.lineWidth / 2, cell - ctx.lineWidth, cell - ctx.lineWidth);
  }
  ctx.restore();
}

/** A brass plate with a word on it — used by the boards that need a label. */
export function plate(ctx, x, y, w, h, text, { size = 13 } = {}) {
  ctx.save();
  roundRect(ctx, x, y, w, h, h * 0.28);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, TABLE.brass.light);
  g.addColorStop(0.5, TABLE.brass.base);
  g.addColorStop(1, TABLE.brass.dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  fitText(ctx, text, x + w / 2, y + h / 2 + 0.5, w - 12, { size, weight: 700, colour: 'rgba(40,26,6,0.9)' });
  ctx.restore();
}
