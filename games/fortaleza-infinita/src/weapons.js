// The guns — alien tools, human hands.
//
// Two axes, and only two. **Noise** decides whether the Fortress finds out, and
// it is the one you are choosing between while the alarm is off. **Weight of
// fire** decides whether you survive the next thirty seconds, and it is the
// only thing that matters once the alarm is on.
//
// The first draft got the second axis wrong: the whisper coil was 50 damage
// a second and everything else was 85 to 250, so a gun that brought four
// sentinels running was worth roughly double what you already had. Nobody sane
// picked one up. The starting coil is a *takedown tool* now — barely a third of
// what a real gun does — and the real guns are three to seven times it, plus
// something each that no other gun does.

export const WEAPONS = {
  /**
   * The gun you always have: a magnetic coil pried from a fallen sentinel.
   * Nothing burns, so nothing bangs — quiet enough to use in the next room,
   * weak enough that using it on two sentinels at once is a decision you regret.
   */
  whisper: {
    id: 'whisper', damage: 14, rate: 0.4, spread: 0.035, range: 520,
    speed: 1150, pellets: 1, noise: 130, mag: Infinity, tier: 0, kick: 2,
  },

  /** The stasis dart: no damage at all, and it freezes whoever it touches. */
  stasis: {
    id: 'stasis', damage: 0, tranq: true, rate: 1.3, spread: 0.015, range: 380,
    speed: 820, pellets: 1, noise: 60, mag: 6, tier: 1, kick: 1,
  },

  blaster: {
    id: 'blaster', damage: 30, rate: 0.24, spread: 0.05, range: 640,
    speed: 1250, pellets: 1, noise: 580, mag: 80, tier: 1, kick: 3,
  },

  /** One enormous bolt, and it staggers him: he loses his aim and has to start over. */
  ioncannon: {
    id: 'ioncannon', damage: 72, rate: 0.55, spread: 0.025, range: 700,
    speed: 1400, pellets: 1, noise: 780, mag: 36, tier: 1, kick: 7, stagger: 0.8,
  },

  needler: {
    id: 'needler', damage: 20, rate: 0.075, spread: 0.115, range: 560,
    speed: 1350, pellets: 1, noise: 620, mag: 240, tier: 2, kick: 2,
  },

  /** Everything at once, at arm's length, and it shoves him off you. */
  shockwave: {
    id: 'shockwave', damage: 17, rate: 0.62, spread: 0.2, range: 380,
    speed: 1050, pellets: 8, noise: 800, mag: 44, tier: 2, kick: 9,
    heavy: 0.82, stagger: 0.6,
  },

  /** Accurate at any range, and it burns through the first sentinel to reach the second. */
  lance: {
    id: 'lance', damage: 55, rate: 0.34, spread: 0.02, range: 920,
    speed: 1700, pellets: 1, noise: 720, mag: 100, tier: 3, kick: 5, pierce: 1,
  },

  /** You cannot move properly while it is firing, and nothing else is this loud. */
  shredder: {
    id: 'shredder', damage: 24, rate: 0.07, spread: 0.17, range: 640,
    speed: 1400, pellets: 1, noise: 900, mag: 320, tier: 3, kick: 4, heavy: 0.55,
  },

  /** Through three sentinels and half the ring, once a second. */
  railgun: {
    id: 'railgun', damage: 200, rate: 1.0, spread: 0.003, range: 1500,
    speed: 2400, pellets: 1, noise: 900, mag: 20, tier: 3, kick: 12, pierce: 3, heavy: 0.8,
  },
};

export const START_WEAPON = 'whisper';

/** Everything a sentinel is issued, in the order the rings hand them out. */
const GUARD_GUNS = ['blaster', 'blaster', 'needler', 'shockwave', 'lance', 'shredder'];

/** Sentinels are never issued the three guns that make *you* dangerous. */
const NEVER_ISSUED = new Set(['whisper', 'stasis', 'railgun']);

export function guardGun(tier, i = 0) {
  const id = GUARD_GUNS[Math.min(GUARD_GUNS.length - 1, tier + (i % 2 === 0 ? 0 : 1))];
  return NEVER_ISSUED.has(id) ? 'blaster' : id;
}

/**
 * What is worth leaving on the floor of a given tier. Nothing here ever offers
 * the whisper coil: you already have it, and finding your own gun in a
 * locker is the least interesting thing a locker can hold.
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

/** Damage a second, which is the number the guns are balanced against. */
export const dps = (w) => (w.damage * (w.pellets || 1)) / w.rate;
