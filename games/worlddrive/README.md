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

## Smoke test

```sh
node test/smoke.mjs               # headless Chrome: opens over file://, loads San Francisco and drives
PRESET=2 node test/smoke.mjs      # 0=San Francisco 1=Monaco 2=Rio 3=Paris 4=Tokyo 5=NY
URL=https://victorlcampos.github.io/slop-games/worlddrive/ node test/smoke.mjs   # test the published deploy
```

Note: the main Overpass mirror rejects the "HeadlessChrome" fingerprint (406),
so the test disguises the UA and the client hints. Real browsers are unaffected.

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
