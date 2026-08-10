// Projeções e matemática de tiles (Web Mercator)
export const R = 6378137;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function mercX(lon) { return R * lon * Math.PI / 180; }
export function mercY(lat) { return R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); }
export function invMercX(x) { return x / R * 180 / Math.PI; }
export function invMercY(y) { return (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI; }

// Coordenadas de tile XYZ
export function lon2tx(lon, z) { return (lon + 180) / 360 * Math.pow(2, z); }
export function lat2ty(lat, z) {
  const r = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
}
export function tx2lon(x, z) { return x / Math.pow(2, z) * 360 - 180; }
export function ty2lat(y, z) {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

// Projeção local: metros reais ao redor de (lat0, lon0).
// x = leste, z = sul (norte é -z), y = altura.
export function makeProjection(lat0, lon0) {
  const k = Math.cos(lat0 * Math.PI / 180); // fator de escala Mercator -> metros reais
  const mx0 = mercX(lon0), my0 = mercY(lat0);
  return {
    lat0, lon0, k, mx0, my0,
    toLocal(lat, lon) { return [(mercX(lon) - mx0) * k, -(mercY(lat) - my0) * k]; },
    toLatLon(x, z) { return [invMercY(my0 - z / k), invMercX(mx0 + x / k)]; },
    toMerc(x, z) { return [mx0 + x / k, my0 - z / k]; },
  };
}

// bbox geográfica de um quadrado de `half` metros reais ao redor do ponto
export function bboxAround(lat0, lon0, half) {
  const k = Math.cos(lat0 * Math.PI / 180);
  const dm = half / k;
  const mx0 = mercX(lon0), my0 = mercY(lat0);
  return {
    s: invMercY(my0 - dm), w: invMercX(mx0 - dm),
    n: invMercY(my0 + dm), e: invMercX(mx0 + dm),
  };
}

// PRNG determinístico
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261 >>> 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
