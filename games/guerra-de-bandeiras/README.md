# 🚩 Flag War · Guerra de Bandeiras

Capture the flag between the humans and the sentinels, over six arenas. Take
their flag to your own stand five times, before they do it to you.

One HTML file, no server, no install: open `dist/index.html` on a double click.

## The way in

Two screens, in the order the decisions actually matter.

**The field first.** Six cards, and each one draws the arena it is — the real
grid, built by the same `buildArena` the match is played on, so a card cannot
drift from the field behind it. The pit through the middle of the bridge, the
maze under its own night, the red dots of the turrets, the rings of the gates:
you pick a fight by looking at it, not by reading two words and trusting them.
`1` to `6` take one straight away.

**Then the body.** The two sides stand there face on, at twenty times the size
the match will ever show them, and the whole point of that screen is that they
are worth looking at: the trooper's helmet carries tally scratches nothing in
the game counts, his scarf never stops moving, and he has a grin he only lets
out once he has been chosen; the sentinel's dome has been cracked and riveted
back together, its cannon rings drift apart as they charge, and it wears a set
of human tags on its belt. **None of it is in the simulation** — the two guns
are tuned against each other to a fifth of a degree — and that is exactly why
it is there. What you are choosing between is a look and a story.

**And then it performs.** The one you take dips, commits, and comes up out of a
shockwave — the trooper racks the bolt and brings the rifle to his shoulder, the
sentinel charges its arm and lets it go — while the other card slides away, the
screen floods with your colour and the field opens underneath the light. It
takes a second and a half, and a tap anywhere skips it.

## How to play

| | |
|---|---|
| move | `WASD` or the arrow keys |
| aim | the mouse — the gun finds the man near the cursor by itself |
| fire | click, or `J` |
| roll | `space` (or `shift`) — one shove, a tumble, then a second of nothing |
| buy | `1` `2` `3`, standing on your own ground (on a phone, tap the gun) |
| mute | `M` |

On a phone the left half of the screen walks and the stick is born wherever
your thumb lands; the right half is the trigger — a tap turns you onto the
nearest enemy you can see and fires, and dragging aims by hand. 🌀 rolls.
Held upright, the game lays the canvas on its side rather than asking you to
unlock rotation.

**Two rules that are not obvious.** Their flag only scores while **your own flag
is in its stand** — if a sentinel is running around with yours, the point does
not count. And **your own flag has to be carried back**: touching it does not
send it home, you pick it up, and it is in the ground again when you are
standing on the stand with it. A flag on the deck stays there until somebody
makes that walk, in the open, with both hands full. Nobody carries two flags.

**Every body you put down pays.** A kill is 100 shards and one carrying a flag
is 180; a capture is 200 and walking your own flag home is 100. Standing on your
own ground the shards buy a gun — a scattergun for 250, a repeater for 350, a
lance for 450 — and none of them is a straight upgrade: each one beats your own
gun at something, loses to it at something else, and **runs out**. When the last
round is gone you are back on the gun you never have to think about. Die holding
one and it lands on the deck with whatever is left in it, for whoever walks over
it — either side.

**And nobody is bullet-proof.** Four seconds in one gun's line of fire is a body
on the deck, and a body left alone knits back together slowly, and only after
five quiet seconds. Crossing the field with a flag is a route problem, not a
health problem.

Pick a side before you start. It is a look and a feel, never an edge:

- **Humans** — a rifle: nine light rounds a kill, six a second.
- **Sentinels** — a blaster: six heavy bolts a kill, four a second.

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

**The edge of the light is a wall, not a sampling artefact.** The rays go to the
corners of the walls — a pair either side of every corner the light can reach —
rather than to a fixed set of angles. A uniform fan puts a ray every couple of
degrees, which is twenty pixels apart across a room, and each ray crosses a
corner at its own moment: a tenth of a pixel of walking swung up to a tenth of
the lit area, and the whole shadow boiled. Pinned to the corners it is under
three tenths of a percent, and a test walks every open tile of two arenas to
keep it there.

