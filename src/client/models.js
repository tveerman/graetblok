// 3D-modellen van alle wezens, opgebouwd uit doosjes met een getekende huid.
// Alle modellen kijken naar +z.
import * as THREE from '../../vendor/three.module.min.js';
import { skin, faceTex, wingTex } from './textures.js';
import { DRAGONS, MOBS } from '../shared/mobs.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const PLANE = new THREE.PlaneGeometry(1, 1);
const mats = new Map();

function mat(color, kind = 'glad', extra) {
  const key = color + kind + (extra ? JSON.stringify(extra) : '');
  if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial(Object.assign({ map: skin(color, kind) }, extra || {})));
  return mats.get(key);
}
function glowMat(color) {
  const key = 'glow' + color;
  if (!mats.has(key)) mats.set(key, new THREE.MeshBasicMaterial({ color }));
  return mats.get(key);
}
function faceMats(color, kind, eye, glow, mouth, extra) {
  const key = 'fm' + color + kind + eye + glow + mouth + (extra ? JSON.stringify(extra) : '');
  if (!mats.has(key)) {
    const side = mat(color, kind, extra);
    const face = new THREE.MeshLambertMaterial(Object.assign({ map: faceTex(color, kind, eye, glow, mouth) }, extra || {}));
    mats.set(key, [side, side, side, side, face, side]);
  }
  return mats.get(key);
}
function part(parent, material, w, h, d, x, y, z) {
  const m = new THREE.Mesh(BOX, material);
  m.scale.set(w, h, d); m.position.set(x, y, z);
  parent.add(m);
  return m;
}
// ledemaat dat aan de bovenkant scharniert
function limb(parent, material, w, h, d, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const m = new THREE.Mesh(BOX, material);
  m.scale.set(w, h, d); m.position.y = -h / 2;
  g.add(m); parent.add(g);
  return g;
}

function base(type) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  root.userData.a = { type, inner, legs: [], arms: [], wings: [], tail: [], phase: 0, head: null, jaw: null };
  return root;
}

function pluizel(color) {
  const root = base('pluizel'), g = root.userData.a.inner, a = root.userData.a;
  const fur = mat(color, 'vacht');
  part(g, faceMats(color, 'vacht', '#201018', false, true), 0.6, 0.5, 0.56, 0, 0.37, 0);
  a.ears = [part(g, fur, 0.12, 0.24, 0.08, -0.18, 0.72, -0.02), part(g, fur, 0.12, 0.24, 0.08, 0.18, 0.72, -0.02)];
  part(g, mat(0xff8fb0, 'glad'), 0.09, 0.12, 0.09, 0, 0.68, 0.12);
  a.legs = [limb(g, fur, 0.16, 0.14, 0.2, -0.16, 0.14, 0.04), limb(g, fur, 0.16, 0.14, 0.2, 0.16, 0.14, 0.04)];
  part(g, mat(0xffffff, 'vacht'), 0.18, 0.18, 0.16, 0, 0.36, -0.34);
  return root;
}

function hert() {
  const root = base('quad'), g = root.userData.a.inner, a = root.userData.a;
  const fur = mat(0x9a6a3c, 'vacht'), light = mat(0xe0c8a0, 'vacht'), horn = mat(0xe8dcc0, 'glad');
  part(g, fur, 0.5, 0.52, 1.1, 0, 0.98, 0);
  part(g, light, 0.4, 0.12, 0.9, 0, 0.7, 0);
  const neck = part(g, fur, 0.22, 0.55, 0.24, 0, 1.36, 0.5); neck.rotation.x = 0.45;
  const head = new THREE.Group(); head.position.set(0, 1.62, 0.66); g.add(head); a.head = head;
  part(head, faceMats(0x9a6a3c, 'vacht', '#101010', false, false), 0.3, 0.3, 0.4, 0, 0, 0.08);
  part(head, light, 0.2, 0.16, 0.16, 0, -0.06, 0.34);
  for (const s of [-1, 1]) {
    const an = part(head, horn, 0.05, 0.4, 0.05, s * 0.13, 0.32, -0.04); an.rotation.z = -s * 0.35;
    const t = part(head, horn, 0.04, 0.2, 0.04, s * 0.24, 0.42, 0.02); t.rotation.z = -s * 1.0;
    part(head, fur, 0.07, 0.12, 0.04, s * 0.2, 0.14, -0.08);
  }
  for (const [x, z] of [[-0.17, 0.4], [0.17, 0.4], [-0.17, -0.4], [0.17, -0.4]]) a.legs.push(limb(g, fur, 0.13, 0.72, 0.13, x, 0.72, z));
  part(g, mat(0xffffff, 'vacht'), 0.12, 0.16, 0.1, 0, 1.12, -0.58);
  return root;
}

