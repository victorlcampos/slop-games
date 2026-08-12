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

// The offline cache. It is the catalog's job because the catalog is the app:
// one registration here takes the index and all five games with it, so an
// installed icon opens on a plane exactly as it does on wifi.
//
// **`'serviceWorker' in navigator` is not the guard it looks like.** Over
// `file://` the property is there — and `isSecureContext` is even true — so the
// registration goes ahead and throws `The URL protocol of the current origin
// ('null') is not supported`, an uncaught error on the console of every double
// click. The protocol is what actually decides this; the catch covers a browser
// that refuses for its own reasons. Registration waits for `load` so it never
// competes with the page for the connection.
if (location.protocol.startsWith('http') && 'serviceWorker' in navigator) {
  addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

// the tests drive the page through this, the same bridge every game exposes
window.__game = { name: 'slop-games', i18n };
