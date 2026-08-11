// Scene assembly and the main loop.

import * as THREE from 'three';
import { createSave } from 'slopkit/save';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { CSM } from 'three/addons/csm/CSM.js';

import {
  SLOPE, VIEW_FAR, FOG_DENSITY, COLORS, MODES, PLAYER, YETI,
  groundHeight, clamp, lerp, damp,
} from './config.js';
import { createSky, buildSkyEnvironment } from './world/sky.js';
import { createTerrain } from './world/terrain.js';
import { createSnowMaterial, createFoliageMaterial } from './world/snowMaterial.js';
import { createProps } from './world/props.js';
import { createLift } from './world/lift.js';
import { createPlayer } from './entities/player.js';
import { characterMaterial } from './entities/skierModel.js';
import { createNpcs } from './entities/npcs.js';
import { createYeti } from './entities/yeti.js';
import { createSpray } from './fx/particles.js';
import { createSnowfall } from './fx/snowfall.js';
import { createTrail } from './fx/trail.js';
import { initInput, onCommand, releaseAll } from './input.js';
import { initAudio, resumeAudio, updateAudio, sfx, toggleMute, silence } from './audio.js';
import { GodRaysShader, LensShader, updateSunScreenPosition } from './render/postfx.js';
import { installAerialPerspective } from './render/atmosphere.js';
import * as hud from './hud.js';
import { t } from './i18n.js';

// A low sun (12°) and ahead of whoever is descending: it is the only position
// fits in the frame — the camera looks downhill, so any high sun ends up off
// screen and leaves nothing for bloom or god rays.
// It also throws grazing light, long shadows and rim light on the crystals.
const SUN_DIR = new THREE.Vector3(-0.470, 0.342, 0.814).normalize();
const CAMERA_MODES = ['chase', 'retro', 'close'];
// The best scores go through slopkit: they get normalisation (a record saved
// with the wrong type doesn't turn into NaN on screen) and the same key and
const cofre = createSave({
  game: 'skifree3d',
  version: 1,
  key: 'skifree3d.best.v1',
  initial: () => ({ version: 1 }),
  normalize: (bruto, base) => {
    if (!bruto || typeof bruto !== 'object') return base;
    const s = { ...base };
    // only a finite number gets in: the rest is noise from a hand-edited save
    for (const [k, v] of Object.entries(bruto)) {
      if (k === 'version' || k === 'updatedAt') continue;
      if (Number.isFinite(v)) s[k] = v;
    }
    return s;
  },
});

