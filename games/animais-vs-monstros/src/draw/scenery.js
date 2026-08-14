// The stage backdrops. Each biome is a function that paints the world behind
// the board; the field itself (the lane bands) goes on top, in battle.js.
//
// A rule that holds for all of them: the horizon sits high (HZ ≈ 16% of the
// height) and the rest is flat ground. Big scenery in the middle of the field
// looks lovely in a gallery and gets in the way of the game — reading the board
// comes before the landscape. So the props are small, anchored to the horizon,
// and the ground carries only a faint texture.
//
// A whole backdrop is expensive to draw, so each one is painted once on an
// offscreen canvas and reused.

import { shape, ellipse, circle, line, stroke, ellipsePoints, sprite, rng, paper } from '../scribble.js';
import { COLORS, shade, withAlpha } from '../palette.js';
import { OUTLINE } from './common.js';

const P = OUTLINE;
// The horizon sits very high: the field has 5 lanes and every one of them has
// to land on the ground. With the horizon in the middle, the top two would be
// "in the sky".
const HORIZON = 0.16;

function sky(ctx, w, h, colors) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function hills(ctx, w, yBase, color, s, height, count = 5) {
  const r = rng(s);
  for (let i = 0; i < count; i++) {
    const cx = (i / (count - 1)) * w + (r() - 0.5) * 90;
    shape(ctx, ellipsePoints(cx, yBase, 150 + r() * 140, height * (0.6 + r() * 0.7), 12), {
      color: shade(color, -0.25), width: 2.4, fill: color, seed: s + i * 13,
    });
  }
}

function tree(ctx, x, yBase, height, crownColor, s, trunkColor = '#6b4a2f') {
  const tw = height * 0.11;
  shape(
    ctx,
    [[x - tw, yBase], [x - tw * 0.6, yBase - height * 0.55], [x + tw * 0.6, yBase - height * 0.55], [x + tw, yBase]],
    { ...P, width: 2, fill: trunkColor, seed: s }
  );
  const r = rng(s + 7);
  for (let i = 0; i < 4; i++) {
    circle(ctx, x + (r() - 0.5) * height * 0.42, yBase - height * (0.62 + r() * 0.3), height * (0.2 + r() * 0.16), {
      color: shade(crownColor, -0.3), width: 2.2, fill: i % 2 ? crownColor : shade(crownColor, -0.1), seed: s + i * 9,
    });
  }
}

function palm(ctx, x, yBase, height, s, leafColor = '#5d8a3f') {
  stroke(ctx, [[x, yBase], [x - height * 0.08, yBase - height * 0.55], [x + height * 0.04, yBase - height]], {
    color: '#8a6a44', width: Math.max(3, height * 0.075), seed: s,
  });
  const top = [x + height * 0.04, yBase - height];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    const cx = top[0] + Math.cos(a) * height * 0.36;
    const cy = top[1] + Math.sin(a) * height * 0.2 + height * 0.08;
    shape(
      ctx,
      [[top[0], top[1]], [(top[0] + cx) / 2, (top[1] + cy) / 2 - height * 0.1], [cx, cy], [(top[0] + cx) / 2, (top[1] + cy) / 2 + height * 0.04]],
      { color: shade(leafColor, -0.3), width: 1.8, fill: i % 2 ? leafColor : shade(leafColor, -0.12), seed: s + i * 11 }
    );
  }
}

function cactus(ctx, x, yBase, height, s) {
  const color = '#5f7a44';
  const w = height * 0.13;
  shape(ctx, [[x - w, yBase], [x - w, yBase - height], [x + w, yBase - height], [x + w, yBase]], {
    ...P, width: 2.2, fill: color, seed: s,
  });
  for (const side of [-1, 1]) {
    const y = yBase - height * (0.5 + (side > 0 ? 0.16 : 0));
    shape(
      ctx,
      [
        [x + side * w, y], [x + side * w * 3.2, y], [x + side * w * 3.2, y - height * 0.3],
        [x + side * w * 1.9, y - height * 0.3], [x + side * w * 1.9, y - height * 0.05], [x + side * w, y - height * 0.05],
      ],
      { ...P, width: 2, fill: shade(color, -0.08), seed: s + side * 5 }
    );
  }
}

function building(ctx, x, yBase, width, height, s, lit = false) {
  const color = ['#8f8b84', '#a09489', '#7d7a75'][Math.abs(s) % 3];
  shape(ctx, [[x, yBase], [x, yBase - height], [x + width, yBase - height], [x + width, yBase]], {
    ...P, width: 2.2, fill: color, seed: s,
  });
  const r = rng(s + 3);
  const cols = Math.max(2, Math.floor(width / 24));
  const rows = Math.max(2, Math.floor(height / 26));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const jx = x + 7 + i * ((width - 12) / cols);
      const jy = yBase - height + 10 + j * ((height - 16) / rows);
      const light = lit && r() < 0.4;
      shape(ctx, [[jx, jy], [jx + 8, jy], [jx + 8, jy + 11], [jx, jy + 11]], {
        color: shade(color, -0.35), width: 1.3, fill: light ? '#f2c94c' : shade(color, -0.22), seed: s + i * 7 + j,
      });
    }
  }
}

