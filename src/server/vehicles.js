// Voertuigen op de server: neerzetten, instappen, brandstof, schade en weer oppakken.
// (De voertuigen zelf staan in shared/vehicles.js; rijden doet de speler op zijn eigen scherm,
// net als bij de trein.)
import { I, ITEMS } from '../shared/items.js';
import { VEHICLES, FUEL_PER_CAN } from '../shared/vehicles.js';

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
    this.send(p, { t: 'veh', fuel: rec.fuel, tank: V.tank, dmg: rec.dmg });
  },

  // een voertuig uit je rugzak neerzetten op de plek waar je naar wijst
  on_placeVeh(p, m) {
    const w = this.worlds[p.world];
    const x = m.x | 0, y = m.y | 0, z = m.z | 0;
    const s = p.inv[p.sel], kind = s && ITEMS[s.id] ? ITEMS[s.id].veh : '';
    const V = VEHICLES[kind];
    if (!V || Math.hypot(x + 0.5 - p.x, y - p.y, z + 0.5 - p.z) > 10) return;
    if (w.get(x, y + 1, z) > 0 && V.soort !== 'boot') { this.toast(p, 'Hier is geen plek. Zet hem op een vrij stuk grond.', 'warn'); return; }
    for (const r of this.vehList()) if (r.w === w.id && Math.hypot(r.x - x - 0.5, r.z - z - 0.5) < 2.5 && Math.abs(r.y - y) < 3) { this.toast(p, 'Hier staat al een voertuig.', 'warn'); return; }
    // de brandstof die er nog in zat toen je hem oppakte zit er nog steeds in
    const keep = p.flags.vehFuel && p.flags.vehFuel[kind];
    const rec = { uid: this.meta.nextId++, w: w.id, kind, x: x + 0.5, y: y + 1.02, z: z + 0.5, yaw: p.yaw, fuel: keep === undefined ? Math.round(V.tank / 2) : keep, dmg: (p.flags.vehDmg && p.flags.vehDmg[kind]) || 0 };
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
    if (hid === I.jerrycan) {
      if (rec.fuel >= V.tank - 1) { this.toast(p, 'De tank zit al vol.'); return; }
      s.n--; if (s.n <= 0) p.inv[p.sel] = null;
      rec.fuel = Math.min(V.tank, rec.fuel + FUEL_PER_CAN);
      this.fx(w.id, 'hearts', e.x, e.y + V.size[1], e.z);
      this.toast(p, 'Getankt! De tank is ' + Math.round(rec.fuel / V.tank * 100) + '% vol.', 'good');
      this.sendInv(p);
      if (p.mount === e.id) this.vehStatus(p, rec);
      return;
    }
    if (hid === I.moersleutel) {
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
    this.send(p, { t: 'mount', id: e.id, s: 1, k: V.soort === 'lucht' ? 'heli' : 'auto', veh: rec.kind, seat: V.seat, yaw: e.yaw, fuel: rec.fuel, tank: V.tank, dmg: rec.dmg });
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
    if (bump && !p.god) rec.dmg = Math.min(100, rec.dmg + bump);
    this.vehStatus(p, rec);
  },

  // sla met een houweel op je voertuig om het weer in je rugzak te stoppen
  pickVehicle(p, w, e) {
    if (e.rider) return;
    const s = p.inv[p.sel], it = s && ITEMS[s.id];
    const rec = e.veh, V = VEHICLES[rec.kind];
    if (!it || it.tool !== 'pick') { this.toast(p, 'Sla met een houweel op de ' + V.name.toLowerCase() + ' om hem weer mee te nemen.'); return; }
    (p.flags.vehFuel || (p.flags.vehFuel = {}))[rec.kind] = Math.round(rec.fuel);
    (p.flags.vehDmg || (p.flags.vehDmg = {}))[rec.kind] = Math.round(rec.dmg);
    this.giveLoot(p, I['v_' + rec.kind], 1);
    this.meta.vehicles = this.vehList().filter((r) => r !== rec);
    w.ents.delete(e.id);
    this.fx(w.id, 'poof', e.x, e.y + 0.8, e.z, 1);
    this.sendInv(p);
  },
};
