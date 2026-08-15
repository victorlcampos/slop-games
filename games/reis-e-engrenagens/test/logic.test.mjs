// The rules of the siege, checked without a canvas: what a wall holds up, what
// a shell takes out of the ground, what the workshop refuses to let you build,
// and the promise that neither side of the valley got the better hill.

import { scenario, check, run } from 'slopkit/testing';
import { missingKeys } from 'slopkit/i18n';

import {
  BASE_Y, CASTLE_X, CELL, COLS, FACTIONS, LEVELS, NCOL, ROWS, START_COINS, W,
} from '../src/config.js';
import { CAM_TOP, createCamera, focusOf } from '../src/camera.js';
import { MATERIALS, PALETTE, TERRAINS, material } from '../src/materials.js';
import {
  AMMO_CAP, ARSENAL, WEAPONS, ammoCost, craterRadius, damageAgainst, defaultLoadout, kitCost, loadout, specials,
} from '../src/weapons.js';
import { FLOOR_Y, buildTerrain } from '../src/terrain.js';
import { canPlace, canRemove, createCastle, grounded, settle, supportOf, unsupported } from '../src/structure.js';
import { blueprintCost, foeCastle, normalizeBlueprint } from '../src/castles.js';
import { createWorkshop, suggestBlueprint } from '../src/workshop.js';
import { freshRun, normalizeRun, reward } from '../src/run.js';
import { BITE_EVERY, MINIONS, unlockedMinions } from '../src/minions.js';
import { chargeAt } from '../src/controls.js';
import { battleLayout, hit, paletteLayout } from '../src/ui.js';
import { dict } from '../src/i18n.js';

const flatTerrain = () => buildTerrain({ kind: 'soil', seed: 5, middle: 'flat' });

// ------------------------------------------------------------ the two flags

scenario('every phrase exists in both languages', () => {
  const holes = missingKeys(dict);
  check(holes.length === 0, `half a translation: ${holes.join(', ')}`);
});

scenario('everything the game names on screen has a phrase to name it with', () => {
  const wanted = [
    ...Object.keys(MATERIALS).flatMap((m) => [`m.${m}`, `m.${m}.note`]),
    ...Object.keys(WEAPONS).flatMap((w) => [`w.${w}`, `w.${w}.note`]),
    ...LEVELS.flatMap((l) => [`lv.${l.id}`, `lv.${l.id}.note`]),
    ...Object.keys(MINIONS).map((id) => `mn.${id}`),
    'm.king',
  ];
  const missing = wanted.filter((k) => !dict[k]);
  check(missing.length === 0, `no dictionary entry for ${missing.join(', ')}`);
});

// ------------------------------------------------------------- the numbers

scenario('every weapon has an opinion about every material, and none is a blank', () => {
  for (const [id, w] of Object.entries(WEAPONS)) {
    for (const m of [...PALETTE, 'king']) {
      check(typeof w.vs[m] === 'number' && w.vs[m] > 0,
        `${id} has nothing to say about ${m} — an accidental 1 is a design decision nobody made`);
    }
    check(w.damage > 0 && w.radius > 0, `${id} does nothing at all`);
    check(ARSENAL[w.faction].includes(id), `${id} belongs to ${w.faction} but is not in their dock`);
  }
  check(ARSENAL.knights.length === 4 && ARSENAL.machines.length === 4, 'a dock that is not four wide');
});

scenario('each side has exactly one munition it can never run out of', () => {
  for (const faction of ['knights', 'machines']) {
    const kit = loadout(faction);
    const endless = Object.values(kit).filter((n) => n === Infinity);
    check(endless.length === 1, `${faction} has ${endless.length} endless munitions — nobody may ever be unable to take a turn`);
    check(kit[ARSENAL[faction][0]] === Infinity, `${faction}: the endless one is not first in the dock`);
  }
});

