// Geluid: alles wordt ter plekke gemaakt met de Web Audio API (geen geluidsbestanden).

export class Sound {
  constructor() {
    this.ctx = null;
    this.vol = 0.8;
    this.musicOn = true;
    this.noiseBuf = null;
    this.amb = null;
    this.world = 'groen';
    this.musicT = 0;
    this.ambT = 0;
    this.note = 0;
  }

  // moet na een tik of toets worden aangeroepen (zo willen browsers dat)
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.vol;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, len);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // wind die altijd zachtjes waait
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = this.ctx.createGain(); g.gain.value = 0.0;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
    this.amb = { f, g };
  }

  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }

  tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0, attack = 0.005) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, ftype, freq, vol = 0.2, sweep = 0, delay = 0, q = 1) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, sweep), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // v = hoe hard (0..1), bijvoorbeeld zachter als het ver weg is
  play(name, v = 1, mat = 'stone') {
    if (!this.ctx || v <= 0.02) return;
    const r = 0.92 + Math.random() * 0.16;
    switch (name) {
      case 'step':
        if (mat === 'grass' || mat === 'leaf') this.noise(0.07, 'lowpass', 900 * r, 0.1 * v);
        else if (mat === 'wood') { this.tone(170 * r, 0.05, 'triangle', 0.1 * v); this.noise(0.03, 'lowpass', 1200, 0.05 * v); }
        else if (mat === 'sand' || mat === 'snow') this.noise(0.1, 'lowpass', 600 * r, 0.1 * v, 300);
        else if (mat === 'metal') { this.tone(520 * r, 0.05, 'square', 0.03 * v); this.noise(0.03, 'highpass', 3000, 0.05 * v); }
        else this.noise(0.045, 'bandpass', 1700 * r, 0.14 * v, 0, 0, 1.5);
        break;
      case 'dig':
        if (mat === 'grass' || mat === 'sand' || mat === 'snow' || mat === 'leaf') this.noise(0.08, 'lowpass', 1100 * r, 0.16 * v, 400);
        else if (mat === 'wood') { this.tone(210 * r, 0.06, 'triangle', 0.16 * v, 140); this.noise(0.04, 'bandpass', 900, 0.08 * v); }
        else if (mat === 'glass') this.tone(1900 * r, 0.05, 'sine', 0.1 * v);
        else if (mat === 'metal') { this.tone(740 * r, 0.08, 'square', 0.05 * v); this.noise(0.04, 'highpass', 4000, 0.08 * v); }
        else { this.noise(0.05, 'bandpass', 2300 * r, 0.2 * v, 0, 0, 2); this.tone(150 * r, 0.04, 'sine', 0.12 * v); }
        break;
      case 'break':
        this.noise(0.2, 'lowpass', mat === 'glass' ? 6000 : 1800, 0.3 * v, 250);
        this.tone(100 * r, 0.12, 'sine', 0.25 * v, 55);
        if (mat === 'glass') { this.tone(2400, 0.15, 'sine', 0.08 * v); this.tone(3100, 0.12, 'sine', 0.06 * v, 0, 0.03); }
        break;
      case 'place': this.tone(150 * r, 0.09, 'sine', 0.3 * v, 80); this.noise(0.04, 'lowpass', 1500, 0.12 * v); break;
      case 'got': this.tone(700, 0.07, 'sine', 0.12 * v, 1000); this.tone(1050, 0.09, 'sine', 0.1 * v, 0, 0.06); break;
      case 'craft': this.tone(520, 0.08, 'triangle', 0.16 * v); this.tone(780, 0.12, 'triangle', 0.16 * v, 0, 0.08); this.noise(0.05, 'bandpass', 2500, 0.08 * v); break;
      case 'click': this.tone(520, 0.04, 'triangle', 0.1 * v); break;
      case 'deny': this.tone(200, 0.12, 'square', 0.08 * v, 150); break;
      case 'hurt': this.tone(330, 0.2, 'square', 0.14 * v, 130); this.noise(0.1, 'lowpass', 800, 0.15 * v); break;
      case 'hit': this.noise(0.07, 'bandpass', 2400 * r, 0.25 * v, 600, 0, 1.2); this.tone(190 * r, 0.08, 'triangle', 0.2 * v, 90); break;
      case 'swing': this.noise(0.13, 'bandpass', 700, 0.09 * v, 2400, 0, 0.8); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noise(0.06, 'bandpass', 1300 + i * 200, 0.16 * v, 600, i * 0.11, 2); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16 * v, 0, i * 0.09)); break;
      case 'quest': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.16 * v, 0, i * 0.11)); this.tone(1568, 0.5, 'sine', 0.08 * v, 0, 0.6); break;
      case 'growl': this.growl(85 * r, 0.45, 0.2 * v); break;
      case 'roar': this.growl(62, 1.3, 0.34 * v); this.noise(1.2, 'lowpass', 500, 0.2 * v, 180); break;
      case 'flap': this.noise(0.16, 'lowpass', 500, 0.14 * v, 150); break;
      case 'pijl': this.noise(0.12, 'highpass', 2500, 0.1 * v); this.tone(600, 0.1, 'triangle', 0.08 * v, 250); break;
      case 'magie': this.tone(880, 0.25, 'sine', 0.14 * v, 1760); this.tone(1320, 0.2, 'sine', 0.08 * v, 2200, 0.04); break;
      case 'laser': this.tone(1800, 0.14, 'sawtooth', 0.09 * v, 280); break;
      case 'oer': this.tone(220, 0.5, 'sawtooth', 0.12 * v, 880); this.tone(440, 0.5, 'sine', 0.14 * v, 1760); break;
      case 'vuurbal': case 'breath': this.noise(0.4, 'lowpass', 350, 0.3 * v, 1500); this.tone(110, 0.3, 'sawtooth', 0.08 * v, 60); break;
      case 'boom': this.noise(0.35, 'lowpass', 900, 0.3 * v, 90); this.tone(80, 0.25, 'sine', 0.25 * v, 40); break;
      case 'portal': [220, 277, 330, 440].forEach((f, i) => this.tone(f, 1.4, 'sine', 0.09 * v, f * 2, i * 0.08, 0.3)); this.noise(1.2, 'bandpass', 600, 0.1 * v, 3000, 0, 3); break;
      case 'splash': this.noise(0.3, 'bandpass', 1300, 0.22 * v, 500, 0, 0.8); break;
      case 'chest': this.tone(110, 0.25, 'sawtooth', 0.08 * v, 170); this.tone(1320, 0.3, 'sine', 0.12 * v, 0, 0.2); this.tone(1760, 0.4, 'sine', 0.1 * v, 0, 0.3); break;
      case 'hatch': for (let i = 0; i < 4; i++) this.noise(0.04, 'highpass', 3000, 0.2 * v, 0, i * 0.18); [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.14 * v, 0, 0.8 + i * 0.1)); this.tone(900, 0.2, 'sine', 0.1 * v, 1500, 1.3); break;
      case 'hearts': this.tone(880, 0.1, 'sine', 0.12 * v); this.tone(1175, 0.14, 'sine', 0.12 * v, 0, 0.09); break;
      case 'chirp': this.tone(1100 * r, 0.12, 'sine', 0.1 * v, 1700 * r); this.tone(1400 * r, 0.1, 'sine', 0.08 * v, 900, 0.1); break;
      case 'poof': this.noise(0.22, 'lowpass', 1400, 0.2 * v, 200); break;
      case 'death': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.16 * v, 0, i * 0.18)); break;
      case 'restore': [262, 330, 392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.9, 'sine', 0.13 * v, 0, i * 0.14, 0.05)); this.noise(2, 'bandpass', 800, 0.08 * v, 5000, 0, 2); break;
      case 'sleep': [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.12 * v, 0, i * 0.3, 0.1)); break;
    }
  }

  growl(freq, dur, vol) {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(freq * 1.2, t); o.frequency.exponentialRampToValueAtTime(freq * 0.7, t + dur);
    f.type = 'lowpass'; f.frequency.value = 600;
    lfo.frequency.value = 26; lg.gain.value = vol * 0.6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lfo.connect(lg); lg.connect(g.gain);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }

  // sfeergeluiden en een zacht muziekje; elke frame aanroepen
  ambience(dt, env) {
    if (!this.ctx) return;
    const w = env.world;
    const a = this.amb;
    const windVol = env.under ? 0.01 : (w === 'ijs' ? 0.09 : w === 'wolken' ? 0.08 : w === 'vuur' ? 0.05 : 0.035) * (0.6 + 0.4 * Math.sin(this.ctx.currentTime * 0.3));
    a.g.gain.setTargetAtTime(windVol + (env.flying ? 0.08 : 0), this.ctx.currentTime, 0.5);
    a.f.frequency.setTargetAtTime(env.flying ? 900 : (w === 'ijs' ? 600 : 380), this.ctx.currentTime, 0.5);
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = 2 + Math.random() * 5;
      if (env.under) { this.tone(1300 + Math.random() * 600, 0.08, 'sine', 0.05, 700); }
      else if (w === 'groen' || w === 'wolken') { if (env.day > 0.5) this.play('chirp', 0.5); else { for (let i = 0; i < 4; i++) this.tone(4200, 0.03, 'sine', 0.025, 0, i * 0.07); } }
      else if (w === 'vuur') { this.noise(0.5, 'lowpass', 200, 0.12, 80); }
      else if (w === 'schaduw') { this.tone(55 + Math.random() * 10, 2.5, 'sine', 0.07, 0, 0, 0.8); this.tone(82, 2.5, 'sine', 0.03, 78, 0, 0.8); }
    }
    if (!this.musicOn) return;
    this.musicT -= dt;
    if (this.musicT <= 0) {
      const scales = { groen: [262, 294, 330, 392, 440, 523, 587, 659], ijs: [294, 330, 370, 440, 494, 587, 659, 740], vuur: [220, 262, 294, 330, 392, 440, 523, 587], schaduw: [208, 247, 277, 311, 370, 415, 494, 554], wolken: [349, 392, 440, 523, 587, 698, 784, 880] };
      const sc = scales[w] || scales.groen;
      this.note = Math.max(0, Math.min(sc.length - 1, this.note + Math.floor(Math.random() * 5) - 2));
      const f = sc[this.note];
      this.tone(f, 2.2, 'sine', 0.045, 0, 0, 0.25);
      this.tone(f * 2, 1.6, 'sine', 0.012, 0, 0, 0.3);
      if (Math.random() < 0.3) this.tone(f / 2, 3, 'triangle', 0.03, 0, 0, 0.5);
      this.musicT = Math.random() < 0.25 ? 3 + Math.random() * 4 : 0.7 + Math.random() * 0.9;
    }
  }
}
