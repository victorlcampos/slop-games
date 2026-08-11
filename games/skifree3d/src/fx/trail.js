// The ski trail: a ribbon stuck to the snow that fades away.
// Keeps the last N points and rebuilds the strip when one is added.

import * as THREE from 'three';
import { groundHeight, groundNormal } from '../config.js';

const MAX_POINTS = 260;
const STEP = 0.75;          // metres between points
const LIFT = 0.055;         // lifts off the terrain to avoid fighting in the z-buffer

const VERT = /* glsl */`
  attribute float aAlpha;
  varying float vAlpha;
  varying vec2 vUv;
  void main() {
    vAlpha = aAlpha;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */`
  varying float vAlpha;
  varying vec2 vUv;
  uniform vec3 uColor;
  void main() {
    // two thin grooves, one per ski — no backing strip, which from a distance
    // turned into a dark smudge behind the skier
    float d = abs(vUv.x - 0.5) * 2.0;
    float groove = smoothstep(0.30, 0.52, d) * (1.0 - smoothstep(0.66, 0.88, d));
    float a = vAlpha * groove;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * 0.30);
    #include <colorspace_fragment>
  }
`;

export function createTrail(parent, { width = 0.70, color = 0xa9c6e0 } = {}) {
  const positions = new Float32Array(MAX_POINTS * 2 * 3);
  const uvs = new Float32Array(MAX_POINTS * 2 * 2);
  const alphas = new Float32Array(MAX_POINTS * 2);
  const indices = new Uint16Array((MAX_POINTS - 1) * 6);

  for (let i = 0; i < MAX_POINTS - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.set([a, c, b, b, c, d], i * 6);
  }
  for (let i = 0; i < MAX_POINTS; i++) {
    uvs[i * 4] = 0; uvs[i * 4 + 1] = i / MAX_POINTS;
    uvs[i * 4 + 2] = 1; uvs[i * 4 + 3] = i / MAX_POINTS;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.setDrawRange(0, 0);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  parent.add(mesh);

  const pts = [];        // {x,z,nx,nz} in world coordinates
  let lastX = null, lastZ = null;
  const nrm = new THREE.Vector3();

  /** Call once per frame with the player's position; it decides when to mark. */
  function push(x, z, heading, enabled = true) {
    if (!enabled) { lastX = x; lastZ = z; return; }
    if (lastX !== null) {
      const dx = x - lastX, dz = z - lastZ;
      if (dx * dx + dz * dz < STEP * STEP) return;
    }
    lastX = x; lastZ = z;

    // side vector derived from the heading
    const sx = Math.cos(heading), sz = -Math.sin(heading);
    pts.push({ x, z, sx, sz });
    if (pts.length > MAX_POINTS) pts.shift();
    rebuild();
  }

  function rebuild() {
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      groundNormal(p.x, p.z, nrm);
      const y = groundHeight(p.x, p.z) + LIFT;
      const hw = width * 0.5;
      const i0 = i * 6;
      positions[i0] = p.x - p.sx * hw;
      positions[i0 + 1] = y;
      positions[i0 + 2] = p.z - p.sz * hw;
      positions[i0 + 3] = p.x + p.sx * hw;
      positions[i0 + 4] = y;
      positions[i0 + 5] = p.z + p.sz * hw;

      // newer = stronger; it fades at both ends
      const age = i / Math.max(1, n - 1);
      const a = Math.min(1, age * 3.2) * (0.35 + age * 0.65);
      alphas[i * 2] = a;
      alphas[i * 2 + 1] = a;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.setDrawRange(0, Math.max(0, (n - 1) * 6));
  }

  function reset() {
    pts.length = 0;
    lastX = lastZ = null;
    geo.setDrawRange(0, 0);
  }

  function dispose() {
    parent.remove(mesh);
    geo.dispose(); material.dispose();
  }

  return { push, reset, dispose, mesh };
}
