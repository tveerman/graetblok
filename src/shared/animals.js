// Het Dierenrijk: alle dieren die je uit een ei kunt broeden, hun zeldzaamheid, de shiny-soorten
// en de eieren. Bedacht door Jorian (de nummers, zeldzaamheden en kansen komen uit zijn plan).
// Zowel de server (wie komt er uit het ei?) als het scherm (hoe ziet hij eruit?) gebruiken dit.
import { MOBS } from './mobs.js';

// De tien zeldzaamheden, met de kans in procenten dat een ei er zo een geeft.
export const RARITIES = [
  { key: 'common', name: 'Common', p: 40, col: '#c4ccd4' },
  { key: 'uncommon', name: 'Uncommon', p: 25, col: '#58c860' },
  { key: 'rare', name: 'Rare', p: 15, col: '#4a9cf0' },
  { key: 'epic', name: 'Epic', p: 9, col: '#b060f0' },
  { key: 'legendary', name: 'Legendary', p: 5, col: '#f5c93a' },
  { key: 'mythic', name: 'Mythic', p: 3, col: '#f060b0' },
  { key: 'ancient', name: 'Ancient', p: 1.5, col: '#e0803a' },
  { key: 'divine', name: 'Divine', p: 0.8, col: '#fff2a0' },
  { key: 'celestial', name: 'Celestial', p: 0.5, col: '#8af0ff' },
  { key: 'secret', name: 'Secret', p: 0.2, col: '#ff4a4a' },
];
export const RARITY = {};
RARITIES.forEach((r, i) => { r.i = i; RARITY[r.key] = r; });

// Shiny-dieren: los van de zeldzaamheid. De rest (91,5%) is gewoon.
// c = lijfkleur, c2 = buikkleur, e = de kleur waarin hij gloeit; regenboog heeft een rij kleuren.
export const SHINIES = [
  { key: 'golden', name: 'Golden', p: 5, c: 0xf5c93a, c2: 0xfff0a0, e: 0x8a6a10, col: '#f5c93a' },
  { key: 'rainbow', name: 'Rainbow', p: 2, c: 0xff5a5a, c2: 0xffffff, e: 0x503050, col: '#ff7ad0', row: [0xff5a5a, 0xffa53a, 0xffe14a, 0x5ad86a, 0x4aa8ff, 0xb46bff] },
  { key: 'diamond', name: 'Diamond', p: 1, c: 0x9fe8ff, c2: 0xffffff, e: 0x2a6a80, col: '#9fe8ff' },
  { key: 'shadow', name: 'Shadow', p: 0.5, c: 0x241a34, c2: 0x7a4dff, e: 0x3a1a70, col: '#9a6aff' },
];
export const SHINY = {};
for (const s of SHINIES) SHINY[s.key] = s;

// De eieren. prijs = in gouden munten, min = hoeveel minuten spelen het broeden duurt,
// luck = hoeveel groter de kans op iets zeldzaams is.
export const EGG_KINDS = {
  basis: { name: 'Basis-ei', prijs: 5, min: 1, luck: 1, c: '#f2ead8', c2: '#b89a6a', pat: 'vlek', hint: 'Gewone dieren: hond, kat, paard, olifant...' },
  bos: { name: 'Bosei', prijs: 10, min: 3, luck: 1, c: '#7ac058', c2: '#2f7a34', pat: 'blad', hint: 'Vogels, van kolibrie tot sterrenarend.' },
  oceaan: { name: 'Oceaanei', prijs: 25, min: 6, luck: 1.2, c: '#58b8e8', c2: '#f0f8ff', pat: 'golf', hint: 'Dieren van het water en reptielen.' },
  magisch: { name: 'Magisch ei', prijs: 40, min: 10, luck: 1.3, c: '#b070f0', c2: '#ffe680', pat: 'ster', hint: 'Fantasiedieren: eenhoorn, feniks, griffioen...' },
  oer: { name: 'Oer-ei', prijs: 60, min: 12, luck: 1.3, c: '#c8a070', c2: '#6a4a2a', pat: 'barst', hint: 'Dinosaurussen en andere oerdieren.' },
  sterren: { name: 'Sterrenei', prijs: 120, min: 15, luck: 1.6, c: '#1c2450', c2: '#fff6b0', pat: 'ster', hint: 'De zeldzaamste magische dieren.' },
};
export const EGG_ORDER = ['basis', 'bos', 'oceaan', 'magisch', 'oer', 'sterren'];

