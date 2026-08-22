// Everything on the table that moves, lights up, or gets hit.
//
// These are drawn straight in screen space: the projection says where a table
// coordinate lands and how big a thing is there, and each part is painted
// round at that size. Warping their shapes as well would be more correct and
// much slower, and — the part that actually decides it — a bumper cap that
// stays round reads as a bumper standing up off the playfield, which is what
// it is. It is the felt underneath that has to lie flat, and the felt is the
// half that gets warped.

import { C, PLUNGER } from '../config.js';
import { flipperTip } from '../table.js';
import { STRINGS, ROSETTE, INSERTS, LADDER, lampOn } from './lights.js';
import { alpha, mix, glow, circleA, roundRect } from './util.js';

const PI = Math.PI;

export function paintParts(ctx, game, P, now, attract) {
  const { table, state, ball } = game;

  lamps(ctx, P, now);
  rosette(ctx, P, now, state, attract);
  inserts(ctx, P, now, state, attract);
  ladder(ctx, P, state, attract);
  rollovers(ctx, P, table, now, attract);
  targets(ctx, P, table);
  slingshots(ctx, P, table, now, attract);
  bumpers(ctx, P, table, now, attract);
  wormhole(ctx, P, table, now);
  kickback(ctx, P, table, now);
  flippers(ctx, P, table);
  plunger(ctx, P, state, ball);
  if (state.phase !== 'over' && state.phase !== 'captured') theBall(ctx, P, ball);
}

// ---------------------------------------------------------------- lamps

function lamps(ctx, P, now) {
  for (const s of STRINGS) {
    s.lamps.forEach((l, i) => {
      const on = lampOn(s, i, now);
      const p = P.at(l.x, l.y);
      const r = s.r * p.s;
      glow(ctx, s.color, p.x, p.y, r * 6, on * 0.9);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, PI * 2);
      ctx.fillStyle = mix(s.color, '#ffffff', 0.55 * on);
      ctx.globalAlpha = 0.5 + on * 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }
}

/** The reactor ring: eighteen lamps chasing round a core that breathes. */
function rosette(ctx, P, now, state, attract) {
  const { x, y, lamps: beads, colors } = ROSETTE;
  const c = P.at(x, y);
  const speed = attract ? 2.4 : 3.4 + state.mult * 1.2;
  const head = ((now * speed) % beads.length + beads.length) % beads.length;

  beads.forEach((b, i) => {
    let d = Math.abs(i - head);
    d = Math.min(d, beads.length - d);
    const on = d < 4 ? 1 - (d / 4) * 0.6 : 0.4;
    const color = colors[i % colors.length];
    const p = P.at(b.x, b.y);
    const r = 5.5 * p.s;
    glow(ctx, color, p.x, p.y, r * 5.5, on);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, PI * 2);
    ctx.fillStyle = mix(color, '#ffffff', on * 0.6);
    ctx.fill();
  });

  const beatNow = 0.55 + 0.45 * Math.sin(now * 4);
  glow(ctx, C.cyan, c.x, c.y, 46 * c.s, 0.55 * beatNow);
  circleA(ctx, c.x, c.y, 20 * c.s, alpha(C.bright, 0.35 + 0.4 * beatNow), 2.4 * c.s);
}

/** T-I-L-T. They light with the tilt warning, which is the joke: the closer
 *  you are to losing the ball to a shove, the prettier the table gets. */
