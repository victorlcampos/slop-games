// Ponto de entrada: liga o jogo à interface.

import { createGame } from './game.js';
import * as hud from './hud.js';

const container = document.getElementById('app');

function fail(message, detail) {
  document.getElementById('boot').innerHTML = `
    <div class="b" style="max-width:520px;padding:0 24px">
      <div style="font-size:34px;margin-bottom:12px">⛔</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:8px">${message}</div>
      <div style="font-size:12px;color:rgba(255,255,255,.45);line-height:1.6">${detail}</div>
    </div>`;
}

// WebGL disponível?
try {
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2') || probe.getContext('webgl');
  if (!gl) throw new Error('sem contexto');
} catch (e) {
  fail('Este navegador não tem WebGL disponível.',
       'Ative a aceleração por hardware ou tente outro navegador.');
  throw e;
}

let game;
try {
  game = createGame(container);
} catch (e) {
  fail('Não foi possível iniciar a montanha.', String(e && e.message ? e.message : e));
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

// atalho: espaço/enter também começam a partida do menu
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

// deixa acessível para depuração no console
window.__ski = game;
