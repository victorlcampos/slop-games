// The twenty guns.
//
// Everything a weapon is lives in this table: how fast it fires, what leaves the
// barrel, how much it carries. `kind` picks one of the eight projectile
// behaviours implemented in shots.js — everything else is numbers, so balancing
// is editing a row and not chasing logic through the code.
//
// The service rifle is the one you always have: `ammo: Infinity`. Every other
// gun is picked up off the wreckage, and when its magazine runs dry the soldier
// falls back to the rifle — that fallback is the whole rhythm of the game.

/**
 * Fields
 *   kind      bullet | pellet | beam | rocket | lobbed | flame | orb | homing
 *   dmg       damage per projectile that connects
 *   rate      seconds between shots (a burst of pellets counts as one shot)
 *   speed     px/s along the barrel (beams are instant)
 *   ammo      shots in a full pickup; Infinity for the rifle
 *   count     projectiles per shot
 *   spread    radians of cone
 *   pierce    how many objects one projectile goes through (0 = stops at the first)
 *   splash    radius of the blast, in px (0 = no blast)
 *   life      seconds the projectile lives
 *   effect    freeze | burn | acid | emp | chain | nail | bounce (read by game.js)
 *   auto      true when holding the trigger keeps it firing
 */
export const WEAPONS = [
  {
    id: 'rifle', tier: 0, kind: 'bullet', auto: false,
    name: { pt: 'Fuzil de dotação', en: 'Service rifle' },
    note: { pt: 'O que sobrou do posto. Nunca acaba, nunca impressiona.',
            en: 'What the outpost left you. Never runs out, never impresses.' },
    dmg: 3, rate: 0.16, speed: 1500, ammo: Infinity, count: 1, spread: 0.01,
    pierce: 0, splash: 0, life: 1.4, colour: '#ffd88a',
  },
  {
    id: 'smg', tier: 1, kind: 'bullet', auto: true,
    name: { pt: 'Submetralhadora', en: 'Submachine gun' },
    note: { pt: 'Cospe chumbo barato depressa demais para mirar direito.',
            en: 'Spits cheap lead faster than you can aim it.' },
    dmg: 2, rate: 0.06, speed: 1400, ammo: 220, count: 1, spread: 0.07,
    pierce: 0, splash: 0, life: 1.1, colour: '#ffe9a8',
  },
  {
    id: 'shotgun', tier: 1, kind: 'pellet', auto: false,
    name: { pt: 'Escopeta de bombear', en: 'Pump shotgun' },
    note: { pt: 'Seis bagos por vez. De perto abre um engradado em um golpe.',
            en: 'Six pellets a shell. Up close it opens a crate in one.' },
    dmg: 3, rate: 0.62, speed: 1150, ammo: 28, count: 6, spread: 0.22,
    pierce: 0, splash: 0, life: 0.42, colour: '#ffc98a',
  },
  {
    id: 'mg', tier: 2, kind: 'bullet', auto: true,
    name: { pt: 'Metralhadora pesada', en: 'Heavy machine gun' },
    note: { pt: 'Empurra o que acerta. Segure o gatilho e caminhe devagar.',
            en: 'Shoves whatever it hits. Hold the trigger and walk slowly.' },
    dmg: 5, rate: 0.075, speed: 1600, ammo: 300, count: 1, spread: 0.05,
    pierce: 1, splash: 0, life: 1.3, colour: '#ffdd93', knock: 240,
  },
  {
    id: 'minigun', tier: 3, kind: 'bullet', auto: true,
    name: { pt: 'Minigun', en: 'Minigun' },
    note: { pt: 'Precisa girar antes de cuspir — e depois não pergunta mais nada.',
            en: 'Has to spin up first — after that it stops asking questions.' },
    dmg: 4, rate: 0.035, speed: 1700, ammo: 600, count: 1, spread: 0.11,
    pierce: 0, splash: 0, life: 1.2, colour: '#fff0b8', spin: 0.7,
  },
  {
    id: 'marksman', tier: 2, kind: 'beam', auto: false,
    name: { pt: 'Rifle de precisão', en: 'Marksman rifle' },
    note: { pt: 'Um tiro, uma linha reta, tudo que estiver nela.',
            en: 'One shot, one straight line, everything standing in it.' },
    dmg: 26, rate: 0.85, speed: 0, ammo: 14, count: 1, spread: 0,
    pierce: 99, splash: 0, life: 0.09, colour: '#cfe9ff',
  },
  {
    id: 'railgun', tier: 4, kind: 'beam', auto: false,
    name: { pt: 'Canhão de trilho', en: 'Railgun' },
    note: { pt: 'Atravessa um cofre e continua subindo. Seis cargas, nada mais.',
            en: 'Goes through a safe and keeps climbing. Six charges, no more.' },
    dmg: 90, rate: 1.5, speed: 0, ammo: 6, count: 1, spread: 0,
    pierce: 99, splash: 40, life: 0.16, colour: '#9ce7ff',
  },
  {
    id: 'rocket', tier: 3, kind: 'rocket', auto: false,
    name: { pt: 'Bazuca', en: 'Rocket launcher' },
    note: { pt: 'Estouro largo. Não use no que já está no seu colo.',
            en: 'Wide blast. Not for what is already in your lap.' },
    dmg: 30, rate: 0.95, speed: 780, ammo: 10, count: 1, spread: 0.01,
    pierce: 0, splash: 120, life: 2.4, colour: '#ff9a5c',
  },
  {
    id: 'grenade', tier: 2, kind: 'lobbed', auto: false,
    name: { pt: 'Lança-granadas', en: 'Grenade launcher' },
    note: { pt: 'Arco alto e quique. Serve para o que já caiu no chão.',
            en: 'High arc and a bounce. Good for what already landed.' },
    dmg: 22, rate: 0.7, speed: 900, ammo: 16, count: 1, spread: 0.02,
    pierce: 0, splash: 110, life: 2.6, colour: '#b7d17a', effect: 'bounce',
  },
  {
    id: 'flak', tier: 3, kind: 'rocket', auto: true,
    name: { pt: 'Flak automática', en: 'Auto-flak' },
    note: { pt: 'Espoleta de proximidade: estoura perto da carga, não nela.',
            en: 'Proximity fuse: it bursts near the cargo, not on it.' },
    dmg: 14, rate: 0.3, speed: 1000, ammo: 60, count: 1, spread: 0.06,
    pierce: 0, splash: 150, life: 1.8, colour: '#ffd0d0', proximity: 90,
  },
  {
    id: 'flamer', tier: 2, kind: 'flame', auto: true,
    name: { pt: 'Lança-chamas', en: 'Flamethrower' },
    note: { pt: 'Curto e cruel. O que pega fogo continua queimando sozinho.',
              en: 'Short and cruel. Whatever catches fire keeps burning on its own.' },
    dmg: 3, rate: 0.035, speed: 620, ammo: 320, count: 1, spread: 0.16,
    pierce: 9, splash: 0, life: 0.42, colour: '#ff8a3c', effect: 'burn',
  },
  {
    id: 'laser', tier: 3, kind: 'bullet', auto: true,
    name: { pt: 'Laser de assalto', en: 'Assault laser' },
    note: { pt: 'Perfura três alvos e não sente o peso do próprio tiro.',
            en: 'Punches through three targets and never feels the recoil.' },
    dmg: 7, rate: 0.09, speed: 2200, ammo: 140, count: 1, spread: 0,
    pierce: 3, splash: 0, life: 1.0, colour: '#ff5d7a',
  },
  {
    id: 'plasma', tier: 4, kind: 'orb', auto: false,
    name: { pt: 'Canhão de plasma', en: 'Plasma cannon' },
    note: { pt: 'Uma bola lenta que derrete o que encosta nela.',
            en: 'A slow ball that melts whatever touches it.' },
    dmg: 40, rate: 1.1, speed: 480, ammo: 18, count: 1, spread: 0,
    pierce: 4, splash: 90, life: 2.2, colour: '#8ad8ff',
  },
  {
    id: 'chain', tier: 4, kind: 'beam', auto: false,
    name: { pt: 'Raio em cadeia', en: 'Chain lightning' },
    note: { pt: 'Pula de uma carga para a próxima até acabar o que pular.',
            en: 'Jumps from one piece of cargo to the next until it runs out.' },
    dmg: 16, rate: 0.8, speed: 0, ammo: 30, count: 1, spread: 0,
    pierce: 1, splash: 0, life: 0.14, colour: '#c9b6ff', effect: 'chain', chainJumps: 4, chainRange: 260,
  },
  {
    id: 'cryo', tier: 3, kind: 'bullet', auto: false,
    name: { pt: 'Congelador', en: 'Cryo gun' },
    note: { pt: 'Congela no ar. Uma carga congelada cai inerte e se espatifa.',
            en: 'Freezes it mid-air. Frozen cargo drops dead and shatters.' },
    dmg: 6, rate: 0.35, speed: 1000, ammo: 50, count: 1, spread: 0.03,
    pierce: 1, splash: 0, life: 1.2, colour: '#a9e6ff', effect: 'freeze',
  },
  {
    id: 'acid', tier: 2, kind: 'bullet', auto: true,
    name: { pt: 'Fuzil ácido', en: 'Acid rifle' },
    note: { pt: 'O tiro é fraco; o que ele deixa grudado é que come.',
            en: 'The shot is weak; what it leaves stuck to the target does the eating.' },
    dmg: 2, rate: 0.14, speed: 1200, ammo: 90, count: 1, spread: 0.04,
    pierce: 0, splash: 0, life: 1.2, colour: '#9dff7a', effect: 'acid',
  },
  {
    id: 'nailer', tier: 1, kind: 'bullet', auto: true,
    name: { pt: 'Cravadeira', en: 'Nail gun' },
    note: { pt: 'Prega a carga no ar por um instante. Barata e sem vergonha.',
            en: 'Pins the cargo in the air for a moment. Cheap and shameless.' },
    dmg: 4, rate: 0.11, speed: 1300, ammo: 160, count: 1, spread: 0.05,
    pierce: 0, splash: 0, life: 1.1, colour: '#d8d8d8', effect: 'nail',
  },
  {
    id: 'ricochet', tier: 2, kind: 'bullet', auto: false,
    name: { pt: 'Ricochete', en: 'Ricochet gun' },
    note: { pt: 'A bala volta do chão. Debaixo de uma caverna, volta duas vezes.',
            en: 'The round comes back off the ground. Under a cave, twice.' },
    dmg: 6, rate: 0.22, speed: 1100, ammo: 70, count: 1, spread: 0.03,
    pierce: 1, splash: 0, life: 2.4, colour: '#ffe066', effect: 'bounce',
  },
  {
    id: 'swarm', tier: 4, kind: 'homing', auto: false,
    name: { pt: 'Enxame teleguiado', en: 'Homing swarm' },
    note: { pt: 'Quatro agulhas que escolhem alvo sozinhas. Não olhe para cima.',
            en: 'Four needles that pick their own targets. No need to look up.' },
    dmg: 9, rate: 0.75, speed: 620, ammo: 40, count: 4, spread: 0.9,
    pierce: 0, splash: 40, life: 2.6, colour: '#ffb3f0',
  },
  {
    id: 'emp', tier: 4, kind: 'orb', auto: false,
    name: { pt: 'Pulso EMP', en: 'EMP burst' },
    note: { pt: 'Cinco cargas. Tudo que tem circuito para de existir.',
            en: 'Five charges. Anything with a circuit stops existing.' },
    dmg: 12, rate: 1.3, speed: 700, ammo: 5, count: 1, spread: 0,
    pierce: 9, splash: 240, life: 1.6, colour: '#9ff0ff', effect: 'emp',
  },
];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

/** The one that is always in your hands. */
export const PRIMARY = WEAPONS[0];

/** Everything that can be found in the wreckage — the rifle is not a pickup. */
export const DROPPABLE = WEAPONS.filter((w) => w.tier > 0);

/**
 * Picks a gun for a piece of cargo that just broke. `luck` (0..1) climbs with
 * the run: the first minute hands out submachine guns, the tenth hands out
 * railguns. Deterministic given `rand`, so a test can pin it down.
 */
export function rollWeapon(rand, luck = 0) {
  const ceiling = 1 + Math.min(3, Math.floor(luck * 4));   // tiers 1..4
  const pool = DROPPABLE.filter((w) => w.tier <= ceiling);
  // the good stuff is rarer: weight by the inverse of the tier
  const weights = pool.map((w) => 1 / (w.tier * w.tier));
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = rand() * total;
  for (let i = 0; i < pool.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** A full magazine of `weapon`, as the soldier carries it. */
export function loadout(weapon) {
  return { id: weapon.id, ammo: weapon.ammo, spin: 0, cool: 0 };
}
