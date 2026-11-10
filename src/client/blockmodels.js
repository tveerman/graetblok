// 3D-modellen voor de kleine dingen in de wereld: gras, bloemen, struiken, paddenstoelen,
// fakkels, kampvuren en lichtranken. Vroeger waren dat twee platte plaatjes kruislings door
// elkaar; nu zijn het echte vormen, opgebouwd uit vlakken met hoekpunten.
//
// Een model wordt één keer gemaakt (hier, bij het opstarten) als een lijst vierhoeken in de
// ruimte van één blok (0..1). De mesher in chunks.js zet het op zijn plek in de wereld, elke
// keer een beetje anders gedraaid, verschoven en hoger of lager, zodat geen twee plantjes
// er precies hetzelfde uitzien.
import { B, tileId, TREE_KEYS, ZWAM_KEYS, LIFE_VINES, NUM_BLOCKS } from '../shared/blocks.js';
import { mulberry32 } from '../shared/noise.js';

const TAU = Math.PI * 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const norm3 = (a) => { const l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// draaien om een verticale as door (cx, cz)
const rotY = (ang, cx, cz) => { const c = Math.cos(ang), s = Math.sin(ang); return (p) => [cx + (p[0] - cx) * c - (p[2] - cz) * s, p[1], cz + (p[0] - cx) * s + (p[2] - cz) * c]; };
// scheef zetten: kantelen om het punt c, in de richting van de hoek "naar"
const tilt = (ang, c, naar) => {
  const dx = Math.cos(naar), dz = Math.sin(naar), cs = Math.cos(ang), sn = Math.sin(ang);
  return (p) => {
    const x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
    const langs = x * dx + z * dz;                       // hoe ver in de kantelrichting
    const l2 = langs * cs + y * sn, y2 = -langs * sn + y * cs;
    return [c[0] + x + dx * (l2 - langs), c[1] + y2, c[2] + z + dz * (l2 - langs)];
  };
};

class Model {
  // rot: 0 = altijd hetzelfde gedraaid, 1 = kwartslagen, 2 = elke hoek
  // jit: hoe ver het van het midden van het blok mag staan; vary: hoeveel de hoogte verschilt
  // swayFrom: hoekpunten hoger dan dit bewegen mee in de wind (alleen in de mooie weergave)
  // plant: zacht licht van boven, zoals bij blaadjes; ao: donkerder vlak bij de grond
  constructor(o = {}) {
    this.rot = o.rot === undefined ? 2 : o.rot;
    this.jit = o.jit || 0;
    this.vary = o.vary || 0;
    this.swayFrom = o.swayFrom === undefined ? 99 : o.swayFrom;
    this.plant = o.plant ? 1 : 0;
    this.ao = o.ao === undefined ? 1 : (o.ao ? 1 : 0);
    this.xf = null;
    this.P = []; this.UV = []; this.N = []; this.TILE = []; this.GLOW = []; this.FL = [];
  }

  // Eén vierhoek: vier hoekpunten [x, y, z], vier plekken op het plaatje [u, v] (v = 0 is de
  // bovenkant van het plaatje). o.out = een punt binnenin de vorm (dan kijkt het vlak daar
  // vanaf), o.glow = gloed 0..15 of -1 voor "de gloed van het blok zelf".
  quad(tile, pts, uvs, o = {}) {
    let out = o.out;
    if (this.xf) { pts = pts.map(this.xf); if (out) out = this.xf(out); }
    let n = cross3(sub(pts[1], pts[0]), sub(pts[3], pts[0]));
    if (len3(n) < 1e-9) n = cross3(sub(pts[2], pts[1]), sub(pts[3], pts[1]));      // driehoek: twee punten vallen samen
    if (len3(n) < 1e-9) n = cross3(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
    if (len3(n) < 1e-9) return;                                                      // geen oppervlak
    n = norm3(n);
    if (out) {
      const c = [(pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4 - out[0], (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4 - out[1], (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4 - out[2]];
      if (n[0] * c[0] + n[1] * c[1] + n[2] * c[2] < 0) n = [-n[0], -n[1], -n[2]];
    } else if (n[1] < 0) n = [-n[0], -n[1], -n[2]];                                  // dunne blaadjes: de bovenkant telt
    const sw = o.sway === undefined ? this.swayFrom : o.sway;
    const plant = (o.plant === undefined ? this.plant : o.plant) ? 64 : 0;
    for (let k = 0; k < 4; k++) {
      this.P.push(pts[k][0], pts[k][1], pts[k][2]);
      this.UV.push(uvs[k][0], uvs[k][1]);
      this.FL.push((pts[k][1] > sw ? 128 : 0) | plant);
    }
    this.N.push(n[0], n[1], n[2]);
    this.TILE.push(tile);
    this.GLOW.push(o.glow === undefined ? 0 : o.glow);
  }

  // Een balk. o.uv = [u0, v0, u1, v1] het stuk van het plaatje voor de zijkanten,
  // o.top = het stuk voor de bovenkant, o.q = extra instellingen per vlak.
  box(tile, x0, y0, z0, x1, y1, z1, o = {}) {
    const uv = o.uv || [0, 0, 1, 1], tp = o.top || uv, c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    const q = (pts, r, t) => this.quad(t, pts, [[r[0], r[3]], [r[2], r[3]], [r[2], r[1]], [r[0], r[1]]], Object.assign({ out: c }, o.q));
    q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], uv, tile);
    q([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], uv, tile);
    q([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], uv, tile);
    q([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], uv, tile);
    q([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], tp, o.topTile === undefined ? tile : o.topTile);
  }

  // Een buis langs een rij punten, met op elk punt een eigen dikte. Daarmee maak je stelen,
  // takken en boomstammen, maar ook bolle vormen (hoed van een paddenstoel, bes, vlam) door
  // de dikte van 0 naar dik en weer naar 0 te laten gaan.
  // o.uv = stuk van het plaatje, o.ur = hoe vaak het plaatje rondom herhaalt,
  // o.cap = plaatje voor een dekseltje op het eind, o.q = extra instellingen per vlak.
  tube(tile, pts, radii, sides, o = {}) {
    const uv = o.uv || [0, 0, 1, 1], ur = o.ur || 1, n = pts.length;
    const rings = [];
    let e1 = null;
    for (let i = 0; i < n; i++) {
      const d = norm3(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
      if (!e1) e1 = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : norm3(cross3(d, [0, 1, 0]));
      const k = e1[0] * d[0] + e1[1] * d[1] + e1[2] * d[2];
      e1 = norm3([e1[0] - d[0] * k, e1[1] - d[1] * k, e1[2] - d[2] * k]);
      const e2 = cross3(d, e1);
      const ring = [];
      for (let s = 0; s <= sides; s++) {
        const a = (s / sides) * TAU + (o.phase || 0), c = Math.cos(a) * radii[i], q = Math.sin(a) * radii[i];
        ring.push([pts[i][0] + e1[0] * c + e2[0] * q, pts[i][1] + e1[1] * c + e2[1] * q, pts[i][2] + e1[2] * c + e2[2] * q]);
      }
      rings.push(ring);
    }
    for (let i = 0; i < n - 1; i++) {
      const va = uv[3] + (uv[1] - uv[3]) * (i / (n - 1)), vb = uv[3] + (uv[1] - uv[3]) * ((i + 1) / (n - 1));
      const mid = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2, (pts[i][2] + pts[i + 1][2]) / 2];
      for (let s = 0; s < sides; s++) {
        const f = ((s * ur) / sides) % 1;
        const ua = uv[0] + (uv[2] - uv[0]) * f, ub = uv[0] + (uv[2] - uv[0]) * (f + ur / sides);
        this.quad(tile, [rings[i][s], rings[i][s + 1], rings[i + 1][s + 1], rings[i + 1][s]], [[ua, va], [ub, va], [ub, vb], [ua, vb]], Object.assign({ out: mid }, o.q));
      }
    }
    if (o.cap !== undefined) this.fan(o.cap, pts[n - 1], rings[n - 1], Object.assign({ out: pts[n - 2] }, o.q));
  }

  // een rond plaatje (deksel): driehoeken vanuit het midden naar een ring van punten
  fan(tile, center, ring, o = {}) {
    const sides = ring.length - 1;
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * TAU, a1 = ((s + 1) / sides) * TAU;
      this.quad(tile, [center, ring[s], ring[s + 1], center],
        [[0.5, 0.5], [0.5 + 0.46 * Math.cos(a0), 0.5 + 0.46 * Math.sin(a0)], [0.5 + 0.46 * Math.cos(a1), 0.5 + 0.46 * Math.sin(a1)], [0.5, 0.5]], o);
    }
  }

  // een platte schijf op hoogte y
  disc(tile, cx, y, cz, r, sides, o = {}) {
    const ring = [];
    for (let s = 0; s <= sides; s++) { const a = (s / sides) * TAU; ring.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]); }
    this.fan(tile, [cx, y, cz], ring, o);
  }

  // Een blaadje of bloemblad: begint in "base", wijst in de richting "ang" en gaat "up"
  // (hoek) omhoog. Het plaatje bepaalt de vorm (v = 1 zit vast, v = 0 is de punt).
  // o.up2 = het tweede stuk buigt een andere kant op (voor een blad dat omkrult).
  flat(tile, base, ang, up, len, width, o = {}) {
    const dx = Math.cos(ang), dz = Math.sin(ang), px = -dz * width / 2, pz = dx * width / 2;
    const at = (b, u, l) => [b[0] + dx * Math.cos(u) * l, b[1] + Math.sin(u) * l, b[2] + dz * Math.cos(u) * l];
    const side = (c, s) => [c[0] + px * s, c[1], c[2] + pz * s];
    if (o.up2 === undefined) {
      const tip = at(base, up, len);
      this.quad(tile, [side(base, -1), side(base, 1), side(tip, 1), side(tip, -1)], [[0, 1], [1, 1], [1, 0], [0, 0]], o);
    } else {
      const mid = at(base, up, len * 0.5), tip = at(mid, o.up2, len * 0.5);
      this.quad(tile, [side(base, -1), side(base, 1), side(mid, 1), side(mid, -1)], [[0, 1], [1, 1], [1, 0.5], [0, 0.5]], o);
      this.quad(tile, [side(mid, -1), side(mid, 1), side(tip, 1), side(tip, -1)], [[0, 0.5], [1, 0.5], [1, 0], [0, 0]], o);
    }
  }

  // Een grasspriet: smal, loopt uit in een punt en buigt naar buiten.
  blade(tile, bx, bz, ang, h, lean, w) {
    const dx = Math.cos(ang), dz = Math.sin(ang), px = -dz, pz = dx;
    const sec = [0, 0.5, 1].map((t) => {
      const cx = bx + dx * lean * t * t, cz = bz + dz * lean * t * t, cy = h * (t - 0.14 * t * t) / 0.86;
      const hw = w * 0.5 * (1 - Math.pow(t, 1.5));
      return [[cx - px * hw, cy, cz - pz * hw], [cx + px * hw, cy, cz + pz * hw], 1 - t];
    });
    for (let i = 0; i < 2; i++) {
      const a = sec[i], b = sec[i + 1], e = 0.5 * (1 - (i ? 0 : 0.35));
      this.quad(tile, [a[0], a[1], b[1], b[0]], [[0.08, a[2]], [0.92, a[2]], [0.5 + e * (i ? 0 : 1), b[2]], [0.5 - e * (i ? 0 : 1), b[2]]]);
    }
  }

  finish() {
    return {
      n: this.TILE.length,
      pos: new Float32Array(this.P), uv: new Float32Array(this.UV), nrm: new Float32Array(this.N),
      tile: new Uint16Array(this.TILE), glow: new Int8Array(this.GLOW), flags: new Uint8Array(this.FL),
      rot: this.rot, jit: this.jit, vary: this.vary, ao: this.ao,
    };
  }
}

