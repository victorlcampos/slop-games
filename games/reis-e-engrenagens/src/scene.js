// The sky, the far hills, the dirt itself and everything growing out of it.
//
// The field is nearly twice as wide as the screen, so all of this is drawn for
// the slice the camera is looking at and no more. The three ridgelines are
// **functions of x** rather than stored point lists, which is what lets them
// scroll at three different speeds without anybody having to decide in advance
// how much hill to generate: parallax means the far ridge moves a sixth as fast
// as the ground, so it has to be six times as long, and a formula is six times
// as long for free.

import { COL_W, H, NCOL, W, clamp, makeRng } from './config.js';
import { FLOOR_Y } from './terrain.js';
import { INK, blob, ink, rr } from './art.js';
import { CASTLE_X, CELL, COLS } from './config.js';

const TAU = Math.PI * 2;

/**
 * The valley takes sides. Walk toward the machines' castle and the scenery
 * industrialises — gears, vents, chimneys on the ridgelines, smog in the
 * clouds, steel in the dirt; walk the other way and it is pennants, pillars
 * and trees. Which end is which depends on who is defending which castle, so
 * the blend is a function, not a constant.
 *
 * 0 is the deepest kingdom end of the field, 1 the deepest machine end.
 */
export function towardMachines(x, machinesSide = 'enemy') {
  const t = clamp(x / W, 0, 1);
  return machinesSide === 'player' ? 1 - t : t;
}

/** What grows near each crown, on top of whatever the terrain itself grows. */
export const MACHINE_PROPS = ['gear', 'antenna', 'vent', 'pipe'];
export const MEDIEVAL_PROPS = ['pennant', 'pillar'];

