// Een wereld op de server: chunks, veranderde blokken en de wezens die er rondlopen.
import { CS, CH, idx, chunkKey } from '../shared/constants.js';
import { B, B_SOLID, B_SHAPE, SHAPE_LIQUID } from '../shared/blocks.js';
import { WorldGen } from './worldgen.js';

export class ServerWorld {
  constructor(id, seed, edits) {
    this.id = id;
    this.gen = new WorldGen(id, seed);
    this.chunks = new Map();          // sleutel -> Uint8Array
    this.edits = edits || new Map();  // sleutel -> Map(index -> blok)
    this.dirty = new Set();           // chunks met wijzigingen die nog opgeslagen moeten worden
    this.ents = new Map();            // id -> wezen
    this.projs = [];                  // projectielen
    this._lk = -1; this._lc = null;
  }

  chunk(cx, cz) {
    const key = chunkKey(cx, cz);
    if (key === this._lk) return this._lc;
    let c = this.chunks.get(key);
    if (!c) {
      c = this.gen.generate(cx, cz);
      const e = this.edits.get(key);
      if (e) for (const [i, id] of e) c[i] = id;
      this.chunks.set(key, c);
    }
    this._lk = key; this._lc = c;
    return c;
  }

  get(x, y, z) {
    if (y < 0) return B.oergesteente;
    if (y >= CH) return 0;
    return this.chunk(x >> 4, z >> 4)[idx(x & 15, y, z & 15)];
  }

  set(x, y, z, id) {
    if (y < 1 || y >= CH) return false;
    const cx = x >> 4, cz = z >> 4;
    const c = this.chunk(cx, cz);
    const i = idx(x & 15, y, z & 15);
    if (c[i] === id) return false;
    c[i] = id;
    const key = chunkKey(cx, cz);
    let e = this.edits.get(key);
    if (!e) { e = new Map(); this.edits.set(key, e); }
    e.set(i, id);
    this.dirty.add(key);
    return true;
  }

  solid(x, y, z) { return B_SOLID[this.get(x, y, z)] === 1; }
  liquid(x, y, z) { return B_SHAPE[this.get(x, y, z)] === SHAPE_LIQUID; }

  // hoogste vaste blok in een kolom (of -1)
  topY(x, z, from = CH - 1) {
    const c = this.chunk(x >> 4, z >> 4);
    const p = idx(x & 15, 0, z & 15);
    for (let y = from; y > 0; y--) if (B_SOLID[c[p + y]]) return y;
    return -1;
  }

  forget(keepFn) {
    for (const key of this.chunks.keys()) {
      const cx = Math.floor(key / 65536) - 32768, cz = (key % 65536) - 32768;
      if (!keepFn(cx, cz)) this.chunks.delete(key);
    }
    this._lk = -1; this._lc = null;
  }
}

export { CS };
