// Two languages, one dictionary, keyed by phrase — so a missing translation is
// visible on the line you are editing and `missingKeys` can fail the build.

import { createI18n } from 'slopkit/i18n';

export const dict = {
  'game.title': { pt: 'Invasores Espaciais', en: 'Space Invaders' },
  'game.tagline': {
    pt: 'Eles descem. Você segura a linha.',
    en: 'They descend. You hold the line.',
  },

  'menu.defend': { pt: 'Defender', en: 'Defend' },
  'menu.again': { pt: 'De novo', en: 'Again' },
  'menu.controls': {
    pt: 'Setas ou A/D para mover · espaço, J ou Z para atirar · M silencia',
    en: 'Arrows or A/D to move · space, J or Z to fire · M mutes',
  },
  'menu.touch': {
    pt: 'No celular arraste para mover — a nave atira sozinha enquanto o dedo está na tela',
    en: 'On a phone drag to move — the cannon fires on its own while your finger is down',
  },

  'hud.score': { pt: 'pontos', en: 'score' },
  'hud.wave': { pt: 'onda', en: 'wave' },
  'hud.lives': { pt: 'vidas', en: 'lives' },
  'hud.best': { pt: 'recorde', en: 'best' },

  'over.title': { pt: 'A invasão passou', en: 'The invasion broke through' },
  'over.score': { pt: 'Pontos', en: 'Score' },
  'over.wave': { pt: 'Onda', en: 'Wave' },
  'over.killed': { pt: 'Invasores', en: 'Invaders' },
  'over.record': { pt: 'Novo recorde!', en: 'New record!' },
  'over.best': { pt: 'recorde', en: 'best' },
  'over.breach': { pt: 'O enxame cruzou a linha.', en: 'The swarm crossed the line.' },
  'over.shot': { pt: 'O canhão foi atingido.', en: 'The cannon went down.' },
  'over.rammed': { pt: 'O enxame chegou ao canhão.', en: 'The swarm reached the cannon.' },

  'wave.clear': { pt: 'Onda {n} eliminada!', en: 'Wave {n} cleared!' },
  'wave.next': { pt: 'Onda {n}', en: 'Wave {n}' },

  'page.title': { pt: 'Invasores Espaciais', en: 'Space Invaders' },
};

export const i18n = createI18n({ game: 'invasores-espaciais', dict });
export const t = (key, values) => i18n.t(key, values);
