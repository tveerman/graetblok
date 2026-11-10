// De spelserver van Graet Blok.
//
// De server is de baas over de wereld: blokken, rugzak, monsters, draken en opslaan.
// Hij praat ALLEEN via berichten met het spel (de client). Nu draait hij in een
// Web Worker in dezelfde browser; later kan precies deze code op een aparte computer
// draaien, zodat vrienden over de hele wereld kunnen meespelen. Daarvoor hoef je
// alleen een andere "verbinding" (conn) en "opslag" (storage) te geven.
//
//   conn    = { send(bericht, transfer), onmessage }   (zie worker.js)
//   storage = { get, set, del, entries, clear }         (zie storage.js)

import { CH, TICK_MS, INV_SIZE, HOTBAR, DAY_LENGTH, DAY_FRAC, RANKS, SECRET_RANK, chunkKey, clamp, dayPhase, isNight, xpNeed } from '../shared/constants.js';
import { B, BLOCKS, B_SHAPE, EGG_TYPE, PORTAL_TO, PORTAL_BLOCK, SHAPE_LIQUID, BED_DIRS, bedFoot, bedHead, bedPart, isBed } from '../shared/blocks.js';
import { I, ITEMS, RECIPES, matches, maxStack, itemName } from '../shared/items.js';
import { WORLDS, WORLD_ORDER, SPAWN } from '../shared/worlds.js';
import { hash3, mulberry32 } from '../shared/noise.js';
import { ServerWorld } from './world.js';
import { QUESTS, computerLines } from './quests.js';
import { entityMethods } from './entities.js';
import { npcMethods } from './npcs.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const SAVE_FIELDS = ['world', 'x', 'y', 'z', 'yaw', 'hp', 'xp', 'level', 'inv', 'sel', 'flags', 'q', 'dragons', 'pets', 'spawn', 'look', 'kills'];

export class GameServer {
  constructor(storage) {
    this.storage = storage;
    this.players = new Map();     // conn -> speler
    this.worlds = {};
    this.meta = null;
    this.ready = false;
    this.acc = { sec: 0, snap: 0, save: 0 };
    this.rnd = mulberry32((Math.random() * 4294967296) >>> 0);
  }

  newMeta() {
    return { v: 1, seed: (Math.random() * 2147483647) | 0, time: DAY_LENGTH * 0.05, trees: {}, bossDead: {}, portals: [], eggs: {}, nextId: 1,
      weather: {} };
  }

  async init() {
    let meta = await this.storage.get('meta');
    if (!meta) meta = this.newMeta();
    this.meta = meta;
    const per = {};
    for (const [k, v] of await this.storage.entries('e/')) {
      const parts = k.split('/');
      (per[parts[1]] = per[parts[1]] || new Map()).set(Number(parts[2]), new Map(v));
    }
    for (const w of WORLD_ORDER) this.worlds[w] = new ServerWorld(w, meta.seed, per[w]);
    this.ready = true;
    this.last = now();
    if (!this.timer) this.timer = setInterval(() => { try { this.tick(); } catch (e) { console.error('server tick', e); } }, TICK_MS);
  }

  async reset() {
    this.players.clear();
    await this.storage.clear();
    this.meta = null;
    await this.init();
  }

  // ---------- verbindingen ----------

  connect(conn) {
    conn.onmessage = (m) => {
      try { this.handle(conn, m); } catch (e) { console.error('server fout bij', m && m.t, e); }
    };
  }

  handle(conn, m) {
    if (m.t === 'hello') { this.onHello(conn, m); return; }
    const p = this.players.get(conn);
    if (!p) return;
    const fn = this['on_' + m.t];
    if (fn) fn.call(this, p, m);
  }

  async onHello(conn, m) {
    if (m.reset) await this.reset();
    const name = String(m.name || 'Speler').slice(0, 20);
    const rec = await this.storage.get('p/' + name);
    const p = {
      conn, name, id: this.meta.nextId++,
      world: 'groen', x: SPAWN.x, y: -1, z: SPAWN.z, yaw: Math.PI, pitch: 0,
      hp: 20, xp: 0, level: 1, inv: new Array(INV_SIZE).fill(null), sel: 0,
      flags: {}, q: 0, dragons: [], pets: [], spawn: null, look: m.look || {}, kills: 0,
      view: clamp(m.view | 0 || 4, 2, 8), sent: new Set(), queue: [], known: new Set(),
      ccx: 1e9, ccz: 1e9, mount: 0, dead: false, lastHurt: -99, atkCd: 0, shootCd: 0, regen: 0, isNew: !rec, debug: !!m.debug,
    };
    if (rec) for (const f of SAVE_FIELDS) if (rec[f] !== undefined) p[f] = rec[f];
    if (m.look) p.look = m.look;
    if (!WORLDS[p.world]) p.world = 'groen';
    if (p.hp <= 0) {
      // het spel werd afgesloten terwijl je verslagen was: begin weer bij je bed of het ruimteschip
      p.hp = this.maxHp(p);
      const s = p.spawn && WORLDS[p.spawn.w] ? p.spawn : { w: 'groen', x: SPAWN.x, y: -1, z: SPAWN.z };
      p.world = s.w; p.x = s.x; p.y = s.y; p.z = s.z;
      for (const d of p.dragons) if (d.mode === 'follow') { d.world = s.w; d.x = s.x; d.y = Math.max(s.y, 1) + 1; d.z = s.z + 1.5; d.far = 1; }
    }
    this.players.set(conn, p);
    this.enterWorld(p, true);
  }

  send(p, msg, transfer) { p.conn.send(msg, transfer); }
  broadcast(wid, msg) { for (const p of this.players.values()) if (p.world === wid) p.conn.send(msg); }
  toast(p, text, kind = '') { this.send(p, { t: 'toast', text, kind }); }
  fx(wid, kind, x, y, z, a = 0) { this.broadcast(wid, { t: 'fx', k: kind, x, y, z, a }); }

