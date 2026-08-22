// The furniture that stands above the playfield: ramps, wire guides, plastics.
//
// This is where the table stops being a picture. A ramp painted on the felt is
// a stripe; a ramp with a floor, two side walls that grow as it climbs, rails
// along its edges and a shadow underneath is something the ball goes *over*.
// The same for the wire guides — a real playfield is threaded with bent rod
// standing a centimetre off the wood, and the thin dark line each one throws is
// worth more depth than any amount of shading on the felt itself.
//
// None of it animates, so all of it is rendered once per layout into a cached
// layer (render/index.js) — which is what lets it afford real blurred shadows.

import { C } from '../config.js';
import { alpha, mix, samplePath, bezier, softShadow, LIGHT } from './util.js';

const PI = Math.PI;

/** Smoothstep, so a ramp starts and ends flat instead of kinking. */
const ease = (t) => t * t * (3 - 2 * t);

/**
 * The two ramps, as a circuit: the left one climbs from the flipper up to the
 * dome, the right one is the habitrail that brings the ball back down. Reading
 * them as one loop is why their heights are mirrored rather than matched.
 */
export const RAMPS = [
  {
    id: 'left',
    color: C.orange,
    half: 13,
    curve: [{ x: 120, y: 534 }, { x: 140, y: 452 }, { x: 112, y: 344 }, { x: 138, y: 262 }],
    height: (t) => 6 + 44 * ease(Math.min(1, t * 1.12)),
  },
  {
    id: 'right',
    color: C.teal,
    half: 13,
    curve: [{ x: 404, y: 236 }, { x: 468, y: 312 }, { x: 464, y: 446 }, { x: 404, y: 524 }],
    height: (t) => 6 + 44 * (1 - ease(Math.min(1, t * 1.05))),
  },
];

/**
 * Bent rod, standing off the wood. Everything here used to be a line painted on
 * the felt; raising them is the cheapest depth on the table, because a wire is
 * thin enough to cost nothing and its shadow lands somewhere the eye can see.
 */
export const WIRES = [
  { arc: [262, 252, 214, PI * 1.06, PI * 1.94], h: 30, r: 2.6 },
  { arc: [262, 252, 168, PI * 1.14, PI * 1.86], h: 25, r: 2.4 },
  { pts: [[136, 56], [136, 140]], h: 28, r: 2.6 },
  { pts: [[208, 30], [208, 140]], h: 28, r: 2.6 },
  { pts: [[280, 30], [280, 140]], h: 28, r: 2.6 },
  { pts: [[352, 56], [352, 140]], h: 28, r: 2.6 },
  { pts: [[44, 310], [102, 442]], h: 26, r: 3 },
  { pts: [[88, 545], [118, 640], [154, 662]], h: 24, r: 2.8 },
  { pts: [[400, 545], [370, 640], [334, 662]], h: 24, r: 2.8 },
  { pts: [[470, 298], [508, 278]], h: 18, r: 2.2 },
];

/**
 * Translucent plastics, mounted on posts over the playfield.
 *
 * They are kept off the middle on purpose: a plastic hides what is under it,
 * and the middle of this table is where the ball lives. In the corners they do
 * their real job — a coloured pane between the lamps and your eye, and a big
 * soft shadow that tells you how far above the wood everything else is.
 */
export const PLASTICS = [
  {
    color: C.magenta,
    h: 54,
    pts: [[28, 228], [96, 218], [118, 266], [88, 296], [34, 284]],
    posts: [[40, 240], [102, 274]],
  },
  {
    color: C.teal,
    h: 54,
    pts: [[384, 110], [456, 124], [468, 182], [428, 208], [380, 166]],
    posts: [[394, 124], [452, 188]],
  },
];

/** Points along a ramp, with the height of the ramp at each. */
export function rampSamples(ramp, n = 46) {
  const path = bezier(...ramp.curve);
  return samplePath(path, n).map((p) => ({ ...p, h: ramp.height(p.t) }));
}

