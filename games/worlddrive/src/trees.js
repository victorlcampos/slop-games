// Árvores: nós natural=tree + preenchimento procedural de parques/bosques
import * as THREE from 'three';
import { mulberry32 } from './geo.js';

const MAX_TREES = 1400;

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function buildTrees(trees, greens, proj, heightAt, half, collision, seed) {
  const rng = mulberry32(seed);
  const spots = [];

  for (const t of trees) {
    const [x, z] = proj.toLocal(t.lat, t.lon);
    if (Math.abs(x) < half && Math.abs(z) < half) spots.push([x, z]);
  }

  // espalha árvores dentro de áreas verdes (grade com jitter)
  for (const g of greens) {
    if (spots.length >= MAX_TREES) break;
    const ring = g.ring.map(p => proj.toLocal(p.lat, p.lon));
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of ring) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    x0 = Math.max(x0, -half); x1 = Math.min(x1, half);
    z0 = Math.max(z0, -half); z1 = Math.min(z1, half);
    const STEPG = 22;
    for (let gz = z0; gz < z1 && spots.length < MAX_TREES; gz += STEPG) {
      for (let gx = x0; gx < x1 && spots.length < MAX_TREES; gx += STEPG) {
        if (rng() < 0.45) continue;
        const x = gx + (rng() - 0.5) * STEPG * 0.9;
        const z = gz + (rng() - 0.5) * STEPG * 0.9;
        if (pointInRing(x, z, ring)) spots.push([x, z]);
      }
    }
  }

  const n = Math.min(spots.length, MAX_TREES);
  const group = new THREE.Group();
  if (!n) return { group, count: 0 };

  const crownGeo = new THREE.IcosahedronGeometry(1.35, 1);
  crownGeo.scale(1, 1.3, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 2.2, 6);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4f35 });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, n);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
  crowns.castShadow = true;
  trunks.castShadow = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const cUp = new THREE.Vector3(0, 1, 0);
  const cCol = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const [x, z] = spots[i];
    const y = heightAt(x, z);
    const s = 0.62 + rng() * 0.5;
    q.setFromAxisAngle(cUp, rng() * Math.PI * 2);
    m.compose(new THREE.Vector3(x, y + 2.1 * s + 1.4 * s, z), q, new THREE.Vector3(s, s, s));
    crowns.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, y + 1.1 * s, z), q, new THREE.Vector3(s, s, s));
    trunks.setMatrixAt(i, m);
    cCol.setHSL(0.26 + rng() * 0.09, 0.4 + rng() * 0.18, 0.2 + rng() * 0.1);
    crowns.setColorAt(i, cCol);
    collision.addCircle(x, z, 0.42 * s);
  }
  crowns.instanceMatrix.needsUpdate = true;
  trunks.instanceMatrix.needsUpdate = true;
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  group.add(crowns, trunks);
  return { group, count: n };
}
