// What goes in the vault: the current town (if one is standing) and the best
// run so far. Every read passes through `normalize` — an old or hand-edited
// save loses a field at worst, never the run (CLAUDE.md, section 2b).

export function freshSave() {
  return {
    seed: 1 + Math.floor(Math.random() * 999999),
    state: null, // the serialized world, or null when no town is underway
    best: { years: 0, kills: 0 },
    sawIntro: false,
  };
}

export function normalize(raw, base) {
  const s = { ...base, ...(raw || {}) };
  if (!Number.isFinite(s.seed) || s.seed <= 0) s.seed = base.seed;
  s.best = { years: 0, kills: 0, ...(s.best || {}) };
  s.best.years = Math.max(0, Math.floor(Number(s.best.years) || 0));
  s.best.kills = Math.max(0, Math.floor(Number(s.best.kills) || 0));
  if (s.state !== null && typeof s.state !== 'object') s.state = null;
  s.sawIntro = !!s.sawIntro;
  return s;
}

/** Fold a finished (or abandoned) run into the record book. */
export function bank(save, world) {
  save.best.years = Math.max(save.best.years, world.stats.years);
  save.best.kills = Math.max(save.best.kills, world.stats.kills);
  return save;
}

/** What the menu offers, which is only ever a question of whether a town is
 *  standing. With one saved, "found the village" and "start over" were the same
 *  button wearing two labels — both threw the saved town away — and the primary
 *  one did it silently to a player who only meant to keep playing. So a standing
 *  town hides "found the village": going back to it is the primary choice, and
 *  founding another is the ghost button that says what it costs. */
export function menuButtons(save) {
  const standing = !!(save && save.state);
  return { start: !standing, resume: standing, newRun: standing };
}
