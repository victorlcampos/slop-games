// Eight weapons, and the table that says what each of them is for.
//
// `vs` is the whole design of the game in one object: a number per material,
// where 1 means "nothing special". A trebuchet stone shrugs off an iron plate
// and a bolt goes through crystal like it was not there, so the wall you built
// last level is the wrong wall the moment the enemy switches ammunition — and
// the same is true in reverse, which is why the workshop lets you mix.
//
// `ground` is the second half of it: the same weapon digs a canyon in the dunes
// and scratches the quarry, so a level's terrain decides which of your four
// specials is worth a turn.
//
// Ammunition is per match and does not carry over. The basic shot never runs
// out — nobody should ever be unable to take a turn.

const INF = Infinity;

export const WEAPONS = {
  // ---------------------------------------------------------------- knights
  boulder: {
    id: 'boulder',
    faction: 'knights',
    ammo: INF,
    damage: 62,
    radius: 46,
    speed: 1,
    wind: 0.5,
    dig: 1,
    vs: { stone: 1.4, wood: 1.3, sand: 0.5, crystal: 1, iron: 0.55, king: 1 },
    ground: { rock: 1.1 },
  },
  firepot: {
    id: 'firepot',
    faction: 'knights',
    ammo: 4,
    // Deliberately feeble. At 34 it *destroyed* the timber outright, which meant
    // the wall it set alight was already gone and the fire had nothing to eat —
    // the weapon's whole mechanic never once fired in a real match.
    damage: 20,
    radius: 62,
    speed: 0.95,
    wind: 1.2,
    dig: 0.45,
    // it does not knock a wall down, it sets it alight and waits
    fire: 3,
    vs: { wood: 2.4, sand: 0.6, stone: 0.4, crystal: 0.2, iron: 0.7, king: 0.85 },
    ground: { snow: 0.6, ash: 1.3 },
  },
  ballista: {
    id: 'ballista',
    faction: 'knights',
    ammo: 5,
    damage: 98,
    radius: 20,
    speed: 1.45,
    wind: 0.3,
    dig: 0.35,
    // it keeps going through whatever it breaks — a line of crystal is one shot
    pierce: 2,
    vs: { crystal: 2.6, sand: 1.6, wood: 1.2, stone: 0.7, iron: 0.5, king: 1.15 },
    ground: { rock: 0.5 },
  },
  hail: {
    id: 'hail',
    faction: 'knights',
    ammo: 3,
    damage: 32,
    radius: 42,
    speed: 1,
    wind: 0.9,
    dig: 0.8,
    // splits at the top of its arc: three craters, and you aim the middle one
    split: 3,
    vs: { sand: 1.2, crystal: 1.3, wood: 1.1, stone: 0.8, iron: 0.4, king: 0.9 },
    ground: {},
  },

  // --------------------------------------------------------------- machines
  railshot: {
    id: 'railshot',
    faction: 'machines',
    ammo: INF,
    damage: 57,
    radius: 40,
    speed: 1.25,
    wind: 0.45,
    dig: 0.9,
    vs: { crystal: 1.4, iron: 1.2, stone: 1, wood: 1, sand: 0.55, king: 1 },
    ground: { snow: 1.2 },
  },
  rustshell: {
    id: 'rustshell',
    faction: 'machines',
    ammo: 4,
    damage: 38,
    radius: 58,
    speed: 0.9,
    wind: 1.1,
    dig: 0.6,
    // the mirror of the fire pot: it eats the material the fire pot cannot touch
    rust: 3,
    vs: { iron: 2.8, wood: 1.2, sand: 0.9, crystal: 0.6, stone: 0.5, king: 0.85 },
    ground: { scrap: 1.4 },
  },
  tesla: {
    id: 'tesla',
    faction: 'machines',
    ammo: 4,
    damage: 46,
    radius: 46,
    speed: 1.1,
    wind: 0.7,
    dig: 0.3,
    // jumps to the nearest conductor: an iron wall is one target, not eight
    arc: 190,
    vs: { iron: 2, crystal: 1.8, stone: 0.6, wood: 0.5, sand: 0.35, king: 1.1 },
    ground: { scrap: 1.5, snow: 1.2 },
  },
  drill: {
    id: 'drill',
    faction: 'machines',
    ammo: 3,
    damage: 72,
    radius: 64,
    speed: 1,
    wind: 0.6,
    dig: 1.2,
    // it does not hit a castle, it takes the ground out from under one
    burrow: 0.32,
    vs: { sand: 1.5, stone: 1.2, crystal: 0.9, wood: 0.8, iron: 0.7, king: 1 },
    ground: { rock: 0.6, sand: 1.3 },
  },
};

/** The four a faction fires, in dock order: the endless one first. */
export const ARSENAL = {
  knights: ['boulder', 'firepot', 'ballista', 'hail'],
  machines: ['railshot', 'rustshell', 'tesla', 'drill'],
};

export const weapon = (id) => WEAPONS[id];

/** A fresh ammunition counter for a match. */
export function loadout(faction) {
  const out = {};
  for (const id of ARSENAL[faction]) out[id] = WEAPONS[id].ammo;
  return out;
}

/**
 * How much of a weapon's damage a given material actually takes.
 * Materials also carry a `blast` of their own — sandbags eat explosions from
 * every direction, which is a property of the sack rather than of the shell.
 */
export function damageAgainst(w, mat, blastResist = 1) {
  const mult = w.vs[mat] === undefined ? 1 : w.vs[mat];
  return w.damage * mult * blastResist;
}

/** How wide a hole this weapon opens in this ground. */
export function craterRadius(w, terrainKind, terrainDig) {
  const g = w.ground[terrainKind] === undefined ? 1 : w.ground[terrainKind];
  return w.radius * w.dig * terrainDig * g;
}

/** The same terrain multiplier, applied to what the blast does to a wall. */
export function groundBonus(w, terrainKind) {
  return w.ground[terrainKind] === undefined ? 1 : w.ground[terrainKind];
}