  maxHp(p) { let n = 0; for (const k in this.meta.trees) if (this.meta.trees[k]) n++; return 20 + n * 4; }
  rank(p) {
    const t = this.meta.trees;
    if (p.flags.oer && WORLD_ORDER.every((k) => t[k])) return SECRET_RANK;
    let r = RANKS[0].name;
    for (const k of RANKS) if (p.level >= k.level) r = k.name;
    return r;
  }
  armor(p) { let a = 0; for (const s of p.inv) if (s && ITEMS[s.id] && ITEMS[s.id].armor > a) a = ITEMS[s.id].armor; return a; }

  enterWorld(p, first) {
    const w = this.worlds[p.world];
    if (p.y < 0) {
      const spot = this.findSafe(w, Math.floor(p.x), Math.floor(p.z));
      p.x = spot.x + 0.5; p.y = spot.y; p.z = spot.z + 0.5;
    }
    p.sent.clear(); p.queue.length = 0; p.known.clear(); p.ccx = 1e9; p.mount = 0;
    this.send(p, {
      t: first ? 'welcome' : 'world', id: p.id, name: p.name, world: p.world,
      x: p.x, y: p.y, z: p.z, yaw: p.yaw, time: this.meta.time, trees: this.meta.trees, look: p.look,
      isNew: !!p.isNew, saved: !!this.storage.persistent,
    });
    p.isNew = false;
    this.send(p, { t: 'weather', k: this.weatherOf(p.world), now: 1 });
    this.sendInv(p); this.sendStats(p); this.sendDragons(p);
    this.spawnOwned(p);
    p.flags['visit_' + p.world] = 1;
    this.checkQuests(p, true);
  }

  // ---------- rugzak ----------

  // een vakje is [id, aantal] of, voor gereedschap dat kan slijten, [id, aantal, hoe heel het nog is]
  sendInv(p) { this.send(p, { t: 'inv', s: p.inv.map((s) => (s ? (s.d === undefined ? [s.id, s.n] : [s.id, s.n, s.d]) : 0)), sel: p.sel }); }
  sendStats(p) {
    this.send(p, { t: 'stats', hp: p.hp, max: this.maxHp(p), xp: p.xp, need: xpNeed(p.level), level: p.level, rank: this.rank(p), armor: this.armor(p), trees: this.meta.trees });
  }

  count(p, need) { let n = 0; for (const s of p.inv) if (s && matches(need, s.id)) n += s.n; return n; }

  give(p, id, n) {
    const max = maxStack(id);
    const dur = id >= 256 && ITEMS[id] ? ITEMS[id].dur : 0;      // nieuw gereedschap is helemaal heel
    for (let i = 0; i < INV_SIZE && n > 0; i++) {
      const s = p.inv[i];
      if (s && s.id === id && s.n < max) { const a = Math.min(n, max - s.n); s.n += a; n -= a; }
    }
    for (let i = 0; i < INV_SIZE && n > 0; i++) {
      if (!p.inv[i]) {
        const a = Math.min(n, max);
        p.inv[i] = dur ? { id, n: a, d: dur } : { id, n: a };
        n -= a;
      }
    }
    if (EGG_TYPE[id]) p.flags.egg = 1;
    if (id === I.oerwapen) p.flags.oer = 1;
    return n;
  }

  // Gereedschap slijt bij elk blok dat je ermee weghakt en bij elke klap. Bij 0 is het kapot.
  wear(p, n = 1) {
    const s = p.inv[p.sel], it = s && ITEMS[s.id];
    if (!it || !it.dur) return false;
    if (s.d === undefined || s.d > it.dur) s.d = it.dur;       // gereedschap uit een oudere versie is nog heel
    s.d -= n;
    if (s.d <= 0) {
      p.inv[p.sel] = null;
      this.send(p, { t: 'toolBroke', id: s.id, name: it.name });
    } else if (s.d === Math.ceil(it.dur * 0.1)) this.toast(p, 'Je ' + it.name.toLowerCase() + ' is bijna kapot!', 'warn');
    return true;
  }

  take(p, need, n) {
    for (let i = INV_SIZE - 1; i >= 0 && n > 0; i--) {
      const s = p.inv[i];
      if (s && matches(need, s.id)) {
        const a = Math.min(n, s.n); s.n -= a; n -= a;
        if (s.n <= 0) p.inv[i] = null;
      }
    }
    return n === 0;
  }

  giveLoot(p, id, n, say = true) {
    const left = this.give(p, id, n);
    if (say && n - left > 0) this.send(p, { t: 'got', id, n: n - left });
    if (left > 0) this.toast(p, 'Je rugzak is vol!', 'warn');
  }

  addXp(p, n) {
    if (n <= 0) return;
    p.xp += n;
    const oldRank = this.rank(p);
    let up = false;
    while (p.xp >= xpNeed(p.level)) { p.xp -= xpNeed(p.level); p.level++; up = true; }
    if (up) {
      this.fx(p.world, 'levelup', p.x, p.y + 1, p.z);
      this.toast(p, 'Level ' + p.level + '!', 'good');
      const r = this.rank(p);
      if (r !== oldRank) this.toast(p, 'Nieuwe rang: ' + r + '!', 'rank');
    }
    this.sendStats(p);
  }

  on_sel(p, m) { p.sel = clamp(m.i | 0, 0, HOTBAR - 1); }

