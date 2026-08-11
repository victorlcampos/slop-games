// A scribbled world map. The outlines are lists of (longitude, latitude) —
// coarse on purpose, in the spirit of a map drawn from memory, but geographic
// enough that anyone finds Brazil on the first try.

import { shape, stroke, sprite } from '../scribble.js';
import { INK, shade } from '../palette.js';

const CONTINENTS = {
  northAmerica: [
    [-168, 65], [-160, 71], [-140, 70], [-120, 70], [-100, 69], [-85, 70], [-75, 74], [-60, 75],
    [-56, 60], [-65, 50], [-70, 45], [-75, 36], [-81, 25], [-90, 29], [-97, 26], [-105, 20],
    [-95, 15], [-84, 10], [-78, 8], [-83, 16], [-96, 19], [-110, 24], [-118, 33], [-125, 42],
    [-125, 50], [-135, 58], [-150, 60], [-165, 55],
  ],
  greenland: [
    [-45, 60], [-53, 65], [-56, 71], [-50, 78], [-40, 83], [-24, 82], [-19, 76], [-26, 70], [-36, 64],
  ],
  southAmerica: [
    [-81, 0], [-79, -5], [-75, -14], [-70, -18], [-70, -23], [-72, -31], [-73, -41], [-75, -50],
    [-69, -55], [-64, -55], [-62, -49], [-58, -39], [-56, -34], [-48, -25], [-40, -21], [-35, -8],
    [-35, -5], [-44, -2], [-50, 1], [-52, 5], [-60, 8], [-70, 12], [-76, 9], [-79, 7],
  ],
  africa: [
    [-17, 15], [-17, 22], [-10, 30], [0, 36], [10, 37], [20, 32], [32, 31], [35, 24], [43, 12],
    [51, 12], [48, 4], [42, -3], [40, -11], [35, -20], [32, -26], [25, -34], [18, -35], [12, -18],
    [9, -1], [5, 5], [-5, 5], [-10, 10],
  ],
  eurasia: [
    [-10, 36], [-9, 44], [0, 49], [5, 58], [10, 64], [25, 71], [40, 68], [60, 70], [80, 74],
    [100, 76], [120, 73], [140, 72], [160, 68], [175, 65], [179, 62], [160, 57], [145, 50],
    [140, 45], [130, 42], [126, 35], [120, 30], [110, 20], [105, 10], [100, 6], [95, 16],
    [90, 22], [80, 20], [72, 21], [68, 25], [60, 25], [55, 20], [50, 13], [43, 13], [35, 25],
    [32, 31], [28, 36], [20, 40], [12, 45], [4, 43], [-5, 36],
  ],
  oceania: [
    [113, -22], [114, -28], [118, -35], [129, -32], [137, -35], [141, -38], [147, -39], [150, -37],
    [153, -28], [146, -19], [142, -11], [135, -12], [130, -11], [125, -14], [118, -20],
  ],
  japan: [[130, 33], [136, 35], [141, 40], [145, 44], [141, 43], [136, 36], [131, 32]],
  madagascar: [[43, -12], [50, -15], [50, -24], [45, -25], [43, -19]],
  britain: [[-6, 50], [-2, 51], [1, 53], [-1, 58], [-5, 58], [-6, 54]],
  newZealand: [[166, -46], [172, -43], [175, -37], [178, -38], [174, -41], [170, -46]],
};

/** Converts (longitude, latitude) to a pixel inside a rectangle. */
export function project(lon, lat, x, y, w, h) {
  return [x + ((lon + 180) / 360) * w, y + ((90 - lat) / 180) * h];
}

/** Where each campaign country sits, and what state it is in. */
export const COUNTRIES = [
  {
    id: 'brazil',
    name: { pt: 'Brasil', en: 'Brazil' },
    flag: '🇧🇷',
    lon: -51,
    lat: -12,
    unlocked: true,
    stages: 10,
    monsters: { pt: 'folclore brasileiro', en: 'Brazilian folklore' },
  },
  {
    id: 'mexico',
    name: { pt: 'México', en: 'Mexico' },
    flag: '🇲🇽',
    lon: -102,
    lat: 23,
    unlocked: false,
    stages: 10,
    monsters: { pt: 'La Llorona, El Cucuy', en: 'La Llorona, El Cucuy' },
  },
  {
    id: 'japan',
    name: { pt: 'Japão', en: 'Japan' },
    flag: '🇯🇵',
    lon: 138,
    lat: 36,
    unlocked: false,
    stages: 10,
    monsters: { pt: 'yōkai', en: 'yōkai' },
  },
  {
    id: 'nigeria',
    name: { pt: 'Nigéria', en: 'Nigeria' },
    flag: '🇳🇬',
    lon: 8,
    lat: 9,
    unlocked: false,
    stages: 10,
    monsters: { pt: 'Madame Koi Koi', en: 'Madame Koi Koi' },
  },
  {
    id: 'ireland',
    name: { pt: 'Irlanda', en: 'Ireland' },
    flag: '🇮🇪',
    lon: -8,
    lat: 53,
    unlocked: false,
    stages: 10,
    monsters: { pt: 'banshee, pooka', en: 'banshee, pooka' },
  },
  {
    id: 'india',
    name: { pt: 'Índia', en: 'India' },
    flag: '🇮🇳',
    lon: 79,
    lat: 22,
    unlocked: false,
    stages: 10,
    monsters: { pt: 'rakshasa', en: 'rakshasa' },
  },
];

/**
 * Draws the map. `opts.taken` paints the countries still held; the caller
 * decides which one pulses (the available one).
 */
export function drawMap(ctx, x, y, w, h, opts = {}) {
  const {
    landColor = '#c9b48c',
    borderColor = INK,
    seaColor = '#a8c4d4',
    taken = true,
    seed = 1,
  } = opts;

  // sea
  ctx.fillStyle = seaColor;
  ctx.fillRect(x, y, w, h);
  // meridians and parallels, lightly
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let lon = -150; lon <= 150; lon += 30) {
    const [px] = project(lon, 0, x, y, w, h);
    stroke(ctx, [[px, y], [px, y + h]], { color: INK, width: 1, passes: 1, seed: seed + lon });
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, py] = project(0, lat, x, y, w, h);
    stroke(ctx, [[x, py], [x + w, py]], { color: INK, width: 1, passes: 1, seed: seed + lat });
  }
  ctx.restore();

  // continents
  let i = 0;
  for (const name in CONTINENTS) {
    const points = CONTINENTS[name].map(([lon, lat]) => project(lon, lat, x, y, w, h));
    shape(ctx, points, {
      color: borderColor,
      width: 2.2,
      fill: taken ? shade(landColor, -0.3) : landColor,
      seed: seed + i * 37,
      jitter: 2.2,
    });
    i++;
  }
}

/** Cached map — the outline is expensive and never changes. */
export function cachedMap(width, height, opts = {}) {
  const key = `map:${width}x${height}:${opts.taken ? 'taken' : 'free'}:${opts.landColor || ''}`;
  return sprite(key, width, height, (ctx, w, h) => {
    drawMap(ctx, 0, 0, w, h, opts);
  });
}
