// Constrói as malhas das ruas: fitas trianguladas que seguem o terreno
import * as THREE from 'three';
import { clamp } from './geo.js';

const STEP = 6; // resample: um vértice a cada ~6m

// Índice espacial de segmentos de rua (para spawn, reset, nome da rua, minimapa)
export class RoadIndex {
  constructor(cell = 30) { this.cell = cell; this.map = new Map(); this.segs = []; }
  key(cx, cz) { return cx + ':' + cz; }
  addSeg(ax, az, bx, bz, name, drivable) {
    const idx = this.segs.length;
    this.segs.push({ ax, az, bx, bz, name, drivable });
    const c = this.cell;
    const x0 = Math.floor(Math.min(ax, bx) / c), x1 = Math.floor(Math.max(ax, bx) / c);
    const z0 = Math.floor(Math.min(az, bz) / c), z1 = Math.floor(Math.max(az, bz) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const k = this.key(cx, cz);
      let arr = this.map.get(k);
      if (!arr) { arr = []; this.map.set(k, arr); }
      arr.push(idx);
    }
  }
  // rua mais próxima; anéis crescentes de células até maxR
  nearest(x, z, maxR = 400, drivableOnly = true, namedOnly = false) {
    const c = this.cell;
    const cx = Math.floor(x / c), cz = Math.floor(z / c);
    let best = null;
    const maxRing = Math.ceil(maxR / c) + 1;
    for (let ring = 0; ring <= maxRing; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const arr = this.map.get(this.key(cx + dx, cz + dz));
          if (!arr) continue;
          for (const i of arr) {
            const s = this.segs[i];
            if (drivableOnly && !s.drivable) continue;
            if (namedOnly && !s.name) continue;
            const r = closestOnSeg(x, z, s);
            if (!best || r.d2 < best.d2) best = { ...r, seg: s };
          }
        }
      }
      // achou algo e o anel seguinte já não pode melhorar
      if (best && Math.sqrt(best.d2) < (ring - 1) * c) break;
    }
    if (!best || best.d2 > maxR * maxR) return null;
    const s = best.seg;
    return {
      x: best.px, z: best.pz,
      heading: Math.atan2(s.bx - s.ax, -(s.bz - s.az)),
      name: s.name, dist: Math.sqrt(best.d2),
    };
  }
}

function closestOnSeg(x, z, s) {
  const dx = s.bx - s.ax, dz = s.bz - s.az;
  const L2 = dx * dx + dz * dz || 1e-9;
  const t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / L2, 0, 1);
  const px = s.ax + dx * t, pz = s.az + dz * t;
  const ddx = x - px, ddz = z - pz;
  return { px, pz, d2: ddx * ddx + ddz * ddz };
}

function resample(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(d / STEP));
    for (let j = 1; j <= n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
  }
  return out;
}

function asphaltTexture(withLine) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#33363b';
  g.fillRect(0, 0, 256, 64);
  // ruído sutil
  for (let i = 0; i < 900; i++) {
    const v = 40 + Math.random() * 30;
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.16 + Math.random() * 0.2})`;
    g.fillRect(Math.random() * 256, Math.random() * 64, 1.5, 1.5);
  }
  // bordas levemente claras (sensação de meio-fio/acostamento)
  g.fillStyle = 'rgba(190,190,196,0.32)';
  g.fillRect(0, 0, 256, 2);
  g.fillRect(0, 62, 256, 2);
  if (withLine) {
    // tracejado central: textura cobre 8m ao longo (u), traço de ~3.4m
    g.fillStyle = 'rgba(235,235,225,0.85)';
    g.fillRect(12, 30, 110, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function pathTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#8e8a80';
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 250; i++) {
    const v = 120 + Math.random() * 60;
    g.fillStyle = `rgba(${v},${v - 6},${v - 14},${0.2 + Math.random() * 0.25})`;
    g.fillRect(Math.random() * 64, Math.random() * 64, 1.5, 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Uma fita por rua; três buckets de material
export function buildRoads(roads, proj, heightAt, half) {
  const buckets = {
    lined: { pos: [], uv: [], idx: [] },
    plain: { pos: [], uv: [], idx: [] },
    path: { pos: [], uv: [], idx: [] },
  };
  const index = new RoadIndex();
  const minimapLines = [];
  const LINED = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'road']);

  for (const road of roads) {
    let pts = road.pts.map(p => proj.toLocal(p.lat, p.lon));
    // recorta ruas totalmente fora da área
    if (!pts.some(([x, z]) => Math.abs(x) < half + 40 && Math.abs(z) < half + 40)) continue;
    pts = resample(pts);
    if (pts.length < 2) continue;

    const isPath = road.kind === 'path';
    const bucket = isPath ? buckets.path : (LINED.has(road.hw) && road.width >= 5 ? buckets.lined : buckets.plain);
    const w2 = road.width / 2;
    const yOff = isPath ? 0.06 : 0.1;
    const base = bucket.pos.length / 3;
    let along = 0;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const pPrev = pts[Math.max(0, i - 1)];
      const pNext = pts[Math.min(pts.length - 1, i + 1)];
      let dx = pNext[0] - pPrev[0], dz = pNext[1] - pPrev[1];
      const dl = Math.hypot(dx, dz) || 1;
      dx /= dl; dz /= dl;
      // perpendicular (esquerda da direção)
      const px = dz, pz = -dx;
      if (i > 0) along += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      const lx = p[0] + px * w2, lz = p[1] + pz * w2;
      const rx = p[0] - px * w2, rz = p[1] - pz * w2;
      bucket.pos.push(lx, heightAt(lx, lz) + yOff, lz, rx, heightAt(rx, rz) + yOff, rz);
      const u = along / 8;
      bucket.uv.push(u, 0, u, 1);
      if (i > 0) {
        const a = base + (i - 1) * 2;
        bucket.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      // índice espacial (somente segmentos, sem geometria)
      if (i > 0) {
        const q = pts[i - 1];
        index.addSeg(q[0], q[1], p[0], p[1], road.name, !isPath);
      }
    }
    minimapLines.push({ pts, kind: road.kind, width: road.width });
  }

  const group = new THREE.Group();
  const mats = {
    lined: new THREE.MeshLambertMaterial({ map: asphaltTexture(true), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    plain: new THREE.MeshLambertMaterial({ map: asphaltTexture(false), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    path: new THREE.MeshLambertMaterial({ map: pathTexture(), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  };
  for (const name of ['lined', 'plain', 'path']) {
    const b = buckets[name];
    if (!b.idx.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    geo.setIndex(b.idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mats[name]);
    mesh.receiveShadow = true;
    mesh.renderOrder = name === 'path' ? 2 : 3;
    group.add(mesh);
  }
  return { group, index, minimapLines };
}
