// Alles op het scherm dat geen 3D is: hartjes, rugzak, maken, opdrachten, menu's.
import { RANKS, HOTBAR, INV_SIZE } from '../shared/constants.js';
import { B, BLOCKS } from '../shared/blocks.js';
import { ITEMS, I, RECIPES, GROUPS, GROUP_NAMES, matches, itemName } from '../shared/items.js';
import { WORLDS, WORLD_ORDER, CRASH } from '../shared/worlds.js';
import { DRAGONS, dragonStage, STAGE_NAMES } from '../shared/mobs.js';
import { iconURL, eggURL } from './textures.js';
import { KERMIS_GAMES } from '../shared/rides.js';
import { JOBS as WORK, JOB_RANKS, jobLevel, jobMedal, jobSalary } from '../shared/jobs.js';
import { VEHICLES, VEH_COLORS, UPGRADES, UPGRADE_ORDER, vehStats } from '../shared/vehicles.js';
import { ANIMALS, ANIMAL_LIST, EGG_KINDS, EGG_ORDER, RARITY, RARITIES, SHINIES, SHINY, ZOO_REWARDS, MAX_OUT } from '../shared/animals.js';

const EGG_PATS = ['vlek', 'blad', 'golf', 'ster', 'barst', 'streep'];
const hexCol = (n) => '#' + (n | 0).toString(16).padStart(6, '0');
// het ei van één dier: de kleuren van het dier zelf, met een patroon dat bij zijn nummer hoort
// wat je in het kaartvenster van het kompas kunt halen: [sleutel, tekst op de knop]
const KOMPAS_KEUZES = [['pin', '📍 Markering'], ['opdracht', '◆ Opdracht'], ['schip', '🚀 Ruimteschip'], ['k0', '🏠 Dorp'], ['k1', '🏰 Kasteel'], ['k6', '🏙️ Stad'], ['k7', '✈️ Vliegveld'],
  ['k5', '🎡 Kermis'], ['k4', '🏁 Racebaan'], ['k8', '🗼 Wachttoren'], ['k9', '🌿 Doolhof'], ['k10', '🏛️ Tempel']];
// de kleuren van de kaart, per kleurnummer van de server (zie server/map.js)
const MAP_COLORS = [[150, 200, 240], [70, 140, 220], [36, 84, 170], [240, 110, 30], [226, 208, 150], [104, 168, 78], [52, 118, 56], [240, 244, 250], [134, 134, 138],
  [180, 220, 240], [110, 84, 60], [62, 60, 66], [230, 90, 40], [60, 170, 160], [170, 100, 220], [96, 70, 130], [70, 56, 90], [120, 112, 108], [190, 226, 150]];
function animalEgg(a, dark) { return eggURL(hexCol(a.spec.c), hexCol(a.spec.c2 === undefined ? a.spec.c : a.spec.c2), EGG_PATS[a.nr % EGG_PATS.length], dark); }

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

// werkt voor muis en vinger, zonder dubbele klik; schuiven (scrollen) telt niet als tik
function tap(node, fn) {
  let touched = false, sx = 0, sy = 0;
  node.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
  node.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    e.stopPropagation();
    if (Math.hypot(t.clientX - sx, t.clientY - sy) > 12) return;
    e.preventDefault(); touched = true; fn(e);
  }, { passive: false });
  node.addEventListener('click', (e) => { if (touched) { touched = false; return; } fn(e); });
}

export class UI {
  constructor(game) {
    this.g = game;
    this.modal = null;         // naam van het open venster
    this.pick = -1;            // gekozen vakje in de rugzak
    this.station = '';
    this.onlyCan = false;
    this.dragonUid = 0;
    this.quest = null;
    this.stats = { hp: 20, max: 20, xp: 0, need: 30, level: 1, rank: 'Beginner', armor: 0 };
    this.gotMap = new Map();
    this.build();
  }

  build() {
    const g = this.g;
    // hotbar
    this.hot = [];
    const hb = $('hotbar');
    for (let i = 0; i < HOTBAR; i++) {
      const s = el('div', 'slot');
      s.appendChild(el('img')); s.appendChild(el('span', 'dur')); s.appendChild(el('span', 'cnt'));
      tap(s, () => { g.select(i); });
      hb.appendChild(s); this.hot.push(s);
    }
    tap($('btnInv'), () => this.toggleInventory());
    tap($('btnQuest'), () => this.modal === 'quest' ? this.close() : this.openQuest());
    tap($('btnZoo'), () => this.modal === 'zoo' ? this.close() : this.openZoo());
    if (!$('btnJob')) { const k = el('button', '', '💼'); k.id = 'btnJob'; k.title = 'Mijn werk (J)'; const voor = $('btnCam'); voor.parentNode.insertBefore(k, voor); }
    tap($('btnJob'), () => this.modal === 'werk' ? this.close() : g.net.send({ t: 'werk' }));
    // (Staat de knop niet in de pagina, omdat de browser nog een oude index.html bewaart, dan
    // maken we hem hier zelf. Anders start het spel niet.)
    if (!$('btnMap')) { const k = el('button', '', '🗺️'); k.id = 'btnMap'; k.title = 'Kaart (M)'; const voor = $('btnCam'); voor.parentNode.insertBefore(k, voor); }
    tap($('btnMap'), () => this.modal === 'kaart' ? this.close() : g.net.send({ t: 'kaart', stap: 12 }));
    tap($('btnCam'), () => g.toggleCam());
    tap($('btnMenu'), () => this.modal === 'pause' ? this.close() : this.openPause());
    tap($('btnFull'), () => g.toggleFullscreen());
    tap($('btnUse'), () => g.player.use(null));
    tap($('btnOff'), () => g.net.send({ t: 'dismount' }));
    tap($('btnRide'), () => g.rideNearest());
    tap($('quest'), () => this.openQuest());
    $('modal').addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
  }

  showHud(on) { $('hud').classList.toggle('hidden', !on); }
  setTouch(on) { document.body.classList.toggle('touch', on); }
  setMounted(on) { document.body.classList.toggle('mounted', on); }
  modalOpen() { return this.modal !== null; }

  // ---------- kleine dingen ----------

