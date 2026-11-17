// Het Landbouwimperium: gewassen die groeien, magische gewassen, het boerderijlevel, de
// missies en wat je bij de marktkraam kunt kopen en verkopen.
import { B } from './blocks.js';
import { I } from './items.js';

// zaad = wat je op de akker zet, blok = de rijpe plant, oogst = wat je krijgt [id, min, max],
// groei = hoe lang het duurt (tellen), prijs = wat één stuk oplevert bij de marktkraam,
// magisch = het magische gewas dat je er soms bij vindt, xp = boerderijpunten per oogst.
export const CROPS = {
  tarwe: { name: 'Tarwe', zaad: [I.tarwe, B.tarwe], blok: B.tarwe, oogst: [I.tarwe, 2, 3], groei: 90, prijs: 0.2, magisch: 'gouden_tarwe' },
  wortel: { name: 'Wortel', zaad: [I.wortel], blok: B.g_wortel, oogst: [I.wortel, 2, 3], groei: 100, prijs: 0.3, magisch: 'diamantwortel' },
  aardappel: { name: 'Aardappel', zaad: [I.aardappel], blok: B.g_aardappel, oogst: [I.aardappel, 2, 4], groei: 110, prijs: 0.4, magisch: 'eeuwige_plant' },
  mais: { name: 'Maïs', zaad: [I.mais], blok: B.g_mais, oogst: [I.mais, 2, 3], groei: 130, prijs: 0.5, magisch: 'regenboogmais' },
  tomaat: { name: 'Tomaat', zaad: [I.tomaat], blok: B.g_tomaat, oogst: [I.tomaat, 2, 3], groei: 140, prijs: 0.7, magisch: 'drakenfruit' },
  aardbei: { name: 'Aardbei', zaad: [I.aardbei], blok: B.g_aardbei, oogst: [I.aardbei, 2, 3], groei: 150, prijs: 0.9, magisch: 'maanbes' },
  pompoen: { name: 'Pompoen', zaad: [B.pompoen], blok: B.pompoen, oogst: [B.pompoen, 2, 2], groei: 200, prijs: 1, magisch: 'sterrenfruit' },
};
const MAGIC = [['gouden_tarwe', 'Gouden tarwe', 8], ['diamantwortel', 'Diamantwortel', 12], ['regenboogmais', 'Regenboogmaïs', 15], ['maanbes', 'Maanbes', 18], ['drakenfruit', 'Drakenfruit', 22],
  ['sterrenfruit', 'Sterrenfruit', 25], ['eeuwige_plant', 'Eeuwige plant', 15], ['kristalbloem', 'Kristalbloem', 30], ['gouden_appel', 'Gouden appel', 40], ['kosmisch_gewas', 'Kosmisch gewas', 80]];
for (const [k, name, prijs] of MAGIC) CROPS[k] = { name, zaad: [I[k]], blok: B['g_' + k], oogst: [I[k], 2, 2], groei: 240, prijs, magic: true };
export const MAGIC_KEYS = MAGIC.map((m) => m[0]);
// de drie zeldzaamste vind je alleen als je een ánder magisch gewas oogst: [gewas, kans]
export const MAGIC_BONUS = [['kristalbloem', 0.05], ['gouden_appel', 0.03], ['kosmisch_gewas', 0.015]];
export const MAGIC_CHANCE = 0.04;       // de kans dat je bij een gewoon gewas het magische gewas vindt

export const CROP_OF_SEED = {};         // wat groeit er uit dit ding?
export const CROP_OF_BLOCK = {};        // welke plant is dit blok?
for (const k in CROPS) { const C = CROPS[k]; C.key = k; C.xp = C.magic ? 6 : 1; for (const id of C.zaad) CROP_OF_SEED[id] = k; CROP_OF_BLOCK[C.blok] = k; }

// wat je nog meer kunt verkopen bij de marktkraam (gemaakt van je oogst)
export const FARM_PRICES = { [I.brood]: 1, [I.pizza]: 3, [I.friet]: 0.5, [I.appel]: 0.3, [I.melk]: 1, [B.hooi]: 0.8 };
for (const k in CROPS) FARM_PRICES[CROPS[k].oogst[0]] = CROPS[k].prijs;

// de tien titels van Jorian, met het aantal boerderijpunten dat je ervoor nodig hebt
export const FARM_TITLES = [['Beginnende boer', 0], ['Ervaren boer', 40], ['Meesterboer', 120], ['Landbouwexpert', 300], ['Boerderijmiljonair', 700],
  ['Voedselkoning', 1500], ['Handelsmagnaat', 3000], ['Magische boer', 6000], ['Legendarische landbouwer', 12000], ['Keizer van het landbouwimperium', 25000]];
export function farmLevel(xp) { let l = 1; for (let i = 0; i < FARM_TITLES.length; i++) if (xp >= FARM_TITLES[i][1]) l = i + 1; return l; }

// wat de marktkraam verkoopt: [sleutel, wat, hoeveel, prijs, vanaf welk boerderijlevel]
export const FARM_SHOP = [
  ['tarwe', I.tarwe, 4, 1, 1], ['wortel', I.wortel, 4, 2, 1], ['akker', B.akker, 8, 2, 1],
  ['aardappel', I.aardappel, 4, 3, 2], ['sproeier', B.sproeier, 1, 15, 2],
  ['mais', I.mais, 4, 4, 3], ['tractor', I.v_tractor, 1, 80, 3], ['melkmachine', B.melkmachine, 1, 30, 3],
  ['tomaat', I.tomaat, 4, 5, 4], ['aardbei', I.aardbei, 4, 6, 4], ['zaaimachine', I.v_zaaimachine, 1, 100, 4],
  ['pompoen', B.pompoen, 2, 4, 5], ['combine', I.v_combine, 1, 150, 5],
];

// De missies. soort: wat er geteld wordt; n = hoeveel; munten = de beloning.
export const FARM_MISSIONS = [
  { k: 'tarwe', tekst: 'Oogst 1000 tarwe', soort: 'oogst', wat: 'tarwe', n: 1000, munten: 100 },
  { k: 'aardbei', tekst: 'Oogst 100 aardbeien', soort: 'oogst', wat: 'aardbei', n: 100, munten: 40 },
  { k: 'sproeier', tekst: 'Koop een sproeier', soort: 'koop', wat: 'sproeier', n: 1, munten: 10 },
  { k: 'tractor', tekst: 'Koop een tractor', soort: 'koop', wat: 'tractor', n: 1, munten: 30 },
  { k: 'combine', tekst: 'Koop een grote machine: de combine', soort: 'koop', wat: 'combine', n: 1, munten: 50 },
  { k: 'magie', tekst: 'Ontdek een magisch gewas', soort: 'magie', n: 1, munten: 50 },
  { k: 'magie10', tekst: 'Ontdek alle 10 magische gewassen', soort: 'magie', n: 10, munten: 500 },
  { k: 'verkoop', tekst: 'Verkoop 5000 voedselproducten', soort: 'verkocht', n: 5000, munten: 300 },
  { k: 'legende', tekst: 'Maak een legendarische boerderij (level 9)', soort: 'level', n: 9, munten: 400 },
  { k: 'miljoen', tekst: 'Verdien je eerste miljoen munten', soort: 'verdiend', n: 1000000, munten: 1000 },
];
export const SPRINKLER_R = 4;           // zo ver reikt een sproeier (de gewassen groeien dan twee keer zo snel)
