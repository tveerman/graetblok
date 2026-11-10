// Graet Blok - het begin van alles aan de kant van het spel (de "client").
import * as THREE from '../../vendor/three.module.min.js';
import { HOTBAR, INV_SIZE, clamp } from '../shared/constants.js';
import { B, BLOCKS } from '../shared/blocks.js';
import { WORLDS } from '../shared/worlds.js';
import { dragonStage } from '../shared/mobs.js';
import { buildAtlas, setIconAtlas } from './textures.js';
import { Renderer } from './render.js';
import { ChunkWorld, setTreeTiles } from './chunks.js';
import { Particles } from './particles.js';
import { Entities } from './entities.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { connect } from './net.js';
import { setupOffline } from './offline.js';

const $ = (id) => document.getElementById(id);
const DEFAULTS = { view: 5, volume: 0.8, sens: 1, music: true, autoJump: true, dynRes: true };

class Game {
  constructor() {
    const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.touch = touch;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('graetblok.settings') || '{}'); } catch (e) { /* geen opslag */ }
    this.settings = Object.assign({}, DEFAULTS, touch ? { view: 4 } : {}, saved);
    try { this.look = JSON.parse(localStorage.getItem('graetblok.look') || 'null') || { type: 'mens', shirt: 0x2f7fd0 }; } catch (e) { this.look = { type: 'mens', shirt: 0x2f7fd0 }; }
    this.debug = /[?&]debug/.test(location.search);

    this.atlas = buildAtlas();
    setIconAtlas(this.atlas);
    this.tileCol = new Map();
    this.R = new Renderer($('game'), this.atlas.tex, touch);
    this.world = new ChunkWorld(this.R.scene, this.atlas, this.R.chunkMats);
    this.particles = new Particles(this.R.scene);
    this.ents = new Entities(this.R.scene, this.particles);
    this.sound = new Sound();
    this.inv = new Array(INV_SIZE).fill(0);
    this.sel = 0;
    this.trees = {};
    this.dragons = [];
    this.worldId = 'groen';
    this.time = 0; this.gameTime = 0;
    this.state = 'menu';
    this.net = null;
    this.ui = new UI(this);
    this.input = new Input($('game'), {
      onUse: (ndc) => { this.sound.unlock(); if (!this.ui.modalOpen()) this.player.use(ndc); },
      onKey: (code) => this.onKey(code),
      canPlay: () => this.state === 'play' && !this.ui.modalOpen(),
    });
    this.player = new Player(this);
    this.ui.setTouch(touch);
    this.applySettings(true);
    this.frameT = 0.016; this.resT = 0; this.last = performance.now(); this.weatherT = 0; this.loadT = 0;
    this.fpsText = '';

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden || !this.net) return;
      // de tablet wordt weggelegd of er wordt naar een andere app gegaan: pauzeren en opslaan
      if (this.state === 'play' && !this.ui.modalOpen()) this.ui.openPause();
      this.syncPause();
      this.net.send({ t: 'save' });
    });
    window.addEventListener('pagehide', () => { if (this.net) this.net.send({ t: 'save' }); });
    // geluid mag pas na een tik of toets; in de "capture"-fase zodat geen enkele knop dit tegenhoudt
    for (const ev of ['touchend', 'click', 'mousedown', 'pointerup', 'keydown']) document.addEventListener(ev, () => this.sound.unlock(), { passive: true, capture: true });

    this.buildMenu();
    setupOffline(this);
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------- hoofdmenu ----------

  buildMenu() {
    const types = [['mens', 'Mens'], ['elf', 'Elf'], ['robot', 'Robot']];
    const colors = [0x2f7fd0, 0xd0362f, 0x3fa34a, 0xe8b02a, 0x8a4ad0, 0xe86aa8, 0x2a2a34, 0xf0f0f0];
    const tbox = $('lookTypes'), cbox = $('lookColors');
    const render = () => {
      tbox.innerHTML = ''; cbox.innerHTML = '';
      for (const [k, name] of types) {
        const b = document.createElement('button');
        b.className = 'btn small' + (this.look.type === k ? ' active' : ''); b.textContent = name;
        b.onclick = () => { this.look.type = k; saveLook(); render(); };
        tbox.appendChild(b);
      }
      for (const c of colors) {
        const b = document.createElement('button');
        b.className = 'swatch' + (this.look.shirt === c ? ' active' : '');
        b.style.background = '#' + c.toString(16).padStart(6, '0');
        b.onclick = () => { this.look.shirt = c; saveLook(); render(); };
        cbox.appendChild(b);
      }
    };
    const saveLook = () => { try { localStorage.setItem('graetblok.look', JSON.stringify(this.look)); } catch (e) { /* */ } this.player.setLook(this.look); if (this.net) this.net.send({ t: 'look', look: this.look }); };
    render();
    $('btnPlay').onclick = () => this.start(false);
    $('btnNew').onclick = () => { if (window.confirm('Een nieuwe wereld beginnen? Je oude wereld en al je spullen worden gewist!')) this.start(true); };
  }

  async start(reset) {
    this.sound.unlock();
    $('menu').classList.add('hidden');
    this.ui.loading('De wereld wordt gemaakt...');
    this.state = 'loading';
    if (!this.net) this.net = await connect((m) => this.onMsg(m));
    this.net.send({ t: 'hello', name: 'speler', view: this.settings.view, look: this.look, reset: !!reset, debug: this.debug });
  }

  // Staat er een venster open (rugzak, opdrachten, pauze...)? Dan staat het spel stil.
  isPaused() { return this.state === 'play' && this.ui.modalOpen(); }

  // vertel de server of de wereld stil moet staan
  syncPause() {
    const on = this.isPaused();
    if (on === this.pausedSent || !this.net) return;
    this.pausedSent = on;
    this.net.send({ t: 'pause', on });
  }

  // Terug naar het beginscherm. De pagina wordt niet opnieuw geladen (dat zou mislukken
  // als de server uit staat): het spel slaat op, stopt, en laat het hoofdmenu weer zien.
  toMenu() {
    if (this.state !== 'play') return;
    const p = this.player, ui = this.ui;
    ui.close();
    this.net.send({ t: 'leave' });
    this.state = 'menu';
    p.frozen = true; p.mount = 0; this.ents.ridden = 0;
    p.model.visible = false; p.held.visible = false; p.hl.visible = false; p.crack.visible = false;
    this.input.exitLock(); this.input.breakHeld = false;
    ui.showHud(false); ui.setMounted(false); ui.setBoss(null); ui.setTint(''); ui.fade(false); ui.loading(null);
    this.world.clear(); this.ents.clear(); this.particles.clear();
    this.R.setWorld('groen', this.trees);
    this.sound.quiet();
    $('menu').classList.remove('hidden');
    if (this.checkServer) this.checkServer();
  }

  newWorld() {
    this.state = 'loading';
    this.player.frozen = true;
    this.ui.showHud(false);
    this.ui.loading('Een nieuwe wereld wordt gemaakt...');
    this.net.send({ t: 'hello', name: 'speler', view: this.settings.view, look: this.look, reset: true, debug: this.debug });
  }

  applySettings(first) {
    const S = this.settings;
    this.R.setView(S.view);
    this.sound.setVolume(S.volume);
    this.sound.musicOn = S.music;
    this.input.sens = S.sens;
    this.player.autoJump = S.autoJump;
    if (!S.dynRes) this.R.setScale(1);
    if (!first) {
      try { localStorage.setItem('graetblok.settings', JSON.stringify(S)); } catch (e) { /* */ }
      if (this.net && this.sentView !== S.view) { this.sentView = S.view; this.net.send({ t: 'view', r: S.view }); }
    }
  }

  // ---------- berichten van de server ----------

  onMsg(m) {
    const p = this.player, ui = this.ui;
    if (this.state === 'menu') return;          // nog onderweg zijnde berichten van een gestopt spel
    switch (m.t) {
      case 'welcome':
      case 'world': {
        this.worldId = m.world;
        this.world.clear(); this.ents.clear(); this.ents.world = m.world;
        this.trees = m.trees || {};
        setTreeTiles(this.trees);
        this.R.setWorld(m.world, this.trees);
        this.pausedSent = false;
        p.dead = false; p.frozen = true; p.mount = 0; this.ents.ridden = 0;
        if (ui.modal === 'death') { ui.modal = null; document.getElementById('modal').classList.add('hidden'); }
        p.teleport(m.x, m.y, m.z, m.yaw);
        this.gameTime = m.time;
        this.state = 'loading'; this.loadT = 0;
        ui.setMounted(false); ui.setBoss(null);
        if (m.t === 'welcome') {
          this.isNew = m.isNew;
          this.sentView = this.settings.view;
          if (!m.saved) setTimeout(() => ui.toast('Let op: in dit venster kan het spel niet opslaan.', 'warn'), 4000);
          ui.loading('De wereld wordt geladen...');
        } else ui.fade(true, 'Je reist naar de ' + WORLDS[m.world].name + '...');
        this.net.send({ t: 'move', x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: 0 });
        break;
      }
      case 'tp': p.teleport(m.x, m.y, m.z); break;
      case 'chunk': if (m.w === this.worldId) this.world.addChunk(m.cx, m.cz, m.b); break;
      case 'unload': this.world.removeChunk(m.cx, m.cz); break;
      case 'block': this.world.setBlock(m.x, m.y, m.z, m.id); break;
      case 'inv': this.inv = m.s; ui.setInv(); break;
      case 'stats': this.setTrees(m.trees); ui.setStats(m); break;
      case 'trees': this.setTrees(m.trees); break;
      case 'quest': ui.setQuest(m); break;
      case 'questDone': ui.toast('⭐ Opdracht gelukt: ' + m.title, 'good'); this.sound.play('quest'); break;
      case 'toast': ui.toast(m.text, m.kind); if (m.kind === 'warn') this.sound.play('deny'); if (m.kind === 'rank') this.sound.play('quest'); break;
      case 'dialog': ui.openDialog(m.title, m.lines); break;
      case 'got': ui.got(m.id, m.n); this.sound.play('got'); break;
      case 'crafted': this.sound.play('craft'); break;
      case 'ate': this.sound.play('eat'); break;
      case 'shot': this.sound.play(m.k === 'pijl' ? 'pijl' : m.k === 'laser' ? 'laser' : m.k === 'oer' ? 'oer' : 'magie'); break;
      case 'hurt': ui.flashHurt(); this.sound.play('hurt'); p.knock(m.kx, m.kz); break;
      case 'dead': p.dead = true; this.sound.play('death'); ui.close(); ui.openDeath(); break;
      case 'time': this.gameTime = m.time; if (m.sleep) { this.sound.play('sleep'); ui.fade(true, 'Zzz...'); setTimeout(() => ui.fade(false), 1400); } break;
      case 'ents': this.ents.snapshot(m.l); ui.setBoss(m.boss); break;
      case 'spawn': this.ents.spawn(m); break;
      case 'despawn': this.ents.despawn(m.id); break;
      case 'entMeta': this.ents.meta(m); break;
      case 'proj': this.ents.addProj(m); if (m.s === 'm') this.sound.play('vuurbal', this.vol(m.x, m.y, m.z) * 0.6); break;
      case 'projEnd': { const pr = this.ents.endProj(m); if (pr) this.sound.play(pr.arrow ? 'hit' : 'boom', this.vol(m.x, m.y, m.z) * 0.7); break; }
      case 'fx': this.fx(m); break;
      case 'mount': p.setMount(m.id, m.s); ui.setMounted(!!m.id); if (m.id) { this.sound.play('roar', 0.6); ui.toast(this.touch ? 'Duw de stick naar voren om te vliegen. ⬆ omhoog, ⬇ omlaag.' : 'W = vliegen waar je kijkt · spatie omhoog · shift omlaag · R afstappen'); } break;
      case 'dragons': this.dragons = m.l; ui.refreshDragon(); break;
      case 'dragonMenu': ui.openDragon(m.uid); break;
      case 'bossDown': this.sound.play('restore', 0.7); break;
    }
  }

  setTrees(t) {
    if (!t) return;
    const a = JSON.stringify(t), b = JSON.stringify(this.trees);
    this.trees = t;
    if (a !== b) { setTreeTiles(t); this.world.remeshAll(); this.R.setTrees(t); }
  }

  vol(x, y, z) {
    const d = Math.hypot(x - this.player.pos.x, y - this.player.pos.y, z - this.player.pos.z);
    return clamp(1 - d / 42, 0, 1);
  }

  fx(m) {
    const P = this.particles, v = this.vol(m.x, m.y, m.z), s = this.sound;
    const { x, y, z } = m;
    switch (m.k) {
      case 'hit': P.burst(x, y, z, 7, [1, 0.25, 0.2], { speed: 3, size: 0.16, life: 0.4 }); s.play('hit', v); break;
      case 'poof': P.burst(x, y, z, Math.round(16 * (m.a || 1)), [0.75, 0.75, 0.8], { speed: 2.5, size: 0.4 * Math.max(1, (m.a || 1) * 0.7), life: 0.8, grav: -1, spread: m.a || 1 }); s.play('poof', v); break;
      case 'hearts': P.burst(x, y, z, 8, [1, 0.4, 0.6], { speed: 1.2, size: 0.26, life: 1, grav: -2, up: 1 }); s.play('hearts', v); break;
      case 'levelup': P.burst(x, y, z, 34, [1, 0.85, 0.3], { speed: 3, size: 0.22, life: 1.2, grav: -3, up: 2 }); s.play('levelup', v); break;
      case 'portal': P.burst(x, y, z, 50, [0.7, 0.4, 1], { speed: 3, size: 0.26, life: 1.2, grav: 0, spread: 2 }); s.play('portal', v); break;
      case 'chest': P.burst(x, y, z, 18, [1, 0.85, 0.3], { speed: 2.4, size: 0.2, life: 0.9, grav: 3, up: 2 }); s.play('chest', v); break;
      case 'restore':
        for (let i = 0; i < 5; i++) P.burst(x, y + i * 5, z, 40, i % 2 ? [1, 0.95, 0.5] : [0.5, 1, 0.5], { speed: 9, size: 0.5, life: 2.2, grav: -1, spread: 6 });
        s.play('restore', 1); break;
      case 'eggwarm': P.burst(x, y, z, 4, [1, 0.6, 0.2], { speed: 0.6, size: 0.14, life: 0.9, grav: -2 }); break;
      case 'hatch': P.burst(x, y, z, 26, [1, 1, 0.9], { speed: 3, size: 0.2, life: 0.9 }); P.burst(x, y, z, 20, [1, 0.85, 0.3], { speed: 2, size: 0.24, life: 1.3, grav: -2 }); s.play('hatch', 1); break;
      case 'grow': P.burst(x, y, z, 36, [0.5, 1, 0.5], { speed: 3, size: 0.26, life: 1.2, grav: -2, spread: 1.5 }); s.play('levelup', v); break;
      case 'slam': P.burst(x, y + 0.3, z, 26, [0.6, 0.5, 0.4], { speed: 5, size: 0.4, life: 0.8, grav: 6, spread: 2 }); s.play('boom', v); break;
      case 'roar': s.play('roar', Math.max(0.3, v)); break;
      case 'breath': s.play('breath', Math.max(0.4, v)); break;
    }
  }

  // ---------- acties ----------

  select(i) {
    this.sel = clamp(i, 0, HOTBAR - 1);
    if (this.net) this.net.send({ t: 'sel', i: this.sel });
    this.ui.setInv();
    this.sound.play('click', 0.6);
  }

  toggleCam() { this.player.cam = this.player.cam ? 0 : 1; }

  onPortal(to) { this.sound.play('portal'); this.ui.fade(true, 'Je reist naar de ' + WORLDS[to].name + '...'); }

  nearBlock(id, r = 5) {
    const p = this.player.pos, w = this.world;
    const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
    for (let x = px - r; x <= px + r; x++) for (let z = pz - r; z <= pz + r; z++) for (let y = py - 3; y <= py + 4; y++) if (w.getBlock(x, y, z) === id) return true;
    return false;
  }

  // de dichtstbijzijnde eigen volwassen draak
  nearDragon() {
    let best = null, bd = 7;
    for (const e of this.ents.map.values()) {
      if (e.kind !== 'draak' || !e.owner || e.def.boss) continue;
      if (dragonStage(e.growth) < 2) continue;
      const d = Math.hypot(e.x - this.player.pos.x, e.y - this.player.pos.y, e.z - this.player.pos.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  rideNearest() {
    if (this.player.mount) { this.net.send({ t: 'dismount' }); return; }
    const e = this.nearDragon();
    if (!e) return;
    const d = this.dragons.find((q) => q.eid === e.id);
    if (d) this.net.send({ t: 'dragon', uid: d.uid, cmd: 'mount' });
  }

  tileColor(t) {
    let c = this.tileCol.get(t);
    if (c) return c;
    const cv = this.atlas.canvases[t];
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 128) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    const col = new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
    c = [col.r, col.g, col.b];
    this.tileCol.set(t, c);
    return c;
  }

  onKey(code) {
    const ui = this.ui;
    if (this.state !== 'play') return;
    if (code === 'Escape') { if (ui.modalOpen()) ui.close(); else ui.openPause(); return; }
    if (code === 'KeyE' || code === 'Tab') { ui.toggleInventory(); return; }
    if (code === 'KeyQ') { if (ui.modal === 'quest') ui.close(); else ui.openQuest(); return; }
    if (ui.modalOpen()) { if (code === 'Enter' && ui.modal === 'dialog') ui.close(); return; }
    if (code.startsWith('Digit')) { const n = parseInt(code.slice(5), 10); if (n >= 1 && n <= 9) this.select(n - 1); return; }
    if (code === 'WheelDown') { this.select((this.sel + 1) % HOTBAR); return; }
    if (code === 'WheelUp') { this.select((this.sel + HOTBAR - 1) % HOTBAR); return; }
    if (code === 'KeyV') this.toggleCam();
    else if (code === 'KeyF') this.player.use(null);
    else if (code === 'KeyR') this.rideNearest();
  }

  // ---------- elke frame ----------

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let real = (now - this.last) / 1000;
    this.last = now;
    if (real > 0.25) real = 0.25;
    if (!(real > 0.001)) real = 0.001;
    const dt = Math.min(real, 0.05);
    const p = this.player;
    this.syncPause();
    const paused = this.isPaused();
    this.time += dt;
    if (!paused) this.gameTime += dt;

    if (this.state === 'menu') {
      p.yaw += dt * 0.05;
      this.R.camera.position.set(0, 80, 0);
      this.R.camera.rotation.set(0.15, p.yaw, 0);
      this.R.update(this.time * 6 + 200, dt, {});
      this.R.render();
      return;
    }

    this.input.update();
    const loading = this.state === 'loading';
    this.world.update(p.pos.x, p.pos.z, loading ? 16 : (this.touch ? 5 : 7));

    if (loading) {
      this.loadT += real;
      let ok = true;
      for (let dx = -1; dx <= 1 && ok; dx++) for (let dz = -1; dz <= 1; dz++) if (!this.world.isMeshed(p.pos.x + dx * 16, p.pos.z + dz * 16)) { ok = false; break; }
      if (ok) {
        // niet vast in een blok beginnen
        let guard = 0;
        while (this.world.boxHits(p.pos.x, p.pos.y, p.pos.z, 0.3, 1.8) && guard++ < 40) p.pos.y += 1;
        p.frozen = false;
        this.state = 'play';
        this.ui.loading(null); this.ui.fade(false);
        this.ui.showHud(true);
        if (this.isNew) {
          this.isNew = false;
          this.ui.openDialog('Welkom in Graet!', [
            'Je wordt wakker in een onbekende wereld. Naast je ligt een neergestort ruimteschip en overal liggen vreemde machineonderdelen...',
            'Verzamel grondstoffen, bouw een veilige plek, zoek een drakenei en ontdek de geheimen van de vijf levensbomen.',
            'Linksboven staat steeds je volgende opdracht. Veel plezier!',
          ], 'Op avontuur!');
        }
      }
    }

    if (paused) {
      this.input.takeLook();                     // niet rondkijken of lopen terwijl een venster open staat
    } else {
      p.update(dt);
      this.ents.update(dt, this.time, p);
      this.weather(dt);
      this.particles.update(dt, window.innerHeight);
    }
    this.R.update(this.gameTime, paused ? 0 : dt, { water: p.headIn === 1, lava: p.headIn === 2, nightEyes: !!this.trees.schaduw });
    this.ui.setTint(p.headIn === 1 ? 'water' : p.headIn === 2 ? 'lava' : '');
    this.hudT = (this.hudT || 0) + real;
    if (this.state === 'play' && this.hudT > 0.07) {
      // het kompas en de sfeergeluiden hoeven niet elke frame
      const hd = this.hudT; this.hudT = 0;
      this.ui.frame(p.yaw, p.pos, this.worldId);
      this.ui.setRide(!p.mount && !!this.nearDragon());
      const surf = this.world.get(Math.floor(p.pos.x) >> 4, Math.floor(p.pos.z) >> 4);
      const under = surf ? p.pos.y < surf.hm[(Math.floor(p.pos.x) & 15) * 16 + (Math.floor(p.pos.z) & 15)] - 6 : false;
      this.sound.ambience(hd, { world: this.worldId, under, day: this.R.dayF, flying: !!p.mount && p.speedNow > 4 });
    }
    this.R.render();

    // de scherpte aanpassen als het spel te langzaam wordt (oude iPad)
    this.frameT += (real - this.frameT) * 0.05;
    this.resT += real;
    if (this.resT > 2 && this.state === 'play') {
      this.resT = 0;
      this.fpsText = Math.round(1 / this.frameT) + ' beelden per seconde, scherpte ' + Math.round(this.R.scale * 100) + '%';
      if (this.settings.dynRes) {
        if (this.frameT > 1 / 26) this.R.setScale(this.R.scale - 0.1);
        else if (this.frameT < 1 / 50 && this.R.scale < 1) this.R.setScale(this.R.scale + 0.05);
      }
    }
  }

  // sneeuw, as, sporen en vuurvliegjes rond de speler
  weather(dt) {
    if (this.state !== 'play') return;
    this.weatherT += dt;
    if (this.weatherT < 0.05) return;
    this.weatherT = 0;
    const P = this.particles, c = this.R.camera.position, w = this.worldId;
    const rx = () => c.x + (Math.random() - 0.5) * 30, rz = () => c.z + (Math.random() - 0.5) * 30;
    if (w === 'ijs') for (let i = 0; i < 3; i++) P.add(rx(), c.y + 6 + Math.random() * 6, rz(), (Math.random() - 0.5), -2.2, (Math.random() - 0.5), 1, 1, 1, 0.14, 4, 0);
    else if (w === 'vuur') { if (Math.random() < 0.7) P.add(rx(), c.y - 4 + Math.random() * 6, rz(), (Math.random() - 0.5), 1.2 + Math.random(), (Math.random() - 0.5), 1, 0.45, 0.1, 0.12, 3, 0); }
    else if (w === 'schaduw') { if (Math.random() < 0.5) P.add(rx(), c.y - 3 + Math.random() * 8, rz(), (Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4, 0.7, 0.4, 1, 0.14, 4, 0); }
    else if (w === 'wolken') { if (Math.random() < 0.3) P.add(rx(), c.y - 3 + Math.random() * 8, rz(), 0.3, 0.1, 0.1, 1, 1, 0.8, 0.12, 4, 0); }
    else if (this.R.dayF < 0.3 && Math.random() < 0.3) P.add(rx(), c.y - 2 + Math.random() * 4, rz(), (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6, 0.8, 1, 0.3, 0.14, 3, 0);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try { window.game = new Game(); }
  catch (e) {
    console.error(e);
    document.getElementById('menuError').textContent = 'Er ging iets mis bij het starten: ' + e.message;
  }
});
void B; void BLOCKS;