/** Low grass — used at low alpha, just so the ground isn't flat. */
function tuft(ctx, x, y, width, color, s, scale = 1) {
  const r = rng(s);
  for (let i = 0; i < 5; i++) {
    const px = x + (r() - 0.5) * width;
    const tall = (8 + r() * 14) * scale;
    stroke(ctx, [[px, y], [px + (r() - 0.5) * 6, y - tall * 0.6], [px + (r() - 0.5) * 10, y - tall]], {
      color, width: 1.8, passes: 1, seed: s + i * 3,
    });
  }
}

function cloud(ctx, x, y, scale, s, color = '#fbf7ee') {
  const r = rng(s);
  for (let i = 0; i < 4; i++) {
    circle(ctx, x + i * 22 * scale - 30 * scale, y + (r() - 0.5) * 10 * scale, (14 + r() * 10) * scale, {
      color: 'rgba(43,38,34,0.15)', width: 1.8, fill: color, seed: s + i * 5,
    });
  }
}

/** A white picket fence, on the horizon line. */
function picketFence(ctx, w, y, height, s) {
  const step = height * 0.62;
  for (let x = -step; x < w + step; x += step) {
    shape(
      ctx,
      [[x, y], [x, y - height * 0.78], [x + step * 0.28, y - height], [x + step * 0.56, y - height * 0.78], [x + step * 0.56, y]],
      { color: '#8a8f7a', width: 1.8, fill: '#f4f1e4', seed: s + x }
    );
  }
  // rails
  for (const t of [0.34, 0.68]) {
    shape(
      ctx,
      [[-10, y - height * t], [w + 10, y - height * t], [w + 10, y - height * t + height * 0.14], [-10, y - height * t + height * 0.14]],
      { color: '#8a8f7a', width: 1.6, fill: '#e8e4d4', seed: s + t * 100 }
    );
  }
}

/** Faint ground texture, spread over the whole playable area. */
function ground(ctx, w, h, hz, color, grassColor, s, density = 30) {
  ctx.fillStyle = color;
  ctx.fillRect(0, hz, w, h - hz);
  ctx.save();
  ctx.globalAlpha = 0.3;
  const r = rng(s);
  for (let i = 0; i < density; i++) {
    tuft(ctx, r() * w, hz + 10 + r() * (h - hz - 10), 30, grassColor, s + i * 7, 0.85);
  }
  ctx.restore();
}

// ------------------------------------------------------------------- biomes

