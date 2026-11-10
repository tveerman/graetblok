// Het weer aan de kant van het spel: regen, sneeuw, onweer en zonneschijn.
// De server bepaalt wat voor weer het is; hier wordt het getekend. Druppels en vlokken vallen
// alleen waar de lucht open is: onder een dak of in een grot blijf je droog.
import * as THREE from '../../vendor/three.module.min.js';
import { SEA } from '../shared/constants.js';
import { glowTex } from './textures.js';

const MAX = 700, R = 15;

export class Weather {
  constructor(scene, blocks, touch) {
    this.scene = scene; this.blocks = blocks;
    this.max = touch ? 380 : MAX;
    this.kind = 'zon';
    this.rain = 0; this.snow = 0;          // hoeveel er nu valt (0..1), loopt langzaam op en af
    this.wet = 0;                          // hoe grijs de lucht is (0..1)
    this.flash = 0;                        // bliksemflits
    this.roof = false;
    this.x = new Float32Array(MAX); this.y = new Float32Array(MAX); this.z = new Float32Array(MAX);
    this.ground = new Float32Array(MAX); this.sp = new Float32Array(MAX);
    this.y.fill(-999);
    // regen: korte streepjes
    this.rpos = new Float32Array(MAX * 6);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rpos, 3));
    this.rainMesh = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xb4cdea, transparent: true, opacity: 0.5, depthWrite: false }));
    this.rainMesh.frustumCulled = false; this.rainMesh.visible = false; this.rainMesh.renderOrder = 6;
    scene.add(this.rainMesh);
    // sneeuw: zachte vlokken
    this.spos = new Float32Array(MAX * 3);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.spos, 3));
    this.snowMesh = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, map: glowTex(), transparent: true, opacity: 0.95, depthWrite: false }));
    this.snowMesh.frustumCulled = false; this.snowMesh.visible = false; this.snowMesh.renderOrder = 6;
    scene.add(this.snowMesh);
    this.bolts = [];
  }

  // now = meteen (bij het binnenkomen van een wereld), anders trekt de lucht langzaam dicht
  set(kind, now) {
    this.kind = kind;
    if (now) { const t = this.targets(100); this.rain = t[0]; this.snow = t[1]; this.wet = t[2]; }
  }

  // [regen, sneeuw, grijs] die bij het weer horen; hoog in de bergen wordt regen sneeuw
  targets(camY) {
    const k = this.kind;
    if (k === 'regen') return camY > SEA + 50 ? [0, 0.7, 0.6] : [0.6, 0, 0.6];
    if (k === 'onweer') return camY > SEA + 50 ? [0, 1, 0.9] : [1, 0, 0.9];
    if (k === 'sneeuw') return [0, 0.6, 0.45];
    if (k === 'storm') return [0, 1, 0.8];
    return [0, 0, 0];
  }

  clear() {
    this.y.fill(-999);
    for (const b of this.bolts) this.scene.remove(b.obj);
    this.bolts.length = 0;
    this.flash = 0;
  }

  // hoogste blok dat regen tegenhoudt in deze kolom
  top(x, z) {
    const c = this.blocks.get(Math.floor(x) >> 4, Math.floor(z) >> 4);
    return c ? c.hm[(Math.floor(x) & 15) * 16 + (Math.floor(z) & 15)] : 999;
  }

  // Een bliksemflits die inslaat op (x, y, z).
  bolt(x, y, z) {
    const pts = [];
    let px = x, pz = z;
    for (let h = 0; h <= 70; h += 5) {
      pts.push(new THREE.Vector3(px, y + h, pz));
      px += (Math.random() - 0.5) * 5; pz += (Math.random() - 0.5) * 5;
    }
    // een paar zijtakjes
    const seg = [];
    for (let i = 0; i < pts.length - 1; i++) {
      seg.push(pts[i], pts[i + 1]);
      if (Math.random() < 0.35) seg.push(pts[i], new THREE.Vector3(pts[i].x + (Math.random() - 0.5) * 9, pts[i].y - 3 - Math.random() * 5, pts[i].z + (Math.random() - 0.5) * 9));
    }
    const obj = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), new THREE.LineBasicMaterial({ color: 0xeaf2ff, transparent: true, opacity: 1, fog: false, depthWrite: false }));
    obj.frustumCulled = false; obj.renderOrder = 7;
    this.scene.add(obj);
    this.bolts.push({ obj, life: 0.32 });
    this.flash = 1;
  }

  update(dt, cam, particles) {
    const [tr, ts, tw] = this.targets(cam.position.y);
    const k = Math.min(1, dt * 0.45);
    this.rain += (tr - this.rain) * k; this.snow += (ts - this.snow) * k; this.wet += (tw - this.wet) * Math.min(1, dt * 0.3);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3.2);
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      b.obj.material.opacity = Math.max(0, b.life / 0.32) * (Math.random() < 0.3 ? 0.4 : 1);
      if (b.life <= 0) { this.scene.remove(b.obj); b.obj.geometry.dispose(); b.obj.material.dispose(); this.bolts.splice(i, 1); }
    }
    const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    this.roof = cy < this.top(cx, cz);
    const amount = Math.max(this.rain, this.snow), snowing = this.snow > this.rain;
    const n = Math.round(this.max * Math.min(1, amount));
    this.rainMesh.visible = n > 0 && !snowing; this.snowMesh.visible = n > 0 && snowing;
    if (!n) return;
    const storm = this.kind === 'onweer' || this.kind === 'storm';
    const wind = storm ? 5 : 1.2, fall = snowing ? (storm ? 4.5 : 2.2) : 24;
    const { x, y, z, ground, sp } = this;
    const rp = this.rpos, spos = this.spos;
    for (let i = 0; i < n; i++) {
      if (y[i] < ground[i] || Math.abs(x[i] - cx) > R || Math.abs(z[i] - cz) > R || y[i] > cy + 22) {
        // deze druppel is geland (of we zijn weggelopen): een nieuwe, ergens boven de speler
        if (!snowing && y[i] > -900 && Math.random() < 0.12 && particles) particles.add(x[i], ground[i] + 0.05, z[i], (Math.random() - 0.5) * 1.2, 1.4, (Math.random() - 0.5) * 1.2, 0.75, 0.85, 1, 0.08, 0.25, 9);
        x[i] = cx + (Math.random() * 2 - 1) * R; z[i] = cz + (Math.random() * 2 - 1) * R;
        ground[i] = this.top(x[i], z[i]) + 1;
        y[i] = Math.max(ground[i], cy - 6) + Math.random() * (snowing ? 16 : 20);
        sp[i] = 0.75 + Math.random() * 0.5;
      }
      y[i] -= fall * sp[i] * dt;
      x[i] += wind * dt * (snowing ? Math.sin(y[i] * 0.9 + i) * 0.6 + 0.5 : 1);
      if (snowing) { z[i] += Math.cos(y[i] * 0.7 + i * 1.3) * 0.5 * dt; spos[i * 3] = x[i]; spos[i * 3 + 1] = y[i]; spos[i * 3 + 2] = z[i]; }
      else { const o = i * 6; rp[o] = x[i]; rp[o + 1] = y[i]; rp[o + 2] = z[i]; rp[o + 3] = x[i] + wind * 0.035; rp[o + 4] = y[i] + 0.85; rp[o + 5] = z[i]; }
    }
    if (snowing) { this.snowMesh.geometry.setDrawRange(0, n); this.snowMesh.geometry.attributes.position.needsUpdate = true; }
    else { this.rainMesh.geometry.setDrawRange(0, n * 2); this.rainMesh.geometry.attributes.position.needsUpdate = true; }
  }
}
