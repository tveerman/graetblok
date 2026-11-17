// De modellen van de stad en het vliegveld: het stoplicht, het geparkeerde vliegtuig en het
// lijnvliegtuig waar je in mee kunt vliegen.
import * as THREE from '../../vendor/three.module.min.js';
import { skinMat, glowMat } from './models.js';
import { Merge } from './rides.js';
import { lightState, FLIGHT } from '../shared/city.js';

let klok = 0;                 // de klok van de server (zodat de stoplichten kloppen met het verkeer)
export function setCityTime(t) { klok = t; }

function base(type) {
  const root = new THREE.Group();
  root.userData.a = { type, seats: [], update() {} };
  return root;
}

// Een paal met een kastje: op de kanten langs de x-as staat het licht voor het verkeer dat
// van oost naar west rijdt, op de andere kanten dat voor noord-zuid.
function stoplicht() {
  const root = base('stad'), a = root.userData.a;
  const paal = new Merge(); paal.box(0.18, 3.2, 0.18, 0, 1.6, 0); paal.box(0.5, 1.5, 0.5, 0, 3.9, 0);
  root.add(paal.mesh(skinMat(0x23262c, 'metaal')));
  const kleuren = [0xff2a1a, 0xffa820, 0x3aff5a], lamp = { x: [], z: [] };
  for (let i = 0; i < 3; i++) {
    const y = 4.35 - i * 0.45;
    const mx = new Merge(); mx.box(0.08, 0.3, 0.3, 0.27, y, 0); mx.box(0.08, 0.3, 0.3, -0.27, y, 0);
    const mz = new Merge(); mz.box(0.3, 0.3, 0.08, 0, y, 0.27); mz.box(0.3, 0.3, 0.08, 0, y, -0.27);
    const ox = mx.mesh(glowMat(kleuren[i])), oz = mz.mesh(glowMat(kleuren[i]));
    root.add(ox, oz); lamp.x.push(ox); lamp.z.push(oz);
  }
  a.update = () => {
    const sx = lightState(klok, 'x'), sz = lightState(klok, 'z');
    for (let i = 0; i < 3; i++) { lamp.x[i].visible = 2 - i === sx; lamp.z[i].visible = 2 - i === sz; }
  };
  a.update();
  return root;
}

// Een verkeersvliegtuig met de neus naar +x. Geeft een groep terug; stoelen = plekken om te zitten.
function toestelVorm(stoelen) {
  const g = new THREE.Group();
  const wit = new Merge();
  if (!stoelen) wit.box(15, 2.2, 2.2, 0, 2.6, 0);                    // de romp (dicht, voor een geparkeerd vliegtuig)
  else {
    // De romp van het lijnvliegtuig is hol: een cabine waar je echt in zit. Hij is opgebouwd
    // uit dunne platen, zodat je de wanden ook van binnen ziet.
    wit.box(15, 0.12, 2.2, 0, 3.64, 0);                              // het plafond
    wit.box(15, 0.12, 2.2, 0, 1.56, 0);                              // de buik
    for (const z of [-1.05, 1.05]) {
      wit.box(15, 1.0, 0.1, 0, 2.06, z);                             // de wand onder de ramen
      wit.box(15, 0.5, 0.1, 0, 3.4, z);                              // en erboven
      for (let i = 0; i <= 8; i++) wit.box(0.35, 0.6, 0.1, -6.8 + i * 1.7, 2.85, z);      // de stijlen tussen de ramen
    }
    wit.box(0.12, 2.1, 2.2, 7.44, 2.6, 0); wit.box(0.12, 2.1, 2.2, -7.44, 2.6, 0);        // de voor- en achterwand
  }
  wit.box(2, 1.8, 1.8, 8.4, 2.5, 0); wit.box(1.2, 1.2, 1.2, 9.8, 2.3, 0);      // de neus
  wit.box(2.4, 1.6, 1.6, -8.6, 2.9, 0);                              // de staart loopt smal toe
  wit.box(3.2, 0.26, 16, -0.6, 2.2, 0);                             // de vleugels
  wit.box(1.6, 0.2, 6, -9, 3.3, 0);                                  // het staartvlak
  g.add(wit.mesh(skinMat(0xf4f4f0, 'glad')));
  const blauw = new Merge();
  blauw.box(2.2, 3, 0.3, -9, 5, 0);                                  // het kielvlak
  blauw.box(15.02, 0.3, 2.24, 0, 2.0, 0);                            // een streep langs de romp
  for (const s of [-1, 1]) blauw.box(2.4, 0.9, 0.9, 0.2, 1.5, s * 4.2);         // de motoren
  g.add(blauw.mesh(skinMat(0x2a6ad0, 'glad')));
  const glas = new Merge();
  if (!stoelen) glas.box(12, 0.5, 2.26, -0.4, 3.0, 0);
  glas.box(1.0, 0.6, 1.5, 9.0, 3.1, 0);
  g.add(glas.mesh(skinMat(0x9fd8f0, 'glad')));
  if (stoelen) {
    // de ramen: dun, lichtblauw glas waar je doorheen kijkt
    const ruit = new Merge();
    for (const z of [-1.06, 1.06]) ruit.box(14.4, 0.6, 0.03, 0, 2.85, z);
    g.add(ruit.mesh(new THREE.MeshLambertMaterial({ color: 0xbfe6f8, transparent: true, opacity: 0.25, depthWrite: false })));
    // binnen: een blauwe loper, zes rijen met aan elke kant een stoel, en lampjes aan het plafond
    const loper = new Merge(); loper.box(14.6, 0.04, 0.5, 0, 1.67, 0);
    const stof = new Merge(), grijs = new Merge(), lamp = new Merge();
    for (let i = 0; i < 6; i++) {
      const x = 4.6 - i * 1.7;
      for (const z of [-0.62, 0.62]) {
        stof.box(0.7, 0.16, 0.7, x, 2.02, z);                        // de zitting
        stof.box(0.14, 0.95, 0.7, x - 0.42, 2.5, z);                 // de rugleuning
        grijs.box(0.6, 0.36, 0.1, x, 1.82, z - 0.3); grijs.box(0.6, 0.36, 0.1, x, 1.82, z + 0.3);      // de poten
        grijs.box(0.6, 0.06, 0.08, x - 0.05, 2.28, z + (z < 0 ? 0.36 : -0.36));                       // de armleuning aan het gangpad
        const o = new THREE.Object3D(); o.position.set(x, 2.12, z); g.add(o); stoelen.push(o);
      }
      lamp.box(0.3, 0.04, 0.3, x, 3.57, 0);
    }
    stof.box(14.6, 0.04, 2.0, 0, 1.63, 0);                           // de vloer (donkerblauw tapijt)
    g.add(loper.mesh(skinMat(0x2a6ad0, 'vacht')), stof.mesh(skinMat(0x3a4a8a, 'vacht')), grijs.mesh(skinMat(0x8a929c, 'metaal')), lamp.mesh(glowMat(0xfff6d8)));
  }
  const donker = new Merge();
  donker.box(0.3, 1.0, 0.3, 6, 0.8, 0); donker.box(0.5, 0.6, 0.9, 6, 0.3, 0);
  for (const s of [-1, 1]) { donker.box(0.3, 1.0, 0.3, -1, 0.9, s * 2); donker.box(0.7, 0.7, 0.9, -1, 0.35, s * 2); }
  g.add(donker.mesh(skinMat(0x23262c, 'metaal')));
  return g;
}

