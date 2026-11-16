// Het Dierenrijk op de server: de broedmachine, wat er uit een ei komt, het Dierenboek en
// de dieren die met je meelopen. (De dieren zelf staan in shared/animals.js.)
import { B } from '../shared/blocks.js';
import { I, ITEMS } from '../shared/items.js';
import { ANIMALS, ANIMAL_LIST, EGG_KINDS, RARITY, SHINY, ZOO_REWARDS, MAX_OUT, rollAnimal, rollShiny, zooTitle } from '../shared/animals.js';

const SLOTS = 3;          // zoveel eieren passen er in één broedmachine
const NEAR = 60;          // zo dichtbij moet je zijn om een ei te zien uitkomen

// "3 minuten", "40 tellen"
function tijd(sec) {
  if (sec <= 0) return 'bijna';
  if (sec < 60) return Math.ceil(sec) + ' tellen';
  const m = Math.ceil(sec / 60);
  return m + (m === 1 ? ' minuut' : ' minuten');
}
const lidwoord = (naam) => 'een ' + naam;

export const zooMethods = {
  incubs() { return this.meta.incub || (this.meta.incub = {}); },
  zooOf(p) { return p.zoo || (p.zoo = {}); },
  animalPets(p) { return p.pets.filter((d) => d.a && ANIMALS[d.a]); },

  // ---------- de broedmachine ----------

  // tik op de broedmachine: met een ei in je hand leg je het erin, anders zie je hoe lang het nog duurt
  useIncubator(p, w, x, y, z) {
    const key = w.id + ':' + x + ',' + y + ',' + z, all = this.incubs();
    const inc = all[key] || (all[key] = { w: w.id, x, y, z, owner: p.name, eggs: [] });
    const s = p.inv[p.sel];
    const kind = s && s.id >= 256 && ITEMS[s.id] ? ITEMS[s.id].egg : '';
    if (kind) {
      if (inc.eggs.length >= SLOTS) { this.toast(p, 'De broedmachine zit vol: er passen ' + SLOTS + ' eieren in.', 'warn'); return; }
      const E = EGG_KINDS[kind];
      s.n--; if (s.n <= 0) p.inv[p.sel] = null;
      inc.eggs.push({ k: kind, left: E.min * 60 });
      inc.owner = p.name;
      this.sendInv(p);
      this.fx(w.id, 'eggwarm', x + 0.5, y + 1.1, z + 0.5);
      this.toast(p, 'Het ' + E.name.toLowerCase() + ' ligt lekker warm. Over ' + tijd(E.min * 60) + ' komt het uit.', 'good');
      return;
    }
    if (!inc.eggs.length) { this.toast(p, 'De broedmachine is leeg. Houd een ei vast en tik erop.'); return; }
    this.toast(p, inc.eggs.map((e) => EGG_KINDS[e.k].name + ': ' + (e.left > 0 ? 'nog ' + tijd(e.left) : 'komt uit!')).join(' · '));
  },

  // de broedmachine wordt weggehakt: je krijgt de eieren terug
  breakIncubator(p, wid, x, y, z) {
    const key = wid + ':' + x + ',' + y + ',' + z, all = this.incubs(), inc = all[key];
    if (!inc) return;
    for (const e of inc.eggs) this.giveLoot(p, I['ei_' + e.k], 1);
    delete all[key];
    this.sendInv(p);
  },

  // Elke tel: de eieren worden warmer. Dat gaat alleen door terwijl je speelt; slapen telt niet mee.
  updateIncubators() {
    const now = this.meta.time;
    let dt = now - (this._incT === undefined ? now : this._incT);
    this._incT = now;
    if (!(dt > 0)) return;
    if (dt > 5) dt = 5;
    const all = this.incubs();
    for (const key in all) {
      const inc = all[key];
      const o = this.playerByName(inc.owner);
      if (!o) continue;
      const near = o.world === inc.w && Math.hypot(o.x - inc.x, o.z - inc.z) < NEAR;
      if (near && this.worlds[inc.w].get(inc.x, inc.y, inc.z) !== B.broedmachine) { delete all[key]; continue; }
      for (let i = 0; i < inc.eggs.length; i++) {
        const e = inc.eggs[i];
        if (e.left > 0) {
          e.left -= dt;
          if (near && Math.floor(e.left) % 6 === 0) this.fx(inc.w, 'eggwarm', inc.x + 0.5, inc.y + 1.1, inc.z + 0.5);
          if (e.left > 0) continue;
        }
        if (!near) {
          // het ei is klaar, maar wacht tot je erbij bent: anders mis je het
          if (!e.told) { e.told = 1; this.toast(o, 'Er komt een ei uit in je broedmachine! Ga gauw kijken.', 'good'); }
          continue;
        }
        inc.eggs.splice(i, 1); i--;
        this.hatchAnimal(o, inc, e.k);
      }
    }
  },

  hatchAnimal(p, inc, eggKind) {
    const w = this.worlds[inc.w];
    const a = rollAnimal(eggKind, () => this.rnd()), sh = rollShiny(() => this.rnd());
    // het dier springt naast de machine op de grond (niet erbovenop, anders staan ze op elkaar)
    const ang = this.rnd() * 6.283;
    const pet = { uid: this.meta.nextId++, kind: a.kind, a: a.key, sh, name: '', world: inc.w, x: inc.x + 0.5 + Math.cos(ang) * 1.4, y: inc.y + 1.05, z: inc.z + 0.5 + Math.sin(ang) * 1.4, mode: 'follow' };
    const full = this.animalPets(p).filter((d) => d.mode !== 'boek').length >= MAX_OUT;
    if (full) pet.mode = 'boek';
    p.pets.push(pet);
    if (!full) this.spawnEnt(w, a.kind, pet.x, pet.y, pet.z, { owner: p.name, pet, mode: 'follow' });
    const book = this.zooOf(p), first = !book[a.key];
    const rec = book[a.key] || (book[a.key] = { n: 0 });
    rec.n++;
    if (sh) rec[sh] = (rec[sh] || 0) + 1;
    this.fx(inc.w, 'hatch', inc.x + 0.5, inc.y + 1.2, inc.z + 0.5);
    const R = RARITY[a.rarity];
    this.addXp(p, 5 + R.i * 5 + (sh ? 20 : 0));
    const lines = ['Krak... krak... Het is ' + lidwoord((sh ? SHINY[sh].name + ' ' : '') + a.name) + '!'];
    lines.push('Zeldzaamheid: ' + R.name + (sh ? ' · en het is een shiny: ' + SHINY[sh].name + '!' : ''));
    lines.push(first ? 'Nieuw in je Dierenboek: nummer ' + a.nr + '. Je hebt nu ' + Object.keys(book).length + ' van de ' + ANIMAL_LIST.length + ' dieren.' : 'Deze soort had je al. Je hebt er nu ' + rec.n + ' uitgebroed.');
    lines.push(full ? 'Er lopen al ' + MAX_OUT + ' dieren met je mee, dus dit dier wacht in je Dierenboek (🐾). Daar kun je het roepen.' : 'Tik op het dier om het te laten wachten of weer mee te laten lopen. In je Dierenboek (🐾) geef je het een naam.');
    this.send(p, { t: 'dialog', title: 'Het ei komt uit!', lines });
    this.zooRewards(p);
    this.sendZoo(p);
    this.checkQuests(p);
  },

  // munten en een titel als je Dierenboek voller wordt
  zooRewards(p) {
    const n = Object.keys(this.zooOf(p)).length;
    let i = p.flags.zooR || 0;
    while (ZOO_REWARDS[i] && n >= ZOO_REWARDS[i].n) {
      const r = ZOO_REWARDS[i++];
      this.giveLoot(p, I.munt, r.munten, true);
      this.toast(p, '🐾 ' + r.n + ' dieren in je Dierenboek! Je krijgt ' + r.munten + ' munten en de titel "' + r.titel + '".', 'rank');
    }
    p.flags.zooR = i;
  },

  sendZoo(p) {
    const book = this.zooOf(p);
    this.send(p, {
      t: 'zoo', book, titel: zooTitle(Object.keys(book).length),
      pets: this.animalPets(p).map((d) => ({ uid: d.uid, a: d.a, sh: d.sh || '', name: d.name || '', mode: d.mode, world: d.world })),
    });
  },

  // het levende dier dat bij een regel in je lijst hoort (als het buiten rondloopt)
  petEnt(pet) {
    const w = this.worlds[pet.world];
    if (!w) return null;
    for (const e of w.ents.values()) if (e.pet === pet) return e;
    return null;
  },

  // knoppen in het Dierenboek: roepen, opbergen en een naam geven
  on_zoo(p, m) {
    const pet = this.animalPets(p).find((d) => d.uid === m.uid);
    if (!pet) return;
    const A = ANIMALS[pet.a], w = this.worlds[p.world];
    if (m.c === 'out') {
      if (pet.mode !== 'boek') {
        // hij loopt al buiten: naar je toe halen
        const e = this.petEnt(pet);
        pet.mode = 'follow';
        if (e && pet.world === p.world) { e.mode = 'follow'; e.x = p.x + 1; e.y = p.y + 0.2; e.z = p.z + 1; e.vy = 0; }
        else if (pet.world !== p.world) { if (e) this.worlds[pet.world].ents.delete(e.id); pet.world = p.world; pet.x = p.x + 1; pet.y = p.y + 0.2; pet.z = p.z + 1; this.spawnEnt(w, pet.kind, pet.x, pet.y, pet.z, { owner: p.name, pet, mode: 'follow' }); }
      } else {
        if (this.animalPets(p).filter((d) => d.mode !== 'boek').length >= MAX_OUT) { this.toast(p, 'Er kunnen ' + MAX_OUT + ' dieren tegelijk met je mee. Berg er eerst een op in je Dierenboek.', 'warn'); return; }
        pet.mode = 'follow'; pet.world = p.world; pet.x = p.x + 1; pet.y = p.y + 0.2; pet.z = p.z + 1;
        this.spawnEnt(w, pet.kind, pet.x, pet.y, pet.z, { owner: p.name, pet, mode: 'follow' });
        this.fx(p.world, 'hearts', pet.x, pet.y + 0.8, pet.z);
      }
    } else if (m.c === 'in') {
      const e = this.petEnt(pet);
      if (e) { this.fx(pet.world, 'poof', e.x, e.y + 0.5, e.z); this.worlds[pet.world].ents.delete(e.id); }
      pet.mode = 'boek';
    } else if (m.c === 'name') {
      pet.name = String(m.name || '').replace(/[<>&]/g, '').trim().slice(0, 16);
      const e = this.petEnt(pet);
      if (e) { e.name = pet.name; this.broadcast(pet.world, { t: 'entMeta', id: e.id, n: pet.name || A.name }); }
    }
    this.sendZoo(p);
  },

  // Opstappen. Op de meeste rijdieren rijd je over de grond; een paar kunnen vliegen.
  on_rideEnt(p, m) {
    const w = this.worlds[p.world], e = w.ents.get(m.id);
    if (!e || p.dead || p.mount || e.rider || e.owner !== p.name || !e.def.ride) return;
    if (Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z) > 6 + e.w) return;
    p.mount = e.id; e.rider = p.id; e.mode = 'follow'; e.vx = e.vy = e.vz = 0;
    if (e.pet) e.pet.mode = 'follow';
    this.send(p, { t: 'mount', id: e.id, s: e.scale, k: e.def.rideFly ? 'vlieg' : 'dier', seat: e.def.seat, sp: e.def.rideSp });
    this.sendZoo(p);
  },

  // voor het uitproberen (ontwikkelaarsmodus): een eigen dier naast je, zonder ei
  debugPet(p, key, sh) {
    const A = ANIMALS[key];
    if (!A) return;
    const pet = { uid: this.meta.nextId++, kind: A.kind, a: key, sh, name: '', world: p.world, x: p.x + 1.5, y: p.y + 0.2, z: p.z + 1.5, mode: 'follow' };
    p.pets.push(pet);
    this.spawnEnt(this.worlds[p.world], A.kind, pet.x, pet.y, pet.z, { owner: p.name, pet, mode: 'follow' });
    const rec = this.zooOf(p)[key] || (this.zooOf(p)[key] = { n: 0 });
    rec.n++;
    this.sendZoo(p);
  },

  // tik op je eigen dier: wachten of weer meelopen
  useAnimal(p, w, e) {
    if (e.owner !== p.name) return;
    e.mode = e.mode === 'stay' ? 'follow' : 'stay';
    if (e.pet) e.pet.mode = e.mode;
    this.fx(w.id, 'hearts', e.x, e.y + e.h * 0.8, e.z);
    const naam = (e.pet && e.pet.name) || e.def.name;
    this.toast(p, e.mode === 'stay' ? naam + ' blijft hier wachten.' : naam + ' loopt weer met je mee.');
    this.sendZoo(p);
  },
};
