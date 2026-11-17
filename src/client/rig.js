// Het poppetje van de speler: een skelet met gewrichten (heup, knie, enkel, rug, nek, schouder,
// elleboog) en een animatie die daar de hoeken van uitrekent. Mens, elf en robot hebben
// hetzelfde skelet, maar andere maten en een andere manier van lopen:
//   mens  - gewoon: de knie buigt als het been naar voren zwaait, de armen zwaaien mee
//   elf   - klein, op de tenen, snelle lichte pasjes met een huppeltje; muts en oren wiebelen
//   robot - blik: stijve benen die neerploffen, de romp schommelt, de onderarmen staan haaks
//
// Hoeken: een ledemaat hangt naar beneden; draaien om de x-as met een negatieve hoek zwaait
// hem naar voren (+z), met een positieve hoek naar achteren.
import * as THREE from '../../vendor/three.module.min.js';
import { skinMat as mat, glowMat, boxPart as part, faceMats } from './models.js';

const PI = Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;

// maten (in blokken) en loopstijl per soort
const STYLE = {
  mens: {
    scale: 1, hip: 0.8, thigh: 0.4, shin: 0.34, foot: 0.06, hipX: 0.13, legW: 0.22,
    chestW: 0.5, chestH: 0.56, chestD: 0.27, shoulderX: 0.35, upper: 0.3, fore: 0.26, armW: 0.18, head: 0.44,
    A0: 0.7, A1: 1.0, K0: 0.85, K1: 1.5, Kst: 0.06, arm0: 0.45, arm1: 0.95, E0: 0.18, E1: 1.1, armOut: 0.06,
    lean0: 0.04, lean1: 0.22, twist: 0.1, sway: 0.025, hop: 0, stomp: 0, toe: 0, stiff: 0,
  },
  elf: {
    scale: 0.8, hip: 0.74, thigh: 0.36, shin: 0.32, foot: 0.06, hipX: 0.11, legW: 0.17,
    chestW: 0.42, chestH: 0.5, chestD: 0.24, shoulderX: 0.29, upper: 0.28, fore: 0.24, armW: 0.14, head: 0.46,
    A0: 0.75, A1: 0.95, K0: 1.0, K1: 1.6, Kst: 0.12, arm0: 0.3, arm1: 0.7, E0: 0.7, E1: 0.7, armOut: 0.28,
    lean0: 0.02, lean1: 0.14, twist: 0.14, sway: 0.03, hop: 0.05, stomp: 0, toe: 0.55, stiff: 0,
  },
  robot: {
    scale: 1, hip: 0.8, thigh: 0.38, shin: 0.32, foot: 0.1, hipX: 0.15, legW: 0.2,
    chestW: 0.58, chestH: 0.54, chestD: 0.36, shoulderX: 0.41, upper: 0.28, fore: 0.26, armW: 0.17, head: 0.46,
    A0: 0.85, A1: 0.95, K0: 0.15, K1: 0.25, Kst: 0, arm0: 0.3, arm1: 0.45, E0: 1.45, E1: 0, armOut: 0.1,
    lean0: 0, lean1: 0.05, twist: 0.03, sway: 0.09, hop: 0, stomp: 0.06, toe: 0, stiff: 1,
  },
};

