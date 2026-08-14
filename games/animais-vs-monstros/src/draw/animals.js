// The 19 animals, drawn one by one. They all face right, which is where the
// trouble comes from. A 128x128 box, ground at y=120, centre at x=64.

import { shape, ellipse, circle, line, stroke, ellipsePoints, sprite, volume } from '../scribble.js';
import { INK, COLORS, shade } from '../palette.js';
import {
  OUTLINE, body, eye, evilEye, pointedEar, roundEar, paw,
  tail, fuzz, spots, stripes, wing, teeth,
} from './common.js';

const P = OUTLINE;

const drawings = {
  // ----------------------------------------------------------------- squirrel
  squirrel(ctx, s) {
    const color = '#c47a42';
    tail(ctx, [[40, 108], [16, 92], [12, 58], [34, 34], [52, 44]], 22, color, s);
    fuzz(ctx, 26, 66, 20, 30, shade(color, -0.2), s + 9, 10, 6);
    paw(ctx, 52, 120, 16, 10, shade(color, -0.15), s + 1);
    paw(ctx, 74, 120, 16, 10, shade(color, -0.15), s + 2);
    body(ctx, 64, 88, 26, 30, color, s + 3);
    shape(ctx, ellipsePoints(66, 96, 17, 20, 12), { color: null, fill: '#e8cba4', seed: s + 4 });
    pointedEar(ctx, 56, 52, 16, color, s + 5, -0.25);
    pointedEar(ctx, 76, 50, 16, color, s + 6, 0.15);
    body(ctx, 68, 58, 22, 21, color, s + 7);
    shape(ctx, ellipsePoints(76, 64, 12, 11, 10), { color: null, fill: '#e8cba4', seed: s + 8 });
    eye(ctx, 78, 54, 6, s + 10, { look: [0.5, 0] });
    eye(ctx, 62, 55, 5.5, s + 11, { look: [0.5, 0] });
    circle(ctx, 88, 62, 3.5, { color: null, fill: INK, seed: s + 12 });
    // the nut in its hands
    ellipse(ctx, 84, 84, 10, 9, { ...P, width: 2.2, fill: '#a9713c', seed: s + 13 });
    shape(ctx, [[76, 80], [92, 80], [90, 74], [78, 74]], { color: null, fill: '#7d4f28', seed: s + 14 });
  },

  // ------------------------------------------------------------------- monkey
  monkey(ctx, s) {
    const color = '#8e6244';
    tail(ctx, [[44, 96], [22, 96], [14, 74], [26, 62], [36, 72]], 9, color, s);
    paw(ctx, 52, 120, 17, 12, shade(color, -0.15), s + 1);
    paw(ctx, 76, 120, 17, 12, shade(color, -0.15), s + 2);
    body(ctx, 64, 90, 27, 28, color, s + 3);
    shape(ctx, ellipsePoints(66, 94, 18, 20, 12), { color: null, fill: '#d9b088', seed: s + 4 });
    roundEar(ctx, 44, 56, 10, color, s + 5);
    roundEar(ctx, 86, 56, 10, color, s + 6);
    body(ctx, 65, 56, 24, 23, color, s + 7);
    shape(ctx, ellipsePoints(68, 60, 17, 17, 12), { color: null, fill: '#e5c39c', seed: s + 8 });
    eye(ctx, 60, 53, 6, s + 9, { look: [0.6, 0] });
    eye(ctx, 76, 53, 6, s + 10, { look: [0.6, 0] });
    ellipse(ctx, 68, 66, 5, 3.5, { color: INK, width: 1.8, fill: '#b98a63', seed: s + 11 });
    stroke(ctx, [[60, 72], [68, 76], [76, 72]], { color: INK, width: 2, seed: s + 12 });
    // the coconut
    circle(ctx, 92, 88, 12, { ...P, width: 2.4, fill: '#6b4a2f', seed: s + 13 });
    circle(ctx, 88, 84, 2.5, { color: null, fill: '#3d2a1a', seed: s + 14 });
    circle(ctx, 95, 85, 2.5, { color: null, fill: '#3d2a1a', seed: s + 15 });
  },

  // ------------------------------------------------------------------ tanuki
  tanuki(ctx, s) {
    const coat = '#8e6e4e';
    const belly = '#e8cba4';
    // the striped tail resting on the ground
    tail(ctx, [[86, 108], [108, 104], [118, 90]], 16, coat, s);
    circle(ctx, 114, 90, 7, { color: null, fill: '#4a3b30', seed: s + 1 });
    paw(ctx, 50, 120, 16, 10, '#4a3b30', s + 2);
    paw(ctx, 76, 120, 16, 10, '#4a3b30', s + 3);
    // the round body with the big pale belly — a tanuki is mostly belly
    body(ctx, 64, 86, 30, 32, coat, s + 4);
    shape(ctx, ellipsePoints(64, 94, 21, 23, 12), { color: null, fill: belly, seed: s + 5 });
    stroke(ctx, [[54, 92], [64, 96], [74, 92]], { color: shade(belly, -0.25), width: 1.8, passes: 1, seed: s + 6 });
    // little arms folded over the belly
    stroke(ctx, [[46, 76], [40, 88]], { color: coat, width: 6, seed: s + 7 });
    stroke(ctx, [[82, 76], [88, 88]], { color: coat, width: 6, seed: s + 8 });
    // head with the bandit mask
    body(ctx, 64, 52, 23, 20, coat, s + 9);
    pointedEar(ctx, 50, 36, 13, coat, s + 10, -0.3);
    pointedEar(ctx, 78, 36, 13, coat, s + 11, 0.25);
    shape(ctx, ellipsePoints(54, 52, 10, 7, 10), { color: null, fill: '#4a3b30', seed: s + 12 });
    shape(ctx, ellipsePoints(76, 52, 10, 7, 10), { color: null, fill: '#4a3b30', seed: s + 13 });
    eye(ctx, 56, 52, 5, s + 14, { look: [0.5, 0] });
    eye(ctx, 74, 52, 5, s + 15, { look: [0.5, 0] });
    circle(ctx, 66, 62, 3.5, { color: null, fill: INK, seed: s + 16 });
    stroke(ctx, [[60, 68], [66, 71], [72, 68]], { color: INK, width: 2, seed: s + 17 });
    // the transformation leaf on his brow — the whole trick lives up there
    shape(ctx, [[62, 34], [56, 22], [66, 14], [74, 24], [68, 34]], {
      color: '#3f6b38', width: 2, fill: '#6f9b52', seed: s + 18,
    });
    line(ctx, 66, 32, 66, 18, { color: '#3f6b38', width: 1.6, passes: 1, seed: s + 19 });
  },

  // ------------------------------------------------------------------- crane
  crane(ctx, s) {
    const white = '#f5efe3';
    // long black legs, one raised mid-dance
    stroke(ctx, [[58, 88], [56, 106], [56, 122]], { color: '#2f2822', width: 3.5, seed: s + 1 });
    stroke(ctx, [[70, 88], [76, 100], [72, 108]], { color: '#2f2822', width: 3.5, seed: s + 2 });
    stroke(ctx, [[52, 122], [62, 122]], { color: '#2f2822', width: 2.5, seed: s + 3 });
    // body with black trailing feathers
    body(ctx, 64, 74, 28, 20, white, s + 4);
    shape(ctx, [[84, 66], [112, 58], [116, 74], [90, 82]], { ...P, width: 2.4, fill: '#2f2822', seed: s + 5 });
    // one wing open — the dance
    shape(ctx, [[58, 62], [30, 38], [14, 44], [40, 66], [56, 72]], { ...P, width: 2.4, fill: white, seed: s + 6 });
    shape(ctx, [[22, 42], [14, 44], [28, 56], [34, 52]], { color: null, fill: '#2f2822', seed: s + 7 });
    // the S neck, the red crown, the long beak
    stroke(ctx, [[62, 62], [76, 44], [72, 26], [62, 18]], { color: white, width: 8, seed: s + 8 });
    body(ctx, 60, 16, 11, 9, white, s + 9);
    shape(ctx, [[50, 14], [30, 18], [50, 21]], { ...P, width: 2, fill: '#e5b93c', seed: s + 10 });
    circle(ctx, 62, 8, 5, { color: '#8a3a30', width: 1.8, fill: '#c1503f', seed: s + 11 });
    eye(ctx, 55, 15, 3.5, s + 12, { look: [0.5, 0] });
    stroke(ctx, [[66, 22], [74, 28]], { color: '#2f2822', width: 2, passes: 1, seed: s + 13 });
  },

  // -------------------------------------------------------------- snowmonkey
  snowmonkey(ctx, s) {
    const coat = '#d9cfc0';
    // steam curling up: he brought the hot spring with him
    for (let i = 0; i < 3; i++) {
      stroke(ctx, [[34 + i * 30, 116], [28 + i * 30, 100], [36 + i * 30, 86], [30 + i * 30, 72]], {
        color: 'rgba(220, 228, 232, 0.6)', width: 3, passes: 1, seed: s + 30 + i,
      });
    }
    // sitting low in his thick winter coat
    body(ctx, 64, 88, 32, 28, coat, s + 1);
    fuzz(ctx, 64, 88, 32, 28, shade(coat, -0.18), s + 2, 16, 7);
    paw(ctx, 48, 120, 15, 9, shade(coat, -0.2), s + 3);
    paw(ctx, 80, 120, 15, 9, shade(coat, -0.2), s + 4);
    // arms hugging a fresh snowball
    stroke(ctx, [[44, 80], [40, 94], [50, 102]], { color: coat, width: 7, seed: s + 5 });
    stroke(ctx, [[84, 80], [90, 94], [80, 102]], { color: coat, width: 7, seed: s + 6 });
    circle(ctx, 66, 100, 12, { color: '#9fc4d4', width: 2.2, fill: '#eef6f8', seed: s + 7 });
    circle(ctx, 62, 96, 3.5, { color: null, fill: '#ffffff', seed: s + 8 });
    // head with snow piled on top and the famous red face
    body(ctx, 64, 52, 24, 21, coat, s + 9);
    fuzz(ctx, 64, 46, 24, 14, shade(coat, -0.15), s + 10, 10, 6);
    shape(ctx, [[44, 40], [84, 38], [80, 30], [48, 32]], { color: null, fill: '#eef6f8', seed: s + 11 });
    shape(ctx, ellipsePoints(64, 58, 15, 14, 12), { color: shade('#c1636f', -0.2), width: 2, fill: '#c1636f', seed: s + 12 });
    eye(ctx, 58, 54, 5, s + 13, { look: [0.5, 0] });
    eye(ctx, 72, 54, 5, s + 14, { look: [0.5, 0] });
    circle(ctx, 65, 63, 2.5, { color: null, fill: INK, seed: s + 15 });
    stroke(ctx, [[60, 68], [66, 70], [72, 67]], { color: INK, width: 2, seed: s + 16 });
  },

  // --------------------------------------------------------------------- koi
  koi(ctx, s) {
    const scale = '#e8853a';
    const belly = '#f6ebd8';
    // the arc of water she is leaping out of
    shape(ctx, ellipsePoints(64, 114, 44, 10, 14), { color: null, fill: 'rgba(109, 168, 196, 0.55)', seed: s + 1 });
    for (let i = 0; i < 4; i++) {
      circle(ctx, 30 + i * 24, 102 - (i % 2) * 12, 3 + (i % 2), {
        color: null, fill: 'rgba(180, 214, 228, 0.8)', seed: s + 30 + i,
      });
    }
    // the tail fan, kicked up behind
    shape(ctx, [[92, 62], [120, 44], [114, 66], [122, 86], [94, 76]], { ...P, width: 2.4, fill: '#f2b03c', seed: s + 2 });
    stroke(ctx, [[98, 62], [112, 54]], { color: shade('#f2b03c', -0.3), width: 1.6, passes: 1, seed: s + 3 });
    // body arched upward mid-leap
    body(ctx, 64, 66, 32, 22, scale, s + 4);
    shape(ctx, ellipsePoints(60, 74, 24, 11, 12), { color: null, fill: belly, seed: s + 5 });
    // the koi patches — every champion carp wears her own map
    circle(ctx, 52, 58, 8, { color: null, fill: belly, seed: s + 6 });
    circle(ctx, 76, 62, 7, { color: null, fill: '#c1503f', seed: s + 7 });
    // scales, a few strokes of them
    for (let i = 0; i < 3; i++) {
      stroke(ctx, [[54 + i * 12, 64], [60 + i * 12, 68], [54 + i * 12, 72]], {
        color: shade(scale, -0.25), width: 1.6, passes: 1, seed: s + 40 + i,
      });
    }
    // fins
    shape(ctx, [[56, 84], [44, 100], [66, 90]], { ...P, width: 2, fill: '#f2b03c', seed: s + 8 });
    shape(ctx, [[62, 48], [70, 34], [78, 48]], { ...P, width: 2, fill: '#f2b03c', seed: s + 9 });
    // face with barbels — spitting distance of a waterfall
    eye(ctx, 44, 58, 6, s + 10, { look: [0.5, 0] });
    circle(ctx, 34, 66, 4, { color: INK, width: 2, fill: '#3d2a1a', seed: s + 11 });
    stroke(ctx, [[34, 70], [28, 76]], { color: shade(scale, -0.3), width: 2, seed: s + 12 });
    stroke(ctx, [[38, 72], [36, 80]], { color: shade(scale, -0.3), width: 2, seed: s + 13 });
  },

  // ------------------------------------------------------------------- turtle
  turtle(ctx, s) {
    const shell = '#6f8f4a';
    paw(ctx, 44, 120, 16, 11, '#9ab36e', s + 1);
    paw(ctx, 84, 120, 16, 11, '#9ab36e', s + 2);
    // neck and head
    body(ctx, 96, 78, 15, 13, '#9ab36e', s + 3);
    shape(ctx, [[80, 88], [98, 84], [98, 96], [80, 98]], { ...P, fill: '#9ab36e', seed: s + 4 });
    eye(ctx, 100, 74, 5, s + 5, { look: [0.5, 0] });
    stroke(ctx, [[98, 84], [106, 83]], { color: INK, width: 2, seed: s + 6 });
    // the shell
    shape(ctx, ellipsePoints(60, 84, 40, 32, 16), { ...P, width: 3, fill: shell, seed: s + 7 });
    for (const [cx, cy, r] of [[60, 74, 13], [40, 88, 11], [60, 98, 11], [80, 88, 11], [44, 68, 8], [78, 68, 8]]) {
      shape(ctx, ellipsePoints(cx, cy, r, r * 0.85, 6), {
        color: shade(shell, -0.35), width: 2, fill: shade(shell, 0.12), seed: s + cx,
      });
    }
    shape(ctx, ellipsePoints(60, 84, 40, 32, 16), { ...P, width: 3, color: INK, seed: s + 7 });
  },

  // ---------------------------------------------------------------------- bee
  bee(ctx, s) {
    const color = '#e5b93c';
    wing(ctx, 58, 62, 40, 26, 'rgba(220, 238, 245, 0.75)', s + 1, -0.9);
    wing(ctx, 66, 64, 34, 22, 'rgba(220, 238, 245, 0.7)', s + 2, -0.35);
    body(ctx, 62, 84, 30, 25, color, s + 3);
    stripes(ctx, 62, 84, 30, 25, '#3c332a', s + 4, 3);
    shape(ctx, ellipsePoints(62, 84, 30, 25, 14), { ...P, width: 2.8, seed: s + 3 });
    // the stinger
    shape(ctx, [[32, 84], [18, 88], [32, 92]], { color: INK, width: 2, fill: '#4a423b', seed: s + 5 });
    body(ctx, 92, 78, 19, 18, shade(color, 0.12), s + 6);
    eye(ctx, 98, 72, 6, s + 7, { look: [0.5, 0] });
    eye(ctx, 86, 74, 5, s + 8, { look: [0.5, 0] });
    stroke(ctx, [[94, 84], [100, 88], [106, 84]], { color: INK, width: 2, seed: s + 9 });
    line(ctx, 92, 62, 86, 46, { color: INK, width: 2.2, seed: s + 10 });
    line(ctx, 100, 62, 106, 48, { color: INK, width: 2.2, seed: s + 11 });
    circle(ctx, 85, 44, 4, { color: null, fill: INK, seed: s + 12 });
    circle(ctx, 107, 46, 4, { color: null, fill: INK, seed: s + 13 });
  },

  // ----------------------------------------------------------------- hedgehog
  hedgehog(ctx, s) {
    const color = '#a8845c';
    // spines first, behind the body
    for (let i = 0; i < 22; i++) {
      const a = Math.PI * 1.05 + (i / 21) * Math.PI * 0.95;
      const x = 58 + Math.cos(a) * 36;
      const y = 88 + Math.sin(a) * 32;
      line(ctx, x, y, x + Math.cos(a) * 17, y + Math.sin(a) * 17, {
        color: '#5c4a33', width: 3.2, passes: 1, seed: s + i * 3,
      });
    }
    body(ctx, 58, 90, 38, 30, '#7d6547', s + 1);
    paw(ctx, 48, 120, 13, 9, '#c49a6a', s + 2);
    paw(ctx, 74, 120, 13, 9, '#c49a6a', s + 3);
    body(ctx, 94, 92, 19, 17, color, s + 4);
    shape(ctx, [[104, 86], [118, 94], [104, 100]], { ...P, width: 2.2, fill: color, seed: s + 5 });
    circle(ctx, 117, 94, 3.5, { color: null, fill: INK, seed: s + 6 });
    eye(ctx, 98, 86, 5, s + 7, { look: [0.6, 0] });
  },

  // ------------------------------------------------------------------- beaver
  beaver(ctx, s) {
    const color = '#8a5f3c';
    // flat tail
    shape(ctx, ellipsePoints(26, 100, 22, 13, 12), { ...P, fill: '#5f4530', seed: s + 1 });
    for (let i = -2; i <= 2; i++) {
      line(ctx, 12 + i * 2 + 14, 90, 12 + i * 2 + 14, 110, { color: '#3f2e20', width: 1.4, passes: 1, seed: s + i + 20 });
    }
    paw(ctx, 56, 120, 16, 11, shade(color, -0.15), s + 2);
    paw(ctx, 80, 120, 16, 11, shade(color, -0.15), s + 3);
    body(ctx, 66, 90, 30, 28, color, s + 4);
    shape(ctx, ellipsePoints(70, 96, 19, 19, 12), { color: null, fill: '#c69a6c', seed: s + 5 });
    body(ctx, 76, 60, 24, 22, color, s + 6);
    roundEar(ctx, 62, 46, 7, color, s + 7);
    roundEar(ctx, 88, 46, 7, color, s + 8);
    eye(ctx, 70, 55, 5.5, s + 9, { look: [0.6, 0] });
    eye(ctx, 86, 55, 5.5, s + 10, { look: [0.6, 0] });
    ellipse(ctx, 90, 66, 6, 4.5, { color: INK, width: 2, fill: '#5f4530', seed: s + 11 });
    // the teeth, which are the whole point of a beaver
    shape(ctx, [[80, 70], [92, 70], [92, 84], [80, 84]], { color: INK, width: 2, fill: '#f7f2e7', seed: s + 12 });
    line(ctx, 86, 70, 86, 84, { color: INK, width: 1.6, passes: 1, seed: s + 13 });
    // gnawed log
    ellipse(ctx, 36, 118, 18, 8, { ...P, width: 2.2, fill: '#7a5a3a', seed: s + 14 });
  },

  // ---------------------------------------------------------------------- bat
  bat(ctx, s) {
    const color = '#5b4a63';
    const membrane = '#7d6688';
    shape(ctx, [[62, 78], [26, 58], [16, 76], [30, 74], [24, 92], [42, 84], [58, 94]], {
      ...P, width: 2.4, fill: membrane, seed: s + 1,
    });
    shape(ctx, [[66, 78], [102, 58], [112, 76], [98, 74], [104, 92], [86, 84], [70, 94]], {
      ...P, width: 2.4, fill: membrane, seed: s + 2,
    });
    body(ctx, 64, 84, 17, 22, color, s + 3);
    shape(ctx, [[52, 52], [56, 30], [66, 48]], { ...P, width: 2.2, fill: color, seed: s + 4 });
    shape(ctx, [[76, 52], [72, 30], [62, 48]], { ...P, width: 2.2, fill: color, seed: s + 5 });
    body(ctx, 64, 60, 19, 17, color, s + 6);
    eye(ctx, 57, 57, 5, s + 7, { color: '#f2b03c', pupil: INK });
    eye(ctx, 71, 57, 5, s + 8, { color: '#f2b03c', pupil: INK });
    teeth(ctx, 58, 70, 70, 6, s + 9);
  },

  // ------------------------------------------------------------------ scorpion
  scorpion(ctx, s) {
    const color = '#9c6236';
    // legs first, so they sit behind the body
    for (let i = 0; i < 4; i++) {
      const x = 40 + i * 13;
      stroke(ctx, [[x, 100], [x - 8, 110], [x - 12, 122]], { color: INK, width: 3, seed: s + 20 + i });
      stroke(ctx, [[x + 4, 100], [x + 2, 92], [x - 4, 84]], { color: INK, width: 2.6, seed: s + 30 + i });
    }
    // the tail arcs overhead, from the rump to the stinger
    const p = [[36, 96], [20, 74], [26, 48], [48, 34], [72, 36]];
    tail(ctx, p, 12, color, s + 1);
    for (const [x, y] of p) circle(ctx, x, y, 8, { color: INK, width: 2, fill: shade(color, 0.12), seed: s + x });
    shape(ctx, [[72, 36], [92, 30], [76, 48]], { color: INK, width: 2.2, fill: '#3f2e20', seed: s + 2 });
    // flat, long body
    shape(ctx, ellipsePoints(62, 100, 34, 16, 14), { ...P, width: 2.8, fill: color, seed: s + 3 });
    for (let i = 0; i < 4; i++) {
      line(ctx, 40 + i * 14, 88, 40 + i * 14, 112, { color: shade(color, -0.35), width: 1.8, passes: 1, seed: s + 40 + i });
    }
    // big pincers up front
    for (const [px, py] of [[104, 90], [102, 110]]) {
      stroke(ctx, [[90, py - 4], [px - 10, py]], { color: INK, width: 4, seed: s + px });
      shape(
        ctx,
        [[px - 12, py - 9], [px + 8, py - 12], [px + 16, py - 3], [px + 4, py], [px + 16, py + 6], [px - 2, py + 9], [px - 12, py + 6]],
        { ...P, width: 2.4, fill: shade(color, 0.14), seed: s + px + 1 }
      );
    }
    evilEye(ctx, 76, 94, 4.5, s + 50, '#e0913a');
    evilEye(ctx, 66, 94, 4, s + 51, '#e0913a');
  },

  // ----------------------------------------------------------------- kangaroo
  kangaroo(ctx, s) {
    const color = '#b4794a';
    // thick tail resting on the ground, behind
    tail(ctx, [[48, 96], [24, 108], [8, 118]], 17, shade(color, -0.12), s + 1);
    // the L-shaped leg: high thigh and long foot on the ground — that is what
    // makes it read as a kangaroo
    shape(ctx, [[42, 70], [66, 68], [70, 96], [58, 104], [44, 100]], { ...P, width: 2.6, fill: shade(color, -0.1), seed: s + 2 });
    shape(ctx, [[46, 100], [62, 98], [88, 114], [86, 122], [44, 122]], { ...P, width: 2.6, fill: shade(color, -0.18), seed: s + 3 });
    // torso leaning forward
    shape(ctx, [[46, 52], [76, 44], [86, 72], [72, 92], [48, 88]], { ...P, width: 2.8, fill: color, seed: s + 4 });
    shape(ctx, ellipsePoints(68, 76, 14, 15, 12), { color: null, fill: '#dcb98d', seed: s + 5 });
    stroke(ctx, [[56, 72], [68, 82], [80, 72]], { color: shade(color, -0.32), width: 2.2, seed: s + 6 });
    // short little arms, tucked against the chest
    stroke(ctx, [[76, 56], [90, 62], [88, 70]], { color: INK, width: 4, seed: s + 7 });
    stroke(ctx, [[72, 58], [84, 66], [82, 74]], { color: INK, width: 3.6, seed: s + 8 });
    // long head, muzzle to the right
    shape(ctx, [[62, 30], [86, 26], [104, 38], [102, 48], [78, 50], [60, 44]], { ...P, width: 2.6, fill: color, seed: s + 9 });
    // long ears
    shape(ctx, [[64, 30], [58, 4], [72, 24]], { ...P, width: 2.2, fill: color, seed: s + 10 });
    shape(ctx, [[78, 28], [84, 2], [88, 26]], { ...P, width: 2.2, fill: color, seed: s + 11 });
    shape(ctx, [[80, 24], [83, 8], [86, 24]], { color: null, fill: shade(color, -0.3), seed: s + 12 });
    eye(ctx, 84, 36, 5.5, s + 13, { look: [0.6, 0] });
    circle(ctx, 103, 42, 3.5, { color: null, fill: INK, seed: s + 14 });
    stroke(ctx, [[92, 48], [100, 47]], { color: INK, width: 2, seed: s + 15 });
  },

  // -------------------------------------------------------------------- skunk
  skunk(ctx, s) {
    const color = '#3c3630';
    tail(ctx, [[38, 100], [16, 92], [10, 70]], 16, color, s + 1);
    paw(ctx, 52, 120, 14, 10, '#2b2622', s + 2);
    paw(ctx, 78, 120, 14, 10, '#2b2622', s + 3);
    body(ctx, 64, 92, 32, 26, color, s + 4);
    // the two white bands
    shape(ctx, [[40, 78], [88, 74], [90, 86], [42, 88]], { color: null, fill: '#efe7d8', seed: s + 5 });
    shape(ctx, ellipsePoints(64, 92, 32, 26, 14), { ...P, width: 2.8, seed: s + 4 });
    body(ctx, 96, 92, 18, 16, color, s + 6);
    shape(ctx, [[104, 88], [120, 94], [104, 99]], { ...P, width: 2, fill: '#efe7d8', seed: s + 7 });
    circle(ctx, 119, 94, 3, { color: null, fill: INK, seed: s + 8 });
    roundEar(ctx, 90, 78, 7, '#5c534a', s + 9);
    eye(ctx, 100, 86, 5, s + 10, { look: [0.6, 0] });
    // the stink
    for (let i = 0; i < 3; i++) {
      stroke(ctx, [[28, 62 - i * 8], [20, 54 - i * 8], [28, 46 - i * 8]], {
        color: '#8a9b5c', width: 2, passes: 1, alpha: 0.6, seed: s + 30 + i,
      });
    }
  },

  // ---------------------------------------------------------------------- owl
  owl(ctx, s) {
    const color = '#a08256';
    wing(ctx, 40, 84, 26, 30, shade(color, -0.2), s + 1, 2.6);
    body(ctx, 64, 82, 32, 38, color, s + 2);
    shape(ctx, ellipsePoints(66, 92, 20, 26, 12), { color: null, fill: '#d8c39a', seed: s + 3 });
    for (let i = 0; i < 5; i++) {
      stroke(ctx, [[52 + i * 7, 96], [55 + i * 7, 102], [58 + i * 7, 96]], {
        color: shade(color, -0.3), width: 1.6, passes: 1, seed: s + 10 + i,
      });
    }
    // ear tufts
    shape(ctx, [[46, 54], [42, 32], [58, 48]], { ...P, width: 2.2, fill: color, seed: s + 4 });
    shape(ctx, [[82, 54], [88, 32], [70, 48]], { ...P, width: 2.2, fill: color, seed: s + 5 });
    // facial disc and the enormous eyes
    circle(ctx, 54, 62, 15, { color: shade(color, -0.25), width: 2, fill: '#e4d3ae', seed: s + 6 });
    circle(ctx, 76, 62, 15, { color: shade(color, -0.25), width: 2, fill: '#e4d3ae', seed: s + 7 });
    eye(ctx, 55, 62, 10, s + 8, { look: [0.35, 0], color: '#f2c94c' });
    eye(ctx, 77, 62, 10, s + 9, { look: [0.35, 0], color: '#f2c94c' });
    shape(ctx, [[60, 72], [70, 72], [65, 84]], { color: INK, width: 2, fill: '#e0913a', seed: s + 10 });
    paw(ctx, 56, 120, 11, 8, '#e0913a', s + 11);
    paw(ctx, 74, 120, 11, 8, '#e0913a', s + 12);
  },

  // -------------------------------------------------------------------- snake
  snake(ctx, s) {
    const color = '#7c9b4e';
    // coiled body
    shape(ctx, ellipsePoints(56, 104, 40, 17, 14), { ...P, width: 2.8, fill: color, seed: s + 1 });
    shape(ctx, ellipsePoints(58, 88, 30, 14, 14), { ...P, width: 2.8, fill: shade(color, 0.08), seed: s + 2 });
    for (let i = 0; i < 5; i++) {
      circle(ctx, 34 + i * 12, 104, 4, { color: null, fill: shade(color, -0.3), seed: s + 10 + i });
    }
    // raised neck and hood
    shape(ctx, [[70, 88], [96, 66], [92, 40], [76, 38], [62, 56], [58, 82]], { ...P, width: 2.6, fill: color, seed: s + 3 });
    shape(ctx, [[66, 56], [96, 50], [92, 26], [70, 28]], { ...P, width: 2.4, fill: shade(color, 0.15), seed: s + 4 });
    body(ctx, 84, 34, 17, 14, color, s + 5);
    eye(ctx, 90, 30, 5, s + 6, { look: [0.5, 0], color: '#f2c94c' });
    eye(ctx, 76, 32, 4.5, s + 7, { look: [0.5, 0], color: '#f2c94c' });
    // forked tongue
    stroke(ctx, [[98, 38], [112, 36]], { color: COLORS.danger, width: 2, seed: s + 8 });
    stroke(ctx, [[112, 36], [120, 32]], { color: COLORS.danger, width: 1.8, seed: s + 9 });
    stroke(ctx, [[112, 36], [120, 40]], { color: COLORS.danger, width: 1.8, seed: s + 10 });
  },

  // ---------------------------------------------------------------- alligator
  alligator(ctx, s) {
    const color = '#5f7a44';
    tail(ctx, [[40, 104], [16, 100], [6, 88]], 16, color, s + 1);
    body(ctx, 58, 102, 38, 17, color, s + 2);
    paw(ctx, 40, 120, 13, 9, shade(color, -0.2), s + 3);
    paw(ctx, 76, 120, 13, 9, shade(color, -0.2), s + 4);
    // back plates
    for (let i = 0; i < 7; i++) {
      const x = 28 + i * 11;
      shape(ctx, [[x, 90], [x + 5, 80], [x + 10, 90]], {
        color: shade(color, -0.35), width: 1.8, fill: shade(color, -0.15), seed: s + 20 + i,
      });
    }
    // long snout
    shape(ctx, [[86, 92], [126, 94], [126, 106], [86, 110]], { ...P, width: 2.6, fill: color, seed: s + 5 });
    shape(ctx, [[88, 104], [126, 104], [126, 110], [88, 112]], { ...P, width: 2.2, fill: shade(color, 0.12), seed: s + 6 });
    teeth(ctx, 92, 104, 124, 6, s + 7);
    eye(ctx, 92, 86, 6, s + 8, { look: [0.5, -0.2], color: '#f2c94c' });
    circle(ctx, 122, 96, 2.5, { color: null, fill: INK, seed: s + 9 });
  },

  // -------------------------------------------------------------------- eagle
  eagle(ctx, s) {
    const bodyColor = '#6b4a30';
    // back wing, spread up and to the left
    shape(ctx, [[58, 72], [30, 46], [4, 40], [16, 60], [2, 66], [24, 76], [46, 84]], {
      ...P, width: 2.4, fill: shade(bodyColor, -0.12), seed: s + 1,
    });
    // body
    shape(ctx, [[54, 60], [78, 58], [84, 88], [70, 108], [52, 100]], { ...P, width: 2.8, fill: bodyColor, seed: s + 2 });
    // breast feathers
    for (let i = 0; i < 3; i++) {
      stroke(ctx, [[56 + i * 9, 78], [60 + i * 9, 86], [64 + i * 9, 78]], {
        color: shade(bodyColor, -0.35), width: 1.6, passes: 1, seed: s + 20 + i,
      });
    }
    // front wing, spread to the right
    shape(ctx, [[76, 66], [104, 44], [126, 40], [116, 60], [128, 68], [106, 78], [82, 84]], {
      ...P, width: 2.4, fill: shade(bodyColor, 0.14), seed: s + 3,
    });
    // fanned tail
    shape(ctx, [[56, 98], [40, 116], [66, 112], [72, 100]], { ...P, width: 2.2, fill: shade(bodyColor, -0.2), seed: s + 4 });
    // white head
    body(ctx, 72, 40, 19, 18, '#f2ece0', s + 5);
    shape(ctx, [[84, 36], [106, 42], [96, 48], [84, 46]], { color: INK, width: 2.2, fill: '#e8b23c', seed: s + 6 });
    stroke(ctx, [[102, 43], [96, 49]], { color: INK, width: 2, seed: s + 7 });
    eye(ctx, 78, 35, 5.5, s + 8, { look: [0.6, 0], color: '#f2c94c' });
    // the brow that gives an eagle its angry face
    stroke(ctx, [[70, 28], [86, 31]], { color: INK, width: 3, seed: s + 9 });
    paw(ctx, 62, 120, 11, 9, '#e8b23c', s + 10);
    paw(ctx, 78, 120, 11, 9, '#e8b23c', s + 11);
  },

  // -------------------------------------------------------------------- hippo
  hippo(ctx, s) {
    const color = '#9c7f88';
    paw(ctx, 42, 120, 18, 12, shade(color, -0.2), s + 1);
    paw(ctx, 82, 120, 18, 12, shade(color, -0.2), s + 2);
    body(ctx, 56, 92, 40, 28, color, s + 3);
    // that enormous head
    body(ctx, 94, 88, 30, 26, shade(color, 0.06), s + 4);
    shape(ctx, [[76, 96], [124, 94], [124, 108], [76, 108]], { ...P, width: 2.6, fill: shade(color, 0.12), seed: s + 5 });
    teeth(ctx, 84, 100, 118, 7, s + 6, false);
    circle(ctx, 112, 80, 4, { color: INK, width: 1.8, fill: shade(color, -0.3), seed: s + 7 });
    circle(ctx, 100, 78, 4, { color: INK, width: 1.8, fill: shade(color, -0.3), seed: s + 8 });
    eye(ctx, 92, 68, 6, s + 9, { look: [0.5, 0] });
    roundEar(ctx, 76, 66, 7, color, s + 10);
  },

  // ------------------------------------------------------------------- jaguar
  jaguar(ctx, s) {
    const color = '#d9a94e';
    tail(ctx, [[38, 92], [14, 84], [8, 60], [22, 52]], 11, color, s + 1);
    paw(ctx, 44, 120, 15, 11, color, s + 2);
    paw(ctx, 80, 120, 15, 11, color, s + 3);
    body(ctx, 60, 92, 36, 24, color, s + 4);
    spots(ctx, 60, 92, 36, 24, '#5b4526', s + 5, 9);
    shape(ctx, ellipsePoints(60, 92, 36, 24, 14), { ...P, width: 2.8, seed: s + 4 });
    body(ctx, 94, 74, 24, 22, color, s + 6);
    spots(ctx, 94, 70, 20, 16, '#5b4526', s + 7, 4);
    pointedEar(ctx, 84, 56, 13, color, s + 8, -0.2);
    pointedEar(ctx, 104, 56, 13, color, s + 9, 0.2);
    shape(ctx, ellipsePoints(100, 82, 13, 10, 10), { color: null, fill: '#f0dfb4', seed: s + 10 });
    eye(ctx, 88, 72, 6, s + 11, { look: [0.6, 0], color: '#f2c94c' });
    eye(ctx, 104, 72, 6, s + 12, { look: [0.6, 0], color: '#f2c94c' });
    ellipse(ctx, 104, 82, 5, 3.5, { color: INK, width: 2, fill: '#8a5f3c', seed: s + 13 });
    stroke(ctx, [[98, 88], [104, 91], [110, 87]], { color: INK, width: 2, seed: s + 14 });
    for (const y of [80, 84]) {
      line(ctx, 112, y, 126, y - 4, { color: INK, width: 1.4, passes: 1, seed: s + y });
    }
  },

  // --------------------------------------------------------------- polar bear
  polarbear(ctx, s) {
    // white on beige paper disappears: the bluish shadow underneath is what
    // holds the silhouette, and the outline goes thicker than on other animals.
    const color = '#fbf7ee';
    const coldShadow = '#c3cfd6';
    const bearStroke = { ...P, width: 3.2 };
    paw(ctx, 42, 120, 20, 13, coldShadow, s + 1);
    paw(ctx, 84, 120, 20, 13, coldShadow, s + 2);
    shape(ctx, ellipsePoints(58, 88, 40, 32, 14), { ...bearStroke, fill: coldShadow, seed: s + 3 });
    shape(ctx, ellipsePoints(56, 85, 37, 29, 14), { color: null, fill: color, seed: s + 4 });
    fuzz(ctx, 58, 88, 40, 32, coldShadow, s + 5, 16, 6);
    shape(ctx, ellipsePoints(96, 68, 26, 24, 12), { ...bearStroke, fill: coldShadow, seed: s + 6 });
    shape(ctx, ellipsePoints(95, 66, 23, 21, 12), { color: null, fill: color, seed: s + 7 });
    roundEar(ctx, 84, 50, 9, color, s + 8);
    roundEar(ctx, 108, 52, 9, color, s + 9);
    shape(ctx, [[100, 74], [124, 78], [122, 90], [98, 88]], { ...bearStroke, width: 2.6, fill: coldShadow, seed: s + 10 });
    ellipse(ctx, 122, 80, 6, 5, { color: INK, width: 2, fill: INK, seed: s + 11 });
    eye(ctx, 92, 62, 5.5, s + 12, { look: [0.6, 0] });
    eye(ctx, 108, 62, 5.5, s + 13, { look: [0.6, 0] });
    // icy breath
    for (let i = 0; i < 3; i++) {
      circle(ctx, 126 - i * 4, 88 + i * 6, 3 + i, { color: null, fill: 'rgba(120, 190, 220, 0.55)', seed: s + 30 + i });
    }
  },

  // --------------------------------------------------------------------- lion
  lion(ctx, s) {
    const color = '#d9a44e';
    const mane = '#b9772e';
    tail(ctx, [[36, 96], [14, 88], [12, 66]], 8, color, s + 1);
    circle(ctx, 20, 62, 8, { ...P, width: 2.2, fill: mane, seed: s + 2 });
    paw(ctx, 46, 120, 16, 11, color, s + 3);
    paw(ctx, 80, 120, 16, 11, color, s + 4);
    body(ctx, 58, 94, 34, 24, color, s + 5);
    // the mane, in two layers of tufts
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = 88 + Math.cos(a) * 32;
      const y = 66 + Math.sin(a) * 32;
      circle(ctx, x, y, 11, {
        color: shade(mane, -0.25), width: 2, fill: i % 2 ? mane : shade(mane, -0.12), seed: s + 20 + i,
      });
    }
    body(ctx, 88, 66, 25, 23, color, s + 6);
    shape(ctx, ellipsePoints(92, 74, 15, 12, 10), { color: null, fill: '#f0dfb4', seed: s + 7 });
    eye(ctx, 82, 62, 6, s + 8, { look: [0.6, 0], color: '#f2c94c' });
    eye(ctx, 98, 62, 6, s + 9, { look: [0.6, 0], color: '#f2c94c' });
    ellipse(ctx, 96, 74, 5.5, 4, { color: INK, width: 2, fill: '#8a5f3c', seed: s + 10 });
    stroke(ctx, [[88, 80], [96, 84], [104, 79]], { color: INK, width: 2.2, seed: s + 11 });
    teeth(ctx, 90, 84, 104, 5, s + 12);
  },

  // ----------------------------------------------------------------- elephant
  elephant(ctx, s) {
    const color = '#93949a';
    paw(ctx, 40, 120, 21, 16, shade(color, -0.15), s + 1);
    paw(ctx, 74, 120, 21, 16, shade(color, -0.15), s + 2);
    tail(ctx, [[26, 84], [14, 94], [16, 104]], 6, color, s + 3);
    body(ctx, 54, 84, 38, 32, color, s + 4);
    // that big ear
    shape(ctx, ellipsePoints(86, 66, 26, 30, 12), { ...P, width: 2.6, fill: shade(color, 0.08), seed: s + 5 });
    shape(ctx, ellipsePoints(88, 68, 17, 20, 10), { color: shade(color, -0.25), width: 1.8, fill: null, seed: s + 6 });
    body(ctx, 100, 72, 24, 26, color, s + 7);
    // trunk
    const t = [[104, 90], [116, 100], [118, 114], [110, 120]];
    tail(ctx, t, 15, color, s + 8);
    for (let i = 0; i < 3; i++) {
      line(ctx, 108 + i * 2, 96 + i * 8, 120 + i, 96 + i * 8, { color: shade(color, -0.3), width: 1.6, passes: 1, seed: s + 40 + i });
    }
    // tusks
    shape(ctx, [[92, 92], [86, 108], [96, 96]], { color: INK, width: 2, fill: '#f0e9d8', seed: s + 9 });
    shape(ctx, [[114, 90], [122, 104], [116, 92]], { color: INK, width: 2, fill: '#f0e9d8', seed: s + 10 });
    eye(ctx, 106, 64, 5.5, s + 11, { look: [0.6, 0] });
  },
};

/** Cached animal sprite, with volume already applied on top. */
export function animalSprite(id, size = 128) {
  return sprite(`animal:${id}:${size}`, size, size, (ctx, w, h) => {
    ctx.save();
    ctx.scale(w / 128, h / 128);
    const paint = drawings[id];
    if (paint) paint(ctx, (id.charCodeAt(0) * 37 + id.length * 11) | 0);
    ctx.restore();
    volume(ctx, w, h);
  });
}

export const DRAWN_ANIMALS = Object.keys(drawings);