export function createScene(level, terrain, seed = 1, opts = {}) {
  const spec = terrain.spec;
  const rng = makeRng(seed * 2654435761 + 97);
  const machinesSide = opts.machinesSide || 'enemy';
  const toward = (x) => towardMachines(x, machinesSide);

  /** A ridgeline you can evaluate anywhere: three sines and a phase. */
  const ridgeOf = (base, amp, len, phase) => (x) =>
    base -
    Math.sin(x / len + phase) * amp -
    Math.sin(x / (len * 0.41) + phase * 2.3) * amp * 0.42 -
    Math.sin(x / (len * 0.17) + phase * 5.1) * amp * 0.16;

  const ridges = [
    { at: ridgeOf(300, 62, 420, rng() * 6), depth: 0.16, fill: spec.hills[0], trees: 0 },
    { at: ridgeOf(400, 52, 300, rng() * 6), depth: 0.3, fill: spec.hills[1], trees: 0.4 },
    { at: ridgeOf(470, 38, 210, rng() * 6), depth: 0.48, fill: spec.hills[2], trees: 0.8 },
  ];

  const clouds = [];
  for (let i = 0; i < 14; i++) {
    clouds.push({ x: rng() * W * 1.4, y: 40 + rng() * 210, s: 0.55 + rng() * 1.15, v: 3 + rng() * 8 });
  }

  const flakes = [];
  const weather = spec.id === 'snow' ? 'snow' : spec.ember ? 'ember' : null;
  if (weather) {
    for (let i = 0; i < 90; i++) {
      flakes.push({ x: rng() * W, y: rng() * H, v: 14 + rng() * 46, d: rng() * 6, s: 1 + rng() * 2.4 });
    }
  }

  // Scenery on the ground itself, placed once and then left alone. Each prop
  // remembers the height of the ground it was planted on, so that when a shell
  // takes that ground away the tree goes with it instead of hovering.
  //
  // What gets planted depends on where: the terrain's own flora everywhere,
  // shading into machinery toward the machines' gate (t², so the middle of the
  // valley stays mostly wild) and into pennants and old stonework toward the
  // kingdom's. Walking the field is walking from one civilisation to the other.
  const props = [];
  const kinds = spec.props || ['rock'];
  const kindAt = (x) => {
    const t = toward(x);
    const u = 1 - t;
    const roll = rng();
    if (roll < t * t * 0.9) return MACHINE_PROPS[Math.floor(rng() * MACHINE_PROPS.length)];
    if (roll > 1 - u * u * 0.5) return MEDIEVAL_PROPS[Math.floor(rng() * MEDIEVAL_PROPS.length)];
    return kinds[Math.floor(rng() * kinds.length)];
  };
  const plot = (x) =>
    (x > CASTLE_X.player - 70 && x < CASTLE_X.player + COLS * CELL + 70) ||
    (x > CASTLE_X.enemy - 70 && x < CASTLE_X.enemy + COLS * CELL + 70);
  for (let x = 60; x < W - 60; x += 34 + rng() * 74) {
    if (plot(x)) continue;
    props.push({
      x,
      kind: kindAt(x),
      s: 0.85 + rng() * 0.85,
      flip: rng() < 0.5,
      tone: rng(),
      ground: terrain.yAt(x),
    });
  }

  let time = 0;

  return {
    spec,
    props,

    /** `wind` is the match's own number, so the sky agrees with the gauge. */
    update(h, wind = 0) {
      time += h;
      for (const c of clouds) {
        // clouds ride the wind at a fraction of its speed, on top of their own
        // drift — and with the wind changing sign every turn they wrap both ways
        c.x += (c.v + wind * 0.5) * h;
        if (c.x > W * 1.5) c.x = -200;
        if (c.x < -260) c.x = W * 1.5 - 40;
      }
      for (const f of flakes) {
        f.d += h;
        f.y += (weather === 'ember' ? -f.v : f.v) * h;
        f.x += (Math.sin(f.d) * 14 + wind * 1.1) * h;
        if (f.y > H + 10) f.y = -10;
        if (f.y < -10) f.y = H + 10;
      }
    },

    /** Everything behind the castles, at three different speeds. */
    drawSky(ctx, cam, viewW) {
      const g = ctx.createLinearGradient(0, cam.y, 0, cam.y + H);
      g.addColorStop(0, spec.sky[0]);
      g.addColorStop(1, spec.sky[1]);
      ctx.fillStyle = g;
      ctx.fillRect(cam.x - 40, cam.y - 600, viewW + 80, H + 1200);

      // the machine end of the sky wears a film of smog, the kingdom end a
      // warm haze — faint, but it is what tells you which way you are facing
      // before either castle is on screen
      const side = ctx.createLinearGradient(0, 0, W, 0);
      const kEnd = 'rgba(255,214,120,0.07)';
      const mEnd = 'rgba(88,94,110,0.20)';
      side.addColorStop(0, machinesSide === 'player' ? mEnd : kEnd);
      side.addColorStop(0.5, 'rgba(0,0,0,0)');
      side.addColorStop(1, machinesSide === 'player' ? kEnd : mEnd);
      ctx.fillStyle = side;
      ctx.fillRect(cam.x - 40, cam.y - 600, viewW + 80, H + 1200);

      sun(ctx, cam, viewW, spec);

      for (const c of clouds) {
        const x = c.x - cam.x * 0.08;
        if (x < cam.x - 260 || x > cam.x + viewW + 260) continue;
        cloud(ctx, x, c.y + cam.y * 0.25, c.s, spec, toward(x));
      }

      for (const r of ridges) {
        const shift = cam.x * (1 - r.depth);
        ctx.save();
        ctx.translate(-shift, cam.y * (1 - r.depth) * 0.5);
        band(ctx, r, cam.x + shift, viewW, spec, (x) => toward(x - shift));
        ctx.restore();
      }
    },

    /** The dirt, drawn from the live heightmap — craters and all. */
    drawGround(ctx, cam, viewW) {
      const h = terrain.h;
      const a = clamp(Math.floor((cam.x - 40) / COL_W), 0, NCOL - 1);
      const b = clamp(Math.ceil((cam.x + viewW + 40) / COL_W), 0, NCOL - 1);

      const surface = () => {
        ctx.beginPath();
        ctx.moveTo(a * COL_W, h[a]);
        for (let i = a; i <= b; i++) ctx.lineTo(i * COL_W, h[i]);
      };

      // the body
      surface();
      ctx.lineTo(b * COL_W, H + 400);
      ctx.lineTo(a * COL_W, H + 400);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 380, 0, H);
      g.addColorStop(0, spec.body);
      g.addColorStop(1, spec.deep);
      ctx.fillStyle = g;
      ctx.fill();

      // strata, so a deep crater shows it went through something
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 620; y < H + 100; y += 46) ctx.fillRect(cam.x - 40, y, viewW + 80, 16);
      ctx.fillStyle = spec.speck;
      ctx.globalAlpha = 0.35;
      for (let i = a; i <= b; i += 5) {
        const n = ((i * 9301 + 49297) % 233280) / 233280;
        ctx.beginPath();
        ctx.ellipse(i * COL_W + n * 6, h[i] + 30 + n * 70, 3 + n * 4, 2 + n * 3, n * 3, 0, TAU);
        ctx.fill();
      }
      ctx.restore();

      // the turf: a fat band along the surface, then lumps hanging into the dirt
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = spec.cap;
      ctx.lineWidth = 17;
      ctx.beginPath();
      ctx.moveTo(a * COL_W, h[a] + 7);
      for (let i = a; i <= b; i++) ctx.lineTo(i * COL_W, h[i] + 7);
      ctx.stroke();
      // and lobes of it hanging down into the dirt, which is what stops the turf
      // reading as a green rope laid along the ground
      ctx.fillStyle = spec.cap;
      for (let i = a + 2; i <= b; i += 5) {
        const n = ((i * 6151 + 13) % 977) / 977;
        if (h[i] > FLOOR_Y - 6) continue;
        ctx.beginPath();
        ctx.arc(i * COL_W, h[i] + 12 + n * 5, 6 + n * 8, 0, TAU);
        ctx.fill();
      }
      ctx.restore();

      // the dirt itself takes sides: steel-grey filings toward the machines'
      // gate, mossy loam toward the kingdom's — painted into the same body the
      // gradient above just filled, so a crater keeps the tint of its end
      ctx.save();
      surface();
      ctx.lineTo(b * COL_W, H + 400);
      ctx.lineTo(a * COL_W, H + 400);
      ctx.closePath();
      const tint = ctx.createLinearGradient(0, 0, W, 0);
      const loam = 'rgba(96,140,52,0.12)';
      const steel = 'rgba(104,114,134,0.22)';
      tint.addColorStop(0, machinesSide === 'player' ? steel : loam);
      tint.addColorStop(0.5, 'rgba(0,0,0,0)');
      tint.addColorStop(1, machinesSide === 'player' ? loam : steel);
      ctx.fillStyle = tint;
      ctx.fill();
      ctx.restore();

      // and the ink line that makes it an object rather than a colour
      ctx.save();
      ctx.lineJoin = 'round';
      surface();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.restore();

      // the floor of the world: nothing that gets down there is coming back
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(cam.x - 40, FLOOR_Y + 8, viewW + 80, H - FLOOR_Y);
    },

    /** Trees, rocks and whatever else this ground grows. */
    drawProps(ctx, cam, viewW) {
      for (const p of props) {
        if (p.x < cam.x - 60 || p.x > cam.x + viewW + 60) continue;
        const y = terrain.yAt(p.x);
        // blown away: the ground it was standing on is gone
        if (y > p.ground + 12) continue;
        ctx.save();
        ctx.translate(p.x, y + 4);
        ctx.scale(p.flip ? -p.s : p.s, p.s);
        drawProp(ctx, p.kind, p.tone, time);
        ctx.restore();
      }
    },

    /** Snow or embers, in front of everything. */
    drawWeather(ctx, cam, viewW) {
      if (!weather) return;
      ctx.save();
      ctx.fillStyle = weather === 'ember' ? '#ff9a4a' : '#ffffff';
      ctx.globalAlpha = weather === 'ember' ? 0.8 : 0.85;
      for (const f of flakes) {
        const x = f.x - cam.x * 0.6;
        const wrapped = ((x - cam.x) % (W + 400) + (W + 400)) % (W + 400) + cam.x - 200;
        if (wrapped < cam.x - 20 || wrapped > cam.x + viewW + 20) continue;
        ctx.beginPath();
        ctx.arc(wrapped, f.y + cam.y, f.s, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    },
  };
}

