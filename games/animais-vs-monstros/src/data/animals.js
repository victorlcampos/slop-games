// The cards. The cast is worldwide — the resistance is global, it is only the
// campaign that starts in Brazil.
//
// cost      = seeds spent in battle
// price     = coins in the shop between levels (0 = comes in the starter deck)
// cooldown  = seconds until the card can be played again
// role      = how the creature behaves on the field:
//   generator  produces seeds on its own
//   shooter    fires down the lane
//   wall       holds the lane with its body
//   bruiser    hits whatever comes close
//   area       effect all around (ice, stun)
//   bomb       single use, gone after it acts
//
// air     = hits monsters that float (those without it miss badly)
// aquatic = can be placed in a flooded lane
//
// Names and descriptions carry both languages side by side. That is the whole
// point of the shape: a card can't ship half-translated without it being
// visible on the line you are editing.

export const ANIMALS = [
  // --------------------------------------------------------- the starter deck
  {
    id: 'squirrel',
    name: { pt: 'Esquilo', en: 'Squirrel' },
    origin: { pt: 'Canadá', en: 'Canada' },
    role: 'generator',
    cost: 50,
    price: 0,
    cooldown: 5,
    hp: 70,
    interval: 7,
    yield: 25,
    desc: {
      pt: 'Enterra e desenterra castanha o dia todo. Sem ele, não sai nada do chão.',
      en: 'Buries and digs up nuts all day. Without him, nothing comes out of the ground.',
    },
  },
  {
    id: 'monkey',
    name: { pt: 'Macaco', en: 'Monkey' },
    origin: { pt: 'Congo', en: 'Congo' },
    role: 'shooter',
    cost: 100,
    price: 0,
    cooldown: 5,
    hp: 80,
    interval: 1.5,
    damage: 22,
    projectile: 'coconut',
    desc: {
      pt: 'Joga coco com pontaria de quem treinou a vida toda acertando primo.',
      en: 'Throws coconuts with the aim of someone who spent a lifetime hitting his cousin.',
    },
  },
  {
    id: 'turtle',
    name: { pt: 'Tartaruga', en: 'Turtle' },
    origin: { pt: 'Galápagos', en: 'Galápagos' },
    role: 'wall',
    cost: 50,
    price: 0,
    cooldown: 8,
    hp: 480,
    desc: {
      pt: 'Não ataca, não corre, não reclama. Só fica ali sendo casco.',
      en: "Doesn't attack, doesn't run, doesn't complain. Just sits there being shell.",
    },
  },

  // ------------------------------------------------------------- in the shop
  {
    id: 'bee',
    name: { pt: 'Abelha', en: 'Bee' },
    origin: { pt: 'Eslovênia', en: 'Slovenia' },
    role: 'shooter',
    cost: 150,
    price: 120,
    cooldown: 6,
    hp: 45,
    interval: 0.45,
    damage: 9,
    air: true,
    projectile: 'stinger',
    desc: {
      pt: 'Ferroada atrás de ferroada. Alcança o que voa, porque também voa.',
      en: 'Sting after sting after sting. Reaches what flies, because it flies too.',
    },
  },
  {
    id: 'hedgehog',
    name: { pt: 'Ouriço', en: 'Hedgehog' },
    origin: { pt: 'Alemanha', en: 'Germany' },
    role: 'wall',
    cost: 100,
    price: 140,
    cooldown: 8,
    hp: 320,
    spikes: 18,
    desc: {
      pt: 'Parede que dói. Quem morde, se arrepende no mesmo segundo.',
      en: 'A wall that hurts. Whoever bites regrets it the same second.',
    },
  },
  {
    id: 'beaver',
    name: { pt: 'Castor', en: 'Beaver' },
    origin: { pt: 'Canadá', en: 'Canada' },
    role: 'generator',
    cost: 150,
    price: 160,
    cooldown: 7,
    hp: 110,
    interval: 6,
    yield: 40,
    desc: {
      pt: 'Rói, empilha, represa e ainda sobra madeira para vender.',
      en: 'Gnaws, stacks, dams — and still has timber left to sell.',
    },
  },
  {
    id: 'bat',
    name: { pt: 'Morcego', en: 'Bat' },
    origin: { pt: 'México', en: 'Mexico' },
    role: 'shooter',
    cost: 125,
    price: 150,
    cooldown: 5,
    hp: 55,
    interval: 1.1,
    damage: 20,
    air: true,
    projectile: 'echo',
    desc: {
      pt: 'Enxerga no escuro e no nevoeiro. Grito que corta o ar e o monstro.',
      en: 'Sees in the dark and in the fog. A shriek that cuts the air and the monster.',
    },
  },
  {
    id: 'scorpion',
    name: { pt: 'Escorpião', en: 'Scorpion' },
    origin: { pt: 'Egito', en: 'Egypt' },
    role: 'shooter',
    cost: 150,
    price: 190,
    cooldown: 7,
    hp: 70,
    interval: 2.2,
    damage: 12,
    poison: { damage: 7, duration: 5 },
    desc: {
      pt: 'O ferrão mal arranha. O que vem depois é que resolve.',
      en: 'The sting barely scratches. What comes after is what settles it.',
    },
  },
  {
    id: 'kangaroo',
    name: { pt: 'Canguru', en: 'Kangaroo' },
    origin: { pt: 'Austrália', en: 'Australia' },
    role: 'bruiser',
    cost: 175,
    price: 200,
    cooldown: 8,
    hp: 260,
    interval: 1.6,
    damage: 40,
    knockback: 70,
    desc: {
      pt: 'Coice que devolve o monstro para onde ele veio.',
      en: 'A kick that sends the monster back where it came from.',
    },
  },
  {
    id: 'skunk',
    name: { pt: 'Gambá', en: 'Skunk' },
    origin: { pt: 'Estados Unidos', en: 'United States' },
    role: 'bomb',
    cost: 125,
    price: 170,
    cooldown: 12,
    hp: 60,
    radius: 1.4,
    damage: 320,
    desc: {
      pt: 'Solta o fedor e leva junto tudo que estiver por perto. Inclusive ele.',
      en: 'Lets the stink go and takes everything nearby with it. Himself included.',
    },
  },
  {
    id: 'owl',
    name: { pt: 'Coruja', en: 'Owl' },
    origin: { pt: 'Grécia', en: 'Greece' },
    role: 'shooter',
    cost: 175,
    price: 210,
    cooldown: 7,
    hp: 85,
    interval: 1.7,
    damage: 30,
    air: true,
    reveals: true,
    projectile: 'feather',
    desc: {
      pt: 'Enxerga o que a névoa esconde. O resto da fileira agradece.',
      en: 'Sees what the fog hides. The rest of the lane is grateful.',
    },
  },
  {
    id: 'snake',
    name: { pt: 'Cobra', en: 'Snake' },
    origin: { pt: 'Índia', en: 'India' },
    role: 'shooter',
    cost: 175,
    price: 230,
    cooldown: 8,
    hp: 75,
    interval: 2.4,
    damage: 34,
    pierces: true,
    projectile: 'spit',
    desc: {
      pt: 'Cospe reto e não pergunta quantos estão na frente. Pega todos.',
      en: "Spits straight and doesn't ask how many are in front. Hits them all.",
    },
  },
  {
    id: 'alligator',
    name: { pt: 'Jacaré', en: 'Alligator' },
    origin: { pt: 'Flórida', en: 'Florida' },
    role: 'bruiser',
    cost: 200,
    price: 240,
    cooldown: 9,
    hp: 340,
    interval: 1.4,
    damage: 55,
    aquatic: true,
    desc: {
      pt: 'Fica de tocaia fingindo tronco. Aí fecha a boca.',
      en: 'Lies in wait pretending to be a log. Then shuts its mouth.',
    },
  },
  {
    id: 'eagle',
    name: { pt: 'Águia', en: 'Eagle' },
    origin: { pt: 'Mongólia', en: 'Mongolia' },
    role: 'shooter',
    cost: 225,
    price: 260,
    cooldown: 8,
    hp: 95,
    interval: 1.9,
    damage: 55,
    air: true,
    airPriority: true,
    projectile: 'talon',
    desc: {
      pt: 'Mergulha do alto em quem acha que voar era vantagem.',
      en: 'Dives from above on whoever thought flying was an advantage.',
    },
  },
  {
    id: 'hippo',
    name: { pt: 'Hipopótamo', en: 'Hippo' },
    origin: { pt: 'Tanzânia', en: 'Tanzania' },
    role: 'wall',
    cost: 225,
    price: 280,
    cooldown: 10,
    hp: 620,
    aquatic: true,
    desc: {
      pt: 'Boia parado feito pedra. Uma pedra de duas toneladas e mau humor.',
      en: 'Floats still like a rock. A two-tonne rock in a bad mood.',
    },
  },
  {
    id: 'jaguar',
    name: { pt: 'Onça', en: 'Jaguar' },
    origin: { pt: 'Brasil', en: 'Brazil' },
    role: 'bruiser',
    cost: 275,
    price: 380,
    cooldown: 10,
    hp: 300,
    interval: 0.9,
    damage: 60,
    desc: {
      pt: 'Não espera o monstro chegar: dá dois passos à frente e resolve.',
      en: "Doesn't wait for the monster: takes two steps forward and settles it.",
    },
    advances: true,
  },
  {
    id: 'polarbear',
    name: { pt: 'Urso Polar', en: 'Polar Bear' },
    origin: { pt: 'Groenlândia', en: 'Greenland' },
    role: 'area',
    cost: 250,
    price: 340,
    cooldown: 12,
    hp: 400,
    interval: 4,
    radius: 1.8,
    slow: { factor: 0.45, duration: 4 },
    damage: 18,
    desc: {
      pt: 'O sopro dele congela o chão. Monstro apressado vira monstro devagar.',
      en: 'His breath freezes the ground. A monster in a hurry becomes a slow monster.',
    },
  },
  {
    id: 'lion',
    name: { pt: 'Leão', en: 'Lion' },
    origin: { pt: 'Quênia', en: 'Kenya' },
    role: 'area',
    cost: 300,
    price: 440,
    cooldown: 14,
    hp: 380,
    interval: 6,
    radius: 2.6,
    stun: 2.5,
    damage: 45,
    desc: {
      pt: 'Um rugido e a fileira inteira para para lembrar quem manda aqui.',
      en: 'One roar and the whole lane stops to remember who is in charge here.',
    },
  },
  {
    id: 'elephant',
    name: { pt: 'Elefante', en: 'Elephant' },
    origin: { pt: 'Índia', en: 'India' },
    role: 'wall',
    cost: 300,
    price: 520,
    cooldown: 14,
    hp: 900,
    interval: 3,
    damage: 30,
    knockback: 110,
    desc: {
      pt: 'A muralha que empurra de volta. Nada passa por cima de elefante.',
      en: 'The wall that pushes back. Nothing walks over an elephant.',
    },
  },

  // ------------------------------------------------- the Japan recruits
  // These four carry `unlock: 'japan'`: the shop only rolls them once the
  // Japan campaign is open. The Brazil deck is untouched — the newcomers are
  // what the second campaign pays for.
  //
  // trick      cheats death once: the shapeshifter puffs back at half health
  // lanes: 3   shoots its own lane and both neighbours
  // chillShot  the projectile slows what it hits
  // warm       the Yuki-onna's freezing breath cannot touch it

  {
    id: 'tanuki',
    name: { pt: 'Tanuki', en: 'Tanuki' },
    origin: { pt: 'Japão', en: 'Japan' },
    unlock: 'japan',
    role: 'wall',
    cost: 100,
    price: 260,
    cooldown: 8,
    hp: 300,
    trick: 0.5,
    desc: {
      pt: 'Mestre do disfarce com uma folha na testa. Na hora do golpe fatal — puf — era só uma estátua.',
      en: 'A master of disguise with a leaf on his brow. At the killing blow — poof — it was only a statue.',
    },
  },
  {
    id: 'crane',
    name: { pt: 'Grou-de-coroa', en: 'Red-crowned Crane' },
    origin: { pt: 'Japão', en: 'Japan' },
    unlock: 'japan',
    role: 'shooter',
    cost: 200,
    price: 300,
    cooldown: 8,
    hp: 90,
    interval: 1.8,
    damage: 18,
    lanes: 3,
    air: true,
    projectile: 'crest',
    desc: {
      pt: 'Dança de asas abertas e bica três fileiras de uma vez. Elegância também é alcance.',
      en: 'Dances with open wings and pecks three lanes at once. Elegance is also reach.',
    },
  },
  {
    id: 'snowmonkey',
    name: { pt: 'Macaco-da-neve', en: 'Snow Monkey' },
    origin: { pt: 'Japão', en: 'Japan' },
    unlock: 'japan',
    role: 'shooter',
    cost: 175,
    price: 280,
    cooldown: 6,
    hp: 80,
    interval: 1.4,
    damage: 14,
    chillShot: { duration: 2.5 },
    warm: true,
    projectile: 'snowball',
    desc: {
      pt: 'Passa o inverno de banho quente, fazendo bola de neve. Quem leva uma, anda no passo dele: devagar.',
      en: 'Spends the winter in a hot bath, packing snowballs. Whoever takes one walks at his pace: slowly.',
    },
  },
  {
    id: 'koi',
    name: { pt: 'Carpa Koi', en: 'Koi Carp' },
    origin: { pt: 'Japão', en: 'Japan' },
    unlock: 'japan',
    role: 'shooter',
    cost: 150,
    price: 240,
    cooldown: 6,
    hp: 85,
    interval: 1.2,
    damage: 20,
    aquatic: true,
    projectile: 'waterjet',
    desc: {
      pt: 'Subiu tanta cachoeira que aprendeu a cuspir uma. O primeiro atirador que briga de dentro do rio.',
      en: 'Climbed so many waterfalls she learned to spit one. The first shooter who fights from inside the river.',
    },
  },
];

