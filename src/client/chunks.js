// De blokkenwereld aan de kant van het spel: chunks bewaren, er 3D-vormen van maken,
// botsingen en "waar wijs ik naar?".
import * as THREE from '../../vendor/three.module.min.js';
import { CS, CH, idx, chunkKey } from '../shared/constants.js';
import {
  B, B_SHAPE, B_PASS, B_OPAQUE, B_SOLID, B_LIGHT, B_TOP, B_SIDE, B_BOTTOM, NUM_BLOCKS,
  SHAPE_CUBE, SHAPE_CROSS, SHAPE_LIQUID, LIFE_LEAVES, LEAVES, TILE_DOR,
} from '../shared/blocks.js';

const PW = CS + 2, PH = CH + 2;
const SX = PW * PH, SZ = PH;

// tegels per blok (kopie, zodat verdorde levensbomen een ander plaatje krijgen)
const T_TOP = B_TOP.slice(), T_SIDE = B_SIDE.slice(), T_BOTTOM = B_BOTTOM.slice();
const SKYBLOCK = new Uint8Array(NUM_BLOCKS);     // houdt dit blok zonlicht tegen?
for (let i = 0; i < NUM_BLOCKS; i++) SKYBLOCK[i] = B_OPAQUE[i];
for (const id of LEAVES) SKYBLOCK[id] = 1;

export function setTreeTiles(trees) {
  for (const k in LIFE_LEAVES) {
    const id = LIFE_LEAVES[k];
    const alive = !!(trees && trees[k]);
    T_TOP[id] = alive ? B_TOP[id] : TILE_DOR; T_SIDE[id] = T_TOP[id]; T_BOTTOM[id] = T_TOP[id];
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
const SKY_LUT = new Float32Array(16), BLK_LUT = new Float32Array(16);
for (let i = 0; i < 16; i++) { SKY_LUT[i] = 0.03 + 0.97 * Math.pow(i / 15, 1.7); BLK_LUT[i] = Math.pow(i / 15, 1.3); }

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
    const c = { cx, cz, key, b: blocks, hm: new Uint8Array(256), maxY: 0, emit: [], meshes: [null, null, null], meshed: false, urgent: false };
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
        const L = B_LIGHT[id];
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
    c.urgent = true;
    this.dirty.add(c.key);
    const wide = B_LIGHT[old] || B_LIGHT[id] || SKYBLOCK[old] !== SKYBLOCK[id];
    const m = wide ? 8 : 1;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      if ((dx < 0 && lx >= m) || (dx > 0 && lx < 16 - m) || (dz < 0 && lz >= m) || (dz > 0 && lz < 16 - m)) continue;
      const n = this.get(cx + dx, cz + dz);
      if (n && n.meshed) { n.urgent = true; this.dirty.add(n.key); }
    }
  }

  remeshAll() { for (const c of this.chunks.values()) if (c.meshed) this.dirty.add(c.key); }

  // Elke frame: een paar chunks (opnieuw) opbouwen, dichtbij eerst.
  update(px, pz, budgetMs) {
    if (!this.dirty.size) return 0;
    const t0 = performance.now();
    const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
    let done = 0;
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
      best.urgent = false;
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
          const selfL = B_LIGHT[id];
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
            const sh = SHADE[f];
            const sky = SKY_LUT[sl] * sh * 255, blk = BLK_LUT[bl] * sh * 255, amb = sh * 255;
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
              buf.light[vi * 4] = sky * af; buf.light[vi * 4 + 1] = blk * af; buf.light[vi * 4 + 2] = amb * af; buf.light[vi * 4 + 3] = 0;
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
        } else if (shape === SHAPE_CROSS) {
          const buf = bufs[1];
          const ecol = (x + 5) * 26 + z + 5;
          let sl = 15 - (E[ecol] - y);
          if (sl > 15) sl = 15; else if (sl < 0) sl = 0;
          let bl = hasBL ? BL[p] : 0;
          if (B_LIGHT[id] > bl) bl = B_LIGHT[id];
          const sky = SKY_LUT[sl] * 242, blk = BLK_LUT[bl] * 255;
          const tile = T_SIDE[id];
          const u0 = uvT[tile * 4], v0 = uvT[tile * 4 + 1], u1 = uvT[tile * 4 + 2], v1 = uvT[tile * 4 + 3];
          buf.need(8);
          for (let q = 0; q < 2; q++) {
            const nv = buf.nv;
            const xa = x + 0.12, xb = x + 0.88, za = z + (q ? 0.88 : 0.12), zb = z + (q ? 0.12 : 0.88);
            const P = [xa, y, za, u0, v1, xb, y, zb, u1, v1, xb, y + 1, zb, u1, v0, xa, y + 1, za, u0, v0];
            for (let k = 0; k < 4; k++) {
              const vi = nv + k;
              buf.pos[vi * 3] = P[k * 5]; buf.pos[vi * 3 + 1] = P[k * 5 + 1]; buf.pos[vi * 3 + 2] = P[k * 5 + 2];
              buf.uv[vi * 2] = P[k * 5 + 3]; buf.uv[vi * 2 + 1] = P[k * 5 + 4];
              buf.light[vi * 4] = sky; buf.light[vi * 4 + 1] = blk; buf.light[vi * 4 + 2] = 242; buf.light[vi * 4 + 3] = 0;
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
            const sh = SHADE[f];
            const sky = SKY_LUT[sl] * sh * 255;
            const blk = lava ? 255 : (hasBL ? BLK_LUT[BL[np]] * sh * 255 : 0);
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
      if (id > 0 && B_SOLID[id]) return true;
    }
    return false;
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
