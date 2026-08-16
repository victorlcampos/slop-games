// Two languages, one dictionary, keyed by phrase — half a translation is
// visible on the line you are writing, and `missingKeys` fails a test on it.

import { createI18n } from 'slopkit/i18n';

export const dict = {
  'page.title': { en: 'The Last Harvest', pt: 'A Última Colheita' },

  // ------------------------------------------------------------- the seasons
  'season.spring': { en: 'Spring', pt: 'Primavera' },
  'season.summer': { en: 'Summer', pt: 'Verão' },
  'season.autumn': { en: 'Autumn', pt: 'Outono' },
  'season.winter': { en: 'Winter', pt: 'Inverno' },
  'hud.year': { en: 'Year {n}', pt: 'Ano {n}' },
  'hud.pop': { en: 'Villagers', pt: 'Aldeões' },
  'hud.army': { en: 'Army', pt: 'Exército' },
  'hud.horde': { en: 'THE DEAD ARE COMING', pt: 'OS MORTOS ESTÃO VINDO' },
  'hud.hordeIn': { en: 'The horde is inside the valley', pt: 'A horda está no vale' },
  'hud.cleared': { en: 'The winter is beaten — build.', pt: 'O inverno foi vencido — construa.' },

  // ------------------------------------------------------------- resources
  'res.food': { en: 'Food', pt: 'Comida' },
  'res.wood': { en: 'Wood', pt: 'Madeira' },
  'res.stone': { en: 'Stone', pt: 'Pedra' },
  'res.gold': { en: 'Gold', pt: 'Ouro' },

  // ------------------------------------------------------------- buildings
  'b.house': { en: 'House', pt: 'Casa' },
  'b.house.note': { en: 'Room for four more villagers.', pt: 'Teto para mais quatro aldeões.' },
  'b.farm': { en: 'Farm', pt: 'Fazenda' },
  'b.farm.note': {
    en: 'Grows food in every season but winter — autumn is the big harvest.',
    pt: 'Dá comida em toda estação menos no inverno — o outono é a colheita grande.',
  },
  'b.sawmill': { en: 'Sawmill', pt: 'Serraria' },
  'b.sawmill.note': { en: 'Cuts wood. Wants trees around it.', pt: 'Corta madeira. Quer árvores em volta.' },
  'b.quarry': { en: 'Quarry', pt: 'Pedreira' },
  'b.quarry.note': { en: 'Breaks stone. Wants rock beside it.', pt: 'Quebra pedra. Quer rocha do lado.' },
  'b.market': { en: 'Market', pt: 'Mercado' },
  'b.market.note': { en: 'Turns a busy town into gold.', pt: 'Transforma vila movimentada em ouro.' },
  'b.barracks': { en: 'Barracks', pt: 'Quartel' },
  'b.barracks.note': { en: 'Trains soldiers — sword and shield.', pt: 'Treina soldados — espada e escudo.' },
  'b.range': { en: 'Archery range', pt: 'Campo de arco' },
  'b.range.note': { en: 'Trains archers — arrows over the wall.', pt: 'Treina arqueiros — flechas por cima do muro.' },
  'b.wall': { en: 'Wall', pt: 'Muralha' },
  'b.wall.note': { en: 'Stands between the dead and dinner.', pt: 'Fica entre os mortos e o jantar.' },
  'b.tower': { en: 'Tower', pt: 'Torre' },
  'b.tower.note': { en: 'Shoots on its own, day and night.', pt: 'Atira sozinha, dia e noite.' },
  'b.hall': { en: 'Manor', pt: 'Casarão' },
  'b.hall.note': { en: 'The town itself. Lose it, lose the run.', pt: 'A própria vila. Perdeu, acabou.' },

  // ----------------------------------------------------------------- units
  'u.soldier': { en: 'Soldier', pt: 'Soldado' },
  'u.archer': { en: 'Archer', pt: 'Arqueiro' },

  // ------------------------------------------------------------------ tools
  'tool.demolish': { en: 'Demolish', pt: 'Demolir' },
  'tool.demolish.note': { en: 'Take it down, get half the cost back.', pt: 'Derruba e devolve metade do custo.' },
  'tool.rally': { en: 'Rally flag', pt: 'Bandeira' },
  'tool.rally.note': {
    en: 'Tap a guard to pick their squad, then the ground to post them.',
    pt: 'Toque num guarda para escolher o esquadrão, depois no chão para posicionar.',
  },

  // ------------------------------------------------------------ build & army
  'ui.confirm': { en: 'Build', pt: 'Construir' },
  'ui.cancel': { en: 'Cancel', pt: 'Cancelar' },
  'note.squad': { en: 'Squad {n} — tap the ground to post them', pt: 'Esquadrão {n} — toque no chão para posicionar' },
  'note.allSquads': { en: 'The whole army moves', pt: 'O exército inteiro se move' },
  'note.turned': { en: 'A guard has risen with the dead.', pt: 'Um guarda se ergueu com os mortos.' },

  // ---------------------------------------------------------------- refusals
  'why.edge': { en: 'Off the map.', pt: 'Fora do mapa.' },
  'why.ground': { en: 'The ground is not clear.', pt: 'O terreno não está livre.' },
  'why.taken': { en: 'Something already stands there.', pt: 'Já existe algo aí.' },
  'why.needsTrees': { en: 'A sawmill wants trees beside it.', pt: 'Serraria quer árvores do lado.' },
  'why.needsRock': { en: 'A quarry wants rock beside it.', pt: 'Pedreira quer rocha do lado.' },
  'why.poor': { en: 'Not enough resources.', pt: 'Recursos não bastam.' },
  'why.keep': { en: 'The manor stays.', pt: 'O casarão fica.' },
  'why.needsBarracks': { en: 'Build a barracks first.', pt: 'Construa um quartel antes.' },
  'why.needsRange': { en: 'Build an archery range first.', pt: 'Construa um campo de arco antes.' },
  'why.queueFull': { en: 'The training yard is full.', pt: 'O pátio de treino está cheio.' },
  'why.noHands': { en: 'No villager can be spared.', pt: 'Nenhum aldeão pode ser poupado.' },
  'why.unknown': { en: 'Nobody knows how to train that.', pt: 'Ninguém sabe treinar isso.' },

  // ---------------------------------------------------------------- notices
  'note.starve': { en: 'Someone starved. Plant more.', pt: 'Alguém passou fome. Plante mais.' },
  'note.born': { en: 'A villager arrived.', pt: 'Chegou um aldeão.' },
  'note.trained': { en: '{name} ready.', pt: '{name} a postos.' },
  'note.newyear': { en: 'Year {n}. The town held.', pt: 'Ano {n}. A vila aguentou.' },
  'note.horde': { en: 'The horde: {n} of them.', pt: 'A horda: {n} deles.' },

  // ----------------------------------------------------------------- quests
  'q.title': { en: 'Current quest', pt: 'Missão atual' },
  'q.done': { en: 'Quest complete!', pt: 'Missão cumprida!' },
  'q.sawmill': {
    en: 'Build a sawmill next to trees — that is where wood comes from',
    pt: 'Construa uma serraria junto às árvores — é dali que vem a madeira',
  },
  'q.farm': { en: 'Build a farm — winter eats what autumn banked', pt: 'Construa uma fazenda — o inverno come o que o outono guardou' },
  'q.house': { en: 'Raise {target} houses — more roofs, more villagers', pt: 'Erga {target} casas — mais tetos, mais aldeões' },
  'q.quarry': { en: 'Build a quarry beside rock — walls are made of stone', pt: 'Construa uma pedreira junto à rocha — muralha se faz de pedra' },
  'q.barracks': { en: 'Build a barracks', pt: 'Construa um quartel' },
  'q.soldiers': { en: 'Field an army of {target}', pt: 'Forme um exército de {target}' },
  'q.walls': { en: 'Raise {target} stretches of wall', pt: 'Erga {target} trechos de muralha' },
  'q.tower': { en: 'Build a tower — it shoots while you sleep', pt: 'Construa uma torre — ela atira enquanto você dorme' },
  'q.survive': { en: 'Survive the winter of year {year}', pt: 'Sobreviva ao inverno do ano {year}' },

  // ------------------------------------------------------------------- menu
  'menu.start': { en: 'Found the village', pt: 'Fundar a vila' },
  'menu.resume': { en: 'Back to the village', pt: 'Voltar para a vila' },
  'menu.newRun': { en: 'Start over', pt: 'Recomeçar' },
  'menu.wiped': { en: 'Town razed — starting from nothing.', pt: 'Vila arrasada — começando do zero.' },
  'menu.best': { en: 'Best: {years} years · {kills} dead put down', pt: 'Recorde: {years} anos · {kills} mortos abatidos' },
  'menu.now': { en: 'Year {year} · {pop} villagers', pt: 'Ano {year} · {pop} aldeões' },

  // ------------------------------------------------------------------- over
  'over.title': { en: 'The manor fell', pt: 'O casarão caiu' },
  'over.years': { en: ['It stood one year.', 'It stood {n} years.'], pt: ['Aguentou um ano.', 'Aguentou {n} anos.'] },
  'over.kills': { en: '{n} of the dead put down for good.', pt: '{n} mortos abatidos de vez.' },
  'over.record': { en: 'A new record.', pt: 'Novo recorde.' },
  'over.again': { en: 'Found it again', pt: 'Fundar de novo' },
};

export const i18n = createI18n({ dict });
export const t = (id, values) => i18n.t(id, values);
