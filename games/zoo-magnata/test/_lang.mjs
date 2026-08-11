import { launchBrowser, open } from 'slopkit/testing';
const b = await launchBrowser();
const g = await open(b, '/Users/victorcampos/Workspace/slop-games/games/zoo-magnata/dist/index.html');
await g.waitFrames(3);
for (const lang of ['en', 'pt']) {
  const r = await g.exec((game, l) => {
    game.i18n.set(l);
    return { lang: game.i18n.lang, species: LN(SPECIES[0].name), key: SPECIES[0].key,
             terrain: LN(TERRAIN.grass.n), staff: LN(STAFF_TYPES.trat.n),
             bi: BI`ola|hello`, splash: document.querySelector('#btnStart')?.textContent,
             money: moneyFull(1500) };
  }, lang);
  console.log(lang, JSON.stringify(r));
}
console.log('erros:', g.errors);
await g.close(); await b.close();
