// The playfield art, painted flat and top-down.
//
// This is the half of the picture that never moves: the felt, the nebula
// printed on it, the metal rails, the ramps, the sockets every lamp sits in,
// the arrows and the inserts. It is drawn once into a texture, and the texture
// is warped into perspective once per resize — so all of this costs nothing
// per frame, which is exactly why it can afford to be as dense as it is.
//
// Nothing here is a photograph or a sprite file: it is gradients, arcs and
// polylines, which is rule nº 5 and also the only reason a table this busy
// fits in a file you can email.

import { C } from '../config.js';
import { STRINGS, ROSETTE, INSERTS, LADDER, STANDUPS } from './lights.js';
import { alpha, mix, roundRect, circleA, rng, samplePath, bezier } from './util.js';

const W = 524;
const H = 720;
const PI = Math.PI;

export function paintFelt(g) {
  g.save();
  base(g);
  nebula(g);
  sunbursts(g);
  ribbons(g);
  starfield(g);
  cracks(g);
  paintedRegions(g);
  ramps(g);
  rails(g);
  arrowsAndSigns(g);
  rosetteFace(g);
  insertFaces(g);
  lampSockets(g);
  g.restore();
}

// ---------------------------------------------------------------- ground

function base(g) {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#232a63');
  grad.addColorStop(0.36, '#2a2a70');
  grad.addColorStop(0.7, '#232659');
  grad.addColorStop(1, '#171a3c');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
}

/**
 * The printed sky the whole table sits on.
 *
 * `lighter` is how a printed field catches the lamps under it, and it is also
 * how a table turns into fog: eight overlapping clouds at a strength that
 * looks right alone add up to white in the middle, and the whole playfield
 * goes hazy. They are kept low and pushed to the *edges* of the table here —
 * the colour on a playfield comes from the silkscreened blocks, not from the
 * glow, and the glow is only what tells you the blocks are lit.
 */
function nebula(g) {
  const clouds = [
    [128, 168, 170, C.blue, 0.3],
    [388, 176, 170, C.purple, 0.26],
    [58, 402, 150, C.magenta, 0.22],
    [452, 420, 150, C.teal, 0.2],
    [245, 452, 130, C.blue, 0.22],
    [64, 620, 140, C.red, 0.16],
    [432, 620, 140, C.red, 0.16],
    [262, 96, 150, C.cyan, 0.16],
  ];
  g.globalCompositeOperation = 'lighter';
  for (const [x, y, r, color, a] of clouds) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, alpha(color, a));
    grad.addColorStop(0.45, alpha(color, a * 0.3));
    grad.addColorStop(1, alpha(color, 0));
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.globalCompositeOperation = 'source-over';
}

/**
 * Sunbursts behind the two clusters your eye spends the game on.
 *
 * A wheel of alternating wedges is the oldest trick on a playfield and it is
 * still the best one: it fills a wide empty area with something that reads as
 * energy rather than as pattern, and it points at whatever sits in the middle
 * of it. The upper playfield had a hole the size of a hand before this.
 */
function sunbursts(g) {
  burst(g, 233, 258, 44, 178, 22, C.cyan, 0.16);
  burst(g, 245, 452, 22, 116, 18, C.magenta, 0.14);
}

function burst(g, cx, cy, r0, r1, wedges, color, a) {
  for (let i = 0; i < wedges; i += 2) {
    const a0 = (i / wedges) * PI * 2;
    const a1 = ((i + 1) / wedges) * PI * 2;
    g.beginPath();
    g.arc(cx, cy, r1, a0, a1);
    g.arc(cx, cy, r0, a1, a0, true);
    g.closePath();
    const grad = g.createRadialGradient(cx, cy, r0, cx, cy, r1);
    grad.addColorStop(0, alpha(color, a * 1.7));
    grad.addColorStop(1, alpha(color, 0));
    g.fillStyle = grad;
    g.fill();
  }
}

/** Printed ribbons round the dome — the colour band the eye follows up. */
function ribbons(g) {
  const bands = [
    [240, C.red, 0.5, 7],
    [231, C.orange, 0.42, 6],
    [223, C.yellow, 0.34, 5],
    [200, C.blue, 0.3, 8],
    [190, C.purple, 0.26, 6],
  ];
  for (const [r, color, a, w] of bands) {
    g.beginPath();
    g.arc(262, 252, r, PI * 1.02, PI * 1.98);
    g.strokeStyle = alpha(color, a);
    g.lineWidth = w;
    g.stroke();
  }
}

