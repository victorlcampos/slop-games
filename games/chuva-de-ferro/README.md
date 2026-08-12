# 🪖 Chuva de Ferro · Iron Rain

A run-and-gun on an endless desert road. An alien freighter split open overhead
and its hold has been falling ever since — crates, safes, anvils, a piano. You
are the last soldier on Route 14: shoot the cargo down before it lands, and
fight the invasion with the guns that fall out of it.

```bash
npm run build --workspace games/chuva-de-ferro   # dist/index.html, one file
npm test --workspace games/chuva-de-ferro        # 38 scenarios, in Node
```

## Controls

Arrows or **A/D** move · **W**, **↑** or **space** jumps · **S** or **↓**
crouches · hold **J**, **Z** or the mouse to fire · **M** mutes.

On a phone the pads are drawn on the canvas, and the board turns itself: hold the
device however you like, the game lies down on its own.

## What is interesting about it

- **The gun aims itself.** The threat comes from above and a phone has no second
  thumb for a reticle, so the barrel picks the nearest piece of cargo, weighted
  towards whatever is about to land on the soldier's head. Holding ↑ overrides it
  and fires straight up — the one shot the auto-aim cannot guess for you.
- **Twenty guns, one table — and twenty drawings.** Every weapon is a row in
  `src/weapons.js`: fire rate, spread, pierce, splash, ammo, and which of the
  eight projectile behaviours it uses. Each row also has its own silhouette in
  the soldier's hands (`src/draw/guns.js`), with its own muzzle and its own
  grip points. The service rifle is the only one with infinite ammo, and
  running a magazine dry drops you back to it — that fallback is the rhythm of
  the whole game.
- **The day passes.** A run starts mid-morning; around the two-minute mark the
  sun goes down and the fight carries on under stars, the freighter's vents
  glowing overhead, until dawn brings the desert back. The light curve is a
  pure function (`daylightAt`), so the tests can watch a whole day in a loop.
- **The obstacles play fair.** A rock blocks your shot the same way it blocks
  your run, and the arch you crouch under is rock all the way up — jump on top
  of it and it is the best firing position on the road. Four different saucer
  crews do the dropping, and none of them fly the same ship.
- **Twenty things fall, and none of them fall alike.** An egg sticks where it
  lands and leaks; a ball keeps bouncing; a barrel takes its neighbours with it;
  a safe soaks thirty shots and, once it is down, becomes the only high ground on
  the road. Freeze one in the air and it drops dead and shatters.
- **The road is a function.** There is no level: the ground is noise over x, and
  every segment either grows rocks to jump or a stone overhang to crouch under —
  never both, because a rock under a cave is a trap with no way out.
- **Nothing here is an image.** The soldier, the saucers, all twenty-one
  drawings and every sound are made at runtime from a handful of shapes and a
  noise buffer.

## Tests

All of it runs in Node, with no browser: the tables are checked row by row (a
gun that fires a projectile nobody implements, a piece of cargo that lands in a
way nothing handles, a name written in one language), and the run itself is
played — ten minutes of road, every gun against a crate, the safe becoming a
platform, the medkit only being offered to somebody who needs it.
