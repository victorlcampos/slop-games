// Everything on the field, drawn by hand: five kinds of wall, two kings, two
// siege engines and eight things they throw.
//
// Not one pixel of this comes from a file (rule nº 5). A sandbag is two rounded
// rectangles and a line of stitches; an iron plate is a rectangle, four rivets
// and one panel seam. The gain is not only the file size — a block that is
// drawn rather than blitted can be cracked, scorched, rusted and shaken by
// changing three numbers, which is what a wall taking fire has to do.

import { material } from './materials.js';

const TAU = Math.PI * 2;

/** roundRect is not everywhere yet, and a path is four lines and four arcs. */
export function rr(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + k);
  ctx.lineTo(x + w, y + h - k);
  ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  ctx.lineTo(x + k, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - k);
  ctx.lineTo(x, y + k);
  ctx.quadraticCurveTo(x, y, x, y + k);
  ctx.closePath();
}

/** A deterministic wobble per cell, so the same wall looks the same every frame. */
function noise(c, r, k = 0) {
  const n = Math.sin((c * 12.9898 + r * 78.233 + k * 37.719) * 43758.5453);
  return n - Math.floor(n);
}

// ------------------------------------------------------------------- walls

export function drawBlock(ctx, b, rect, opts = {}) {
  const m = material(b.m);
  const hurt = 1 - Math.max(0, b.hp) / b.max;
  const { x, y, w, h } = rect;

  ctx.save();
  if (b.shake > 0) {
    ctx.translate((noise(b.c, b.r, 5) - 0.5) * 5 * b.shake, (noise(b.c, b.r, 6) - 0.5) * 5 * b.shake);
  }

  if (b.m === 'king') drawKing(ctx, rect, opts.faction || 'knights', b);
  else if (b.m === 'sand') drawSand(ctx, x, y, w, h, m, b);
  else if (b.m === 'wood') drawWood(ctx, x, y, w, h, m, b);
  else if (b.m === 'crystal') drawCrystal(ctx, x, y, w, h, m, b);
  else if (b.m === 'iron') drawIron(ctx, x, y, w, h, m, b);
  else drawStone(ctx, x, y, w, h, m, b);

  if (b.m !== 'king' && hurt > 0.12) drawCracks(ctx, x, y, w, h, hurt, b);
  if (b.rust > 0) drawRust(ctx, x, y, w, h, b);
  if (b.fire > 0) {
    ctx.fillStyle = 'rgba(60,20,10,0.45)';
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function drawStone(ctx, x, y, w, h, m, b) {
  ctx.fillStyle = m.side;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = m.face;
  ctx.fillRect(x + 1, y + 1, w - 3, h - 3);
  ctx.fillStyle = m.grain;
  for (let i = 0; i < 5; i++) {
    const n1 = noise(b.c, b.r, i);
    const n2 = noise(b.c, b.r, i + 20);
    ctx.fillRect(x + 3 + n1 * (w - 9), y + 3 + n2 * (h - 9), 3 + n1 * 4, 2 + n2 * 3);
  }
  // the mortar line that makes a wall read as courses rather than a grid
  ctx.fillStyle = m.dark;
  ctx.fillRect(x, y + h - 3, w, 3);
  ctx.fillRect(x + (b.r % 2 ? w - 3 : 0), y, 3, h);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x + 2, y + 2, w - 5, 2);
}

function drawWood(ctx, x, y, w, h, m, b) {
  ctx.fillStyle = m.dark;
  ctx.fillRect(x, y, w, h);
  const planks = 3;
  for (let i = 0; i < planks; i++) {
    const ph = (h - 2) / planks;
    const py = y + 1 + i * ph;
    ctx.fillStyle = i % 2 ? m.side : m.face;
    ctx.fillRect(x + 1, py, w - 2, ph - 1);
    ctx.strokeStyle = m.dark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const g = noise(b.c, b.r, i);
    ctx.moveTo(x + 3, py + ph * 0.4 + g * 3);
    ctx.quadraticCurveTo(x + w / 2, py + ph * 0.2 + g * 5, x + w - 3, py + ph * 0.55);
    ctx.stroke();
  }
  ctx.fillStyle = '#3a2a18';
  for (const [px, py] of [[x + 4, y + 4], [x + w - 6, y + 4], [x + 4, y + h - 6], [x + w - 6, y + h - 6]]) {
    ctx.beginPath();
    ctx.arc(px, py, 1.6, 0, TAU);
    ctx.fill();
  }
}

function drawSand(ctx, x, y, w, h, m, b) {
  for (let i = 0; i < 2; i++) {
    const sy = y + 2 + i * ((h - 3) / 2);
    const sh = (h - 4) / 2;
    const off = (noise(b.c, b.r, i) - 0.5) * 4;
    ctx.fillStyle = i % 2 ? m.side : m.face;
    rr(ctx, x + 1 + off, sy, w - 2, sh, 5);
    ctx.fill();
    ctx.strokeStyle = m.dark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let s = 0; s < 4; s++) {
      const sx = x + 5 + off + (s * (w - 10)) / 3;
      ctx.moveTo(sx, sy + 2);
      ctx.lineTo(sx, sy + sh - 2);
    }
    ctx.stroke();
  }
}

