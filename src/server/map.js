// De wereldkaart: de server rekent uit hoe het land eruitziet (ook waar je nog nooit bent
// geweest) en stuurt het als een raster van kleurnummers en hoogtes naar het scherm. Verder:
// de markering die de speler op de kaart zet, en die daarna op het kompas staat.
import { B } from '../shared/blocks.js';
import { WORLDS, CRASH } from '../shared/worlds.js';

export const MAP_N = 128;                      // de kaart is 128 bij 128 vakjes
export const MAP_STEPS = [4, 12, 32, 80];      // hoeveel blokken één vakje is, van dichtbij tot de hele wereld

// kleurnummer per soort grond (de kleuren zelf staan in het scherm: MAP_COLORS in ui.js)
const TOP = {
  [B.zand]: 4, [B.gras]: 5, [B.sneeuw]: 7, [B.steen]: 8, [B.ijs]: 9, [B.modder]: 10, [B.basalt]: 11, [B.magmasteen]: 12, [B.obsidiaan]: 11,
  [B.gloeimos]: 13, [B.amethistblok]: 14, [B.schaduwgras]: 15, [B.schaduwsteen]: 16, [B.as]: 17, [B.hemelgras]: 18, [B.zandsteen]: 4,
};
const SITE_CODE = { dorp: 0, circuit: 4, pretpark: 5, stad: 6, vliegveld: 7, wachttoren: 8, doolhof: 9, tempel: 10, kamp: 3 };

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

  on_kaart(p, m) {
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
