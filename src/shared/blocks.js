// Alle blokken van Graet Blok.
// shape: 0 = lucht, 1 = kubus, 2 = kruis (plantje/fakkel), 3 = vloeistof
// pass:  0 = dicht, 1 = met gaatjes (bladeren), 2 = doorzichtig (water, glas)

export const SHAPE_AIR = 0, SHAPE_CUBE = 1, SHAPE_CROSS = 2, SHAPE_LIQUID = 3;

export const BLOCKS = [];      // id -> definitie
export const B = {};           // sleutel -> id
export const TILE_NAMES = [];  // alle plaatjes die de atlas nodig heeft
const tileIndex = new Map();

function tile(name) {
  if (!tileIndex.has(name)) { tileIndex.set(name, TILE_NAMES.length); TILE_NAMES.push(name); }
  return tileIndex.get(name);
}
export const tileId = (name) => tile(name);

function def(id, key, name, p = {}) {
  const tiles = p.tiles || key;
  const t = Array.isArray(tiles) ? tiles : [tiles, tiles, tiles];
  const shape = p.shape === undefined ? SHAPE_CUBE : p.shape;
  const pass = p.pass || 0;
  const blk = {
    id, key, name,
    shape, pass,
    tTop: tile(t[0]), tSide: tile(t[1]), tBottom: tile(t[2]),
    solid: p.solid !== undefined ? p.solid : shape === SHAPE_CUBE,
    opaque: p.opaque !== undefined ? p.opaque : (shape === SHAPE_CUBE && pass === 0),
    light: p.light || 0,
    hard: p.hard === undefined ? 1 : p.hard,     // seconden met de hand
    tool: p.tool || null,                        // 'pick' of 'axe'
    tier: p.tier || 0,                           // welk gereedschap minimaal nodig is
    drop: p.drop,                                // undefined = zichzelf, null = niets, [id, min, max]
    xp: p.xp || 0,
    snd: p.snd || 'stone',
    interact: !!p.interact,
    replace: !!p.replace,                        // mag je er zomaar een blok overheen zetten?
    support: !!p.support,                        // valt om als het blok eronder weg is
    climb: !!p.climb,
  };
  BLOCKS[id] = blk;
  B[key] = id;
  return blk;
}

const CROSS = { shape: SHAPE_CROSS, pass: 1, solid: false, opaque: false, hard: 0.15, snd: 'leaf', support: true };
const LEAF = { pass: 1, opaque: false, hard: 0.3, snd: 'leaf', drop: null };
const LOG = { hard: 2.2, tool: 'axe', snd: 'wood' };

