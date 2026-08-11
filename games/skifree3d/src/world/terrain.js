// Infinite terrain: a grid of chunks recycled as the player descends.
// The heights come from config.groundHeight, so physics and mesh never differ.
// The normals are computed with an extra border so there is no visible seam
// between neighbouring chunks.

import * as THREE from 'three';
import {
  CHUNK_SIZE, CHUNK_SEG, GRID_X, GRID_Z, GRID_BEHIND,
  groundHeight, TRACK_HALF_WIDTH,
} from '../config.js';
import { fbm2 } from '../lib/noise.js';

const SEG = CHUNK_SEG;
const VERTS = SEG + 1;            // vertices per side
const EXT = VERTS + 2;            // grade estendida (1 anel extra p/ normais)
const STEP = CHUNK_SIZE / SEG;

// Metres per repetition of the normal map. It has to divide CHUNK_SIZE into
// whole parts: that way a chunk's UV continues exactly where its neighbour's
// stopped. Folding the UV inside the chunk (with a % on world coordinates)
// compresses the whole texture into one quad and draws a visible seam.
const TILE = 20;
const TILE_WRAP = 64;   // UV value limit, so precision isn't lost

// the snow palette per vertex
const C_SNOW = new THREE.Color(0xffffff);
const C_SHADE = new THREE.Color(0x6d9bd0);   // bluish shadow in the hollows
const C_ICE = new THREE.Color(0xcfe4f5);     // packed snow on the ramps
const C_ROCK = new THREE.Color(0x6d7883);    // rocha exposta

