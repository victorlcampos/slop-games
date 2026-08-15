# 🏰 Kings & Gears · Reis e Engrenagens

Two crowns, one valley. The Kingdom still builds in stone and timber; the
Machines cast their own armour. You get coins and a plot of ground, you decide
what the castle is made of and where the crown goes inside it — and then you take
turns lobbing things at each other until one of them is under the rubble.

Half Gunbound, half Angry Birds: the aiming is an artillery duel with wind and a
power gauge, and what you are aiming at is a structure that falls over.

**The siege engine stands on your castle**, on top of its tallest column, **and
it drives** — a tank of fuel per turn, spent by the pixel, and more of it going
uphill. Build higher and you shoot further; drive down behind your own wall and
you are safe and blind. The tower holding your gun up is the most obvious thing
on the field for them to knock down. The valley between the two plots is nearly
twice a screen wide, so the shell leaves the picture and the camera goes with it.

## How to play

**The workshop.** Tap a cell to build. Every material is cheap somewhere and
expensive somewhere else, and the one number that decides your floor plan is
`span` — how far a material reaches sideways with nothing under it:

| | coins | hit points | bridges | good against | eaten by |
|---|---|---|---|---|---|
| Sandbag | 6 | 55 | nothing | blast — it soaks explosions | bolts, drills |
| Timber | 5 | 60 | 3 cells | drill bombs | fire, and fire spreads |
| Crystal | 9 | 70 | 1 cell | fire pots — it does not burn | ballista bolts, tesla |
| Stone | 13 | 135 | 1 cell | rust shells | trebuchet stones |
| Iron | 23 | 215 | 4 cells | bolts, hail | rust, and rust spreads |

The workshop will not sell you a wall that would not stand up, and it will not
let you erase one something else is resting on. The crown has to end up
somewhere with a floor under it — but a floor is not a roof, and the difference
is the whole game.

**The armory shares the purse.** Every limited munition has a price, and the
panel under the enemy intel buys and sells them one shell at a time. Sell the
whole rack and it is all walls; sell walls and arrive with nine drill bombs.
The default kit is priced in — a player who never touches the panel builds
exactly the castle they always could.

**The battle.** One shot each, alternating.

1. **Drive** — hold ◀ ▶ on screen, or the left and right arrows. The fuel bar is
   the whole of your movement for this turn, and once the gauge is open you have
   committed and cannot move again.
2. **Aim** — hold ▲ ▼, the up and down arrows, or drag the field up and down. The
   angle is next to the fuel bar.
3. **Hold FIRE** — the charge climbs round the rim of the button.
4. **Let go** — it leaves at whatever the ring was reading. Holding too long is a
   full-power shot, not a wasted turn.

Nothing aims by being tapped. Pointing at the spot you wanted to hit reads well
with a mouse and is unusable with a thumb — the tap that opened the gauge also
snapped the barrel to wherever the thumb was, which on a phone is the bottom of
the screen.

At full power a shot barely carries the width of the valley, so the top of the
gauge is a real decision and not a default.

Pick munitions from the dock (or keys 1–4). The basic shot never runs out; the
other three are whatever the armory sold you, restocked every siege. The wind
changes every turn, and it moves a fire pot far more than it moves a rock — and
you can *see* it now: gusts streak across the valley the way the gauge points,
the clouds ride it, the flags on both castles stream with it.

Whoever hits the other crown wins. It takes two clean hits — or one wall coming
down on top of it.

## What is interesting in here

**Range and pace are two separate dials.** Gravity and muzzle speed were scaled
together (v by k, g by k²), which keeps every range and every apex identical —
the same gauge reading lands on the same cell — while cutting hang time by a
fifth. The shell reads as a shell instead of a balloon, and not one number of
balance moved.

**A hit answers back.** The struck block flashes white and floats the damage it
paid; debris flies onward, away from where the shell came from; every shot in
flight drags a wake in its own colour; and a hit on a crown drops the world
into slow motion for half a second — the camera and the HUD keep real time,
which is what makes it read as emphasis rather than lag.

**The ground is a weapon modifier you do not choose.** Craters scale with the
terrain: the same drill bomb opens a canyon in the dunes and scratches the
quarry, so a level decides which of your specials is worth a turn. The scrapyard
is loose metal, and the tesla coil arcs half again as far across it.

**Support is a real rule, not decoration.** A cell holds if the ground reaches
it, or the cell below holds, or it is within its material's `span` of something
that holds. Dig the ground out from under a sand wall and it pours into the
crater; do the same under an iron one and it hangs there like a bridge. What
falls deals damage to what it lands on — which is how a tower you undermined
kills the king it was built to protect.

**Where the gun stands is a design decision, and then a driving decision.** It
*starts* on the tallest column, which is the only seat from which even a
four-degree shot clears your own battlements — so a tall thin tower buys range
and hands them a target, and a low broad castle keeps the gun safe and short.
From there it is yours to move. Descending is free (it is a fall); climbing is
limited to three cells and costs nearly a whole tank, so getting back up your own
battlements is a turn's movement and a real decision. Undermine theirs and the
engine comes down with the tower it was riding, and spends its next turn
climbing back onto whatever is left — a turn it did not spend shooting at you.

**The king is a cell in the same grid as the walls.** Not a special case with
its own code path: support, collapse, blast falloff and crushing all treat him
as a block with a crown on it. The one thing he does differently is brace when
the floor goes, because losing on turn one to a shell you never saw is not a
lesson.

**The opponent has no extra information, and leaves no fingerprints.** It aims by
firing ghost shots through the same integrator, the same wind and the same walls
your shell goes through — but through a read-only twin of the match, because a
trace that can write to the world is a trace that will. The drill's collision
used to announce itself with an event, so every ghost drill the opponent
*considered* threw a spray of dirt onto the real battlefield: a hundred and forty
of them a turn, along trajectories nobody fired, at spots that never got a crater
because nothing had landed there.
What makes it beatable is a wobble on a good answer, not a worse answer — and
the wobble shrinks every turn, because a gunner who has watched two of his own
shells land does know where the third one goes.

And it is not a metronome: every third turn, if your engine is perched on a
tower worth the shell, it aims at the block under *you* instead of the king —
the same counter-battery play you are invited to make against it. The later
gunners also arrive better supplied: the campaign tier feeds their rack, so the
forge opens with three more of everything.

**Not one image.** Five kinds of wall, two kings, two siege engines, eight
munitions, six skies and every crater — all drawn at runtime from rectangles and
arcs. A sandbag is two rounded rectangles and a line of stitches; a cloud is five
overlapping circles with one outline round the lot, which Canvas cannot do and
has to be faked by drawing the shape twice.

**The workshop zooms and the battle does not.** A 40px cell drawn at 1:1 on a
phone held upright is about twenty screen pixels — half of what a thumb can hit —
so the camera magnifies the plot until the whole grid still fits the screen and
the cells are worth aiming at. Height is what binds: a zoom chosen on width alone
put the top of the castle above the top of the screen, and on a phone it zoomed
in on nothing but sky.

**A block is recognisable by its lid.** Whatever is on top of a column gets the
decoration: stone is crenellated, timber gets a shingle roof, iron a riveted cap,
sandbags a tied ear, crystal comes to a point. It is the cheapest way to turn a
stack of squares into architecture, and it is what you read at a distance when
the castle is most of a map away.

## Development

```bash
npm run build      # -> dist/index.html, one self-contained file
npm test           # the rules, then the siege — in Node, ~1.5s, no browser
```

`window.__game` exposes `viewport`, `i18n`, `run`, `match` and `shop` for the
console — which is where most of these bugs were actually found.
