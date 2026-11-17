// Test voor de blok-nummers boven de 255 (zie de uitleg bovenaan src/shared/blocks.js).
// Draaien:  node tests/blok-ids.mjs
// De test maakt een wereld in het geheugen, maakt en plaatst het proefblok (nummer 1024),
// slaat op, start de server opnieuw op dezelfde opslag en kijkt of alles er nog staat.
import assert from 'node:assert/strict';
import { GameServer } from '../src/server/server.js';
import { MemoryStorage } from '../src/server/storage.js';
import { B, BLOCKS, NUM_BLOCKS, ITEM_BASE, BLOCK2_BASE, B_SOLID, B_OPAQUE, B_SIDE, isBlock, tileId } from '../src/shared/blocks.js';
import { I, ITEMS, RECIPES, itemName, maxStack } from '../src/shared/items.js';
import { chunkKey, idx, CHUNK_VOL } from '../src/shared/constants.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let stap = 0;
const ok = (wat) => console.log('  ok ' + (++stap) + ' - ' + wat);

async function start(storage) {
  const S = new GameServer(storage);
  await S.init();
  clearInterval(S.timer);
  const out = [];
  const conn = { send(m) { out.push(m); }, onmessage: null };
  S.connect(conn);
  conn.onmessage({ t: 'hello', name: 'Tester', view: 2, debug: true });
  await wait(400);
  const p = [...S.players.values()][0];
  assert.ok(p, 'de speler is binnen');
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { S.last -= 50; S.tick(); } };
  conn.onmessage({ t: 'move', x: p.x, y: p.y, z: p.z, yaw: 0, pitch: 0 });      // nu weet de server welke chunks je wilt zien
  tick(30);
  return { S, conn, out, p, w: S.worlds[p.world], tick };
}
const count = (p, id) => p.inv.reduce((n, s) => n + (s && s.id === id ? s.n : 0), 0);

// ---- 1. de nummers zelf ----
const ROOD = B.beton_rood;
assert.equal(ROOD, 1024);
assert.equal(BLOCK2_BASE, 1024); assert.equal(ITEM_BASE, 256); assert.ok(NUM_BLOCKS > 1024);
assert.ok(isBlock(1) && isBlock(255) && isBlock(1024) && isBlock(NUM_BLOCKS - 1));
assert.ok(!isBlock(0) && !isBlock(256) && !isBlock(1023) && !isBlock(NUM_BLOCKS));
for (const id in ITEMS) assert.ok(!isBlock(Number(id)) && !BLOCKS[id], 'voorwerp ' + id + ' botst niet met een blok');
BLOCKS.forEach((b, id) => { assert.equal(b.id, id); assert.ok(id === 0 || isBlock(id), 'blok ' + id); });
assert.equal(B.steen, 3); assert.equal(B.klimaatmachine, 253); assert.equal(I.stok, 256);      // oude nummers staan vast
assert.equal(B_SOLID[ROOD], 1); assert.equal(B_OPAQUE[ROOD], 1); assert.equal(B_SIDE[ROOD], tileId('beton_rood'));
assert.equal(itemName(ROOD), 'Rood beton'); assert.equal(maxStack(ROOD), 64); assert.equal(itemName(I.stok), 'Stok');
ok('nummers: blokken 1..255 en 1024.., voorwerpen 256..1023, niets verschoven');

// ---- 2. maken, plaatsen, opslaan ----
const storage = new MemoryStorage();
let g = await start(storage);
let { S, conn, out, p, w } = g;
const chunkMsg = out.find((m) => m.t === 'chunk');
assert.ok(chunkMsg && chunkMsg.b instanceof Uint16Array && chunkMsg.b.length === CHUNK_VOL, 'een chunk gaat als Uint16Array naar het scherm');
assert.ok(w.chunk(0, 0) instanceof Uint16Array);
ok('chunks zijn Uint16Array, op de server en in het bericht naar het scherm');

