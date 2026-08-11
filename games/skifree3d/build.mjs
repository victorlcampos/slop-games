import { build } from 'slopkit/build';

// three is vendored in `vendor/`, not pulled from npm: the game predates this
// repo having workspaces and the file is already here, committed. The alias
// points the imports at it.
await build({
  root: import.meta.dirname,
  alias: {
    'three/addons': 'vendor/addons',
    three: 'vendor/three.module.js',
  },
});
