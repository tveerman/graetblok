// Visjes: kleine gekleurde visjes die in het water bij de speler rondzwemmen. Ze bestaan
// alleen op het scherm (de server weet er niets van) en worden met z'n allen in één keer
// getekend, zodat ze de tablet bijna niets kosten.
import * as THREE from '../../vendor/three.module.min.js';
import { B } from '../shared/blocks.js';
import { Merge } from './rides.js';

const N = 16;
const KLEUREN = [0xf08a20, 0xf4d040, 0x3a8ae8, 0xe03a2a, 0xc8d0dc, 0x3fb86a, 0xf06ab0, 0x8a5ad0];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

export class Fish {
  constructor(scene, world) {
    this.world = world;
    // een visje met de neus naar +z: een lijfje, een staart en een rugvin
    const g = new Merge();
    g.box(0.1, 0.16, 0.34, 0, 0, 0.03); g.box(0.03, 0.2, 0.12, 0, 0, -0.2); g.box(0.03, 0.07, 0.14, 0, 0.11, 0.02);
    const geo = g.mesh(null).geometry;
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
    this.mesh.frustumCulled = false;
    this.list = [];
    for (let i = 0; i < N; i++) {
      this.list.push({ on: false, x: 0, y: 0, z: 0, yaw: 0, dy: 0, sp: 1, t: 0, ph: Math.random() * 6, s: 0.7 + Math.random() * 0.9 });
      this.mesh.setColorAt(i, _c.setHex(KLEUREN[i % KLEUREN.length]));
      this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    }
    this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
  }

  water(x, y, z) { return this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === B.water; }

  update(dt, pos) {
    let tries = 2;                                  // per beeld hooguit twee keer een nieuwe plek zoeken
    for (let i = 0; i < N; i++) {
      const f = this.list[i];
      if (f.on && (Math.abs(f.x - pos.x) > 24 || Math.abs(f.z - pos.z) > 24 || !this.water(f.x, f.y, f.z))) f.on = false;
      if (!f.on) {
        if (tries-- > 0) {
          const x = pos.x + (Math.random() - 0.5) * 30, z = pos.z + (Math.random() - 0.5) * 30, y = pos.y - 7 + Math.random() * 9;
          // midden in het water: ook erboven moet water zijn (niet aan de oppervlakte)
          if (this.water(x, y, z) && this.water(x, y + 1, z)) { f.on = true; f.x = x; f.y = Math.floor(y) + 0.5; f.z = z; f.yaw = Math.random() * 6.28; f.t = 0; }
        }
        if (!f.on) { this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); continue; }
      }
      f.t -= dt;
      if (f.t <= 0) { f.t = 1 + Math.random() * 3; f.yaw += (Math.random() - 0.5) * 2.2; f.dy = (Math.random() - 0.5) * 0.5; f.sp = 0.5 + Math.random() * 1.4; }
      // schrikt de speler hem op, dan schiet hij weg
      const dx = f.x - pos.x, dz = f.z - pos.z;
      if (dx * dx + dz * dz < 4 && Math.abs(f.y - pos.y) < 2.5) { f.yaw = Math.atan2(dx, dz); f.sp = 3.2; f.t = 0.8; }
      const nx = f.x + Math.sin(f.yaw) * f.sp * dt, nz = f.z + Math.cos(f.yaw) * f.sp * dt, ny = f.y + f.dy * dt;
      if (this.water(nx + Math.sin(f.yaw) * 0.4, f.y, nz + Math.cos(f.yaw) * 0.4)) { f.x = nx; f.z = nz; } else { f.yaw += Math.PI * (0.7 + Math.random() * 0.6); f.t = 1; }
      if (this.water(f.x, ny + (f.dy > 0 ? 1.1 : -0.4), f.z)) f.y = ny; else f.dy = -f.dy;
      f.ph += dt * (6 + f.sp * 5);
      _e.set(0, f.yaw + Math.sin(f.ph) * 0.3, 0);
      _m.compose(_p.set(f.x, f.y, f.z), _q.setFromEuler(_e), _s.set(f.s, f.s, f.s));
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
