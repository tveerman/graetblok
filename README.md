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
| Camera (first / third person) | 📷 | `V` |
| Mount / dismount dragon | "🐉 Vliegen" / "Afstappen" | `R` |
| Hotbar | tap a slot | `1`–`9` or scroll |

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
- **Story quests** – 18 steps from "chop a tree" to "defeat the Drakenkoning", shown top-left,
  with a compass marker for the early ones.

Not in yet: vehicles and robots you can drive, villages and traders, the economy (question 19
in the design is still open), hunger/thirst, weather and disasters, the other five worlds, and
real multiplayer.

## How the code is organised

```
index.html, css/          the page and HUD styling
vendor/                   three.js (unmodified)
src/shared/               game data used by both sides: blocks, items, recipes, creatures, worlds
src/server/               the game server: world generation, block edits, inventory, crafting,
                          creatures, bosses, dragons, quests, saving
src/client/               everything you see and hear: rendering, sprites, input, UI, sound
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

### Performance notes (old iPad)

- One draw call per chunk and pass, no shadows; lighting is baked into vertices and day/night
  is a single uniform.
- World generation and creature simulation run in the worker, off the render thread.
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
```

Block and item ids are in `src/shared/blocks.js` and `src/shared/items.js`.
