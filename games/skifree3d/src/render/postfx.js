// Our own post-processing passes: volumetric sun rays and a final "lens"
// stage (radial motion blur, aberration, vignette, grain and colour grading).

import * as THREE from 'three';

// ============================================================= god rays
// Screen-space volumetric light scattering (GPU Gems 3): march the pixel
// towards the sun accumulating whatever is very bright. Since the sky's solar
// disc is the only genuinely blown-out object, the trees and terrain covering
// it cut the rays out for free.
export const GodRaysShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSunPos: { value: new THREE.Vector2(0.5, 0.8) },
    uIntensity: { value: 0.24 },
    uDecay: { value: 0.965 },
    uDensity: { value: 0.85 },
    uWeight: { value: 0.62 },
    uVisible: { value: 0.0 },
    uThreshold: { value: 4.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2  uSunPos;
    uniform float uIntensity;
    uniform float uDecay;
    uniform float uDensity;
    uniform float uWeight;
    uniform float uVisible;
    uniform float uThreshold;
    varying vec2 vUv;

    const int SAMPLES = 32;

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      if (uVisible < 0.001) { gl_FragColor = base; return; }

      vec2 delta = (vUv - uSunPos) * (uDensity / float(SAMPLES));
      vec2 uv = vUv;
      float illum = 1.0;
      vec3 accum = vec3(0.0);

      for (int i = 0; i < SAMPLES; i++) {
        uv -= delta;
        vec3 s = texture2D(tDiffuse, clamp(uv, vec2(0.0), vec2(1.0))).rgb;
        float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
        s *= smoothstep(uThreshold, uThreshold * 2.2, lum);
        accum += s * illum * uWeight;
        illum *= uDecay;
      }
      accum /= float(SAMPLES);

      // fades as the sun nears the edge: otherwise the rays "stick" to the screen
      float edge = 1.0 - smoothstep(0.30, 0.85, length(uSunPos - vec2(0.5)));
      gl_FragColor = vec4(base.rgb + accum * uIntensity * edge * uVisible, base.a);
    }
  `,
};

// ================================================================ lente
// Runs after tone mapping, in display space.
export const LensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uSpeed: { value: 0 },            // 0..1 — strength of the radial blur
    uAberration: { value: 0.0007 },
    uVignette: { value: 0.62 },
    uGrain: { value: 0.022 },
    uContrast: { value: 1.06 },
    uSaturation: { value: 1.28 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uSpeed;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uContrast;
    uniform float uSaturation;
    uniform vec2  uResolution;
    varying vec2 vUv;

    vec3 sampleAberrated(vec2 uv, vec2 dir, float amount) {
      vec3 c;
      c.r = texture2D(tDiffuse, uv + dir * amount).r;
      c.g = texture2D(tDiffuse, uv).g;
      c.b = texture2D(tDiffuse, uv - dir * amount).b;
      return c;
    }

    void main() {
      vec2 center = vec2(0.5);
      vec2 dir = vUv - center;
      float r = length(dir);
      float ab = uAberration * r * r * 14.0;

      vec3 col;
      float blur = uSpeed * 0.055 * smoothstep(0.06, 0.7, r);
      if (blur > 0.0008) {
        // radial blur: the world stretches outwards as you speed up
        float total = 0.0;
        col = vec3(0.0);
        for (int i = 0; i < 8; i++) {
          float t = float(i) / 7.0;
          vec2 uv = center + dir * (1.0 - blur * t);
          float w = 1.0 - t * 0.6;
          col += sampleAberrated(uv, dir, ab) * w;
          total += w;
        }
        col /= total;
      } else {
        col = sampleAberrated(vUv, dir, ab);
      }

      // ---- grading
      col = (col - 0.5) * uContrast + 0.5;
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(lum), col, uSaturation);
      // split toning: cool shadows, warm highlights — the classic read of snow
      col = mix(col * vec3(0.955, 0.982, 1.06), col * vec3(1.045, 1.012, 0.955),
                smoothstep(0.22, 0.88, lum));

      // ---- vinheta
      float vig = smoothstep(1.02, 0.30, r);
      col *= mix(1.0, vig, uVignette);

      // ---- grain
      float g = fract(sin(dot(vUv * uResolution + vec2(uTime * 37.0), vec2(12.9898, 78.233))) * 43758.5453);
      col += (g - 0.5) * uGrain;

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

/** Projects the sun direction to screen coordinates (uv) and returns visibility. */
const _sunWorld = new THREE.Vector3();
const _camPos = new THREE.Vector3();

export function updateSunScreenPosition(sunDirection, camera, uniforms) {
  camera.getWorldPosition(_camPos);
  _sunWorld.copy(sunDirection).multiplyScalar(1200).add(_camPos);
  _sunWorld.project(camera);

  const behind = _sunWorld.z > 1;
  uniforms.uSunPos.value.set(_sunWorld.x * 0.5 + 0.5, _sunWorld.y * 0.5 + 0.5);

  // fades out smoothly when the sun leaves the frame
  const dx = Math.max(0, Math.abs(_sunWorld.x) - 1);
  const dy = Math.max(0, Math.abs(_sunWorld.y) - 1);
  const off = Math.hypot(dx, dy);
  uniforms.uVisible.value = behind ? 0 : Math.max(0, 1 - off * 2.5);
}
