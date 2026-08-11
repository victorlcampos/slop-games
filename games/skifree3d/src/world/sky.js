// Sky with atmospheric scattering (Preetham), a distant range and clouds.
// The same sky feeds the environment map, so the scene's ambient light comes
// physically from the air and the sun, not from a guessed colour.

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { fbm2, ridged2, makeRng } from '../lib/noise.js';

// The dome has to fit inside camera.far: the far plane clips geometry even
// with frustumCulled turned off.
const SKY_RADIUS = 2000;

export const SKY_PARAMS = {
  turbidity: 1.8,          // ar limpo de alta montanha
  rayleigh: 1.0,           // high values wash the blue out after tone mapping
  mieCoefficient: 0.005,   // glow around the sun
  mieDirectionalG: 0.78,
  intensity: 0.30,         // HDR scale of the sky (measured, not guessed)
  ridgeGain: 1.5,          // compensates tone mapping on the ranges
};

/**
 * three's Sky returns radiance on its own scale, far too high for ACES:
 * without this scale the blue turns white. It also exposes the solar disc at a
 * value well above 1, which is what feeds the god rays.
 */
function applyIntensityPatch(material, intensity) {
  const uniforms = { uSkyIntensity: { value: intensity } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uSkyIntensity;\nvoid main() {')
      .replace(
        'gl_FragColor = vec4( retColor, 1.0 );',
        'gl_FragColor = vec4( retColor * uSkyIntensity, 1.0 );'
      );
  };
  material.customProgramCacheKey = () => 'sky-intensity-v1';
  material.userData.uniforms = uniforms;
  return material;
}

/** A soft cloud texture generated from noise (no external files). */
function makeCloudTexture(size = 128, seed = 7) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const off = seed * 37.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n = fbm2(u * 3.4 + off, v * 3.4 - off, 5) * 0.5 + 0.5;
      const dx = (u - 0.5) * 2.1, dy = (v - 0.5) * 2.6;
      const mask = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      let a = Math.max(0, n * 1.35 - 0.42) * mask * mask * 2.4;
      a = Math.min(1, a);
      const i = (y * size + x) * 4;
      const shade = 236 + n * 19;
      img.data[i] = shade;
      img.data[i + 1] = shade;
      img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A mountain range silhouette: an open cylinder with its top cut by noise. */
function makeRidgeMesh(radius, height, baseY, colorTop, colorBottom, seed, segments = 220) {
  const pos = [];
  const col = [];
  const rng = makeRng(seed);
  const phase = rng() * 100;

  const top = new THREE.Color(colorTop);
  const bot = new THREE.Color(colorBottom);

  const heightAt = (i) => {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * 3.1 + phase, z = Math.sin(a) * 3.1 + phase;
    const ridge = ridged2(x, z, 4);
    const big = fbm2(x * 0.55, z * 0.55, 3) * 0.5 + 0.5;
    return baseY + height * (0.28 + ridge * 0.55 + big * 0.5);
  };

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const x0 = Math.cos(a0) * radius, z0 = Math.sin(a0) * radius;
    const x1 = Math.cos(a1) * radius, z1 = Math.sin(a1) * radius;
    const y0 = heightAt(i), y1 = heightAt(i + 1);
    const yb = baseY - height * 1.5;

    pos.push(x0, yb, z0, x1, yb, z1, x1, y1, z1);
    pos.push(x0, yb, z0, x1, y1, z1, x0, y0, z0);

    const push = (c) => col.push(c.r, c.g, c.b);
    push(bot); push(bot); push(top);
    push(bot); push(top); push(top);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));

  // Has to be OPAQUE: a transparent material joins the blending phase, which
  // runs after all the opaques — with depthTest off it would cover the player
  // and the entire terrain.
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, fog: false, side: THREE.DoubleSide,
    depthWrite: false, depthTest: false, toneMapped: true,
  });
  // the colours were chosen in display space: lift to HDR so they reach tone
  // mapping with the same brightness as the sky
  mat.color.setScalar(SKY_PARAMS.ridgeGain);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

