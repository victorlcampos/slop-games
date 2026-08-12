// Two screens in one: the world (to pick a country) and the open country (to
// pick a stage). For now only Brazil is unlocked — the others stay visible on
// purpose, to make it clear the campaign goes on.
//
// This is the game's home screen, so it is where the two things the catalog
// contract asks for live: the way back to the catalog, and the flags.

import { stroke, box, text, measureText, wrapText, paper, putSprite, circle } from '../scribble.js';
import { INK, INK_SOFT, COLORS, PAPER, PAPER_DARK, withAlpha } from '../palette.js';
import { cachedMap, project, COUNTRIES } from '../draw/worldmap.js';
import { monsterSprite } from '../draw/monsters.js';
import { STAGES, CAMPAIGN, HUMANS_BRAZIL } from '../data/stages.js';
import { vp, HEIGHT, applyFrame, pointInFrame, menuWidth } from '../viewport.js';
import { sfx } from '../audio.js';
import { i18n, pick, t } from '../i18n.js';
import { drawLangPicker, pickLangAt } from 'slopkit/langpicker';

const MAP = { x: 100, y: 118, w: 1080, h: 430 };

/** Positions of the 10 campaign nodes, on a trail climbing the country. */
const TRAIL = [
  [170, 560], [290, 505], [400, 545], [520, 480], [640, 520],
  [760, 455], [880, 495], [990, 430], [1090, 470], [1160, 380],
];

const T = {
  worldTitle: { pt: 'O MUNDO TOMADO', en: 'THE WORLD TAKEN' },
  worldSub: {
    pt: 'Cada país caiu para os próprios monstros. Comece pelo que ainda tem uma fresta.',
    en: 'Every country fell to its own monsters. Start with the one that still has a gap.',
  },
  freed: { pt: 'libertado', en: 'freed' },
  stagesOf: { pt: '{n}/{total} fases', en: '{n}/{total} stages' },
  humansFreed: { pt: 'HUMANOS LIBERTADOS', en: 'HUMANS FREED' },
  millions: { pt: '{n} milhões', en: '{n} million' },
  countrySub: {
    pt: 'Dez fases até a Cuca. Cada uma devolve um pedaço do país.',
    en: 'Ten stages up to the Cuca. Each one gives back a piece of the country.',
  },
  stageLabel: { pt: 'Fase {n} — {name}', en: 'Stage {n} — {name}' },
  yourDeck: { pt: 'SEU BARALHO', en: 'YOUR DECK' },
  cards: { pt: '{n} cartas', en: '{n} cards' },
  playStage: { pt: 'JOGAR FASE {n}', en: 'PLAY STAGE {n}' },
  finished: {
    pt: '🎉 Brasil libertado. Os outros países vêm aí.',
    en: '🎉 Brazil is free. The other countries are coming.',
  },
  backToWorld: { pt: '← mundo', en: '← world' },
  downloadSave: { pt: '💾 baixar save', en: '💾 download save' },
  loadSave: { pt: '📂 carregar', en: '📂 load' },
  soundOn: { pt: '🔊 som', en: '🔊 sound' },
  soundOff: { pt: '🔇 som', en: '🔇 sound' },
  replayIntro: { pt: '🎬 rever abertura', en: '🎬 replay intro' },
  restart: { pt: '🔄 recomeçar', en: '🔄 restart' },
  saved: { pt: 'save baixado', en: 'save downloaded' },
  loaded: { pt: 'save carregado', en: 'save loaded' },
  loadFailed: { pt: 'não deu para carregar', en: "couldn't load it" },
  restartTitle: { pt: 'Recomeçar do zero?', en: 'Start over from scratch?' },
  ofTotal: { pt: '{n} de {total}', en: '{n} of {total}' },
  stagesWon: { pt: 'fases vencidas', en: 'stages won' },
  cardsInDeck: { pt: 'cartas no baralho', en: 'cards in deck' },
  coins: { pt: 'moedas', en: 'coins' },
  millionsShort: { pt: '{n} mi', en: '{n}M' },
  humansFreedSmall: { pt: 'humanos libertados', en: 'humans freed' },
  restartBody: {
    pt: 'Isto apaga o progresso guardado neste navegador e a campanha volta ao começo. Se quiser guardar onde está, cancele e use "baixar save" antes.',
    en: 'This erases the progress stored in this browser and the campaign goes back to the start. If you want to keep where you are, cancel and use "download save" first.',
  },
  cancel: { pt: 'CANCELAR', en: 'CANCEL' },
  eraseAll: { pt: 'APAGAR TUDO', en: 'ERASE EVERYTHING' },
};

