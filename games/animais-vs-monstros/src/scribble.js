// The "freehand" drawing engine: everything in this game is drawn with these.
//
// The idea is simple — no line is straight and no circle is round. Every stroke
// gets a pseudorandom wobble and is drawn twice, like a pen going back over its
// own mark. The wobble comes from a seeded PRNG rather than Math.random(), for
// two reasons: the shape stays the same from one frame to the next (otherwise
// everything boils on screen) and the same animal comes out identical every time.
//
// To "animate" the drawing there is the time seed (see `wobbleFrame`): it
// changes a few times a second, giving that jitter of animation drawn on paper —
// on purpose, and only on the characters.

export const FONT = '"Chalkboard SE", "Comic Sans MS", "Marker Felt", "Segoe Print", system-ui, sans-serif';

/** mulberry32 PRNG: fast, deterministic and good enough to shake a line. */
export function rng(seed) {
  let a = (seed | 0) >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** String hash to a seed — lets you name a seed ("jaguar-body"). */
export function seedFrom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A seed that changes ~7x a second: the jitter of hand-drawn animation. */
export function wobbleFrame(time, steps = 3) {
  return Math.floor(time * 7) % steps;
}

// --------------------------------------------------------------- primitives

/** Traces a crooked line from (x1,y1) to (x2,y2) on the current path. */
function traceLine(ctx, x1, y1, x2, y2, r, jitter) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const d = Math.min(jitter, length / 8 + jitter * 0.4);
  const off = () => (r() * 2 - 1) * d;

  ctx.moveTo(x1 + off() * 0.5, y1 + off() * 0.5);
  ctx.quadraticCurveTo(x1 + dx * 0.5 + off(), y1 + dy * 0.5 + off(), x2 + off() * 0.5, y2 + off() * 0.5);
}

/** Builds the path through a sequence of points, crookedly. */
function tracePath(ctx, points, r, jitter, closed) {
  if (points.length < 2) return;
  const d = jitter;
  const off = () => (r() * 2 - 1) * d;

  ctx.moveTo(points[0][0] + off(), points[0][1] + off());
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    ctx.quadraticCurveTo((px + x) / 2 + off(), (py + y) / 2 + off(), x + off() * 0.6, y + off() * 0.6);
  }
  if (closed) {
    const [px, py] = points[points.length - 1];
    const [x, y] = points[0];
    ctx.quadraticCurveTo((px + x) / 2 + off(), (py + y) / 2 + off(), x, y);
    ctx.closePath();
  }
}

/**
 * Draws a closed shape from points.
 * opts: { color, width, fill, seed, jitter, passes, alpha }
 */
export function shape(ctx, points, opts = {}) {
  const {
    color = '#2b2622',
    width = 2.4,
    fill = null,
    seed = 1,
    jitter = 1.6,
    passes = 2,
    alpha = 1,
  } = opts;

  ctx.save();
  ctx.globalAlpha *= alpha;

  if (fill) {
    const r = rng(seed);
    ctx.beginPath();
    tracePath(ctx, points, r, jitter * 0.7, true);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  if (color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let p = 0; p < passes; p++) {
      const r = rng(seed + p * 977);
      ctx.beginPath();
      tracePath(ctx, points, r, jitter, true);
      ctx.globalAlpha *= p === 0 ? 1 : 0.55;
      ctx.stroke();
    }
  }

  ctx.restore();
}

/** A loose line (does not close). */
export function line(ctx, x1, y1, x2, y2, opts = {}) {
  const { color = '#2b2622', width = 2.4, seed = 1, jitter = 1.5, passes = 2, alpha = 1 } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  for (let p = 0; p < passes; p++) {
    const r = rng(seed + p * 613);
    ctx.beginPath();
    traceLine(ctx, x1, y1, x2, y2, r, jitter);
    ctx.globalAlpha *= p === 0 ? 1 : 0.5;
    ctx.stroke();
  }
  ctx.restore();
}

/** A curve through several points, open. */
export function stroke(ctx, points, opts = {}) {
  const { color = '#2b2622', width = 2.4, seed = 1, jitter = 1.5, passes = 2, alpha = 1 } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    const r = rng(seed + p * 331);
    ctx.beginPath();
    tracePath(ctx, points, r, jitter, false);
    ctx.globalAlpha *= p === 0 ? 1 : 0.5;
    ctx.stroke();
  }
  ctx.restore();
}

/** Points of an ellipse — the base of nearly every animal in this game. */
export function ellipsePoints(cx, cy, rx, ry, sides = 14, spin = 0) {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const a = spin + (i / sides) * Math.PI * 2;
    points.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return points;
}

export function ellipse(ctx, cx, cy, rx, ry, opts = {}) {
  const sides = Math.max(8, Math.round((rx + ry) / 4));
  shape(ctx, ellipsePoints(cx, cy, rx, ry, Math.min(sides, 20), opts.spin || 0), opts);
}

export function circle(ctx, cx, cy, r, opts = {}) {
  ellipse(ctx, cx, cy, r, r, opts);
}

export function rect(ctx, x, y, w, h, opts = {}) {
  shape(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], opts);
}

/** Rounded rectangle, useful for cards and text boxes. */
export function box(ctx, x, y, w, h, radius, opts = {}) {
  const k = Math.min(radius, w / 2, h / 2);
  const points = [
    [x + k, y], [x + w - k, y], [x + w, y + k],
    [x + w, y + h - k], [x + w - k, y + h], [x + k, y + h],
    [x, y + h - k], [x, y + k],
  ];
  shape(ctx, points, opts);
}

