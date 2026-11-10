// De blokkenwereld aan de kant van het spel: chunks bewaren, er 3D-vormen van maken,
// botsingen en "waar wijs ik naar?".
import * as THREE from '../../vendor/three.module.min.js';
import { CS, CH, idx, chunkKey } from '../shared/constants.js';
import {
  B, B_SHAPE, B_PASS, B_OPAQUE, B_SOLID, B_LIGHT, B_GLOW, B_TOP, B_SIDE, B_BOTTOM, B_HEIGHT, B_BED, NUM_BLOCKS,
  SHAPE_CUBE, SHAPE_CROSS, SHAPE_LIQUID, SHAPE_LOW, SHAPE_EGG, LIFE_LEAVES, LIFE_VINES, LIFE_FRUIT, LEAVES, TILE_DOR, tileId,
} from '../shared/blocks.js';
import { hash2 } from '../shared/noise.js';
import { BLOCK_MODELS } from './blockmodels.js';
import { railShape } from '../shared/rails.js';

const PW = CS + 2, PH = CH + 2;
const SX = PW * PH, SZ = PH;

// tegels per blok (kopie, zodat verdorde levensbomen een ander plaatje krijgen)
const T_TOP = B_TOP.slice(), T_SIDE = B_SIDE.slice(), T_BOTTOM = B_BOTTOM.slice();
const SKYBLOCK = new Uint8Array(NUM_BLOCKS);     // houdt dit blok zonlicht tegen?
for (let i = 0; i < NUM_BLOCKS; i++) SKYBLOCK[i] = B_OPAQUE[i];
for (const id of LEAVES) SKYBLOCK[id] = 1;

// Licht en gloed per blok (kopie): een herstelde levensboom straalt veel feller dan een zieke.
// LIGHT = hoeveel licht het blok op zijn omgeving werpt, GLOW = hoe fel het blok zelf oplicht.
const LIGHT = B_LIGHT.slice(), GLOW = B_GLOW.slice();
// Het vierde getal van "light" per hoekpunt: gloed (0..60) + 64 voor plantjes + 128 voor
// hoekpunten die in de wind bewegen (dat laatste gebruikt alleen de mooie weergave).
const SWAY = new Uint8Array(NUM_BLOCKS);
for (const id of LEAVES) SWAY[id] = 128;
for (const k in LIFE_LEAVES) SWAY[LIFE_LEAVES[k]] = 128;

// In de mooie weergave rekent de tekenaar zelf uit hoe licht elke kant is; dan bakken we de
// vaste schaduw per kant (boven licht, opzij donkerder) niet in het zon- en fakkellicht.
let HQ_MESH = false;
export function setMeshHQ(on) { HQ_MESH = !!on; }

export function setTreeTiles(trees) {
  for (const k in LIFE_LEAVES) {
    const id = LIFE_LEAVES[k], vine = LIFE_VINES[k], fruit = LIFE_FRUIT[k];
    const alive = !!(trees && trees[k]);
    T_TOP[id] = alive ? B_TOP[id] : TILE_DOR; T_SIDE[id] = T_TOP[id]; T_BOTTOM[id] = T_TOP[id];
    GLOW[id] = alive ? 10 : 0;
    GLOW[vine] = alive ? 15 : 8;
    GLOW[fruit] = alive ? 15 : 9; LIGHT[fruit] = alive ? 13 : 7;
  }
}

// De zes kanten van een kubus: richting, hoekpunten (x,y,z,u,v) en schaduw
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0, 1, 1], [1, 1, 0, 1, 0], [1, 1, 1, 0, 0], [1, 0, 1, 0, 1]], shade: 0.8 },
  { n: [-1, 0, 0], c: [[0, 0, 0, 0, 1], [0, 0, 1, 1, 1], [0, 1, 1, 1, 0], [0, 1, 0, 0, 0]], shade: 0.8 },
  { n: [0, 1, 0], c: [[0, 1, 0, 0, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1], [1, 1, 0, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0, 0, 0], [1, 0, 0, 1, 0], [1, 0, 1, 1, 1], [0, 0, 1, 0, 1]], shade: 0.55 },
  { n: [0, 0, 1], c: [[0, 0, 1, 0, 1], [1, 0, 1, 1, 1], [1, 1, 1, 1, 0], [0, 1, 1, 0, 0]], shade: 0.9 },
  { n: [0, 0, -1], c: [[0, 0, 0, 1, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0], [1, 0, 0, 0, 1]], shade: 0.68 },
];
const NSTR = new Int32Array(6), CSTR = new Int32Array(6), YOFF = new Int32Array(6);
const FC = new Float32Array(6 * 4 * 3), FUV = new Float32Array(6 * 4 * 2);
const AO1 = new Int32Array(24), AO2 = new Int32Array(24);
const SHADE = new Float32Array(6);
FACES.forEach((f, fi) => {
  const [nx, ny, nz] = f.n;
  NSTR[fi] = nx * SX + nz * SZ + ny;
  CSTR[fi] = nx * PW + nz;
  YOFF[fi] = ny;
  SHADE[fi] = f.shade;
  f.c.forEach((c, k) => {
    FC[(fi * 4 + k) * 3] = c[0]; FC[(fi * 4 + k) * 3 + 1] = c[1]; FC[(fi * 4 + k) * 3 + 2] = c[2];
    FUV[(fi * 4 + k) * 2] = c[3]; FUV[(fi * 4 + k) * 2 + 1] = c[4];
    // de twee richtingen langs het vlak
    const str = [SX, 1, SZ];
    const tang = [];
    for (let a = 0; a < 3; a++) if (f.n[a] === 0) tang.push((c[a] ? 1 : -1) * str[a]);
    AO1[fi * 4 + k] = tang[0]; AO2[fi * 4 + k] = tang[1];
  });
});
const AO_F = [0.42, 0.62, 0.82, 1.0];

