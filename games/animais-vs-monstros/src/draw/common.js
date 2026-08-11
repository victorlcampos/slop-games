// Parts nearly every creature uses. Keeping these here is what makes 30
// hand-drawn creatures possible without 30 enormous files.

import { shape, ellipse, circle, line, stroke, ellipsePoints, seedFrom } from '../scribble.js';
import { INK, shade } from '../palette.js';

export const OUTLINE = { color: INK, width: 2.6, jitter: 1.5 };

/** The standard oval body. */
export function body(ctx, cx, cy, rx, ry, color, s, spin = 0) {
  shape(ctx, ellipsePoints(cx, cy, rx, ry, 14, spin), { ...OUTLINE, fill: color, seed: s });
}

/** An eye with a highlight — the creature's soul lives here. */
export function eye(ctx, x, y, r, s, opts = {}) {
  const { look = [0, 0], closed = false, color = '#f7f2e7', pupil = INK } = opts;
  if (closed) {
    stroke(ctx, [[x - r, y], [x, y + r * 0.5], [x + r, y]], { ...OUTLINE, width: 2.2, seed: s });
    return;
  }
  circle(ctx, x, y, r, { ...OUTLINE, width: 2, fill: color, seed: s });
  const px = x + look[0] * r * 0.35;
  const py = y + look[1] * r * 0.35;
  circle(ctx, px, py, r * 0.46, { color: null, fill: pupil, seed: s + 3 });
  circle(ctx, px - r * 0.16, py - r * 0.18, r * 0.16, { color: null, fill: '#ffffff', seed: s + 5 });
}

/** A monster's eye: no white, cold glint. */
export function evilEye(ctx, x, y, r, s, color = '#f2b03c') {
  circle(ctx, x, y, r, { color: INK, width: 2, fill: color, seed: s });
  const p = [[x - r * 0.5, y - r * 0.1], [x + r * 0.5, y - r * 0.1], [x, y + r * 0.9]];
  shape(ctx, p, { color: null, fill: INK, seed: s + 2 });
}

/** Triangular ear (cat, squirrel, wolf). */
export function pointedEar(ctx, x, y, l, color, s, spin = 0) {
  const c = Math.cos(spin);
  const sn = Math.sin(spin);
  const rot = (dx, dy) => [x + dx * c - dy * sn, y + dx * sn + dy * c];
  shape(ctx, [rot(-l * 0.5, 0), rot(0, -l), rot(l * 0.5, 0)], { ...OUTLINE, fill: color, seed: s });
  shape(ctx, [rot(-l * 0.22, -l * 0.08), rot(0, -l * 0.62), rot(l * 0.22, -l * 0.08)], {
    color: null,
    fill: shade(color, -0.25),
    seed: s + 1,
  });
}

/** Round ear (monkey, bear). */
export function roundEar(ctx, x, y, r, color, s) {
  circle(ctx, x, y, r, { ...OUTLINE, width: 2.2, fill: color, seed: s });
  circle(ctx, x, y, r * 0.5, { color: null, fill: shade(color, -0.3), seed: s + 1 });
}

/** Snout with a nostril and a mouth. */
export function snout(ctx, x, y, r, s, color = INK) {
  ellipse(ctx, x, y, r, r * 0.75, { color: INK, width: 2, fill: color, seed: s });
  line(ctx, x, y + r * 0.6, x, y + r * 1.5, { color: INK, width: 2, seed: s + 1 });
  stroke(ctx, [[x - r * 1.5, y + r * 1.5], [x - r * 0.6, y + r * 2], [x, y + r * 1.5]], {
    color: INK, width: 2, seed: s + 2,
  });
  stroke(ctx, [[x, y + r * 1.5], [x + r * 0.6, y + r * 2], [x + r * 1.5, y + r * 1.5]], {
    color: INK, width: 2, seed: s + 3,
  });
}

/** A simple paw under the body. */
export function paw(ctx, x, y, w, h, color, s) {
  // the base flares 15% wider than the top: a straight rectangle reads as a peg
  const half = w / 2;
  shape(ctx, [[x - half, y - h], [x + half, y - h], [x + half * 1.15, y], [x - half * 1.15, y]], {
    ...OUTLINE,
    width: 2.2,
    fill: color,
    seed: s,
  });
}

/** A thick curved tail. */
export function tail(ctx, points, width, color, s) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // painted core
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
  }
  ctx.lineTo(points[points.length - 1][0], points[points.length - 1][1]);
  ctx.stroke();
  ctx.restore();
  // scribbled outline on top
  stroke(ctx, points, { ...OUTLINE, width: 2.2, seed: s });
}

/** Fur/down: little strokes around the edge of an ellipse. */
export function fuzz(ctx, cx, cy, rx, ry, color, s, count = 14, length = 7) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    line(ctx, x, y, x + Math.cos(a) * length, y + Math.sin(a) * length, {
      color,
      width: 2,
      passes: 1,
      seed: s + i,
    });
  }
}

/** Spots (jaguar, skunk, mushroom). */
export function spots(ctx, cx, cy, rx, ry, color, s, count = 7) {
  const r = seedFrom('spot' + s);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (r % 10) * 0.1;
    const d = 0.35 + ((r >> i) & 3) * 0.15;
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + Math.sin(a) * ry * d;
    const t = 3 + ((r >> (i * 2)) & 3);
    circle(ctx, x, y, t, { color: null, fill: color, seed: s + i * 7 });
  }
}

/** Stripes (bee, tiger). */
export function stripes(ctx, cx, cy, rx, ry, color, s, count = 3) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < count; i++) {
    const x = cx - rx + ((i + 1) * (rx * 2)) / (count + 1);
    shape(
      ctx,
      [[x - rx * 0.13, cy - ry], [x + rx * 0.13, cy - ry], [x + rx * 0.13, cy + ry], [x - rx * 0.13, cy + ry]],
      { color: null, fill: color, seed: s + i * 3 }
    );
  }
  ctx.restore();
}

/** A bird's or insect's wing. */
export function wing(ctx, x, y, length, height, color, s, spin = 0, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.globalAlpha *= alpha;
  shape(
    ctx,
    [[0, 0], [length * 0.45, -height], [length, -height * 0.35], [length * 0.7, height * 0.35], [length * 0.2, height * 0.3]],
    { ...OUTLINE, width: 2.2, fill: color, seed: s }
  );
  ctx.restore();
}

/** A row of saw teeth in an open mouth. */
export function teeth(ctx, x1, y, x2, height, s, down = true) {
  const n = Math.max(3, Math.round((x2 - x1) / 9));
  const step = (x2 - x1) / n;
  for (let i = 0; i < n; i++) {
    const x = x1 + i * step;
    const p = down
      ? [[x, y], [x + step, y], [x + step / 2, y + height]]
      : [[x, y], [x + step, y], [x + step / 2, y - height]];
    shape(ctx, p, { color: INK, width: 1.6, fill: '#f7f2e7', seed: s + i * 5 });
  }
}

/** A curved horn. */
export function horn(ctx, x, y, length, color, s, spin = -0.6) {
  const p = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const a = spin - t * 1.1;
    p.push([x + Math.cos(a) * length * t, y + Math.sin(a) * length * t]);
  }
  tail(ctx, p, 4, color, s);
}
