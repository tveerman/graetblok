// Geluid: alles wordt ter plekke gemaakt met de Web Audio API (geen geluidsbestanden).

// De muziek: elke wereld heeft een eigen toonsoort, tempo en klank. Het liedje wordt
// tijdens het spelen gemaakt: vier maten met akkoorden, een bas en een melodietje dat
// zich herhaalt en af en toe verandert.
// Akkoordenschema's (vier maten) in halve tonen boven de grondtoon.
const MAJ_A = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], MAJ_B = [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]];
const MAJ_C = [[0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14]], MAJ_D = [[9, 12, 16], [5, 9, 12], [0, 4, 7], [7, 11, 14]];
const MIN_A = [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], MIN_B = [[0, 3, 7], [5, 8, 12], [7, 10, 14], [0, 3, 7]];
const MIN_C = [[0, 3, 7], [10, 14, 17], [8, 12, 15], [10, 14, 17]];
// Elke wereld heeft een paar liedjes die elkaar afwisselen. Een liedje heeft een toonsoort
// (root, minor), een tempo, een klank voor de melodie, een akkoordenschema en een stijl voor
// de begeleiding: 'rustig' (lange tonen) of 'arp' (de tonen van het akkoord één voor één).
const SONGS = {
  groen: [
    { root: 261.63, minor: false, bpm: 96, lead: 'triangle', chords: MAJ_A, stijl: 'rustig' },
    { root: 293.66, minor: false, bpm: 108, lead: 'triangle', chords: MAJ_B, stijl: 'arp' },
    { root: 196.0, minor: false, bpm: 84, lead: 'sine', chords: MAJ_C, stijl: 'rustig' },
    { root: 220.0, minor: true, bpm: 92, lead: 'triangle', chords: MIN_A, stijl: 'arp' },
    { root: 349.23, minor: false, bpm: 116, lead: 'square', chords: MAJ_D, stijl: 'arp' },
  ],
  ijs: [
    { root: 293.66, minor: false, bpm: 80, lead: 'sine', chords: MAJ_A, stijl: 'rustig' },
    { root: 329.63, minor: false, bpm: 72, lead: 'sine', chords: MAJ_C, stijl: 'arp' },
    { root: 246.94, minor: true, bpm: 76, lead: 'triangle', chords: MIN_C, stijl: 'rustig' },
  ],
  vuur: [
    { root: 220.0, minor: true, bpm: 104, lead: 'triangle', chords: MIN_A, stijl: 'rustig' },
    { root: 196.0, minor: true, bpm: 116, lead: 'square', chords: MIN_B, stijl: 'arp' },
    { root: 246.94, minor: true, bpm: 96, lead: 'triangle', chords: MIN_C, stijl: 'arp' },
  ],
  schaduw: [
    { root: 164.81, minor: true, bpm: 72, lead: 'sine', chords: MIN_A, stijl: 'rustig' },
    { root: 146.83, minor: true, bpm: 66, lead: 'sine', chords: MIN_C, stijl: 'rustig' },
    { root: 185.0, minor: true, bpm: 80, lead: 'triangle', chords: MIN_B, stijl: 'arp' },
  ],
  wolken: [
    { root: 349.23, minor: false, bpm: 100, lead: 'triangle', chords: MAJ_A, stijl: 'rustig' },
    { root: 392.0, minor: false, bpm: 110, lead: 'sine', chords: MAJ_B, stijl: 'arp' },
    { root: 329.63, minor: false, bpm: 88, lead: 'triangle', chords: MAJ_D, stijl: 'rustig' },
  ],
  dino: [
    { root: 196.0, minor: true, bpm: 88, lead: 'triangle', chords: MIN_A, stijl: 'rustig' },
    { root: 174.61, minor: true, bpm: 100, lead: 'square', chords: MIN_B, stijl: 'arp' },
    { root: 220.0, minor: false, bpm: 92, lead: 'triangle', chords: MAJ_C, stijl: 'arp' },
  ],
};
const SONG_REPEAT = 4;      // zoveel stukjes van hetzelfde liedje, dan komt het volgende
const PENTA_MAJ = [0, 2, 4, 7, 9], PENTA_MIN = [0, 3, 5, 7, 10];
const MUSIC_VOL = 0.8;      // de muziek blijft op de achtergrond, onder de geluidseffecten

// iPad en iPhone: Web Audio (waar al ons geluid mee wordt gemaakt) telt daar als "belgeluid".
// Staat het apparaat op stil (het belletje in het Bedieningspaneel, of het schuifje op de
// zijkant van oudere iPads), dan loopt alles gewoon door maar hoor je niets. Een gewone
// <audio>-speler telt wel als "afspelen". Daarom laten we zo'n speler onhoorbare stilte
// herhalen: dan zet iOS al het geluid van de pagina op het afspeel-kanaal en klinkt het
// spel ook in de stille stand. (Nieuwere versies van iOS kennen navigator.audioSession,
// waar je dat gewoon aan kunt vragen.)
const UA = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
const IS_IOS = /iP(hone|ad|od)/.test(UA) || (/Macintosh/.test(UA) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);

