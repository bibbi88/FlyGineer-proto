'use strict';
/* ================= GPS coordinates =================
   Widget `coord`: your position (st.fix, else the device GPS st.gpsPos) as latitude over longitude, each on its own line, in cfg.fmt
   'dm' (62°48.123′N, default: aviation and radio), 'dms' (62°48′07″N), 'dd' (62.80205°) or 'utm' (WGS84 UTM: zone + band, easting, northing;
   in Finland the same numbers as ETRS-TM35FIN when the zone is 35). Sub line: GPS accuracy and altitude (cfg.sub). Default tap `coordinfo`:
   all formats with Copy buttons, Share and Google Maps. */
const COORD_FMT = [['dm', 'Degrees, decimal minutes'], ['dms', 'Degrees, minutes, seconds'], ['dd', 'Decimal degrees'], ['utm', 'UTM']];
function coordPos() { return st.fix || st.gpsPos || null; }
function coordDM(v, pos, neg, sec) {
  const h = v >= 0 ? pos : neg, a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60;
  if (!sec) { let mm = m.toFixed(3); let dd = d; if (+mm >= 60) { mm = '0.000'; dd++; } return `${dd}°${mm.padStart(6, '0')}′${h}`; }
  let mi = Math.floor(m), s = Math.round((m - mi) * 60), dd = d; if (s === 60) { s = 0; mi++; } if (mi === 60) { mi = 0; dd++; }
  return `${dd}°${String(mi).padStart(2, '0')}′${String(s).padStart(2, '0')}″${h}`;
}
// WGS84 → UTM (Krüger series, mm level), with the Norway / Svalbard zone exceptions
function toUTM(lat, lon) {
  let z = Math.floor((lon + 180) / 6) + 1;
  if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) z = 32;
  if (lat >= 72 && lat < 84) { if (lon >= 0 && lon < 9) z = 31; else if (lon >= 9 && lon < 21) z = 33; else if (lon >= 21 && lon < 33) z = 35; else if (lon >= 33 && lon < 42) z = 37; }
  const band = 'CDEFGHJKLMNPQRSTUVWXX'[Math.max(0, Math.min(20, Math.floor((lat + 80) / 8)))];
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, n = f / (2 - f), A = a / (1 + n) * (1 + n * n / 4 + n ** 4 / 64);
  const al = [n / 2 - 2 * n * n / 3 + 5 * n ** 3 / 16, 13 * n * n / 48 - 3 * n ** 3 / 5, 61 * n ** 3 / 240];
  const p = lat * D2R, l = (lon - (z * 6 - 183)) * D2R, e = 2 * Math.sqrt(n) / (1 + n);
  const t = Math.sinh(Math.atanh(Math.sin(p)) - e * Math.atanh(e * Math.sin(p))), xi = Math.atan2(t, Math.cos(l)), eta = Math.atanh(Math.sin(l) / Math.sqrt(1 + t * t));
  let E = eta, N = xi; for (let j = 1; j <= 3; j++) { E += al[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta); N += al[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta); }
  return { z, band, e: 500000 + k0 * A * E, n: (lat < 0 ? 10000000 : 0) + k0 * A * N };
}
function coordLines(f, fmt) {
  if (fmt === 'dd') return [Math.abs(f.lat).toFixed(5) + '°' + (f.lat >= 0 ? 'N' : 'S'), Math.abs(f.lon).toFixed(5) + '°' + (f.lon >= 0 ? 'E' : 'W')];
  if (fmt === 'utm') { const U = toUTM(f.lat, f.lon); return [U.z + U.band + ' E ' + Math.round(U.e), 'N ' + Math.round(U.n)]; }
  return [coordDM(f.lat, 'N', 'S', fmt === 'dms'), coordDM(f.lon, 'E', 'W', fmt === 'dms')];
}
function coordWData(W, box) {
  const C = effCfg(W), f = coordPos(), fmt = C.fmt || 'dm', lab = fmt === 'utm' ? 'UTM' : 'Position';
  if (!f) return { l: lab, v: '--', s: 'waiting for GPS' };
  const L2 = coordLines(f, fmt), acc = f.acc != null ? f.acc : st.gpsPos && st.gpsPos.acc, alt = f.alt != null ? f.alt : st.fix && st.fix.alt;
  const sub = C.sub === false ? '' : [acc != null && isFinite(acc) ? '±' + Math.round(acc) + ' m' : '', alt != null && isFinite(alt) ? 'GPS alt ' + fAlt(alt) + ' ' + (S.uAlt === 'ft' ? 'ft' : 'm') : '', st.replay || st.sim ? 'replay' : ''].filter(Boolean).join(' · ');
  const w = box ? box.w : 200, h = box ? box.h : 100, lh = Math.round(sN('wLab', 12) * 1.3), showT = C.showLabel !== false && S.titles !== 'hide';
  const avail = h - 10 - (showT && h >= 48 ? lh : 0) - (sub && h >= 70 ? lh : 0), len = Math.max(...L2.map((s) => s.length));
  const fs = Math.max(11, Math.min(avail / 2.3, (w - 14) / (len * 0.56)) * (C.size === 'auto' || !C.size ? 1 : +C.size));
  return { l: lab, html: `<div class="wv" style="flex-direction:column;align-items:flex-start;justify-content:center;line-height:1.08;font-size:${fs.toFixed(0)}px">${L2.map((s) => `<span>${esc(s)}</span>`).join('')}</div>` + (sub && h >= 70 ? `<div class="ws">${esc(sub)}</div>` : '') };
}
function coordAll(f) { return COORD_FMT.map(([k, n]) => [n, coordLines(f, k).join(k === 'utm' ? ' ' : ', ')]); }
function coordInfoHTML() {
  const f = coordPos(); if (!f) return '<div class="muted">Waiting for a GPS position.</div>';
  const age = f.t ? Math.round((Date.now() - f.t) / 1000) : null;
  return coordAll(f).map(([n, t], i) => `<div class="field"><span class="k">${esc(n)}</span><b class="num" style="font-size:22px">${esc(t)}</b><button class="btn" onclick="coordCopy(${i})">Copy</button></div>`).join('')
    + `<div class="muted">${f.acc != null ? 'Accuracy ±' + Math.round(f.acc) + ' m · ' : ''}${st.replay || st.sim ? 'replay / demo position' : age != null && age < 600 ? age + ' s old' : ''}</div>
    <div class="row" style="margin-top:8px"><button class="btn" onclick="sharePos()">Share my position</button><button class="btn" onclick="window.open('https://www.google.com/maps?q=${f.lat.toFixed(6)},${f.lon.toFixed(6)}','_blank')">Google Maps</button></div>`;
}
async function coordCopy(i) {
  const f = coordPos(); if (!f) return; const t = coordAll(f)[i][1];
  try { await navigator.clipboard.writeText(t); toast('Copied: ' + t); } catch (e) { prompt('Copy the position', t); }
}