const fill = (field, values) => {
  const raw = pick(field);
  return values ? String(raw).replace(/\{(\w+)\}/g, (w, k) => (k in values ? values[k] : w)) : raw;
};

export function createMap(state, actions) {
  let MENU_W = menuWidth();
  let view = state.won.length ? 'country' : 'world';
  let t0 = 0;
  let notice = null;
  let confirming = false;
  const buttons = [];
  let langZones = [];

  // keeps the FIELD, not the resolved text — see the same note in shop.js
  function say(txt, color = INK) {
    notice = { txt, color, t: 3 };
  }

  function update(dt) {
    t0 += dt;
    if (notice) {
      notice.t -= dt;
      if (notice.t <= 0) notice = null;
    }
  }

  // ----------------------------------------------------------- world screen

  function drawWorld(ctx) {
    text(ctx, pick(T.worldTitle), MENU_W / 2, 62, { size: 46, align: 'center', color: INK });
    text(ctx, pick(T.worldSub), MENU_W / 2, 92, { size: 18, align: 'center', color: INK_SOFT });

    ctx.drawImage(cachedMap(MAP.w, MAP.h, { taken: true, seaColor: '#93b0c4' }), MAP.x, MAP.y);
    box(ctx, MAP.x, MAP.y, MAP.w, MAP.h, 8, { color: INK, width: 3, seed: 5 });

    buttons.length = 0;

    for (const c of COUNTRIES) {
      const [px, py] = project(c.lon, c.lat, MAP.x, MAP.y, MAP.w, MAP.h);
      const done = c.id === 'brazil' && state.won.length >= STAGES.length;
      const pulse = 1 + Math.sin(t0 * 3) * 0.12;

      if (c.unlocked) {
        circle(ctx, px, py, 24 * pulse, { color: COLORS.accent, width: 3, alpha: 0.5, seed: 10 });
        circle(ctx, px, py, 17, {
          color: INK, width: 3, fill: done ? COLORS.good : COLORS.accent, seed: 11,
        });
        text(ctx, c.flag, px, py + 7, { size: 19, align: 'center' });
        text(ctx, pick(c.name), px, py + 44, {
          size: 22, align: 'center', color: INK, outline: PAPER, outlineWidth: 5,
        });
        text(
          ctx,
          done ? pick(T.freed) : fill(T.stagesOf, { n: state.won.length, total: c.stages }),
          px,
          py + 66,
          { size: 15, align: 'center', color: INK_SOFT, outline: PAPER, outlineWidth: 4 }
        );
        buttons.push({ x: px - 40, y: py - 40, w: 80, h: 80, action: 'openCountry' });
      } else {
        circle(ctx, px, py, 13, { color: '#5b4a52', width: 2.4, fill: '#7d6470', seed: 12 });
        text(ctx, '🔒', px, py + 5, { size: 14, align: 'center' });
        text(ctx, pick(c.name), px, py + 34, {
          size: 16, align: 'center', color: '#6b5a62', outline: withAlpha(PAPER, 0.7), outlineWidth: 4,
        });
        text(ctx, pick(c.monsters), px, py + 52, {
          size: 12, align: 'center', color: '#8a7a80', outline: withAlpha(PAPER, 0.6), outlineWidth: 3,
        });
      }
    }

    // the humans scoreboard
    const freed = state.humans;
    box(ctx, MENU_W / 2 - 300, HEIGHT - 168, 600, 74, 12, { color: INK, width: 3, fill: '#fbf5e6', seed: 20 });
    text(ctx, pick(T.humansFreed), MENU_W / 2, HEIGHT - 142, { size: 15, align: 'center', color: INK_SOFT });
    text(ctx, fill(T.millions, { n: freed }), MENU_W / 2, HEIGHT - 112, { size: 32, align: 'center', color: COLORS.good });
    const frac = Math.min(1, freed / HUMANS_BRAZIL);
    ctx.fillStyle = 'rgba(43,38,34,0.15)';
    ctx.fillRect(MENU_W / 2 - 270, HEIGHT - 104, 540, 8);
    ctx.fillStyle = COLORS.good;
    ctx.fillRect(MENU_W / 2 - 270, HEIGHT - 104, 540 * frac, 8);

    drawBottomBar(ctx);
  }

  // --------------------------------------------------------- country screen

  function drawCountry(ctx) {
    // the outline of Brazil in the background, very lightly
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.drawImage(cachedMap(1600, 640, { taken: false, seaColor: 'rgba(0,0,0,0)' }), -380, 60);
    ctx.restore();

    text(ctx, `${CAMPAIGN.flag}  ${pick(CAMPAIGN.country)}`, MENU_W / 2, 60, { size: 44, align: 'center', color: INK });
    text(ctx, pick(T.countrySub), MENU_W / 2, 90, { size: 18, align: 'center', color: INK_SOFT });

    buttons.length = 0;

    // the trail linking the stages
    stroke(ctx, TRAIL.map(([x, y]) => [x, y]), { color: withAlpha(INK, 0.35), width: 5, seed: 30 });

    STAGES.forEach((st, i) => {
      const [x, y] = TRAIL[i];
      const won = state.won.includes(st.n);
      const available = st.n === state.currentStage && !won;
      const locked = !won && !available;
      const isBoss = !!st.boss;
      const radius = isBoss ? 40 : 30;

      if (available) {
        circle(ctx, x, y, radius + 10 + Math.sin(t0 * 3) * 4, { color: COLORS.accent, width: 3, alpha: 0.45, seed: 40 + i });
      }
      circle(ctx, x, y, radius, {
        color: INK,
        width: isBoss ? 4 : 3,
        fill: won ? COLORS.good : available ? COLORS.accent : '#b8ac96',
        seed: 50 + i,
      });

      if (isBoss) {
        putSprite(ctx, monsterSprite('cuca', 128), x, y - 2, 0.46, false, locked ? 0.5 : 1);
      } else {
        text(ctx, won ? '✓' : String(st.n), x, y + 9, {
          size: won ? 30 : 26, align: 'center', color: locked ? '#8a7f6e' : INK,
        });
      }

      text(ctx, pick(st.name), x, y + radius + 22, {
        size: 15, align: 'center', color: locked ? '#8a7f6e' : INK, outline: PAPER, outlineWidth: 4,
      });

      if (!locked) buttons.push({ x: x - radius, y: y - radius, w: radius * 2, h: radius * 2, action: 'play', stage: st.n });
    });

    // panel for the current stage
    const current = STAGES.find((st) => st.n === state.currentStage) || STAGES[STAGES.length - 1];
    box(ctx, 60, 130, 470, 172, 14, { color: INK, width: 3, fill: '#fbf5e6', seed: 60 });
    text(ctx, fill(T.stageLabel, { n: current.n, name: pick(current.name) }), 84, 164, { size: 25, color: INK });
    text(ctx, pick(current.place), 84, 188, { size: 15, color: COLORS.accentDark });
    wrapText(ctx, pick(current.intro), 420, 17).slice(0, 4).forEach((ln, i) => {
      text(ctx, ln, 84, 216 + i * 22, { size: 17, color: INK_SOFT });
    });

    // the deck
    box(ctx, MENU_W - 400, 130, 340, 92, 12, { color: INK, width: 2.6, fill: '#fbf5e6', seed: 70 });
    text(ctx, pick(T.yourDeck), MENU_W - 380, 158, { size: 14, color: INK_SOFT });
    text(ctx, fill(T.cards, { n: state.deck.length }), MENU_W - 380, 186, { size: 24, color: INK });
    text(ctx, `🪙 ${state.coins}`, MENU_W - 380, 210, { size: 17, color: COLORS.accentDark });

    // the play button
    const canPlay = state.won.length < STAGES.length;
    if (canPlay) {
      box(ctx, MENU_W / 2 - 160, HEIGHT - 158, 320, 66, 12, { color: INK, width: 3.4, fill: COLORS.accent, seed: 80 });
      text(ctx, fill(T.playStage, { n: state.currentStage }), MENU_W / 2, HEIGHT - 115, { size: 26, align: 'center', color: INK });
      buttons.push({ x: MENU_W / 2 - 160, y: HEIGHT - 158, w: 320, h: 66, action: 'play', stage: state.currentStage });
    } else {
      text(ctx, pick(T.finished), MENU_W / 2, HEIGHT - 122, { size: 24, align: 'center', color: COLORS.good });
    }

    // back to the world
    box(ctx, 34, 34, 148, 54, 10, { color: INK, width: 2.6, fill: PAPER_DARK, seed: 90 });
    text(ctx, pick(T.backToWorld), 108, 68, { size: 19, align: 'center', color: INK });
    buttons.push({ x: 34, y: 34, w: 148, h: 54, action: 'world' });

    drawBottomBar(ctx);
  }

  // ---------------------------------------------------------- the flag pair

  /**
   * Top right, above everything else. It is drawn last so the flags sit over
   * the map, and hit-tested first so nothing behind them steals the tap.
   */
  function drawLangs(ctx) {
    langZones = drawLangPicker(ctx, i18n, { x: MENU_W - 108, y: 34, w: 40, gap: 12 });
  }

  // ------------------------------------------------------------- bottom bar

  function drawBottomBar(ctx) {
    // 56px tall: on a phone in landscape that gives a ~37pt target, against the
    // 25pt it used to be — below that the finger misses the button
    const h = 56;
    const y = HEIGHT - h - 14;
    const items = [
      // Only exists when the game runs inside the catalog — whoever opened the
      // loose HTML shouldn't see a link to an index that isn't there.
      ...(window.__catalog ? [{ label: t('slop.backToCatalog'), action: 'catalog' }] : []),
      { label: pick(T.downloadSave), action: 'download' },
      { label: pick(T.loadSave), action: 'load' },
      { label: pick(actions.soundOn() ? T.soundOn : T.soundOff), action: 'sound' },
      { label: pick(T.replayIntro), action: 'intro' },
      // the destructive one goes last and without an accent colour: whoever is
      // looking finds it; whoever is running a finger along the bar doesn't
      { label: pick(T.restart), action: 'restart', quiet: true },
    ];

    // widths are measured, not fixed: the same button holds "recomeçar" and
    // "restart", and a hardcoded width would clip one of the two languages
    for (const it of items) it.w = Math.round(measureText(ctx, it.label, 17) + 44);

    let x = 40;
    for (const it of items) {
      box(ctx, x, y, it.w, h, 10, {
        color: it.quiet ? INK_SOFT : INK,
        width: 2.6,
        fill: it.quiet ? '#e8dfcb' : '#f7f0df',
        seed: 100 + x,
      });
      text(ctx, it.label, x + it.w / 2, y + h / 2 + 6, {
        size: 17, align: 'center', color: it.quiet ? INK_SOFT : INK,
      });
      buttons.push({ x, y, w: it.w, h, action: it.action });
      x += it.w + 12;
    }

    if (notice) {
      // right-aligned, but never back into the button bar beside it: the bar is
      // measured (above) and grows with the translation, and the published copy
      // carries one button more than the loose file — which is why this only
      // overlapped there
      const msg = typeof notice.txt === 'function' ? notice.txt() : pick(notice.txt);
      const right = MENU_W - 40;
      const room = right - x - 12;
      const size = measureText(ctx, msg, 17) > room ? 13 : 17;
      if (measureText(ctx, msg, size) <= room) {
        text(ctx, msg, right, y + 9, {
          size, align: 'right', color: notice.color, alpha: Math.min(1, notice.t),
        });
      } else {
        // still too long: put it above the bar instead of across it
        text(ctx, msg, right, y - 14, {
          size: 15, align: 'right', color: notice.color, alpha: Math.min(1, notice.t),
        });
      }
    }
  }

  // ------------------------------------------------- confirm the restart

  /**
   * Wiping progress is the only action here that can't be undone, so the dialog
   * says plainly what is lost and reminds you a save can be downloaded first.
   * No "are you sure?" without a single number in it.
   */
  function drawConfirm(ctx) {
    // a veil over the whole screen (the translate is already applied)
    ctx.fillStyle = 'rgba(28, 22, 18, 0.72)';
    ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);

    const w = 640;
    const h = 410;
    const x = MENU_W / 2 - w / 2;
    const y = HEIGHT / 2 - h / 2;

    box(ctx, x, y, w, h, 18, { color: INK, width: 4, fill: '#fbf5e6', seed: 900 });
    text(ctx, pick(T.restartTitle), MENU_W / 2, y + 56, { size: 34, align: 'center', color: INK });

    const losses = [
      [fill(T.ofTotal, { n: state.won.length, total: STAGES.length }), pick(T.stagesWon)],
      [`${state.deck.length}`, pick(T.cardsInDeck)],
      [`🪙 ${state.coins}`, pick(T.coins)],
      [fill(T.millionsShort, { n: state.humans }), pick(T.humansFreedSmall)],
    ];
    losses.forEach(([value, label], i) => {
      const cx = x + 44 + i * ((w - 88) / 4);
      const cw = (w - 88) / 4 - 10;
      box(ctx, cx, y + 82, cw, 68, 8, { color: INK_SOFT, width: 2, fill: '#f2e8d2', seed: 910 + i });
      text(ctx, value, cx + cw / 2, y + 112, { size: 21, align: 'center', color: COLORS.danger });
      text(ctx, label, cx + cw / 2, y + 134, { size: 11, align: 'center', color: INK_SOFT });
    });

    wrapText(ctx, pick(T.restartBody), w - 80, 17).forEach((ln, i) => {
      text(ctx, ln, MENU_W / 2, y + 186 + i * 24, { size: 17, align: 'center', color: INK_SOFT });
    });

    // Cancel comes first and highlighted: it is the likely exit for whoever
    // clicked by accident. The button that erases is the red one, on the right.
    // 74 tall to give a ~40pt target on a phone in landscape.
    const bh = 74;
    const by = y + h - bh - 24;
    box(ctx, x + 44, by, 250, bh, 12, { color: INK, width: 3.2, fill: COLORS.accent, seed: 930 });
    text(ctx, pick(T.cancel), x + 44 + 125, by + bh / 2 + 8, { size: 21, align: 'center', color: INK });
    buttons.push({ x: x + 44, y: by, w: 250, h: bh, action: 'cancelRestart' });

    box(ctx, x + w - 294, by, 250, bh, 12, { color: INK, width: 3.2, fill: '#d98a78', seed: 940 });
    text(ctx, pick(T.eraseAll), x + w - 294 + 125, by + bh / 2 + 8, { size: 21, align: 'center', color: '#4a1f18' });
    buttons.push({ x: x + w - 294, y: by, w: 250, h: bh, action: 'confirmRestart' });
  }

  // ------------------------------------------------------------------ cycle

  function draw(ctx) {
    MENU_W = menuWidth();
    // the paper covers the real screen; the content is centred on the board
    paper(ctx, vp.W, HEIGHT, { base: view === 'world' ? '#e8dcc2' : '#e6dcc4' });
    ctx.save();
    applyFrame(ctx);
    if (view === 'world') drawWorld(ctx);
    else drawCountry(ctx);
    if (confirming) {
      // the dialog is modal: nothing behind it answers a tap
      buttons.length = 0;
      langZones = [];
      drawConfirm(ctx);
    } else {
      drawLangs(ctx);
    }
    ctx.restore();
  }

  function click(screenX, screenY) {
    // both axes: the frame shifts *and* scales, not just shifts
    const { x, y } = pointInFrame(screenX, screenY);

    const lang = pickLangAt(langZones, x, y);
    if (lang) {
      sfx.click();
      i18n.set(lang);
      return;
    }

    for (const b of buttons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        sfx.click();
        switch (b.action) {
          case 'openCountry':
            view = 'country';
            return;
          case 'world':
            view = 'world';
            return;
          case 'play':
            actions.play(b.stage);
            return;
          case 'download':
            actions.download();
            say(T.saved, COLORS.good);
            return;
          case 'load':
            actions
              .load()
              .then(() => say(T.loaded, COLORS.good))
              // e.message is already localized by the kit at throw time, so it
              // is the one case where a resolved string is what we want
              .catch((e) => say(e.message || T.loadFailed, COLORS.danger));
            return;
          case 'sound':
            actions.sound();
            return;
          case 'intro':
            actions.intro();
            return;
          case 'catalog':
            window.location.href = window.__catalog;
            return;
          case 'restart':
            confirming = true;
            return;
          case 'cancelRestart':
            confirming = false;
            return;
          case 'confirmRestart':
            confirming = false;
            actions.restart();
            return;
        }
      }
    }
  }

  // `confirming` is exposed so the test can wait for the dialog instead of
  // sleeping; `buttons` so it can find a button by what it does rather than by
  // pixel arithmetic — the bottom bar sizes itself to the text, and the text
  // changes with the flag.
  return { update, draw, click, move() {}, confirming: () => confirming, buttons: () => buttons };
}