// Een paar seconden stilte als WAV-bestandje (16 bits) in een data-adres. Het bestandje heeft
// dezelfde snelheid als het geluid van het spel en duurt een paar tellen. Eerst was het een
// kwart seconde op 44,1 kHz: dan begint de speler vier keer per seconde opnieuw, en als het
// spel zelf op 48 kHz draait moet de iPad steeds tussen twee snelheden kiezen. Allebei kunnen
// het geluid laten haperen.
function silentWav(rate, secs) {
  const n = Math.round(rate * secs), bytes = new Uint8Array(44 + n * 2), v = new DataView(bytes.buffer);
  const str = (o, t) => { for (let i = 0; i < t.length; i++) bytes[o + i] = t.charCodeAt(i); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return 'data:audio/wav;base64,' + btoa(bin);
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.vol = 0.8;
    this.musicOn = true;
    this.noiseBuf = null;
    this.amb = null;
    this.ambT = 0;
    this.kicked = false;
    this.sfxOn = true;
    this.musicViaTag = true; // de muziek via de mediaspeler van het apparaat afspelen (zie musicTag)
    this.forceTag = false;   // de stille speler ook buiten iPad en iPhone gebruiken (om te testen)
    this.silentSrc = '';
    this.bigBuf = true;      // grote geluidsbuffer (zie unlock); wordt gezet vanuit de instellingen
    this.useTag = true;      // de stille speler voor de stille stand van iPad en iPhone gebruiken
    this.ambVol = 1;         // hoe hard regen, wind en andere geluiden van de omgeving klinken (0..1)
    this.dest = null;        // waar een los geluidje naartoe gaat (leeg = de gewone geluidseffecten)
    this.notes = 0;          // hoeveel muzieknoten er zijn ingepland (voor de controle in het pauzemenu)
    // src = het stukje dat nu speelt, prev = het vorige (speelt nog tot de wissel), job = er wordt
    // een nieuw stukje uitgerekend, ready = dat stukje is klaar en wacht op de wissel
    this.mus = { world: '', next: 0, step: 0, phrase: null, idx: 5, on: true, src: null, prev: null, job: null, ready: null, t0: 0, loopDur: 0, v: -1, mel: -1 };
    this.canRender = typeof window !== 'undefined' && !!(window.OfflineAudioContext || window.webkitOfflineAudioContext);
    this.ambP = 0;           // de wind en de regen worden maar een paar keer per seconde bijgesteld
    this.tag = null;         // de stille <audio>-speler voor iPad en iPhone (zie bovenaan)
    this.channelMode = '';   // hoe we het geluid op het afspeel-kanaal hebben gezet (voor het pauzemenu)
  }

  // Zet het geluid op het afspeel-kanaal, zodat de stille stand van iPad of iPhone het niet dempt.
  // Moet binnen een tik worden aangeroepen.
  channel() {
    try {
      const as = navigator.audioSession;
      if (as) { if (as.type !== 'playback') as.type = 'playback'; this.channelMode = 'sessie'; }
    } catch (e) { /* bestaat hier niet */ }
    if (!(IS_IOS || this.forceTag) || !this.useTag) return;
    try {
      if (!this.tag) {
        const a = this.tag = document.createElement('audio');
        a.setAttribute('x-webkit-airplay', 'deny');
        a.setAttribute('playsinline', '');
        a.controls = false; a.disableRemotePlayback = true; a.preload = 'auto'; a.loop = true;
        a.src = this.silentSrc = silentWav(this.ctx ? this.ctx.sampleRate : 44100, 4);
        a.load();
      }
      if (this.tag.paused && !document.hidden) {
        const pr = this.tag.play();
        if (pr && pr.then) pr.then(() => { this.channelMode = 'speler'; }, () => {});
      }
    } catch (e) { /* dan blijft het zoals het was */ }
  }

  // het spel verdwijnt naar de achtergrond: de stille speler hoeft dan niet door te lopen
  sleep() {
    this.stopMusic(); this.engine(0);
    try { if (this.tag && !this.tag.paused) this.tag.pause(); } catch (e) { /* geeft niet */ }
  }

  // Moet na een tik of toets worden aangeroepen: browsers laten pas daarna geluid toe.
  // We proberen het bij elke tik opnieuw tot het geluid echt loopt (nodig op iPad en in Safari).
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (this.ctx) this.channel();
    if (!this.ctx) {
      // Een grote geluidsbuffer: de tablet rekent het geluid dan in grotere stukken vooruit uit.
      // Geluidjes klinken een fractie later, maar als de tablet het druk heeft (en dat heeft een
      // oude iPad met dit spel) valt het geluid veel minder snel weg. Kan de browser het niet,
      // dan gewoon de standaard.
      let c = null;
      if (this.bigBuf) { try { c = new AC({ latencyHint: 'playback' }); } catch (e) { c = null; } }
      if (!c) c = new AC();
      this.ctx = c;
      this.master = c.createGain();
      this.master.gain.value = this.vol;
      this.master.connect(c.destination);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, len);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // geluidseffecten hebben een eigen knop, zodat je ze los van de muziek uit kunt zetten
      this.sfxGain = c.createGain(); this.sfxGain.gain.value = this.sfxOn ? 1 : 0; this.sfxGain.connect(this.master);
      // wind die altijd zachtjes waait
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
      // regen, wind en de geluidjes van de omgeving hebben samen een eigen schuif
      this.ambGain = c.createGain(); this.ambGain.gain.value = this.ambVol; this.ambGain.connect(this.sfxGain);
      const g = c.createGain(); g.gain.value = 0.0;
      src.connect(f); f.connect(g); g.connect(this.ambGain); src.start();
      this.amb = { f, g };
      // regen: een tweede ruis die pas klinkt als het regent
      // (de ruis zelf wordt pas aangezet als het echt regent, zie ambience)
      const rf = c.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1800;
      const rg = c.createGain(); rg.gain.value = 0.0;
      rf.connect(rg); rg.connect(this.ambGain);
      this.rain = { f: rf, g: rg, src: null, dry: 0, roof: false };
      // muziek: eigen volumeknop en een meter (voor de controle)
      this.musicGain = c.createGain(); this.musicGain.gain.value = this.musicOn ? MUSIC_VOL : 0; this.musicGain.connect(this.master);
      this.mus.on = this.musicOn;
      try {
        this.meter = c.createAnalyser(); this.meter.fftSize = 1024; this.musicGain.connect(this.meter);
        this.meterBuf = new Uint8Array(this.meter.fftSize);
      } catch (e) { this.meter = null; }
      // de begeleiding en de melodie hebben elk een eigen schuif (onder de grond zwijgt de melodie)
      this.mus.gBack = c.createGain(); this.mus.gBack.gain.value = 0; this.mus.gBack.connect(this.musicGain);
      this.mus.gMel = c.createGain(); this.mus.gMel.gain.value = 0; this.mus.gMel.connect(this.musicGain);
      this.echo = null;
    }
    const c = this.ctx;
    if (!this.tag && !this.chan1) { this.chan1 = true; this.channel(); }          // de eerste keer: pas nu, zodat de stille speler de snelheid van het spel kent
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

  // Het motorgeluid van je voertuig: één brommende toon die hoger wordt als je harder gaat.
  // on = 0 zet hem uit. f = hoe hard je gaat (0..1), soort = 'weg', 'boot' of 'lucht'.
  engine(on, f = 0, soort = 'weg') {
    const c = this.ctx;
    if (!c) return;
    const now = c.currentTime;
    if (!on) {
      if (this.eng) { const e = this.eng; this.eng = null; e.g.gain.setTargetAtTime(0, now, 0.08); try { e.o.stop(now + 0.5); } catch (er) { /* geeft niet */ } }
      return;
    }
    if (!this.eng) {
      const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = 45; lp.type = 'lowpass'; lp.frequency.value = 420; g.gain.value = 0;
      o.connect(lp); lp.connect(g); g.connect(this.sfxGain); o.start();
      this.eng = { o, g, t: 0 };
    }
    if (now - this.eng.t < 0.12) return;                 // een paar keer per tel bijstellen is genoeg
    this.eng.t = now;
    const base = soort === 'lucht' ? 34 : soort === 'boot' ? 40 : 46;
    this.eng.o.frequency.setTargetAtTime(base + Math.min(1.2, f) * 78, now, 0.12);
    this.eng.g.gain.setTargetAtTime(this.sfxOn ? 0.05 + Math.min(1, f) * 0.04 : 0, now, 0.12);
  }

  // hoe hard de omgeving klinkt: regen, wind, onweer, vogels en dieren
  setAmb(v) {
    this.ambVol = Math.max(0, Math.min(1, +v));
    if (this.ambGain) this.ambGain.gain.setTargetAtTime(this.ambVol, this.ctx.currentTime, 0.05);
  }

  // geluidseffecten aan of uit (de muziek heeft zijn eigen knop)
  setSfx(on) {
    this.sfxOn = !!on;
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.sfxOn ? 1 : 0, this.ctx.currentTime, 0.05);
  }

  // Hoe gaat het met het geluid? Voor de regel in het pauzemenu (handig als het ergens stil blijft).
  diag() {
    if (!this.ctx) return null;
    this.measure();
    return { state: this.ctx.state, lat: Math.round(((this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0)) * 1000), via: this.mus.tagOn ? Math.round(this.tag.currentTime) : -1, rate: this.ctx.sampleRate, notes: this.notes, level: this.level || 0, ios: IS_IOS, channel: this.channelMode, loop: this.canRender };
  }

  // hoe sterk is het muzieksignaal op dit moment? (de hoogste waarde van de laatste paar seconden)
  measure() {
    if (!this.meter) return;
    let peak = 0;
    this.meter.getByteTimeDomainData(this.meterBuf);
    for (let i = 0; i < this.meterBuf.length; i++) { const v = Math.abs(this.meterBuf[i] - 128) / 128; if (v > peak) peak = v; }
    this.level = Math.max(peak, (this.level || 0) * 0.96);
  }

  // stil worden (bijv. in het hoofdmenu)
  quiet() {
    if (!this.ctx || !this.amb) return;
    this.amb.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    this.stopMusic();
  }

  tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0, attack = 0.005) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.dest || this.sfxGain);
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
    s.connect(f); f.connect(g); g.connect(this.dest || this.sfxGain);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // v = hoe hard (0..1), bijvoorbeeld zachter als het ver weg is
  play(name, v = 1, mat = 'stone') {
    if (!this.ctx || !this.sfxOn || v <= 0.02) return;
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
      case 'fuse': this.noise(1.2, 'highpass', 5200, 0.07 * v, 7000); break;
      case 'explode':
        this.noise(0.9, 'lowpass', 1400, 0.5 * v, 60); this.noise(0.25, 'highpass', 1800, 0.22 * v);
        this.tone(70, 0.6, 'sine', 0.45 * v, 28); this.tone(46, 0.9, 'triangle', 0.3 * v, 24, 0.05);
        break;
      case 'portal': [220, 277, 330, 440].forEach((f, i) => this.tone(f, 1.4, 'sine', 0.09 * v, f * 2, i * 0.08, 0.3)); this.noise(1.2, 'bandpass', 600, 0.1 * v, 3000, 0, 3); break;
      case 'splash': this.noise(0.3, 'bandpass', 1300, 0.22 * v, 500, 0, 0.8); break;
      case 'chest': this.tone(110, 0.25, 'sawtooth', 0.08 * v, 170); this.tone(1320, 0.3, 'sine', 0.12 * v, 0, 0.2); this.tone(1760, 0.4, 'sine', 0.1 * v, 0, 0.3); break;
      case 'hatch': for (let i = 0; i < 4; i++) this.noise(0.04, 'highpass', 3000, 0.2 * v, 0, i * 0.18); [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.14 * v, 0, 0.8 + i * 0.1)); this.tone(900, 0.2, 'sine', 0.1 * v, 1500, 1.3); break;
      case 'hearts': this.tone(880, 0.1, 'sine', 0.12 * v); this.tone(1175, 0.14, 'sine', 0.12 * v, 0, 0.09); break;
      case 'chirp': this.tone(1100 * r, 0.12, 'sine', 0.1 * v, 1700 * r); this.tone(1400 * r, 0.1, 'sine', 0.08 * v, 900, 0.1); break;
      case 'poof': this.noise(0.22, 'lowpass', 1400, 0.2 * v, 200); break;
      case 'death': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.16 * v, 0, i * 0.18)); break;
      case 'restore': [262, 330, 392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.9, 'sine', 0.13 * v, 0, i * 0.14, 0.05)); this.noise(2, 'bandpass', 800, 0.08 * v, 5000, 0, 2); break;
      // ---- dorpen, dieren, weer en treinen ----
      case 'coin': this.tone(1568, 0.07, 'square', 0.05 * v); this.tone(2093, 0.16, 'square', 0.05 * v, 0, 0.06); this.tone(2637, 0.2, 'sine', 0.07 * v, 0, 0.12); break;
      case 'chug': this.noise(0.16, 'lowpass', 700, 0.3 * v, 160); this.tone(90, 0.1, 'triangle', 0.14 * v, 60); break;
      // vogels: een triller, een roep van twee tonen en een lange fluittoon die omhoog gaat
      case 'vogel1': for (let i = 0; i < 5; i++) this.tone((2300 + i * 90) * r, 0.05, 'sine', 0.07 * v, 2900 * r, i * 0.07); break;
      case 'vogel2': this.tone(1700 * r, 0.16, 'sine', 0.09 * v, 1300 * r); this.tone(1300 * r, 0.22, 'sine', 0.08 * v, 0, 0.2); break;
      case 'vogel3': this.tone(1500 * r, 0.3, 'sine', 0.07 * v, 2600 * r); this.tone(2600 * r, 0.08, 'sine', 0.06 * v, 0, 0.32); this.tone(2600 * r, 0.08, 'sine', 0.06 * v, 0, 0.44); break;
      case 'koekoek': this.tone(660, 0.2, 'sine', 0.08 * v); this.tone(523, 0.28, 'sine', 0.08 * v, 0, 0.26); break;
      // een ratelslang: een hele rij korte tikjes
      case 'ratel': for (let i = 0; i < 16; i++) this.noise(0.025, 'highpass', 5200, 0.1 * v * (i < 12 ? 1 : (16 - i) / 5), 0, i * 0.045); break;
      // een autoclaxon: twee tonen tegelijk, één of twee keer
      case 'claxon': { const n = Math.random() < 0.5 ? 1 : 2; for (let i = 0; i < n; i++) { this.tone(415, 0.22, 'square', 0.05 * v, 0, i * 0.3, 0.01); this.tone(523, 0.22, 'square', 0.045 * v, 0, i * 0.3, 0.01); } break; }
      case 'toet': this.tone(590, 0.7, 'square', 0.07 * v, 0, 0, 0.03); this.tone(740, 0.7, 'square', 0.06 * v, 0, 0, 0.03); this.noise(0.7, 'bandpass', 1600, 0.07 * v, 0, 0, 2); break;
      case 'zap': this.noise(0.14, 'highpass', 3000, 0.25 * v); this.tone(1900 * r, 0.1, 'sawtooth', 0.1 * v, 200); this.tone(120, 0.22, 'square', 0.12 * v, 50, 0.03); break;
      case 'ijs': this.tone(2600 * r, 0.12, 'sine', 0.1 * v, 3900); this.tone(3300 * r, 0.14, 'sine', 0.07 * v, 0, 0.05); this.noise(0.12, 'highpass', 5000, 0.14 * v); break;
      case 'gif': this.noise(0.5, 'bandpass', 500, 0.22 * v, 1500, 0, 3); for (let i = 0; i < 3; i++) this.tone(300 + i * 90, 0.09, 'sine', 0.08 * v, 520 + i * 90, 0.1 + i * 0.09); break;
      case 'donder':
        this.noise(0.14, 'highpass', 2200, 0.3 * v);
        this.noise(2.6, 'lowpass', 300, 0.6 * v, 50, 0.04); this.noise(1.8, 'lowpass', 140, 0.5 * v, 40, 0.5);
        this.tone(52, 1.6, 'triangle', 0.3 * v, 30, 0.06);
        break;
      case 'baa': this.tone(430 * r, 0.42, 'sawtooth', 0.05 * v, 380 * r, 0, 0.05); this.tone(436 * r, 0.42, 'square', 0.02 * v, 330 * r, 0.02, 0.05); break;
      case 'boe': this.tone(150 * r, 0.8, 'sawtooth', 0.07 * v, 108 * r, 0, 0.12); this.tone(300 * r, 0.7, 'sine', 0.03 * v, 216 * r, 0, 0.12); break;
      case 'huil': this.tone(330 * r, 1.3, 'sine', 0.07 * v, 560 * r, 0, 0.25); this.tone(335 * r, 1.0, 'triangle', 0.04 * v, 420 * r, 0.6, 0.2); break;
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
    o.connect(f); f.connect(g); g.connect(this.sfxGain);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }

  // sfeergeluiden en een zacht muziekje; een paar keer per seconde aanroepen
  ambience(dt, env) {
    if (!this.ctx) return;
    const w = env.world, now = this.ctx.currentTime;
    // Wind en regen bijstellen kost de geluidsdraad elke keer een beetje werk, dus dat doen we
    // maar vier keer per seconde (ze veranderen toch heel langzaam).
    this.ambP -= dt;
    if (this.ambP <= 0) {
      this.ambP = 0.25;
      const a = this.amb;
      const windVol = env.under ? 0.01 : (w === 'ijs' ? 0.09 : w === 'wolken' ? 0.08 : w === 'vuur' ? 0.05 : 0.035) * (0.6 + 0.4 * Math.sin(now * 0.3));
      a.g.gain.setTargetAtTime(this.sfxOn ? windVol + (env.flying ? 0.08 : 0) : 0, now, 0.5);
      const wf = env.flying ? 900 : (w === 'ijs' ? 600 : 380);
      if (wf !== a.wf) { a.wf = wf; a.f.frequency.setTargetAtTime(wf, now, 0.5); }
      // regen: zachter als je onder een dak staat of onder de grond zit
      const r = this.rain;
      if (r) {
        const rv = this.sfxOn ? (env.rain || 0) * (env.under ? 0.04 : env.roof ? 0.35 : 1) * 0.11 : 0;
        if (rv > 0.0005) {
          r.dry = 0;
          if (!r.src) {          // het begint te regenen: de ruis aanzetten
            const rs = r.src = this.ctx.createBufferSource(); rs.buffer = this.noiseBuf; rs.loop = true;
            rs.connect(r.f); rs.start(0, 0.37);
          }
          r.g.gain.setTargetAtTime(rv, now, 0.4);
          if (!!env.roof !== r.roof) { r.roof = !!env.roof; r.f.frequency.setTargetAtTime(r.roof ? 900 : 1800, now, 0.4); }
        } else if (r.src) {
          if (r.dry === 0) r.g.gain.setTargetAtTime(0, now, 0.4);
          r.dry += 0.25;
          if (r.dry > 3) {       // al een tijdje droog: de ruis hoeft niet door te lopen
            try { r.src.stop(); r.src.disconnect(); } catch (e) { /* geeft niet */ }
            r.src = null;
          }
        }
      }
    }
    this.ambT -= dt;
    if (this.ambT <= 0 && this.sfxOn) {
      // in het bos hoor je veel meer vogels dan op een open veld
      const bos = env.bos || 0, vogelWereld = w === 'groen' || w === 'wolken' || w === 'dino';
      this.ambT = (2 + Math.random() * 5) * (bos > 0.2 && vogelWereld && env.day > 0.5 && !env.under ? 0.4 : 1);
      this.dest = this.ambGain;              // vogeltjes, druppels en gerommel horen bij de omgeving
      if (env.under) { this.tone(1300 + Math.random() * 600, 0.08, 'sine', 0.05, 700); }
      else if (env.stad && Math.random() < 0.4) this.play('claxon', 0.5 + Math.random() * 0.5);                 // in de stad toetert er af en toe een auto
      else if (env.zand && Math.random() < 0.3) this.play('ratel', 0.7);                                          // in de woestijn ratelt af en toe een slang
      else if (vogelWereld) { if (env.day > 0.5) { if (bos > 0.2) this.play(['vogel1', 'vogel2', 'vogel3', 'chirp', 'vogel1', 'koekoek'][Math.floor(Math.random() * 6)], 0.35 + bos * 0.4); else if (Math.random() < 0.45) this.play('chirp', 0.45); } else { for (let i = 0; i < 4; i++) this.tone(4200, 0.03, 'sine', 0.025, 0, i * 0.07); } }
      else if (w === 'vuur') { this.noise(0.5, 'lowpass', 200, 0.12, 80); }
      else if (w === 'schaduw') { this.tone(55 + Math.random() * 10, 2.5, 'sine', 0.07, 0, 0, 0.8); this.tone(82, 2.5, 'sine', 0.03, 78, 0, 0.8); }
      this.dest = null;
    }
    this.music(env);
  }

  // een muzieknoot op een afgesproken moment; c = waar hij klinkt (live of in een stukje dat
  // vooruit wordt uitgerekend), out = de uitgang, echo = de echo (of niets)
  note(c, out, echo, freq, when, dur, type, vol, attack) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(out);
    if (echo) g.connect(echo);
    o.start(when); o.stop(when + dur + 0.05);
    this.notes++;
  }

  // De noten van één achtste tel. emit(melodie?, toon, wanneer, duur, klank, sterkte, aanzet).
  songStep(song, phrase, step, t, v, emit) {
    const stepDur = 60 / song.bpm / 2;
    const chords = song.chords;
    const hz = (n) => song.root * Math.pow(2, n / 12);
    const st = step % 8, chord = chords[Math.floor(step / 8) % 4];
    if (song.stijl === 'arp') {
      // de tonen van het akkoord één voor één, met een bas op de eerste tel
      if (st === 0) { emit(false, hz(chord[0] - 12), t, stepDur * 7.6, 'triangle', 0.09 * v, 0.03); emit(false, hz(chord[0]), t, stepDur * 7.6, 'sine', 0.04 * v, 0.03); }
      if (st % 2 === 0) emit(false, hz(chord[[0, 1, 2, 1][st / 2]] + 12), t, stepDur * 1.9, 'triangle', 0.045 * v, 0.02);
    } else if (st === 0) {
      emit(false, hz(chord[0] - 12), t, stepDur * 7.6, 'triangle', 0.1 * v, 0.03);                  // bas
      emit(false, hz(chord[0]), t, stepDur * 7.6, 'sine', 0.05 * v, 0.03);                           // dezelfde toon hoger: kleine speakers geven lage tonen slecht weer
      for (const n of chord) emit(false, hz(n + 12), t, stepDur * 8.2, 'triangle', 0.035 * v, 0.4);  // akkoord
    } else if (st === 4) {
      emit(false, hz(chord[0] - 12), t, stepDur * 3.6, 'triangle', 0.07 * v, 0.03);
      emit(false, hz(chord[0]), t, stepDur * 3.6, 'sine', 0.035 * v, 0.03);
    } else if (st === 6) {
      emit(false, hz(chord[2] - 12), t, stepDur * 1.8, 'triangle', 0.05 * v, 0.03);
    }
    const n = phrase[step % 32];
    if (n >= 0) {
      const rest = phrase[(step + 1) % 32] < 0;
      emit(true, hz(n), t, stepDur * (rest ? 1.9 : 1.05), song.lead, 0.13 * v, 0.012);               // melodie
    }
  }

  // een nieuw melodietje van vier maten (32 achtste noten); -1 = rust
  // Welk liedje is aan de beurt in deze wereld? Na een paar stukjes komt het volgende.
  nextSong(world) {
    const list = SONGS[world] || SONGS.groen, all = this.lied || (this.lied = {});
    const k = all[world] || (all[world] = { i: Math.floor(Math.random() * list.length), n: 0 });
    if (k.n >= SONG_REPEAT) { k.i = (k.i + 1) % list.length; k.n = 0; }
    k.n++;
    this.songNr = k.i + 1; this.songCount = list.length;
    return list[k.i];
  }

  makePhrase(song) {
    const penta = song.minor ? PENTA_MIN : PENTA_MAJ, chords = song.chords;
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

  // De muziek. Vroeger werd elke noot los gemaakt terwijl je speelde: tientallen toontjes
  // tegelijk, die de geluidsdraad allemaal moest uitrekenen, en als het beeld even haperde
  // haperde het liedje mee. Op een oude iPad stotterden daardoor het geluid en het spel.
  // Nu rekenen we vier maten in één keer vooruit uit (op een eigen draad, los van het beeld)
  // en spelen dat stukje als een lusje af. Dat kost bijna niets. Na twee keer spelen komt er
  // een nieuw melodietje, dat precies op de maat wordt ingewisseld.
  music(env) {
    const c = this.ctx, m = this.mus, now = c.currentTime;
    if (m.on !== this.musicOn) { m.on = this.musicOn; this.musicGain.gain.setTargetAtTime(m.on ? MUSIC_VOL : 0, now, 0.15); }
    if (!this.musicOn) { m.next = 0; this.stopMusic(); return; }
    if (!this.canRender) { this.musicLive(env); return; }
    if (this.tag && this.musicViaTag) { this.musicTag(env); return; }
    if (m.tagOn || m.tagNext) this.tagStop();
    if (m.world !== env.world) { this.stopMusic(); m.world = env.world; }
    if (m.ready && m.ready.world !== m.world) m.ready = null;
    if (m.ready) {
      const r = m.ready; m.ready = null;
      let at = now + 0.1;
      if (m.src) {
        // wisselen aan het eind van een lusje, op zijn vroegst na twee keer spelen
        at = m.t0 + m.loopDur * Math.max(2, Math.ceil((now + 0.25 - m.t0) / m.loopDur));
        try { m.src.stop(at); } catch (e) { /* geeft niet */ }
        m.prev = m.src;
      } else { m.v = -1; m.mel = -1; }
      const src = c.createBufferSource(); src.buffer = r.buf; src.loop = true; src.loopStart = 0; src.loopEnd = r.loopDur;
      const split = c.createChannelSplitter(2);
      src.connect(split); split.connect(m.gBack, 0); split.connect(m.gMel, 1);
      src.onended = () => { try { split.disconnect(); } catch (e) { /* geeft niet */ } if (m.prev === src) m.prev = null; };
      src.start(at);
      m.src = src; m.t0 = at; m.loopDur = r.loopDur;
    }
    if (!m.src) { if (!m.job) this.renderSong(m.world); return; }
    // tijdens de tweede keer spelen: het volgende melodietje alvast uitrekenen
    if (!m.job && now > m.t0 + m.loopDur) this.renderSong(m.world);
    // overdag iets harder dan 's nachts; onder de grond zachter en zonder melodie
    const v = (env.under ? 0.6 : 1) * (0.75 + 0.25 * (env.day === undefined ? 1 : env.day)), mel = env.under ? 0 : 1;
    if (Math.abs(v - m.v) > 0.02 || mel !== m.mel) {
      const t = Math.max(now, m.v < 0 ? m.t0 : 0);
      m.v = v; m.mel = mel;
      m.gBack.gain.setTargetAtTime(v, t, 0.3);
      m.gMel.gain.setTargetAtTime(v * mel, t, 0.3);
    }
  }

  // ---------- muziek via de mediaspeler (iPad en iPhone) ----------
  // Op een oude iPad haperde het geluid, wat we ook deden: de browser rekent al het geluid van
  // het spel uit in piepkleine stukjes (3 milliseconden) en als de tablet het druk heeft komt
  // zo'n stukje te laat. De gewone mediaspeler van het apparaat (dezelfde die een liedje of
  // filmpje afspeelt) heeft daar geen last van: die krijgt een kant-en-klaar bestandje en
  // buffert zelf ruim vooruit. Daarom maken we van elk muziekstukje een WAV-bestandje (twee
  // keer het melodietje en de naklank) en laten we dat door die speler afspelen. Het is
  // dezelfde speler die er ook voor zorgt dat je geluid hoort in de stille stand.
  // De speler kan zijn eigen volume niet veranderen (dat mag niet op een iPad), dus het
  // volume zit in het bestandje zelf: verander je het, dan maken we een nieuw stukje.
  musicTag(env) {
    const m = this.mus, tag = this.tag;
    if (m.src || m.prev) { const j = m.job; this.stopMusic(); m.job = j; }      // de andere manier liep nog
    if (m.world !== env.world) { this.tagStop(); m.world = env.world; }
    const v = (0.75 + 0.25 * (env.day === undefined ? 1 : env.day)) * (env.under ? 0.6 : 1) * this.vol * MUSIC_VOL;
    const sig = Math.round(this.vol * 20) + (env.under ? 'u' : 'b');             // verandert dit, dan moet er meteen een nieuw stukje komen
    const fresh = () => this.renderSong(m.world, { gain: v, mel: env.under ? 0 : 1, sig, world: m.world });
    if (m.tagNext && m.tagNext.world !== m.world) { URL.revokeObjectURL(m.tagNext.url); m.tagNext = null; }
    if (!m.tagOn) {
      if (m.tagNext) this.tagPlay();
      else if (!m.job) fresh();
      return;
    }
    if (m.tagSig !== sig) {
      if (m.tagNext && m.tagNext.sig === sig) this.tagPlay();                    // het nieuwe volume is klaar: meteen wisselen
      else if (!m.job) { if (m.tagNext) { URL.revokeObjectURL(m.tagNext.url); m.tagNext = null; } fresh(); }
      return;
    }
    // onderweg alvast het volgende melodietje klaarzetten
    if (!m.tagNext && !m.job && tag.currentTime > 4) fresh();
  }

  // het klaargezette stukje afspelen
  tagPlay() {
    const m = this.mus, tag = this.tag, r = m.tagNext;
    m.tagNext = null;
    const old = m.tagUrl;
    m.tagUrl = r.url; m.tagSig = r.sig; m.tagOn = true;
    tag.onended = () => {
      // afgelopen: het volgende stukje, of (als dat er nog niet is) hetzelfde nog een keer
      if (!m.tagOn) return;
      if (m.tagNext && m.tagNext.sig === m.tagSig && m.tagNext.world === m.world) this.tagPlay();
      else { try { tag.currentTime = 0; const pr = tag.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) { /* geeft niet */ } }
    };
    try {
      tag.loop = false; tag.src = r.url;
      const pr = tag.play();
      if (pr && pr.catch) pr.catch(() => {});
    } catch (e) { /* de volgende tik proberen we het opnieuw */ }
    if (old) URL.revokeObjectURL(old);
  }

  // terug naar de stille lus (muziek uit, een andere wereld, het hoofdmenu)
  tagStop() {
    const m = this.mus, tag = this.tag;
    if (m.tagNext) { URL.revokeObjectURL(m.tagNext.url); m.tagNext = null; }
    if (!m.tagOn || !tag) { m.tagOn = false; return; }
    m.tagOn = false; m.tagSig = ''; m.job = null;
    try {
      tag.onended = null; tag.loop = true; tag.src = this.silentSrc;
      if (!document.hidden) { const pr = tag.play(); if (pr && pr.catch) pr.catch(() => {}); }
    } catch (e) { /* geeft niet */ }
    if (m.tagUrl) { URL.revokeObjectURL(m.tagUrl); m.tagUrl = ''; }
  }

  // Van een uitgerekend muziekstukje een WAV-bestandje maken: twee keer het melodietje, met
  // de naklank van de eerste keer door de tweede heen en de laatste naklank aan het eind.
  songWav(buf, loopN, o) {
    const a = buf.getChannelData(0), b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
    const tail = a.length - loopN, n = loopN * 2 + tail, rate = buf.sampleRate;
    const bytes = new ArrayBuffer(44 + n * 2), v = new DataView(bytes);
    const str = (p, t) => { for (let i = 0; i < t.length; i++) v.setUint8(p + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    const out = new Int16Array(bytes, 44, n), g = o.gain * 32767, mel = o.mel;
    const at = (i) => a[i] + (b ? b[i] * mel : 0);
    for (let i = 0; i < n; i++) {
      let s = 0;
      if (i < loopN) s = at(i);
      else if (i < 2 * loopN) { const k = i - loopN; s = at(k) + (k < tail ? at(loopN + k) : 0); }
      else s = at(i - loopN);
      s *= g;
      out[i] = s > 32767 ? 32767 : s < -32768 ? -32768 : s;
    }
    return { url: URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })), sig: o.sig, world: o.world };
  }

  // de muziek stilzetten (muziek uit, een andere wereld, het hoofdmenu, de tablet weggelegd)
  stopMusic() {
    const m = this.mus;
    if (m.tagOn || m.tagNext) this.tagStop();
    m.job = null; m.ready = null;
    if (!this.ctx || (!m.src && !m.prev)) return;
    const now = this.ctx.currentTime;
    m.gBack.gain.cancelScheduledValues(now); m.gMel.gain.cancelScheduledValues(now);
    m.gBack.gain.setTargetAtTime(0, now, 0.06); m.gMel.gain.setTargetAtTime(0, now, 0.06);
    for (const s of [m.src, m.prev]) { if (s) { try { s.stop(now + 0.4); } catch (e) { /* was al gestopt */ } } }
    m.src = null; m.prev = null; m.v = -1; m.mel = -1;
  }

  // Reken vier maten muziek vooruit uit: links de begeleiding, rechts de melodie met echo.
  renderSong(world, wav) {
    const m = this.mus, song = this.nextSong(world);
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const stepDur = 60 / song.bpm / 2;
    const job = m.job = { world };
    const fail = () => { if (m.job === job) m.job = null; this.canRender = false; };
    // Op halve snelheid uitrekenen is twee keer zo weinig werk en voor dit zachte muziekje
    // hoor je het verschil niet. Kan de browser dat niet, dan op de gewone snelheid.
    const full = this.ctx.sampleRate, rates = [Math.max(22050, Math.round(full / 2)), full];
    let oc = null, rate = 0;
    for (const r of rates) {
      try { oc = new OAC(2, Math.round(32 * stepDur * r) + Math.round(2.5 * r), r); rate = r; break; } catch (e) { oc = null; }
    }
    if (!oc) { fail(); return; }
    try {
      const loopN = Math.round(32 * stepDur * rate);
      const merge = oc.createChannelMerger(2); merge.connect(oc.destination);
      const back = oc.createGain(), lead = oc.createGain();
      back.connect(merge, 0, 0); lead.connect(merge, 0, 1);
      const echo = oc.createDelay(1); echo.delayTime.value = 0.34;
      const fb = oc.createGain(); fb.gain.value = 0.3;
      const wet = oc.createGain(); wet.gain.value = 0.35;
      echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(lead);
      const phrase = this.makePhrase(song);
      for (let step = 0; step < 32; step++) {
        this.songStep(song, phrase, step, step * stepDur, 1, (isMel, f, t, dur, type, vol, attack) => this.note(oc, isMel ? lead : back, isMel ? echo : null, f, t, dur, type, vol, attack));
      }
      oc.oncomplete = (ev) => {
        if (m.job !== job) return;              // intussen is de muziek gestopt of van wereld gewisseld
        m.job = null;
        if (wav) { try { m.tagNext = this.songWav(ev.renderedBuffer, loopN, wav); } catch (e) { this.musicViaTag = false; } return; }
        try {
          // Wat na de laatste maat nog naklinkt tellen we bij het begin op: zo sluit het lusje
          // naadloos op zichzelf aan.
          const buf = ev.renderedBuffer;
          for (let ch = 0; ch < buf.numberOfChannels; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = loopN; i < d.length; i++) d[(i - loopN) % loopN] += d[i];
          }
          m.ready = { world, buf, loopDur: loopN / rate };
        } catch (e) { this.canRender = false; }
      };
      const pr = oc.startRendering();
      if (pr && pr.catch) pr.catch(fail);
    } catch (e) { fail(); }
  }

  // De oude manier (elke noot los, terwijl je speelt), voor browsers die niet vooruit kunnen rekenen.
  musicLive(env) {
    const c = this.ctx, m = this.mus, now = c.currentTime;
    if (this.echo === null) {
      this.echo = false;
      try {
        const echo = c.createDelay(1); echo.delayTime.value = 0.34;
        const fb = c.createGain(); fb.gain.value = 0.3;
        const wet = c.createGain(); wet.gain.value = 0.35;
        echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(this.musicGain);
        this.echo = echo;
      } catch (e) { /* dan maar zonder echo */ }
    }
    if (m.world !== env.world) { m.world = env.world; m.step = 0; m.phrase = null; m.next = now + 0.5; m.liveSong = null; }
    const song = m.liveSong || (m.liveSong = this.nextSong(env.world));
    if (m.next < now - 0.2) m.next = now + 0.12;          // na een pauze niet alles inhalen
    const stepDur = 60 / song.bpm / 2;
    const v = (env.under ? 0.6 : 1) * (0.75 + 0.25 * (env.day === undefined ? 1 : env.day));
    while (m.next < now + 0.4) {
      if (!m.phrase) m.phrase = this.makePhrase(song);
      this.songStep(song, m.phrase, m.step, m.next, v, (isMel, f, t, dur, type, vol, attack) => {
        if (isMel && env.under) return;
        this.note(c, this.musicGain, isMel ? this.echo || null : null, f, t, dur, type, vol, attack);
      });
      m.step++;
      if (m.step % 64 === 0) { m.phrase = null; m.liveSong = null; }      // na twee keer spelen: een nieuw melodietje (en misschien het volgende liedje)
      m.next += stepDur;
    }
  }
}
