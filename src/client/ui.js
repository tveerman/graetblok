// Alles op het scherm dat geen 3D is: hartjes, rugzak, maken, opdrachten, menu's.
import { RANKS, HOTBAR, INV_SIZE } from '../shared/constants.js';
import { B, BLOCKS } from '../shared/blocks.js';
import { ITEMS, RECIPES, GROUPS, GROUP_NAMES, matches, itemName } from '../shared/items.js';
import { WORLDS, WORLD_ORDER, CRASH } from '../shared/worlds.js';
import { DRAGONS, dragonStage, STAGE_NAMES } from '../shared/mobs.js';
import { iconURL } from './textures.js';

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
      s.appendChild(el('img')); s.appendChild(el('span', 'cnt'));
      tap(s, () => { g.select(i); });
      hb.appendChild(s); this.hot.push(s);
    }
    tap($('btnInv'), () => this.toggleInventory());
    tap($('btnQuest'), () => this.modal === 'quest' ? this.close() : this.openQuest());
    tap($('btnCam'), () => g.toggleCam());
    tap($('btnMenu'), () => this.modal === 'pause' ? this.close() : this.openPause());
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
      node.classList.toggle('sel', i === g.sel);
    }
    const s = g.inv[g.sel];
    const nm = $('heldName');
    const name = s ? itemName(s[0]) : '';
    if (nm.textContent !== name) { nm.textContent = name; nm.classList.remove('show'); void nm.offsetWidth; if (name) nm.classList.add('show'); }
    if (this.modal === 'inv') this.renderInventory();
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
  frame(yaw, pos, worldId) {
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

  openInventory(station) {
    this.station = station || '';
    this.pick = -1;
    this.open('inv', 'Rugzak en maken', el('div'), true);
    this.renderInventory();
  }

  count(need) { let n = 0; for (const s of this.g.inv) if (s && matches(need, s[0])) n += s[1]; return n; }

  renderInventory() {
    const g = this.g;
    const body = $('modalBody');
    const keepScroll = body.querySelector('.recipes') ? body.querySelector('.recipes').scrollTop : 0;
    body.innerHTML = '';
    const wrap = el('div', 'invwrap');
    // links: de rugzak
    const left = el('div', 'invleft');
    const info = el('div', 'invinfo', this.pick >= 0 && g.inv[this.pick] ? '<b>' + itemName(g.inv[this.pick][0]) + '</b> – tik op een ander vakje om te verplaatsen' : 'Tik op een vakje en dan op een ander vakje om spullen te verplaatsen.');
    left.appendChild(info);
    const grid = el('div', 'invgrid');
    const order = [];
    for (let i = HOTBAR; i < INV_SIZE; i++) order.push(i);
    for (let i = 0; i < HOTBAR; i++) order.push(i);
    for (const i of order) {
      const s = g.inv[i];
      const node = el('div', 'slot' + (i < HOTBAR ? ' hot' : '') + (i === this.pick ? ' pick' : ''));
      if (s) { const img = el('img'); img.src = iconURL(s[0]); node.appendChild(img); node.appendChild(el('span', 'cnt', s[1] > 1 ? s[1] : '')); }
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
    wrap.appendChild(left);

    // rechts: maken
    const right = el('div', 'invright');
    const nearW = g.nearBlock(B.werkbank), nearO = g.nearBlock(B.oven), nearK = g.nearBlock(B.kampvuur);
    const head = el('div', 'rhead');
    head.appendChild(el('span', '', '<b>Maken</b> ' + (nearW ? '<span class="ok">🔨 werkbank</span> ' : '') + (nearO ? '<span class="ok">🔥 oven</span>' : '')));
    const flt = el('button', 'btn small' + (this.onlyCan ? ' active' : ''), this.onlyCan ? '✔ Wat ik kan maken' : 'Alles');
    tap(flt, () => { this.onlyCan = !this.onlyCan; this.renderInventory(); });
    head.appendChild(flt);
    right.appendChild(head);
    const list = el('div', 'recipes');
    const rows = [];
    for (const r of RECIPES) {
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
        ing.appendChild(el('span', 'ingr' + (h >= n ? '' : ' lack'), '<img src="' + iconURL(id) + '">' + Math.min(h, 999) + '/' + n + ' ' + (typeof need === 'string' ? GROUP_NAMES[need] : itemName(need))));
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
    if (!rows.length) list.appendChild(el('div', 'hint', 'Je kunt nu niets maken. Verzamel meer spullen!'));
    right.appendChild(list);
    wrap.appendChild(right);
    body.appendChild(wrap);
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
    b.appendChild(el('p', 'hint', stage < 2 ? 'Draken lusten bessen, appels en vlees. Hoe meer eten, hoe groter!' : 'Je draak helpt je in gevechten en je kunt op hem vliegen.'));
    this.open('dragon', '🐉 ' + d.name, b, false);
  }

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
    slider('Kijksnelheid', 'sens', 0.4, 2.5, 0.1, (v) => v.toFixed(1) + '×');
    const row = el('div', 'btnrow');
    row.appendChild(toggle('Muziek', 'music'));
    row.appendChild(toggle('Geluidseffecten', 'sfx'));
    row.appendChild(toggle('Vanzelf springen', 'autoJump'));
    row.appendChild(toggle('Scherpte aanpassen', 'dynRes'));
    b.appendChild(row);
    const row2 = el('div', 'btnrow');
    const save = el('button', 'btn small', '💾 Nu opslaan');
    tap(save, () => { g.net.send({ t: 'save' }); this.toast('Opgeslagen!', 'good'); });
    row2.appendChild(save);
    const nw = el('button', 'btn small danger', 'Nieuwe wereld beginnen');
    tap(nw, () => { if (window.confirm('Weet je het zeker? Je hele wereld en al je spullen worden gewist!')) { this.close(); g.newWorld(); } });
    row2.appendChild(nw);
    b.appendChild(row2);
    b.appendChild(el('p', 'hint', 'Het spel slaat vanzelf op. ' + (g.fpsText || '')));
    // een regel over het geluid, die zichzelf bijwerkt zolang dit venster open staat
    const diag = el('p', 'hint', g.audioText());
    b.appendChild(diag);
    const tick = () => {
      if (this.modal !== 'pause' || !diag.isConnected) return;
      diag.textContent = g.audioText();
      setTimeout(tick, 500);
    };
    setTimeout(tick, 500);
    this.open('pause', 'Pauze', b, false);
  }
}
