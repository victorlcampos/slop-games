# The Last Harvest · A Última Colheita

A medieval village RTS crossed with a zombie siege. You start with a manor, six
villagers and two guards in a seeded valley. Cut wood, break stone, plant farms
— and every first snow a horde of the dead walks in from the edges of the map,
bigger each year. When the manor falls the run is over; the score is how many
years the town stood.

## How to play

Everything is one pointer:

- **Build** — tap a building on the command bar, tap the ground to park its
  ghost (green where it fits), then hit **✓ Build** — or ✕ / `Esc` to think
  better of it. `Enter` confirms too. Tap-to-build planted a farm on every
  mis-tap; the ghost-then-confirm flow is the fix.
- **Fight** — the army forms **squads of five**, each flying its own coloured
  flag. The **squad chips** on the left edge are the easy way in: tap a chip
  to pick that squad (tap again to let go), then tap the ground to post
  exactly them. Tapping a guard on the field works too, and open ground with
  no squad picked fans the whole army out around the point. Soldiers hold the line, archers shoot over it, towers
  shoot on their own.
- **Losses feed the horde** — a guard the dead kill stands back up on the
  wrong side, still in the rags of the uniform. Walls are cheaper than
  funerals.
- **Repairs** — villagers mend damaged buildings by themselves in peacetime,
  for wood, and every repair site pulls hands off the fields (production dips
  while they hammer). Nobody repairs a wall something is actively eating.
- **Train** — the soldier and archer buttons queue recruits (each one costs
  resources *and a villager* — an army is farmers who put the hoe down).
  A soldier keeps his bed and grows his appetite: the army counts against
  the town's housing and eats two and a half times what a villager does,
  so the autumn stockpile is what the winter siege actually runs on. When
  the granary hits zero the famine climbs a ladder — villagers starve
  first, and once none are left, soldiers desert.
- **Camera** — drag to pan, scroll or pinch to zoom, arrows or WASD to move;
  the minimap (bottom right) shows the whole valley and teleports the view.
- **Demolish** returns half the cost. `M` mutes.

The game teaches its own economy: a **quest panel** (top left) walks the first
town through sawmill → farm → houses → quarry → barracks → army → walls →
tower, and every resource in the top bar carries its **per-second rate** — the
answer to "where does wood come from" is the `+0.4` sitting next to the number.
Selecting a tool spells out what it does and what it wants, above the bar.

The whole chain **fits before the first snow**, and that is a tested promise,
not a hope: a scripted founder who does exactly what the quests say finishes
with ten seconds to spare — the tower goes up as the horn sounds. From there
the hordes compound by the year, and a second scripted player (a competent
one, playing without walls) is guaranteed to eventually lose: an endless siege
a bot can ride forever has stopped being a siege.

## The year

Four seasons of thirty seconds. Farms yield nothing in winter and half again as
much in autumn — the big harvest the title is about. Ten seconds before the
first snow a horn sounds; then the horde walks in. Survive it, and spring pays
you back: build, grow, go again.

The horde scales on two axes: the **year** (more of them, tougher, and new
kinds) and the **town** (every standing building adds to the count). A rich
village is a loud dinner bell. The bestiary unlocks by the winter: runners in
year 2, crawlers — half a body still coming — in year 3, brutes and the
bloated (kill it away from everything you love: it bursts) in year 4, and
spitters lobbing bile from outside sword's reach in year 5. Every walker
walks its own lurch, some still wear the straw hat of the farmer they were,
and the ones in blue rags used to be yours.

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
- **Every sprite is rectangles.** Timber-framed houses, the manor's banner,
  connected ramparts, pines and broadleafs, chimney smoke, snowfall, the
  villagers wandering the roads — all drawn at runtime (no image ships in the
  file), with the ground cached per season because 800 tiles of tufts per
  frame is the kind of spend a phone notices.
- **The balance was tuned by a robot playing badly.** A scripted player runs
  whole years headless; every time it died unfairly, the reason became a rule
  (the horde arrives as a procession, the army hunts anything biting a
  building, soldiers cost bread instead of gold, wounds heal in local peace).
