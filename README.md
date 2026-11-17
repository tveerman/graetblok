# Graet Blok

Een blokkenwereld met draken, monsters, portalen en levensbomen — bedacht door Jorian (9),
gebouwd met [three.js](https://threejs.org). Het spel draait volledig in de browser; alle
plaatjes en geluiden worden door JavaScript zelf gemaakt (er zijn geen plaatjes- of
geluidsbestanden).

The rest of this file is in English (for the grown-ups); everything inside the game is Dutch.

## Running it

```bash
python3 -m http.server 8123
```

Then open <http://localhost:8123> on the Mac. Any static file server works; there is no build
step and no dependencies to install (three.js r160 is vendored in `vendor/`).

**On the iPad:** make sure the iPad is on the same Wi-Fi, look up the Mac's address
(System Settings → Wi-Fi → Details → IP address) and open `http://<that address>:8123` in Safari.
"Share → Add to Home Screen" gives a full-screen icon. Needs iPadOS 15 or newer (WebGL2 and
module workers).

`sprites.html` shows every generated sprite and icon on one page — fun to look at together.

## Playing while the server is off

The game has no real backend (its "server" runs inside the browser and saves live on the
device), so once the files are on the iPad it can start without the machine that served them.
`sw.js` is a service worker that makes this work:

- On the first visit it stores all game files on the device. From then on every load is
  answered from that copy, so a reload works even when the server is unreachable.
- Each time the page loads it asks the server whether anything changed. If so it downloads a
  complete new set and keeps it ready; the switch happens on the next load, so old and new
  files are never mixed.
- The main menu shows the state at the bottom: "Zonder server spelen: klaar ✔" means the
  copy is complete.

**Browsers only allow a service worker over `https://` (or on `localhost`).** Opened as
`http://192.168.x.x:8123` the game still works, but the menu says
"Zonder server spelen: uit (kan alleen via https)". Ways to get there:

- put the folder on any static host with HTTPS (it is only static files), or
- serve HTTPS from the VM with a certificate the iPad trusts — for example a local CA made
  with `mkcert` whose root certificate is installed and trusted on the iPad, or a tunnel/VPN
  product that hands out real certificates.

Practical notes for the iPad:

- If the browser kept a few old game files that no longer match the new ones, the game cannot
  start. `index.html` catches that: it fetches every file again and reloads once, and shows the
  error at the bottom of the screen. (Seen in Safari over plain http after an update.)
- Keep the address the same. Saved worlds and the offline copy belong to one exact address
  (scheme, host and port); a different IP looks like a different, empty game.
- Use "Add to Home Screen" **before** starting a world, and open the game once from that icon
  while the server is up. Safari may clear data of sites that have not been visited for a
  while; Home Screen apps are treated more kindly, but they keep their own separate storage.
- When you add a file to the game, also add it to `files.json`. (Files that are missing from
  the list are still stored the first time they are loaded.)
- Add `?nosw` (or `?debug`) to the address to switch the service worker off and always load
  straight from the server — useful while changing code.

## Server check and "new version" button

The main menu checks whether the server the game came from is reachable and whether it has a
newer version. The result is shown at the bottom ("Server: bereikbaar ✔" or
"Server: niet bereikbaar"). When a newer version exists, a button **🔄 Opnieuw laden** appears
under the play button with the text "Er is een nieuwe versie van het spel!". The check runs
when the menu opens, when you come back to the tab, and once a minute while the menu is open.

How "newer" is decided depends on how the game was opened:

- **With the service worker** (https or localhost): it compares the contents of every file in
  `files.json` with its stored copy and keeps the new set ready; the button simply reloads.
- **Without it** (plain http, or `?nosw` / `?debug`): the page compares each file's
  `Last-Modified` date (or `ETag`) on the server with the copy the browser loaded. The button
  first re-downloads all files so the browser cannot reuse an old copy, then reloads. If the
  server turns out to be unreachable it says so and does not reload — without the service
  worker a reload would fail.

While the game is still fetching its files, building itself or checking for a new version, the
menu shows a progress bar instead of the play button ("Het spel wordt opgehaald... 12 van 42",
"Het spel wordt opgebouwd...", "Kijken of er een nieuwe versie is..."). The play button appears
when all of that is done, or after 15 seconds if the version check gets no answer. If a new
version is found while the menu is open, the game loads it by itself and reloads (at most once
a minute); the **🔄 Opnieuw laden** button is only shown when that is not possible, for example
while a world is being played.

Pressing play without reloading keeps the current version for that session.

To get back to this menu while playing, open the pause menu (⚙️) and choose
**🏠 Terug naar het beginscherm**. The game saves, stops the world and shows the menu again
without reloading the page, so it also works while the server is off; "Spelen" continues where
you left off.

## Controls

| | Touch (iPad) | Keyboard + mouse |
| --- | --- | --- |
| Walk | left thumb = joystick | `W` `A` `S` `D` |
| Look | drag with right thumb | mouse (click the game first) or arrow keys |
| Break / hit | hold a finger on something, or hold ⛏ | hold left mouse button |
| Place / use / talk / eat / shoot | tap, or ✋ | right mouse button or `F` |
| Jump (swim up, fly up) | ⬆ | `Space` |
| Sprint / fly down | push the stick all the way / ⬇ | `Shift` |
| Backpack + crafting | 🎒 | `E` |
| Quest log | 📜 | `Q` |
| Animal book (Dierenboek) | 🐾 | `B` |
| Pause menu (settings, back to the home screen) | ⚙️ | `Esc` |
| Camera (first / third person) | 📷 | `V` |
| Full screen on / off | the ⛶ button next to ⚙️ | the same button |
| Dragon window (feed, name, stay/follow) | "🐉 <name>" button when it is near, or tap the dragon | `G` |
| Mount / dismount dragon | "🐉 Vliegen" / "Afstappen" | `R` |
| Talk and trade, shear a sheep, milk a cow | tap the villager or animal | right mouse button or `F` |
| Board / leave a train | "🚂 Instappen" / "Afstappen", or tap the train | `R` |
| Drive a train | stick forward = go, back = brake and reverse, sideways = pick a branch at a junction | `W` / `S` / `A` `D`, `Shift` = faster |
| Hotbar | tap a slot | `1`–`9` or scroll |

While any window is open (backpack, quest log, a dialog or the pause menu) the world stands
still: no time passes and nothing attacks. The game also opens the pause menu by itself when
the tablet is put away or the tab is hidden.

The pause menu has separate switches for music ("Muziek") and sound effects
("Geluidseffecten"), and a slider "Regen en wind" for rain, wind, thunder, birds and animals.
On iPad and iPhone the music does not go through Web Audio at all: every piece is rendered
ahead, written to a WAV blob (the melody twice plus its tail, with the volume baked in) and
played by the same `<audio>` element that keeps the sound working in silent mode. Safari renders
Web Audio in 3 ms blocks and drops out when an old iPad is busy; the media player buffers by
itself. The switch "Muziek via de speler" (only shown there) turns this off again. The audio
line shows the sample rate, the output delay and "via de speler" when this is active. Add
`?speler` to the address to try it on a desktop browser. Its last line reports what the audio is doing on that device, for example
"Geluid: aan · muziek: 57 noten, sterkte 9%, als lusje · effecten: aan" — useful when a device
stays silent. "als lusje" means the music is rendered ahead of time and played as a loop (see
"Sprites and sound"); "noot voor noot" means the browser could not do that and every note is
scheduled live, which is much heavier. On iPad and iPhone the line ends with "stille stand omzeild: ja/nee": Web Audio
is silenced there by the device's silent mode (the bell in Control Centre, or the side switch
on older iPads), so the game keeps a silent `<audio>` element looping, which makes iOS route
all of the page's sound through the media channel instead. The landing screen shows which version is running ("versie van 10 nov, 18:40",
the date of the most recently changed game file), so you can tell whether a device is still
running an older copy.

