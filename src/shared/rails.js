// Rails: hoe stukken spoor op elkaar aansluiten, en hoe een trein eroverheen rijdt.
// Deze regels worden gebruikt door de mesher (welk stuk rails teken ik?), door de speler
// (de trein die je bestuurt) en door de server (staat de trein wel op rails?).
//
// Richtingen: 0 = +x (oost), 1 = +z (zuid), 2 = -x (west), 3 = -z (noord).
import { B } from './blocks.js';

export const RAIL_DX = [1, 0, -1, 0], RAIL_DZ = [0, 1, 0, -1];
export const RAIL_YAW = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];      // kijkrichting van een model dat naar +z kijkt

// Hoe sluit de rails op (x, y, z) aan in elke richting?
// 0 = niet, 1 = vlak, 2 = omhoog (de buurman ligt een blok hoger), 3 = omlaag.
// get(x, y, z) geeft het blok op die plek. out = een rij van vier getallen.
export function railLinks(get, x, y, z, out) {
  const R = B.rails;
  for (let d = 0; d < 4; d++) {
    const nx = x + RAIL_DX[d], nz = z + RAIL_DZ[d];
    out[d] = get(nx, y, nz) === R ? 1 : get(nx, y + 1, nz) === R ? 2 : get(nx, y - 1, nz) === R ? 3 : 0;
  }
  return out;
}

// Welk stuk rails hoort hier? Geeft vorm * 4 + draaiing (kwartslagen).
// vorm: 0 = recht (langs x), 1 = bocht (van +x naar +z), 2 = helling (omhoog naar +x), 3 = kruising
export function railShape(L) {
  for (let d = 0; d < 4; d++) if (L[d] === 2) return 8 + d;
  const e = L[0] ? 1 : 0, s = L[1] ? 1 : 0, w = L[2] ? 1 : 0, n = L[3] ? 1 : 0;
  const cnt = e + s + w + n;
  if (cnt >= 3) return 12;
  if (cnt === 2) {
    if (e && w) return 0;
    if (s && n) return 1;
    if (e && s) return 4;
    if (s && w) return 5;
    if (w && n) return 6;
    return 7;                       // noord en oost
  }
  if (s || n) return 1;
  return 0;
}

// Naar welke kant loopt de helling omhoog? (-1 = dit stuk ligt vlak)
export function railRamp(L) {
  for (let d = 0; d < 4; d++) if (L[d] === 2) return d;
  return -1;
}

// De trein komt een stuk rails binnen terwijl hij richting d rijdt. Waar gaat hij eruit?
// steer: -1 = links, 1 = rechts, 0 = rechtdoor als dat kan. Geeft de richting, of -1 (doodlopend).
export function railExit(L, d, steer) {
  const straight = d, right = (d + 1) & 3, left = (d + 3) & 3;
  if (steer > 0 && L[right]) return right;
  if (steer < 0 && L[left]) return left;
  if (L[straight]) return straight;
  if (L[right]) return right;
  if (L[left]) return left;
  return -1;
}

// Waar is de trein precies? Hij rijdt door het blok (x, y, z): binnengekomen in richting din,
// eruit in richting dout, en is op t (0..1) van de weg. ramp = richting waarin dit stuk omhoog
// loopt (of -1). Vult out = [x, y, z, yaw].
export function railPos(x, y, z, din, dout, t, ramp, out) {
  const cx = x + 0.5, cz = z + 0.5;
  const ax = cx - RAIL_DX[din] * 0.5, az = cz - RAIL_DZ[din] * 0.5;       // waar hij binnenkomt
  const bx = cx + RAIL_DX[dout] * 0.5, bz = cz + RAIL_DZ[dout] * 0.5;     // waar hij eruit gaat
  const u = 1 - t;
  // een vloeiende boog van de ene rand via het midden naar de andere rand
  out[0] = u * u * ax + 2 * u * t * cx + t * t * bx;
  out[2] = u * u * az + 2 * u * t * cz + t * t * bz;
  let h = 0;
  if (ramp >= 0) h = ramp === din ? t : (ramp === ((din + 2) & 3) ? 1 - t : 0.5);
  out[1] = y + h;
  // de richting waarin hij kijkt: de raaklijn van de boog
  const tx = 2 * u * (cx - ax) + 2 * t * (bx - cx), tz = 2 * u * (cz - az) + 2 * t * (bz - cz);
  out[3] = Math.atan2(tx, tz);
  return out;
}

// Welke richting hoort bij een kijkrichting (yaw) van de trein?
export function railDirOf(yaw) { return (((1 - Math.round(yaw / (Math.PI / 2))) % 4) + 4) % 4; }

// Op welke hoogte liggen de rails in deze kolom, in de buurt van y? (-1 = geen rails)
export function railAt(get, x, y, z) {
  const R = B.rails, fy = Math.floor(y);
  if (get(x, fy, z) === R) return fy;
  if (get(x, fy - 1, z) === R) return fy - 1;
  if (get(x, fy + 1, z) === R) return fy + 1;
  return -1;
}

// Loop vanaf een stuk rails n blokken terug langs het spoor (tegen de rijrichting d in) en geef
// de punten waar het spoor langs komt: [[x, y, z], ...]. Zo weten de wagons waar ze moeten staan.
const _L = [0, 0, 0, 0];
export function railTrace(get, x, y, z, d, n) {
  const pts = [];
  let back = (d + 2) & 3;
  for (let i = 0; i < n; i++) {
    railLinks(get, x, y, z, _L);
    const ramp = railRamp(_L);
    pts.push([x + 0.5, y + (ramp >= 0 ? 0.5 : 0), z + 0.5]);
    const out = railExit(_L, back, 0);
    if (out < 0) break;
    const link = _L[out];
    x += RAIL_DX[out]; z += RAIL_DZ[out]; y += link === 2 ? 1 : link === 3 ? -1 : 0;
    back = out;
  }
  return pts;
}
