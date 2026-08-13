// The guns, and the one number that decides how a heist goes: `noise`.
//
// Damage is the boring axis — every gun here kills a guard in one to three
// hits. What separates them is how far the shot travels through the building:
// the silenced pistol you start with is heard by whoever is already in the
// room, and the shotgun is heard by the floor above.

export const WEAPONS = {
  silenced: {
    id: 'silenced', damage: 17, rate: 0.34, spread: 0.035, range: 520,
    speed: 1150, pellets: 1, noise: 130, mag: Infinity, tier: 0, kick: 2,
  },
  pistol: {
    id: 'pistol', damage: 26, rate: 0.28, spread: 0.05, range: 640,
    speed: 1250, pellets: 1, noise: 580, mag: 54, tier: 1, kick: 3,
  },
  revolver: {
    id: 'revolver', damage: 52, rate: 0.62, spread: 0.03, range: 700,
    speed: 1400, pellets: 1, noise: 780, mag: 24, tier: 1, kick: 7,
  },
  smg: {
    id: 'smg', damage: 16, rate: 0.085, spread: 0.115, range: 560,
    speed: 1350, pellets: 1, noise: 620, mag: 190, tier: 2, kick: 2,
  },
  shotgun: {
    id: 'shotgun', damage: 14, rate: 0.74, spread: 0.2, range: 380,
    speed: 1050, pellets: 8, noise: 800, mag: 30, tier: 2, kick: 9,
  },
  rifle: {
    id: 'rifle', damage: 44, rate: 0.4, spread: 0.022, range: 920,
    speed: 1700, pellets: 1, noise: 720, mag: 72, tier: 3, kick: 5,
  },
  /**
   * The tranquilliser, and the only gun here that does no damage at all.
   *
   * It drops whoever it touches, whatever is left in him — which is the entire
   * point, and the reason it was rewritten. As a damage weapon it was 120 a
   * dart, which one-shot a guard on floor 1 and stopped one-shotting anybody
   * around floor 17, where guard health passes it: a "silent takedown" that
   * quietly turns into the worst gun in the game exactly when you need it.
   * A takedown does not care how big the man is, so now it does not.
   */
  dart: {
    id: 'dart', damage: 0, tranq: true, rate: 1.3, spread: 0.015, range: 380,
    speed: 820, pellets: 1, noise: 60, mag: 6, tier: 1, kick: 1,
  },
  lmg: {
    id: 'lmg', damage: 19, rate: 0.075, spread: 0.16, range: 640,
    speed: 1400, pellets: 1, noise: 880, mag: 260, tier: 3, kick: 4,
  },
  sniper: {
    id: 'sniper', damage: 130, rate: 1.15, spread: 0.004, range: 1500,
    speed: 2400, pellets: 1, noise: 900, mag: 14, tier: 3, kick: 12,
  },
};

export const START_WEAPON = 'silenced';

/** Everything a guard is issued, in the order the floors hand them out. */
const GUARD_GUNS = ['pistol', 'pistol', 'smg', 'shotgun', 'rifle', 'lmg'];

/** Guards are never issued the two guns that make *you* dangerous quietly. */
const NEVER_ISSUED = new Set(['silenced', 'dart', 'sniper']);

/** What the guards on this floor are carrying — `i` spreads it inside a shift. */
export function guardGun(tier, i = 0) {
  const id = GUARD_GUNS[Math.min(GUARD_GUNS.length - 1, tier + (i % 2 === 0 ? 0 : 1))];
  return NEVER_ISSUED.has(id) ? 'pistol' : id;
}

/**
 * What is worth leaving on the floor of a given tier. Nothing here ever offers
 * the silenced pistol: you already have it, and finding your own gun in a
 * drawer is the least interesting thing a drawer can hold.
 */
export function lootGuns(tier) {
  return Object.values(WEAPONS).filter((w) => w.tier > 0 && w.tier <= tier + 1).map((w) => w.id);
}

export function createLoadout(id = START_WEAPON) {
  const w = WEAPONS[id];
  return { id, ammo: w.mag, cool: 0 };
}

/** A gun on the ground carries what is left in it, so a swap has a cost. */
export function droppedAmmo(id, rng, share = 0.5) {
  const w = WEAPONS[id];
  if (!Number.isFinite(w.mag)) return Infinity;
  return Math.max(1, Math.round(w.mag * share * (0.6 + rng() * 0.8)));
}
