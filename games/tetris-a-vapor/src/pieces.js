export const TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

export const PALETTE = {
  I: { face: '#4fd9d3', light: '#b8fff1', dark: '#176d70', glow: '#6ffff3' },
  J: { face: '#4f79c8', light: '#afc7ff', dark: '#243d7b', glow: '#7199ff' },
  L: { face: '#e46f2d', light: '#ffc17b', dark: '#7d321b', glow: '#ff8c42' },
  O: { face: '#d6ad3c', light: '#fff09a', dark: '#755516', glow: '#ffe15c' },
  S: { face: '#63b85a', light: '#c8f19e', dark: '#2f6c38', glow: '#89ef76' },
  T: { face: '#b766ad', light: '#f7b5ea', dark: '#653260', glow: '#ef7cdf' },
  Z: { face: '#d24c3e', light: '#ffaaa0', dark: '#76291f', glow: '#ff6958' },
};

// Four explicit faces per piece keep rendering, collision and previews on the
// same geometry. The coordinates live in a 4×4 gearbox.
export const SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
};

export function pieceCells(piece) {
  return SHAPES[piece.type][piece.rotation].map(([x, y]) => [x + piece.x, y + piece.y]);
}

export function createPiece(type) {
  return { type, rotation: 0, x: 3, y: 0 };
}

export function makeBag(rng = Math.random) {
  const bag = [...TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

/** Small deterministic generator: replays and tests get the same seven-bags. */
export function makeRng(seed = 1) {
  let n = (seed >>> 0) || 1;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

const NORMAL_KICKS = [
  [0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1], [0, -2],
];
const I_KICKS = [
  [0, 0], [-2, 0], [2, 0], [-1, 0], [1, 0], [0, -1], [0, -2], [-2, -1], [2, -1],
];

export function kicksFor(type) {
  return type === 'I' ? I_KICKS : NORMAL_KICKS;
}
