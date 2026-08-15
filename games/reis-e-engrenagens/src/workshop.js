// The workshop: the half of the game that happens before anybody fires.
//
// You get coins and a 7x9 grid, and every decision in here is a trade the
// battle will collect on. Sand is almost free and eats explosions, and holds
// nothing up. Iron is four sand for the price of seven and bridges four cells,
// so an iron lintel keeps a chamber standing after the ground under it is gone
// — until somebody arrives with a rust shell.
//
// The one rule the workshop enforces is that **what you build has to stand up
// on its own**. A floating wall is not a clever trick, it is a wall that falls
// on your own king the moment the first shell lands nearby, and finding that
// out on turn one is not a lesson, it is a bug report.

import { COLS, ROWS } from './config.js';
import { MATERIALS, PALETTE } from './materials.js';
import { AMMO_CAP, WEAPONS, ammoCost, defaultLoadout } from './weapons.js';
import { canPlace, canRemove, createCastle, unsupported } from './structure.js';

export function createWorkshop({ blueprint, coins, terrain, faction = null, loadout = null }) {
  const castle = createCastle('player', blueprint);

  const shop = {
    castle,
    terrain,
    coins,
    faction,
    /** The rack of munitions being bought, by weapon id. One purse, two shelves. */
    ammo: { ...(loadout || (faction ? defaultLoadout(faction) : {})) },
    /** The palette entry in hand: a material id, 'king', or 'erase'. */
    brush: 'stone',

    spent() {
      return castle.cost();
    },
    ammoSpent() {
      return shop.faction ? ammoCost(shop.faction, shop.ammo) : 0;
    },
    left() {
      return shop.coins - castle.cost() - shop.ammoSpent();
    },

    /**
     * Buy or sell one shell. Walls and shells come out of the same purse, so
     * selling the whole rack is a bigger castle and buying it back out again is
     * a thinner one — that is the trade, and it is the player's to make.
     */
    adjustAmmo(id, delta) {
      const w = WEAPONS[id];
      if (!w || w.ammo === Infinity || !shop.faction) return 'unknown';
      const now = shop.ammo[id] || 0;
      if (delta > 0) {
        if (now >= AMMO_CAP) return 'full';
        if (w.price > shop.left()) return 'broke';
        shop.ammo[id] = now + 1;
      } else {
        if (now <= 0) return 'empty';
        shop.ammo[id] = now - 1;
      }
      return null;
    },
    affordable(id) {
      return id === 'king' || id === 'erase' || MATERIALS[id].cost <= shop.left();
    },

    /**
     * Act on a cell with whatever is in hand. Returns why it refused, or null
     * when it worked — the workshop says no out loud, it does not just ignore
     * the tap.
     */
    apply(c, r) {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return 'outside';
      if (shop.brush === 'erase') return shop.erase(c, r);
      if (shop.brush === 'king') return shop.placeKing(c, r);
      return shop.place(c, r, shop.brush);
    },

    place(c, r, id) {
      if (!MATERIALS[id]) return 'unknown';
      if (castle.at(c, r)) return 'taken';
      if (MATERIALS[id].cost > shop.left()) return 'broke';
      if (!canPlace(castle, terrain, c, r, id)) return 'floating';
      castle.put(c, r, id);
      return null;
    },

    erase(c, r) {
      const b = castle.at(c, r);
      if (!b) return 'empty';
      if (b.m === 'king') return 'king';
      if (!canRemove(castle, terrain, c, r)) return 'holding';
      castle.remove(c, r);
      return null;
    },

    /**
     * The king moves rather than multiplies: there is one of him, and putting
     * him somewhere new takes him out of where he was.
     */
    placeKing(c, r) {
      const there = castle.at(c, r);
      if (there && there.m !== 'king') return 'taken';
      const old = castle.king();
      if (old && old.c === c && old.r === r) return null;
      if (old) castle.remove(old.c, old.r);
      if (!canPlace(castle, terrain, c, r, 'king')) {
        if (old) castle.put(old.c, old.r, 'king');
        return 'floating';
      }
      castle.put(c, r, 'king');
      return null;
    },

    /** Start again from bare ground, coins and all. */
    clear() {
      for (const b of castle.blocks()) castle.remove(b.c, b.r);
    },

    /** Why the battle cannot start yet, or null. */
    problem() {
      if (!castle.king()) return 'noking';
      if (unsupported(castle, terrain).length) return 'floating';
      if (shop.left() < 0) return 'broke';
      return null;
    },

    blueprint() {
      return castle.blueprint();
    },
  };

  return shop;
}

/**
 * A castle for somebody who does not want to design one — the button that says
 * "just build me something". It is deliberately not optimal: it is a decent
 * first draft you can then take apart.
 */
export function suggestBlueprint(coins) {
  const cells = [];
  let spent = 0;
  const buy = (c, r, m) => {
    if (spent + MATERIALS[m].cost > coins) return false;
    spent += MATERIALS[m].cost;
    cells.push({ c, r, m });
    return true;
  };

  // A front wall high enough to force an arc, a sealed chamber behind it, and
  // sandbags packed against the outside where the blast lands. The chamber's
  // lid is timber because timber is the only cheap thing that bridges three
  // cells — which is the lesson this draft is really teaching.
  const plan = [
    [6, 0, 'stone'], [6, 1, 'stone'], [6, 2, 'stone'], [6, 3, 'stone'],
    [1, 0, 'stone'], [1, 1, 'stone'], [1, 2, 'stone'],
    [3, 0, 'stone'], [3, 1, 'stone'], [3, 2, 'stone'],
    [1, 3, 'wood'], [2, 3, 'wood'], [3, 3, 'wood'],
    [5, 0, 'sand'], [5, 1, 'sand'], [5, 2, 'sand'],
    [4, 0, 'sand'], [0, 0, 'sand'], [0, 1, 'sand'],
    // and the same castle again, for the budget of the fourth siege: a second
    // skin of sand on the outside, a taller front, and an iron lintel that
    // keeps the chamber standing after the ground under it is gone
    [6, 4, 'stone'], [6, 5, 'stone'], [5, 3, 'sand'], [5, 4, 'sand'],
    [0, 2, 'sand'], [4, 1, 'sand'], [4, 2, 'sand'],
    [1, 4, 'iron'], [2, 4, 'iron'], [3, 4, 'iron'],
    [6, 6, 'stone'], [0, 3, 'sand'], [4, 3, 'sand'], [5, 5, 'sand'],
  ];
  for (const [c, r, m] of plan) buy(c, r, m);

  return { cells, king: { c: 2, r: 0 } };
}

export const BRUSHES = [...PALETTE, 'king', 'erase'];
