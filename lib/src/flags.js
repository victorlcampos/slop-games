// The two flags, drawn by code.
//
// Rule nº 5 of this repo is that no game ships an image, and a language picker
// is no reason to break it. The obvious shortcut — the 🇧🇷 and 🇺🇸 emoji — is
// also the broken one: Windows ships no glyphs for regional indicator pairs, so
// on the most common desktop OS the picker renders as the letters "BR" and "US"
// in a box. Twenty lines of canvas beat that everywhere.
//
// One routine, two outputs: `drawFlag` paints into any 2D context (the games
// that draw their menus on canvas), and `flagDataURL` runs the same routine on
// an offscreen canvas so DOM menus can use it as an `<img>` source.
//
// Both flags are drawn into whatever box you give them. Their real ratios
// differ (Brazil is 10:7, the USA 19:10); forcing one box keeps a row of
// buttons even, which matters more here than either country's spec.

import { LANGS } from './langs.js';

const BR = { green: '#009739', yellow: '#FEDD00', blue: '#012169', white: '#fff' };
const US = { red: '#B31942', white: '#FFFFFF', blue: '#0A3161' };

/** A five-pointed star centred on (cx, cy), `r` to the outer points. */
function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.42 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawBrazil(ctx, x, y, w, h) {
  ctx.fillStyle = BR.green;
  ctx.fillRect(x, y, w, h);

  // the rhombus sits 1.7/14 of the height away from every edge, measured in
  // height units on both axes — that is what keeps it a rhombus and not a
  // stretched diamond when the box is wider than the real flag
  const m = h * (1.7 / 14);
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.fillStyle = BR.yellow;
  ctx.beginPath();
  ctx.moveTo(cx, y + m);
  ctx.lineTo(x + w - m, cy);
  ctx.lineTo(cx, y + h - m);
  ctx.lineTo(x + m, cy);
  ctx.closePath();
  ctx.fill();

  const r = h * (3.5 / 14);
  ctx.fillStyle = BR.blue;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // the band and the stars only exist inside the globe
  ctx.save();
  ctx.clip();

  // "ORDEM E PROGRESSO" rides a circle far below the globe, which is why the
  // band reads as a shallow upward curve instead of a straight stripe
  ctx.strokeStyle = BR.white;
  ctx.lineWidth = r * 0.4;
  ctx.beginPath();
  ctx.arc(cx, cy + r * 2.4, r * 2.62, -Math.PI * 0.78, -Math.PI * 0.22);
  ctx.stroke();

  ctx.fillStyle = BR.white;
  // a token constellation: 27 dots would be mud at button size
  const stars = [
    [-0.44, -0.3], [-0.16, -0.5], [0.28, -0.42], [0.5, -0.1],
    [-0.5, 0.28], [-0.2, 0.5], [0.18, 0.5], [0.46, 0.3], [0.02, -0.16],
  ];
  for (const [sx, sy] of stars) {
    ctx.beginPath();
    ctx.arc(cx + sx * r, cy + sy * r, Math.max(0.5, r * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawUSA(ctx, x, y, w, h) {
  const stripe = h / 13;
  ctx.fillStyle = US.white;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = US.red;
  // 7 red stripes, top and bottom included — the white ones are the background
  for (let i = 0; i < 13; i += 2) {
    ctx.fillRect(x, y + i * stripe, w, stripe + 0.35); // overlap: no hairline seams
  }

  const cw = w * 0.4;
  const ch = stripe * 7;
  ctx.fillStyle = US.blue;
  ctx.fillRect(x, y, cw, ch);

  // 5 staggered rows instead of the real 9: at 28px tall, 50 stars are noise
  ctx.fillStyle = US.white;
  const rows = 5;
  const r = Math.max(0.7, ch / rows / 3.4);
  for (let row = 0; row < rows; row++) {
    const cols = row % 2 ? 5 : 6;
    const gy = y + (ch / rows) * (row + 0.5);
    for (let col = 0; col < cols; col++) {
      const gx = x + (cw / 12) * (row % 2 ? 2 : 1) + col * (cw / 6);
      star(ctx, gx, gy, r);
    }
  }
}

const PAINTERS = { pt: drawBrazil, en: drawUSA };

/**
 * Paint a flag into a 2D context. Draws a thin dark outline so the white
 * stripes of the US flag don't dissolve into a light background.
 */
export function drawFlag(ctx, lang, x, y, w, h = w * (2 / 3)) {
  const paint = PAINTERS[lang];
  if (!paint) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  paint(ctx, x, y, w, h);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = Math.max(1, w * 0.025);
  ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();
}

/**
 * The same flag as a PNG data URI, for DOM menus.
 *
 * Rendered at 3x and scaled down by CSS so it stays sharp on retina; a flag is
 * mostly straight edges, and those are exactly what a blurry upscale ruins.
 */
export function flagDataURL(lang, w = 30, dpr = 3) {
  if (typeof document === 'undefined' || !PAINTERS[lang]) return '';
  const h = Math.round(w * (2 / 3));
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  drawFlag(ctx, lang, 0, 0, w, h);
  return c.toDataURL('image/png');
}

/** Every flag at once — handy for building a picker in one pass. */
export function allFlags(w = 30) {
  return Object.fromEntries(LANGS.map((l) => [l, flagDataURL(l, w)]));
}
