// Kicked-up snow particles: the spray off the skis, the burst of a crash and
// the dust of a landing.

import * as THREE from 'three';

function makeParticleTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(245,251,255,0.72)');
  g.addColorStop(1.0, 'rgba(230,244,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VERT = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  uniform float uPixelRatio;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = max(-mv.z, 0.1);

    // a particle right on the lens becomes a giant blur: clamp it and fade it
    vAlpha = aAlpha * smoothstep(0.6, 2.4, dist);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(aSize * uPixelRatio * (300.0 / dist), 42.0 * uPixelRatio);
  }
`;

const FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    if (tex.a * vAlpha < 0.01) discard;
    gl_FragColor = vec4(uColor * (0.92 + tex.a * 0.08), tex.a * vAlpha);
    #include <colorspace_fragment>
  }
`;

export function createSpray(parent, capacity = 900) {
  const positions = new Float32Array(capacity * 3);
  const sizes = new Float32Array(capacity);
  const alphas = new Float32Array(capacity);

  const vel = new Float32Array(capacity * 3);
  const life = new Float32Array(capacity);
  const maxLife = new Float32Array(capacity);
  const size0 = new Float32Array(capacity);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const texture = makeParticleTexture();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uColor: { value: new THREE.Color(0xffffff) },
      uPixelRatio: { value: Math.min(devicePixelRatio || 1, 2) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  parent.add(points);

  let cursor = 0;
  let alive = 0;

  function emit(x, y, z, vx, vy, vz, sz, lf) {
    const i = cursor;
    cursor = (cursor + 1) % capacity;
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    life[i] = lf; maxLife[i] = lf;
    size0[i] = sz;
    sizes[i] = sz;
    alphas[i] = 1;
    alive++;
  }

  /** A fan of snow thrown out from under a ski. */
  function emitSpray(x, y, z, dirX, dirZ, speed, amount) {
    const n = Math.min(amount, 18);
    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * 1.5;
      const sx = -dirX * (0.25 + Math.random() * 0.7) * speed * 0.16 + dirZ * spread * 2.4;
      const sz = -dirZ * (0.25 + Math.random() * 0.7) * speed * 0.16 - dirX * spread * 2.4;
      emit(
        x + (Math.random() - 0.5) * 0.5,
        y + Math.random() * 0.12,
        z + (Math.random() - 0.5) * 0.5,
        sx, 1.4 + Math.random() * 2.8 + speed * 0.05, sz,
        0.085 + Math.random() * 0.13,
        0.38 + Math.random() * 0.5
      );
    }
  }

  /** A radial burst — a crash, a landing, the Yeti stomping. */
  function burst(x, y, z, power = 1, count = 40) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random();
      emit(
        x + Math.cos(a) * r * 0.6, y + Math.random() * 0.4, z + Math.sin(a) * r * 0.6,
        Math.cos(a) * (1.5 + Math.random() * 5) * power,
        1.8 + Math.random() * 5.5 * power,
        Math.sin(a) * (1.5 + Math.random() * 5) * power,
        0.11 + Math.random() * 0.24,
        0.55 + Math.random() * 0.8
      );
    }
  }

  const GRAV = 9.0;
  const DRAG = 2.4;

  function update(dt) {
    if (alive <= 0) return;
    let remaining = 0;
    for (let i = 0; i < capacity; i++) {
      if (life[i] <= 0) { if (sizes[i] !== 0) { sizes[i] = 0; alphas[i] = 0; } continue; }
      life[i] -= dt;
      if (life[i] <= 0) { sizes[i] = 0; alphas[i] = 0; continue; }
      remaining++;

      const d = Math.max(0, 1 - DRAG * dt);
      vel[i * 3] *= d;
      vel[i * 3 + 1] = (vel[i * 3 + 1] - GRAV * dt) * d;
      vel[i * 3 + 2] *= d;

      positions[i * 3] += vel[i * 3] * dt;
      positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
      positions[i * 3 + 2] += vel[i * 3 + 2] * dt;

      const t = life[i] / maxLife[i];
      alphas[i] = t < 0.35 ? t / 0.35 : 1;
      sizes[i] = size0[i] * (1.35 - t * 0.35);
    }
    alive = remaining;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  }

  function reset() {
    life.fill(0);
    sizes.fill(0);
    alphas.fill(0);
    alive = 0;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  }

  function dispose() {
    parent.remove(points);
    geo.dispose(); material.dispose(); texture.dispose();
  }

  return { emit, emitSpray, burst, update, reset, dispose, points };
}