  on_swap(p, m) {
    const a = m.a | 0, b = m.b | 0;
    if (a < 0 || b < 0 || a >= INV_SIZE || b >= INV_SIZE || a === b) return;
    const sa = p.inv[a], sb = p.inv[b];
    if (sa && sb && sa.id === sb.id && sb.n < maxStack(sb.id)) {
      const mv = Math.min(sa.n, maxStack(sb.id) - sb.n);
      sb.n += mv; sa.n -= mv;
      if (sa.n <= 0) p.inv[a] = null;
    } else { p.inv[a] = sb; p.inv[b] = sa; }
    this.sendInv(p);
  }

  on_trash(p, m) {
    const a = m.a | 0;
    if (a >= 0 && a < INV_SIZE) { p.inv[a] = null; this.sendInv(p); }
  }

  nearBlock(p, id, r = 5) {
    const w = this.worlds[p.world];
    const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
    for (let x = px - r; x <= px + r; x++) for (let z = pz - r; z <= pz + r; z++) for (let y = py - 3; y <= py + 4; y++) {
      if (w.get(x, y, z) === id) return true;
    }
    return false;
  }

  on_craft(p, m) {
    const r = RECIPES[m.id | 0];
    if (!r) return;
    if (r.needs && !this.meta.trees[r.needs]) { this.toast(p, 'Herstel eerst ' + WORLDS[r.needs].tree.name + '.', 'warn'); return; }
    if (r.station === 'werkbank' && !this.nearBlock(p, B.werkbank)) { this.toast(p, 'Hiervoor moet je bij een werkbank staan.', 'warn'); return; }
    if (r.station === 'oven' && !this.nearBlock(p, B.oven) && !(r.out === I.gebraden_vlees && this.nearBlock(p, B.kampvuur))) { this.toast(p, 'Hiervoor moet je bij een oven staan.', 'warn'); return; }
    for (const [need, n] of r.in) if (this.count(p, need) < n) { this.toast(p, 'Je hebt niet genoeg spullen.', 'warn'); return; }
    for (const [need, n] of r.in) this.take(p, need, n);
    const left = this.give(p, r.out, r.n);
    if (left > 0) this.toast(p, 'Je rugzak is vol!', 'warn');
    const key = r.out < 256 ? BLOCKS[r.out].key : ITEMS[r.out].key;
    if (!p.flags['made_' + key]) { p.flags['made_' + key] = 1; this.addXp(p, 4); }
    this.send(p, { t: 'crafted', id: r.out });
    this.sendInv(p);
    this.checkQuests(p);
  }

  on_eat(p) {
    const s = p.inv[p.sel];
    if (!s || !ITEMS[s.id] || !ITEMS[s.id].food) return;
    const max = this.maxHp(p);
    if (p.hp >= max) { this.toast(p, 'Je bent al helemaal gezond.'); return; }
    p.hp = Math.min(max, p.hp + ITEMS[s.id].food);
    s.n--; if (s.n <= 0) p.inv[p.sel] = null;
    this.send(p, { t: 'ate' });
    this.sendInv(p); this.sendStats(p);
  }

  // ---------- opdrachten ----------

  sendQuest(p) {
    const q = QUESTS[Math.min(p.q, QUESTS.length - 1)];
    this.send(p, { t: 'quest', i: p.q, n: QUESTS.length, title: q.title, text: q.text, marker: q.marker || null });
  }

  checkQuests(p, force) {
    let changed = false;
    while (p.q < QUESTS.length - 1 && QUESTS[p.q].done(p, this)) {
      p.q++; changed = true;
      this.send(p, { t: 'questDone', title: QUESTS[p.q - 1].title });
      this.addXp(p, 25 + p.q * 12);
    }
    if (changed || force) this.sendQuest(p);
  }

  // ---------- blokken ----------

  setBlock(w, x, y, z, id) {
    if (w.set(x, y, z, id)) this.broadcast(w.id, { t: 'block', x, y, z, id });
  }

  on_break(p, m) {
    const w = this.worlds[p.world];
    const x = m.x | 0, y = m.y | 0, z = m.z | 0;
    const id = w.get(x, y, z);
    const def = BLOCKS[id];
    if (!id || !def || def.hard === Infinity || Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y - 1, z + 0.5 - p.z) > 9) {
      this.send(p, { t: 'block', x, y, z, id });
      return;
    }
    const held = p.inv[p.sel];
    const tool = held && ITEMS[held.id];
    const can = def.tier === 0 || (tool && tool.tool === def.tool && tool.tier >= def.tier);

