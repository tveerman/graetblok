// Geluid: alles wordt ter plekke gemaakt met de Web Audio API (geen geluidsbestanden).

// De muziek: elke wereld heeft een eigen toonsoort, tempo en klank. Het liedje wordt
// tijdens het spelen gemaakt: vier maten met akkoorden, een bas en een melodietje dat
// zich herhaalt en af en toe verandert.
const SONGS = {
  groen: { root: 261.63, minor: false, bpm: 96, lead: 'triangle' },
  ijs: { root: 293.66, minor: false, bpm: 80, lead: 'sine' },
  vuur: { root: 220.0, minor: true, bpm: 104, lead: 'triangle' },
  schaduw: { root: 164.81, minor: true, bpm: 72, lead: 'sine' },
  wolken: { root: 349.23, minor: false, bpm: 100, lead: 'triangle' },
};
// akkoorden en toonladders in halve tonen boven de grondtoon
const CHORDS_MAJ = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];
const CHORDS_MIN = [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]];
const PENTA_MAJ = [0, 2, 4, 7, 9], PENTA_MIN = [0, 3, 5, 7, 10];
const MUSIC_VOL = 0.7;      // de muziek blijft op de achtergrond, onder de geluidseffecten

export class Sound {
  constructor() {
    this.ctx = null;
    this.vol = 0.8;
    this.musicOn = true;
    this.noiseBuf = null;
    this.amb = null;
    this.ambT = 0;
    this.kicked = false;
    this.mus = { world: '', next: 0, step: 0, phrase: null, idx: 5, on: true };
  }

  // Moet na een tik of toets worden aangeroepen: browsers laten pas daarna geluid toe.
  // We proberen het bij elke tik opnieuw tot het geluid echt loopt (nodig op iPad en in Safari).
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      const c = this.ctx = new AC();
      this.master = c.createGain();
      this.master.gain.value = this.vol;
      this.master.connect(c.destination);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, len);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // wind die altijd zachtjes waait
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
      const g = c.createGain(); g.gain.value = 0.0;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      this.amb = { f, g };
      // muziek: eigen volumeknop en een zachte echo
      this.musicGain = c.createGain(); this.musicGain.gain.value = MUSIC_VOL; this.musicGain.connect(this.master);
      this.echo = c.createDelay(1); this.echo.delayTime.value = 0.34;
      const fb = c.createGain(); fb.gain.value = 0.3;
      const wet = c.createGain(); wet.gain.value = 0.35;
      this.echo.connect(fb); fb.connect(this.echo); this.echo.connect(wet); wet.connect(this.musicGain);
    }
    const c = this.ctx;
    if (c.state !== 'running') {
      try { const pr = c.resume(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) { /* nog niet toegestaan */ }
    }
    if (!this.kicked) {
      // een onhoorbaar geluidje binnen de tik maakt het geluid op iPad en iPhone wakker
      try {
        const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050);
        s.connect(c.destination); s.start(0);
      } catch (e) { /* geeft niet */ }
      this.kicked = c.state === 'running';
    }
  }

  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }

  // stil worden (bijv. in het hoofdmenu)
  quiet() { if (this.ctx && this.amb) this.amb.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3); }

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
    this.music(env);
  }

  // een muzieknoot op een afgesproken moment
  note(freq, when, dur, type, vol, attack, echo) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + attack);
    g.gain.setValueAtTime(vol, when + Math.max(attack, dur * 0.55));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(this.musicGain);
    if (echo) g.connect(this.echo);
    o.start(when); o.stop(when + dur + 0.05);
  }

  // een nieuw melodietje van vier maten (32 achtste noten); -1 = rust
  makePhrase(minor) {
    const penta = minor ? PENTA_MIN : PENTA_MAJ, chords = minor ? CHORDS_MIN : CHORDS_MAJ;
    const scale = [];
    for (let o = 0; o < 2; o++) for (const p of penta) scale.push(p + 12 * o);
    scale.push(24);
    const out = [];
    let idx = this.mus.idx;
    for (let bar = 0; bar < 4; bar++) {
      const chord = chords[bar];
      for (let st = 0; st < 8; st++) {
        const strong = st === 0 || st === 4;
        if (Math.random() < (strong ? 0.06 : (st % 2 ? 0.45 : 0.22))) { out.push(-1); continue; }
        if (strong) {
          // op de tel: de dichtstbijzijnde toon uit het akkoord
          let best = idx, bd = 99;
          for (let i = 1; i < scale.length; i++) {
            const pc = scale[i] % 12;
            if (!chord.some((c) => c % 12 === pc)) continue;
            const d = Math.abs(i - idx) + Math.random() * 1.5;
            if (d < bd) { bd = d; best = i; }
          }
          idx = best;
        } else {
          idx += [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)];
          if (idx < 1) idx = 2; if (idx > scale.length - 1) idx = scale.length - 3;
        }
        out.push(scale[idx]);
      }
    }
    this.mus.idx = Math.max(3, Math.min(7, idx));
    return out;
  }

  // Zet steeds een klein stukje muziek vooruit klaar. Wordt een paar keer per seconde aangeroepen.
  music(env) {
    const c = this.ctx, m = this.mus, now = c.currentTime;
    if (m.on !== this.musicOn) { m.on = this.musicOn; this.musicGain.gain.setTargetAtTime(m.on ? MUSIC_VOL : 0, now, 0.15); }
    if (!this.musicOn) { m.next = 0; return; }
    const song = SONGS[env.world] || SONGS.groen;
    if (m.world !== env.world) { m.world = env.world; m.step = 0; m.phrase = null; m.next = now + 0.5; }
    if (m.next < now - 0.2) m.next = now + 0.12;          // na een pauze niet alles inhalen
    const stepDur = 60 / song.bpm / 2;
    const chords = song.minor ? CHORDS_MIN : CHORDS_MAJ;
    const hz = (n) => song.root * Math.pow(2, n / 12);
    const v = (env.under ? 0.6 : 1) * (0.75 + 0.25 * (env.day === undefined ? 1 : env.day));
    while (m.next < now + 0.4) {
      const t = m.next, st = m.step % 8, bar = Math.floor(m.step / 8) % 4, chord = chords[bar];
      if (!m.phrase) m.phrase = this.makePhrase(song.minor);
      if (st === 0) {
        this.note(hz(chord[0] - 12), t, stepDur * 7.6, 'triangle', 0.11 * v, 0.03, false);                 // bas
        for (const n of chord) this.note(hz(n), t, stepDur * 8.2, 'sine', 0.03 * v, 0.5, false);           // akkoord
      } else if (st === 4) {
        this.note(hz(chord[0] - 12), t, stepDur * 3.6, 'triangle', 0.075 * v, 0.03, false);
      } else if (st === 6) {
        this.note(hz(chord[2] - 12), t, stepDur * 1.8, 'triangle', 0.05 * v, 0.03, false);
      }
      const n = m.phrase[m.step % 32];
      if (n >= 0 && !env.under) {
        const rest = m.phrase[(m.step + 1) % 32] < 0;
        this.note(hz(n), t, stepDur * (rest ? 1.9 : 1.05), song.lead, 0.085 * v, 0.012, true);              // melodie
      }
      m.step++;
      if (m.step % 64 === 0) m.phrase = null;              // na twee keer spelen: een nieuw melodietje
      m.next += stepDur;
    }
  }
}
