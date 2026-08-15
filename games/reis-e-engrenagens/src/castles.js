// The enemy's castle, and the sanity check every castle goes through.
//
// The four shapes are not decoration: each one is a different question. The
// wall dares you to go over it, the tower dares you to knock it down, the
// bunker hides the king under everything the budget could buy, and the keep is
// all three at once with iron in the walls.
//
// They are built **column by column, from the ground up**, which is the cheapest
// possible guarantee that the result stands: a cell whose neighbour below is
// filled can never be unsupported. Whatever the budget cuts off is the top of
// the last column, never a hole in the middle of one.

import { COLS, ROWS, makeRng } from './config.js';
import { MATERIALS } from './materials.js';
import { createCastle, unsupported } from './structure.js';

/**
 * The silhouettes. `front` is column 0 — the side facing across the field —
 * and the king lives at the back, which is where the numbers get small.
 */
const STYLES = {
  wall: { profile: [6, 6, 2, 3, 4, 4, 3], kingCol: 5 },
  tower: { profile: [3, 3, 4, 7, 8, 5, 4], kingCol: 4 },
  bunker: { profile: [5, 5, 5, 5, 5, 5, 4], kingCol: 5 },
  keep: { profile: [7, 7, 4, 6, 8, 7, 5], kingCol: 4 },
};

/**
 * What each faction reaches for, as the campaign gets richer.
 *
 * The tier is the whole difficulty curve of the enemy castle: the same silhouette
 * built out of timber on the meadow and out of iron in the forge is two very
 * different problems, and it means the answer changes from "knock it over" to
 * "bring the right ammunition".
 */
const TASTE = {
  knights: [
    { shell: 'wood', core: 'sand', filler: 'sand' },
    { shell: 'stone', core: 'wood', filler: 'sand' },
    { shell: 'stone', core: 'stone', filler: 'wood' },
    { shell: 'iron', core: 'stone', filler: 'wood' },
  ],
  machines: [
    { shell: 'crystal', core: 'sand', filler: 'sand' },
    { shell: 'crystal', core: 'crystal', filler: 'wood' },
    { shell: 'iron', core: 'crystal', filler: 'crystal' },
    { shell: 'iron', core: 'iron', filler: 'crystal' },
  ],
};

/**
 * @param {object} cfg
 * @param {string} cfg.style    one of STYLES
 * @param {number} cfg.budget   coins the enemy engineer gets to spend
 * @param {string} cfg.faction  whose taste in walls
 * @param {number} [cfg.tier]   0 is timber and sand, 3 is iron all the way down
 * @param {number} [cfg.seed]
 */
export function foeCastle({ style = 'wall', budget = 120, faction = 'machines', tier = 0, seed = 3 }) {
  const rng = makeRng(seed * 2246822519 + 11);
  const spec = STYLES[style] || STYLES.wall;
  const ladder = TASTE[faction] || TASTE.machines;
  const taste = ladder[Math.max(0, Math.min(ladder.length - 1, tier))];
  const cells = [];
  let spent = 0;

  // the front two columns take the fire, so they get the expensive material;
  // everything behind is packing
  const pick = (c, r) => {
    if (c <= 1) return r <= 1 && rng() < 0.35 ? taste.filler : taste.shell;
    if (c === spec.kingCol) return taste.core;
    return rng() < 0.45 ? taste.core : taste.filler;
  };

  // The chamber is built first — the king's column and the two holding it up —
  // and it is not vanity: whatever the budget is, he ends up with walls and a
  // roof. Built in plain left-to-right order a poor enemy spent everything on
  // the front wall and left its emperor sitting in the open behind it, where the
  // first lobbed shell found him.
  const chamber = [spec.kingCol - 1, spec.kingCol + 1, spec.kingCol].filter((c) => c >= 0 && c < COLS);
  const order = [...chamber, ...[...Array(COLS).keys()].filter((c) => !chamber.includes(c))];
  for (const c of order) {
    const height = Math.min(ROWS - 1, spec.profile[c]);
    for (let r = 0; r < height; r++) {
      const m = pick(c, r);
      const cost = MATERIALS[m].cost;
      // no money for this one: leave the column where it is and move to the
      // next, which keeps every stack contiguous from the ground
      if (spent + cost > budget) break;
      spent += cost;
      cells.push({ c, r, m });
    }
  }

  // He goes in last, into a hole cut for him at the bottom of his own column.
  // Everything that was stacked over that cell stays exactly where it is — it
  // is the roof he is counting on, and the thing that eventually lands on him.
  const kc = spec.kingCol;
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i].c === kc && cells[i].r === 0) cells.splice(i, 1);
  }

  return { cells: prune(cells, kc), king: { c: kc, r: 0 }, spent };
}

/**
 * Drop anything the finished plan leaves hanging.
 *
 * Cutting the king's cell out from under his own column is what makes the
 * chamber, and it is also what can leave the roof of a poor castle resting on
 * nothing when the budget stopped before the wall beside it was built. Rather
 * than trust the profiles to be safe at every budget — they were not — the plan
 * is run through the real support rule and whatever is falling is deleted on
 * paper, where it costs nothing.
 */
function prune(cells, kingCol) {
  const flat = { minIn: () => -Infinity };
  const castle = createCastle('enemy', { cells, king: { c: kingCol, r: 0 } });
  for (let pass = 0; pass < ROWS; pass++) {
    const loose = unsupported(castle, flat).filter((b) => b.m !== 'king');
    if (!loose.length) break;
    for (const b of loose) castle.remove(b.c, b.r);
  }
  return castle.blueprint().cells;
}

/**
 * A blueprint read off disk is not to be trusted: it may be two versions old,
 * hand-edited, or from a build where the grid was a different size. Anything
 * that does not fit is dropped, and the king is put somewhere legal.
 */
export function normalizeBlueprint(raw) {
  const out = { cells: [], king: null };
  const seen = new Set();
  const list = Array.isArray(raw && raw.cells) ? raw.cells : [];
  for (const cell of list) {
    if (!cell || !MATERIALS[cell.m]) continue;
    const c = Math.round(cell.c);
    const r = Math.round(cell.r);
    if (!(c >= 0 && c < COLS && r >= 0 && r < ROWS)) continue;
    const key = c + ',' + r;
    if (seen.has(key)) continue;
    seen.add(key);
    out.cells.push({ c, r, m: cell.m });
  }
  const k = raw && raw.king;
  if (k && k.c >= 0 && k.c < COLS && k.r >= 0 && k.r < ROWS) {
    const key = Math.round(k.c) + ',' + Math.round(k.r);
    if (!seen.has(key)) out.king = { c: Math.round(k.c), r: Math.round(k.r) };
  }
  return out;
}

/** What a blueprint costs, so the workshop and the save agree on the number. */
export function blueprintCost(bp) {
  let sum = 0;
  for (const b of (bp && bp.cells) || []) if (MATERIALS[b.m]) sum += MATERIALS[b.m].cost;
  return sum;
}
