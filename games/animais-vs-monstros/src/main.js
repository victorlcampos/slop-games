// Bootstrap and screen machine.
//
//   intro -> map -> battle -> (shop | defeat) -> map -> ...

import { paper, text, box, wrapText, putSprite, measureText, resetScreenText, screenText } from './scribble.js';
import { INK, INK_SOFT, COLORS, PAPER_DARK } from './palette.js';
import { createCutscene, JAPAN_SCENES } from './screens/cutscene.js';
import { createMap } from './screens/map.js';
import { createBattle } from './screens/battle.js';
import { createShop } from './screens/shop.js';
import { monsterSprite } from './draw/monsters.js';
import { STAGES, CAMPAIGNS, campaignById, isCampaignOpen, isCampaignDone } from './data/stages.js';
import { requiredCards, rollCards, shopPool, levelCap } from './data/animals.js';
import { calcReward } from './data/economy.js';
import { vp, HEIGHT, resize, begin, watch, pointIn, applyFrame, pointInFrame, menuWidth } from './viewport.js';
import { createLoop } from 'slopkit/loop';
import { bindText } from 'slopkit/langpicker';
import * as Save from './save.js';
import { sfx, wakeAudio, toggleSound, soundOn, stopMusic } from './audio.js';
import { i18n, pick } from './i18n.js';

// Before the boot notice is taken down, not after: it carries data-pt/data-en
// like the rest of the DOM, and removing it first left that pair unreachable.
// The DOM outside the canvas is otherwise only the "turn your device" overlay,
// but it is still copy the player reads.
bindText(i18n);

const canvas = document.getElementById('canvas');
canvas.hidden = false;
const booting = document.getElementById('booting');
if (booting) booting.remove();

const ctx = canvas.getContext('2d');
resize(canvas);

const TITLE = { pt: 'Animais vs Monstros', en: 'Animals vs Monsters' };
const applyTitle = () => {
  document.title = pick(TITLE);
};
applyTitle();
i18n.onChange(applyTitle);

// The window changed size: reposition whoever is on the field. The kit handles
// listening for the events and also spots the rotation the event didn't deliver.
watch(() => {
  if (current && current.resize) current.resize();
});
let state = Save.load();
let current = null;

// ------------------------------------------------------------------ navigation

function goToMap() {
  stopMusic();

  // The Brazil campaign just closed and the crossing has not been shown: the
  // film plays itself, once, before the world map hands over Japan.
  if (!state.sawJapanIntro && isCampaignDone(CAMPAIGNS[0], state.won)) {
    goToJapanFilm();
    return;
  }

  current = createMap(state, {
    play: goToBattle,
    download: () => Save.download(state),
    load: () =>
      Save.importFile().then((fresh) => {
        state = fresh;
        Save.save(state);
        goToMap();
      }),
    sound: () => toggleSound(),
    soundOn,
    intro: goToIntro,
    // the country screen's "replay film": each campaign owns its reel
    film: (campaignId) => (campaignId === 'japan' ? goToJapanFilm() : goToIntro()),
    // a visit to the barracks from the map: no prize screen, straight to the
    // squad — this is how a bench alligator gets fielded before a water stage
    barracks: () => goToShop({ visit: true, won: null, stage: null, coins: 0, humans: 0, killed: 0 }),
    restart: () => {
      // a genuinely new game: wipe what's stored, zero the in-memory state and
      // play the intro again, which is where the campaign starts
      Save.clear();
      state = Save.freshSave();
      Save.save(state);
      goToIntro();
    },
  });
}

function goToIntro() {
  stopMusic();
  current = createCutscene(() => {
    state.sawIntro = true;
    Save.save(state);
    goToMap();
  });
}

/** The Brazil → Japan crossing: why the squad sails, and what waits there. */
function goToJapanFilm() {
  stopMusic();
  current = createCutscene(() => {
    state.sawJapanIntro = true;
    Save.save(state);
    goToMap();
  }, JAPAN_SCENES);
}

function goToBattle(stageNumber) {
  const stage = STAGES.find((s) => s.n === stageNumber);
  if (!stage) return goToMap();

  current = createBattle(
    stage,
    state.deck,
    (won, summary) => {
      if (won) wonStage(stage, summary);
      else lostStage(stage, summary);
    },
    state.levels
  );
}

