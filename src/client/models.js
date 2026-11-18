// 3D-modellen van alle wezens, opgebouwd uit doosjes met een getekende huid.
// Alle modellen kijken naar +z.
import * as THREE from '../../vendor/three.module.min.js';
import { skin, faceTex, wingTex } from './textures.js';
import { DRAGONS, MOBS } from '../shared/mobs.js';
import { ANIMALS, SHINY } from '../shared/animals.js';
import { VEHICLES } from '../shared/vehicles.js';
import { buildRide } from './rides.js';
import { buildCity } from './city.js';
import { buildRig, animateRig, rigify, kneeify } from './rig.js';

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
  dragonExtras(type, D, g, head, a.tail[2], body, belly, bone);
  a.seatY = 1.17;
  setDragonGrowth(root, growth === undefined ? 100 : growth);
  return root;
}

// Elke drakensoort heeft zijn eigen vorm: stekels, hoorns, een staartpunt en dingen die licht geven.
function dragonExtras(type, D, g, head, tip, body, belly, bone) {
  const glow = glowMat(D.glow || 0xffffff);
  const spine = (n, w, h, d, m, z0 = 0.55, dz = 0.3, y = 1.22) => { for (let i = 0; i < n; i++) { const s = part(g, m, w, h * (1 - Math.abs(i - (n - 1) / 2) / n), d, 0, y + h * 0.25, z0 - i * dz); s.rotation.x = -0.35; } };
  switch (type) {
    case 'vuur': {
      // een kam van vlammen over de rug, gloeiende neusgaten en een brandende staartpunt
      spine(6, 0.1, 0.42, 0.16, glow);
      for (const s of [-1, 1]) part(head, glow, 0.06, 0.05, 0.06, s * 0.09, 0.08, 0.79);
      part(tip, glow, 0.2, 0.24, 0.3, 0, 0.06, -0.72); part(tip, glowMat(0xffe070), 0.1, 0.3, 0.16, 0, 0.14, -0.74);
      break;
    }
    case 'ijs': {
      // ijskristallen op rug en kop, en een bevroren knots aan de staart
      const ice = mat(0xdff6ff, 'glad', { transparent: true, opacity: 0.85, emissive: 0x9fe8ff, emissiveIntensity: 0.5 });
      for (let i = 0; i < 5; i++) { const s = part(g, ice, 0.1, 0.34 + (i % 2) * 0.18, 0.1, (i % 2 ? 0.1 : -0.1), 1.36, 0.5 - i * 0.26); s.rotation.set(-0.3, 0.6, (i % 2 ? -0.3 : 0.3)); }
      for (const s of [-1, 1]) { const h = part(head, ice, 0.07, 0.4, 0.07, s * 0.22, 0.3, 0.02); h.rotation.z = -s * 0.5; }
      const k = part(tip, ice, 0.3, 0.3, 0.3, 0, 0, -0.74); k.rotation.set(0.6, 0.6, 0);
      break;
    }
    case 'natuur': {
      // een kraag van bladeren, mos op de rug en een bloem aan de staart
      const leaf = mat(0x6fc23a, 'vacht'), bloem = glowMat(0xff8fd0);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const l = part(head, leaf, 0.08, 0.34, 0.2, Math.cos(a) * 0.26, Math.sin(a) * 0.24, -0.1); l.rotation.z = a - Math.PI / 2; }
      for (let i = 0; i < 4; i++) part(g, leaf, 0.5, 0.08, 0.2, 0, 1.2, 0.42 - i * 0.3);
      part(tip, bloem, 0.3, 0.3, 0.08, 0, 0.02, -0.7); part(tip, glowMat(0xffe040), 0.12, 0.12, 0.1, 0, 0.02, -0.72);
      break;
    }
    case 'bliksem': {
      // zigzag-hoorns en vonkende stekels
      for (const s of [-1, 1]) {
        const h1 = part(head, glow, 0.06, 0.3, 0.06, s * 0.2, 0.36, -0.1); h1.rotation.z = -s * 0.7;
        const h2 = part(head, glow, 0.06, 0.3, 0.06, s * 0.34, 0.56, -0.1); h2.rotation.z = s * 0.5;
      }
      spine(7, 0.06, 0.3, 0.1, glow, 0.6, 0.24);
      const t = part(tip, glow, 0.08, 0.4, 0.3, 0, 0.1, -0.74); t.rotation.x = 0.7;
      break;
    }
    case 'schaduw': {
      // lange gebogen hoorns, paarse gloed onder de buik en rookpluimen
      for (const s of [-1, 1]) { const h = part(head, mat(0x120a1e, 'glad'), 0.08, 0.08, 0.7, s * 0.2, 0.34, -0.3); h.rotation.set(0.75, s * 0.25, 0); }
      part(g, glow, 0.36, 0.05, 1.0, 0, 0.4, 0);
      spine(5, 0.12, 0.3, 0.22, mat(0x1c1230, 'glad'));
      part(tip, glow, 0.16, 0.16, 0.34, 0, 0, -0.74);
      break;
    }
    case 'robot': {
      // antenne, straalmotoren en lampjes
      part(head, mat(0x56606c, 'metaal'), 0.04, 0.36, 0.04, 0, 0.4, 0); part(head, glowMat(0xff3020), 0.1, 0.1, 0.1, 0, 0.6, 0);
      for (const s of [-1, 1]) { part(g, mat(0x56606c, 'metaal'), 0.22, 0.22, 0.6, s * 0.46, 1.0, -0.3); part(g, glow, 0.14, 0.14, 0.08, s * 0.46, 1.0, -0.62); }
      for (let i = 0; i < 4; i++) part(g, glow, 0.72, 0.05, 0.06, 0, 0.9, 0.45 - i * 0.3);
      part(tip, glow, 0.24, 0.24, 0.14, 0, 0, -0.7);
      break;
    }
    case 'goud': {
      // een kroontje, gouden schubbenplaten en een juweel op de borst
      for (let i = 0; i < 5; i++) part(head, glow, 0.06, 0.16 + (i % 2) * 0.1, 0.06, -0.16 + i * 0.08, 0.28, 0.12);
      spine(5, 0.3, 0.14, 0.2, mat(0xfff0a0, 'schub'), 0.5, 0.28, 1.16);
      part(g, glowMat(0xff3a5a), 0.16, 0.16, 0.08, 0, 0.9, 0.68);
      part(tip, glow, 0.26, 0.26, 0.26, 0, 0, -0.74);
      break;
    }
    case 'kristal': {
      // grote kristallen op de rug en de staart
      const k1 = mat(0xd8a8ff, 'glad', { emissive: 0xb06ae8, emissiveIntensity: 0.8 }), k2 = mat(0x9ff0ff, 'glad', { emissive: 0x5fe3e8, emissiveIntensity: 0.8 });
      for (let i = 0; i < 6; i++) { const c = part(g, i % 2 ? k1 : k2, 0.14, 0.4 + (i % 3) * 0.14, 0.14, (i % 2 ? 0.14 : -0.14), 1.34, 0.52 - i * 0.22); c.rotation.set(0.3 - i * 0.1, 0.78, (i % 2 ? -0.4 : 0.4)); }
      for (const s of [-1, 1]) { const h = part(head, k1, 0.08, 0.36, 0.08, s * 0.18, 0.34, -0.06); h.rotation.set(0.4, 0.78, -s * 0.3); }
      const t = part(tip, k2, 0.22, 0.44, 0.22, 0, 0.08, -0.72); t.rotation.set(0.9, 0.78, 0);
      break;
    }
  }
  void body; void belly; void bone;
}

// babydraken hebben een grote kop en kleine vleugels
export function setDragonGrowth(root, growth) {
  const a = root.userData.a, t = Math.min(1, growth / 100);
  a.head.scale.setScalar(1.5 - 0.5 * t);
  for (const w of a.wings) w.scale.setScalar(0.5 + 0.5 * t);
}

// het poppetje van de speler heeft een echt skelet met gewrichten: zie rig.js
export function playerModel(look) { return buildRig(look); }

// Een vlinder: een dun lijfje met twee grote gekleurde vleugels aan elke kant.
const VLINDER_KLEUR = [[0xf08a20, 0x2a2014], [0x3a8ae8, 0xf4f4f0], [0xf4ce32, 0x2a2014], [0xf06ab0, 0xfff0a0], [0xf4f4f0, 0x8a4ad0], [0xe03a2a, 0x2a2014]];
function vlinder() {
  const root = base('vlinder'), g = root.userData.a.inner, a = root.userData.a;
  const [c1, c2] = VLINDER_KLEUR[Math.floor(Math.random() * VLINDER_KLEUR.length)];
  const lijf = mat(0x2a2014, 'glad'), vl = mat(c1, 'glad'), stip = mat(c2, 'glad');
  part(g, lijf, 0.06, 0.06, 0.34, 0, 0, 0);
  part(g, lijf, 0.02, 0.02, 0.14, 0.03, 0.04, 0.22); part(g, lijf, 0.02, 0.02, 0.14, -0.03, 0.04, 0.22);      // voelsprieten
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.03, 0.02, 0); g.add(piv); piv.userData.s = s; a.wings.push(piv);
    part(piv, vl, 0.3, 0.02, 0.26, s * 0.17, 0, 0.08);                 // voorvleugel
    part(piv, vl, 0.22, 0.02, 0.2, s * 0.13, 0, -0.14);                // achtervleugel
    part(piv, stip, 0.1, 0.025, 0.1, s * 0.2, 0, 0.08); part(piv, stip, 0.07, 0.025, 0.07, s * 0.14, 0, -0.14);
  }
  return root;
}

// ---------- zeedieren ----------

