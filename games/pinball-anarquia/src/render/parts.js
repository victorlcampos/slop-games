// Everything on the table that stands up off the felt, moves, or lights up.
//
// Two rules make this read as three-dimensional rather than as a diagram:
//
//   1. Anything round is sized with `P.sizeAt`, not the width scale. The table
//      is drawn at a different aspect on a phone than on a monitor, and a
//      radius taken from either axis alone comes out wrong on the other.
//   2. Anything that stands up is drawn twice — a footprint where the physics
//      actually is, and a top face `P.rise` above it, with the side between
//      them. That gap is the whole illusion: it is what tells you a bumper is
//      a thing sticking out of the playfield and not a circle printed on it.

import { C, PLUNGER } from '../config.js';
import { flipperTip } from '../table.js';
import { STRINGS, ROSETTE, INSERTS, LADDER, lampOn } from './lights.js';
import { alpha, mix, glow, circleA, roundRect, castShadow, LIGHT } from './util.js';

const PI = Math.PI;

export function paintParts(ctx, game, P, now, attract) {
  const { table, state, ball } = game;

  lamps(ctx, P, now);
  rosette(ctx, P, now, state, attract);
  inserts(ctx, P, now, state, attract);
  ladder(ctx, P, state, attract);
  rollovers(ctx, P, table, now, attract);
  laneButtons(ctx, P, table, now, attract);
  loopMarks(ctx, P, table, now, attract);
  spinner(ctx, P, table, now);
  wormhole(ctx, P, table, now);
  posts(ctx, P, table);
  targets(ctx, P, table);
  slingshots(ctx, P, table, now, attract);
  bumpers(ctx, P, table, now, attract);
  kickback(ctx, P, table, now);
  flippers(ctx, P, table);
  plunger(ctx, P, state, ball);
  if (state.phase !== 'over' && state.phase !== 'captured') theBall(ctx, P, ball);
}

/**
 * The silhouette of something standing on the felt, from its footprint up to
 * its top face. `taper` narrows the top: a straight-sided column reads as a tin
 * can, and almost nothing on a playfield is a tin can — the parts are moulded,
 * so they all pull in slightly on the way up.
 */