function quad(color, kind, eye, glow, spikes) {
  const root = base('quad'), g = root.userData.a.inner, a = root.userData.a;
  const fur = mat(color, kind);
  part(g, fur, 0.5, 0.45, 1.0, 0, 0.62, 0);
  const head = new THREE.Group(); head.position.set(0, 0.76, 0.6); g.add(head); a.head = head;
  part(head, faceMats(color, kind, eye, glow, false), 0.42, 0.38, 0.4, 0, 0, 0);
  part(head, fur, 0.24, 0.18, 0.24, 0, -0.07, 0.3);
  part(head, fur, 0.1, 0.18, 0.06, -0.14, 0.26, -0.08); part(head, fur, 0.1, 0.18, 0.06, 0.14, 0.26, -0.08);
  for (const [x, z] of [[-0.17, 0.36], [0.17, 0.36], [-0.17, -0.36], [0.17, -0.36]]) a.legs.push(limb(g, fur, 0.14, 0.42, 0.14, x, 0.42, z));
  const tail = limb(g, fur, 0.1, 0.5, 0.1, 0, 0.78, -0.5); tail.rotation.x = -2.1; a.tail.push(tail);
  if (spikes) for (let i = 0; i < 4; i++) part(g, glowMat(spikes), 0.08, 0.18, 0.1, 0, 0.92, 0.36 - i * 0.24);
  return root;
}

function golem(color, eyeGlow) {
  const root = base('biped'), g = root.userData.a.inner, a = root.userData.a;
  const rock = mat(color, 'rots'), dark = mat(color, 'rots', { color: 0x9a9a9a });
  a.legs = [limb(g, dark, 0.36, 0.82, 0.36, -0.25, 0.82, 0), limb(g, dark, 0.36, 0.82, 0.36, 0.25, 0.82, 0)];
  part(g, rock, 0.96, 0.9, 0.56, 0, 1.27, 0);
  part(g, dark, 0.5, 0.3, 0.4, 0, 1.55, -0.26);
  const head = new THREE.Group(); head.position.set(0, 1.95, 0.04); g.add(head); a.head = head;
  part(head, faceMats(color, 'rots', eyeGlow, true, false), 0.5, 0.44, 0.46, 0, 0, 0);
  a.arms = [limb(g, rock, 0.3, 1.05, 0.32, -0.64, 1.68, 0), limb(g, rock, 0.3, 1.05, 0.32, 0.64, 1.68, 0)];
  part(g, rock, 0.4, 0.26, 0.44, -0.62, 1.72, 0); part(g, rock, 0.4, 0.26, 0.44, 0.62, 1.72, 0);
  return root;
}

function spin() {
  const root = base('spin'), g = root.userData.a.inner, a = root.userData.a;
  const metal = mat(0x7a8694, 'metaal'), dark = mat(0x3a424c, 'metaal');
  part(g, metal, 0.7, 0.32, 0.8, 0, 0.5, 0);
  part(g, dark, 0.4, 0.14, 0.5, 0, 0.72, -0.05);
  part(g, dark, 0.36, 0.26, 0.3, 0, 0.5, 0.52);
  part(g, glowMat(0xff3020), 0.2, 0.1, 0.04, 0, 0.52, 0.68);
  part(g, dark, 0.03, 0.3, 0.03, 0.12, 0.9, -0.2);
  part(g, glowMat(0x4ae0ff), 0.07, 0.07, 0.07, 0.12, 1.06, -0.2);
  for (const s of [-1, 1]) for (const z of [-0.28, 0, 0.28]) {
    const l = limb(g, dark, 0.08, 0.7, 0.08, s * 0.36, 0.56, z);
    l.rotation.z = s * 0.95;
    l.userData.rz = s * 0.95; l.userData.ph = (z + 0.28) * 3.7 + (s > 0 ? Math.PI : 0);
    a.legs.push(l);
  }
  return root;
}

