// Alle plaatjes van het spel worden hier met JavaScript getekend:
// de blokken-atlas, de icoontjes, de huid van de wezens, zon, maan en wolken.
// Er zijn geen plaatjes-bestanden nodig.
import * as THREE from '../../vendor/three.module.min.js';
import { hash2 } from '../shared/noise.js';
import { TILE_NAMES, BLOCKS, SHAPE_CUBE, SHAPE_CROSS } from '../shared/blocks.js';
import { ITEMS } from '../shared/items.js';

export const TS = 64;       // pixels per plaatje
const PAD = 16;             // rand eromheen tegen doorlopen van kleuren
const CELL = TS + PAD * 2;
export const ATLAS_COLS = 12;

// ---------- ruis-hulpjes (naadloos herhalend) ----------

function vn(x, y, px, py, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed), c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(u, v, cx, cy, oct, seed) {
  let s = 0, a = 1, n = 0;
  for (let o = 0; o < oct; o++) { s += a * vn(u * cx, v * cy, cx, cy, seed + o * 17); n += a; a *= 0.5; cx *= 2; cy *= 2; }
  return s / n;
}
let F1 = 0, F2 = 0, CID = 0, CDX = 0, CDY = 0;
function cell(u, v, n, seed) {
  const x = u * n, y = v * n, xi = Math.floor(x), yi = Math.floor(y);
  F1 = 9; F2 = 9;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const cx = xi + dx, cy = yi + dy;
    const wx = ((cx % n) + n) % n, wy = ((cy % n) + n) % n;
    const px = cx + 0.15 + hash2(wx, wy, seed) * 0.7, py = cy + 0.15 + hash2(wx, wy, seed + 1) * 0.7;
    const d = Math.hypot(x - px, y - py);
    if (d < F1) { F2 = F1; F1 = d; CID = hash2(wx, wy, seed + 2); CDX = x - px; CDY = y - py; }
    else if (d < F2) F2 = d;
  }
}
// De "mooie" plaatjes (zie verderop): als HQ aan staat tekenen dezelfde functies meer detail,
// en geven ze per pixel ook door hoe hoog het oppervlak is (HH, voor reliëf), hoe het glanst
// (HS) en of het licht geeft (HE). -1 betekent: niets gezegd.
let HQ = false, HH = -1, HS = -1, HE = -1;
const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

// ---------- blokken: per pixel een kleur ----------

const dirt = (x, y, u, v) => {
  let c = mix([92, 62, 40], [136, 98, 64], fbm(u, v, 4, 4, 4, 21));
  cell(u, v, 9, 22);
  if (!HQ) {
    if (F1 < 0.2) c = mul(c, CID > 0.5 ? 1.25 : 0.72);
    return mul(c, 0.94 + hash2(x, y, 23) * 0.12);
  }
  // mooie versie: kluitjes, kiezels en fijne korrel
  const klomp = F1 < 0.22 ? 1 - F1 / 0.22 : 0, licht = CID > 0.5;
  if (klomp > 0) c = mul(c, licht ? 1 + 0.3 * klomp : 1 - 0.34 * klomp);
  const fijn = fbm(u, v, 14, 14, 3, 24);
  c = mul(c, 0.8 + fijn * 0.4);
  cell(u, v, 20, 25);
  let kiezel = 0;
  if (CID > 0.72 && F1 < 0.3) {
    kiezel = sst(0.3, 0.1, F1);
    c = mix(c, mix([150, 136, 120], [196, 186, 170], CID), kiezel * 0.85);
    if (-CDX - CDY > 0.12) c = mul(c, 1.12);
  }
  HH = 0.3 + fijn * 0.3 + (licht ? klomp * 0.25 : -klomp * 0.25) + kiezel * 0.35;
  return mul(c, 0.95 + hash2(x, y, 23) * 0.1);
};
const grassTop = (c1, c2, tuft, seed) => (x, y, u, v) => {
  const n = fbm(u, v, 4, 4, 4, seed), blades = vn(u * 32, v * 32, 32, 32, seed + 1), t = fbm(u, v, 8, 8, 2, seed + 2);
  let c = mul(mix(c1, c2, n), 0.8 + blades * 0.4);
  if (t > 0.66) c = mix(c, tuft, (t - 0.66) * 2.2);
  if (HQ) {
    // mooie versie: pollen gras met sprietjes die het licht vangen
    cell(u, v, 18, seed + 5);
    const pol = 1 - Math.min(1, F1 * 1.5), kant = c01(0.5 + (-CDX - CDY) * 0.9), id = CID, f1 = F1;
    const spriet = vn(u * 96 + id * 9, v * 26, 96, 26, seed + 6) * 0.5 + vn(u * 26, v * 96 + id * 7, 26, 96, seed + 7) * 0.5;
    c = mul(c, 0.62 + 0.3 * kant + 0.36 * spriet);
    if (id > 0.9 && f1 < 0.3) c = mix(c, tuft, 0.5);                          // een droog polletje
    if (hash2(x, y, seed + 8) > 0.994) c = mix(c, [255, 255, 230], 0.45);       // dauwdruppel
    HH = 0.25 + pol * 0.4 + spriet * 0.35;
  }
  return c;
};
const grassSide = (grass, under, seed) => (x, y, u, v) => {
  let edge = 0.16 + 0.16 * vn(u * 16, 0, 16, 1, seed) + 0.05 * vn(u * 32, 0, 32, 1, seed + 1);
  if (HQ) edge += 0.08 * vn(u * 64, 0, 64, 1, seed + 2) - 0.03;                 // losse sprietjes over de rand
  if (v < edge) {
    const c = mul(grass(x, y, u, v), 0.72 + 0.28 * (1 - v / edge));
    if (!HQ) return c;
    const str = vn(u * 64, v * 6, 64, 6, seed + 3);
    HH = 0.7 + 0.3 * str;
    return mul(c, 0.84 + 0.32 * str);
  }
  const c = under(x, y, u, v);
  if (!HQ) return mul(c, v < edge + 0.07 ? 0.72 : 1);
  HH = (HH < 0 ? 0.4 : HH) * 0.75;
  return mul(c, 1 - 0.4 * sst(edge + 0.13, edge, v));                           // schaduw onder het gras
};
const stone = (c1, c2, seed, crack = 0.7) => (x, y, u, v) => {
  const n = fbm(u, v, 3, 3, 5, seed);
  let c = mix(c1, c2, n);
  cell(u, v, 4, seed + 1);
  if (!HQ) {
    if (F2 - F1 < 0.05) c = mul(c, crack);
    return mul(c, 0.95 + hash2(x, y, seed + 2) * 0.1);
  }
  // mooie versie: zachte scheuren, haarscheurtjes, korrel en lichte adertjes
  const scheur = sst(0.0, 0.075, F2 - F1), vlak = CID;
  const fijn = fbm(u, v, 10, 10, 3, seed + 3), korrel = fbm(u, v, 36, 36, 2, seed + 4);
  c = mul(c, (0.86 + vlak * 0.14) * (0.84 + fijn * 0.2 + korrel * 0.14));
  cell(u, v, 9, seed + 5);
  const haar = sst(0.0, 0.03, F2 - F1);
  c = mul(c, (crack + (1 - crack) * scheur) * (0.88 + 0.12 * haar));
  if (korrel > 0.72) c = mix(c, c2, (korrel - 0.72) * 1.6);
  HH = 0.2 + vlak * 0.18 + n * 0.25 + fijn * 0.15 + scheur * 0.25 - (1 - haar) * 0.12;
  return mul(c, 0.96 + hash2(x, y, seed + 2) * 0.08);
};
const steen = stone([98, 98, 100], [152, 150, 146], 30);
const basalt = stone([40, 38, 44], [78, 74, 80], 31, 0.55);
const schaduwsteen = stone([40, 32, 56], [74, 62, 94], 32, 0.6);
const hemelsteen = stone([186, 180, 204], [228, 224, 238], 33, 0.86);
const cobble = (c1, c2, seed) => (x, y, u, v) => {
  cell(u, v, 5, seed);
  const e = sst(0.02, 0.16, F2 - F1);
  const c = mul(mix(c1, c2, CID), 0.45 + 0.55 * e);
  if (HQ) {
    // mooie versie: bolle keien met een lichte en een donkere kant, en wat mos in de voegen
    const bol = e * (0.65 + 0.35 * c01(1 - F1 * 1.4)), kant = c01(0.5 + (-CDX - CDY) * 0.7);
    const fijn = fbm(u, v, 18, 18, 3, seed + 4);
    HH = bol * 0.8 + fijn * 0.15;
    const mos = e < 0.3 && fbm(u, v, 6, 6, 2, seed + 5) > 0.58 ? 0.4 : 0;
    return mix(mul(c, (0.72 + 0.36 * kant) * (0.82 + fijn * 0.36)), [66, 92, 50], mos);
  }
  return mul(c, 0.9 + fbm(u, v, 8, 8, 2, seed + 3) * 0.2);
};
const bark = (dark, light, seed, fx = 10) => (x, y, u, v) => {
  const r = 0.6 * vn(u * fx, v * 3, fx, 3, seed) + 0.4 * vn(u * fx * 2, v * 6, fx * 2, 6, seed + 1);
  let c = mix(dark, light, r);
  if (r < 0.3) c = mul(c, 0.7);
  if (HQ) {
    // mooie versie: diepe groeven met fijne ribbels ertussen
    const fijn = vn(u * fx * 5, v * 9, fx * 5, 9, seed + 3), groef = sst(0.24, 0.42, r);
    c = mul(c, (0.72 + 0.28 * groef) * (0.82 + 0.36 * fijn));
    if (vn(u * fx * 0.5, v * 2, fx * 0.5 | 0 || 1, 2, seed + 4) > 0.82) c = mix(c, [96, 112, 70], 0.3);     // een plukje mos
    HH = r * 0.7 + fijn * 0.3;
  }
  return mul(c, 0.93 + hash2(x, y, seed + 2) * 0.14);
};
const logTop = (w1, w2, barkc, seed) => (x, y, u, v) => {
  const d = Math.hypot(u - 0.5, v - 0.5) * 2;
  if (d > 0.84 + fbm(u, v, 8, 8, 2, seed) * 0.08) { if (HQ) HH = 0.85; return mul(barkc, 0.8 + hash2(x, y, seed) * 0.3); }
  const wob = fbm(u, v, 4, 4, 2, seed + 1);
  const ring = Math.sin(d * 24 + wob * 4) * 0.5 + 0.5;
  if (HQ) {
    // mooie versie: fijne jaarringen, droogscheurtjes en een donker hart
    const fijn = Math.sin(d * 70 + wob * 9) * 0.5 + 0.5;
    let c = mul(mix(w1, w2, ring * 0.7 + fijn * 0.2), 0.9 + fbm(u, v, 20, 20, 2, seed + 2) * 0.2);
    const a = Math.atan2(v - 0.5, u - 0.5);
    const barst = Math.abs(Math.sin(a * 3.5 + wob * 2.5));
    if (barst < 0.05 && d > 0.12 && d < 0.6 + wob * 0.2) c = mul(c, 0.55 + barst * 6);
    if (d < 0.1) c = mul(c, 0.7 + d * 3);
    HH = 0.45 + ring * 0.2 + fijn * 0.1 - (barst < 0.05 ? 0.25 : 0);
    return c;
  }
  return mix(w1, w2, ring * 0.8);
};
// mooie versie: drie lagen blaadjes over elkaar; elk blaadje is een ovaaltje met een nerf,
// een lichte en een schaduwkant
function leavesHQ(c1, c2, seed, cover, glow, x, y, u, v) {
  for (let L = 0; L < 3; L++) {
    const n = L === 0 ? 9 : L === 1 ? 7 : 5, cov = cover * (L === 0 ? 1.0 : L === 1 ? 1.08 : 1.22);
    cell(u, v, n, seed + L * 5);
    if (F1 >= cov) continue;
    const ang = CID * 6.283, ca = Math.cos(ang), sa = Math.sin(ang);
    const langs = CDX * ca + CDY * sa, dwars = -CDX * sa + CDY * ca;
    const d = Math.hypot(langs * 0.78, dwars * 1.3);
    if (d >= cov) continue;
    const t = d / cov, diep = L === 0 ? 1 : L === 1 ? 0.86 : 0.7;
    let c = mul(mix(c1, c2, CID * 0.7 + 0.3 * (1 - t)), (1.22 - 0.36 * t) * diep);
    if (Math.abs(dwars) < 0.03) c = mix(c, c2, 0.5);                           // de nerf
    else if (dwars > 0) c = mul(c, 0.84);                                       // de schaduwkant
    if (-CDX - CDY > cov * 0.5) c = mul(c, 1.14);                               // lichtrandje
    if (glow && hash2(x >> 2, y >> 2, seed + 9) > 0.93) { c = glow; HE = 1; }
    HH = (1 - t) * 0.45 * diep + (L === 0 ? 0.5 : L === 1 ? 0.25 : 0.05);
    return [c[0], c[1], c[2], 255];
  }
  HH = 0;
  return [c1[0] * 0.6, c1[1] * 0.6, c1[2] * 0.6, 0];
}
const leaves = (c1, c2, seed, cover = 0.4, glow = null) => (x, y, u, v) => {
  if (HQ) return leavesHQ(c1, c2, seed, cover, glow, x, y, u, v);
  cell(u, v, 7, seed);
  const a1 = F1, id1 = CID;
  cell(u, v, 5, seed + 5);
  const a2 = F1, id2 = CID;
  const on = a1 < cover || a2 < cover * 0.92;
  const id = a1 < cover ? id1 : id2, dd = a1 < cover ? a1 : a2;
  let c = mul(mix(c1, c2, id), 1.12 - dd * 0.9);
  if (glow && hash2(x >> 1, y >> 1, seed + 9) > 0.93) c = glow;
  return [c[0], c[1], c[2], on ? 255 : 0];
};
const ore = (base, c1, c2, seed, size = 0.24, n = 4) => (x, y, u, v) => {
  const b = base(x, y, u, v);
  cell(u, v, n, seed);
  if (CID < 0.25) return b;
  const s = size * (0.7 + CID * 0.5);
  if (HQ) {
    // mooie versie: geslepen klompjes met vlakjes die het licht vangen
    const ang = Math.atan2(CDY, CDX) + CID * 6.283, k = F1 / s;
    const rand = 0.92 + 0.08 * Math.cos(ang * 4);                              // hoekige omtrek
    if (k > rand) {
      if (k > rand + 0.24) return b;
      HH = (HH < 0 ? 0.4 : HH) * 0.55;
      return mul(b, 0.6 + 0.4 * (k - rand) / 0.24);
    }
    const vlak = Math.floor((((ang / 6.283) % 1) + 1) % 1 * 5);
    const f = [0.5, 1.0, 0.72, 0.36, 0.86][vlak];
    let c = mix(c1, c2, f * (0.55 + 0.45 * (1 - k)));
    if (k < 0.3) c = mix(c, c2, 0.55);                                           // het platte bovenvlak
    if (vlak === 1 && k > 0.35 && k < 0.72) c = mix(c, [255, 255, 255], 0.5);    // glinstering
    HH = 0.75 + 0.25 * (1 - k); HS = 1; HE = 1;
    return c;
  }
  if (F1 > s) return F1 < s + 0.05 ? mul(b, 0.7) : b;
  const t = 1 - F1 / s;
  const hi = (-CDX - CDY) > s * 0.2 ? 1 : 0;
  return mix(c1, c2, Math.min(1, t * 0.8 + hi * 0.5));
};
const planks = (c1, seed) => (x, y, u, v) => {
  const b = Math.floor(v * 4), fv = v * 4 - b;
  const g = vn(u * 4 + b * 1.7, v * 48, 4, 48, seed) * 0.6 + vn(u * 8, v * 96, 8, 96, seed + 1) * 0.4;
  let c = mul(c1, (0.8 + g * 0.35) * (0.9 + hash2(b, 0, seed) * 0.2));
  const joint = hash2(b, 1, seed);
  const naad = fv < 0.06 || Math.abs(u - joint) < 0.012;
  if (naad) c = mul(c, 0.55);
  if (HQ) {
    // mooie versie: fijne nerven, noesten en spijkers
    const nerf = vn(u * 6 + b * 3.1, v * 120, 6, 120, seed + 2);
    c = mul(c, 0.84 + 0.28 * nerf);
    const ku = hash2(b, 2, seed) , kd = Math.hypot((u - ku) * 1.0, (fv - 0.55) * 0.22);
    if (hash2(b, 3, seed) > 0.45 && kd < 0.05) c = mul(c, 0.55 + kd * 8);       // een noest
    const su = Math.abs(((u - joint + 1) % 1) - 0.035), sd = Math.hypot(su, (fv - 0.5) * 0.25);
    const spijker = sd < 0.012 || Math.hypot(Math.abs(((u - joint + 1) % 1) - 0.965), (fv - 0.5) * 0.25) < 0.012;
    if (spijker) c = [70, 70, 76];
    HH = naad ? 0.05 : (spijker ? 0.85 : 0.55 + g * 0.2 + nerf * 0.12 + sst(0.06, 0.16, fv) * 0.1);
    if (spijker) HS = 0.7;
  }
  return c;
};
const bricks = (c1, c2, mortar, rows, colsN, seed) => (x, y, u, v) => {
  const r = Math.floor(v * rows), fv = v * rows - r;
  const uu = (u + (r % 2) * 0.5 / colsN) % 1;
  const cI = Math.floor(uu * colsN), fu = uu * colsN - cI;
  if (fv < 0.09 || fu < 0.045) { if (HQ) HH = 0.12 + hash2(x, y, seed) * 0.1; return mul(mortar, 0.9 + hash2(x, y, seed) * 0.15); }
  const id = hash2(cI, r, seed + 1);
  if (HQ) {
    // mooie versie: elke steen is een beetje bol, met putjes en een lichte bovenrand
    const putjes = fbm(u, v, 24, 24, 2, seed + 3), rand = Math.min(fv - 0.09, 1 - fv, fu - 0.045, 1 - fu);
    HH = 0.6 + id * 0.15 + putjes * 0.15 + sst(0, 0.08, rand) * 0.15;
    let c = mul(mix(c1, c2, id), 0.78 + fbm(u, v, 8, 8, 2, seed + 2) * 0.3 + putjes * 0.14);
    if (fv < 0.16) c = mul(c, 1.12); else if (fv > 0.9) c = mul(c, 0.8);
    return c;
  }
  return mul(mix(c1, c2, id), 0.85 + fbm(u, v, 8, 8, 2, seed + 2) * 0.3);
};
const metal = (base, seed) => (x, y, u, v) => {
  let c = mul(base, 0.86 + fbm(u, v, 2, 16, 3, seed) * 0.26);
  const fu = (u * 2) % 1, fv = (v * 2) % 1;
  if (fu < 0.03 || fv < 0.03) c = mul(c, 0.6);
  const ru = Math.abs(fu - 0.5) > 0.38, rv = Math.abs(fv - 0.5) > 0.38;
  const klinknagel = ru && rv && Math.hypot((fu < 0.5 ? fu : 1 - fu) - 0.09, (fv < 0.5 ? fv : 1 - fv) - 0.09) < 0.035;
  if (klinknagel) c = mul(c, 1.35);
  if (HQ) {
    c = mul(c, 0.92 + fbm(u, v, 30, 4, 2, seed + 1) * 0.16);                    // geborsteld
    HH = (fu < 0.03 || fv < 0.03) ? 0.1 : (klinknagel ? 1 : 0.55);
    HS = 0.75;
  }
  return c;
};
const swirl = (c1, c2, seed) => (x, y, u, v) => {
  const du = u - 0.5, dv = v - 0.5, r = Math.hypot(du, dv);
  const s = Math.sin(Math.atan2(dv, du) * 3 + r * 22 + fbm(u, v, 4, 4, 2, seed) * 3) * 0.5 + 0.5;
  const c = mix(c1, c2, s * s);
  return [c[0], c[1], c[2], 150 + s * 90];
};
const gemBlock = (c1, c2, seed) => (x, y, u, v) => {
  cell(u, v, 3, seed);
  const e = sst(0, 0.1, F2 - F1);
  let c = mix(c1, c2, CID * 0.7 + (CDX + CDY < 0 ? 0.3 : 0));
  c = mix([255, 255, 255], c, 0.25 + 0.75 * e);
  const b = Math.min(u, v, 1 - u, 1 - v);
  if (HQ) { HH = 0.3 + e * 0.35 + CID * 0.35; HS = 1; HE = 1; }
  return mul(c, b < 0.05 ? 0.75 : 1);
};
const bevel = (base, seed) => (x, y, u, v) => {
  const b = Math.min(u, v, 1 - u, 1 - v);
  let c = mul(base, 0.92 + fbm(u, v, 4, 4, 3, seed) * 0.16);
  if (b < 0.09) c = mul(c, (u < 0.09 || v < 0.09) && u + v < 1 ? 1.25 : 0.68);
  if (HQ) { HH = b < 0.09 ? b / 0.09 * 0.7 : 0.7 + fbm(u, v, 12, 12, 2, seed + 1) * 0.08; HS = 0.85; }
  return c;
};