function drawCrystal(ctx, x, y, w, h, m, b) {
  ctx.fillStyle = m.side;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + 1);
  ctx.lineTo(x + w - 1, y + h * 0.3);
  ctx.lineTo(x + w - 2, y + h - 1);
  ctx.lineTo(x + 2, y + h - 1);
  ctx.lineTo(x + 1, y + h * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = m.face;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + 3);
  ctx.lineTo(x + w * 0.82, y + h * 0.35);
  ctx.lineTo(x + w * 0.5, y + h - 3);
  ctx.lineTo(x + w * 0.18, y + h * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = m.grain;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.36, y + h * 0.3);
  ctx.lineTo(x + w * 0.45, y + h * 0.75);
  ctx.stroke();
}

function drawIron(ctx, x, y, w, h, m, b) {
  ctx.fillStyle = m.dark;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = m.side;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = m.face;
  ctx.fillRect(x + 2, y + 2, w - 4, h * 0.45);
  ctx.strokeStyle = m.dark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + h * 0.55);
  ctx.lineTo(x + w - 3, y + h * 0.55);
  ctx.stroke();
  ctx.fillStyle = m.grain;
  for (const [px, py] of [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5]]) {
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x + 3, y + 3, w - 6, 2);
}

function drawCracks(ctx, x, y, w, h, hurt, b) {
  ctx.save();
  // clipped to the cell: a crack wanders two thirds of a block from where it
  // started, and unclipped the deepest ones came out as scratches in the air
  // beside a wall rather than damage to it
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = `rgba(20,16,14,${0.35 + hurt * 0.5})`;
  ctx.lineWidth = 1 + hurt * 1.6;
  const n = Math.ceil(hurt * 4);
  for (let i = 0; i < n; i++) {
    const a = noise(b.c, b.r, i + 40) * TAU;
    const cx = x + w / 2 + Math.cos(a) * w * 0.18;
    const cy = y + h / 2 + Math.sin(a) * h * 0.18;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    let px = cx;
    let py = cy;
    for (let k = 0; k < 3; k++) {
      px += Math.cos(a + (noise(b.c, b.r, i * 3 + k) - 0.5) * 2) * (w * 0.22);
      py += Math.sin(a + (noise(b.c, b.r, i * 3 + k + 9) - 0.5) * 2) * (h * 0.22);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawRust(ctx, x, y, w, h, b) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#a2521f';
  for (let i = 0; i < 7; i++) {
    const n1 = noise(b.c, b.r, i + 60);
    const n2 = noise(b.c, b.r, i + 70);
    ctx.beginPath();
    ctx.arc(x + 4 + n1 * (w - 8), y + 4 + n2 * (h - 8), 2 + n1 * 4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------- kings

export function drawKing(ctx, rect, faction, b) {
  const { x, y, w, h } = rect;
  const dead = b && b.hp <= 0;
  const hurt = b ? 1 - Math.max(0, b.hp) / b.max : 0;

  ctx.save();
  ctx.translate(x + w / 2, y + h);
  if (dead) ctx.rotate(0.9);

  // the plinth he is standing on, so he never looks like he is floating
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, -1, w * 0.4, 3.5, 0, 0, TAU);
  ctx.fill();

  if (faction === 'machines') drawEmperor(ctx, w, h, hurt, dead);
  else drawCrownedKing(ctx, w, h, hurt, dead);
  ctx.restore();
}

function drawCrownedKing(ctx, w, h, hurt, dead) {
  const s = h / 34;
  // robe
  ctx.fillStyle = dead ? '#5a2b3a' : '#8e2f4a';
  ctx.beginPath();
  ctx.moveTo(-7 * s, 0);
  ctx.lineTo(-5 * s, -16 * s);
  ctx.lineTo(5 * s, -16 * s);
  ctx.lineTo(7 * s, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8dcc0';
  ctx.fillRect(-1.4 * s, -15 * s, 2.8 * s, 14 * s);
  // head
  ctx.fillStyle = '#e8c49a';
  ctx.beginPath();
  ctx.arc(0, -19.5 * s, 4.2 * s, 0, TAU);
  ctx.fill();
  // beard
  ctx.fillStyle = '#e6e2da';
  ctx.beginPath();
  ctx.moveTo(-3.6 * s, -18.5 * s);
  ctx.quadraticCurveTo(0, -12 * s, 3.6 * s, -18.5 * s);
  ctx.closePath();
  ctx.fill();
  // eyes
  ctx.fillStyle = '#2a1c14';
  if (dead) {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#2a1c14';
    for (const dx of [-1.8, 1.8]) {
      ctx.beginPath();
      ctx.moveTo(dx * s - 1.2, -21 * s - 1.2);
      ctx.lineTo(dx * s + 1.2, -21 * s + 1.2);
      ctx.moveTo(dx * s + 1.2, -21 * s - 1.2);
      ctx.lineTo(dx * s - 1.2, -21 * s + 1.2);
      ctx.stroke();
    }
  } else {
    for (const dx of [-1.8, 1.8]) {
      ctx.beginPath();
      ctx.arc(dx * s, -20.6 * s, 0.9 * s, 0, TAU);
      ctx.fill();
    }
  }
  // crown
  ctx.fillStyle = hurt > 0.5 ? '#c9a52c' : '#f0cd3c';
  ctx.beginPath();
  ctx.moveTo(-5 * s, -23 * s);
  ctx.lineTo(-5 * s, -27 * s);
  ctx.lineTo(-2.5 * s, -25 * s);
  ctx.lineTo(0, -28.5 * s);
  ctx.lineTo(2.5 * s, -25 * s);
  ctx.lineTo(5 * s, -27 * s);
  ctx.lineTo(5 * s, -23 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff5a6a';
  ctx.beginPath();
  ctx.arc(0, -24.4 * s, 1 * s, 0, TAU);
  ctx.fill();
}

function drawEmperor(ctx, w, h, hurt, dead) {
  const s = h / 34;
  // chassis
  ctx.fillStyle = dead ? '#3c4450' : '#556270';
  rr(ctx, -7 * s, -17 * s, 14 * s, 17 * s, 2 * s);
  ctx.fill();
  ctx.fillStyle = '#3c4450';
  ctx.fillRect(-7 * s, -9 * s, 14 * s, 2 * s);
  // chest lamp
  ctx.fillStyle = dead ? '#5c3030' : '#ff8a3a';
  ctx.beginPath();
  ctx.arc(0, -12.5 * s, 2 * s, 0, TAU);
  ctx.fill();
  // head
  ctx.fillStyle = '#6b798a';
  rr(ctx, -5.5 * s, -25 * s, 11 * s, 9 * s, 1.8 * s);
  ctx.fill();
  // visor
  ctx.fillStyle = '#141a22';
  ctx.fillRect(-4.2 * s, -22.6 * s, 8.4 * s, 3.4 * s);
  ctx.fillStyle = dead ? '#4a2020' : hurt > 0.5 ? '#ffb03a' : '#4ce0ff';
  if (dead) {
    ctx.fillRect(-3.4 * s, -21.4 * s, 2.4 * s, 1.2 * s);
    ctx.fillRect(1 * s, -21.4 * s, 2.4 * s, 1.2 * s);
  } else {
    ctx.fillRect(-3.4 * s, -21.6 * s, 6.8 * s, 1.6 * s);
  }
  // a crown of antennae, because an emperor is an emperor
  ctx.strokeStyle = hurt > 0.5 ? '#c9a52c' : '#f0cd3c';
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  for (const dx of [-4, 0, 4]) {
    ctx.moveTo(dx * s, -25 * s);
    ctx.lineTo(dx * s * 1.15, -29.5 * s + Math.abs(dx) * 0.4 * s);
  }
  ctx.stroke();
  ctx.fillStyle = '#f0cd3c';
  for (const dx of [-4.6, 0, 4.6]) {
    ctx.beginPath();
    ctx.arc(dx * s, -29.8 * s + Math.abs(dx) * 0.35 * s, 1.2 * s, 0, TAU);
    ctx.fill();
  }
}

// ------------------------------------------------------------- the engines

/**
 * The siege engine each side fires from. Both are drawn around a pivot at
 * (0, -28) so the aiming arm and the muzzle flash agree with the physics — the
 * shot really does leave the end of the arm.
 */
export function drawLauncher(ctx, L, faction, opts = {}) {
  ctx.save();
  ctx.translate(L.x, L.y);
  ctx.scale(L.dir, 1);
  const a = -L.angle * (Math.PI / 180);
  const recoil = L.recoil || 0;

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, -2, 30, 6, 0, 0, TAU);
  ctx.fill();

  if (faction === 'machines') drawMortar(ctx, a, recoil, opts);
  else drawTrebuchet(ctx, a, recoil, opts);
  ctx.restore();
}

function drawTrebuchet(ctx, a, recoil, opts) {
  // frame
  ctx.strokeStyle = '#6b4526';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-16, -2);
  ctx.lineTo(0, -28);
  ctx.lineTo(16, -2);
  ctx.moveTo(-9, -15);
  ctx.lineTo(9, -15);
  ctx.stroke();
  ctx.fillStyle = '#4e3218';
  ctx.fillRect(-24, -6, 48, 6);
  // wheels
  ctx.fillStyle = '#5c3d1f';
  for (const dx of [-16, 16]) {
    ctx.beginPath();
    ctx.arc(dx, -3, 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3a2410';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // the arm, which is what the player is actually aiming
  ctx.save();
  ctx.translate(0, -28);
  ctx.rotate(a + recoil * 0.8);
  ctx.strokeStyle = '#8a5c2e';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(34, 0);
  ctx.stroke();
  // counterweight
  ctx.fillStyle = '#4a4038';
  rr(ctx, -22, -6, 12, 12, 2);
  ctx.fill();
  ctx.fillStyle = '#2f2a24';
  ctx.fillRect(-20, -4, 8, 3);
  // sling
  ctx.strokeStyle = '#c9b48a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(34, 0);
  ctx.lineTo(30, 9);
  ctx.stroke();
  if (opts.loaded) {
    ctx.fillStyle = '#8b8f95';
    ctx.beginPath();
    ctx.arc(30, 10, 4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawMortar(ctx, a, recoil, opts) {
  // tracks
  ctx.fillStyle = '#2f3742';
  rr(ctx, -26, -14, 52, 13, 6);
  ctx.fill();
  ctx.fillStyle = '#4a5563';
  for (let i = -22; i <= 20; i += 7) ctx.fillRect(i, -13, 4, 11);
  ctx.fillStyle = '#5d6a7a';
  rr(ctx, -18, -26, 36, 14, 4);
  ctx.fill();
  ctx.fillStyle = '#8ea3b8';
  ctx.fillRect(-14, -24, 10, 4);
  // the barrel
  ctx.save();
  ctx.translate(0, -28);
  ctx.rotate(a);
  const back = recoil * 7;
  ctx.fillStyle = '#46525f';
  rr(ctx, -8 - back, -5, 40, 10, 3);
  ctx.fill();
  ctx.fillStyle = '#6f7f90';
  rr(ctx, 20 - back, -6, 12, 12, 3);
  ctx.fill();
  ctx.fillStyle = '#222a33';
  ctx.beginPath();
  ctx.arc(31 - back, 0, 4, 0, TAU);
  ctx.fill();
  if (recoil > 0.1) {
    ctx.fillStyle = `rgba(255,190,90,${recoil * 0.8})`;
    ctx.beginPath();
    ctx.moveTo(32 - back, -7 * recoil);
    ctx.lineTo(32 + 26 * recoil - back, 0);
    ctx.lineTo(32 - back, 7 * recoil);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#39434f';
  ctx.beginPath();
  ctx.arc(0, -28, 7, 0, TAU);
  ctx.fill();
}

// --------------------------------------------------------------- munitions

export function drawShot(ctx, s, spin) {
  const a = Math.atan2(s.vy, s.vx);
  ctx.save();
  ctx.translate(s.x, s.y);

  switch (s.w) {
    case 'boulder':
    case 'hail': {
      ctx.rotate(spin);
      const r = s.w === 'hail' ? 7 : 9;
      ctx.fillStyle = '#7f858c';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5d636a';
      ctx.beginPath();
      ctx.arc(r * 0.3, r * 0.25, r * 0.45, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#9aa1a8';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.35, r * 0.3, 0, TAU);
      ctx.fill();
      break;
    }
    case 'firepot': {
      ctx.rotate(spin * 0.5);
      ctx.fillStyle = '#8a5a34';
      rr(ctx, -6, -7, 12, 14, 4);
      ctx.fill();
      ctx.fillStyle = '#5e3a1e';
      ctx.fillRect(-4, -9, 8, 3);
      ctx.fillStyle = '#ffb03a';
      ctx.beginPath();
      ctx.arc(0, -11, 4 + Math.sin(spin * 6) * 1.5, 0, TAU);
      ctx.fill();
      break;
    }
    case 'ballista': {
      ctx.rotate(a);
      ctx.fillStyle = '#6b4526';
      ctx.fillRect(-14, -1.6, 22, 3.2);
      ctx.fillStyle = '#c8ced6';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(6, -4.5);
      ctx.lineTo(6, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8dcc0';
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-20, -4);
      ctx.lineTo(-18, 0);
      ctx.lineTo(-20, 4);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'railshot': {
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(120,220,255,0.35)';
      ctx.fillRect(-22, -3, 24, 6);
      ctx.fillStyle = '#d8f4ff';
      rr(ctx, -7, -3.5, 14, 7, 3);
      ctx.fill();
      ctx.fillStyle = '#5ac8ff';
      ctx.beginPath();
      ctx.arc(4, 0, 2.4, 0, TAU);
      ctx.fill();
      break;
    }
    case 'rustshell': {
      ctx.rotate(a);
      ctx.fillStyle = '#6f7c52';
      rr(ctx, -9, -5, 18, 10, 4);
      ctx.fill();
      ctx.fillStyle = '#b6642a';
      ctx.beginPath();
      ctx.arc(6, 0, 3.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#96a36a';
      ctx.fillRect(-8, -3, 5, 6);
      break;
    }
    case 'tesla': {
      ctx.fillStyle = 'rgba(120,220,255,0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, 11 + Math.sin(spin * 9) * 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#eaffff';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#7fe0ff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const t = spin * 4 + (i * TAU) / 4;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(t) * 13, Math.sin(t) * 13);
      }
      ctx.stroke();
      break;
    }
    default: {
      // the drill
      ctx.rotate(a);
      ctx.fillStyle = '#5d6a7a';
      ctx.fillRect(-11, -5, 16, 10);
      ctx.fillStyle = '#c8ced6';
      ctx.beginPath();
      ctx.moveTo(17, 0);
      ctx.lineTo(5, -6);
      ctx.lineTo(5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8ea3b8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const o = ((spin * 3 + i) % 3) * 4;
        ctx.moveTo(5 + o, -5.5 + o * 0.35);
        ctx.lineTo(5 + o, 5.5 - o * 0.35);
      }
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

/** The little pip drawn on the weapon dock — the same munition, half the size. */
export function drawShotIcon(ctx, id, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  drawShot(ctx, { w: id, x: 0, y: 0, vx: 1, vy: -0.35 }, 0.6);
  ctx.restore();
}
