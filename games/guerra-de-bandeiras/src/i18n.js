// Two languages, one dictionary, keyed by phrase — so a missing translation is
// visible on the line you are editing, and `missingKeys` can fail a test.

import { createI18n } from 'slopkit/i18n';

export const dict = {
  'game.title': { pt: 'Guerra de Bandeiras', en: 'Flag War' },
  'game.tagline': {
    pt: 'Pegue a bandeira deles. Traga para o seu campo. Dez vezes.',
    en: 'Take their flag. Bring it to your ground. Ten times.',
  },

  'side.human': { pt: 'Humanos', en: 'Humans' },
  'side.alien': { pt: 'Sentinelas', en: 'Sentinels' },
  'side.pick': { pt: 'De que lado você joga?', en: 'Which side are you on?' },
  'side.humanNote': {
    pt: 'Fuzil rápido e leve. Você atira mais vezes e erra menos quando está correndo.',
    en: 'A fast, light rifle. More rounds in the air, and it forgives running.',
  },
  'side.alienNote': {
    pt: 'Blaster pesado. Cada tiro dói o dobro, e você paga esperando o próximo.',
    en: 'A heavy blaster. Each bolt hurts twice as much, and you pay for it waiting.',
  },

  'menu.start': { pt: 'Entrar em campo', en: 'Take the field' },
  'menu.again': { pt: 'De novo', en: 'Again' },
  'menu.next': { pt: 'Próxima arena', en: 'Next arena' },
  'menu.arena': { pt: 'Arena', en: 'Arena' },
  'menu.locked': { pt: 'trancada', en: 'locked' },
  'menu.rules': {
    pt: 'A bandeira deles vale um ponto quando encosta no pedestal do seu time — e só se a sua bandeira estiver em casa. Primeiro esquadrão a dez leva a arena.',
    en: 'Their flag scores when it touches your stand — and only while your own flag is home. First squad to ten takes the arena.',
  },
  'menu.controls': {
    pt: 'WASD ou setas andam · o mouse mira · clique atira · espaço avança · M liga e desliga o som',
    en: 'WASD or arrows to move · the mouse aims · click to fire · space dashes · M mutes',
  },
  'menu.touch': {
    pt: 'No celular a metade esquerda anda e nasce onde o dedo toca; a direita é o gatilho — um toque gira para o inimigo mais próximo que dá para ver e atira. O botão 🌀 avança.',
    en: 'On a phone the left half walks and appears where your thumb lands; the right half is the trigger — a tap turns you onto the nearest enemy you can see and fires. The 🌀 button dashes.',
  },
  'menu.tip': {
    pt: 'Ninguém defende o seu pedestal sozinho. Se a sua bandeira sumiu, o ponto não entra: alguém tem que voltar.',
    en: 'Nobody holds your stand on their own. With your flag gone the point does not count: somebody has to turn round.',
  },

  'arena.corridors': { pt: 'Corredores Gêmeos', en: 'Twin Corridors' },
  'arena.corridors.note': {
    pt: 'Três pistas, duas passagens entre elas. Nada no caminho além de parede.',
    en: 'Three lanes, two ways between them. Nothing in the way but wall.',
  },
  'arena.bridge': { pt: 'A Ponte', en: 'The Bridge' },
  'arena.bridge.note': {
    pt: 'O abismo corta o campo ao meio e só se atravessa em dois lugares. A bala atravessa em qualquer um.',
    en: 'A pit splits the field and is crossed in two places. A bullet crosses anywhere.',
  },
  'arena.maze': { pt: 'O Labirinto', en: 'The Maze' },
  'arena.maze.note': {
    pt: 'Escuro. Você vê o que está perto — e o que o seu time está vendo. Quem carrega bandeira brilha para todo mundo.',
    en: 'Dark. You see what is near you, and what your squad can see. Whoever carries a flag glows for everybody.',
  },
  'arena.turrets': { pt: 'Ninho de Torres', en: 'Turret Nest' },
  'arena.turrets.note': {
    pt: 'Duas torres guardam cada pedestal. Dá para derrubar — e vinte segundos depois elas voltam.',
    en: 'Two turrets guard each stand. They can be shot down, and twenty seconds later they are back.',
  },
  'arena.gates': { pt: 'Os Portais', en: 'The Gates' },
  'arena.gates.note': {
    pt: 'Quatro placas, cada uma joga você do outro lado do campo. Funciona nos dois sentidos.',
    en: 'Four pads, each one throws you across the field. It works both ways.',
  },
  'arena.open': { pt: 'Campo Aberto', en: 'Open Field' },
  'arena.open.note': {
    pt: 'Cinco contra cinco, sem corredor nenhum para se esconder. O esquadrão mais rápido do jogo.',
    en: 'Five a side and no corridor to hide in. The fastest squad in the game.',
  },

  'hud.score': { pt: 'Placar', en: 'Score' },
  'hud.respawn': { pt: 'volta em {n}', en: 'back in {n}' },
  'hud.flagHome': { pt: 'em casa', en: 'home' },
  'hud.flagOut': { pt: 'roubada', en: 'stolen' },
  'hud.flagDown': { pt: 'no chão', en: 'on the deck' },
  'hud.carrying': { pt: 'VOCÊ ESTÁ COM A BANDEIRA — VOLTE', en: 'YOU HAVE THE FLAG — GET HOME' },
  'hud.blocked': { pt: 'sua bandeira está fora: o ponto não conta', en: 'your flag is out: the point will not count' },

  'log.taken': { pt: 'Bandeira {team} roubada', en: '{team} flag taken' },
  'log.dropped': { pt: 'Bandeira {team} caiu', en: '{team} flag dropped' },
  'log.returned': { pt: 'Bandeira {team} de volta', en: '{team} flag back home' },
  'log.captured': { pt: '{team} marcou!', en: '{team} scored!' },

  'end.won': { pt: 'Arena vencida', en: 'Arena taken' },
  'end.lost': { pt: 'Arena perdida', en: 'Arena lost' },
  'end.score': { pt: 'Placar', en: 'Score' },
  'end.captures': { pt: 'Suas capturas', en: 'Your captures' },
  'end.returns': { pt: 'Bandeiras salvas', en: 'Flags saved' },
  'end.kills': { pt: 'Baixas', en: 'Downed' },
  'end.time': { pt: 'Tempo', en: 'Time' },
  'end.unlocked': { pt: 'Nova arena liberada!', en: 'New arena unlocked!' },
  'end.last': { pt: 'Você venceu as seis arenas. A guerra é sua.', en: 'All six arenas are yours. The war is over.' },
  'end.retry': { pt: 'Tente de novo — o esquadrão deles não muda, mas você já viu o campo.', en: 'Try again — their squad has not changed, but you have seen the field now.' },

  'sound.on': { pt: 'som ligado', en: 'sound on' },
  'sound.off': { pt: 'som desligado', en: 'sound off' },
  'boot.failed': { pt: 'O campo não abriu', en: 'The field would not open' },
  'page.title': { pt: 'Guerra de Bandeiras', en: 'Flag War' },
};

export const i18n = createI18n({ game: 'guerra-de-bandeiras', dict });
export const t = (key, values) => i18n.t(key, values);

/** The name of an arena, from its id — the phase list and the HUD share it. */
export const arenaName = (id) => t(`arena.${id}`);
export const arenaNote = (id) => t(`arena.${id}.note`);
