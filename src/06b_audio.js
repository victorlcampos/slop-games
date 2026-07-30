/* ==========================================================================
   6c. SOM — tudo sintetizado, zero arquivos
   O jogo é um HTML só e roda offline: não há como carregar .mp3. Então o áudio
   segue a mesma ideia dos sprites — é gerado por código. A voz de cada bicho
   sai do PLANO CORPORAL e do TAMANHO (esc), do mesmo jeito que o desenho, e um
   PRNG semeado pelo nome dá individualidade estável a cada espécie.
   ========================================================================== */
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
  _tom({ f = 440, f2, tipo = 'sine', t = 0, dur = .18, vol = .3, atk = .006, vib, vibF = 6, dest }) {
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
    o.connect(g).connect(dest || this.mestre);
    o.start(t0); o.stop(t0 + dur + .05);
    this._ativas++; o.onended = () => this._ativas--;
  },
  /** rajada de ruído filtrado: baque, pincelada, chiado, sopro */
  _ruido({ t = 0, dur = .18, vol = .3, tipo = 'lowpass', f = 900, f2, Q = 1, dest }) {
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
    src.connect(bq).connect(g).connect(dest || this.mestre);
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

  /* ---- vozes dos bichos ----
     Cada plano corporal tem um gesto sonoro; o tamanho puxa a afinação para
     baixo (elefante grave, sagui agudo) e o PRNG do nome garante que a mesma
     espécie soe sempre igual, mas diferente da vizinha. */
  voz(sp, opts) {
    if (!this._passa('voz' + sp.id, 260)) return;
    const dest = (opts && opts.distante) ? this.longe : undefined;
    const _t = this._tom, _r = this._ruido;
    // injeta o destino em todas as chamadas deste bicho sem repetir o parâmetro
    this._tom = o => _t.call(this, { ...o, dest });
    this._ruido = o => _r.call(this, { ...o, dest });
    try { this._vozCorpo(sp, opts); } finally { this._tom = _t; this._ruido = _r; }
  },
  _vozCorpo(sp, opts) {
    const r = mulberry(hashStr(sp.nome) + 11);
    const grave = 1 / (.45 + Math.min(sp.esc, 2.3) * .78);   // maior = mais grave
    const dt = 1 + (r() - .5) * .18;                          // desafinação por espécie
    const v = (opts && opts.vol) || .2;
    const F = f => Math.max(35, f * grave * dt);
    switch (sp.plano) {
      case 'felino':
        this._tom({ f: F(300), f2: F(150), tipo: 'sawtooth', dur: .55, vol: v, vib: 16, vibF: 22 });
        this._ruido({ dur: .5, vol: v * .5, tipo: 'lowpass', f: F(900), f2: F(300) }); break;
      case 'urso':
        this._tom({ f: F(190), f2: F(105), tipo: 'sawtooth', dur: .6, vol: v, vib: 12, vibF: 15 });
        this._ruido({ dur: .55, vol: v * .55, f: F(600), f2: F(220) }); break;
      case 'canino':   // uivo: sobe e desce
        this._tom({ f: F(420), f2: F(680), tipo: 'sawtooth', dur: .32, vol: v * .85, vib: 10, vibF: 5 });
        this._tom({ f: F(680), f2: F(360), tipo: 'sawtooth', dur: .5, vol: v * .8, t: .3, vib: 14, vibF: 6 }); break;
      case 'elefante': // trombeta
        this._tom({ f: F(260), f2: F(520), tipo: 'sawtooth', dur: .28, vol: v * 1.1, vib: 20, vibF: 11 });
        this._tom({ f: F(520), f2: F(300), tipo: 'sawtooth', dur: .45, vol: v, t: .26, vib: 24, vibF: 9 }); break;
      case 'primata':  // grito curto + tagarelice
        for (let i = 0; i < 3; i++)
          this._tom({ f: F(700 + r() * 300), f2: F(950), tipo: 'square', dur: .1, vol: v * .7, t: i * .13 });
        break;
      case 'ave': case 'pernalta':
        for (let i = 0; i < 3 + (r() * 3 | 0); i++)
          this._tom({ f: F(1500 + r() * 900), f2: F(2400), tipo: 'sine', dur: .07, vol: v * .55, t: i * .1 });
        break;
      case 'pinguim':  // zurro áspero
        for (let i = 0; i < 3; i++)
          this._tom({ f: F(430), f2: F(300), tipo: 'sawtooth', dur: .16, vol: v * .7, t: i * .2, vib: 30, vibF: 26 });
        break;
      case 'ungulado': case 'bovino': case 'camelideo': case 'equino':
        this._tom({ f: F(230), f2: F(180), tipo: 'sawtooth', dur: .6, vol: v, vib: 18, vibF: 7 }); break;
      case 'suino':
        for (let i = 0; i < 4; i++)
          this._tom({ f: F(260), f2: F(180), tipo: 'square', dur: .09, vol: v * .7, t: i * .11 });
        break;
      case 'cobra':
        this._ruido({ dur: .7, vol: v * .8, tipo: 'highpass', f: 3800, f2: 6500, Q: .5 }); break;
      case 'lagarto': case 'tartaruga':
        this._ruido({ dur: .45, vol: v * .6, tipo: 'bandpass', f: F(700), f2: F(320), Q: 1.4 });
        this._tom({ f: F(120), f2: F(80), tipo: 'sawtooth', dur: .4, vol: v * .6 }); break;
      case 'anfibio':  // coaxar pulsado
        for (let i = 0; i < 5; i++)
          this._tom({ f: F(420), tipo: 'square', dur: .06, vol: v * .6, t: i * .085 });
        break;
      case 'peixe':    // assobio de golfinho
        this._tom({ f: F(2200), f2: F(3600), tipo: 'sine', dur: .16, vol: v * .5 });
        this._tom({ f: F(3400), f2: F(1900), tipo: 'sine', dur: .2, vol: v * .45, t: .15 }); break;
      case 'foca':
        for (let i = 0; i < 2; i++)
          this._tom({ f: F(340), f2: F(220), tipo: 'sawtooth', dur: .2, vol: v * .8, t: i * .27, vib: 20, vibF: 14 });
        break;
      case 'morcego':
        for (let i = 0; i < 4; i++)
          this._tom({ f: 5200 + r() * 1800, f2: 3200, tipo: 'sine', dur: .04, vol: v * .3, t: i * .07 });
        break;
      case 'inseto':
        this._ruido({ dur: .5, vol: v * .35, tipo: 'bandpass', f: 4200, Q: 9 }); break;
      default:         // roedor, mustelídeo, canguru, preguiça, rino, hipo…
        if (sp.esc > 1.2) {  // bicho grande: grunhido
          this._tom({ f: F(170), f2: F(120), tipo: 'sawtooth', dur: .45, vol: v, vib: 14, vibF: 9 });
        } else {             // pequeno: guincho
          for (let i = 0; i < 2; i++)
            this._tom({ f: F(1400 + r() * 500), f2: F(900), tipo: 'triangle', dur: .09, vol: v * .5, t: i * .12 });
        }
    }
  },

  /* ---- ambiente contínuo ---- */
  _ambiente() {
    const c = this.ctx;
    // barramento "distante": bichos de fundo passam por aqui e ficam abafados,
    // como se viessem do outro lado do parque
    this.longe = c.createGain(); this.longe.gain.value = .55;
    const lpLonge = c.createBiquadFilter();
    lpLonge.type = 'lowpass'; lpLonge.frequency.value = 1100; lpLonge.Q.value = .6;
    this.longe.connect(lpLonge).connect(this.mestre);

    // ruído rosa: base tanto do murmúrio quanto dos grilos
    const dur = 4, n = c.sampleRate * dur;
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = .99765 * b0 + w * .0990460; b1 = .96300 * b1 + w * .2965164; b2 = .57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * .1848) * .09;
    }

    /* ---- MURMÚRIO DE MULTIDÃO ----
       Ruído por UM passa-banda vira chiado de cobra. O que o ouvido reconhece
       como fala são duas coisas: energia agrupada nos FORMANTES de vogal
       (~500 / 1100 / 2400 Hz) e a ondulação SILÁBICA de 3–7 Hz. Somando três
       LFOs incomensuráveis o ritmo não fica mecânico, e um zumbido grave
       discreto dá o corpo "vocalizado" que o ruído puro não tem. */
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const formantes = c.createGain(); formantes.gain.value = 1;
    [[520, 5, 1], [1150, 7, .5], [2450, 10, .18]].forEach(([f, q, g]) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const gg = c.createGain(); gg.gain.value = g;
      src.connect(bp).connect(gg).connect(formantes);
    });
    // corta o agudo: é o que restava de "chiado"
    const corte = c.createBiquadFilter();
    corte.type = 'lowpass'; corte.frequency.value = 2100; corte.Q.value = .7;

    const silaba = c.createGain(); silaba.gain.value = .5;
    [[3.1, .17], [4.7, .13], [6.3, .09]].forEach(([f, amp]) => {
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = f;
      const lg = c.createGain(); lg.gain.value = amp;
      lfo.connect(lg).connect(silaba.gain); lfo.start();
    });

    this.multidao = c.createGain(); this.multidao.gain.value = 0;
    formantes.connect(corte).connect(silaba).connect(this.multidao).connect(this.mestre);

    // corpo vocalizado: vozes graves fora de afinação entre si
    const lpVoz = c.createBiquadFilter();
    lpVoz.type = 'lowpass'; lpVoz.frequency.value = 480;
    [98, 127, 163].forEach(f => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = .014;
      o.connect(g).connect(lpVoz); o.start();
    });
    lpVoz.connect(silaba);
    src.start();

    /* ---- GRILOS DA NOITE ---- */
    const src2 = c.createBufferSource(); src2.buffer = buf; src2.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 4600; hp.Q.value = 12;
    this.noite = c.createGain(); this.noite.gain.value = 0;
    const trem = c.createOscillator(), tg = c.createGain();
    trem.frequency.value = 11; tg.gain.value = .5;
    trem.connect(tg).connect(this.noite.gain); trem.start();
    src2.connect(hp).connect(this.noite).connect(this.mestre);
    src2.start();
  },
  /** chamado ~2x por segundo pelo loop */
  ambiente(nVis, hora, aberto) {
    if (!this.ctx || !this.ligado) return;
    const t = this.ctx.currentTime;
    // expoente < 1: um punhado de gente já se ouve, e satura perto de 110.
    // Parque vazio tem de ficar em silêncio de verdade, não num zumbido baixo.
    const alvo = aberto && nVis > 0 ? Math.pow(clamp(nVis / 110, 0, 1), .6) * .3 : 0;
    this.multidao.gain.setTargetAtTime(alvo, t, .6);
    const ehNoite = hora < 6.5 || hora > 19.5;
    this.noite.gain.setTargetAtTime(ehNoite ? .05 : 0, t, 1.5);
    // pios esparsos de dia, quando o parque não está cheio de barulho
    if (!ehNoite && Math.random() < .035 && this._ativas < 6) {
      const f = 1800 + Math.random() * 1400;
      for (let i = 0; i < 2 + (Math.random() * 2 | 0); i++)
        this._tom({ f: f + Math.random() * 400, f2: f * 1.3, dur: .05, vol: .035, t: i * .08 });
    }
  },
};