/** Where the lamps down a ramp's outer rail sit, and how high. */
export function rampLamps(ramp, every = 4) {
  return rampSamples(ramp, 40)
    .filter((_, i) => i % every === 0)
    .map((p) => ({ x: p.x + p.nx * ramp.half, y: p.y + p.ny * ramp.half, h: p.h + 4 }));
}

// ---------------------------------------------------------------- drawing

/**
 * Everything above, painted into a layer. `P` is the projection; the layer is
 * in screen coordinates and only has to be rebuilt when the layout changes.
 */
export function paintPropsUnder(ctx, P) {
  for (const ramp of RAMPS) rampShadow(ctx, P, ramp);
  for (const w of WIRES) wireShadow(ctx, P, w);
  for (const p of PLASTICS) plasticShadow(ctx, P, p);
  for (const ramp of RAMPS) rampBody(ctx, P, ramp);
  for (const w of WIRES) wireBody(ctx, P, w);
}

/** Drawn after the ball, because a real plastic is between you and the game. */
export function paintPropsOver(ctx, P) {
  for (const p of PLASTICS) plasticBody(ctx, P, p);
}

// ---------------------------------------------------------------- ramps

function rampOutline(ctx, P, ramp, raised) {
  const pts = rampSamples(ramp);
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = edge(P, p, ramp.half, 1, raised);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  for (let i = pts.length - 1; i >= 0; i--) {
    const q = edge(P, pts[i], ramp.half, -1, raised);
    ctx.lineTo(q.x, q.y);
  }
  ctx.closePath();
}

function edge(P, p, half, side, raised) {
  const felt = P.at(p.x + p.nx * half * side, p.y + p.ny * half * side);
  return raised ? P.rise(felt, p.h) : felt;
}

