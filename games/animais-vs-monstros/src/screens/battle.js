// The battle: the board, the waves and every combat rule.
//
// A board of 5 rows by 9 columns. Monsters come in from the right and walk
// left; if one of them crosses the fence, the stage is over.

import { shape, ellipse, circle, line, stroke, box, text, wrapText, shadow, putSprite, rng } from '../scribble.js';
import { INK, INK_SOFT, COLORS, PAPER, withAlpha } from '../palette.js';
import { animalSprite } from '../draw/animals.js';
import { monsterSprite } from '../draw/monsters.js';
import { stageBackdrop } from '../draw/scenery.js';
import { cardAtLevel } from '../data/animals.js';
import { MONSTER_BY_ID } from '../data/monsters.js';
import { vp, HEIGHT } from '../viewport.js';
import { sfx, playMusic, stopMusic } from '../audio.js';
import { pick } from '../i18n.js';

/** A short haptic tap where the device has one. Silent where it doesn't. */
function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

const T = {
  waterOnly: { pt: 'só bicho de água aqui', en: 'water animals only here' },
  noSeeds: { pt: 'sem sementes', en: 'not enough seeds' },
  bossBackup: { pt: 'A Cuca chamou reforço!', en: 'The Cuca called for backup!' },
  bossDown: { pt: 'A Cuca caiu. O Brasil respira.', en: 'The Cuca is down. Brazil breathes.' },
  humans: { pt: 'HUMANOS', en: 'HUMANS' },
  here: { pt: 'AQUI', en: 'HERE' },
  seeds: { pt: 'sementes', en: 'seeds' },
  stage: { pt: 'FASE {n}', en: 'STAGE {n}' },
  remove: { pt: 'tirar', en: 'remove' },
  stageWon: { pt: 'FASE VENCIDA', en: 'STAGE WON' },
  theyPassed: { pt: 'ELES PASSARAM', en: 'THEY GOT THROUGH' },
  monstersDropped: { pt: '{n} monstros derrubados', en: '{n} monsters dropped' },
  fenceFailed: { pt: 'a cerca não segurou', en: 'the fence did not hold' },
  seedSources: {
    pt: '{kills} sementes vieram deles · {picks} do chão',
    en: '{kills} seeds came from them · {picks} from the ground',
  },
};

const fill = (field, values) => {
  const raw = pick(field);
  return values ? String(raw).replace(/\{(\w+)\}/g, (w, k) => (k in values ? values[k] : w)) : raw;
};

const ROWS = 5;
const COLS = 9;
const FENCE_X = 128;
const CARDS_X0 = 196;
const CARD_MAX = 116;

// Everything here is recomputed by `applyLayout`, because it depends on two
// moving things: the window width (the board stretches with it) and how many
// cards the player has — with a full deck, a single row of cards would spill
// off the screen. Since there is one battle at a time, module state is enough.
let HUD_H = 104;
let FIELD_Y = HUD_H;
let FIELD_H = HEIGHT - FIELD_Y;
let ROW_H = FIELD_H / ROWS;
let CELL_W = (1280 - FENCE_X - 10) / COLS;
let CARD_W = 96;
let CARD_H = 88;
let CARDS_PER_ROW = 9;
let TOUCH = false;

function applyLayout(cardCount) {
  TOUCH = vp.touch;
  // The cell is nearly square and has a size ceiling. Letting the 9 columns
  // stretch to the edge on an ultrawide would give 195x123 cells — ugly, and
  // worse, with the monster taking twice as long to cross each one. With a
  // ceiling, the leftover width becomes open track on the right: you see the
  // horde coming from far off, which is a big-screen advantage that doesn't
  // touch the balance.
  CELL_W = Math.min(118, (vp.W - FENCE_X - 10) / COLS);

  const band = vp.W - 116 - CARDS_X0;
  // On touch the card never goes below 104 — a finger lacks a mouse's
  // precision, and missing a card in the middle of a horde costs the stage. On
  // a mouse it can shrink a lot more, and that is what keeps a big deck on a
  // single row: two rows of cards eat a quarter of the screen height.
  // 94 logical ≈ 51pt on a phone in landscape, above the comfortable 44pt
  const minimum = TOUCH ? 94 : 72;
  const fitting = Math.max(1, Math.floor(band / (minimum + 6)));
  const rows = Math.min(2, Math.ceil(cardCount / fitting));
  CARDS_PER_ROW = Math.ceil(cardCount / rows);
  CARD_W = Math.max(minimum, Math.min(CARD_MAX, band / CARDS_PER_ROW - 6));
  CARD_H = rows > 1 ? 74 : TOUCH ? 96 : 88;
  HUD_H = 16 + rows * (CARD_H + 8);
  FIELD_Y = HUD_H;
  FIELD_H = HEIGHT - FIELD_Y;
  ROW_H = FIELD_H / ROWS;
  return rows;
}

const centerX = (col) => FENCE_X + col * CELL_W + CELL_W / 2;
const centerY = (row) => FIELD_Y + row * ROW_H + ROW_H / 2;
const colAt = (x) => Math.floor((x - FENCE_X) / CELL_W);
const rowAt = (y) => Math.floor((y - FIELD_Y) / ROW_H);

/** Where each card sits in the HUD, given its index. */
function cardBox(i) {
  const row = Math.floor(i / CARDS_PER_ROW);
  const col = i % CARDS_PER_ROW;
  return {
    x: CARDS_X0 + col * (CARD_W + 6),
    y: 8 + row * (CARD_H + 8),
    w: CARD_W,
    h: CARD_H,
  };
}

