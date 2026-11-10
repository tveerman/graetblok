// Voorwerpen (alles met id >= 256) en recepten.
import { B, BLOCKS, LOGS, LEAVES } from './blocks.js';

export const ITEMS = {};   // id -> definitie
export const I = {};       // sleutel -> id

function item(id, key, name, p = {}) {
  ITEMS[id] = Object.assign({ id, key, name, stack: 64 }, p);
  I[key] = id;
}

const TIER_COL = { 1: '#b98a4e', 2: '#9a9a9a', 3: '#e4e4ea', 4: '#5fe3e8' };

// materialen
item(256, 'stok', 'Stok', { icon: ['stick'] });
item(257, 'steenkool', 'Steenkool', { icon: ['lump', '#2a2a2e'] });
item(258, 'ijzerstaaf', 'IJzerstaaf', { icon: ['ingot', '#d8d8de'] });
item(259, 'goudstaaf', 'Goudstaaf', { icon: ['ingot', '#f5c93a'] });
item(260, 'kristal', 'Kristal', { icon: ['gem', '#5fe3e8'] });
item(261, 'machineonderdeel', 'Machineonderdeel', { icon: ['gear', '#9fb0c0'] });
item(262, 'drakenschub', 'Drakenschub', { icon: ['scale', '#c2452f'] });
item(263, 'pijl', 'Pijl', { icon: ['arrow'] });
item(269, 'ijskristal', 'IJskristal', { icon: ['gem', '#bfefff'] });
item(270, 'vuurkristal', 'Vuurkristal', { icon: ['gem', '#ff6a2a'] });
item(271, 'schaduwkristal', 'Schaduwkristal', { icon: ['gem', '#9b4dff'] });
item(272, 'hemelkristal', 'Hemelkristal', { icon: ['gem', '#ffe98a'] });
item(273, 'drakenkroon', 'Kroon van de Drakenkoning', { icon: ['crown'], stack: 1 });

// eten
item(264, 'bessen', 'Bessen', { icon: ['berries'], food: 2 });
item(265, 'appel', 'Appel', { icon: ['apple'], food: 4 });
item(266, 'rauw_vlees', 'Rauw vlees', { icon: ['meat', '#d9606a'], food: 3 });
item(267, 'gebraden_vlees', 'Gebraden vlees', { icon: ['meat', '#9a5a2c'], food: 8 });
item(268, 'drankje', 'Genezend drankje', { icon: ['potion', '#ff4d7a'], food: 20, stack: 16 });

// gereedschap: tool = soort, tier = hoe goed, speed = hoe snel
const TOOLNAMES = { 1: 'Houten', 2: 'Stenen', 3: 'IJzeren', 4: 'Kristallen' };
const TKEY = { 1: 'hout', 2: 'steen', 3: 'ijzer', 4: 'kristal' };
const SPEED = { 1: 2, 2: 3.5, 3: 5.5, 4: 9 };
for (let t = 1; t <= 4; t++) {
  item(279 + t, 'houweel_' + TKEY[t], TOOLNAMES[t] + ' houweel', { icon: ['pick', TIER_COL[t]], tool: 'pick', tier: t, speed: SPEED[t], dmg: 1 + t, stack: 1 });
  item(283 + t, 'bijl_' + TKEY[t], TOOLNAMES[t] + ' bijl', { icon: ['axe', TIER_COL[t]], tool: 'axe', tier: t, speed: SPEED[t], dmg: 2 + t, stack: 1 });
  item(287 + t, 'zwaard_' + TKEY[t], (t === 4 ? 'Kristallen' : TOOLNAMES[t]) + ' zwaard', { icon: ['sword', TIER_COL[t]], dmg: [0, 4, 6, 8, 11][t], stack: 1, weapon: true });
}
item(292, 'drakenzwaard', 'Drakenzwaard', { icon: ['sword', '#ff5a2a', '#ffd23a'], dmg: 15, stack: 1, weapon: true });
item(293, 'boog', 'Boog', { icon: ['bow'], stack: 1, ranged: { proj: 'pijl', ammo: 263, dmg: 7, speed: 30, cd: 0.6, grav: 9 } });
item(294, 'toverstaf', 'Toverstaf', { icon: ['staff', '#b46bff'], stack: 1, ranged: { proj: 'magie', dmg: 9, speed: 24, cd: 0.7, grav: 0 } });
item(295, 'lasergeweer', 'Lasergeweer', { icon: ['laser'], stack: 1, ranged: { proj: 'laser', dmg: 6, speed: 60, cd: 0.25, grav: 0 } });
item(296, 'oerwapen', 'Het Oerwapen', { icon: ['oer'], dmg: 30, stack: 1, weapon: true, ranged: { proj: 'oer', dmg: 30, speed: 40, cd: 0.5, grav: 0 } });

