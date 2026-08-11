// The car: a procedural low-poly model + arcade physics (bicycle model with drift)
import * as THREE from 'three';
import { clamp, lerp } from './geo.js';

const WHEELBASE = 2.6;
const VMAX = 46;        // m/s (~165 km/h)
const VMAX_REV = 9;
const ACCEL = 10.5;
const BRAKE = 17;
const GRIP = 7.5;       // amortecimento lateral normal (1/s)
const GRIP_HB = 1.3;    // with the handbrake
const BODY_R = 0.95;    // radius of the collision circles

function buildModel() {
  const g = new THREE.Group();          // root: position + orientation on the terrain
  const tilt = new THREE.Group();       // chassis lean (roll/pitch)
  g.add(tilt);

  const paint = new THREE.MeshPhongMaterial({ color: 0xd8332c, shininess: 70, specular: 0x555555 });
  const dark = new THREE.MeshPhongMaterial({ color: 0x14181d, shininess: 90, specular: 0x668899 });
  const trim = new THREE.MeshPhongMaterial({ color: 0x22262b, shininess: 10 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.5, 4.15), paint);
  body.position.y = 0.55;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 1.1), paint);
  hood.position.set(0, 0.84, -1.35);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.52, 2.05), dark);
  cabin.position.set(0, 1.0, 0.28);
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.3, 0.28), trim);
  bumperF.position.set(0, 0.42, -2.08);
  const bumperR = bumperF.clone();
  bumperR.position.z = 2.08;
  const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xfff6cc }));
  lightL.position.set(-0.55, 0.66, -2.09);
  const lightR = lightL.clone(); lightR.position.x = 0.55;
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.06), tailMat);
  tailL.position.set(-0.6, 0.66, 2.09);
  const tailR = tailL.clone(); tailR.position.x = 0.6;
  tilt.add(body, hood, cabin, bumperF, bumperR, lightL, lightR, tailL, tailR);
  for (const m of [body, hood, cabin]) m.castShadow = true;

  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x131313 });
  const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const hubMat = new THREE.MeshPhongMaterial({ color: 0x8f9499, shininess: 80 });

  const wheels = [];      // wheels (spin on their axis)
  const steers = [];      // front steering pivots
  for (const [x, z, front] of [[-0.82, -1.32, 1], [0.82, -1.32, 1], [-0.82, 1.32, 0], [0.82, 1.32, 0]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.34, z);
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.castShadow = true;
    w.add(new THREE.Mesh(hubGeo, hubMat));
    pivot.add(w);
    tilt.add(pivot);
    wheels.push(w);
    if (front) steers.push(pivot);
  }
  return { group: g, tilt, wheels, steers, tailMat };
}

export class Car {
  constructor() {
    const m = buildModel();
    this.group = m.group;
    this.tilt = m.tilt;
    this.wheels = m.wheels;
    this.steers = m.steers;
    this.tailMat = m.tailMat;

    this.x = 0; this.z = 0; this.y = 0;
    this.heading = 0;
    this.vx = 0; this.vz = 0;
    this.steer = 0;
    this.vF = 0; this.vL = 0;
    this.accelMeasured = 0;
    this.smoothNormal = new THREE.Vector3(0, 1, 0);
    this.onCrash = null; // cb(intensidade 0..1)
    this._q = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
  }

  place(x, z, heading, world) {
    this.x = x; this.z = z; this.heading = heading;
    this.vx = this.vz = this.vF = this.vL = 0;
    this.y = world.heightAt(x, z);
    this.smoothNormal.copy(world.normalAt(x, z));
    this._pose(world, 0);
  }

  // input: {throttle -1..1, steer -1..1, handbrake}
  update(dt, input, world) {
    const N = 2; // substeps
    const h = dt / N;
    for (let s = 0; s < N; s++) this._step(h, input, world);
    this._pose(world, dt);
  }