scenario('the counters really do counter', () => {
  const vs = (w, m) => damageAgainst(WEAPONS[w], m, material(m).blast);
  check(vs('firepot', 'wood') > vs('firepot', 'stone') * 3,
    `a fire pot does ${vs('firepot', 'wood').toFixed(0)} to timber and ${vs('firepot', 'stone').toFixed(0)} to stone`);
  check(vs('rustshell', 'iron') > vs('rustshell', 'stone') * 3,
    `a rust shell does ${vs('rustshell', 'iron').toFixed(0)} to iron and ${vs('rustshell', 'stone').toFixed(0)} to stone`);
  check(vs('ballista', 'crystal') > vs('ballista', 'iron') * 2,
    `a bolt does ${vs('ballista', 'crystal').toFixed(0)} to crystal and ${vs('ballista', 'iron').toFixed(0)} to iron`);
  check(vs('boulder', 'sand') < vs('boulder', 'stone') / 2,
    `sandbags take ${vs('boulder', 'sand').toFixed(0)} from a boulder that does ${vs('boulder', 'stone').toFixed(0)} to stone`);
  check(vs('tesla', 'iron') > vs('tesla', 'wood') * 3,
    `the coil does ${vs('tesla', 'iron').toFixed(0)} to iron and ${vs('tesla', 'wood').toFixed(0)} to timber`);
});

scenario('the ground changes what a shell is worth', () => {
  const drill = WEAPONS.drill;
  const inSand = craterRadius(drill, 'sand', TERRAINS.sand.dig);
  const inRock = craterRadius(drill, 'rock', TERRAINS.rock.dig);
  check(inSand > inRock * 3, `a drill opens ${inSand.toFixed(0)}px in the dunes and ${inRock.toFixed(0)}px in the quarry`);
  for (const w of Object.values(WEAPONS)) {
    const soil = craterRadius(w, 'soil', TERRAINS.soil.dig);
    check(craterRadius(w, 'rock', TERRAINS.rock.dig) < soil, `${w.id} digs the quarry as easily as a meadow`);
  }
});

scenario('every material is the right answer to something, and the wrong one to something else', () => {
  // effective hit points per coin, against one particular weapon: this is the
  // number a player is really choosing between in the workshop
  const value = (id, w) => {
    const m = MATERIALS[id];
    return m.hp / (m.cost * w.vs[id] * m.blast);
  };
  const winner = {};
  for (const w of Object.values(WEAPONS)) {
    winner[w.id] = PALETTE.reduce((best, id) => (value(id, w) > value(best, w) ? id : best), PALETTE[0]);
  }
  for (const id of PALETTE) {
    const beats = Object.entries(winner).filter(([, m]) => m === id).map(([w]) => w);
    check(beats.length > 0,
      `${id} is not the best buy against a single weapon in the game — nobody would ever put it in a wall`);
    const weak = Object.values(WEAPONS).some((w) => w.vs[id] >= 1.4);
    check(weak, `nothing in the game is especially good against ${id} — it is a wall with no answer`);
  }
  // and no single material is the answer to everything
  const spread = new Set(Object.values(winner));
  check(spread.size >= 4, `only ${spread.size} materials are ever the right buy: ${[...spread].join(', ')}`);
});

// ------------------------------------------------------------- the ground

scenario('the valley is the same on both sides of the middle', () => {
  for (const level of LEVELS) {
    const t = buildTerrain({ kind: level.terrain, seed: 3, middle: level.middle });
    let worst = 0;
    for (let i = 0; i < NCOL / 2; i++) worst = Math.max(worst, Math.abs(t.h[i] - t.h[NCOL - 1 - i]));
    check(worst < 0.001, `${level.id}: the two halves differ by ${worst.toFixed(1)}px — one side got the better hill`);
  }
});

scenario('both plots are level, and there is real ground in between', () => {
  for (const level of LEVELS) {
    const t = buildTerrain({ kind: level.terrain, seed: 9, middle: level.middle });
    for (const side of ['player', 'enemy']) {
      const x = CASTLE_X[side];
      const lo = t.minIn(x, x + COLS * CELL);
      const hi = t.maxIn(x, x + COLS * CELL);
      check(Math.abs(hi - lo) < 0.001, `${level.id}: the ${side} plot is not level (${(hi - lo).toFixed(1)}px of slope)`);
      check(Math.abs(lo - BASE_Y) < 0.001, `${level.id}: the ${side} plot is at ${lo.toFixed(0)}, not the base line`);
    }
    // the valley is the map now, not the gap between two pads: it has to have
    // something in it
    const relief = t.maxIn(700, W - 700) - t.minIn(700, W - 700);
    check(relief > 60, `${level.id}: ${relief.toFixed(0)}px of relief between the castles is a table, not a valley`);
    check(t.maxIn(0, W) <= FLOOR_Y, `${level.id}: the ground starts below the floor of the world`);
  }
});

