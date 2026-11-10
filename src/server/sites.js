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
  groen: { dorp: 0.5, kasteel: 0, kamp: 0 },
  ijs: { dorp: 0.3, kasteel: 0, kamp: 0 },
  schaduw: { dorp: 0, kasteel: 0, kamp: 0 },
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

const DORP_A = ['Linde', 'Eiken', 'Beuken', 'Molen', 'Zonne', 'Wilgen', 'Vossen', 'Uilen', 'Honing', 'Appel', 'Draken', 'Klaver', 'Zwanen', 'Bloemen', 'Regenboog', 'Sterren'];
const DORP_B = ['dorp', 'hoven', 'veld', 'dam', 'burg', 'wijk', 'huizen', 'rode', 'berg', 'dal'];
const IJS_A = ['Sneeuw', 'Vorst', 'IJzel', 'Winter', 'Rijp', 'Noorder', 'Kristal', 'Pinguïn'];

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
  },
};

export { SITE_ODDS, J_OFF };
