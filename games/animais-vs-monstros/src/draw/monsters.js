// Brazilian folklore as the enemy. They all face left, the direction they
// advance in. A 128x128 box, ground at y=122.
//
// The ids stay in Portuguese: they are proper names, and a Saci renamed is a
// creature that doesn't exist. What is translated lives in data/monsters.js.

import { shape, ellipse, circle, line, stroke, ellipsePoints, sprite, volume } from '../scribble.js';
import { INK, COLORS, shade } from '../palette.js';
import { OUTLINE, body, eye, evilEye, pointedEar, tail, fuzz, teeth, horn } from './common.js';

const P = OUTLINE;

/** A drawn flame — serves the Boitatá, the Mule and the Cuca. */
function flame(ctx, x, y, height, s, color = COLORS.fire, inner = COLORS.fireLight) {
  shape(
    ctx,
    [[x - height * 0.3, y], [x - height * 0.18, y - height * 0.55], [x, y - height], [x + height * 0.2, y - height * 0.5], [x + height * 0.32, y]],
    { color: shade(color, -0.2), width: 2, fill: color, seed: s }
  );
  shape(ctx, [[x - height * 0.14, y], [x, y - height * 0.55], [x + height * 0.14, y]], {
    color: null, fill: inner, seed: s + 3,
  });
}

