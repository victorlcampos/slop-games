// Every creature is drawn, in Node, onto a canvas that keeps nothing.
//
// Not one image ships with this game: the 33 animals and monsters are 200 lines
// of crooked lines each, drawn at runtime. That is rule nº 5, and it has a
// failure mode of its own — a stroke that throws takes the whole frame with it,
// and it only happens for the one creature nobody planted while testing.
//
// So this walks the catalogue and draws all of it. It cannot tell you a sprite
// came out ugly; it tells you every one of them comes out at all, at the sizes
// the game asks for, in both languages, and that the cache hands the same
// canvas back instead of redrawing.

import { installHeadlessDom, scenario, check, run } from 'slopkit/testing';

installHeadlessDom({ width: 1280, height: 720 });

const { animalSprite, DRAWN_ANIMALS } = await import('../src/draw/animals.js');
const { monsterSprite } = await import('../src/draw/monsters.js');
const { stageBackdrop } = await import('../src/draw/scenery.js');
const { ANIMALS } = await import('../src/data/animals.js');
const { MONSTERS } = await import('../src/data/monsters.js');
const { STAGES } = await import('../src/data/stages.js');
const { i18n } = await import('../src/i18n.js');

scenario('every animal in the deck has a drawing, and it draws', () => {
  check(ANIMALS.length > 15, `only ${ANIMALS.length} animals`);
  for (const a of ANIMALS) {
    check(DRAWN_ANIMALS.includes(a.id), `${a.id} is in the deck with nobody to draw it`);
    for (const size of [48, 128]) {
      const spr = animalSprite(a.id, size);
      check(spr && spr.width > 0 && spr.height > 0, `${a.id} drew nothing at ${size}px`);
    }
  }
});

scenario('every monster draws, at the size the field uses', () => {
  check(MONSTERS.length > 10, `only ${MONSTERS.length} monsters`);
  for (const m of MONSTERS) {
    const spr = monsterSprite(m.id, 128);
    check(spr && spr.width > 0, `${m.id} drew nothing`);
  }
});

scenario('the sprite cache hands back the same canvas instead of redrawing', () => {
  const first = animalSprite(ANIMALS[0].id, 128);
  const second = animalSprite(ANIMALS[0].id, 128);
  check(first === second, 'the cache redrew a sprite it already had');

  // and a different size is a different sprite, not a stretched one
  check(animalSprite(ANIMALS[0].id, 64) !== first, 'two sizes came back as one canvas');
});

scenario('a drawing does not change with the flag', () => {
  // the sprite is seeded from the animal's id, never from its name — otherwise
  // flipping the flag would redraw the whole catalogue
  const before = i18n.lang;
  i18n.set(before === 'pt' ? 'en' : 'pt');
  const other = animalSprite(ANIMALS[1].id, 128);
  i18n.set(before);
  check(animalSprite(ANIMALS[1].id, 128) === other, 'the flag redrew the animals');
});

scenario('every stage paints its scenery', () => {
  for (const stage of STAGES) {
    const back = stageBackdrop(stage.scenery, 1280, 560);
    check(back && back.width > 0, `${stage.id || stage.scenery}: the backdrop came out empty`);
  }
});

scenario('every creature is described in both languages', () => {
  for (const list of [ANIMALS, MONSTERS]) {
    for (const c of list) {
      for (const field of ['name', 'lore']) {
        const value = c[field];
        if (value === undefined) continue;
        check(value.pt && value.en, `${c.id}: ${field} is missing a language`);
      }
      // A name can legitimately be the same on both sides — a Saci is a Saci,
      // and translating a proper noun invents a creature that does not exist.
      // A sentence cannot: `lore` reading identically means one side was pasted.
      if (c.lore) {
        check(c.lore.pt !== c.lore.en,
          `${c.id}: the lore reads the same in both languages — one side was pasted`);
      }
    }
  }
});

await run('animals vs monsters — drawing');
