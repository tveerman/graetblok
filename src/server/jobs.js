// Beroepen op de server: het werk van vandaag bedenken, tellen wat de speler echt doet, loon
// uitbetalen, promoties, de weekopdracht en het weekend. (De lijsten staan in shared/jobs.js.)
import { B } from '../shared/blocks.js';
import { I, itemName } from '../shared/items.js';
import { hash2 } from '../shared/noise.js';
import { JOBS as WORK, JOB_ORDER, JOB_RANKS, jobLevel, jobSalary, JOB_XP, WEEK_FACTOR, WEEK_PAY, DAY_NAMES } from '../shared/jobs.js';

const pad = (n) => (n < 10 ? '0' : '') + n;
const dayKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const strSeed = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003; return h; };

export const jobMethods = {

  // Welke dag is het echt? (Jorians weekendregel kijkt naar de echte dag.) Met de
  // ontwikkelaarsmodus kun je de dag verschuiven om te testen.
  today() {
    const d = new Date(Date.now() + (this.dayShift || 0) * 86400000);
    const wd = d.getDay();
    const ma = new Date(d); ma.setDate(d.getDate() - ((wd + 6) % 7));                 // de maandag van deze week
    const vorige = new Date(d); vorige.setDate(d.getDate() - (wd === 1 ? 3 : wd === 0 ? 2 : 1));      // de vorige werkdag
    return { dag: dayKey(d), wd, vrij: wd === 0 || wd === 6, week: dayKey(ma), vorige: dayKey(vorige) };
  },

  werkOf(p) {
    return p.flags.werk || (p.flags.werk = { job: '', xp: {}, dag: '', taken: {}, week: '', weektaak: {}, reeks: 0, reeksDag: '', cadeau: {}, bezocht: {}, genezen: {} });
  },

  // het werk van vandaag voor dit beroep (wordt één keer per dag bedacht, en één keer per week de weekopdracht)
  workToday(p, job) {
    const W = this.werkOf(p), T = this.today(), J = WORK[job];
    if (W.dag !== T.dag) { W.dag = T.dag; W.taken = {}; W.bezocht = {}; W.genezen = {}; }
    if (W.week !== T.week) { W.week = T.week; W.weektaak = {}; }
    const level = jobLevel(W.xp[job] || 0), seed = strSeed(T.dag + job);
    const amount = (i, sd) => {
      const [, , base, per] = J.taken[i];
      let n = (base + per * (level - 1)) * (0.8 + 0.4 * hash2(i, sd, seed));
      n = n >= 50 ? Math.round(n / 10) * 10 : Math.max(1, Math.round(n));
      return n;
    };
    if (!W.taken[job]) W.taken[job] = J.taken.map((t, i) => ({ i, n: amount(i, 1), v: 0, k: 0 }));
    if (!W.weektaak[job]) { const i = Math.floor(hash2(3, 9, strSeed(T.week + job)) * J.taken.length) % J.taken.length; W.weektaak[job] = { i, n: amount(i, 2) * WEEK_FACTOR, v: 0, k: 0 }; }
    return { W, T, J, level, taken: W.taken[job], week: W.weektaak[job] };
  },

  // Er is iets gebeurd dat voor een beroep kan tellen (zie de lijst in shared/jobs.js).
  jobEvent(p, ev, n = 1) {
    const W0 = p && p.flags && p.flags.werk;
    if (!W0 || !W0.job || !WORK[W0.job]) return;
    const { W, T, J, taken, week } = this.workToday(p, W0.job);
    if (T.vrij) return;                                         // in het weekend ben je vrij
    const job = W.job;
    const klaar = (t, weekT) => {
      t.k = 1;
      const level = jobLevel(W.xp[job] || 0), loon = jobSalary(level) * (weekT ? WEEK_PAY : 1);
      this.giveLoot(p, I.munt, loon, true);
      this.toast(p, (weekT ? '🏅 Weekopdracht gehaald: ' : '✅ Opdracht gehaald: ') + J.taken[t.i][1].replace('{n}', t.n) + '. Je verdient ' + loon + ' munten.', 'good');
      W.xp[job] = (W.xp[job] || 0) + JOB_XP * (weekT ? 3 : 1);
      const nu = jobLevel(W.xp[job]);
      if (nu > level) {
        this.toast(p, '🎉 Promotie! Je bent nu ' + JOB_RANKS[nu - 1][0] + ' bij ' + J.name + ' (level ' + nu + '). Je loon gaat omhoog.', 'rank');
        const c = J.cadeau;
        if (c && nu >= c[2] && !W.cadeau[job]) { W.cadeau[job] = 1; this.giveLoot(p, c[0], c[1]); this.toast(p, '🎁 Van je baas krijg je: ' + (c[1] > 1 ? c[1] + ' × ' : '') + itemName(c[0]) + '!', 'rank'); }
      }
      // alle drie de opdrachten van vandaag af? Dan telt de dag mee voor je reeks
      if (!weekT && taken.every((q) => q.k) && W.reeksDag !== T.dag) {
        W.reeks = W.reeksDag === T.vorige ? W.reeks + 1 : 1;
        W.reeksDag = T.dag;
        if (W.reeks >= 2) { const bonus = Math.min(W.reeks, 5) * 2; this.giveLoot(p, I.munt, bonus, true); this.toast(p, '🔥 ' + W.reeks + ' werkdagen op rij al je werk af! Bonus: ' + bonus + ' munten.', 'rank'); }
        else this.toast(p, 'Al je werk van vandaag is af. Goed gedaan! Morgen weer, dan krijg je een bonus.', 'good');
      }
      this.sendInv(p);
    };
    for (const t of taken) if (!t.k && J.taken[t.i][0].includes(ev)) { t.v = Math.min(t.n, t.v + n); if (t.v >= t.n) klaar(t, false); }
    if (!week.k && J.taken[week.i][0].includes(ev)) { week.v = Math.min(week.n, week.v + n); if (week.v >= week.n) klaar(week, true); }
  },

  // aangekomen in een dorp, stad of ander bouwwerk: telt één keer per dag per plek
  jobVisit(p, key) {
    const W = p.flags.werk;
    if (!W || !W.job) return;
    this.workToday(p, W.job);
    if (W.bezocht[key]) return;
    W.bezocht[key] = 1;
    this.jobEvent(p, 'dorp');
  },

  // zoveel blokken gereden, gevaren of gevlogen met dit ding
  jobTravel(p, kind, d) {
    if (!p.flags.werk || !p.flags.werk.job || d <= 0 || d > 8) return;
    p.rijAcc = (p.rijKind === kind ? p.rijAcc || 0 : 0) + d; p.rijKind = kind;
    if (p.rijAcc >= 10) { const n = Math.floor(p.rijAcc); p.rijAcc -= n; this.jobEvent(p, 'rij:' + kind, n); }
  },

  // een dorpeling verbinden (dokter): één keer per dag per dorpeling
  jobHeal(p, w, e) {
    const W = this.werkOf(p);
    if (W.job) this.workToday(p, W.job);
    const key = (e.site || '') + ':' + (e.name || e.id);
    if (W.genezen[key]) { this.toast(p, (e.name || 'De dorpeling') + ': "Ik voel me al een stuk beter, dank je!"'); return; }
    W.genezen[key] = 1;
    this.take(p, I.verband, 1);
    this.fx(w.id, 'hearts', e.x, e.y + 1.6, e.z);
    this.toast(p, (e.name || 'De dorpeling') + ': "Dank je wel! Dat schaafwondje deed zeer."', 'good');
    this.sendInv(p);
    this.jobEvent(p, 'genees');
  },

  // ---------- branden voor de brandweer ----------

  // elke seconde: is de speler brandweer en moet er nog geblust worden, dan breekt er af en toe
  // ergens in de buurt een brandje uit
  updateFires(p) {
    const W = p.flags.werk, w = this.worlds[p.world];
    const list = p.branden || (p.branden = []);
    // opruimen: geblust, of na drie minuten vanzelf uit
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      if (f.w !== p.world || w.get(f.x, f.y, f.z) !== B.brand) list.splice(i, 1);
      else if (this.meta.time - f.t > 180) { this.setBlock(w, f.x, f.y, f.z, 0); list.splice(i, 1); }
    }
    if (!W || W.job !== 'brandweer' || p.dead) return;
    const { T, taken, week, J } = this.workToday(p, 'brandweer');
    const open = [...taken, week].some((t) => !t.k && J.taken[t.i][0].includes('blus'));
    if (T.vrij || !open || list.length >= 2) return;
    p.brandT = (p.brandT === undefined ? 12 : p.brandT) - 1;
    if (p.brandT > 0) return;
    p.brandT = 35;
    for (let poging = 0; poging < 8; poging++) {
      const a = this.rnd() * Math.PI * 2, d = 16 + this.rnd() * 22;
      const x = Math.floor(p.x + Math.sin(a) * d), z = Math.floor(p.z - Math.cos(a) * d);
      const y = w.topY(x, z, Math.min(126, Math.floor(p.y) + 14)) + 1;
      if (y < 3 || Math.abs(y - p.y) > 12 || w.get(x, y, z) !== 0 || !w.solid(x, y - 1, z)) continue;
      this.setBlock(w, x, y, z, B.brand);
      list.push({ w: p.world, x, y, z, t: this.meta.time });
      const hoek = ((Math.atan2(x - p.x, -(z - p.z)) * 180 / Math.PI) + 360) % 360;
      const wind = ['noorden', 'noordoosten', 'oosten', 'zuidoosten', 'zuiden', 'zuidwesten', 'westen', 'noordwesten'][Math.round(hoek / 45) % 8];
      this.toast(p, '🔥 Brand gemeld! ' + Math.round(d) + ' blokken naar het ' + wind + '. Tik op het vuur om het te blussen.', 'warn');
      return;
    }
  },

  // ---------- het venster "Mijn werk" ----------

  sendWork(p) {
    const W = this.werkOf(p), T = this.today();
    const m = { t: 'werk', dag: DAY_NAMES[T.wd], vrij: T.vrij, job: W.job, reeks: W.reeksDag === T.dag || W.reeksDag === T.vorige ? W.reeks : 0, munten: this.count(p, I.munt),
      jobs: JOB_ORDER.map((k) => [k, W.xp[k] || 0]) };
    if (W.job && WORK[W.job]) {
      const { J, level, taken, week } = this.workToday(p, W.job);
      const xp = W.xp[W.job] || 0;
      m.level = level; m.rang = JOB_RANKS[level - 1][0]; m.xp = xp; m.next = level < JOB_RANKS.length ? JOB_RANKS[level] : null; m.loon = jobSalary(level);
      m.taken = taken.map((t) => [J.taken[t.i][1].replace('{n}', t.n), t.v, t.n, t.k]);
      m.week = [J.taken[week.i][1].replace('{n}', week.n), week.v, week.n, week.k, jobSalary(level) * WEEK_PAY];
      m.cadeau = J.cadeau && !W.cadeau[W.job] ? [J.cadeau[0], J.cadeau[1], J.cadeau[2]] : null;
    }
    this.send(p, m);
  },

  on_werk(p, m) {
    const W = this.werkOf(p);
    if (m.c === 'kies' && (WORK[m.job] || m.job === '')) {
      if (W.job !== m.job) {
        W.job = m.job;
        if (m.job) this.toast(p, WORK[m.job].icon + ' Je werkt nu bij ' + WORK[m.job].name + '. Je opdrachten staan in "Mijn werk".', 'good');
        this.send(p, { t: 'job', job: W.job });
      }
    }
    this.sendWork(p);
  },
};