/** Builds a battle. `onDone(won, summary)` is called exactly once. */
export function createBattle(stage, deck, onDone, levels = {}) {
  // every card enters the field with the numbers of the level it was trained to
  const cards = deck.map((id) => cardAtLevel(id, levels[id] || 1)).filter(Boolean);
  const waters = new Set(stage.water || []);

  // has to come before anything else: the field size comes from here, and the
  // scenery is painted at those measurements
  applyLayout(cards.length);

  const st = {
    stage,
    time: 0,
    seeds: stage.startingSeeds,
    planted: [],
    monsters: [],
    shots: [],
    drops: [],
    particles: [],
    floaters: [],
    cooldowns: Object.fromEntries(cards.map((c) => [c.id, 0])),
    selected: null,
    currentWave: -1,
    nextWave: 4,
    queued: [],
    over: false,
    won: false,
    paused: false,
    // where each seed came from — the end-of-stage screen shows this
    killGain: 0,
    pickupGain: 0,
    notice: stage.whatsNew ? { field: stage.whatsNew.note, t: 7 } : null,
    shake: 0,
    killed: 0,
    revealed: false,
    endedAt: 0,
    shovel: false, // digs a planted animal back out
  };

  let backdrop = stageBackdrop(stage.scenery, vp.W, FIELD_H);
  let idSeq = 1;

  /**
   * The window changed size. Puts the creatures back on the new cells — without
   * this, whatever was already planted would sit off the grid after a resize.
   */
  function resize() {
    applyLayout(cards.length);
    backdrop = stageBackdrop(stage.scenery, vp.W, FIELD_H);
    for (const p of st.planted) {
      p.x = centerX(p.col) + (p.advance || 0);
      p.y = centerY(p.row);
    }
    for (const m of st.monsters) m.y = centerY(m.row);
    for (const d of st.drops) d.targetY = Math.min(d.targetY, HEIGHT - 20);
  }

  // ----------------------------------------------------------------- helpers

  function isWater(row) {
    return waters.has(row);
  }

  function occupied(row, col) {
    return st.planted.some((p) => p.row === row && p.col === col && p.hp > 0);
  }

  // keeps the FIELD like the notice does: a bilingual value resolved here
  // would sit on screen in the language the player just left
  function floatText(x, y, txt, color = COLORS.seed) {
    st.floaters.push({ x, y, txt, color, t: 1.1 });
  }

  function spark(x, y, color, count = 8, force = 90) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = force * (0.4 + Math.random() * 0.8);
      st.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
        t: 0.4 + Math.random() * 0.4, tMax: 0.8, color, r: 2 + Math.random() * 3,
      });
    }
  }

  // ---------------------------------------------------------------- building

  function plant(card, row, col) {
    if (isWater(row) && !card.aquatic) {
      floatText(centerX(col), centerY(row), T.waterOnly, COLORS.danger);
      sfx.error();
      return false;
    }
    st.planted.push({
      id: idSeq++,
      def: card,
      row,
      col,
      x: centerX(col),
      y: centerY(row),
      hp: card.hp,
      maxHp: card.hp,
      cd: card.role === 'generator' ? card.interval * 0.6 : (card.interval || 1) * 0.5,
      born: st.time,
      shake: 0,
      advance: 0,
    });
    st.seeds -= card.cost;
    st.cooldowns[card.id] = card.cooldown;
    sfx.plant();
    spark(centerX(col), centerY(row) + 30, '#8a6a44', 6, 60);
    return true;
  }

  function removePlanted(p) {
    p.hp = 0;
    spark(p.x, p.y, '#9c8a6a', 10, 80);
  }

  // ------------------------------------------------------------------- waves

  function releaseWave(index) {
    const wave = stage.waves[index];
    if (!wave) return;
    sfx.wave();
    const queue = [];
    for (const [kind, howMany] of wave.monsters) {
      for (let i = 0; i < howMany; i++) queue.push(kind);
    }
    // spread the wave over time and rows, or they all come in glued together
    queue.sort(() => Math.random() - 0.5);
    queue.forEach((kind, i) => {
      st.queued.push({
        kind,
        when: st.time + i * (0.55 + Math.random() * 0.5),
        row: Math.floor(Math.random() * ROWS),
      });
    });
  }

  /**
   * Which row this monster enters the board on.
   *
   * Water separates two worlds, and in both directions: a land creature doesn't
   * come down a flooded lane, and a river creature **only** comes down one.
   * Without the second half, the Iara appeared in the middle of the pasture,
   * where nobody is waiting for her.
   *
   * Fliers count as land creatures here, and that is deliberate: over a flooded
   * lane you can only plant aquatic animals, and none of them has `air` — a
   * flier there would be untouchable, which is the Iara hole coming in through
   * another door.
   *
   * Returns `null` when no row is possible — that only happens if a stage with
   * no water calls in an aquatic monster, which the stage cast doesn't do (and
   * the data test enforces).
   */
  function entryRow(def, suggested) {
    const rollOne = (rows) => (rows.length ? rows[Math.floor(Math.random() * rows.length)] : null);
    const all = [...Array(ROWS).keys()];
    if (def.aquatic) return isWater(suggested) ? suggested : rollOne(all.filter((r) => isWater(r)));
    if (def.swap) return suggested; // the amphibian enters wherever: it becomes what the terrain asks
    if (!isWater(suggested)) return suggested;
    return rollOne(all.filter((r) => !isWater(r))) ?? suggested;
  }

  /** The shape the amphibian takes in a row: dolphin in the river, man on land. */
  function formAt(row) {
    return isWater(row) ? 'boto' : 'man';
  }

  const spriteForRow = (row) => (formAt(row) === 'boto' ? 'boto' : 'botohomem');

  /**
   * The Boto moves to the neighbouring row and becomes what the terrain asks.
   *
   * He **prefers** the row that changes his shape: it is the legend on the
   * field (into the water, out onto the bank as a young man) and, from the
   * player's side, it is what demands defending the water *and* the bank
   * instead of stacking everything in one row. With no neighbour that changes
   * the terrain he switches rows anyway — dodging is half his threat.
   */
  function switchRow(m) {
    const neighbours = [m.row - 1, m.row + 1].filter((r) => r >= 0 && r < ROWS);
    if (!neighbours.length) return;
    const changesTerrain = neighbours.filter((r) => isWater(r) !== isWater(m.row));
    const candidates = changesTerrain.length ? changesTerrain : neighbours;
    const target = candidates[Math.floor(Math.random() * candidates.length)];

    const before = m.form;
    m.row = target;
    m.y = centerY(target);
    m.biting = false;
    m.form = formAt(target);
    m.sprite = spriteForRow(target);
    if (m.form !== before) {
      spark(m.x, m.y, m.form === 'boto' ? COLORS.water : '#efe4cc', 16, 130);
      sfx.splash();
    } else {
      spark(m.x, m.y, '#cfd8c8', 6, 70);
    }
  }

  function spawnMonster(kind, suggestedRow) {
    const def = MONSTER_BY_ID[kind];
    if (!def) return;
    const row = entryRow(def, suggestedRow);
    if (row === null) return;
    st.monsters.push({
      id: idSeq++,
      def,
      row,
      x: vp.W + 40 + Math.random() * 60,
      y: centerY(row),
      hp: def.hp,
      maxHp: def.hp,
      cd: 0,
      jumped: false,
      jumping: 0,
      frozen: 0,
      stunned: 0,
      dots: [],
      enraged: false,
      bossPhase: 0,
      summonCd: 6,
      swapCd: def.swap ? def.swap.interval : 0,
      // the amphibian arrives already wearing the face of the terrain it landed on
      sprite: def.swap ? spriteForRow(row) : def.id,
      form: def.swap ? formAt(row) : null,
      shake: 0,
      gait: Math.random() * 10,
    });
    if (def.boss) {
      sfx.boss();
      st.shake = 1.2;
      st.notice = { field: () => `${pick(def.name)} — ${pick(def.lore)}`, t: 6 };
    } else if (def.miniboss) {
      sfx.boss();
      st.shake = 0.6;
    }
  }

  function isVisible(m) {
    // the hidden one only shows with a revealer on the field, or while biting
    return !m.def.hidden || st.revealed || m.biting;
  }

  // ------------------------------------------------------------------ damage

  function damage(m, amount, fromAir = false, ignoreArmor = false) {
    if (m.def.flies && !fromAir) return false;
    let real = amount;
    if (m.def.armor && !ignoreArmor) real = Math.max(amount * 0.25, amount - m.def.armor);
    m.hp -= real;
    m.shake = 0.12;
    if (m.hp <= 0) kill(m);
    return true;
  }

  function kill(m) {
    if (m.dead) return;
    m.dead = true;
    st.killed++;

    // A monster returns seed when it falls, and that goes straight to the
    // balance — in the middle of a fight nobody has a spare hand to click each
    // drop. It is the income that doesn't depend on having planted a generator:
    // holding the line pays for itself.
    const prize = m.def.worth || 10;
    st.seeds += prize;
    st.killGain += prize;
    floatText(m.x, m.y - 34, `+${prize}`, COLORS.seed);

    spark(m.x, m.y, m.def.boss ? '#e0913a' : '#8a7a64', m.def.boss ? 40 : 12, m.def.boss ? 220 : 110);
    sfx.death();
    if (prize >= 50) sfx.coin();
    if (m.def.boss) {
      st.shake = 1.6;
      st.notice = { field: T.bossDown, t: 5 };
    }
  }

  function hurtPlanted(p, amount) {
    p.hp -= amount;
    p.shake = 0.14;
    if (p.hp <= 0) {
      spark(p.x, p.y, '#9c8a6a', 12, 90);
      sfx.bite();
    }
  }

  // ------------------------------------------------------------------ update

  function stepPlanted(dt) {
    st.revealed = st.planted.some((p) => p.hp > 0 && p.def.reveals);

    for (const p of st.planted) {
      if (p.hp <= 0) continue;
      const d = p.def;
      p.shake = Math.max(0, p.shake - dt);
      p.cd -= dt;

      // the jaguar creeps forward until it finds trouble
      if (d.advances) {
        const targetAhead = st.monsters.some((m) => !m.dead && m.row === p.row && m.x > p.x && m.x < p.x + CELL_W * 1.2);
        if (!targetAhead && p.advance < CELL_W * 0.8) {
          p.advance += 8 * dt;
          p.x = centerX(p.col) + p.advance;
        }
      }

      if (p.cd > 0) continue;

      switch (d.role) {
        case 'generator': {
          p.cd = d.interval / (stage.seedFactor || 1);
          // falls beside the animal, not on top of it, so there is somewhere to click
          st.drops.push({
            x: p.x + (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 22),
            y: p.y - 24,
            targetY: p.y + 34,
            value: d.yield,
            t: 9,
            spin: Math.random() * 6,
          });
          break;
        }

        case 'shooter': {
          const targets = st.monsters.filter(
            (m) => !m.dead && m.row === p.row && m.x > p.x - 10 && isVisible(m) && (!m.def.flies || d.air)
          );
          if (!targets.length) {
            p.cd = 0.1;
            break;
          }
          p.cd = d.interval;
          p.shotAt = st.time;
          st.shots.push({
            x: p.x + 26,
            y: p.y - 8,
            row: p.row,
            speed: 420,
            damage: d.damage,
            kind: d.projectile || 'coconut',
            pierces: !!d.pierces,
            air: !!d.air,
            poison: d.poison || null,
            hit: new Set(),
            spin: 0,
          });
          sfx.shot();
          break;
        }

        case 'bruiser': {
          const target = st.monsters.find(
            (m) => !m.dead && m.row === p.row && Math.abs(m.x - p.x) < CELL_W * 0.85 && isVisible(m) && !m.def.flies
          );
          if (!target) {
            p.cd = 0.1;
            break;
          }
          p.cd = d.interval;
          p.hitAt = st.time;
          damage(target, d.damage);
          if (d.knockback) target.x += d.knockback;
          spark(target.x - 20, target.y, COLORS.danger, 6, 80);
          sfx.hit();
          break;
        }

        case 'area': {
          const near = st.monsters.filter(
            (m) => !m.dead && Math.hypot(m.x - p.x, m.y - p.y) < d.radius * CELL_W && isVisible(m)
          );
          if (!near.length) {
            p.cd = 0.2;
            break;
          }
          p.cd = d.interval;
          p.pulsedAt = st.time;
          for (const m of near) {
            damage(m, d.damage, true);
            if (d.slow) m.frozen = Math.max(m.frozen, d.slow.duration);
            if (d.stun) m.stunned = Math.max(m.stunned, d.stun);
          }
          if (d.slow) sfx.ice();
          if (d.stun) sfx.roar();
          st.shake = Math.max(st.shake, 0.3);
          break;
        }

        case 'bomb': {
          const near = st.monsters.filter(
            (m) => !m.dead && Math.hypot(m.x - p.x, m.y - p.y) < d.radius * CELL_W * 0.6 && isVisible(m)
          );
          if (!near.length) {
            p.cd = 0.1;
            break;
          }
          for (const m of near) damage(m, d.damage, true, true);
          spark(p.x, p.y, '#8a9b5c', 26, 190);
          sfx.blast();
          st.shake = Math.max(st.shake, 0.7);
          removePlanted(p);
          break;
        }

        default:
          p.cd = 1;
      }
    }

    st.planted = st.planted.filter((p) => p.hp > 0);
  }

  function stepMonsters(dt) {
    for (const m of st.monsters) {
      if (m.dead) continue;
      const d = m.def;
      m.shake = Math.max(0, m.shake - dt);
      m.frozen = Math.max(0, m.frozen - dt);
      m.stunned = Math.max(0, m.stunned - dt);
      m.cd -= dt;
      m.gait += dt;

      // poison and burning
      for (const dot of m.dots) {
        dot.t -= dt;
        dot.pool += dot.damage * dt;
        if (dot.pool >= 1) {
          const whole = Math.floor(dot.pool);
          dot.pool -= whole;
          m.hp -= whole;
          if (m.hp <= 0) kill(m);
        }
      }
      m.dots = m.dots.filter((x) => x.t > 0);
      if (m.dead) continue;

      // boss: phases and summoning
      if (d.phases) {
        const frac = m.hp / m.maxHp;
        while (m.bossPhase < d.phases.length && frac <= d.phases[m.bossPhase].hp) {
          st.notice = { field: d.phases[m.bossPhase].line, t: 4 };
          st.shake = 1;
          sfx.boss();
          m.bossPhase++;
        }
      }
      if (d.summons) {
        m.summonCd -= dt;
        if (m.summonCd <= 0) {
          m.summonCd = d.summons.interval;
          for (let i = 0; i < d.summons.count; i++) {
            const kind = d.summons.types[Math.floor(Math.random() * d.summons.types.length)];
            spawnMonster(kind, Math.floor(Math.random() * ROWS));
          }
          st.notice = { field: T.bossBackup, t: 2.5 };
        }
      }

      // gets faster the more it is hit
      const trigger = d.enrage || d.charge;
      if (trigger && !m.enraged && m.hp / m.maxHp <= trigger.trigger) {
        m.enraged = true;
        sfx.roar();
        spark(m.x, m.y, COLORS.fire, 10, 100);
      }

      if (m.stunned > 0) continue;

      // the amphibian changes row before looking for a target: if it just
      // jumped to the bank, what matters is the defence of the new row
      if (d.swap) {
        m.swapCd -= dt;
        if (m.swapCd <= 0) {
          m.swapCd = d.swap.interval;
          switchRow(m);
        }
      }

      // who is in front of it in this row?
      const target = st.planted.find(
        (p) => p.hp > 0 && p.row === m.row && m.x - p.x < (d.range ? CELL_W * d.range : CELL_W * 0.62) && m.x > p.x
      );

      // the Saci jumps the first defence it meets
      if (target && d.jumps && !m.jumped) {
        m.jumped = true;
        m.jumping = 0.6;
        sfx.click();
      }

      if (m.jumping > 0) {
        m.jumping -= dt;
        m.x -= 150 * dt;
        continue;
      }

      // a flier ignores whoever is on the ground
      if (target && !d.flies) {
        m.biting = true;
        if (m.cd <= 0) {
          m.cd = d.interval;
          hurtPlanted(target, d.damage);
          sfx.bite();
          if (target.def.spikes) damage(m, target.def.spikes, true, true);
          if (d.burn) m.burnMark = true;
          spark(target.x + 18, target.y, COLORS.danger, 5, 70);
        }
        // the ranged one burns/spits without coming close
        if (d.range && d.burn) {
          target.burning = 0.4;
        }
        continue;
      }

      m.biting = false;
      let speed = d.speed;
      if (m.enraged) speed *= (d.enrage || d.charge).factor;
      if (m.frozen > 0) speed *= 0.45;
      m.x -= speed * dt;

      if (m.x < FENCE_X - 10) {
        finish(false);
        return;
      }
    }

    st.monsters = st.monsters.filter((m) => !m.dead);
  }

  function stepShots(dt) {
    for (const sh of st.shots) {
      sh.x += sh.speed * dt;
      sh.spin += dt * 8;
      const targets = st.monsters.filter(
        (m) => !m.dead && m.row === sh.row && !sh.hit.has(m.id) &&
          Math.abs(m.x - sh.x) < 34 && isVisible(m) && (!m.def.flies || sh.air)
      );
      for (const m of targets) {
        sh.hit.add(m.id);
        damage(m, sh.damage, sh.air);
        if (sh.poison) m.dots.push({ damage: sh.poison.damage, t: sh.poison.duration, pool: 0, color: '#8a9b5c' });
        spark(sh.x, sh.y, '#c9a86a', 5, 70);
        sfx.hit();
        if (!sh.pierces) {
          sh.dead = true;
          break;
        }
      }
      if (sh.x > vp.W + 30) sh.dead = true;
    }
    st.shots = st.shots.filter((sh) => !sh.dead);
  }

  function stepDrops(dt) {
    for (const d of st.drops) {
      d.t -= dt;
      d.spin += dt * 2;
      if (d.y < d.targetY) d.y = Math.min(d.targetY, d.y + 70 * dt);
      if (d.t <= 0) d.dead = true;
    }
    st.drops = st.drops.filter((d) => !d.dead);
  }

  function stepParticles(dt) {
    for (const p of st.particles) {
      p.t -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      if (p.t <= 0) p.dead = true;
    }
    st.particles = st.particles.filter((p) => !p.dead);

    for (const f of st.floaters) {
      f.t -= dt;
      f.y -= 26 * dt;
      if (f.t <= 0) f.dead = true;
    }
    st.floaters = st.floaters.filter((f) => !f.dead);
  }

  function stepWaves(dt) {
    // release the monsters already scheduled
    const ready = st.queued.filter((q) => q.when <= st.time);
    for (const q of ready) spawnMonster(q.kind, q.row);
    st.queued = st.queued.filter((q) => q.when > st.time);

    if (st.currentWave < stage.waves.length - 1) {
      st.nextWave -= dt;
      if (st.nextWave <= 0) {
        st.currentWave++;
        releaseWave(st.currentWave);
        const next = stage.waves[st.currentWave + 1];
        st.nextWave = next ? next.wait : 0;
      }
    } else if (!st.queued.length && !st.monsters.length && !st.over) {
      finish(true);
    }
  }

  function finish(won) {
    if (st.over) return;
    st.over = true;
    st.won = won;
    st.endedAt = st.time;
    stopMusic();
    if (won) sfx.victory();
    else sfx.defeat();
    setTimeout(
      () =>
        onDone(won, {
          killed: st.killed,
          time: st.time,
          leftover: Math.floor(st.seeds),
          killGain: st.killGain,
          pickupGain: st.pickupGain,
          // how many waves the player held: losing pays for that
          currentWave: st.currentWave,
          waves: stage.waves.length,
        }),
      1600
    );
  }

  // ------------------------------------------------------------------- cycle

  function update(dt) {
    if (st.paused || st.over) {
      stepParticles(dt);
      st.shake = Math.max(0, st.shake - dt * 2);
      return;
    }
    st.time += dt;
    st.shake = Math.max(0, st.shake - dt * 2);
    if (st.notice) {
      st.notice.t -= dt;
      if (st.notice.t <= 0) st.notice = null;
    }
    for (const id in st.cooldowns) st.cooldowns[id] = Math.max(0, st.cooldowns[id] - dt);

    stepPlanted(dt);
    stepMonsters(dt);
    stepShots(dt);
    stepDrops(dt);
    stepParticles(dt);
    stepWaves(dt);
  }

  // ------------------------------------------------------------------- input

  /** Picks up any seed under the finger/cursor. Returns how many it took. */
  function collectAt(x, y, radius = 46) {
    let taken = 0;
    for (const d of st.drops) {
      if (d.dead) continue;
      if (Math.hypot(d.x - x, d.y - y) < radius) {
        st.seeds += d.value;
        st.pickupGain += d.value;
        d.dead = true;
        floatText(d.x, d.y - 10, `+${d.value}`);
        taken++;
      }
    }
    if (taken) sfx.harvest();
    return taken;
  }

  function press(x, y) {
    if (st.over) return;
    st.dragging = true;
    st.pointer = { x, y };

    if (collectAt(x, y)) return;

    if (y < HUD_H) {
      hudTap(x, y);
      return;
    }
    // outside the HUD, a press only arms the aim — planting happens on release,
    // to give time to drag to the right cell with the finger still down
  }

  function hudTap(x, y) {
    for (let i = 0; i < cards.length; i++) {
      const b = cardBox(i);
      // a touch area with 4px of slack around the card's drawing
      if (x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4) {
        const c = cards[i];
        st.shovel = false;
        st.selected = st.selected === c ? null : c;
        sfx.card();
        vibrate(8);
        return;
      }
    }
    if (x > vp.W - 106 && y > 6 && y < HUD_H - 6) {
      st.shovel = !st.shovel;
      st.selected = null;
      sfx.click();
      vibrate(8);
    }
  }

  function release(x, y) {
    st.dragging = false;
    if (st.over) return;
    if (y < HUD_H) return;

    const row = rowAt(y);
    const col = colAt(x);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

    if (st.shovel) {
      const target = st.planted.find((p) => p.row === row && p.col === col && p.hp > 0);
      if (target) {
        // half back: getting the placement wrong can't cost the whole stage
        const refund = Math.floor(target.def.cost * 0.5);
        st.seeds += refund;
        floatText(target.x, target.y - 20, `+${refund}`, COLORS.good);
        removePlanted(target);
        sfx.click();
        vibrate(12);
      }
      st.shovel = false;
      return;
    }

    if (!st.selected) return;
    const card = st.selected;
    if (st.cooldowns[card.id] > 0) {
      sfx.error();
      return;
    }
    if (st.seeds < card.cost) {
      floatText(centerX(col), centerY(row), T.noSeeds, COLORS.danger);
      sfx.error();
      return;
    }
    if (occupied(row, col)) {
      sfx.error();
      return;
    }
    if (plant(card, row, col)) {
      st.selected = null;
      vibrate(14);
    }
  }

  function move(x, y) {
    st.pointer = { x, y };
    // dragging a finger over the seeds collects everything on the way: picking
    // them up one at a time with a precise tap is what tires most on a phone
    if (st.dragging && !st.over) collectAt(x, y);
  }

  // ----------------------------------------------------------------- drawing

  function drawField(ctx) {
    ctx.drawImage(backdrop, 0, FIELD_Y);

    // The lawn checkerboard. It is the genre's most recognisable element and
    // solves two things at once: it looks like a board, and it lets the player
    // count cells from far away without a single grid line.
    for (let r = 0; r < ROWS; r++) {
      const y = FIELD_Y + r * ROW_H;
      if (isWater(r)) {
        for (let c = 0; c < COLS; c++) {
          const x = FENCE_X + c * CELL_W;
          ctx.fillStyle = (r + c) % 2 ? 'rgba(74, 138, 168, 0.62)' : 'rgba(56, 116, 148, 0.68)';
          ctx.fillRect(x, y, CELL_W + 1, ROW_H + 1);
        }
        for (let i = 0; i < 9; i++) {
          stroke(ctx, [[FENCE_X + i * CELL_W, y + 20 + (i % 3) * 26], [FENCE_X + i * CELL_W + 60, y + 26 + (i % 3) * 26]], {
            color: withAlpha('#dff0f6', 0.55), width: 2, passes: 1, seed: 400 + r * 10 + i,
          });
        }
      } else {
        for (let c = 0; c < COLS; c++) {
          const x = FENCE_X + c * CELL_W;
          ctx.fillStyle = (r + c) % 2 ? 'rgba(150, 208, 88, 0.5)' : 'rgba(108, 172, 60, 0.5)';
          ctx.fillRect(x, y, CELL_W + 1, ROW_H + 1);
        }
      }
    }

    // Where the board ends and the approach track begins. Without that mark, on
    // a wide screen the player doesn't know how far they can plant.
    const fieldEnd = FENCE_X + COLS * CELL_W;
    if (fieldEnd < vp.W - 4) {
      const g = ctx.createLinearGradient(fieldEnd, 0, Math.min(vp.W, fieldEnd + 90), 0);
      g.addColorStop(0, 'rgba(30, 40, 20, 0.22)');
      g.addColorStop(1, 'rgba(30, 40, 20, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(fieldEnd, FIELD_Y, vp.W - fieldEnd, FIELD_H);
      line(ctx, fieldEnd, FIELD_Y, fieldEnd, HEIGHT, {
        color: 'rgba(43,38,34,0.3)', width: 2, passes: 1, seed: 611,
      });
    }

    // grass tufts on the joints, so the checkerboard doesn't read as a draughts board
    for (let r = 0; r <= ROWS; r++) {
      const y = FIELD_Y + r * ROW_H;
      if (r < ROWS && isWater(r)) continue;
      if (r > 0 && isWater(r - 1)) continue;
      for (let c = 0; c < COLS; c += 1) {
        const x = FENCE_X + c * CELL_W + CELL_W / 2;
        stroke(ctx, [[x - 9, y], [x - 4, y - 7], [x, y]], {
          color: 'rgba(58, 104, 34, 0.5)', width: 2, passes: 1, seed: 700 + r * 13 + c,
        });
        stroke(ctx, [[x + 2, y], [x + 7, y - 9], [x + 11, y]], {
          color: 'rgba(58, 104, 34, 0.42)', width: 2, passes: 1, seed: 760 + r * 13 + c,
        });
      }
    }

    // The yard where the humans are: packed dirt and a solid plank fence. It is
    // the line that can't be crossed, so it has to look like a real barrier —
    // before, it was loose stakes floating in the grass.
    const gt = ctx.createLinearGradient(0, FIELD_Y, FENCE_X, FIELD_Y);
    gt.addColorStop(0, '#8a6a45');
    gt.addColorStop(1, '#a3835a');
    ctx.fillStyle = gt;
    ctx.fillRect(0, FIELD_Y, FENCE_X, FIELD_H);
    // pebbles on the dirt
    const rp = rng(940);
    ctx.save();
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 26; i++) {
      circle(ctx, rp() * (FENCE_X - 20) + 6, FIELD_Y + rp() * FIELD_H, 1.5 + rp() * 2.5, {
        color: null, fill: '#6b5232', seed: 950 + i,
      });
    }
    ctx.restore();

    // vertical planks pressed together, forming a wall
    for (let x = FENCE_X - 30; x < FENCE_X; x += 11) {
      shape(ctx, [[x, FIELD_Y], [x + 10, FIELD_Y], [x + 10, HEIGHT], [x, HEIGHT]], {
        color: '#5c4022', width: 1.6, fill: x % 22 === 0 ? '#8a6234' : '#7a5528', seed: 500 + x,
      });
    }
    // horizontal rails
    for (const fy of [0.16, 0.52, 0.88]) {
      const y = FIELD_Y + FIELD_H * fy;
      shape(ctx, [[FENCE_X - 34, y], [FENCE_X + 2, y], [FENCE_X + 2, y + 13], [FENCE_X - 34, y + 13]], {
        color: '#4a3218', width: 2, fill: '#9c7038', seed: 560 + fy * 100,
      });
    }
    line(ctx, FENCE_X, FIELD_Y, FENCE_X, HEIGHT, { color: '#3f2a14', width: 3, seed: 519 });

    // the sign nailed to the fence
    const py = FIELD_Y + FIELD_H / 2;
    const pw = FENCE_X - 42;
    const pcx = 6 + pw / 2;
    box(ctx, 6, py - 44, pw, 88, 8, { color: '#4a3218', width: 2.6, fill: '#c9a165', seed: 570 });
    text(ctx, pick(T.humans), pcx, py - 12, { size: 13, align: 'center', color: '#4a3218' });
    text(ctx, pick(T.here), pcx, py + 10, { size: 13, align: 'center', color: '#4a3218' });
    text(ctx, '↓', pcx, py + 34, { size: 19, align: 'center', color: '#7a5528' });
  }

  function drawPlanted(ctx) {
    for (const p of st.planted) {
      const d = p.def;
      const shakeX = p.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
      const justShot = d.role === 'shooter' && st.time - (p.shotAt || -9) < 0.16;
      const justHit = d.role === 'bruiser' && st.time - (p.hitAt || -9) < 0.18;
      const scale = 0.92 * (justShot ? 1.08 : 1) * (justHit ? 1.12 : 1);
      const bob = Math.sin(st.time * 2.4 + p.x) * 2;

      shadow(ctx, p.x, p.y + 46, 40, 12, 0.36);
      putSprite(ctx, animalSprite(d.id, 128), p.x + shakeX + (justHit ? 8 : 0), p.y + bob, scale, false);

      // the area animal's pulse
      if (d.role === 'area' && st.time - (p.pulsedAt || -9) < 0.5) {
        const t = (st.time - p.pulsedAt) / 0.5;
        circle(ctx, p.x, p.y, d.radius * CELL_W * t, {
          color: d.slow ? '#9fd4e6' : COLORS.accent, width: 3, alpha: 1 - t, seed: 9,
        });
      }

      // health, only when hurt
      if (p.hp < p.maxHp) {
        const frac = p.hp / p.maxHp;
        const bw = 54;
        ctx.fillStyle = 'rgba(43,38,34,0.35)';
        ctx.fillRect(p.x - bw / 2, p.y - 52, bw, 7);
        ctx.fillStyle = frac > 0.5 ? COLORS.good : frac > 0.25 ? COLORS.accent : COLORS.danger;
        ctx.fillRect(p.x - bw / 2, p.y - 52, bw * frac, 7);
      }
    }
  }

  function drawMonsters(ctx) {
    for (const m of st.monsters) {
      const d = m.def;
      if (!isVisible(m)) {
        // invisible: just a shape that hints at the position
        ctx.save();
        ctx.globalAlpha = 0.16;
        putSprite(ctx, monsterSprite(m.sprite || d.id, 128), m.x, m.y, (d.scale || 1) * 0.85);
        ctx.restore();
        continue;
      }
      const shakeX = m.shake > 0 ? (Math.random() - 0.5) * 7 : 0;
      const bob = Math.sin(m.gait * 6) * 3;
      const jump = m.jumping > 0 ? -Math.sin(((0.6 - m.jumping) / 0.6) * Math.PI) * 60 : 0;
      const scale = (d.scale || 1) * 0.94;

      shadow(ctx, m.x, m.y + 46, 38 * (d.scale || 1), 12 * (d.scale || 1), 0.36);
      ctx.save();
      if (m.frozen > 0) {
        ctx.filter = 'saturate(0.4)';
      }
      // `m.sprite` only exists for whoever changes shape (the Boto); the rest is the id
      putSprite(ctx, monsterSprite(m.sprite || d.id, 128), m.x + shakeX, m.y + bob + jump, scale, false, m.stunned > 0 ? 0.75 : 1);
      ctx.restore();

      if (m.frozen > 0) {
        circle(ctx, m.x, m.y, 40 * (d.scale || 1), { color: '#9fd4e6', width: 2.4, alpha: 0.5, seed: 11 });
      }
      if (m.stunned > 0) {
        for (let i = 0; i < 3; i++) {
          const a = st.time * 5 + (i / 3) * Math.PI * 2;
          text(ctx, '★', m.x + Math.cos(a) * 26, m.y - 56 + Math.sin(a) * 8, {
            size: 17, color: COLORS.accent, align: 'center',
          });
        }
      }
      if (m.dots.length) {
        circle(ctx, m.x + 22, m.y - 38, 6, { color: null, fill: withAlpha('#8a9b5c', 0.75), seed: 13 });
      }

      // health bar
      const frac = Math.max(0, m.hp / m.maxHp);
      const bw = d.boss ? 150 : d.miniboss ? 96 : 56;
      const by = m.y - 52 * (d.scale || 1) - 6;
      ctx.fillStyle = 'rgba(43,38,34,0.4)';
      ctx.fillRect(m.x - bw / 2, by, bw, d.boss ? 12 : 7);
      ctx.fillStyle = d.boss ? '#a8407a' : frac > 0.5 ? COLORS.danger : COLORS.accent;
      ctx.fillRect(m.x - bw / 2, by, bw * frac, d.boss ? 12 : 7);
      if (d.boss || d.miniboss) {
        text(ctx, pick(d.name), m.x, by - 8, { size: 15, align: 'center', color: PAPER, outline: INK, outlineWidth: 4 });
      }
    }
  }

  function drawShots(ctx) {
    for (const sh of st.shots) {
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.rotate(sh.spin);
      switch (sh.kind) {
        case 'coconut':
          circle(ctx, 0, 0, 9, { color: INK, width: 2, fill: '#6b4a2f', seed: 21 });
          circle(ctx, -3, -2, 2, { color: null, fill: '#3d2a1a', seed: 22 });
          break;
        case 'stinger':
          shape(ctx, [[-8, 0], [6, -4], [6, 4]], { color: INK, width: 1.6, fill: '#e5b93c', seed: 23 });
          break;
        case 'feather':
          shape(ctx, [[-9, 0], [0, -5], [9, 0], [0, 5]], { color: INK, width: 1.6, fill: '#e4d3ae', seed: 24 });
          break;
        case 'spit':
          ellipse(ctx, 0, 0, 12, 6, { color: '#5f7a44', width: 2, fill: '#9ab36e', seed: 25 });
          break;
        case 'talon':
          shape(ctx, [[-10, -6], [8, 0], [-10, 6], [-4, 0]], { color: INK, width: 2, fill: '#e8b23c', seed: 26 });
          break;
        case 'echo':
        default:
          circle(ctx, 0, 0, 7, { color: '#7d6688', width: 2, fill: withAlpha('#b9a4c4', 0.8), seed: 27 });
      }
      ctx.restore();
    }
  }

  function drawDrops(ctx) {
    for (const d of st.drops) {
      const blinking = d.t < 2.5 && Math.floor(d.t * 6) % 2 === 0;
      ctx.save();
      ctx.globalAlpha = blinking ? 0.45 : 1;
      ctx.translate(d.x, d.y);
      ctx.rotate(Math.sin(d.spin) * 0.25);
      ellipse(ctx, 0, 0, 15, 18, { color: '#8a6a2a', width: 2.4, fill: COLORS.seed, seed: 31 });
      shape(ctx, [[-6, -12], [6, -12], [3, -20], [-3, -20]], { color: '#6b5220', width: 2, fill: '#a87f34', seed: 32 });
      stroke(ctx, [[-6, 2], [0, 6], [6, 2]], { color: '#8a6a2a', width: 1.8, seed: 33 });
      ctx.restore();
    }
  }

  function drawParticles(ctx) {
    for (const p of st.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.t / p.tMax);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const f of st.floaters) {
      text(ctx, pick(f.txt), f.x, f.y, {
        size: 21, align: 'center', color: f.color, outline: PAPER, outlineWidth: 4, alpha: Math.min(1, f.t),
      });
    }
  }

  function drawWeather(ctx) {
    if (stage.night) {
      ctx.fillStyle = 'rgba(24, 26, 54, 0.34)';
      ctx.fillRect(0, FIELD_Y, vp.W, FIELD_H);
    }
    if (stage.fog && !st.revealed) {
      // the fog swallows the middle of the field; an Owl clears it all
      const g = ctx.createLinearGradient(FENCE_X + CELL_W * 2.4, 0, vp.W, 0);
      g.addColorStop(0, 'rgba(228, 232, 226, 0)');
      g.addColorStop(0.35, 'rgba(228, 232, 226, 0.82)');
      g.addColorStop(1, 'rgba(214, 220, 214, 0.92)');
      ctx.fillStyle = g;
      ctx.fillRect(FENCE_X, FIELD_Y, vp.W - FENCE_X, FIELD_H);
      for (let i = 0; i < 7; i++) {
        const x = FENCE_X + 420 + ((st.time * 12 + i * 190) % (vp.W - FENCE_X - 300));
        circle(ctx, x, FIELD_Y + 70 + i * 84, 60, { color: null, fill: 'rgba(255,255,255,0.28)', seed: 600 + i });
      }
    }
  }

  function drawAim(ctx) {
    if (!st.pointer || (!st.selected && !st.shovel)) return;
    const { x, y } = st.pointer;
    if (y < HUD_H) return;
    const row = rowAt(y);
    const col = colAt(x);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

    const cx = centerX(col);
    const cy = centerY(row);
    const free = !occupied(row, col);
    const waterOk = !isWater(row) || (st.selected && st.selected.aquatic);
    const ok = st.shovel ? !free : free && waterOk && st.seeds >= st.selected.cost;

    // highlight the whole cell: on touch the finger covers the centre, so what
    // guides is the thick frame around it and the ghost shifted upwards
    ctx.save();
    ctx.fillStyle = ok ? 'rgba(120, 200, 90, 0.3)' : 'rgba(200, 90, 70, 0.3)';
    ctx.fillRect(cx - CELL_W / 2, cy - ROW_H / 2, CELL_W, ROW_H);
    ctx.restore();
    box(ctx, cx - CELL_W / 2 + 4, cy - ROW_H / 2 + 4, CELL_W - 8, ROW_H - 8, 10, {
      color: ok ? COLORS.good : COLORS.danger, width: 5, seed: 77, alpha: 0.95,
    });
    if (st.selected && ok) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      putSprite(ctx, animalSprite(st.selected.id, 128), cx, cy - (st.dragging ? ROW_H * 0.55 : 0), 0.85);
      ctx.restore();
    }
    if (st.shovel) {
      text(ctx, '⛏', cx, cy - (st.dragging ? 50 : -10), {
        size: 44, align: 'center', color: COLORS.danger, outline: PAPER, outlineWidth: 5,
      });
    }
  }

  function drawHud(ctx) {
    // a wooden bar: the field is vivid green now and a pale HUD fought with it.
    // Dark wood pushes the board forward.
    const g = ctx.createLinearGradient(0, 0, 0, HUD_H);
    g.addColorStop(0, '#8a6234');
    g.addColorStop(0.5, '#6f4d28');
    g.addColorStop(1, '#5a3e20');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vp.W, HUD_H);
    // grain
    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 14; i++) {
      stroke(ctx, [[0, 8 + i * 7], [vp.W * 0.4, 10 + i * 7], [vp.W, 6 + i * 7]], {
        color: '#3f2a14', width: 1.6, passes: 1, seed: 800 + i,
      });
    }
    ctx.restore();
    line(ctx, 0, HUD_H - 1, vp.W, HUD_H - 1, { color: '#3f2a14', width: 4, seed: 88 });

    // seeds
    ellipse(ctx, 42, 40, 17, 20, { color: '#8a6a2a', width: 2.4, fill: COLORS.seed, seed: 91 });
    shape(ctx, [[36, 26], [48, 26], [45, 17], [39, 17]], { color: '#6b5220', width: 2, fill: '#a87f34', seed: 92 });
    text(ctx, String(Math.floor(st.seeds)), 70, 46, {
      size: 30, color: '#ffe9a8', outline: '#3f2a14', outlineWidth: 4,
    });
    text(ctx, pick(T.seeds), 70, 64, { size: 12, color: '#d9bd8a' });

    // cards
    cards.forEach((c, i) => {
      const b = cardBox(i);
      const cooldown = st.cooldowns[c.id];
      const affordable = st.seeds >= c.cost;
      const active = st.selected === c;
      const ready = cooldown <= 0 && affordable;

      // the chosen card grows and lifts: on touch there is no cursor to show
      // what's in hand, so the card itself has to say
      const dx = active ? -3 : 0;
      box(ctx, b.x + dx, b.y + dx, b.w - dx * 2, b.h - dx * 2, 10, {
        color: active ? COLORS.accentDark : INK,
        width: active ? 5 : 2.4,
        fill: ready ? '#fbf5e6' : '#ddd3c0',
        seed: 100 + i,
      });
      ctx.save();
      ctx.globalAlpha = ready ? 1 : 0.45;
      putSprite(ctx, animalSprite(c.id, 128), b.x + b.w / 2, b.y + b.h * 0.44, (b.h / 88) * 0.5);
      ctx.restore();
      text(ctx, pick(c.name), b.x + b.w / 2, b.y + 15, { size: 12, align: 'center', color: INK });
      // the training badge: whoever spent coins needs to see where they went
      if (c.levelLabel) {
        box(ctx, b.x + b.w - 26, b.y + 4, 22, 16, 4, {
          color: COLORS.accentDark, width: 1.8, fill: '#f7d98a', seed: 150 + i,
        });
        text(ctx, c.levelLabel, b.x + b.w - 15, b.y + 16, {
          size: 11, align: 'center', color: COLORS.accentDark,
        });
      }
      text(ctx, String(c.cost), b.x + b.w / 2, b.y + b.h - 5, {
        size: 18, align: 'center', color: affordable ? COLORS.accentDark : COLORS.danger,
      });

      if (cooldown > 0) {
        const frac = cooldown / c.cooldown;
        ctx.save();
        ctx.fillStyle = 'rgba(43, 38, 34, 0.45)';
        ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, (b.h - 4) * frac);
        ctx.restore();
      }
    });

    // wave progress, under the seed counter
    const waves = stage.waves.length;
    text(ctx, fill(T.stage, { n: stage.n }), 20, HUD_H - 12, { size: 12, color: '#d9bd8a' });
    const waveW = Math.min(22, (150 - 12) / waves - 4);
    for (let i = 0; i < waves; i++) {
      const filled = i <= st.currentWave;
      const last = i === waves - 1;
      box(ctx, 74 + i * (waveW + 4), HUD_H - 22, waveW, 12, 4, {
        color: '#3f2a14', width: 1.6,
        fill: filled ? (last ? '#a8407a' : COLORS.danger) : 'rgba(63, 42, 20, 0.4)',
        seed: 200 + i,
      });
    }

    // the shovel — a big target, hugging the corner, where the thumb reaches
    const sw = 84;
    box(ctx, vp.W - sw - 14, 10, sw, HUD_H - 22, 10, {
      color: st.shovel ? COLORS.danger : '#3f2a14',
      width: st.shovel ? 4.5 : 2.4,
      fill: st.shovel ? '#f2c0b4' : '#fbf5e6',
      seed: 300,
    });
    text(ctx, '⛏', vp.W - sw / 2 - 14, HUD_H / 2 + 4, { size: 34, align: 'center', color: INK });
    text(ctx, pick(T.remove), vp.W - sw / 2 - 14, HUD_H - 16, { size: 11, align: 'center', color: INK_SOFT });
  }

  function drawNotice(ctx) {
    if (!st.notice) return;
    const alpha = Math.min(1, st.notice.t);
    // NOT `text`: that is the imported drawing helper, and shadowing it here
    // turned the next call into "string is not a function"
    const notice = typeof st.notice.field === 'function' ? st.notice.field() : pick(st.notice.field);
    const lines = wrapText(ctx, notice, 760, 21);
    const h = 30 + lines.length * 28;
    const y = FIELD_Y + 30;
    ctx.save();
    ctx.globalAlpha = alpha;
    box(ctx, vp.W / 2 - 410, y, 820, h, 14, { color: INK, width: 3, fill: 'rgba(251, 245, 230, 0.95)', seed: 400 });
    lines.forEach((ln, i) => {
      text(ctx, ln, vp.W / 2, y + 34 + i * 28, { size: 21, align: 'center', color: INK });
    });
    ctx.restore();
  }

  function drawEnd(ctx) {
    if (!st.over) return;
    const t = Math.min(1, (st.time - st.endedAt) * 2);
    ctx.fillStyle = `rgba(20, 17, 14, ${0.7 * t})`;
    ctx.fillRect(0, 0, vp.W, HEIGHT);
    text(ctx, pick(st.won ? T.stageWon : T.theyPassed), vp.W / 2, HEIGHT / 2 - 10, {
      size: 64, align: 'center', color: st.won ? '#8fd48f' : '#e08a7a', outline: INK, outlineWidth: 8, alpha: t,
    });
    text(
      ctx,
      st.won ? fill(T.monstersDropped, { n: st.killed }) : pick(T.fenceFailed),
      vp.W / 2,
      HEIGHT / 2 + 40,
      { size: 24, align: 'center', color: PAPER, alpha: t }
    );
    if (st.won) {
      text(ctx, fill(T.seedSources, { kills: st.killGain, picks: st.pickupGain }), vp.W / 2, HEIGHT / 2 + 76, {
        size: 18, align: 'center', color: COLORS.seed, alpha: t,
      });
    }
  }

  function draw(ctx) {
    ctx.save();
    if (st.shake > 0) {
      ctx.translate((Math.random() - 0.5) * st.shake * 14, (Math.random() - 0.5) * st.shake * 14);
    }
    drawField(ctx);
    drawPlanted(ctx);
    drawMonsters(ctx);
    drawShots(ctx);
    // the seeds come after the animals: behind them, nobody could see to click
    drawDrops(ctx);
    drawWeather(ctx);
    drawParticles(ctx);
    drawAim(ctx);
    ctx.restore();
    drawHud(ctx);
    drawNotice(ctx);
    drawEnd(ctx);
  }

  function cancel() {
    st.dragging = false;
  }

  playMusic(stage.boss ? 0.8 : 0.3);

  return { update, draw, press, release, move, cancel, resize, st };
}
