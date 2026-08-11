// Global constants + the terrain height function (the shared source of truth
// between mesh, physics, props and AI).

import { fbm2, ridged2 } from './lib/noise.js';

// ---------------------------------------------------------------- mundo
// Axes: +X right, +Y up, +Z downhill (the direction of the run).
export const SLOPE = 0.20;            // tangent of the average slope (~11°)
export const VIEW_FAR = 2400;         // has to fit the sky dome
export const FOG_DENSITY = 0.0028;

export const CHUNK_SIZE = 80;         // lado de um bloco de terreno (m)
export const CHUNK_SEG = 32;          // subdivisions per chunk
export const GRID_X = 7;              // chunks across
export const GRID_Z = 10;             // chunks in depth
export const GRID_BEHIND = 2;         // chunks kept behind the player

export const TRACK_HALF_WIDTH = 150;  // past this it turns into thick forest

// ------------------------------------------------------------- jogador
export const PLAYER = {
  radius: 0.62,
  maxTurn: 1.32,          // rad — largest angle off the fall line
  turnRate: 2.35,         // rad/s
  accel: 15.5,            // m/s² down the fall line
  tuckBonus: 1.28,        // top-speed multiplier while tucked
  brakeDecel: 26,
  maxSpeed: 34,           // m/s (~122 km/h)
  drag: 0.0072,
  edgeDrag: 0.42,         // loss when traversing the slope
  jumpImpulse: 7.4,
  gravity: 24,
  crashTime: 1.35,
  spinRate: 7.2,          // rad/s of spin in the air
  flipRate: 6.4,
};

// ---------------------------------------------------------------- yeti
export const YETI = {
  wakeDistance: 2000,     // metres until he wakes (as in the original)
  baseSpeed: 21,
  rampUp: 0.32,           // m/s gained per second of chase
  maxSpeed: 46,
  catchRadius: 2.1,
  giveUpGap: 130,         // open up this gap and he gives up
  returnDelay: 12,        // seconds until he comes back faster
  spawnGap: 95,           // appears this far behind
};

// --------------------------------------------------------------- modos
export const MODES = {
  free: {
    label: 'Descida Livre',
    treeDensity: 1.0, rockDensity: 1.0, rampDensity: 0.55,
    gates: false, npcDensity: 1.0, lift: true,
    yetiWake: 2000, corridor: 0,
  },
  slalom: {
    label: 'Slalom',
    treeDensity: 0.45, rockDensity: 0.6, rampDensity: 0.2,
    gates: true, npcDensity: 0.5, lift: true,
    yetiWake: 2600, corridor: 0,
  },
  trees: {
    label: 'Forest Slalom',
    treeDensity: 3.4, rockDensity: 0.9, rampDensity: 0.3,
    gates: false, npcDensity: 0.4, lift: false,
    yetiWake: 1600, corridor: 34,   // width of the clear corridor
  },
  freestyle: {
    label: 'Estilo Livre',
    treeDensity: 0.7, rockDensity: 0.7, rampDensity: 3.2,
    gates: false, npcDensity: 0.7, lift: true,
    yetiWake: 2400, corridor: 0,
  },
};

// ------------------------------------------------------------- terreno
// Ground height in world coordinates. The -SLOPE*z term is the mountain;
// the rest is undulation, bumps and the gentle trough of the main piste.
export function groundHeight(x, z) {
  let h = -SLOPE * z;

  // wide undulations of the slope
  h += fbm2(x * 0.0042, z * 0.0042, 4) * 15.0;
  // medium folds (wide moguls)
  h += fbm2(x * 0.019 + 31.7, z * 0.019 - 12.3, 3) * 3.6;
  // short bumps: this is where the unplanned jumps come from
  h += fbm2(x * 0.062 - 7.1, z * 0.062 + 19.4, 2) * 0.95;
  // fine texture of packed snow
  h += fbm2(x * 0.085, z * 0.085 + 5.5, 2) * 0.42;

  // the central trough: the piste is slightly concave, which guides the player
  const t = Math.min(1, Math.abs(x) / TRACK_HALF_WIDTH);
  h += t * t * 9.0;

  // side ridges growing out from the piste
  if (Math.abs(x) > TRACK_HALF_WIDTH) {
    const o = (Math.abs(x) - TRACK_HALF_WIDTH) / 60;
    h += Math.min(o, 2.4) * 11 * ridged2(x * 0.01, z * 0.01, 2);
  }
  return h;
}

/** Terrain normal by finite differences. */
export function groundNormal(x, z, out) {
  const e = 1.1;
  const hL = groundHeight(x - e, z), hR = groundHeight(x + e, z);
  const hD = groundHeight(x, z - e), hU = groundHeight(x, z + e);
  out.set(hL - hR, 2 * e, hD - hU).normalize();
  return out;
}

// ------------------------------------------------------------- paleta
export const COLORS = {
  snowLit:    0xffffff,
  snowShade:  0xa8c8ea,
  sky:        0x8cc4f0,
  horizon:    0xdcecfb,
  fog:        0xcfe4f5,
  sun:        0xffe9c4,
  pineDark:   0x15492a,
  pineLight:  0x2a7a41,
  bark:       0x4a3220,
  rock:       0x707b86,
  jacket:     0x8b3fd6,
  pants:      0x2b56c9,
  hat:        0xe33d3d,
  skin:       0xf0c39a,
  ski:        0xffcf3f,
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
