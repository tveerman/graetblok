// De kermis op de server: in een attractie stappen, de kermisspelletjes met hun prijzen, de
// botsauto's en het vuurwerk. (De attracties zelf staan in shared/rides.js, het pretpark
// wordt getekend in sites.js.)
import { I } from '../shared/items.js';
import { isNight, DAY_LENGTH } from '../shared/constants.js';
import { RIDES, KERMIS_GAMES, KERMIS_PRICE } from '../shared/rides.js';

export const kermisMethods = {

  // ---------- attracties ----------

  // tik op een attractie: instappen. Het ritje zelf speelt zich af op het scherm van de speler.
  useRide(p, w, e) {
    if (p.mount || p.dead) return;
    if (e.def.ride === 'lijnvlucht' && !this.boardFlight(p, w, e)) return;
    p.mount = e.id;
    p.rideT = this.meta.time;
    this.send(p, { t: 'mount', id: e.id, s: 1, k: 'rit', ride: e.def.ride });
  },

  // uit de attractie: de eerste keer per dag krijg je een paar munten
  rideDone(p, e) {
    if (e.def.ride === 'lijnvlucht') { this.flightDone(p, e); return; }
    const R = RIDES[e.def.ride];
    if (!R || this.meta.time - (p.rideT || 0) < 8) return;
    const day = Math.floor(this.meta.time / DAY_LENGTH);
    const done = p.flags.ritten || (p.flags.ritten = {});
    const tel = p.flags.ritTel || (p.flags.ritTel = {});
    tel[R.key] = (tel[R.key] || 0) + 1;
    this.addXp(p, 4);
    if (done[R.key] !== day) {
      done[R.key] = day;
      this.giveLoot(p, I.munt, 2, true);
      this.toast(p, R.name + ': wat een rit! Voor je eerste ritje van vandaag krijg je 2 munten.', 'good');
    }
    const all = Object.keys(RIDES).every((k) => tel[k]);
    if (all && !p.flags.ritAlles) { p.flags.ritAlles = 1; this.giveLoot(p, I.munt, 25, true); this.toast(p, '🎡 Je bent in alle attracties geweest! Je krijgt 25 munten.', 'rank'); }
  },

  // ---------- kermisspelletjes ----------

  kermisMenu(p, game) {
    this.send(p, { t: 'kermis', game, prijs: KERMIS_PRICE, munten: this.count(p, I.munt) });
  },

  // c = 'start' (betalen en beginnen) of 'score' (hoe goed ging het, 0..1)
  on_kermis(p, m) {
    const G = KERMIS_GAMES[m.game];
    if (!G) return;
    if (m.c === 'start') {
      if (this.count(p, I.munt) < KERMIS_PRICE) { this.toast(p, 'Een spelletje kost ' + KERMIS_PRICE + ' munten.', 'warn'); return; }
      this.take(p, I.munt, KERMIS_PRICE);
      p.kermis = m.game;
      this.sendInv(p);
      this.send(p, { t: 'kermisGo', game: m.game });
      return;
    }
    if (m.c !== 'score' || p.kermis !== m.game) return;
    p.kermis = '';
    if (m.game === 'steekspel' || m.game === 'boog') { this.tournamentResult(p, m.game, Math.max(0, Math.min(1, +m.score || 0))); return; }
    const s = Math.max(0, Math.min(1, +m.score || 0)), r = this.rnd();
    let id = 0, n = 1, tekst = '';
    if (s >= 0.9) {
      // de hoofdprijs: soms een ei, anders een grote knuffel of een trofee
      if (r < 0.35) { id = r < 0.04 ? I.ei_magisch : r < 0.15 ? I.ei_oceaan : r < 0.25 ? I.ei_bos : I.ei_basis; tekst = 'De hoofdprijs: een ei!'; }
      else { id = r < 0.7 ? I.knuffel_groot : I.trofee; tekst = 'De hoofdprijs!'; }
    } else if (s >= 0.6) { if (r < 0.6) { id = I.knuffel_klein; tekst = 'Een mooie prijs!'; } else { id = I.munt; n = 4; tekst = 'Goed gedaan!'; } }
    else if (s >= 0.3) { if (r < 0.5) { id = I.suikerspin; tekst = 'Een troostprijs.'; } else { id = I.munt; n = 1; tekst = 'Bijna!'; } }
    else if (r < 0.35) { id = I.popcorn; tekst = 'Een troostprijsje.'; }
    if (id) this.giveLoot(p, id, n, true);
    this.addXp(p, 2 + Math.round(s * 6));
    this.send(p, { t: 'kermisPrijs', game: m.game, id, n, tekst: id ? tekst : 'Helaas, geen prijs. Probeer het nog eens!', munten: this.count(p, I.munt) });
    this.sendInv(p);
  },

  // ---------- botsauto's ----------

  // vier botsauto's in de baan van elk pretpark (één keer neerzetten; ze blijven daar)
  ensureBots(w, s) {
    if (!this.meta.bots) this.meta.bots = {};
    const key = w.id + ':' + s.key;
    if (this.meta.bots[key]) return;
    const plan = w.gen.sitePlan(s);
    if (w.get(Math.floor(plan.bots[0][0]), s.y, Math.floor(plan.bots[0][2])) <= 0) return;      // de baan is hier (nog) niet gebouwd
    this.meta.bots[key] = 1;
    const kleuren = [0xd8362c, 0x2a6ad0, 0xf0d020, 0x3ab04a];
    plan.bots.forEach(([x, y, z], i) => {
      const rec = { uid: this.meta.nextId++, w: w.id, kind: 'botsauto', x, y, z, yaw: i < 2 ? 0 : Math.PI, fuel: 100, dmg: 0, color: kleuren[i], up: {} };
      this.vehList().push(rec);
      this.spawnVehicle(rec);
    });
  },

  // ---------- vuurwerk ----------

  // 's Nachts is er vuurwerk boven het pretpark als je er bent. (Wordt elke tel aangeroepen.)
  fireworks(p) {
    if (!isNight(this.meta.time) || Math.floor(this.meta.time) % 2) return;
    const w = this.worlds[p.world];
    for (const s of w.gen.sitesNear(p.x, p.z, 110)) {
      if (s.kind !== 'pretpark') continue;
      const n = 1 + Math.floor(this.rnd() * 2);
      for (let i = 0; i < n; i++) this.send(p, { t: 'fx', k: 'vuurwerk', x: s.x + (this.rnd() - 0.5) * 70, y: s.y + 30 + this.rnd() * 18, z: s.z + (this.rnd() - 0.5) * 70, a: Math.floor(this.rnd() * 6) });
      return;
    }
  },
};
