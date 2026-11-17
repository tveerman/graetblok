// Het Landbouwimperium op de server: planten, groeien, oogsten, de landbouwmachines, de
// marktkraam, het boerderijlevel en de missies. (De lijsten staan in shared/farm.js.)
import { B, BLOCKS, B_SHAPE, SHAPE_LIQUID } from '../shared/blocks.js';
import { I, ITEMS, itemName } from '../shared/items.js';
import { VEHICLES } from '../shared/vehicles.js';
import { CROPS, CROP_OF_SEED, CROP_OF_BLOCK, MAGIC_BONUS, MAGIC_CHANCE, MAGIC_KEYS, FARM_PRICES, FARM_TITLES, FARM_SHOP, FARM_MISSIONS, SPRINKLER_R, farmLevel } from '../shared/farm.js';

export const farmMethods = {

  // wat de speler als boer heeft bereikt
  farmOf(p) {
    return p.flags.farm || (p.flags.farm = { xp: 0, oogst: {}, verkocht: 0, verdiend: 0, rest: 0, magie: {}, koop: {}, klaar: {} });
  },

  // ---------- planten en groeien ----------

  // hoe lang doet dit gewas er hier over? Met een sproeier in de buurt of water vlak naast de
  // akker gaat het twee keer zo snel.
  growTime(w, x, y, z, C) {
    for (let dx = -SPRINKLER_R; dx <= SPRINKLER_R; dx++) for (let dz = -SPRINKLER_R; dz <= SPRINKLER_R; dz++) for (let dy = -1; dy <= 1; dy++) {
      const id = w.get(x + dx, y + dy, z + dz);
      if (id === B.sproeier) return C.groei / 2;
      if (dy === -1 && Math.abs(dx) <= 2 && Math.abs(dz) <= 2 && B_SHAPE[id] === SHAPE_LIQUID && id === B.water) return C.groei / 2;
    }
    return C.groei;
  },

  // een gewas planten op (x, y, z); daaronder moet akker liggen
  plantAt(w, x, y, z, key) {
    const cur = w.get(x, y, z);
    if (w.get(x, y - 1, z) !== B.akker || !BLOCKS[cur] || !BLOCKS[cur].replace) return false;
    const C = CROPS[key];
    this.setBlock(w, x, y, z, B.kiem);
    const crops = this.meta.crops || (this.meta.crops = {});
    crops[w.id + ':' + x + ',' + y + ',' + z] = { k: key, w: w.id, x, y, z, t: this.meta.time + this.growTime(w, x, y, z, C) };
    return true;
  },

  // elke seconde: kiemplantjes die klaar zijn worden een rijpe plant (als er iemand in de buurt is)
  updateCrops() {
    const crops = this.meta.crops;
    if (!crops) return;
    const now = this.meta.time;
    for (const key in crops) {
      const c = crops[key];
      if (c.t > now) continue;
      let near = false;
      for (const p of this.players.values()) if (p.world === c.w && Math.abs(p.x - c.x) < 96 && Math.abs(p.z - c.z) < 96) { near = true; break; }
      if (!near) continue;
      const w = this.worlds[c.w];
      if (w.get(c.x, c.y, c.z) === B.kiem && w.get(c.x, c.y - 1, c.z) === B.akker) this.setBlock(w, c.x, c.y, c.z, CROPS[c.k].blok);
      delete crops[key];
    }
  },

  // Er is een plant weggehaald. Geeft true terug als het een gewas was (dan regelen wij wat je krijgt).
  cropBroken(p, w, x, y, z, id) {
    if (id === B.kiem) {
      const crops = this.meta.crops || {}, key = w.id + ':' + x + ',' + y + ',' + z, c = crops[key];
      if (c) { this.giveLoot(p, CROPS[c.k].zaad[0], 1, true); delete crops[key]; }      // nog niet rijp: je krijgt terug wat je plantte
      return true;
    }
    const k = CROP_OF_BLOCK[id];
    if (!k || (id === B.pompoen && w.get(x, y - 1, z) !== B.akker)) return false;
    this.farmHarvest(p, k);
    return true;
  },

  farmHarvest(p, key) {
    const C = CROPS[key], F = this.farmOf(p), rnd = this.rnd;
    const [id, a, b] = C.oogst, n = a + Math.floor(rnd() * (b - a + 1));
    this.giveLoot(p, id, n, true);
    F.oogst[key] = (F.oogst[key] || 0) + n;
    this.jobEvent(p, 'oogst', n);
    const found = (k) => {
      this.giveLoot(p, I[k], 1, true);
      if (!F.magie[k]) { F.magie[k] = 1; this.toast(p, '✨ Je hebt een magisch gewas ontdekt: ' + CROPS[k].name + '! Zet het op een akker om er meer van te kweken.', 'rank'); }
    };
    if (!C.magic) { if (rnd() < MAGIC_CHANCE) found(C.magisch); }
    else {
      if (!F.magie[key]) F.magie[key] = 1;
      for (const [k, kans] of MAGIC_BONUS) if (k !== key && rnd() < kans) { found(k); break; }
    }
    this.farmXp(p, C.xp);
  },

  farmXp(p, n) {
    const F = this.farmOf(p), was = farmLevel(F.xp);
    F.xp += n;
    const nu = farmLevel(F.xp);
    if (nu > was) this.toast(p, '🌾 Boerderijlevel ' + nu + ': je bent nu ' + FARM_TITLES[nu - 1][0] + '! Kijk bij de marktkraam wat er nieuw is.', 'rank');
    this.checkFarm(p);
  },

  missionValue(F, M) {
    return M.soort === 'oogst' ? F.oogst[M.wat] || 0 : M.soort === 'koop' ? F.koop[M.wat] || 0 : M.soort === 'magie' ? MAGIC_KEYS.filter((k) => F.magie[k]).length
      : M.soort === 'verkocht' ? F.verkocht : M.soort === 'level' ? farmLevel(F.xp) : F.verdiend;
  },

  checkFarm(p) {
    const F = this.farmOf(p);
    for (const M of FARM_MISSIONS) {
      if (F.klaar[M.k] || this.missionValue(F, M) < M.n) continue;
      F.klaar[M.k] = 1;
      this.giveLoot(p, I.munt, M.munten, true);
      this.toast(p, '🏆 Missie gehaald: ' + M.tekst + '! Je krijgt ' + M.munten + ' munten.', 'rank');
      this.sendInv(p);
    }
  },

  // ---------- de marktkraam ----------

  sendFarm(p) {
    const F = this.farmOf(p), lv = farmLevel(F.xp);
    const sell = [];
    for (const id in FARM_PRICES) { const n = this.count(p, +id); if (n > 0) sell.push([+id, n, FARM_PRICES[id]]); }
    this.send(p, {
      t: 'farm', xp: F.xp, level: lv, titel: FARM_TITLES[lv - 1][0], next: lv < FARM_TITLES.length ? FARM_TITLES[lv] : null, munten: this.count(p, I.munt),
      sell, verkocht: F.verkocht, verdiend: F.verdiend, magie: MAGIC_KEYS.filter((k) => F.magie[k]),
      shop: FARM_SHOP.map(([k, id, n, prijs, vanaf]) => [k, id, n, prijs, vanaf]),
      missies: FARM_MISSIONS.map((M) => [M.tekst, Math.min(M.n, this.missionValue(F, M)), M.n, M.munten, F.klaar[M.k] ? 1 : 0]),
    });
  },

  on_farm(p, m) {
    const F = this.farmOf(p);
    const sellOne = (id) => {
      const prijs = FARM_PRICES[id], n = this.count(p, id);
      if (!prijs || n < 1) return 0;
      this.take(p, id, n);
      if (id >= 256 && ITEMS[id].leaves) this.giveLoot(p, ITEMS[id].leaves, n, true);      // de lege emmers krijg je terug
      const som = n * prijs + F.rest, munten = Math.floor(som + 1e-9);
      F.rest = som - munten;
      if (munten > 0) this.giveLoot(p, I.munt, munten, true);
      F.verkocht += n; F.verdiend += munten;
      this.jobEvent(p, 'verkoop', n);
      this.farmXp(p, Math.max(1, Math.round(n * prijs)));
      return munten;
    };
    if (m.c === 'sell') {
      const n = this.count(p, m.id | 0), got = sellOne(m.id | 0);
      if (n) this.toast(p, n + ' × ' + itemName(m.id | 0) + ' verkocht voor ' + got + ' munten.', 'good');
    } else if (m.c === 'sellAll') {
      let tot = 0, any = false;
      for (const id in FARM_PRICES) if (this.count(p, +id) > 0) { any = true; tot += sellOne(+id); }
      if (any) this.toast(p, 'Alles verkocht voor ' + tot + ' munten.', 'good');
    } else if (m.c === 'buy') {
      const it = FARM_SHOP.find((s) => s[0] === m.k);
      if (!it) return;
      const [k, id, n, prijs, vanaf] = it;
      if (farmLevel(F.xp) < vanaf) { this.toast(p, 'Dit komt vrij op boerderijlevel ' + vanaf + '.', 'warn'); return; }
      if (this.count(p, I.munt) < prijs) { this.toast(p, 'Daar heb je ' + prijs + ' munten voor nodig.', 'warn'); return; }
      if (this.space(p, id) < n) { this.toast(p, 'Je rugzak is vol!', 'warn'); return; }
      this.take(p, I.munt, prijs);
      this.giveLoot(p, id, n, true);
      F.koop[k] = (F.koop[k] || 0) + 1;
      this.checkFarm(p);
    } else return;
    this.sendInv(p);
    this.sendFarm(p);
  },

  // de melkmachine: staat er een koe in de buurt, dan vult hij een emmer voor je
  useMilker(p, w, x, y, z) {
    let cow = false;
    for (const e of w.ents.values()) if (e.kind === 'koe' && Math.hypot(e.x - x, e.z - z) < 9 && Math.abs(e.y - y) < 4) { cow = true; break; }
    if (!cow) { this.toast(p, 'De melkmachine werkt alleen als er een koe vlakbij staat.', 'warn'); return; }
    if (this.count(p, I.emmer) < 1) { this.toast(p, 'Je hebt een lege emmer nodig.', 'warn'); return; }
    const F = this.farmOf(p);
    if (this.meta.time - (F.melkT || -99) < 15) { this.toast(p, 'De melkmachine is nog bezig. Kom zo terug.'); return; }
    F.melkT = this.meta.time;
    this.take(p, I.emmer, 1);
    this.giveLoot(p, I.melk, 1);
    this.jobEvent(p, 'verzorg');
    this.farmXp(p, 2);
    this.sendInv(p);
  },

  // ---------- de landbouwmachines ----------

  // Aangeroepen terwijl je in een tractor, zaaimachine of combine rijdt: een strook van drie
  // breed onder de machine wordt geploegd, ingezaaid of geoogst.
  farmWork(p, w, e) {
    const V = VEHICLES[e.veh.kind];
    if (!V || !V.werk || e.veh.fuel <= 0) return;
    const cx = Math.floor(p.x), cz = Math.floor(p.z), gy = Math.round(p.y) - 1;
    const cell = cx + ',' + cz;
    if (p.farmCell === cell) return;
    p.farmCell = cell;
    let changed = false;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const x = cx + dx, z = cz + dz;
      for (const y of [gy, gy + 1, gy - 1]) {
        const g = w.get(x, y, z), up = w.get(x, y + 1, z);
        if (V.werk === 'ploeg') {
          if ((g !== B.gras && g !== B.aarde) || (up !== 0 && !(BLOCKS[up] && BLOCKS[up].replace))) continue;
          if (up) this.setBlock(w, x, y + 1, z, 0);
          this.setBlock(w, x, y, z, B.akker);
        } else if (V.werk === 'zaai') {
          if (g !== B.akker || up !== 0) continue;
          let slot = p.inv[p.sel] && CROP_OF_SEED[p.inv[p.sel].id] ? p.sel : p.inv.findIndex((s) => s && CROP_OF_SEED[s.id]);
          if (slot < 0) { if (!p.farmWarn || this.meta.time - p.farmWarn > 6) { p.farmWarn = this.meta.time; this.toast(p, 'De zaaimachine is leeg: neem iets mee om te planten.', 'warn'); } return; }
          const s = p.inv[slot];
          if (!this.plantAt(w, x, y + 1, z, CROP_OF_SEED[s.id])) continue;
          s.n--; if (s.n <= 0) p.inv[slot] = null;
          changed = true;
        } else {
          const k = CROP_OF_BLOCK[up];
          if (!k || g !== B.akker) continue;
          this.setBlock(w, x, y + 1, z, 0);
          this.farmHarvest(p, k);
          changed = true;
        }
        break;
      }
    }
    if (changed) this.sendInv(p);
  },
};
