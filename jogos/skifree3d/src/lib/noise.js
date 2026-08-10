// Ruído determinístico sem dependências externas.
// Perlin 2D clássico + fbm, e um hash inteiro para spawn reprodutível.

const PERM = new Uint8Array(512);
const GRAD_X = new Float32Array(512);
const GRAD_Y = new Float32Array(512);

(function buildPermutation() {
  // LCG determinístico: mesmo terreno em qualquer máquina, sem Math.random.
  let s = 1337;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) {
    const v = p[i & 255];
    PERM[i] = v;
    const a = (v / 256) * Math.PI * 2;
    GRAD_X[i] = Math.cos(a);
    GRAD_Y[i] = Math.sin(a);
  }
})();

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Perlin 2D no intervalo aproximado [-1, 1]. */
export function perlin2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const X = xi & 255, Y = yi & 255;

  const aa = PERM[X + PERM[Y]];
  const ab = PERM[X + PERM[Y + 1]];
  const ba = PERM[X + 1 + PERM[Y]];
  const bb = PERM[X + 1 + PERM[Y + 1]];

  const d1 = GRAD_X[aa] * xf + GRAD_Y[aa] * yf;
  const d2 = GRAD_X[ba] * (xf - 1) + GRAD_Y[ba] * yf;
  const d3 = GRAD_X[ab] * xf + GRAD_Y[ab] * (yf - 1);
  const d4 = GRAD_X[bb] * (xf - 1) + GRAD_Y[bb] * (yf - 1);

  const u = fade(xf), v = fade(yf);
  const x1 = d1 + u * (d2 - d1);
  const x2 = d3 + u * (d4 - d3);
  return (x1 + v * (x2 - x1)) * 1.4;
}

/** Soma de oitavas de Perlin. */
export function fbm2(x, y, octaves = 4, lacunarity = 2.02, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += perlin2(x * freq, y * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ruído de células (ridged) — bom para lombadas e cristas de neve. */
export function ridged2(x, y, octaves = 3) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += (1 - Math.abs(perlin2(x * freq, y * freq))) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

// ---------------------------------------------------------------- hashing

/** Hash inteiro -> [0,1). Usado para decidir spawn de props por faixa. */
export function hash1(n) {
  let h = n | 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function hash2(a, b) {
  return hash1((a | 0) * 73856093 ^ (b | 0) * 19349663);
}

/** Gerador pseudoaleatório reprodutível a partir de uma semente inteira. */
export function makeRng(seed) {
  let s = (seed | 0) || 1;
  return function rng() {
    s ^= s << 13; s |= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s |= 0;
    return (s >>> 0) / 4294967296;
  };
}
