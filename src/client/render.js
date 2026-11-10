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
varying float vGlow;
void main() {
  vUv = uv;
  vLight = light.xyz;
  vec3 p = position;
  #ifdef WAVES
    vec4 wp = modelMatrix * vec4(p, 1.0);
    p.y += light.w * (sin(time * 1.6 + wp.x * 1.3 + wp.z * 0.9) * 0.05 - 0.03);
    vGlow = 0.0;
  #else
    // light.w = gloed (0..60) + 64 voor plantjes + 128 voor bewegen in de wind
    float w = light.w * 255.0 + 0.5;
    w -= step(128.0, w) * 128.0;
    w -= step(64.0, w) * 64.0;
    vGlow = floor(w) / 60.0;
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
varying float vGlow;
void main() {
  vec4 c = texture2D(map, vUv);
  #ifdef CUTOUT
    if (c.a < 0.35) discard;
  #endif
  vec3 l = max(skyLight * vLight.x, blockLight * vLight.y);
  l = max(l, vec3(minLight * vLight.z));
  l = max(l, vec3(vGlow));                 // fluorescerende blokken lichten zelf op, in hun eigen kleur
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

// ---------- de mooie weergave (instelling "Mooie graphics") ----------
// Zelfde blokken, maar het licht wordt per pixel uitgerekend: zonlicht dat over het reliëf
// van de plaatjes strijkt, glans op water, ijs, metaal en edelstenen, gloed per pixel,
// blaadjes en gras die bewegen in de wind, golvend water dat de lucht weerspiegelt,
// en zachtere, vollere kleuren.
const HQ_VERT = `
attribute vec4 light;
uniform float time;
varying vec2 vUv;
varying vec3 vLight;
varying float vDepth;
varying float vGlow;
varying float vPlant;
varying vec3 vRel;
void main() {
  vUv = uv;
  vLight = light.xyz;
  vec3 p = position;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  #ifdef WAVES
    p.y += light.w * (sin(time * 1.6 + wp.x * 1.3 + wp.z * 0.9) * 0.05 - 0.03);
    vGlow = 0.0;
    vPlant = 0.0;
  #else
    float w = light.w * 255.0 + 0.5;
    float sway = step(128.0, w);
    w -= sway * 128.0;
    vPlant = step(64.0, w);
    w -= vPlant * 64.0;
    vGlow = floor(w) / 60.0;
    // wind: alles wat kan bewegen wiegt mee, afhankelijk van de plek (zodat buren aansluiten)
    float ph = time * 1.4 + wp.x * 0.7 + wp.z * 0.9 + wp.y * 0.4;
    float amp = sway * (0.035 + 0.035 * vPlant);
    p.x += amp * (sin(ph) + 0.5 * sin(ph * 2.3 + 1.7));
    p.z += amp * cos(ph * 0.9 + 0.6);
  #endif
  vec4 wp2 = modelMatrix * vec4(p, 1.0);
  vRel = wp2.xyz - cameraPosition;
  vec4 mv = viewMatrix * wp2;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const HQ_FRAG = `
uniform sampler2D map;
uniform sampler2D nmap;
uniform vec3 skyLight;
uniform vec3 blockLight;
uniform float minLight;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float time;
uniform vec3 sunDir;
uniform vec3 sunCol;
uniform vec3 skyTop;
varying vec2 vUv;
varying vec3 vLight;
varying float vDepth;
varying float vGlow;
varying float vPlant;
varying vec3 vRel;
void main() {
  vec4 c = texture2D(map, vUv);
  #ifdef CUTOUT
    if (c.a < 0.4) discard;
  #endif
  vec4 nm = texture2D(nmap, vUv);
  vec3 V = normalize(-vRel);
  // de kant waar het vlak naartoe kijkt, uitgerekend uit de vorm zelf
  vec3 dpx = dFdx(vRel), dpy = dFdy(vRel);
  vec3 N = normalize(cross(dpx, dpy));
  // reliëf uit het plaatje, gedraaid naar de stand van het vlak
  vec2 dux = dFdx(vUv), duy = dFdy(vUv);
  vec3 q2 = cross(dpy, N), q1 = cross(N, dpx);
  vec3 T = q2 * dux.x + q1 * duy.x;
  vec3 B = q2 * dux.y + q1 * duy.y;
  float inv = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12));
  vec2 nxy = nm.xy * 2.0 - 1.0;
  vec3 n = normalize(T * (nxy.x * inv) + B * (nxy.y * inv) + N * sqrt(max(1.0 - dot(nxy, nxy), 0.05)));
  float sky = vLight.x;
  float open = smoothstep(0.25, 0.85, sky);              // ligt dit in de open lucht? (anders geen zon)
  #ifdef WAVES
    float water = step(0.95, nm.a);
    float up = step(0.5, N.y) * water;
    // rimpelingen op het water
    vec2 wxz = vRel.xz + cameraPosition.xz;
    vec2 rip = vec2(
      sin(wxz.x * 1.7 + time * 1.5) + 0.6 * sin(wxz.x * 3.9 - wxz.y * 2.3 + time * 2.1) + 0.3 * sin(wxz.y * 7.3 + time * 3.3),
      sin(wxz.y * 1.9 - time * 1.2) + 0.6 * sin(wxz.y * 4.3 + wxz.x * 2.7 - time * 1.8) + 0.3 * sin(wxz.x * 6.7 - time * 2.9));
    n = normalize(mix(n, vec3(rip.x * 0.11, 1.0, rip.y * 0.11), up));
    vec3 l = skyLight * sky * 0.85 + sunCol * (max(dot(n, sunDir), 0.0) * open * 0.4) + blockLight * vLight.y;
    l = max(l, vec3(minLight * vLight.z));
    vec3 col = c.rgb * l;
    // weerspiegeling van de lucht, sterker naarmate je schuiner over het water kijkt
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(V, n), 0.0), 4.0);
    vec3 R = reflect(-V, n);
    vec3 refl = mix(fogColor, skyTop, clamp(R.y * 1.6, 0.0, 1.0)) * (0.35 + 0.65 * open);
    col = mix(col, refl, fres * water * 0.85);
    float glint = pow(max(dot(R, sunDir), 0.0), 220.0);
    col += sunCol * (glint * 2.5 * open * water);
    float alpha = mix(c.a, 1.0, clamp(fres * water * 0.9 + glint, 0.0, 1.0));
    // glas en portalen: een beetje glans
    col += sunCol * ((1.0 - water) * nm.b * open * 0.5 * pow(max(dot(n, normalize(sunDir + V)), 0.0), 40.0));
    col = max(col, c.rgb * ((1.0 - water) * nm.a));
  #else
    n = normalize(mix(n, vec3(0.0, 1.0, 0.0), vPlant * 0.8));
    float ndl = max(dot(n, sunDir), 0.0);
    // licht van de hemel (van boven meer dan van opzij), zon of maan, en fakkels
    vec3 l = skyLight * (sky * (0.5 + 0.16 * n.y + 0.13 * dot(n, sunDir))) + sunCol * (ndl * open) + blockLight * (vLight.y * (0.72 + 0.28 * max(dot(n, N), 0.0)));
    l = max(l, vec3(minLight * vLight.z * (0.75 + 0.25 * n.y)));
    vec3 col = c.rgb * l;
    // glans
    vec3 Hv = normalize(sunDir + V);
    col += sunCol * (nm.b * open * pow(max(dot(n, Hv), 0.0), 36.0) * 0.9);
    col += blockLight * (nm.b * vLight.y * 0.35 * pow(max(dot(n, V), 0.0), 12.0));
    // gloed: blokken met een eigen gloed gebruiken het plaatje als masker; anders gloeit alleen wat het plaatje aangeeft
    float glow = max(vGlow * (0.3 + 0.7 * nm.a), nm.a * (1.0 - step(0.001, vGlow)));
    col = max(col, c.rgb * (glow * 1.25));
  #endif
  float f = clamp((vDepth - fogNear) / (fogFar - fogNear), 0.0, 1.0);
  f = f * f;
  // mist kleurt mee met de zon als je ertegenin kijkt
  vec3 fc = fogColor + sunCol * (0.35 * pow(max(dot(-V, sunDir), 0.0), 8.0));
  col = mix(col, fc, f);
  // zachte overgang naar wit in plaats van hard afkappen, en iets vollere kleuren
  col = 1.0 - exp(-col * 1.25);
  float g = dot(col, vec3(0.299, 0.587, 0.114));
  col = max(mix(vec3(g), col, 1.1), 0.0);
  #ifdef WAVES
    gl_FragColor = vec4(col, mix(alpha, 1.0, f));
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
uniform float hq;
uniform vec3 sunCol;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float t = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(hor, top, pow(t, 0.55));
  float s = max(dot(d, sunDir), 0.0);
  c += glow * (pow(s, 5.0) * glowAmt);
  // mooie weergave: nevel aan de horizon en een zachte krans om de zon of de maan
  c = mix(c, hor * 1.08 + 0.03, hq * 0.55 * pow(1.0 - t, 9.0));
  c += sunCol * (hq * (0.22 * pow(s, 24.0) + 0.5 * pow(s, 300.0)));
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
    this.stdMats = [
      mk({}, {}),
      mk({ CUTOUT: 1 }, { side: THREE.DoubleSide }),
      mk({ WAVES: 1 }, { transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    ];
    this.chunkMats = this.stdMats;
    // de mooie weergave krijgt zijn eigen materialen en plaatjes (pas gemaakt als je hem aanzet)
    this.hq = false;
    this.touch = touch;
    this.stdTex = atlasTex;
    this.UH = Object.assign({}, this.U, {
      map: { value: atlasTex }, nmap: { value: null },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 1, 1) }, skyTop: { value: new THREE.Color(0.3, 0.5, 0.9) },
    });
    this.hqMats = null;

    // licht voor wezens
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x554433, 2);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.scene.add(this.hemi, this.sun, this.sun.target);

    // luchtkoepel
    this.skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, glow: { value: new THREE.Color(1, 0.6, 0.3) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, glowAmt: { value: 0 }, hq: { value: 0 }, sunCol: this.UH.sunCol };
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

  // Mooie weergave aan of uit. atlas = { tex, nrm } van buildAtlasHQ. Geeft de materialen terug
  // waarmee de chunks getekend moeten worden.
  setHQ(on, atlas) {
    this.hq = !!on && !!atlas;
    if (this.hq) {
      this.UH.map.value = atlas.tex; this.UH.nmap.value = atlas.nrm;
      const aniso = Math.min(4, this.r.capabilities.getMaxAnisotropy());
      atlas.tex.anisotropy = aniso; atlas.nrm.anisotropy = aniso;
      if (!this.hqMats) {
        const mk = (defines, extra) => new THREE.ShaderMaterial(Object.assign({ uniforms: this.UH, vertexShader: HQ_VERT, fragmentShader: HQ_FRAG, defines, extensions: { derivatives: true } }, extra));
        this.hqMats = [
          mk({}, {}),
          mk({ CUTOUT: 1 }, { side: THREE.DoubleSide }),
          mk({ WAVES: 1 }, { transparent: true, depthWrite: false, side: THREE.DoubleSide }),
        ];
      }
    }
    this.chunkMats = this.hq ? this.hqMats : this.stdMats;
    this.skyU.hq.value = this.hq ? 1 : 0;
    // scherper beeld in de mooie weergave (het spel schaalt vanzelf terug als het te zwaar wordt)
    this.basePR = Math.min(window.devicePixelRatio || 1, this.hq ? (this.touch ? 1.5 : 2) : (this.touch ? 1 : 1.5));
    this.r.setPixelRatio(this.basePR * this.scale);
    this.r.setSize(window.innerWidth, window.innerHeight, false);
    return this.chunkMats;
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
    // regen en sneeuw: de lucht trekt grijs dicht; bliksem licht hem even op
    const wet = env.wet || 0, flash = env.flash || 0;
    if (wet > 0.01) {
      const grey = this.c3.setRGB(0.07 + 0.36 * dayF, 0.08 + 0.39 * dayF, 0.1 + 0.42 * dayF);
      this.skyU.top.value.lerp(grey, wet * 0.85);
      hor.lerp(grey, wet * 0.8);
    }
    if (flash > 0) { this.skyU.top.value.lerp(this.c3.setRGB(0.85, 0.9, 1), flash * 0.7); hor.lerp(this.c3.setRGB(0.85, 0.9, 1), flash * 0.7); }
    this.skyU.hor.value.copy(hor);
    this.skyU.sunDir.value.copy(this.sunDir);
    this.skyU.glowAmt.value = def.cycle ? dusk * 0.9 + dayF * 0.15 : 0;

    // mist
    let near = this.viewDist * (0.5 - 0.32 * wet), far = this.viewDist * (1 - 0.3 * wet);
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
    if (wet > 0.01) sl.multiplyScalar(1 - 0.3 * wet * dayF);
    if (flash > 0) { sl.r += flash * 0.7; sl.g += flash * 0.75; sl.b += flash * 0.9; }
    if (id_vuur(this.world)) sl.setRGB(nl * 1.25, nl * 0.8, nl * 0.62);
    if (this.world === 'schaduw') sl.setRGB(nl * 0.85, nl * 0.7, nl * 1.2);
    this.U.minLight.value = def.minLight + (env.nightEyes ? 0.1 : 0);

    // mooie weergave: van welke kant komt het licht, en welke kleur heeft het?
    if (this.hq) {
      const sd = this.UH.sunDir.value, sc = this.UH.sunCol.value;
      if (!def.cycle) {
        // werelden zonder dag en nacht: een vaste, zwakke gloed
        if (this.world === 'vuur') { sd.set(0.35, 0.55, 0.45).normalize(); sc.setRGB(0.5, 0.2, 0.08); }
        else { sd.set(-0.3, 0.8, 0.4).normalize(); sc.setRGB(0.16, 0.1, 0.3); }
      } else if (el > -0.06) {
        // de zon: warm wit overdag, oranje bij zonsopkomst en zonsondergang
        const k = smoothstep(-0.06, 0.12, el);
        sd.copy(this.sunDir); if (sd.y < 0.06) { sd.y = 0.06; sd.normalize(); }
        sc.setRGB(0.95, 0.9 - dusk * 0.3, 0.8 - dusk * 0.5).multiplyScalar(0.62 * k);
      } else {
        // de maan: koel en zwak
        const k = smoothstep(0.06, 0.3, -el);
        sd.copy(this.sunDir).multiplyScalar(-1); if (sd.y < 0.06) { sd.y = 0.06; sd.normalize(); }
        sc.setRGB(0.16, 0.2, 0.32).multiplyScalar(k * (env.nightEyes ? 1.5 : 1));
      }
      if (env.water) sc.multiplyScalar(0.5);
      if (wet > 0.01) sc.multiplyScalar(1 - 0.8 * wet);
      this.UH.skyTop.value.copy(this.skyU.top.value);
    }

    // licht op wezens
    const amb = Math.max(sl.r, sl.g, sl.b);
    this.hemi.intensity = 0.5 + amb * 2.1;
    this.hemi.color.copy(sl).lerp(this.c2.setRGB(1, 1, 1), 0.4);
    this.sun.intensity = dayF * 1.6 * (1 - 0.7 * wet);
    this.sun.position.copy(cam.position).addScaledVector(this.sunDir, 50);
    this.sun.target.position.copy(cam.position);

    // hemellichamen
    this.dome.position.copy(cam.position);
    this.sunSprite.visible = def.cycle && el > -0.2 && wet < 0.45;
    this.sunSprite.position.copy(cam.position).addScaledVector(this.sunDir, 520);
    this.moonSprite.visible = def.cycle && el < 0.2 && wet < 0.45;
    this.moonSprite.position.copy(cam.position).addScaledVector(this.sunDir, -520);
    this.stars.position.copy(cam.position);
    this.stars.material.opacity = (def.cycle ? 1 - dayF : (this.world === 'schaduw' ? 0.7 : 0.2)) * (1 - wet);
    this.stars.visible = this.stars.material.opacity > 0.02;

    if (this.clouds.visible) {
      this.cloudDrift += dt * 0.0016;
      const cy = this.world === 'wolken' ? 168 : 152;
      this.clouds.position.set(cam.position.x, cy, cam.position.z);
      this.cloudTex.offset.set(cam.position.x / 320 + this.cloudDrift, -cam.position.z / 320);
      this.clouds.material.color.copy(sl).lerp(this.c2.setRGB(1, 1, 1), 0.25).multiplyScalar(1 - 0.5 * wet);
      this.clouds.material.opacity = 0.78 + 0.2 * wet;
    }
  }

  render() { this.r.render(this.scene, this.camera); }
}

function id_vuur(w) { return w === 'vuur'; }
