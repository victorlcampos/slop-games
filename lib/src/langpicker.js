// The flag picker, in the two shapes the games here need.
//
//   DOM    — `mountLangPicker(i18n)` fills every `[data-lang-picker]` on the
//            page. Menus written in HTML (SkiFree, World Drive, the index).
//   canvas — `drawLangPicker(ctx, i18n, box)` paints the flags and hands back
//            the rectangles it used, so the game can route a click without
//            duplicating the layout maths. Menus drawn on canvas (Animais vs
//            Monstros, Zoo Magnata).
//
// Both mark the current language the same way: the other flag is dimmed and
// slightly smaller. A picker that highlights the *active* flag reads as "click
// here to stay where you are"; dimming the inactive one reads as an offer.

import { LANGS, LANG_NAMES } from './langs.js';
import { drawFlag, flagDataURL } from './flags.js';

const STYLE_ID = 'slop-langpicker-css';

const CSS = `
.slop-langs{display:inline-flex;gap:6px;align-items:center;line-height:0}
.slop-langs button{
  padding:0;border:0;background:none;cursor:pointer;line-height:0;
  border-radius:3px;opacity:.42;transition:opacity .15s,transform .15s;
  filter:grayscale(.55)
}
.slop-langs button:hover{opacity:.8;filter:grayscale(0)}
.slop-langs button[aria-pressed=true]{opacity:1;filter:none;transform:scale(1.08)}
.slop-langs button:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.slop-langs img{display:block;border-radius:3px}
`;

function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  doc.head.appendChild(el);
}

/**
 * Fill every `[data-lang-picker]` element with a row of flag buttons.
 *
 * The host element keeps whatever position and margin the game's CSS gives it —
 * this only owns what's inside. Returns a teardown that unsubscribes and
 * empties the hosts again.
 *
 * @param {object} i18n  from `createI18n`
 * @param {object} [opts]
 * @param {Element|string} [opts.host]  a single host instead of scanning
 * @param {number} [opts.width]         flag width in CSS pixels (default 30)
 */
export function mountLangPicker(i18n, opts = {}) {
  if (typeof document === 'undefined') return () => {};
  const { width = 30 } = opts;

  const hosts = opts.host
    ? [typeof opts.host === 'string' ? document.querySelector(opts.host) : opts.host].filter(Boolean)
    : Array.from(document.querySelectorAll('[data-lang-picker]'));
  if (!hosts.length) return () => {};

  ensureStyle(document);
  const src = Object.fromEntries(LANGS.map((l) => [l, flagDataURL(l, width)]));
  const buttons = [];

  for (const host of hosts) {
    host.textContent = '';
    host.classList.add('slop-langs');
    host.setAttribute('role', 'group');
    for (const lang of LANGS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.lang = lang;
      b.title = LANG_NAMES[lang].label;
      b.setAttribute('aria-label', LANG_NAMES[lang].label);
      b.setAttribute('lang', LANG_NAMES[lang].tag);
      const img = document.createElement('img');
      img.src = src[lang];
      img.alt = LANG_NAMES[lang].label;
      img.width = width;
      img.height = Math.round((width * 2) / 3);
      b.appendChild(img);
      b.addEventListener('click', () => i18n.set(lang));
      host.appendChild(b);
      buttons.push(b);
    }
  }

  const paint = () => {
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.lang === i18n.lang));
  };
  paint();
  const off = i18n.onChange(paint);

  return () => {
    off();
    for (const host of hosts) host.textContent = '';
  };
}

/** The attributes that ever need translating. A fixed list beats scanning every
 *  element's dataset on each language change. */
const ATTRS = ['title', 'placeholder', 'alt', 'aria-label', 'value', 'content'];

/**
 * Re-translate a whole DOM subtree in one call, in either of two styles:
 *
 *   <h1 data-t="title"></h1>                              from the dictionary
 *   <p data-pt="Olá" data-en="Hello">Olá</p>              written inline
 *
 * The dictionary form is right when a phrase repeats or is built at runtime.
 * The inline form is right for one-off page copy — it renders in the markup, so
 * the text is on screen before any JavaScript runs, and there is no dictionary
 * to keep in sync with a file nobody opens.
 *
 * Attributes follow the same split: `data-t-title="hint"` reads the dictionary,
 * `data-en-title="Runs offline"` is written inline. A tooltip left in one
 * language is exactly the kind of miss nobody notices until a player does.
 *
 * Returns a teardown.
 */
export function bindText(i18n, root = document) {
  if (typeof document === 'undefined') return () => {};

  const inlineSelector = LANGS.map((l) => `[data-${l}]`).join(',');
  const attrSelector = [
    ...ATTRS.map((a) => `[data-t-${a}]`),
    ...LANGS.flatMap((l) => ATTRS.map((a) => `[data-${l}-${a}]`)),
  ].join(',');

  const apply = () => {
    for (const el of root.querySelectorAll('[data-t]')) {
      el.textContent = i18n.t(el.dataset.t);
    }
    for (const el of root.querySelectorAll(inlineSelector)) {
      const text = el.getAttribute(`data-${i18n.lang}`);
      if (text !== null) el.textContent = text;
    }
    for (const el of root.querySelectorAll(attrSelector)) {
      for (const attr of ATTRS) {
        // `data-<lang>-<attr>` read through getAttribute, not dataset: the
        // camelCase key for `data-en-aria-label` is not worth guessing
        const inline = el.getAttribute(`data-${i18n.lang}-${attr}`);
        if (inline !== null) el.setAttribute(attr, inline);
        const id = el.getAttribute(`data-t-${attr}`);
        if (id) el.setAttribute(attr, i18n.t(id));
      }
    }
  };

  apply();
  return i18n.onChange(apply);
}

/**
 * Paint the picker on a canvas and return where it landed.
 *
 * The caller decides the box; this only knows how to fit two flags in it. The
 * returned zones are in the same coordinate space you drew in, so hit testing
 * is `pickLangAt(zones, ...screen.point(ev.clientX, ev.clientY))`.
 *
 * @returns {Array<{lang:string,x:number,y:number,w:number,h:number}>}
 */
export function drawLangPicker(ctx, i18n, opts = {}) {
  const { x = 0, y = 0, w = 34, gap = 8, vertical = false } = opts;
  const h = opts.h || w * (2 / 3);
  const zones = [];

  LANGS.forEach((lang, i) => {
    const fx = vertical ? x : x + i * (w + gap);
    const fy = vertical ? y + i * (h + gap) : y;
    const on = lang === i18n.lang;

    ctx.save();
    ctx.globalAlpha = on ? 1 : 0.4;
    drawFlag(ctx, lang, fx, fy, w, h);
    ctx.restore();

    if (on) {
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(1.5, w * 0.06);
      ctx.strokeRect(fx - ctx.lineWidth, fy - ctx.lineWidth, w + ctx.lineWidth * 2, h + ctx.lineWidth * 2);
      ctx.restore();
    }

    // the touch target is padded beyond the drawing: a 34px flag is a fine
    // thing to look at and a poor thing to hit with a thumb
    const pad = Math.max(6, w * 0.28);
    zones.push({ lang, x: fx - pad, y: fy - pad, w: w + pad * 2, h: h + pad * 2 });
  });

  return zones;
}

/** Which flag, if any, a logical point fell on. */
export function pickLangAt(zones, x, y) {
  for (const z of zones || []) {
    if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z.lang;
  }
  return null;
}
