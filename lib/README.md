# slopkit

What every slop-games game needs before it can be a game: a viewport that
adapts, a loop that doesn't change behaviour with the monitor, a save that
survives the next version, a mute the player doesn't have to switch off twice,
and the two flags.

Nothing here draws anything — the artwork belongs to each game. The flags are
the one exception, and for a reason: they are the same everywhere.

## Why it exists

The four games in the catalog solved the same problems, each one its own way.
This package is the result of comparing the four implementations and keeping the
best of each:

| Piece | Came from | Why it won |
|---|---|---|
| elastic width | Animals vs Monsters | fills any aspect ratio without letterboxing or stretching |
| adaptive DPR ceiling | Zoo Tycoon | DPR 3 triples the fill area for no visible gain |
| fixed-step loop | Zoo Tycoon | it was the only one immune to frame-rate variation |
| one save format | Zoo Tycoon | the same snapshot serves the autosave and the file |
| save normalisation | Animals vs Monsters | an old save loses a field, never the run |
| persisted mute | 3 of the 4 games | Animals was the only one that forgot |
| dictionary keyed by phrase | new | with one object per language, a key vanishes in the other and nobody sees it |

## Usage

```js
import { createViewport, createLoop, createSave, createSound, createI18n } from 'slopkit';

const vp = createViewport(canvas);        // logical height 720, elastic width
vp.watch(() => reposition());             // only fires if the width really moves

const i18n = createI18n({
  dict: { play: { en: 'Play', pt: 'Jogar' } },   // both languages side by side
});

const vault = createSave({
  game: 'my-game',
  version: 1,
  initial: () => ({ version: 1, coins: 0 }),
  normalize: (raw, base) => ({ ...base, ...raw }),
  i18n,                                   // so the save notices speak the right language
});
let state = vault.load();

const sound = createSound({ game: 'my-game' });

createLoop({
  step: 1 / 60,
  update: (h) => world.tick(h),   // h is ALWAYS the same value
  draw: () => { vp.begin(); paint(vp.ctx); },
}).start();
```

## Modules

- **`slopkit/viewport`** — `createViewport`, `measure` (the pure arithmetic, testable with no browser)
- **`slopkit/loop`** — `createLoop`, `stepsFor` (same)
- **`slopkit/save`** — `createSave`, `downloadText`, `readTextFile`
  `vault.save(state)` answers **whether it wrote**, `true`/`false` — it does not
  hand the state back. `best = vault.save(...)` has now put the boolean `true`
  into a game's record twice: the card then read `best.score` as `undefined`,
  `clock(best.time)` as `NaN:NaN`, and every run after it compared against
  `undefined`. Keep the state you built, and save a copy of it.
- **`slopkit/sound`** — `createSound`
- **`slopkit/i18n`** — `createI18n`, `pickLang`, `interpolate`, `missingKeys`
- **`slopkit/flags`** — `drawFlag`, `flagDataURL` (flags drawn on a canvas)
- **`slopkit/langpicker`** — `mountLangPicker`, `bindText`, `drawLangPicker`, `pickLangAt`
- **`slopkit/build`** — the build every game here uses
- **`slopkit/testing`** — the game-testing scaffold (Node + puppeteer-core)

Pure functions exist on purpose: the arithmetic that matters fits in a test that
runs in milliseconds, with no Chrome. That holds for i18n too — `pickLang`,
`interpolate` and `missingKeys` are tested without a browser at all.

## The two languages

English is the product default. A browser asking for Portuguese still gets
Portuguese; the fallback only decides what a French or Japanese visitor sees.
The choice lives under a key the whole catalog shares (`slop:lang`), so picking
a flag on the index carries into the next game the player opens.

The dictionary is keyed **by phrase, not by language**:

```js
// right: a missing translation is visible on the line you are editing
{ play: { en: 'Play', pt: 'Jogar' } }

// wrong: `pt.play` can simply not exist, and you only find out when a
// player flips the flag and sees the raw key on screen
{ en: { play: 'Play' }, pt: { /* … */ } }
```

`missingKeys(dict)` turns that into a test. Use it.

## About the flags

Drawn on a canvas, not emoji. 🇧🇷 and 🇺🇸 are regional indicator pairs, and
Windows has no glyph for them: on the most common desktop OS in the world the
picker would render as the letters "BR" and "US" in a box. Twenty lines of
canvas beat that everywhere — and they keep rule nº 5 of the repository, which
forbids shipping an image.

One routine, two outputs: `drawFlag` paints into any 2D context (a game that
draws its menu on canvas) and `flagDataURL` runs the same routine on an
offscreen canvas so DOM menus can use it as an `<img>` source.

## Tests

```bash
npm test -w slopkit
```
