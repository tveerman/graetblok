// De attracties van de kermis: grote bewegende modellen waar je in kunt zitten.
//
// Elke attractie is één model dat altijd draait. Het model heeft "stoelen": plekken die met
// het model meebewegen. Stap je in, dan zit je op zo'n stoel en beweeg je mee (zie de speler,
// rideTick). In userData.a staat wat de rest van het spel nodig heeft:
//   update(t)    het model op tijdstip t zetten (t = de klok van het spel, in tellen)
//   seats        de stoelen
//   pickSeat(t)  welke stoel krijg je als je nu instapt?
//   canBoard(t)  kun je nu instappen? (de achtbaan moet in het station staan)
//   endTime(t)   wanneer is het ritje afgelopen als je op t bent ingestapt?
//   exit         waar sta je na afloop (ten opzichte van de attractie)
import * as THREE from '../../vendor/three.module.min.js';
import { skinMat, glowMat } from './models.js';
import { RIDES } from '../shared/rides.js';
import { lijnvlucht } from './city.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const TAU = Math.PI * 2;
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4(), _nm = new THREE.Matrix3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();

// Veel doosjes samen in één vorm: dat is voor de tablet veel minder werk dan elk doosje los.
export class Merge {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.idx = []; }
  // een doosje met de matrix m (plek, draaiing en grootte)
  put(m) {
    const p = BOX.attributes.position, n = BOX.attributes.normal, u = BOX.attributes.uv, ix = BOX.index, base = this.pos.length / 3;
    _nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(m); this.pos.push(_v.x, _v.y, _v.z);
      _n.fromBufferAttribute(n, i).applyMatrix3(_nm).normalize(); this.nrm.push(_n.x, _n.y, _n.z);
      this.uv.push(u.getX(i), u.getY(i));
    }
    for (let i = 0; i < ix.count; i++) this.idx.push(base + ix.getX(i));
  }
  // een recht doosje: breed, hoog, diep, op plek x, y, z, eventueel gedraaid om de z-as of y-as
  box(w, h, d, x, y, z, rz = 0, ry = 0) {
    _m.makeRotationZ(rz);
    if (ry) _m.premultiply(new THREE.Matrix4().makeRotationY(ry));
    _m.scale(_v.set(w, h, d)); _m.setPosition(x, y, z);
    this.put(_m);
  }
  // een balk van punt a naar punt b, dik bij dik, met "boven" in de richting up
  beam(a, b, dik, up) {
    _z.subVectors(b, a); const len = _z.length(); if (len < 1e-6) return;
    _z.divideScalar(len);
    _x.crossVectors(up || _y.set(0, 1, 0), _z); if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0); _x.normalize();
    _n.crossVectors(_z, _x);
    _m.makeBasis(_x, _n, _z); _m.scale(_v.set(dik, dik, len)); _m.setPosition((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    this.put(_m);
  }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return new THREE.Mesh(g, material);
  }
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const seat = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
const KLEUREN = [0xd8362c, 0xf0a020, 0xf0d020, 0x3ab04a, 0x2a6ad0, 0x8a4ad0, 0xf06ab0, 0x2ac0c8];
// de laagste stoel (voor attracties waar je onderaan instapt)
function lowest(seats) {
  let best = 0, by = 1e9;
  seats.forEach((s, i) => { s.getWorldPosition(_v); if (_v.y < by) { by = _v.y; best = i; } });
  return best;
}
function base(kind) {
  const root = new THREE.Group();
  root.userData.a = { type: 'rit', ride: kind, seats: [], update() {}, pickSeat() { return 0; }, canBoard() { return true; }, endTime(t) { return t + (RIDES[kind] ? RIDES[kind].dur : 20); }, exit: [0, 0.2, 2.5], wacht: '' };
  return root;
}

