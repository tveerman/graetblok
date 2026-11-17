// Alle doosjes van alle wezens in één keer tekenen.
//
// Een wezen is opgebouwd uit doosjes (zie models.js): een koe uit 23, een draak uit 42. Vroeger
// was elk doosje een eigen tekenopdracht voor de videokaart, en een oude iPad is daar per
// opdracht een flink stuk van een milliseconde mee bezig. Een dorp met veertig wezens kostte zo
// honderden opdrachten voor maar een paar duizend driehoeken.
//
// Hier gaan alle gewone doosjes in twee lijsten: één voor doosjes met een huid (met licht en
// schaduw) en één voor doosjes die zelf licht geven. Elke lijst is één tekenopdracht, hoeveel
// wezens er ook zijn. De modellen zelf blijven zoals ze waren (de animatie draait gewoon aan de
// gewrichten); we lezen elk beeld af waar elk doosje staat.
//
//   adopt(root)    een model aanmelden: zijn doosjes worden voortaan hier getekend
//   release(root)  een model afmelden (het is uit de wereld gehaald)
//   update()       elk beeld, nadat de plek van alle onderdelen is uitgerekend
//
// Wat niet in de lijsten past (vleugels, wielen, doorzichtige geesten) tekent three.js zoals
// altijd. De huiden staan samen op één groot plaatje; een nieuwe huid wordt er los bij gezet.
import * as THREE from '../../vendor/three.module.min.js';

const CELL = 32, GUT = 2, SLOT = CELL + 2 * GUT, SIZE = 1024, PER = Math.floor(SIZE / SLOT);

const isUnitBox = (g) => g.type === 'BoxGeometry' && g.parameters.width === 1 && g.parameters.height === 1 && g.parameters.depth === 1;
const plain = (m, type) => m.type === type && !m.transparent && m.opacity === 1 && m.side === THREE.FrontSide && !m.alphaTest && m.visible &&
  !m.vertexColors && m.depthTest && m.depthWrite && m.fog && (!m.emissive || m.emissive.getHex() === 0) && !m.alphaMap && !m.emissiveMap;

class Lijst {
  constructor(material, lit, cap) {
    this.lit = lit; this.material = material; this.n = 0; this.mesh = null;
    this.alloc(cap);
  }
  alloc(cap) {
    const old = this.mesh;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geo, this.material, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    if (this.lit) {
      // per doosje: het vakje van de huid opzij (bbA) en van het gezicht aan de voorkant (bbB)
      this.attrA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); this.attrA.setUsage(THREE.DynamicDrawUsage);
      this.attrB = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); this.attrB.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('bbA', this.attrA); geo.setAttribute('bbB', this.attrB);
    }
    mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.count = 0;
    mesh.name = this.lit ? 'doosjes' : 'doosjes-licht';
    this.cap = cap; this.mesh = mesh;
    this.M = mesh.instanceMatrix.array; this.C = mesh.instanceColor.array; this.RA = this.lit ? this.attrA.array : null; this.RB = this.lit ? this.attrB.array : null;
    if (old) { const p = old.parent; if (p) { p.remove(old); p.add(mesh); } old.geometry.dispose(); old.dispose(); }
  }
  flush() {
    const mesh = this.mesh, n = this.n;
    mesh.count = n; mesh.visible = n > 0;
    if (!n) return;
    const up = (attr, per) => { attr.clearUpdateRanges(); attr.addUpdateRange(0, n * per); attr.needsUpdate = true; };
    up(mesh.instanceMatrix, 16); up(mesh.instanceColor, 3);
    if (this.lit) { up(this.attrA, 4); up(this.attrB, 4); }
  }
}

export class BoxBatch {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.roots = new Set();
    this.on = renderer.capabilities.isWebGL2 || renderer.extensions.has('ANGLE_instanced_arrays');

    // het grote plaatje met alle huiden; vakje 0 is wit (voor doosjes met alleen een kleur)
    this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = SIZE;
    this.ctx = this.cv.getContext('2d');
    this.ctx.fillStyle = '#fff'; this.ctx.fillRect(0, 0, SLOT, SLOT);
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.generateMipmaps = false; this.tex.minFilter = THREE.LinearFilter; this.tex.magFilter = THREE.LinearFilter;
    this.cells = new Map();          // huid (texture) -> [u, v, du, dv]
    this.nCells = 1;
    this.white = this.rectOf(0);
    this.uploaded = false;           // staat het grote plaatje al op de videokaart?
    this.pending = [];               // vakjes die er sindsdien bij kwamen
    this.descs = new WeakMap();      // materiaal (of rijtje van zes) -> hoe het in de lijst komt, of null

