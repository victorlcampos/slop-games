# 🐆 Animals vs Monsters

Lane defence in the spirit of *Plants vs. Zombies*, in a single HTML file that
opens on a double click. Everything is drawn in code — there is not one image in
the file.

▶️ **[Play](https://victorlcampos.github.io/slop-games/animais-vs-monstros/)**

Plays in **English and Portuguese** — the flags are on the map screen, top
right, and the choice carries over from the catalog.

---

## The idea

The legends got tired of being only stories and took flesh. It was not a war:
anyone who grew up hearing those names **freezes with fear** at the moment of
running, and that is why humanity lost in three days — every people trapped by
exactly what they themselves invented.

Except nobody ever told those stories to the animals. An armadillo doesn't know
what a Cuca is. A bee has never heard of a werewolf. **You cannot freeze with
fear someone who never learned to have any** — and that is why the resistance
belongs to the animals.

Hence a campaign country by country: the animals come from all over, the
monsters are always the local ones. The first campaign is **Brazil**, where the
enemy is its folklore. Beat the Cuca and a radio call crosses the ocean: the
second campaign is **Japan**, where the enemy is the yōkai — and the crossing
gets a film of its own explaining why a squad that just freed its country
boards the first ship out of it.

## How you play

Every stage is a board of **5 rows by 9 columns**. Monsters come in from the
right; if one crosses the fence on the left, the stage is over.

1. **Plant generators.** With no seed coming in, nothing else reaches the field.
2. **Click the seeds** that fall on the ground to collect them.
3. **Build the lane**: a wall in front, the shooters behind.
4. **Kill fast** — every monster you drop returns seed.
5. Between stages, spend **coins** recruiting new cards or training the ones you have.

### The economy

Seed comes from **two sources that balance each other**:

| Source | How it arrives | What it rewards |
|---|---|---|
| **Generator** | falls on the ground, you click it | investing early and accepting risk while undefended |
| **Dead monster** | straight into the balance | killing fast, and not letting the wave pile up |

The asymmetry is deliberate: in the middle of a horde nobody has a spare hand to
click each drop, so what comes from combat comes in on its own. And that is what
stops the death spiral — whoever was forced to spend everything on defence early
can still finance themselves, as long as they hold the line.

The weight flips over the campaign: on stage 1 monsters are 14% of your income;
on stage 10, 60%. You start out depending on planting and end up living off what
you kill.

Two smaller rules close the system: the **shovel refunds half** the cost (getting
the placement wrong can't cost the stage), and **leftover seed becomes coin** at
the end, 5 to 1 — with a ceiling of 35% of the stage prize, so that "don't
plant" never becomes a strategy.

### Between stages: coins

Winning pays the stage's full prize. **Losing pays too** — in proportion to how
many waves you held, from 12% to 35% of the prize. Trying a hard stage can't be
time thrown away, but losing never pays more than winning. Replaying a stage
already won pays 30%, or stage 1 becomes a cash machine.

At the barracks, coins go to two places:

- **Recruit** — three cards rolled from the ones you don't have yet.
- **Train** — take a card in your deck up a level (to level 3).

Training raises what the card already does and **does not change its seed cost**:
the same seed on the field now buys more. At level 3 the card also comes back
sooner. A trained Squirrel produces 25 → 34 → 45 seeds; a Monkey hits 22 → 30 →
40.

Training is priced off the card's own value, so deepening an Elephant costs more
than recruiting an average card. And the budget doesn't cover both: **recruiting
everything costs 4030, training everything 8512, and the campaign pays around
3800**. Either you widen the spread or you deepen what you already use — every
player's deck ends up different because of that choice.

| Action | On a computer | On a phone |
|---|---|---|
| pick an animal | click the card | tap the card |
| plant | click the cell | drag to the cell and let go |
| collect seed | click it | tap it **or** drag a finger over it |
| remove an animal | ⛏ then click it | ⛏ then tap it |
| sound | `M` | button on the map |
| skip the intro | `Esc` | tap to advance |

### The screen

The game fills the whole window at any aspect ratio. The logical height is fixed
— it is what sets the size of animal, lane and font — and the **width follows the
shape of the screen**: on an ultrawide monitor you see more field ahead, on a 4:3
less. There is no letterboxing and no stretched image.

The board itself has a cell-size ceiling, so the leftover width becomes an
**approach track** on the right: on a big screen you see the horde coming from
far off, which is an advantage that doesn't touch the stage's balance.

On a phone the game asks you to turn the device — nine columns don't fit upright
— and the cards grow for a finger, breaking into two rows when the deck gets too
big for one.

## The cast

**23 animals**, from everywhere: Squirrel and Beaver produce seeds; Monkey, Bee,
Snake, Scorpion, Owl, Bat and Eagle shoot; Turtle, Hedgehog, Elephant and Hippo
hold the line; Jaguar, Kangaroo and Alligator hit up close; Lion stuns and Polar
Bear freezes; Skunk blows up once. Reaching Japan unlocks four local recruits:
the **Tanuki** cheats death once (the killing blow hits a statue), the
**Red-crowned Crane** shoots three lanes at once, the **Snow Monkey** throws
snowballs that slow (and his hot-spring blood is immune to freezing), and the
**Koi Carp** is the first shooter that fights from inside the river.

**13 monsters from Brazilian folklore**, each with a trick: the **Saci** jumps
the first defence, the **Curupira** arrives sooner than you worked out, the
**Headless Mule** wears armour, the **Iara** only comes down the flooded lanes
(and there it is an Alligator or a Hippo that holds her), the **Boto** crosses
the waterline changing shape — a dolphin in the river, a young man in a white hat
on the bank — the **Mother of Gold** crosses the sky and never looks down (no
wall holds her, only those who reach high), the **Boitatá** burns from a
distance, the **Werewolf** speeds up as it takes hits, the **Bogeyman** walks
invisible in the dark, and the **Cuca** — the boss — calls reinforcements as she
comes.

**9 yōkai in Japan**, and every one bends a rule the first campaign taught you:
the **Karakasa** is the hopping grunt; the **Kappa** spills the water bowl on
his head at half health and turns slow and weak — the anti-Werewolf, focused
fire *weakens* him; the **Kitsune** splits into illusions that soak your shots,
pay no seed, and die with her; the **Tengu** flies over your wall and lands
behind it; the **Rokurokubi** stops at the wall like anyone, but her neck
stretches over it and eats the shooter hiding behind; the **Yuki-onna** freezes
your animals solid; the **Nurikabe** is a living wall — piercing shots stop in
it and no kick moves it; the **Oni**'s club smashes the cell behind whoever it
bites; and the **Onryō** — the boss — turns intangible on a cycle and returns
in another lane, calling yōkai as he comes.

The folklore names stay as they are in both languages. Translating a Saci — or
a Kappa — would be inventing a creature that doesn't exist; what is translated
is the legend that describes them.

## The stages

Two campaigns of ten stages. Each stage changes the scenery, a board rule and
the enemy cast at the same time.

**🇧🇷 Brazil:**

| # | Stage | What changes |
|---|---|---|
| 1 | Backcountry Farm | the basics |
| 2 | Atlantic Forest | the Saci jumps defences |
| 3 | Cerrado | fast enemies, and ranged ones |
| 4 | Pantanal | two flooded lanes: aquatic animals only · Iara |
| 5 | Caatinga | the drought cuts your seed production · Mapinguari |
| 6 | Amazon | fog hides the field — you need an Owl · **the Boto** |
| 7 | Northeast Coast | night + two lanes of water · the invisible Bogeyman |
| 8 | Downtown São Paulo | big hordes |
| 9 | Mantiqueira Range | fog · the Mother of Gold flies over the defence |
| 10 | Christ the Redeemer | **the Cuca** |

**🇯🇵 Japan** (unlocked by freeing Brazil, with an interlude film in between):

| # | Stage | What changes |
|---|---|---|
| 1 | Cherry Blossom Village | the Karakasa, and a tougher baseline |
| 2 | Rice Terraces | two flooded lanes · the Kappa and his bowl |
| 3 | Bamboo Grove | the Kitsune and her illusions |
| 4 | Tengu Mountain | the Tengu lands behind your wall |
| 5 | Midnight Road | night · the Rokurokubi eats your back line |
| 6 | Blizzard | cold slows your seeds · the Yuki-onna freezes animals |
| 7 | Neon Crossing | night, big hordes · the Oni smashes in area |
| 8 | Fog Temple | fog · the Nurikabe blocks even piercing shots |
| 9 | Fuji Slopes | everything at once |
| 10 | Haunted Castle | **the Onryō** |

## Saves

Progress saves itself in the browser. Because the game runs over `file://` —
where each folder is a different origin — the **download save** button produces a
`.json` you keep wherever you like and reload with **load** on any machine.

**Restart** wipes everything and goes back to the intro. The confirmation shows
what is lost in numbers — stages, cards, coins and humans freed — and reminds you
to download the save first, because it is the only action in the game that can't
be undone.

## Working on the code

```bash
npm install       # at the slop-games root
npm run build     # → dist/index.html
```

The code lives in `src/` as ES modules, bundled by esbuild into a single HTML.

```
src/
  scribble.js       the crooked-line engine: nothing straight, nothing round
  viewport.js       elastic screen: fixed height, width follows the monitor
  palette.js        pencil colours
  audio.js          Web Audio by hand — effects and score, no files
  save.js           localStorage + download/load .json
  i18n.js           the two languages: the instance and `pick()`
  data/             animals (with levels), monsters, campaigns/stages and the economy
  draw/             the 46 sprites, the scenery and the world map
  screens/          cutscenes (the projector is slopkit's; the reels live here), map, battle and shop
  main.js           the screen machine
```

Four details worth knowing before you touch it:

- **The line must not wobble on its own.** Every deviation comes from a
  fixed-seed PRNG (`scribble.js`), never `Math.random()`. Swap it and the whole
  screen boils.
- **A sprite is drawn once.** Each animal is painted on an offscreen canvas and
  reused; redrawing 40 scribbled creatures per frame tanks the frame rate,
  because every stroke is two passes of Bézier curve.
- **The screen's width varies, its height doesn't.** Always draw against `HEIGHT`
  (720) and read `vp.W` for the width. The menu screens were composed on a
  1280-wide board and are centred by `applyFrame()`; the battle is not — there
  the extra width is real field.
- **Text lives next to what it names.** Card names and monster lore carry both
  languages in `src/data/`; screen copy is a local `T` in each screen file. A
  unit test fails on any field that exists in one language only.

To add an animal: describe it in `src/data/animals.js`, draw it in
`src/draw/animals.js`, and that's it — the shop starts rolling it on its own.