export const BY_ID = Object.fromEntries(ANIMALS.map((a) => [a.id, a]));

/** The three cards everybody starts with. */
export const STARTER_DECK = ANIMALS.filter((a) => a.price === 0).map((a) => a.id);

/**
 * The cards the shop is allowed to sell, given which campaigns are open.
 *
 * A card with `unlock` belongs to a country: it only exists for a player who
 * has reached that campaign. With no argument this is exactly the Brazil-era
 * catalogue, which is what every old call site (and old test) expects.
 */
export function shopPool(unlocked = []) {
  return ANIMALS.filter((a) => !a.unlock || unlocked.includes(a.unlock));
}

/**
 * The cards the shop **must** offer before a level.
 *
 * Today only water forces anything here, and it forces it for a hard reason:
 * from level 4 on, the Iara comes down the flooded lane, and only aquatic
 * animals go there. Arriving without one leaves nothing to plant in that lane —
 * the shop window is rolled at random and may simply never have shown a gator.
 *
 * Returns empty when the deck already covers the requirement.
 */
export function requiredCards(level, deck = [], pool = shopPool()) {
  if (!level || !level.water || !level.water.length) return [];
  const aquatics = pool.filter((a) => a.aquatic);
  if (aquatics.some((a) => deck.includes(a.id))) return [];
  return aquatics.map((a) => a.id);
}

