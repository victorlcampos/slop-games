// The numbers the whole match agrees on: the size of the field, what a body
// can take, and how much better the enemy squad gets from one arena to the
// next.
//
// The field is **fixed and fully on screen**. That is the decision the rest of
// the game hangs off: capture the flag is a game about where everybody else is,
// and a camera that follows one soldier hides the four people the run you are
// about to make depends on. So the arena is 38 by 21 tiles, it is drawn whole,
// and the tile is small enough (32 px) that the whole thing fits under the HUD
// on a 16:9 screen with nothing scrolling.

export const H = 720;                  // logical height (slopkit fixes this)
export const TILE = 32;
export const COLS = 38;                // both halves: 19 authored + 19 mirrored
export const ROWS = 21;
export const ARENA_W = COLS * TILE;    // 1216
export const ARENA_H = ROWS * TILE;    // 672
export const HUD_H = H - ARENA_H;      // 48 — the scoreboard strip on top

/** Half the field, in tiles. Everything is authored here and mirrored. */
export const HALF = COLS / 2;

export const TEAMS = ['human', 'alien'];
export const other = (team) => (team === 'human' ? 'alien' : 'human');

/**
 * How much of the logical width is actually **on the glass**.
 *
 * This is not `vp.W`, and the difference is a bug that only shows up on a 4:3
 * screen. The kit clamps the logical width to a floor of 1040; a 1024x768
 * window works out at 960, so the game is handed a width eighty pixels wider
 * than the window can show, and everything laid out against it — the right-hand
 * end of the scoreboard, the enemy stand, the trigger on a phone — is drawn
 * past the edge. Everything positioned across the screen reads this instead.
 */
export function viewWidth(vp) {
  if (!vp) return H * (16 / 9);
  if (typeof window === 'undefined') return vp.W;
  const css = vp.turned ? window.innerHeight : window.innerWidth;
  if (!css || !vp.scale) return vp.W;
  return Math.min(vp.W, css / vp.scale);
}

/**
 * How the field is drawn inside the viewport.
 *
 * The logical width is elastic (slopkit, section 2b) and its floor is 1040 —
 * narrower than the field. A board with an absolute size only survives inside a
 * frame that scales, so this is that frame: centred, and shrunk when the window
 * is narrower than the arena instead of spilling off both sides.
 */
export function boardTransform(W, height = H) {
  const scale = Math.min(1, (W - 24) / ARENA_W, (height - HUD_H - 8) / ARENA_H);
  return { ox: (W - ARENA_W * scale) / 2, oy: HUD_H + (height - HUD_H - ARENA_H * scale) / 2, scale };
}

export const UNIT = {
  // The body is deliberately narrower than the shot. A corridor here is one
  // 32-pixel tile, and a 20-pixel body leaves six pixels of play on each side
  // of a doorway — enough that a bot walking in at a slight angle wedges on the
  // corner and stays there. Seventeen pixels walks through; twelve pixels of
  // hit radius still means a shot that clips a shoulder counts.
  r: 8.5,
  speed: 212,
  accel: 2500,
  friction: 3200,
  hp: 100,
  turn: 15,                            // rad/s — a whip round is felt, never fought
  carry: 1,                            // a flag on your back costs nothing — see the note in ai.js
  hitR: 12,                            // a shade wider than the body drawn: a clipped shoulder counts
};

/**
 * The dash: one shove, faster than anybody can run, and then a long wait.
 *
 * It is what makes a bridge crossable while somebody is watching it, and the
 * only thing in the game that can outrun a bullet's travel time.
 */
export const DASH = { speed: 2.15, time: 0.24, cool: 1.5 };

/**
 * Two guns, one balance sheet. The human rifle is fast and light, the sentinel
 * blaster is slow and heavy, and they land within a point of the same damage a
 * second — the side you pick is a look and a feel, never an edge.
 *
 * Two traps are buried in these eight numbers, both found by measuring rather
 * than by reading:
 *
 * **The spread is identical on purpose.** The blaster started a fifth of a
 * degree tighter, which reads as nothing on paper. Every shot is fired with a
 * random error inside that cone, so a tighter cone is a better chance of
 * hitting on *every* shot, and the bot-against-bot matches came back 3-10.
 * Accuracy is not one of the dials these two are balanced on.
 *
 * **Equal damage a second is not equal.** What decides a straight fight is time
 * to kill, and time to kill is the number of *whole* rounds it takes — thirteen
 * from the rifle, eight from the blaster — times the wait between them. At the
 * same 50 damage a second the blaster killed a tenth of a second sooner and won
 * 351 pinned duels out of 600. The rate below is tuned until neither side wins:
 * at 0.283 the two clocks land on the same frame and a third of the duels end
 * with both bodies on the floor. That is the balance point, and it is the one
 * number here that must not be rounded for tidiness.
 */
export const GUNS = {
  human: { id: 'rifle', damage: 8, rate: 0.16, spread: 0.05, range: 470, speed: 1020, kick: 2 },
  alien: { id: 'blaster', damage: 13, rate: 0.295, spread: 0.05, range: 470, speed: 940, kick: 3 },
};

/**
 * How far a bot will start a fight, whatever its gun could reach.
 *
 * Without it the open arena settled into fifty kills a minute and one capture
 * in ten: ten soldiers who can all see each other across the field spend the
 * match shooting, and nobody ever crosses it. A gun that only speaks inside a
 * third of the field gives an attacker cover to run behind, and hands the
 * player the one edge a mouse deserves — you can take a shot they will not.
 */
