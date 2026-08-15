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
    face: '#d9c08c',
    side: '#b39a63',
    dark: '#8c7643',
    grain: '#c4a878',
  },
  wood: {
    id: 'wood',
    cost: 5,
    hp: 60,
    span: 3,
    weight: 0.6,
    blast: 1,
    burns: true,
    face: '#9a6435',
    side: '#7a4d27',
    dark: '#553318',
    grain: '#7d4f28',
  },
  crystal: {
    id: 'crystal',
    cost: 9,
    hp: 70,
    span: 1,
    weight: 0.8,
    blast: 0.75,
    face: '#8fe6ff',
    side: '#4fb4d8',
    dark: '#2b7fa0',
    grain: '#c9f4ff',
  },
  stone: {
    id: 'stone',
    cost: 13,
    hp: 135,
    span: 1,
    weight: 1.4,
    blast: 1,
    face: '#9aa1a8',
    side: '#787f87',
    dark: '#4f565d',
    grain: '#868d95',
  },
  iron: {
    id: 'iron',
    cost: 23,
    hp: 215,
    span: 4,
    weight: 1.9,
    blast: 1,
    rusts: true,
    face: '#8794a3',
    side: '#5d6874',
    dark: '#39414b',
    grain: '#6f7c8b',
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
  face: '#e8c33a',
  side: '#b08e1c',
  dark: '#6d5610',
  grain: '#f2d968',
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
    sky: ['#8fc4e8', '#d8e8f2'],
    far: '#7f9bb0',
    near: '#5d7f6a',
    body: '#6b4f34',
    deep: '#4a3524',
    cap: '#5f9147',
    speck: '#7ea85c',
    dust: '#8a6a45',
  },
  sand: {
    id: 'sand',
    dig: 1.45,
    sky: ['#f0b970', '#fbe6c0'],
    far: '#c79a6a',
    near: '#d9b47c',
    body: '#c9a468',
    deep: '#9c7c46',
    cap: '#e6cd93',
    speck: '#d4b47c',
    dust: '#e0c48d',
  },
  rock: {
    id: 'rock',
    dig: 0.42,
    sky: ['#6f7f95', '#c3ccd6'],
    far: '#5e6b7c',
    near: '#4a5462',
    body: '#6c727a',
    deep: '#464b52',
    cap: '#818892',
    speck: '#9aa1aa',
    dust: '#8d939b',
  },
  scrap: {
    id: 'scrap',
    dig: 0.95,
    conduct: true,
    sky: ['#8a6a5a', '#d2b09a'],
    far: '#6e5a52',
    near: '#5a4a44',
    body: '#77584a',
    deep: '#4d3a32',
    cap: '#8a6a54',
    speck: '#a8836a',
    dust: '#9a7358',
  },
  snow: {
    id: 'snow',
    dig: 1.3,
    sky: ['#9db8d4', '#eef4fb'],
    far: '#8fa5bd',
    near: '#c8d8e8',
    body: '#dce7f2',
    deep: '#a8bccf',
    cap: '#f4f9ff',
    speck: '#ffffff',
    dust: '#e8f1fa',
  },
  ash: {
    id: 'ash',
    dig: 1.1,
    ember: true,
    sky: ['#3a2430', '#8a4436'],
    far: '#3d2a2c',
    near: '#2c2022',
    body: '#3f3436',
    deep: '#241d1f',
    cap: '#5a4442',
    speck: '#7a4a38',
    dust: '#6a5250',
  },
};

export const terrainOf = (id) => TERRAINS[id] || TERRAINS.soil;