scenario('a blast carves a bowl, and only where it reaches the surface', () => {
  const t = flatTerrain();
  const was = t.snapshot();
  const surface = t.yAt(700);

  t.carve(700, 200, 60); // high in the air, nowhere near the dirt
  check(t.snapshot().every((y, i) => y === was[i]), 'a shell that went off in mid-air still dug a hole');

  t.carve(700, surface, 60);
  check(t.yAt(700) > surface + 40, `a direct hit only moved the surface ${(t.yAt(700) - surface).toFixed(0)}px`);
  check(t.yAt(770) === was[Math.round(770 / 4)], 'the crater reached further than its own radius');
  // and the lip of it slopes, rather than being a shaft
  check(t.yAt(740) > was[Math.round(740 / 4)] && t.yAt(740) < t.yAt(700), 'the crater has no slope, it is a well');
  check(t.maxIn(0, W) <= FLOOR_Y, 'something dug below the floor of the world');
});

// -------------------------------------------------------------- structure

scenario('a wall on the ground stands, and one in the air does not', () => {
  const t = flatTerrain();
  const castle = createCastle('player');
  castle.put(0, 0, 'stone');
  castle.put(0, 1, 'stone');
  castle.put(4, 5, 'stone');
  const reach = supportOf(castle, t);
  check(reach[0] >= 0 && reach[COLS] >= 0, 'a stack sitting on the ground reported itself as falling');
  check(reach[4 + 5 * COLS] < 0, 'a block floating five cells up reported itself as held');
});

scenario('span is what a beam is for: timber bridges three cells, sand bridges none', () => {
  const t = flatTerrain();
  for (const [m, expected] of [['sand', 0], ['stone', 1], ['wood', 3], ['iron', 4]]) {
    const castle = createCastle('player');
    castle.put(0, 0, 'stone');
    castle.put(0, 1, m); // the anchor, one cell up
    let bridged = 0;
    for (let c = 1; c < COLS; c++) {
      castle.put(c, 1, m);
      if (supportOf(castle, t)[c + COLS] >= 0) bridged = c;
      else break;
    }
    check(bridged === expected, `${m} bridged ${bridged} cells of air, not ${expected}`);
  }
});

scenario('dig the ground out and the tower comes down on whatever is under it', () => {
  const t = flatTerrain();
  const castle = createCastle('player');
  for (let r = 0; r < 6; r++) castle.put(3, r, 'stone');
  castle.put(4, 0, 'wood');
  check(unsupported(castle, t).length === 0, 'the tower was falling before anybody shot at it');

  // a crater right under column 3, deeper than the slack the rule allows
  const x = castle.baseX + 3 * CELL + CELL / 2;
  t.carve(x, BASE_Y, 90);
  check(!grounded(castle, t, 3), 'a 90px crater did not take the ground out from under the column');
  const events = settle(castle, t);
  check(events.length > 0, 'the ground went and nothing moved');
  check(castle.at(3, 0) === null, 'the bottom of the tower is still standing on a hole');
});

scenario('a shallow crater is not a demolition', () => {
  const t = flatTerrain();
  const castle = createCastle('player');
  for (let r = 0; r < 5; r++) castle.put(2, r, 'stone');
  t.carve(castle.baseX + 2 * CELL + CELL / 2, BASE_Y, 22);
  check(grounded(castle, t, 2), 'a 22px scratch was enough to unground a five-storey tower');
  check(settle(castle, t).length === 0, 'the tower fell over a scratch');
});

scenario('a falling block hurts, and it hurts what it lands on — but only so much', () => {
  const t = flatTerrain();
  const castle = createCastle('player');
  castle.put(0, 0, 'stone');
  castle.put(0, 1, 'wood'); // the beam that will be shot away
  castle.put(1, 1, 'wood');
  castle.put(1, 0, 'sand');
  const victim = castle.at(1, 0);
  const before = victim.hp;
  castle.remove(0, 1);
  castle.remove(1, 1);
  castle.put(1, 6, 'iron'); // dropped from six cells up
  settle(castle, t);
  const dealt = before - victim.hp;
  check(dealt > 0, 'a girder fell six cells onto a sandbag and the sandbag did not notice');
  check(dealt <= 85 + 0.001, `one falling girder dealt ${dealt.toFixed(0)} — the cap is what keeps a collapse from being the whole game`);
});

scenario('the king braces when the floor goes, so nobody loses on turn one', () => {
  const t = flatTerrain();
  const castle = createCastle('player');
  castle.put(2, 0, 'king');
  t.carve(castle.baseX + 2 * CELL + CELL / 2, BASE_Y, 120);
  settle(castle, t);
  check(castle.king() !== null, 'the crown fell out of the world through a single crater');
  check(castle.kingAlive(), 'the crown died to a hole in the ground with nothing on top of it');
});