def(0, 'lucht', 'Lucht', { shape: SHAPE_AIR, solid: false, opaque: false, tiles: 'aarde', replace: true });
def(1, 'gras', 'Gras', { tiles: ['gras_top', 'gras_side', 'aarde'], hard: 0.7, snd: 'grass', drop: [2, 1, 1] });
def(2, 'aarde', 'Aarde', { hard: 0.6, snd: 'grass' });
def(3, 'steen', 'Steen', { hard: 4, tool: 'pick', tier: 1, drop: [5, 1, 1] });
def(4, 'zand', 'Zand', { hard: 0.6, snd: 'sand' });
def(5, 'keisteen', 'Keien', { hard: 4, tool: 'pick', tier: 1 });
def(6, 'water', 'Water', { shape: SHAPE_LIQUID, pass: 2, solid: false, opaque: false, hard: Infinity, replace: true });
def(7, 'lava', 'Lava', { shape: SHAPE_LIQUID, pass: 0, solid: false, opaque: false, hard: Infinity, replace: true, light: 13 });
def(8, 'stam_eik', 'Eikenstam', { ...LOG, tiles: ['stam_eik_top', 'stam_eik', 'stam_eik_top'] });
def(9, 'blad_eik', 'Eikenblad', { ...LEAF });
def(10, 'stam_den', 'Dennenstam', { ...LOG, tiles: ['stam_den_top', 'stam_den', 'stam_den_top'] });
def(11, 'blad_den', 'Dennennaalden', { ...LEAF });
def(12, 'stam_berk', 'Berkenstam', { ...LOG, tiles: ['stam_berk_top', 'stam_berk', 'stam_berk_top'] });
def(13, 'blad_berk', 'Berkenblad', { ...LEAF });
def(14, 'planken', 'Planken', { hard: 1.6, tool: 'axe', snd: 'wood' });
def(15, 'steenkool_erts', 'Steenkoolerts', { hard: 4.5, tool: 'pick', tier: 1, drop: [257, 1, 2], xp: 2 });
def(16, 'ijzer_erts', 'IJzererts', { hard: 5, tool: 'pick', tier: 2, xp: 3 });
def(17, 'goud_erts', 'Gouderts', { hard: 5, tool: 'pick', tier: 3, xp: 5 });
def(18, 'kristal_erts', 'Kristalerts', { hard: 6, tool: 'pick', tier: 3, drop: [260, 1, 2], xp: 8 });
def(19, 'gloeikristal', 'Gloeikristal', { hard: 2, tool: 'pick', light: 11, snd: 'glass', xp: 2 });
def(20, 'sneeuw', 'Sneeuw', { hard: 0.5, snd: 'snow' });
def(21, 'ijs', 'IJs', { hard: 1.5, tool: 'pick', snd: 'glass' });
def(22, 'basalt', 'Basalt', { hard: 4.5, tool: 'pick', tier: 1 });
def(23, 'as', 'As', { hard: 0.6, snd: 'sand' });
def(24, 'obsidiaan', 'Obsidiaan', { hard: 14, tool: 'pick', tier: 4 });
def(25, 'magmasteen', 'Magmasteen', { hard: 4.5, tool: 'pick', tier: 1, light: 6 });
def(26, 'schaduwsteen', 'Schaduwsteen', { hard: 4.5, tool: 'pick', tier: 1 });
def(27, 'schaduwgras', 'Schaduwgras', { tiles: ['schaduwgras_top', 'schaduwgras_side', 'schaduwsteen'], hard: 1, snd: 'grass' });
def(28, 'gloeipaddenstoel', 'Gloeipaddenstoel', { ...CROSS, light: 9 });
def(29, 'wolk', 'Wolk', { hard: 0.4, snd: 'snow' });
def(30, 'hemelgras', 'Hemelgras', { tiles: ['hemelgras_top', 'hemelgras_side', 'hemelsteen'], hard: 0.8, snd: 'grass' });
def(31, 'hemelsteen', 'Hemelsteen', { hard: 3.5, tool: 'pick', tier: 1 });
def(32, 'werkbank', 'Werkbank', { tiles: ['werkbank_top', 'werkbank_side', 'planken'], hard: 1.6, tool: 'axe', snd: 'wood', interact: true });
def(33, 'oven', 'Oven', { tiles: ['oven_top', 'oven_side', 'oven_top'], hard: 4, tool: 'pick', interact: true, light: 7 });
def(34, 'fakkel', 'Fakkel', { ...CROSS, light: 14, snd: 'wood' });
def(35, 'kampvuur', 'Kampvuur', { ...CROSS, light: 15, hard: 0.6, snd: 'wood' });
def(36, 'bed', 'Bed', { tiles: ['bed_top', 'bed_side', 'planken'], hard: 0.8, snd: 'wood', interact: true });
def(37, 'glas', 'Glas', { pass: 2, opaque: false, hard: 0.5, snd: 'glass' });
def(38, 'baksteen', 'Bakstenen', { hard: 4, tool: 'pick', tier: 1 });
def(39, 'steenblok', 'Steenblokken', { hard: 4, tool: 'pick', tier: 1 });
def(40, 'schatkist', 'Schatkist', { tiles: ['schatkist_top', 'schatkist_side', 'planken'], hard: Infinity, snd: 'wood', interact: true });
def(41, 'schatkist_open', 'Lege kist', { tiles: ['schatkist_open_top', 'schatkist_side', 'planken'], hard: 1.5, tool: 'axe', snd: 'wood' });
def(42, 'drakennest', 'Drakennest', { hard: 1, snd: 'grass' });
def(43, 'scheepswand', 'Scheepswand', { hard: 8, tool: 'pick', tier: 2, snd: 'metal' });
def(44, 'scheepscomputer', 'Scheepscomputer', { tiles: ['scheepswand', 'scheepscomputer', 'scheepswand'], hard: Infinity, snd: 'metal', interact: true, light: 8 });
def(45, 'machinekrat', 'Machinekrat', { hard: Infinity, snd: 'metal', interact: true });
def(46, 'portaalsteen', 'Portaalsteen', { hard: 6, tool: 'pick', tier: 2 });
def(47, 'portaal_groen', 'Portaal naar de Groene wereld', { pass: 2, solid: false, opaque: false, hard: Infinity, light: 12 });
def(48, 'portaal_ijs', 'Portaal naar de IJswereld', { pass: 2, solid: false, opaque: false, hard: Infinity, light: 12 });
def(49, 'portaal_vuur', 'Portaal naar de Vuurwereld', { pass: 2, solid: false, opaque: false, hard: Infinity, light: 12 });
def(50, 'portaal_schaduw', 'Portaal naar de Schaduwwereld', { pass: 2, solid: false, opaque: false, hard: Infinity, light: 12 });
def(51, 'portaal_wolken', 'Portaal naar de Wolkenwereld', { pass: 2, solid: false, opaque: false, hard: Infinity, light: 12 });
def(52, 'levenshout', 'Levenshout', { tiles: ['levenshout_top', 'levenshout', 'levenshout_top'], hard: Infinity, snd: 'wood' });
def(53, 'levensblad_groot', 'Blad van de Grote Levensboom', { pass: 1, opaque: false, hard: Infinity, snd: 'leaf' });
def(54, 'levensblad_ijs', 'Blad van de IJsboom', { pass: 1, opaque: false, hard: Infinity, snd: 'leaf' });
def(55, 'levensblad_vuur', 'Blad van de Vuurboom', { pass: 1, opaque: false, hard: Infinity, snd: 'leaf' });
def(56, 'levensblad_schaduw', 'Blad van de Schaduwboom', { pass: 1, opaque: false, hard: Infinity, snd: 'leaf' });
def(57, 'levensblad_hemel', 'Blad van de Hemelboom', { pass: 1, opaque: false, hard: Infinity, snd: 'leaf' });
def(58, 'levenshart', 'Levenshart', { hard: Infinity, interact: true, light: 15, snd: 'glass' });
const EGG = { ...CROSS, hard: 0.8, support: false, interact: true, light: 5, snd: 'stone' };
def(60, 'ei_vuur', 'Vuurdrakenei', { ...EGG });
def(61, 'ei_ijs', 'IJsdrakenei', { ...EGG });
def(62, 'ei_natuur', 'Natuurdrakenei', { ...EGG });
def(63, 'ei_bliksem', 'Bliksemdrakenei', { ...EGG });
def(64, 'ei_schaduw', 'Schaduwdrakenei', { ...EGG });
def(65, 'ei_robot', 'Robotdrakenei', { ...EGG });
def(66, 'ei_goud', 'Gouden drakenei', { ...EGG });
def(67, 'ei_kristal', 'Kristaldrakenei', { ...EGG });
def(68, 'hoog_gras', 'Hoog gras', { ...CROSS, drop: null, replace: true });
def(69, 'bloem_rood', 'Rode bloem', { ...CROSS });
def(70, 'bloem_geel', 'Gele bloem', { ...CROSS });
def(71, 'bloem_blauw', 'Blauwe bloem', { ...CROSS });
def(72, 'bessenstruik', 'Bessenstruik', { ...CROSS, hard: 0.3, drop: [264, 2, 3] });
def(73, 'dode_struik', 'Dode struik', { ...CROSS, drop: [256, 1, 2] });
def(74, 'oergesteente', 'Oergesteente', { hard: Infinity });
def(75, 'kristalblok', 'Kristalblok', { hard: 4, tool: 'pick', tier: 2, snd: 'glass', light: 6 });
def(76, 'goudblok', 'Goudblok', { hard: 4, tool: 'pick', tier: 2, snd: 'metal' });
def(77, 'ijzerblok', 'IJzerblok', { hard: 5, tool: 'pick', tier: 2, snd: 'metal' });
def(78, 'lamp', 'Lamp', { hard: 0.8, light: 15, snd: 'glass' });
def(79, 'ijskristal_erts', 'IJskristalerts', { hard: 5, tool: 'pick', tier: 2, drop: [269, 1, 2], xp: 6, snd: 'glass', light: 5 });
def(80, 'vuurkristal_erts', 'Vuurkristalerts', { hard: 5, tool: 'pick', tier: 2, drop: [270, 1, 2], xp: 6, light: 6 });
def(81, 'schaduwkristal_erts', 'Schaduwkristalerts', { hard: 5, tool: 'pick', tier: 2, drop: [271, 1, 2], xp: 6, light: 5 });
def(82, 'hemelkristal_erts', 'Hemelkristalerts', { hard: 5, tool: 'pick', tier: 2, drop: [272, 1, 2], xp: 6, light: 6 });
def(83, 'stam_schaduw', 'Schaduwstam', { ...LOG, tiles: ['stam_schaduw_top', 'stam_schaduw', 'stam_schaduw_top'] });
def(84, 'blad_schaduw', 'Schaduwblad', { ...LEAF });
def(85, 'stam_verkoold', 'Verkoolde stam', { ...LOG, tiles: ['stam_verkoold_top', 'stam_verkoold', 'stam_verkoold_top'], drop: [257, 1, 1] });
def(86, 'blad_goud', 'Gouden blad', { ...LEAF });
def(87, 'stam_hemel', 'Hemelstam', { ...LOG, tiles: ['stam_hemel_top', 'stam_hemel', 'stam_hemel_top'] });
def(88, 'krat_leeg', 'Lege krat', { hard: 3, tool: 'pick', snd: 'metal' });