// Een haai met de neus naar +z: een grijs lijf met een witte buik, een rugvin, borstvinnen en
// een staart die heen en weer zwiept.
function haai() {
  const root = base('vis'), g = root.userData.a.inner, a = root.userData.a;
  const grijs = mat(0x6a7684, 'glad'), wit = mat(0xe8ecf0, 'glad'), zwart = mat(0x14161a, 'glad');
  g.position.y = 0.35;
  part(g, grijs, 0.7, 0.6, 1.5, 0, 0, 0);
  part(g, wit, 0.66, 0.2, 1.4, 0, -0.24, 0);
  part(g, grijs, 0.56, 0.46, 0.6, 0, 0.02, 0.95);                       // de kop
  part(g, grijs, 0.36, 0.3, 0.36, 0, 0.0, 1.36);                        // de snuit
  const kaak = new THREE.Group(); kaak.position.set(0, -0.16, 0.95); g.add(kaak); a.jaw = kaak;
  part(kaak, wit, 0.46, 0.1, 0.6, 0, -0.04, 0.2);
  for (let i = -2; i <= 2; i++) part(kaak, mat(0xffffff, 'glad'), 0.05, 0.08, 0.05, i * 0.09, 0.04, 0.44);      // tanden
  for (const s of [-1, 1]) { part(g, zwart, 0.06, 0.08, 0.08, s * 0.29, 0.1, 1.05); const v = part(g, grijs, 0.6, 0.06, 0.4, s * 0.55, -0.16, 0.3); v.rotation.z = -s * 0.4; }
  const rug = part(g, grijs, 0.08, 0.5, 0.5, 0, 0.5, -0.05); rug.rotation.x = -0.4;
  const staart = new THREE.Group(); staart.position.set(0, 0, -0.75); g.add(staart); a.tail.push(staart);
  part(staart, grijs, 0.4, 0.4, 0.7, 0, 0, -0.35);
  const s1 = part(staart, grijs, 0.07, 0.7, 0.3, 0, 0.3, -0.8); s1.rotation.x = 0.5;
  const s2 = part(staart, grijs, 0.07, 0.45, 0.26, 0, -0.2, -0.76); s2.rotation.x = -0.5;
  return root;
}

// Een kwal: een doorschijnend roze hoedje met slierten eronder.
function kwal() {
  const root = base('kwal'), g = root.userData.a.inner, a = root.userData.a;
  const roze = mat(0xf0a0d0, 'glad', { transparent: true, opacity: 0.75 }), licht = glowMat(0xffd0f0);
  g.position.y = 0.5;
  part(g, roze, 0.7, 0.3, 0.7, 0, 0.1, 0); part(g, roze, 0.5, 0.2, 0.5, 0, 0.32, 0);
  part(g, licht, 0.3, 0.1, 0.3, 0, 0.12, 0);
  for (let i = 0; i < 6; i++) {
    const an = i / 6 * Math.PI * 2, t = new THREE.Group();
    t.position.set(Math.cos(an) * 0.22, -0.05, Math.sin(an) * 0.22); g.add(t); a.tail.push(t);
    part(t, roze, 0.06, 0.5, 0.06, 0, -0.25, 0);
  }
  return root;
}

// ---------- mensen: dorpelingen, de koning en ridders ----------

// Kleren per beroep: [hemd, broek, hoed, schort]. hoed: zie hieronder.
const OUTFIT = {
  bakker: [0xf2f0ea, 0x8a7a66, 'muts', 0xffffff],
  kok: [0xf6f6f6, 0x3a3a44, 'koksmuts', 0],
  smid: [0x4a4a52, 0x3a3028, 'kaal', 0x6a4426],
  winkelier: [0x3f8a4a, 0x5a4a3a, 'haar', 0x8a5a30],
  boer: [0x3a6ab8, 0x3a6ab8, 'strohoed', 0],
  houthakker: [0xb8322a, 0x4a3a2a, 'pet', 0],
  juwelier: [0x7a3aa8, 0x2a2a34, 'hoge hoed', 0],
  mijnwerker: [0x7a7a80, 0x4a4a50, 'helm', 0],
  marktkoopman: [0xe08a2a, 0x5a4a3a, 'pet', 0xf2f0ea],
  drakenhandelaar: [0x4a2a6a, 0x2a1a3a, 'kap', 0],
  stationschef: [0x24345e, 0x24345e, 'chefpet', 0],
  koning: [0xb81e2e, 0x7a1420, 'kroon', 0],
};
const SHIRTS = [0x2f7fd0, 0xd0362f, 0x3fa34a, 0xe8b02a, 0x8a4ad0, 0xe86aa8, 0x40b0b0, 0xc87a3a];
const HAIRS = [0x5a3a1c, 0x2a1c12, 0xd8b050, 0xb8502a, 0x8a8a8a, 0x1a1a1e];
const SKINS = [0xe8b890, 0xf2cca8, 0xc68a5a, 0x8a5a3a, 0xe0a878];

export function mens(job, v = 0) {
  const root = base('biped'), g = root.userData.a.inner, a = root.userData.a;
  const O = OUTFIT[job] || [SHIRTS[v % SHIRTS.length], [0x3a4a7a, 0x5a4a3a, 0x3a3a44][v % 3], v % 4 === 1 ? 'staart' : 'haar', 0];
  const skinC = SKINS[(v >> 3) % SKINS.length], hairC = HAIRS[(v >> 5) % HAIRS.length];
  const sk = mat(skinC, 'glad'), shirt = mat(O[0], 'glad'), pants = mat(O[1], 'glad'), hair = mat(hairC, 'vacht');
  const rok = !OUTFIT[job] && v % 4 === 1 || job === 'koning' || job === 'drakenhandelaar';
  a.legs = [limb(g, pants, 0.24, 0.75, 0.24, -0.13, 0.75, 0), limb(g, pants, 0.24, 0.75, 0.24, 0.13, 0.75, 0)];
  part(g, shirt, 0.52, 0.7, 0.28, 0, 1.1, 0);
  if (rok) part(g, shirt, 0.6, 0.62, 0.36, 0, 0.5, 0);                                  // een jurk of mantel tot op de grond
  if (O[3]) part(g, mat(O[3], 'glad'), 0.4, 0.8, 0.04, 0, 0.92, 0.17);                 // schort
  a.arms = [limb(g, shirt, 0.2, 0.56, 0.2, -0.37, 1.43, 0), limb(g, shirt, 0.2, 0.56, 0.2, 0.37, 1.43, 0)];
  part(a.arms[0], sk, 0.17, 0.17, 0.17, 0, -0.64, 0); part(a.arms[1], sk, 0.17, 0.17, 0.17, 0, -0.64, 0);
  const head = new THREE.Group(); head.position.set(0, 1.68, 0); g.add(head); a.head = head;
  part(head, faceMats(skinC, 'glad', '#201810', false, true), 0.44, 0.44, 0.44, 0, 0, 0);
  const hat = O[2];
  const haar = () => { part(head, hair, 0.48, 0.14, 0.48, 0, 0.24, 0); part(head, hair, 0.48, 0.3, 0.1, 0, 0.06, -0.2); };
  if (hat === 'haar') haar();
  else if (hat === 'staart') { haar(); part(head, hair, 0.16, 0.5, 0.14, 0, -0.2, -0.28); }
  else if (hat === 'muts') { haar(); part(head, mat(0xffffff, 'glad'), 0.5, 0.16, 0.5, 0, 0.36, 0); }
  else if (hat === 'koksmuts') { part(head, mat(0xffffff, 'glad'), 0.46, 0.12, 0.46, 0, 0.28, 0); part(head, mat(0xffffff, 'glad'), 0.54, 0.4, 0.54, 0, 0.52, 0); part(g, mat(0xd0362f, 'glad'), 0.3, 0.1, 0.3, 0, 1.44, 0.02); }
  else if (hat === 'strohoed') { part(head, mat(0xe8c860, 'vacht'), 0.84, 0.05, 0.84, 0, 0.24, 0); part(head, mat(0xe8c860, 'vacht'), 0.46, 0.18, 0.46, 0, 0.34, 0); }
  else if (hat === 'pet') { haar(); part(head, mat(0x4a5a3a, 'glad'), 0.5, 0.12, 0.5, 0, 0.3, 0); part(head, mat(0x4a5a3a, 'glad'), 0.4, 0.04, 0.2, 0, 0.26, 0.32); }
  else if (hat === 'hoge hoed') { part(head, mat(0x1a1a1e, 'glad'), 0.66, 0.05, 0.66, 0, 0.24, 0); part(head, mat(0x1a1a1e, 'glad'), 0.4, 0.4, 0.4, 0, 0.46, 0); part(head, glowMat(0x5fe3e8), 0.12, 0.12, 0.03, 0.1, 0.02, 0.23); }
  else if (hat === 'helm') { part(head, mat(0xe8b02a, 'metaal'), 0.52, 0.2, 0.52, 0, 0.28, 0); part(head, glowMat(0xfff6c0), 0.12, 0.1, 0.06, 0, 0.3, 0.27); }
  else if (hat === 'kap') { part(head, shirt, 0.54, 0.3, 0.54, 0, 0.22, -0.02); part(head, shirt, 0.54, 0.5, 0.12, 0, -0.04, -0.24); part(head, shirt, 0.08, 0.4, 0.5, -0.25, 0, 0); part(head, shirt, 0.08, 0.4, 0.5, 0.25, 0, 0); part(g, glowMat(0xb46bff), 0.12, 0.12, 0.05, 0, 1.2, 0.16); }
  else if (hat === 'chefpet') { haar(); part(head, mat(0xc8262c, 'glad'), 0.5, 0.16, 0.5, 0, 0.32, 0); part(head, mat(0xe8c040, 'glad'), 0.51, 0.05, 0.51, 0, 0.26, 0); part(head, mat(0x1a1a1e, 'glad'), 0.4, 0.04, 0.18, 0, 0.24, 0.32); }
  else if (hat === 'kroon') {
    part(head, mat(0xe8e8e8, 'vacht'), 0.48, 0.14, 0.48, 0, 0.24, 0); part(head, mat(0xe8e8e8, 'vacht'), 0.3, 0.2, 0.08, 0, -0.26, 0.2);      // grijs haar en een baard
    part(head, glowMat(0xffd23a), 0.5, 0.1, 0.5, 0, 0.36, 0);
    for (let i = 0; i < 5; i++) part(head, glowMat(0xffd23a), 0.07, 0.16, 0.07, -0.2 + i * 0.1, 0.48, 0.2);
    part(head, glowMat(0xff3a5a), 0.08, 0.08, 0.04, 0, 0.36, 0.26);
    part(g, mat(0xf4f4f0, 'vacht'), 0.64, 0.14, 0.4, 0, 1.4, 0); part(g, mat(0xf4f4f0, 'vacht'), 0.64, 0.1, 0.4, 0, 0.22, 0);                 // hermelijn
  }
  if (job === 'houthakker') part(head, hair, 0.34, 0.2, 0.08, 0, -0.22, 0.2);          // baard
  return root;
}

