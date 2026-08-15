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

/**
 * Every control the battle has, laid out at once so none of them can land on
 * another at any width.
 *
 * They used to be three independent functions each anchored to its own edge, and
 * at 1040 logical pixels — a 4:3 monitor — the fire button sat on top of the
 * munition dock. One function that measures the gaps is the only way this stays
 * true at every width, and it is a pure function, so a test can check it.
 *
 * The shape is two thumbs: everything you *shoot* with on the left, everything
 * you *move* with on the right, and the one button that ends the turn between
 * them where neither thumb rests by accident.
 */
export function battleLayout(vpW, vpH, weaponIds) {
  const h = 58;
  const y = vpH - h - PAD;
  const pw = 74;
  const ah = 40;

  const driveX = vpW - PAD - pw * 2 - 6;
  const drive = [
    { id: 'left', dir: -1, x: driveX, y, w: pw, h },
    { id: 'right', dir: 1, x: driveX + pw + 6, y, w: pw, h },
  ];
  const aim = [
    { id: 'up', dir: 1, x: driveX, y: y - ah - 6, w: pw, h: ah },
    { id: 'down', dir: -1, x: driveX + pw + 6, y: y - ah - 6, w: pw, h: ah },
  ];

  const n = weaponIds.length;
  const dw = Math.max(74, Math.min(118, (driveX - PAD * 2 - 180 - (n - 1) * 6) / n));
  const dock = weaponIds.map((id, i) => ({ id, x: PAD + i * (dw + 6), y, w: dw, h }));
  const dockRight = PAD + n * (dw + 6) - 6;

  // The fire button is round and it is the biggest thing down here, because it
  // is the one control you hold rather than tap — Flag War's gun button, doing
  // the same job for the same reason.
  const fr = Math.max(38, Math.min(52, (driveX - dockRight - 28) / 2));
  // anchored to the bottom of the screen rather than to the middle of the dock's
  // row: it is taller than the dock, and centred on that row it hung off the
  // bottom edge at 4:3
  const fcy = vpH - PAD - fr;
  const fire = {
    id: 'fire', r: fr, cx: (dockRight + driveX) / 2, cy: fcy,
    x: (dockRight + driveX) / 2 - fr, y: fcy - fr, w: fr * 2, h: fr * 2,
  };

  return { dock, drive, aim, fire, fuel: { x: driveX, y: aim[0].y - 16, w: pw * 2 + 6, h: 7 } };
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
