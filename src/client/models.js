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
  // de mouw houdt op waar de hand begint, en de hand is net iets smaller dan de mouw:
  // zo liggen er nergens twee vlakken precies op elkaar (dat gaf flikkerende handen)
  a.arms = [limb(g, shirt, 0.2, 0.56, 0.2, -0.37, 1.43, 0), limb(g, shirt, 0.2, 0.56, 0.2, 0.37, 1.43, 0)];
  part(a.arms[0], sk, 0.17, 0.17, 0.17, 0, -0.64, 0); part(a.arms[1], sk, 0.17, 0.17, 0.17, 0, -0.64, 0);
  const head = new THREE.Group(); head.position.set(0, 1.68, 0); g.add(head); a.head = head;
  part(head, faceMats(skinC, kind, eye, glow, true), 0.44, 0.44, 0.44, 0, 0, 0);
  const hair = mat(hairC, 'vacht');
  part(head, hair, 0.48, 0.14, 0.48, 0, 0.24, 0);
  part(head, hair, 0.48, 0.3, 0.1, 0, 0.06, -0.2);
  if (type === 'elf') for (const s of [-1, 1]) { const e = part(head, sk, 0.06, 0.2, 0.1, s * 0.25, 0.08, 0); e.rotation.z = -s * 0.5; }
  if (type === 'robot') { part(head, mat(0x56606c, 'metaal'), 0.04, 0.24, 0.04, 0, 0.42, 0); part(head, glowMat(0xff3020), 0.08, 0.08, 0.08, 0, 0.56, 0); }
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


const BEER_COLOR = { groen: 0x6a4428, ijs: 0xf2f2ee, vuur: 0x3a2a26, schaduw: 0x3a2a4a, wolken: 0xe8d8c0 };
const SCHAAP_COLOR = { groen: 0xf2efe6, ijs: 0xf8fbff, vuur: 0x6a5a56, schaduw: 0x9a86c0, wolken: 0xffe6f2 };
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
    case 'skelet': m = skelet(''); break;
    case 'schaap': m = schaap(SCHAAP_COLOR[opts.world] || SCHAAP_COLOR.groen); break;
    case 'koe': m = koe(); break;
    case 'beer': m = beer(BEER_COLOR[opts.world] || BEER_COLOR.groen); break;
    case 'grijzewolf': m = quad(opts.world === 'schaduw' ? 0x2a2434 : 0x7a7e88, 'vacht', '#ffd040', true, 0); break;
    case 'reuzenspin': m = reuzenspin(); break;
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
