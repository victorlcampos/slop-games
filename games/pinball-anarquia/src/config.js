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
};

// The playfield strip of the frame. Everything left of `right` is table;
// the backglass panel starts at PANEL.x.
export const TABLE = {
  left: 14,
  right: 510,
  top: 4,
  bottom: 712,
  laneWall: 474, // inner wall of the launch lane
  arch: { cx: 262, cy: 252, r: 248 },
  drainY: 738, // past this the ball is gone
};

export const PANEL = { x: 546, w: FRAME - 546 - 14 };

export const PHYS = {
  gravity: 1350, // the table's slope, in px/s^2
  ballR: 9,
  maxSpeed: 1700,
  airDrag: 0.06, // per second, linear
  wallBounce: 0.5,
  postBounce: 0.75,
  bumperKick: 470, // outward speed a pop bumper sets
  slingKick: 430,
  slingMinHit: 60, // slower than this and the sling is just a wall
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
  x: 492,
  y: 686,
  min: 720, // launch speed at zero charge — not enough to clear the lane
  max: 1340,
  chargeTime: 1.0, // seconds of holding for a full pull
};

export const RULES = {
  balls: 3,
  ballSave: 8, // seconds after entering play
  tiltHeatMax: 3, // nudges before the machine locks up
  tiltCool: 0.55, // heat shed per second
  nudge: 110, // px/s a shove adds
  maxMult: 5,
  extraBallAt: 200000,
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
  },
};

// Missions cycle in this order; a lap through all five raises the level and
// the counts scale with it. `watch` names the event that advances progress.
export const MISSIONS = [
  { id: 'barricades', watch: 'bumper', count: 12 },
  { id: 'pillars', watch: 'bank', count: 2 },
  { id: 'underground', watch: 'hole', count: 2 },
  { id: 'freepress', watch: 'lanes', count: 2 },
  { id: 'slings', watch: 'sling', count: 8 },
];

// The joke is structural: it is a rank ladder in a game about not having one,
// so the top rank is nobody at all.
export const RANKS = ['citizen', 'sympathizer', 'punk', 'agitator', 'saboteur', 'insurgent', 'free'];