// ---------- de plaatjes die de modellen gebruiken ----------

const T = {
  spriet: tileId('gras_spriet'), steel: tileId('plant_steel'), blad: tileId('plant_blad'),
  hart: tileId('bloemhart'), bes: tileId('bes'), tak: tileId('tak'), stok: tileId('stok_hout'),
  vlam: tileId('vlam'), lichtblad: tileId('lichtblad'),
  zwamsteel: tileId('zwamsteel'), stam: tileId('stam_eik'), stamTop: tileId('stam_eik_top'),
  verkoold: tileId('stam_verkoold'), kei: tileId('keisteen'), loof: tileId('blad_eik'),
};

// ---------- de modellen ----------

// Hoog gras: een pol met losse sprieten die alle kanten op buigen.
function gras(seed, n) {
  const r = mulberry32(seed), M = new Model({ jit: 0.12, vary: 0.25, swayFrom: 0.04, plant: 1 });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.8, rad = 0.04 + r() * 0.15;
    M.blade(T.spriet, 0.5 + Math.cos(a) * rad, 0.5 + Math.sin(a) * rad, a + (r() - 0.5) * 1.3, 0.48 + r() * 0.45, 0.08 + r() * 0.22, 0.1 + r() * 0.05);
  }
  return M.finish();
}

