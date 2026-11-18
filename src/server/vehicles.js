// Voertuigen op de server: neerzetten, instappen, brandstof, schade en weer oppakken.
// (De voertuigen zelf staan in shared/vehicles.js; rijden doet de speler op zijn eigen scherm,
// net als bij de trein.)
import { I, ITEMS } from '../shared/items.js';
import { B } from '../shared/blocks.js';
import { VEHICLES, FUEL_PER_CAN, UPGRADES, VEH_COLORS, vehKlasse } from '../shared/vehicles.js';

const tijd = (t) => Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60).toFixed(1);

export const vehicleMethods = {
  vehList() { return this.meta.vehicles || (this.meta.vehicles = []); },

  spawnVehicle(rec) {
    const w = this.worlds[rec.w], V = VEHICLES[rec.kind];
    if (!w || !V) return;
    const e = this.spawnEnt(w, V.kind, rec.x, rec.y, rec.z, { keep: true, veh: rec });
    e.yaw = rec.yaw || 0;
    rec.eid = e.id;
  },

  vehStatus(p, rec) {
    const V = VEHICLES[rec.kind];
    this.send(p, { t: 'veh', fuel: rec.fuel, tank: V.tank, dmg: rec.dmg, up: rec.up || {} });
  },

  // een voertuig uit je rugzak neerzetten op de plek waar je naar wijst
  on_placeVeh(p, m) {
    const w = this.worlds[p.world];
    const x = m.x | 0, y = m.y | 0, z = m.z | 0;
    const s = p.inv[p.sel], kind = s && ITEMS[s.id] ? ITEMS[s.id].veh : '';
    const V = VEHICLES[kind];
    if (!V || Math.hypot(x + 0.5 - p.x, y - p.y, z + 0.5 - p.z) > 10) return;
    // (op gras of een bloem mag het wel: daar rijd je zo overheen)
    if (w.solid(x, y + 1, z) && V.soort !== 'boot' && V.soort !== 'duik') { this.toast(p, 'Hier is geen plek. Zet hem op een vrij stuk grond.', 'warn'); return; }
    for (const r of this.vehList()) if (r.w === w.id && Math.hypot(r.x - x - 0.5, r.z - z - 0.5) < 2.5 && Math.abs(r.y - y) < 3) { this.toast(p, 'Hier staat al een voertuig.', 'warn'); return; }
    // jouw auto blijft jouw auto: brandstof, schade, kleur, naam en upgrades van toen je hem oppakte
    const old = (p.flags.veh && p.flags.veh[kind]) || {};
    const keep = old.fuel !== undefined ? old.fuel : p.flags.vehFuel && p.flags.vehFuel[kind];
    const rec = { uid: this.meta.nextId++, w: w.id, kind, x: x + 0.5, y: y + 1.02, z: z + 0.5, yaw: p.yaw + Math.PI, fuel: keep === undefined ? Math.round(V.tank / 2) : keep,
      dmg: old.dmg !== undefined ? old.dmg : (p.flags.vehDmg && p.flags.vehDmg[kind]) || 0, name: old.name || '', color: old.color, up: old.up || {} };
    this.vehList().push(rec);
    this.spawnVehicle(rec);
    s.n--; if (s.n <= 0) p.inv[p.sel] = null;
    this.fx(w.id, 'poof', rec.x, rec.y + 0.6, rec.z, 1);
    this.toast(p, 'Je ' + V.name.toLowerCase() + ' staat klaar! Tik erop om in te stappen.', 'good');
    this.sendInv(p);
  },

  // tik op een voertuig: tanken met een jerrycan, repareren met een moersleutel, anders instappen
  useVehicle(p, w, e, hid) {
    const rec = e.veh, V = VEHICLES[rec.kind];
    const s = p.inv[p.sel];
    if (hid === I.jerrycan && !V.kermis) {
      if (rec.fuel >= V.tank - 1) { this.toast(p, 'De tank zit al vol.'); return; }
      s.n--; if (s.n <= 0) p.inv[p.sel] = null;
      rec.fuel = Math.min(V.tank, rec.fuel + FUEL_PER_CAN);
      this.fx(w.id, 'hearts', e.x, e.y + V.size[1], e.z);
      this.toast(p, 'Getankt! De tank is ' + Math.round(rec.fuel / V.tank * 100) + '% vol.', 'good');
      this.sendInv(p);
      if (p.mount === e.id) this.vehStatus(p, rec);
      return;
    }
    if (hid === I.moersleutel && !V.kermis) {
      if (rec.dmg < 1) { this.toast(p, 'Er is niets kapot aan deze ' + V.name.toLowerCase() + '.'); return; }
      if (this.count(p, I.ijzerstaaf) < 1) { this.toast(p, 'Voor het repareren heb je een ijzerstaaf nodig.', 'warn'); return; }
      this.take(p, I.ijzerstaaf, 1);
      rec.dmg = 0;
      this.fx(w.id, 'poof', e.x, e.y + 0.8, e.z, 1);
      this.toast(p, 'Gerepareerd! De ' + V.name.toLowerCase() + ' is weer als nieuw.', 'good');
      this.sendInv(p);
      if (p.mount === e.id) this.vehStatus(p, rec);
      return;
    }
    if (e.rider || p.mount || p.dead) return;
    p.mount = e.id; e.rider = p.id;
    if (rec.leen) this.toast(p, 'Je leent de ' + (rec.name || V.name).toLowerCase() + ' van de stad. Laat je hem staan, dan rijdt hij vanzelf weer verder.', 'good');
    this.send(p, { t: 'mount', id: e.id, s: 1, k: V.soort === 'lucht' || V.soort === 'duik' ? 'heli' : 'auto', veh: rec.kind, seat: V.seat, yaw: e.yaw - Math.PI, fuel: rec.fuel, tank: V.tank, dmg: rec.dmg, up: rec.up || {} });
  },

  // De speler meldt een paar keer per tel hoe ver hij gereden heeft en of hij ergens tegenaan botste.
  on_vehUse(p, m) {
    if (!p.mount) return;
    const e = this.worlds[p.world].ents.get(p.mount);
    if (!e || !e.veh) return;
    const rec = e.veh, V = VEHICLES[rec.kind];
    const d = Math.max(0, Math.min(60, +m.d || 0));
    rec.fuel = Math.max(0, rec.fuel - d / V.zuinig);
    const bump = Math.max(0, Math.min(40, +m.bump || 0));
    if (bump && !p.god && !V.kermis && !V.pantser) rec.dmg = Math.min(100, rec.dmg + bump);
    this.vehStatus(p, rec);
  },

  // sla met een houweel op je voertuig om het weer in je rugzak te stoppen
  pickVehicle(p, w, e) {
    if (e.rider) return;
    const s = p.inv[p.sel], it = s && ITEMS[s.id];
    const rec = e.veh, V = VEHICLES[rec.kind];
    if (V.kermis) { this.toast(p, 'De botsauto\'s blijven op de kermis.'); return; }
    if (rec.leen) { this.toast(p, 'Deze ' + V.name.toLowerCase() + ' is van de stad. Je mag erin rijden, maar niet meenemen.'); return; }
    if (!it || it.tool !== 'pick') { this.toast(p, 'Sla met een houweel op de ' + V.name.toLowerCase() + ' om hem weer mee te nemen.'); return; }
    (p.flags.veh || (p.flags.veh = {}))[rec.kind] = { fuel: Math.round(rec.fuel), dmg: Math.round(rec.dmg), name: rec.name || '', color: rec.color, up: rec.up || {} };
    this.giveLoot(p, I['v_' + rec.kind], 1);
    this.meta.vehicles = this.vehList().filter((r) => r !== rec);
    w.ents.delete(e.id);
    this.fx(w.id, 'poof', e.x, e.y + 0.8, e.z, 1);
    this.sendInv(p);
  },

  // ---------- de garage ----------

  // het voertuig waar je in zit, of anders het dichtstbijzijnde bij de garage
  garageVehicle(p, x, y, z) {
    const w = this.worlds[p.world];
    if (p.mount) { const e = w.ents.get(p.mount); if (e && e.veh) return e.veh; }
    let best = null, bd = 14;
    for (const r of this.vehList()) {
      if (r.w !== p.world) continue;
      const d = Math.hypot(r.x - x - 0.5, r.y - y, r.z - z - 0.5);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  },

  sendGarage(p, rec) {
    const V = VEHICLES[rec.kind];
    this.send(p, { t: 'garage', v: { uid: rec.uid, kind: rec.kind, name: rec.name || '', color: rec.color === undefined ? V.kleur : rec.color, up: rec.up || {}, fuel: rec.fuel, tank: V.tank, dmg: rec.dmg, klasse: vehKlasse(V, rec.up) }, munten: this.count(p, I.munt) });
  },

  // tik op het garageblok: het venster van je voertuig
  useGarage(p, w, x, y, z) {
    const rec = this.garageVehicle(p, x, y, z);
    if (!rec) { this.toast(p, 'Zet je voertuig vlak bij de garage (binnen een paar blokken) en tik dan nog eens.'); return; }
    p.garage = rec.uid;
    this.sendGarage(p, rec);
  },

  // knoppen in het garagevenster: repareren, tanken, kleur, naam en upgrades
  on_garage(p, m) {
    const rec = this.vehList().find((r) => r.uid === p.garage && r.w === p.world);
    if (!rec || Math.hypot(rec.x - p.x, rec.z - p.z) > 30) return;
    const V = VEHICLES[rec.kind], w = this.worlds[p.world], e = w.ents.get(rec.eid);
    const pay = (n) => { if (this.count(p, I.munt) < n) { this.toast(p, 'Daar heb je ' + n + ' munten voor nodig.', 'warn'); return false; } if (n > 0) this.take(p, I.munt, n); return true; };
    if (m.c === 'fix') {
      const cost = Math.ceil(rec.dmg / 12);
      if (rec.dmg >= 1 && pay(cost)) { this.jobEvent(p, 'garage'); rec.dmg = 0; this.toast(p, 'Gerepareerd voor ' + cost + ' munten.', 'good'); }
    } else if (m.c === 'fuel') {
      const cost = Math.ceil((V.tank - rec.fuel) / 30);
      if (rec.fuel < V.tank - 1 && pay(cost)) { this.jobEvent(p, 'garage'); rec.fuel = V.tank; this.toast(p, 'Volgetankt voor ' + cost + ' munten.', 'good'); }
    } else if (m.c === 'color') {
      const col = VEH_COLORS[m.i | 0];
      if (col !== undefined) { if (rec.color !== col) this.jobEvent(p, 'garage'); rec.color = col; if (e) this.broadcast(w.id, { t: 'entMeta', id: e.id, col }); }
    } else if (m.c === 'name') {
      rec.name = String(m.name || '').replace(/[<>&]/g, '').trim().slice(0, 16);
      if (e) { e.name = rec.name; this.broadcast(w.id, { t: 'entMeta', id: e.id, n: rec.name }); }
    } else if (m.c === 'up') {
      const U = UPGRADES[m.k];
      if (!U) return;
      const up = rec.up || (rec.up = {}), lv = up[m.k] || 0;
      if (lv >= U.prijs.length) return;
      if (pay(U.prijs[lv])) { this.jobEvent(p, 'garage'); up[m.k] = lv + 1; this.fx(w.id, 'hearts', rec.x, rec.y + V.size[1], rec.z); this.toast(p, U.name + ' niveau ' + (lv + 1) + ' ingebouwd!', 'good'); }
    }
    this.sendInv(p);
    this.sendGarage(p, rec);
    if (p.mount && p.mount === rec.eid) this.vehStatus(p, rec);
  },

  // ---------- tijdritten ----------

  // de speler rijdt over een startlijn: wat is zijn record op deze baan?
  on_trackAt(p, m) {
    const key = String(m.key || '').slice(0, 40);
    if (!key) return;
    this.send(p, { t: 'track', key, best: (p.flags.laps && p.flags.laps[key]) || 0 });
  },

  // een ronde gereden (alle checkpoints gehaald en weer over de startlijn)
  on_lapDone(p, m) {
    const key = String(m.key || '').slice(0, 40), t = +m.time;
    if (!key || !(t > 3) || t > 3600) return;
    const laps = p.flags.laps || (p.flags.laps = {});
    const old = laps[key] || 0, first = !old, record = first || t < old - 0.05;
    if (record) laps[key] = Math.round(t * 10) / 10;
    let munten = first ? 10 : record ? 5 : 1;
    const drift = Math.min(10, Math.floor((+m.drift || 0) / 250));
    munten += drift;
    this.giveLoot(p, I.munt, munten, true);
    this.addXp(p, record ? 12 : 4);
    this.toast(p, '🏁 Ronde in ' + tijd(t) + (first ? ' – je eerste ronde op deze baan!' : record ? ' – nieuw record! (was ' + tijd(old) + ')' : ' (record ' + tijd(old) + ')') + (drift ? ' · driftbonus ' + drift : '') + ' · +' + munten + ' munten', record ? 'rank' : 'good');
    this.send(p, { t: 'track', key, best: laps[key] });
    if (this.raceLap) this.raceLap(p, key, t);
  },

  // ---------- racen op de racebaan ----------
  // Bij de racemeester start je een race van drie rondes tegen drie coureurs van het spel.
  // Zij rijden langs de middellijn van de baan; jij rijdt zelf. Wie het eerst drie rondes heeft
  // gereden wint.

  circuitNear(p) {
    const w = this.worlds[p.world];
    for (const s of w.gen.sitesNear(p.x, p.z, 80)) if (s.kind === 'circuit') return s;
    return null;
  },

  raceMenu(p, w, e) {
    const s = this.circuitNear(p);
    if (!s) return;
    const wins = (p.flags.raceWins && p.flags.raceWins[w.id + ':' + s.key]) || 0;
    this.send(p, { t: 'raceMenu', name: s.name, wins, busy: !!this.race });
    void e;
  },

  on_race(p, m) {
    if (m.c !== 'start' || this.race) return;
    const s = this.circuitNear(p), w = this.worlds[p.world];
    if (!s) return;
    const e = p.mount ? w.ents.get(p.mount) : null;
    if (!e || !e.veh || VEHICLES[e.veh.kind].soort !== 'weg') { this.toast(p, 'Stap eerst in een auto, motor of ander voertuig met wielen, en kom dan terug.', 'warn'); return; }
    const plan = w.gen.sitePlan(s);
    const R = this.race = { wid: w.id, key: w.id + ':' + s.key, site: s, plan, t: -4.2, said: 4, laps: 3, pid: p.id, plLaps: 0, order: [], ai: [], end: 0 };
    // de speler op de eerste startplek, de drie coureurs op de andere
    const yaw = -Math.PI / 2;                                  // naar het oosten
    p.x = plan.grid[0][0]; p.y = plan.y + 0.05; p.z = plan.grid[0][1];
    e.x = e.veh.x = p.x; e.y = e.veh.y = p.y; e.z = e.veh.z = p.z; e.yaw = e.veh.yaw = yaw + Math.PI;
    this.send(p, { t: 'raceGrid', x: p.x, y: p.y, z: p.z, yaw, laps: R.laps });
    // hoe hard ze rijden: Flits haal je in met een gewone auto, voor Turbo heb je upgrades nodig
    const drivers = [['Flits', 0xf0d020, 13.5], ['Bliksem', 0x2a6ad0, 15], ['Turbo', 0x3ab04a, 16.5]];
    // het punt op de middellijn dat het dichtst bij een startplek ligt
    const nearest = (gx, gz) => { let b = 0, bd = 1e9; plan.way.forEach((q, i) => { const d = Math.hypot(q[0] - gx, q[1] - gz); if (d < bd) { bd = d; b = i; } }); return b; };
    drivers.forEach(([name, col, speed], i) => {
      const [gx, gz] = plan.grid[i + 1];
      const a = this.spawnEnt(w, 'v_auto', gx, plan.y, gz, { keep: true, race: true, col, name });
      a.yaw = Math.PI / 2;
      // off = hoe ver hij naast de middellijn rijdt, zodat ze niet door elkaar heen rijden
      R.ai.push({ e: a, name, speed, v: 0, i: nearest(gx, gz), f: 0, off: gz - (s.z + 20.5), lap: -1, done: false, passed: false });
    });
    this.toast(p, 'Naar de start! Wacht op het groene licht.', 'good');
  },

  updateRace(dt) {
    const R = this.race;
    if (!R) return;
    const w = this.worlds[R.wid], p = this.playerById(R.pid);
    R.t += dt;
    const stop = (why) => {
      for (const a of R.ai) w.ents.delete(a.e.id);
      this.race = null;
      if (p && why) this.toast(p, why, 'warn');
      if (p) this.send(p, { t: 'raceEnd' });
    };
    if (!p || p.world !== R.wid) { stop(''); return; }
    if (R.end) { if (R.t > R.end) stop(''); }
    else if (R.t > 420) { stop('De race duurde te lang en is afgelopen.'); return; }
    else if (R.t > 0 && (!p.mount || Math.hypot(p.x - R.site.x, p.z - R.site.z) > 120)) { stop('Je bent uitgestapt of van de baan gereden: de race is afgelopen.'); return; }
    // aftellen: 3, 2, 1, GO!
    if (R.t < 0) {
      const n = Math.ceil(-R.t);
      if (n < R.said && n <= 3) { R.said = n; this.send(p, { t: 'raceCount', n }); }
      return;
    }
    if (R.said > 0) { R.said = 0; this.send(p, { t: 'raceCount', n: 0 }); }
    const way = R.plan.way, N = way.length;
    for (const a of R.ai) {
      const q0 = way[a.i], q1 = way[(a.i + 1) % N], q2 = way[(a.i + 3) % N];
      // in de bochten gaan ze iets langzamer dan op het rechte stuk
      const bend = Math.abs(Math.atan2(Math.sin(Math.atan2(q2[0] - q1[0], q2[1] - q1[1]) - Math.atan2(q1[0] - q0[0], q1[1] - q0[1])), 1)) > 0.12;
      const want = a.done ? 0 : a.speed * (bend ? 0.82 : 1.08) * (0.97 + 0.06 * Math.sin(R.t * 0.7 + a.speed));
      a.v += Math.max(-9 * dt, Math.min(5 * dt, want - a.v));
      a.f += a.v * dt / Math.max(0.5, Math.hypot(q1[0] - q0[0], q1[1] - q0[1]));
      while (a.f >= 1) {
        a.f -= 1; a.i = (a.i + 1) % N;
        if (a.i === 0) {                        // over de startlijn
          a.lap++;
          if (a.lap >= R.laps && !a.done) { a.done = true; R.order.push(a.name); }
        }
      }
      const b0 = way[a.i], b1 = way[(a.i + 1) % N];
      const dx = b1[0] - b0[0], dz = b1[1] - b0[1], l = Math.hypot(dx, dz) || 1;
      // een eindje naast de middellijn (links of rechts), zoals hij op de startplek stond
      a.e.x = b0[0] + dx * a.f + (dz / l) * a.off * -1; a.e.z = b0[1] + dz * a.f + (dx / l) * a.off;
      a.e.y = R.plan.y; a.e.yaw = Math.atan2(dx, dz);
    }
  },

  // de speler heeft een ronde gereden (aangeroepen vanuit on_lapDone)
  raceLap(p, key, t) {
    const R = this.race;
    if (!R || R.pid !== p.id || R.end || Math.hypot(p.x - R.site.x, p.z - R.site.z) > 80) return;
    R.plLaps++;
    if (R.plLaps < R.laps) { this.toast(p, 'Ronde ' + (R.plLaps + 1) + ' van ' + R.laps + '!', 'good'); return; }
    const place = R.order.length + 1;
    const prijs = [30, 15, 8, 3][place - 1] || 3;
    this.giveLoot(p, I.munt, prijs, true);
    this.addXp(p, place === 1 ? 40 : 15);
    if (place === 1) { const k = p.flags.raceWins || (p.flags.raceWins = {}); k[R.key] = (k[R.key] || 0) + 1; }
    this.send(p, { t: 'dialog', title: place === 1 ? '🏆 Gewonnen!' : '🏁 Finish!', lines: [
      place === 1 ? 'Je bent als eerste over de finish op ' + R.site.name + '!' : 'Je bent ' + ['eerste', 'tweede', 'derde', 'vierde'][place - 1] + ' geworden op ' + R.site.name + '.',
      R.order.length ? 'Voor je: ' + R.order.join(', ') + '.' : 'Flits, Bliksem en Turbo zaten achter je.',
      'Je krijgt ' + prijs + ' munten.' + (place > 1 ? ' Met een motor-upgrade en nitro uit de garage ga je harder.' : ''),
    ] });
    R.end = R.t + 6;
    void key; void t;
  },
};
