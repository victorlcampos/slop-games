// An elastic viewport: the canvas fills the window at any aspect ratio.
//
// The logical **height** is fixed — it is what sets the size of everything you
// draw: a character, a lane, a font, a button. The logical **width** is the one
// that moves, following the shape of the window. On an ultrawide you see more
// world; on a 4:3, less. Nobody gets letterboxing and nothing stretches.
//
// Where it came from: the elastic width is Animals vs Monsters'; the adaptive
// devicePixelRatio ceiling is Zoo Tycoon's, which found out the hard way that
// painting a cartoon outline at DPR 3 triples the fill area for no visible gain
// — and drops the frame rate on phones.

const DEFAULTS = {
  height: 720,
  minWidth: 1040,
  maxWidth: 1900,
  // past 2 the gain vanishes in a cartoon outline; on a small phone even 2 hurts
  maxDPR: 2,
  maxDPRPhone: 1.6,
  phoneWidth: 900,
};

export function createViewport(canvas, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const ctx = canvas.getContext('2d', { alpha: options.alpha !== false });

  // the sizes `resize` last ran with; `begin` compares against them to catch a
  // rotation the event didn't deliver in time
  let lastWidth = -1;
  let lastHeight = -1;
  let onWidthChange = null;

  const vp = {
    canvas,
    ctx,
    W: cfg.height * (16 / 9),
    H: cfg.height,
    scale: 1,
    dpr: 1,
    touch: isTouch(),
    /** Reference board for menu screens composed at a fixed width. */
    frame: options.frame || 1280,
  };

  /** How far the board slides right when the viewport is wider than it. */
  vp.margin = () => Math.max(0, (vp.W - vp.frame) / 2);
  /** Usable width of a menu screen (never wider than the board). */
  vp.menuWidth = () => Math.min(vp.W, vp.frame);

  /**
   * Recompute everything from the current window size.
   * Returns true when the **logical width changed** — anything caching scenery
   * by width needs to know, so it can repaint.
   */
  vp.resize = () => {
    const cssWidth = Math.max(1, window.innerWidth);
    const cssHeight = Math.max(1, window.innerHeight);

    const ceiling = vp.touch && cssWidth <= cfg.phoneWidth ? cfg.maxDPRPhone : cfg.maxDPR;
    const dpr = Math.min(window.devicePixelRatio || 1, ceiling);

    const before = vp.W;
    vp.W = Math.round(
      Math.min(cfg.maxWidth, Math.max(cfg.minWidth, (cssWidth / cssHeight) * cfg.height))
    );
    vp.H = cfg.height;
    vp.dpr = dpr;
    vp.touch = isTouch();
    vp.scale = cssHeight / cfg.height;

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';

    lastWidth = cssWidth;
    lastHeight = cssHeight;
    return vp.W !== before;
  };

  /**
   * Set the frame up. After this, draw in logical coordinates.
   *
   * Before drawing, it checks whether the window resized without telling us.
   * That is not paranoia: rotating a phone fires both `resize` and
   * `orientationchange`, but on several mobile browsers the event arrives
   * **before** `innerWidth` and `innerHeight` hold the new values — and a
   * resize computed from the old numbers leaves the scale wrong.
   *
   * Since the scale is what turns a touch into a game coordinate, the symptom
   * is not a skewed picture: it is **the game going deaf to the finger** after
   * a rotation, while working fine for whoever opened it the right way up. Two
   * comparisons per frame fix it without depending on any event being punctual.
   */
  vp.begin = () => {
    if (window.innerWidth !== lastWidth || window.innerHeight !== lastHeight) {
      const widthChanged = vp.resize();
      if (widthChanged && onWidthChange) onWidthChange(vp);
    }
    const k = vp.scale * vp.dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, vp.W, vp.H);
  };

  /** Turn an event point (clientX/clientY) into a logical coordinate. */
  vp.point = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left) / vp.scale, y: (clientY - r.top) / vp.scale };
  };

  /**
   * Wire up automatic resizing. `onChange` only fires when the logical width
   * really moves — `orientationchange` on a phone arrives before the new size
   * is in effect, hence the delay.
   */
  vp.watch = (onChange) => {
    onWidthChange = onChange;
    const respond = () => {
      if (vp.resize() && onWidthChange) onWidthChange(vp);
    };
    window.addEventListener('resize', respond);
    window.addEventListener('orientationchange', () => setTimeout(respond, 250));
    return () => {
      window.removeEventListener('resize', respond);
      onWidthChange = null;
    };
  };

  vp.resize();
  return vp;
}

export function isTouch() {
  if (typeof window === 'undefined') return false;
  return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
}

/**
 * The pure arithmetic behind `resize`, exposed so a test can exercise it
 * without a browser. Returns the logical width and the effective dpr.
 */
export function measure(cssWidth, cssHeight, rawDPR, touch, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const ceiling = touch && cssWidth <= cfg.phoneWidth ? cfg.maxDPRPhone : cfg.maxDPR;
  return {
    W: Math.round(Math.min(cfg.maxWidth, Math.max(cfg.minWidth, (cssWidth / cssHeight) * cfg.height))),
    H: cfg.height,
    dpr: Math.min(rawDPR || 1, ceiling),
    scale: cssHeight / cfg.height,
  };
}