// -------------------------------------------------------------- the workshop

scenario('the workshop spends what you have and not a coin more', () => {
  const t = flatTerrain();
  const shop = createWorkshop({ blueprint: null, coins: 30, terrain: t });
  check(shop.left() === 30, `a bare plot already cost ${30 - shop.left()}`);
  check(shop.place(0, 0, 'iron') === null, 'could not afford the first iron plate with 30 coins');
  check(shop.left() === 7, `an iron plate left ${shop.left()} of 30`);
  check(shop.place(1, 0, 'iron') === 'broke', 'the workshop sold a plate it had no money for');
  check(shop.erase(0, 0) === null, 'could not take the plate back');
  check(shop.left() === 30, `taking it back refunded ${shop.left()} instead of the full 30`);
});

scenario('the workshop refuses what would not stand, and what is holding something up', () => {
  const t = flatTerrain();
  const shop = createWorkshop({ blueprint: null, coins: 400, terrain: t });
  check(shop.place(3, 4, 'stone') === 'floating', 'the workshop sold a block hanging in mid-air');
  check(shop.place(3, 0, 'stone') === null, 'the workshop refused a block on bare ground');
  check(shop.place(3, 1, 'stone') === null, 'the workshop refused a block on top of another');
  check(shop.erase(3, 0) === 'holding', 'the eraser pulled the bottom out of a stack');
  check(shop.erase(3, 1) === null, 'the eraser refused the top of a stack');
});

scenario('there is exactly one king, and he has to be standing on something', () => {
  const t = flatTerrain();
  const shop = createWorkshop({ blueprint: null, coins: 200, terrain: t });
  check(shop.problem() === 'noking', 'a castle with no crown was cleared to fight');
  check(shop.placeKing(4, 6) === 'floating', 'the crown was allowed to float six cells up');
  check(shop.placeKing(2, 0) === null, 'the crown was refused a spot on the ground');
  check(shop.problem() === null, `with a crown on the ground the workshop still says "${shop.problem()}"`);
  check(shop.placeKing(3, 0) === null, 'the crown could not be moved');
  check(shop.castle.blocks().filter((b) => b.m === 'king').length === 1, 'moving the crown left a copy behind');
  check(shop.erase(3, 0) === 'king', 'the eraser deleted the king');
});

scenario('the draft castle is affordable at every budget, stands up, and keeps the crown indoors', () => {
  const t = flatTerrain();
  let previous = 0;
  // the button is there on every siege, and by the fourth there is twice the
  // money — a draft that ignores it is a draft nobody presses twice
  for (const coins of [START_COINS, 260, 400, 600, 900]) {
    const draft = suggestBlueprint(coins);
    const spent = blueprintCost(draft);
    check(spent <= coins, `with ${coins} coins the draft spent ${spent}`);
    check(spent >= previous, `the draft got smaller when the budget grew (${previous} → ${spent})`);
    previous = spent;

    const castle = createCastle('player', draft);
    check(unsupported(castle, t).length === 0, `at ${coins} coins the draft is falling down before the first shot`);
    const k = castle.king();
    check(k, `at ${coins} coins the draft has no crown`);
    // something above him, and a wall on both sides: an open-air king is a joke
    let roof = false;
    for (let r = k.r + 1; r < ROWS; r++) if (castle.at(k.c, r)) roof = true;
    check(roof, `at ${coins} coins the draft leaves the crown standing in the open air`);
    check(castle.at(k.c - 1, k.r) && castle.at(k.c + 1, k.r),
      `at ${coins} coins the draft leaves the crown without walls beside him`);
  }
  check(previous > START_COINS * 1.6, `the draft never spends more than ${previous} however rich you get`);
});