function sun(ctx, cam, viewW, spec) {
  const x = cam.x + viewW * 0.76;
  const y = cam.y + 118;
  ctx.save();
  ctx.globalAlpha = spec.ember ? 0.5 : 0.28;
  ctx.fillStyle = spec.ember ? '#ff7a3a' : '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 96, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(x, y, 64, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = spec.ember ? '#ffb06a' : '#fffbe8';
  ctx.beginPath();
  ctx.arc(x, y, 42, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * Overlapping circles with one outline round the lot, not five outlined blobs.
 * `smog` is how far into machine country this cloud has drifted: white weather
 * on the kingdom end, mill-smoke grey over the machines.
 */
function cloud(ctx, x, y, s, spec, smog = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = spec.ember ? 0.55 : 0.95;
  ctx.beginPath();
  for (const [dx, dy, r] of [[-30, 6, 19], [-4, -4, 27], [26, 8, 18], [8, 12, 17], [-16, 12, 15]]) {
    ctx.moveTo(dx + r, dy);
    ctx.arc(dx, dy, r, 0, TAU);
  }
  const grey = Math.round(255 - 88 * smog * smog);
  ctx.fillStyle = spec.ember ? '#5a3a3a' : `rgb(${grey},${grey + 1},${grey + 4})`;
  ctx.fill();
  ctx.restore();
}

function band(ctx, r, left, viewW, spec, toward = () => 0) {
  ctx.beginPath();
  ctx.moveTo(left - 80, H + 200);
  for (let x = left - 80; x <= left + viewW + 80; x += 22) ctx.lineTo(x, r.at(x));
  ctx.lineTo(left + viewW + 80, H + 200);
  ctx.closePath();
  ctx.fillStyle = r.fill;
  ctx.fill();

  if (!r.trees) return;
  // A treeline on the near ridges, which is what stops them reading as paper —
  // and the treeline is where the transformation reads from furthest away:
  // slot by slot, firs give way to mill chimneys as the ridge runs toward the
  // machines' end of the valley.
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = spec.hills[2];
  for (let x = Math.floor((left - 80) / 46) * 46; x <= left + viewW + 80; x += 46) {
    const y = r.at(x) + 6;
    const t = toward(x);
    // deterministic per slot, so a chimney does not flicker back into a tree
    const slot = Math.abs(Math.sin(x * 0.618));
    if (slot < t * t) {
      const h = 15 * r.trees + slot * 14;
      ctx.fillRect(x - 3.5, y - h, 7, h + 24);
      ctx.fillRect(x - 6, y - h - 4, 12, 5);
    } else {
      ctx.beginPath();
      ctx.moveTo(x - 9, y + 22);
      ctx.lineTo(x, y - 14 * r.trees);
      ctx.lineTo(x + 9, y + 22);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

// -------------------------------------------------------------------- props

function drawProp(ctx, kind, tone, time) {
  switch (kind) {
    case 'tree':
    case 'pine':
    case 'deadtree':
      return tree(ctx, kind, tone, time);
    case 'bush':
    case 'cactus':
      return bush(ctx, kind, tone);
    case 'flower':
      return flower(ctx, tone);
    case 'boulder':
    case 'rock':
      return rock(ctx, kind === 'boulder' ? 1.6 : 1, tone);
    case 'pillar':
      return pillar(ctx, tone);
    case 'pennant':
      return pennant(ctx, tone, time);
    case 'skull':
      return skull(ctx);
    case 'icicle':
      return icicle(ctx, tone);
    case 'gear':
      return gear(ctx, tone, time);
    case 'antenna':
      return antenna(ctx, tone);
    case 'vent':
      return vent(ctx, tone, time);
    default:
      return pipe(ctx, tone);
  }
}

function tree(ctx, kind, tone, time) {
  const sway = Math.sin(time * 1.1 + tone * 6) * 0.03;
  ctx.rotate(sway);
  rr(ctx, -4, -34, 8, 36, 3);
  ink(ctx, '#7a4d29', 2.5);
  if (kind === 'deadtree') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(-14, -40);
    ctx.moveTo(0, -32);
    ctx.lineTo(13, -44);
    ctx.stroke();
    return;
  }
  if (kind === 'pine') {
    blob(ctx, () => {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const y = -30 - i * 13;
        const w = 24 - i * 5;
        ctx.moveTo(-w, y);
        ctx.lineTo(0, y - 22);
        ctx.lineTo(w, y);
        ctx.closePath();
      }
    }, '#2f7a4a', 2.5);
    return;
  }
  blob(ctx, () => {
    ctx.beginPath();
    for (const [dx, dy, r] of [[-14, -44, 15], [12, -44, 14], [0, -56, 17], [0, -40, 16]]) {
      ctx.moveTo(dx + r, dy);
      ctx.arc(dx, dy, r, 0, TAU);
    }
  }, tone > 0.5 ? '#4aa63c' : '#3d9433', 3);
}

function bush(ctx, kind, tone) {
  if (kind === 'cactus') {
    rr(ctx, -6, -34, 12, 36, 6);
    ink(ctx, '#4c9a52', 2.5);
    rr(ctx, -18, -26, 12, 8, 4);
    ink(ctx, '#4c9a52', 2.5);
    rr(ctx, -18, -30, 7, 14, 3.5);
    ink(ctx, '#4c9a52', 2.5);
    return;
  }
  blob(ctx, () => {
    ctx.beginPath();
    for (const [dx, dy, r] of [[-10, -8, 11], [10, -8, 10], [0, -16, 13]]) {
      ctx.moveTo(dx + r, dy);
      ctx.arc(dx, dy, r, 0, TAU);
    }
  }, tone > 0.5 ? '#46a03c' : '#357f2f', 2.5);
}

function flower(ctx, tone) {
  ctx.strokeStyle = '#3d9433';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -16);
  ctx.stroke();
  const colour = tone > 0.6 ? '#ff5f8a' : tone > 0.3 ? '#ffd646' : '#ffffff';
  blob(ctx, () => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      ctx.moveTo(Math.cos(a) * 5 + 4, -18 + Math.sin(a) * 5);
      ctx.arc(Math.cos(a) * 5, -18 + Math.sin(a) * 5, 4, 0, TAU);
    }
  }, colour, 1.6);
  ctx.beginPath();
  ctx.arc(0, -18, 3, 0, TAU);
  ink(ctx, '#ffe9a8', 1.4);
}