function toestel() {
  const root = base('stad');
  const g = toestelVorm(null); g.rotation.y = -Math.PI / 2;             // geparkeerd met de neus naar de gate (+z)
  root.add(g);
  return root;
}

// Het lijnvliegtuig: wacht aan het begin van de startbaan, stijgt op, verdwijnt in de verte,
// komt van de andere kant terug, landt en draait om. Dan begint het rondje opnieuw.
export function lijnvlucht() {
  const root = new THREE.Group(), F = FLIGHT;
  const a = root.userData.a = { type: 'rit', ride: 'lijnvlucht', seats: [], exit: [0, 0.2, 6], wacht: 'Wacht tot het vliegtuig weer klaarstaat aan het begin van de startbaan.' };
  const g = toestelVorm(a.seats); root.add(g);
  a.update = (t) => {
    const p = ((t % F.cyc) + F.cyc) % F.cyc;
    let x = 0, y = 0, kop = 0, neus = 0, zien = true;
    if (p < F.wacht) { /* staat klaar */ }
    else if (p < F.los) { const u = p - F.wacht; x = 1.1 * u * u; }                              // gas erop
    else if (p < F.weg) { const u = p - F.los; x = 110 + 22 * u; y = u < 2 ? 2 * u * u : 8 + 8 * (u - 2); neus = u < 2 ? 0.18 * u : 0.36; }
    else if (p < F.terug) zien = false;
    else if (p < F.grond) { const u = F.grond - p; x = 130 + 26 * u; y = 7 * u; kop = Math.PI; neus = 0.12; }      // de daling
    else if (p < F.stil) { const u = p - F.grond; x = 130 - (26 * u - 1.3 * u * u); kop = Math.PI; }                // uitrollen
    else { const u = (p - F.stil) / (F.cyc - F.stil); kop = Math.PI * (1 - u * u * (3 - 2 * u)); }               // omdraaien
    g.visible = zien;
    g.position.set(x, y, 0); g.rotation.set(0, kop, 0); g.rotateZ(neus);
  };
  a.pickSeat = () => Math.floor(Math.random() * a.seats.length);
  a.seatYaw = Math.PI / 2;             // je zit met je neus in de vliegrichting
  a.canBoard = (t) => (((t % F.cyc) + F.cyc) % F.cyc) < F.wacht - 2;
  a.endTime = (t) => t - (((t % F.cyc) + F.cyc) % F.cyc) + F.weg - 0.4;
  return root;
}

export function buildCity(kind) { return kind === 'stoplicht' ? stoplicht() : toestel(); }
