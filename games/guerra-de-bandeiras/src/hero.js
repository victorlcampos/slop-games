// The two bodies you can be, drawn face on.
//
// Everywhere else in this game a soldier is fifteen pixels across and seen from
// almost directly above, which is the right drawing for reading a firefight and
// the wrong one for choosing a side: from up there both squads are a coloured
// disc with a gun sticking out. So the picker gets the only front view in the
// game, at twenty times the size, and it is allowed to have a face.
//
// **The personality is in the details that do nothing.** The trooper's helmet
// carries tally scratches and his scarf never stops moving; the sentinel's dome
// has been cracked and riveted back together and it wears a set of human tags on
// its belt. None of it is in the simulation — the two sides are balanced to a
// tenth of a degree — and that is the point: the difference the player is
// choosing between is a look and a story, so both have to be worth looking at.
//
// The drawing is done in a fixed 320x400 frame and scaled to whatever box it is
// given, so the same code paints a phone and a desktop with no second layout.

import { KIT, COLOURS } from './config.js';
import { INTRO } from './flow.js';

export const FRAME = { w: 320, h: 400 };

const GROUND = 344;          // where the plinth's top surface sits
const MID = 160;             // the frame's centre line

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const ease = (k) => 1 - (1 - k) * (1 - k);

// Where the flourish's three beats fall, as fractions of `INTRO`.
const DIP = 0.22;            // the wind-up, down and back
const STRIKE = 0.34;         // the one frame everything happens on
const RISE = 0.74;           // and the lift is done by here

/**
 * Everything moving about a hero, as numbers.
 *
 * Kept apart from the drawing because this is the half with rules in it — the
 * flash exists only inside its window, the lift only ever goes up, nothing is
 * ever NaN — and a test can read numbers where it cannot read a canvas.
 *
 * @param {string} team  'human' | 'alien'
 * @param {number} t     seconds since the screen opened
 * @param {number} k     0 while he is only standing there, 0..1 through the pick
 */
export function heroPose(team, t = 0, k = 0) {
  const p = clamp(k, 0, 1);
  const alien = team === 'alien';

  // the wind-up: a dip that is already over by the time the move happens
  const crouch = p > 0 && p < DIP ? Math.sin((p / DIP) * Math.PI) : 0;
  const struck = p >= STRIKE;
  const since = p - STRIKE;
  const flash = struck ? Math.max(0, 1 - since / 0.17) : 0;
  const rise = struck ? ease(clamp(since / (RISE - STRIKE), 0, 1)) : 0;
  const shock = struck ? clamp(since / (1 - STRIKE), 0, 1) : 0;
  // the sentinel spends the wind-up filling its cannon; the trooper spends it
  // reaching for the bolt
  const charge = p > 0 ? clamp(p / STRIKE, 0, 1) : 0;

  // A blink is four frames of nothing every few seconds, and it is the single
  // cheapest thing that stops a face reading as a mask.
  const period = alien ? 4.6 : 3.4;
  const phase = (t + (alien ? 2.1 : 0)) % period;
  const blink = phase < 0.13 ? Math.sin((phase / 0.13) * Math.PI) : 0;

  // and a fidget every five seconds or so, because a body that only breathes is
  // a body on a slab
  const fc = (t + (alien ? 3.3 : 0.8)) % 5.4;
  const fidget = fc < 0.42 ? Math.sin((fc / 0.42) * Math.PI) : 0;

  return {
    k: p,
    breath: Math.sin(t * 1.9),
    sway: Math.sin(t * 0.62),
    bob: Math.sin(t * 1.25),
    blink,
    fidget,
    crouch,
    charge,
    flash,
    rise,
    shock,
    struck,
    // what the whole figure does: down a little, then up and bigger
    lift: rise * 20 - crouch * 11,
    scale: 1 + rise * 0.13 - crouch * 0.05,
    glow: Math.max(flash * 0.95, rise * 0.42),
    done: p >= 1,
  };
}

