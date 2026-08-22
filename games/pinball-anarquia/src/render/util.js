// Small drawing tools shared by the felt, the parts and the backglass.

/** An offscreen canvas, wherever we are running. */
export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * A soft round glow, pre-rendered once per colour.
 *
 * The table carries about two hundred lamps and every one of them wants a
 * halo. `shadowBlur` would draw each of those halos from scratch every frame,
 * which is the single most expensive thing Canvas 2D can be asked to do —
 * blitting a cached gradient is a texture copy instead.
 */
const glows = new Map();
export function glowSprite(color, size = 64) {
  const key = color + '@' + size;
  let c = glows.get(key);
  if (c) return c;
  c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, alpha(color, 0.95));
  grad.addColorStop(0.28, alpha(color, 0.45));
  grad.addColorStop(0.62, alpha(color, 0.12));
  grad.addColorStop(1, alpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glows.set(key, c);
  return c;
}

/**
 * Paint a cached halo centred on a point.
 *
 * Two things about it are performance, and both were measured rather than
 * guessed. It sets and restores the two properties it touches by hand instead
 * of calling save()/restore(), because a save() copies the entire drawing state
 * and there are two hundred lamps a frame. And it composites normally unless
 * asked for `hot`: additive blending is what makes a lamp look like it is
 * *emitting*, and it also costs two and a half times as much per blit — so the
 * fifteen things whose glow is the point get it, and the two hundred that only
 * need to look lit do not.
 */
export function glow(ctx, color, x, y, radius, strength = 1, hot = false) {
  if (strength <= 0) return;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = strength < 1 ? strength : 1;
  if (hot) {
    const prevOp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = prevOp;
  } else {
    ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.globalAlpha = prevAlpha;
}

/**
 * Where the light comes from, and what that means for every shadow here.
 *
 * A pinball cabinet is lit from its backbox, which stands at the far end — so
 * on screen the light comes from the top and every shadow falls toward the
 * player. One direction, obeyed by the ramps, the wires, the plastics, the
 * bumpers and the ball alike: shadows that disagree with each other are worse
 * than no shadows at all, because the eye reads the disagreement before it
 * reads the depth.
 */
export const LIGHT = { x: 0.22, y: 1 };

const shadows = new Map();

/** A soft round shadow, pre-rendered once. */
export function shadowSprite(size = 64) {
  let c = shadows.get(size);
  if (c) return c;
  c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(0,0,0,0.92)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.78, 'rgba(0,0,0,0.16)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  shadows.set(size, c);
  return c;
}

/**
 * The shadow a thing of height `h` throws on the felt beneath it.
 * `k` is the projection's isotropic scale at that point, so the shadow grows
 * and slides the same way the object does as it moves up the table.
 */
export function castShadow(ctx, x, y, r, h, k, strength = 0.55) {
  const off = h * 0.42 * k;
  const rx = r * (1 + h * 0.006);
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.drawImage(
    shadowSprite(),
    x + LIGHT.x * off - rx * 1.35,
    y + LIGHT.y * off - rx * 0.95,
    rx * 2.7,
    rx * 1.9
  );
  ctx.restore();
}

/** Whether this canvas can blur. Asked once — the answer never changes, and
 *  asking per shadow costs more than the shadow. */
let canBlur = null;
export function blurSupported(ctx) {
  if (canBlur === null) {
    try {
      ctx.filter = 'blur(2px)';
      canBlur = ctx.filter !== 'none';
      ctx.filter = 'none';
    } catch {
      canBlur = false;
    }
  }
  return canBlur;
}

/** A soft-edged shadow in the shape of whatever `path` draws. */
export function softShadow(ctx, path, blur = 7, strength = 0.5) {
  ctx.save();
  if (blurSupported(ctx)) {
    ctx.filter = `blur(${blur}px)`;
    ctx.fillStyle = `rgba(0,0,0,${strength})`;
    path(ctx);
    ctx.fill();
  } else {
    // no filter: three thin passes read as soft enough at this size
    ctx.fillStyle = `rgba(0,0,0,${strength / 2.2})`;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(0, i);
      path(ctx);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/** `#rrggbb` at a given opacity. */
export function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * Mix two hex colours, 0 = a, 1 = b.
 *
 * It returns hex, not `rgb(...)`, and that is load-bearing: `alpha()` parses
 * its argument as hex, so `alpha(mix(x, y, t), 0.8)` — which reads perfectly
 * well and is written all over this renderer — silently produced **black** for
 * as long as this returned `rgb(...)`. Every ramp floor and every plastic in
 * the game was painted black by that one mismatch, and it looked like a
 * lighting problem rather than a parsing one.
 */
export function mix(a, b, t) {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((x >> sh) & 255) * (1 - t) + ((y >> sh) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

export function roundRect(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/**
 * The circle-A, drawn.
 *
 * The A's legs and crossbar overshoot the ring, the way they do on every wall
 * it has ever been sprayed on — a tidy A inside a tidy circle is a logo, and
 * this is not supposed to look like a logo.
 */
export function circleA(ctx, x, y, r, color, lw = 2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  const s = r * 1.28;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.62, y + s * 0.72);
  ctx.lineTo(x, y - s * 0.8);
  ctx.lineTo(x + s * 0.62, y + s * 0.72);
  ctx.moveTo(x - s * 0.8, y + s * 0.2);
  ctx.lineTo(x + s * 0.74, y + s * 0.08);
  ctx.stroke();
  ctx.restore();
}

/**
 * A deterministic little generator.
 *
 * The felt is repainted whenever the window changes size. With Math.random in
 * the cracks and the stars, every resize would deal a different sky — which
 * reads as the table glitching, not as decoration.
 */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Sample a parametric path into points plus their unit normals. */
export function samplePath(fn, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = fn(t);
    const q = fn(Math.min(1, t + 0.001));
    const r = fn(Math.max(0, t - 0.001));
    const dx = q.x - r.x;
    const dy = q.y - r.y;
    const l = Math.hypot(dx, dy) || 1;
    pts.push({ x: p.x, y: p.y, nx: -dy / l, ny: dx / l, t });
  }
  return pts;
}

/** A cubic bezier as a path function. */
export function bezier(p0, p1, p2, p3) {
  return (t) => {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return {
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    };
  };
}
