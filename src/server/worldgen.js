// Wereldgenerator: maakt voor elke wereld het landschap, blok voor blok.
// Alles hangt af van het zaadje (seed), dus dezelfde plek ziet er altijd hetzelfde uit.
import { CS, CH, CHUNK_VOL, SEA, idx, clamp, lerp, smoothstep } from '../shared/constants.js';
import { Simplex, hash2, hash3, mulberry32 } from '../shared/noise.js';
import { B, LIFE_LEAVES } from '../shared/blocks.js';
import { WORLDS, CRASH, NEST_PEAK } from '../shared/worlds.js';

const M = 4;                 // rand om de chunk heen (voor bomen die over de grens hangen)
const W = CS + 2 * M;
const WORLD_SALT = { groen: 0, ijs: 1000, vuur: 2000, schaduw: 3000, wolken: 4000 };

const T_EIK = 1, T_BERK = 2, T_DEN = 3, T_SCHADUW = 4, T_VERKOOLD = 5, T_HEMEL = 6, T_IJSPIEK = 7, T_PILAAR = 8;
const V_GROEN = 1, V_IJS = 2, V_VUUR = 3, V_SCHADUW = 4, V_HEMEL = 5;

export const NEST_REGION = 144;
export const RUIN_REGION = 96;

export class WorldGen {
  constructor(world, seed) {
    this.world = world;
    this.def = WORLDS[world];
    this.tree = this.def.tree;
    const s = (seed + WORLD_SALT[world]) | 0;
    this.seed = s;
    this.n1 = new Simplex(s + 1); this.n2 = new Simplex(s + 2); this.n3 = new Simplex(s + 3);
    this.n4 = new Simplex(s + 4); this.n5 = new Simplex(s + 5); this.n6 = new Simplex(s + 6);
    this.n7 = new Simplex(s + 7); this.n8 = new Simplex(s + 8); this.n9 = new Simplex(s + 9);
    this.c = { h: 0, top: 0, under: 0, base: B.steen, liq: 0, ly: 0, tp: 0, tk: 0, vg: 0, nc: 0, ent: 0 };
    // werkgeheugen
    this._H = new Int16Array(W * W); this._top = new Uint8Array(W * W); this._under = new Uint8Array(W * W);
    this._base = new Uint8Array(W * W); this._liq = new Uint8Array(W * W); this._ly = new Uint8Array(W * W);
    this._tp = new Float32Array(W * W); this._tk = new Uint8Array(W * W); this._vg = new Uint8Array(W * W);
    this._nc = new Uint8Array(W * W); this._ent = new Uint8Array(W * W);
    this._ca = new Float32Array(5 * 5 * (CH / 4 + 1)); this._cb = new Float32Array(5 * 5 * (CH / 4 + 1)); this._cc = new Float32Array(5 * 5 * (CH / 4 + 1));
    this.regionCache = new Map();
    this.gateAngle = Math.atan2(-this.tree.z, -this.tree.x);
  }

  // ---------- kolommen per wereld ----------

  col(x, z) {
    const c = this.c;
    c.liq = 0; c.ly = 0; c.tp = 0; c.tk = 0; c.vg = 0; c.nc = 0; c.ent = 0; c.base = B.steen;
    switch (this.world) {
      case 'groen': this.colGroen(x, z, c); break;
      case 'ijs': this.colIjs(x, z, c); break;
      case 'vuur': this.colVuur(x, z, c); break;
      case 'schaduw': this.colSchaduw(x, z, c); break;
      default: this.colWolken(x, z, c);
    }
    c.h = clamp(Math.floor(c.h), 2, CH - 16);
    return c;
  }

  // hoogte van de grond (zonder grotten en bomen)
  surface(x, z) { return this.col(x, z).h; }

  colGroen(x, z, c) {
    const T = this.tree;
    const d = Math.hypot(x, z);
    let cont = this.n1.fbm2(x / 420, z / 420, 3);
    cont = lerp(0.55, cont, smoothstep(60, 220, d));
    const hills = this.n2.fbm2(x / 110, z / 110, 4);
    const mm = smoothstep(0.05, 0.45, this.n3.n2(x / 520 + 100, z / 520 - 40)) * smoothstep(90, 260, d);
    const r = 1 - Math.abs(this.n4.fbm2(x / 190, z / 190, 3));
    let h = SEA + 4 + cont * 22 + hills * 5 + mm * r * r * 52;
    let special = 0;

    // neergestort ruimteschip: vlak stuk grond
    const dc = Math.hypot(x - CRASH.x, z - CRASH.z);
    if (dc < 34) { h = lerp(CRASH.y, h, smoothstep(16, 34, dc)); if (dc < 22) special = 1; }

    // de berg met het drakennest
    const dp = Math.hypot(x - NEST_PEAK.x, z - NEST_PEAK.z);
    if (dp < 70) {
      const peak = NEST_PEAK.y - Math.max(0, dp - 3) * 0.85 + hills * 1.5 * clamp((dp - 3) / 10, 0, 1);
      if (peak > h) h = peak;
      if (dp < 6) special = 1;
    }

    // het verborgen dal van de Grote Levensboom
    const dt = Math.hypot(x - T.x, z - T.z);
    if (dt < 90) {
      let da = Math.atan2(z - T.z, x - T.x) - this.gateAngle;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      const gate = smoothstep(0.09, 0.2, Math.abs(da));
      const ring = 36 * Math.exp(-Math.pow((dt - 54) / 12, 2)) * gate;
      const hv = T.y + ring + hills * 2 * smoothstep(30, 45, dt);
      h = lerp(hv, h, smoothstep(66, 90, dt));
      if (dt < 42) { c.nc = 1; if (dt < 22) special = 1; }
    }

    c.h = h;
    const fh = Math.floor(h);
    if (fh < SEA) { c.liq = B.water; c.ly = SEA; }
    if (fh <= SEA + 1) { c.top = B.zand; c.under = B.zand; }
    else if (fh > SEA + 54 + hills * 3) { c.top = B.sneeuw; c.under = B.steen; }
    else if (fh > SEA + 36 + hills * 4) { c.top = B.steen; c.under = B.steen; }
    else {
      c.top = B.gras; c.under = B.aarde; c.vg = V_GROEN;
      if (!special) {
        const forest = smoothstep(-0.15, 0.4, this.n5.n2(x / 170, z / 170));
        c.tp = 0.003 + forest * 0.034;
        c.tk = fh > SEA + 24 ? T_DEN : (this.n6.n2(x / 90, z / 90) > 0.25 ? T_BERK : T_EIK);
      }
    }
    if (!special && !c.nc && fh > SEA + 2 && this.n8.n2(x / 60, z / 60) > 0.55) { c.ent = 1; c.tp = 0; }
    if (special) { c.nc = 1; c.vg = dc < 12 ? 0 : c.vg; }
  }