const px = Math.floor(p.x), pz = Math.floor(p.z);
const bx = px + 2, bz = pz, by = w.topY(bx, bz) + 1;         // een vrij plekje naast de speler
const ox = px - 2, oz = pz, oy = w.topY(ox, oz) + 1;         // en een voor een "oud" blok
S.setBlock(w, px, w.topY(px, pz + 2) + 1, pz + 2, B.werkbank);
p.inv.fill(null);
S.give(p, B.beton, 4); S.give(p, B.bloem_rood, 1); S.give(p, B.planken, 1);
const rec = RECIPES.find((r) => r.out === ROOD);
assert.ok(rec, 'er is een recept voor rood beton');
conn.onmessage({ t: 'craft', id: rec.id });
assert.equal(count(p, ROOD), 4, 'het recept geeft vier rood beton');
assert.equal(count(p, B.beton), 0);
ok('recept: 4 beton + 1 rode bloem -> 4 rood beton');

p.sel = p.inv.findIndex((s) => s && s.id === ROOD);
out.length = 0;
conn.onmessage({ t: 'place', x: bx, y: by, z: bz });
assert.equal(w.get(bx, by, bz), ROOD, 'het blok staat in de wereld');
assert.equal(count(p, ROOD), 3);
assert.ok(out.some((m) => m.t === 'block' && m.id === ROOD && m.x === bx && m.y === by && m.z === bz), 'het scherm hoort het nieuwe blok');
p.sel = p.inv.findIndex((s) => s && s.id === B.planken);
conn.onmessage({ t: 'place', x: ox, y: oy, z: oz });
assert.equal(w.get(ox, oy, oz), B.planken);
ok('plaatsen: blok 1024 staat in de wereld en het scherm krijgt het te horen');

await S.save();
const key = 'e/' + w.id + '/' + chunkKey(bx >> 4, bz >> 4);
const saved = new Map(storage.m.get(key));
assert.equal(saved.get(idx(bx & 15, by, bz & 15)), ROOD, 'in de opslag staat nummer 1024');
const savedOld = new Map(storage.m.get('e/' + w.id + '/' + chunkKey(ox >> 4, oz >> 4)));
assert.equal(savedOld.get(idx(ox & 15, oy, oz & 15)), B.planken, 'oude nummers staan er ongewijzigd in');
ok('opslaan: de bewerking staat als index -> 1024 in de opslag, oude nummers ongewijzigd');

// ---- 3. opnieuw starten op dezelfde opslag ----
g = await start(storage); ({ S, conn, out, p, w } = g);
assert.equal(w.get(bx, by, bz), ROOD, 'na herstarten staat het blok er nog');
assert.equal(w.get(ox, oy, oz), B.planken);
assert.equal(count(p, ROOD), 3, 'de rugzak onthoudt de blokken met nummer 1024');
const cm = out.find((m) => m.t === 'chunk' && m.cx === (bx >> 4) && m.cz === (bz >> 4));
assert.ok(cm, 'de chunk met het blok is naar het scherm gestuurd');
assert.equal(cm.b[idx(bx & 15, by, bz & 15)], ROOD, 'en daarin staat 1024 (in 8 bits zou dat 0 zijn)');
ok('herladen: blok, rugzak en chunk-bericht kloppen na een herstart');

// ---- 4. hakken ----
p.sel = p.inv.findIndex((s) => !s);
conn.onmessage({ t: 'break', x: bx, y: by, z: bz });
assert.equal(w.get(bx, by, bz), 0, 'het blok is weg');
assert.equal(count(p, ROOD), 4, 'en zit weer in de rugzak');
await S.save();
g = await start(storage); ({ S, p, w } = g);
assert.equal(w.get(bx, by, bz), 0);
assert.equal(count(p, ROOD), 4);
ok('hakken: het blok komt terug in de rugzak en blijft weg na een herstart');

// ---- 5. een voorwerp kun je niet als blok neerzetten ----
p.inv.fill(null); S.give(p, I.stok, 1); p.sel = p.inv.findIndex((s) => s && s.id === I.stok);
g.conn.onmessage({ t: 'place', x: bx, y: by, z: bz });
assert.equal(w.get(bx, by, bz), 0);
ok('een voorwerp (256..1023) wordt geen blok');

console.log('Alles goed: ' + stap + ' stappen.');
process.exit(0);
