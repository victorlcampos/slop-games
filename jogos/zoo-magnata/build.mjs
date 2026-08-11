import { construir } from 'slopkit/build';

// Os arquivos deste jogo compartilham escopo global e dependem da ordem — não
// são módulos ES. O modo `concatenado` respeita isso, mas ainda minifica tudo
// junto e pendura o slopkit num global (`Slop`) antes, o que dá ao jogo acesso
// ao kit sem reescrever o escopo inteiro.
await construir({
  raiz: import.meta.dirname,
  modo: 'concatenado',
  globais: { Slop: 'slopkit' },
  arquivos: [
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