// ---------- reuzenrad ----------
function reuzenrad() {
  const root = base('reuzenrad'), a = root.userData.a;
  const R = 9, hub = R + 2.6, staal = skinMat(0xe8ecf2, 'metaal'), rood = skinMat(0xd8362c, 'glad');
  const frame = new Merge();
  for (const z of [-1.5, 1.5]) for (const x of [-5.5, 5.5]) frame.beam(V(x, 0, z), V(0, hub, z), 0.45);
  frame.beam(V(0, hub, -1.9), V(0, hub, 1.9), 0.7);
  root.add(frame.mesh(staal));
  const wheel = new THREE.Group(); wheel.position.set(0, hub, 0); root.add(wheel);
  const rim = new Merge();
  for (const z of [-0.9, 0.9]) for (let i = 0; i < 16; i++) {
    const a0 = i / 16 * TAU, a1 = (i + 1) / 16 * TAU;
    rim.beam(V(Math.cos(a0) * R, Math.sin(a0) * R, z), V(Math.cos(a1) * R, Math.sin(a1) * R, z), 0.28);
    if (i % 2 === 0) rim.beam(V(0, 0, z), V(Math.cos(a0) * R, Math.sin(a0) * R, z), 0.16);
  }
  wheel.add(rim.mesh(rood));
  const gond = [];
  for (let i = 0; i < 8; i++) {
    const an = i / 8 * TAU, g = new THREE.Group();
    g.position.set(Math.cos(an) * R, Math.sin(an) * R, 0); wheel.add(g);
    const m = new Merge();
    m.box(1.7, 0.2, 1.5, 0, -1.9, 0); m.box(1.7, 0.7, 0.1, 0, -1.5, 0.72); m.box(1.7, 0.7, 0.1, 0, -1.5, -0.72);
    m.box(0.1, 0.7, 1.5, 0.82, -1.5, 0); m.box(0.1, 0.7, 1.5, -0.82, -1.5, 0); m.box(1.9, 0.14, 1.7, 0, -0.35, 0);
    m.box(0.08, 1.2, 0.08, 0.8, -0.95, 0.7); m.box(0.08, 1.2, 0.08, -0.8, -0.95, 0.7); m.box(0.08, 1.2, 0.08, 0.8, -0.95, -0.7); m.box(0.08, 1.2, 0.08, -0.8, -0.95, -0.7);
    g.add(m.mesh(skinMat(KLEUREN[i], 'glad')));
    gond.push(g); a.seats.push(seat(g, 0, -1.75, 0));
  }
  a.update = (t) => { const r = t * TAU / 40; wheel.rotation.z = r; for (const g of gond) g.rotation.z = -r; };
  a.pickSeat = () => lowest(a.seats);
  a.exit = [0, 0.2, 3];
  return root;
}

// ---------- draaimolen ----------
function draaimolen() {
  const root = base('draaimolen'), a = root.userData.a;
  const spin = new THREE.Group(); root.add(spin);
  const vloer = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.3, 20), skinMat(0xf0d020, 'glad')); vloer.position.y = 0.15; spin.add(vloer);
  const dak = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.2, 20), skinMat(0xd8362c, 'glad')); dak.position.y = 5.2; spin.add(dak);
  const rand = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.5, 20), skinMat(0xf4f4f0, 'glad')); rand.position.y = 4.0; spin.add(rand);
  const paal = new Merge(); paal.box(0.6, 4.2, 0.6, 0, 2.1, 0); paal.box(0.5, 0.5, 0.5, 0, 6.5, 0);
  spin.add(paal.mesh(skinMat(0xf0a020, 'metaal')));
  const paarden = [];
  for (let i = 0; i < 6; i++) {
    const an = i / 6 * TAU, g = new THREE.Group();
    g.position.set(Math.cos(an) * 3.2, 0, Math.sin(an) * 3.2); g.rotation.y = -an; spin.add(g);
    const stok = new Merge(); stok.box(0.08, 3.9, 0.08, 0, 2.0, 0); g.add(stok.mesh(skinMat(0xf0d020, 'metaal')));
    const p = new THREE.Group(); g.add(p);
    const m = new Merge();
    m.box(0.45, 0.5, 1.2, 0, 0, 0); m.box(0.3, 0.6, 0.3, 0, 0.45, 0.55); m.box(0.26, 0.26, 0.5, 0, 0.62, 0.85);
    for (const [x, z] of [[-0.14, 0.4], [0.14, 0.4], [-0.14, -0.4], [0.14, -0.4]]) m.box(0.12, 0.5, 0.12, x, -0.45, z);
    m.box(0.1, 0.5, 0.1, 0, 0.1, -0.7, 0, 0);
    p.add(m.mesh(skinMat([0xf4f4f0, 0x8a5a2c, 0x2a2e36, 0xf0a020, 0xf4f4f0, 0x8a5a2c][i], 'glad')));
    paarden.push(p); a.seats.push(seat(p, 0, 0.3, 0));
  }
  a.update = (t) => { spin.rotation.y = t * TAU / 12; paarden.forEach((p, i) => { p.position.y = 1.5 + Math.sin(t * 2.2 + i * 1.7) * 0.3; }); };
  // de stoel die het dichtst bij je is
  a.pickSeat = (t, px, pz) => { let best = 0, bd = 1e9; a.seats.forEach((s, i) => { s.getWorldPosition(_v); const d = Math.hypot(_v.x - px, _v.z - pz); if (d < bd) { bd = d; best = i; } }); return best; };
  a.exit = [0, 0.2, 6];
  return root;
}

