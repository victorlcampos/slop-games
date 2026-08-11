// Fábricas de geometria para tudo que enfeita (e atrapalha) a descida.
// Todas devolvem geometrias com atributo `color` para poderem ser mescladas
// e desenhadas com um único material de vertex colors.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { perlin2, makeRng } from '../lib/noise.js';
import { COLORS } from '../config.js';

const _c = new THREE.Color();

/** Pinta todos os vértices de uma cor sólida. */
export function paint(geo, color) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Pinta por vértice: fn(x, y, z, normalY, colorOut). */
export function paintBy(geo, fn) {
  const p = geo.attributes.position;
  const nAttr = geo.attributes.normal;
  const n = p.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    fn(p.getX(i), p.getY(i), p.getZ(i), nAttr ? nAttr.getY(i) : 1, _c);
    arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Garante uv/normal para que o merge não reclame de atributos diferentes. */
function normalize(geo) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) {
    const n = geo.attributes.position.count;
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  if (!geo.attributes.color) paint(geo, 0xffffff);
  geo.deleteAttribute('uv1');
  geo.deleteAttribute('tangent');
  return geo;
}

function merge(list) {
  const g = mergeGeometries(list.map(normalize), false);
  list.forEach((x) => x.dispose());
  return g;
}

// ============================================================== pinheiro
/**
 * Pinheiro de conífera: tronco + camadas cônicas com neve acumulada
 * na parte de cima de cada camada.
 */
export function makePineGeometry(seed = 1) {
  const rng = makeRng(seed);
  const parts = [];

  const height = 9 + rng() * 5.5;
  const trunkH = height * 0.30;
  const lean = (rng() - 0.5) * 0.06;      // nenhuma árvore cresce reta

  // ---- tronco: cônico, com casca irregular
  const trunk = new THREE.CylinderGeometry(0.13, 0.30, trunkH, 8, 3);
  {
    const p = trunk.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const bark = perlin2(v.y * 6.0 + seed, Math.atan2(v.z, v.x) * 2.2) * 0.045;
      const r = Math.hypot(v.x, v.z);
      if (r > 0.001) { v.x *= 1 + bark / r; v.z *= 1 + bark / r; }
      p.setXYZ(i, v.x, v.y, v.z);
    }
    trunk.computeVertexNormals();
  }
  trunk.translate(0, trunkH / 2, 0);
  paintBy(trunk, (x, y, z, ny, out) => {
    const g = perlin2(y * 5.5, Math.atan2(z, x) * 3) * 0.5 + 0.5;
    out.set(COLORS.bark).lerp(new THREE.Color(0x6b4b30), g);
  });
  parts.push(trunk);

  // ---- copa: camadas de galhos, cada uma um cone recortado em pontas
  const layers = 7;
  const dark = new THREE.Color(COLORS.pineDark);
  const light = new THREE.Color(COLORS.pineLight);
  const snow = new THREE.Color(0xf2f8ff);
  const spokes = 5 + ((rng() * 3) | 0);   // quantos galhos por volta

  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const r = (2.05 - t * 1.62) * (0.92 + rng() * 0.16);
    const h = (2.6 - t * 1.35) * (0.92 + rng() * 0.16);
    const y = trunkH * 0.55 + t * (height - trunkH) * 0.88;
    const phase = rng() * Math.PI * 2;

    const cone = new THREE.ConeGeometry(r, h, spokes * 3, 3);
    const p = cone.attributes.position;
    const v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      const rad = Math.hypot(v.x, v.z);
      if (rad > 0.001) {
        const ang = Math.atan2(v.z, v.x);
        // pontas de galho: recorta o cone em lóbulos
        const lobe = 0.66 + 0.34 * Math.pow(Math.abs(Math.cos(ang * spokes * 0.5 + phase)), 0.6);
        const rough = 1 + perlin2(v.x * 2.4 + i * 3, v.z * 2.4) * 0.12;
        const f = lobe * rough;
        v.x *= f; v.z *= f;
        // galho pende nas pontas
        v.y -= Math.pow(rad / r, 2.0) * h * 0.16;
      }
      p.setXYZ(k, v.x, v.y, v.z);
    }
    cone.computeVertexNormals();
    cone.translate(0, h / 2, 0);

    paintBy(cone, (x, cy, z, ny, out) => {
      const f = THREE.MathUtils.clamp(cy / h, 0, 1);
      const tint = perlin2(x * 2.2 + i, z * 2.2) * 0.5 + 0.5;
      out.copy(dark).lerp(light, tint * 0.7 + f * 0.3);
      // neve pousa no que está virado para cima, e mais no alto da árvore
      const up = THREE.MathUtils.smoothstep(ny, 0.15, 0.72);
      out.lerp(snow, up * (0.30 + t * 0.45) * (0.7 + tint * 0.3));
    });
    cone.translate(0, y, 0);
    parts.push(cone);
  }

  // capuz de neve na ponta
  const cap = new THREE.ConeGeometry(0.30, 0.85, 7, 1);
  cap.translate(0, height * 0.94, 0);
  paint(cap, 0xfbfdff);
  parts.push(cap);

  const geo = merge(parts);
  geo.rotateZ(lean);
  geo.userData = { height, radius: 1.15 };
  return geo;
}

