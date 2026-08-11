// Two languages, drawn on canvas.
//
// A canvas game gets i18n almost free: the screen is repainted every frame, so
// switching language is just the next frame reading a different string. There
// is no re-render to trigger — only the sprite cache has to care, and it does
// so by keying anything with baked-in text by language.
//
// The strings themselves live next to what they name: card names in
// data/animals.js, lore in data/monsters.js, screen copy in each screen file as
// a local `T`. `pick` is what turns `{ pt, en }` into the string of the moment.
// Nothing here holds a central dictionary — a table of 200 keys far from where
// they're drawn is exactly how a phrase gets translated on one side only.

import { createI18n } from 'slopkit';

export const i18n = createI18n();

/** The kit's shared phrases (the exit to the catalog, the save notices). */
export const t = (id, values) => i18n.t(id, values);

/**
 * Reads a bilingual field. Anything that isn't `{ pt, en }` comes back
 * untouched, so numbers and already-plain strings pass straight through.
 *
 * A field is resolved WHERE IT IS DRAWN, never stored resolved: the battle
 * notice used to keep the string it was built with and sat there for seven
 * seconds in the language the player had just left.
 */
export function pick(field) {
  if (field && typeof field === 'object' && !Array.isArray(field)) {
    if (field[i18n.lang] !== undefined) return field[i18n.lang];
    return field.en !== undefined ? field.en : field.pt;   // English is the default
  }
  return field;
}