function geest(tint, boss) {
  const root = base('geest'), g = root.userData.a.inner, a = root.userData.a;
  const ex = { transparent: true, opacity: 0.86, emissive: tint, emissiveIntensity: 0.45 };
  const body = mat(tint, 'glad', ex);
  part(g, body, 0.6, 0.5, 0.45, 0, 1.0, 0);
  part(g, body, 0.48, 0.4, 0.36, 0, 0.58, 0);
  part(g, body, 0.32, 0.36, 0.26, 0, 0.24, 0);
  const head = new THREE.Group(); head.position.set(0, 1.47, 0); g.add(head); a.head = head;
  part(head, faceMats(tint, 'glad', '#ffffff', true, false, ex), 0.52, 0.48, 0.48, 0, 0, 0);
  a.arms = [limb(g, body, 0.14, 0.55, 0.14, -0.42, 1.2, 0), limb(g, body, 0.14, 0.55, 0.14, 0.42, 1.2, 0)];
  a.arms[0].rotation.x = -1.1; a.arms[1].rotation.x = -1.1;
  if (boss) for (let i = 0; i < 5; i++) part(head, glowMat(0xffd23a), 0.08, 0.2, 0.08, -0.2 + i * 0.1, 0.32, (i % 2) * 0.1 - 0.05);
  return root;
}

function vleugel(color) {
  const root = base('vleugel'), g = root.userData.a.inner, a = root.userData.a;
  const fur = mat(color, 'vacht');
  part(g, fur, 0.45, 0.3, 1.1, 0, 0.3, 0);
  const head = new THREE.Group(); head.position.set(0, 0.38, 0.68); g.add(head); a.head = head;
  part(head, faceMats(color, 'vacht', '#ffe040', true, false), 0.32, 0.28, 0.36, 0, 0, 0);
  part(head, mat(0xf0b030, 'glad'), 0.1, 0.08, 0.24, 0, -0.04, 0.28);
  const wm = new THREE.MeshLambertMaterial({ map: wingTex(color), side: THREE.DoubleSide, alphaTest: 0.5 });
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.2, 0.42, 0.1); g.add(piv);
    const w = new THREE.Mesh(PLANE, wm);
    w.rotation.x = -Math.PI / 2; w.scale.set(s * 1.4, 0.9, 1); w.position.set(s * 0.7, 0, -0.1);
    piv.add(w); a.wings.push(piv); piv.userData.s = s;
  }
  const t = new THREE.Mesh(PLANE, wm); t.rotation.x = -Math.PI / 2; t.rotation.z = Math.PI / 2; t.scale.set(0.6, 0.5, 1); t.position.set(0, 0.32, -0.8); g.add(t);
  return root;
}

