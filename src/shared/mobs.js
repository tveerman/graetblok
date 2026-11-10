// Monsters, dieren, bazen en draken.
import { I } from './items.js';
import { B } from './blocks.js';

// ai: 'passive' | 'melee' | 'ranged' | 'boss'
// drops: [itemId, min, max, kans]
export const MOBS = {
  pluizel: { name: 'Pluizel', model: 'pluizel', hp: 8, speed: 2.0, w: 0.6, h: 0.7, ai: 'passive', tame: I.bessen, xp: 2, drops: [] },
  hert: { name: 'Woudhert', model: 'hert', hp: 10, speed: 3.4, w: 0.8, h: 1.4, ai: 'passive', xp: 3, drops: [[I.rauw_vlees, 1, 2, 1]] },
  kruiper: { name: 'Schaduwkruiper', model: 'kruiper', hp: 16, dmg: 3, speed: 3.3, w: 0.8, h: 0.9, ai: 'melee', xp: 8, drops: [[I.steenkool, 1, 2, 0.6], [I.pijl, 1, 3, 0.4]] },
  golem: { name: 'Rotsgolem', model: 'golem', hp: 34, dmg: 5, speed: 1.9, w: 1.0, h: 2.1, ai: 'melee', xp: 16, drops: [[B.ijzer_erts, 1, 2, 0.8], [B.gloeikristal, 1, 1, 0.4]] },
  robotspin: { name: 'Robotspin', model: 'spin', hp: 18, dmg: 3, speed: 3.6, w: 0.9, h: 0.7, ai: 'melee', xp: 10, drops: [[I.machineonderdeel, 1, 1, 0.7]] },
  ijswolf: { name: 'IJswolf', model: 'wolf', hp: 20, dmg: 4, speed: 4.0, w: 0.8, h: 0.9, ai: 'melee', xp: 12, drops: [[I.rauw_vlees, 1, 1, 0.7], [I.ijskristal, 1, 1, 0.25]] },
  vuurgeest: { name: 'Vuurgeest', model: 'geest', tint: 0xff7a2a, hp: 18, dmg: 4, speed: 2.4, w: 0.7, h: 1.4, ai: 'ranged', proj: 'vuurbal', fly: true, xp: 14, drops: [[I.steenkool, 1, 3, 0.8], [I.vuurkristal, 1, 1, 0.25]] },
  schim: { name: 'Schim', model: 'geest', tint: 0x7a4dff, hp: 22, dmg: 5, speed: 2.8, w: 0.7, h: 1.4, ai: 'ranged', proj: 'schaduwbol', fly: true, xp: 16, drops: [[I.schaduwkristal, 1, 1, 0.3], [B.gloeikristal, 1, 1, 0.4]] },
  stormvleugel: { name: 'Stormvleugel', model: 'vleugel', hp: 20, dmg: 5, speed: 5.0, w: 1.0, h: 0.6, ai: 'melee', fly: true, xp: 16, drops: [[I.hemelkristal, 1, 1, 0.3], [I.pijl, 2, 4, 0.5]] },

  ijsreus: { name: 'IJsreus, bewaker van de IJsboom', model: 'golem', tint: 0x9fd8ff, scale: 2.6, hp: 160, dmg: 4, speed: 2.2, w: 2.2, h: 5.2, ai: 'boss', boss: 'ijs', proj: 'ijspegel', xp: 150,
    drops: [[I.ijshart, 1, 1, 1], [I.ijskristal, 6, 8, 1], [I.drakenschub, 2, 2, 1]] },
  vuurtitaan: { name: 'Vuurtitaan, bewaker van de Vuurboom', model: 'golem', tint: 0xff5a1a, scale: 2.8, hp: 230, dmg: 5, speed: 2.4, w: 2.4, h: 5.6, ai: 'boss', boss: 'vuur', proj: 'vuurbal', xp: 220,
    drops: [[I.vuurhart, 1, 1, 1], [I.vuurkristal, 6, 8, 1], [I.drakenschub, 3, 3, 1]] },
  schaduwheer: { name: 'Schaduwheer, bewaker van de Schaduwboom', model: 'geest', tint: 0x5a2ad0, scale: 2.8, hp: 280, dmg: 5, speed: 3.2, w: 1.8, h: 3.6, ai: 'boss', boss: 'schaduw', proj: 'schaduwbol', fly: true, xp: 300,
    drops: [[I.schaduwhart, 1, 1, 1], [I.schaduwkristal, 6, 8, 1], [I.drakenschub, 3, 3, 1]] },
  stormwachter: { name: 'Stormwachter, bewaker van de Hemelboom', model: 'vleugel', scale: 3.2, hp: 320, dmg: 6, speed: 7, w: 3.0, h: 1.8, ai: 'boss', boss: 'wolken', proj: 'bliksem', fly: true, xp: 380,
    drops: [[I.hemelhart, 1, 1, 1], [I.hemelkristal, 6, 8, 1], [I.drakenschub, 4, 4, 1]] },
  drakenkoning: { name: 'De Drakenkoning', model: 'draak', dragon: 'koning', scale: 3.0, hp: 520, dmg: 7, speed: 8, w: 4.0, h: 3.6, ai: 'boss', boss: 'groen', proj: 'drakenvuur', fly: true, xp: 800,
    drops: [[I.drakenkroon, 1, 1, 1], [I.drakenschub, 8, 8, 1], [B.ei_goud, 1, 1, 1]] },

  draak: { name: 'Draak', model: 'draak', hp: 60, speed: 6, w: 0.9, h: 0.9, ai: 'dragon', fly: true, xp: 0, drops: [] },

  // ---- kuddes: schapen, koeien, wolven en beren ----
  // herd: [min, max] = hoeveel dieren er samen rondlopen
  schaap: { name: 'Schaap', model: 'schaap', hp: 8, speed: 1.9, w: 0.8, h: 1.0, ai: 'passive', herd: [4, 7], tap: true, xp: 2, drops: [[B.wol, 1, 1, 1], [I.rauw_vlees, 1, 1, 0.6]] },
  koe: { name: 'Koe', model: 'koe', hp: 12, speed: 1.6, w: 0.9, h: 1.3, ai: 'passive', herd: [3, 5], tap: true, xp: 3, drops: [[I.rauw_vlees, 1, 3, 1], [I.leer, 1, 2, 0.9]] },
  wolf: { name: 'Wolf', model: 'grijzewolf', hp: 16, dmg: 3, speed: 4.3, w: 0.8, h: 0.9, ai: 'wolf', herd: [3, 5], xp: 9, drops: [[I.bot, 1, 1, 0.5], [I.leer, 1, 1, 0.4]] },
  beer: { name: 'Beer', model: 'beer', hp: 40, dmg: 6, speed: 3.5, w: 1.1, h: 1.4, ai: 'neutral', herd: [1, 2], xp: 18, drops: [[I.rauw_vlees, 2, 3, 1], [I.leer, 2, 3, 1]] },

  // ---- meer monsters ----
  spin: { name: 'Reuzenspin', model: 'reuzenspin', hp: 14, dmg: 3, speed: 4.4, w: 1.0, h: 0.7, ai: 'melee', leap: true, xp: 9, drops: [[I.draad, 1, 2, 0.9]] },
  skelet: { name: 'Skelet', model: 'skelet', hp: 18, dmg: 4, speed: 2.6, w: 0.6, h: 1.8, ai: 'ranged', proj: 'pijl', xp: 11, drops: [[I.bot, 1, 2, 0.9], [I.pijl, 1, 3, 0.6]] },

  // ---- wilde draken en de trein ----
  wildedraak: { name: 'Wilde draak', model: 'draak', scale: 1.5, hp: 90, dmg: 5, speed: 7, w: 2.0, h: 1.8, ai: 'wilddragon', fly: true, xp: 90, drops: [[I.drakenschub, 2, 3, 1], [I.munt, 4, 8, 0.8]] },
};