function starfield(g) {
  const rand = rng(20260822);
  for (let i = 0; i < 260; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const s = rand();
    g.fillStyle = alpha(s > 0.85 ? C.cyan : '#ffffff', 0.1 + s * 0.5);
    const r = s > 0.93 ? 1.6 : 0.9;
    g.fillRect(x, y, r, r);
  }
}

/**
 * The cracked-ice look the original printed under its whole upper playfield.
 * Deterministic on purpose: a resize repaints this texture, and a fresh set of
 * cracks each time reads as the table glitching rather than as decoration.
 */
function cracks(g) {
  const rand = rng(7);
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    let x = 40 + rand() * (W - 80);
    let y = 40 + rand() * (H - 160);
    let a = rand() * PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    const steps = 3 + Math.floor(rand() * 4);
    for (let k = 0; k < steps; k++) {
      a += (rand() - 0.5) * 1.5;
      const len = 10 + rand() * 34;
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      g.lineTo(x, y);
    }
    g.strokeStyle = alpha(rand() > 0.5 ? C.cyan : C.purple, 0.07 + rand() * 0.1);
    g.lineWidth = 0.7 + rand() * 1.2;
    g.stroke();
  }
}

// ---------------------------------------------------------------- printed art

function paintedRegions(g) {
  // Big blocks of printed colour. A playfield is silkscreened, not airbrushed:
  // it is the flat shapes that give it its identity from across a room, and
  // the gradients only make them look lit.
  paintedField(g, [[16, 250], [96, 250], [128, 430], [96, 560], [22, 560]], C.purple, 0.5);
  paintedField(g, [[398, 250], [472, 250], [472, 560], [400, 560], [372, 420]], C.teal, 0.4);
  paintedField(g, [[150, 596], [340, 596], [300, 714], [190, 714]], C.magenta, 0.46);
  paintedField(g, [[120, 30], [372, 30], [372, 148], [120, 148]], C.blue, 0.34);
  paintedField(g, [[28, 566], [128, 566], [128, 700], [40, 700]], C.red, 0.3);
  paintedField(g, [[400, 566], [468, 566], [462, 700], [400, 700]], C.red, 0.3);
  // the plate the drop targets stand on, so they read as a bank and not as
  // three sticks floating over the felt
  paintedField(g, [[28, 306], [66, 296], [122, 430], [84, 446]], C.red, 0.42);

  // the shooting lane, in the warm brown the original used for its wood
  const lane = g.createLinearGradient(478, 0, 508, 0);
  lane.addColorStop(0, '#33241a');
  lane.addColorStop(0.45, '#6a4a2e');
  lane.addColorStop(1, '#281d14');
  g.fillStyle = lane;
  g.fillRect(478, 288, 30, 414);
  g.strokeStyle = alpha(C.orange, 0.7);
  g.lineWidth = 1.4;
  g.strokeRect(478.5, 288.5, 29, 413);
  for (let y = 306; y < 700; y += 24) {
    g.fillStyle = alpha('#000000', 0.26);
    g.fillRect(480, y, 26, 2);
  }

  // the big circle-A branded across the lower playfield
  g.globalAlpha = 0.16;
  circleA(g, 245, 452, 150, C.bright, 14);
  g.globalAlpha = 1;

  // rays out of the bumper cluster
  g.strokeStyle = alpha(C.cyan, 0.09);
  g.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * PI * 2;
    g.beginPath();
    g.moveTo(233 + Math.cos(a) * 66, 263 + Math.sin(a) * 66);
    g.lineTo(233 + Math.cos(a) * 148, 263 + Math.sin(a) * 148);
    g.stroke();
  }

  // painted apron under the flippers
  const apron = g.createLinearGradient(0, 640, 0, 720);
  apron.addColorStop(0, alpha(C.purple, 0));
  apron.addColorStop(1, alpha(C.purple, 0.3));
  g.fillStyle = apron;
  g.beginPath();
  g.moveTo(120, 648);
  g.lineTo(370, 648);
  g.lineTo(300, 720);
  g.lineTo(190, 720);
  g.closePath();
  g.fill();

  // outlane and inlane floor tints, so the funnel reads before you drain in it
  for (const [x1, x2, color] of [[18, 84, C.red], [92, 128, C.green], [364, 400, C.green], [408, 470, C.red]]) {
    const t = g.createLinearGradient(0, 540, 0, 660);
    t.addColorStop(0, alpha(color, 0));
    t.addColorStop(1, alpha(color, 0.42));
    g.fillStyle = t;
    g.fillRect(x1, 540, x2 - x1, 120);
  }
}