export const BOT_RANGE = 260;

/**
 * A body left alone knits itself back together. It is the pacing dial of the
 * whole game: without it a match is decided by whoever wins the first fight,
 * because nobody who lost a fight is ever a threat again.
 */
export const REGEN = { delay: 4, rate: 20 };

export const dps = (g) => g.damage / g.rate;

/**
 * The flag, and the one rule that makes capture the flag a game instead of a
 * race: **you cannot score while yours is out of its stand.** Two squads
 * sprinting past each other in opposite directions is a draw that repeats
 * forever; the moment your own flag has to be home first, somebody has to turn
 * round and defend.
 */
export const FLAG = {
  pickR: 22,
  capR: 34,
  returnR: 22,                         // touching your own dropped flag sends it home
  dropTime: 14,                        // and it goes home by itself after this long
};

export const TURRET = {
  hp: 70,
  r: 13,
  range: 250,
  damage: 5,
  rate: 0.62,
  spread: 0.05,
  bulletSpeed: 780,
  turn: 2.2,                           // rad/s — it can be outrun sideways, which is the point
  rebuild: 20,                         // a dead turret comes back; killing it buys a window, not the base
};

export const PAD = { r: 26, cool: 1.4 };

/** Points to win a match, and what a capture is worth. */
export const TARGET = 10;

/** How far you see in the dark arena — yours and every teammate's, shared. */
export const SIGHT = 268;

/**
 * The six arenas, in the order they are unlocked.
 *
 * `skill` is one dial from 0 to 1 and everything about the enemy squad reads it
 * (see `botStats`), so the difficulty curve is a property of this table rather
 * than of six hand-tuned brains — and `harder` below turns it into a test.
 */
export const PHASES = [
  { id: 'corridors', squad: 3, skill: 0.32, respawn: 4.2, dark: false },
  { id: 'bridge', squad: 3, skill: 0.48, respawn: 4.0, dark: false },
  { id: 'maze', squad: 4, skill: 0.6, respawn: 3.8, dark: true },
  { id: 'turrets', squad: 4, skill: 0.72, respawn: 3.5, dark: false },
  { id: 'gates', squad: 4, skill: 0.85, respawn: 3.3, dark: false },
  { id: 'open', squad: 5, skill: 1, respawn: 3, dark: false },
];

/**
 * What one skill dial buys the other side. Every number a bot uses comes from
 * here — there is no second place where an arena is made harder.
 */
export function botStats(skill) {
  const k = Math.max(0, Math.min(1, skill));
  return {
    react: 0.72 - 0.5 * k,             // seconds between seeing you and firing
    spread: 4.2 - 2.2 * k,             // multiplier on the gun's own spread
    speed: 0.86 + 0.16 * k,            // multiplier on the walk
    lead: k,                           // how much of your velocity it aims in front of
    guard: 0.18 + 0.14 * k,            // share of the squad that stays home
    hold: 0.9 - 0.55 * k,              // seconds it keeps chasing a corner you left
  };
}

/** One number for "how hard is this arena", so the ramp can be tested. */
export function difficulty(index) {
  const p = PHASES[index];
  const b = botStats(p.skill);
  return p.squad * 2 + (1 / b.react) * 3 + (1 / b.spread) * 6 + b.speed * 4 + (6 - p.respawn) * 1.5;
}

export const COLOURS = {
  void: '#05070b',
  floor: '#3f4b55',
  floorAlt: '#465360',
  grout: '#2c3640',
  wallFace: '#222b35',
  wallTop: '#5b7079',
  wallEdge: '#121820',
  pit: '#080b12',
  pitEdge: '#1b2430',
  hud: '#e8eef8',
  dim: '#8a93a8',
  ink: '#0a0b10',
  energy: '#5ce8cf',
  blood: '#8e2f3f',
  ichor: '#3fae74',
  steel: '#9fb2c4',
};

/**
 * Who wears what. A figure is read by its colour before its shape, and in this
 * game that reading has to survive four people overlapping in a doorway — so
 * the two sides are as far apart as the palette goes: warm orange against cold
 * green, and never the same shape of head.
 */
export const KIT = {
  human: {
    key: 'human',
    tint: '#ff9a4d',
    dark: '#a4531f',
    flag: '#ff9a4d',
    coat: '#c96f3a', coatDark: '#8e4a26', legs: '#33291f', head: '#2e2118',
    skin: '#d9a878', trim: '#ffd9a0', hat: 'helmet',
    blood: '#8e2f3f',
    base: '#4a3a2c',
  },
  alien: {
    key: 'alien',
    tint: '#4fe0b0',
    dark: '#1d7a63',
    flag: '#4fe0b0',
    coat: '#2f7f74', coatDark: '#1e564f', legs: '#1d2a2c', head: '#9db4a6',
    skin: '#8fae9a', trim: '#8ff0dc', hat: 'dome',
    blood: '#3fae74',
    base: '#25453f',
  },
};

/** A seeded stream: the same seed lays out the same arena on any machine. */
export function makeRng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
export const RAD = Math.PI / 180;

/** The shortest way round the circle from `a` to `b`, in radians. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Turn `a` towards `b` by at most `max` radians. */
export function turnTowards(a, b, max) {
  const d = angleDelta(a, b);
  return a + clamp(d, -max, max);
}