// De acht drakensoorten uit het ontwerp. Elke soort heeft een eigen kleur, een eigen vorm
// (zie models.js) en een eigen kracht:
//   breath = waarmee hij spuwt (zie BREATH), fly = hoe snel hij vliegt, hp = hoe sterk hij is.
export const DRAGONS = {
  vuur: { name: 'Vuurdraak', body: 0xc2331f, belly: 0xf5a13a, wing: 0x7a1a12, glow: 0xff8a2a, fly: 1.0, hp: 1.1,
    power: 'Spuwt grote vuurballen die ontploffen en alles in de buurt raken.' },
  ijs: { name: 'IJsdraak', body: 0x7fc4e8, belly: 0xe8f6ff, wing: 0x4a8fc0, glow: 0xcff4ff, fly: 0.95, hp: 1.2,
    power: 'Spuwt drie ijspegels tegelijk. Wie geraakt wordt, bevriest en loopt heel traag.' },
  natuur: { name: 'Natuurdraak', body: 0x3f9a3a, belly: 0xc9d96a, wing: 0x2a6a2c, glow: 0xa8ff5a, fly: 0.95, hp: 1.3,
    power: 'Spuwt gifwolken die blijven hangen, en geneest jou een beetje bij elke treffer.' },
  bliksem: { name: 'Bliksemdraak', body: 0xe8c832, belly: 0xfff6b0, wing: 0x5a6ad0, glow: 0xfff27a, fly: 1.35, hp: 0.9,
    power: 'De snelste draak. Zijn bliksem springt over naar drie vijanden.' },
  schaduw: { name: 'Schaduwdraak', body: 0x3a2a55, belly: 0x7a4dff, wing: 0x1c1230, glow: 0xb46bff, fly: 1.1, hp: 1.0,
    power: 'Zijn schaduwvlam vliegt dwars door vijanden heen en geeft jou hun kracht.' },
  robot: { name: 'Robotdraak', body: 0x8a96a4, belly: 0x4ae0ff, wing: 0x56606c, glow: 0x4ae0ff, fly: 1.2, hp: 1.4,
    power: 'Schiet razendsnel met twee lasers en kan heel goed tegen een stootje.' },
  goud: { name: 'Gouden draak', body: 0xe8b02a, belly: 0xfff0a0, wing: 0xb87a14, glow: 0xffe680, fly: 1.1, hp: 1.5,
    power: 'Spuwt gouden vuur. Monsters die hij verslaat laten gouden munten vallen.' },
  kristal: { name: 'Kristaldraak', body: 0x5fe3e8, belly: 0xe8ffff, wing: 0xb06ae8, glow: 0xd8a8ff, fly: 1.15, hp: 1.2,
    power: 'Schiet een waaier van vijf vlijmscherpe kristalscherven.' },
  koning: { name: 'De Drakenkoning', body: 0x2a1a22, belly: 0xd9a020, wing: 0x7a1420, glow: 0xff5a1a, fly: 1, hp: 1, power: '' },
};

