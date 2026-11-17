// Beroepen: welke er zijn, wat je ervoor moet doen en wat je ermee verdient.
// De opdrachten vinkt het spel zelf af: de server telt wat je echt doet ("gebeurtenissen").
//
// Gebeurtenissen die geteld worden:
//   erts, steen, hout      een blok van die soort weghakken
//   bouw                   een blok neerzetten
//   oogst                  een gewas oogsten (per stuk)
//   verzorg                een koe melken, een schaap scheren of een ei laten uitkomen
//   kook, maak             eten maken, of iets anders maken
//   versla                 een monster verslaan
//   rij:<voertuig>         zoveel blokken rijden, varen of vliegen (rij:trein, rij:bus, rij:boot ...)
//   dorp                   in een dorp, stad of ander bouwwerk aankomen
//   blus                   een brand blussen
//   genees                 een dorpeling verbinden
//   garage                 iets repareren, tanken, spuiten of upgraden in de garage
//   verkoop                iets verkopen bij de marktkraam (per stuk)
import { B } from './blocks.js';
import { I } from './items.js';

// Elke taak: [gebeurtenis(sen), tekst met {n}, hoeveel op level 1, hoeveel erbij per level]
// kleur = werkkleding, pet = kleur van de pet, cadeau = [wat, hoeveel, vanaf welk level]
export const JOBS = {
  brandweer: { name: 'Brandweer', icon: '🚒', kleur: 0xc8262c, pet: 0xf0c020, cadeau: [I.v_vrachtwagen, 1, 3],
    taken: [[['blus'], 'Blus {n} branden', 2, 0.5], [['rij:vrachtwagen', 'rij:auto'], 'Rijd {n} blokken met de brandweerwagen', 150, 40], [['dorp'], 'Controleer {n} dorpen of steden', 1, 0.34]] },
  politie: { name: 'Politie', icon: '🚓', kleur: 0x24345e, pet: 0x24345e, cadeau: [I.v_auto, 1, 3],
    taken: [[['versla'], 'Versla {n} monsters die de buurt onveilig maken', 3, 1], [['dorp'], 'Patrouilleer langs {n} dorpen of steden', 1, 0.34], [['rij:auto', 'rij:motor'], 'Rijd {n} blokken op patrouille', 150, 40]] },
  dokter: { name: 'Dokter', icon: '🚑', kleur: 0xf4f4f0, pet: 0xd8362c, cadeau: [I.v_auto, 1, 3],
    taken: [[['genees'], 'Verbind {n} dorpelingen (tik ze aan met verband in je hand)', 2, 0.5], [['maak'], 'Maak {n} keer iets op de werkbank (bijvoorbeeld verband)', 2, 0.5], [['dorp'], 'Ga op huisbezoek in {n} dorpen', 1, 0.25]] },
  machinist: { name: 'Treinmachinist', icon: '🚂', kleur: 0x24345e, pet: 0xc8262c, cadeau: [I.locomotief, 1, 3],
    taken: [[['rij:trein'], 'Rijd {n} blokken met de trein', 200, 60], [['dorp'], 'Stop bij {n} dorpen', 2, 0.34], [['steen', 'bouw'], 'Werk aan het spoor: hak of leg {n} blokken', 12, 3]] },
  buschauffeur: { name: 'Buschauffeur', icon: '🚌', kleur: 0x3a6ab8, pet: 0x24345e, cadeau: [I.v_bus, 1, 3],
    taken: [[['rij:bus', 'rij:auto'], 'Rijd {n} blokken met de bus of de taxi', 200, 60], [['dorp'], 'Rijd naar {n} dorpen of steden', 2, 0.34], [['garage'], 'Laat je voertuig {n} keer nakijken in de garage', 1, 0.2]] },
  bezorger: { name: 'Bezorger', icon: '🚚', kleur: 0x8a5a30, pet: 0x8a5a30, cadeau: [I.v_vrachtwagen, 1, 3],
    taken: [[['rij:vrachtwagen', 'rij:auto', 'rij:motor'], 'Rijd {n} blokken met de bestelwagen', 200, 60], [['dorp'], 'Bezorg in {n} dorpen of steden', 2, 0.34], [['verkoop'], 'Lever {n} producten af bij de marktkraam', 10, 4]] },
  piloot: { name: 'Piloot', icon: '✈️', kleur: 0x1c2450, pet: 0xf4f4f0, cadeau: [I.v_vliegtuig, 1, 5],
    taken: [[['rij:vliegtuig', 'rij:helikopter', 'rij:draak'], 'Vlieg {n} blokken', 300, 100], [['dorp'], 'Land bij {n} dorpen, steden of vliegvelden', 2, 0.34], [['garage'], 'Tank of repareer {n} keer in de garage', 1, 0.2]] },
  kapitein: { name: 'Kapitein', icon: '⛵', kleur: 0xf4f4f0, pet: 0x24345e, cadeau: [I.v_boot, 1, 3],
    taken: [[['rij:boot'], 'Vaar {n} blokken', 150, 50], [['dorp'], 'Leg aan bij {n} dorpen', 1, 0.34], [['versla'], 'Houd de kust veilig: versla {n} monsters', 2, 0.5]] },
  boer: { name: 'Boer', icon: '🌾', kleur: 0x3a6ab8, pet: 0xe8c860, cadeau: [I.v_tractor, 1, 3],
    taken: [[['oogst'], 'Oogst {n} gewassen', 15, 6], [['verzorg'], 'Verzorg {n} dieren (melken of scheren)', 2, 0.5], [['verkoop'], 'Verkoop {n} producten bij de marktkraam', 10, 5]] },
  mijnwerker: { name: 'Mijnwerker', icon: '⛏️', kleur: 0x7a7a80, pet: 0xe8b02a, cadeau: [I.houweel_ijzer, 1, 3],
    taken: [[['erts'], 'Hak {n} blokken erts of steenkool', 6, 2], [['steen'], 'Hak {n} blokken steen', 25, 8], [['maak'], 'Smelt of maak {n} dingen', 3, 1]] },
  kok: { name: 'Kok', icon: '👨‍🍳', kleur: 0xf6f6f6, pet: 0xffffff, cadeau: [I.heldenmaal, 3, 3],
    taken: [[['kook'], 'Maak {n} keer iets te eten', 3, 1], [['oogst'], 'Haal {n} verse groenten van de akker', 8, 3], [['verkoop'], 'Verkoop {n} producten of gerechten', 8, 4]] },
  dierenverzorger: { name: 'Dierenverzorger', icon: '🐾', kleur: 0x3fa34a, pet: 0x3fa34a, cadeau: [I.ei_basis, 2, 3],
    taken: [[['verzorg'], 'Verzorg {n} dieren (melken, scheren of een ei laten uitkomen)', 3, 1], [['oogst'], 'Oogst {n} gewassen als voer', 8, 3], [['rij:dier'], 'Rijd {n} blokken op een dier', 100, 40]] },
  bouwvakker: { name: 'Bouwvakker', icon: '👷', kleur: 0xf0a020, pet: 0xf0d020, cadeau: [B.baksteen, 64, 3],
    taken: [[['bouw'], 'Zet {n} blokken neer', 30, 10], [['steen', 'hout'], 'Hak {n} blokken steen of hout', 15, 5], [['maak'], 'Maak {n} keer iets op de werkbank', 3, 1]] },
  automonteur: { name: 'Automonteur', icon: '🔧', kleur: 0x3a424c, pet: 0xd8362c, cadeau: [I.v_motor, 1, 3],
    taken: [[['garage'], 'Doe {n} klussen in de garage (repareren, tanken, spuiten, upgraden)', 2, 0.5], [['rij:auto', 'rij:motor', 'rij:quad', 'rij:terreinwagen'], 'Maak een proefrit van {n} blokken', 150, 40], [['maak'], 'Maak {n} onderdelen op de werkbank', 2, 0.5]] },
  boswachter: { name: 'Boswachter', icon: '🌲', kleur: 0x4a7a3a, pet: 0x6a4426, cadeau: [I.v_terreinwagen, 1, 3],
    taken: [[['versla'], 'Houd het bos veilig: versla {n} monsters', 3, 1], [['hout'], 'Ruim {n} boomstammen op', 8, 3], [['rij:terreinwagen', 'rij:quad', 'rij:dier'], 'Maak een ronde van {n} blokken door de natuur', 150, 50]] },
};
export const JOB_ORDER = Object.keys(JOBS);
for (const k of JOB_ORDER) JOBS[k].key = k;

// tien stappen op de ladder, met hoeveel werkpunten je ervoor nodig hebt
export const JOB_RANKS = [['Stagiair', 0], ['Leerling', 30], ['Hulpkracht', 80], ['Vakman', 150], ['Ervaren vakman', 250], ['Specialist', 400], ['Meester', 600], ['Chef', 850], ['Directeur', 1150], ['Legende', 1500]];
export function jobLevel(xp) { let l = 1; for (let i = 0; i < JOB_RANKS.length; i++) if (xp >= JOB_RANKS[i][1]) l = i + 1; return l; }
export const jobSalary = (level) => 3 + level;                 // munten per opdracht
export const JOB_XP = 10;                                       // werkpunten per opdracht
export const WEEK_FACTOR = 4;                                   // de weekopdracht is zoveel keer zo groot als een dagopdracht
export const WEEK_PAY = 6;                                      // en levert zoveel keer het loon op
// medailles: brons vanaf level 3, goud vanaf 6, legendarisch op 10
export const jobMedal = (level) => level >= 10 ? '🏆' : level >= 6 ? '🥇' : level >= 3 ? '🥉' : '';
export const DAY_NAMES = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