function rampShadow(ctx, P, ramp) {
  softShadow(
    ctx,
    (c) => {
      const pts = rampSamples(ramp);
      c.beginPath();
      pts.forEach((p, i) => {
        const q = P.at(p.x + p.nx * (ramp.half + 2), p.y + p.ny * (ramp.half + 2));
        const off = p.h * 0.42 * P.sizeAt(p.y);
        const x = q.x + LIGHT.x * off;
        const y = q.y + LIGHT.y * off;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        const q = P.at(p.x - p.nx * (ramp.half + 2), p.y - p.ny * (ramp.half + 2));
        const off = p.h * 0.42 * P.sizeAt(p.y);
        c.lineTo(q.x + LIGHT.x * off, q.y + LIGHT.y * off);
      }
      c.closePath();
    },
    9,
    0.5
  );
}

function rampBody(ctx, P, ramp) {
  const pts = rampSamples(ramp);
  const dark = mix(ramp.color, '#05050c', 0.72);

  // The two side walls, from the felt up to the ramp floor. They are what make
  // the climb readable: at the entrance they are nothing, at the apex they are
  // the tallest thing on that half of the table.
  //
  // Each wall is a flat tone with a lit strip along its top, rather than a
  // gradient down the table. A gradient looked right in isolation and wrong in
  // place: the floor covers the upper half of the wall polygon, so all that
  // survived on screen was the dark end of it — a black band beside every ramp.
  for (const side of [1, -1]) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const q = edge(P, p, ramp.half, side, false);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    for (let i = pts.length - 1; i >= 0; i--) {
      const q = edge(P, pts[i], ramp.half, side, true);
      ctx.lineTo(q.x, q.y);
    }
    ctx.closePath();
    ctx.fillStyle = mix(ramp.color, '#05050c', side > 0 ? 0.5 : 0.62);
    ctx.fill();

    // where the wall meets the wood, one shade darker: contact, not a seam
    ctx.beginPath();
    pts.forEach((p, i) => {
      const q = edge(P, p, ramp.half, side, false);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
      ctx.lineWidth = 2.2 * P.sizeAt(p.y);
    });
    ctx.strokeStyle = dark;
    ctx.stroke();
  }

  // the floor, lit from the far end
  rampOutline(ctx, P, ramp, true);
  const floor = ctx.createLinearGradient(0, P.rise(P.at(0, pts[0].y), pts[0].h).y, 0, P.rise(P.at(0, pts[pts.length - 1].y), pts[pts.length - 1].h).y);
  floor.addColorStop(0, alpha(mix(ramp.color, '#05050c', 0.42), 0.95));
  floor.addColorStop(0.45, alpha(mix(ramp.color, '#ffffff', 0.2), 0.95));
  floor.addColorStop(1, alpha(mix(ramp.color, '#05050c', 0.42), 0.95));
  ctx.fillStyle = floor;
  ctx.fill();

  // a specular streak down the middle: a ramp is moulded plastic, and the one
  // highlight running its whole length is what says the surface is curved
  ctx.save();
  rampOutline(ctx, P, ramp, true);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = P.rise(P.at(p.x + p.nx * ramp.half * 0.36, p.y + p.ny * ramp.half * 0.36), p.h);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
    ctx.lineWidth = 3.4 * P.sizeAt(p.y);
  });
  ctx.stroke();
  ctx.restore();

  // rungs across it
  ctx.strokeStyle = 'rgba(6,6,14,0.5)';
  ctx.lineWidth = 1.8;
  for (let i = 2; i < pts.length - 1; i += 3) {
    const a = edge(P, pts[i], ramp.half, 1, true);
    const b = edge(P, pts[i], ramp.half, -1, true);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // the rails: a dark rod with a lit spine along the top of each wall
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const side of [1, -1]) {
    for (const [w, color] of [[6, '#07070f'], [2.6, mix(ramp.color, '#ffffff', 0.55)]]) {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const q = edge(P, p, ramp.half, side, true);
        const k = P.sizeAt(p.y);
        if (i === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
        ctx.lineWidth = w * k;
      });
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------- wires

function wirePoints(w) {
  if (w.arc) {
    const [cx, cy, r, a0, a1] = w.arc;
    const out = [];
    for (let i = 0; i <= 24; i++) {
      const a = a0 + ((a1 - a0) * i) / 24;
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return out;
  }
  // a polyline, resampled so the rod bends instead of kinking
  const src = w.pts.map(([x, y]) => ({ x, y }));
  if (src.length === 2) return src;
  const out = [];
  for (let i = 0; i < src.length - 1; i++) {
    for (let j = 0; j < 8; j++) {
      const t = j / 8;
      out.push({ x: src[i].x + (src[i + 1].x - src[i].x) * t, y: src[i].y + (src[i + 1].y - src[i].y) * t });
    }
  }
  out.push(src[src.length - 1]);
  return out;
}

function wireShadow(ctx, P, w) {
  const pts = wirePoints(w);
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#04040a';
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = P.at(p.x, p.y);
    const off = w.h * 0.42 * P.sizeAt(p.y);
    const x = q.x + LIGHT.x * off;
    const y = q.y + LIGHT.y * off;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    ctx.lineWidth = w.r * 2.4 * P.sizeAt(p.y);
  });
  ctx.stroke();
  ctx.restore();
}

function wireBody(ctx, P, w) {
  const pts = wirePoints(w);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // the posts holding each end down
  for (const p of [pts[0], pts[pts.length - 1]]) {
    const base = P.at(p.x, p.y);
    const top = P.rise(base, w.h);
    const k = P.sizeAt(p.y);
    ctx.beginPath();
    ctx.moveTo(base.x - 2.6 * k, base.y);
    ctx.lineTo(base.x + 2.6 * k, base.y);
    ctx.lineTo(top.x + 2.6 * k, top.y);
    ctx.lineTo(top.x - 2.6 * k, top.y);
    ctx.closePath();
    ctx.fillStyle = '#39406a';
    ctx.fill();
  }
  // the rod: dark body, hot spine on top
  for (const [mul, color] of [[2.5, '#0a0a14'], [1.1, '#dbe2ff']]) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const q = P.rise(P.at(p.x, p.y), w.h);
      const k = P.sizeAt(p.y);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
      ctx.lineWidth = w.r * mul * k;
    });
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- plastics