// De schil van een 3D-ei: boven lichter, onder donkerder, met spikkels die naar onderen toe
// talrijker worden. extra: 'band' (naad, robot-ei) of 'glitter' (gouden ei).
const eggSkin = (dark, light, spot, seed, extra) => (x, y, u, v) => {
  let c = mix(light, dark, 0.2 + 0.55 * v + (fbm(u, v, 4, 4, 3, seed) - 0.5) * 0.25);
  cell(u, v, 9, seed + 1);
  const size = 0.1 + 0.2 * v + CID * 0.08;
  if (F1 < size && CID > 0.25) c = mix(c, spot, 0.55 + 0.4 * (1 - F1 / size));
  if (extra === 'band' && Math.abs(v - 0.56) < 0.035) c = Math.abs(v - 0.56) < 0.012 ? [20, 26, 34] : mul(c, 0.7);
  if (extra === 'glitter' && hash2(x, y, seed + 2) > 0.985) c = [255, 255, 245];
  return c;
};

const GRAS = grassTop([58, 112, 38], [104, 160, 60], [150, 172, 72], 11);
const SGRAS = grassTop([58, 32, 92], [104, 62, 150], [196, 130, 255], 12);
const HGRAS = grassTop([62, 170, 150], [120, 220, 180], [240, 226, 130], 13);
const PLANK = planks([178, 136, 84], 60);
const WAND = metal([150, 160, 172], 70);
const KEI = cobble([104, 104, 108], [156, 154, 150], 40);