// ---------- de vormen ----------
// t: 'quad' = vier poten, 'vogel' = twee poten. body = [breed, hoog, lang], head = [breed, hoog, diep].
// Alles in blokken; s = hoe groot het hele dier wordt.
const P = {
  hond: { t: 'quad', body: [0.4, 0.4, 0.8], legH: 0.36, head: [0.36, 0.34, 0.34], snout: [0.2, 0.16, 0.2], ears: 'punt', tail: 'lang' },
  kat: { t: 'quad', body: [0.32, 0.32, 0.66], legH: 0.26, head: [0.32, 0.3, 0.28], snout: [0.14, 0.1, 0.08], ears: 'punt', tail: 'lang', s: 0.9 },
  paard: { t: 'quad', body: [0.5, 0.56, 1.2], legH: 0.76, legW: 0.15, neck: 0.5, head: [0.28, 0.3, 0.34], snout: [0.22, 0.2, 0.3], ears: 'punt', tail: 'pluim', ride: 1 },
  beer: { t: 'quad', body: [0.76, 0.7, 1.2], legH: 0.5, legW: 0.24, head: [0.5, 0.46, 0.44], snout: [0.24, 0.2, 0.2], ears: 'rond', tail: 'kort' },
  leeuw: { t: 'quad', body: [0.56, 0.54, 1.1], legH: 0.5, legW: 0.18, head: [0.44, 0.42, 0.4], snout: [0.24, 0.18, 0.16], ears: 'rond', tail: 'pluim' },
  hert: { t: 'quad', body: [0.44, 0.48, 1.0], legH: 0.7, legW: 0.12, neck: 0.4, head: [0.28, 0.28, 0.34], snout: [0.18, 0.14, 0.2], ears: 'punt', tail: 'kort' },
  konijn: { t: 'quad', body: [0.34, 0.34, 0.46], legH: 0.14, legW: 0.12, head: [0.3, 0.28, 0.28], ears: 'lang', tail: 'kort', s: 0.85 },
  muis: { t: 'quad', body: [0.24, 0.22, 0.36], legH: 0.08, legW: 0.08, head: [0.22, 0.2, 0.22], ears: 'rond', tail: 'lang', s: 0.7 },
  olifant: { t: 'quad', body: [1.0, 0.95, 1.5], legH: 0.72, legW: 0.3, head: [0.72, 0.7, 0.6], ears: 'flap', trunk: 1, tusks: 1, tail: 'lang', ride: 1 },
  schildpad: { t: 'quad', body: [0.6, 0.28, 0.8], legH: 0.14, legW: 0.16, head: [0.24, 0.2, 0.26], tail: 'kort', shell: 1, skin: 'schub' },
  krokodil: { t: 'quad', body: [0.5, 0.26, 1.3], legH: 0.14, legW: 0.14, head: [0.36, 0.2, 0.3], snout: [0.3, 0.14, 0.5], tail: 'dik', skin: 'schub' },
  zeehond: { t: 'quad', body: [0.5, 0.4, 1.0], legH: 0.08, legW: 0.2, head: [0.36, 0.34, 0.34], snout: [0.2, 0.14, 0.12], tail: 'kort', skin: 'glad' },
  vogel: { t: 'vogel', body: [0.28, 0.28, 0.42], legH: 0.16, legW: 0.05, head: [0.22, 0.22, 0.22], beak: 0xf0b030, wings: 1, tail: 'veer', fly: 1, s: 0.9 },
  roofvogel: { t: 'vogel', body: [0.36, 0.36, 0.56], legH: 0.2, legW: 0.07, head: [0.26, 0.26, 0.26], beak: 0xf0c040, wings: 1, wingSpan: 1.1, tail: 'veer', fly: 1 },
  uil: { t: 'vogel', body: [0.38, 0.44, 0.38], legH: 0.1, legW: 0.07, head: [0.4, 0.34, 0.32], beak: 0xe0b040, wings: 1, ears: 'punt', tail: 'veer', fly: 1 },
  loopvogel: { t: 'vogel', body: [0.4, 0.4, 0.6], legH: 0.8, legW: 0.07, neck: 0.6, head: [0.2, 0.2, 0.24], beak: 0xf0a030, beakL: 0.24, wings: 1, wingSpan: 0.5, tail: 'veer' },
  pinguin: { t: 'vogel', body: [0.4, 0.6, 0.36], legH: 0.08, legW: 0.1, head: [0.32, 0.28, 0.3], beak: 0xf0a030, wings: 1, wingSpan: 0.35, tail: 'kort', skin: 'glad' },
  dino2: { t: 'vogel', body: [0.6, 0.7, 1.3], legH: 0.8, legW: 0.22, head: [0.5, 0.5, 0.5], snout: [0.4, 0.34, 0.44], arms: 1, tail: 'dik', skin: 'schub' },
  dino4: { t: 'quad', body: [0.9, 0.8, 1.6], legH: 0.5, legW: 0.26, head: [0.46, 0.42, 0.5], snout: [0.34, 0.26, 0.3], tail: 'dik', skin: 'schub', ride: 1 },
};

