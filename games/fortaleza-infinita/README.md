# Infinite Fortress / Fortaleza Infinita 🛸

A top-down escape through an alien fortress that does not exist until you walk
into it. You were taken. You woke on a ring of a structure the captives call
the Fortress, and the way out is up: reach the seal, overload it, climb through
— and find a wider ring, with more sentinels on it, waiting above. There is no
last ring. Nobody has told him that.

Open `dist/index.html` on a double click. No server, no install, no account.

## The opening

The game starts with a short film, six scenes drawn by code like everything
else here: the beams over the town, the stack of rings with no top, the
patrols, the night the cell seal died, and the one rule of the climb. Click
advances a scene, ESC skips, and the menu keeps a "watch the opening" button
for whoever wants it again. It plays itself only on the first ever boot — the
save remembers.

## Controls

| | |
|---|---|
| Move | `WASD` or the arrow keys |
| Aim | the mouse |
| Fire | click, or `J` |
| Roll | `Space` |
| Walk silently | hold `Shift` |
| Drag a body | `E` (or `F`) |
| Mute | `M` |

**The gun aims itself, inside reason.** You point roughly and it finds the
sentinel — or the eye, or the alarm node, though a sentinel near the same line
always outranks a fixture, because the sentinel shoots back. The margin is
lateral *and* angular, because either alone is wrong at one end of the range —
sixty pixels off the line of fire is generous at arm's length and invisible
across a hall, seventeen degrees is the reverse. Whichever forgives more wins,
and the closest to where you actually pointed wins among those. It never
reaches further than you can see and never through a wall, because a gun that
swings onto somebody invisible in the dark hands away the dark.

**And it holds its fire until the round would land.** The body turns at a
finite speed; a burst that starts mid-turn sprays the wall behind the target.
So when the gun has a target, the trigger waits out the last few degrees — the
brackets close as he comes round, and the shot leaves when they shut. The wait
is real but tiny; what it buys is that the first round of a burst means
something, which on a phone is usually the only round that matters.

**Nothing is picked up with a key.** Stop on a gun, a pile of shards, a nanogel
pod or an alarm node and a ring fills — the seal's own mechanism, only quick.
It is the stopping that matters: sprinting over a node does not trip the
alarm, and running past a lance does not make you drop the gun in your hands.
A body is the one thing still on a key, because a body will not pick itself up.

**The roll** is the only way to cross a lit corridor before the cone comes back
round. It is faster than he can ever walk, it cannot be steered once it starts,
it drops whatever you are carrying — and it is *loud*, which is the trade: the
one move that beats a pair of eyes is heard by every ear on the ring.

On a phone the **left half walks**, and it is born where the thumb lands: how far
you push it is how loud you are — a short push is a creep, pushing it out is a
run.

The **right half is the trigger**, and **a bare touch is an order, not an
angle**: it turns him onto the nearest threat he can see — all the way round,
even the sentinel directly behind — and fires once he is round. That one rule
is what makes the game's defining move possible on a phone: **flee with the
left thumb, tap with the right**, and he backpedals shooting his pursuer, which
no amount of dragging two thumbs in opposite directions under fire was ever
going to deliver. The lock is sticky while the target stays visible, so a held
trigger keeps firing at the same one; **dragging** still swings the barrel by
hand, measured from the reticle in the corner or from wherever the thumb
landed. And for a second after the last shot the body **keeps facing the
fight** instead of snapping round to where his feet point — so burst, fall
back, burst again works without re-aiming, at the honest price that while it
holds you are walking backwards into rooms your torch is not lit for.

Two things a bare tap will never do: fire through a wall, or reach beyond the
torch. With nothing visible it fires straight ahead — the gun helps, it does
not refuse. 🌀 rolls; the hand button only appears when there is a body at your
feet — and both are tested before the trigger, so a roll is never a shot.

The screen turns itself: held upright, the canvas is laid on its side rather
than asking you to unlock rotation.

## The rules of the ring

**You see what is in front of you.** A cone, and a small circle at your feet —
both stopped by walls. What you have already walked past stays on the map as a
memory, drawn cold; what you have never seen is black. The sentinels' cones are
drawn where they fall *inside your own sight*, so a lit floor across a doorway
is a warning and not a map.

**A sentinel that is sure of you runs for the nearest alarm node.** It fires as
it runs, badly. If it reaches the node the whole ring comes to where you were
last seen — and while the alarm rings, anything that sees you refreshes that.
It is measured against the node that is nearest *on foot*, so shooting it
before it arrives is a real choice with a real window.

**A body on the deck says exactly what you do.** Any sentinel that looks at one
for half a second goes for a node. You can pick a body up and drag it — slower,
and you cannot shoot straight while you do — into a room nothing patrols.

**The eyes call it in by themselves.** The walls grow eyes on stalks; stay in
one's stare long enough and the alarm goes up with nobody having walked past.
One bolt kills an eye; one bolt kills a node too, and a ring with no nodes left
is a ring where the sentinel that saw you has to come and find you itself.

**The alarm has a voice, and the voice has an address.** While the alarm is up,
the node (or eye) that raised it screams — a two-tone siren, and a wider red
halo than the rest wear. One bolt into *that one* cuts the siren mid-wail. It
does not call off the hunt; it stops the ring screaming about it, which in a
game played by ear is worth a bolt.

**You can trip a node.** Everything alive runs to it — and the node is not
where you are. It is the only tool in the game that moves them rather than
removing them.

