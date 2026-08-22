// Where the table and the score go, on whatever shape of screen turned up.
//
// A pinball machine is a tall thing, and so is a phone held upright — so the
// phone gets the honest arrangement: the display across the top, the table
// under it taking everything that is left. A monitor is the wrong shape for
// that, and there the machine stands beside its backglass, which is how you
// would see one in a room.
//
// The kit's viewport fixes the logical HEIGHT at 720 and lets the width move
// with the window, so the only thing to look at is how wide the frame came
// out: narrow means a screen taller than it is wide, and that is a phone.

export const SRC = { srcW: 524, srcH: 720 };

/** Below this many logical units across, the backglass goes on top. */
const UPRIGHT_BELOW = 940;

export function computeLayout(W, H = 720) {
  return W < UPRIGHT_BELOW ? upright(W, H) : beside(W, H);
}

/** Phone, held the way people hold phones. */
function upright(W, H) {
  const pad = 8;
  const dmdH = 84;
  // The flag picker and the mute button are DOM, fixed to the top right corner,
  // and on a phone every other pixel of the screen is a flipper — so they
  // cannot move down over the table without eating taps meant for the game.
  // The display gives up a gutter for them instead.
  const gutter = 44;
  const stripY = 4 + dmdH + 6;
  const stripH = 46;
  const top = stripY + stripH + 44;
  return {
    mode: 'upright',
    W,
    H,
    dmd: { x: pad, y: 4, w: W - pad * 2 - gutter, h: dmdH },
    strip: { x: pad, y: stripY, w: W - pad * 2, h: stripH },
    topLimit: stripY + stripH + 4,
    table: {
      ...SRC,
      cx: W / 2,
      halfW: W / 2 - 10,
      top,
      bottom: H - 22,
      // a narrow board with a hard trapezoid on it looks like a funnel; the
      // upright layout is already tall, so it needs less help
      far: 0.66,
    },
  };
}

/** Monitor: the machine, and its backglass standing next to it. */
function beside(W, H) {
  const panelW = Math.round(Math.min(560, Math.max(360, W * 0.35)));
  const panelX = W - panelW - 14;
  const areaW = panelX - 26;
  const halfW = Math.min(areaW / 2 - 16, 322);
  return {
    mode: 'beside',
    W,
    H,
    panel: { x: panelX, y: 10, w: panelW, h: H - 20 },
    topLimit: 6,
    table: {
      ...SRC,
      cx: 20 + areaW / 2,
      halfW,
      top: 50,
      // room under the near edge for the lockdown bar, which juts out in front
      bottom: H - 44,
      far: 0.54,
    },
  };
}

/** A key that changes exactly when the warped texture has to be rebuilt. */
export function layoutKey(layout, k) {
  const t = layout.table;
  return `${layout.mode}:${t.cx}:${t.halfW}:${t.top}:${t.bottom}:${t.far}:${k.toFixed(2)}`;
}
