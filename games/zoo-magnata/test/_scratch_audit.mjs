// SCRATCH — translation audit driver. Deleted before the pass ends.
import { launchBrowser, open, DEVICES, wait } from 'slopkit/testing';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const GAME = path.join(ROOT, 'dist', 'zoo-magnata', 'index.html');
const browser = await launchBrowser();

const buildPark = (game) => {
  for (let y = 49; y <= 55; y++) addPath(27, y);
  for (let x = 19; x <= 27; x++) addPath(x, 50);
  for (let x = 19; x <= 25; x++) addPath(x, 49);
  const tiles = [];
  for (let y = 44; y < 49; y++) for (let x = 20; x < 25; x++) tiles.push(IDX(x, y));
  const e = makeEnclosure(tiles, 'wood');
  G.money = 5e6;
  buyFor(SPECIES[0], e); buyFor(SPECIES[0], e);
  placeObject('feeder', 'encobj', 21, 45);
  placeObject('trough', 'encobj', 22, 45);
  hire('keeper'); hire('vet'); hire('cleaner'); hire('security');
  placeObject('snackbar', 'build', 22, 51);
  placeObject('bin', 'build', 25, 51);
  placeObject('tree', 'deco', 24, 51);
  setSpeed(4);
};

const DUMP = `(() => {
  const out = [];
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) {
        const t = c.textContent.trim();
        if (t) { const el = c.parentElement;
          out.push({ t, tag: el ? el.tagName : '?', id: el ? el.id : '', cls: (el && typeof el.className === 'string') ? el.className : '' }); }
      } else if (c.nodeType === 1) {
        if (c.tagName === 'SCRIPT' || c.tagName === 'STYLE') continue;
        for (const a of ['title','placeholder','alt','aria-label','value']) {
          const v = c.getAttribute && c.getAttribute(a);
          if (v && v.trim()) out.push({ t: v.trim(), tag: c.tagName + '@' + a, id: c.id||'', cls: (typeof c.className==='string')?c.className:'' });
        }
        walk(c);
      }
    }
  };
  walk(document.body);
  out.push({ t: document.title, tag: 'TITLE', id: '', cls: '' });
  return out;
})()`;

const PT = /[ãõáéíóúâêôàçÃÕÁÉÍÓÚÂÊÔÇ]|\b(você|voce|não|nao|jogar|todos os jogos|dias?|animais|recinto|salvar|carregar|ligado|desligado|pontos|nível|nivel|comprar|vender|visitantes|felicidade|saúde|equipe|reputação|comida|água|preço|custo|lucro|receita|despesa)\b/i;

const seen = new Set();
function judge(where, en, pt) {
  const key = (r) => r.tag + '|' + r.id + '|' + r.cls;
  for (const r of [...en.map(r => ({ ...r, L: 'en' })), ...pt.map(r => ({ ...r, L: 'pt' }))]) {
    if (/[^\s|]\|[^\s|]/.test(r.t) && r.t.length < 400) {
      const k = 'PIPE' + r.t;
      if (!seen.has(k)) { seen.add(k); console.log(`  RAW-PIPE [${r.L}] @${where} <${r.tag} id=${r.id} class=${r.cls}> ${JSON.stringify(r.t.slice(0, 200))}`); }
    }
  }
  const enSet = new Set(en.map(r => key(r) + '::' + r.t));
  for (const r of pt) {
    const k = key(r) + '::' + r.t;
    if (enSet.has(k) && PT.test(r.t) && r.t.length < 300) {
      const kk = 'SAME' + r.t;
      if (r.t === 'Português') continue;
      if (!seen.has(kk)) { seen.add(kk); console.log(`  SAME-IN-BOTH @${where} <${r.tag} id=${r.id} class=${r.cls}> ${JSON.stringify(r.t.slice(0, 200))}`); }
    }
  }
}

const g = await open(browser, GAME, DEVICES.desktop);
await wait(600);
await g.exec(() => { document.querySelector('#splash .btn')?.click(); });
await g.waitFrames(3);
await g.exec(buildPark);
await g.exec(() => { G.hour = 12; });
await wait(2500);

async function snap(where, prep) {
  for (const lang of ['en', 'pt']) {
    await g.setLang(lang);
    await wait(250);
    if (prep) { await g.exec(prep); await wait(350); }
  }
  await g.setLang('en'); if (prep) { await g.exec(prep); await wait(400); }
  const en = await g.page.evaluate(DUMP);
  await g.setLang('pt'); if (prep) { await g.exec(prep); await wait(400); }
  const pt = await g.page.evaluate(DUMP);
  judge(where, en, pt);
}

// every dock category
for (const cat of ['path', 'enclosure', 'terrain', 'encobj', 'build', 'deco']) {
  await snap('palette:' + cat, new Function('game', `openCategory(${JSON.stringify(cat)}); setTool(G.tool)`));
}
// tools selected -> hint bar
for (const cat of ['path', 'enclosure', 'terrain', 'encobj', 'build', 'deco', 'demolish']) {
  await snap('hint:' + cat, new Function('game', `openCategory(${JSON.stringify(cat)}); const it=document.querySelector('#palette .pitem'); if(it) it.click(); else openCategory(${JSON.stringify(cat)});`));
}
// modals
await snap('shop', () => { closeModal(); openShop(); });
await snap('shop:forEnc', () => { closeModal(); openShop(G.encs[0].id); });
await snap('staff', () => { closeModal(); openStaff(); });
await snap('finance', () => { closeModal(); openFinance(); });
await snap('satisfaction', () => { closeModal(); openSatisfaction(); });
await snap('reputation', () => { closeModal(); openReputation(); });
await snap('help', () => { closeModal(); openHelp(); });
await snap('fence-swap', () => { closeModal(); swapFence(G.encs[0]); });
await snap('transfer', () => { closeModal(); transferir(G.animals[0]); });
// inspectors
await snap('insp:enclosure', () => { closeModal(); select('enc', G.encs[0]); });
await snap('insp:animal', () => { closeModal(); select('animal', G.animals[0]); });
await snap('insp:staff', () => { closeModal(); select('staff', G.staff[0]); });
await snap('insp:object', () => { closeModal(); const o = G.objs.find(o => o.cat === 'build') || G.objs[0]; select('obj', o); });
await snap('insp:visitor', () => { closeModal(); if (G.visitors[0]) select('visitor', G.visitors[0]); });
await snap('hud+alerts', () => { closeModal(); deselect(); updateHUD(); renderAlerts(); });

console.log('--- zoo deep sweep done ---');
await g.close();
await browser.close();
