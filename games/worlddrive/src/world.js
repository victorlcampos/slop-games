// Orchestrates loading and building the world around a lat/lon
import * as THREE from 'three';
import { makeProjection, bboxAround, mercX, mercY, clamp, hashStr } from './geo.js';
import { fetchOSM } from './overpass.js';
import { loadTerrain } from './terrain.js';
import { localized } from './net.js';
import { i18n } from './i18n.js';
import { loadSatellite } from './satellite.js';
import { buildRoads } from './roads.js';
import { buildBuildings } from './buildings.js';
import { buildTrees } from './trees.js';
import { t } from './i18n.js';

export const HALF = 640; // half-edge of the playable area, in metres

// Building walls and tree trunks for collision
export class CollisionGrid {
  constructor(cell = 16) { this.cell = cell; this.map = new Map(); }
  k(cx, cz) { return cx + ':' + cz; }
  _push(cx, cz, item) {
    const k = this.k(cx, cz);
    let arr = this.map.get(k);
    if (!arr) { arr = []; this.map.set(k, arr); }
    arr.push(item);
  }
  addSeg(ax, az, bx, bz) {
    const c = this.cell;
    const x0 = Math.floor((Math.min(ax, bx) - 2) / c), x1 = Math.floor((Math.max(ax, bx) + 2) / c);
    const z0 = Math.floor((Math.min(az, bz) - 2) / c), z1 = Math.floor((Math.max(az, bz) + 2) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) this._push(cx, cz, { t: 1, ax, az, bx, bz });
  }
  addCircle(x, z, r) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    this._push(cx, cz, { t: 2, x, z, r });
  }
  // contacts of a circle (px,pz,r): [{nx,nz,depth}]
  collide(px, pz, r) {
    const c = this.cell;
    const cx = Math.floor(px / c), cz = Math.floor(pz / c);
    const out = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const arr = this.map.get(this.k(cx + dx, cz + dz));
      if (!arr) continue;
      for (const it of arr) {
        if (it.t === 1) {
          const ddx = it.bx - it.ax, ddz = it.bz - it.az;
          const L2 = ddx * ddx + ddz * ddz || 1e-9;
          const t = clamp(((px - it.ax) * ddx + (pz - it.az) * ddz) / L2, 0, 1);
          const qx = it.ax + ddx * t, qz = it.az + ddz * t;
          let nx = px - qx, nz = pz - qz;
          const d = Math.hypot(nx, nz);
          if (d < r && d > 1e-6) out.push({ nx: nx / d, nz: nz / d, depth: r - d });
        } else {
          let nx = px - it.x, nz = pz - it.z;
          const d = Math.hypot(nx, nz);
          const rr = r + it.r;
          if (d < rr && d > 1e-6) out.push({ nx: nx / d, nz: nz / d, depth: rr - d });
        }
      }
    }
    return out;
  }
}

