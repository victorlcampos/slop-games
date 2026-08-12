// One painter per line of the manifest.
//
// Twenty-one drawings, all made of the same four shapes from paint.js. They are
// deliberately readable at a glance and from a distance: in the middle of a
// horde the player is not admiring the piano, they are deciding whether it is
// the thing that explodes.

import { block, ball, polygon, roundRect, shade, outline, text } from './paint.js';
import { COLOURS } from '../config.js';

const M = COLOURS.metal;

/** Draws cargo `o` centred at the origin, already rotated by the caller. */
export const CARGO_ART = {
  crate(ctx, r) {
    block(ctx, -r, -r, r * 2, r * 2, '#9a6b3c', { r: 4 });
    ctx.strokeStyle = shade('#9a6b3c', -0.4);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r, -r); ctx.lineTo(r, r);
    ctx.moveTo(r, -r); ctx.lineTo(-r, r);
    ctx.stroke();
  },
  supply(ctx, r) {
    block(ctx, -r * 0.85, -r * 0.7, r * 1.7, r * 1.4, '#4f6b3a', { r: 4 });
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(-r * 0.2, -r * 0.7, r * 0.4, r * 1.4);
  },
  egg(ctx, r) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.78, r, 0, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#f3ead6');
    g.addColorStop(1, '#c9b78f');
    ctx.fillStyle = g;
    ctx.fill();
    outline(ctx, 3);
    ctx.fillStyle = 'rgba(120,150,90,0.45)';
    for (const [dx, dy, rr] of [[-0.3, -0.2, 0.16], [0.25, 0.1, 0.2], [-0.05, 0.45, 0.13]]) {
      ctx.beginPath();
      ctx.ellipse(dx * r, dy * r, rr * r, rr * r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  ball(ctx, r) {
    ball(ctx, 0, 0, r, '#c8443c');
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, -2.4, -0.9);
    ctx.stroke();
  },
  spikeball(ctx, r) {
    ctx.save();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      polygon(ctx, [
        [Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7],
        [Math.cos(a + 0.3) * r * 0.7, Math.sin(a + 0.3) * r * 0.7],
        [Math.cos(a + 0.15) * r * 1.35, Math.sin(a + 0.15) * r * 1.35],
      ], '#5a5f66', 2);
    }
    ctx.restore();
    ball(ctx, 0, 0, r * 0.75, '#6c7078');
  },
  barrel(ctx, r) {
    block(ctx, -r * 0.7, -r, r * 1.4, r * 2, '#b3462f', { r: 6 });
    ctx.fillStyle = 'rgba(20,16,12,0.5)';
    ctx.fillRect(-r * 0.7, -r * 0.45, r * 1.4, r * 0.16);
    ctx.fillRect(-r * 0.7, r * 0.3, r * 1.4, r * 0.16);
    text(ctx, '⛽', 0, r * 0.1, { size: r * 0.9, align: 'center', baseline: 'middle', stroke: 0 });
  },
  cylinder(ctx, r) {
    block(ctx, -r * 0.55, -r, r * 1.1, r * 1.8, '#c8a63a', { r: 8 });
    block(ctx, -r * 0.18, -r * 1.25, r * 0.36, r * 0.3, M, { r: 2 });
  },
  tv(ctx, r) {
    block(ctx, -r, -r * 0.8, r * 2, r * 1.6, '#6a5b4a', { r: 5 });
    block(ctx, -r * 0.75, -r * 0.6, r * 1.5, r * 1.05, '#2f4a52', { r: 3, top: 0.35 });
    ctx.strokeStyle = 'rgba(160,220,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.4); ctx.lineTo(r * 0.5, -r * 0.05);
    ctx.stroke();
  },
  drone(ctx, r) {
    ball(ctx, 0, 0, r * 0.8, '#57616b');
    ctx.beginPath();
    ctx.ellipse(0, r * 0.1, r * 1.5, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#3d454d';
    ctx.fill();
    outline(ctx, 3);
    ball(ctx, 0, -r * 0.1, r * 0.3, '#ff6a6a');
  },
  mine(ctx, r) {
    ball(ctx, 0, 0, r * 0.85, '#3f4a55');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
      ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#2b333c';
      ctx.stroke();
    }
    ball(ctx, 0, 0, r * 0.22, '#ff4d4d');
  },
  jelly(ctx, r) {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.1, r, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(140, 220, 130, 0.85)';
    ctx.fill();
    outline(ctx, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.25, r * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fill();
  },
  blob(ctx, r) { CARGO_ART.jelly(ctx, r); },
  boulder(ctx, r) {
    polygon(ctx, [
      [-r, r * 0.2], [-r * 0.7, -r * 0.7], [0, -r], [r * 0.75, -r * 0.6],
      [r, r * 0.25], [r * 0.5, r], [-r * 0.5, r],
    ], '#6b6157');
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.35, r * 0.22, -0.4, 0, Math.PI * 2);
    ctx.fill();
  },
  anvil(ctx, r) {
    polygon(ctx, [
      [-r, -r * 0.5], [r, -r * 0.5], [r * 0.75, 0], [r * 0.4, 0.05 * r],
      [r * 0.4, r * 0.55], [r * 0.8, r * 0.8], [-r * 0.8, r * 0.8],
      [-r * 0.4, r * 0.55], [-r * 0.4, 0.05 * r], [-r * 0.75, 0],
    ], '#4d545c');
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-r * 0.95, -r * 0.48, r * 1.9, r * 0.14);
  },
  piano(ctx, r) {
    block(ctx, -r, -r * 0.55, r * 2, r * 0.95, '#20232a', { r: 4 });
    ctx.fillStyle = '#f2ece0';
    for (let i = 0; i < 9; i++) ctx.fillRect(-r * 0.92 + i * (r * 0.2), r * 0.05, r * 0.16, r * 0.3);
    ctx.fillStyle = '#15161a';
    for (let i = 0; i < 8; i++) if (i % 3 !== 2) ctx.fillRect(-r * 0.82 + i * (r * 0.2), r * 0.05, r * 0.08, r * 0.18);
  },
  fridge(ctx, r) {
    block(ctx, -r * 0.72, -r, r * 1.44, r * 2, '#d8d3c6', { r: 5 });
    ctx.fillStyle = 'rgba(20,16,12,0.35)';
    ctx.fillRect(-r * 0.72, -r * 0.18, r * 1.44, 4);
    block(ctx, r * 0.42, -r * 0.72, r * 0.14, r * 0.42, '#8a8f96', { r: 2, line: 2 });
  },
  safe(ctx, r) {
    block(ctx, -r, -r, r * 2, r * 2, '#3f4650', { r: 4 });
    block(ctx, -r * 0.72, -r * 0.72, r * 1.44, r * 1.44, '#4a525d', { r: 3, line: 2 });
    ball(ctx, 0, 0, r * 0.3, '#c8a63a', { line: 2 });
    ctx.strokeStyle = COLOURS.ink;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32);
      ctx.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
      ctx.stroke();
    }
  },
  statue(ctx, r) {
    polygon(ctx, [[-r * 0.75, r], [-r * 0.4, -r * 0.2], [-r * 0.55, -r * 0.75],
      [0, -r], [r * 0.55, -r * 0.75], [r * 0.4, -r * 0.2], [r * 0.75, r]], '#7c8b7a');
    ball(ctx, 0, -r * 0.62, r * 0.3, '#93a38f', { line: 2 });
    ctx.fillStyle = '#2a3a2e';
    ctx.beginPath();
    ctx.ellipse(-r * 0.12, -r * 0.66, r * 0.07, r * 0.11, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.12, -r * 0.66, r * 0.07, r * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  bell(ctx, r) {
    polygon(ctx, [[-r * 0.9, r * 0.7], [-r * 0.6, -r * 0.4], [0, -r * 0.85],
      [r * 0.6, -r * 0.4], [r * 0.9, r * 0.7]], '#c8a63a');
    ctx.fillStyle = shade('#c8a63a', -0.35);
    ctx.fillRect(-r * 0.95, r * 0.6, r * 1.9, r * 0.2);
    ball(ctx, 0, r * 0.85, r * 0.16, '#8a6a20', { line: 2 });
  },
  meteor(ctx, r) {
    polygon(ctx, [[-r, 0], [-r * 0.6, -r * 0.8], [r * 0.3, -r], [r, -r * 0.2],
      [r * 0.6, r * 0.8], [-r * 0.4, r]], '#463b33');
    ctx.fillStyle = '#ff7a3c';
    for (const [dx, dy, rr] of [[-0.3, -0.2, 0.2], [0.35, 0.15, 0.16], [0, 0.5, 0.12]]) {
      ctx.beginPath();
      ctx.arc(dx * r, dy * r, rr * r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  capsule(ctx, r) {
    roundRect(ctx, -r * 0.7, -r, r * 1.4, r * 2, r * 0.7);
    ctx.fillStyle = '#6d7b86';
    ctx.fill();
    outline(ctx, 3);
    ctx.fillStyle = '#9fe6ff';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.35, r * 0.42, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 2);
  },
  // Four crews fly for the freighter, and they do not fly the same ship —
  // `o.variant` picks which one is overhead. The little pilots matter: a
  // saucer with nobody inside is a prop, a saucer with somebody is an enemy.
  ufo(ctx, r, o) {
    const v = (o && o.variant) || 0;
    const age = (o && o.age) || 0;
    if (v === 1) return UFO_ART.hauler(ctx, r, age);
    if (v === 2) return UFO_ART.jelly(ctx, r, age);
    if (v === 3) return UFO_ART.scout(ctx, r, age);
    return UFO_ART.classic(ctx, r, age);
  },
};

const UFO_ART = {
  /** The saucer of the postcards: chrome dish, glass dome, green pilot. */
  classic(ctx, r, age) {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.1, r, r * 0.34, 0, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.4);
    g.addColorStop(0, '#9aa6b2');
    g.addColorStop(1, '#3c444d');
    ctx.fillStyle = g;
    ctx.fill();
    outline(ctx, 3);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.2, r * 0.45, r * 0.36, 0, Math.PI, 0);
    ctx.fillStyle = 'rgba(160,230,255,0.8)';
    ctx.fill();
    outline(ctx, 3);
    // the pilot: green, two stalk eyes, unimpressed
    ball(ctx, 0, -r * 0.28, r * 0.16, '#7fbf5a', { line: 2 });
    ctx.strokeStyle = '#476b33';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.08, -r * 0.42); ctx.lineTo(-r * 0.12, -r * 0.52);
    ctx.moveTo(r * 0.08, -r * 0.42); ctx.lineTo(r * 0.12, -r * 0.52);
    ctx.stroke();
    ctx.fillStyle = '#12100d';
    ctx.beginPath();
    ctx.ellipse(-r * 0.06, -r * 0.3, r * 0.035, r * 0.05, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.06, -r * 0.3, r * 0.035, r * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = -2; i <= 2; i++) {
      ball(ctx, i * r * 0.32, r * 0.22, r * 0.075, i === 0 ? '#ffd26a' : '#ff6a6a', { line: 1.5 });
    }
  },
  /** The work barge: boxy, striped, a hook still swinging under it. */
  hauler(ctx, r, age) {
    block(ctx, -r, -r * 0.3, r * 2, r * 0.62, '#5a6068', { r: 6 });
    ctx.fillStyle = '#c8742f';                             // cargo stripes
    ctx.fillRect(-r * 0.85, -r * 0.28, r * 0.22, r * 0.56);
    ctx.fillRect(r * 0.6, -r * 0.28, r * 0.22, r * 0.56);
    block(ctx, -r * 0.34, -r * 0.62, r * 0.68, r * 0.4, '#454b53', { r: 4 });   // the cab
    ctx.fillStyle = 'rgba(160,230,255,0.85)';              // its window, pilot inside
    ctx.fillRect(-r * 0.24, -r * 0.56, r * 0.48, r * 0.22);
    ball(ctx, 0, -r * 0.44, r * 0.1, '#7fbf5a', { line: 1.5 });
    // thruster pods and the hook that does the dropping
    for (const sx of [-0.72, 0.72]) {
      block(ctx, sx * r - r * 0.12, r * 0.3, r * 0.24, r * 0.2, '#3a4046', { r: 3, line: 2 });
    }
    const sway = Math.sin(age * 3) * r * 0.1;
    ctx.strokeStyle = '#2b333c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.32);
    ctx.lineTo(sway, r * 0.62);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sway, r * 0.7, r * 0.1, -0.5, Math.PI + 0.5);
    ctx.stroke();
    ball(ctx, -r * 0.95, -r * 0.34, r * 0.07, '#ff6a6a', { line: 1.5 });   // beacons
    ball(ctx, r * 0.95, -r * 0.34, r * 0.07, '#8fd07a', { line: 1.5 });
  },
  /** The grown one: a translucent bell that swims, trailing tentacles. */
  jelly(ctx, r, age) {
    const squish = 1 + Math.sin(age * 4) * 0.06;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * squish, r * 0.62 / squish, 0, Math.PI, 0);
    ctx.fillStyle = 'rgba(120, 200, 190, 0.75)';
    ctx.fill();
    outline(ctx, 3);
    ctx.restore();
    for (let i = -2; i <= 2; i++) {                        // the tentacles, rowing
      const wave = Math.sin(age * 5 + i) * r * 0.14;
      ctx.strokeStyle = 'rgba(90,160,150,0.9)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(i * r * 0.32, r * 0.02);
      ctx.quadraticCurveTo(i * r * 0.36 + wave, r * 0.4, i * r * 0.3 + wave * 1.6, r * 0.66);
      ctx.stroke();
    }
    ball(ctx, 0, -r * 0.14, r * 0.2, '#ffd26a', { line: 2 });   // the core it drops from
    ctx.fillStyle = '#12100d';                             // one big eye
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.14, r * 0.08, r * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  /** The scout: a chrome marble on three prongs, sweeping a searchlight. */
  scout(ctx, r, age) {
    ctx.save();                                            // the light first, behind
    ctx.globalAlpha = 0.22 + Math.sin(age * 6) * 0.06;
    const sweep = Math.sin(age * 1.6) * r * 0.5;
    polygon(ctx, [[0, r * 0.2], [sweep - r * 0.5, r * 1.9], [sweep + r * 0.5, r * 1.9]], '#fff3b8', 0);
    ctx.restore();
    for (const a of [-0.7, 0, 0.7]) {                      // three landing prongs
      ctx.strokeStyle = '#2b333c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * r * 0.5, r * 0.1);
      ctx.lineTo(Math.sin(a) * r * 0.85, r * 0.75);
      ctx.stroke();
    }
    ball(ctx, 0, -r * 0.1, r * 0.62, '#aeb8c2');
    ctx.beginPath();                                       // a visor slit, not a dome
    ctx.ellipse(0, -r * 0.14, r * 0.4, r * 0.13, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1d2a33';
    ctx.fill();
    outline(ctx, 2);
    ball(ctx, Math.sin(age * 4) * r * 0.26, -r * 0.14, r * 0.07, '#ff5d5d', { line: 0 });   // the eye, scanning
    ball(ctx, 0, r * 0.42, r * 0.09, '#ffd26a', { line: 1.5 });
  },
};