// Een bloem: steel, twee blaadjes, een krans van bloemblaadjes en een hart.
function bloem(kleur, n, len, wid, up, seed) {
  const r = mulberry32(seed), M = new Model({ jit: 0.14, vary: 0.2, swayFrom: 0.1, plant: 1 });
  const blad = tileId('bloemblad_' + kleur);
  const top = [0.54, 0.6, 0.5];
  M.tube(T.steel, [[0.5, 0, 0.5], [0.47, 0.3, 0.5], top], [0.024, 0.02, 0.017], 4);
  M.flat(T.blad, [0.485, 0.1, 0.5], 2.5 + r() * 0.4, 0.7, 0.3, 0.16, { up2: 0.2 });
  M.flat(T.blad, [0.475, 0.2, 0.5], -0.6 + r() * 0.4, 0.6, 0.26, 0.14, { up2: 0.1 });
  // de bloem kijkt een beetje opzij, naar het licht
  M.xf = tilt(0.42, top, 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.3;
    M.flat(blad, [top[0] + Math.cos(a) * 0.02, top[1], top[2] + Math.sin(a) * 0.02], a, up + (i % 2) * 0.12, len, wid);
  }
  M.tube(T.hart, [[top[0], top[1] - 0.012, top[2]], [top[0], top[1] + 0.03, top[2]], [top[0], top[1] + 0.055, top[2]]], [0.062, 0.05, 0], 6, { ur: 2 });
  M.xf = null;
  return M.finish();
}