/** A silkscreened block: flat colour, a lit edge, and a soft inner shade. */
function paintedField(g, pts, color, a) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  const ys = pts.map((p) => p[1]);
  const grad = g.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
  grad.addColorStop(0, alpha(color, a));
  grad.addColorStop(1, alpha(color, a * 0.35));
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = alpha(color, Math.min(1, a * 2.2));
  g.lineWidth = 1.6;
  g.stroke();
}

/**
 * The ramps. A real pinball ramp is a wireform — two rails and a ladder of
 * rungs between them — and drawing it that way, rather than as a painted
 * stripe, is most of what makes a playfield read as three-dimensional even
 * before the perspective goes on.
 */
function ramps(g) {
  // The left ramp threads between the drop-target bank and the bumpers. Its
  // first route ran straight over the targets — a ramp and the shot it is
  // supposed to be an alternative to cannot occupy the same strip of felt.
  wireform(
    g,
    bezier({ x: 120, y: 528 }, { x: 134, y: 452 }, { x: 114, y: 344 }, { x: 134, y: 266 }),
    12,
    // orange, not the purple it started as: a purple ramp on a purple felt is
    // a shape you have to go looking for, and a ramp is a thing you aim at
    C.orange
  );
  wireform(
    g,
    bezier({ x: 404, y: 238 }, { x: 464, y: 312 }, { x: 462, y: 442 }, { x: 408, y: 520 }),
    12,
    C.teal
  );
  // a short return lane feeding the right inlane
  wireform(g, bezier({ x: 408, y: 520 }, { x: 398, y: 548 }, { x: 388, y: 566 }, { x: 374, y: 584 }), 7, C.teal);
}

