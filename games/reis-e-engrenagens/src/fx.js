// Sparks, smoke, dirt and the flash of a shell going off. Nothing in here
// changes the match — it is what the match looks like a quarter of a second
// after it decided something.

import { GRAVITY } from './config.js';
import { FLOOR_Y } from './terrain.js';

export function createFx() {
  const parts = [];
  const rings = [];
  const bolts = [];

  const add = (p) => {
    // a hard ceiling, because a chain collapse can ask for a thousand at once
    if (parts.length < 900) parts.push(p);
  };

  const fx = {
    parts,
    rings,
    bolts,

    /** The tesla coil jumping to metal — drawn as a jagged line, not a beam. */
    arc(x, y, tx, ty) {
      bolts.push({ x, y, tx, ty, life: 0.3, max: 0.3, seed: Math.random() * 1000 });
    },

    update(h, terrain) {
      for (let i = bolts.length - 1; i >= 0; i--) {
        bolts[i].life -= h;
        if (bolts[i].life <= 0) bolts.splice(i, 1);
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= h;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        p.vy += GRAVITY * p.gravity * h;
        p.vx *= 1 - p.drag * h;
        p.vy *= 1 - p.drag * h;
        p.x += p.vx * h;
        p.y += p.vy * h;
        p.spin += p.spinRate * h;
        if (p.bounce && terrain) {
          const g = Math.min(terrain.yAt(p.x), FLOOR_Y);
          if (p.y > g) {
            p.y = g;
            p.vy *= -0.32;
            p.vx *= 0.7;
            if (Math.abs(p.vy) < 20) p.bounce = false;
          }
        }
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        rings[i].life -= h;
        if (rings[i].life <= 0) rings.splice(i, 1);
      }
    },

    boom(x, y, radius, dust = '#8a6a45') {
      // A white flash for two frames. It is the cheapest thing in the whole file
      // and it is what makes a detonation read as a detonation rather than as a
      // ring appearing: the eye wants to be *hit* before it is shown anything.
      rings.push({ x, y, r: radius, life: 0.42, max: 0.42, flash: 0.12 });
      for (let i = 0; i < 34; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 60 + Math.random() * radius * 6;
        add({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
          life: 0.3 + Math.random() * 0.5, max: 0.8, size: 2 + Math.random() * 4,
          color: i % 3 === 0 ? '#ffd27a' : '#ff8a3a', gravity: 0.2, drag: 2.2, spin: 0, spinRate: 0, kind: 'spark',
        });
      }
      for (let i = 0; i < 22; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 30 + Math.random() * 70;
        add({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 70,
          life: 0.9 + Math.random() * 1.1, max: 2, size: 10 + Math.random() * 18,
          color: i % 4 ? '#4a4038' : '#6b5f52', gravity: -0.08, drag: 1.1, spin: 0, spinRate: 0, kind: 'smoke',
        });
      }
      for (let i = 0; i < 18; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        const v = 90 + Math.random() * 230;
        add({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          life: 0.8 + Math.random() * 0.8, max: 1.6, size: 2 + Math.random() * 3,
          color: dust, gravity: 1, drag: 0.2, spin: 0, spinRate: 0, kind: 'dirt', bounce: true,
        });
      }
    },

    /** A block coming apart: chips in the material's own colour. */
    shards(x, y, color, n = 12) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 50 + Math.random() * 190;
        add({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90,
          life: 0.7 + Math.random() * 0.9, max: 1.6, size: 3 + Math.random() * 6,
          color, gravity: 1, drag: 0.15, spin: Math.random() * 6, spinRate: (Math.random() - 0.5) * 14,
          kind: 'chip', bounce: true,
        });
      }
    },

    /** The lick of flame on a burning wall, one puff a frame. */
    flame(x, y) {
      add({
        x: x + (Math.random() - 0.5) * 18, y, vx: (Math.random() - 0.5) * 22, vy: -50 - Math.random() * 60,
        life: 0.3 + Math.random() * 0.35, max: 0.65, size: 4 + Math.random() * 7,
        color: Math.random() < 0.5 ? '#ffb03a' : '#ff6a20', gravity: -0.12, drag: 1.4, spin: 0, spinRate: 0,
        kind: 'flame',
      });
    },

    rust(x, y) {
      add({
        x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 14, vy: 16 + Math.random() * 26,
        life: 0.5 + Math.random() * 0.5, max: 1, size: 2 + Math.random() * 3,
        color: '#b6642a', gravity: 0.3, drag: 0.8, spin: 0, spinRate: 0, kind: 'chip',
      });
    },

    trail(x, y, color, size = 3) {
      add({
        x, y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
        life: 0.22 + Math.random() * 0.2, max: 0.42, size, color,
        gravity: -0.03, drag: 2, spin: 0, spinRate: 0, kind: 'smoke',
      });
    },

    clear() {
      parts.length = 0;
      rings.length = 0;
      bolts.length = 0;
    },
  };

  return fx;
}