  colIjs(x, z, c) {
    const T = this.tree;
    const hills = this.n1.fbm2(x / 150, z / 150, 4);
    const r = 1 - Math.abs(this.n2.fbm2(x / 210, z / 210, 3));
    const mm = smoothstep(0.15, 0.6, this.n3.n2(x / 400, z / 400));
    let h = SEA + 5 + hills * 11 + mm * r * r * 40;
    let special = 0;
    const dt = Math.hypot(x - T.x, z - T.z);
    if (dt < 70) {
      const hb = dt < 13 ? T.y : lerp(T.y, SEA - 4, smoothstep(13, 19, dt));
      h = lerp(hb, h, smoothstep(44, 70, dt));
      if (dt < 46) { c.nc = 1; special = 1; }
    }
    c.h = h;
    const fh = Math.floor(h);
    if (fh < SEA) { c.liq = B.water; c.ly = SEA; }
    if (fh > SEA + 30) { c.top = B.ijs; c.under = B.ijs; }
    else { c.top = B.sneeuw; c.under = B.sneeuw; c.vg = V_IJS; }
    if (!special && fh >= SEA) {
      const forest = smoothstep(0, 0.5, this.n5.n2(x / 140, z / 140));
      c.tp = 0.002 + forest * 0.02; c.tk = T_DEN;
      if (hash2(x, z, this.seed + 31) < 0.0016) { c.tp = 1; c.tk = T_IJSPIEK; }
    }
    if (!special && fh > SEA + 2 && this.n8.n2(x / 60, z / 60) > 0.62) { c.ent = 1; c.tp = 0; }
  }

  volcano(rx, rz) {
    const key = rx * 4096 + rz;
    let v = this.regionCache.get('v' + key);
    if (v === undefined) {
      const s = this.seed + 500;
      if (hash2(rx, rz, s) < 0.7) {
        v = { x: rx * 192 + 40 + hash2(rx, rz, s + 1) * 112, z: rz * 192 + 40 + hash2(rx, rz, s + 2) * 112, r: 36 + hash2(rx, rz, s + 3) * 14 };
        // niet op de aankomstplek en niet op de Vuurboom
        if (Math.hypot(v.x, v.z) < 70 || Math.hypot(v.x - this.tree.x, v.z - this.tree.z) < 110) v = null;
      } else v = null;
      this.regionCache.set('v' + key, v);
    }
    return v;
  }

  colVuur(x, z, c) {
    const T = this.tree;
    const hills = this.n1.fbm2(x / 120, z / 120, 4);
    let h = 42 + hills * 9;
    let special = 0, onCone = 0;
    const rx = Math.floor(x / 192), rz = Math.floor(z / 192);
    const v = this.volcano(rx, rz);
    if (v) {
      const dv = Math.hypot(x - v.x, z - v.z);
      if (dv < v.r) {
        const top = 42 + v.r * 1.05;
        let cone = 42 + (1 - dv / v.r) * (top - 42);
        const rim = 8;
        if (dv < rim) { cone = 42 + (1 - rim / v.r) * (top - 42) - (rim - dv) * 2.5; c.liq = B.lava; c.ly = Math.floor(42 + (1 - rim / v.r) * (top - 42)) - 4; }
        if (cone > h || dv < rim) { h = cone; onCone = 1; }
        special = dv < rim + 2 ? 1 : 0;
      }
    }
    const dt = Math.hypot(x - T.x, z - T.z);
    if (dt < 62) {
      let hb;
      if (dt < 27) hb = T.y;
      else if (dt < 35) hb = (Math.abs(z - T.z) < 2.5 || Math.abs(x - T.x) < 2.5) ? T.y : 33;
      else hb = 44;
      h = lerp(hb, h, smoothstep(36, 62, dt));
      c.nc = 1; special = 1;
    }
    c.h = h;
    c.base = B.basalt;
    const fh = Math.floor(h);
    if (!c.liq && fh < 38) { c.liq = B.lava; c.ly = 38; }
    if (fh <= 39) { c.top = hash2(x, z, this.seed + 5) < 0.3 ? B.obsidiaan : B.magmasteen; c.under = B.basalt; }
    else if (onCone) { c.top = hash2(x, z, this.seed + 6) < 0.12 ? B.magmasteen : B.basalt; c.under = B.basalt; }
    else { c.top = B.as; c.under = B.as; c.vg = V_VUUR; if (!special) { c.tp = 0.007; c.tk = T_VERKOOLD; } }
    if (!special && !onCone && fh > 41 && this.n8.n2(x / 60, z / 60) > 0.6) { c.ent = 1; c.tp = 0; }
  }

