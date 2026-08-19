# Ten Classics — Dez Clássicos ♟️

Ten board games on one table, each against a machine that really thinks. Four
difficulty levels move the machine's head — **and never the player's luck**.

Open `dist/index.html` on a double click. No server, no install, no account.

---

## What is in the cabinet

| | Game | What it is |
|---|---|---|
| ♟️ | **Chess** | All of it: castling, en passant, promotion to any of the four, fifty moves, insufficient material, stalemate. The move generator agrees with the published perft counts to depth four on five different positions. |
| 🟤 | **Draughts** | Brazilian rules — men capture backwards, kings fly, and you must take the line that captures the most. |
| ⚫ | **Reversi** | Every move flips a line, and a player with no move passes. The number on a legal square is how many discs it turns. |
| 🔴 | **Four in a Row** | Seven columns, six rows. Cheap enough to search that the professional reads eleven moves ahead. |
| 🎲 | **Backgammon** | Dice, blots, the bar and bearing off, with the compulsory "play as many dice as you can" rule. |
| 🎯 | **Ludo** | You against three. A six to leave the yard, a six plays again, a capture plays again, three sixes lose the turn. |
| 🔷 | **Nine Men's Morris** | Placing, moving and flying, with the mill rule that most implementations forget: a piece inside a mill is safe while any enemy piece stands outside one. |
| 🫘 | **Mancala** | Kalah: six pits a side, sow anticlockwise, a seed in your store plays again, a seed in an empty pit takes what faces it. |
| ⭕ | **Noughts and Crosses** | Solved, and the professional proves it: it cannot be beaten from either seat. |
| 🔢 | **Sudoku** | One solution, always reachable by logic — never by guessing. |

## The difficulty selector, and the promise under it

Every game has **Easy, Medium, Hard and Professional**, and all four change the
same three things about the opponent:

| | looks ahead | plays a worse move by | ignores the board |
|---|---|---|---|
| Easy | 1 move | over a pawn | 1 turn in 3 |
| Medium | 3 moves | half a pawn | 1 turn in 10 |
| Hard | 5 moves | a tenth of a pawn | almost never |
| Professional | as deep as the clock allows | never | never |

**Depth alone does not make an opponent feel easy.** A one-ply tic-tac-toe
player still blocks every three in a row, because the block is one ply away.
What makes `easy` feel like a beginner is *slack*: it sees the good move, shrugs
and plays a worse one. What makes it feel human rather than broken is the one
exception — a move that wins on the spot is always played, at every level. A
beginner hangs pieces; a beginner does not fail to deliver mate in one.

### The dice do not know what level is playing

A table here owns **two independent random streams**. `luck` is read by dice,
and by the shuffle that lays a sudoku out. `mind` is the only one the search may
read, and how much of it it reads is its own business.

That separation is the whole promise, and it is structural rather than a
convention: `roll(state, luck)` is the only function in the rules that touches
randomness, and it is not reachable from `moves`, `apply` or `evaluate`. The AI
*cannot* roll a die to think about one — and `test/ai.test.mjs` proves it twice:
the same seed throws the same dice at all four levels, and a booby-trapped luck
stream that throws when read survives every level's search.

The bug that shape exists to prevent is real and easy to write: with one
generator, a professional search that samples a hundred numbers while it
deliberates leaves the next throw a hundred draws down the stream. Same seed,
same board, different dice — and the harder opponent quietly got a different
game.

### And in sudoku, where nobody is sitting opposite

There is no machine to play, so the level is **how much thinking the grid asks
of you**, measured in the technique a solver needs to finish it without ever
guessing:

| | needs |
|---|---|
| Easy | naked singles |
| Medium | hidden singles |
| Hard | naked pairs |
| Professional | pointing pairs and box-line reduction |

Every grid at every level has exactly one solution and is solvable by logic
alone. The cheap version of "hard" — take out more clues and hope — produces
grids that need guessing, which is not difficulty, it is a coin toss with extra
steps. So the generator measures what it made: it carves, asks the solver which
technique it could not avoid, and throws the grid away if the answer is too
easy.

## Playing

Tap a piece, then where it goes. On the board:

* the last move stays lit, and the piece you picked up glows;
* where it can go is a dot — or a ring, if something is standing there;
* a king in check sits in a pool of red;
* in draughts only the pieces that *must* capture can be picked up, and a whole
  capture chain is chosen by its last square;
* in reversi the number on a square is how many discs it turns;
* in backgammon and ludo you tap to throw. The machine throws by itself.

**Keyboard:** `Z` undo · `R` new game · `H` hint · `Esc` back to the cabinet ·
`Space` throw · in sudoku, `1`–`9` write, `N` toggles the pencil, arrows move.

## How it is built

```
src/
  engine/rng.js      two random streams, and why there are two
  engine/ai.js       one alpha-beta search, four heads
  games/*.js         ten rule books — pure functions, no drawing
  views/*.js         ten boards — drawing only, no rules
  render/*.js        the materials: wood, felt, marble, brass, and the pieces
  match.js           turns, animation, undo, sound
  main.js            the three screens
```

The split between `games/` and `views/` is what makes the whole thing testable:
the rules run in Node with no browser, and the test suite never touches a
canvas. Everything on screen is drawn by code — the wood grain, the felt, the
Staunton pieces, the dice, the flags in the language picker. Not one image
ships with this game.

### Two decisions worth knowing about

**The root of the search uses a full window.** Narrowing it to `alpha` is the
textbook saving and it is wrong here: this search does not only want the best
move, it wants comparable *scores*, because the level's slack picks among them.
A fail-soft alpha-beta returns a bound for everything that fails low — a losing
move came back as -5 instead of -1000000, landed inside the window, and the
professional played it.

**The transposition table stores flags, not bare numbers.** A stored score is
only a value when the node was searched between its full window; anything else
is a bound. Storing bounds as values is not an optimisation, it is a lie, and
tic-tac-toe's professional announced a forced win from a position where it was
the one getting forked.

## Tests

```bash
npm test                     # both files, about ten seconds
node test/rules.test.mjs     # the ten rule books
node test/ai.test.mjs        # the opponent, and the promise
```

57 scenarios. The rules are checked against positions set up by hand — perft
counts for chess, the compulsory-maximum capture in draughts, the mill
exception in morris, the empty-pit capture in mancala, the shut-out pass in
backgammon. The opponent is checked by playing it against itself and by
tactical positions where there is one right answer.

What no test here can answer is whether it still *looks* right. That is a lap
by hand before a deploy: open the cabinet, start a game, flip the flag.
