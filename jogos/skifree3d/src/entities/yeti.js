// O Abominável Homem das Neves. Acorda depois de 2 000 m, persegue sem
// cansar, e é o único jeito de a corrida acabar de verdade.

import * as THREE from 'three';
import { paint, paintBy } from '../world/geometries.js';
import { characterMaterial } from './skierModel.js';
import { perlin2 } from '../lib/noise.js';
import { YETI, groundHeight, clamp, lerp, damp } from '../config.js';

const FUR_LIGHT = new THREE.Color(0xf3f7fb);
const FUR_SHADE = new THREE.Color(0xa9b8c9);

/** Deforma uma geometria para dar aspecto de pelo emaranhado. */
function furrify(geo, amount = 0.09, freq = 5.0) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = perlin2(v.x * freq + v.y * 2.1, v.z * freq - v.y * 1.7);
    v.multiplyScalar(1 + n * amount);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  paintBy(geo, (x, y, z, ny, out) => {
    const n = perlin2(x * 6 + 3, z * 6 - 2) * 0.5 + 0.5;
    out.copy(FUR_SHADE).lerp(FUR_LIGHT, 0.45 + n * 0.55 + ny * 0.15);
  });
  return geo;
}

function part(geo, color) {
  if (color !== undefined) paint(geo, color);
  const m = new THREE.Mesh(geo, characterMaterial);
  m.castShadow = true;
  return m;
}

