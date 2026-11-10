// Het leven in de wereld: dorpelingen en handel, ridders en bewakers, kuddes, wolven, beren,
// wilde draken, het weer en de treinen.
// Deze functies worden aan GameServer geplakt (zie onderaan server.js).
import { DAY_LENGTH, clamp, isNight } from '../shared/constants.js';
import { B, BLOCKS, EGGS } from '../shared/blocks.js';
import { I, ITEMS, itemName, maxStack, matches, GROUP_NAMES } from '../shared/items.js';
import { WORLDS, WORLD_ORDER } from '../shared/worlds.js';
import { MOBS, DRAGONS, BREATH } from '../shared/mobs.js';

const r2 = (v) => Math.round(v * 100) / 100;

// Het weer per wereld: [soort, kans]. De rest van de tijd schijnt de zon.
const WEATHER = {
  groen: [['regen', 0.3], ['onweer', 0.14]],
  ijs: [['sneeuw', 0.4], ['storm', 0.14]],
  wolken: [['regen', 0.18]],
  schaduw: [['regen', 0.2], ['onweer', 0.1]],
};
const WILD_DRAGONS = { groen: ['natuur', 'vuur', 'natuur', 'goud'], ijs: ['ijs'], vuur: ['vuur'], schaduw: ['schaduw'], wolken: ['bliksem', 'kristal'] };

