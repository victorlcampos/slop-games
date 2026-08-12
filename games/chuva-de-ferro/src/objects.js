// The twenty things that fall out of the sky.
//
// Each row is a piece of an alien freighter's manifest, and what makes the game
// is that they do not all behave alike on the way down or on the way to pieces:
// an egg sticks where it lands, a ball keeps bouncing, a safe takes thirty hits
// and then becomes the only high ground on the road.
//
// Fields
//   hp        shots it soaks (the safe is 30, a supply crate is 1)
//   r         radius in px — also what you have to hit
//   mass      how hard it falls: terminal speed and the shove it gives you
//   drag      air resistance (a parachute is 0.9, an anvil is 0)
//   land      break | settle | bounce | roll | explode | stick | hatch
//   solid     true when, once landed, you can stand on it
//   contact   damage it does to the soldier by touching him
//   drops     chance (0..1) of leaving something useful when destroyed
//   score     points for destroying it in the air
//   circuit   true for anything the EMP kills outright
//   splits    { into, n } when destroying it makes smaller ones

export const OBJECTS = [
  {
    id: 'crate', hp: 3, r: 26, mass: 1, drag: 0.02, land: 'break', solid: false,
    contact: 1, drops: 0.55, score: 40, weight: 14,
    name: { pt: 'Engradado', en: 'Crate' },
  },
  {
    id: 'supply', hp: 1, r: 24, mass: 0.4, drag: 0.9, land: 'break', solid: false,
    contact: 0, drops: 1, score: 25, weight: 5, parachute: true, alwaysWeapon: true,
    name: { pt: 'Caixa de suprimento', en: 'Supply crate' },
  },
  {
    id: 'egg', hp: 2, r: 22, mass: 0.8, drag: 0.05, land: 'stick', solid: false,
    contact: 1, drops: 0.2, score: 35, weight: 10, puddle: true,
    name: { pt: 'Ovo', en: 'Egg' },
  },
  {
    id: 'ball', hp: 4, r: 24, mass: 0.5, drag: 0.01, land: 'bounce', solid: false,
    contact: 1, drops: 0.3, score: 45, weight: 10, bounce: 0.82,
    name: { pt: 'Bola', en: 'Rubber ball' },
  },
  {
    id: 'spikeball', hp: 8, r: 26, mass: 1.1, drag: 0.01, land: 'bounce', solid: false,
    contact: 1, drops: 0.35, score: 90, weight: 7, bounce: 0.7, spiky: true,
    name: { pt: 'Bola de espinhos', en: 'Spiked ball' },
  },
  {
    id: 'barrel', hp: 3, r: 25, mass: 1.2, drag: 0.02, land: 'explode', solid: false,
    contact: 1, drops: 0.35, score: 60, weight: 9, blast: 150, blastDmg: 1,
    name: { pt: 'Barril de combustível', en: 'Fuel barrel' },
  },
  {
    id: 'cylinder', hp: 2, r: 20, mass: 0.9, drag: 0.02, land: 'explode', solid: false,
    contact: 1, drops: 0.3, score: 55, weight: 7, blast: 90, blastDmg: 1, jets: true,
    name: { pt: 'Cilindro de gás', en: 'Gas cylinder' },
  },
  {
    id: 'tv', hp: 4, r: 24, mass: 1, drag: 0.02, land: 'break', solid: false,
    contact: 1, drops: 0.4, score: 50, weight: 8, circuit: true,
    name: { pt: 'Televisor', en: 'TV set' },
  },
  {
    id: 'drone', hp: 6, r: 22, mass: 0.6, drag: 0.5, land: 'break', solid: false,
    contact: 1, drops: 0.45, score: 120, weight: 8, circuit: true, hover: true, shoots: 2.2,
    name: { pt: 'Sonda', en: 'Probe drone' },
  },
  {
    id: 'mine', hp: 2, r: 20, mass: 0.3, drag: 0.75, land: 'explode', solid: false,
    contact: 2, drops: 0.15, score: 70, weight: 6, blast: 130, blastDmg: 1, hover: true, circuit: true,
    name: { pt: 'Mina flutuante', en: 'Floating mine' },
  },
  {
    id: 'jelly', hp: 5, r: 28, mass: 0.7, drag: 0.2, land: 'stick', solid: false,
    contact: 1, drops: 0.25, score: 55, weight: 8, splits: { into: 'blob', n: 2 },
    name: { pt: 'Gelatina', en: 'Jelly blob' },
  },
  {
    id: 'blob', hp: 2, r: 16, mass: 0.5, drag: 0.15, land: 'stick', solid: false,
    contact: 1, drops: 0.1, score: 20, weight: 0, puddle: true,
    name: { pt: 'Respingo', en: 'Splatter' },
  },
  {
    id: 'boulder', hp: 12, r: 34, mass: 2.2, drag: 0, land: 'roll', solid: false,
    contact: 2, drops: 0.3, score: 110, weight: 7,
    name: { pt: 'Rocha', en: 'Boulder' },
  },
  {
    id: 'anvil', hp: 18, r: 28, mass: 3, drag: 0, land: 'settle', solid: true,
    contact: 2, drops: 0.4, score: 150, weight: 5, low: true,
    name: { pt: 'Bigorna', en: 'Anvil' },
  },
  {
    id: 'piano', hp: 8, r: 40, mass: 2, drag: 0.02, land: 'break', solid: false,
    contact: 2, drops: 0.5, score: 130, weight: 4, chord: true,
    name: { pt: 'Piano', en: 'Piano' },
  },
  {
    id: 'fridge', hp: 10, r: 34, mass: 1.8, drag: 0.02, land: 'settle', solid: true,
    contact: 1, drops: 0.6, score: 120, weight: 6, medic: 0.4,
    name: { pt: 'Geladeira', en: 'Refrigerator' },
  },
  {
    id: 'safe', hp: 30, r: 36, mass: 3.4, drag: 0, land: 'settle', solid: true,
    contact: 2, drops: 0.9, score: 260, weight: 4,
    name: { pt: 'Cofre', en: 'Safe' },
  },
  {
    id: 'statue', hp: 25, r: 38, mass: 3, drag: 0, land: 'settle', solid: true,
    contact: 2, drops: 0.7, score: 240, weight: 3,
    name: { pt: 'Estátua alienígena', en: 'Alien statue' },
  },
  {
    id: 'bell', hp: 14, r: 32, mass: 2, drag: 0.01, land: 'bounce', solid: false,
    contact: 2, drops: 0.5, score: 170, weight: 4, bounce: 0.5, chord: true,
    name: { pt: 'Sino', en: 'Bell' },
  },
  {
    id: 'meteor', hp: 15, r: 30, mass: 2.6, drag: 0, land: 'explode', solid: false,
    contact: 2, drops: 0.4, score: 200, weight: 4, blast: 160, blastDmg: 1, fire: true, fast: true,
    name: { pt: 'Meteoro', en: 'Meteor' },
  },
  {
    id: 'capsule', hp: 20, r: 34, mass: 1.6, drag: 0.1, land: 'break', solid: false,
    contact: 1, drops: 0.8, score: 220, weight: 3, circuit: true, splits: { into: 'drone', n: 3 },
    name: { pt: 'Cápsula de fuga', en: 'Escape capsule' },
  },
];