## What is in this first version

From Jorian's design document (`spel.txt`), following development phases 1–4, 7, 8 and part of 9:

- **Block world** – infinite terrain with caves, ores, trees and plants; break and place anything,
  day/night cycle, crafting at a workbench and oven, a bed to skip the night, automatic saving.
- **Five worlds reached through portals** – green nature world, ice world, fire/volcano world,
  shadow world and cloud world with floating islands. Portal cores are crafted from machine
  parts found around the crashed spaceship.
- **Five life trees** – each in a hidden spot marked by a beam of light, each with a guardian
  boss. Restoring a tree gives two extra hearts and a new power. The Drakenkoning guards the
  Grote Levensboom and only wakes when the other four are restored.
- **Dragons** – eight kinds. Find an egg in a nest, hatch it next to a campfire, feed it through
  baby → young → adult, give it a name, fly on it and let it fight alongside you.
- **Monsters and animals** – tameable Pluizels, deer, Schaduwkruipers at night, rock golems in
  caves, robot spiders, ice wolves, fire spirits, shades and Stormvleugels.
- **Weapons and progress** – swords, bow, magic staff, laser gun, armour, XP, levels, the eight
  ranks plus the secret rank, and the hidden Oerwapen.
- **Tools wear out** – pickaxes, axes, swords and the bow lose a little with every block
  broken or hit landed; a bar under the item shows what is left and the tool breaks at zero.
  Better materials last longer (wood 60 uses, stone 130, copper 190, iron 260, crystal 800).
- **More to mine and make** – copper, silver, sulphur, ruby, sapphire, emerald and amethyst
  ores, plus marble and granite. They give copper and silver tools and armour, gem swords and
  pickaxes, four elemental staffs, jump boots, binoculars, lanterns, polished stone, pillars,
  gem blocks and dynamite (tap it to light the fuse, then run). The recipe list has a search
  box that filters on the name of the thing or of an ingredient.
- **Glowing life trees** – each tree is a giant with buttress roots, long limbs, hanging
  light vines and lantern fruit, a carpet of glowing moss, small and giant mushrooms in bright
  colours, and a spiral staircase of mushrooms around the trunk (it starts on the tall root at
  the back). Everything glows in the dark; a restored tree glows much brighter and fills the
  air with drifting lights.
- **Villages** – on the plaza a well and market stalls, along four streets a restaurant,
  bakery, smithy, shop, farm with a wheat field and houses, plus (per village) a sawmill,
  jeweller or mining company. Every building has someone living in it, with a name and
  clothes that fit the job. Tap a villager to trade: sell what you find for gold coins
  ("munten") and buy tools, food, meals or dragon eggs. The first villager you meet gives
  you five coins. Two knights guard each village and fight monsters that come near. In the
  green world there is always a village south-east of the spaceship; the compass shows the
  nearest village (🏠) and castle (🏰).
- **Trains** – rails (straight, curves, slopes and crossings are chosen automatically from
  the neighbouring rails), a locomotive and wagons, crafted or bought from the station
  master. Put the locomotive on rails, tap it and drive. Every village has a station, and
  many villages are linked by a railway with cuttings, tunnels (with lamps) and plank bridges.
  A train stays where you leave it; hit it with a pickaxe to pick it up again.
- **Castles** – 76 blocks across: a moat with a bridge, a curtain wall with a wall walk and
  battlements, four round corner towers, a gatehouse, a courtyard with stables and a smithy,
  and a three-storey keep with a throne room, library, armoury, dungeon and a tall tower
  holding the treasury. A king's castle has a king (who pays 100 coins for the Skeleton
  King's crown and sells a golden dragon egg), knights, a cook, a smith and a dragon trader.
  A haunted castle ("spookkasteel") is dark and ruined and belongs to the Skeletkoning and
  his skeleton knights, archers and giant spiders.
