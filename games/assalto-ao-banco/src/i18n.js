// Two languages, one dictionary, keyed by phrase — so a missing translation is
// visible on the line you are editing, and `missingKeys` can fail a test.

import { createI18n } from 'slopkit/i18n';

export const dict = {
  'game.title': { pt: 'Assalto ao Banco', en: 'Bank Job' },
  'game.tagline': {
    pt: 'O cofre é no fim do corredor. O corredor é escuro.',
    en: 'The vault is at the end of the corridor. The corridor is dark.',
  },

  'intro.1': {
    pt: 'A porta dos fundos abre a cada andar, e a cada andar o banco é outro: outras salas, outros corredores, outros homens andando neles.',
    en: 'The back door opens on every floor, and every floor is a different bank: other rooms, other corridors, other men walking them.',
  },
  'intro.2': {
    pt: 'Você enxerga só o que está na sua frente. Eles também — e o que está na frente deles está marcado no chão.',
    en: 'You only see what is in front of you. So do they — and what is in front of them is painted on the floor.',
  },
  'intro.3': {
    pt: 'Um guarda que te vê não atira e pronto: ele corre até o painel vermelho mais próximo. Se chegar, o andar inteiro sabe onde você está.',
    en: 'A guard who sees you does not just shoot: he runs for the nearest red panel. If he reaches it, the whole floor knows where you are.',
  },
  'intro.4': {
    pt: 'Um corpo no chão conta a mesma história. Arraste-o para onde ninguém passa.',
    en: 'A body on the carpet tells the same story. Drag it somewhere nobody walks.',
  },

  'menu.start': { pt: 'Entrar pelos fundos', en: 'In through the back' },
  'menu.again': { pt: 'De novo', en: 'Again' },
  'menu.next': { pt: 'Descer mais um andar', en: 'One floor down' },
  'menu.controls': {
    pt: 'WASD ou setas andam · o mouse mira · clique atira · espaço rola · Shift anda em silêncio · E arrasta corpo',
    en: 'WASD or arrows to move · the mouse aims · click to fire · space rolls · Shift to walk silently · E drags a body',
  },
  'menu.aim': {
    pt: 'A arma mira sozinha: você aponta para o lado, e dentro de um limite razoável ela acha o homem — um colchete amarelo mostra em quem travou. É o mesmo no celular, onde o polegar nunca vai ser preciso.',
    en: 'The gun aims itself: you point roughly, and inside a fair margin it finds the man — yellow brackets show who it has. Same on a phone, where a thumb is never going to be precise.',
  },
  'menu.pickup': {
    pt: 'Nada aqui tem botão de pegar: pare em cima da arma, do dinheiro ou do alarme e o anel enche sozinho — o mesmo do cofre, só que rápido. Passar correndo não conta.',
    en: 'Nothing here has a pick-up key: stop on the gun, the cash or the alarm and the ring fills by itself — the vault\'s own mechanism, only quick. Sprinting over it does not count.',
  },
  'menu.touch': {
    pt: 'No celular a metade esquerda anda, e nasce onde o dedo toca. À direita fica a mira: encostar nela já é um tiro, e puxar o dedo para fora vira a arma — vale para o ícone e para qualquer ponto da metade direita. O botão 🌀 rola; a mão só aparece quando há corpo por perto.',
    en: 'On a phone the left half walks, and appears where your thumb lands. The right half is the trigger: touching it is already a shot, and dragging off it swings the gun — the reticle in the corner and any spare patch of the right half do the same thing. The 🌀 button rolls; the hand only shows up when there is a body at your feet.',
  },
  'menu.tip': {
    pt: 'Você também pode puxar um alarme. Todo mundo corre para o painel — e o painel não é onde você está.',
    en: 'You can pull an alarm yourself. Everybody runs to the panel — and the panel is not where you are.',
  },

  'hud.floor': { pt: 'Andar {n}', en: 'Floor {n}' },
  'hud.alarm': { pt: 'ALARME', en: 'ALARM' },
  'hud.drilling': { pt: 'arrombando', en: 'drilling' },
  'hud.key': { pt: 'E', en: 'E' },
  'hud.tap': { pt: '✋', en: '✋' },

  'prompt.take': { pt: 'pegar {gun}', en: 'take the {gun}' },
  'prompt.heal': { pt: 'kit médico', en: 'medkit' },
  'prompt.loot': { pt: 'pegar o dinheiro', en: 'take the cash' },
  'prompt.carry': { pt: 'arrastar o corpo', en: 'drag the body' },
  'prompt.drop': { pt: 'largar o corpo', en: 'drop the body' },
  'prompt.pull': { pt: 'puxar o alarme', en: 'pull the alarm' },

  'gun.silenced': { pt: 'pistola com silenciador', en: 'silenced pistol' },
  'gun.pistol': { pt: 'pistola', en: 'pistol' },
  'gun.revolver': { pt: 'revólver', en: 'revolver' },
  'gun.smg': { pt: 'submetralhadora', en: 'SMG' },
  'gun.shotgun': { pt: 'espingarda', en: 'shotgun' },
  'gun.rifle': { pt: 'fuzil', en: 'rifle' },
  'gun.dart': { pt: 'pistola de dardos', en: 'dart gun' },
  'gun.lmg': { pt: 'metralhadora', en: 'machine gun' },
  'gun.sniper': { pt: 'rifle de precisão', en: 'sniper rifle' },

  'clear.title': { pt: 'Cofre aberto', en: 'Vault open' },
  'clear.silent': { pt: 'Ninguém ouviu nada', en: 'Nobody heard a thing' },
  'clear.money': { pt: 'Na mochila', en: 'In the bag' },
  'clear.floor': { pt: 'Andar', en: 'Floor' },
  'clear.kills': { pt: 'Guardas no chão', en: 'Guards down' },
  'clear.next': { pt: 'O próximo andar é maior. E eles já foram avisados.', en: 'The next floor is bigger. And they have been warned.' },

  'over.title': { pt: 'Você ficou no andar {n}', en: 'You stayed on floor {n}' },
  'over.money': { pt: 'Dinheiro', en: 'Money' },
  'over.floors': { pt: 'Andares limpos', en: 'Floors cleared' },
  'over.kills': { pt: 'Guardas no chão', en: 'Guards down' },
  'over.silent': { pt: 'Andares em silêncio', en: 'Silent floors' },
  'over.record': { pt: 'Novo recorde!', en: 'New record!' },
  'over.best': { pt: 'recorde', en: 'best' },

  'sound.on': { pt: 'som ligado', en: 'sound on' },
  'sound.off': { pt: 'som desligado', en: 'sound off' },
  'boot.failed': { pt: 'O banco não abriu', en: 'The bank would not open' },
  'page.title': { pt: 'Assalto ao Banco', en: 'Bank Job' },
};

export const i18n = createI18n({ game: 'assalto-ao-banco', dict });
export const t = (key, values) => i18n.t(key, values);
