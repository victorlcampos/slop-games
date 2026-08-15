// The sky, the far hills and the dirt itself.
//
// The scenery is generated once per siege from the level's seed and then only
// scrolled — six ridgelines and a handful of clouds cost nothing to keep, and
// regenerating them every frame would make the horizon boil, which is the
// tell-tale of noise being sampled with a moving seed.

import { H, NCOL, COL_W, W, makeRng } from './config.js';
import { FLOOR_Y } from './terrain.js';

export function createScene(level, terrain, seed = 1) {
  const spec = terrain.spec;
  const rng = makeRng(seed * 2654435761 + 97);

  const ridge = (amp, base, step) => {
    const pts = [];
    for (let x = -60; x <= W + 60; x += step) {
      const y = base - (Math.sin(x / 190 + rng() * 0.02) * amp) / 2 - rng() * amp * 0.35;
      pts.push({ x, y });
    }
    // one pass of smoothing, or the ridge looks like a saw
    for (let i = 1; i < pts.length - 1; i++) pts[i].y = (pts[i - 1].y + pts[i].y * 2 + pts[i + 1].y) / 4;
    return pts;
  };

  const far = ridge(120, 470, 46);
  const near = ridge(80, 530, 34);

  const clouds = [];
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: rng() * W,
      y: 60 + rng() * 180,
      s: 0.6 + rng() * 1.1,
      v: 4 + rng() * 9,
    });
  }

  const flakes = [];
  const weather = spec.id === 'snow' ? 'snow' : spec.ember ? 'ember' : null;
  if (weather) {
    for (let i = 0; i < 70; i++) {
      flakes.push({ x: rng() * W, y: rng() * H, v: 12 + rng() * 40, d: rng() * 6, s: 1 + rng() * 2 });
    }
  }

  return {
    spec,
    update(h) {
      for (const c of clouds) {
        c.x += c.v * h;
        if (c.x > W + 140) c.x = -140;
      }
      for (const f of flakes) {
        f.d += h;
        f.y += (weather === 'ember' ? -f.v : f.v) * h;
        f.x += Math.sin(f.d) * 12 * h;
        if (f.y > H + 10) f.y = -10;
        if (f.y < -10) f.y = H + 10;
      }
    },

    /** Everything behind the castles. */
    drawSky(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, spec.sky[0]);
      g.addColorStop(1, spec.sky[1]);
      ctx.fillStyle = g;
      ctx.fillRect(-400, -200, W + 800, H + 400);

      // sun or furnace glow
      ctx.save();
      ctx.globalAlpha = spec.ember ? 0.55 : 0.35;
      ctx.fillStyle = spec.ember ? '#ff7a3a' : '#fff6d8';
      ctx.beginPath();
      ctx.arc(W * 0.78, 120, 78, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = spec.ember ? '#ffb06a' : '#fffdf2';
      ctx.beginPath();
      ctx.arc(W * 0.78, 120, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      for (const c of clouds) drawCloud(ctx, c, spec);
      band(ctx, far, spec.far);
      band(ctx, near, spec.near);
    },

    /** The dirt, drawn from the live heightmap — craters and all. */
    drawGround(ctx) {
      const h = terrain.h;
      ctx.beginPath();
      ctx.moveTo(-40, H + 40);
      ctx.lineTo(-40, h[0]);
      for (let i = 0; i < NCOL; i++) ctx.lineTo(i * COL_W, h[i]);
      ctx.lineTo(W + 40, h[NCOL - 1]);
      ctx.lineTo(W + 40, H + 40);
      ctx.closePath();

      const g = ctx.createLinearGradient(0, 420, 0, H);
      g.addColorStop(0, spec.body);
      g.addColorStop(1, spec.deep);
      ctx.fillStyle = g;
      ctx.fill();

      // the crust: a thick stroke that follows the surface, so a fresh crater
      // shows its cut edge instead of a painted-on stripe
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 9;
      ctx.strokeStyle = spec.cap;
      ctx.beginPath();
      ctx.moveTo(-40, h[0] + 4);
      for (let i = 0; i < NCOL; i++) ctx.lineTo(i * COL_W, h[i] + 4);
      ctx.lineTo(W + 40, h[NCOL - 1] + 4);
      ctx.stroke();
      ctx.restore();

      // speckles fixed to the world, not to the screen
      ctx.fillStyle = spec.speck;
      ctx.globalAlpha = 0.5;
      for (let i = 2; i < NCOL; i += 7) {
        const y = h[i];
        if (y > FLOOR_Y - 2) continue;
        const n = ((i * 9301 + 49297) % 233280) / 233280;
        ctx.fillRect(i * COL_W + n * 3, y + 12 + n * 26, 2 + n * 2, 2);
      }
      ctx.globalAlpha = 1;

      // the pit at the bottom of the world: nothing is coming back out of it
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-40, FLOOR_Y + 6, W + 80, H - FLOOR_Y);
    },

    /** Snow or embers, in front of everything. */
    drawWeather(ctx) {
      if (!weather) return;
      ctx.save();
      ctx.fillStyle = weather === 'ember' ? '#ff9a4a' : '#ffffff';
      ctx.globalAlpha = weather === 'ember' ? 0.75 : 0.8;
      for (const f of flakes) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  };
}

function band(ctx, pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, H + 40);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.lineTo(pts[pts.length - 1].x, H + 40);
  ctx.closePath();
  ctx.fill();
}

function drawCloud(ctx, c, spec) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(c.s, c.s);
  ctx.globalAlpha = spec.ember ? 0.35 : 0.75;
  ctx.fillStyle = spec.ember ? '#5a3a3a' : '#ffffff';
  for (const [dx, dy, r] of [[-26, 4, 16], [0, 0, 22], [24, 6, 15], [8, 10, 14]]) {
    ctx.beginPath();
    ctx.arc(dx, dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
