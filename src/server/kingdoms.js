// Landen en koninkrijken op de server: in welk rijk je bent, de missies van de vorst en de
// titels die je ermee verdient, het toernooi, de kwartiermeester en je eigen kasteel dat
// groeit van woontoren tot paleis. (De lijsten staan in shared/kingdoms.js.)
import { B, BLOCKS } from '../shared/blocks.js';
import { I } from '../shared/items.js';
import { kingdomAt, ROYAL, RANG0, VLAG_KLEUREN, KASTEEL_LEVELS, kasteelPrijs } from '../shared/kingdoms.js';

export const kingdomMethods = {

  // het koninkrijk waar de speler nu is (alleen de groene wereld heeft koninkrijken)
  kingdomOf(p) { return p.world === 'groen' ? kingdomAt(p.x, p.z, this.meta.seed) : null; },
  rijkRec(p, K) { const all = p.flags.rijk || (p.flags.rijk = {}); return all[K.key] || (all[K.key] = { stap: 0, n: 0, dorpen: {} }); },
  // je hoogste titel, in welk rijk dan ook (0 = nog geen)
  royalRank(p) { let r = 0; for (const k in p.flags.rijk || {}) r = Math.max(r, p.flags.rijk[k].stap); return r; },
  royalTitle(p) { const r = this.royalRank(p); return r ? ROYAL[r - 1].titel : RANG0; },

  // elke seconde: een ander koninkrijk binnengelopen?
  updateKingdom(p) {
    const K = this.kingdomOf(p), key = K ? K.key : '';
    if (key === (p.rijkNu || '')) return;
    p.rijkNu = key;
    if (!K) return;
    const R = this.rijkRec(p, K);
    this.toast(p, '👑 Het koninkrijk ' + K.name + ' van ' + K.vorst + '. De vlag is ' + VLAG_KLEUREN[K.vlag[0]][1] + ' met ' + VLAG_KLEUREN[K.vlag[1]][1] + '.' + (R.stap ? ' Jij bent hier ' + ROYAL[R.stap - 1].titel + '.' : ''), 'good');
  },

  // Er is iets gebeurd dat voor de missie van de vorst kan tellen. Het telt alleen in het rijk
  // waar je op dat moment bent. extra = de sleutel van een dorp (elk dorp telt één keer).
  royalEvent(p, soort, extra) {
    const K = this.kingdomOf(p);
    if (!K) return;
    const R = this.rijkRec(p, K), M = ROYAL[R.stap];
    if (!M || M.soort !== soort) return;
    if (soort === 'dorp') { if (R.dorpen[extra]) return; R.dorpen[extra] = 1; }
    R.n++;
    if (R.n < M.n) return;
    R.stap++; R.n = 0;
    this.giveLoot(p, I.munt, M.munten, true);
    this.addXp(p, 30);
    const lines = [K.vorst[0].toUpperCase() + K.vorst.slice(1) + ' is trots op je.', 'Je bent nu ' + M.titel + ' van ' + K.name + ' en krijgt ' + M.munten + ' munten.'];
    if (M.titel === 'Ridder') lines.push('Als ridder mag je bij de kwartiermeester op de binnenplaats legervoertuigen kopen: een tank, een legerhelikopter en een onderzeeër.');
    if (M.titel === 'Hertog') { this.giveLoot(p, I.kasteelbrief, 1); lines.push('Je krijgt een Kasteelbrief: gebruik hem op een vlak stuk land en daar verrijst je eigen kasteel. Met munten laat je het groeien tot een paleis.'); }
    else lines.push('Praat weer met de vorst voor je volgende opdracht.');
    this.send(p, { t: 'dialog', title: '👑 ' + M.titel + ' van ' + K.name + '!', lines });
    this.sendInv(p);
  },

  // wat de vorst zegt als je hem aantikt
  royalSays(p) {
    const K = this.kingdomOf(p);
    if (!K) return '';
    const R = this.rijkRec(p, K), M = ROYAL[R.stap];
    const wie = 'Ik ben ' + K.vorst + ' van ' + K.name + '. ';
    if (!M) return wie + 'Je bent Hertog van mijn rijk: hoger kan niet. Bedankt voor alles, ' + (p.flags.familie || 'held') + '!';
    return wie + (R.stap ? 'Welkom terug, ' + ROYAL[R.stap - 1].titel + '. ' : '') + 'Mijn opdracht voor jou: ' + M.tekst.replace('{n}', M.n) + (M.n > 1 ? ' (' + R.n + ' van de ' + M.n + ')' : '') + '. Dan maak ik je ' + M.titel + ' en krijg je ' + M.munten + ' munten.';
  },

  // het toernooi: de uitslag van het steekspel of het boogschieten
  tournamentResult(p, game, score) {
    const win = score >= 0.6, munten = score >= 0.9 ? 12 : win ? 6 : score >= 0.3 ? 2 : 0;
    if (munten) this.giveLoot(p, I.munt, munten, true);
    this.addXp(p, 4 + Math.round(score * 8));
    this.send(p, { t: 'kermisPrijs', game, id: munten ? I.munt : 0, n: munten, tekst: score >= 0.9 ? 'Een schitterende overwinning! Het publiek juicht.' : win ? 'Gewonnen! Goed gedaan.' : munten ? 'Net niet gewonnen, maar wel een troostprijs.' : 'Verloren. Probeer het nog eens!', munten: this.count(p, I.munt) });
    this.sendInv(p);
    if (win) this.royalEvent(p, game);
  },

  // ---------- je eigen kasteel ----------

  // alle blokken van een kasteel van dit level, gemeten vanaf het midden van de woontoren op de
  // grond: [dx, dy, dz, blok]. Blok 0 = hier moet lucht zijn (binnenruimte, deur, poort).
  castleBlocks(level, vlag) {
    const out = [], M = B.kasteelmuur, T = B.steenblok;
    const put = (x, y, z, id) => out.push([x, y, z, id]);
    const ring = (h, y0, y1, id, cx = 0, cz = 0) => { for (let y = y0; y <= y1; y++) for (let d = -h; d <= h; d++) { put(cx + d, y, cz - h, id); put(cx + d, y, cz + h, id); if (Math.abs(d) < h) { put(cx - h, y, cz + d, id); put(cx + h, y, cz + d, id); } } };
    const vloer = (h, y, id, cx = 0, cz = 0) => { for (let x = -h; x <= h; x++) for (let z = -h; z <= h; z++) put(cx + x, y, cz + z, id); };
    const kantelen = (h, y, id, cx = 0, cz = 0) => { for (let d = -h; d <= h; d += 2) { put(cx + d, y, cz - h, id); put(cx + d, y, cz + h, id); put(cx - h, y, cz + d, id); put(cx + h, y, cz + d, id); } };
    const punt = (h, y, cx, cz) => { for (let k = 0; k <= h; k++) vloer(h - k, y + k, B.dakpan, cx, cz); };
    // de woontoren
    const kh = level >= 8 ? 14 : level >= 2 ? 9 : 5;
    vloer(3, 0, T);
    for (let y = 1; y <= kh; y++) vloer(2, y, 0);
    ring(3, 1, kh, M);
    vloer(3, kh + 1, T);
    if (level >= 2) kantelen(3, kh + 2, M);
    if (level >= 8) punt(2, kh + 2, 0, 0);
    for (let y = 1; y <= 2; y++) put(0, y, 3, 0);                                      // de deur (zuidkant)
    for (const [x, y, z] of [[3, 3, 0], [-3, 3, 0], [0, 3, -3], [3, 7, 0], [-3, 7, 0], [0, 7, 3]]) if (y < kh) put(x, y, z, B.glas);
    put(0, kh, 0, B.lamp);
    // de vlag van je familie, boven op de toren
    const top = kh + (level >= 8 ? 5 : 2);
    for (let y = 0; y < 5; y++) put(0, top + y, 0, B.stam_eik);
    const groot = level >= 10 ? 4 : 3;
    for (let k = 1; k <= groot; k++) { put(k, top + 4, 0, VLAG_KLEUREN[vlag[0]][0]); put(k, top + 3, 0, VLAG_KLEUREN[vlag[1]][0]); }
    // de ringmuur met de poort
    if (level >= 3) {
      const wh = level >= 6 ? 6 : 4;
      ring(10, 1, wh, M);
      if (level >= 6) kantelen(10, wh + 1, M);
      for (let x = -1; x <= 1; x++) for (let y = 1; y <= 3; y++) put(x, y, 10, 0);
      if (level >= 4) for (const cx of [-10, 10]) for (const cz of [-10, 10]) {
        ring(2, 1, wh + 4, M, cx, cz); vloer(2, wh + 5, T, cx, cz); kantelen(2, wh + 6, M, cx, cz);
        if (level >= 9) punt(2, wh + 6, cx, cz);
        if (level >= 10) put(cx, wh + (level >= 9 ? 9 : 7), cz, B.goudblok);
      }
      if (level >= 5) {
        for (let d = -6; d <= 6; d += 4) { put(d, wh + 1, -10, B.lantaarn); put(-10, wh + 1, d, B.lantaarn); put(10, wh + 1, d, B.lantaarn); }
        for (const x of [-3, 3]) for (let y = 2; y <= wh; y++) put(x, y, 11, VLAG_KLEUREN[vlag[y & 1]][0]);        // banieren naast de poort
      }
      if (level >= 7) {
        for (const cx of [-3, 3]) { ring(1, 1, wh + 3, M, cx, 10); vloer(1, wh + 4, T, cx, 10); put(cx, wh + 5, 10, B.lantaarn); }
        for (let x = -2; x <= 2; x++) for (let y = 4; y <= wh + 2; y++) put(x, y, 10, M);
      }
    }
    if (level >= 10) { kantelen(3, kh + 1, B.goudblok); for (let x = -1; x <= 1; x++) put(x, 4, 10, B.goudblok); }
    put(0, 1, -2, B.kasteelsteen);
    return out;
  },

  buildCastle(w, C) {
    // (wat later in de lijst staat wint: eerst de ruimte, dan de muren, dan de deur)
    const cellen = new Map();
    for (const [dx, dy, dz, id] of this.castleBlocks(C.level, C.vlag)) cellen.set(dx + ',' + dy + ',' + dz, [C.x + dx, C.y + dy, C.z + dz, id]);
    for (const [x, y, z, id] of cellen.values()) if (w.get(x, y, z) !== id) this.setBlock(w, x, y, z, id);
  },

  castles() { return this.meta.kastelen || (this.meta.kastelen = {}); },

  // de kasteelbrief gebruiken: hier komt je kasteel
  placeCastle(p, w, x, y, z) {
    const all = this.castles();
    if (all[p.name]) { this.toast(p, 'Je hebt al een kasteel. Tik daar op de kasteelsteen om het te laten groeien of te verhuizen.', 'warn'); return false; }
    if (w.id !== 'groen') { this.toast(p, 'Een kasteel bouw je in de Groene wereld.', 'warn'); return false; }
    for (const s of w.gen.sitesNear(x, z, 140)) if (Math.hypot(s.x - x, s.z - z) < s.r1 + 16) { this.toast(p, 'Hier is het te dicht bij ' + (s.name || 'een bouwwerk') + '. Zoek een vrij stuk land.', 'warn'); return false; }
    const gy = y - 1;
    if (w.liquid(x, y, z) || w.liquid(x, gy, z)) { this.toast(p, 'Een kasteel bouw je op het droge, niet in het water.', 'warn'); return false; }
    if (!w.solid(x, gy, z)) { this.toast(p, 'Wijs een stuk vaste grond aan.', 'warn'); return false; }
    const C = all[p.name] = { w: w.id, x, y: gy, z, level: 1, vlag: [0, 2], naam: p.flags.familie || '' };
    this.buildCastle(w, C);
    this.toast(p, '🏰 Je eigen kasteel! Het begint als een woontoren. Tik binnen op de kasteelsteen om het te laten groeien.', 'rank');
    return true;
  },

  sendCastle(p) {
    const C = this.castles()[p.name];
    if (!C) return;
    this.send(p, { t: 'kasteel', level: C.level, vlag: C.vlag, naam: C.naam || '', titel: this.royalTitle(p), munten: this.count(p, I.munt), prijs: C.level < 10 ? kasteelPrijs(C.level + 1) : 0, komt: C.level < 10 ? KASTEEL_LEVELS[C.level] : '' });
  },

  useCastleStone(p, w, x, y, z) {
    const C = this.castles()[p.name];
    if (!C || C.w !== w.id || C.x !== x || C.z !== z + 2) { this.toast(p, 'Dit is het kasteel van iemand anders.'); return; }
    this.sendCastle(p);
  },

  on_kasteel(p, m) {
    const C = this.castles()[p.name];
    if (!C || C.w !== p.world || Math.hypot(C.x - p.x, C.z - p.z) > 40) return;
    const w = this.worlds[C.w];
    if (m.c === 'up') {
      if (C.level >= 10) return;
      const prijs = kasteelPrijs(C.level + 1);
      if (this.count(p, I.munt) < prijs) { this.toast(p, 'Daar heb je ' + prijs + ' munten voor nodig.', 'warn'); return; }
      this.take(p, I.munt, prijs);
      C.level++;
      this.buildCastle(w, C);
      this.fx(w.id, 'chest', C.x + 0.5, C.y + 3, C.z + 0.5);
      this.toast(p, '🏰 Je kasteel is nu level ' + C.level + ': ' + KASTEEL_LEVELS[C.level - 1].toLowerCase() + '.', 'rank');
    } else if (m.c === 'naam') {
      C.naam = p.flags.familie = String(m.naam || '').replace(/[<>&]/g, '').trim().slice(0, 18);
    } else if (m.c === 'vlag') {
      const a = m.a | 0, b = m.b | 0;
      if (!VLAG_KLEUREN[a] || !VLAG_KLEUREN[b]) return;
      C.vlag = [a, b];
      this.buildCastle(w, C);
    } else if (m.c === 'weg') {
      // verhuizen: de kasteelsteen verdwijnt en je krijgt je brief terug (de muren blijven staan als gewone blokken)
      this.setBlock(w, C.x, C.y + 1, C.z - 2, 0);
      delete this.castles()[p.name];
      this.giveLoot(p, I.kasteelbrief, 1);
      this.toast(p, 'Je hebt je kasteelbrief terug. Een nieuw kasteel begint weer als woontoren.');
      this.sendInv(p);
      this.send(p, { t: 'kasteel', weg: 1 });
      return;
    } else if (m.c !== 'kijk') return;
    this.sendInv(p);
    this.sendCastle(p);
  },
};