// Waarmee elke soort spuwt. n = hoeveel tegelijk, spread = hoe wijd de waaier is, dmg = deel van
// de kracht per schot, aoe = straal van de ontploffing, slow/poison = hoe lang (tellen),
// chain = springt over naar zoveel vijanden, pierce = vliegt door zoveel vijanden heen,
// cd = tellen tussen twee keer spuwen als je op de draak zit.
export const BREATH = {
  vuur: { proj: 'drakenvuur', n: 1, spread: 0, speed: 27, dmg: 1.0, aoe: 3.6, cd: 0.55 },
  ijs: { proj: 'drakenijs', n: 3, spread: 0.07, speed: 33, dmg: 0.5, slow: 5, cd: 0.5 },
  natuur: { proj: 'drakengif', n: 1, spread: 0, speed: 23, dmg: 0.6, aoe: 2.8, poison: 6, heal: 1, cd: 0.6 },
  bliksem: { proj: 'drakenbliksem', n: 1, spread: 0, speed: 58, dmg: 0.9, chain: 3, cd: 0.42 },
  schaduw: { proj: 'schaduwvlam', n: 1, spread: 0, speed: 31, dmg: 0.9, pierce: 3, leech: 1, cd: 0.5 },
  robot: { proj: 'laser', n: 2, spread: 0.035, speed: 62, dmg: 0.45, cd: 0.2 },
  goud: { proj: 'goudvuur', n: 1, spread: 0, speed: 28, dmg: 1.1, aoe: 3.2, coins: 1, cd: 0.6 },
  kristal: { proj: 'kristalscherf', n: 5, spread: 0.09, speed: 35, dmg: 0.4, cd: 0.55 },
  koning: { proj: 'drakenvuur', n: 1, spread: 0, speed: 19, dmg: 1, aoe: 2.6, cd: 1 },
};

