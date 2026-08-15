// The ground war: little walkers each side summons, marching under the
// artillery duel. They are not the way a siege is usually won — they are the
// clock that stops either king from hiding behind a wall forever, and a second
// thing on the field the guns are worth firing at.
//
// The rules, in the order a minion thinks them:
//
//   1. An enemy walker in reach is fought. Two columns that meet in the valley
//      lock — killing the blockers (a shell does nicely) frees the survivors
//      to march on, and the friends queued behind them with it.
//   2. The enemy wall in reach is bitten, from the nearest column up. The king
//      is a cell like any other (the game's oldest rule), so a castle eaten to
//      the bone ends with walkers gnawing the crown itself.
//   3. Otherwise: march. The ground has a say — every kind has a slope it can
//      climb, and a wall of dirt steeper than that stops it dead. Diggers cut
//      a notch through the face instead; spiders walk up it; everyone else
//      stands there until something (usually a shell) reshapes the hill.
//
// Nothing in here draws or plays a sound; it pushes events like the rest of
// the match, and it only ever runs from `match.tick` — the AI's ghost traces
// go nowhere near it, so thinking still changes nothing about the world.

import { CASTLE_X, CELL, COLS, ROWS, W, clamp, other } from './config.js';

/**
 * The two armies. Mirrored *in weight*, not in kind: the Kingdom is tougher
 * and hits walls harder, the Machines are faster and win the skirmish — and
 * each side gets its answer to a mountain at the same unlock (the sapper digs,
 * the spider climbs), so no map is open to one army and shut to the other.
 *
 * `unlock` is the campaign level (0-based) where the kind first musters.
 *
 * `climb` and the ground rule: **born terrain always goes.** Any slope the
 * world came with — up to and including a vertical cliff — is climbed by
 * every kind; past `climb` it just becomes a slow, leaning scramble instead
 * of a walk. The only ground that refuses a walker is ground *a shell has
 * chewed* (the terrain keeps a scar per column): a raw crater face steeper
 * than `climb` is the one wall in the game, and even it only sorts the army —
 * spiders walk it, diggers tunnel it, and ordinary infantry stands flashing
 * `!` until another shell reshapes what the first one broke.
 *
 * `dig` is a tunnelling speed in px/s: refused by a crater wall, a digger
 * goes *into* it with a slight upward pitch and comes out where the ground
 * meets it — a mound of moving earth is all the surface sees of it.
 */
export const MINIONS = {
  // ------------------------------------------------------------- knights
  squire: { id: 'squire', faction: 'knights', unlock: 0, hp: 36, speed: 44, climb: 2.2, dig: 0, bite: 8, mdps: 9, reach: 22 },
  sapper: { id: 'sapper', faction: 'knights', unlock: 1, hp: 46, speed: 36, climb: 1.9, dig: 24, bite: 11, mdps: 7, reach: 22 },
  ram: { id: 'ram', faction: 'knights', unlock: 3, hp: 95, speed: 26, climb: 1.6, dig: 0, bite: 20, mdps: 4, reach: 26 },
  // ------------------------------------------------------------ machines
  scrapper: { id: 'scrapper', faction: 'machines', unlock: 0, hp: 30, speed: 52, climb: 2.2, dig: 0, bite: 7, mdps: 10, reach: 22 },
  spider: { id: 'spider', faction: 'machines', unlock: 1, hp: 40, speed: 46, climb: 8, dig: 0, bite: 9, mdps: 8, reach: 22 },
  mole: { id: 'mole', faction: 'machines', unlock: 3, hp: 56, speed: 32, climb: 1.8, dig: 28, bite: 16, mdps: 5, reach: 26 },
};

