# Anarchy Pinball · Pinball Anarquia 🏴

The Windows XP machine had one great game hiding in its Accessories: 3D Pinball
Space Cadet — loud music, lights everywhere, a dozen ways to score, and a TILT
for whoever shook it too hard. This is that table after it defected, repainted
in [Omarchy](https://omarchy.org)'s Tokyo Night and rethemed around the
circle-A.

## How to play

| | |
|---|---|
| **Z** or **←** | left flipper |
| **/** or **→** | right flipper |
| **space** (or **↓**) | hold to pull the plunger, release to launch |
| **X** / **N** or **.** | nudge the table from the side |
| **W** | shove it from below |
| **M** | mute |

On a phone: with the ball on the plunger, hold and release anywhere; in play,
each half of the screen is a flipper. Nudging is a keyboard vice.

Three shoves in quick succession and the machine locks up — TILT: dead
flippers, nothing pays, and only the drain forgives you.

## The table

Twelve ways to score, and every one of them lights something:

- **Three riot bumpers**, each wearing the circle-A.
- **Three Ⓐ lanes** under the dome: light all three and the multiplier climbs to
  x5. It dies with the ball, as multipliers do.
- **A three-target bank** on the left. Clear it and the **mutual aid kickback**
  in the left outlane re-arms — one free rescue.
- **The wormhole**: swallows the ball, pays, spits it back out.
- **The spinner** in the left orbit, paid by how hard you sent it round.
- **The orbit**: reach both ends of the dome inside three seconds.
- **Inlane rollovers** — light both and the kickback re-arms.
- **Outlane rollovers**, which pay you something on your way out.
- **Skill shot** at the top of the launch lane, for a measured pull.
- **Ball saver** for the first seconds after every launch, and an extra ball at
  200,000 — *solidarity*.

## Missions and the joke

Seven missions cycle — feed the bumpers, clear the bank, occupy the underground,
light the lanes, run the presses, break the blockade, march on the slings — and
each one promotes you up a rank ladder: citizen, sympathizer, punk, agitator,
saboteur, insurgent… and at the top, **nobody (free)**. It is a rank ladder in a
game about not having one, so climbing it is dismantling it. After a full lap
the goals scale up.

## Two screens, one machine

The layout is read off the shape of the window, not off a breakpoint someone
guessed. A phone held upright gets the display across the top and the table
underneath it, filling everything that is left — which is the honest
arrangement, because a pinball machine is a tall thing and so is a phone. A
monitor stands the backglass beside the machine instead. There is no "please
rotate your device" card anywhere in here.

## What is interesting under the hood

- **The physics is data.** The whole table — walls, slingshots, bumpers,
  targets, sensors, flippers — is one list of capsules and circles in
  `src/table.js`, read by both the simulation and the renderer, so the picture
  and the collisions cannot drift apart.
- **Flippers that throw.** The collision takes the flipper arm's angular
  velocity into account, so a moving flipper adds energy instead of being a wall
  that happens to be tilted.
- **A coil is an actuator, not an impulse.** Slingshots and bumpers throw the
  rubber at a *speed*; a ball already leaving faster than the rubber is moving
  gets nothing from them. Slow ball into a bumper: 180 in, 291 out. Fast ball:
  700 in, 517 out — the rubber absorbed it and the coil had nothing to add.
  That one property is why the table cannot resonate (below).
- **Surfaces grip.** A bounce bleeds the component *along* the wall too, hard on
  rubber and barely at all on the metal rails — so a ball skidding across
  something slows down instead of skating on forever.
- **The band, not the posts.** A slingshot's switch is a blade behind the rubber
  band, and the band is stretched between two posts. Clipping a post is a
  bounce; only the middle of the face fires the coil.
- **Everything added late is a sensor.** The spinner, the orbit, the inlanes and
  the outlanes notice the ball and never touch it — which is the only reason
  this many shots could be added to a table that was already tuned. A sensor
  cannot wedge a ball or change a bounce.
- **It is drawn in perspective, by hand.** Canvas 2D has no perspective
  transform, so the painted playfield is a flat texture warped one scanline at a
  time (`render/project.js`) and everything standing on it is projected. There
  is one light direction and every shadow obeys it. Ramps have a floor, two side
  walls that grow as they climb, and rails; the guide rails are bent rod raised
  off the wood; two sheets of acrylic hang over the corners on posts.
- **The score is a real dot-matrix.** The text is drawn into a canvas one pixel
  per lamp and read back, so any phrase in either language becomes dots with no
  glyph table to maintain — and it shrinks and wraps itself, because Portuguese
  is longer than English.
- **The soundtrack** is a 2-bar riff in A minor — sawtooth bass, square
  arpeggio, noise hats, sine kick — scheduled ahead on the WebAudio clock. Every
  cabinet noise is an oscillator with an envelope, including the spinner, which
  is a run of clicks slowing down.

## The ball that could not be lost

A player got a ball wedged between the two slingshots and it stayed there. Not
resting — bouncing, at a constant speed, from one to the other, for as long as
they cared to watch. The simulation agreed: **twenty-one thousand slingshot hits
in thirty seconds**, and the ball exactly where it started.

Each kick *replaced* the ball's velocity with a fixed one. Gravity had been
feeding the sideways component all the way down the table and the kick threw it
away, so the ball left every slingshot at precisely the speed and angle it left
the last one. Nothing in the loop could wind down, because nothing in the loop
remembered anything.

Four things came out of that, and each one is in the physics because a
measurement asked for it:

1. **Kicks became velocity-limited actuators** rather than impulses — see above.
   This is the one that actually closes it: an actuator with a top speed cannot
   sustain a cycle whose losses exceed it, and two facing each other stop being
   a resonator.
2. **Surfaces got friction.** Bouncing only ever touched the normal, so a ball
   whose motion was almost entirely sideways arrived at each slingshot with
   everything it had left the last one with.
3. **Coils got a reset time.** The face was firing on every physics substep —
   seven hundred times a second — which is how a ball that ever found its way
   *behind* a slingshot stayed pinned there for good. It only fires from the
   playfield side now, too.
4. **A ball search**, for the traps nobody has found yet. A real machine notices
   a ball it has not seen move and pulses its coils until it falls out. A ball
   cradled on a raised flipper is exempt: that is the most useful thing a player
   can do with one, and shaking it loose would be the machine taking the game
   away from somebody playing it well.

Five minutes of scripted play now spends at most **2.9 seconds** with the ball
inside any 110-pixel box. It used to be *forever*.

## Two things that were only found by measuring

The guard posts above the wormhole exist because a script that flails at the
flippers for four minutes found every full-power launch landing in it on the
same path; the slingshots sit twelve pixels higher than they look like they
should, because a ball used to wedge into the notch between their bottom corner
and the flipper shoe.

And a frame used to cost 110 ms. Two full-screen gradients for a room that never
changes, three full-table composites for layers that never change, a backglass
repainted from scratch, and additive halos whose area nobody had multiplied out
— three bumper glows alone were half the cost of drawing the entire playfield.
The renderer will tell you where its time goes:

```js
__game.render.profile = true;   // then read __game.render.timings
```