function buildIndices() {
  const idx = [];
  for (let z = 0; z < SEG; z++) {
    for (let x = 0; x < SEG; x++) {
      const a = z * VERTS + x;
      const b = a + 1;
      const c = a + VERTS;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  return new Uint32Array(idx);
}

const INDICES = buildIndices();

class Chunk {
  constructor(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VERTS * VERTS * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(VERTS * VERTS * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(VERTS * VERTS * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(VERTS * VERTS * 3), 3));
    g.setIndex(new THREE.BufferAttribute(INDICES, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), CHUNK_SIZE);

    this.mesh = new THREE.Mesh(g, material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.matrixAutoUpdate = false;
    this.gx = null;
    this.gz = null;
  }

  /** Recomputes the chunk for cell (gx, gz) of the infinite grid. */
  build(gx, gz, heights) {
    this.gx = gx; this.gz = gz;

    const ox = gx * CHUNK_SIZE;      // the chunk's corner in world coords
    const oz = gz * CHUNK_SIZE;

    // the chunk's UV origin: whole in tile units, so it matches the
    // neighbouring chunk with no seam
    const uBase = (((ox / TILE) % TILE_WRAP) + TILE_WRAP) % TILE_WRAP;
    const vBase = (((oz / TILE) % TILE_WRAP) + TILE_WRAP) % TILE_WRAP;
    const originY = groundHeight(ox + CHUNK_SIZE * 0.5, oz + CHUNK_SIZE * 0.5);

    // heights on the extended grid (indices -1 .. SEG+1)
    for (let z = 0; z < EXT; z++) {
      const wz = oz + (z - 1) * STEP;
      for (let x = 0; x < EXT; x++) {
        const wx = ox + (x - 1) * STEP;
        heights[z * EXT + x] = groundHeight(wx, wz);
      }
    }

    const g = this.mesh.geometry;
    const pos = g.attributes.position.array;
    const nor = g.attributes.normal.array;
    const uv = g.attributes.uv.array;
    const col = g.attributes.color.array;

    const c = new THREE.Color();
    const inv2 = 1 / (2 * STEP);

    for (let z = 0; z < VERTS; z++) {
      for (let x = 0; x < VERTS; x++) {
        const i = z * VERTS + x;
        const e = (z + 1) * EXT + (x + 1);
        const h = heights[e];
        const wx = ox + x * STEP;
        const wz = oz + z * STEP;

        // ---- position (relative to the chunk centre: preserves precision)
        pos[i * 3] = x * STEP - CHUNK_SIZE * 0.5;
        pos[i * 3 + 1] = h - originY;
        pos[i * 3 + 2] = z * STEP - CHUNK_SIZE * 0.5;

        // ---- normal by central difference (continuous between chunks)
        const hL = heights[e - 1], hR = heights[e + 1];
        const hD = heights[e - EXT], hU = heights[e + EXT];
        let nx = (hL - hR) * inv2;
        let ny = 1;
        let nz = (hD - hU) * inv2;
        const len = Math.hypot(nx, ny, nz);
        nor[i * 3] = nx / len;
        nor[i * 3 + 1] = ny / len;
        nor[i * 3 + 2] = nz / len;

        // ---- uv continuous within the chunk and aligned with the neighbours
        uv[i * 2] = uBase + (x * STEP) / TILE;
        uv[i * 2 + 1] = vBase + (z * STEP) / TILE;

        // ---- colour: shadow in the hollows, ice on the ramps, rock where steep
        const slopeAmt = 1 - ny / len;                       // 0 plano .. 1 vertical
        const grain = fbm2(wx * 0.06, wz * 0.06, 2) * 0.5 + 0.5;

        c.copy(C_SNOW);
        // concavity approximated by the laplacian: hollows go bluish
        const lap = (hL + hR + hD + hU) * 0.25 - h;
        c.lerp(C_SHADE, THREE.MathUtils.clamp(lap * 0.55 + 0.12, 0, 0.66));
        c.lerp(C_ICE, THREE.MathUtils.clamp(slopeAmt * 1.5 - 0.10, 0, 0.5));
        if (slopeAmt > 0.42) {
          const rockAmt = THREE.MathUtils.clamp((slopeAmt - 0.42) * 2.6, 0, 0.85);
          c.lerp(C_ROCK, rockAmt * (0.55 + grain * 0.45));
        }
        // off the piste the snow is rawer and greyer
        const outside = THREE.MathUtils.clamp((Math.abs(wx) - TRACK_HALF_WIDTH) / 90, 0, 1);
        c.lerp(C_SHADE, outside * 0.22);
        // granulado geral
        const g2 = 0.965 + grain * 0.035;
        col[i * 3] = c.r * g2;
        col[i * 3 + 1] = c.g * g2;
        col[i * 3 + 2] = c.b * g2;
      }
    }

    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.attributes.uv.needsUpdate = true;
    g.attributes.color.needsUpdate = true;

    this.mesh.position.set(ox + CHUNK_SIZE * 0.5, originY, oz + CHUNK_SIZE * 0.5);
    this.mesh.updateMatrix();
  }
}

export function createTerrain(parent, material) {
  const chunks = [];
  const heights = new Float32Array(EXT * EXT);
  const pending = [];              // rebuild queue (spreads the cost)
  const live = new Map();          // "gx,gz" -> chunk

  for (let i = 0; i < GRID_X * GRID_Z; i++) {
    const ch = new Chunk(material);
    chunks.push(ch);
    parent.add(ch.mesh);
  }

  let free = chunks.slice();

  function desiredCells(px, pz) {
    const cx = Math.floor(px / CHUNK_SIZE);
    const cz = Math.floor(pz / CHUNK_SIZE);
    const half = (GRID_X - 1) >> 1;
    const cells = [];
    for (let z = 0; z < GRID_Z; z++) {
      for (let x = 0; x < GRID_X; x++) {
        cells.push([cx - half + x, cz - GRID_BEHIND + z]);
      }
    }
    return cells;
  }

  /** Recomputes the grid around the player. */
  function update(px, pz, budget = 2) {
    const cells = desiredCells(px, pz);
    const wanted = new Set(cells.map(([x, z]) => x + ',' + z));

    // give back chunks that left the grid
    for (const [key, ch] of live) {
      if (!wanted.has(key)) {
        live.delete(key);
        ch.mesh.visible = false;
        free.push(ch);
      }
    }

    // queue the missing ones, nearest to the player first
    for (const [gx, gz] of cells) {
      const key = gx + ',' + gz;
      if (live.has(key) || pending.some((p) => p.key === key)) continue;
      const dz = (gz + 0.5) * CHUNK_SIZE - pz;
      const dx = (gx + 0.5) * CHUNK_SIZE - px;
      pending.push({ key, gx, gz, d: dx * dx + dz * dz * 0.35 });
    }
    if (pending.length > 1) pending.sort((a, b) => a.d - b.d);

    let done = 0;
    while (pending.length && done < budget) {
      const job = pending.shift();
      const ch = free.pop();
      if (!ch) { pending.unshift(job); break; }
      ch.build(job.gx, job.gz, heights);
      ch.mesh.visible = true;
      live.set(job.key, ch);
      done++;
    }
  }

  /** Fills the entire grid at once (used at the start of a run). */
  function prime(px, pz) {
    update(px, pz, GRID_X * GRID_Z);
    while (pending.length) update(px, pz, GRID_X * GRID_Z);
  }

  function reset() {
    for (const ch of chunks) { ch.mesh.visible = false; ch.gx = ch.gz = null; }
    live.clear();
    pending.length = 0;
    free = chunks.slice();
  }

  function dispose() {
    for (const ch of chunks) {
      parent.remove(ch.mesh);
      ch.mesh.geometry.dispose();
    }
  }

  return { update, prime, reset, dispose, chunks };
}
