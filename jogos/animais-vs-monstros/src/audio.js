// Som inteiro sintetizado na Web Audio API: nenhum arquivo, nenhum byte de
// áudio no bundle. O navegador só libera o contexto depois de um clique, então
// tudo aqui aceita ser chamado antes disso sem quebrar.
//
// O contexto, o volume mestre e o mudo vêm do slopkit — que guarda a escolha
// do jogador. Este jogo era o único dos quatro que esquecia o mudo ao
// recarregar a página.

import { criarSom } from 'slopkit/som';

const base = criarSom({ jogo: 'animais-vs-monstros', volume: 0.5 });

let ctx = null;
let volumeGeral = null;
let volumeMusica = null;
let musicaTocando = false;
let proximoCompasso = 0;
let timerMusica = null;

function ac() {
  const c = base.acordar();
  if (!c) return null;
  if (!volumeGeral) {
    ctx = c;
    volumeGeral = base.saida();
    volumeMusica = ctx.createGain();
    volumeMusica.gain.value = 0.28;
    volumeMusica.connect(volumeGeral);
  }
  return ctx;
}

export function acordarAudio() {
  ac();
}

export function alternarSom() {
  return base.alternar();
}

export function somLigado() {
  return base.ligado;
}

/** Envelope ADSR simplificado — a base de quase todo som daqui. */
function envelope(no, inicio, ataque, decaimento, pico, sustenido = 0) {
  no.gain.cancelScheduledValues(inicio);
  no.gain.setValueAtTime(0.0001, inicio);
  no.gain.exponentialRampToValueAtTime(pico, inicio + ataque);
  no.gain.exponentialRampToValueAtTime(Math.max(sustenido, 0.0001), inicio + ataque + decaimento);
}

function tom(freq, dur, opts = {}) {
  const c = ac();
  if (!c || !base.ligado) return;
  const { tipo = 'sine', volume = 0.3, destino = volumeGeral, deslize = 0, atraso = 0 } = opts;
  const t = c.currentTime + atraso;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t);
  if (deslize) osc.frequency.exponentialRampToValueAtTime(Math.max(freq + deslize, 20), t + dur);
  envelope(g, t, Math.min(0.01, dur * 0.2), dur, volume);
  osc.connect(g);
  g.connect(destino);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function ruido(dur, opts = {}) {
  const c = ac();
  if (!c || !base.ligado) return;
  const { volume = 0.25, corte = 1200, tipoFiltro = 'lowpass', atraso = 0, q = 1 } = opts;
  const t = c.currentTime + atraso;
  const amostras = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, amostras, c.sampleRate);
  const dados = buf.getChannelData(0);
  for (let i = 0; i < amostras; i++) dados[i] = Math.random() * 2 - 1;
  const fonte = c.createBufferSource();
  fonte.buffer = buf;
  const filtro = c.createBiquadFilter();
  filtro.type = tipoFiltro;
  filtro.frequency.value = corte;
  filtro.Q.value = q;
  const g = c.createGain();
  envelope(g, t, 0.005, dur, volume);
  fonte.connect(filtro);
  filtro.connect(g);
  g.connect(volumeGeral);
  fonte.start(t);
  fonte.stop(t + dur + 0.05);
}

// ------------------------------------------------------------------- efeitos

