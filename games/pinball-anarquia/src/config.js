// Everything tunable in one place: the palette, the table's measurements and
// the physics constants. The table is authored in a fixed 1280x720 frame — the
// playfield on the left, the backglass panel on the right, exactly the split
// the Windows XP Space Cadet window had.

export const H = 720;
export const FRAME = 1280;

// Omarchy's Tokyo Night, from themes/tokyo-night/colors.toml — the same values
// omarchy/preview.mjs uses for the bar panel.
export const C = {
  bg: '#0e0e14',
  table: '#16161e',
  tableHi: '#1a1b26',
  raised: '#24283b',
  line: '#3b4261',
  fg: '#a9b1d6',
  bright: '#c0caf5',
  dim: '#565f89',
  blue: '#7aa2f7',
  cyan: '#7dcfff',
  purple: '#bb9af7',
  green: '#9ece6a',
  yellow: '#e0af68',
  orange: '#ff9e64',
  red: '#f7768e',
  teal: '#73daca',
  magenta: '#ad8ee6',
};

// The playfield the simulation runs on, in its own coordinates. Where any of
// it lands on screen is not a constant — it depends on the shape of the
// window, and render/layout.js works that out.
export const TABLE = {
  left: 14,
  right: 510,
  top: 4,
  bottom: 712,
  laneWall: 474, // inner wall of the launch lane
  arch: { cx: 262, cy: 252, r: 248 },
  drainY: 738, // past this the ball is gone
};

export const PHYS = {
  gravity: 1350, // the table's slope, in px/s^2
  ballR: 9,
  maxSpeed: 2600,
  airDrag: 0.06, // per second, linear
  wallBounce: 0.5,
  postBounce: 0.75,
  // How much of the sideways component a surface takes off the ball. Steel on
  // painted wood and metal rail barely grips; steel on the rubber round a
  // slingshot or a bumper grips a lot, which is why a ball skidding along one
  // slows down instead of skating on forever.
  wallGrip: 0.06,
  rubberGrip: 0.34,
  // A kick is an impulse ADDED to the bounce, not a velocity that replaces it.
  // Replacing it threw away the tangential component — the part gravity has
  // been feeding all the way down the table — so a ball between the two
  // slingshots left each one at exactly the speed and angle it left the last
  // one, forever. Nothing in the loop could ever wind down, because nothing in
  // the loop remembered anything.
  bumperKick: 300,
  slingKick: 300,
  slingMinHit: 60, // slower than this and the sling is just a wall
  // ...and the coil only gives back what the ball put into the rubber. At a
  // square hit it fires at full strength; a graze gets a proportional nudge.
  // Flat strength for any contact at all is what let a ball skim the top
  // corner of one slingshot, cross to the other, and be topped up again — a
  // loop fed entirely by hits too glancing to deserve one.
  slingFull: 260,
  // The switch behind a slingshot is a blade behind the *band*, and the band is
  // stretched between two posts. A ball that clips a post has not touched it.
  // Firing on any contact with the face made the top posts into a pair of
  // trampolines aimed at each other, and a ball skimming between them kept
  // being topped up by a coil it never actually triggered.
  slingBand: [0.2, 0.96],
  // A coil has to reset before it can fire again. Without this the face fired
  // on every physics substep — seven hundred times a second — which is how a
  // ball that found its way behind a slingshot stayed pinned there for good.
  coilReset: 0.09,
  substeps: 6, // per 1/120 update — keeps the ball from tunnelling a wall
};

export const FLIPPER = {
  length: 64,
  r: 9,
  rest: 0.58, // rad below horizontal, pointing at the drain
  up: -0.44,
  omega: 26, // rad/s while travelling
  bounce: 0.35,
};

