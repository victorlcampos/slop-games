import { construir } from 'slopkit/build';

// O three vem vendorizado em `vendor/`, não do npm: o jogo nasceu antes de o
// repositório ter workspaces e o arquivo já está aqui, versionado. O alias
// aponta os imports para lá.
await construir({
  raiz: import.meta.dirname,
  pwa: true,
  alias: {
    'three/addons': 'vendor/addons',
    three: 'vendor/three.module.js',
  },
});
