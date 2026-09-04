# 🕹️ Clássicos do Arcade · Arcade Classics

Seven arcade classics rebuilt from code behind one neon sign. Pick a machine —
each keeps its own best score, in both languages.

```bash
npm run build --workspace games/invasores-espaciais   # dist/index.html, one file
npm test --workspace games/invasores-espaciais        # scenarios, in Node
```

## The machines

| | | |
|---|---|---|
| ⭐ **Enxame Estelar · Star Swarm** | the Space Invaders homage | hold the line against the descending swarm; the red saucer pays 300 for a snap shot |
| 🟡 **Labirinto Faminto · Hungry Maze** | the Pac-Man homage | eat every pellet while four shadows hunt you; the power pill turns the tables, 200·2ⁿ a ghost |
| 🧱 **Quebra-Blocos · Block Breaker** | the Breakout homage | the paddle's edge is the aim; higher rows pay more |
| 🐍 **Cobra Neon · Neon Snake** | the Snake homage | eat, grow, do not bite yourself; every fifth meal hides a 50-point bonus |
| 🪨 **Cinturão de Asteroides · Asteroid Belt** | the Asteroids homage | Newtonian drift on a toroidal field; big rocks split in two |
| 🐸 **Travessia · Hop Across** | the Frogger homage | five lanes of traffic, four of river, five bays; fill them all |
| 🏓 **Rebate Neon · Neon Bounce** | the Pong homage | you against the machine; every return pays, every ball past it pays 100 |

No trademarked name made the trip: the marquee says Star Swarm, not Space
Invaders; Hungry Maze, not Pac-Man; and so on down the row.

## Controls

Keyboard everywhere: arrows or WASD move, space fires. On a phone each cabinet
has its own deal: drag aims the cannon and the paddle, either half of the
screen turns the ship (the engine burns on its own), and everywhere else a
swipe steers while a tap fires. **M** mutes, **Esc** walks back to the machines.

## What is interesting about it

- **One shell, seven cabinets.** Every machine speaks the same protocol
  (`create/update/draw/drain/isOver` in `src/registry.js`), so the menu, the
  loop, the save and the language picker never learn any game's rules.
- **The save backfills.** One best per machine under a single key; a save from
  the swarm-only days migrates its score instead of breaking, and a machine
  added tomorrow loads as zero.
- **The maze is the real thing.** Tile-center turning, scatter/chase clocks,
  release timers, frightened reversals, eyes that fly home — all of it pure
  simulation, played by the tests in Node.
- **Nothing here is an image.** Pixel-breed invaders, a chomping circle, wavy
  ghosts, vector rocks, the frog — all drawn or synthesised at runtime.

## Tests

All of it runs in Node, with no browser: each machine gets its own file —
the march and the firing discipline, the ghost AI and the fright chain, the
paddle geometry, the growth and the bite, the splitting rocks, the traffic
and the logs, the rally pace — plus the shell (seven machines, two languages,
an old save that still opens).
