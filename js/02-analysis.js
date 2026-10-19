'use strict';
/* ================= analysis: circling, wind, thermal, turn ================= */
function analyse(f) {
  const fx = st.fixes, now = f.t;
  // turn rate over S.cirWin s (Flight modes → Circling)
  const w = fx.filter((p) => p.t > now - sN('cirWin', 8) * 1000 && p.trk != null);
  let turn = 0; for (let i = 1; i < w.length; i++) turn += angDiff(w[i - 1].trk, w[i].trk);
  const span = w.length > 1 ? (w[w.length - 1].t - w[0].t) / 1000 : 1;
  const rate = turn / Math.max(1, span);
  const was = st.circling;
  st.turnRate = rate; st.circling = Math.abs(rate) > sN('cirRate', 7) && f.spd > sN('cirSpd', 7.2) / 3.6;
  // circling again within S.thJoin s (Flight modes) continues the same thermal: a short straight bit or a slow turn does not restart gain and average
  const join = sN('thJoin', 30) * 1000;
  if (st.circling && !was) { const T = st.thermal; if (T && T.end && now - T.end <= join) delete T.end; else st.thermal = { t0: now, alt0: altNow(), lat0: f.lat, lon0: f.lon }; }
  if (!st.circling && was && st.thermal) { const T = st.thermal; T.end = now; const dur = (now - T.t0) / 1000; const a1 = altNow(); T.alt1 = a1;
    if (dur >= sN('thRec', 30) && a1 != null && T.alt0 != null) { const q = T.rec || (T.rec = {}); Object.assign(q, { t0: T.t0, t1: now, alt0: T.alt0, alt1: a1, avg: (a1 - T.alt0) / dur, lat: f.lat, lon: f.lon }); if (!st.thermals.includes(q)) st.thermals.push(q); rememberThermal(q); } }
  if (st.thermal && !st.circling && now - (st.thermal.end || now) > Math.max(30000, join)) st.thermal = null;
  towDetect(f);
  // last full circle
  let acc = 0, i = fx.length - 1; const circ = [];
  while (i > 0 && fx[i].t > now - 60000) { if (fx[i].trk == null || fx[i - 1].trk == null) break; acc += angDiff(fx[i - 1].trk, fx[i].trk); circ.push(fx[i]); if (Math.abs(acc) >= 360) break; i--; }
  if (st.circling && Math.abs(acc) >= 360 && circ.length > 8) {
    windUpdate(circ, now);
    { const lw = st.winds[st.winds.length - 1]; if (!lw || now - lw.t > 30000) { const sp = Math.hypot(st.wind.vx, st.wind.vy); st.winds.push({ t: now, alt: altNow(), spd: sp, from: wrap360(Math.atan2(st.wind.vx, st.wind.vy) * R2D + 180) }); } }
    // turn radius from air-relative positions
    const c0 = circ[circ.length - 1];
    const pts = circ.map((p) => { const [x, y] = enu(c0.lat, c0.lon, p.lat, p.lon); const dt = (p.t - c0.t) / 1000; return [x - st.wind.vx * dt, y - st.wind.vy * dt]; });
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const rs = pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy));
    const tas = circ.reduce((s, p) => s + Math.hypot(p.spd * Math.sin(p.trk * D2R) - st.wind.vx, p.spd * Math.cos(p.trk * D2R) - st.wind.vy), 0) / circ.length;
    const T = (circ[0].t - circ[circ.length - 1].t) / 1000;
    const rAvg = rs.reduce((s, r) => s + r, 0) / rs.length;
    st.lastTurn = { min: Math.min(...rs), max: Math.max(...rs), avg: rAvg, T, tas, pts: pts.map((p) => [p[0] - cx, p[1] - cy]), bankMin: Math.atan(tas * tas / (9.81 * Math.max(...rs))) * R2D, bankMax: Math.atan(tas * tas / (9.81 * Math.max(3, Math.min(...rs)))) * R2D };
    // one entry per full turn: its radius and the climb during it (for the ideal circle's radius suggestion, idealR)
    const tl = st.turnLog || (st.turnLog = []), lt = tl[tl.length - 1], th0 = st.thermal ? st.thermal.t0 : now;
    if (!lt || now - lt.t >= T * 1000 * 0.95 || lt.t < th0) { const v = avgVario(T, now); if (v != null) tl.push({ t: now, r: rAvg, v }); while (tl.length > 12 || (tl.length && tl[0].t < th0)) tl.shift(); }
  }
  // samples for thermal assistant
  // position in the moving air (ax, ay in m), built up step by step with the wind known at that moment:
  // later wind estimates never reshape the past (the thermal views used to shift with every new wind estimate)
  { const p = st.samples[st.samples.length - 1], s = { t: now, lat: f.lat, lon: f.lon, v: st.vario, alt: altNow(), ax: 0, ay: 0 };
    if (p && p.ax != null) { const [dx, dy] = enu(p.lat, p.lon, f.lat, f.lon), dt = (now - p.t) / 1000, w = st.wind || { vx: 0, vy: 0 }; s.ax = p.ax + dx - w.vx * dt; s.ay = p.ay + dy - w.vy * dt; }
    st.samples.push(s); }
  const cut = now - 600000; while (st.samples.length && st.samples[0].t < cut) st.samples.shift();
  // glide ratio when gliding
  if (!st.circling) { const a = avgVario(20, now); const gs = avgSpd(20, now); if (a != null && a < -0.2 && gs > 3) st.ld = gs / -a; }
  // task progress
  // turnpoint reached: move on to the next one and let the Next turnpoint widget say so for a while (st.wpHit); the last point is the goal (st.goalT)
  if (st.task && st.task.pts[st.nextWp] && !st.goalT) { const wp = st.task.pts[st.nextWp]; if (dist(f.lat, f.lon, wp.lat, wp.lon) < (S.cylR || 400)) {
    st.wpHit = { name: wp.name, t: nowT() };
    if (st.nextWp < st.task.pts.length - 1) { st.nextWp++; toast('Turnpoint ' + wp.name + ' reached · next ' + st.task.pts[st.nextWp].name); }
    else { st.goalT = nowT(); toast('Goal reached'); }
    fireEvent('turnpoint'); } }
}
/* ================= tow launch (winch / vehicle tow) =================
   A tow starts when, right after takeoff (or within S.towWin s, default 90, of the previous release: step towing), you climb at ≥ S.towMin m/s
   in a straight line for 5 s without circling. It ends at release: climb below S.towRelV m/s for S.towRelT s, or circling. */