function ridder(evil) {
  const root = base('biped'), g = root.userData.a.inner, a = root.userData.a;
  const steel = mat(evil ? 0x5a5a66 : 0xb8c4d8, 'metaal'), dark = mat(evil ? 0x2a2a34 : 0x6a7486, 'metaal');
  a.legs = [limb(g, dark, 0.26, 0.78, 0.26, -0.14, 0.78, 0), limb(g, dark, 0.26, 0.78, 0.26, 0.14, 0.78, 0)];
  part(g, steel, 0.6, 0.72, 0.34, 0, 1.14, 0);
  part(g, mat(evil ? 0x7a1420 : 0x2f5fd0, 'glad'), 0.34, 0.5, 0.03, 0, 1.12, 0.18);      // wapenkleed
  a.arms = [limb(g, steel, 0.22, 0.6, 0.22, -0.42, 1.46, 0), limb(g, steel, 0.22, 0.6, 0.22, 0.42, 1.46, 0)];
  part(g, steel, 0.3, 0.16, 0.34, -0.42, 1.5, 0); part(g, steel, 0.3, 0.16, 0.34, 0.42, 1.5, 0);
  // schild links, zwaard rechts
  part(a.arms[0], mat(evil ? 0x3a2a2a : 0x2f5fd0, 'glad'), 0.06, 0.56, 0.44, -0.14, -0.4, 0.06);
  part(a.arms[0], glowMat(evil ? 0x9a9a9a : 0xffd23a), 0.03, 0.2, 0.16, -0.18, -0.38, 0.06);
  const sw = part(a.arms[1], mat(0xdfe6f0, 'metaal'), 0.06, 0.06, 0.9, 0, -0.56, 0.42);
  part(a.arms[1], mat(0x8a5a30, 'glad'), 0.24, 0.06, 0.06, 0, -0.56, 0.02); void sw;
  const head = new THREE.Group(); head.position.set(0, 1.72, 0); g.add(head); a.head = head;
  part(head, steel, 0.46, 0.46, 0.46, 0, 0, 0);
  part(head, mat(0x101014, 'glad'), 0.34, 0.07, 0.03, 0, 0.04, 0.23);                   // kijkspleet
  part(head, dark, 0.05, 0.3, 0.03, 0, -0.06, 0.235);
  part(head, mat(evil ? 0x7a1420 : 0x2f5fd0, 'vacht'), 0.08, 0.3, 0.4, 0, 0.36, -0.06);  // pluim
  return root;
}

// Een skelet. soort: '' (boogschutter), 'ridder' (helm en zwaard) of 'koning' (kroon en mantel).
function skelet(soort) {
  const root = base('biped'), g = root.userData.a.inner, a = root.userData.a;
  const bone = mat(0xe8e2cc, 'glad'), dark = mat(0x26222a, 'glad');
  a.legs = [limb(g, bone, 0.12, 0.78, 0.12, -0.13, 0.78, 0), limb(g, bone, 0.12, 0.78, 0.12, 0.13, 0.78, 0)];
  part(g, bone, 0.36, 0.1, 0.2, 0, 0.82, 0);                                              // bekken
  part(g, bone, 0.1, 0.62, 0.1, 0, 1.14, -0.04);                                          // ruggengraat
  for (let i = 0; i < 4; i++) part(g, bone, 0.46 - i * 0.03, 0.06, 0.26, 0, 1.42 - i * 0.13, 0);      // ribben
  a.arms = [limb(g, bone, 0.1, 0.62, 0.1, -0.32, 1.46, 0), limb(g, bone, 0.1, 0.62, 0.1, 0.32, 1.46, 0)];
  const head = new THREE.Group(); head.position.set(0, 1.7, 0); g.add(head); a.head = head;
  part(head, bone, 0.4, 0.38, 0.4, 0, 0.02, 0);
  part(head, bone, 0.3, 0.12, 0.3, 0, -0.2, 0.03);                                        // kaak
  const eye = glowMat(soort === 'koning' ? 0x5aff8a : (soort ? 0xff3020 : 0x101010));
  for (const s of [-1, 1]) { part(head, dark, 0.12, 0.12, 0.03, s * 0.1, 0.04, 0.2); part(head, eye, 0.06, 0.06, 0.03, s * 0.1, 0.04, 0.21); }
  part(head, dark, 0.05, 0.07, 0.03, 0, -0.07, 0.2);
  for (let i = 0; i < 4; i++) part(head, dark, 0.02, 0.07, 0.03, -0.09 + i * 0.06, -0.19, 0.18);
  if (soort === 'ridder' || soort === 'koning') {
    part(a.arms[1], mat(soort === 'koning' ? 0xffe680 : 0x9a9aa6, 'metaal'), 0.06, 0.06, 0.95, 0, -0.56, 0.44);
    part(a.arms[1], mat(0x5a3a1c, 'glad'), 0.24, 0.06, 0.06, 0, -0.56, 0.02);
    part(g, mat(0x5a5a66, 'metaal'), 0.5, 0.3, 0.3, 0, 1.36, 0);                           // roestig borststuk
  } else {
    // een boog in de linkerhand
    const b1 = part(a.arms[0], mat(0x6a4a2c, 'glad'), 0.05, 0.5, 0.05, 0, -0.5, 0.2); b1.rotation.x = 0.5;
    const b2 = part(a.arms[0], mat(0x6a4a2c, 'glad'), 0.05, 0.5, 0.05, 0, -0.5, -0.02); b2.rotation.x = -0.5; b2.position.z = 0.2; b2.position.y = -0.86;
  }
  if (soort === 'ridder') { part(head, mat(0x5a5a66, 'metaal'), 0.46, 0.2, 0.46, 0, 0.2, 0); part(head, mat(0x5a5a66, 'metaal'), 0.06, 0.2, 0.06, 0, 0.0, 0.22); }
  if (soort === 'koning') {
    part(head, glowMat(0xcfd6e6), 0.46, 0.1, 0.46, 0, 0.26, 0);
    for (let i = 0; i < 5; i++) part(head, glowMat(0xcfd6e6), 0.07, 0.2, 0.07, -0.18 + i * 0.09, 0.4, 0.18);
    part(head, glowMat(0x5aff8a), 0.08, 0.08, 0.04, 0, 0.27, 0.24);
    part(g, mat(0x4a1a5a, 'glad'), 0.66, 1.2, 0.06, 0, 0.9, -0.2);                         // gescheurde mantel
    part(g, mat(0x4a1a5a, 'glad'), 0.7, 0.14, 0.36, 0, 1.52, -0.04);
  }
  return root;
}

function trol(tint) {
  const root = base('biped'), g = root.userData.a.inner, a = root.userData.a;
  const c = tint || 0x5a8a4a;
  const huid = mat(c, 'vacht'), donker = mat(c, 'vacht', { color: 0xaaaaaa });
  a.legs = [limb(g, donker, 0.34, 0.74, 0.36, -0.22, 0.74, 0), limb(g, donker, 0.34, 0.74, 0.36, 0.22, 0.74, 0)];
  part(g, huid, 0.9, 0.86, 0.56, 0, 1.2, 0);
  part(g, mat(0x6a4a2c, 'vacht'), 0.94, 0.3, 0.6, 0, 0.82, 0);                             // lendendoek
  part(g, huid, 0.6, 0.3, 0.44, 0, 1.56, -0.2);                                           // bochel
  const head = new THREE.Group(); head.position.set(0, 1.84, 0.1); g.add(head); a.head = head;
  part(head, faceMats(c, 'vacht', '#ffd040', true, false), 0.52, 0.44, 0.48, 0, 0, 0);
  part(head, huid, 0.2, 0.16, 0.14, 0, -0.06, 0.28);                                       // neus
  for (const s of [-1, 1]) {
    const oor = part(head, huid, 0.26, 0.12, 0.06, s * 0.36, 0.06, -0.04); oor.rotation.z = s * 0.4;
    part(head, mat(0xf2ead0, 'glad'), 0.06, 0.16, 0.06, s * 0.14, -0.16, 0.24);            // slagtanden
  }
  a.arms = [limb(g, huid, 0.3, 1.0, 0.32, -0.6, 1.6, 0), limb(g, huid, 0.3, 1.0, 0.32, 0.6, 1.6, 0)];
  // een knots met spijkers
  part(a.arms[1], mat(0x6a4a2c, 'glad'), 0.1, 0.1, 0.9, 0, -0.94, 0.36);
  part(a.arms[1], mat(0x8a6238, 'vacht'), 0.26, 0.26, 0.46, 0, -0.94, 0.8);
  for (const [x, y] of [[0.14, 0], [-0.14, 0], [0, 0.14], [0, -0.14]]) part(a.arms[1], mat(0xd8d8de, 'metaal'), 0.07, 0.07, 0.07, x, -0.94 + y, 0.84);
  return root;
}

// Boomwachter (groen, met lichtgevende blaadjes) of doornwachter (dor en donker, met doorns).
function boomwachter(tint, friendly) {
  const root = base('biped'), g = root.userData.a.inner, a = root.userData.a;
  const bast = mat(friendly ? 0x7a5a38 : 0x3a302c, 'rots'), blad = friendly ? mat(0x5ac83a, 'vacht', { emissive: 0x3aa02a, emissiveIntensity: 0.5 }) : mat(0x3a2a34, 'vacht');
  const licht = glowMat(friendly ? 0x9dff7a : 0xff3a8a);
  a.legs = [limb(g, bast, 0.34, 0.9, 0.34, -0.24, 0.9, 0), limb(g, bast, 0.34, 0.9, 0.34, 0.24, 0.9, 0)];
  part(g, bast, 0.84, 0.9, 0.52, 0, 1.36, 0);
  part(g, licht, 0.2, 0.26, 0.04, 0, 1.4, 0.27);                                           // het hart gloeit door de bast
  const head = new THREE.Group(); head.position.set(0, 2.02, 0.04); g.add(head); a.head = head;
  part(head, bast, 0.5, 0.42, 0.46, 0, 0, 0);
  for (const s of [-1, 1]) part(head, licht, 0.1, 0.08, 0.03, s * 0.12, 0.02, 0.24);
  // een kruin van bladeren (of kale takken met doorns)
  if (friendly) { part(head, blad, 0.8, 0.36, 0.76, 0, 0.36, 0); part(head, blad, 0.5, 0.26, 0.5, 0, 0.64, 0); part(g, blad, 0.4, 0.2, 0.4, -0.5, 1.9, 0); part(g, blad, 0.4, 0.2, 0.4, 0.5, 1.9, 0); }
  else for (let i = 0; i < 5; i++) { const t = part(head, bast, 0.07, 0.5, 0.07, -0.2 + i * 0.1, 0.4, (i % 2) * 0.16 - 0.08); t.rotation.z = (i - 2) * 0.3; part(head, licht, 0.05, 0.1, 0.05, -0.26 + i * 0.13, 0.66, (i % 2) * 0.16 - 0.08); }
  a.arms = [limb(g, bast, 0.26, 1.1, 0.28, -0.56, 1.76, 0), limb(g, bast, 0.26, 1.1, 0.28, 0.56, 1.76, 0)];
  for (const arm of a.arms) { for (let i = 0; i < 3; i++) { const t = part(arm, bast, 0.06, 0.26, 0.06, -0.1 + i * 0.1, -1.2, 0); t.rotation.z = (i - 1) * 0.4; } }
  void tint;
  return root;
}

