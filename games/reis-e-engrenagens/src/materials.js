// What a castle is made of, and what the ground under it is made of.
//
// Five materials, and none of them is simply better than another — that is the
// whole point of a build phase. Each one is cheap somewhere and expensive
// somewhere else:
//
//   sand    costs nothing and eats explosions, but holds no weight at all
//   wood    spans gaps like nothing else, and burns
//   stone   is the honest wall: no weakness, no talent, no cantilever
//   crystal is cheap armour that shatters the moment something pointed arrives
//   iron    survives everything except the rust that eats it from the inside
//
// `span` is how many cells of empty air the material can bridge before it falls
// (see `structure.js`) — it is the number that makes wood worth buying.

export const MATERIALS = {
  sand: {
    id: 'sand',
    cost: 6,
    hp: 55,
    span: 0,
    weight: 0.9,
    // sacks of sand do exactly one thing well, and this is it
    blast: 0.6,
    face: '#f2d18d',
    side: '#d8ae5e',
    dark: '#a97f36',
    grain: '#fae7bd',
  },
  wood: {
    id: 'wood',
    cost: 5,
    hp: 60,
    span: 3,
    weight: 0.6,
    blast: 1,
    burns: true,
    face: '#d08a45',
    side: '#a35f28',
    dark: '#6d3c15',
    grain: '#e8b075',
  },
  crystal: {
    id: 'crystal',
    cost: 9,
    hp: 70,
    span: 1,
    weight: 0.8,
    blast: 0.75,
    face: '#8ceaff',
    side: '#3fb6e0',
    dark: '#1f7ba3',
    grain: '#d6f8ff',
  },
  stone: {
    id: 'stone',
    cost: 13,
    hp: 135,
    span: 1,
    weight: 1.4,
    blast: 1,
    face: '#cec7b4',
    side: '#a4997f',
    dark: '#6f6653',
    grain: '#e4ded0',
  },
  iron: {
    id: 'iron',
    cost: 23,
    hp: 215,
    span: 4,
    weight: 1.9,
    blast: 1,
    rusts: true,
    face: '#93aac4',
    side: '#5c7590',
    dark: '#33465c',
    grain: '#c2d4e8',
  },
};

/** The order they appear in the workshop: cheapest first. */
export const PALETTE = ['sand', 'wood', 'crystal', 'stone', 'iron'];

/**
 * The king is stored in the same grid as the walls — he is a cell like any
 * other, so support, collapse and blast all treat him without a special case.
 * He is simply the cell you lose the match over.
 */
export const KING = {
  id: 'king',
  cost: 0,
  hp: 120,
  span: 0,
  weight: 1,
  blast: 1,
  face: '#ffd646',
  side: '#c99a16',
  dark: '#7a5c0c',
  grain: '#fff0a8',
};

export const material = (id) => (id === 'king' ? KING : MATERIALS[id]);

// -------------------------------------------------------------------- ground

/**
 * The ground is a weapon modifier you do not get to choose.
 *
 * `dig` scales every crater: a shell that opens a canyon in the dunes barely
 * scratches the quarry, so the same weapon is a siege tool on one level and a
 * waste of a turn on the next. `conduct` is the scrapyard's own joke — a field
 * of loose metal carries the tesla coil's arc much further than it should.
 */
export const TERRAINS = {
  soil: {
    id: 'soil',
    dig: 1,
    sky: ['#4fb7e8', '#bfe9f7'],
    hills: ['#5e93b8', '#4f9c6c', '#3a8250'],
    body: '#8a5f38',
    deep: '#5f3f23',
    cap: '#5ec24a',
    speck: '#7ad45f',
    dust: '#9c7448',
    props: ['tree', 'bush', 'flower', 'rock'],
  },
  sand: {
    id: 'sand',
    dig: 1.45,
    sky: ['#f2a54c', '#ffe3ae'],
    hills: ['#d99e63', '#c88348', '#b06a33'],
    body: '#e0b878',
    deep: '#a87d43',
    cap: '#f6dda0',
    speck: '#fff0c8',
    dust: '#f0d6a0',
    props: ['cactus', 'skull', 'rock'],
  },
  rock: {
    id: 'rock',
    dig: 0.42,
    sky: ['#5c7ba8', '#c6d8e8'],
    hills: ['#6c7f96', '#546679', '#3f4f60'],
    body: '#7d8494',
    deep: '#4c5464',
    cap: '#9aa3b2',
    speck: '#b8c0cc',
    dust: '#9aa3b2',
    props: ['boulder', 'rock', 'pillar'],
  },
  scrap: {
    id: 'scrap',
    dig: 0.95,
    conduct: true,
    sky: ['#b06a3a', '#f0c48f'],
    hills: ['#8a6650', '#6e5040', '#553d33'],
    body: '#8a604a',
    deep: '#553828',
    cap: '#a8785a',
    speck: '#c98d5c',
    dust: '#b07a52',
    props: ['pipe', 'gear', 'rock', 'antenna'],
  },
  snow: {
    id: 'snow',
    dig: 1.3,
    sky: ['#6f9ed0', '#e8f4ff'],
    hills: ['#9db9d8', '#c3d8ea', '#e0eefa'],
    body: '#e8f2fb',
    deep: '#a6bfd6',
    cap: '#ffffff',
    speck: '#ffffff',
    dust: '#eef6ff',
    props: ['pine', 'rock', 'icicle'],
  },
  ash: {
    id: 'ash',
    dig: 1.1,
    ember: true,
    sky: ['#3a1f2c', '#a34a30'],
    hills: ['#4a2f34', '#382428', '#28191c'],
    body: '#4a3c3e',
    deep: '#261d20',
    cap: '#6b4a44',
    speck: '#c4522c',
    dust: '#7a5a52',
    props: ['deadtree', 'rock', 'vent'],
  },
};

export const terrainOf = (id) => TERRAINS[id] || TERRAINS.soil;