function towDetect(f) {
  if (S.towDetect === false || !st.takeoffT) return; const now = f.t, a = altNow(); if (a == null) return;
  const tows = st.tows || (st.tows = []), T = tows[tows.length - 1], v5 = avgVario(5, now);
  if (T && T.active) {
    if (a > T.top) { T.top = a; T.tTop = now; } T.t1 = now; T.alt1 = a;
    if (v5 != null && v5 < sN('towRelV', 0.3)) { T.low = T.low || now; } else T.low = 0;
    if ((T.low && now - T.low >= sN('towRelT', 4) * 1000) || st.circling) { T.active = false; T.t1 = T.tTop; T.alt1 = T.top; st.towEnd = now; fireEvent('towEnd'); }
    return;
  }
  const tw = sN('towWin', 90) * 1000, early = now - st.takeoffT < tw || (T && now - st.towEnd < tw); if (!early || st.circling || v5 == null || v5 < (+S.towMin || 1) || !(f.spd > 4)) return;
  const fx = st.fixes.filter((p) => p.t > now - 6000 && p.trk != null); if (fx.length < 3) return;
  const straight = fx.every((p) => Math.abs(angDiff(fx[0].trk, p.trk)) < 30); if (!straight) return;
  const h0 = st.varioHist.find((h) => h.t >= now - 5000) || { t: now, alt: a };
  tows.push({ n: tows.length + 1, t0: h0.t, alt0: h0.alt ?? a, t1: now, alt1: a, top: a, tTop: now, active: true }); fireEvent('towStart');
}
const towNow = () => { const T = st.tows && st.tows[st.tows.length - 1]; return T || null; };
function avgSpd(sec, now) { const a = st.fixes.filter((p) => p.t > now - sec * 1000 && p.spd != null); return a.length ? a.reduce((s, p) => s + p.spd, 0) / a.length : null; }
/* wind from circling, filtered (2026-10-18; it used to mix every 1 s sample's circle mean in at 40 %, so one uneven circle moved it):
   1. per circle: the ground-speed vectors of a full turn lie on a circle whose centre is the wind and whose radius is your airspeed;
      a least-squares circle fit finds it even with uneven sampling. Circles whose airspeed scatters (> 18 % of it: entry, corrections,
      gusts) or is implausible are rejected.
   2. at most one estimate per half turn (st.windEst, last 10 min).
   3. st.wind = recency-weighted average (half weight after S.windAvg s, default 120) of the estimates, without the ones far off the rest. */
