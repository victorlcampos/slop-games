// People (and an animal) on the slope: skiers zigzagging, snowboarders who
// don't watch where they're going, and the dog that crosses the mountain right
// in front of you.

import * as THREE from 'three';
import { createSkier, SKIER_PALETTES, characterMaterial } from './skierModel.js';
import { paint, paintBy } from '../world/geometries.js';
import { groundHeight, clamp, damp } from '../config.js';

const MAX_SKIERS = 7;
const SPAWN_AHEAD = 260;
const DESPAWN_BEHIND = 45;

// =============================================================== cachorro
function buildDogModel() {
  const g = new THREE.Group();

  const mk = (geo, color) => {
    paint(geo, color);
    const m = new THREE.Mesh(geo, characterMaterial);
    m.castShadow = true;
    return m;
  };

  const FUR = 0x8a5a34;
  const FUR_DARK = 0x5e3a20;

  const bodyGeo = new THREE.CapsuleGeometry(0.19, 0.44, 5, 10);
  bodyGeo.rotateX(Math.PI / 2);
  paintBy(bodyGeo, (x, y, z, ny, out) => {
    out.set(FUR).lerp(new THREE.Color(0xd9b48a), ny * 0.5 + 0.5);
  });
  const body = new THREE.Mesh(bodyGeo, characterMaterial);
  body.castShadow = true;
  body.position.y = 0.42;
  g.add(body);

  const neck = new THREE.Group();
  neck.position.set(0, 0.52, 0.34);
  g.add(neck);

  const head = mk(new THREE.SphereGeometry(0.16, 10, 8), FUR);
  head.scale.set(1, 0.92, 1.15);
  neck.add(head);

  const snout = mk(new THREE.BoxGeometry(0.13, 0.11, 0.20), FUR_DARK);
  snout.position.set(0, -0.03, 0.20);
  neck.add(snout);

  const nose = mk(new THREE.SphereGeometry(0.045, 6, 5), 0x1c1c1c);
  nose.position.set(0, 0.0, 0.31);
  neck.add(nose);

  for (const sx of [-1, 1]) {
    const ear = mk(new THREE.ConeGeometry(0.075, 0.17, 5), FUR_DARK);
    ear.position.set(sx * 0.10, 0.15, -0.02);
    ear.rotation.z = sx * 0.3;
    neck.add(ear);

    const eye = mk(new THREE.SphereGeometry(0.028, 6, 5), 0x111111);
    eye.position.set(sx * 0.075, 0.03, 0.145);
    neck.add(eye);
  }

  const legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.13, 0.36, sz * 0.20);
    g.add(hip);
    const leg = mk(new THREE.CapsuleGeometry(0.045, 0.24, 4, 6), FUR_DARK);
    leg.position.y = -0.16;
    hip.add(leg);
    legs.push(hip);
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.52, -0.32);
  g.add(tail);
  const tailMesh = mk(new THREE.CapsuleGeometry(0.05, 0.26, 4, 6), FUR);
  tailMesh.position.y = 0.15;
  tail.add(tailMesh);
  tail.rotation.x = -0.7;

  return { group: g, body, neck, legs, tail };
}

