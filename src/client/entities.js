// Wezens en projectielen aan de kant van het spel: modellen laten zien en vloeiend bewegen.
import * as THREE from '../../vendor/three.module.min.js';
import { MOBS, PROJ, dragonScale } from '../shared/mobs.js';
import { buildModel, animate, setDragonGrowth } from './models.js';
import { glowTex, nameTex } from './textures.js';

const DELAY = 0.12;   // we tonen wezens een klein beetje in het verleden, dat oogt vloeiend

export class Entities {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.map = new Map();
    this.projs = new Map();
    this.world = 'groen';
    this.clock = 0;
    this.ridden = 0;
    this.glow = glowTex();
    this.barBg = new THREE.SpriteMaterial({ color: 0x200808, depthTest: false, fog: false });
    this.barFg = new THREE.SpriteMaterial({ color: 0xff3a3a, depthTest: false, fog: false });
    this.arrowGeo = new THREE.BoxGeometry(0.06, 0.06, 0.7);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0xd8c9a0 });
  }

  clear() {
    for (const e of this.map.values()) this.scene.remove(e.group);
    this.map.clear();
    for (const p of this.projs.values()) this.scene.remove(p.obj);
    this.projs.clear();
    this.ridden = 0;
  }

  spawn(m) {
    if (this.map.has(m.id)) this.despawn(m.id);
    const def = MOBS[m.k];
    const group = buildModel(m.k, { world: this.world, dtype: m.d, growth: m.g });
    group.scale.setScalar(m.s);
    group.position.set(m.x, m.y, m.z);
    group.rotation.y = m.yaw;
    this.scene.add(group);
    const e = {
      id: m.id, kind: m.k, def, group, scale: m.s, owner: m.o || null, dtype: m.d || null, name: m.n || null, growth: m.g || 0,
      px: m.x, py: m.y, pz: m.z, pyaw: m.yaw, pt: this.clock,
      nx: m.x, ny: m.y, nz: m.z, nyaw: m.yaw, nt: this.clock,
      x: m.x, y: m.y, z: m.z, yaw: m.yaw, flags: 0, hp: 1, speed: 0, bar: null, tag: null, lastX: m.x, lastZ: m.z,
      w: def.w * (m.k === 'draak' ? 1 : 1), h: def.h,
    };
    this.resize(e);
    if (e.name) this.setName(e, e.name);
    this.map.set(m.id, e);
  }

  resize(e) {
    if (e.kind === 'draak' && !e.def.boss) { e.w = 0.9 * e.scale + 0.3; e.h = 1.0 * e.scale + 0.2; }
    else { e.w = e.def.w; e.h = e.def.h; }
  }

  setName(e, name) {
    if (e.tag) { e.group.remove(e.tag); e.tag.material.map.dispose(); e.tag.material.dispose(); }
    e.name = name;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTex(name), depthTest: false, fog: false, transparent: true }));
    sp.scale.set(1.6 / e.scale, 0.4 / e.scale, 1);
    sp.position.y = 2.3;
    sp.renderOrder = 10;
    e.group.add(sp);
    e.tag = sp;
  }

  meta(m) {
    const e = this.map.get(m.id);
    if (!e) return;
    if (m.s !== undefined) { e.scale = m.s; e.group.scale.setScalar(m.s); this.resize(e); if (e.tag) e.tag.scale.set(1.6 / e.scale, 0.4 / e.scale, 1); }
    if (m.g !== undefined) { e.growth = m.g; setDragonGrowth(e.group, m.g); }
    if (m.n !== undefined) this.setName(e, m.n);
  }

  despawn(id) {
    const e = this.map.get(id);
    if (!e) return;
    this.scene.remove(e.group);
    this.map.delete(id);
  }

  snapshot(list) {
    const t = this.clock;
    for (let i = 0; i < list.length; i += 7) {
      const e = this.map.get(list[i]);
      if (!e) continue;
      e.px = e.x; e.py = e.y; e.pz = e.z; e.pyaw = e.yaw; e.pt = t;
      e.nx = list[i + 1]; e.ny = list[i + 2]; e.nz = list[i + 3]; e.nyaw = list[i + 4]; e.nt = t + DELAY;
      // ver weg gesprongen (teleport)? dan niet glijden
      if (Math.abs(e.nx - e.px) + Math.abs(e.ny - e.py) + Math.abs(e.nz - e.pz) > 12) { e.px = e.nx; e.py = e.ny; e.pz = e.nz; }
      e.flags = list[i + 5];
      const hp = list[i + 6];
      if (hp !== e.hp) { e.hp = hp; this.updateBar(e); }
    }
  }

  updateBar(e) {
    if (e.def.boss || e.owner) return;
    if (e.hp >= 1) { if (e.bar) { e.group.remove(e.bar.bg); e.group.remove(e.bar.fg); e.bar = null; } return; }
    if (!e.bar) {
      const bg = new THREE.Sprite(this.barBg), fg = new THREE.Sprite(this.barFg);
      bg.center.set(0, 0.5); fg.center.set(0, 0.5);
      bg.renderOrder = 9; fg.renderOrder = 10;
      const y = e.def.h / e.scale + 0.35;
      bg.position.set(-0.4, y, 0); fg.position.set(-0.4, y, 0);
      bg.scale.set(0.8, 0.09, 1);
      e.group.add(bg, fg);
      e.bar = { bg, fg };
    }
    e.bar.fg.scale.set(0.8 * Math.max(0.02, e.hp), 0.09, 1);
  }

  update(dt, time, player) {
    this.clock += dt;
    const t = this.clock;
    for (const e of this.map.values()) {
      if (e.id === this.ridden) {
        // de draak waar je op zit volgt jou precies
        e.x = player.pos.x; e.z = player.pos.z; e.y = player.pos.y - 0.2 - 1.15 * e.scale; e.yaw = player.yaw + Math.PI;
        e.speed = 5; e.flags = 2;
        e.group.rotation.x = -player.pitch * 0.5;
      } else {
        let a = (t - e.pt) / Math.max(0.001, e.nt - e.pt);
        if (a > 1.3) a = 1.3; if (a < 0) a = 0;
        const ox = e.x, oz = e.z;
        e.x = e.px + (e.nx - e.px) * a; e.y = e.py + (e.ny - e.py) * a; e.z = e.pz + (e.nz - e.pz) * a;
        let dy = e.nyaw - e.pyaw;
        while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
        e.yaw = e.pyaw + dy * Math.min(1, a);
        const sp = dt > 0 ? Math.hypot(e.x - ox, e.z - oz) / dt : 0;
        e.speed += (sp - e.speed) * Math.min(1, dt * 10);
        e.group.rotation.x = 0;
      }
      e.group.position.set(e.x, e.y, e.z);
      e.group.rotation.y = e.yaw;
      const hurt = e.flags & 8;
      const s = e.scale * (hurt ? 1.08 : 1);
      if (e.group.scale.x !== s) e.group.scale.setScalar(s);
      animate(e.group, time, e.speed, e.flags, dt);
    }
    // projectielen
    for (const p of this.projs.values()) {
      p.life -= dt;
      if (p.life <= 0) { this.scene.remove(p.obj); this.projs.delete(p.id); continue; }
      p.vy -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.obj.position.set(p.x, p.y, p.z);
      if (p.arrow) p.obj.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
      if (p.def.trail && Math.random() < 0.7) {
        const c = p.rgb;
        this.particles.add(p.x, p.y, p.z, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, c[0], c[1], c[2], p.def.size * 0.7, 0.35, 0);
      }
    }
  }

  addProj(m) {
    const def = PROJ[m.k] || PROJ.magie;
    let obj, arrow = false;
    if (m.k === 'pijl') { obj = new THREE.Mesh(this.arrowGeo, this.arrowMat); arrow = true; }
    else {
      obj = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: def.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      obj.scale.setScalar(def.size * 2.2);
    }
    obj.position.set(m.x, m.y, m.z);
    this.scene.add(obj);
    const c = new THREE.Color(def.color);
    this.projs.set(m.id, { id: m.id, k: m.k, def, obj, arrow, x: m.x, y: m.y, z: m.z, vx: m.vx, vy: m.vy, vz: m.vz, g: m.g, life: 4.5, rgb: [c.r, c.g, c.b] });
  }

  endProj(m) {
    const p = this.projs.get(m.id);
    if (!p) return null;
    this.scene.remove(p.obj);
    if (!p.arrow) p.obj.material.dispose();
    this.projs.delete(m.id);
    this.particles.burst(m.x, m.y, m.z, p.arrow ? 4 : 14, p.rgb, { speed: p.arrow ? 1.5 : 4, size: p.def.size * 0.6, life: 0.4, grav: 2 });
    return p;
  }

  // Welk wezen raakt deze straal het eerst?
  pick(ox, oy, oz, dx, dy, dz, maxD) {
    let best = null, bt = maxD;
    for (const e of this.map.values()) {
      if (e.id === this.ridden) continue;
      const hw = e.w / 2 + 0.12;
      const t = rayBox(ox, oy, oz, dx, dy, dz, e.x - hw, e.y - 0.05, e.z - hw, e.x + hw, e.y + e.h + 0.1, e.z + hw);
      if (t !== null && t < bt) { bt = t; best = e; }
    }
    return best ? { e: best, t: bt } : null;
  }
}

function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = 1e9;
  const ax = [[ox, dx, x0, x1], [oy, dy, y0, y1], [oz, dz, z0, z1]];
  for (const [o, d, a, b] of ax) {
    if (Math.abs(d) < 1e-9) { if (o < a || o > b) return null; continue; }
    let t1 = (a - o) / d, t2 = (b - o) / d;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return tmin;
}
