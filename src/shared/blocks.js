// Alle blokken van Graet Blok.
// shape: 0 = lucht, 1 = kubus, 2 = klein ding (plantje, fakkel, vuur: een 3D-model), 3 = vloeistof
//        4 = laag blok (lager dan een heel blok, zoals een bed)
//        5 = ei (een rond 3D-ei; in de rugzak is het een plaatje)
// pass:  0 = dicht, 1 = met gaatjes (bladeren), 2 = doorzichtig (water, glas)

export const SHAPE_AIR = 0, SHAPE_CUBE = 1, SHAPE_CROSS = 2, SHAPE_LIQUID = 3, SHAPE_LOW = 4, SHAPE_EGG = 5;

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
    height: p.height || 1,                       // hoe hoog het blok is (1 = heel blok)
    glow: p.glow || 0,                           // 0..15: het blok zelf licht op in het donker (fluorescerend)
  };
  BLOCKS[id] = blk;
  B[key] = id;
  return blk;
}

const CROSS = { shape: SHAPE_CROSS, pass: 1, solid: false, opaque: false, hard: 0.15, snd: 'leaf', support: true };
const LEAF = { pass: 1, opaque: false, hard: 0.3, snd: 'leaf' };
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
const EGG = { ...CROSS, shape: SHAPE_EGG, hard: 0.8, support: false, interact: true, light: 5, snd: 'stone' };
def(60, 'ei_vuur', 'Vuurdrakenei', { ...EGG, tiles: ['ei_vuur_schil', 'ei_vuur', 'ei_vuur_schil'] });
def(61, 'ei_ijs', 'IJsdrakenei', { ...EGG, tiles: ['ei_ijs_schil', 'ei_ijs', 'ei_ijs_schil'] });
def(62, 'ei_natuur', 'Natuurdrakenei', { ...EGG, tiles: ['ei_natuur_schil', 'ei_natuur', 'ei_natuur_schil'] });
def(63, 'ei_bliksem', 'Bliksemdrakenei', { ...EGG, tiles: ['ei_bliksem_schil', 'ei_bliksem', 'ei_bliksem_schil'] });
def(64, 'ei_schaduw', 'Schaduwdrakenei', { ...EGG, tiles: ['ei_schaduw_schil', 'ei_schaduw', 'ei_schaduw_schil'] });
def(65, 'ei_robot', 'Robotdrakenei', { ...EGG, tiles: ['ei_robot_schil', 'ei_robot', 'ei_robot_schil'] });
def(66, 'ei_goud', 'Gouden drakenei', { ...EGG, tiles: ['ei_goud_schil', 'ei_goud', 'ei_goud_schil'] });
def(67, 'ei_kristal', 'Kristaldrakenei', { ...EGG, tiles: ['ei_kristal_schil', 'ei_kristal', 'ei_kristal_schil'] });
def(68, 'hoog_gras', 'Hoog gras', { ...CROSS, replace: true });
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

