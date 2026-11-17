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
  // welke versie draait hier? (de datum van het laatst gewijzigde bestand van het spel)
  const sayVersion = (ms) => {
    const el = $('versionText');
    if (!el || !ms) return;
    el.textContent = ' · versie van ' + new Date(ms).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  // De balk op het beginscherm (zie index.html). first = de eerste keer kijken na het laden
  // van de pagina is nog bezig: zolang staat er een balk in plaats van de knop "Spelen".
  let first = true, reloading = false;
  const bar = (tekst, deel) => { if (window.graetLaad) window.graetLaad(tekst, deel); };
  const firstDone = () => { if (!first) return; first = false; if (!reloading && window.graetKlaar) window.graetKlaar('versie'); };
  const onMenuNow = () => game.state === 'menu';
  // Mag het spel zichzelf herladen voor een nieuwe versie? Alleen op het beginscherm, en niet
  // twee keer vlak achter elkaar (dan klopt er iets niet en laten we de knop zien).
  const mayAuto = () => {
    if (!onMenuNow() || reloading) return false;
    let last = 0;
    try { last = +sessionStorage.getItem('graetblok.auto') || 0; } catch (e) { /* geeft niet */ }
    return Date.now() - last > 60000;
  };
  const showUpdate = () => {
    if (!box) return;
    if (mayAuto()) {
      // nog niet aan het spelen: de nieuwe versie meteen laden, zonder dat je iets hoeft te doen
      reloading = true;
      try { sessionStorage.setItem('graetblok.auto', String(Date.now())); } catch (e) { /* geeft niet */ }
      if (window.graetBezig) window.graetBezig('Er is een nieuwe versie! Die wordt nu geladen...', 0.05);
      if (mode === 'sw') setTimeout(() => location.reload(), 400); else directReload();
      return;
    }
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
      let changed = false, seen = 0;
      await Promise.all(list.map(async (f) => {
        const live = await fetch(f, { method: 'HEAD', cache: 'no-store', signal: t.signal });
        if (first) bar('Kijken of er een nieuwe versie is... ' + (++seen) + ' van ' + list.length, 0.9 + 0.1 * seen / list.length);
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
      let newest = 0;
      for (const f in loaded) { const t = Date.parse(loaded[f]); if (t > newest) newest = t; }
      sayVersion(newest);
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
      let got = 0;
      await Promise.all(list.map((f) => fetch(f, { cache: 'reload', signal: t.signal }).then((r) => r.arrayBuffer()).then(() => {
        got++;
        txt.textContent = 'Bezig met laden... ' + got + ' van ' + list.length;
        bar('De nieuwe versie wordt opgehaald... ' + got + ' van ' + list.length, got / list.length);
      })));
      location.reload();
    } catch (e) {
      sayServer('down');
      txt.textContent = 'De server is nu niet bereikbaar. Probeer het straks nog eens.';
      btn.disabled = false;
      // het vanzelf laden is mislukt: dan gewoon de knoppen weer laten zien
      if (reloading) { reloading = false; first = true; firstDone(); box.classList.remove('hidden'); }
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
        if (!target) { busy = false; firstDone(); return; }
        target.postMessage({ t: 'sw-check', force: !!force });
        // het antwoord komt als bericht (zie hieronder); komt er niets, dan is er iets mis
        clearTimeout(waitTimer);
        waitTimer = setTimeout(() => { busy = false; sayServer('down'); firstDone(); }, 12000);
        return;
      }
      await directCheck();
    } catch (e) { sayServer('down'); }
    busy = false;
    firstDone();
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
      sayVersion(m.version);
      if (m.pending) showUpdate();
      firstDone();
    } else if (m.t === 'sw-progress') {
      // de service worker haalt bestanden op: laat op het beginscherm zien hoe ver hij is
      if (first) bar((m.wat === 'eerste' ? 'Het spel wordt opgeslagen op dit apparaat... ' : 'Kijken of er een nieuwe versie is... ') + m.done + ' van ' + m.total, 0.9 + 0.1 * m.done / m.total);
    } else if (m.t === 'sw-update') {
      // er is net een nieuwe versie klaargezet
      showUpdate();
      if (!onMenu()) game.ui.toast('Er is een nieuwe versie van het spel. Die start de volgende keer.', 'good');
    } else if (m.t === 'sw-status') {
      sayOffline(m.files ? 'Zonder server spelen: klaar ✔' : 'Zonder server spelen: nog niet klaar');
      sayVersion(m.version);
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