- **Dragon species** – the eight kinds now differ in shape (flame crest, ice crystals, leaf
  collar, zigzag horns, jets and antenna, crown, crystal spikes...), in flying speed and
  strength, and in what they breathe: exploding fireballs, three freezing ice shards, a
  lingering poison cloud that also heals the rider, chain lightning, a shadow flame that
  passes through enemies, twin rapid lasers, golden fire that makes monsters drop coins, and
  a fan of five crystal shards. Wild dragons circle high in the sky and attack if you come
  too close; a beaten one sometimes leaves an egg.
- **Weather** – sun, rain and thunderstorms in the green and shadow worlds, snow and
  blizzards in the ice world, showers in the cloud world, and snow instead of rain high in
  the mountains. The sky turns grey, you hear the rain (muffled under a roof), and lightning
  strikes near you with thunder that arrives later the further away it was.
- **More creatures** – herds of sheep (tap for wool) and cows (tap with a bucket for milk),
  wolf packs that hunt at night (three bones tame a wolf, which then fights for you), bears
  that only attack when you come close, giant spiders that leap, skeleton archers, and troll
  camps: a palisade with tents, a treasure chest, four trolls and the Trollenhoofdman.
- **Guards** – knights in villages and castles, trolls around their chief, skeleton knights
  around the Skeletkoning, and four thorn guards ("doornwachters") around every sick life
  tree. Once a tree is restored they are replaced by friendly tree guards ("boomwachters").
- **The Dierenrijk (animal kingdom)** – the first part of Jorian's expansion plan
  (`UITBREIDINGSPLAN_BEANTWOORD.md`). Buy eggs in a village (farmer, market trader, mining
  company, dragon trader), craft or buy a **broedmachine** (incubator), hold an egg and tap the
  machine. It holds three eggs; hatching takes 1 to 15 minutes of play time. What comes out is
  rolled with Jorian's odds: ten rarities from Common (40%) to Secret (0.2%), plus a separate
  chance on a shiny (Golden, Rainbow, Diamond, Shadow). There are 93 animals so far, in six
  egg kinds. The **Dierenboek** (🐾) shows all of them by number, unknown ones as a dark egg,
  and gives coins and a title at 5, 10, 25... animals. Hatched animals follow you; tap one to
  make it wait. At most four walk around at once, the rest wait in the book, where you can
  call, store and name them. **Riding**: next to one of your own mounts (horse, elephant, big
  wolves and lions, large dinosaurs...) the ride button (or `R`) says "🐎 Rijden"; a few can
  fly ("🪽 Vliegen": pegasus, griffins, pteranodon, phoenixes). **Guards** (dog, wolf, lion,
  T-rex...) bite monsters that come near you; you get the XP and loot. Not in yet: clothes,
  breeding, the animal school and wild animals.
- **Vehicles** – the start of the second part of Jorian's plan. Car, off-road car, motorbike,
  quad, lorry, bus, boat and helicopter (`src/shared/vehicles.js`). Buy one in a village (smith,
  mining company, station master, market trader, dragon trader) or craft the small ones, hold it
  and tap the ground to put it down, then tap it or use the "🚗 Instappen" button. Stick
  forward = throttle, back = brake and reverse, sideways = steer; the camera follows. A vehicle
  takes one-block steps by itself, uses fuel (refill by tapping it with a jerrycan), gets damaged
  when you hit a wall at speed (repair with a spanner and an iron bar) and stays where you leave
  it. Hit it with a pickaxe to take it with you again; its fuel, damage, colour, name and
  upgrades are remembered per kind of vehicle.
- **Roads** – asphalt, asphalt with a centre dash, zebra crossing, start/finish line and
  checkpoint blocks (oven and workbench, or from the mechanic). On asphalt every vehicle is
  22% faster.
- **Garage** – a red tool cabinet block. Park within a few blocks and tap it: repair and
  refuel for coins, pick one of ten colours, give the vehicle a name and buy upgrades in three
  levels (engine, tyres, brakes, nitro). The class (D to S) follows from the top speed.
- **Nitro and drifting** – with a nitro upgrade the sprint button gives a boost until the bar
  is empty. The jump button is the handbrake: the rear slides out, and sliding at speed earns
  drift points (a few extra coins per lap). In the rain the car slides more.
- **Laps** – drive over a start/finish line and the clock starts; touch every checkpoint of the
  track and cross the line again for a lap time. The best time per track is kept, with coins
  for a first lap and for a record. This also works on a track you build yourself: the game
  takes the checkpoint blocks within about 70 blocks of the start line.
- **Race circuits** – a new kind of place in the world (🏁 on the compass, about one in nine
  map cells): an oval with kerbs, a start gantry, three checkpoints, a pit building with a
  garage and a mechanic, and a grandstand. The race master starts a three-lap race against
  Flits, Bliksem and Turbo with a 3-2-1 countdown (move early and you get a penalty). In a
  world from before this version no circuit is placed where the player had built or dug.
- **Line trains** – every village with a railway to another village has its own train with two
  wagons. It waits at the platform, toots, drives to the next village's platform, waits and
  comes back. You may get in and drive it yourself; when you get out it carries on.
- **Air under water** – ten bubbles above the hearts; after fifteen seconds under water you
  lose a heart every second until you come up.
- **Climbing out of water and lava** – swim (or walk) against the bank and you climb up the
  wall, up to three blocks above the surface. Jumping alone only gets you a third of a block
  above the water, which used to leave you stuck in a pit.