export const npcMethods = {

  // Is dit een vijand voor ridders, boomwachters, tamme wolven en je draak?
  hostile(m) {
    if (m.owner || m.dead || m.site === 'x') return false;
    const ai = m.def.ai;
    return ai === 'melee' || ai === 'ranged' || ai === 'boss' || ((ai === 'wolf' || ai === 'neutral' || ai === 'wilddragon') && m.angry > 0);
  },

  // zoek de dichtstbijzijnde vijand (af en toe, niet elke tik)
  findFoe(w, e, cx, cy, cz, range, dt) {
    e.scan = (e.scan || 0) - dt;
    if (e.scan <= 0) {
      e.scan = 0.5; e.foe = 0;
      let bd = range;
      for (const m of w.ents.values()) {
        if (!this.hostile(m) || m.fly) continue;
        const d = Math.hypot(m.x - cx, m.y - cy, m.z - cz);
        if (d < bd) { bd = d; e.foe = m.id; }
      }
    }
    const m = e.foe ? w.ents.get(e.foe) : null;
    return m && !m.dead ? m : null;
  },

  chase(w, e, m, dmg, cd) {
    const dx = m.x - e.x, dz = m.z - e.z, d = Math.hypot(dx, dz) || 1;
    const reach = e.w / 2 + m.w / 2;
    e.yaw = Math.atan2(dx, dz);
    if (d > reach + 0.5) { e.vx = dx / d * e.def.speed; e.vz = dz / d * e.def.speed; } else { e.vx = 0; e.vz = 0; }
    if (d < reach + 1.3 && Math.abs(m.y - e.y) < 3 && e.cd <= 0) {
      e.cd = cd; e.atk = 0.4;
      this.damageEntity(w, m, dmg, null, dx, dz);
    }
  },

  // Wolven: overdag schuw (tenzij je ze slaat), 's nachts jagen ze in een roedel.
  aiWolf(w, e, dt) {
    if (e.owner) { this.aiPet(w, e, dt); return; }
    if (e.angry > 0) e.angry -= dt;
    const night = !WORLDS[w.id].cycle || isNight(this.meta.time);
    const n = this.nearest(w, e, night ? 15 : 8);
    if (n && night && !n.p.god) e.angry = Math.max(e.angry || 0, 5);
    if (e.angry > 0 && n) { this.aiMelee(w, e, dt); return; }
    this.aiPassive(w, e, dt);
  },

  // Een tamme wolf: loopt mee en bijt monsters die bij je in de buurt komen.
  aiPet(w, e, dt) {
    const o = this.playerByName(e.owner);
    if (!o || o.world !== w.id || e.mode === 'stay') { e.vx = 0; e.vz = 0; return; }
    const m = this.findFoe(w, e, o.x, o.y, o.z, 10, dt);
    if (m) { this.chase(w, e, m, 4 + Math.floor(o.level / 4), 0.9); return; }
    const dx = o.x - e.x, dz = o.z - e.z, h = Math.hypot(dx, dz);
    if (h > 28 || Math.abs(o.y - e.y) > 14) { e.x = o.x + 1; e.y = o.y + 0.2; e.z = o.z - 1; e.vy = 0; return; }
    if (h > 3.2) { const sp = e.def.speed * 1.5; e.vx = dx / h * sp; e.vz = dz / h * sp; e.yaw = Math.atan2(dx, dz); }
    else { e.vx = 0; e.vz = 0; }
  },

  // Beren: laat ze met rust en ze doen niets. Kom je te dichtbij (of sla je ze), dan worden ze boos.
  aiNeutral(w, e, dt) {
    if (e.angry > 0) e.angry -= dt;
    const n = this.nearest(w, e, 14);
    if (n && n.d < 3.2 && !n.p.god) e.angry = Math.max(e.angry || 0, 7);
    if (e.angry > 0 && n) { this.aiMelee(w, e, dt); return; }
    this.aiPassive(w, e, dt);
  },

  // Wilde draken zweven hoog rond. Kom je te dichtbij, dan cirkelen ze om je heen en spuwen ze.
  aiWildDragon(w, e, dt) {
    if (e.angry > 0) e.angry -= dt;
    const n = this.nearest(w, e, 70);
    const flyTo = (tx, ty, tz, sp) => {
      const ex = tx - e.x, ey = ty - e.y, ez = tz - e.z, l = Math.hypot(ex, ey, ez) || 1;
      const s = Math.min(sp, l * 2);
      e.vx = ex / l * s; e.vy = ey / l * s; e.vz = ez / l * s;
      return l;
    };
    e.orb = (e.orb || 0) + dt * (e.angry > 0 ? 0.5 : 0.16);
    if (n && n.d < 20 && !n.p.god) e.angry = Math.max(e.angry || 0, 9);
    if (n && e.angry > 0) {
      const p = n.p;
      flyTo(p.x + Math.cos(e.orb) * 13, p.y + 7 + Math.sin(e.orb * 1.7) * 2, p.z + Math.sin(e.orb) * 13, e.def.speed * 1.5);
      e.yaw = Math.atan2(p.x - e.x, p.z - e.z);
      if (e.cd <= 0 && n.d < 34) {
        e.cd = 2.6; e.atk = 0.7;
        const ox = e.x, oy = e.y + e.h * 0.6, oz = e.z;
        const dx = p.x - ox, dy = p.y + 1 - oy, dz = p.z - oz, l = Math.hypot(dx, dy, dz) || 1;
        this.breathDir(w, ox + dx / l * 1.6, oy, oz + dz / l * 1.6, dx / l, dy / l, dz / l, e.dtype, e.def.dmg, 'm', e.id, 0, 0.62);
        if (this.rnd() < 0.3) this.fx(w.id, 'roar', e.x, e.y, e.z);
      }
      return;
    }
    const h = e.home;
    const l = flyTo(h.x + Math.cos(e.orb) * 26, h.y + Math.sin(e.orb * 2.3) * 3, h.z + Math.sin(e.orb) * 26, e.def.speed);
    if (l > 0.5) e.yaw = Math.atan2(e.vx, e.vz);
  },

  // ---------- drakenadem ----------

  // Spuwt de adem van een drakensoort in een richting. power = de kracht van de draak,
  // side: 'p' = van de speler (raakt monsters), 'm' = van een monster (raakt spelers).
  breathDir(w, x, y, z, dx, dy, dz, type, power, side, owner, duid, slower = 1) {
    const b = BREATH[type] || BREATH.vuur;
    for (let i = 0; i < b.n; i++) {
      const a = (i - (b.n - 1) / 2) * b.spread, c = Math.cos(a), s = Math.sin(a);
      const vx = dx * c - dz * s, vz = dx * s + dz * c, sp = b.speed * slower;
      const pr = this.spawnProj(w, b.proj, x, y, z, vx * sp, dy * sp, vz * sp, 0, Math.max(1, Math.round(power * b.dmg)), side, owner, duid);
      pr.b = b;
    }
  },

  // Wat er gebeurt als drakenadem iets raakt of ergens inslaat.
  breathHit(w, pr, e, owner) {
    const b = pr.b;
    if (b.slow) e.slowT = b.slow;
    if (b.poison) { e.poisonT = b.poison; e.poisonBy = pr.owner; }
    if (owner && (b.heal || b.leech)) {
      const max = this.maxHp(owner);
      if (owner.hp < max) { owner.hp = Math.min(max, owner.hp + (b.heal || b.leech)); this.sendStats(owner); }
    }
    if (b.coins && e.dead && owner) { this.giveLoot(owner, I.munt, 1 + Math.floor(this.rnd() * 3)); this.sendInv(owner); }
    if (b.chain) {
      // de bliksem springt over naar vijanden in de buurt
      let n = 0, from = e;
      const seen = new Set([e.id]);
      while (n < b.chain) {
        let best = null, bd = 9;
        for (const m of w.ents.values()) {
          if (seen.has(m.id) || !this.hostile(m)) continue;
          const d = Math.hypot(m.x - from.x, m.y - from.y, m.z - from.z);
          if (d < bd) { bd = d; best = m; }
        }
        if (!best) break;
        seen.add(best.id); n++;
        this.broadcast(w.id, { t: 'fx', k: 'zap', x: r2(from.x), y: r2(from.y + from.h * 0.6), z: r2(from.z), x2: r2(best.x), y2: r2(best.y + best.h * 0.6), z2: r2(best.z) });
        this.damageEntity(w, best, Math.max(1, Math.round(pr.dmg * 0.6)), owner, best.x - from.x, best.z - from.z, pr.duid);
        from = best;
      }
    }
  },

  breathEnd(w, pr, hitId) {
    const b = pr.b;
    if (!b || !b.aoe) return;
    if (pr.side === 'p') {
      const owner = this.playerById(pr.owner);
      for (const e of Array.from(w.ents.values())) {
        if (e.id === hitId || !this.hostile(e) && e.def.ai !== 'wolf' && e.def.ai !== 'neutral' && e.def.ai !== 'wilddragon') continue;
        if (e.owner) continue;
        const d = Math.hypot(e.x - pr.x, e.y + e.h / 2 - pr.y, e.z - pr.z);
        if (d > b.aoe + e.w / 2) continue;
        this.damageEntity(w, e, Math.max(1, Math.round(pr.dmg * (1 - 0.5 * d / b.aoe))), owner, e.x - pr.x, e.z - pr.z, pr.duid);
        if (b.poison && !e.dead) { e.poisonT = b.poison; e.poisonBy = pr.owner; }
        if (b.coins && e.dead && owner) this.giveLoot(owner, I.munt, 1 + Math.floor(this.rnd() * 3));
      }
      if (owner && b.coins) this.sendInv(owner);
    } else {
      for (const q of this.players.values()) {
        if (q.world !== w.id || q.dead) continue;
        const d = Math.hypot(q.x - pr.x, q.y + 0.9 - pr.y, q.z - pr.z);
        if (d < b.aoe * 0.8) this.hurtPlayer(q, Math.max(1, Math.round(pr.dmg * 0.6)), { x: pr.x, z: pr.z });
      }
    }
  },

  // ---------- praten, ruilen, scheren en melken ----------

  space(p, id) {
    const max = maxStack(id);
    let n = 0;
    for (const s of p.inv) { if (!s) n += max; else if (s.id === id) n += max - s.n; }
    return n;
  },

  // Tik op een wezen dat geen draak of Pluizel is. Geeft true als er iets mee gedaan is.
  useNpc(p, w, e) {
    const held = p.inv[p.sel], hid = held ? held.id : 0;
    const ai = e.def.ai;
    if (e.kind === 'schaap') {
      if (e.sheared !== undefined && this.meta.time - e.sheared < 90) { this.toast(p, 'Dit schaap is net geschoren. De wol moet nog groeien.'); return true; }
      e.sheared = this.meta.time;
      this.giveLoot(p, B.wol, 1 + (this.rnd() < 0.4 ? 1 : 0));
      this.fx(w.id, 'wool', e.x, e.y + 0.7, e.z);
      this.sendInv(p);
      return true;
    }
    if (e.kind === 'koe') {
      if (hid !== I.emmer) { this.toast(p, 'Boe! Met een emmer in je hand kun je de koe melken.'); return true; }
      if (this.space(p, I.melk) < 1 && held.n > 1) { this.toast(p, 'Je rugzak is vol!', 'warn'); return true; }
      held.n--; if (held.n <= 0) p.inv[p.sel] = null;
      this.giveLoot(p, I.melk, 1);
      this.fx(w.id, 'hearts', e.x, e.y + 1, e.z);
      this.sendInv(p);
      return true;
    }
    if (e.kind === 'wolf') {
      if (e.owner === p.name) {
        e.mode = e.mode === 'stay' ? 'follow' : 'stay';
        if (e.pet) e.pet.mode = e.mode;
        this.fx(w.id, 'hearts', e.x, e.y + 0.8, e.z);
        this.toast(p, e.mode === 'stay' ? 'Je wolf blijft hier wachten.' : 'Je wolf loopt weer met je mee.');
        return true;
      }
      if (e.owner) return true;
      if (hid !== I.bot) { this.toast(p, 'Wolven zijn dol op botten. Houd een bot vast en tik op de wolf.'); return true; }
      held.n--; if (held.n <= 0) p.inv[p.sel] = null;
      e.tameN = (e.tameN || 0) + 1; e.angry = 0;
      this.fx(w.id, 'hearts', e.x, e.y + 0.8, e.z);
      if (e.tameN >= 3) {
        e.owner = p.name; e.mode = 'follow'; e.herd = 0;
        e.pet = { uid: this.meta.nextId++, kind: 'wolf', world: w.id, x: e.x, y: e.y, z: e.z, mode: 'follow' };
        p.pets.push(e.pet);
        this.broadcast(w.id, { t: 'entMeta', id: e.id, o: p.name });
        this.toast(p, 'De wolf is nu je vriend! Hij vecht voor je.', 'good');
        this.addXp(p, 20);
      } else this.toast(p, 'De wolf kwispelt. Geef hem nog een bot!');
      this.sendInv(p);
      return true;
    }
    return false;
  },

  // ---------- kuddes ----------

  // Zet een kudde (of roedel) neer rond een plek. Geeft het aantal dieren.
  spawnHerd(w, kind, x, y, z) {
    const def = MOBS[kind];
    const [a, b] = def.herd;
    const n = a + Math.floor(this.rnd() * (b - a + 1));
    const lead = this.spawnEnt(w, kind, x + 0.5, y, z + 0.5);
    lead.herd = lead.id;
    for (let i = 1; i < n; i++) {
      const hx = Math.floor(x + (this.rnd() - 0.5) * 9), hz = Math.floor(z + (this.rnd() - 0.5) * 9);
      const top = w.topY(hx, hz, Math.min(127, Math.floor(y) + 8));
      if (top < 2 || Math.abs(top + 1 - y) > 5 || w.liquid(hx, top + 1, hz)) continue;
      const e = this.spawnEnt(w, kind, hx + 0.5, top + 1, hz + 0.5);
      e.herd = lead.id;
    }
    return n;
  },

  // ---------- het weer ----------

  weatherOf(wid) { const s = this.meta.weather && this.meta.weather[wid]; return s ? s.k : 'zon'; },

  setWeather(wid, k, dur) {
    if (!this.meta.weather) this.meta.weather = {};
    this.meta.weather[wid] = { k, until: this.meta.time + dur, bolt: 4 };
    this.broadcast(wid, { t: 'weather', k });
  },

  updateWeather(active) {
    for (const wid of WORLD_ORDER) {
      const table = WEATHER[wid];
      if (!table) continue;
      let s = this.meta.weather && this.meta.weather[wid];
      if (!s || this.meta.time >= s.until) {
        let k = 'zon';
        if (s && s.k === 'zon') {
          const r = this.rnd();
          let acc = 0;
          for (const [name, odds] of table) { acc += odds; if (r < acc) { k = name; break; } }
        }
        this.setWeather(wid, k, k === 'zon' ? 150 + this.rnd() * 240 : 70 + this.rnd() * 110);
        s = this.meta.weather[wid];
      }
      if (s.k === 'onweer' && active.has(wid)) {
        s.bolt = (s.bolt || 0) - 1;
        if (s.bolt <= 0) { s.bolt = 3 + this.rnd() * 8; this.lightning(wid); }
      }
    }
  },

  // De bliksem slaat ergens in de buurt van een speler in (nooit precies op de speler).
  lightning(wid) {
    const w = this.worlds[wid];
    const ps = [];
    for (const p of this.players.values()) if (p.world === wid && !p.dead) ps.push(p);
    if (!ps.length) return;
    const p = ps[Math.floor(this.rnd() * ps.length)];
    const a = this.rnd() * 6.283, r = 10 + this.rnd() * 38;
    const x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
    const top = w.topY(x, z);
    if (top < 2) return;
    this.fx(wid, 'bolt', x + 0.5, top + 1, z + 0.5);
    for (const e of Array.from(w.ents.values())) {
      if (!this.hostile(e)) continue;
      if (Math.hypot(e.x - x, e.z - z) < 4 && Math.abs(e.y - top) < 6) this.damageEntity(w, e, 24, null, e.x - x, e.z - z);
    }
  },

  wildDragonType(wid) { const l = WILD_DRAGONS[wid]; return l[Math.floor(this.rnd() * l.length)]; },
  wildDragonName(type) { return 'Wilde ' + DRAGONS[type].name.toLowerCase(); },
  eggOf(type) { return EGGS[type]; },
};

void clamp; void BLOCKS; void matches;