// The build for every game in slop-games.
//
// The four games used to bundle three different ways: esbuild, a homegrown
// 150-line ES bundler, and `cat` over numbered files. Each with its own traps,
// and the same two scars repeated in two of them. Here it is one build, with
// two modes:
//
//   mode 'modules'  ESM entry point, esbuild resolves the imports (the normal case)
//   mode 'concat'   global-scope files, in order (Zoo Tycoon)
//
// Either way the result is the same: a `dist/index.html` that opens on a double
// click, minified, without a single reference to an outside file.
//
// The two traps, which apply to both modes:
//
//   1. A `</script>` inside the bundle closes the tag mid-game. It must be escaped.
//   2. `String.replace` interprets `$&` and `$1` in the replacement text — and
//      every minified bundle contains those characters. That is why the
//      substitution is always done with a function.

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const MARK = '/*__APP__*/';

/**
 * @param {object} cfg
 * @param {string} cfg.root        the game's folder (use import.meta.dirname)
 * @param {string} [cfg.mode]      'modules' (default) or 'concat'
 * @param {string} [cfg.entry]     modules mode: entry file
 * @param {string[]} [cfg.files]   concat mode: in exact order
 * @param {string} [cfg.template]  HTML carrying the /*__APP__*\/ mark
 * @param {object} [cfg.alias]     import aliases (e.g. three → vendor)
 * @param {object} [cfg.globals]   concat mode: packages to expose as globals
 * @param {boolean} [cfg.minify]   default true
 * @param {string} [cfg.footer]    text appended to the bundle
 * @param {object} [cfg.pwa]       { name, short, emoji, color, background } — installable
 * @param {object} [cfg.replace]   extra placeholder → text swaps in the template
 */
export async function build(cfg) {
  const {
    root,
    mode = 'modules',
    entry = 'src/main.js',
    files = [],
    template = 'template.html',
    alias = {},
    globals = {},
    minify = true,
    footer = '',
    pwa = null,
    replace = {},
    out = 'dist/index.html',
  } = cfg;

  if (!root) throw new Error('build: missing `root` (pass import.meta.dirname)');
  const fromRoot = (p) => path.resolve(root, p);

  let js =
    mode === 'concat'
      ? await bundleConcat(fromRoot, files, globals, minify)
      : await bundleModules(fromRoot, entry, alias, minify);

  if (footer) js += '\n' + footer;

  // 1st trap: the bundle must not close its own tag
  js = js.replace(/<\/script>/gi, '<\\/script>');

  let tpl = fs.readFileSync(fromRoot(template), 'utf8');
  if (!tpl.includes(MARK)) {
    throw new Error(`${template}: missing the ${MARK} mark where the bundle goes`);
  }
  // `pwa: true` pulls name, emoji and description from game.json — so there
  // aren't two places saying what the game is called
  const pwaData = pwa === true ? readGameJson(fromRoot) : pwa;
  if (pwaData) tpl = injectPWA(tpl, pwaData);
  // 2nd trap: a function, never a string — the bundle contains $& and $1, and so
  // does any generated markup handed in through `replace`
  for (const [mark, text] of Object.entries(replace)) {
    if (!tpl.includes(mark)) throw new Error(`${template}: missing the ${mark} placeholder`);
    tpl = tpl.replace(mark, () => text);
  }
  const html = tpl.replace(MARK, () => js);

  checkSelfContained(html);

  fs.mkdirSync(fromRoot(path.dirname(out)), { recursive: true });
  fs.writeFileSync(fromRoot(out), html);

  const kb = (html.length / 1024).toFixed(0);
  console.log(`${out} generated: ${kb} KB`);
  return { html, bytes: html.length };
}

/** Normal mode: esbuild resolves imports from an ESM entry point. */
async function bundleModules(fromRoot, entry, alias, minify) {
  const res = await esbuild.build({
    entryPoints: [fromRoot(entry)],
    bundle: true,
    minify,
    format: 'iife',
    target: ['es2020'],
    write: false,
    logLevel: 'warning',
    alias: Object.fromEntries(Object.entries(alias).map(([k, v]) => [k, fromRoot(v)])),
  });
  return res.outputFiles[0].text;
}

/**
 * Zoo Tycoon's mode: files that share a global scope and depend on order.
 * There are no imports to resolve — but everything can still be minified
 * together, and ESM packages (slopkit) can be hung off a global first, which
 * gives those games access to the kit without rewriting their whole scope.
 */
