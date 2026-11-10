// Besturing: toetsenbord + muis, en aanraakscherm (iPad).

export class Input {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.h = hooks;              // { onUse(ndc), onKey(name), canPlay() }
    this.touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.keys = {};
    this.fwd = 0; this.strafe = 0;
    this.jump = false; this.down = false; this.sprint = false;
    this.lookX = 0; this.lookY = 0;
    this.breakHeld = false;
    this.breakNdc = null;        // waar op het scherm (bij aanraken), anders het midden
    this.locked = false;
    this.sens = 1;
    this.btn = { jump: false, down: false, brk: false };
    this.joy = null; this.look = null;
    this.joyEl = document.getElementById('joy');
    this.knobEl = document.getElementById('joyknob');
    this.usedTouch = false;
    this.bind();
  }

  bind() {
    const cv = this.canvas;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.repeat) { if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); return; }
      this.keys[e.code] = true;
      if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
      this.h.onKey(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.breakHeld = false; });

    cv.addEventListener('mousedown', (e) => {
      if (this.usedTouch) return;
      if (!this.h.canPlay()) return;
      if (!this.locked) { this.requestLock(); this.dragLook = true; }
      if (e.button === 0) { this.breakHeld = true; this.breakNdc = null; }
      else if (e.button === 2) this.h.onUse(null);
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.breakHeld = false; this.dragLook = false; });
    window.addEventListener('mousemove', (e) => {
      if (this.locked || this.dragLook) { this.lookX += e.movementX * 0.0025 * this.sens; this.lookY += e.movementY * 0.0025 * this.sens; }
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => { if (this.h.canPlay()) this.h.onKey(e.deltaY > 0 ? 'WheelDown' : 'WheelUp'); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === cv; if (!this.locked) this.breakHeld = false; });

    // aanraken
    const opts = { passive: false };
    cv.addEventListener('touchstart', (e) => { e.preventDefault(); this.usedTouch = true; this.tStart(e); }, opts);
    cv.addEventListener('touchmove', (e) => { e.preventDefault(); this.tMove(e); }, opts);
    cv.addEventListener('touchend', (e) => { e.preventDefault(); this.tEnd(e); }, opts);
    cv.addEventListener('touchcancel', (e) => { e.preventDefault(); this.tEnd(e); }, opts);
    // geen zoomen of scrollen van de pagina
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());

    const hold = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const on = (e) => { e.preventDefault(); e.stopPropagation(); this.btn[key] = true; if (key === 'brk') { this.breakHeld = true; this.breakNdc = null; } el.classList.add('down'); };
      const off = (e) => { e.preventDefault(); this.btn[key] = false; if (key === 'brk') this.breakHeld = false; el.classList.remove('down'); };
      el.addEventListener('touchstart', on, opts); el.addEventListener('touchend', off, opts); el.addEventListener('touchcancel', off, opts);
      el.addEventListener('mousedown', on); el.addEventListener('mouseup', off); el.addEventListener('mouseleave', off);
    };
    hold('btnJump', 'jump'); hold('btnDown', 'down'); hold('btnBreak', 'brk');
  }

  requestLock() {
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* mag niet altijd */ }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  ndc(t) { return { x: (t.clientX / window.innerWidth) * 2 - 1, y: -(t.clientY / window.innerHeight) * 2 + 1 }; }

  tStart(e) {
    if (!this.h.canPlay()) return;
    for (const t of e.changedTouches) {
      const left = t.clientX < window.innerWidth * 0.38 && t.clientY > window.innerHeight * 0.28;
      if (left && !this.joy) {
        this.joy = { id: t.identifier, x: t.clientX, y: t.clientY };
        this.joyEl.style.display = 'block';
        this.joyEl.style.left = (t.clientX - 60) + 'px'; this.joyEl.style.top = (t.clientY - 60) + 'px';
        this.knobEl.style.transform = 'translate(0px,0px)';
      } else if (!this.look) {
        this.look = { id: t.identifier, x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t0: performance.now(), moved: false, holding: false };
      }
    }
  }
  tMove(e) {
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) {
        let dx = t.clientX - this.joy.x, dy = t.clientY - this.joy.y;
        const l = Math.hypot(dx, dy), R = 52;
        if (l > R) { dx *= R / l; dy *= R / l; }
        this.knobEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        this.jx = dx / R; this.jy = dy / R;
      } else if (this.look && t.identifier === this.look.id) {
        const L = this.look;
        this.lookX += (t.clientX - L.x) * 0.0055 * this.sens;
        this.lookY += (t.clientY - L.y) * 0.0055 * this.sens;
        L.x = t.clientX; L.y = t.clientY;
        if (Math.hypot(L.x - L.sx, L.y - L.sy) > 14) L.moved = true;
        if (L.holding) this.breakNdc = this.ndc(t);
      }
    }
  }
  tEnd(e) {
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) {
        this.joy = null; this.jx = 0; this.jy = 0;
        this.joyEl.style.display = 'none';
      } else if (this.look && t.identifier === this.look.id) {
        const L = this.look;
        if (L.holding) this.breakHeld = false;
        else if (!L.moved && performance.now() - L.t0 < 300 && this.h.canPlay()) this.h.onUse(this.ndc(t));
        this.look = null;
      }
    }
  }

  // elke frame
  update() {
    const k = this.keys;
    let f = 0, s = 0;
    if (k.KeyW) f += 1;
    if (k.KeyS) f -= 1;
    if (k.KeyD) s += 1;
    if (k.KeyA) s -= 1;
    if (this.joy) { f = -(this.jy || 0); s = this.jx || 0; }
    this.fwd = f; this.strafe = s;
    this.jump = !!k.Space || this.btn.jump;
    this.down = !!k.ShiftLeft || !!k.ShiftRight || this.btn.down;
    this.sprint = !!k.ShiftLeft || !!k.ControlLeft || (this.joy && Math.hypot(f, s) > 0.95);
    // pijltjestoetsen om rond te kijken (handig zonder muis)
    const ks = 0.045;
    if (k.ArrowLeft) this.lookX -= ks;
    if (k.ArrowRight) this.lookX += ks;
    if (k.ArrowUp) this.lookY -= ks * 0.7;
    if (k.ArrowDown) this.lookY += ks * 0.7;
    // lang indrukken = hakken
    const L = this.look;
    if (L && !L.moved && !L.holding && performance.now() - L.t0 > 300) {
      L.holding = true; this.breakHeld = true;
      this.breakNdc = { x: (L.x / window.innerWidth) * 2 - 1, y: -(L.y / window.innerHeight) * 2 + 1 };
    }
  }

  takeLook() { const x = this.lookX, y = this.lookY; this.lookX = 0; this.lookY = 0; return [x, y]; }
}
