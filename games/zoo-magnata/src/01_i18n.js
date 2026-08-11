/* ==========================================================================
   0. TWO LANGUAGES

   This game runs in global scope (see build.mjs, `concat` mode), so slopkit
   arrives on `window.Slop` instead of through an import.

   Three conventions live here, and all three keep the translation next to the
   string instead of in a table far away:

     LN('Savana|Savanna')   a bilingual value written inline, split on `|`.
                            Used by the dense data tables — the species
                            catalogue, the biomes, the buildings — where a
                            `{ pt, en }` object per field would triple the file
                            and make it unreadable.

     BI`Dia ${n}|Day ${n}`  the same, for an interpolated sentence.

     TX('key')              the dictionary, for phrases assembled at runtime
                            and for anything long enough that a pipe in the
                            middle of it would hurt.

   `TX`, `LN` and `BI` are two letters on purpose: in a global-scope codebase a
   short common name like `t` would be shadowed by every local `const t = ...`
   in the drawing code, and the call would silently break.
   ========================================================================== */

const I18N = Slop.createI18n({ dict: {} });

/** Splits `'pt|en'` and returns the side that matches the current flag. */
function LN(value) {
  if (typeof value !== 'string') return value;
  const bar = value.indexOf('|');
  if (bar < 0) return value;
  return I18N.lang === 'en' ? value.slice(bar + 1) : value.slice(0, bar);
}

/** The Portuguese side — the stable identity used for seeds and sprite keys. */
function KEY(value) {
  if (typeof value !== 'string') return value;
  const bar = value.indexOf('|');
  return bar < 0 ? value : value.slice(0, bar);
}

/**
 * The same idea for a template literal, so an interpolated sentence can carry
 * both languages without being torn into a dictionary key plus arguments:
 *
 *   BI`Nasceu um filhote de ${name}!|A ${name} was born!`
 *
 * The values are parked behind a marker, the joined text is split on the pipe,
 * and the markers are filled back in. That way `${}` can appear on both sides
 * of the bar, in different places, as often as each language needs.
 */
const MARK = '\u0001';
function BI(parts, ...values) {
  const joined = parts.reduce((acc, p, i) => acc + p + (i < values.length ? MARK + i + MARK : ''), '');
  const bar = joined.indexOf('|');
  if (bar < 0) return fillMarks(joined, values);
  const side = I18N.lang === 'en' ? joined.slice(bar + 1) : joined.slice(0, bar);
  return fillMarks(side, values);
}
function fillMarks(text, values) {
  return text.replace(/\u0001(\d+)\u0001/g, (_, i) => values[+i]);
}

function TX(id, values) {
  return I18N.t(id, values);
}

/** Register a chunk of dictionary. Each file declares the phrases it draws. */
function SAY(entries) {
  I18N.extend(entries);
}
