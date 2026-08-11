import { launchBrowser, open } from 'slopkit/testing';
const b = await launchBrowser();
const g = await open(b, '/Users/victorcampos/Workspace/slop-games/games/zoo-magnata/dist/index.html');
await g.waitFrames(3);
const r = await g.exec(() => {
  const miss = [], byGesture = {};
  for (const sp of SPECIES) {
    const gest = gestureOf(sp);
    byGesture[gest] = (byGesture[gest] || 0) + 1;
    if (typeof SFX['_g_' + gest] !== 'function') miss.push(sp.key + ' -> ' + gest);
  }
  const excs = Object.keys(GESTURE_SPECIES).filter(k => !SPECIES.some(s => s.key === k));
  return { species: SPECIES.length, missing: miss.slice(0, 8), gestures: Object.keys(byGesture).length,
           deadExceptions: excs, zebra: gestureOf(SPECIES.find(s => s.key === 'Plains zebra')),
           fox: gestureOf(SPECIES.find(s => s.key === 'Red fox')) };
});
console.log(JSON.stringify(r, null, 1));
console.log('erros:', g.errors);
await g.close(); await b.close();
