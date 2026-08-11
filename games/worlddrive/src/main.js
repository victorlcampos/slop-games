// WorldDrive — dirija em qualquer rua do mundo
// Three.js + OpenStreetMap (Overpass) + AWS Terrain Tiles + Esri World Imagery
import * as THREE from 'three';
import { createSave } from 'slopkit/save';
import { loadWorld } from './world.js';
import { Car } from './car.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Minimap } from './minimap.js';
import { MapPicker } from './picker.js';
import { UI } from './ui.js';
import { clamp, lerp } from './geo.js';

const app = {
  state: 'menu',       // menu | loading | driving
  world: null,
  camMode: 0,
  quality: 2,          // 2 pleno, 1 sem pixel-ratio, 0 sem sombras
  label: null,
};
window.WD = app; // para smoke test / debug

// ---------- three ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
document.getElementById('gl').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SKY_H = new THREE.Color(0xd5e8f5);
scene.background = SKY_H.clone();
scene.fog = new THREE.Fog(SKY_H.clone(), 420, 980);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 3000);

const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x8a7f6c, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dd, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -280; sun.shadow.camera.right = 280;
sun.shadow.camera.top = 280; sun.shadow.camera.bottom = -280;
sun.shadow.camera.near = 50; sun.shadow.camera.far = 900;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 1.2;
scene.add(sun, sun.target);

