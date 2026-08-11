// The monsters are each people's legends made flesh. Since Brazil is the first
// campaign, the enemy here is folklore — and that is exactly why the humans
// can't face them: they grew up hearing these stories.
//
// speed in pixels per second (one board column is ~112px)
// armor    absorbs flat damage per hit, until it is broken
// flies    only takes damage from animals with `air`
// aquatic  only comes down flooded lanes — and fights there like everyone else
// swap     amphibian: changes lane and takes the shape of the new terrain
// hidden   invisible until an Owl reveals it (or until it bites someone)
//
// `flies` and `aquatic` don't mix: whoever flies over water sits outside
// everybody's reach, because a flooded lane only accepts aquatic animals and no
// aquatic animal has `air`. That is what used to happen with the Iara.
//
// Today no monster flies over water — the rule stays implemented and applies
// when a dry-land flier shows up, which is where the `air` animals in the deck
// (Bee, Bat, Owl, Eagle) get an exclusive target again.
//
// Names: the ones with a real English equivalent are translated (Headless Mule,
// Bogeyman, Werewolf); the rest are proper nouns and stay as they are in both
// languages. Translating "Saci" would be inventing a creature that doesn't exist.

export const MONSTERS = [
  {
    id: 'corposeco',
    name: { pt: 'Corpo-seco', en: 'Corpo-seco' },
    lore: {
      pt: 'Foi tão ruim em vida que nem a terra quis receber. Voltou andando.',
      en: 'So rotten in life that even the earth refused him. He came back walking.',
    },
    hp: 220,
    speed: 21,
    damage: 18,
    interval: 1,
    worth: 12,
  },
  {
    id: 'saci',
    name: { pt: 'Saci', en: 'Saci' },
    lore: {
      pt: 'Uma perna, um gorro e a paciência de ninguém. Some no redemoinho e aparece atrás.',
      en: "One leg, one red cap and nobody's patience. Vanishes into a whirlwind and pops up behind you.",
    },
    hp: 150,
    speed: 46,
    damage: 14,
    interval: 0.9,
    jumps: true,
    worth: 16,
  },
  {
    id: 'curupira',
    name: { pt: 'Curupira', en: 'Curupira' },
    lore: {
      pt: 'Pés virados para trás: quem segue o rastro dele anda no sentido errado a vida toda.',
      en: 'Feet turned backwards: whoever follows his tracks walks the wrong way for life.',
    },
    hp: 190,
    speed: 62,
    damage: 16,
    interval: 0.8,
    worth: 18,
  },
  {
    id: 'cabecadecuia',
    name: { pt: 'Cabeça de Cuia', en: 'Cabeça de Cuia' },
    lore: {
      pt: 'Cabeçorra de cuia, faminto no rio. Cospe de longe para não precisar chegar perto.',
      en: 'A huge gourd of a head, starving in the river. Spits from afar so he never has to come close.',
    },
    hp: 230,
    speed: 17,
    damage: 22,
    interval: 2,
    range: 2.6,
    worth: 20,
  },
  {
    id: 'mula',
    name: { pt: 'Mula sem Cabeça', en: 'Headless Mule' },
    lore: {
      pt: 'Ferradura em brasa e nenhuma cabeça para ouvir razão. Vem em disparada.',
      en: 'Horseshoes of hot coal and no head to hear reason with. It comes at a gallop.',
    },
    hp: 420,
    speed: 30,
    damage: 30,
    interval: 1.2,
    armor: 12,
    charge: { trigger: 0.5, factor: 2.4 },
    worth: 30,
  },
  {
    id: 'iara',
    name: { pt: 'Iara', en: 'Iara' },
    lore: {
      pt: 'Canta na beira do rio. Quem escuta, entra na água e não volta.',
      en: 'She sings by the riverbank. Whoever listens walks into the water and never comes back.',
    },
    hp: 260,
    speed: 27,
    damage: 20,
    interval: 1.3,
    aquatic: true,
    worth: 28,
  },
  {
    id: 'boto',
    name: { pt: 'Boto', en: 'Boto' },
    lore: {
      pt: 'No rio é bicho. Na festa é moço de terno branco que não tira o chapéu por nada — e ninguém desconfia do porquê.',
      en: "In the river he's a dolphin. At the party he's a young man in a white suit who won't take his hat off for anything — and nobody wonders why.",
    },
    hp: 300,
    speed: 24,
    damage: 22,
    interval: 1.2,
    // The only one who crosses the waterline: every so often he moves to the
    // next lane and takes the shape of the terrain — dolphin in the river, man
    // on land. A wall in a single lane won't hold him, and that is what he asks
    // of the player: defend the water **and** the bank.
    swap: { interval: 5 },
    worth: 30,
  },
  {
    id: 'maedeouro',
    name: { pt: 'Mãe-de-Ouro', en: 'Mother of Gold' },
    lore: {
      pt: 'Bola de fogo que risca o céu de Minas mostrando onde tem ouro. Passa por cima de tudo e de todos.',
      en: 'A fireball scoring the sky of Minas, showing where the gold is. It passes over everything and everyone.',
    },
    // A flier bites no defence at all: `stepMonsters` makes anything with
    // `flies` ignore whoever is on the ground and keep walking. Her threat is
    // not damage, it's the fence — hence low hp and high speed. Whoever has the
    // answer drops her fast; whoever doesn't watches her cross the whole field.
    hp: 300,
    speed: 40,
    flies: true,
    worth: 32,
  },
  {
    id: 'boitata',
    name: { pt: 'Boitatá', en: 'Boitatá' },
    lore: {
      pt: 'Cobra de fogo que guarda a mata. Não distingue mais quem queima.',
      en: 'A serpent of fire that guards the forest. It no longer tells apart who it burns.',
    },
    hp: 380,
    speed: 19,
    damage: 26,
    interval: 1.6,
    range: 1.8,
    burn: { damage: 9, duration: 4 },
    worth: 34,
  },
  {
    id: 'lobisomem',
    name: { pt: 'Lobisomem', en: 'Werewolf' },
    lore: {
      pt: 'Sétimo filho homem. Na lua cheia, esquece que um dia foi gente.',
      en: 'The seventh son. Under a full moon, he forgets he was ever a person.',
    },
    hp: 520,
    speed: 26,
    damage: 34,
    interval: 1,
    enrage: { trigger: 0.4, factor: 2.2 },
    worth: 38,
  },
  {
    id: 'mapinguari',
    name: { pt: 'Mapinguari', en: 'Mapinguari' },
    lore: {
      pt: 'Um olho só, boca na barriga e um fedor que chega antes dele.',
      en: 'One eye, a mouth on its belly, and a stench that arrives before it does.',
    },
    hp: 900,
    speed: 14,
    damage: 45,
    interval: 1.5,
    armor: 18,
    worth: 55,
  },
  {
    id: 'bichopapao',
    name: { pt: 'Bicho-papão', en: 'Bogeyman' },
    lore: {
      pt: 'Mora no escuro embaixo da cama e só existe enquanto ninguém acende a luz.',
      en: 'Lives in the dark under the bed and only exists while nobody turns the light on.',
    },
    hp: 1400,
    speed: 16,
    damage: 50,
    interval: 1.4,
    hidden: true,
    scale: 1.5,
    miniboss: true,
    worth: 90,
  },
  {
    id: 'cuca',
    name: { pt: 'Cuca', en: 'Cuca' },
    lore: {
      pt: 'A bruxa-jacaré que nunca dorme. Faz sete anos que ela espera este dia.',
      en: 'The alligator witch who never sleeps. She has been waiting seven years for this day.',
    },
    hp: 5200,
    speed: 11,
    damage: 70,
    interval: 1.6,
    armor: 22,
    scale: 2.1,
    boss: true,
    summons: { types: ['corposeco', 'saci', 'curupira'], interval: 9, count: 2 },
    phases: [
      { hp: 0.66, line: { pt: 'Durma, bichinho… durma…', en: 'Sleep, little one… sleep…' } },
      { hp: 0.33, line: { pt: 'SETE ANOS! SETE ANOS EU ESPEREI!', en: 'SEVEN YEARS! SEVEN YEARS I WAITED!' } },
    ],
    worth: 400,
  },
];

export const MONSTER_BY_ID = Object.fromEntries(MONSTERS.map((m) => [m.id, m]));
