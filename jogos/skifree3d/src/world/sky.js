// Céu com espalhamento atmosférico (Preetham), cordilheira distante e nuvens.
// O mesmo céu alimenta o environment map, então a luz ambiente da cena vem
// fisicamente do ar e do sol, não de uma cor chutada.

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { fbm2, ridged2, makeRng } from '../lib/noise.js';

// A cúpula precisa caber dentro de camera.far: o clip do far plane corta
// geometria mesmo com frustumCulled desligado.
const SKY_RADIUS = 2000;

export const SKY_PARAMS = {
  turbidity: 1.8,          // ar limpo de alta montanha
  rayleigh: 1.0,           // valores altos lavam o azul depois do tone map
  mieCoefficient: 0.005,   // brilho ao redor do sol
  mieDirectionalG: 0.78,
  intensity: 0.30,         // escala HDR do céu (medida, não chutada)
  ridgeGain: 1.5,          // compensa o tone mapping nas cordilheiras
};

/**
 * O Sky do three devolve radiância numa escala própria, alta demais para o
 * ACES: sem esta escala o azul vira branco. Também expõe o disco solar num
 * valor bem acima de 1, que é o que alimenta os god rays.
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

/** Textura de nuvem macia gerada por ruído (sem arquivos externos). */
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

/** Silhueta de cordilheira: cilindro aberto com o topo recortado por ruído. */
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

  // Precisa ser OPACO: material transparente entra na fase de blending, que
  // roda depois de todos os opacos — com depthTest desligado ele cobriria o
  // jogador e o terreno inteiro.
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, fog: false, side: THREE.DoubleSide,
    depthWrite: false, depthTest: false, toneMapped: true,
  });
  // as cores foram escolhidas em espaço de exibição: sobe para HDR para
  // chegarem ao tone mapping com o mesmo brilho do céu
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
 * Gera o environment map a partir do próprio céu — é ele que dá à neve o
 * azul do ambiente e aos objetos um specular coerente com a atmosfera.
 */
export function buildSkyEnvironment(renderer, sunDirection) {
  const envScene = new THREE.Scene();

  const sky = configureSky(new Sky(), sunDirection);
  sky.scale.setScalar(1000);
  envScene.add(sky);

  // hemisfério inferior branco: a neve devolve muita luz para cima, e sem
  // isso a parte de baixo dos objetos fica preta
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
  // Três camadas: quanto mais longe, mais lavada pela perspectiva aérea.
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
    // nuvens têm alpha, então são transparentes de verdade — mas mantêm o
    // depth test ligado para o terreno continuar na frente delas
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
    /** Mantém o cenário centrado na câmera e faz as nuvens andarem. */
    update(camera, dt) {
      camera.getWorldPosition(tmp);
      group.position.set(tmp.x, 0, tmp.z);

      for (const c of cloudData) {
        c.mesh.position.x += c.drift * dt;
        if (c.mesh.position.x > 1500) c.mesh.position.x = -1500;
        // billboard só no eixo Y: no espaço do grupo a câmera está na origem
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
