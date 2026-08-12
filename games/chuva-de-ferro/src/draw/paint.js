// The brush box: the shapes everything else is built from.
//
// The look is Metal Slug's, boiled down to three rules — a heavy dark outline, a
// light coming from the top left, and colours the desert would allow. Nothing
// here knows what a crate is; it knows how to make a box look like metal.

import { COLOURS } from '../config.js';

export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const k = amount < 0 ? 1 + amount : 1;
  const add = amount > 0 ? 255 * amount : 0;
  const mix = (v) => Math.max(0, Math.min(255, Math.round(v * k + add)));
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, '0')}`;
}

export function outline(ctx, width = 3) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = COLOURS.ink;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** A box with a lit top face and a shaded right face — the workhorse. */
export function block(ctx, x, y, w, h, colour, { r = 3, line = 3, top = 0.22, side = -0.22 } = {}) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = colour;
  ctx.fill();
  outline(ctx, line);

  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.fillStyle = shade(colour, top);
  ctx.fillRect(x, y, w, h * 0.28);
  ctx.fillStyle = shade(colour, side);
  ctx.fillRect(x + w * 0.68, y, w * 0.32, h);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r = 4) {
  const k = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** A ball with a highlight up and to the left, and a dark rim. */
export function ball(ctx, x, y, r, colour, { line = 3 } = {}) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, shade(colour, 0.34));
  g.addColorStop(0.6, colour);
  g.addColorStop(1, shade(colour, -0.35));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx, line);
}

export function polygon(ctx, points, colour, line = 3) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  if (line) outline(ctx, line);
}

/** The shadow every object drops on the road: it is what says where it will land. */
export function groundShadow(ctx, x, y, r, alpha = 0.35) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function text(ctx, s, x, y, {
  size = 20, colour = COLOURS.hud, align = 'left', weight = 800, stroke = 4, baseline = 'alphabetic',
} = {}) {
  ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke;
    ctx.strokeStyle = 'rgba(8,7,6,0.85)';
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = colour;
  ctx.fillText(s, x, y);
}
