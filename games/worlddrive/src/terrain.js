// Elevação: AWS Terrain Tiles (formato terrarium), z=15 (~4.8 m/px)
import { lon2tx, lat2ty, tx2lon, ty2lat, mercX, mercY, clamp } from './geo.js';
import { loadImage, pool } from './net.js';

const URL_T = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

// onProgress(done, total)
export async function loadTerrain(bbox, onProgress) {
  const z = 15;
  const tx0 = Math.floor(lon2tx(bbox.w, z));
  const tx1 = Math.floor(lon2tx(bbox.e, z));
  const ty0 = Math.floor(lat2ty(bbox.n, z)); // norte = ty menor
  const ty1 = Math.floor(lat2ty(bbox.s, z));
  const cols = tx1 - tx0 + 1, rows = ty1 - ty0 + 1;
  const W = cols * 256, H = rows * 256;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const tasks = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      tasks.push(async () => {
        const img = await loadImage(URL_T(z, tx, ty));
        ctx.drawImage(img, (tx - tx0) * 256, (ty - ty0) * 256);
        return true;
      });
    }
  }
  const results = await pool(tasks, 6, onProgress);
  const failures = results.filter(r => r && r.__err).length;
  if (failures === results.length) throw new Error('Não consegui baixar os dados de elevação.');

  const px = ctx.getImageData(0, 0, W, H).data;
  let data = new Float32Array(W * H);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) {
    data[i] = (px[j] * 256 + px[j + 1] + px[j + 2] / 256) - 32768;
  }

  // Suaviza 1 passe (box 3x3) — SRTM urbano tem ruído de edificações
  data = blur3(data, W, H);

  // Bounds do mosaico em metros Mercator
  const mxMin = mercX(tx2lon(tx0, z));
  const mxMax = mercX(tx2lon(tx1 + 1, z));
  const myMax = mercY(ty2lat(ty0, z));
  const myMin = mercY(ty2lat(ty1 + 1, z));
  const sx = W / (mxMax - mxMin);
  const sy = H / (myMax - myMin);

  // Amostragem bilinear em coordenadas Mercator
  function sample(mx, my) {
    const fx = clamp((mx - mxMin) * sx, 0, W - 1.001);
    const fy = clamp((myMax - my) * sy, 0, H - 1.001);
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const dx = fx - x0, dy = fy - y0;
    const i00 = y0 * W + x0;
    const h00 = data[i00], h10 = data[i00 + 1];
    const h01 = data[i00 + W], h11 = data[i00 + W + 1];
    return (h00 * (1 - dx) + h10 * dx) * (1 - dy) + (h01 * (1 - dx) + h11 * dx) * dy;
  }

  return { sample, failures };
}

function blur3(src, W, H) {
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - 1), y1 = Math.min(H - 1, y + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - 1), x1 = Math.min(W - 1, x + 1);
      let s = 0, n = 0;
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { s += src[yy * W + xx]; n++; }
      out[y * W + x] = s / n;
    }
  }
  return out;
}