  colSchaduw(x, z, c) {
    const T = this.tree;
    const hills = this.n1.fbm2(x / 100, z / 100, 4);
    const spire = Math.pow(1 - Math.abs(this.n2.n2(x / 60, z / 60)), 5);
    let h = 44 + hills * 10 + spire * 13 * smoothstep(30, 80, Math.hypot(x, z));
    let special = 0;
    const dt = Math.hypot(x - T.x, z - T.z);
    if (dt < 50) {
      h = lerp(T.y, h, smoothstep(24, 46, dt));
      if (dt < 30) { c.nc = 1; special = 1; }
    }
    c.h = h;
    c.base = B.schaduwsteen;
    const fh = Math.floor(h);
    if (fh < 37) { c.liq = B.water; c.ly = 37; }
    c.top = B.schaduwgras; c.under = B.schaduwsteen; c.vg = V_SCHADUW;
    if (fh <= 37) { c.top = B.schaduwsteen; c.vg = 0; }
    if (!special && fh > 37) {
      const forest = smoothstep(-0.1, 0.5, this.n5.n2(x / 130, z / 130));
      c.tp = 0.003 + forest * 0.022; c.tk = T_SCHADUW;
      if (hash2(x, z, this.seed + 31) < 0.0014) { c.tp = 1; c.tk = T_PILAAR; }
    }
    if (!special && fh > 39 && this.n8.n2(x / 60, z / 60) > 0.6) { c.ent = 1; c.tp = 0; }
  }

  // Wolkenwereld: zwevende eilanden. h = bovenkant van eiland A (of 0), c.ly = onderkant.
  colWolken(x, z, c) {
    const d = Math.hypot(x, z);
    let a = this.n1.fbm2(x / 75, z / 75, 3);
    a = Math.max(a, 0.6 * (1 - d / 46));
    c.h = 0; c.top = B.hemelgras; c.under = B.hemelsteen; c.base = B.hemelsteen; c.nc = 1;
    if (a > 0.2) {
      c.h = 54 + (a - 0.2) * 16 + this.n3.n2(x / 18, z / 18) * 1.2;
      c.ly = Math.max(14, Math.floor(53 - (a - 0.2) * 75));
      c.vg = V_HEMEL;
      c.tp = 0.012 * smoothstep(0.24, 0.4, a); c.tk = T_HEMEL;
    }
  }

  // tweede (hoge) eilandenlaag van de wolkenwereld: geeft [top, bottom] of null
  islandB(x, z) {
    const T = this.tree;
    const dt = Math.hypot(x - T.x, z - T.z);
    if (dt < 36) {
      const m = 1 - dt / 36;
      const top = dt < 26 ? T.y : T.y - Math.floor((dt - 26) * 0.6);
      return [top, Math.floor(T.y - 3 - m * 30)];
    }
    if (dt < 60) return null;
    const b = this.n2.fbm2(x / 60 + 300, z / 60 - 200, 3);
    if (b > 0.42) return [Math.floor(82 + (b - 0.42) * 12), Math.floor(81 - (b - 0.42) * 60)];
    return null;
  }

  // ---------- chunk maken ----------