scenario('shells and walls come out of the same purse, and both directions of the trade work', () => {
  const t = flatTerrain();
  const shop = createWorkshop({
    blueprint: null, coins: 300, terrain: t, faction: 'knights', loadout: defaultLoadout('knights'),
  });
  const start = shop.left();
  check(start === 300 - kitCost('knights'), `an untouched rack left ${shop.left()} of 300 — the kit costs ${kitCost('knights')}`);

  check(shop.adjustAmmo('ballista', 1) === null, 'could not buy a bolt with coins in hand');
  check(shop.left() === start - WEAPONS.ballista.price, `one bolt moved the purse by ${start - shop.left()}`);
  check(shop.adjustAmmo('ballista', -1) === null, 'could not sell the bolt back');
  check(shop.left() === start, `selling it back refunded ${shop.left() - (start - WEAPONS.ballista.price)} instead of the full price`);

  // the rack has a ceiling, and the workshop says so instead of ignoring the tap
  let why = null;
  for (let i = 0; i < AMMO_CAP + 2; i++) why = shop.adjustAmmo('firepot', 1);
  check(why === 'full', `past the cap the workshop said "${why}"`);
  check(shop.ammo.firepot === AMMO_CAP, `the rack holds ${shop.ammo.firepot} fire pots against a cap of ${AMMO_CAP}`);

  // sell every shell and the whole kit price is walls again
  for (const id of specials('knights')) while (shop.ammo[id] > 0) shop.adjustAmmo(id, -1);
  check(shop.left() === 300, `an empty rack still holds ${300 - shop.left()} coins hostage`);

  // and with nothing left over, buying is refused out loud
  const poor = createWorkshop({
    blueprint: null, coins: kitCost('machines'), terrain: t, faction: 'machines', loadout: defaultLoadout('machines'),
  });
  check(poor.adjustAmmo('tesla', 1) === 'broke', 'the armory sold a coil there was no money for');
  check(poor.adjustAmmo('drill', -1) === null && poor.adjustAmmo('tesla', 1) === null,
    'selling a drill did not free enough for a coil it should have covered');
});

scenario('a fresh run affords exactly the old wall budget once the default rack is paid for', () => {
  for (const faction of FACTIONS) {
    const run = freshRun(faction);
    check(run.coins - ammoCost(faction, run.loadout) === START_COINS,
      `${faction}: after the kit there are ${run.coins - ammoCost(faction, run.loadout)} coins for walls, not ${START_COINS}`);
    for (const id of specials(faction)) {
      check(run.loadout[id] === WEAPONS[id].ammo, `${faction} starts with ${run.loadout[id]} ${id} instead of the shipped ${WEAPONS[id].ammo}`);
    }
  }
});

scenario('a save from before the armory is handed the default kit, not a bill', () => {
  const base = freshRun('knights');
  const legacy = normalizeRun({ faction: 'machines', level: 2, coins: 300 }, base);
  check(legacy.loadout && legacy.loadout.drill === WEAPONS.drill.ammo, 'an old save came back with no rack');
  check(legacy.coins === 300 + kitCost('machines'),
    `an old save with 300 coins opened with ${legacy.coins} — the kit it was handed costs ${kitCost('machines')}`);

  const junk = normalizeRun({ faction: 'knights', coins: 300, loadout: { ballista: 99, firepot: -3, tesla: 5 } }, base);
  check(junk.loadout.ballista === AMMO_CAP, `99 bolts came out as ${junk.loadout.ballista}`);
  check(junk.loadout.firepot === 0, `-3 fire pots came out as ${junk.loadout.firepot}`);
  check(!('tesla' in junk.loadout), "a knight's save smuggled a tesla coil in");
  check(junk.coins >= ammoCost('knights', junk.loadout), 'the purse cannot cover the rack the save claims');
});

// ----------------------------------------------------------- the two armies

scenario('the two armies are mirrors in weight, not in kind', () => {
  for (const stage of [0, 1, 3]) {
    const kn = unlockedMinions('knights', stage);
    const mc = unlockedMinions('machines', stage);
    check(kn.length === mc.length, `at stage ${stage} the kingdom fields ${kn.length} kinds and the machines ${mc.length}`);

    // head-on, tier for tier, neither side's walker wins a duel outright:
    // time-to-kill each other stays inside a band
    for (let i = 0; i < kn.length; i++) {
      const a = kn[i];
      const b = mc[i];
      const knKills = b.hp / a.mdps;
      const mcKills = a.hp / b.mdps;
      const ratio = knKills / mcKills;
      check(ratio > 0.65 && ratio < 1.55,
        `${a.id} vs ${b.id}: the duel decides in ${knKills.toFixed(1)}s against ${mcKills.toFixed(1)}s — one side just wins`);
    }

    // neither army out-eats the other's walls by more than the identity gap
    const wall = (list) => list.reduce((s, m) => s + m.bite / BITE_EVERY, 0);
    const pressure = wall(kn) / wall(mc);
    check(pressure > 0.6 && pressure < 1.67,
      `at stage ${stage} the kingdom eats walls at ${wall(kn).toFixed(1)}/s against ${wall(mc).toFixed(1)}/s`);

    // and from the first unlock on, both sides have an answer to a mountain —
    // one digs, the other climbs, nobody is simply walled out of a map
    if (stage >= 1) {
      check(kn.some((m) => m.dig > 0 || m.climb > 3), 'the kingdom has no answer to a steep face');
      check(mc.some((m) => m.dig > 0 || m.climb > 3), 'the machines have no answer to a steep face');
    }
  }

  // the unlock ladder itself is symmetric: kind number n arrives on the same
  // siege for both crowns
  const ladder = (f) => Object.values(MINIONS).filter((m) => m.faction === f).map((m) => m.unlock).sort();
  check(ladder('knights').join(',') === ladder('machines').join(','),
    `the kingdom unlocks at [${ladder('knights')}] and the machines at [${ladder('machines')}]`);
});

