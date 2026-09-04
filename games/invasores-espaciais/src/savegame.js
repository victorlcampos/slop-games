// The vault: one best per machine under a single key.
//
// A save from the swarm-only days (a lone `score`) migrates into the swarm
// slot instead of breaking; a machine added tomorrow loads as zero. Every
// read goes through `normalize` — never trust what you read off disk.

import { createSave } from 'slopkit/save';
import { gameIds, blankBests } from './registry.js';

export const SAVE_KEY = 'invasores-espaciais.best.v1';

export function initial() {
  return { bests: blankBests(), runs: 0 };
}

export function normalize(raw, base) {
  if (!raw || typeof raw !== 'object') return base;
  const bests = blankBests();
  // v1 kept a single score for the swarm-only days — it moves over, not out
  if (raw.bests && typeof raw.bests === 'object') {
    for (const id of gameIds()) {
      const v = raw.bests[id];
      if (Number.isFinite(v) && v >= 0) bests[id] = v;
    }
  } else if (Number.isFinite(raw.score) && raw.score >= 0) {
    bests.swarm = raw.score;
  }
  const runs = Number.isFinite(raw.runs) && raw.runs >= 0 ? raw.runs : 0;
  return { bests, runs };
}

export function createVault() {
  return createSave({
    game: 'invasores-espaciais',
    version: 2,
    key: SAVE_KEY,
    initial,
    normalize,
  });
}
