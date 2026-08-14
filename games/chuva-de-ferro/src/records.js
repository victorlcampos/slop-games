// The record: what survives a run, and what the end-of-run card reads.
//
// It is a module of its own because it is a rule, and a rule gets a test. The
// bug that put it here: `vault.save()` answers *whether it wrote*, it does not
// hand the state back — so `best = vault.save(...)` made `best` the boolean
// `true`, and the card underneath printed `best.score` as `undefined` and
// `clock(best.time)` as `NaN:NaN`. Worse than the wrong line: every later run
// then compared against `undefined`, so `Math.max` produced `NaN`, JSON wrote
// `null`, and the record reset itself on every death.
//
// So the new record is computed here and handed back. The vault is only ever
// asked to persist it.

/** A player who has never finished a run. */
export function freshBest() {
  return { score: 0, time: 0, runs: 0 };
}

/**
 * Never trust what comes off disk (or out of a stale variable): anything that
 * is not a finite, non-negative number goes back to zero. `true` is not an
 * object, so even the shape the old bug left behind normalises to a fresh
 * record instead of poisoning the card.
 */
export function normalizeBest(raw, base = freshBest()) {
  if (!raw || typeof raw !== 'object') return base;
  const n = (v, d) => (Number.isFinite(v) && v >= 0 ? v : d);
  return { ...base, score: n(raw.score, 0), time: n(raw.time, 0), runs: n(raw.runs, 0) };
}

/**
 * The record after a run, plus whether this run beat the old one. Both axes
 * count: the card says "new record" for a bigger score *or* a longer life, and
 * each is kept on its own — a lucky score does not erase a long run.
 *
 * @returns {{ best: {score:number,time:number,runs:number}, record: boolean }}
 */
export function mergeBest(best, result) {
  const prev = normalizeBest(best);
  const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
  const score = Math.round(num(result && result.score));
  const time = num(result && result.time);
  return {
    best: {
      score: Math.max(prev.score, score),
      time: Math.max(prev.time, time),
      runs: prev.runs + 1,
    },
    record: score > prev.score || time > prev.time,
  };
}
