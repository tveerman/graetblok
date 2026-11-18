// Landen en koninkrijken: de wereld is verdeeld in koninkrijken, elk met een naam, een vorst
// en een vlag in twee kleuren. Elk goed kasteel hoort bij het koninkrijk waar het in ligt.
import { B } from './blocks.js';
import { hash2 } from './noise.js';

export const KINGDOM_CELL = 1344;       // zo groot is één koninkrijk (zes vakken van een dorp)
// de eerste vijf namen komen van Jorians lijst
const NAMEN = ['Westoria', 'Drakonia', 'Frostheim', 'Ironhold', 'Eldoria', 'Zonnewoud', 'Stormhaven', 'Goudmark', 'Zilvermeer', 'Hooglanden', 'Vlamrijk', 'Sterrendal'];
const VORSTEN = ['koning Alaric', 'koningin Isolde', 'koning Bram de Dappere', 'koningin Mira', 'koning Tobias', 'koningin Elin', 'koning Rogier', 'koningin Sterre', 'koning Wolf', 'koningin Aveline'];
// de kleuren van een vlag: [blok, naam]
export const VLAG_KLEUREN = [[B.wol_rood, 'rood'], [B.wol_blauw, 'blauw'], [B.wol_geel, 'geel'], [B.wol_groen, 'groen'], [B.wol_paars, 'paars'], [B.wol, 'wit'], [B.wol_zwart, 'zwart']];

export function kingdomAt(x, z, seed) {
  const kx = Math.floor((x + KINGDOM_CELL / 2) / KINGDOM_CELL), kz = Math.floor((z + KINGDOM_CELL / 2) / KINGDOM_CELL);
  const h = (n) => hash2(kx * 7 + n * 31 + 3, kz * 13 - n * 17 + 5, seed + 9100);
  // het koninkrijk rond het ruimteschip is altijd Westoria; verderop elke keer een andere naam
  const i = kx === 0 && kz === 0 ? 0 : 1 + Math.floor(h(1) * (NAMEN.length - 1));
  const ver = Math.max(Math.abs(kx), Math.abs(kz));
  const a = Math.floor(h(2) * VLAG_KLEUREN.length);
  let b = Math.floor(h(3) * VLAG_KLEUREN.length); if (b === a) b = (b + 1) % VLAG_KLEUREN.length;
  return { key: kx + ',' + kz, kx, kz, name: NAMEN[i] + (ver >= 2 ? ['', '-Noord', '-Oost', '-Zuid', '-West'][Math.floor(h(4) * 5)] : ''), vorst: VORSTEN[Math.floor(h(5) * VORSTEN.length)], vlag: [a, b] };
}

// De titels die je bij een vorst kunt verdienen, en wat je ervoor moet doen (in zijn rijk).
// soort: wat er geteld wordt; n: hoeveel; munten: de beloning.
export const ROYAL = [
  { titel: 'Schildknaap', tekst: 'Versla {n} monsters in mijn rijk', soort: 'versla', n: 8, munten: 20 },
  { titel: 'Ridder', tekst: 'Win het steekspel bij de toernooimeester op de binnenplaats', soort: 'steekspel', n: 1, munten: 30 },
  { titel: 'Baron', tekst: 'Bezoek {n} dorpen van mijn rijk', soort: 'dorp', n: 4, munten: 40 },
  { titel: 'Graaf', tekst: 'Win de boogschietwedstrijd bij de schietmeester', soort: 'boog', n: 1, munten: 50 },
  { titel: 'Hertog', tekst: 'Versla een Skeletkoning in een spookkasteel', soort: 'spook', n: 1, munten: 100 },
];
export const RANG0 = 'Vreemdeling';
// je eigen kasteel: wat elk level erbij krijgt, en wat het kost
export const KASTEEL_LEVELS = ['Een stenen woontoren', 'Een hogere toren met kantelen', 'Een ringmuur met een poort', 'Vier hoektorens', 'Lantaarns en banieren op de muur',
  'Een hogere muur met kantelen', 'Een groot poortgebouw', 'Een hoge burchttoren met een spits', 'Puntdaken op de hoektorens', 'Gouden randen: een paleis'];
export const kasteelPrijs = (level) => level * 60;         // wat het kost om naar dit level te gaan