export function draak(type, growth) {
  const D = DRAGONS[type] || DRAGONS.vuur;
  const root = base('draak'), g = root.userData.a.inner, a = root.userData.a;
  const kind = type === 'robot' ? 'metaal' : 'schub';
  const ex = type === 'kristal' ? { emissive: D.body, emissiveIntensity: 0.25 } : null;
  const body = mat(D.body, kind, ex), belly = mat(D.belly, 'glad'), bone = mat(0xe8dcc0, 'glad');
  const eye = glowMat(type === 'schaduw' || type === 'koning' ? 0xff3020 : 0xffe040);
  part(g, body, 0.7, 0.62, 1.3, 0, 0.86, 0);
  part(g, belly, 0.52, 0.2, 1.2, 0, 0.5, 0);
  const n1 = part(g, body, 0.36, 0.36, 0.56, 0, 1.18, 0.78); n1.rotation.x = -0.65;
  const n2 = part(g, body, 0.3, 0.3, 0.5, 0, 1.46, 1.02); n2.rotation.x = -0.95;
  const head = new THREE.Group(); head.position.set(0, 1.68, 1.12); g.add(head); a.head = head;
  part(head, body, 0.44, 0.36, 0.56, 0, 0, 0.18);
  part(head, body, 0.32, 0.22, 0.36, 0, -0.02, 0.6);
  const jaw = new THREE.Group(); jaw.position.set(0, -0.16, 0.1); head.add(jaw); a.jaw = jaw;
  part(jaw, belly, 0.3, 0.08, 0.6, 0, 0, 0.34);
  for (const s of [-1, 1]) {
    part(head, eye, 0.06, 0.1, 0.12, s * 0.21, 0.06, 0.32);
    const h = part(head, bone, 0.07, 0.07, type === 'koning' ? 0.7 : 0.42, s * 0.15, 0.26, -0.12); h.rotation.x = 0.55;
  }
  if (type === 'koning') for (let i = 0; i < 5; i++) part(head, glowMat(0xffd23a), 0.07, 0.2, 0.07, -0.18 + i * 0.09, 0.26, 0.2);
  for (let i = 0; i < 5; i++) part(g, belly, 0.08, 0.16, 0.14, 0, 1.22, 0.5 - i * 0.26);
  // staart in drie stukken
  const t1 = new THREE.Group(); t1.position.set(0, 0.9, -0.62); g.add(t1);
  part(t1, body, 0.44, 0.4, 0.62, 0, 0, -0.3);
  const t2 = new THREE.Group(); t2.position.set(0, 0, -0.6); t1.add(t2);
  part(t2, body, 0.3, 0.28, 0.62, 0, 0, -0.3);
  const t3 = new THREE.Group(); t3.position.set(0, 0, -0.6); t2.add(t3);
  part(t3, body, 0.18, 0.16, 0.6, 0, 0, -0.3);
  part(t3, belly, 0.34, 0.06, 0.26, 0, 0, -0.66);
  a.tail = [t1, t2, t3];
  for (const [x, z] of [[-0.36, 0.42], [0.36, 0.42], [-0.36, -0.42], [0.36, -0.42]]) {
    const l = limb(g, body, 0.22, 0.6, 0.26, x, 0.62, z);
    part(l, bone, 0.26, 0.08, 0.36, 0, -0.58, 0.06);
    a.legs.push(l);
  }
  const wm = new THREE.MeshLambertMaterial({ map: wingTex(D.wing), side: THREE.DoubleSide, alphaTest: 0.5 });
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.32, 1.16, 0.22); g.add(piv);
    part(piv, body, 1.0, 0.08, 0.1, s * 0.5, 0, 0.3);
    const w = new THREE.Mesh(PLANE, wm);
    w.rotation.x = -Math.PI / 2; w.scale.set(s * 1.9, 1.3, 1); w.position.set(s * 0.95, 0, -0.3);
    piv.add(w); piv.userData.s = s; a.wings.push(piv);
  }
  a.seatY = 1.17;
  setDragonGrowth(root, growth === undefined ? 100 : growth);
  return root;
}

// babydraken hebben een grote kop en kleine vleugels
export function setDragonGrowth(root, growth) {
  const a = root.userData.a, t = Math.min(1, growth / 100);
  a.head.scale.setScalar(1.5 - 0.5 * t);
  for (const w of a.wings) w.scale.setScalar(0.5 + 0.5 * t);
}

