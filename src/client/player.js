// De speler: lopen, springen, zwemmen, vliegen op een draak, hakken, bouwen en vechten.
import * as THREE from '../../vendor/three.module.min.js';
import { EYE, REACH, CH, clamp, idx } from '../shared/constants.js';
import { VEHICLES, vehStats, ROAD_BONUS } from '../shared/vehicles.js';
import { CROP_OF_SEED } from '../shared/farm.js';
import { B, BLOCKS, B_SHAPE, B_ROAD, SHAPE_LIQUID, PORTAL_TO, TILE_CRACK, isBlock } from '../shared/blocks.js';
import { ITEMS, I } from '../shared/items.js';
import { BREATH } from '../shared/mobs.js';
import { RAIL_DX, RAIL_DZ, railLinks, railExit, railRamp, railPos, railAt, railDirOf } from '../shared/rails.js';
import { playerModel, animate, setArmor, buildArms } from './models.js';
import { iconCanvas } from './textures.js';

const HW = 0.3, HH = 1.8;
const _v = new THREE.Vector3();
const _L = [0, 0, 0, 0], _P = [0, 0, 0, 0];

const AIR_MAX = 15;        // zoveel tellen kun je onder water blijven
const _qy = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
// Zeestromingen: brede banen in de zee waar het water een kant op stroomt. Geeft de richting
// en kracht terug (blokken per tel), of null waar geen stroming is. De banen liggen vast in de
// wereld, dus je kunt leren waar ze zijn.
function seaFlow(x, z) {
  const k = Math.sin(x / 37) + Math.cos(z / 41) + Math.sin((x + z) / 53);
  if (k < 1.5) return null;
  const a = Math.sin(x / 90) * 2 + Math.cos(z / 110) * 2, kracht = Math.min(2.6, 1.4 + (k - 1.5) * 2);
  return { x: Math.cos(a) * kracht, z: Math.sin(a) * kracht };
}
const _seat = new THREE.Vector3();
export class Player {
  constructor(game) {
    this.g = game;
    this.pos = new THREE.Vector3(0, 60, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = false; this.inWater = false; this.headIn = 0;
    this.mount = 0; this.mountScale = 1;
    this.mountKind = '';          // 'trein' = op een trein, 'dier' = rijden over de grond, 'vlieg' = op een vliegend dier, '' = op een draak
    this.veh = null; this.carYaw = 0; this.carV = 0; this.vehFuel = 0; this.vehDmg = 0; this.vehDist = 0; this.vehBump = 0; this.vehT = 0;      // het voertuig waar je in zit
    this.wetY = 0; this.wetT = 0;                                  // voor het uit het water klimmen (zie walk)
    this.air = AIR_MAX; this.drownT = 0; this.airShown = -1;      // lucht onder water
    this.seatH = 0; this.rideSp = 0;      // hoe hoog je op je rijdier zit en hoe hard het loopt
    this.rail = null;             // waar de trein op het spoor is: { x, y, z, din, dout, t, v, end }
    this.railV = 0; this.trainYaw = 0; this.trainPitch = 0; this.rev = false;
    this.cam = 0;
    this.fallPeak = 0; this.softLand = true;
    this.safe = new THREE.Vector3(0, 60, 0);
    this.safeT = 0;
    this.dig = null; this.digCd = 0; this.digTick = 0;
    this.atkCd = 0; this.useCd = 0; this.shootCd = 0;
    this.portalT = 0; this.portalLock = 0;
    this.lavaT = 0;
    this.stepDist = 0; this.bobPh = 0;
    this.autoJump = true;
    this.sendT = 0;
    this.speedNow = 0;
    this.swing = 0;
    this.frozen = true;
    this.dead = false;
    this.target = null;

    const scene = game.R.scene, cam = game.R.camera;
    scene.add(cam);
    // kader om het blok waar je naar wijst
    this.hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, fog: false }));
    this.hl.visible = false;
    scene.add(this.hl);
    // scheurtjes tijdens het hakken
    this.crackTex = TILE_CRACK.map((t) => { const tx = new THREE.CanvasTexture(game.atlas.canvases[t]); return tx; });
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), new THREE.MeshBasicMaterial({ map: this.crackTex[0], transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.crack.visible = false;
    scene.add(this.crack);
    // wat je vasthoudt (eerste persoon)
    this.heldTex = new THREE.CanvasTexture(iconCanvas(B.gras));
    this.heldTex.colorSpace = THREE.SRGBColorSpace;
    this.held = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshBasicMaterial({ map: this.heldTex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    this.held.position.set(0.4, -0.2, -0.62);
    this.held.renderOrder = 30;
    this.held.visible = false;
    this.heldId = -1;
    cam.add(this.held);
    this.model = null;
    this.setLook(game.look);
  }

  setLook(look) {
    if (this.model) this.g.R.scene.remove(this.model);
    this.model = playerModel(look);
    this.model.visible = false;
    this.g.R.scene.add(this.model);
    // je eigen armen voor als je door je eigen ogen kijkt
    const cam = this.g.R.camera;
    if (this.fpArms) for (const a of this.fpArms) cam.remove(a);
    this.fpArms = buildArms(look);
    for (const a of this.fpArms) { a.visible = false; cam.add(a); }
    // wat je vasthoudt zie je ook van buitenaf: een plaatje in de rechterhand van het poppetje
    const A = this.model.userData.a;
    this.handItem = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: this.heldTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
    this.handItem.rotation.y = Math.PI / 2;
    this.handItem.position.set(0, -A.S.fore - 0.1, 0.14);
    const dwars = new THREE.Mesh(this.handItem.geometry, this.handItem.material); dwars.rotation.y = Math.PI / 2;      // kruislings, zodat je het van alle kanten ziet
    this.handItem.add(dwars);
    this.handItem.visible = false;
    A.arms[1].el.add(this.handItem);
  }

  teleport(x, y, z, yaw) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0);
    if (yaw !== undefined) this.yaw = yaw;
    this.fallPeak = y; this.softLand = true; this.safe.copy(this.pos);
    this.dig = null; this.portalT = 0; this.portalLock = 3;
  }

  setMount(id, scale, kind, seat, sp, m) {
    if (id) {
      this.mount = id; this.mountScale = scale || 1; this.mountKind = kind || '';
      this.seatH = seat || 0; this.rideSp = sp || 7;
      this.vel.set(0, 0, 0);
      if (kind === 'rit') {
        // in een attractie: je zit op een stoel van het model en beweegt daarmee mee
        const e = this.g.ents.map.get(id), a = e && e.group.userData.a;
        if (!a || !a.canBoard(this.g.time)) { this.mount = 0; this.mountKind = ''; this.g.net.send({ t: 'dismount' }); this.g.ui.toast((a && a.wacht) || 'Dat kan nu even niet.'); this.g.ents.ridden = 0; return; }
        this.rideA = a; this.rideE = e;
        this.rideSeat = a.pickSeat(this.g.time, this.pos.x, this.pos.z);
        this.rideEnd = a.endTime(this.g.time);
        this.rideOut = false;
        this.g.ents.ridden = id;
        return;
      }
      if (kind === 'auto' || kind === 'heli') {
        // in een voertuig: je staat waar het voertuig staat en kijkt mee in zijn rijrichting
        const e = this.g.ents.map.get(id);
        this.veh = VEHICLES[m.veh]; this.carV = 0; this.vehDist = 0; this.vehBump = 0; this.vehT = 0;
        this.vehFuel = m.fuel; this.vehDmg = m.dmg; this.vehUp = m.up || {};
        this.slipYaw = typeof m.yaw === 'number' ? m.yaw : this.yaw; this.nitroLeft = vehStats(this.veh, this.vehUp).nitro; this.driftPts = 0; this.driftNow = 0; this.driftLap = 0;
        this.track = null; this.wasStart = false; this.lapT = -1;
        this.carYaw = typeof m.yaw === 'number' ? m.yaw : this.yaw; this.yaw = this.carYaw;
        if (e) { this.pos.x = e.x; this.pos.z = e.z; this.pos.y = e.y + (kind === 'heli' ? this.seatH : 0) + 0.05; }
        this.g.ents.ridden = id;
        return;
      }
      if (kind === 'trein') this.startRail(this.g.ents.map.get(id));
      else if (kind === 'dier') { const e = this.g.ents.map.get(id); if (e) { this.pos.x = e.x; this.pos.z = e.z; this.pos.y = Math.max(this.pos.y, e.y) + 0.1; } }      // je staat nu waar het dier staat
      else if (kind === 'vlieg') this.pos.y += this.seatH + 0.6;
      else this.pos.y += 1.3 * this.mountScale + 0.4;
    } else if (this.mount) {
      if (this.mountKind === 'trein') {
        // uitstappen: naast de trein gaan staan
        this.pos.x += Math.cos(this.trainYaw) * 1.3; this.pos.z -= Math.sin(this.trainYaw) * 1.3; this.pos.y += 0.25;
        this.rail = null; this.railV = 0;
      }
      this.raceHold = 0;
      if (this.mountKind === 'rit' && this.rideE) { const x = this.rideA.exit; this.pos.set(this.rideE.x + x[0], this.rideE.y + x[1], this.rideE.z + x[2]); this.vel.set(0, 0, 0); this.rideA = null; this.rideE = null; }
      if (this.veh) { this.flushVeh(); this.pos.x += Math.cos(this.carYaw) * (this.veh.size[0] / 2 + 0.7); this.pos.z -= Math.sin(this.carYaw) * (this.veh.size[0] / 2 + 0.7); this.pos.y += 0.2; this.veh = null; this.g.sound.engine(0); this.g.ui.setVeh(''); }
      // (geen zachte landing: stap je hoog in de lucht af, dan val je echt)
      this.mount = 0; this.mountKind = ''; this.softLand = false; this.fallPeak = this.pos.y;
    }
    this.g.ents.ridden = this.mount;
  }

  // ---------- treinrijden ----------

  // Bij het instappen: op welk stuk rails staat de trein, en welke kant kijkt hij op?
  startRail(e) {
    const w = this.g.world, get = (x, y, z) => w.getBlock(x, y, z);
    this.rail = null; this.rev = false; this.railV = 0;
    if (!e) return;
    this.trainYaw = e.yaw; this.trainPitch = 0;
    const x = Math.floor(e.x), z = Math.floor(e.z), y = railAt(get, x, e.y + 0.3, z);
    this.pos.set(e.x - Math.sin(e.yaw) * 0.67, e.y + 0.9, e.z - Math.cos(e.yaw) * 0.67);
    if (y < 0) { this.g.ui.toast('Deze trein staat niet op rails.', 'warn'); return; }
    const d = railDirOf(e.yaw);
    const out = railExit(railLinks(get, x, y, z, _L), d, 0);
    this.rail = { x, y, z, din: d, dout: out < 0 ? d : out, t: 0.5, v: 0, end: out < 0 };
  }

  // De trein volgt het spoor. Stick naar voren = gas, naar achteren = remmen en achteruit,
  // opzij = kiezen bij een wissel.
  ride(dt) {
    const g = this.g, inp = g.input, w = g.world, R = this.rail;
    this.vel.set(0, 0, 0); this.onGround = false; this.inWater = false; this.fallPeak = this.pos.y; this.softLand = true;
    if (!R) { this.speedNow = 0; this.railV = 0; return; }
    const get = (x, y, z) => w.getBlock(x, y, z);
    const want = inp.fwd > 0.2 ? 1 : inp.fwd < -0.2 ? -1 : 0, sense = this.rev ? -1 : 1;
    if (want === sense) R.v = Math.min(this.rev ? 6 : (inp.sprint ? 17 : 13), R.v + 4.5 * dt);
    else if (want === 0) R.v = Math.max(0, R.v - 1.6 * dt);
    else {
      R.v = Math.max(0, R.v - 12 * dt);
      if (R.v <= 0) {
        // omkeren: de trein rijdt hetzelfde stuk rails terug
        const din = (R.dout + 2) & 3, dout = (R.din + 2) & 3;
        R.din = din; R.dout = dout; R.t = 1 - R.t; R.end = false; this.rev = !this.rev;
      }
    }
    const steer = (inp.strafe > 0.35 ? 1 : inp.strafe < -0.35 ? -1 : 0) * (this.rev ? -1 : 1);
    let dist = R.v * dt, guard = 0;
    while (dist > 0 && guard++ < 8) {
      const lim = R.end ? 0.5 : 1, room = lim - R.t;
      if (dist < room) { R.t += dist; break; }
      R.t = lim; dist -= room;
      if (R.end) { R.v = 0; break; }
      const link = railLinks(get, R.x, R.y, R.z, _L)[R.dout];
      if (!link) { R.v = 0; break; }                                   // het spoor houdt op
      R.x += RAIL_DX[R.dout]; R.z += RAIL_DZ[R.dout]; R.y += link === 2 ? 1 : link === 3 ? -1 : 0;
      R.din = R.dout; R.t = 0;
      const out = railExit(railLinks(get, R.x, R.y, R.z, _L), R.din, steer);
      if (out < 0) { R.end = true; R.dout = R.din; } else { R.end = false; R.dout = out; }
    }
    const ramp = railRamp(railLinks(get, R.x, R.y, R.z, _L));
    railPos(R.x, R.y, R.z, R.din, R.dout, R.t, ramp, _P);
    const yaw = _P[3] + (this.rev ? Math.PI : 0);
    this.trainYaw = yaw;
    this.trainPitch = ramp < 0 ? 0 : (ramp === R.din ? 0.785 : ramp === ((R.din + 2) & 3) ? -0.785 : 0) * (this.rev ? -1 : 1);
    this.pos.set(_P[0] - Math.sin(yaw) * 0.67, _P[1] + 1.0, _P[2] - Math.cos(yaw) * 0.67);
    this.railV = R.v; this.speedNow = R.v;
    this.chugT = (this.chugT || 0) - dt * (0.5 + R.v * 0.42);
    if (this.chugT <= 0 && R.v > 0.3) { this.chugT = 1; g.sound.play('chug', 0.45 + Math.min(0.5, R.v / 22)); }
    if (get(R.x, R.y, R.z) !== B.rails) { this.rail = null; g.ui.toast('De trein is van de rails!', 'warn'); }
  }

  // In een attractie: je zit op je stoel en beweegt mee tot het ritje is afgelopen.
  rideTick() {
    const a = this.rideA, g = this.g;
    if (!a || !this.rideE || !g.ents.map.has(this.mount)) { g.net.send({ t: 'dismount' }); return; }
    a.seats[this.rideSeat].getWorldPosition(_seat);
    const ox = this.pos.x, oy = this.pos.y, oz = this.pos.z;
    this.pos.copy(_seat);
    this.speedNow = 0; this.vel.set(0, 0, 0); this.onGround = false; this.fallPeak = this.pos.y; this.softLand = true; this.inWater = false;
    // hoe harder het gaat, hoe meer de wind suist
    this.rideV = Math.hypot(this.pos.x - ox, this.pos.y - oy, this.pos.z - oz);
    if (g.time >= this.rideEnd && !this.rideOut) { this.rideOut = true; g.net.send({ t: 'dismount' }); }
  }

  // Een auto, motor, vrachtwagen of boot besturen. Stick naar voren = gas, naar achteren =
  // remmen en achteruit, opzij = sturen. De camera kijkt vanzelf mee in de rijrichting.
  drive(dt) {
    const g = this.g, inp = g.input, w = g.world, V = this.veh;
    let hw = Math.min(0.75, Math.max(HW, V.size[0] * 0.42)), hh = Math.max(1.2, V.size[1]);
    // staat hij klem (te dicht tegen een muur of onder een laag dak neergezet)? dan rekenen we
    // even met een smal, laag voertuig, zodat je er altijd weer uit kunt rijden
    if (w.boxHits(this.pos.x, this.pos.y, this.pos.z, hw, hh)) { hw = HW; hh = 1.0; }
    if (w.boxHits(this.pos.x, this.pos.y, this.pos.z, HW, 1.0)) { this.pos.y = Math.floor(this.pos.y) + 1; this.vel.set(0, 0, 0); return; }
    const feet = w.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.35), Math.floor(this.pos.z));
    const under = w.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.25), Math.floor(this.pos.z));
    const wet = feet > 0 && B_SHAPE[feet] === SHAPE_LIQUID, onWater = wet || (under > 0 && B_SHAPE[under] === SHAPE_LIQUID);
    this.inWater = wet;
    const boat = V.soort === 'boot';
    // hoe hard mag hij nu? leeg of kapot = stil; een auto in het water en een boot op het land kruipen
    const S = vehStats(V, this.vehUp), road = under > 0 && B_ROAD[under] === 1;
    let top = S.max * (1 - 0.5 * Math.min(1, this.vehDmg / 100)) * (road ? ROAD_BONUS : 1);
    // nitro: de sprintknop geeft een flinke zet, tot hij op is; daarna laadt hij weer op
    let acc = S.acc;
    const boost = S.nitro > 0 && inp.sprint && inp.fwd > 0.15 && this.nitroLeft > 0.05 && !boat;
    if (boost) {
      this.nitroLeft -= dt; top *= 1.4; acc *= 1.8;
      if (Math.random() < dt * 40) g.particles.add(this.pos.x + Math.sin(this.carYaw) * 1.5, this.pos.y + 0.4, this.pos.z + Math.cos(this.carYaw) * 1.5, (Math.random() - 0.5), 0.6 + Math.random(), (Math.random() - 0.5), 1, 0.55 + Math.random() * 0.3, 0.15, 0.5, 0.35, 0);
    } else if (S.nitro > 0) this.nitroLeft = Math.min(S.nitro, this.nitroLeft + dt * S.nitro / 12);
    if (this.vehFuel <= 0 || this.vehDmg >= 100) top = 0;
    else if (boat ? !onWater : wet) top *= 0.18;
    // bij de start van een race sta je stil tot het groene licht; wie te vroeg gas geeft krijgt straf
    if (this.raceHold) { if (this.raceHold === 1 && inp.fwd > 0.3) this.falseStart = true; this.carV = 0; top = 0; }
    // de handrem (springknop): hij remt en de achterkant breekt uit, zo kun je driften
    const hand = inp.jump && !boat && Math.abs(this.carV) > 2;
    const want = hand ? 0 : inp.fwd > 0.15 ? top : inp.fwd < -0.15 ? -top * 0.35 : 0;
    const braking = !hand && (want === 0 || (want > 0) !== (this.carV > 0));
    const rate = (hand ? 3.5 : braking ? V.acc * S.brake * (want === 0 ? 0.45 : 1) : acc) * dt;
    this.carV += Math.max(-rate, Math.min(rate, want - this.carV));
    // sturen gaat alleen als je rijdt; achteruit stuurt hij de andere kant op
    const grip = Math.min(1, Math.abs(this.carV) / 3.5) * (this.carV < 0 ? -1 : 1) * (g.sky && g.sky.rain > 0.3 && !boat ? 0.8 : 1);
    this.carYaw -= inp.strafe * S.turn * (hand ? 1.5 : 1) * grip * dt;
    let dy = this.carYaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, 7 * dt);                                  // de camera draait mee
    // De auto glijdt een beetje: de richting waarin hij rijdt loopt achter op waar de neus heen
    // wijst. Met de handrem (of in de regen) is dat veel meer. Dat is driften.
    const wetRoad = g.sky && g.sky.rain > 0.3 && !boat;
    let slip = this.carYaw - this.slipYaw; slip = Math.atan2(Math.sin(slip), Math.cos(slip));
    this.slipYaw += slip * Math.min(1, (hand ? 1.3 : 7 * S.grip * (wetRoad ? 0.55 : 1)) * dt);
    this.vel.x = -Math.sin(this.slipYaw) * this.carV; this.vel.z = -Math.cos(this.slipYaw) * this.carV;
    // driftpunten: zolang je hard genoeg dwars gaat
    if (Math.abs(slip) > 0.28 && Math.abs(this.carV) > 5 && this.onGround) { this.driftNow += Math.abs(this.carV) * Math.abs(slip) * dt * 14; this.driftHold = 0.6; }
    else if (this.driftNow > 0) { this.driftHold -= dt; if (this.driftHold <= 0) { this.driftPts += this.driftNow; this.driftLap += this.driftNow; if (this.driftNow > 120) g.ui.toast('💨 Drift: ' + Math.round(this.driftNow) + ' punten!'); this.driftNow = 0; } }
    if (boat && wet) { this.vel.y = Math.min(this.vel.y + 22 * dt, 2.2); }      // een boot drijft
    else { this.vel.y -= 27 * dt; if (this.vel.y < -48) this.vel.y = -48; }
    const vmax = Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y), Math.abs(this.vel.z));
    const steps = Math.max(1, Math.ceil(vmax * dt / 0.4)), sdt = dt / steps;
    let blocked = false;
    const ox = this.pos.x, oz = this.pos.z;
    for (let i = 0; i < steps; i++) {
      if (this.moveX(this.vel.x * sdt, hw, hh, 0)) blocked = true;
      if (this.moveZ(this.vel.z * sdt, hw, hh, 0)) blocked = true;
      this.moveY(this.vel.y * sdt, hw, hh, 0);
    }
    this.fallPeak = this.pos.y; this.softLand = true;
    if (blocked && Math.abs(this.carV) > 0.6) {
      // tegen een blok: één blok omhoog kan hij nemen, hoger is een botsing
      const s = this.carV > 0 ? 1 : -1, px = this.pos.x - Math.sin(this.carYaw) * 0.6 * s, pz = this.pos.z - Math.cos(this.carYaw) * 0.6 * s;
      const free = !w.boxHits(px, this.pos.y + 1.05, pz, hw, hh) && !w.boxHits(this.pos.x, this.pos.y + 1.05, this.pos.z, hw, hh);
      if (hand) { /* met de handrem erop klimt hij niet */ } else if (free && (this.onGround || wet)) { this.vel.y = 8.2; this.onGround = false; this.carV *= V.offroad ? 0.92 : 0.7; }
      else if (!free) {
        if (Math.abs(this.carV) > 7) { this.vehBump += Math.round((Math.abs(this.carV) - 5) * 1.5); g.sound.play('hit', 0.9); this.shake = Math.max(this.shake || 0, 0.25); }
        this.carV *= -0.15;
      }
    }
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    this.vehDist += moved;
    this.speedNow += (moved / dt - this.speedNow) * Math.min(1, dt * 10);
  }

  // brandstof, schade, het motorgeluid en het schermpje van het voertuig
  vehicleTick(dt) {
    const g = this.g, V = this.veh;
    if (this.mountKind === 'heli') {
      // een helikopter verbruikt ook als hij stil hangt; zonder brandstof zakt hij
      this.vehDist += (4 + this.speedNow) * dt;
      if (this.vehFuel <= 0 || this.vehDmg >= 100) this.vel.y = Math.min(this.vel.y, -6);
      this.carYaw = this.yaw;
      this.speedNow = Math.hypot(this.vel.x, this.vel.y, this.vel.z);
    }
    this.vehT += dt;
    if (this.vehT >= 1) this.flushVeh();
    g.sound.engine(this.vehFuel > 0 && this.vehDmg < 100 ? 1 : 0, this.speedNow / V.max, V.soort);
    this.clock = (this.clock || 0) + dt;                 // de klok van de rondetijd (staat stil als het spel op pauze staat)
    if (this.mountKind === 'auto' && V.soort === 'weg') this.raceTick();
    const S = vehStats(V, this.vehUp);
    const mmss = (s) => Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60).toFixed(1);
    const T = this.track;
    const t = '⛽ ' + Math.round(this.vehFuel / V.tank * 100) + '%  ·  🔧 ' + Math.round(100 - this.vehDmg) + '%  ·  ' + Math.round(this.speedNow * 3.6) + ' km/u' +
      (S.nitro ? '  ·  🔥 ' + '▮'.repeat(Math.round(this.nitroLeft / S.nitro * 5)) + '▯'.repeat(5 - Math.round(this.nitroLeft / S.nitro * 5)) : '') +
      (this.driftNow > 5 ? '  ·  💨 ' + Math.round(this.driftNow) : '') +
      (T && this.lapT >= 0 ? '  ·  ⏱ ' + mmss(this.clock - this.lapT) + (T.cps.length ? ' ✔ ' + T.done.filter(Boolean).length + '/' + T.cps.length : '') + (T.best ? ' (record ' + mmss(T.best) + ')' : '') : '') +
      (this.vehFuel <= 0 ? '  ·  De tank is leeg! Tik met een jerrycan op het voertuig.' : this.vehDmg >= 100 ? '  ·  Kapot! Repareer met een moersleutel.' : '');
    if (t !== this.vehText) { this.vehText = t; g.ui.setVeh(t); }
    if (this.vehDmg > 55 && Math.random() < dt * 6) g.particles.add(this.pos.x - Math.sin(this.carYaw) * 1.1, this.pos.y + 1.0, this.pos.z - Math.cos(this.carYaw) * 1.1, (Math.random() - 0.5) * 0.4, 1.2 + Math.random(), (Math.random() - 0.5) * 0.4, 0.25, 0.25, 0.27, 0.6, 1.3, -0.5);
  }

  // ---------- rondes rijden ----------
  // Rijd je over een startlijn, dan begint de klok. Haal alle checkpoints van de baan en rijd
  // weer over de startlijn: dat is een ronde. Het spel zoekt de baan zelf op: de startlijn
  // waar je overheen rijdt en alle checkpoint-blokken in de buurt (tot zo'n 70 blokken).
  raceTick() {
    const g = this.g, w = g.world;
    const bx = Math.floor(this.pos.x), bz = Math.floor(this.pos.z), by = Math.floor(this.pos.y - 0.25);
    const id = w.getBlock(bx, by, bz);
    const onStart = id === B.startlijn;
    if (this.track && Math.hypot(this.pos.x - this.track.x, this.pos.z - this.track.z) > 260) { this.track = null; this.lapT = -1; }      // ver weg gereden: de ronde vervalt
    const T = this.track;
    if (id === B.checkpoint && T && this.lapT >= 0) {
      for (let i = 0; i < T.cps.length; i++) if (!T.done[i] && Math.hypot(T.cps[i][0] - this.pos.x, T.cps[i][1] - this.pos.z) < 9) { T.done[i] = true; g.sound.play('got'); }
    }
    if (onStart && !this.wasStart) {
      if (!T || Math.hypot(this.pos.x - T.x, this.pos.z - T.z) > 14) {
        // een nieuwe baan: de startlijn en de checkpoints opzoeken
        const N = this.findTrack(bx, by, bz);
        this.track = N; this.lapT = this.clock; this.driftLap = 0;
        g.net.send({ t: 'trackAt', key: N.key });
        g.ui.toast(N.cps.length ? '🏁 De klok loopt! Haal de ' + N.cps.length + ' checkpoints en rijd weer over de startlijn.' : '🏁 De klok loopt! Rijd een rondje en kom weer over de startlijn.');
        g.sound.play('quest', 0.5);
      } else if (this.lapT >= 0 && T.done.every(Boolean) && this.clock - this.lapT > (T.cps.length ? 3 : 8)) {
        g.net.send({ t: 'lapDone', key: T.key, time: +(this.clock - this.lapT).toFixed(2), drift: Math.round(this.driftLap) });
        this.lapT = this.clock; T.done.fill(false); this.driftLap = 0;
      } else {
        if (this.lapT >= 0 && T.done.some(Boolean)) g.ui.toast('Je hebt een checkpoint gemist. De ronde begint opnieuw.', 'warn');
        this.lapT = this.clock; T.done.fill(false); this.driftLap = 0;
      }
    }
    this.wasStart = onStart;
  }

  // de baan bij een startlijn: het midden van de lijn (dat is ook de naam van de baan) en de
  // checkpoints, als groepjes blokken die bij elkaar liggen
  findTrack(bx, by, bz) {
    const w = this.g.world;
    let sx = 0, sz = 0, n = 0;
    for (let dx = -12; dx <= 12; dx++) for (let dz = -12; dz <= 12; dz++) for (let dy = -2; dy <= 2; dy++) if (w.getBlock(bx + dx, by + dy, bz + dz) === B.startlijn) { sx += bx + dx; sz += bz + dz; n++; }
    const x = sx / n + 0.5, z = sz / n + 0.5;
    const cps = [], R = 72;
    for (const c of w.chunks.values()) {
      const ox = c.cx * 16, oz = c.cz * 16;
      if (ox + 16 < x - R || ox > x + R || oz + 16 < z - R || oz > z + R) continue;
      for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = Math.max(1, by - 14); y <= by + 14; y++) {
        if (c.b[idx(lx, y, lz)] !== B.checkpoint) continue;
        const px = ox + lx + 0.5, pz = oz + lz + 0.5;
        let hit = null;
        for (const q of cps) if (Math.hypot(q[0] / q[2] - px, q[1] / q[2] - pz) < 9) { hit = q; break; }
        if (hit) { hit[0] += px; hit[1] += pz; hit[2]++; } else cps.push([px, pz, 1]);
      }
    }
    const list = cps.map((q) => [q[0] / q[2], q[1] / q[2]]);
    return { key: 'baan' + Math.round(x / 4) + '_' + Math.round(z / 4), x, z, cps: list, done: list.map(() => false), best: 0 };
  }

  // de server vertellen hoe ver je gereden hebt en of je gebotst bent
  flushVeh() {
    this.vehT = 0;
    if (this.vehDist < 0.05 && !this.vehBump) return;
    this.g.net.send({ t: 'vehUse', d: +this.vehDist.toFixed(2), bump: this.vehBump });
    this.vehDist = 0; this.vehBump = 0;
  }

  heldItem() { const s = this.g.inv[this.g.sel]; return s ? s[0] : 0; }

  // ---------- elke frame ----------

  update(dt) {
    const g = this.g, inp = g.input, w = g.world;
    const [lx, ly] = inp.takeLook();
    if (!this.dead) {
      this.yaw -= lx; this.pitch = clamp(this.pitch - ly, -1.54, 1.54);
    }
    if (this.atkCd > 0) this.atkCd -= dt;
    if (this.useCd > 0) this.useCd -= dt;
    if (this.shootCd > 0) this.shootCd -= dt;
    if (this.digCd > 0) this.digCd -= dt;
    if (this.portalLock > 0) this.portalLock -= dt;
    if (this.swing > 0) this.swing -= dt;

    const ready = !this.frozen && !this.dead && w.isLoaded(this.pos.x, this.pos.z);
    if (ready) {
      if (this.mountKind === 'rit') this.rideTick(); else if (!this.mount || this.mountKind === 'dier') this.walk(dt); else if (this.mountKind === 'trein') this.ride(dt); else if (this.mountKind === 'auto') this.drive(dt); else this.fly(dt);
      if (this.veh) this.vehicleTick(dt);
      this.environment(dt);
    } else { this.vel.set(0, 0, 0); this.speedNow = 0; }

    this.updateCamera(dt);
    if (ready) this.actions(dt);
    else { this.hl.visible = false; this.crack.visible = false; }

    this.sendT += dt;
    if (this.sendT >= 0.1 && !this.frozen) {
      this.sendT = 0;
      const m = { t: 'move', x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.yaw, pitch: this.pitch };
      if (this.mountKind === 'trein') m.ry = this.trainYaw;
      if (this.veh) { m.ry = this.carYaw; if (this.mountKind === 'heli') { m.air = 1; m.seat = this.seatH; } }
      g.net.send(m);
    }
  }

  walk(dt) {
    const g = this.g, inp = g.input, w = g.world;
    // zit je vast in een blok (bijv. omdat er iets op je is gebouwd)? dan omhoog
    if (w.boxHits(this.pos.x, this.pos.y, this.pos.z, HW, HH)) {
      this.pos.y = Math.floor(this.pos.y) + 1; this.vel.set(0, 0, 0); this.fallPeak = this.pos.y; this.softLand = true;
      return;
    }
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    let wx = -sinY * inp.fwd + cosY * inp.strafe, wz = -cosY * inp.fwd - sinY * inp.strafe;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const feet = w.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
    const wasWater = this.inWater;
    this.inWater = feet > 0 && B_SHAPE[feet] === SHAPE_LIQUID;
    if (this.inWater && !wasWater && this.vel.y < -3) g.sound.play('splash');
    let speed = this.inWater ? 2.9 : (inp.sprint ? 6.3 : 4.5);
    if (this.mountKind === 'dier') speed = this.inWater ? 3.6 : this.rideSp * (inp.sprint ? 1.3 : 1);      // op een rijdier ga je harder
    if (g.trees.ijs) speed *= 1.25;
    const acc = Math.min(1, (this.onGround ? 14 : (this.inWater ? 6 : 4)) * dt);
    // Zeestromingen: in diep, open water word je op sommige plekken meegevoerd. Je ziet het
    // aan de belletjes die met de stroom mee gaan. Wie tegen de stroom in zwemt komt maar
    // langzaam vooruit; zwem er schuin uit.
    let sx = 0, sz = 0;
    if (this.inWater && !this.mount) {
      const f = seaFlow(this.pos.x, this.pos.z);
      if (f && g.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y) - 2, Math.floor(this.pos.z)) === B.water) {
        sx = f.x; sz = f.z;
        if (Math.random() < dt * 14) g.particles.add(this.pos.x + (Math.random() - 0.5) * 6, this.pos.y + Math.random() * 1.4, this.pos.z + (Math.random() - 0.5) * 6, f.x * 1.6, 0.1, f.z * 1.6, 0.8, 0.95, 1, 0.6, 1.2, 0);
        if (!this.stroomT || g.time - this.stroomT > 20) { this.stroomT = g.time; g.ui.toast('🌊 Een sterke stroming! Zwem er schuin uit.'); }
      }
    }
    this.vel.x += (wx * speed + sx - this.vel.x) * acc;
    this.vel.z += (wz * speed + sz - this.vel.z) * acc;
    if (this.inWater) {
      this.vel.y -= 7 * dt;
      this.vel.y *= 1 - Math.min(1, 2 * dt);
      if (inp.jump) this.vel.y = Math.min(this.vel.y + 24 * dt, 3.6);
      if (this.vel.y < -3.5) this.vel.y = -3.5;
      this.fallPeak = this.pos.y;
    } else {
      this.vel.y -= 27 * dt;
      // springlaarzen in je rugzak: je springt twee blokken hoog
      if (inp.jump && this.onGround) { this.vel.y = (g.trees.wolken ? 10.6 : 8.6) + (g.boots ? (g.trees.wolken ? 1.4 : 2) : 0); this.onGround = false; }
      if (this.vel.y < -48) this.vel.y = -48;
    }

    const wasGround = this.onGround;
    const vmax = Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y), Math.abs(this.vel.z));
    const steps = Math.max(1, Math.ceil(vmax * dt / 0.4));
    const sdt = dt / steps;
    let blocked = false;
    const ox = this.pos.x, oz = this.pos.z;
    for (let i = 0; i < steps; i++) {
      if (this.moveX(this.vel.x * sdt, HW, HH, 0)) blocked = true;
      if (this.moveZ(this.vel.z * sdt, HW, HH, 0)) blocked = true;
      this.moveY(this.vel.y * sdt, HW, HH, 0);
    }
    if (this.pos.y > this.fallPeak || this.onGround) {
      if (this.onGround && !wasGround) this.land();
      this.fallPeak = this.pos.y;
    }
    // automatisch een blok omhoog springen
    // Uit het water of de lava klimmen. Zwem (of loop) tegen de kant aan en je klimt langs de
    // wand omhoog, tot drie blokken boven het water. Zonder dit kwam je uit een kuil met water
    // of lava niet meer weg: springen komt maar een klein stukje boven het water uit.
    if (this.inWater) {
      this.wetY = this.pos.y; this.wetT = 0.7;
      // lig je er al een tijdje in? dan één keer vertellen hoe je eruit komt
      this.wetLong = (this.wetLong || 0) + dt;
      if (this.wetLong > 6 && !this.wetTold) { this.wetTold = true; g.ui.toast('Zwem tegen de kant aan: dan klim je eruit.'); }
    } else { if (this.wetT > 0) this.wetT -= dt; else { this.wetLong = 0; this.wetTold = false; } }
    const climbing = blocked && wl > 0.2 && !this.inWater && this.wetT > 0 && this.pos.y < this.wetY + 3.4;
    if (climbing) { this.vel.y = Math.max(this.vel.y, 4.6); this.wetT = 0.7; this.fallPeak = this.pos.y; this.onGround = false; }
    else if (blocked && wl > 0.2 && (this.onGround || this.inWater)) {
      const px = this.pos.x + wx * 0.45, pz = this.pos.z + wz * 0.45;
      if (this.inWater) this.vel.y = Math.max(this.vel.y, 5.2);
      else if (this.autoJump && !w.boxHits(px, this.pos.y + 1.05, pz, HW, HH) && !w.boxHits(this.pos.x, this.pos.y + 1.05, this.pos.z, HW, HH)) { this.vel.y = 8.6; this.onGround = false; }
    }
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    this.speedNow += (moved / dt - this.speedNow) * Math.min(1, dt * 10);
    if (this.onGround && moved > 0.001) {
      this.stepDist += moved; this.bobPh += moved * 2.6;
      if (this.stepDist > 2.1) {
        this.stepDist = 0;
        const below = w.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z));
        g.sound.play('step', 0.8, below > 0 ? BLOCKS[below].snd : 'stone');
      }
    }
  }

  land() {
    const g = this.g;
    const fall = this.fallPeak - this.pos.y;
    if (fall > 1.2) {
      const below = g.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z));
      g.sound.play('step', 1, below > 0 ? BLOCKS[below].snd : 'stone');
    }
    if (fall > 4.2 && !this.inWater && !this.softLand && !g.trees.wolken) g.net.send({ t: 'hurtSelf', k: 'fall', n: Math.floor(fall - 3.2) });
    this.softLand = false;
  }

  fly(dt) {
    const g = this.g, inp = g.input;
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    // een dier of draak vliegt 14 (20 met sprinten); een vliegtuig of helikopter zo hard als zijn motor kan
    const vmax = this.mountKind === 'heli' && this.veh ? vehStats(this.veh, this.vehUp).max * (1 - 0.5 * Math.min(1, this.vehDmg / 100)) : 14;
    const speed = inp.sprint && !inp.down ? vmax * (vmax > 20 ? 1.25 : 1.42) : vmax;
    const tx = (-sinY * cp * inp.fwd + cosY * inp.strafe * 0.7) * speed;
    const tz = (-cosY * cp * inp.fwd - sinY * inp.strafe * 0.7) * speed;
    const ty = sp * inp.fwd * speed + ((inp.jump ? 1 : 0) - (inp.down ? 1 : 0)) * 8;
    const acc = Math.min(1, 2.6 * dt);
    this.vel.x += (tx - this.vel.x) * acc; this.vel.y += (ty - this.vel.y) * acc; this.vel.z += (tz - this.vel.z) * acc;
    const s = this.mountScale;
    const hw = 0.4 + 0.15 * s, below = 0.9 * s, hh = HH + below;
    if (g.world.boxHits(this.pos.x, this.pos.y - below, this.pos.z, hw, hh)) {
      // vastgelopen in een blok: gewoon doorvliegen en een beetje omhoog
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += Math.max(this.vel.y, 3) * dt;
    } else {
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y), Math.abs(this.vel.z)) * dt / 0.4));
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        this.moveX(this.vel.x * sdt, hw, hh, below);
        this.moveZ(this.vel.z * sdt, hw, hh, below);
        this.moveY(this.vel.y * sdt, hw, hh, below);
      }
    }
    // Je kunt tot een flink stuk boven de wolken vliegen (de wolken hangen op 152, in de
    // wolkenwereld op 168): er dwars doorheen en erbovenuit.
    const top = (g.worldId === 'wolken' ? 168 : 152) + 46;
    if (this.pos.y > top) { this.pos.y = top; this.vel.y = Math.min(0, this.vel.y); }
    // Een draak, vliegend dier, helikopter of vliegtuig kan niet door water of lava vliegen:
    // je blijft er vlak boven hangen.
    {
      const wx = Math.floor(this.pos.x), wz = Math.floor(this.pos.z);
      let wy = Math.floor(this.pos.y - below - 0.05);
      const nat = (y) => { const id = g.world.getBlock(wx, y, wz); return id > 0 && B_SHAPE[id] === SHAPE_LIQUID; };
      if (nat(wy)) {
        while (nat(wy + 1)) wy++;
        this.pos.y = wy + 1 + below + 0.06;
        if (this.vel.y < 0) this.vel.y = 0;
      }
    }
    this.onGround = false; this.inWater = false;
    this.fallPeak = this.pos.y;
    this.speedNow = Math.hypot(this.vel.x, this.vel.z);
    this.flapT = (this.flapT || 0) - dt;
    if (this.flapT <= 0) { this.flapT = 0.95; g.sound.play('flap', 0.6); }
  }

  moveX(d, hw, hh, below) {
    if (!d) return false;
    const w = this.g.world, nx = this.pos.x + d, y = this.pos.y - below;
    if (!w.boxHits(nx, y, this.pos.z, hw, hh)) { this.pos.x = nx; return false; }
    const sx = d > 0 ? Math.floor(nx + hw) - hw - 0.001 : Math.floor(nx - hw) + 1 + hw + 0.001;
    if (Math.abs(sx - this.pos.x) < Math.abs(d) && !w.boxHits(sx, y, this.pos.z, hw, hh)) this.pos.x = sx;
    this.vel.x = 0;
    return true;
  }
  moveZ(d, hw, hh, below) {
    if (!d) return false;
    const w = this.g.world, nz = this.pos.z + d, y = this.pos.y - below;
    if (!w.boxHits(this.pos.x, y, nz, hw, hh)) { this.pos.z = nz; return false; }
    const sz = d > 0 ? Math.floor(nz + hw) - hw - 0.001 : Math.floor(nz - hw) + 1 + hw + 0.001;
    if (Math.abs(sz - this.pos.z) < Math.abs(d) && !w.boxHits(this.pos.x, y, sz, hw, hh)) this.pos.z = sz;
    this.vel.z = 0;
    return true;
  }
  moveY(d, hw, hh, below) {
    if (!d) return;
    const w = this.g.world, ny = this.pos.y + d;
    if (!w.boxHits(this.pos.x, ny - below, this.pos.z, hw, hh)) { this.pos.y = ny; this.onGround = false; return; }
    if (d < 0) {
      const sy = w.boxTop(this.pos.x, ny - below, this.pos.z, hw, hh) + below;
      if (sy <= this.pos.y + 0.0001 && !w.boxHits(this.pos.x, sy - below, this.pos.z, hw, hh)) this.pos.y = sy;
      this.onGround = true;
    } else {
      const sy = Math.floor(ny - below + hh) - hh + below - 0.001;
      if (sy >= this.pos.y && !w.boxHits(this.pos.x, sy - below, this.pos.z, hw, hh)) this.pos.y = sy;
    }
    this.vel.y = 0;
  }

  environment(dt) {
    const g = this.g, w = g.world;
    const px = Math.floor(this.pos.x), pz = Math.floor(this.pos.z);
    const mid = w.getBlock(px, Math.floor(this.pos.y + 0.5), pz);
    const low = w.getBlock(px, Math.floor(this.pos.y + 0.1), pz);
    // lava
    if (!this.mount && (mid === B.lava || low === B.lava)) {
      this.lavaT -= dt;
      if (this.lavaT <= 0) { this.lavaT = 0.6; if (!g.trees.vuur) g.net.send({ t: 'hurtSelf', k: 'lava', n: 3 }); }
    } else this.lavaT = 0;
    // Onder water raakt je lucht op: na vijftien tellen zijn de bellen op en gaat er elke tel
    // een hartje af, tot je weer boven komt. Boven water komt de lucht snel terug.
    const head = w.getBlock(px, Math.floor(this.pos.y + EYE), pz);
    const riding = this.mount && this.mountKind !== 'dier';
    if (head === B.water && !riding) {
      if (this.air > 0) this.air = Math.max(0, this.air - dt);
      else { this.drownT -= dt; if (this.drownT <= 0) { this.drownT = 1; g.net.send({ t: 'hurtSelf', k: 'water', n: 2 }); } }
    } else { this.air = Math.min(AIR_MAX, this.air + dt * 5); this.drownT = 0; }
    const bubbles = this.air >= AIR_MAX ? -1 : Math.ceil(this.air / AIR_MAX * 10);
    if (bubbles !== this.airShown) { this.airShown = bubbles; g.ui.setAir(bubbles); }
    // uit de wereld gevallen
    if (this.pos.y < -12) {
      this.pos.copy(this.safe); this.vel.set(0, 0, 0); this.fallPeak = this.pos.y; this.softLand = true;
      g.net.send({ t: 'hurtSelf', k: 'void', n: 4 });
      g.ui.toast('Oeps! Je viel uit de wereld.', 'warn');
    }
    this.safeT += dt;
    if (this.onGround && !this.inWater && this.safeT > 1) { this.safeT = 0; this.safe.set(this.pos.x, this.pos.y + 0.05, this.pos.z); }
    // portaal
    const pid = PORTAL_TO[mid] ? mid : (PORTAL_TO[low] ? low : 0);
    if (pid && this.portalLock <= 0) {
      this.portalT += dt;
      if (this.portalT > 0.08) {
        this.portalT = 0; this.portalLock = 6;
        g.onPortal(PORTAL_TO[pid]);
        g.net.send({ t: 'portal', x: px, y: Math.floor(this.pos.y + (PORTAL_TO[mid] ? 0.5 : 0.1)), z: pz });
      }
    } else this.portalT = 0;
  }

  updateCamera(dt) {
    const g = this.g, cam = g.R.camera, w = g.world;
    // in een attractie of het lijnvliegtuig kun je ook door je eigen ogen kijken: dan zit je er echt in
    const third = this.cam > 0 || (this.mount && this.mountKind !== 'rit') || this.dead;
    const front = this.cam === 2;                 // van voren: de camera staat vóór je en kijkt naar je terug
    const eyeY = this.pos.y + (this.mountKind === 'rit' && !third ? 0.75 : this.mount ? 1.25 : EYE) + (this.mountKind === 'dier' || this.mountKind === 'auto' ? this.seatH : 0);
    const hx = Math.floor(this.pos.x), hz = Math.floor(this.pos.z);
    if (!third) {
      const bob = this.onGround ? Math.sin(this.bobPh) * 0.035 * Math.min(1, this.speedNow / 4) : 0;
      cam.position.set(this.pos.x, eyeY + bob, this.pos.z);
    } else {
      const dist = this.mount ? 4.5 + 3.4 * this.mountScale : 4.2;
      const cp = Math.cos(this.pitch);
      const fs = front ? -1 : 1;
      const bx = fs * Math.sin(this.yaw) * cp, by = -Math.sin(this.pitch) * (front ? -0.35 : 1), bz = fs * Math.cos(this.yaw) * cp;
      let d = 0.2;
      const oy = eyeY + 0.25;
      for (; d < dist; d += 0.25) {
        if (w.solid(Math.floor(this.pos.x + bx * (d + 0.3)), Math.floor(oy + by * (d + 0.3)), Math.floor(this.pos.z + bz * (d + 0.3)))) break;
      }
      cam.position.set(this.pos.x + bx * d, oy + by * d, this.pos.z + bz * d);
    }
    // trillen na een ontploffing
    if (this.shake > 0) {
      const k = this.shake * 0.45;
      cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k; cam.position.z += (Math.random() - 0.5) * k;
      this.shake -= dt * 1.2;
    }
    // verrekijker: zolang je hem vasthoudt en hebt aangetikt, kijk je ver weg
    const held = ITEMS[this.heldItem()];
    if (this.zoom && !(held && held.zoom)) this.zoom = false;
    const fov = this.zoom ? 16 : 72;
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 10); cam.updateProjectionMatrix(); }
    if (third && front) cam.rotation.set(-this.pitch * 0.35, this.yaw + Math.PI, 0); else cam.rotation.set(this.pitch, this.yaw, 0);
    cam.updateMatrixWorld();
    const eb = w.getBlock(Math.floor(cam.position.x), Math.floor(cam.position.y), Math.floor(cam.position.z));
    this.headIn = eb === B.water ? 1 : (eb === B.lava ? 2 : 0);
    void hx; void hz;

    // eigen poppetje
    const m = this.model;
    m.visible = third && !(this.veh && !this.veh.open);      // in een dichte auto zie je jezelf niet
    if (third) {
      m.position.copy(this.pos);
      if (this.mountKind === 'dier' || this.mountKind === 'auto') m.position.y += this.seatH - 0.62;      // je zit op zijn rug, of op de stoel
      else if (this.mountKind === 'vlieg' || this.mountKind === 'heli' || this.mountKind === 'rit') m.position.y -= 0.62;
      m.rotation.set(0, this.yaw + Math.PI, 0);
      // in een attractie zit je zoals het stoeltje staat (schuin in de zweefmolen, met de neus mee in het vliegtuig)
      if (this.mountKind === 'rit' && this.rideA && this.rideA.seatYaw !== undefined) {
        this.rideA.seats[this.rideSeat].getWorldQuaternion(m.quaternion);
        m.quaternion.multiply(_qy.setFromAxisAngle(_up, this.rideA.seatYaw));
      }
      const a = m.userData.a;
      // het beste harnas uit je rugzak zie je op je poppetje
      let best = null;
      for (const s of g.inv) { const it = s && ITEMS[s[0]]; if (it && it.armor && (!best || it.armor > best.armor)) best = it; }
      setArmor(m, best ? parseInt(best.icon[1].slice(1), 16) : null, !!best && best.key === 'harnas_leer');
      a.hold = this.heldItem() > 0;                         // iets in je hand: dan houd je je arm omhoog
      this.handItem.visible = a.hold;
      a.pose = this.mount ? 'ride' : '';
      a.airborne = !this.onGround && !this.mount && !this.inWater; a.vy = this.vel.y; a.swim = this.inWater && !this.mount;
      if (this.swing > 0 && !(a.swing > 0)) a.swing = this.swing;
      animate(m, g.time, this.mount ? 0 : this.speedNow, 0, dt);
    }
    // voorwerp in de hand
    const id = this.heldItem();
    this.held.visible = !third && id > 0;
    if (id !== this.heldId && id > 0) {
      this.heldId = id;
      this.heldTex.image = iconCanvas(id);
      this.heldTex.needsUpdate = true;
    }
    if (this.held.visible) {
      const s = this.swing > 0 ? Math.sin((this.swing / 0.3) * Math.PI) : 0;
      this.held.position.set((g.touch ? -0.37 : 0.37) * Math.min(1.6, cam.aspect) - s * 0.12, -0.27 + Math.sin(this.bobPh) * 0.012 + s * 0.06, -0.62 - s * 0.08);
      this.held.rotation.z = -s * 0.9 + 0.1;
    }
    // je armen: de ene houdt vast wat je in je hand hebt, de andere hangt onder in beeld
    // Net als van buitenaf: met lege handen hangen je armen omlaag (uit beeld); heb je iets vast
    // of sla je, dan komt die arm omhoog.
    const arms = this.fpArms, show = !third && !this.zoom && (id > 0 || this.swing > 0);
    if (arms) {
      arms[0].visible = show; arms[1].visible = false;
      if (show) {
        const s = this.swing > 0 ? Math.sin((this.swing / 0.3) * Math.PI) : 0;
        const side = g.touch ? -1 : 1, ax = 0.37 * Math.min(1.6, cam.aspect), bob = Math.sin(this.bobPh) * 0.012;
        arms[0].position.set(side * (ax + 0.01) - side * s * 0.12, -0.325 + bob + s * 0.07, -0.61 - s * 0.1);
        arms[0].rotation.set(-0.95 - s * 0.55, 0, side * (0.3 + s * 0.25));
        arms[1].position.set(-side * (ax + 0.02), -0.44 - bob, -0.62);
        arms[1].rotation.set(-1.05, 0, -side * 0.3);
      }
    }
  }

  // Waar wijst de speler naar? ndc = plek op het scherm (aanraken) of null (midden)
  aim(ndc) {
    const g = this.g, cam = g.R.camera;
    const dir = new THREE.Vector3();
    if (ndc) dir.set(ndc.x, ndc.y, 0.5).unproject(cam).sub(cam.position).normalize();
    else cam.getWorldDirection(dir);
    const o = cam.position;
    // van voren gezien wijs je (zonder tik op het scherm) gewoon recht vooruit, vanuit je ogen
    if (this.cam === 2 && !ndc && !this.mount) {
      const cp = Math.cos(this.pitch);
      dir.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
      const ex = this.pos.x, ey = this.pos.y + EYE, ez = this.pos.z;
      const blk = g.world.raycast(ex, ey, ez, dir.x, dir.y, dir.z, REACH);
      const ent = g.ents.pick(ex, ey, ez, dir.x, dir.y, dir.z, REACH + 1);
      if (ent && (!blk || ent.t < blk.t)) return { ent: ent.e, blk: null, dir };
      return { ent: null, blk, dir };
    }
    const extra = (this.cam > 0 || this.mount) ? _v.set(this.pos.x, this.pos.y + EYE, this.pos.z).distanceTo(o) : 0;
    const maxD = REACH + extra;
    const blk = g.world.raycast(o.x, o.y, o.z, dir.x, dir.y, dir.z, maxD);
    const ent = g.ents.pick(o.x, o.y, o.z, dir.x, dir.y, dir.z, maxD + 1);
    if (ent && (!blk || ent.t < blk.t)) return { ent: ent.e, blk: null, dir };
    return { ent: null, blk, dir };
  }

  actions(dt) {
    const g = this.g, inp = g.input;
    const tgt = this.aim(inp.breakHeld ? inp.breakNdc : null);
    this.target = tgt;
    const b = tgt.blk;
    this.hl.visible = !!b && !this.mount;
    if (b) this.hl.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);

    if (!inp.breakHeld || g.ui.modalOpen()) { this.dig = null; this.crack.visible = false; return; }

    if (this.mount) { if (this.mountKind === '') this.shoot(tgt.dir); return; }      // alleen een draak kan spuwen
    if (tgt.ent) {
      this.dig = null; this.crack.visible = false;
      if (this.atkCd <= 0 && !tgt.ent.owner) {
        this.atkCd = 0.36; this.swing = 0.3;
        g.net.send({ t: 'attack', id: tgt.ent.id });
        g.sound.play('swing');
      }
      return;
    }
    if (!b || this.digCd > 0) { this.dig = null; this.crack.visible = false; return; }
    const def = BLOCKS[b.id];
    if (def.hard === Infinity) { this.crack.visible = false; return; }
    if (!this.dig || this.dig.x !== b.x || this.dig.y !== b.y || this.dig.z !== b.z) this.dig = { x: b.x, y: b.y, z: b.z, p: 0 };
    const it = ITEMS[this.heldItem()];
    let sp = 1;
    if (it && it.tool && it.tool === def.tool) sp = it.speed;
    const time = Math.max(0.12, def.hard / sp) * (g.fastDig ? 0.1 : 1);
    this.dig.p += dt / time;
    this.digTick -= dt;
    if (this.digTick <= 0) {
      this.digTick = 0.24; this.swing = 0.24;
      g.sound.play('dig', 1, def.snd);
      const c = g.tileColor(def.tSide);
      g.particles.burst(b.x + 0.5 + b.nx * 0.55, b.y + 0.5 + b.ny * 0.55, b.z + 0.5 + b.nz * 0.55, 3, c, { speed: 1.6, size: 0.12, life: 0.4 });
    }
    if (this.dig.p >= 1) {
      g.net.send({ t: 'break', x: b.x, y: b.y, z: b.z });
      g.world.setBlock(b.x, b.y, b.z, 0);
      g.sound.play('break', 1, def.snd);
      g.particles.burst(b.x + 0.5, b.y + 0.5, b.z + 0.5, 14, g.tileColor(def.tSide), { speed: 2.6, size: 0.16, life: 0.6, spread: 0.7 });
      this.dig = null; this.digCd = 0.14; this.crack.visible = false;
    } else {
      this.crack.visible = true;
      this.crack.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);
      const st = Math.min(3, Math.floor(this.dig.p * 4));
      if (this.crack.material.map !== this.crackTex[st]) { this.crack.material.map = this.crackTex[st]; this.crack.material.needsUpdate = true; }
    }
  }

  shoot(dir) {
    if (this.shootCd > 0) return;
    const it = ITEMS[this.heldItem()];
    const ride = this.mount ? this.g.ents.map.get(this.mount) : null;
    this.shootCd = this.mount ? (BREATH[ride && ride.dtype] || BREATH.vuur).cd : (it && it.ranged ? it.ranged.cd + 0.02 : 0.5);
    this.swing = 0.25;
    this.g.net.send({ t: 'shoot', dx: dir.x, dy: dir.y, dz: dir.z });
  }

  // tik / rechtermuisknop: gebruiken, plaatsen, praten, eten, schieten
  use(ndc) {
    const g = this.g;
    if (this.frozen || this.dead || this.useCd > 0) return;
    this.useCd = 0.16;
    const tgt = this.aim(ndc);
    if (this.mount) { if (this.mountKind === '') this.shoot(tgt.dir); return; }      // alleen een draak kan spuwen
    const id = this.heldItem();
    const it = ITEMS[id];
    if (tgt.ent) {
      const e = tgt.ent;
      // dieren, dorpelingen, ridders en treinen tik je aan; een wolf alleen met een bot in je hand
      const friendly = e.owner || e.def.ai === 'passive' || e.def.tap || (e.kind === 'wolf' && id === I.bot);
      if (friendly) { g.net.send({ t: 'useEnt', id: e.id }); this.swing = 0.2; return; }
      if (it && it.ranged) { this.shoot(tgt.dir); return; }
      if (this.atkCd <= 0) { this.atkCd = 0.36; this.swing = 0.3; g.net.send({ t: 'attack', id: e.id }); g.sound.play('swing'); }
      return;
    }
    if (it && it.ranged) { this.shoot(tgt.dir); return; }
    if (it && it.zoom) { this.zoom = !this.zoom; g.sound.play('click'); return; }      // verrekijker: dichtbij halen
    const b = tgt.blk;
    if (b) {
      const def = BLOCKS[b.id];
      if (def.interact) {
        this.swing = 0.2;
        if (b.id === B.werkbank || b.id === B.oven) { g.ui.openInventory(b.id === B.oven ? 'oven' : 'werkbank'); return; }
        g.net.send({ t: 'use', x: b.x, y: b.y, z: b.z });
        return;
      }
    }
    if (it && it.veh) {
      // een voertuig zet je op de grond (een boot op het water) waar je naar wijst
      if (b) { g.net.send({ t: 'placeVeh', x: b.x, y: b.y, z: b.z }); this.swing = 0.25; }
      else g.ui.toast('Wijs een plek op de grond aan om je ' + it.name.toLowerCase() + ' neer te zetten.');
      return;
    }
    if (it && it.train) {
      // een locomotief zet je op rails
      if (b && b.id === B.rails) { g.net.send({ t: 'placeTrain', x: b.x, y: b.y, z: b.z }); this.swing = 0.25; }
      else g.ui.toast('Een locomotief moet op rails staan. Leg eerst rails neer.');
      return;
    }
    // iets wat je kunt planten: wijs je een akker aan, dan plant je het (anders eet je het op)
    const seed = !!CROP_OF_SEED[id] && !!b && b.id === B.akker;
    if (it && it.food && !seed) { g.net.send({ t: 'eat' }); return; }
    if (!b || !id) return;
    if (!isBlock(id) && !(it && it.portal) && !seed) return;
    let x = b.x, y = b.y, z = b.z;
    if (!BLOCKS[b.id].replace) { x += b.nx; y += b.ny; z += b.nz; }
    const cur = g.world.getBlock(x, y, z);
    if (cur < 0 || !BLOCKS[cur].replace || y < 1 || y >= CH - 1) return;
    if (seed) { g.world.setBlock(x, y, z, B.kiem); g.sound.play('place', 1, 'leaf'); }
    else if (isBlock(id)) {
      const def = BLOCKS[id];
      if (def.solid && this.pos.x + HW > x && this.pos.x - HW < x + 1 && this.pos.z + HW > z && this.pos.z - HW < z + 1 && this.pos.y + HH > y && this.pos.y < y + 1) return;
      if (def.support && !g.world.solid(x, y - 1, z)) { g.ui.toast('Dit moet op de grond staan.'); return; }
      if (id !== B.bed) g.world.setBlock(x, y, z, id);      // een bed is twee blokken: de server zet het neer
      g.sound.play('place', 1, def.snd);
    }
    this.swing = 0.25;
    g.net.send({ t: 'place', x, y, z });
  }

  knock(kx, kz) {
    this.vel.x += kx * 7; this.vel.z += kz * 7;
    if (this.onGround) this.vel.y = 4.5;
  }
}
