// The pieces, drawn rather than fetched.
//
// A Staunton set is a handful of turned shapes stacked on a disc: a foot, a
// collar, a body that narrows, and a head that says which piece it is. That is
// how these are built — one `stack()` helper lays down the parts every piece
// shares, and each piece only draws its own top.
//
// Three details do most of the work, and all three are cheap:
//
//   * the silhouette is filled with a vertical gradient, so the piece is lit
//     from above like everything else on the table;
//   * a second, narrower gradient is painted down the left third — that is the
//     sheen on turned wood, and without it ivory reads as flat paper;
//   * every part is outlined in the palette's `edge`, which is what keeps a
//     white piece legible on a light square.
//
// Everything is drawn in units of one square, centred on (0,0), so a piece is
// `ctx.translate(cx, cy); ctx.scale(size, size)` away from any board.

import { shadow } from './paint.js';

export const CHESS_ORDER = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

/** Type ids from the rules module (1..6) to the names used here. */
export const CHESS_NAME = { 1: 'pawn', 2: 'knight', 3: 'bishop', 4: 'rook', 5: 'queen', 6: 'king' };

/**
 * Draw a chess piece filling a square of `size` pixels centred on (cx, cy).
 * `facing` is -1 for the side playing up the board, which only the knight cares
 * about — a set where both knights look the same way is a set where one player
 * is looking at the back of their own horse.
 */
export function chessPiece(ctx, type, cx, cy, size, palette, { facing = 1, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(size, size);
  ctx.lineWidth = 0.022;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = palette.edge;

  shadow(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(0.02, 0.4, 0.3, 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
  }, { blur: 0.09, y: 0.02, colour: 'rgba(0,0,0,0.55)' });

  const body = ctx.createLinearGradient(0, -0.45, 0, 0.42);
  body.addColorStop(0, palette.light);
  body.addColorStop(0.42, palette.base);
  body.addColorStop(1, palette.dark);
  ctx.fillStyle = body;

  const name = typeof type === 'number' ? CHESS_NAME[type] : type;
  ({ pawn, knight, bishop, rook, queen, king })[name](ctx, facing);

  // the sheen: a soft vertical band down the light side of the turning
  ctx.save();
  ctx.clip();
  const sheen = ctx.createLinearGradient(-0.26, 0, 0.06, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.30)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-0.5, -0.5, 1, 1);
  ctx.restore();
  ctx.restore();
}