// ---------- zweefmolen ----------
function zweefmolen() {
  const root = base('zweefmolen'), a = root.userData.a;
  const toren = new Merge(); toren.box(1.1, 10, 1.1, 0, 5, 0); toren.box(2.2, 0.4, 2.2, 0, 0.2, 0);
  root.add(toren.mesh(skinMat(0x2a6ad0, 'metaal')));
  const spin = new THREE.Group(); spin.position.y = 10; root.add(spin);
  const kap = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.6, 16), skinMat(0xf0d020, 'glad')); kap.position.y = 0.9; spin.add(kap);
  const schijf = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.3, 16), skinMat(0xd8362c, 'glad')); spin.add(schijf);
  const armen = [];
  for (let i = 0; i < 8; i++) {
    const an = i / 8 * TAU, piv = new THREE.Group();
    piv.position.set(Math.cos(an) * 4.1, -0.1, Math.sin(an) * 4.1); piv.rotation.y = -an; spin.add(piv);
    const arm = new THREE.Group(); piv.add(arm);
    const m = new Merge();
    m.box(0.05, 4.6, 0.05, 0, -2.3, 0.3); m.box(0.05, 4.6, 0.05, 0, -2.3, -0.3);
    m.box(0.7, 0.12, 0.7, 0, -4.7, 0); m.box(0.12, 0.7, 0.7, -0.33, -4.3, 0);
    arm.add(m.mesh(skinMat(KLEUREN[i], 'glad')));
    armen.push(arm); a.seats.push(seat(arm, 0, -4.9, 0));
  }
  // de stoeltjes zwaaien naar buiten; af en toe gaat hij even langzamer en hangen ze weer recht
  a.update = (t) => { const k = 0.55 + 0.45 * Math.sin(t * 0.25); spin.rotation.y = t * (0.6 + 0.5 * k); for (const arm of armen) arm.rotation.z = 0.25 + 0.6 * k; };
  a.pickSeat = (t, px, pz) => { let best = 0, bd = 1e9; a.seats.forEach((s, i) => { s.getWorldPosition(_v); const d = Math.hypot(_v.x - px, _v.z - pz); if (d < bd) { bd = d; best = i; } }); return best; };
  a.exit = [0, 0.2, 8];
  return root;
}

// ---------- schommelschip ----------
function schommelschip() {
  const root = base('schommelschip'), a = root.userData.a;
  const H = 9.5, frame = new Merge();
  for (const z of [-2.2, 2.2]) for (const x of [-4.5, 4.5]) frame.beam(V(x, 0, z), V(0, H, z), 0.5);
  frame.beam(V(0, H, -2.5), V(0, H, 2.5), 0.6);
  root.add(frame.mesh(skinMat(0x2a6ad0, 'metaal')));
  const swing = new THREE.Group(); swing.position.y = H; root.add(swing);
  const arm = new Merge(); arm.box(0.3, 6.6, 0.3, 0, -3.3, 1.0); arm.box(0.3, 6.6, 0.3, 0, -3.3, -1.0);
  swing.add(arm.mesh(skinMat(0xe8ecf2, 'metaal')));
  const romp = new Merge();
  romp.box(8.4, 0.5, 2.4, 0, -8.0, 0); romp.box(8.4, 0.9, 0.2, 0, -7.4, 1.2); romp.box(8.4, 0.9, 0.2, 0, -7.4, -1.2);
  romp.box(1.6, 1.4, 2.0, 4.8, -7.3, 0, 0.5); romp.box(1.6, 1.4, 2.0, -4.8, -7.3, 0, -0.5);
  for (let i = 0; i < 6; i++) romp.box(0.25, 0.3, 2.0, -3.4 + i * 1.36, -7.6, 0);
  swing.add(romp.mesh(skinMat(0x8a5a2c, 'vacht')));
  const vlag = new Merge(); vlag.box(0.1, 2.2, 0.1, 5.6, -5.6, 0); vlag.box(0.9, 0.6, 0.06, 5.1, -4.8, 0);
  swing.add(vlag.mesh(skinMat(0x1c2028, 'glad')));
  for (let i = 0; i < 6; i++) a.seats.push(seat(swing, -3.4 + i * 1.36 + 0.5, -7.4, 0));
  a.update = (t) => { swing.rotation.z = Math.sin(t * 1.35) * (0.75 + 0.4 * Math.sin(t * 0.21)); };
  a.pickSeat = () => 2;
  a.exit = [0, 0.2, 4.5];
  return root;
}

