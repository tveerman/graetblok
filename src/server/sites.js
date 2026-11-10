// Bouwwerken in de wereld: dorpen, kastelen, trollenkampen en de spoorlijnen ertussen.
//
// De wereld is verdeeld in grote vakken (SITE_CELL blokken breed). In elk vak staat hoogstens
// één bouwwerk. Welk bouwwerk, en waar precies, hangt alleen af van het zaadje van de wereld:
// dezelfde plek ziet er dus altijd hetzelfde uit. Rond een bouwwerk wordt de grond vlak gemaakt
// (zie applySite, dat door col() in worldgen.js wordt aangeroepen).
//
// Een "plan" beschrijft een bouwwerk: welke gebouwen er staan en welke bewoners erbij horen.
// De wereldgenerator tekent met het plan de blokken; de server zet met hetzelfde plan de
// bewoners neer (zie npcs.js).
//
// Deze functies worden aan WorldGen geplakt (zie onderaan worldgen.js).
import { CH, SEA, idx, lerp, smoothstep } from '../shared/constants.js';
import { hash2, hash3, mulberry32 } from '../shared/noise.js';
import { B, bedFoot, bedHead } from '../shared/blocks.js';
import { CRASH, NEST_PEAK } from '../shared/worlds.js';

export const SITE_CELL = 224;

// kans per vak op een dorp, een kasteel of een kamp (de rest blijft leeg)
const SITE_ODDS = {
  groen: { dorp: 0.5, kasteel: 0.18, kamp: 0.18 },
  ijs: { dorp: 0.3, kasteel: 0.1, kamp: 0.2 },
  schaduw: { dorp: 0, kasteel: 0.1, kamp: 0.16 },
};
// r0 = tot hier is de grond helemaal vlak, r1 = vanaf hier is het weer gewoon landschap
const SITE_R = { dorp: [44, 62], kasteel: [56, 76], kamp: [15, 27] };
const J_OFF = 30;            // het station (en het knooppunt van de rails) ligt zo ver ten zuidoosten van het dorpsplein

const DX = [1, 0, -1, 0], DZ = [0, 1, 0, -1];

const PAL = {
  groen: { wall: B.vakwerk, base: B.keisteen, wood: B.planken, log: B.stam_eik, roof: B.dakpan, thatch: B.stro, floor: B.planken, road: B.grind, land: B.gras, under: B.aarde },
  ijs: { wall: B.planken, base: B.keisteen, wood: B.planken, log: B.stam_den, roof: B.sneeuw, thatch: B.sneeuw, floor: B.planken, road: B.grind, land: B.sneeuw, under: B.sneeuw },
  schaduw: { wall: B.schaduwsteen, base: B.schaduwsteen, wood: B.planken, log: B.stam_schaduw, roof: B.spookmuur, thatch: B.spookmuur, floor: B.planken, road: B.grind, land: B.schaduwgras, under: B.schaduwsteen },
};
const CASTLE = {
  goed: { wall: B.kasteelmuur, trim: B.steenblok, roof: B.dakpan, floor: B.steenblok, hall: B.marmerblok, carpet: B.wol_rood, banner: B.wol_blauw, pillar: B.marmerzuil, yard: B.grind },
  spook: { wall: B.spookmuur, trim: B.basalt, roof: B.spookmuur, floor: B.basalt, hall: B.granietblok, carpet: B.wol_rood, banner: B.wol_rood, pillar: B.spookmuur, yard: B.as },
  ijs: { wall: B.ijs, trim: B.sneeuw, roof: B.sneeuw, floor: B.steenblok, hall: B.marmerblok, carpet: B.wol_blauw, banner: B.wol_blauw, pillar: B.ijs, yard: B.sneeuw },
};

const DORP_A = ['Linde', 'Eiken', 'Beuken', 'Molen', 'Zonne', 'Wilgen', 'Vossen', 'Uilen', 'Honing', 'Appel', 'Draken', 'Klaver', 'Zwanen', 'Bloemen', 'Regenboog', 'Sterren'];
const DORP_B = ['dorp', 'hoven', 'veld', 'dam', 'burg', 'wijk', 'huizen', 'rode', 'berg', 'dal'];
const IJS_A = ['Sneeuw', 'Vorst', 'IJzel', 'Winter', 'Rijp', 'Noorder', 'Kristal', 'Pinguïn'];
const BURCHT = ['Valkenstein', 'Leeuwenburg', 'Drakenrots', 'Zonneburcht', 'Adelaarsnest', 'Zilvertoren', 'Hoogwacht', 'Koningsveste'];
const SPOOK = ['Ravenrots', 'Schimmenburg', 'Bottenstein', 'Nachtveste', 'Spinnentoren', 'Doodskop', 'Grafburcht', 'Mistwacht'];

// Tekenen in één chunk: alles wat buiten de chunk valt wordt overgeslagen.
function canvas(blocks, ox, oz) {
  const set = (x, y, z, id) => {
    const lx = x - ox, lz = z - oz;
    if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 1 || y >= CH) return;
    blocks[idx(lx, y, lz)] = id;
  };
  const fill = (x0, y0, z0, x1, y1, z1, id) => {
    if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
    if (z0 > z1) { const t = z0; z0 = z1; z1 = t; }
    if (y0 > y1) { const t = y0; y0 = y1; y1 = t; }
    const a = Math.max(x0, ox), b = Math.min(x1, ox + 15), c = Math.max(z0, oz), d = Math.min(z1, oz + 15);
    if (a > b || c > d) return;
    if (y0 < 1) y0 = 1; if (y1 > CH - 1) y1 = CH - 1;
    for (let x = a; x <= b; x++) for (let z = c; z <= d; z++) {
      const p = idx(x - ox, 0, z - oz);
      for (let y = y0; y <= y1; y++) blocks[p + y] = id;
    }
  };
  const get = (x, y, z) => {
    const lx = x - ox, lz = z - oz;
    if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 0 || y >= CH) return -1;
    return blocks[idx(lx, y, lz)];
  };
  const hit = (x0, z0, x1, z1) => !(Math.max(x0, x1) < ox || Math.min(x0, x1) > ox + 15 || Math.max(z0, z1) < oz || Math.min(z0, z1) > oz + 15);
  return { set, fill, get, hit, ox, oz };
}

// Een eigen assenstelsel voor een gebouw: i loopt langs de weg, j van de weg af, y omhoog.
function frame(S, bx, by, bz, ax, az, px, pz) {
  const X = (i, j) => bx + ax * i + px * j, Z = (i, j) => bz + az * i + pz * j;
  return {
    set: (i, j, y, id) => S.set(X(i, j), by + y, Z(i, j), id),
    fill: (i0, j0, y0, i1, j1, y1, id) => S.fill(X(i0, j0), by + y0, Z(i0, j0), X(i1, j1), by + y1, Z(i1, j1), id),
    hit: (i0, j0, i1, j1) => S.hit(X(i0, j0), Z(i0, j0), X(i1, j1), Z(i1, j1)),
    X, Z, by,
    // de richting waarin het hoofdeind van een bed wijst, als het bed langs de i-as ligt
    dirI: ax > 0 ? 0 : ax < 0 ? 2 : az > 0 ? 1 : 3,
  };
}

// ---------- gebouwen ----------

