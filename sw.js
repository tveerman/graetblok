// Graet Blok - service worker: zorgt dat het spel ook start als de server uit staat.
//
// Hoe het werkt:
// - Bij het eerste bezoek worden alle bestanden van het spel opgeslagen ("een generatie").
//   Welke bestanden dat zijn staat in files.json.
// - Daarna komt elk bestand uit die opslag, dus de pagina laadt ook zonder server.
// - Bij elke start (en als het hoofdmenu erom vraagt) kijkt de service worker of de server
//   bereikbaar is en of die nieuwere bestanden heeft. Zo ja, dan wordt een complete nieuwe
//   generatie klaargezet. Die wordt pas gebruikt bij de volgende keer laden, zodat oude en
//   nieuwe bestanden nooit door elkaar lopen.
//
// Let op: browsers staan een service worker alleen toe via https (of op localhost).

const BASE = self.registration.scope;            // bijv. https://voorbeeld.nl/spel/
const LIST_URL = BASE + 'files.json';
const META_CACHE = 'graet-meta';
const META_URL = BASE + '__graet_meta__';
const GEN_PREFIX = 'graet-gen-';

let metaMem = null;      // { active, sigs, pending, pendingSigs }
let checking = null;     // lopende controle
let lastResult = null;   // { reachable, at } van de laatste controle

// ---------- hulpjes ----------

async function readMeta() {
  try {
    const c = await caches.open(META_CACHE);
    const r = await c.match(META_URL);
    if (r) return await r.json();
  } catch (e) { /* nog geen gegevens */ }
  return null;
}
async function writeMeta(meta) {
  metaMem = meta;
  const c = await caches.open(META_CACHE);
  await c.put(META_URL, new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
}
async function getMeta(fresh) {
  if (!metaMem || fresh) metaMem = await readMeta();
  return metaMem;
}

// adres zonder ?vraag en #anker; een map betekent index.html
function keyFor(href) {
  const u = new URL(href);
  u.search = ''; u.hash = '';
  if (u.pathname.endsWith('/')) u.pathname += 'index.html';
  return u.href;
}

function hash(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
  return bytes.length + ':' + (h >>> 0).toString(36);
}

function typeFor(url, given) {
  if (given) return given;
  if (url.endsWith('.js')) return 'text/javascript';
  if (url.endsWith('.css')) return 'text/css';
  if (url.endsWith('.html')) return 'text/html';
  if (url.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

// een verzoek dat na een tijdje vanzelf stopt (een uitgezette server geeft anders heel lang geen antwoord)
function timed(ms) {
  if (typeof AbortController === 'undefined') return { signal: undefined, done: () => {} };
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

// De lijst met bestanden van het spel. Gooit een fout als de server onbereikbaar is.
async function fileList() {
  const t = timed(6000);
  try {
    const res = await fetch(LIST_URL, { cache: 'no-cache', signal: t.signal });
    if (!res.ok) throw new Error('files.json gaf ' + res.status);
    const list = await res.json();
    return list.map((p) => BASE + p);
  } finally { t.done(); }
}

// Haal bestanden vers van de server. Gooit een fout als de server onbereikbaar is.
async function download(urls) {
  const files = [];
  const t = timed(40000);
  try {
    await Promise.all(urls.map(async (url) => {
      const res = await fetch(url, { cache: 'no-cache', signal: t.signal });
      if (res.status === 404) return;                    // bestand bestaat niet (meer): overslaan
      if (!res.ok) throw new Error(url + ' gaf ' + res.status);
      const buf = await res.arrayBuffer();
      files.push({ url, buf, type: typeFor(url, res.headers.get('Content-Type')), sig: hash(new Uint8Array(buf)) });
    }));
  } finally { t.done(); }
  if (!files.some((f) => f.url === BASE + 'index.html')) throw new Error('index.html ontbreekt');
  return files;
}

async function store(name, files) {
  const cache = await caches.open(name);
  await Promise.all(files.map((f) => cache.put(f.url, new Response(f.buf, { headers: { 'Content-Type': f.type } }))));
  const sigs = {};
  for (const f of files) sigs[f.url] = f.sig;
  return sigs;
}

async function notify(msg) {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of list) c.postMessage(msg);
}

// ---------- eerste keer: alles opslaan ----------

async function ensureFirst() {
  const meta = await readMeta();
  if (meta && meta.active && await caches.has(meta.active)) { metaMem = meta; return; }
  const files = await download(await fileList());
  const name = GEN_PREFIX + Date.now();
  const sigs = await store(name, files);
  await writeMeta({ active: name, sigs, pending: null, pendingSigs: null });
}

// ---------- is de server er, en heeft die iets nieuws? ----------

// Geeft { reachable, at }. Als er iets nieuws is, wordt dat klaargezet (meta.pending).
function checkForUpdate(force) {
  if (checking) return checking;
  if (!force && lastResult && Date.now() - lastResult.at < 2000) return Promise.resolve(lastResult);
  checking = (async () => {
    const result = { reachable: false, at: 0 };
    try { result.reachable = await runCheck(); } catch (e) { /* server uit of onbereikbaar */ }
    result.at = Date.now();
    lastResult = result;
    checking = null;
    return result;
  })();
  return checking;
}

async function runCheck() {
  const listed = await fileList();                       // lukt dit, dan is de server bereikbaar
  const meta = await getMeta(true);
  if (!meta || !meta.active || !(await caches.has(meta.active))) return true;
  const cache = await caches.open(meta.active);
  const have = (await cache.keys()).map((r) => r.url);
  const urls = Array.from(new Set(listed.concat(have))).filter((u) => u !== self.location.href);
  const files = await download(urls);

  // vergelijken met wat we al hebben (of met wat al klaarstaat)
  const known = meta.pending ? meta.pendingSigs : meta.sigs;
  let changed = false;
  const got = new Set();
  for (const f of files) {
    got.add(f.url);
    let old = known[f.url];
    if (old === undefined && !meta.pending) {
      // later bijgekomen bestand: vergelijk met de opgeslagen kopie
      const r = await cache.match(f.url);
      if (r) old = hash(new Uint8Array(await r.arrayBuffer()));
    }
    if (old !== f.sig) { changed = true; break; }
  }
  if (!changed) for (const url in known) if (!got.has(url)) { changed = true; break; }
  if (!changed) return true;

  const name = GEN_PREFIX + Date.now();
  const sigs = await store(name, files);
  const m = (await getMeta(true)) || meta;
  const oldPending = m.pending;
  m.pending = name; m.pendingSigs = sigs;
  await writeMeta(m);
  if (oldPending && oldPending !== name) await caches.delete(oldPending);
  await notify({ t: 'sw-update' });
  return true;
}

// oude generaties weggooien
async function cleanup(meta) {
  for (const name of await caches.keys()) {
    if (name.startsWith(GEN_PREFIX) && name !== meta.active && name !== meta.pending) await caches.delete(name);
  }
}

// de klaargezette generatie in gebruik nemen (alleen bij het laden van een pagina)
async function promote(meta) {
  if (!(await caches.has(meta.pending))) { meta.pending = null; meta.pendingSigs = null; await writeMeta(meta); return meta; }
  meta.active = meta.pending; meta.sigs = meta.pendingSigs;
  meta.pending = null; meta.pendingSigs = null;
  await writeMeta(meta);
  await cleanup(meta);
  return meta;
}

// ---------- gebeurtenissen ----------

self.addEventListener('install', (event) => {
  event.waitUntil(ensureFirst());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const meta = await getMeta(true);
    if (meta) await cleanup(meta);
    await self.clients.claim();
  })());
});

