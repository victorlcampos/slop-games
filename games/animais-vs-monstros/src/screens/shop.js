// Between one stage and the next: what you earned and three rolled cards to
// buy. The rolling happens in `rollCards`, in data/animals.js — it is pure
// arithmetic, and pure arithmetic lives where the unit test can reach it.

import { box, text, wrapText, paper, putSprite } from '../scribble.js';
import { INK, INK_SOFT, COLORS } from '../palette.js';
import { animalSprite } from '../draw/animals.js';
import { BY_ID, cardAtLevel, trainingCost, buyCard, toggleActive, DECK_LIMIT } from '../data/animals.js';
import { vp, HEIGHT, applyFrame, pointInFrame, menuWidth } from '../viewport.js';
import { sfx } from '../audio.js';
import { pick } from '../i18n.js';

const T = {
  stageWon: { pt: 'FASE VENCIDA', en: 'STAGE WON' },
  barracks: { pt: 'QUARTEL', en: 'BARRACKS' },
  visitSub: {
    pt: 'recrute, treine e escale o time — a batalha leva 14',
    en: 'recruit, train and pick the squad — the battle takes 14',
  },
  coins: { pt: 'moedas', en: 'coins' },
  change: { pt: '{base} + {change} de troco', en: '{base} + {change} in change' },
  monstersDropped: { pt: 'monstros derrubados', en: 'monsters dropped' },
  yieldedSeeds: { pt: 'renderam {n} sementes', en: 'yielded {n} seeds' },
  humansFreed: { pt: 'humanos libertados', en: 'humans freed' },
  millions: { pt: '{n} milhões', en: '{n} million' },
  youHave: { pt: 'você tem 🪙 {n}', en: 'you have 🪙 {n}' },
  recruitTab: { pt: 'RECRUTAR ({n})', en: 'RECRUIT ({n})' },
  squadTab: { pt: 'TIME {n}/{max}', en: 'SQUAD {n}/{max}' },
  trainTab: { pt: 'TREINAR ({n})', en: 'TRAIN ({n})' },
  squadHint: {
    pt: 'toque num bicho para trocá-lo entre o campo e a reserva',
    en: 'tap an animal to swap it between the field and the reserve',
  },
  inField: { pt: 'em campo', en: 'fielded' },
  inReserve: { pt: 'reserva', en: 'reserve' },
  squadFull: { pt: 'time cheio — tire alguém primeiro', en: 'squad full — bench someone first' },
  squadMin: { pt: 'o time precisa de pelo menos 3 bichos', en: 'the squad needs at least 3 animals' },
  toField: { pt: '{name} entrou em campo!', en: '{name} took the field!' },
  toReserve: { pt: '{name} foi para a reserva', en: '{name} went to the reserve' },
  joinedReserve: {
    pt: '{name} entrou na reserva — o time está cheio',
    en: '{name} joined the reserve — the squad is full',
  },
  waterWarning: {
    pt: '⚠ a próxima fase tem água e o time não tem bicho aquático!',
    en: '⚠ the next stage has water and the squad has no aquatic animal!',
  },
  nextStage: { pt: 'SEGUIR PARA A FASE {n}', en: 'ON TO STAGE {n}' },
  seeMap: { pt: 'VER O MAPA', en: 'SEE THE MAP' },
  deckComplete: { pt: 'Baralho completo!', en: 'Deck complete!' },
  deckCompleteSub: {
    pt: 'Não sobrou bicho para recrutar — treine os que você tem.',
    en: 'No animals left to recruit — train the ones you have.',
  },
  threeShowedUp: {
    pt: 'três apareceram desta vez — compre quantas quiser',
    en: 'three showed up this time — buy as many as you like',
  },
  inDeck: { pt: '✓ no baralho', en: '✓ in deck' },
  seedCost: { pt: 'custa {n} sementes em campo', en: 'costs {n} seeds on the field' },
  allMaxed: { pt: 'Todo mundo no nível máximo', en: 'Everyone at max level' },
  allMaxedSub: {
    pt: 'Não há mais o que treinar neste baralho.',
    en: 'Nothing left to train in this deck.',
  },
  trainingNote: {
    pt: 'treinar não muda o custo em sementes — a mesma semente rende mais',
    en: 'training does not change the seed cost — the same seed buys more',
  },
  trainingNoteDeep: {
    pt: 'o Japão destravou os níveis IV e V — fundo custa caro, escolha o seu núcleo',
    en: 'Japan unlocked levels IV and V — deep is expensive, pick your core',
  },
  levelUp: { pt: 'nível {from} → {to}', en: 'level {from} → {to}' },
  andMore: {
    pt: 'e mais {n} — os mais baratos aparecem primeiro',
    en: 'and {n} more — the cheapest show up first',
  },
  notEnough: { pt: 'moedas insuficientes', en: 'not enough coins' },
  joinedDeck: { pt: '{name} entrou no baralho!', en: '{name} joined the deck!' },
  nowLevel: { pt: '{name} agora é nível {n}!', en: '{name} is now level {n}!' },
  gainSeeds: { pt: '{from} → {to} sementes', en: '{from} → {to} seeds' },
  gainHp: { pt: '{from} → {to} de vida', en: '{from} → {to} health' },
  gainDamage: { pt: '{from} → {to} de dano', en: '{from} → {to} damage' },
  stronger: { pt: 'mais forte', en: 'stronger' },
};

