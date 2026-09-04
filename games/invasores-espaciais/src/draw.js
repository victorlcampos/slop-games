// Shared drawing for the six games that came after the swarm:
// fit the 960-wide playfield onto any screen, and flash banners.
//
// The swarm keeps its own painter (src/render.js); everything new draws
// through here so the collection looks like one machine, not seven.

import { PLAY_W, H } from './config.js';

/** Scale + offset that centers the playfield on a screen W wide. */
export function fit(W) {
  const scale = Math.min(1, (W - 16) / PLAY_W);
  const ox = (W - PLAY_W * scale) / 2;
  return { scale, ox };
}

/** Screen x → playfield x. Must invert `fit`. */
export function toPlayfield(px, W) {
  const { scale, ox } = fit(W);
  return (px - ox) / scale;
}

/**
 * Run `paint` in playfield coordinates (960×720), then restore.
 * The backdrop stays in screen coordinates — the neon spills past the field
 * on a wide monitor instead of leaving black bars.
 */
export function field(ctx, W, paint) {
  const { scale, ox } = fit(W);
  ctx.save();
  ctx.translate(ox, 0);
  ctx.scale(scale, scale);
  paint();
  ctx.restore();
}

/** The collection backdrop: near-black green with drifting stars. */
export function backdrop(ctx, W, time, seedStars) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#05050e');
  g.addColorStop(1, '#081009');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#9fd8ff';
  for (const s of seedStars) {
    ctx.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin(time * 0.7 + s.p));
    ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

/** Deterministic starfield: the same sky every run, twinkling by time. */
export function makeStars(seed, n = 110) {
  let s = seed >>> 0 || 1;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
  const stars = [];
  for (let i = 0; i < n; i++) {
    stars.push({ x: rand(), y: rand(), r: 0.6 + rand() * 1.6, p: rand() * Math.PI * 2 });
  }
  return stars;
}

/** Small translated HUD line, top-left; the wave counter centers itself. */
export function hud(ctx, W, left, center, right) {
  ctx.textBaseline = 'top';
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillStyle = '#d6f4d6';
  ctx.textAlign = 'left';
  ctx.fillText(left, 16, 12);
  if (center) {
    ctx.textAlign = 'center';
    ctx.fillText(center, W / 2, 12);
  }
  if (right) {
    ctx.textAlign = 'right';
    ctx.fillText(right, W - 16, 12);
  }
  ctx.textAlign = 'left';
}

/** Big centered flash over the field; alpha fades with the shell's timer. */
export function banner(ctx, W, text, alpha) {
  if (!text || alpha <= 0) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 44px system-ui, sans-serif';
  ctx.fillStyle = '#7dff8a';
  ctx.fillText(text, W / 2, H / 2 - 60);
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
}

/** The run is over: dim the field and name the way back to the menu. */
export function dimForCard(ctx, W, label) {
  ctx.fillStyle = 'rgba(4,4,10,0.55)';
  ctx.fillRect(0, 0, W, H);
  if (label) {
    ctx.globalAlpha = 0.9;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillStyle = '#9dc4a4';
    ctx.fillText(label, W / 2, H / 2 + 60);
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
  }
}