// Het ei: een ronde vorm, opgebouwd uit ringen. Smal en rond van boven, bol van onder.
// Per ring: hoogte, straal en hoe het oppervlak staat (voor het licht en donker).
const EGG_SEG = 10, EGG_RINGS = 9;
const EGG_Y = new Float32Array(EGG_RINGS), EGG_R = new Float32Array(EGG_RINGS), EGG_NR = new Float32Array(EGG_RINGS), EGG_NY = new Float32Array(EGG_RINGS);
for (let j = 0; j < EGG_RINGS; j++) {
  const th = Math.PI * (1 - j / (EGG_RINGS - 1));              // j = 0 is de onderkant
  EGG_Y[j] = 0.42 * (1 + Math.cos(th));
  EGG_R[j] = 0.31 * Math.sin(th) * (1 - 0.17 * Math.cos(th));
  const dr = 0.31 * (Math.cos(th) * (1 - 0.17 * Math.cos(th)) + 0.17 * Math.sin(th) * Math.sin(th)), dy = -0.42 * Math.sin(th);
  const l = Math.hypot(dy, dr) || 1;
  EGG_NR[j] = -dy / l; EGG_NY[j] = dr / l;
}
const EGG_COS = new Float32Array(EGG_SEG + 1), EGG_SIN = new Float32Array(EGG_SEG + 1);
for (let i = 0; i <= EGG_SEG; i++) { EGG_COS[i] = Math.cos((i / EGG_SEG) * Math.PI * 2); EGG_SIN[i] = Math.sin((i / EGG_SEG) * Math.PI * 2); }
const EGG_LX = -0.45, EGG_LY = 0.8, EGG_LZ = -0.4;             // waar het licht vandaan komt
// bed: welke kant van het blok bij welke richting hoort, en het hout van het hoofdeinde
const DIR_FACE = [0, 4, 1, 5];
const T_BED_END = tileId('planken');
const SKY_LUT = new Float32Array(16), BLK_LUT = new Float32Array(16);
for (let i = 0; i < 16; i++) { SKY_LUT[i] = 0.03 + 0.97 * Math.pow(i / 15, 1.7); BLK_LUT[i] = Math.pow(i / 15, 1.3); }

const RAILS = B.rails, RAIL_STR = [SX, SZ, -SX, -SZ], RL = [0, 0, 0, 0];
// werkgeheugen voor de mesher
const pad = new Uint8Array(PW * PW * PH);
const BL = new Uint8Array(PW * PW * PH);
const EFF = new Int16Array(26 * 26);
const EFF2 = new Int16Array(26 * 26);

class Buf {
  constructor(cap) { this.cap = cap; this.pos = new Float32Array(cap * 3); this.uv = new Float32Array(cap * 2); this.light = new Uint8Array(cap * 4); this.idx = new Uint32Array(cap * 1.5); this.nv = 0; this.ni = 0; }
  reset() { this.nv = 0; this.ni = 0; }
  need(n) {
    if (this.nv + n <= this.cap) return;
    const cap = this.cap * 2;
    const p = new Float32Array(cap * 3); p.set(this.pos); this.pos = p;
    const u = new Float32Array(cap * 2); u.set(this.uv); this.uv = u;
    const l = new Uint8Array(cap * 4); l.set(this.light); this.light = l;
    const i = new Uint32Array(cap * 1.5); i.set(this.idx); this.idx = i;
    this.cap = cap;
  }
}
const bufs = [new Buf(16384), new Buf(8192), new Buf(4096)];

export class ChunkWorld {
  constructor(scene, atlas, materials) {
    this.scene = scene;
    this.uv = atlas.uv;
    this.mats = materials;       // [dicht, gaatjes, doorzichtig]
    this.chunks = new Map();
    this.dirty = new Set();
    this.minLightBoost = 0;
    this._lk = -1; this._lc = null;
    this.meshCount = 0;
  }

  clear() {
    for (const c of this.chunks.values()) this.dispose(c);
    this.chunks.clear(); this.dirty.clear();
    this._lk = -1; this._lc = null;
  }

  dispose(c) {
    for (let i = 0; i < 3; i++) {
      const m = c.meshes[i];
      if (m) { this.scene.remove(m); m.geometry.dispose(); c.meshes[i] = null; }
    }
  }

  get(cx, cz) { return this.chunks.get(chunkKey(cx, cz)); }

