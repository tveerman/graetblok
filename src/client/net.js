// Verbinding tussen het spel en de server.
// Nu: de ingebouwde server in een Web Worker (of, als dat niet lukt, in dezelfde pagina).
// Later: vervang dit door een WebSocket naar een echte server; de berichten blijven gelijk.

export function connect(onMessage) {
  return new Promise((resolve) => {
    let settled = false;
    const api = { send: null, mode: '' };

    const startLocal = async () => {
      if (settled) return;
      settled = true;
      console.warn('Web Worker werkt niet; de server draait nu in de pagina zelf.');
      const [{ GameServer }, { openStorage }] = await Promise.all([import('../server/server.js'), import('../server/storage.js')]);
      const storage = await openStorage('graet-blok');
      const server = new GameServer(storage);
      await server.init();
      const conn = { send: (m) => setTimeout(() => onMessage(m), 0), onmessage: null };
      server.connect(conn);
      api.send = (m) => setTimeout(() => conn.onmessage(m), 0);
      api.mode = 'lokaal';
      resolve(api);
    };

    try {
      const worker = new Worker(new URL('../server/worker.js', import.meta.url), { type: 'module' });
      const timer = setTimeout(() => { if (!settled) { worker.terminate(); startLocal(); } }, 12000);
      worker.onerror = (e) => {
        if (!settled) { clearTimeout(timer); worker.terminate(); startLocal(); }
        else console.error('server fout', e.message || e);
      };
      worker.onmessage = (ev) => {
        const m = ev.data;
        if (m.t === 'serverReady') {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          api.send = (msg) => worker.postMessage(msg);
          api.mode = 'worker';
          resolve(api);
          return;
        }
        onMessage(m);
      };
    } catch (e) {
      startLocal();
    }
  });
}