// ---------- kuddedieren ----------

function schaap(wol) {
  const root = base('quad'), g = root.userData.a.inner, a = root.userData.a;
  const vacht = mat(wol, 'vacht'), kop = mat(0x3a332e, 'vacht');
  part(g, vacht, 0.74, 0.62, 1.04, 0, 0.72, 0);
  part(g, vacht, 0.6, 0.2, 0.8, 0, 1.06, -0.02);                                            // extra bol wol op de rug
  const head = new THREE.Group(); head.position.set(0, 0.86, 0.62); g.add(head); a.head = head;
  part(head, faceMats(0x3a332e, 'vacht', '#101010', false, false), 0.34, 0.34, 0.36, 0, 0, 0.04);
  part(head, vacht, 0.4, 0.16, 0.26, 0, 0.2, -0.06);
  for (const s of [-1, 1]) { const o = part(head, kop, 0.18, 0.08, 0.1, s * 0.24, 0.04, -0.06); o.rotation.z = -s * 0.5; }
  for (const [x, z] of [[-0.22, 0.36], [0.22, 0.36], [-0.22, -0.36], [0.22, -0.36]]) a.legs.push(limb(g, kop, 0.14, 0.44, 0.14, x, 0.44, z));
  const tail = limb(g, vacht, 0.14, 0.18, 0.12, 0, 0.84, -0.56); a.tail.push(tail);
  return root;
}

function koe() {
  const root = base('quad'), g = root.userData.a.inner, a = root.userData.a;
  const wit = mat(0xf2f0ea, 'vacht'), zwart = mat(0x2a2622, 'vacht'), roze = mat(0xf0a8b0, 'glad');
  part(g, wit, 0.78, 0.74, 1.36, 0, 1.0, 0);
  // zwarte vlekken
  part(g, zwart, 0.8, 0.4, 0.44, 0, 1.12, 0.36); part(g, zwart, 0.8, 0.5, 0.36, 0, 0.94, -0.36); part(g, zwart, 0.5, 0.06, 0.5, 0.1, 1.38, -0.04);
  part(g, roze, 0.3, 0.16, 0.34, 0, 0.58, -0.3);                                             // uier
  const head = new THREE.Group(); head.position.set(0, 1.22, 0.8); g.add(head); a.head = head;
  part(head, faceMats(0xf2f0ea, 'vacht', '#101010', false, false), 0.44, 0.42, 0.46, 0, 0, 0.06);
  part(head, roze, 0.36, 0.2, 0.16, 0, -0.1, 0.34);
  for (const s of [-1, 1]) {
    part(head, zwart, 0.18, 0.2, 0.3, s * 0.14, 0.12, 0.0);
    const o = part(head, zwart, 0.2, 0.1, 0.1, s * 0.3, 0.1, -0.1); o.rotation.z = -s * 0.3;
    const h = part(head, mat(0xe8dcc0, 'glad'), 0.06, 0.2, 0.06, s * 0.2, 0.3, -0.08); h.rotation.z = -s * 0.5;
  }
  for (const [x, z] of [[-0.26, 0.5], [0.26, 0.5], [-0.26, -0.5], [0.26, -0.5]]) a.legs.push(limb(g, x < 0 === z < 0 ? zwart : wit, 0.18, 0.64, 0.18, x, 0.64, z));
  const tail = limb(g, wit, 0.07, 0.6, 0.07, 0, 1.3, -0.7); tail.rotation.x = -0.25; a.tail.push(tail);
  part(tail, zwart, 0.1, 0.14, 0.1, 0, -0.62, 0);
  return root;
}

function beer(kleur) {
  const root = base('quad'), g = root.userData.a.inner, a = root.userData.a;
  const vacht = mat(kleur, 'vacht'), licht = mat(kleur, 'vacht', { color: 0xffe8d0 });
  part(g, vacht, 0.96, 0.84, 1.5, 0, 0.98, 0);
  part(g, vacht, 0.8, 0.3, 0.7, 0, 1.44, 0.3);                                               // schoft
  const head = new THREE.Group(); head.position.set(0, 1.14, 0.9); g.add(head); a.head = head;
  part(head, faceMats(kleur, 'vacht', '#101010', false, false), 0.56, 0.5, 0.48, 0, 0, 0.06);
  part(head, licht, 0.3, 0.24, 0.26, 0, -0.1, 0.4);
  part(head, mat(0x1a1410, 'glad'), 0.12, 0.08, 0.06, 0, -0.03, 0.54);
  for (const s of [-1, 1]) part(head, vacht, 0.16, 0.16, 0.08, s * 0.22, 0.3, -0.04);
  for (const [x, z] of [[-0.32, 0.5], [0.32, 0.5], [-0.32, -0.5], [0.32, -0.5]]) a.legs.push(limb(g, vacht, 0.28, 0.6, 0.3, x, 0.6, z));
  const tail = limb(g, vacht, 0.14, 0.14, 0.12, 0, 1.2, -0.78); a.tail.push(tail);
  return root;
}

function reuzenspin() {
  const root = base('spin'), g = root.userData.a.inner, a = root.userData.a;
  const lijf = mat(0x2a2220, 'vacht'), poot = mat(0x4a3a30, 'vacht');
  part(g, lijf, 0.56, 0.36, 0.5, 0, 0.5, 0.16);                                              // kopborststuk
  part(g, lijf, 0.8, 0.56, 0.86, 0, 0.6, -0.5);                                              // achterlijf
  part(g, glowMat(0xd0362f), 0.3, 0.05, 0.36, 0, 0.89, -0.5);                                // rode zandloper
  for (const [x, y, s] of [[-0.16, 0.6, 0.1], [0.16, 0.6, 0.1], [-0.07, 0.52, 0.07], [0.07, 0.52, 0.07], [-0.24, 0.52, 0.06], [0.24, 0.52, 0.06]]) part(g, glowMat(0xff3020), s, s, 0.04, x, y, 0.42);
  for (const s of [-1, 1]) part(g, mat(0xe8dcc0, 'glad'), 0.06, 0.16, 0.06, s * 0.1, 0.34, 0.42);      // gifkaken
  for (const s of [-1, 1]) for (const z of [-0.2, 0.0, 0.2, 0.38]) {
    const l = limb(g, poot, 0.07, 0.9, 0.07, s * 0.28, 0.6, z);
    l.rotation.z = s * 1.05;
    l.userData.rz = s * 1.05; l.userData.ph = (z + 0.3) * 3.7 + (s > 0 ? Math.PI : 0);
    const onder = part(l, poot, 0.06, 0.6, 0.06, s * -0.2, -1.1, 0); onder.rotation.z = s * -0.9;
    a.legs.push(l);
  }
  return root;
}

// ---------- de trein ----------