// ================================================================= pedra
export function makeRockGeometry(seed = 1) {
  const rng = makeRng(seed * 31 + 7);
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n1 = perlin2(v.x * 1.6 + seed, v.z * 1.6 - seed) * 0.34;
    const n2 = perlin2(v.x * 4.1, v.y * 4.1 + seed) * 0.14;
    v.multiplyScalar(1 + n1 + n2);
    v.y *= 0.62 + rng() * 0.2;          // achatada, como pedra semienterrada
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const rock = new THREE.Color(COLORS.rock);
  const dark = new THREE.Color(0x6a7683);
  paintBy(geo, (x, y, z, ny, out) => {
    const grain = perlin2(x * 5.5, z * 5.5) * 0.5 + 0.5;
    out.copy(dark).lerp(rock, grain);
    // touca de neve nas faces voltadas para cima
    const snowAmt = THREE.MathUtils.smoothstep(ny, 0.30, 0.72) * (0.82 + grain * 0.18);
    out.lerp(new THREE.Color(0xf7fbff), snowAmt);
  });

  geo.userData = { radius: 1.0 };
  return geo;
}

// ================================================================ rampa
/** Kicker de neve: perfil côncavo que cospe o esquiador para cima. */
export function makeRampGeometry(length = 9, width = 7.5, height = 2.4) {
  const shape = new THREE.Shape();
  const steps = 14;
  shape.moveTo(0, 0);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    shape.lineTo(t * length, Math.pow(t, 1.9) * height);
  }
  shape.lineTo(length, 0);
  shape.lineTo(0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 4 });
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  geo.computeVertexNormals();

  paintBy(geo, (x, y, z, ny, out) => {
    const t = THREE.MathUtils.clamp(y / height, 0, 1);
    out.set(0xffffff);
    out.lerp(new THREE.Color(0xbcd8f0), 0.30 - t * 0.25);      // sombra na base
    if (ny < 0.35) out.lerp(new THREE.Color(0x8fb4d6), 0.45);  // laterais escuras
  });

  geo.userData = { length, width, height };
  return geo;
}