// Lichtbloem: een kelk van lichtgevende blaadjes die omkrullen, met een knop aan een zijtakje.
function lichtbloem() {
  const M = new Model({ jit: 0.12, vary: 0.15, swayFrom: 0.08, plant: 1 });
  const top = [0.55, 0.5, 0.5];
  M.tube(T.steel, [[0.5, 0, 0.5], [0.46, 0.26, 0.5], top], [0.022, 0.018, 0.016], 4);
  M.flat(T.blad, [0.48, 0.08, 0.5], 2.3, 0.6, 0.28, 0.15, { up2: 0.1 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.2;
    M.flat(T.lichtblad, [top[0] + Math.cos(a) * 0.015, top[1], top[2] + Math.sin(a) * 0.015], a, 1.1, 0.34, 0.2, { up2: 0.15, glow: -1 });
  }
  M.tube(T.lichtblad, [[top[0], top[1] - 0.01, top[2]], [top[0], top[1] + 0.05, top[2]], [top[0], top[1] + 0.1, top[2]]], [0, 0.045, 0], 5, { uv: [0.42, 0.4, 0.58, 0.7], q: { glow: -1 } });
  M.tube(T.steel, [[0.47, 0.18, 0.5], [0.36, 0.34, 0.45]], [0.014, 0.011], 3);
  M.tube(T.lichtblad, [[0.36, 0.33, 0.45], [0.352, 0.39, 0.447], [0.345, 0.45, 0.444]], [0, 0.042, 0], 5, { uv: [0.42, 0.4, 0.58, 0.7], q: { glow: -1 } });
  return M.finish();
}

// Bessenstruik: een bol van blaadjes met rode bessen erop.
function bessenstruik() {
  const r = mulberry32(31), M = new Model({ jit: 0.06, vary: 0.12, swayFrom: 0.22, plant: 1 });
  const ys = [0.03, 0.18, 0.4, 0.6, 0.74], rs = [0.2, 0.38, 0.43, 0.3, 0.03];
  M.tube(T.loof, ys.map((y) => [0.5, y, 0.5]), rs, 8, { ur: 2, uv: [0, 0.25, 1, 1] });
  M.tube(T.loof, [[0.5, 0.1, 0.5], [0.5, 0.36, 0.5], [0.5, 0.6, 0.5]], [0.2, 0.3, 0.05], 6, { ur: 2, uv: [0, 0, 1, 0.6], phase: 0.5 });      // een binnenlaag, zodat je er niet doorheen kijkt
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + r() * 0.5, y = 0.2 + r() * 0.42;
    let rad = 0.4;
    for (let k = 0; k < 4; k++) if (y >= ys[k] && y <= ys[k + 1]) rad = rs[k] + (rs[k + 1] - rs[k]) * (y - ys[k]) / (ys[k + 1] - ys[k]);
    const x = 0.5 + Math.cos(a) * rad * 0.97, z = 0.5 + Math.sin(a) * rad * 0.97, b = 0.036 + r() * 0.012;
    M.tube(T.bes, [[x, y - b, z], [x, y, z], [x, y + b, z]], [0, b, 0], 5, { q: { plant: 0 } });
  }
  return M.finish();
}

