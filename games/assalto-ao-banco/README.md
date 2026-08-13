# Bank Job / Assalto ao Banco 🏦

A top-down heist through a bank that does not exist until you walk into it. Get
to the vault, drill it, take the lift down — and find a bigger bank, with more
men in it, waiting on the next floor. There is no last floor.

Open `dist/index.html` on a double click. No server, no install, no account.

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

**Nothing is picked up with a key.** Stop on a gun, a bag of cash, a medkit or
an alarm panel and a ring fills — the vault's own mechanism, only quick. It is
the stopping that matters: sprinting over a panel does not pull the alarm, and
running past a rifle does not make you drop the gun in your hands. A body is the
one thing still on a key, because a body will not pick itself up.

**The roll** is the only way to cross a lit corridor before the cone comes back
round. It is faster than he can ever walk, it cannot be steered once it starts,
it drops whatever you are carrying — and it is *loud*, which is the trade: the
one move that beats a pair of eyes is heard by every ear on the floor.

On a phone both sticks are born where the thumb lands: the **left half walks**,
the **right half aims and fires**. How far you push the left stick is how loud
you are — a short push is a creep, pushing it out is a run. The right stick
turns him as soon as it is touched and only fires once it is pushed out, because
on a floor where one loud shot brings four men, a stick that fires the moment it
is touched is a trap. 🌀 rolls; the hand button only appears when there is a body
at your feet.

The screen turns itself: held upright, the canvas is laid on its side rather
than asking you to unlock rotation.

## The rules of the building

**You see what is in front of you.** A cone, and a small circle at your feet —
both stopped by walls. What you have already walked past stays on the map as a
memory, drawn cold; what you have never seen is black. The guards' cones are
drawn where they fall *inside your own sight*, so a lit floor across a doorway
is a warning and not a map.

**A guard who is sure of you runs for the nearest red panel.** He fires as he
runs, badly. If he reaches the panel the whole floor comes to where you were
last seen — and while the alarm rings, anybody who sees you refreshes that. He
is measured against the panel that is nearest *on foot*, so shooting him before
he arrives is a real choice with a real window.

**A body on the carpet says exactly what you do.** Any guard who looks at one
for half a second goes for a panel. You can pick a body up and drag it — slower,
and you cannot shoot straight while you do — into a room nobody patrols.

**Cameras call it in by themselves.** Stay in one long enough and the alarm goes
up with nobody having seen you. One bullet kills a camera; one bullet kills a
panel too, and a floor with no panels left is a floor where the man who saw you
has to come and find you himself.

**You can pull an alarm.** Everybody runs to the panel — and the panel is not
where you are. It is the only tool in the game that moves people rather than
removing them.

**Noise is the real currency.** Nine guns, and what tells them apart is how far
the shot travels through the building, not what it does at the end of it. Two
are quiet — the silenced pistol you start with, which never runs out and needs
two hits, and the **dart gun**, which is quieter still and ends a guard in one,
but fires every second and a half and only across a room. The other seven are in
another league: a pistol, a revolver, an SMG, a shotgun, a rifle, a machine gun
and a sniper rifle, each louder roughly in proportion to how much you wanted it.
Your own footsteps carry too, unless you are sneaking — and so does a roll.

You can tell them apart on the floor by outline alone: a silencer's can, a
revolver's cylinder, a scope on its rail, a drum magazine. In a corridor lit by
a torch there is no time to read a label.

## What is interesting about it

**The floor is a seed, not a file.** Floor 12 of run 481 is rebuilt from two
numbers whenever it is needed, which is what makes "infinite floors" cost
nothing. Rooms are placed, joined nearest-first by corridors, and then given a
couple of extra links on purpose — a floor plan shaped like a tree means being
seen anywhere is being cornered.

**The difficulty is one function, and a test holds it to account.** `threat(n)`
is a weighted sum of everything on the floor, and `logic.test.mjs` walks two
hundred floors checking it strictly rises. The staff hits a ceiling — sixteen
guards in a corridor is a crowd, not a challenge — but the men themselves never
stop getting tougher, which is what keeps floor 40 worse than floor 39 after the
building runs out of room to hire.

**The fog and the guards read the same maths.** The polygon the renderer clips
to is built by the same ray casts that answer "can he see you". There is no
second system deciding what is dark, which is the only way a fog can be fair.

**It is not seen from a helicopter.** The projection is oblique: the floor stays
a grid of plain squares and everything with height is drawn *up the screen* from
the tile it stands on, so a wall shows its top and the face turned towards you,
and a person is a figure standing on their tile rather than a disc. It costs one
rule everywhere — draw in rows, top of the screen first — and it buys a building
you can read the shape of. The people are dolls whose bodies never rotate; what
turns is the arm and the gun in it, with its y squashed towards the horizontal,
because pointing away should look short.

**Nothing here is an image.** The whole bank — the tiled floors, the masonry
courses on every wall face, the men, the nine guns in silhouette, the money, the
vault door — is drawn by code, 77 KB with no libraries at all.

## The trap that cost the most

A guard whose route was "straight there, I can see it" walked the hypotenuse
into the corner of a wall and wedged at fifteen pixels — his own radius — and
then stood there for the rest of the floor, still with a clear line to the alarm
he was trying to reach. The centre ray was clear; he was thirty pixels wide.
`clearFor()` casts three rays instead of one, offset by the body it is asking
about, and the shortcut is only taken where he actually fits. It has its own
scenario, and reverting the fix turns it red.

## Tests

```bash
npm test --workspace games/assalto-ao-banco
```

Two files, no browser: `logic.test.mjs` for the building (generation,
reachability, the difficulty curve, the ray casts, the flow fields, both
languages) and `play.test.mjs` for the heist (being seen, the run to the alarm,
bodies, cameras, noise, the roll, the rings, the vault, the lift between
floors).

One of them earned its own note. "Sprinting over a gun does not take it" first
passed because the test walked him into the far wall, where he stood at 0 px/s
and did not pick it up for entirely the wrong reason. It paces him back and
forth over the gun now and asserts the speed it reached, so the scenario has to
sprint before it is allowed to claim that sprinting changes nothing.