const PX = {
  aarde: dirt,
  gras_top: GRAS,
  gras_side: grassSide(GRAS, dirt, 14),
  steen,
  zand: (x, y, u, v) => mul([224, 206, 152], 0.9 + vn(u * 64, v * 64, 64, 64, 50) * 0.14 + Math.sin((v + fbm(u, v, 4, 4, 2, 51) * 0.25) * 50) * 0.025),
  keisteen: KEI,
  water: (x, y, u, v) => {
    const n = fbm(u, v, 4, 4, 3, 52);
    const c = mix([34, 86, 170], [70, 136, 214], n);
    return [c[0], c[1], c[2], 176];
  },
  lava: (x, y, u, v) => {
    const w = fbm(u, v, 3, 3, 3, 53);
    const n = fbm((u + w * 0.35) % 1, (v + w * 0.2) % 1, 4, 4, 4, 54);
    return n < 0.42 ? mix([70, 14, 4], [230, 70, 8], n / 0.42) : mix([230, 70, 8], [255, 226, 90], Math.min(1, (n - 0.42) / 0.3));
  },
  stam_eik: bark([62, 46, 28], [122, 94, 60], 80),
  stam_eik_top: logTop([196, 158, 104], [150, 112, 66], [92, 70, 44], 81),
  stam_den: bark([50, 32, 22], [112, 72, 48], 82, 12),
  stam_den_top: logTop([190, 140, 90], [140, 92, 56], [80, 52, 36], 83),
  stam_berk: (x, y, u, v) => {
    let c = mul([226, 224, 212], 0.9 + fbm(u, v, 8, 4, 3, 84) * 0.16);
    if (vn(u * 5, v * 16, 5, 16, 85) > 0.74) c = [58, 52, 48];
    return c;
  },
  stam_berk_top: logTop([222, 204, 160], [186, 160, 112], [210, 208, 198], 86),
  stam_schaduw: bark([26, 18, 40], [78, 56, 104], 87),
  stam_schaduw_top: logTop([120, 90, 160], [74, 50, 110], [40, 28, 60], 88),
  stam_verkoold: (x, y, u, v) => {
    const b = bark([14, 12, 12], [52, 46, 44], 89)(x, y, u, v);
    cell(u, v, 4, 90);
    return F2 - F1 < 0.035 && CID > 0.45 ? [255, 120, 30] : b;
  },
  stam_verkoold_top: logTop([60, 52, 48], [28, 24, 22], [18, 16, 16], 91),
  stam_hemel: (x, y, u, v) => {
    const b = bark([196, 186, 160], [246, 240, 222], 92)(x, y, u, v);
    return vn(u * 6, v * 12, 6, 12, 93) > 0.8 ? [240, 200, 90] : b;
  },
  stam_hemel_top: logTop([250, 236, 190], [226, 196, 120], [220, 212, 190], 94),
  blad_eik: leaves([40, 96, 30], [92, 152, 54], 100),
  blad_den: leaves([22, 66, 40], [52, 110, 66], 101, 0.42),
  blad_berk: leaves([86, 146, 44], [150, 190, 70], 102, 0.37),
  blad_schaduw: leaves([70, 30, 110], [156, 76, 200], 103, 0.4, [230, 170, 255]),
  blad_goud: leaves([196, 146, 30], [252, 220, 96], 104, 0.4),
  planken: PLANK,
  steenkool_erts: ore(steen, [24, 24, 28], [70, 70, 78], 110),
  ijzer_erts: ore(steen, [168, 112, 78], [232, 190, 150], 111),
  goud_erts: ore(steen, [214, 160, 20], [255, 240, 130], 112),
  kristal_erts: ore(steen, [40, 190, 210], [220, 255, 255], 113),
  gloeikristal: ore((x, y, u, v) => mul(steen(x, y, u, v), 0.8), [60, 230, 190], [235, 255, 245], 114, 0.36, 3),
  ijskristal_erts: ore(steen, [120, 200, 240], [240, 252, 255], 115),
  vuurkristal_erts: ore(basalt, [230, 60, 10], [255, 220, 110], 116),
  schaduwkristal_erts: ore(schaduwsteen, [130, 50, 230], [236, 190, 255], 117),
  hemelkristal_erts: ore(hemelsteen, [240, 190, 40], [255, 250, 200], 118),
  sneeuw: (x, y, u, v) => {
    const n = fbm(u, v, 4, 4, 3, 120);
    const c = mix([214, 226, 242], [250, 252, 255], n);
    return hash2(x, y, 121) > 0.985 ? [255, 255, 255] : c;
  },
  ijs: (x, y, u, v) => {
    let c = mix([130, 186, 228], [184, 222, 246], fbm(u, v, 3, 3, 3, 122));
    cell(u, v, 3, 123);
    if (F2 - F1 < 0.03) c = [236, 248, 255];
    if (vn(u * 3 + v * 6, v * 24, 9, 24, 124) > 0.8) c = mix(c, [255, 255, 255], 0.5);
    return c;
  },
  basalt,
  as: (x, y, u, v) => mul([96, 92, 90], 0.82 + fbm(u, v, 8, 8, 3, 125) * 0.3 + (hash2(x, y, 126) > 0.9 ? 0.15 : 0)),
  obsidiaan: (x, y, u, v) => {
    const n = fbm(u, v, 3, 6, 4, 127);
    return n > 0.6 ? mix([24, 16, 34], [110, 84, 150], (n - 0.6) * 2.5) : mix([12, 9, 18], [30, 22, 42], n);
  },
  magmasteen: (x, y, u, v) => {
    const b = basalt(x, y, u, v);
    cell(u, v, 4, 128);
    const e = F2 - F1;
    return e < 0.1 ? mix([255, 220, 90], [220, 60, 10], e / 0.1) : (e < 0.16 ? mix([120, 30, 10], b, (e - 0.1) / 0.06) : b);
  },
  schaduwsteen,
  schaduwgras_top: (x, y, u, v) => (hash2(x >> 1, y >> 1, 130) > 0.975 ? [214, 150, 255] : SGRAS(x, y, u, v)),
  schaduwgras_side: grassSide(SGRAS, schaduwsteen, 131),
  wolk: (x, y, u, v) => mix([222, 232, 246], [255, 255, 255], sst(0.25, 0.75, fbm(u, v, 3, 3, 4, 132))),
  hemelgras_top: HGRAS,
  hemelgras_side: grassSide(HGRAS, hemelsteen, 133),
  hemelsteen: (x, y, u, v) => (hash2(x, y, 134) > 0.985 ? [255, 255, 255] : hemelsteen(x, y, u, v)),
  werkbank_top: (x, y, u, v) => {
    let c = PLANK(x, y, u, v);
    const b = Math.min(u, v, 1 - u, 1 - v);
    if (b < 0.07) c = mul(c, 0.55);
    else if (Math.abs(u - 0.5) < 0.012 || Math.abs(v - 0.5) < 0.012) c = mul(c, 0.7);
    // zaag en hamer
    if (u > 0.14 && u < 0.42 && Math.abs(v - 0.28 - (u - 0.14) * 0.3) < 0.035) c = [190, 196, 204];
    if (u > 0.6 && u < 0.66 && v > 0.58 && v < 0.88) c = [110, 76, 44];
    if (u > 0.54 && u < 0.72 && v > 0.56 && v < 0.66) c = [120, 124, 132];
    return c;
  },
  werkbank_side: (x, y, u, v) => {
    let c = PLANK(x, y, u, v);
    if (v < 0.14) c = mul(c, 0.6);
    const inL = u > 0.1 && u < 0.45 && v > 0.3 && v < 0.85, inR = u > 0.55 && u < 0.9 && v > 0.3 && v < 0.85;
    if (inL || inR) {
      const uu = inL ? (u - 0.1) / 0.35 : (u - 0.55) / 0.35, vv = (v - 0.3) / 0.55;
      const e = Math.min(uu, vv, 1 - uu, 1 - vv);
      c = mul(c, e < 0.08 ? 0.5 : 0.82);
      if (Math.hypot(uu - 0.5, vv - 0.5) < 0.09) c = [214, 180, 80];
    }
    return c;
  },
  oven_top: (x, y, u, v) => mul(KEI(x, y, u, v), 0.75),
  oven_side: (x, y, u, v) => {
    const c = KEI(x, y, u, v);
    const du = Math.abs(u - 0.5);
    const inside = du < 0.26 && v > 0.36 && v < 0.86 && (v > 0.52 || Math.hypot(du, v - 0.56) < 0.27);
    if (!inside) return (du < 0.3 && v > 0.3 && v < 0.9) ? mul(c, 0.6) : c;
    const f = fbm(u, v, 6, 6, 2, 140);
    return v > 0.62 + f * 0.12 ? mix([255, 210, 70], [220, 60, 10], (0.86 - v) / 0.24) : [20, 14, 12];
  },
  bed_top: (x, y, u, v) => {
    if (v < 0.3) { const c = mul([240, 238, 232], 0.9 + fbm(u, v, 4, 4, 2, 141) * 0.12); return Math.min(u, 1 - u, v, 0.3 - v) < 0.03 ? mul(c, 0.8) : c; }
    let c = mul([186, 44, 52], 0.85 + fbm(u, v, 4, 4, 3, 142) * 0.25);
    if ((x + y) % 16 < 1 || (x - y + 64) % 16 < 1) c = mul(c, 0.78);
    return c;
  },
  bed_side: (x, y, u, v) => {
    if (v > 0.62) return mul(PLANK(x, y, u, v), 0.8);
    return mul([176, 40, 48], 0.85 + fbm(u, v, 4, 4, 3, 143) * 0.25);
  },
  ei_vuur_schil: eggSkin([150, 24, 8], [255, 140, 44], [255, 224, 90], 230),
  ei_ijs_schil: eggSkin([70, 140, 196], [220, 244, 255], [255, 255, 255], 231),
  ei_natuur_schil: eggSkin([40, 104, 44], [158, 212, 98], [70, 50, 26], 232),
  ei_bliksem_schil: eggSkin([170, 134, 16], [255, 242, 130], [90, 110, 230], 233),
  ei_schaduw_schil: eggSkin([28, 18, 48], [110, 76, 160], [196, 130, 255], 234),
  ei_robot_schil: eggSkin([86, 96, 108], [204, 214, 224], [74, 224, 255], 235, 'band'),
  ei_goud_schil: eggSkin([176, 116, 20], [255, 232, 130], [255, 250, 210], 236, 'glitter'),
  ei_kristal_schil: eggSkin([42, 160, 180], [206, 255, 255], [190, 110, 240], 237),
  // het lange bed: bovenkant van het voeteneind (v = 0 is de kant van het hoofdeind)
  bed_voet_top: (x, y, u, v) => {
    let c = mul([186, 44, 52], 0.85 + fbm(u, v, 4, 4, 3, 142) * 0.25);
    if ((x + y) % 16 < 1 || (x - y + 64) % 16 < 1) c = mul(c, 0.78);
    if (v > 0.9) c = mul(c, 0.7);                              // omgeslagen rand aan het voeteneind
    if (Math.min(u, 1 - u) < 0.03) c = mul(c, 0.8);
    return c;
  },
  // bovenkant van het hoofdeind: laken met een kussen, onderaan begint de deken
  bed_hoofd_top: (x, y, u, v) => {
    if (v > 0.74) {
      if (v < 0.84) return mul([244, 242, 236], 0.92 + fbm(u, v, 8, 8, 2, 144) * 0.1);   // omgeslagen laken
      let c = mul([186, 44, 52], 0.85 + fbm(u, v, 4, 4, 3, 142) * 0.25);
      if ((x + y) % 16 < 1 || (x - y + 64) % 16 < 1) c = mul(c, 0.78);
      return c;
    }
    const sheet = mul([226, 224, 216], 0.92 + fbm(u, v, 6, 6, 2, 145) * 0.1);
    // kussen met ronde hoeken
    const px = Math.max(0, Math.abs(u - 0.5) - 0.26), py = Math.max(0, Math.abs(v - 0.36) - 0.14);
    const d = Math.hypot(px, py);
    if (d < 0.1) {
      const edge = d / 0.1;
      const c = mul([252, 252, 250], 1 - edge * edge * 0.16 + fbm(u, v, 8, 8, 2, 146) * 0.04);
      return c;
    }
    return d < 0.125 ? mul(sheet, 0.8) : sheet;
  },
  bed_hoofd_side: (x, y, u, v) => {
    if (v > 0.62) return mul(PLANK(x, y, u, v), 0.8);
    return mul([232, 230, 222], 0.9 + fbm(u, v, 4, 4, 3, 147) * 0.14);
  },
  glas: (x, y, u, v) => {
    const b = Math.min(u, v, 1 - u, 1 - v);
    if (b < 0.05) return [206, 228, 238, 255];
    const s = Math.abs(((u + v) * 2) % 1 - 0.5) < 0.04 ? 1 : 0;
    return s ? [240, 250, 255, 120] : [190, 225, 240, 46];
  },
  baksteen: bricks([150, 70, 52], [186, 96, 70], [196, 190, 178], 4, 2, 150),
  steenblok: bricks([118, 118, 122], [150, 150, 150], [78, 78, 82], 2, 1, 151),
  schatkist_top: (x, y, u, v) => {
    let c = mul(planks([150, 98, 48], 152)(x, y, u, v), 1);
    if (Math.abs(u - 0.18) < 0.05 || Math.abs(u - 0.82) < 0.05 || Math.min(v, 1 - v) < 0.06) c = mul([70, 72, 80], 0.9 + hash2(x, y, 153) * 0.3);
    return c;
  },
  schatkist_side: (x, y, u, v) => {
    let c = planks([150, 98, 48], 152)(x, y, u, v);
    if (Math.abs(u - 0.18) < 0.05 || Math.abs(u - 0.82) < 0.05 || Math.abs(v - 0.34) < 0.025 || Math.min(v, 1 - v) < 0.05) c = mul([70, 72, 80], 0.9 + hash2(x, y, 153) * 0.3);
    if (Math.abs(u - 0.5) < 0.08 && v > 0.28 && v < 0.5) c = Math.hypot(u - 0.5, v - 0.4) < 0.03 ? [40, 30, 10] : [236, 196, 60];
    return c;
  },
  schatkist_open_top: (x, y, u, v) => {
    const b = Math.min(u, v, 1 - u, 1 - v);
    if (b < 0.1) return mul([70, 72, 80], 0.9 + hash2(x, y, 153) * 0.3);
    return mul([44, 28, 14], 0.7 + b);
  },
  drakennest: (x, y, u, v) => {
    const a = Math.sin((u + v) * Math.PI * 14 + fbm(u, v, 4, 4, 2, 154) * 3), b = Math.sin((u - v) * Math.PI * 14 + fbm(u, v, 4, 4, 2, 155) * 3);
    const t = Math.max(a, b) * 0.5 + 0.5;
    return mix([110, 82, 36], [222, 190, 110], t);
  },
  scheepswand: WAND,
  scheepscomputer: (x, y, u, v) => {
    const c = WAND(x, y, u, v);
    if (u < 0.14 || u > 0.86 || v < 0.16 || v > 0.72) {
      if (v > 0.8 && v < 0.9 && ((u * 8) % 1) > 0.3) return hash2(Math.floor(u * 8), 0, 156) > 0.5 ? [255, 90, 60] : [90, 255, 140];
      return c;
    }
    const line = Math.floor((v - 0.2) * 16), fl = ((v - 0.2) * 16) % 1;
    const len = 0.2 + hash2(line, 1, 157) * 0.55;
    if (fl > 0.25 && fl < 0.7 && u > 0.2 && u < 0.2 + len && hash2(x >> 1, line, 158) > 0.2) return [110, 255, 170];
    return [8, 30, 24];
  },
  machinekrat: (x, y, u, v) => {
    let c = metal([120, 132, 144], 159)(x, y, u, v);
    const b = Math.min(u, v, 1 - u, 1 - v);
    if (b < 0.1) c = mul([70, 78, 88], 0.9 + hash2(x, y, 160) * 0.2);
    else if (v > 0.42 && v < 0.6) c = (Math.floor((u + v) * 10) % 2) ? [240, 200, 40] : [30, 30, 34];
    else if (Math.abs(u - v) < 0.04 || Math.abs(u + v - 1) < 0.04) c = mul(c, 0.7);
    return c;
  },
  krat_leeg: (x, y, u, v) => {
    const b = Math.min(u, v, 1 - u, 1 - v);
    if (b < 0.1) return mul([70, 78, 88], 0.9 + hash2(x, y, 160) * 0.2);
    return mul([40, 44, 50], 0.6 + b * 1.2);
  },
  portaalsteen: (x, y, u, v) => {
    const c = stone([52, 48, 64], [92, 88, 108], 161)(x, y, u, v);
    const r = Math.hypot(u - 0.5, v - 0.5);
    const rune = Math.abs(r - 0.3) < 0.022 || (Math.abs(u - 0.5) < 0.02 && r < 0.3) || (Math.abs(v - 0.5 - (u - 0.5) * 0.6) < 0.02 && r < 0.3);
    return rune ? [110, 240, 255] : c;
  },
  portaal_groen: swirl([20, 90, 40], [150, 255, 160], 162),
  portaal_ijs: swirl([40, 110, 170], [220, 250, 255], 163),
  portaal_vuur: swirl([150, 30, 0], [255, 210, 80], 164),
  portaal_schaduw: swirl([50, 10, 110], [210, 140, 255], 165),
  portaal_wolken: swirl([190, 150, 60], [255, 252, 220], 166),
  levenshout: (x, y, u, v) => {
    const b = bark([64, 44, 26], [132, 98, 60], 167, 8)(x, y, u, v);
    const vein = Math.abs(vn(u * 6, v * 4, 6, 4, 168) - 0.5);
    return vein < 0.008 ? [190, 255, 150] : (vein < 0.024 ? mix([150, 215, 120], b, (vein - 0.008) / 0.016) : b);
  },
  levenshout_top: (x, y, u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const c = logTop([206, 170, 110], [150, 112, 66], [92, 70, 44], 169)(x, y, u, v);
    return d < 0.3 ? mix([230, 255, 190], c, d / 0.3) : c;
  },
  levensblad_groot: leaves([30, 150, 60], [120, 240, 110], 170, 0.5, [230, 255, 190]),
  levensblad_ijs: leaves([120, 200, 240], [230, 250, 255], 171, 0.5, [255, 255, 255]),
  levensblad_vuur: leaves([220, 60, 10], [255, 190, 50], 172, 0.5, [255, 250, 180]),
  levensblad_schaduw: leaves([120, 30, 200], [230, 110, 250], 173, 0.5, [255, 210, 255]),
  levensblad_hemel: leaves([240, 200, 70], [255, 250, 210], 174, 0.5, [255, 255, 255]),
  levensblad_dor: leaves([84, 76, 62], [128, 116, 96], 175, 0.3),
  levenshart: (x, y, u, v) => {
    const X = (u - 0.5) * 2.7, Y = (0.46 - v) * 2.7;
    const h = Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y;
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (h < 0) return mix([255, 255, 230], [120, 255, 140], Math.min(1, d * 2.6));
    const b = bark([54, 38, 22], [112, 84, 52], 167, 8)(x, y, u, v);
    return mix([170, 255, 160], b, sst(0.0, 0.5, Math.min(1, h * 0.25 + 0.2)));
  },
  oergesteente: (x, y, u, v) => {
    const n = fbm(u, v, 6, 6, 3, 180);
    return n > 0.55 ? [78, 78, 84] : (n > 0.42 ? [44, 44, 48] : [20, 20, 24]);
  },
  kristalblok: gemBlock([40, 190, 214], [170, 246, 250], 181),
  goudblok: bevel([244, 200, 50], 182),
  ijzerblok: bevel([214, 216, 222], 183),
  lamp: (x, y, u, v) => {
    const b = Math.min(u, v, 1 - u, 1 - v), d = Math.hypot(u - 0.5, v - 0.5);
    if (b < 0.07) return [90, 80, 60];
    return mix([255, 255, 235], [255, 196, 90], Math.min(1, d * 2));
  },
};