// Elk dier: [nummer in Jorians lijst, sleutel, naam, zeldzaamheid, ei, vorm, kleur, tweede kleur, extra's]
// extra's: horn 'een'/'twee'/'gewei'/'drie', mane (manen), stripes/spots (kleur), wings (kleur),
// glow (gloeiende kleur), heads, tails, plates, crest, eye, en alles wat in de vorm staat.
const LIST = [
  // --- gewone dieren (basis-ei) ---
  [1, 'hond', 'Hond', 'common', 'basis', 'hond', 0x9a6a3c, 0xf0e0c0, { guard: 1 }],
  [2, 'kat', 'Kat', 'common', 'basis', 'kat', 0xe08a3a, 0xfff0e0, { stripes: 0xb05a1a }],
  [3, 'paard', 'Paard', 'common', 'basis', 'paard', 0x7a4a2a, 0x7a4a2a, { mane: 0x2a1a10 }],
  [7, 'konijn', 'Konijn', 'common', 'basis', 'konijn', 0xf4f0ea, 0xffffff, {}],
  [8, 'vos', 'Vos', 'common', 'basis', 'hond', 0xe0702a, 0xfff4e8, { tail: 'pluim', guard: 1 }],
  [11, 'panda', 'Panda', 'common', 'basis', 'beer', 0xf6f6f2, 0x1c1c20, { legC: 0x1c1c20, earC: 0x1c1c20, s: 0.8 }],
  [12, 'olifant', 'Olifant', 'common', 'basis', 'olifant', 0x8a8e96, 0x8a8e96, { guard: 1 }],
  [13, 'leeuw', 'Leeuw', 'common', 'basis', 'leeuw', 0xd8a85a, 0xf0d8a0, { mane: 0x8a5a24, guard: 1 }],
  [14, 'tijger', 'Tijger', 'common', 'basis', 'leeuw', 0xe8862a, 0xfff0d8, { stripes: 0x1c1410, guard: 1 }],
  [15, 'zebra', 'Zebra', 'common', 'basis', 'paard', 0xf4f4f0, 0xf4f4f0, { stripes: 0x1a1a1e, mane: 0x1a1a1e, s: 0.9 }],
  [16, 'giraf', 'Giraf', 'common', 'basis', 'paard', 0xe8c060, 0xf4e0a8, { spots: 0x9a5a24, neck: 1.5, legH: 1.1, horn: 'twee', s: 1.1 }],
  [21, 'egel', 'Egel', 'common', 'basis', 'muis', 0x8a6a4a, 0xe8d8b8, { plates: 0x4a3a2a, ears: '', tail: 'kort', s: 0.8 }],
  [31, 'kameel', 'Kameel', 'uncommon', 'basis', 'paard', 0xd8b070, 0xe8c890, { hump: 1, tail: 'lang' }],
  [201, 'muis', 'Muis', 'common', 'basis', 'muis', 0xb0a8a0, 0xf0d0d0, {}],
  [203, 'hamster', 'Hamster', 'common', 'basis', 'muis', 0xe8a850, 0xfff4e0, { tail: 'kort', s: 0.75 }],
  // --- vogels (bosei) ---
  [151, 'kolibrie', 'Kolibrie', 'common', 'bos', 'vogel', 0x2fc08a, 0xe84a6a, { beakL: 0.2, s: 0.55 }],
  [156, 'kraai', 'Kraai', 'common', 'bos', 'vogel', 0x1e1e26, 0x1e1e26, { beak: 0x2a2a30 }],
  [159, 'meeuw', 'Meeuw', 'common', 'bos', 'vogel', 0xf6f6f6, 0xb8c0c8, {}],
  [163, 'ooievaar', 'Ooievaar', 'common', 'bos', 'loopvogel', 0xf6f6f6, 0x1e1e26, { beak: 0xe8402a, legC: 0xe8402a }],
  [168, 'struisvogel', 'Struisvogel', 'common', 'bos', 'loopvogel', 0x2a2620, 0xf0e8e0, { legC: 0xe8c0b0, neckC: 0xe8c0b0, s: 1.3, ride: 1 }],
  [172, 'valk', 'Valk', 'common', 'bos', 'roofvogel', 0x8a6a4a, 0xf0e0c0, {}],
  [178, 'sneeuwuil', 'Sneeuwuil', 'uncommon', 'bos', 'uil', 0xf8f8f8, 0xd8dce0, { eye: '#f0c020' }],
  [182, 'ara', 'Ara', 'uncommon', 'bos', 'vogel', 0xe8302a, 0x2a6ae8, { wings: 0x2a6ae8, beak: 0x2a2a30, s: 1.0 }],
  [185, 'flamingo', 'Flamingo', 'uncommon', 'bos', 'loopvogel', 0xff8ab0, 0xffb8d0, { beak: 0x2a2a30, legC: 0xff8ab0 }],
  [45, 'uil', 'Uil', 'rare', 'bos', 'uil', 0x8a6a44, 0xe0c8a0, { eye: '#f0a020' }],
  [46, 'adelaar', 'Adelaar', 'rare', 'bos', 'roofvogel', 0x5a3a20, 0xf8f8f8, { headC: 0xf8f8f8, guard: 1, s: 1.15 }],
  [41, 'pauw', 'Pauw', 'rare', 'bos', 'loopvogel', 0x1a5ae0, 0x2ac08a, { legH: 0.4, neck: 0.4, wings: 0x2ac08a, tail: 'waaier', glow: 0x2ac08a }],
  [186, 'paradijsvogel', 'Paradijsvogel', 'rare', 'bos', 'vogel', 0xf0b020, 0x2a8a4a, { wings: 0xe84a2a, tail: 'waaier' }],
  [47, 'papegaai', 'Papegaai', 'epic', 'bos', 'vogel', 0x3ac040, 0xf0d020, { wings: 0x2a6ae8, beak: 0x4a4a50 }],
  [197, 'vuurvogel', 'Vuurvogel', 'epic', 'bos', 'roofvogel', 0xe8501a, 0xffc030, { wings: 0xffa020, glow: 0xff8a2a }],
  [198, 'kristalduif', 'Kristalduif', 'legendary', 'bos', 'vogel', 0xbff0ff, 0xffffff, { wings: 0x8ae0ff, glow: 0x9ff0ff, skin: 'glad' }],
  [199, 'dondervogel', 'Dondervogel', 'legendary', 'bos', 'roofvogel', 0x3a4a8a, 0xfff27a, { wings: 0x2a3a7a, glow: 0xfff27a, s: 1.3, guard: 1 }],
  [200, 'sterrenarend', 'Sterrenarend', 'mythic', 'bos', 'roofvogel', 0x1c2450, 0xfff6b0, { wings: 0x2a3470, glow: 0xfff6b0, headC: 0xfff6b0, s: 1.4, guard: 1 }],
  // --- water en reptielen (oceaanei) ---
  [44, 'pinguin', 'Pinguïn', 'rare', 'oceaan', 'pinguin', 0x1e2028, 0xf6f6f6, {}],
  [26, 'otter', 'Otter', 'uncommon', 'oceaan', 'kat', 0x6a4a30, 0xd8c0a0, { body: [0.3, 0.28, 0.8], ears: 'rond' }],
  [106, 'walrus', 'Walrus', 'common', 'oceaan', 'zeehond', 0x9a6a50, 0xb88a70, { tusks: 1, s: 1.3 }],
  [107, 'zeehond', 'Zeehond', 'common', 'oceaan', 'zeehond', 0x8a929c, 0xc8d0d8, {}],
  [113, 'zeeschildpad', 'Zeeschildpad', 'uncommon', 'oceaan', 'schildpad', 0x4aa870, 0xe8e0a0, { shellC: 0x2a6a4a }],
  [115, 'krab', 'Krab', 'uncommon', 'oceaan', 'schildpad', 0xe8402a, 0xf08a5a, { body: [0.7, 0.24, 0.5], shell: 0, claws: 1, tail: '', s: 0.7 }],
  [251, 'krokodil', 'Krokodil', 'common', 'oceaan', 'krokodil', 0x4a7a3a, 0xc8d090, { guard: 1 }],
  [254, 'kameleon', 'Kameleon', 'common', 'oceaan', 'krokodil', 0x5ac83a, 0xf0e040, { body: [0.3, 0.3, 0.6], snout: [0.16, 0.12, 0.14], tail: 'lang', crest: 1, s: 0.7 }],
  [258, 'schildpad', 'Schildpad', 'common', 'oceaan', 'schildpad', 0x7a9a4a, 0xd8d090, { shellC: 0x6a4a2a }],
  [269, 'kikker', 'Kikker', 'common', 'oceaan', 'muis', 0x4ac040, 0xe8f0a0, { skin: 'glad', ears: '', tail: '', body: [0.3, 0.2, 0.34], head: [0.3, 0.2, 0.22], eye: '#f0c020' }],
  [296, 'juweelschildpad', 'Juweelschildpad', 'legendary', 'oceaan', 'schildpad', 0x3ac0c8, 0xe8ffff, { shellC: 0xb05cf0, glow: 0xd8a8ff }],
  [300, 'fantoomsalamander', 'Fantoomsalamander', 'secret', 'oceaan', 'krokodil', 0xe8e0ff, 0x9a6aff, { body: [0.3, 0.22, 0.9], snout: [0.2, 0.1, 0.16], tail: 'lang', glow: 0xb48aff, skin: 'glad', s: 0.9 }],
  // --- fantasiedieren (magisch ei) ---
  [64, 'kristaleenhoorn', 'Kristaleenhoorn', 'epic', 'magisch', 'paard', 0xc8f4ff, 0xffffff, { horn: 'een', mane: 0x8ae0ff, glow: 0x9ff0ff, skin: 'glad' }],
  [65, 'maanpaard', 'Maanpaard', 'epic', 'magisch', 'paard', 0x3a4480, 0xd8e0ff, { mane: 0xd8e0ff, glow: 0xd8e0ff }],
  [67, 'feniks', 'Feniks', 'epic', 'magisch', 'roofvogel', 0xe8401a, 0xffc030, { wings: 0xff8a1a, tail: 'waaier', glow: 0xffa02a, s: 1.3, guard: 1 }],
  [68, 'babygriffioen', 'Babygriffioen', 'epic', 'magisch', 'leeuw', 0xd8a85a, 0xf8f8f8, { wings: 0xb88a4a, beak: 0xf0b030, headC: 0xf8f8f8, snout: 0, s: 0.8 }],
  [69, 'eenhoorn', 'Eenhoorn', 'epic', 'magisch', 'paard', 0xfafafa, 0xffffff, { horn: 'een', mane: 0xff9ad0, glow: 0xffe680 }],
  [70, 'pegasus', 'Pegasus', 'epic', 'magisch', 'paard', 0xfafafa, 0xe8f0ff, { wings: 0xf4f8ff, mane: 0xbcd8ff, fly: 1 }],
  [77, 'yeti', 'Yeti', 'legendary', 'magisch', 'beer', 0xf4f8fc, 0xc8e0f0, { headC: 0xc8e0f0, s: 1.3, guard: 1 }],
  [83, 'cerberus', 'Cerberus', 'legendary', 'magisch', 'hond', 0x1c1a20, 0x3a2a30, { heads: 3, eye: '#ff3020', glow: 0xff3020, s: 1.6, guard: 1 }],
  [84, 'kitsune', 'Kitsune', 'legendary', 'magisch', 'hond', 0xf4f0e8, 0xffffff, { tail: 'pluim', tails: 5, tipC: 0xe8502a, glow: 0xff8a4a, eye: '#e8502a' }],
  [87, 'sterrenwolf', 'Sterrenwolf', 'legendary', 'magisch', 'hond', 0x1c2450, 0x4a5aa0, { glow: 0xfff6b0, eye: '#fff6b0', spikes: 1, s: 1.2, guard: 1 }],
  [90, 'vuurwolf', 'Vuurwolf', 'legendary', 'magisch', 'hond', 0xc2331f, 0xf5a13a, { glow: 0xff8a2a, eye: '#ffe040', spikes: 1, s: 1.2, guard: 1 }],
  [92, 'donderleeuw', 'Donderleeuw', 'mythic', 'magisch', 'leeuw', 0xe8c832, 0xfff6b0, { mane: 0x4a5ad0, glow: 0xfff27a, eye: '#ffffff', s: 1.25, guard: 1 }],
  [94, 'droomhert', 'Droomhert', 'mythic', 'magisch', 'hert', 0xb8a0f0, 0xf0e8ff, { horn: 'gewei', glow: 0xffb0f0, hornC: 0xffb0f0 }],
  [96, 'magische_uil', 'Magische uil', 'mythic', 'magisch', 'uil', 0x5a3a9a, 0xd8c0ff, { wings: 0x7a4dff, glow: 0xffe680, eye: '#ffe680' }],
  [97, 'sterrenkat', 'Sterrenkat', 'ancient', 'magisch', 'kat', 0x241a4a, 0x6a5ac0, { glow: 0xfff6b0, eye: '#fff6b0', spikes: 1 }],
  [99, 'spookkonijn', 'Spookkonijn', 'ancient', 'magisch', 'konijn', 0xe8f4ff, 0xffffff, { glow: 0x9fe8ff, eye: '#4ae0ff', ghost: 1 }],
  [100, 'regenboogvos', 'Regenboogvos', 'secret', 'magisch', 'hond', 0xff5a5a, 0xffffff, { tail: 'pluim', rainbow: 1, glow: 0xffffff }],
  // --- dinosaurussen en oerdieren (oer-ei) ---
  [301, 'trex', 'T-rex', 'rare', 'oer', 'dino2', 0x6a7a3a, 0xc8c890, { s: 1.9, guard: 1, ride: 1 }],
  [302, 'velociraptor', 'Velociraptor', 'rare', 'oer', 'dino2', 0xa86a3a, 0xe8d0a0, { stripes: 0x5a3a20, s: 0.8, guard: 1, body: [0.4, 0.44, 1.0], legH: 0.6, head: [0.3, 0.3, 0.34], snout: [0.22, 0.18, 0.34] }],
  [303, 'triceratops', 'Triceratops', 'rare', 'oer', 'dino4', 0x8a7a5a, 0xd0c8a0, { horn: 'drie', s: 1.3, guard: 1 }],
  [304, 'stegosaurus', 'Stegosaurus', 'rare', 'oer', 'dino4', 0x5a8a4a, 0xc8d890, { plates: 0xe8802a, head: [0.3, 0.28, 0.4], s: 1.3 }],
  [305, 'brachiosaurus', 'Brachiosaurus', 'rare', 'oer', 'dino4', 0x5a8a9a, 0xb8d0d0, { neck: 2.2, legH: 1.0, head: [0.34, 0.3, 0.44], s: 1.8 }],
  [308, 'ankylosaurus', 'Ankylosaurus', 'rare', 'oer', 'dino4', 0x7a6a4a, 0xc8b890, { plates: 0x4a3a2a, shell: 1, shellC: 0x5a4a34, legH: 0.3, s: 1.1 }],
  [310, 'pteranodon', 'Pteranodon', 'rare', 'oer', 'roofvogel', 0x9a7a5a, 0xe0d0b0, { wings: 0xb8946a, wingSpan: 1.6, crest: 1, beakL: 0.4, skin: 'schub', s: 1.5, ride: 1 }],
  [329, 'mammoet', 'Mammoet', 'epic', 'oer', 'olifant', 0x6a4a30, 0x8a6a4a, { skin: 'vacht', s: 1.2, guard: 1 }],
  [330, 'sabeltandtijger', 'Sabeltandtijger', 'epic', 'oer', 'leeuw', 0xc89a5a, 0xf0e0c0, { tusks: 1, stripes: 0x8a6a34, guard: 1, s: 1.1 }],
  [335, 'oerdodo', 'Oerdodo', 'legendary', 'oer', 'pinguin', 0x8a8a94, 0xd8d8d0, { beak: 0xc8c040, beakL: 0.3, legH: 0.24, s: 1.1 }],
  [336, 'oerwolf', 'Oerwolf', 'legendary', 'oer', 'hond', 0x5a5a64, 0xb8b8c0, { s: 1.5, guard: 1, spikes: 1 }],
  [339, 'oerbeer', 'Oerbeer', 'legendary', 'oer', 'beer', 0x4a3424, 0x7a5a3a, { s: 1.5, guard: 1 }],
  [340, 'oerleeuw', 'Oerleeuw', 'legendary', 'oer', 'leeuw', 0xb88a4a, 0xe8d0a0, { mane: 0x4a3018, s: 1.4, guard: 1 }],
  [350, 'oergriffioen', 'Oergriffioen', 'secret', 'oer', 'leeuw', 0x7a5a34, 0xe8d8b0, { wings: 0x5a4024, beak: 0xc8a030, headC: 0xe8d8b0, snout: 0, glow: 0xffc040, s: 1.6, guard: 1, ride: 1, fly: 1 }],
  // --- magische en bijzondere dieren (sterrenei) ---
  [351, 'sterrenbeer', 'Sterrenbeer', 'epic', 'sterren', 'beer', 0x1c2450, 0x4a5aa0, { glow: 0xfff6b0, eye: '#fff6b0', guard: 1 }],
  [352, 'maankonijn', 'Maankonijn', 'epic', 'sterren', 'konijn', 0xd8e0ff, 0xffffff, { glow: 0xd8e0ff }],
  [354, 'regenboogpaard', 'Regenboogpaard', 'epic', 'sterren', 'paard', 0xfafafa, 0xffffff, { rainbow: 1, mane: 0xff5a9a }],
  [355, 'kristalhert', 'Kristalhert', 'epic', 'sterren', 'hert', 0x9fe8f0, 0xe8ffff, { horn: 'gewei', hornC: 0xd8a8ff, glow: 0xd8a8ff, skin: 'glad' }],
  [356, 'spookwolf', 'Spookwolf', 'epic', 'sterren', 'hond', 0xd8f0ff, 0xffffff, { ghost: 1, glow: 0x9fe8ff, eye: '#4ae0ff', guard: 1, s: 1.1 }],
  [358, 'lavakat', 'Lavakat', 'epic', 'sterren', 'kat', 0x2a1a18, 0xff6a1a, { stripes: 0xff6a1a, glow: 0xff8a2a, eye: '#ffe040' }],
  [361, 'wolkenolifant', 'Wolkenolifant', 'legendary', 'sterren', 'olifant', 0xf4f8ff, 0xcfe4ff, { wings: 0xffffff, s: 0.9, fly: 1 }],
  [364, 'gouden_feniks', 'Gouden feniks', 'legendary', 'sterren', 'roofvogel', 0xf5c93a, 0xfff0a0, { wings: 0xffd84a, tail: 'waaier', glow: 0xffe680, s: 1.4, guard: 1 }],
  [365, 'zilveren_griffioen', 'Zilveren griffioen', 'legendary', 'sterren', 'leeuw', 0xd8dce6, 0xffffff, { wings: 0xeef2fa, beak: 0xb8c0d0, snout: 0, s: 1.4, guard: 1, ride: 1, fly: 1 }],
  [372, 'mistkat', 'Mistkat', 'legendary', 'sterren', 'kat', 0xc8d0d8, 0xf0f4f8, { ghost: 1, eye: '#8af0c0' }],
  [386, 'ijsleeuw', 'IJsleeuw', 'mythic', 'sterren', 'leeuw', 0xbfe8ff, 0xffffff, { mane: 0x7fc4e8, glow: 0xcff4ff, eye: '#4ac8ff', s: 1.25, guard: 1 }],
  [389, 'schaduwleeuw', 'Schaduwleeuw', 'mythic', 'sterren', 'leeuw', 0x241a34, 0x3a2a55, { mane: 0x7a4dff, glow: 0xb46bff, eye: '#b46bff', s: 1.25, guard: 1 }],
  [391, 'tijdschildpad', 'Tijdschildpad', 'ancient', 'sterren', 'schildpad', 0xc8a030, 0xfff0a0, { shellC: 0x8a6a10, glow: 0xffe680, s: 1.4 }],
  [397, 'kristalolifant', 'Kristalolifant', 'divine', 'sterren', 'olifant', 0x9ff0ff, 0xe8ffff, { skin: 'glad', glow: 0xd8a8ff, s: 1.1, guard: 1 }],
  [398, 'gouden_eenhoorn', 'Gouden eenhoorn', 'divine', 'sterren', 'paard', 0xf5c93a, 0xfff0a0, { horn: 'een', mane: 0xffffff, glow: 0xffffff, s: 1.1 }],
  [399, 'eeuwige_draak', 'Eeuwige draak', 'celestial', 'sterren', 'dino4', 0x1c1a20, 0xd9a020, { wings: 0x3a2a10, horn: 'twee', hornC: 0xffd23a, glow: 0xffd23a, eye: '#ffd23a', neck: 0.6, spikes: 1, s: 1.6, guard: 1, fly: 1 }],
  [400, 'kosmische_feniks', 'Kosmische feniks', 'secret', 'sterren', 'roofvogel', 0x2a1a6a, 0xff7ad0, { wings: 0x6a3af0, tail: 'waaier', glow: 0xff9af0, eye: '#ffffff', s: 1.7, guard: 1 }],
];