// pantser: werkt vanzelf als het in je rugzak zit
item(300, 'harnas_ijzer', 'IJzeren harnas', { icon: ['armor', '#d8d8de'], armor: 0.25, stack: 1 });
item(301, 'harnas_kristal', 'Kristallen harnas', { icon: ['armor', '#5fe3e8'], armor: 0.4, stack: 1 });
item(302, 'drakenharnas', 'Drakenharnas', { icon: ['armor', '#c2452f'], armor: 0.55, stack: 1 });

// portaalkernen: neerzetten bouwt een portaal
item(310, 'kern_ijs', 'IJsportaalkern', { icon: ['core', '#9fe8ff'], portal: 'ijs', stack: 4 });
item(311, 'kern_vuur', 'Vuurportaalkern', { icon: ['core', '#ff6a2a'], portal: 'vuur', stack: 4 });
item(312, 'kern_schaduw', 'Schaduwportaalkern', { icon: ['core', '#9b4dff'], portal: 'schaduw', stack: 4 });
item(313, 'kern_wolken', 'Wolkenportaalkern', { icon: ['core', '#ffe98a'], portal: 'wolken', stack: 4 });

// trofeeën van de bewakers
item(320, 'ijshart', 'IJshart', { icon: ['heart', '#9fe8ff'], stack: 1 });
item(321, 'vuurhart', 'Vuurhart', { icon: ['heart', '#ff6a2a'], stack: 1 });
item(322, 'schaduwhart', 'Schaduwhart', { icon: ['heart', '#9b4dff'], stack: 1 });
item(323, 'hemelhart', 'Hemelhart', { icon: ['heart', '#ffe98a'], stack: 1 });

export const isBlock = (id) => id > 0 && id < 256;
export function itemName(id) {
  if (id < 256) return BLOCKS[id] ? BLOCKS[id].name : '?';
  return ITEMS[id] ? ITEMS[id].name : '?';
}
export function maxStack(id) {
  if (id < 256) return 64;
  return ITEMS[id] ? ITEMS[id].stack : 64;
}

// Groepen: recepten mogen "een stam" of "een blad" vragen.
export const GROUPS = {
  stam: LOGS,
  blad: LEAVES.concat([B.hoog_gras]),
};
export const GROUP_NAMES = { stam: 'Boomstam', blad: 'Bladeren' };

// Recepten. in: [[id of groep, aantal], ...]. station: '' (overal), 'werkbank' of 'oven'.
// needs: welke levensboom eerst hersteld moet zijn.
export const RECIPES = [];
function recipe(out, n, ins, station = '', needs = null) {
  RECIPES.push({ id: RECIPES.length, out, n, in: ins, station, needs });
}

recipe(B.planken, 4, [['stam', 1]]);
recipe(I.stok, 4, [[B.planken, 2]]);
recipe(B.werkbank, 1, [[B.planken, 4]]);
recipe(B.fakkel, 4, [[I.stok, 1], [I.steenkool, 1]]);
recipe(B.kampvuur, 1, [[I.stok, 3], ['stam', 2]]);