// Verdorde bladeren van een levensboom die nog niet hersteld is.
export const TILE_DOR = tile('levensblad_dor');
// Scheurtjes als je een blok aan het hakken bent.
export const TILE_CRACK = [tile('crack0'), tile('crack1'), tile('crack2'), tile('crack3')];

export const NUM_BLOCKS = 128;
// Snelle opzoektabellen
export const B_SHAPE = new Uint8Array(NUM_BLOCKS);
export const B_PASS = new Uint8Array(NUM_BLOCKS);
export const B_OPAQUE = new Uint8Array(NUM_BLOCKS);
export const B_SOLID = new Uint8Array(NUM_BLOCKS);
export const B_LIGHT = new Uint8Array(NUM_BLOCKS);
export const B_TOP = new Uint8Array(NUM_BLOCKS);
export const B_SIDE = new Uint8Array(NUM_BLOCKS);
export const B_BOTTOM = new Uint8Array(NUM_BLOCKS);
for (const b of BLOCKS) {
  if (!b) continue;
  B_SHAPE[b.id] = b.shape; B_PASS[b.id] = b.pass;
  B_OPAQUE[b.id] = b.opaque ? 1 : 0; B_SOLID[b.id] = b.solid ? 1 : 0;
  B_LIGHT[b.id] = b.light;
  B_TOP[b.id] = b.tTop; B_SIDE[b.id] = b.tSide; B_BOTTOM[b.id] = b.tBottom;
}