function column(ctx, base, top, r, fill, edge, taper = 1) {
  const rt = r * taper;
  ctx.beginPath();
  ctx.moveTo(top.x + rt, top.y);
  ctx.lineTo(base.x + r, base.y);
  ctx.arc(base.x, base.y, r, 0, PI);
  ctx.lineTo(top.x - rt, top.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- lamps

function lamps(ctx, P, now) {
  for (const s of STRINGS) {
    s.lamps.forEach((l, i) => {
      const on = lampOn(s, i, now);
      const p = P.rise(P.at(l.x, l.y), l.h || 3);
      const r = s.r * P.sizeAt(l.y);
      // Only a lamp the chase is actually on gets a halo. The idling ones keep
      // their colour and their socket, which is all they were contributing —
      // and two thirds of the frame's halos went away with them.
      if (on > 0.5) glow(ctx, s.color, p.x, p.y, r * 4.4, on * 0.9);
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
    const r = 5.5 * P.sizeAt(b.y);
    glow(ctx, color, p.x, p.y, r * 4.4, on);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, PI * 2);
    ctx.fillStyle = mix(color, '#ffffff', on * 0.6);
    ctx.fill();
  });

  const pulse = 0.55 + 0.45 * Math.sin(now * 4);
  const r = P.sizeAt(y);
  glow(ctx, C.cyan, c.x, c.y, 46 * r, 0.55 * pulse, true);
  circleA(ctx, c.x, c.y, 20 * r, alpha(C.bright, 0.4 + 0.45 * pulse), 2.4 * r);
}

/** T-I-L-T. They light with the tilt warning, which is the joke: the closer
 *  you are to losing the ball to a shove, the prettier the table gets. */
function inserts(ctx, P, now, state, attract) {
  const heat = attract ? ((Math.sin(now * 2) + 1) / 2) * 2 : state.tiltHeat;
  INSERTS.forEach((ins, i) => {
    const on = state.tilt ? (Math.floor(now * 8) % 2 === 0 ? 1 : 0.2) : heat > i ? 1 : 0.12;
    const p = P.at(ins.x, ins.y);
    const k = P.sizeAt(ins.y);
    const w = ins.w * k;
    const h = ins.h * k;
    if (on > 0.3) glow(ctx, ins.color, p.x, p.y, w * 1.6, on * 0.8);
    roundRect(ctx, p.x - w / 2, p.y - h / 2, w, h, 3 * k);
    ctx.fillStyle = alpha(ins.color, 0.1 + on * 0.7);
    ctx.fill();
    ctx.font = `bold ${11 * k}px "Segoe UI", system-ui, sans-serif`;
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
    if (!(attract || state.mult - 1 > i)) return;
    const p = P.at(l.x, l.y);
    const k = P.sizeAt(l.y);
    glow(ctx, l.color, p.x, p.y, l.w * k * 1.3, 0.7);
    roundRect(ctx, p.x - (l.w * k) / 2, p.y - (l.h * k) / 2, l.w * k, l.h * k, 3 * k);
    ctx.fillStyle = alpha(l.color, 0.85);
    ctx.fill();
  });
}

// ---------------------------------------------------------------- furniture

function rollovers(ctx, P, table, now, attract) {
  table.rollovers.forEach((r, i) => {
    const on = attract ? (Math.floor(now * 4) + i) % 3 === 0 : r.lit || r.flash > 0;
    const p = P.at(r.x, r.y);
    const rad = 13 * P.sizeAt(r.y);
    glow(ctx, C.yellow, p.x, p.y, rad * 3.4, on ? 0.95 : 0.3);
    circleA(ctx, p.x, p.y, rad, on ? '#ffffff' : alpha(C.yellow, 0.72), (on ? 3 : 2) * P.sizeAt(r.y));
  });
}

/** The rollover buttons in the inlanes and the outlanes. */
function laneButtons(ctx, P, table, now, attract) {
  const draw = (r, color, lit) => {
    const p = P.rise(P.at(r.x, r.y), 3);
    const k = P.sizeAt(r.y);
    const on = lit || r.flash > 0.05 || attract;
    if (on) glow(ctx, color, p.x, p.y, 22 * k, 0.55 + r.flash * 0.45);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r.r * k, r.r * 0.62 * k, 0, 0, PI * 2);
    ctx.fillStyle = on ? alpha(mix(color, '#ffffff', 0.6), 0.95) : alpha(mix(color, '#ffffff', 0.15), 0.55);
    ctx.fill();
    ctx.strokeStyle = alpha('#05050c', 0.8);
    ctx.lineWidth = 1.6 * k;
    ctx.stroke();
  };
  for (const r of table.inlanes) draw(r, C.green, r.lit);
  for (const r of table.outlanes) draw(r, C.red, false);
}

/** The two ends of the orbit, as one arrow each pointing the way round. */
function loopMarks(ctx, P, table, now, attract) {
  table.loops.forEach((z, i) => {
    const p = P.rise(P.at(z.x, z.y), 4);
    const k = P.sizeAt(z.y);
    const live = z.flash > 0.05 || attract || (Math.floor(now * 2.5) + i) % 2 === 0;
    if (live) glow(ctx, C.cyan, p.x, p.y, 30 * k, 0.45 + z.flash * 0.55);
    // one arrow, not a stack of chevrons: two overlapping chevrons at this size
    // stopped reading as a direction and started reading as a scribble
    const dir = i === 0 ? -1 : 1; // both point up the orbit, away from the flippers
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(dir * 0.35);
    ctx.beginPath();
    ctx.moveTo(0, -13 * k);
    ctx.lineTo(9 * k, 2 * k);
    ctx.lineTo(3.5 * k, 2 * k);
    ctx.lineTo(3.5 * k, 12 * k);
    ctx.lineTo(-3.5 * k, 12 * k);
    ctx.lineTo(-3.5 * k, 2 * k);
    ctx.lineTo(-9 * k, 2 * k);
    ctx.closePath();
    ctx.fillStyle = live ? alpha(mix(C.cyan, '#ffffff', 0.5), 0.9) : alpha(C.cyan, 0.28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(5,5,12,0.8)';
    ctx.lineWidth = 1.4 * k;
    ctx.stroke();
    ctx.restore();
  });
}

/** The spinner: a vane on a spindle, still turning after the ball is gone. */
function spinner(ctx, P, table, now) {
  const sp = table.spinner;
  const base = P.at(sp.x, sp.y);
  const k = P.sizeAt(sp.y);
  const w = 11 * k;
  const h = 15 * k;
  const axle = P.rise(base, 30);

  castShadow(ctx, base.x, base.y, w, 30, k, 0.5);

  // the slot in the wood the vane hangs over
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, w * 1.15, 3.4 * k, 0, 0, PI * 2);
  ctx.fillStyle = 'rgba(4,4,10,0.85)';
  ctx.fill();

  // the two uprights it swings between
  for (const dx of [-w - 3 * k, w + 3 * k]) {
    ctx.beginPath();
    ctx.moveTo(base.x + dx - 2 * k, base.y);
    ctx.lineTo(base.x + dx + 2 * k, base.y);
    ctx.lineTo(axle.x + dx + 2 * k, axle.y - h);
    ctx.lineTo(axle.x + dx - 2 * k, axle.y - h);
    ctx.closePath();
    const rod = ctx.createLinearGradient(base.x + dx - 2 * k, 0, base.x + dx + 2 * k, 0);
    rod.addColorStop(0, '#232840');
    rod.addColorStop(0.45, '#9aa4d0');
    rod.addColorStop(1, '#2b3150');
    ctx.fillStyle = rod;
    ctx.fill();
  }

  // The vane, foreshortened by its own rotation — that squash IS the spin, and
  // it is the only animation on the table that carries on after the ball has
  // gone, which is exactly what a real spinner does.
  const face = Math.cos(sp.angle);
  if (sp.spin > 0.2) glow(ctx, C.yellow, axle.x, axle.y - h / 2, 30 * k, Math.min(1, sp.spin / 8), true);
  ctx.save();
  ctx.translate(axle.x, axle.y - h / 2);
  ctx.scale(Math.max(0.05, Math.abs(face)), 1);
  ctx.fillStyle = face > 0 ? mix(C.yellow, '#ffffff', 0.4) : mix(C.yellow, '#05050c', 0.5);
  roundRect(ctx, -w, -h, w * 2, h * 2, 2 * k);
  ctx.fill();
  ctx.strokeStyle = 'rgba(5,5,12,0.85)';
  ctx.lineWidth = 1.5 * k;
  ctx.stroke();
  if (Math.abs(face) > 0.45) {
    ctx.strokeStyle = alpha('#05050c', 0.5);
    ctx.lineWidth = 1.4 * k;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-w * 0.62, i * h * 0.55);
      ctx.lineTo(w * 0.62, i * h * 0.55);
      ctx.stroke();
    }
  }
  ctx.restore();

  // the spindle across the top, which is what it hangs from
  ctx.beginPath();
  ctx.moveTo(axle.x - w - 3 * k, axle.y - h);
  ctx.lineTo(axle.x + w + 3 * k, axle.y - h);
  ctx.strokeStyle = '#c9d1ee';
  ctx.lineWidth = 2 * k;
  ctx.stroke();
}

