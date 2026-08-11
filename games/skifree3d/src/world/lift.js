// Teleférico: torres, cabo e cadeiras subindo a montanha.
// As torres derrubam quem bate — como no jogo original.

import * as THREE from 'three';
import { makeLiftTowerGeometry, makeChairGeometry } from './geometries.js';
import { createSkier, SKIER_PALETTES } from '../entities/skierModel.js';
import { groundHeight, lerp } from '../config.js';

const LIFT_X = -118;          // linha do teleférico
const SPACING = 58;           // distância entre torres
const TOWER_H = 15;
const CABLE_OFFSET = 2.9;     // separação entre cabo de subida e de descida
const AHEAD = 620;
const BEHIND = 140;
const CHAIR_COUNT = 16;
const CHAIR_SPEED = 4.6;

export function createLift(parent, material) {
  const group = new THREE.Group();
  parent.add(group);

  const towerGeo = makeLiftTowerGeometry(TOWER_H);
  const chairGeo = makeChairGeometry();

  const towers = new Map();     // índice -> mesh
  const towerPool = [];
  const cablePool = [];
  const dummy = new THREE.Object3D();

  // ------------------------------------------------------------- cabos
  const cableGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 5);
  cableGeo.rotateX(Math.PI / 2);       // eixo ao longo de +Z
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.6, metalness: 0.5 });

  function getTower() {
    let m = towerPool.pop();
    if (!m) {
      m = new THREE.Mesh(towerGeo, material);
      m.castShadow = true;
      m.receiveShadow = false;
      group.add(m);
    }
    m.visible = true;
    return m;
  }

  function getCable() {
    let m = cablePool.pop();
    if (!m) {
      m = new THREE.Mesh(cableGeo, cableMat);
      m.castShadow = false;
      group.add(m);
    }
    m.visible = true;
    return m;
  }

  const towerTopY = (idx) => groundHeight(LIFT_X, idx * SPACING) + TOWER_H + 0.2;

  /** Altura do cabo em z (interpolação entre torres + leve barriga). */
  function cableY(z) {
    const i = Math.floor(z / SPACING);
    const t = z / SPACING - i;
    const y0 = towerTopY(i);
    const y1 = towerTopY(i + 1);
    const sag = Math.sin(t * Math.PI) * 0.9;
    return lerp(y0, y1, t) - sag;
  }

  // ---------------------------------------------------------- cadeiras
  const chairs = [];
  for (let i = 0; i < CHAIR_COUNT; i++) {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(chairGeo, material);
    mesh.castShadow = true;
    mesh.position.y = -2.6;
    g.add(mesh);

    // metade das cadeiras leva passageiros
    let rider = null;
    if (i % 3 !== 2) {
      const pal = SKIER_PALETTES[i % SKIER_PALETTES.length];
      rider = createSkier({ ...pal, scale: 0.92 });
      rider.group.position.set(0, -3.5, 0.12);
      rider.pose({ crouch: 0.95, lean: 0, t: 0, speed: 0 });
      // pernas penduradas: reaproveita a pose agachada girando o quadril
      rider.parts.legL.thigh.rotation.x = -1.45;
      rider.parts.legR.thigh.rotation.x = -1.45;
      rider.parts.legL.knee.rotation.x = 0.55;
      rider.parts.legR.knee.rotation.x = 0.55;
      rider.parts.torso.rotation.x = 0.06;
      g.add(rider.group);
    }
    g.visible = false;
    group.add(g);
    chairs.push({ group: g, rider, lane: i % 2 === 0 ? 1 : -1, offset: (i >> 1) * (SPACING / 4) });
  }

  let chairPhase = 0;
  const colliders = [];

  function update(travel, dt) {
    const first = Math.floor((travel - BEHIND) / SPACING);
    const last = Math.ceil((travel + AHEAD) / SPACING);

    // recicla torres fora do alcance
    for (const [idx, m] of towers) {
      if (idx < first || idx > last) {
        m.tower.visible = false;
        m.cable1.visible = false;
        m.cable2.visible = false;
        towerPool.push(m.tower);
        cablePool.push(m.cable1, m.cable2);
        towers.delete(idx);
      }
    }

    // cria as que faltam
    for (let i = first; i <= last; i++) {
      if (towers.has(i)) continue;
      const z = i * SPACING;
      const y = groundHeight(LIFT_X, z);
      const tower = getTower();
      tower.position.set(LIFT_X, y, z);

      // segmento de cabo até a próxima torre (ida e volta)
      const zNext = (i + 1) * SPACING;
      const y0 = towerTopY(i), y1 = towerTopY(i + 1);
      const len = Math.hypot(zNext - z, y1 - y0);
      const pitch = Math.atan2(y1 - y0, zNext - z);

      const mk = (lane) => {
        const c = getCable();
        c.position.set(LIFT_X + lane * CABLE_OFFSET, (y0 + y1) / 2, (z + zNext) / 2);
        c.rotation.set(-pitch, 0, 0);
        c.scale.set(1, 1, len);
        return c;
      };
      towers.set(i, { tower, cable1: mk(-1), cable2: mk(1) });
    }

    // ------------------------------------------------------ cadeiras
    chairPhase += CHAIR_SPEED * dt;
    const span = CHAIR_COUNT * 0.5 * (SPACING / 4);
    for (const ch of chairs) {
      // lane 1 sobe a montanha (-Z), lane -1 desce (+Z)
      let z;
      if (ch.lane === 1) {
        z = travel + 260 - ((ch.offset + chairPhase) % span + span) % span * 2 - 60;
      } else {
        z = travel - 120 + ((ch.offset + chairPhase) % span + span) % span * 2;
      }
      const y = cableY(z);
      ch.group.position.set(LIFT_X + ch.lane * CABLE_OFFSET, y, z);
      ch.group.rotation.y = ch.lane === 1 ? Math.PI : 0;
      ch.group.rotation.x = Math.sin(chairPhase * 0.7 + ch.offset) * 0.035;
      ch.group.visible = z > travel - 130 && z < travel + AHEAD;
    }

    // ----------------------------------------------------- colisores
    colliders.length = 0;
    for (const [idx] of towers) {
      const z = idx * SPACING;
      if (z > travel - 30 && z < travel + 120) {
        colliders.push({ x: LIFT_X, z, r: 1.45, type: 'tower' });
      }
    }
    return colliders;
  }

  function reset() {
    for (const [idx, m] of towers) {
      m.tower.visible = false; m.cable1.visible = false; m.cable2.visible = false;
      towerPool.push(m.tower);
      cablePool.push(m.cable1, m.cable2);
    }
    towers.clear();
    colliders.length = 0;
  }

  function setVisible(v) { group.visible = v; }

  function dispose() {
    parent.remove(group);
    towerGeo.dispose(); chairGeo.dispose(); cableGeo.dispose(); cableMat.dispose();
  }

  return { update, reset, setVisible, dispose, colliders, LIFT_X };
}