**Noise is the real currency.** Nine guns on two axes. **Noise** decides
whether the Fortress finds out, and it is what you are choosing between while
the alarm is off. **Weight of fire** decides whether you survive the next
thirty seconds, and it is the only thing that matters once the alarm is on.

Two guns are quiet: the whisper coil you start with — a magnetic coil pried
from a fallen sentinel, nothing burns so nothing bangs, and it never runs out —
and the **stasis dart**, which is quieter still and does no damage at all — it
freezes whoever it touches, whatever is left in him. Six darts, one every one
and a third seconds, only across a room.

The other seven are three to seven times the starting coil, because the first
draft was not and nobody picked them up: a gun that brings four sentinels
running has to be worth considerably more than double what you already have.
The whisper coil is a *takedown tool* now, not a combat weapon, and each of the
others does something no other one does — the shockwave knocks him off his aim
and is useless past arm's length, the ion cannon hits once and hard, the photon
lance burns through the first to reach the second, the railgun goes through
three and half the ring, and the ion shredder costs you your feet while it
fires.

Your own footsteps carry too, unless you are sneaking — and so does a roll. And
the bonus for clearing a ring unheard grows with the ring, because a flat one
is most of the takings on ring 1 and a rounding error on ring 20, which is
backwards.

You can tell them apart on the floor by outline alone: the whisper's coil
sleeve, the ion cannon's capacitor wheel, the needler's spines, the shockwave's
flared horn, the railgun's twin rails with the void between them, the
shredder's drum of cells — and each carries one point of light in its own
colour, because in a corridor lit by a torch an outline needs a heart to hang
off.

## What is interesting about it

**The ring is a seed, not a file.** Ring 12 of run 481 is rebuilt from two
numbers whenever it is needed, which is what makes "an infinite fortress" cost
nothing. Rooms are placed, joined nearest-first by corridors, and then given a
couple of extra links on purpose — a plan shaped like a tree means being seen
anywhere is being cornered.

**The difficulty is one function, and a test holds it to account.** `threat(n)`
is a weighted sum of everything on the ring, and `logic.test.mjs` walks two
hundred rings checking it strictly rises. The garrison hits a ceiling — sixteen
sentinels in a corridor is a crowd, not a challenge — but the sentinels
themselves never stop getting tougher, which is what keeps ring 40 worse than
ring 39 after the Fortress runs out of room to grow more.

**The fog and the sentinels read the same maths.** The polygon the renderer
clips to is built by the same ray casts that answer "can it see you". There is
no second system deciding what is dark, which is the only way a fog can be
fair.

**Almost overhead, and tipped just a little.** Everybody fits inside their own
square, which is the rule that matters: what you put the crosshair on and what
the simulation shoots at have to be the same place. A full standing figure was
tried and thrown out — drawn at their own height, a figure stands two tiles up
the screen from the tile it is on, so rounds sail over the heads of things you
are plainly aiming at. The tilt is carried by two small things instead: a lip
on every wall, and a head drawn a few pixels above its own shoulders with its
own shadow. A sentinel's eyes are set forward on the cranium, so even from
directly above you can tell where its cone is about to be.

**Nothing here is an image.** The whole Fortress is drawn by code, with no
libraries at all: five floor materials with their own patterns, so you can tell
a dock from an archive by the deck under your feet; fittings that say what a
room is (a conduit and a glowing growth read as a dock, four specimen lockers
read as an archive); panel seams on every wall face so a long wall has a length
you can count; the sentinels; the nine guns in silhouette; the opening film;
and a torch that falls off with distance, which is what makes the dark read as
dark rather than as a stencil. The escapee is the one warm thing on the ring —
an orange jumpsuit and a headlamp — and the sentinels bleed ichor, because the
reddest thing in the Fortress should be you.

## The trap that cost the most

A sentinel whose route was "straight there, I can see it" walked the hypotenuse
into the corner of a wall and wedged at fifteen pixels — its own radius — and
then stood there for the rest of the ring, still with a clear line to the node
it was trying to reach. The centre ray was clear; it was thirty pixels wide.
`clearFor()` casts three rays instead of one, offset by the body it is asking
about, and the shortcut is only taken where it actually fits. It has its own
scenario, and reverting the fix turns it red.

## Tests

```bash
npm test --workspace games/fortaleza-infinita
```

Two files, no browser: `logic.test.mjs` for the Fortress (generation,
reachability, the difficulty curve, the ray casts, the flow fields, both
languages, and the opening film played to its end) and `play.test.mjs` for the
escape (being seen, the run to the node, bodies, eyes, noise, the roll, the
rings, the seal, the gate between rings).

Two of them earned their own note.

"Sprinting over a gun does not take it" first passed because the test walked him
into the far wall, where he stood at 0 px/s and did not pick it up for entirely
the wrong reason. It paces him back and forth over the gun now and asserts the
speed it reached, so the scenario has to sprint before it is allowed to claim
that sprinting changes nothing.

"The end-of-run card has real numbers to read" exists because of the only bug
here that ever reached a player. `createSave`'s `save()` reports whether it
managed to write; it does not hand the state back. Assigning its answer to
`best` made `best` the boolean `true`, and the first `best.money.toLocaleString()`
threw — with the phase already switched to 'over', so the loop had stopped
simulating and the card was never shown. The game froze on the frame he died in,
in silence. The scenario reads exactly what the card reads, at exactly the moment
the card reads it, and checks every one of them is a number.