- **Above the clouds** – dragons, flying animals and the helicopter can fly through the cloud
  layer (at height 152) up to height 198.
- **Fairground (kermis en pretpark)** – the third part of Jorian's plan. A new kind of place in
  the world (🎡 on the compass): a fenced park with a gate. The rides are large animated models
  you can sit in (`src/shared/rides.js`, `src/client/rides.js`): a roller coaster with a lift
  hill, a big drop, a looping and a camelback; a Ferris wheel; a free-fall tower; a carousel; a
  swing ride and a swinging ship. Stand at a ride and use the button ("🎢 Instappen"); the ride
  ends by itself and the first ride of the day in each attraction pays two coins. There are
  three food stalls (oliebollen, churros, poffertjes, candy floss, popcorn, ice cream, chips),
  six fair games that really work (kop van jut, tin-can throw, ring toss, duck fishing, balloon
  popping, claw machine: two coins a go, prizes are cuddly toys, a trophy, coins and sometimes
  an egg), a bumper-car arena with four cars, lanterns, and fireworks above the park at night.
  In a world from before this version a park takes the place of about a quarter of the troll
  camps, but never where the player had built or dug. Not in yet: themed areas, the log flume
  and building your own coaster.
- **The city and the airport (De Stad Van Wow en vliegveld Fintia)** – the fourth part of
  Jorian's plan (`src/shared/city.js`, `src/server/city.js`, `src/client/city.js`). Two new
  square places in the green world, 🏙️ and ✈️ on the compass (always shown, however far): the
  nearest suitable troll camp, race circuit or castle cell around the spaceship becomes the
  city, the next one the airport; further away about four in ten troll camps become one.
  *The city*: a ring of four asphalt roads with zebra crossings and pavements, towers of
  concrete, brick, marble and silver with windows (a third of them lit), six shops you can
  walk into on the ring road (baker, restaurant, shop, jeweller, mechanic with a garage block,
  market trader) with neon signs, the Silver Tower with a hotel (beds) in its lobby, a central
  square with a fountain and a city park with a pond. Six cars, a taxi, a bus and a lorry
  drive two loops; they stop for red lights (eight traffic lights, phase taken from the game
  clock so server and screen agree), for the car in front and for a player on the road.
  *The airport*: a runway with lights, a taxiway and apron, a terminal with gates 1-10
  (numbered signs), a control tower, a hangar with a mechanic, three parked airliners and one
  airliner that takes off, disappears, lands and turns around every minute. Board it at the
  start of the runway ("✈️ Meevliegen", 5 coins): you ride along during take-off and arrive
  at the nearest other airport, or get a round trip when there is none within 2000 blocks.
  The pilot in the terminal sells a propeller plane (220 coins) that flies faster than the
  helicopter. New blocks: concrete, dark concrete, window, lit window, paving, three neon
  colours and the signs 1-10. In a world from before this version nothing changes in map
  cells where the player had built or dug. Debug: `{c:'site', kind:'stad'|'vliegveld'}`.
  Not in yet: buses and taxis you can ride, a metro, a harbour and more city buildings.
- **Farming empire (het Landbouwimperium)** – the fifth part of Jorian's plan
  (`src/shared/farm.js`, `src/server/farm.js`). Crops now really grow: point at farmland
  (akker) with wheat, a carrot, potato, maize, tomato, strawberry or pumpkin in your hand and
  it becomes a seedling that ripens by itself (90-200 s; twice as fast within four blocks of
  a sprinkler or next to water). Breaking a seedling gives the seed back; harvesting a ripe
  plant gives two to four. Each harvest has a small chance of a magical crop (golden wheat,
  diamond carrot, rainbow maize, moon berry, dragon fruit, star fruit, eternal plant, crystal
  flower, golden apple, cosmic crop: all ten from Jorian's list), which can be planted too and
  sells for much more. Three farm machines are vehicles that work a strip three blocks wide
  while you drive: the tractor ploughs grass into farmland, the seeder plants what you carry,
  the combine harvests. The milking machine fills a bucket when a cow is near. The market
  stall (marktkraam, craft it or buy it from the farmer) opens "Mijn boerderij": sell your
  produce and food made from it (bread, pizza, chips), buy seeds and machines that unlock
  with your farm level, and see Jorian's ten farm titles (Beginnende boer ... Keizer van het
  landbouwimperium) and ten missions with coin rewards. New recipes: pizza, chips from
  potatoes, popcorn from maize, sprinkler, market stall. A wheat block can no longer be put
  down as a ripe plant (that duplicated wheat); it is planted like the rest. Not in yet:
  employees, own shops with customers and prices, greenhouse, windmill, fruit trees.
- **Jobs (beroepen)** – from Jorian's plan (`src/shared/jobs.js`, `src/server/jobs.js`). The
  💼 button (or J) opens "Mijn werk": pick one of 15 jobs (fire brigade, police, doctor, train
  driver, bus driver, courier, pilot, captain, farmer, miner, cook, animal keeper, builder,
  mechanic, forester) and switch whenever you like; every job keeps its own level. Each
  working day you get three tasks and each week one week task, with amounts that differ per
  day and grow with your level. The game ticks them off itself by counting what you really
  do (blocks mined or placed, crops harvested, things cooked or crafted, monsters defeated,
  distance driven, sailed or flown per kind of vehicle, villages reached, garage jobs, animals
  cared for, goods sold). A finished task pays your wage (3 + level coins) and work points;
  ten ranks from Stagiair to Legende, a present from the boss at level 3 (the job's vehicle
  or tool), medals at levels 3, 6 and 10, and a bonus for finishing all tasks on consecutive
  working days. Jorian's weekend rule uses the real date: Saturday and Sunday are always
  free. Special mechanics: for the fire brigade small fires break out nearby (tap to put
  out), the doctor bandages villagers (bandage: one wool gives two). Your job's work clothes
  (colour and cap) show on your character. Debug: `{c:'dag', v:n}` shifts the real day by n.
  Not in yet: three kinds of coins, the bank, your own shop with staff, achievements.