function joint(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
// een bot dat vanaf zijn gewricht naar beneden hangt
function bone(j, m, w, h, d) { return part(j, m, w, h, d, 0, -h / 2, 0); }

export function buildRig(look) {
  const type = look && STYLE[look.type] ? look.type : 'mens', S = STYLE[type];
  const root = new THREE.Group(), inner = new THREE.Group();
  root.add(inner); inner.scale.setScalar(S.scale);
  const a = root.userData.a = { type: 'speler', soort: type, S, inner, phase: 0, move: 0, run: 0, air: 0, swimF: 0, land: 0, legs: [], arms: [], head: null, swing: 0, pose: '', airborne: false, swim: false, vy: 0 };
  const shirtC = (look && look.shirt) || 0x2f7fd0;
  const robot = type === 'robot', elf = type === 'elf';
  const skinC = robot ? 0xbcc6d0 : elf ? 0xcfe8b0 : 0xe8b890, kind = robot ? 'metaal' : 'glad';
  const hairC = robot ? 0x56606c : elf ? 0xe8c860 : (look && look.hair) || 0x5a3a1c;
  const sk = mat(skinC, kind), shirt = mat(shirtC, kind), pants = mat(robot ? 0xa8b4c0 : elf ? 0x4a6a3a : 0x3a4a7a, kind);
  const donker = mat(robot ? 0x3a424c : elf ? 0x6a4426 : 0x2a2a30, robot ? 'metaal' : 'glad');

  // heupen, rug en romp
  const hips = a.hips = joint(inner, 0, S.hip, 0);
  part(hips, robot ? donker : pants, S.chestW * (robot ? 0.6 : 0.92), 0.16, S.chestD * 0.96, 0, 0.03, 0);
  const spine = a.spine = joint(hips, 0, 0.08, 0);
  part(spine, robot ? sk : shirt, S.chestW, S.chestH, S.chestD, 0, S.chestH / 2, 0);
  const top = S.chestH;
  if (robot) {
    // een blikken kast met klinknagels, een paneel met lampjes en een streep in je eigen kleur
    part(spine, shirt, S.chestW + 0.02, 0.1, S.chestD + 0.02, 0, top - 0.1, 0);
    part(spine, donker, 0.3, 0.24, 0.03, 0, top * 0.48, S.chestD / 2 + 0.005);
    a.lampjes = [0xff3020, 0xffd020, 0x3aff5a].map((c, i) => part(spine, glowMat(c), 0.06, 0.06, 0.03, -0.09 + i * 0.09, top * 0.52, S.chestD / 2 + 0.02));
    for (const sx of [-1, 1]) for (const sy of [0.08, top - 0.22]) part(spine, donker, 0.04, 0.04, 0.03, sx * (S.chestW / 2 - 0.05), sy, S.chestD / 2 + 0.005);
    part(spine, donker, 0.2, 0.16, 0.12, 0, top * 0.5, -S.chestD / 2 - 0.05);             // de accu op zijn rug
  } else {
    part(spine, donker, S.chestW + 0.02, 0.07, S.chestD + 0.02, 0, 0.02, 0);                // de riem
    if (elf) {
      part(spine, glowMat(0xffd23a), 0.08, 0.08, 0.03, 0, 0.02, S.chestD / 2 + 0.015);      // gouden gesp
      for (let i = -2; i <= 2; i++) part(spine, shirt, 0.09, 0.1, S.chestD + 0.02, i * 0.085, -0.07 - (i & 1 ? 0 : 0.03), 0);      // het kartelrandje van de tuniek
      part(spine, mat(0xf4f4f0, 'glad'), S.chestW * 0.7, 0.06, S.chestD + 0.03, 0, top - 0.02, 0);     // kraagje
    }
  }

  // nek en hoofd
  const neck = a.neck = joint(spine, 0, top + 0.02, 0);
  const head = a.head = joint(neck, 0, S.head / 2 + 0.02, 0);
  part(head, faceMats(skinC, kind, robot ? '#4ae0ff' : '#201810', robot, true), S.head, S.head, S.head, 0, 0, 0);
  const h2 = S.head / 2;
  if (robot) {
    for (const s of [-1, 1]) part(head, donker, 0.06, 0.14, 0.14, s * (h2 + 0.03), 0, 0);       // bouten als oren
    part(head, donker, S.head + 0.02, 0.05, S.head + 0.02, 0, h2 - 0.02, 0);
    part(head, donker, 0.04, 0.22, 0.04, 0, h2 + 0.11, 0);
    a.antenne = part(head, glowMat(0xff3020), 0.09, 0.09, 0.09, 0, h2 + 0.25, 0);
    part(neck, donker, 0.16, 0.08, 0.16, 0, 0, 0);
  } else {
    const hair = mat(hairC, 'vacht');
    part(head, hair, S.head + 0.04, 0.1, S.head + 0.04, 0, h2 + 0.01, 0);
    part(head, hair, S.head + 0.04, 0.3, 0.1, 0, 0.05, -h2 + 0.02);
    if (elf) {
      // grote puntoren die schuin naar buiten steken
      a.oren = [-1, 1].map((s) => {
        const o = joint(head, s * h2, 0.02, -0.02);
        const b = part(o, sk, 0.26, 0.17, 0.06, s * 0.11, 0.03, 0); b.rotation.z = s * 0.5;
        const p = part(o, sk, 0.2, 0.1, 0.05, s * 0.27, 0.15, 0); p.rotation.z = s * 0.8;
        const q = part(o, sk, 0.12, 0.06, 0.045, s * 0.37, 0.27, 0); q.rotation.z = s * 1.0;
        o.userData.s = s;
        return o;
      });
      // de puntmuts: drie stukken die steeds smaller worden, met een belletje aan de punt
      const muts = mat(shirtC, 'vacht');
      part(head, mat(0xf4f4f0, 'vacht'), S.head + 0.08, 0.08, S.head + 0.08, 0, h2 + 0.05, 0);
      const m1 = joint(head, 0, h2 + 0.08, 0); part(m1, muts, S.head * 0.86, 0.18, S.head * 0.86, 0, 0.09, 0);
      const m2 = joint(m1, 0, 0.17, -0.02); part(m2, muts, S.head * 0.56, 0.18, S.head * 0.56, 0, 0.08, 0);
      const m3 = joint(m2, 0, 0.16, -0.02); part(m3, muts, S.head * 0.3, 0.18, S.head * 0.3, 0, 0.08, 0);
      part(m3, glowMat(0xffd23a), 0.09, 0.09, 0.09, 0, 0.2, 0);
      a.muts = [m1, m2, m3];
    }
  }

  // armen: schouder -> bovenarm -> elleboog -> onderarm en hand
  for (const s of [-1, 1]) {
    const sh = joint(spine, s * S.shoulderX, top - 0.06, 0);
    if (robot) part(sh, donker, 0.2, 0.2, 0.2, 0, 0, 0);                                    // het schoudergewricht
    bone(sh, robot ? sk : shirt, S.armW, S.upper, S.armW);
    const el = joint(sh, 0, -S.upper, 0);
    if (robot) part(el, donker, S.armW * 0.8, 0.1, S.armW * 0.8, 0, 0, 0);
    bone(el, robot ? sk : elf ? sk : shirt, S.armW * 0.92, S.fore, S.armW * 0.92);
    if (robot) { for (const k of [-1, 1]) part(el, donker, 0.05, 0.14, 0.12, k * 0.055, -S.fore - 0.07, 0); }      // een grijper
    else part(el, sk, S.armW * 0.86, 0.13, S.armW * 0.86, 0, -S.fore - 0.065, 0);
    a.arms.push({ sh, el, s });
  }

  // benen: heup -> bovenbeen -> knie -> onderbeen -> enkel -> voet
  for (const s of [-1, 1]) {
    const hp = joint(hips, s * S.hipX, 0, 0);
    bone(hp, pants, S.legW, S.thigh, S.legW);
    const kn = joint(hp, 0, -S.thigh, 0);
    if (robot) part(kn, donker, S.legW * 0.8, 0.1, S.legW * 0.8, 0, 0, 0);
    bone(kn, robot ? sk : pants, S.legW * 0.9, S.shin, S.legW * 0.9);
    const an = joint(kn, 0, -S.shin, 0);
    if (robot) part(an, donker, 0.26, S.foot + 0.04, 0.38, 0, -S.foot / 2, 0.05);               // zware blokvoeten
    else {
      part(an, donker, S.legW + 0.02, S.foot + 0.04, S.legW + 0.12, 0, -S.foot / 2 + 0.01, 0.05);
      if (elf) { const punt = part(an, donker, S.legW * 0.6, 0.06, 0.1, 0, 0.0, 0.2); punt.rotation.x = -0.7; }      // een krulschoen
    }
    a.legs.push({ hp, kn, an, s });
  }
  return root;
}

// Het poppetje bewegen. speed = hoe hard je over de grond gaat. In a staat verder: pose
// ('ride' = je zit ergens op), airborne (je bent van de grond), vy (stijgen of vallen),
// swim (je zwemt) en swing (je zwaait met je arm).
export function animateRig(a, time, speed, dt) {
  const S = a.S, riding = a.pose === 'ride';
  time += a.seed || 0;                                                  // (zodat niet iedereen precies gelijk ademt en rondkijkt)
  const go = speed > 0.3 && !riding;
  const k = Math.min(1, dt * 10);
  a.move += ((go ? 1 : 0) - a.move) * k;
  a.run += (clamp01((speed - 4.6) / 1.6) - a.run) * Math.min(1, dt * 6);
  a.air += ((a.airborne && !riding && !a.swim ? 1 : 0) - a.air) * Math.min(1, dt * 12);
  a.swimF += ((a.swim && !riding ? 1 : 0) - a.swimF) * Math.min(1, dt * 6);
  // net geland: even door de knieën
  if (a.wasAir && !a.airborne) a.land = 1;
  a.wasAir = a.airborne;
  a.land = Math.max(0, a.land - dt * 5);
  const mv = a.move * (1 - a.air) * (1 - a.swimF), run = a.run, air = a.air, sw = a.swimF, idle = 1 - a.move;
  // Hoe ver zwaait het been? Langzaam lopen = kleine pasjes, rennen = grote.
  const A = lerp(lerp(0.3, S.A0, clamp01(speed / 4.5)), S.A1, run), K = lerp(S.K0, S.K1, run);
  // De benen gaan precies zo snel dat de voet die op de grond staat niet schuift: in een halve
  // slag (één stap) leg je twee keer beenlengte x sin(A) af.
  const pas = 2 * (S.thigh + S.shin) * Math.sin(A) * (S.scale || 1) * a.inner.parent.scale.x;
  if (go) a.phase += dt * PI * speed / Math.max(0.15, pas);
  const sinA = Math.sin(A);
  let reach = 0;
  for (let i = 0; i < 2; i++) {
    const L = a.legs[i], ph = a.phase + i * PI;
    const s = Math.sin(ph), p = ((ph % (2 * PI)) + 2 * PI) % (2 * PI);
    const swingF = Math.max(0, Math.cos(ph));                            // 1 als het been onder je door naar voren zwaait
    // Staat de voet op de grond (de tweede helft van de slag), dan gaat hij met een vaste
    // snelheid naar achteren, net zo hard als jij vooruit gaat. In de lucht zwaait hij soepel terug.
    const stand = p > PI / 2 && p < 1.5 * PI;
    let th = (stand ? -Math.asin(sinA * (1 - 2 * (p - PI / 2) / PI)) : -A * s) * mv;
    let kn = (K * Math.pow(swingF, 1.2) + S.Kst + 0.14 * Math.pow(Math.max(0, s), 4)) * mv;
    let toe = S.toe * (1 - air);
    // stilstaan: een heel klein beetje door de knieën, en na een sprong iets dieper
    kn += a.land * 0.5 * (1 - air);
    th -= a.land * 0.25 * (1 - air);
    // in de lucht: het ene been opgetrokken, het andere wat naar achteren
    if (air > 0) {
      const up = a.vy > 0 ? 1 : 0.55;
      th = lerp(th, S.stiff ? (i ? 0.12 : -0.12) : (i ? 0.3 : -0.75 * up), air);
      kn = lerp(kn, S.stiff ? 0.1 : (i ? 0.75 : 1.15 * up), air);
      toe = lerp(toe, 0.5, air);
    }
    // zwemmen: trappelen
    if (sw > 0) { th = lerp(th, 0.35 * Math.sin(time * 7 + i * PI), sw); kn = lerp(kn, 0.3 + 0.25 * Math.sin(time * 7 + i * PI + 1), sw); toe = lerp(toe, 0.6, sw); }
    let splay = 0;
    if (riding) { th = -1.35; kn = 1.2; splay = L.s * 0.32; toe = 0; }
    L.hp.rotation.set(th, 0, splay);
    L.kn.rotation.x = kn;
    if (L.an) L.an.rotation.x = riding ? -0.2 : toe - (th + kn);        // de voet blijft plat (of op de tenen)
    const r = S.thigh * Math.cos(th) + S.shin * Math.cos(th + kn) + S.foot * (1 + Math.sin(toe) * 1.6);
    if (r > reach) reach = r;
  }
  // de heupen staan zo hoog dat de laagste voet precies op de grond staat: dat geeft vanzelf
  // het op-en-neer van het lopen
  const ph = a.phase, sn = Math.sin(ph);
  let hy = lerp(reach, S.hip, Math.max(air, sw));
  if (riding) hy = S.hip;
  hy += S.hop * Math.abs(sn) * mv;                                       // het huppeltje van de elf
  hy -= S.stomp * Math.pow(Math.abs(sn), 8) * mv;                        // de plof van de robot
  hy += idle * (S.stiff ? 0 : Math.sin(time * 1.7) * 0.006);             // ademhalen
  a.hips.position.y = hy - sw * 0.25;
  a.hips.rotation.set(0, S.twist * sn * mv, S.sway * sn * mv + (S.stiff ? 0 : idle * Math.sin(time * 0.7) * 0.012));
  const lean = lerp(S.lean0, S.lean1, run) * mv + air * (S.stiff ? 0 : (a.vy > 0 ? -0.05 : 0.12)) + sw * 0.7;
  a.spine.rotation.set(lean + (S.stiff ? 0 : idle * Math.sin(time * 1.7) * 0.012), -1.7 * S.twist * sn * mv, -S.sway * 0.6 * sn * mv);
  // het hoofd blijft recht en kijkt bij stilstaan wat rond (de robot schokkerig)
  let look = Math.sin(time * 0.45) * 0.3;
  if (S.stiff) { const q = Math.round(look * 5) / 5; a.lookY = (a.lookY || 0) + (q - (a.lookY || 0)) * Math.min(1, dt * 14); look = a.lookY * 1.4; }
  a.neck.rotation.set(-lean * 0.7 - sw * 0.2 + (S.stiff ? 0 : idle * Math.sin(time * 0.9 + 1) * 0.04), look * idle * (1 - air), 0);

  // armen: die zwaaien tegen de benen in
  for (let i = 0; i < 2; i++) {
    const R = a.arms[i], s = Math.sin(a.phase + i * PI);
    let sx = lerp(S.arm0, S.arm1, run) * s * mv;
    let el = -(S.E0 + S.E1 * run + 0.3 * Math.max(0, -s)) * (S.stiff || S.E0 > 0.5 ? 1 : mv) - (S.stiff ? 0 : 0.08);
    let out = S.armOut + (S.stiff ? 0 : idle * (0.02 + Math.sin(time * 1.7 + i) * 0.015));
    if (air > 0) {
      sx = lerp(sx, S.stiff ? 0 : (a.vy > 0 ? -0.9 : -2.3), air * (S.stiff ? 1 : 0.8));
      out = lerp(out, S.stiff ? 0.25 : (S.hop ? 1.0 : 0.6), air);
      if (!S.stiff) el = lerp(el, -0.35, air);
    }
    if (sw > 0) { const t = time * 3.4 + i * PI; sx = lerp(sx, -1.7 + Math.sin(t) * 0.9, sw); out = lerp(out, 0.3 + Math.max(0, Math.cos(t)) * 0.7, sw); el = lerp(el, -0.3, sw); }
    if (riding) { sx = -0.95; el = -0.4; out = 0.12; }
    if (a.atk) { sx = -2.2 + Math.sin(time * 20 + i * 2) * 0.5; el = -0.3; }                                // een monster dat uithaalt
    if (i === 1 && a.swing > 0) { sx = -2.3 + Math.sin(a.swing * 14) * 1.1; el = -0.35; out = 0.05; }      // hakken, slaan, bouwen
    R.sh.rotation.set(sx, 0, R.s * out);
    R.el.rotation.x = el;
  }
  if (a.swing > 0) a.swing -= dt;

  // de muts en de oren van de elf wiebelen mee; het lampje van de robot knippert
  if (a.muts) {
    const w = Math.sin(a.phase * 2) * 0.16 * mv + Math.sin(time * 2.1) * 0.03 + air * (a.vy > 0 ? 0.3 : -0.5);
    a.muts[0].rotation.x = -0.12 + w * 0.4; a.muts[1].rotation.x = -0.4 + w * 0.8; a.muts[2].rotation.x = -0.6 + w * 1.2;
    for (const o of a.oren) o.rotation.z = o.userData.s * (Math.sin(time * 2.6 + o.userData.s) * 0.06 + Math.sin(a.phase * 2) * 0.1 * mv - air * 0.25);
  }
  if (a.antenne) {
    a.antenne.visible = (time * 1.6) % 1 < 0.6;
    const n = Math.floor(time * (go ? 6 : 1.5)) % 3;
    a.lampjes.forEach((l, i) => { l.visible = go ? i === n : i <= n; });
  }
}

// ---------- dorpelingen en monsters ----------
// De andere modellen zijn gebouwd met armen en benen uit één stuk. Hier krijgen ze achteraf
// hetzelfde skelet: elk been en elke arm wordt in tweeën gedeeld (knie, elleboog), en de romp
// komt op een heup te staan die kan bewegen. Daarna gebruiken ze dezelfde animatie als de speler.

// loopstijlen voor wie geen speler is
STYLE.dorp = Object.assign({}, STYLE.mens, { arm0: 0.35, armOut: 0.04 });
STYLE.ridder = Object.assign({}, STYLE.mens, { K0: 0.7, arm0: 0.3, arm1: 0.6, sway: 0.04, lean0: 0.02 });
STYLE.skelet = Object.assign({}, STYLE.mens, { K0: 1.1, twist: 0.18, sway: 0.05, arm0: 0.6, armOut: 0.12, lean0: 0.1 });
STYLE.zwaar = Object.assign({}, STYLE.mens, { A0: 0.6, A1: 0.75, K0: 0.55, K1: 0.8, arm0: 0.5, arm1: 0.7, E0: 0.3, E1: 0.3, armOut: 0.12, lean0: 0.12, lean1: 0.2, twist: 0.06, sway: 0.08, stomp: 0.05 });

// een ledemaat uit één stuk (gemaakt met limb() in models.js) in tweeën delen; wat aan de
// onderste helft vastzat (een hand, een zwaard, een schild) gaat mee met het onderste stuk
export function splitLimb(g) {
  const m = g.children[0], h = m.scale.y;
  const low = new THREE.Group(); low.position.y = -h / 2;
  const m2 = new THREE.Mesh(m.geometry, m.material); m2.scale.set(m.scale.x, h / 2, m.scale.z); m2.position.y = -h / 4;
  low.add(m2);
  m.scale.y = h / 2; m.position.y = -h / 4;
  for (const c of g.children.slice(1)) if (c.position.y < -h / 2 + 1e-6) { low.add(c); c.position.y += h / 2; }
  g.add(low);
  g.userData.low = low;
  return h;
}

export function rigify(root, style) {
  const a = root.userData.a, inner = a.inner;
  if (!a.legs || a.legs.length !== 2 || !a.arms || a.arms.length !== 2 || !a.head) return;
  const hip = a.legs[0].position.y;
  const hips = new THREE.Group(); hips.position.y = hip;
  const spine = new THREE.Group(), off = new THREE.Group(); off.position.y = -hip;
  const kids = inner.children.slice();
  inner.add(hips); hips.add(spine); spine.add(off);
  for (const c of kids) { if (a.legs.includes(c)) { hips.add(c); c.position.y -= hip; } else off.add(c); }
  let legH = 0, armH = 0;
  a.legs = a.legs.map((g) => { legH = splitLimb(g); return { hp: g, kn: g.userData.low, an: null, s: g.position.x < 0 ? -1 : 1 }; });
  a.arms = a.arms.map((g) => { armH = splitLimb(g); return { sh: g, el: g.userData.low, s: g.position.x < 0 ? -1 : 1 }; });
  a.S = Object.assign({}, STYLE[style] || STYLE.dorp, { hip, thigh: legH / 2, shin: legH / 2, foot: 0, upper: armH / 2, fore: armH / 2, toe: 0 });
  Object.assign(a, { type: 'speler', hips, spine, neck: a.head, move: 0, run: 0, air: 0, swimF: 0, land: 0, swing: 0, pose: '', airborne: false, swim: false, vy: 0, seed: (root.id * 1.37) % 60 });
}

// viervoeters en vogels: elke poot die lang genoeg is krijgt een knie
export function kneeify(root) {
  const a = root.userData.a;
  for (const g of a.legs) if (g.children.length && g.children[0].isMesh && g.children[0].scale.y >= 0.4 && !g.userData.low) splitLimb(g);
}