export function playerModel(look) {
  const root = base('biped'), g = root.userData.a.inner, a = root.userData.a;
  const type = (look && look.type) || 'mens';
  const shirtC = (look && look.shirt) || 0x2f7fd0;
  let skinC = 0xe8b890, kind = 'glad', hairC = (look && look.hair) || 0x5a3a1c, pantsC = 0x3a4a7a, eye = '#201810', glow = false;
  if (type === 'elf') { skinC = 0xcfe8b0; hairC = 0xe8c860; pantsC = 0x4a6a3a; }
  if (type === 'robot') { skinC = 0xa8b4c0; kind = 'metaal'; hairC = 0x56606c; pantsC = 0x56606c; eye = '#4ae0ff'; glow = true; }
  const sk = mat(skinC, kind), shirt = mat(shirtC, type === 'robot' ? 'metaal' : 'glad'), pants = mat(pantsC, kind);
  a.legs = [limb(g, pants, 0.24, 0.75, 0.24, -0.13, 0.75, 0), limb(g, pants, 0.24, 0.75, 0.24, 0.13, 0.75, 0)];
  part(g, shirt, 0.52, 0.7, 0.28, 0, 1.1, 0);
  a.arms = [limb(g, shirt, 0.2, 0.7, 0.2, -0.37, 1.43, 0), limb(g, shirt, 0.2, 0.7, 0.2, 0.37, 1.43, 0)];
  part(a.arms[0], sk, 0.2, 0.16, 0.2, 0, -0.66, 0); part(a.arms[1], sk, 0.2, 0.16, 0.2, 0, -0.66, 0);
  const head = new THREE.Group(); head.position.set(0, 1.68, 0); g.add(head); a.head = head;
  part(head, faceMats(skinC, kind, eye, glow, true), 0.44, 0.44, 0.44, 0, 0, 0);
  const hair = mat(hairC, 'vacht');
  part(head, hair, 0.48, 0.14, 0.48, 0, 0.24, 0);
  part(head, hair, 0.48, 0.3, 0.1, 0, 0.06, -0.2);
  if (type === 'elf') for (const s of [-1, 1]) { const e = part(head, sk, 0.06, 0.2, 0.1, s * 0.25, 0.08, 0); e.rotation.z = -s * 0.5; }
  if (type === 'robot') { part(head, mat(0x56606c, 'metaal'), 0.04, 0.24, 0.04, 0, 0.42, 0); part(head, glowMat(0xff3020), 0.08, 0.08, 0.08, 0, 0.56, 0); }
  return root;
}

const PLUIZEL_COLOR = { groen: 0xf2e2c4, ijs: 0xdff2ff, vuur: 0xffb080, schaduw: 0xc8a0f0, wolken: 0xffd0e4 };

export function buildModel(kind, opts) {
  const def = MOBS[kind];
  const model = def ? def.model : kind;
  let m;
  switch (model) {
    case 'pluizel': m = pluizel(PLUIZEL_COLOR[opts.world] || PLUIZEL_COLOR.groen); break;
    case 'hert': m = hert(); break;
    case 'kruiper': m = quad(0x2a2038, 'vacht', '#ff3020', true, 0x9b4dff); break;
    case 'wolf': m = quad(0xdfeaf2, 'vacht', '#4ac8ff', true, 0); break;
    case 'golem': m = golem(def.tint || 0x8a8a86, def.tint === 0xff5a1a ? '#ffe040' : (def.tint ? '#ffffff' : '#ffb020')); break;
    case 'spin': m = spin(); break;
    case 'geest': m = geest(def.tint || 0xffffff, !!def.boss); break;
    case 'vleugel': m = vleugel(def.boss ? 0x3a4a8a : 0x6a86b0); break;
    case 'draak': m = draak(def.dragon || opts.dtype || 'vuur', opts.growth); break;
    default: m = pluizel(0xff00ff);
  }
  return m;
}