export const ANIMALS = {};        // sleutel -> dier
export const ANIMAL_LIST = [];    // op nummer
for (const [nr, key, name, rarity, egg, shape, c, c2, extra] of LIST) {
  const spec = Object.assign({ c, c2 }, P[shape], extra);
  const s = spec.s || 1;
  const a = { nr, key, name, rarity, egg, spec, kind: 'd_' + key };
  ANIMALS[key] = a;
  ANIMAL_LIST.push(a);
  // voor de server en het scherm is elk dier een gewoon wezen, net als een schaap
  const tall = spec.legH + spec.body[1] + (spec.neck || 0) * 0.8 + spec.head[1] * 0.6;
  MOBS[a.kind] = {
    name, model: 'dier', animal: key, scale: s, ai: 'passive', pet: true, tap: true, xp: 0, drops: [],
    hp: Math.round(10 + s * 14 + RARITY[rarity].i * 4), speed: spec.t === 'vogel' ? 2.6 : 2.2 + Math.min(1.4, spec.legH * 1.6),
    w: Math.max(0.5, spec.body[0] * s), h: Math.max(0.5, tall * s),
  };
}
ANIMAL_LIST.sort((a, b) => a.nr - b.nr);

// welke dieren zitten er in welk ei
export const EGG_POOL = {};
for (const k of EGG_ORDER) EGG_POOL[k] = ANIMAL_LIST.filter((a) => a.egg === k);

