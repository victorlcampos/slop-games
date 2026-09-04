// Tunables for the whole game, in one place — the tests read these instead of
// hardcoding numbers, so tuning never breaks the suite.

export const H = 720;

/** Logical playfield width the simulation is laid out on. */
export const PLAY_W = 960;

/** The swarm: eleven across, five deep, like 1978. */
export const COLS = 11;
export const ROWS = 5;

export const CELL_W = 56;
export const CELL_H = 44;

/** Points per row, top row first: the high ones are harder to reach. */
export const ROW_SCORE = [30, 20, 20, 10, 10];

/** How far the formation steps sideways each tick, and drops on an edge. */
export const STEP_X = 12;
export const STEP_Y = 26;

export const PLAYER = {
  w: 52,
  h: 30,
  y: 656,
  speed: 420,
  lives: 3,
  /** Cool-down between cannon shots. The cannon holds one shell in the air. */
  cooldown: 0.22,
};

export const SHOT = {
  w: 4,
  h: 16,
  speed: 640,
};

export const BOLT = {
  w: 5,
  h: 18,
  /** Base fall speed of an enemy bolt; waves add a share on top. */
  speed: 300,
  waveBonus: 26,
  /** Seconds between enemy shots at wave 1 with a full swarm; shrinks fast. */
  period: 1.15,
  minPeriod: 0.18,
};

export const SAUCER = {
  w: 64,
  h: 26,
  // the canvas HUD text sits below the DOM corner (top ~54, 20px tall), so
  // the saucer lane lives under it — its belly clears the text band
  y: 116,
  speed: 170,
  /** Seconds between saucer crossings, give or take the jitter. */
  period: 22,
  jitter: 8,
  /** Snap shots pay: fewer shots since it appeared, more points. */
  pay: [300, 150, 100, 50],
};

/** The line the swarm must not cross — past it, the invasion broke through. */
export const DEADLINE_Y = 600;

export const SHIELD = {
  count: 4,
  w: 96,
  h: 64,
  y: 548,
  cols: 12,
  rows: 8,
  /** Radius (in cells) chewed out of a bunker by one bolt. */
  crater: 1.6,
};

export const INVADER_W = 40;
export const INVADER_H = 30;