// ================================================================== pool
export function createNpcs(parent, props) {
  const group = new THREE.Group();
  parent.add(group);

  const skiers = [];
  for (let i = 0; i < MAX_SKIERS; i++) {
    const pal = SKIER_PALETTES[i % SKIER_PALETTES.length];
    const isBoarder = i % 3 === 2;
    const model = createSkier({ ...pal, snowboard: isBoarder, scale: 0.97 });
    model.group.visible = false;
    group.add(model.group);
    skiers.push({
      model,
      kind: isBoarder ? 'boarder' : 'skier',
      active: false,
      x: 0, z: 0, y: 0,
      speed: 0, heading: 0, phase: 0, freq: 0.4, amp: 0.5,
      crash: 0, avoidTimer: 0, lean: 0,
    });
  }

  const dogModel = buildDogModel();
  dogModel.group.visible = false;
  group.add(dogModel.group);
  const dog = {
    model: dogModel, active: false,
    x: 0, z: 0, y: 0, speed: 0, heading: 0, anim: 0,
    mode: 'run', timer: 0, dir: 1,
  };

  const colliders = [];
  const tmpColliders = [];
  let density = 1;
  let spawnTimer = 3;
  let dogTimer = 14;

  function spawnSkier(travel, playerX) {
    const s = skiers.find((k) => !k.active);
    if (!s) return;
    s.active = true;
    s.crash = 0;
    s.avoidTimer = 0;

    const fromBehind = s.kind === 'boarder' && Math.random() < 0.75;
    s.z = fromBehind ? travel - 30 - Math.random() * 40 : travel + 120 + Math.random() * SPAWN_AHEAD;
    s.x = playerX + (Math.random() * 2 - 1) * 55;
    s.speed = s.kind === 'boarder' ? 22 + Math.random() * 9 : 11 + Math.random() * 8;
    s.heading = (Math.random() * 2 - 1) * 0.3;
    s.phase = Math.random() * Math.PI * 2;
    s.freq = 0.35 + Math.random() * 0.5;
    s.amp = s.kind === 'boarder' ? 0.35 : 0.55 + Math.random() * 0.35;
    s.model.group.visible = true;
  }

  function spawnDog(travel, playerX) {
    dog.active = true;
    dog.mode = 'run';
    dog.timer = 4 + Math.random() * 5;
    dog.dir = Math.random() < 0.5 ? -1 : 1;
    dog.x = playerX - dog.dir * (30 + Math.random() * 25);
    dog.z = travel + 45 + Math.random() * 90;
    dog.speed = 9 + Math.random() * 4;
    dog.heading = dog.dir * 1.2;
    dog.model.group.visible = true;
  }

  /** Crude avoidance: if there is a tree in the way, turn the other way. */
  function avoid(entity, dt) {
    if (entity.avoidTimer > 0) { entity.avoidTimer -= dt; return; }
    props.collidersNear(entity.z + 10, tmpColliders);
    const lookX = entity.x + Math.sin(entity.heading) * 11;
    const lookZ = entity.z + Math.cos(entity.heading) * 11;
    for (const c of tmpColliders) {
      if (c.type === 'chalet') continue;
      const dx = c.x - lookX, dz = c.z - lookZ;
      if (dx * dx + dz * dz < (c.r + 2.2) * (c.r + 2.2)) {
        entity.heading += (c.x > entity.x ? -1 : 1) * 0.55;
        entity.avoidTimer = 0.5;
        break;
      }
    }
  }

  function update(dt, travel, player) {
    colliders.length = 0;

    // ------------------------------------------------------- spawn
    spawnTimer -= dt * density;
    if (spawnTimer <= 0) {
      spawnTimer = 2.6 + Math.random() * 4.5;
      spawnSkier(travel, player.x);
    }
    dogTimer -= dt * density;
    if (dogTimer <= 0 && !dog.active) {
      dogTimer = 16 + Math.random() * 22;
      spawnDog(travel, player.x);
    }

    // --------------------------------------------------- esquiadores
    for (const s of skiers) {
      if (!s.active) continue;

      if (s.crash > 0) {
        s.crash -= dt;
        s.speed = damp(s.speed, 0, 4, dt);
        if (s.crash <= 0) s.crash = 0;
      } else {
        s.phase += dt * s.freq * 2.4;
        const target = Math.sin(s.phase) * s.amp;
        // the snowboarder aims at whoever is in front
        if (s.kind === 'boarder') {
          const dx = player.x - s.x;
          const dz = player.z - s.z;
          if (dz > 3 && dz < 90) {
            s.heading = damp(s.heading, clamp(Math.atan2(dx, dz), -0.7, 0.7), 1.6, dt);
          } else {
            s.heading = damp(s.heading, target, 1.8, dt);
          }
        } else {
          s.heading = damp(s.heading, target, 2.2, dt);
        }
        avoid(s, dt);
        s.heading = clamp(s.heading, -1.2, 1.2);
      }

      s.x += Math.sin(s.heading) * s.speed * dt;
      s.z += Math.cos(s.heading) * s.speed * dt;
      s.y = groundHeight(s.x, s.z);

      s.lean = damp(s.lean, -s.heading * 0.55, 6, dt);
      s.model.group.position.set(s.x, s.y, s.z);
      s.model.group.rotation.y = s.heading;
      s.model.pose({
        crouch: s.kind === 'boarder' ? 0.55 : 0.3,
        lean: s.lean,
        t: performance.now() * 0.001,
        speed: s.speed / 30,
        crashed: s.crash > 0 ? clamp(s.crash / 0.9, 0, 1) : 0,
      });

      if (s.z < travel - DESPAWN_BEHIND || Math.abs(s.x - player.x) > 190) {
        s.active = false;
        s.model.group.visible = false;
        continue;
      }
      if (s.crash <= 0) {
        colliders.push({ x: s.x, z: s.z, r: 0.8, type: s.kind, ref: s });
      }
    }

    // -------------------------------------------------------- cachorro
    if (dog.active) {
      dog.anim += dt;
      dog.timer -= dt;

      if (dog.mode === 'run') {
        dog.heading = damp(dog.heading, dog.dir * 1.15, 2, dt);
        dog.speed = damp(dog.speed, 11, 2, dt);
        if (dog.timer <= 0) { dog.mode = 'mark'; dog.timer = 2.4; }
      } else {
        // marks its territory, just like the dog in the original game
        dog.speed = damp(dog.speed, 0, 6, dt);
        if (dog.timer <= 0) { dog.mode = 'run'; dog.timer = 5 + Math.random() * 5; dog.dir *= -1; }
      }

      dog.x += Math.sin(dog.heading) * dog.speed * dt;
      dog.z += Math.cos(dog.heading) * dog.speed * dt;
      dog.y = groundHeight(dog.x, dog.z);
      dog.model.group.position.set(dog.x, dog.y, dog.z);
      dog.model.group.rotation.y = dog.heading;

      const run = clamp(dog.speed / 11, 0, 1);
      const c = Math.sin(dog.anim * 13) * run;
      dog.model.legs[0].rotation.x = c * 0.9;
      dog.model.legs[1].rotation.x = -c * 0.9;
      dog.model.legs[2].rotation.x = -c * 0.9;
      dog.model.legs[3].rotation.x = c * 0.9;
      dog.model.body.position.y = 0.42 + Math.abs(c) * 0.05;
      dog.model.tail.rotation.z = Math.sin(dog.anim * 9) * 0.5;

      if (dog.mode === 'mark') {
        // lifts a leg and looks to the side
        dog.model.legs[3].rotation.x = -0.2;
        dog.model.legs[3].rotation.z = -1.1;
        dog.model.neck.rotation.y = 0.5;
        dog.model.tail.rotation.x = -1.3;
      } else {
        dog.model.legs[3].rotation.z = 0;
        dog.model.neck.rotation.y = 0;
        dog.model.tail.rotation.x = -0.7;
      }

      if (dog.z < travel - DESPAWN_BEHIND || Math.abs(dog.x - player.x) > 150) {
        dog.active = false;
        dog.model.group.visible = false;
      } else {
        colliders.push({ x: dog.x, z: dog.z, r: 0.55, type: 'dog', ref: dog });
      }
    }

    return colliders;
  }

  function knockDown(ref) {
    if (!ref) return;
    if (ref.kind) { ref.crash = 1.6; }
    else { ref.mode = 'run'; ref.timer = 3; ref.dir *= -1; ref.speed = 13; }
  }

  function reset(newDensity = 1) {
    density = newDensity;
    for (const s of skiers) { s.active = false; s.model.group.visible = false; }
    dog.active = false;
    dog.model.group.visible = false;
    spawnTimer = 3.5;
    dogTimer = 12;
    colliders.length = 0;
  }

  function dispose() {
    parent.remove(group);
    group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  }

  return { update, reset, knockDown, dispose, skiers, dog, colliders };
}
