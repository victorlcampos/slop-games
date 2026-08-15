// A castle is a 7x9 grid of cells, and the rule that decides which of them are
// still standing.
//
// The king lives in the same grid as the walls — he is a cell with a crown on
// it. That is not a shortcut: it means support, collapse, blast falloff and
// crushing all treat him exactly as they treat a block, so there is no second
// code path where "and also the king" could quietly be forgotten.
//
// **Support** is the one invented rule in here, and it is what makes the
// workshop a game rather than a shopping list. A cell holds if:
//
//   · the ground reaches its floor, or
//   · the cell below it holds, or
//   · it is close enough to something that holds, sideways
//
// That last clause is the material's `span`: sand bridges nothing, stone
// bridges one cell, a wooden beam three, an iron girder four. Dig the ground
// out from under a sand wall and the whole thing pours into the crater; do the
// same under an iron one and it hangs there like a bridge.

import { BASE_Y, CASTLE_X, CELL, COLS, CRUSH_CAP, FALL_DMG, ROWS } from './config.js';
import { MATERIALS, material } from './materials.js';

export function createCastle(side, blueprint) {
  const baseX = CASTLE_X[side];
  const cells = new Array(COLS * ROWS).fill(null);

  const castle = {
    side,
    baseX,
    cells,

    at(c, r) {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
      return cells[c + r * COLS];
    },

    put(c, r, id) {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
      const m = material(id);
      if (!m) return null;
      const b = { c, r, m: id, hp: m.hp, max: m.hp, fire: 0, rust: 0, shake: 0 };
      cells[c + r * COLS] = b;
      return b;
    },

    remove(c, r) {
      const b = castle.at(c, r);
      if (b) cells[c + r * COLS] = null;
      return b;
    },

    move(b, c, r) {
      cells[b.c + b.r * COLS] = null;
      b.c = c;
      b.r = r;
      cells[c + r * COLS] = b;
    },

    /** The world rectangle of a cell. Row 0 sits on the base line. */
    rect(c, r) {
      return { x: baseX + c * CELL, y: BASE_Y - (r + 1) * CELL, w: CELL, h: CELL };
    },

    centre(c, r) {
      return { x: baseX + c * CELL + CELL / 2, y: BASE_Y - r * CELL - CELL / 2 };
    },

    /** Which cell a world point falls in, or null if it is outside the grid. */
    cellAt(x, y) {
      const c = Math.floor((x - baseX) / CELL);
      const r = Math.floor((BASE_Y - y) / CELL);
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
      return { c, r };
    },

    blocks() {
      return cells.filter(Boolean);
    },

    king() {
      return cells.find((b) => b && b.m === 'king') || null;
    },

    kingAlive() {
      const k = castle.king();
      return !!k && k.hp > 0;
    },

    /** What the walls are worth right now — the tie-breaker on a long match. */
    integrity() {
      let sum = 0;
      for (const b of cells) if (b && b.m !== 'king') sum += b.hp;
      return sum;
    },

    /** The design, in the shape the save file keeps. */
    blueprint() {
      const out = { cells: [], king: null };
      for (const b of cells) {
        if (!b) continue;
        if (b.m === 'king') out.king = { c: b.c, r: b.r };
        else out.cells.push({ c: b.c, r: b.r, m: b.m });
      }
      return out;
    },

    cost() {
      let sum = 0;
      for (const b of cells) if (b && b.m !== 'king') sum += MATERIALS[b.m].cost;
      return sum;
    },
  };

  if (blueprint) {
    for (const { c, r, m } of blueprint.cells || []) if (MATERIALS[m]) castle.put(c, r, m);
    if (blueprint.king) castle.put(blueprint.king.c, blueprint.king.r, 'king');
  }

  return castle;
}

