// De opdrachten die de speler door het avontuur leiden.
import { NEST_PEAK, CRASH } from '../shared/worlds.js';
import { I } from '../shared/items.js';

const made = (p, ...keys) => keys.some((k) => p.flags['made_' + k]);

export const QUESTS = [
  { id: 'hout', title: 'Hout hakken',
    text: 'Je bent wakker geworden in een vreemde wereld. Hak een boom om: houd je vinger (of muisknop) ingedrukt op een boomstam. Verzamel 3 stammen.',
    done: (p, S) => S.count(p, 'stam') >= 3 || made(p, 'planken', 'werkbank') },
  { id: 'werkbank', title: 'Een werkbank',
    text: 'Open je rugzak met de knop 🎒. Maak planken van je stammen en daarna een werkbank.',
    done: (p) => made(p, 'werkbank') },
  { id: 'houweel', title: 'Je eerste gereedschap',
    text: 'Zet de werkbank op de grond. Ga er vlakbij staan, maak stokken en dan een houten houweel.',
    done: (p) => made(p, 'houweel_hout', 'houweel_steen', 'houweel_ijzer') },
  { id: 'zwaard', title: 'Steen en een zwaard',
    text: 'Hak met je houweel steen los. Maak daarmee een stenen zwaard. Dat heb je vannacht nodig!',
    done: (p) => made(p, 'zwaard_steen', 'zwaard_ijzer', 'zwaard_kristal') },
  { id: 'schip', title: 'Het ruimteschip',
    text: 'Onderzoek het neergestorte ruimteschip. Open de metalen kratten en praat met de scheepscomputer.',
    marker: { w: 'groen', x: CRASH.x, z: CRASH.z },
    done: (p) => p.flags.krat && p.flags.computer },
  { id: 'kamp', title: 'Een veilig kamp',
    text: 'Maak een kampvuur en een bed. Slaap in het bed als het donker wordt, want \'s nachts komen de monsters.',
    done: (p) => made(p, 'kampvuur') && made(p, 'bed') },
  { id: 'ei', title: 'Het drakennest',
    text: 'Zoek een drakenei! Er ligt een nest boven op de hoge berg in het noordoosten. Hak het ei los en neem het mee.',
    marker: { w: 'groen', x: NEST_PEAK.x, z: NEST_PEAK.z },
    done: (p) => p.flags.egg || p.dragons.length > 0 },
  { id: 'broed', title: 'Uitbroeden',
    text: 'Zet het ei op de grond, vlak naast een kampvuur. Het ei moet warm blijven. Wacht tot het uitkomt!',
    done: (p) => p.dragons.length > 0 },
  { id: 'voer', title: 'Een grote draak',
    text: 'Tik op je draak en geef hem bessen of vlees. Voer hem tot hij een volwassen draak is.',
    done: (p) => p.dragons.some((d) => d.growth >= 100) },
  { id: 'vlieg', title: 'Vliegen!',
    text: 'Tik op je volwassen draak en kies "Vliegen". Samen ben je veel sneller.',
    done: (p) => p.flags.flown },
  { id: 'ijzer', title: 'IJzer smelten',
    text: 'Maak een oven. Zoek ijzererts en steenkool in grotten en smelt daar ijzerstaven van. Neem ook gloeikristallen mee.',
    done: (p) => made(p, 'ijzerstaaf', 'kern_ijs') },
  { id: 'kern', title: 'Het eerste portaal',
    text: 'Maak bij de werkbank een IJsportaalkern en zet hem op de grond. Stap door het portaal naar de IJswereld!',
    done: (p) => p.flags.visit_ijs },
  { id: 'ijs', title: 'De IJsboom',
    text: 'De levensbomen verliezen hun magie! Zoek de IJsboom: volg de lichtstraal aan de hemel. Versla de bewaker en raak het levenshart aan.',
    done: (p, S) => S.meta.trees.ijs },
  { id: 'vuur', title: 'De Vuurboom',
    text: 'Hak ijskristallen in de IJswereld en maak een Vuurportaalkern. Herstel de Vuurboom in de Vuurwereld.',
    done: (p, S) => S.meta.trees.vuur },
  { id: 'schaduw', title: 'De Schaduwboom',
    text: 'Maak met vuurkristallen een Schaduwportaalkern. Herstel de Schaduwboom in de Schaduwwereld.',
    done: (p, S) => S.meta.trees.schaduw },
  { id: 'wolken', title: 'De Hemelboom',
    text: 'Maak met schaduwkristallen een Wolkenportaalkern. De Hemelboom staat op een verborgen eiland hoog in de lucht.',
    done: (p, S) => S.meta.trees.wolken },
  { id: 'koning', title: 'De Drakenkoning',
    text: 'Vier bomen leven weer! De Drakenkoning bewaakt de Grote Levensboom: ver in het noordwesten van de Groene wereld, in een dal achter een ring van bergen.',
    done: (p, S) => S.meta.trees.groen },
  { id: 'einde', title: 'Held van Graet',
    text: 'Je hebt alle levensbomen hersteld en Graet gered! Blijf bouwen, ontdek alles en verzamel alle acht draken. Bezoek de dorpen, rijd met de trein, versla de Trollenhoofdman en de Skeletkoning. En er is nog één heel oud geheim...',
    done: () => false },
];

// Wat de scheepscomputer vertelt, afhankelijk van hoe ver je bent.
export function computerLines(p, S) {
  const t = S.meta.trees;
  const lines = [
    'SCHEEPSCOMPUTER GRAET-7 ... stroom: 12% ... systemen beschadigd.',
    'Het schip is neergestort. De portaalmotor is kapot en de onderdelen liggen overal.',
    'Verzamel machineonderdelen uit de kratten. Daarmee kun je portaalkernen bouwen.',
  ];
  const n = ['ijs', 'vuur', 'schaduw', 'wolken'].filter((k) => t[k]).length;
  if (n === 0) lines.push('Sensoren: vijf levensbomen houden deze werelden in leven. Ze verliezen hun magie. De eerste staat in de IJswereld.');
  else if (n < 4) lines.push('Sensoren: ' + n + ' van de 5 levensbomen zijn hersteld. Ga zo door!');
  else if (!t.groen) lines.push('Sensoren: enorme draak gemeten in het noordwesten. De Grote Levensboom wacht op je.');
  else lines.push('Alle levensbomen stralen weer. Oude gegevens gevonden: "Onder de wortels van de oudste boom slaapt iets dat ouder is dan de wereld."');
  lines.push('Sensoren: rook uit schoorstenen gemeten. Er ligt een dorp in het zuidoosten: volg het huisje op je kompas. Daar kun je ruilen en eten kopen.');
  if (!p.dragons.length) lines.push('Tip: drakeneieren liggen in nesten op hoge bergtoppen. Een ei komt uit naast een warm kampvuur.');
  return lines;
}

export const FOODS = [I.gebraden_vlees, I.rauw_vlees, I.appel, I.bessen];