// céu com gradiente + sol
const skyGeo = new THREE.SphereGeometry(1900, 24, 12);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: { sunDir: { value: new THREE.Vector3(0.45, 0.55, -0.4).normalize() } },
  vertexShader: 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `varying vec3 vW; uniform vec3 sunDir;
    void main(){
      float t = clamp(vW.y * 1.6 + 0.18, 0.0, 1.0);
      vec3 col = mix(vec3(0.84,0.91,0.96), vec3(0.32,0.55,0.86), t);
      float s = smoothstep(0.9985, 0.9995, dot(vW, normalize(sunDir)));
      float glow = pow(max(dot(vW, normalize(sunDir)), 0.0), 24.0) * 0.22;
      col += vec3(1.0,0.95,0.8) * (s * 1.6 + glow);
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// ---------- módulos ----------
const ui = new UI();
const input = new Input();
const audio = new GameAudio();
const car = new Car();
const minimap = new Minimap(document.getElementById('minimap'));
const picker = new MapPicker(document.getElementById('map'));
const isTouch = matchMedia('(pointer: coarse)').matches;
input.bindTouch(document.getElementById('touch'));

// Preferências pelo slopkit: coordenada inválida no save (arquivo editado,
// versão antiga) não pode mandar o jogador para o meio do oceano.
const cofre = createSave({
  game: 'worlddrive',
  version: 1,
  chave: 'worlddrive:prefs',
  initial: () => ({ version: 1, lat: null, lon: null, zoom: 16, label: null, mudo: false }),
  normalize: (bruto, base) => {
    if (!bruto || typeof bruto !== 'object') return base;
    const s = { ...base, ...bruto };
    const valido = Number.isFinite(s.lat) && Number.isFinite(s.lon) &&
      Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180;
    if (!valido) { s.lat = null; s.lon = null; }
    s.zoom = Number.isFinite(s.zoom) ? Math.min(Math.max(3, s.zoom), 19) : 16;
    s.mudo = !!s.mudo;
    return s;
  },
});
const prefs = cofre.load();
if (prefs.lat !== null) picker.setCenter(prefs.lat, prefs.lon, prefs.zoom);
audio.setMuted(prefs.mudo);

ui.bind({ picker, onDrive: (lat, lon, label) => startDrive(lat, lon, label) });

// ---------- fluxo ----------
async function startDrive(lat, lon, label) {
  if (app.state === 'loading') return;
  app.state = 'loading';
  app.label = label;
  audio.start();
  ui.showLoading(label);
  try {
    const w = await loadWorld(lat, lon, (st, f, note) => ui.setProgress(st, f, note));
    if (app.world) { scene.remove(app.world.group); app.world.dispose(); }
    app.world = w;
    scene.add(w.group);
    minimap.setWorld(w.minimapLines, w.half);
    car.place(w.spawn.x, w.spawn.z, w.spawn.heading, w);
    if (!car.group.parent) scene.add(car.group);
    snapCamera();
    app.state = 'driving';
    ui.showHUD(isTouch);
    ui.toast(w.spawn.name ? `Você está em ${w.spawn.name}` : 'Boa viagem!');
    Object.assign(prefs, { lat, lon, zoom: 16, label: label || null });
    cofre.save(prefs);
  } catch (err) {
    console.error(err);
    app.state = 'loading';
    ui.showLoadError(err && err.message || 'Erro inesperado ao carregar os dados.', () => {
      app.state = 'menu';
      startDrive(lat, lon, label);
    });
  }
}

function backToMenu() {
  if (app.state !== 'driving') return;
  app.state = 'menu';
  ui.showMenu();
}

// atalhos
input.on('reset', () => {
  if (app.state !== 'driving' || !app.world) return;
  const n = app.world.roadIndex.nearest(car.x, car.z, 600);
  if (n) { car.place(n.x, n.z, n.heading, app.world); snapCamera(); ui.toast('De volta à rua ' + (n.name ? `(${n.name})` : '')); }
});
input.on('camera', () => {
  app.camMode = (app.camMode + 1) % 3;
  ui.toast(['Câmera: perseguição', 'Câmera: próxima', 'Câmera: aérea'][app.camMode]);
});
input.on('reload', () => {
  if (app.state !== 'driving' || !app.world) return;
  const [lat, lon] = app.world.proj.toLatLon(car.x, car.z);
  startDrive(lat, lon, 'este ponto');
});
input.on('mute', () => {
  audio.setMuted(!audio.muted);
  prefs.mudo = audio.muted;
  cofre.save(prefs);
  ui.toast(audio.muted ? 'Som desligado' : 'Som ligado');
});
input.on('help', () => ui.toggleHelp());
input.on('menu', () => backToMenu());

document.getElementById('b-map').addEventListener('click', backToMenu);
document.getElementById('b-cam').addEventListener('click', () => input.handlers.camera());
document.getElementById('b-snd').addEventListener('click', () => input.handlers.mute());
document.getElementById('b-help').addEventListener('click', () => ui.toggleHelp());
document.getElementById('b-reload').addEventListener('click', () => input.handlers.reload());
document.getElementById('help').addEventListener('click', () => ui.toggleHelp(false));

car.onCrash = i => audio.crash(i);

// ---------- câmera ----------
const camPos = new THREE.Vector3(0, 30, 30);
const camLook = new THREE.Vector3();
function snapCamera() {
  const f = car.forward;
  camPos.set(car.x - f.x * 8, car.y + 4, car.z - f.z * 8);
  camera.position.copy(camPos);
  camera.lookAt(car.x, car.y + 1.5, car.z);
}
function updateCamera(dt) {
  const f = car.forward;
  const w = app.world;
  let target, look;
  if (app.camMode === 2) {
    target = new THREE.Vector3(car.x, car.y + 110, car.z + 0.01);
    look = new THREE.Vector3(car.x, car.y, car.z);
  } else {
    const dist = app.camMode === 1 ? 5.6 : 8.2;
    const h = app.camMode === 1 ? 2.1 : 3.4;
    const back = 1 + clamp(Math.abs(car.vF) / 46, 0, 1) * 0.25;
    target = new THREE.Vector3(car.x - f.x * dist * back, car.y + h, car.z - f.z * dist * back);
    if (w) target.y = Math.max(target.y, w.heightAt(target.x, target.z) + 1.6);
    look = new THREE.Vector3(car.x + f.x * 3, car.y + 1.4, car.z + f.z * 3);
  }
  const k = 1 - Math.exp(-(app.camMode === 2 ? 3 : 5.5) * dt);
  camPos.lerp(target, k);
  camLook.lerp(look, k);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// ---------- loop ----------
let streetTimer = 0;
let fpsEMA = 60, lowFpsTime = 0;
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (app.state === 'driving' && app.world) {
    const inp = input.read();
    car.update(dt, inp, app.world);
    updateCamera(dt);

    // sol/sombras seguem o carro (snap para evitar cintilação)
    const sx = Math.round(car.x / 10) * 10, sz = Math.round(car.z / 10) * 10;
    sun.position.set(sx + 210, 300, sz - 170);
    sun.target.position.set(sx, 0, sz);
    sky.position.set(car.x, 0, car.z);

    ui.setSpeed(car.speedKmh);
    minimap.draw(car.x, car.z, car.heading);
    audio.update(car.speedKmh, inp.throttle, car.drifting || inp.handbrake && Math.abs(car.vF) > 4);

    streetTimer -= dt;
    if (streetTimer <= 0) {
      streetTimer = 0.4;
      const n = app.world.roadIndex.nearest(car.x, car.z, 25, false)
        || app.world.roadIndex.nearest(car.x, car.z, 90, false, true);
      const named = n && n.name ? n : app.world.roadIndex.nearest(car.x, car.z, 90, false, true);
      ui.setStreet(named && named.name, app.label);
      const edge = Math.max(Math.abs(car.x), Math.abs(car.z));
      ui.setEdgeWarning(edge > app.world.half - 90);
    }

    // qualidade automática
    const fps = 1 / Math.max(dt, 1e-3);
    fpsEMA = fpsEMA * 0.95 + fps * 0.05;
    if (fpsEMA < 27) lowFpsTime += dt; else lowFpsTime = 0;
    if (lowFpsTime > 4 && app.quality > 0) {
      lowFpsTime = 0;
      app.quality--;
      if (app.quality === 1) renderer.setPixelRatio(1);
      if (app.quality === 0) { renderer.shadowMap.enabled = false; sun.castShadow = false; }
      ui.toast('Qualidade reduzida para manter a fluidez');
    }
  }

  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

ui.showMenu();