function buildTerrainMesh(proj, heightAt, sat) {
  const SEG = 150;
  const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2); // XZ plane, +y up
  const posA = geo.attributes.position;
  const uvA = geo.attributes.uv;
  for (let i = 0; i < posA.count; i++) {
    const x = posA.getX(i), z = posA.getZ(i);
    posA.setY(i, heightAt(x, z));
    const [mx, my] = proj.toMerc(x, z);
    uvA.setXY(i, (mx - sat.mxMin) / (sat.mxMax - sat.mxMin), (my - sat.myMin) / (sat.myMax - sat.myMin));
  }
  geo.computeVertexNormals();
  const tex = new THREE.CanvasTexture(sat.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// progress(stage, fraction[0..1], note?)
export async function loadWorld(lat, lon, progress) {
  const bbox = bboxAround(lat, lon, HALF * 1.07);
  const bboxT = bboxAround(lat, lon, HALF * 1.35); // extra margin for elevation

  const pOSM = fetchOSM(bbox, (bytes, note) => progress('osm', Math.min(0.95, bytes / 4e6), note || (() => fmtMB(bytes))));
  const pDem = loadTerrain(bboxT, (d, t) => progress('dem', d / t));
  const pSat = loadSatellite(bbox, (d, t) => progress('sat', d / t));

  const [osmR, demR, satR] = await Promise.allSettled([pOSM, pDem, pSat]);
  if (osmR.status === 'rejected') throw osmR.reason;
  if (demR.status === 'rejected') throw demR.reason;
  if (satR.status === 'rejected') throw satR.reason;
  const osm = osmR.value, dem = demR.value, sat = satR.value;
  progress('osm', 1); progress('dem', 1); progress('sat', 1);
  progress('build', 0.05);

  if (!osm.roads.some(r => r.kind === 'car')) {
    throw localized('load.noRoads');
  }

  const proj = makeProjection(lat, lon);

  // Reference height (origin y=0 at the centre) + a clamp for coastal water
  const rawCenter = dem.sample(mercX(lon), mercY(lat));
  const coastal = rawCenter > -2; // if the centre is "normal" land, bathymetry becomes sea level
  const heightRaw = (mx, my) => {
    let h = dem.sample(mx, my);
    if (coastal && h < -0.5) h = -0.5;
    return h;
  };
  const hRef = heightRaw(mercX(lon), mercY(lat));
  const heightAt = (x, z) => {
    const cx = clamp(x, -HALF * 1.3, HALF * 1.3);
    const cz = clamp(z, -HALF * 1.3, HALF * 1.3);
    return heightRaw(proj.mx0 + cx / proj.k, proj.my0 - cz / proj.k) - hRef;
  };
  const normalAt = (x, z, eps = 2.5) => {
    const dhx = (heightAt(x + eps, z) - heightAt(x - eps, z)) / (2 * eps);
    const dhz = (heightAt(x, z + eps) - heightAt(x, z - eps)) / (2 * eps);
    const n = new THREE.Vector3(-dhx, 1, -dhz);
    return n.normalize();
  };
  const slopeAt = (x, z, eps = 2.5) => {
    const dhx = (heightAt(x + eps, z) - heightAt(x - eps, z)) / (2 * eps);
    const dhz = (heightAt(x, z + eps) - heightAt(x, z - eps)) / (2 * eps);
    return [dhx, dhz];
  };

  await nextFrame();
  const group = new THREE.Group();
  const collision = new CollisionGrid();

  group.add(buildTerrainMesh(proj, heightAt, sat));
  progress('build', 0.35); await nextFrame();

  const roadsB = buildRoads(osm.roads, proj, heightAt, HALF);
  group.add(roadsB.group);
  progress('build', 0.6); await nextFrame();

  const bldB = buildBuildings(osm.buildings, proj, heightAt, HALF, collision);
  group.add(bldB.mesh);
  progress('build', 0.85); await nextFrame();

  const treesB = buildTrees(osm.trees, osm.greens, proj, heightAt, HALF, collision, hashStr(lat.toFixed(4) + lon.toFixed(4)));
  group.add(treesB.group);
  progress('build', 1);

  // spawn: the drivable street nearest the centre (preferring named streets)
  const sp = roadsB.index.nearest(0, 0, 220, true, true)
    || roadsB.index.nearest(0, 0, 900)
    || { x: 0, z: 0, heading: 0, name: null };

  return {
    group, proj, heightAt, normalAt, slopeAt, collision,
    roadIndex: roadsB.index,
    minimapLines: roadsB.minimapLines,
    spawn: sp,
    half: HALF,
    stats: { roads: osm.roads.length, buildings: bldB.count, trees: treesB.count },
    dispose() {
      group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); }
        }
      });
    },
  };
}

function fmtMB(b) {
  // the decimal separator follows the flag, like every other number here
  return (b / 1e6).toLocaleString(i18n.lang === 'pt' ? 'pt-BR' : 'en-US',
    { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MB';
}
function nextFrame() { return new Promise(r => requestAnimationFrame(() => r())); }