function plasticPath(ctx, P, plastic, raised) {
  ctx.beginPath();
  plastic.pts.forEach(([x, y], i) => {
    const felt = P.at(x, y);
    const q = raised ? P.rise(felt, plastic.h) : felt;
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.closePath();
}

function plasticShadow(ctx, P, plastic) {
  softShadow(
    ctx,
    (c) => {
      c.beginPath();
      plastic.pts.forEach(([x, y], i) => {
        const q = P.at(x, y);
        const off = plastic.h * 0.42 * P.sizeAt(y);
        const px = q.x + LIGHT.x * off;
        const py = q.y + LIGHT.y * off;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      });
      c.closePath();
    },
    11,
    0.3
  );
  // the posts it stands on, and their own small shadows
  for (const [x, y] of plastic.posts) {
    const base = P.at(x, y);
    const top = P.rise(base, plastic.h);
    const k = P.sizeAt(y);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#04050a';
    ctx.beginPath();
    ctx.ellipse(base.x + 2 * k, base.y + 5 * k, 6 * k, 3.4 * k, 0, 0, PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(base.x - 3.4 * k, base.y);
    ctx.lineTo(base.x + 3.4 * k, base.y);
    ctx.lineTo(top.x + 3.4 * k, top.y);
    ctx.lineTo(top.x - 3.4 * k, top.y);
    ctx.closePath();
    const rod = ctx.createLinearGradient(base.x - 3.4 * k, 0, base.x + 3.4 * k, 0);
    rod.addColorStop(0, '#232840');
    rod.addColorStop(0.4, '#8b95c4');
    rod.addColorStop(1, '#2b3150');
    ctx.fillStyle = rod;
    ctx.fill();
  }
}

/**
 * A plastic is a sheet of clear acrylic with ink on it, and the first pass drew
 * it as a dark pane — which on a dark playfield is indistinguishable from a
 * hole. What makes it read is the opposite: it is mostly transparent, and all
 * of its edges are *bright*, because a cut acrylic edge pipes the light from
 * every lamp under it straight out at you.
 */
function plasticBody(ctx, P, plastic) {
  const ys = plastic.pts.map(([, y]) => P.rise(P.at(0, y), plastic.h).y);

  plasticPath(ctx, P, plastic, true);
  const g = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
  g.addColorStop(0, alpha(mix(plastic.color, '#ffffff', 0.55), 0.5));
  g.addColorStop(0.5, alpha(plastic.color, 0.34));
  g.addColorStop(1, alpha(mix(plastic.color, '#ffffff', 0.2), 0.42));
  ctx.fillStyle = g;
  ctx.fill();

  // one sweep of reflected light across the pane. The first version printed a
  // whole field of diagonal stripes on it, which at this size stopped being
  // decoration and became hatching — the visual language for "broken".
  ctx.save();
  plasticPath(ctx, P, plastic, true);
  ctx.clip();
  const c0 = P.rise(P.at(plastic.pts[0][0], plastic.pts[0][1]), plastic.h);
  const sweep = ctx.createLinearGradient(c0.x - 40, Math.min(...ys) - 20, c0.x + 60, Math.max(...ys) + 20);
  sweep.addColorStop(0, 'rgba(255,255,255,0)');
  sweep.addColorStop(0.38, 'rgba(255,255,255,0.3)');
  sweep.addColorStop(0.52, 'rgba(255,255,255,0.05)');
  sweep.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sweep;
  ctx.fillRect(c0.x - 120, Math.min(...ys) - 30, 260, Math.max(...ys) - Math.min(...ys) + 60);
  ctx.restore();

  // the cut edge, lit
  ctx.strokeStyle = alpha(mix(plastic.color, '#ffffff', 0.85), 0.95);
  ctx.lineWidth = 2.4;
  plasticPath(ctx, P, plastic, true);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // a screw at each post
  for (const [x, y] of plastic.posts) {
    const q = P.rise(P.at(x, y), plastic.h);
    const k = P.sizeAt(y);
    ctx.beginPath();
    ctx.arc(q.x, q.y, 3.4 * k, 0, PI * 2);
    ctx.fillStyle = '#c9d1ee';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
