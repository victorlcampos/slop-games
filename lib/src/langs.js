// The two languages the catalog ships, and nothing else.
//
// Its own file because both the logic (`i18n.js`) and the drawing (`flags.js`)
// need the list, and neither should have to import the other to get it.

export const LANGS = ['pt', 'en'];

export const FALLBACK = 'pt';

/** What each flag button says out loud, for screen readers and tooltips. */
export const LANG_NAMES = {
  pt: { label: 'Português', tag: 'pt-BR' },
  en: { label: 'English', tag: 'en-US' },
};