function rock(ctx, s, tone) {
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-1, -17);
  ctx.lineTo(9, -13);
  ctx.lineTo(14, 0);
  ctx.closePath();
  ink(ctx, tone > 0.5 ? '#9aa0a8' : '#7f858c', 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(-8, -11);
  ctx.lineTo(-1, -15);
  ctx.lineTo(2, -11);
  ctx.closePath();
  ctx.fill();
}

function pillar(ctx, tone) {
  rr(ctx, -10, -52, 20, 54, 3);
  ink(ctx, '#8e959f', 2.5);
  rr(ctx, -14, -58, 28, 9, 3);
  ink(ctx, '#a5acb6', 2.5);
  ctx.strokeStyle = 'rgba(40,44,52,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const dx of [-4, 0, 4]) {
    ctx.moveTo(dx, -48);
    ctx.lineTo(dx, -4);
  }
  ctx.stroke();
}

/** A wayside pennant: the kingdom's colours planted in its own half of the map. */
function pennant(ctx, tone, time) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -46);
  ctx.stroke();
  const wave = Math.sin(time * 3.1 + tone * 6) * 2.5;
  ctx.beginPath();
  ctx.moveTo(1, -46);
  ctx.lineTo(18 + wave, -40);
  ctx.lineTo(1, -34);
  ctx.closePath();
  ink(ctx, tone > 0.55 ? '#ffd646' : '#c0335a', 2.2);
  ctx.beginPath();
  ctx.arc(0, -48, 2.4, 0, TAU);
  ink(ctx, '#ffd646', 1.8);
}

