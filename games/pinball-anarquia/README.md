# Anarchy Pinball · Pinball Anarquia 🏴

The Windows XP machine had one great game hiding in its Accessories: 3D Pinball
Space Cadet — loud music, lights everywhere, a dozen ways to score, and a TILT
for whoever shook it too hard. This is that table after it defected: the same
window (playfield on the left, backglass on the right), repainted in
[Omarchy](https://omarchy.org)'s Tokyo Night and rethemed around the circle-A.

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

- **Three riot bumpers** (blue, purple, green — the Tokyo Night accents), each
  wearing the circle-A.
- **Three Ⓐ lanes** under the dome: light all three and the multiplier climbs,
  up to x5. It dies with the ball, as multipliers do.
- **A three-target bank** on the left. Clear it and the **mutual aid kickback**
  in the left outlane re-arms — one free rescue.
- **The wormhole to the underground**: swallows the ball, pays, spits it back.
- **Skill shot** at the top of the launch lane, for a measured pull.
- **Ball saver** for the first seconds after every launch.
- Extra ball at 200,000 — *solidarity*.

## Missions and the joke

Five missions cycle (feed the bumpers, clear the bank, occupy the underground,
run the free press, march on the slings), each one promoting you up a rank
ladder: citizen, sympathizer, punk, agitator, saboteur, insurgent… and at the
top, **nobody (free)** — it is a rank ladder in a game about not having one,
so climbing it is dismantling it. After a full lap the goals scale up.

## What is interesting under the hood

- **The physics is data**: the whole table — walls, slingshots, bumpers,
  targets, sensors, flippers — is one list of capsules and circles in
  `src/table.js`, read by both the simulation and the renderer, so the picture
  and the collisions cannot drift apart.
- **Flippers that throw**: the collision takes the flipper arm's angular
  velocity into account, so a moving flipper adds energy instead of being a
  wall that happens to be tilted.
- The simulation runs at 1/120 with 6 substeps (720 Hz effective) so a
  full-power launch never tunnels a wall; the whole thing is playable from
  Node, which is how `test/logic.test.mjs` plays launch, tilt, saver, missions
  and game over without a browser.
- The soundtrack is a 2-bar riff in A minor — sawtooth bass, square arpeggio,
  noise hats, sine kick — scheduled ahead on the WebAudio clock, Space Cadet
  style. Every cabinet noise is an oscillator with an envelope.
- The guard posts above the wormhole exist because playtesting-by-script found
  every full-power launch landing in it, on the exact same path; and the
  slingshots sit 12px higher than they look like they should, because a ball
  used to wedge into the notch between their bottom corner and the flipper
  shoe. Both bugs were caught by a stress test that flails at the flippers for
  four minutes and screams if the ball stops moving.
