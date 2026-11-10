// Wezens op de server: dieren, monsters, bazen, draken en projectielen.
// Deze functies worden aan GameServer geplakt (zie onderaan server.js).
import { CH, clamp, isNight } from '../shared/constants.js';
import { B, BLOCKS, B_SHAPE, SHAPE_LIQUID, EGG_TYPE } from '../shared/blocks.js';
import { I, ITEMS } from '../shared/items.js';
import { WORLDS } from '../shared/worlds.js';
import { MOBS, DRAGONS, BREATH, DRAGON_NAMES, dragonStage, dragonScale, STAGE_NAMES } from '../shared/mobs.js';
import { FOODS } from './quests.js';

// [soort, maximum in de buurt, wanneer]
const SPAWNS = {
  groen: [['pluizel', 3, 'day'], ['hert', 3, 'day'], ['pluizel', 2, 'any'], ['kruiper', 3, 'night'], ['robotspin', 2, 'night'], ['golem', 1, 'cave'], ['kruiper', 2, 'cave'],
    ['schaap', 1, 'day'], ['koe', 1, 'day'], ['wolf', 1, 'any'], ['beer', 1, 'day'], ['spin', 2, 'night'], ['skelet', 2, 'night'], ['spin', 2, 'cave'], ['skelet', 2, 'cave'], ['wildedraak', 1, 'sky']],
  ijs: [['ijswolf', 3, 'any'], ['pluizel', 2, 'day'], ['ijswolf', 4, 'night'], ['hert', 2, 'day'], ['beer', 1, 'day'], ['schaap', 1, 'day'], ['skelet', 2, 'night'], ['wildedraak', 1, 'sky']],
  vuur: [['vuurgeest', 4, 'any'], ['golem', 2, 'any'], ['skelet', 2, 'any'], ['wildedraak', 1, 'sky']],
  schaduw: [['schim', 3, 'any'], ['kruiper', 3, 'any'], ['pluizel', 2, 'any'], ['spin', 3, 'any'], ['skelet', 2, 'any'], ['wolf', 1, 'any'], ['wildedraak', 1, 'sky']],
  wolken: [['stormvleugel', 3, 'any'], ['pluizel', 3, 'any'], ['hert', 2, 'any'], ['schaap', 1, 'any'], ['wildedraak', 1, 'sky']],
};
// de adem van monsters die drakenvuur spuwen (de Drakenkoning)
const MONSTER_BREATH = { drakenvuur: BREATH.koning };

const r2 = (v) => Math.round(v * 100) / 100;