// ---- meer om te delven: ertsen, edelstenen en gesteente ----
def(97, 'koper_erts', 'Kopererts', { hard: 4.5, tool: 'pick', tier: 1, xp: 2 });
def(98, 'zilver_erts', 'Zilvererts', { hard: 5, tool: 'pick', tier: 2, xp: 4 });
def(99, 'robijn_erts', 'Robijnerts', { hard: 6, tool: 'pick', tier: 3, drop: [276, 1, 1], xp: 8, glow: 3 });
def(100, 'saffier_erts', 'Saffiererts', { hard: 6, tool: 'pick', tier: 3, drop: [277, 1, 1], xp: 8, glow: 3 });
def(101, 'smaragd_erts', 'Smaragderts', { hard: 6, tool: 'pick', tier: 3, drop: [278, 1, 1], xp: 8, glow: 3 });
def(102, 'amethist_erts', 'Amethisterts', { hard: 5, tool: 'pick', tier: 2, drop: [279, 1, 2], xp: 5, snd: 'glass', glow: 3 });
def(103, 'zwavel_erts', 'Zwavelerts', { hard: 4.5, tool: 'pick', tier: 1, drop: [297, 1, 3], xp: 2 });
def(104, 'marmer', 'Marmer', { hard: 4, tool: 'pick', tier: 1 });
def(105, 'graniet', 'Graniet', { hard: 4.5, tool: 'pick', tier: 1 });
def(106, 'marmerblok', 'Marmeren tegels', { hard: 4, tool: 'pick', tier: 1 });
def(107, 'granietblok', 'Gepolijst graniet', { hard: 4.5, tool: 'pick', tier: 1 });
def(108, 'marmerzuil', 'Marmeren zuil', { tiles: ['marmerzuil_top', 'marmerzuil', 'marmerzuil_top'], hard: 4, tool: 'pick', tier: 1 });
def(109, 'robijnblok', 'Robijnblok', { hard: 4, tool: 'pick', tier: 2, snd: 'glass', light: 5, glow: 7 });
def(110, 'saffierblok', 'Saffierblok', { hard: 4, tool: 'pick', tier: 2, snd: 'glass', light: 5, glow: 7 });
def(111, 'smaragdblok', 'Smaragdblok', { hard: 4, tool: 'pick', tier: 2, snd: 'glass', light: 5, glow: 7 });
def(112, 'amethistblok', 'Amethistblok', { hard: 4, tool: 'pick', tier: 2, snd: 'glass', light: 5, glow: 7 });
def(113, 'lantaarn', 'Koperen lantaarn', { tiles: ['lantaarn_top', 'lantaarn', 'lantaarn_top'], hard: 0.8, light: 15, glow: 12, snd: 'metal' });
// dynamiet: tik erop om het aan te steken, en maak dan dat je wegkomt
def(114, 'dynamiet', 'Dynamiet', { tiles: ['dynamiet_top', 'dynamiet', 'dynamiet_top'], hard: 0.6, snd: 'wood', interact: true });
def(115, 'dynamiet_aan', 'Brandend dynamiet', { tiles: ['dynamiet_top', 'dynamiet_aan', 'dynamiet_top'], hard: 0.6, snd: 'wood', light: 9, glow: 10, drop: [114, 1, 1] });
def(116, 'koperblok', 'Koperblok', { hard: 5, tool: 'pick', tier: 2, snd: 'metal' });
def(117, 'zilverblok', 'Zilverblok', { hard: 5, tool: 'pick', tier: 2, snd: 'metal' });

// ---- dorpen, kastelen en spoorwegen ----
// Rails zijn een "klein ding": de mesher kiest zelf het goede stuk (recht, bocht, helling,
// kruising) aan de hand van de rails ernaast. Zie src/shared/rails.js.
def(59, 'rails', 'Rails', { shape: SHAPE_CROSS, pass: 1, solid: false, opaque: false, hard: 0.5, snd: 'metal', support: true });
def(118, 'stro', 'Strodak', { hard: 0.6, snd: 'grass' });
def(119, 'dakpan', 'Dakpannen', { hard: 3, tool: 'pick' });
def(143, 'vakwerk', 'Vakwerkmuur', { hard: 2, tool: 'axe', snd: 'wood' });
def(144, 'kasteelmuur', 'Kasteelmuur', { hard: 6, tool: 'pick', tier: 1 });
def(145, 'spookmuur', 'Zwarte kasteelmuur', { hard: 6, tool: 'pick', tier: 1 });
def(146, 'grind', 'Grind', { hard: 0.7, snd: 'sand' });
def(147, 'wol', 'Wol', { hard: 0.5, snd: 'snow' });
def(148, 'wol_rood', 'Rode wol', { hard: 0.5, snd: 'snow' });
def(149, 'wol_blauw', 'Blauwe wol', { hard: 0.5, snd: 'snow' });
def(150, 'hooi', 'Hooibaal', { tiles: ['hooi_top', 'hooi', 'hooi_top'], hard: 0.6, snd: 'grass' });
def(151, 'luifel', 'Luifel', { hard: 0.5, snd: 'snow' });
const MEUBEL = { shape: SHAPE_LOW, solid: true, opaque: false, hard: 1, tool: 'axe', snd: 'wood' };
def(152, 'tafel', 'Tafel', { ...MEUBEL, tiles: ['tafel_top', 'tafel_side', 'planken'], height: 0.8125 });
def(153, 'kruk', 'Kruk', { ...MEUBEL, tiles: ['planken', 'kruk_side', 'planken'], height: 0.5 });
def(154, 'kookpot', 'Kookpot', { tiles: ['kookpot_top', 'kookpot', 'kookpot'], hard: 3, tool: 'pick', snd: 'metal', light: 6 });
def(155, 'aambeeld', 'Aambeeld', { ...MEUBEL, tiles: ['aambeeld_top', 'aambeeld', 'aambeeld_top'], height: 0.75, tool: 'pick', hard: 4, snd: 'metal' });
def(156, 'boekenkast', 'Boekenkast', { tiles: ['planken', 'boekenkast', 'planken'], hard: 1.6, tool: 'axe', snd: 'wood' });
def(157, 'troon', 'Troon', { tiles: ['troon_top', 'troon', 'troon'], hard: 4, tool: 'pick', tier: 2, snd: 'metal' });
def(158, 'tralies', 'Tralies', { pass: 1, opaque: false, hard: 5, tool: 'pick', tier: 1, snd: 'metal' });
def(160, 'akker', 'Akker', { tiles: ['akker_top', 'aarde', 'aarde'], hard: 0.6, snd: 'grass', drop: [2, 1, 1] });
def(161, 'tarwe', 'Tarwe', { ...CROSS, drop: [326, 1, 2] });
def(162, 'pompoen', 'Pompoen', { tiles: ['pompoen_top', 'pompoen', 'pompoen_top'], hard: 1, tool: 'axe', snd: 'wood' });
def(163, 'spinnenweb', 'Spinnenweb', { ...CROSS, hard: 0.3, support: false, drop: [325, 1, 1] });
def(164, 'botten', 'Bottenstapel', { hard: 1.5, drop: [299, 2, 4] });

