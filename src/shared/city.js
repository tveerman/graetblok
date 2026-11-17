// De Stad Van Wow en vliegveld Fintia: wat de server en het scherm allebei moeten weten.
import { MOBS } from './mobs.js';

// ---------- de stad ----------
// Alles is gemeten vanaf het midden van de stad. De vier wegen liggen als een hekje (#):
// twee van west naar oost en twee van noord naar zuid, op CITY_ROAD blokken van het midden.
export const CITY_HALF = 80;          // de stad is een vierkant van 2 x 80 blokken
export const CITY_ROAD = 28;          // zo ver ligt het midden van elke weg van het midden van de stad
export const CITY_LANE = 1.75;        // zo ver naast het midden van de weg rijden de auto's

// De stoplichten. Eén rondje duurt LIGHT_T tellen: eerst mag het verkeer langs de x-as
// (oost-west), dan dat langs de z-as (noord-zuid). 0 = rood, 1 = oranje, 2 = groen.
export const LIGHT_T = 24;
export function lightState(time, as) {
  let p = ((time % LIGHT_T) + LIGHT_T) % LIGHT_T;
  if (as === 'z') p = (p + LIGHT_T / 2) % LIGHT_T;
  return p < 9 ? 2 : p < 11 ? 1 : 0;
}

MOBS.stoplicht = { name: 'Stoplicht', model: 'stad', stad: 'stoplicht', hp: 1, speed: 0, w: 0.5, h: 4, ai: 'none', xp: 0, drops: [] };

// ---------- het vliegveld ----------
export const AIR_HALF = 84;
export const RUNWAY_Z = -46;          // het midden van de startbaan (die loopt van west naar oost)
export const FLIGHT_X = -66;          // hier staat het lijnvliegtuig te wachten
export const FLIGHT_PRICE = 5;        // zoveel munten kost een vlucht
// Een rondje van het lijnvliegtuig (in tellen): wachten, opstijgen, weg, en weer landen.
export const FLIGHT = { cyc: 60, wacht: 14, los: 24, weg: 31, terug: 40, grond: 44, stil: 54 };
export const GATES = 10;
export const gateX = (n) => -54 + (n - 1) * 12;      // waar gate n zit (n = 1..10)

// het lijnvliegtuig is voor het spel een attractie: je stapt in en vliegt mee
MOBS.lijnvlucht = { name: 'Lijnvliegtuig', model: 'attractie', ride: 'lijnvlucht', big: true, hp: 1, speed: 0, w: 9, h: 5, ai: 'none', tap: true, xp: 0, drops: [] };
// een vliegtuig dat bij een gate geparkeerd staat
MOBS.toestel = { name: 'Vliegtuig', model: 'stad', stad: 'toestel', big: true, hp: 1, speed: 0, w: 4, h: 5, ai: 'none', xp: 0, drops: [] };