/** The foot every piece stands on: a disc, a bevel and a collar. */
function foot(ctx, width = 0.3, top = 0.28) {
  ctx.beginPath();
  ctx.moveTo(-width, 0.4);
  ctx.quadraticCurveTo(-width, 0.32, -width * 0.78, 0.3);
  ctx.lineTo(-width * 0.62, top);
  ctx.lineTo(width * 0.62, top);
  ctx.lineTo(width * 0.78, 0.3);
  ctx.quadraticCurveTo(width, 0.32, width, 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** A ring around the body — the turned collar under a head. */
function collar(ctx, y, width, height = 0.045) {
  ctx.beginPath();
  ctx.ellipse(0, y, width, height, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function pawn(ctx) {
  foot(ctx, 0.26, 0.28);
  ctx.beginPath();
  ctx.moveTo(-0.16, 0.28);
  ctx.bezierCurveTo(-0.15, 0.14, -0.09, 0.09, -0.085, 0.02);
  ctx.lineTo(0.085, 0.02);
  ctx.bezierCurveTo(0.09, 0.09, 0.15, 0.14, 0.16, 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  collar(ctx, 0.02, 0.14, 0.042);
  ctx.beginPath();
  ctx.arc(0, -0.12, 0.135, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function rook(ctx) {
  foot(ctx, 0.3, 0.28);
  ctx.beginPath();
  ctx.moveTo(-0.2, 0.28);
  ctx.bezierCurveTo(-0.17, 0.12, -0.17, 0.02, -0.185, -0.08);
  ctx.lineTo(0.185, -0.08);
  ctx.bezierCurveTo(0.17, 0.02, 0.17, 0.12, 0.2, 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // the cornice, then the battlements cut out of it
  ctx.beginPath();
  ctx.moveTo(-0.25, -0.08);
  ctx.lineTo(0.25, -0.08);
  ctx.lineTo(0.24, -0.19);
  ctx.lineTo(-0.24, -0.19);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const x of [-0.24, -0.08, 0.08]) {
    ctx.beginPath();
    ctx.rect(x, -0.32, 0.16, 0.13);
    ctx.fill();
    ctx.stroke();
  }
}

function bishop(ctx) {
  foot(ctx, 0.27, 0.28);
  ctx.beginPath();
  ctx.moveTo(-0.17, 0.28);
  ctx.bezierCurveTo(-0.155, 0.14, -0.1, 0.09, -0.095, 0.04);
  ctx.lineTo(0.095, 0.04);
  ctx.bezierCurveTo(0.1, 0.09, 0.155, 0.14, 0.17, 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  collar(ctx, 0.04, 0.155, 0.045);
  // the mitre
  ctx.beginPath();
  ctx.moveTo(0, -0.34);
  ctx.bezierCurveTo(0.15, -0.24, 0.17, -0.09, 0.13, 0.0);
  ctx.lineTo(-0.13, 0.0);
  ctx.bezierCurveTo(-0.17, -0.09, -0.15, -0.24, 0, -0.34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // the slit, which is the only thing that says bishop rather than pawn
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.036;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.07, -0.2);
  ctx.lineTo(0.075, -0.045);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, -0.38, 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function knight(ctx, facing) {
  ctx.save();
  ctx.scale(facing, 1);
  foot(ctx, 0.28, 0.28);
  ctx.beginPath();
  ctx.moveTo(-0.19, 0.28);
  ctx.bezierCurveTo(-0.17, 0.2, -0.15, 0.16, -0.13, 0.12);
  ctx.lineTo(0.17, 0.12);
  ctx.bezierCurveTo(0.19, 0.18, 0.2, 0.22, 0.21, 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // The head, walked once round the profile in the order a horse actually has
  // one: up the chest, out along the jaw, down to the muzzle, up the face to
  // the brow, the ear, and back down the crest with the mane cut into it.
  // The first version curved the muzzle upwards and got a cat.
  ctx.beginPath();
  ctx.moveTo(-0.14, 0.12);
  ctx.bezierCurveTo(-0.2, 0.04, -0.24, -0.04, -0.25, -0.1);      // throat
  ctx.bezierCurveTo(-0.3, -0.12, -0.34, -0.16, -0.325, -0.22);   // muzzle, forward and low
  ctx.bezierCurveTo(-0.32, -0.27, -0.27, -0.28, -0.22, -0.27);   // and full at the nose
  ctx.bezierCurveTo(-0.18, -0.31, -0.14, -0.35, -0.08, -0.38);   // face up to the brow
  ctx.bezierCurveTo(-0.05, -0.42, -0.03, -0.45, 0.0, -0.46);     // poll
  ctx.lineTo(0.035, -0.53);                                       // the ear
  ctx.lineTo(0.075, -0.44);
  ctx.bezierCurveTo(0.12, -0.4, 0.15, -0.34, 0.16, -0.27);       // crest
  ctx.lineTo(0.1, -0.25);                                         // mane, notch one
  ctx.lineTo(0.17, -0.19);
  ctx.lineTo(0.11, -0.16);                                        // notch two
  ctx.lineTo(0.19, -0.09);
  ctx.lineTo(0.13, -0.05);                                        // notch three
  ctx.bezierCurveTo(0.19, 0.01, 0.19, 0.07, 0.17, 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // the eye and the nostril: two dots, and the difference between a shape and
  // an animal
  ctx.beginPath();
  ctx.arc(-0.115, -0.315, 0.023, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-0.285, -0.2, 0.018, 0, Math.PI * 2);
  ctx.fill();
  // the cheek, a single soft line — it is what gives the head a jaw
  ctx.beginPath();
  ctx.moveTo(-0.16, -0.26);
  ctx.bezierCurveTo(-0.13, -0.19, -0.13, -0.13, -0.16, -0.08);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.018;
  ctx.stroke();
  ctx.restore();
}

function queen(ctx) {
  foot(ctx, 0.3, 0.28);
  ctx.beginPath();
  ctx.moveTo(-0.19, 0.28);
  ctx.bezierCurveTo(-0.17, 0.1, -0.1, 0.02, -0.1, -0.06);
  ctx.lineTo(0.1, -0.06);
  ctx.bezierCurveTo(0.1, 0.02, 0.17, 0.1, 0.19, 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  collar(ctx, -0.06, 0.16, 0.045);
  // the crown: a bowl with points, each finished with a pearl
  ctx.beginPath();
  ctx.moveTo(-0.21, -0.12);
  ctx.bezierCurveTo(-0.2, -0.24, -0.12, -0.28, 0, -0.28);
  ctx.bezierCurveTo(0.12, -0.28, 0.2, -0.24, 0.21, -0.12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Five points, short and thick with a pearl on each. Long thin spikes read as
  // antennae at board size — the crown has to still be a crown at 40 pixels.
  const points = [-0.185, -0.095, 0, 0.095, 0.185];
  for (const x of points) {
    const lift = 0.055 - Math.abs(x) * 0.12;
    const tip = -0.31 - lift;
    ctx.beginPath();
    ctx.moveTo(x - 0.062, -0.22);
    ctx.quadraticCurveTo(x - 0.03, -0.28, x, tip);
    ctx.quadraticCurveTo(x + 0.03, -0.28, x + 0.062, -0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, tip - 0.028, 0.048, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function king(ctx) {
  foot(ctx, 0.3, 0.28);
  ctx.beginPath();
  ctx.moveTo(-0.19, 0.28);
  ctx.bezierCurveTo(-0.17, 0.1, -0.1, 0.02, -0.1, -0.06);
  ctx.lineTo(0.1, -0.06);
  ctx.bezierCurveTo(0.1, 0.02, 0.17, 0.1, 0.19, 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  collar(ctx, -0.06, 0.17, 0.048);
  ctx.beginPath();
  ctx.moveTo(-0.2, -0.1);
  ctx.bezierCurveTo(-0.22, -0.26, -0.12, -0.32, 0, -0.32);
  ctx.bezierCurveTo(0.12, -0.32, 0.22, -0.26, 0.2, -0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // the cross, which is the whole difference between a king and a queen at a
  // glance — so it is drawn thick enough to read at thumbnail size
  ctx.beginPath();
  ctx.rect(-0.038, -0.52, 0.076, 0.22);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-0.115, -0.46, 0.23, 0.072);
  ctx.fill();
  ctx.stroke();
}

/**
 * A draughts man, and a king when `crowned`. The crown is a raised ring with
 * points, cut in the same palette — a printed crown on a flat disc reads as a
 * sticker, and this board is meant to be wood.
 */
export function draughtsCrown(ctx, cx, cy, r, palette) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(r, r);
  ctx.lineWidth = 0.06;
  ctx.strokeStyle = palette.edge;
  const g = ctx.createLinearGradient(0, -0.5, 0, 0.4);
  g.addColorStop(0, palette.light);
  g.addColorStop(1, palette.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-0.44, 0.26);
  ctx.lineTo(-0.5, -0.34);
  ctx.lineTo(-0.22, -0.06);
  ctx.lineTo(0, -0.4);
  ctx.lineTo(0.22, -0.06);
  ctx.lineTo(0.5, -0.34);
  ctx.lineTo(0.44, 0.26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** A ludo pawn: a cone with a head, seen from slightly above. */
export function conePawn(ctx, cx, cy, size, palette, { alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(size, size);
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = palette.edge;

  shadow(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(0.04, 0.42, 0.34, 0.11, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
  }, { blur: 0.12, y: 0.03, colour: 'rgba(0,0,0,0.5)' });

  const g = ctx.createLinearGradient(-0.2, -0.4, 0.2, 0.4);
  g.addColorStop(0, palette.light);
  g.addColorStop(0.5, palette.base);
  g.addColorStop(1, palette.dark);
  ctx.fillStyle = g;

  ctx.beginPath();
  ctx.ellipse(0, 0.36, 0.32, 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.3, 0.36);
  ctx.bezierCurveTo(-0.28, 0.1, -0.16, -0.02, -0.13, -0.12);
  ctx.lineTo(0.13, -0.12);
  ctx.bezierCurveTo(0.16, -0.02, 0.28, 0.1, 0.3, 0.36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -0.24, 0.19, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-0.06, -0.3, 0.07, 0.05, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();
  ctx.restore();
}

/**
 * A die, face up, with the pips in the arrangement everybody knows.
 *
 * Drawn square-on with a bevel rather than in perspective: a die in perspective
 * has to agree with a board that is not in perspective, and the eye notices.
 */
export function die(ctx, cx, cy, size, value, { face = '#fbf5e6', pip = '#22201c', tilt = 0 } = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  const s = size;
  shadow(ctx, () => {
    ctx.beginPath();
    ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.18);
    ctx.fillStyle = face;
    ctx.fill();
  }, { blur: s * 0.35, y: s * 0.12, colour: 'rgba(0,0,0,0.45)' });

  const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, face);
  g.addColorStop(1, '#d8ceb6');
  ctx.beginPath();
  ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.18);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.stroke();

  const u = s * 0.26;
  const spots = {
    1: [[0, 0]],
    2: [[-u, -u], [u, u]],
    3: [[-u, -u], [0, 0], [u, u]],
    4: [[-u, -u], [u, -u], [-u, u], [u, u]],
    5: [[-u, -u], [u, -u], [0, 0], [-u, u], [u, u]],
    6: [[-u, -u], [u, -u], [-u, 0], [u, 0], [-u, u], [u, u]],
  }[value] || [];
  ctx.fillStyle = pip;
  for (const [x, y] of spots) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.085, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A mancala seed: a small stone, coloured by its index so a pit looks like a
 *  handful rather than a pile of clones. */
export function seed(ctx, cx, cy, r, colour, angle = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.35, colour);
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = r * 0.14;
  ctx.stroke();
  ctx.restore();
}
