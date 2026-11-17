// De Stad Van Wow en vliegveld Fintia.
// cityGen: hoe de stad en het vliegveld in de wereld worden gebouwd (hoort bij de wereldbouwer).
// cityMethods: het verkeer, de stoplichten en de lijnvlucht (hoort bij de server).
import { CH } from '../shared/constants.js';
import { hash2, hash3 } from '../shared/noise.js';
import { B, bedFoot, bedHead } from '../shared/blocks.js';
import { I } from '../shared/items.js';
import { CITY_HALF, CITY_ROAD, CITY_LANE, lightState, AIR_HALF, RUNWAY_Z, FLIGHT_X, FLIGHT_PRICE, GATES, gateX } from '../shared/city.js';

const R = CITY_ROAD;
// de winkels aan de ringweg: [x0, z0, kant van de deur, beroep, kleur van de lichtreclame]
const SHOPS = [
  [-21, 35, 'n', 'bakker', B.neon_geel], [3, 35, 'n', 'kok', B.neon_roze],
  [35, -21, 'w', 'winkelier', B.neon_blauw], [35, 3, 'w', 'juwelier', B.neon_roze],
  [-53, -21, 'e', 'monteur', B.neon_geel], [-53, 3, 'e', 'marktkoopman', B.neon_blauw],
];
// de gewone torens: [x0, z0] van elk gebouw van 19 bij 19
const TOWERS = [];
for (const bx of [-1, 1]) for (const bz of [-1, 1]) {
  if (bx === -1 && bz === 1) continue;                          // daar ligt het stadspark
  for (const a of [35, 59]) for (const b of [35, 59]) TOWERS.push([bx > 0 ? a : -a - 18, bz > 0 ? b : -b - 18]);
}
for (const a of [-21, 3]) { TOWERS.push([a, 59], [59, a], [-77, a]); }
const WALLS = [B.beton, B.baksteen, B.beton_donker, B.marmer, B.beton, B.baksteen, B.zilverblok];

// een rechthoekige toren met ramen; sommige ramen zijn verlicht
function tower(S, x0, z0, x1, z1, y, h, wall, seed, from = 2) {
  if (!S.hit(x0, z0, x1, z1)) return;
  S.fill(x0, y + 1, z0, x1, y + h, z1, wall);
  const win = (x, k, z, u) => {
    if (k < from || k >= h || (k & 3) < 2 || u % 3 === 0) return;
    S.set(x, y + k, z, hash3(x, k, z, seed) < 0.34 ? B.raam_licht : B.raam);
  };
  for (let k = from; k < h; k++) {
    for (let x = x0; x <= x1; x++) { win(x, k, z0, x - x0); win(x, k, z1, x - x0); }
    for (let z = z0; z <= z1; z++) { win(x0, k, z, z - z0); win(x1, k, z, z - z0); }
  }
}

// een boom voor in het park
function tree(S, x, y, z, h) {
  if (!S.hit(x - 2, z - 2, x + 2, z + 2)) return;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 2; dy++) {
    if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) * 1.3 > 3.4) continue;
    S.set(x + dx, y + h + dy, z + dz, B.blad_eik);
  }
  S.fill(x, y + 1, z, x, y + h, z, B.stam_eik);
}

