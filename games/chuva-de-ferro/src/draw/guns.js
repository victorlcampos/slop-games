// One drawing per gun — because a soldier who picks up a flamethrower and
// keeps holding the same rifle silhouette is a soldier holding a rumour.
//
// Every painter draws in the arm's frame: origin at the shoulder pivot, +x down
// the barrel, y positive under it (the caller flips for facing). Besides the
// drawing, each entry says where the muzzle flash comes out (`tip`) and where
// the two hands go (`grips`) — a minigun is not held where a pistol-grip SMG
// is, and hands floating off the gun were half of what made every weapon feel
// like the same weapon.

import { ball, block, polygon } from './paint.js';

const WOOD = '#4a3c2a';
const STEEL = '#3d434a';
const DARK = '#2f353b';
const OLIVE = '#4f5b3d';
const GLOW = (ctx, x, y, r, colour) => {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ball(ctx, x, y, r, colour, { line: 0 });
  ctx.restore();
};

export const GUN_ART = {
  rifle: {
    tip: 84, grips: [[30, 6], [56, 2]],
    draw(ctx) {
      block(ctx, 4, -4, 26, 9, WOOD, { r: 2 });                       // stock
      block(ctx, 22, -6, 40, 11, STEEL, { r: 3 });                    // receiver
      block(ctx, 56, -3, 28, 6, DARK, { r: 2 });                      // barrel
      block(ctx, 34, 4, 10, 14, DARK, { r: 2, line: 2 });             // magazine
      block(ctx, 48, -9, 12, 4, DARK, { r: 1, line: 2 });             // sight
    },
  },
  smg: {
    tip: 62, grips: [[28, 8], [46, 3]],
    draw(ctx) {
      ctx.strokeStyle = DARK; ctx.lineWidth = 5;                      // wire stock
      ctx.beginPath(); ctx.moveTo(24, -2); ctx.lineTo(8, -6); ctx.lineTo(8, 6); ctx.stroke();
      block(ctx, 22, -6, 30, 12, '#464d55', { r: 3 });                // stubby body
      block(ctx, 50, -3, 14, 6, DARK, { r: 2 });                      // snub barrel
      block(ctx, 30, 5, 8, 20, DARK, { r: 2, line: 2 });              // long stick mag
      ball(ctx, 58, 0, 4, '#22262b', { line: 2 });                    // muzzle can
    },
  },
  shotgun: {
    tip: 88, grips: [[26, 7], [56, 4]],
    draw(ctx) {
      block(ctx, 2, -4, 26, 10, '#5c4426', { r: 3 });                 // wooden stock
      block(ctx, 24, -5, 34, 9, STEEL, { r: 3 });                     // receiver
      block(ctx, 54, -5, 34, 6, DARK, { r: 2 });                      // long tube
      block(ctx, 50, 2, 24, 7, '#5c4426', { r: 3 });                  // pump under it
      ball(ctx, 88, -2, 4, '#22262b', { line: 2 });                   // the bore, wide
    },
  },
  mg: {
    tip: 92, grips: [[30, 8], [58, 4]],
    draw(ctx) {
      block(ctx, 4, -4, 24, 9, STEEL, { r: 2 });
      block(ctx, 22, -8, 44, 15, '#40474f', { r: 3 });                // big boxy receiver
      block(ctx, 62, -4, 30, 7, DARK, { r: 2 });                      // heavy barrel
      block(ctx, 66, -8, 18, 3, DARK, { r: 1, line: 2 });             // carry handle
      // the belt of rounds hanging out of it
      for (let i = 0; i < 4; i++) block(ctx, 34 + i * 5, 8 + i * 3, 4, 8, '#c8a63a', { r: 1, line: 1.5 });
      ctx.strokeStyle = DARK; ctx.lineWidth = 3;                      // folded bipod
      ctx.beginPath(); ctx.moveTo(70, 3); ctx.lineTo(60, 12); ctx.stroke();
    },
  },
  minigun: {
    tip: 96, grips: [[26, 10], [52, 8]],
    draw(ctx) {
      block(ctx, 8, -10, 30, 22, '#3a4148', { r: 5 });                // motor housing
      ball(ctx, 14, -2, 5, '#c8a63a', { line: 2 });                   // the spin motor
      for (const dy of [-8, -1, 6]) block(ctx, 36, dy, 56, 5, dy === -1 ? '#50575f' : DARK, { r: 2, line: 2 });
      block(ctx, 88, -10, 6, 20, STEEL, { r: 2, line: 2 });           // front ring
      block(ctx, 40, 10, 14, 10, DARK, { r: 2, line: 2 });            // fore handle
    },
  },
  marksman: {
    tip: 108, grips: [[28, 7], [66, 2]],
    draw(ctx) {
      polygon(ctx, [[2, -2], [26, -5], [26, 7], [6, 9]], WOOD, 2.5);  // angled stock
      block(ctx, 24, -5, 40, 9, STEEL, { r: 2 });
      block(ctx, 62, -2.5, 46, 5, DARK, { r: 2 });                    // long thin barrel
      block(ctx, 32, -12, 22, 6, DARK, { r: 3, line: 2 });            // the scope
      ball(ctx, 33, -9, 3, '#9fd8ff', { line: 1.5 });                 // its glass
      block(ctx, 104, -4, 5, 8, DARK, { r: 1, line: 2 });             // muzzle brake
    },
  },
  railgun: {
    tip: 100, grips: [[28, 9], [58, 6]],
    draw(ctx) {
      block(ctx, 4, -8, 26, 18, '#333a44', { r: 4 });                 // capacitor bank
      block(ctx, 28, -7, 30, 13, STEEL, { r: 3 });
      block(ctx, 56, -7, 44, 4, '#50575f', { r: 1, line: 2 });        // top rail
      block(ctx, 56, 2, 44, 4, '#50575f', { r: 1, line: 2 });         // bottom rail
      for (const x of [62, 76, 90]) GLOW(ctx, x, 0, 4.5, '#9ce7ff');  // the charge, riding the gap
      ball(ctx, 16, -2, 4, '#9ce7ff', { line: 1.5 });                 // charge light
    },
  },
  rocket: {
    tip: 92, grips: [[30, 10], [56, 8]],
    draw(ctx) {
      block(ctx, 2, -10, 88, 16, OLIVE, { r: 7 });                    // the tube
      polygon(ctx, [[88, -12], [96, -14], [96, 12], [88, 10]], '#3f4a30', 2.5);  // bell
      polygon(ctx, [[2, -12], [-6, -14], [-6, 12], [2, 10]], '#3f4a30', 2.5);    // back blast
      block(ctx, 34, -16, 16, 7, DARK, { r: 2, line: 2 });            // sight box
      ball(ctx, 80, -2, 6, '#c8443c', { line: 2 });                   // the round's nose
    },
  },
  grenade: {
    tip: 70, grips: [[26, 8], [50, 4]],
    draw(ctx) {
      block(ctx, 2, -4, 24, 10, WOOD, { r: 3 });                      // stock
      ball(ctx, 36, 0, 12, '#464d55', { line: 2.5 });                 // revolver drum
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        ball(ctx, 36 + Math.cos(a) * 6, Math.sin(a) * 6, 2.5, '#22262b', { line: 1 });
      }
      block(ctx, 46, -5, 26, 10, DARK, { r: 4 });                     // fat short barrel
      ball(ctx, 70, 0, 5, '#22262b', { line: 2 });
    },
  },
  flak: {
    tip: 86, grips: [[28, 9], [54, 6]],
    draw(ctx) {
      block(ctx, 6, -6, 30, 14, '#40474f', { r: 3 });
      block(ctx, 34, -7, 52, 5, DARK, { r: 2, line: 2 });             // twin barrels
      block(ctx, 34, 2, 52, 5, DARK, { r: 2, line: 2 });
      ball(ctx, 24, -12, 7, '#565e67', { line: 2 });                  // the fuse radar
      ctx.strokeStyle = '#ffd0d0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(24, -12, 4, -1.2, 1.2); ctx.stroke();
      block(ctx, 40, 8, 16, 9, STEEL, { r: 2, line: 2 });             // shell box
    },
  },
  flamer: {
    tip: 78, grips: [[28, 9], [52, 6]],
    draw(ctx) {
      block(ctx, 4, -2, 22, 16, '#b3462f', { r: 5 });                 // the fuel tank
      ctx.fillStyle = 'rgba(20,16,12,0.5)'; ctx.fillRect(6, 4, 18, 3);
      ctx.strokeStyle = '#22262b'; ctx.lineWidth = 4;                 // the hose
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.quadraticCurveTo(24, -12, 36, -4); ctx.stroke();
      block(ctx, 30, -5, 34, 10, STEEL, { r: 3 });
      block(ctx, 62, -4, 14, 8, '#22262b', { r: 3, line: 2 });        // wide nozzle
      GLOW(ctx, 78, 0, 4, '#ff9a3c');                                 // the pilot light
    },
  },
  laser: {
    tip: 88, grips: [[28, 7], [54, 3]],
    draw(ctx) {
      polygon(ctx, [[4, -3], [24, -6], [24, 8], [8, 8]], '#4a3f55', 2.5);
      block(ctx, 22, -6, 42, 11, '#5a4f66', { r: 4 });                // sleek body
      polygon(ctx, [[40, -10], [54, -10], [48, -4]], '#4a3f55', 2);   // the fin
      block(ctx, 62, -3, 22, 6, '#3d3547', { r: 3 });
      GLOW(ctx, 86, 0, 5, '#ff5d7a');                                 // emitter crystal
    },
  },
  plasma: {
    tip: 84, grips: [[28, 8], [56, 5]],
    draw(ctx) {
      block(ctx, 6, -5, 24, 11, STEEL, { r: 3 });
      ball(ctx, 42, 0, 13, '#3a4652', { line: 2.5 });                 // the chamber
      GLOW(ctx, 42, 0, 7, '#8ad8ff');                                 // what it holds
      block(ctx, 54, -4, 22, 8, DARK, { r: 3 });
      polygon(ctx, [[76, -7], [84, 0], [76, 7]], '#3a4652', 2);       // flared emitter
    },
  },
  chain: {
    tip: 84, grips: [[26, 8], [52, 4]],
    draw(ctx) {
      block(ctx, 4, -4, 24, 10, STEEL, { r: 3 });
      block(ctx, 26, -6, 34, 12, '#403a55', { r: 4 });                // coil body
      for (const x of [32, 42, 52]) {                                 // the windings
        ctx.strokeStyle = '#c9b6ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, 0, 7, -1.9, 1.9); ctx.stroke();
      }
      polygon(ctx, [[60, -6], [82, -10], [70, -1]], STEEL, 2);        // the fork, two prongs
      polygon(ctx, [[60, 6], [82, 10], [70, 1]], STEEL, 2);
      GLOW(ctx, 74, 0, 4, '#c9b6ff');                                 // the arc waiting
    },
  },
  cryo: {
    tip: 80, grips: [[28, 8], [54, 4]],
    draw(ctx) {
      block(ctx, 6, -4, 26, 10, STEEL, { r: 3 });
      block(ctx, 26, -12, 26, 8, '#3a5a70', { r: 4, line: 2 });       // coolant tank on top
      ctx.fillStyle = '#a9e6ff'; ctx.fillRect(30, -10, 18, 4);        // the blue inside
      block(ctx, 30, -5, 34, 10, '#46606f', { r: 3 });
      block(ctx, 62, -3, 16, 6, '#2e4552', { r: 2 });
      for (const x of [64, 70, 76]) polygon(ctx, [[x, 3], [x + 2, 10], [x + 4, 3]], '#a9e6ff', 1.5);  // icicles
    },
  },
  acid: {
    tip: 80, grips: [[28, 8], [54, 4]],
    draw(ctx) {
      block(ctx, 4, -4, 26, 10, '#4a4d33', { r: 3 });
      block(ctx, 28, -6, 36, 12, '#565a3a', { r: 3 });
      block(ctx, 34, -12, 18, 8, '#3a4a2a', { r: 4, line: 2 });       // the vial
      ctx.fillStyle = '#9dff7a'; ctx.fillRect(37, -10, 12, 4);        // what is in it
      block(ctx, 62, -3, 18, 6, DARK, { r: 2 });
      ctx.fillStyle = '#c8a63a';                                      // hazard stripes
      for (const x of [30, 40, 50]) ctx.fillRect(x, 3, 5, 3);
      GLOW(ctx, 80, 2, 3, '#9dff7a');                                 // the drip
    },
  },
  nailer: {
    tip: 74, grips: [[28, 8], [50, 4]],
    draw(ctx) {
      block(ctx, 8, -6, 40, 14, '#b3752f', { r: 4 });                 // work-site orange
      ctx.fillStyle = 'rgba(20,16,12,0.4)'; ctx.fillRect(10, -4, 36, 3);
      block(ctx, 46, -3, 26, 7, STEEL, { r: 2 });
      block(ctx, 30, 8, 26, 8, '#8a8f96', { r: 1, line: 2 });         // the nail strip
      ctx.strokeStyle = '#22262b'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(34 + i * 4, 9); ctx.lineTo(34 + i * 4, 15); ctx.stroke(); }
    },
  },
  ricochet: {
    tip: 76, grips: [[28, 7], [52, 3]],
    draw(ctx) {
      block(ctx, 4, -4, 26, 9, WOOD, { r: 2 });
      block(ctx, 26, -6, 34, 11, STEEL, { r: 3 });
      block(ctx, 58, -3, 14, 6, DARK, { r: 2 });
      polygon(ctx, [[70, -8], [80, -2], [70, 1]], '#c8a63a', 2);      // the deflector vanes
      polygon(ctx, [[70, 8], [80, 4], [70, 1]], '#c8a63a', 2);
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2;                 // the promise of the bounce
      ctx.beginPath(); ctx.moveTo(60, -8); ctx.lineTo(66, -12); ctx.lineTo(72, -9); ctx.stroke();
    },
  },
  swarm: {
    tip: 82, grips: [[30, 10], [54, 8]],
    draw(ctx) {
      block(ctx, 6, -2, 24, 10, STEEL, { r: 3 });
      block(ctx, 28, -14, 52, 26, '#4a505a', { r: 4 });               // the box launcher
      for (const [bx, by] of [[38, -8], [62, -8], [38, 4], [62, 4]]) {
        block(ctx, bx, by, 14, 8, '#22262b', { r: 3, line: 2 });      // four tubes
        ball(ctx, bx + 7, by + 4, 2.5, '#ffb3f0', { line: 0 });       // a needle in each
      }
      ctx.strokeStyle = '#9aa2ac'; ctx.lineWidth = 2;                 // the seeker antenna
      ctx.beginPath(); ctx.moveTo(30, -14); ctx.lineTo(24, -22); ctx.stroke();
      ball(ctx, 24, -22, 2.5, '#ffb3f0', { line: 1 });
    },
  },
  emp: {
    tip: 84, grips: [[28, 8], [52, 5]],
    draw(ctx) {
      block(ctx, 6, -5, 26, 11, '#333a44', { r: 3 });
      block(ctx, 30, -6, 30, 12, '#3a4652', { r: 4 });
      ctx.strokeStyle = '#9ff0ff'; ctx.lineWidth = 2.5;               // the coil windings
      for (const x of [36, 44, 52]) { ctx.beginPath(); ctx.arc(x, 0, 7, -2, 2); ctx.stroke(); }
      ctx.strokeStyle = '#2b333c'; ctx.lineWidth = 4;                 // the ring emitter
      ctx.beginPath(); ctx.arc(74, 0, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#9ff0ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(74, 0, 10, 0, Math.PI * 2); ctx.stroke();
      GLOW(ctx, 74, 0, 4, '#9ff0ff');
    },
  },
};

/** The gun in the soldier's hands — unknown ids fall back to the rifle. */
export function gunOf(id) {
  return GUN_ART[id] || GUN_ART.rifle;
}