// Beweging van de modellen. speed = hoe snel het wezen beweegt, flags: 1 aanval, 2 vliegt, 4 blijft zitten
export function animate(root, time, speed, flags, dt) {
  const a = root.userData.a;
  const moving = speed > 0.3;
  a.phase += dt * Math.min(12, 3 + speed * 2.2) * (moving ? 1 : 0);
  const ph = a.phase, sw = moving ? Math.sin(ph) : 0;
  const atk = flags & 1;
  switch (a.type) {
    case 'pluizel':
      a.inner.position.y = moving ? Math.abs(Math.sin(ph * 1.2)) * 0.16 : Math.sin(time * 2 + root.id) * 0.012;
      a.legs[0].rotation.x = sw * 0.7; a.legs[1].rotation.x = -sw * 0.7;
      a.ears[0].rotation.z = Math.sin(time * 3 + root.id) * 0.12; a.ears[1].rotation.z = -a.ears[0].rotation.z;
      break;
    case 'quad':
      a.legs[0].rotation.x = sw * 0.7; a.legs[3].rotation.x = sw * 0.7;
      a.legs[1].rotation.x = -sw * 0.7; a.legs[2].rotation.x = -sw * 0.7;
      if (a.head) a.head.rotation.x = atk ? -0.5 : Math.sin(time * 1.3 + root.id) * 0.06;
      if (a.tail[0]) a.tail[0].rotation.z = Math.sin(time * 4 + root.id) * 0.3;
      a.inner.position.z = atk ? 0.25 : 0;
      break;
    case 'biped':
      a.legs[0].rotation.x = sw * 0.75; a.legs[1].rotation.x = -sw * 0.75;
      if (a.pose === 'ride') { a.legs[0].rotation.set(-1.25, 0, -0.5); a.legs[1].rotation.set(-1.25, 0, 0.5); a.arms[0].rotation.x = -0.9; a.arms[1].rotation.x = -0.9; break; }
      a.arms[0].rotation.x = atk ? -2.2 + Math.sin(time * 20) * 0.5 : -sw * 0.6;
      a.arms[1].rotation.x = (atk || a.swing > 0) ? -2.4 + Math.sin((a.swing || 0) * 14) * 1.2 : sw * 0.6;
      if (a.swing > 0) a.swing -= dt;
      break;
    case 'spin':
      for (const l of a.legs) { l.rotation.x = moving ? Math.sin(ph * 1.6 + l.userData.ph) * 0.5 : 0; l.rotation.z = l.userData.rz + (moving ? Math.cos(ph * 1.6 + l.userData.ph) * 0.12 : 0); }
      a.inner.position.z = atk ? 0.2 : 0;
      break;
    case 'geest':
      a.inner.position.y = Math.sin(time * 2.2 + root.id) * 0.12;
      a.arms[0].rotation.x = -1.1 + Math.sin(time * 3) * 0.2 - (atk ? 0.8 : 0); a.arms[1].rotation.x = -1.1 - Math.sin(time * 3) * 0.2 - (atk ? 0.8 : 0);
      a.inner.rotation.z = Math.sin(time * 1.4 + root.id) * 0.06;
      break;
    case 'vleugel': {
      const f = Math.sin(time * 9 + root.id) * 0.7;
      for (const w of a.wings) w.rotation.z = w.userData.s * f;
      a.inner.rotation.x = atk ? 0.4 : 0;
      break;
    }
    case 'draak': {
      const flying = flags & 2;
      const rate = 6.5;
      const f = flying ? Math.sin(time * rate + root.id) * 0.62 + 0.1 : 0;
      for (const w of a.wings) { w.rotation.z = flying ? w.userData.s * f : w.userData.s * 1.15; w.rotation.y = flying ? 0 : w.userData.s * -0.5; }
      a.inner.position.y = flying ? Math.cos(time * rate + root.id) * 0.06 : 0;
      const sway = Math.sin(time * 2.2 + root.id) * 0.22;
      a.tail[0].rotation.y = sway; a.tail[1].rotation.y = sway * 1.2; a.tail[2].rotation.y = sway * 1.4;
      a.tail[0].rotation.x = flying ? 0.1 : -0.2;
      a.head.rotation.x = Math.sin(time * 1.1 + root.id) * 0.06 + (atk ? -0.2 : 0);
      a.jaw.rotation.x = atk ? 0.5 : 0.04 + Math.abs(Math.sin(time * 0.7 + root.id)) * 0.05;
      if (flying) { for (const l of a.legs) l.rotation.x = 0.7; }
      else { a.legs[0].rotation.x = sw * 0.6; a.legs[3].rotation.x = sw * 0.6; a.legs[1].rotation.x = -sw * 0.6; a.legs[2].rotation.x = -sw * 0.6; }
      break;
    }
  }
}