// =========================================================== teleférico
export function makeLiftTowerGeometry(height = 15) {
  const parts = [];
  const legR = 0.22;
  const spread = 1.5;

  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.CylinderGeometry(legR * 0.6, legR, height, 6);
    leg.translate(sx * spread * 0.5, height / 2, sz * spread * 0.5);
    // inclina levemente as pernas para fora na base
    parts.push(leg);
  }
  // travessas
  for (let i = 1; i <= 4; i++) {
    const y = (i / 5) * height;
    const bar1 = new THREE.BoxGeometry(spread, 0.14, 0.14);
    bar1.translate(0, y, -spread * 0.5);
    const bar2 = new THREE.BoxGeometry(spread, 0.14, 0.14);
    bar2.translate(0, y, spread * 0.5);
    const bar3 = new THREE.BoxGeometry(0.14, 0.14, spread);
    bar3.translate(-spread * 0.5, y, 0);
    const bar4 = new THREE.BoxGeometry(0.14, 0.14, spread);
    bar4.translate(spread * 0.5, y, 0);
    parts.push(bar1, bar2, bar3, bar4);
  }
  parts.forEach((g) => paint(g, 0xd94a3d));

  // braço horizontal que segura o cabo
  const arm = new THREE.BoxGeometry(6.4, 0.34, 0.42);
  arm.translate(0, height + 0.2, 0);
  paint(arm, 0x8a9099);
  parts.push(arm);

  for (const sx of [-2.9, 2.9]) {
    const wheel = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
    wheel.rotateZ(Math.PI / 2);
    wheel.translate(sx, height + 0.6, 0);
    paint(wheel, 0x333a42);
    parts.push(wheel);
  }

  const geo = merge(parts);
  geo.userData = { height, radius: 1.3 };
  return geo;
}

export function makeChairGeometry() {
  const parts = [];
  const hanger = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6);
  hanger.translate(0, 1.3, 0);
  paint(hanger, 0x4a5158);
  parts.push(hanger);

  const seat = new THREE.BoxGeometry(2.3, 0.16, 0.75);
  paint(seat, 0xd94a3d);
  parts.push(seat);

  const back = new THREE.BoxGeometry(2.3, 1.0, 0.14);
  back.translate(0, 0.5, -0.36);
  paint(back, 0xd94a3d);
  parts.push(back);

  const bar = new THREE.BoxGeometry(2.2, 0.1, 0.1);
  bar.translate(0, 0.62, 0.5);
  paint(bar, 0x9aa2aa);
  parts.push(bar);

  return merge(parts);
}

// ============================================================ bandeiras
/** Bandeira de slalom: mastro + pano. O pano ondula no shader. */
export function makeFlagGeometry(color, height = 2.4) {
  const parts = [];
  const pole = new THREE.CylinderGeometry(0.045, 0.055, height, 6);
  pole.translate(0, height / 2, 0);
  paint(pole, 0xf2f4f6);
  parts.push(pole);

  // caixa fina, não plano: o plano tem face única e some quando visto por trás
  const cloth = new THREE.BoxGeometry(1.05, 0.72, 0.035);
  cloth.translate(0.545, height - 0.45, 0);
  paint(cloth, color);
  parts.push(cloth);

  // dobra de tecido para não parecer uma placa
  const fold = new THREE.BoxGeometry(0.34, 0.72, 0.09);
  fold.translate(0.90, height - 0.47, 0.03);
  fold.rotateZ(-0.05);
  paint(fold, color);
  parts.push(fold);

  const geo = merge(parts);
  geo.userData = { height };
  return geo;
}

