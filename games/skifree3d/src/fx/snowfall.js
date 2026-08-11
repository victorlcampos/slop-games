// Ambient snowfall. All the animation happens in the vertex shader: the
// particles live in a box that wraps around the camera, so they never run out.

import * as THREE from 'three';

const VERT = /* glsl */`
  attribute float aSize;
  attribute float aSpeed;
  attribute float aPhase;

  uniform float uTime;
  uniform vec3  uCenter;
  uniform vec3  uBox;
  uniform float uPixelRatio;
  uniform float uWind;

  varying float vFade;

  void main() {
    vec3 p = position;

    // continuous fall + sideways wobble
    p.y -= uTime * aSpeed;
    p.x += sin(uTime * 0.9 + aPhase) * 0.9 + uTime * uWind;
    p.z += cos(uTime * 0.7 + aPhase * 1.3) * 0.7;

    // wraps around the camera on all three axes
    vec3 rel = p - uCenter;
    rel = mod(rel + uBox * 0.5, uBox) - uBox * 0.5;
    vec3 world = uCenter + rel;

    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    float dist = -mv.z;

    // fades when very close (so it doesn't blur the lens) and far away
    vFade = smoothstep(1.5, 6.0, dist) * (1.0 - smoothstep(uBox.z * 0.30, uBox.z * 0.52, dist));

    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (260.0 / max(dist, 1.0));
  }
`;

const FRAG = /* glsl */`
  varying float vFade;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    float a = smoothstep(0.25, 0.02, r) * vFade * 0.85;
    if (a < 0.01) discard;
    gl_FragColor = vec4(1.0, 0.995, 0.99, a);
    #include <colorspace_fragment>
  }
`;

export function createSnowfall(scene, { count = 2600, box = new THREE.Vector3(150, 70, 150) } = {}) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const speeds = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * box.x;
    positions[i * 3 + 1] = (Math.random() - 0.5) * box.y;
    positions[i * 3 + 2] = (Math.random() - 0.5) * box.z;
    sizes[i] = 0.055 + Math.random() * 0.11;
    speeds[i] = 2.4 + Math.random() * 3.6;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const uniforms = {
    uTime: { value: 0 },
    uCenter: { value: new THREE.Vector3() },
    uBox: { value: box.clone() },
    uPixelRatio: { value: Math.min(devicePixelRatio || 1, 2) },
    uWind: { value: 0.6 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 6;
  scene.add(points);

  const tmp = new THREE.Vector3();

  return {
    points,
    setVisible(v) { points.visible = v; },
    update(camera, elapsed) {
      uniforms.uTime.value = elapsed;
      camera.getWorldPosition(tmp);
      // shifts the box ahead of the camera: more flakes where you are looking
      uniforms.uCenter.value.set(tmp.x, tmp.y + 8, tmp.z + box.z * 0.22);
    },
    dispose() {
      scene.remove(points);
      geo.dispose(); material.dispose();
    },
  };
}
