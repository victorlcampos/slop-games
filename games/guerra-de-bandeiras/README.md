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
| roll | `space` (or `shift`) — one shove, then a second of nothing |
| mute | `M` |

On a phone the left half of the screen walks and the stick is born wherever
your thumb lands; the right half is the trigger — a tap turns you onto the
nearest enemy you can see and fires, and dragging aims by hand. 🌀 rolls.
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

## The camera, and what you can see

**This is Infinite Fortress's body, in a match.** The walk, the roll, the turn
rate, the way the gun finds a man inside where you pointed it and then waits for
the shoulders to come round before the round leaves — all of it is the
Fortress's, number for number. So is the camera: it sits on the soldier you are
driving, and the field is half again wider than the screen.

What is different is the light:

- **Five arenas are lit.** You see the whole room you are standing in, all the
  way round — and **nothing through a wall**. The cone is simply opened to 360°
  and the walls do all the hiding.
- **The maze is at night.** There it is the Fortress's torch: 104° reaching
  470px, plus the small circle you feel rather than see.

Both settings are the same function, and both squads wear the same pair of eyes:
a fog that only applied to the player would be a handicap dressed as atmosphere.
Your squad shares what it sees, whoever is carrying a flag shows through the
dark, and the map in the corner is what the camera made necessary — with the
field bigger than the screen, "where is everybody" has to be answerable without
looking at all of it.

## The six arenas

Each one is unlocked by winning the one before it, and each one is a different
problem:

1. **Twin Corridors** — three lanes and three ways between them. 3 a side.
2. **The Bridge** — a pit splits the field and is crossed in two places. A body
   cannot cross it; a bullet can, so both squads spend the match in each other's
   sights.
3. **The Maze** — the night arena, braided hard so no corridor has only one
   answer. 3 a side.
4. **Turret Nest** — two automatic guns guard each stand. They can be shot
   down, and twenty seconds later they are back: killing one buys a window, not
   the base.
5. **The Gates** — four pads, each throwing you at its mirror on the far side.
   It works for whoever is being chased and for whoever is chasing.
6. **Open Field** — five a side, the fastest squad in the game, and nowhere to
   hide but behind a block.

## What is interesting about it

**Half of every arena is authored; the other half is its mirror.** A field that
is not symmetric is not a match, it is a handicap — and a symmetry maintained by
hand drifts on the third edit. The layouts are lists of rectangles over the left
fourteen columns, and the builder writes column `c` and column `27 - c` from the
same line. The maze is grown from a seed on one half and reflected the same way.
A test walks the result: both flags reachable from both sets of spawns, both
raids the same number of tiles long, and the two halves identical cell for cell.

**And then six bugs made it asymmetric anyway.** Every one was invisible in the
code and visible only as "the sentinels are better", and every one was found by
playing a few hundred matches between two squads of bots and counting:

- *The update order.* Deciding and moving body by body meant whoever came later
  in the array read positions that had already moved this frame — half a frame,
  three pixels, and 40% more captures for that side. Everybody decides against
  the same world now, then everybody moves.
- *A fifth of a degree.* The blaster started fractionally more accurate than the
  rifle. That is not a trade, it is a better chance of hitting on every shot ever
  fired.
- *Damage a second is not time to kill.* What decides a fight is the number of
  whole rounds it takes times the wait between them. The two guns are tuned
  until neither wins, and the rate that does it is not a round number.
- *Unit ids leaked into behaviour.* Defenders walked a slow lap around their own
  stand with the radius keyed off `u.id` — and ids run 1..5 on one side and
  6..10 on the other, so the two squads circled differently.
- *The jobs were handed out bots-first.* The player is one body on his side, so
  his squad's defenders came from one set of spawns and the enemy's from
  another: the enemy always had a body starting on its stand and yours never
  did. Roles go by spawn now, and body number one is the raider on both sides.
- *Ties in the pathfinder.* Taking the first strictly-better neighbour means
  up-left wins every tie, so a squad walking left routed a shade more directly
  than a squad walking right. It only showed in the open arena — a corridor has
  no ties to break. Same for the tile a goal inside a wall falls back to, which
  was "try +x first" and is now "the nearest one".

**The bots have no squad brain.** Each one answers the same five questions in
the same order — am I carrying theirs, is somebody running off with ours, is
ours on the deck, is one of mine carrying theirs, otherwise my job. The team
play falls out of the order. The one rule that had to be written explicitly is
the standoff: with both flags in hands nobody can score, and a squad that keeps
politely raiding an empty stand will still be there ten minutes later.

## Tests

```bash
node test/logic.test.mjs    # the arenas, the ramp, the balance, the eyes, the dictionary
node test/play.test.mjs     # the match, played in Node at a fixed step
```

Forty-one scenarios, about two seconds, no browser. Three of them play whole
matches between two squads of bots, because "does a match end", "do both sides
score" and "does the field favour one end" cannot be answered any other way.