- **Secrets and puzzles (geheimen, puzzels en uitdagingen)** – from Jorian's plan
  (`src/server/secrets.js`). New craftable blocks: a lever and a pressure plate that open
  every secret door within six blocks (doors disguised as a bookcase, a stone wall or a
  painting; a pressure plate keeps them open for eight seconds), a trap floor that drops away
  when you stand on it and comes back, three coloured buttons with a code door that opens
  when they are pressed in the right order, and a riddle sign that tells the order for the
  nearest code door. Three new small places in the green world, on a finer grid between the
  big sites and never on a railway (🗼 🌿 🏛️ on the compass): watchtowers with a spiral
  stair and a lookout that puts everything within 1400 blocks on your compass; hedge mazes
  (generated per maze, always solvable) with a treasure chest in the middle; and the
  Forgotten Temple with four puzzle rooms (colour memory, lights, melody, sliding puzzle;
  three of them behind a trap floor, a pressure-plate door and a code door). Each solved
  puzzle gives one digit; the four digits open the golden door of the treasure room, which
  is built of unbreakable temple stone. In an older world these places never appear where
  the player had built or dug. Debug: `{c:'site', kind:'tempel'|'doolhof'|'wachttoren'}`.
  Not in yet: secret doors inside castles, parkour, ruins to restore, collecting and the
  museum, fishing.
- **The Oerwereld (prehistoric world)** – the first of Jorian's new worlds, world key
  `dino`. A warm jungle of hills, lakes with muddy shores, the odd volcano with lava in its
  crater, ferns everywhere and giant trees towering over the rest. Wild dinosaurs live
  there, built from the animal shapes of the Dierenboek: raptors and the occasional T-rex
  attack, triceratops and stegosaurus roam in herds, brachiosaurus walks alone. Fossils sit
  in the rock. It works like the other worlds: craft an Oerportaalkern (2 machine parts,
  6 bones, 3 crystals; no other world needed first), find the Oerboom in the north-east,
  defeat its guardian the Oerdinosaurus (drops the Oerhart, fossils and two prehistoric
  eggs) and restore the tree for two extra hearts and Oerkracht (you hit 30% harder). A
  quest for it follows the Drakenkoning. The secret rank still only needs the five original
  trees. New blocks: fern, giant trunk, giant leaf, mud, fossil in stone. Debug:
  `{c:'world', w:'dino'}`.
- **More music and sounds of the surroundings** – every world now has three to five songs
  (own key, tempo, chord progression, lead sound and a calm or arpeggio accompaniment) that
  take turns: four pieces of one song, then the next (`SONGS` and `nextSong` in
  `src/client/audio.js`). Every two seconds the game looks around the player
  (`surroundings` in `main.js`): among leaves you hear many more and more varied birds
  (trill, two-note call, rising whistle, cuckoo), on a large dry sand plain a rattlesnake now
  and then, and in a city a car horn. There is no desert yet, so the rattlesnake waits for
  the desert world.
- **Borrowing city traffic** – the cars, taxi, bus and lorry driving through the city can be
  entered and driven like your own vehicle. They belong to the city: you cannot pick them up,
  and twelve seconds after you get out they join the traffic again, refuelled and repaired.
  Drive one out of the city and it stays where you leave it until nobody is near.
- **Shops, fish and coral** – five craftable wall cabinets full of goods (bread, fruit and
  vegetables, bottles, tools, jewels) line the walls of the six city shops, each shop with
  its own kind; the airport terminal has four small shops along its south wall (baker,
  chips, sweets, general store) with a counter, cabinets, a neon sign and tables. Small
  coloured fish swim in any water near the player (`src/client/fish.js`: sixteen fish drawn
  in one call, client-side only; they dart away when you come close), and coral reefs in
  three colours grow on the bottom of water at least three blocks deep. A dragon, flying
  animal, helicopter or plane can no longer fly through water or lava: it stays just above
  the surface.
- **Technology and factories (techniek en fabrieken)** – from Jorian's plan
  (`src/shared/tech.js`, `src/server/tech.js`). Power without cables: everything within
  eight blocks belongs to one grid. A solar panel gives power by day in dry weather, a
  windmill a little day and night, a battery stores what is left over. The factory machine
  needs power and does six jobs through one window (crush and smelt iron or gold ore into
  two bars, saw logs into six planks, melt sand into glass, press three bars into a machine
  part, crush cobble into gravel): load it, walk away, collect later; without power it
  stands still. Two teleport gates take you from one to the other for 20 power, and the
  climate machine changes the weather for 40. The Inventor has a workshop on the city
  square, sells all of it and gives six tasks in order; the last reward is a robot dog that
  follows and fights for you. Cables, switches for power, conveyor belts, lifts and separate
  machines were left out because the first 255 block numbers were nearly used up (254 and
  255 are free); since then there is a second range of block numbers, see "Block and item
  numbers" below.