function buildYetiModel() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  // ------------------------------------------------------------ tronco
  const torsoGeo = new THREE.SphereGeometry(0.92, 18, 14);
  torsoGeo.scale(1.0, 1.12, 0.84);
  furrify(torsoGeo, 0.10, 4.0);
  const torso = new THREE.Mesh(torsoGeo, characterMaterial);
  torso.castShadow = true;
  torso.position.y = 1.45;
  body.add(torso);

  // barriga mais clara
  const bellyGeo = new THREE.SphereGeometry(0.70, 14, 10);
  bellyGeo.scale(1, 1.02, 0.6);
  paint(bellyGeo, 0xe6edf5);
  const belly = new THREE.Mesh(bellyGeo, characterMaterial);
  belly.position.set(0, 1.32, 0.44);
  body.add(belly);

  // pescoço curto e grosso ligando tronco e cabeça
  const neckGeo = new THREE.CylinderGeometry(0.40, 0.55, 0.42, 10);
  furrify(neckGeo, 0.08, 7.0);
  const neck = new THREE.Mesh(neckGeo, characterMaterial);
  neck.position.set(0, 2.52, 0.04);
  body.add(neck);

  // ------------------------------------------------------------ cabeça
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 2.86, 0.06);
  body.add(headPivot);

  const headGeo = new THREE.SphereGeometry(0.60, 18, 14);
  headGeo.scale(1.04, 0.96, 1.0);
  furrify(headGeo, 0.07, 6.0);
  const head = new THREE.Mesh(headGeo, characterMaterial);
  head.castShadow = true;
  headPivot.add(head);

  // sobrancelha pesada — é o que dá a cara de bravo do sprite original
  const brow = part(new THREE.BoxGeometry(0.92, 0.15, 0.26), 0x7e91a6);
  brow.position.set(0, 0.20, 0.44);
  brow.rotation.x = -0.22;
  headPivot.add(brow);

  // olhos vermelhos brilhantes, encaixados sob a sobrancelha
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xff2a1a, emissive: 0xff2a1a, emissiveIntensity: 3.4, roughness: 0.4,
  });
  const eyeGeo = new THREE.SphereGeometry(0.082, 10, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.22, 0.055, 0.50);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.22, 0.055, 0.50);
  headPivot.add(eyeL, eyeR);

  // focinho e boca
  const muzzle = part(new THREE.BoxGeometry(0.62, 0.26, 0.30), 0xdce7f2);
  muzzle.position.set(0, -0.16, 0.46);
  headPivot.add(muzzle);

  const nose = part(new THREE.SphereGeometry(0.09, 8, 6), 0x2b3038);
  nose.position.set(0, -0.06, 0.62);
  headPivot.add(nose);

  // gengiva superior fica na cabeça; a inferior desce com a mandíbula
  const upperGum = part(new THREE.BoxGeometry(0.60, 0.10, 0.26), 0x7d2b2b);
  upperGum.position.set(0, -0.28, 0.46);
  headPivot.add(upperGum);

  const toothGeo = new THREE.ConeGeometry(0.05, 0.17, 4);
  for (let i = 0; i < 5; i++) {
    const x = -0.20 + i * 0.10;
    const up = part(toothGeo.clone(), 0xfff3cf);
    up.position.set(x, -0.36, 0.50);
    up.rotation.x = Math.PI;
    headPivot.add(up);
  }

  // presas maiores nos cantos
  for (const sx of [-1, 1]) {
    const fang = part(new THREE.ConeGeometry(0.07, 0.28, 5), 0xfffaf0);
    fang.position.set(sx * 0.26, -0.34, 0.48);
    fang.rotation.x = Math.PI;
    headPivot.add(fang);
  }

  // mandíbula que abre
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.30, 0.18);
  headPivot.add(jaw);

  const mouth = part(new THREE.BoxGeometry(0.56, 0.22, 0.34), 0x2b0d0d);
  mouth.position.set(0, -0.06, 0.26);
  jaw.add(mouth);

  const lowerLip = part(new THREE.BoxGeometry(0.62, 0.14, 0.36), 0xc9d6e4);
  lowerLip.position.set(0, -0.16, 0.26);
  jaw.add(lowerLip);

  for (let i = 0; i < 5; i++) {
    const dn = part(toothGeo.clone(), 0xfff3cf);
    dn.position.set(-0.20 + i * 0.10, -0.05, 0.32);
    jaw.add(dn);
  }
  toothGeo.dispose();

  // chifres/orelhas peludas
  for (const sx of [-1, 1]) {
    const horn = part(new THREE.ConeGeometry(0.13, 0.42, 6), 0xb9c6d4);
    horn.position.set(sx * 0.44, 0.42, -0.08);
    horn.rotation.z = sx * 0.42;
    headPivot.add(horn);
  }

  // ------------------------------------------------------------ braços
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.92, 2.05, 0);
    body.add(shoulder);

    const upGeo = new THREE.CapsuleGeometry(0.25, 0.62, 5, 10);
    furrify(upGeo, 0.10, 6);
    const upper = new THREE.Mesh(upGeo, characterMaterial);
    upper.castShadow = true;
    upper.position.y = -0.44;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.86;
    shoulder.add(elbow);

    const foreGeo = new THREE.CapsuleGeometry(0.22, 0.60, 5, 10);
    furrify(foreGeo, 0.10, 6);
    const fore = new THREE.Mesh(foreGeo, characterMaterial);
    fore.castShadow = true;
    fore.position.y = -0.42;
    elbow.add(fore);

    // mão com garras
    const hand = part(new THREE.SphereGeometry(0.28, 10, 8), 0xdfe8f2);
    hand.position.y = -0.82;
    elbow.add(hand);

    for (let i = 0; i < 4; i++) {
      const claw = part(new THREE.ConeGeometry(0.042, 0.22, 4), 0x2b3038);
      const a = -0.42 + i * 0.28;
      claw.position.set(Math.sin(a) * 0.17, -0.97, Math.cos(a) * 0.15 + 0.05);
      claw.rotation.set(Math.PI * 0.88, 0, 0);
      elbow.add(claw);
    }
    return { shoulder, elbow };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // ------------------------------------------------------------ pernas
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.42, 0.92, 0);
    body.add(hip);

    const thighGeo = new THREE.CapsuleGeometry(0.30, 0.36, 5, 10);
    furrify(thighGeo, 0.09, 6);
    const thigh = new THREE.Mesh(thighGeo, characterMaterial);
    thigh.castShadow = true;
    thigh.position.y = -0.32;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.60;
    hip.add(knee);

    const shinGeo = new THREE.CapsuleGeometry(0.25, 0.28, 5, 10);
    furrify(shinGeo, 0.09, 6);
    const shin = new THREE.Mesh(shinGeo, characterMaterial);
    shin.castShadow = true;
    shin.position.y = -0.26;
    knee.add(shin);

    const foot = part(new THREE.BoxGeometry(0.42, 0.20, 0.70), 0xd7e2ee);
    foot.position.set(0, -0.52, 0.16);
    knee.add(foot);

    for (let i = 0; i < 3; i++) {
      const claw = part(new THREE.ConeGeometry(0.05, 0.18, 4), 0x2b3038);
      claw.position.set(-0.13 + i * 0.13, -0.55, 0.48);
      claw.rotation.x = Math.PI / 2;
      knee.add(claw);
    }
    return { hip, knee };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  group.scale.setScalar(1.15);

  return { group, body, headPivot, jaw, armL, armR, legL, legR, eyeMat, torso };
}