// ---- rond de levensbomen: alles geeft licht in het donker ----
// Lichtranken hangen uit de kruin, lichtvruchten zitten er als lampionnen tussen. Ze horen
// bij de boom (je kunt ze niet weghakken). Zwammen, zwamhoeden, mos en bloemen kun je wel
// meenemen om er zelf mee te bouwen.
export const TREE_KEYS = ['groen', 'ijs', 'vuur', 'schaduw', 'wolken'];
const RANK = { shape: SHAPE_CROSS, pass: 1, solid: false, opaque: false, hard: Infinity, snd: 'leaf', light: 8, glow: 15 };
TREE_KEYS.forEach((k, i) => def(120 + i, 'lichtrank_' + k, 'Lichtrank', { ...RANK }));
export const ZWAM_KEYS = ['blauw', 'roze', 'groen', 'oranje', 'paars'];
const ZWAM_NAMES = ['Blauwe', 'Roze', 'Groene', 'Oranje', 'Paarse'];
ZWAM_KEYS.forEach((k, i) => def(125 + i, 'gloeizwam_' + k, ZWAM_NAMES[i] + ' gloeizwam', { ...CROSS, light: 9, glow: 15 }));
ZWAM_KEYS.forEach((k, i) => def(130 + i, 'zwamhoed_' + k, ZWAM_NAMES[i] + ' zwamhoed', { tiles: ['zwamhoed_' + k, 'zwamhoed_' + k, 'zwamlamellen_' + k], hard: 0.5, snd: 'leaf', light: 10, glow: 12 }));
def(135, 'zwamsteel', 'Zwamsteel', { tiles: ['zwamsteel_top', 'zwamsteel', 'zwamsteel_top'], hard: 0.8, tool: 'axe', snd: 'wood', glow: 4 });
def(136, 'gloeimos', 'Gloeimos', { tiles: ['gloeimos_top', 'gloeimos_side', 'aarde'], hard: 0.7, snd: 'grass', glow: 5 });
def(137, 'lichtbloem', 'Lichtbloem', { ...CROSS, light: 8, glow: 15 });
TREE_KEYS.forEach((k, i) => def(138 + i, 'lichtvrucht_' + k, 'Lichtvrucht', { hard: Infinity, snd: 'glass', light: 13, glow: 15 }));

// Een bed is twee blokken lang: een voeteneind en een hoofdeind. Er zijn vier richtingen
// (waar het hoofdeind ligt, gezien vanaf het voeteneind): 0 = +x, 1 = +z, 2 = -x, 3 = -z.
// Blok 36 ('bed') is het voorwerp in je rugzak (en een oud, enkel bed in oudere werelden).
export const BED_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const BEDPART = { shape: SHAPE_LOW, solid: true, opaque: false, hard: 0.8, snd: 'wood', interact: true, drop: [36, 1, 1], height: 0.5625 };
for (let d = 0; d < 4; d++) def(89 + d, 'bed_voet_' + d, 'Bed', { ...BEDPART, tiles: ['bed_voet_top', 'bed_side', 'planken'] });
for (let d = 0; d < 4; d++) def(93 + d, 'bed_hoofd_' + d, 'Bed', { ...BEDPART, tiles: ['bed_hoofd_top', 'bed_hoofd_side', 'planken'] });
export const bedFoot = (d) => 89 + d, bedHead = (d) => 93 + d;
// geeft { head, d } voor een bed-helft, anders null
export function bedPart(id) {
  if (id >= 89 && id <= 92) return { head: false, d: id - 89 };
  if (id >= 93 && id <= 96) return { head: true, d: id - 93 };
  return null;
}
export const isBed = (id) => id === 36 || (id >= 89 && id <= 96);

