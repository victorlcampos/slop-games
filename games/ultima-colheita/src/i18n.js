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
  'tool.rally.note': { en: 'Where the army stands guard.', pt: 'Onde o exército monta guarda.' },

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