// =============================================================== lógica
export function createYeti(parent) {
  const model = buildYetiModel();
  model.group.visible = false;
  parent.add(model.group);

  const state = {
    mode: 'sleeping',      // sleeping | chasing | retreating | eating | done
    x: 0, z: 0, y: 0,
    speed: YETI.baseSpeed,
    chaseTime: 0,
    timer: 0,
    heading: 0,
    anim: 0,
    aggression: 0,         // sobe a cada retorno
    eatTime: 0,
    visible: false,
    distance: Infinity,
    roarPending: false,
    justWoke: false,
  };

  function spawn(player, aggressive = false) {
    state.mode = 'chasing';
    state.x = player.x + (Math.random() - 0.5) * 22;
    state.z = player.z - YETI.spawnGap;
    state.speed = YETI.baseSpeed + state.aggression * 4.5;
    state.chaseTime = 0;
    state.visible = true;
    state.roarPending = true;
    state.justWoke = true;
    model.group.visible = true;
  }

  function reset() {
    state.mode = 'sleeping';
    state.aggression = 0;
    state.speed = YETI.baseSpeed;
    state.chaseTime = 0;
    state.timer = 0;
    state.eatTime = 0;
    state.visible = false;
    state.distance = Infinity;
    model.group.visible = false;
    model.group.scale.setScalar(1.15);
  }

  /**
   * @param {number} dt
   * @param {object} player  {x, z, travel, speed, crashed}
   * @param {number} wakeDistance
   * @returns {'none'|'caught'} evento do quadro
   */
  function update(dt, player, wakeDistance) {
    state.anim += dt;
    let event = 'none';

    if (state.mode === 'sleeping') {
      if (player.travel >= wakeDistance) spawn(player);
      state.distance = Infinity;
      return event;
    }

    if (state.mode === 'retreating') {
      state.timer -= dt;
      // afunda na neve enquanto se afasta
      state.z -= 12 * dt;
      const k = clamp(state.timer / 1.2, 0, 1);
      model.group.scale.setScalar(1.15 * k);
      if (state.timer <= 0) {
        model.group.visible = false;
        state.visible = false;
        state.mode = 'waiting';
        state.timer = YETI.returnDelay;
      }
      state.distance = Infinity;
      return event;
    }

    if (state.mode === 'waiting') {
      state.timer -= dt;
      if (state.timer <= 0) {
        state.aggression += 1;
        model.group.scale.setScalar(1.15);
        spawn(player, true);
      }
      state.distance = Infinity;
      return event;
    }

    if (state.mode === 'eating') {
      state.eatTime += dt;
      state.x = damp(state.x, player.x, 9, dt);
      state.z = damp(state.z, player.z - 0.9, 9, dt);
      poseEating(dt);
      placeModel();
      if (state.eatTime > 1.6) state.mode = 'done';
      return event;
    }

    if (state.mode === 'done') { placeModel(); return event; }

    // ------------------------------------------------------- perseguição
    state.chaseTime += dt;
    const target = YETI.baseSpeed + state.aggression * 4.5 + state.chaseTime * YETI.rampUp;
    state.speed = Math.min(YETI.maxSpeed, target);

    // um empurrãozinho quando o jogador está muito longe (mantém a tensão)
    const dx = player.x - state.x;
    const dz = player.z - state.z;
    const dist = Math.hypot(dx, dz);
    state.distance = dist;

    let speed = state.speed;
    if (dist > 55) speed *= 1.20;
    if (player.crashed > 0) speed *= 1.12;

    const dirX = dist > 0.001 ? dx / dist : 0;
    const dirZ = dist > 0.001 ? dz / dist : 1;
    state.x += dirX * speed * dt;
    state.z += dirZ * speed * dt;
    state.heading = Math.atan2(dirX, dirZ);

    if (dist < YETI.catchRadius && player.crashed >= 0) {
      state.mode = 'eating';
      state.eatTime = 0;
      event = 'caught';
    } else if (dist > YETI.giveUpGap) {
      state.mode = 'retreating';
      state.timer = 1.2;
    }

    poseRunning(dt, speed);
    placeModel();
    return event;
  }

  function placeModel() {
    const gy = groundHeight(state.x, state.z);
    state.y = gy;
    model.group.position.set(state.x, gy, state.z);
    model.group.rotation.y = state.heading;
  }

  function poseRunning(dt, speed) {
    const cadence = state.anim * (5.5 + speed * 0.16);
    const s = Math.sin(cadence), c = Math.cos(cadence);

    model.legL.hip.rotation.x = s * 0.85;
    model.legR.hip.rotation.x = -s * 0.85;
    model.legL.knee.rotation.x = Math.max(0, -s) * 1.15;
    model.legR.knee.rotation.x = Math.max(0, s) * 1.15;

    model.armL.shoulder.rotation.x = -s * 0.75 - 0.35;
    model.armR.shoulder.rotation.x = s * 0.75 - 0.35;
    model.armL.shoulder.rotation.z = 0.30 + Math.abs(c) * 0.12;
    model.armR.shoulder.rotation.z = -0.30 - Math.abs(c) * 0.12;
    model.armL.elbow.rotation.x = 0.55 + Math.abs(s) * 0.35;
    model.armR.elbow.rotation.x = 0.55 + Math.abs(c) * 0.35;

    model.body.position.y = Math.abs(s) * 0.16;
    model.body.rotation.x = 0.16 + Math.abs(c) * 0.05;
    model.body.rotation.z = c * 0.06;

    model.headPivot.rotation.x = -0.18 + s * 0.05;
    model.jaw.rotation.x = 0.18 + (Math.sin(state.anim * 3.2) * 0.5 + 0.5) * 0.32;
    model.eyeMat.emissiveIntensity = 2.8 + Math.sin(state.anim * 9) * 0.9;
  }

  function poseEating(dt) {
    const t = clamp(state.eatTime / 0.55, 0, 1);
    model.armL.shoulder.rotation.x = lerp(-0.35, -2.5, t);
    model.armR.shoulder.rotation.x = lerp(-0.35, -2.5, t);
    model.armL.shoulder.rotation.z = lerp(0.3, 0.9, t);
    model.armR.shoulder.rotation.z = lerp(-0.3, -0.9, t);
    model.armL.elbow.rotation.x = lerp(0.55, 0.1, t);
    model.armR.elbow.rotation.x = lerp(0.55, 0.1, t);
    model.jaw.rotation.x = 0.25 + Math.abs(Math.sin(state.eatTime * 14)) * 0.75;
    model.headPivot.rotation.x = lerp(-0.18, 0.25, t);
    model.body.rotation.x = lerp(0.16, -0.15, t);
    model.body.position.y = 0;
    model.legL.hip.rotation.x = lerp(model.legL.hip.rotation.x, 0.1, t);
    model.legR.hip.rotation.x = lerp(model.legR.hip.rotation.x, -0.1, t);
    model.eyeMat.emissiveIntensity = 4.5;
  }

  function consumeRoar() {
    const r = state.roarPending;
    state.roarPending = false;
    return r;
  }

  function consumeWake() {
    const w = state.justWoke;
    state.justWoke = false;
    return w;
  }

  return {
    state, model, update, reset, spawn, consumeRoar, consumeWake,
    get position() { return { x: state.x, y: state.y, z: state.z }; },
    dispose() {
      parent.remove(model.group);
      model.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      model.eyeMat.dispose();
    },
  };
}