function wonStage(stage, summary) {
  const firstTime = !state.won.includes(stage.n);
  const { base, change, total } = calcReward(stage, summary, true, firstTime);
  const humans = firstTime ? stage.humans : 0;

  state.coins += total;
  state.humans += humans;
  if (firstTime) {
    state.won.push(stage.n);
    state.currentStage = Math.min(STAGES.length, stage.n + 1);
  }
  const record = state.records[stage.n];
  if (!record || summary.killed > record) state.records[stage.n] = summary.killed;
  Save.save(state);

  goToShop({
    won: true,
    stage,
    coins: total,
    base,
    change,
    humans,
    killed: summary.killed,
    leftover: summary.leftover || 0,
    killGain: summary.killGain || 0,
  });
}

function lostStage(stage, summary) {
  const firstTime = !state.won.includes(stage.n);
  const { base, change, total } = calcReward(stage, summary, false, firstTime);
  state.coins += total;
  Save.save(state);

  current = defeatScreen(stage, summary, { coins: total, base, change });
}

/** The screen between stages: recruit, train, and pick the squad of 14. */
function goToShop(result) {
  const next = state.won.length >= STAGES.length ? null : state.currentStage;
  const nextStage = STAGES.find((s) => s.n === next);
  // the shop only sells what the player's campaigns have unlocked: the Japan
  // recruits stay out of the window until the crossing happens
  const extra = CAMPAIGNS.filter((c) => c.unlockedBy && isCampaignOpen(c, state.won)).map((c) => c.id);
  const pool = shopPool(extra);
  // what the next stage demands goes into the shop window by force — but only
  // if the COLLECTION has no answer: an alligator on the bench is an answer,
  // it just needs fielding, and the squad tab says so
  const required = requiredCards(nextStage, state.owned, pool);
  const offers = rollCards(state.owned, 3, state.coins, required, pool);
  current = createShop(
    {
      ...result,
      offers,
      nextStage: next,
      nextLabel: nextStage ? nextStage.label : null,
      // opening Japan raises the training ceiling from III to V
      levelCap: levelCap(extra),
      // the squad tab warns when the next board has water and the squad no fins
      nextHasWater: !!(nextStage && nextStage.water && nextStage.water.length),
    },
    state,
    () => {
      Save.save(state);
      goToMap();
    }
  );
}

// ----------------------------------------------------------- defeat screen

const D = {
  theyPassed: { pt: 'ELES PASSARAM', en: 'THEY GOT THROUGH' },
  stillTaken: { pt: '{stage} continua tomada.', en: '{stage} is still taken.' },
  droppedBefore: {
    pt: 'você derrubou {n} antes de cair',
    en: 'you dropped {n} before falling',
  },
  heldPlusChange: {
    pt: '{base} pelo que você segurou · {change} de troco das sementes',
    en: '{base} for what you held · {change} in change from the seeds',
  },
  held: { pt: 'pelo que você segurou', en: 'for what you held' },
  tryAgain: { pt: 'TENTAR DE NOVO', en: 'TRY AGAIN' },
  barracks: { pt: 'QUARTEL', en: 'BARRACKS' },
  map: { pt: 'MAPA', en: 'MAP' },
};

/**
 * The boss tips, keyed by the boss's own id — never by "there is a boss here".
 * A campaign that forgets to write one falls back to `TIPS.boss`, which names
 * nobody; the alternative, and what used to happen, is the second campaign
 * being told how to fight the first campaign's boss, by name.
 */
const BOSS_TIPS = {
  cuca: {
    pt: 'A Cuca chama reforço enquanto anda. Segure as fileiras com paredes e concentre o dano nela — quem para de atirar na Cuca perde o campo.',
    en: 'The Cuca calls reinforcements as she walks. Hold the lanes with walls and focus damage on her — whoever stops shooting the Cuca loses the field.',
  },
  onryo: {
    pt: 'O Onryō fica intangível e volta em outra fileira. Espalhe atiradores por várias fileiras — quem empilhou tudo numa só atira no vazio metade do tempo.',
    en: 'The Onryō turns intangible and returns in another lane. Spread shooters across several lanes — stack everything in one and you shoot at nothing half the time.',
  },
};

