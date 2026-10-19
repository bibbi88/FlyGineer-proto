'use strict';
/* ================= helpers ================= */
const $ = (id) => document.getElementById(id);
const D2R = Math.PI / 180, R2D = 180 / Math.PI, RE = 6371000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sN = (k, d) => { const v = parseFloat(S[k]); return isFinite(v) ? v : d; }; // numeric setting where 0 is valid, d when unset
const wrap360 = (a) => ((a % 360) + 360) % 360;
const angDiff = (a, b) => ((b - a + 540) % 360) - 180;
function dist(a1, o1, a2, o2) { const p1 = a1 * D2R, p2 = a2 * D2R, dp = p2 - p1, dl = (o2 - o1) * D2R; const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; return 2 * RE * Math.asin(Math.min(1, Math.sqrt(h))); }
function brg(a1, o1, a2, o2) { const p1 = a1 * D2R, p2 = a2 * D2R, dl = (o2 - o1) * D2R; return wrap360(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) * R2D); }
function dest(a, o, b, d) { const p1 = a * D2R, l1 = o * D2R, t = b * D2R, dr = d / RE; const p2 = Math.asin(Math.sin(p1) * Math.cos(dr) + Math.cos(p1) * Math.sin(dr) * Math.cos(t)); const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(dr) * Math.cos(p1), Math.cos(dr) - Math.sin(p1) * Math.sin(p2)); return [p2 * R2D, ((l2 * R2D + 540) % 360) - 180]; }
function enu(lat0, lon0, lat, lon) { return [(lon - lon0) * Math.cos(lat0 * D2R) * 111320, (lat - lat0) * 110540]; }
const PTS16 = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const compass = (b) => PTS16[Math.round(wrap360(b) / 22.5) % 16];
const pad2 = (n) => String(n).padStart(2, '0');
const cssC = {};
function css(v) { const k = document.body.className + '|' + v; if (cssC[k]) return cssC[k]; const r = getComputedStyle(document.body).getPropertyValue(v).trim(); if (r) cssC[k] = r; return r; }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ================= settings ================= */
// defaults = the owner's own export of 2026-10-18 (bora-settings-20261018.json; callsign and radio message left generic), padding tight (2 / 1 px)
const DEF = {
  uVario: 'm/s', uAlt: 'm', uSpd: 'km/h', avgS: 5, wingLD: 9.0, rotDefault: 'north', taOrient: 'wind',
  layer: 'sat', poiRadius: 20, poiKinds: { town: true, airport: true, peak: false }, cylR: 400, safety: 150,
  theme: 'light', navMode: 'auto', trig: 2, flykUrl: '', rate: 1, rateT: 0.5, ctlSmall: 320, qnh: 1013.25, baroTau: 1, baroNoise: 0.3, wGap: 4, wPadX: 2, wPadY: 1, wLab: 12, wRad: 10, modeAuto: true, modeEnter: 6, modeHold: 20, modeClimbOn: false, modeClimb: 0.3, toSpd: 14.4, toTime: 3, cirRate: 7, cirWin: 8, cirSpd: 7.2, thRec: 30, thJoin: 30, windAvg: 120, towWin: 20, towRelV: 0.3, towRelT: 8, xcOut: 2, xcBack: 75, xcTri: 15, thermPage: 'pThermal', thermBack: 'pMap', modeChip: true, autoRules: [{ id: 'arDef1', on: true, event: 'towStart', delay: 0, action: 'soundOff', text: '' }], notamProxy: '', notamRadius: 50, sound: true, volume: 0.3, volPct: 30, fai: false,
  // acoustic vario: lift tone from vLift m/s, sink alarm below vSink, pitch vF0 + vFk per m/s, beep speed, waveform, near-lift buzzer, sound damping
  vLift: 0.2, vSinkOn: true, vSink: -2.5, vF0: 520, vFk: 110, vRate: 1, vWave: 'square', vBuzz: false, vDamp: 0,
  // voice messages (speech synthesis)
  voice: false, voiceVol: 100, voiceRate: 1, voiceLang: 'auto', vcTherm: false, vcSum: true, vcTp: true, vcAir: true, vcAlt: 0, vcTow: true, vcTraffic: true, lands: [], landAir: true, gateN: 1, gateGap: 15, trWarn: true, trTone: true, trLvl: 2, trNear: 2000,
  towDetect: true, towMin: 1, corner: 'auto', wake: true, autoImport: true, openaipKey: '', airCountries: ['fi'], airUpd: '', airMaxAlt: 2895, callsign: 'Paraglider', radioAlt: 'ft', radioLang: 'en', radioTpl: '', warnBar: true, warnDist: 2000, customUrl: '',
  widgets: ['vario', 'avg', 'alt', 'agl', 'gs', 'ld', 'next', 'thermal', 'flight', 'utc'],
  hidden: []
};
const FRESH = !localStorage.getItem('bora.settings'); // first start on this device (no stored settings yet)
let S = Object.assign({}, DEF, JSON.parse(localStorage.getItem('bora.settings') || '{}'));
if (!S.airFl95Mig) { if (S.airMaxAlt === 3000) S.airMaxAlt = 2895; S.airFl95Mig = true; } // the default became FL95 (2895 m) on 2026-10-16
function save() { localStorage.setItem('bora.settings', JSON.stringify(S)); }
const fVario = (ms) => ms == null || isNaN(ms) ? '--' : (S.uVario === 'kt' ? (ms * 1.94384).toFixed(1) : S.uVario === 'fpm' ? Math.round(ms * 196.85 / 10) * 10 : ms.toFixed(1)).toString().replace(/^(?!-)/, ms >= 0 ? '+' : '');
const fAlt = (m) => m == null || isNaN(m) ? '--' : String(Math.round(S.uAlt === 'ft' ? m * 3.28084 : m));
const spdK = () => (S.uSpd === 'kt' ? 1.94384 : S.uSpd === 'm/s' ? 1 : 3.6); // m/s -> display unit
const fSpd = (ms) => ms == null || isNaN(ms) ? '--' : S.uSpd === 'm/s' ? (ms).toFixed(1) : String(Math.round(ms * spdK()));
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
  if (!st.takeoffT) { if (f.spd > sN('toSpd', 14.4) / 3.6) { st.toSince = st.toSince || f.t; if (f.t - st.toSince >= sN('toTime', 0) * 1000) { st.takeoffT = st.toSince; fireEvent('takeoff'); } } else st.toSince = 0; } // Flight modes → Takeoff
  if (st.takeoffT && !st.takeoffPos) { st.takeoffPos = [f.lat, f.lon, f.alt ?? altNow()]; autoStart(); }
  const lg = st.log[st.log.length - 1]; if (lg && f.t - lg.t < 15000 && lg.spd == null) { lg.spd = f.spd; lg.lat = f.lat; lg.lon = f.lon; }
  analyse(f);
  if (typeof recFix === 'function') recFix(f); // 12 flight recorder
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

