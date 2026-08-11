// Toda a manipulação de DOM fica aqui: HUD, avisos, menu e tela final.

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

export function showHud(on) {
  el.hud.classList.toggle('on', on);
}

export function setStats({ dist, time, score, style }) {
  const d = Math.floor(dist);
  if (d !== lastDist) { el.dist.innerHTML = `${d}<small>m</small>`; lastDist = d; }
  el.time.innerHTML = `${time.toFixed(1)}<small>s</small>`;
  const sc = Math.floor(score);
  if (sc !== lastScore) { el.score.textContent = sc.toLocaleString('pt-BR'); lastScore = sc; }
  const st = Math.round(style * 10) / 10;
  if (st !== lastStyle) { el.style.textContent = `×${st.toFixed(1)}`; lastStyle = st; }
}

export function setSpeed(kmh) {
  const v = Math.round(kmh);
  if (v !== lastSpeed) {
    el.speed.textContent = v;
    lastSpeed = v;
  }
  const t = Math.min(kmh / 140, 1);
  el.spdBar.style.strokeDashoffset = String(SPD_ARC * (1 - t));
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
  // segura o tamanho da fila
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

const TITLES = {
  yeti: ['Você foi devorado', 'O Yeti sempre vence. Mas você chegou longe.'],
  quit: ['Descida encerrada', 'Volte quando quiser mais neve.'],
};

export function showGameOver({ dist, score, speed, time, gates, gatesTotal, showGates, best, reason }) {
  const [title, sub] = TITLES[reason] || TITLES.yeti;
  el.overTitle.textContent = title;
  el.overSub.textContent = sub;
  el.oDist.textContent = Math.floor(dist).toLocaleString('pt-BR');
  el.oScore.textContent = Math.floor(score).toLocaleString('pt-BR');
  el.oSpeed.textContent = Math.round(speed);
  el.oTime.textContent = Math.round(time);
  el.oGateCell.style.display = showGates ? '' : 'none';
  el.oGates.textContent = showGates ? `${gates}/${gatesTotal}` : '—';
  el.oBest.textContent = best.isNew
    ? `🏔️ Novo recorde neste modo! (antes: ${Math.floor(best.previous).toLocaleString('pt-BR')})`
    : `Seu recorde neste modo: ${Math.floor(best.value).toLocaleString('pt-BR')} pontos`;
  showOverlay('over');
}

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
