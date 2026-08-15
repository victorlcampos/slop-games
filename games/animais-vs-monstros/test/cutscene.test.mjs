// The two films, played in Node, frame by frame.
//
// This exists because of a bug that no amount of reading caught and that the
// whole suite was blind to: the Japan reel called `line()` and the module never
// imported it. Four of its five scenes threw on their first frame.
//
// The failure is worth describing, because it is not "the game crashes". The
// loop schedules its next frame *before* it draws, so the film kept running
// with a `ReferenceError` a frame — the picture froze half-painted, and the
// caption, which the projector writes after the scene, never appeared at all.
// A film with no words and no motion, and a console nobody had open.
//
// So this drives both reels the way the loop does — update, draw, on to the
// next scene — and reads the strings back off the canvas. A scene that throws
// fails here; a caption that never reaches the screen fails here too.

import { installHeadlessDom, scenario, check, checkEqual, run } from 'slopkit/testing';

installHeadlessDom({ width: 1280, height: 720 });

const { createCutscene, SCENES, JAPAN_SCENES } = await import('../src/screens/cutscene.js');
const { i18n } = await import('../src/i18n.js');
const { resetScreenText, screenText } = await import('../src/scribble.js');

const REELS = { intro: SCENES, japan: JAPAN_SCENES };

const ctx = document.createElement('canvas').getContext('2d');
const STEP = 1 / 60;

/**
 * Plays a whole reel and returns everything it wrote, one string per scene.
 * A scene that throws while drawing takes the run down here, which is the
 * point — in the browser it only takes the picture down.
 */
function play(scenes) {
  const film = createCutscene(() => {}, scenes);
  const said = [];
  for (const scene of scenes) {
    let words = '';
    // stopping a fifth of a second short of the end: the projector fades the
    // caption out with the scene, and the last frames carry almost nothing
    for (let t = 0; t < scene.duration - 0.2; t += STEP) {
      resetScreenText();
      film.draw(ctx);
      words += ` ${screenText()}`;
      film.update(STEP);
    }
    said.push(words);
  }
  return said;
}

for (const [name, reel] of Object.entries(REELS)) {
  for (const lang of ['en', 'pt']) {
    scenario(`the ${name} film plays to the end and speaks, in ${lang}`, () => {
      i18n.set(lang);
      const said = play(reel);
      checkEqual(said.length, reel.length, 'a scene went missing');
      reel.forEach((scene, i) => {
        if (!scene.line) return;
        // the opening words of the caption: enough to tell the two languages
        // apart, short enough to survive an edit to the rest of the sentence
        const opening = scene.line[lang].slice(0, 22);
        check(said[i].includes(opening), `scene ${i + 1} never said "${opening}…" in ${lang}`);
      });
    });
  }
}

scenario('every scene of both films carries both languages', () => {
  for (const [name, reel] of Object.entries(REELS)) {
    reel.forEach((scene, i) => {
      check(scene.duration > 0, `${name} scene ${i + 1} is on screen for ${scene.duration}s`);
      if (!scene.line) return;
      check(scene.line.pt && scene.line.en, `${name} scene ${i + 1} is missing a language`);
      check(scene.line.pt !== scene.line.en, `${name} scene ${i + 1}: one side was pasted`);
    });
  }
});

i18n.set('en');
await run('animals vs monsters — the films');