// ---------- vrijevaltoren ----------
const VAL_C = 18;                 // één rondje duurt zoveel tellen
function valHoogte(p) {          // hoe hoog hangt de ring op moment p van het rondje?
  if (p < 3) return 1;
  if (p < 10) return 1 + (p - 3) / 7 * 19;
  if (p < 12) return 20;
  if (p < 13.3) { const k = (p - 12) / 1.3; return 20 - 18.2 * k * k; }
  if (p < 14.2) return 1.8 - 0.8 * (p - 13.3) / 0.9;
  return 1;
}
function vrijeval() {
  const root = base('vrijeval'), a = root.userData.a;
  const toren = new Merge(); toren.box(1.5, 23, 1.5, 0, 11.5, 0); toren.box(3, 0.5, 3, 0, 0.25, 0); toren.box(2.4, 0.6, 2.4, 0, 23.2, 0);
  root.add(toren.mesh(skinMat(0x8a4ad0, 'metaal')));
  const top = new Merge(); top.box(0.5, 1.6, 0.5, 0, 24.3, 0); root.add(top.mesh(glowMat(0xfff2b0)));
  const ring = new THREE.Group(); root.add(ring);
  const m = new Merge();
  m.box(3.6, 0.5, 0.8, 0, 0, 1.4); m.box(3.6, 0.5, 0.8, 0, 0, -1.4); m.box(0.8, 0.5, 3.6, 1.4, 0, 0); m.box(0.8, 0.5, 3.6, -1.4, 0, 0);
  for (const [x, z] of [[1.9, 0], [-1.9, 0], [0, 1.9], [0, -1.9]]) { m.box(0.7, 0.9, 0.7, x, 0.5, z); a.seats.push(seat(ring, x, 0.3, z)); }
  ring.add(m.mesh(skinMat(0xf0d020, 'glad')));
  a.update = (t) => { ring.position.y = valHoogte(((t % VAL_C) + VAL_C) % VAL_C); };
  a.canBoard = (t) => { const p = t % VAL_C; return p < 2.4 || p > 14.4; };
  a.endTime = (t) => { const p = t % VAL_C, c0 = t - p; return (p < 2.4 ? c0 : c0 + VAL_C) + 14.6; };
  a.pickSeat = (t, px, pz) => { let best = 0, bd = 1e9; a.seats.forEach((s, i) => { s.getWorldPosition(_v); const d = Math.hypot(_v.x - px, _v.z - pz); if (d < bd) { bd = d; best = i; } }); return best; };
  a.wacht = 'Wacht tot de ring weer beneden is.';
  a.exit = [0, 0.2, 4];
  return root;
}

