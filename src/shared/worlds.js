// De werelden van Graet Blok en hun levensbomen.
// Noord = -z, oost = +x.
import { SEA } from './constants.js';

export const WORLDS = {
  groen: {
    name: 'Groene natuurwereld',
    cycle: true,
    sky: { dayTop: 0x3f86e0, dayHor: 0xb5d8f5, nightTop: 0x05070f, nightHor: 0x121a30, duskHor: 0xf2a25c },
    minLight: 0.05, nightLight: 0.2,
    water: 0x2c62c0,
    tree: { key: 'groen', name: 'De Grote Levensboom', x: -230, z: -260, y: SEA + 8, guardian: 'drakenkoning', beam: 0x8dff7a },
    power: 'Levenskracht: je geneest heel snel.',
  },
  ijs: {
    name: 'IJs- en sneeuwwereld',
    cycle: true,
    sky: { dayTop: 0x6fa6d8, dayHor: 0xe4f1fa, nightTop: 0x070b18, nightHor: 0x1a2740, duskHor: 0xd9b6d0 },
    minLight: 0.06, nightLight: 0.22,
    water: 0x2a6fa8,
    tree: { key: 'ijs', name: 'De IJsboom', x: 190, z: -150, y: SEA + 2, guardian: 'ijsreus', beam: 0x9fe8ff },
    power: 'IJswind: je loopt sneller.',
  },
  vuur: {
    name: 'Vuur- en vulkaanwereld',
    cycle: false, fixedTime: 0.78,
    sky: { dayTop: 0x2a0d0a, dayHor: 0xa8431c, nightTop: 0x2a0d0a, nightHor: 0xa8431c, duskHor: 0xa8431c },
    minLight: 0.22, nightLight: 0.55,
    water: 0x2c62c0,
    tree: { key: 'vuur', name: 'De Vuurboom', x: -200, z: 170, y: 46, guardian: 'vuurtitaan', beam: 0xff8a3a },
    power: 'Vuurhuid: lava en vuur doen je geen pijn meer.',
  },
  schaduw: {
    name: 'Donkere schaduwwereld',
    cycle: false, fixedTime: 0.5,
    sky: { dayTop: 0x06030d, dayHor: 0x2a1445, nightTop: 0x06030d, nightHor: 0x2a1445, duskHor: 0x2a1445 },
    minLight: 0.13, nightLight: 0.3,
    water: 0x241a4a,
    tree: { key: 'schaduw', name: 'De Schaduwboom', x: 160, z: 200, y: 38, guardian: 'schaduwheer', beam: 0xb46bff },
    power: 'Nachtogen: je ziet beter in het donker.',
  },
  wolken: {
    name: 'Wolkenwereld',
    cycle: true,
    sky: { dayTop: 0x2f7fe6, dayHor: 0xcfe9ff, nightTop: 0x060a1c, nightHor: 0x1c2a4a, duskHor: 0xffc27a },
    minLight: 0.08, nightLight: 0.25,
    water: 0x2c62c0,
    tree: { key: 'wolken', name: 'De Hemelboom', x: 0, z: -260, y: 84, guardian: 'stormwachter', beam: 0xffe98a },
    power: 'Veervoet: je kunt hoger springen en vallen doet geen pijn.',
  },
};

export const WORLD_ORDER = ['groen', 'ijs', 'vuur', 'schaduw', 'wolken'];

// Vaste plekken in de groene wereld
export const CRASH = { x: 12, z: 8, y: SEA + 5 };
export const NEST_PEAK = { x: 130, z: -110, y: SEA + 44 };
export const SPAWN = { x: 0.5, z: -6.5 };
