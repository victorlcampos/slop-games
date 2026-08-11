// Som do motor / derrapagem / batida — 100% sintetizado (WebAudio)
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._built = false;
  }

  // criar apenas após gesto do usuário
  start() {
    if (this._built) { this.ctx && this.ctx.resume(); return; }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(ctx.destination);

      // motor: 2 osciladores + filtro
      this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 900; filt.Q.value = 2;
      this.osc1 = ctx.createOscillator(); this.osc1.type = 'sawtooth';
      this.osc2 = ctx.createOscillator(); this.osc2.type = 'square';
      const g2 = ctx.createGain(); g2.gain.value = 0.4;
      this.osc1.connect(filt);
      this.osc2.connect(g2); g2.connect(filt);
      filt.connect(this.engGain);
      this.engGain.connect(this.master);
      this.osc1.start(); this.osc2.start();
      this.engFilt = filt;

      // ruído (derrapagem)
      const len = ctx.sampleRate * 1.5;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = ctx.createBufferSource();
      this.noise.buffer = buf; this.noise.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 0.8;
      this.skidGain = ctx.createGain(); this.skidGain.gain.value = 0;
      this.noise.connect(bp); bp.connect(this.skidGain); this.skidGain.connect(this.master);
      this.noise.start();

      this._built = true;
    } catch (e) { /* sem áudio, sem drama */ }
  }

  update(speedKmh, throttle, drifting) {
    if (!this._built) return;
    const t = this.ctx.currentTime;
    const rpm = Math.min(1, speedKmh / 160) + Math.abs(throttle) * 0.12;
    const freq = 52 + rpm * 168;
    this.osc1.frequency.setTargetAtTime(freq, t, 0.06);
    this.osc2.frequency.setTargetAtTime(freq * 0.5 + 4, t, 0.06);
    this.engFilt.frequency.setTargetAtTime(500 + rpm * 2600, t, 0.1);
    this.engGain.gain.setTargetAtTime(0.05 + rpm * 0.1 + Math.abs(throttle) * 0.05, t, 0.09);
    this.skidGain.gain.setTargetAtTime(drifting ? 0.16 : 0, t, drifting ? 0.05 : 0.15);
  }

  crash(intensity) {
    if (!this._built) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5 * intensity, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.3);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
}
