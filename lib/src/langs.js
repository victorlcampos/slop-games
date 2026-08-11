// The two languages the catalog ships, and nothing else.
//
// Its own file because both the logic (`i18n.js`) and the drawing (`flags.js`)
// need the list, and neither should have to import the other to get it.
//
// English first: it is the product's default. A browser asking for Portuguese
// still gets Portuguese — the fallback only decides what a French or Japanese
// visitor sees, and what a half-filled dictionary falls back to.

export const LANGS = ['en', 'pt'];

export const FALLBACK = 'en';

/** What each flag button says out loud, for screen readers and tooltips. */
export const LANG_NAMES = {
  en: { label: 'English', tag: 'en-US' },
  pt: { label: 'Português', tag: 'pt-BR' },
};