- **New regions, sea dangers and a livelier fair, shops and airliner** –
  *Regions* (`biome()` in `src/server/worldgen.js`): far from the spaceship the green world
  now changes into a deep ocean with underwater volcanoes, a desert with cacti and sandstone,
  high mountains up to the build limit, a glowing mushroom forest with giant mushrooms and
  crystal fields with amethyst spires; a message names the region you walk into. They start
  450 blocks from the spaceship in a new world; in an older world only beyond everything the
  player built and never closer than 1700 blocks, so known land does not change.
  *Sea dangers*: sharks and jellyfish (`swim` mobs in `src/shared/mobs.js`) spawn in water at
  least three blocks deep, never leave it and only attack a swimmer, not someone on land or
  in a boat; fixed bands of sea current (`seaFlow` in `player.js`) carry a swimmer along.
  *Fair*: coloured path tiles, bunting on the fence, balloons, a big striped gate with neon,
  flower boxes and benches, a circus tent you can enter, picnic tables and a new teacup
  ride; the swing ride no longer speeds up the longer the game runs.
  *Shops and airport*: nineteen furnishing blocks in the new block range (cash register,
  planter, carpets, display case, bench, departure board, suitcase, baggage belt, check-in
  desk, tiles, advertising board, clothes rack, bunting, balloons, tent cloth) furnish the
  city shops and the terminal. *Rides in first person*: with the camera on "own eyes" you now
  sit inside a ride; the airliner has a real cabin with twelve seats, windows and lights.
  *Fix*: looking up a site while a terrain column was being computed could corrupt that one
  column (a stray one-block pillar or hole); sites are now looked up first.
  *Forests and rivers* (same far-away zone): where no special region lies, the land is now
  jungle (straight trunks with flat crowns, lianas, ferns and the odd giant tree), willow
  forest on low wet ground (short trunks, hanging curtains of leaves), linden forest (big
  round crowns) or ash forest (tall and slender), with ordinary oak land in between. Willow,
  ash and linden are new logs and leaves that count as wood for every recipe. Wide rivers
  (about 30 blocks across, two deep, sandy banks) wind through everything except the ocean.
  Debug: `{c:'streek', k:'oceaan'|'woestijn'|'gebergte'|'zwammen'|'kristal'|'oerwoud'|'wilgen'|'linden'|'essen'|'rivier'}`.
- **World map and marker** (`src/server/map.js`, `openMap` in `src/client/ui.js`) – the 🗺️
  button (or M) opens a map of the world you are in, also of places you have never been:
  the server computes 128 by 128 samples of the terrain (ground kind and height) and the
  screen colours them with height shading. Drag the map with a finger or the mouse to move
  it, pinch or use the mouse wheel to zoom (ten levels from 512 to 10240 blocks across; the
  wheel zooms around the pointer); the picture follows the gesture and the new part is
  fetched when you let go. Icons and names for villages, castles, the city, the airport and
  the other places, your own position and direction, the tree of life and the spaceship. A
  tap on the map sets a marker; it is saved with the player, shown on the map, and always on
  the compass (📍 with the distance, and an arrow when it lies behind you). The map and
  work buttons are created by the script when an old cached page lacks them. Under the map
  twelve switches choose what the compass shows (marker, quest, spaceship and each kind of
  place), with "all on" and "all off"; the choice is kept in the browser. A search box
  above the map finds places by name ("Lindeburg"), by kind ("tempel", "kasteel") or region
  ("woestijn", "rivier") within 5000 blocks, nearest first; each hit can be viewed on the
  map or marked for the compass.
- **Player character with a skeleton** (`src/client/rig.js`) – the human, elf and robot you
  can play are built on one rig with joints (hips, knees, ankles, spine, neck, shoulders,
  elbows). The animation computes joint angles: knees bend while the leg swings forward, the
  hips ride at the height where the lowest foot touches the ground, arms counter-swing, and
  there are poses for standing still, running, jumping and falling, landing, swimming, riding
  and swinging a tool. Each kind has its own proportions and gait: the human walks normally,
  the elf is small with big ears and a pointed cap, walks on its toes with quick light steps
  and a little hop, the robot is riveted tin with chest lights and an antenna and walks
  stiff-legged with a stomp and a swaying body. Villagers, knights, skeletons, trolls, golems
  and tree guardians are converted to the same rig when their model is built (`rigify`: each
  one-piece arm and leg is split at the elbow or knee and the body is put on a moving hip),
  each with its own gait (villager, knight, rattling skeleton, heavy lumbering giant); what
  they hold moves with the forearm. Four-legged animals and walking birds get a knee in every
  leg that is long enough (`kneeify`). Cost: four extra boxes per creature.
- **Three camera modes** (the 📷 button, V or F5): through your own eyes, with the forearm
  that holds your item in view (it swings when you dig, hit or build; with empty hands your
  arms hang down out of view, as they do seen from outside, and only show when you punch), from behind, and from the front so you can see your character. In the front
  view a tap on the screen still aims where you tap; without a tap you aim straight ahead
  from your eyes. The best armour in your backpack is now visible on the character: chest
  plate, shoulder pieces and a helmet in the armour's colour (the elf keeps its cap, the
  robot its antenna). Seen from outside, the character holds what you carry in its raised
  right hand. Getting off a dragon or other mount high in the air now gives fall damage.
- **Story quests** – 18 steps from "chop a tree" to "defeat the Drakenkoning", shown top-left,
  with a compass marker for the early ones.

Not in yet: robots and other vehicles you can drive, hunger/thirst, disasters, the other five
worlds, and real multiplayer.

Worlds that were started before villages existed are upgraded the first time they are loaded:
no village, castle, camp or railway is placed where the player had already built or dug, so
nothing of theirs is overwritten.

## How the code is organised

```
index.html, css/          the page and HUD styling
sw.js                     service worker: offline copy of the game (see above)
files.json                the list of game files, used by sw.js and the menu's version check
vendor/                   three.js (unmodified)
src/shared/               game data used by both sides: blocks, items, recipes, creatures, worlds
src/server/               the game server: world generation, block edits, inventory, crafting,
                          creatures, bosses, dragons, quests, saving
src/client/               everything you see and hear: rendering, sprites, 3D models of plants
                          and other small things, input, UI, sound
```

### The built-in server

The game is single-player today, but it is already split into a client and a server that only
talk through messages (plain objects such as `{ t: 'break', x, y, z }`).

