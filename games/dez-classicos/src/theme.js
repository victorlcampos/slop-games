// The cabinet's materials, one palette per surface.
//
// Ten games that look like ten different toys is a bag of games; ten games that
// look identical is a spreadsheet. The rule here is that the *room* is shared —
// the same felt table, the same light from the upper left, the same warm brass
// — and each board is made of what that board is really made of: walnut and
// maple for chess, lacquered pine for draughts, green baize for reversi, cut
// slate for noughts and crosses, paper for sudoku.
//
// Every palette is four stops of the same colour: `light` where the light hits,
// `base` for the body, `dark` for the shaded side, `edge` for the outline. That
// shape is what lets one `disc()` in paint.js draw a draughts man, a reversi
// stone and a backgammon checker without knowing which is which.

export const TABLE = {
  felt: '#1c3a2e',
  feltDark: '#12241d',
  rim: { light: '#5b3a1e', base: '#3d2612', dark: '#241407', edge: '#160c04' },
  brass: { light: '#f3d998', base: '#c9a052', dark: '#7a5c22', edge: '#4a3712' },
  ink: '#f0e6d2',
  dim: '#a2937c',
};

export const WOOD = {
  walnut: { light: '#6b4526', base: '#4a2d15', dark: '#2c1a0b', edge: '#1b0f06' },
  maple: { light: '#f0dcb4', base: '#dcc190', dark: '#b99b66', edge: '#8d7247' },
  rosewood: { light: '#8a3a2a', base: '#5f2418', dark: '#3a140c', edge: '#240c06' },
  pine: { light: '#e8c68c', base: '#cfa568', dark: '#a67c42', edge: '#6d5027' },
  ebony: { light: '#3a3735', base: '#22201e', dark: '#100f0e', edge: '#070606' },
};

export const IVORY = { light: '#fffaf0', base: '#f0e2c8', dark: '#c9b494', edge: '#9c8768' };
export const ONYX = { light: '#5c5856', base: '#2e2c2b', dark: '#171615', edge: '#0a0a09' };
export const BONE = { light: '#fff6e2', base: '#e9d9b6', dark: '#bda98c', edge: '#8e7a55' };
export const COAL = { light: '#3f3a36', base: '#211e1b', dark: '#0f0d0c', edge: '#050404' };

export const PALETTES = {
  chess: {
    light: WOOD.maple,
    dark: WOOD.walnut,
    frame: WOOD.walnut,
    pieces: [IVORY, ONYX],
    accent: '#e8b64c',
    check: '#e0523c',
  },
  checkers: {
    light: WOOD.pine,
    dark: WOOD.rosewood,
    frame: WOOD.walnut,
    // The dark piece is ebony rather than the red the box art always shows,
    // and that is a legibility decision taken from a screenshot: a wine-red
    // draughtsman standing on a rosewood square is nearly invisible, and half
    // the board is rosewood.
    pieces: [
      { light: '#fdf3e0', base: '#e8d5b0', dark: '#bfa887', edge: '#7a6642' },
      { light: '#4a4340', base: '#242020', dark: '#100d0d', edge: '#050404' },
    ],
    accent: '#e8b64c',
  },
  tictactoe: {
    slate: { light: '#4a4f57', base: '#343940', dark: '#22262c', edge: '#14171b' },
    chalk: '#f4efe4',
    accent: '#7fd4c1',
    marks: ['#f4efe4', '#7fd4c1'],
  },
  reversi: {
    felt: '#1d6b45',
    feltDark: '#124329',
    frame: WOOD.walnut,
    // Black first, because in reversi black *is* first — and the seat panel
    // names the side ("dark") from the same index the board draws from. With
    // the two the other way round the panel showed a white disc under the word
    // "dark", which is the kind of thing nobody notices until they do.
    pieces: [
      { light: '#4a4a4a', base: '#242424', dark: '#101010', edge: '#050505' },
      { light: '#ffffff', base: '#efe9dc', dark: '#c3bcac', edge: '#8f887a' },
    ],
    accent: '#f0d264',
  },
  connect4: {
    rack: { light: '#3f79d8', base: '#2a55a8', dark: '#17346c', edge: '#0d1f42' },
    pieces: [
      { light: '#ff8b7a', base: '#e03e2f', dark: '#8f1c12', edge: '#5c0f09' },
      { light: '#ffe07a', base: '#f0b81f', dark: '#a97b06', edge: '#6b4d02' },
    ],
    accent: '#ffffff',
  },
  morris: {
    board: WOOD.walnut,
    frame: WOOD.ebony,
    pieces: [BONE, COAL],
    accent: '#e8b64c',
  },
  mancala: {
    board: WOOD.walnut,
    frame: WOOD.ebony,
    seeds: ['#c94f3a', '#e0a33c', '#4d9b7a', '#3f6fa8', '#a9603f', '#8a6cb0'],
    accent: '#e8b64c',
  },
  backgammon: {
    board: WOOD.walnut,
    frame: WOOD.ebony,
    points: [
      { light: '#f0dcb4', base: '#d8bd8c', dark: '#a98d5c', edge: '#7d6640' },
      { light: '#a63c2a', base: '#7c2718', dark: '#4a140b', edge: '#2d0c06' },
    ],
    pieces: [
      { light: '#fffaf0', base: '#eadcbf', dark: '#bfa77f', edge: '#8e7a55' },
      { light: '#4a2f22', base: '#2a1a12', dark: '#150c08', edge: '#080403' },
    ],
    accent: '#e8b64c',
  },
  ludo: {
    board: { light: '#f6efe0', base: '#e8dcc4', dark: '#c9b998', edge: '#a89777' },
    frame: WOOD.walnut,
    colours: [
      { light: '#ff8a7a', base: '#d9382a', dark: '#8c1a10', edge: '#5a0f08' },
      { light: '#8adcff', base: '#2a86c9', dark: '#124e7c', edge: '#0a3050' },
      { light: '#ffe483', base: '#e8b41f', dark: '#9a7406', edge: '#5f4703' },
      { light: '#9ce8a8', base: '#3a9c52', dark: '#1c5e2c', edge: '#0e3a1a' },
    ],
    accent: '#e8b64c',
  },
  sudoku: {
    paper: { light: '#fbf6ea', base: '#f0e8d6', dark: '#ddd2ba', edge: '#c2b79c' },
    frame: WOOD.walnut,
    ink: '#2b2419',
    given: '#1a150e',
    pencil: '#8d8368',
    accent: '#3f7fbf',
    wrong: '#c9402f',
    solved: '#2e8b57',
  },
};

/** The two seats, for anything in the HUD that has to show a colour. */
export const SEAT_COLOUR = ['#f0e6d2', '#2a2724'];
