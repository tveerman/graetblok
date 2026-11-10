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
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

// ---------- blokken: per pixel een kleur ----------

const dirt = (x, y, u, v) => {
  let c = mix([92, 62, 40], [136, 98, 64], fbm(u, v, 4, 4, 4, 21));
  cell(u, v, 9, 22);
  if (F1 < 0.2) c = mul(c, CID > 0.5 ? 1.25 : 0.72);
  return mul(c, 0.94 + hash2(x, y, 23) * 0.12);
};
const grassTop = (c1, c2, tuft, seed) => (x, y, u, v) => {
  const n = fbm(u, v, 4, 4, 4, seed), blades = vn(u * 32, v * 32, 32, 32, seed + 1), t = fbm(u, v, 8, 8, 2, seed + 2);
  let c = mul(mix(c1, c2, n), 0.8 + blades * 0.4);
  if (t > 0.66) c = mix(c, tuft, (t - 0.66) * 2.2);
  return c;
};
const grassSide = (grass, under, seed) => (x, y, u, v) => {
  const edge = 0.16 + 0.16 * vn(u * 16, 0, 16, 1, seed) + 0.05 * vn(u * 32, 0, 32, 1, seed + 1);
  if (v < edge) return mul(grass(x, y, u, v), 0.72 + 0.28 * (1 - v / edge));
  const c = under(x, y, u, v);
  return mul(c, v < edge + 0.07 ? 0.72 : 1);
};
const stone = (c1, c2, seed, crack = 0.7) => (x, y, u, v) => {
  const n = fbm(u, v, 3, 3, 5, seed);
  let c = mix(c1, c2, n);
  cell(u, v, 4, seed + 1);
  if (F2 - F1 < 0.05) c = mul(c, crack);
  return mul(c, 0.95 + hash2(x, y, seed + 2) * 0.1);
};
const steen = stone([98, 98, 100], [152, 150, 146], 30);
const basalt = stone([40, 38, 44], [78, 74, 80], 31, 0.55);
const schaduwsteen = stone([40, 32, 56], [74, 62, 94], 32, 0.6);
const hemelsteen = stone([186, 180, 204], [228, 224, 238], 33, 0.86);
const cobble = (c1, c2, seed) => (x, y, u, v) => {
  cell(u, v, 5, seed);
  const e = sst(0.02, 0.16, F2 - F1);
  const c = mul(mix(c1, c2, CID), 0.45 + 0.55 * e);
  return mul(c, 0.9 + fbm(u, v, 8, 8, 2, seed + 3) * 0.2);
};
const bark = (dark, light, seed, fx = 10) => (x, y, u, v) => {
  const r = 0.6 * vn(u * fx, v * 3, fx, 3, seed) + 0.4 * vn(u * fx * 2, v * 6, fx * 2, 6, seed + 1);
  let c = mix(dark, light, r);
  if (r < 0.3) c = mul(c, 0.7);
  return mul(c, 0.93 + hash2(x, y, seed + 2) * 0.14);
};
const logTop = (w1, w2, barkc, seed) => (x, y, u, v) => {
  const d = Math.hypot(u - 0.5, v - 0.5) * 2;
  if (d > 0.84 + fbm(u, v, 8, 8, 2, seed) * 0.08) return mul(barkc, 0.8 + hash2(x, y, seed) * 0.3);
  const ring = Math.sin(d * 24 + fbm(u, v, 4, 4, 2, seed + 1) * 4) * 0.5 + 0.5;
  return mix(w1, w2, ring * 0.8);
};
const leaves = (c1, c2, seed, cover = 0.4, glow = null) => (x, y, u, v) => {
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
  if (fv < 0.06 || Math.abs(u - joint) < 0.012) c = mul(c, 0.55);
  return c;
};
const bricks = (c1, c2, mortar, rows, colsN, seed) => (x, y, u, v) => {
  const r = Math.floor(v * rows), fv = v * rows - r;
  const uu = (u + (r % 2) * 0.5 / colsN) % 1;
  const cI = Math.floor(uu * colsN), fu = uu * colsN - cI;
  if (fv < 0.09 || fu < 0.045) return mul(mortar, 0.9 + hash2(x, y, seed) * 0.15);
  const id = hash2(cI, r, seed + 1);
  return mul(mix(c1, c2, id), 0.85 + fbm(u, v, 8, 8, 2, seed + 2) * 0.3);
};
const metal = (base, seed) => (x, y, u, v) => {
  let c = mul(base, 0.86 + fbm(u, v, 2, 16, 3, seed) * 0.26);
  const fu = (u * 2) % 1, fv = (v * 2) % 1;
  if (fu < 0.03 || fv < 0.03) c = mul(c, 0.6);
  const ru = Math.abs(fu - 0.5) > 0.38, rv = Math.abs(fv - 0.5) > 0.38;
  if (ru && rv && Math.hypot((fu < 0.5 ? fu : 1 - fu) - 0.09, (fv < 0.5 ? fv : 1 - fv) - 0.09) < 0.035) c = mul(c, 1.35);
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
  return mul(c, b < 0.05 ? 0.75 : 1);
};
const bevel = (base, seed) => (x, y, u, v) => {
  const b = Math.min(u, v, 1 - u, 1 - v);
  let c = mul(base, 0.92 + fbm(u, v, 4, 4, 3, seed) * 0.16);
  if (b < 0.09) c = mul(c, (u < 0.09 || v < 0.09) && u + v < 1 ? 1.25 : 0.68);
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

function eggDraw(c1, c2, spot, seed) {
  return (g) => {
    const cx = 32, cy = 36;
    g.save();
    g.beginPath();
    g.moveTo(cx, 8);
    g.bezierCurveTo(cx + 22, 8, cx + 24, 50, cx, 60);
    g.bezierCurveTo(cx - 24, 50, cx - 22, 8, cx, 8);
    g.closePath();
    const gr = g.createRadialGradient(cx - 7, cy - 12, 3, cx, cy, 30);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, c2); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.fill();
    g.clip();
    g.fillStyle = spot;
    for (let i = 0; i < 9; i++) {
      const x = 12 + hash2(i, 1, seed) * 40, y = 12 + hash2(i, 2, seed) * 46, r = 2 + hash2(i, 3, seed) * 4;
      g.beginPath(); g.ellipse(x, y, r, r * 0.8, hash2(i, 4, seed) * 3, 0, 6.3); g.fill();
    }
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(cx, 8); g.bezierCurveTo(cx + 22, 8, cx + 24, 50, cx, 60); g.bezierCurveTo(cx - 24, 50, cx - 22, 8, cx, 8); g.stroke();
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
  ei_robot: eggDraw('#56606c', '#c8d2dc', 'rgba(74,224,255,0.9)', 215),
  ei_goud: eggDraw('#b87a14', '#ffe680', 'rgba(255,255,255,0.8)', 216),
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
function bleed(d) {
  const filled = new Uint8Array(TS * TS);
  for (let i = 0; i < TS * TS; i++) filled[i] = d[i * 4 + 3] > 8 ? 1 : 0;
  for (let pass = 0; pass < 6; pass++) {
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
