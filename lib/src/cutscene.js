// The cutscene machine. Two games grew the same film projector independently —
// scenes with a duration, a caption that fades with the scene, click to turn
// the page, ESC to leave the cinema, dots for scene markers — and diverged only
// in the skin. The machine lives here once; the skin stays with each game.
//
// A scene is `{ duration, line?, draw(ctx, w, t) }`: seconds on screen, an
// optional bilingual caption, and a painter that gets the context, the logical
// width of the moment (elastic viewports change it mid-film) and the seconds
// elapsed inside the scene.
//
// Nothing here knows HOW a game draws. The caption box, the skip hint and the
// markers have plain-canvas defaults, and a game with a drawing engine of its
// own (Animals' scribble) hands in replacements. `frame` wraps the whole paint
// in the game's coordinate frame — the hook for `applyFrame`-style centring.

const KIT_SKIP_HINT = {
  pt: 'clique para avançar · ESC pula a abertura',
  en: 'click to advance · ESC skips the intro',
};

/** Plain word-wrap against the context's current font. */
function wrapPlain(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const probe = line ? `${line} ${w}` : w;
    if (ctx.measureText(probe).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Builds a film out of `scenes`.
 *
 * `onDone()` fires exactly once — at the end of the last scene, or the moment
 * the player skips. `onAdvance()` fires on every hand-turned page, which is
 * where a game clicks a sound.
 *
 * Returns `{ update, draw(ctx, w), click, skip, scene, done }`. The caller
 * passes the logical width to every `draw` — elastic viewports resize between
 * frames, and the film should not have to know who to ask.
 */
export function createCutscene(scenes, opts = {}) {
  const {
    height = 720,
    i18n = null,
    onDone = () => {},
    onAdvance = null,
    fade = 0.7,
    veil = '#05070b',
    skipHint = KIT_SKIP_HINT,
    caption = null,
    hint = null,
    marker = null,
    frame = null,
  } = opts;

  // resolves a bilingual field with the game's own language choice; plain
  // strings pass through, and with no i18n instance English is the default
  const pick = (field) => {
    if (field && typeof field === 'object') {
      if (i18n && field[i18n.lang] !== undefined) return field[i18n.lang];
      return field.en !== undefined ? field.en : field.pt;
    }
    return field;
  };

  let scene = 0;
  let t = 0;
  let done = false;

  function advance() {
    if (done) return;
    if (scene >= scenes.length - 1) {
      finish();
      return;
    }
    scene++;
    t = 0;
    onAdvance?.();
  }

  function finish() {
    if (done) return;
    done = true;
    onDone();
  }

  function update(dt) {
    if (done) return;
    t += dt;
    if (t >= scenes[scene].duration) {
      if (scene >= scenes.length - 1) finish();
      else {
        scene++;
        t = 0;
      }
    }
  }

  // ------------------------------------------------- the plain-canvas skin

  function defaultCaption(ctx, w, text, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '24px system-ui, sans-serif';
    const width = Math.min(940, w - 140);
    const lines = wrapPlain(ctx, text, width - 60);
    const bh = 28 + lines.length * 32;
    const y = height - bh - 36;
    ctx.fillStyle = 'rgba(10,12,18,0.74)';
    ctx.fillRect(w / 2 - width / 2, y, width, bh);
    ctx.strokeStyle = 'rgba(140,155,185,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(w / 2 - width / 2, y, width, bh);
    ctx.fillStyle = '#e8eef8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((ln, i) => ctx.fillText(ln, w / 2, y + 26 + i * 32));
    ctx.restore();
  }

  function defaultHint(ctx, w, text) {
    ctx.save();
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(232,238,248,0.55)';
    ctx.fillText(text, w - 24, 30);
    ctx.restore();
  }

  function defaultMarker(ctx, x, y, active) {
    ctx.save();
    ctx.fillStyle = active ? 'rgba(242,238,228,0.95)' : 'rgba(232,238,248,0.25)';
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- drawing

  function draw(ctx, w) {
    const c = scenes[scene];
    const paint = () => {
      c.draw(ctx, w, t);

      // fade in and fade out of each scene. The veil spills well past the
      // frame on purpose: centred-frame games draw wider than `w`.
      const fadeIn = Math.min(1, t / fade);
      const fadeOut = Math.min(1, (c.duration - t) / fade);
      const dark = 1 - Math.min(fadeIn, fadeOut);
      if (dark > 0.001) {
        ctx.save();
        ctx.globalAlpha = dark;
        ctx.fillStyle = veil;
        ctx.fillRect(-w, -height, w * 3, height * 3);
        ctx.restore();
      }

      if (c.line) {
        const alpha = Math.min(1, Math.max(0, (t - 0.35) / 0.6)) * fadeOut;
        (caption || defaultCaption)(ctx, w, pick(c.line), alpha);
      }

      (hint || defaultHint)(ctx, w, pick(skipHint));

      for (let i = 0; i < scenes.length; i++) {
        (marker || defaultMarker)(ctx, w / 2 - (scenes.length - 1) * 9 + i * 18, height - 16, i === scene);
      }
    };
    if (frame) frame(ctx, paint);
    else paint();
  }

  return {
    update,
    draw,
    click: advance,
    skip: finish,
    get scene() { return scene; },
    get done() { return done; },
  };
}

export { KIT_SKIP_HINT };