/**
 * Rolls up to 3 cards the player doesn't have yet.
 *
 * The roll checks the wallet: if they can afford anything, at least one of the
 * offers is buyable right now. Rolling three expensive recruits on the first
 * level turns the reward into a shop window — the player wins and takes nothing.
 *
 * `required` jumps the queue: those are the cards without which the next level
 * has no possible defence (today, an aquatic animal before the water level).
 * Luck can't be what decides whether the next level is playable.
 */
export function rollCards(deck, count = 3, coins = 0, required = [], pool = shopPool()) {
  const missing = pool.filter((a) => a.price > 0 && !deck.includes(a.id));
  if (!missing.length) return [];

  const rolled = [];
  const mandatory = missing.filter((a) => required.includes(a.id));
  if (mandatory.length) {
    rolled.push(mandatory[Math.floor(Math.random() * mandatory.length)].id);
  }

  const affordable = missing.filter((a) => a.price <= coins && !rolled.includes(a.id));
  if (affordable.length && rolled.length < count) {
    rolled.push(affordable[Math.floor(Math.random() * affordable.length)].id);
  }

  // the rest comes from the cheaper half of what's left, so the window stays
  // ambitious without becoming impossible
  const pile = missing.filter((a) => !rolled.includes(a.id)).sort((a, b) => a.price - b.price);
  const window = pile.slice(0, Math.max(count, Math.ceil(pile.length * 0.65)));
  while (rolled.length < count && window.length) {
    rolled.push(window.splice(Math.floor(Math.random() * window.length), 1)[0].id);
  }

  // if the window ran out first, top up with whatever remains
  const leftover = missing.filter((a) => !rolled.includes(a.id));
  while (rolled.length < count && leftover.length) {
    rolled.push(leftover.splice(Math.floor(Math.random() * leftover.length), 1)[0].id);
  }
  return rolled;
}

