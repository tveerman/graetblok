// Het leven in de wereld: dorpelingen en handel, ridders en bewakers, kuddes, wolven, beren,
// wilde draken, het weer en de treinen.
// Deze functies worden aan GameServer geplakt (zie onderaan server.js).
import { DAY_LENGTH, clamp, isNight } from '../shared/constants.js';
import { B, BLOCKS, EGGS } from '../shared/blocks.js';
import { I, ITEMS, itemName, maxStack, matches, GROUP_NAMES } from '../shared/items.js';
import { WORLDS, WORLD_ORDER } from '../shared/worlds.js';
import { MOBS, DRAGONS, BREATH } from '../shared/mobs.js';

const M = I.munt;
const r2 = (v) => Math.round(v * 100) / 100;

// Beroepen. trades: [wat jij geeft, hoeveel, wat je krijgt, hoeveel]
export const JOBS = {
  dorpeling: { title: '', trades: [] },
  bakker: { title: 'Bakker', hi: 'Vers brood! Net uit de oven.',
    trades: [[M, 2, I.brood, 1], [M, 5, I.appeltaart, 1], [I.tarwe, 6, M, 2], [I.appel, 3, M, 1]] },
  kok: { title: 'Kok', hi: 'Welkom in het restaurant! Wat mag het zijn?',
    trades: [[M, 3, I.pannenkoek, 1], [M, 5, I.stoofpot, 1], [M, 12, I.heldenmaal, 1], [I.rauw_vlees, 2, M, 1], [I.bessen, 6, M, 1]] },
  smid: { title: 'Smid', hi: 'Goed staal, eerlijke prijzen. En ik koop al je staven.',
    trades: [[M, 10, I.houweel_ijzer, 1], [M, 10, I.zwaard_ijzer, 1], [M, 8, I.bijl_ijzer, 1], [M, 24, I.harnas_ijzer, 1], [M, 2, I.pijl, 8],
      [I.ijzerstaaf, 1, M, 2], [I.koperstaaf, 1, M, 1], [I.goudstaaf, 1, M, 4], [I.steenkool, 4, M, 1]] },
  winkelier: { title: 'Winkelier', hi: 'Kijk gerust rond. Ik heb van alles!',
    trades: [[M, 2, B.fakkel, 6], [M, 4, B.lantaarn, 1], [M, 6, B.bed, 1], [M, 5, I.emmer, 1], [M, 8, I.boog, 1],
      [B.wol, 2, M, 1], [I.leer, 2, M, 1], [I.draad, 3, M, 1], [I.bot, 3, M, 1]] },
  boer: { title: 'Boer', hi: 'Alles vers van het land.',
    trades: [[M, 1, I.tarwe, 4], [M, 2, B.pompoen, 1], [M, 1, I.appel, 2], [M, 3, B.hooi, 2], [I.bessen, 8, M, 1]] },
  houthakker: { title: 'Houthakker', hi: 'Hout nodig? Of heb je stammen voor mij?',
    trades: [[M, 1, B.planken, 8], [M, 2, B.stam_eik, 6], [M, 6, I.bijl_ijzer, 1], ['stam', 8, M, 1]] },
  juwelier: { title: 'Juwelier', hi: 'Oooh, heb je edelstenen gevonden? Laat eens zien!',
    trades: [[I.robijn, 1, M, 8], [I.saffier, 1, M, 8], [I.smaragd, 1, M, 8], [I.amethist, 1, M, 4], [I.kristal, 1, M, 5], [B.gloeikristal, 2, M, 1],
      [M, 30, I.verrekijker, 1], [M, 45, I.springlaarzen, 1], [M, 12, B.lamp, 2]] },
  mijnwerker: { title: 'Mijnwerker', hi: 'Het mijnbedrijf koopt alles wat uit de grond komt.',
    trades: [[M, 6, B.dynamiet, 2], [M, 14, I.houweel_ijzer, 1], [M, 3, B.fakkel, 8],
      [B.keisteen, 16, M, 1], [B.ijzer_erts, 2, M, 3], [B.koper_erts, 2, M, 2], [B.goud_erts, 1, M, 3], [B.marmer, 8, M, 2]] },
  marktkoopman: { title: 'Marktkoopman', hi: 'Appels, bessen, drankjes! Kom dat zien!',
    trades: [[M, 1, I.bessen, 4], [M, 1, I.appel, 2], [M, 2, I.gebraden_vlees, 1], [M, 4, I.drankje, 1]] },
  drakenhandelaar: { title: 'Drakenhandelaar', hi: 'Psst... zoek je iets bijzonders? Ik heb eieren van heel ver weg.',
    trades: [[M, 40, B.ei_vuur, 1], [M, 40, B.ei_ijs, 1], [M, 50, B.ei_bliksem, 1], [M, 50, B.ei_schaduw, 1], [M, 80, B.ei_kristal, 1],
      [M, 6, I.drakenschub, 1], [I.drakenschub, 1, M, 4]] },
  koning: { title: 'Koning', hi: 'Welkom in mijn kasteel, dappere held. Breng mij de kroon van de Skeletkoning en ik beloon je rijkelijk!',
    trades: [[I.spookkroon, 1, M, 100], [M, 100, B.ei_goud, 1], [M, 60, I.ridderharnas, 1], [M, 30, I.zwaard_zilver, 1], [I.drakenschub, 2, M, 10]] },
};
const NAMES = ['Sanne', 'Daan', 'Lotte', 'Bram', 'Fenna', 'Joep', 'Noor', 'Siem', 'Tess', 'Gijs', 'Jet', 'Koen', 'Maud', 'Pim', 'Roos', 'Teun', 'Vera', 'Wout', 'Yara', 'Ties', 'Mila', 'Finn', 'Evi', 'Stijn'];
const KINGS = ['Alfred', 'Boudewijn', 'Karel', 'Lodewijk', 'Willem', 'Floris'];
const TIPS = [
  'Wat een mooie dag! Heb je het kasteel al gezien? Volg het torentje op je kompas.',
  '\'s Nachts komen de spinnen en de skeletten. Blijf dan maar in het dorp: de ridders passen op.',
  'Met een paar botten kun je een wolf temmen. Dan loopt hij met je mee en vecht hij voor je.',
  'Tik op een schaap en je krijgt wol. En met een emmer kun je een koe melken!',
  'De trein rijdt naar het volgende dorp. De stationschef verkoopt locomotieven en rails.',
  'Trollen bewaken hun schat in een kamp met een palissade. Pas op voor de hoofdman!',
  'Als het onweert kun je beter niet buiten blijven staan. Bliksem!',
  'Ze zeggen dat er wilde draken door de lucht vliegen. Blijf uit hun buurt, anders spuwen ze vuur.',
  'Verkoop je edelstenen aan de juwelier. Die betaalt er goed voor.',
  'In het spookkasteel woont de Skeletkoning. Onze koning geeft honderd munten voor zijn kroon.',
];
const GUARD_LINES = ['Wees gerust, wij houden de wacht.', 'Geen monster komt hier voorbij!', 'Goedendag, reiziger.', 'Blijf \'s nachts dicht bij de fakkels.'];
const TREE_LINES = ['Hrrrm... de boom leeft weer. Dank je, kleine vriend.', 'Wij waken over de wortels.', 'De magie stroomt. Ik voel het in mijn takken.'];

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

  // ---------- bouwwerken en hun bewoners ----------

  treeSite(w) {
    const T = WORLDS[w.id].tree;
    return { key: 'boom', kind: 'boom', x: T.x, y: T.y, z: T.z, r0: 30, r1: 40, name: '' };
  },

  // elke seconde, per speler: bewoners neerzetten bij bouwwerken waar je in de buurt komt
  updateSites(p) {
    const w = this.worlds[p.world], gen = w.gen;
    const near = gen.sitesNear(p.x, p.z, 170);
    near.push(this.treeSite(w));
    let inside = null;
    for (const s of near) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < s.r0 + 60 && !w.pop.has(s.key)) this.populate(w, s);
      if (d < s.r0 - 6 && s.name) inside = s;
    }
    if (inside) {
      if (p.inSite !== inside.key) {
        p.inSite = inside.key;
        this.toast(p, (inside.kind === 'dorp' ? 'Welkom in ' : inside.kind === 'kamp' ? 'Pas op: je bent bij ' : 'Je bent bij ') + inside.name + (inside.evil && inside.kind === 'kasteel' ? '. Het spookt hier...' : '!'), inside.evil ? 'boss' : 'good');
      }
    } else p.inSite = null;
    // het kompas wijst naar dorpen en kastelen in de buurt
    const cell = Math.floor(p.x / 224) + ',' + Math.floor(p.z / 224);
    if (cell !== p.siteCell) { p.siteCell = cell; this.sendSites(p); }
  },

  sendSites(p) {
    const w = this.worlds[p.world];
    const l = [];
    for (const s of w.gen.sitesNear(p.x, p.z, 560)) l.push([s.kind === 'dorp' ? 0 : s.kind === 'kasteel' ? (s.evil ? 2 : 1) : 3, s.x, s.z, s.name]);
    this.send(p, { t: 'sites', l });
  },

  populate(w, s) {
    const ids = [];
    const key = w.id + ':' + s.key;
    const cl = this.meta.cleared && this.meta.cleared[key];
    const empty = cl !== undefined && this.meta.time - cl < DAY_LENGTH * 4;      // de baas is verslagen: het blijft een paar dagen rustig
    const list = s.kind === 'boom' ? this.treeGuards(w, s) : w.gen.sitePlan(s).npcs;
    let n = 0;
    for (const q of list) {
      n++;
      const def = MOBS[q.k];
      const bad = def.ai === 'melee' || def.ai === 'ranged';
      if (bad && empty && s.kind !== 'boom') continue;
      let y = q.y, guard = 0;
      const bx = Math.floor(q.x), bz = Math.floor(q.z);
      while (w.solid(bx, Math.floor(y), bz) && guard++ < 6) y++;
      while (!w.solid(bx, Math.floor(y) - 1, bz) && guard++ < 14 && y > 2) y--;
      const extra = { site: s.key, home: { x: q.x, y, z: q.z, r: q.r || 4, yaw: q.yaw } };
      if (q.job) {
        extra.job = q.job;
        const h = (Math.abs(Math.floor(q.x) * 7919 + Math.floor(q.z) * 104729) + n * 31) >>> 0;
        extra.look = h % 1000;
        const first = q.job === 'koning' ? KINGS[h % KINGS.length] : NAMES[h % NAMES.length];
        extra.name = JOBS[q.job].title ? JOBS[q.job].title + ' ' + first : first;
      }
      const e = this.spawnEnt(w, q.k, q.x, y, q.z, extra);
      if (q.yaw !== undefined) e.yaw = q.yaw;
      ids.push(e.id);
    }
    w.pop.set(s.key, { site: s, ids });
  },

  depopulate(w, key) {
    const rec = w.pop.get(key);
    if (!rec) return;
    for (const id of rec.ids) w.ents.delete(id);
    w.pop.delete(key);
  },

  // De bewakers van een levensboom: doornwachters zolang de boom ziek is, daarna boomwachters.
  treeGuards(w, s) {
    const alive = !!this.meta.trees[WORLDS[w.id].tree.key];
    const list = [];
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + 0.6;
      const x = Math.floor(s.x + Math.cos(a) * 22) + 0.5, z = Math.floor(s.z + Math.sin(a) * 22) + 0.5;
      const top = w.topY(Math.floor(x), Math.floor(z), Math.min(127, s.y + 12));
      if (top < 2 || w.liquid(Math.floor(x), top + 1, Math.floor(z))) continue;
      list.push({ k: alive ? 'boomwachter' : 'doornwachter', x, y: top + 1, z, r: 7 });
    }
    return list;
  },

  // Staat hier een dorp of een bewoond kasteel? (daar komen geen monsters uit de grond)
  safePlace(w, x, z) {
    for (const s of w.gen.sitesNear(x, z, 90)) if (!s.evil && Math.hypot(s.x - x, s.z - z) < s.r0 + 10) return true;
    return false;
  },

  // ---------- gedrag ----------

  aiNpc(w, e, dt) {
    const h = e.home;
    if (e.talk > 0) e.talk -= dt;
    const n = this.nearest(w, e, 4.5);
    if (n || e.talk > 0) {
      if (n) e.yaw = Math.atan2(n.p.x - e.x, n.p.z - e.z);
      e.vx = 0; e.vz = 0;
      return;
    }
    if (!h) { this.wander(w, e, dt); return; }
    const dx = h.x - e.x, dz = h.z - e.z, d = Math.hypot(dx, dz);
    const night = WORLDS[w.id].cycle && isNight(this.meta.time);
    if (d > (night ? Math.min(h.r, 1.5) : h.r)) {
      const sp = e.def.speed * (d > h.r + 5 ? 1 : 0.6);
      e.vx = dx / d * sp; e.vz = dz / d * sp; e.yaw = Math.atan2(dx, dz);
      if (d > 40) { e.x = h.x; e.y = h.y; e.z = h.z; e.vy = 0; }          // helemaal verdwaald: terug naar huis
      return;
    }
    if (h.r < 2 || night) { e.vx = 0; e.vz = 0; if (h.yaw !== undefined) e.yaw = h.yaw; return; }
    this.wander(w, e, dt);
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

  aiGuard(w, e, dt) {
    const m = this.findFoe(w, e, e.x, e.y, e.z, 15, dt);
    if (m) { this.chase(w, e, m, e.def.dmg, 1.0); return; }
    this.aiNpc(w, e, dt);
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
    if (e.job) {
      const J = JOBS[e.job];
      e.talk = 25;
      let say = J.hi || TIPS[(e.id + Math.floor(this.meta.time / 40)) % TIPS.length];
      if (!p.flags.welkom) {
        p.flags.welkom = 1;
        this.giveLoot(p, M, 5); this.sendInv(p);
        say = 'Welkom, vreemdeling! Hier heb je vijf gouden munten om mee te beginnen. ' + say;
      }
      this.send(p, { t: 'trade', id: e.id, name: e.name, say, offers: J.trades });
      return true;
    }
    if (ai === 'guard') {
      const lines = e.kind === 'boomwachter' ? TREE_LINES : GUARD_LINES;
      this.toast(p, e.def.name + ': "' + lines[(e.id + Math.floor(this.meta.time / 30)) % lines.length] + '"');
      return true;
    }
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

  on_trade(p, m) {
    const w = this.worlds[p.world], e = w.ents.get(m.id);
    if (!e || !e.job || Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z) > 9) return;
    const T = JOBS[e.job].trades[m.i | 0];
    if (!T) return;
    const [pay, pn, get, gn] = T;
    if (this.count(p, pay) < pn) { this.toast(p, 'Je hebt niet genoeg: ' + pn + ' × ' + (typeof pay === 'string' ? GROUP_NAMES[pay] : itemName(pay)) + '.', 'warn'); return; }
    if (this.space(p, get) < gn) { this.toast(p, 'Je rugzak is vol!', 'warn'); return; }
    this.take(p, pay, pn);
    this.give(p, get, gn);
    e.talk = 25;
    this.send(p, { t: 'traded', id: get, n: gn });
    if (pay === I.spookkroon) {
      this.send(p, { t: 'dialog', title: 'De koning is je dankbaar', lines: ['"De Skeletkoning is verslagen! Het hele land is je dankbaar, held."', 'Je krijgt honderd gouden munten. Daarvoor kun je bij de koning een gouden drakenei kopen.'] });
      this.addXp(p, 150);
    }
    this.sendInv(p);
    this.checkQuests(p);
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
