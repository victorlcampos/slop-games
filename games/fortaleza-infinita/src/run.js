// The escape: ring after ring, for as long as you last.
//
// A run is a seed and a ring number. Nothing about a ring is stored — ring
// 12 of run 481 is rebuilt from those two numbers whenever it is needed, which
// is what makes "an infinite fortress" cost nothing but the arithmetic.
//
// What crosses the gate with you: your health, your gun and the shards in
// your pockets. Which is why the third ring is not the third ring — it is the
// third ring arriving on whatever the second one left of you.

import { PLAYER, floorSeed } from './config.js';
import { generateFloor } from './levelgen.js';
import { createGame } from './game.js';
import { createLoadout } from './weapons.js';

/**
 * Cleared without the Fortress ever hearing you: worth shards and a bandage.
 *
 * It scales with the ring, and it has to. A flat bonus is most of the takings
 * on ring 1 and a rounding error on ring 20, so the higher you get the less
 * reason there is to bother being quiet — exactly backwards from how the rings
 * are built.
 */
export const silentBonus = (floor) => Math.round(1200 + 700 * Math.max(0, floor - 1));
export const CLEAR_HEAL = 22;
export const SILENT_HEAL = 16;

export function createRun({ seed = 1, fx, hooks = {} } = {}) {
  const run = {
    seed: seed >>> 0 || 1,
    floor: 0,
    money: 0,
    hp: PLAYER.hp,
    loadout: createLoadout(),
    game: null,
    over: false,
    totals: { kills: 0, alarms: 0, loot: 0, time: 0, silent: 0, floors: 0 },
    lastFloor: null,
  };

  function build(floor) {
    const level = generateFloor(floor, floorSeed(run.seed, floor));
    const game = createGame({
      level,
      fx,
      hp: run.hp,
      money: run.money,
      loadout: run.loadout,
    });
    Object.assign(game, hooks);
    // The run closes its books *before* the caller's hook, because that hook is
    // what puts the end-of-run card on screen — and left the other way round it
    // reads the totals from before the floor he just died on.
    game.onDead = () => {
      close(game);
      hooks.onDead?.();
    };
    run.game = game;
    run.floor = floor;
    return game;
  }

  /** Book the ring he died on. Idempotent: death arrives from two directions. */
  function close(g) {
    if (run.over) return;
    run.over = true;
    run.money = g.stats.money;
    run.totals.kills += g.stats.kills;
    run.totals.alarms += g.stats.alarms;
    run.totals.loot += g.stats.loot;
    run.totals.time += g.stats.time;
  }

  run.start = () => {
    run.floor = 0;
    run.money = 0;
    run.hp = PLAYER.hp;
    run.loadout = createLoadout();
    run.over = false;
    run.totals = { kills: 0, alarms: 0, loot: 0, time: 0, silent: 0, floors: 0 };
    return build(1);
  };

  /** Book what the ring just paid, and open the next one. */
  run.advance = () => {
    const g = run.game;
    if (!g || g.state !== 'cleared') return run.game;
    const silent = g.stats.alarms === 0;
    run.money = g.stats.money + (silent ? silentBonus(g.level.floor) : 0);
    run.hp = Math.min(PLAYER.hp, g.player.hp + CLEAR_HEAL + (silent ? SILENT_HEAL : 0));
    run.loadout = { ...g.player.weapon, cool: 0 };
    run.totals.kills += g.stats.kills;
    run.totals.alarms += g.stats.alarms;
    run.totals.loot += g.stats.loot;
    run.totals.time += g.stats.time;
    run.totals.floors++;
    if (silent) run.totals.silent++;
    run.lastFloor = { floor: g.level.floor, silent, ...g.stats };
    return build(run.floor + 1);
  };

  run.update = (dt, input) => {
    const g = run.game;
    if (!g) return;
    g.update(dt, input);
    if (g.state === 'dead') close(g);
  };

  /** What the run is worth: the pockets, plus the rings it took to fill them. */
  run.score = () => {
    const g = run.game;
    const bag = g ? g.stats.money : run.money;
    return Math.round(bag + run.totals.floors * 1200);
  };

  return run;
}
