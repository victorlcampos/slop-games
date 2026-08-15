# 🚩 Flag War · Guerra de Bandeiras

Capture the flag between the humans and the sentinels, over six arenas. Take
their flag to your own stand, ten times, before they do it to you.

One HTML file, no server, no install: open `dist/index.html` on a double click.

## How to play

| | |
|---|---|
| move | `WASD` or the arrow keys |
| aim | the mouse — the gun finds the man near the cursor by itself |
| fire | click, or `J` |
| dash | `space` (or `shift`) — one shove, then a second and a half of nothing |
| mute | `M` |

On a phone the left half of the screen walks and the stick is born wherever
your thumb lands; the right half is the trigger — a tap turns you onto the
nearest enemy you can see and fires, and dragging aims by hand. 🌀 dashes.
Held upright, the game lays the canvas on its side rather than asking you to
unlock rotation.

**The one rule that is not obvious:** their flag only scores while **your own
flag is in its stand**. If a sentinel is running around with yours, the point
does not count — somebody has to turn round and get it back. Touching your own
dropped flag sends it home instantly; left alone it walks home after fourteen
seconds.

Pick a side before you start. It is a look and a feel, never an edge:

- **Humans** — a rifle: thirteen light rounds a kill, six a second.
- **Sentinels** — a blaster: eight heavy bolts a kill, three and a half a second.

## The six arenas

Each one is unlocked by winning the one before it, and each one is a different
problem:

1. **Twin Corridors** — three lanes and two ways between them. 3 a side.
2. **The Bridge** — a pit splits the field and is crossed in two places. A body
   cannot cross it; a bullet can, so both squads spend the match in each other's
   sights.
3. **The Maze** — dark. You see what is near you and what your squad can see;
   whoever is carrying a flag glows for everybody. 4 a side.
4. **Turret Nest** — two automatic guns guard each stand. They can be shot
   down, and twenty seconds later they are back: killing one buys a window, not
   the base.
5. **The Gates** — four pads, each throwing you at its mirror on the far side.
   It works for whoever is being chased and for whoever is chasing.
6. **Open Field** — five a side, the fastest squad in the game, and nowhere to
   hide but behind a block.

## What is interesting about it

**The field is drawn whole, with no camera.** Capture the flag is a game about
where the other nine people are, and a camera that follows one soldier hides
exactly the four you are about to depend on. So the arena is 38 by 21 tiles at
32 pixels, and it fits under the scoreboard on one screen.

**Half of every arena is authored; the other half is its mirror.** A field that
is not symmetric is not a match, it is a handicap — and a symmetry maintained by
hand drifts on the third edit. The layouts are lists of rectangles over the left
nineteen columns, and the builder writes column `c` and column `37 - c` from the
same line. The maze is grown from a seed on one half and reflected the same way.
A test walks the result: both flags reachable from both sets of spawns, both
raids the same number of tiles long, and the two halves identical cell for cell.

**Two bugs in here were only ever visible as "the sentinels are better".** Both
were found by playing a few hundred matches between two squads of bots and
counting, which is the only way an asymmetry of a few percent is visible at all:

- *The update order.* Deciding and moving body by body meant whoever came later
  in the array read positions that had already moved this frame. Half a frame,
  three pixels — and 40% more captures for that side. Everybody decides against
  the same world now, then everybody moves.
- *A fifth of a degree.* The blaster started fractionally more accurate than the
  rifle. That is not a trade, it is a better chance of hitting on every shot ever
  fired. The spreads are identical now and the guns differ in weight and rate,
  which are dials you can balance against each other — and the balance point was
  measured, not reasoned: at 0.295 seconds a bolt the two clocks land on the same
  frame.

**The bots have no squad brain.** Each one answers the same five questions in
the same order — am I carrying theirs, is somebody running off with ours, is
ours on the deck, is one of mine carrying theirs, otherwise my job. The team play
falls out of the order. The one rule that had to be written explicitly is the
standoff: with both flags in hands nobody can score, and a squad that keeps
politely raiding an empty stand will still be there ten minutes later.

## Tests

```bash
node test/logic.test.mjs    # the arenas, the ramp, the balance, the dictionary
node test/play.test.mjs     # the match, played in Node at a fixed step
```

Thirty-seven scenarios, about a second, no browser. The last three play whole
matches between two squads of bots, because "does a match end", "do both sides
score" and "does the field favour one end" cannot be answered any other way.
