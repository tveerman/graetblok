// De attracties van de kermis. Voor de server is een attractie een wezen dat op zijn plek
// blijft staan; het scherm bouwt er een groot bewegend model van (zie client/rides.js).
import { MOBS } from './mobs.js';

// dur = hoe lang een ritje duurt (tellen); bij de achtbaan en de vrijevaltoren duurt het
// precies één rondje. w en h = hoe groot het stuk is waar je op kunt tikken om in te stappen.
export const RIDES = {
  achtbaan: { name: 'Achtbaan De Drakenvlucht', knop: '🎢 Instappen', dur: 0, w: 5, h: 3 },
  reuzenrad: { name: 'Reuzenrad', knop: '🎡 Instappen', dur: 40, w: 5, h: 4 },
  vrijeval: { name: 'Vrijevaltoren', knop: '🗼 Instappen', dur: 0, w: 4, h: 4 },
  draaimolen: { name: 'Draaimolen', knop: '🎠 Opstappen', dur: 24, w: 8, h: 3 },
  zweefmolen: { name: 'Zweefmolen', knop: '🪑 Instappen', dur: 26, w: 5, h: 4 },
  schommelschip: { name: 'Schommelschip', knop: '⛵ Instappen', dur: 26, w: 7, h: 4 },
  theekopjes: { name: 'Theekopjes', knop: '☕ Instappen', dur: 24, w: 8, h: 3 },
};
export const RIDE_ORDER = ['achtbaan', 'reuzenrad', 'vrijeval', 'draaimolen', 'zweefmolen', 'schommelschip', 'theekopjes'];

for (const k of RIDE_ORDER) {
  const R = RIDES[k];
  R.key = k; R.kind = 'r_' + k;
  MOBS[R.kind] = { name: R.name, model: 'attractie', ride: k, big: true, hp: 1, speed: 0, w: R.w, h: R.h, ai: 'none', tap: true, xp: 0, drops: [] };
}

// De kermisspelletjes. soort: 'mik' = op het goede moment tikken, 'kies' = iets uitkiezen.
// beurten = hoe vaak je mag in één spel.
export const KERMIS_GAMES = {
  jut: { name: 'Kop van Jut', soort: 'mik', beurten: 1, uitleg: 'Tik als de hamer helemaal bovenaan is. Hoe hoger, hoe harder je slaat!' },
  blik: { name: 'Blikgooien', soort: 'mik', beurten: 3, uitleg: 'Drie ballen. Tik als het streepje in het midden van de blikken staat.' },
  ring: { name: 'Ringwerpen', soort: 'mik', beurten: 3, uitleg: 'Drie ringen. Tik als het streepje precies op de paal staat.' },
  eend: { name: 'Eendjes vissen', soort: 'kies', beurten: 1, uitleg: 'Vis één eendje uit het water. Onder elk eendje staat een getal: hoe hoger, hoe beter je prijs.' },
  ballon: { name: 'Ballonnen prikken', soort: 'kies', beurten: 3, uitleg: 'Prik drie ballonnen. In sommige zit een prijs!' },
  // het toernooi op de binnenplaats van een kasteel (zie kingdoms.js)
  steekspel: { name: 'Steekspel', soort: 'mik', beurten: 3, uitleg: 'Drie ritten met de lans. Tik als het streepje precies op het midden van het schild staat.' },
  boog: { name: 'Boogschieten', soort: 'mik', beurten: 3, uitleg: 'Drie pijlen. Tik als het streepje op de roos van de schietschijf staat.' },
  grijp: { name: 'Grijpmachine', soort: 'mik', beurten: 1, uitleg: 'Tik als de grijper precies boven de knuffel hangt.' },
};
export const KERMIS_PRICE = 2;        // zoveel munten kost één spelletje
