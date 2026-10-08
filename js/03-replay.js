'use strict';
/* ================= demo flight simulator ================= */
function startSim() {
  stopReplay(true);
  const base = st.fix ? [st.fix.lat, st.fix.lon] : [63.10, 21.62];
  const sim = { lat: base[0], lon: base[1], alt: 1450, hdg: 64, t: Date.now(), mode: 'glide', modeT: 0, tas: 10.5,
    wind: { from: 250, spd: 12 / 3.6 }, ground: 25, core: null, battery: 92 };
  sim.core = { lat: dest(sim.lat, sim.lon, 64, 700)[0], lon: dest(sim.lat, sim.lon, 64, 700)[1] };
  st.sim = sim; st.varioSrc = 'demo'; st.fixes = []; st.varioHist = []; st.samples = []; st.wind = null; st.tempPts = [];
  st.bora = st.bora || null;
  sim.timer = setInterval(simStep, 200);
  $('demoBadge').style.display = 'block'; toast('Demo flight started');
}
function stopSim() { if (!st.sim) return; clearInterval(st.sim.timer); st.sim = null; $('demoBadge').style.display = 'none'; st.fixes = []; st.varioHist = []; st.samples = []; toast('Demo flight stopped'); }
function simStep() {
  const s = st.sim, dt = 0.2; s.t += 200; s.modeT += dt;
  const wTo = wrap360(s.wind.from + 180), wvx = s.wind.spd * Math.sin(wTo * D2R), wvy = s.wind.spd * Math.cos(wTo * D2R);
  // drift core with wind
  const cd = dest(s.core.lat, s.core.lon, wTo, s.wind.spd * dt); s.core.lat = cd[0]; s.core.lon = cd[1];
  const dCore = dist(s.lat, s.lon, s.core.lat, s.core.lon);
  let lift = 3.4 * Math.exp(-((dCore / 55) ** 2)) - (s.alt > 2250 ? 3 : 0);
  if (s.mode === 'glide') {
    const b = brg(s.lat, s.lon, s.core.lat, s.core.lon); s.hdg += clamp(angDiff(s.hdg, b), -3, 3) * dt;
    if (dCore < 45) { s.mode = 'circle'; s.modeT = 0; }
  } else {
    s.hdg = wrap360(s.hdg + 30 * dt); // 12 s circles
    // simple centering: tighten toward strong side
    if (s.alt > 2230 || s.modeT > 420) { s.mode = 'glide'; s.modeT = 0; s.hdg = 64;
      const nc = dest(s.lat, s.lon, 64 + (Math.random() * 60 - 30), 2500 + Math.random() * 1500); s.core = { lat: nc[0], lon: nc[1] }; }
    else if (s.modeT % 12 < dt) { const b = brg(s.lat, s.lon, s.core.lat, s.core.lon); const n = dest(s.lat, s.lon, b, Math.min(15, dCore * 0.3)); s.lat = n[0]; s.lon = n[1]; }
  }
  const sink = s.mode === 'circle' ? 1.15 : 1.1;
  const v = lift - sink + (Math.random() - 0.5) * 0.35;
  s.alt += v * dt;
  const avx = s.tas * Math.sin(s.hdg * D2R), avy = s.tas * Math.cos(s.hdg * D2R);
  const gvx = avx + wvx, gvy = avy + wvy, gs = Math.hypot(gvx, gvy), trk = wrap360(Math.atan2(gvx, gvy) * R2D);
  const n = dest(s.lat, s.lon, trk, gs * dt); s.lat = n[0]; s.lon = n[1];
  if (s.alt < 300) s.alt = 1500;
  const temp = 22.5 - 0.0072 * (s.alt - 100) + (s.alt > 2250 && s.alt < 2400 ? (s.alt - 2250) * 0.01 : 0) + (Math.random() - 0.5) * 0.15;
  s.battery = Math.max(5, s.battery - 0.0005);
  onBaro({ t: s.t, alt: s.alt, vario: v, temp });
  if (Math.round(s.t / 200) % 5 === 0) onFix({ t: s.t, lat: s.lat, lon: s.lon, alt: s.alt + (Math.random() - 0.5) * 4, spd: gs, trk, sim: true });
  if (st.bora == null) st.simBat = Math.round(s.battery);
}