// Dode struik: een kaal stammetje met takken en twijgjes.
function dodeStruik() {
  const r = mulberry32(5), M = new Model({ jit: 0.08, vary: 0.15 });
  M.tube(T.tak, [[0.5, 0, 0.5], [0.51, 0.16, 0.5], [0.5, 0.32, 0.51]], [0.05, 0.04, 0.03], 5);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + r() * 0.7, y0 = 0.1 + r() * 0.2, l = 0.24 + r() * 0.16, up = 0.26 + r() * 0.3;
    const p0 = [0.5, y0, 0.5];
    const p1 = [0.5 + Math.cos(a) * l * 0.55, y0 + up * 0.45, 0.5 + Math.sin(a) * l * 0.55];
    const p2 = [0.5 + Math.cos(a + 0.4) * l, y0 + up, 0.5 + Math.sin(a + 0.4) * l];
    M.tube(T.tak, [p0, p1, p2], [0.028, 0.02, 0.009], 4);
    const b = a + (r() < 0.5 ? 1 : -1) * (0.7 + r() * 0.5);
    M.tube(T.tak, [p1, [p1[0] + Math.cos(b) * 0.15, p1[1] + 0.13, p1[2] + Math.sin(b) * 0.15]], [0.014, 0.005], 3);
  }
  return M.finish();
}

// Een vlam: druppelvorm, breed onderaan en spits van boven. Het bovenste stuk flakkert.
function vlam(M, cx, cz, y0, h, rad) {
  M.tube(T.vlam, [[cx, y0, cz], [cx, y0 + h * 0.18, cz], [cx, y0 + h * 0.42, cz], [cx, y0 + h * 0.72, cz], [cx, y0 + h, cz]],
    [rad * 0.55, rad, rad * 0.86, rad * 0.46, 0], 6, { q: { glow: 15, sway: y0 + h * 0.3 } });
}