Both settings are the same function, and both squads wear the same pair of eyes:
a fog that only applied to the player would be a handicap dressed as atmosphere.
Your squad shares what it sees, whoever is carrying a flag shows through the
dark, and the map in the corner is what the camera made necessary — with the
field bigger than the screen, "where is everybody" has to be answerable without
looking at all of it.

## The six arenas

Each one is unlocked by winning the one before it, and each one is a different
problem:

1. **Twin Corridors** — three lanes and three ways between them. 4 a side.
2. **The Bridge** — a pit splits the field and is crossed in two places. A body
   cannot cross it; a bullet can, so both squads spend the match in each other's
   sights. 4 a side.
3. **The Maze** — the night arena, braided hard so no corridor has only one
   answer. 4 a side.
4. **Turret Nest** — two automatic guns guard each stand. They can be shot
   down, and twenty seconds later they are back: killing one buys a window, not
   the base.
5. **The Gates** — four pads, each throwing you at its mirror on the far side.
   It works for whoever is being chased and for whoever is chasing. 5 a side.
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
  until neither wins, and the rate that does it is not a round number — and it
  had to be found again the moment the guns were made to bite harder.
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

**The bots have no squad brain.** Each one answers the same short list in the
same order — am I holding a flag, am I nearly dead, is somebody running off with
ours, is ours on the deck, is there a better gun under my feet, is one of mine
walking one home, otherwise my job. The team play falls out of the order. The
one rule that had to be written explicitly is the standoff: with both flags in
hands nobody can score, and a squad that keeps politely raiding an empty stand
will still be there ten minutes later.

**What stops that reading as one bot copied five times** is the layer on top: a
raider comes at the enemy stand from his own side of it and the next side round
after he dies; a body in a firefight slides around the man it is shooting at
rather than walking into him; a body that has just been hit rolls; a body at a
fifth of its health backs off and lets it knit; and a body standing on its own
ground with shards in its pocket goes shopping — a defender for the shortest gun
he can get, a raider for the longest.

**Every one of those was measured before it was kept**, over thirty-two matches
a configuration, because "more interesting" and "never arrives" look identical
from inside the code:

| | captures a minute |
|---|---|
| none of it | 2.23 |
| approach angles | −0.33 |
| picking guns off the deck | −0.26 |
| backing off when nearly dead | −0.12 |
| strafing in a fight | −0.09 |
| all of it together | 1.65 |

What did **not** survive that table is the one that sounds best written down:
letting a bot re-pick its job when it respawns. Three versions of it are in the
history of `ai.js` — weighted towards defence while a flag was out, balanced
against the defenders still standing, promoting an attacker when nobody was
minding the stand — and every one of them was a ratchet that walked the whole
squad home, because a squad of four has one defender and loses him every twenty
seconds. Each cost about half the match's captures for something a player cannot
see. The lane rotates; the job does not.

## Tests

```bash
node test/logic.test.mjs    # the arenas, the ramp, the balance, the eyes, the dictionary
node test/entry.test.mjs    # the two screens you come in through
node test/play.test.mjs     # the match, played in Node at a fixed step
```

Sixty-five scenarios, about three seconds, no browser. Three of them play whole
matches between two squads of bots, because "does a match end", "do both sides
score" and "does the field favour one end" cannot be answered any other way.

The entry has its own file for a reason worth writing down: **there are rules in
those screens**, and rules in a `main.js` are rules no test can reach. A locked
arena is not a choice, the flourish has a length and only ever starts one match,
the skip has a floor — that floor exists because the tap that chose the side is
still on its way up, and without it the animation was one frame long for
everybody who taps quickly. The figures are split the same way: `heroPose`
returns the numbers and `drawHero` spends them, so a test can say "the flash
lives inside its window", "nothing is ever NaN" and "the two of them do not blink
in step" without ever looking at a pixel. What it cannot say is whether they look
like anything — that lap is still a person's.
