// How the picture is fitted to the window, and how much of it the machine can
// afford to draw. Both answers were wrong on a phone, and neither is visible to
// a test that only opens a canvas — so they live here, as arithmetic.

/** The window the mountain was framed in: a wide desktop. */
export const DESIGN_ASPECT = 16 / 9;
/** Past this the widening turns into a fisheye — and into frustum to fill. */
export const MAX_FOV = 82;

/**
 * The camera's vertical fov for the window it is really in.
 *
 * `PerspectiveCamera.fov` is the VERTICAL angle, so a portrait phone keeps the
 * 58° the game was framed with and loses two thirds of the horizontal view:
 * at 9:19.5 the picture is a 28° telephoto, which reads on screen as the game
 * having zoomed in by itself. Widening the vertical angle until the horizontal
 * one comes back is the "Hor+" fit, and it is what a rotated phone expects.
 *
 * The clamp is the honest part: matching the design's ~89° horizontal in
 * portrait would need a 130° vertical, which is a fisheye that also drags half
 * the mountain into the frustum. 82° gets most of the view back at a cost the
 * phone can pay.
 */
export function fovForAspect(fov, aspect, { designAspect = DESIGN_ASPECT, maxFov = MAX_FOV } = {}) {
  if (!(aspect > 0) || !(fov > 0) || aspect >= designAspect) return fov;
  const halfHorizontal = Math.atan(Math.tan((fov * Math.PI) / 360) * designAspect);
  const vertical = (Math.atan(Math.tan(halfHorizontal) / aspect) * 360) / Math.PI;
  return Math.min(maxFov, vertical);
}

/**
 * What each class of machine gets before a single frame has been measured.
 *
 * The adaptive tracker further down the loop is a safety net, not a plan: it
 * needs seconds of a bad framerate before it reacts, and those are exactly the
 * seconds a player spends deciding whether the game is broken. A phone starts
 * without ambient occlusion, at a fill rate it can sustain, and climbs nowhere
 * — it does not need to.
 */
export const TIERS = [
  { name: 'phone',   maxPixelRatio: 1.25, samples: 2, shadowMapSize: 1024, cascades: 3, shadowFar: 120, snowflakes: 800,  softShadows: false, quality: 1 },
  { name: 'tablet',  maxPixelRatio: 1.5,  samples: 4, shadowMapSize: 1536, cascades: 4, shadowFar: 160, snowflakes: 1600, softShadows: true,  quality: 2 },
  { name: 'desktop', maxPixelRatio: 2,    samples: 4, shadowMapSize: 2048, cascades: 4, shadowFar: 190, snowflakes: 2400, softShadows: true,  quality: 2 },
];

/**
 * Which of the three the machine is. Pure, so the boundaries can be argued with
 * in a test instead of on a phone.
 *
 * A coarse pointer on a small window is a phone; a coarse pointer on a big one
 * is a tablet, which is a phone GPU with four times the pixels. Cores are the
 * only signal left for a laptop that is quietly a netbook, and a weak one: the
 * count says nothing about the GPU, and a browser with fingerprint resistance
 * reports 2 whatever the machine is. So it only catches the very bottom, and
 * everything above is left to the tracker, which has real frames to go on.
 */
export function deviceTier({ coarse = false, minSide = 1280, cores = 8 } = {}) {
  if (coarse && minSide <= 560) return 0;
  if (coarse || cores <= 2) return 1;
  return 2;
}

/** Reads the signals off the browser — the only impure line in the file. */
export function readDevice(g = globalThis) {
  const coarse = !!(g.matchMedia && g.matchMedia('(hover: none) and (pointer: coarse)').matches);
  const minSide = Math.min(g.innerWidth || 1280, g.innerHeight || 720);
  const cores = (g.navigator && g.navigator.hardwareConcurrency) || 8;
  return TIERS[deviceTier({ coarse, minSide, cores })];
}
