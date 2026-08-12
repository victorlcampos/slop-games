# WorldDrive 🌍🏎️

### ▶️ [Play now](https://victorlcampos.github.io/slop-games/worlddrive/)

A driving game in the browser: pick **any street in the world** and drive down
it. The 3D world is generated on the spot from real data:

- **Streets, buildings and trees** — OpenStreetMap (Overpass API, 4 mirrors with retry)
- **Elevation** — AWS Terrain Tiles / terrarium format (SRTM and friends, z15)
- **Ground** — Esri World Imagery satellite tiles (z17–19 mosaic)
- **Place search** — Photon, falling back to Nominatim

Everything runs **100% on the client**: the deliverable is a single file —
**`dist/index.html`** (~596 KB) — that opens on a **double click** (`file://`),
with no server. Every provider above answers `Access-Control-Allow-Origin: *`,
including for a `null` origin (verified). The internet is only needed while an
area loads.

The game speaks **English and Portuguese** — the flags sit next to the exit on
the menu screen.

## Build

```sh
npm install
node build.mjs        # produces dist/index.html (three.js bundled inline into the template)
```

## Tests

```sh
npm test --workspace games/worlddrive    # the projection, the street index, the car — in Node
```

There is no browser test any more, and no smoke test against the real Overpass
API. The first went with the rest of the suite (CLAUDE.md, section 6 — CI has no
graphics card, so a scenario that held the throttle measured the renderer); the
second was always a bad gate, since a public server that queues and rate-limits
cannot decide whether the catalog ships. Driving a real city is checked by hand
before a deploy.

## Controls

W/A/S/D or arrows · **space** handbrake (drift) · **R** back to the street ·
**N** reloads the world where you are (drive "forever" by hopping) · **C**
cameras · **M** sound · **Esc** menu. On touch screens the buttons appear on
screen.

## Architecture (src/)

`geo` projections/tiles · `net` fetch/pool · `overpass` OSM query+parse ·
`terrain` terrarium heightmap · `satellite` Esri mosaic · `roads` asphalt
ribbons + spatial index · `buildings` extrusion + collision · `trees` instancing
· `world` orchestrates it all · `car` arcade physics (bicycle model, substeps,
slopes, circle×wall collision) · `main` three.js, cameras, loop, automatic
quality · `ui`/`picker`/`minimap`/`audio`/`input`/`i18n`.

## Known limitations

- Roughly a 1.3×1.3 km area at a time (**N** reloads it centred on you).
- Bridges and tunnels are flattened onto the terrain (tunnels are omitted).
- Elevation at z15 (~5 m/px): real hills show up, fine detail (kerbs, flyovers) does not.
- The public Overpass mirrors have load spikes; the game tries 4 mirrors × 2 rounds.