/** Anything the manifest gains without a drawing still shows up as a crate. */
export function drawCargo(ctx, o) {
  const art = CARGO_ART[o.def.id] || CARGO_ART.crate;
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.spin) ctx.rotate(o.spin);
  art(ctx, o.r, o);
  ctx.restore();

  if (o.frozen > 0) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ball(ctx, o.x, o.y, o.r * 1.05, '#bfeaff', { line: 2 });
    ctx.restore();
  }
  if (o.burning > 0) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    for (let i = 0; i < 3; i++) {
      const t = (o.age * 6 + i) % 1;
      ball(ctx, o.x + Math.sin(o.age * 9 + i) * o.r * 0.4, o.y - o.r * (0.6 + t), o.r * 0.3 * (1 - t), '#ff9a3c', { line: 0 });
    }
    ctx.restore();
  }
  if (o.hit > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.8, o.hit * 5);
    ctx.globalCompositeOperation = 'lighter';
    ball(ctx, o.x, o.y, o.r, '#fff', { line: 0 });
    ctx.restore();
  }
  // the health bar only shows up for what really needs several shots
  if (o.maxHp >= 8 && o.hp < o.maxHp && !o.def.ufo) {
    const w = o.r * 1.6;
    ctx.fillStyle = 'rgba(10,8,6,0.65)';
    ctx.fillRect(o.x - w / 2, o.y - o.r - 14, w, 6);
    ctx.fillStyle = o.hp / o.maxHp > 0.4 ? '#8fd07a' : '#e2593f';
    ctx.fillRect(o.x - w / 2, o.y - o.r - 14, w * (o.hp / o.maxHp), 6);
  }
}
