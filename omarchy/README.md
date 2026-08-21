# slop-games — the catalog on your Omarchy bar

Ten browser games, one HTML file each, behind a gamepad on the bar. Click one
and it opens in its own window — no tabs, no address bar.

```bash
omarchy plugin add https://github.com/victorlcampos/omarchy-slop-games.git --enable
```

## Using it

A gamepad icon appears on the bar. Click it and the ten games are there, each
with its name and one line about it. `↑↓` or `j/k` walk the list, `⏎` plays,
`Esc` closes, `Tab` moves to the next panel on the bar.

For a keybind instead of a click, the panel answers on IPC:

```
bind = SUPER, G, exec, omarchy-shell slop-games toggle
```

The footer has **Open the catalog**, which opens the index with all ten cards,
and **EN / PT**. The panel starts in the language your desktop asks for — a
`pt_*` locale gets Portuguese, everything else English — and those two buttons
override it.

## Removing it

```bash
omarchy plugin update victorlcampos.slop-games   # fast-forward the checkout
omarchy plugin remove victorlcampos.slop-games   # disable and delete it
```

Removal takes the plugin's own folder and its entry in `shell.json`. If you also
used the optional local copy of the games (below), delete
`~/.local/share/slop-games` yourself — it is outside the plugin and nothing else
touches it.

## What it needs, and what it writes

**External dependencies: none beyond Omarchy itself.** The panel runs
`omarchy-launch-webapp`, which ships with Omarchy and opens your default browser
with `--app=`, plus one `bash -c` line to detect whether you have a local copy of
the games. No package install, no download at runtime, no service of its own, no
sudo, no network calls from the plugin.

**Configuration:** the only thing it ever writes is the EN/PT choice, into this
widget's own entry in `~/.config/omarchy/shell.json`, and only when you click one
of those two buttons. It touches no other configuration and overwrites nothing.

## Where the games come from

The plugin carries the ten names, not the ten games. It looks for them in order
and takes the first that is really there:

| | Where | Who puts it there |
|---|---|---|
| 1 | `$SLOP_GAMES_DIR` | you, pointing at a build of your own |
| 2 | `<plugin>/dist` | a `dist/` copied into the installed plugin |
| 3 | `~/.local/share/slop-games` | `npm run omarchy:install` in the source repo |
| 4 | https://victorlcampos.github.io/slop-games/ | the fallback, always there |

The fallback is not a downgrade: the published catalog is a PWA whose service
worker precaches every game on the first open, so after one game the whole
catalog works with no connection. The footer tells you which one you are on —
*playing from disk* or *playing from the web*.

To play from your own build instead:

```bash
git clone https://github.com/victorlcampos/slop-games.git
cd slop-games && npm install
npm run build
npm run omarchy:install     # copies dist/ to ~/.local/share/slop-games
```

The panel probes again every time it opens, so there is nothing to restart.

> Don't `npm install` inside the installed plugin folder. npm workspaces link
> packages as symlinks, and `omarchy plugin validate` — which
> `omarchy plugin update` runs before accepting a new revision — refuses a
> symlink anywhere inside a plugin folder.

## Why it launches a browser

Quickshell has no web engine, and every game here is a canvas in an HTML file.
`omarchy-launch-webapp` gives it a window with no tabs and no address bar, which
is as close to "the game is an application" as a single HTML file gets, and
closer than a browser tab.

## This repository is generated

The source lives in **[victorlcampos/slop-games](https://github.com/victorlcampos/slop-games)**,
under `omarchy/`, next to the games themselves. `npm run omarchy:publish` there
assembles this repository; `Catalog.js` is generated from the games' own
metadata, so the panel and the catalog can never disagree about what exists.

Open issues and pull requests against that repository.

MIT — see `LICENSE`.
