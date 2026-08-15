// The parts of the interface that are drawn on the canvas rather than written
// in HTML.
//
// They are on the canvas for one reason: on an upright phone the kit lays the
// whole canvas on its side (CLAUDE.md, section 2b), and a DOM bar would stay
// stubbornly upright while the game it belongs to is sideways. A dock drawn in
// viewport coordinates turns with the game and stays where the thumb expects.
//
// Every layout here is a pure function returning rectangles, and every tap goes
// through `hit`. That is what keeps "did the finger land on the fire button" a
// question a test can ask without a browser.

const PAD = 10;

export function panel(ctx, x, y, w, h, { fill = 'rgba(18,16,22,0.78)', stroke = 'rgba(255,255,255,0.14)', r = 10 } = {}) {
  ctx.save();
  ctx.beginPath();
  const k = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

export function label(ctx, text, x, y, { size = 15, weight = 700, color = '#f2e7d0', align = 'left', baseline = 'middle', shadow = false } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(text, x + 1.5, y + 1.5);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Width of a label, so a button can be as wide as the word inside it. */
export function textWidth(ctx, text, size = 15, weight = 700) {
  ctx.save();
  ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

/**
 * A button that fits its own text.
 *
 * "To battle" and "Para a batalha" are not the same length, and a fixed width
 * clips one of them — in whichever language you were not looking at. This is
 * the drawn version of the rule in CLAUDE.md, and it is why the workshop's
 * buttons are laid out from measurements taken this frame.
 */
export function button(ctx, rect, text, opts = {}) {
  const { on = false, off = false, accent = '#e8bb4a' } = opts;
  panel(ctx, rect.x, rect.y, rect.w, rect.h, {
    fill: off ? 'rgba(30,28,34,0.55)' : on ? accent : 'rgba(38,34,44,0.9)',
    stroke: on ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.16)',
    r: 9,
  });
  label(ctx, text, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, {
    size: opts.size || 15,
    color: off ? 'rgba(240,232,214,0.4)' : on ? '#231c10' : '#f2e7d0',
    align: 'center',
  });
}

/** Which rectangle a point landed in — last one wins, so overlays are on top. */
export function hit(rects, x, y) {
  let found = null;
  for (const r of rects) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) found = r;
  }
  return found;
}

/** The four munitions, bottom left, above the thumb. */
export function dockLayout(vpW, vpH, ids) {
  const w = Math.min(126, (vpW - PAD * 2 - (ids.length - 1) * 6) / ids.length);
  const h = 58;
  const y = vpH - h - PAD;
  return ids.map((id, i) => ({ id, x: PAD + i * (w + 6), y, w, h }));
}

/** The workshop palette: five materials, the king and the eraser. */
export function paletteLayout(vpW, vpH, ids) {
  const w = Math.min(112, (vpW - PAD * 2 - (ids.length - 1) * 6) / ids.length);
  const h = 62;
  const total = ids.length * w + (ids.length - 1) * 6;
  const x0 = (vpW - total) / 2;
  const y = vpH - h - PAD;
  return ids.map((id, i) => ({ id, x: x0 + i * (w + 6), y, w, h }));
}

/** The buttons above the palette: draft, clear, fight. */
export function shopButtons(ctx, vpW, vpH, texts) {
  const h = 42;
  const y = vpH - 62 - PAD - h - 8;
  const widths = texts.map((t) => Math.max(120, textWidth(ctx, t.text, 15) + 34));
  const total = widths.reduce((a, b) => a + b, 0) + (texts.length - 1) * 8;
  let x = (vpW - total) / 2;
  return texts.map((t, i) => {
    const rect = { id: t.id, text: t.text, x, y, w: widths[i], h };
    x += widths[i] + 8;
    return rect;
  });
}

/** A bar that fills left to right — king health, power, everything. */
export function meter(ctx, x, y, w, h, frac, color, back = 'rgba(0,0,0,0.45)') {
  ctx.save();
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}