/** A useful hint, tied to what that stage has that is specific to it. */
const TIPS = {
  boss: {
    pt: 'O chefe chama reforço enquanto anda. Segure as fileiras com paredes e concentre o dano nele — quem para de atirar no chefe perde o campo.',
    en: 'The boss calls reinforcements as it walks. Hold the lanes with walls and focus damage on it — whoever stops shooting the boss loses the field.',
  },
  fog: {
    pt: 'A névoa esconde o meio do campo: uma Coruja em qualquer fileira levanta o véu do tabuleiro inteiro.',
    en: 'The fog hides the middle of the field: an Owl in any lane lifts the veil off the whole board.',
  },
  night: {
    pt: 'No escuro tem coisa que anda invisível. Sem alguém que enxergue à noite, você só descobre quando já está sendo mordido.',
    en: 'In the dark something walks invisible. Without someone who sees at night, you only find out once you are being bitten.',
  },
  water: {
    pt: 'Fileira alagada só aceita bicho aquático — Jacaré e Hipopótamo. É por ela que a Iara desce: água vazia é estrada aberta até a cerca.',
    en: 'A flooded lane only takes aquatic animals — Alligator and Hippo. That is the lane the Iara comes down: empty water is an open road to the fence.',
  },
  drought: {
    pt: 'Na seca as sementes demoram mais. Plante geradores antes de qualquer outra coisa e aguente o começo com uma parede só.',
    en: 'In the drought seeds take longer. Plant generators before anything else and hold the opening with a single wall.',
  },
  general: {
    pt: 'Comece pelos geradores: sem semente entrando, nada mais entra em campo. Duas fileiras de defesa valem mais que uma cheia de bicho caro.',
    en: 'Start with the generators: with no seed coming in, nothing else reaches the field. Two lanes of defence are worth more than one full of expensive animals.',
  },
};

function tipFor(stage) {
  if (stage.boss) return pick(BOSS_TIPS[stage.boss] || TIPS.boss);
  if (stage.fog) return pick(TIPS.fog);
  if (stage.night) return pick(TIPS.night);
  if (stage.water && stage.water.length) return pick(TIPS.water);
  if (stage.seedFactor) return pick(TIPS.drought);
  return pick(TIPS.general);
}

const fill = (field, values) => {
  const raw = pick(field);
  return values ? String(raw).replace(/\{(\w+)\}/g, (w, k) => (k in values ? values[k] : w)) : raw;
};

function defeatScreen(stage, summary, gain) {
  const buttons = [];
  let t = 0;

  return {
    update(dt) {
      t += dt;
    },
    draw(c) {
      paper(c, vp.W, HEIGHT, { base: '#d9c9b4' });
      c.fillStyle = 'rgba(60, 30, 40, 0.12)';
      c.fillRect(0, 0, vp.W, HEIGHT);
      c.save();
      applyFrame(c);
      buttons.length = 0;
      const MENU_W = menuWidth();

      putSprite(c, monsterSprite('bichopapao', 128), MENU_W / 2, 250 + Math.sin(t * 1.6) * 6, 1.9, false, 0.9);

      text(c, pick(D.theyPassed), MENU_W / 2, 110, { size: 52, align: 'center', color: COLORS.danger });
      text(c, fill(D.stillTaken, { stage: pick(stage.name) }), MENU_W / 2, 146, {
        size: 20, align: 'center', color: INK_SOFT,
      });

      const lines = wrapText(c, tipFor(stage), 720, 19);
      box(c, MENU_W / 2 - 390, 380, 780, 40 + lines.length * 26, 12, {
        color: INK, width: 3, fill: '#fbf5e6', seed: 5,
      });
      lines.forEach((ln, i) => {
        text(c, ln, MENU_W / 2, 412 + i * 26, { size: 19, align: 'center', color: INK });
      });

      text(c, fill(D.droppedBefore, { n: summary.killed }), MENU_W / 2, 512, {
        size: 17, align: 'center', color: INK_SOFT,
      });

      // Losing pays too. Less, and in proportion to how long you held — but it
      // pays, because trying a hard stage can't be time thrown away.
      if (gain && gain.coins > 0) {
        box(c, MENU_W / 2 - 220, 528, 440, 56, 10, { color: INK, width: 2.6, fill: '#fbf5e6', seed: 7 });
        text(c, `🪙 +${gain.coins}`, MENU_W / 2, 552, { size: 23, align: 'center', color: COLORS.accentDark });
        text(
          c,
          gain.change ? fill(D.heldPlusChange, { base: gain.base, change: gain.change }) : pick(D.held),
          MENU_W / 2,
          574,
          { size: 13, align: 'center', color: INK_SOFT }
        );
      }

      // widths are measured, not fixed: "TENTAR DE NOVO" and "TRY AGAIN" are
      // not the same length, and a hardcoded box clips one of the two
      const bts = [
        { label: pick(D.tryAgain), action: 'retry', color: COLORS.accent },
        { label: pick(D.barracks), action: 'shop', color: '#c9a165' },
        { label: pick(D.map), action: 'map', color: PAPER_DARK },
      ];
      for (const b of bts) b.w = Math.max(150, Math.round(measureText(c, b.label, 19) + 70));

      let x = MENU_W / 2 - (bts.reduce((s, b) => s + b.w, 0) + 2 * 16) / 2;
      for (const b of bts) {
        box(c, x, 596, b.w, 58, 12, { color: INK, width: 3.2, fill: b.color, seed: 10 + x });
        text(c, b.label, x + b.w / 2, 633, { size: 19, align: 'center', color: INK });
        buttons.push({ x, y: 596, w: b.w, h: 58, action: b.action });
        x += b.w + 16;
      }
      c.restore();
    },
    click(screenX, screenY) {
      const { x, y } = pointInFrame(screenX, screenY);
      for (const b of buttons) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          sfx.click();
          if (b.action === 'retry') goToBattle(stage.n);
          else if (b.action === 'shop') {
            goToShop({
              won: false,
              stage,
              coins: gain ? gain.coins : 0,
              base: gain ? gain.base : 0,
              change: gain ? gain.change : 0,
              humans: 0,
              killed: summary.killed,
              leftover: summary.leftover || 0,
              killGain: summary.killGain || 0,
            });
          } else goToMap();
          return;
        }
      }
    },
    move() {},
  };
}

