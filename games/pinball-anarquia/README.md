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
| **space** (or **↓**) | hold to draw the plunger back, let go to fire |
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
- **The plunger is a rod on a spring.** Not a number assigned to the ball: a
  capsule across the bottom of the shooter lane, in the collision list like any
  other wall. Hold the button and your hand draws it down and the ball rides it
  down the lane; let go and the only thing acting on it is `a = -k·p` until it
  reaches the stop. The tip is dead (`e = 0`), so the ball is *carried* by the
  stroke rather than flicked off the front of it, and leaves with everything the
  spring had: a pull of `p` throws `p·√k`, which is the whole launch curve with
  nothing to tune.
- **A coil is an actuator, not an impulse.** Slingshots and bumpers throw the
  rubber at a *speed*; a ball already leaving faster than the rubber is moving
  gets nothing from them. Slow ball into a bumper: 180 in, 291 out. Fast ball:
  700 in, 517 out — the rubber absorbed it and the coil had nothing to add.
  That one property is why the table cannot resonate (below).
- **Surfaces grip, by Coulomb's rule.** A bounce bleeds the component *along*
  the wall too — but the amount is capped by how hard the ball pressed into it,
  so a square hit scrubs a lot of sideways speed and a graze scrubs almost
  none. A flat fraction instead reads fine on impacts and is glue on contacts:
  a ball resting on a slingshot lost a third of its sliding speed seven hundred
  times a second and sat there on the face for good.
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

## Things have to be things

> *"I fired the plunger weakly, the ball came back and passed straight over the
> spring — which shows me the physics is all wrong, the things are not real
> things."*

They were not. The launch used to be `ball.vy = -(min + charge · range)`, and
what happened after a plunge too weak to clear the lane was worse: the ball was
**teleported** back onto the plunger. On screen that is a ball passing through
the spring, and the player was right to call it what it was.

The plunger is a rod now (above), and everything that used to be a shortcut
around it went with it: there is no launch velocity, no fallback, no "put the
ball back". A weak pull sends the ball a few centimetres up the lane and it
comes down and lands on the tip, because that is what it would do. The scenario
that guards it does not check the speed — it watches the ball's position every
step and fails if it ever moves more than 12 px in one, because *something put
it there* is the bug, whatever the numbers say.

The same audit went through the rest of the file. The kickback coil was the last
thing left that replaced a velocity instead of raising it; it is an actuator
like every other coil now.

## Nowhere to rest

The other half of the same report was a ball stuck at the foot of the flipper.
Three things were wrong, and only the last of them was the one that looked like
the bug:

1. **The inlane guide aimed at the flipper's pivot**, which put the pivot's
   round cap six pixels proud of the surface the ball was rolling down. A curb,
   with a pocket behind it. The guide runs tangent to that cap now, so the ball
   rolls over the pivot and onto the blade.
2. **The friction was not Coulomb friction** (above), so anything that came to
   rest on a slingshot's rubber stayed there.
3. **The ball search exempted any flipper**, resting or raised, and *reset* its
   clock rather than pausing it — so a ball wedged near a flipper the player was
   flapping had its timer zeroed on every press and was never looked for at all.
   A cradle is a ball on the *blade* of a flipper being held up; a ball jammed
   against the pivot is not being cradled, it is stuck.

What replaced eyeballing it is a scenario that puts a dead ball on every legal
square of the lower table — about six hundred of them — and gives the whole
machine twelve seconds to give each one back. It found all three. Six minutes of
scripted flailing now spends at most **2.6 seconds** with the ball inside a
26-pixel box; before, it spent **eighty-four**.

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
   cradled on the blade of a *held* flipper is exempt: that is the most useful
   thing a player can do with one, and shaking it loose would be the machine
   taking the game away from somebody playing it well. Getting that exemption
   slightly wrong cost another eighty seconds — see above.

That closed the resonance: five minutes of scripted play went from *forever* to
at most 2.9 seconds inside a 110-pixel box.

## Two things that were only found by measuring

The guard posts above the wormhole exist because a script that flails at the
flippers for four minutes found every full-power launch landing in it on the
same path; the slingshots sit twelve pixels higher than they look like they
should, because a ball used to wedge into the notch between their bottom corner
and the flipper shoe.

And that guard post turned out to be aiming the whole game. Fire every pull
strength with nobody on the flippers and count how many launches touch anything
that scores: from where it used to stand, **nine in ten touched nothing at all**
— down the right-hand side, out of the outlane, gone. Twelve pixels away, more
than half of them find something. Nothing about the picture says so; a post is a
post. That measurement is a scenario now.

And a frame used to cost 110 ms. Two full-screen gradients for a room that never
changes, three full-table composites for layers that never change, a backglass
repainted from scratch, and additive halos whose area nobody had multiplied out
— three bumper glows alone were half the cost of drawing the entire playfield.
The renderer will tell you where its time goes:

```js
__game.render.profile = true;   // then read __game.render.timings
```
