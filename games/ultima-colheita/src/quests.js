// The quest chain: one goal at a time, in the order that teaches the economy.
//
// This exists because the first playtester placed a farm and then stood there
// not knowing where wood comes from. The game knew — sawmill, by the trees —
// but nothing on screen said so. A quest is that sentence, at the moment it
// is needed, with a counter that ticks when the player does the thing.

const countOf = (world, id) => world.buildings.filter((b) => b.id === id).length;

/** In order. `count` reads the world; done when count >= target. */
export const QUESTS = [
  { id: 'sawmill', target: 1, count: (w) => countOf(w, 'sawmill') },
  { id: 'farm', target: 1, count: (w) => countOf(w, 'farm') },
  { id: 'house', target: 2, count: (w) => countOf(w, 'house') },
  { id: 'quarry', target: 1, count: (w) => countOf(w, 'quarry') },
  { id: 'barracks', target: 1, count: (w) => countOf(w, 'barracks') },
  { id: 'soldiers', target: 4, count: (w) => w.units.length },
  { id: 'walls', target: 8, count: (w) => countOf(w, 'wall') },
  { id: 'tower', target: 1, count: (w) => countOf(w, 'tower') },
];

/**
 * What the panel should show: the current quest and its live count — or, with
 * the chain done, the standing order every year renews: survive the winter.
 */
export function questNow(world) {
  const q = QUESTS[world.questIdx];
  if (!q) return { id: 'survive', n: world.stats.hordes, target: null, year: world.year };
  return { id: q.id, n: Math.min(q.target, q.count(world)), target: q.target };
}

/** Advance past everything already satisfied. Returns each quest just done. */
export function advanceQuests(world) {
  const done = [];
  while (world.questIdx < QUESTS.length) {
    const q = QUESTS[world.questIdx];
    if (q.count(world) < q.target) break;
    done.push(q.id);
    world.questIdx++;
  }
  return done;
}