/** The round posts the ball rattles off, as little chrome columns. */
function posts(ctx, P, table) {
  for (const q of table.posts || []) {
    const base = P.at(q.x, q.y);
    const top = P.rise(base, 22);
    const r = q.r * P.sizeAt(q.y);
    castShadow(ctx, base.x, base.y, r, 22, P.sizeAt(q.y), 0.6);
    column(ctx, base, top, r, '#39406a', 'rgba(0,0,0,0.6)', 0.82);
    // the rubber ring every post on a real table wears, at the height the ball
    // actually meets it
    const mid = P.rise(base, 11);
    ctx.beginPath();
    ctx.ellipse(mid.x, mid.y, r * 1.22, r * 0.62, 0, 0, PI * 2);
    ctx.fillStyle = alpha(C.red, 0.85);
    ctx.fill();
    const cap = ctx.createRadialGradient(top.x - r * 0.4, top.y - r * 0.4, 0, top.x, top.y, r);
    cap.addColorStop(0, '#ffffff');
    cap.addColorStop(0.6, '#9aa4d0');
    cap.addColorStop(1, '#4a5378');
    ctx.beginPath();
    ctx.arc(top.x, top.y, r, 0, PI * 2);
    ctx.fillStyle = cap;
    ctx.fill();
  }
}