    const lit = new THREE.MeshLambertMaterial({ map: this.tex });
    lit.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 bbA;\nattribute vec4 bbB;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvec4 bbR = normal.z > 0.5 ? bbB : bbA;\n\tvMapUv = bbR.xy + uv * bbR.zw;');
    };
    this.lit = new Lijst(lit, true, 1024);
    this.glow = new Lijst(new THREE.MeshBasicMaterial({ color: 0xffffff }), false, 256);
    scene.add(this.lit.mesh, this.glow.mesh);
  }

  rectOf(i) {
    const x = (i % PER) * SLOT + GUT, y = Math.floor(i / PER) * SLOT + GUT;
    return [x / SIZE, 1 - (y + CELL) / SIZE, CELL / SIZE, CELL / SIZE];
  }

  // het vakje van een huid op het grote plaatje (maakt het als het er nog niet is)
  cellFor(tex) {
    if (!tex) return this.white;
    let r = this.cells.get(tex);
    if (r !== undefined) return r;
    const img = tex.image;
    if (this.nCells >= PER * PER || !img || !img.width) { this.cells.set(tex, null); return null; }
    const i = this.nCells++;
    const sx = (i % PER) * SLOT, sy = Math.floor(i / PER) * SLOT;
    // eerst uitgerekt over het hele vakje (zo loopt de rand door), dan het plaatje zelf erop
    this.ctx.drawImage(img, sx, sy, SLOT, SLOT);
    this.ctx.drawImage(img, sx + GUT, sy + GUT, CELL, CELL);
    if (this.uploaded) this.pending.push(i);
    r = this.rectOf(i);
    this.cells.set(tex, r);
    return r;
  }

  // Kan dit materiaal in een lijst? Geeft { lit, a, b, mat } of null.
  descOf(material) {
    let d = this.descs.get(material);
    if (d !== undefined) return d;
    d = null;
    if (Array.isArray(material)) {
      // een hoofd: vijf kanten huid en aan de voorkant (+z) een gezicht
      const s = material[0], f = material[4];
      if (material.length === 6 && material[1] === s && material[2] === s && material[3] === s && material[5] === s &&
        plain(s, 'MeshLambertMaterial') && plain(f, 'MeshLambertMaterial') && s.color.equals(f.color)) {
        const a = this.cellFor(s.map), b = this.cellFor(f.map);
        if (a && b) d = { lit: true, a, b, mat: s };
      }
    } else if (plain(material, 'MeshLambertMaterial')) {
      const a = this.cellFor(material.map);
      if (a) d = { lit: true, a, b: a, mat: material };
    } else if (plain(material, 'MeshBasicMaterial') && !material.map) {
      d = { lit: false, a: null, b: null, mat: material };
    }
    this.descs.set(material, d);
    return d;
  }

  adopt(root) {
    if (!this.on) return;
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || !isUnitBox(o.geometry) || o.children.length > 64) return;
      const d = this.descOf(o.material);
      if (!d) return;
      o.userData.bb = { m: o.material, d };
      o.layers.mask = 0;                    // three.js slaat het doosje zelf over; wij tekenen het
    });
    this.roots.add(root);
  }

  release(root) { this.roots.delete(root); }
  clear() { this.roots.clear(); }

  // Elk beeld, als van alle onderdelen bekend is waar ze staan (matrixWorld klopt).
  update() {
    if (!this.on) return;
    this.lit.n = 0; this.glow.n = 0;
    for (const root of this.roots) {
      let vis = true;
      for (let o = root; o; o = o.parent) if (!o.visible) { vis = false; break; }
      if (vis) this.walk(root);
    }
    this.lit.flush(); this.glow.flush();

    // nieuwe huiden naar de videokaart: alleen het vakje, niet het hele plaatje
    if (this.pending.length) {
      const r = this.renderer;
      if (!this.slot) {
        const cv = document.createElement('canvas'); cv.width = cv.height = SLOT;
        this.slot = new THREE.CanvasTexture(cv); this.slot.colorSpace = THREE.SRGBColorSpace;
        this.slot.generateMipmaps = false; this.slot.minFilter = THREE.LinearFilter;
        this.slotCtx = cv.getContext('2d'); this.slotPos = new THREE.Vector2();
      }
      try {
        for (const i of this.pending) {
          const sx = (i % PER) * SLOT, sy = Math.floor(i / PER) * SLOT;
          this.slotCtx.clearRect(0, 0, SLOT, SLOT);
          this.slotCtx.drawImage(this.cv, sx, sy, SLOT, SLOT, 0, 0, SLOT, SLOT);
          this.slot.needsUpdate = true;
          r.copyTextureToTexture(this.slotPos.set(sx, SIZE - sy - SLOT), this.slot, this.tex);
        }
      } catch (e) { this.tex.needsUpdate = true; }       // lukt dat niet, dan het hele plaatje opnieuw
      this.pending.length = 0;
    }
    if (!this.uploaded && this.lit.n) this.uploaded = true;      // three.js stuurt het plaatje bij het eerste gebruik
  }

  walk(o) {
    const ch = o.children;
    for (let i = 0, l = ch.length; i < l; i++) {
      const c = ch[i];
      if (!c.visible) continue;
      const bb = c.userData.bb;
      if (bb !== undefined) this.push(c, bb);
      if (c.children.length) this.walk(c);
    }
  }

  push(mesh, bb) {
    if (mesh.material !== bb.m) {
      // het doosje kreeg een ander materiaal: opnieuw kijken waar het hoort
      bb.m = mesh.material; bb.d = this.descOf(mesh.material);
      mesh.layers.mask = bb.d ? 0 : 1;
    }
    const d = bb.d;
    if (!d) return;
    const L = d.lit ? this.lit : this.glow;
    if (L.n >= L.cap) {
      if (L.cap >= 16384) return;
      const M = L.M, C = L.C, RA = L.RA, RB = L.RB;
      L.alloc(L.cap * 2);
      L.M.set(M); L.C.set(C); if (RA) { L.RA.set(RA); L.RB.set(RB); }
    }
    const n = L.n++;
    const src = mesh.matrixWorld.elements, M = L.M, o = n * 16;
    for (let k = 0; k < 16; k++) M[o + k] = src[k];
    const col = d.mat.color, C = L.C;
    C[n * 3] = col.r; C[n * 3 + 1] = col.g; C[n * 3 + 2] = col.b;
    if (d.lit) {
      const RA = L.RA, RB = L.RB, a = d.a, b = d.b, p = n * 4;
      RA[p] = a[0]; RA[p + 1] = a[1]; RA[p + 2] = a[2]; RA[p + 3] = a[3];
      RB[p] = b[0]; RB[p + 1] = b[1]; RB[p + 2] = b[2]; RB[p + 3] = b[3];
    }
  }
}
