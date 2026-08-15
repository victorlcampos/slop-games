// The way in: two screens, a state machine and two figures that are only ever
// drawn.
//
// Nothing here can look at a pixel, and that is fine — what is worth guarding on
// the entry is the half with rules in it. The flow refuses a locked arena and
// only ever starts one match; the pose says the flash exists inside its window
// and nowhere else; and both figures, and all six maps, are walked through the
// whole flourish once to prove nothing in a drawing throws.

import { scenario, check, run, headlessContext } from 'slopkit/testing';

import { createFlow, INTRO, SKIP_AFTER } from '../src/flow.js';
import { heroPose, drawHero, FRAME } from '../src/hero.js';
import { drawArenaThumb } from '../src/thumb.js';
import { buildArena } from '../src/arena.js';
import { PHASES, TEAMS } from '../src/config.js';
import { dict } from '../src/i18n.js';

const STEP = 1 / 60;

/** Run the flourish out, one frame at a time, and say what started. */
function playIntro(flow, seconds = INTRO + 0.2) {
  for (let t = 0; t < seconds; t += STEP) flow.tick(STEP);
}

// ------------------------------------------------------------------ the flow

scenario('the arena comes first, and a locked one is not an answer', () => {
  const flow = createFlow({ unlocked: 2 });
  check(flow.screen === 'arena', `the game opens on ${flow.screen}, not the arenas`);

  check(flow.chooseArena(4) === false, 'arena 5 was locked and it let him in anyway');
  check(flow.screen === 'arena', 'a refused arena still moved the screen on');

  check(flow.chooseArena(1) === true, 'the second arena is unlocked and was refused');
  check(flow.screen === 'hero', `choosing an arena landed on ${flow.screen}, not the bodies`);
  check(flow.arena === 1, `it went in with arena ${flow.arena + 1}`);
});

scenario('the body comes second, and the match waits for the flourish', () => {
  const started = [];
  const flow = createFlow({ unlocked: 3, onStart: (a, t) => started.push([a, t]) });
  flow.chooseArena(2);
  check(flow.chooseTeam('alien') === true, 'the sentinels were refused');
  check(flow.screen === 'intro', `choosing a side landed on ${flow.screen}`);
  check(started.length === 0, 'the match started before the animation had run a frame');

  // half way through, nothing has started and the pick is well under way
  for (let t = 0; t < INTRO / 2; t += STEP) flow.tick(STEP);
  check(started.length === 0, `the match started ${INTRO / 2}s early`);
  check(flow.progress > 0.4 && flow.progress < 0.6, `half way through, progress reads ${flow.progress.toFixed(2)}`);

  playIntro(flow);
  check(started.length === 1, `the field opened ${started.length} times, not once`);
  check(started[0][0] === 2 && started[0][1] === 'alien', `it opened on ${JSON.stringify(started[0])}`);
  check(flow.screen === 'playing', `the flourish finished on ${flow.screen}`);

  // and the clock cannot start it twice
  playIntro(flow);
  check(started.length === 1, 'ticking on after the match began started a second one');
});

scenario('impatience is honoured, but not on the frame of the click', () => {
  const started = [];
  const flow = createFlow({ unlocked: 1, onStart: (a, t) => started.push(t) });
  flow.chooseArena(0);
  flow.chooseTeam('human');

  check(flow.skip() === false, 'the tap that chose the side also skipped the animation it started');
  for (let t = 0; t < SKIP_AFTER + STEP; t += STEP) flow.tick(STEP);
  check(flow.skip() === true, `after ${SKIP_AFTER}s the skip was still refused`);
  check(started.length === 1 && started[0] === 'human', `skipping opened ${JSON.stringify(started)}`);
  check(flow.screen === 'playing', `skipping landed on ${flow.screen}`);
  check(flow.skip() === false, 'the skip worked twice');
});