function wireform(g, path, halfWidth, color) {
  const pts = samplePath(path, 40);
  const side = (sign) => {
    g.beginPath();
    pts.forEach((p, i) => {
      const x = p.x + p.nx * halfWidth * sign;
      const y = p.y + p.ny * halfWidth * sign;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
  };

  // the floor of the ramp, shaded so it looks like it climbs
  g.beginPath();
  pts.forEach((p, i) => {
    const x = p.x + p.nx * halfWidth;
    const y = p.y + p.ny * halfWidth;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  });
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    g.lineTo(p.x - p.nx * halfWidth, p.y - p.ny * halfWidth);
  }
  g.closePath();
  const shade = g.createLinearGradient(0, 240, 0, 540);
  shade.addColorStop(0, alpha(color, 0.42));
  shade.addColorStop(1, alpha(color, 0.14));
  g.fillStyle = shade;
  g.fill();

  // rungs
  g.strokeStyle = alpha('#0b0b12', 0.55);
  g.lineWidth = 2;
  for (let i = 2; i < pts.length - 1; i += 3) {
    const p = pts[i];
    g.beginPath();
    g.moveTo(p.x + p.nx * halfWidth, p.y + p.ny * halfWidth);
    g.lineTo(p.x - p.nx * halfWidth, p.y - p.ny * halfWidth);
    g.stroke();
  }

  // the two rails, each a dark line with a lit spine on top
  for (const sign of [1, -1]) {
    side(sign);
    g.strokeStyle = '#0a0a11';
    g.lineWidth = 5;
    g.stroke();
    side(sign);
    g.strokeStyle = mix(color, '#ffffff', 0.35);
    g.lineWidth = 2;
    g.stroke();
  }
}

/**
 * The metal guide rails. Three strokes each: a dark bed, a metallic body, and
 * a thin hot spine. That stack is the cheapest convincing chrome there is —
 * a single flat stroke always reads as a drawn line, never as a bar.
 */
function rails(g) {
  const arcs = [
    [262, 252, 248, PI, PI * 2, 8],
    [262, 252, 214, PI * 1.06, PI * 1.94, 5],
    [262, 252, 168, PI * 1.14, PI * 1.86, 4],
  ];
  for (const [cx, cy, r, a0, a1, w] of arcs) {
    metalArc(g, cx, cy, r, a0, a1, w);
  }

  // lane guides under the dome
  for (const [x, y0, y1] of [[136, 56, 140], [208, 30, 140], [280, 30, 140], [352, 56, 140]]) {
    metalLine(g, x, y0, x, y1, 5);
  }

  // the shell the ball runs inside
  metalLine(g, 14, 252, 14, 712, 6);
  metalLine(g, 510, 252, 510, 700, 6);
  metalLine(g, 476, 300, 476, 712, 6);
  metalLine(g, 476, 700, 510, 700, 6);

  // the drop-target back wall
  metalLine(g, 44, 310, 102, 442, 6);

  // inlane dividers and the shoes
  metalLine(g, 88, 545, 118, 640, 5);
  metalLine(g, 118, 640, 154, 662, 5);
  metalLine(g, 400, 545, 370, 640, 5);
  metalLine(g, 370, 640, 334, 662, 5);

  // the one-way gate into the lane
  metalLine(g, 470, 298, 508, 278, 4);
}

function metalArc(g, cx, cy, r, a0, a1, w) {
  const pass = [
    [w + 2.5, '#08080e'],
    [w, null], // gradient body
    [Math.max(1, w * 0.22), alpha('#dfe6ff', 0.85)],
    [Math.max(1, w * 0.5), alpha(C.red, 0.5)],
  ];
  for (const [lw, color] of pass) {
    g.beginPath();
    g.arc(cx, cy, color === alpha(C.red, 0.5) ? r + w * 0.55 : r, a0, a1);
    g.lineWidth = lw;
    if (color) g.strokeStyle = color;
    else {
      const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      gr.addColorStop(0, '#3b4368');
      gr.addColorStop(0.45, '#6d78a8');
      gr.addColorStop(0.55, '#4a5378');
      gr.addColorStop(1, '#2b3150');
      g.strokeStyle = gr;
    }
    g.stroke();
  }
}

function metalLine(g, x1, y1, x2, y2, w) {
  g.lineCap = 'round';
  const body = g.createLinearGradient(x1, y1, x2 + 12, y2 + 12);
  body.addColorStop(0, '#39406a');
  body.addColorStop(0.4, '#6a75a6');
  body.addColorStop(1, '#2a3050');
  for (const [lw, color] of [[w + 2.5, '#08080e'], [w, body], [Math.max(1, w * 0.24), alpha('#e6ecff', 0.75)]]) {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.lineWidth = lw;
    g.strokeStyle = color;
    g.stroke();
  }
}

/** Arrows, chevrons, standup targets and the spinner — the table's signage. */
function arrowsAndSigns(g) {
  // shot arrows at every ramp mouth
  for (const [x, y, a, color] of [
    [126, 548, -1.42, C.magenta],
    [398, 230, 1.1, C.teal],
    [246, 152, -PI / 2, C.yellow],
    [420, 394, -1.75, C.green],
  ]) {
    arrow(g, x, y, a, 15, color);
  }

  // inlane chevrons
  for (const [cx, dir] of [[123, 1], [365, -1]]) {
    g.strokeStyle = alpha(C.green, 0.65);
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(cx - 7 * dir, 560 + i * 26);
      g.lineTo(cx, 572 + i * 26);
      g.lineTo(cx + 7 * dir, 560 + i * 26);
      g.stroke();
    }
  }
  // outlane warnings
  for (const cx of [46, 444]) {
    g.strokeStyle = alpha(C.red, 0.6);
    for (let i = 0; i < 2; i++) {
      g.beginPath();
      g.moveTo(cx - 7, 596 + i * 26);
      g.lineTo(cx, 608 + i * 26);
      g.lineTo(cx + 7, 596 + i * 26);
      g.stroke();
    }
  }

  // standup targets on the upper right
  for (const s of STANDUPS) {
    g.save();
    g.translate(s.x, s.y);
    g.rotate(s.a);
    g.fillStyle = '#1b1f36';
    roundRect(g, -13, -5, 26, 10, 2);
    g.fill();
    g.strokeStyle = s.color;
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = alpha(s.color, 0.55);
    g.fillRect(-9, -2, 18, 4);
    g.restore();
  }

  // a spinner hanging in the left orbit
  g.save();
  g.translate(120, 205);
  g.fillStyle = '#12162a';
  roundRect(g, -14, -18, 28, 36, 3);
  g.fill();
  g.strokeStyle = C.bright;
  g.lineWidth = 1.6;
  g.stroke();
  g.strokeStyle = alpha(C.cyan, 0.8);
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.moveTo(-11, i * 6.5);
    g.lineTo(11, i * 6.5);
    g.stroke();
  }
  g.restore();

  // the bonus ladder rungs, painted dark
  for (const l of LADDER) {
    g.fillStyle = '#141829';
    roundRect(g, l.x - l.w / 2, l.y - l.h / 2, l.w, l.h, 3);
    g.fill();
    g.strokeStyle = alpha(l.color, 0.4);
    g.lineWidth = 1.2;
    g.stroke();
  }
}

