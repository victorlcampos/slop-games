// The materials this cabinet is built from — wood, felt, marble, brass — and
// the handful of strokes every board needs.
//
// Rule nº 5 of the house: not one image ships with these games. A walnut board
// with visible grain, a felt table, a marble sudoku sheet and the shine down
// the side of a chess piece are all arithmetic. Which is cheap to say and
// expensive to draw, so everything expensive here is drawn **once** into an
// offscreen canvas and reused as a pattern: grain is generated per board, not
// per frame, and a resize is what invalidates it.
//
// The palettes live in theme.js; this file only knows how to lay paint down.

/** A canvas you can draw into and use as a fill. Not attached to the document. */
export function scratch(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Deterministic value noise — the same board draws the same grain every time,
 *  which matters the moment anything is cached and redrawn on a resize. */
export function noise(x, y, seed = 0) {
  let n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.7585) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * A plank of wood: base gradient, long grain lines that wander, a few darker
 * rings, and a varnish highlight. `dir` is the direction the grain runs.
 */
export function woodTile(w, h, palette, { seed = 1, dir = 'h', rings = true } = {}) {
  const c = scratch(w, h);
  const g = c.getContext('2d');
  const horizontal = dir === 'h';

  const base = g.createLinearGradient(0, 0, horizontal ? 0 : w, horizontal ? h : 0);
  base.addColorStop(0, palette.light);
  base.addColorStop(0.5, palette.base);
  base.addColorStop(1, palette.dark);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);

  // the grain: long, nearly parallel lines with a slow wobble, which is what
  // separates wood from a gradient with stripes on it
  const span = horizontal ? h : w;
  const length = horizontal ? w : h;
  g.lineWidth = 1;
  for (let i = 0; i < span * 0.9; i++) {
    const at = (i / (span * 0.9)) * span;
    const shade = noise(i, seed, seed);
    g.strokeStyle = `rgba(${shade > 0.55 ? '255,240,210' : '40,22,10'},${0.02 + shade * 0.06})`;
    g.beginPath();
    for (let t = 0; t <= length; t += 6) {
      const wobble = Math.sin(t * 0.011 + i * 0.7 + seed) * 2.1 + Math.sin(t * 0.043 + i) * 0.8;
      const p = at + wobble;
      if (t === 0) g.moveTo(horizontal ? 0 : p, horizontal ? p : 0);
      else g.lineTo(horizontal ? t : p, horizontal ? p : t);
    }
    g.stroke();
  }

  if (rings) {
    g.globalAlpha = 0.12;
    for (let k = 0; k < 3; k++) {
      const cx = noise(k, seed + 3, seed) * w;
      const cy = noise(k, seed + 7, seed) * h;
      const r = (0.1 + noise(k, seed + 11, seed) * 0.35) * Math.max(w, h);
      const ring = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      ring.addColorStop(0, 'rgba(60,32,14,0.5)');
      ring.addColorStop(0.6, 'rgba(60,32,14,0)');
      ring.addColorStop(0.75, 'rgba(90,52,24,0.35)');
      ring.addColorStop(1, 'rgba(60,32,14,0)');
      g.fillStyle = ring;
      g.fillRect(0, 0, w, h);
    }
    g.globalAlpha = 1;
  }
  return c;
}

/** Felt: a flat colour that is never flat, because the fibres catch the light. */
export function feltTile(w, h, colour, seed = 5) {
  const c = scratch(w, h);
  const g = c.getContext('2d');
  g.fillStyle = colour;
  g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, c.width, c.height);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const p = (i / 4) | 0;
    const n = noise(p % c.width, (p / c.width) | 0, seed) - 0.5;
    const lift = n * 26;
    px[i] = clamp(px[i] + lift);
    px[i + 1] = clamp(px[i + 1] + lift);
    px[i + 2] = clamp(px[i + 2] + lift);
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Marble: milky base, a couple of veins, and a warm bloom. For the paper-ish
 *  boards — sudoku and the sheet the noughts and crosses is scratched on. */
export function marbleTile(w, h, palette, seed = 9) {
  const c = scratch(w, h);
  const g = c.getContext('2d');
  const base = g.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, palette.light);
  base.addColorStop(1, palette.base);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);

  for (let v = 0; v < 5; v++) {
    g.beginPath();
    let x = noise(v, seed, seed) * w;
    let y = -10;
    g.moveTo(x, y);
    while (y < h + 10) {
      x += (noise(x * 0.05, y * 0.05, seed + v) - 0.5) * 26;
      y += 9;
      g.lineTo(x, y);
    }
    g.strokeStyle = `rgba(120,110,100,${0.05 + noise(v, 2, seed) * 0.08})`;
    g.lineWidth = 0.6 + noise(v, 4, seed) * 2.2;
    g.stroke();
  }
  return c;
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** A rounded rectangle path — the one primitive Canvas 2D still makes you write. */
export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Run `draw` with a drop shadow under it. Saves and restores, and clears the
 * shadow afterwards — a leaked `shadowBlur` is the single most common way a
 * canvas scene ends up looking muddy, because everything drawn after it gets a
 * halo nobody asked for.
 */