function windFit(circ) {
  const V = circ.map((p) => [p.spd * Math.sin(p.trk * D2R), p.spd * Math.cos(p.trk * D2R)]), n = V.length;
  let mx = 0, my = 0; V.forEach(([x, y]) => { mx += x; my += y; }); mx /= n; my /= n;
  // Kåsa fit around the mean: u² + v² = 2a·u + 2b·v + c, (u, v) = V − mean
  let Suu = 0, Svv = 0, Suv = 0, Su3 = 0, Sv3 = 0, Suvv = 0, Svuu = 0;
  V.forEach(([x, y]) => { const u = x - mx, v = y - my; Suu += u * u; Svv += v * v; Suv += u * v; Su3 += u * u * u; Sv3 += v * v * v; Suvv += u * v * v; Svuu += v * u * u; });
  const det = 2 * (Suu * Svv - Suv * Suv); let cx = mx, cy = my;
  if (Math.abs(det) > 1e-6) { const r1 = Su3 + Suvv, r2 = Sv3 + Svuu; cx = mx + (r1 * Svv - r2 * Suv) / det; cy = my + (r2 * Suu - r1 * Suv) / det; }
  const R = V.map(([x, y]) => Math.hypot(x - cx, y - cy)), tas = R.reduce((s, r) => s + r, 0) / n, sd = Math.sqrt(R.reduce((s, r) => s + (r - tas) ** 2, 0) / n);
  return { vx: cx, vy: cy, tas, q: tas > 0 ? sd / tas : 1 };
}
function windUpdate(circ, now) {
  const E = st.windEst || (st.windEst = []), T = (circ[0].t - circ[circ.length - 1].t) || 20000, last = E[E.length - 1];
  if (last && now - last.t < T * 0.5) return; // one estimate per half turn
  const w = windFit(circ); if (!(w.tas > 4 && w.tas < 30 && w.q < 0.18 && Math.hypot(w.vx, w.vy) < 30)) return;
  E.push({ t: now, vx: w.vx, vy: w.vy, q: w.q }); while (E.length && E[0].t < now - 600000) E.shift();
  const half = clamp(sN('windAvg', 120), 20, 600) * 1000, wt = (e) => Math.pow(0.5, (now - e.t) / half) * (1 - e.q * 3);
  const avg = (L) => { let sx = 0, sy = 0, sw = 0; L.forEach((e) => { const k = Math.max(0.05, wt(e)); sx += e.vx * k; sy += e.vy * k; sw += k; }); return sw ? { vx: sx / sw, vy: sy / sw } : null; };
  let m = avg(E); const sp = Math.hypot(m.vx, m.vy), keep = E.filter((e) => Math.hypot(e.vx - m.vx, e.vy - m.vy) <= Math.max(1.5, sp * 0.4));
  if (keep.length && keep.length < E.length) m = avg(keep);
  st.wind = m;
}
function windFromSpd() { if (!st.wind) return null; const sp = Math.hypot(st.wind.vx, st.wind.vy); const to = wrap360(Math.atan2(st.wind.vx, st.wind.vy) * R2D); return { spd: sp, from: wrap360(to + 180), to }; }

/* ================= elevation & glide prediction ================= */
async function elevations(pts) {
  const lat = pts.map((p) => p[0].toFixed(5)).join(','), lon = pts.map((p) => p[1].toFixed(5)).join(',');
  const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);
  if (!r.ok) throw new Error('elevation ' + r.status);
  return (await r.json()).elevation;
}
async function updateGround() {
  const f = st.fix; if (!f) return;
  if (st.elevAt && dist(st.elevAt[0], st.elevAt[1], f.lat, f.lon) < 250) return;
  st.elevAt = [f.lat, f.lon];
  try { st.groundElev = (await elevations([[f.lat, f.lon]]))[0]; } catch (e) { st.elevAt = null; }
}
async function updatePrediction() {
  const f = st.fix, alt = altNow(); if (!f || alt == null || f.trk == null) return;
  if (Date.now() - st.lastPredFetch < 12000) return; st.lastPredFetch = Date.now();
  const ldNow = st.ld && st.ld < 30 ? st.ld : null;
  const agl = st.groundElev != null ? alt - st.groundElev : null; if (agl == null || agl < 20) { st.pred = { now: null, wing: null, ldNow }; return; }
  const maxD = Math.min(60000, agl * Math.max(S.wingLD, ldNow || 0) * 1.6 + 2000), step = Math.max(250, maxD / 90);
  const pts = []; for (let d = step; d <= maxD; d += step) pts.push(dest(f.lat, f.lon, f.trk, d));
  let el; try { el = await elevations(pts); } catch (e) { el = null; }
  const solve = (ld) => { if (!ld) return null; if (!el) return dest(f.lat, f.lon, f.trk, agl * ld).concat(agl * ld); for (let i = 0; i < pts.length; i++) { const d = step * (i + 1); if (alt - d / ld <= el[i]) return pts[i].concat(d); } return null; };
  st.pred = { now: solve(ldNow), wing: solve(S.wingLD), ldNow, heading: f.trk };
}

