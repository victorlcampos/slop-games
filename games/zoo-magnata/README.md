# 🦁 Zoo Tycoon

A zoo tycoon that runs **entirely in the browser**, in a single HTML file, with
no external dependencies and no server. It works offline.

▶️ **[Play](https://victorlcampos.github.io/slop-games/zoo-magnata/)**

Plays in **English and Portuguese** — the flags sit next to the exit on the
splash screen, and the choice carries over from the catalog.

---

## What's in it

- **219 species**, each with a biome, a diet, the space it needs, a group size,
  a lifespan, a danger level and a price. Not one sprite is an image: they are
  all drawn in code from 28 parameterised body plans, with 6 animation frames.
- **Scenery with a finish**: paths form a continuous band with a kerb that
  curves at the turns, merge into plazas (with a paved medallion at the centre),
  widen into a viewing spot against an enclosure fence, and become a wooden
  bridge over water. Near a shop the pavement fans out to the door — centred on
  the façade — with a doormat in the shop's colour, windows, a striped awning,
  eaves and a chimney. Bench, bin, drinking fountain and playground are actually
  drawn, not boxes with an emoji on them. Biomes meet in organic fringes (foam
  at the waterline, canopy in the woods, flowers and pebbles in the grass, lily
  pads in shallow water, packed dirt in the enclosures), and the map is a
  plateau with an earth embankment at its edges.
- **A world that moves**: clouds shade the ground, the water glitters and fish
  jump in the deep pools, tree crowns sway in the breeze, butterflies circle the
  flower beds (fireflies at night), birds cross the sky, the playground swing
  swings, the fountain sprays, electric fences spark and smoke rises off the
  kitchens. Visitors turn to face the enclosure or the shop they are using. At
  night: a starry sky, lit windows and pools of light under the lamp posts.
- **Animals interact with the enclosure**: whoever enters the water **swims** —
  body submerged to the waterline, bobbing, a V-shaped wake and reduced speed
  (aquatic species take off; waders wade with their legs out). Every so often
  the stroll turns into play: the animal walks to the ball, the log or the pool,
  jumps facing the toy (a ⚽ bubble) and the ball bounces frantically; in the
  pool it soaks. Whoever eats drops crumbs from its snout.
- **Free-form enclosures** — drag to create, drag against one to extend it. You
  can make an L, a T, a U, even an enclosure with a hole in the middle. The
  fence is derived from the edges, so every tile you pay for becomes usable area.
- **Happiness broken into 8 weighted factors** (space, biome, company,
  enrichment, cleanliness, health, food, fence suitability). The inspector shows
  them item by item, so you can find out what to fix.
- **A full life cycle**: with an adult male and female of the species, happy and
  with room in the enclosure, calves are born — drawn smaller until they grow.
  Short-lived, herd species breed faster; vets on the payroll speed the breeding
  programme up. A pregnant animal shows 🤰 in its bubble and on its card.
- **The manager's alert bar**: escapes, illness, critical health, enclosures with
  no food or water, fences about to give, animals at the end of their lives —
  grouped by kind; clicking centres the camera on the case (and cycles through
  them).
- **Undo purchases** (↩️ in the HUD or Ctrl+Z): the last 5 purchases — path,
  terrain, enclosure, extension, objects, animals, fence swap — come back with a
  full refund. A whole stroke of path counts as one action, and the game refuses
  to undo anything that would leave an animal without an enclosure.
- **A reputation statement**: clicking ⭐ opens the score broken down — the
  continuous assessment (welfare, satisfaction, variety, litter, escapes, with
  the real weights) and the history of shocks (deaths, escapes, births, public
  ratings).
- **Thought bubbles** over animals and visitors, with icons chosen to *teach*: a
  hungry animal thinks about the food in its own diet (🥩 lion, 🥬 giraffe) and
  one in the wrong biome shows the biome it wants (🧊 for a polar bear on grass).
- **Visitors** with hunger, thirst, a bladder, tiredness and a need for fun, real
  pathfinding on the walkways and price-sensitive buying decisions. Their mood
  becomes reputation, which controls how many people turn up.
- **An economy**: tickets, 15 kinds of shop with a per-shop adjustable price, 4
  staff roles, weekly bills, a loan with interest, marketing, bankruptcy.
- **A satisfaction report** that ranks the reasons for unhappiness with an
  actionable hint on every line.
- Save/load in the browser, **save export as `.json`** and a **status report as
  `.txt`**, with import back.
- **Sound synthesised end to end** (Web Audio, not one audio file): 22 vocal
  gestures — roar, howl, trumpet, chirp, hiss, croak… — assigned by family, with
  per-species exceptions (the zebra barks, the fox barks, the giraffe snorts).
  Size pulls the pitch and the name seeds the timbre, so two species sharing a
  gesture never sound alike. Clicking an animal, a visitor or a staff member
  makes them answer. The 🔊 button in the HUD cycles full / low / mute (shortcut
  `S`).
- **A human voice by formant synthesis** (Klatt): a cascade of 5 resonators over
  a glottal pulse train, with formant frequencies from Peterson & Barney (1952),
  aspiration to fill the spectrum, ~0.3% jitter and a syllable envelope (a ~60 ms
  transition and a sustained target).
- Responsive: touch, pinch to zoom, and three layout arrangements (phone
  upright, phone landscape, desktop).

## Why Canvas 2D and not three.js

Zoo Tycoon is isometric 2D. Plain Canvas 2D gave three decisive advantages here:

1. **Zero dependencies** — the file really does run offline, with no CDN.
2. **219 visually distinct animals** generated procedurally. In procedural 3D
   they would all become generic blobs.
3. The cartoon outline with a heavy stroke is native to Canvas 2D.

## Structure

The game ships as **one** `index.html`, but it is edited in modules:

| file | contents |
|---|---|
| `src/01_i18n.js` | the two languages: `LN`, `BI`, `TX` |
| `src/02_util.js` | utilities, world constants |
| `src/03_species.js` | the 219-species catalogue |
| `src/04_sprites.js` | the procedural sprite generator |
| `src/05_world.js` | grid, enclosures, paths |
| `src/06_entities.js` | animals, visitors, staff |
| `src/06b_audio.js` | audio synthesis (voices, effects, ambience) |
| `src/07_render.js` | isometric rendering |
| `src/08_ui.js` | interface |
| `src/09_game.js` | input, simulation, economy, save |

```bash
npm run build   # regenerates dist/index.html from src/
```

Don't edit `dist/index.html` directly — it is generated.

## How the audio is verified

Ears don't fit in a development loop, and "I measured it and it looked fine" has
fooled me here more than once: you can prove numerically that a sound has the
right structure and still have it not sound like the thing. So the check is
**comparative** — a real recording on one side, the synthesis on the other, the
same STFT, and the difference shows up.

```bash
tools/gerar-referencias.sh    # voice via macOS `say`; animals from Wikimedia Commons
python3 -m http.server 8000
# tools/comparar.html  → real human voice vs synthesised
# tools/animais.html   → 14 animal recordings vs the matching gesture
# tools/espectro.html  → the synthesis alone, for isolated inspection
```

Each panel prints the energy in four bands (0–0.5 / 0.5–1.5 / 1.5–3 / 3–5 kHz).
It was that comparison that knocked down three of my assumptions: the voice was
far too bright (25–30% above 1.5 kHz, against 1–5% in real speech), the spectrum
was thin lines instead of continuous bands (aspiration was missing), and nearly
every animal was too low — a real bear growl concentrates 89% of its energy
between 500 and 1500 Hz, it is not sub-bass. The reference recordings are not
committed.

## Running locally

Opening `dist/index.html` in a browser already works. Serving it over HTTP is
better: over `file://` the browser treats each file as an isolated origin, which
makes `localStorage` (where the autosave lives) less reliable.

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Licence

MIT