// ---------- sprites die we met de teken-functies van de browser maken ----------

// De omtrek van een ei: smal en rond van boven, bol van onder.
function eggPath(g, cx, cy, hh, w) {
  g.beginPath();
  for (let i = 0; i <= 56; i++) {
    const th = (i / 56) * Math.PI * 2;
    const x = Math.sin(th) * (1 - 0.17 * Math.cos(th)), y = -Math.cos(th);
    if (i === 0) g.moveTo(cx + x * w, cy + y * hh); else g.lineTo(cx + x * w, cy + y * hh);
  }
  g.closePath();
}

// Een drakenei. c1 = donkere kleur, c2 = lichte kleur, spot = kleur van de spikkels.
// extra: 'band' (naad met klinknagels, voor het robot-ei) of 'glitter' (sterretjes, voor het gouden ei)
function eggDraw(c1, c2, spot, seed, extra) {
  return (g) => {
    const cx = 32, cy = 33, hh = 26, w = 19.5;
    // de bolle vorm: licht van linksboven, donker naar rechtsonder
    eggPath(g, cx, cy, hh, w);
    const gr = g.createRadialGradient(cx - 6, cy - 8, 2, cx + 1, cy + 3, 32);
    gr.addColorStop(0, shadeHex(c2, 1.25)); gr.addColorStop(0.32, c2); gr.addColorStop(0.78, c1); gr.addColorStop(1, shadeHex(c1, 0.6));
    g.fillStyle = gr; g.fill();
    g.save();
    eggPath(g, cx, cy, hh, w);
    g.clip();
    // spikkels: klein, en de meeste aan de bolle onderkant, zoals bij een echt ei
    g.fillStyle = spot;
    for (let i = 0; i < 46; i++) {
      const fy = Math.pow(hash2(i, 2, seed), 0.6);
      const y = cy - hh + fy * 2 * hh, x = cx + (hash2(i, 1, seed) - 0.5) * 2 * w;
      const r = 0.6 + hash2(i, 3, seed) * (i < 7 ? 3.2 : 1.5);
      g.globalAlpha = 0.45 + hash2(i, 5, seed) * 0.55;
      g.beginPath(); g.ellipse(x, y, r, r * (0.6 + hash2(i, 6, seed) * 0.4), hash2(i, 4, seed) * 3, 0, 6.3); g.fill();
    }
    g.globalAlpha = 1;
    if (extra === 'band') {
      // robot-ei: een naad rond het midden met klinknagels
      g.strokeStyle = 'rgba(20,26,34,0.75)'; g.lineWidth = 2.2;
      g.beginPath(); g.ellipse(cx, cy + 4, w + 2, 5, 0, 0, Math.PI); g.stroke();
      g.fillStyle = 'rgba(235,245,255,0.9)';
      for (let k = -2; k <= 2; k++) { g.beginPath(); g.arc(cx + k * 7.2, cy + 4 + Math.sqrt(Math.max(0, 1 - (k * 7.2 / (w + 2)) ** 2)) * 5 - 3.4, 1.1, 0, 6.3); g.fill(); }
    }
    // schaduw aan de rand, zodat het ei rond lijkt
    const sh = g.createRadialGradient(cx - 5, cy - 6, 9, cx, cy + 2, 31);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.7, 'rgba(0,0,0,0.12)'); sh.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = sh; g.fillRect(0, 0, 64, 64);
    // glans
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath(); g.ellipse(cx - 6, cy - 9, 6.5, 11, 0.42, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.62)';
    g.beginPath(); g.ellipse(cx - 8, cy - 13, 2.6, 5.2, 0.42, 0, 6.3); g.fill();
    if (extra === 'glitter') {
      g.fillStyle = 'rgba(255,255,255,0.95)';
      for (const [x, y, r] of [[40, 24, 3.2], [27, 44, 2.4], [38, 48, 1.8]]) {
        g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.3, y - r * 0.3); g.lineTo(x + r, y); g.lineTo(x + r * 0.3, y + r * 0.3);
        g.lineTo(x, y + r); g.lineTo(x - r * 0.3, y + r * 0.3); g.lineTo(x - r, y); g.lineTo(x - r * 0.3, y - r * 0.3); g.closePath(); g.fill();
      }
    }
    g.restore();
    // dun randje
    eggPath(g, cx, cy, hh, w);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.2; g.stroke();
  };
}
function flowerDraw(petal, center) {
  return (g) => {
    g.strokeStyle = '#3c7a2a'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(32, 63); g.quadraticCurveTo(29, 44, 32, 26); g.stroke();
    g.fillStyle = '#4c9a34';
    g.beginPath(); g.ellipse(24, 48, 8, 3.5, 0.6, 0, 6.3); g.fill();
    g.beginPath(); g.ellipse(40, 52, 8, 3.5, -0.6, 0, 6.3); g.fill();
    g.fillStyle = petal;
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.beginPath(); g.ellipse(32 + Math.cos(a) * 8, 22 + Math.sin(a) * 8, 7, 5, a, 0, 6.3); g.fill(); }
    g.fillStyle = center; g.beginPath(); g.arc(32, 22, 5, 0, 6.3); g.fill();
  };
}
const DRAW = {
  fakkel: (g) => {
    g.fillStyle = '#6e4a26'; g.fillRect(29, 28, 6, 36);
    g.fillStyle = '#4a3018'; g.fillRect(33, 28, 2, 36);
    const gr = g.createRadialGradient(32, 22, 1, 32, 20, 13);
    gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.4, '#ffd040'); gr.addColorStop(1, '#f05010');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(44, 16, 42, 30, 32, 31); g.bezierCurveTo(22, 30, 20, 16, 32, 4); g.fill();
  },
  kampvuur: (g) => {
    g.lineCap = 'round'; g.lineWidth = 8;
    g.strokeStyle = '#5a3a1c'; g.beginPath(); g.moveTo(8, 60); g.lineTo(56, 48); g.stroke();
    g.strokeStyle = '#6e4a26'; g.beginPath(); g.moveTo(56, 60); g.lineTo(8, 48); g.stroke();
    const flame = (x, w, h, c0, c1) => {
      const gr = g.createLinearGradient(0, 56, 0, 56 - h);
      gr.addColorStop(0, c0); gr.addColorStop(1, c1);
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x, 56 - h); g.bezierCurveTo(x + w, 56 - h * 0.5, x + w * 0.8, 56, x, 56); g.bezierCurveTo(x - w * 0.8, 56, x - w, 56 - h * 0.5, x, 56 - h); g.fill();
    };
    flame(32, 22, 50, '#ff9a20', '#e03008');
    flame(20, 12, 30, '#ffb030', '#f05010');
    flame(44, 12, 34, '#ffb030', '#f05010');
    flame(32, 12, 32, '#fff6c0', '#ffc030');
  },
  hoog_gras: (g) => {
    g.lineCap = 'round';
    for (let i = 0; i < 11; i++) {
      const x = 6 + i * 5.2, h = 22 + hash2(i, 1, 200) * 30, sw = (hash2(i, 2, 200) - 0.5) * 16;
      g.strokeStyle = hash2(i, 3, 200) > 0.5 ? '#5a9e3a' : '#3f7e2c'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, 64); g.quadraticCurveTo(x, 64 - h * 0.6, x + sw, 64 - h); g.stroke();
    }
  },
  bloem_rood: flowerDraw('#e0362c', '#ffd23a'),
  bloem_geel: flowerDraw('#ffd626', '#b86a14'),
  bloem_blauw: flowerDraw('#4a7cf0', '#fff0a0'),
  bessenstruik: (g) => {
    for (let i = 0; i < 26; i++) {
      const x = 32 + (hash2(i, 1, 201) - 0.5) * 44, y = 40 + (hash2(i, 2, 201) - 0.5) * 40, r = 7 + hash2(i, 3, 201) * 6;
      g.fillStyle = hash2(i, 4, 201) > 0.5 ? '#2f6e26' : '#3f8a30';
      g.beginPath(); g.arc(x, Math.min(57, y), r, 0, 6.3); g.fill();
    }
    for (let i = 0; i < 9; i++) {
      const x = 14 + hash2(i, 5, 201) * 36, y = 24 + hash2(i, 6, 201) * 30;
      g.fillStyle = '#c0203a'; g.beginPath(); g.arc(x, y, 3.2, 0, 6.3); g.fill();
      g.fillStyle = '#ff8090'; g.beginPath(); g.arc(x - 1, y - 1, 1, 0, 6.3); g.fill();
    }
  },
  dode_struik: (g) => {
    g.strokeStyle = '#6a4c2e'; g.lineCap = 'round';
    const br = (x, y, a, l, w) => {
      const x2 = x + Math.sin(a) * l, y2 = y - Math.cos(a) * l;
      g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      if (l > 9) { br(x2, y2, a - 0.6, l * 0.62, w * 0.7); br(x2, y2, a + 0.5, l * 0.66, w * 0.7); }
    };
    br(32, 64, 0, 22, 4);
  },
  gloeipaddenstoel: (g) => {
    g.fillStyle = '#d8e6e0'; g.fillRect(28, 34, 8, 30);
    const gr = g.createRadialGradient(32, 26, 2, 32, 30, 24);
    gr.addColorStop(0, '#e8fffa'); gr.addColorStop(0.5, '#4ae8d0'); gr.addColorStop(1, '#1a8a8a');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(8, 38); g.bezierCurveTo(8, 6, 56, 6, 56, 38); g.closePath(); g.fill();
    g.fillStyle = '#f4fffc';
    for (const [x, y, r] of [[22, 24, 3], [36, 18, 4], [44, 30, 2.5], [28, 32, 2]]) { g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
  },
  ei_vuur: eggDraw('#a01808', '#ff8a2a', 'rgba(255,220,80,0.8)', 210),
  ei_ijs: eggDraw('#4a8fc0', '#d8f2ff', 'rgba(255,255,255,0.85)', 211),
  ei_natuur: eggDraw('#2a6a2c', '#9ad060', 'rgba(60,40,20,0.5)', 212),
  ei_bliksem: eggDraw('#b08a10', '#fff080', 'rgba(90,110,230,0.8)', 213),
  ei_schaduw: eggDraw('#1c1230', '#6a4a9a', 'rgba(190,120,255,0.8)', 214),
  ei_robot: eggDraw('#56606c', '#c8d2dc', 'rgba(74,224,255,0.9)', 215, 'band'),
  ei_goud: eggDraw('#b87a14', '#ffe680', 'rgba(255,255,255,0.8)', 216, 'glitter'),
  ei_kristal: eggDraw('#2aa8b8', '#c8ffff', 'rgba(190,110,240,0.8)', 217),
};
for (let k = 0; k < 4; k++) {
  DRAW['crack' + k] = (g) => {
    g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 2.2; g.lineCap = 'round';
    const n = 3 + k * 3;
    for (let i = 0; i < n; i++) {
      let x = 32 + (hash2(i, 9, 220) - 0.5) * 10, y = 32 + (hash2(i, 8, 220) - 0.5) * 10;
      let a = hash2(i, 1, 220) * 6.283;
      g.beginPath(); g.moveTo(x, y);
      const segs = 2 + Math.floor((k + 1) * 1.2);
      for (let s = 0; s < segs; s++) { a += (hash2(i, s + 2, 220) - 0.5) * 1.4; x += Math.cos(a) * 8; y += Math.sin(a) * 8; g.lineTo(x, y); }
      g.stroke();
    }
  };
}