- `src/server/server.js` + `entities.js` hold all authoritative game state. They never touch
  the DOM or three.js.
- `src/server/worker.js` starts the server inside a **Web Worker** and wires it to
  `postMessage`.
- `src/client/net.js` is the only client file that knows how the server is reached.
- `src/server/storage.js` is a small key/value interface (IndexedDB in the browser).
- `src/server/sites.js` decides where villages, castles, troll camps and railways are and
  draws them (the world is divided into cells of 224 blocks, at most one site per cell, all
  derived from the seed). The same "plan" that draws a site also lists its inhabitants.
- `src/server/npcs.js` puts those inhabitants in the world when a player comes near, and
  holds trading, guards, herds, wolves, bears, wild dragons, dragon breath, weather and trains.
- `src/shared/animals.js` lists every animal of the Dierenrijk (number, rarity, egg kind and a
  shape description that `dier()` in `src/client/models.js` turns into a model), the egg kinds
  and the odds. `src/server/zoo.js` holds the incubator, hatching, the animal book and its
  rewards. Adding an animal is one line in the list.
- `src/shared/rails.js` has the rules for how rails connect and how a train follows them; the
  chunk mesher, the player (who drives the train) and the server all use it.

To make it real multiplayer later, the server code can move to another machine largely as-is:

1. Write a Node entry point that does what `worker.js` does, but creates one `conn`
   (`{ send(msg), onmessage }`) per WebSocket connection and calls `server.connect(conn)`.
   Chunk data is sent as a `Uint16Array` (two bytes per block), so use binary frames (or
   encode it) there.
2. Give `GameServer` a storage object with the same `get / set / del / entries / clear`
   methods that writes to disk instead of IndexedDB.
3. Replace the Worker in `net.js` with a WebSocket.
4. Players are already kept in a map and every message is handled per player; what is still
   missing for several players is showing *other players* as entities, and checking client
   messages more strictly (movement is currently trusted).

### Sprites and sound

`src/client/textures.js` draws every texture at start-up: each block tile is either a per-pixel
function built from seamless noise, or a small canvas drawing (plants, eggs, torches). The tiles
are packed into one atlas with padding so they do not bleed into each other. Item icons, creature
skins, the sun, moon and clouds are made the same way. `src/client/audio.js` synthesises all
sound effects, ambience and the soft background music with the Web Audio API.

The music is not scheduled note by note while playing: four bars are rendered in one go with an
`OfflineAudioContext` (off the main thread, at half the sample rate, backing and melody in
separate channels) and then played as a single looping buffer. After two plays a new melody is
rendered and swapped in on the bar. Scheduling dozens of live oscillators made sound and game
stutter on an old iPad, and every frame hitch was audible in the music. Wind and rain are only
adjusted four times a second, and the rain noise only runs while it rains.

`sprites.html` shows every tile and icon; `sprites.html?hq` also builds the high-quality set.

Small things that are not full blocks — tall grass, flowers, the berry bush, the dead bush,
mushrooms, torches, campfires and the hanging light vines — are real 3D shapes, not crossed
flat pictures. `src/client/blockmodels.js` builds each one once at start-up from a small kit
(boxes, tubes with a varying thickness, discs, leaf and petal quads, grass blades). The chunk
mesher copies the model into the world and gives every spot its own rotation, offset and
height, derived from the position, so no two plants look identical. Their old flat pictures
are still in the atlas, but only as backpack icons.

### "Mooie graphics" (experimental)

The pause menu has a switch "Mooie graphics (proef)", off by default. Turning it on:

- draws every tile again at 128 instead of 64 pixels, with extra detail (single leaves, pebbles,
  wood grain, nails, cut gems) — the same pixel functions run with a `HQ` flag;
- builds a second atlas holding, per pixel, the surface direction (derived from a height the
  pixel functions report), a gloss value and a glow value;
- switches the blocks to a second shader (`HQ_VERT` / `HQ_FRAG` in `render.js`) that lights
  each pixel: sun or moon light across the relief, highlights on water, ice, metal and gems,
  per-pixel glow, leaves and plants swaying in the wind, rippling water that reflects the sky,
  sun-tinted fog and a softer tone curve;
- raises the render resolution (up to 1.5× on touch devices, 2× on desktop).

Making the textures takes about 1.3 s on a recent Mac and noticeably longer on an old tablet;
it happens in the background the first time the switch is turned on. The standard mode is
unchanged and remains the default. There are still no real shadows or post-processing.

### Performance notes (old iPad)

- One draw call per chunk and pass, no shadows; lighting is baked into vertices and day/night
  is a single uniform.
- World generation and creature simulation run in the worker, off the render thread.
- **Creatures are drawn in two draw calls** (`src/client/boxbatch.js`). A creature is built
  from boxes (a cow 23, a dragon 42) and each box used to be its own draw call, a head with a
  face even six; a village cost 300 to 500 calls for a few thousand triangles. Now every plain
  box of every creature goes into one of two instanced lists (lit boxes with a skin, and
  glowing boxes). The models and their animation are unchanged: each frame the batch reads
  where every box is (`matrixWorld`) and three.js skips the box itself (`layers.mask = 0`).
  The skins live together on one 1024 px atlas; a new skin is uploaded as one small tile.
  Wings, wheels and see-through ghosts are still drawn the old way. Measured at the same
  spot in a village with 36 creatures: 433 calls before, 127 after (iPad simulator, Safari:
  338-382 before, 131-137 after).
- **Keep the chunk mesher in small functions.** `mesh()` in `src/client/chunks.js` used to be
  one function of 350 lines. Safari's JavaScript engine kept throwing its optimised version
  away and ran it in the slowest compiled tier: 3.4 ms per chunk, against 0.4 ms in Chrome.
  Split into one function per step and per block shape it takes 0.21 ms in the same engine
  (0.33 ms measured inside Safari in the simulator), with byte-identical geometry. Check
  with `jsc --sample` (see below) after changing the mesher; a line like
  `Baseline: 86%` in the tier breakdown means the same thing happened again.
