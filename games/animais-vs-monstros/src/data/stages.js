// The campaigns, country by country. Brazil first, Japan next — each one is 10
// stages, and finishing a campaign is what unlocks the following country.
//
// Each stage changes three things at once: the scenery (palette and props), a
// board rule (water, fog, night, drought) and the monster cast. Difficulty
// climbs through all three, not just through enemy count.
//
// Stage numbers (`n`) are global and never reused — they are what the save
// stores in `won` and `records`, so a Brazil save keeps meaning the same thing
// after Japan exists. `label` is the number the player sees, local to the
// campaign (Japan starts again at "stage 1").
//
// wave: { wait: seconds after the previous wave, monsters: [[id, howMany]] }

const BRAZIL_STAGES = [
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

// ------------------------------------------------------------------- Japan
//
// The player lands here with a trained deck, so stage 11 opens around the
// weight of Brazil's stage 6 and climbs past the Cuca. The economy is bigger
// too: the campaign has four local recruits to pay for.
//
// **A stage is weighed against the deck that arrives, never in raw HP.** The
// first cut of this campaign missed that and played far too easy: the yōkai
// were about 1.5x Brazil's folklore, but the player crosses the ocean with
// cards at level III (1.8x) and trains them to V (3x) on the way to the
// castle. The monsters were climbing slower than the deck was. So the cast got
// a lift of its own (see monsters.js) and the back half of the campaign
// thickens instead of sitting flat — stage 20 is the heaviest board in the
// game, which is the least a final boss can be.

const JAPAN_STAGES = [
  {
    n: 11,
    name: { pt: 'Vila das Cerejeiras', en: 'Cherry Blossom Village' },
    place: { pt: 'Quioto', en: 'Kyoto' },
    intro: {
      pt: 'O navio atracou debaixo das cerejeiras. A vila está em silêncio — e em cada beco, um guarda-chuva velho abre o olho.',
      en: 'The ship docked under the cherry trees. The village is silent — and in every alley, an old umbrella opens its eye.',
    },
    scenery: 'sakura',
    humans: 5,
    coins: 320,
    startingSeeds: 150,
    whatsNew: {
      monster: 'karakasa',
      note: {
        pt: 'Bem-vindo ao Japão. O Karakasa é um guarda-chuva de cem anos: vem aos pulos, numa perna só. Os yōkai daqui são mais duros que o folclore de casa — seu baralho treinado vai trabalhar.',
        en: 'Welcome to Japan. The Karakasa is a hundred-year-old umbrella: it comes hopping on its one leg. The yōkai here are tougher than the folklore back home — your trained deck has work to do.',
      },
    },
    waves: [
      { wait: 10, monsters: [['karakasa', 3]] },
      { wait: 18, monsters: [['karakasa', 5]] },
      { wait: 20, monsters: [['karakasa', 7]] },
      { wait: 24, monsters: [['karakasa', 9]] },
    ],
  },
  {
    n: 12,
    name: { pt: 'Arrozais', en: 'Rice Terraces' },
    place: { pt: 'Terraços de Nagano', en: 'Nagano Terraces' },
    intro: {
      pt: 'Degraus de água até o horizonte. Cada espelho d’água reflete o céu — e esconde uma tigela.',
      en: 'Steps of water all the way to the horizon. Every mirror of water reflects the sky — and hides a bowl.',
    },
    scenery: 'rice',
    water: [1, 3],
    humans: 8,
    coins: 360,
    startingSeeds: 150,
    whatsNew: {
      monster: 'kappa',
      note: {
        pt: 'O Kappa desce pelas fileiras alagadas com uma tigela d’água na cabeça: é ela que dá a força dele. Bata até derramar — na metade da vida a tigela vira, e ele fica lento e fraco. Foco de fogo resolve.',
        en: 'The Kappa comes down the flooded lanes with a bowl of water on his head: that bowl is where his strength lives. Hit him until it spills — at half health the bowl tips over and he turns slow and weak. Focused fire wins.',
      },
    },
    waves: [
      { wait: 12, monsters: [['karakasa', 4]] },
      { wait: 18, monsters: [['kappa', 2], ['karakasa', 3]] },
      { wait: 20, monsters: [['kappa', 3], ['karakasa', 4]] },
      // the flooded lanes cap how much defence can answer this one, so the
      // rice terraces climb in the dry lanes and hold the Kappa count down
      { wait: 22, monsters: [['kappa', 3], ['karakasa', 6]] },
      { wait: 24, monsters: [['kappa', 4], ['karakasa', 7]] },
    ],
  },
  {
    n: 13,
    name: { pt: 'Bosque de Bambu', en: 'Bamboo Grove' },
    place: { pt: 'Arashiyama', en: 'Arashiyama' },
    intro: {
      pt: 'Colmos verdes até o céu e nove caudas passando entre eles. Você contou uma raposa? Tem três.',
      en: 'Green stalks up to the sky and nine tails weaving between them. You counted one fox? There are three.',
    },
    scenery: 'bamboo',
    humans: 10,
    coins: 400,
    startingSeeds: 175,
    whatsNew: {
      monster: 'kitsune',
      note: {
        pt: 'A Kitsune entra em campo e se desdobra em ilusões: cópias que somem com um tiro e não pagam semente. Derrube a verdadeira e as cópias se desfazem — todo tiro na raposa errada é um tiro pago.',
        en: 'The Kitsune steps onto the field and splits into illusions: copies that vanish at one hit and pay no seed. Drop the real one and the copies come apart — every shot at the wrong fox is a shot you paid for.',
      },
    },
    waves: [
      { wait: 10, monsters: [['karakasa', 4]] },
      { wait: 18, monsters: [['kitsune', 2], ['karakasa', 4]] },
      { wait: 20, monsters: [['kitsune', 3], ['karakasa', 5]] },
      { wait: 22, monsters: [['kitsune', 5], ['karakasa', 7]] },
      { wait: 24, monsters: [['kitsune', 6], ['karakasa', 9]] },
    ],
  },
  {
    n: 14,
    name: { pt: 'Monte dos Tengu', en: 'Tengu Mountain' },
    place: { pt: 'Monte Kurama', en: 'Mount Kurama' },
    intro: {
      pt: 'Os monges fugiram da montanha há semanas. Lá do alto, asas negras medem o seu quintal.',
      en: 'The monks fled the mountain weeks ago. From up there, black wings are measuring your yard.',
    },
    scenery: 'mountainjp',
    humans: 12,
    coins: 450,
    startingSeeds: 175,
    whatsNew: {
      monster: 'tengu',
      note: {
        pt: 'O Tengu voa por cima da sua muralha — e pousa atrás dela, onde só os geradores moram. No ar, só quem alcança o alto acerta; no chão, ele briga como qualquer um. Derrube antes que ele cruze.',
        en: 'The Tengu flies over your wall — and lands behind it, where only your generators live. In the air, only those who reach high can touch him; on the ground he brawls like anyone. Bring him down before he crosses.',
      },
    },
    waves: [
      { wait: 10, monsters: [['karakasa', 5]] },
      { wait: 16, monsters: [['tengu', 2], ['kitsune', 2]] },
      { wait: 18, monsters: [['tengu', 3], ['karakasa', 6]] },
      { wait: 20, monsters: [['kitsune', 5], ['tengu', 3]] },
      { wait: 22, monsters: [['tengu', 5], ['kitsune', 4], ['karakasa', 7]] },
    ],
  },
  {
    n: 15,
    name: { pt: 'Estrada à Meia-noite', en: 'Midnight Road' },
    place: { pt: 'Estrada de Tōkaidō', en: 'Tōkaidō Road' },
    intro: {
      pt: 'A velha estrada corta o bambuzal no escuro. Uma moça de quimono sorri de longe. Longe demais para o pescoço dela.',
      en: 'The old road cuts through the bamboo in the dark. A woman in a kimono smiles from afar. Too far — for her neck.',
    },
    scenery: 'bamboo',
    night: true,
    humans: 14,
    coins: 500,
    startingSeeds: 200,
    whatsNew: {
      monster: 'rokurokubi',
      note: {
        pt: 'A Rokurokubi para na sua muralha como todo mundo — mas o pescoço estica por cima e morde quem está atrás: o atirador, o gerador. Muro na frente já não protege a fileira inteira.',
        en: 'The Rokurokubi stops at your wall like everyone else — but her neck stretches over it and bites whoever stands behind: the shooter, the generator. A wall up front no longer protects the whole lane.',
      },
    },
    waves: [
      { wait: 12, monsters: [['karakasa', 5], ['kitsune', 2]] },
      { wait: 18, monsters: [['rokurokubi', 2], ['karakasa', 5]] },
      { wait: 20, monsters: [['rokurokubi', 3], ['kitsune', 3]] },
      { wait: 22, monsters: [['rokurokubi', 4], ['tengu', 3]] },
      { wait: 24, monsters: [['rokurokubi', 6], ['kitsune', 5], ['karakasa', 8]] },
    ],
  },
  {
    n: 16,
    name: { pt: 'Nevasca', en: 'Blizzard' },
    place: { pt: 'Hokkaidō', en: 'Hokkaidō' },
    intro: {
      pt: 'A neve apaga a estrada, o telhado e a pegada. No meio do branco, um quimono mais branco ainda.',
      en: 'The snow erases the road, the roofs and every footprint. In all that white, a kimono whiter still.',
    },
    scenery: 'snow',
    // the cold slows the ground: seeds sprout a touch later, like the drought —
    // milder, because the Yuki-onna is already freezing the defenders themselves
    seedFactor: 0.85,
    humans: 15,
    coins: 560,
    startingSeeds: 225,
    whatsNew: {
      monster: 'yukionna',
      note: {
        pt: 'A Yuki-onna congela os seus bichos: um sopro e a fileira inteira para de atirar por um tempo. O Macaco-da-neve viveu a vida em água termal — é o único que o frio dela não morde.',
        en: 'The Yuki-onna freezes your animals: one breath and the whole lane stops shooting for a while. The Snow Monkey spent his life in hot springs — he is the only one her cold cannot bite.',
      },
    },
    waves: [
      { wait: 12, monsters: [['karakasa', 5]] },
      { wait: 18, monsters: [['yukionna', 2], ['karakasa', 5]] },
      { wait: 20, monsters: [['yukionna', 3], ['rokurokubi', 3]] },
      { wait: 22, monsters: [['yukionna', 3], ['kitsune', 4], ['karakasa', 6]] },
      { wait: 24, monsters: [['yukionna', 5], ['rokurokubi', 4], ['karakasa', 8]] },
    ],
  },
  {
    n: 17,
    name: { pt: 'Cruzamento em Neon', en: 'Neon Crossing' },
    place: { pt: 'Shibuya, Tóquio', en: 'Shibuya, Tokyo' },
    intro: {
      pt: 'Os letreiros ainda piscam para uma multidão parada. Entre as luzes, chifres — e uma clava do tamanho de um poste.',
      en: 'The signs still blink for a crowd that stands frozen. Between the lights, horns — and a club the size of a lamppost.',
    },
    scenery: 'neon',
    night: true,
    humans: 17,
    coins: 620,
    startingSeeds: 225,
    whatsNew: {
      monster: 'oni',
      note: {
        pt: 'Cidade grande, horda grande — e o Oni no meio dela. A clava dele acerta quem está na frente e ainda alcança a casa de trás: bicho colado em bicho é convite. Espalhe a defesa.',
        en: 'Big city, big horde — and the Oni in the middle of it. His club hits whoever is in front and reaches the cell behind them too: animals packed together are an invitation. Spread the defence out.',
      },
    },
    waves: [
      { wait: 10, monsters: [['karakasa', 8]] },
      { wait: 16, monsters: [['oni', 2], ['kitsune', 3]] },
      { wait: 18, monsters: [['oni', 2], ['rokurokubi', 3], ['karakasa', 6]] },
      { wait: 20, monsters: [['kitsune', 5], ['karakasa', 9]] },
      { wait: 24, monsters: [['oni', 3], ['yukionna', 3], ['karakasa', 8]] },
    ],
  },
  {
    n: 18,
    name: { pt: 'Templo na Névoa', en: 'Fog Temple' },
    place: { pt: 'Monte Kōya', en: 'Mount Kōya' },
    intro: {
      pt: 'O incenso apagou, a névoa ficou. Entre as lanternas de pedra, uma parede anda — e ela não veio consertar o muro.',
      en: 'The incense went out, the fog stayed. Between the stone lanterns a wall is walking — and it did not come to fix the fence.',
    },
    scenery: 'temple',
    fog: true,
    humans: 18,
    coins: 690,
    startingSeeds: 250,
    whatsNew: {
      monster: 'nurikabe',
      note: {
        pt: 'O Nurikabe é uma parede viva: engole os tiros da fileira — até os que atravessam tudo param nele — e coice nenhum o empurra. A névoa esconde o resto; uma Coruja levanta o véu.',
        en: 'The Nurikabe is a living wall: it swallows the lane’s shots — even the ones that pierce everything stop in it — and no kick pushes it back. The fog hides the rest; an Owl lifts the veil.',
      },
    },
    waves: [
      { wait: 12, monsters: [['karakasa', 6], ['kitsune', 3]] },
      { wait: 18, monsters: [['nurikabe', 1], ['kitsune', 4]] },
      { wait: 20, monsters: [['nurikabe', 2], ['rokurokubi', 3]] },
      { wait: 22, monsters: [['oni', 2], ['nurikabe', 2], ['karakasa', 7]] },
      { wait: 26, monsters: [['nurikabe', 3], ['yukionna', 3], ['kitsune', 4]] },
    ],
  },
  {
    n: 19,
    name: { pt: 'Encosta do Fuji', en: 'Fuji Slopes' },
    place: { pt: 'Monte Fuji', en: 'Mount Fuji' },
    intro: {
      pt: 'A última subida antes do castelo. Todo yōkai do país sabe que é aqui que a linha tem de quebrar.',
      en: 'The last climb before the castle. Every yōkai in the country knows this is where the line has to break.',
    },
    scenery: 'snow',
    humans: 16,
    coins: 760,
    startingSeeds: 250,
    whatsNew: {
      note: {
        pt: 'Todos de uma vez: Tengu por cima, Nurikabe na frente, Yuki-onna congelando e Oni quebrando. O que você aprendeu em oito fases, a montanha cobra numa só.',
        en: 'All of them at once: Tengu overhead, Nurikabe up front, Yuki-onna freezing and Oni smashing. What eight stages taught you, the mountain collects in one.',
      },
    },
    waves: [
      { wait: 10, monsters: [['tengu', 3], ['karakasa', 6]] },
      { wait: 16, monsters: [['oni', 3], ['yukionna', 3]] },
      { wait: 18, monsters: [['nurikabe', 2], ['rokurokubi', 4]] },
      { wait: 20, monsters: [['tengu', 4], ['kitsune', 5], ['yukionna', 3]] },
      { wait: 24, monsters: [['oni', 4], ['nurikabe', 3], ['karakasa', 9]] },
    ],
  },
  {
    n: 20,
    name: { pt: 'Castelo Assombrado', en: 'Haunted Castle' },
    place: { pt: 'Castelo de Himeji', en: 'Himeji Castle' },
    intro: {
      pt: 'No salão mais alto do castelo, um quimono branco espera de costas. Ela sabe o seu nome desde que o navio atracou.',
      en: 'In the castle’s highest hall, a white kimono waits with its back turned. She has known your name since the ship docked.',
    },
    scenery: 'castle',
    night: true,
    humans: 10,
    coins: 900,
    startingSeeds: 300,
    boss: 'onryo',
    whatsNew: {
      monster: 'onryo',
      note: {
        pt: 'O Onryō some e reaparece: enquanto está translúcido, tiro nenhum o toca — e ele volta em outra fileira, chamando yōkai pelo caminho. Defesa em uma fileira só é defesa nenhuma.',
        en: 'The Onryō fades and returns: while he is translucent no shot can touch him — and he comes back in another lane, calling yōkai as he goes. A defence in a single lane is no defence at all.',
      },
    },
    waves: [
      { wait: 10, monsters: [['karakasa', 7], ['kitsune', 4]] },
      { wait: 16, monsters: [['rokurokubi', 4], ['yukionna', 3], ['tengu', 3]] },
      { wait: 18, monsters: [['oni', 3], ['nurikabe', 3]] },
      { wait: 22, monsters: [['onryo', 1]] },
      // the castle's last wave lands on top of a boss who is still walking:
      // this is the hardest minute in the game, and it is meant to be
      { wait: 28, monsters: [['oni', 4], ['yukionna', 4], ['rokurokubi', 5], ['karakasa', 6]] },
    ],
  },
];

// -------------------------------------------------------------- the campaigns

export const CAMPAIGNS = [
  {
    id: 'brazil',
    country: { pt: 'Brasil', en: 'Brazil' },
    flag: '🇧🇷',
    population: 215,
    tagline: { pt: 'A resistência começa aqui.', en: 'The resistance starts here.' },
    sub: {
      pt: 'Dez fases até a Cuca. Cada uma devolve um pedaço do país.',
      en: 'Ten stages up to the Cuca. Each one gives back a piece of the country.',
    },
    finished: {
      pt: '🎉 Brasil libertado. O Japão chamou no rádio — a viagem continua.',
      en: '🎉 Brazil is free. Japan called on the radio — the journey goes on.',
    },
    // where the country outline sits behind the stage trail (the world map is
    // drawn at 1600x640 and shifted so this campaign's country lands in view)
    mapOffset: [-380, 60],
    stages: BRAZIL_STAGES,
  },
  {
    id: 'japan',
    country: { pt: 'Japão', en: 'Japan' },
    flag: '🇯🇵',
    population: 125,
    tagline: { pt: 'Nenhuma lenda assusta quem nunca a escutou.', en: 'No legend can scare someone who never heard it.' },
    sub: {
      pt: 'Dez fases até o Onryō. Cada uma devolve um pedaço do país.',
      en: 'Ten stages up to the Onryō. Each one gives back a piece of the country.',
    },
    finished: {
      pt: '🎉 Japão libertado. Os próximos países vêm aí.',
      en: '🎉 Japan is free. The next countries are coming.',
    },
    mapOffset: [-433, 138],
    unlockedBy: 'brazil',
    stages: JAPAN_STAGES,
  },
];

// the label the player reads is local to the campaign: Japan starts at "1"
for (const c of CAMPAIGNS) c.stages.forEach((s, i) => { s.label = i + 1; });

/** Every stage of every campaign, in order. `n` is unique across the lot. */
export const STAGES = CAMPAIGNS.flatMap((c) => c.stages);

export const TOTAL_STAGES = STAGES.length;

export const campaignById = (id) => CAMPAIGNS.find((c) => c.id === id) || null;

/** The campaign a stage number belongs to. */
export function campaignOf(n) {
  return CAMPAIGNS.find((c) => c.stages.some((s) => s.n === n)) || CAMPAIGNS[0];
}

/** A campaign opens when the one before it has been fully won. */
export function isCampaignOpen(campaign, won = []) {
  if (!campaign) return false;
  if (!campaign.unlockedBy) return true;
  const prev = campaignById(campaign.unlockedBy);
  return !!prev && prev.stages.every((s) => won.includes(s.n));
}

export function isCampaignDone(campaign, won = []) {
  return !!campaign && campaign.stages.every((s) => won.includes(s.n));
}

/** Total humans the whole atlas gives back (in millions) — the world scoreboard. */
export const HUMANS_TOTAL = STAGES.reduce((s, st) => s + st.humans, 0);