// --------------------------------------------------------- the enemy castle

scenario('every enemy castle in the campaign stands up and shelters its crown', () => {
  const t = flatTerrain();
  for (let i = 0; i < LEVELS.length; i++) {
    const level = LEVELS[i];
    for (const faction of ['knights', 'machines']) {
      const bp = foeCastle({ ...level.foe, faction, seed: 11 + i });
      const castle = createCastle('enemy', bp);
      const loose = unsupported(castle, t);
      check(loose.length === 0, `${level.id}/${faction}: ${loose.length} cells were falling before the match started`);
      const k = castle.king();
      check(k, `${level.id}/${faction}: no crown`);
      check(castle.at(k.c, k.r + 1), `${level.id}/${faction}: the crown has nothing over its head`);
      check(bp.spent <= level.foe.budget, `${level.id}/${faction}: spent ${bp.spent} of ${level.foe.budget}`);
      check(castle.blocks().length >= 6, `${level.id}/${faction}: ${castle.blocks().length} cells is not a castle`);
    }
  }
});

scenario('the campaign gets heavier, siege by siege', () => {
  const t = flatTerrain();
  let previous = 0;
  for (const level of LEVELS) {
    const castle = createCastle('enemy', foeCastle({ ...level.foe, faction: 'machines', seed: 4 }));
    const hp = castle.blocks().reduce((sum, b) => sum + b.max, 0);
    check(hp > previous, `${level.id} is ${hp} hit points against the last one's ${previous}`);
    previous = hp;
    check(level.skill >= 0.29 && level.skill <= 1, `${level.id}: a skill of ${level.skill}`);
  }
});

// -------------------------------------------------------------- the save

scenario('a save two versions old opens instead of breaking the run', () => {
  const base = freshRun('knights');
  check(normalizeRun(null, base) === base, 'a missing save did not fall back to a fresh run');
  const junk = normalizeRun(
    { faction: 'wizards', level: 99, coins: -5, wins: 'lots', blueprint: { cells: [{ c: 99, r: 2, m: 'cheese' }], king: { c: 3, r: 0 } } },
    base
  );
  check(junk.faction === 'knights', `a save claiming faction "wizards" produced ${junk.faction}`);
  check(junk.level === LEVELS.length - 1, `level 99 became ${junk.level}`);
  check(junk.coins >= 0, `coins came out at ${junk.coins}`);
  check(junk.blueprint.cells.length === 0, 'a wall made of cheese survived normalisation');
  check(junk.blueprint.king.c === 3, 'the crown was lost on the way in');
});

scenario('a blueprint cannot smuggle two blocks into one cell', () => {
  const bp = normalizeBlueprint({
    cells: [{ c: 1, r: 1, m: 'stone' }, { c: 1, r: 1, m: 'iron' }],
    king: { c: 1, r: 1 },
  });
  check(bp.cells.length === 1, `${bp.cells.length} blocks came out of one cell`);
  check(bp.king === null, 'the crown was placed inside a wall');
});

scenario('winning pays more for a castle that survived', () => {
  const t = flatTerrain();
  const whole = createCastle('player', suggestBlueprint(START_COINS));
  const ruin = createCastle('player', { cells: [{ c: 0, r: 0, m: 'sand' }], king: { c: 1, r: 0 } });
  check(reward(LEVELS[0], whole) > reward(LEVELS[0], ruin),
    'a castle in one piece pays the same as a castle in pieces');
  check(reward(LEVELS[5], ruin) > reward(LEVELS[0], ruin), 'the last siege pays no better than the first');
});

// ------------------------------------------------------------- the screen

