// The skier's articulated model — used by the player and the NPCs.
// Every piece uses vertex colours and one shared material, so several can be
// on screen without a material swap.

import * as THREE from 'three';
import { paint, paintBy } from '../world/geometries.js';
import { COLORS, clamp, lerp } from '../config.js';

export const characterMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.62,
  metalness: 0.04,
});

// Proportions of a ~1.75 m body: leg 0.72 · torso 0.50 · head 0.26
const THIGH = 0.36;
const SHIN = 0.36;
const ANKLE_Y = 0.13;
const LEG_FULL = THIGH + SHIN;
const SHOULDER_Y = 0.47;   // relative to the torso pivot
const NECK_Y = 0.62;

function mesh(geo, color) {
  paint(geo, color);
  const m = new THREE.Mesh(geo, characterMaterial);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

/**
 * @param {object} opts colours and variation
 * @returns {{group:THREE.Group, parts:object, pose:Function}}
 */
export function createSkier(opts = {}) {
  const {
    jacket = COLORS.jacket,
    pants = COLORS.pants,
    hat = COLORS.hat,
    skin = COLORS.skin,
    ski = COLORS.ski,
    snowboard = false,
    scale = 1,
  } = opts;

  const group = new THREE.Group();

  // ------------------------------------------------------------- corpo
  const body = new THREE.Group();          // leans while carving
  group.add(body);

  // --------------------------------------------------------- pranchas
  const skis = new THREE.Group();
  body.add(skis);

  const makeSki = (x) => {
    const g = new THREE.BoxGeometry(0.115, 0.045, 1.68);
    // ponta levantada
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      if (z > 0.6) p.setY(i, p.getY(i) + (z - 0.6) * 0.55);
    }
    g.computeVertexNormals();
    paintBy(g, (px, py, pz, ny, out) => {
      out.set(ski);
      if (pz > 0.45) out.lerp(new THREE.Color(0xffffff), 0.55);
      if (ny < -0.3) out.set(0x222831);
    });
    const m = new THREE.Mesh(g, characterMaterial);
    m.castShadow = true;
    m.position.set(x, 0.045, 0.10);
    return m;
  };

  let skiL, skiR, board;
  if (snowboard) {
    const g = new THREE.BoxGeometry(0.34, 0.05, 1.5);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      if (Math.abs(z) > 0.55) p.setY(i, p.getY(i) + (Math.abs(z) - 0.55) * 0.5);
    }
    g.computeVertexNormals();
    paintBy(g, (px, py, pz, ny, out) => {
      out.set(0x18a3c9);
      if (Math.abs(pz) > 0.5) out.set(0xffcf3f);
      if (ny < -0.3) out.set(0x141a22);
    });
    board = new THREE.Mesh(g, characterMaterial);
    board.castShadow = true;
    board.position.set(0, 0.05, 0);
    skis.add(board);
  } else {
    skiL = makeSki(-0.16);
    skiR = makeSki(0.16);
    skis.add(skiL, skiR);
  }

  // --------------------------------------------------------- quadril
  const hips = new THREE.Group();
  hips.position.y = ANKLE_Y + LEG_FULL;
  body.add(hips);

  // ----------------------------------------------------------- pernas
  function makeLeg(side) {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.155, 0, 0);
    hips.add(thigh);

    const thighMesh = mesh(new THREE.CapsuleGeometry(0.098, THIGH - 0.16, 4, 8), pants);
    thighMesh.position.y = -THIGH / 2;
    thigh.add(thighMesh);

    const knee = new THREE.Group();
    knee.position.y = -THIGH;
    thigh.add(knee);

    const shinMesh = mesh(new THREE.CapsuleGeometry(0.085, SHIN - 0.19, 4, 8), pants);
    shinMesh.position.y = -SHIN / 2;
    knee.add(shinMesh);

    // bota
    const bootGeo = new THREE.BoxGeometry(0.155, 0.19, 0.30);
    const boot = mesh(bootGeo, 0x1c2129);
    boot.position.set(0, -SHIN + 0.02, 0.03);
    knee.add(boot);

    return { thigh, knee, boot };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // ----------------------------------------------------------- tronco
  const torso = new THREE.Group();
  torso.position.y = 0.02;
  hips.add(torso);

  const chest = mesh(new THREE.CapsuleGeometry(0.165, 0.30, 5, 10), jacket);
  chest.position.y = 0.27;
  chest.scale.set(1.08, 1, 0.80);
  torso.add(chest);

  // a reflective stripe on the jacket, just to break up the flat colour
  const stripe = mesh(new THREE.CylinderGeometry(0.174, 0.174, 0.07, 12, 1, true), 0xffd54a);
  stripe.position.y = 0.27;
  stripe.scale.set(1.08, 1, 0.80);
  torso.add(stripe);

  // -------------------------------------------------------------- arms
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.185, SHOULDER_Y, 0);
    torso.add(shoulder);

    const upper = mesh(new THREE.CapsuleGeometry(0.062, 0.18, 4, 8), jacket);
    upper.position.y = -0.145;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.28;
    shoulder.add(elbow);

    const fore = mesh(new THREE.CapsuleGeometry(0.053, 0.16, 4, 8), jacket);
    fore.position.y = -0.13;
    elbow.add(fore);

    const glove = mesh(new THREE.SphereGeometry(0.065, 8, 6), 0x1c2129);
    glove.position.y = -0.25;
    elbow.add(glove);

    // the pole is held in the hand — the pose re-orients it to point back and down
    const pole = new THREE.Group();
    pole.position.y = -0.25;
    elbow.add(pole);

    const shaft = mesh(new THREE.CylinderGeometry(0.013, 0.010, 1.05, 5), 0xdfe4e9);
    shaft.position.y = -0.40;
    shaft.castShadow = false;
    pole.add(shaft);

    const basket = mesh(new THREE.TorusGeometry(0.062, 0.016, 4, 8), 0x2b3038);
    basket.rotation.x = Math.PI / 2;
    basket.position.y = -0.80;
    basket.castShadow = false;
    pole.add(basket);

    return { shoulder, elbow, pole };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // -------------------------------------------------------------- head
  const neck = new THREE.Group();
  neck.position.y = NECK_Y;
  torso.add(neck);

  const collar = mesh(new THREE.CylinderGeometry(0.072, 0.085, 0.09, 8), jacket);
  collar.position.y = -0.035;
  neck.add(collar);

  const head = mesh(new THREE.SphereGeometry(0.128, 12, 10), skin);
  head.position.y = 0.105;
  head.scale.set(1, 1.06, 0.95);
  neck.add(head);

  // gorro
  const beanie = mesh(new THREE.SphereGeometry(0.141, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.60), hat);
  beanie.position.y = 0.128;
  neck.add(beanie);

  const brim = mesh(new THREE.TorusGeometry(0.131, 0.030, 6, 14), hat);
  brim.rotation.x = Math.PI / 2;
  brim.position.y = 0.128;
  neck.add(brim);

  const pompom = mesh(new THREE.SphereGeometry(0.052, 8, 6), 0xffffff);
  pompom.position.y = 0.272;
  neck.add(pompom);

  // snow goggles
  const goggles = mesh(new THREE.BoxGeometry(0.215, 0.072, 0.05), 0x171c24);
  goggles.position.set(0, 0.115, 0.098);
  neck.add(goggles);
  const lens = mesh(new THREE.BoxGeometry(0.178, 0.048, 0.028), 0x2ba8d8);
  lens.position.set(0, 0.115, 0.122);
  neck.add(lens);

  // cachecol
  const scarf = mesh(new THREE.TorusGeometry(0.082, 0.030, 6, 12), 0xff6b3d);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = -0.005;
  neck.add(scarf);

  group.scale.setScalar(scale);

  const parts = {
    body, skis, hips, torso, neck, head, legL, legR, armL, armR,
    skiL, skiR, board, pompom,
  };

  // --------------------------------------------------------------- pose
  const state = { crouch: 0, lean: 0, pitch: 0, armSwing: 0 };

  /**
   * @param {object} p
   * @param {number} p.crouch 0 standing .. 1 tucked
   * @param {number} p.lean sideways lean (rad)
   * @param {number} p.pitch fore/aft lean (rad)
   * @param {number} p.t time (for the sway)
   * @param {number} p.speed velocidade normalizada 0..1
   * @param {boolean} p.airborne
   * @param {number} p.crashed 0..1
   */
  function pose(p) {
    const crouch = clamp(p.crouch ?? 0, 0, 1);
    const lean = p.lean ?? 0;
    const pitch = p.pitch ?? 0;
    const t = p.t ?? 0;
    const spd = clamp(p.speed ?? 0, 0, 1);
    const crashed = p.crashed ?? 0;

    state.crouch = crouch;

    // legs: effective length controls the hip height
    const hipLen = lerp(LEG_FULL, LEG_FULL * 0.56, crouch);
    const half = clamp(hipLen / (2 * THIGH), -1, 1);
    const theta = Math.acos(half);

    hips.position.y = ANKLE_Y + hipLen;
    for (const leg of [legL, legR]) {
      leg.thigh.rotation.x = -theta;
      leg.knee.rotation.x = theta * 2;
    }
    // legs slightly apart when tucked
    legL.thigh.rotation.z = crouch * 0.13;
    legR.thigh.rotation.z = -crouch * 0.13;

    // torso: folds forward in a tuck, more aerodynamic
    torso.rotation.x = lerp(0.10, 0.72, crouch) + pitch;
    torso.rotation.z = lean * 0.35;

    // the head looks forward even with the torso folded
    neck.rotation.x = -torso.rotation.x * 0.72;

    // the body leans while carving
    body.rotation.z = lean;

    // arms: out for balance, tucked in closer when crouched
    const bob = Math.sin(t * 7) * 0.06 * spd * (1 - crouch);
    const openness = lerp(0.38, 0.15, crouch);
    armL.shoulder.rotation.z = openness + lean * 0.5;
    armR.shoulder.rotation.z = -openness + lean * 0.5;
    armL.shoulder.rotation.x = -0.42 - crouch * 0.62 + bob;
    armR.shoulder.rotation.x = -0.42 - crouch * 0.62 - bob;
    armL.elbow.rotation.x = 0.80 + crouch * 0.30;
    armR.elbow.rotation.x = 0.80 + crouch * 0.30;

    if (p.airborne) {
      armL.shoulder.rotation.z = 1.15;
      armR.shoulder.rotation.z = -1.15;
      armL.shoulder.rotation.x = -0.9;
      armR.shoulder.rotation.x = -0.9;
      armL.elbow.rotation.x = 0.5;
      armR.elbow.rotation.x = 0.5;
    }

    // poles point back and down, regardless of the arm:
    // cancels the accumulated rotation of shoulder + elbow + torso
    const poleTilt = 0.55;
    armL.pole.rotation.x = poleTilt - (armL.shoulder.rotation.x + armL.elbow.rotation.x) - torso.rotation.x;
    armR.pole.rotation.x = poleTilt - (armR.shoulder.rotation.x + armR.elbow.rotation.x) - torso.rotation.x;
    armL.pole.rotation.z = -armL.shoulder.rotation.z;
    armR.pole.rotation.z = -armR.shoulder.rotation.z;

    // the skis follow the carve direction
    if (skis.children.length) {
      skis.rotation.y = -lean * 0.28;
      if (skiL && skiR) {
        skiL.rotation.z = lean * 0.5;
        skiR.rotation.z = lean * 0.5;
      }
    }

    // a crash: fold everything and throw the body sideways
    if (crashed > 0) {
      const c = clamp(crashed, 0, 1);
      body.rotation.z = lerp(body.rotation.z, 1.42, c);
      body.rotation.x = lerp(0, -0.85, c);
      torso.rotation.x = lerp(torso.rotation.x, 1.15, c);
      armL.shoulder.rotation.z = lerp(armL.shoulder.rotation.z, 2.0, c);
      armR.shoulder.rotation.z = lerp(armR.shoulder.rotation.z, -2.2, c);
      hips.position.y = lerp(hips.position.y, 0.42, c);
      if (skiL) skiL.rotation.z = lerp(skiL.rotation.z, 0.9, c);
      if (skiR) skiR.rotation.z = lerp(skiR.rotation.z, -1.3, c);
    } else {
      body.rotation.x = pitch * 0.3;
    }
  }

  pose({ crouch: 0.25 });

  return { group, parts, pose, state };
}

/** Colour variations for the NPCs. */
export const SKIER_PALETTES = [
  { jacket: 0xe8412f, pants: 0x1f2a44, hat: 0xffd23f, ski: 0x30d0e0 },
  { jacket: 0x1fa85c, pants: 0x2b2f3a, hat: 0xff7a3d, ski: 0xffffff },
  { jacket: 0xf0f3f7, pants: 0x8b3fd6, hat: 0x2a5bd7, ski: 0xff4d4d },
  { jacket: 0xff8c1a, pants: 0x14324f, hat: 0xffffff, ski: 0x39d6ff },
  { jacket: 0x2a5bd7, pants: 0xd8dde5, hat: 0xe8412f, ski: 0xffd23f },
  { jacket: 0x111820, pants: 0x39414d, hat: 0x00e0a4, ski: 0xff2d95 },
];
