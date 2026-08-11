// Coloured-pencil palette: everything leans towards pigment on paper, nothing
// too saturated. Scenery colours live in data/levels.js, next to each level.

export const INK = '#2b2622'; // the "graphite" — outline of everything
export const INK_SOFT = '#6b6157';
export const PAPER = '#f2e8d5';
export const PAPER_DARK = '#e3d5ba';

export const COLORS = {
  // interface
  accent: '#e0913a',
  accentDark: '#b96f22',
  danger: '#c1503f',
  good: '#5d9e5e',
  water: '#6fa8c4',
  waterDark: '#3d7791',
  shadow: 'rgba(43, 38, 34, 0.22)',

  // resources
  seed: '#d9a441',
  coin: '#e6c05a',

  // animal fur and hide
  fur: '#c98f5a',
  furDark: '#9c6a3d',
  furLight: '#e6c9a3',
  gray: '#9a958d',
  grayDark: '#6e6a63',
  white: '#f5efe3',
  black: '#4a423b',
  green: '#7fa85c',
  greenDark: '#587c3d',

  // monster
  fire: '#e8703a',
  fireLight: '#f2b03c',
  gloom: '#5b4a63',
  gloomDark: '#3d3145',
  rot: '#8a9b5c',
  bone: '#e8dcc4',
};

/** Lightens/darkens a hex colour by a factor (-1 to 1). */
export function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const target = factor > 0 ? 255 : 0;
  const f = Math.abs(factor);
  r = Math.round(r + (target - r) * f);
  g = Math.round(g + (target - g) * f);
  b = Math.round(b + (target - b) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** A colour with alpha, taking hex in. */
export function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
