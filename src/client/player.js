// De speler: lopen, springen, zwemmen, vliegen op een draak, hakken, bouwen en vechten.
import * as THREE from '../../vendor/three.module.min.js';
import { EYE, REACH, CH, clamp } from '../shared/constants.js';
import { B, BLOCKS, B_SHAPE, SHAPE_LIQUID, PORTAL_TO, TILE_CRACK } from '../shared/blocks.js';
import { ITEMS } from '../shared/items.js';
import { playerModel, animate } from './models.js';
import { iconCanvas } from './textures.js';

const HW = 0.3, HH = 1.8;
const _v = new THREE.Vector3();

export class Player {
  constructor(game) {
    this.g = game;
    this.pos = new THREE.Vector3(0, 60, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = false; this.inWater = false; this.headIn = 0;
    this.mount = 0; this.mountScale = 1;
    this.cam = 0;
    this.fallPeak = 0; this.softLand = true;
    this.safe = new THREE.Vector3(0, 60, 0);
    this.safeT = 0;
    this.dig = null; this.digCd = 0; this.digTick = 0;
    this.atkCd = 0; this.useCd = 0; this.shootCd = 0;
    this.portalT = 0; this.portalLock = 0;
    this.lavaT = 0;
    this.stepDist = 0; this.bobPh = 0;
    this.autoJump = true;
    this.sendT = 0;
    this.speedNow = 0;
    this.swing = 0;
    this.frozen = true;
    this.dead = false;
    this.target = null;

    const scene = game.R.scene, cam = game.R.camera;
    scene.add(cam);
    // kader om het blok waar je naar wijst
    this.hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, fog: false }));
    this.hl.visible = false;
    scene.add(this.hl);
    // scheurtjes tijdens het hakken
    this.crackTex = TILE_CRACK.map((t) => { const tx = new THREE.CanvasTexture(game.atlas.canvases[t]); return tx; });
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), new THREE.MeshBasicMaterial({ map: this.crackTex[0], transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.crack.visible = false;
    scene.add(this.crack);
    // wat je vasthoudt (eerste persoon)
    this.heldTex = new THREE.CanvasTexture(iconCanvas(B.gras));
    this.heldTex.colorSpace = THREE.SRGBColorSpace;
    this.held = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshBasicMaterial({ map: this.heldTex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    this.held.position.set(0.4, -0.2, -0.62);
    this.held.renderOrder = 30;
    this.held.visible = false;
    this.heldId = -1;
    cam.add(this.held);
    this.model = null;
    this.setLook(game.look);
  }

  setLook(look) {
    if (this.model) this.g.R.scene.remove(this.model);
    this.model = playerModel(look);
    this.model.visible = false;
    this.g.R.scene.add(this.model);
  }

  teleport(x, y, z, yaw) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0);
    if (yaw !== undefined) this.yaw = yaw;
    this.fallPeak = y; this.softLand = true; this.safe.copy(this.pos);
    this.dig = null; this.portalT = 0; this.portalLock = 3;
  }

  setMount(id, scale) {
    if (id) {
      this.mount = id; this.mountScale = scale || 1;
      this.pos.y += 1.3 * this.mountScale + 0.4;
      this.vel.set(0, 0, 0);
    } else if (this.mount) {
      this.mount = 0; this.softLand = true; this.fallPeak = this.pos.y;
    }
    this.g.ents.ridden = this.mount;
  }

  heldItem() { const s = this.g.inv[this.g.sel]; return s ? s[0] : 0; }

  // ---------- elke frame ----------

  update(dt) {
    const g = this.g, inp = g.input, w = g.world;
    const [lx, ly] = inp.takeLook();
    if (!this.dead) {
      this.yaw -= lx; this.pitch = clamp(this.pitch - ly, -1.54, 1.54);
    }
    if (this.atkCd > 0) this.atkCd -= dt;
    if (this.useCd > 0) this.useCd -= dt;
    if (this.shootCd > 0) this.shootCd -= dt;
    if (this.digCd > 0) this.digCd -= dt;
    if (this.portalLock > 0) this.portalLock -= dt;
    if (this.swing > 0) this.swing -= dt;

    const ready = !this.frozen && !this.dead && w.isLoaded(this.pos.x, this.pos.z);
    if (ready) {
      if (this.mount) this.fly(dt); else this.walk(dt);
      this.environment(dt);
    } else { this.vel.set(0, 0, 0); this.speedNow = 0; }

    this.updateCamera(dt);
    if (ready) this.actions(dt);
    else { this.hl.visible = false; this.crack.visible = false; }

    this.sendT += dt;
    if (this.sendT >= 0.1 && !this.frozen) {
      this.sendT = 0;
      g.net.send({ t: 'move', x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.yaw, pitch: this.pitch });
    }
  }

  walk(dt) {
    const g = this.g, inp = g.input, w = g.world;
    // zit je vast in een blok (bijv. omdat er iets op je is gebouwd)? dan omhoog
    if (w.boxHits(this.pos.x, this.pos.y, this.pos.z, HW, HH)) {
      this.pos.y = Math.floor(this.pos.y) + 1; this.vel.set(0, 0, 0); this.fallPeak = this.pos.y; this.softLand = true;
      return;
    }
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    let wx = -sinY * inp.fwd + cosY * inp.strafe, wz = -cosY * inp.fwd - sinY * inp.strafe;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const feet = w.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
    const wasWater = this.inWater;
    this.inWater = feet > 0 && B_SHAPE[feet] === SHAPE_LIQUID;
    if (this.inWater && !wasWater && this.vel.y < -3) g.sound.play('splash');
    let speed = this.inWater ? 2.9 : (inp.sprint ? 6.3 : 4.5);
    if (g.trees.ijs) speed *= 1.25;
    const acc = Math.min(1, (this.onGround ? 14 : (this.inWater ? 6 : 4)) * dt);
    this.vel.x += (wx * speed - this.vel.x) * acc;
    this.vel.z += (wz * speed - this.vel.z) * acc;
    if (this.inWater) {
      this.vel.y -= 7 * dt;
      this.vel.y *= 1 - Math.min(1, 2 * dt);
      if (inp.jump) this.vel.y = Math.min(this.vel.y + 24 * dt, 3.6);
      if (this.vel.y < -3.5) this.vel.y = -3.5;
      this.fallPeak = this.pos.y;
    } else {
      this.vel.y -= 27 * dt;
      if (inp.jump && this.onGround) { this.vel.y = g.trees.wolken ? 10.6 : 8.6; this.onGround = false; }
      if (this.vel.y < -48) this.vel.y = -48;
    }

    const wasGround = this.onGround;
    const vmax = Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y), Math.abs(this.vel.z));
    const steps = Math.max(1, Math.ceil(vmax * dt / 0.4));
    const sdt = dt / steps;
    let blocked = false;
    const ox = this.pos.x, oz = this.pos.z;
    for (let i = 0; i < steps; i++) {
      if (this.moveX(this.vel.x * sdt, HW, HH, 0)) blocked = true;
      if (this.moveZ(this.vel.z * sdt, HW, HH, 0)) blocked = true;
      this.moveY(this.vel.y * sdt, HW, HH, 0);
    }
    if (this.pos.y > this.fallPeak || this.onGround) {
      if (this.onGround && !wasGround) this.land();
      this.fallPeak = this.pos.y;
    }
    // automatisch een blok omhoog springen
    if (blocked && wl > 0.2 && (this.onGround || this.inWater)) {
      const px = this.pos.x + wx * 0.45, pz = this.pos.z + wz * 0.45;
      if (this.inWater) this.vel.y = Math.max(this.vel.y, 4.2);
      else if (this.autoJump && !w.boxHits(px, this.pos.y + 1.05, pz, HW, HH) && !w.boxHits(this.pos.x, this.pos.y + 1.05, this.pos.z, HW, HH)) { this.vel.y = 8.6; this.onGround = false; }
    }
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    this.speedNow += (moved / dt - this.speedNow) * Math.min(1, dt * 10);
    if (this.onGround && moved > 0.001) {
      this.stepDist += moved; this.bobPh += moved * 2.6;
      if (this.stepDist > 2.1) {
        this.stepDist = 0;
        const below = w.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z));
        g.sound.play('step', 0.8, below > 0 ? BLOCKS[below].snd : 'stone');
      }
    }
  }

  land() {
    const g = this.g;
    const fall = this.fallPeak - this.pos.y;
    if (fall > 1.2) {
      const below = g.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z));
      g.sound.play('step', 1, below > 0 ? BLOCKS[below].snd : 'stone');
    }
    if (fall > 4.2 && !this.inWater && !this.softLand && !g.trees.wolken) g.net.send({ t: 'hurtSelf', k: 'fall', n: Math.floor(fall - 3.2) });
    this.softLand = false;
  }

  fly(dt) {
    const g = this.g, inp = g.input;
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const speed = inp.sprint && !inp.down ? 20 : 14;
    const tx = (-sinY * cp * inp.fwd + cosY * inp.strafe * 0.7) * speed;
    const tz = (-cosY * cp * inp.fwd - sinY * inp.strafe * 0.7) * speed;
    const ty = sp * inp.fwd * speed + ((inp.jump ? 1 : 0) - (inp.down ? 1 : 0)) * 8;
    const acc = Math.min(1, 2.6 * dt);
    this.vel.x += (tx - this.vel.x) * acc; this.vel.y += (ty - this.vel.y) * acc; this.vel.z += (tz - this.vel.z) * acc;
    const s = this.mountScale;
    const hw = 0.4 + 0.15 * s, below = 0.9 * s, hh = HH + below;
    if (g.world.boxHits(this.pos.x, this.pos.y - below, this.pos.z, hw, hh)) {
      // vastgelopen in een blok: gewoon doorvliegen en een beetje omhoog
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += Math.max(this.vel.y, 3) * dt;
    } else {
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y), Math.abs(this.vel.z)) * dt / 0.4));
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        this.moveX(this.vel.x * sdt, hw, hh, below);
        this.moveZ(this.vel.z * sdt, hw, hh, below);
        this.moveY(this.vel.y * sdt, hw, hh, below);
      }
    }
    if (this.pos.y > CH + 18) { this.pos.y = CH + 18; this.vel.y = 0; }
    this.onGround = false; this.inWater = false;
    this.fallPeak = this.pos.y;
    this.speedNow = Math.hypot(this.vel.x, this.vel.z);
    this.flapT = (this.flapT || 0) - dt;
    if (this.flapT <= 0) { this.flapT = 0.95; g.sound.play('flap', 0.6); }
  }

  moveX(d, hw, hh, below) {
    if (!d) return false;
    const w = this.g.world, nx = this.pos.x + d, y = this.pos.y - below;
    if (!w.boxHits(nx, y, this.pos.z, hw, hh)) { this.pos.x = nx; return false; }
    const sx = d > 0 ? Math.floor(nx + hw) - hw - 0.001 : Math.floor(nx - hw) + 1 + hw + 0.001;
    if (Math.abs(sx - this.pos.x) < Math.abs(d) && !w.boxHits(sx, y, this.pos.z, hw, hh)) this.pos.x = sx;
    this.vel.x = 0;
    return true;
  }
  moveZ(d, hw, hh, below) {
    if (!d) return false;
    const w = this.g.world, nz = this.pos.z + d, y = this.pos.y - below;
    if (!w.boxHits(this.pos.x, y, nz, hw, hh)) { this.pos.z = nz; return false; }
    const sz = d > 0 ? Math.floor(nz + hw) - hw - 0.001 : Math.floor(nz - hw) + 1 + hw + 0.001;
    if (Math.abs(sz - this.pos.z) < Math.abs(d) && !w.boxHits(this.pos.x, y, sz, hw, hh)) this.pos.z = sz;
    this.vel.z = 0;
    return true;
  }
  moveY(d, hw, hh, below) {
    if (!d) return;
    const w = this.g.world, ny = this.pos.y + d;
    if (!w.boxHits(this.pos.x, ny - below, this.pos.z, hw, hh)) { this.pos.y = ny; this.onGround = false; return; }
    if (d < 0) {
      const sy = w.boxTop(this.pos.x, ny - below, this.pos.z, hw, hh) + below;
      if (sy <= this.pos.y + 0.0001 && !w.boxHits(this.pos.x, sy - below, this.pos.z, hw, hh)) this.pos.y = sy;
      this.onGround = true;
    } else {
      const sy = Math.floor(ny - below + hh) - hh + below - 0.001;
      if (sy >= this.pos.y && !w.boxHits(this.pos.x, sy - below, this.pos.z, hw, hh)) this.pos.y = sy;
    }
    this.vel.y = 0;
  }

  environment(dt) {
    const g = this.g, w = g.world;
    const px = Math.floor(this.pos.x), pz = Math.floor(this.pos.z);
    const mid = w.getBlock(px, Math.floor(this.pos.y + 0.5), pz);
    const low = w.getBlock(px, Math.floor(this.pos.y + 0.1), pz);
    // lava
    if (!this.mount && (mid === B.lava || low === B.lava)) {
      this.lavaT -= dt;
      if (this.lavaT <= 0) { this.lavaT = 0.6; if (!g.trees.vuur) g.net.send({ t: 'hurtSelf', k: 'lava', n: 3 }); }
    } else this.lavaT = 0;
    // uit de wereld gevallen
    if (this.pos.y < -12) {
      this.pos.copy(this.safe); this.vel.set(0, 0, 0); this.fallPeak = this.pos.y; this.softLand = true;
      g.net.send({ t: 'hurtSelf', k: 'void', n: 4 });
      g.ui.toast('Oeps! Je viel uit de wereld.', 'warn');
    }
    this.safeT += dt;
    if (this.onGround && !this.inWater && this.safeT > 1) { this.safeT = 0; this.safe.set(this.pos.x, this.pos.y + 0.05, this.pos.z); }
    // portaal
    const pid = PORTAL_TO[mid] ? mid : (PORTAL_TO[low] ? low : 0);
    if (pid && this.portalLock <= 0) {
      this.portalT += dt;
      if (this.portalT > 0.08) {
        this.portalT = 0; this.portalLock = 6;
        g.onPortal(PORTAL_TO[pid]);
        g.net.send({ t: 'portal', x: px, y: Math.floor(this.pos.y + (PORTAL_TO[mid] ? 0.5 : 0.1)), z: pz });
      }
    } else this.portalT = 0;
  }

  updateCamera(dt) {
    const g = this.g, cam = g.R.camera, w = g.world;
    const third = this.cam === 1 || this.mount || this.dead;
    const eyeY = this.pos.y + (this.mount ? 1.25 : EYE);
    const hx = Math.floor(this.pos.x), hz = Math.floor(this.pos.z);
    if (!third) {
      const bob = this.onGround ? Math.sin(this.bobPh) * 0.035 * Math.min(1, this.speedNow / 4) : 0;
      cam.position.set(this.pos.x, eyeY + bob, this.pos.z);
    } else {
      const dist = this.mount ? 4.5 + 3.4 * this.mountScale : 4.2;
      const cp = Math.cos(this.pitch);
      const bx = Math.sin(this.yaw) * cp, by = -Math.sin(this.pitch), bz = Math.cos(this.yaw) * cp;
      let d = 0.2;
      const oy = eyeY + 0.25;
      for (; d < dist; d += 0.25) {
        if (w.solid(Math.floor(this.pos.x + bx * (d + 0.3)), Math.floor(oy + by * (d + 0.3)), Math.floor(this.pos.z + bz * (d + 0.3)))) break;
      }
      cam.position.set(this.pos.x + bx * d, oy + by * d, this.pos.z + bz * d);
    }
    cam.rotation.set(this.pitch, this.yaw, 0);
    cam.updateMatrixWorld();
    const eb = w.getBlock(Math.floor(cam.position.x), Math.floor(cam.position.y), Math.floor(cam.position.z));
    this.headIn = eb === B.water ? 1 : (eb === B.lava ? 2 : 0);
    void hx; void hz;

    // eigen poppetje
    const m = this.model;
    m.visible = third;
    if (third) {
      m.position.copy(this.pos);
      m.rotation.y = this.yaw + Math.PI;
      const a = m.userData.a;
      a.pose = this.mount ? 'ride' : '';
      if (this.swing > 0 && !(a.swing > 0)) a.swing = this.swing;
      animate(m, g.time, this.mount ? 0 : this.speedNow, 0, dt);
    }
    // voorwerp in de hand
    const id = this.heldItem();
    this.held.visible = !third && id > 0;
    if (id !== this.heldId && id > 0) {
      this.heldId = id;
      this.heldTex.image = iconCanvas(id);
      this.heldTex.needsUpdate = true;
    }
    if (this.held.visible) {
      const s = this.swing > 0 ? Math.sin((this.swing / 0.3) * Math.PI) : 0;
      this.held.position.set((g.touch ? -0.37 : 0.37) * Math.min(1.6, cam.aspect) - s * 0.12, -0.27 + Math.sin(this.bobPh) * 0.012 + s * 0.06, -0.62 - s * 0.08);
      this.held.rotation.z = -s * 0.9 + 0.1;
    }
  }

  // Waar wijst de speler naar? ndc = plek op het scherm (aanraken) of null (midden)
  aim(ndc) {
    const g = this.g, cam = g.R.camera;
    const dir = new THREE.Vector3();
    if (ndc) dir.set(ndc.x, ndc.y, 0.5).unproject(cam).sub(cam.position).normalize();
    else cam.getWorldDirection(dir);
    const o = cam.position;
    const extra = (this.cam === 1 || this.mount) ? _v.set(this.pos.x, this.pos.y + EYE, this.pos.z).distanceTo(o) : 0;
    const maxD = REACH + extra;
    const blk = g.world.raycast(o.x, o.y, o.z, dir.x, dir.y, dir.z, maxD);
    const ent = g.ents.pick(o.x, o.y, o.z, dir.x, dir.y, dir.z, maxD + 1);
    if (ent && (!blk || ent.t < blk.t)) return { ent: ent.e, blk: null, dir };
    return { ent: null, blk, dir };
  }

  actions(dt) {
    const g = this.g, inp = g.input;
    const tgt = this.aim(inp.breakHeld ? inp.breakNdc : null);
    this.target = tgt;
    const b = tgt.blk;
    this.hl.visible = !!b && !this.mount;
    if (b) this.hl.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);

    if (!inp.breakHeld || g.ui.modalOpen()) { this.dig = null; this.crack.visible = false; return; }

    if (this.mount) { this.shoot(tgt.dir); return; }
    if (tgt.ent) {
      this.dig = null; this.crack.visible = false;
      if (this.atkCd <= 0 && !tgt.ent.owner) {
        this.atkCd = 0.36; this.swing = 0.3;
        g.net.send({ t: 'attack', id: tgt.ent.id });
        g.sound.play('swing');
      }
      return;
    }
    if (!b || this.digCd > 0) { this.dig = null; this.crack.visible = false; return; }
    const def = BLOCKS[b.id];
    if (def.hard === Infinity) { this.crack.visible = false; return; }
    if (!this.dig || this.dig.x !== b.x || this.dig.y !== b.y || this.dig.z !== b.z) this.dig = { x: b.x, y: b.y, z: b.z, p: 0 };
    const it = ITEMS[this.heldItem()];
    let sp = 1;
    if (it && it.tool && it.tool === def.tool) sp = it.speed;
    const time = Math.max(0.12, def.hard / sp) * (g.fastDig ? 0.1 : 1);
    this.dig.p += dt / time;
    this.digTick -= dt;
    if (this.digTick <= 0) {
      this.digTick = 0.24; this.swing = 0.24;
      g.sound.play('dig', 1, def.snd);
      const c = g.tileColor(def.tSide);
      g.particles.burst(b.x + 0.5 + b.nx * 0.55, b.y + 0.5 + b.ny * 0.55, b.z + 0.5 + b.nz * 0.55, 3, c, { speed: 1.6, size: 0.12, life: 0.4 });
    }
    if (this.dig.p >= 1) {
      g.net.send({ t: 'break', x: b.x, y: b.y, z: b.z });
      g.world.setBlock(b.x, b.y, b.z, 0);
      g.sound.play('break', 1, def.snd);
      g.particles.burst(b.x + 0.5, b.y + 0.5, b.z + 0.5, 14, g.tileColor(def.tSide), { speed: 2.6, size: 0.16, life: 0.6, spread: 0.7 });
      this.dig = null; this.digCd = 0.14; this.crack.visible = false;
    } else {
      this.crack.visible = true;
      this.crack.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);
      const st = Math.min(3, Math.floor(this.dig.p * 4));
      if (this.crack.material.map !== this.crackTex[st]) { this.crack.material.map = this.crackTex[st]; this.crack.material.needsUpdate = true; }
    }
  }

  shoot(dir) {
    if (this.shootCd > 0) return;
    const it = ITEMS[this.heldItem()];
    this.shootCd = this.mount ? 0.5 : (it && it.ranged ? it.ranged.cd + 0.02 : 0.5);
    this.swing = 0.25;
    this.g.net.send({ t: 'shoot', dx: dir.x, dy: dir.y, dz: dir.z });
  }

  // tik / rechtermuisknop: gebruiken, plaatsen, praten, eten, schieten
  use(ndc) {
    const g = this.g;
    if (this.frozen || this.dead || this.useCd > 0) return;
    this.useCd = 0.16;
    const tgt = this.aim(ndc);
    if (this.mount) { this.shoot(tgt.dir); return; }
    const id = this.heldItem();
    const it = ITEMS[id];
    if (tgt.ent) {
      const e = tgt.ent;
      const friendly = e.owner || e.def.ai === 'passive';
      if (friendly) { g.net.send({ t: 'useEnt', id: e.id }); this.swing = 0.2; return; }
      if (it && it.ranged) { this.shoot(tgt.dir); return; }
      if (this.atkCd <= 0) { this.atkCd = 0.36; this.swing = 0.3; g.net.send({ t: 'attack', id: e.id }); g.sound.play('swing'); }
      return;
    }
    if (it && it.ranged) { this.shoot(tgt.dir); return; }
    const b = tgt.blk;
    if (b) {
      const def = BLOCKS[b.id];
      if (def.interact) {
        this.swing = 0.2;
        if (b.id === B.werkbank || b.id === B.oven) { g.ui.openInventory(b.id === B.oven ? 'oven' : 'werkbank'); return; }
        g.net.send({ t: 'use', x: b.x, y: b.y, z: b.z });
        return;
      }
    }
    if (it && it.food) { g.net.send({ t: 'eat' }); return; }
    if (!b || !id) return;
    if (id >= 256 && !(it && it.portal)) return;
    let x = b.x, y = b.y, z = b.z;
    if (!BLOCKS[b.id].replace) { x += b.nx; y += b.ny; z += b.nz; }
    const cur = g.world.getBlock(x, y, z);
    if (cur < 0 || !BLOCKS[cur].replace || y < 1 || y >= CH - 1) return;
    if (id < 256) {
      const def = BLOCKS[id];
      if (def.solid && this.pos.x + HW > x && this.pos.x - HW < x + 1 && this.pos.z + HW > z && this.pos.z - HW < z + 1 && this.pos.y + HH > y && this.pos.y < y + 1) return;
      if (def.support && !g.world.solid(x, y - 1, z)) { g.ui.toast('Dit moet op de grond staan.'); return; }
      if (id !== B.bed) g.world.setBlock(x, y, z, id);      // een bed is twee blokken: de server zet het neer
      g.sound.play('place', 1, def.snd);
    }
    this.swing = 0.25;
    g.net.send({ t: 'place', x, y, z });
  }

  knock(kx, kz) {
    this.vel.x += kx * 7; this.vel.z += kz * 7;
    if (this.onGround) this.vel.y = 4.5;
  }
}
