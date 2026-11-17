// Geheimen, puzzels en uitdagingen.
// secretGen: de kleine plekken in de wereld (wachttoren, heggendoolhof, tempel) - hoort bij de wereldbouwer.
// secretMethods: schakelaars, drukplaten, geheime deuren, valvloeren, de codedeur en de puzzels - hoort bij de server.
import { CH, SEA, lerp, smoothstep } from '../shared/constants.js';
import { hash2, mulberry32 } from '../shared/noise.js';
import { B } from '../shared/blocks.js';
import { PAL, J_OFF, SITE_CELL } from './sites.js';

// ---------- kleine plekken ----------
// Ze liggen in een fijner raster dan de dorpen en kastelen (vakken van 112 blokken) en komen
// alleen waar geen groot bouwwerk en geen spoor ligt.
export const SMALL_CELL = 112;
const SMALL_R = { wachttoren: [6, 12], doolhof: [18, 25], tempel: [19, 27] };
const SMALL_NAMES = { wachttoren: 'een wachttoren', doolhof: 'het Heggendoolhof', tempel: 'de Vergeten Tempel' };
// de tempel: waar de vier puzzelkamers zitten (x van het midden van de kamer) en welke puzzel erin zit
export const TEMPLE_ROOMS = [[-13, 'kleur'], [-7, 'licht'], [7, 'muziek'], [13, 'schuif']];
const TZ = -8;                 // de tempel ligt iets naar het noorden geschoven ten opzichte van zijn middelpunt

