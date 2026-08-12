/* ==========================================================================
   0. TWO LANGUAGES

   This game runs in global scope (see build.mjs, `concat` mode), so slopkit
   arrives on `window.Slop` instead of through an import.

   Three conventions live here, and all three keep the translation next to the
   string instead of in a table far away:

     LN('Savana|Savanna')   a bilingual value written inline, split on `|`.
                            PORTUGUESE FIRST — see the note below. Used by the
                            dense data tables — the species catalogue, the
                            biomes, the buildings — where a `{ pt, en }` object
                            per field would triple the file and make it
                            unreadable.

     BI`Dia ${n}|Day ${n}`  the same, for an interpolated sentence.

     TX('key')              the dictionary, for phrases assembled at runtime
                            and for anything long enough that a pipe in the
                            middle of it would hurt.

   `TX`, `LN` and `BI` are two letters on purpose: in a global-scope codebase a
   short common name like `t` would be shadowed by every local `const t = ...`
   in the drawing code, and the call would silently break.
   ========================================================================== */

const I18N = Slop.createI18n({ dict: {} });

/**
 * Splits `'pt|en'` and returns the side that matches the current flag.
 *
 * The order is Portuguese first because that is how the data was written — the
 * species table, the terrains, the fences. BI below reads the same order, and
 * the two MUST agree: while they disagreed, every LN() string came out in the
 * language the player had just turned off.
 */
function LN(value) {
  if (typeof value !== 'string') return value;
  const bar = value.indexOf('|');
  if (bar < 0) return value;
  return I18N.lang === 'en' ? value.slice(bar + 1) : value.slice(0, bar);
}

/**
 * The English side — the stable identity behind sprite and voice seeds.
 *
 * It has to be one fixed side, never LN(): the seed feeds `hashStr`, so a key
 * that changed with the flag would redraw all 219 species on every switch.
 */
function KEY(value) {
  if (typeof value !== 'string') return value;
  const bar = value.indexOf('|');
  return bar < 0 ? value : value.slice(bar + 1);
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

/**
 * BI's twin for a sentence that has to be STORED rather than shown: it returns
 * the unresolved `pt|en` pair, with each interpolated value resolved to its own
 * side. The reputation statement needs it — that log is persisted in the save,
 * so storing the resolved sentence froze an event in the language it happened
 * in, and interpolating one fixed side gave "Lion fugiu do recinto".
 *
 *   BP`${sp.name} fugiu|A ${sp.name} escaped`  ->  'Leao fugiu|A Lion escaped'
 */
function BP(parts, ...values) {
  const joined = parts.reduce((acc, p, i) => acc + p + (i < values.length ? MARK + i + MARK : ''), '');
  const bar = joined.indexOf('|');
  if (bar < 0) return fillSide(joined, values, 0);
  return fillSide(joined.slice(0, bar), values, 0) + '|' + fillSide(joined.slice(bar + 1), values, 1);
}
/** side 0 = before the bar (Portuguese), side 1 = after it (English) */
function fillSide(text, values, side) {
  return text.replace(new RegExp(MARK + '(\\d+)' + MARK, 'g'), (_, i) => {
    const v = values[+i];
    if (typeof v !== 'string') return v;
    const bar = v.indexOf('|');
    return bar < 0 ? v : side ? v.slice(bar + 1) : v.slice(0, bar);
  });
}

function TX(id, values) {
  return I18N.t(id, values);
}

/** Register a chunk of dictionary. Each file declares the phrases it draws. */
function SAY(entries) {
  I18N.extend(entries);
}
