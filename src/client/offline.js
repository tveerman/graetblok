// Server en versies: in het hoofdmenu kijken we of de server waar het spel vandaan komt
// bereikbaar is en of daar een nieuwere versie staat. Zo ja, dan verschijnt de knop
// "Opnieuw laden".
//
// Er zijn twee manieren, afhankelijk van hoe het spel is geopend:
// - Met de service worker (sw.js; kan alleen via https of op localhost). Die bewaart een
//   kopie van het spel, vergelijkt alle bestanden met de server en zet een nieuwe versie klaar.
// - Zonder service worker (gewoon http, of ?nosw / ?debug in het adres). Dan vergelijken we
//   hier zelf van elk bestand de datum van laatste wijziging op de server met de kopie die
//   de browser heeft geladen.

const $ = (id) => document.getElementById(id);

export function setupOffline(game) {
  const sw = navigator.serviceWorker;
  const disabled = /[?&](debug|nosw)\b/.test(location.search);
  const box = $('updateBox'), btn = $('btnReload'), txt = $('updateText');
  const NEW_TEXT = 'Er is een nieuwe versie van het spel!';
  let mode = 'direct';        // 'sw' of 'direct'
  let reg = null;             // registratie van de service worker
  let busy = false;
  let waitTimer = 0;
  const loaded = {};          // direct: per bestand de versie die deze pagina heeft geladen

  const sayServer = (state) => {
    const el = $('serverStatus');
    if (!el) return;
    el.textContent = state === 'up' ? 'Server: bereikbaar ✔'
      : state === 'down' ? 'Server: niet bereikbaar' + (mode === 'sw' ? ' – je speelt met de opgeslagen versie' : '')
        : 'Server: even kijken...';
    el.dataset.state = state;
  };
  const sayOffline = (text) => { const el = $('offlineStatus'); if (el) el.textContent = text; };
  const showUpdate = () => {
    if (!box) return;
    txt.textContent = NEW_TEXT;
    box.classList.remove('hidden');
  };

  // ---------- zonder service worker ----------

  const stamp = (res) => res.headers.get('Last-Modified') || res.headers.get('ETag') || '';

  function timed(ms) {
    if (typeof AbortController === 'undefined') return { signal: undefined, done: () => {} };
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    return { signal: c.signal, done: () => clearTimeout(t) };
  }

  async function fileList(signal) {
    const res = await fetch('files.json', { cache: 'no-store', signal });
    if (!res.ok) throw new Error('files.json ' + res.status);
    return res.json();
  }

  async function directCheck() {
    const t = timed(8000);
    try {
      const list = await fileList(t.signal);           // lukt dit, dan is de server bereikbaar
      let changed = false;
      await Promise.all(list.map(async (f) => {
        const live = await fetch(f, { method: 'HEAD', cache: 'no-store', signal: t.signal });
        if (!live.ok) return;
        const now = stamp(live);
        if (!(f in loaded)) {
          // wat heeft deze pagina geladen? dat is de kopie in het geheugen van de browser
          let mine = now;
          try { mine = stamp(await fetch(f, { cache: 'force-cache', signal: t.signal })); } catch (e) { /* dan gaan we uit van de server */ }
          loaded[f] = mine;
        }
        if (now && loaded[f] && now !== loaded[f]) changed = true;
      }));
      sayServer('up');
      if (changed) showUpdate();
    } catch (e) {
      sayServer('down');
    } finally { t.done(); }
  }

  async function directReload() {
    // eerst alle bestanden vers ophalen, zodat de browser na het herladen geen oude kopie gebruikt
    const t = timed(30000);
    try {
      const list = await fileList(t.signal);
      await Promise.all(list.map((f) => fetch(f, { cache: 'reload', signal: t.signal }).then((r) => r.arrayBuffer())));
      location.reload();
    } catch (e) {
      sayServer('down');
      txt.textContent = 'De server is nu niet bereikbaar. Probeer het straks nog eens.';
      btn.disabled = false;
    } finally { t.done(); }
  }

  // ---------- controleren ----------

  async function check(force) {
    if (busy) return;
    busy = true;
    if (!$('serverStatus').dataset.state) sayServer('checking');
    try {
      if (mode === 'sw') {
        const target = (reg && reg.active) || sw.controller;
        if (!target) { busy = false; return; }
        target.postMessage({ t: 'sw-check', force: !!force });
        // het antwoord komt als bericht (zie hieronder); komt er niets, dan is er iets mis
        clearTimeout(waitTimer);
        waitTimer = setTimeout(() => { busy = false; sayServer('down'); }, 12000);
        return;
      }
      await directCheck();
    } catch (e) { sayServer('down'); }
    busy = false;
  }

  if (btn) {
    btn.onclick = () => {
      btn.disabled = true;
      txt.textContent = 'Bezig met laden...';
      if (mode === 'sw') location.reload(); else directReload();
    };
  }

  // opnieuw kijken als je terugkomt bij het spel, en af en toe terwijl het menu open staat
  const onMenu = () => game.state === 'menu';
  document.addEventListener('visibilitychange', () => { if (!document.hidden && onMenu()) check(true); });
  setInterval(() => { if (!document.hidden && onMenu()) check(true); }, 60000);
  game.checkServer = () => check(true);

  // ---------- opstarten ----------

  if (!sw) {
    sayOffline(window.isSecureContext ? 'Zonder server spelen: kan niet in deze browser' : 'Zonder server spelen: uit (kan alleen via https)');
    check();
    return;
  }

  if (disabled) {
    sayOffline('Zonder server spelen: uit (ontwikkelaarsmodus)');
    sw.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister()))).then((done) => {
      // deze pagina kwam nog uit de opslag: opnieuw laden, nu rechtstreeks van de server
      if (done.length && sw.controller) location.reload(); else check();
    }).catch(() => check());
    return;
  }

  mode = 'sw';
  sw.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.t === 'sw-checked') {
      clearTimeout(waitTimer);
      busy = false;
      sayServer(m.reachable ? 'up' : 'down');
      if (m.pending) showUpdate();
    } else if (m.t === 'sw-update') {
      // er is net een nieuwe versie klaargezet
      showUpdate();
      if (!onMenu()) game.ui.toast('Er is een nieuwe versie van het spel. Die start de volgende keer.', 'good');
    } else if (m.t === 'sw-status') {
      sayOffline(m.files ? 'Zonder server spelen: klaar ✔' : 'Zonder server spelen: nog niet klaar');
      if (m.pending) showUpdate();
    }
  });

  // een nieuwe service worker heeft het overgenomen: vraag het opnieuw
  sw.addEventListener('controllerchange', () => { clearTimeout(waitTimer); busy = false; check(); });

  sayOffline('Zonder server spelen: bezig met opslaan...');
  sayServer('checking');
  sw.register('sw.js').then(() => sw.ready).then((r) => {
    reg = r;
    if (r.active) r.active.postMessage({ t: 'sw-status?' });
    check();
  }).catch((err) => {
    // de service worker lukt niet: dan kijken we zelf
    mode = 'direct';
    sayOffline('Zonder server spelen: lukt niet (' + (err && err.message ? err.message : 'fout') + ')');
    check();
  });
}
