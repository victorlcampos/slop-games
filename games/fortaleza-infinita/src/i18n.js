// Two languages, one dictionary, keyed by phrase — so a missing translation is
// visible on the line you are editing, and `missingKeys` can fail a test.

import { createI18n } from 'slopkit/i18n';

export const dict = {
  'game.title': { pt: 'Fortaleza Infinita', en: 'Infinite Fortress' },
  'game.tagline': {
    pt: 'O selo fica no fim do corredor. O corredor é escuro.',
    en: 'The seal is at the end of the corridor. The corridor is dark.',
  },

  'intro.1': {
    pt: 'A cada selo rompido a Fortaleza te engole mais um anel — e cada anel é outro lugar: outras salas, outros corredores, outros sentinelas patrulhando neles.',
    en: 'Every broken seal swallows you one ring further up — and every ring is another place: other rooms, other corridors, other sentinels walking them.',
  },
  'intro.2': {
    pt: 'Você enxerga só o que a lanterna alcança. Eles também — e o que está na frente deles está marcado no chão.',
    en: 'You only see what your torch reaches. So do they — and what is in front of them is painted on the floor.',
  },
  'intro.3': {
    pt: 'Um sentinela que te vê não atira e pronto: ele corre até o nó de alarme mais próximo. Se chegar, o anel inteiro sabe onde você está.',
    en: 'A sentinel that sees you does not just shoot: it runs for the nearest alarm node. If it gets there, the whole ring knows where you are.',
  },
  'intro.4': {
    pt: 'Um corpo no chão conta a mesma história. Arraste-o para onde ninguém patrulha.',
    en: 'A body on the deck tells the same story. Drag it somewhere nothing patrols.',
  },

  'menu.start': { pt: 'Sair da cela', en: 'Out of the cell' },
  'menu.again': { pt: 'De novo', en: 'Again' },
  'menu.next': { pt: 'Subir mais um anel', en: 'One ring up' },
  'menu.intro': { pt: 'Ver a abertura', en: 'Watch the opening' },
  'menu.controls': {
    pt: 'WASD ou setas andam · o mouse mira · clique atira · espaço rola · Shift anda em silêncio · E arrasta corpo',
    en: 'WASD or arrows to move · the mouse aims · click to fire · space rolls · Shift to walk silently · E drags a body',
  },
  'menu.aim': {
    pt: 'A arma mira sozinha: você aponta para o lado, e dentro de um limite razoável ela acha o sentinela — ou o olho, ou o nó de alarme. O colchete mostra em quem travou e fecha quando o corpo termina o giro; o tiro sai quando ele fecha.',
    en: 'The gun aims itself: you point roughly, and inside a fair margin it finds the sentinel — or the eye, or the alarm node. The brackets show what it has and close as the body finishes its turn; the shot leaves when they shut.',
  },
  'menu.pickup': {
    pt: 'Nada aqui tem botão de pegar: pare em cima da arma, dos cristais ou do nó e o anel enche sozinho — o mesmo do selo, só que rápido. Passar correndo não conta.',
    en: 'Nothing here has a pick-up key: stop on the gun, the shards or the node and the ring fills by itself — the seal\'s own mechanism, only quick. Sprinting over it does not count.',
  },
  'menu.touch': {
    pt: 'No celular a metade esquerda anda, e nasce onde o dedo toca. À direita fica o gatilho: um toque gira ele para a ameaça mais próxima que dá para ver — mesmo atrás — e atira; dá para fugir com um polegar e atirar em quem persegue com o outro. Arrastar o dedo escolhe a direção na mão. O botão 🌀 rola; a mão só aparece quando há corpo por perto.',
    en: 'On a phone the left half walks, and appears where your thumb lands. The right half is the trigger: a tap turns him onto the nearest threat he can see — even behind him — and fires; you can flee with one thumb and shoot your pursuer with the other. Dragging picks the direction by hand. The 🌀 button rolls; the hand only shows up when there is a body at your feet.',
  },
  'menu.tip': {
    pt: 'Você também pode acionar um nó de alarme. Tudo que vive no anel corre para o nó — e o nó não é onde você está.',
    en: 'You can trip an alarm node yourself. Everything alive on the ring runs to the node — and the node is not where you are.',
  },

  'hud.floor': { pt: 'Anel {n}', en: 'Ring {n}' },
  'hud.alarm': { pt: 'ALARME', en: 'ALARM' },
  'hud.drilling': { pt: 'rompendo o selo', en: 'breaching the seal' },
  'hud.key': { pt: 'E', en: 'E' },
  'hud.tap': { pt: '✋', en: '✋' },

  'prompt.take': { pt: 'pegar {gun}', en: 'take the {gun}' },
  'prompt.heal': { pt: 'cápsula de nanogel', en: 'nanogel pod' },
  'prompt.loot': { pt: 'pegar os cristais', en: 'take the shards' },
  'prompt.carry': { pt: 'arrastar o corpo', en: 'drag the body' },
  'prompt.drop': { pt: 'largar o corpo', en: 'drop the body' },
  'prompt.pull': { pt: 'acionar o nó de alarme', en: 'trip the alarm node' },

  'gun.whisper': { pt: 'bobina sussurro', en: 'whisper coil' },
  'gun.blaster': { pt: 'blaster de plasma', en: 'plasma blaster' },
  'gun.ioncannon': { pt: 'canhão de íons', en: 'ion cannon' },
  'gun.needler': { pt: 'agulhador', en: 'needler' },
  'gun.shockwave': { pt: 'onda de choque', en: 'shockwave' },
  'gun.lance': { pt: 'lança de fótons', en: 'photon lance' },
  'gun.stasis': { pt: 'dardo de estase', en: 'stasis dart' },
  'gun.shredder': { pt: 'trituradora de íons', en: 'ion shredder' },
  'gun.railgun': { pt: 'canhão de trilhos', en: 'railgun' },

  'clear.title': { pt: 'Selo rompido', en: 'Seal broken' },
  'clear.silent': { pt: 'Ninguém ouviu nada', en: 'Nothing heard a thing' },
  'clear.money': { pt: 'Nos bolsos', en: 'In your pockets' },
  'clear.floor': { pt: 'Anel', en: 'Ring' },
  'clear.kills': { pt: 'Sentinelas no chão', en: 'Sentinels down' },
  'clear.next': { pt: 'O próximo anel é maior. E a Fortaleza já sabe de você.', en: 'The next ring is wider. And the Fortress already knows.' },

  'over.title': { pt: 'Você ficou no anel {n}', en: 'You stayed on ring {n}' },
  'over.money': { pt: 'Cristais', en: 'Shards' },
  'over.floors': { pt: 'Anéis vencidos', en: 'Rings climbed' },
  'over.kills': { pt: 'Sentinelas no chão', en: 'Sentinels down' },
  'over.silent': { pt: 'Anéis em silêncio', en: 'Silent rings' },
  'over.record': { pt: 'Novo recorde!', en: 'New record!' },
  'over.best': { pt: 'recorde', en: 'best' },

  'sound.on': { pt: 'som ligado', en: 'sound on' },
  'sound.off': { pt: 'som desligado', en: 'sound off' },
  'boot.failed': { pt: 'A Fortaleza não abriu', en: 'The Fortress would not open' },
  'page.title': { pt: 'Fortaleza Infinita', en: 'Infinite Fortress' },
};

export const i18n = createI18n({ game: 'fortaleza-infinita', dict });
export const t = (key, values) => i18n.t(key, values);