scenario('the way back, and the way in again', () => {
  const flow = createFlow({ unlocked: 4, arena: 3, team: 'alien' });
  check(flow.arena === 3 && flow.team === 'alien', 'the save did not decide what is highlighted');

  flow.chooseArena(1);
  check(flow.back() === true, 'the bodies screen would not go back');
  check(flow.screen === 'arena', `back landed on ${flow.screen}`);
  check(flow.back() === false, 'the arenas screen went back to something');

  // the results card offers both doors, and neither of them forgets the arena
  flow.finish();
  flow.toHeroes();
  check(flow.screen === 'hero' && flow.arena === 1, 'changing sides threw the arena away');
  flow.toArenas();
  check(flow.screen === 'arena', `"pick an arena" landed on ${flow.screen}`);
});

scenario('the highlight never leaves the arenas that are open', () => {
  const flow = createFlow({ unlocked: 3, arena: 0 });
  flow.hover(-4);
  check(flow.arena === 0, `the highlight ran off the front to ${flow.arena}`);
  flow.hover(99);
  check(flow.arena === 2, `the highlight ran into a locked arena at ${flow.arena}`);

  // and a save that has opened more since is honoured without reopening the game
  flow.setUnlocked(6);
  flow.hover(5);
  check(flow.arena === 5, `with six open the highlight stopped at ${flow.arena}`);
  flow.setUnlocked(2);
  check(flow.arena === 1, `unlocking backwards left the highlight on a locked arena (${flow.arena})`);
  flow.setUnlocked(999);
  check(flow.unlocked === PHASES.length, `the save opened ${flow.unlocked} arenas out of ${PHASES.length}`);
});

// ------------------------------------------------------------------ the pose

scenario('standing there is standing there: no flash, no lift, no ring', () => {
  for (const team of TEAMS) {
    for (let t = 0; t < 12; t += 0.05) {
      const p = heroPose(team, t, 0);
      check(p.flash === 0 && p.rise === 0 && p.shock === 0 && p.lift === 0,
        `${team} idle at ${t.toFixed(2)}s is already performing: ${JSON.stringify(p)}`);
      check(p.scale === 1, `${team} idle is drawn at ${p.scale}x`);
    }
  }
});

scenario('the flourish flashes once, lifts, and stays lifted', () => {
  for (const team of TEAMS) {
    let flashed = 0;
    let lastLift = -Infinity;
    let fallsBack = 0;
    for (let k = 0.36; k <= 1.0001; k += 0.01) {
      const p = heroPose(team, 1, k);
      if (p.flash > 0) flashed++;
      if (p.lift + 1e-9 < lastLift) fallsBack++;
      lastLift = p.lift;
    }
    check(flashed > 0, `${team} never flashed`);
    check(fallsBack === 0, `${team} sank back down ${fallsBack} times after the strike`);
    const end = heroPose(team, 1, 1);
    check(end.lift > 12 && end.scale > 1.1, `${team} ends the flourish at lift ${end.lift.toFixed(1)}, scale ${end.scale.toFixed(2)}`);
    check(end.flash === 0, `${team} is still flashing at the end (${end.flash.toFixed(2)})`);
    check(end.done === true, `${team} does not know it has finished`);
  }
});

scenario('the wind-up dips, and it is over before the strike', () => {
  for (const team of TEAMS) {
    const dip = heroPose(team, 1, 0.11);
    check(dip.crouch > 0.9, `${team} barely crouches (${dip.crouch.toFixed(2)}) at the bottom of the wind-up`);
    check(dip.lift < 0, `${team} goes up during the wind-up instead of down (${dip.lift.toFixed(1)})`);
    check(heroPose(team, 1, 0.33).crouch === 0, `${team} is still crouching on the frame before the strike`);
    check(heroPose(team, 1, 0.33).charge > 0.9, `${team} reaches the strike only ${heroPose(team, 1, 0.33).charge.toFixed(2)} charged`);
  }
});