scenario('zooming in keeps the view on the map and a tap where it was drawn', () => {
  const cam = createCamera();
  cam.zoomTo(2.4, true);
  check(cam.span(1558) < 700, `zoomed in, ${cam.span(1558).toFixed(0)}px of world is on screen — that is no zoom at all`);

  // the right edge has to account for the zoom, or the view walks off the map
  cam.follow({ x: W, y: 400 }, 1558, 1, true);
  check(cam.x + cam.span(1558) <= W + 0.01,
    `zoomed in at the right edge it is showing up to x=${(cam.x + cam.span(1558)).toFixed(0)} of a ${W} map`);

  // and a tap comes back where it was drawn, magnification and all
  const back = cam.toWorld(300, 200);
  check(Math.abs(back.x - (300 / cam.z + cam.x)) < 0.01 && Math.abs(back.y - (200 / cam.z + cam.y)) < 0.01,
    'a tap on a zoomed view came back at the wrong place');
  const cell = 40 * cam.z;
  check(cell > 80, `a workshop cell is ${cell.toFixed(0)} logical pixels — too small for a thumb`);
});

scenario('the camera stays on the map, drifts rather than snaps, and only ever climbs', () => {
  for (const viewW of [1040, 1280, 1900]) {
    const cam = createCamera();
    cam.follow({ x: 0, y: 500 }, viewW, 1, true);
    check(cam.x === 0, `at ${viewW} wide the camera walked off the left edge to ${cam.x}`);
    cam.follow({ x: W + 500, y: 500 }, viewW, 1, true);
    check(Math.abs(cam.x - (W - viewW)) < 0.01, `at ${viewW} wide it walked past the right edge to ${cam.x}`);

    // the ground never leaves the bottom of the screen: looking *down* would
    // only ever show the floor of the world
    cam.follow({ x: 1200, y: 700 }, viewW, 1, true);
    check(cam.y === 0, `following something on the ground tilted the view to ${cam.y}`);
    cam.follow({ x: 1200, y: -900 }, viewW, 1, true);
    check(cam.y === CAM_TOP, `following a very high shell stopped at ${cam.y} instead of ${CAM_TOP}`);

    // and a tap comes back where it was drawn
    cam.follow({ x: 1200, y: 400 }, viewW, 1, true);
    const back = cam.toWorld(300, 200);
    check(Math.abs(back.x - (300 + cam.x)) < 0.01 && Math.abs(back.y - (200 + cam.y)) < 0.01,
      `a tap came back as ${back.x.toFixed(0)},${back.y.toFixed(0)}`);
  }

  // Drifting, not snapping: one frame covers a small fraction of the gap. A
  // camera that snaps to the shell makes the shell look nailed to the middle of
  // the screen and the world look like it is being yanked past it.
  const cam = createCamera();
  cam.follow({ x: 0, y: 400 }, 1280, 1, true);
  const before = cam.x;
  cam.follow({ x: W, y: 400 }, 1280, 1 / 60);
  const gap = W - 1280 - before;
  const moved = cam.x - before;
  check(moved > 0, 'the camera did not move at all');
  check(moved < gap * 0.2, `one frame covered ${((moved / gap) * 100).toFixed(0)}% of the pan — that is a cut, not a camera`);

  // and it does catch up: half a second of frames gets most of the way there
  for (let i = 0; i < 30; i++) cam.follow({ x: W, y: 400 }, 1280, 1 / 60);
  check(cam.x > before + gap * 0.85, `half a second of drift only covered ${(((cam.x - before) / gap) * 100).toFixed(0)}%`);
});

scenario('no two controls ever land on each other, at any width', () => {
  // The three clusters used to be laid out independently against their own
  // edges, and on a 4:3 monitor the fire button sat on top of the munition dock.
  // This is that bug turned into a test: every control, every width, no overlap.
  const overlap = (a, b) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  for (const vw of [1040, 1280, 1558, 1900]) {
    const bay = battleLayout(vw, 720, ARSENAL.knights);
    const all = [...bay.dock, ...bay.drive, ...bay.aim, bay.fire];
    for (const r of all) {
      check(r.x >= 0 && r.x + r.w <= vw + 0.001, `a control left the screen at ${vw}: ${r.id} at ${r.x.toFixed(0)}`);
      check(r.y + r.h <= 720.001 && r.y > 0, `a control left the screen vertically at ${vw}: ${r.id}`);
      // and a thumb has to be able to hit it
      check(r.w >= 40 && r.h >= 36, `${r.id} is ${r.w.toFixed(0)}x${r.h.toFixed(0)} at ${vw} — too small for a thumb`);
    }
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        check(!overlap(all[i], all[j]), `${all[i].id} and ${all[j].id} overlap at ${vw}`);
      }
    }
    check(hit(bay.dock, bay.dock[1].x + 4, bay.dock[1].y + 4).id === ARSENAL.knights[1],
      `a tap on the second dock slot missed at ${vw}`);
    check(hit(all, 4, 4) === null, 'a tap on the top corner hit a control');

    const pal = paletteLayout(vw, 720, [...PALETTE, 'king', 'erase']);
    for (const r of pal) check(r.x >= 0 && r.x + r.w <= vw + 0.001, `the palette left the screen at ${vw}`);
  }
});