// ---------- nieuwe ertsen, edelstenen, gesteente en spullen ----------

const marmer = (x, y, u, v) => {
  let c = mix([214, 212, 206], [250, 249, 244], fbm(u, v, 3, 3, 4, 310));
  const w = fbm(u, v, 2, 2, 3, 311);
  const ader = Math.abs(fbm((u + w * 0.3) % 1, (v + w * 0.2) % 1, 3, 3, 4, 312) - 0.5);
  if (ader < 0.035) c = mix([134, 136, 148], c, ader / 0.035);
  const ader2 = Math.abs(fbm(u, v, 5, 5, 3, 313) - 0.5);
  if (ader2 < 0.012) c = mix([176, 170, 160], c, 0.4);
  return c;
};
const graniet = (x, y, u, v) => {
  cell(u, v, 13, 314);
  let c = CID < 0.3 ? [84, 70, 72] : CID < 0.62 ? [186, 142, 128] : CID < 0.86 ? [214, 196, 186] : [48, 44, 48];
  c = mix(c, [150, 118, 110], sst(0.25, 0.6, F1));
  return mul(c, 0.9 + fbm(u, v, 6, 6, 2, 315) * 0.2);
};
const tegels = (base, n, seed) => (x, y, u, v) => {
  const fu = (u * n) % 1, fv = (v * n) % 1;
  const b = Math.min(fu, fv, 1 - fu, 1 - fv);
  let c = mul(base(x, y, u, v), 0.94 + hash2(Math.floor(u * n), Math.floor(v * n), seed) * 0.1);
  if (b < 0.035) c = mul(c, 0.62); else if (b < 0.075) c = mul(c, (fu < 0.075 || fv < 0.075) ? 1.1 : 0.85);
  return c;
};
const zwamKleur = {
  blauw: [[24, 110, 230], [120, 226, 255]], roze: [[214, 30, 140], [255, 170, 226]], groen: [[40, 190, 60], [196, 255, 150]],
  oranje: [[236, 104, 14], [255, 220, 120]], paars: [[120, 40, 226], [222, 176, 255]],
  turkoois: [[16, 150, 150], [150, 250, 236]],
};
const rankKleur = { groen: [[60, 220, 170], [224, 255, 240]], ijs: [[90, 180, 255], [236, 250, 255]], vuur: [[255, 130, 30], [255, 240, 170]], schaduw: [[170, 70, 255], [246, 214, 255]], wolken: [[255, 206, 80], [255, 252, 224]] };

Object.assign(PX, {
  koper_erts: ore(steen, [186, 96, 44], [255, 180, 116], 300),
  zilver_erts: ore(steen, [186, 198, 214], [255, 255, 255], 301),
  robijn_erts: ore(steen, [196, 14, 44], [255, 150, 164], 302, 0.2),
  saffier_erts: ore(steen, [26, 64, 220], [150, 204, 255], 303, 0.2),
  smaragd_erts: ore(steen, [16, 164, 76], [160, 255, 196], 304, 0.2),
  amethist_erts: ore(steen, [132, 52, 208], [232, 184, 255], 305),
  zwavel_erts: ore(steen, [212, 190, 24], [255, 250, 150], 306, 0.26, 5),
  marmer,
  graniet,
  marmerblok: tegels(marmer, 2, 316),
  granietblok: tegels((x, y, u, v) => mul(graniet(x, y, u, v), 1.08), 2, 317),
  marmerzuil: (x, y, u, v) => {
    const c = marmer(x, y, u, v);
    const groef = Math.cos(u * Math.PI * 2 * 5);                      // vijf groeven
    let f = 0.78 + 0.26 * groef;
    if (v < 0.1 || v > 0.9) f = (v < 0.03 || v > 0.97 || Math.abs(v - 0.1) < 0.012 || Math.abs(v - 0.9) < 0.012) ? 0.7 : 1.04;
    return mul(c, f);
  },
  marmerzuil_top: (x, y, u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5), b = Math.min(u, v, 1 - u, 1 - v);
    let c = marmer(x, y, u, v);
    if (b < 0.05 || Math.abs(d - 0.36) < 0.015) c = mul(c, 0.7);
    return d < 0.36 ? mul(c, 0.92) : c;
  },
  robijnblok: gemBlock([190, 10, 40], [255, 120, 140], 320),
  saffierblok: gemBlock([20, 60, 214], [130, 190, 255], 321),
  smaragdblok: gemBlock([10, 156, 70], [130, 250, 170], 322),
  amethistblok: gemBlock([126, 44, 204], [222, 164, 255], 323),
  koperblok: bevel([214, 122, 66], 324),
  zilverblok: bevel([226, 232, 240], 325),
  lantaarn: (x, y, u, v) => {
    const du = Math.abs(u - 0.5), b = Math.min(u, 1 - u);
    const koper = mul([188, 104, 52], 0.85 + fbm(u, v, 2, 12, 2, 326) * 0.3);
    if (v < 0.12 || v > 0.88 || b < 0.09) return (v < 0.03 || v > 0.97 || b < 0.02) ? mul(koper, 0.6) : koper;
    if (du < 0.03 || Math.abs(v - 0.5) < 0.02) return mul(koper, 0.8);                // spijltjes
    const d = Math.hypot((u - 0.5) * 1.2, v - 0.56);
    return mix([255, 255, 236], [255, 176, 60], Math.min(1, d * 2.4));
  },
  lantaarn_top: (x, y, u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    const c = mul([188, 104, 52], 0.85 + fbm(u, v, 6, 6, 2, 327) * 0.3);
    return d < 0.1 ? mul(c, 0.55) : (Math.abs(d - 0.3) < 0.02 ? mul(c, 0.7) : c);
  },
  dynamiet: (x, y, u, v) => {
    const fu = (u * 4) % 1, rond = Math.sin(fu * Math.PI);                             // vier staven naast elkaar
    let c = mul([206, 34, 30], 0.5 + 0.6 * rond);
    if (v > 0.36 && v < 0.64) {                                                         // papieren band met een vlam erop
      c = mul([236, 222, 186], 0.72 + 0.3 * rond);
      const X = (u - 0.5) * 5, Y = (0.57 - v) * 7;
      if (X * X + (Y - 0.2) * (Y - 0.2) * 0.6 < 0.42 - Y * 0.3 && Y > -0.55) c = Y > 0.1 ? [236, 70, 20] : [255, 190, 40];
    } else if (Math.abs(v - 0.36) < 0.02 || Math.abs(v - 0.64) < 0.02) c = mul(c, 0.5);
    if (v < 0.05 || v > 0.95) c = mul(c, 0.6);
    return c;
  },
  dynamiet_aan: (x, y, u, v) => {
    const fu = (u * 4) % 1, rond = Math.sin(fu * Math.PI);
    let c = mix(mul([255, 90, 40], 0.6 + 0.5 * rond), [255, 250, 200], 0.35 + 0.3 * fbm(u, v, 4, 4, 2, 328));
    if (v > 0.36 && v < 0.64) c = mix([255, 244, 190], [255, 150, 30], Math.abs(v - 0.5) * 6);
    if (hash2(x >> 1, y >> 1, 329) > 0.9) c = [255, 255, 255];
    return c;
  },
  dynamiet_top: (x, y, u, v) => {
    const fu = (u * 2) % 1 - 0.5, fv = (v * 2) % 1 - 0.5, d = Math.hypot(fu, fv);
    if (d > 0.44) return [70, 22, 20];
    let c = mul([214, 44, 36], 1.05 - d * 0.7);
    if (d < 0.09) c = [60, 50, 44];                                                     // lontje
    else if (Math.abs(d - 0.3) < 0.025) c = mul(c, 0.72);
    return c;
  },
  zwamsteel: (x, y, u, v) => {
    const vezel = vn(u * 14, v * 3, 14, 3, 330) * 0.6 + vn(u * 28, v * 5, 28, 5, 331) * 0.4;
    let c = mix([196, 190, 170], [246, 244, 230], vezel);
    if (vn(u * 5, v * 9, 5, 9, 332) > 0.78) c = mix(c, [150, 232, 220], 0.45);            // lichtgevende plekjes
    return c;
  },
  zwamsteel_top: (x, y, u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const c = mix([250, 248, 236], [206, 200, 180], Math.min(1, d));
    return Math.abs(d - 0.55) < 0.05 ? mul(c, 0.86) : c;
  },
  gloeimos_top: (x, y, u, v) => {
    let c = mix([18, 70, 62], [44, 128, 96], fbm(u, v, 5, 5, 4, 333));
    c = mul(c, 0.8 + vn(u * 32, v * 32, 32, 32, 334) * 0.4);
    cell(u, v, 8, 335);
    if (F1 < 0.16 + CID * 0.1 && CID > 0.35) c = mix([150, 255, 214], c, sst(0.02, 0.2, F1));
    if (hash2(x, y, 336) > 0.985) c = [220, 255, 240];
    return c;
  },
});
PX.gloeimos_side = grassSide(PX.gloeimos_top, dirt, 337);
for (const k in zwamKleur) {
  const [dark, light] = zwamKleur[k];
  const seed = 340 + Object.keys(zwamKleur).indexOf(k) * 7;
  // de hoed: felle kleur met lichte stippen
  PX['zwamhoed_' + k] = (x, y, u, v) => {
    let c = mix(dark, mix(dark, light, 0.45), fbm(u, v, 3, 3, 3, seed));
    cell(u, v, 4, seed + 1);
    const r = 0.13 + CID * 0.12;
    if (F1 < r) c = mix([255, 255, 255], light, sst(0, r, F1) * 0.9);
    else if (F1 < r + 0.05) c = mix(light, c, 0.35);
    return c;
  };
  // de onderkant: lamellen die vanuit het midden naar buiten lopen
  PX['zwamlamellen_' + k] = (x, y, u, v) => {
    const a = Math.atan2(v - 0.5, u - 0.5), d = Math.hypot(u - 0.5, v - 0.5);
    const lam = Math.sin(a * 22) * 0.5 + 0.5;
    const c = mix(mul(dark, 0.55), light, 0.25 + 0.75 * lam * lam);
    return mix([255, 255, 255], c, Math.min(1, 0.3 + d * 1.6));
  };
}
for (const k in rankKleur) {
  const [col, light] = rankKleur[k];
  const seed = 380 + Object.keys(rankKleur).indexOf(k) * 5;
  // lichtrank: dunne slierten met kraaltjes van licht; sluit boven en onder op zichzelf aan
  PX['lichtrank_' + k] = (x, y, u, v) => {
    let best = 9, kraal = 0;
    for (let i = 0; i < 4; i++) {
      const cx = 0.14 + i * 0.24 + Math.sin(v * Math.PI * 2 * (1 + (i & 1)) + i * 1.9) * 0.045;
      const d = Math.abs(u - cx);
      if (d < best) { best = d; kraal = Math.pow(Math.sin(v * Math.PI * (3 + i) + i * 2.3), 8); }
    }
    const w = 0.022 + kraal * 0.05;
    if (best > w) return [col[0], col[1], col[2], 0];
    const c = mix(light, col, Math.min(1, best / w) * (1 - kraal * 0.7));
    return [c[0], c[1], c[2], 255];
  };
  // lichtvrucht: een lampion van blaadjes met een fel hart
  PX['lichtvrucht_' + k] = (x, y, u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    cell(u, v, 3, seed);
    const rand = sst(0.0, 0.09, F2 - F1);
    let c = mix([255, 255, 255], col, Math.min(1, d * 1.5 + 0.1));
    c = mix(mul(col, 0.55), c, 0.35 + 0.65 * rand);
    return mix(c, light, 0.25);
  };
}

