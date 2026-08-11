// Entry point: wires the game to the interface.

import { createGame } from './game.js';
import * as hud from './hud.js';
import { i18n, t } from './i18n.js';
import { mountLangPicker, bindText } from 'slopkit/langpicker';

const container = document.getElementById('app');

// The menu, the mode cards and the key hints are written inline in the HTML in
// both languages — they are on screen before this runs, and bindText only
// swaps them when the player picks a flag.
bindText(i18n);
mountLangPicker(i18n, { width: 28 });

const applyTitle = () => {
  document.title = t('page.title');
};
applyTitle();
i18n.onChange(applyTitle);

function fail(message, detail) {
  document.getElementById('boot').innerHTML = `
    <div class="b" style="max-width:520px;padding:0 24px">
      <div style="font-size:34px;margin-bottom:12px">⛔</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:8px">${message}</div>
      <div style="font-size:12px;color:rgba(255,255,255,.45);line-height:1.6">${detail}</div>
    </div>`;
}

// WebGL available?
try {
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2') || probe.getContext('webgl');
  if (!gl) throw new Error('no context');
} catch (e) {
  fail(t('boot.noWebGL'), t('boot.noWebGLHint'));
  throw e;
}

let game;
try {
  game = createGame(container);
} catch (e) {
  fail(t('boot.failed'), String(e && e.message ? e.message : e));
  throw e;
}

hud.bindMenu({
  onStart: (mode) => game.start(mode),
  onAgain: (mode) => game.start(game.state.mode || mode),
  onMenu: () => game.backToMenu(),
});

game.init();
hud.showOverlay('menu');
hud.hideBoot();

// shortcut: space/enter also start the run from the menu
addEventListener('keydown', (e) => {
  if (game.state.phase === 'menu' && (e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault();
    document.getElementById('btn-start').click();
  }
  if (game.state.phase === 'over' && e.code === 'Enter') {
    e.preventDefault();
    document.getElementById('btn-again').click();
  }
});

// The test bridge, and a handle for poking at the game in the console.
window.__game = { name: 'skifree3d', i18n, game };
window.__ski = game;