// Een huis met vier muren en een puntdak. o: wall, roof, h (muurhoogte), open (voorkant open),
// awning (luifel boven de deur), floor.
function house(T, w, d, P, o = {}) {
  const wall = o.wall || P.wall, roof = o.roof || P.roof, h = o.h || 4, mid = w >> 1;
  T.fill(0, 0, -2, w - 1, d - 1, -1, P.base);
  T.fill(1, 1, 1, w - 2, d - 2, h + 5, 0);
  T.fill(0, 0, 0, w - 1, d - 1, 0, o.floor || P.floor);
  T.fill(0, 0, 1, w - 1, 0, h, wall); T.fill(0, d - 1, 1, w - 1, d - 1, h, wall);
  T.fill(0, 0, 1, 0, d - 1, h, wall); T.fill(w - 1, 0, 1, w - 1, d - 1, h, wall);
  if (wall === P.wall) {
    T.fill(0, 0, 1, w - 1, 0, 1, P.base); T.fill(0, d - 1, 1, w - 1, d - 1, 1, P.base);
    T.fill(0, 0, 1, 0, d - 1, 1, P.base); T.fill(w - 1, 0, 1, w - 1, d - 1, 1, P.base);
  }
  for (const [ci, cj] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) T.fill(ci, cj, 1, ci, cj, h, P.log);
  const half = Math.ceil(d / 2);
  for (let k = 0; k <= half; k++) {
    const j0 = -1 + k, j1 = d - k;
    if (j0 > j1) break;
    T.fill(-1, j0, h + 1 + k, w, j0, h + 1 + k, roof);
    T.fill(-1, j1, h + 1 + k, w, j1, h + 1 + k, roof);
    if (j0 + 1 <= j1 - 1) { T.fill(0, j0 + 1, h + 1 + k, 0, j1 - 1, h + 1 + k, wall); T.fill(w - 1, j0 + 1, h + 1 + k, w - 1, j1 - 1, h + 1 + k, wall); }
  }
  if (o.open) T.fill(1, 0, 1, w - 2, 0, 3, 0);
  else {
    T.fill(mid, 0, 1, mid, 0, 2, 0);
    if (w >= 7) { T.set(mid - 2, 0, 2, B.glas); T.set(mid + 2, 0, 2, B.glas); }
    T.set(mid + 1, 0, 3, B.lantaarn);
  }
  T.set(0, d >> 1, 2, B.glas); T.set(w - 1, d >> 1, 2, B.glas);
  T.set(mid, d - 1, 3, B.lantaarn);
  T.fill(mid, -2, 0, mid, -1, 0, P.road);
  if (o.awning) T.fill(mid - 1, -1, 3, mid + 1, -1, 3, B.luifel);
}

// Wat er in elk soort gebouw staat. Geeft de plek van de bewoner terug: [i, j].
const INSIDE = {
  huis(T, w, d, P) {
    T.set(1, d - 2, 1, bedFoot(T.dirI)); T.set(2, d - 2, 1, bedHead(T.dirI));
    T.set(w - 2, d - 2, 1, B.tafel); T.set(w - 2, d - 3, 1, B.kruk);
    T.set(1, 1, 1, B.boekenkast); T.set(1, 1, 2, B.boekenkast);
    T.set(w - 2, 1, 1, B.werkbank);
    void P;
    return [w >> 1, -3];
  },
  bakkerij(T, w, d) {
    T.fill(1, 3, 1, w - 3, 3, 1, B.tafel);
    T.set(1, d - 2, 1, B.oven); T.set(2, d - 2, 1, B.oven); T.set(1, d - 2, 2, B.baksteen); T.set(2, d - 2, 2, B.baksteen);
    T.set(w - 2, d - 2, 1, B.hooi);
    return [w >> 1, 4];
  },
  winkel(T, w, d) {
    T.fill(1, 3, 1, w - 3, 3, 1, B.tafel);
    T.fill(1, d - 2, 1, w - 2, d - 2, 2, B.boekenkast);
    T.set(w - 2, 1, 1, B.werkbank);
    return [w >> 1, 4];
  },
  smederij(T, w, d) {
    T.set(3, 2, 1, B.aambeeld);
    T.set(1, d - 2, 1, B.oven); T.set(2, d - 2, 1, B.oven); T.set(1, d - 2, 2, B.keisteen); T.set(2, d - 2, 2, B.keisteen);
    T.set(w - 2, d - 2, 1, B.ijzerblok); T.set(w - 2, d - 3, 1, B.kookpot);
    T.set(w - 2, 1, 1, B.werkbank);
    return [4, 3];
  },
  restaurant(T, w, d) {
    for (const [i, j] of [[1, 1], [1, 4], [w - 2, 1], [w - 2, 4]]) { T.set(i, j, 1, B.tafel); T.set(i, j + 1, 1, B.kruk); T.set(i === 1 ? 2 : w - 3, j, 1, B.kruk); }
    T.fill(2, d - 3, 1, w - 3, d - 3, 1, B.tafel);
    T.set(2, d - 2, 1, B.kookpot); T.set(w - 3, d - 2, 1, B.oven);
    return [w >> 1, d - 2];
  },
  boerderij(T, w, d) {
    T.fill(1, d - 2, 1, 2, d - 2, 2, B.hooi); T.set(3, d - 2, 1, B.hooi); T.set(w - 2, d - 2, 1, B.hooi);
    T.set(w - 2, 1, 1, B.werkbank);
    // de akker achter de schuur: tarwe, pompoenen en een slootje in het midden
    T.fill(-1, d + 1, 1, w, d + 8, 6, 0);
    T.fill(-1, d + 1, 0, w, d + 8, 0, B.akker);
    T.fill(-1, d + 4, 0, w, d + 4, 0, B.water);
    for (let i = -1; i <= w; i++) for (let j = d + 1; j <= d + 8; j++) {
      if (j === d + 4) continue;
      const r = hash2(T.X(i, j), T.Z(i, j), 8801);
      T.set(i, j, 1, r < 0.07 ? B.pompoen : r < 0.9 ? B.tarwe : 0);
    }
    return [w >> 1, -3];
  },
  zagerij(T, w, d, P) {
    T.fill(1, d - 2, 1, w - 2, d - 2, 1, P.log); T.fill(2, d - 2, 2, w - 3, d - 2, 2, P.log);
    T.set(1, 2, 1, B.werkbank); T.set(w - 2, 2, 1, P.wood); T.set(w - 2, 2, 2, P.wood); T.set(w - 2, 3, 1, P.wood);
    return [w >> 1, 3];
  },
  juwelier(T, w, d) {
    T.fill(1, 3, 1, w - 3, 3, 1, B.tafel);
    const gems = [B.robijnblok, B.saffierblok, B.smaragdblok, B.amethistblok, B.kristalblok];
    for (let i = 1; i <= w - 2; i++) T.set(i, d - 2, 1, i & 1 ? gems[(i >> 1) % 5] : B.marmerzuil);
    return [w >> 1, 4];
  },
  mijn(T, w, d) {
    T.fill(1, 3, 1, w - 3, 3, 1, B.tafel);
    const ores = [B.steenkool_erts, B.ijzer_erts, B.koper_erts, B.goud_erts, B.zilver_erts];
    for (let i = 1; i <= w - 2; i++) T.set(i, d - 2, 1, ores[(i - 1) % 5]);
    T.set(w - 2, 1, 1, B.oven);
    return [w >> 1, 4];
  },
};
// [breedte, diepte, beroep, extra voor house()]
const BUILD = {
  huis: [7, 7, 'dorpeling', {}],
  bakkerij: [7, 7, 'bakker', { wall: B.baksteen, awning: 1 }],
  winkel: [7, 7, 'winkelier', { awning: 1 }],
  smederij: [8, 7, 'smid', { wall: B.keisteen, open: 1 }],
  restaurant: [8, 8, 'kok', { awning: 1, h: 5 }],
  boerderij: [7, 7, 'boer', { wall: B.planken, thatch: 1 }],
  zagerij: [7, 6, 'houthakker', { wall: B.planken, open: 1, thatch: 1 }],
  juwelier: [7, 7, 'juwelier', { wall: B.marmerblok, awning: 1 }],
  mijn: [7, 7, 'mijnwerker', { wall: B.steenblok }],
};