/** The flourish, in seconds, for anything that needs to line a sound up with it. */
export const HERO_INTRO = INTRO;

/**
 * Paint a hero into a box.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} team
 * @param {number} w  box width in the context's own units
 * @param {number} h  box height
 * @param {object} pose  from `heroPose`
 * @param {object} [opts] `{ picked: boolean, dim: number }`
 */
export function drawHero(ctx, team, w, h, pose, opts = {}) {
  const kit = KIT[team];
  const s = Math.min(w / FRAME.w, h / FRAME.h);
  const dim = clamp(opts.dim || 0, 0, 1);

  ctx.save();
  ctx.translate((w - FRAME.w * s) / 2, (h - FRAME.h * s) / 2);
  ctx.scale(s, s);

  backdrop(ctx, kit, pose, opts.picked);
  banner(ctx, team, kit, pose);
  plinth(ctx, kit, pose);

  ctx.save();
  // the whole body rises and grows out of the plinth's centre, so the feet stay
  // planted on it instead of sliding off the front. The 1.12 is the figure
  // filling its card: drawn at 1 it sits in the middle of a lot of nothing.
  const grow = 1.12 * pose.scale;
  ctx.translate(MID, GROUND - pose.lift);
  ctx.scale(grow, grow);
  ctx.translate(-MID, -(GROUND));
  if (team === 'human') trooper(ctx, kit, pose);
  else sentinel(ctx, kit, pose);
  ctx.restore();

  shockwave(ctx, kit, pose);
  motes(ctx, kit, pose);

  if (dim > 0) {
    ctx.fillStyle = `rgba(5,7,11,${0.62 * dim})`;
    ctx.fillRect(0, 0, FRAME.w, FRAME.h);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ staging */

function backdrop(ctx, kit, pose, picked) {
  const g = ctx.createRadialGradient(MID, 210, 20, MID, 210, 210);
  const lit = 0.16 + pose.glow * 0.5 + (picked ? 0.08 : 0);
  g.addColorStop(0, tint(kit.tint, lit));
  g.addColorStop(1, 'rgba(5,7,11,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FRAME.w, FRAME.h);
}

/**
 * The squad's colours hanging behind him.
 *
 * A cloth is the one shape here that can move without a limb: the bottom edge is
 * a travelling sine and the shading follows the same wave, which is enough for a
 * still figure to sit in a scene that is awake.
 */
function banner(ctx, team, kit, pose) {
  const top = 30;
  const bot = 248;
  const halfW = 68;
  const wave = (y, phase) => Math.sin((y / 50) + phase) * (2 + (y - top) / 44);
  const phase = pose.breath * 0.5 + pose.sway * 1.6;

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(MID - halfW + wave(top, phase), top);
  for (let y = top; y <= bot; y += 12) ctx.lineTo(MID - halfW + wave(y, phase), y);
  // The swallowtail: two points and a notch, so the bottom edge is a shape and
  // not a hem. The points go out at nine tenths of the width on purpose — the
  // body covers the middle, and a tail cut inside its shoulders is a tail
  // nobody ever sees.
  ctx.lineTo(MID - halfW * 0.9 + wave(bot, phase), bot + 30);
  ctx.lineTo(MID + wave(bot, phase), bot - 10);
  ctx.lineTo(MID + halfW * 0.9 + wave(bot, phase), bot + 30);
  for (let y = bot; y >= top; y -= 12) ctx.lineTo(MID + halfW + wave(y, phase), y);
  ctx.closePath();
  ctx.fillStyle = shade(kit.base, 1.35);
  ctx.fill();

  ctx.clip();
  // two stripes of shade riding the same wave: cloth, not cardboard
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = i ? shade(kit.base, 2.15) : shade(kit.base, 0.8);
    ctx.beginPath();
    for (let y = top - 8; y <= bot + 34; y += 10) {
      ctx.lineTo(MID - halfW + 10 + i * 70 + wave(y, phase) * 1.35, y);
    }
    for (let y = bot + 34; y >= top - 8; y -= 10) {
      ctx.lineTo(MID - halfW + 34 + i * 70 + wave(y, phase) * 1.35, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // the emblem sits above the head, where nothing is standing in front of it —
  // behind the shoulders it is a shape you can see a third of
  ctx.translate(MID + wave(52, phase) * 1.1, 52);
  ctx.fillStyle = tint(kit.tint, 0.62 + pose.glow * 0.38);
  if (team === 'human') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 7 : 16;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    for (const [dx, dy, r] of [[0, -7, 7], [-9, 6, 5.5], [9, 6, 5.5]]) {
      ctx.beginPath();
      ctx.ellipse(dx, dy, r, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // and a ring behind the head, which is what turns a figure standing in front
  // of a cloth into a portrait
  ctx.save();
  ctx.strokeStyle = tint(kit.tint, 0.22 + pose.glow * 0.35);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(MID, 108, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function plinth(ctx, kit, pose) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(MID, GROUND - 2, 74 - pose.lift * 0.5, 17, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#161d27';
  ctx.beginPath();
  ctx.ellipse(MID, GROUND + 12, 86, 21, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222c38';
  ctx.beginPath();
  ctx.ellipse(MID, GROUND + 4, 86, 21, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = tint(kit.tint, 0.5 + pose.glow * 0.5);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(MID, GROUND + 4, 78, 18, 0, 0, Math.PI * 2);
  ctx.stroke();

  // four lamps sunk into the rim, so the plinth reads as lit rather than painted
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * 0.25 + (i * Math.PI) / 2;
    ctx.fillStyle = tint(kit.tint, 0.75 + pose.glow * 0.25);
    ctx.beginPath();
    ctx.ellipse(MID + Math.cos(a) * 62, GROUND + 4 + Math.sin(a) * 14, 5, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The ring that leaves the plinth when he commits. */
function shockwave(ctx, kit, pose) {
  if (!pose.struck) return;
  ctx.save();
  for (const [delay, width] of [[0, 4], [0.16, 2]]) {
    const k = clamp((pose.shock - delay) / (1 - delay), 0, 1);
    if (k <= 0) continue;
    ctx.globalAlpha = (1 - k) * 0.75;
    ctx.strokeStyle = tint(kit.tint, 1);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.ellipse(MID, GROUND + 4, 40 + k * 190, 9 + k * 44, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Dust hanging in the light — and thrown upward the moment he moves. */
function motes(ctx, kit, pose) {
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const seed = i * 2.399;
    const drift = (pose.breath + pose.sway * 2 + i) * 0.6;
    const x = MID + Math.sin(seed * 3.1) * 108;
    const base = 90 + ((seed * 47 + drift * 9) % 250);
    const y = GROUND - (base % 250) - pose.shock * (i % 5) * 26;
    ctx.globalAlpha = 0.1 + 0.22 * Math.abs(Math.sin(seed + drift * 0.4)) + pose.flash * 0.3;
    ctx.fillStyle = i % 3 ? COLOURS.steel : kit.tint;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
}

/* ----------------------------------------------------------------- the human */

/**
 * A trooper, front on: boots apart, rifle across the chest, and a face under the
 * helmet that is enjoying this more than it should be.
 */
function trooper(ctx, kit, pose) {
  const br = pose.breath;
  const lean = pose.sway * 2.2;
  const hip = GROUND - 100;
  const chest = GROUND - 166;

  ctx.save();
  ctx.translate(lean * 0.4, 0);

  // boots and legs, planted wide — the stance is most of what says "infantry"
  for (const side of [-1, 1]) {
    const x = MID + side * 21;
    ctx.fillStyle = kit.legs;
    ctx.beginPath();
    ctx.moveTo(x - 13, hip - 4);
    ctx.lineTo(x + 13, hip - 4);
    ctx.lineTo(x + 15 * side * 0.2 + 11, GROUND - 22);
    ctx.lineTo(x - 11, GROUND - 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(kit.legs, 1.5);
    ctx.fillRect(x - 12, hip + 26, 24, 7);              // the knee pad
    ctx.fillStyle = COLOURS.ink;
    ctx.beginPath();
    ctx.moveTo(x - 13, GROUND - 24);
    ctx.lineTo(x + 13, GROUND - 24);
    ctx.lineTo(x + side * 6 + 15, GROUND - 3);
    ctx.lineTo(x - 15, GROUND - 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(COLOURS.ink, 2.6);
    ctx.fillRect(x - 13, GROUND - 8, 28, 4);
  }

  // the coat: a wedge, wide at the shoulders, because that is the whole of a
  // soldier's silhouette from the front
  const shoulder = 41 + br * 0.9;
  ctx.fillStyle = kit.coat;
  ctx.beginPath();
  ctx.moveTo(MID - shoulder, chest + 8);
  ctx.quadraticCurveTo(MID - shoulder - 3, chest - 8, MID - shoulder + 14, chest - 12);
  ctx.lineTo(MID + shoulder - 14, chest - 12);
  ctx.quadraticCurveTo(MID + shoulder + 3, chest - 8, MID + shoulder, chest + 8);
  ctx.lineTo(MID + 32, hip + 6);
  ctx.lineTo(MID - 32, hip + 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = shade(kit.coat, 0.72);
  ctx.beginPath();                                       // the vest, front panel
  ctx.moveTo(MID - 24, chest - 6);
  ctx.lineTo(MID + 24, chest - 6);
  ctx.lineTo(MID + 20, hip - 6);
  ctx.lineTo(MID - 20, hip - 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLOURS.ink;
  for (let i = 0; i < 3; i++) ctx.fillRect(MID - 18, chest + 4 + i * 15, 36, 9);   // pouches

  // the bandolier, and the tags that swing on it
  ctx.strokeStyle = kit.trim;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(MID - 30, chest - 10);
  ctx.lineTo(MID + 22, hip - 2);
  ctx.stroke();
  ctx.fillStyle = COLOURS.steel;
  const swing = br * 2.4 + pose.rise * 6;
  ctx.fillRect(MID - 6 + swing, chest + 26, 5, 11);
  ctx.fillRect(MID + 1 + swing * 0.8, chest + 30, 5, 11);

  // the pauldron on his right, in the squad's colour, with the stencil on it
  ctx.fillStyle = kit.tint;
  ctx.beginPath();
  ctx.ellipse(MID - shoulder + 8, chest - 2, 17, 15, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOURS.ink;
  ctx.fillRect(MID - shoulder + 2, chest - 8, 4, 12);
  ctx.fillRect(MID - shoulder + 9, chest - 8, 4, 12);

  arms(ctx, kit, pose, chest);
  head(ctx, kit, pose, chest, lean);
  ctx.restore();
}

/**
 * Arms and rifle, in one piece: the gun is what the hands are for, so where it
 * goes decides where they go rather than the other way round.
 *
 * At rest it lies across the chest. Through the pick he racks the bolt — the
 * right hand snaps back and forward on the strike — and brings it up to the
 * shoulder, muzzle first.
 */
function arms(ctx, kit, pose, chest) {
  const raise = pose.rise;
  const rack = pose.struck ? Math.max(0, 1 - (pose.k - STRIKE) / 0.13) : pose.charge * 0.35;
  const angle = -0.4 - raise * 0.32;
  const gx = MID + 4 + raise * 6;
  const gy = chest + 30 - raise * 22;

  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(angle);

  // The rifle: a body, a magazine, a stock and a muzzle — the same silhouette
  // the match draws from above, seen from the side. It is gunmetal rather than
  // the ink the field uses, because ink on a dark coat is one shape.
  ctx.fillStyle = '#454f5e';
  ctx.fillRect(-44, -5.5, 90, 11);
  ctx.fillStyle = '#5f6b7d';
  ctx.fillRect(-44, -5.5, 25, 11);                       // the stock, a shade lighter
  ctx.fillStyle = COLOURS.ink;
  ctx.fillRect(-4, 3, 13, 21);                         // the magazine
  ctx.fillStyle = kit.trim;
  ctx.fillRect(38, -3, 8, 6);                          // the muzzle ring
  ctx.fillStyle = '#6b7788';
  ctx.fillRect(6 - rack * 9, -9, 15, 5);               // the bolt, pulled and let go

  if (pose.flash > 0.05) {
    ctx.save();
    ctx.globalAlpha = pose.flash;
    ctx.fillStyle = '#fff3d0';
    ctx.beginPath();
    ctx.moveTo(46, 0);
    ctx.lineTo(58 + pose.flash * 12, -9);
    ctx.lineTo(68 + pose.flash * 18, 0);
    ctx.lineTo(58 + pose.flash * 12, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // the hands come to the gun rather than the gun to the hands
  const grip = (dx, dy) => ({
    x: gx + Math.cos(angle) * dx - Math.sin(angle) * dy,
    y: gy + Math.sin(angle) * dx + Math.cos(angle) * dy,
  });
  const fore = grip(26, 0);
  const trig = grip(-2 - rack * 9, -2);

  ctx.strokeStyle = kit.coat;
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  for (const [ox, hand] of [[-34, fore], [30, trig]]) {
    ctx.beginPath();
    ctx.moveTo(MID + ox, chest + 2);
    ctx.quadraticCurveTo(MID + ox * 1.15, chest + 24, hand.x, hand.y);
    ctx.stroke();
  }
  ctx.fillStyle = COLOURS.ink;
  for (const hand of [fore, trig]) {
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The head: helmet, scarf, and a face doing something.
 *
 * The scarf is the one part with no anatomy to answer to, so it gets the biggest
 * movement on the figure — it is what you notice from across the room and it is
 * why he does not read as a statue.
 */
function head(ctx, kit, pose, chest, lean) {
  const hx = MID + lean * 1.5;
  const hy = chest - 44 + pose.breath * 1.2;

  // The scarf, flying off his left shoulder. It is the one thing on him with no
  // anatomy to answer to, so it gets the widest movement — and it earned a
  // second pass at half the length, because the first one was longer than his
  // rifle and read as a cape.
  ctx.save();
  ctx.fillStyle = kit.tint;
  const flap = pose.breath * 3 + pose.sway * 5 + pose.rise * 9;
  ctx.beginPath();
  ctx.moveTo(hx + 10, hy + 20);
  ctx.quadraticCurveTo(hx + 26 + flap, hy + 16 - flap * 0.5, hx + 38 + flap, hy + 30 - flap * 0.8);
  ctx.quadraticCurveTo(hx + 26 + flap * 0.6, hy + 32 - flap * 0.3, hx + 12, hy + 32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(kit.tint, 0.72);
  ctx.beginPath();
  ctx.ellipse(hx, hy + 24, 18, 8, 0, 0, Math.PI * 2);       // the knot at the throat
  ctx.fill();
  ctx.restore();

  // the face
  ctx.fillStyle = kit.skin;
  ctx.beginPath();
  ctx.ellipse(hx, hy + 2, 21, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(kit.skin, 0.78);
  ctx.beginPath();                                          // a jaw with three days on it
  ctx.ellipse(hx, hy + 15, 15, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // eyes: two dark slots that shut on a blink, under brows that are doing the
  // talking. The brow angle is the whole expression.
  const open = 1 - pose.blink;
  const glee = pose.rise;
  ctx.fillStyle = '#1b1410';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(hx + side * 8, hy + 1, 3.6, 4.2 * open + 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2a1d13';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(hx + side * 3, hy - 7 - glee * 2);
    ctx.lineTo(hx + side * 14, hy - 5 + glee * 3);
    ctx.stroke();
  }
  // the mouth: a flat line that turns into a grin when he is picked
  ctx.strokeStyle = '#3a231c';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(hx - 7, hy + 14);
  ctx.quadraticCurveTo(hx, hy + 14 + glee * 6, hx + 7, hy + 14 - glee * 1.5);
  ctx.stroke();
  // and the scar he came with
  ctx.strokeStyle = 'rgba(120,60,50,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hx - 16, hy - 6);
  ctx.lineTo(hx - 12, hy + 7);
  ctx.stroke();

  // the helmet
  ctx.fillStyle = kit.head;
  ctx.beginPath();
  ctx.ellipse(hx, hy - 8, 25, 21, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(hx - 25, hy - 9, 50, 6);
  ctx.fillStyle = shade(kit.head, 1.7);
  ctx.beginPath();                                          // the brim, catching the light
  ctx.ellipse(hx, hy - 4, 27, 6, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = kit.tint;
  ctx.fillRect(hx - 3, hy - 29, 6, 20);                     // the stripe up the crown
  // the tally scratched into the side — five arenas, and he has been in all of
  // them. Nothing in the game counts them; that is what makes them his.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(hx + 10 + i * 3.5, hy - 22);
    ctx.lineTo(hx + 11 + i * 3.5, hy - 14);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(hx + 8, hy - 21);
  ctx.lineTo(hx + 22, hy - 15);
  ctx.stroke();
  // chin strap
  ctx.strokeStyle = shade(kit.head, 1.3);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx - 22, hy - 4);
  ctx.quadraticCurveTo(hx, hy + 26, hx + 22, hy - 4);
  ctx.stroke();
}

/* ----------------------------------------------------------------- the alien */

/**
 * A sentinel: taller than the trooper, off the ground, and built around the one
 * light in its chest.
 *
 * It hovers, so nothing about it is planted — the whole figure rides `bob`, the
 * tendrils lag behind it, and the embers off its vents keep going up after it
 * has stopped moving.
 */
function sentinel(ctx, kit, pose) {
  const hover = -14 + pose.bob * 4;
  const chest = GROUND - 178 + hover;
  const hip = GROUND - 104 + hover;

  ctx.save();
  ctx.translate(pose.sway * 3, 0);

  vents(ctx, kit, pose, chest);

  // the lower body tapers into two talons that never touch the plinth
  for (const side of [-1, 1]) {
    ctx.fillStyle = kit.legs;
    ctx.beginPath();
    ctx.moveTo(MID + side * 20, hip - 10);
    ctx.quadraticCurveTo(MID + side * 26, hip + 34, MID + side * 13, GROUND - 26 + hover);
    ctx.quadraticCurveTo(MID + side * 6, hip + 30, MID + side * 6, hip - 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = kit.tint;
    ctx.beginPath();                                        // the toe light
    ctx.ellipse(MID + side * 13, GROUND - 26 + hover, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // the torso: a long carapace, narrow at the waist, wide at the collar
  ctx.fillStyle = kit.coat;
  ctx.beginPath();
  ctx.moveTo(MID - 40, chest + 4);
  ctx.quadraticCurveTo(MID - 46, chest - 16, MID - 22, chest - 22);
  ctx.lineTo(MID + 22, chest - 22);
  ctx.quadraticCurveTo(MID + 46, chest - 16, MID + 40, chest + 4);
  ctx.quadraticCurveTo(MID + 26, hip + 4, MID + 16, hip + 10);
  ctx.lineTo(MID - 16, hip + 10);
  ctx.quadraticCurveTo(MID - 26, hip + 4, MID - 40, chest + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(kit.coat, 0.66);
  ctx.beginPath();                                          // plate seams
  ctx.moveTo(MID - 30, chest + 26);
  ctx.lineTo(MID + 30, chest + 26);
  ctx.lineTo(MID + 22, chest + 40);
  ctx.lineTo(MID - 22, chest + 40);
  ctx.closePath();
  ctx.fill();

  // shoulder plates and a hip skirt: without them the carapace is one teal
  // shape and the sentinel has no silhouette to read at a glance
  for (const side of [-1, 1]) {
    ctx.fillStyle = shade(kit.coat, 1.45);
    ctx.beginPath();
    ctx.ellipse(MID + side * 37, chest - 8, 16, 13, side * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tint(kit.trim, 0.5);
    ctx.beginPath();
    ctx.ellipse(MID + side * 41, chest - 12, 6, 4, side * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = shade(kit.coat, 1.2);
  ctx.beginPath();
  ctx.moveTo(MID - 22, hip - 4);
  ctx.lineTo(MID + 22, hip - 4);
  ctx.lineTo(MID + 15, hip + 16);
  ctx.lineTo(MID - 15, hip + 16);
  ctx.closePath();
  ctx.fill();

  // the core. It is the brightest thing on the figure at rest and it is what
  // goes off when the sentinel is chosen.
  const beat = 0.55 + 0.45 * Math.sin(pose.breath * 2.4);
  const power = Math.max(beat * 0.6, pose.charge * 0.9, pose.glow);
  const g = ctx.createRadialGradient(MID, chest + 6, 2, MID, chest + 6, 34 + power * 24);
  g.addColorStop(0, tint('#ffffff', 0.9 * power + 0.25));
  g.addColorStop(0.35, tint(kit.trim, 0.85));
  g.addColorStop(1, 'rgba(79,224,176,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(MID, chest + 6, 40 + power * 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tint('#ffffff', 0.55 + power * 0.45);
  ctx.beginPath();
  ctx.ellipse(MID, chest + 6, 9, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // a set of human tags on the belt: this one has been in the field a while
  ctx.strokeStyle = shade(COLOURS.steel, 0.7);
  ctx.lineWidth = 1.6;
  const dangle = pose.bob * 3 + pose.rise * 7;
  ctx.beginPath();
  ctx.moveTo(MID + 16, hip - 2);
  ctx.lineTo(MID + 19 + dangle * 0.4, hip + 14);
  ctx.stroke();
  ctx.fillStyle = COLOURS.steel;
  ctx.fillRect(MID + 16 + dangle * 0.4, hip + 14, 6, 11);

  limbs(ctx, kit, pose, chest);
  dome(ctx, kit, pose, chest);
  ctx.restore();
}

/** Two vents on its back, breathing embers up past its shoulders. */
function vents(ctx, kit, pose, chest) {
  ctx.save();
  ctx.fillStyle = shade(kit.coat, 0.55);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(MID + side * 34, chest - 6, 13, 22, side * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 10; i++) {
    const seed = i * 1.7;
    const climb = ((pose.breath + 1) * 30 + i * 26 + pose.shock * 90) % 130;
    ctx.globalAlpha = (1 - climb / 130) * (0.35 + pose.glow * 0.5);
    ctx.fillStyle = kit.trim;
    const side = i % 2 ? 1 : -1;
    ctx.fillRect(MID + side * (32 + Math.sin(seed + climb / 26) * 6), chest - 14 - climb, 2.5, 4);
  }
  ctx.restore();
}

/**
 * The arms: a four-fingered hand on one side, the cannon on the other.
 *
 * The cannon is the sentinel's whole flourish — three rings that sit flush at
 * rest, separate and spin as it charges, and are still spinning when the shot
 * has gone.
 */
function limbs(ctx, kit, pose, chest) {
  const spin = pose.charge * 3 + pose.shock * 9;
  const spread = pose.charge * 7 + (pose.struck ? (1 - pose.shock) * 5 : 0);
  const lift = pose.rise * 26;

  // his left: a long arm hanging, four fingers open
  ctx.strokeStyle = shade(kit.coat, 1.3);
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(MID - 34, chest - 8);
  ctx.quadraticCurveTo(MID - 56, chest + 30, MID - 46, chest + 66 - lift * 0.3);
  ctx.stroke();
  ctx.strokeStyle = kit.skin;
  ctx.lineWidth = 4.2;
  for (let i = 0; i < 4; i++) {
    const a = 1.1 + i * 0.26 + pose.bob * 0.05;
    ctx.beginPath();
    ctx.moveTo(MID - 46, chest + 66 - lift * 0.3);
    ctx.lineTo(MID - 46 + Math.cos(a) * -20, chest + 66 - lift * 0.3 + Math.sin(a) * 20);
    ctx.stroke();
  }

  // his right: the cannon, raised as it charges
  const ex = MID + 44;
  const ey = chest + 44 - lift;
  ctx.strokeStyle = shade(kit.coat, 1.3);
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(MID + 34, chest - 8);
  ctx.quadraticCurveTo(MID + 56, chest + 16, ex, ey);
  ctx.stroke();

  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(-0.5 - pose.rise * 0.55);
  ctx.fillStyle = shade(kit.coat, 0.6);
  ctx.fillRect(-14, -11, 42, 22);
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(20 + i * (7 + spread), 0);
    ctx.rotate(spin + i);
    ctx.strokeStyle = tint(kit.trim, 0.5 + pose.charge * 0.5);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 12 - i * 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // the bolt sitting in the muzzle, and the flash when it leaves
  const orb = pose.struck ? pose.flash * 22 : pose.charge * 9;
  if (orb > 0.5) {
    const g = ctx.createRadialGradient(46, 0, 0, 46, 0, orb + 8);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, tint(kit.trim, 0.9));
    g.addColorStop(1, 'rgba(79,224,176,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(46, 0, orb + 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The skull: cracked, riveted, and two eyes that are the only face it has. */
function dome(ctx, kit, pose, chest) {
  const hx = MID + pose.sway * 2;
  const hy = chest - 48 + pose.bob * 2;

  // three tendrils off the back of it, always a beat behind the head
  ctx.strokeStyle = shade(kit.head, 0.7);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const drift = pose.bob * (6 + i * 3) + pose.rise * 14;
    ctx.beginPath();
    ctx.moveTo(hx + 12, hy + 2 + i * 6);
    ctx.quadraticCurveTo(hx + 34 + drift, hy + 6 + i * 10, hx + 52 + drift * 1.6, hy + 24 + i * 12);
    ctx.stroke();
  }

  ctx.fillStyle = kit.head;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 24, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(kit.head, 0.82);
  ctx.beginPath();                                          // the brow ridge
  ctx.ellipse(hx, hy - 12, 20, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // the crack, and the plate riveted over it
  ctx.strokeStyle = shade(kit.head, 0.55);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hx - 18, hy - 16);
  ctx.lineTo(hx - 11, hy - 4);
  ctx.lineTo(hx - 15, hy + 8);
  ctx.stroke();
  ctx.fillStyle = COLOURS.steel;
  ctx.fillRect(hx - 22, hy - 12, 9, 16);
  ctx.fillStyle = shade(COLOURS.steel, 0.6);
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.arc(hx - 17.5, hy - 8 + i * 8, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // the eyes: two black almonds with the core's light caught in them. They
  // narrow on a blink and flare on the strike — the only expression it has.
  const open = 1 - pose.blink;
  const fire = pose.glow;
  ctx.fillStyle = COLOURS.ink;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(hx + side * 10, hy + 2);
    ctx.rotate(side * 0.34);
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, (7 - fire * 1.5) * open + 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tint(kit.trim, 0.35 + fire * 0.65);
    ctx.beginPath();
    ctx.ellipse(-2, -1, 4, 2.4 * open, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.ink;
    ctx.restore();
  }
  // and the vent slit where a mouth would be
  ctx.fillStyle = tint(kit.trim, 0.3 + fire * 0.6);
  ctx.fillRect(hx - 6, hy + 18, 12, 3);
}

/* ------------------------------------------------------------------- colours */

/** A hex nudged lighter or darker — the same trick the field's walls use. */
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/** The same hex at an alpha — for glows, where the colour is the light. */
function tint(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, alpha))})`;
}
