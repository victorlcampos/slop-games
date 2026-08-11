// The game's save. The mechanics (localStorage, files, normalisation,
// versioning) come from slopkit; what's left here is what belongs to this game:
// the format and the sanitising rules for each field.

import { createSave } from 'slopkit/save';
import { STARTER_DECK, BY_ID, MAX_LEVEL } from './data/animals.js';
import { i18n } from './i18n.js';

/** A brand new save. It is also the template of what has to exist. */
export function freshSave() {
  return {
    version: 4,
    coins: 0,
    deck: [...STARTER_DECK],
    // training level of each card; absent = level 1
    levels: {},
    currentStage: 1,
    won: [],
    humans: 0,
    sawIntro: false,
    records: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Fixes whatever turns up: an old-version save, a hand-edited file, a field
 * with the wrong type. At worst a field is lost, never the run.
 *
 * Version 4 renamed every card id from Portuguese to English (`esquilo` became
 * `squirrel`). Unknown ids are dropped rather than trusted — a deck entry with
 * no card behind it would crash the shop the moment it tried to draw one. A
 * save from before the rename keeps its coins and its progress and goes back to
 * the starter deck, which is the mildest outcome available.
 */
function normalize(raw, base) {
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, ...raw };
  s.coins = Number.isFinite(s.coins) ? Math.max(0, Math.floor(s.coins)) : 0;

  const known = Array.isArray(s.deck) ? [...new Set(s.deck)].filter((id) => BY_ID[id]) : [];
  s.deck = known.length ? known : [...STARTER_DECK];

  s.won = Array.isArray(s.won) ? s.won.filter((n) => Number.isFinite(n)) : [];
  s.currentStage = Number.isFinite(s.currentStage) ? Math.min(Math.max(1, s.currentStage), 10) : 1;
  s.humans = Number.isFinite(s.humans) ? Math.max(0, s.humans) : 0;
  s.records = s.records && typeof s.records === 'object' ? s.records : {};
  s.sawIntro = !!s.sawIntro;

  // levels: a v2 save had no such field, and nothing stops a hand-edited file
  // from carrying level 99 on a card the player doesn't even own
  const levels = {};
  if (s.levels && typeof s.levels === 'object') {
    for (const [id, n] of Object.entries(s.levels)) {
      if (!s.deck.includes(id)) continue;
      if (!Number.isFinite(n)) continue;
      levels[id] = Math.min(Math.max(1, Math.floor(n)), MAX_LEVEL);
    }
  }
  s.levels = levels;
  return s;
}

const vault = createSave({
  game: 'animais-vs-monstros',
  version: 4,
  initial: freshSave,
  normalize,
  key: 'animais-vs-monstros:save',
  i18n,
});

export const load = () => vault.load();
export const save = (state) => vault.save(state);
export const clear = () => vault.clear();

export function download(state) {
  return vault.exportFile(state, {
    name: `animais-vs-monstros-stage${state.currentStage}-${new Date().toISOString().slice(0, 10)}.json`,
  });
}

export function importFile() {
  return vault.importFile(document.getElementById('file'));
}
