# 🏰 Kings & Gears · Reis e Engrenagens

Two crowns, one valley. The Kingdom still builds in stone and timber; the
Machines cast their own armour. You get coins and a plot of ground, you decide
what the castle is made of and where the crown goes inside it — and then you take
turns lobbing things at each other until one of them is under the rubble.

Half Gunbound, half Angry Birds: the aiming is an artillery duel with wind and a
power gauge, and what you are aiming at is a structure that falls over.

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

**The battle.** One shot each, alternating.

1. **Aim** — drag on the field, or hover with a mouse. Arrow keys nudge a degree.
2. **Tap** — the power gauge opens and starts sweeping.
3. **Tap again** — it fires at whatever the gauge was reading.

Pick munitions from the dock (or keys 1–4). The basic shot never runs out; the
other three are counted, and do not carry over between sieges. The wind changes
every turn, and it moves a fire pot far more than it moves a rock.

Whoever hits the other crown wins. It takes two clean hits — or one wall coming
down on top of it.

## What is interesting in here

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

**The king is a cell in the same grid as the walls.** Not a special case with
its own code path: support, collapse, blast falloff and crushing all treat him
as a block with a crown on it. The one thing he does differently is brace when
the floor goes, because losing on turn one to a shell you never saw is not a
lesson.

**The opponent has no extra information.** It aims by firing ghost shots through
the same integrator, the same wind and the same walls your shell goes through.
What makes it beatable is a wobble on a good answer, not a worse answer — and
the wobble shrinks every turn, because a gunner who has watched two of his own
shells land does know where the third one goes.

**Not one image.** Five kinds of wall, two kings, two siege engines, eight
munitions, six skies and every crater — all drawn at runtime from rectangles and
arcs. A sandbag is two rounded rectangles and a line of stitches.

## Development

```bash
npm run build      # -> dist/index.html, one self-contained file
npm test           # the rules, then the siege — in Node, ~1.5s, no browser
```

`window.__game` exposes `viewport`, `i18n`, `run`, `match` and `shop` for the
console — which is where most of these bugs were actually found.