scenario('a thumb near a munition slot still lands it, and between two slots the nearer wins', () => {
  const bay = battleLayout(1280, 720, ARSENAL.knights);
  const [s0, s1] = bay.dock;

  // a tap a few pixels off a slot is the slot, not a miss — on a phone the
  // dock is two thirds of this size and pixel accuracy reads as "broken"
  const off = hit([...bay.dock, ...bay.drive, ...bay.aim, bay.fire], s0.x - 8, s0.y + s0.h / 2);
  check(off && off.id === s0.id, 'a tap 8px left of the first slot missed it');
  const above = hit(bay.dock, s1.x + s1.w / 2, s1.y - 9);
  check(above && above.id === s1.id, 'a tap 9px above the second slot missed it');

  // the gap between two slots goes to the nearer one
  const gapLeft = hit(bay.dock, s0.x + s0.w + 1, s0.y + 10);
  check(gapLeft && gapLeft.id === s0.id, `the gap next to slot one resolved to ${gapLeft && gapLeft.id}`);
  const gapRight = hit(bay.dock, s1.x - 1, s1.y + 10);
  check(gapRight && gapRight.id === s1.id, `the gap next to slot two resolved to ${gapRight && gapRight.id}`);

  // and a direct hit always beats a neighbour's padding
  const direct = hit(bay.dock, s1.x + 3, s1.y + 3);
  check(direct && direct.id === s1.id, 'a tap inside slot two was stolen by slot one\'s padding');
});

scenario('the charge climbs while you hold it and stops at full', () => {
  // Hold-and-release, not tap-and-tap: the same decision with the timing already
  // in your hand, one button instead of two taps, and on a phone the difference
  // between a control and a lottery.
  check(chargeAt(0, 118) === 0, 'the charge does not start at nothing');
  check(Math.abs(chargeAt(0.5, 118) - 59) < 0.001, `half a second in it reads ${chargeAt(0.5, 118).toFixed(0)}`);
  check(chargeAt(1, 118) === 100, `a second in it reads ${chargeAt(1, 118).toFixed(0)}`);

  // and it caps rather than wrapping — holding too long is a full-power shot,
  // not a wasted turn
  check(chargeAt(9, 118) === 100, `held for nine seconds it reads ${chargeAt(9, 118).toFixed(0)}`);
  let last = -1;
  for (let i = 0; i <= 200; i++) {
    const v = chargeAt(i / 60, 118);
    check(v >= last, `the charge went backwards at ${(i / 60).toFixed(2)}s`);
    check(v >= 0 && v <= 100, `the charge wandered to ${v.toFixed(0)}`);
    last = v;
  }
  // a full charge is quick enough that nobody waits for it
  check(chargeAt(1.2, 118) === 100, 'a full charge takes longer than a beat and a bit');
});

scenario('the camera watches the shell, and the gunner when there is none', () => {
  const castle = createCastle('player', suggestBlueprint(START_COINS));
  const fake = {
    shots: [],
    turn: 'player',
    launchers: { player: { x: 400, y: 300 }, enemy: { x: 2000, y: 300 } },
  };
  check(focusOf(fake).x === 400, 'with nothing in the air it is not looking at the gun about to fire');
  fake.shots = [
    { x: 700, y: 200, vx: 300, side: 'player' },
    { x: 1100, y: 260, vx: 300, side: 'player' },
    { x: 900, y: 240, vx: 300, side: 'player' },
  ];
  // a cluster's *average* is the empty middle of the spread; it follows the leader
  check(focusOf(fake).x === 1100, `with three fragments up it is watching x=${focusOf(fake).x}`);
  check(castle.blocks().length > 0, 'the fixture castle came out empty');
});

await run('kings & gears — the rules');
