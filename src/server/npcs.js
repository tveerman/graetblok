// Het leven in de wereld: dorpelingen en handel, ridders en bewakers, kuddes, wolven, beren,
// wilde draken, het weer en de treinen.
// Deze functies worden aan GameServer geplakt (zie onderaan server.js).
import { DAY_LENGTH, clamp, isNight } from '../shared/constants.js';
import { B, BLOCKS, EGGS } from '../shared/blocks.js';
import { I, ITEMS, itemName, maxStack, matches, GROUP_NAMES } from '../shared/items.js';
import { WORLDS, WORLD_ORDER } from '../shared/worlds.js';
import { MOBS, DRAGONS } from '../shared/mobs.js';


// Het weer per wereld: [soort, kans]. De rest van de tijd schijnt de zon.
const WEATHER = {
  groen: [['regen', 0.3], ['onweer', 0.14]],
  ijs: [['sneeuw', 0.4], ['storm', 0.14]],
  wolken: [['regen', 0.18]],
  schaduw: [['regen', 0.2], ['onweer', 0.1]],
};

export const npcMethods = {

  // Is dit een vijand voor ridders, boomwachters, tamme wolven en je draak?
  hostile(m) {
    if (m.owner || m.dead || m.site === 'x') return false;
    const ai = m.def.ai;
    return ai === 'melee' || ai === 'ranged' || ai === 'boss' || ((ai === 'wolf' || ai === 'neutral' || ai === 'wilddragon') && m.angry > 0);
  },

  // ---------- het weer ----------

  weatherOf(wid) { const s = this.meta.weather && this.meta.weather[wid]; return s ? s.k : 'zon'; },

  setWeather(wid, k, dur) {
    if (!this.meta.weather) this.meta.weather = {};
    this.meta.weather[wid] = { k, until: this.meta.time + dur, bolt: 4 };
    this.broadcast(wid, { t: 'weather', k });
  },

  updateWeather(active) {
    for (const wid of WORLD_ORDER) {
      const table = WEATHER[wid];
      if (!table) continue;
      let s = this.meta.weather && this.meta.weather[wid];
      if (!s || this.meta.time >= s.until) {
        let k = 'zon';
        if (s && s.k === 'zon') {
          const r = this.rnd();
          let acc = 0;
          for (const [name, odds] of table) { acc += odds; if (r < acc) { k = name; break; } }
        }
        this.setWeather(wid, k, k === 'zon' ? 150 + this.rnd() * 240 : 70 + this.rnd() * 110);
        s = this.meta.weather[wid];
      }
      if (s.k === 'onweer' && active.has(wid)) {
        s.bolt = (s.bolt || 0) - 1;
        if (s.bolt <= 0) { s.bolt = 3 + this.rnd() * 8; this.lightning(wid); }
      }
    }
  },

  // De bliksem slaat ergens in de buurt van een speler in (nooit precies op de speler).
  lightning(wid) {
    const w = this.worlds[wid];
    const ps = [];
    for (const p of this.players.values()) if (p.world === wid && !p.dead) ps.push(p);
    if (!ps.length) return;
    const p = ps[Math.floor(this.rnd() * ps.length)];
    const a = this.rnd() * 6.283, r = 10 + this.rnd() * 38;
    const x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
    const top = w.topY(x, z);
    if (top < 2) return;
    this.fx(wid, 'bolt', x + 0.5, top + 1, z + 0.5);
    for (const e of Array.from(w.ents.values())) {
      if (!this.hostile(e)) continue;
      if (Math.hypot(e.x - x, e.z - z) < 4 && Math.abs(e.y - top) < 6) this.damageEntity(w, e, 24, null, e.x - x, e.z - z);
    }
  },

};

void clamp; void BLOCKS; void matches;