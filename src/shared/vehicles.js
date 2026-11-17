// Voertuigen: wat je kunt besturen naast een draak, een trein of een dier.
// Zowel de server (brandstof, schade, waar staat hij) als het scherm (hoe rijdt en hoe ziet
// hij eruit) gebruiken deze lijst.
import { MOBS } from './mobs.js';

// soort: 'weg' = rijdt over de grond, 'boot' = vaart op water, 'lucht' = vliegt
// max = topsnelheid (blokken per tel), acc = hoe snel hij optrekt, turn = hoe scherp hij stuurt,
// tank = hoeveel brandstof erin kan, zuinig = hoeveel blokken hij rijdt op één brandstof,
// open = je zit er bovenop (dan zie je jezelf zitten), anders zit je binnen.
// size = [breed, hoog, lang], seat = hoe hoog je zit, kleur = de lak, prijs = in munten.
export const VEHICLES = {
  auto: { name: 'Auto', soort: 'weg', max: 16, acc: 9, turn: 2.3, tank: 100, zuinig: 14, size: [1.5, 1.2, 2.9], seat: 0.55, kleur: 0xd8362c, prijs: 60, klasse: 'C' },
  terreinwagen: { name: 'Terreinwagen', soort: 'weg', max: 13, acc: 8, turn: 2.0, tank: 120, zuinig: 10, size: [1.7, 1.5, 3.0], seat: 0.8, kleur: 0x4a7a3a, prijs: 75, klasse: 'C', offroad: 1 },
  motor: { open: 1, name: 'Motor', soort: 'weg', max: 20, acc: 13, turn: 2.9, tank: 50, zuinig: 22, size: [0.6, 1.0, 1.9], seat: 0.75, kleur: 0x2a2e36, prijs: 45, klasse: 'B' },
  quad: { open: 1, name: 'Quad', soort: 'weg', max: 12, acc: 10, turn: 2.6, tank: 60, zuinig: 16, size: [1.1, 0.9, 1.7], seat: 0.7, kleur: 0xf0a020, prijs: 35, klasse: 'D', offroad: 1 },
  vrachtwagen: { name: 'Vrachtwagen', soort: 'weg', max: 11, acc: 5, turn: 1.5, tank: 200, zuinig: 7, size: [1.9, 2.3, 5.2], seat: 1.25, kleur: 0x2a6ad0, prijs: 90, klasse: 'D' },
  bus: { name: 'Bus', soort: 'weg', max: 11, acc: 5, turn: 1.5, tank: 200, zuinig: 8, size: [1.9, 2.3, 5.6], seat: 1.0, kleur: 0xf0c020, prijs: 90, klasse: 'D' },
  boot: { open: 1, name: 'Boot', soort: 'boot', max: 11, acc: 6, turn: 1.8, tank: 80, zuinig: 12, size: [1.6, 0.9, 3.4], seat: 0.35, kleur: 0xf4f4f0, prijs: 40, klasse: 'C' },
  helikopter: { name: 'Helikopter', soort: 'lucht', max: 16, acc: 6, turn: 2.0, tank: 150, zuinig: 9, size: [1.7, 1.9, 3.6], seat: 0.8, kleur: 0x1c2028, prijs: 160, klasse: 'A' },
};
export const VEHICLE_ORDER = ['auto', 'terreinwagen', 'motor', 'quad', 'vrachtwagen', 'bus', 'boot', 'helikopter'];

export const FUEL_PER_CAN = 50;       // zoveel brandstof zit er in één jerrycan

// voor de server en het scherm is een voertuig een wezen dat stilstaat tot iemand instapt
for (const k of VEHICLE_ORDER) {
  const V = VEHICLES[k];
  V.key = k; V.kind = 'v_' + k;
  MOBS[V.kind] = { name: V.name, model: 'voertuig', veh: k, hp: 1, speed: 0, w: Math.max(V.size[0], V.size[2] * 0.6), h: V.size[1], ai: 'none', tap: true, xp: 0, drops: [] };
}