// ---------- achtbaan ----------
// De baan is een rij punten in de lucht: het station, de optakeling, een bocht, de grote
// afdaling, een looping, een heuvel en twee bochten terug naar het station.
const COASTER_STOP = 7;           // zo lang staat de trein in het station
let coasterPath = null;
function buildCoasterPath() {
  const P = [];
  let x = -4, y = 0.7, z = 0, h = 0;                   // h = de richting waarin de baan loopt (0 = oost, kwartslag = zuid)
  const ST = 0.5;
  const straight = (len, dy = 0) => {
    const n = Math.max(2, Math.round(len / ST)), y0 = y;
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      x += Math.cos(h) * len / n; z += Math.sin(h) * len / n;
      y = y0 + dy * (0.5 - 0.5 * Math.cos(k * Math.PI));            // vloeiend omhoog of omlaag
      P.push(V(x, y, z));
    }
  };
  const turn = (ang, r) => {
    const n = Math.max(3, Math.round(Math.abs(ang) * r / ST)), s = ang > 0 ? 1 : -1;
    const cx = x - Math.sin(h) * r * s, cz = z + Math.cos(h) * r * s, h0 = h;
    for (let i = 1; i <= n; i++) {
      h = h0 + ang * i / n;
      x = cx + Math.sin(h) * r * s; z = cz - Math.cos(h) * r * s;
      P.push(V(x, y, z));
    }
  };
  const loop = (r, drift) => {
    const n = Math.round(TAU * r / ST), x0 = x, y0 = y, z0 = z, dx = Math.cos(h), dz = Math.sin(h), sx = -Math.sin(h), sz = Math.cos(h);
    for (let i = 1; i <= n; i++) {
      const an = i / n * TAU, f = Math.sin(an) * r, up = (1 - Math.cos(an)) * r, d = drift * i / n;
      x = x0 + dx * f + sx * d; y = y0 + up; z = z0 + dz * f + sz * d;
      P.push(V(x, y, z));
    }
  };
  P.push(V(x, y, z));
  straight(10); const lift0 = P.length;
  straight(22, 17); const liftEnd = P.length;
  turn(Math.PI / 2, 5); turn(Math.PI / 2, 4);
  straight(16, -15.6);
  loop(4.5, 1.6);
  straight(4); straight(7, 5); straight(7, -5);
  turn(Math.PI / 2, 4); straight(2.6); turn(Math.PI / 2, 4);
  const brake = P.length;
  straight(5, y > 0.7 ? 0.7 - y : 0);
  P.pop();                                               // het laatste punt is weer het begin
  const N = P.length;
  // de richting van de baan en wat "boven" is in elk punt (in de looping draait boven mee)
  const T = [], U = [];
  for (let i = 0; i < N; i++) T.push(new THREE.Vector3().subVectors(P[(i + 1) % N], P[(i + N - 1) % N]).normalize());
  let up = V(0, 1, 0);
  for (let i = 0; i < N; i++) { up = up.clone().addScaledVector(T[i], -up.dot(T[i])).normalize(); U.push(up); }
  // hoe ver elk punt is langs de baan, en op welk moment de trein er is
  const S = [0];
  for (let i = 1; i <= N; i++) S.push(S[i - 1] + P[i % N].distanceTo(P[i - 1]));
  const top = P[liftEnd - 1].y, time = [0];
  for (let i = 1; i <= N; i++) {
    let v;
    if (i <= lift0) v = 1.2 + 2.6 * (i / lift0);                              // rustig het station uit
    else if (i <= liftEnd) v = 3.8;                                          // de ketting trekt hem omhoog
    else if (i >= brake) v = Math.max(1.6, 9 * (1 - (i - brake) / (N - brake)));      // remmen
    else v = Math.max(3.5, Math.sqrt(16 + 2 * 9.5 * (top - P[i % N].y)));     // hoe lager, hoe harder
    time.push(time[i - 1] + (S[i] - S[i - 1]) / v);
  }
  return { P, T, U, S, time, N, len: S[N], lap: time[N] };
}
// waar is een punt dat s blokken langs de baan ligt? vult pos, T (vooruit) en U (boven)
function pathAt(C, s, pos, tan, up) {
  s = ((s % C.len) + C.len) % C.len;
  let lo = 0, hi = C.N;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (C.S[mid] <= s) lo = mid; else hi = mid; }
  const f = (s - C.S[lo]) / Math.max(1e-6, C.S[lo + 1] - C.S[lo]), j = (lo + 1) % C.N;
  pos.lerpVectors(C.P[lo], C.P[j], f); tan.lerpVectors(C.T[lo], C.T[j], f).normalize(); up.lerpVectors(C.U[lo], C.U[j], f).normalize();
}
function achtbaan() {
  const root = base('achtbaan'), a = root.userData.a;
  const C = coasterPath || (coasterPath = buildCoasterPath());
  // de rails, de dwarsliggers en de palen: alles in twee vormen
  const rails = new Merge(), palen = new Merge(), R = new THREE.Vector3();
  for (let i = 0; i < C.N; i++) {
    const j = (i + 1) % C.N;
    for (const s of [-0.45, 0.45]) {
      const p0 = C.P[i].clone().addScaledVector(R.crossVectors(C.T[i], C.U[i]).normalize(), s);
      const p1 = C.P[j].clone().addScaledVector(R.crossVectors(C.T[j], C.U[j]).normalize(), s);
      rails.beam(p0, p1, 0.14, C.U[i]);
    }
    if (i % 2 === 0) { R.crossVectors(C.T[i], C.U[i]).normalize(); palen.beam(C.P[i].clone().addScaledVector(R, -0.6).addScaledVector(C.U[i], -0.12), C.P[i].clone().addScaledVector(R, 0.6).addScaledVector(C.U[i], -0.12), 0.12, C.U[i]); }
    if (i % 9 === 0 && C.U[i].y > 0.35 && C.P[i].y > 1.6) palen.box(0.3, C.P[i].y - 0.2, 0.3, C.P[i].x, (C.P[i].y - 0.2) / 2, C.P[i].z);
  }
  root.add(rails.mesh(skinMat(0xd8362c, 'metaal')));
  root.add(palen.mesh(skinMat(0xc8ced8, 'metaal')));
  // het station: een perron met een afdak
  const st = new Merge();
  st.box(12, 0.4, 1.6, 1, 0.2, 1.9); st.box(0.3, 3.4, 0.3, -4.6, 1.7, 2.5); st.box(0.3, 3.4, 0.3, 6.6, 1.7, 2.5); st.box(0.3, 3.4, 0.3, -4.6, 1.7, -1.3); st.box(0.3, 3.4, 0.3, 6.6, 1.7, -1.3);
  root.add(st.mesh(skinMat(0x8a5a2c, 'vacht')));
  const dak = new Merge(); dak.box(12.4, 0.3, 4.6, 1, 3.5, 0.6);
  root.add(dak.mesh(skinMat(0xf0d020, 'glad')));
  // de trein: drie karretjes
  const cars = [];
  for (let k = 0; k < 3; k++) {
    const g = new THREE.Group(); g.matrixAutoUpdate = false; root.add(g);
    const m = new Merge();
    m.box(1.2, 0.5, 1.7, 0, 0.35, 0); m.box(1.2, 0.5, 0.15, 0, 0.8, 0.78); m.box(1.2, 0.7, 0.15, 0, 0.9, -0.78);
    m.box(0.12, 0.5, 1.7, 0.56, 0.8, 0); m.box(0.12, 0.5, 1.7, -0.56, 0.8, 0);
    if (k === 0) { m.box(0.9, 0.4, 0.7, 0, 0.4, 1.15); m.box(0.5, 0.3, 0.4, 0, 0.75, 1.1); }
    g.add(m.mesh(skinMat(k === 0 ? 0x2a6ad0 : KLEUREN[k + 1], 'glad')));
    cars.push(g); a.seats.push(seat(g, 0, 0.65, -0.1));
  }
  const cyc = C.lap + COASTER_STOP, pos = new THREE.Vector3(), tan = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3();
  a.update = (t) => {
    const p = ((t % cyc) + cyc) % cyc, tt = Math.max(0, p - COASTER_STOP);
    // waar is de voorste wagen? (zoek het moment op in de tabel)
    let lo = 0, hi = C.N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (C.time[mid] <= tt) lo = mid; else hi = mid; }
    const s = C.S[lo] + (C.S[lo + 1] - C.S[lo]) * (tt - C.time[lo]) / Math.max(1e-6, C.time[lo + 1] - C.time[lo]);
    for (let k = 0; k < cars.length; k++) {
      pathAt(C, s - k * 2.0, pos, tan, up);
      right.crossVectors(up, tan).normalize();
      const g = cars[k];
      g.matrix.makeBasis(right, up, tan); g.matrix.setPosition(pos.x, pos.y, pos.z);
      g.matrixWorldNeedsUpdate = true;
    }
  };
  a.canBoard = (t) => (t % cyc) < COASTER_STOP - 1;
  a.endTime = (t) => t - (t % cyc) + cyc + 0.6;
  a.wacht = 'Wacht tot de trein in het station staat.';
  a.exit = [1, 0.5, 2.2];
  return root;
}

const BUILD = { reuzenrad, draaimolen, zweefmolen, schommelschip, vrijeval, achtbaan };
export function buildRide(kind) { return kind === 'lijnvlucht' ? lijnvlucht() : (BUILD[kind] || reuzenrad)(); }