const WIEL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
function wielen(g, m, r, y, list, a) {
  for (const [x, z] of list) {
    const w = new THREE.Mesh(WIEL, m);
    w.rotation.z = Math.PI / 2; w.scale.set(r * 2, 0.12, r * 2); w.position.set(x, y, z);
    g.add(w); if (a) a.wheels.push(w);
  }
}
function trein() {
  const root = base('trein'), g = root.userData.a.inner, a = root.userData.a;
  a.wheels = [];
  const zwart = mat(0x2a2e36, 'metaal'), rood = mat(0xc8362c, 'glad'), goud = mat(0xe0a03a, 'metaal'), staal = mat(0x9aa6b2, 'metaal');
  part(g, goud, 1.2, 0.14, 2.3, 0, 0.42, 0);                                                 // onderstel
  // de ketel: een liggende cilinder
  const ketel = new THREE.Mesh(WIEL, zwart); ketel.rotation.x = Math.PI / 2; ketel.scale.set(0.94, 1.36, 0.94); ketel.position.set(0, 0.96, 0.42); g.add(ketel);
  for (const z of [-0.1, 0.5, 1.0]) { const b = new THREE.Mesh(WIEL, goud); b.rotation.x = Math.PI / 2; b.scale.set(0.98, 0.07, 0.98); b.position.set(0, 0.96, z); g.add(b); }
  const neus = new THREE.Mesh(WIEL, staal); neus.rotation.x = Math.PI / 2; neus.scale.set(0.7, 0.1, 0.7); neus.position.set(0, 0.96, 1.14); g.add(neus);
  part(g, glowMat(0xfff6c0), 0.2, 0.2, 0.06, 0, 1.0, 1.2);                                   // koplamp
  // schoorsteen en stoomdom
  const pijp = new THREE.Mesh(WIEL, zwart); pijp.scale.set(0.26, 0.5, 0.26); pijp.position.set(0, 1.62, 0.84); g.add(pijp);
  const rand = new THREE.Mesh(WIEL, goud); rand.scale.set(0.38, 0.1, 0.38); rand.position.set(0, 1.9, 0.84); g.add(rand);
  const dom = new THREE.Mesh(WIEL, goud); dom.scale.set(0.3, 0.26, 0.3); dom.position.set(0, 1.52, 0.3); g.add(dom);
  // het machinistenhuis, open aan de zijkanten zodat je erin kunt zitten
  part(g, rood, 1.2, 0.56, 0.08, 0, 0.78, -1.06); part(g, rood, 1.2, 0.56, 0.08, 0, 0.78, -0.28);
  part(g, rood, 0.08, 0.56, 0.86, -0.56, 0.78, -0.67); part(g, rood, 0.08, 0.56, 0.86, 0.56, 0.78, -0.67);
  for (const [x, z] of [[-0.56, -1.06], [0.56, -1.06], [-0.56, -0.28], [0.56, -0.28]]) part(g, rood, 0.08, 0.8, 0.08, x, 1.46, z);
  part(g, zwart, 1.36, 0.1, 1.06, 0, 1.9, -0.67);                                            // dak
  // baanschuiver vooraan
  const sch = part(g, staal, 1.1, 0.3, 0.08, 0, 0.3, 1.24); sch.rotation.x = -0.5;
  wielen(g, staal, 0.3, 0.3, [[-0.62, 0.7], [0.62, 0.7], [-0.62, -0.1]], a);
  wielen(g, staal, 0.3, 0.3, [[0.62, -0.1]], a);
  wielen(g, rood, 0.36, 0.36, [[-0.62, -0.84], [0.62, -0.84]], a);
  a.chimney = [0, 1.98, 0.84];
  return root;
}
// een wagon: een open bak met een afdakje
export function wagonModel(i) {
  const g = new THREE.Group();
  const kleur = [0x9a6a3c, 0x3f7a4a, 0x3a5a9a, 0xb89a3a][i % 4];
  const hout = mat(kleur, 'vacht'), goud = mat(0xe0a03a, 'metaal'), staal = mat(0x9aa6b2, 'metaal');
  part(g, goud, 1.2, 0.14, 1.9, 0, 0.42, 0);
  part(g, hout, 1.2, 0.5, 0.08, 0, 0.74, 0.9); part(g, hout, 1.2, 0.5, 0.08, 0, 0.74, -0.9);
  part(g, hout, 0.08, 0.5, 1.8, -0.56, 0.74, 0); part(g, hout, 0.08, 0.5, 1.8, 0.56, 0.74, 0);
  for (const [x, z] of [[-0.56, 0.9], [0.56, 0.9], [-0.56, -0.9], [0.56, -0.9]]) part(g, hout, 0.07, 0.7, 0.07, x, 1.34, z);
  part(g, mat(0x2a2e36, 'glad'), 1.3, 0.08, 2.0, 0, 1.72, 0);
  part(g, mat(0x6a4a2c, 'glad'), 0.16, 0.08, 0.3, 0, 0.42, 1.06);                             // koppeling
  wielen(g, staal, 0.3, 0.3, [[-0.62, 0.6], [0.62, 0.6], [-0.62, -0.6], [0.62, -0.6]], null);
  return g;
}

const BEER_COLOR = { groen: 0x6a4428, ijs: 0xf2f2ee, vuur: 0x3a2a26, schaduw: 0x3a2a4a, wolken: 0xe8d8c0 };
const SCHAAP_COLOR = { groen: 0xf2efe6, ijs: 0xf8fbff, vuur: 0x6a5a56, schaduw: 0x9a86c0, wolken: 0xffe6f2 };
const PLUIZEL_COLOR = { groen: 0xf2e2c4, ijs: 0xdff2ff, vuur: 0xffb080, schaduw: 0xc8a0f0, wolken: 0xffd0e4 };

// ---------- het Dierenrijk ----------
// Eén bouwer voor alle dieren uit een ei. S = de vorm uit shared/animals.js (lijf, poten, kop,
// oren, hoorns, vleugels...), shiny = '' of de shiny-soort: dan krijgt het dier andere kleuren
// en gloeit het een beetje.
function wingMat(color, extra) {
  const key = 'wing' + color + (extra ? JSON.stringify(extra) : '');
  if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial(Object.assign({ map: wingTex(color), side: THREE.DoubleSide, alphaTest: 0.5 }, extra || {})));
  return mats.get(key);
}
const RAINBOW = [0xff5a5a, 0xffa53a, 0xffe14a, 0x5ad86a, 0x4aa8ff, 0xb46bff];

export function dier(S, shiny) {
  const two = S.t === 'vogel';
  const root = base(two ? 'vogel' : 'quad'), a = root.userData.a, g = a.inner;
  const sh = shiny ? SHINY[shiny] : null;
  const kind = sh && shiny === 'diamond' ? 'glad' : (S.skin || 'vacht');
  const row = sh ? sh.row : (S.rainbow ? RAINBOW : null);       // regenboog: elk onderdeel een andere kleur
  let extra = sh ? { emissive: sh.e, emissiveIntensity: 0.6 } : undefined;
  if (S.ghost && !sh) extra = { transparent: true, opacity: 0.72, emissive: S.glow || 0x8090a0, emissiveIntensity: 0.5 };
  let ri = 0;
  // K(kleur van het dier) geeft de kleur die het onderdeel echt krijgt (bij een shiny de shiny-kleur)
  const K = (col, second) => (row ? row[ri++ % row.length] : sh ? (second ? sh.c2 : sh.c) : col);
  const M = (col, second) => mat(K(col, second), kind, extra);
  const c = S.c, c2 = S.c2 === undefined ? S.c : S.c2;
  const fur = M(c), bel = M(c2, true);
  const glow = S.glow || (sh ? sh.c2 : 0);
  const G = (col) => (glow ? glowMat(sh ? sh.c2 : col) : M(col, true));

  // lijf en buik
  const [bw, bh, bl] = S.body, lh = S.legH, lw = S.legW || Math.min(0.2, bw * 0.34);
  const by = lh + bh / 2;
  part(g, fur, bw, bh, bl, 0, by, 0);
  if (c2 !== c || sh) part(g, bel, bw * 0.86, bh * 0.3, bl * 0.88, 0, by - bh * 0.37, 0);
  if (S.hump) part(g, fur, bw * 0.7, bh * 0.5, bl * 0.4, 0, by + bh * 0.7, -0.05);
  if (S.shell) part(g, M(S.shellC || c2, true), bw * 1.12, bh * 0.8, bl * 0.96, 0, by + bh * 0.42, 0);
  if (S.stripes) for (let i = 0; i < 4; i++) part(g, M(S.stripes, true), bw + 0.02, bh + 0.02, bl * 0.07, 0, by, bl * 0.36 - i * bl * 0.24);
  if (S.spots) for (const [x, y, z] of [[1, 0.1, 0.3], [-1, -0.1, 0.05], [1, 0.05, -0.28], [-1, 0.14, -0.4]]) part(g, M(S.spots, true), 0.03, bh * 0.36, bl * 0.2, x * bw / 2, by + y * bh, z * bl);
  if (S.plates) for (let i = 0; i < 5; i++) part(g, M(S.plates, true), 0.07, 0.16 + (i === 2 ? 0.14 : i % 2 ? 0.08 : 0), bl * 0.14, 0, by + bh / 2 + 0.1, bl * 0.38 - i * bl * 0.19);
  if (S.spikes) for (let i = 0; i < 4; i++) part(g, G(c2), 0.07, 0.16, 0.09, 0, by + bh / 2 + 0.07, bl * 0.34 - i * bl * 0.22);

  // poten
  const legM = S.legC ? M(S.legC, true) : fur;
  const lx = Math.max(0.04, bw / 2 - lw / 2 - 0.01), lz = bl / 2 - lw / 2 - 0.04;
  if (two) for (const s of [-1, 1]) a.legs.push(limb(g, legM, lw, lh, lw, s * lx * 0.7, lh, 0));
  else for (const [x, z] of [[-lx, lz], [lx, lz], [-lx, -lz], [lx, -lz]]) a.legs.push(limb(g, legM, lw, lh, lw, x, lh, z));
  if (S.arms) for (const s of [-1, 1]) { const arm = part(g, fur, lw * 0.5, lh * 0.36, lw * 0.5, s * bw * 0.36, by - bh * 0.1, bl / 2 + 0.02); arm.rotation.x = -0.7; }
  if (S.claws) for (const s of [-1, 1]) part(g, fur, 0.2, 0.16, 0.26, s * (bw / 2 + 0.12), by, bl / 2 + 0.06);

  // nek en kop
  const nk = S.neck || 0, [hw, hh, hd] = S.head;
  const hy = by + bh * 0.28 + nk * 0.86, hz = bl / 2 + nk * 0.36 + (nk ? 0 : hd * 0.18);
  if (nk) { const n = part(g, S.neckC ? M(S.neckC, true) : fur, Math.min(0.34, bw * 0.5), nk + 0.24, Math.min(0.34, bw * 0.5), 0, by + bh * 0.3 + nk * 0.44, bl / 2 - 0.1 + nk * 0.18); n.rotation.x = 0.38; }
  const nH = S.heads || 1;
  for (let i = 0; i < nH; i++) {
    const head = new THREE.Group();
    head.position.set((i - (nH - 1) / 2) * hw * 1.02, hy - (i === (nH - 1) / 2 ? 0 : 0.05), hz);
    if (nH > 1) head.rotation.y = (i - (nH - 1) / 2) * 0.3;
    g.add(head);
    if (i === Math.floor(nH / 2)) a.head = head;
    const hc = K(S.headC === undefined ? c : S.headC);
    part(head, faceMats(hc, kind, S.eye || '#101010', !!glow, false, extra), hw, hh, hd, 0, 0, 0);
    if (S.snout) { const [sw, ss, sd] = S.snout; part(head, bel, sw, ss, sd, 0, -hh * 0.16, hd / 2 + sd / 2 - 0.02); }
    if (S.beak) part(head, mat(sh ? sh.c2 : S.beak, 'glad', extra), hw * 0.42, hh * 0.3, S.beakL || 0.16, 0, -hh * 0.1, hd / 2 + (S.beakL || 0.16) / 2 - 0.01);
    const earM = S.earC ? M(S.earC, true) : fur;
    if (S.ears === 'punt') for (const s of [-1, 1]) part(head, earM, hw * 0.26, hh * 0.42, 0.07, s * hw * 0.32, hh * 0.62, -hd * 0.2);
    else if (S.ears === 'rond') for (const s of [-1, 1]) part(head, earM, hw * 0.34, hh * 0.32, 0.1, s * hw * 0.42, hh * 0.52, -hd * 0.15);
    else if (S.ears === 'lang') for (const s of [-1, 1]) { const e = part(head, earM, hw * 0.24, hh * 1.1, 0.07, s * hw * 0.26, hh * 0.95, -hd * 0.2); e.rotation.z = -s * 0.12; }
    else if (S.ears === 'flap') for (const s of [-1, 1]) { const e = part(head, earM, 0.08, hh * 0.9, hd * 0.8, s * (hw / 2 + 0.04), 0, -hd * 0.3); e.rotation.y = s * 0.5; }
    const hornM = () => (glow || S.hornC ? glowMat(sh ? sh.c2 : (S.hornC || glow)) : mat(0xe8dcc0, 'glad'));
    if (S.horn === 'een') { const h = part(head, hornM(), 0.07, 0.46, 0.07, 0, hh / 2 + 0.2, hd * 0.2); h.rotation.x = 0.35; }
    else if (S.horn === 'twee') for (const s of [-1, 1]) { const h = part(head, hornM(), 0.07, 0.26, 0.07, s * hw * 0.24, hh / 2 + 0.12, -hd * 0.1); h.rotation.z = -s * 0.25; }
    else if (S.horn === 'gewei') for (const s of [-1, 1]) {
      const h = part(head, hornM(), 0.06, 0.44, 0.06, s * hw * 0.3, hh / 2 + 0.2, -hd * 0.1); h.rotation.z = -s * 0.4;
      const t = part(head, hornM(), 0.05, 0.22, 0.05, s * (hw * 0.3 + 0.16), hh / 2 + 0.34, -hd * 0.1); t.rotation.z = -s * 1.0;
      const u = part(head, hornM(), 0.05, 0.2, 0.05, s * (hw * 0.3 + 0.06), hh / 2 + 0.26, 0.04); u.rotation.x = 0.8;
    } else if (S.horn === 'drie') {
      part(head, M(c2, true), hw * 1.6, hh * 1.5, 0.1, 0, hh * 0.3, -hd / 2);                       // de kraag
      for (const s of [-1, 1]) { const h = part(head, hornM(), 0.08, 0.5, 0.08, s * hw * 0.3, hh * 0.5, hd * 0.3); h.rotation.x = 1.0; }
      const h = part(head, hornM(), 0.07, 0.22, 0.07, 0, hh * 0.1, hd / 2 + 0.2); h.rotation.x = 0.9;
    }
    if (S.crest) part(head, M(c2, true), 0.06, hh * 0.5, hd * 0.9, 0, hh * 0.5, -hd * 0.4);
    if (S.mane && S.t === 'quad' && !nk) part(head, M(S.mane, true), hw * 1.5, hh * 1.5, hd * 0.5, 0, 0, -hd * 0.4);      // manen van een leeuw
    if (S.trunk) { const t = limb(head, fur, hw * 0.24, hh * 1.1, hw * 0.24, 0, -hh * 0.1, hd / 2 + 0.04); t.rotation.x = -0.2; a.trunk = t; }
    if (S.tusks) for (const s of [-1, 1]) { const t = part(head, mat(0xf4f0e0, 'glad'), 0.06, 0.3, 0.06, s * hw * 0.3, -hh * 0.5, hd / 2); t.rotation.x = -0.4; }
  }
  if (S.mane && nk) { const m = part(g, M(S.mane, true), 0.1, nk + 0.3, 0.14, 0, by + bh * 0.42 + nk * 0.44, bl / 2 - 0.26 + nk * 0.18); m.rotation.x = 0.38; }      // manen van een paard

  // staart
  const nT = S.tails || 1;
  for (let i = 0; i < nT; i++) {
    const off = (i - (nT - 1) / 2);
    let t = null;
    if (S.tail === 'lang') { t = limb(g, fur, 0.07, Math.max(0.3, bl * 0.5), 0.07, 0, by + bh * 0.2, -bl / 2); t.rotation.x = 0.7; }
    else if (S.tail === 'pluim') {
      t = limb(g, S.mane ? M(S.mane, true) : fur, 0.14, Math.max(0.36, bl * 0.5), 0.14, 0, by + bh * 0.25, -bl / 2); t.rotation.x = nT > 1 ? 2.0 : 0.6;
      if (S.tipC) part(t, M(S.tipC, true), 0.16, 0.14, 0.16, 0, -Math.max(0.36, bl * 0.5) - 0.02, 0);
    } else if (S.tail === 'dik') {
      t = limb(g, fur, bw * 0.5, bl * 0.5, bh * 0.5, 0, by + bh * 0.1, -bl / 2 + 0.1); t.rotation.x = 1.35;
      part(t, fur, bw * 0.28, bl * 0.4, bh * 0.28, 0, -bl * 0.66, 0);
    } else if (S.tail === 'kort') part(g, bel, 0.14, 0.14, 0.12, 0, by + bh * 0.1, -bl / 2 - 0.04);
    else if (S.tail === 'veer' || S.tail === 'waaier') {
      const wide = S.tail === 'waaier';
      const f = new THREE.Mesh(PLANE, wingMat(K(S.wings > 1 ? S.wings : c2, true), extra));
      f.rotation.x = -Math.PI / 2 + (wide ? 0.9 : 0.15); f.rotation.z = Math.PI / 2;
      f.scale.set(wide ? 0.9 : 0.5, wide ? 1.1 : 0.4, 1); f.position.set(0, by + (wide ? 0.4 : 0.02), -bl / 2 - (wide ? 0.2 : 0.2));
      g.add(f);
    }
    if (t) { t.rotation.z = off * 0.5; a.tail.push(t); if (glow && (S.tail === 'pluim' || S.tail === 'lang')) part(t, G(c2), 0.1, 0.1, 0.1, 0, -Math.max(0.3, bl * 0.5), 0); }
  }

  // vleugels
  if (S.wings) {
    const wm = wingMat(K(S.wings > 1 ? S.wings : c, true), extra), span = S.wingSpan || (two ? 0.9 : bl * 1.1);
    for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(s * bw * 0.42, by + bh * 0.4, 0.04); g.add(piv);
      const w = new THREE.Mesh(PLANE, wm);
      w.rotation.x = -Math.PI / 2; w.scale.set(s * span, bl * 0.9, 1); w.position.set(s * span / 2, 0, -0.06);
      piv.add(w); a.wings.push(piv); piv.userData.s = s;
    }
  }
  return root;
}

