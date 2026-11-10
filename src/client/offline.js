// Offline spelen: zet de service worker (sw.js) aan, zodat het spel ook start
// als de server uit staat. Werkt alleen via https of op localhost.
// Met ?debug of ?nosw in het adres staat het uit (handig bij het programmeren).

export function setupOffline(game) {
  const el = document.getElementById('offlineStatus');
  const say = (text) => { if (el) el.textContent = text; };
  const sw = navigator.serviceWorker;

  if (!sw) {
    say(window.isSecureContext ? 'Zonder server spelen: kan niet in deze browser' : 'Zonder server spelen: uit (kan alleen via https)');
    return;
  }

  if (/[?&](debug|nosw)\b/.test(location.search)) {
    say('Zonder server spelen: uit (ontwikkelaarsmodus)');
    sw.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister()))).then((done) => {
      // deze pagina kwam nog uit de opslag: opnieuw laden, nu rechtstreeks van de server
      if (done.length && sw.controller) location.reload();
    }).catch(() => {});
    return;
  }

  sw.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.t === 'sw-update') {
      // Er staat een nieuwe versie klaar. In het hoofdmenu kunnen we die meteen laden.
      if (game.state === 'menu') location.reload();
      else game.ui.toast('Er is een nieuwe versie van het spel. Die start de volgende keer.', 'good');
    } else if (m.t === 'sw-status') {
      say(m.files ? 'Zonder server spelen: klaar ✔' : 'Zonder server spelen: nog niet klaar');
    }
  });

  say('Zonder server spelen: bezig met opslaan...');
  sw.register('sw.js').then(() => sw.ready).then((reg) => {
    if (reg.active) reg.active.postMessage({ t: 'sw-status?' });
  }).catch((err) => {
    say('Zonder server spelen: lukt niet (' + (err && err.message ? err.message : 'fout') + ')');
  });
}