// ---------------------------------------------------------------- the squad

/**
 * The battle takes at most 14 cards. The number is the board's, not a whim:
 * 14 is what the HUD holds in two rows without the cards shrinking past a
 * finger, and it is what turns a big collection into a real choice — whoever
 * owns more than 14 picks a squad at the barracks.
 */
export const DECK_LIMIT = 14;

/** Below this the squad cannot shrink: a battle needs something to plant. */
export const SQUAD_MIN = 3;

/**
 * Moves a card between the field squad and the reserve. Pure on purpose — the
 * barracks screen calls it, the test calls it, and the rule lives here once.
 *
 * Returns `{ deck, moved }` on success or `{ error }` when the swap would
 * break the squad: 'full' past the limit, 'min' below the floor.
 */
export function toggleActive(deck, id) {
  if (!BY_ID[id]) return { error: 'unknown' };
  if (deck.includes(id)) {
    if (deck.length <= SQUAD_MIN) return { error: 'min' };
    return { deck: deck.filter((d) => d !== id), moved: 'reserve' };
  }
  if (deck.length >= DECK_LIMIT) return { error: 'full' };
  return { deck: [...deck, id], moved: 'field' };
}

/**
 * A recruit joins the collection always, and the squad only while there is
 * room — past 14 it waits on the bench. Mutates `state` (the save object),
 * which is what every barracks action does; returns where the card landed.
 */
