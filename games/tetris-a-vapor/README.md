# Steam Stack / Pilha a Vapor

A falling-block game built as a brass pressure engine. Seven moulds descend into
a 10 × 20 boiler; every complete row is punched apart into enamel shards,
sparks, smoke and loose gears. The soundtrack is a 148 BPM rock loop made at
runtime from oscillators and filtered noise, so the game ships no audio file.

## Play

- Move with `←` / `→` or `A` / `D`.
- Soft-drop with `↓` or `S`.
- Hard-drop with `Space`.
- Rotate clockwise with `↑`, `W` or `X`; rotate counter-clockwise with `Z`.
- Hold a piece with `C` or either `Shift` key.
- Pause with `P` or `Escape`; mute with `M`.
- On touch screens, six brass valves under the board provide move, drop, rotate
  and hold controls. Movement valves repeat while held; the destructive actions
  fire once per press.

The game uses a shuffled seven-bag, a landing ghost, wall kicks, a lock delay,
five-piece preview, hold, combos, back-to-back four-row clears and ten-row level
steps. A clean boiler earns a perfect-clear bonus. Best score, rows, pressure
level and number of runs are kept in `localStorage`.

## What is drawn and synthesised

Canvas 2D draws every enamel block, bevel, rivet, pipe, gear, gauge and plume of
steam. Clearing a row can release sparks, coloured shards, smoke, shock lines
and spinning gears; a four-row clear drives the largest blast and screen shake.

Web Audio builds the music after the first player gesture. Detuned, clipped
sawtooths form power chords; a filtered square wave supplies bass; shaped noise
and swept sine waves become hats, snare and kick. Movement, rotation, locking,
line clears, pressure changes and game over have separate synthesised cues.

## Build and test

```bash
npm run build --workspace tetris-a-vapor
npm run test --workspace tetris-a-vapor
```

The build produces one self-contained `dist/index.html`. It opens from a double
click and depends on no network, server, image, font or sound file.