recipe(I.houweel_hout, 1, [[B.planken, 3], [I.stok, 2]], 'werkbank');
recipe(I.bijl_hout, 1, [[B.planken, 3], [I.stok, 2]], 'werkbank');
recipe(I.zwaard_hout, 1, [[B.planken, 2], [I.stok, 1]], 'werkbank');
recipe(I.houweel_steen, 1, [[B.keisteen, 3], [I.stok, 2]], 'werkbank');
recipe(I.bijl_steen, 1, [[B.keisteen, 3], [I.stok, 2]], 'werkbank');
recipe(I.zwaard_steen, 1, [[B.keisteen, 2], [I.stok, 1]], 'werkbank');
recipe(B.oven, 1, [[B.keisteen, 8]], 'werkbank');
recipe(B.bed, 1, [[B.planken, 3], ['blad', 4]], 'werkbank');
recipe(I.boog, 1, [[I.stok, 4], ['blad', 3]], 'werkbank');
recipe(I.pijl, 8, [[I.stok, 1], [B.keisteen, 1]], 'werkbank');
recipe(I.houweel_ijzer, 1, [[I.ijzerstaaf, 3], [I.stok, 2]], 'werkbank');
recipe(I.bijl_ijzer, 1, [[I.ijzerstaaf, 3], [I.stok, 2]], 'werkbank');
recipe(I.zwaard_ijzer, 1, [[I.ijzerstaaf, 2], [I.stok, 1]], 'werkbank');
recipe(I.harnas_ijzer, 1, [[I.ijzerstaaf, 6]], 'werkbank');
recipe(I.houweel_kristal, 1, [[I.kristal, 3], [I.stok, 2]], 'werkbank');
recipe(I.bijl_kristal, 1, [[I.kristal, 3], [I.stok, 2]], 'werkbank');
recipe(I.zwaard_kristal, 1, [[I.kristal, 2], [I.stok, 1]], 'werkbank');
recipe(I.harnas_kristal, 1, [[I.kristal, 6]], 'werkbank');
recipe(I.toverstaf, 1, [[I.stok, 2], [I.kristal, 1], [B.gloeikristal, 1]], 'werkbank');
recipe(I.lasergeweer, 1, [[I.machineonderdeel, 3], [I.ijzerstaaf, 2], [I.kristal, 1]], 'werkbank');
recipe(I.drankje, 1, [[I.bessen, 3], [B.gloeikristal, 1]], 'werkbank');
recipe(B.steenblok, 4, [[B.steen, 4]], 'werkbank');
recipe(B.lamp, 1, [[B.gloeikristal, 1], [B.glas, 1]], 'werkbank');
recipe(B.ijzerblok, 1, [[I.ijzerstaaf, 4]], 'werkbank');
recipe(B.goudblok, 1, [[I.goudstaaf, 4]], 'werkbank');
recipe(B.kristalblok, 1, [[I.kristal, 4]], 'werkbank');
recipe(B.ei_robot, 1, [[I.machineonderdeel, 4], [I.ijzerstaaf, 4], [I.kristal, 1]], 'werkbank');
recipe(I.drakenzwaard, 1, [[I.drakenschub, 3], [I.kristal, 2], [I.stok, 1]], 'werkbank');
recipe(I.drakenharnas, 1, [[I.drakenschub, 6], [I.goudstaaf, 2]], 'werkbank');

recipe(I.kern_ijs, 1, [[I.machineonderdeel, 2], [I.ijzerstaaf, 4], [B.gloeikristal, 2]], 'werkbank');
recipe(I.kern_vuur, 1, [[I.machineonderdeel, 2], [I.ijskristal, 4], [I.goudstaaf, 2]], 'werkbank', 'ijs');
recipe(I.kern_schaduw, 1, [[I.machineonderdeel, 2], [I.vuurkristal, 4], [I.kristal, 2]], 'werkbank', 'vuur');
recipe(I.kern_wolken, 1, [[I.machineonderdeel, 2], [I.schaduwkristal, 4], [I.goudstaaf, 2]], 'werkbank', 'schaduw');

recipe(I.ijzerstaaf, 1, [[B.ijzer_erts, 1], [I.steenkool, 1]], 'oven');
recipe(I.goudstaaf, 1, [[B.goud_erts, 1], [I.steenkool, 1]], 'oven');
recipe(B.glas, 2, [[B.zand, 2], [I.steenkool, 1]], 'oven');
recipe(B.steen, 2, [[B.keisteen, 2], [I.steenkool, 1]], 'oven');
recipe(B.baksteen, 4, [[B.aarde, 4], [I.steenkool, 1]], 'oven');
recipe(I.gebraden_vlees, 1, [[I.rauw_vlees, 1]], 'oven');

export function matches(need, id) {
  return typeof need === 'string' ? GROUPS[need].includes(id) : need === id;
}
