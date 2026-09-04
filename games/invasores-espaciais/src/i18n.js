// Two languages, one dictionary, keyed by phrase — so a missing translation is
// visible on the line you are editing and `missingKeys` can fail the build.

import { createI18n } from 'slopkit/i18n';

export const dict = {
  'game.title': { pt: 'Fliperama Neon', en: 'Neon Arcade' },
  'game.tagline': {
    pt: 'Sete clássicos, uma ficha. Escolha a máquina.',
    en: 'Seven classics, one token. Pick your machine.',
  },

  'menu.pick': { pt: 'Escolha a máquina', en: 'Pick your machine' },
  'menu.best': { pt: 'recorde', en: 'best' },
  'menu.controls': {
    pt: 'Setas ou A/D movem · espaço atira · M silencia · no celular arraste ou deslize',
    en: 'Arrows or A/D move · space fires · M mutes · drag or swipe on a phone',
  },
  'menu.back': { pt: 'Máquinas', en: 'Machines' },
  'menu.again': { pt: 'De novo', en: 'Again' },

  'games.swarm.name': { pt: 'Enxame Estelar', en: 'Star Swarm' },
  'games.swarm.desc': {
    pt: 'Segure a linha contra o enxame que desce.',
    en: 'Hold the line against the descending swarm.',
  },
  'games.swarm.controls': {
    pt: '←/→ ou A/D movem · espaço atira',
    en: '←/→ or A/D to move · space to fire',
  },

  'games.maze.name': { pt: 'Labirinto Faminto', en: 'Hungry Maze' },
  'games.maze.desc': {
    pt: 'Coma tudo, desvie das sombras, vire o jogo com a pílula.',
    en: 'Eat it all, dodge the shadows, turn the tables with the pill.',
  },
  'games.maze.controls': {
    pt: 'Setas ou WASD viram · deslize o dedo para virar',
    en: 'Arrows or WASD to turn · swipe to turn',
  },

  'games.blocks.name': { pt: 'Quebra-Blocos', en: 'Block Breaker' },
  'games.blocks.desc': {
    pt: 'Rebata a bola e derrube o muro, fileira por fileira.',
    en: 'Bounce the ball and take the wall down, row by row.',
  },
  'games.blocks.controls': {
    pt: '←/→ ou A/D movem a raquete · arraste no celular',
    en: '←/→ or A/D to move the paddle · drag on a phone',
  },

  'games.snake.name': { pt: 'Cobra Neon', en: 'Neon Snake' },
  'games.snake.desc': {
    pt: 'Coma, cresça e não morda a si mesma.',
    en: 'Eat, grow, and do not bite yourself.',
  },
  'games.snake.controls': {
    pt: 'Setas ou WASD viram · deslize o dedo para virar',
    en: 'Arrows or WASD to turn · swipe to turn',
  },

  'games.rocks.name': { pt: 'Cinturão de Asteroides', en: 'Asteroid Belt' },
  'games.rocks.desc': {
    pt: 'Gire, acelere e parta as rochas antes que elas partam você.',
    en: 'Turn, burn and split the rocks before they split you.',
  },
  'games.rocks.controls': {
    pt: '←/→ giram · ↑ acelera · espaço atira',
    en: '←/→ to turn · ↑ to thrust · space to fire',
  },

  'games.hopper.name': { pt: 'Travessia', en: 'Hop Across' },
  'games.hopper.desc': {
    pt: 'Rua, rio e pressa: chegue ao outro lado.',
    en: 'Road, river and hurry: reach the other side.',
  },
  'games.hopper.controls': {
    pt: 'Setas pulam para o lado · deslize para pular',
    en: 'Arrows hop · swipe to hop',
  },

  'games.bounce.name': { pt: 'Rebate Neon', en: 'Neon Bounce' },
  'games.bounce.desc': {
    pt: 'Você contra a máquina: devolva tudo.',
    en: 'You against the machine: return everything.',
  },
  'games.bounce.controls': {
    pt: '↑/↓ ou W/S movem · arraste no celular',
    en: '↑/↓ or W/S to move · drag on a phone',
  },

  'hud.score': { pt: 'pontos', en: 'score' },
  'hud.wave': { pt: 'onda', en: 'wave' },
  'hud.level': { pt: 'nível', en: 'level' },
  'hud.lives': { pt: 'vidas', en: 'lives' },
  'hud.best': { pt: 'recorde', en: 'best' },

  'over.score': { pt: 'Pontos', en: 'Score' },
  'over.record': { pt: 'Novo recorde!', en: 'New record!' },
  'over.best': { pt: 'recorde', en: 'best' },

  'maze.ready': { pt: 'Preparar!', en: 'Ready!' },
  'maze.clear': { pt: 'Labirinto limpo!', en: 'Maze cleared!' },

  'wave.clear': { pt: 'Onda {n} eliminada!', en: 'Wave {n} cleared!' },
  'wave.next': { pt: 'Onda {n}', en: 'Wave {n}' },

  'page.title': { pt: 'Fliperama Neon', en: 'Neon Arcade' },
};

export const i18n = createI18n({ game: 'invasores-espaciais', dict });
export const t = (key, values) => i18n.t(key, values);
