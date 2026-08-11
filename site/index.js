// The catalog page: two flags and the text that follows them.
//
// Everything on this page is written inline (`data-pt` / `data-en`), including
// the cards the build generates — so the page reads correctly before this
// script runs, and switching flags is a swap, not a render.
//
// The chosen language lives under a key shared with every game, so picking
// English here means English in whatever the player opens next.

import { createI18n, mountLangPicker, bindText } from 'slopkit';

const i18n = createI18n();

mountLangPicker(i18n, { width: 30 });
bindText(i18n);

// the tab title is the one string HTML can't carry twice
const TITLE = { pt: 'slop-games — jogos que abrem com dois cliques', en: 'slop-games — games that open on a double click' };
const applyTitle = () => {
  document.title = TITLE[i18n.lang] || TITLE.en;
};
applyTitle();
i18n.onChange(applyTitle);

// the tests drive the page through this, the same bridge every game exposes
window.__game = { name: 'slop-games', i18n };