/* ================= glide reach area =================
   Where you can still glide to with the wing's glide ratio (S.wingLD at trim speed S.wingSpd km/h) in the current wind, arriving S.safety m above
   the terrain. One ray per 10°: ground speed along it = wind along + √(V² − wind across²); height runs out where alt − d·sink/gs < terrain + safety.
   Terrain from Open-Meteo, cached per ~250 m cell (elevCache), so a re-run only fetches cells it has not seen. Only while a map has cfg.reach on. */
const elevCache = new Map(), ELC = 0.0025, elKey = (la, lo) => Math.round(la / ELC) + ',' + Math.round(lo / ELC);
async function elevCached(pts) {
  const miss = []; pts.forEach((p) => { const k = elKey(p[0], p[1]); if (!elevCache.has(k) && !miss.some((m) => m.k === k)) miss.push({ k, p: [Math.round(p[0] / ELC) * ELC, Math.round(p[1] / ELC) * ELC] }); });
  for (let i = 0; i < miss.length; i += 100) { const b = miss.slice(i, i + 100), el = await elevations(b.map((m) => m.p)); b.forEach((m, j) => elevCache.set(m.k, el[j])); }
  if (elevCache.size > 40000) { const it = elevCache.keys(); for (let i = 0; i < 10000; i++) elevCache.delete(it.next().value); }
  return pts.map((p) => elevCache.get(elKey(p[0], p[1])));
}
// ground speed (m/s) along bearing b with airspeed V and the current wind; 0 when you cannot make way that way
function gsAlong(b, V) { const w = st.wind || { vx: 0, vy: 0 }, ux = Math.sin(b * D2R), uy = Math.cos(b * D2R), along = w.vx * ux + w.vy * uy, across = w.vx * uy - w.vy * ux; if (V * V <= across * across) return 0; return Math.max(0, along + Math.sqrt(V * V - across * across)); }
function reachWanted() { return [...MAPS].some((I) => { const W = findW(I.id); const v = W && effCfg(W).reach; return v === true || v === 'true'; }); }
async function updateReach(force) {
  const f = st.fix, alt = altNow(); if (!f || alt == null || st.reachBusy || !reachWanted()) return;
  const R = st.reach, now = Date.now();
  if (!force && R && now - R.t < 20000 && dist(R.lat, R.lon, f.lat, f.lon) < 300 && Math.abs(R.alt - alt) < 30 && R.wk === windKey()) return;
  st.reachBusy = true;
  try {
    const V = Math.max(5, sN('wingSpd', 37) / 3.6), sink = V / Math.max(2, S.wingLD), safe = +S.safety || 0, g0 = st.groundElev ?? 0, N = 36, K = 14, rays = [];
    for (let i = 0; i < N; i++) { const b = i * 360 / N, gs = gsAlong(b, V), flat = gs > 0 ? Math.max(0, alt - g0 - safe) * gs / sink : 0, maxD = Math.min(80000, flat * 1.6 + 500); rays.push({ b, gs, maxD, pts: [] }); for (let k = 1; k <= K; k++) rays[i].pts.push(dest(f.lat, f.lon, b, maxD * k / K)); }
    let el = null; try { el = await elevCached(rays.flatMap((r) => r.pts)); } catch (e) { el = null; }
    if (!el && st.groundElev == null) { st.reach = null; return; } // no terrain at all: better nothing than a guess
    const poly = rays.map((r, i) => {
      if (r.gs <= 0) return [f.lat, f.lon];
      let d = r.maxD, prevD = 0, prevM = alt - (st.groundElev ?? alt) - safe;
      for (let k = 0; k < K; k++) { const dk = r.maxD * (k + 1) / K, gnd = el ? el[i * K + k] : g0, m = alt - dk * sink / r.gs - gnd - safe;
        if (m < 0) { d = prevM > 0 ? prevD + (dk - prevD) * prevM / (prevM - m) : prevD; break; } prevD = dk; prevM = m; }
      return dest(f.lat, f.lon, r.b, d);
    });
    st.reach = { t: now, lat: f.lat, lon: f.lon, alt, wk: windKey(), poly, terrain: !!el, V, sink };
    markDirty();
  } finally { st.reachBusy = false; }
}
const windKey = () => st.wind ? Math.round(st.wind.vx * 2) + ',' + Math.round(st.wind.vy * 2) : '0';

