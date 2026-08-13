// The heist: floor after floor, for as long as you last.
//
// A run is a seed and a floor number. Nothing about a floor is stored — floor
// 12 of run 481 is rebuilt from those two numbers whenever it is needed, which
// is what makes "infinite floors" cost nothing but the arithmetic.
//
// What crosses the lift doors with you: your health, your gun and what is in
// the bag. Which is why the third floor is not the third floor — it is the
// third floor arriving on whatever the second one left of you.

import { PLAYER, floorSeed } from './config.js';
import { generateFloor } from './levelgen.js';
import { createGame } from './game.js';
import { createLoadout } from './weapons.js';

/** Cleared without the building ever hearing you: worth money and a bandage. */
export const SILENT_BONUS = 1800;
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
    run.game = game;
    run.floor = floor;
    return game;
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

  /** Bank what the floor just paid, and open the next one. */
  run.advance = () => {
    const g = run.game;
    if (!g || g.state !== 'cleared') return run.game;
    const silent = g.stats.alarms === 0;
    run.money = g.stats.money + (silent ? SILENT_BONUS : 0);
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
    if (g.state === 'dead' && !run.over) {
      run.over = true;
      run.money = g.stats.money;
      run.totals.kills += g.stats.kills;
      run.totals.alarms += g.stats.alarms;
      run.totals.loot += g.stats.loot;
      run.totals.time += g.stats.time;
    }
  };

  /** What the run is worth: the bag, plus the floors it took to fill it. */
  run.score = () => {
    const g = run.game;
    const bag = g ? g.stats.money : run.money;
    return Math.round(bag + run.totals.floors * 1200);
  };

  return run;
}
