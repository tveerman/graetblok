// Gedeelde constanten voor client en server.
// Deze map (src/shared) bevat GEEN browser- of three.js-code, zodat de server
// later ook buiten de browser (bijv. in Node.js) kan draaien.

export const CS = 16;          // chunk-breedte (x en z)
export const CH = 128;         // chunk-hoogte (y)
export const CHUNK_VOL = CS * CS * CH;
export const SEA = 40;         // zeeniveau

// index in de blokken-array van een chunk
export const idx = (x, y, z) => (x << 11) | (z << 7) | y;

// unieke sleutel voor een chunk
export const chunkKey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

export const DAY_LENGTH = 720;  // seconden voor een hele dag
export const TICK_MS = 50;      // server tick (20 Hz)
export const REACH = 5.5;       // hoe ver je blokken kunt raken

export const PLAYER_W = 0.6;
export const PLAYER_H = 1.8;
export const EYE = 1.62;

export const INV_SIZE = 36;
export const HOTBAR = 9;

// Rangen (deel 8 van het ontwerp)
export const RANKS = [
  { name: 'Beginner', level: 1 },
  { name: 'Leerling', level: 3 },
  { name: 'Avonturier', level: 6 },
  { name: 'Ridder', level: 10 },
  { name: 'Meester', level: 14 },
  { name: 'Legende', level: 18 },
  { name: 'Drakenmeester', level: 22 },
  { name: 'Goddelijke krijger', level: 26 },
];
export const SECRET_RANK = 'Hoeder van Graet';

export const xpForLevel = (level) => Math.floor(30 * Math.pow(level, 1.6));

export function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Dag en nacht. t = 0 zonsopkomst, DAY_FRAC = zonsondergang, 1 = weer zonsopkomst.
export const DAY_FRAC = 0.62;
export function dayPhase(time) { return (time % DAY_LENGTH) / DAY_LENGTH; }
export function isNight(time) { const t = dayPhase(time); return t > DAY_FRAC + 0.02 || t < 0.0; }
// hoek van de zon: 0 = opkomst, PI/2 = middag, PI = ondergang, daarna onder de horizon
export function sunAngle(t) {
  return t < DAY_FRAC ? (t / DAY_FRAC) * Math.PI : Math.PI + ((t - DAY_FRAC) / (1 - DAY_FRAC)) * Math.PI;
}
export const xpNeed = (level) => Math.floor(20 + 8 * Math.pow(level, 1.4));