export const siteMethods = {

  // ---------- waar staat wat? ----------

  siteAt(rx, rz) {
    const key = (rx + 32768) * 65536 + (rz + 32768);
    let s = this.siteCache.get(key);
    if (s === undefined) { s = this.makeSite(rx, rz); this.siteCache.set(key, s); }
    return s;
  },

  makeSite(rx, rz) {
    const P = SITE_ODDS[this.world];
    if (!P) return null;
    const sd = this.seed + 4100, r = hash2(rx, rz, sd);
    let kind = r < P.dorp ? 'dorp' : r < P.dorp + P.kasteel ? 'kasteel' : r < P.dorp + P.kasteel + P.kamp ? 'kamp' : null;
    if (this.world === 'groen' && rx === 0 && rz === 0) kind = 'dorp';      // altijd een dorp niet ver van het ruimteschip
    if (!kind || this.noSites.has(rx + ',' + rz)) return null;
    // een paar plekken in het vak proberen, tot er een geschikt stuk land is
    for (let t = 0; t < 5; t++) {
      const s = this.trySite(rx, rz, kind, sd + t * 31);
      if (s) return s;
    }
    return null;
  },

  trySite(rx, rz, kind, sd) {
    const [r0, r1] = SITE_R[kind];
    const m = r1 + 8;
    const x = Math.floor(rx * SITE_CELL + m + hash2(rx, rz, sd + 1) * (SITE_CELL - 2 * m));
    const z = Math.floor(rz * SITE_CELL + m + hash2(rx, rz, sd + 2) * (SITE_CELL - 2 * m));
    const T = this.tree;
    if (Math.hypot(x - T.x, z - T.z) < r1 + 100) return null;
    if (this.world === 'groen') {
      if (Math.hypot(x - CRASH.x, z - CRASH.z) < r1 + 34 || Math.hypot(x - NEST_PEAK.x, z - NEST_PEAK.z) < r1 + 75) return null;
    } else if (Math.hypot(x, z) < r1 + 24) return null;                       // niet op de plek waar je uit een portaal komt
    // Is het land hier geschikt? Het midden moet droog zijn en niet te hoog liggen, en het
    // meeste land eromheen ook. (Een stukje zee mag: dat wordt opgevuld tot een dorp aan de kust.)
    const lo = this.world === 'schaduw' ? 39 : SEA + 2, hi = this.world === 'schaduw' ? 62 : SEA + 32;
    let sum = 0, n = 0, min = 999, max = 0, ok = true;
    this.raw = true;
    try {
      for (let ring = 0; ring < 3 && ok; ring++) {
        const rad = ring === 0 ? 0 : ring === 1 ? r0 * 0.5 : r0 * 0.9;
        for (let a = 0; a < (ring ? 8 : 1); a++) {
          const c = this.col(Math.round(x + Math.cos(a * 0.7854) * rad), Math.round(z + Math.sin(a * 0.7854) * rad));
          const dry = !c.liq && c.h >= lo;
          if (ring === 0 && (!dry || c.nc || c.h > hi)) { ok = false; break; }
          if (!dry) continue;
          sum += c.h; n++;
          if (c.h < min) min = c.h; if (c.h > max) max = c.h;
        }
      }
    } finally { this.raw = false; }
    if (!ok || n < 11 || max - min > (kind === 'kamp' ? 10 : 24)) return null;
    const seed = (hash2(rx, rz, sd + 7) * 4294967296) >>> 0;
    const s = { kind, x, y: Math.min(hi, Math.round(sum / n)), z, rx, rz, key: rx + ',' + rz, r0, r1, seed, evil: false, name: '' };
    const pick = (list, salt) => list[Math.floor(hash2(rx, rz, sd + salt) * list.length)];
    if (kind === 'dorp') s.name = pick(this.world === 'ijs' ? IJS_A : DORP_A, 11) + pick(DORP_B, 12);
    else if (kind === 'kasteel') {
      s.evil = this.world !== 'groen' || hash2(rx, rz, sd + 8) < 0.42;
      s.name = s.evil ? 'Spookkasteel ' + pick(SPOOK, 13) : 'Kasteel ' + pick(BURCHT, 13);
    } else { s.evil = true; s.name = 'het Trollenkamp'; }
    return s;
  },

  // De grond rond een bouwwerk vlak maken. Wordt voor elke kolom aangeroepen (zie col()).
  applySite(x, z, c) {
    if (this.raw) return;
    const s = this.siteAt(Math.floor(x / SITE_CELL), Math.floor(z / SITE_CELL));
    if (!s) return;
    const d = Math.hypot(x - s.x, z - s.z);
    if (d >= s.r1) return;
    const P = PAL[this.world];
    c.h = lerp(s.y, c.h, smoothstep(s.r0, s.r1, d));
    c.ent = 0;
    if (c.liq && Math.floor(c.h) >= c.ly) { c.liq = 0; c.top = P.land; c.under = P.under; }
    if (d < s.r0 + 4) { c.tp = 0; c.nc = 1; c.liq = 0; c.top = P.land; c.under = P.under; }
    if (d < s.r0) c.vg = 0;
  },

  // alle bouwwerken in de buurt van een plek (voor de server: bewoners en het kompas)
  sitesNear(x, z, r) {
    const out = [];
    if (!SITE_ODDS[this.world]) return out;
    const x0 = Math.floor((x - r) / SITE_CELL), x1 = Math.floor((x + r) / SITE_CELL), z0 = Math.floor((z - r) / SITE_CELL), z1 = Math.floor((z + r) / SITE_CELL);
    for (let rx = x0; rx <= x1; rx++) for (let rz = z0; rz <= z1; rz++) {
      const s = this.siteAt(rx, rz);
      if (s && Math.hypot(s.x - x, s.z - z) <= r) out.push(s);
    }
    return out;
  },

  sitePlan(s) {
    if (!s.plan) s.plan = s.kind === 'dorp' ? this.villagePlan(s) : s.kind === 'kasteel' ? this.castlePlan(s) : this.campPlan(s);
    return s.plan;
  },

  // ---------- dorp ----------

  villagePlan(s) {
    const rnd = mulberry32(s.seed);
    const slots = [];
    for (let a = 0; a < 4; a++) for (const side of [1, -1]) for (const a0 of [11, 20]) slots.push({ a, side, a0, r: rnd() });
    slots.sort((p, q) => p.r - q.r);
    const extra = ['zagerij', 'juwelier', 'mijn', 'huis', 'huis', 'huis', 'huis', 'huis', 'huis'];
    for (let i = extra.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = extra[i]; extra[i] = extra[j]; extra[j] = t; }
    const kinds = ['restaurant', 'smederij', 'winkel', 'bakkerij', 'boerderij', 'huis'].concat(extra.slice(0, 3 + Math.floor(rnd() * 5)));
    const buildings = [], npcs = [];
    kinds.forEach((type, n) => {
      const sl = slots[n];
      if (!sl) return;
      // een boerderij heeft ruimte nodig voor de akker: alleen op de verste plek van een straat
      const [w, d, job] = BUILD[type];
      const ax = DX[sl.a], az = DZ[sl.a], px = -az * sl.side, pz = ax * sl.side;
      const off = sl.a0 + ((8 - w) >> 1);
      const b = { type, w, d, job, bx: s.x + ax * off + px * 3, bz: s.z + az * off + pz * 3, ax, az, px, pz, spot: null };
      buildings.push(b);
    });
    // bewoners: bij elk gebouw één, op de plek die INSIDE aangeeft
    const fake = { set() {}, fill() {}, X: () => 0, Z: () => 0, dirI: 0 };
    for (const b of buildings) {
      const [i, j] = INSIDE[b.type](fake, b.w, b.d, PAL[this.world]);
      // winkeliers kijken naar de deur
      npcs.push({ k: 'dorpeling', job: b.job, x: b.bx + b.ax * i + b.px * j + 0.5, y: s.y + 1, z: b.bz + b.az * i + b.pz * j + 0.5, r: b.job === 'dorpeling' || b.job === 'boer' ? 9 : 1.2, yaw: Math.atan2(-b.px, -b.pz) });
    }
    npcs.push({ k: 'dorpeling', job: 'marktkoopman', x: s.x - 5.5 + 1, y: s.y + 1, z: s.z - 6.5 + 1, r: 0.8, yaw: 0 });
    const dragon = rnd() < 0.55;
    if (dragon) npcs.push({ k: 'dorpeling', job: 'drakenhandelaar', x: s.x + 5.5, y: s.y + 1, z: s.z - 5.5, r: 0.8, yaw: 0 });
    npcs.push({ k: 'dorpeling', job: 'stationschef', x: s.x + 20.5, y: s.y + 2, z: s.z + J_OFF - 2.5, r: 2.5, yaw: 0 });
    npcs.push({ k: 'ridder', x: s.x + 3.5, y: s.y + 1, z: s.z + 4.5, r: 12 }, { k: 'ridder', x: s.x - 3.5, y: s.y + 1, z: s.z + 4.5, r: 12 });
    return { buildings, npcs, dragon };
  },

  drawVillage(S, s) {
    const P = PAL[this.world], plan = this.sitePlan(s), y = s.y;
    // plein en straten
    if (S.hit(s.x - 29, s.z - 29, s.x + 29, s.z + 30)) {
      for (let dx = -7; dx <= 7; dx++) for (let dz = -7; dz <= 7; dz++) if (dx * dx + dz * dz <= 46) { S.set(s.x + dx, y, s.z + dz, P.road); S.fill(s.x + dx, y + 1, s.z + dz, s.x + dx, y + 8, s.z + dz, 0); }
      for (let a = 0; a < 4; a++) {
        const ax = DX[a], az = DZ[a], len = a === 1 ? J_OFF - 1 : 28;
        S.fill(s.x + ax * 6 - az, y, s.z + az * 6 - ax, s.x + ax * len + az, y, s.z + az * len + ax, P.road);
        S.fill(s.x + ax * 6 - az, y + 1, s.z + az * 6 - ax, s.x + ax * len + az, y + 6, s.z + az * len + ax, 0);
        // lantaarnpalen
        for (const side of [-2, 2]) {
          const lx = s.x + ax * 9 - az * side, lz = s.z + az * 9 + ax * side;
          S.fill(lx, y + 1, lz, lx, y + 3, lz, P.log); S.set(lx, y + 4, lz, B.lantaarn);
        }
      }
      // de waterput
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const mid = !dx && !dz;
        S.set(s.x + dx, y, s.z + dz, mid ? B.water : B.keisteen);
        S.set(s.x + dx, y + 1, s.z + dz, mid ? 0 : B.keisteen);
        if (dx && dz) S.fill(s.x + dx, y + 2, s.z + dz, s.x + dx, y + 3, s.z + dz, P.log);
        S.set(s.x + dx, y + 4, s.z + dz, P.thatch);
      }
      S.set(s.x, y + 5, s.z, P.thatch);
      // marktkramen
      const stall = (x0, z0) => {
        for (const [dx, dz] of [[0, 0], [2, 0], [0, 2], [2, 2]]) S.fill(x0 + dx, y + 1, z0 + dz, x0 + dx, y + 2, z0 + dz, P.log);
        S.fill(x0, y + 3, z0, x0 + 2, y + 3, z0 + 2, B.luifel);
        S.fill(x0, y + 1, z0 + 2, x0 + 2, y + 1, z0 + 2, B.tafel);
        S.set(x0 + 1, y + 1, z0, B.hooi);
      };
      stall(s.x - 6, s.z - 7);
      S.set(s.x - 6, y + 2, s.z - 5, B.pompoen);
      if (plan.dragon) { stall(s.x + 4, s.z - 7); S.set(s.x + 6, y + 2, s.z - 5, B.ei_vuur + (s.seed % 5)); }
    }
    for (const b of plan.buildings) {
      const T = frame(S, b.bx, y, b.bz, b.ax, b.az, b.px, b.pz);
      if (!T.hit(-2, -3, b.w + 1, b.d + 9)) continue;
      const o = Object.assign({}, BUILD[b.type][3]);
      if (o.thatch) o.roof = P.thatch;
      if (this.world !== 'groen') { if (o.wall === B.baksteen || o.wall === B.marmerblok) o.wall = B.steenblok; }
      house(T, b.w, b.d, P, o);
      INSIDE[b.type](T, b.w, b.d, P);
    }
    this.drawStation(S, s, P);
  },

  // Het station: een perron met een afdakje langs het spoor ten zuiden van het dorp.
  drawStation(S, s, P) {
    const y = s.y, zr = s.z + J_OFF, xj = s.x + J_OFF;
    if (!S.hit(s.x - 8, zr - 6, xj + 2, zr + 2)) return;
    // het zijspoor: van het stootblok tot het knooppunt
    for (let x = s.x - 6; x <= xj; x++) this.railBed(S, x, y + 1, zr, 0, y, 1);
    S.set(s.x - 7, y + 1, zr, B.steenblok); S.set(s.x - 7, y + 2, zr, B.wol_rood);
    // een pad van de straat naar het perron, en het perron zelf
    S.fill(s.x + 2, y, zr - 2, s.x + 11, y, zr - 1, P.road);
    S.fill(s.x + 12, y + 1, zr - 2, s.x + 28, y + 1, zr - 1, B.steenblok);
    S.fill(s.x + 15, y + 1, zr - 5, s.x + 25, y + 1, zr - 3, B.steenblok);
    S.fill(s.x + 12, y + 2, zr - 5, s.x + 28, y + 7, zr - 1, 0);
    // afdak met bankjes
    for (const x of [s.x + 16, s.x + 24]) for (const z of [zr - 5, zr - 1]) S.fill(x, y + 2, z, x, y + 4, z, P.log);
    S.fill(s.x + 15, y + 5, zr - 6, s.x + 25, y + 5, zr, P.roof);
    S.fill(s.x + 16, y + 6, zr - 5, s.x + 24, y + 6, zr - 1, P.roof);
    S.fill(s.x + 18, y + 2, zr - 5, s.x + 22, y + 2, zr - 5, B.kruk);
    S.set(s.x + 20, y + 4, zr - 5, B.lantaarn);
    S.fill(s.x + 27, y + 2, zr - 2, s.x + 27, y + 3, zr - 2, P.log); S.set(s.x + 27, y + 4, zr - 2, B.wol_blauw);
  },

  // ---------- spoorlijnen ----------

  // Is er vanaf dit dorp een spoorlijn naar het oosten (dir 0) of het zuiden (dir 1)?
  // Geeft de punten van de lijn: { n, x, z, y } of null.
  railPath(s, dir) {
    if (s.rail === undefined) s.rail = [undefined, undefined];
    if (s.rail[dir] !== undefined) return s.rail[dir];
    let path = null, t = null;
    if (dir === 0) {
      t = this.siteAt(s.rx + 1, s.rz);
      if (!t || t.kind !== 'dorp') {
        // een vak overslaan mag, als daar niets in de weg staat
        const m = t;
        t = this.siteAt(s.rx + 2, s.rz);
        if (m && Math.abs(m.z - (s.z + J_OFF)) < m.r1 + 8) t = null;
      }
    } else t = this.siteAt(s.rx, s.rz + 1);
    if (t && t.kind === 'dorp') {
      const ax = s.x + J_OFF, az = s.z + J_OFF, bx = t.x + J_OFF, bz = t.z + J_OFF;
      const xs = [], zs = [];
      if (dir === 0) {
        const xm = t.rx * SITE_CELL;
        for (let x = ax; x < xm; x++) { xs.push(x); zs.push(az); }
        for (let z = az; z !== bz; z += bz > az ? 1 : -1) { xs.push(xm); zs.push(z); }
        for (let x = xm; x <= bx; x++) { xs.push(x); zs.push(bz); }
      } else {
        const zm = t.rz * SITE_CELL;
        for (let z = az; z < zm; z++) { xs.push(ax); zs.push(z); }
        for (let x = ax; x !== bx; x += bx > ax ? 1 : -1) { xs.push(x); zs.push(zm); }
        for (let z = zm; z <= bz; z++) { xs.push(bx); zs.push(z); }
      }
      const n = xs.length, g = new Float32Array(n), f = new Float32Array(n);
      const wl = this.world === 'schaduw' ? 38 : SEA + 1;
      for (let i = 0; i < n; i++) { const c = this.col(xs[i], zs[i]); g[i] = Math.max(c.h, c.liq ? c.ly : 0, wl); }
      // gladstrijken, en dan zorgen dat het spoor nergens te steil wordt (hooguit 1 omhoog per 2 blokken)
      for (let i = 0; i < n; i++) {
        let sum = 0, cnt = 0;
        for (let k = Math.max(0, i - 7); k <= Math.min(n - 1, i + 7); k++) { sum += g[k]; cnt++; }
        f[i] = sum / cnt;
      }
      f[0] = s.y; f[n - 1] = t.y;
      for (let i = 1; i < n; i++) f[i] = Math.min(f[i - 1] + 0.5, Math.max(f[i - 1] - 0.5, f[i]));
      f[n - 1] = t.y;
      for (let i = n - 2; i >= 0; i--) f[i] = Math.min(f[i + 1] + 0.5, Math.max(f[i + 1] - 0.5, f[i]));
      const ys = new Int16Array(n);
      for (let i = 0; i < n; i++) ys[i] = Math.round(f[i]) + 1;
      // in een bocht ligt het spoor vlak, en kuiltjes van één blok worden opgevuld
      for (let i = 1; i < n - 1; i++) if (xs[i - 1] !== xs[i + 1] && zs[i - 1] !== zs[i + 1]) { ys[i - 1] = ys[i]; ys[i + 1] = ys[i]; }
      for (let pass = 0; pass < 2; pass++) for (let i = 1; i < n - 1; i++) if (ys[i - 1] > ys[i] && ys[i + 1] > ys[i]) ys[i]++;
      path = { n, x: Int32Array.from(xs), z: Int32Array.from(zs), y: ys, g };
    }
    s.rail[dir] = path;
    return path;
  },

  // Eén stukje spoor: grind eronder, lucht erboven (een tunnel als het door een heuvel gaat)
  // en een brug met pijlers als de grond te laag ligt. side: 0 = spoor langs x, 1 = langs z, 2 = bocht.
  railBed(S, x, y, z, side, ground, i) {
    const wx = side === 0 ? 0 : 1, wz = side === 1 ? 0 : 1;
    if (!S.hit(x - wx, z - wz, x + wx, z + wz)) return;
    const bridge = ground < y - 2;
    for (let dx = -wx; dx <= wx; dx++) for (let dz = -wz; dz <= wz; dz++) {
      if (dx || dz) { const cur = S.get(x + dx, y, z + dz); if (cur === B.steenblok || cur === B.rails) continue; }      // een perron of een kruisend spoor blijft liggen
      S.set(x + dx, y - 1, z + dz, bridge ? B.planken : B.grind);
      S.fill(x + dx, y, z + dz, x + dx, y + 3, z + dz, 0);
      if (bridge) { if (dx || dz) S.set(x + dx, y, z + dz, B.planken); }           // leuning
      else if (ground < y - 1) S.fill(x + dx, ground, z + dz, x + dx, y - 2, z + dz, B.aarde);
    }
    if (bridge) { if (i % 6 === 0) S.fill(x, Math.max(2, ground - 1), z, x, y - 2, z, B.keisteen); }
    else if (ground > y + 3 && i % 8 === 0) S.set(x, y + 4, z, B.lantaarn);         // lampje in de tunnel
    S.set(x, y, z, B.rails);
  },

  drawRails(S, cx, cz) {
    const ox = S.ox, oz = S.oz;
    const done = new Set();
    for (let rx = Math.floor((ox - 2) / SITE_CELL); rx <= Math.floor((ox + 17) / SITE_CELL); rx++) {
      for (let rz = Math.floor((oz - 2) / SITE_CELL); rz <= Math.floor((oz + 17) / SITE_CELL); rz++) {
        for (const [qx, qz] of [[rx, rz], [rx - 1, rz], [rx - 2, rz], [rx, rz - 1]]) {
          const key = qx + ',' + qz;
          if (done.has(key)) continue;
          done.add(key);
          const s = this.siteAt(qx, qz);
          if (!s || s.kind !== 'dorp') continue;
          for (let dir = 0; dir < 2; dir++) {
            const p = this.railPath(s, dir);
            if (!p) continue;
            for (let i = 0; i < p.n; i++) {
              const x = p.x[i], z = p.z[i];
              if (x < ox - 1 || x > ox + 16 || z < oz - 1 || z > oz + 16) continue;
              const a = Math.max(0, i - 1), b = Math.min(p.n - 1, i + 1);
              const side = p.z[a] === p.z[b] ? 0 : p.x[a] === p.x[b] ? 1 : 2;
              this.railBed(S, x, p.y[i], z, side, Math.floor(p.g[i]), i);
            }
          }
        }
      }
    }
    void cx; void cz;
  },

  // ---------- kasteel ----------

  castlePlan(s) {
    const npcs = [], y = s.y + 1, x = s.x, z = s.z;
    const at = (k, dx, dz, r, extra) => npcs.push(Object.assign({ k, x: x + dx + 0.5, y, z: z + dz + 0.5, r }, extra));
    if (s.evil) {
      at('skeletkoning', 0, -19, 6, { yaw: 0 });
      at('skeletridder', -4, -15, 5); at('skeletridder', 4, -15, 5); at('skeletridder', -3, 24, 5); at('skeletridder', 3, 24, 5);
      at('skelet', -16, 6, 8); at('skelet', 16, 6, 8); at('skelet', -18, -18, 6); at('skelet', 18, -18, 6);
      at('spin', -12, 16, 8); at('spin', 12, 16, 8); at('spin', 0, 8, 8);
    } else {
      at('dorpeling', 0, -20, 0.8, { job: 'koning', yaw: 0 });
      at('ridder', -3, -19, 1.5, { yaw: 0 }); at('ridder', 3, -19, 1.5, { yaw: 0 });
      at('ridder', -3, 25, 3); at('ridder', 3, 25, 3); at('ridder', -14, 4, 10); at('ridder', 14, 4, 10);
      at('dorpeling', 20, 9, 1.2, { job: 'smid' });
      at('dorpeling', -19, 9, 1.5, { job: 'kok' });
      at('dorpeling', 12, 20, 0.8, { job: 'drakenhandelaar' });
      at('dorpeling', -6, 12, 9, { job: 'dorpeling' });
    }
    return { npcs };
  },

  drawCastle(S, s) {
    const C = CASTLE[s.evil ? (this.world === 'ijs' ? 'ijs' : 'spook') : 'goed'];
    const x = s.x, y = s.y, z = s.z, evil = s.evil, P = PAL[this.world];
    if (!S.hit(x - 40, z - 40, x + 40, z + 42)) return;
    const R = 30;
    const rnd = (a, b, salt) => hash3(a, b, salt, s.seed);

    // gracht rondom, met een brug voor de poort
    const moat = this.world === 'schaduw' ? 0 : B.water;
    for (const [x0, z0, x1, z1] of [[-37, -37, 37, -34], [-37, 34, 37, 37], [-37, -33, -34, 33], [34, -33, 37, 33]]) {
      S.fill(x + x0, y - 1, z + z0, x + x1, y, z + z1, moat);
      S.fill(x + x0, y + 1, z + z0, x + x1, y + 8, z + z1, 0);
      if (this.world === 'ijs') S.fill(x + x0, y, z + z0, x + x1, y, z + z1, B.ijs);
    }
    S.fill(x - 2, y, z + 33, x + 2, y, z + 38, B.planken);
    S.fill(x - 2, y + 1, z + 31, x + 2, y + 6, z + 40, 0);

    // binnenplaats
    S.fill(x - R + 3, y, z - R + 3, x + R - 3, y, z + R - 3, C.yard);
    S.fill(x - R + 3, y + 1, z - R + 3, x + R - 3, y + 30, z + R - 3, 0);

    // ringmuur met weergang en kantelen
    const wall = (x0, z0, x1, z1, outer) => {
      S.fill(x + x0, y - 2, z + z0, x + x1, y + 8, z + z1, C.wall);
      S.fill(x + x0, y + 9, z + z0, x + x1, y + 14, z + z1, 0);
      const [ox0, oz0, ox1, oz1] = outer;
      S.fill(x + ox0, y + 9, z + oz0, x + ox1, y + 9, z + oz1, C.wall);
      for (let a = Math.min(ox0, ox1); a <= Math.max(ox0, ox1); a++) for (let b = Math.min(oz0, oz1); b <= Math.max(oz0, oz1); b++) if ((a + b) & 1) S.set(x + a, y + 10, z + b, C.trim);
    };
    wall(-R, -R, R, -R + 2, [-R, -R, R, -R]);
    wall(-R, R - 2, R, R, [-R, R, R, R]);
    wall(-R, -R, -R + 2, R, [-R, -R, -R, R]);
    wall(R - 2, -R, R, R, [R, -R, R, R]);
    // vaandels aan de buitenkant
    for (const bx of [-12, -6, 6, 12]) S.fill(x + bx, y + 5, z + R + 1, x + bx, y + 7, z + R + 1, C.banner);

    // hoektorens: rond, met een kamer op de hoogte van de weergang en een puntdak
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const tx = x + sx * R, tz = z + sz * R;
      if (!S.hit(tx - 7, tz - 7, tx + 7, tz + 7)) continue;
      for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > 5.6) { if (!evil && d <= 6.6) S.set(tx + dx, y + 19, tz + dz, C.roof); continue; }
        const ring = d > 4.4;
        S.fill(tx + dx, y - 2, tz + dz, tx + dx, y + 8, tz + dz, C.wall);                          // massieve voet
        S.fill(tx + dx, y + 9, tz + dz, tx + dx, y + 13, tz + dz, ring ? C.wall : 0);              // kamer
        S.set(tx + dx, y + 14, tz + dz, C.trim);                                                    // plafond = bovenste vloer
        S.fill(tx + dx, y + 15, tz + dz, tx + dx, y + 18, tz + dz, ring ? (evil ? 0 : C.wall) : 0);
        if (ring) {
          S.set(tx + dx, y + 15, tz + dz, C.wall);
          if (evil) { if ((dx + dz) & 1) S.set(tx + dx, y + 16, tz + dz, C.trim); }
          else if (Math.abs(dx) === 0 || Math.abs(dz) === 0) S.fill(tx + dx, y + 16, tz + dz, tx + dx, y + 17, tz + dz, 0);      // uitkijkgaten
          if ((dx === 0 || dz === 0) && !(dx * sx < 0 || dz * sz < 0)) S.fill(tx + dx, y + 11, tz + dz, tx + dx, y + 12, tz + dz, B.tralies);   // schietgaten
        }
        if (!evil) for (let k = 0; k < 6; k++) if (d <= 5.6 - k) S.set(tx + dx, y + 19 + k, tz + dz, C.roof);
      }
      // deuren naar de weergang
      S.fill(tx - sx * 5, y + 9, tz - sz, tx - sx * 4, y + 10, tz - sz * 2, 0);
      S.fill(tx - sx, y + 9, tz - sz * 5, tx - sx * 2, y + 10, tz - sz * 4, 0);
      S.set(tx, y + 13, tz, B.lantaarn);
      if (evil) { S.set(tx + sx, y + 9, tz + sz, B.botten); S.set(tx - sx, y + 12, tz + sz, B.spinnenweb); }
      else S.fill(tx, y + 25, tz, tx, y + 27, tz, C.banner);
      if ((sx + sz) !== 0) S.set(tx + sx * 2, y + 9, tz + sz * 2, B.schatkist);
    }

    // poortgebouw in de zuidmuur
    if (S.hit(x - 8, z + R - 4, x + 8, z + R + 3)) {
      for (const sx of [-1, 1]) {
        S.fill(x + sx * 2, y - 2, z + R - 3, x + sx * 6, y + 13, z + R + 2, C.wall);
        S.fill(x + sx * 3, y + 9, z + R - 2, x + sx * 5, y + 12, z + R + 1, 0);
        S.fill(x + sx * 4, y + 10, z + R + 2, x + sx * 4, y + 11, z + R + 2, B.tralies);
        S.fill(x + sx * 2, y + 9, z + R - 1, x + sx * 2, y + 10, z + R, 0);
        S.fill(x + sx * 6, y + 9, z + R - 1, x + sx * 6, y + 10, z + R, 0);
        for (let a = 2; a <= 6; a++) for (let b = -3; b <= 2; b++) if ((a === 2 || a === 6 || b === -3 || b === 2) && ((a + b) & 1)) S.set(x + sx * a, y + 14, z + R + b, C.trim);
        S.set(x + sx * 4, y + 13, z + R, B.lantaarn);
      }
      S.fill(x - 1, y + 5, z + R - 3, x + 1, y + 11, z + R + 2, C.wall);
      S.fill(x - 1, y + 9, z + R - 1, x + 1, y + 10, z + R, 0);
      S.fill(x - 1, y + 1, z + R - 3, x + 1, y + 4, z + R + 2, 0);
      S.fill(x - 1, y, z + R - 3, x + 1, y, z + R + 2, C.trim);
      S.fill(x - 1, y + 4, z + R + 1, x + 1, y + 4, z + R + 1, B.tralies);                       // het valhek, omhoog getrokken
      S.set(x - 2, y + 3, z + R + 2, B.lantaarn); S.set(x + 2, y + 3, z + R + 2, B.lantaarn);
    }
    // trappen naar de weergang, links en rechts van de poort
    for (const sx of [-1, 1]) for (let k = 0; k < 8; k++) S.fill(x + sx * (9 + k), y + 1, z + R - 4, x + sx * (9 + k), y + 1 + k, z + R - 3, C.trim);

    this.drawKeep(S, s, C, P);

    // binnenplaats: put, stallen, smidse, kraam
    if (S.hit(x - 27, z - 4, x + 27, z + 27)) {
      S.fill(x - 1, y, z - 5, x + 1, y, z + R - 3, C.trim);                                       // pad van de poort naar de burcht
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const mid = !dx && !dz; S.set(x - 9 + dx, y, z + 16 + dz, mid ? (evil ? 0 : B.water) : C.trim); S.set(x - 9 + dx, y + 1, z + 16 + dz, mid ? 0 : C.trim); }
      // stal (west) en smidse (oost): een afdak op palen
      for (const sx of [-1, 1]) {
        const x0 = x + sx * 16, x1 = x + sx * 26;
        for (const px of [x0, x1]) for (const pz of [z + 5, z + 13]) S.fill(px, y + 1, pz, px, y + 4, pz, P.log);
        S.fill(x0, y + 5, z + 4, x1, y + 5, z + 14, evil ? C.trim : (sx < 0 ? P.thatch : C.roof));
        if (evil) { for (let k = 0; k < 14; k++) S.set(x + sx * (17 + Math.floor(rnd(k, sx, 3) * 9)), y + 5, z + 5 + Math.floor(rnd(k, sx, 4) * 9), 0); }
      }
      if (evil) {
        for (let k = 0; k < 16; k++) {
          const bx = x + Math.floor((rnd(k, 1, 5) - 0.5) * 50), bz = z + Math.floor(rnd(k, 2, 6) * 26);
          if (Math.abs(bx - x) < 3) continue;
          S.set(bx, y + 1, bz, k % 3 === 0 ? B.botten : k % 3 === 1 ? B.dode_struik : B.spinnenweb);
        }
      } else {
        S.fill(x - 25, y + 1, z + 12, x - 22, y + 1, z + 12, B.hooi); S.set(x - 24, y + 2, z + 12, B.hooi);
        S.fill(x - 21, y + 1, z + 6, x - 18, y + 1, z + 6, B.tafel); S.set(x - 22, y + 1, z + 6, B.kookpot); S.set(x - 23, y + 1, z + 6, B.oven);
        S.set(x + 19, y + 1, z + 7, B.aambeeld); S.set(x + 24, y + 1, z + 6, B.oven); S.set(x + 25, y + 1, z + 6, B.oven); S.set(x + 24, y + 1, z + 12, B.ijzerblok);
        for (const [dx, dz] of [[10, 19], [14, 19], [10, 22], [14, 22]]) S.fill(x + dx, y + 1, z + dz, x + dx, y + 2, z + dz, P.log);
        S.fill(x + 10, y + 3, z + 19, x + 14, y + 3, z + 22, B.luifel);
        S.fill(x + 11, y + 1, z + 19, x + 13, y + 1, z + 19, B.tafel); S.set(x + 12, y + 2, z + 19, B.ei_ijs); S.set(x + 13, y + 1, z + 22, B.ei_natuur);
        // oefenpoppen voor de ridders
        for (const dx of [-8, -5]) { S.fill(x + dx, y + 1, z + 4, x + dx, y + 2, z + 4, P.log); S.set(x + dx, y + 3, z + 4, B.hooi); }
        for (const [dx, dz] of [[-4, 10], [4, 10], [-4, 20], [4, 20]]) { S.fill(x + dx, y + 1, z + dz, x + dx, y + 2, z + dz, C.trim); S.set(x + dx, y + 3, z + dz, B.lantaarn); }
      }
    }
  },

  // De burcht: drie verdiepingen, een kerker eronder en een hoge toren met de schatkamer.
  drawKeep(S, s, C, P) {
    const x = s.x, y = s.y, z = s.z, evil = s.evil;
    const X0 = x - 10, X1 = x + 10, Z0 = z - 25, Z1 = z - 6;
    if (!S.hit(X0 - 1, Z0 - 1, X1 + 1, Z1 + 1)) return;
    S.fill(X0, y - 8, Z0, X1, y + 18, Z1, C.wall);
    for (let f = 0; f < 3; f++) {
      const fy = y + f * 6;
      S.fill(X0 + 1, fy + 1, Z0 + 1, X1 - 1, fy + 5, Z1 - 1, 0);
      S.fill(X0 + 1, fy, Z0 + 1, X1 - 1, fy, Z1 - 1, f === 0 ? C.hall : P.floor);
      // ramen
      for (let a = X0 + 3; a <= X1 - 3; a += 4) { S.fill(a, fy + 2, Z0, a, fy + 3, Z0, B.glas); if (f > 0 || Math.abs(a - x) > 2) S.fill(a, fy + 2, Z1, a, fy + 3, Z1, B.glas); }
      for (let b = Z0 + 3; b <= Z1 - 3; b += 4) { S.fill(X0, fy + 2, b, X0, fy + 3, b, B.glas); S.fill(X1, fy + 2, b, X1, fy + 3, b, B.glas); }
      // lampen in de hoeken
      for (const [a, b] of [[X0 + 1, Z0 + 1], [X1 - 1, Z0 + 1], [X0 + 1, Z1 - 1], [X1 - 1, Z1 - 1]]) S.set(a, fy + 5, b, B.lantaarn);
    }
    // het dak met kantelen
    S.fill(X0 + 1, y + 18, Z0 + 1, X1 - 1, y + 18, Z1 - 1, C.trim);
    // trappen naar de volgende verdieping: afwisselend langs de oost- en de westmuur
    for (let f = 0; f < 3; f++) {
      const fy = y + f * 6, sx = f % 2 === 0 ? X1 - 1 : X0 + 1, sx2 = f % 2 === 0 ? X1 - 2 : X0 + 2;
      S.fill(sx, fy + 6, Z0 + 2, sx2, fy + 6, Z0 + 8, 0);
      for (let k = 0; k < 6; k++) S.fill(sx, fy + 1, Z0 + 3 + k, sx2, fy + 1 + k, Z0 + 3 + k, C.trim);
    }
    S.fill(X0, y + 19, Z0, X1, y + 19, Z1, C.wall); S.fill(X0 + 1, y + 19, Z0 + 1, X1 - 1, y + 19, Z1 - 1, 0);
    for (let a = X0; a <= X1; a++) for (let b = Z0; b <= Z1; b++) if ((a === X0 || a === X1 || b === Z0 || b === Z1) && ((a + b) & 1)) S.set(a, y + 20, b, C.trim);
    // de grote poort
    S.fill(x - 1, y + 1, Z1, x + 1, y + 4, Z1, 0);
    S.set(x - 2, y + 4, Z1, B.lantaarn); S.set(x + 2, y + 4, Z1, B.lantaarn);
    S.fill(x - 3, y + 6, Z1 + 1, x - 3, y + 9, Z1 + 1, C.banner); S.fill(x + 3, y + 6, Z1 + 1, x + 3, y + 9, Z1 + 1, C.banner);

    // begane grond: de troonzaal
    S.fill(x - 1, y, Z0 + 4, x + 1, y, Z1 - 1, C.carpet);
    S.fill(x - 3, y + 1, Z0 + 1, x + 3, y + 1, Z0 + 3, C.trim);
    S.fill(x - 1, y + 1, Z0 + 3, x + 1, y + 1, Z0 + 3, C.carpet);
    S.set(x, y + 2, Z0 + 1, B.troon); S.set(x, y + 3, Z0 + 1, evil ? B.botten : B.goudblok);
    S.fill(x - 2, y + 3, Z0 + 1, x - 2, y + 5, Z0 + 1, C.banner); S.fill(x + 2, y + 3, Z0 + 1, x + 2, y + 5, Z0 + 1, C.banner);
    for (const sx of [-1, 1]) for (let b = Z0 + 6; b <= Z1 - 3; b += 4) { S.fill(x + sx * 4, y + 1, b, x + sx * 4, y + 5, b, C.pillar); S.set(x + sx * 4, y + 4, b + 1, B.lantaarn); }
    if (evil) { for (let k = 0; k < 10; k++) S.set(x + Math.floor((hash3(k, 1, 9, s.seed) - 0.5) * 16), y + 1, Z0 + 5 + Math.floor(hash3(k, 2, 9, s.seed) * 12), k & 1 ? B.botten : B.spinnenweb); }
    else for (const sx of [-1, 1]) { S.fill(x + sx * 7, y + 1, Z0 + 10, x + sx * 7, y + 1, Z1 - 4, B.tafel); S.fill(x + sx * 6, y + 1, Z0 + 10, x + sx * 6, y + 1, Z1 - 4, B.kruk); }

    // eerste verdieping: bibliotheek en slaapkamers
    const y1 = y + 6;
    S.fill(X0 + 3, y1 + 1, Z0 + 1, X1 - 1, y1 + 3, Z0 + 1, B.boekenkast);
    S.fill(X1 - 1, y1 + 1, Z0 + 10, X1 - 1, y1 + 3, Z1 - 2, B.boekenkast);
    S.fill(x - 1, y1 + 1, z - 16, x + 1, y1 + 1, z - 16, B.tafel); S.set(x, y1 + 1, z - 15, B.kruk);
    for (let k = 0; k < 3; k++) { S.set(x + 2 + k * 2, y1 + 1, Z1 - 2, bedHead(1)); S.set(x + 2 + k * 2, y1 + 1, Z1 - 3, bedFoot(1)); }
    S.fill(x - 4, y1, Z1 - 6, x + 8, y1, Z1 - 1, C.carpet);
    // tweede verdieping: wapenkamer en keuken
    const y2 = y + 12;
    S.set(X1 - 2, y2 + 1, Z1 - 2, B.kookpot); S.set(X1 - 3, y2 + 1, Z1 - 2, B.oven); S.fill(X1 - 6, y2 + 1, Z1 - 4, X1 - 2, y2 + 1, Z1 - 4, B.tafel);
    S.set(X0 + 2, y2 + 1, Z1 - 2, B.aambeeld); S.set(X0 + 4, y2 + 1, Z1 - 2, B.ijzerblok); S.set(X0 + 6, y2 + 1, Z1 - 2, B.werkbank);
    S.set(x, y2 + 1, z - 12, B.schatkist);

    // de kerker: een trap omlaag vanuit de troonzaal, cellen met tralies en een kist
    S.fill(X0 + 1, y - 7, Z0 + 1, X1 - 1, y - 7, Z1 - 1, C.floor);
    S.fill(X0 + 1, y - 6, Z0 + 1, X1 - 1, y - 2, Z1 - 1, 0);
    S.fill(X0 + 1, y - 1, Z0 + 1, X1 - 1, y - 1, Z1 - 1, C.wall);
    for (let k = 0; k < 6; k++) {
      const zk = Z1 - 2 - k;
      S.fill(X0 + 1, y - k, zk, X0 + 2, y, zk, 0);
      S.fill(X0 + 1, y - 6, zk, X0 + 2, y - 1 - k, zk, C.trim);
    }
    for (let a = X0 + 5; a <= X1 - 2; a += 4) {
      S.fill(a, y - 6, Z0 + 1, a, y - 2, Z0 + 5, C.wall);
      S.fill(a - 3, y - 6, Z0 + 5, a - 1, y - 3, Z0 + 5, B.tralies); S.fill(a - 3, y - 2, Z0 + 5, a - 1, y - 2, Z0 + 5, C.wall);
      S.set(a - 2, y - 6, Z0 + 5, 0); S.set(a - 2, y - 5, Z0 + 5, 0);
      S.set(a - 2, y - 6, Z0 + 2, evil ? B.botten : B.hooi);
    }
    S.set(X1 - 2, y - 6, Z0 + 2, B.schatkist);
    S.set(x, y - 2, z - 12, B.lantaarn); S.set(X0 + 4, y - 2, Z1 - 3, B.lantaarn); S.set(X1 - 3, y - 2, Z1 - 3, B.lantaarn);
    if (evil) for (let k = 0; k < 8; k++) S.set(x + Math.floor((hash3(k, 3, 9, s.seed) - 0.5) * 14), y - 6, Z0 + 8 + Math.floor(hash3(k, 4, 9, s.seed) * 9), k & 1 ? B.botten : B.spinnenweb);

    // de hoge toren op het dak, met de schatkamer
    const TX0 = x - 4, TX1 = x + 4, TZ0 = Z0 + 1, TZ1 = Z0 + 9;
    S.fill(TX0, y + 19, TZ0, TX1, y + 29, TZ1, C.wall);
    S.fill(TX0 + 1, y + 19, TZ0 + 1, TX1 - 1, y + 23, TZ1 - 1, 0);
    S.fill(TX0 + 1, y + 25, TZ0 + 1, TX1 - 1, y + 29, TZ1 - 1, 0);
    S.fill(x, y + 19, TZ1, x, y + 20, TZ1, 0);                                                    // deur vanaf het dak
    for (let a = TX0 + 2; a <= TX1 - 2; a += 2) { S.fill(a, y + 21, TZ0, a, y + 22, TZ0, B.glas); S.fill(a, y + 26, TZ0, a, y + 27, TZ0, B.glas); S.fill(a, y + 26, TZ1, a, y + 27, TZ1, B.glas); }
    S.set(TX0 + 1, y + 19, TZ0 + 1, B.schatkist); S.set(TX1 - 1, y + 19, TZ0 + 1, B.schatkist);
    S.set(x, y + 19, TZ0 + 1, evil ? B.botten : B.goudblok); S.set(x, y + 23, TZ0 + 4, B.lantaarn);
    for (let a = TX0 - 1; a <= TX1 + 1; a++) for (let b = TZ0 - 1; b <= TZ1 + 1; b++) {
      const e = Math.max(Math.abs(a - x), Math.abs(b - (TZ0 + 4)));
      if (evil) { if (e === 4 && ((a + b) & 1)) S.set(a, y + 30, b, C.trim); if (e < 4) S.set(a, y + 29, b, C.trim); }
      else for (let k = 0; k <= 5; k++) if (e <= 5 - k) S.set(a, y + 30 + k, b, C.roof);
    }
    const top = y + (evil ? 30 : 36);
    S.fill(x, top, TZ0 + 4, x, top + 4, TZ0 + 4, P.log);
    S.fill(x + 1, top + 3, TZ0 + 4, x + 3, top + 4, TZ0 + 4, C.banner);
  },

  // ---------- trollenkamp ----------

  campPlan(s) {
    const y = s.y + 1;
    const npcs = [{ k: 'trolhoofdman', x: s.x + 0.5, y, z: s.z - 3.5, r: 5 }];
    for (const [dx, dz] of [[-3, 9], [3, 9], [-7, 0], [7, 0]]) npcs.push({ k: 'trol', x: s.x + dx + 0.5, y, z: s.z + dz + 0.5, r: 4 });
    return { npcs };
  },

  drawCamp(S, s) {
    const x = s.x, y = s.y, z = s.z, P = PAL[this.world];
    if (!S.hit(x - 13, z - 13, x + 13, z + 13)) return;
    for (let dx = -12; dx <= 12; dx++) for (let dz = -12; dz <= 12; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 11.5) continue;
      S.fill(x + dx, y + 1, z + dz, x + dx, y + 9, z + dz, 0);
      if (d < 9.5) { if (hash2(x + dx, z + dz, 8811) < 0.5) S.set(x + dx, y, z + dz, this.world === 'groen' ? B.aarde : P.land); continue; }
      if (d < 10.5 && !(Math.abs(dx) <= 1 && dz > 0)) {
        // palissade van boomstammen, met een opening aan de zuidkant
        const h = 3 + (hash2(x + dx, z + dz, 8812) < 0.4 ? 1 : 0);
        S.fill(x + dx, y + 1, z + dz, x + dx, y + h, z + dz, P.log);
      }
    }
    // kampvuur in het midden
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) S.set(x + dx, y, z + dz + 2, B.keisteen);
    S.set(x, y + 1, z + 2, B.kampvuur);
    // tenten: de grote van de hoofdman achterin, twee kleine opzij
    const tent = (cx, cz, r, cloth) => {
      for (let k = 0; k <= r; k++) for (let dx = -r + k; dx <= r - k; dx++) for (let dz = -r + k; dz <= r - k; dz++) {
        const edge = Math.max(Math.abs(dx), Math.abs(dz)) === r - k;
        if (edge) S.set(cx + dx, y + 1 + k, cz + dz, cloth);
      }
      S.fill(cx, y + 1, cz + r, cx, y + 2, cz + r, 0);
      if (r > 2) S.set(cx, y + 2, cz + r - 1, 0);
    };
    tent(x, z - 5, 3, B.wol_rood);
    tent(x - 6, z + 1, 2, B.stro); tent(x + 6, z + 1, 2, B.stro);
    S.set(x, y + 1, z - 6, B.schatkist);
    S.set(x - 1, y + 1, z - 5, B.botten); S.set(x + 1, y + 1, z - 6, B.hooi);
    // totempalen bij de ingang
    for (const sx of [-2, 2]) { S.fill(x + sx, y + 1, z + 10, x + sx, y + 4, z + 10, P.log); S.set(x + sx, y + 5, z + 10, B.botten); S.set(x + sx, y + 4, z + 11, B.wol_rood); }
    for (const [dx, dz] of [[4, -3], [-5, 5], [5, 6], [-3, -2]]) S.set(x + dx, y + 1, z + dz, B.botten);
  },

  // ---------- alles in één chunk tekenen ----------

  drawSites(blocks, cx, cz) {
    if (!SITE_ODDS[this.world]) return;
    const ox = cx * 16, oz = cz * 16;
    const S = canvas(blocks, ox, oz);
    const old = this.oldChunks.has((cx + 32768) * 65536 + (cz + 32768));       // hier had de speler al gebouwd voordat er dorpen waren
    for (let rx = Math.floor(ox / SITE_CELL); rx <= Math.floor((ox + 15) / SITE_CELL); rx++) {
      for (let rz = Math.floor(oz / SITE_CELL); rz <= Math.floor((oz + 15) / SITE_CELL); rz++) {
        const s = this.siteAt(rx, rz);
        if (!s || !S.hit(s.x - s.r0, s.z - s.r0, s.x + s.r0, s.z + s.r0)) continue;
        if (s.kind === 'dorp') this.drawVillage(S, s);
        else if (s.kind === 'kasteel') this.drawCastle(S, s);
        else this.drawCamp(S, s);
      }
    }
    if (!old) this.drawRails(S, cx, cz);
  },
};

export { SITE_ODDS, J_OFF };
