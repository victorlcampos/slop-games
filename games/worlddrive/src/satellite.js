// Imagem de satélite: Esri World Imagery, mosaico em canvas
import { lon2tx, lat2ty, tx2lon, ty2lat, mercX, mercY } from './geo.js';
import { loadImage, pool } from './net.js';

const URL_S = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

// onProgress(done, total)
export async function loadSatellite(bbox, onProgress) {
  // Escolhe o maior zoom que caiba em ~90 tiles / 4096px
  let z = 19, tx0, tx1, ty0, ty1;
  for (; z >= 14; z--) {
    tx0 = Math.floor(lon2tx(bbox.w, z)); tx1 = Math.floor(lon2tx(bbox.e, z));
    ty0 = Math.floor(lat2ty(bbox.n, z)); ty1 = Math.floor(lat2ty(bbox.s, z));
    const count = (tx1 - tx0 + 1) * (ty1 - ty0 + 1);
    const size = Math.max(tx1 - tx0 + 1, ty1 - ty0 + 1) * 256;
    if (count <= 90 && size <= 4096) break;
  }
  const cols = tx1 - tx0 + 1, rows = ty1 - ty0 + 1;
  const canvas = document.createElement('canvas');
  canvas.width = cols * 256; canvas.height = rows * 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3c4a3e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tasks = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const zz = z, txx = tx, tyy = ty;
      tasks.push(async () => {
        const dx = (txx - tx0) * 256, dy = (tyy - ty0) * 256;
        try {
          const img = await loadImage(URL_S(zz, txx, tyy));
          ctx.drawImage(img, dx, dy);
        } catch (e) {
          // fallback: quadrante do tile-pai ampliado
          const img = await loadImage(URL_S(zz - 1, txx >> 1, tyy >> 1));
          ctx.drawImage(img, (txx % 2) * 128, (tyy % 2) * 128, 128, 128, dx, dy, 256, 256);
        }
        return true;
      });
    }
  }
  await pool(tasks, 8, onProgress);

  return {
    canvas,
    zoom: z,
    mxMin: mercX(tx2lon(tx0, z)),
    mxMax: mercX(tx2lon(tx1 + 1, z)),
    myMax: mercY(ty2lat(ty0, z)),
    myMin: mercY(ty2lat(ty1 + 1, z)),
  };
}
