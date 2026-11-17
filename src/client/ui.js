// Alles op het scherm dat geen 3D is: hartjes, rugzak, maken, opdrachten, menu's.
import { RANKS, HOTBAR, INV_SIZE } from '../shared/constants.js';
import { B, BLOCKS } from '../shared/blocks.js';
import { ITEMS, I, RECIPES, GROUPS, GROUP_NAMES, matches, itemName } from '../shared/items.js';
import { WORLDS, WORLD_ORDER, CRASH } from '../shared/worlds.js';
import { DRAGONS, dragonStage, STAGE_NAMES } from '../shared/mobs.js';
import { iconURL, eggURL } from './textures.js';
import { KERMIS_GAMES } from '../shared/rides.js';
import { VEHICLES, VEH_COLORS, UPGRADES, UPGRADE_ORDER, vehStats } from '../shared/vehicles.js';
import { ANIMALS, ANIMAL_LIST, EGG_KINDS, EGG_ORDER, RARITY, RARITIES, SHINIES, SHINY, ZOO_REWARDS, MAX_OUT } from '../shared/animals.js';

const EGG_PATS = ['vlek', 'blad', 'golf', 'ster', 'barst', 'streep'];
const hexCol = (n) => '#' + (n | 0).toString(16).padStart(6, '0');
// het ei van één dier: de kleuren van het dier zelf, met een patroon dat bij zijn nummer hoort
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
    const W = strip.clientWidth || 300;
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
      this.cmpVeld = el('span', 'cship', '✈️'); strip.appendChild(this.cmpVeld);
    }
    for (let i = 0; i < 4; i++) place(this.cmp[i], i * Math.PI / 2);
    let extra = '';
    // het ruimteschip (alleen in de groene wereld): het raketje wijst altijd de weg terug.
    // Ligt het schip achter je, dan staat het raketje aan de rand van het kompas.
    const ship = worldId === 'groen';
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
    for (const [node, kinds, icon] of [[this.cmpDorp, [0], '🏠'], [this.cmpBurcht, [1, 2], '🏰'], [this.cmpBaan, [4], '🏁'], [this.cmpPark, [5], '🎡'], [this.cmpStad, [6], '🏙️'], [this.cmpVeld, [7], '✈️']]) {
      let best = null, bd = 1e9;
      if (sites) for (const st of sites) { if (!kinds.includes(st[0])) continue; const d = Math.hypot(st[1] - pos.x, st[2] - pos.z); if (d < bd) { bd = d; best = st; } }
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
    if (mk) {
      const dx = mk.x - pos.x, dz = mk.z - pos.z;
      let rel = Math.atan2(dx, -dz) - heading;
      while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
      const c = Math.max(-1.7, Math.min(1.7, rel));
      this.cmpMark.style.display = '';
      this.cmpMark.style.left = (W / 2 + (c / 1.75) * (W / 2)) + 'px';
      extra += '  ◆ ' + Math.round(Math.hypot(dx, dz)) + ' m';
    } else this.cmpMark.style.display = 'none';
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
        (rec ? '<div class="zrar" style="color:' + R.col + '">' + R.name + '</div><div class="zcnt">' + rec.n + '× ' + sh + '</div>' : '<div class="zrar">' + EGG_KINDS[a.egg].name + '</div>');
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