export const cityGen = {

  // ---------- De Stad Van Wow ----------

  stadPlan(s) {
    const x = s.x, y = s.y + 1, z = s.z, npcs = [];
    // de winkeliers staan achter hun toonbank
    for (const [sx, sz, side, job] of SHOPS) {
      const mx = sx + 9, mz = sz + 9;
      const px = side === 'w' ? mx + 5 : side === 'e' ? mx - 5 : mx, pz = side === 'n' ? mz + 5 : mz;
      npcs.push({ k: 'dorpeling', job, x: x + px + 0.5, y, z: z + pz + 0.5, r: 0.4, yaw: side === 'n' ? Math.PI : side === 'w' ? -Math.PI / 2 : Math.PI / 2 });
    }
    npcs.push({ k: 'dorpeling', job: 'hotelier', x: x + 0.5, y, z: z - 52.5, r: 0.4, yaw: 0 });
    // wandelaars op het plein en in het park
    for (const [wx, wz] of [[-8, -8], [9, 6], [-6, 12], [12, -10], [-56, 50], [-50, 62]]) npcs.push({ k: 'dorpeling', job: 'dorpeling', x: x + wx + 0.5, y, z: z + wz + 0.5, r: 9, yaw: 0 });
    // stoplichten: twee per kruispunt, schuin tegenover elkaar
    for (const cx of [-R, R]) for (const cz of [-R, R]) for (const d of [-4, 4]) npcs.push({ k: 'stoplicht', x: x + cx + d + 0.5, y, z: z + cz + d + 0.5, r: 0, yaw: 0 });
    // het verkeer: de binnenste baan rijdt met de klok mee, de buitenste er tegenin
    const cars = [['v_auto', 0xd8362c, 0, 0.05], ['v_auto', 0xf0d020, 0, 0.4, 'Taxi'], ['v_auto', 0x2a6ad0, 0, 0.72], ['v_bus', 0xf0c020, 1, 0.1, 'Stadsbus'], ['v_auto', 0x3ab04a, 1, 0.45], ['v_vrachtwagen', 0x2a6ad0, 1, 0.8]];
    for (const [k, col, loop, f, name] of cars) {
      const hh = R + (loop ? CITY_LANE : -CITY_LANE);
      npcs.push({ k, x: x, y: y + 0.02, z: z, r: 0, yaw: 0, extra: { race: true, col, name: name || '', verkeer: { loop, s: f * 8 * hh, v: 0, len: k === 'v_auto' ? 3 : 6 } } });
    }
    return { npcs };
  },

  drawStad(S, s) {
    const X = s.x, y = s.y, Z = s.z, H = CITY_HALF;
    if (!S.hit(X - H, Z - H, X + H, Z + H)) return;
    const top = CH - 8 - y;                                     // hoger dan dit kan een gebouw niet worden
    // de grond: wegen, zebrapaden en stoepen
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
      const wx = S.ox + lx, wz = S.oz + lz, dx = wx - X, dz = wz - Z, ax = Math.abs(dx), az = Math.abs(dz);
      if (ax > H || az > H) continue;
      const rx = Math.abs(ax - R) <= 3, rz = Math.abs(az - R) <= 3;
      let id = B.stoep;
      if (rx && rz) id = B.asfalt;
      else if (rx) id = az === R - 5 || az === R - 4 || az === R + 4 || az === R + 5 ? B.zebrapad : ax === R && (dz & 3) < 2 ? B.asfalt_streep : B.asfalt;
      else if (rz) id = ax === R - 5 || ax === R - 4 || ax === R + 4 || ax === R + 5 ? B.zebrapad : az === R && (dx & 3) < 2 ? B.asfalt_streep : B.asfalt;
      else if (ax > H - 2 || az > H - 2) id = B.gras;
      S.set(wx, y, wz, id);
      S.fill(wx, y + 1, wz, wx, Math.min(CH - 1, y + 70), wz, 0);
    }
    // lantaarns langs de wegen
    for (let d = -72; d <= 72; d += 12) {
      if (Math.abs(Math.abs(d) - R) < 8) continue;
      for (const c of [-R - 5, -R + 5, R - 5, R + 5]) {
        S.fill(X + c, y + 1, Z + d, X + c, y + 3, Z + d, B.beton_donker); S.set(X + c, y + 4, Z + d, B.lantaarn);
        S.fill(X + d, y + 1, Z + c, X + d, y + 3, Z + c, B.beton_donker); S.set(X + d, y + 4, Z + c, B.lantaarn);
      }
    }
    // de torens
    TOWERS.forEach(([tx, tz], i) => {
      const far = Math.max(Math.abs(tx + 9), Math.abs(tz + 9)) > 60;
      const n = 3 + Math.floor(hash2(tx, tz, s.seed) * (far ? 4 : 7));
      const h = Math.min(top, n * 4 + 1), wall = WALLS[Math.floor(hash2(tz, tx, s.seed + 3) * WALLS.length)];
      const x0 = X + tx, z0 = Z + tz;
      tower(S, x0, z0, x0 + 18, z0 + 18, y, h, wall, s.seed + i);
      // op het dak: een rand, en soms een mast met een lichtje
      if (S.hit(x0, z0, x0 + 18, z0 + 18)) {
        S.fill(x0 + 1, y + h, z0 + 1, x0 + 17, y + h, z0 + 17, B.beton_donker);
        if (i % 3 === 0) { S.fill(x0 + 9, y + h + 1, z0 + 9, x0 + 9, y + h + 4, z0 + 9, B.ijzerblok); S.set(x0 + 9, y + h + 5, z0 + 9, [B.neon_roze, B.neon_blauw, B.neon_geel][(i / 3) % 3 | 0]); }
        else if (i % 3 === 1) S.fill(x0 + 6, y + h + 1, z0 + 6, x0 + 9, y + h + 2, z0 + 9, B.beton);
      }
    });
    // de winkels: een toren met beneden een winkel waar je in kunt
    SHOPS.forEach(([sx, sz, side, job, neon], i) => {
      const x0 = X + sx, z0 = Z + sz;
      if (!S.hit(x0 - 1, z0 - 1, x0 + 19, z0 + 19)) return;
      const h = Math.min(top, (2 + (i % 3)) * 4 + 5);
      tower(S, x0, z0, x0 + 18, z0 + 18, y, h, i & 1 ? B.baksteen : B.beton, s.seed + 50 + i, 6);
      S.fill(x0 + 1, y, z0 + 1, x0 + 17, y, z0 + 17, B.planken);
      S.fill(x0 + 1, y + 1, z0 + 1, x0 + 17, y + 4, z0 + 17, 0);
      // T: i loopt langs de gevel met de deur, j naar binnen
      const T = side === 'n' ? { X: (a, b) => x0 + a, Z: (a, b) => z0 + b } : side === 'w' ? { X: (a, b) => x0 + b, Z: (a) => z0 + a } : { X: (a, b) => x0 + 18 - b, Z: (a) => z0 + a };
      const set = (a, b, k, id) => S.set(T.X(a, b), y + k, T.Z(a, b), id);
      for (let a = 1; a <= 17; a++) {
        if (Math.abs(a - 9) <= 1) { for (let k = 1; k <= 3; k++) set(a, 0, k, 0); set(a, -1, 4, B.luifel); }      // de deur
        else if (a % 6 !== 0) { set(a, 0, 2, B.glas); set(a, 0, 3, B.glas); }                                     // de etalage
        set(a, 0, 5, neon);
      }
      for (let a = 3; a <= 15; a++) if (a !== 9) set(a, 12, 1, B.tafel);                                         // de toonbank
      for (const a of [4, 14]) for (const b of [5, 11]) set(a, b, 5, B.lamp);
      if (job === 'bakker') { set(2, 16, 1, B.oven); set(3, 16, 1, B.oven); set(15, 16, 1, B.hooi); }
      else if (job === 'kok') { for (const a of [3, 7, 11, 15]) for (const b of [4, 8]) { set(a, b, 1, B.tafel); set(a + 1, b, 1, B.kruk); set(a - 1, b, 1, B.kruk); } set(4, 16, 1, B.kookpot); set(14, 16, 1, B.oven); }
      else if (job === 'winkelier') { for (let a = 2; a <= 16; a++) { set(a, 17, 1, B.boekenkast); set(a, 17, 2, B.boekenkast); } }
      else if (job === 'juwelier') { for (const a of [3, 6, 12, 15]) set(a, 16, 1, a % 2 ? B.goudblok : B.zilverblok); }
      else if (job === 'monteur') { set(3, 4, 1, B.garage); set(5, 4, 1, B.werkbank); set(15, 16, 1, B.ijzerblok); }
      else { for (const a of [2, 3, 15, 16]) set(a, 16, 1, B.hooi); }
    });
    // de zilveren toren met het hotel, aan de noordkant van het plein
    if (S.hit(X - 13, Z - 67, X + 13, Z - 34)) {
      const f = Math.min(1, top / 64), h1 = Math.round(26 * f), h2 = h1 + Math.round(16 * f), h3 = h2 + Math.round(12 * f);
      tower(S, X - 12, Z - 66, X + 12, Z - 42, y, h1, B.zilverblok, s.seed + 90, 6);
      tower(S, X - 8, Z - 62, X + 8, Z - 46, y + h1 - 1, h2 - h1 + 1, B.zilverblok, s.seed + 91, 2);
      tower(S, X - 4, Z - 58, X + 4, Z - 50, y + h2 - 1, h3 - h2 + 1, B.zilverblok, s.seed + 92, 2);
      S.fill(X, y + h3 + 1, Z - 54, X, y + h3 + Math.round(8 * f), Z - 54, B.ijzerblok);
      S.set(X, y + h3 + Math.round(8 * f) + 1, Z - 54, B.neon_blauw);
      for (const [cx, cz] of [[-12, -66], [12, -66], [-12, -42], [12, -42]]) S.set(X + cx, y + h1 + 1, Z + cz, B.neon_blauw);
      // de hal van het hotel: bedden achterin, de balie in het midden
      S.fill(X - 11, y, Z - 65, X + 11, y, Z - 43, B.marmer);
      S.fill(X - 11, y + 1, Z - 65, X + 11, y + 4, Z - 43, 0);
      for (let a = -1; a <= 1; a++) { S.fill(X + a, y + 1, Z - 42, X + a, y + 3, Z - 42, 0); S.set(X + a, y + 4, Z - 41, B.luifel); }
      for (let a = -11; a <= 11; a++) { if (Math.abs(a) > 1 && a % 4) { S.set(X + a, y + 2, Z - 42, B.glas); S.set(X + a, y + 3, Z - 42, B.glas); } S.set(X + a, y + 5, Z - 42, B.neon_blauw); }
      for (const a of [-10, -6, 5, 9]) { S.set(X + a, y + 1, Z - 64, bedFoot(0)); S.set(X + a + 1, y + 1, Z - 64, bedHead(0)); S.set(X + a, y + 1, Z - 60, bedFoot(0)); S.set(X + a + 1, y + 1, Z - 60, bedHead(0)); }
      S.fill(X - 3, y + 1, Z - 50, X + 3, y + 1, Z - 50, B.tafel);
      for (const a of [-7, 7]) for (const b of [-48, -58]) S.set(X + a, y + 5, Z + b, B.lamp);
      for (const a of [-18, -15, 15, 18]) { S.set(X + a, y, Z - 38, B.gras); S.set(X + a, y + 1, Z - 38, a & 1 ? B.bloem_rood : B.bloem_geel); }
    }
    // het plein in het midden: een fontein, bloemperken en bankjes
    if (S.hit(X - 22, Z - 22, X + 22, Z + 22)) {
      for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > 5.4) continue;
        if (d > 4.3) S.set(X + dx, y + 1, Z + dz, B.marmer); else { S.set(X + dx, y, Z + dz, B.marmer); S.set(X + dx, y + 1, Z + dz, B.water); }
      }
      S.fill(X, y + 1, Z, X, y + 4, Z, B.zilverblok); S.set(X, y + 5, Z, B.lamp);
      for (const cx of [-15, 15]) for (const cz of [-15, 15]) {
        for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
          S.set(X + cx + dx, y, Z + cz + dz, B.gras);
          if ((dx + dz) & 1 && Math.abs(dx) < 3 && Math.abs(dz) < 3) S.set(X + cx + dx, y + 1, Z + cz + dz, [B.bloem_rood, B.bloem_geel, B.bloem_blauw][(dx + dz + 12) % 3]);
        }
        S.fill(X + cx, y + 1, Z + cz, X + cx, y + 3, Z + cz, B.beton_donker); S.set(X + cx, y + 4, Z + cz, B.lantaarn);
      }
      for (const d of [-9, 9]) { S.fill(X + d, y + 1, Z - 2, X + d, y + 1, Z + 2, B.kruk); S.fill(X - 2, y + 1, Z + d, X + 2, y + 1, Z + d, B.kruk); }
    }
    // het stadspark in de zuidwesthoek: gras, een vijver, bomen en bloemen
    if (S.hit(X - 78, Z + 34, X - 34, Z + 78)) {
      const px = X - 56, pz = Z + 56;
      for (let dx = -22; dx <= 22; dx++) for (let dz = -22; dz <= 22; dz++) {
        const wx = px + dx, wz = pz + dz, d = Math.hypot(dx, dz), path = Math.abs(dx) <= 1 || Math.abs(dz) <= 1;
        if (d < 5.5) { S.set(wx, y, wz, B.water); continue; }
        if (d < 7 || (path && d >= 7)) { S.set(wx, y, wz, B.stoep); continue; }
        S.set(wx, y, wz, B.gras);
        const r = hash2(wx, wz, s.seed + 9);
        if (r < 0.07) S.set(wx, y + 1, wz, r < 0.025 ? B.bloem_rood : r < 0.05 ? B.bloem_geel : B.bloem_blauw);
      }
      for (const [tx, tz, th] of [[-15, -15, 5], [15, -15, 6], [-15, 15, 6], [15, 15, 5], [-17, -5, 4], [17, 6, 4], [-6, 17, 5], [7, -17, 5]]) tree(S, px + tx, y, pz + tz, th);
      for (const [bx, bz] of [[-8, 3], [8, -3], [3, 8], [-3, -8]]) S.set(px + bx, y + 1, pz + bz, B.kruk);
      for (const [lx, lz] of [[-9, -9], [9, 9], [-9, 9], [9, -9]]) { S.fill(px + lx, y + 1, pz + lz, px + lx, y + 3, pz + lz, B.beton_donker); S.set(px + lx, y + 4, pz + lz, B.lantaarn); }
    }
  },

  // ---------- vliegveld Fintia ----------

  luchthavenPlan(s) {
    const x = s.x, y = s.y + 1, z = s.z, npcs = [];
    npcs.push({ k: 'lijnvlucht', x: x + FLIGHT_X + 0.5, y, z: z + RUNWAY_Z + 0.5, r: 0, yaw: 0 });
    for (const n of [2, 5, 9]) npcs.push({ k: 'toestel', x: x + gateX(n) + 0.5, y, z: z - 9.5, r: 0, yaw: 0 });
    npcs.push({ k: 'dorpeling', job: 'baliemedewerker', x: x - 9.5, y, z: z + 25.5, r: 0.4, yaw: Math.PI });
    npcs.push({ k: 'dorpeling', job: 'piloot', x: x + 10.5, y, z: z + 25.5, r: 0.4, yaw: Math.PI });
    npcs.push({ k: 'dorpeling', job: 'monteur', x: x - 70.5, y, z: z + 24.5, r: 0.4, yaw: Math.PI });
    for (const [wx, wz] of [[-30, 18], [28, 17], [0, 15], [44, 22]]) npcs.push({ k: 'dorpeling', job: 'dorpeling', x: x + wx + 0.5, y, z: z + wz + 0.5, r: 6, yaw: 0 });
    return { npcs };
  },

  drawLuchthaven(S, s) {
    const X = s.x, y = s.y, Z = s.z, H = AIR_HALF;
    if (!S.hit(X - H, Z - H, X + H, Z + H)) return;
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
      const wx = S.ox + lx, wz = S.oz + lz, dx = wx - X, dz = wz - Z;
      if (Math.abs(dx) > H || Math.abs(dz) > H) continue;
      let id = 0;
      const rz = dz - RUNWAY_Z;
      if (Math.abs(rz) <= 6 && Math.abs(dx) <= 80) {
        // de startbaan, met een stippellijn en dikke strepen aan de uiteinden
        id = Math.abs(dx) >= 74 && Math.abs(dx) <= 77 && Math.abs(rz) <= 4 && (rz & 1) === 0 ? B.zebrapad : rz === 0 && (dx & 7) < 4 && Math.abs(dx) < 72 ? B.asfalt_streep : B.asfalt;
      } else if (Math.abs(rz) === 7 && Math.abs(dx) <= 80 && (dx & 7) === 0) id = B.lamp;       // de lichten langs de baan
      else if (dz > RUNWAY_Z + 7 && dz <= 9 && Math.abs(dx) <= 72) id = dz <= -21 ? (dz === -30 && (dx & 3) < 2 ? B.asfalt_streep : B.asfalt) : B.beton;
      else if (dz >= 31 && Math.abs(dx) <= 3) id = dx === 0 && (dz & 3) < 2 ? B.asfalt_streep : B.asfalt;      // de weg naar de ingang
      if (id) S.set(wx, y, wz, id);
      S.fill(wx, y + 1, wz, wx, Math.min(CH - 1, y + 40), wz, 0);
    }
    // de terminal: een lange hal met tien gates aan de kant van het platform
    if (S.hit(X - 62, Z + 4, X + 62, Z + 30)) {
      S.fill(X - 62, y, Z + 10, X + 62, y, Z + 30, B.marmer);
      S.fill(X - 62, y + 1, Z + 10, X + 62, y + 8, Z + 30, B.beton);
      S.fill(X - 61, y + 1, Z + 11, X + 61, y + 7, Z + 29, 0);
      S.fill(X - 62, y + 9, Z + 10, X + 62, y + 9, Z + 30, B.beton_donker);
      for (let dx = -61; dx <= 61; dx++) {
        if (dx % 6) for (const dz of [10, 30]) S.fill(X + dx, y + 5, Z + dz, X + dx, y + 7, Z + dz, B.raam);
        S.set(X + dx, y + 8, Z + 30, B.neon_blauw);
        if (dx % 10 === 0) for (const dz of [15, 25]) S.set(X + dx, y + 8, Z + dz, B.lamp);
      }
      for (let n = 1; n <= GATES; n++) {
        const gx = X + gateX(n);
        S.fill(gx - 1, y + 1, Z + 10, gx + 1, y + 3, Z + 10, 0);
        S.set(gx, y + 5, Z + 10, B['bord_' + n]);
        S.fill(gx - 1, y + 4, Z + 5, gx + 1, y + 4, Z + 9, B.luifel);                    // de slurf naar het vliegtuig
        for (const a of [-2, 2]) S.fill(gx + a, y + 1, Z + 5, gx + a, y + 3, Z + 5, B.ijzerblok);
        S.fill(gx - 2, y + 4, Z + 5, gx + 2, y + 4, Z + 5, B.ijzerblok);
        S.set(gx, y + 4, Z + 5, B['bord_' + n]);                                        // het nummer van de gate
        for (const a of [-3, 3]) S.fill(gx + a, y + 1, Z + 13, gx + a, y + 1, Z + 15, B.kruk);      // wachtstoelen
      }
      S.fill(X - 2, y + 1, Z + 30, X + 2, y + 4, Z + 30, 0);                              // de ingang
      for (let a = -3; a <= 3; a++) S.set(X + a, y + 5, Z + 31, B.luifel);
      S.fill(X - 13, y + 1, Z + 24, X - 6, y + 1, Z + 24, B.tafel);                      // de balie
      S.fill(X + 7, y + 1, Z + 24, X + 14, y + 1, Z + 24, B.tafel);
      S.set(X - 14, y + 2, Z + 29, B.neon_geel); S.set(X + 15, y + 2, Z + 29, B.neon_roze);
    }
    // de verkeerstoren
    if (S.hit(X + 72, Z + 8, X + 82, Z + 18)) {
      const th = Math.min(22, CH - 14 - y);
      S.fill(X + 75, y + 1, Z + 11, X + 79, y + th, Z + 15, B.beton);
      S.fill(X + 73, y + th + 1, Z + 9, X + 81, y + th + 1, Z + 17, B.beton_donker);
      S.fill(X + 73, y + th + 2, Z + 9, X + 81, y + th + 3, Z + 17, B.raam_licht);
      S.fill(X + 74, y + th + 2, Z + 10, X + 80, y + th + 3, Z + 16, B.beton);
      S.fill(X + 73, y + th + 4, Z + 9, X + 81, y + th + 4, Z + 17, B.beton_donker);
      S.fill(X + 77, y + th + 5, Z + 13, X + 77, y + th + 7, Z + 13, B.ijzerblok); S.set(X + 77, y + th + 8, Z + 13, B.neon_geel);
    }
    // de hangar met de monteur: open aan de kant van het platform
    if (S.hit(X - 82, Z + 10, X - 65, Z + 30)) {
      S.fill(X - 82, y, Z + 10, X - 65, y, Z + 30, B.beton);
      S.fill(X - 82, y + 1, Z + 10, X - 65, y + 8, Z + 30, B.ijzerblok);
      S.fill(X - 81, y + 1, Z + 10, X - 66, y + 7, Z + 29, 0);
      S.fill(X - 82, y + 9, Z + 10, X - 65, y + 9, Z + 30, B.zilverblok);
      S.set(X - 68, y + 1, Z + 27, B.garage); S.set(X - 70, y + 1, Z + 27, B.werkbank);
      for (const a of [-78, -69]) S.set(X + a, y + 8, Z + 20, B.lamp);
      for (let a = -81; a <= -66; a++) S.set(X + a, y + 8, Z + 10, B.neon_geel);
    }
  },
};