function configureSky(sky, sunDirection) {
  const u = sky.material.uniforms;
  u.turbidity.value = SKY_PARAMS.turbidity;
  u.rayleigh.value = SKY_PARAMS.rayleigh;
  u.mieCoefficient.value = SKY_PARAMS.mieCoefficient;
  u.mieDirectionalG.value = SKY_PARAMS.mieDirectionalG;
  u.sunPosition.value.copy(sunDirection);
  applyIntensityPatch(sky.material, SKY_PARAMS.intensity);
  return sky;
}

/**
 * Builds the environment map from the sky itself — it is what gives the snow
 * the blue of the surroundings and objects a specular coherent with the air.
 */
export function buildSkyEnvironment(renderer, sunDirection) {
  const envScene = new THREE.Scene();

  const sky = configureSky(new Sky(), sunDirection);
  sky.scale.setScalar(1000);
  envScene.add(sky);

  // a white lower hemisphere: snow bounces a lot of light upwards, and without
  // this the underside of objects goes black
  const bounce = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
    new THREE.MeshBasicMaterial({ color: 0xdae9f7, side: THREE.BackSide, fog: false })
  );
  envScene.add(bounce);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(envScene, 0.03);

  sky.geometry.dispose(); sky.material.dispose();
  bounce.geometry.dispose(); bounce.material.dispose();
  pmrem.dispose();
  return target.texture;
}

export function createSky(scene, sunDirection) {
  const group = new THREE.Group();
  group.renderOrder = -100;
  scene.add(group);

  // ------------------------------------------------------- atmosfera
  const sky = configureSky(new Sky(), sunDirection);
  sky.scale.setScalar(SKY_RADIUS);
  sky.material.depthTest = false;
  sky.material.depthWrite = false;
  sky.material.fog = false;
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  group.add(sky);

  // ------------------------------------------------------- cordilheiras
  // Three layers: the further away, the more washed by aerial perspective.
  const far = makeRidgeMesh(1750, 300, -80, 0xf6fbff, 0xd8e9f8, 11, 180);
  const mid = makeRidgeMesh(1320, 250, -110, 0xeef6ff, 0xb9d4ec, 23, 200);
  const near = makeRidgeMesh(940, 180, -130, 0xe6f2ff, 0x9abcdb, 41, 220);
  far.renderOrder = -60; mid.renderOrder = -59; near.renderOrder = -58;
  group.add(far, mid, near);

  // ------------------------------------------------------------ nuvens
  const clouds = new THREE.Group();
  clouds.renderOrder = -50;
  group.add(clouds);

  const cloudTextures = [makeCloudTexture(128, 3), makeCloudTexture(128, 9), makeCloudTexture(128, 17)];
  const rng = makeRng(99);
  const cloudData = [];

  for (let i = 0; i < 26; i++) {
    const tex = cloudTextures[i % cloudTextures.length];
    // clouds have alpha, so they really are transparent — but they keep the
    // depth test on so the terrain stays in front of them
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, depthTest: true,
      fog: false, opacity: 0.4 + rng() * 0.36,
      side: THREE.DoubleSide,
    });
    const w = 260 + rng() * 420;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * (0.32 + rng() * 0.2)), mat);

    const ang = rng() * Math.PI * 2;
    const rad = 500 + rng() * 900;
    mesh.position.set(Math.cos(ang) * rad, 170 + rng() * 280, Math.sin(ang) * rad);
    mesh.frustumCulled = false;
    clouds.add(mesh);
    cloudData.push({ mesh, drift: 3 + rng() * 6 });
  }

  const tmp = new THREE.Vector3();

  return {
    group,
    sky,
    /** Keeps the scenery centred on the camera and moves the clouds along. */
    update(camera, dt) {
      camera.getWorldPosition(tmp);
      group.position.set(tmp.x, 0, tmp.z);

      for (const c of cloudData) {
        c.mesh.position.x += c.drift * dt;
        if (c.mesh.position.x > 1500) c.mesh.position.x = -1500;
        // billboard on the Y axis only: in the group's space the camera is at the origin
        c.mesh.rotation.y = Math.atan2(-c.mesh.position.x, -c.mesh.position.z);
      }
    },
    setSunDirection(dir) { sky.material.uniforms.sunPosition.value.copy(dir); },
    dispose() {
      cloudTextures.forEach((t) => t.dispose());
      group.traverse((o) => {
        if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
      });
      scene.remove(group);
    },
  };
}
