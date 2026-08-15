// The armoury, and the shards that pay for it.
//
// Two rules hold this together, and both exist to protect something that took a
// lot of measuring to get right.
//
// **The bought guns are the same guns for both sides.** The two starting guns
// are the one place the sides differ, and they are tuned against each other
// until neither wins a fight (see `GUNS` in config.js). An armoury with a
// per-side table would have to be tuned twice and would drift on the first
// edit, so there is one table here and each side only draws and sounds it
// differently.
//
// **Nothing you buy is a straight upgrade.** Every one of them beats the
// starting gun at something and loses to it at something else, and every one of
// them runs out. When the last round is gone the gun is gone and you are back
// on the one you never have to think about — which is what stops a good run
// turning into a permanent advantage, and what makes the shards worth spending
// again.

/** What a body earns. A kill pays for a third of the cheapest gun. */
export const REWARD = {
  kill: 100,
  carrierKill: 80,                     // and a bonus for stopping a flag
  capture: 200,
  rescue: 100,                         // walking your own flag back
};

/**
 * The three guns on sale, in the order they are offered.
 *
 * `ammo` is what a purchase carries. Buying one you already hold simply fills
 * it up again — which is the sink the economy needs, because a squad that
 * cannot spend its shards has no reason to leave its own half.
 */
export const ARMOURY = [
  {
    id: 'scatter',
    cost: 250,
    ammo: 24,
    damage: 7, pellets: 5, rate: 0.55, spread: 0.17, range: 420, speed: 1150, kick: 9,
    // everything at once, at arm's length: two shells put a body down inside a
    // corridor and it is a peashooter across a hall
  },
  {
    id: 'repeater',
    cost: 350,
    ammo: 130,
    damage: 6, pellets: 1, rate: 0.07, spread: 0.075, range: 820, speed: 1500, kick: 2,
    // the most damage a second in the game, sprayed: it wins a fight it starts
    // and wastes half its magazine doing it
  },
  {
    id: 'lance',
    cost: 450,
    ammo: 14,
    damage: 40, pellets: 1, rate: 0.75, spread: 0.008, range: 1300, speed: 2300, kick: 6, pierce: 1,
    // three shots a body, across the whole field, and through the first man to
    // reach the second — with three quarters of a second between them, which is
    // a long time to be standing still
  },
];

export const byId = (id) => ARMOURY.find((w) => w.id === id) || null;

/** What a body starts every life with: its own side's gun, and no clock on it. */
export const STANDARD = 'standard';

export const createLoadout = () => ({ id: STANDARD, ammo: Infinity });

/** Damage a second, which is the number the guns are compared on. */
export const dps = (w) => (w.damage * (w.pellets || 1)) / w.rate;

/**
 * Is the gun on the deck worth more than the one in your hands?
 *
 * A body swaps up and never down. Without the test a soldier walking over the
 * scatter he just dropped picks it back up with two shells in it and drops his
 * full lance doing it, and the field turns into a game of pass the parcel.
 */
export const worth = (id) => (id === STANDARD ? 0 : byId(id).cost);