const drawings = {
  // -------------------------------------------------------------- corpo-seco
  corposeco(ctx, s) {
    const skin = '#9a9382';
    // crooked legs
    stroke(ctx, [[72, 92], [66, 108], [56, 122]], { color: INK, width: 5, seed: s + 1 });
    stroke(ctx, [[80, 92], [84, 108], [78, 122]], { color: INK, width: 5, seed: s + 2 });
    shape(ctx, [[62, 52], [88, 50], [92, 96], [60, 98]], { ...P, width: 2.6, fill: skin, seed: s + 3 });
    // ribs showing
    for (let i = 0; i < 4; i++) {
      stroke(ctx, [[64, 62 + i * 8], [76, 66 + i * 8], [88, 62 + i * 8]], {
        color: shade(skin, -0.35), width: 1.8, passes: 1, seed: s + 10 + i,
      });
    }
    stroke(ctx, [[62, 60], [44, 74], [38, 92]], { color: INK, width: 4.5, seed: s + 4 });
    stroke(ctx, [[88, 60], [100, 76], [96, 92]], { color: INK, width: 4.5, seed: s + 5 });
    body(ctx, 74, 38, 20, 21, skin, s + 6);
    // sunken eyes
    circle(ctx, 64, 34, 7, { color: null, fill: '#2b2622', seed: s + 7 });
    circle(ctx, 82, 34, 7, { color: null, fill: '#2b2622', seed: s + 8 });
    circle(ctx, 64, 34, 2.5, { color: null, fill: '#c1503f', seed: s + 9 });
    circle(ctx, 82, 34, 2.5, { color: null, fill: '#c1503f', seed: s + 10 });
    stroke(ctx, [[64, 48], [74, 52], [84, 48]], { color: INK, width: 2.2, seed: s + 11 });
    for (let i = 0; i < 4; i++) {
      line(ctx, 66 + i * 5, 48, 66 + i * 5, 53, { color: INK, width: 1.4, passes: 1, seed: s + 20 + i });
    }
  },

  // --------------------------------------------------------------------- saci
  saci(ctx, s) {
    // whirlwind at the base
    for (let i = 0; i < 3; i++) {
      const r = 26 - i * 6;
      shape(ctx, ellipsePoints(70, 116 - i * 6, r, r * 0.32, 10), {
        color: '#b0a894', width: 2, fill: null, alpha: 0.7, seed: s + i * 4,
      });
    }
    // the single leg
    stroke(ctx, [[70, 84], [68, 104], [70, 116]], { color: '#4a3b30', width: 7, seed: s + 1 });
    shape(ctx, [[58, 46], [86, 44], [90, 88], [56, 90]], { ...P, width: 2.6, fill: '#c1503f', seed: s + 2 });
    stroke(ctx, [[58, 54], [40, 66], [36, 84]], { color: '#4a3b30', width: 5, seed: s + 3 });
    stroke(ctx, [[88, 54], [102, 62], [104, 74]], { color: '#4a3b30', width: 5, seed: s + 4 });
    body(ctx, 72, 34, 19, 19, '#4a3b30', s + 5);
    // the red cap
    shape(ctx, [[52, 24], [92, 22], [76, 2], [62, 6]], { color: INK, width: 2.4, fill: '#c1503f', seed: s + 6 });
    circle(ctx, 76, 2, 5, { color: INK, width: 2, fill: '#e07a5f', seed: s + 7 });
    evilEye(ctx, 64, 34, 5, s + 8, '#f2c94c');
    evilEye(ctx, 80, 34, 5, s + 9, '#f2c94c');
    stroke(ctx, [[64, 44], [72, 47], [80, 43]], { color: INK, width: 2, seed: s + 10 });
    // the pipe
    line(ctx, 62, 44, 46, 50, { color: '#5c4633', width: 4, seed: s + 11 });
    circle(ctx, 44, 52, 5, { color: INK, width: 2, fill: '#3f3128', seed: s + 12 });
    for (let i = 0; i < 2; i++) {
      circle(ctx, 40 - i * 6, 44 - i * 6, 3 + i, { color: null, fill: 'rgba(200,195,180,0.5)', seed: s + 30 + i });
    }
  },

  // ----------------------------------------------------------------- curupira
  curupira(ctx, s) {
    const skin = '#b5793f';
    // feet turned backwards — the detail that defines the legend
    shape(ctx, [[64, 116], [64, 124], [84, 124], [82, 116]], { ...P, width: 2.2, fill: skin, seed: s + 1 });
    shape(ctx, [[76, 112], [76, 120], [96, 120], [94, 112]], { ...P, width: 2.2, fill: skin, seed: s + 2 });
    stroke(ctx, [[68, 88], [66, 104], [68, 116]], { color: skin, width: 7, seed: s + 3 });
    stroke(ctx, [[80, 88], [82, 102], [80, 112]], { color: skin, width: 7, seed: s + 4 });
    shape(ctx, [[60, 50], [88, 48], [92, 92], [58, 94]], { ...P, width: 2.6, fill: skin, seed: s + 5 });
    stroke(ctx, [[60, 58], [42, 68], [38, 86]], { color: skin, width: 5.5, seed: s + 6 });
    stroke(ctx, [[90, 58], [104, 66], [106, 80]], { color: skin, width: 5.5, seed: s + 7 });
    body(ctx, 72, 36, 20, 20, skin, s + 8);
    // hair of fire
    for (let i = 0; i < 7; i++) {
      flame(ctx, 54 + i * 7, 24, 20 + (i % 3) * 8, s + 20 + i);
    }
    evilEye(ctx, 64, 36, 5.5, s + 9, '#7fa85c');
    evilEye(ctx, 80, 36, 5.5, s + 10, '#7fa85c');
    stroke(ctx, [[64, 46], [72, 50], [80, 46]], { color: INK, width: 2, seed: s + 11 });
    teeth(ctx, 64, 46, 80, 5, s + 12);
  },

  // ------------------------------------------------------------ cabeça de cuia
  cabecadecuia(ctx, s) {
    const skin = '#8a9b7c';
    stroke(ctx, [[66, 100], [60, 112], [52, 122]], { color: INK, width: 5, seed: s + 1 });
    stroke(ctx, [[78, 100], [82, 112], [76, 122]], { color: INK, width: 5, seed: s + 2 });
    shape(ctx, [[62, 70], [84, 68], [88, 104], [60, 106]], { ...P, width: 2.4, fill: skin, seed: s + 3 });
    stroke(ctx, [[62, 76], [44, 88], [40, 104]], { color: INK, width: 4, seed: s + 4 });
    stroke(ctx, [[86, 76], [100, 86], [98, 100]], { color: INK, width: 4, seed: s + 5 });
    // the huge head he is named after
    circle(ctx, 72, 40, 34, { ...P, width: 3, fill: '#c9a86a', seed: s + 6 });
    shape(ctx, ellipsePoints(72, 40, 34, 34, 16), { color: shade('#c9a86a', -0.3), width: 1.6, fill: null, seed: s + 7 });
    line(ctx, 40, 34, 104, 32, { color: shade('#c9a86a', -0.35), width: 2, passes: 1, seed: s + 8 });
    evilEye(ctx, 58, 36, 7, s + 9, '#e0913a');
    evilEye(ctx, 84, 34, 7, s + 10, '#e0913a');
    shape(ctx, [[52, 56], [92, 54], [86, 68], [58, 68]], { color: INK, width: 2.2, fill: '#3f3128', seed: s + 11 });
    teeth(ctx, 54, 57, 88, 7, s + 12);
  },

  // ---------------------------------------------------------- headless mule
  mula(ctx, s) {
    const color = '#4a4038';
    // legs with red-hot horseshoes
    for (const [x, offset] of [[46, 0], [62, 1], [88, 2], [104, 3]]) {
      stroke(ctx, [[x, 82], [x - 2, 102], [x, 118]], { color: INK, width: 6, seed: s + offset });
      shape(ctx, [[x - 8, 118], [x + 8, 118], [x + 6, 124], [x - 6, 124]], {
        color: INK, width: 2, fill: COLORS.fire, seed: s + 10 + offset,
      });
    }
    body(ctx, 74, 70, 40, 26, color, s + 4);
    fuzz(ctx, 74, 70, 40, 26, '#2f2822', s + 5, 12, 5);
    // tail
    tail(ctx, [[112, 60], [124, 70], [120, 90]], 9, '#2f2822', s + 6);
    // severed neck, with fire pouring out
    shape(ctx, [[42, 66], [58, 50], [46, 40], [32, 56]], { ...P, width: 2.6, fill: color, seed: s + 7 });
    shape(ctx, ellipsePoints(39, 48, 13, 9, 10), { color: INK, width: 2.2, fill: '#7a2f22', seed: s + 8 });
    for (let i = 0; i < 4; i++) flame(ctx, 30 + i * 7, 46, 26 + (i % 2) * 10, s + 20 + i);
    // saddle
    shape(ctx, [[62, 48], [88, 48], [86, 58], [64, 58]], { color: INK, width: 2, fill: '#6b4a2f', seed: s + 9 });
  },

  // --------------------------------------------------------------------- iara
  iara(ctx, s) {
    // fish tail
    shape(ctx, [[70, 84], [86, 100], [78, 118], [62, 116], [56, 98]], { ...P, width: 2.4, fill: '#4f8a92', seed: s + 1 });
    shape(ctx, [[62, 112], [40, 124], [52, 104]], { ...P, width: 2.2, fill: '#3d7791', seed: s + 2 });
    shape(ctx, [[74, 112], [96, 122], [84, 104]], { ...P, width: 2.2, fill: '#3d7791', seed: s + 3 });
    for (let i = 0; i < 4; i++) {
      stroke(ctx, [[58, 90 + i * 7], [70, 94 + i * 7], [82, 90 + i * 7]], {
        color: '#2f5f70', width: 1.6, passes: 1, seed: s + 10 + i,
      });
    }
    body(ctx, 70, 62, 17, 24, '#c9a07a', s + 4);
    // long hair
    shape(ctx, [[48, 30], [40, 70], [50, 96], [60, 70], [58, 34]], { ...P, width: 2.2, fill: '#3d5b3a', seed: s + 5 });
    shape(ctx, [[92, 30], [100, 68], [90, 94], [80, 68], [82, 34]], { ...P, width: 2.2, fill: '#3d5b3a', seed: s + 6 });
    body(ctx, 70, 32, 19, 20, '#c9a07a', s + 7);
    shape(ctx, [[50, 30], [70, 8], [90, 30], [70, 22]], { ...P, width: 2.2, fill: '#4a6b45', seed: s + 8 });
    eye(ctx, 62, 32, 6, s + 9, { look: [-0.5, 0], color: '#cfe6e2' });
    eye(ctx, 78, 32, 6, s + 10, { look: [-0.5, 0], color: '#cfe6e2' });
    stroke(ctx, [[64, 44], [70, 41], [76, 44]], { color: '#8a4a4a', width: 2, seed: s + 11 });
    // notes of her song
    for (let i = 0; i < 2; i++) {
      const x = 32 - i * 10;
      const y = 44 - i * 14;
      circle(ctx, x, y, 4, { color: null, fill: 'rgba(180, 210, 220, 0.75)', seed: s + 30 + i });
      line(ctx, x + 3.5, y, x + 3.5, y - 11, { color: 'rgba(180, 210, 220, 0.75)', width: 2, passes: 1, seed: s + 40 + i });
    }
  },

  // ------------------------------------------------------- boto (in the river)
  boto(ctx, s) {
    const skin = '#e2949f';
    const belly = '#f6d3d6';
    // the arc of water he came out of — without it he looks like a flying fish
    shape(ctx, ellipsePoints(70, 112, 46, 11, 14), { color: null, fill: 'rgba(109, 168, 196, 0.55)', seed: s + 1 });
    for (let i = 0; i < 4; i++) {
      circle(ctx, 34 + i * 24, 100 - (i % 2) * 12, 3 + (i % 2) * 2, {
        color: null, fill: 'rgba(180, 214, 228, 0.8)', seed: s + 30 + i,
      });
    }
    // tail fluke, behind
    shape(ctx, [[96, 60], [124, 42], [116, 62], [126, 80], [98, 74]], { ...P, width: 2.2, fill: shade(skin, -0.18), seed: s + 2 });
    body(ctx, 68, 64, 33, 21, skin, s + 3);
    // pale belly and the low ridge on the back: a boto has no tall dorsal fin
    shape(ctx, ellipsePoints(66, 74, 24, 9, 12), { color: null, fill: belly, seed: s + 4 });
    shape(ctx, [[58, 44], [82, 41], [88, 50]], { ...P, width: 2, fill: shade(skin, -0.14), seed: s + 5 });
    // pectoral
    shape(ctx, [[54, 76], [38, 92], [64, 84]], { ...P, width: 2, fill: shade(skin, -0.14), seed: s + 6 });
    // the long beak, which is what separates him from a cartoon dolphin
    shape(ctx, [[42, 56], [8, 66], [8, 76], [44, 74]], { ...P, width: 2.2, fill: skin, seed: s + 7 });
    stroke(ctx, [[10, 72], [42, 70]], { color: shade(skin, -0.4), width: 1.6, passes: 1, seed: s + 8 });
    eye(ctx, 48, 58, 5, s + 9, { look: [-0.5, 0], color: '#f6ece2' });
    // the blow
    for (let i = 0; i < 3; i++) {
      circle(ctx, 62 + i * 4, 34 - i * 9, 3 + i, {
        color: null, fill: `rgba(200, 226, 236, ${0.7 - i * 0.16})`, seed: s + 40 + i,
      });
    }
  },

  // ------------------------------------------------- boto (the man at the party)
  botohomem(ctx, s) {
    const suit = '#f4eee2';
    const skin = '#c08a6e';
    // trousers and shoes
    stroke(ctx, [[66, 92], [62, 110], [58, 120]], { color: suit, width: 9, seed: s + 1 });
    stroke(ctx, [[82, 92], [86, 110], [82, 120]], { color: suit, width: 9, seed: s + 2 });
    shape(ctx, [[48, 118], [62, 116], [62, 124], [48, 124]], { ...P, width: 2, fill: '#3f3128', seed: s + 3 });
    shape(ctx, [[72, 118], [86, 116], [86, 124], [72, 124]], { ...P, width: 2, fill: '#3f3128', seed: s + 4 });
    // white jacket
    shape(ctx, [[56, 48], [92, 46], [96, 96], [54, 98]], { ...P, width: 2.6, fill: suit, seed: s + 5 });
    shape(ctx, [[68, 47], [76, 47], [74, 74], [70, 74]], { color: null, fill: shade(suit, -0.1), seed: s + 6 });
    stroke(ctx, [[56, 52], [38, 70], [34, 88]], { color: suit, width: 7, seed: s + 7 });
    stroke(ctx, [[94, 52], [110, 68], [108, 86]], { color: suit, width: 7, seed: s + 8 });
    body(ctx, 74, 34, 18, 18, skin, s + 9);
    // a person's eye, not an animal's: his charm is precisely that he doesn't scare
    eye(ctx, 66, 33, 5.5, s + 10, { look: [-0.5, 0] });
    eye(ctx, 82, 32, 5.5, s + 11, { look: [-0.5, 0] });
    stroke(ctx, [[66, 44], [74, 47], [82, 43]], { color: INK, width: 2, seed: s + 12 });
    // The hat he never takes off — it is what hides his blowhole. Without the
    // hat, this sprite is just a young man in a suit.
    shape(ctx, [[44, 16], [104, 14], [102, 23], [46, 25]], { ...P, width: 2.4, fill: suit, seed: s + 13 });
    shape(ctx, [[56, 17], [92, 15], [88, -2], [60, 0]], { ...P, width: 2.4, fill: suit, seed: s + 14 });
    shape(ctx, [[56, 12], [91, 10], [91, 16], [56, 18]], { color: null, fill: '#8a6a45', seed: s + 15 });
    // dripping: he left the river five minutes ago
    for (let i = 0; i < 3; i++) {
      circle(ctx, 50 + i * 26, 104 + (i % 2) * 10, 2.5, { color: null, fill: 'rgba(109, 168, 196, 0.75)', seed: s + 40 + i });
    }
  },

  // ----------------------------------------------------------- mother of gold
  maedeouro(ctx, s) {
    // She never touches the ground, so the whole drawing lives in the top half
    // of the frame. The trail goes right — the side she came from — and it is
    // what turns the ball into a comet instead of a sun.
    //
    // The trail is `shape`, not `tail`: three near-straight lines give a broom
    // handle. A triangle tapering to a point gives a streak across the sky.
    shape(ctx, [[76, 20], [128, 74], [76, 80]], { color: null, fill: 'rgba(232, 112, 58, 0.3)', seed: s + 1 });
    shape(ctx, [[78, 32], [124, 73], [78, 72]], { color: null, fill: 'rgba(247, 212, 81, 0.45)', seed: s + 2 });
    shape(ctx, [[80, 42], [114, 72], [80, 62]], { color: null, fill: 'rgba(253, 240, 192, 0.5)', seed: s + 3 });

    // the ball: a shell of fire, a bright core, white embers at the centre. It
    // fills the frame like the other monsters — a small ball in a big frame
    // disappears in the middle of the horde.
    circle(ctx, 52, 52, 37, { color: shade(COLORS.fire, -0.25), width: 2.6, fill: COLORS.fire, seed: s + 4 });
    circle(ctx, 50, 49, 25, { color: null, fill: COLORS.fireLight, seed: s + 5 });
    circle(ctx, 48, 46, 12, { color: null, fill: '#fdf0c0', seed: s + 6 });

    // flames licking only the trailing edge: fire all around the circle becomes
    // a sun's corona, and on top it becomes horns
    flame(ctx, 80, 36, 17, s + 20, '#e8703a', '#f7d451');
    flame(ctx, 88, 60, 16, s + 21, '#e8703a', '#f7d451');
    flame(ctx, 70, 84, 14, s + 22, '#e8703a', '#f7d451');

    // inside the fire, the woman of the legend: a thin figure, hair pulled back
    // by the flight. Thin is what matters — a dark mass in the middle of the
    // ball becomes a brown blur and swallows all the fire.
    const figure = 'rgba(96, 34, 14, 0.55)';
    shape(ctx, [[48, 18], [78, 26], [66, 42], [50, 33]], { color: null, fill: figure, seed: s + 7 });
    shape(ctx, [[41, 30], [50, 30], [53, 72], [39, 65]], { color: null, fill: figure, seed: s + 8 });
    circle(ctx, 45, 26, 8.5, { color: null, fill: figure, seed: s + 9 });
    circle(ctx, 41, 26, 2.6, { color: null, fill: '#fdf0c0', seed: s + 10 });
    circle(ctx, 50, 25, 2.6, { color: null, fill: '#fdf0c0', seed: s + 11 });

    // falling sparks — what she leaves behind on the way
    for (let i = 0; i < 5; i++) {
      circle(ctx, 30 + i * 18, 96 + (i % 3) * 10, 2 + (i % 2), {
        color: null, fill: `rgba(247, 212, 81, ${0.7 - i * 0.1})`, seed: s + 40 + i,
      });
    }
  },

  // ------------------------------------------------------------------ boitatá
  boitata(ctx, s) {
    // a serpentine body in flames
    const p = [[118, 108], [96, 96], [104, 76], [84, 62], [58, 66], [44, 52]];
    tail(ctx, p, 20, COLORS.fire, s + 1);
    tail(ctx, p, 11, COLORS.fireLight, s + 2);
    for (let i = 0; i < p.length; i++) {
      flame(ctx, p[i][0], p[i][1] - 8, 20, s + 10 + i, '#e8703a', '#f7d451');
    }
    body(ctx, 40, 44, 20, 16, '#c1503f', s + 3);
    shape(ctx, [[22, 42], [40, 36], [40, 52]], { ...P, width: 2.2, fill: '#c1503f', seed: s + 4 });
    evilEye(ctx, 34, 40, 6, s + 5, '#f7d451');
    evilEye(ctx, 46, 38, 5, s + 6, '#f7d451');
    stroke(ctx, [[22, 44], [10, 40]], { color: '#f7d451', width: 2, seed: s + 7 });
    stroke(ctx, [[10, 40], [2, 36]], { color: '#f7d451', width: 1.8, seed: s + 8 });
    stroke(ctx, [[10, 40], [2, 44]], { color: '#f7d451', width: 1.8, seed: s + 9 });
  },

  // ---------------------------------------------------------------- werewolf
  lobisomem(ctx, s) {
    const color = '#544a42';
    stroke(ctx, [[62, 96], [56, 112], [46, 124]], { color, width: 9, seed: s + 1 });
    stroke(ctx, [[86, 96], [90, 112], [82, 124]], { color, width: 9, seed: s + 2 });
    shape(ctx, [[56, 48], [92, 46], [96, 100], [54, 102]], { ...P, width: 2.8, fill: color, seed: s + 3 });
    shape(ctx, ellipsePoints(76, 78, 18, 20, 12), { color: null, fill: '#7d6f62', seed: s + 4 });
    fuzz(ctx, 74, 72, 20, 28, '#3f3830', s + 5, 12, 7);
    // arms with claws
    stroke(ctx, [[56, 56], [34, 72], [26, 92]], { color, width: 8, seed: s + 6 });
    for (let i = 0; i < 3; i++) {
      stroke(ctx, [[26, 92], [18 - i * 3, 102 + i * 3]], { color: '#e8dcc4', width: 2.6, seed: s + 20 + i });
    }
    stroke(ctx, [[94, 56], [110, 70], [108, 88]], { color, width: 8, seed: s + 7 });
    // head in profile: the muzzle is a wedge coming out of the face, pointing
    // down and left — drawn before the skull so it doesn't cover it
    shape(ctx, [[66, 32], [30, 44], [32, 56], [70, 52]], { ...P, width: 2.4, fill: shade(color, -0.12), seed: s + 11 });
    teeth(ctx, 34, 47, 64, 6, s + 12);
    circle(ctx, 32, 45, 5, { color: null, fill: INK, seed: s + 13 });
    stroke(ctx, [[38, 38], [56, 34]], { color: shade(color, -0.3), width: 2, passes: 1, seed: s + 14 });
    body(ctx, 78, 32, 23, 22, color, s + 8);
    pointedEar(ctx, 68, 12, 17, color, s + 9, -0.4);
    pointedEar(ctx, 92, 12, 17, color, s + 10, 0.2);
    evilEye(ctx, 68, 30, 6, s + 15, '#f2c94c');
    evilEye(ctx, 86, 30, 6, s + 16, '#f2c94c');
  },

  // --------------------------------------------------------------- mapinguari
  mapinguari(ctx, s) {
    const color = '#7a5c3a';
    stroke(ctx, [[56, 100], [50, 114], [44, 124]], { color, width: 12, seed: s + 1 });
    stroke(ctx, [[90, 100], [96, 114], [92, 124]], { color, width: 12, seed: s + 2 });
    body(ctx, 72, 70, 42, 44, color, s + 3);
    fuzz(ctx, 72, 70, 42, 44, '#5c4326', s + 4, 22, 9);
    stroke(ctx, [[36, 60], [20, 80], [22, 100]], { color, width: 10, seed: s + 5 });
    for (let i = 0; i < 3; i++) {
      stroke(ctx, [[22, 100], [14 - i * 3, 110 + i * 3]], { color: '#e8dcc4', width: 2.6, seed: s + 20 + i });
    }
    stroke(ctx, [[108, 60], [122, 78], [120, 96]], { color, width: 10, seed: s + 6 });
    // the mouth on its belly
    shape(ctx, ellipsePoints(72, 84, 24, 15, 12), { color: INK, width: 2.6, fill: '#3f2a1c', seed: s + 7 });
    teeth(ctx, 52, 76, 92, 9, s + 8);
    teeth(ctx, 52, 92, 92, 9, s + 9, false);
    // small head with a single eye
    body(ctx, 72, 34, 21, 19, color, s + 10);
    evilEye(ctx, 72, 32, 10, s + 11, '#c1503f');
    stroke(ctx, [[60, 44], [72, 48], [84, 44]], { color: INK, width: 2.2, seed: s + 12 });
    // the stench
    for (let i = 0; i < 3; i++) {
      stroke(ctx, [[104, 40 - i * 9], [112, 32 - i * 9], [104, 24 - i * 9]], {
        color: '#8a9b5c', width: 2, passes: 1, alpha: 0.55, seed: s + 30 + i,
      });
    }
  },

  // ----------------------------------------------------------------- bogeyman
  bichopapao(ctx, s) {
    // a dark mass with no fixed shape
    shape(ctx, [[20, 118], [12, 76], [30, 40], [64, 22], [100, 34], [118, 70], [112, 118]], {
      color: '#211c26', width: 3.4, fill: '#3d3145', seed: s + 1,
    });
    shape(ctx, [[28, 116], [22, 82], [40, 52], [66, 38], [96, 50], [108, 84], [104, 116]], {
      color: null, fill: '#4a3b56', seed: s + 2,
    });
    // many eyes, different sizes
    const eyes = [[46, 60, 9], [72, 52, 12], [96, 68, 7], [58, 84, 6], [86, 90, 8], [36, 88, 5], [70, 74, 5]];
    for (const [x, y, r] of eyes) evilEye(ctx, x, y, r, s + x, '#f2c94c');
    // that maw
    shape(ctx, [[36, 100], [96, 98], [86, 118], [46, 118]], { color: INK, width: 2.6, fill: '#160f1c', seed: s + 3 });
    teeth(ctx, 38, 101, 94, 11, s + 4);
    teeth(ctx, 44, 117, 88, 10, s + 5, false);
    // wisps of darkness
    for (let i = 0; i < 5; i++) {
      stroke(ctx, [[14 + i * 26, 24], [10 + i * 26, 10], [18 + i * 26, 4]], {
        color: '#3d3145', width: 3, alpha: 0.75, seed: s + 30 + i,
      });
    }
  },

  // --------------------------------------------------------------------- cuca
  cuca(ctx, s) {
    const skin = '#9aa85c';
    // dress
    shape(ctx, [[46, 124], [56, 70], [96, 68], [110, 124]], { ...P, width: 3, fill: '#6b4a6f', seed: s + 1 });
    for (let i = 0; i < 3; i++) {
      stroke(ctx, [[50 + i * 4, 110 - i * 14], [104 - i * 4, 108 - i * 14]], {
        color: '#4f3552', width: 2, passes: 1, seed: s + 10 + i,
      });
    }
    // arms with claws
    stroke(ctx, [[56, 76], [30, 88], [22, 106]], { color: skin, width: 8, seed: s + 2 });
    for (let i = 0; i < 3; i++) {
      stroke(ctx, [[22, 106], [12 - i * 2, 116 + i * 3]], { color: '#e8dcc4', width: 2.8, seed: s + 20 + i });
    }
    stroke(ctx, [[100, 74], [118, 86], [116, 104]], { color: skin, width: 8, seed: s + 3 });
    // yellow hair
    for (let i = 0; i < 9; i++) {
      const x = 34 + i * 8;
      stroke(ctx, [[x, 44], [x - 6 + (i % 3) * 5, 20], [x + 2, 4]], { color: '#d9b23c', width: 4, seed: s + 30 + i });
    }
    // alligator head
    body(ctx, 74, 42, 28, 24, skin, s + 4);
    shape(ctx, [[52, 36], [14, 44], [14, 58], [54, 56]], { ...P, width: 2.8, fill: skin, seed: s + 5 });
    shape(ctx, [[52, 50], [14, 54], [14, 62], [54, 62]], { ...P, width: 2.4, fill: shade(skin, 0.12), seed: s + 6 });
    teeth(ctx, 16, 52, 52, 8, s + 7);
    teeth(ctx, 18, 60, 50, 7, s + 8, false);
    for (let i = 0; i < 5; i++) {
      shape(ctx, [[56 + i * 9, 26], [61 + i * 9, 16], [66 + i * 9, 26]], {
        color: shade(skin, -0.4), width: 1.8, fill: shade(skin, -0.2), seed: s + 40 + i,
      });
    }
    evilEye(ctx, 58, 34, 8, s + 9, '#e0913a');
    evilEye(ctx, 84, 30, 8, s + 10, '#e0913a');
  },

  // ======================================================== Japan: the yōkai

  // ---------------------------------------------------------------- karakasa
  karakasa(ctx, s) {
    const cloth = '#5b4a63';
    // the one leg, mid-hop, wearing a geta sandal
    stroke(ctx, [[70, 96], [68, 108], [70, 116]], { color: '#c9a07a', width: 6, seed: s + 1 });
    shape(ctx, [[58, 114], [84, 114], [84, 120], [58, 120]], { ...P, width: 2.2, fill: '#6b4a2f', seed: s + 2 });
    line(ctx, 64, 120, 64, 126, { color: '#4a3218', width: 4, seed: s + 3 });
    line(ctx, 78, 120, 78, 126, { color: '#4a3218', width: 4, seed: s + 4 });
    // the umbrella cone, half open, ribs showing
    shape(ctx, [[70, 14], [26, 78], [46, 84], [70, 88], [94, 84], [114, 78]], {
      ...P, width: 2.8, fill: cloth, seed: s + 5,
    });
    for (const [tx, ty] of [[38, 74], [56, 82], [84, 82], [104, 74]]) {
      stroke(ctx, [[70, 16], [tx, ty]], { color: shade(cloth, -0.35), width: 1.8, passes: 1, seed: s + tx });
    }
    // paper patch: it is an OLD umbrella
    shape(ctx, [[84, 40], [98, 44], [94, 58], [82, 54]], { color: shade(cloth, -0.2), width: 1.6, fill: '#8a7a80', seed: s + 6 });
    // the spike on top
    line(ctx, 70, 14, 70, 2, { color: INK, width: 3.5, seed: s + 7 });
    // one huge eye and the lolling tongue
    evilEye(ctx, 64, 62, 11, s + 8, '#f2c94c');
    shape(ctx, [[52, 78], [72, 76], [70, 84], [54, 84]], { color: INK, width: 2, fill: '#3f3128', seed: s + 9 });
    shape(ctx, [[56, 82], [66, 82], [64, 104], [54, 102]], { color: '#8a3a4a', width: 2, fill: '#c1636f', seed: s + 10 });
    stroke(ctx, [[59, 86], [58, 98]], { color: '#8a3a4a', width: 1.6, passes: 1, seed: s + 11 });
    // two little arms
    stroke(ctx, [[34, 82], [22, 92]], { color: cloth, width: 4.5, seed: s + 12 });
    stroke(ctx, [[106, 80], [116, 90]], { color: cloth, width: 4.5, seed: s + 13 });
  },

  // ------------------------------------------------------------------- kappa
  kappa(ctx, s) {
    const skin = '#6f9b52';
    // webbed feet
    shape(ctx, [[48, 116], [64, 116], [60, 124], [44, 124]], { ...P, width: 2.2, fill: shade(skin, -0.12), seed: s + 1 });
    shape(ctx, [[76, 114], [92, 114], [96, 122], [80, 122]], { ...P, width: 2.2, fill: shade(skin, -0.12), seed: s + 2 });
    // the shell on his back (he faces left, shell to the right)
    shape(ctx, ellipsePoints(88, 74, 26, 30, 14), { color: '#5c4326', width: 2.6, fill: '#8a6a3d', seed: s + 3 });
    for (const [cx, cy, r] of [[86, 62, 9], [80, 80, 8], [96, 84, 8]]) {
      shape(ctx, ellipsePoints(cx, cy, r, r * 0.85, 6), { color: '#5c4326', width: 1.8, fill: '#a3835a', seed: s + cx });
    }
    // body and arms
    body(ctx, 62, 78, 24, 26, skin, s + 4);
    shape(ctx, ellipsePoints(60, 86, 15, 16, 10), { color: null, fill: '#c9d9a0', seed: s + 5 });
    stroke(ctx, [[44, 70], [30, 82], [26, 96]], { color: skin, width: 6, seed: s + 6 });
    stroke(ctx, [[82, 66], [98, 76], [100, 90]], { color: skin, width: 6, seed: s + 7 });
    // head with the fringe of hair around the sara
    body(ctx, 60, 40, 21, 19, skin, s + 8);
    fuzz(ctx, 60, 34, 21, 12, shade(skin, -0.3), s + 9, 10, 6);
    // the water bowl — the whole legend in one dish
    shape(ctx, ellipsePoints(60, 22, 16, 6, 12), { color: INK, width: 2.4, fill: '#8a6a3d', seed: s + 10 });
    shape(ctx, ellipsePoints(60, 20, 12, 4, 10), { color: '#3d7791', width: 1.6, fill: '#9fd4e6', seed: s + 11 });
    circle(ctx, 56, 19, 1.6, { color: null, fill: '#e8f4f8', seed: s + 12 });
    // beak and round eyes
    shape(ctx, [[40, 40], [26, 44], [40, 50]], { ...P, width: 2.2, fill: '#e5b93c', seed: s + 13 });
    line(ctx, 28, 45, 40, 46, { color: shade('#e5b93c', -0.4), width: 1.4, passes: 1, seed: s + 14 });
    eye(ctx, 50, 36, 6, s + 15, { look: [-0.5, 0] });
    eye(ctx, 68, 36, 6, s + 16, { look: [-0.5, 0] });
  },

  // ----------------------------------------------------------------- kitsune
  kitsune(ctx, s) {
    const coat = '#e8dcc4';
    const tip = '#e0913a';
    // the fan of tails, behind everything
    const tails = [
      [[92, 78], [116, 56], [124, 30]],
      [[94, 82], [122, 70], [126, 48]],
      [[94, 88], [124, 86], [126, 66]],
      [[92, 94], [120, 100], [126, 88]],
      [[90, 98], [112, 112], [124, 106]],
    ];
    tails.forEach((p, i) => {
      tail(ctx, p, 11, coat, s + i * 3);
      circle(ctx, p[2][0] - 2, p[2][1] + 2, 5, { color: null, fill: tip, seed: s + 40 + i });
    });
    // slim legs mid-stride
    stroke(ctx, [[52, 96], [46, 110], [40, 122]], { color: coat, width: 6, seed: s + 6 });
    stroke(ctx, [[74, 98], [78, 110], [74, 122]], { color: coat, width: 6, seed: s + 7 });
    // long low body
    body(ctx, 66, 84, 30, 18, coat, s + 8);
    // chest ruff
    fuzz(ctx, 48, 88, 12, 12, shade(coat, -0.15), s + 9, 8, 5);
    // pointed face, shrine paint on the cheek
    body(ctx, 40, 58, 17, 14, coat, s + 10);
    shape(ctx, [[26, 56], [10, 62], [28, 66]], { ...P, width: 2.2, fill: coat, seed: s + 11 });
    circle(ctx, 12, 63, 2.2, { color: null, fill: INK, seed: s + 12 });
    pointedEar(ctx, 34, 42, 16, coat, s + 13, -0.3);
    pointedEar(ctx, 52, 42, 16, coat, s + 14, 0.2);
    stroke(ctx, [[30, 66], [38, 70]], { color: '#c1503f', width: 2.4, passes: 1, seed: s + 15 });
    // fox-fire eyes, and two ghost flames drifting alongside
    evilEye(ctx, 36, 56, 5.5, s + 16, '#7fd4e6');
    evilEye(ctx, 50, 54, 5.5, s + 17, '#7fd4e6');
    for (let i = 0; i < 2; i++) {
      const fx = 22 + i * 74;
      const fy = 28 - i * 8;
      shape(ctx, [[fx - 5, fy], [fx - 2, fy - 10], [fx, fy - 16], [fx + 3, fy - 8], [fx + 5, fy]], {
        color: '#3d7791', width: 1.6, fill: '#9fe0e6', alpha: 0.85, seed: s + 50 + i,
      });
    }
  },

  // ------------------------------------------------------------------- tengu
  tengu(ctx, s) {
    const skin = '#c1503f';
    // crow wings spread behind
    for (const [wx, spin] of [[92, -0.5], [98, 0.25]]) {
      shape(ctx, [[wx, 52], [wx + 30, 30 + spin * 40], [wx + 34, 52], [wx + 20, 62]], {
        ...P, width: 2.4, fill: '#3d3145', seed: s + wx,
      });
      stroke(ctx, [[wx + 6, 50], [wx + 24, 40 + spin * 30]], { color: '#211c26', width: 2, passes: 1, seed: s + wx + 1 });
    }
    // loose feet: he is airborne, geta dangling
    stroke(ctx, [[62, 96], [58, 108], [60, 116]], { color: '#4a3b30', width: 5, seed: s + 1 });
    shape(ctx, [[52, 114], [70, 114], [70, 120], [52, 120]], { ...P, width: 2, fill: '#6b4a2f', seed: s + 2 });
    // yamabushi robe
    shape(ctx, [[50, 50], [86, 48], [92, 96], [46, 98]], { ...P, width: 2.6, fill: '#8a6234', seed: s + 3 });
    for (let i = 0; i < 3; i++) {
      circle(ctx, 58 + i * 12, 60, 4, { color: INK, width: 1.6, fill: '#f4eee2', seed: s + 20 + i });
    }
    // the feather fan in his hand
    stroke(ctx, [[52, 66], [36, 78], [30, 90]], { color: skin, width: 5, seed: s + 4 });
    for (let i = 0; i < 4; i++) {
      const a = -0.6 - i * 0.35;
      shape(ctx, [[30, 90], [30 + Math.cos(a) * 22, 90 + Math.sin(a) * 22], [30 + Math.cos(a + 0.18) * 24, 90 + Math.sin(a + 0.18) * 24]], {
        color: '#5c4326', width: 1.8, fill: '#8a7a64', seed: s + 30 + i,
      });
    }
    // head: the long nose is the whole legend
    body(ctx, 66, 34, 19, 18, skin, s + 5);
    shape(ctx, [[50, 32], [14, 36], [50, 42]], { ...P, width: 2.4, fill: shade(skin, 0.08), seed: s + 6 });
    // tokin cap and white brows
    shape(ctx, [[58, 18], [74, 18], [70, 6], [62, 6]], { ...P, width: 2.2, fill: '#3f3128', seed: s + 7 });
    stroke(ctx, [[52, 24], [62, 20]], { color: '#f4eee2', width: 3, seed: s + 8 });
    stroke(ctx, [[70, 20], [80, 24]], { color: '#f4eee2', width: 3, seed: s + 9 });
    evilEye(ctx, 56, 30, 5.5, s + 10, '#f2c94c');
    evilEye(ctx, 74, 30, 5.5, s + 11, '#f2c94c');
    stroke(ctx, [[56, 46], [66, 49], [76, 45]], { color: INK, width: 2, seed: s + 12 });
  },

  // -------------------------------------------------------------- rokurokubi
  rokurokubi(ctx, s) {
    const skin = '#e8cba4';
    const robe = '#4f6b8a';
    // kneeling body in a kimono, tiny against the neck
    shape(ctx, [[56, 78], [92, 76], [100, 122], [50, 124]], { ...P, width: 2.6, fill: robe, seed: s + 1 });
    shape(ctx, [[70, 78], [78, 78], [76, 108], [70, 108]], { color: null, fill: shade(robe, -0.18), seed: s + 2 });
    // obi sash
    shape(ctx, [[54, 92], [96, 90], [96, 100], [54, 102]], { color: shade(robe, -0.35), width: 1.8, fill: '#c1636f', seed: s + 3 });
    // sleeves resting
    stroke(ctx, [[58, 84], [44, 96], [42, 108]], { color: robe, width: 8, seed: s + 4 });
    stroke(ctx, [[90, 82], [104, 92], [104, 106]], { color: robe, width: 8, seed: s + 5 });
    // THE NECK: a long pale loop leaving the collar and diving left
    stroke(ctx, [[72, 76], [84, 48], [62, 26], [34, 30], [18, 44]], { color: skin, width: 9, seed: s + 6 });
    stroke(ctx, [[72, 76], [84, 48], [62, 26], [34, 30], [18, 44]], { color: shade(skin, -0.3), width: 1.6, passes: 1, seed: s + 7 });
    // the head at the far end, hair in a loose bun
    body(ctx, 16, 52, 13, 12, skin, s + 8);
    shape(ctx, [[4, 44], [28, 42], [26, 34], [8, 36]], { ...P, width: 2.2, fill: '#2f2822', seed: s + 9 });
    circle(ctx, 26, 34, 6, { color: INK, width: 2, fill: '#2f2822', seed: s + 10 });
    // a lady's calm face — the horror is the geometry, not the grimace
    eye(ctx, 11, 50, 4, s + 11, { look: [-0.4, 0.2] });
    eye(ctx, 22, 50, 4, s + 12, { look: [-0.4, 0.2] });
    stroke(ctx, [[12, 60], [17, 62], [22, 60]], { color: '#8a4a4a', width: 2, seed: s + 13 });
    circle(ctx, 8, 56, 2, { color: null, fill: '#d98a8a', seed: s + 14 });
    circle(ctx, 25, 56, 2, { color: null, fill: '#d98a8a', seed: s + 15 });
  },

  // ---------------------------------------------------------------- yukionna
  yukionna(ctx, s) {
    const robe = '#f4f1e8';
    const skin = '#cfe0e6';
    // she has no feet: the kimono frays into mist
    for (let i = 0; i < 3; i++) {
      circle(ctx, 52 + i * 18, 116 - (i % 2) * 6, 9 - i * 2, {
        color: null, fill: 'rgba(220, 235, 240, 0.55)', seed: s + 30 + i,
      });
    }
    // the white kimono, drifting
    shape(ctx, [[52, 44], [86, 42], [98, 108], [72, 118], [42, 108]], { ...P, width: 2.6, fill: robe, seed: s + 1 });
    shape(ctx, [[66, 44], [74, 44], [72, 84], [66, 84]], { color: null, fill: shade(robe, -0.1), seed: s + 2 });
    shape(ctx, [[50, 62], [90, 60], [90, 70], [50, 72]], { color: shade(robe, -0.25), width: 1.6, fill: '#bcd4dc', seed: s + 3 });
    // sleeves like icicles
    stroke(ctx, [[54, 52], [36, 64], [32, 82]], { color: robe, width: 9, seed: s + 4 });
    stroke(ctx, [[86, 50], [102, 60], [104, 78]], { color: robe, width: 9, seed: s + 5 });
    // long black hair framing a pale face
    shape(ctx, [[48, 12], [40, 48], [46, 84], [56, 52], [54, 20]], { ...P, width: 2.2, fill: '#211c26', seed: s + 6 });
    shape(ctx, [[88, 12], [96, 46], [92, 82], [82, 50], [84, 20]], { ...P, width: 2.2, fill: '#211c26', seed: s + 7 });
    body(ctx, 68, 28, 17, 17, skin, s + 8);
    shape(ctx, [[52, 14], [84, 12], [82, 24], [54, 26]], { color: null, fill: '#211c26', seed: s + 9 });
    // cold eyes, blue lips, and the freezing breath
    evilEye(ctx, 61, 28, 5, s + 10, '#9fd4e6');
    evilEye(ctx, 76, 27, 5, s + 11, '#9fd4e6');
    stroke(ctx, [[62, 39], [68, 41], [74, 38]], { color: '#3d7791', width: 2.2, seed: s + 12 });
    for (let i = 0; i < 3; i++) {
      circle(ctx, 46 - i * 10, 34 - i * 7, 2.5 + i, {
        color: null, fill: `rgba(207, 232, 242, ${0.8 - i * 0.2})`, seed: s + 40 + i,
      });
    }
    // snow crystals drifting around her
    for (const [fx, fy] of [[30, 96], [98, 92], [24, 60], [108, 44]]) {
      line(ctx, fx - 4, fy, fx + 4, fy, { color: '#dff0f6', width: 1.6, passes: 1, seed: s + fx });
      line(ctx, fx, fy - 4, fx, fy + 4, { color: '#dff0f6', width: 1.6, passes: 1, seed: s + fx + 1 });
    }
  },

  // ---------------------------------------------------------------- nurikabe
  nurikabe(ctx, s) {
    const plaster = '#8a8478';
    // stubby feet under the slab
    shape(ctx, [[34, 112], [50, 112], [48, 124], [32, 124]], { ...P, width: 2.2, fill: shade(plaster, -0.2), seed: s + 1 });
    shape(ctx, [[86, 112], [102, 112], [104, 124], [88, 124]], { ...P, width: 2.2, fill: shade(plaster, -0.2), seed: s + 2 });
    // the wall itself: a slab with worn corners
    shape(ctx, [[18, 26], [116, 22], [120, 114], [14, 116]], { ...P, width: 3.2, fill: plaster, seed: s + 3 });
    shape(ctx, [[24, 32], [110, 28], [113, 60], [22, 64]], { color: null, fill: shade(plaster, 0.1), seed: s + 4 });
    // cracks and moss: it has stood in the road a long time
    stroke(ctx, [[40, 114], [46, 92], [40, 74]], { color: shade(plaster, -0.4), width: 1.8, passes: 1, seed: s + 5 });
    stroke(ctx, [[96, 24], [92, 44], [98, 58]], { color: shade(plaster, -0.4), width: 1.8, passes: 1, seed: s + 6 });
    for (const [mx, my] of [[30, 104], [104, 100], [24, 44]]) {
      circle(ctx, mx, my, 5, { color: null, fill: 'rgba(111, 155, 82, 0.5)', seed: s + mx });
    }
    // small arms out of the sides
    stroke(ctx, [[18, 70], [6, 80]], { color: plaster, width: 7, seed: s + 7 });
    stroke(ctx, [[116, 66], [126, 76]], { color: plaster, width: 7, seed: s + 8 });
    // two sleepy eyes high up, and a flat unimpressed mouth
    evilEye(ctx, 48, 52, 6, s + 9, '#e8dcc4');
    evilEye(ctx, 78, 50, 6, s + 10, '#e8dcc4');
    stroke(ctx, [[44, 78], [66, 80], [84, 77]], { color: INK, width: 2.6, seed: s + 11 });
  },

  // --------------------------------------------------------------------- oni
  oni(ctx, s) {
    const skin = '#c1503f';
    // heavy legs
    stroke(ctx, [[56, 96], [50, 112], [46, 124]], { color: skin, width: 11, seed: s + 1 });
    stroke(ctx, [[84, 96], [90, 112], [88, 124]], { color: skin, width: 11, seed: s + 2 });
    // the kanabō club, resting over the right shoulder
    stroke(ctx, [[96, 88], [116, 40], [122, 18]], { color: '#3f3128', width: 10, seed: s + 3 });
    for (let i = 0; i < 4; i++) {
      circle(ctx, 108 + i * 4, 62 - i * 14, 2.6, { color: null, fill: '#8a8478', seed: s + 20 + i });
    }
    // barrel torso
    body(ctx, 70, 72, 34, 30, skin, s + 4);
    stroke(ctx, [[52, 62], [70, 58], [88, 62]], { color: shade(skin, -0.25), width: 2, passes: 1, seed: s + 5 });
    // tiger-skin loincloth
    shape(ctx, [[48, 92], [92, 90], [96, 112], [44, 114]], { ...P, width: 2.4, fill: '#e5b93c', seed: s + 6 });
    for (let i = 0; i < 4; i++) {
      shape(ctx, [[52 + i * 11, 92], [58 + i * 11, 92], [54 + i * 11, 112]], { color: null, fill: '#3f3128', seed: s + 30 + i });
    }
    // arms: one holds the club, the other swings
    stroke(ctx, [[48, 60], [30, 74], [24, 92]], { color: skin, width: 9, seed: s + 7 });
    stroke(ctx, [[92, 60], [100, 76], [96, 88]], { color: skin, width: 9, seed: s + 8 });
    // head with horns, wild hair and tusks
    body(ctx, 64, 36, 23, 21, skin, s + 9);
    fuzz(ctx, 64, 26, 20, 10, '#211c26', s + 10, 12, 8);
    horn(ctx, 50, 20, 16, '#e8dcc4', s + 11, -1.9);
    horn(ctx, 80, 18, 16, '#e8dcc4', s + 12, -1.2);
    evilEye(ctx, 55, 34, 6, s + 13, '#f2c94c');
    evilEye(ctx, 74, 33, 6, s + 14, '#f2c94c');
    shape(ctx, [[50, 46], [80, 44], [76, 54], [54, 56]], { color: INK, width: 2.2, fill: '#3f3128', seed: s + 15 });
    teeth(ctx, 52, 53, 78, 6, s + 16, false);
  },

  // ------------------------------------------------------------------- onryō
  onryo(ctx, s) {
    const robe = '#f4f1e8';
    // the burial kimono frays into drifting rags — nothing touches the ground
    for (let i = 0; i < 4; i++) {
      shape(ctx, [[38 + i * 18, 100], [44 + i * 18, 96], [40 + i * 18, 122], [34 + i * 18, 116]], {
        color: null, fill: 'rgba(238, 235, 226, 0.75)', seed: s + 30 + i,
      });
    }
    shape(ctx, [[46, 40], [90, 38], [100, 96], [68, 106], [36, 96]], { ...P, width: 2.6, fill: robe, seed: s + 1 });
    // hands hanging limp in front, too pale
    stroke(ctx, [[52, 52], [40, 70], [42, 86]], { color: robe, width: 8, seed: s + 2 });
    stroke(ctx, [[86, 50], [96, 66], [92, 84]], { color: robe, width: 8, seed: s + 3 });
    circle(ctx, 42, 90, 5, { color: INK, width: 1.8, fill: '#cfe0e6', seed: s + 4 });
    circle(ctx, 92, 88, 5, { color: INK, width: 1.8, fill: '#cfe0e6', seed: s + 5 });
    // the hair: a black curtain over the whole face
    shape(ctx, [[44, 8], [92, 8], [98, 56], [92, 78], [82, 52], [76, 80], [66, 50], [58, 82], [48, 54], [40, 76]], {
      ...P, width: 2.6, fill: '#211c26', seed: s + 6,
    });
    shape(ctx, [[52, 12], [84, 12], [88, 40], [50, 42]], { color: null, fill: '#16121c', seed: s + 7 });
    // the white funeral triangle, crooked on the crown
    shape(ctx, [[58, 12], [78, 10], [68, 0]], { ...P, width: 2, fill: robe, seed: s + 8 });
    // one eye through the parting — it has been watching the whole time
    evilEye(ctx, 66, 34, 6.5, s + 9, '#f2c94c');
    // grave-fire drifting off her shoulders
    for (let i = 0; i < 2; i++) {
      const fx = 26 + i * 84;
      const fy = 34 - i * 10;
      shape(ctx, [[fx - 4, fy], [fx - 1, fy - 9], [fx + 1, fy - 14], [fx + 4, fy - 7], [fx + 5, fy]], {
        color: '#3d7791', width: 1.6, fill: '#9fe0e6', alpha: 0.8, seed: s + 50 + i,
      });
    }
  },
};

/** Cached monster sprite. Volume a touch harder than on the animals. */
export function monsterSprite(id, size = 128) {
  return sprite(`monster:${id}:${size}`, size, size, (ctx, w, h) => {
    ctx.save();
    ctx.scale(w / 128, h / 128);
    const paint = drawings[id];
    if (paint) paint(ctx, (id.charCodeAt(0) * 53 + id.length * 17) | 0);
    ctx.restore();
    volume(ctx, w, h, 0.9);
  });
}

export const DRAWN_MONSTERS = Object.keys(drawings);
