// De wereldkaart: de server rekent uit hoe het land eruitziet (ook waar je nog nooit bent
// geweest) en stuurt het als een raster van kleurnummers en hoogtes naar het scherm. Verder:
// de markering die de speler op de kaart zet, en die daarna op het kompas staat.
import { B } from '../shared/blocks.js';
import { WORLDS, CRASH } from '../shared/worlds.js';

export const MAP_N = 128;                      // de kaart is 128 bij 128 vakjes
export const MAP_STEPS = [4, 6, 8, 12, 16, 24, 32, 48, 64, 80];      // hoeveel blokken één vakje is, van dichtbij tot de hele wereld

// kleurnummer per soort grond (de kleuren zelf staan in het scherm: MAP_COLORS in ui.js)
const TOP = {
  [B.zand]: 4, [B.gras]: 5, [B.sneeuw]: 7, [B.steen]: 8, [B.ijs]: 9, [B.modder]: 10, [B.basalt]: 11, [B.magmasteen]: 12, [B.obsidiaan]: 11,
  [B.gloeimos]: 13, [B.amethistblok]: 14, [B.schaduwgras]: 15, [B.schaduwsteen]: 16, [B.as]: 17, [B.hemelgras]: 18, [B.zandsteen]: 4,
};
const SITE_CODE = { dorp: 0, circuit: 4, pretpark: 5, stad: 6, vliegveld: 7, wachttoren: 8, doolhof: 9, tempel: 10, kamp: 3 };

// de woorden waarop je een soort plek kunt vinden (naast zijn eigen naam)
const ZOEK_SOORT = { 0: ['dorp'], 1: ['kasteel', 'burcht'], 2: ['spookkasteel', 'kasteel'], 3: ['trollenkamp', 'kamp', 'trol'], 4: ['racebaan', 'circuit', 'race'], 5: ['kermis', 'pretpark'],
  6: ['stad'], 7: ['vliegveld', 'luchthaven'], 8: ['wachttoren', 'toren'], 9: ['doolhof', 'heggendoolhof'], 10: ['tempel'] };
const ZOEK_GEBIED = [['oceaan', 'De Diepe Oceaan', ['oceaan', 'zee']], ['woestijn', 'De Woestijn', ['woestijn', 'zand', 'cactus']], ['gebergte', 'Het Hooggebergte', ['gebergte', 'bergen', 'berg']],
  ['zwammen', 'Het Paddenstoelenwoud', ['paddenstoel', 'zwam']], ['kristal', 'De Kristalvelden', ['kristal']], ['oerwoud', 'Het Oerwoud', ['oerwoud', 'jungle']],
  ['wilgen', 'Het Wilgenbos', ['wilg', 'bos']], ['linden', 'Het Lindebos', ['linde', 'bos']], ['essen', 'Het Essenbos', ['essen', 'bos']], ['rivier', 'Een brede rivier', ['rivier', 'water']]];