- The server tick is not a bottleneck: 0.01 to 0.02 ms per tick with 14 to 39 creatures
  (start, village, city, airport, fairground, castle), measured in the same engine.
- Measuring without an iPad: macOS ships Safari's engine as a command line tool,
  `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc`. `jsc -m
  file.mjs` runs a module that imports `src/client/chunks.js` or `src/server/server.js`
  (the vendored three.js loads without a page), and `--sample` prints the hottest functions
  and in which tier they ran.
- "Mooie graphics" costs two texture lookups and per-pixel lighting for every block pixel, and
  about 50 MB of texture memory; the pause menu shows the frame rate and resolution so you
  can see what a device can handle.
- Plants (grass, flowers, berry bushes) made up about a third of all vertices. Each plant model
  marks its fine parts (half the blades, most berries) as "detail"; the mesher puts those
  triangles at the end of the index list and chunks further than one chunk away (two on
  desktop) are drawn with a shorter draw range, without rebuilding anything.
- The pause menu shows a line "Meting: ..." with the time per frame split into building chunks,
  game logic and drawing, the number of draw calls and triangles, and the hitches of the last
  20 seconds. Read it on the real device before optimising further.
- Creatures further than about 60 blocks away are not drawn (a village has some twenty
  inhabitants, each built from a dozen boxes).
- The render resolution lowers itself automatically when the frame rate drops
  ("Scherpte aanpassen" in the pause menu), and "Kijkafstand" sets how far you can see
  (default 4 on touch devices, 5 on desktop).

- A chunk stores one 16-bit number per block (it was 8 bits until the block numbers ran out):
  64 KB instead of 32 KB per chunk. At view distance 4 the screen keeps about 100 chunks and
  the server between 100 and 290, so that is 3 MB more on the screen side and 3 to 9 MB more
  in the worker. Building a chunk mesh takes the same time as before (measured over 169
  chunks, before and after: 0.45 ms per chunk in V8, 3.4 ms in the JavaScriptCore command
  line shell, both within 2% and with identical geometry).

### Block and item numbers

Blocks and items share one range of numbers, because a backpack slot can hold either:

| Numbers | What | Defined in |
| --- | --- | --- |
| 1 – 255 | blocks, first range (254 and 255 are free) | `def(id, ...)` in `src/shared/blocks.js` |
| 256 – 1023 | items | `item(id, ...)` in `src/shared/items.js` |
| 1024 – 4095 | blocks, second range | `def(id, ...)` at the bottom of `blocks.js` |

- `isBlock(id)` (exported by `blocks.js` and `items.js`) is the only place that knows these
  ranges; never write `id < 256` to tell a block from an item. `def` and `item` throw at
  start-up when a number is in the wrong range.
- Numbers never change once used: saved worlds store them (changed blocks per chunk as
  `index -> id` under `e/<world>/<chunk>`, backpacks as `[id, count]`). Nothing was
  renumbered when the second range was added, so old worlds load unchanged.
- Chunks are `Uint16Array` everywhere (`BlockArray` in `blocks.js`): the world generator,
  the server's chunk cache, the `chunk` message and the mesher's work buffer. The lookup
  tables (`B_SHAPE`, `B_SOLID`, ...) have `NUM_BLOCKS` = 4096 entries; raise `NUM_BLOCKS`
  (up to 65536) when the second range fills up.
- New blocks go in the second range. The first one is a trial block, red concrete
  (`beton_rood`, 1024; four concrete and a red flower at a workbench).
- `node tests/blok-ids.mjs` runs the server without a browser on a `MemoryStorage`: it crafts
  and places block 1024, saves, starts a second server on the same storage and checks the
  world, the backpack and the `chunk` message, then breaks the block again.

### Developer mode

Open the game with `?debug` in the address to enable cheat messages from the browser console,
for example:

```js
game.net.send({ t: 'debug', c: 'give', id: 310, n: 1 })   // an ice portal core
game.net.send({ t: 'debug', c: 'world', w: 'wolken' })     // jump to the cloud world
game.net.send({ t: 'debug', c: 'time', v: 0 })             // morning
game.net.send({ t: 'debug', c: 'god', v: 1 })              // cannot be hurt
game.net.send({ t: 'debug', c: 'grow' })                   // all your dragons become adults
game.net.send({ t: 'debug', c: 'site', kind: 'dorp' })     // jump to the nearest village ('kasteel', 'kamp', 'circuit', 'pretpark')
game.net.send({ t: 'debug', c: 'weather', k: 'onweer' })   // 'zon', 'regen', 'onweer', 'sneeuw', 'storm'
game.net.send({ t: 'debug', c: 'herd', kind: 'schaap' })   // a herd next to you ('koe', 'wolf', 'beer')
game.net.send({ t: 'debug', c: 'hatch' })                  // every egg in an incubator hatches now
game.net.send({ t: 'debug', c: 'give', id: 347, n: 1 })     // a car (347-354 are the vehicles, 355 a jerrycan, 356 a spanner)
game.net.send({ t: 'debug', c: 'pet', a: 'paard' })        // an animal of your own without an egg (optional sh: 'golden')
game.net.send({ t: 'debug', c: 'spawn', kind: 'd_eenhoorn', dx: 3 })   // any animal from src/shared/animals.js
```

Add `&save=test` (any short name) to play in a separate world that does not touch the real
one: `index.html?debug&save=test`.

Block and item ids are in `src/shared/blocks.js` and `src/shared/items.js` (see "Block and item
numbers" above).
