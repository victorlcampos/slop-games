// Everything the panel decides, with no QML in it.
//
// Same split the first-party plugins use (clock/Model.js says so out loud): the
// QML owns pixels and Qt types, this file owns rules — which language, which
// URL, where the cursor goes. That is what lets test/omarchy.test.mjs load this
// exact file into a node:vm context and check the rules without a shell, a
// compositor or a browser, the way every other test in this repo runs.
//
// Plain `var`/`function` at top level, no import and no export: it is read by
// QML's `import "Model.js" as Model` and by a vm context, and neither of those
// speaks ESM.

// ---------------------------------------------------------------- language
//
// Dictionary keyed by phrase, not by language — CLAUDE.md section 2c, and for
// the reason written there: with one object per language a key can exist on one
// side and quietly vanish from the other. Here the missing half is on the line
// you are editing, and missingKeys() in the test turns that into a failure.
var TEXT = {
  subtitle: { en: '{n} games · one HTML file each', pt: '{n} jogos · um arquivo HTML cada' },
  openCatalog: { en: 'Open the catalog', pt: 'Abrir o catálogo' },
  needsNetwork: { en: 'needs network', pt: 'precisa de rede' },
  fromDisk: { en: 'playing from disk', pt: 'jogando do disco' },
  fromWeb: { en: 'playing from the web', pt: 'jogando da web' },
  hint: { en: '↑↓ pick · ⏎ play', pt: '↑↓ escolher · ⏎ jogar' },
  tooltip: { en: 'slop-games', pt: 'slop-games' }
}

/**
 * Which language to draw in.
 *
 * English is the product default (CLAUDE.md, section 2c): a browser — or here a
 * desktop — asking for Portuguese gets Portuguese, and everyone else gets
 * English. `override` is what the flag buttons in the footer write into
 * shell.json; empty means "follow the system".
 */
function language(localeName, override) {
  if (override === 'pt' || override === 'en') return override
  return String(localeName || '').toLowerCase().indexOf('pt') === 0 ? 'pt' : 'en'
}

/** One side of a `{ en, pt }` pair, falling back to the product default. */
function pick(field, lang) {
  if (!field) return ''
  return field[lang] || field.en || ''
}

/** A phrase from TEXT, with `{n}`-style holes filled in. */
function t(key, lang, vars) {
  var phrase = pick(TEXT[key], lang)
  if (!vars) return phrase
  return phrase.replace(/\{(\w+)\}/g, function (whole, name) {
    return vars[name] === undefined ? whole : String(vars[name])
  })
}

// -------------------------------------------------------------- where it is
//
// The plugin is a clone of the repository, so a clone has the ten game.json but
// none of the ten built HTML files — `omarchy plugin add` never runs a build.
// So the panel looks for a copy on disk and falls back to the published site,
// which is a PWA whose worker precaches the whole catalog on first open. In
// practice: you had a connection when you installed the plugin, the first game
// you open caches all ten, and it is offline from then on.

/** The bash that picks the first candidate that is really there.
 *
 *  Candidates arrive as arguments, never interpolated into the script: a path
 *  with a space or a quote in it is then just an argv entry, and there is no
 *  escaping to get wrong. `index.html` is the marker because it is the catalog
 *  itself — a directory with it is a built dist/, not a random folder. */
var PROBE = 'for d in "$@"; do [ -n "$d" ] && [ -f "$d/index.html" ] && { printf %s "$d"; exit 0; }; done; exit 1'

/** Where a local copy of the built catalog might be, best first. */
function rootCandidates(pluginDir, envDir, homeDir) {
  var out = []
  if (envDir) out.push(stripSlash(envDir))
  if (pluginDir) out.push(stripSlash(pluginDir) + '/dist')
  if (homeDir) out.push(stripSlash(homeDir) + '/.local/share/slop-games')
  return out
}

/** The Process command that runs PROBE over those candidates. */
function probeCommand(candidates) {
  return ['bash', '-c', PROBE, 'slop-games'].concat(candidates)
}

function stripSlash(path) {
  return String(path).replace(/\/+$/, '')
}

/** True when `root` is a directory on disk rather than a published site. */
function isLocal(root) {
  return !!root && String(root).indexOf('http') !== 0
}

/** A directory path out of the `file:///…/` URL QML hands back. */
function dirFromUrl(url) {
  var path = String(url).replace(/^file:\/\//, '').replace(/\/+$/, '')
  try {
    return decodeURIComponent(path)
  } catch (e) {
    return path
  }
}

/** The folder above — Panel.qml lives in omarchy/, the games do not. */
function parentDir(path) {
  var trimmed = stripSlash(path)
  var cut = trimmed.lastIndexOf('/')
  return cut <= 0 ? '/' : trimmed.slice(0, cut)
}

/** What to hand the browser for one game. */
function gameUrl(slug, root, site) {
  if (isLocal(root)) return fileUrl(stripSlash(root) + '/' + slug + '/index.html')
  return stripSlash(root || site) + '/' + slug + '/'
}

/** …and for the index that lists all of them. */
function catalogUrl(root, site) {
  if (isLocal(root)) return fileUrl(stripSlash(root) + '/index.html')
  return stripSlash(root || site) + '/'
}

// encodeURI, not encodeURIComponent: the separators have to survive, only the
// spaces and accents in somebody's home directory need escaping.
function fileUrl(path) {
  return 'file://' + encodeURI(path)
}

/**
 * The command that opens it.
 *
 * omarchy-launch-webapp reads the default browser out of xdg-settings and runs
 * it with --app=, which is a window with no tabs, no address bar and no
 * bookmarks — a game in a window, which is the whole point of opening it from
 * the shell instead of a browser tab.
 */
function launchCommand(url) {
  return ['omarchy-launch-webapp', url]
}

// ------------------------------------------------------------------- cursor

/** j/k and the arrows, wrapping at both ends. */
function moveCursor(index, delta, count) {
  if (count <= 0) return 0
  var next = (index + delta) % count
  return next < 0 ? next + count : next
}
