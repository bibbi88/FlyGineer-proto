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
    let vx = 0, vy = 0; circ.forEach((p) => { vx += p.spd * Math.sin(p.trk * D2R); vy += p.spd * Math.cos(p.trk * D2R); });
    vx /= circ.length; vy /= circ.length;
    const nw = { vx, vy };
    st.wind = st.wind ? { vx: st.wind.vx * 0.6 + vx * 0.4, vy: st.wind.vy * 0.6 + vy * 0.4 } : nw;
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
    ch.addEventListener('characteristicvaluechanged', (e) => { bleBuf += new TextDecoder().decode(e.target.value); let k; while ((k = bleBuf.indexOf('\n')) >= 0) { parseLine(bleBuf.slice(0, k).trim()); bleBuf = bleBuf.slice(k + 1); } if (bleBuf.length > 400) bleBuf = ''; });
    dev.addEventListener('gattserverdisconnected', () => { st.bora = null; toast('Bora disconnected'); renderSettings(); });
    st.bora = { name: dev.name || 'Bora', batt: null }; toast('Connected to ' + st.bora.name); renderSettings();
  } catch (e) { toast('Bluetooth: ' + e.message); }
}
function parseLine(l) {
  if (!l.startsWith('$LK8EX1')) return;
  const p = l.split('*')[0].split(',');
  const pres = +p[1], altR = +p[2], vCm = +p[3], temp = +p[4], bat = +p[5];
  let alt = altR !== 99999 && !isNaN(altR) ? altR : null;
  if (alt == null && pres && pres !== 999999) alt = 44330 * (1 - Math.pow(pres / 100 / (S.qnh || 1013.25), 0.1903));
  if (st.bora) st.bora.batt = isNaN(bat) || bat === 999 ? null : bat > 1000 ? { pct: bat - 1000 } : { v: bat };
  onBaro({ t: Date.now(), alt, vario: isNaN(vCm) || vCm === 9999 ? 0 : vCm / 100, temp: isNaN(temp) || temp === 99 ? null : temp });
}

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

