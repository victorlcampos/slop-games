// Two languages, one dictionary, keyed by phrase — so a missing translation is
// visible on the line you are editing and `missingKeys` can fail the build.

import { createI18n } from 'slopkit/i18n';

export const dict = {
  'game.title': { pt: 'Chuva de Ferro', en: 'Iron Rain' },
  'game.tagline': {
    pt: 'A carga deles não para de cair. Você não pode parar de atirar.',
    en: 'Their cargo will not stop falling. You cannot stop shooting.',
  },

  'intro.1': {
    pt: 'Ninguém viu a nave chegar. Viram o casco abrir.',
    en: 'Nobody saw the ship arrive. They saw the hull split.',
  },
  'intro.2': {
    pt: 'Não desceram soldados: desceu o porão. Engradados, cofres, bigornas, coisas que ninguém sabe nomear — tudo caindo sobre a estrada 14, a noite inteira, sem pressa e sem alvo.',
    en: 'No soldiers came down: the hold did. Crates, safes, anvils, things nobody has a name for — all of it falling on Route 14, all night, in no hurry and at nothing in particular.',
  },
  'intro.3': {
    pt: 'O posto avançado tinha quatro homens e um fuzil de dotação para cada. Sobrou você e o seu.',
    en: 'The outpost had four men and one service rifle each. What is left is you and yours.',
  },
  'intro.4': {
    pt: 'A ordem é simples: mantenha a estrada limpa. O que eles largam é o seu arsenal — derrube antes de tocar o chão.',
    en: 'The order is simple: keep the road clear. What they drop is your arsenal — bring it down before it lands.',
  },

  'menu.start': { pt: 'Entrar na estrada', en: 'Take the road' },
  'menu.again': { pt: 'De novo', en: 'Again' },
  'menu.controls': {
    pt: 'Setas ou A/D andam · W, ↑ ou espaço pula · S ou ↓ agacha · segure J, Z ou o clique para atirar',
    en: 'Arrows or A/D to move · W, ↑ or space to jump · S or ↓ to crouch · hold J, Z or the mouse to fire',
  },
  'menu.touch': {
    pt: 'No celular o controle nasce onde o dedo toca: metade esquerda é o direcional (cima pula, baixo agacha), metade direita é o gatilho.',
    en: 'On a phone the control appears where your thumb lands: the left half is the stick (up jumps, down crouches), the right half is the trigger.',
  },
  'menu.aim': {
    pt: 'A mira é automática — ela escolhe o que está prestes a cair na sua cabeça. Segure ↑ para atirar reto para cima.',
    en: 'The gun aims itself — it picks whatever is about to land on your head. Hold ↑ to fire straight up.',
  },

  'hud.score': { pt: 'pontos', en: 'score' },
  'hud.time': { pt: 'tempo', en: 'time' },
  'hud.best': { pt: 'recorde', en: 'best' },
  'hud.lives': { pt: 'vidas', en: 'lives' },
  'hud.ammo': { pt: 'munição', en: 'ammo' },
  'hud.dry': { pt: 'sem munição — de volta ao fuzil', en: 'out of ammo — back to the rifle' },
  'hud.medkit': { pt: 'kit médico', en: 'medkit' },
  'hud.moveHere': { pt: 'toque aqui para andar · cima pula · baixo agacha', en: 'touch here to move · up jumps · down crouches' },
  'hud.fireHere': { pt: 'toque aqui para atirar', en: 'touch here to fire' },

  'over.title': { pt: 'A estrada ficou com você', en: 'The road kept you' },
  'over.score': { pt: 'Pontos', en: 'Score' },
  'over.time': { pt: 'Tempo vivo', en: 'Time alive' },
  'over.killed': { pt: 'Carga destruída', en: 'Cargo destroyed' },
  'over.record': { pt: 'Novo recorde!', en: 'New record!' },
  'over.bestScore': { pt: 'Melhor pontuação', en: 'Best score' },
  'over.bestTime': { pt: 'Mais tempo vivo', en: 'Longest time alive' },

  'sound.on': { pt: 'som ligado', en: 'sound on' },
  'sound.off': { pt: 'som desligado', en: 'sound off' },
  'boot.failed': { pt: 'A estrada não abriu', en: 'The road would not open' },
  'page.title': { pt: 'Chuva de Ferro', en: 'Iron Rain' },
};

export const i18n = createI18n({ game: 'chuva-de-ferro', dict });
export const t = (key, values) => i18n.t(key, values);

/** Picks the side of a `{ pt, en }` written in a data table. */
export const pick = (value) => (value && typeof value === 'object' ? value[i18n.lang] || value.en : value);