// --------------------------------------------------------------------- input

function pointOnCanvas(ev) {
  const src = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
  return pointIn(canvas, src.clientX, src.clientY);
}

// Touch and mouse down the same path. The action lands on *release*, not on
// press: that is what lets a finger drag to the right cell before confirming,
// and what lets you back out by sliding off the button.
canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  wakeAudio();
  canvas.setPointerCapture?.(ev.pointerId);
  const p = pointOnCanvas(ev);
  if (!current) return;
  if (current.press) current.press(p.x, p.y);
  else if (current.move) current.move(p.x, p.y);
});

canvas.addEventListener('pointermove', (ev) => {
  ev.preventDefault();
  const p = pointOnCanvas(ev);
  if (current && current.move) current.move(p.x, p.y);
});

canvas.addEventListener('pointerup', (ev) => {
  ev.preventDefault();
  // hand the capture back: a pointer left stuck (a gesture interrupted by a
  // rotation, a call, an app switch) sends the next tap to the wrong place
  canvas.releasePointerCapture?.(ev.pointerId);
  const p = pointOnCanvas(ev);
  if (!current) return;
  if (current.release) current.release(p.x, p.y);
  else if (current.click) current.click(p.x, p.y);
});

// the finger left the screen or the system stole the touch: cancel without acting
canvas.addEventListener('pointercancel', (ev) => {
  canvas.releasePointerCapture?.(ev.pointerId);
  if (current) current.cancel?.();
});

window.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (current && current.skip) current.skip();
  }
  if (ev.key === 'm' || ev.key === 'M') toggleSound();
});

// ---------------------------------------------------------------------- cycle

// Fixed step: with a variable dt the game behaves differently at 60 and 144 Hz —
// a monster that walks further, a shot that comes out faster. At 1/60 the
// behaviour is the same on any machine, and the loop's guard stops the spiral
// when the tab comes back from the background.
let frames = 0;

const loop = createLoop({
  step: 1 / 60,
  maxSteps: 8,
  update: (h) => {
    if (current) current.update(h);
  },
  draw: () => {
    if (!current) return;
    // the transform takes the logical world (720 tall) to the physical pixel
    begin(ctx);
    resetScreenText();
    current.draw(ctx);
    frames++;
  },
});

if (state.sawIntro) goToMap();
else goToIntro();

loop.start();

// Test bridge. The name `__game` is a slopkit convention: the test kit looks
// for it to read the viewport (and convert a touch coordinate without guessing)
// and to drive the game from outside.
window.__game = {
  name: 'animais-vs-monstros',
  viewport: vp, // has to expose W and H: that is where coordinate conversion comes from
  i18n,
  state: () => state,
  current: () => current,
  goToBattle,
  goToMap,
  loop,
  // the test uses this to wait for the screen to draw, instead of sleeping
  frames: () => frames,
  // the game only writes at its own consistency points (a stage won, the
  // intro seen, a save imported). A test that wants to check the round trip
  // needs to reach one without playing a whole stage.
  save: () => Save.save(state),
  // this game has no DOM to read: its whole UI is drawn on the canvas, so the
  // bridge hands back the strings the last frame actually wrote
  screenText,
};

// old name, kept so loose scripts don't break
window.AVM = { ...window.__game, screen: () => current, vp };
