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
import { paintPropsUnder, paintPropsOver } from './props.js';
import { paintScore } from './panel.js';
import { makeCanvas, alpha, mix, glow } from './util.js';

export function createRenderer(t) {
  let flat = null; // the playfield, painted flat — independent of layout
  let flatKey = '';
  let warpKey = '';
  // The whole static half of the picture, in one canvas: the warped felt, the
  // depth haze over it, and every raised prop the ball rolls under. It used to
  // be three canvases blitted separately, and at a phone's pixel ratio that was
  // three full-table composites a frame — the single biggest cost in the
  // renderer, for three pictures that never change between frames.
  let board = null;
  let glassLayer = null;
  let boardOrigin = { x: 0, y: 0 };
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
  function warpInto(g, k, ox, oy, h) {
    const v = P.view;
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
  }

  /**
   * Everything static, into one canvas.
   *
   * The layer reaches well above the table's own far edge: a ramp at its apex
   * is drawn forty units higher than the row it belongs to, and a layer cropped
   * to the playfield would slice the top off it.
   */
  function buildBoard(k) {
    const v = P.view;
    const ox = v.cx - v.halfW - 30;
    const oy = v.top - 80;
    const w = Math.ceil((v.halfW * 2 + 60) * k);
    const h = Math.ceil((v.bottom - v.top + 120) * k);
    boardOrigin = { x: ox, y: oy };
    const c = P.corners();

    board = makeCanvas(w, h);
    const g = board.getContext('2d');
    g.setTransform(k, 0, 0, k, -ox * k, -oy * k);
    cabinet(g, c, layout);
    // The warp addresses device rows, so it runs with the transform cleared —
    // and against this layer's own origin. Handing it a different origin and
    // trying to translate the difference away shifted the felt sideways under
    // everything drawn on top of it, which on screen was the whole table
    // wearing a ghost of itself.
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    warpInto(g, k, ox, oy, h);
    g.restore();
    depthHaze(g, c);
    paintPropsUnder(g, P);
    walls(g, c);
    lockdownBar(g, c);

    // the sheet of glass is static too, and it was two clipped full-table fills
    glassLayer = makeCanvas(w, h);
    const gg = glassLayer.getContext('2d');
    gg.setTransform(k, 0, 0, k, -ox * k, -oy * k);
    glass(gg, c);
  }

  function blit(ctx, layer, k) {
    ctx.drawImage(layer, boardOrigin.x, boardOrigin.y, layer.width / k, layer.height / k);
  }

  // Where a frame's time actually goes. Reading it needs a flush, so it is off
  // unless someone asks: `__game.render.profile = true`, then `.timings`.
  const timings = {};
  const api = { profile: false, timings };
  const mark = (ctx, name, t0) => {
    if (!api.profile) return 0;
    ctx.getImageData(0, 0, 1, 1);
    const dt = performance.now() - t0;
    timings[name] = (timings[name] || 0) * 0.9 + dt * 0.1;
    return performance.now();
  };

  function draw(ctx, game, vp, { now = 0, attract = false } = {}) {
    const k = vp.scale * vp.dpr;
    let t0 = api.profile ? performance.now() : 0;
    layout = computeLayout(vp.W, vp.H);
    const wk = layoutKey(layout, k);
    if (warpKey !== wk) {
      const fk = k.toFixed(2);
      if (flatKey !== fk) {
        flatKey = fk;
        paintFlat(k, layout.table);
      }
      P = createProjection(layout.table);
      buildBoard(k);
      warpKey = wk;
    }

    room(ctx, vp, now, k);
    t0 = mark(ctx, 'room', t0) || t0;

    const c = P.corners();
    blit(ctx, board, k);
    backboardTitle(ctx, c, now, layout);
    t0 = mark(ctx, 'board', t0) || t0;

    paintParts(ctx, game, P, now, attract);
    t0 = mark(ctx, 'parts', t0) || t0;

    // the plastics are two polygons and go over the ball, so they stay live
    paintPropsOver(ctx, P);
    paintSparks(ctx);
    if (game.state.tilt) tiltSlam(ctx, c, now);
    blit(ctx, glassLayer, k);
    t0 = mark(ctx, 'glass', t0) || t0;

    paintScore(ctx, game, layout, now, attract, t, k);
    mark(ctx, 'panel', t0);
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

  api.draw = draw;
  api.spark = spark;
  Object.defineProperty(api, 'projection', { get: () => P });
  Object.defineProperty(api, 'layout', { get: () => layout });
  return api;
}

// ---------------------------------------------------------------- the room

/**
 * The dark arcade the cabinet stands in.
 *
 * Two full-screen gradient fills, neither of which ever changes — and together
 * they were the most expensive thing in the whole frame, more than the entire
 * playfield. Cached, they are one blit. Only the dust in the beam moves.
 */
let roomLayer = null;
let roomKey = '';

function room(ctx, vp, now, k) {
  const key = `${vp.W}x${vp.H}@${k.toFixed(2)}`;
  if (roomKey !== key) {
    roomKey = key;
    // built at device resolution, so drawing it back is a straight copy. Built
    // at logical size it was a full-screen *upscale* every frame — blurry, and
    // by some way the most expensive call in the renderer.
    roomLayer = makeCanvas(Math.ceil(vp.W * k), Math.ceil(vp.H * k));
    const g = roomLayer.getContext('2d');
    g.scale(k, k);
    const bg = g.createLinearGradient(0, 0, 0, vp.H);
    bg.addColorStop(0, '#07070c');
    bg.addColorStop(0.55, '#0c0c14');
    bg.addColorStop(1, '#050508');
    g.fillStyle = bg;
    g.fillRect(0, 0, vp.W, vp.H);
    // the machine's own light, spilling onto the wall behind it
    const spill = g.createRadialGradient(vp.W * 0.3, 320, 40, vp.W * 0.3, 320, 540);
    spill.addColorStop(0, alpha(C.purple, 0.16));
    spill.addColorStop(0.6, alpha(C.blue, 0.05));
    spill.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = spill;
    g.fillRect(0, 0, vp.W, vp.H);
  }
  ctx.drawImage(roomLayer, 0, 0, vp.W, vp.H);

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

/** How tall the backboard can be without climbing into whatever is above it. */
function backboardHeight(c, layout) {
  return Math.min(46, c.tl.y - (layout.topLimit || 6));
}

/** The one part of the cabinet that breathes, so the rest of it can be baked. */
function backboardTitle(ctx, c, now, layout) {
  const bbH = backboardHeight(c, layout);
  if (bbH <= 12) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `900 ${Math.round(bbH * 0.44)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = alpha(C.purple, 0.55 + 0.12 * Math.sin(now * 2));
  ctx.fillText('Ⓐ N A R C H Y', (c.tl.x + c.tr.x) / 2, c.tl.y - bbH * 0.32);
  ctx.restore();
}

/** The box the playfield is sunk into, plus the backboard behind it. */
function cabinet(ctx, c, layout) {
  const [near, far] = rimWidths(c);
  const bbH = backboardHeight(c, layout);

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
