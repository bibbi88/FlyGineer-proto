'use strict';
/* ================= helpers ================= */
const $ = (id) => document.getElementById(id);
const D2R = Math.PI / 180, R2D = 180 / Math.PI, RE = 6371000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap360 = (a) => ((a % 360) + 360) % 360;
const angDiff = (a, b) => ((b - a + 540) % 360) - 180;
function dist(a1, o1, a2, o2) { const p1 = a1 * D2R, p2 = a2 * D2R, dp = p2 - p1, dl = (o2 - o1) * D2R; const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; return 2 * RE * Math.asin(Math.min(1, Math.sqrt(h))); }
function brg(a1, o1, a2, o2) { const p1 = a1 * D2R, p2 = a2 * D2R, dl = (o2 - o1) * D2R; return wrap360(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) * R2D); }
function dest(a, o, b, d) { const p1 = a * D2R, l1 = o * D2R, t = b * D2R, dr = d / RE; const p2 = Math.asin(Math.sin(p1) * Math.cos(dr) + Math.cos(p1) * Math.sin(dr) * Math.cos(t)); const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(dr) * Math.cos(p1), Math.cos(dr) - Math.sin(p1) * Math.sin(p2)); return [p2 * R2D, ((l2 * R2D + 540) % 360) - 180]; }
function enu(lat0, lon0, lat, lon) { return [(lon - lon0) * Math.cos(lat0 * D2R) * 111320, (lat - lat0) * 110540]; }
const PTS16 = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const compass = (b) => PTS16[Math.round(wrap360(b) / 22.5) % 16];
const pad2 = (n) => String(n).padStart(2, '0');
function css(v) { return getComputedStyle(document.body).getPropertyValue(v).trim(); }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ================= settings ================= */
const DEF = {
  uVario: 'm/s', uAlt: 'm', uSpd: 'km/h', avgS: 30, wingLD: 9.0, rotDefault: 'north', taOrient: 'wind',
  layer: 'topo', poiRadius: 20, poiKinds: { town: true, airport: true, peak: true }, cylR: 400, safety: 150,
  theme: 'light', navMode: 'auto', trig: 2, flykUrl: '', rate: 0.4, rateT: 0, modeAuto: true, modeEnter: 6, modeHold: 20, thermPage: 'off', thermBack: true, modeChip: true, autoRules: [], notamProxy: '', notamRadius: 50, sound: false, volume: 0.5, wake: true, autoImport: true, openaipKey: '', customUrl: '',
  widgets: ['vario', 'avg', 'alt', 'agl', 'gs', 'ld', 'next', 'thermal', 'flight', 'utc'],
  hidden: []
};
let S = Object.assign({}, DEF, JSON.parse(localStorage.getItem('bora.settings') || '{}'));
function save() { localStorage.setItem('bora.settings', JSON.stringify(S)); }
const fVario = (ms) => ms == null || isNaN(ms) ? '--' : (S.uVario === 'kt' ? (ms * 1.94384).toFixed(1) : S.uVario === 'fpm' ? Math.round(ms * 196.85 / 10) * 10 : ms.toFixed(1)).toString().replace(/^(?!-)/, ms >= 0 ? '+' : '');
const fAlt = (m) => m == null || isNaN(m) ? '--' : String(Math.round(S.uAlt === 'ft' ? m * 3.28084 : m));
const fSpd = (ms) => ms == null || isNaN(ms) ? '--' : String(Math.round(S.uSpd === 'kt' ? ms * 1.94384 : ms * 3.6));
const fDist = (m) => m == null ? '--' : m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km';
const uV = () => S.uVario === 'fpm' ? 'ft/min' : S.uVario;