    // loopt er water of lava in het gat?
    let fill = 0;
    const nb = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]];
    for (const [dx, dy, dz] of nb) {
      const n = w.get(x + dx, y + dy, z + dz);
      if (B_SHAPE[n] === SHAPE_LIQUID) { fill = n; break; }
    }
    this.setBlock(w, x, y, z, fill);

    const part = bedPart(id);
    if (part) {
      // de andere helft van het bed verdwijnt mee (je krijgt één bed terug)
      const dx = BED_DIRS[part.d][0], dz = BED_DIRS[part.d][1];
      const ox = part.head ? x - dx : x + dx, oz = part.head ? z - dz : z + dz;
      const other = bedPart(w.get(ox, y, oz));
      if (other && other.head !== part.head && other.d === part.d) this.setBlock(w, ox, y, oz, 0);
    }
    if (EGG_TYPE[id]) delete this.meta.eggs[p.world + ':' + x + ',' + y + ',' + z];
    if (can) this.dropFor(p, def);
    else if (def.tier > 0) this.toast(p, 'Hiervoor heb je een beter houweel nodig.', 'warn');
    if (def.xp && can) this.addXp(p, def.xp);

    // plantje of fakkel erboven valt om
    const above = w.get(x, y + 1, z);
    if (above && BLOCKS[above].support) {
      this.setBlock(w, x, y + 1, z, 0);
      this.dropFor(p, BLOCKS[above]);
    }
    if (def.hard >= 0.5) this.wear(p);              // plantjes en bladeren kosten niets
    this.sendInv(p);
    this.checkQuests(p);
  }

  dropFor(p, def) {
    const rnd = this.rnd;
    if (def.drop === null) return;
    if (def.key.startsWith('blad_')) {
      // bladeren geven het blad zelf, en soms ook een stok of een appel
      const r = rnd();
      if (r < 0.1) this.giveLoot(p, I.stok, 1);
      else if (r < 0.16 && (def.key === 'blad_eik' || def.key === 'blad_goud')) this.giveLoot(p, I.appel, 1);
    }
    if (def.drop === undefined) { this.giveLoot(p, def.id, 1); return; }
    const [id, a, b] = def.drop;
    this.giveLoot(p, id, a + Math.floor(rnd() * (b - a + 1)));
  }

  on_place(p, m) {
    const w = this.worlds[p.world];
    const x = m.x | 0, y = m.y | 0, z = m.z | 0;
    const s = p.inv[p.sel];
    const cur = w.get(x, y, z);
    const reject = () => { this.send(p, { t: 'block', x, y, z, id: w.get(x, y, z) }); this.sendInv(p); };
    if (!s || y < 1 || y >= CH - 1 || !BLOCKS[cur] || !BLOCKS[cur].replace || Math.hypot(x + 0.5 - p.x, y - p.y, z + 0.5 - p.z) > 9) return reject();
    if (s.id >= 256) {
      const it = ITEMS[s.id];
      if (it && it.portal) {
        if (it.portal === p.world) { this.toast(p, 'Je bent al in deze wereld.', 'warn'); return reject(); }
        // het portaal staat altijd op vaste grond (niet boven op een bloemetje)
        let py = y;
        while (py > 3 && !w.solid(x, py - 1, z) && !w.liquid(x, py - 1, z)) py--;
        if (py < 3 || py > CH - 8) return reject();
        this.buildPortal(w, x, py, z, it.portal);
        s.n--; if (s.n <= 0) p.inv[p.sel] = null;
        this.fx(w.id, 'portal', x + 1, py + 1, z + 0.5);
        this.toast(p, 'Het portaal naar de ' + WORLDS[it.portal].name + ' gaat open!', 'good');
        this.sendInv(p);
        return;
      }
      return reject();
    }
    const def = BLOCKS[s.id];
    if (def.support && !w.solid(x, y - 1, z)) return reject();
    if (def.solid) {
      for (const q of this.players.values()) {
        if (q.world !== p.world) continue;
        if (q.x + 0.3 > x && q.x - 0.3 < x + 1 && q.z + 0.3 > z && q.z - 0.3 < z + 1 && q.y + 1.8 > y && q.y < y + 1) return reject();
      }
    }
    if (s.id === B.bed) {
      // een bed is twee blokken lang: het voeteneind komt waar je tikt, het hoofdeind erachter
      const spot = this.bedSpot(p, w, x, y, z);
      if (!spot) { this.toast(p, 'Hier past het bed niet. Het is twee blokken lang en moet op de grond staan.', 'warn'); return reject(); }
      this.setBlock(w, x, y, z, bedFoot(spot.d));
      this.setBlock(w, spot.x, y, spot.z, bedHead(spot.d));
    } else this.setBlock(w, x, y, z, s.id);
    if (EGG_TYPE[s.id]) {
      this.meta.eggs[p.world + ':' + x + ',' + y + ',' + z] = { type: EGG_TYPE[s.id], prog: 0, owner: p.name, w: p.world, x, y, z };
      this.toast(p, 'Het ei ligt er. Houd het warm met een kampvuur vlak ernaast!');
    }
    if (!p.flags['made_' + def.key] && (def.key === 'werkbank' || def.key === 'kampvuur' || def.key === 'bed')) p.flags['made_' + def.key] = 1;
    s.n--; if (s.n <= 0) p.inv[p.sel] = null;
    this.sendInv(p);
    this.checkQuests(p);
  }

  // Waar kan het hoofdeind van een bed komen? Het liefst in de richting waarin de speler kijkt.
  bedSpot(p, w, x, y, z) {
    if (!w.solid(x, y - 1, z)) return null;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const first = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 0 : 2) : (fz > 0 ? 1 : 3);
    for (const turn of [0, 1, 3, 2]) {
      const d = (first + turn) % 4;
      const hx = x + BED_DIRS[d][0], hz = z + BED_DIRS[d][1];
      const cur = w.get(hx, y, hz);
      if (!BLOCKS[cur] || !BLOCKS[cur].replace || !w.solid(hx, y - 1, hz)) continue;
      let free = true;
      for (const q of this.players.values()) {
        if (q.world === w.id && q.x + 0.3 > hx && q.x - 0.3 < hx + 1 && q.z + 0.3 > hz && q.z - 0.3 < hz + 1 && q.y + 1.8 > y && q.y < y + 1) { free = false; break; }
      }
      if (free) return { x: hx, z: hz, d };
    }
    return null;
  }

  on_use(p, m) {
    const w = this.worlds[p.world];
    const x = m.x | 0, y = m.y | 0, z = m.z | 0;
    const id = w.get(x, y, z);
    if (Math.hypot(x + 0.5 - p.x, y - p.y, z + 0.5 - p.z) > 9) return;
    if (id === B.schatkist) {
      this.setBlock(w, x, y, z, B.schatkist_open);
      this.fx(w.id, 'chest', x + 0.5, y + 1, z + 0.5);
      this.lootChest(p, w, x, y, z);
      this.addXp(p, 10);
      this.sendInv(p);
    } else if (id === B.machinekrat) {
      this.setBlock(w, x, y, z, B.krat_leeg);
      this.fx(w.id, 'chest', x + 0.5, y + 1, z + 0.5);
      this.giveLoot(p, I.machineonderdeel, 1 + (this.rnd() < 0.5 ? 1 : 0));
      if (this.rnd() < 0.4) this.giveLoot(p, I.ijzerstaaf, 1);
      p.flags.krat = 1;
      this.addXp(p, 5);
      this.sendInv(p);
    } else if (id === B.dynamiet) {
      this.ignite(w, x, y, z, p, 2.6);
      this.toast(p, 'Het lont brandt... wegwezen!', 'warn');
    } else if (id === B.scheepscomputer) {
      p.flags.computer = 1;
      this.send(p, { t: 'dialog', title: 'Scheepscomputer', lines: computerLines(p, this) });
    } else if (isBed(id)) {
      p.spawn = { w: p.world, x: x + 0.5, y: y + 1, z: z + 0.5 };
      const ph = dayPhase(this.meta.time);
      if (WORLDS[p.world].cycle && ph > DAY_FRAC - 0.04) {
        this.meta.time += (1 - ph + 0.02) * DAY_LENGTH;
        for (const q of this.players.values()) this.send(q, { t: 'time', time: this.meta.time, sleep: 1 });
        p.hp = this.maxHp(p);
        this.sendStats(p);
        this.toast(p, 'Goedemorgen! Je hebt heerlijk geslapen.', 'good');
      } else this.toast(p, 'Dit is nu je slaapplek. Slapen kan alleen als het donker is.');
    } else if (id === B.levenshart) {
      this.useHeart(p, w);
    } else if (EGG_TYPE[id]) {
      const e = this.meta.eggs[p.world + ':' + x + ',' + y + ',' + z];
      if (!e) this.toast(p, 'Een drakenei! Hak het los om het mee te nemen.');
      else if (e.warm) this.toast(p, 'Het ei is lekker warm... ' + Math.floor(e.prog * 100) + '%');
      else this.toast(p, 'Het ei heeft het koud. Zet er een kampvuur vlak naast!', 'warn');
    }
    this.checkQuests(p);
  }

  // ---------- dynamiet ----------

  // Steek een blok dynamiet aan: na een paar tellen ontploft het.
  ignite(w, x, y, z, p, delay) {
    this.setBlock(w, x, y, z, B.dynamiet_aan);
    if (!this.meta.fuses) this.meta.fuses = [];
    this.meta.fuses.push({ w: w.id, x, y, z, t: this.meta.time + delay, by: p ? p.name : '' });
    this.fx(w.id, 'fuse', x + 0.5, y + 1.1, z + 0.5);
  }

  updateFuses() {
    const list = this.meta.fuses;
    if (!list || !list.length) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      if (this.meta.time < f.t) continue;
      list.splice(i, 1);
      this.explode(this.worlds[f.w], f);
    }
  }

  // De klap: blaast alle gewone blokken in de buurt weg (ertsen krijg je, de rest soms),
  // steekt ander dynamiet aan en doet pijn als je te dichtbij staat.
  explode(w, f) {
    const { x, y, z } = f;
    if (!w || w.get(x, y, z) !== B.dynamiet_aan) return;      // het blok is intussen weggehaald
    let p = null;
    for (const q of this.players.values()) if (q.name === f.by && q.world === w.id) p = q;
    this.setBlock(w, x, y, z, 0);
    const R = 3.3, loot = new Map(), rnd = this.rnd;
    for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) {
      if (Math.hypot(dx, dy, dz) > R + rnd() * 0.9) continue;
      const bx = x + dx, by = y + dy, bz = z + dz;
      if (by < 1) continue;
      const id = w.get(bx, by, bz);
      if (!id) continue;
      const def = BLOCKS[id];
      if (id === B.dynamiet) { this.ignite(w, bx, by, bz, p, 0.25 + rnd() * 0.5); continue; }
      if (def.hard === Infinity || EGG_TYPE[id] || isBed(id) || id === B.dynamiet_aan) continue;
      this.setBlock(w, bx, by, bz, 0);
      if (def.drop === null || !(def.xp || rnd() < 0.3)) continue;
      const [did, a, b] = def.drop === undefined ? [id, 1, 1] : def.drop;
      loot.set(did, (loot.get(did) || 0) + a + Math.floor(rnd() * (b - a + 1)));
    }
    // plantjes en fakkels waar de grond onder weg is, vallen om
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) for (let dy = -3; dy <= 5; dy++) {
      const id = w.get(x + dx, y + dy, z + dz);
      if (id && BLOCKS[id].support && !w.solid(x + dx, y + dy - 1, z + dz)) this.setBlock(w, x + dx, y + dy, z + dz, 0);
    }
    this.fx(w.id, 'explode', x + 0.5, y + 0.5, z + 0.5);
    for (const e of Array.from(w.ents.values())) {
      if (e.owner) continue;                                   // je eigen draken en dieren blijven heel
      const d = Math.hypot(e.x - x - 0.5, e.y + e.h / 2 - y - 0.5, e.z - z - 0.5);
      if (d < 6.5) this.damageEntity(w, e, Math.round(26 * (1 - d / 6.5)) + 2, p, e.x - x - 0.5, e.z - z - 0.5);
    }
    for (const q of this.players.values()) {
      if (q.world !== w.id || q.dead) continue;
      const d = Math.hypot(q.x - x - 0.5, q.y + 0.9 - y - 0.5, q.z - z - 0.5);
      if (d < 6) this.hurtPlayer(q, Math.max(1, Math.round(9 * (1 - d / 6))), null);
    }
    if (p) {
      for (const [id, n] of loot) this.giveLoot(p, id, n);
      this.sendInv(p);
      this.checkQuests(p);
    }
  }

  lootChest(p, w, x, y, z) {
    const T = WORLDS.groen.tree;
    if (w.id === 'groen' && x === T.x && z === T.z && y < 8) {
      this.giveLoot(p, I.oerwapen, 1);
      this.giveLoot(p, B.ei_kristal, 1);
      this.send(p, { t: 'dialog', title: 'Het Oerwapen', lines: ['Je hebt het geheim van Graet gevonden!', 'Dit wapen bestond al voordat de wereld werd gemaakt.', 'Bijna niemand heeft het ooit gezien...'] });
      this.sendStats(p);
      return;
    }
    const r = mulberry32((hash3(x, y, z, this.meta.seed) * 4294967296) >>> 0);
    const crystal = { groen: I.kristal, ijs: I.ijskristal, vuur: I.vuurkristal, schaduw: I.schaduwkristal, wolken: I.hemelkristal }[w.id];
    const table = [[I.ijzerstaaf, 2, 4], [I.goudstaaf, 1, 3], [crystal, 1, 3], [I.pijl, 6, 12], [I.drankje, 1, 2], [I.machineonderdeel, 1, 2], [I.bessen, 3, 6], [B.gloeikristal, 1, 3], [B.fakkel, 4, 8], [I.steenkool, 3, 6], [I.appel, 2, 4]];
    const rolls = 3 + Math.floor(r() * 2);
    for (let i = 0; i < rolls; i++) {
      const [id, a, b] = table[Math.floor(r() * table.length)];
      this.giveLoot(p, id, a + Math.floor(r() * (b - a + 1)));
    }
  }

  // ---------- levensbomen ----------

  useHeart(p, w) {
    const T = WORLDS[w.id].tree, k = T.key, t = this.meta.trees;
    if (t[k]) { this.toast(p, T.name + ' straalt van leven.', 'good'); return; }
    if (k === 'groen' && !(t.ijs && t.vuur && t.schaduw && t.wolken)) {
      this.toast(p, 'De boom is te zwak. Herstel eerst de vier andere levensbomen.', 'warn'); return;
    }
    if (!this.meta.bossDead[k]) {
      if (!this.findBoss(w)) this.wakeGuardian(w, T);
      else this.toast(p, 'Versla eerst de bewaker!', 'warn');
      return;
    }
    t[k] = true;
    for (const q of this.players.values()) {
      this.send(q, { t: 'trees', trees: t });
      q.hp = this.maxHp(q);
      this.sendStats(q);
      this.send(q, { t: 'dialog', title: T.name + ' leeft weer!', lines: ['De magie stroomt terug in de boom.', 'Je krijgt 2 extra hartjes.', 'Nieuwe kracht: ' + WORLDS[k].power] });
      this.addXp(q, 120);
      this.checkQuests(q);
    }
    this.fx(w.id, 'restore', T.x + 0.5, T.y + 4, T.z + 0.5);
  }

  // ---------- portalen ----------

  buildPortal(w, x, y, z, to) {
    const field = PORTAL_BLOCK[to];
    for (let dx = -1; dx <= 2; dx++) {
      for (let dy = -1; dy <= 3; dy++) {
        const frame = dx === -1 || dx === 2 || dy === -1 || dy === 3;
        this.setBlock(w, x + dx, y + dy, z, frame ? B.portaalsteen : field);
        if (dy >= 0 && dy <= 2 && !frame) {
          for (const dz of [-1, 1]) if (BLOCKS[w.get(x + dx, y + dy, z + dz)].hard !== Infinity || w.liquid(x + dx, y + dy, z + dz)) this.setBlock(w, x + dx, y + dy, z + dz, 0);
        }
      }
      for (const dz of [-1, 1]) if (!w.solid(x + dx, y - 1, z + dz)) this.setBlock(w, x + dx, y - 1, z + dz, B.portaalsteen);
      // een beetje ruimte aan de voorkant (+z), daar kom je aan
      if (!w.solid(x + dx, y - 1, z + 2)) this.setBlock(w, x + dx, y - 1, z + 2, B.portaalsteen);
      for (let dy = 0; dy <= 2; dy++) {
        const id = w.get(x + dx, y + dy, z + 2);
        if (id && BLOCKS[id].hard !== Infinity && !PORTAL_TO[id]) this.setBlock(w, x + dx, y + dy, z + 2, 0);
        const id1 = w.get(x + dx, y + dy, z + 1);
        if ((dx === -1 || dx === 2) && id1 && BLOCKS[id1].hard !== Infinity && !PORTAL_TO[id1]) this.setBlock(w, x + dx, y + dy, z + 1, 0);
      }
    }
    this.meta.portals.push({ w: w.id, x, y, z, to });
  }

  findSafe(w, x, z) {
    // zoek een vlak, droog plekje in de buurt
    let best = null, bestScore = 1e9;
    for (let r = 0; r <= 24 && bestScore > 2; r += 3) {
      for (let a = 0; a < (r === 0 ? 1 : 8); a++) {
        const cx = Math.round(x + Math.cos(a * Math.PI / 4) * r), cz = Math.round(z + Math.sin(a * Math.PI / 4) * r);
        const top = w.topY(cx, cz);
        if (top < 4 || top > CH - 12) continue;
        const above = w.get(cx, top + 1, cz);
        if (w.liquid(cx, top + 1, cz) || (above !== 0 && BLOCKS[above].solid)) continue;
        const tid = w.get(cx, top, cz);
        if (tid === B.magmasteen || BLOCKS[tid].key.startsWith('blad') || BLOCKS[tid].key.startsWith('levens')) continue;
        let score = r * 0.1;
        for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [1, 2], [-1, 2]]) {
          const t2 = w.topY(cx + dx, cz + dz);
          score += t2 < 0 ? 6 : Math.abs(t2 - top);
          if (t2 > 0 && w.liquid(cx + dx, t2 + 1, cz + dz)) score += 4;
        }
        if (score < bestScore) { bestScore = score; best = { x: cx, y: top + 1, z: cz }; }
      }
    }
    if (best) return best;
    // niets gevonden (bijv. lege lucht in de wolkenwereld): maak een wolkenplatform
    for (let dx = -3; dx <= 4; dx++) for (let dz = -3; dz <= 3; dz++) this.setBlock(w, x + dx, 55, z + dz, B.wolk);
    return { x, y: 56, z };
  }

  on_portal(p, m) {
    const w = this.worlds[p.world];
    const id = w.get(m.x | 0, m.y | 0, m.z | 0);
    const to = PORTAL_TO[id];
    if (!to || to === p.world || p.dead) return;
    const from = p.world;
    const px = Math.floor(p.x), pz = Math.floor(p.z);
    const dest = this.worlds[to];
    let best = null, bd = 64;
    for (const pt of this.meta.portals) {
      if (pt.w !== to || pt.to !== from) continue;
      const d = Math.hypot(pt.x - px, pt.z - pz);
      if (d < bd && dest.get(pt.x, pt.y, pt.z) === PORTAL_BLOCK[from]) { bd = d; best = pt; }
    }
    if (!best) {
      const spot = this.findSafe(dest, px, pz);
      this.buildPortal(dest, spot.x, spot.y, spot.z, from);
      best = this.meta.portals[this.meta.portals.length - 1];
    }
    this.moveToWorld(p, to, best.x + 1, best.y, best.z + 1.6);
  }

  moveToWorld(p, to, x, y, z) {
    const old = this.worlds[p.world];
    this.syncOwned(p);
    const mounted = p.mount;
    for (const d of p.dragons) {
      if (d.world === p.world && (d.mode === 'follow' || (mounted && d.eid === mounted))) { d.world = to; d.x = x; d.y = Math.max(2, y + 1); d.z = z + 1.5; d.far = 1; }
    }
    for (const d of p.pets) if (d.world === p.world && d.mode === 'follow') { d.world = to; d.x = x; d.y = y; d.z = z + 1; }
    this.removeOwned(p, old);
    if (mounted) this.send(p, { t: 'mount', id: 0 });
    p.world = to; p.x = x; p.y = y; p.z = z;
    this.enterWorld(p, false);
  }

  on_respawn(p) {
    if (!p.dead) return;
    p.dead = false;
    p.hp = this.maxHp(p);
    let s = p.spawn;
    if (s && !isBed(this.worlds[s.w].get(Math.floor(s.x), Math.floor(s.y) - 1, Math.floor(s.z)))) { s = null; p.spawn = null; }
    if (!s) s = { w: 'groen', x: SPAWN.x, y: -1, z: SPAWN.z };
    if (s.w !== p.world || true) {
      // altijd via moveToWorld zodat draken en chunks goed meekomen
      this.syncOwned(p);
      this.removeOwned(p, this.worlds[p.world]);
      p.world = s.w; p.x = s.x; p.y = s.y; p.z = s.z;
      for (const d of p.dragons) if (d.mode === 'follow') { d.world = s.w; d.x = s.x; d.y = Math.max(s.y, 1) + 1; d.z = s.z + 1.5; d.far = 1; }
      this.enterWorld(p, false);
    }
    this.sendStats(p);
  }

  // ---------- beweging en chunks ----------

  on_move(p, m) {
    if (p.dead) return;
    p.x = m.x; p.y = m.y; p.z = m.z; p.yaw = m.yaw; p.pitch = m.pitch;
    const cx = Math.floor(p.x / 16), cz = Math.floor(p.z / 16);
    if (cx !== p.ccx || cz !== p.ccz) { p.ccx = cx; p.ccz = cz; this.updateWanted(p); }
    if (p.mount) {
      const e = this.worlds[p.world].ents.get(p.mount);
      if (e) { e.x = p.x; e.y = p.y - 0.2 - 1.15 * e.scale; e.z = p.z; e.yaw = p.yaw; e.vx = e.vy = e.vz = 0; }
      else p.mount = 0;
    }
  }

  on_view(p, m) { p.view = clamp(m.r | 0, 2, 8); this.updateWanted(p); }

  updateWanted(p) {
    const R = p.view + 1, cx = p.ccx, cz = p.ccz;
    const list = [];
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const d = dx * dx + dz * dz;
      if (d > (R + 0.5) * (R + 0.5)) continue;
      if (!p.sent.has(chunkKey(cx + dx, cz + dz))) list.push([d, cx + dx, cz + dz]);
    }
    list.sort((a, b) => a[0] - b[0]);
    p.queue = list;
    for (const key of p.sent) {
      const kx = Math.floor(key / 65536) - 32768, kz = (key % 65536) - 32768;
      if (Math.abs(kx - cx) > R + 1 || Math.abs(kz - cz) > R + 1) {
        p.sent.delete(key);
        this.send(p, { t: 'unload', cx: kx, cz: kz });
      }
    }
  }

  streamChunks(p, until) {
    const w = this.worlds[p.world];
    let n = 0;
    while (p.queue.length && (n === 0 || now() < until) && n < 6) {
      const [, cx, cz] = p.queue.shift();
      const key = chunkKey(cx, cz);
      if (p.sent.has(key)) continue;
      const copy = w.chunk(cx, cz).slice();
      p.sent.add(key);
      this.send(p, { t: 'chunk', w: w.id, cx, cz, b: copy }, [copy.buffer]);
      n++;
    }
  }

  // ---------- de klok ----------

  tick() {
    if (!this.ready) return;
    const t = now();
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.25) dt = 0.25;
    if (!this.players.size) return;

    // Pauze: als elke speler een venster open heeft (of de tablet weglegt), staat de wereld
    // stil: geen tijd, geen monsters. Chunks versturen en opslaan gaan wel door.
    // (Met meer spelers pauzeert de wereld dus alleen als iedereen op pauze staat.)
    let paused = true;
    for (const p of this.players.values()) if (!p.paused) { paused = false; break; }

    if (!paused) {
      this.meta.time += dt;
      const active = new Set();
      for (const p of this.players.values()) active.add(p.world);
      for (const wid of active) {
        const w = this.worlds[wid];
        this.updateEntities(w, dt);
        this.updateProjectiles(w, dt);
      }

      this.updateFuses();
      this.acc.snap += dt;
      if (this.acc.snap >= 0.1) { this.acc.snap = 0; this.snapshots(); }

      this.acc.sec += dt;
      if (this.acc.sec >= 1) {
        this.acc.sec = 0;
        this.everySecond(active);
      }
    }

    const until = now() + 12;
    for (const p of this.players.values()) this.streamChunks(p, until);

    this.acc.save += dt;
    if (this.acc.save >= 8) { this.acc.save = 0; this.save(); }
  }

  everySecond(active) {
    for (const p of this.players.values()) {
      if (p.dead) continue;
      // langzaam genezen
      const fast = this.meta.trees.groen;
      p.regen += 1;
      const max = this.maxHp(p);
      if (p.hp < max && this.meta.time - p.lastHurt > 6 && p.regen >= (fast ? 1 : 4)) { p.regen = 0; p.hp = Math.min(max, p.hp + 1); this.sendStats(p); }
      this.send(p, { t: 'time', time: this.meta.time });
      this.wildSpawn(p);
      this.checkGuardian(p);
    }
    this.updateWeather(active);
    this.updateEggs();
    for (const wid of active) this.cleanup(this.worlds[wid]);
    // chunks vergeten waar niemand meer is
    if (Math.floor(this.meta.time) % 5 === 0) {
      for (const wid of WORLD_ORDER) {
        const w = this.worlds[wid];
        if (!w.chunks.size) continue;
        const ps = [];
        for (const p of this.players.values()) if (p.world === wid) ps.push(p);
        w.forget((cx, cz) => ps.some((p) => Math.abs(cx - p.ccx) <= p.view + 4 && Math.abs(cz - p.ccz) <= p.view + 4));
      }
    }
  }

  on_save() { this.save(); }

  on_pause(p, m) { p.paused = !!m.on; }

  // De speler gaat terug naar het hoofdmenu: opslaan en de wereld stilzetten.
  // (Zonder spelers doet de klok niets meer, dus er gebeurt niets terwijl je weg bent.)
  on_leave(p) {
    if (p.mount) this.on_dismount(p);
    this.save();                                   // legt de speler meteen vast
    this.removeOwned(p, this.worlds[p.world]);
    this.players.delete(p.conn);
  }

  on_look(p, m) { if (m.look && typeof m.look === 'object') p.look = m.look; }

  // Ontwikkelaarsmodus (alleen als het spel met ?debug in het adres is gestart)
  on_debug(p, m) {
    if (!p.debug) return;
    const w = this.worlds[p.world];
    if (m.c === 'give') { this.give(p, m.id, m.n || 1); this.sendInv(p); this.checkQuests(p); }
    else if (m.c === 'time') this.meta.time = m.v;
    else if (m.c === 'heal') { p.hp = this.maxHp(p); this.sendStats(p); }
    else if (m.c === 'spawn') { const sx = p.x + (m.dx || 0), sz = p.z + (m.dz || 0); const top = w.topY(Math.floor(sx), Math.floor(sz)); this.spawnEnt(w, m.kind, sx, (top > 0 ? top + 1 : p.y) + (m.dy || 0), sz); }
    else if (m.c === 'tree') { this.meta.bossDead[m.k] = true; }
    else if (m.c === 'world') this.moveToWorld(p, m.w, m.x === undefined ? p.x : m.x, -1, m.z === undefined ? p.z : m.z);
    else if (m.c === 'xp') this.addXp(p, m.n || 100);
    else if (m.c === 'god') p.god = !!m.v;
    else if (m.c === 'egg') { for (const k in this.meta.eggs) this.meta.eggs[k].prog = 0.95; }
    else if (m.c === 'weather') this.setWeather(p.world, m.k || 'zon', m.dur || 120);
    else if (m.c === 'tp') { p.x = m.x; p.y = m.y; p.z = m.z; this.send(p, { t: 'tp', x: m.x, y: m.y, z: m.z }); }
    else if (m.c === 'grow') { for (const d of p.dragons) { d.growth = 100; const e = w.ents.get(d.eid); if (e) { this.applyDragon(e); this.broadcast(w.id, { t: 'entMeta', id: e.id, s: e.scale, g: 100 }); } } this.sendDragons(p); this.checkQuests(p); }
  }

  async save() {
    try {
      const jobs = [this.storage.set('meta', this.meta)];
      for (const p of this.players.values()) {
        this.syncOwned(p);
        const rec = {};
        for (const f of SAVE_FIELDS) rec[f] = p[f];
        jobs.push(this.storage.set('p/' + p.name, rec));
      }
      for (const wid of WORLD_ORDER) {
        const w = this.worlds[wid];
        for (const key of w.dirty) jobs.push(this.storage.set('e/' + wid + '/' + key, Array.from(w.edits.get(key))));
        w.dirty.clear();
      }
      await Promise.all(jobs);
    } catch (e) { console.warn('opslaan mislukt', e); }
  }
}

Object.assign(GameServer.prototype, entityMethods, npcMethods);
export { itemName, isNight };