  _step(dt, input, world) {
    // steering: the maximum angle drops with speed
    const speed = Math.abs(this.vF);
    const maxSteer = 0.56 / (1 + speed * 0.045);
    const target = (input.steer || 0) * maxSteer;
    this.steer = lerp(this.steer, target, 1 - Math.exp(-9 * dt));

    const sinH = Math.sin(this.heading), cosH = Math.cos(this.heading);
    const fx = sinH, fz = -cosH;        // frente (heading 0 = norte = -z)
    const rx = -fz, rz = fx;            // direita

    // decompose the velocity
    let vF = this.vx * fx + this.vz * fz;
    let vL = this.vx * rx + this.vz * rz;

    // motor / freio
    const th = input.throttle || 0;
    let a = 0;
    if (th > 0.01) {
      a = (vF < -0.5) ? BRAKE * th : ACCEL * th * (1 - clamp(vF / VMAX, 0, 1) * 0.75);
    } else if (th < -0.01) {
      a = (vF > 0.5) ? BRAKE * th : ACCEL * 0.6 * th * (1 - clamp(-vF / VMAX_REV, 0, 1));
    }
    // drag + rolling resistance
    a -= 0.35 * vF * 0.08 + 0.0045 * vF * Math.abs(vF) + Math.sign(vF) * 0.35;
    // slope: the component of gravity along the heading
    const [gx, gz] = world.slopeAt(this.x, this.z);
    a -= 9.81 * (fx * gx + fz * gz) * 0.9;
    if (input.handbrake) a -= Math.sign(vF) * 6;

    const vFprev = vF;
    vF += a * dt;
    if (Math.abs(vF) < 0.12 && Math.abs(th) < 0.01) vF = 0;
    vF = clamp(vF, -VMAX_REV, VMAX);
    this.accelMeasured = lerp(this.accelMeasured, (vF - vFprev) / dt, 0.2);

    // lateral grip (drift with the handbrake)
    const grip = input.handbrake ? GRIP_HB : GRIP;
    vL *= Math.exp(-grip * dt);

    // rotation (bicycle model)
    if (Math.abs(vF) > 0.05) {
      const omega = (vF / WHEELBASE) * Math.tan(this.steer) * (input.handbrake ? 1.25 : 1);
      this.heading += omega * dt;
      this._omega = omega;
    } else this._omega = 0;

    // recompose with the new heading
    const sin2 = Math.sin(this.heading), cos2 = Math.cos(this.heading);
    const f2x = sin2, f2z = -cos2, r2x = cos2, r2z = sin2;
    this.vx = f2x * vF + r2x * vL;
    this.vz = f2z * vF + r2z * vL;
    this.vF = vF; this.vL = vL;

    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // collisions (two circles: front and rear)
    for (const off of [-1.25, 1.25]) {
      const px = this.x + f2x * off, pz = this.z + f2z * off;
      const contacts = world.collision.collide(px, pz, BODY_R);
      for (const c of contacts) {
        this.x += c.nx * c.depth;
        this.z += c.nz * c.depth;
        const vn = this.vx * c.nx + this.vz * c.nz;
        if (vn < 0) {
          this.vx -= c.nx * vn * 1.4;
          this.vz -= c.nz * vn * 1.4;
          this.vx *= 0.86; this.vz *= 0.86;
          if (this.onCrash && vn < -3) this.onCrash(clamp(-vn / 18, 0.1, 1));
        }
      }
    }

    // area bounds
    const lim = world.half - 3;
    if (Math.abs(this.x) > lim) { this.x = clamp(this.x, -lim, lim); this.vx *= -0.25; }
    if (Math.abs(this.z) > lim) { this.z = clamp(this.z, -lim, lim); this.vz *= -0.25; }
  }

  _pose(world, dt) {
    // stick to the terrain
    const ty = world.heightAt(this.x, this.z);
    this.y = dt > 0 ? lerp(this.y, ty, 1 - Math.exp(-18 * dt)) : ty;

    const n = world.normalAt(this.x, this.z);
    if (dt > 0) this.smoothNormal.lerp(n, 1 - Math.exp(-8 * dt)).normalize();
    else this.smoothNormal.copy(n);

    // orthonormal basis: the front projected onto the terrain plane
    const up = this.smoothNormal;
    const f = new THREE.Vector3(Math.sin(this.heading), 0, -Math.cos(this.heading));
    f.addScaledVector(up, -f.dot(up)).normalize();
    const back = f.clone().negate();
    const right = new THREE.Vector3().crossVectors(up, back);
    this._m.makeBasis(right, up, back);
    this._q.setFromRotationMatrix(this._m);
    this.group.quaternion.copy(this._q);
    this.group.position.set(this.x, this.y, this.z);

    // wheels: spin + steering
    const spin = (this.vF / 0.34) * (dt || 0.016);
    for (const w of this.wheels) w.rotation.x += spin;
    for (const p of this.steers) p.rotation.y = -this.steer * 1.15;

    // chassis lean
    const rollTarget = clamp((this._omega || 0) * this.vF * 0.0045, -0.09, 0.09);
    const pitchTarget = clamp(this.accelMeasured * 0.006, -0.05, 0.06);
    this.tilt.rotation.z = lerp(this.tilt.rotation.z, rollTarget, 0.12);
    this.tilt.rotation.x = lerp(this.tilt.rotation.x, pitchTarget, 0.12);

    // luz de freio
    const braking = (this.vF > 1 && this.accelMeasured < -4) || this.vF < -0.5;
    this.tailMat.color.setHex(braking ? 0xff2211 : 0x550000);
  }

  get speedKmh() { return Math.abs(this.vF) * 3.6; }
  get drifting() { return Math.abs(this.vL) > 3.5 && Math.abs(this.vF) > 6; }
  get forward() { return new THREE.Vector3(Math.sin(this.heading), 0, -Math.cos(this.heading)); }
}