function inserts(ctx, P, now, state, attract) {
  const heat = attract ? (Math.sin(now * 2) + 1) / 2 * 2 : state.tiltHeat;
  INSERTS.forEach((ins, i) => {
    const on = state.tilt ? (Math.floor(now * 8) % 2 === 0 ? 1 : 0.2) : heat > i ? 1 : 0.12;
    const p = P.at(ins.x, ins.y);
    const w = ins.w * p.s;
    const h = ins.h * p.s;
    if (on > 0.3) glow(ctx, ins.color, p.x, p.y, w * 1.6, on * 0.8);
    roundRect(ctx, p.x - w / 2, p.y - h / 2, w, h, 3 * p.s);
    ctx.fillStyle = alpha(ins.color, 0.1 + on * 0.7);
    ctx.fill();
    ctx.font = `bold ${11 * p.s}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = on > 0.3 ? '#12121c' : alpha(ins.color, 0.5);
    ctx.fillText(ins.label, p.x, p.y);
    ctx.textBaseline = 'alphabetic';
  });
}

/** The bonus ladder climbs with the multiplier. */
function ladder(ctx, P, state, attract) {
  LADDER.forEach((l, i) => {
    const on = attract ? true : state.mult - 1 > i;
    if (!on) return;
    const p = P.at(l.x, l.y);
    const w = l.w * p.s;
    const h = l.h * p.s;
    glow(ctx, l.color, p.x, p.y, w * 1.3, 0.7);
    roundRect(ctx, p.x - w / 2, p.y - h / 2, w, h, 3 * p.s);
    ctx.fillStyle = alpha(l.color, 0.85);
    ctx.fill();
  });
}

// ---------------------------------------------------------------- targets

function rollovers(ctx, P, table, now, attract) {
  table.rollovers.forEach((r, i) => {
    const on = attract ? (Math.floor(now * 4) + i) % 3 === 0 : r.lit || r.flash > 0;
    const p = P.at(r.x, r.y);
    const rad = 13 * p.s;
    glow(ctx, C.yellow, p.x, p.y, rad * 3.4, on ? 0.95 : 0.3);
    circleA(ctx, p.x, p.y, rad, on ? '#ffffff' : alpha(C.yellow, 0.72), (on ? 3 : 2) * p.s);
  });
}

function targets(ctx, P, table) {
  for (const t of table.targets) {
    const a = P.at(t.x1, t.y1);
    const b = P.at(t.x2, t.y2);
    const s = (a.s + b.s) / 2;
    ctx.save();
    ctx.lineCap = 'round';
    if (t.up) {
      glow(ctx, C.red, (a.x + b.x) / 2, (a.y + b.y) / 2, 26 * s, 0.5 + t.flash * 0.5);
      ctx.strokeStyle = mix(C.red, '#ffffff', 0.25);
      ctx.lineWidth = 9 * s;
    } else {
      ctx.strokeStyle = alpha(C.dim, 0.5);
      ctx.lineWidth = 4 * s;
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * A slingshot is a wedge of plastic with a rubber band stretched down one
 * face and a lamp under it. Drawn as an outlined triangle it read as a hole
 * in the table — the body has to be opaque, because on a real machine it is
 * the one thing on the playfield you cannot see the felt through.
 */
function slingshots(ctx, P, table, now, attract) {
  for (const sl of table.slings) {
    const f = attract ? 0.3 + 0.3 * Math.sin(now * 5) : sl.flash;
    const a = P.at(sl.face.x1, sl.face.y1);
    const b = P.at(sl.face.x2, sl.face.y2);
    const c = P.at(sl.body[0].x2, sl.body[0].y2);
    const s = a.s;
    ctx.save();

    if (f > 0.02) glow(ctx, C.red, (a.x + b.x) / 2, (a.y + b.y) / 2, 74 * s, f);

    // the plastic body, opaque and moulded
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.closePath();
    const body = ctx.createLinearGradient(a.x, a.y, c.x, c.y);
    body.addColorStop(0, f > 0.25 ? mix('#3a2340', C.red, f * 0.8) : '#2a2140');
    body.addColorStop(1, '#14101f');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = alpha('#05050a', 0.9);
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    // the lit insert set into it
    const mx = (a.x + b.x + c.x) / 3;
    const my = (a.y + b.y + c.y) / 3;
    ctx.beginPath();
    ctx.arc(mx, my, 7 * s, 0, PI * 2);
    ctx.fillStyle = f > 0.25 ? '#ffffff' : alpha(C.red, 0.5);
    ctx.fill();

    // the rubber, thick and bright, along the face that kicks
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = '#05050a';
    ctx.lineWidth = 7 * s;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = f > 0.25 ? '#ffffff' : mix(C.red, '#ffffff', 0.15);
    ctx.lineWidth = 4.5 * s;
    ctx.stroke();

    // the two posts the rubber is stretched between
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5 * s, 0, PI * 2);
      ctx.fillStyle = '#c9d1ee';
      ctx.fill();
      ctx.strokeStyle = '#05050a';
      ctx.lineWidth = 1.4 * s;
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * The pop bumpers: a wide lit skirt on the playfield, a body standing off it,
 * and a cap that fires white. They are drawn a quarter larger than their
 * collision radius on purpose — a real bumper's skirt overhangs the ring it
 * actually hits you with, and drawn to the physics radius they looked like
 * buttons rather than the loudest thing on the table.
 */
function bumpers(ctx, P, table, now, attract) {
  table.bumpers.forEach((b, i) => {
    const f = attract ? ((Math.floor(now * 4) + i) % 3 === 0 ? 0.85 : 0.12) : b.flash;
    const p = P.at(b.x, b.y);
    const r = b.r * 1.24 * p.s;

    glow(ctx, b.color, p.x, p.y, r * 4, 0.75 + f * 0.9);

    // skirt
    const skirt = ctx.createRadialGradient(p.x, p.y, r * 0.4, p.x, p.y, r * 1.75);
    skirt.addColorStop(0, alpha(b.color, 0.75 + f * 0.25));
    skirt.addColorStop(0.55, alpha(b.color, 0.28));
    skirt.addColorStop(1, alpha(b.color, 0));
    ctx.fillStyle = skirt;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.75, 0, PI * 2);
    ctx.fill();

    // the ring it sits in, printed on the felt
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.28, 0, PI * 2);
    ctx.strokeStyle = alpha(mix(b.color, '#ffffff', 0.5), 0.85);
    ctx.lineWidth = 2.4 * p.s;
    ctx.stroke();

    // body: a translucent dome lit from inside
    const body = ctx.createRadialGradient(p.x - r * 0.36, p.y - r * 0.46, r * 0.08, p.x, p.y, r);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.3, mix(b.color, '#ffffff', 0.6 + f * 0.4));
    body.addColorStop(0.72, b.color);
    body.addColorStop(1, mix(b.color, '#0a0a12', 0.5));
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 3.4 * p.s;
    ctx.strokeStyle = f > 0.3 ? '#ffffff' : alpha('#07070d', 0.85);
    ctx.stroke();

    // the cap, and the A stamped into it
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.6, 0, PI * 2);
    ctx.fillStyle = f > 0.3 ? '#ffffff' : alpha('#0d1020', 0.9);
    ctx.fill();
    ctx.strokeStyle = alpha('#05050a', 0.8);
    ctx.lineWidth = 1.6 * p.s;
    ctx.stroke();
    circleA(ctx, p.x, p.y, r * 0.32, f > 0.3 ? '#12121c' : mix(b.color, '#ffffff', 0.72), 2.1 * p.s);
  });
}

/** The wormhole: a hole with something turning at the bottom of it. */
function wormhole(ctx, P, table, now) {
  const h = table.hole;
  const p = P.at(h.x, h.y);
  const r = (h.r + 4) * p.s;

  glow(ctx, C.green, p.x, p.y, r * 3.6, 0.55 + h.flash * 0.45);
  const pit = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, r);
  pit.addColorStop(0, '#000000');
  pit.addColorStop(0.6, '#04140b');
  pit.addColorStop(1, alpha(C.green, 0.35));
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, PI * 2);
  ctx.fillStyle = pit;
  ctx.fill();
  ctx.lineWidth = 2.6 * p.s;
  ctx.strokeStyle = mix(C.green, '#ffffff', 0.3);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const a0 = now * 2.6 + (i * PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (5 + i * 4) * p.s, a0, a0 + 1.9);
    ctx.strokeStyle = alpha(C.green, 0.75 - i * 0.18);
    ctx.lineWidth = 1.8 * p.s;
    ctx.stroke();
  }
}

function kickback(ctx, P, table, now) {
  const kb = table.kickback;
  const on = kb.lit || kb.flash > 0;
  const p = P.at(kb.x, kb.y);
  if (on) glow(ctx, C.green, p.x, p.y, 26 * p.s, 0.5 + 0.3 * Math.sin(now * 6) + kb.flash);
  ctx.save();
  ctx.strokeStyle = on ? mix(C.green, '#ffffff', 0.3) : alpha(C.dim, 0.7);
  ctx.lineWidth = 3.4 * p.s;
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const y = p.y - i * 11 * p.s;
    ctx.beginPath();
    ctx.moveTo(p.x - 8 * p.s, y + 4 * p.s);
    ctx.lineTo(p.x, y - 6 * p.s);
    ctx.lineTo(p.x + 8 * p.s, y + 4 * p.s);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- machinery

function flippers(ctx, P, table) {
  for (const f of table.flippers) {
    const tip = flipperTip(f);
    const a = P.at(f.px, f.py);
    const b = P.at(tip.x, tip.y);
    const s = (a.s + b.s) / 2;
    ctx.save();
    ctx.lineCap = 'round';
    glow(ctx, C.blue, (a.x + b.x) / 2, (a.y + b.y) / 2, 40 * s, 0.45);
    ctx.lineWidth = f.r * 2 * s;
    ctx.strokeStyle = '#0a0b14';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.lineWidth = (f.r * 2 - 3) * s;
    const bar = ctx.createLinearGradient(a.x, a.y - 8 * s, a.x, a.y + 8 * s);
    bar.addColorStop(0, '#ffffff');
    bar.addColorStop(0.45, C.bright);
    bar.addColorStop(1, C.blue);
    ctx.strokeStyle = bar;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    // the rubber band along the top edge
    ctx.lineWidth = 2.4 * s;
    ctx.strokeStyle = alpha(C.red, 0.85);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - f.r * 0.5 * s);
    ctx.lineTo(b.x, b.y - f.r * 0.5 * s);
    ctx.stroke();
    // pivot
    ctx.beginPath();
    ctx.arc(a.x, a.y, 4 * s, 0, PI * 2);
    ctx.fillStyle = '#0a0b14';
    ctx.fill();
    ctx.restore();
  }
}

function plunger(ctx, P, state, ball) {
  const resting = state.phase === 'plunger';
  const topY = resting ? ball.y + ball.r + 3 : 664;
  const a = P.at(PLUNGER.x, topY);
  const b = P.at(PLUNGER.x, 700);
  const s = b.s;
  ctx.save();
  ctx.strokeStyle = mix(C.orange, '#ffffff', 0.15);
  ctx.lineWidth = 3 * s;
  ctx.lineJoin = 'round';
  if (state.charge > 0) glow(ctx, C.orange, b.x, (a.y + b.y) / 2, 30 * s, state.charge);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  const coils = 8;
  for (let i = 0; i <= coils; i++) {
    const t = i / coils;
    ctx.lineTo(a.x + (i % 2 === 0 ? -9 : 9) * s, a.y + (b.y - a.y) * t);
  }
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.fillStyle = C.orange;
  ctx.fillRect(b.x - 13 * s, b.y, 26 * s, 8 * s);
  if (resting && state.charge > 0) {
    ctx.fillStyle = C.red;
    ctx.fillRect(b.x - 15 * s, b.y + 11 * s, 30 * s * state.charge, 4 * s);
  }
  ctx.restore();
}

/** Chrome, with the table's lights in it. */
function theBall(ctx, P, ball) {
  const p = P.at(ball.x, ball.y);
  const r = ball.r * p.s;

  // the shadow it drops on the felt, offset the way the light comes in
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#04050a';
  ctx.beginPath();
  ctx.ellipse(p.x + r * 0.5, p.y + r * 0.65, r * 1.05, r * 0.8, 0, 0, PI * 2);
  ctx.fill();
  ctx.restore();

  glow(ctx, C.cyan, p.x, p.y, r * 3, 0.4);
  const sphere = ctx.createRadialGradient(p.x - r * 0.4, p.y - r * 0.45, r * 0.1, p.x, p.y, r);
  sphere.addColorStop(0, '#ffffff');
  sphere.addColorStop(0.35, '#d6ddf5');
  sphere.addColorStop(0.72, '#8891b5');
  sphere.addColorStop(1, '#232840');
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, PI * 2);
  ctx.fillStyle = sphere;
  ctx.fill();
  // a hot specular pip and a cool bounce from the felt below
  ctx.beginPath();
  ctx.arc(p.x - r * 0.38, p.y - r * 0.42, r * 0.22, 0, PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.x + r * 0.3, p.y + r * 0.4, r * 0.18, 0, PI * 2);
  ctx.fillStyle = alpha(C.cyan, 0.6);
  ctx.fill();
}