export const OBJECT_BY_ID = Object.fromEntries(OBJECTS.map((o) => [o.id, o]));

/** What the freighter can drop on its own — the rest only comes from splits. */
export const DROPPED = OBJECTS.filter((o) => o.weight > 0);

/**
 * Picks the next piece of cargo. `pressure` (0..1) grows with the run and tilts
 * the manifest towards the heavy end: minute one is crates and eggs, minute ten
 * is safes and meteors.
 */
export function rollObject(rand, pressure = 0) {
  const weights = DROPPED.map((o) => {
    const heavy = o.mass >= 1.6 || o.hp >= 12;
    return o.weight * (heavy ? 0.25 + pressure * 2.2 : 1.25 - pressure * 0.6);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = rand() * total;
  for (let i = 0; i < DROPPED.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return DROPPED[i];
  }
  return DROPPED[0];
}

/** A live piece of cargo, on its way down. */
export function spawnObject(def, x, y, vx = 0, vy = 0) {
  return {
    def,
    id: def.id,
    x, y, vx, vy,
    hp: def.hp,
    maxHp: def.hp,
    r: def.r,
    spin: 0,
    spinRate: (def.land === 'roll' || def.land === 'bounce' ? 3 : 1) * (vx >= 0 ? 1 : -1),
    landed: false,
    dead: false,
    frozen: 0,
    burning: 0,
    acid: 0,
    pinned: 0,
    fuse: 0,
    age: 0,
    shootIn: def.shoots || 0,
  };
}