export function shadow(ctx, draw, { blur = 12, x = 0, y = 6, colour = 'rgba(0,0,0,0.45)' } = {}) {
  ctx.save();
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = x;
  ctx.shadowOffsetY = y;
  ctx.shadowColor = colour;
  draw();
  ctx.restore();
}

/**
 * An engraved line: a dark groove with a light lip under it. Two strokes, and
 * it is the difference between a drawn line and a cut one.
 *
 * `path` adds sub-paths and must **not** call `beginPath` — this does that
 * once, before handing the context over. That is not a style preference: a
 * `beginPath` inside the callback throws away everything added before it, and
 * the morris board shipped with two of its three squares silently missing
 * because the callback opened a new path per square.
 */
export function engrave(ctx, path, { width = 3, dark = 'rgba(0,0,0,0.55)', light = 'rgba(255,255,255,0.16)' } = {}) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [dy, colour] of [[1, light], [0, dark]]) {
    ctx.setTransform(ctx.getTransform());
    ctx.save();
    ctx.translate(0, dy);
    ctx.beginPath();
    path(ctx);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * A turned disc: draughts man, reversi stone, backgammon checker, ludo base.
 *
 * The volume comes from three things stacked, and dropping any one of them
 * makes it look like a circle: an off-centre radial gradient (the light is up
 * and to the left), a rim that is darker than the face, and a specular arc that
 * is not a full ellipse — a highlight all the way round reads as plastic.
 */
export function disc(ctx, cx, cy, r, palette, { rings = 0, lift = 1 } = {}) {
  ctx.save();
  shadow(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = palette.edge || palette.dark;
    ctx.fill();
  }, { blur: r * 0.5 * lift, y: r * 0.22 * lift, colour: 'rgba(0,0,0,0.5)' });

  const face = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.12, cx, cy, r);
  face.addColorStop(0, palette.light);
  face.addColorStop(0.55, palette.base);
  face.addColorStop(1, palette.dark);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.94, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();

  for (let i = 1; i <= rings; i++) {
    const rr = r * (0.9 - i * 0.13);
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.strokeStyle = i % 2 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = Math.max(1, r * 0.045);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.ellipse(cx - r * 0.28, cy - r * 0.34, r * 0.42, r * 0.26, -0.6, 0, Math.PI * 2);
  const gloss = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.34, 0, cx - r * 0.28, cy - r * 0.34, r * 0.45);
  gloss.addColorStop(0, 'rgba(255,255,255,0.42)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fill();
  ctx.restore();
}

/** A pit sunk into a board: mancala's hollows, and the holes in the ludo yard. */
export function hollow(ctx, cx, cy, r, { depth = 0.5 } = {}) {
  ctx.save();
  const g = ctx.createRadialGradient(cx + r * 0.25, cy + r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, `rgba(20,12,6,${0.15 + depth * 0.2})`);
  g.addColorStop(0.7, `rgba(16,9,4,${0.45 + depth * 0.3})`);
  g.addColorStop(1, `rgba(10,6,3,${0.6 + depth * 0.35})`);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  // the lip: light on the far side, because the light comes from up and left
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.99, Math.PI * 0.15, Math.PI * 0.85);
  ctx.strokeStyle = 'rgba(255,235,200,0.18)';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();
  ctx.restore();
}

/** Text that fits: shrinks until it does, and never wraps a label it was not
 *  measured for. Portuguese and English are not the same length, and a fixed
 *  size clips one of them (CLAUDE.md, section 5). */
export function fitText(ctx, text, x, y, maxWidth, { size = 20, weight = 700, family = 'ui-serif, Georgia, serif', align = 'center', baseline = 'middle', colour = '#fff' } = {}) {
  let s = size;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth || s <= 7) break;
    s -= 1;
  } while (s > 7);
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
  return s;
}

/** A soft glow ring — the selected square, the last move, the king in check. */
export function halo(ctx, cx, cy, r, colour, { width = 3, alpha = 1, blur = 14 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = blur;
  ctx.shadowColor = colour;
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** The vignette that turns a flat background into a lit room. */
export function vignette(ctx, w, h, strength = 0.55) {
  const g = ctx.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.2, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Ease that starts fast and settles — every piece on this table moves with it. */
export const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** A short overshoot, for a piece that lands: it settles like a real one. */
export const easeBack = (t) => {
  const c = 1.7;
  const p = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (c + 1) * p * p * p + c * p * p;
};