/* ================= Bora over Bluetooth (Nordic UART, LK8EX1) ================= */
const NUS = '6e400001-b5a3-f393-e0a9-e50e24dcca9e', NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
let bleBuf = '';
async function connectBora() {
  if (!navigator.bluetooth) { toast('Bluetooth needs Chrome on Android and an https page'); return; }
  try {
    const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [NUS] });
    const srv = await dev.gatt.connect();
    const ch = await (await srv.getPrimaryService(NUS)).getCharacteristic(NUS_TX);
    await ch.startNotifications();
    ch.addEventListener('characteristicvaluechanged', (e) => { bleBuf += new TextDecoder().decode(e.target.value); let m; while ((m = /\r\n|\n|\r/.exec(bleBuf))) { parseLine(bleBuf.slice(0, m.index).trim()); bleBuf = bleBuf.slice(m.index + m[0].length); } if (bleBuf.length > 400) bleBuf = ''; }); // lines end with \r\n; split over several BLE packets
    dev.addEventListener('gattserverdisconnected', () => { st.bora = null; toast('Bora disconnected'); renderSettings(); });
    st.bora = { name: dev.name || 'Bora', batt: null }; toast('Connected to ' + st.bora.name); renderSettings();
  } catch (e) { toast('Bluetooth: ' + e.message); }
}
/* barometer: the Bora sends only the pressure (Pa, ~12 per second) with altitude 99999 and vario 9999 = "not available", like
   XCTrack expects; altitude comes from the pressure and QNH (S.qnh), climb from a Kalman filter (height + climb rate) on that
   altitude. Tuning (Settings → Vario & GPS → Barometer): S.baroTau = response time in s (shorter = quicker, noisier),
   S.baroNoise = sensor noise in m (σ of the raw altitude). A device that sends its own altitude / vario is used as it is. */
const baroAlt = (pa) => 44330 * (1 - Math.pow(pa / 100 / (sN('qnh', 1013.25) || 1013.25), 0.1903));
const baroK = { h: null, v: 0, P: null, t: 0, qnh: null };
function baroFilter(z, t) {
  const K = baroK, R = sN('baroNoise', 0.3) ** 2, tau = clamp(sN('baroTau', 1), 0.1, 10), q = 4 * R / tau ** 4;
  if (K.h == null || t - K.t > 5000 || t < K.t || K.qnh !== S.qnh) { Object.assign(K, { h: z, v: 0, P: [[R, 0], [0, 1]], t, qnh: S.qnh }); return K; }
  const dt = (t - K.t) / 1000; if (dt <= 0) return K; K.t = t;
  const [[a, b], [c, d]] = K.P; K.h += K.v * dt; // predict (constant climb), process noise from the vertical acceleration q
  const p00 = a + dt * (b + c) + dt * dt * d + q * dt ** 4 / 4, p01 = b + dt * d + q * dt ** 3 / 2, p10 = c + dt * d + q * dt ** 3 / 2, p11 = d + q * dt * dt;
  const s = p00 + R, k0 = p00 / s, k1 = p10 / s, y = z - K.h; // update with the measured altitude
  K.h += k0 * y; K.v += k1 * y; K.P = [[(1 - k0) * p00, (1 - k0) * p01], [p10 - k1 * p00, p11 - k1 * p01]];
  return K;
}
function parseLine(l) {
  if (l) { const L = st.baroLines || (st.baroLines = []); L.push(l); if (L.length > 12) L.shift(); }
  if (l.startsWith('$PFLAA')) { flarmLine(l); return; }
  if (!l.startsWith('$LK8EX1')) return;
  const p = l.split('*')[0].split(','), t = Date.now();
  const pres = +p[1], altR = +p[2], vCm = +p[3], temp = +p[4], bat = +p[5], pa = isFinite(pres) && pres > 30000 && pres < 120000 ? pres : null;
  const own = isFinite(altR) && altR !== 99999 && p[2] !== '', raw = own ? altR : pa != null ? baroAlt(pa) : null;
  if (st.bora) st.bora.batt = isNaN(bat) || bat === 999 ? null : bat > 1000 ? { pct: bat - 1000 } : { v: bat };
  let alt = null, vario = isFinite(vCm) && vCm !== 9999 && p[3] !== '' ? vCm / 100 : null;
  if (raw != null) { const K = baroFilter(raw, t); alt = K.h; if (vario == null) vario = K.v; }
  const B = st.baroLog || (st.baroLog = []); B.push({ t, pa, raw, h: alt, v: vario }); while (B.length && B[0].t < t - 90000) B.shift();
  onBaro({ t, alt, vario: vario ?? 0, temp: isNaN(temp) || temp === 99 ? null : temp, pa });
}

