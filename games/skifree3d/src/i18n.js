// Two languages for the mountain.
//
// The static copy — menu, mode cards, key hints — is written inline in
// template.html as `data-pt` / `data-en`, so it renders before any JavaScript
// runs and `bindText` only has to swap it. What lives here is the other kind:
// strings the game builds at runtime, where there is no markup to hang a
// translation off.

import { createI18n } from 'slopkit';

const DICT = {
  // ------------------------------------------------------------- game over
  'over.yeti.title': { pt: 'Você foi devorado', en: 'You were devoured' },
  'over.yeti.sub': {
    pt: 'O Yeti sempre vence. Mas você chegou longe.',
    en: 'The Yeti always wins. But you got far.',
  },
  'over.quit.title': { pt: 'Descida encerrada', en: 'Run over' },
  'over.quit.sub': { pt: 'Volte quando quiser mais neve.', en: 'Come back when you want more snow.' },
  'over.newBest': {
    pt: '🏔️ Novo recorde neste modo! (antes: {previous})',
    en: '🏔️ New best in this mode! (before: {previous})',
  },
  'over.best': {
    pt: 'Seu recorde neste modo: {value} pontos',
    en: 'Your best in this mode: {value} points',
  },

  // ---------------------------------------------------------------- tricks
  'trick.spin': { pt: '{degrees}°', en: '{degrees}°' },
  'trick.flip': { pt: 'Mortal', en: 'Flip' },
  'trick.flips': { pt: '{n}× mortal', en: '{n}× flip' },
  'trick.longAir': { pt: 'Voo longo', en: 'Big air' },
  'trick.air': { pt: 'Voo', en: 'Air' },

  // --------------------------------------------------------------- crashes
  'crash.tree': { pt: 'Árvore!', en: 'Tree!' },
  'crash.rock': { pt: 'Pedra!', en: 'Rock!' },
  'crash.stump': { pt: 'Toco!', en: 'Stump!' },
  'crash.tower': { pt: 'Torre do teleférico!', en: 'Lift tower!' },
  'crash.chalet': { pt: 'Isso era uma casa', en: 'That was a house' },
  'crash.sign': { pt: 'A placa avisava…', en: 'The sign did warn you…' },
  'crash.skier': { pt: 'Trombada!', en: 'Collision!' },
  'crash.boarder': { pt: 'Snowboarder!', en: 'Snowboarder!' },
  'crash.dog': { pt: 'O cachorro!', en: 'The dog!' },
  'crash.landing': { pt: 'Aterrissagem torta', en: 'Crooked landing' },
  'crash.other': { pt: 'Tombo!', en: 'Wipeout!' },

  // ----------------------------------------------------------------- gates
  'gate.hit': { pt: 'Portão', en: 'Gate' },
  'gate.missed': { pt: 'Portão perdido', en: 'Gate missed' },

  // ------------------------------------------------------------- shortcuts
  'camera.changed': { pt: 'Câmera: {mode}', en: 'Camera: {mode}' },
  'camera.chase': { pt: 'perseguição', en: 'chase' },
  'camera.retro': { pt: 'retrô', en: 'retro' },
  'camera.close': { pt: 'colada', en: 'close' },
  'sound.off': { pt: 'Som desligado', en: 'Sound off' },
  'sound.on': { pt: 'Som ligado', en: 'Sound on' },

  // ------------------------------------------------------------------ boot
  'boot.noWebGL': {
    pt: 'Este navegador não tem WebGL disponível.',
    en: 'This browser has no WebGL available.',
  },
  'boot.noWebGLHint': {
    pt: 'Ative a aceleração por hardware ou tente outro navegador.',
    en: 'Turn on hardware acceleration or try another browser.',
  },
  'boot.failed': { pt: 'Não foi possível iniciar a montanha.', en: 'Could not start the mountain.' },

  // ----------------------------------------------------------------- title
  'page.title': { pt: 'SkiFree 3D — Descida da Montanha', en: 'SkiFree 3D — Downhill Run' },
};

export const i18n = createI18n({ dict: DICT });

export const t = (id, values) => i18n.t(id, values);

/** Numbers read differently in each language: 12.500 in pt-BR, 12,500 in en-US. */
const locale = () => (i18n.lang === 'pt' ? 'pt-BR' : 'en-US');
export const num = (n) => Math.floor(n).toLocaleString(locale());
/** One decimal, with the separator the language uses — `74,5s` or `74.5s`. */
export const dec = (n, digits = 1) =>
  n.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
