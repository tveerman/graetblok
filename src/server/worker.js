// Startpunt van de ingebouwde server: draait in een Web Worker.
// Berichten gaan via postMessage, net zoals ze later via een WebSocket naar een
// echte server op een andere computer kunnen gaan.
import { GameServer } from './server.js';
import { openStorage } from './storage.js';

const conn = {
  send(msg, transfer) { self.postMessage(msg, transfer || []); },
  onmessage: null,
};

const pending = [];
let server = null;

self.onmessage = (ev) => {
  if (server && conn.onmessage) conn.onmessage(ev.data);
  else pending.push(ev.data);
};

(async () => {
  // Met ?save=naam in het adres van het spel speel je in een aparte, losse wereld (handig om
  // iets uit te proberen zonder je echte wereld te veranderen).
  const save = (new URLSearchParams(self.location.search).get('save') || '').replace(/[^a-z0-9]/gi, '').slice(0, 20);
  const storage = await openStorage('graet-blok' + (save ? '-' + save : ''));
  const s = new GameServer(storage);
  await s.init();
  s.connect(conn);
  server = s;
  for (const m of pending) conn.onmessage(m);
  pending.length = 0;
  self.postMessage({ t: 'serverReady' });
})();