// Fakkel: een stok met een verkoolde kop en een vlam.
function fakkel() {
  const M = new Model({ rot: 1 });
  M.box(T.stok, 0.45, 0, 0.45, 0.55, 0.6, 0.55, { uv: [0.3, 0, 0.55, 1], top: [0.3, 0, 0.55, 0.25] });
  M.box(T.verkoold, 0.43, 0.56, 0.43, 0.57, 0.68, 0.57, { uv: [0.2, 0.3, 0.5, 0.56] });
  vlam(M, 0.5, 0.5, 0.65, 0.36, 0.105);
  return M.finish();
}

// Kampvuur: een kring van stenen, houtblokken die tegen elkaar leunen, gloeiende as en vlammen.
function kampvuur() {
  const r = mulberry32(9), M = new Model({ rot: 1 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU, cx = 0.5 + Math.cos(a) * 0.38, cz = 0.5 + Math.sin(a) * 0.38, s = 0.07 + r() * 0.03, h = 0.07 + r() * 0.05;
    const u = r() * 0.6, v = r() * 0.6;
    M.xf = rotY(a + r(), cx, cz);
    M.box(T.kei, cx - s, 0, cz - s * 0.8, cx + s, h, cz + s * 0.8, { uv: [u, v, u + 0.34, v + 0.3] });
    M.xf = null;
  }
  M.quad(T.verkoold, [[0.25, 0.03, 0.75], [0.75, 0.03, 0.75], [0.75, 0.03, 0.25], [0.25, 0.03, 0.25]], [[0, 1], [1, 1], [1, 0], [0, 0]], { glow: 6 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    M.tube(T.stam, [[0.5 + Math.cos(a) * 0.34, 0.02, 0.5 + Math.sin(a) * 0.34], [0.5 - Math.cos(a) * 0.05, 0.42, 0.5 - Math.sin(a) * 0.05]], [0.062, 0.052], 6, { cap: T.stamTop, uv: [0, 0, 1, 0.6] });
  }
  vlam(M, 0.5, 0.5, 0.08, 0.86, 0.17);
  vlam(M, 0.39, 0.57, 0.06, 0.5, 0.1);
  vlam(M, 0.61, 0.43, 0.06, 0.58, 0.11);
  vlam(M, 0.57, 0.63, 0.05, 0.4, 0.08);
  return M.finish();
}

// Eén paddenstoel: een steel die iets scheef staat, een bolle hoed en lamellen eronder.
// Kleine paddenstoelen krijgen wat minder vlakken dan grote: dat scheelt rekenwerk en je ziet het niet.
function zwam(M, cx, cz, h, rad, hoed, lamellen, scheef, kant) {
  const tx = cx + Math.cos(kant) * scheef, tz = cz + Math.sin(kant) * scheef;
  const groot = rad > 0.16, n = groot ? 8 : 6;
  M.tube(T.zwamsteel, [[cx, 0, cz], [cx + (tx - cx) * 0.4, h * 0.5, cz + (tz - cz) * 0.4], [tx, h, tz]], [rad * 0.26, rad * 0.19, rad * 0.17], groot ? 5 : 4, { q: { glow: 4 } });
  M.xf = tilt(scheef * 1.2, [tx, h, tz], kant);
  M.disc(lamellen, tx, h - rad * 0.2, tz, rad * 0.95, n, { glow: -1, out: [tx, h + rad, tz] });
  if (groot) {
    M.tube(hoed, [[tx, h - rad * 0.26, tz], [tx, h - rad * 0.02, tz], [tx, h + rad * 0.32, tz], [tx, h + rad * 0.56, tz], [tx, h + rad * 0.64, tz]],
      [rad * 0.95, rad, rad * 0.74, rad * 0.36, 0], n, { ur: 2, q: { glow: -1 } });
  } else {
    M.tube(hoed, [[tx, h - rad * 0.26, tz], [tx, h + rad * 0.04, tz], [tx, h + rad * 0.46, tz], [tx, h + rad * 0.64, tz]],
      [rad * 0.95, rad, rad * 0.6, 0], n, { ur: 2, q: { glow: -1 } });
  }
  M.xf = null;
}

function paddenstoelen(kleur, groot) {
  const hoed = tileId('zwamhoed_' + kleur), lam = tileId('zwamlamellen_' + kleur);
  const M = new Model({ jit: 0.06, vary: 0.12 });
  if (groot) {
    zwam(M, 0.48, 0.5, 0.5, 0.3, hoed, lam, 0.05, 0.5);
    zwam(M, 0.74, 0.66, 0.2, 0.12, hoed, lam, 0.03, 2.2);
  } else {
    zwam(M, 0.42, 0.5, 0.5, 0.2, hoed, lam, 0.05, 3.4);
    zwam(M, 0.66, 0.4, 0.32, 0.14, hoed, lam, 0.04, 5.6);
    zwam(M, 0.58, 0.7, 0.18, 0.09, hoed, lam, 0.02, 1.2);
  }
  return M.finish();
}

// Lichtrank: dunne slierten die recht naar beneden hangen (zodat ze op elkaar aansluiten),
// met hier en daar een kraal van licht.
function rank(tile, soort) {
  const M = new Model({ jit: 0.1, swayFrom: -1, plant: 1, ao: 0 });
  const slierten = soort === 0 ? [[0.38, 0.44, 0.3], [0.62, 0.58, 0.72]] : soort === 1 ? [[0.5, 0.5, 0.5]] : [[0.4, 0.6, 0.6], [0.62, 0.42, -1]];
  for (const [x, z, kraal] of slierten) {
    M.tube(tile, [[x, 0, z], [x, 1, z]], [0.023, 0.023], 3, { uv: [0.08, 0, 0.2, 1], q: { glow: -1 } });
    if (kraal >= 0) M.tube(tile, [[x, kraal - 0.07, z], [x, kraal, z], [x, kraal + 0.07, z]], [0, 0.06, 0], 4, { uv: [0.3, 0.3, 0.7, 0.7], q: { glow: -1 } });
  }
  return M.finish();
}

// ---------- welk blok krijgt welk model ----------
// Per blok een lijstje: de mesher kiest er per plek één uit.

export const BLOCK_MODELS = new Array(NUM_BLOCKS).fill(null);
BLOCK_MODELS[B.hoog_gras] = [gras(1, 6), gras(2, 7), gras(3, 5), gras(4, 6)];      // gras staat overal: niet te veel sprieten per pol
BLOCK_MODELS[B.bloem_rood] = [bloem('rood', 5, 0.2, 0.2, 0.5, 11)];
BLOCK_MODELS[B.bloem_geel] = [bloem('geel', 9, 0.2, 0.11, 0.22, 12)];
BLOCK_MODELS[B.bloem_blauw] = [bloem('blauw', 6, 0.17, 0.15, 0.32, 13)];
BLOCK_MODELS[B.lichtbloem] = [lichtbloem()];
BLOCK_MODELS[B.bessenstruik] = [bessenstruik()];
BLOCK_MODELS[B.dode_struik] = [dodeStruik()];
BLOCK_MODELS[B.fakkel] = [fakkel()];
BLOCK_MODELS[B.kampvuur] = [kampvuur()];
BLOCK_MODELS[B.gloeipaddenstoel] = [paddenstoelen('turkoois', true)];
ZWAM_KEYS.forEach((k) => { BLOCK_MODELS[B['gloeizwam_' + k]] = [paddenstoelen(k, false)]; });
TREE_KEYS.forEach((k) => { const t = tileId('lichtvrucht_' + k); BLOCK_MODELS[LIFE_VINES[k]] = [rank(t, 0), rank(t, 1), rank(t, 2)]; });
