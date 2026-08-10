// Paleta de lápis de cor: tudo puxa para o pigmento sobre papel, nada saturado
// demais. As cores de cenário vivem em dados/fases.js, junto de cada fase.

export const TINTA = '#2b2622'; // o "grafite" — contorno de tudo
export const TINTA_FRACA = '#6b6157';
export const PAPEL = '#f2e8d5';
export const PAPEL_ESCURO = '#e3d5ba';

export const CORES = {
  // interface
  destaque: '#e0913a',
  destaqueEscuro: '#b96f22',
  perigo: '#c1503f',
  bom: '#5d9e5e',
  agua: '#6fa8c4',
  aguaEscura: '#3d7791',
  sombra: 'rgba(43, 38, 34, 0.22)',

  // recursos
  semente: '#d9a441',
  moeda: '#e6c05a',

  // pelo e pele de bicho
  pelo: '#c98f5a',
  peloEscuro: '#9c6a3d',
  peloClaro: '#e6c9a3',
  cinza: '#9a958d',
  cinzaEscuro: '#6e6a63',
  branco: '#f5efe3',
  preto: '#4a423b',
  verde: '#7fa85c',
  verdeEscuro: '#587c3d',

  // monstro
  fogo: '#e8703a',
  fogoClaro: '#f2b03c',
  sombrio: '#5b4a63',
  sombrioEscuro: '#3d3145',
  podre: '#8a9b5c',
  osso: '#e8dcc4',
};

/** Clareia/escurece uma cor hex por um fator (-1 a 1). */
export function tom(hex, fator) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const alvo = fator > 0 ? 255 : 0;
  const f = Math.abs(fator);
  r = Math.round(r + (alvo - r) * f);
  g = Math.round(g + (alvo - g) * f);
  b = Math.round(b + (alvo - b) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Cor com alfa, aceitando hex. */
export function alfa(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
