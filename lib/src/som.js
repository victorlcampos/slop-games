// Áudio: o contexto, o volume e o botão de mudo.
//
// Três dos quatro jogos já guardavam o estado do mudo no localStorage — o
// Animais vs Monstros era o único que esquecia a escolha ao recarregar. Aqui
// isso vem de graça.
//
// O navegador só libera o áudio depois de um gesto do usuário, então tudo
// aceita ser chamado antes disso sem quebrar: o contexto nasce no primeiro
// `acordar()`, que você chama no primeiro clique/toque.

export function criarSom(cfg = {}) {
  const { jogo = 'jogo', volume = 0.5 } = cfg;
  const chave = `${jogo}:som`;

  let ctx = null;
  let mestre = null;
  let ligado = true;

  try {
    const guardado = localStorage.getItem(chave);
    if (guardado !== null) ligado = JSON.parse(guardado).ligado !== false;
  } catch {
    /* sem storage: começa ligado */
  }

  function guardar() {
    try {
      localStorage.setItem(chave, JSON.stringify({ ligado }));
    } catch {
      /* modo privado */
    }
  }

  const api = {
    get ligado() {
      return ligado;
    },
    get ctx() {
      return ctx;
    },

    /** Chame no primeiro gesto do usuário. Antes disso o navegador bloqueia. */
    acordar() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        mestre = ctx.createGain();
        mestre.gain.value = ligado ? volume : 0;
        mestre.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    },

    /** Nó onde ligar seus osciladores. */
    saida() {
      api.acordar();
      return mestre;
    },

    alternar() {
      ligado = !ligado;
      if (mestre) mestre.gain.value = ligado ? volume : 0;
      guardar();
      return ligado;
    },

    definir(v) {
      ligado = !!v;
      if (mestre) mestre.gain.value = ligado ? volume : 0;
      guardar();
      return ligado;
    },

    /** Um bipe simples, para não obrigar todo jogo a escrever o seu. */
    tom(freq, dur = 0.1, { tipo = 'sine', ganho = 0.25, atraso = 0, deslize = 0 } = {}) {
      const c = api.acordar();
      if (!c || !ligado) return;
      const t = c.currentTime + atraso;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = tipo;
      osc.frequency.setValueAtTime(freq, t);
      if (deslize) osc.frequency.exponentialRampToValueAtTime(Math.max(freq + deslize, 20), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(ganho, t + Math.min(0.01, dur * 0.2));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(mestre);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },
  };

  return api;
}