/**
 * Does the ground still reach the floor of this column?
 *
 * The tolerance is a whole cell, and it is the difference between a game and a
 * coin flip. A crater is a bowl, so *any* shell that lands at the foot of a
 * wall lowers the ground under it by something; with a strict test, one lucky
 * ranging shot would drop a nine-storey tower into a scratch. A cell of slack
 * means the wall settles into shallow craters and only really comes down when
 * somebody has dug properly — which is what the drill bomb is for.
 */
export function grounded(castle, terrain, c) {
  const x0 = castle.baseX + c * CELL + 3;
  const x1 = castle.baseX + (c + 1) * CELL - 3;
  return terrain.minIn(x0, x1) <= BASE_Y + CELL;
}

/**
 * Remaining cantilever budget for every cell: -1 is "falling", 0 is "held but
 * holding nothing", higher numbers reach further sideways.
 *
 * It is a fixpoint — values only ever go up, so it always terminates, and the
 * loop is at most a few passes wide for a 7x9 grid.
 */
export function supportOf(castle, terrain) {
  const reach = new Int8Array(COLS * ROWS).fill(-1);
  const groundRow = [];
  for (let c = 0; c < COLS; c++) groundRow[c] = grounded(castle, terrain, c);

  for (let pass = 0; pass < COLS * ROWS; pass++) {
    let changed = false;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const b = castle.at(c, r);
        if (!b) continue;
        const i = c + r * COLS;
        const span = material(b.m).span;
        let best = reach[i];

        // A king on the floor braces rather than falls. Undermining him is
        // still the strongest play in the game — it is just that what kills him
        // is the tower coming down on his head, not the hole itself, and that
        // takes a second shot. Losing on turn one to a shell you never saw is
        // not a lesson, it is the game refusing to be played.
        if (r === 0 && b.m === 'king') {
          if (reach[i] < 0) {
            reach[i] = 0;
            changed = true;
          }
          continue;
        }

        if (r === 0 ? groundRow[c] : reach[c + (r - 1) * COLS] >= 0 && castle.at(c, r - 1)) {
          best = Math.max(best, span);
        }
        for (const dc of [-1, 1]) {
          const n = castle.at(c + dc, r);
          if (!n) continue;
          const nr = reach[c + dc + r * COLS];
          if (nr > 0) best = Math.max(best, Math.min(span, nr - 1));
        }
        if (best > reach[i]) {
          reach[i] = best;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return reach;
}

/** Every cell that is currently falling. */
export function unsupported(castle, terrain) {
  const reach = supportOf(castle, terrain);
  return castle.blocks().filter((b) => reach[b.c + b.r * COLS] < 0);
}

/**
 * Let gravity finish the argument.
 *
 * Anything unsupported drops until something stops it, taking damage for the
 * distance and dealing it to whatever it lands on — which is how a tower you
 * undermined kills the king it was built to protect. A cell with nothing at all
 * beneath it (the ground under that column is gone) falls out of the world.
 *
 * Returns what happened, so the renderer can shake the right cells and the
 * match can find out whether the king survived it.
 */
export function settle(castle, terrain) {
  const events = [];
  for (let pass = 0; pass < ROWS + 2; pass++) {
    const reach = supportOf(castle, terrain);
    let moved = false;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const b = castle.at(c, r);
        if (!b || reach[c + r * COLS] >= 0) continue;

        let target = r;
        while (target > 0 && !castle.at(c, target - 1)) target--;
        if (target === 0 && !grounded(castle, terrain, c)) {
          castle.remove(c, r);
          b.hp = 0;
          events.push({ kind: 'pit', block: b, c, r });
          moved = true;
          continue;
        }
        if (target === r) continue;

        const drop = r - target;
        castle.move(b, c, target);
        b.hp -= FALL_DMG * drop * 0.55;
        b.shake = 1;
        const under = castle.at(c, target - 1);
        if (under) {
          under.hp -= Math.min(CRUSH_CAP, FALL_DMG * drop * material(b.m).weight);
          under.shake = 1;
        }
        events.push({ kind: 'fall', block: b, from: r, to: target, drop });
        moved = true;
      }
    }

    // anything the fall finished off leaves a hole, which may drop the next one
    for (const b of castle.blocks()) {
      if (b.hp <= 0 && b.m !== 'king') {
        castle.remove(b.c, b.r);
        events.push({ kind: 'crush', block: b, c: b.c, r: b.r });
        moved = true;
      }
    }
    if (!moved) break;
  }
  return events;
}