  toast(text, kind = '') {
    const t = el('div', 'toast ' + kind, text);
    const box = $('toasts');
    box.appendChild(t);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, kind === 'boss' || kind === 'rank' ? 5000 : 3200);
  }

  got(id, n) {
    const box = $('gots');
    let r = this.gotMap.get(id);
    if (r && r.node.parentNode) { r.n += n; clearTimeout(r.timer); }
    else { r = { n, node: el('div', 'got') }; this.gotMap.set(id, r); box.appendChild(r.node); }
    r.node.innerHTML = '<img src="' + iconURL(id) + '"> +' + r.n + ' ' + itemName(id);
    r.timer = setTimeout(() => { r.node.remove(); this.gotMap.delete(id); }, 2400);
    while (box.children.length > 5) box.removeChild(box.firstChild);
  }

  setInv() {
    const g = this.g;
    for (let i = 0; i < HOTBAR; i++) {
      const s = g.inv[i], node = this.hot[i];
      const img = node.firstChild, cnt = node.lastChild;
      if (s) { const u = iconURL(s[0]); if (img.dataset.u !== String(s[0])) { img.src = u; img.dataset.u = String(s[0]); } img.style.display = ''; cnt.textContent = s[1] > 1 ? s[1] : ''; }
      else { img.style.display = 'none'; img.dataset.u = ''; cnt.textContent = ''; }
      this.durBar(node.children[1], s);
      node.classList.toggle('sel', i === g.sel);
    }
    const s = g.inv[g.sel];
    const nm = $('heldName');
    const name = s ? itemName(s[0]) : '';
    if (nm.textContent !== name) { nm.textContent = name; nm.classList.remove('show'); void nm.offsetWidth; if (name) nm.classList.add('show'); }
    if (this.modal === 'inv') this.renderInventory();
    if (this.modal === 'trade') this.renderTrade();
  }

  // het schermpje van je voertuig: brandstof, schade en snelheid ('' = weg)
  setVeh(text) {
    const box = $('vehHud');
    box.classList.toggle('hidden', !text);
    box.textContent = text;
  }

  // de luchtbellen boven je hartjes: n = hoeveel er nog zijn (0..10), -1 = niet onder water
  setAir(n) {
    const box = $('air');
    box.classList.toggle('hidden', n < 0);
    if (n >= 0) box.textContent = '🫧'.repeat(n) + (n === 0 ? '💨' : '');
  }

  setStats(m) {
    this.stats = m;
    const box = $('hearts');
    const n = Math.ceil(m.max / 2);
    if (box.children.length !== n) { box.innerHTML = ''; for (let i = 0; i < n; i++) box.appendChild(el('span', 'heart', '♥')); }
    for (let i = 0; i < n; i++) {
      const v = m.hp - i * 2;
      box.children[i].className = 'heart ' + (v >= 2 ? 'full' : v === 1 ? 'half' : 'empty');
    }
    $('xpfill').style.width = Math.min(100, (m.xp / m.need) * 100) + '%';
    $('lvl').textContent = 'Level ' + m.level + ' · ' + m.rank + (m.armor ? '  🛡' : '');
    if (this.modal === 'quest') this.openQuest();
  }

  setQuest(m) {
    this.quest = m;
    $('questTitle').textContent = '📜 ' + m.title;
    $('questText').textContent = m.text;
    if (this.modal === 'quest') this.openQuest();
  }

  setBoss(b) {
    const box = $('boss');
    if (!b) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    $('bossName').textContent = b[0];
    $('bossFill').style.width = Math.max(0, b[1] * 100) + '%';
  }

  flashHurt() { const v = $('vignette'); v.classList.remove('on'); void v.offsetWidth; v.classList.add('on'); }
  setTint(kind) { if (kind === this._tint) return; this._tint = kind; $('tint').className = kind ? 'on ' + kind : ''; }
  fade(on, text) { const f = $('fade'); f.classList.toggle('on', !!on); $('fadeText').textContent = text || ''; }
  loading(text) { const l = $('loading'); l.classList.toggle('hidden', !text); if (text) $('loadingText').textContent = text; }

  // kompas bovenin: N O Z W, plus het ruitje van de opdracht
  frame(yaw, pos, worldId, sites) {
    const heading = -yaw;
    const strip = $('compassStrip');
    // de breedte opvragen dwingt de browser de hele pagina opnieuw op te maken: alleen als het venster verandert
    if (!this._cmpW) { this._cmpW = strip.clientWidth || 300; if (!this._cmpL) { this._cmpL = true; window.addEventListener('resize', () => { this._cmpW = 0; }); } }
    const W = this._cmpW;
    const place = (node, bearing) => {
      let rel = bearing - heading;
      while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
      const vis = Math.abs(rel) < 1.75;
      node.style.display = vis ? '' : 'none';
      if (vis) node.style.left = (W / 2 + (rel / 1.75) * (W / 2)) + 'px';
      return rel;
    };
    if (!this.cmp) {
      this.cmp = ['N', 'O', 'Z', 'W'].map((t) => { const n = el('span', 'cdir' + (t === 'N' ? ' north' : ''), t); strip.appendChild(n); return n; });
      this.cmpMark = el('span', 'cmark', '◆'); strip.appendChild(this.cmpMark);
      this.cmpShip = el('span', 'cship', '🚀'); strip.appendChild(this.cmpShip);
      this.cmpDorp = el('span', 'cship', '🏠'); strip.appendChild(this.cmpDorp);
      this.cmpBurcht = el('span', 'cship', '🏰'); strip.appendChild(this.cmpBurcht);
      this.cmpBaan = el('span', 'cship', '🏁'); strip.appendChild(this.cmpBaan);
      this.cmpPark = el('span', 'cship', '🎡'); strip.appendChild(this.cmpPark);
      this.cmpStad = el('span', 'cship', '🏙️'); strip.appendChild(this.cmpStad);
      this.cmpPin = el('span', 'cship', '📍'); strip.appendChild(this.cmpPin);
      this.cmpToren = el('span', 'cship', '🗼'); strip.appendChild(this.cmpToren);
      this.cmpDool = el('span', 'cship', '🌿'); strip.appendChild(this.cmpDool);
      this.cmpTempel = el('span', 'cship', '🏛️'); strip.appendChild(this.cmpTempel);
      this.cmpVeld = el('span', 'cship', '✈️'); strip.appendChild(this.cmpVeld);
    }
    for (let i = 0; i < 4; i++) place(this.cmp[i], i * Math.PI / 2);
    let extra = '';
    // het ruimteschip (alleen in de groene wereld): het raketje wijst altijd de weg terug.
    // Ligt het schip achter je, dan staat het raketje aan de rand van het kompas.
    const uit = this.g.kompasUit || {};          // wat de speler van het kompas heeft gehaald (in het kaartvenster)
    const ship = worldId === 'groen' && !uit.schip;
    this.cmpShip.style.display = ship ? '' : 'none';
    if (ship) {
      const dx = CRASH.x + 0.5 - pos.x, dz = CRASH.z + 0.5 - pos.z;
      let rel = Math.atan2(dx, -dz) - heading;
      while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
      const c = Math.max(-1.66, Math.min(1.66, rel));
      this.cmpShip.style.left = (W / 2 + (c / 1.75) * (W / 2)) + 'px';
      extra += '  🚀 ' + Math.round(Math.hypot(dx, dz)) + ' m';
    }
    // het dichtstbijzijnde dorp (huisje) en kasteel (torentje)
    for (const [node, kinds, icon] of [[this.cmpDorp, [0], '🏠'], [this.cmpBurcht, [1, 2], '🏰'], [this.cmpBaan, [4], '🏁'], [this.cmpPark, [5], '🎡'], [this.cmpStad, [6], '🏙️'], [this.cmpVeld, [7], '✈️'], [this.cmpToren, [8], '🗼'], [this.cmpDool, [9], '🌿'], [this.cmpTempel, [10], '🏛️']]) {
      let best = null, bd = 1e9;
      if (sites && !uit['k' + kinds[0]]) for (const st of sites) { if (!kinds.includes(st[0])) continue; const d = Math.hypot(st[1] - pos.x, st[2] - pos.z); if (d < bd) { bd = d; best = st; } }
      node.style.display = best && bd > 30 ? '' : 'none';
      if (best && bd > 30) {
        let rel = Math.atan2(best[1] - pos.x, -(best[2] - pos.z)) - heading;
        while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
        node.style.left = (W / 2 + (Math.max(-1.6, Math.min(1.6, rel)) / 1.75) * (W / 2)) + 'px';
        if ((bd < 400 || kinds[0] > 5) && Math.abs(rel) < 0.5) extra += '  ' + icon + ' ' + Math.round(bd) + ' m';
      }
    }
    let mk = this.quest && this.quest.marker && this.quest.marker.w === worldId ? this.quest.marker : null;
    if (mk && ship && mk.x === CRASH.x && mk.z === CRASH.z) mk = null;      // de opdracht wijst al naar het schip
    if (mk && !uit.opdracht) {
      const dx = mk.x - pos.x, dz = mk.z - pos.z;
      let rel = Math.atan2(dx, -dz) - heading;
      while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
      const c = Math.max(-1.7, Math.min(1.7, rel));
      this.cmpMark.style.display = '';
      this.cmpMark.style.left = (W / 2 + (c / 1.75) * (W / 2)) + 'px';
      extra += '  ◆ ' + Math.round(Math.hypot(dx, dz)) + ' m';
    } else this.cmpMark.style.display = 'none';
    // de markering die je zelf op de kaart hebt gezet: altijd op het kompas, met de afstand erbij
    const pin = this.g.mark;
    if (pin && pin.w === worldId && !uit.pin) {
      const dx = pin.x - pos.x, dz = pin.z - pos.z;
      let rel = Math.atan2(dx, -dz) - heading;
      while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
      this.cmpPin.style.display = '';
      this.cmpPin.style.left = (W / 2 + (Math.max(-1.7, Math.min(1.7, rel)) / 1.75) * (W / 2)) + 'px';
      extra += '  📍 ' + Math.round(Math.hypot(dx, dz)) + ' m' + (Math.abs(rel) > 1.75 ? (rel > 0 ? ' →' : ' ←') : '');
    } else this.cmpPin.style.display = 'none';
    const txt = Math.floor(pos.x) + ', ' + Math.floor(pos.y) + ', ' + Math.floor(pos.z) + extra;
    if (this._coord !== txt) { this._coord = txt; $('coords').textContent = txt; }
  }

  // de knop voor je draak: label is de tekst op de knop, of '' om hem te verbergen
  setRide(label) {
    if (label === this._ride) return;
    this._ride = label;
    const b = $('btnRide');
    b.classList.toggle('hidden', !label);
    if (label) b.textContent = label;
  }

  // ---------- vensters ----------

  open(name, title, body, wide) {
    this.modal = name;
    const m = $('modal');
    m.classList.remove('hidden');
    m.classList.toggle('wide', !!wide);
    $('modalTitle').textContent = title;
    const b = $('modalBody');
    b.innerHTML = '';
    b.appendChild(body);
    const x = $('modalClose');
    x.onclick = null;
    x.style.display = name === 'death' ? 'none' : '';
    if (!x._bound) { tap(x, () => this.close()); x._bound = true; }
    this.g.input.exitLock();
    this.g.input.breakHeld = false;
    this.g.sound.play('click');
  }

  close() {
    if (this.modal === 'death') return;
    this.modal = null; this.pick = -1;
    $('modal').classList.add('hidden');
  }

  toggleInventory() { if (this.modal === 'inv') this.close(); else this.openInventory(''); }

  // het balkje dat laat zien hoe lang gereedschap nog meegaat
  durBar(node, s) {
    const it = s && ITEMS[s[0]];
    if (!it || !it.dur || s[2] === undefined || s[2] >= it.dur) { node.style.display = 'none'; return; }
    const f = Math.max(0, s[2] / it.dur);
    node.style.display = '';
    node.className = 'dur' + (f < 0.2 ? ' low' : f < 0.5 ? ' mid' : '');
    node.innerHTML = '<i style="width:' + Math.round(f * 100) + '%"></i>';
  }

  openInventory(station) {
    this.station = station || '';
    this.pick = -1;
    this.search = '';
    // het venster bestaat uit vaste delen; alleen de vakjes en de lijst worden steeds opnieuw getekend,
    // zodat het zoekvak zijn tekst (en het toetsenbord) houdt
    const wrap = el('div', 'invwrap');
    const left = el('div', 'invleft');
    const right = el('div', 'invright');
    const head = el('div', 'rhead');
    const searchRow = el('div', 'rsearch');
    const input = el('input');
    input.type = 'search'; input.placeholder = 'Zoek een recept...'; input.autocomplete = 'off'; input.spellcheck = false;
    input.addEventListener('input', () => { this.search = input.value.trim().toLowerCase(); this.renderRecipes(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Enter') input.blur(); e.stopPropagation(); });
    const clear = el('button', 'btn small', '✕');
    tap(clear, () => { input.value = ''; this.search = ''; this.renderRecipes(); });
    searchRow.appendChild(input); searchRow.appendChild(clear);
    const list = el('div', 'recipes');
    right.appendChild(head); right.appendChild(searchRow); right.appendChild(list);
    wrap.appendChild(left); wrap.appendChild(right);
    this.invRefs = { left, head, list, input };
    this.open('inv', 'Rugzak en maken', wrap, true);
    this.renderInventory();
  }

  count(need) { let n = 0; for (const s of this.g.inv) if (s && matches(need, s[0])) n += s[1]; return n; }

  renderInventory() {
    const g = this.g, R = this.invRefs;
    if (!R) return;
    // links: de rugzak
    const left = R.left;
    left.innerHTML = '';
    const info = el('div', 'invinfo', this.pick >= 0 && g.inv[this.pick] ? '<b>' + itemName(g.inv[this.pick][0]) + '</b> – tik op een ander vakje om te verplaatsen' : 'Tik op een vakje en dan op een ander vakje om spullen te verplaatsen.');
    left.appendChild(info);
    const grid = el('div', 'invgrid');
    const order = [];
    for (let i = HOTBAR; i < INV_SIZE; i++) order.push(i);
    for (let i = 0; i < HOTBAR; i++) order.push(i);
    for (const i of order) {
      const s = g.inv[i];
      const node = el('div', 'slot' + (i < HOTBAR ? ' hot' : '') + (i === this.pick ? ' pick' : ''));
      if (s) {
        const img = el('img'); img.src = iconURL(s[0]); node.appendChild(img);
        const dur = el('span', 'dur'); node.appendChild(dur); this.durBar(dur, s);
        node.appendChild(el('span', 'cnt', s[1] > 1 ? s[1] : ''));
      }
      tap(node, () => {
        if (this.pick < 0) { if (g.inv[i]) { this.pick = i; g.sound.play('click'); } }
        else if (this.pick === i) this.pick = -1;
        else { g.net.send({ t: 'swap', a: this.pick, b: i }); this.pick = -1; g.sound.play('click'); }
        this.renderInventory();
      });
      grid.appendChild(node);
    }
    left.appendChild(grid);
    left.appendChild(el('div', 'hint', 'De onderste rij is je snelbalk.'));
    if (this.pick >= 0 && g.inv[this.pick]) {
      const tr = el('button', 'btn small danger', '🗑 Weggooien');
      tap(tr, () => { g.net.send({ t: 'trash', a: this.pick }); this.pick = -1; });
      left.appendChild(tr);
    }
    this.renderRecipes();
  }

  // rechts: de lijst met recepten (gefilterd op het zoekvak)
  renderRecipes() {
    const g = this.g, R = this.invRefs;
    if (!R) return;
    const nearW = g.nearBlock(B.werkbank), nearO = g.nearBlock(B.oven), nearK = g.nearBlock(B.kampvuur);
    const head = R.head;
    head.innerHTML = '';
    head.appendChild(el('span', '', '<b>Maken</b> ' + (nearW ? '<span class="ok">🔨 werkbank</span> ' : '') + (nearO ? '<span class="ok">🔥 oven</span>' : '')));
    const flt = el('button', 'btn small' + (this.onlyCan ? ' active' : ''), this.onlyCan ? '✔ Wat ik kan maken' : 'Alles');
    tap(flt, () => { this.onlyCan = !this.onlyCan; this.renderRecipes(); });
    head.appendChild(flt);
    const list = R.list;
    const keepScroll = list.scrollTop;
    list.innerHTML = '';
    const q = this.search || '';
    const needName = (need) => (typeof need === 'string' ? GROUP_NAMES[need] : itemName(need));
    const rows = [];
    for (const r of RECIPES) {
      if (q) {
        // zoeken in de naam van het ding zelf en in wat je ervoor nodig hebt
        let hit = itemName(r.out).toLowerCase().includes(q);
        for (const [need] of r.in) if (!hit && needName(need).toLowerCase().includes(q)) hit = true;
        if (!hit) continue;
      }
      const stationOk = !r.station || (r.station === 'werkbank' && nearW) || (r.station === 'oven' && (nearO || (r.out === 267 && nearK)));
      const treeOk = !r.needs || g.trees[r.needs];
      let have = true;
      for (const [need, n] of r.in) if (this.count(need) < n) have = false;
      const can = stationOk && treeOk && have;
      if (this.onlyCan && !can) continue;
      rows.push({ r, can, stationOk, treeOk, have });
    }
    rows.sort((a, b) => (b.can - a.can) || (a.r.id - b.r.id));
    for (const { r, can, stationOk, treeOk } of rows) {
      const card = el('div', 'recipe' + (can ? ' can' : ''));
      const img = el('img', 'ricon'); img.src = iconURL(r.out); card.appendChild(img);
      const mid = el('div', 'rmid');
      mid.appendChild(el('div', 'rname', itemName(r.out) + (r.n > 1 ? ' ×' + r.n : '')));
      const ing = el('div', 'ring');
      for (const [need, n] of r.in) {
        const id = typeof need === 'string' ? GROUPS[need][0] : need;
        const h = this.count(need);
        ing.appendChild(el('span', 'ingr' + (h >= n ? '' : ' lack'), '<img src="' + iconURL(id) + '">' + Math.min(h, 999) + '/' + n + ' ' + needName(need)));
      }
      mid.appendChild(ing);
      let note = '';
      if (r.station === 'werkbank' && !stationOk) note = '🔨 Ga bij een werkbank staan';
      if (r.station === 'oven' && !stationOk) note = '🔥 Ga bij een oven staan';
      if (!treeOk) note = '🌳 Herstel eerst ' + WORLDS[r.needs].tree.name;
      if (note) mid.appendChild(el('div', 'rnote', note));
      card.appendChild(mid);
      tap(card, () => { if (can) g.net.send({ t: 'craft', id: r.id }); else g.sound.play('deny'); });
      list.appendChild(card);
    }
    if (!rows.length) list.appendChild(el('div', 'hint', q ? 'Niets gevonden voor "' + q + '".' : 'Je kunt nu niets maken. Verzamel meer spullen!'));
    list.scrollTop = keepScroll;
  }

  openQuest() {
    const g = this.g, st = this.stats, q = this.quest;
    const b = el('div', 'questlog');
    if (q) {
      b.appendChild(el('div', 'qbig', '<h3>Opdracht ' + (q.i + 1) + ' van ' + q.n + ': ' + q.title + '</h3><p>' + q.text + '</p>'));
    }
    let trees = '<div class="trees">';
    for (const w of WORLD_ORDER) trees += '<span class="tree' + (g.trees[w] ? ' on' : '') + '">🌳<small>' + WORLDS[w].tree.name.replace('De ', '') + '</small></span>';
    trees += '</div>';
    b.appendChild(el('div', 'qsec', '<h4>Levensbomen</h4>' + trees));
    const powers = WORLD_ORDER.filter((w) => g.trees[w]).map((w) => '<li>' + WORLDS[w].power + '</li>').join('');
    if (powers) b.appendChild(el('div', 'qsec', '<h4>Jouw krachten</h4><ul>' + powers + '</ul>'));
    let ranks = '<div class="ranks">';
    for (const r of RANKS) ranks += '<span class="rank' + (st.level >= r.level ? ' on' : '') + (st.rank === r.name ? ' cur' : '') + '">' + r.name + '<small>level ' + r.level + '</small></span>';
    ranks += '<span class="rank' + (RANKS.some((r) => r.name === st.rank) ? '' : ' on cur') + '">' + (RANKS.some((r) => r.name === st.rank) ? '???' : st.rank) + '<small>geheim</small></span></div>';
    b.appendChild(el('div', 'qsec', '<h4>Rang: ' + st.rank + ' (level ' + st.level + ')</h4>' + ranks));
    // draken
    const ds = el('div', 'qsec');
    ds.appendChild(el('h4', '', 'Jouw draken (' + g.dragons.length + ' van de 8 soorten)'));
    if (!g.dragons.length) ds.appendChild(el('p', 'hint', 'Je hebt nog geen draak. Zoek een drakenei in een nest op een hoge berg.'));
    for (const d of g.dragons) {
      const row = el('div', 'drow');
      row.appendChild(el('span', '', '🐉 <b>' + d.name + '</b> – ' + DRAGONS[d.type].name + ', ' + STAGE_NAMES[dragonStage(d.growth)].toLowerCase() + (d.world !== g.worldId ? ' (in de ' + WORLDS[d.world].name + ')' : '')));
      const btns = el('span', 'drowbtns');
      if (d.world === g.worldId && d.eid) {
        const menu = el('button', 'btn small', 'Voeren / menu');
        tap(menu, () => this.openDragon(d.uid));
        btns.appendChild(menu);
      }
      const call = el('button', 'btn small', 'Roep');
      tap(call, () => { g.net.send({ t: 'dragon', uid: d.uid, cmd: 'call' }); this.close(); });
      btns.appendChild(call);
      row.appendChild(btns);
      ds.appendChild(row);
    }
    b.appendChild(ds);
    b.appendChild(el('div', 'qsec help', '<h4>De wereld</h4><p>🏠 <b>Dorpen</b>: tik op een dorpeling om te ruilen. Verkoop wat je vindt voor gouden munten en koop gereedschap, eten of een locomotief. 🏰 <b>Kastelen</b>: bij de koning ben je welkom, in een spookkasteel woont de Skeletkoning. 🚂 <b>Treinen</b>: zet een locomotief op rails en tik erop. 🐑 Tik op een schaap voor wol, op een koe met een emmer voor melk, en geef een wolf drie botten om hem te temmen.</p>'));
    b.appendChild(el('div', 'qsec help', g.input.touch
      ? '<h4>Besturing</h4><p>Linkerduim: lopen. Rechterduim: rondkijken. <b>Tik</b> = neerzetten of gebruiken. <b>Vinger ingedrukt houden</b> = hakken of slaan. Knoppen rechtsonder: ⛏ hakken, ✋ gebruiken, ⬆ springen. Is je draak in de buurt, dan staat er onderin een knop 🐉 om hem te voeren of op hem te vliegen.</p>'
      : '<h4>Besturing</h4><p><b>WASD</b> lopen · <b>muis</b> kijken (of pijltjestoetsen) · <b>linkermuisknop</b> hakken/slaan · <b>rechtermuisknop</b> of <b>F</b> neerzetten/gebruiken · <b>spatie</b> springen · <b>shift</b> rennen · <b>1-9</b> of scrollen: snelbalk · <b>E</b> rugzak · <b>Q</b> opdrachten · <b>V</b> camera · <b>R</b> op/van je draak · <b>G</b> venster van je draak · <b>Esc</b> menu</p>'));
    this.open('quest', 'Opdrachten en avontuur', b, true);
  }

  openDialog(title, lines, btn) {
    const b = el('div', 'dialog');
    for (const l of lines) b.appendChild(el('p', '', l));
    const ok = el('button', 'btn big', btn || 'Oké!');
    tap(ok, () => this.close());
    b.appendChild(ok);
    this.open('dialog', title, b, false);
  }

  openDragon(uid) {
    const g = this.g;
    const d = g.dragons.find((q) => q.uid === uid);
    if (!d) return;
    this.dragonUid = uid;
    const stage = dragonStage(d.growth);
    const b = el('div', 'dragon');
    b.appendChild(el('p', '', DRAGONS[d.type].name + ' · <b>' + STAGE_NAMES[stage] + '</b> · level ' + d.level));
    b.appendChild(el('div', 'growbar', '<div style="width:' + Math.min(100, d.growth) + '%"></div><span>' + (stage < 2 ? 'Groei: ' + Math.floor(d.growth) + '%' : 'Volwassen!') + '</span>'));
    const row = el('div', 'btnrow');
    const mk = (label, fn, cls) => { const x = el('button', 'btn ' + (cls || ''), label); tap(x, fn); row.appendChild(x); };
    mk('🍖 Voeren', () => g.net.send({ t: 'dragon', uid, cmd: 'feed' }));
    if (stage >= 2) mk('🐉 Vliegen!', () => { g.net.send({ t: 'dragon', uid, cmd: 'mount' }); this.close(); }, 'gold');
    mk(d.mode === 'follow' ? '✋ Blijf hier' : '🐾 Volg mij', () => g.net.send({ t: 'dragon', uid, cmd: d.mode === 'follow' ? 'stay' : 'follow' }));
    mk('✏️ Naam', () => { const n = window.prompt('Hoe heet je draak?', d.name); if (n) g.net.send({ t: 'dragon', uid, cmd: 'name', name: n }); });
    b.appendChild(row);
    if (DRAGONS[d.type].power) b.appendChild(el('p', 'dpower', '✨ <b>Kracht:</b> ' + DRAGONS[d.type].power));
    b.appendChild(el('p', 'hint', stage < 2 ? 'Draken lusten bessen, appels en vlees. Hoe meer eten, hoe groter!' : 'Je draak helpt je in gevechten en je kunt op hem vliegen.'));
    this.open('dragon', '🐉 ' + d.name, b, false);
  }

  // ---------- ruilen met een dorpeling ----------

  openTrade(m) {
    if (!m.offers.length) { this.openDialog(m.name, ['"' + m.say + '"'], 'Tot ziens!'); return; }
    this.trade = m;
    const b = el('div', 'trade');
    b.appendChild(el('p', 'tsay', '"' + m.say + '"'));
    this.tradeHead = el('div', 'tpurse'); b.appendChild(this.tradeHead);
    this.tradeList = el('div', 'recipes tlist'); b.appendChild(this.tradeList);
    this.open('trade', m.name, b, false);
    this.renderTrade();
  }

  renderTrade() {
    const g = this.g, m = this.trade;
    if (!m || !this.tradeList) return;
    this.tradeHead.innerHTML = '<img src="' + iconURL(I.munt) + '"> Je hebt <b>' + this.count(I.munt) + '</b> gouden munten';
    const list = this.tradeList, keep = list.scrollTop;
    list.innerHTML = '';
    const nm = (need) => (typeof need === 'string' ? GROUP_NAMES[need] : itemName(need));
    const ic = (need) => iconURL(typeof need === 'string' ? GROUPS[need][0] : need);
    m.offers.forEach(([pay, pn, get, gn], i) => {
      const have = this.count(pay), can = have >= pn;
      const card = el('div', 'recipe trow' + (can ? ' can' : ''));
      // verkopen (jij krijgt munten) of kopen (jij betaalt munten)
      const sell = get === I.munt;
      card.appendChild(el('span', 'tside' + (can ? '' : ' lack'), '<img src="' + ic(pay) + '"><b>' + pn + '</b> ' + nm(pay) + (sell || pay !== I.munt ? ' <small>(je hebt ' + Math.min(have, 999) + ')</small>' : '')));
      card.appendChild(el('span', 'tarrow', '➜'));
      card.appendChild(el('span', 'tside', '<img src="' + ic(get) + '"><b>' + gn + '</b> ' + nm(get)));
      card.appendChild(el('span', 'tbtn', sell ? 'Verkoop' : (pay === I.munt ? 'Koop' : 'Ruil')));
      tap(card, () => { if (can) g.net.send({ t: 'trade', id: m.id, i }); else g.sound.play('deny'); });
      list.appendChild(card);
    });
    list.scrollTop = keep;
  }

  // ---------- kermisspelletjes ----------

  // het kraampje: uitleg en de knop om te spelen
  openKermis(m) {
    const g = this.g, G = KERMIS_GAMES[m.game];
    const b = el('div', 'kermis');
    b.appendChild(el('p', '', G.uitleg));
    const go = el('button', 'btn big', '🎟️ Speel (' + m.prijs + ' munten)');
    tap(go, () => g.net.send({ t: 'kermis', c: 'start', game: m.game }));
    b.appendChild(go);
    b.appendChild(el('p', 'hint', 'Je hebt ' + m.munten + ' munten. Te winnen: knuffels, een trofee, munten en soms een ei!'));
    this.open('kermis', G.name, b, false);
  }

  // het spelletje zelf. Aan het eind gaat je score (0..1) naar de server, die de prijs bepaalt.
  playKermis(game) {
    const g = this.g, G = KERMIS_GAMES[game];
    const b = el('div', 'kermis');
    const info = el('p', '', '');
    b.appendChild(info);
    let turn = 0, total = 0;
    const finish = () => { clearInterval(this.kermisT); this.kermisT = 0; info.textContent = 'Even kijken wat je gewonnen hebt...'; g.net.send({ t: 'kermis', c: 'score', game, score: total / G.beurten }); };
    if (G.soort === 'mik') {
      // een streepje beweegt heen en weer; tik als het op het doel staat
      const doel = game === 'jut' ? 1 : 0.5, snel = game === 'grijp' ? 2.6 : game === 'jut' ? 3.4 : 3.0;
      const bar = el('div', 'kbar'), zone = el('div', 'kzone'), mark = el('div', 'kmark');
      zone.style.left = Math.max(0, doel * 100 - 9) + '%'; zone.style.width = (game === 'jut' ? 9 : 18) + '%';
      bar.appendChild(zone); bar.appendChild(mark); b.appendChild(bar);
      let pos = 0, t0 = performance.now(), wait = false;
      const say = () => { info.textContent = (G.beurten > 1 ? 'Beurt ' + (turn + 1) + ' van ' + G.beurten + '. ' : '') + 'Tik op "Nu!" als het streepje op het gele vak staat.'; };
      say();
      clearInterval(this.kermisT);
      this.kermisT = setInterval(() => {
        if (this.modal !== 'kermis') { clearInterval(this.kermisT); this.kermisT = 0; return; }
        if (wait) return;
        const t = (performance.now() - t0) / 1000;
        pos = game === 'jut' ? Math.abs(Math.sin(t * snel * 0.5)) : 0.5 + 0.5 * Math.sin(t * snel + turn * 2);
        mark.style.left = (pos * 100) + '%';
      }, 25);
      const nu = el('button', 'btn big', 'Nu!');
      tap(nu, () => {
        if (wait || !this.kermisT) return;
        const sc = Math.max(0, 1 - Math.abs(pos - doel) / (game === 'jut' ? 0.45 : 0.4));
        total += sc; turn++; wait = true;
        g.sound.play(sc > 0.75 ? 'got' : 'click');
        info.textContent = sc > 0.9 ? 'Raak! Precies goed!' : sc > 0.6 ? 'Mooi!' : sc > 0.3 ? 'Net ernaast.' : 'Mis!';
        setTimeout(() => { if (this.modal !== 'kermis') return; if (turn >= G.beurten) finish(); else { wait = false; t0 = performance.now(); say(); } }, 800);
      });
      b.appendChild(nu);
    } else {
      // twaalf eendjes of ballonnen: kies er één (of drie)
      const icon = game === 'eend' ? '🦆' : '🎈', grid = el('div', 'kgrid');
      // de waarde onder elk ding: de meeste zijn laag, een paar zijn goed
      const vals = [1, 0.9, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05].sort(() => Math.random() - 0.5);
      info.textContent = game === 'eend' ? 'Vis een eendje uit het water!' : 'Prik drie ballonnen!';
      vals.forEach((val) => {
        const c = el('button', 'kitem', icon);
        tap(c, () => {
          if (c.disabled || turn >= G.beurten) return;
          c.disabled = true; turn++;
          const sc = game === 'ballon' ? (val >= 0.7 ? 1 : val >= 0.4 ? 0.5 : 0) : val;
          total += sc;
          c.textContent = game === 'eend' ? String(Math.round(val * 10)) : sc >= 1 ? '⭐' : sc > 0 ? '🍬' : '💥';
          c.classList.add('open');
          g.sound.play(sc >= 0.7 ? 'got' : 'click');
          if (turn >= G.beurten) setTimeout(() => { if (this.modal === 'kermis') finish(); }, 900);
        });
        grid.appendChild(c);
      });
      b.appendChild(grid);
    }
    this.open('kermis', G.name, b, false);
  }

  // wat heb je gewonnen?
  kermisPrijs(m) {
    if (this.modal !== 'kermis') return;
    const g = this.g, G = KERMIS_GAMES[m.game];
    const b = el('div', 'kermis');
    b.appendChild(el('p', 'kprijs', (m.id ? '<img src="' + iconURL(m.id) + '"> ' : '') + m.tekst + (m.id ? ' Je krijgt ' + (m.n > 1 ? m.n + '× ' : '') + itemName(m.id).toLowerCase() + '.' : '')));
    const go = el('button', 'btn big', '🎟️ Nog een keer (2 munten)');
    tap(go, () => g.net.send({ t: 'kermis', c: 'start', game: m.game }));
    b.appendChild(go);
    b.appendChild(el('p', 'hint', 'Je hebt ' + m.munten + ' munten.'));
    this.open('kermis', G.name, b, false);
    if (m.id) g.sound.play('quest', 0.5);
  }

  // ---------- de racemeester ----------

  openRaceMenu(m) {
    const g = this.g;
    const b = el('div', 'race');
    b.appendChild(el('p', '', 'Welkom op <b>' + m.name + '</b>!'));
    b.appendChild(el('p', '', 'Rijd over de geblokte startlijn en de klok begint te lopen. Haal de drie gele checkpoints en kom weer over de lijn: dat is een ronde. Je snelste ronde wordt onthouden.'));
    b.appendChild(el('p', '', 'Of race tegen Flits, Bliksem en Turbo: drie rondes, wie het eerst over de finish is wint.' + (m.wins ? ' Jij hebt hier al ' + m.wins + ' keer gewonnen!' : '')));
    const go = el('button', 'btn big', '🏁 Start de race');
    tap(go, () => { g.net.send({ t: 'race', c: 'start' }); this.close(); });
    b.appendChild(go);
    b.appendChild(el('p', 'hint', 'Je moet in een voertuig met wielen zitten. In de loods in het midden staat de garage (de rode kast) en een monteur die brandstof verkoopt.'));
    this.open('race', 'Racemeester', b, false);
  }

  // ---------- de garage ----------

  // Het venster van je voertuig bij een garageblok: repareren, tanken, een kleur en een naam
  // kiezen en upgrades inbouwen. m komt van de server: { v: het voertuig, munten }.
  openGarage(m) {
    const g = this.g, v = m.v, V = VEHICLES[v.kind];
    const send = (o) => g.net.send(Object.assign({ t: 'garage' }, o));
    const b = el('div', 'garage');
    const S = vehStats(V, v.up);
    b.appendChild(el('div', 'qsec', '<h4>' + (v.name ? v.name + ' – ' : '') + V.name + ' · klasse ' + v.klasse + '</h4>' +
      '<p class="hint">Topsnelheid ' + Math.round(S.max * 3.6) + ' km/u (op asfalt ' + Math.round(S.max * 3.6 * 1.22) + ') · jij hebt ' + m.munten + ' munten</p>'));
    // onderhoud
    const row = el('div', 'btnrow');
    const fixCost = Math.ceil(v.dmg / 12), fuelCost = Math.ceil((v.tank - v.fuel) / 30);
    const fix = el('button', 'btn small' + (v.dmg >= 1 ? ' active' : ''), v.dmg >= 1 ? '🔧 Repareren (' + fixCost + ' munten)' : '🔧 Niets kapot');
    tap(fix, () => { if (v.dmg >= 1) send({ c: 'fix' }); });
    const fuel = el('button', 'btn small' + (v.fuel < v.tank - 1 ? ' active' : ''), v.fuel < v.tank - 1 ? '⛽ Voltanken (' + fuelCost + ' munten)' : '⛽ Tank is vol');
    tap(fuel, () => { if (v.fuel < v.tank - 1) send({ c: 'fuel' }); });
    const name = el('button', 'btn small', '✏️ Naam geven');
    tap(name, () => { const n = window.prompt('Hoe heet je ' + V.name.toLowerCase() + '?', v.name || ''); if (n !== null) send({ c: 'name', name: n }); });
    row.appendChild(fix); row.appendChild(fuel); row.appendChild(name);
    b.appendChild(row);
    b.appendChild(el('p', 'hint', 'Tank: ' + Math.round(v.fuel / v.tank * 100) + '% · Heel: ' + Math.round(100 - v.dmg) + '%'));
    // kleur
    const cs = el('div', 'qsec');
    cs.appendChild(el('h4', '', 'Kleur'));
    const pal = el('div', 'vcolors');
    VEH_COLORS.forEach((c, i) => {
      const sw = el('button', 'vcolor' + (c === v.color ? ' on' : ''));
      sw.style.background = '#' + c.toString(16).padStart(6, '0');
      tap(sw, () => send({ c: 'color', i }));
      pal.appendChild(sw);
    });
    cs.appendChild(pal);
    b.appendChild(cs);
    // upgrades
    const us = el('div', 'qsec');
    us.appendChild(el('h4', '', 'Upgrades'));
    for (const k of UPGRADE_ORDER) {
      const U = UPGRADES[k], lv = v.up[k] || 0, max = U.prijs.length;
      const r = el('div', 'drow');
      r.appendChild(el('span', '', '<b>' + U.name + '</b> ' + '★'.repeat(lv) + '☆'.repeat(max - lv) + ' <small>' + U.hint + '</small>'));
      const btns = el('span', 'drowbtns');
      const buy = el('button', 'btn small' + (lv < max && m.munten >= U.prijs[lv] ? ' active' : ''), lv < max ? 'Niveau ' + (lv + 1) + ': ' + U.prijs[lv] + ' munten' : 'Helemaal af');
      tap(buy, () => { if (lv < max) send({ c: 'up', k }); });
      btns.appendChild(buy); r.appendChild(btns);
      us.appendChild(r);
    }
    b.appendChild(us);
    b.appendChild(el('p', 'hint', 'Nitro gebruik je met de sprintknop (stick helemaal naar voren, of shift). De springknop is de handrem: daarmee kun je driften.'));
    this.open('garage', 'Garage', b, true);
  }

  // ---------- de puzzels van de Vergeten Tempel ----------

  // Vier puzzels: kleuren onthouden, alle lampjes aan, een melodietje naspelen en een
  // schuifpuzzel. Los je hem op, dan vertelt de server welk cijfer bij deze kamer hoort.
  openPuzzle(m) {
    const g = this.g, b = el('div', 'puzzel');
    const info = el('p', 'hint', '');
    b.appendChild(info);
    const veld = el('div', 'pveld'); b.appendChild(veld);
    const win = () => { info.textContent = 'Opgelost!'; g.sound.play('levelup'); setTimeout(() => { if (this.modal === 'puzzel') this.close(); g.net.send({ t: 'puzzel', ok: 1 }); }, 500); };
    const rnd = (n) => Math.floor(Math.random() * n);
    const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
    if (m.soort === 'kleur' || m.soort === 'muziek') {
      // onthouden en nadoen: bij 'kleur' lichten de vlakken op, bij 'muziek' hoor je de tonen (en zie je een zwak flitsje)
      const muziek = m.soort === 'muziek';
      const kleuren = ['#e0342c', '#f4ce32', '#3fae4a', '#346ee2'], tonen = [262, 330, 392, 523];
      const reeks = Array.from({ length: muziek ? 4 : 5 }, () => rnd(4));
      let stap = 0, bezig = true;
      const knop = kleuren.map((c, i) => {
        const k = el('button', 'pknop', muziek ? ['🎵', '🎶', '🎵', '🎶'][i] : '');
        k.style.background = c; k.style.opacity = '0.45';
        tap(k, () => {
          if (bezig) return;
          flits(i, 180);
          if (reeks[stap] !== i) { stap = 0; info.textContent = 'Net niet! Kijk en luister nog een keer.'; speel(700); return; }
          stap++;
          if (stap === reeks.length) { bezig = true; win(); }
        });
        veld.appendChild(k);
        return k;
      });
      const flits = (i, ms) => { knop[i].style.opacity = '1'; g.sound.tone(tonen[i], 0.22, 'triangle', 0.25); setTimeout(() => { knop[i].style.opacity = '0.45'; }, ms); };
      const speel = async (eerst) => {
        bezig = true;
        await wacht(eerst);
        for (const i of reeks) { if (this.modal !== 'puzzel') return; flits(i, 320); await wacht(520); }
        bezig = false;
        info.textContent = muziek ? 'Speel het melodietje na: tik de ' + reeks.length + ' tonen in dezelfde volgorde.' : 'Tik de ' + reeks.length + ' kleuren in dezelfde volgorde aan.';
      };
      info.textContent = muziek ? 'Luister goed naar het melodietje...' : 'Kijk goed welke kleuren oplichten...';
      const weer = el('button', 'btn small', '🔁 Nog een keer laten zien');
      tap(weer, () => { if (!bezig) { stap = 0; speel(200); } });
      b.appendChild(weer);
      speel(600);
    } else if (m.soort === 'licht') {
      // alle lampjes aan: een tik zet het lampje zelf en zijn buren om
      const aan = new Array(9).fill(true), knop = [];
      const tik = (i) => { const x = i % 3, y = (i / 3) | 0; for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && nx < 3 && ny >= 0 && ny < 3) aan[nx + ny * 3] = !aan[nx + ny * 3]; } };
      const teken = () => knop.forEach((k, i) => { k.style.background = aan[i] ? '#ffe680' : '#3a3f52'; k.textContent = aan[i] ? '💡' : ''; });
      veld.classList.add('drie');
      for (let i = 0; i < 9; i++) { const k = el('button', 'pknop'); tap(k, () => { tik(i); teken(); g.sound.tone(aan[i] ? 660 : 330, 0.08, 'square', 0.12); if (aan.every(Boolean)) win(); }); veld.appendChild(k); knop.push(k); }
      do { for (let n = 0; n < 4; n++) tik(rnd(9)); } while (aan.every(Boolean));
      teken();
      info.textContent = 'Zet alle negen lampjes aan. Een tik zet een lampje om, en ook de lampjes ernaast.';
    } else {
      // schuifpuzzel: zet de cijfers 1 tot en met 8 op volgorde
      const vak = [1, 2, 3, 4, 5, 6, 7, 8, 0], knop = [];
      const schuif = (i) => { const leeg = vak.indexOf(0), x = i % 3, y = (i / 3) | 0, lx = leeg % 3, ly = (leeg / 3) | 0; if (Math.abs(x - lx) + Math.abs(y - ly) !== 1) return false; vak[leeg] = vak[i]; vak[i] = 0; return true; };
      const teken = () => knop.forEach((k, i) => { k.textContent = vak[i] || ''; k.style.background = vak[i] ? '#c8a060' : 'transparent'; k.style.borderColor = vak[i] ? '' : 'transparent'; });
      veld.classList.add('drie');
      for (let i = 0; i < 9; i++) { const k = el('button', 'pknop'); tap(k, () => { if (schuif(i)) { teken(); g.sound.play('place', 0.6, 'wood'); if (vak.join('') === '123456780') win(); } }); veld.appendChild(k); knop.push(k); }
      // goed door elkaar: veertig keer een blokje naast het lege vak verschuiven (zo is hij altijd op te lossen)
      do { for (let n = 0; n < 40; n++) { const leeg = vak.indexOf(0), buren = [leeg - 3, leeg + 3, leeg % 3 ? leeg - 1 : -1, leeg % 3 < 2 ? leeg + 1 : -1].filter((i) => i >= 0 && i < 9); schuif(buren[rnd(buren.length)]); } } while (vak.join('') === '123456780');
      teken();
      info.textContent = 'Schuif de blokjes tot ze op volgorde staan: 1, 2, 3 bovenaan en het lege vakje rechtsonder.';
    }
    this.open('puzzel', '🧩 Puzzel van kamer ' + m.kamer, b);
  }

  // ---------- de wereldkaart ----------

  // De server stuurt een raster van kleurnummers en hoogtes; hier wordt er een plaatje van
  // gemaakt. Tik op de kaart om een markering te zetten: die staat daarna op je kompas.
  openMap(m) {
    const g = this.g, N = m.n, STEPS = [4, 6, 8, 12, 16, 24, 32, 48, 64, 80];
    const send = (o) => g.net.send(Object.assign({ t: 'kaart', x: m.x, z: m.z, stap: m.stap }, o));
    const b = el('div', 'kaart');
    const half = N / 2 * m.stap;
    b.appendChild(el('p', 'hint', m.wereld + ' · je ziet ' + (2 * half) + ' bij ' + (2 * half) + ' blokken. Sleep om te schuiven, knijp met twee vingers of draai aan het muiswiel om te zoomen, en tik om een markering te zetten: je kompas wijst er dan naartoe.'));
    const cv = el('canvas'); cv.width = cv.height = N * 4;
    const vak = el('div', 'kaartvak'); vak.appendChild(cv);
    b.appendChild(vak);
    const c = cv.getContext('2d');
    // het land: kleur per soort grond, lichter naarmate het hoger ligt, met een schaduwrandje op hellingen
    const img = c.createImageData(N, N), d = img.data;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const q = i + j * N, kl = MAP_COLORS[m.k[q]] || MAP_COLORS[8], h = m.h[q];
      let f = m.k[q] <= 3 ? 1 : 0.72 + Math.min(0.5, (h - 40) / 110);
      if (m.k[q] > 3 && i > 0 && j > 0) f *= 1 + Math.max(-0.22, Math.min(0.22, (h - m.h[q - 1 - N]) * 0.05));
      d[q * 4] = Math.min(255, kl[0] * f); d[q * 4 + 1] = Math.min(255, kl[1] * f); d[q * 4 + 2] = Math.min(255, kl[2] * f); d[q * 4 + 3] = 255;
    }
    const klein = document.createElement('canvas'); klein.width = klein.height = N; klein.getContext('2d').putImageData(img, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(klein, 0, 0, N * 4, N * 4);
    // van blokken naar plek op het plaatje
    const X = (x) => (x - m.x + half) / (2 * half) * cv.width, Z = (z) => (z - m.z + half) / (2 * half) * cv.height;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const ICON = { 0: '🏠', 1: '🏰', 2: '🏰', 3: '⛺', 4: '🏁', 5: '🎡', 6: '🏙️', 7: '✈️', 8: '🗼', 9: '🌿', 10: '🏛️', 20: '🌳', 21: '🚀' };
    for (const [code, sx, sz, name] of m.sites) {
      if (Math.abs(sx - m.x) > half || Math.abs(sz - m.z) > half) continue;
      const groot = code === 6 || code === 7 || code >= 20;
      if (m.stap >= 80 && !groot && code !== 1 && code !== 2 && code !== 0) continue;        // op de grootste kaart alleen de belangrijkste plekken
      c.font = (groot ? 22 : m.stap >= 80 ? 11 : 16) + 'px sans-serif';
      c.fillText(ICON[code] || '•', X(sx), Z(sz));
      if (name && (groot || m.stap <= 12)) { c.font = 'bold 11px sans-serif'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.strokeText(name, X(sx), Z(sz) + 16); c.fillStyle = '#fff'; c.fillText(name, X(sx), Z(sz) + 16); }
    }
    if (m.mark) { c.font = '26px sans-serif'; c.fillText('📍', X(m.mark.x), Z(m.mark.z) - 10); }
    // de speler: een pijltje in de kijkrichting
    if (Math.abs(m.px - m.x) < half && Math.abs(m.pz - m.z) < half) {
      c.save(); c.translate(X(m.px), Z(m.pz)); c.rotate(-m.yaw);
      c.fillStyle = '#ff3030'; c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    // Slepen, knijpen, scrollen en tikken. Tijdens het gebaar schuift en groeit het plaatje dat
    // er al staat mee; laat je los, dan vraagt de kaart het nieuwe stuk op bij de server.
    let bezig = false;                                   // er is al een nieuw stuk gevraagd: even niets meer doen
    const vingers = new Map();
    let start = null, dx = 0, dy = 0, schaal = 1, bewogen = false;
    const zet = () => { cv.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + schaal + ')'; };
    const midden = () => { let x = 0, y = 0; for (const p of vingers.values()) { x += p.x; y += p.y; } return { x: x / vingers.size, y: y / vingers.size }; };
    const spreiding = () => { const p = [...vingers.values()]; return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
    const opnieuw = () => { const c0 = midden(); start = { x: c0.x - dx, y: c0.y - dy, d: spreiding() / schaal, t: performance.now() }; };
    const dichtste = (stap) => STEPS.reduce((best, q) => Math.abs(Math.log(q / stap)) < Math.abs(Math.log(best / stap)) ? q : best, STEPS[0]);
    cv.addEventListener('pointerdown', (e) => {
      if (bezig) return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* geeft niet */ }
      vingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (vingers.size === 1) { dx = dy = 0; schaal = 1; bewogen = false; }
      opnieuw();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!vingers.has(e.pointerId) || bezig) return;
      vingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const c0 = midden();
      dx = c0.x - start.x; dy = c0.y - start.y;
      if (vingers.size >= 2 && start.d > 0) schaal = Math.max(0.25, Math.min(4, spreiding() / start.d));
      if (Math.hypot(dx, dy) > 8 || Math.abs(schaal - 1) > 0.04) bewogen = true;
      if (bewogen) zet();
    });
    const los = (e) => {
      if (!vingers.has(e.pointerId)) return;
      const r = cv.getBoundingClientRect();
      vingers.delete(e.pointerId);
      if (vingers.size > 0) { opnieuw(); return; }                       // er ligt nog een vinger op de kaart
      if (bezig) return;
      const breed = r.width / schaal, perPunt = 2 * half / breed;        // blokken per schermpunt (voor het gebaar)
      if (!bewogen) {
        // een tik: daar komt de markering
        if (e.type === 'pointercancel') return;
        const mx = m.x - half + (e.clientX - r.left) / r.width * 2 * half, mz = m.z - half + (e.clientY - r.top) / r.height * 2 * half;
        bezig = true; send({ c: 'mark', mx, mz });
        return;
      }
      bezig = true;
      send({ x: m.x - dx * perPunt, z: m.z - dy * perPunt, stap: dichtste(m.stap / schaal) });
    };
    cv.addEventListener('pointerup', los); cv.addEventListener('pointercancel', los);
    // het muiswiel zoomt in en uit rond de plek waar de muis staat
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (bezig) return;
      const si0 = STEPS.indexOf(m.stap), ni = Math.max(0, Math.min(STEPS.length - 1, si0 + (e.deltaY > 0 ? 1 : -1)));
      if (ni === si0) return;
      const r = cv.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width - 0.5, fz = (e.clientY - r.top) / r.height - 0.5;
      const wx = m.x + fx * 2 * half, wz = m.z + fz * 2 * half, half2 = N / 2 * STEPS[ni];
      bezig = true;
      send({ x: wx - fx * 2 * half2, z: wz - fz * 2 * half2, stap: STEPS[ni] });
    }, { passive: false });
    // knoppen: in- en uitzoomen, schuiven, terug naar jezelf, markering weghalen
    const rij = el('div', 'btnrow');
    const knop = (tekst, fn, aan = true) => { const k = el('button', 'btn small' + (aan ? ' active' : ''), tekst); tap(k, () => { if (aan) fn(); }); rij.appendChild(k); };
    const si = STEPS.indexOf(m.stap);
    knop('➕ Dichterbij', () => send({ stap: STEPS[si - 1] }), si > 0);
    knop('➖ Verder weg', () => send({ stap: STEPS[si + 1] }), si < STEPS.length - 1);
    knop('🧭 Naar mij', () => g.net.send({ t: 'kaart', stap: m.stap }));
    if (m.mark) { knop('📍 Naar markering', () => send({ x: m.mark.x, z: m.mark.z })); knop('❌ Markering weg', () => send({ c: 'wis' })); }
    b.appendChild(rij);
    b.appendChild(el('p', 'hint', '🔴 pijltje = jij · 📍 = je markering · noorden is boven' + (m.mark ? ' · markering op ' + m.mark.x + ', ' + m.mark.z : '')));
    // wat er op het kompas staat: tik iets uit om het kompas rustiger te maken
    const ks = el('div', 'qsec');
    ks.appendChild(el('h4', '', 'Wat staat er op je kompas?'));
    const rij2 = el('div', 'btnrow');
    const uit = g.kompasUit || (g.kompasUit = {});
    for (const [key, tekst] of KOMPAS_KEUZES) {
      const k = el('button', 'btn small' + (uit[key] ? '' : ' active'), tekst);
      tap(k, () => {
        if (uit[key]) delete uit[key]; else uit[key] = 1;
        k.classList.toggle('active', !uit[key]);
        try { localStorage.setItem('graetblok.kompas', JSON.stringify(uit)); } catch (e) { /* geen opslag */ }
      });
      rij2.appendChild(k);
    }
    ks.appendChild(rij2);
    const alles = el('div', 'btnrow');
    for (const [tekst, aan] of [['Alles aan', true], ['Alles uit', false]]) {
      const k = el('button', 'btn small', tekst);
      tap(k, () => {
        for (const [key] of KOMPAS_KEUZES) { if (aan) delete uit[key]; else uit[key] = 1; }
        [...rij2.children].forEach((n) => n.classList.toggle('active', aan));
        try { localStorage.setItem('graetblok.kompas', JSON.stringify(uit)); } catch (e) { /* geen opslag */ }
      });
      alles.appendChild(k);
    }
    ks.appendChild(alles);
    ks.appendChild(el('p', 'hint', 'Groen = staat op het kompas. Op de kaart blijf je alles zien.'));
    b.appendChild(ks);
    this.open('kaart', '🗺️ Kaart', b, true);
  }

  // ---------- de fabrieksmachine ----------

  openFactory(m) {
    const g = this.g, send = (o) => g.net.send(Object.assign({ t: 'fabriek' }, o));
    const b = el('div', 'garage');
    b.appendChild(el('div', 'qsec', '<h4>' + (m.stroom ? '⚡ De machine heeft stroom' : '🔌 Geen stroom') + '</h4>' +
      '<p class="hint">' + (m.stroom ? 'Hij werkt door zolang er stroom is, ook als je even wegloopt.' : 'Zet een zonnepaneel, windmolen of volle batterij binnen acht blokken van de machine. Zonder stroom staat hij stil.') + '</p>' +
      (m.bezig ? '<p><b>Bezig:</b> ' + m.bezig[0] + ' · nog ' + m.bezig[1] + ' keer · ' + m.bezig[2] + '%</p>' : '<p class="hint">De machine doet nu niets.</p>')));
    if (m.klaar.length) {
      const ks = el('div', 'qsec');
      ks.appendChild(el('h4', '', 'Klaar'));
      ks.appendChild(el('p', '', m.klaar.map(([id, n]) => '<img class="mini" src="' + iconURL(id) + '"> ' + n + ' × ' + itemName(id)).join(' &nbsp; ')));
      const pak = el('button', 'btn small active', '📦 Alles pakken');
      tap(pak, () => send({ c: 'pak' }));
      ks.appendChild(pak);
      b.appendChild(ks);
    }
    const rs = el('div', 'qsec');
    rs.appendChild(el('h4', '', 'Wat moet de machine maken?'));
    for (const [k, name, wat, per, uit, n, tijd, kan] of m.recepten) {
      const r = el('div', 'drow');
      r.appendChild(el('span', '', '<img class="mini" src="' + iconURL(uit) + '"> <b>' + name + '</b> <small>' + per + ' × ' + wat + ' → ' + n + ' × ' + itemName(uit) + ' · ' + tijd + ' tellen · je hebt genoeg voor ' + kan + ' keer</small>'));
      const btns = el('span', 'drowbtns');
      for (const aantal of [1, 8, 64]) {
        const doe = Math.min(aantal, kan);
        const knop = el('button', 'btn small' + (kan > 0 ? ' active' : ''), aantal === 64 ? 'Alles' : aantal + '×');
        tap(knop, () => { if (doe > 0) send({ c: 'start', k, n: doe }); });
        btns.appendChild(knop);
      }
      r.appendChild(btns); rs.appendChild(r);
    }
    b.appendChild(rs);
    const ververs = el('button', 'btn small', '🔄 Kijk opnieuw');
    tap(ververs, () => send({ c: 'kijk' }));
    b.appendChild(ververs);
    this.open('fabriek', 'Fabrieksmachine', b, true);
  }

  // ---------- mijn werk ----------

  // Bovenaan welke dag het is en wat je vandaag moet doen; daaronder alle beroepen om uit te kiezen.
  openWork(m) {
    const g = this.g, send = (o) => g.net.send(Object.assign({ t: 'werk' }, o));
    const b = el('div', 'garage');
    const J = m.job ? WORK[m.job] : null;
    const kop = el('div', 'qsec');
    if (!J) kop.innerHTML = '<h4>Vandaag is het ' + m.dag + '</h4><p class="hint">Je hebt nog geen beroep. Kies er hieronder een: je krijgt elke werkdag drie opdrachten en elke week een weekopdracht. Het spel ziet zelf wanneer je ze af hebt.</p>';
    else {
      const pct = m.next ? Math.round(100 * m.xp / m.next[1]) : 100;
      kop.innerHTML = '<h4>' + J.icon + ' ' + J.name + ' · ' + m.rang + ' (level ' + m.level + ') ' + jobMedal(m.level) + '</h4>' +
        '<p class="hint">Vandaag is het ' + m.dag + ' · loon ' + m.loon + ' munten per opdracht · ' + m.xp + ' werkpunten' + (m.next ? ', bij ' + m.next[1] + ' word je ' + m.next[0] + ' (' + pct + '%)' : '') +
        (m.reeks > 1 ? ' · 🔥 ' + m.reeks + ' werkdagen op rij' : '') + '</p>' +
        (m.cadeau ? '<p class="hint">🎁 Op level ' + m.cadeau[2] + ' krijg je van je baas: ' + (m.cadeau[1] > 1 ? m.cadeau[1] + ' × ' : '') + itemName(m.cadeau[0]) + '.</p>' : '');
    }
    b.appendChild(kop);
    if (J) {
      const ts = el('div', 'qsec');
      if (m.vrij) ts.innerHTML = '<h4>🎈 Weekend!</h4><p class="hint">Op zaterdag en zondag ben je altijd vrij. Maandag staan er weer nieuwe opdrachten klaar.</p>';
      else {
        ts.appendChild(el('h4', '', 'Werk van vandaag'));
        const rij = ([tekst, v, n, klaar], extra) => ts.appendChild(el('div', 'drow', '<span>' + (klaar ? '✅ ' : '⬜ ') + tekst + ' <small>' + (klaar ? 'af' : v + ' / ' + n) + (extra || '') + '</small></span>'));
        for (const t of m.taken) rij(t);
        ts.appendChild(el('h4', '', 'Weekopdracht'));
        rij(m.week, m.week[3] ? '' : ' · ' + m.week[4] + ' munten');
      }
      b.appendChild(ts);
    }
    const ks = el('div', 'qsec');
    ks.appendChild(el('h4', '', J ? 'Ander beroep kiezen' : 'Kies een beroep'));
    for (const [k, xp] of m.jobs) {
      const W = WORK[k], lv = jobLevel(xp);
      const r = el('div', 'drow');
      r.appendChild(el('span', '', W.icon + ' <b>' + W.name + '</b> <small>' + JOB_RANKS[lv - 1][0] + ' · level ' + lv + ' ' + jobMedal(lv) + ' · ' + jobSalary(lv) + ' munten per opdracht</small>'));
      const btns = el('span', 'drowbtns'), kies = el('button', 'btn small' + (k === m.job ? '' : ' active'), k === m.job ? 'Dit doe je nu' : 'Kiezen');
      tap(kies, () => { if (k !== m.job) send({ c: 'kies', job: k }); });
      btns.appendChild(kies); r.appendChild(btns); ks.appendChild(r);
    }
    ks.appendChild(el('p', 'hint', 'Je kunt altijd wisselen: elk beroep houdt zijn eigen level. In je werkkleding zie je jezelf als je de camera omzet (📷).'));
    b.appendChild(ks);
    this.open('werk', 'Mijn werk', b, true);
  }

  // ---------- de marktkraam van je boerderij ----------

  // Bovenaan je boerderijlevel en titel, dan wat je kunt verkopen, wat je kunt kopen en de missies.
  openFarm(m) {
    const g = this.g, send = (o) => g.net.send(Object.assign({ t: 'farm' }, o));
    const b = el('div', 'garage');
    const pct = m.next ? Math.round(100 * m.xp / m.next[1]) : 100;
    b.appendChild(el('div', 'qsec', '<h4>🌾 Level ' + m.level + ' · ' + m.titel + '</h4>' +
      '<p class="hint">' + m.xp + ' boerderijpunten' + (m.next ? ' · bij ' + m.next[1] + ' word je ' + m.next[0] + ' (' + pct + '%)' : ' · hoger kan niet!') +
      ' · <img class="mini" src="' + iconURL(I.munt) + '"> ' + m.munten + ' munten</p>' +
      '<p class="hint">Verkocht: ' + m.verkocht + ' · Verdiend: ' + m.verdiend + ' munten · Magische gewassen ontdekt: ' + m.magie.length + ' van de 10</p>'));
    // verkopen
    const vs = el('div', 'qsec');
    vs.appendChild(el('h4', '', 'Verkopen'));
    if (!m.sell.length) vs.appendChild(el('p', 'hint', 'Je hebt nu niets om te verkopen. Plant iets op een akker (wijs de akker aan met bijvoorbeeld tarwe of een wortel in je hand), wacht tot het rijp is en oogst het.'));
    else {
      let tot = 0;
      for (const [id, n, prijs] of m.sell) {
        tot += n * prijs;
        const r = el('div', 'drow');
        r.appendChild(el('span', '', '<img class="mini" src="' + iconURL(id) + '"> <b>' + n + ' × ' + itemName(id) + '</b> <small>' + (prijs >= 1 ? prijs + ' munten per stuk' : Math.round(1 / prijs) + ' voor 1 munt') + '</small>'));
        const btns = el('span', 'drowbtns'), sell = el('button', 'btn small active', 'Verkoop (' + Math.floor(n * prijs + 1e-9) + ')');
        tap(sell, () => send({ c: 'sell', id }));
        btns.appendChild(sell); r.appendChild(btns); vs.appendChild(r);
      }
      const all = el('button', 'btn small active', '💰 Alles verkopen (ongeveer ' + Math.floor(tot) + ' munten)');
      tap(all, () => send({ c: 'sellAll' }));
      vs.appendChild(all);
    }
    b.appendChild(vs);
    // kopen
    const ks = el('div', 'qsec');
    ks.appendChild(el('h4', '', 'Kopen'));
    for (const [k, id, n, prijs, vanaf] of m.shop) {
      const open = m.level >= vanaf;
      const r = el('div', 'drow');
      r.appendChild(el('span', '', '<img class="mini" src="' + iconURL(id) + '"> <b>' + (n > 1 ? n + ' × ' : '') + itemName(id) + '</b>' + (open ? '' : ' <small>🔒 vanaf level ' + vanaf + '</small>')));
      const btns = el('span', 'drowbtns'), buy = el('button', 'btn small' + (open && m.munten >= prijs ? ' active' : ''), prijs + ' munten');
      tap(buy, () => { if (open) send({ c: 'buy', k }); });
      btns.appendChild(buy); r.appendChild(btns); ks.appendChild(r);
    }
    ks.appendChild(el('p', 'hint', 'De tractor ploegt gras om tot akker, de zaaimachine plant wat je bij je hebt en de combine oogst: telkens een strook van drie breed terwijl je rijdt. Bij een sproeier of water groeit alles twee keer zo snel.'));
    b.appendChild(ks);
    // missies
    const ms = el('div', 'qsec');
    ms.appendChild(el('h4', '', 'Missies'));
    for (const [tekst, nu, n, munten, klaar] of m.missies) ms.appendChild(el('div', 'drow', '<span>' + (klaar ? '✅ ' : '⬜ ') + tekst + ' <small>' + (klaar ? 'gehaald' : nu + ' / ' + n + ' · beloning ' + munten + ' munten') + '</small></span>'));
    b.appendChild(ms);
    this.open('farm', 'Mijn boerderij', b, true);
  }

  // ---------- het Dierenboek ----------

  // Alle dieren op nummer: wat je al hebt uitgebroed zie je met naam en ei, de rest is een
  // donker ei met een vraagteken. Bovenaan staan de dieren die je hebt, met knoppen.
  openZoo() {
    const g = this.g, zoo = g.zoo || { book: {}, pets: [], titel: '' };
    const b = el('div', 'zoo');
    const have = Object.keys(zoo.book).length;
    const next = ZOO_REWARDS.find((r) => have < r.n);
    b.appendChild(el('div', 'qsec', '<h4>🐾 ' + have + ' van de ' + ANIMAL_LIST.length + ' dieren' + (zoo.titel ? ' · ' + zoo.titel : '') + '</h4>' +
      '<p class="hint">' + (next ? 'Bij ' + next.n + ' dieren krijg je ' + next.munten + ' munten en de titel "' + next.titel + '".' : 'Je hebt ze allemaal! Jij bent de Ultimate Collector.') + '</p>'));

    // jouw dieren
    const mine = el('div', 'qsec');
    const out = zoo.pets.filter((d) => d.mode !== 'boek').length;
    mine.appendChild(el('h4', '', 'Jouw dieren (' + out + ' van de ' + MAX_OUT + ' lopen mee)'));
    if (!zoo.pets.length) mine.appendChild(el('p', 'hint', 'Je hebt nog geen dieren. Koop een ei bij de boer of de marktkoopman in een dorp, maak een broedmachine op de werkbank (3 ijzerstaven, 2 glas en een fakkel) en leg het ei erin.'));
    for (const d of zoo.pets) {
      const a = ANIMALS[d.a];
      if (!a) continue;
      const R = RARITY[a.rarity], row = el('div', 'drow');
      const waar = d.mode === 'boek' ? 'in het boek' : d.world !== g.worldId ? 'in de ' + WORLDS[d.world].name : d.mode === 'stay' ? 'wacht' : 'loopt mee';
      row.appendChild(el('span', '', '<img class="zegg" src="' + animalEgg(a) + '"> <b>' + (d.name || a.name) + '</b>' + (d.name ? ' – ' + a.name : '') +
        ' <span class="zrar" style="color:' + R.col + '">' + R.name + '</span>' + (d.sh ? ' <span class="zrar" style="color:' + SHINY[d.sh].col + '">✨ ' + SHINY[d.sh].name + '</span>' : '') + ' <small>(' + waar + ')</small>'));
      const btns = el('span', 'drowbtns');
      const name = el('button', 'btn small', 'Naam');
      tap(name, () => { const n = window.prompt('Hoe heet je ' + a.name.toLowerCase() + '?', d.name || ''); if (n !== null) g.net.send({ t: 'zoo', c: 'name', uid: d.uid, name: n }); });
      btns.appendChild(name);
      const call = el('button', 'btn small', 'Roep');
      tap(call, () => g.net.send({ t: 'zoo', c: 'out', uid: d.uid }));
      btns.appendChild(call);
      if (d.mode !== 'boek') { const put = el('button', 'btn small', 'Berg op'); tap(put, () => g.net.send({ t: 'zoo', c: 'in', uid: d.uid })); btns.appendChild(put); }
      row.appendChild(btns);
      mine.appendChild(row);
    }
    b.appendChild(mine);

    // het boek zelf
    const book = el('div', 'qsec');
    book.appendChild(el('h4', '', 'Alle dieren'));
    const grid = el('div', 'zgrid');
    for (const a of ANIMAL_LIST) {
      const rec = zoo.book[a.key], R = RARITY[a.rarity];
      const card = el('div', 'zcard' + (rec ? '' : ' dark'));
      if (rec) card.style.borderColor = R.col;
      let sh = '';
      if (rec) for (const s of SHINIES) if (rec[s.key]) sh += '<span style="color:' + s.col + '">✨' + rec[s.key] + '</span>';
      card.innerHTML = '<img src="' + animalEgg(a, !rec) + '"><div class="znr">' + a.nr + '</div>' +
        '<div class="zname">' + (rec ? a.name : '???') + '</div>' +
        (rec ? '<div class="zrar" style="color:' + R.col + '">' + R.name + '</div><div class="zcnt">' + rec.n + '× ' + sh + '</div>' : '<div class="zrar">' + (EGG_KINDS[a.egg] || { name: 'Van de Uitvinder' }).name + '</div>');
      grid.appendChild(card);
    }
    book.appendChild(grid);
    b.appendChild(book);

    // de eieren en de kansen
    let eggs = '<h4>De eieren</h4>';
    for (const k of EGG_ORDER) { const E = EGG_KINDS[k]; eggs += '<p><img class="zegg" src="' + eggURL(E.c, E.c2, E.pat) + '"> <b>' + E.name + '</b> – ' + E.prijs + ' munten, ' + E.min + (E.min === 1 ? ' minuut' : ' minuten') + ' broeden. ' + E.hint + '</p>'; }
    eggs += '<p class="hint">Kansen: ' + RARITIES.map((r) => '<span style="color:' + r.col + '">' + r.name + ' ' + String(r.p).replace('.', ',') + '%</span>').join(' · ') + '</p>';
    eggs += '<p class="hint">Shiny: ' + SHINIES.map((s) => '<span style="color:' + s.col + '">' + s.name + ' ' + String(s.p).replace('.', ',') + '%</span>').join(' · ') + '</p>';
    b.appendChild(el('div', 'qsec help', eggs));
    const keep = this.modal === 'zoo' ? $('modalBody').scrollTop : 0;
    this.open('zoo', 'Dierenboek', b, true);
    $('modalBody').scrollTop = keep;
  }

  refreshZoo() { if (this.modal === 'zoo') this.openZoo(); }

  refreshDragon() { if (this.modal === 'dragon') this.openDragon(this.dragonUid); if (this.modal === 'quest') this.openQuest(); }

  openDeath() {
    const b = el('div', 'dialog');
    b.appendChild(el('p', '', 'Je bent verslagen... maar helden geven nooit op!'));
    b.appendChild(el('p', 'hint', 'Je wordt wakker bij je bed (of bij het ruimteschip). Je houdt al je spullen.'));
    const ok = el('button', 'btn big', 'Opnieuw proberen');
    tap(ok, () => { this.modal = null; $('modal').classList.add('hidden'); this.g.net.send({ t: 'respawn' }); });
    b.appendChild(ok);
    this.open('death', 'Oei!', b, false);
  }

  openPause() {
    const g = this.g, S = g.settings;
    const b = el('div', 'pause');
    const slider = (label, key, min, max, step, fmt) => {
      const row = el('label', 'srow');
      const val = el('span', 'sval', fmt(S[key]));
      const inp = el('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = S[key];
      inp.addEventListener('input', () => { S[key] = parseFloat(inp.value); val.textContent = fmt(S[key]); g.applySettings(); });
      row.appendChild(el('span', 'slabel', label)); row.appendChild(inp); row.appendChild(val);
      b.appendChild(row);
    };
    const toggle = (label, key) => {
      const x = el('button', 'btn small' + (S[key] ? ' active' : ''), label + ': ' + (S[key] ? 'aan' : 'uit'));
      tap(x, () => { S[key] = !S[key]; g.applySettings(); x.className = 'btn small' + (S[key] ? ' active' : ''); x.textContent = label + ': ' + (S[key] ? 'aan' : 'uit'); });
      return x;
    };
    const go = el('button', 'btn big', '▶ Verder spelen');
    tap(go, () => this.close());
    b.appendChild(go);
    const home = el('button', 'btn home', '🏠 Terug naar het beginscherm');
    tap(home, () => g.toMenu());
    b.appendChild(home);
    slider('Kijkafstand', 'view', 2, 8, 1, (v) => v + ' stukken');
    slider('Geluid', 'volume', 0, 1, 0.05, (v) => Math.round(v * 100) + '%');
    slider('Regen en wind', 'amb', 0, 1, 0.05, (v) => Math.round(v * 100) + '%');
    slider('Kijksnelheid', 'sens', 0.4, 2.5, 0.1, (v) => v.toFixed(1) + '×');
    const row = el('div', 'btnrow');
    row.appendChild(toggle('Muziek', 'music'));
    row.appendChild(toggle('Geluidseffecten', 'sfx'));
    row.appendChild(toggle('Vanzelf springen', 'autoJump'));
    row.appendChild(toggle('Scherpte aanpassen', 'dynRes'));
    row.appendChild(toggle('Mooie graphics (proef)', 'hq'));
    b.appendChild(row);
    // op iPad en iPhone speelt de muziek via de mediaspeler van het apparaat (dat hapert niet)
    if (g.sound.tag) {
      const rowS = el('div', 'btnrow');
      rowS.appendChild(toggle('Muziek via de speler', 'musicTag'));
      b.appendChild(rowS);
    }
    const row2 = el('div', 'btnrow');
    const save = el('button', 'btn small', '💾 Nu opslaan');
    tap(save, () => { g.net.send({ t: 'save' }); this.toast('Opgeslagen!', 'good'); });
    row2.appendChild(save);
    const nw = el('button', 'btn small danger', 'Nieuwe wereld beginnen');
    tap(nw, () => { if (window.confirm('Weet je het zeker? Je hele wereld en al je spullen worden gewist!')) { this.close(); g.newWorld(); } });
    row2.appendChild(nw);
    b.appendChild(row2);
    b.appendChild(el('p', 'hint', 'Het spel slaat vanzelf op. ' + (g.fpsText || '')));
    if (g.perf && g.perf.text) b.appendChild(el('p', 'hint', g.perf.text));
    // een regel over het geluid, die zichzelf bijwerkt zolang dit venster open staat
    const diag = el('p', 'hint', g.audioText());
    b.appendChild(diag);
    const tip = g.audioTip();
    if (tip) b.appendChild(el('p', 'hint', tip));
    const tick = () => {
      if (this.modal !== 'pause' || !diag.isConnected) return;
      diag.textContent = g.audioText();
      setTimeout(tick, 500);
    };
    setTimeout(tick, 500);
    this.open('pause', 'Pauze', b, false);
  }
}
