// Constantes globais + a função de altura do terreno (fonte da verdade
// compartilhada entre malha, física, props e IA).

import { fbm2, ridged2 } from './lib/noise.js';

// ---------------------------------------------------------------- mundo
// Eixos: +X direita, +Y cima, +Z encosta abaixo (sentido da descida).
export const SLOPE = 0.20;            // tangente da inclinação média (~11°)
export const VIEW_FAR = 2400;         // precisa caber a cúpula do céu
export const FOG_DENSITY = 0.0028;

export const CHUNK_SIZE = 80;         // lado de um bloco de terreno (m)
export const CHUNK_SEG = 32;          // subdivisões por bloco
export const GRID_X = 7;              // blocos na horizontal
export const GRID_Z = 10;             // blocos na profundidade
export const GRID_BEHIND = 2;         // blocos mantidos atrás do jogador

export const TRACK_HALF_WIDTH = 150;  // além disso vira floresta fechada

// ------------------------------------------------------------- jogador
export const PLAYER = {
  radius: 0.62,
  maxTurn: 1.32,          // rad — ângulo máximo em relação à linha de queda
  turnRate: 2.35,         // rad/s
  accel: 15.5,            // m/s² na linha de queda
  tuckBonus: 1.28,        // multiplicador de velocidade máxima agachado
  brakeDecel: 26,
  maxSpeed: 34,           // m/s (~122 km/h)
  drag: 0.0072,
  edgeDrag: 0.42,         // perda ao atravessar a encosta
  jumpImpulse: 7.4,
  gravity: 24,
  crashTime: 1.35,
  spinRate: 7.2,          // rad/s de giro no ar
  flipRate: 6.4,
};

// ---------------------------------------------------------------- yeti
export const YETI = {
  wakeDistance: 2000,     // metros até acordar (como no original)
  baseSpeed: 21,
  rampUp: 0.32,           // m/s ganhos por segundo de perseguição
  maxSpeed: 46,
  catchRadius: 2.1,
  giveUpGap: 130,         // se você abrir essa distância, ele desiste
  returnDelay: 12,        // segundos até voltar mais rápido
  spawnGap: 95,           // aparece a esta distância atrás
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
    label: 'Slalom na Floresta',
    treeDensity: 3.4, rockDensity: 0.9, rampDensity: 0.3,
    gates: false, npcDensity: 0.4, lift: false,
    yetiWake: 1600, corridor: 34,   // largura do corredor livre
  },
  freestyle: {
    label: 'Estilo Livre',
    treeDensity: 0.7, rockDensity: 0.7, rampDensity: 3.2,
    gates: false, npcDensity: 0.7, lift: true,
    yetiWake: 2400, corridor: 0,
  },
};

// ------------------------------------------------------------- terreno
// Altura do solo em coordenadas de mundo. O termo -SLOPE*z é a montanha;
// o resto são ondulações, lombadas e a calha suave da pista principal.
export function groundHeight(x, z) {
  let h = -SLOPE * z;

  // ondulações largas da encosta
  h += fbm2(x * 0.0042, z * 0.0042, 4) * 15.0;
  // dobras médias (moguls largos)
  h += fbm2(x * 0.019 + 31.7, z * 0.019 - 12.3, 3) * 3.6;
  // lombadas curtas: é delas que saem os saltos não planejados
  h += fbm2(x * 0.062 - 7.1, z * 0.062 + 19.4, 2) * 0.95;
  // textura fina da neve batida
  h += fbm2(x * 0.085, z * 0.085 + 5.5, 2) * 0.42;

  // calha central: a pista é levemente côncava, ajuda a guiar o jogador
  const t = Math.min(1, Math.abs(x) / TRACK_HALF_WIDTH);
  h += t * t * 9.0;

  // cristas laterais crescendo para fora da pista
  if (Math.abs(x) > TRACK_HALF_WIDTH) {
    const o = (Math.abs(x) - TRACK_HALF_WIDTH) / 60;
    h += Math.min(o, 2.4) * 11 * ridged2(x * 0.01, z * 0.01, 2);
  }
  return h;
}

/** Normal do terreno por diferenças finitas. */
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
