// Populating the mountain: trees, rocks, ramps, flags, chalets.
// The world is divided into 25 m bands; each band is generated
// deterministically from its index, so the mountain is always the same and can
// be rebuilt without storing any state.

import * as THREE from 'three';
import {
  makePineGeometry, makeRockGeometry, makeRampGeometry, makeBushGeometry,
  makeStumpGeometry, makeFlagGeometry, makeChaletGeometry, makeSignGeometry,
} from './geometries.js';
import { hash2, makeRng } from '../lib/noise.js';
import { groundHeight, groundNormal, TRACK_HALF_WIDTH } from '../config.js';

export const BAND = 25;
const AHEAD = 640;
const BEHIND = 110;
const SAFE_START = 70;      // the first metres kept clear of obstacles

/** Centre of the clear corridor (used in forest mode) and of the slalom line. */
export function corridorCenter(z) {
  return Math.sin(z * 0.0075) * 42 + Math.sin(z * 0.0207 + 1.4) * 16;
}

// ------------------------------------------------------------ pool
class InstancePool {
  constructor(parent, geometry, material, capacity, { shadow = true, tint = 0 } = {}) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.tint = tint;
    this.mesh.castShadow = shadow;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.capacity = capacity;
    this.free = [];
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = capacity - 1; i >= 0; i--) {
      this.mesh.setMatrixAt(i, zero);
      this.free.push(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.zero = zero;

    // every instance gets a slight colour offset, or the whole forest looks
    // like the same model copied over
    if (tint > 0) {
      const c = new THREE.Color();
      for (let i = 0; i < capacity; i++) {
        const h = hash2(i, 4211), h2 = hash2(i, 907);
        c.setRGB(1 - tint * h * 0.9, 1 - tint * h2 * 0.35, 1 - tint * (1 - h) * 0.75);
        this.mesh.setColorAt(i, c);
      }
      this.mesh.instanceColor.needsUpdate = true;
    }
    parent.add(this.mesh);
  }

  acquire(matrix) {
    const id = this.free.pop();
    if (id === undefined) return -1;
    this.mesh.setMatrixAt(id, matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    return id;
  }

  release(id) {
    if (id < 0) return;
    this.mesh.setMatrixAt(id, this.zero);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.free.push(id);
  }

  reset() {
    this.free.length = 0;
    for (let i = this.capacity - 1; i >= 0; i--) {
      this.mesh.setMatrixAt(i, this.zero);
      this.free.push(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(parent) {
    parent.remove(this.mesh);
    this.mesh.dispose();
    this.mesh.geometry.dispose();
  }
}

export function createProps(parent, material, options = {}, foliageMaterial = null) {
  const dummy = new THREE.Object3D();
  const nrm = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion();

  // -------------------------------------------------------- geometrias
  const pineGeos = [makePineGeometry(1), makePineGeometry(2), makePineGeometry(3)];
  const rockGeos = [makeRockGeometry(1), makeRockGeometry(2)];
  const bushGeo = makeBushGeometry(1);
  const stumpGeo = makeStumpGeometry();
  const rampGeo = makeRampGeometry(9.5, 8, 2.5);
  const flagRedGeo = makeFlagGeometry(0xe0342a);
  const flagBlueGeo = makeFlagGeometry(0x2a5bd7);
  const chaletGeos = [makeChaletGeometry(1), makeChaletGeometry(2)];
  const signGeos = [makeSignGeometry(-1), makeSignGeometry(1)];

  const treeMat = foliageMaterial || material;

  const pools = {
    pine: pineGeos.map((g) => new InstancePool(parent, g, treeMat, 420, { tint: 0.26 })),
    rock: rockGeos.map((g) => new InstancePool(parent, g, material, 130)),
    bush: new InstancePool(parent, bushGeo, treeMat, 300, { tint: 0.22 }),
    stump: new InstancePool(parent, stumpGeo, material, 90),
    ramp: new InstancePool(parent, rampGeo, material, 70),
    flagRed: new InstancePool(parent, flagRedGeo, material, 90, { shadow: false }),
    flagBlue: new InstancePool(parent, flagBlueGeo, material, 90, { shadow: false }),
    chalet: chaletGeos.map((g) => new InstancePool(parent, g, material, 6)),
    sign: signGeos.map((g) => new InstancePool(parent, g, material, 24)),
  };

  const bands = new Map();     // index -> { instances, colliders, ramps, gates }
  let cfg = options;

  // ----------------------------------------------------- posicionamento
  function placeUpright(x, z, scale, rotY) {
    const y = groundHeight(x, z);
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    return y;
  }

  function placeAligned(x, z, scale, rotY) {
    const y = groundHeight(x, z);
    groundNormal(x, z, nrm);
    quat.setFromUnitVectors(up, nrm);
    dummy.position.set(x, y, z);
    dummy.quaternion.copy(quat);
    dummy.rotateY(rotY);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    return y;
  }

  // ----------------------------------------------------- generation
  function tooClose(list, x, z, minDist) {
    const m2 = minDist * minDist;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const dx = c.x - x, dz = c.z - z;
      if (dx * dx + dz * dz < m2) return true;
    }
    return false;
  }

  function buildBand(index) {
    const z0 = index * BAND;
    const rng = makeRng((index * 9781) ^ 0x5f3a);
    const instances = [];
    const colliders = [];
    const ramps = [];
    const gates = [];

    const add = (pool) => {
      const id = pool.acquire(dummy.matrix);
      if (id >= 0) instances.push({ pool, id });
    };

    const corridor = cfg.corridor || 0;
    const cCenter = corridorCenter(z0);

    const inCorridor = (x) => corridor > 0 && Math.abs(x - cCenter) < corridor * 0.5;

    // ------------------------------------------------- forest at the sides
    // Density grows outwards: the woods close in and bound the piste.
    for (let side = -1; side <= 1; side += 2) {
      const count = 7;
      for (let i = 0; i < count; i++) {
        const off = Math.pow(rng(), 0.55) * 190;
        const x = side * (TRACK_HALF_WIDTH - 18 + off);
        const z = z0 + rng() * BAND;
        if (Math.abs(x) > 340) continue;
        if (tooClose(colliders, x, z, 3.4)) continue;
        const s = 0.75 + rng() * 0.65;
        placeUpright(x, z, s, rng() * Math.PI * 2);
        add(pools.pine[(rng() * 3) | 0]);
        colliders.push({ x, z, r: 1.05 * s, type: 'tree' });
      }
    }

    if (z0 > SAFE_START) {
      // --------------------------------------------- trees on the piste
      const treeCount = Math.round((rng() * 1.6 + 0.9) * (cfg.treeDensity ?? 1));
      for (let i = 0; i < treeCount; i++) {
        const x = (rng() * 2 - 1) * (TRACK_HALF_WIDTH - 6);
        const z = z0 + rng() * BAND;
        if (inCorridor(x)) continue;
        if (tooClose(colliders, x, z, 5.0)) continue;
        const s = 0.8 + rng() * 0.6;
        placeUpright(x, z, s, rng() * Math.PI * 2);
        add(pools.pine[(rng() * 3) | 0]);
        colliders.push({ x, z, r: 1.05 * s, type: 'tree' });
      }

      // ---------------------------------------------------------- pedras
      const rockCount = rng() < 0.55 * (cfg.rockDensity ?? 1) ? 1 + ((rng() * 2) | 0) : 0;
      for (let i = 0; i < rockCount; i++) {
        const x = (rng() * 2 - 1) * (TRACK_HALF_WIDTH - 4);
        const z = z0 + rng() * BAND;
        if (inCorridor(x) && rng() > 0.35) continue;
        if (tooClose(colliders, x, z, 4.0)) continue;
        const s = 0.7 + rng() * 0.95;
        placeAligned(x, z, s, rng() * Math.PI * 2);
        add(pools.rock[(rng() * 2) | 0]);
        colliders.push({ x, z, r: 0.85 * s, type: 'rock' });
      }

      // --------------------------------------------------------- arbustos
      if (rng() < 0.6) {
        const x = (rng() * 2 - 1) * (TRACK_HALF_WIDTH + 40);
        const z = z0 + rng() * BAND;
        if (!tooClose(colliders, x, z, 3.0)) {
          const s = 0.7 + rng() * 0.7;
          placeAligned(x, z, s, rng() * Math.PI * 2);
          add(pools.bush);
          // a bush knocks nobody down: it is only decoration
        }
      }

      // ----------------------------------------------------------- tocos
      if (rng() < 0.22) {
        const x = (rng() * 2 - 1) * (TRACK_HALF_WIDTH - 10);
        const z = z0 + rng() * BAND;
        if (!inCorridor(x) && !tooClose(colliders, x, z, 3.5)) {
          const s = 0.8 + rng() * 0.5;
          placeAligned(x, z, s, rng() * Math.PI * 2);
          add(pools.stump);
          colliders.push({ x, z, r: 0.62 * s, type: 'stump' });
        }
      }

      // ---------------------------------------------------------- rampas
      if (rng() < 0.16 * (cfg.rampDensity ?? 1)) {
        const x = (rng() * 2 - 1) * (TRACK_HALF_WIDTH - 25);
        const z = z0 + rng() * BAND;
        if (!tooClose(colliders, x, z, 12)) {
          const s = 0.85 + rng() * 0.6;
          placeAligned(x, z, s, 0);
          add(pools.ramp);
          ramps.push({
            x, z, w: 8 * s, len: 9.5 * s, h: 2.5 * s,
            y: groundHeight(x, z),
          });
        }
      }

      // ---------------------------------------------------------- chalet
      if (rng() < 0.035) {
        const side = rng() < 0.5 ? -1 : 1;
        const x = side * (TRACK_HALF_WIDTH + 25 + rng() * 55);
        const z = z0 + rng() * BAND;
        if (!tooClose(colliders, x, z, 16)) {
          const s = 0.9 + rng() * 0.35;
          placeUpright(x, z, s, rng() * Math.PI * 2);
          add(pools.chalet[(rng() * 2) | 0]);
          colliders.push({ x, z, r: 4.6 * s, type: 'chalet' });
        }
      }

      // ----------------------------------------------------------- placa
      if (rng() < 0.05) {
        const dir = rng() < 0.5 ? 0 : 1;
        const x = (rng() * 2 - 1) * (TRACK_HALF_WIDTH - 20);
        const z = z0 + rng() * BAND;
        if (!tooClose(colliders, x, z, 6)) {
          placeAligned(x, z, 1, 0);
          add(pools.sign[dir]);
          colliders.push({ x, z, r: 0.5, type: 'sign' });
        }
      }
    }

    // -------------------------------------------------------- gates
    // One gate every GATE_SPACING metres; each band hosts at most one.
    if (cfg.gates) {
      const GATE_SPACING = 42;
      const gateIndex = Math.ceil(z0 / GATE_SPACING);
      const gz = gateIndex * GATE_SPACING;
      if (gz >= z0 && gz < z0 + BAND && gz > SAFE_START) {
        const h = hash2(gateIndex, 7717);
        const cx = Math.sin(gateIndex * 0.78) * 38 + Math.sin(gateIndex * 1.9) * 12 + (h - 0.5) * 10;
        const halfW = 4.8 + h * 2.2;

        // cloths pointing into the gate, facing whoever is coming down
        placeUpright(cx - halfW, gz, 1, 0);
        add(pools.flagRed);
        placeUpright(cx + halfW, gz, 1, Math.PI);
        add(pools.flagBlue);

        gates.push({ index: gateIndex, x: cx, z: gz, halfW, passed: false });
      }
    }

    bands.set(index, { instances, colliders, ramps, gates });
  }

  function releaseBand(index) {
    const band = bands.get(index);
    if (!band) return;
    for (const it of band.instances) it.pool.release(it.id);
    bands.delete(index);
  }

  // ------------------------------------------------------------- API
  function update(travel) {
    const first = Math.floor((travel - BEHIND) / BAND);
    const last = Math.ceil((travel + AHEAD) / BAND);

    for (const idx of bands.keys()) {
      if (idx < first || idx > last) releaseBand(idx);
    }
    for (let i = first; i <= last; i++) {
      if (!bands.has(i)) buildBand(i);
    }
  }

  /** Colliders in the bands near z. */
  function collidersNear(z, out) {
    out.length = 0;
    const c = Math.floor(z / BAND);
    for (let i = c - 1; i <= c + 1; i++) {
      const band = bands.get(i);
      if (!band) continue;
      for (const col of band.colliders) out.push(col);
    }
    return out;
  }

  function rampsNear(z, out) {
    out.length = 0;
    const c = Math.floor(z / BAND);
    for (let i = c - 1; i <= c + 1; i++) {
      const band = bands.get(i);
      if (!band) continue;
      for (const r of band.ramps) out.push(r);
    }
    return out;
  }

  function gatesNear(z, out) {
    out.length = 0;
    const c = Math.floor(z / BAND);
    for (let i = c - 2; i <= c + 2; i++) {
      const band = bands.get(i);
      if (!band) continue;
      for (const g of band.gates) out.push(g);
    }
    return out;
  }

  function reset(newOptions) {
    if (newOptions) cfg = newOptions;
    for (const idx of Array.from(bands.keys())) releaseBand(idx);
    bands.clear();
    for (const key in pools) {
      const p = pools[key];
      if (Array.isArray(p)) p.forEach((x) => x.reset());
      else p.reset();
    }
  }

  function dispose() {
    for (const key in pools) {
      const p = pools[key];
      if (Array.isArray(p)) p.forEach((x) => x.dispose(parent));
      else p.dispose(parent);
    }
  }

  return { update, collidersNear, rampsNear, gatesNear, reset, dispose, bands };
}