export const PLUNGER = {
  // The plunger is a rod on a spring, not a number that gets assigned to the
  // ball. Its tip is the floor of the shooter lane: the ball rests on it, is
  // drawn down the lane with it while you pull, and is *carried* back up by
  // it — which is why a weak pull now does what a weak pull does, instead of
  // teleporting the ball back into place afterwards.
  x: 492,
  restY: 668, // where the tip's face sits with the spring relaxed
  tipRad: 4,
  travel: 34, // how far back the rod draws
  pullTime: 0.55, // seconds of holding to draw it all the way
  // Spring stiffness, in 1/s^2. Released from a pull of `p`, simple harmonic
  // motion puts the rod at the stop doing p*sqrt(k) — so a full pull leaves at
  // 34 * sqrt(2740) = 1780 px/s, and every shorter pull is proportionally
  // slower with nothing to tune.
  //
  // 1780 is not a feel number, it is the top of the table: 1300 px/s is what
  // it costs to reach the crown of the arch from the rod, and anything less
  // than about 1450 arrives there with nothing left and falls back down the
  // right-hand side instead of going round. A plunger whose hardest pull
  // cannot make the orbit is a plunger with one outcome.
  k: 5200,
  baseY: 716, // the cabinet front the spring pushes off
};

/** What a pull of `p` pixels throws the ball at. */
export const plungerSpeed = (p) => p * Math.sqrt(PLUNGER.k);

// What it costs to get out of the shooter lane. The ball has to climb from the
// rod to where the arch can bend it left, and anything short of that goes up,
// comes back, and lands on the rod again — which is what a real plunger does,
// and is also exactly what a player reads as "the game is broken" when nothing
// on screen says so. Measured, not guessed; a scenario re-measures it.
export const LANE_ESCAPE = 1013;

/** How far back the rod has to come before the plunge is worth anything. */
export const plungerClears = () => LANE_ESCAPE / Math.sqrt(PLUNGER.k);

export const RULES = {
  balls: 3,
  ballSave: 8, // seconds after entering play
  tiltHeatMax: 3, // nudges before the machine locks up
  tiltCool: 0.55, // heat shed per second
  nudge: 110, // px/s a shove adds
  maxMult: 5,
  extraBallAt: 200000,
  // A real machine watches for a ball it has not seen score in a while and
  // pulses its coils to shake it loose. This is that: the last resort behind
  // every geometric fix, because the one thing a pinball table must never do
  // is keep the ball and stop being a game.
  ballSearch: 7, // seconds inside `searchBox` before the machine goes looking
  searchBox: 90, // how far it has to travel to count as still playing
  score: {
    bumper: 100,
    sling: 50,
    rollover: 250,
    lanesDone: 2500,
    target: 500,
    bank: 5000,
    hole: 1500,
    skillShot: 2000,
    kickback: 0,
    mission: 25000,
    spinner: 130, // per revolution, and a good pass is worth a dozen
    orbit: 3200,
    inlane: 400,
    inlanesDone: 3000,
    outlane: 900, // a consolation: you are about to lose the ball anyway
  },
  loopWindow: 3, // seconds to get from one side of the orbit to the other
};

// Missions cycle in this order; a lap through all of them raises the level and
// the counts scale with it. `watch` names the event that advances progress.
export const MISSIONS = [
  { id: 'barricades', watch: 'bumper', count: 12 },
  { id: 'pillars', watch: 'bank', count: 2 },
  { id: 'underground', watch: 'hole', count: 2 },
  { id: 'freepress', watch: 'lanes', count: 2 },
  { id: 'presses', watch: 'spinner', count: 6 },
  { id: 'blockade', watch: 'orbit', count: 3 },
  // slings stays last: it is the one every ball feeds by accident, so it is
  // the right mission to be holding when the lap wraps and the level goes up
  { id: 'slings', watch: 'sling', count: 8 },
];

// The joke is structural: it is a rank ladder in a game about not having one,
// so the top rank is nobody at all.
export const RANKS = ['citizen', 'sympathizer', 'punk', 'agitator', 'saboteur', 'insurgent', 'free'];