/* ================= IGC replay ================= */
function parseIGC(txt) {
  let day = null; const pts = []; const hdr = {}; let lad = null, lod = null;
  txt.split(/\r?\n/).forEach((l) => {
    if (/^HFDTE/i.test(l)) { const m = /(\d{2})(\d{2})(\d{2})/.exec(l.slice(5)); if (m) day = Date.UTC(2000 + +m[3], +m[2] - 1, +m[1]); }
    else if (/^HFPLT/i.test(l)) hdr.pilot = l.split(':').slice(1).join(':').trim();
    else if (/^HFGTY/i.test(l)) hdr.glider = l.split(':').slice(1).join(':').trim();
    else if (l[0] === 'I') { const n = +l.slice(1, 3) || 0; for (let k = 0; k < n; k++) { const sb = +l.slice(3 + k * 7, 5 + k * 7), eb = +l.slice(5 + k * 7, 7 + k * 7), code = l.slice(7 + k * 7, 10 + k * 7); if (code === 'LAD') lad = [sb - 1, eb]; if (code === 'LOD') lod = [sb - 1, eb]; } }
    else if (l[0] === 'B' && l.length >= 35) {
      const h = +l.slice(1, 3), mi = +l.slice(3, 5), se = +l.slice(5, 7);
      const xa = lad && l.length >= lad[1] ? +l.slice(lad[0], lad[1]) || 0 : 0, xo = lod && l.length >= lod[1] ? +l.slice(lod[0], lod[1]) || 0 : 0;   // extra decimal of the minutes
      let lat = +l.slice(7, 9) + (+l.slice(9, 14) + xa / 10) / 60000; if (l[14] === 'S') lat = -lat;
      let lon = +l.slice(15, 18) + (+l.slice(18, 23) + xo / 10) / 60000; if (l[23] === 'W') lon = -lon;
      const palt = +l.slice(25, 30), galt = +l.slice(30, 35);
      if (isNaN(lat) || isNaN(lon)) return;
      pts.push({ s: h * 3600 + mi * 60 + se, lat, lon, palt, galt, valid: l[24] === 'A' });
    }
  });
  return finishIGC(pts, day, hdr);
}
function finishIGC(pts, day, hdr) {
  if (pts.length < 10) throw new Error('no track points found');
  const base = day ?? Date.UTC(2020, 0, 1); let add = 0;
  pts.forEach((p, i) => { if (i && p.s + add < pts[i - 1].s - 3600) add += 86400; p.t = base + (p.s + add) * 1000; });
  const usePress = pts.some((p) => p.palt !== 0);
  pts.forEach((p) => { p.alt = p.galt > 0 ? p.galt : p.palt; p.valt = usePress ? p.palt : p.galt; });
  return { pts, hdr, date: day };
}
/* the built-in demo flight: a real recorded paraglider flight, stored in data/demo-flight.js */
function demoIGC() {
  if (typeof DEMO_FLIGHT === 'undefined') throw new Error('this build has no demo flight');
  const D = DEMO_FLIGHT, pts = []; let t = 0, la = 0, lo = 0, pa = 0, ga = 0;
  D.p.forEach((r) => { t += r[0]; la += r[1]; lo += r[2]; pa += r[3]; ga += r[4]; pts.push({ s: t, lat: la / 600000, lon: lo / 600000, palt: pa, galt: ga, valid: true }); });
  const [y, m, dd] = D.date.split('-').map(Number); const igc = finishIGC(pts, Date.UTC(y, m - 1, dd), { glider: D.glider }); igc.info = D; return igc;
}
const isDemo = () => !!(st.replay && st.replay.name === 'Demo flight');
function startDemoFlight() {
  try { const igc = demoIGC(); startReplay(igc, 'Demo flight'); st.replay.speed = 8; renderReplayBar(); }
  catch (e) { toast('Demo flight: ' + e.message); }
}
function resetFlightState() { st.log = []; st.thermals = []; st.winds = []; st.takeoffPos = null; st.fixes = []; st.varioHist = []; st.samples = []; st.wind = null; st.thermal = null; st.lastTurn = null; st.ld = null; st.circling = false; st.tempPts = []; st.takeoffT = null; st.gpsV = null; st.fix = null; st.baro = null; }
function startReplay(igc, name) {
  if (st.sim) stopSim(); stopReplay(true); resetFlightState();
  const pts = igc.pts;
  st.replay = { pts, i: 0, vt: pts[0].t, speed: 4, playing: true, name, v: 0 };
  st.takeoffT = pts[0].t; st.autoQ = []; st.modeSince = 0; setTimeout(() => fireEvent('takeoff'), 0);
  st.replayVer = (st.replayVer || 0) + 1; MAPS.forEach((I) => (I.up = undefined));
  st.replay.timer = setInterval(replayTick, 100);
  $('replayBar').style.display = 'flex'; $('demoBadge').style.display = 'none';
  renderReplayBar(); MAPS.forEach((I) => (I.follow = true)); showPage('pMap');
  const dur = (pts[pts.length - 1].t - pts[0].t) / 1000;
  toast(`Replaying ${name} · ${Math.floor(dur / 3600)} h ${pad2(Math.floor(dur / 60) % 60)} min · ${pts.length} points`);
}
function stopReplay(silent) {
  st.autoQ = []; st.modeSince = 0;
  if (!st.replay) return; clearInterval(st.replay.timer); st.replay = null; resetFlightState();
  st.replayVer = (st.replayVer || 0) + 1; $('replayBar').style.display = 'none'; if (!silent) toast('Replay stopped · back to live GPS');
}
function feedPoint(p, prev) {
  const r = st.replay;
  if (prev) { const dt = (p.t - prev.t) / 1000; if (dt > 0 && dt < 30) { const v = (p.valt - prev.valt) / dt; const a = dt / (dt + 2); r.v = r.v * (1 - a) + v * a; } }
  onBaro({ t: p.t, alt: p.alt, vario: r.v, temp: null });
  onFix({ t: p.t, lat: p.lat, lon: p.lon, alt: p.alt, spd: null, trk: null, replay: true });
}
function replayTick() {
  // advance by the real time passed, so a busy tablet (late timers) still plays at the chosen speed
  const r = st.replay; if (!r) return; const t = performance.now(), el = r.wall ? Math.min(1000, t - r.wall) : 100; r.wall = t;
  if (!r.playing) return;
  r.vt += el * r.speed;
  while (r.i < r.pts.length && r.pts[r.i].t <= r.vt) { feedPoint(r.pts[r.i], r.pts[r.i - 1]); r.i++; }
  if (r.i >= r.pts.length) { r.playing = false; toast('End of flight', [['Restart', () => seekReplay(0)], ['Stop', () => stopReplay()]]); }
  renderReplayBar();
}
function seekReplay(frac) {
  st.autoQ = [];
  const r = st.replay; if (!r) return; const keep = { pts: r.pts, speed: r.speed, playing: r.playing, timer: r.timer, name: r.name };
  const target = r.pts[0].t + frac * (r.pts[r.pts.length - 1].t - r.pts[0].t);
  resetFlightState(); Object.assign(r, keep, { i: 0, v: 0, vt: target }); st.takeoffT = r.pts[0].t;
  // replay the last 2 minutes quickly so wind, thermal and averages rebuild
  while (r.i < r.pts.length && r.pts[r.i].t < target - 120000) r.i++;
  while (r.i < r.pts.length && r.pts[r.i].t <= target) { feedPoint(r.pts[r.i], r.pts[r.i - 1]); r.i++; }
  if (r.i >= r.pts.length) r.playing = false; else if (frac === 0) r.playing = true;
  st.lastPredFetch = 0; MAPS.forEach((I) => (I.up = undefined)); renderReplayBar(); tick();
}
function renderReplayBar() {
  const r = st.replay; if (!r) return;
  $('rpPlay').textContent = r.playing ? '❚❚' : '▶'; $('rpPlay').setAttribute('aria-label', r.playing ? 'Pause' : 'Play');
  const sp = [1, 4, 8, 16, 64].map((k) => `<button data-sp="${k}" aria-pressed="${r.speed === k}">${k}×</button>`).join('');
  if ($('rpSpeeds')._h !== sp) { $('rpSpeeds').innerHTML = sp; $('rpSpeeds')._h = sp; }
  const a = r.pts[0].t, b = r.pts[r.pts.length - 1].t;
  if (!r.dragging) $('rpSeek').value = Math.round((r.vt - a) / (b - a) * 1000);
  const d = new Date(r.vt); $('rpTime').textContent = pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds()) + 'Z';
}

/* ================= vario sound ================= */
const beep = {
  ctx: null, osc: null, gain: null, v: 0, timer: null, on: false,
  init() { if (this.ctx) return; this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.osc = this.ctx.createOscillator(); this.gain = this.ctx.createGain(); this.osc.type = 'square'; this.gain.gain.value = 0; this.osc.connect(this.gain).connect(this.ctx.destination); this.osc.start(); this.loop(); },
  update(v) { this.v = v; },
  loop() {
    const v = this.v, g = this.gain, now = this.ctx.currentTime, vol = S.sound ? S.volume * 0.25 : 0;
    let next = 0.3;
    if (v > 0.2) { const f = 520 + v * 110, per = clamp(0.55 - v * 0.09, 0.12, 0.55); this.osc.frequency.setValueAtTime(f, now); g.gain.setValueAtTime(vol, now); g.gain.setValueAtTime(0, now + per * 0.55); next = per; }
    else if (v < -2.5) { this.osc.frequency.setValueAtTime(220 + v * 10, now); g.gain.setValueAtTime(vol * 0.7, now); next = 0.3; }
    else g.gain.setValueAtTime(0, now);
    this.timer = setTimeout(() => this.loop(), next * 1000);
  }
};