async function respond(event) {
  const req = event.request;
  const isNav = req.mode === 'navigate';
  const key = keyFor(req.url);
  let meta = await getMeta(isNav);
  // Ons geheugen kan verouderd zijn (bijv. vlak nadat deze service worker zelf is vernieuwd).
  // Nooit een generatie openen die al is weggegooid: dan eerst opnieuw kijken.
  if (meta && meta.active && !(await caches.has(meta.active))) meta = await getMeta(true);
  if (!meta || !meta.active || !(await caches.has(meta.active))) {
    // opslag kwijt (bijv. door de browser gewist): gewoon via de server, en opnieuw opslaan
    if (isNav) event.waitUntil(ensureFirst().catch(() => {}));
    return fetch(req);
  }
  if (isNav && meta.pending) meta = await promote(meta);
  const cache = await caches.open(meta.active);
  const hit = await cache.match(key);
  if (isNav) event.waitUntil(checkForUpdate(true));
  if (hit) return hit;
  try {
    const net = await fetch(req);
    if (net.ok && net.type === 'basic' && !net.redirected && key !== self.location.href) cache.put(key, net.clone());
    return net;
  } catch (e) {
    if (isNav) {
      const home = await cache.match(BASE + 'index.html');
      if (home) return home;
    }
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(respond(event));
});

// Berichten van de pagina:
//   sw-status?  -> hoeveel bestanden zijn opgeslagen, staat er een nieuwe versie klaar?
//   sw-check    -> is de server bereikbaar, en is er een nieuwe versie?
self.addEventListener('message', (event) => {
  const m = event.data || {};
  const src = event.source;
  if (!src) return;
  if (m.t === 'sw-status?') {
    event.waitUntil((async () => {
      const meta = await getMeta(true);
      let files = 0;
      if (meta && meta.active && await caches.has(meta.active)) files = (await (await caches.open(meta.active)).keys()).length;
      src.postMessage({ t: 'sw-status', files, pending: !!(meta && meta.pending) });
    })());
  } else if (m.t === 'sw-check') {
    event.waitUntil((async () => {
      const r = await checkForUpdate(!!m.force);
      const meta = await getMeta(true);
      src.postMessage({ t: 'sw-checked', reachable: r.reachable, pending: !!(meta && meta.pending) });
    })());
  }
});