/** Turns between waves — three of each side's own turns. */
export const WAVE_EVERY = 6;
/** No side fields more walkers than this at once. */
export const MINION_CAP = 6;
/** Seconds between swings at a wall, and between shovelfuls of hill. */
export const BITE_EVERY = 0.9;
export const DIG_EVERY = 0.5;
/** How far ahead a walker reads the ground, and the slows it takes uphill. */
const LOOK = 14;
const UPHILL_SLOW = 0.55;
/** The pace of hauling yourself up a natural face past your own climb limit. */
const SCRAMBLE_SLOW = 0.38;
/** A tunneller bores with a slight upward pitch, so a pit is never forever. */
const TUNNEL_RISE = 0.35;
/**
 * A ledge this tall is a step, not a wall — it comes off the rise before the
 * slope is judged. Without it the 14px lookahead turned every lump of terrain
 * noise into a spike of "slope", and columns stood refusing hillsides a player
 * can see are perfectly walkable (a phone screenshot of exactly that is why
 * this constant exists). Real cliffs and fresh crater walls still say no.
 */
const STEP_FREE = 10;

/** Everything a faction can muster at this point of the campaign. */
export function unlockedMinions(faction, stage) {
  return Object.values(MINIONS)
    .filter((s) => s.faction === faction && s.unlock <= stage)
    .sort((a, b) => a.unlock - b.unlock);
}

/** Put one walker on the field. The shape every other function reads. */
export function summon(match, kind, side, x) {
  const spec = MINIONS[kind];
  // no two of a kind are quite the same size — it is the cheapest possible
  // way to make a column read as individuals instead of a rubber stamp
  const n = Math.sin(x * 12.9898 + (side === 'player' ? 1 : 7)) * 43758.5453;
  const frac = n - Math.floor(n);
  const mn = {
    kind, side, x,
    y: match.terrain.yAt(x),
    hp: spec.hp, max: spec.hp,
    t: 0, age: 0, hitT: 0, digT: 0,
    s: 0.92 + frac * 0.18,
    tone: frac,
    stuck: false, moving: false, fighting: false, digging: false, scramble: false,
    underground: false, coverY: 0,
  };
  match.minions.push(mn);
  return mn;
}

/**
 * A wave: the basic kind flanking whatever the campaign has unlocked, spawned
 * at the gate of its own castle, already staggered into a column.
 */
export function spawnWave(match, side, stage) {
  const roster = unlockedMinions(match.faction[side], stage);
  if (!roster.length) return 0;
  const alive = match.minions.filter((m) => m.side === side).length;
  const dir = side === 'player' ? 1 : -1;
  const gate = side === 'player' ? CASTLE_X.player + COLS * CELL + 30 : CASTLE_X.enemy - 30;
  const squad = [roster[0], ...roster.slice(1), roster[0]];

  let spawned = 0;
  for (const spec of squad) {
    if (alive + spawned >= MINION_CAP) break;
    const mn = summon(match, spec.id, side, gate + dir * spawned * 20);
    mn.t = spawned * 0.7; // so a column does not bob in lockstep
    spawned++;
  }
  if (spawned) match.say('wave', { side, n: spawned });
  return spawned;
}

/**
 * The wall a walker from `attackerSide` gnaws: the lowest block of the nearest
 * occupied column. The king is not an exception — he is the last block left.
 */
export function wallTarget(castle, attackerSide) {
  const fromLeft = attackerSide === 'player';
  for (let i = 0; i < COLS; i++) {
    const c = fromLeft ? i : COLS - 1 - i;
    for (let r = 0; r < ROWS; r++) {
      const b = castle.at(c, r);
      if (b) return b;
    }
  }
  return null;
}

/** Remove the fallen, with a word to the renderer about each. */
export function reapMinions(match) {
  for (let i = match.minions.length - 1; i >= 0; i--) {
    const m = match.minions[i];
    if (m.hp > 0) continue;
    match.minions.splice(i, 1);
    match.say('mdie', { x: m.x, y: m.y - 10, side: m.side, kind: m.kind });
  }
}

/**
 * One step of the ground war. Returns true when a castle cell was broken or
 * the crown was bitten — the caller owes the world a `sweep` for that.
 */