export const secretGen = {

  smallAt(qx, qz) {
    const cache = this.smallCache || (this.smallCache = new Map());
    const key = (qx + 32768) * 65536 + (qz + 32768);
    let s = cache.get(key);
    if (s === undefined) { s = this.makeSmall(qx, qz); cache.set(key, s); }
    return s;
  },

  makeSmall(qx, qz) {
    if (this.world !== 'groen' || this.noSmall.has(qx + ',' + qz)) return null;
    const sd = this.seed + 5200, h = hash2(qx, qz, sd);
    const kind = h < 0.07 ? 'wachttoren' : h < 0.21 ? 'doolhof' : h < 0.35 ? 'tempel' : null;
    if (!kind) return null;
    const [r0, r1] = SMALL_R[kind], m = r1 + 2;
    const x = Math.floor(qx * SMALL_CELL + m + hash2(qx, qz, sd + 1) * (SMALL_CELL - 2 * m));
    const z = Math.floor(qz * SMALL_CELL + m + hash2(qx, qz, sd + 2) * (SMALL_CELL - 2 * m));
    if (Math.hypot(x, z) < 90) return null;                          // niet vlak bij het ruimteschip
    // helemaal binnen één groot vak, een eindje van de rand (langs de randen kan spoor liggen)
    const rx = Math.floor(x / SITE_CELL), rz = Math.floor(z / SITE_CELL), e = r1 + 6;
    if (Math.floor((x - e) / SITE_CELL) !== rx || Math.floor((x + e) / SITE_CELL) !== rx || Math.floor((z - e) / SITE_CELL) !== rz || Math.floor((z + e) / SITE_CELL) !== rz) return null;
    const main = this.siteAt(rx, rz);
    if (main) {
      const d = main.sq ? Math.max(Math.abs(x - main.x), Math.abs(z - main.z)) : Math.hypot(x - main.x, z - main.z);
      if (d < main.r1 + r1 + 6) return null;
      // het spoor van een dorp loopt vanaf het station naar het oosten en naar het zuiden
      if (main.kind === 'dorp' && (Math.abs(z - (main.z + J_OFF)) < r1 + 5 || Math.abs(x - (main.x + J_OFF)) < r1 + 5)) return null;
    } else {
      // een spoor dat dit lege vak oversteekt, van het dorp links naar het dorp rechts
      const west = this.siteAt(rx - 1, rz);
      if (west && west.kind === 'dorp' && Math.abs(z - (west.z + J_OFF)) < r1 + 5) return null;
    }
    const T = this.tree;
    if (Math.hypot(x - T.x, z - T.z) < r1 + 80) return null;
    // vlak, droog land?
    let sum = 0, n = 0, min = 999, max = 0, ok = true;
    this.raw = true;
    try {
      for (let a = -1; a < 8 && ok; a++) {
        const rad = a < 0 ? 0 : r0;
        const c = this.col(Math.round(x + Math.cos(a * 0.7854) * rad), Math.round(z + Math.sin(a * 0.7854) * rad));
        if (c.liq || c.h < SEA + 2 || c.h > SEA + 30) { ok = false; break; }
        sum += c.h; n++; if (c.h < min) min = c.h; if (c.h > max) max = c.h;
      }
    } finally { this.raw = false; }
    if (!ok || max - min > 10) return null;
    const seed = (hash2(qx, qz, sd + 7) * 4294967296) >>> 0;
    return { kind, small: true, x, y: Math.round(sum / n), z, r0, r1, key: 'k' + qx + ',' + qz, seed, name: SMALL_NAMES[kind] };
  },

  // de grond rond een kleine plek vlak maken (aangeroepen voor elke kolom, net als applySite)
  applySmall(x, z, c) {
    const s = this.smallAt(Math.floor(x / SMALL_CELL), Math.floor(z / SMALL_CELL));
    if (!s) return;
    const d = Math.hypot(x - s.x, z - s.z);
    if (d >= s.r1) return;
    const P = PAL[this.world];
    c.h = lerp(s.y, c.h, smoothstep(s.r0, s.r1, d));
    c.ent = 0;
    if (c.liq && Math.floor(c.h) >= c.ly) { c.liq = 0; c.top = P.land; c.under = P.under; }
    if (d < s.r0 + 3) { c.tp = 0; c.nc = 1; c.liq = 0; c.top = P.land; c.under = P.under; }
    if (d < s.r0) c.vg = 0;
  },

  smallNear(x, z, r) {
    const out = [];
    if (this.world !== 'groen') return out;
    const x0 = Math.floor((x - r) / SMALL_CELL), x1 = Math.floor((x + r) / SMALL_CELL), z0 = Math.floor((z - r) / SMALL_CELL), z1 = Math.floor((z + r) / SMALL_CELL);
    for (let qx = x0; qx <= x1; qx++) for (let qz = z0; qz <= z1; qz++) {
      const s = this.smallAt(qx, qz);
      if (s && Math.hypot(s.x - x, s.z - z) <= r) out.push(s);
    }
    return out;
  },

  drawSmallSites(S) {
    if (this.world !== 'groen') return;
    for (let qx = Math.floor((S.ox - 30) / SMALL_CELL); qx <= Math.floor((S.ox + 45) / SMALL_CELL); qx++) {
      for (let qz = Math.floor((S.oz - 30) / SMALL_CELL); qz <= Math.floor((S.oz + 45) / SMALL_CELL); qz++) {
        const s = this.smallAt(qx, qz);
        if (!s || !S.hit(s.x - s.r0, s.z - s.r0, s.x + s.r0, s.z + s.r0)) continue;
        if (s.kind === 'wachttoren') this.drawTower(S, s); else if (s.kind === 'doolhof') this.drawMaze(S, s); else this.drawTemple(S, s);
      }
    }
  },

  // Een stenen toren met een wenteltrap langs de binnenmuur. Boven staat de uitkijkpost.
  drawTower(S, s) {
    const x = s.x, y = s.y, z = s.z, top = Math.min(16, CH - 8 - y);
    S.fill(x - 3, y, z - 3, x + 3, y, z + 3, B.steenblok);
    S.fill(x - 3, y + 1, z - 3, x + 3, y + top + 1, z + 3, B.steenblok);
    S.fill(x - 2, y + 1, z - 2, x + 2, y + top + 3, z + 2, 0);
    S.fill(x, y + 1, z + 3, x, y + 2, z + 3, 0);                                   // de deur (zuidkant)
    const ring = [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [2, -1], [2, -2], [1, -2], [0, -2], [-1, -2], [-2, -2], [-2, -1], [-2, 0], [-2, 1], [-2, 2], [-1, 2]];
    for (let k = 1; k < 16 && k < top; k++) S.fill(x + ring[k][0], y + 1, z + ring[k][1], x + ring[k][0], y + k, z + ring[k][1], B.steenblok);
    S.fill(x, y + 1, z, x, y + top, z, B.steenblok);                               // de spil in het midden
    // de vloer bovenin, met een gat waar de trap bovenkomt
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const k = ring.findIndex((q) => q[0] === dx && q[1] === dz);
      if (k >= 13) continue;
      S.set(x + dx, y + top, z + dz, B.steenblok);
    }
    S.set(x, y + top + 1, z, B.kijker);
    for (let d = -3; d <= 3; d++) for (const [ax, az] of [[d, -3], [d, 3], [-3, d], [3, d]]) if ((d & 1) === 0) S.set(x + ax, y + top + 2, z + az, B.steenblok);      // kantelen
    for (const [cx, cz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) S.set(x + cx, y + top + 3, z + cz, B.lantaarn);
    for (const k of [5, 10]) if (k < top) { S.set(x + 3, y + k + 2, z, B.glas); S.set(x - 3, y + k + 3, z, B.glas); }
  },

  // het doolhof: 8 bij 8 vakken met heggen ertussen. Geeft een raster van 33 bij 33 terug (1 = heg).
  mazePlan(s) {
    if (s.plan) return s.plan;
    const N = 8, W = N * 4 + 1, g = new Uint8Array(W * W), rnd = mulberry32(s.seed);
    for (let i = 0; i < W; i++) for (let j = 0; j < W; j++) if (i % 4 === 0 || j % 4 === 0) g[i + j * W] = 1;
    const seen = new Uint8Array(N * N), stack = [[3, 7]];
    seen[3 + 7 * N] = 1;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => cx + dx >= 0 && cx + dx < N && cy + dy >= 0 && cy + dy < N && !seen[cx + dx + (cy + dy) * N]);
      if (!opts.length) { stack.pop(); continue; }
      const [dx, dy] = opts[Math.floor(rnd() * opts.length)];
      // de heg tussen de twee vakken weghalen
      for (let k = 1; k <= 3; k++) {
        const i = dx ? 4 * (cx + (dx > 0 ? 1 : 0)) : 4 * cx + k, j = dy ? 4 * (cy + (dy > 0 ? 1 : 0)) : 4 * cy + k;
        g[i + j * W] = 0;
      }
      seen[cx + dx + (cy + dy) * N] = 1;
      stack.push([cx + dx, cy + dy]);
    }
    for (let k = 1; k <= 3; k++) g[(4 * 3 + k) + (W - 1) * W] = 0;                   // de ingang aan de zuidkant
    s.plan = { g, W };
    return s.plan;
  },

  drawMaze(S, s) {
    const { g, W } = this.mazePlan(s), x0 = s.x - 16, z0 = s.z - 16, y = s.y;
    for (let i = 0; i < W; i++) for (let j = 0; j < W; j++) {
      const wx = x0 + i, wz = z0 + j;
      S.fill(wx, y + 1, wz, wx, y + 6, wz, 0);
      if (g[i + j * W]) S.fill(wx, y + 1, wz, wx, y + 3, wz, B.blad_eik);
    }
    // de schat in het midden
    S.set(s.x + 2, y + 1, s.z + 2, B.schatkist);
    S.set(s.x + 1, y + 1, s.z + 3, B.lantaarn); S.set(s.x + 3, y + 1, s.z + 1, B.lantaarn);
    for (const gx of [-5, 1]) { S.fill(s.x + gx, y + 1, s.z + 17, s.x + gx, y + 3, s.z + 17, B.stam_eik); S.set(s.x + gx, y + 4, s.z + 17, B.lantaarn); }
  },

  // De tempel: een hal aan de voorkant, vier puzzelkamers en in het midden de schatkamer
  // achter de tempeldeur. De schatkamer is van tempelsteen: daar kom je niet doorheen.
  drawTemple(S, s) {
    const X = s.x, y = s.y, Z = s.z + TZ, M = B.marmer;
    if (!S.hit(X - 18, Z - 1, X + 18, Z + 19)) return;
    S.fill(X - 16, y, Z + 1, X + 16, y, Z + 16, M);
    S.fill(X - 16, y + 1, Z + 1, X + 16, y + 4, Z + 16, M);
    S.fill(X - 16, y + 5, Z + 1, X + 16, y + 5, Z + 16, B.steenblok);
    S.fill(X - 15, y + 1, Z + 12, X + 15, y + 4, Z + 15, 0);                          // de hal
    S.fill(X - 1, y + 1, Z + 16, X + 1, y + 3, Z + 16, 0);                            // de ingang
    for (const px of [-3, 3]) { S.fill(X + px, y + 1, Z + 17, X + px, y + 4, Z + 17, B.marmerzuil); S.set(X + px, y + 5, Z + 17, B.goudblok); }
    S.fill(X - 3, y, Z + 17, X + 3, y, Z + 18, M);
    for (const lx of [-12, -6, 6, 12]) S.set(X + lx, y + 5, Z + 13, B.lamp);
    for (const [cx, cz] of [[-16, 1], [16, 1], [-16, 16], [16, 16]]) S.set(X + cx, y + 6, Z + cz, B.goudblok);
    // de schatkamer
    S.fill(X - 4, y, Z + 1, X + 4, y + 5, Z + 11, B.tempelsteen);
    S.fill(X - 3, y + 1, Z + 2, X + 3, y + 4, Z + 10, 0);
    S.fill(X, y + 1, Z + 11, X, y + 2, Z + 11, B.tempeldeur);
    S.set(X - 2, y + 1, Z + 3, B.schatkist); S.set(X + 2, y + 1, Z + 3, B.schatkist);
    S.set(X, y + 1, Z + 3, B.goudblok); S.set(X, y + 2, Z + 3, B.lamp);
    for (const gx of [-3, 3]) S.fill(X + gx, y + 1, Z + 6, X + gx, y + 1, Z + 8, B.goudblok);
    // de vier kamers
    TEMPLE_ROOMS.forEach(([cx, soort]) => {
      const x = X + cx;
      S.fill(x - 2, y + 1, Z + 2, x + 2, y + 4, Z + 10, 0);
      S.fill(x, y + 1, Z + 11, x, y + 2, Z + 11, 0);                                  // het deurtje naar de hal
      S.set(x, y + 1, Z + 2, B.puzzelsteen);
      S.set(x, y + 5, Z + 6, B.lamp);
      if (soort === 'licht') {
        // een strook valvloer boven een kuil
        S.fill(x - 2, y - 1, Z + 6, x + 2, y, Z + 6, 0);
        S.fill(x - 2, y, Z + 6, x + 2, y, Z + 6, B.valvloer);
      } else if (soort === 'muziek') {
        // een stenen deur die alleen open is zolang de drukplaat net is ingedrukt
        S.fill(x - 2, y + 1, Z + 5, x + 2, y + 4, Z + 5, M);
        S.fill(x, y + 1, Z + 5, x, y + 2, Z + 5, B.deur_steen);
        S.set(x + 2, y + 1, Z + 9, B.drukplaat); S.set(x - 2, y + 1, Z + 3, B.drukplaat);      // (ook één aan de binnenkant, om er weer uit te komen)
      } else if (soort === 'schuif') {
        // een codedeur met drie gekleurde knoppen; de volgorde staat op het raadselbord in de hal
        S.fill(x - 2, y + 1, Z + 5, x + 2, y + 4, Z + 5, M);
        S.fill(x, y + 1, Z + 5, x, y + 2, Z + 5, B.codedeur);
        S.set(x - 3, y + 2, Z + 7, B.knop_rood); S.set(x - 3, y + 2, Z + 8, B.knop_geel); S.set(x - 3, y + 2, Z + 9, B.knop_blauw);
      }
    });
    S.set(X - 16, y + 2, Z + 13, B.raadselbord);
  },
};