export const som = {
  clique: () => tom(660, 0.06, { tipo: 'triangle', volume: 0.18 }),
  erro: () => {
    tom(180, 0.12, { tipo: 'square', volume: 0.16 });
    tom(120, 0.16, { tipo: 'square', volume: 0.14, atraso: 0.06 });
  },
  plantar: () => {
    ruido(0.14, { corte: 700, volume: 0.22 });
    tom(320, 0.12, { tipo: 'sine', volume: 0.22, deslize: 120 });
  },
  colher: () => {
    tom(880, 0.08, { tipo: 'triangle', volume: 0.24 });
    tom(1320, 0.1, { tipo: 'triangle', volume: 0.18, atraso: 0.05 });
  },
  tiro: () => {
    tom(520, 0.07, { tipo: 'square', volume: 0.12, deslize: -220 });
    ruido(0.05, { corte: 2600, volume: 0.1, tipoFiltro: 'highpass' });
  },
  acerto: () => {
    ruido(0.07, { corte: 1800, volume: 0.16 });
    tom(220, 0.06, { tipo: 'triangle', volume: 0.12 });
  },
  mordida: () => {
    ruido(0.12, { corte: 900, volume: 0.26 });
    tom(140, 0.1, { tipo: 'sawtooth', volume: 0.16, deslize: -60 });
  },
  // o Boto entrando ou saindo do rio. A subida do tom é o que faz o ruído
  // grave soar como respingo em vez de pancada
  mergulho: () => {
    ruido(0.18, { corte: 700, volume: 0.2 });
    tom(180, 0.16, { tipo: 'sine', volume: 0.14, deslize: 260 });
  },
  morte: () => {
    tom(300, 0.3, { tipo: 'sawtooth', volume: 0.2, deslize: -240 });
    ruido(0.28, { corte: 600, volume: 0.18 });
  },
  explosao: () => {
    ruido(0.5, { corte: 400, volume: 0.4 });
    tom(90, 0.4, { tipo: 'sawtooth', volume: 0.3, deslize: -60 });
  },
  gelo: () => {
    tom(1400, 0.3, { tipo: 'sine', volume: 0.16, deslize: -900 });
    ruido(0.25, { corte: 5000, volume: 0.1, tipoFiltro: 'highpass' });
  },
  rugido: () => {
    tom(110, 0.6, { tipo: 'sawtooth', volume: 0.3, deslize: -50 });
    tom(165, 0.5, { tipo: 'square', volume: 0.14, deslize: -40 });
    ruido(0.55, { corte: 900, volume: 0.22 });
  },
  chefe: () => {
    tom(70, 1.1, { tipo: 'sawtooth', volume: 0.34, deslize: -18 });
    tom(105, 0.9, { tipo: 'square', volume: 0.16, deslize: -20, atraso: 0.1 });
    ruido(1, { corte: 500, volume: 0.24 });
  },
  vitoria: () => {
    [523, 659, 784, 1047].forEach((f, i) => tom(f, 0.5, { tipo: 'triangle', volume: 0.24, atraso: i * 0.13 }));
  },
  derrota: () => {
    [392, 349, 294, 220].forEach((f, i) => tom(f, 0.6, { tipo: 'sawtooth', volume: 0.2, atraso: i * 0.18 }));
  },
  moeda: () => {
    tom(988, 0.09, { tipo: 'triangle', volume: 0.22 });
    tom(1319, 0.14, { tipo: 'triangle', volume: 0.18, atraso: 0.07 });
  },
  carta: () => {
    ruido(0.16, { corte: 3200, volume: 0.14, tipoFiltro: 'highpass' });
    tom(440, 0.1, { tipo: 'triangle', volume: 0.14, deslize: 220 });
  },
  onda: () => {
    tom(160, 0.5, { tipo: 'sawtooth', volume: 0.2, deslize: 90 });
    tom(240, 0.4, { tipo: 'square', volume: 0.1, deslize: 60, atraso: 0.08 });
  },
};

// -------------------------------------------------------------------- música

// Marchinha simples: um baixo em mínimas e uma melodia pentatônica que sorteia
// notas dentro do acorde. Não repete igual, mas nunca sai do tom.
const PROGRESSAO = [
  { baixo: 110, notas: [220, 262, 330, 392] },
  { baixo: 98, notas: [196, 247, 294, 392] },
  { baixo: 87, notas: [175, 220, 262, 349] },
  { baixo: 131, notas: [262, 330, 392, 523] },
];

function compasso(indice, tensao) {
  const c = ac();
  if (!c || !base.ligado) return;
  const acorde = PROGRESSAO[indice % PROGRESSAO.length];
  const t0 = proximoCompasso;
  const dur = 2;

  tom(acorde.baixo, 1.6, { tipo: 'triangle', volume: 0.2, destino: volumeMusica, atraso: t0 - c.currentTime });

  const passos = tensao > 0.5 ? 8 : 4;
  for (let i = 0; i < passos; i++) {
    if (Math.random() > (tensao > 0.5 ? 0.45 : 0.6)) continue;
    const nota = acorde.notas[Math.floor(Math.random() * acorde.notas.length)];
    tom(nota * (Math.random() < 0.25 ? 2 : 1), 0.22, {
      tipo: 'square',
      volume: 0.075,
      destino: volumeMusica,
      atraso: t0 - c.currentTime + (i * dur) / passos,
    });
  }
  // batida
  for (let i = 0; i < 4; i++) {
    ruido(0.06, { corte: i % 2 ? 4000 : 200, volume: i % 2 ? 0.05 : 0.12, tipoFiltro: i % 2 ? 'highpass' : 'lowpass', atraso: t0 - c.currentTime + i * 0.5 });
  }
  proximoCompasso += dur;
}

export function tocarMusica(tensao = 0) {
  const c = ac();
  if (!c || musicaTocando) return;
  musicaTocando = true;
  proximoCompasso = c.currentTime + 0.1;
  let i = 0;
  const passo = () => {
    if (!musicaTocando) return;
    // agenda com folga para o áudio não engasgar quando a aba perde o foco
    while (proximoCompasso < c.currentTime + 2) compasso(i++, tensao);
    timerMusica = setTimeout(passo, 600);
  };
  passo();
}

export function pararMusica() {
  musicaTocando = false;
  if (timerMusica) clearTimeout(timerMusica);
  timerMusica = null;
}