// ---------- voertuigen ----------
// Elk voertuig is opgebouwd uit doosjes en wielen, met de neus naar +z. De wielen draaien mee
// als je rijdt (net als bij de trein); de helikopter heeft draaiende wieken.
function voertuig(kind, kleur) {
  const V = VEHICLES[kind], heli = V.soort === 'lucht' || V.soort === 'duik';
  const root = base(heli ? 'heli' : 'trein'), a = root.userData.a, g = a.inner;
  a.wheels = [];
  const [w, h, l] = V.size;
  const lak = mat(kleur === undefined || kleur === null ? V.kleur : kleur, 'glad'), donker = mat(0x23262c, 'metaal'), band = mat(0x1a1a1e, 'glad'), glas = mat(0x9fd8f0, 'glad'), licht = glowMat(0xfff2b0), rood = glowMat(0xff3a2a), staal = mat(0xb0b8c4, 'metaal');
  const wiel = (x, z, r, dik) => { const m = new THREE.Mesh(WIEL, band); m.rotation.z = Math.PI / 2; m.scale.set(r * 2, dik, r * 2); m.position.set(x, r, z); g.add(m); a.wheels.push(m); };
  const lampen = (y, z, x) => { for (const s of [-1, 1]) { part(g, licht, 0.2, 0.12, 0.05, s * x, y, z); part(g, rood, 0.2, 0.1, 0.05, s * x, y, -z); } };
  if (kind === 'auto' || kind === 'terreinwagen') {
    const r = kind === 'auto' ? 0.32 : 0.44, by = r + 0.28, bh = kind === 'auto' ? 0.46 : 0.6;
    for (const x of [-1, 1]) for (const z of [-1, 1]) wiel(x * (w / 2 - 0.08), z * l * 0.32, r, 0.24);
    part(g, lak, w, bh, l, 0, by, 0);
    part(g, donker, w * 0.98, 0.1, l * 1.02, 0, by - bh / 2, 0);                                  // bumpers
    part(g, lak, w * 0.92, h - by - bh / 2 + 0.02, l * (kind === 'auto' ? 0.5 : 0.62), 0, (h + by + bh / 2) / 2, -l * 0.06);
    part(g, glas, w * 0.94, (h - by - bh / 2) * 0.62, l * (kind === 'auto' ? 0.46 : 0.58), 0, (h + by + bh / 2) / 2 + 0.02, -l * 0.06);      // ramen rondom
    part(g, glas, w * 0.86, (h - by - bh / 2) * 0.62, 0.04, 0, (h + by + bh / 2) / 2 + 0.02, l * (kind === 'auto' ? 0.2 : 0.26));
    lampen(by + 0.05, l / 2 + 0.01, w * 0.32);
    if (kind === 'terreinwagen') { const sp = new THREE.Mesh(WIEL, band); sp.rotation.x = Math.PI / 2; sp.scale.set(0.8, 0.22, 0.8); sp.position.set(0, by + 0.25, -l / 2 - 0.1); g.add(sp); part(g, donker, w * 0.9, 0.08, 0.9, 0, h + 0.04, -l * 0.1); }
  } else if (kind === 'motor') {
    wiel(0, l * 0.36, 0.34, 0.16); wiel(0, -l * 0.36, 0.34, 0.16);
    part(g, lak, 0.3, 0.3, l * 0.6, 0, 0.62, 0);
    part(g, donker, 0.26, 0.14, l * 0.36, 0, 0.84, -l * 0.12);                                    // zadel
    const vork = part(g, staal, 0.08, 0.6, 0.08, 0, 0.72, l * 0.33); vork.rotation.x = -0.35;
    part(g, donker, 0.66, 0.06, 0.06, 0, 1.0, l * 0.24);                                          // stuur
    part(g, licht, 0.18, 0.16, 0.06, 0, 0.9, l * 0.42); part(g, rood, 0.14, 0.08, 0.05, 0, 0.74, -l * 0.44);
    part(g, staal, 0.1, 0.1, 0.5, 0.2, 0.4, -l * 0.2);                                            // uitlaat
  } else if (kind === 'quad') {
    for (const x of [-1, 1]) for (const z of [-1, 1]) wiel(x * (w / 2 - 0.06), z * l * 0.32, 0.34, 0.3);
    part(g, lak, w * 0.6, 0.34, l * 0.9, 0, 0.6, 0);
    part(g, donker, w * 0.44, 0.12, l * 0.42, 0, 0.82, -l * 0.14);
    part(g, donker, 0.76, 0.06, 0.06, 0, 0.98, l * 0.2);
    for (const s of [-1, 1]) part(g, lak, 0.3, 0.06, 0.5, s * (w / 2 - 0.08), 0.74, l * 0.32);      // spatborden
    part(g, licht, 0.3, 0.12, 0.05, 0, 0.72, l * 0.46); part(g, rood, 0.3, 0.08, 0.05, 0, 0.66, -l * 0.46);
  } else if (kind === 'vrachtwagen' || kind === 'bus') {
    const r = 0.46, by = r + 0.2;
    for (const x of [-1, 1]) for (const z of (kind === 'bus' ? [0.34, -0.3] : [0.36, -0.14, -0.36])) wiel(x * (w / 2 - 0.1), z * l, r, 0.3);
    part(g, donker, w * 0.9, 0.2, l * 0.98, 0, by, 0);                                             // onderstel
    if (kind === 'bus') {
      part(g, lak, w, h - by - 0.1, l, 0, (h + by + 0.1) / 2, 0);
      part(g, glas, w + 0.02, (h - by) * 0.34, l * 0.9, 0, by + (h - by) * 0.62, -0.02);              // ramen aan de zijkanten
      part(g, glas, w * 0.9, (h - by) * 0.44, 0.04, 0, by + (h - by) * 0.6, l / 2 + 0.01);
      part(g, mat(0xf4f4f0, 'glad'), w + 0.02, 0.12, l * 1.0, 0, by + 0.28, 0);                       // witte streep
    } else {
      part(g, lak, w, h * 0.62, l * 0.26, 0, by + 0.1 + h * 0.31, l * 0.37);                          // de cabine
      part(g, glas, w * 0.9, h * 0.24, 0.04, 0, by + h * 0.48, l / 2 + 0.01);
      for (const s of [-1, 1]) part(g, glas, 0.04, h * 0.22, l * 0.14, s * (w / 2 + 0.005), by + h * 0.48, l * 0.39);
      part(g, mat(0xd8dce4, 'metaal'), w, h - by - 0.1, l * 0.68, 0, (h + by + 0.1) / 2, -l * 0.14);    // de laadbak
      part(g, staal, 0.1, 0.5, 0.1, w * 0.4, h * 0.95, l * 0.22);                                    // uitlaat
    }
    lampen(by + 0.25, l / 2 + 0.01, w * 0.36);
  } else if (kind === 'botsauto') {
    // een lage ronde botsauto met een rubberen rand en een stroomstok
    for (const x of [-1, 1]) for (const z of [-1, 1]) wiel(x * (w / 2 - 0.12), z * l * 0.3, 0.16, 0.14);
    part(g, donker, w + 0.16, 0.22, l + 0.16, 0, 0.3, 0);
    part(g, lak, w, 0.42, l, 0, 0.52, 0);
    part(g, lak, w * 0.8, 0.3, 0.2, 0, 0.84, -l * 0.36);                                          // rugleuning
    part(g, donker, 0.4, 0.06, 0.06, 0, 0.9, l * 0.2);                                           // stuur
    part(g, staal, 0.05, 2.0, 0.05, 0, 1.7, -l * 0.44);
    part(g, licht, 0.14, 0.14, 0.14, 0, 2.72, -l * 0.44);
    part(g, licht, 0.5, 0.1, 0.05, 0, 0.5, l / 2 + 0.01);
  } else if (kind === 'boot') {
    part(g, lak, w, 0.5, l * 0.78, 0, 0.3, -l * 0.06);
    part(g, lak, w * 0.7, 0.5, l * 0.16, 0, 0.3, l * 0.38); part(g, lak, w * 0.36, 0.46, l * 0.1, 0, 0.32, l * 0.47);      // de punt
    part(g, mat(0x2a6ad0, 'glad'), w + 0.02, 0.12, l * 0.8, 0, 0.42, -l * 0.06);                      // blauwe streep
    part(g, mat(0x8a5a2c, 'vacht'), w * 0.84, 0.06, l * 0.7, 0, 0.56, -l * 0.08);                     // houten dek
    part(g, glas, w * 0.7, 0.34, 0.05, 0, 0.78, l * 0.12);                                          // voorruit
    part(g, donker, 0.34, 0.5, 0.3, 0, 0.5, -l * 0.5);                                              // buitenboordmotor
    part(g, donker, w * 0.5, 0.1, 0.36, 0, 0.64, -l * 0.26);                                        // bankje
  } else if (kind === 'tractor' || kind === 'zaaimachine' || kind === 'combine') {
    // landbouwmachines: grote achterwielen, kleine voorwielen, een motorkap en een cabine
    const groot = kind === 'combine';
    for (const x of [-1, 1]) { wiel(x * (w / 2 - 0.05), -l * 0.26, 0.62, 0.36); wiel(x * (w / 2 - 0.12), l * 0.32, 0.36, 0.26); }
    part(g, lak, w * 0.62, 0.7, l * 0.5, 0, 1.05, l * 0.22);                                        // de motorkap
    part(g, donker, w * 0.5, 0.16, l * 0.9, 0, 0.66, 0);
    part(g, lak, w * 0.86, groot ? 1.1 : 0.5, l * 0.42, 0, groot ? 1.25 : 0.95, -l * 0.24);
    for (const x of [-1, 1]) for (const z of [-0.42, -0.06]) part(g, donker, 0.08, 0.9, 0.08, x * w * 0.38, h - 0.5, z * l);      // de stijlen van de cabine
    part(g, lak, w * 0.9, 0.1, l * 0.44, 0, h, -l * 0.24);                                          // het dakje
    part(g, staal, 0.1, 0.7, 0.1, w * 0.2, 1.7, l * 0.36);                                          // de uitlaat
    lampen(1.1, l * 0.47, w * 0.2);
    if (kind === 'tractor') { part(g, staal, w * 1.5, 0.08, 0.1, 0, 0.3, -l * 0.56); for (let i = -2; i <= 2; i++) part(g, staal, 0.08, 0.4, 0.3, i * w * 0.34, 0.2, -l * 0.6); }      // de ploeg
    else if (kind === 'zaaimachine') { part(g, mat(0xf4f4f0, 'glad'), w * 1.5, 0.5, 0.6, 0, 0.75, -l * 0.6); for (let i = -2; i <= 2; i++) part(g, staal, 0.08, 0.5, 0.08, i * w * 0.34, 0.25, -l * 0.6); }
    else { part(g, mat(0xd8362c, 'glad'), w * 1.55, 0.5, 0.7, 0, 0.42, l * 0.62); part(g, staal, w * 1.5, 0.3, 0.3, 0, 0.5, l * 0.74); part(g, lak, 0.3, 0.3, 1.6, w * 0.5, h + 0.1, -l * 0.1); }      // de maaibalk en de pijp
  } else if (kind === 'tank') {
    // een tank: rupsbanden, een brede romp en een koepel met een loop
    for (const s of [-1, 1]) { part(g, donker, 0.4, 0.5, l * 0.98, s * (w / 2 - 0.2), 0.3, 0); for (const z of [-0.36, -0.12, 0.12, 0.36]) wiel(s * (w / 2 - 0.2), z * l, 0.26, 0.42); }
    part(g, lak, w * 0.86, 0.5, l * 0.9, 0, 0.75, 0);
    part(g, lak, w * 0.6, 0.42, l * 0.42, 0, 1.2, -l * 0.04);                                       // de koepel
    part(g, donker, 0.18, 0.18, l * 0.6, 0, 1.22, l * 0.4);                                         // de loop
    part(g, donker, 0.3, 0.1, 0.3, w * 0.12, 1.46, -l * 0.08);                                      // het luik
    part(g, licht, 0.16, 0.1, 0.05, w * 0.3, 0.8, l * 0.455); part(g, licht, 0.16, 0.1, 0.05, -w * 0.3, 0.8, l * 0.455);
  } else if (kind === 'onderzeeer') {
    // een gele onderzeeër: een lange romp, een toren met een periscoop, ramen en een schroef
    part(g, lak, w * 0.8, 1.1, l * 0.8, 0, 0.8, 0);
    part(g, lak, w * 0.6, 0.8, l * 0.14, 0, 0.8, l * 0.46); part(g, lak, w * 0.5, 0.7, l * 0.12, 0, 0.8, -l * 0.45);
    part(g, lak, w * 0.4, 0.5, l * 0.2, 0, 1.55, l * 0.02);                                         // de toren
    part(g, staal, 0.06, 0.5, 0.06, 0, 2.0, l * 0.04); part(g, staal, 0.06, 0.06, 0.2, 0, 2.22, l * 0.09);      // de periscoop
    for (const s of [-1, 1]) for (const z of [-0.2, 0.05, 0.3]) part(g, glas, 0.04, 0.3, 0.3, s * w * 0.405, 0.95, z * l);
    part(g, glas, w * 0.4, 0.4, 0.05, 0, 0.9, l * 0.535);
    for (const s of [-1, 1]) part(g, donker, 0.5, 0.06, 0.4, s * w * 0.55, 0.8, -l * 0.36);          // de roeren
    const prop = new THREE.Group(); prop.position.set(0, 0.8, -l * 0.53); g.add(prop); a.prop = prop;
    part(prop, donker, 0.9, 0.12, 0.05, 0, 0, 0); part(prop, donker, 0.12, 0.9, 0.05, 0, 0, 0);
  } else if (kind === 'vliegtuig') {
    // een klein propellervliegtuig
    part(g, lak, w * 0.5, 0.9, l * 0.8, 0, 1.0, 0);
    part(g, lak, w * 0.36, 0.6, l * 0.24, 0, 1.05, -l * 0.5);                                      // de staart
    part(g, glas, w * 0.46, 0.5, l * 0.24, 0, 1.55, l * 0.08);                                     // de cockpit
    part(g, lak, w * 3.4, 0.12, 1.1, 0, 1.3, l * 0.08);                                            // de vleugels
    part(g, mat(0xd8362c, 'glad'), w * 3.42, 0.13, 0.3, 0, 1.3, l * 0.2);                           // rode streep op de vleugel
    part(g, lak, w * 1.3, 0.1, 0.6, 0, 1.2, -l * 0.58);                                            // het staartvlak
    part(g, mat(0xd8362c, 'glad'), 0.1, 0.8, 0.6, 0, 1.6, -l * 0.58);                               // het kielvlak
    for (const s of [-1, 1]) { part(g, staal, 0.06, 0.6, 0.06, s * w * 0.4, 0.5, l * 0.1); const wl = new THREE.Mesh(WIEL, band); wl.rotation.z = Math.PI / 2; wl.scale.set(0.44, 0.16, 0.44); wl.position.set(s * w * 0.4, 0.22, l * 0.1); g.add(wl); }
    const wl = new THREE.Mesh(WIEL, band); wl.rotation.z = Math.PI / 2; wl.scale.set(0.3, 0.12, 0.3); wl.position.set(0, 0.15, -l * 0.5); g.add(wl);
    part(g, donker, 0.3, 0.3, 0.2, 0, 1.0, l * 0.42);
    const prop = new THREE.Group(); prop.position.set(0, 1.0, l * 0.46); g.add(prop); a.prop = prop;
    part(prop, donker, 1.7, 0.12, 0.04, 0, 0, 0); part(prop, donker, 0.12, 1.7, 0.04, 0, 0, 0);
    part(g, licht, 0.12, 0.1, 0.05, w * 1.68, 1.3, l * 0.2); part(g, rood, 0.12, 0.1, 0.05, -w * 1.68, 1.3, l * 0.2);
  } else {
    // helikopter
    part(g, lak, w * 0.8, 1.1, l * 0.5, 0, 0.95, l * 0.1);
    part(g, glas, w * 0.74, 0.7, 0.3, 0, 1.0, l * 0.34);
    for (const s of [-1, 1]) part(g, glas, 0.04, 0.5, l * 0.24, s * w * 0.405, 1.1, l * 0.14);
    const staart = part(g, lak, 0.26, 0.26, l * 0.5, 0, 1.2, -l * 0.36); void staart;
    part(g, lak, 0.08, 0.6, 0.4, 0, 1.5, -l * 0.58);
    for (const s of [-1, 1]) { part(g, staal, 0.08, 0.08, l * 0.5, s * w * 0.42, 0.1, l * 0.08); part(g, staal, 0.06, 0.34, 0.06, s * w * 0.42, 0.28, l * 0.22); part(g, staal, 0.06, 0.34, 0.06, s * w * 0.42, 0.28, -l * 0.04); }
    part(g, donker, 0.14, 0.3, 0.14, 0, 1.62, l * 0.1);
    const rotor = new THREE.Group(); rotor.position.set(0, 1.8, l * 0.1); g.add(rotor); a.rotor = rotor;
    part(rotor, donker, l * 1.2, 0.04, 0.22, 0, 0, 0); part(rotor, donker, 0.22, 0.04, l * 1.2, 0, 0, 0);
    const tr = new THREE.Group(); tr.position.set(0.1, 1.5, -l * 0.58); g.add(tr); a.tailRotor = tr;
    part(tr, donker, 0.03, 0.7, 0.1, 0, 0, 0);
    part(g, licht, 0.16, 0.1, 0.05, 0, 0.6, l * 0.36); part(g, rood, 0.1, 0.1, 0.05, 0, 1.2, -l * 0.62);
  }
  return root;
}

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
    case 'haai': m = haai(); break;
    case 'vlinder': m = vlinder(); break;
    case 'kwal': m = kwal(); break;
    case 'vleugel': m = vleugel(def.boss ? 0x3a4a8a : 0x6a86b0); break;
    case 'draak': m = draak(def.dragon || opts.dtype || 'vuur', opts.growth); break;
    case 'mens': m = mens(opts.job, opts.variant || 0); break;
    case 'ridder': m = ridder(false); break;
    case 'skelet': m = skelet(''); break;
    case 'skeletridder': m = skelet('ridder'); break;
    case 'skeletkoning': m = skelet('koning'); break;
    case 'trol': m = trol(def.tint); break;
    case 'boomwachter': m = boomwachter(def.tint, kind === 'boomwachter'); break;
    case 'schaap': m = schaap(SCHAAP_COLOR[opts.world] || SCHAAP_COLOR.groen); break;
    case 'koe': m = koe(); break;
    case 'beer': m = beer(BEER_COLOR[opts.world] || BEER_COLOR.groen); break;
    case 'grijzewolf': m = quad(opts.world === 'schaduw' ? 0x2a2434 : 0x7a7e88, 'vacht', '#ffd040', true, 0); break;
    case 'reuzenspin': m = reuzenspin(); break;
    case 'trein': m = trein(); break;
    case 'voertuig': m = voertuig(def.veh, opts.color); break;
    case 'attractie': m = buildRide(def.ride); break;
    case 'stad': m = buildCity(def.stad); break;
    case 'dier': m = dier(ANIMALS[def.animal].spec, opts.shiny || ''); break;
    default: m = pluizel(0xff00ff);
  }
  // iedereen op twee benen krijgt het skelet van de speler (zie rig.js); viervoeters krijgen knieën
  const t = m.userData.a.type;
  if (t === 'biped') rigify(m, model === 'mens' ? 'dorp' : model === 'ridder' ? 'ridder' : model === 'skelet' ? 'skelet' : 'zwaar');
  else if (t === 'quad' || t === 'vogel') kneeify(m);
  return m;
}