function zwamDraw(dark, light) {
  const cd = 'rgb(' + dark.join(',') + ')', cl = 'rgb(' + light.join(',') + ')';
  return (g) => {
    const een = (x, base, h, r) => {
      g.strokeStyle = '#e9e6d6'; g.lineWidth = Math.max(3, r * 0.34); g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + r * 0.2, base - h * 0.5, x, base - h); g.stroke();
      const gr = g.createRadialGradient(x - r * 0.2, base - h - r * 0.5, 1, x, base - h, r * 1.2);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, cl); gr.addColorStop(1, cd);
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x - r, base - h + 1); g.bezierCurveTo(x - r, base - h - r * 1.25, x + r, base - h - r * 1.25, x + r, base - h + 1); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x - r * 0.5 + i * r * 0.5, base - h - r * (0.35 + (i % 2) * 0.3), r * 0.11, 0, 6.3); g.fill(); }
    };
    een(20, 64, 26, 11); een(42, 64, 40, 14); een(53, 64, 16, 7);
  };
}
for (const k in zwamKleur) DRAW['gloeizwam_' + k] = zwamDraw(zwamKleur[k][0], zwamKleur[k][1]);
DRAW.lichtbloem = (g) => {
  g.strokeStyle = '#2f9a78'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(32, 64); g.quadraticCurveTo(26, 44, 32, 26); g.stroke();
  g.beginPath(); g.moveTo(30, 50); g.quadraticCurveTo(16, 46, 14, 36); g.stroke();
  const gr = g.createRadialGradient(32, 20, 1, 32, 20, 17);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#a8fff0'); gr.addColorStop(1, '#2fd4ff');
  g.fillStyle = gr;
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.62; g.beginPath(); g.ellipse(32 + Math.cos(a) * 10, 22 + Math.sin(a) * 10, 9, 4.6, a, 0, 6.3); g.fill(); }
  g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(32, 22, 4, 0, 6.3); g.fill();
  g.fillStyle = '#c8fff4'; g.beginPath(); g.arc(14, 34, 3.5, 0, 6.3); g.fill();
};

// ---------- plaatjes voor de 3D-modellen van planten, vuur en zo (zie blockmodels.js) ----------
// De vorm van een blaadje zit in het plaatje: v = 1 is waar het vastzit, v = 0 is de punt.
// spits blad (met een punt) of rond bloemblad (smal onderaan, rond van boven)
const bladBreedte = (t) => 0.46 * Math.pow(Math.sin(Math.PI * Math.pow(c01(t), 0.72)), 0.75);
const bloembladBreedte = (t) => (t > 0.62 ? 0.47 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.62) / 0.36, 2))) : 0.47 * (0.22 + 0.78 * sst(0, 0.62, t)));
const bloemblad = (basis, midden, punt, seed) => (x, y, u, v) => {
  const t = 1 - v, d = Math.abs(u - 0.5), w = bloembladBreedte(t);
  let c = t < 0.35 ? mix(basis, midden, t / 0.35) : mix(midden, punt, (t - 0.35) / 0.65);
  c = mul(c, 0.9 + 0.2 * vn(u * 18, v * 3, 18, 3, seed) - (w > 0 ? 0.18 * Math.pow(d / w, 3) : 0));
  if (d < 0.02) c = mul(c, 0.9);
  return [c[0], c[1], c[2], d < w && t > 0.02 ? 255 : 0];
};
Object.assign(PX, {
  gras_spriet: (x, y, u, v) => {
    const t = 1 - v, rib = Math.abs(u - 0.5);
    let c = mix([28, 80, 24], [132, 192, 64], c01(t * 0.85 + (fbm(u, v, 4, 8, 2, 400) - 0.5) * 0.3));
    if (rib < 0.07) c = mul(c, 1.16); else if (rib > 0.36) c = mul(c, 0.8);
    return c;
  },
  plant_steel: (x, y, u, v) => mul([56, 124, 46], 0.78 + vn(u * 12, v * 4, 12, 4, 401) * 0.44),
  plant_blad: (x, y, u, v) => {
    const t = 1 - v, d = Math.abs(u - 0.5), w = bladBreedte(t);
    let c = mix([34, 96, 30], [96, 170, 60], c01(0.25 + t * 0.6 + (fbm(u, v, 6, 6, 2, 402) - 0.5) * 0.3));
    const nerf = Math.abs(((d * 6 + t * 3) % 1) - 0.5);
    if (d < 0.025) c = mul(c, 1.3); else if (nerf < 0.06) c = mul(c, 1.1);
    if (u > 0.5) c = mul(c, 0.88);
    return [c[0], c[1], c[2], d < w && t > 0.01 ? 255 : 0];
  },
  bloemblad_rood: bloemblad([96, 8, 16], [226, 36, 36], [255, 104, 84], 403),
  bloemblad_geel: bloemblad([226, 140, 8], [255, 208, 36], [255, 240, 130], 404),
  bloemblad_blauw: bloemblad([240, 240, 255], [64, 112, 236], [128, 168, 255], 405),
  bloemhart: (x, y, u, v) => {
    cell(u, v, 7, 406);
    const c = F1 < 0.24 ? mix([150, 84, 8], [214, 140, 16], F1 / 0.24) : [246, 190, 36];
    return mul(c, 0.9 + hash2(x, y, 407) * 0.2);
  },
  bes: (x, y, u, v) => {
    const fu = (u * 5) % 1, d = Math.hypot(fu - 0.32, v - 0.34);       // vijf keer rond: elke kant van de bes een eigen glimlichtje
    const c = mix([255, 170, 170], [208, 26, 46], sst(0.04, 0.26, d));
    return mul(c, 1.05 - 0.4 * v);
  },
  tak: (x, y, u, v) => {
    const g = vn(u * 9, v * 3, 9, 3, 408) * 0.6 + vn(u * 22, v * 6, 22, 6, 409) * 0.4;
    return mul(mix([72, 60, 48], [152, 136, 114], g), 0.92 + hash2(x, y, 410) * 0.14);
  },
  stok_hout: (x, y, u, v) => {
    const g = vn(u * 10, v * 2, 10, 2, 411) * 0.6 + vn(u * 26, v * 4, 26, 4, 412) * 0.4;
    return mul(mix([110, 74, 38], [178, 130, 72], g), 0.94 + hash2(x, y, 413) * 0.1);
  },
  vlam: (x, y, u, v) => {
    const k = c01((1 - v) * 1.12 + (fbm(u, v, 6, 6, 3, 414) - 0.5) * 0.42);
    if (k < 0.28) return mix([255, 252, 216], [255, 216, 72], k / 0.28);
    if (k < 0.68) return mix([255, 216, 72], [250, 122, 18], (k - 0.28) / 0.4);
    return mix([250, 122, 18], [204, 44, 8], (k - 0.68) / 0.32);
  },
  lichtblad: (x, y, u, v) => {
    const t = 1 - v, d = Math.abs(u - 0.5), w = bloembladBreedte(t);
    const c = mix([255, 255, 255], [40, 208, 255], c01((w > 0 ? d / w : 1) * 0.75 + t * 0.35));
    return [c[0], c[1], c[2], d < w && t > 0.02 ? 255 : 0];
  },
});

// welke plaatjes niet naadloos herhalen (losse sprites)
const NO_WRAP = new Set(Object.keys(DRAW));

function renderTile(name) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = TS;
  const g = cv.getContext('2d');
  let img;
  if (DRAW[name]) {
    DRAW[name](g);
    img = g.getImageData(0, 0, TS, TS);
    bleed(img.data);
  } else {
    const fn = PX[name] || ((x, y) => (((x >> 3) + (y >> 3)) & 1 ? [255, 0, 255] : [0, 0, 0]));
    img = g.createImageData(TS, TS);
    const d = img.data;
    let alpha = false;
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const c = fn(x, y, x / TS, y / TS);
      const i = (y * TS + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c.length > 3 ? c[3] : 255;
      if (c.length > 3 && c[3] < 255) alpha = true;
    }
    g.putImageData(img, 0, 0);
  }
  return { cv, data: img.data };
}

// kleur uitsmeren naar doorzichtige pixels, zodat er geen donkere randjes komen
function bleed(d, S = TS) {
  const TS = S;
  const filled = new Uint8Array(TS * TS);
  for (let i = 0; i < TS * TS; i++) filled[i] = d[i * 4 + 3] > 8 ? 1 : 0;
  for (let pass = 0; pass < (S > 64 ? 12 : 6); pass++) {
    const add = [];
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const i = y * TS + x;
      if (filled[i]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= TS || ny >= TS) continue;
        const j = ny * TS + nx;
        if (filled[j]) { r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; n++; }
      }
      if (n) add.push(i, r / n, g / n, b / n);
    }
    for (let k = 0; k < add.length; k += 4) {
      const i = add[k];
      d[i * 4] = add[k + 1]; d[i * 4 + 1] = add[k + 2]; d[i * 4 + 2] = add[k + 3]; filled[i] = 1;
    }
  }
}

// ---------- de atlas ----------

export function buildAtlas() {
  const n = TILE_NAMES.length;
  const rows = Math.ceil(n / ATLAS_COLS);
  const W = ATLAS_COLS * CELL, H = rows * CELL;
  const data = new Uint8Array(W * H * 4);
  const canvases = [];
  const uv = new Float32Array(n * 4);   // u0, v0, u1, v1 (v0 = bovenkant van het plaatje)
  for (let t = 0; t < n; t++) {
    const name = TILE_NAMES[t];
    const { cv, data: td } = renderTile(name);
    canvases.push(cv);
    if (!DRAW[name]) {
      // bladeren: ook kleur uitsmeren
      let hasA = false;
      for (let i = 3; i < td.length; i += 4) if (td[i] === 0) { hasA = true; break; }
      if (hasA) bleed(td);
    }
    const wrap = !NO_WRAP.has(name);
    const ox = (t % ATLAS_COLS) * CELL, oy = Math.floor(t / ATLAS_COLS) * CELL;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      let sx = x - PAD, sy = y - PAD;
      let a = 1;
      if (wrap) { sx = ((sx % TS) + TS) % TS; sy = ((sy % TS) + TS) % TS; }
      else {
        if (sx < 0 || sy < 0 || sx >= TS || sy >= TS) a = 0;
        sx = Math.min(TS - 1, Math.max(0, sx)); sy = Math.min(TS - 1, Math.max(0, sy));
      }
      const si = (sy * TS + sx) * 4, di = ((oy + y) * W + ox + x) * 4;
      data[di] = td[si]; data[di + 1] = td[si + 1]; data[di + 2] = td[si + 2]; data[di + 3] = a ? td[si + 3] : 0;
    }
    uv[t * 4] = (ox + PAD) / W; uv[t * 4 + 1] = (oy + PAD) / H;
    uv[t * 4 + 2] = (ox + PAD + TS) / W; uv[t * 4 + 3] = (oy + PAD + TS) / H;
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return { tex, uv, canvases, W, H, data };
}

// ---------- de mooie atlas (instelling "Mooie graphics") ----------
//
// Dezelfde plaatjes, maar dubbel zo groot (128 pixels) en met meer detail. Er hoort een tweede
// atlas bij met per pixel: de richting van het oppervlak (voor reliëf in het licht), hoe het
// glanst, en of het zelf licht geeft. De tekenaar in render.js gebruikt die voor zonlicht dat
// over de hobbels strijkt, glinsteringen en gloed.

export const HQ_TS = 128;
const HQ_PAD = 16, HQ_CELL = HQ_TS + HQ_PAD * 2, HQ_COLS = 16;

const lum = (r, g, b) => (r * 0.299 + g * 0.587 + b * 0.114) / 255;
const sat = (r, g, b) => { const mx = Math.max(r, g, b); return mx ? (mx - Math.min(r, g, b)) / mx : 0; };