export const entityMethods = {

  playerByName(name) {
    for (const p of this.players.values()) if (p.name === name) return p;
    return null;
  },
  playerById(id) {
    for (const p of this.players.values()) if (p.id === id) return p;
    return null;
  },

  spawnEnt(w, kind, x, y, z, extra) {
    const def = MOBS[kind];
    const e = {
      id: this.meta.nextId++, kind, def, x, y, z, vx: 0, vy: 0, vz: 0, kx: 0, kz: 0,
      yaw: this.rnd() * 6.28, hp: def.hp, max: def.hp, scale: def.scale || 1, w: def.w, h: def.h,
      fly: !!def.fly, noclip: !!(def.boss && def.fly), onGround: false, wall: false,
      cd: 1, cd2: 3, cd3: 8, wt: 0, dirx: 0, dirz: 0, flee: 0, atk: 0, hurtT: 0, owner: null, mode: '', t: 0,
    };
    if (extra) Object.assign(e, extra);
    w.ents.set(e.id, e);
    return e;
  },

  entDesc(e) {
    const m = { t: 'spawn', id: e.id, k: e.kind, x: r2(e.x), y: r2(e.y), z: r2(e.z), yaw: r2(e.yaw), s: e.scale };
    if (e.owner) m.o = e.owner;
    if (e.dragon) { m.d = e.dragon.type; m.n = e.dragon.name; m.g = e.dragon.growth; }
    else {
      if (e.dtype) m.d = e.dtype;
      if (e.name) m.n = e.name;
    }
    return m;
  },

  findBoss(w) {
    for (const e of w.ents.values()) if (e.def.boss) return e;
    return null;
  },

  nearest(w, e, maxD) {
    let best = null, bd = maxD;
    for (const p of this.players.values()) {
      if (p.world !== w.id || p.dead) continue;
      const d = Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best ? { p: best, d: bd } : null;
  },

  // ---------- beweging ----------

  hits(w, x, y, z, hw, h) {
    const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw), y0 = Math.floor(y), y1 = Math.floor(y + h - 0.01);
    const z0 = Math.floor(z - hw), z1 = Math.floor(z + hw);
    for (let bx = x0; bx <= x1; bx++) for (let bz = z0; bz <= z1; bz++) for (let by = y0; by <= y1; by++) {
      if (w.solid(bx, by, bz)) return true;
    }
    return false;
  },

  moveWalk(w, e, dt) {
    const hw = e.w / 2 - 0.02;
    const inWater = B_SHAPE[w.get(Math.floor(e.x), Math.floor(e.y + 0.3), Math.floor(e.z))] === SHAPE_LIQUID;
    if (inWater) { e.vy += 10 * dt; if (e.vy > 2.5) e.vy = 2.5; }
    else e.vy -= 26 * dt;
    if (e.vy < -40) e.vy = -40;
    e.wall = false;
    const vx = e.vx + e.kx, vz = e.vz + e.kz;
    const nx = e.x + vx * dt;
    if (!this.hits(w, nx, e.y, e.z, hw, e.h)) e.x = nx; else e.wall = true;
    const nz = e.z + vz * dt;
    if (!this.hits(w, e.x, e.y, nz, hw, e.h)) e.z = nz; else e.wall = true;
    const ny = e.y + e.vy * dt;
    if (this.hits(w, e.x, ny, e.z, hw, e.h)) {
      if (e.vy < 0) {
        e.onGround = true;
        const snap = Math.floor(ny) + 1;
        if (snap <= e.y + 0.001 && !this.hits(w, e.x, snap, e.z, hw, e.h)) e.y = snap;
      }
      e.vy = 0;
    } else { e.y = ny; e.onGround = false; }
    if (e.wall && (e.onGround || inWater) && (e.vx || e.vz)) e.vy = e.scale > 2 ? 12 : 8.2;
    e.kx *= 0.86; e.kz *= 0.86;
  },

  moveFly(w, e, dt) {
    const hw = e.w / 2 - 0.02;
    const vx = e.vx + e.kx, vz = e.vz + e.kz;
    if (e.noclip) { e.x += vx * dt; e.y += e.vy * dt; e.z += vz * dt; }
    else {
      const nx = e.x + vx * dt;
      if (!this.hits(w, nx, e.y, e.z, hw, e.h)) e.x = nx;
      const nz = e.z + vz * dt;
      if (!this.hits(w, e.x, e.y, nz, hw, e.h)) e.z = nz;
      const ny = e.y + e.vy * dt;
      if (!this.hits(w, e.x, ny, e.z, hw, e.h)) e.y = ny;
    }
    if (e.y > CH + 20) e.y = CH + 20;
    e.kx *= 0.86; e.kz *= 0.86;
  },

  updateEntities(w, dt) {
    for (const e of w.ents.values()) {
      e.t += dt;
      if (e.cd > 0) e.cd -= dt;
      if (e.atk > 0) e.atk -= dt;
      if (e.hurtT > 0) e.hurtT -= dt;
      if (e.rider) continue;
      const ai = e.def.ai;
      if (e.poisonT > 0) {
        // gif: elke tel een beetje pijn
        e.poisonT -= dt; e.pt = (e.pt || 0) + dt;
        if (e.pt >= 1) { e.pt = 0; this.damageEntity(w, e, 2, this.playerById(e.poisonBy), 0, 0); if (e.dead) continue; }
      }
      if (ai === 'dragon') this.aiDragon(w, e, dt);
      else if (ai === 'boss') this.aiBoss(w, e, dt);
      else if (ai === 'passive') this.aiPassive(w, e, dt);
      else if (ai === 'melee') this.aiMelee(w, e, dt);
      else if (ai === 'wolf') this.aiWolf(w, e, dt);
      else if (ai === 'neutral') this.aiNeutral(w, e, dt);
      else if (ai === 'wilddragon') this.aiWildDragon(w, e, dt);
      else this.aiRanged(w, e, dt);
      if (e.dead) continue;
      if (e.slowT > 0) { e.slowT -= dt; e.vx *= 0.3; e.vz *= 0.3; if (e.fly) e.vy *= 0.3; }      // bevroren: heel traag
      if (e.fly) this.moveFly(w, e, dt); else this.moveWalk(w, e, dt);
      if (e.y < -30) { e.dead = true; w.ents.delete(e.id); }
    }
  },

  // ---------- gedrag ----------

  wander(w, e, dt) {
    e.wt -= dt;
    if (e.wt <= 0) {
      e.wt = 2 + this.rnd() * 4;
      if (this.rnd() < 0.4) { e.dirx = 0; e.dirz = 0; }
      else { const a = this.rnd() * 6.283; e.dirx = Math.sin(a); e.dirz = Math.cos(a); }
      // een kudde blijft bij elkaar: wie te ver afdwaalt loopt terug naar de voorste;
      // en wie bij een kamp of kasteel hoort, blijft daar in de buurt
      let tx = 0, tz = 0, far = 0;
      if (e.herd && e.herd !== e.id) { const L = w.ents.get(e.herd); if (L) { tx = L.x; tz = L.z; far = 5; } }
      else if (e.home && e.def.ai !== 'npc' && e.def.ai !== 'guard') { tx = e.home.x; tz = e.home.z; far = e.home.r; }
      if (far) { const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz); if (d > far) { e.dirx = dx / d; e.dirz = dz / d; e.wt = Math.min(4, d / (e.def.speed * 0.45)); } }
    }
    const sp = e.def.speed * 0.45;
    e.vx = e.dirx * sp; e.vz = e.dirz * sp;
    if (e.dirx || e.dirz) e.yaw = Math.atan2(e.dirx, e.dirz);
    if (e.fly) {
      let g = w.topY(Math.floor(e.x), Math.floor(e.z));
      if (g < 0) g = 56;
      e.vy = clamp(g + 5 - e.y, -2, 2);
    }
  },

  aiPassive(w, e, dt) {
    if (e.owner) {
      const o = this.playerByName(e.owner);
      if (!o || o.world !== w.id || e.mode === 'stay') { e.vx = 0; e.vz = 0; return; }
      const dx = o.x - e.x, dz = o.z - e.z, h = Math.hypot(dx, dz);
      if (h > 28 || Math.abs(o.y - e.y) > 14) { e.x = o.x + 1; e.y = o.y + 0.2; e.z = o.z + 1; e.vy = 0; return; }
      if (h > 3) { const sp = e.def.speed * 1.9; e.vx = dx / h * sp; e.vz = dz / h * sp; e.yaw = Math.atan2(dx, dz); }
      else { e.vx = 0; e.vz = 0; }
      return;
    }
    if (e.flee > 0) {
      e.flee -= dt;
      const dx = e.x - e.fx, dz = e.z - e.fz, h = Math.hypot(dx, dz) || 1;
      const sp = e.def.speed * 1.5;
      e.vx = dx / h * sp; e.vz = dz / h * sp; e.yaw = Math.atan2(dx, dz);
      return;
    }
    this.wander(w, e, dt);
  },

  aiMelee(w, e, dt) {
    const n = this.nearest(w, e, 20);
    if (!n) { this.wander(w, e, dt); return; }
    const p = n.p, sp = e.def.speed;
    const dx = p.x - e.x, dz = p.z - e.z, h = Math.hypot(dx, dz) || 1;
    e.yaw = Math.atan2(dx, dz);
    if (e.fly) {
      const dy = p.y + 0.9 - e.y, l = Math.hypot(dx, dy, dz) || 1;
      e.vx = dx / l * sp; e.vy = dy / l * sp; e.vz = dz / l * sp;
    } else if (h > 0.9) { e.vx = dx / h * sp; e.vz = dz / h * sp; }
    else { e.vx = 0; e.vz = 0; }
    if (n.d < e.w / 2 + 1.4 && e.cd <= 0) {
      e.cd = 1.3; e.atk = 0.4;
      this.hurtPlayer(p, e.def.dmg, e);
    }
    // spinnen springen op je af
    if (e.def.leap && e.onGround && h > 3 && h < 7 && e.cd2 <= 0) { e.cd2 = 2.5; e.vy = 8.5; e.kx = dx / h * 9; e.kz = dz / h * 9; }
    if (e.cd2 > 0) e.cd2 -= dt;
  },

  aiRanged(w, e, dt) {
    const n = this.nearest(w, e, 22);
    if (!n) { this.wander(w, e, dt); return; }
    const p = n.p, sp = e.def.speed;
    const dx = p.x - e.x, dz = p.z - e.z, h = Math.hypot(dx, dz) || 1;
    e.yaw = Math.atan2(dx, dz);
    if (h > 10) { e.vx = dx / h * sp; e.vz = dz / h * sp; }
    else if (h < 5) { e.vx = -dx / h * sp; e.vz = -dz / h * sp; }
    else { const s = Math.sin(e.t * 0.5 + e.id) > 0 ? 1 : -1; e.vx = -dz / h * sp * 0.5 * s; e.vz = dx / h * sp * 0.5 * s; }
    if (e.fly) e.vy = clamp(p.y + 2.2 - e.y, -2.5, 2.5);
    if (e.cd <= 0 && n.d < 18) {
      e.cd = 2.6; e.atk = 0.4;
      this.shootAt(w, e, p.x, p.y + 1, p.z, e.def.proj, e.def.dmg, 13, 'm', e.id, 0);
    }
  },

  aiBoss(w, e, dt) {
    const n = this.nearest(w, e, 110);
    if (!n) {
      e.lost = (e.lost || 0) + dt;
      e.vx = 0; e.vz = 0; if (e.fly) e.vy = 0;
      if (e.lost > 8) { e.dead = true; w.ents.delete(e.id); }
      return;
    }
    e.lost = 0;
    const p = n.p, d = n.d;
    const rage = e.hp < e.max * 0.5;
    const dx = p.x - e.x, dz = p.z - e.z, h = Math.hypot(dx, dz) || 1;
    e.yaw = Math.atan2(dx, dz);
    e.cd2 -= dt; e.cd3 -= dt;
    const fire = (count, spread, speed) => {
      for (let i = 0; i < count; i++) this.shootAt(w, e, p.x, p.y + 1, p.z, e.def.proj, e.def.dmg, speed, 'm', e.id, (i - (count - 1) / 2) * spread);
      e.atk = 0.5;
    };
    const flyTo = (tx, ty, tz, sp) => {
      const ex = tx - e.x, ey = ty - e.y, ez = tz - e.z, l = Math.hypot(ex, ey, ez) || 1;
      const s = Math.min(sp, l * 2);
      e.vx = ex / l * s; e.vy = ey / l * s; e.vz = ez / l * s;
    };

    if (e.kind === 'ijsreus' || e.kind === 'vuurtitaan') {
      const sp = e.def.speed * (rage ? 1.4 : 1);
      if (h > e.w / 2 + 1.2) { e.vx = dx / h * sp; e.vz = dz / h * sp; } else { e.vx = 0; e.vz = 0; }
      if (d < e.w / 2 + 2.8 && e.cd <= 0) {
        e.cd = 1.7; e.atk = 0.5;
        this.hurtPlayer(p, e.def.dmg, e);
        this.fx(w.id, 'slam', e.x, e.y, e.z);
      }
      if (e.cd2 <= 0 && h > 5) {
        e.cd2 = (e.kind === 'ijsreus' ? 3.2 : 2.6) * (rage ? 0.65 : 1);
        fire(e.kind === 'vuurtitaan' ? 3 : 1, 0.22, 15);
      }
    } else if (e.kind === 'schaduwheer') {
      e.orb = (e.orb || 0) + dt * 0.6;
      flyTo(p.x + Math.cos(e.orb) * 9, p.y + 2.5, p.z + Math.sin(e.orb) * 9, e.def.speed * 2);
      if (e.cd2 <= 0) { e.cd2 = rage ? 1.3 : 2.1; fire(rage ? 2 : 1, 0.25, 14); }
      if (e.cd3 <= 0) {
        e.cd3 = 10;
        this.fx(w.id, 'poof', e.x, e.y + 1.5, e.z, 2);
        e.orb += Math.PI;
        e.x = p.x + Math.cos(e.orb) * 9; e.z = p.z + Math.sin(e.orb) * 9; e.y = p.y + 2.5;
        this.fx(w.id, 'poof', e.x, e.y + 1.5, e.z, 2);
        let cnt = 0;
        for (const m of w.ents.values()) if (m.kind === 'schim') cnt++;
        for (let i = cnt; i < Math.min(cnt + 2, 3); i++) this.spawnEnt(w, 'schim', e.x + i * 2 - 1, e.y, e.z + 1);
      }
    } else {
      // stormwachter en drakenkoning: cirkelen, schieten en duiken
      const king = e.kind === 'drakenkoning';
      if (e.dive > 0) {
        e.dive -= dt;
        flyTo(p.x, p.y + 0.8, p.z, king ? 15 : 13);
        if (d < e.w / 2 + 1.8 && e.cd <= 0) { e.cd = 1.5; e.atk = 0.5; e.dive = 0; this.hurtPlayer(p, e.def.dmg + 2, e); }
      } else {
        e.orb = (e.orb || 0) + dt * (king ? 0.45 : 0.55);
        const R = king ? 18 : 15;
        flyTo(p.x + Math.cos(e.orb) * R, p.y + (king ? 10 : 8), p.z + Math.sin(e.orb) * R, e.def.speed * 1.6);
        if (e.cd2 <= 0) {
          e.cd2 = (king ? 2.6 : 2.2) * (rage ? 0.65 : 1);
          fire(king ? (rage ? 5 : 3) : 1, 0.16, king ? 17 : 20);
        }
        if (e.cd3 <= 0) { e.cd3 = king ? 11 : 8; e.dive = king ? 2.6 : 2.2; this.fx(w.id, 'roar', e.x, e.y, e.z); }
      }
    }
  },

  aiDragon(w, e, dt) {
    const o = this.playerByName(e.owner);
    const d = e.dragon;
    if (!o || o.world !== w.id || d.mode === 'stay') {
      e.vx = 0; e.vz = 0;
      if (e.fly) {
        const onGround = this.hits(w, e.x, e.y - 0.25, e.z, e.w / 2, e.h);
        e.vy = onGround ? 0 : -3;
        e.landed = onGround;
      }
      e.gx = undefined;
      return;
    }
    const stage = dragonStage(d.growth);
    const dx = o.x - e.x, dy = o.y - e.y, dz = o.z - e.z, dist = Math.hypot(dx, dy, dz);
    if (dist > (stage ? 46 : 26) || d.far || (e.t > 1 && this.hits(w, e.x, e.y + 0.1, e.z, 0.2, 0.5))) {
      d.far = 0;
      e.x = o.x + 1.5; e.y = o.y + (stage ? 2 : 0.3); e.z = o.z + 1.5; e.vy = 0;
      e.gx = undefined; e.landed = false;
      return;
    }
    if (!e.fly) {
      const h = Math.hypot(dx, dz);
      if (h > 2.6) { e.vx = dx / h * 4.4; e.vz = dz / h * 4.4; e.yaw = Math.atan2(dx, dz); }
      else { e.vx = 0; e.vz = 0; }
      return;
    }
    // Vliegend volgen. De draak kiest een plek schuin achter de speler en blijft daar, tot de
    // speler een paar blokken verder is gelopen. Draai je je om, dan blijft hij dus rustig op
    // zijn plek en kun je hem aantikken. Sta je even stil, dan landt hij naast je.
    const moved = e.gx === undefined ? 99 : Math.hypot(o.x - e.ax, o.y - e.ay, o.z - e.az);
    if (moved > 3) {
      const side = ((e.id % 3) - 1) * 1.4 + 1.0, rad = 1.7 + e.scale * 1.3;
      const sy = Math.sin(o.yaw), cy = Math.cos(o.yaw);
      e.gx = o.x + sy * rad + cy * side; e.gz = o.z + cy * rad - sy * side;
      e.ax = o.x; e.ay = o.y; e.az = o.z;
      e.still = 0; e.landed = false;
    }
    e.still = (e.still || 0) + dt;
    let gy = o.y + 0.7 + e.scale * 0.5 + Math.sin(e.t * 1.3) * 0.1;      // zweven op ooghoogte
    let landing = false;
    if (e.still > 2.5) {
      const gxi = Math.floor(e.gx), gzi = Math.floor(e.gz);
      const top = w.topY(gxi, gzi, Math.min(CH - 1, Math.floor(o.y) + 3));
      if (top > 0 && top + 1 > o.y - 5 && !w.liquid(gxi, top + 1, gzi)) { gy = top + 1; landing = true; }
    }
    const ex = e.gx - e.x, ey = gy - e.y, ez = e.gz - e.z;
    const l = Math.hypot(ex, ey, ez);
    if (l > 0.2) {
      const sp = Math.min(12, l * 2.4);
      e.vx = ex / l * sp; e.vy = ey / l * sp; e.vz = ez / l * sp;
      if (Math.hypot(ex, ez) > 1) e.yaw = Math.atan2(ex, ez);
      if (!landing) e.landed = false;
    } else {
      e.vx = 0; e.vy = 0; e.vz = 0;
      if (landing) { e.landed = true; e.y = gy; e.yaw = Math.atan2(o.x - e.x, o.z - e.z); }     // geland: op de grond staan en naar de speler kijken
    }
    // helpen in het gevecht
    if (e.cd <= 0) {
      e.cd = 0.5;
      let best = null, bd = 16;
      for (const m of w.ents.values()) {
        if (!this.hostile(m)) continue;
        const md = Math.hypot(m.x - o.x, m.y - o.y, m.z - o.z);
        if (md < bd) { bd = md; best = m; }
      }
      if (best) {
        e.cd = 1.9; e.atk = 0.4;
        e.still = 0; e.landed = false;                  // in een gevecht blijft hij in de lucht
        e.yaw = Math.atan2(best.x - e.x, best.z - e.z);
        const ox = e.x, oy = e.y + e.h * 0.65, oz = e.z;
        const bx = best.x - ox, by = best.y + best.h * 0.5 - oy, bz = best.z - oz, bl = Math.hypot(bx, by, bz) || 1;
        const off = e.w / 2 + 0.4;
        this.breathDir(w, ox + bx / bl * off, oy, oz + bz / bl * off, bx / bl, by / bl, bz / bl, d.type, 4 + stage * 4 + (d.level || 1), 'p', o.id, d.uid, 0.8);
      }
    }
  },

  // ---------- projectielen ----------

  shootAt(w, e, tx, ty, tz, kind, dmg, speed, side, owner, yawOff, duid) {
    const ox = e.x, oy = e.y + e.h * 0.65, oz = e.z;
    let dx = tx - ox, dy = ty - oy, dz = tz - oz;
    if (yawOff) { const c = Math.cos(yawOff), s = Math.sin(yawOff); const nx = dx * c - dz * s; dz = dx * s + dz * c; dx = nx; }
    const l = Math.hypot(dx, dy, dz) || 1;
    const off = e.w / 2 + 0.3;
    this.spawnProj(w, kind, ox + dx / l * off, oy, oz + dz / l * off, dx / l * speed, dy / l * speed, dz / l * speed, 0, dmg, side, owner, duid);
  },

  spawnProj(w, kind, x, y, z, vx, vy, vz, grav, dmg, side, owner, duid) {
    const pr = { id: this.meta.nextId++, k: kind, x, y, z, vx, vy, vz, g: grav, dmg, side, owner, duid, life: 4 };
    w.projs.push(pr);
    this.broadcast(w.id, { t: 'proj', id: pr.id, k: kind, x: r2(x), y: r2(y), z: r2(z), vx: r2(vx), vy: r2(vy), vz: r2(vz), g: grav, s: side });
    return pr;
  },

  updateProjectiles(w, dt) {
    for (let i = w.projs.length - 1; i >= 0; i--) {
      const pr = w.projs[i];
      pr.life -= dt;
      let end = pr.life <= 0, hitId = 0;
      if (!pr.b && pr.side === 'm' && MONSTER_BREATH[pr.k]) pr.b = MONSTER_BREATH[pr.k];
      const sp = Math.hypot(pr.vx, pr.vy, pr.vz);
      const steps = Math.max(1, Math.ceil(sp * dt / 0.45)), sdt = dt / steps;
      for (let s = 0; s < steps && !end; s++) {
        pr.vy -= pr.g * sdt;
        pr.x += pr.vx * sdt; pr.y += pr.vy * sdt; pr.z += pr.vz * sdt;
        if (w.solid(Math.floor(pr.x), Math.floor(pr.y), Math.floor(pr.z))) { end = true; break; }
        if (pr.side === 'p') {
          for (const e of w.ents.values()) {
            if (e.owner || (pr.seen && pr.seen.has(e.id))) continue;
            const hw = e.w / 2 + 0.25;
            if (pr.x > e.x - hw && pr.x < e.x + hw && pr.z > e.z - hw && pr.z < e.z + hw && pr.y > e.y - 0.25 && pr.y < e.y + e.h + 0.25) {
              const owner = this.playerById(pr.owner);
              this.damageEntity(w, e, pr.dmg, owner, pr.vx, pr.vz, pr.duid);
              hitId = e.id;
              if (pr.b) {
                this.breathHit(w, pr, e, owner);
                // schaduwvlam vliegt door een paar vijanden heen
                if (pr.b.pierce) { if (!pr.seen) pr.seen = new Set(); pr.seen.add(e.id); if (pr.seen.size < pr.b.pierce) continue; }
              }
              end = true; break;
            }
          }
        } else {
          for (const p of this.players.values()) {
            if (p.world !== w.id || p.dead) continue;
            const hw = p.mount ? 1.2 : 0.5;
            if (pr.x > p.x - hw && pr.x < p.x + hw && pr.z > p.z - hw && pr.z < p.z + hw && pr.y > p.y - (p.mount ? 1.5 : 0.2) && pr.y < p.y + 2) {
              this.hurtPlayer(p, pr.dmg, { x: pr.x - pr.vx, z: pr.z - pr.vz });
              end = true; break;
            }
          }
        }
      }
      if (end) {
        if (pr.b) this.breathEnd(w, pr, hitId);
        w.projs.splice(i, 1);
        this.broadcast(w.id, { t: 'projEnd', id: pr.id, x: r2(pr.x), y: r2(pr.y), z: r2(pr.z) });
      }
    }
  },

  // ---------- vechten ----------

  damageEntity(w, e, dmg, p, dx, dz, duid) {
    if (e.owner || e.dead) return;
    e.hp -= dmg; e.hurtT = 0.3;
    const ai = e.def.ai;
    if (ai === 'wolf' || ai === 'neutral' || ai === 'wilddragon') {
      // wie een wolf slaat krijgt de hele roedel achter zich aan
      e.angry = 14;
      if (e.herd) for (const m of w.ents.values()) if (m.herd === e.herd && !m.owner) m.angry = 14;
    } else if (ai === 'passive' && p && e.herd) {
      for (const m of w.ents.values()) if (m.herd === e.herd && m !== e) { m.flee = 4; m.fx = p.x; m.fz = p.z; }
    }
    this.fx(w.id, 'hit', e.x, e.y + e.h * 0.6, e.z);
    if (!e.def.boss) {
      const l = Math.hypot(dx, dz) || 1;
      e.kx = dx / l * 7; e.kz = dz / l * 7;
      if (e.onGround) e.vy = 4.5;
    }
    if (e.def.ai === 'passive' && p) { e.flee = 4; e.fx = p.x; e.fz = p.z; }
    if (e.hp <= 0) this.killEnt(w, e, p, duid);
  },

  killEnt(w, e, p, duid) {
    e.dead = true;
    w.ents.delete(e.id);
    this.fx(w.id, 'poof', e.x, e.y + e.h * 0.5, e.z, e.scale);
    if (e.def.boss) {
      this.meta.bossDead[e.def.boss] = true;
      for (const q of this.players.values()) {
        if (q.world !== w.id) continue;
        this.send(q, { t: 'bossDown', name: e.def.name });
        this.toast(q, 'De bewaker is verslagen! Raak nu het levenshart van de boom aan.', 'good');
      }
    }
    if (!p) return;
    if (e.dtype && this.rnd() < 0.3) this.giveLoot(p, this.eggOf(e.dtype), 1);      // een wilde draak laat soms een ei achter
    for (const [id, a, b, ch] of e.def.drops) {
      if (this.rnd() <= ch) this.giveLoot(p, id, a + Math.floor(this.rnd() * (b - a + 1)));
    }
    p.kills++;
    this.addXp(p, e.def.xp);
    if (duid) {
      const d = p.dragons.find((q) => q.uid === duid);
      if (d) {
        d.xp = (d.xp || 0) + 1;
        const lv = Math.min(10, 1 + Math.floor(d.xp / 4));
        if (lv > (d.level || 1)) { d.level = lv; this.toast(p, d.name + ' is nu level ' + lv + '!', 'good'); this.sendDragons(p); }
      }
    }
    this.sendInv(p);
    this.checkQuests(p);
  },

  hurtPlayer(p, dmg, src) {
    if (p.dead || p.god) return;
    dmg = Math.max(1, Math.round(dmg * (1 - this.armor(p))));
    p.hp -= dmg;
    p.lastHurt = this.meta.time;
    let kx = 0, kz = 0;
    if (src) { const dx = p.x - src.x, dz = p.z - src.z, l = Math.hypot(dx, dz) || 1; kx = dx / l; kz = dz / l; }
    if (p.hp <= 0) {
      p.hp = 0; p.dead = true;
      if (p.mount) this.on_dismount(p);
      this.send(p, { t: 'dead' });
    }
    this.send(p, { t: 'hurt', hp: p.hp, kx, kz });
    this.sendStats(p);
  },

  on_hurtSelf(p, m) {
    if (p.dead) return;
    const t = this.meta.trees;
    if (m.k === 'fall' && t.wolken) return;
    if (m.k === 'lava' && t.vuur) return;
    this.hurtPlayer(p, clamp(m.n | 0, 1, 20), null);
  },

  on_attack(p, m) {
    const w = this.worlds[p.world];
    const e = w.ents.get(m.id);
    if (!e || p.dead || e.owner) return;
    if (this.meta.time - p.atkCd < 0.22) return;
    p.atkCd = this.meta.time;
    if (Math.hypot(e.x - p.x, e.y + e.h / 2 - p.y - 1, e.z - p.z) > 5.5 + e.w) return;
    const s = p.inv[p.sel], it = s && ITEMS[s.id];
    const dmg = ((it && it.dmg) || 1) + Math.floor(p.level / 5);
    this.damageEntity(w, e, dmg, p, e.x - p.x, e.z - p.z);
    if (this.wear(p)) this.sendInv(p);
  },

  on_shoot(p, m) {
    if (p.dead) return;
    const w = this.worlds[p.world];
    const t = this.meta.time;
    let dx = +m.dx || 0, dy = +m.dy || 0, dz = +m.dz || 0;
    const l = Math.hypot(dx, dy, dz);
    if (!l) return;
    dx /= l; dy /= l; dz /= l;
    if (p.mount) {
      const e = w.ents.get(p.mount);
      if (!e || !e.dragon) return;                       // op een trein kun je niet schieten
      const d = e.dragon, b = BREATH[d.type] || BREATH.vuur;
      if (t - p.shootCd < b.cd - 0.05) return;
      p.shootCd = t;
      const off = 2.2 * e.scale;
      this.breathDir(w, p.x + dx * off, p.y + 0.4 + dy * off, p.z + dz * off, dx, dy, dz, d.type, 10 + (d.level || 1) * 2, 'p', p.id, d.uid);
      this.fx(w.id, 'breath', p.x + dx * off, p.y + 0.4 + dy * off, p.z + dz * off);
      return;
    }
    const s = p.inv[p.sel], it = s && ITEMS[s.id];
    if (!it || !it.ranged) return;
    const r = it.ranged;
    if (t - p.shootCd < r.cd) return;
    p.shootCd = t;
    if (r.ammo) {
      if (!this.take(p, r.ammo, 1)) { this.toast(p, 'Je hebt geen pijlen meer!', 'warn'); return; }
      this.sendInv(p);
    }
    if (this.wear(p)) this.sendInv(p);
    this.spawnProj(w, r.proj, p.x + dx * 0.7, p.y + 1.5 + dy * 0.7, p.z + dz * 0.7, dx * r.speed, dy * r.speed, dz * r.speed, r.grav, r.dmg + Math.floor(p.level / 5), 'p', p.id);
    this.send(p, { t: 'shot', k: r.proj });
  },

  // ---------- temmen en draken ----------

  on_useEnt(p, m) {
    const w = this.worlds[p.world];
    const e = w.ents.get(m.id);
    if (!e || Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z) > 7 + e.w) return;
    if (e.kind === 'draak' && e.owner === p.name) { this.send(p, { t: 'dragonMenu', uid: e.dragon.uid }); return; }
    if (e.kind !== 'pluizel') { if (!p.dead && this.useNpc(p, w, e)) this.checkQuests(p); return; }
    if (e.kind === 'pluizel') {
      if (e.owner === p.name) {
        e.mode = e.mode === 'stay' ? 'follow' : 'stay';
        if (e.pet) e.pet.mode = e.mode;
        this.fx(w.id, 'hearts', e.x, e.y + 0.8, e.z);
        this.toast(p, e.mode === 'stay' ? 'Je Pluizel blijft hier wachten.' : 'Je Pluizel loopt weer met je mee.');
        return;
      }
      if (e.owner) return;
      const s = p.inv[p.sel];
      if (s && s.id === I.bessen) {
        s.n--; if (s.n <= 0) p.inv[p.sel] = null;
        e.tameN = (e.tameN || 0) + 1;
        this.fx(w.id, 'hearts', e.x, e.y + 0.8, e.z);
        if (e.tameN >= 2) {
          e.owner = p.name; e.mode = 'follow'; e.flee = 0;
          e.pet = { uid: this.meta.nextId++, kind: 'pluizel', world: w.id, x: e.x, y: e.y, z: e.z, mode: 'follow' };
          p.pets.push(e.pet);
          this.toast(p, 'De Pluizel is nu je vriendje!', 'good');
          this.addXp(p, 15);
        } else this.toast(p, 'De Pluizel vindt de bessen lekker! Geef er nog een.');
        this.sendInv(p);
      } else this.toast(p, 'Pluizels zijn dol op bessen. Houd bessen vast en tik op de Pluizel.');
    }
  },

  sendDragons(p) {
    this.send(p, { t: 'dragons', l: p.dragons.map((d) => ({ uid: d.uid, type: d.type, name: d.name, growth: d.growth, mode: d.mode, world: d.world, level: d.level || 1, eid: d.eid || 0 })) });
  },

  applyDragon(e) {
    const d = e.dragon, stage = dragonStage(d.growth);
    e.scale = dragonScale(d.growth);
    e.fly = stage >= 1;
    e.w = 0.9 * e.scale + 0.3; e.h = 1.0 * e.scale + 0.2;
    e.max = Math.round((30 + stage * 40) * (DRAGONS[d.type].hp || 1)); e.hp = e.max;
  },

  on_dragon(p, m) {
    const d = p.dragons.find((q) => q.uid === m.uid);
    if (!d) return;
    const w = this.worlds[p.world];
    let e = d.eid && d.world === p.world ? w.ents.get(d.eid) : null;
    if (m.cmd === 'feed') {
      if (!e) return;
      if (d.growth >= 100) { this.toast(p, d.name + ' is al volwassen en zit lekker vol.'); return; }
      let food = 0;
      const s = p.inv[p.sel];
      if (s && ITEMS[s.id] && ITEMS[s.id].food && s.id !== I.drankje) { food = s.id; }
      else for (const f of FOODS) if (this.count(p, f) > 0) { food = f; break; }
      if (!food) { this.toast(p, 'Je hebt geen eten. Draken lusten bessen, appels en vlees.', 'warn'); return; }
      this.take(p, food, 1);
      const before = dragonStage(d.growth);
      d.growth = Math.min(100, d.growth + ITEMS[food].food * 3.5);
      const after = dragonStage(d.growth);
      this.applyDragon(e);
      this.fx(w.id, 'hearts', e.x, e.y + e.h, e.z);
      this.broadcast(w.id, { t: 'entMeta', id: e.id, s: e.scale, g: d.growth });
      if (after !== before) {
        this.fx(w.id, 'grow', e.x, e.y + e.h * 0.5, e.z);
        this.toast(p, d.name + ' is nu een ' + STAGE_NAMES[after].toLowerCase() + '!', 'good');
        this.addXp(p, 30);
      }
      this.sendInv(p); this.sendDragons(p); this.checkQuests(p);
    } else if (m.cmd === 'follow' || m.cmd === 'stay') {
      d.mode = m.cmd;
      if (e) e.mode = m.cmd;
      this.sendDragons(p);
    } else if (m.cmd === 'call') {
      this.syncOwned(p);
      if (d.eid) { const old = this.worlds[d.world].ents.get(d.eid); if (old) { if (old.rider) return; this.worlds[d.world].ents.delete(d.eid); } }
      d.world = p.world; d.x = p.x + 1.5; d.y = p.y + 0.5; d.z = p.z + 1.5; d.mode = 'follow';
      e = this.spawnEnt(w, 'draak', d.x, d.y, d.z, { owner: p.name, dragon: d, mode: d.mode });
      this.applyDragon(e); d.eid = e.id;
      this.fx(w.id, 'poof', d.x, d.y + 0.5, d.z, 1);
      this.sendDragons(p);
    } else if (m.cmd === 'mount') {
      if (!e) return;
      if (dragonStage(d.growth) < 2) { this.toast(p, d.name + ' is nog te klein om op te vliegen. Geef hem meer eten!'); return; }
      if (Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z) > 10) { this.toast(p, 'Ga dichter bij je draak staan.'); return; }
      p.mount = e.id; e.rider = p.id; d.mode = 'follow'; e.mode = 'follow';
      this.send(p, { t: 'mount', id: e.id, s: e.scale });
      p.flags.flown = 1;
      this.checkQuests(p);
    } else if (m.cmd === 'name') {
      const nm = String(m.name || '').trim().slice(0, 16);
      if (nm) { d.name = nm; if (e) this.broadcast(w.id, { t: 'entMeta', id: e.id, n: nm }); this.sendDragons(p); }
    }
  },

  on_dismount(p) {
    if (!p.mount) return;
    const e = this.worlds[p.world].ents.get(p.mount);
    if (e) { e.rider = 0; e.vx = e.vy = e.vz = 0; }
    p.mount = 0;
    this.send(p, { t: 'mount', id: 0 });
  },

  spawnOwned(p) {
    const w = this.worlds[p.world];
    for (const d of p.dragons) {
      d.eid = 0;
      if (d.world !== p.world) continue;
      const e = this.spawnEnt(w, 'draak', d.x, d.y, d.z, { owner: p.name, dragon: d, mode: d.mode });
      this.applyDragon(e);
      d.eid = e.id;
    }
    for (const d of p.pets) {
      if (d.world !== p.world) continue;
      this.spawnEnt(w, d.kind, d.x, d.y, d.z, { owner: p.name, pet: d, mode: d.mode });
    }
    this.sendDragons(p);
  },

  syncOwned(p) {
    const w = this.worlds[p.world];
    for (const e of w.ents.values()) {
      if (e.owner !== p.name) continue;
      const rec = e.dragon || e.pet;
      if (rec) { rec.x = r2(e.x); rec.y = r2(e.y); rec.z = r2(e.z); rec.world = w.id; }
    }
  },

  removeOwned(p, w) {
    for (const e of w.ents.values()) {
      if (e.owner !== p.name) continue;
      w.ents.delete(e.id);
      if (e.dragon) e.dragon.eid = 0;
    }
  },

  updateEggs() {
    for (const key in this.meta.eggs) {
      const g = this.meta.eggs[key];
      const o = this.playerByName(g.owner);
      if (!o || o.world !== g.w || Math.hypot(o.x - g.x, o.z - g.z) > 70) continue;
      const w = this.worlds[g.w];
      if (!EGG_TYPE[w.get(g.x, g.y, g.z)]) { delete this.meta.eggs[key]; continue; }
      let warm = false;
      for (let dx = -2; dx <= 2 && !warm; dx++) for (let dz = -2; dz <= 2 && !warm; dz++) for (let dy = -1; dy <= 1; dy++) {
        const id = w.get(g.x + dx, g.y + dy, g.z + dz);
        if (id === B.kampvuur || id === B.lava || id === B.oven || id === B.magmasteen) { warm = true; break; }
      }
      g.warm = warm;
      if (!warm) continue;
      g.prog += 1 / 40;
      if (Math.floor(g.prog * 40) % 4 === 0) this.fx(g.w, 'eggwarm', g.x + 0.5, g.y + 0.5, g.z + 0.5);
      if (g.prog >= 1) {
        delete this.meta.eggs[key];
        this.setBlock(w, g.x, g.y, g.z, 0);
        const d = { uid: this.meta.nextId++, type: g.type, name: DRAGON_NAMES[Math.floor(this.rnd() * DRAGON_NAMES.length)], growth: 0, mode: 'follow', world: g.w, x: g.x + 0.5, y: g.y, z: g.z + 0.5, level: 1, xp: 0, eid: 0 };
        o.dragons.push(d);
        const e = this.spawnEnt(w, 'draak', d.x, d.y, d.z, { owner: o.name, dragon: d, mode: 'follow' });
        this.applyDragon(e);
        d.eid = e.id;
        this.fx(g.w, 'hatch', g.x + 0.5, g.y + 0.5, g.z + 0.5);
        this.send(o, { t: 'dialog', title: 'Het ei komt uit!', lines: ['Krak... krak... Het is een ' + DRAGONS[g.type].name.toLowerCase() + '!', 'Je babydraak heet ' + d.name + '. Tik op hem om hem eten te geven of een andere naam te kiezen.', 'Zijn kracht: ' + DRAGONS[g.type].power, 'Geef hem bessen, appels of vlees. Dan groeit hij tot je op hem kunt vliegen!'] });
        this.sendDragons(o);
        this.addXp(o, 40);
        this.checkQuests(o);
      }
    }
  },

  // ---------- wilde wezens ----------

  wildSpawn(p) {
    const w = this.worlds[p.world];
    const table = SPAWNS[p.world];
    const night = WORLDS[p.world].cycle ? isNight(this.meta.time) : true;
    const [kind, cap, when] = table[Math.floor(this.rnd() * table.length)];
    if (when === 'day' && night) return;
    if (when === 'night' && !night) return;
    const under = when === 'cave', sky = when === 'sky';
    if (under && p.y > 34) return;
    if (sky && this.rnd() > 0.12) return;                   // wilde draken zijn zeldzaam
    const def = MOBS[kind];
    // tellen: bewoners van dorpen en kastelen tellen niet mee, en een kudde telt als één
    let n = 0, total = 0, herds = 0;
    for (const e of w.ents.values()) {
      if (e.owner || e.site || e.keep) continue;
      if (e.herd) { if (e.herd !== e.id) continue; herds++; if (e.kind === kind && Math.hypot(e.x - p.x, e.z - p.z) < 90) n++; continue; }
      total++;
      if (e.kind === kind && Math.hypot(e.x - p.x, e.z - p.z) < (sky ? 160 : 70)) n++;
    }
    if (n >= cap || (def.herd ? herds >= 3 : total >= 14)) return;
    const a = this.rnd() * 6.283, r = 22 + this.rnd() * 20;
    const x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
    const hostile = def.ai === 'melee' || def.ai === 'ranged' || def.ai === 'wolf';
    if (hostile && p.spawn && p.spawn.w === p.world && Math.hypot(p.spawn.x - x, p.spawn.z - z) < 28) return;
    const T = WORLDS[p.world].tree;
    if (Math.hypot(T.x - x, T.z - z) < 30) return;
    let y;
    if (under) {
      y = -1;
      for (let yy = Math.floor(p.y) + 6; yy > Math.max(3, Math.floor(p.y) - 8); yy--) {
        if (w.solid(x, yy - 1, z) && !w.get(x, yy, z) && !w.get(x, yy + 1, z)) { y = yy; break; }
      }
      if (y < 0) return;
    } else {
      const top = w.topY(x, z);
      if (sky) {
        const dx = Math.floor(p.x + Math.cos(a) * 60), dz = Math.floor(p.z + Math.sin(a) * 60);
        const e = this.spawnEnt(w, kind, dx + 0.5, Math.max(top, 50) + 22 + this.rnd() * 10, dz + 0.5);
        e.dtype = this.wildDragonType(p.world);
        e.name = this.wildDragonName(e.dtype);
        e.home = { x: e.x, y: e.y, z: e.z, r: 30 };
        return;
      }
      if (top < 2) { if (!def.fly) return; y = 58 + this.rnd() * 20; }
      else {
        if (w.liquid(x, top + 1, z)) return;
        y = top + 1 + (def.fly ? 3 + this.rnd() * 4 : 0);
        if (def.herd && def.ai !== 'wolf') { const snd = BLOCKS[w.get(x, top, z)].snd; if (snd !== 'grass' && snd !== 'snow') return; }      // kuddes grazen op gras
      }
    }
    if (def.herd) this.spawnHerd(w, kind, x, y, z);
    else this.spawnEnt(w, kind, x + 0.5, y, z + 0.5);
  },

  cleanup(w) {
    const day = WORLDS[w.id].cycle && !isNight(this.meta.time);
    for (const e of w.ents.values()) {
      if (e.owner || e.def.boss) continue;
      let near = false;
      for (const p of this.players.values()) if (p.world === w.id && Math.hypot(p.x - e.x, p.z - e.z) < 90) { near = true; break; }
      if (!near) { w.ents.delete(e.id); continue; }
      if (day && w.id === 'groen' && (e.kind === 'kruiper' || e.kind === 'robotspin' || e.kind === 'spin' || e.kind === 'skelet') && e.y > 36 && this.rnd() < 0.2) {
        this.fx(w.id, 'poof', e.x, e.y + 0.5, e.z, 1);
        w.ents.delete(e.id);
      }
    }
  },

  wakeGuardian(w, T) {
    const def = MOBS[T.guardian];
    const x = T.x + 0.5, z = T.z + 17.5;
    let y;
    if (def.fly) y = T.y + 14;
    else { const top = w.topY(Math.floor(x), Math.floor(z)); y = (top > 0 ? top : T.y) + 1; }
    this.spawnEnt(w, T.guardian, x, y, z);
    this.fx(w.id, 'roar', x, y, z);
    for (const q of this.players.values()) if (q.world === w.id) this.toast(q, 'De bewaker ontwaakt: ' + def.name + '!', 'boss');
  },

  checkGuardian(p) {
    const w = this.worlds[p.world];
    const T = WORLDS[p.world].tree, t = this.meta.trees;
    if (t[T.key] || this.meta.bossDead[T.key]) return;
    if (T.key === 'groen' && !(t.ijs && t.vuur && t.schaduw && t.wolken)) return;
    if (Math.hypot(p.x - T.x, p.z - T.z) < 38 && Math.abs(p.y - T.y) < 40 && !this.findBoss(w)) this.wakeGuardian(w, T);
  },

  // ---------- momentopnames naar de spelers ----------

  snapshots() {
    for (const p of this.players.values()) {
      const w = this.worlds[p.world];
      const list = [];
      const seen = new Set();
      let boss = null;
      for (const e of w.ents.values()) {
        const far = e.def.boss ? 140 : 84;
        if (Math.abs(e.x - p.x) > far || Math.abs(e.z - p.z) > far) continue;
        seen.add(e.id);
        if (!p.known.has(e.id)) { p.known.add(e.id); this.send(p, this.entDesc(e)); }
        const flags = (e.atk > 0 ? 1 : 0) | ((e.fly && !e.landed) ? 2 : 0) | (e.mode === 'stay' ? 4 : 0) | (e.hurtT > 0 ? 8 : 0) | (e.slowT > 0 ? 16 : 0) | (e.poisonT > 0 ? 32 : 0);
        list.push(e.id, r2(e.x), r2(e.y), r2(e.z), r2(e.yaw), flags, r2(e.hp / e.max));
        if (e.def.boss) boss = [e.def.name, r2(e.hp / e.max)];
      }
      for (const id of p.known) if (!seen.has(id)) { p.known.delete(id); this.send(p, { t: 'despawn', id }); }
      this.send(p, { t: 'ents', l: list, boss });
    }
  },
};