const ROLES = {
  generator: { pt: 'produz sementes', en: 'produces seeds' },
  shooter: { pt: 'ataca de longe', en: 'attacks from afar' },
  wall: { pt: 'segura a fileira', en: 'holds the lane' },
  bruiser: { pt: 'bate de perto', en: 'hits up close' },
  area: { pt: 'efeito em área', en: 'area effect' },
  bomb: { pt: 'explode uma vez', en: 'blows up once' },
};

const fill = (field, values) => {
  const raw = pick(field);
  return values ? String(raw).replace(/\{(\w+)\}/g, (w, k) => (k in values ? values[k] : w)) : raw;
};

/**
 * What training changes, as a number. "Gets stronger" helps nobody decide
 * between spending 105 on the Monkey or 147 on the Owl.
 */
function describeGain(before, after) {
  if (before.role === 'generator') return fill(T.gainSeeds, { from: before.yield, to: after.yield });
  if (before.role === 'wall') return fill(T.gainHp, { from: before.hp, to: after.hp });
  if (typeof before.damage === 'number') return fill(T.gainDamage, { from: before.damage, to: after.damage });
  if (typeof before.hp === 'number') return fill(T.gainHp, { from: before.hp, to: after.hp });
  return pick(T.stronger);
}

export function createShop(result, state, onContinue) {
  let MENU_W = menuWidth();
  const offers = result.offers.map((id) => BY_ID[id]).filter(Boolean);
  const bought = new Set();
  const visit = !!result.visit;
  // training deeper than III is Japan's gift; the cap arrives with the result
  const cap = result.levelCap || 3;
  // whoever lost the stage lands straight in training: recruiting a new card is
  // rarely the answer to "I couldn't hold the horde". A visit from the map is
  // about the squad, so it opens there.
  let tab = visit ? 'squad' : result.won === false ? 'train' : 'recruit';

  /** The collection cards that can still go up a level — training follows a
   *  card onto the bench, so this reads `owned`, not the squad. */
  function trainable() {
    return state.owned
      .map((id) => ({ id, level: state.levels[id] || 1 }))
      .filter((c) => c.level < cap)
      .map((c) => ({ ...c, base: BY_ID[c.id], cost: trainingCost(c.id, c.level) }))
      .filter((c) => c.base)
      .sort((a, b) => a.cost - b.cost);
  }
  let t = 0;
  let notice = null;
  const buttons = [];

  // keeps the FIELD, not the resolved text: the notice stays on screen for
  // 2.4 s and used to sit there in the language the player had just left
  function say(txt, color) {
    notice = { txt, color, t: 2.4 };
  }

  function update(dt) {
    t += dt;
    if (notice) {
      notice.t -= dt;
      if (notice.t <= 0) notice = null;
    }
  }

  function draw(ctx) {
    MENU_W = menuWidth();
    // background over the whole screen, content centred on the board
    paper(ctx, vp.W, HEIGHT, { base: '#efe4cc' });
    ctx.save();
    applyFrame(ctx);
    buttons.length = 0;

    // header — the barracks serve whoever won, whoever fell, and whoever just
    // dropped by from the map to re-pick the squad
    const won = !visit && result.won !== false;
    text(ctx, pick(won ? T.stageWon : T.barracks), MENU_W / 2, 62, {
      size: 42, align: 'center', color: won ? COLORS.good : INK,
    });
    text(
      ctx,
      visit ? pick(T.visitSub) : `${pick(result.stage.name)} · ${pick(result.stage.place)}`,
      MENU_W / 2,
      90,
      { size: 17, align: 'center', color: INK_SOFT }
    );

    // earnings — the coin is broken down so the economy stays readable. A map
    // visit earned nothing, so it shows nothing.
    if (!visit) {
      const earnings = [
        {
          label: pick(T.coins),
          value: `🪙 ${result.coins}`,
          color: COLORS.accentDark,
          foot: result.change ? fill(T.change, { base: result.base, change: result.change }) : null,
        },
        {
          label: pick(T.monstersDropped),
          value: String(result.killed),
          color: COLORS.danger,
          foot: result.killGain ? fill(T.yieldedSeeds, { n: result.killGain }) : null,
        },
        {
          label: pick(T.humansFreed),
          value: fill(T.millions, { n: result.humans }),
          color: COLORS.good,
          foot: null,
        },
      ];
      earnings.forEach((g, i) => {
        const x = MENU_W / 2 - 345 + i * 230;
        box(ctx, x, 118, 214, 76, 10, { color: INK, width: 2.4, fill: '#fbf5e6', seed: 10 + i });
        text(ctx, g.label, x + 107, 140, { size: 13, align: 'center', color: INK_SOFT });
        text(ctx, g.value, x + 107, 168, { size: 23, align: 'center', color: g.color });
        if (g.foot) text(ctx, g.foot, x + 107, 186, { size: 12, align: 'center', color: INK_SOFT });
      });
    }

    // balance
    text(ctx, fill(T.youHave, { n: state.coins }), MENU_W / 2, 216, { size: 21, align: 'center', color: INK });

    // ------------------------------------------------------------------ tabs
    // Recruiting widens the spread; training deepens what you already use; the
    // squad tab picks the 14 that actually march. The campaign doesn't pay for
    // everything, and those choices are what give a deck its identity.
    const tabs = [
      { id: 'recruit', label: fill(T.recruitTab, { n: offers.filter((c) => !bought.has(c.id)).length }) },
      { id: 'squad', label: fill(T.squadTab, { n: state.deck.length, max: DECK_LIMIT }) },
      { id: 'train', label: fill(T.trainTab, { n: trainable().length }) },
    ];
    const tabW = 220;
    tabs.forEach((a, i) => {
      const x = MENU_W / 2 - (tabs.length * tabW) / 2 + i * tabW;
      const active = tab === a.id;
      box(ctx, x, 236, tabW - 8, 42, 9, {
        color: INK,
        width: active ? 3.4 : 2,
        fill: active ? COLORS.accent : '#e4dac2',
        seed: 200 + i,
      });
      text(ctx, a.label, x + (tabW - 8) / 2, 263, {
        size: 16, align: 'center', color: active ? INK : INK_SOFT,
      });
      buttons.push({ x, y: 236, w: tabW - 8, h: 42, action: 'tab', which: a.id });
    });

    if (tab === 'recruit') drawRecruit(ctx);
    else if (tab === 'squad') drawSquad(ctx);
    else drawTrain(ctx);

    // continue — the number shown is the campaign-local label, so crossing
    // into Japan reads "on to stage 1", not "stage 11"
    const next = result.nextStage;
    box(ctx, MENU_W / 2 - 180, HEIGHT - 84, 360, 64, 12, { color: INK, width: 3.4, fill: COLORS.accent, seed: 60 });
    text(ctx, next ? fill(T.nextStage, { n: result.nextLabel || next }) : pick(T.seeMap), MENU_W / 2, HEIGHT - 43, {
      size: 22, align: 'center', color: INK,
    });
    buttons.push({ x: MENU_W / 2 - 180, y: HEIGHT - 84, w: 360, h: 64, action: 'continue' });

    if (notice) {
      text(ctx, typeof notice.txt === 'function' ? notice.txt() : pick(notice.txt), MENU_W / 2, HEIGHT - 96, {
        size: 18, align: 'center', color: notice.color, alpha: Math.min(1, notice.t),
      });
    }
    ctx.restore();
  }

  // -------------------------------------------------------------- recruiting

  function drawRecruit(ctx) {
    if (!offers.length) {
      box(ctx, MENU_W / 2 - 300, 300, 600, 120, 14, { color: INK, width: 3, fill: '#fbf5e6', seed: 30 });
      text(ctx, pick(T.deckComplete), MENU_W / 2, 344, { size: 28, align: 'center', color: COLORS.good });
      text(ctx, pick(T.deckCompleteSub), MENU_W / 2, 378, { size: 17, align: 'center', color: INK_SOFT });
      return;
    }

    text(ctx, pick(T.threeShowedUp), MENU_W / 2, 300, { size: 15, align: 'center', color: INK_SOFT });

    const cw = 250;
    const ch = 272;
    const gap = 30;
    const x0 = MENU_W / 2 - (offers.length * cw + (offers.length - 1) * gap) / 2;

    offers.forEach((c, i) => {
      const x = x0 + i * (cw + gap);
      const y = 316;
      const isBought = bought.has(c.id);
      const canBuy = state.coins >= c.price && !isBought;
      const float = Math.sin(t * 2 + i) * 3;

      box(ctx, x, y + float, cw, ch, 16, {
        color: isBought ? COLORS.good : INK,
        width: isBought ? 4 : 3,
        fill: isBought ? '#e4f0dd' : '#fbf5e6',
        seed: 40 + i,
      });

      putSprite(ctx, animalSprite(c.id, 128), x + cw / 2, y + float + 82, 0.95);
      text(ctx, pick(c.name), x + cw / 2, y + float + 158, { size: 24, align: 'center', color: INK });
      text(ctx, `${pick(c.origin)} · ${pick(ROLES[c.role]) || c.role}`, x + cw / 2, y + float + 178, {
        size: 12, align: 'center', color: COLORS.accentDark,
      });
      wrapText(ctx, pick(c.desc), cw - 36, 13).slice(0, 3).forEach((ln, j) => {
        text(ctx, ln, x + cw / 2, y + float + 200 + j * 17, { size: 13, align: 'center', color: INK_SOFT });
      });

      const by = y + float + ch - 42;
      box(ctx, x + 20, by, cw - 40, 34, 8, {
        color: INK, width: 2.2,
        fill: isBought ? COLORS.good : canBuy ? COLORS.accent : '#ccc2ae',
        seed: 50 + i,
      });
      text(ctx, isBought ? pick(T.inDeck) : `🪙 ${c.price}`, x + cw / 2, by + 23, {
        size: 18, align: 'center', color: INK,
      });
      text(ctx, fill(T.seedCost, { n: c.cost }), x + cw / 2, y + float + ch + 16, {
        size: 12, align: 'center', color: INK_SOFT,
      });

      if (!isBought) buttons.push({ x, y: y + float, w: cw, h: ch, action: 'buy', card: c });
    });
  }

  // ---------------------------------------------------------------- the squad

  /**
   * Every card the player owns, field and bench side by side. Tapping a card
   * swaps it across; the rule itself (the 14 limit, the floor of 3) lives in
   * `toggleActive`, where the test reaches it.
   */
  function drawSquad(ctx) {
    text(ctx, pick(T.squadHint), MENU_W / 2, 294, { size: 14, align: 'center', color: INK_SOFT });

    // sailing into a water stage with no fins in the squad is a lost stage
    // waiting to start — the bench may hold the answer, so say it here
    if (result.nextHasWater && !state.deck.some((id) => BY_ID[id] && BY_ID[id].aquatic)) {
      text(ctx, pick(T.waterWarning), MENU_W / 2, 314, { size: 15, align: 'center', color: COLORS.danger });
    }

    const items = state.owned.map((id) => BY_ID[id]).filter(Boolean);
    const perRow = Math.min(8, Math.max(4, Math.ceil(items.length / 3)));
    const cw = Math.min(140, (MENU_W - 120) / perRow - 8);
    const ch = 92;
    const y0 = 324;

    items.forEach((c, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const inThisRow = Math.min(perRow, items.length - row * perRow);
      const x = MENU_W / 2 - (inThisRow * (cw + 8)) / 2 + col * (cw + 8);
      const y = y0 + row * (ch + 10);
      const active = state.deck.includes(c.id);

      box(ctx, x, y, cw, ch, 10, {
        color: active ? COLORS.good : INK_SOFT,
        width: active ? 3.4 : 2,
        fill: active ? '#eaf3df' : '#e6ddc8',
        seed: 500 + i,
      });
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.55;
      putSprite(ctx, animalSprite(c.id, 128), x + cw / 2, y + 38, 0.31);
      ctx.restore();
      text(ctx, pick(c.name), x + cw / 2, y + 74, { size: 11, align: 'center', color: active ? INK : INK_SOFT });
      text(ctx, pick(active ? T.inField : T.inReserve), x + cw / 2, y + 87, {
        size: 9, align: 'center', color: active ? COLORS.good : INK_SOFT,
      });
      if (active) {
        text(ctx, '✓', x + cw - 12, y + 16, { size: 15, align: 'center', color: COLORS.good });
      }
      // the training badge travels with the card, bench included
      const lvl = state.levels[c.id] || 1;
      if (lvl > 1) {
        box(ctx, x + 4, y + 4, 24, 15, 4, {
          color: COLORS.accentDark, width: 1.6, fill: '#f7d98a', seed: 540 + i,
        });
        text(ctx, cardAtLevel(c.id, lvl).levelLabel, x + 16, y + 16, {
          size: 10, align: 'center', color: COLORS.accentDark,
        });
      }
      buttons.push({ x, y, w: cw, h: ch, action: 'toggle', id: c.id });
    });
  }

  // ---------------------------------------------------------------- training

  function drawTrain(ctx) {
    const list = trainable();
    if (!list.length) {
      box(ctx, MENU_W / 2 - 300, 300, 600, 120, 14, { color: INK, width: 3, fill: '#fbf5e6', seed: 31 });
      text(ctx, pick(T.allMaxed), MENU_W / 2, 344, { size: 26, align: 'center', color: COLORS.good });
      text(ctx, pick(T.allMaxedSub), MENU_W / 2, 378, { size: 17, align: 'center', color: INK_SOFT });
      return;
    }

    text(ctx, pick(cap > 3 ? T.trainingNoteDeep : T.trainingNote), MENU_W / 2, 294, {
      size: 14, align: 'center', color: INK_SOFT,
    });

    // A grid of up to 14 cards in two rows. With two, the card shrinks — the
    // second row has to end before the continue button, or it hides behind it.
    const perRow = Math.min(7, Math.max(3, Math.ceil(Math.min(list.length, 14) / 2)));
    const rows = Math.ceil(Math.min(list.length, 14) / perRow);
    const cw = Math.min(180, (MENU_W - 100) / perRow - 12);
    const ch = rows > 1 ? 144 : 172;
    const y0 = rows > 1 ? 308 : 344;

    list.slice(0, 14).forEach((item, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const inThisRow = Math.min(perRow, list.length - row * perRow);
      const x = MENU_W / 2 - (inThisRow * (cw + 12)) / 2 + col * (cw + 12);
      const y = y0 + row * (ch + 14);

      const canBuy = state.coins >= item.cost;
      const next = item.level + 1;
      const before = cardAtLevel(item.id, item.level);
      const after = cardAtLevel(item.id, next);

      box(ctx, x, y, cw, ch, 12, {
        color: INK, width: 2.6,
        fill: canBuy ? '#fbf5e6' : '#e6ddc8',
        seed: 300 + i,
      });
      ctx.save();
      ctx.globalAlpha = canBuy ? 1 : 0.5;
      const compact = ch < 160;
      putSprite(ctx, animalSprite(item.id, 128), x + cw / 2, y + (compact ? 36 : 42), compact ? 0.46 : 0.54);
      ctx.restore();

      text(ctx, pick(item.base.name), x + cw / 2, y + (compact ? 74 : 88), {
        size: compact ? 14 : 15, align: 'center', color: INK,
      });

      // what changes: show the number, not "gets stronger"
      text(ctx, describeGain(before, after), x + cw / 2, y + (compact ? 92 : 108), {
        size: 12, align: 'center', color: COLORS.good,
      });
      text(ctx, fill(T.levelUp, { from: item.level, to: next }), x + cw / 2, y + (compact ? 108 : 126), {
        size: 11, align: 'center', color: INK_SOFT,
      });

      box(ctx, x + 12, y + ch - 32, cw - 24, 26, 6, {
        color: INK, width: 2, fill: canBuy ? COLORS.accent : '#ccc2ae', seed: 320 + i,
      });
      text(ctx, `🪙 ${item.cost}`, x + cw / 2, y + ch - 13, { size: 14, align: 'center', color: INK });

      buttons.push({ x, y, w: cw, h: ch, action: 'train', item });
    });

    if (list.length > 14) {
      text(ctx, fill(T.andMore, { n: list.length - 14 }), MENU_W / 2, y0 + rows * (ch + 14) + 6, {
        size: 13, align: 'center', color: INK_SOFT,
      });
    }
  }

  function click(screenX, screenY) {
    const { x, y } = pointInFrame(screenX, screenY);
    for (const b of buttons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (b.action === 'buy') {
          const c = b.card;
          if (state.coins < c.price) {
            sfx.error();
            say(T.notEnough, COLORS.danger);
            return;
          }
          state.coins -= c.price;
          const landed = buyCard(state, c.id);
          bought.add(c.id);
          sfx.coin();
          say(
            () => fill(landed === 'field' ? T.joinedDeck : T.joinedReserve, { name: pick(c.name) }),
            landed === 'field' ? COLORS.good : COLORS.accentDark
          );
          return;
        }
        if (b.action === 'toggle') {
          const r = toggleActive(state.deck, b.id);
          if (r.error) {
            sfx.error();
            say(r.error === 'full' ? T.squadFull : T.squadMin, COLORS.danger);
            return;
          }
          state.deck = r.deck;
          sfx.card();
          say(
            () => fill(r.moved === 'field' ? T.toField : T.toReserve, { name: pick(BY_ID[b.id].name) }),
            COLORS.good
          );
          return;
        }
        if (b.action === 'tab') {
          tab = b.which;
          sfx.card();
          return;
        }
        if (b.action === 'train') {
          const { id, cost, level, base } = b.item;
          if (state.coins < cost) {
            sfx.error();
            say(T.notEnough, COLORS.danger);
            return;
          }
          state.coins -= cost;
          state.levels[id] = level + 1;
          sfx.coin();
          say(() => fill(T.nowLevel, { name: pick(base.name), n: level + 1 }), COLORS.good);
          return;
        }
        if (b.action === 'continue') {
          sfx.click();
          onContinue();
          return;
        }
      }
    }
  }

  return { update, draw, click, move() {} };
}