  addChunk(cx, cz, blocks) {
    const key = chunkKey(cx, cz);
    const old = this.chunks.get(key);
    if (old) this.dispose(old);
    // urgent: 0 = kan wachten, 1 = snel (licht veranderd), 2 = nu meteen (er is een blok weg of bij)
    const c = { cx, cz, key, b: blocks, hm: new Uint8Array(256), maxY: 0, emit: [], meshes: [null, null, null], meshed: false, urgent: 0 };
    this.scan(c);
    this.chunks.set(key, c);
    this._lk = -1;
    this.dirty.add(key);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = this.get(cx + dx, cz + dz);
      if (n && !n.meshed) this.dirty.add(n.key);
    }
  }

  removeChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    const c = this.chunks.get(key);
    if (!c) return;
    this.dispose(c);
    this.chunks.delete(key);
    this.dirty.delete(key);
    this._lk = -1;
  }

  // hoogtekaart, hoogste blok en lichtgevende blokken van een chunk bepalen
  scan(c) {
    const b = c.b;
    let maxY = 0;
    c.emit.length = 0;
    for (let x = 0; x < CS; x++) for (let z = 0; z < CS; z++) {
      const p = idx(x, 0, z);
      let h = 0, top = 0;
      for (let y = CH - 1; y > 0; y--) {
        const id = b[p + y];
        if (!id) continue;
        if (!top) top = y;
        if (!h && SKYBLOCK[id]) h = y;
        const L = LIGHT[id];
        if (L) {
          if (B_SHAPE[id] === SHAPE_LIQUID) { if ((x & 3) === 0 && (z & 3) === 0 && b[p + y + 1] === 0) c.emit.push(x, y, z, L); }
          else c.emit.push(x, y, z, L);
        }
      }
      c.hm[x * 16 + z] = h;
      if (top > maxY) maxY = top;
    }
    c.maxY = maxY;
  }

  getBlock(x, y, z) {
    if (y < 0) return B.oergesteente;
    if (y >= CH) return 0;
    const cx = x >> 4, cz = z >> 4;
    const key = chunkKey(cx, cz);
    let c;
    if (key === this._lk) c = this._lc;
    else { c = this.chunks.get(key); if (c) { this._lk = key; this._lc = c; } }
    if (!c) return -1;
    return c.b[idx(x & 15, y, z & 15)];
  }

  isLoaded(x, z) { return this.chunks.has(chunkKey(Math.floor(x) >> 4, Math.floor(z) >> 4)); }
  isMeshed(x, z) { const c = this.chunks.get(chunkKey(Math.floor(x) >> 4, Math.floor(z) >> 4)); return !!(c && c.meshed); }

  solid(x, y, z) { const id = this.getBlock(x, y, z); return id > 0 && B_SOLID[id] === 1; }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= CH) return;
    const cx = x >> 4, cz = z >> 4;
    const c = this.get(cx, cz);
    if (!c) return;
    const lx = x & 15, lz = z & 15;
    const i = idx(lx, y, lz);
    const old = c.b[i];
    if (old === id) return;
    c.b[i] = id;
    this.scan(c);
    c.urgent = 2;
    this.dirty.add(c.key);
    const wide = LIGHT[old] || LIGHT[id] || SKYBLOCK[old] !== SKYBLOCK[id];
    const m = wide ? 8 : 1;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      if ((dx < 0 && lx >= m) || (dx > 0 && lx < 16 - m) || (dz < 0 && lz >= m) || (dz > 0 && lz < 16 - m)) continue;
      const n = this.get(cx + dx, cz + dz);
      if (!n || !n.meshed) continue;
      // Ligt het blok precies tegen de buur-chunk aan, dan moet die in hetzelfde beeld mee
      // veranderen: daar komt een vlak vrij (of verdwijnt er een). Anders kijk je een paar
      // beelden lang dwars door de wereld heen. Andere buren hoeven alleen ander licht.
      const touches = (dz === 0 && ((dx < 0 && lx === 0) || (dx > 0 && lx === 15))) || (dx === 0 && ((dz < 0 && lz === 0) || (dz > 0 && lz === 15)));
      if (touches) n.urgent = 2; else if (!n.urgent) n.urgent = 1;
      this.dirty.add(n.key);
    }
  }

  remeshAll() { for (const c of this.chunks.values()) if (c.meshed) this.dirty.add(c.key); }
  // andere plaatjes en materialen gebruiken (wisselen tussen gewone en mooie weergave)
  setLook(mats, uv) {
    this.mats = mats; this.uv = uv;
    for (const c of this.chunks.values()) for (let i = 0; i < 3; i++) if (c.meshes[i]) c.meshes[i].material = mats[i];
    this.remeshAll();
  }
  // als een levensboom herstelt, geven zijn vruchten meer licht: de lichtbronnen opnieuw opzoeken
  rescanAll() { for (const c of this.chunks.values()) this.scan(c); this.remeshAll(); }

  // Elke frame: een paar chunks (opnieuw) opbouwen, dichtbij eerst.
  update(px, pz, budgetMs) {
    if (!this.dirty.size) return 0;
    const t0 = performance.now();
    const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
    let done = 0;
    // Eerst alles wat samen in één beeld moet veranderen (de chunk waar een blok weg is of bij
    // is gekomen, en op de rand ook de buur): dat gaat altijd door, ook als de tijd op is.
    let must = null;
    for (const key of this.dirty) {
      const c = this.chunks.get(key);
      if (c && c.urgent === 2 && this.get(c.cx + 1, c.cz) && this.get(c.cx - 1, c.cz) && this.get(c.cx, c.cz + 1) && this.get(c.cx, c.cz - 1)) (must || (must = [])).push(c);
    }
    if (must) {
      for (const c of must) { this.dirty.delete(c.key); c.urgent = 0; this.mesh(c); done++; }
      if (performance.now() - t0 > budgetMs) return done;
    }
    while (this.dirty.size) {
      let best = null, bd = 1e9;
      for (const key of this.dirty) {
        const c = this.chunks.get(key);
        if (!c) { this.dirty.delete(key); continue; }
        if (!this.get(c.cx + 1, c.cz) || !this.get(c.cx - 1, c.cz) || !this.get(c.cx, c.cz + 1) || !this.get(c.cx, c.cz - 1)) continue;
        let d = (c.cx - pcx) * (c.cx - pcx) + (c.cz - pcz) * (c.cz - pcz);
        if (c.urgent) d -= 1000;
        if (d < bd) { bd = d; best = c; }
      }
      if (!best) break;
      this.dirty.delete(best.key);
      best.urgent = 0;
      this.mesh(best);
      done++;
      if (performance.now() - t0 > budgetMs) break;
    }
    return done;
  }

  // ---------- de mesher ----------

  mesh(c) {
    const { cx, cz } = c;
    // 1. blokken met een randje van de buren kopiëren
    pad.fill(0);
    let maxY = c.maxY;
    const nb = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const n = (dx || dz) ? this.get(cx + dx, cz + dz) : c;
      nb.push(n);
      if (n && n.maxY > maxY) maxY = n.maxY;
    }
    maxY = Math.min(CH - 1, maxY + 1);
    for (let px = 0; px < PW; px++) {
      const wx = px - 1, ncx = wx < 0 ? 0 : (wx > 15 ? 2 : 1), lx = wx & 15;
      for (let pz = 0; pz < PW; pz++) {
        const wz = pz - 1, ncz = wz < 0 ? 0 : (wz > 15 ? 2 : 1), lz = wz & 15;
        const n = nb[ncx * 3 + ncz];
        const o = (px * PW + pz) * PH;
        pad[o] = B.oergesteente;
        if (!n) continue;
        const src = idx(lx, 0, lz);
        const top = Math.min(maxY, n.maxY);
        for (let y = 0; y <= top; y++) pad[o + 1 + y] = n.b[src + y];
      }
    }

    // 2. zonlicht: per kolom de "hoogte waar het licht vandaan komt"
    for (let ex = 0; ex < 26; ex++) for (let ez = 0; ez < 26; ez++) {
      const wx = ex - 5, wz = ez - 5;
      const n = nb[(wx < 0 ? 0 : (wx > 15 ? 2 : 1)) * 3 + (wz < 0 ? 0 : (wz > 15 ? 2 : 1))];
      EFF[ex * 26 + ez] = n ? n.hm[(wx & 15) * 16 + (wz & 15)] + 1 : 32000;
    }
    for (let ex = 0; ex < 26; ex++) for (let ez = 0; ez < 26; ez++) if (EFF[ex * 26 + ez] === 32000) {
      const cxx = Math.min(20, Math.max(5, ex)), czz = Math.min(20, Math.max(5, ez));
      EFF[ex * 26 + ez] = EFF[cxx * 26 + czz];
    }
    let A = EFF, Bf = EFF2;
    for (let it = 0; it < 4; it++) {
      for (let ex = 0; ex < 26; ex++) for (let ez = 0; ez < 26; ez++) {
        const i = ex * 26 + ez;
        let v = A[i];
        if (ex > 0 && A[i - 26] + 2 < v) v = A[i - 26] + 2;
        if (ex < 25 && A[i + 26] + 2 < v) v = A[i + 26] + 2;
        if (ez > 0 && A[i - 1] + 2 < v) v = A[i - 1] + 2;
        if (ez < 25 && A[i + 1] + 2 < v) v = A[i + 1] + 2;
        Bf[i] = v;
      }
      const t = A; A = Bf; Bf = t;
    }
    const E = A;   // E[(px+4)*26 + (pz+4)] hoort bij pad-kolom (px, pz)

    // 3. licht van fakkels, kristallen, lava...
    let hasBL = false;
    for (let k = 0; k < 9; k++) {
      const n = nb[k];
      if (!n || !n.emit.length) continue;
      const ox = (Math.floor(k / 3) - 1) * 16, oz = (k % 3 - 1) * 16;
      const em = n.emit;
      for (let i = 0; i < em.length; i += 4) {
        const ex = em[i] + ox, ey = em[i + 1], ez = em[i + 2] + oz, L = em[i + 3];
        const r = Math.ceil(L / 2);
        if (ex + r < -1 || ex - r > 16 || ez + r < -1 || ez - r > 16) continue;
        if (!hasBL) { BL.fill(0); hasBL = true; }
        const x0 = Math.max(-1, ex - r), x1 = Math.min(16, ex + r), z0 = Math.max(-1, ez - r), z1 = Math.min(16, ez + r);
        const y0 = Math.max(0, ey - r), y1 = Math.min(CH - 1, ey + r);
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
          const o = ((x + 1) * PW + (z + 1)) * PH + 1;
          const dxz = (x - ex) * (x - ex) + (z - ez) * (z - ez);
          for (let y = y0; y <= y1; y++) {
            const v = L - 2 * Math.sqrt(dxz + (y - ey) * (y - ey));
            if (v > BL[o + y]) BL[o + y] = v;
          }
        }
      }
    }

    // 4. vlakken maken
    for (const b of bufs) b.reset();
    const uvT = this.uv;
    let loY = CH, hiY = 0;
    for (let x = 0; x < CS; x++) for (let z = 0; z < CS; z++) {
      const col = (x + 1) * PW + (z + 1);
      const base = col * PH + 1;
      for (let y = 1; y <= maxY; y++) {
        const p = base + y;
        const id = pad[p];
        if (id === 0) continue;
        const shape = B_SHAPE[id];
        if (shape === SHAPE_CUBE) {
          const pass = B_PASS[id];
          const buf = bufs[pass];
          const selfL = LIGHT[id];
          const gl = pass === 2 ? 0 : GLOW[id] * 4, sw = pass === 2 ? 0 : SWAY[id];
          for (let f = 0; f < 6; f++) {
            const np = p + NSTR[f];
            const nid = pad[np];
            if (B_OPAQUE[nid]) continue;
            if (nid === id && pass !== 0) continue;
            // licht in het vakje vóór dit vlak
            const ncol = col + CSTR[f], ny = y + YOFF[f];
            const ecol = (((ncol / PW) | 0) + 4) * 26 + (ncol % PW) + 4;
            let sl = 15 - (E[ecol] - ny);
            if (sl > 15) sl = 15; else if (sl < 0) sl = 0;
            let bl = hasBL ? BL[np] : 0;
            if (selfL > bl) bl = selfL;
            const sh = SHADE[f], ls = HQ_MESH ? 1 : sh;
            const sky = SKY_LUT[sl] * ls * 255, blk = BLK_LUT[bl] * ls * 255, amb = sh * 255;
            const tile = f === 2 ? T_TOP[id] : (f === 3 ? T_BOTTOM[id] : T_SIDE[id]);
            const u0 = uvT[tile * 4], v0 = uvT[tile * 4 + 1], du = uvT[tile * 4 + 2] - u0, dv = uvT[tile * 4 + 3] - v0;
            buf.need(4);
            const nv = buf.nv;
            let a0 = 3, a1 = 3, a2 = 3, a3 = 3;
            for (let k = 0; k < 4; k++) {
              const fk = f * 4 + k;
              const s1 = B_OPAQUE[pad[np + AO1[fk]]], s2 = B_OPAQUE[pad[np + AO2[fk]]];
              const ao = (s1 && s2) ? 0 : 3 - s1 - s2 - B_OPAQUE[pad[np + AO1[fk] + AO2[fk]]];
              if (k === 0) a0 = ao; else if (k === 1) a1 = ao; else if (k === 2) a2 = ao; else a3 = ao;
              const af = AO_F[ao];
              const vi = nv + k;
              buf.pos[vi * 3] = x + FC[fk * 3]; buf.pos[vi * 3 + 1] = y + FC[fk * 3 + 1]; buf.pos[vi * 3 + 2] = z + FC[fk * 3 + 2];
              buf.uv[vi * 2] = u0 + FUV[fk * 2] * du; buf.uv[vi * 2 + 1] = v0 + FUV[fk * 2 + 1] * dv;
              buf.light[vi * 4] = sky * af; buf.light[vi * 4 + 1] = blk * af; buf.light[vi * 4 + 2] = amb * af;
              buf.light[vi * 4 + 3] = (gl ? Math.round(gl * (0.7 + 0.3 * sh * af)) : 0) + sw;
            }
            const ni = buf.ni;
            if (a0 + a2 >= a1 + a3) {
              buf.idx[ni] = nv; buf.idx[ni + 1] = nv + 1; buf.idx[ni + 2] = nv + 2; buf.idx[ni + 3] = nv; buf.idx[ni + 4] = nv + 2; buf.idx[ni + 5] = nv + 3;
            } else {
              buf.idx[ni] = nv + 1; buf.idx[ni + 1] = nv + 2; buf.idx[ni + 2] = nv + 3; buf.idx[ni + 3] = nv + 1; buf.idx[ni + 4] = nv + 3; buf.idx[ni + 5] = nv;
            }
            buf.nv += 4; buf.ni += 6;
          }
          if (y < loY) loY = y; if (y > hiY) hiY = y;
        } else if (shape === SHAPE_LOW) {
          // laag blok (bed): lager dan een heel blok; het hoofdeind krijgt een plank die omhoog steekt
          const buf = bufs[0];
          const h = B_HEIGHT[id];
          const bed = B_BED[id];
          const dir = bed ? (bed - 1) & 3 : 3;
          const endFace = bed > 4 ? DIR_FACE[dir] : -1;
          const ownE = (x + 5) * 26 + z + 5;
          for (let f = 0; f < 6; f++) {
            const np = p + NSTR[f];
            const nid = pad[np];
            if (f !== 2) {
              if (B_OPAQUE[nid]) continue;
              if (f !== 3 && B_SHAPE[nid] === SHAPE_LOW) continue;      // twee helften sluiten op elkaar aan
            }
            let sl, bl;
            if (f === 2) { sl = 15 - (E[ownE] - y); bl = hasBL ? BL[p] : 0; }
            else {
              const ncol = col + CSTR[f];
              sl = 15 - (E[(((ncol / PW) | 0) + 4) * 26 + (ncol % PW) + 4] - (y + YOFF[f]));
              bl = hasBL ? BL[np] : 0;
            }
            if (sl > 15) sl = 15; else if (sl < 0) sl = 0;
            const sh = SHADE[f], ls = HQ_MESH ? 1 : sh;
            const sky = SKY_LUT[sl] * ls * 255, blk = BLK_LUT[bl] * ls * 255, amb = sh * 255;
            const fh = f === endFace ? 1 : h;
            const tile = f === 2 ? T_TOP[id] : (f === 3 ? T_BOTTOM[id] : (f === endFace ? T_BED_END : T_SIDE[id]));
            const u0 = uvT[tile * 4], v0 = uvT[tile * 4 + 1], du = uvT[tile * 4 + 2] - u0, dv = uvT[tile * 4 + 3] - v0;
            buf.need(4);
            const nv = buf.nv;
            for (let k = 0; k < 4; k++) {
              const fk = f * 4 + k, vi = nv + k;
              const cx = FC[fk * 3], cy = FC[fk * 3 + 1], cz = FC[fk * 3 + 2];
              let uu = FUV[fk * 2], vv = FUV[fk * 2 + 1];
              if (f === 2) {
                // bovenkant draaien: de bovenrand van het plaatje ligt aan de kant van het hoofdeind
                if (dir === 3) { uu = cx; vv = cz; } else if (dir === 1) { uu = 1 - cx; vv = 1 - cz; }
                else if (dir === 0) { uu = cz; vv = 1 - cx; } else { uu = 1 - cz; vv = cx; }
              }
              buf.pos[vi * 3] = x + cx; buf.pos[vi * 3 + 1] = y + cy * fh; buf.pos[vi * 3 + 2] = z + cz;
              buf.uv[vi * 2] = u0 + uu * du; buf.uv[vi * 2 + 1] = v0 + vv * dv;
              buf.light[vi * 4] = sky; buf.light[vi * 4 + 1] = blk; buf.light[vi * 4 + 2] = amb; buf.light[vi * 4 + 3] = 0;
            }
            const ni = buf.ni;
            buf.idx[ni] = nv; buf.idx[ni + 1] = nv + 1; buf.idx[ni + 2] = nv + 2; buf.idx[ni + 3] = nv; buf.idx[ni + 4] = nv + 2; buf.idx[ni + 5] = nv + 3;
            buf.nv += 4; buf.ni += 6;
          }
          if (endFace >= 0) {
            // de binnenkant van het hoofdeinde: het stuk plank boven het matras
            const f = endFace;
            let sl = 15 - (E[ownE] - y);
            if (sl > 15) sl = 15; else if (sl < 0) sl = 0;
            const bl = hasBL ? BL[p] : 0;
            const sky = SKY_LUT[sl] * 0.8 * 255, blk = BLK_LUT[bl] * 0.8 * 255;
            const u0 = uvT[T_BED_END * 4], v0 = uvT[T_BED_END * 4 + 1], du = uvT[T_BED_END * 4 + 2] - u0, dv = uvT[T_BED_END * 4 + 3] - v0;
            buf.need(4);
            const nv = buf.nv;
            for (let k = 0; k < 4; k++) {
              const fk = f * 4 + (3 - k), vi = nv + k;             // omgekeerde volgorde: het vlak kijkt naar binnen
              buf.pos[vi * 3] = x + FC[fk * 3]; buf.pos[vi * 3 + 1] = y + h + FC[fk * 3 + 1] * (1 - h); buf.pos[vi * 3 + 2] = z + FC[fk * 3 + 2];
              buf.uv[vi * 2] = u0 + FUV[fk * 2] * du; buf.uv[vi * 2 + 1] = v0 + FUV[fk * 2 + 1] * (1 - h) * dv;
              buf.light[vi * 4] = sky; buf.light[vi * 4 + 1] = blk; buf.light[vi * 4 + 2] = 204; buf.light[vi * 4 + 3] = 0;
            }
            const ni = buf.ni;
            buf.idx[ni] = nv; buf.idx[ni + 1] = nv + 1; buf.idx[ni + 2] = nv + 2; buf.idx[ni + 3] = nv; buf.idx[ni + 4] = nv + 2; buf.idx[ni + 5] = nv + 3;
            buf.nv += 4; buf.ni += 6;
          }
          if (y < loY) loY = y; if (y > hiY) hiY = y;
        } else if (shape === SHAPE_EGG) {
          // een rond 3D-ei
          const buf = bufs[0];
          const ecol = (x + 5) * 26 + z + 5;
          let sl = 15 - (E[ecol] - y);
          if (sl > 15) sl = 15; else if (sl < 0) sl = 0;
          let bl = hasBL ? BL[p] : 0;
          if (LIGHT[id] > bl) bl = LIGHT[id];
          const skyL = SKY_LUT[sl] * 255, blkL = BLK_LUT[bl] * 255;
          const tile = T_TOP[id];
          const u0 = uvT[tile * 4], v0 = uvT[tile * 4 + 1], du = uvT[tile * 4 + 2] - u0, dv = uvT[tile * 4 + 3] - v0;
          buf.need(EGG_SEG * (EGG_RINGS - 1) * 4);
          for (let j = 0; j < EGG_RINGS - 1; j++) {
            for (let i = 0; i < EGG_SEG; i++) {
              const nv = buf.nv;
              // vier hoeken: (ring, segment), tegen de klok in van buitenaf gezien
              for (let k = 0; k < 4; k++) {
                const rj = k < 2 ? j : j + 1, si = (k === 0 || k === 3) ? i + 1 : i;
                const cs = EGG_COS[si], sn = EGG_SIN[si], r = EGG_R[rj];
                const dot = cs * EGG_NR[rj] * EGG_LX + EGG_NY[rj] * EGG_LY + sn * EGG_NR[rj] * EGG_LZ;
                const sh = 0.5 + 0.5 * (dot > 0 ? dot : 0);
                const vi = nv + k;
                buf.pos[vi * 3] = x + 0.5 + cs * r; buf.pos[vi * 3 + 1] = y + EGG_Y[rj]; buf.pos[vi * 3 + 2] = z + 0.5 + sn * r;
                buf.uv[vi * 2] = u0 + (si / EGG_SEG) * du; buf.uv[vi * 2 + 1] = v0 + (1 - rj / (EGG_RINGS - 1)) * dv;
                buf.light[vi * 4] = skyL * sh; buf.light[vi * 4 + 1] = blkL * sh; buf.light[vi * 4 + 2] = 255 * sh; buf.light[vi * 4 + 3] = 0;
              }
              const ni = buf.ni;
              buf.idx[ni] = nv; buf.idx[ni + 1] = nv + 1; buf.idx[ni + 2] = nv + 2; buf.idx[ni + 3] = nv; buf.idx[ni + 4] = nv + 2; buf.idx[ni + 5] = nv + 3;
              buf.nv += 4; buf.ni += 6;
            }
          }
          if (y < loY) loY = y; if (y > hiY) hiY = y;
        } else if (shape === SHAPE_CROSS) {
          // Klein ding (plantje, paddenstoel, fakkel, vuur, rank): een 3D-model uit blockmodels.js.
          // Elke plek krijgt zijn eigen draaiing, plekje en hoogte, afgeleid van waar hij staat.
          const models = BLOCK_MODELS[id];
          if (!models) continue;
          const buf = bufs[1];
          const ecol = (x + 5) * 26 + z + 5;
          let sl = 15 - (E[ecol] - y);
          if (sl > 15) sl = 15; else if (sl < 0) sl = 0;
          let bl = hasBL ? BL[p] : 0;
          if (LIGHT[id] > bl) bl = LIGHT[id];
          const sky = SKY_LUT[sl] * 242, blk = BLK_LUT[bl] * 255;
          const wx = cx * 16 + x, wz = cz * 16 + z;
          const h1 = hash2(wx, wz, 7001), h2 = hash2(wx, wz, 7002);
          let M = models[(h1 * models.length) | 0];
          let cs = 1, sn = 0;
          if (id === RAILS) {
            // rails: het stuk (recht, bocht, helling, kruising) hangt af van de rails ernaast
            for (let d = 0; d < 4; d++) { const np = p + RAIL_STR[d]; RL[d] = pad[np] === RAILS ? 1 : pad[np + 1] === RAILS ? 2 : pad[np - 1] === RAILS ? 3 : 0; }
            const rs = railShape(RL), q = rs & 3;
            M = models[rs >> 2];
            cs = q === 0 ? 1 : q === 2 ? -1 : 0; sn = q === 1 ? 1 : q === 3 ? -1 : 0;
          } else if (M.rot === 2) { cs = Math.cos(h2 * 6.2832); sn = Math.sin(h2 * 6.2832); }
          else if (M.rot === 1) { const q = (h2 * 4) | 0; cs = q === 0 ? 1 : q === 2 ? -1 : 0; sn = q === 1 ? 1 : q === 3 ? -1 : 0; }
          const ox = x + 0.5 + (hash2(wx, wz, 7003) - 0.5) * 2 * M.jit, oz = z + 0.5 + (hash2(wx, wz, 7004) - 0.5) * 2 * M.jit;
          const sy = 1 + (hash2(wx, wz, 7005) - 0.5) * 2 * M.vary;
          const gB = GLOW[id];
          const mp = M.pos, mu = M.uv, mn = M.nrm, mf = M.flags;
          buf.need(M.n * 4);
          for (let q = 0; q < M.n; q++) {
            // hoe licht dit vlak is: van boven lichter, en een beetje afhankelijk van de kant
            const nx = mn[q * 3], nz = mn[q * 3 + 2];
            let sh = 0.72 + 0.22 * mn[q * 3 + 1] + 0.1 * ((nx * cs - nz * sn) * 0.75 + (nx * sn + nz * cs) * 0.35);
            if (sh > 1) sh = 1;
            const ls = HQ_MESH ? 1 : sh;
            const tile = M.tile[q];
            const u0 = uvT[tile * 4], v0 = uvT[tile * 4 + 1], du = uvT[tile * 4 + 2] - u0, dv = uvT[tile * 4 + 3] - v0;
            const g4 = (M.glow[q] < 0 ? gB : M.glow[q]) * 4;
            const nv = buf.nv;
            for (let k = 0; k < 4; k++) {
              const vi = nv + k, si = q * 4 + k;
              const px = mp[si * 3] - 0.5, py = mp[si * 3 + 1], pz = mp[si * 3 + 2] - 0.5;
              buf.pos[vi * 3] = ox + px * cs - pz * sn; buf.pos[vi * 3 + 1] = y + py * sy; buf.pos[vi * 3 + 2] = oz + px * sn + pz * cs;
              buf.uv[vi * 2] = u0 + mu[si * 2] * du; buf.uv[vi * 2 + 1] = v0 + mu[si * 2 + 1] * dv;
              const ao = M.ao ? 0.66 + 0.34 * (py > 0.4 ? 1 : py * 2.5) : 1;          // vlak bij de grond wat donkerder
              buf.light[vi * 4] = sky * ls * ao; buf.light[vi * 4 + 1] = blk * ls * ao; buf.light[vi * 4 + 2] = 242 * sh * ao;
              buf.light[vi * 4 + 3] = g4 + mf[si];
            }
            const ni = buf.ni;
            buf.idx[ni] = nv; buf.idx[ni + 1] = nv + 1; buf.idx[ni + 2] = nv + 2; buf.idx[ni + 3] = nv; buf.idx[ni + 4] = nv + 2; buf.idx[ni + 5] = nv + 3;
            buf.nv += 4; buf.ni += 6;
          }
          if (y < loY) loY = y; if (y > hiY) hiY = y;
        } else if (shape === SHAPE_LIQUID) {
          const lava = id === B.lava;
          const buf = bufs[lava ? 0 : 2];
          const above = pad[p + 1];
          const hgt = above === id ? 1 : 0.86;
          for (let f = 0; f < 6; f++) {
            const np = p + NSTR[f];
            const nid = pad[np];
            if (nid === id || B_OPAQUE[nid]) continue;
            if (f !== 2 && nid !== 0 && B_SHAPE[nid] !== SHAPE_CROSS && B_PASS[nid] === 0) continue;
            const ncol = col + CSTR[f], ny = y + YOFF[f];
            const ecol = (((ncol / PW) | 0) + 4) * 26 + (ncol % PW) + 4;
            let sl = 15 - (E[ecol] - ny);
            if (sl > 15) sl = 15; else if (sl < 0) sl = 0;
            const sh = SHADE[f], ls = HQ_MESH ? 1 : sh;
            const sky = SKY_LUT[sl] * ls * 255;
            const blk = lava ? 255 : (hasBL ? BLK_LUT[BL[np]] * ls * 255 : 0);
            const tile = T_TOP[id];
            const u0 = uvT[tile * 4], v0 = uvT[tile * 4 + 1], du = uvT[tile * 4 + 2] - u0, dv = uvT[tile * 4 + 3] - v0;
            buf.need(4);
            const nv = buf.nv;
            for (let k = 0; k < 4; k++) {
              const fk = f * 4 + k, vi = nv + k;
              const cy = FC[fk * 3 + 1];
              buf.pos[vi * 3] = x + FC[fk * 3]; buf.pos[vi * 3 + 1] = y + cy * hgt; buf.pos[vi * 3 + 2] = z + FC[fk * 3 + 2];
              buf.uv[vi * 2] = u0 + FUV[fk * 2] * du; buf.uv[vi * 2 + 1] = v0 + FUV[fk * 2 + 1] * dv;
              buf.light[vi * 4] = sky; buf.light[vi * 4 + 1] = blk; buf.light[vi * 4 + 2] = sh * 255; buf.light[vi * 4 + 3] = (cy && hgt < 1) ? 255 : 0;
            }
            const ni = buf.ni;
            buf.idx[ni] = nv; buf.idx[ni + 1] = nv + 1; buf.idx[ni + 2] = nv + 2; buf.idx[ni + 3] = nv; buf.idx[ni + 4] = nv + 2; buf.idx[ni + 5] = nv + 3;
            buf.nv += 4; buf.ni += 6;
          }
          if (y < loY) loY = y; if (y > hiY) hiY = y;
        }
      }
    }

    // 5. naar three.js
    if (hiY < loY) { loY = 0; hiY = 1; }
    const cyc = (loY + hiY + 1) / 2, ry = (hiY + 1 - loY) / 2;
    const radius = Math.sqrt(128 + ry * ry);
    for (let i = 0; i < 3; i++) {
      const buf = bufs[i];
      let m = c.meshes[i];
      if (buf.nv === 0) {
        if (m) { this.scene.remove(m); m.geometry.dispose(); c.meshes[i] = null; }
        continue;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(buf.pos.slice(0, buf.nv * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(buf.uv.slice(0, buf.nv * 2), 2));
      g.setAttribute('light', new THREE.BufferAttribute(buf.light.slice(0, buf.nv * 4), 4, true));
      g.setIndex(new THREE.BufferAttribute(buf.nv > 65535 ? buf.idx.slice(0, buf.ni) : new Uint16Array(buf.idx.subarray(0, buf.ni)), 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(8, cyc, 8), radius);
      if (m) { m.geometry.dispose(); m.geometry = g; }
      else {
        m = new THREE.Mesh(g, this.mats[i]);
        m.position.set(cx * 16, 0, cz * 16);
        m.matrixAutoUpdate = false;
        m.updateMatrix();
        if (i === 2) m.renderOrder = 2;
        this.scene.add(m);
        c.meshes[i] = m;
      }
    }
    c.meshed = true;
    this.meshCount++;
  }

  // ---------- botsen en mikken ----------

  boxHits(x, y, z, hw, h) {
    const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw), y0 = Math.floor(y), y1 = Math.floor(y + h - 0.001);
    const z0 = Math.floor(z - hw), z1 = Math.floor(z + hw);
    for (let bx = x0; bx <= x1; bx++) for (let bz = z0; bz <= z1; bz++) for (let by = y0; by <= y1; by++) {
      const id = this.getBlock(bx, by, bz);
      if (id > 0 && B_SOLID[id] && y < by + B_HEIGHT[id]) return true;    // lage blokken (bed) zijn minder hoog
    }
    return false;
  }

  // de bovenkant van het hoogste blok waar deze doos tegenaan zit (om netjes op te landen)
  boxTop(x, y, z, hw, h) {
    const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw), y0 = Math.floor(y), y1 = Math.floor(y + h - 0.001);
    const z0 = Math.floor(z - hw), z1 = Math.floor(z + hw);
    let top = -1e9;
    for (let bx = x0; bx <= x1; bx++) for (let bz = z0; bz <= z1; bz++) for (let by = y0; by <= y1; by++) {
      const id = this.getBlock(bx, by, bz);
      if (id > 0 && B_SOLID[id] && y < by + B_HEIGHT[id] && by + B_HEIGHT[id] > top) top = by + B_HEIGHT[id];
    }
    return top;
  }

  // Loop langs een straal en geef het eerste blok dat je kunt aanraken.
  raycast(ox, oy, oz, dx, dy, dz, maxD) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : 1e9, tdy = dy !== 0 ? Math.abs(1 / dy) : 1e9, tdz = dz !== 0 ? Math.abs(1 / dz) : 1e9;
    let tx = dx !== 0 ? ((dx > 0 ? x + 1 - ox : ox - x) * tdx) : 1e9;
    let ty = dy !== 0 ? ((dy > 0 ? y + 1 - oy : oy - y) * tdy) : 1e9;
    let tz = dz !== 0 ? ((dz > 0 ? z + 1 - oz : oz - z) * tdz) : 1e9;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 200; i++) {
      const id = this.getBlock(x, y, z);
      if (id > 0 && B_SHAPE[id] !== SHAPE_LIQUID) return { x, y, z, nx, ny, nz, id, t };
      if (tx < ty && tx < tz) { t = tx; tx += tdx; x += sx; nx = -sx; ny = 0; nz = 0; }
      else if (ty < tz) { t = ty; ty += tdy; y += sy; nx = 0; ny = -sy; nz = 0; }
      else { t = tz; tz += tdz; z += sz; nx = 0; ny = 0; nz = -sz; }
      if (t > maxD) return null;
    }
    return null;
  }
}