// =============================================================== chalé
export function makeChaletGeometry(seed = 1) {
  const rng = makeRng(seed * 17 + 3);
  const parts = [];
  const w = 7 + rng() * 3, d = 6 + rng() * 2.5, h = 3.4 + rng();

  const walls = new THREE.BoxGeometry(w, h, d);
  walls.translate(0, h / 2, 0);
  paintBy(walls, (x, y, z, ny, out) => {
    const plank = Math.sin(y * 7.5) * 0.5 + 0.5;
    out.set(0x6b4a30).lerp(new THREE.Color(0x8a6242), plank * 0.55);
  });
  parts.push(walls);

  // telhado de duas águas com neve
  const roof = new THREE.CylinderGeometry(d * 0.78, d * 0.78, w + 1.2, 3, 1, false);
  roof.rotateZ(Math.PI / 2);
  roof.rotateY(Math.PI / 2);
  roof.scale(1, 1, 0.62);
  roof.translate(0, h + d * 0.30, 0);
  paintBy(roof, (x, y, z, ny, out) => {
    out.set(ny > 0.2 ? 0xf6fbff : 0x50372a);
  });
  parts.push(roof);

  const chimney = new THREE.BoxGeometry(0.8, 2.4, 0.8);
  chimney.translate(w * 0.28, h + 1.6, 0);
  paint(chimney, 0x7a6055);
  parts.push(chimney);

  const snowCap = new THREE.BoxGeometry(1.0, 0.22, 1.0);
  snowCap.translate(w * 0.28, h + 2.85, 0);
  paint(snowCap, 0xffffff);
  parts.push(snowCap);

  // janelas acesas
  for (const sx of [-w * 0.26, w * 0.26]) {
    const win = new THREE.BoxGeometry(1.25, 1.05, 0.12);
    win.translate(sx, h * 0.55, d / 2 + 0.02);
    paint(win, 0xffd88a);
    parts.push(win);
  }
  const door = new THREE.BoxGeometry(1.15, 2.0, 0.14);
  door.translate(0, 1.0, d / 2 + 0.02);
  paint(door, 0x3d2a1c);
  parts.push(door);

  const geo = merge(parts);
  geo.userData = { radius: Math.max(w, d) * 0.55, width: w, depth: d, height: h };
  return geo;
}

// ============================================================== arbusto
export function makeBushGeometry(seed = 1) {
  const rng = makeRng(seed * 53 + 11);
  const parts = [];
  const n = 3 + ((rng() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const r = 0.5 + rng() * 0.5;
    const b = new THREE.IcosahedronGeometry(r, 1);
    b.translate((rng() - 0.5) * 1.2, r * 0.7 + rng() * 0.25, (rng() - 0.5) * 1.2);
    paintBy(b, (x, y, z, ny, out) => {
      out.set(0x2c6b40).lerp(new THREE.Color(0xffffff), THREE.MathUtils.smoothstep(ny, 0.35, 0.9) * 0.8);
    });
    parts.push(b);
  }
  const geo = merge(parts);
  geo.userData = { radius: 1.0 };
  return geo;
}

// ================================================================ placa
/** Placa de pista, com a seta do jogo original. */
export function makeSignGeometry(dir = 1) {
  const parts = [];
  const post = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6);
  post.translate(0, 1.3, 0);
  paint(post, 0x2f353b);
  parts.push(post);

  const board = new THREE.BoxGeometry(1.5, 0.95, 0.09);
  board.translate(0, 2.2, 0);
  paint(board, dir > 0 ? 0x2a5bd7 : 0xd93b30);
  parts.push(board);

  // seta branca em relevo
  const shaft = new THREE.BoxGeometry(0.62, 0.16, 0.06);
  shaft.translate(-0.1 * dir, 2.2, 0.07);
  paint(shaft, 0xffffff);
  parts.push(shaft);

  const head = new THREE.ConeGeometry(0.24, 0.4, 3);
  head.rotateZ(-Math.PI / 2 * dir);
  head.translate(0.36 * dir, 2.2, 0.07);
  paint(head, 0xffffff);
  parts.push(head);

  return merge(parts);
}

// ============================================================ obstáculos
/** Toco de árvore — pequeno, mas derruba igual. */
export function makeStumpGeometry() {
  const parts = [];
  const s = new THREE.CylinderGeometry(0.5, 0.62, 1.0, 9);
  s.translate(0, 0.5, 0);
  paint(s, COLORS.bark);
  parts.push(s);
  const top = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 9);
  top.translate(0, 1.05, 0);
  paint(top, 0xb08a5e);
  parts.push(top);
  const geo = merge(parts);
  geo.userData = { radius: 0.65 };
  return geo;
}

export { merge as mergeParts, normalize as normalizeGeometry };