export const mapMethods = {

  sendMap(p, x, z, stap) {
    if (!MAP_STEPS.includes(stap)) stap = MAP_STEPS[1];
    const w = this.worlds[p.world], gen = w.gen, N = MAP_N;
    x = Math.round(x); z = Math.round(z);
    const k = new Uint8Array(N * N), h = new Uint8Array(N * N);
    const x0 = x - (N / 2) * stap, z0 = z - (N / 2) * stap;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const c = gen.col(x0 + i * stap, z0 + j * stap);
      let kl;
      if (c.liq === B.lava) kl = 3;
      else if (c.liq) kl = c.ly - c.h >= 6 ? 2 : 1;                 // diep of ondiep water
      else if (c.h <= 2) kl = 0;                                     // lucht (tussen de eilanden van de wolkenwereld)
      else { kl = TOP[c.top] || 8; if (kl === 5 && c.tp > 0.012) kl = 6; }      // gras met bomen = bos
      k[i + j * N] = kl; h[i + j * N] = c.h;
    }
    const half = (N / 2) * stap, sites = [];
    const binnen = (s) => Math.abs(s.x - x) < half && Math.abs(s.z - z) < half;
    for (const s of gen.sitesNear(x, z, half * 1.42)) if (binnen(s)) sites.push([s.kind === 'kasteel' ? (s.evil ? 2 : 1) : SITE_CODE[s.kind], s.x, s.z, s.name]);
    if (gen.smallNear && stap <= 32) for (const s of gen.smallNear(x, z, half * 1.42)) if (binnen(s)) sites.push([SITE_CODE[s.kind], s.x, s.z, s.name]);
    const T = WORLDS[p.world].tree;
    sites.push([20, T.x, T.z, T.name]);
    if (p.world === 'groen') sites.push([21, CRASH.x, CRASH.z, 'Het ruimteschip']);
    const mk = p.flags.kaartMark;
    this.send(p, { t: 'kaart', x, z, stap, n: N, k, h, sites, px: p.x, pz: p.z, yaw: p.yaw, mark: mk && mk.w === p.world ? mk : null, wereld: WORLDS[p.world].name });
  },

  // Zoeken op de kaart: op de naam van een plek ("Lindeburg"), op een soort plek ("tempel",
  // "kasteel") of op een gebied ("woestijn", "rivier"). Geeft de dichtstbijzijnde treffers.
  searchMap(p, q) {
    q = String(q || '').toLowerCase().trim().slice(0, 30);
    const w = this.worlds[p.world], gen = w.gen, res = [];
    if (q.length < 2) { this.send(p, { t: 'kaartZoek', q, res }); return; }
    const d = (x, z) => Math.round(Math.hypot(x - p.x, z - p.z));
    const past = (...woorden) => woorden.some((s) => s && s.toLowerCase().includes(q));
    for (const s of gen.sitesNear(p.x, p.z, 5000)) {
      const code = s.kind === 'kasteel' ? (s.evil ? 2 : 1) : SITE_CODE[s.kind];
      if (past(s.name, ...(ZOEK_SOORT[code] || []))) res.push([code, s.name, s.x, s.z, d(s.x, s.z)]);
    }
    if (gen.smallNear) for (const s of gen.smallNear(p.x, p.z, 3500)) {
      const code = SITE_CODE[s.kind];
      if (past(s.name, ...(ZOEK_SOORT[code] || []))) res.push([code, s.name, s.x, s.z, d(s.x, s.z)]);
    }
    const T = WORLDS[p.world].tree;
    if (past(T.name, 'levensboom', 'boom')) res.push([20, T.name, T.x, T.z, d(T.x, T.z)]);
    if (p.world === 'groen' && past('het ruimteschip', 'schip', 'raket')) res.push([21, 'Het ruimteschip', CRASH.x, CRASH.z, d(CRASH.x, CRASH.z)]);
    // gebieden: het dichtstbijzijnde stuk, in steeds grotere kringen om de speler gezocht
    if (gen.biome) for (const [k, naam, woorden] of ZOEK_GEBIED) {
      if (!past(naam, ...woorden)) continue;
      let best = null;
      for (let r = 0; r < 9000 && !best; r += 70) for (let a = 0; a < 6.28; a += r ? 70 / r : 7) {
        const x = Math.round(p.x + Math.cos(a) * r), z = Math.round(p.z + Math.sin(a) * r);
        if (k === 'rivier') { const v = gen.river(x, z); if (v > 0.6) { best = [x, z]; break; } }
        else { const b = gen.biome(x, z); if (b && b.k === k && b.w > 0.9) { best = [x, z]; break; } }
      }
      if (best) res.push([30, naam, best[0], best[1], d(best[0], best[1])]);
    }
    res.sort((a, b) => a[4] - b[4]);
    this.send(p, { t: 'kaartZoek', q, res: res.slice(0, 15), meer: Math.max(0, res.length - 15) });
  },

  on_kaart(p, m) {
    if (m.c === 'zoek') { this.searchMap(p, m.q); return; }
    if (m.c === 'mark') {
      p.flags.kaartMark = { w: p.world, x: Math.round(+m.mx || 0), z: Math.round(+m.mz || 0) };
      this.send(p, { t: 'mark', m: p.flags.kaartMark });
      this.toast(p, '📍 Markering gezet. Je kompas wijst er nu naartoe.', 'good');
    } else if (m.c === 'wis') {
      p.flags.kaartMark = null;
      this.send(p, { t: 'mark', m: null });
    }
    // (x, z) = het midden van wat de speler op de kaart wil zien; zonder die twee: waar hij staat
    this.sendMap(p, m.x === undefined ? p.x : +m.x || 0, m.z === undefined ? p.z : +m.z || 0, m.stap | 0);
  },
};
