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
    pt: 'Fuzil rápido e leve: nove tiros derrubam um corpo, seis por segundo.',
    en: 'A fast, light rifle: nine rounds put a body down, six a second.',
  },
  'side.alienNote': {
    pt: 'Blaster pesado: seis bolas derrubam um corpo, e você paga esperando a próxima.',
    en: 'A heavy blaster: six bolts put a body down, and you pay for it waiting.',
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
    pt: 'WASD ou setas andam · o mouse mira · clique atira · espaço rola · M liga e desliga o som',
    en: 'WASD or arrows to move · the mouse aims · click to fire · space rolls · M mutes',
  },
  'menu.aim': {
    pt: 'A arma mira sozinha: você aponta para o lado e, dentro de um limite razoável, ela acha o soldado. O colchete mostra em quem travou e fecha quando o corpo termina o giro; o tiro sai quando ele fecha.',
    en: 'The gun aims itself: you point roughly and inside a fair margin it finds the man. The brackets show what it has and close as the body finishes its turn; the round leaves when they shut.',
  },
  'menu.sight': {
    pt: 'A câmera fica em cima de você e o campo é maior que a tela. De dia você enxerga a sala inteira em volta — mas nada através de parede. O labirinto é de noite: ali só existe o que a lanterna alcança. O mapa no canto mostra o seu esquadrão e quem ele está vendo.',
    en: 'The camera sits on you and the field is bigger than the screen. By day you see the whole room around you — and nothing through a wall. The maze is at night: there, only what the torch reaches exists. The map in the corner shows your squad and whoever it can see.',
  },
  'menu.touch': {
    pt: 'No celular a metade esquerda anda e nasce onde o dedo toca; a direita é o gatilho — um toque gira para o inimigo mais próximo que dá para ver e atira. O botão 🌀 rola.',
    en: 'On a phone the left half walks and appears where your thumb lands; the right half is the trigger — a tap turns you onto the nearest enemy you can see and fires. The 🌀 button rolls.',
  },
  'menu.shop': {
    pt: 'Cada baixa rende cristais — e mais ainda se o corpo estava com uma bandeira. Dentro da sua base os cristais compram arma: dispersor, repetidora, lança. Arma comprada tem munição contada, e quando ela acaba você volta para a sua. Se você morrer, a arma cai no chão com o que sobrou nela — de qualquer um que passar por cima.',
    en: 'Every body you put down pays in shards, and one carrying a flag pays more. On your own ground the shards buy a gun: scattergun, repeater, lance. A bought gun has its rounds counted, and when they are gone you are back on your own. Die with it and it lands on the deck with whatever is left in it — for whoever walks over it.',
  },
  'menu.tip': {
    pt: 'Se a sua bandeira sumiu, o ponto não entra — e ela não volta sozinha: alguém do seu time tem que pegar do chão e carregar até o pedestal, no aberto, de mãos ocupadas.',
    en: 'With your flag gone the point does not count — and it does not come back on its own: somebody has to pick it off the deck and walk it to the stand, in the open, with both hands full.',
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
    pt: 'Escuro: a única arena de noite. Você lê o corredor pela lanterna, e eles também. Quem carrega bandeira aparece para todo mundo.',
    en: 'Dark: the one night arena. You read the corridor through a torch, and so do they. Whoever carries a flag shows up for everybody.',
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
  'hud.shards': { pt: 'cristais', en: 'shards' },
  'hud.ammo': { pt: 'munição', en: 'rounds' },

  'gun.rifle': { pt: 'Fuzil', en: 'Rifle' },
  'gun.blaster': { pt: 'Blaster', en: 'Blaster' },
  'gun.scatter': { pt: 'Dispersor', en: 'Scattergun' },
  'gun.repeater': { pt: 'Repetidora', en: 'Repeater' },
  'gun.lance': { pt: 'Lança', en: 'Lance' },
  'gun.scatter.note': { pt: 'tudo de uma vez, de perto', en: 'everything at once, up close' },
  'gun.repeater.note': { pt: 'o dobro de tiros, metade da mira', en: 'twice the rounds, half the aim' },
  'gun.lance.note': { pt: 'atravessa o primeiro e acha o segundo', en: 'through the first, into the second' },

  'shop.title': { pt: 'ARMARIA — você está na sua base', en: 'ARMOURY — you are on your own ground' },
  'shop.hint': { pt: 'aperte 1, 2 ou 3 · no celular, toque na arma', en: 'press 1, 2 or 3 · on a phone, tap the gun' },
  'shop.short': { pt: 'faltam cristais', en: 'not enough shards' },
  'hud.respawn': { pt: 'volta em {n}', en: 'back in {n}' },
  'hud.flagHome': { pt: 'em casa', en: 'home' },
  'hud.flagOut': { pt: 'roubada', en: 'stolen' },
  'hud.flagDown': { pt: 'no chão', en: 'on the deck' },
  'hud.carrying': { pt: 'VOCÊ ESTÁ COM A BANDEIRA — VOLTE', en: 'YOU HAVE THE FLAG — GET HOME' },
  'hud.rescuing': { pt: 'SUA BANDEIRA ESTÁ NA SUA MÃO — LEVE ATÉ O PEDESTAL', en: 'YOUR FLAG IS IN YOUR HANDS — WALK IT TO THE STAND' },
  'hud.blocked': { pt: 'sua bandeira está fora: o ponto não conta', en: 'your flag is out: the point will not count' },

  'log.taken': { pt: 'Bandeira {team} roubada', en: '{team} flag taken' },
  'log.dropped': { pt: 'Bandeira {team} caiu', en: '{team} flag dropped' },
  'log.returned': { pt: 'Bandeira {team} de volta', en: '{team} flag back home' },
  'log.recovered': { pt: 'Bandeira {team} recolhida', en: '{team} flag picked up' },
  'log.restored': { pt: 'Bandeira {team} no pedestal', en: '{team} flag back in its stand' },
  'log.captured': { pt: '{team} marcou!', en: '{team} scored!' },
  'log.bought': { pt: '{team} comprou uma arma', en: '{team} bought a gun' },

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
