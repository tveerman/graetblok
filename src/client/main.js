// Graet Blok - het begin van alles aan de kant van het spel (de "client").
import * as THREE from '../../vendor/three.module.min.js';
import { HOTBAR, INV_SIZE, clamp } from '../shared/constants.js';
import { B, BLOCKS } from '../shared/blocks.js';
import { ITEMS } from '../shared/items.js';
import { WORLDS } from '../shared/worlds.js';
import { dragonStage } from '../shared/mobs.js';
import { buildAtlas, buildAtlasHQ, setIconAtlas } from './textures.js';
import { Renderer } from './render.js';
import { ChunkWorld, setTreeTiles, setMeshHQ } from './chunks.js';
import { Particles } from './particles.js';
import { Entities } from './entities.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { connect } from './net.js';
import { setupOffline } from './offline.js';
import { RIDES } from '../shared/rides.js';
import { VEHICLES } from '../shared/vehicles.js';
import { JOBS as WORK } from '../shared/jobs.js';
import { setCityTime } from './city.js';
import { Fish } from './fish.js';
import { Weather } from './weather.js';

const $ = (id) => document.getElementById(id);
const DEFAULTS = { view: 5, volume: 0.8, amb: 1, musicTag: true, sens: 1, music: true, sfx: true, autoJump: true, dynRes: true, hq: false };

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
    this.world.lodNear = touch ? 1 : 2;                             // op een tablet eerder de fijne plantonderdelen weglaten
    // meting voor het pauzemenu: waar gaat de tijd van een beeld heen? (zie perfText)
    this.perf = { k: 0, n: 0, bouw: 0, spel: 0, teken: 0, traag: 0, lang: 0, text: '' };
    this.particles = new Particles(this.R.scene);
    this.ents = new Entities(this.R.scene, this.particles, this.R.r);
    this.R.batch = this.ents.batch;
    this.ents.blocks = this.world;
    this.sky = new Weather(this.R.scene, this.world, touch);        // regen, sneeuw en onweer
    this.sites = [];                                                // dorpen en kastelen in de buurt (voor het kompas)
    this.sound = new Sound();
    this.inv = new Array(INV_SIZE).fill(0);
    this.sel = 0;
    this.trees = {};
    this.dragons = [];
    this.zoo = { book: {}, pets: [], titel: '' };      // het Dierenboek en je dieren (van de server)
    this.worldId = 'groen';
    this.time = 0; this.gameTime = 0;
    this.state = 'menu';
    this.net = null;
    this.ui = new UI(this);
    this.input = new Input($('game'), {
      onUse: (ndc) => { this.sound.unlock(); if (!this.ui.modalOpen()) this.player.use(ndc); },
      onKey: (code) => this.onKey(code),
      canPlay: () => this.state === 'play' && !this.ui.modalOpen(),
      inGame: () => this.state === 'play',
    });
    this.player = new Player(this);
    this.ui.setTouch(touch);
    this.applySettings(true);
    this.frameT = 0.016; this.resT = 0; this.last = performance.now(); this.weatherT = 0; this.loadT = 0;
    this.fpsText = '';

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { this.sound.unlock(); return; }      // terug bij het spel: geluid weer wakker maken
      this.sound.sleep();
      if (!this.net) return;
      // de tablet wordt weggelegd of er wordt naar een andere app gegaan: pauzeren en opslaan
      if (this.state === 'play' && !this.ui.modalOpen() && !this.noAutoPause) this.ui.openPause();
      this.syncPause();
      this.net.send({ t: 'save' });
    });
    window.addEventListener('pagehide', () => { if (this.net) this.net.send({ t: 'save' }); });
    // geluid mag pas na een tik of toets; in de "capture"-fase zodat geen enkele knop dit tegenhoudt
    for (const ev of ['touchend', 'click', 'mousedown', 'pointerup', 'keydown']) document.addEventListener(ev, () => this.sound.unlock(), { passive: true, capture: true });

    // knop voor volledig scherm: het pictogram wisselt, en het beeld past zich aan
    const onFull = () => {
      const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
      const icon = $('fullIcon');
      if (icon) icon.setAttribute('d', on ? 'M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5' : 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5');
      setTimeout(() => this.R.resize(), 60);
    };
    document.addEventListener('fullscreenchange', onFull);
    document.addEventListener('webkitfullscreenchange', onFull);
    if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) $('btnFull').style.display = 'none';

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

  // Eén regel over het geluid, voor in het pauzemenu. Handig als het ergens stil blijft.
  audioText() {
    const d = this.sound.diag();
    if (!d) return 'Geluid: nog niet gestart (tik ergens op het scherm)';
    const run = (d.state === 'running' ? 'aan' : 'staat stil (' + d.state + ')') + ' op ' + Math.round(d.rate / 100) / 10 + ' kHz, vertraging ' + d.lat + ' ms';
    const mus = !this.settings.music ? 'uit' : d.notes + ' noten, ' + (d.via >= 0 ? 'via de speler (' + d.via + ' tellen)' : 'sterkte ' + Math.round(d.level * 100) + '%, ' + (d.loop ? 'als lusje' : 'noot voor noot'));
    return 'Geluid: ' + run + ' · muziek: ' + mus + ' · effecten: ' + (this.settings.sfx ? 'aan' : 'uit') + (d.ios ? ' · stille stand omzeild: ' + (d.channel ? 'ja' : 'nee') : '');
  }

  // Tip voor als het stil blijft (alleen op iPad en iPhone, daar ligt het bijna altijd aan de stille stand).
  audioTip() {
    const d = this.sound.diag();
    if (!d || !d.ios) return '';
    return 'Hoor je niets? Zet het geluid van de iPad harder met de knoppen op de zijkant en kijk in het Bedieningspaneel of het belletje (stille stand) uit staat.';
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
    this.world.clear(); this.ents.clear(); this.particles.clear(); this.sky.clear(); this.sky.set('zon', true);
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
    this.sound.bigBuf = false;                               // (een grote buffer vragen deed niets op de iPad en maakte geluidjes elders trager)
    this.sound.musicViaTag = S.musicTag !== false;
    this.sound.forceTag = /[?&]speler/.test(location.search);      // om de muziek via de speler op een gewone computer te testen
    this.sound.setAmb(S.amb === undefined ? 1 : S.amb);
    this.sound.setSfx(S.sfx);
    this.input.sens = S.sens;
    this.player.autoJump = S.autoJump;
    if (!S.dynRes) this.R.setScale(1);
    this.setHQ(!!S.hq);
    if (!first) {
      try { localStorage.setItem('graetblok.settings', JSON.stringify(S)); } catch (e) { /* */ }
      if (this.net && this.sentView !== S.view) { this.sentView = S.view; this.net.send({ t: 'view', r: S.view }); }
    }
  }

  // De mooie weergave ("Mooie graphics" in het pauzemenu): plaatjes met twee keer zoveel detail,
  // reliëf, glans en gloed, en licht dat per pixel wordt uitgerekend. De plaatjes worden pas
  // gemaakt als je het aanzet; dat duurt een paar tellen en gebeurt op de achtergrond.
  async setHQ(on) {
    if (on === !!this.hqOn || this.hqBusy) return;
    if (!on) {
      this.hqOn = false;
      setMeshHQ(false);
      this.world.setLook(this.R.setHQ(false), this.atlas.uv);
      return;
    }
    this.hqBusy = true;
    try {
      if (!this.atlasHQ) {
        if (this.state === 'play') this.ui.toast('Mooie plaatjes maken... een paar tellen geduld.', 'good');
        this.atlasHQ = await buildAtlasHQ();
      }
      if (this.settings.hq) {
        this.hqOn = true;
        setMeshHQ(true);
        this.world.setLook(this.R.setHQ(true, this.atlasHQ), this.atlasHQ.uv);
        if (this.state === 'play') this.ui.toast('Mooie graphics staan aan.', 'good');
      }
    } catch (e) {
      console.warn('mooie graphics lukken niet', e);
      this.settings.hq = false;
      this.ui.toast('Mooie graphics lukken niet op dit apparaat.', 'warn');
    }
    this.hqBusy = false;
    if (!!this.settings.hq !== !!this.hqOn) this.setHQ(!!this.settings.hq);      // intussen weer omgezet
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
        this.sky.clear(); this.sites = [];
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
      case 'tp': p.teleport(m.x, m.y, m.z); if (m.fade) { ui.fade(true, m.fade); setTimeout(() => ui.fade(false), 1800); } break;
      case 'chunk': if (m.w === this.worldId) this.world.addChunk(m.cx, m.cz, m.b); break;
      case 'unload': this.world.removeChunk(m.cx, m.cz); break;
      case 'block': this.world.setBlock(m.x, m.y, m.z, m.id); break;
      case 'inv': this.inv = m.s; this.boots = m.s.some((q) => q && ITEMS[q[0]] && ITEMS[q[0]].jump); ui.setInv(); break;
      case 'stats': this.setTrees(m.trees); ui.setStats(m); break;
      case 'trees': this.setTrees(m.trees); break;
      case 'quest': ui.setQuest(m); break;
      case 'questDone': ui.toast('⭐ Opdracht gelukt: ' + m.title, 'good'); this.sound.play('quest'); break;
      case 'toast': ui.toast(m.text, m.kind); if (m.kind === 'warn') this.sound.play('deny'); if (m.kind === 'rank') this.sound.play('quest'); break;
      case 'dialog': ui.openDialog(m.title, m.lines); break;
      case 'got': ui.got(m.id, m.n); this.sound.play('got'); break;
      case 'crafted': this.sound.play('craft'); break;
      case 'ate': this.sound.play('eat'); break;
      case 'toolBroke': this.sound.play('break', 1, 'wood'); this.sound.play('hit'); ui.toast('Je ' + m.name.toLowerCase() + ' is kapot!', 'warn'); break;
      case 'shot': this.sound.play(m.k === 'pijl' ? 'pijl' : m.k === 'laser' ? 'laser' : m.k === 'oer' ? 'oer' : 'magie'); break;
      case 'hurt': ui.flashHurt(); this.sound.play('hurt'); p.knock(m.kx, m.kz); break;
      case 'dead': p.dead = true; this.sound.play('death'); ui.close(); ui.openDeath(); break;
      case 'time': this.gameTime = m.time; if (m.sleep) { this.sound.play('sleep'); ui.fade(true, 'Zzz...'); setTimeout(() => ui.fade(false), 1400); } break;
      case 'ents': this.ents.snapshot(m.l); ui.setBoss(m.boss); break;
      case 'spawn': this.ents.spawn(m); break;
      case 'despawn': this.ents.despawn(m.id); break;
      case 'entMeta': this.ents.meta(m); break;
      case 'proj': this.ents.addProj(m); if (m.s === 'm') this.sound.play('vuurbal', this.vol(m.x, m.y, m.z) * 0.6); break;
      case 'projEnd': {
        const pr = this.ents.endProj(m);
        if (!pr) break;
        const v = this.vol(m.x, m.y, m.z), B = pr.def.blast || 0;
        this.sound.play(pr.arrow ? 'hit' : (pr.def.snd || 'boom'), v * (B > 2.5 ? 0.9 : 0.7));
        if (B > 2.5) { const d = Math.hypot(m.x - p.pos.x, m.y - p.pos.y, m.z - p.pos.z); if (d < 20) p.shake = Math.max(p.shake || 0, 0.4 * (1 - d / 20)); }
        break;
      }
      case 'fx': this.fx(m); break;
      case 'mount':
        p.setMount(m.id, m.s, m.k, m.seat, m.sp, m); ui.setMounted(!!p.mount);
        if (m.id && m.k === 'rit') { if (p.mount) { this.sound.play('toet', 0.5); ui.toast('Houd je vast! Het ritje stopt vanzelf.'); } } else
        if (m.id && (m.k === 'auto' || m.k === 'heli')) {
          ui.toast(m.k === 'heli' ? (this.touch ? 'Je vliegt! Stick naar voren, ⬆ omhoog, ⬇ omlaag.' : 'Je vliegt! W = vooruit · spatie omhoog · shift omlaag · R uitstappen')
            : (this.touch ? 'Stick naar voren: gas. Naar achteren: remmen. Opzij: sturen.' : 'W = gas · S = remmen en achteruit · A/D = sturen · shift = plankgas · R uitstappen'));
        } else
        if (m.id && (m.k === 'dier' || m.k === 'vlieg')) {
          this.sound.play('chirp', 0.7);
          ui.toast(m.k === 'vlieg' ? (this.touch ? 'Je vliegt! Stick naar voren, ⬆ omhoog, ⬇ omlaag.' : 'Je vliegt! W = vooruit · spatie omhoog · shift omlaag · R afstappen')
            : (this.touch ? 'Je rijdt! Stuur met de stick, ⬆ om te springen. Stick helemaal naar voren = galop.' : 'Je rijdt! WASD sturen · spatie springen · shift galop · R afstappen'));
        } else
        if (m.id && m.k === 'trein') { this.sound.play('toet', 0.8); ui.toast(this.touch ? 'Stick naar voren: rijden. Naar achteren: remmen en achteruit. Opzij: kiezen bij een wissel.' : 'W = rijden · S = remmen en achteruit · A/D = kiezen bij een wissel · shift = sneller · R uitstappen'); }
        else if (m.id) { this.sound.play('roar', 0.6); ui.toast(this.touch ? 'Duw de stick naar voren om te vliegen. ⬆ omhoog, ⬇ omlaag.' : 'W = vliegen waar je kijkt · spatie omhoog · shift omlaag · R afstappen'); }
        break;
      case 'trade': ui.openTrade(m); break;
      case 'traded': ui.got(m.id, m.n); this.sound.play('coin'); break;
      case 'weather': this.sky.set(m.k, m.now); break;
      case 'sites': this.sites = m.l; break;
      case 'debugSite': this.debugSite = m.s; break;
      case 'dragons': this.dragons = m.l; ui.refreshDragon(); break;
      case 'zoo': this.zoo = m; ui.refreshZoo(); break;
      case 'veh': p.vehFuel = m.fuel; p.vehDmg = m.dmg; if (m.up) p.vehUp = m.up; break;      // brandstof, schade en upgrades van je voertuig
      case 'garage': ui.openGarage(m); break;
      case 'farm': ui.openFarm(m); break;
      case 'werk': ui.openWork(m); break;
      case 'fabriek': ui.openFactory(m); break;
      case 'puzzel': ui.openPuzzle(m); break;
      case 'code': { const c = window.prompt('De gouden tempeldeur\n' + m.hint, ''); if (c !== null) this.net.send({ t: 'code', code: c }); break; }
      case 'job': this.setJob(m.job); break;
      case 'raceMenu': ui.openRaceMenu(m); break;
      case 'kermis': ui.openKermis(m); break;
      case 'kermisGo': ui.playKermis(m.game); break;
      case 'kermisPrijs': ui.kermisPrijs(m); break;
      case 'raceGrid':
        // naar de startplek: stilstaan tot het licht op groen gaat
        ui.close();
        p.pos.set(m.x, m.y, m.z); p.vel.set(0, 0, 0); p.carV = 0; p.carYaw = m.yaw; p.slipYaw = m.yaw; p.yaw = m.yaw; p.pitch = -0.12;
        p.raceHold = 1; p.falseStart = false; p.track = null; p.lapT = -1; p.wasStart = false;
        break;
      case 'raceCount':
        if (m.n > 0) { ui.toast('🚦 ' + m.n + '...', 'rank'); this.sound.play('click', 1); }
        else {
          if (p.falseStart) { p.raceHold = 2; setTimeout(() => { p.raceHold = 0; }, 1500); ui.toast('Valse start! Je moet even wachten.', 'warn'); }
          else p.raceHold = 0;
          ui.toast('🟢 GO!', 'rank'); this.sound.play('quest', 0.8);
        }
        break;
      case 'raceEnd': p.raceHold = 0; break;
      case 'track': if (p.track && p.track.key === m.key) p.track.best = m.best; break;      // je record op deze baan
      case 'dragonMenu': ui.openDragon(m.uid); break;
      case 'bossDown': this.sound.play('restore', 0.7); break;
    }
  }

  setTrees(t) {
    if (!t) return;
    const a = JSON.stringify(t), b = JSON.stringify(this.trees);
    this.trees = t;
    if (a !== b) { setTreeTiles(t); this.world.rescanAll(); this.R.setTrees(t); }
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
      case 'vuurwerk': {
        // een vuurpijl boven de kermis: een bol van gekleurde vonken
        const col = [[1, 0.3, 0.3], [1, 0.8, 0.2], [0.4, 1, 0.5], [0.4, 0.7, 1], [0.9, 0.5, 1], [1, 1, 1]][m.a % 6];
        P.burst(x, y, z, 46, col, { speed: 9, size: 0.7, life: 1.6, grav: 3, spread: 1 });
        P.burst(x, y, z, 14, [1, 1, 0.8], { speed: 4, size: 0.5, life: 1.0, grav: 2 });
        s.play('boom', Math.min(0.5, v + 0.15) * s.ambVol);
        break;
      }
      case 'toet': P.burst(x, y + 0.6, z, 10, [0.92, 0.92, 0.94], { speed: 1.4, size: 0.5, life: 1.4, grav: -1.5, up: 1 }); s.play('toet', v * 0.7); break;      // de lijntrein vertrekt
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
      case 'breath': s.play('breath', Math.max(0.4, v)); P.burst(x, y, z, 10, [1, 0.8, 0.4], { speed: 3, size: 0.3, life: 0.3, grav: 0 }); break;
      case 'wool': P.burst(x, y, z, 12, [1, 1, 1], { speed: 1.6, size: 0.3, life: 0.7, grav: 2, up: 1 }); s.play('baa', Math.max(0.4, v)); break;
      case 'zap': {
        // een bliksemschicht van de ene vijand naar de andere
        const n = 14;
        for (let i = 0; i <= n; i++) {
          const f = i / n, j = Math.sin(f * Math.PI) * 0.5;
          P.add(x + (m.x2 - x) * f + (Math.random() - 0.5) * j, y + (m.y2 - y) * f + (Math.random() - 0.5) * j, z + (m.z2 - z) * f + (Math.random() - 0.5) * j, 0, 0, 0, 1, 1, 0.7, 0.28, 0.28, 0);
        }
        s.play('zap', v * 0.8);
        break;
      }
      case 'bolt': {
        this.sky.bolt(x, y, z);
        P.burst(x, y + 0.3, z, 30, [1, 1, 0.8], { speed: 8, size: 0.3, life: 0.5, grav: 6, up: 2 });
        const d = Math.hypot(x - this.player.pos.x, z - this.player.pos.z);
        // de donder komt later dan de flits, net als in het echt
        setTimeout(() => { this.sound.play('donder', Math.max(0.35, 1 - d / 90) * this.sound.ambVol); if (d < 26) this.player.shake = Math.max(this.player.shake || 0, 0.35 * (1 - d / 26)); }, Math.min(1800, d * 22));
        break;
      }
      case 'fuse': P.burst(x, y, z, 10, [1, 0.8, 0.3], { speed: 1.6, size: 0.14, life: 0.5, grav: -1 }); s.play('fuse', Math.max(0.3, v)); break;
      case 'explode': {
        P.burst(x, y, z, 60, [1, 0.6, 0.15], { speed: 9, size: 0.6, life: 0.7, grav: 1, spread: 1.5 });
        P.burst(x, y, z, 50, [0.35, 0.33, 0.32], { speed: 5, size: 0.9, life: 1.6, grav: -1.5, spread: 2.5 });
        P.burst(x, y, z, 30, [1, 0.95, 0.7], { speed: 14, size: 0.25, life: 0.5, grav: 6 });
        s.play('explode', Math.max(0.25, this.vol(x, y, z) * 1.3));
        const d = Math.hypot(x - this.player.pos.x, y - this.player.pos.y, z - this.player.pos.z);
        if (d < 24) this.player.shake = Math.max(this.player.shake || 0, 0.6 * (1 - d / 24));
        break;
      }
    }
  }

  // ---------- acties ----------

  select(i) {
    this.sel = clamp(i, 0, HOTBAR - 1);
    if (this.net) this.net.send({ t: 'sel', i: this.sel });
    this.ui.setInv();
    this.sound.play('click', 0.6);
  }

  // Waar sta je? Om de paar tellen kijken we rond: hoeveel bladeren er om je heen hangen
  // (bos), of je op een grote droge zandvlakte staat (woestijn) en of je in een stad bent.
  // Daar hangen de geluiden van af: vogels, een ratelslang, een toeterende auto.
  surroundings(dt) {
    this.omgT = (this.omgT || 0) - dt;
    if (this.omg && this.omgT > 0) return this.omg;
    this.omgT = 2;
    const p = this.player.pos, w = this.world, py = Math.floor(p.y);
    let blad = 0, zand = 0, nat = 0;
    for (let i = 0; i < 24; i++) {
      const a = i * 2.4, r = 3 + (i % 4) * 3, x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
      for (const dy of [2, 5, 8, 11]) { const id = w.getBlock(x, py + dy, z); if (id > 0 && BLOCKS[id] && BLOCKS[id].key.includes('blad')) { blad++; break; } }
    }
    for (let i = 0; i < 9; i++) {
      const a = i * 0.785, r = i === 8 ? 0 : 7, x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
      for (let y = py + 3; y >= py - 5; y--) { const id = w.getBlock(x, y, z); if (id <= 0) continue; if (id === B.zand) zand++; else if (id === B.water) nat++; break; }
    }
    const stad = !!this.sites && this.sites.some((s) => s[0] === 6 && Math.abs(s[1] - p.x) < 90 && Math.abs(s[2] - p.z) < 90);
    this.omg = { bos: Math.min(1, blad / 9), zand: zand >= 8 && nat === 0, stad };
    return this.omg;
  }

  // je beroep bepaalt je werkkleding: de kleur van je kleren en een pet
  setJob(job) {
    this.job = job || '';
    const J = WORK[this.job];
    if (this.player) this.player.setLook(J ? Object.assign({}, this.look, { shirt: J.kleur, cap: J.pet }) : this.look);
  }

  // drie standen: door je eigen ogen (met je armen in beeld), van achteren, en van voren
  toggleCam() {
    const p = this.player;
    p.cam = (p.cam + 1) % 3;
    this.ui.toast(['📷 Door je eigen ogen', '📷 Van achteren', '📷 Van voren: zo zie je er nu uit'][p.cam]);
  }

  // Volledig scherm aan of uit (op de iPad werkt dat met de oudere "webkit"-namen).
  toggleFullscreen() {
    const d = document, root = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      const exit = d.exitFullscreen || d.webkitExitFullscreen;
      if (exit) exit.call(d);
      return;
    }
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!req) { this.ui.toast('Volledig scherm kan hier niet. Tip: zet het spel op je beginscherm.', 'warn'); return; }
    try {
      const pr = req.call(root);
      if (pr && pr.catch) pr.catch(() => this.ui.toast('Volledig scherm lukt hier niet.', 'warn'));
    } catch (e) { this.ui.toast('Volledig scherm lukt hier niet.', 'warn'); }
  }

  onPortal(to) { this.sound.play('portal'); this.ui.fade(true, 'Je reist naar de ' + WORLDS[to].name + '...'); }

  nearBlock(id, r = 5) {
    const p = this.player.pos, w = this.world;
    const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
    for (let x = px - r; x <= px + r; x++) for (let z = pz - r; z <= pz + r; z++) for (let y = py - 3; y <= py + 4; y++) if (w.getBlock(x, y, z) === id) return true;
    return false;
  }

  // de dichtstbijzijnde eigen draak (elke leeftijd) binnen bereik
  nearDragon(maxD = 9) {
    let best = null, bd = maxD;
    for (const e of this.ents.map.values()) {
      if (e.kind !== 'draak' || !e.owner || e.def.boss) continue;
      const d = Math.hypot(e.x - this.player.pos.x, e.y - this.player.pos.y, e.z - this.player.pos.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // De knop "🐉": bij een volwassen draak stap je op, bij een jongere open je zijn venster
  // (voeren, naam geven...). Zo hoef je de draak zelf niet aan te tikken.
  dragonButton() {
    if (this.player.mount) { this.net.send({ t: 'dismount' }); return; }
    const e = this.nearDragon();
    if (!e) return;
    const d = this.dragons.find((q) => q.eid === e.id);
    if (!d) return;
    if (dragonStage(d.growth) >= 2) this.net.send({ t: 'dragon', uid: d.uid, cmd: 'mount' });
    else this.ui.openDragon(d.uid);
  }

  // het venster van je dichtstbijzijnde draak openen (toets G)
  dragonMenu() {
    const e = this.nearDragon(14);
    const d = e && this.dragons.find((q) => q.eid === e.id);
    if (d) this.ui.openDragon(d.uid);
  }

  // een trein waar je vlak naast staat
  nearTrain() {
    for (const e of this.ents.map.values()) {
      if (e.kind === 'trein' && Math.hypot(e.x - this.player.pos.x, e.y - this.player.pos.y, e.z - this.player.pos.z) < 4.5) return e;
    }
    return null;
  }

  // een attractie van de kermis waar je bij de ingang staat
  nearAttraction() {
    for (const e of this.ents.map.values()) {
      if (!e.def.ride) continue;
      if (Math.hypot(e.x - this.player.pos.x, e.z - this.player.pos.z) < e.def.w / 2 + 3 && Math.abs(e.y - this.player.pos.y) < 5) return e;
    }
    return null;
  }

  // een voertuig waar je vlak naast staat
  nearVehicle() {
    let best = null, bd = 4.2;
    for (const e of this.ents.map.values()) {
      if (!e.def.veh || e.rc) continue;                  // (rc = de auto van een andere coureur)
      const d = Math.hypot(e.x - this.player.pos.x, e.y - this.player.pos.y, e.z - this.player.pos.z) - e.w / 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // je eigen rijdier vlak bij je (paard, olifant, grote wolf, T-rex...)
  nearRide() {
    let best = null, bd = 5;
    for (const e of this.ents.map.values()) {
      if (!e.owner || !e.def.ride) continue;
      const d = Math.hypot(e.x - this.player.pos.x, e.y - this.player.pos.y, e.z - this.player.pos.z) - e.w / 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  rideNearest() {
    const v = this.player.mount ? null : this.nearVehicle();
    if (v) { this.net.send({ t: 'useEnt', id: v.id }); return; }
    const at = this.player.mount ? null : this.nearAttraction();
    if (at) { this.net.send({ t: 'useEnt', id: at.id }); return; }
    const r = this.player.mount || this.nearDragon(5) ? null : this.nearRide();
    if (r && !this.nearTrain()) { this.net.send({ t: 'rideEnt', id: r.id }); return; }
    const t = this.player.mount ? null : this.nearTrain();
    if (t && !this.nearDragon(5)) { this.net.send({ t: 'useEnt', id: t.id }); return; }
    this.dragonButton();
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
    if (code === 'KeyJ') { if (ui.modal === 'werk') ui.close(); else if (!ui.modalOpen()) this.net.send({ t: 'werk' }); return; }
    if (code === 'KeyB') { if (ui.modal === 'zoo') ui.close(); else if (!ui.modalOpen()) ui.openZoo(); return; }
    if (ui.modalOpen()) { if (code === 'Enter' && ui.modal === 'dialog') ui.close(); return; }
    if (code.startsWith('Digit')) { const n = parseInt(code.slice(5), 10); if (n >= 1 && n <= 9) this.select(n - 1); return; }
    if (code === 'WheelDown') { this.select((this.sel + 1) % HOTBAR); return; }
    if (code === 'WheelUp') { this.select((this.sel + HOTBAR - 1) % HOTBAR); return; }
    if (code === 'KeyV' || code === 'F5') this.toggleCam();
    else if (code === 'KeyF') this.player.use(null);
    else if (code === 'KeyR') this.rideNearest();
    else if (code === 'KeyG') this.dragonMenu();
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
    const pf = this.perf, t1 = performance.now();
    this.world.update(p.pos.x, p.pos.z, loading ? 16 : (this.touch ? 5 : 7));
    const t2 = performance.now();

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
      setCityTime(this.gameTime);
      if (!this.fish) this.fish = new Fish(this.R.scene, this.world);
      this.fish.update(dt, p.pos);
      this.ents.update(dt, this.time, p);
      this.sky.update(dt, this.R.camera, this.particles);
      this.weather(dt);
      this.motes(dt);
      this.particles.update(dt, window.innerHeight);
    }
    this.R.update(this.gameTime, paused ? 0 : dt, { water: p.headIn === 1, lava: p.headIn === 2, nightEyes: !!this.trees.schaduw, wet: this.sky.wet, flash: this.sky.flash });
    this.ui.setTint(p.headIn === 1 ? 'water' : p.headIn === 2 ? 'lava' : '');
    this.hudT = (this.hudT || 0) + real;
    if (this.state === 'play' && this.hudT > 0.07) {
      // het kompas en de sfeergeluiden hoeven niet elke frame
      const hd = this.hudT; this.hudT = 0;
      this.ui.frame(p.yaw, p.pos, this.worldId, this.sites);
      const own = p.mount ? null : this.nearDragon();
      const train = p.mount || own ? null : this.nearTrain();
      const steed = p.mount || own || train ? null : this.nearRide();
      const car = p.mount ? null : this.nearVehicle();
      const fair = p.mount || car ? null : this.nearAttraction();
      this.ui.setRide(fair ? (RIDES[fair.def.ride] ? RIDES[fair.def.ride].knop : '✈️ Meevliegen (5 munten)') : car ? (car.def.veh === 'helikopter' ? '🚁 Instappen' : car.def.veh === 'vliegtuig' ? '✈️ Instappen' : VEHICLES[car.def.veh] && VEHICLES[car.def.veh].werk ? '🚜 Instappen' : car.def.veh === 'boot' ? '🚤 Instappen' : '🚗 Instappen') : train ? '🚂 Instappen' : steed ? (steed.def.rideFly ? '🪽 Vliegen' : '🐎 Rijden') : !own ? '' : (dragonStage(own.growth) >= 2 ? '🐉 Vliegen' : '🐉 ' + (own.name || 'Draak')));
      this.animalSounds(hd);
      const surf = this.world.get(Math.floor(p.pos.x) >> 4, Math.floor(p.pos.z) >> 4);
      const under = surf ? p.pos.y < surf.hm[(Math.floor(p.pos.x) & 15) * 16 + (Math.floor(p.pos.z) & 15)] - 6 : false;
      const om = this.surroundings(hd);
      this.sound.ambience(hd, { world: this.worldId, under, bos: om.bos, zand: om.zand, stad: om.stad, day: this.R.dayF, flying: !!p.mount && p.mountKind !== 'trein' && p.mountKind !== 'dier' && p.mountKind !== 'auto' && (p.speedNow > 4 || (p.mountKind === 'rit' && p.rideV > 0.12)), rain: Math.max(this.sky.rain, this.sky.snow * 0.25), roof: this.sky.roof });
    }
    const t3 = performance.now();
    this.R.render();
    const t4 = performance.now();
    pf.n++; pf.bouw += t2 - t1; pf.spel += t3 - t2; pf.teken += t4 - t3;
    if (real > 0.1) pf.traag++;
    if (real > pf.lang) pf.lang = real;

    // de scherpte aanpassen als het spel te langzaam wordt (oude iPad)
    this.frameT += (real - this.frameT) * 0.05;
    this.resT += real;
    if (this.resT > 2 && this.state === 'play') {
      this.resT = 0;
      this.fpsText = Math.round(1 / this.frameT) + ' beelden per seconde, scherpte ' + Math.round(this.R.scale * 100) + '%';
      // De meting van de laatste twee seconden. "bouwen" = stukken wereld opbouwen, "spel" =
      // lopen, dieren, weer en schermpje, "tekenen" = wat de browser aan het tekenen kwijt is
      // (de videokaart zelf werkt daarna nog door: dat zit in de rest van de tijd per beeld).
      const info = this.R.r.info.render, k = 1 / Math.max(1, pf.n);
      pf.text = 'Meting: ' + (this.frameT * 1000).toFixed(0) + ' ms per beeld (bouwen ' + (pf.bouw * k).toFixed(1) + ', spel ' + (pf.spel * k).toFixed(1) + ', tekenen ' + (pf.teken * k).toFixed(1) + ') · ' +
        info.calls + ' tekenopdrachten, ' + Math.round(info.triangles / 1000) + ' duizend driehoeken · ' + this.ents.map.size + ' wezens · laatste 20 tellen: langste beeld ' + Math.round(pf.lang * 1000) + ' ms, ' + pf.traag + ' haperingen';
      pf.n = 0; pf.bouw = 0; pf.spel = 0; pf.teken = 0;
      if (++pf.k >= 10) { pf.k = 0; pf.traag = 0; pf.lang = 0; }      // haperingen tellen we over een langere tijd
      if (this.settings.dynRes) {
        if (this.frameT > 1 / 26) this.R.setScale(this.R.scale - 0.1);
        else if (this.frameT < 1 / 50 && this.R.scale < 1) this.R.setScale(this.R.scale + 0.05);
      }
    }
  }

  // af en toe hoor je een dier in de buurt: een schaap blaat, een koe loeit, een wolf huilt
  animalSounds(dt) {
    this.zooT = (this.zooT || 3) - dt;
    if (this.zooT > 0) return;
    this.zooT = 4 + Math.random() * 7;
    const list = [];
    for (const e of this.ents.map.values()) if (!e.owner && (e.kind === 'schaap' || e.kind === 'koe' || e.kind === 'wolf' || e.kind === 'beer')) list.push(e);
    if (!list.length) return;
    const e = list[Math.floor(Math.random() * list.length)], v = this.vol(e.x, e.y, e.z);
    if (v < 0.1) return;
    if (e.kind === 'wolf' && this.R.dayF > 0.4) return;                // wolven huilen 's nachts
    this.sound.play(e.kind === 'schaap' ? 'baa' : e.kind === 'koe' ? 'boe' : e.kind === 'wolf' ? 'huil' : 'growl', v * 0.8 * this.sound.ambVol);
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

  // Zwevende lichtjes onder de levensboom: een paar als de boom ziek is, een hele zwerm als hij leeft.
  motes(dt) {
    if (this.state !== 'play') return;
    const T = WORLDS[this.worldId].tree, c = this.R.camera.position;
    const d = Math.hypot(c.x - T.x, c.z - T.z);
    if (d > 70) return;
    this.moteT = (this.moteT || 0) + dt * (this.trees[T.key] ? 26 : 7);
    const col = MOTE_COLORS[this.worldId];
    while (this.moteT >= 1) {
      this.moteT -= 1;
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 30;
      const k = col[(Math.random() * col.length) | 0];
      this.particles.add(T.x + Math.cos(a) * r, T.y + 1 + Math.random() * 24, T.z + Math.sin(a) * r,
        (Math.random() - 0.5) * 0.5, 0.15 + Math.random() * 0.5, (Math.random() - 0.5) * 0.5, k[0], k[1], k[2], 0.16 + Math.random() * 0.14, 5 + Math.random() * 4, -0.02);
    }
  }
}

const MOTE_COLORS = {
  groen: [[0.5, 1, 0.75], [0.4, 0.9, 1], [1, 0.6, 0.9], [0.9, 1, 0.6]],
  ijs: [[0.7, 0.9, 1], [1, 1, 1], [0.7, 0.6, 1]],
  vuur: [[1, 0.6, 0.2], [1, 0.9, 0.5], [1, 0.4, 0.6]],
  schaduw: [[0.8, 0.5, 1], [1, 0.5, 0.9], [0.5, 0.7, 1]],
  wolken: [[1, 0.95, 0.6], [1, 1, 1], [1, 0.7, 0.85]],
  dino: [[0.7, 1, 0.4], [1, 1, 0.6], [0.5, 0.9, 0.5]],
};

// Het spel starten zodra de pagina er staat. (Dit bestand wordt vanuit index.html geladen met
// import(...); dan kan de pagina al klaar zijn voordat we hier aankomen.)
function boot() {
  try { window.game = new Game(); window.graetGestart = true; }      // graetGestart: het vangnet in index.html weet dan dat het gelukt is
  catch (e) {
    console.error(e);
    document.getElementById('menuError').textContent = 'Er ging iets mis bij het starten: ' + e.message;
  }
}
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
else boot();
void B; void BLOCKS;