export const DRAGON_NAMES = ['Vlam', 'Vonk', 'Storm', 'Schub', 'Gloed', 'Nacht', 'Ster', 'Bliksem', 'Draco', 'Vuurtje', 'Klauw', 'Wolk', 'Zilver', 'Rook', 'Komeet', 'Smaragd'];

// groei: 0..100. baby < 30, jong < 100, volwassen = 100
export function dragonStage(growth) { return growth >= 100 ? 2 : (growth >= 30 ? 1 : 0); }
export const STAGE_NAMES = ['Babydraak', 'Jonge draak', 'Volwassen draak'];
export function dragonScale(growth) {
  const g = Math.min(100, growth);
  return 0.32 + (g / 100) * 0.95;
}

// projectielen
export const PROJ = {
  pijl: { color: 0xd8c9a0, size: 0.25, trail: false },
  magie: { color: 0xb46bff, size: 0.5, trail: true, glow: true },
  laser: { color: 0x4ae0ff, size: 0.35, trail: true, glow: true },
  oer: { color: 0xffffff, size: 0.8, trail: true, glow: true },
  vuurbal: { color: 0xff7a1a, size: 0.7, trail: true, glow: true },
  ijspegel: { color: 0xbfefff, size: 0.5, trail: true, glow: true },
  schaduwbol: { color: 0x7a3aff, size: 0.6, trail: true, glow: true },
  bliksem: { color: 0xfff6a0, size: 0.6, trail: true, glow: true },
  gifbol: { color: 0x7ae03a, size: 0.55, trail: true, glow: true },
  // de adem van draken: groter, met een dikke staart van vonken; blast = ontploft bij de inslag
  drakenvuur: { color: 0xff6a10, color2: 0xffe070, size: 1.4, trail: 3, glow: true, blast: 3.4, snd: 'explode' },
  drakenijs: { color: 0xbfefff, color2: 0xffffff, size: 0.7, trail: 2, glow: true, blast: 1.2, snd: 'ijs' },
  drakengif: { color: 0x7ae03a, color2: 0xd8ff7a, size: 1.0, trail: 2, glow: true, blast: 2.8, snd: 'gif', cloud: true },
  drakenbliksem: { color: 0xfff6a0, color2: 0xffffff, size: 0.9, trail: 3, glow: true, blast: 1.6, snd: 'zap' },
  schaduwvlam: { color: 0x9a4aff, color2: 0x2a1040, size: 1.1, trail: 3, glow: true, blast: 1.4, snd: 'boom' },
  goudvuur: { color: 0xffd23a, color2: 0xffffff, size: 1.3, trail: 3, glow: true, blast: 3.0, snd: 'explode' },
  kristalscherf: { color: 0x9ff0ff, color2: 0xd8a8ff, size: 0.5, trail: 1, glow: true, blast: 0.9, snd: 'ijs' },
};