// Per plaatje: [reliëf, glans, gloed]. gloed is een getal of een functie (r, g, b, a, he) -> 0..1,
// waarbij he zegt of de teken-functie deze pixel als "lichtgevend" heeft gemerkt.
function hqMat(name) {
  let bump = 1, spec = 0.03, emis = 0;
  const is = (re) => re.test(name);
  if (name === 'water') return [0, 1, 1];                          // gloed 1 = "dit is water" (zie render.js)
  if (is(/^(ijs|glas)$/)) { spec = 0.85; bump = 0.5; }
  else if (name === 'obsidiaan') spec = 0.7;
  else if (name === 'sneeuw') { spec = 0.25; bump = 0.6; }
  else if (name === 'zand') spec = 0.1;
  else if (name === 'wolk') bump = 0.4;
  else if (is(/^(blad_|levensblad_)/)) spec = 0.12;
  else if (is(/^(marmerblok|granietblok|marmerzuil)/)) spec = 0.45;
  else if (is(/^(marmer|graniet)$/)) spec = 0.15;
  if (name === 'bes') spec = 0.7;
  else if (is(/^(gras_spriet|plant_blad|bloemblad_)/)) { spec = 0.1; bump = 0.5; }
  if (name === 'vlam') { emis = 1; bump = 0; }
  else if (name === 'lichtblad') { emis = 1; bump = 0.3; }
  else if (name === 'lava') emis = (r, g, b) => Math.pow(lum(r, g, b), 1.3);
  else if (name === 'magmasteen') emis = (r, g, b) => (r - b > 90 ? sst(120, 235, r) : 0);
  else if (name === 'gloeikristal') emis = (r, g, b, a, he) => he;
  else if (is(/(ijskristal|vuurkristal|schaduwkristal|hemelkristal|^kristal)_erts$/)) emis = (r, g, b, a, he) => he * 0.8;
  else if (is(/(robijn|saffier|smaragd|amethist)_erts$/)) emis = (r, g, b, a, he) => he * 0.5;
  else if (is(/blok$/) && is(/kristal|robijn|saffier|smaragd|amethist/)) emis = 0.4;
  else if (is(/^portaal_/)) { emis = 0.9; bump = 0; }
  else if (name === 'portaalsteen') emis = (r, g, b) => (b > 220 && r < 160 ? 1 : 0);
  else if (name === 'levenshart') emis = (r, g, b) => sst(0.45, 0.9, lum(r, g, b));
  else if (is(/^levenshout/)) emis = (r, g, b) => (g > 200 && g - r > 20 ? 0.9 : 0);
  else if (is(/^levensblad_/)) emis = (r, g, b, a, he) => (he ? 1 : 0.5);
  else if (is(/^(lamp|lantaarn)$/)) emis = (r, g, b) => sst(0.6, 0.85, lum(r, g, b));
  else if (is(/^(fakkel|kampvuur)$/)) emis = (r, g, b) => (r > 215 && g > 70 ? 1 : 0);
  else if (name === 'gloeipaddenstoel') emis = (r, g, b) => (g > 150 && b > 140 ? 1 : 0.1);
  else if (name === 'oven_side') emis = (r, g, b) => (r > 205 && g > 50 && b < 110 ? 1 : 0);
  else if (name === 'scheepscomputer') emis = (r, g, b) => (g > 170 && r < 160 ? 1 : 0);
  else if (name === 'stam_verkoold') emis = (r, g, b) => (r > 220 && g > 90 && b < 90 ? 1 : 0);
  else if (name === 'schaduwgras_top') emis = (r, g, b) => (r > 200 && b > 240 ? 1 : 0);
  else if (name === 'blad_schaduw') emis = (r, g, b, a, he) => he;
  else if (is(/^lichtrank_/)) { emis = 1; bump = 0.3; }
  else if (is(/^lichtvrucht_/)) emis = (r, g, b) => 0.55 + 0.45 * lum(r, g, b);
  else if (is(/^gloeizwam_/)) emis = (r, g, b) => (sat(r, g, b) > 0.3 || lum(r, g, b) > 0.92 ? 1 : 0.25);
  else if (is(/^zwamhoed_/)) emis = (r, g, b) => 0.65 + 0.35 * lum(r, g, b);
  else if (is(/^zwamlamellen_/)) emis = 0.85;
  else if (is(/^zwamsteel/)) emis = (r, g, b) => (g - r > 22 ? 0.85 : 0.12);
  else if (is(/^gloeimos_/)) emis = (r, g, b) => (g > 190 && b > 170 ? 1 : (g > b + 20 && g > r + 20 ? 0.12 : 0));
  else if (name === 'lichtbloem') emis = (r, g, b) => (b > 200 ? 1 : 0.2);
  else if (name === 'dynamiet_aan') emis = 0.8;
  return [bump, spec, emis];
}

// Eén plaatje op 128 pixels: kleur plus hoogte, glans en gloed per pixel.
function renderTileHQ(name) {
  const S = HQ_TS, N = S * S;
  const [bump, spec0, emis] = hqMat(name);
  const hgt = new Float32Array(N), spec = new Uint8Array(N), glow = new Uint8Array(N);
  let col;
  const efn = typeof emis === 'function' ? emis : null;
  if (DRAW[name]) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.scale(S / TS, S / TS);
    DRAW[name](g);
    col = g.getImageData(0, 0, S, S).data;
    for (let i = 0; i < N; i++) {
      const r = col[i * 4], gg = col[i * 4 + 1], b = col[i * 4 + 2], a = col[i * 4 + 3];
      hgt[i] = a > 8 ? 0.3 + 0.7 * lum(r, gg, b) : 0;
      spec[i] = spec0 * 255;
      glow[i] = a > 8 ? (efn ? efn(r, gg, b, a, 0) : emis) * 255 : 0;
    }
    bleed(col, S);
  } else {
    col = new Uint8ClampedArray(N * 4);
    const fn = PX[name] || ((x, y) => (((x >> 4) + (y >> 4)) & 1 ? [255, 0, 255] : [0, 0, 0]));
    let hasA = false;
    HQ = true;
    try {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        HH = -1; HS = -1; HE = -1;
        const c = fn(x, y, x / S, y / S);
        const i = y * S + x, a = c.length > 3 ? c[3] : 255;
        col[i * 4] = c[0]; col[i * 4 + 1] = c[1]; col[i * 4 + 2] = c[2]; col[i * 4 + 3] = a;
        if (a === 0) hasA = true;
        const r = col[i * 4], gg = col[i * 4 + 1], b = col[i * 4 + 2];
        hgt[i] = a < 90 ? 0 : (HH >= 0 ? HH : 0.25 + 0.6 * lum(r, gg, b));
        spec[i] = (HS >= 0 ? HS : spec0) * 255;
        glow[i] = a < 90 ? 0 : c01(efn ? efn(r, gg, b, a, HE > 0 ? 1 : 0) : emis) * 255;
      }
    } finally { HQ = false; }
    if (hasA) bleed(col, S);
  }
  // reliëf: de helling van de hoogte (een klein beetje verzacht) wordt de richting van het oppervlak
  const wrap = !NO_WRAP.has(name);
  const at = (x, y) => {
    if (wrap) { x = (x + S) % S; y = (y + S) % S; } else { x = x < 0 ? 0 : x >= S ? S - 1 : x; y = y < 0 ? 0 : y >= S ? S - 1 : y; }
    return hgt[y * S + x];
  };
  const nrm = new Uint8Array(N * 2);
  const K = 2.6 * bump;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x - 1, y) - at(x + 1, y)) * 2 + (at(x - 1, y - 1) - at(x + 1, y - 1)) + (at(x - 1, y + 1) - at(x + 1, y + 1));
    const dy = (at(x, y - 1) - at(x, y + 1)) * 2 + (at(x - 1, y - 1) - at(x - 1, y + 1)) + (at(x + 1, y - 1) - at(x + 1, y + 1));
    let nx = dx * 0.25 * K, ny = dy * 0.25 * K;
    const l = Math.hypot(nx, ny, 1);
    nx /= l; ny /= l;
    nrm[(y * S + x) * 2] = Math.round(nx * 127 + 128); nrm[(y * S + x) * 2 + 1] = Math.round(ny * 127 + 128);
  }
  return { col, nrm, spec, glow, wrap };
}

// Bouwt de mooie atlas. Dat kost even tijd, dus het gaat in stukjes zodat het spel niet stilvalt;
// onProgress krijgt een getal van 0 tot 1.
export async function buildAtlasHQ(onProgress) {
  const n = TILE_NAMES.length, S = HQ_TS, PAD = HQ_PAD, CELL = HQ_CELL;
  const rows = Math.ceil(n / HQ_COLS);
  const W = HQ_COLS * CELL, H = rows * CELL;
  const data = new Uint8Array(W * H * 4), ndata = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { ndata[i * 4] = 128; ndata[i * 4 + 1] = 128; }
  const uv = new Float32Array(n * 4);
  let last = performance.now();
  for (let t = 0; t < n; t++) {
    const T = renderTileHQ(TILE_NAMES[t]);
    const ox = (t % HQ_COLS) * CELL, oy = Math.floor(t / HQ_COLS) * CELL;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      let sx = x - PAD, sy = y - PAD, a = 1;
      if (T.wrap) { sx = ((sx % S) + S) % S; sy = ((sy % S) + S) % S; }
      else {
        if (sx < 0 || sy < 0 || sx >= S || sy >= S) a = 0;
        sx = Math.min(S - 1, Math.max(0, sx)); sy = Math.min(S - 1, Math.max(0, sy));
      }
      const si = sy * S + sx, di = ((oy + y) * W + ox + x) * 4;
      data[di] = T.col[si * 4]; data[di + 1] = T.col[si * 4 + 1]; data[di + 2] = T.col[si * 4 + 2]; data[di + 3] = a ? T.col[si * 4 + 3] : 0;
      ndata[di] = T.nrm[si * 2]; ndata[di + 1] = T.nrm[si * 2 + 1]; ndata[di + 2] = T.spec[si]; ndata[di + 3] = a ? T.glow[si] : 0;
    }
    uv[t * 4] = (ox + PAD) / W; uv[t * 4 + 1] = (oy + PAD) / H;
    uv[t * 4 + 2] = (ox + PAD + S) / W; uv[t * 4 + 3] = (oy + PAD + S) / H;
    if (performance.now() - last > 24) {
      if (onProgress) onProgress((t + 1) / n);
      await new Promise((r) => setTimeout(r, 0));
      last = performance.now();
    }
  }
  const mk = (d, srgb) => {
    const tex = new THREE.DataTexture(d, W, H, THREE.RGBAFormat);
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  };
  if (onProgress) onProgress(1);
  return { tex: mk(data, true), nrm: mk(ndata, false), uv, W, H, data, ndata };
}

// ---------- icoontjes voor de rugzak ----------

const iconCache = new Map();
let atlasRef = null;
export function setIconAtlas(a) { atlasRef = a; }

function shadeHex(h, f) {
  const c = hex(parseInt(h.slice(1), 16));
  const q = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return 'rgb(' + q(c[0]) + ',' + q(c[1]) + ',' + q(c[2]) + ')';
}

