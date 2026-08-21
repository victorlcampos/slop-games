// Turns games/*/game.json into omarchy/Catalog.js, the list the QML panel reads.
//
// Why a generated file that is committed, when nothing else generated here is:
// the plugin *is* a git clone of this repository, and `omarchy plugin add`
// clones and never builds — it "never runs anything from the plugin, never
// executes an install hook". A clone therefore has no dist/ and no node_modules,
// so whatever the panel needs to draw ten rows in two languages has to be in
// git already. Catalog.js is that, and test/omarchy.test.mjs regenerates it in
// memory and compares, so it cannot drift away from game.json unnoticed.
//
// The published site is the fallback source for the games themselves — see
// Model.js, which prefers a copy on disk whenever it finds one.

/** Where the catalog lives when there is no copy on disk. No trailing slash. */
export const SITE = 'https://victorlcampos.github.io/slop-games';

/**
 * The first sentence of a description.
 *
 * A card on the index has room for three lines; a row in a shell panel has one.
 * The descriptions here are written with the interesting half up front and the
 * detail after the first full stop, so the cut lands where the author already
 * put a break. Anything without a full stop comes back whole.
 */
export function firstSentence(text) {
  const cut = String(text).search(/\.(\s|$)/);
  return cut === -1 ? String(text) : String(text).slice(0, cut + 1);
}

/** The rows the panel draws, in the order the index shows them. */
export function catalogRows(games) {
  return games
    .slice()
    .sort((a, b) => a.name.en.localeCompare(b.name.en, 'en'))
    .map((game) => ({
      slug: game.slug,
      emoji: game.emoji,
      offline: game.offline !== false,
      name: { en: game.name.en, pt: game.name.pt },
      blurb: { en: firstSentence(game.description.en), pt: firstSentence(game.description.pt) },
    }));
}

/**
 * The file itself. Plain `var` at top level, no import and no export: that is
 * what QML's `import "Catalog.js" as Catalog` can read, and it is also what a
 * node:vm context can evaluate — which is how the test reads it back.
 */
export function renderCatalog(games) {
  const rows = catalogRows(games);
  return `// Generated from games/*/game.json — do not edit by hand.
//
// Run \`npm run omarchy\` (any \`npm run build\` does it too) to regenerate it.
// The plugin is a clone of this repository and a clone never builds, so the ten
// names and their two languages have to be committed, not produced on install.

var SITE = ${JSON.stringify(SITE)}

var GAMES = ${JSON.stringify(rows, null, 2)}
`;
}
