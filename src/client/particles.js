// Deeltjes: brokjes als je hakt, vonken, hartjes, sneeuw, as...
import * as THREE from '../../vendor/three.module.min.js';
import { glowTex } from './textures.js';

const MAX = 500;

const VERT = `
attribute float size;
attribute vec4 pcolor;
uniform float pscale;
varying vec4 vC;
void main() {
  vC = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * pscale / max(0.3, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform sampler2D map;
varying vec4 vC;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  if (vC.a * t.a < 0.02) discard;
  gl_FragColor = vec4(vC.rgb, vC.a * t.a);
  #include <colorspace_fragment>
}`;

export class Particles {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 4);
    this.size = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.base = new Float32Array(MAX);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.U = { map: { value: glowTex() }, pscale: { value: 400 } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.U, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.geo = g;
  }

  add(x, y, z, vx, vy, vz, r, g, b, size, life, grav) {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = 1;
    this.size[i] = size; this.base[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav;
  }

  // een wolkje deeltjes; c = [r,g,b] (0..1)
  burst(x, y, z, n, c, opt = {}) {
    const sp = opt.speed || 2, size = opt.size || 0.18, life = opt.life || 0.7, grav = opt.grav === undefined ? 9 : opt.grav, spread = opt.spread || 0.3, up = opt.up || 0;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, e = Math.random() * 2 - 1, r = Math.sqrt(1 - e * e);
      const v = sp * (0.4 + Math.random() * 0.6), j = 0.75 + Math.random() * 0.5;
      this.add(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread,
        Math.cos(a) * r * v, e * v + up, Math.sin(a) * r * v, Math.min(1, c[0] * j), Math.min(1, c[1] * j), Math.min(1, c[2] * j),
        size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.8), grav);
    }
  }

  clear() {
    this.life.fill(0); this.size.fill(0);
    for (let i = 0; i < MAX; i++) this.col[i * 4 + 3] = 0;
    this.geo.attributes.pcolor.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }

  update(dt, height) {
    this.U.pscale.value = height * 0.9;
    const { pos, vel, life, col, grav, maxLife, size, base } = this;
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { size[i] = 0; col[i * 4 + 3] = 0; continue; }
      vel[i * 3 + 1] -= grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const t = life[i] / maxLife[i];
      col[i * 4 + 3] = t < 0.5 ? t * 2 : 1;
      size[i] = base[i];
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.pcolor.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}