// Beweging van de modellen. speed = hoe snel het wezen beweegt, flags: 1 aanval, 2 vliegt, 4 blijft zitten
export function animate(root, time, speed, flags, dt) {
  const a = root.userData.a;
  if (a.type === 'speler') { a.atk = flags & 1; animateRig(a, time, speed, dt); return; }
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
      // de knie buigt als de poot naar voren zwaait
      for (let i = 0; i < a.legs.length; i++) { const low = a.legs[i].userData.low; if (low) low.rotation.x = moving ? 0.9 * Math.max(0, (i === 0 || i === 3 ? -1 : 1) * Math.cos(ph)) : 0; }
      if (a.head) a.head.rotation.x = atk ? -0.5 : Math.sin(time * 1.3 + root.id) * 0.06;
      if (a.tail[0]) a.tail[0].rotation.z = Math.sin(time * 4 + root.id) * 0.3;
      a.inner.position.z = atk ? 0.25 : 0;
      // dieren met vleugels (pegasus, griffioen): rustig wapperen, sneller als ze lopen
      for (const w of a.wings) w.rotation.z = w.userData.s * (0.5 + Math.sin(time * (moving ? 8 : 2.5) + root.id) * (moving ? 0.5 : 0.14));
      if (a.trunk) a.trunk.rotation.z = Math.sin(time * 1.6 + root.id) * 0.18;
      break;
    case 'vogel': {
      // twee poten: vogels en dino's die rechtop lopen
      a.legs[0].rotation.x = sw * 0.8; a.legs[1].rotation.x = -sw * 0.8;
      for (let i = 0; i < 2; i++) { const low = a.legs[i].userData.low; if (low) low.rotation.x = moving ? 0.9 * Math.max(0, (i ? 1 : -1) * Math.cos(ph)) : 0; }
      if (a.head) a.head.rotation.x = Math.sin(time * 1.5 + root.id) * 0.07 + (moving ? Math.sin(ph * 2) * 0.06 : 0);
      for (const w of a.wings) w.rotation.z = w.userData.s * (moving ? Math.sin(time * 11 + root.id) * 0.7 : -1.2 + Math.sin(time * 1.8 + root.id) * 0.04);      // stil: vleugels langs het lijf
      if (a.tail[0]) a.tail[0].rotation.z = Math.sin(time * 2 + root.id) * 0.12;
      a.inner.position.y = moving ? Math.abs(Math.sin(ph)) * 0.04 : 0;
      break;
    }
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
    case 'vlinder': {
      // snel klapperende vleugels, en het lijfje dobbert op en neer
      const f = 0.25 + Math.abs(Math.sin(time * 13 + root.id)) * 1.05;
      for (const w of a.wings) w.rotation.z = w.userData.s * f;
      a.inner.position.y = 0.2 + Math.sin(time * 5 + root.id) * 0.06;
      break;
    }
    case 'vis':
      // een haai zwiept met zijn staart, sneller als hij aanvalt
      a.tail[0].rotation.y = Math.sin(time * (atk ? 16 : 6 + speed) + root.id) * 0.5;
      a.inner.rotation.y = Math.sin(time * (6 + speed) + root.id) * 0.06;
      if (a.jaw) a.jaw.rotation.x = atk ? 0.5 : 0.08;
      break;
    case 'kwal':
      // een kwal pompt zichzelf vooruit: de hoed gaat open en dicht en de slierten golven mee
      a.inner.scale.set(1 + Math.sin(time * 2.4 + root.id) * 0.1, 1 - Math.sin(time * 2.4 + root.id) * 0.12, 1 + Math.sin(time * 2.4 + root.id) * 0.1);
      a.tail.forEach((t, i) => { t.rotation.x = Math.sin(time * 2.4 + i) * 0.25; t.rotation.z = Math.cos(time * 2 + i * 2) * 0.2; });
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
    case 'rit': a.update(time); break;
    case 'stad': a.update(); break;                           // een stoplicht of een geparkeerd vliegtuig (zie city.js)                       // een attractie van de kermis (zie rides.js)
    case 'heli': {
      // de wieken draaien als er iemand in zit
      const sp = flags & 2 ? 34 : 0;
      a.spin = (a.spin || 0) + ((sp - (a.spin || 0)) * Math.min(1, dt * 1.5));
      if (a.prop) a.prop.rotation.z += a.spin * dt * 1.4;
      else { a.rotor.rotation.y += a.spin * dt; a.tailRotor.rotation.x += a.spin * dt * 1.6; }
      break;
    }
    case 'trein':
      for (const w of a.wheels) w.rotation.x += speed * dt * 3;
      a.inner.position.y = moving ? Math.sin(time * 26) * 0.012 : 0;
      break;
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

// de bouwstenen van de modellen, ook voor de attracties in rides.js
export { mat as skinMat, glowMat, part as boxPart, faceMats };
export { setArmor, buildArms } from './rig.js';
