// Tekenen: scène, camera, lucht (zon, maan, sterren, wolken), mist en licht.
import * as THREE from '../../vendor/three.module.min.js';
import { WORLDS } from '../shared/worlds.js';
import { sunAngle, dayPhase, clamp, smoothstep } from '../shared/constants.js';
import { sunTex, moonTex, cloudTex } from './textures.js';

const CHUNK_VERT = `
attribute vec4 light;
uniform float time;
varying vec2 vUv;
varying vec3 vLight;
varying float vDepth;
void main() {
  vUv = uv;
  vLight = light.xyz;
  vec3 p = position;
  #ifdef WAVES
    vec4 wp = modelMatrix * vec4(p, 1.0);
    p.y += light.w * (sin(time * 1.6 + wp.x * 1.3 + wp.z * 0.9) * 0.05 - 0.03);
  #endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const CHUNK_FRAG = `
uniform sampler2D map;
uniform vec3 skyLight;
uniform vec3 blockLight;
uniform float minLight;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float time;
varying vec2 vUv;
varying vec3 vLight;
varying float vDepth;
void main() {
  vec4 c = texture2D(map, vUv);
  #ifdef CUTOUT
    if (c.a < 0.35) discard;
  #endif
  vec3 l = max(skyLight * vLight.x, blockLight * vLight.y);
  l = max(l, vec3(minLight * vLight.z));
  vec3 col = c.rgb * l;
  float f = clamp((vDepth - fogNear) / (fogFar - fogNear), 0.0, 1.0);
  f = f * f;
  col = mix(col, fogColor, f);
  #ifdef WAVES
    gl_FragColor = vec4(col, mix(c.a, 1.0, f));
  #else
    gl_FragColor = vec4(col, 1.0);
  #endif
  #include <colorspace_fragment>
}`;

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = `
uniform vec3 top;
uniform vec3 hor;
uniform vec3 glow;
uniform vec3 sunDir;
uniform float glowAmt;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float t = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(hor, top, pow(t, 0.55));
  float s = max(dot(d, sunDir), 0.0);
  c += glow * (pow(s, 5.0) * glowAmt);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export class Renderer {
  constructor(canvas, atlasTex, touch) {
    this.canvas = canvas;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.r = r;
    this.basePR = Math.min(window.devicePixelRatio || 1, touch ? 1 : 1.5);
    this.scale = 1;
    r.setPixelRatio(this.basePR);
    r.setSize(window.innerWidth, window.innerHeight, false);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 700);
    this.camera.rotation.order = 'YXZ';
    this.fog = new THREE.Fog(0xaaccee, 30, 80);
    this.scene.fog = this.fog;
    this.scene.background = null;

    // materialen voor de blokken (delen dezelfde instellingen)
    this.U = {
      map: { value: atlasTex },
      skyLight: { value: new THREE.Color(1, 1, 1) },
      blockLight: { value: new THREE.Color(1.0, 0.8, 0.56) },
      minLight: { value: 0.05 },
      fogColor: { value: this.fog.color },
      fogNear: { value: 30 }, fogFar: { value: 80 },
      time: { value: 0 },
    };
    const mk = (defines, extra) => new THREE.ShaderMaterial(Object.assign({ uniforms: this.U, vertexShader: CHUNK_VERT, fragmentShader: CHUNK_FRAG, defines }, extra));
    this.chunkMats = [
      mk({}, {}),
      mk({ CUTOUT: 1 }, { side: THREE.DoubleSide }),
      mk({ WAVES: 1 }, { transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    ];

    // licht voor wezens
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x554433, 2);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.scene.add(this.hemi, this.sun, this.sun.target);

    // luchtkoepel
    this.skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, glow: { value: new THREE.Color(1, 0.6, 0.3) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, glowAmt: { value: 0 } };
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(100, 20, 12), new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false }));
    this.dome.renderOrder = -100; this.dome.frustumCulled = false;
    this.scene.add(this.dome);

    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex(), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sunSprite.scale.set(150, 150, 1);
    this.moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex(), fog: false, transparent: true, depthWrite: false }));
    this.moonSprite.scale.set(90, 90, 1);
    this.sunSprite.renderOrder = -50; this.moonSprite.renderOrder = -50;
    this.scene.add(this.sunSprite, this.moonSprite);

    // sterren
    const sp = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const a = Math.random() * 6.283, h = Math.random() * 0.95 + 0.03, rr = Math.sqrt(1 - h * h);
      sp[i * 3] = Math.cos(a) * rr * 480; sp[i * 3 + 1] = h * 480; sp[i * 3 + 2] = Math.sin(a) * rr * 480;
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0, depthWrite: false }));
    this.stars.renderOrder = -60; this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    // wolken
    this.cloudTex = cloudTex();
    this.cloudTex.repeat.set(5, 5);
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshBasicMaterial({ map: this.cloudTex, transparent: true, opacity: 0.8, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.renderOrder = -40;
    this.scene.add(this.clouds);
    this.cloudDrift = 0;

    // lichtstraal boven de levensboom
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 420, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    this.beam.frustumCulled = false;
    this.scene.add(this.beam);

    this.world = 'groen';
    this.viewDist = 64;
    this.c1 = new THREE.Color(); this.c2 = new THREE.Color(); this.c3 = new THREE.Color();
    this.dayF = 1;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 300));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setScale(s) {
    s = clamp(s, 0.5, 1);
    if (Math.abs(s - this.scale) < 0.01) return;
    this.scale = s;
    this.r.setPixelRatio(this.basePR * s);
    this.r.setSize(window.innerWidth, window.innerHeight, false);
  }

  setView(radius) { this.viewDist = radius * 16 - 4; }

  setWorld(id, trees) {
    this.world = id;
    const def = WORLDS[id], T = def.tree;
    this.beam.position.set(T.x + 0.5, T.y + 200, T.z + 0.5);
    this.beam.material.color.setHex(T.beam);
    this.setTrees(trees);
    this.clouds.visible = id !== 'vuur' && id !== 'schaduw';
  }
  setTrees(trees) {
    const T = WORLDS[this.world].tree;
    this.beam.material.opacity = trees && trees[T.key] ? 0.42 : 0.2;
  }

  // time = speltijd in seconden; env = { water, lava, nightEyes }
  update(time, dt, env) {
    const def = WORLDS[this.world], sky = def.sky, cam = this.camera;
    const ph = def.cycle ? dayPhase(time) : def.fixedTime;
    const ang = sunAngle(ph);
    const el = Math.sin(ang);
    const dayF = def.cycle ? smoothstep(-0.12, 0.22, el) : 0;
    this.dayF = def.cycle ? dayF : 0;
    const dusk = def.cycle ? clamp(1 - Math.abs(el) / 0.28, 0, 1) : 0;
    // zon draait van oost (+x) via boven naar west
    this.sunDir.set(Math.cos(ang), el, 0.25).normalize();

    const top = this.c1.setHex(sky.nightTop).lerp(this.c2.setHex(sky.dayTop), dayF);
    this.skyU.top.value.copy(top);
    const hor = this.c1.setHex(sky.nightHor).lerp(this.c2.setHex(sky.dayHor), dayF);
    hor.lerp(this.c3.setHex(sky.duskHor), dusk * 0.6);
    this.skyU.hor.value.copy(hor);
    this.skyU.sunDir.value.copy(this.sunDir);
    this.skyU.glowAmt.value = def.cycle ? dusk * 0.9 + dayF * 0.15 : 0;

    // mist
    let near = this.viewDist * 0.5, far = this.viewDist;
    this.fog.color.copy(hor);
    if (env.water) { this.fog.color.setHex(def.water).multiplyScalar(0.35 + 0.4 * dayF); near = 0.5; far = 20; }
    else if (env.lava) { this.fog.color.setHex(0xe05a10); near = 0.1; far = 2.5; }
    this.fog.near = near; this.fog.far = far;
    this.U.fogNear.value = near; this.U.fogFar.value = far;
    this.U.time.value = (this.U.time.value + dt) % 1000;

    // licht op de blokken
    const nl = def.nightLight * (env.nightEyes ? 1.6 : 1);
    const sl = this.U.skyLight.value;
    sl.setRGB(nl * 0.62 + (1 - nl * 0.62) * dayF, nl * 0.72 + (1 - nl * 0.72) * dayF, nl + (1 - nl) * dayF);
    if (dusk > 0 && dayF > 0.05) { sl.g *= 1 - dusk * 0.12; sl.b *= 1 - dusk * 0.26; }
    if (id_vuur(this.world)) sl.setRGB(nl * 1.25, nl * 0.8, nl * 0.62);
    if (this.world === 'schaduw') sl.setRGB(nl * 0.85, nl * 0.7, nl * 1.2);
    this.U.minLight.value = def.minLight + (env.nightEyes ? 0.1 : 0);

    // licht op wezens
    const amb = Math.max(sl.r, sl.g, sl.b);
    this.hemi.intensity = 0.5 + amb * 2.1;
    this.hemi.color.copy(sl).lerp(this.c2.setRGB(1, 1, 1), 0.4);
    this.sun.intensity = dayF * 1.6;
    this.sun.position.copy(cam.position).addScaledVector(this.sunDir, 50);
    this.sun.target.position.copy(cam.position);

    // hemellichamen
    this.dome.position.copy(cam.position);
    this.sunSprite.visible = def.cycle && el > -0.2;
    this.sunSprite.position.copy(cam.position).addScaledVector(this.sunDir, 520);
    this.moonSprite.visible = def.cycle && el < 0.2;
    this.moonSprite.position.copy(cam.position).addScaledVector(this.sunDir, -520);
    this.stars.position.copy(cam.position);
    this.stars.material.opacity = def.cycle ? 1 - dayF : (this.world === 'schaduw' ? 0.7 : 0.2);
    this.stars.visible = this.stars.material.opacity > 0.02;

    if (this.clouds.visible) {
      this.cloudDrift += dt * 0.0016;
      const cy = this.world === 'wolken' ? 168 : 152;
      this.clouds.position.set(cam.position.x, cy, cam.position.z);
      this.cloudTex.offset.set(cam.position.x / 320 + this.cloudDrift, -cam.position.z / 320);
      this.clouds.material.color.copy(sl).lerp(this.c2.setRGB(1, 1, 1), 0.25);
      this.clouds.material.opacity = 0.78;
    }
  }

  render() { this.r.render(this.scene, this.camera); }
}

function id_vuur(w) { return w === 'vuur'; }