  generate(cx, cz) {
    const blocks = new Uint8Array(CHUNK_VOL);
    const ox = cx * CS, oz = cz * CS;
    const H = this._H, TOP = this._top, UND = this._under, BASE = this._base, LIQ = this._liq, LY = this._ly;
    const TP = this._tp, TK = this._tk, VG = this._vg, NC = this._nc, ENT = this._ent;

    for (let lx = -M; lx < CS + M; lx++) {
      for (let lz = -M; lz < CS + M; lz++) {
        const c = this.col(ox + lx, oz + lz);
        const i = (lx + M) * W + (lz + M);
        H[i] = c.h; TOP[i] = c.top; UND[i] = c.under; BASE[i] = c.base; LIQ[i] = c.liq; LY[i] = c.ly;
        TP[i] = c.tp; TK[i] = c.tk; VG[i] = c.vg; NC[i] = c.nc; ENT[i] = c.ent;
      }
    }

    const put = (x, y, z, id) => {
      const lx = x - ox, lz = z - oz;
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 1 || y >= CH) return;
      blocks[idx(lx, y, lz)] = id;
    };
    const putSoft = (x, y, z, id) => {  // alleen als er nog niets staat
      const lx = x - ox, lz = z - oz;
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 1 || y >= CH) return;
      const p = idx(lx, y, lz);
      if (blocks[p] === 0) blocks[p] = id;
    };

    if (this.world === 'wolken') this.fillWolken(blocks, ox, oz);
    else {
      for (let lx = 0; lx < CS; lx++) {
        for (let lz = 0; lz < CS; lz++) {
          const i = (lx + M) * W + (lz + M);
          const h = H[i], p = idx(lx, 0, lz);
          const top = TOP[i], und = UND[i], base = BASE[i];
          blocks[p] = B.oergesteente;
          for (let y = 1; y <= h; y++) blocks[p + y] = y === h ? top : (y > h - 4 ? und : base);
          if (LIQ[i]) {
            const ly = LY[i];
            for (let y = h + 1; y <= ly; y++) blocks[p + y] = LIQ[i];
            if (this.world === 'ijs' && ly > h) blocks[p + ly] = B.ijs;
          }
        }
      }
      this.carve(blocks, ox, oz);
      this.ores(blocks, cx, cz);
    }

    // bomen (ook die net buiten de chunk staan)
    const rs = this.seed + 77;
    for (let lx = -M; lx < CS + M; lx++) {
      for (let lz = -M; lz < CS + M; lz++) {
        const i = (lx + M) * W + (lz + M);
        const tp = TP[i];
        if (tp <= 0) continue;
        const wx = ox + lx, wz = oz + lz;
        if (hash2(wx, wz, rs) >= tp) continue;
        this.plantTree(TK[i], wx, H[i] + 1, wz, put, putSoft, mulberry32((hash2(wx, wz, rs + 1) * 4294967296) >>> 0));
      }
    }
    // plantjes
    for (let lx = 0; lx < CS; lx++) {
      for (let lz = 0; lz < CS; lz++) {
        const i = (lx + M) * W + (lz + M);
        const vg = VG[i];
        if (!vg) continue;
        const h = H[i], p = idx(lx, h, lz);
        if (h < 1 || blocks[p] !== TOP[i] || blocks[p + 1] !== 0) continue;
        const r = hash2(ox + lx, oz + lz, this.seed + 99);
        let id = 0;
        if (vg === V_GROEN) id = r < 0.13 ? B.hoog_gras : r < 0.137 ? B.bloem_rood : r < 0.144 ? B.bloem_geel : r < 0.151 ? B.bloem_blauw : r < 0.159 ? B.bessenstruik : 0;
        else if (vg === V_IJS) id = r < 0.004 ? B.dode_struik : r < 0.008 ? B.bessenstruik : 0;
        else if (vg === V_VUUR) id = r < 0.01 ? B.dode_struik : 0;
        else if (vg === V_SCHADUW) id = r < 0.022 ? B.gloeipaddenstoel : r < 0.03 ? B.dode_struik : r < 0.034 ? B.bessenstruik : 0;
        else if (vg === V_HEMEL) id = r < 0.09 ? B.hoog_gras : r < 0.1 ? B.bloem_geel : r < 0.11 ? B.bloem_blauw : r < 0.118 ? B.bessenstruik : 0;
        if (id) blocks[p + 1] = id;
      }
    }

    this.structures(blocks, ox, oz, put, putSoft);
    return blocks;
  }

  fillWolken(blocks, ox, oz) {
    const H = this._H, LY = this._ly;
    for (let lx = 0; lx < CS; lx++) {
      for (let lz = 0; lz < CS; lz++) {
        const i = (lx + M) * W + (lz + M);
        const x = ox + lx, z = oz + lz;
        const p = idx(lx, 0, lz);
        const h = H[i];
        if (h > 0) {
          for (let y = LY[i]; y <= h; y++) blocks[p + y] = y === h ? B.hemelgras : B.hemelsteen;
        }
        const isl = this.islandB(x, z);
        if (isl) {
          const top = isl[0], bot = Math.max(isl[1], h + 6);
          for (let y = bot; y <= top; y++) blocks[p + y] = y === top ? B.hemelgras : B.hemelsteen;
          // hemelkristal in de hoge eilanden
          if (top - bot > 4 && hash2(x, z, this.seed + 41) < 0.03) blocks[p + bot + 1 + Math.floor(hash2(x, z, this.seed + 42) * (top - bot - 2))] = B.hemelkristal_erts;
        }
        if (h > 0 && h - LY[i] > 5 && hash2(x, z, this.seed + 43) < 0.02) blocks[p + LY[i] + 1 + Math.floor(hash2(x, z, this.seed + 44) * (h - LY[i] - 3))] = B.hemelkristal_erts;
        // wolken
        const cl = this.n4.fbm2(x / 45, z / 45, 2);
        if (cl > 0.22) {
          const t = cl > 0.4 ? 2 : 1;
          for (let y = 51 - t; y <= 51; y++) if (blocks[p + y] === 0) blocks[p + y] = B.wolk;
        }
        const cl2 = this.n5.fbm2(x / 50 + 90, z / 50, 2);
        if (cl2 > 0.42 && blocks[p + 80] === 0) blocks[p + 80] = B.wolk;
      }
    }
  }

  carve(blocks, ox, oz) {
    const GY = CH / 4 + 1;
    const A = this._ca, Bn = this._cb, Cn = this._cc;
    const n5 = this.n6, n6 = this.n7, n7 = this.n9;
    for (let gx = 0; gx < 5; gx++) {
      for (let gz = 0; gz < 5; gz++) {
        const wx = ox + gx * 4, wz = oz + gz * 4;
        const o = (gx * 5 + gz) * GY;
        for (let gy = 0; gy < GY; gy++) {
          const y = gy * 4;
          A[o + gy] = n5.n3(wx / 52, y / 34, wz / 52);
          Bn[o + gy] = n6.n3(wx / 52 + 31, y / 34, wz / 52 - 17);
          Cn[o + gy] = n7.n3(wx / 110, y / 55, wz / 110);
        }
      }
    }
    const H = this._H, NC = this._nc, ENT = this._ent, LIQ = this._liq;
    const lavaY = this.world === 'vuur' ? 12 : 6;
    for (let lx = 0; lx < CS; lx++) {
      const gx = lx >> 2, fx = (lx & 3) / 4;
      for (let lz = 0; lz < CS; lz++) {
        const i = (lx + M) * W + (lz + M);
        if (NC[i]) continue;
        const h = H[i];
        let ymax = ENT[i] ? h : h - 4;
        if (LIQ[i]) ymax = h - 7; else if (h < SEA + 3 && this.world !== 'vuur') ymax = h - 8;
        if (ymax < 2) continue;
        const gz = lz >> 2, fz = (lz & 3) / 4;
        const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
        const i00 = (gx * 5 + gz) * GY, i10 = ((gx + 1) * 5 + gz) * GY, i01 = (gx * 5 + gz + 1) * GY, i11 = ((gx + 1) * 5 + gz + 1) * GY;
        const p = idx(lx, 0, lz);
        let gyPrev = -1, a0 = 0, a1 = 0, b0 = 0, b1 = 0, c0 = 0, c1 = 0;
        for (let y = 2; y <= ymax; y++) {
          const gy = y >> 2, fy = (y & 3) / 4;
          if (gy !== gyPrev) {
            gyPrev = gy;
            a0 = A[i00 + gy] * w00 + A[i10 + gy] * w10 + A[i01 + gy] * w01 + A[i11 + gy] * w11;
            a1 = A[i00 + gy + 1] * w00 + A[i10 + gy + 1] * w10 + A[i01 + gy + 1] * w01 + A[i11 + gy + 1] * w11;
            b0 = Bn[i00 + gy] * w00 + Bn[i10 + gy] * w10 + Bn[i01 + gy] * w01 + Bn[i11 + gy] * w11;
            b1 = Bn[i00 + gy + 1] * w00 + Bn[i10 + gy + 1] * w10 + Bn[i01 + gy + 1] * w01 + Bn[i11 + gy + 1] * w11;
            c0 = Cn[i00 + gy] * w00 + Cn[i10 + gy] * w10 + Cn[i01 + gy] * w01 + Cn[i11 + gy] * w11;
            c1 = Cn[i00 + gy + 1] * w00 + Cn[i10 + gy + 1] * w10 + Cn[i01 + gy + 1] * w01 + Cn[i11 + gy + 1] * w11;
          }
          const a = a0 + (a1 - a0) * fy, b = b0 + (b1 - b0) * fy, c = c0 + (c1 - c0) * fy;
          const tun = a * a + b * b < 0.011 + 0.007 * c;
          const depth = h - y;
          const cav = depth > 8 && c > 0.56 + (depth < 26 ? (26 - depth) * 0.018 : 0);
          if (tun || cav) blocks[p + y] = y <= lavaY ? B.lava : 0;
        }
      }
    }
  }

  ores(blocks, cx, cz) {
    const rnd = mulberry32((hash2(cx, cz, this.seed + 123) * 4294967296) >>> 0);
    const w = this.world;
    const stone = w === 'vuur' ? B.basalt : w === 'schaduw' ? B.schaduwsteen : B.steen;
    const vein = (id, count, y0, y1, size) => {
      for (let n = 0; n < count; n++) {
        let x = Math.floor(rnd() * 16), z = Math.floor(rnd() * 16), y = Math.floor(y0 + rnd() * (y1 - y0));
        for (let s = 0; s < size; s++) {
          if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 0 && y < CH) {
            const p = idx(x, y, z);
            if (blocks[p] === stone) blocks[p] = id;
          }
          const d = Math.floor(rnd() * 6);
          if (d === 0) x++; else if (d === 1) x--; else if (d === 2) z++; else if (d === 3) z--; else if (d === 4) y++; else y--;
        }
      }
    };
    vein(B.steenkool_erts, 12, 8, 90, 8);
    vein(B.ijzer_erts, 9, 5, 56, 6);
    vein(B.goud_erts, w === 'vuur' ? 6 : 3, 4, 30, 5);
    vein(B.kristal_erts, w === 'schaduw' ? 4 : 2, 3, 20, 4);
    if (w === 'ijs') vein(B.ijskristal_erts, 7, 10, 70, 5);
    if (w === 'vuur') vein(B.vuurkristal_erts, 7, 10, 70, 5);
    if (w === 'schaduw') vein(B.schaduwkristal_erts, 7, 10, 70, 5);
    // gloeikristallen in grotwanden
    let placed = 0;
    for (let n = 0; n < 50 && placed < 3; n++) {
      const x = 1 + Math.floor(rnd() * 14), z = 1 + Math.floor(rnd() * 14), y = 3 + Math.floor(rnd() * 50);
      const p = idx(x, y, z);
      if (blocks[p] !== stone) continue;
      if (blocks[p + 1] === 0 || blocks[p - 1] === 0 || blocks[idx(x + 1, y, z)] === 0 || blocks[idx(x - 1, y, z)] === 0 || blocks[idx(x, y, z + 1)] === 0 || blocks[idx(x, y, z - 1)] === 0) {
        blocks[p] = B.gloeikristal; placed++;
      }
    }
  }

  plantTree(kind, x, y, z, put, soft, rnd) {
    if (kind === T_EIK || kind === T_BERK || kind === T_HEMEL) {
      const log = kind === T_EIK ? B.stam_eik : kind === T_BERK ? B.stam_berk : B.stam_hemel;
      const leaf = kind === T_EIK ? B.blad_eik : kind === T_BERK ? B.blad_berk : B.blad_goud;
      const th = (kind === T_BERK ? 5 : 4) + Math.floor(rnd() * 3);
      const R = kind === T_BERK ? 2.1 : 2.6 + rnd() * 0.5;
      const cy = y + th;
      const ri = Math.ceil(R);
      for (let dx = -ri; dx <= ri; dx++) for (let dz = -ri; dz <= ri; dz++) for (let dy = -2; dy <= ri; dy++) {
        const v = dx * dx + dz * dz + dy * dy * (dy > 0 ? 1.4 : 1.1);
        if (v <= R * R - rnd() * 1.6) soft(x + dx, cy + dy, z + dz, leaf);
      }
      for (let i = 0; i < th; i++) put(x, y + i, z, log);
    } else if (kind === T_DEN) {
      const th = 6 + Math.floor(rnd() * 4);
      const top = y + th;
      soft(x, top + 1, z, B.blad_den); soft(x, top, z, B.blad_den);
      for (let ly = top - 1, n = 0; ly >= y + 2; ly--, n++) {
        const r = Math.min(3, 1 + Math.floor(n / 2)) - (n % 2 === 1 ? 0 : 0);
        const rr = n % 2 === 0 ? r : r - 0.6;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (dx * dx + dz * dz <= rr * rr + 0.6) soft(x + dx, ly, z + dz, B.blad_den);
        }
      }
      for (let i = 0; i < th; i++) put(x, y + i, z, B.stam_den);
    } else if (kind === T_SCHADUW) {
      const th = 4 + Math.floor(rnd() * 3);
      const bx = rnd() < 0.5 ? 1 : -1, bz = rnd() < 0.5 ? 1 : 0;
      let tx = x, tz = z;
      for (let i = 0; i < th; i++) {
        if (i === 2) { tx += bx; tz += bz; }
        put(tx, y + i, tz, B.stam_schaduw);
      }
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        const v = dx * dx + dz * dz;
        if (v <= 9.5 - rnd() * 2) soft(tx + dx, y + th, tz + dz, B.blad_schaduw);
        if (v <= 4) soft(tx + dx, y + th + 1, tz + dz, B.blad_schaduw);
        if (v >= 6 && v <= 9.5 && rnd() < 0.3) soft(tx + dx, y + th - 1, tz + dz, B.blad_schaduw);
      }
    } else if (kind === T_VERKOOLD) {
      const th = 2 + Math.floor(rnd() * 4);
      for (let i = 0; i < th; i++) put(x, y + i, z, B.stam_verkoold);
      if (th > 3) put(x + (rnd() < 0.5 ? 1 : -1), y + th - 2, z, B.stam_verkoold);
    } else if (kind === T_IJSPIEK) {
      const th = 6 + Math.floor(rnd() * 9);
      for (let i = -1; i < th; i++) {
        const r = 2.2 * (1 - i / th);
        const ri = Math.ceil(r);
        for (let dx = -ri; dx <= ri; dx++) for (let dz = -ri; dz <= ri; dz++) if (dx * dx + dz * dz <= r * r) put(x + dx, y + i, z + dz, B.ijs);
      }
    } else if (kind === T_PILAAR) {
      const th = 4 + Math.floor(rnd() * 4);
      for (let i = -1; i < th; i++) put(x, y + i, z, B.schaduwsteen);
      put(x, y + th, z, B.gloeikristal);
    }
  }

  // ---------- bouwwerken ----------

  regionNest(rx, rz) {
    const key = 'n' + (rx * 4096 + rz);
    let n = this.regionCache.get(key);
    if (n !== undefined) return n;
    n = null;
    const s = this.seed + 900, w = this.world;
    let best = null;
    for (let t = 0; t < 6; t++) {
      const x = Math.floor(rx * NEST_REGION + 8 + hash3(rx, rz, t, s) * (NEST_REGION - 16));
      const z = Math.floor(rz * NEST_REGION + 8 + hash3(rx, rz, t, s + 1) * (NEST_REGION - 16));
      let y = 0, egg = 0;
      if (w === 'wolken') {
        const isl = this.islandB(x, z);
        if (isl && Math.hypot(x - this.tree.x, z - this.tree.z) > 70) { y = isl[0]; egg = B.ei_bliksem; }
      } else {
        const c = this.col(x, z);
        if (c.liq || c.nc || c.ent) continue;
        y = c.h;
        if (w === 'groen') { if (y >= SEA + 38) egg = y >= SEA + 56 ? B.ei_kristal : B.ei_natuur; }
        else if (w === 'ijs') { if (y >= SEA + 16) egg = B.ei_ijs; }
        else if (w === 'vuur') { if (y >= 50) egg = B.ei_vuur; }
        else if (w === 'schaduw') { if (y >= 50) egg = B.ei_schaduw; }
      }
      if (egg && (!best || y > best.y)) best = { x, y, z, egg };
    }
    if (best && hash2(rx, rz, s + 5) < 0.75) n = best;
    this.regionCache.set(key, n);
    return n;
  }

  regionRuin(rx, rz) {
    const key = 'r' + (rx * 4096 + rz);
    let n = this.regionCache.get(key);
    if (n !== undefined) return n;
    n = null;
    const s = this.seed + 1300;
    if (hash2(rx, rz, s) < 0.55) {
      const x = Math.floor(rx * RUIN_REGION + 10 + hash2(rx, rz, s + 1) * (RUIN_REGION - 20));
      const z = Math.floor(rz * RUIN_REGION + 10 + hash2(rx, rz, s + 2) * (RUIN_REGION - 20));
      if (Math.hypot(x, z) > 50) {
        if (this.world === 'wolken') {
          const c = this.col(x, z);
          if (c.h > 0) n = { x, y: c.h, z };
        } else {
          const c = this.col(x, z);
          if (!c.liq && !c.nc && !c.ent && c.h < 100) n = { x, y: c.h, z };
        }
      }
    }
    this.regionCache.set(key, n);
    return n;
  }

  structures(blocks, ox, oz, put, soft) {
    const w = this.world, T = this.tree;
    const near = (x, z, r) => x + r >= ox && x - r <= ox + 15 && z + r >= oz && z - r <= oz + 15;

    if (near(T.x, T.z, 20)) this.lifeTree(put, soft, ox, oz);

    if (w === 'groen') {
      if (near(CRASH.x, CRASH.z, 18)) this.crashSite(put, ox, oz);
      if (near(NEST_PEAK.x, NEST_PEAK.z, 3)) this.nest(put, NEST_PEAK.x, NEST_PEAK.y, NEST_PEAK.z, B.ei_natuur);
    }
    if (w === 'wolken' && near(T.x, T.z, 48)) {
      // wolkentrap omhoog naar het eiland van de Hemelboom
      const steps = 420;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ang = t * Math.PI * 3.2;
        const rad = t > 0.85 ? lerp(42, 33, (t - 0.85) / 0.15) : 42;
        const x = Math.round(T.x + Math.cos(ang) * rad), z = Math.round(T.z + Math.sin(ang) * rad);
        const y = Math.round(51 + t * (T.y - 51));
        if (!near(x, z, 2)) continue;
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) soft(x + dx, y, z + dz, B.wolk);
      }
      // wolkenveld onderaan de trap
      for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) if (dx * dx + dz * dz < 40) soft(T.x + 42 + dx, 51, T.z + dz, B.wolk);
    }

    // drakennesten
    const nx0 = Math.floor((ox - 4) / NEST_REGION), nx1 = Math.floor((ox + 19) / NEST_REGION);
    const nz0 = Math.floor((oz - 4) / NEST_REGION), nz1 = Math.floor((oz + 19) / NEST_REGION);
    for (let rx = nx0; rx <= nx1; rx++) for (let rz = nz0; rz <= nz1; rz++) {
      const n = this.regionNest(rx, rz);
      if (n && near(n.x, n.z, 3)) this.nest(put, n.x, n.y, n.z, n.egg);
    }
    // ruïnes met een schatkist
    const qx0 = Math.floor((ox - 4) / RUIN_REGION), qx1 = Math.floor((ox + 19) / RUIN_REGION);
    const qz0 = Math.floor((oz - 4) / RUIN_REGION), qz1 = Math.floor((oz + 19) / RUIN_REGION);
    for (let rx = qx0; rx <= qx1; rx++) for (let rz = qz0; rz <= qz1; rz++) {
      const n = this.regionRuin(rx, rz);
      if (n && near(n.x, n.z, 3)) this.ruin(put, n.x, n.y, n.z);
    }
  }

  nest(put, x, y, z, egg) {
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
      if (corner) continue;
      put(x + dx, y, z + dz, B.drakennest);
      put(x + dx, y + 1, z + dz, B.drakennest);
      const rim = Math.abs(dx) === 2 || Math.abs(dz) === 2;
      put(x + dx, y + 2, z + dz, rim ? B.drakennest : 0);
      put(x + dx, y + 3, z + dz, 0);
      put(x + dx, y + 4, z + dz, 0);
    }
    put(x, y + 2, z, egg);
  }

  ruin(put, x, y, z) {
    const w = this.world;
    const wall = w === 'vuur' ? B.basalt : w === 'schaduw' ? B.schaduwsteen : w === 'wolken' ? B.hemelsteen : w === 'ijs' ? B.ijs : B.keisteen;
    const floor = w === 'vuur' ? B.obsidiaan : B.steenblok;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      put(x + dx, y, z + dz, floor);
      put(x + dx, y - 1, z + dz, wall);
      const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
      for (let dy = 1; dy <= 4; dy++) {
        let id = 0;
        if (edge) {
          const hh = Math.floor(hash3(x + dx, z + dz, 7, this.seed) * 4);
          const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
          if (dy <= (corner ? 3 : hh) && !(dx === 0 && dz === 2)) id = corner ? floor : wall;
        }
        put(x + dx, y + dy, z + dz, id);
      }
    }
    put(x, y + 1, z, B.schatkist);
    put(x - 1, y + 1, z - 1, B.gloeikristal);
  }

  crashSite(put, ox, oz) {
    const cx = CRASH.x, cy = CRASH.y + 2, cz = CRASH.z;
    const RX = 8, RY = 3.7, RZ = 3.7;
    for (let dx = -9; dx <= 9; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) {
      const v = (dx * dx) / (RX * RX) + (dy * dy) / (RY * RY) + (dz * dz) / (RZ * RZ);
      if (v > 1) continue;
      const x = cx + dx, y = cy + dy, z = cz + dz;
      if (v > 0.6) {
        // open gebroken dak en een deur aan de zijkant
        if (dy >= 2 && dx >= -1 && dx <= 5 && hash3(x, y, z, 5) < 0.85) { put(x, y, z, 0); continue; }
        if (dz >= 3 && dx >= -1 && dx <= 0 && dy >= -1 && dy <= 0) { put(x, y, z, 0); continue; }
        put(x, y, z, dx >= 6 && dy >= 0 ? B.glas : (dx <= -7 ? B.magmasteen : B.scheepswand));
      } else {
        put(x, y, z, dy <= -2 ? B.scheepswand : 0);
      }
    }
    put(cx + 5, cy - 1, cz, B.scheepscomputer);
    put(cx - 6, cy - 1, cz, B.lamp);
    put(cx + 2, cy - 1, cz - 2, B.machinekrat);
    // sleuf achter het schip
    for (let dx = -15; dx <= -9; dx++) for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dz) < 2) put(cx + dx, CRASH.y, cz + dz, 0);
      put(cx + dx, CRASH.y - 1, cz + dz, B.as);
    }
    // kratten en brokstukken rondom
    const crates = [[-6, 6], [-3, -7], [4, 8], [9, -6], [14, 3], [-10, -4], [2, -11], [12, -9], [-12, 5], [7, 11]];
    for (const [dx, dz] of crates) put(cx + dx, CRASH.y + 1, cz + dz, B.machinekrat);
    const junk = [[-8, -7], [6, -9], [11, 7], [-4, 10], [15, -3], [-13, -1]];
    for (const [dx, dz] of junk) { put(cx + dx, CRASH.y + 1, cz + dz, B.scheepswand); if ((dx + dz) & 1) put(cx + dx, CRASH.y + 2, cz + dz, B.scheepswand); }
  }

  lifeTree(put, soft, ox, oz) {
    const T = this.tree, w = this.world;
    const tx = T.x, ty = T.y, tz = T.z;
    const leaf = LIFE_LEAVES[w];
    const TH = w === 'wolken' ? 25 : 30;
    const x0 = Math.max(tx - 17, ox), x1 = Math.min(tx + 17, ox + 15);
    const z0 = Math.max(tz - 17, oz), z1 = Math.min(tz + 17, oz + 15);
    // kruin
    const cy = ty + TH - 2;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const dx = x - tx, dz = z - tz;
      const hd = (dx * dx + dz * dz) / 225;
      if (hd > 1.15) continue;
      for (let dy = -7; dy <= 9; dy++) {
        const v = hd + (dy * dy) / (dy > 0 ? 64 : 36);
        const j = hash3(x, cy + dy, z, this.seed + 3) * 0.3;
        if (v <= 0.85 + j && v > 0.12) soft(x, cy + dy, z, leaf);
      }
    }
    // takken
    for (let b = 0; b < 7; b++) {
      const ang = b * 0.9 + 0.3, len = 9 + (b % 3) * 2;
      const by = ty + 14 + (b * 5) % 9;
      for (let s = 0; s <= len; s++) {
        const x = Math.round(tx + Math.cos(ang) * (2 + s)), z = Math.round(tz + Math.sin(ang) * (2 + s));
        const y = by + Math.round(s * 0.6);
        put(x, y, z, B.levenshout); put(x, y + 1, z, B.levenshout);
      }
    }
    // stam met brede wortels
    for (let y = ty - 3; y <= ty + TH; y++) {
      const t = (y - ty) / TH;
      const r = 2.2 + (1 - t) + 2.6 * Math.exp(-Math.max(0, y - ty) / 3);
      const ri = Math.ceil(r);
      for (let dx = -ri; dx <= ri; dx++) for (let dz = -ri; dz <= ri; dz++) {
        if (dx * dx + dz * dz <= r * r) put(tx + dx, y, tz + dz, B.levenshout);
      }
    }
    // het levenshart, aan de zuidkant (+z)
    put(tx, ty + 2, tz + 4, B.levenshart);
    for (let dy = 1; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) { put(tx + dx, ty + dy, tz + 5, 0); put(tx + dx, ty + dy, tz + 6, 0); }
    put(tx - 1, ty + 2, tz + 4, B.gloeikristal); put(tx + 1, ty + 2, tz + 4, B.gloeikristal);
    // kring van kristallen
    for (let k = 0; k < 8; k++) {
      const x = Math.round(tx + Math.cos(k * Math.PI / 4) * 11), z = Math.round(tz + Math.sin(k * Math.PI / 4) * 11);
      const deco = w === 'ijs' ? B.ijs : w === 'vuur' ? B.magmasteen : w === 'schaduw' ? B.schaduwsteen : w === 'wolken' ? B.hemelsteen : B.steenblok;
      put(x, ty + 1, z, deco); put(x, ty + 2, z, deco); put(x, ty + 3, z, B.gloeikristal);
    }
    if (w === 'groen') {
      // geheime kluis diep onder de boom
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let y = 2; y <= 6; y++) {
        const shell = Math.abs(dx) === 2 || Math.abs(dz) === 2 || y === 2 || y === 6;
        put(tx + dx, y, tz + dz, shell ? B.obsidiaan : 0);
      }
      put(tx, 3, tz, B.schatkist);
      put(tx + 1, 3, tz + 1, B.lamp);
    }
  }
}

export const VAULT_Y = 3;
