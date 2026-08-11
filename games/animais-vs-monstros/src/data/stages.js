// The 10 stages of the Brazil campaign.
//
// Each one changes three things at once: the scenery (palette and props), a
// board rule (water, fog, night, drought) and the monster cast. Difficulty
// climbs through all three, not just through enemy count.
//
// wave: { wait: seconds after the previous wave, monsters: [[id, howMany]] }

export const CAMPAIGN = {
  country: { pt: 'Brasil', en: 'Brazil' },
  flag: '🇧🇷',
  population: 215,
  tagline: { pt: 'A resistência começa aqui.', en: 'The resistance starts here.' },
};

export const STAGES = [
  {
    n: 1,
    name: { pt: 'Sítio do Interior', en: 'Backcountry Farm' },
    place: { pt: 'Minas Gerais', en: 'Minas Gerais' },
    intro: {
      pt: 'Um sítio de porteira aberta e ninguém para fechar. O primeiro lugar que os bichos escolheram retomar.',
      en: 'A farm with the gate wide open and nobody left to close it. The first place the animals chose to take back.',
    },
    scenery: 'forest',
    humans: 2,
    coins: 150,
    startingSeeds: 100,
    whatsNew: {
      note: {
        pt: 'Semente vem de dois lugares: o Esquilo produz e deixa cair no chão — você clica para pegar — e todo monstro derrubado devolve semente sozinho. Quanto mais rápido você mata, mais rico fica.',
        en: 'Seeds come from two places: the Squirrel produces them and drops them on the ground — you click to collect — and every monster you drop returns seeds on its own. The faster you kill, the richer you get.',
      },
    },
    waves: [
      { wait: 12, monsters: [['corposeco', 1]] },
      { wait: 22, monsters: [['corposeco', 2]] },
      { wait: 24, monsters: [['corposeco', 3]] },
      { wait: 26, monsters: [['corposeco', 4]] },
    ],
  },
  {
    n: 2,
    name: { pt: 'Mata Atlântica', en: 'Atlantic Forest' },
    place: { pt: 'Serra do Mar', en: 'Serra do Mar' },
    intro: {
      pt: 'Mata fechada, cipó no pé e um assobio que vem sempre da direção errada.',
      en: 'Thick forest, vines round your ankles and a whistle that always comes from the wrong direction.',
    },
    scenery: 'forest',
    humans: 5,
    coins: 170,
    startingSeeds: 100,
    whatsNew: {
      monster: 'saci',
      note: {
        pt: 'O Saci pula por cima da primeira defesa. Não adianta uma parede só.',
        en: 'The Saci jumps over the first defence. One wall is not enough.',
      },
    },
    waves: [
      { wait: 10, monsters: [['corposeco', 2]] },
      { wait: 20, monsters: [['saci', 1], ['corposeco', 2]] },
      { wait: 22, monsters: [['saci', 2], ['corposeco', 3]] },
      { wait: 24, monsters: [['saci', 3], ['corposeco', 4]] },
      { wait: 26, monsters: [['saci', 4], ['corposeco', 5]] },
    ],
  },
  {
    n: 3,
    name: { pt: 'Cerrado', en: 'Cerrado' },
    place: { pt: 'Chapada dos Veadeiros', en: 'Chapada dos Veadeiros' },
    intro: {
      pt: 'Capim alto até a cintura e árvore torta que não faz sombra para ninguém.',
      en: 'Waist-high grass and crooked trees that give nobody any shade.',
    },
    scenery: 'cerrado',
    humans: 8,
    coins: 200,
    startingSeeds: 100,
    whatsNew: {
      monster: 'curupira',
      note: {
        pt: 'O Curupira corre com os pés virados. Chega antes do que você calculou.',
        en: 'The Curupira runs on backwards feet. He arrives sooner than you worked out.',
      },
    },
    waves: [
      { wait: 10, monsters: [['corposeco', 3]] },
      { wait: 18, monsters: [['curupira', 2], ['saci', 1]] },
      { wait: 20, monsters: [['cabecadecuia', 1], ['corposeco', 3]] },
      { wait: 22, monsters: [['curupira', 3], ['cabecadecuia', 2]] },
      { wait: 24, monsters: [['curupira', 4], ['saci', 3], ['corposeco', 4]] },
    ],
  },
  {
    n: 4,
    name: { pt: 'Pantanal', en: 'Pantanal' },
    place: { pt: 'Mato Grosso do Sul', en: 'Mato Grosso do Sul' },
    intro: {
      pt: 'Metade chão, metade água, e nunca a metade que você queria.',
      en: 'Half ground, half water, and never the half you wanted.',
    },
    scenery: 'pantanal',
    water: [1, 3],
    humans: 12,
    coins: 230,
    startingSeeds: 125,
    whatsNew: {
      monster: 'iara',
      note: {
        pt: 'Fileira alagada só aceita bicho aquático — e é por ela que a Iara desce. Rio sem Jacaré nem Hipopótamo é estrada aberta até a cerca.',
        en: 'A flooded lane only accepts aquatic animals — and that is the lane the Iara comes down. A river with no Alligator and no Hippo is an open road to the fence.',
      },
    },
    waves: [
      { wait: 12, monsters: [['corposeco', 3]] },
      { wait: 18, monsters: [['iara', 1], ['curupira', 2]] },
      { wait: 20, monsters: [['cabecadecuia', 2], ['saci', 2]] },
      { wait: 22, monsters: [['iara', 3], ['corposeco', 4]] },
      { wait: 24, monsters: [['iara', 3], ['curupira', 3], ['cabecadecuia', 2]] },
    ],
  },
  {
    n: 5,
    name: { pt: 'Caatinga', en: 'Caatinga' },
    place: { pt: 'Sertão da Bahia', en: 'Bahia Backlands' },
    intro: {
      pt: 'Terra rachada, sol de meio-dia o dia todo. Aqui até semente pensa duas vezes antes de brotar.',
      en: 'Cracked earth, noon sun all day long. Here even a seed thinks twice before sprouting.',
    },
    scenery: 'caatinga',
    // the drought cuts passive income, not combat income: here the game pushes
    // you to kill fast instead of just planting generators and waiting
    seedFactor: 0.72,
    humans: 18,
    coins: 270,
    startingSeeds: 175,
    miniboss: 'mapinguari',
    whatsNew: {
      monster: 'mula',
      note: {
        pt: 'A seca corta sua produção de sementes. E a Mula sem Cabeça usa armadura — tiro fraco quica nela.',
        en: 'The drought cuts your seed production. And the Headless Mule wears armour — weak shots bounce off it.',
      },
    },
    waves: [
      { wait: 12, monsters: [['corposeco', 4]] },
      { wait: 18, monsters: [['mula', 1], ['curupira', 2]] },
      { wait: 20, monsters: [['mula', 2], ['cabecadecuia', 2]] },
      { wait: 22, monsters: [['mula', 2], ['saci', 3], ['curupira', 3]] },
      { wait: 26, monsters: [['mapinguari', 1], ['mula', 2], ['corposeco', 5]] },
    ],
  },
  {
    n: 6,
    name: { pt: 'Amazônia', en: 'Amazon' },
    place: { pt: 'Rio Negro', en: 'Rio Negro' },
    intro: {
      pt: 'A névoa entra pela mata e engole o caminho. Some tudo: a trilha, o rio e o que vem vindo.',
      en: 'Fog rolls into the forest and swallows the path. Everything goes: the trail, the river, and whatever is coming.',
    },
    scenery: 'amazon',
    fog: true,
    water: [4],
    humans: 25,
    coins: 310,
    startingSeeds: 150,
    whatsNew: {
      monster: 'boto',
      note: {
        pt: "A névoa esconde o meio do campo — uma Coruja na fileira levanta o véu. O Boitatá queima de longe. E o Boto troca de fileira: entra n'água virado bicho e sai na margem virado moço.",
        en: 'The fog hides the middle of the field — an Owl in the lane lifts the veil. The Boitatá burns from a distance. And the Boto switches lanes: he enters the water as a dolphin and steps out on the bank as a man.',
      },
    },
    waves: [
      { wait: 12, monsters: [['corposeco', 4]] },
      { wait: 18, monsters: [['boitata', 1], ['boto', 1], ['curupira', 3]] },
      { wait: 20, monsters: [['boitata', 2], ['iara', 2]] },
      { wait: 22, monsters: [['mula', 2], ['boto', 2], ['boitata', 2], ['saci', 3]] },
      { wait: 26, monsters: [['boitata', 3], ['mapinguari', 1], ['curupira', 4]] },
    ],
  },
  {
    n: 7,
    name: { pt: 'Litoral do Nordeste', en: 'Northeast Coast' },
    place: { pt: 'Praia de Pernambuco', en: 'Pernambuco Beach' },
    intro: {
      pt: 'Maré cheia e lua nova. No escuro, uma coisa velha lembra que era medo de criança.',
      en: "High tide and a new moon. In the dark, an old thing remembers it used to be a child's fear.",
    },
    scenery: 'beach',
    night: true,
    water: [0, 4],
    humans: 30,
    coins: 360,
    startingSeeds: 175,
    miniboss: 'bichopapao',
    whatsNew: {
      monster: 'bichopapao',
      note: {
        pt: 'No escuro o Bicho-papão anda invisível. Sem alguém que enxergue à noite, você só percebe quando ele morde.',
        en: 'In the dark the Bogeyman walks invisible. Without someone who sees at night, you only notice when it bites.',
      },
    },
    waves: [
      { wait: 12, monsters: [['corposeco', 4], ['iara', 2]] },
      // two water lanes, one at each edge: this is the board where the Boto is
      // most annoying, because he has a bank on both sides to jump to
      { wait: 18, monsters: [['boitata', 2], ['boto', 3], ['mula', 2]] },
      { wait: 20, monsters: [['iara', 4], ['cabecadecuia', 3]] },
      { wait: 22, monsters: [['curupira', 5], ['saci', 4]] },
      { wait: 28, monsters: [['bichopapao', 1], ['mula', 3], ['boitata', 2]] },
    ],
  },
  {
    n: 8,
    name: { pt: 'Centro de São Paulo', en: 'Downtown São Paulo' },
    place: { pt: 'Vale do Anhangabaú', en: 'Anhangabaú Valley' },
    intro: {
      pt: 'Vinte milhões de pessoas paradas onde estavam. O silêncio aqui é mais alto que em qualquer mata.',
      en: 'Twenty million people frozen where they stood. The silence here is louder than in any forest.',
    },
    scenery: 'city',
    humans: 40,
    coins: 410,
    startingSeeds: 200,
    whatsNew: {
      monster: 'lobisomem',
      note: {
        pt: 'Cidade grande, horda grande. E o Lobisomem fica mais rápido quanto mais apanha.',
        en: 'Big city, big horde. And the Werewolf gets faster the more it is hit.',
      },
    },
    waves: [
      { wait: 10, monsters: [['corposeco', 6]] },
      { wait: 16, monsters: [['lobisomem', 2], ['curupira', 4]] },
      { wait: 18, monsters: [['lobisomem', 3], ['mula', 3]] },
      { wait: 20, monsters: [['boitata', 3], ['saci', 5], ['cabecadecuia', 3]] },
      { wait: 22, monsters: [['lobisomem', 4], ['mapinguari', 2], ['corposeco', 8]] },
    ],
  },
  {
    n: 9,
    name: { pt: 'Serra da Mantiqueira', en: 'Mantiqueira Range' },
    place: { pt: 'Divisa de Minas', en: 'Minas Border' },
    intro: {
      pt: 'A última subida antes do mar. Se eles descerem daqui, chegam ao Rio antes de você.',
      en: 'The last climb before the sea. If they come down from here, they reach Rio before you do.',
    },
    scenery: 'highlands',
    fog: true,
    humans: 45,
    coins: 470,
    startingSeeds: 200,
    whatsNew: {
      monster: 'maedeouro',
      note: {
        pt: 'A Mãe-de-Ouro cruza o céu da serra e não olha para o chão: parede nenhuma segura ela. Só quem alcança o alto — Abelha, Morcego, Coruja, Águia — tira ela do ar. E o Mapinguari agora vem em bando.',
        en: 'The Mother of Gold crosses the mountain sky and never looks down: no wall holds her. Only those who reach high — Bee, Bat, Owl, Eagle — take her out of the air. And the Mapinguari now comes in packs.',
      },
    },
    waves: [
      { wait: 10, monsters: [['mula', 3], ['curupira', 4]] },
      { wait: 16, monsters: [['mapinguari', 2], ['boitata', 3]] },
      // the range has no river, so the Iara doesn't show up here: the pressure
      // in this wave comes from the Mother of Gold, who flies over the whole
      // defence
      { wait: 18, monsters: [['lobisomem', 4], ['maedeouro', 3]] },
      { wait: 20, monsters: [['mapinguari', 3], ['saci', 5], ['cabecadecuia', 4]] },
      { wait: 24, monsters: [['mapinguari', 4], ['lobisomem', 5], ['mula', 4]] },
    ],
  },
  {
    n: 10,
    name: { pt: 'Cristo Redentor', en: 'Christ the Redeemer' },
    place: { pt: 'Rio de Janeiro', en: 'Rio de Janeiro' },
    intro: {
      pt: 'Do alto do Corcovado dá para ver o país inteiro esperando. Ela está sentada lá em cima, e faz sete anos que espera por isto.',
      en: 'From the top of Corcovado you can see the whole country waiting. She is sitting up there, and she has waited seven years for this.',
    },
    scenery: 'christ',
    night: true,
    humans: 30,
    coins: 600,
    startingSeeds: 250,
    boss: 'cuca',
    whatsNew: {
      monster: 'cuca',
      note: {
        pt: 'A Cuca não vem sozinha e não vem depressa. Ela chama reforço enquanto anda — e quanto mais apanha, mais brava fica.',
        en: 'The Cuca comes neither alone nor fast. She calls reinforcements as she walks — and the more she is hit, the angrier she gets.',
      },
    },
    waves: [
      { wait: 10, monsters: [['corposeco', 6], ['curupira', 4]] },
      { wait: 16, monsters: [['mula', 4], ['boitata', 3], ['maedeouro', 2]] },
      { wait: 18, monsters: [['lobisomem', 4], ['mapinguari', 2]] },
      { wait: 22, monsters: [['cuca', 1]] },
      { wait: 30, monsters: [['mapinguari', 3], ['lobisomem', 4], ['mula', 4]] },
    ],
  },
];

/** Total humans the Brazil campaign gives back (in millions). */
export const HUMANS_BRAZIL = STAGES.reduce((s, st) => s + st.humans, 0);