// ---------- schakelaars, deuren, valvloeren en puzzels (server) ----------

const OPEN_OF = { [B.deur_boekenkast]: B.deur_boekenkast_open, [B.deur_steen]: B.deur_steen_open, [B.deur_schilderij]: B.deur_schilderij_open };
const CLOSED_OF = { [B.deur_boekenkast_open]: B.deur_boekenkast, [B.deur_steen_open]: B.deur_steen, [B.deur_schilderij_open]: B.deur_schilderij };
const KNOP = { [B.knop_rood]: 'rood', [B.knop_blauw]: 'blauw', [B.knop_geel]: 'geel' };
const ORDERS = [['rood', 'geel', 'blauw'], ['rood', 'blauw', 'geel'], ['geel', 'rood', 'blauw'], ['geel', 'blauw', 'rood'], ['blauw', 'rood', 'geel'], ['blauw', 'geel', 'rood']];

export const secretMethods = {

  // iets wat straks moet gebeuren (een deur die weer dichtgaat, een valvloer die terugkomt)
  later(sec, fn) { (this.todo || (this.todo = [])).push({ t: this.meta.time + sec, fn }); },
  updateSecrets() {
    const L = this.todo;
    if (!L || !L.length) return;
    for (let i = L.length - 1; i >= 0; i--) if (L[i].t <= this.meta.time) { const f = L[i].fn; L.splice(i, 1); f(); }
  },

  // alle geheime deuren binnen zes blokken open of dicht zetten; geeft terug hoeveel er bewogen
  setDoors(w, x, y, z, open) {
    let n = 0;
    const map = open ? OPEN_OF : CLOSED_OF;
    for (let dx = -6; dx <= 6; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -6; dz <= 6; dz++) {
      const to = map[w.get(x + dx, y + dy, z + dz)];
      if (to === undefined) continue;
      // een deur gaat niet dicht als er iemand in staat
      if (!open && [...this.players.values()].some((q) => q.world === w.id && Math.floor(q.x) === x + dx && Math.floor(q.z) === z + dz && Math.abs(q.y - (y + dy)) < 1.9)) continue;
      this.setBlock(w, x + dx, y + dy, z + dz, to);
      n++;
    }
    return n;
  },

  useSwitch(p, w, x, y, z, id) {
    const on = id === B.schakelaar_uit;
    this.setBlock(w, x, y, z, on ? B.schakelaar_aan : B.schakelaar_uit);
    const n = this.setDoors(w, x, y, z, on);
    this.toast(p, n ? (on ? 'Klik... ergens schuift een geheime deur open!' : 'Klik... de geheime deur gaat weer dicht.') : 'Klik. Er gebeurt niets: er is geen geheime deur binnen zes blokken.');
  },

  // elke keer dat de speler op een ander blok gaat staan: staat hij op een drukplaat of een valvloer?
  footCheck(p) {
    const fx = Math.floor(p.x), fy = Math.floor(p.y + 0.01), fz = Math.floor(p.z);
    const cell = fx + ',' + fy + ',' + fz;
    if (p.footCell === cell) return;
    p.footCell = cell;
    if (p.mount) return;
    const w = this.worlds[p.world];
    for (const y of [fy, fy - 1]) {
      const id = w.get(fx, y, fz);
      if (id === B.drukplaat && y === fy) {
        if (this.setDoors(w, fx, y, fz, true)) {
          this.fx(w.id, 'chest', fx + 0.5, y + 0.2, fz + 0.5);
          this.later(8, () => this.setDoors(w, fx, y, fz, false));
        }
        return;
      }
      if (id === B.valvloer && y === fy - 1) {
        // de hele strook valvloer naast je zakt weg, en komt na een poosje terug
        const cells = [];
        for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (w.get(fx + dx, y, fz + dz) === B.valvloer) cells.push([fx + dx, fz + dz]);
        this.later(0.35, () => { for (const [cx, cz] of cells) if (w.get(cx, y, cz) === B.valvloer) this.setBlock(w, cx, y, cz, 0); });
        this.later(6, () => { for (const [cx, cz] of cells) if (w.get(cx, y, cz) === 0) this.setBlock(w, cx, y, cz, B.valvloer); });
        return;
      }
    }
  },

  // de dichtstbijzijnde codedeur (dicht of open) binnen r blokken
  findCodeDoor(w, x, y, z, r) {
    let best = null, bd = 1e9;
    for (let dx = -r; dx <= r; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -r; dz <= r; dz++) {
      const id = w.get(x + dx, y + dy, z + dz);
      if (id !== B.codedeur && id !== B.codedeur_open) continue;
      const d = Math.abs(dx) + Math.abs(dz) + Math.abs(dy) * 0.1;
      if (d < bd) { bd = d; best = { x: x + dx, y: y + dy, z: z + dz }; }
    }
    return best;
  },
  // de volgorde van de drie knoppen hangt af van waar de deur staat (de onderste van een hoge deur telt)
  codeOrder(w, d) {
    let y = d.y;
    while (w.get(d.x, y - 1, d.z) === B.codedeur || w.get(d.x, y - 1, d.z) === B.codedeur_open) y--;
    return ORDERS[Math.floor(hash2(d.x * 3 + y, d.z, this.meta.seed + 71) * 6) % 6];
  },

  useKnop(p, w, x, y, z, id) {
    const d = this.findCodeDoor(w, x, y, z, 8);
    if (!d) { this.toast(p, 'Klik. Er is geen codedeur binnen acht blokken.'); return; }
    const order = this.codeOrder(w, d), key = w.id + ':' + d.x + ',' + d.z;
    const st = (this.codes || (this.codes = {}))[key] || (this.codes[key] = []);
    st.push(KNOP[id]);
    if (st[st.length - 1] !== order[st.length - 1]) { this.codes[key] = []; this.toast(p, '❌ Bzzt! Dat was de verkeerde knop. Begin opnieuw.', 'warn'); return; }
    if (st.length < 3) { this.toast(p, '✔ ' + st.length + ' van de 3 goed...'); return; }
    this.codes[key] = [];
    const cells = [];
    for (let dx = -2; dx <= 2; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -2; dz <= 2; dz++) if (w.get(d.x + dx, d.y + dy, d.z + dz) === B.codedeur) cells.push([d.x + dx, d.y + dy, d.z + dz]);
    for (const [cx, cy, cz] of cells) this.setBlock(w, cx, cy, cz, B.codedeur_open);
    this.fx(w.id, 'chest', d.x + 0.5, d.y + 1, d.z + 0.5);
    this.toast(p, '🔓 De goede volgorde! De codedeur staat een minuut open.', 'good');
    this.later(60, () => { for (const [cx, cy, cz] of cells) if (w.get(cx, cy, cz) === B.codedeur_open) this.setBlock(w, cx, cy, cz, B.codedeur); });
  },

  useRiddle(p, w, x, y, z) {
    const d = this.findCodeDoor(w, x, y, z, 40);
    if (!d) { this.send(p, { t: 'dialog', title: 'Raadselbord', lines: ['Het bord is leeg.', 'Staat er een codedeur binnen 40 blokken, dan staat hier in welke volgorde je de drie knoppen moet indrukken.'] }); return; }
    const o = this.codeOrder(w, d);
    this.send(p, { t: 'dialog', title: 'Raadselbord', lines: ['Op het bord staat in sierlijke letters:', '"Wie de deur wil openen, drukt eerst op ' + o[0].toUpperCase() + ', dan op ' + o[1].toUpperCase() + ' en als laatste op ' + o[2].toUpperCase() + '."'] });
  },

  // ---------- de tempel ----------

  templeAt(w, x, z) {
    const s = w.gen.smallAt(Math.floor(x / SMALL_CELL), Math.floor(z / SMALL_CELL));
    return s && s.kind === 'tempel' ? s : null;
  },
  templeCode(s) { return [0, 1, 2, 3].map((i) => 1 + Math.floor(hash2(i, 5, s.seed) * 9) % 9); },

  usePuzzle(p, w, x, y, z) {
    const s = this.templeAt(w, x, z);
    if (!s) { this.toast(p, 'De steen gloeit zwak. Hier gebeurt niets.'); return; }
    let room = 0, bd = 1e9;
    TEMPLE_ROOMS.forEach(([cx], i) => { const d = Math.abs(x - (s.x + cx)); if (d < bd) { bd = d; room = i; } });
    const done = (p.flags.tempel || (p.flags.tempel = {}))[s.key] || 0;
    if (done & (1 << room)) { this.toast(p, 'Deze puzzel heb je al opgelost. Het cijfer van kamer ' + (room + 1) + ' is ' + this.templeCode(s)[room] + '.', 'good'); return; }
    p.puzzel = { key: s.key, room, x: s.x, z: s.z };
    this.send(p, { t: 'puzzel', soort: TEMPLE_ROOMS[room][1], kamer: room + 1 });
  },

  on_puzzel(p, m) {
    const q = p.puzzel;
    if (!q || !m.ok || Math.hypot(p.x - q.x, p.z - q.z) > 40) return;
    p.puzzel = null;
    const w = this.worlds[p.world], s = this.templeAt(w, q.x, q.z);
    if (!s || s.key !== q.key) return;
    const T = p.flags.tempel || (p.flags.tempel = {});
    T[s.key] = (T[s.key] || 0) | (1 << q.room);
    this.addXp(p, 15);
    this.send(p, { t: 'dialog', title: '🧩 Puzzel opgelost!', lines: ['De steen licht op en er verschijnt een cijfer:', 'Kamer ' + (q.room + 1) + ' = ' + this.templeCode(s)[q.room], T[s.key] === 15 ? 'Je hebt alle vier de cijfers! Tik op de gouden tempeldeur en toets ze in, van kamer 1 tot en met 4.' : 'Onthoud het goed. Voor de tempeldeur heb je de cijfers van alle vier de kamers nodig.'] });
  },

  useTempleDoor(p, w, x, y, z) {
    const s = this.templeAt(w, x, z);
    if (!s) return;
    const done = (p.flags.tempel || {})[s.key] || 0;
    p.puzzel = { key: s.key, room: -1, x: s.x, z: s.z, dx: x, dy: y, dz: z };
    this.send(p, { t: 'code', hint: done === 15 ? 'Toets de vier cijfers in, van kamer 1 tot en met 4.' : 'De deur vraagt om vier cijfers. Los de puzzels in de vier kamers op: elke kamer geeft één cijfer.' });
  },

  on_code(p, m) {
    const q = p.puzzel;
    if (!q || q.room !== -1) return;
    p.puzzel = null;
    const w = this.worlds[p.world], s = this.templeAt(w, q.x, q.z);
    if (!s || Math.hypot(p.x - q.dx, p.z - q.dz) > 10) return;
    if (String(m.code || '').replace(/\D/g, '') !== this.templeCode(s).join('')) { this.toast(p, '❌ De deur blijft dicht. Dat is niet de goede code.', 'warn'); return; }
    for (let dy = -2; dy <= 2; dy++) if (w.get(q.dx, q.dy + dy, q.dz) === B.tempeldeur) this.setBlock(w, q.dx, q.dy + dy, q.dz, B.tempeldeur_open);
    this.fx(w.id, 'chest', q.dx + 0.5, q.dy + 1, q.dz + 0.5);
    this.addXp(p, 60);
    this.toast(p, '🏛️ De tempeldeur schuift open! De schat van de Vergeten Tempel is van jou.', 'rank');
  },

  // de uitkijkpost op een wachttoren: je ziet daarna ver in het rond op je kompas
  useLookout(p, w, x, z) {
    const before = (p.flags.toren || {}).x;
    p.flags.toren = { w: p.world, x, z };
    const n = w.gen.sitesNear(x, z, 1400).length + w.gen.smallNear(x, z, 1400).length;
    if (before !== x) this.addXp(p, 10);
    this.sendSites(p);
    this.toast(p, '🔭 Wat een uitzicht! Je ziet ' + n + ' plekken in de verre omtrek. De dichtstbijzijnde van elke soort staan nu op je kompas.', 'good');
  },
};
