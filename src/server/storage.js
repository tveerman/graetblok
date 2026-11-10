// Opslag voor de server. In de browser gebruiken we IndexedDB.
// Wie de server later op een eigen computer wil draaien (Node.js), maakt een
// klasse met dezelfde vier functies (get, set, del, entries) die bestanden schrijft.

export class MemoryStorage {
  constructor() { this.m = new Map(); this.persistent = false; }
  async get(key) { return this.m.get(key); }
  async set(key, value) { this.m.set(key, value); }
  async del(key) { this.m.delete(key); }
  async entries(prefix) {
    const out = [];
    for (const [k, v] of this.m) if (k.startsWith(prefix)) out.push([k, v]);
    return out;
  }
  async clear() { this.m.clear(); }
}

export class IDBStorage {
  constructor(db) { this.db = db; this.persistent = true; }

  static open(name) {
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; reject(new Error('IndexedDB timeout')); } }, 3000);
      let req;
      try { req = indexedDB.open(name, 1); } catch (e) { clearTimeout(timer); reject(e); return; }
      req.onupgradeneeded = () => { req.result.createObjectStore('kv'); };
      req.onsuccess = () => { if (done) return; done = true; clearTimeout(timer); resolve(new IDBStorage(req.result)); };
      req.onerror = () => { if (done) return; done = true; clearTimeout(timer); reject(req.error); };
    });
  }

  _tx(mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('kv', mode);
      const store = tx.objectStore('kv');
      const result = fn(store);
      tx.oncomplete = () => resolve(result && result.result !== undefined ? result.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  get(key) { return this._tx('readonly', (s) => s.get(key)); }
  set(key, value) { return this._tx('readwrite', (s) => { s.put(value, key); }); }
  del(key) { return this._tx('readwrite', (s) => { s.delete(key); }); }
  clear() { return this._tx('readwrite', (s) => { s.clear(); }); }
  entries(prefix) {
    return new Promise((resolve, reject) => {
      const out = [];
      const tx = this.db.transaction('kv', 'readonly');
      const range = IDBKeyRange.bound(prefix, prefix + '￿');
      const req = tx.objectStore('kv').openCursor(range);
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) { out.push([cur.key, cur.value]); cur.continue(); }
      };
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error);
    });
  }
}

export async function openStorage(name) {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('geen IndexedDB');
    try { return await IDBStorage.open(name); }
    catch (e) { return await IDBStorage.open(name); }   // oude iPads hebben soms een tweede poging nodig
  } catch (e) {
    console.warn('Opslaan lukt niet, het spel onthoudt niets na afsluiten:', e);
    return new MemoryStorage();
  }
}