export function buyCard(state, id) {
  if (!state.owned.includes(id)) state.owned.push(id);
  if (state.deck.length < DECK_LIMIT && !state.deck.includes(id)) {
    state.deck.push(id);
    return 'field';
  }
  return 'reserve';
}

// ------------------------------------------------------------------- levels

/**
 * Training a card improves what it already does — and **does not change its
 * seed cost**. That detail is what makes the upgrade worth it: the same seed on
 * the field now buys more. If the cost went up with it, training would just be
 * inflation under another name.
 *
 * From level 3 the cooldown also shortens: on top of being stronger, the card
 * comes back sooner. Levels IV and V exist, but Brazil cannot buy them —
 * `levelCap` says how deep the training goes for the campaigns a player has
 * reached, and opening Japan is what raises the ceiling from 3 to 5.
 */
export const MAX_LEVEL = 5;

/** How far training can go, given which extra campaigns are open. */
export function levelCap(unlocked = []) {
  return Math.min(MAX_LEVEL, 3 + 2 * unlocked.length);
}

export const LEVELS = [
  { n: 1, power: 1, cooldown: 1, label: '' },
  { n: 2, power: 1.35, cooldown: 0.9, label: 'II' },
  { n: 3, power: 1.8, cooldown: 0.75, label: 'III' },
  { n: 4, power: 2.35, cooldown: 0.65, label: 'IV' },
  { n: 5, power: 3, cooldown: 0.55, label: 'V' },
];

/** What power multiplies. Cost and interval stay out of it, on purpose. */
const SCALED = ['hp', 'damage', 'yield', 'spikes', 'knockback'];

/**
 * The card as it stands on the field, at the level the player trained it to.
 * Always returns a new object: nobody should mutate the base definition.
 */
export function cardAtLevel(idOrCard, level = 1) {
  const base = typeof idOrCard === 'string' ? BY_ID[idOrCard] : idOrCard;
  if (!base) return null;
  const n = Math.min(Math.max(1, level | 0), MAX_LEVEL);
  const info = LEVELS[n - 1];
  const c = { ...base, level: n, levelLabel: info.label };

  for (const attr of SCALED) {
    if (typeof c[attr] === 'number') c[attr] = Math.round(c[attr] * info.power);
  }
  // Control stops growing at level III: a level-V Lion whose stun outlasted
  // his own interval would freeze a whole area forever. Damage keeps scaling —
  // the deep levels buy muscle, never permanent crowd control.
  const control = Math.min(info.power, LEVELS[2].power);
  // poison and slow are objects: scale only what hurts
  if (c.poison) c.poison = { ...c.poison, damage: Math.round(c.poison.damage * info.power) };
  if (c.slow) c.slow = { ...c.slow, duration: +(c.slow.duration * control).toFixed(1) };
  if (c.stun) c.stun = +(c.stun * control).toFixed(1);
  c.cooldown = +(base.cooldown * info.cooldown).toFixed(1);

  return c;
}

/**
 * What it costs to take a card up one level.
 *
 * The sum comes from the card's own value, so training an Elephant costs more
 * than training a Squirrel — and more than recruiting an average card. That is
 * the game's choice: deepen what you have or widen the spread.
 *
 * The IV and V factors are steep on purpose: both campaigns together pay for
 * everything at III or a hand-picked few at V — never the whole collection.
 *
 * The three starter cards have no price (they come free), so they use a
 * reference value to keep training from going for peanuts.
 */
const STARTER_VALUE = 150;
const FACTOR = { 2: 0.7, 3: 1.2, 4: 2, 5: 3.2 };

export function trainingCost(idOrCard, currentLevel) {
  const base = typeof idOrCard === 'string' ? BY_ID[idOrCard] : idOrCard;
  if (!base) return null;
  const next = (currentLevel | 0) + 1;
  if (next > MAX_LEVEL) return null;
  return Math.round((base.price || STARTER_VALUE) * FACTOR[next]);
}