// Verdorde bladeren van een levensboom die nog niet hersteld is.
export const TILE_DOR = tile('levensblad_dor');
// Scheurtjes als je een blok aan het hakken bent.
export const TILE_CRACK = [tile('crack0'), tile('crack1'), tile('crack2'), tile('crack3')];

// Plaatjes voor de 3D-modellen van kleine dingen (gras, bloemen, fakkel, vuur...): zie
// src/client/blockmodels.js. De plaatjes van die blokken zelf worden alleen nog gebruikt
// als icoontje in de rugzak.
export const MODEL_TILES = ['gras_spriet', 'plant_steel', 'plant_blad', 'bloemblad_rood', 'bloemblad_geel', 'bloemblad_blauw',
  'bloemhart', 'bes', 'tak', 'stok_hout', 'vlam', 'lichtblad', 'zwamhoed_turkoois', 'zwamlamellen_turkoois',
  'rail_staal', 'biels', 'tarwe_halm', 'tarwe_aar', 'web'];
MODEL_TILES.forEach(tile);

export const NUM_BLOCKS = 256;
// Snelle opzoektabellen
export const B_SHAPE = new Uint8Array(NUM_BLOCKS);
export const B_PASS = new Uint8Array(NUM_BLOCKS);
export const B_OPAQUE = new Uint8Array(NUM_BLOCKS);
export const B_SOLID = new Uint8Array(NUM_BLOCKS);
export const B_LIGHT = new Uint8Array(NUM_BLOCKS);
export const B_TOP = new Uint16Array(NUM_BLOCKS);
export const B_SIDE = new Uint16Array(NUM_BLOCKS);
export const B_BOTTOM = new Uint16Array(NUM_BLOCKS);
export const B_HEIGHT = new Float32Array(NUM_BLOCKS).fill(1);
export const B_GLOW = new Uint8Array(NUM_BLOCKS);     // 0..15: licht het blok zelf op? (alleen voor het tekenen)
export const B_BED = new Uint8Array(NUM_BLOCKS);      // 0 = geen bed-helft, 1..4 = voeteneind, 5..8 = hoofdeind (richting erbij)
for (const b of BLOCKS) {
  if (!b) continue;
  B_SHAPE[b.id] = b.shape; B_PASS[b.id] = b.pass;
  B_OPAQUE[b.id] = b.opaque ? 1 : 0; B_SOLID[b.id] = b.solid ? 1 : 0;
  B_LIGHT[b.id] = b.light;
  B_TOP[b.id] = b.tTop; B_SIDE[b.id] = b.tSide; B_BOTTOM[b.id] = b.tBottom;
  B_HEIGHT[b.id] = b.height;
  B_GLOW[b.id] = b.glow;
  const bp = bedPart(b.id);
  if (bp) B_BED[b.id] = 1 + bp.d + (bp.head ? 4 : 0);
}

export const LIFE_LEAVES = { groen: B.levensblad_groot, ijs: B.levensblad_ijs, vuur: B.levensblad_vuur, schaduw: B.levensblad_schaduw, wolken: B.levensblad_hemel };
export const LIFE_VINES = {}, LIFE_FRUIT = {};
TREE_KEYS.forEach((k, i) => { LIFE_VINES[k] = 120 + i; LIFE_FRUIT[k] = 138 + i; });
export const ZWAMMEN = ZWAM_KEYS.map((k, i) => 125 + i), ZWAMHOEDEN = ZWAM_KEYS.map((k, i) => 130 + i);
export const LOGS = [B.stam_eik, B.stam_den, B.stam_berk, B.stam_schaduw, B.stam_verkoold, B.stam_hemel];
export const LEAVES = [B.blad_eik, B.blad_den, B.blad_berk, B.blad_schaduw, B.blad_goud];
export const EGGS = { vuur: B.ei_vuur, ijs: B.ei_ijs, natuur: B.ei_natuur, bliksem: B.ei_bliksem, schaduw: B.ei_schaduw, robot: B.ei_robot, goud: B.ei_goud, kristal: B.ei_kristal };
export const EGG_TYPE = {};
for (const k in EGGS) EGG_TYPE[EGGS[k]] = k;
export const PORTAL_TO = { [B.portaal_groen]: 'groen', [B.portaal_ijs]: 'ijs', [B.portaal_vuur]: 'vuur', [B.portaal_schaduw]: 'schaduw', [B.portaal_wolken]: 'wolken' };
export const PORTAL_BLOCK = { groen: B.portaal_groen, ijs: B.portaal_ijs, vuur: B.portaal_vuur, schaduw: B.portaal_schaduw, wolken: B.portaal_wolken };
