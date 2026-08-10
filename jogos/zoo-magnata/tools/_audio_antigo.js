/* ==========================================================================
   6c. SOM — tudo sintetizado, zero arquivos
   O jogo é um HTML só e roda offline: não há como carregar .mp3. Então o áudio
   segue a mesma ideia dos sprites — é gerado por código. A voz de cada bicho
   sai do PLANO CORPORAL e do TAMANHO (esc), do mesmo jeito que o desenho, e um
   PRNG semeado pelo nome dá individualidade estável a cada espécie.
   ========================================================================== */
/* Gesto sonoro por família, com exceções por espécie onde o bicho foge do
   padrão do grupo (zebra late em vez de relinchar; raposa late em vez de uivar). */
const GESTO_PLANO = {
  felino: 'rugido', urso: 'rosnado', canino: 'uivo', elefante: 'trombeta',
  girafa: 'bufo', equino: 'relincho', bovino: 'mugido', ungulado: 'balido',
  camelideo: 'balido', primata: 'grito', ave: 'piado', pernalta: 'piado',
  pinguim: 'grasnado', cobra: 'chiado', lagarto: 'reptil', tartaruga: 'reptil',
  anfibio: 'coaxo', peixe: 'assobio', foca: 'bufoFoca', morcego: 'guincho',
  inseto: 'zumbido', roedor: 'guincho', musteli: 'guincho', suino: 'grunhido',
  canguru: 'grunhido', preguica: 'guincho', rino: 'grunhido', hipo: 'grunhido',
};
const GESTO_ESPECIE = {
  'Zebra-de-planície': 'zurro', 'Zebra-de-grevy': 'zurro',
  'Raposa-vermelha': 'latido', 'Raposa-do-ártico': 'latido', 'Fennec': 'latido',
  'Mabeco': 'latido', 'Dingo': 'latido', 'Coiote': 'uivo', 'Cuon': 'latido',
  'Gato-do-mato': 'miado', 'Jaguatirica': 'miado', 'Caracal': 'miado', 'Serval': 'miado',
  'Orca': 'assobio', 'Beluga': 'assobio', 'Morsa': 'bufoFoca',
  'Suricato': 'guincho', 'Quati': 'guincho', 'Panda-vermelho': 'guincho',
  'Avestruz': 'grunhido', 'Ema': 'grunhido', 'Emu': 'grunhido', 'Casuar': 'grunhido',
};
const gestoDe = sp => GESTO_ESPECIE[sp.nome] || GESTO_PLANO[sp.plano] ||
  (sp.esc > 1.2 ? 'grunhido' : 'guincho');

