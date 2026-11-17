// Techniek en fabrieken: stroom, de fabrieksmachine en de uitvindingen.
//
// Stroom werkt zonder kabels: alles binnen STROOM_R blokken van elkaar hoort bij hetzelfde
// net. Een zonnepaneel geeft overdag stroom, een windmolen altijd een beetje, en een batterij
// bewaart wat er over is voor de nacht.
import { B } from './blocks.js';
import { I } from './items.js';

export const STROOM_R = 8;
export const BAT_MAX = 120;            // zoveel stroom past er in één batterij
export const ZON_STROOM = 2;           // stroom per tel van een zonnepaneel (overdag, als het niet regent)
export const WIND_STROOM = 1;          // stroom per tel van een windmolen (dag en nacht)
export const TP_STROOM = 20;           // zoveel kost één keer teleporteren
export const KLIMAAT_STROOM = 40;      // en zoveel kost het om het weer te veranderen

// Wat de fabrieksmachine kan. in = wat erin gaat [id, aantal], uit = wat eruit komt,
// tijd = tellen per keer (met stroom). Samen maak je er een fabriek van: erts erin, onderdelen eruit.
export const FABRIEK = [
  { k: 'breek_ijzer', name: 'Breken en smelten: ijzererts', in: [B.ijzer_erts, 1], uit: [I.ijzerstaaf, 2], tijd: 5 },
  { k: 'breek_goud', name: 'Breken en smelten: gouderts', in: [B.goud_erts, 1], uit: [I.goudstaaf, 2], tijd: 6 },
  { k: 'zaag', name: 'Zagen: boomstam tot planken', in: ['stam', 1], uit: [B.planken, 6], tijd: 3 },
  { k: 'smelt_zand', name: 'Smelten: zand tot glas', in: [B.zand, 1], uit: [B.glas, 2], tijd: 3 },
  { k: 'pers', name: 'Persen: staven tot machineonderdelen', in: [I.ijzerstaaf, 3], uit: [I.machineonderdeel, 1], tijd: 8 },
  { k: 'steen', name: 'Breken: keisteen tot grind', in: [B.keisteen, 1], uit: [B.grind, 2], tijd: 2 },
];

// De opdrachten van de Uitvinder, in deze volgorde. munten = de beloning.
export const UITVINDER = [
  { k: 'zon', tekst: 'Zet een zonnepaneel of windmolen neer', munten: 10 },
  { k: 'bat', tekst: 'Laad een batterij helemaal vol', munten: 15 },
  { k: 'fab', tekst: 'Maak 10 dingen met de fabrieksmachine', munten: 25 },
  { k: 'pers', tekst: 'Pers 3 machineonderdelen in de fabriek', munten: 30 },
  { k: 'tp', tekst: 'Reis met een teleportatiepoort', munten: 40 },
  { k: 'weer', tekst: 'Verander het weer met de klimaatmachine', munten: 50 },
];