function targets(ctx, P, table) {
  for (const t of table.targets) {
    const a = P.at(t.x1, t.y1);
    const b = P.at(t.x2, t.y2);
    const k = P.sizeAt((t.y1 + t.y2) / 2);
    ctx.save();
    ctx.lineCap = 'round';

    // the slot it drops into. It used to be drawn thicker than the target
    // standing in it, which made a raised target read as a dark bar with a
    // sliver of colour on top — the hole cannot outweigh the thing in it.
    ctx.strokeStyle = 'rgba(5,5,10,0.7)';
    ctx.lineWidth = 5 * k;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    if (!t.up) {
      ctx.strokeStyle = alpha(C.dim, 0.55);
      ctx.lineWidth = 3 * k;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    const ra = P.rise(a, 38);
    const rb = P.rise(b, 38);
    castShadow(ctx, (a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(b.x - a.x, b.y - a.y) * 0.4, 38, k, 0.5);
    glow(ctx, C.red, (ra.x + rb.x) / 2, (ra.y + rb.y) / 2, 40 * k, 0.55 + t.flash * 0.45);

    // the face, standing in the slot
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(rb.x, rb.y);
    ctx.lineTo(ra.x, ra.y);
    ctx.closePath();
    const face = ctx.createLinearGradient(0, ra.y, 0, a.y);
    face.addColorStop(0, mix(C.red, '#ffffff', 0.5));
    face.addColorStop(0.55, C.red);
    face.addColorStop(1, mix(C.red, '#12121c', 0.45));
    ctx.fillStyle = face;
    ctx.fill();
    ctx.strokeStyle = 'rgba(5,5,10,0.85)';
    ctx.lineWidth = 1.4 * k;
    ctx.stroke();

    // a lit strip along its top edge, so it catches the eye from the flippers
    ctx.strokeStyle = t.flash > 0.2 ? '#ffffff' : mix(C.red, '#ffffff', 0.7);
    ctx.lineWidth = 4 * k;
    ctx.beginPath();
    ctx.moveTo(ra.x, ra.y);
    ctx.lineTo(rb.x, rb.y);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * A slingshot is a wedge of plastic with a rubber band stretched down one face
 * and a lamp under it. Drawn as an outlined triangle it read as a hole in the
 * table — the body has to be opaque and it has to have a side, because on a
 * real machine it is the one thing on the playfield you cannot see through.
 */
function slingshots(ctx, P, table, now, attract) {
  for (const sl of table.slings) {
    const f = attract ? 0.3 + 0.3 * Math.sin(now * 5) : sl.flash;
    const a = P.at(sl.face.x1, sl.face.y1);
    const b = P.at(sl.face.x2, sl.face.y2);
    const c = P.at(sl.body[0].x2, sl.body[0].y2);
    const k = P.sizeAt(sl.face.y1);
    const H = 15;
    const ra = P.rise(a, H);
    const rb = P.rise(b, H);
    const rc = P.rise(c, H);
    ctx.save();

    castShadow(ctx, (a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, Math.hypot(b.x - a.x, b.y - a.y) * 0.5, H, k, 0.5);
    if (f > 0.02) glow(ctx, C.red, (ra.x + rb.x) / 2, (ra.y + rb.y) / 2, 74 * k, f, true);

    // the side, from the felt up to the top face
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(rc.x, rc.y);
    ctx.lineTo(rb.x, rb.y);
    ctx.lineTo(ra.x, ra.y);
    ctx.closePath();
    ctx.fillStyle = '#0d0b17';
    ctx.fill();

    // the top face, moulded plastic with a lamp under it
    ctx.beginPath();
    ctx.moveTo(ra.x, ra.y);
    ctx.lineTo(rb.x, rb.y);
    ctx.lineTo(rc.x, rc.y);
    ctx.closePath();
    const body = ctx.createLinearGradient(ra.x, ra.y, rc.x, rc.y);
    body.addColorStop(0, f > 0.25 ? mix('#3a2340', C.red, f * 0.8) : '#33284d');
    body.addColorStop(1, '#191430');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = alpha('#05050a', 0.9);
    ctx.lineWidth = 1.8 * k;
    ctx.stroke();

    const mx = (ra.x + rb.x + rc.x) / 3;
    const my = (ra.y + rb.y + rc.y) / 3;
    glow(ctx, C.red, mx, my, 16 * k, f > 0.25 ? 1 : 0.35);
    ctx.beginPath();
    ctx.arc(mx, my, 7 * k, 0, PI * 2);
    ctx.fillStyle = f > 0.25 ? '#ffffff' : alpha(C.red, 0.6);
    ctx.fill();

    // the rubber, stretched between two posts along the face that kicks
    ctx.lineCap = 'round';
    for (const [lw, color] of [[7 * k, '#05050a'], [4.5 * k, f > 0.25 ? '#ffffff' : mix(C.red, '#ffffff', 0.15)]]) {
      ctx.beginPath();
      ctx.moveTo(ra.x, ra.y);
      ctx.lineTo(rb.x, rb.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    for (const [p, q] of [[a, ra], [b, rb]]) {
      column(ctx, p, q, 4.5 * k, '#5b658f', 'rgba(0,0,0,0.7)');
      ctx.beginPath();
      ctx.arc(q.x, q.y, 4.5 * k, 0, PI * 2);
      ctx.fillStyle = '#c9d1ee';
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * The pop bumpers: a lit skirt on the felt, a body standing off it, and a cap
 * that fires white. Drawn a fifth larger than their collision radius, because
 * a real bumper's skirt overhangs the ring that actually hits the ball.
 */
function bumpers(ctx, P, table, now, attract) {
  table.bumpers.forEach((b, i) => {
    const f = attract ? ((Math.floor(now * 4) + i) % 3 === 0 ? 0.85 : 0.12) : b.flash;
    const base = P.at(b.x, b.y);
    const k = P.sizeAt(b.y);
    const r = b.r * 1.2 * k;
    const top = P.rise(base, 15);

    castShadow(ctx, base.x, base.y, r, 15, k, 0.62);
    // A halo four radii wide, additively blended, three times a frame, was half
    // the cost of drawing the entire table — the area of a glow goes up with
    // the square of its radius and it is very easy not to notice. It is tight
    // now, and only goes additive on the frames the bumper actually fires.
    glow(ctx, b.color, base.x, base.y, r * 2.3, 0.62 + f * 0.9, f > 0.2);

    // skirt on the felt
    const skirt = ctx.createRadialGradient(base.x, base.y, r * 0.4, base.x, base.y, r * 1.8);
    skirt.addColorStop(0, alpha(b.color, 0.72 + f * 0.28));
    skirt.addColorStop(0.55, alpha(b.color, 0.26));
    skirt.addColorStop(1, alpha(b.color, 0));
    ctx.fillStyle = skirt;
    ctx.beginPath();
    ctx.arc(base.x, base.y, r * 1.8, 0, PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(base.x, base.y, r * 1.32, 0, PI * 2);
    ctx.strokeStyle = alpha(mix(b.color, '#ffffff', 0.35), 0.5);
    ctx.lineWidth = 1.8 * k;
    ctx.stroke();

    // the body, a lit column
    const side = ctx.createLinearGradient(base.x - r, 0, base.x + r, 0);
    side.addColorStop(0, mix(b.color, '#05050a', 0.55));
    side.addColorStop(0.4, mix(b.color, '#ffffff', 0.15 + f * 0.3));
    side.addColorStop(1, mix(b.color, '#05050a', 0.7));
    column(ctx, base, top, r, side, 'rgba(0,0,0,0.55)', 0.9);

    // the cap
    const cap = ctx.createRadialGradient(top.x - r * 0.36, top.y - r * 0.42, r * 0.06, top.x, top.y, r);
    cap.addColorStop(0, '#ffffff');
    cap.addColorStop(0.32, mix(b.color, '#ffffff', 0.62 + f * 0.38));
    cap.addColorStop(0.74, b.color);
    cap.addColorStop(1, mix(b.color, '#0a0a12', 0.45));
    ctx.beginPath();
    ctx.arc(top.x, top.y, r * 0.9, 0, PI * 2);
    ctx.fillStyle = cap;
    ctx.fill();
    ctx.lineWidth = 2.6 * k;
    ctx.strokeStyle = f > 0.3 ? '#ffffff' : alpha('#07070d', 0.85);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(top.x, top.y, r * 0.5, 0, PI * 2);
    ctx.fillStyle = f > 0.3 ? '#ffffff' : alpha('#0d1020', 0.9);
    ctx.fill();
    circleA(ctx, top.x, top.y, r * 0.27, f > 0.3 ? '#12121c' : mix(b.color, '#ffffff', 0.72), 1.9 * k);
  });
}

/** The wormhole: a hole, so it goes the other way — down. */
function wormhole(ctx, P, table, now) {
  const h = table.hole;
  const p = P.at(h.x, h.y);
  const k = P.sizeAt(h.y);
  const r = (h.r + 4) * k;

  glow(ctx, C.green, p.x, p.y, r * 3.6, 0.55 + h.flash * 0.45, true);

  // The metal collar round the hole. It gets a full ring, brighter on the far
  // side where the light hits it: with only the far half drawn the hole read as
  // a sticker, because nothing on a table has an edge on one side only.
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 1.2, 0, PI * 2);
  ctx.fillStyle = '#141a20';
  ctx.fill();
  const collar = ctx.createLinearGradient(0, p.y - r * 1.2, 0, p.y + r * 1.2);
  collar.addColorStop(0, mix(C.green, '#ffffff', 0.55));
  collar.addColorStop(0.5, C.green);
  collar.addColorStop(1, mix(C.green, '#05050c', 0.5));
  ctx.strokeStyle = collar;
  ctx.lineWidth = 3 * k;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 1.2, 0, PI * 2);
  ctx.stroke();

  const pit = ctx.createRadialGradient(p.x, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
  pit.addColorStop(0, '#02170c');
  pit.addColorStop(0.55, '#010a06');
  pit.addColorStop(1, '#000000');
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, PI * 2);
  ctx.fillStyle = pit;
  ctx.fill();
  // one spiral turning in the dark, drawn as a single stroke — three concentric
  // arcs at different phases read as a face, which is not what a hole should do
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = now * 2.2 + t * PI * 3.2;
    const rad = r * (0.16 + t * 0.72);
    const x = p.x + Math.cos(a) * rad;
    const y = p.y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = alpha(C.green, 0.7);
  ctx.lineWidth = 1.6 * k;
  ctx.stroke();
}

function kickback(ctx, P, table, now) {
  const kb = table.kickback;
  const on = kb.lit || kb.flash > 0;
  const p = P.at(kb.x, kb.y);
  const k = P.sizeAt(kb.y);
  if (on) glow(ctx, C.green, p.x, p.y, 26 * k, 0.5 + 0.3 * Math.sin(now * 6) + kb.flash);
  ctx.save();
  ctx.strokeStyle = on ? mix(C.green, '#ffffff', 0.3) : alpha(C.dim, 0.7);
  ctx.lineWidth = 3.4 * k;
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const y = p.y - i * 11 * k;
    ctx.beginPath();
    ctx.moveTo(p.x - 8 * k, y + 4 * k);
    ctx.lineTo(p.x, y - 6 * k);
    ctx.lineTo(p.x + 8 * k, y + 4 * k);
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
    const k = P.sizeAt(f.py);
    const ra = P.rise(a, 10);
    const rb = P.rise(b, 10);
    ctx.save();
    ctx.lineCap = 'round';

    // the shadow it lays on the felt, offset the way every other shadow here is
    const bat = f.r * 2.5 * k;
    const off = 10 * 0.42 * k;
    ctx.strokeStyle = 'rgba(4,5,10,0.6)';
    ctx.lineWidth = bat * 1.05;
    ctx.beginPath();
    ctx.moveTo(a.x + LIGHT.x * off, a.y + LIGHT.y * off);
    ctx.lineTo(b.x + LIGHT.x * off, b.y + LIGHT.y * off);
    ctx.stroke();

    glow(ctx, C.blue, (ra.x + rb.x) / 2, (ra.y + rb.y) / 2, 44 * k, 0.5);
    ctx.lineWidth = bat;
    ctx.strokeStyle = '#0a0b14';
    ctx.beginPath();
    ctx.moveTo(ra.x, ra.y);
    ctx.lineTo(rb.x, rb.y);
    ctx.stroke();
    ctx.lineWidth = bat - 4 * k;
    const bar = ctx.createLinearGradient(0, ra.y - 9 * k, 0, ra.y + 9 * k);
    bar.addColorStop(0, '#ffffff');
    bar.addColorStop(0.45, C.bright);
    bar.addColorStop(1, C.blue);
    ctx.strokeStyle = bar;
    ctx.beginPath();
    ctx.moveTo(ra.x, ra.y);
    ctx.lineTo(rb.x, rb.y);
    ctx.stroke();
    ctx.lineWidth = 2.4 * k;
    ctx.strokeStyle = alpha(C.red, 0.85);
    ctx.beginPath();
    ctx.moveTo(ra.x, ra.y - f.r * 0.5 * k);
    ctx.lineTo(rb.x, rb.y - f.r * 0.5 * k);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ra.x, ra.y, 4 * k, 0, PI * 2);
    ctx.fillStyle = '#0a0b14';
    ctx.fill();
    ctx.restore();
  }
}

function plunger(ctx, P, state, ball) {
  const resting = state.phase === 'plunger';
  const topY = resting ? ball.y + ball.r + 3 : 664;
  const a = P.rise(P.at(PLUNGER.x, topY), 8);
  const b = P.rise(P.at(PLUNGER.x, 700), 8);
  const k = P.sizeAt(690);
  ctx.save();
  ctx.strokeStyle = mix(C.orange, '#ffffff', 0.15);
  ctx.lineWidth = 3 * k;
  ctx.lineJoin = 'round';
  if (state.charge > 0) glow(ctx, C.orange, b.x, (a.y + b.y) / 2, 30 * k, state.charge);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  const coils = 8;
  for (let i = 0; i <= coils; i++) {
    ctx.lineTo(a.x + (i % 2 === 0 ? -9 : 9) * k, a.y + ((b.y - a.y) * i) / coils);
  }
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.fillStyle = C.orange;
  ctx.fillRect(b.x - 13 * k, b.y, 26 * k, 8 * k);
  if (resting && state.charge > 0) {
    ctx.fillStyle = C.red;
    ctx.fillRect(b.x - 15 * k, b.y + 11 * k, 30 * k * state.charge, 4 * k);
  }
  ctx.restore();
}

/** Chrome, sitting on the felt with its shadow under it. */
function theBall(ctx, P, ball) {
  const base = P.at(ball.x, ball.y);
  const k = P.sizeAt(ball.y);
  const r = ball.r * k;
  const p = P.rise(base, ball.r);

  castShadow(ctx, base.x, base.y, r * 0.92, ball.r, k, 0.6);

  glow(ctx, C.cyan, p.x, p.y, r * 3, 0.45, true);
  const sphere = ctx.createRadialGradient(p.x - r * 0.4, p.y - r * 0.45, r * 0.1, p.x, p.y, r);
  sphere.addColorStop(0, '#ffffff');
  sphere.addColorStop(0.35, '#d6ddf5');
  sphere.addColorStop(0.72, '#8891b5');
  sphere.addColorStop(1, '#232840');
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, PI * 2);
  ctx.fillStyle = sphere;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.x - r * 0.38, p.y - r * 0.42, r * 0.22, 0, PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.x + r * 0.3, p.y + r * 0.4, r * 0.18, 0, PI * 2);
  ctx.fillStyle = alpha(C.cyan, 0.6);
  ctx.fill();
}