export const LIFE_LEAVES = { groen: B.levensblad_groot, ijs: B.levensblad_ijs, vuur: B.levensblad_vuur, schaduw: B.levensblad_schaduw, wolken: B.levensblad_hemel };
export const LOGS = [B.stam_eik, B.stam_den, B.stam_berk, B.stam_schaduw, B.stam_verkoold, B.stam_hemel];
export const LEAVES = [B.blad_eik, B.blad_den, B.blad_berk, B.blad_schaduw, B.blad_goud];
export const EGGS = { vuur: B.ei_vuur, ijs: B.ei_ijs, natuur: B.ei_natuur, bliksem: B.ei_bliksem, schaduw: B.ei_schaduw, robot: B.ei_robot, goud: B.ei_goud, kristal: B.ei_kristal };
export const EGG_TYPE = {};
for (const k in EGGS) EGG_TYPE[EGGS[k]] = k;
export const PORTAL_TO = { [B.portaal_groen]: 'groen', [B.portaal_ijs]: 'ijs', [B.portaal_vuur]: 'vuur', [B.portaal_schaduw]: 'schaduw', [B.portaal_wolken]: 'wolken' };
export const PORTAL_BLOCK = { groen: B.portaal_groen, ijs: B.portaal_ijs, vuur: B.portaal_vuur, schaduw: B.portaal_schaduw, wolken: B.portaal_wolken };
