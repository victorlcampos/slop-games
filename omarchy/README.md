# slop-games, as an Omarchy plugin

The whole catalog on the bar. One icon, ten games, each one opening in its own
window with no tabs and no address bar.

```
omarchy plugin add https://github.com/victorlcampos/slop-games.git --enable
```

That is the whole install. It clones this repository into
`~/.config/omarchy/plugins/victorlcampos.slop-games/`, validates
`manifest.json`, and asks where on the bar you want it.

## What you get

A gamepad icon on the bar. Click it and the ten games are there, each with its
name and one line about it; click one and it opens. `↑↓` or `j/k` walk the list,
`⏎` plays, `Esc` closes, `Tab` moves to the next panel on the bar.

For a keybind instead of a click, the panel answers on IPC:

```
bind = SUPER, G, exec, omarchy-shell slop-games toggle
```

The footer has two more things: **Open the catalog**, which opens the index with
all ten cards, and **EN / PT**. The panel starts in the language your desktop
asks for — a `pt_*` locale gets Portuguese, everything else gets English, which
is the product default — and the buttons override that. The choice is written
into `~/.config/omarchy/shell.json` next to the widget, so it survives a
restart.

## Where the games come from

`omarchy plugin add` clones and stops there. It "never runs anything from the
plugin, never executes an install hook", which is the right call for something
that runs unsandboxed inside your shell — and it means a fresh install has the
ten `game.json` but none of the ten built HTML files.

So the panel probes, in this order, and takes the first that is really there:

| | Where | Who puts it there |
|---|---|---|
| 1 | `$SLOP_GAMES_DIR` | you, for a checkout somewhere else |
| 2 | `<plugin>/dist` | a `dist/` copied into the installed clone |
| 3 | `~/.local/share/slop-games` | `npm run omarchy:install` |
| 4 | https://victorlcampos.github.io/slop-games/ | the fallback, always there |

> **Don't `npm install` inside the installed plugin.** npm workspaces links
> `slopkit` into `node_modules` as a symlink, and `omarchy plugin validate`
> refuses a symlink anywhere inside a plugin folder — which is the check
> `omarchy plugin update` runs before it accepts a new revision. Build in your
> own checkout and use option 1 or 3.

The fallback is not a downgrade. The published catalog is a PWA whose service
worker precaches every game on the first open, so: you had a connection when you
installed the plugin, the first game you open caches all ten, and it is offline
from then on. The footer says which one you are on — *playing from disk* or
*playing from the web*.

To play from your own checkout instead:

```bash
npm run build
npm run omarchy:install     # copies dist/ to ~/.local/share/slop-games
```

The panel probes again on every open, so there is nothing to restart.

A copy, not a symlink, and on purpose: `omarchy plugin validate` refuses a
symlink anywhere inside a plugin folder, and option 2 above puts one right next
to the manifest.

## Why it launches a browser instead of drawing the game

Quickshell has no web engine, and every game here is a canvas in an HTML file.
`omarchy-launch-webapp` runs your default browser with `--app=`, which is a
window with no tabs, no address bar and no bookmarks — as close to "the game is
an application" as a single HTML file gets, and closer than a browser tab.

## Working on it

The plugin is three files next to this one:

| | |
|---|---|
| `Panel.qml` | the bar button and the popup, in one entry point — the shape seven first-party widgets use |
| `Model.js` | every rule with no QML in it: which language, which URL, where the cursor goes |
| `Catalog.js` | generated from `games/*/game.json` by `npm run omarchy`, and committed, because a clone never builds |

`Model.js` is split off the panel so the test can load it — `test/omarchy.test.mjs`
runs it in a `node:vm` context and checks the rules without a compositor, the
same trick `games/zoo-magnata/test` uses on a game that lives in global scope.
The test also mirrors what `omarchy-plugin-validate` checks, so a bad manifest
fails here instead of on somebody else's desktop.

```bash
npm test                          # includes the plugin's floor
omarchy plugin validate .         # the real thing, on an Omarchy box
```

Saving any file under `~/.config/omarchy/plugins/` reloads the plugin, so the
edit loop is: clone the repo there, or symlink your checkout in (outside the
plugins directory), and watch the panel redraw.

### The lap by hand

The suite has no eyes — CLAUDE.md section 6 says why. What a person has to look
at, on an actual Omarchy desktop:

1. the icon is on the bar and the panel opens under it
2. the ten rows read, in both languages, with the flag buttons flipping them
3. a click opens a game in its own window
4. **Open the catalog** opens the index
5. the footer says *from disk* after `npm run omarchy:install`, and *from the
   web* before it
6. `omarchy-shell slop-games toggle` opens and closes it

## Updating and removing

```
omarchy plugin update victorlcampos.slop-games
omarchy plugin remove victorlcampos.slop-games
```

`update` is a fast-forward pull of the same checkout, and it validates the new
revision before accepting it. Both of those are reasons to leave the installed
clone alone: local changes block the pull, and a `node_modules` from an
`npm install` in there fails the validation on a symlink. `npm run
omarchy:install` writes outside the plugin folder for exactly that reason.

MIT, same as the rest of the repository.