/* FLARM data port traffic ($PFLAA) from the vario or any Bluetooth device sending it (ADS-L / FANET / OGN / ADS-B receivers):
   $PFLAA,<alarm 0-3>,<rel north m>,<rel east m>,<rel vertical m>,<id type>,<id hex>,<track>,<turn rate>,<ground speed m/s>,<climb m/s>,<aircraft type hex>[,<no-track>,<source>,<rssi>]
   positions are relative to the sender's GPS; placed from our own fix when the line arrives. */
st.flarm = new Map();
const FLARM_KIND = { 1: 'glider', 3: 'heli', 4: 'pg', 6: 'pg', 7: 'pg', 9: 'big' }, FLARM_NAME = { 1: 'Glider', 2: 'Tow', 3: 'Heli', 4: 'Skydiver', 5: 'Drop plane', 6: 'HG', 7: 'PG', 8: 'Plane', 9: 'Jet', 11: 'Balloon', 12: 'Airship', 13: 'Drone', 15: 'Obstacle' };
function flarmLine(l) {
  const [body, cs] = l.slice(1).split('*');
  if (cs && /^[0-9A-F]{2}/i.test(cs)) { let x = 0; for (let i = 0; i < body.length; i++) x ^= body.charCodeAt(i); if (x !== parseInt(cs.slice(0, 2), 16)) return; }
  const p = body.split(','), f = st.fix; if (p.length < 11 || !f) return;
  const n = +p[2], e = +p[3], v = p[4] === '' ? null : +p[4], id = (p[6] || '').trim().toLowerCase(); if (!isFinite(n) || !isFinite(e) || !id) return;
  const ty = parseInt(p[11], 16) || 0, noTrk = p[12] === '1' || p[7] === '', trk = noTrk ? null : +p[7], gs = noTrk ? 0 : +p[9] || 0, now = Date.now();
  const lat = f.lat + n / 111320, lon = f.lon + e / (111320 * Math.cos(f.lat * D2R));
  st.flarm.set(id, { hex: id, idType: +p[5], call: FLARM_NAME[ty] || '', lat, lon, rel: v, altM: v != null && f.alt != null ? f.alt + v : null, gs: gs * 1.94384, trk, climb: p[10] === '' ? null : +p[10], kind: FLARM_KIND[ty] || 'small', alarm: +p[1] || 0, src: p[13] === '' || p[13] == null ? null : +p[13], t: now, seen: 0, local: true });
  st.flarmAt = now; st.flarmN = (st.flarmN || 0) + 1;
  st.flarm.forEach((a, k) => { if (now - a.t > 15000) st.flarm.delete(k); });
  markDirty();
}
// FLARM traffic still fresh (≤ 12 s)
function flarmList() { const now = Date.now(), out = []; st.flarm.forEach((a, k) => { if (now - a.t <= 12000) out.push(a); else if (now - a.t > 15000) st.flarm.delete(k); }); return out; }

/* ================= GPS ================= */
let gpsWatch = null;
function startGPS() {
  if (!navigator.geolocation) { toast('No GPS available in this browser'); return; }
  if (gpsWatch != null) return;
  gpsWatch = navigator.geolocation.watchPosition((p) => {
    const c = p.coords; st.gpsPos = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, t: Date.now() }; // the real device position, also during a demo or replay
    if (st.sim || st.replay) return;
    onFix({ t: p.timestamp || Date.now(), lat: c.latitude, lon: c.longitude, alt: c.altitude, spd: c.speed, trk: c.heading != null && !isNaN(c.heading) && c.speed > 1 ? c.heading : null, acc: c.accuracy });
  }, (e) => { st.gpsOk = false; toast('GPS: ' + e.message); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
}

