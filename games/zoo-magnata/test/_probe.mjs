import { launchBrowser, open } from 'slopkit/testing';
const b = await launchBrowser();
const g = await open(b, '/Users/victorcampos/Workspace/slop-games/games/zoo-magnata/dist/index.html');
await g.waitFrames(3);
console.log('antes:', JSON.stringify(await g.exec(() => ({
  splash: !!document.querySelector('#splash'),
  botoes: [...document.querySelectorAll('#splash button, #splash .btn')].map(b => b.id + '|' + b.className + '|' + b.textContent.trim().slice(0, 24)),
  speed: G.speed, day: G.day,
}))));
await g.exec(() => { document.querySelector('#splash .btn')?.click(); });
await g.waitFrames(5);
console.log('depois:', JSON.stringify(await g.exec(() => ({ splash: document.querySelector('#splash')?.style.display, speed: G.speed, hour: G.hour }))));
console.log('erros:', g.errors);
await g.close(); await b.close();
