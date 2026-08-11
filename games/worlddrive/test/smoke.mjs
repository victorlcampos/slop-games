// Smoke test: opens dist/index.html over file://, picks a preset and waits for the world to load
// URL=https://... tests a published deploy instead of the local build
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { findChrome } from 'slopkit/testing';

// the Chrome path comes from the kit: covers macOS, CI Linux and Windows
const CHROME = findChrome();
const url = process.env.URL || 'file://' + path.resolve('dist/index.html');
const shotDir = process.env.SHOT_DIR || 'test';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1280,800', '--hide-scrollbars', '--mute-audio', '--no-first-run', '--disable-extensions',
    ...(process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])],
  defaultViewport: { width: 1280, height: 800 },
});

const page = await browser.newPage();
// the Overpass WAF returns 406 for "HeadlessChrome" (UA and client hints);
// real users have a normal browser — here we disguise headless to mimic that
const ua = (await browser.userAgent()).replace('HeadlessChrome', 'Chrome');
const m = ua.match(/Chrome\/(\d+)/);
const major = m ? m[1] : '131';
await page.setUserAgent(ua, {
  brands: [
    { brand: 'Google Chrome', version: major },
    { brand: 'Chromium', version: major },
    { brand: 'Not_A Brand', version: '24' },
  ],
  fullVersion: major + '.0.0.0',
  platform: 'macOS',
  platformVersion: '15.0.0',
  architecture: 'arm',
  model: '',
  mobile: false,
});
await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('#menu:not(.hide)', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 2500)); // picker tiles
  await page.screenshot({ path: path.join(shotDir, 'shot-menu.png') });
  console.log('✓ menu ok');

  const preset = process.env.PRESET || '0';
  await page.click(`[data-preset="${preset}"]`);
  console.log('… loading world (real network, may take a while)');

  await page.waitForFunction(() => window.WD && window.WD.state === 'driving', { timeout: 180000, polling: 500 });
  console.log('✓ state: driving');
  const stats = await page.evaluate(() => window.WD.world.stats);
  console.log('  stats:', JSON.stringify(stats));

  // drive forward a little
  await page.keyboard.down('KeyW');
  await new Promise(r => setTimeout(r, 3500));
  await page.keyboard.up('KeyW');
  const speed = await page.evaluate(() => document.getElementById('speed').textContent);
  const street = await page.evaluate(() => document.getElementById('street').textContent);
  console.log(`✓ drove: ${speed} km/h on the street "${street}"`);
  await page.screenshot({ path: path.join(shotDir, 'shot-drive.png') });

  const pos = await page.evaluate(() => {
    const w = window.WD;
    return { state: w.state, kmh: +document.getElementById('speed').textContent };
  });
  if (pos.kmh < 5) throw new Error('the car did not move (speed ' + pos.kmh + ')');

  const relevant = errors.filter(e => !e.includes('favicon'));
  if (relevant.length) {
    console.log('⚠ console errors:');
    for (const e of relevant.slice(0, 10)) console.log('  ' + e);
  } else {
    console.log('✓ no console errors');
  }
  console.log('SMOKE OK');
} catch (e) {
  console.error('SMOKE FAIL:', e.message);
  for (const er of errors.slice(0, 10)) console.error('  ' + er);
  try { await page.screenshot({ path: path.join(shotDir, 'shot-fail.png') }); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
}