function arrow(g, x, y, a, size, color) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.beginPath();
  g.moveTo(size, 0);
  g.lineTo(-size * 0.6, size * 0.72);
  g.lineTo(-size * 0.2, 0);
  g.lineTo(-size * 0.6, -size * 0.72);
  g.closePath();
  g.fillStyle = alpha(color, 0.34);
  g.fill();
  g.strokeStyle = alpha(color, 0.9);
  g.lineWidth = 1.6;
  g.stroke();
  g.restore();
}

/** The rosette's printed face — the ring the lamps sit in. */
function rosetteFace(g) {
  const { x, y, r } = ROSETTE;
  g.beginPath();
  g.arc(x, y, r + 15, 0, PI * 2);
  g.fillStyle = alpha('#0b0d18', 0.65);
  g.fill();
  g.strokeStyle = alpha(C.blue, 0.5);
  g.lineWidth = 2;
  g.stroke();
  g.beginPath();
  g.arc(x, y, r - 15, 0, PI * 2);
  g.strokeStyle = alpha(C.purple, 0.4);
  g.lineWidth = 1.4;
  g.stroke();
  circleA(g, x, y, 20, alpha(C.bright, 0.5), 2.4);
  // spokes
  g.strokeStyle = alpha(C.blue, 0.16);
  g.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * PI * 2;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * 26, y + Math.sin(a) * 26);
    g.lineTo(x + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6));
    g.stroke();
  }
}

/** The unlit face of each lane insert: a milky window with a letter in it. */
function insertFaces(g) {
  for (const ins of INSERTS) {
    g.fillStyle = '#171b2e';
    roundRect(g, ins.x - ins.w / 2, ins.y - ins.h / 2, ins.w, ins.h, 3);
    g.fill();
    g.strokeStyle = alpha(ins.color, 0.45);
    g.lineWidth = 1.4;
    g.stroke();
    g.fillStyle = alpha(ins.color, 0.4);
    g.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ins.label, ins.x, ins.y + 0.5);
  }
  g.textBaseline = 'alphabetic';
}

/**
 * Every lamp's socket.
 *
 * These were painted the same near-black as the shadow around them, and two
 * hundred dark dots over a playfield read as damage, not as lamps. A real
 * unlit lamp still has a coloured plastic cap over it and still catches the
 * light from its neighbours — so the socket is tinted with the colour it will
 * burn, and the string is legible as a string even with nothing on it.
 */
function lampSockets(g) {
  const all = [
    ...STRINGS.flatMap((s) => s.lamps.map((l) => ({ ...l, r: s.r, color: s.color }))),
    ...ROSETTE.lamps.map((l, i) => ({ ...l, r: 5, color: ROSETTE.colors[i % ROSETTE.colors.length] })),
  ];
  for (const l of all) {
    g.beginPath();
    g.arc(l.x, l.y, l.r + 1.8, 0, PI * 2);
    g.fillStyle = 'rgba(6,7,14,0.65)';
    g.fill();
    const cap = g.createRadialGradient(l.x - l.r * 0.3, l.y - l.r * 0.3, 0, l.x, l.y, l.r);
    cap.addColorStop(0, alpha(l.color, 0.85));
    cap.addColorStop(1, alpha(l.color, 0.34));
    g.beginPath();
    g.arc(l.x, l.y, l.r, 0, PI * 2);
    g.fillStyle = cap;
    g.fill();
  }
}
