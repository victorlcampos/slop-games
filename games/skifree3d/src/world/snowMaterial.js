// The snow material: MeshPhysical with sheen (the velvet of fresh powder),
// light clearcoat (the ice crust), a procedural normal map at two scales and
// the specular twinkle of crystals.

import * as THREE from 'three';
import { fbm2 } from '../lib/noise.js';

/** A snow normal map generated from noise: fine grain + wind sastrugi. */
export function makeSnowNormalTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);

  // a tileable height field: uses torus coordinates so the edges match
  const H = new Float32Array(size * size);
  const S = 6.0;   // cycles per texture (an integer => tileable)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      // sampling in "wrapped" 2D space — approximates tileability
      const nx = Math.cos(u) * S + Math.sin(v * 0.5) * 0.4;
      const nz = Math.sin(u) * S + Math.cos(v * 0.5) * 0.4;
      const mx = Math.cos(v) * S;
      const mz = Math.sin(v) * S;

      let h = fbm2(nx * 1.7, mz * 1.7, 4) * 0.55;
      h += fbm2(mx * 4.1 + 11, nz * 4.1 - 7, 3) * 0.3;
      // sastrugi: ridges stretched along the wind direction
      h += Math.sin((x / size) * Math.PI * 2 * 3 + h * 6.0) * 0.045;
      H[y * size + x] = h;
    }
  }

  const idx = (x, y) => ((y + size) % size) * size + ((x + size) % size);
  const strength = 2.6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H[idx(x + 1, y)] - H[idx(x - 1, y)]) * strength;
      const dy = (H[idx(x, y + 1)] - H[idx(x, y - 1)]) * strength;
      // normal tangente (x, y, z) -> RGB
      let nx = -dx, ny = -dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 16;
  tex.colorSpace = THREE.NoColorSpace;   // geometric data, not colour
  return tex;
}

/**
 * Creates the snow material. `uniforms.uTime` must be updated every frame for
 * the twinkle to flicker.
 */
export function createSnowMaterial(sunDirection, { sparkle = 1.0 } = {}) {
  const normalMap = makeSnowNormalTexture(512);

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xe9f1f9,
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.0,
    normalMap,
    normalScale: new THREE.Vector2(0.34, 0.34),
    envMapIntensity: 0.8,

    // Fresh snow scatters light at the edges. High doses of sheen/clearcoat
    // blow out in grazing backlight — realistic glare, unreadable in a game.
    sheen: 0.20,
    sheenColor: new THREE.Color(0xbcd9f2),
    sheenRoughness: 0.95,

    clearcoat: 0.05,
    clearcoatRoughness: 0.75,

    dithering: true,
  });

  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDirection.clone() },
    uSparkle: { value: sparkle },
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWorldPos;`)
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>\n  vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      // second octave of the normal map: kills the visible tile repetition
      .replace('#include <normal_fragment_maps>', /* glsl */`
        #include <normal_fragment_maps>
        {
          vec3 wide = texture2D(normalMap, vNormalMapUv * 0.137 + vec2(0.31, 0.67)).xyz * 2.0 - 1.0;
          normal = normalize(normal + vec3(wide.xy * 0.42, 0.0));
        }
      `)
      .replace('#include <common>', /* glsl */`
        #include <common>
        varying vec3 vWorldPos;
        uniform float uTime;
        uniform vec3  uSunDir;
        uniform float uSparkle;

        float snowHash(vec3 p) {
          p = fract(p * vec3(0.1031, 0.1030, 0.0973));
          p += dot(p, p.yxz + 33.33);
          return fract((p.x + p.y) * p.z);
        }
      `)
      .replace('#include <dithering_fragment>', /* glsl */`
        #include <dithering_fragment>

        // ---- twinkle: isolated crystals that only light at the right angle
        {
          vec3 cell = floor(vWorldPos * 30.0);
          float r = snowHash(cell);
          if (r > 0.9955) {
            vec3 rn = normalize(
              vec3(snowHash(cell + 1.7), snowHash(cell + 5.3) * 0.6 + 0.8, snowHash(cell + 9.1)) * 2.0 - 1.0
            );
            vec3 viewW = normalize(cameraPosition - vWorldPos);
            vec3 halfW = normalize(viewW + normalize(uSunDir));
            float spec = pow(max(dot(rn, halfW), 0.0), 160.0);
            float twinkle = 0.45 + 0.55 * sin(uTime * 4.0 + r * 400.0);
            gl_FragColor.rgb += vec3(1.0, 0.97, 0.88) * spec * twinkle * 3.2 * uSparkle;
          }
        }
      `);
  };

  // force a recompile when the material is reused between scenes
  mat.customProgramCacheKey = () => 'snow-v2';
  mat.userData.uniforms = uniforms;
  mat.userData.normalMap = normalMap;
  return mat;
}

/**
 * Foliage material: the same base as the props, but with wind sway in the
 * vertex shader. The strength grows with height above the instance's base.
 */
export function createFoliageMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.0,
  });

  const uniforms = { uTime: { value: 0 }, uWind: { value: 1.0 } };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uWind;`)
      .replace('#include <begin_vertex>', /* glsl */`
        #include <begin_vertex>
        {
          // the instance's world position: each tree sways out of phase
          #ifdef USE_INSTANCING
            vec3 instOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #else
            vec3 instOrigin = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
          #endif
          float phase = instOrigin.x * 0.21 + instOrigin.z * 0.17;
          float h = max(transformed.y, 0.0);
          float sway = sin(uTime * 1.35 + phase) * 0.55 + sin(uTime * 2.7 + phase * 1.9) * 0.25;
          transformed.x += sway * h * h * 0.0075 * uWind;
          transformed.z += cos(uTime * 1.1 + phase * 0.8) * h * h * 0.0045 * uWind;
        }
      `);
  };

  mat.customProgramCacheKey = () => 'foliage-v1';
  mat.userData.uniforms = uniforms;
  return mat;
}
