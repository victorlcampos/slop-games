// All DOM handling lives here: HUD, warnings, menu and the end screen.

import { t, num, dec, i18n } from './i18n.js';

const $ = (id) => document.getElementById(id);

const el = {
  hud: $('hud'),
  dist: $('s-dist'), time: $('s-time'), score: $('s-score'), style: $('s-style'),
  speed: $('s-speed'), spdBar: $('spd-bar'),
  gates: $('gates'), gHit: $('g-hit'), gTot: $('g-tot'), gMiss: $('g-miss'), gMissLine: $('g-missline'),
  yetiBar: $('yeti-bar'), yFill: $('y-fill'), yDist: $('y-dist'), yetiWarn: $('yeti-warn'),
  toasts: $('toasts'),
  overlay: $('overlay'), menu: $('menu'), over: $('over'),
  paused: $('paused'), boot: $('boot'),
  oDist: $('o-dist'), oScore: $('o-score'), oSpeed: $('o-speed'), oTime: $('o-time'),
  oGates: $('o-gates'), oGateCell: $('o-gatecell'), oBest: $('o-best'),
  overTitle: $('over-title'), overSub: $('over-sub'),
};

const SPD_ARC = 193;

let lastDist = -1, lastScore = -1, lastSpeed = -1, lastStyle = -1;

// The end screen is the one place that keeps rendered numbers around after the
// language can change under it, so it remembers what it drew and redraws on a
// flag switch. Everything else is repainted every frame anyway.
let lastGameOver = null;

export function showHud(on) {
  el.hud.classList.toggle('on', on);
}

let lastStats = null;
export function setStats({ dist, time, score, style }) {
  lastStats = { dist, time, score, style };
  const d = Math.floor(dist);
  if (d !== lastDist) { el.dist.innerHTML = `${num(d)}<small>m</small>`; lastDist = d; }
  el.time.innerHTML = `${dec(time)}<small>s</small>`;
  const sc = Math.floor(score);
  if (sc !== lastScore) { el.score.textContent = num(sc); lastScore = sc; }
  const st = Math.round(style * 10) / 10;
  if (st !== lastStyle) { el.style.textContent = `×${dec(st)}`; lastStyle = st; }
}

export function setSpeed(kmh) {
  const v = Math.round(kmh);
  if (v !== lastSpeed) {
    el.speed.textContent = v;
    lastSpeed = v;
  }
  const t2 = Math.min(kmh / 140, 1);
  el.spdBar.style.strokeDashoffset = String(SPD_ARC * (1 - t2));
}

export function setGates({ visible, hit, total, missed }) {
  el.gates.style.display = visible ? '' : 'none';
  if (!visible) return;
  el.gHit.textContent = hit;
  el.gTot.textContent = total;
  el.gMiss.textContent = missed;
  el.gMissLine.style.visibility = missed > 0 ? 'visible' : 'hidden';
}

export function setYeti({ active, distance, danger }) {
  el.yetiBar.classList.toggle('on', active);
  if (!active) return;
  el.yFill.style.width = `${Math.round(danger * 100)}%`;
  el.yDist.textContent = distance < 900 ? `${Math.round(distance)} m` : '—';
}

export function warnYeti(on) {
  el.yetiWarn.classList.toggle('on', on);
}

export function toast(text, points = 0, color = null) {
  const div = document.createElement('div');
  div.className = 'toast';
  div.innerHTML = points
    ? `${text} <span class="pts">+${points}</span>`
    : text;
  if (color) div.style.color = color;
  el.toasts.appendChild(div);
  setTimeout(() => div.remove(), 1500);
  // keep the queue short
  while (el.toasts.children.length > 5) el.toasts.firstChild.remove();
}

export function clearToasts() {
  el.toasts.innerHTML = '';
}

export function setPaused(on) {
  el.paused.classList.toggle('on', on);
}

export function hideBoot() {
  el.boot.classList.add('hidden');
  setTimeout(() => { el.boot.style.display = 'none'; }, 600);
}

export function showOverlay(which) {
  if (which === null) {
    el.overlay.classList.add('hidden');
    return;
  }
  el.overlay.classList.remove('hidden');
  el.menu.style.display = which === 'menu' ? '' : 'none';
  el.over.style.display = which === 'over' ? '' : 'none';
}

export function showGameOver(result) {
  lastGameOver = result;
  paintGameOver(result);
  showOverlay('over');
}

/* The end-screen headline comes from the dictionary, and ONLY from here.
   It used to also carry a data-pt/data-en pair in the markup, and bindText
   registers after this module does, so the markup copy won — the day a quit
   ending is wired up, the screen would silently say the Yeti got you. */
function paintGameOver({ dist, score, speed, time, gates, gatesTotal, showGates, best, reason }) {
  const key = reason === 'quit' ? 'quit' : 'yeti';
  el.overTitle.textContent = t(`over.${key}.title`);
  el.overSub.textContent = t(`over.${key}.sub`);
  el.oDist.textContent = num(dist);
  el.oScore.textContent = num(score);
  el.oSpeed.textContent = num(speed);
  el.oTime.textContent = num(time);
  el.oGateCell.style.display = showGates ? '' : 'none';
  el.oGates.textContent = showGates ? `${gates}/${gatesTotal}` : '—';
  el.oBest.textContent = best.isNew
    ? t('over.newBest', { previous: num(best.previous) })
    : t('over.best', { value: num(best.value) });
}

i18n.onChange(() => {
  if (lastGameOver) paintGameOver(lastGameOver);
  // The live counters carry a formatted number too. Invalidating the memo and
  // leaving it to the next frame is not enough: setStats is only called from
  // step(), and step() is skipped while the game is paused — so a flag change
  // on a paused run left the distance, the score and the multiplier in the old
  // language until the player unpaused. Repaint from the last values instead.
  lastScore = -1;
  lastDist = -1;
  lastStyle = -1;
  if (lastStats) setStats(lastStats);
});

export function bindMenu({ onStart, onAgain, onMenu, onMode }) {
  const modeButtons = Array.from(document.querySelectorAll('.mode'));
  let selected = 'free';

  modeButtons.forEach((b) => {
    b.addEventListener('click', () => {
      modeButtons.forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      selected = b.dataset.mode;
      onMode?.(selected);
    });
  });

  $('btn-start').addEventListener('click', () => onStart(selected));
  $('btn-again').addEventListener('click', () => onAgain(selected));
  $('btn-menu').addEventListener('click', () => onMenu());

  return { getMode: () => selected };
}

export const dom = el;
