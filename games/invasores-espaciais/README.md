# 👾 Invasores Espaciais · Space Invaders

The 1978 classic rebuilt from code. One cannon, a swarm that descends one step
at a time and gets faster with every kill, four bunkers that crumble from both
sides, and a red saucer that pays up to 300 points if you are quick.

```bash
npm run build --workspace games/invasores-espaciais   # dist/index.html, one file
npm test --workspace games/invasores-espaciais        # scenarios, in Node
```

## Controls

**←/→** or **A/D** move · **space**, **J** or **Z** fires · **M** mutes.
Enter starts from the menu and from the game-over card.

On a phone drag anywhere to move — the cannon fires on its own while your
finger is down.

## What is interesting about it

- **The march is a timer, not a speed.** The swarm steps sideways on a clock
  that ticks faster as invaders die and as waves pass — one survivor crosses
  the screen in under two seconds. Edge contact drops the whole formation a
  row and reverses it, exactly like the original.
- **Shields are damage grids, not hit points.** Each bunker is a grid of cells
  and every bolt chews a crater out of it, from whichever side it arrived.
  Your own shots eat your own ceiling.
- **The saucer pays for aim.** It crosses on its own timer; the payout grows
  the fewer shots you needed since it appeared — snap shots pay 300.
- **Nothing here is an image.** The three invader breeds are pixel maps drawn
  rect by rect (with a two-frame leg shuffle), the cannon, bunkers, saucer and
  every sound are synthesised at runtime.

## Tests

All of it runs in Node, with no browser: the march (step, drop, reverse,
acceleration), the firing discipline (one cannon shot at a time), the shield
craters, the scoring table, the saucer payout, the defeat lines, and both
languages.