/**
 * The height of whatever a siege engine would be standing on at a given x —
 * the top of that column of the castle, or the ground if the column is empty.
 *
 * This is what makes driving legible: the engine is always on top of something,
 * so a hole blown in the plot is a dip it can roll into and a tower is a step it
 * has to climb.
 */
export function surfaceAt(castle, terrain, x) {
  const c = Math.floor((x - castle.baseX) / CELL);
  if (c >= 0 && c < COLS) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (castle.at(c, r)) return BASE_Y - (r + 1) * CELL;
    }
  }
  return terrain ? terrain.minIn(x - 15, x + 15) : BASE_Y;
}

/**
 * Where the siege engine starts: on top of the tallest column of its own castle.
 *
 * "Tallest" is not a preference, it is the only seat that is unconditionally
 * safe: the engine fires from a pivot a little above the block it stands on, so
 * with nothing in the castle higher, even a four-degree shot clears its own
 * walls. Start it anywhere else and the player's own battlements eat the first
 * shot before they have worked out why.
 *
 * From there it is the player's problem — they can drive it somewhere worse, and
 * driving it somewhere better is most of what the fuel is for. Ties go to the
 * column nearest the enemy.
 */
export function gunSeat(castle, terrain) {
  const towardsFoe = castle.side === 'player' ? 1 : -1;
  let bestCol = -1;
  let bestTop = -1;

  for (let c = 0; c < COLS; c++) {
    let top = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (castle.at(c, r)) {
        top = r;
        break;
      }
    }
    if (top < 0) continue;
    // it will not be parked on the crown: a column whose highest cell is the
    // king is not a seat, however tall it is. The player can still drive it over
    // him — that is their business — but nobody starts a siege standing on him.
    const highest = castle.at(c, top);
    if (highest && highest.m === 'king') continue;
    const forward = towardsFoe > 0 ? c > bestCol : c < bestCol;
    if (top > bestTop || (top === bestTop && forward)) {
      bestTop = top;
      bestCol = c;
    }
  }

  if (bestCol < 0) {
    // no castle left at all: it sits on the bare plot, which is where it will
    // be finishing this siege from
    const x = castle.baseX + (COLS * CELL) / 2;
    return { c: -1, r: -1, x, y: terrain ? terrain.minIn(x - 24, x + 24) : BASE_Y };
  }
  return {
    c: bestCol,
    r: bestTop,
    x: castle.baseX + bestCol * CELL + CELL / 2,
    y: BASE_Y - (bestTop + 1) * CELL,
  };
}

/**
 * Whether a cell may be built on in the workshop.
 *
 * The check is the real support rule, run against a copy with the cell already
 * in place: if the finished wall would fall down, the game says no now rather
 * than dropping it on your own king the moment the first shell lands.
 */
export function canPlace(castle, terrain, c, r, id) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
  if (castle.at(c, r)) return false;
  const b = castle.put(c, r, id);
  if (!b) return false;
  const ok = supportOf(castle, terrain)[c + r * COLS] >= 0;
  castle.remove(c, r);
  return ok;
}

/**
 * Removing a cell is only allowed while nothing depends on it — otherwise the
 * eraser is a way to leave a tower hanging in mid-air until the battle starts.
 */
export function canRemove(castle, terrain, c, r) {
  const b = castle.at(c, r);
  if (!b) return false;
  castle.remove(c, r);
  const loose = unsupported(castle, terrain).length;
  castle.put(c, r, b.m);
  const kept = castle.at(c, r);
  kept.hp = b.hp;
  return loose === 0;
}
