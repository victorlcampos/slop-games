// A run: which crown you picked, how far up the map you are, the coins you have
// not spent yet, and the castle you designed.
//
// The castle is the thing that carries. Winning a siege does not upgrade a
// weapon or unlock a perk — it pays you, and what you do with the money is go
// back to the workshop and make the same castle a little harder to open. So the
// save is small, and every field in it is something the player chose.

import { FACTIONS, LEVELS, START_COINS } from './config.js';
import { blueprintCost, normalizeBlueprint } from './castles.js';

export function freshRun(faction = 'knights') {
  return { faction, level: 0, coins: START_COINS, blueprint: null, wins: 0, losses: 0, best: 0 };
}

export function normalizeRun(raw, base) {
  if (!raw || typeof raw !== 'object') return base;
  const num = (v, d, lo = 0, hi = Infinity) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
  const bp = raw.blueprint ? normalizeBlueprint(raw.blueprint) : null;
  return {
    ...base,
    faction: FACTIONS.includes(raw.faction) ? raw.faction : base.faction,
    level: num(raw.level, 0, 0, LEVELS.length - 1),
    // a save from a build where a wall was cheaper must not leave you in debt:
    // the coins are re-read as "what the castle cost plus what is left over"
    coins: Math.max(bp ? blueprintCost(bp) : 0, num(raw.coins, START_COINS, 0, 99999)),
    blueprint: bp,
    wins: num(raw.wins, 0),
    losses: num(raw.losses, 0),
    best: num(raw.best, 0, 0, LEVELS.length),
  };
}

export const levelOf = (run) => LEVELS[Math.min(run.level, LEVELS.length - 1)];

/**
 * What a win pays. The level's own purse, plus a bounty on every wall of yours
 * still standing — which is the game quietly saying that surviving intact is
 * worth more than trading shot for shot.
 */
export function reward(level, castle) {
  const standing = castle.blocks().filter((b) => b.m !== 'king').length;
  return Math.round(level.reward + standing * 3);
}
