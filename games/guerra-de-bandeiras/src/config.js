// The numbers the whole match agrees on: the size of the field, what a body
// can take, and how much better the enemy squad gets from one arena to the
// next.
//
// **This is Infinite Fortress's body, in a match.** The walk, the roll, the
// turn, the way the gun finds a man inside where you pointed it and waits for
// the shoulders to come round before the round leaves — all of it is the
// Fortress's, number for number, because that is the feel this game was asked
// to have. The camera is the Fortress's too: it sits on the soldier you are
// driving, and the field is half again wider than the screen.
//
// What is not the Fortress's is the light. There, a ring is dark and you read
// it through a torch. Here **only the maze is a night arena**; the other five
// are lit, and in a lit arena you see the whole room you are standing in, all
// the way round — and not one pixel through a wall. One machine
// (`vision.js`), two settings.

export const H = 720;                  // logical height (slopkit fixes this)
export const TILE = 64;                // a corridor is exactly one tile wide
export const COLS = 28;                // both halves: 14 authored + 14 mirrored
export const ROWS = 17;
export const ARENA_W = COLS * TILE;    // 1792
export const ARENA_H = ROWS * TILE;    // 1088
export const HUD_H = 48;               // the scoreboard strip across the top

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
 * than the window can show, and everything laid out across it — the right-hand
 * end of the scoreboard, the minimap, the trigger on a phone — is drawn past
 * the edge. Everything positioned across the screen reads this instead.
 */
export function viewWidth(vp) {
  if (!vp) return H * (16 / 9);
  if (typeof window === 'undefined') return vp.W;
  const css = vp.turned ? window.innerHeight : window.innerWidth;
  if (!css || !vp.scale) return vp.W;
  return Math.min(vp.W, css / vp.scale);
}

/**
 * The camera: the soldier you are driving, in the middle of what is left of the
 * screen once the scoreboard has taken its strip.
 *
 * Straight from the Fortress, including what it deliberately does *not* do.
 * There is no lead towards the cursor and no clamp at the edges of the field —
 * both are the same bug in two places: the moment the camera stops being
 * exactly `player - screen/2`, the pixel under the cursor and the point the gun
 * is aimed at drift apart, and you feel it as a gun that misses what it is
 * pointing at. Nothing is lost at the edges, because everything out there is
 * behind a wall anyway.
 */
export function cameraFor(px, py, W, height = H) {
  return { x: px - W / 2, y: py - HUD_H - (height - HUD_H) / 2 };
}

export const UNIT = {
  r: 15,
  speed: 208,
  accel: 2600,
  friction: 3400,
  hp: 100,
  turn: 18,                            // rad/s — a 180° whip takes 0.17s, felt but never fought
  carry: 1.06,                         // a flag on your back is worth a little speed — see ai.js
  hitR: 17,                            // a shade wider than the body drawn: a clipped shoulder counts
  // How long a body keeps facing the fight after the last shot. Without it,
  // releasing the trigger while backing away snaps him round to face where he
  // is running, and the next tap fires into the corridor ahead instead of at
  // the man behind.
  combatHold: 1,
};

/**
 * The roll: a shove in one direction, faster than anybody can walk.
 *
 * The Fortress's, unchanged — including the part that makes it a decision. It
 * owns the movement while it lasts; steering out of it would make it a speed
 * button instead of a commitment, and it is the only way across a lit corridor
 * somebody is watching.
 */
export const ROLL = { speed: 2.2, time: 0.3, cool: 0.62 };

/**
 * The gun helps. You point it at a man, not at a pixel.
 *
 * The Fortress's assist, whole. `radius` is how far off the line of fire a body
 * can be and still be picked up — a lateral distance, because an angle is
 * unforgivably tight up close and absurdly wide across a hall; `cone` is the
 * same idea from the other end, so a man far away is not out of reach of a
 * shaky thumb; `limit` is the cap that stops it ever spinning him round.
 * `settle` is how far open the brackets draw and the gate the trigger waits on:
 * without it the first round of every burst leaves mid-turn and misses.
 */
export const ASSIST = { radius: 62, cone: 17, limit: 55, settle: 13 };

/**
 * Two guns, one balance sheet. The human rifle is fast and light, the sentinel
 * blaster is slow and heavy, and neither wins.
 *
 * Two traps are buried in these numbers, both found by measuring rather than by
 * reading:
 *
 * **The spread is identical on purpose.** The blaster started a fifth of a
 * degree tighter, which reads as nothing on paper. Every shot is fired with a
 * random error inside that cone, so a tighter cone is a better chance of
 * hitting on *every* shot, and the bot-against-bot matches came back 3-10.
 * Accuracy is not one of the dials these two are balanced on.
 *
 * **Equal damage a second is not equal.** What decides a straight fight is the
 * number of *whole* rounds it takes — thirteen from the rifle, eight from the
 * blaster — times the wait between them. At the same 50 damage a second the
 * blaster killed a tenth of a second sooner and won 351 pinned duels out of
 * 600. The rate below is tuned until neither side wins.
 */
export const GUNS = {
  human: { id: 'rifle', damage: 12, rate: 0.16, spread: 0.035, range: 900, speed: 1400, kick: 2 },
  alien: { id: 'blaster', damage: 18, rate: 0.25, spread: 0.035, range: 900, speed: 1250, kick: 3 },
};

export const dps = (g) => g.damage / g.rate;