scenario('nothing about a hero is ever NaN, at any moment of any second', () => {
  let bad = 0;
  for (const team of TEAMS) {
    for (let t = 0; t < 7; t += 0.13) {
      for (const k of [0, 0.05, 0.2, 0.34, 0.5, 0.8, 1, 1.4, -0.3]) {
        const p = heroPose(team, t, k);
        for (const [key, v] of Object.entries(p)) {
          if (typeof v === 'number' && !Number.isFinite(v)) bad++, check(false, `${team}.${key} is ${v} at t=${t}, k=${k}`);
        }
      }
    }
  }
  check(bad === 0, `${bad} numbers came back as NaN or Infinity`);
});

scenario('both of them blink, and not at the same moment', () => {
  const shut = (team) => {
    let frames = 0;
    for (let t = 0; t < 10; t += 1 / 60) if (heroPose(team, t, 0).blink > 0.5) frames++;
    return frames;
  };
  for (const team of TEAMS) check(shut(team) > 2, `${team} did not blink once in ten seconds`);
  let together = 0;
  for (let t = 0; t < 10; t += 1 / 60) {
    if (heroPose('human', t, 0).blink > 0.5 && heroPose('alien', t, 0).blink > 0.5) together++;
  }
  check(together === 0, `the two of them blinked in step ${together} times — that reads as one puppet`);
});

// ------------------------------------------------------------- the drawings

scenario('both figures draw, through the whole flourish, at any size', () => {
  for (const team of TEAMS) {
    for (const [w, h] of [[360, 450], [FRAME.w, FRAME.h], [120, 150], [700, 700]]) {
      const ctx = headlessContext(w, h);
      for (let k = 0; k <= 1.0001; k += 0.05) {
        drawHero(ctx, team, w, h, heroPose(team, k * 3, k), { picked: k > 0, dim: k / 2 });
      }
    }
  }
  check(true, 'unreachable — a throw above is the failure');
});

scenario('all six arenas draw as a map, and the map is the field', () => {
  for (let i = 0; i < PHASES.length; i++) {
    const arena = buildArena(i);
    const ctx = headlessContext(224, 136);
    drawArenaThumb(ctx, arena, 224, 136);
    // the thumbnail reads the real grid, so a field with no stands to draw is a
    // field the match could not be played on either
    check(arena.flags.human && arena.flags.alien, `${arena.id} has a stand missing`);
    check(arena.spawns.human.length > 0 && arena.spawns.alien.length > 0, `${arena.id} has nowhere to spawn`);
  }
  check(true, 'unreachable — a throw above is the failure');
});

// ------------------------------------------------------------------ the copy

scenario('every phrase the two screens use exists in both languages', () => {
  const keys = [
    'game.tagline', 'menu.arena', 'menu.locked', 'menu.squad', 'menu.night', 'menu.side',
    'hero.pick', 'hero.gun',
    ...TEAMS.flatMap((team) => [`hero.${team}.role`, `hero.${team}.line`, `side.${team}`]),
  ];
  for (const key of keys) {
    const entry = dict[key];
    check(entry && entry.pt && entry.en, `${key} is missing on one side of the dictionary`);
  }
  // the two roles and the two lines are different sentences in both languages —
  // a copy-paste here is a card that says nothing about the side it is on
  for (const lang of ['pt', 'en']) {
    check(dict['hero.human.role'][lang] !== dict['hero.alien.role'][lang], `both roles read the same in ${lang}`);
    check(dict['hero.human.line'][lang] !== dict['hero.alien.line'][lang], `both quotes read the same in ${lang}`);
  }
  // and the one assembled sentence takes all three of its blanks
  for (const lang of ['pt', 'en']) {
    for (const slot of ['{gun}', '{shots}', '{rate}']) {
      check(dict['hero.gun'][lang].includes(slot), `hero.gun in ${lang} has nowhere to put ${slot}`);
    }
  }
});

await run('flag war — the way in');
