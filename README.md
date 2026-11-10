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
| Pause menu (settings, back to the home screen) | ⚙️ | `Esc` |
| Camera (first / third person) | 📷 | `V` |
| Full screen on / off | the ⛶ button next to ⚙️ | the same button |
| Dragon window (feed, name, stay/follow) | "🐉 <name>" button when it is near, or tap the dragon | `G` |
| Mount / dismount dragon | "🐉 Vliegen" / "Afstappen" | `R` |
| Talk and trade, shear a sheep, milk a cow | tap the villager or animal | right mouse button or `F` |
| Hotbar | tap a slot | `1`–`9` or scroll |

While any window is open (backpack, quest log, a dialog or the pause menu) the world stands
still: no time passes and nothing attacks. The game also opens the pause menu by itself when
the tablet is put away or the tab is hidden.

The pause menu has separate switches for music ("Muziek") and sound effects
("Geluidseffecten"). Its last line reports what the audio is doing on that device, for example
"Geluid: aan · muziek: 262 noten gespeeld, sterkte 9% · effecten: aan" — useful when a device
stays silent. On iPad and iPhone the line ends with "stille stand omzeild: ja/nee": Web Audio
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
- **Story quests** – 18 steps from "chop a tree" to "defeat the Drakenkoning", shown top-left,
  with a compass marker for the early ones.

Not in yet: vehicles and robots you can drive, villages and traders, the economy (question 19
in the design is still open), hunger/thirst, weather and disasters, the other five worlds, and
real multiplayer.

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

To make it real multiplayer later, the server code can move to another machine largely as-is:

1. Write a Node entry point that does what `worker.js` does, but creates one `conn`
   (`{ send(msg), onmessage }`) per WebSocket connection and calls `server.connect(conn)`.
   Chunk data is sent as a `Uint8Array`, so use binary frames (or encode it) there.
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
- "Mooie graphics" costs two texture lookups and per-pixel lighting for every block pixel, and
  about 50 MB of texture memory; the pause menu shows the frame rate and resolution so you
  can see what a device can handle.
- Creatures further than about 60 blocks away are not drawn (a village has some twenty
  inhabitants, each built from a dozen boxes).
- The render resolution lowers itself automatically when the frame rate drops
  ("Scherpte aanpassen" in the pause menu), and "Kijkafstand" sets how far you can see
  (default 4 on touch devices, 5 on desktop).

### Developer mode

Open the game with `?debug` in the address to enable cheat messages from the browser console,
for example:

```js
game.net.send({ t: 'debug', c: 'give', id: 310, n: 1 })   // an ice portal core
game.net.send({ t: 'debug', c: 'world', w: 'wolken' })     // jump to the cloud world
game.net.send({ t: 'debug', c: 'time', v: 0 })             // morning
game.net.send({ t: 'debug', c: 'god', v: 1 })              // cannot be hurt
game.net.send({ t: 'debug', c: 'grow' })                   // all your dragons become adults
game.net.send({ t: 'debug', c: 'site', kind: 'dorp' })     // jump to the nearest village ('kasteel', 'kamp')
game.net.send({ t: 'debug', c: 'weather', k: 'onweer' })   // 'zon', 'regen', 'onweer', 'sneeuw', 'storm'
game.net.send({ t: 'debug', c: 'herd', kind: 'schaap' })   // a herd next to you ('koe', 'wolf', 'beer')
```

Add `&save=test` (any short name) to play in a separate world that does not touch the real
one: `index.html?debug&save=test`.

Block and item ids are in `src/shared/blocks.js` and `src/shared/items.js`.