const biomes = {
  forest(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#6fc2e8', '#a3dcf0', '#d4eddc']);
    for (let i = 0; i < 4; i++) cloud(ctx, 120 + i * 340, hz * 0.3 + (i % 2) * 26, 1, 100 + i);
    hills(ctx, w, hz, '#6aa347', 11, h * 0.1, 5);
    ground(ctx, w, h, hz, '#7cb342', '#4f8a2c', 200);
    for (let i = 0; i < 7; i++) tree(ctx, 40 + i * (w / 6.5), hz + 6, h * (0.15 + (i % 3) * 0.025), '#4a8f32', 40 + i * 17);
    picketFence(ctx, w, hz + 4, h * 0.055, 210);
  },

  cerrado(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#dfd08a', '#ecdfa8', '#efe0b4']);
    for (let i = 0; i < 3; i++) cloud(ctx, 200 + i * 420, hz * 0.28, 1.1, 150 + i, '#fdf8e8');
    hills(ctx, w, hz, '#b39a5c', 31, h * 0.08, 4);
    ground(ctx, w, h, hz, '#c2a866', '#a89552', 300, 36);
    for (let i = 0; i < 6; i++) {
      const x = 70 + i * (w / 5.5);
      const tall = h * 0.14;
      stroke(ctx, [[x, hz + 4], [x + 10, hz + 4 - tall * 0.4], [x - 6, hz + 4 - tall * 0.72], [x + 4, hz + 4 - tall]], {
        color: '#6b5232', width: 6, seed: 60 + i,
      });
      for (let j = 0; j < 3; j++) {
        circle(ctx, x + (j - 1) * tall * 0.24, hz + 4 - tall * 1.06 - (j % 2) * tall * 0.12, tall * 0.2, {
          color: '#5a6b34', width: 2, fill: '#78894a', seed: 70 + i * 4 + j,
        });
      }
    }
  },

  pantanal(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#bcd9e6', '#dbe9dd', '#e2e6c8']);
    for (let i = 0; i < 4; i++) cloud(ctx, 90 + i * 330, hz * 0.3 + (i % 3) * 22, 1, 400 + i);
    hills(ctx, w, hz, '#8aa564', 41, h * 0.07, 4);
    ground(ctx, w, h, hz, '#93a862', '#6f8f46', 500, 32);
    // puddles that don't get in the way of reading the lanes
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      shape(ctx, ellipsePoints(120 + i * (w / 4.6), hz + 30 + (i % 2) * 40, 90, 20, 12), {
        color: COLORS.waterDark, width: 1.8, fill: withAlpha(COLORS.water, 0.6), seed: 50 + i,
      });
    }
    ctx.restore();
    for (let i = 0; i < 5; i++) palm(ctx, 60 + i * (w / 4.5), hz + 8, h * 0.16, 80 + i * 9, '#4f7a3a');
  },

  caatinga(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#f2e2c0', '#f7ecd2', '#f2e4c4']);
    circle(ctx, w * 0.8, hz * 0.36, 36, { color: '#e8c76a', width: 2.6, fill: '#f7e9a8', seed: 9 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      line(
        ctx,
        w * 0.8 + Math.cos(a) * 44, hz * 0.36 + Math.sin(a) * 44,
        w * 0.8 + Math.cos(a) * 58, hz * 0.36 + Math.sin(a) * 58,
        { color: '#e8c76a', width: 2.4, passes: 1, seed: 20 + i }
      );
    }
    hills(ctx, w, hz, '#c69a6c', 61, h * 0.07, 4);
    ground(ctx, w, h, hz, '#d4a97a', '#b58a5c', 600, 18);
    // lightly cracked ground
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 20; i++) {
      const x = (i * 137) % w;
      const y = hz + 30 + (i % 7) * ((h - hz) / 7);
      stroke(ctx, [[x, y], [x + 40, y + 10], [x + 70, y + 3]], { color: '#a87d52', width: 1.8, passes: 1, seed: 610 + i });
    }
    ctx.restore();
    for (let i = 0; i < 5; i++) cactus(ctx, 80 + i * (w / 4.6), hz + 8, h * (0.11 + (i % 3) * 0.02), 90 + i * 7);
  },

  amazon(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#7fa88e', '#9dbf9a', '#aec7a0']);
    hills(ctx, w, hz, '#3f6b3f', 71, h * 0.09, 5);
    ground(ctx, w, h, hz, '#537a44', '#3f6b38', 950, 34);
    // forest in three layers, compressed against the horizon
    for (let layer = 0; layer < 3; layer++) {
      const y = hz + layer * 10;
      const color = ['#3d6136', '#48713d', '#557f45'][layer];
      for (let i = 0; i < 9 - layer; i++) {
        tree(ctx, 20 + i * (w / (8 - layer)) + layer * 40, y, h * (0.17 - layer * 0.025), color, 800 + layer * 20 + i);
      }
    }
    // vines hanging from the top
    for (let i = 0; i < 8; i++) {
      const x = (i * 167) % w;
      stroke(ctx, [[x, 0], [x + 12, hz * 0.35], [x - 6, hz * 0.7]], { color: '#3f5f38', width: 2.4, alpha: 0.75, seed: 900 + i });
    }
  },

  beach(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#1e2a4a', '#37456b', '#55617e']);
    circle(ctx, w * 0.84, hz * 0.34, 26, { color: '#d9cfa8', width: 2.2, fill: '#f2ead0', seed: 3 });
    circle(ctx, w * 0.87, hz * 0.29, 21, { color: null, fill: '#37456b', seed: 4 });
    const r = rng(1234);
    for (let i = 0; i < 50; i++) {
      circle(ctx, r() * w, r() * hz * 0.85, r() * 1.6 + 0.6, {
        color: null, fill: withAlpha('#f2ead0', 0.4 + r() * 0.5), seed: 1000 + i,
      });
    }
    // a strip of sea just below the horizon
    ctx.fillStyle = '#2f4f66';
    ctx.fillRect(0, hz, w, h * 0.07);
    for (let i = 0; i < 14; i++) {
      stroke(
        ctx,
        [[i * (w / 13) - 20, hz + 12 + (i % 3) * 8], [i * (w / 13) + 30, hz + 16 + (i % 3) * 8], [i * (w / 13) + 70, hz + 12 + (i % 3) * 8]],
        { color: withAlpha('#9fc4d4', 0.55), width: 1.8, passes: 1, seed: 1100 + i }
      );
    }
    ground(ctx, w, h, hz + h * 0.07, '#c9b48c', '#a89268', 1150, 14);
    for (let i = 0; i < 5; i++) palm(ctx, 70 + i * (w / 4.4), hz + h * 0.08, h * 0.16, 1200 + i * 11, '#3f5f38');
  },

  city(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#8e97a6', '#a8adb4', '#bab5aa']);
    for (let i = 0; i < 3; i++) cloud(ctx, 160 + i * 400, hz * 0.26, 1.2, 1300 + i, '#d6d2c8');
    let x = -20;
    let i = 0;
    while (x < w) {
      const bw = 56 + ((i * 37) % 46);
      building(ctx, x, hz + 4, bw, h * (0.1 + ((i * 53) % 100) / 900), 1400 + i);
      x += bw + 6;
      i++;
    }
    // asphalt
    ctx.fillStyle = '#5f5c58';
    ctx.fillRect(0, hz, w, h - hz);
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let j = 0; j < 16; j++) {
      shape(
        ctx,
        [[j * (w / 15), hz + 14], [j * (w / 15) + 40, hz + 14], [j * (w / 15) + 40, hz + 20], [j * (w / 15), hz + 20]],
        { color: null, fill: '#d9cfa8', seed: 1500 + j }
      );
    }
    // oil stains
    const r = rng(1550);
    for (let k = 0; k < 14; k++) {
      ellipse(ctx, r() * w, hz + 30 + r() * (h - hz - 40), 20 + r() * 30, 8 + r() * 10, {
        color: null, fill: '#4a4744', seed: 1560 + k,
      });
    }
    ctx.restore();
  },

  highlands(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#93a6b5', '#b4c0c4', '#c4c9bc']);
    for (let layer = 0; layer < 3; layer++) {
      const base = hz - layer * 4;
      const peak = h * (0.17 - layer * 0.04);
      const color = ['#5d6b74', '#6e7b80', '#7f8a86'][layer];
      const points = [[-20, base]];
      for (let i = 0; i <= 7; i++) {
        points.push([i * (w / 7) - 40 + layer * 30, base - peak * (0.5 + ((i * 7 + layer) % 5) / 6)]);
        points.push([i * (w / 7) + w / 14 - 40 + layer * 30, base - peak * 0.12]);
      }
      points.push([w + 20, base], [w + 20, base + 30], [-20, base + 30]);
      shape(ctx, points, { color: shade(color, -0.3), width: 2.2, fill: color, seed: 1700 + layer });
    }
    ground(ctx, w, h, hz, '#6b7a55', '#5c6b46', 1900, 30);
    for (let i = 0; i < 6; i++) {
      const x = 60 + i * (w / 5.5);
      const tall = h * 0.15;
      line(ctx, x, hz + 6, x, hz + 6 - tall, { color: '#5c4633', width: 5, seed: 1800 + i });
      for (let j = 0; j < 5; j++) {
        const yy = hz + 6 - tall * 0.31 - j * tall * 0.185;
        const half = tall * (0.35 - j * 0.03);
        shape(ctx, [[x - half, yy], [x, yy - tall * 0.17], [x + half, yy]], {
          color: '#33502f', width: 2, fill: '#3f6138', seed: 1810 + i * 6 + j,
        });
      }
    }
  },

  christ(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#241d38', '#4a3355', '#6b4453']);
    const r = rng(77);
    for (let i = 0; i < 60; i++) {
      circle(ctx, r() * w, r() * hz * 0.9, r() * 1.6 + 0.6, {
        color: null, fill: withAlpha('#f2ead0', 0.35 + r() * 0.5), seed: 2000 + i,
      });
    }
    hills(ctx, w, hz, '#3a3149', 2110, h * 0.08, 5);
    // Sugarloaf Mountain
    shape(ctx, [[w * 0.08, hz], [w * 0.14, hz - h * 0.16], [w * 0.2, hz]], {
      color: '#2f2740', width: 2.4, fill: '#3d3350', seed: 2100,
    });

    // the Christ, high on the right, above the line of buildings.
    // `e` is the drawing's unit: the whole statue is ~122 units tall, and we
    // want it to fill half the strip of sky.
    const cx = w * 0.76;
    const base = hz - 4;
    const e = (hz * 0.62) / 122;
    const g = ctx.createRadialGradient(cx, base, 6, cx, base - 60 * e, 130 * e);
    g.addColorStop(0, 'rgba(242, 201, 76, 0.32)');
    g.addColorStop(1, 'rgba(242, 201, 76, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 150 * e, base - 190 * e, 300 * e, 210 * e);
    shape(ctx, [[cx - 38 * e, base], [cx - 28 * e, base - 30 * e], [cx + 28 * e, base - 30 * e], [cx + 38 * e, base]], {
      color: '#2b2438', width: 2, fill: '#4f4560', seed: 2300,
    });
    shape(
      ctx,
      [[cx - 17 * e, base - 30 * e], [cx - 13 * e, base - 110 * e], [cx + 13 * e, base - 110 * e], [cx + 17 * e, base - 30 * e]],
      { color: '#2b2438', width: 2, fill: '#9a90ac', seed: 2310 }
    );
    shape(
      ctx,
      [[cx - 72 * e, base - 106 * e], [cx + 72 * e, base - 106 * e], [cx + 72 * e, base - 94 * e], [cx - 72 * e, base - 94 * e]],
      { color: '#2b2438', width: 2, fill: '#9a90ac', seed: 2320 }
    );
    circle(ctx, cx, base - 122 * e, 11 * e, { color: '#2b2438', width: 2, fill: '#9a90ac', seed: 2330 });

    // the lit city on the strip just below the horizon
    let x = -10;
    let i = 0;
    while (x < w) {
      const bw = 24 + ((i * 29) % 26);
      building(ctx, x, hz + h * 0.05, bw, h * (0.03 + ((i * 41) % 60) / 1400), 2200 + i, true);
      x += bw + 4;
      i++;
    }
    ground(ctx, w, h, hz + h * 0.05, '#3a3a44', '#4a4a54', 2400, 16);
  },
  // ---------------------------------------------------------- Japan biomes

  sakura(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#f2d4dc', '#f7e4e0', '#efe6d4']);
    // Fuji far away, faint
    shape(ctx, [[w * 0.62, hz], [w * 0.72, hz - h * 0.13], [w * 0.82, hz]], {
      color: '#b0a4b4', width: 2, fill: '#cfc4d4', seed: 3000,
    });
    shape(ctx, [[w * 0.685, hz - h * 0.085], [w * 0.72, hz - h * 0.13], [w * 0.755, hz - h * 0.085]], {
      color: null, fill: '#f4f1e8', seed: 3001,
    });
    hills(ctx, w, hz, '#8aa564', 3010, h * 0.08, 4);
    ground(ctx, w, h, hz, '#93b060', '#6f8f46', 3100, 26);
    // cherry trees along the horizon, crowns of pink
    for (let i = 0; i < 6; i++) {
      const x = 60 + i * (w / 5.4);
      stroke(ctx, [[x, hz + 6], [x - 4, hz - h * 0.05], [x + 6, hz - h * 0.1]], { color: '#5c4633', width: 6, seed: 3200 + i });
      const r = rng(3220 + i);
      for (let j = 0; j < 4; j++) {
        circle(ctx, x + (r() - 0.5) * h * 0.09, hz - h * (0.09 + r() * 0.06), h * (0.032 + r() * 0.02), {
          color: '#d9a0b4', width: 2, fill: j % 2 ? '#f2c4d0' : '#e8b0c4', seed: 3240 + i * 5 + j,
        });
      }
    }
    // petals drifting down over the field
    ctx.save();
    ctx.globalAlpha = 0.5;
    const rp = rng(3300);
    for (let i = 0; i < 26; i++) {
      const px = rp() * w;
      const py = hz + rp() * (h - hz);
      shape(ctx, [[px, py], [px + 5, py + 2], [px + 3, py + 6]], { color: null, fill: '#f2c4d0', seed: 3310 + i });
    }
    ctx.restore();
  },

  rice(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#a8d4e0', '#cde4dc', '#dde8c8']);
    for (let i = 0; i < 3; i++) cloud(ctx, 150 + i * 420, hz * 0.3, 1, 3400 + i);
    // terraced paddies stacked against the horizon: bands of water and green
    for (let i = 0; i < 4; i++) {
      const y = hz - i * 9 - 4;
      shape(ctx, [[-10, y], [w + 10, y - 4], [w + 10, y + 5], [-10, y + 9]], {
        color: '#7a9b58', width: 1.6, fill: i % 2 ? withAlpha('#9fd4e6', 0.75) : '#8fbf68', seed: 3420 + i,
      });
    }
    ground(ctx, w, h, hz, '#8bb058', '#5f8f3c', 3500, 30);
    // seedling rows combed into the mud
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 9; i++) {
      const y = hz + 24 + i * ((h - hz - 30) / 9);
      stroke(ctx, [[0, y], [w * 0.5, y + 4], [w, y]], { color: '#4f7a2c', width: 1.8, passes: 1, seed: 3520 + i });
    }
    ctx.restore();
    // a scarecrow in a straw hat, off to one side
    const sx = w * 0.16;
    line(ctx, sx, hz + 4, sx, hz - h * 0.09, { color: '#6b4a2f', width: 4, seed: 3600 });
    line(ctx, sx - h * 0.045, hz - h * 0.055, sx + h * 0.045, hz - h * 0.055, { color: '#6b4a2f', width: 3.5, seed: 3601 });
    shape(ctx, [[sx - 12, hz - h * 0.085], [sx + 12, hz - h * 0.085], [sx, hz - h * 0.12]], {
      color: '#8a6a3d', width: 2, fill: '#c9a86a', seed: 3602,
    });
  },

  bamboo(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#c4d9b0', '#d4e4bc', '#dfe8c4']);
    ground(ctx, w, h, hz, '#7a9b58', '#587c3d', 3700, 30);
    // bamboo stalks: tall verticals with knuckles, three depths
    for (let layer = 0; layer < 3; layer++) {
      const color = ['#4f7a3a', '#5f8f44', '#6fa050'][layer];
      const n = 8 - layer * 2;
      for (let i = 0; i < n; i++) {
        const x = 30 + i * (w / (n - 0.5)) + layer * 60;
        const top = -10 - layer * 6;
        const lean = ((i + layer) % 3 - 1) * 10;
        stroke(ctx, [[x, hz + 8], [x + lean, hz * 0.5], [x + lean * 1.6, top]], {
          color, width: 9 - layer * 2, seed: 3720 + layer * 20 + i,
        });
        for (let k = 1; k < 4; k++) {
          const ky = hz + 8 - k * (hz / 3.4);
          line(ctx, x + lean * (k / 3) - 6, ky, x + lean * (k / 3) + 6, ky, {
            color: shade(color, -0.3), width: 2, passes: 1, seed: 3760 + i * 4 + k,
          });
        }
        // sparse leaf tufts high up
        for (let k = 0; k < 2; k++) {
          shape(ctx, [[x + lean + 4, hz * 0.3 - k * 26], [x + lean + 26, hz * 0.24 - k * 26], [x + lean + 8, hz * 0.34 - k * 26]], {
            color: null, fill: shade(color, 0.12), seed: 3790 + i * 3 + k,
          });
        }
      }
    }
    // fallen leaves on the moss
    ctx.save();
    ctx.globalAlpha = 0.35;
    const r = rng(3800);
    for (let i = 0; i < 18; i++) {
      const lx = r() * w;
      const ly = hz + 20 + r() * (h - hz - 26);
      shape(ctx, [[lx, ly], [lx + 9, ly + 2], [lx + 4, ly + 5]], { color: null, fill: '#a3b36e', seed: 3810 + i });
    }
    ctx.restore();
  },

  mountainjp(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#9bb0c4', '#c4cdd0', '#d4d4c4']);
    // steep crags in layers, pines clinging to them
    for (let layer = 0; layer < 3; layer++) {
      const base = hz - layer * 3;
      const peak = h * (0.16 - layer * 0.035);
      const color = ['#5b6b74', '#6e7d82', '#808d88'][layer];
      for (let i = 0; i < 4 + layer; i++) {
        const cx = i * (w / (3 + layer)) + layer * 70;
        shape(ctx, [[cx - 90, base], [cx - 30, base - peak * (0.7 + ((i + layer) % 3) * 0.15)], [cx - 10, base - peak * 0.4], [cx + 40, base - peak], [cx + 100, base]], {
          color: shade(color, -0.3), width: 2.2, fill: color, seed: 3900 + layer * 20 + i,
        });
      }
    }
    // mist between the ridges
    ctx.save();
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 4; i++) {
      shape(ctx, ellipsePoints(120 + i * (w / 3.6), hz - h * 0.04 - (i % 2) * 14, 120, 13, 12), {
        color: null, fill: '#e8ecec', seed: 3960 + i,
      });
    }
    ctx.restore();
    ground(ctx, w, h, hz, '#6f8055', '#566b42', 4000, 28);
    // flat-topped pines, and a small red torii by the trail
    for (let i = 0; i < 5; i++) {
      const x = 90 + i * (w / 4.6);
      line(ctx, x, hz + 6, x, hz - h * 0.075, { color: '#4a3b30', width: 4.5, seed: 4020 + i });
      for (let j = 0; j < 3; j++) {
        const y = hz - h * (0.045 + j * 0.022);
        shape(ctx, ellipsePoints(x + (j % 2 ? 8 : -8), y, h * (0.04 - j * 0.008), h * 0.012, 10), {
          color: '#33502f', width: 1.8, fill: '#3f6138', seed: 4040 + i * 4 + j,
        });
      }
    }
    const tx = w * 0.8;
    const th = h * 0.075;
    line(ctx, tx - th * 0.5, hz + 4, tx - th * 0.5, hz + 4 - th, { color: '#c1503f', width: 5, seed: 4100 });
    line(ctx, tx + th * 0.5, hz + 4, tx + th * 0.5, hz + 4 - th, { color: '#c1503f', width: 5, seed: 4101 });
    line(ctx, tx - th * 0.75, hz + 4 - th, tx + th * 0.75, hz + 4 - th, { color: '#a8402f', width: 6, seed: 4102 });
    line(ctx, tx - th * 0.55, hz + 4 - th * 0.7, tx + th * 0.55, hz + 4 - th * 0.7, { color: '#c1503f', width: 4, seed: 4103 });
  },

  snow(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#8ea4b8', '#b8c4cc', '#d8dce0']);
    // one great snowed cone — Hokkaidō's ridge or Fuji itself, as the stage says
    shape(ctx, [[w * 0.4, hz], [w * 0.6, hz - h * 0.15], [w * 0.8, hz]], {
      color: '#6e7d8c', width: 2.4, fill: '#8494a4', seed: 4200,
    });
    shape(ctx, [[w * 0.52, hz - h * 0.09], [w * 0.6, hz - h * 0.15], [w * 0.68, hz - h * 0.09], [w * 0.63, hz - h * 0.1], [w * 0.57, hz - h * 0.1]], {
      color: null, fill: '#f4f6f8', seed: 4201,
    });
    hills(ctx, w, hz, '#a4b4c0', 4210, h * 0.06, 4);
    ground(ctx, w, h, hz, '#dfe6ea', '#b8c8d0', 4300, 12);
    // snowed pines
    for (let i = 0; i < 6; i++) {
      const x = 60 + i * (w / 5.4);
      const tall = h * 0.13;
      line(ctx, x, hz + 6, x, hz + 6 - tall, { color: '#4a3b30', width: 4, seed: 4320 + i });
      for (let j = 0; j < 4; j++) {
        const yy = hz + 6 - tall * 0.3 - j * tall * 0.18;
        const half = tall * (0.3 - j * 0.05);
        shape(ctx, [[x - half, yy], [x, yy - tall * 0.14], [x + half, yy]], {
          color: '#33502f', width: 2, fill: '#3f6138', seed: 4340 + i * 5 + j,
        });
        line(ctx, x - half * 0.7, yy - tall * 0.05, x + half * 0.7, yy - tall * 0.05, {
          color: '#f4f6f8', width: 3, passes: 1, seed: 4360 + i * 5 + j,
        });
      }
    }
    // falling snow, frozen mid-air
    const r = rng(4400);
    for (let i = 0; i < 40; i++) {
      circle(ctx, r() * w, r() * h, 1.2 + r() * 1.8, {
        color: null, fill: `rgba(255, 255, 255, ${0.4 + r() * 0.4})`, seed: 4410 + i,
      });
    }
  },

  neon(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#141224', '#241c38', '#38284a']);
    // towers wearing signs instead of windows
    let x = -20;
    let i = 0;
    const neons = ['#e864a0', '#4fd4e0', '#f2c94c', '#8fd48f', '#c17ae8'];
    while (x < w) {
      const bw = 60 + ((i * 37) % 50);
      const bh = h * (0.1 + ((i * 53) % 90) / 800);
      shape(ctx, [[x, hz + 4], [x, hz + 4 - bh], [x + bw, hz + 4 - bh], [x + bw, hz + 4]], {
        color: '#0f0d18', width: 2.2, fill: '#1c1830', seed: 4500 + i,
      });
      const r = rng(4520 + i);
      for (let j = 0; j < 3; j++) {
        if (r() < 0.4) continue;
        const sy = hz - bh + 10 + j * (bh / 3.4);
        const sw2 = bw * (0.4 + r() * 0.4);
        const color = neons[(i * 3 + j) % neons.length];
        shape(ctx, [[x + 6, sy], [x + 6 + sw2, sy], [x + 6 + sw2, sy + 9], [x + 6, sy + 9]], {
          color: shade(color, -0.2), width: 1.4, fill: color, seed: 4540 + i * 4 + j,
        });
      }
      x += bw + 6;
      i++;
    }
    // wet asphalt catching the colours
    ctx.fillStyle = '#2a2734';
    ctx.fillRect(0, hz, w, h - hz);
    ctx.save();
    ctx.globalAlpha = 0.2;
    const rr = rng(4600);
    for (let k = 0; k < 12; k++) {
      const color = neons[k % neons.length];
      shape(ctx, ellipsePoints(rr() * w, hz + 30 + rr() * (h - hz - 40), 30 + rr() * 40, 6 + rr() * 6, 10), {
        color: null, fill: color, seed: 4610 + k,
      });
    }
    ctx.restore();
    // zebra crossing at the fence end — it is Shibuya after all
    ctx.save();
    ctx.globalAlpha = 0.3;
    for (let k = 0; k < 8; k++) {
      shape(ctx, [[30 + k * 46, hz + 12], [58 + k * 46, hz + 12], [52 + k * 46, hz + 26], [24 + k * 46, hz + 26]], {
        color: null, fill: '#d9d4c8', seed: 4650 + k,
      });
    }
    ctx.restore();
  },

  temple(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#a8a4b0', '#bcb4b8', '#c8bcac']);
    hills(ctx, w, hz, '#5d6b5c', 4700, h * 0.07, 4);
    // the pagoda, three roofs high, off to the right
    const px = w * 0.78;
    const pw = h * 0.14;
    for (let t = 0; t < 3; t++) {
      const y = hz + 2 - t * h * 0.055;
      const half = pw * (0.55 - t * 0.12);
      shape(ctx, [[px - half * 0.7, y], [px - half * 0.7, y - h * 0.03], [px + half * 0.7, y - h * 0.03], [px + half * 0.7, y]], {
        color: '#4a3b30', width: 2, fill: '#8a6a45', seed: 4720 + t,
      });
      shape(ctx, [[px - half, y - h * 0.03], [px, y - h * 0.056], [px + half, y - h * 0.03]], {
        color: '#2f2822', width: 2.2, fill: '#5b4a52', seed: 4730 + t,
      });
    }
    line(ctx, px, hz - h * 0.145, px, hz - h * 0.175, { color: '#4a3b30', width: 3, seed: 4740 });
    // dark cedars behind the wall
    for (let i = 0; i < 6; i++) tree(ctx, 50 + i * (w / 6), hz + 4, h * 0.11, '#3f5f38', 4750 + i * 9, '#3f3128');
    ground(ctx, w, h, hz, '#8a9578', '#6b7a55', 4800, 24);
    // stone lanterns on the horizon line, small and lit
    for (let i = 0; i < 4; i++) {
      const lx = 120 + i * (w / 3.8);
      const ly = hz + 6;
      const lt = h * 0.05;
      line(ctx, lx, ly, lx, ly - lt * 0.45, { color: '#6e6a63', width: 4, seed: 4820 + i });
      shape(ctx, [[lx - 7, ly - lt * 0.45], [lx + 7, ly - lt * 0.45], [lx + 5, ly - lt * 0.8], [lx - 5, ly - lt * 0.8]], {
        color: '#4a4744', width: 1.8, fill: '#9a958d', seed: 4830 + i,
      });
      shape(ctx, [[lx - 9, ly - lt * 0.8], [lx, ly - lt], [lx + 9, ly - lt * 0.8]], {
        color: '#4a4744', width: 1.8, fill: '#7d7a75', seed: 4840 + i,
      });
      circle(ctx, lx, ly - lt * 0.62, 2.4, { color: null, fill: '#f2c94c', seed: 4850 + i });
    }
  },

  castle(ctx, w, h) {
    const hz = h * HORIZON;
    sky(ctx, w, hz, ['#1a1730', '#2c2440', '#3d2c44']);
    const r = rng(4900);
    for (let i = 0; i < 50; i++) {
      circle(ctx, r() * w, r() * hz * 0.9, r() * 1.6 + 0.5, {
        color: null, fill: withAlpha('#f2ead0', 0.3 + r() * 0.5), seed: 4910 + i,
      });
    }
    circle(ctx, w * 0.14, hz * 0.34, 30, { color: '#d9cfa8', width: 2.2, fill: '#f2ead0', seed: 4960 });
    // the keep: stone base, then white tiers with curved dark roofs
    const cx = w * 0.72;
    const e = hz / 130;
    shape(ctx, [[cx - 90 * e, hz], [cx - 70 * e, hz - 34 * e], [cx + 70 * e, hz - 34 * e], [cx + 90 * e, hz]], {
      color: '#211c26', width: 2.4, fill: '#3d3a44', seed: 5000,
    });
    for (let t = 0; t < 3; t++) {
      const y = hz - 34 * e - t * 30 * e;
      const half = (62 - t * 14) * e;
      shape(ctx, [[cx - half, y], [cx - half, y - 20 * e], [cx + half, y - 20 * e], [cx + half, y]], {
        color: '#2b2438', width: 2.2, fill: '#ded8cc', seed: 5010 + t,
      });
      shape(ctx, [[cx - half - 10 * e, y - 20 * e], [cx - half * 0.5, y - 32 * e], [cx + half * 0.5, y - 32 * e], [cx + half + 10 * e, y - 20 * e]], {
        color: '#16121c', width: 2.4, fill: '#463c54', seed: 5020 + t,
      });
      stroke(ctx, [[cx - half - 10 * e, y - 20 * e], [cx - half - 14 * e, y - 24 * e]], { color: '#463c54', width: 3, seed: 5030 + t });
      stroke(ctx, [[cx + half + 10 * e, y - 20 * e], [cx + half + 14 * e, y - 24 * e]], { color: '#463c54', width: 3, seed: 5031 + t });
      // one lit window per tier: somebody is home
      if (t < 2) {
        shape(ctx, [[cx - 6 * e, y - 6 * e], [cx + 6 * e, y - 6 * e], [cx + 6 * e, y - 14 * e], [cx - 6 * e, y - 14 * e]], {
          color: '#2b2438', width: 1.6, fill: '#f2c94c', seed: 5040 + t,
        });
      }
    }
    // dark pines on the flanks
    for (let i = 0; i < 5; i++) tree(ctx, 60 + i * (w / 7), hz + 4, h * 0.1, '#1c2820', 5100 + i * 9, '#16121c');
    ground(ctx, w, h, hz, '#3a3a44', '#4a4a54', 5200, 16);
    // pale grave-fires drifting over the yard
    for (let i = 0; i < 3; i++) {
      const fx = 160 + i * (w / 3);
      const fy = hz + 60 + (i % 2) * 60;
      shape(ctx, [[fx - 5, fy], [fx - 2, fy - 12], [fx, fy - 18], [fx + 3, fy - 10], [fx + 5, fy]], {
        color: null, fill: withAlpha('#9fe0e6', 0.4), seed: 5210 + i,
      });
    }
  },
};

/** The stage's backdrop, cached. */
export function stageBackdrop(name, width, height) {
  return sprite(`scenery:${name}:${width}x${height}`, width, height, (ctx, w, h) => {
    const paint = biomes[name] || biomes.forest;
    paint(ctx, w, h);
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.globalCompositeOperation = 'multiply';
    paper(ctx, w, h, { seed: 5 });
    ctx.restore();
  });
}

export const BIOMES = Object.keys(biomes);