// ---------- het verkeer en de lijnvlucht (server) ----------

// waar is een auto die s blokken ver is op zijn rondje? hh = hoe ver de baan van het midden ligt
function loopPos(loop, s, hh) {
  const side = 2 * hh, L = 8 * hh;
  s = ((s % L) + L) % L;
  const seg = Math.min(3, Math.floor(s / side)), f = s - seg * side;
  // binnenste baan (0): noordkant naar het oosten, dan naar het zuiden, enzovoort; de buitenste andersom
  const C = loop === 0 ? [[-hh, -hh, 1, 0], [hh, -hh, 0, 1], [hh, hh, -1, 0], [-hh, hh, 0, -1]] : [[hh, -hh, -1, 0], [-hh, -hh, 0, 1], [-hh, hh, 1, 0], [hh, hh, 0, -1]];
  const [x0, z0, dx, dz] = C[seg];
  return { x: x0 + dx * f, z: z0 + dz * f, dx, dz, rest: side - f };
}

export const cityMethods = {

  updateTraffic(dt) {
    for (const wid in this.worlds) {
      const w = this.worlds[wid];
      for (const rec of w.pop.values()) {
        if (rec.site.kind !== 'stad') continue;
        const s = rec.site, cars = [];
        for (const id of rec.ids) { const e = w.ents.get(id); if (e && e.verkeer) cars.push(e); }
        for (const e of cars) {
          const c = e.verkeer, hh = R + (c.loop ? CITY_LANE : -CITY_LANE), L = 8 * hh;
          const q = loopPos(c.loop, c.s, hh);
          let want = c.len > 3 ? 5.5 : 7;
          // voor rood en oranje stoppen bij de streep (die ligt een eindje vóór de hoek)
          const line = hh - (R - 6.5) + c.len / 2;
          if (q.rest > line - 0.6 && q.rest < line + 10 && lightState(this.meta.time, q.dx ? 'x' : 'z') !== 2) want = Math.min(want, Math.max(0, (q.rest - line) * 1.4));
          // niet op de auto vóór je botsen
          for (const o of cars) {
            if (o === e || o.verkeer.loop !== c.loop) continue;
            const gap = ((o.verkeer.s - c.s) % L + L) % L - (c.len + o.verkeer.len) / 2;
            if (gap < 6) want = Math.min(want, Math.max(0, (gap - 1.5) * 1.6));
          }
          // en stoppen voor iemand die oversteekt
          const ax = s.x + q.x + q.dx * (c.len / 2 + 2.2), az = s.z + q.z + q.dz * (c.len / 2 + 2.2);
          for (const p of this.players.values()) if (p.world === wid && !p.dead && Math.abs(p.y - s.y - 1) < 3 && Math.hypot(p.x - ax, p.z - az) < 3) want = 0;
          c.v += Math.max(-14 * dt, Math.min(4 * dt, want - c.v));
          c.s = (c.s + c.v * dt) % L;
          const n = loopPos(c.loop, c.s, hh);
          e.x = s.x + n.x + 0.5; e.z = s.z + n.z + 0.5; e.y = s.y + 1.02; e.yaw = Math.atan2(n.dx, n.dz);
        }
      }
    }
  },

  // ---------- meevliegen met het lijnvliegtuig ----------

  // het dichtstbijzijnde andere vliegveld
  otherAirport(w, s) {
    if (s.dest !== undefined) return s.dest;
    let best = null, bd = 1e9;
    for (const t of w.gen.sitesNear(s.x, s.z, 2000)) {
      if (t.kind !== 'vliegveld' || t === s) continue;
      const d = Math.hypot(t.x - s.x, t.z - s.z);
      if (d < bd) { bd = d; best = t; }
    }
    s.dest = best;
    return best;
  },

  boardFlight(p, w, e) {
    if (this.count(p, I.munt) < FLIGHT_PRICE) { this.toast(p, 'Een vlucht kost ' + FLIGHT_PRICE + ' munten.', 'warn'); return false; }
    this.take(p, I.munt, FLIGHT_PRICE);
    this.sendInv(p);
    const rec = w.pop.get(e.site), dest = rec ? this.otherAirport(w, rec.site) : null;
    p.flight = { from: e.site, to: dest ? dest.key : '' };
    this.toast(p, dest ? '✈️ Riemen vast! We vliegen naar ' + dest.name + '.' : '✈️ Riemen vast! We maken een rondvlucht.', 'good');
    return true;
  },

  flightDone(p, e) {
    const f = p.flight, w = this.worlds[p.world];
    p.flight = null;
    if (!f) return;
    // meteen weer uitgestapt (het vliegtuig stond niet klaar): je krijgt je munten terug
    if (this.meta.time - (p.rideT || 0) < 8) { this.giveLoot(p, I.munt, FLIGHT_PRICE, true); return; }
    this.addXp(p, 6);
    const rec = w.pop.get(f.from), dest = rec ? this.otherAirport(w, rec.site) : null;
    if (!dest) { this.toast(p, 'Dat was een mooie rondvlucht! Verderop is nog geen ander vliegveld gevonden.', 'good'); return; }
    p.x = dest.x + gateX(3) + 0.5; p.y = dest.y + 1.2; p.z = dest.z + 2.5;
    this.send(p, { t: 'tp', x: p.x, y: p.y, z: p.z, fade: 'Je landt op ' + dest.name + '...' });
    this.toast(p, 'Welkom op ' + dest.name + '!', 'good');
  },
};