const ICONS = {
  boots: (g, c) => {
    g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineJoin = 'round';
    const een = (ox) => {
      g.fillStyle = '#8a5a30';
      g.beginPath(); g.moveTo(ox + 4, 12); g.lineTo(ox + 16, 12); g.lineTo(ox + 16, 36); g.lineTo(ox + 26, 42); g.lineTo(ox + 26, 50); g.lineTo(ox + 2, 50); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = c; g.fillRect(ox + 3, 11, 14, 6); g.strokeRect(ox + 3, 11, 14, 6);
      g.fillStyle = '#3a2614'; g.fillRect(ox + 1, 50, 26, 5); g.strokeRect(ox + 1, 50, 26, 5);
      // veer onder de zool
      g.strokeStyle = c; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox + 5, 56); g.lineTo(ox + 10, 60); g.lineTo(ox + 15, 56); g.lineTo(ox + 20, 60); g.lineTo(ox + 24, 56); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 2;
    };
    een(3); een(34);
  },
  scope: (g, c) => {
    g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.65)';
    g.save(); g.translate(32, 32); g.rotate(-0.6);
    g.fillStyle = shadeHex(c, 0.75); g.fillRect(-24, -7, 20, 14); g.strokeRect(-24, -7, 20, 14);
    g.fillStyle = c; g.fillRect(-6, -9, 18, 18); g.strokeRect(-6, -9, 18, 18);
    g.fillStyle = shadeHex(c, 1.2); g.fillRect(10, -11, 14, 22); g.strokeRect(10, -11, 14, 22);
    g.fillStyle = '#9fe8ff'; g.fillRect(22, -9, 4, 18); g.strokeRect(22, -9, 4, 18);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-22, -5, 44, 3);
    g.restore();
  },
  stick: (g) => { g.strokeStyle = '#4a3018'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(16, 50); g.lineTo(48, 14); g.stroke(); g.strokeStyle = '#9a6e3a'; g.lineWidth = 5; g.stroke(); },
  lump: (g, c) => { g.fillStyle = c; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(14, 40); g.lineTo(22, 20); g.lineTo(40, 14); g.lineTo(52, 30); g.lineTo(46, 50); g.lineTo(24, 52); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.moveTo(24, 24); g.lineTo(38, 18); g.lineTo(34, 30); g.closePath(); g.fill(); },
  ingot: (g, c) => {
    g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.fillStyle = shadeHex(c, 0.7); g.beginPath(); g.moveTo(8, 38); g.lineTo(44, 46); g.lineTo(44, 54); g.lineTo(8, 46); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = shadeHex(c, 0.5); g.beginPath(); g.moveTo(44, 46); g.lineTo(58, 32); g.lineTo(58, 40); g.lineTo(44, 54); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = c; g.beginPath(); g.moveTo(8, 38); g.lineTo(24, 22); g.lineTo(58, 32); g.lineTo(44, 46); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(22, 28); g.lineTo(44, 34); g.lineTo(40, 38); g.lineTo(18, 32); g.closePath(); g.fill();
  },
  gem: (g, c) => {
    g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.fillStyle = c; g.beginPath(); g.moveTo(32, 6); g.lineTo(52, 24); g.lineTo(32, 58); g.lineTo(12, 24); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.moveTo(32, 6); g.lineTo(42, 24); g.lineTo(32, 30); g.lineTo(22, 24); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.moveTo(32, 30); g.lineTo(52, 24); g.lineTo(32, 58); g.closePath(); g.fill();
  },
  gear: (g, c) => {
    g.fillStyle = c; g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 24 : 17; g.lineTo(32 + Math.cos(a - 0.12) * r, 32 + Math.sin(a - 0.12) * r); g.lineTo(32 + Math.cos(a + 0.12) * r, 32 + Math.sin(a + 0.12) * r); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#2a3038'; g.beginPath(); g.arc(32, 32, 7, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.arc(27, 26, 5, 0, 6.3); g.fill();
  },
  scale: (g, c) => {
    g.fillStyle = c; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(32, 8); g.bezierCurveTo(56, 16, 52, 46, 32, 58); g.bezierCurveTo(12, 46, 8, 16, 32, 8); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(32, 12); g.lineTo(32, 54); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(25, 24, 5, 9, 0.3, 0, 6.3); g.fill();
  },
  arrow: (g) => {
    g.strokeStyle = '#8a643a'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(14, 50); g.lineTo(46, 18); g.stroke();
    g.fillStyle = '#c8ccd4'; g.strokeStyle = '#333'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(54, 10); g.lineTo(40, 16); g.lineTo(48, 24); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e8e8f0'; g.beginPath(); g.moveTo(10, 54); g.lineTo(10, 44); g.lineTo(20, 54); g.closePath(); g.fill(); g.stroke();
  },
  berries: (g) => {
    g.strokeStyle = '#3c7a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 8); g.lineTo(24, 28); g.moveTo(32, 8); g.lineTo(42, 26); g.stroke();
    for (const [x, y, r] of [[22, 36, 12], [42, 34, 11], [32, 48, 11]]) {
      g.fillStyle = '#c0203a'; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x - 4, y - 4, 3, 0, 6.3); g.fill();
    }
  },
  apple: (g) => {
    g.fillStyle = '#d8281e'; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(32, 20); g.bezierCurveTo(54, 8, 62, 44, 34, 58); g.bezierCurveTo(4, 46, 8, 8, 32, 20); g.fill(); g.stroke();
    g.strokeStyle = '#5a3a1c'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 20); g.lineTo(35, 8); g.stroke();
    g.fillStyle = '#4c9a34'; g.beginPath(); g.ellipse(43, 12, 8, 4, -0.5, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(22, 30, 4, 8, 0.4, 0, 6.3); g.fill();
  },
  meat: (g, c) => {
    g.strokeStyle = '#f0ead8'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(44, 46); g.lineTo(56, 56); g.stroke();
    g.fillStyle = c; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(28, 30, 22, 16, 0.6, 0, 6.3); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(22, 24, 9, 5, 0.6, 0, 6.3); g.fill();
  },
  potion: (g, c) => {
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2;
    g.fillStyle = '#d8e8f0'; g.fillRect(26, 6, 12, 14); g.strokeRect(26, 6, 12, 14);
    g.fillStyle = '#8a643a'; g.fillRect(25, 3, 14, 6);
    g.fillStyle = c; g.beginPath(); g.arc(32, 40, 19, 0, 6.3); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(25, 33, 6, 0, 6.3); g.fill();
  },
  pick: (g, c) => {
    g.strokeStyle = '#4a3018'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(14, 52); g.lineTo(42, 22); g.stroke();
    g.strokeStyle = '#9a6e3a'; g.lineWidth = 4; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 11; g.beginPath(); g.moveTo(22, 12); g.quadraticCurveTo(48, 8, 54, 42); g.stroke();
    g.strokeStyle = c; g.lineWidth = 7; g.stroke();
  },
  axe: (g, c) => {
    g.strokeStyle = '#4a3018'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(14, 54); g.lineTo(44, 16); g.stroke();
    g.strokeStyle = '#9a6e3a'; g.lineWidth = 4; g.stroke();
    g.fillStyle = c; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(34, 12); g.lineTo(52, 6); g.quadraticCurveTo(62, 22, 54, 36); g.lineTo(40, 24); g.closePath(); g.fill(); g.stroke();
  },
  sword: (g, c, c2) => {
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 10; g.beginPath(); g.moveTo(24, 40); g.lineTo(54, 8); g.stroke();
    g.strokeStyle = c; g.lineWidth = 6; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(26, 36); g.lineTo(50, 10); g.stroke();
    g.strokeStyle = c2 || '#6a5a3a'; g.lineWidth = 6; g.beginPath(); g.moveTo(14, 32); g.lineTo(32, 50); g.stroke();
    g.strokeStyle = '#4a3018'; g.lineWidth = 6; g.beginPath(); g.moveTo(20, 44); g.lineTo(10, 54); g.stroke();
  },
  bow: (g) => {
    g.strokeStyle = '#4a3018'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(14, 10); g.quadraticCurveTo(60, 14, 54, 54); g.stroke();
    g.strokeStyle = '#a87a40'; g.lineWidth = 3.5; g.stroke();
    g.strokeStyle = '#e8e8e8'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(14, 10); g.lineTo(54, 54); g.stroke();
  },
  staff: (g, c) => {
    g.strokeStyle = '#3a2412'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(12, 56); g.lineTo(42, 22); g.stroke();
    g.strokeStyle = '#7a5630'; g.lineWidth = 4; g.stroke();
    const gr = g.createRadialGradient(46, 16, 1, 46, 16, 14); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(46, 16, 14, 0, 6.3); g.fill();
    g.fillStyle = c; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.arc(46, 16, 7, 0, 6.3); g.fill(); g.stroke();
  },
  laser: (g) => {
    g.fillStyle = '#56606c'; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(8, 26); g.lineTo(50, 18); g.lineTo(54, 28); g.lineTo(30, 34); g.lineTo(26, 52); g.lineTo(14, 52); g.lineTo(16, 36); g.lineTo(8, 36); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#4ae0ff'; g.fillRect(22, 24, 20, 4);
    g.fillStyle = '#ff5a3a'; g.beginPath(); g.arc(55, 22, 4, 0, 6.3); g.fill();
  },
  oer: (g) => {
    const gr = g.createRadialGradient(32, 28, 2, 32, 28, 30); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(160,120,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    ICONS.sword(g, '#f4f0ff', '#ffd23a');
    g.fillStyle = '#b46bff'; g.beginPath(); g.arc(23, 41, 4, 0, 6.3); g.fill();
  },
  armor: (g, c) => {
    g.fillStyle = c; g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(12, 14); g.lineTo(24, 8); g.quadraticCurveTo(32, 16, 40, 8); g.lineTo(52, 14); g.lineTo(56, 28); g.lineTo(46, 30); g.lineTo(46, 56); g.lineTo(18, 56); g.lineTo(18, 30); g.lineTo(8, 28); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(22, 22, 6, 26);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.moveTo(32, 16); g.lineTo(32, 56); g.stroke();
  },
  core: (g, c) => {
    g.strokeStyle = '#3a3648'; g.lineWidth = 9; g.beginPath(); g.arc(32, 32, 21, 0, 6.3); g.stroke();
    g.strokeStyle = '#8a86a0'; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 21, 0, 6.3); g.stroke();
    const gr = g.createRadialGradient(32, 32, 1, 32, 32, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, c); gr.addColorStop(1, shadeHex(c, 0.4));
    g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 15, 0, 6.3); g.fill();
  },
  heart: (g, c) => {
    const gr = g.createRadialGradient(32, 30, 2, 32, 30, 30); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.fillStyle = c; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(32, 54); g.bezierCurveTo(2, 34, 12, 8, 32, 22); g.bezierCurveTo(52, 8, 62, 34, 32, 54); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(22, 24, 5, 7, -0.5, 0, 6.3); g.fill();
  },
  crown: (g) => {
    g.fillStyle = '#f5c93a'; g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(8, 50); g.lineTo(6, 18); g.lineTo(20, 32); g.lineTo(32, 10); g.lineTo(44, 32); g.lineTo(58, 18); g.lineTo(56, 50); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e0362c'; g.beginPath(); g.arc(32, 40, 5, 0, 6.3); g.fill();
    g.fillStyle = '#4ae0ff'; g.beginPath(); g.arc(17, 42, 3.5, 0, 6.3); g.fill(); g.beginPath(); g.arc(47, 42, 3.5, 0, 6.3); g.fill();
  },
};

export function iconCanvas(id) {
  if (iconCache.has(id)) return iconCache.get(id);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  if (id < 256) {
    const b = BLOCKS[id];
    const tc = atlasRef.canvases;
    if (b.shape === SHAPE_CUBE) {
      g.setTransform(28 / 64, 14 / 64, -28 / 64, 14 / 64, 32, 4);
      g.drawImage(tc[b.tTop], 0, 0);
      g.setTransform(28 / 64, 14 / 64, 0, 28 / 64, 4, 18);
      g.drawImage(tc[b.tSide], 0, 0); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 0, 64, 64);
      g.setTransform(28 / 64, -14 / 64, 0, 28 / 64, 32, 32);
      g.drawImage(tc[b.tSide], 0, 0); g.fillStyle = 'rgba(0,0,0,0.44)'; g.fillRect(0, 0, 64, 64);
      g.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      g.drawImage(tc[b.tSide], 4, 4, 56, 56);
    }
  } else {
    const it = ITEMS[id];
    const spec = it ? it.icon : ['lump', '#f0f'];
    (ICONS[spec[0]] || ICONS.lump)(g, spec[1], spec[2]);
  }
  iconCache.set(id, cv);
  return cv;
}
const urlCache = new Map();
export function iconURL(id) {
  if (!urlCache.has(id)) urlCache.set(id, iconCanvas(id).toDataURL());
  return urlCache.get(id);
}

// ---------- huid voor wezens ----------

const skinCache = new Map();
// kind: 'vacht' | 'schub' | 'rots' | 'metaal' | 'glad'
export function skin(colorHex, kind) {
  const key = colorHex + kind;
  if (skinCache.has(key)) return skinCache.get(key);
  const S = 32;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const img = g.createImageData(S, S), d = img.data;
  const base = hex(colorHex);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    let f = 1;
    if (kind === 'vacht') f = 0.78 + vn(u * 16, v * 4, 16, 4, 300) * 0.3 + hash2(x, y, 301) * 0.12;
    else if (kind === 'schub') { cell(u, v, 6, 302); f = 0.62 + sst(0, 0.25, F2 - F1) * 0.5 + (CDY < 0 ? 0.08 : 0); }
    else if (kind === 'rots') { cell(u, v, 4, 303); f = (F2 - F1 < 0.07 ? 0.55 : 0.8 + CID * 0.35) * (0.9 + hash2(x, y, 304) * 0.2); }
    else if (kind === 'metaal') { f = 0.84 + vn(u * 2, v * 16, 2, 16, 305) * 0.24; if (x % 16 === 0 || y % 16 === 0) f *= 0.6; }
    else f = 0.9 + fbm(u, v, 4, 4, 2, 306) * 0.2;
    const i = (y * S + x) * 4;
    d[i] = Math.min(255, base[0] * f); d[i + 1] = Math.min(255, base[1] * f); d[i + 2] = Math.min(255, base[2] * f); d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  skinCache.set(key, tex);
  return tex;
}

// gezichtje: ogen (en eventueel mond) op een huid
export function faceTex(colorHex, kind, eye = '#101010', glow = false, mouth = true) {
  const key = 'face' + colorHex + kind + eye + glow + mouth;
  if (skinCache.has(key)) return skinCache.get(key);
  const S = 32;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.drawImage(skin(colorHex, kind).image, 0, 0);
  for (const ex of [9, 23]) {
    if (!glow) { g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, 13, 5, 0, 6.3); g.fill(); }
    else { g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(ex, 13, 6, 0, 6.3); g.fill(); }
    g.fillStyle = eye; g.beginPath(); g.arc(ex, 13.5, glow ? 4 : 3, 0, 6.3); g.fill();
    if (!glow) { g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - 1, 12, 1, 0, 6.3); g.fill(); }
  }
  if (mouth) { g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.arc(16, 20, 5, 0.2, Math.PI - 0.2); g.stroke(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  skinCache.set(key, tex);
  return tex;
}

export function wingTex(colorHex) {
  const key = 'wing' + colorHex;
  if (skinCache.has(key)) return skinCache.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const c = hex(colorHex);
  const col = (f, a = 1) => 'rgba(' + Math.round(c[0] * f) + ',' + Math.round(c[1] * f) + ',' + Math.round(c[2] * f) + ',' + a + ')';
  g.fillStyle = col(1);
  g.beginPath(); g.moveTo(0, 6); g.lineTo(64, 0); g.lineTo(60, 26); g.quadraticCurveTo(50, 34, 44, 46); g.quadraticCurveTo(34, 44, 26, 56); g.quadraticCurveTo(16, 50, 8, 60); g.lineTo(0, 30); g.closePath(); g.fill();
  g.strokeStyle = col(0.5); g.lineWidth = 3;
  for (const [x, y] of [[60, 26], [44, 46], [26, 56], [8, 60]]) { g.beginPath(); g.moveTo(2, 8); g.lineTo(x, y); g.stroke(); }
  g.strokeStyle = col(0.4); g.lineWidth = 5; g.beginPath(); g.moveTo(0, 6); g.lineTo(64, 2); g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  skinCache.set(key, tex);
  return tex;
}

// ---------- lucht ----------

export function glowTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
export function sunTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.22, 'rgba(255,244,190,1)'); gr.addColorStop(0.3, 'rgba(255,220,120,0.55)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function moonTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 30, 64, 64, 64);
  gr.addColorStop(0, 'rgba(210,225,255,0.5)'); gr.addColorStop(1, 'rgba(210,225,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#e6ebf5'; g.beginPath(); g.arc(64, 64, 34, 0, 6.3); g.fill();
  g.fillStyle = 'rgba(150,160,185,0.7)';
  for (const [x, y, r] of [[52, 54, 8], [76, 70, 6], [62, 80, 5], [78, 48, 4], [48, 72, 3]]) { g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function cloudTex() {
  const S = 256;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = fbm(x / S, y / S, 4, 4, 5, 400);
    const a = sst(0.5, 0.72, n);
    const i = (y * S + x) * 4;
    d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = a * 235;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function nameTex(text) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(250, g.measureText(text).width + 24);
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.beginPath(); g.roundRect ? g.roundRect(128 - w / 2, 8, w, 48, 12) : g.rect(128 - w / 2, 8, w, 48); g.fill();
  g.fillStyle = '#fff'; g.fillText(text, 128, 33, 240);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