/**
 * How far a bot will start a fight, whatever its gun could reach.
 *
 * Without it the open arena settled into fifty kills a minute and one capture
 * in ten: soldiers who can all see each other across a field spend the match
 * shooting and nobody ever crosses it. A gun that only speaks inside nine tiles
 * leaves a runner something to work with, and hands the player the one edge a
 * mouse deserves — you can take a shot they will not.
 */
export const BOT_RANGE = 600;

/**
 * A body left alone knits itself back together. It is the pacing dial of the
 * whole game: without it a match is decided by whoever wins the first fight,
 * because nobody who lost one is ever a threat again.
 */
export const REGEN = { delay: 5, rate: 14 };

/**
 * The flag, and the one rule that makes capture the flag a game instead of a
 * race: **you cannot score while yours is out of its stand.** Two squads
 * sprinting past each other in opposite directions is a draw that repeats
 * forever; the moment your own flag has to be home first, somebody has to turn
 * round and defend.
 */
export const FLAG = {
  pickR: 44,                           // how close you have to be to take theirs
  capR: 52,                            // and to your own stand for it to count
  returnR: 34,                         // how close to pick your own off the deck
};

export const TURRET = {
  hp: 70,
  r: 20,
  range: 520,
  damage: 5,
  rate: 0.62,
  spread: 0.04,
  bulletSpeed: 1100,
  turn: 2.2,                           // rad/s — it can be outrun sideways, which is the point
  rebuild: 20,                         // killing one buys a window, not the base
};

export const PAD = { r: 44, cool: 1.4 };

/**
 * Points to win a match.
 *
 * Five, not ten. A capture takes both squads about half a minute of work at
 * their best and the better part of two minutes on the defensive arenas, so ten
 * of them is a quarter of an hour of the same field — long past the point where
 * an arena has shown you everything it has. Five is a match you finish while it
 * is still the arena you sat down for.
 */
export const TARGET = 5;

/**
 * The two settings of the one pair of eyes.
 *
 * **Day** is the whole room, all the way round, and nothing through a wall: a
 * cone of 360° reaching far enough to cross any room on any of these fields.
 * **Night** is the Fortress's torch, number for number — 104° reaching 470px,
 * plus the small circle you feel rather than see, which is what stops the
 * doorway you are leaning against being invisible.
 *
 * Both are the same function in `vision.js`, and the same rule for both squads:
 * a fog that only applied to the player would be a handicap dressed as
 * atmosphere.
 */
export const VISION = {
  day: { fov: 360, sight: 900, near: 0 },
  night: { fov: 104, sight: 470, near: 120 },
};

/** What a body on this arena sees with. */
export const eyesOf = (arena) => (arena && arena.dark ? VISION.night : VISION.day);

/**
 * The six arenas, in the order they are unlocked.
 *
 * `skill` is one dial from 0 to 1 and everything about the enemy squad reads it
 * (see `botStats`), so the difficulty curve is a property of this table rather
 * than of six hand-tuned brains — and `difficulty` below turns it into a test.
 *
 * The first arena's floor is 0.42 rather than the 0.32 it opened with, and that
 * came out of the shorter match: at 0.32 neither squad shoots straight enough to
 * clear the other off its own stand, so bodies with flags meet in the middle and
 * trade them back for minutes at a time. Ten points hid it — the match was long
 * either way. Two of six bot-vs-bot matches finished at 0.32; five of six do at
 * 0.42, and it is still the easiest field in the game by a comfortable margin.
 */
export const PHASES = [
  { id: 'corridors', squad: 4, skill: 0.42, respawn: 3.4, dark: false },
  { id: 'bridge', squad: 4, skill: 0.48, respawn: 3.2, dark: false },
  { id: 'maze', squad: 4, skill: 0.6, respawn: 3.0, dark: true },
  { id: 'turrets', squad: 4, skill: 0.72, respawn: 2.8, dark: false },
  { id: 'gates', squad: 5, skill: 0.85, respawn: 2.6, dark: false },
  { id: 'open', squad: 5, skill: 1, respawn: 2.4, dark: false },
];

/**
 * What one skill dial buys the other side. Every number a bot uses comes from
 * here — there is no second place where an arena is made harder.
 */
export function botStats(skill) {
  const k = Math.max(0, Math.min(1, skill));
  return {
    react: 0.72 - 0.5 * k,             // seconds between seeing you and firing
    spread: 2.8 - 1.4 * k,             // multiplier on the gun's own spread
    speed: 0.86 + 0.16 * k,            // multiplier on the walk
    lead: k,                           // how much of your velocity it aims in front of
    guard: 0.16 + 0.12 * k,            // share of the squad that stays home
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
  steel: '#9fb2c4',
};

/**
 * Who wears what. A figure is read by its colour before its shape, and that
 * reading has to survive four bodies overlapping in a doorway — so the two
 * sides are as far apart as the palette goes: warm orange against cold green,
 * and never the same shape of head.
 */
export const KIT = {
  human: {
    key: 'human',
    tint: '#ff9a4d',
    dark: '#a4531f',
    coat: '#c96f3a', coatDark: '#8e4a26', legs: '#33291f', head: '#2e2118',
    skin: '#d9a878', trim: '#ffd9a0', hat: 'helmet',
    blood: '#8e2f3f',
    base: '#4a3a2c',
  },
  alien: {
    key: 'alien',
    tint: '#4fe0b0',
    dark: '#1d7a63',
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