/** Parallel hatching inside a rectangle — pencil shading. */
export function hatch(ctx, x, y, w, h, opts = {}) {
  const { color = '#2b2622', width = 1.4, seed = 7, gap = 7, angle = -Math.PI / 4, alpha = 0.5 } = opts;
  const r = rng(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';

  const diag = Math.hypot(w, h);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const cx = x + w / 2;
  const cy = y + h / 2;

  for (let d = -diag / 2; d <= diag / 2; d += gap) {
    const mx = cx - dy * d;
    const my = cy + dx * d;
    ctx.beginPath();
    traceLine(ctx, mx - dx * diag * 0.5, my - dy * diag * 0.5, mx + dx * diag * 0.5, my + dy * diag * 0.5, r, 2);
    ctx.stroke();
  }
  ctx.restore();
}

// --------------------------------------------------------------------- text

/**
 * Text in the game's style. `outline` draws a light stroke underneath so the
 * text survives any background.
 */
export function text(ctx, txt, x, y, opts = {}) {
  const {
    size = 20,
    color = '#2b2622',
    align = 'left',
    baseline = 'alphabetic',
    weight = '700',
    outline = null,
    outlineWidth = 4,
    alpha = 1,
    tilt = 0,
  } = opts;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;

  if (tilt) {
    ctx.translate(x, y);
    ctx.rotate(tilt);
    x = 0;
    y = 0;
  }

  if (outline) {
    ctx.lineWidth = outlineWidth;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = outline;
    ctx.strokeText(txt, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(txt, x, y);
  ctx.restore();
}

/** Measures text in the game's font. */
export function measureText(ctx, txt, size = 20, weight = '700') {
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT}`;
  const m = ctx.measureText(txt).width;
  ctx.restore();
  return m;
}

/** Breaks text into lines that fit `width`. */
export function wrapText(ctx, txt, width, size = 20, weight = '700') {
  const words = String(txt).split(' ');
  const lines = [];
  let current = '';
  for (const w of words) {
    const test = current ? current + ' ' + w : w;
    if (measureText(ctx, test, size, weight) > width && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ------------------------------------------------------------------ scenery

/** Paper texture: fibre, stains and a light vignette. */
export function paper(ctx, w, h, opts = {}) {
  const { base = '#f2e8d5', seed = 42, stains = 26 } = opts;
  const r = rng(seed);

  ctx.save();
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // coffee stains / ageing
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < stains; i++) {
    const x = r() * w;
    const y = r() * h;
    const radius = 30 + r() * 140;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const t = 0.02 + r() * 0.05;
    g.addColorStop(0, `rgba(160, 130, 90, ${t})`);
    g.addColorStop(1, 'rgba(160, 130, 90, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // paper fibres
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#7a6444';
  ctx.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    const x = r() * w;
    const y = r() * h;
    const len = 8 + r() * 26;
    const a = r() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

/** A soft ground shadow, so the animal doesn't look like it's floating. */
export function shadow(ctx, cx, cy, rx, ry, alpha = 0.3) {
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
  g.addColorStop(0, `rgba(24, 30, 16, ${alpha})`);
  g.addColorStop(0.65, `rgba(24, 30, 16, ${alpha * 0.7})`);
  g.addColorStop(1, 'rgba(24, 30, 16, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Gives volume to what is already painted: light on top, shadow underneath and
 * a highlight on the left shoulder. It works on a whole sprite at once —
 * `source-atop` only paints where there is already drawing, so the silhouette
 * doesn't leak.
 *
 * This is what separates a flat cut-out from a figure that looks like it has a
 * body. Call it at the end of the drawing, after all the strokes.
 */
export function volume(ctx, w, h, strength = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';

  // The shadow is weak on purpose and only enters the bottom third: any more
  // and it muddies the creature's colour, and everyone turns brown.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(255, 252, 240, ${0.26 * strength})`);
  g.addColorStop(0.4, 'rgba(255, 252, 240, 0)');
  g.addColorStop(0.72, 'rgba(40, 26, 16, 0)');
  g.addColorStop(1, `rgba(40, 26, 16, ${0.17 * strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // specular highlight: the touch that makes the creature look polished
  const b = ctx.createRadialGradient(w * 0.36, h * 0.26, 0, w * 0.36, h * 0.26, w * 0.46);
  b.addColorStop(0, `rgba(255, 255, 255, ${0.26 * strength})`);
  b.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

// ------------------------------------------------------------- sprite cache

const cache = new Map();

/**
 * Draw once on an offscreen canvas and reuse. Without this, redrawing 40
 * scribbled animals per frame tanks the frame rate — every stroke here is two
 * passes of Bézier curve.
 */
export function sprite(key, width, height, paint) {
  let c = cache.get(key);
  if (c) return c;

  c = document.createElement('canvas');
  c.width = Math.ceil(width);
  c.height = Math.ceil(height);
  const ctx = c.getContext('2d');
  paint(ctx, c.width, c.height);
  cache.set(key, c);
  return c;
}

/** Draws a cached sprite centred at (x, y), with scale and mirroring. */
export function putSprite(ctx, spr, x, y, scale = 1, flip = false, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.scale(scale, scale);
  ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
  ctx.restore();
}

export function clearCache() {
  cache.clear();
}
