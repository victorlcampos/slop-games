import { build } from 'slopkit/build';

// This game's files share a global scope and depend on order — they are not ES
// modules. `concat` mode respects that, while still minifying everything
// together and hanging slopkit off a global (`Slop`) first, which gives the game
// access to the kit without rewriting its whole scope.
await build({
  root: import.meta.dirname,
  mode: 'concat',
  globals: { Slop: 'slopkit' },
  files: [
    'src/01_i18n.js',
    'src/02_util.js',
    'src/03_species.js',
    'src/04_sprites.js',
    'src/05_world.js',
    'src/06_entities.js',
    'src/06b_audio.js',
    'src/07_render.js',
    'src/08_ui.js',
    'src/09_game.js',
  ],
});
