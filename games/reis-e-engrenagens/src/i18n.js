// Two languages, one dictionary, keyed by phrase — so half a translation is
// visible on the line you are writing and `missingKeys` can fail a test.

import { createI18n } from 'slopkit/i18n';

export const dict = {
  'page.title': { en: 'Kings & Gears', pt: 'Reis e Engrenagens' },
  'game.title': { en: 'Kings & Gears', pt: 'Reis e Engrenagens' },
  'game.tagline': {
    en: 'Build the castle. Hide the king. Then find theirs.',
    pt: 'Monte o castelo. Esconda o rei. Depois ache o deles.',
  },

  // ------------------------------------------------------------- the sides
  'side.knights': { en: 'The Kingdom', pt: 'O Reino' },
  'side.machines': { en: 'The Machines', pt: 'As Máquinas' },
  'side.knights.note': {
    en: 'Trebuchets, fire pots and a ballista. Slow, heavy, and it burns everything that was ever a tree.',
    pt: 'Trabucos, potes de fogo e uma balista. Lento, pesado, e queima tudo que um dia foi árvore.',
  },
  'side.machines.note': {
    en: 'Rail slugs, rust shells and a coil that hunts metal. Fast, flat, and it eats the armour you paid most for.',
    pt: 'Projéteis de trilho, obuses de ferrugem e uma bobina que caça metal. Rápido, reto, e come a blindagem mais cara que você comprou.',
  },
  'side.pick': { en: 'Which crown are you defending?', pt: 'Qual coroa você defende?' },
  'king.knights': { en: 'the King', pt: 'o Rei' },
  'king.machines': { en: 'the Emperor', pt: 'o Imperador' },

  // ------------------------------------------------------------- the menu
  'menu.start': { en: 'Raise a castle', pt: 'Erguer um castelo' },
  'menu.resume': { en: 'Back to the siege', pt: 'Voltar ao cerco' },
  'menu.newRun': { en: 'Start over', pt: 'Recomeçar' },
  'menu.restart': { en: 'Pick a new crown', pt: 'Escolher outra coroa' },
  'menu.wiped': { en: 'Run wiped — starting from nothing.', pt: 'Progresso apagado — recomeçando do zero.' },
  'menu.rules': {
    en: 'You get coins and a plot of ground. Buy walls, stack them, put your king somewhere you believe in — then take turns lobbing things at each other until one crown is under the rubble.',
    pt: 'Você recebe moedas e um terreno. Compre paredes, empilhe, ponha seu rei onde você acredita — e depois vocês se revezam jogando coisas um no outro até uma coroa ficar debaixo do entulho.',
  },
  'menu.controls': {
    en: 'Left and right drive · up and down aim · space opens the power gauge and fires · 1-4 pick a munition',
    pt: 'Esquerda e direita andam · cima e baixo miram · espaço abre a barra de força e dispara · 1-4 troca de munição',
  },

  // ---------------------------------------------------------- the workshop
  'shop.title': { en: 'Workshop', pt: 'Oficina' },
  'shop.coins': { en: 'coins', pt: 'moedas' },
  'shop.left': { en: '{n} left', pt: 'restam {n}' },
  'shop.king': { en: 'King', pt: 'Rei' },
  'shop.erase': { en: 'Remove', pt: 'Remover' },
  'shop.auto': { en: 'Draft one for me', pt: 'Monte para mim' },
  'shop.clear': { en: 'Tear it down', pt: 'Derrubar tudo' },
  'shop.fight': { en: 'To battle', pt: 'Para a batalha' },
  'shop.intel': { en: 'against', pt: 'contra' },
  'shop.hint': {
    en: 'Tap a cell to build. The king has to end up somewhere that stands on its own.',
    pt: 'Toque numa célula para construir. O rei tem que acabar em algo que se sustente sozinho.',
  },
  'shop.span': { en: 'bridges {n}', pt: 'vence {n}' },
  'shop.spanNone': { en: 'holds nothing up', pt: 'não sustenta nada' },
  'shop.hp': { en: '{n} hp', pt: '{n} de vida' },

  'why.noking': { en: 'Your king is not on the board yet.', pt: 'Seu rei ainda não está no tabuleiro.' },
  'why.floating': { en: 'That would be standing on nothing.', pt: 'Isso ficaria apoiado no nada.' },
  'why.broke': { en: 'Not enough coins.', pt: 'Moedas de menos.' },
  'why.taken': { en: 'There is already something there.', pt: 'Já tem coisa aí.' },
  'why.empty': { en: 'Nothing to remove.', pt: 'Nada para remover.' },
  'why.holding': { en: 'Something is resting on that one.', pt: 'Tem coisa apoiada nessa.' },
  'why.king': { en: 'The king moves, he does not get deleted.', pt: 'O rei se muda, não se apaga.' },
  'why.outside': { en: 'Outside the plot.', pt: 'Fora do terreno.' },
  'why.unknown': { en: 'Nothing in hand.', pt: 'Nada na mão.' },

  // ------------------------------------------------------------ the battle
  'turn.you': { en: 'Your shot', pt: 'Seu tiro' },
  'turn.foe': { en: 'They are aiming', pt: 'Eles estão mirando' },
  'turn.flying': { en: '…', pt: '…' },
  'hud.wind': { en: 'wind', pt: 'vento' },
  'hud.power': { en: 'power', pt: 'força' },
  'hud.fuel': { en: 'fuel', pt: 'combustível' },
  'hud.fire': { en: 'FIRE', pt: 'FOGO' },
  'hud.release': { en: 'let go', pt: 'solte' },
  'hud.missed': { en: 'Out of the valley — nothing hit.', pt: 'Saiu do vale — não acertou nada.' },
  'hud.angle': { en: 'angle', pt: 'ângulo' },
  'hud.turn': { en: 'turn {n}', pt: 'turno {n}' },
  'hud.infinite': { en: '∞', pt: '∞' },

  // ------------------------------------------------------------ the result
  'over.won': { en: 'The crown holds', pt: 'A coroa se manteve' },
  'over.lost': { en: 'Your crown is under it', pt: 'Sua coroa ficou embaixo' },
  'over.draw': { en: 'Both of them, at once', pt: 'Os dois, ao mesmo tempo' },
  'over.king': { en: 'A direct hit on the crown ends it.', pt: 'Um acerto direto na coroa encerra.' },
  'over.time': { en: 'Nobody landed the last one — the steadier crown takes it.', pt: 'Ninguém acertou o último — fica com a coroa mais inteira.' },
  'over.walls': { en: 'Two crowns just as battered — the walls decided it.', pt: 'Duas coroas igualmente surradas — as paredes decidiram.' },
  'over.reward': { en: '+{n} coins for the next castle', pt: '+{n} moedas para o próximo castelo' },
  'over.next': { en: 'Next siege', pt: 'Próximo cerco' },
  'over.again': { en: 'Again', pt: 'De novo' },
  'over.rebuild': { en: 'Back to the workshop', pt: 'Voltar para a oficina' },
  'over.campaign': { en: 'Every crown on the map is yours.', pt: 'Todas as coroas do mapa são suas.' },
  'over.level': { en: 'Siege {n} of {total} · {name}', pt: 'Cerco {n} de {total} · {name}' },

  // ------------------------------------------------------------- materials
  'm.sand': { en: 'Sandbag', pt: 'Saco de areia' },
  'm.wood': { en: 'Timber', pt: 'Madeira' },
  'm.crystal': { en: 'Crystal', pt: 'Cristal' },
  'm.stone': { en: 'Stone', pt: 'Pedra' },
  'm.iron': { en: 'Iron', pt: 'Ferro' },
  'm.king': { en: 'Crown', pt: 'Coroa' },
  'm.sand.note': { en: 'Eats blast, carries nothing.', pt: 'Come explosão, não carrega nada.' },
  'm.wood.note': { en: 'Spans gaps. Burns.', pt: 'Vence vãos. Queima.' },
  'm.crystal.note': { en: 'Cheap armour. Shatters on a bolt.', pt: 'Blindagem barata. Estilhaça no virote.' },
  'm.stone.note': { en: 'No talent, no weakness.', pt: 'Sem talento, sem fraqueza.' },
  'm.iron.note': { en: 'Bridges four cells. Rusts.', pt: 'Vence quatro células. Enferruja.' },

  // --------------------------------------------------------------- weapons
  'w.boulder': { en: 'Trebuchet stone', pt: 'Pedra de trabuco' },
  'w.firepot': { en: 'Fire pot', pt: 'Pote de fogo' },
  'w.ballista': { en: 'Ballista bolt', pt: 'Virote de balista' },
  'w.hail': { en: 'Stone hail', pt: 'Chuva de pedras' },
  'w.railshot': { en: 'Rail slug', pt: 'Projétil de trilho' },
  'w.rustshell': { en: 'Rust shell', pt: 'Obus de ferrugem' },
  'w.tesla': { en: 'Tesla coil', pt: 'Bobina tesla' },
  'w.drill': { en: 'Drill bomb', pt: 'Bomba perfuratriz' },
  'w.boulder.note': { en: 'Heavy, barely feels the wind. Cracks stone, slides off iron.', pt: 'Pesada, quase não sente vento. Racha pedra, escorrega no ferro.' },
  'w.firepot.note': { en: 'Sets timber alight for three turns, and the fire spreads.', pt: 'Põe fogo na madeira por três turnos, e o fogo se espalha.' },
  'w.ballista.note': { en: 'Flat and fast. Goes through crystal and out the other side.', pt: 'Reto e rápido. Atravessa cristal e sai do outro lado.' },
  'w.hail.note': { en: 'Splits into three at the top of the arc.', pt: 'Racha em três no topo do arco.' },
  'w.railshot.note': { en: 'Fast and flat. Nothing special, nothing wasted.', pt: 'Rápido e reto. Nada de especial, nada desperdiçado.' },
  'w.rustshell.note': { en: 'Eats iron for three turns, and it spreads down the wall.', pt: 'Come ferro por três turnos, e se espalha pela parede.' },
  'w.tesla.note': { en: 'Arcs to the nearest metal. In a scrapyard it arcs further.', pt: 'Arqueia para o metal mais perto. Num ferro-velho, arqueia mais longe.' },
  'w.drill.note': { en: 'Burrows before it goes off. Takes the ground, not the wall.', pt: 'Enterra antes de estourar. Leva o chão, não a parede.' },

  // ------------------------------------------------------------- the levels
  'lv.meadow': { en: 'The Meadow', pt: 'A Campina' },
  'lv.dunes': { en: 'The Dunes', pt: 'As Dunas' },
  'lv.quarry': { en: 'The Quarry', pt: 'A Pedreira' },
  'lv.scrapyard': { en: 'The Scrapyard', pt: 'O Ferro-Velho' },
  'lv.frost': { en: 'The Frost', pt: 'A Geleira' },
  'lv.forge': { en: 'The Forge', pt: 'A Forja' },
  'lv.meadow.note': { en: 'Ordinary earth. Craters behave.', pt: 'Terra comum. As crateras se comportam.' },
  'lv.dunes.note': { en: 'Sand goes everywhere. One shell digs a canyon.', pt: 'Areia vai para todo lado. Um obus abre um cânion.' },
  'lv.quarry.note': { en: 'Bedrock. Digging is a wasted turn here.', pt: 'Rocha viva. Cavar aqui é turno jogado fora.' },
  'lv.scrapyard.note': { en: 'Loose metal underfoot — the coil arcs half again as far.', pt: 'Metal solto no chão — a bobina arqueia metade mais longe.' },
  'lv.frost.note': { en: 'Packed snow. Fire struggles, everything else sinks in.', pt: 'Neve compacta. O fogo sofre, o resto afunda.' },
  'lv.forge.note': { en: 'Ash over embers, and the best gunner on the map.', pt: 'Cinza sobre brasa, e o melhor artilheiro do mapa.' },

  'run.level': { en: 'Siege {n}', pt: 'Cerco {n}' },
  'run.coins': { en: '{n} coins', pt: '{n} moedas' },
  'run.record': { en: '{n} won', pt: '{n} vencidos' },
};

export const i18n = createI18n({ dict });
export const t = (id, values) => i18n.t(id, values);

export const levelName = (level) => t(`lv.${level.id}`);
export const levelNote = (level) => t(`lv.${level.id}.note`);
export const weaponName = (id) => t(`w.${id}`);
export const weaponNote = (id) => t(`w.${id}.note`);
export const materialName = (id) => t(`m.${id}`);
export const kingName = (faction) => t(`king.${faction}`);