function skull(ctx) {
  ctx.beginPath();
  ctx.ellipse(0, -9, 11, 9, 0, 0, TAU);
  ink(ctx, '#f0e8d4', 2.5);
  rr(ctx, -6, -3, 12, 6, 2);
  ink(ctx, '#f0e8d4', 2.5);
  ctx.fillStyle = INK;
  for (const dx of [-4.5, 4.5]) {
    ctx.beginPath();
    ctx.ellipse(dx, -10, 3, 3.6, 0, 0, TAU);
    ctx.fill();
  }
}

function icicle(ctx, tone) {
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(0, -34 - tone * 16);
  ctx.lineTo(8, 0);
  ctx.closePath();
  ink(ctx, '#c6e8fb', 2.5);
}

function gear(ctx, tone, time) {
  ctx.translate(0, -16);
  ctx.rotate(time * 0.35 + tone * 6);
  const R = 17;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const b = a + TAU / 16;
    ctx.lineTo(Math.cos(a) * R * 1.25, Math.sin(a) * R * 1.25);
    ctx.lineTo(Math.cos(b) * R * 1.25, Math.sin(b) * R * 1.25);
    ctx.lineTo(Math.cos(b + TAU / 32) * R, Math.sin(b + TAU / 32) * R);
    ctx.lineTo(Math.cos(a + TAU / 8 - TAU / 32) * R, Math.sin(a + TAU / 8 - TAU / 32) * R);
  }
  ctx.closePath();
  ink(ctx, tone > 0.5 ? '#8a6a4a' : '#6f594a', 2.5);
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, TAU);
  ink(ctx, '#4a3a30', 2);
}