/* ================= state ================= */
const st = {
  fix: null, fixes: [], baro: null, varioSrc: 'none', alt: null, vario: 0, varioHist: [], samples: [],
  wind: null, circling: false, thermal: null, lastTurn: null, ld: null, groundElev: null, elevAt: null,
  log: [], thermals: [], winds: [], takeoffPos: null,
  task: JSON.parse(localStorage.getItem('bora.task') || 'null'), nextWp: 0, takeoffT: null,
  airspaces: [], places: [], placesAt: null, forecast: null, tempPts: [], bora: null, deviceBat: null,
  pred: { now: null, wing: null, ldNow: null }, sim: null, gpsOk: false, follow: true, lastPredFetch: 0
};

/* ================= data input ================= */
function onFix(f) {
  // f: {t, lat, lon, alt (gps, m|null), spd (m/s|null), trk (deg|null), sim}
  const prev = st.fixes[st.fixes.length - 1];
  if (prev && (f.trk == null || f.spd == null)) {
    const dt = (f.t - prev.t) / 1000;
    if (dt > 0) {
      const d = dist(prev.lat, prev.lon, f.lat, f.lon);
      if (f.spd == null) f.spd = d / dt;
      if (f.trk == null) f.trk = d > 0.5 ? brg(prev.lat, prev.lon, f.lat, f.lon) : prev.trk;
    }
  }
  st.fix = f; st.fixes.push(f);
  const cut = f.t - 330000; while (st.fixes.length && st.fixes[0].t < cut) st.fixes.shift();
  st.gpsOk = true;
  // GPS-only vario fallback
  if (!st.baro || f.t - st.baro.t > 3000) {
    if (prev && prev.alt != null && f.alt != null) {
      const dt = (f.t - prev.t) / 1000; if (dt > 0) { const v = (f.alt - prev.alt) / dt; st.gpsV = st.gpsV == null ? v : st.gpsV * 0.8 + v * 0.2; }
    }
    st.varioSrc = 'gps'; pushVario(f.t, st.gpsV ?? 0, f.alt);
  }
  if (!st.takeoffT && f.spd > 4) { st.takeoffT = f.t; fireEvent('takeoff'); }
  if (st.takeoffT && !st.takeoffPos) { st.takeoffPos = [f.lat, f.lon, f.alt ?? altNow()]; autoStart(); }
  const lg = st.log[st.log.length - 1]; if (lg && f.t - lg.t < 15000 && lg.spd == null) { lg.spd = f.spd; lg.lat = f.lat; lg.lon = f.lon; }
  analyse(f);
}
function onBaro(b) { // {t, alt, vario, temp, batt}
  st.baro = b; st.varioSrc = st.sim ? 'demo' : 'bora';
  pushVario(b.t, b.vario, b.alt);
  if (b.temp != null && b.alt != null) {
    const last = st.tempPts[st.tempPts.length - 1];
    if (!last || Math.abs(last.alt - b.alt) > 15) { st.tempPts.push({ alt: b.alt, temp: b.temp }); if (st.tempPts.length > 600) st.tempPts.shift(); }
  }
}
function pushVario(t, v, alt) {
  const lgl = st.log[st.log.length - 1];
  if (!lgl || t - lgl.t >= 1000) { st.log.push({ t, v, alt: alt ?? altNow(), spd: st.fix?.spd ?? null, lat: st.fix?.lat, lon: st.fix?.lon }); if (st.log.length > 16000) st.log.splice(0, 1000); }
  st.vario = v; if (alt != null) st.alt = alt;
  st.varioHist.push({ t, v, alt });
  const cut = t - 330000; while (st.varioHist.length && st.varioHist[0].t < cut) st.varioHist.shift();
  if (S.sound) beep.update(v);
}
const nowT = () => (st.replay ? st.replay.vt : Date.now());
function avgVario(sec, now) { now = now || nowT(); const a = st.varioHist.filter((h) => h.t > now - sec * 1000); return a.length ? a.reduce((s, h) => s + h.v, 0) / a.length : null; }
const altNow = () => st.alt ?? st.fix?.alt ?? null;