// Kies wat er uit een ei komt. rnd = een functie die een getal tussen 0 en 1 geeft.
export function rollAnimal(eggKind, rnd) {
  const pool = EGG_POOL[eggKind] || EGG_POOL.basis, luck = (EGG_KINDS[eggKind] || EGG_KINDS.basis).luck;
  // Eerst de zeldzaamheid, met Jorians kansen. Een duurder ei geeft iets meer kans op
  // Legendary en hoger. Zit die zeldzaamheid niet in dit ei, dan wordt het de dichtstbijzijnde
  // lagere die er wel in zit: zo blijft zeldzaam ook echt zeldzaam.
  const wt = RARITIES.map((r) => r.p * (r.i >= 4 ? luck : 1));
  let x = rnd() * wt.reduce((s, v) => s + v, 0), got = 0;
  for (let i = 0; i < wt.length; i++) { x -= wt[i]; if (x <= 0) { got = i; break; } }
  const have = RARITIES.filter((r) => pool.some((a) => a.rarity === r.key));
  let pick = have[0];
  for (const r of have) if (r.i <= got) pick = r;
  const list = pool.filter((a) => a.rarity === pick.key);
  return list[Math.floor(rnd() * list.length) % list.length];
}

// Is het een shiny? Geeft '' of de sleutel van de shiny-soort.
export function rollShiny(rnd) {
  let x = rnd() * 100;
  for (const s of SHINIES) { x -= s.p; if (x <= 0) return s.key; }
  return '';
}

// Beloningen voor het Dierenboek: bij zoveel verschillende dieren krijg je munten en een titel.
export const ZOO_REWARDS = [
  { n: 5, munten: 10, titel: 'Beginner Collector' },
  { n: 10, munten: 25, titel: 'Animal Lover' },
  { n: 25, munten: 60, titel: 'Great Collector' },
  { n: 40, munten: 120, titel: 'Master Collector' },
  { n: 60, munten: 250, titel: 'Legendary Collector' },
  { n: 75, munten: 400, titel: 'Mythical Collector' },
  { n: ANIMAL_LIST.length, munten: 1000, titel: 'Ultimate Collector' },
];
export function zooTitle(n) { let t = ''; for (const r of ZOO_REWARDS) if (n >= r.n) t = r.titel; return t; }

export const MAX_OUT = 4;         // zoveel dieren kunnen tegelijk buiten het boek rondlopen
