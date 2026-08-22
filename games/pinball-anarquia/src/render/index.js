// The frame, assembled.
//
//   room      → the dark arcade the cabinet stands in
//   cabinet   → the trapezoid, its side walls and the backboard, in screen space
//   felt      → the painted playfield, warped into perspective (cached)
//   parts     → everything that stands up off it, projected
//   glass     → the sheen and the vignette that put it all under glass
//   score     → the backglass, beside the table or across the top of it
//
// Two caches make this affordable: the felt texture is painted once, and its
// warp is computed once per layout. A frame after that is one blit plus the
// live lamps.

import { C } from '../config.js';
import { createProjection } from './project.js';
import { computeLayout, layoutKey } from './layout.js';
import { paintFelt } from './felt.js';
import { paintParts } from './parts.js';
import { paintScore } from './panel.js';
import { makeCanvas, alpha, mix, glow } from './util.js';

export function createRenderer(t) {
  let flat = null; // the playfield, painted flat — independent of layout
  let flatKey = '';
  let warped = null;
  let warpOrigin = { x: 0, y: 0 };
  let warpKey = '';
  let P = null;
  let layout = null;
  const sparks = [];

  /** A burst of light at a table coordinate. */
  function spark(x, y, color, n = 8, speed = 220) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.45, max: 0.45, color });
    }
  }

  function paintFlat(k, v) {
    flat = makeCanvas(Math.ceil(v.srcW * k), Math.ceil(v.srcH * k));
    const g = flat.getContext('2d');
    g.scale(k, k);
    paintFelt(g);
  }

  /**
   * Pull the flat playfield into perspective, one destination row at a time.
   *
   * The loop walks the *destination* and asks which source row belongs there,
   * never the other way round: stepping through source rows instead leaves
   * unpainted gaps wherever the far end compresses, and they show up as a comb
   * of dark lines across the top of the table.
   */
  function buildWarp(k) {
    const v = P.view;
    const ox = v.cx - v.halfW - 8;
    const oy = v.top - 4;
    const w = Math.ceil((v.halfW * 2 + 16) * k);
    const h = Math.ceil((v.bottom - v.top + 10) * k);
    warped = makeCanvas(w, h);
    const g = warped.getContext('2d');

    for (let py = 0; py < h; py++) {
      const screenY = oy + py / k;
      const tRow = P.rowAt(screenY);
      if (tRow < 0 || tRow > 1) continue;
      const tNext = P.rowAt(screenY + 1 / k);
      // sample as many source rows as this destination row covers, so the
      // compressed far end is minified rather than point-sampled into moiré
      const srcH = Math.max(1, (tNext - tRow) * v.srcH * k);
      const row = P.row(tRow);
      g.drawImage(flat, 0, tRow * v.srcH * k, flat.width, srcH, (v.cx - row.w / 2 - ox) * k, py, row.w * k, 1.02);
    }
    warpOrigin = { x: ox, y: oy };
  }

  function draw(ctx, game, vp, { now = 0, attract = false } = {}) {
    const k = vp.scale * vp.dpr;
    layout = computeLayout(vp.W, vp.H);
    const wk = layoutKey(layout, k);
    if (warpKey !== wk) {
      const fk = k.toFixed(2);
      if (flatKey !== fk) {
        flatKey = fk;
        paintFlat(k, layout.table);
      }
      P = createProjection(layout.table);
      buildWarp(k);
      warpKey = wk;
    }

    room(ctx, vp, now);

    const c = P.corners();
    cabinet(ctx, c, now, layout);
    ctx.drawImage(warped, warpOrigin.x, warpOrigin.y, warped.width / k, warped.height / k);
    depthHaze(ctx, c);
    walls(ctx, c);

    paintParts(ctx, game, P, now, attract);
    paintSparks(ctx);
    if (game.state.tilt) tiltSlam(ctx, c, now);
    glass(ctx, c);
    lockdownBar(ctx, c);

    paintScore(ctx, game, layout, now, attract, t);
  }

  function paintSparks(ctx) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= 1 / 60;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      s.x += s.vx / 60;
      s.y += s.vy / 60;
      s.vy += 14;
      const p = P.rise(P.at(s.x, s.y), 8);
      const a = s.life / s.max;
      const r = P.sizeAt(s.y);
      glow(ctx, s.color, p.x, p.y, 10 * r, a * 0.8);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = a;
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    }
  }

  return {
    draw,
    spark,
    get projection() {
      return P;
    },
    get layout() {
      return layout;
    },
  };
}