export function tickMinions(match, h) {
  let broke = false;
  const list = match.minions;

  for (const m of list) {
    const spec = MINIONS[m.kind];
    const dir = m.side === 'player' ? 1 : -1;
    m.t += h;
    m.age += h;
    m.moving = false;
    m.fighting = false;
    m.digging = false;

    // 0. under the hill nothing reaches it and it reaches nothing: it bores
    // on at tunnel speed and surfaces where the ground comes back down to it —
    // which a well-placed crater can arrange early
    if (m.underground) {
      m.digging = true;
      m.x = clamp(m.x + dir * spec.dig * h, 20, W - 20);
      // boring slightly upward is what guarantees daylight: entered from the
      // bottom of a crater, a level tunnel would ride under the whole map
      m.y -= spec.dig * TUNNEL_RISE * h;
      m.coverY = match.terrain.yAt(m.x);
      m.digT -= h;
      if (m.digT <= 0) {
        m.digT = DIG_EVERY;
        match.say('mdig', { x: m.x, y: m.coverY - 4 });
      }
      if (m.coverY >= m.y - 2) {
        m.underground = false;
        m.y = match.terrain.yAt(m.x);
      }
      continue;
    }

    // 1. the fight in front of everything else
    let foe = null;
    let foeD = Infinity;
    for (const o of list) {
      if (o.side === m.side || o.underground) continue;
      const d = Math.abs(o.x - m.x);
      if (d < foeD && d <= spec.reach + 6 && Math.abs(o.y - m.y) < 40) {
        foe = o;
        foeD = d;
      }
    }
    if (foe) {
      m.fighting = true;
      foe.hp -= spec.mdps * h;
      continue;
    }

    // 2. the wall
    const castle = match.castles[other(m.side)];
    const target = wallTarget(castle, m.side);
    if (target) {
      const at = castle.centre(target.c, target.r);
      const face = at.x - dir * (CELL / 2 + 8);
      if ((m.x - face) * dir >= -1) {
        m.fighting = true;
        m.hitT -= h;
        if (m.hitT <= 0) {
          m.hitT = BITE_EVERY;
          // the crown is armoured against teeth: walkers finish a siege, they
          // do not decide one on their own
          const dmg = target.m === 'king' ? spec.bite * 0.6 : spec.bite;
          target.hp -= dmg;
          target.shake = 1;
          if (target.m === 'king') {
            match.say('kinghit', { side: castle.side, damage: dmg, hp: Math.max(0, target.hp), ...at });
          } else {
            match.say('mhit', { x: m.x + dir * 12, y: m.y - 14 });
          }
          if (target.hp <= 0) broke = true;
        }
        continue;
      }
    }

    // 3. hold formation: nobody walks through the back of their own column —
    // which is what makes killing a blocker free everyone queued behind it
    let queued = false;
    for (const o of list) {
      if (o === m || o.side !== m.side) continue;
      const gap = (o.x - m.x) * dir;
      if (gap > 0 && gap < 16 && Math.abs(o.y - m.y) < 30) {
        queued = true;
        break;
      }
    }
    if (queued) continue;

    // 4. the ground has a say — but only ground a shell has already chewed.
    // Born steepness, vertical included, is a scramble; a raw crater face
    // past this kind's limit is the one thing that stands in the road.
    const aheadX = m.x + dir * LOOK;
    const rise = m.y - match.terrain.yAt(aheadX);
    const slope = rise > STEP_FREE ? (rise - STEP_FREE) / LOOK : 0;
    m.scramble = false;
    if (slope > spec.climb) {
      if (match.terrain.scarred(m.x + dir * 2, aheadX)) {
        if (spec.dig > 0) {
          // into the wall, then. Sculpting a ramp with `carve` was tried
          // first and stalls — on a real face the next column up is always
          // just out of a buried shovel's reach, and the digger chips at the
          // toe forever.
          m.underground = true;
          m.digging = true;
          m.coverY = m.y;
        } else {
          m.stuck = true;
        }
        continue;
      }
      m.scramble = true;
    }

    // 5. march
    m.stuck = false;
    m.moving = true;
    const pace = m.scramble ? SCRAMBLE_SLOW : slope > 0.4 ? UPHILL_SLOW : 1;
    m.x = clamp(m.x + dir * spec.speed * h * pace, 20, W - 20);
    m.y = match.terrain.yAt(m.x);
  }

  reapMinions(match);
  return broke;
}
