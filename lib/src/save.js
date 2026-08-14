// A save file that survives the game's next version.
//
// Two ideas, each taken from a game in this repo:
//
// 1. **One format only** (from Zoo Tycoon): the same snapshot serves the
//    autosave and the exported file. Two formats become two saves drifting
//    apart, and the bug only shows up the day somebody imports one.
// 2. **Normalise instead of trusting** (from Animals vs Monsters): every save
//    read goes through a function that fills in what's missing and fixes what's
//    wrong. An old save must never break the game — at worst you lose a new
//    field, never the run.
//
// The exported file carries the game's name, so importing the wrong save gives
// a clear error instead of corrupted state.

import { FALLBACK } from './langs.js';
import { KIT_PHRASES } from './phrases.js';

const NOTHING = () => {};

/** The kit's own phrases, with or without an i18n instance to route them through.
 *  Without one they come out in the fallback language, which is English. */
function speaker(i18n) {
  return (id, values) => {
    if (i18n) return i18n.t(id, values);
    const entry = KIT_PHRASES[id];
    const text = entry ? entry[FALLBACK] : id;
    return values ? String(text).replace(/\{(\w+)\}/g, (w, k) => (k in values ? values[k] : w)) : text;
  };
}

/**
 * @param {object} cfg
 * @param {string} cfg.game        short identifier, used in the key and the file
 * @param {number} cfg.version     format version
 * @param {function} cfg.initial   returns a brand new save
 * @param {function} [cfg.normalize] (raw, base) => valid save
 * @param {function} [cfg.onNotice]  (message, kind) for on-screen feedback
 * @param {object} [cfg.i18n]        so the notices speak the player's language
 */
export function createSave(cfg) {
  const {
    game,
    version = 1,
    initial,
    normalize = (raw, base) => ({ ...base, ...(raw || {}) }),
    onNotice = NOTHING,
    key = `${game}:save`,
    i18n = null,
  } = cfg;

  if (!game) throw new Error('createSave: missing the game name');
  if (typeof initial !== 'function') throw new Error('createSave: `initial` must be a function');

  const say = speaker(i18n);

  /** Run the raw value through normalisation and stamp version/game on it. */
  function sanitize(raw) {
    const base = initial();
    const s = normalize(raw, base) || base;
    s.version = version;
    return s;
  }

  const api = {
    key,
    game,
    version,

    fresh() {
      return sanitize(null);
    },

    load() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return api.fresh();
        return sanitize(JSON.parse(raw));
      } catch {
        // storage blocked or broken JSON: better to start over than to hang
        return api.fresh();
      }
    },

    /**
     * Persist a snapshot. Returns **whether it wrote**, not the state — two
     * games have already written `best = vault.save(...)` and put the boolean
     * `true` where their record should be. Keep the state you built.
     */
    save(state, { quiet = true } = {}) {
      try {
        state.version = version;
        state.updatedAt = new Date().toISOString();
        localStorage.setItem(key, JSON.stringify(state));
        if (!quiet) onNotice(say('slop.saved'), 'good');
        return true;
      } catch (err) {
        // private mode or quota exceeded: the game goes on, it just won't persist
        if (!quiet) onNotice(say('slop.saveFailed', { error: err.message }), 'bad');
        return false;
      }
    },

    clear() {
      try {
        localStorage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },

    /** The autosave's very snapshot, now as a file. */
    exportFile(state, { name } = {}) {
      const data = JSON.stringify({ ...state, game, version }, null, 2);
      const file = name || `${game}-${new Date().toISOString().slice(0, 10)}.json`;
      const ok = downloadText(file, data, 'application/json');
      onNotice(say(ok ? 'slop.downloaded' : 'slop.downloadFailed'), ok ? 'good' : 'bad');
      return ok;
    },

    /**
     * Read a file the player picked. Refuses another game's save — a clear
     * error beats corrupted state.
     */
    async importFile(input) {
      const text = await readTextFile(input, say);
      let raw;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new Error(say('slop.unreadableFile'));
      }
      if (raw.game && raw.game !== game) {
        throw new Error(say('slop.wrongGame', { game: raw.game }));
      }
      return sanitize(raw);
    },

    /** Apply a snapshot that was already read (from a file or anywhere else). */
    apply(raw) {
      return sanitize(raw);
    },
  };

  return api;
}

// --------------------------------------------------------------------- files

/**
 * Download a string as a file. The `revokeObjectURL` waits on purpose: in
 * Safari, revoking too early cancels a download that hasn't even started.
 */
export function downloadText(name, contents, mime = 'application/json') {
  try {
    const blob = new Blob([contents], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open the file picker and resolve with the chosen text. Accepts an existing
 * `<input type=file>` or makes a throwaway one.
 */
export function readTextFile(input, say = speaker(null)) {
  return new Promise((resolve, reject) => {
    const el =
      input || Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });

    const onPick = () => {
      const file = el.files && el.files[0];
      el.removeEventListener('change', onPick);
      el.value = '';
      if (!file) return reject(new Error(say('slop.nothingChosen')));

      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(say('slop.readFailed')));
      reader.readAsText(file);
    };

    el.addEventListener('change', onPick);
    el.click();
  });
}