export function createGame(container) {
  // Has to happen before any material is created: it touches the global
  // global ShaderChunks three uses to assemble its shaders.
  installAerialPerspective({
    sunDirection: SUN_DIR,
    sunColor: 0xffd9a0,
    skyColor: 0xa8ccec,
    strength: 0.92,
  });

  // ------------------------------------------------------------ renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: false,          // MSAA comes from the composer's render target
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Neutral (Khronos PBR Neutral) preserves the chroma of the highlights; ACES
  // washed the sky's blue to white at this exposure range.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(COLORS.fog, FOG_DENSITY);

  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.5, VIEW_FAR);
  camera.position.set(0, 6, -10);

  // ambient light coming from the sky itself
  scene.environment = buildSkyEnvironment(renderer, SUN_DIR);
  scene.environmentIntensity = 0.5;

  // the group carrying the world: it slides to keep the player at the origin
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // ---------------------------------------------------------------- luz
  // Cascaded shadows: crisp next to the skier and still there at 200 m, which
  // a single shadow map of this range cannot deliver.
  const csm = new CSM({
    camera,
    parent: scene,
    cascades: 4,
    maxFar: 190,
    mode: 'practical',
    shadowMapSize: 2048,
    shadowBias: -0.0008,
    lightDirection: SUN_DIR.clone().negate().normalize(),
    lightIntensity: 4.4,
    lightMargin: 120,
    lightFar: 900,
  });
  csm.fade = true;
  for (const light of csm.lights) {
    light.color.set(COLORS.sun);
    light.shadow.normalBias = 0.22;
  }

  const hemi = new THREE.HemisphereLight(0xb6d8f5, 0xf2f8ff, 0.42);
  scene.add(hemi);

  // a cool fill light, from the side opposite the sun
  const fill = new THREE.DirectionalLight(0x9ec9ee, 0.55);
  fill.position.set(0.5, 0.55, -0.8);
  scene.add(fill);

  /**
   * CSM.setupMaterial replaces onBeforeCompile — compose with the material's
   * own hook instead of losing it.
   */
  function enableCSM(material) {
    const own = material.onBeforeCompile;
    const hasOwn = own && own !== THREE.Material.prototype.onBeforeCompile;
    csm.setupMaterial(material);
    if (hasOwn) {
      const fromCSM = material.onBeforeCompile;
      material.onBeforeCompile = function (shader, r) {
        fromCSM.call(this, shader, r);
        own.call(this, shader, r);
      };
    }
  }

  // ------------------------------------------------------------- mundos
  const sky = createSky(scene, SUN_DIR);
  sky.group.userData.noAO = true;   // infinite scenery casts no occlusion

  const snowMat = createSnowMaterial(SUN_DIR);
  const terrain = createTerrain(worldGroup, snowMat);

  const propMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.78, metalness: 0.0,
  });
  const foliageMat = createFoliageMaterial();

  for (const m of [snowMat, propMat, foliageMat, characterMaterial]) enableCSM(m);

  let modeCfg = MODES.free;
  const props = createProps(worldGroup, propMat, modeCfg, foliageMat);
  const lift = createLift(worldGroup, propMat);
  const player = createPlayer(worldGroup);
  const npcs = createNpcs(worldGroup, props);
  const yeti = createYeti(worldGroup);

  const spray = createSpray(worldGroup, 1000);
  const trail = createTrail(worldGroup);
  const snowfall = createSnowfall(scene, { count: 2400 });

  // ------------------------------------------------------ post-processing
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
    type: THREE.HalfFloatType,
    samples: 4,                 // MSAA: essential for the cables and thin branches
    colorSpace: THREE.LinearSRGBColorSpace,
  });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));

  // ambient occlusion: it is what gives volume to the tracks, the trunks and
  // the folds of the terrain, which without it look "stuck on" the snow
  const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({
    radius: 0.55,
    distanceExponent: 1.2,
    thickness: 1.0,
    scale: 1.1,
    samples: 16,
    distanceFallOff: 1.0,
    screenSpaceRadius: false,
  });
  // GTAO's gbuffer only ignores Points and Lines. Without this filter,
  // transparent decals (the ski trail, the clouds) come in as a solid wall and
  // draw a dark band of occlusion behind the player.
  gtao.overrideVisibility = function () {
    const cache = this._visibilityCache;
    this.scene.traverse((object) => {
      cache.set(object, object.visible);
      if (object.isPoints || object.isLine) {
        object.visible = false;
      } else if (object.userData.noAO) {
        object.visible = false;
      } else if (object.material && object.material.transparent && object.material.depthWrite === false) {
        object.visible = false;
      }
    });
  };
  composer.addPass(gtao);

  // sun rays coming through the treetops
  const godRays = new ShaderPass(GodRaysShader);
  composer.addPass(godRays);

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    0.35,    // strength
    0.78,    // raio
    0.85     // limiar: medido — abaixo disso a neve inteira floresce
  );
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  // lens: radial blur with speed, aberration, vignette, grain and grading
  const lens = new ShaderPass(LensShader);
  lens.uniforms.uResolution.value.set(innerWidth, innerHeight);
  composer.addPass(lens);

  // ------------------------------------------------------------- estado
  const state = {
    phase: 'menu',         // menu | playing | dying | over
    paused: false,
    mode: 'free',
    time: 0,
    elapsed: 0,
    score: 0,
    style: 1,
    styleDistance: 0,
    gatesHit: 0, gatesTotal: 0, gatesMissed: 0,
    cameraMode: 0,
    shake: 0,
    dyingTimer: 0,
    warnTimer: 0,
    prevZ: 0,
  };

  const best = loadBest();

  // arrays reused per frame (zero allocation in the loop)
  const propColliders = [];
  const ramps = [];
  const gates = [];
  const allColliders = [];

  const camPos = new THREE.Vector3(0, 8, -12);
  const camLook = new THREE.Vector3();
  const desiredPos = new THREE.Vector3();
  const desiredLook = new THREE.Vector3();
  const playerScene = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let smoothHeading = 0;
  let fov = 58;

  // ------------------------------------------------------------ helpers
  function loadBest() {
    return cofre.load();
  }
  function saveBest() {
    cofre.save(best);
  }

  /** Position of a world point in scene space. */
  function toScene(x, y, z, out) {
    return out.set(x + worldGroup.position.x, y + worldGroup.position.y, z + worldGroup.position.z);
  }

  function syncWorldOrigin() {
    // keeps the player at z = 0 and near y = 0 in the scene
    worldGroup.position.set(0, SLOPE * player.state.z, -player.state.z);
  }

  // --------------------------------------------------------------- start
  function start(modeName) {
    state.mode = modeName in MODES ? modeName : 'free';
    modeCfg = MODES[state.mode];

    state.phase = 'playing';
    state.paused = false;
    state.time = 0;
    state.score = 0;
    state.style = 1;
    state.styleDistance = 0;
    state.gatesHit = state.gatesTotal = state.gatesMissed = 0;
    state.shake = 0;
    state.dyingTimer = 0;
    state.warnTimer = 0;

    player.reset(0);
    player.root.visible = true;
    state.prevZ = player.state.z;

    props.reset(modeCfg);
    props.update(0);
    lift.reset();
    lift.setVisible(modeCfg.lift);
    npcs.reset(modeCfg.npcDensity);
    yeti.reset();
    spray.reset();
    trail.reset();
    terrain.reset();

    syncWorldOrigin();
    terrain.prime(player.state.x, player.state.z);

    // put the camera already behind the player (without sweeping the mountain)
    player.root.getWorldPosition(playerScene);
    smoothHeading = 0;
    camPos.set(playerScene.x, playerScene.y + 3.4 + SLOPE * 7, playerScene.z - 7);
    camLook.copy(playerScene);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    hud.clearToasts();
    hud.showOverlay(null);
    hud.showHud(true);
    hud.setGates({ visible: modeCfg.gates, hit: 0, total: 0, missed: 0 });
    hud.setYeti({ active: false, distance: 0, danger: 0 });
    hud.warnYeti(false);
    hud.setPaused(false);

    resumeAudio();
    sfx.start();
  }

  function backToMenu() {
    state.phase = 'menu';
    hud.showHud(false);
    hud.warnYeti(false);
    hud.showOverlay('menu');
    silence();
    releaseAll();
  }

  function gameOver(reason) {
    state.phase = 'over';
    silence();
    sfx.gameOver();

    const prev = best[state.mode] ?? 0;
    const isNew = state.score > prev;
    if (isNew) { best[state.mode] = state.score; saveBest(); }

    hud.showHud(false);
    hud.warnYeti(false);
    hud.showGameOver({
      dist: player.state.travel,
      score: state.score,
      speed: player.state.maxSpeed * 3.6,
      time: state.time,
      gates: state.gatesHit,
      gatesTotal: state.gatesTotal,
      showGates: modeCfg.gates,
      best: { isNew, value: Math.max(prev, state.score), previous: prev },
      reason,
    });
  }

  // ------------------------------------------------------------- eventos
  function handlePlayerEvents(events) {
    for (const e of events) {
      switch (e.type) {
        case 'takeoff':
          if (e.source === 'hop' || e.power > 3.2) sfx.jump();
          spray.burst(e.x, groundHeight(e.x, e.z), e.z, 0.7, 14);
          break;

        case 'land': {
          sfx.land(clamp(e.airTime, 0.3, 1.4));
          spray.burst(e.x, e.y, e.z, 0.9, 22);
          if (e.score > 0) {
            const pts = Math.round(e.score * state.style);
            state.score += pts;
            const names = trickNames(e.trick);
            if (names.length || e.airTime > 0.8) {
              hud.toast(names.length ? names.join(' + ') : t('trick.air'), pts);
              sfx.trick(names.length);
            }
            state.style = Math.min(5, state.style + 0.2);
          }
          break;
        }

        case 'crash': {
          sfx.crash();
          spray.burst(e.x, e.y, e.z, 1.35, 46);
          state.shake = 1;
          state.style = 1;
          state.styleDistance = 0;
          hud.toast(crashLabel(e.reason), 0, '#ff8f85');
          break;
        }

        case 'hit':
          if (e.collider.type === 'skier' || e.collider.type === 'boarder' || e.collider.type === 'dog') {
            npcs.knockDown(e.collider.ref);
            if (e.collider.type === 'dog') sfx.bark();
          }
          break;
      }
    }
  }

  /** The reason for the crash is an id; the phrase comes from the dictionary. */
  const CRASHES = ['tree', 'rock', 'stump', 'tower', 'chalet', 'sign', 'skier', 'boarder', 'dog', 'landing'];
  function crashLabel(reason) {
    return t(CRASHES.includes(reason) ? `crash.${reason}` : 'crash.other');
  }

  /** Turns the landing's numbers into the words on screen. */
  function trickNames({ spins, flips, longAir } = {}) {
    const names = [];
    if (spins > 0) names.push(t('trick.spin', { degrees: spins * 360 }));
    if (flips > 0) names.push(flips > 1 ? t('trick.flips', { n: flips }) : t('trick.flip'));
    if (longAir) names.push(t('trick.longAir'));
    return names;
  }

  // --------------------------------------------------------------- gates
  function updateGates(prevZ, z) {
    if (!modeCfg.gates) return;
    props.gatesNear(z, gates);
    for (const g of gates) {
      if (g.passed) continue;
      if (prevZ < g.z && z >= g.z) {
        g.passed = true;
        state.gatesTotal++;
        const dx = Math.abs(player.state.x - g.x);
        if (dx <= g.halfW + 0.6) {
          state.gatesHit++;
          const pts = Math.round(150 * state.style);
          state.score += pts;
          state.style = Math.min(5, state.style + 0.15);
          hud.toast(t('gate.hit'), pts, '#9ff0c8');
          sfx.gate();
        } else {
          state.gatesMissed++;
          state.score = Math.max(0, state.score - 120);
          state.style = 1;
          hud.toast(t('gate.missed'), 0, '#ff8f85');
          sfx.miss();
        }
      }
    }
    hud.setGates({
      visible: true, hit: state.gatesHit,
      total: state.gatesTotal, missed: state.gatesMissed,
    });
  }

  // -------------------------------------------------------------- camera
  function updateCamera(dt) {
    player.root.getWorldPosition(playerScene);
    const p = player.state;
    const speedN = clamp(p.speed / PLAYER.maxSpeed, 0, 1);
    smoothHeading = damp(smoothHeading, p.heading, 3.4, dt);

    const hx = Math.sin(smoothHeading), hz = Math.cos(smoothHeading);
    const mode = CAMERA_MODES[state.cameraMode];

    if (state.phase === 'dying' && yeti.state.mode === 'eating') {
      // during the Yeti's hug the camera circles the two of them
      toScene(yeti.state.x, yeti.state.y, yeti.state.z, tmp);
      const a = state.dyingTimer * 1.1 + 2.4;
      const r = lerp(9, 5.5, clamp(state.dyingTimer / 1.6, 0, 1));
      desiredPos.set(tmp.x + Math.sin(a) * r, tmp.y + 3.4, tmp.z + Math.cos(a) * r);
      desiredLook.set(tmp.x, tmp.y + 2.0, tmp.z);
      camPos.lerp(desiredPos, 1 - Math.exp(-5 * dt));
      camLook.lerp(desiredLook, 1 - Math.exp(-6 * dt));
    } else if (mode === 'retro') {
      // a nod to the original's top-down view
      const dist = 20 + speedN * 6;
      const height = 24 + speedN * 5;
      desiredPos.set(playerScene.x, playerScene.y + height, playerScene.z - dist);
      desiredLook.set(playerScene.x, playerScene.y - 6, playerScene.z + 16);
      camPos.lerp(desiredPos, 1 - Math.exp(-4.5 * dt));
      camLook.lerp(desiredLook, 1 - Math.exp(-5.5 * dt));
    } else {
      const close = mode === 'close';
      const dist = (close ? 4.0 : 5.4) + speedN * (close ? 1.2 : 2.3);
      const height = (close ? 1.7 : 2.2) + speedN * 0.65;
      const look = close ? 7 : 12;

      desiredPos.set(
        playerScene.x - hx * dist,
        playerScene.y + height + SLOPE * dist,
        playerScene.z - hz * dist
      );
      desiredLook.set(
        playerScene.x + hx * look * 0.55,
        playerScene.y + 1.25 - SLOPE * look,
        playerScene.z + hz * look
      );
      // in the air the camera opens up a bit to fit the jump
      if (p.airborne) desiredPos.y += clamp(p.y - groundHeight(p.x, p.z), 0, 8) * 0.55;

      camPos.lerp(desiredPos, 1 - Math.exp(-(close ? 9 : 6.5) * dt));
      camLook.lerp(desiredLook, 1 - Math.exp(-8 * dt));
    }

    // a shudder on impact
    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt * 2.2);
      const k = state.shake * state.shake * 0.85;
      camera.position.set(
        camPos.x + (Math.random() - 0.5) * k,
        camPos.y + (Math.random() - 0.5) * k,
        camPos.z + (Math.random() - 0.5) * k
      );
    } else {
      camera.position.copy(camPos);
    }
    camera.lookAt(camLook);

    // the field of view pulls with speed
    const targetFov = state.cameraMode === 1 ? 46 : 57 + speedN * 15 + (p.airborne ? 3 : 0);
    fov = damp(fov, targetFov, 4, dt);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  // The cascades follow the camera frustum; it is enough to update after
  // moving the frame's camera.
  function updateShadows() {
    csm.update();
  }

  // ------------------------------------------------------------- efeitos
  function emitSkiSpray(dt) {
    const p = player.state;
    if (p.airborne || p.crashed > 0 || p.speed < 3) return;
    const carve = Math.abs(Math.sin(p.heading));
    const rate = (0.35 + carve * 1.5) * (p.speed / PLAYER.maxSpeed);
    const amount = Math.floor(rate * 110 * dt) + (Math.random() < rate ? 1 : 0);
    if (amount <= 0) return;
    const dirX = Math.sin(p.heading), dirZ = Math.cos(p.heading);
    // emits behind both skis
    for (const side of [-0.22, 0.22]) {
      spray.emitSpray(
        p.x + dirZ * side, p.y + 0.05, p.z - dirX * side,
        dirX, dirZ, p.speed, Math.max(1, amount >> 1)
      );
    }
  }

  // -------------------------------------------------- qualidade adaptativa
  // GTAO costs ~35% of the frame. Instead of pinning a preset, it measures the first
  // real seconds and turns off whatever is most expensive if the sum doesn't close.
  const perf = { frames: 0, accum: 0, level: 2, settled: false, grace: 1.5 };

  function setQualityLevel(level) {
    if (level === perf.level) return;
    perf.level = level;
    gtao.enabled = level >= 2;
    bloom.enabled = level >= 1;
    godRays.enabled = level >= 1;
    if (level === 0) {
      renderer.setPixelRatio(1);
      composer.setPixelRatio?.(1);
      snowfall.setVisible(false);
    }
  }

  function trackPerformance(dt) {
    if (perf.settled) return;
    if (perf.grace > 0) { perf.grace -= dt; return; }
    perf.frames++;
    perf.accum += dt;
    if (perf.accum < 2.5) return;
    const fps = perf.frames / perf.accum;
    perf.frames = 0; perf.accum = 0;
    if (fps < 24) setQualityLevel(0);
    else if (fps < 38) setQualityLevel(1);
    else { perf.settled = true; return; }
    if (perf.level === 0) perf.settled = true;
  }

  // ------------------------------------------------------------- loop
  const clock = new THREE.Clock();
  let rafId = 0;

  function frame() {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 1 / 20);
    state.elapsed += dt;

    snowMat.userData.uniforms.uTime.value = state.elapsed;
    foliageMat.userData.uniforms.uTime.value = state.elapsed;
    lens.uniforms.uTime.value = state.elapsed;

    // sun rays and speed blur follow the camera and the player
    updateSunScreenPosition(SUN_DIR, camera, godRays.uniforms);
    const speedNorm = state.phase === 'playing'
      ? clamp((player.state.speed - 12) / (PLAYER.maxSpeed - 12), 0, 1)
      : 0;
    lens.uniforms.uSpeed.value = damp(lens.uniforms.uSpeed.value, speedNorm, 4, dt);

    if (state.phase === 'menu') {
      // the camera drifts slowly over the mountain on the menu
      menuIdle(dt);
    } else if (!state.paused) {
      step(dt);
    }

    if (state.phase === 'menu') updateShadows();
    sky.update(camera, dt);
    snowfall.update(camera, state.elapsed);
    composer.render();
  }

  let menuAngle = 0;
  function menuIdle(dt) {
    // a slow flyover of the mountain behind the menu
    menuAngle += dt * 0.075;
    const z = 160 + menuAngle * 26;
    const x = Math.sin(menuAngle * 0.9) * 60;
    player.state.z = z;
    player.state.x = x;
    player.root.visible = false;
    syncWorldOrigin();

    props.update(z);
    terrain.update(x, z, 2);
    lift.update(z, dt);

    // the world point (x, ground, z) shows up in the scene at z = 0
    const sceneY = groundHeight(x, z) + SLOPE * z;
    camPos.set(x + Math.sin(menuAngle * 0.7) * 22, sceneY + 13, -34);
    camLook.set(x * 0.5, sceneY - 9, 34);
    camera.position.lerp(camPos, 1 - Math.exp(-1.6 * dt));
    camera.lookAt(camLook);
    if (Math.abs(camera.fov - 54) > 0.05) {
      camera.fov = damp(camera.fov, 54, 2, dt);
      camera.updateProjectionMatrix();
    }
  }

  function step(dt) {
    const p = player.state;
    state.time += dt;

    // ------------------------------------------------ the world around
    props.update(p.z);
    terrain.update(p.x, p.z, 2);
    const liftColliders = modeCfg.lift ? lift.update(p.z, dt) : [];

    // ------------------------------------------------------- colisores
    props.collidersNear(p.z, propColliders);
    props.rampsNear(p.z, ramps);
    allColliders.length = 0;
    for (let i = 0; i < propColliders.length; i++) allColliders.push(propColliders[i]);
    for (let i = 0; i < liftColliders.length; i++) allColliders.push(liftColliders[i]);
    for (let i = 0; i < npcs.colliders.length; i++) allColliders.push(npcs.colliders[i]);

    // --------------------------------------------------------- jogador
    state.prevZ = p.z;
    if (state.phase === 'playing') {
      const events = player.update(dt, { ramps, colliders: allColliders });
      handlePlayerEvents(events);
    } else if (state.phase === 'dying') {
      state.dyingTimer += dt;
      player.root.visible = state.dyingTimer < 0.35;
      if (state.dyingTimer > 2.0) { gameOver('yeti'); return; }
    }

    syncWorldOrigin();

    // ----------------------------------------------------------- score
    if (state.phase === 'playing') {
      const dz = Math.max(0, p.z - state.prevZ);
      state.score += dz * state.style;
      state.styleDistance += dz;
      if (p.crashed <= 0 && state.styleDistance > 120) {
        state.styleDistance = 0;
        state.style = Math.min(5, state.style + 0.1);
      }
      updateGates(state.prevZ, p.z);
    }

    // ------------------------------------------------------------- IA
    npcs.update(dt, p.z, p);

    const yetiEvent = yeti.update(dt, {
      x: p.x, z: p.z, travel: p.travel, speed: p.speed, crashed: p.crashed,
    }, modeCfg.yetiWake);

    if (yeti.consumeWake()) {
      hud.warnYeti(true);
      state.warnTimer = 3.2;
      sfx.roar();
    } else if (yeti.consumeRoar()) {
      sfx.roar();
    }
    if (state.warnTimer > 0) {
      state.warnTimer -= dt;
      if (state.warnTimer <= 0) hud.warnYeti(false);
    }

    if (yetiEvent === 'caught' && state.phase === 'playing') {
      state.phase = 'dying';
      state.dyingTimer = 0;
      state.shake = 1.2;
      sfx.chomp();
      spray.burst(p.x, groundHeight(p.x, p.z), p.z, 1.6, 55);
      silence();
    }

    // the Yeti's footsteps kicking up snow
    if (yeti.state.visible && yeti.state.mode === 'chasing' && Math.random() < dt * 14) {
      spray.burst(
        yeti.state.x + (Math.random() - 0.5) * 1.2,
        yeti.state.y,
        yeti.state.z + (Math.random() - 0.5) * 1.2,
        0.55, 5
      );
    }

    // --------------------------------------------------------- efeitos
    emitSkiSpray(dt);
    spray.update(dt);
    trail.push(p.x, p.z, p.heading, p.crashed <= 0 && !p.airborne && state.phase === 'playing');

    updateShadows();
    updateCamera(dt);

    // ------------------------------------------------------------- HUD
    hud.setStats({
      dist: p.travel, time: state.time, score: state.score, style: state.style,
    });
    hud.setSpeed(p.speed * 3.6);

    const yetiActive = yeti.state.mode === 'chasing' || yeti.state.mode === 'eating';
    hud.setYeti({
      active: yetiActive,
      distance: yeti.state.distance,
      danger: yetiActive ? clamp(1 - (yeti.state.distance - YETI.catchRadius) / 70, 0, 1) : 0,
    });

    trackPerformance(dt);

    updateAudio(dt, {
      speed: p.speed,
      maxSpeed: PLAYER.maxSpeed,
      carve: Math.sin(p.heading),
      airborne: p.airborne,
      crashed: p.crashed > 0,
    });
  }

  // ------------------------------------------------------------ comandos
  function togglePause() {
    if (state.phase !== 'playing' && state.phase !== 'dying') return;
    state.paused = !state.paused;
    hud.setPaused(state.paused);
    if (state.paused) { silence(); releaseAll(); }
  }

  function cycleCamera() {
    state.cameraMode = (state.cameraMode + 1) % CAMERA_MODES.length;
    hud.toast(t('camera.changed', { mode: t(`camera.${CAMERA_MODES[state.cameraMode]}`) }), 0, '#cfe8ff');
  }

  function onResize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    gtao.setSize(w, h);
    lens.uniforms.uResolution.value.set(w, h);
    csm.updateFrustums();
  }

  // ---------------------------------------------------------------- init
  function init() {
    initInput();
    onCommand('KeyP', togglePause);
    onCommand('Escape', () => {
      if (state.phase === 'playing' || state.phase === 'dying') togglePause();
    });
    onCommand('KeyC', () => { if (state.phase !== 'menu') cycleCamera(); });
    onCommand('KeyM', () => {
      const m = toggleMute();
      hud.toast(t(m ? 'sound.off' : 'sound.on'), 0, '#cfe8ff');
    });
    onCommand('KeyR', () => {
      if (state.phase === 'playing' || state.phase === 'dying' || state.phase === 'over') start(state.mode);
    });

    addEventListener('resize', onResize);

    // audio can only start after a user gesture
    const unlock = () => {
      if (initAudio()) resumeAudio();
      removeEventListener('pointerdown', unlock);
      removeEventListener('keydown', unlock);
    };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);

    // first assembly of the mountain
    player.state.z = 120;
    syncWorldOrigin();
    props.update(120);
    terrain.prime(0, 120);
    lift.update(120, 0.016);

    // warm up the shaders before the first visible frame
    renderer.compile(scene, camera);
    composer.render();

    clock.start();
    frame();
  }

  return {
    init, start, backToMenu, togglePause, cycleCamera,
    state, renderer, scene, camera,
    // exposed for poking at in the console
    player, yeti, npcs, props, lift, worldGroup, spray, csm, composer,
    bloom, godRays, lens, gtao, hemi, fill, snowMat, propMat, foliageMat, sky, perf, setQualityLevel,
    dispose() {
      cancelAnimationFrame(rafId);
      removeEventListener('resize', onResize);
      terrain.dispose(); props.dispose(); lift.dispose();
      npcs.dispose(); yeti.dispose(); spray.dispose();
      trail.dispose(); snowfall.dispose(); sky.dispose();
      csm.dispose(); composer.dispose(); renderer.dispose();
    },
  };
}