const SFX = {
  ctx: null, mestre: null, multidao: null, noite: null,
  ligado: true, vol: .65,
  _ult: new Map(),        // antisspam por evento
  _ativas: 0,             // vozes tocando agora (teto de polifonia)
  _proxBicho: 0,

  /** O contexto só pode nascer num gesto do usuário (política de autoplay). */
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    this.mestre = this.ctx.createGain();
    this.mestre.gain.value = this.ligado ? this.vol : 0;
    // teto suave: evita estouro quando muitos sons coincidem
    const lim = this.ctx.createDynamicsCompressor();
    lim.threshold.value = -12; lim.knee.value = 12; lim.ratio.value = 6;
    this.mestre.connect(lim).connect(this.ctx.destination);
    this._ambiente();
  },
  aplicarVolume() {
    if (!this.ctx) return;
    const g = this.ligado ? this.vol : 0;
    this.mestre.gain.setTargetAtTime(g, this.ctx.currentTime, .05);
  },
  /** true se pode tocar `nome` agora (respeitando o intervalo mínimo) */
  _passa(nome, msMin) {
    if (!this.ctx || !this.ligado) return false;
    if (this._ativas > 14) return false;
    const t = performance.now(), u = this._ult.get(nome) || 0;
    if (t - u < (msMin || 45)) return false;
    this._ult.set(nome, t);
    return true;
  },

  /* ---- blocos de síntese ---- */
  /** oscilador com envelope; f2 faz varredura de frequência */
  _tom({ f = 440, f2, tipo = 'sine', t = 0, dur = .18, vol = .3, atk = .006, vib, vibF = 6, dest, lp }) {
    const c = this.ctx, t0 = c.currentTime + t;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
    if (vib) {  // vibrato: dá vida a rugido, mugido, relincho
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = vibF; lg.gain.value = vib;
      lfo.connect(lg).connect(o.frequency); lfo.start(t0); lfo.stop(t0 + dur + .05);
    }
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    if (lp) {   // corta o brilho: é o que separa "grave profundo" de "áspero genérico"
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = .7;
      o.connect(g).connect(f).connect(dest || this.mestre);
    } else o.connect(g).connect(dest || this.mestre);
    o.start(t0); o.stop(t0 + dur + .05);
    this._ativas++; o.onended = () => this._ativas--;
  },
  /** rajada de ruído filtrado: baque, pincelada, chiado, sopro */
  _ruido({ t = 0, dur = .18, vol = .3, tipo = 'lowpass', f = 900, f2, Q = 1, dest, lp }) {
    const c = this.ctx, t0 = c.currentTime + t;
    const n = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1);
    const src = c.createBufferSource(); src.buffer = buf;
    const bq = c.createBiquadFilter(); bq.type = tipo; bq.Q.value = Q;
    bq.frequency.setValueAtTime(f, t0);
    if (f2) bq.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + .008);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    if (lp) {
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = .7;
      src.connect(bq).connect(g).connect(fl).connect(dest || this.mestre);
    } else src.connect(bq).connect(g).connect(dest || this.mestre);
    src.start(t0); src.stop(t0 + dur + .02);
    this._ativas++; src.onended = () => this._ativas--;
  },
  _acorde(freqs, { tipo = 'sine', dur = .3, vol = .16, passo = .07 } = {}) {
    freqs.forEach((f, i) => this._tom({ f, tipo, dur, vol, t: i * passo }));
  },

  /* ---- eventos do jogo ---- */
  toca(nome) {
    switch (nome) {
      case 'ui':        if (!this._passa(nome, 35)) return; this._tom({ f: 880, f2: 1180, dur: .05, vol: .12 }); break;
      case 'aba':       if (!this._passa(nome, 60)) return; this._tom({ f: 520, f2: 780, dur: .09, vol: .14, tipo: 'triangle' }); break;
      case 'abrir':     if (!this._passa(nome, 80)) return; this._acorde([440, 660], { dur: .16, vol: .1, passo: .04 }); break;
      case 'fechar':    if (!this._passa(nome, 80)) return; this._acorde([660, 440], { dur: .14, vol: .09, passo: .04 }); break;
      case 'erro':      if (!this._passa(nome, 180)) return; this._tom({ f: 190, f2: 110, tipo: 'square', dur: .17, vol: .16 }); break;
      case 'trilha':    if (!this._passa(nome, 55)) return; this._ruido({ dur: .07, vol: .16, f: 1600, f2: 500 }); break;
      case 'terreno':   if (!this._passa(nome, 55)) return; this._ruido({ dur: .1, vol: .1, tipo: 'bandpass', f: 700, f2: 1500, Q: .7 }); break;
      case 'predio':    if (!this._passa(nome, 90)) return;
        this._ruido({ dur: .16, vol: .22, f: 700, f2: 160 }); this._tom({ f: 150, f2: 80, tipo: 'triangle', dur: .2, vol: .16 }); break;
      case 'construir': if (!this._passa(nome, 120)) return;
        this._ruido({ dur: .22, vol: .2, f: 1200, f2: 260 });
        this._acorde([330, 440, 550], { tipo: 'triangle', dur: .28, vol: .12, passo: .06 }); break;
      case 'ampliar':   if (!this._passa(nome, 120)) return;
        this._ruido({ dur: .16, vol: .16, f: 900, f2: 300 });
        this._acorde([392, 523], { tipo: 'triangle', dur: .24, vol: .12, passo: .07 }); break;
      case 'demolir':   if (!this._passa(nome, 90)) return;
        this._ruido({ dur: .3, vol: .26, f: 1800, f2: 120, Q: .6 }); this._tom({ f: 110, f2: 55, tipo: 'square', dur: .18, vol: .1 }); break;
      case 'moeda':     if (!this._passa(nome, 70)) return;
        this._tom({ f: 1180, dur: .07, vol: .1 }); this._tom({ f: 1560, dur: .1, vol: .09, t: .05 }); break;
      case 'compra':    if (!this._passa(nome, 150)) return;
        this._tom({ f: 880, dur: .08, vol: .13 }); this._tom({ f: 1320, dur: .1, vol: .12, t: .07 });
        this._tom({ f: 1760, dur: .16, vol: .1, t: .14 }); break;
      case 'nascimento': if (!this._passa(nome, 400)) return;
        this._acorde([523, 659, 784, 1046], { tipo: 'triangle', dur: .3, vol: .13, passo: .09 }); break;
      case 'morte':     if (!this._passa(nome, 400)) return;
        this._acorde([392, 330, 262], { tipo: 'sine', dur: .5, vol: .13, passo: .16 }); break;
      case 'doente':    if (!this._passa(nome, 400)) return;
        this._tom({ f: 420, f2: 300, tipo: 'triangle', dur: .35, vol: .12, vib: 22, vibF: 9 }); break;
      case 'alarme':    if (!this._passa(nome, 700)) return;
        for (let i = 0; i < 3; i++) {
          this._tom({ f: 780, tipo: 'square', dur: .13, vol: .12, t: i * .22 });
          this._tom({ f: 560, tipo: 'square', dur: .13, vol: .12, t: i * .22 + .11 });
        } break;
      case 'dia':       if (!this._passa(nome, 900)) return;
        this._acorde([523, 784, 1046], { tipo: 'sine', dur: .8, vol: .1, passo: .11 }); break;
      case 'contas':    if (!this._passa(nome, 900)) return;
        this._ruido({ dur: .3, vol: .12, tipo: 'highpass', f: 2600 });
        this._tom({ f: 300, f2: 180, tipo: 'triangle', dur: .3, vol: .12, t: .1 }); break;
      case 'falencia':  if (!this._passa(nome, 2000)) return;
        this._acorde([330, 262, 196, 131], { tipo: 'sawtooth', dur: .9, vol: .12, passo: .22 }); break;
    }
  },

  /* ==========================================================================
     VOZES — um "gesto sonoro" por família, com exceções por espécie.
     O tamanho (esc) puxa a afinação para baixo e o PRNG do nome dá uma
     desafinação estável, então duas espécies do mesmo gesto não soam iguais.
     ========================================================================== */
  voz(sp, opts) {
    const espera = (opts && opts.imediato) ? 0 : 240;
    if (espera && !this._passa('voz' + sp.id, espera)) return;
    if (!this.ctx || !this.ligado) return;
    const dest = (opts && opts.distante) ? this.longe : undefined;
    const _t = this._tom, _r = this._ruido;
    this._tom = o => _t.call(this, { ...o, dest });
    this._ruido = o => _r.call(this, { ...o, dest });
    try {
      const r = mulberry(hashStr(sp.nome) + 11);
      const grave = 1 / (.45 + Math.min(sp.esc, 2.3) * .78);   // maior = mais grave
      const dt = 1 + (r() - .5) * .16;                          // timbre próprio
      const F = f => Math.max(30, f * grave * dt);
      const v = (opts && opts.vol) || .22;
      (this['_g_' + gestoDe(sp)] || this._g_grunhido).call(this, F, v, r, sp);
    } finally { this._tom = _t; this._ruido = _r; }
  },

  /* ---- gestos ---- */
  _g_rugido(F, v) {          // leão, tigre, onça: grave, harmônico e áspero
    const f0 = F(115);
    [[1, 1], [2, .42], [3, .2]].forEach(([m, g]) =>
      this._tom({ f: f0 * m, f2: f0 * m * .72, tipo: 'sawtooth', dur: .95, vol: v * g * .6,
                  atk: .13, vib: f0 * m * .05, vibF: 27, lp: F(1000) }));  // vibrato = aspereza
    this._ruido({ dur: .95, vol: v * .16, tipo: 'bandpass', f: F(500), f2: F(190), Q: .8, lp: F(900) });
  },
  _g_miado(F, v) {           // felino pequeno
    this._tom({ f: F(620), f2: F(880), tipo: 'sawtooth', dur: .18, vol: v * .8, atk: .03, vib: 24, vibF: 12 });
    this._tom({ f: F(880), f2: F(520), tipo: 'sawtooth', dur: .3, vol: v * .7, t: .16, vib: 20, vibF: 10 });
  },
  _g_rosnado(F, v) {         // urso: mais grave e rasgado que o rugido
    const f0 = F(85);
    [[1, 1], [2, .4], [3, .16]].forEach(([m, g]) =>
      this._tom({ f: f0 * m, f2: f0 * m * .8, tipo: 'sawtooth', dur: .8, vol: v * g * .65,
                  atk: .1, vib: f0 * m * .09, vibF: 19, lp: F(750) }));
    this._ruido({ dur: .8, vol: v * .18, tipo: 'lowpass', f: F(400), f2: F(170), lp: F(700) });
  },
  _g_uivo(F, v) {            // lobo: sobe, sustenta, desce — bem tonal
    const a = F(360), b = F(600);
    this._tom({ f: a, f2: b, tipo: 'triangle', dur: .45, vol: v * .85, atk: .1, vib: 7, vibF: 5 });
    this._tom({ f: b, dur: .55, vol: v * .8, t: .43, atk: .05, vib: 9, vibF: 5.5 });
    this._tom({ f: b, f2: a * .75, tipo: 'triangle', dur: .75, vol: v * .7, t: .96, vib: 12, vibF: 6 });
  },
  _g_latido(F, v, r) {       // raposa, cão selvagem: rajadas curtas
    for (let i = 0; i < 2 + (r() * 2 | 0); i++) {
      this._tom({ f: F(520), f2: F(300), tipo: 'sawtooth', dur: .1, vol: v * .9, t: i * .19, atk: .008, vib: 28, vibF: 20 });
      this._ruido({ dur: .08, vol: v * .5, tipo: 'bandpass', f: 1300, f2: 500, Q: 1, t: i * .19 });
    }
  },
  _g_trombeta(F, v) {        // elefante: metálico, sobe e cai, com ronco por baixo
    this._tom({ f: F(300), f2: F(640), tipo: 'sawtooth', dur: .22, vol: v * 1.1, atk: .02, vib: 16, vibF: 13, lp: 2600 });
    this._tom({ f: F(640), f2: F(360), tipo: 'sawtooth', dur: .5, vol: v, t: .2, vib: 26, vibF: 10, lp: 2600 });
    this._tom({ f: F(78), dur: .85, vol: v * 1.1, tipo: 'sine', atk: .05 });   // ronco que dá o porte
  },
  _g_bufo(F, v) {            // girafa e okapi: bufo + zumbido grave
    // Girafa é um bicho quase silencioso: bufa, resfolega e emite um zumbido
    // de ~92 Hz. Nada de rugido — o "certo" aqui é ser discreto.
    this._ruido({ dur: .38, vol: v * .8, tipo: 'bandpass', f: 1100, f2: 300, Q: .6, lp: 1800 });
    this._tom({ f: F(150), f2: F(96), tipo: 'triangle', dur: .34, vol: v * .5, atk: .02, lp: 700 });
    this._tom({ f: 92, dur: 1.3, vol: v * .7, tipo: 'sine', atk: .18, t: .16 });  // 92 Hz é fato do bicho
  },
  _g_zurro(F, v) {           // zebra: late em duas partes
    for (let i = 0; i < 2; i++) {
      this._tom({ f: F(430), f2: F(230), tipo: 'sawtooth', dur: .17, vol: v, t: i * .28, atk: .01, vib: 34, vibF: 17 });
      this._ruido({ dur: .13, vol: v * .4, tipo: 'bandpass', f: 800, f2: 340, Q: 1, t: i * .28, lp: 1900 });
    }
  },
  _g_relincho(F, v) {        // cavalo, jumento
    this._tom({ f: F(700), f2: F(300), tipo: 'sawtooth', dur: .7, vol: v * .9, atk: .02, vib: 45, vibF: 16 });
    this._ruido({ dur: .3, vol: v * .35, tipo: 'bandpass', f: 1600, f2: 600, Q: .8, t: .5 });
  },
  _g_mugido(F, v) {          // bovino: longo, grave, ondulação lenta
    this._tom({ f: F(190), f2: F(150), tipo: 'sawtooth', dur: .95, vol: v * 1.1, atk: .15, vib: 12, vibF: 5.5, lp: F(800) });
    this._tom({ f: F(380), f2: F(300), tipo: 'sawtooth', dur: .9, vol: v * .25, atk: .18, vib: 14, vibF: 5.5, lp: F(900) });
  },
  _g_balido(F, v) {          // antílope, camelídeo: vibrato rápido de bode
    this._tom({ f: F(430), f2: F(360), tipo: 'sawtooth', dur: .55, vol: v * .9, atk: .04, vib: 40, vibF: 21 });
  },
  _g_grito(F, v, r) {        // primata: pant-hoot que acelera e sobe
    const n = 4 + (r() * 3 | 0);
    for (let i = 0; i < n; i++) {
      const k = i / n;
      this._tom({ f: F(480 + k * 420), f2: F(620 + k * 520), tipo: 'square',
                  dur: .1, vol: v * (.5 + k * .5), t: i * (.17 - k * .07), atk: .01 });
    }
  },
  _g_piado(F, v, r) {        // aves: varreduras curtas e agudas
    for (let i = 0; i < 3 + (r() * 3 | 0); i++) {
      const f = F(1900 + r() * 1100);
      this._tom({ f, f2: f * (1.4 + r() * .6), tipo: 'sine', dur: .06, vol: v * .55, t: i * .095, atk: .004 });
    }
  },
  _g_grasnado(F, v) {        // pinguim, ganso: pulsos ásperos
    for (let i = 0; i < 3; i++)
      this._tom({ f: F(400), f2: F(280), tipo: 'sawtooth', dur: .17, vol: v * .8, t: i * .21, vib: 38, vibF: 25 });
  },
  _g_chiado(F, v) {          // serpente
    this._ruido({ dur: .8, vol: v * .8, tipo: 'highpass', f: 3600, f2: 6800, Q: .5 });
  },
  _g_reptil(F, v) {          // lagarto, crocodilo, tartaruga: sopro + ronco
    this._ruido({ dur: .5, vol: v * .55, tipo: 'bandpass', f: F(760), f2: F(300), Q: 1.3 });
    this._tom({ f: F(105), f2: F(72), tipo: 'sawtooth', dur: .45, vol: v * .6, vib: 9, vibF: 13 });
  },
  _g_coaxo(F, v, r) {        // anfíbio: pulsos secos
    const n = 4 + (r() * 3 | 0);
    for (let i = 0; i < n; i++)
      this._tom({ f: F(400), tipo: 'square', dur: .055, vol: v * .6, t: i * .08, atk: .004 });
  },
  _g_assobio(F, v) {         // golfinho, boto
    this._tom({ f: F(2100), f2: F(3700), tipo: 'sine', dur: .15, vol: v * .5, atk: .01 });
    this._tom({ f: F(3500), f2: F(1800), tipo: 'sine', dur: .22, vol: v * .45, t: .14 });
    for (let i = 0; i < 5; i++)  // estalos de ecolocalização
      this._tom({ f: 5200, dur: .012, vol: v * .18, t: .36 + i * .035 });
  },
  _g_bufoFoca(F, v) {        // foca, leão-marinho
    for (let i = 0; i < 2; i++)
      this._tom({ f: F(330), f2: F(210), tipo: 'sawtooth', dur: .21, vol: v * .85, t: i * .28, vib: 22, vibF: 15 });
  },
  _g_guincho(F, v, r) {      // roedor, morcego, pequenos: agudo e curto
    for (let i = 0; i < 2 + (r() * 2 | 0); i++) {
      const f = F(1500 + r() * 700);
      this._tom({ f, f2: f * .6, tipo: 'triangle', dur: .08, vol: v * .5, t: i * .11, atk: .005 });
    }
  },
  _g_zumbido(F, v) {         // invertebrados
    this._ruido({ dur: .5, vol: v * .35, tipo: 'bandpass', f: 4200, Q: 9 });
  },
  _g_grunhido(F, v, r) {     // porco, hipopótamo, rinoceronte e genéricos grandes
    const n = 3 + (r() * 2 | 0);
    for (let i = 0; i < n; i++)
      this._tom({ f: F(230), f2: F(160), tipo: 'square', dur: .1, vol: v * .7, t: i * .13, atk: .008 });
  },

  /* ---- barramento "distante" ----
     Vozes de bicho ao fundo passam por aqui e saem abafadas, como se viessem
     do outro lado do parque. (O murmúrio de multidão foi removido: ruído com
     formantes ainda soa como vento, não como conversa — fala convincente exige
     excitação glotal e contorno de altura, que fica para outra hora.) */
  _ambiente() {
    const c = this.ctx;
    this.longe = c.createGain(); this.longe.gain.value = .5;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1200; lp.Q.value = .6;
    this.longe.connect(lp).connect(this.mestre);
  },
};