function antenna(ctx, tone) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -46);
  ctx.stroke();
  ctx.strokeStyle = '#8a9aa8';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -50, 4, 0, TAU);
  ink(ctx, tone > 0.5 ? '#ff5f4a' : '#ffd646', 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-11, -30);
  ctx.lineTo(0, -38);
  ctx.lineTo(11, -30);
  ctx.stroke();
}

function vent(ctx, tone, time) {
  rr(ctx, -13, -18, 26, 20, 4);
  ink(ctx, '#4a3c3a', 2.5);
  rr(ctx, -8, -26, 16, 10, 3);
  ink(ctx, '#5e4a46', 2.5);
  const glow = 0.5 + Math.sin(time * 2.4 + tone * 6) * 0.4;
  ctx.fillStyle = `rgba(255,110,50,${glow})`;
  ctx.beginPath();
  ctx.ellipse(0, -26, 7, 3.4, 0, 0, TAU);
  ctx.fill();
}

function pipe(ctx, tone) {
  rr(ctx, -8, -40, 16, 42, 4);
  ink(ctx, '#7a6a5a', 2.5);
  rr(ctx, -12, -44, 24, 8, 3);
  ink(ctx, '#8e7a66', 2.5);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, -44, 8, 3, 0, 0, TAU);
  ctx.fill();
}
