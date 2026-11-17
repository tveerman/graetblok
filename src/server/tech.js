// Techniek en fabrieken op de server: het stroomnet, de fabrieksmachine, de teleportatiepoort,
// de klimaatmachine en de opdrachten van de Uitvinder. (De lijsten staan in shared/tech.js.)
import { isNight } from '../shared/constants.js';
import { B } from '../shared/blocks.js';
import { I, itemName } from '../shared/items.js';
import { WORLDS } from '../shared/worlds.js';
import { STROOM_R, BAT_MAX, ZON_STROOM, WIND_STROOM, TP_STROOM, KLIMAAT_STROOM, FABRIEK, UITVINDER } from '../shared/tech.js';

const TECH = { [B.zonnepaneel]: 'zon', [B.windmolen]: 'wind', [B.batterij]: 'bat', [B.fabriek]: 'fab', [B.teleportpoort]: 'tp', [B.klimaatmachine]: 'klim' };
const near = (a, b) => Math.abs(a.x - b.x) <= STROOM_R && Math.abs(a.y - b.y) <= STROOM_R && Math.abs(a.z - b.z) <= STROOM_R;

export const techMethods = {

  techAll() { return this.meta.tech || (this.meta.tech = {}); },
  // het briefje van een techniekblok (wordt gemaakt zodra je het neerzet of voor het eerst gebruikt)
  techRec(w, x, y, z, id, owner) {
    const all = this.techAll(), key = w.id + ':' + x + ',' + y + ',' + z;
    return all[key] || (all[key] = { t: TECH[id], w: w.id, x, y, z, o: owner || '', lading: 0 });
  },
  techPlaced(p, w, x, y, z, id) {
    if (!TECH[id]) return;
    this.techRec(w, x, y, z, id, p.name);
    if (id === B.zonnepaneel || id === B.windmolen) this.techQuest(p, 'zon');
    if (id === B.teleportpoort) this.toast(p, 'Een teleportatiepoort werkt met z\'n tweeën: zet er nog één neer op een andere plek. Elke reis kost ' + TP_STROOM + ' stroom uit een batterij vlakbij.');
  },
  techBroken(p, w, x, y, z, id) {
    if (!TECH[id]) return;
    const all = this.techAll(), key = w.id + ':' + x + ',' + y + ',' + z, r = all[key];
    if (r && r.t === 'fab') {                       // wat er nog in de machine zat krijg je terug
      const R = FABRIEK.find((q) => q.k === r.job);
      if (R && r.q > 0 && typeof R.in[0] === 'number') this.giveLoot(p, R.in[0], R.in[1] * r.q, true);
      for (const id2 in r.uit || {}) this.giveLoot(p, +id2, r.uit[id2], true);
    }
    delete all[key];
  },

  // hoeveel stroom komt er nu uit de panelen en molens rond deze plek?
  powerNow(rec, list) {
    const W = WORLDS[rec.w], zon = W.cycle && !isNight(this.meta.time) && this.weatherOf(rec.w) === 'zon';
    let n = 0;
    for (const s of list) { if (s.w !== rec.w || !near(s, rec)) continue; if (s.t === 'zon' && zon) n += ZON_STROOM; else if (s.t === 'wind') n += WIND_STROOM; }
    return n;
  },
  // stroom uit een batterij in de buurt halen; lukt dat niet, dan gebeurt er niets
  drain(rec, list, n) {
    for (const b of list) if (b.t === 'bat' && b.w === rec.w && near(b, rec) && b.lading >= n) { b.lading -= n; return true; }
    return false;
  },

  // elke seconde: batterijen laden en fabrieken laten draaien (alleen waar een speler in de buurt is)
  updateTech() {
    const all = this.meta.tech;
    if (!all) return;
    const list = Object.values(all);
    if (!list.length) return;
    const actief = (r) => { for (const p of this.players.values()) if (p.world === r.w && Math.abs(p.x - r.x) < 128 && Math.abs(p.z - r.z) < 128) return true; return false; };
    for (const r of list) {
      if (r.t !== 'bat' && r.t !== 'fab') continue;
      if (!actief(r)) continue;
      const gain = this.powerNow(r, list);
      if (r.t === 'bat') {
        const was = r.lading;
        r.lading = Math.min(BAT_MAX, r.lading + gain);
        if (was < BAT_MAX && r.lading >= BAT_MAX) { const p = this.playerByName(r.o); if (p) this.techQuest(p, 'bat'); }
        continue;
      }
      // een fabrieksmachine: draait als er genoeg stroom is (direct van zon of wind, anders uit een batterij)
      const R = FABRIEK.find((q) => q.k === r.job);
      if (!R || !(r.q > 0)) { r.stil = false; continue; }
      if (gain < 1 && !this.drain(r, list, 1)) { r.stil = true; continue; }
      r.stil = false;
      r.prog = (r.prog || 0) + 1;
      if (r.prog >= R.tijd) {
        r.prog = 0; r.q--;
        const uit = r.uit || (r.uit = {});
        uit[R.uit[0]] = (uit[R.uit[0]] || 0) + R.uit[1];
        const p = this.playerByName(r.o);
        if (p) {
          const F = this.techOf(p);
          F.fab = (F.fab || 0) + 1; if (R.k === 'pers') F.pers = (F.pers || 0) + 1;
          if (F.fab >= 10) this.techQuest(p, 'fab');
          if (F.pers >= 3) this.techQuest(p, 'pers');
        }
      }
    }
  },

  // ---------- gebruiken ----------

  useTech(p, w, x, y, z, id) {
    // Een techniekblok dat de wereld zelf heeft neergezet (de werkplaats van de Uitvinder) kent
    // het stroomnet nog niet: bij het eerste gebruik zoeken we alles in de buurt erbij.
    if (!this.techAll()[w.id + ':' + x + ',' + y + ',' + z]) {
      for (let dx = -STROOM_R; dx <= STROOM_R; dx++) for (let dy = -STROOM_R; dy <= STROOM_R; dy++) for (let dz = -STROOM_R; dz <= STROOM_R; dz++) {
        const bid = w.get(x + dx, y + dy, z + dz);
        if (TECH[bid]) this.techRec(w, x + dx, y + dy, z + dz, bid, p.name);
      }
    }
    const all = Object.values(this.techAll()), r = this.techRec(w, x, y, z, id, p.name);
    if (r.t === 'zon' || r.t === 'wind') {
      const n = this.powerNow({ w: w.id, x, y, z }, [r]);
      this.toast(p, r.t === 'zon' ? (n ? '☀️ Dit zonnepaneel geeft nu ' + n + ' stroom per tel.' : '🌙 Een zonnepaneel werkt alleen overdag en als het niet regent.') : '🌬️ Deze windmolen geeft dag en nacht ' + WIND_STROOM + ' stroom per tel.');
    } else if (r.t === 'bat') {
      const gain = this.powerNow(r, all);
      this.toast(p, '🔋 Batterij: ' + Math.floor(r.lading) + ' van de ' + BAT_MAX + ' stroom' + (gain ? ', laadt op met ' + gain + ' per tel.' : '. Hij laadt nu niet op: zet een zonnepaneel of windmolen binnen ' + STROOM_R + ' blokken.'));
    } else if (r.t === 'fab') {
      this.sendFactory(p, r);
    } else if (r.t === 'tp') {
      let other = null, bd = -1;
      for (const q of all) if (q.t === 'tp' && q.w === w.id && q !== r && q.o === r.o) { const d = Math.hypot(q.x - x, q.z - z); if (d > bd) { bd = d; other = q; } }
      if (!other) { this.toast(p, 'Er is nog geen tweede poort. Zet er nog één neer op de plek waar je naartoe wilt.', 'warn'); return; }
      if (w.get(other.x, other.y, other.z) !== B.teleportpoort) { delete this.techAll()[w.id + ':' + other.x + ',' + other.y + ',' + other.z]; this.toast(p, 'De andere poort is weg.', 'warn'); return; }
      if (!this.drain(r, all, TP_STROOM)) { this.toast(p, '🔋 Te weinig stroom: zet een batterij met minstens ' + TP_STROOM + ' stroom binnen ' + STROOM_R + ' blokken van deze poort.', 'warn'); return; }
      this.fx(w.id, 'portal', x + 0.5, y + 1, z + 0.5);
      p.x = other.x + 0.5; p.y = other.y + 1.1; p.z = other.z + 0.5;
      this.send(p, { t: 'tp', x: p.x, y: p.y, z: p.z, fade: 'Zzzap!' });
      this.fx(w.id, 'portal', p.x, p.y, p.z);
      this.techQuest(p, 'tp');
    } else if (r.t === 'klim') {
      if (!this.drain(r, all, KLIMAAT_STROOM)) { this.toast(p, '🔋 Te weinig stroom: de klimaatmachine heeft ' + KLIMAAT_STROOM + ' stroom nodig uit een batterij binnen ' + STROOM_R + ' blokken.', 'warn'); return; }
      const nu = this.weatherOf(w.id), volgende = nu === 'zon' ? 'regen' : nu === 'regen' ? 'onweer' : 'zon';
      this.setWeather(w.id, volgende, 300);
      this.toast(p, '🌦️ De klimaatmachine zoemt... het weer wordt: ' + (volgende === 'zon' ? 'zonnig' : volgende) + '.', 'good');
      this.techQuest(p, 'weer');
    }
  },

  sendFactory(p, r) {
    const R = FABRIEK.find((q) => q.k === r.job), list = Object.values(this.techAll());
    const stroom = this.powerNow(r, list) >= 1 || list.some((b) => b.t === 'bat' && b.w === r.w && near(b, r) && b.lading >= 1);
    p.fabriek = r.w + ':' + r.x + ',' + r.y + ',' + r.z;
    this.send(p, {
      t: 'fabriek', stroom, bezig: R && r.q > 0 ? [R.name, r.q, Math.round(100 * (r.prog || 0) / R.tijd)] : null,
      klaar: Object.keys(r.uit || {}).map((id) => [+id, r.uit[id]]),
      recepten: FABRIEK.map((q) => [q.k, q.name, typeof q.in[0] === 'number' ? itemName(q.in[0]) : 'boomstam', q.in[1], q.uit[0], q.uit[1], q.tijd, Math.floor(this.count(p, q.in[0]) / q.in[1])]),
    });
  },

  on_fabriek(p, m) {
    const r = this.techAll()[p.fabriek];
    if (!r || r.t !== 'fab' || r.w !== p.world || Math.hypot(r.x - p.x, r.z - p.z) > 12) return;
    if (m.c === 'pak') {
      for (const id in r.uit || {}) { const left = this.give(p, +id, r.uit[id]); if (left > 0) { r.uit[id] = left; this.toast(p, 'Je rugzak is vol!', 'warn'); } else delete r.uit[id]; }
    } else if (m.c === 'start') {
      const R = FABRIEK.find((q) => q.k === m.k);
      if (!R) return;
      if (r.q > 0 && r.job !== R.k) { this.toast(p, 'De machine is nog bezig. Wacht tot hij klaar is.', 'warn'); return; }
      const n = Math.max(1, Math.min(64 - (r.q || 0), m.n | 0, Math.floor(this.count(p, R.in[0]) / R.in[1])));
      if (this.count(p, R.in[0]) < R.in[1] * n) { this.toast(p, 'Daar heb je niet genoeg van bij je.', 'warn'); return; }
      this.take(p, R.in[0], R.in[1] * n);
      if (r.job !== R.k) r.prog = 0;
      r.job = R.k; r.q = (r.q || 0) + n; r.o = p.name;
    } else if (m.c !== 'kijk') return;
    this.sendInv(p);
    this.sendFactory(p, r);
  },

  // ---------- de Uitvinder ----------

  techOf(p) { return p.flags.tech || (p.flags.tech = { stap: 0, gedaan: {}, fab: 0, pers: 0 }); },

  // er is iets gebeurd waar de Uitvinder om kan vragen; zijn opdrachten gaan op volgorde
  techQuest(p, k) {
    const F = this.techOf(p);
    F.gedaan[k] = 1;
    while (F.stap < UITVINDER.length && F.gedaan[UITVINDER[F.stap].k]) {
      const Q = UITVINDER[F.stap];
      F.stap++;
      this.giveLoot(p, I.munt, Q.munten, true);
      this.toast(p, '💡 Opdracht van de Uitvinder gehaald: ' + Q.tekst + '! Je krijgt ' + Q.munten + ' munten.', 'rank');
      if (F.stap === UITVINDER.length) {
        this.debugPet(p, 'robothond', '');
        this.send(p, { t: 'dialog', title: '🤖 Een robothond!', lines: ['De Uitvinder heeft een oude robot voor je gerepareerd.', 'Je hebt al zijn opdrachten gehaald, dus hij is van jou: een Robothond die met je meeloopt en meevecht.', 'Je vindt hem terug in je Dierenboek.'] });
      }
      this.sendInv(p);
    }
  },

  // wat de Uitvinder zegt als je hem aantikt
  inventorSays(p) {
    const F = this.techOf(p);
    if (F.stap >= UITVINDER.length) return 'Je hebt al mijn opdrachten gehaald. Zorg goed voor je robothond!';
    return 'Opdracht ' + (F.stap + 1) + ' van de ' + UITVINDER.length + ': ' + UITVINDER[F.stap].tekst + '. (Beloning: ' + UITVINDER[F.stap].munten + ' munten' + (F.stap === UITVINDER.length - 1 ? ' en een robothond' : '') + ')';
  },
};