async function bundleConcat(fromRoot, files, globals, minify) {
  let prefix = '';
  for (const [globalName, pkg] of Object.entries(globals)) {
    const iife = await esbuild.build({
      stdin: {
        contents: `import * as m from ${JSON.stringify(pkg)}; window.${globalName} = m;`,
        resolveDir: fromRoot('.'),
        loader: 'js',
      },
      bundle: true,
      minify,
      format: 'iife',
      target: ['es2020'],
      write: false,
      logLevel: 'warning',
    });
    prefix += iife.outputFiles[0].text + '\n';
  }

  const body = files.map((f) => fs.readFileSync(fromRoot(f), 'utf8')).join('\n');
  if (!minify) return prefix + body;

  // the body is a classic script (no import/export): minify without bundling
  const min = await esbuild.transform(body, { minify: true, target: 'es2020', loader: 'js' });
  return prefix + min.code;
}

/**
 * game.json metadata, in the shape the manifest expects.
 *
 * Name and description are bilingual objects; a web app manifest only holds one
 * string, and the installed icon's label can't change when the player flips the
 * flag. So the manifest speaks the fallback language, and the in-game `<title>`
 * — which JavaScript *can* update — is what follows the player's choice.
 */
function readGameJson(fromRoot) {
  try {
    const g = JSON.parse(fs.readFileSync(fromRoot('game.json'), 'utf8'));
    const pick = (v) => (v && typeof v === 'object' ? v.pt || v.en : v);
    return {
      name: pick(g.name),
      short: pick(g.name),
      emoji: g.emoji,
      description: pick(g.description),
      // only those who need it declare this: forcing landscape on a game that
      // plays fine upright just locks the player's device for nothing
      orientation: g.orientation,
    };
  } catch {
    return null;
  }
}

/**
 * Makes the game installable on a phone's home screen without breaking the
 * single-file rule: the manifest is embedded as a `data:` URI, and the icon is
 * an SVG carrying the game's emoji — also embedded.
 *
 * There is no service worker, and none is missed: the whole game is already one
 * HTML file with nothing to fetch. A SW here would exist only to cache what is
 * already cached. What remains has a real effect: adding it to the home screen
 * opens it full-screen, with no browser chrome, under its own icon and name.
 */
function injectPWA(tpl, pwa) {
  const {
    name,
    short = name,
    emoji = '🎮',
    background = '#16130f',
    description = '',
    orientation = 'any',
    // a game takes the whole screen; the catalog stays `standalone` so the
    // player keeps the system status bar — clock and battery — while browsing
    display = 'fullscreen',
  } = pwa;

  // if the game already declared a theme colour it wins: whoever wrote the HTML
  // knows better than this build what the game looks like
  const hasTheme = /<meta[^>]+name=["']theme-color["']/i.test(tpl);
  const themeColor = (tpl.match(/<meta[^>]+name=["']theme-color["'][^>]*content=["']([^"']+)/i) || [])[1];
  const color = pwa.color || themeColor || background;

  const icon = (size) =>
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
        `<rect width="${size}" height="${size}" fill="${background}"/>` +
        `<text x="50%" y="50%" dy=".1em" font-size="${Math.round(size * 0.62)}" ` +
        `text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`
    );

  const manifest = {
    name,
    short_name: short,
    description,
    start_url: './',
    scope: './',
    display,
    orientation,
    background_color: background,
    theme_color: color,
    icons: [
      { src: icon(192), sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: icon(512), sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };

  const tags = [
    `<link rel="manifest" href="data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}">`,
    ...(hasTheme ? [] : [`<meta name="theme-color" content="${color}">`]),
    // iOS Safari ignores the manifest and reads these three
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    `<meta name="apple-mobile-web-app-title" content="${short}">`,
    `<link rel="apple-touch-icon" href="${icon(180)}">`,
    '<meta name="mobile-web-app-capable" content="yes">',
  ].join('\n');

  return tpl.replace('</head>', tags + '\n</head>');
}

/** Rule nº 2 of CLAUDE.md, enforced here: one file, nothing from outside. */
function checkSelfContained(html) {
  const external =
    html.match(/<script\b[^>]*\bsrc=["']?(?!data:)[^"'>\s]+/i) ||
    html.match(/<link\b[^>]*\bstylesheet[^>]*\bhref=["']?(?!data:)[^"'>\s]+/i) ||
    html.match(/<link\b[^>]*\bhref=["']?(?!data:|#)[^"'>\s]+[^>]*\bstylesheet/i);
  if (external) {
    throw new Error(
      `the final HTML loads an external resource (${external[0].slice(0, 60)}…) — ` +
        'the game has to be a single file, or it will not open over file://'
    );
  }
}
