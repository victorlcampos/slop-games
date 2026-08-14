// The record: the handful of numbers a game keeps between runs.
//
// Three games had written the same twenty lines — load a save, clamp every
// field a hand-edited file could have broken, keep the highest of each, count
// the runs, and work out whether the card says "new record". Iron Rain and
// Infinite Fortress had also written the same *bug* in it, which is the real
// reason this is one module now:
//
//   best = vault.save({ ... })      // ← `save()` answers WHETHER it wrote
//
// It hands back `true`, not the state. In the Fortress `best.money` then threw
// on a screen that was already frozen; in Iron Rain the card printed
// "best: undefined · NaN:NaN" and every later run compared against `undefined`,
// so `Math.max` gave `NaN`, `JSON.stringify` wrote `null`, and the record
// silently reset itself on every death. Here the new record is what `file()`
// returns and the vault is only ever asked to persist it — the mistake has no
// shape to take.
//
// Two shapes of record, because that is what the games actually keep:
//
//   axes: { score: { round: true }, time: {} }   named fields, declared up front
//   open: true                                   any key is a field (per mode,
//                                                per stage — the set is not
//                                                known when the game is written)

import { createSave } from './save.js';

const RESERVED = new Set(['version', 'updatedAt', 'runs']);

/**
 * Everything the readers below need, from whatever the game declared. It is
 * idempotent on purpose — the exported functions take a config or a spec and
 * run it through here either way, so there is no second shape to get wrong.
 */
function specOf(cfg = {}) {
  const axes = {};
  for (const [name, opt] of Object.entries(cfg.axes || {})) {
    axes[name] = {
      round: !!(opt && opt.round),
      // `race: false` keeps a number without letting it announce a record —
      // the Fortress counts silent floors but does not celebrate one
      race: !opt || opt.race !== false,
      min: opt && Number.isFinite(opt.min) ? opt.min : 0,
    };
  }
  return {
    axes,
    open: !!cfg.open,
    runs: cfg.runs !== false,
    extra: cfg.extra || {},
  };
}

/** The options for a field the game never declared (only in `open` mode). */
const OPEN_AXIS = { round: false, race: true, min: 0 };
/** How the run counter is read: a count is a whole number, and never a record. */
const COUNT = { round: true, race: false, min: 0 };

function axisOf(spec, name) {
  if (spec.axes[name]) return spec.axes[name];
  return spec.open && !RESERVED.has(name) && !(name in spec.extra) ? OPEN_AXIS : null;
}

/** A number, or the axis's floor. Anything else off a save is not a record. */
function num(value, axis) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < axis.min) return axis.min;
  return axis.round ? Math.round(n) : n;
}

/** A player who has never finished a run. */
export function freshRecord(spec) {
  const s = specOf(spec);
  const out = {};
  for (const [name, axis] of Object.entries(s.axes)) out[name] = axis.min;
  for (const [name, fix] of Object.entries(s.extra)) out[name] = fix(undefined);
  if (s.runs) out.runs = 0;
  return out;
}

/**
 * Never trust what comes off disk — nor what is left in a variable. Anything
 * that is not a finite number goes back to the floor, and a value that is not
 * even an object (the boolean `true` the old bug left behind) reads as a fresh
 * record instead of poisoning the card that draws it.
 */
export function normalizeRecord(spec, raw, base) {
  const s = specOf(spec);
  const out = base || freshRecord(s);
  if (!raw || typeof raw !== 'object') return out;
  for (const name of Object.keys(out)) {
    const axis = axisOf(s, name);
    if (axis) out[name] = num(raw[name], axis);
  }
  if (s.runs) out.runs = num(raw.runs, COUNT);
  for (const [name, fix] of Object.entries(s.extra)) out[name] = fix(raw[name]);
  // in `open` mode the fields are whatever has been played, so a save carries
  // keys this build has never heard of — a mode retired and brought back must
  // find its record still there
  if (s.open) {
    for (const [name, value] of Object.entries(raw)) {
      if (name in out || RESERVED.has(name) || name === 'updatedAt') continue;
      if (Number.isFinite(value)) out[name] = num(value, OPEN_AXIS);
    }
  }
  return out;
}

/**
 * The record after a run, and whether the run beat it.
 *
 * Every axis is kept on its own: a lucky score does not erase a long life. The
 * card says "new record" when *any* racing axis moved, and `beaten` says which
 * ones — a game that wants to name it ("new best in this mode") has it there.
 *
 * @returns {{ best: object, previous: object, record: boolean, beaten: string[] }}
 */
export function mergeRecord(spec, prev, result) {
  const s = specOf(spec);
  const before = normalizeRecord(s, prev);
  const best = { ...before };
  const beaten = [];
  const run = result && typeof result === 'object' ? result : {};

  const names = new Set(Object.keys(s.axes));
  if (s.open) for (const name of Object.keys(run)) if (axisOf(s, name)) names.add(name);

  for (const name of names) {
    const axis = axisOf(s, name) || OPEN_AXIS;
    // a run that never reports an axis leaves it alone; reporting a worse
    // number is the ordinary case and also leaves it alone
    if (!(name in run)) continue;
    const value = num(run[name], axis);
    if (value > (before[name] ?? axis.min)) {
      best[name] = value;
      if (axis.race) beaten.push(name);
    }
  }
  if (s.runs) best.runs = before.runs + 1;

  return { best, previous: before, record: beaten.length > 0, beaten };
}

/**
 * The record with somewhere to live: the same spec, plus the vault under it.
 *
 * @param {object} cfg
 * @param {string} cfg.game       short identifier, as in `createSave`
 * @param {object} [cfg.axes]     field -> { round, race, min }
 * @param {boolean} [cfg.open]    any field is an axis (per mode, per stage)
 * @param {boolean} [cfg.runs]    count the runs filed (default true)
 * @param {object} [cfg.extra]    field -> normaliser, carried but never raced
 */
export function createRecords(cfg) {
  const spec = specOf(cfg);
  const vault = createSave({
    game: cfg.game,
    version: cfg.version || 1,
    key: cfg.key || `${cfg.game}.best.v1`,
    i18n: cfg.i18n || null,
    initial: () => freshRecord(spec),
    normalize: (raw, base) => normalizeRecord(spec, raw, base),
  });

  // through normalisation once more, so what the game holds is the record and
  // nothing else: `load()` stamps a `version` on what it returns, and a field
  // the HUD is not expecting has a way of ending up on screen
  let best = normalizeRecord(spec, vault.load());

  const api = {
    spec,
    vault,
    /** The record as it stands. Always an object, always numbers. */
    get best() {
      return best;
    },

    /**
     * File a finished run. Returns what the end-of-run card needs, and the
     * record it returns is the record — nothing here hands back a boolean.
     */
    file(result) {
      const merged = mergeRecord(spec, best, result);
      best = merged.best;
      // a copy, so the vault stamping version/updatedAt does not leave them on
      // the object the HUD is drawing
      vault.save({ ...best });
      return merged;
    },

    /**
     * Set what a run does not decide — a cutscene seen, a tutorial dismissed.
     * An axis passed through here still keeps its highest and does not count as
     * a run: a record is only ever beaten by playing.
     */
    set(fields) {
      const merged = mergeRecord(spec, best, fields);
      const next = merged.best;
      if (spec.runs) next.runs = merged.previous.runs;
      for (const [name, fix] of Object.entries(spec.extra)) {
        if (fields && name in fields) next[name] = fix(fields[name]);
      }
      best = next;
      vault.save({ ...best });
      return best;
    },

    clear() {
      vault.clear();
      best = freshRecord(spec);
      return best;
    },
  };

  return api;
}