// ---------------------------------------------------------------- the room

function room(ctx, vp, now) {
  const g = ctx.createLinearGradient(0, 0, 0, vp.H);
  g.addColorStop(0, '#07070c');
  g.addColorStop(0.55, '#0c0c14');
  g.addColorStop(1, '#050508');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vp.W, vp.H);

  // the machine's own light, spilling onto the wall behind it
  const spill = ctx.createRadialGradient(vp.W * 0.3, 320, 40, vp.W * 0.3, 320, 540);
  spill.addColorStop(0, alpha(C.purple, 0.16));
  spill.addColorStop(0.6, alpha(C.blue, 0.05));
  spill.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spill;
  ctx.fillRect(0, 0, vp.W, vp.H);

  ctx.fillStyle = 'rgba(169,177,214,0.1)';
  for (let i = 0; i < 36; i++) {
    const x = (i * 197.3) % vp.W;
    const y = (i * 151 + now * (5 + (i % 4)) * 3) % vp.H;
    ctx.fillRect(x, y, 2, 2);
  }
}

// ---------------------------------------------------------------- the cabinet

function rimWidths(c) {
  const near = Math.max(16, (c.br.x - c.bl.x) * 0.045);
  return [near, near * 0.6];
}

/** The box the playfield is sunk into, plus the backboard behind it. */
function cabinet(ctx, c, now, layout) {
  const [near, far] = rimWidths(c);
  const bbH = Math.min(46, c.tl.y - (layout.topLimit || 6));

  // backboard: the wall standing at the far end, drawn first so the table's
  // own rim overlaps its foot the way a real one does
  if (bbH > 12) {
    ctx.beginPath();
    ctx.moveTo(c.tl.x - far, c.tl.y + 2);
    ctx.lineTo(c.tr.x + far, c.tr.y + 2);
    ctx.lineTo(c.tr.x + far * 1.5, c.tr.y - bbH);
    ctx.lineTo(c.tl.x - far * 1.5, c.tl.y - bbH);
    ctx.closePath();
    const board = ctx.createLinearGradient(0, c.tl.y - bbH, 0, c.tl.y + 2);
    board.addColorStop(0, '#1d2036');
    board.addColorStop(0.55, '#141626');
    board.addColorStop(1, '#0a0a12');
    ctx.fillStyle = board;
    ctx.fill();
    ctx.strokeStyle = alpha(C.blue, 0.5);
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `900 ${Math.round(bbH * 0.44)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = alpha(C.purple, 0.55 + 0.12 * Math.sin(now * 2));
    ctx.fillText('Ⓐ N A R C H Y', (c.tl.x + c.tr.x) / 2, c.tl.y - bbH * 0.32);
    ctx.restore();
  }

  // the rim: brushed metal around the playfield
  ctx.beginPath();
  ctx.moveTo(c.bl.x - near, c.bl.y + 14);
  ctx.lineTo(c.br.x + near, c.br.y + 14);
  ctx.lineTo(c.tr.x + far, c.tr.y - 8);
  ctx.lineTo(c.tl.x - far, c.tl.y - 8);
  ctx.closePath();
  const rim = ctx.createLinearGradient(c.bl.x - near, 0, c.br.x + near, 0);
  rim.addColorStop(0, '#242942');
  rim.addColorStop(0.18, '#3d4468');
  rim.addColorStop(0.5, '#1c2036');
  rim.addColorStop(0.82, '#3d4468');
  rim.addColorStop(1, '#242942');
  ctx.fillStyle = rim;
  ctx.fill();
  ctx.strokeStyle = alpha(C.blue, 0.55);
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Distance, as light: the far end of a real table is further from every lamp
 *  on it, and drawing it at the same brightness as the near end flattens the
 *  whole thing back out again. */
function depthHaze(ctx, c) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(c.bl.x, c.bl.y);
  ctx.lineTo(c.br.x, c.br.y);
  ctx.lineTo(c.tr.x, c.tr.y);
  ctx.lineTo(c.tl.x, c.tl.y);
  ctx.closePath();
  ctx.clip();
  const haze = ctx.createLinearGradient(0, c.tl.y, 0, c.bl.y);
  haze.addColorStop(0, 'rgba(8,10,24,0.42)');
  haze.addColorStop(0.35, 'rgba(8,10,24,0.1)');
  haze.addColorStop(1, 'rgba(8,10,24,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(c.tl.x - 20, c.tl.y, c.br.x - c.bl.x + 40, c.bl.y - c.tl.y);
  ctx.restore();
}

/** The inner faces of the side walls — what makes it a box and not a picture
 *  of one. Brighter where they catch the playfield's light. */
function walls(ctx, c) {
  const [near, far] = rimWidths(c);

  for (const [b, t2, dir] of [
    [c.bl, c.tl, -1],
    [c.br, c.tr, 1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(t2.x + far * dir, t2.y - 8);
    ctx.lineTo(b.x + near * dir, b.y + 14);
    ctx.closePath();
    const face = ctx.createLinearGradient(b.x, b.y, b.x + near * dir, b.y);
    face.addColorStop(0, alpha(C.blue, 0.5));
    face.addColorStop(0.35, '#2b3150');
    face.addColorStop(1, '#12141f');
    ctx.fillStyle = face;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.strokeStyle = alpha(C.cyan, 0.75);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(c.tl.x, c.tl.y);
  ctx.lineTo(c.tr.x, c.tr.y);
  ctx.strokeStyle = alpha(C.cyan, 0.55);
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

/** The chrome bar you rest your hands on. */
function lockdownBar(ctx, c) {
  const [near] = rimWidths(c);
  const y = c.bl.y + 4;
  const h = Math.max(12, near * 0.75);
  ctx.beginPath();
  ctx.moveTo(c.bl.x - near * 1.15, y + h);
  ctx.lineTo(c.br.x + near * 1.15, y + h);
  ctx.lineTo(c.br.x + near * 0.9, y);
  ctx.lineTo(c.bl.x - near * 0.9, y);
  ctx.closePath();
  const bar = ctx.createLinearGradient(0, y, 0, y + h);
  bar.addColorStop(0, '#7d88b8');
  bar.addColorStop(0.35, '#39406a');
  bar.addColorStop(1, '#171a2a');
  ctx.fillStyle = bar;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** The sheet of glass: one diagonal sheen and a vignette into the corners. */
function glass(ctx, c) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(c.bl.x, c.bl.y);
  ctx.lineTo(c.br.x, c.br.y);
  ctx.lineTo(c.tr.x, c.tr.y);
  ctx.lineTo(c.tl.x, c.tl.y);
  ctx.closePath();
  ctx.clip();

  const w = c.br.x - c.bl.x;
  const h = c.bl.y - c.tl.y;
  const sheen = ctx.createLinearGradient(c.tl.x, c.tl.y, c.br.x, c.br.y);
  sheen.addColorStop(0, 'rgba(255,255,255,0.055)');
  sheen.addColorStop(0.22, 'rgba(255,255,255,0.015)');
  sheen.addColorStop(0.34, 'rgba(255,255,255,0.06)');
  sheen.addColorStop(0.46, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(c.tl.x - 40, c.tl.y - 10, w + 80, h + 20);

  const midX = (c.bl.x + c.br.x) / 2;
  const midY = (c.tl.y + c.bl.y) / 2;
  const vig = ctx.createRadialGradient(midX, midY, Math.max(w, h) * 0.3, midX, midY, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = vig;
  ctx.fillRect(c.tl.x - 40, c.tl.y - 10, w + 80, h + 20);
  ctx.restore();
}

/** TILT, across the whole playfield, in the machine's angriest voice. */
function tiltSlam(ctx, c, now) {
  if (Math.floor(now * 3) % 2) return;
  const cx = (c.bl.x + c.br.x) / 2;
  const cy = (c.tl.y + c.bl.y) / 2 + 40;
  const size = Math.min(112, (c.br.x - c.bl.x) * 0.26);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `900 ${size}px "Segoe UI", system-ui, sans-serif`;
  glow(ctx, C.red, cx, cy - size * 0.3, size * 2.6, 0.8);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#12121c';
  ctx.strokeText('TILT', cx, cy);
  ctx.fillStyle = mix(C.red, '#ffffff', 0.25);
  ctx.fillText('TILT', cx, cy);
  ctx.restore();
}
