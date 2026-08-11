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
