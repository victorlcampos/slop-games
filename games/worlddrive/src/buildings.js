// Prédios extrudados dos footprints OSM, mesclados numa única malha
import * as THREE from 'three';
import { hashStr } from './geo.js';

// Garante orientação horária na tela (norte para cima => shoelace > 0 no nosso sistema x-leste/z-sul)
function ensureCW(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s >= 0 ? ring : ring.slice().reverse();
}

export function buildBuildings(buildings, proj, heightAt, half, collision) {
  const pos = [], nrm = [], col = [], idx = [];
  const color = new THREE.Color();
  let count = 0;

  for (const b of buildings) {
    const localRings = [];
    let inside = false;
    for (const ring of b.rings) {
      const r = ring.map(p => proj.toLocal(p.lat, p.lon));
      if (r.some(([x, z]) => Math.abs(x) < half && Math.abs(z) < half)) inside = true;
      localRings.push(ensureCW(r));
    }
    if (!inside) continue;
    count++;

    // tom da parede varia por prédio; teto mais escuro
    const h0 = hashStr(b.id);
    const hue = 0.07 + ((h0 % 100) / 100) * 0.06;
    const sat = 0.04 + ((h0 >> 3) % 100) / 100 * 0.1;
    const lig = 0.58 + ((h0 >> 6) % 100) / 100 * 0.16;
    const wall = color.setHSL(hue, sat, lig).clone();
    const roof = color.setHSL(hue, sat * 0.8, lig * 0.52).clone();

    for (const ring of localRings) {
      let yMin = Infinity, yMax = -Infinity;
      for (const [x, z] of ring) {
        const h = heightAt(x, z);
        if (h < yMin) yMin = h;
        if (h > yMax) yMax = h;
      }
      const yBase = yMin - 1.5;             // afunda no terreno
      const yTop = yMin + b.height;         // altura contada do pé mais baixo
      if (yTop - yBase < 1) continue;

      // paredes
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], c = ring[(i + 1) % ring.length];
        const dx = c[0] - a[0], dz = c[1] - a[1];
        const len = Math.hypot(dx, dz);
        if (len < 0.05) continue;
        // com anel CW na tela, a normal externa é (dz, -dx)
        const nx = dz / len, nz = -dx / len;
        const vb = pos.length / 3;
        pos.push(a[0], yBase, a[1], c[0], yBase, c[1], c[0], yTop, c[1], a[0], yTop, a[1]);
        for (let k = 0; k < 4; k++) { nrm.push(nx, 0, nz); col.push(wall.r, wall.g, wall.b); }
        idx.push(vb, vb + 1, vb + 2, vb, vb + 2, vb + 3);
        collision.addSeg(a[0], a[1], c[0], c[1]);
      }

      // teto (triangulação; material DoubleSide cobre winding)
      try {
        const contour = ring.map(([x, z]) => new THREE.Vector2(x, z));
        const faces = THREE.ShapeUtils.triangulateShape(contour, []);
        const vb = pos.length / 3;
        for (const [x, z] of ring) {
          pos.push(x, yTop, z);
          nrm.push(0, 1, 0);
          col.push(roof.r, roof.g, roof.b);
        }
        for (const f of faces) idx.push(vb + f[0], vb + f[1], vb + f[2]);
      } catch (e) { /* footprint degenerado: fica sem teto */ }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, count };
}
