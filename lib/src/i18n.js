// Two languages, one dictionary, no build step.
//
// Every game here ships in Portuguese and English. The dictionary is keyed by
// phrase, not by language:
//
//   const dict = {
//     play:  { en: 'Play',         pt: 'Jogar' },
//     score: { en: 'Score: {n}',   pt: 'Pontos: {n}' },
//   };
//
// That shape is deliberate. The obvious alternative — one object per language —
// lets a key exist in `pt` and quietly not exist in `en`, and you only find out
// when a player switches flags and sees a raw key. Side by side, a missing
// translation is visible while you type the line, and `missingKeys()` turns it
// into a test instead of a bug report.
//
// The chosen language lives under a key shared by the whole catalog, so picking
// English on the index page carries into every game the player opens from it.

import { LANGS, FALLBACK } from './langs.js';
import { KIT_PHRASES } from './phrases.js';

export { LANGS, FALLBACK };

const KEY = 'slop:lang';

/**
 * Which language to start in. Order: what the player chose last, what the
 * browser asks for, then the fallback.
 *
 * Browsers report tags like `pt-BR` and `en-US`, so we compare on the primary
 * subtag — `pt-PT` is still Portuguese even though we only ship one variant.
 *
 * @param {string|null} stored  previous choice (null if never chosen)
 * @param {string[]} preferred  navigator.languages, or anything shaped like it
 */
export function pickLang(stored, preferred = [], fallback = FALLBACK) {
  if (LANGS.includes(stored)) return stored;
  for (const tag of preferred) {
    const primary = String(tag || '').toLowerCase().split('-')[0];
    if (LANGS.includes(primary)) return primary;
  }
  return fallback;
}

/**
 * Fill `{name}` placeholders. Anything the caller didn't supply is left alone —
 * a visible `{n}` in the UI is a better bug report than a silent `undefined`.
 */
export function interpolate(text, values) {
  if (!values) return text;
  return String(text).replace(/\{(\w+)\}/g, (whole, name) =>
    name in values ? String(values[name]) : whole
  );
}

/**
 * @param {object} cfg
 * @param {object} cfg.dict        { key: { pt, en } } — see the note above
 * @param {string} [cfg.fallback]  language to fall back to (default 'en')
 * @param {string} [cfg.key]       storage key (default: shared by the catalog)
 * @param {string[]} [cfg.preferred] override navigator.languages (for tests)
 */
export function createI18n(cfg = {}) {
  const { fallback = FALLBACK, key = KEY } = cfg;
  // the kit's own phrases go underneath: a game that declares the same key wins
  const dict = { ...KIT_PHRASES, ...(cfg.dict || {}) };

  const preferred =
    cfg.preferred || (typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : []);

  let stored = null;
  try {
    stored = localStorage.getItem(key);
  } catch {
    /* private mode: the choice just won't survive a reload */
  }

  let lang = pickLang(stored, preferred, fallback);
  const listeners = new Set();

  function persist() {
    try {
      localStorage.setItem(key, lang);
    } catch {
      /* private mode */
    }
  }

  /**
   * Look a phrase up. Returns the key itself when there is no entry, which
   * makes the hole obvious on screen instead of rendering `undefined`.
   *
   * Plural forms are a two-item array — `['1 life', '{n} lives']` — picked by
   * `values.n`. Portuguese and English happen to share the same one/other
   * split, so a single rule covers both languages we ship.
   */
  function t(id, values) {
    const entry = dict[id];
    if (!entry) {
      if (typeof console !== 'undefined') console.warn(`i18n: no entry for "${id}"`);
      return id;
    }
    let text = entry[lang];
    if (text === undefined) text = entry[fallback];
    if (text === undefined) return id;
    if (Array.isArray(text)) text = text[values && values.n === 1 ? 0 : 1];
    return interpolate(text, values);
  }

  const api = {
    t,

    get lang() {
      return lang;
    },

    get langs() {
      return LANGS.slice();
    },

    /**
     * The phrases as they stand, kit defaults included. Exposed so a test can
     * run `missingKeys` against the dictionary a game actually ships — a
     * one-sided entry never shows a raw key on screen, because `t()` falls back
     * to the other language, so nothing else would ever notice.
     */
    get dict() {
      return { ...dict };
    },

    /** Swap languages. No-op for an unknown tag or the language already on. */
    set(next) {
      if (!LANGS.includes(next) || next === lang) return lang;
      lang = next;
      persist();
      if (typeof document !== 'undefined') document.documentElement.lang = lang;
      for (const fn of listeners) fn(lang, api);
      return lang;
    },

    /** The flag button flips between the two; handy for a single toggle. */
    toggle() {
      return api.set(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]);
    },

    /** Returns an unsubscribe function. */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Merge more phrases in — lets a game split its dictionary by screen. */
    extend(more) {
      Object.assign(dict, more);
      return api;
    },

    /** Every key missing a translation. Exists so a test can fail on it. */
    missingKeys() {
      const holes = [];
      for (const [id, entry] of Object.entries(dict)) {
        for (const l of LANGS) if (entry[l] === undefined) holes.push(`${id}.${l}`);
      }
      return holes;
    },
  };

  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  return api;
}

/**
 * The same check as `missingKeys`, but on a bare dictionary — so a game can
 * assert its own phrase table in a unit test without booting a browser.
 */
export function missingKeys(dict, langs = LANGS) {
  const holes = [];
  for (const [id, entry] of Object.entries(dict || {})) {
    for (const l of langs) if (!entry || entry[l] === undefined) holes.push(`${id}.${l}`);
  }
  return holes;
}
