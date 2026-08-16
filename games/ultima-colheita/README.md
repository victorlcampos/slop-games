# The Last Harvest · A Última Colheita

A medieval village RTS crossed with a zombie siege. You start with a manor, six
villagers and two guards in a seeded valley. Cut wood, break stone, plant farms
— and every first snow a horde of the dead walks in from the edges of the map,
bigger each year. When the manor falls the run is over; the score is how many
years the town stood.

## How to play

Everything is one pointer:

- **Build** — tap a building on the command bar, then tap the ground. The ghost
  shows green where it fits. Tap the button again (or press `Esc`) to put the
  tool down.
- **Fight** — tap the ground with no tool selected and the rally flag moves
  there; the army stands guard around it and attacks anything dead that comes
  within reach. Soldiers hold the line, archers shoot over it, towers shoot on
  their own.
- **Train** — the soldier and archer buttons queue recruits (each one costs
  resources *and a villager* — an army is farmers who put the hoe down).
- **Demolish** returns half the cost. `M` mutes.

## The year

Four seasons of thirty seconds. Farms yield nothing in winter and half again as
much in autumn — the big harvest the title is about. Ten seconds before the
first snow a horn sounds; then the horde walks in. Survive it, and spring pays
you back: build, grow, go again.

The horde scales on two axes: the **year** (more of them, tougher, and new
kinds — runners from year 2, brutes from year 4) and the **town** (every
standing building adds to the count). A rich village is a loud dinner bell.

## What is interesting about it

- **The whole game runs headless.** The simulation (`world.js`, `units.js`,
  `hordes.js`, `buildings.js`, `map.js`) never touches a canvas — the test
  suite founds towns, starves them, walls them in and marches hordes at them,
  in Node, in milliseconds.
- **The map is a seed.** Tree stands and rock outcrops are dealt by mulberry32;
  the same seed is the same valley, which is what makes a saved run resumable.
- **Zombies don't pathfind — they chew.** A zombie walks straight at what it
  wants; whatever blocks the way becomes what it wants. That single rule is the
  entire meaning of a wall.
- **Every sprite is rectangles.** Buildings, villagers, the dead, the resource
  icons — all drawn at runtime (no image ships in the file), with the ground
  cached per season because 800 tiles of freckles per frame is the kind of
  spend a phone notices.
