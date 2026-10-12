'use strict';
/* ================= airspace ================= */
const UNIT = { 0: 1, 1: 0.3048, 6: 30.48 };
function fmtLim(l) { if (!l) return '?'; if (l.gnd) return 'GND'; if (l.fl) return 'FL' + l.fl; return fAlt(l.m) + (S.uAlt === 'ft' ? ' ft' : ' m') + (l.agl ? ' AGL' : ''); }
async function loadOpenAIP() {
  const f = st.fix; if (!S.openaipKey) { toast('Add your OpenAIP API key in Settings first'); return; }
  if (!f) { toast('Waiting for a GPS position'); return; }
  try {
    const r = await fetch(`https://api.core.openaip.net/api/airspaces?pos=${f.lat},${f.lon}&dist=120000&limit=1000`, { headers: { 'x-openaip-api-key': S.openaipKey } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const lim = (x) => { if (!x) return null; const m = x.value * (UNIT[x.unit] ?? 1); return { m, agl: x.referenceDatum === 0, gnd: x.referenceDatum === 0 && x.value === 0, fl: x.unit === 6 ? x.value : null }; };
    st.airspaces = (j.items || []).filter((a) => a.geometry && a.geometry.type === 'Polygon').map((a) => ({
      name: a.name, cls: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'SUA', ''][a.icaoClass] ?? '', type: a.type,
      lo: lim(a.lowerLimit), hi: lim(a.upperLimit), poly: a.geometry.coordinates[0].map((c) => [c[1], c[0]]),
      freq: (a.frequencies || []).map((q) => ({ v: q.value, n: q.name || a.name }))
    }));
    localStorage.setItem('bora.air', JSON.stringify(st.airspaces)); drawAirspaces(); toast(st.airspaces.length + ' airspaces loaded from OpenAIP');
  } catch (e) { toast('OpenAIP: ' + e.message + ' · check the key'); }
}
function parseOpenAir(txt) {
  const out = []; let cur = null, ctr = null, dir = 1;
  const ll = (s) => { const m = s.trim().match(/(\d+):(\d+):?([\d.]*)\s*([NS])\s*(\d+):(\d+):?([\d.]*)\s*([EW])/i); if (!m) return null; const a = (+m[1] + m[2] / 60 + (+m[3] || 0) / 3600) * (/S/i.test(m[4]) ? -1 : 1); const o = (+m[5] + m[6] / 60 + (+m[7] || 0) / 3600) * (/W/i.test(m[8]) ? -1 : 1); return [a, o]; };
  const lim = (s) => { s = s.trim().toUpperCase(); if (/^(GND|SFC)/.test(s)) return { m: 0, gnd: true, agl: true }; const fl = s.match(/FL\s*(\d+)/); if (fl) return { m: +fl[1] * 30.48, fl: +fl[1] }; const n = parseFloat(s); if (isNaN(n)) return { m: 99999 }; const isM = /\dM\b|\sM\b|METER/.test(s); return { m: isM ? n : n * 0.3048, agl: /AGL|GND|SFC/.test(s) }; };
  const arc = (c, a1, a2, r, d) => { const pts = []; let s = a1, e = a2; if (d > 0 && e < s) e += 360; if (d < 0 && e > s) e -= 360; const n = Math.max(4, Math.ceil(Math.abs(e - s) / 5)); for (let i = 0; i <= n; i++) pts.push(dest(c[0], c[1], s + (e - s) * i / n, r)); return pts; };
  const push = () => { if (cur && cur.poly.length > 2) out.push(cur); };
  txt.split(/\r?\n/).forEach((raw) => {
    const l = raw.replace(/\*.*$/, '').trim(); if (!l) return; const k = l.slice(0, 2).toUpperCase(), v = l.slice(2).trim();
    if (k === 'AC') { push(); cur = { name: '', cls: v, lo: null, hi: null, poly: [], freq: [] }; dir = 1; }
    else if (!cur) return;
    else if (k === 'AN') cur.name = v; else if (k === 'AL') cur.lo = lim(v); else if (k === 'AH') cur.hi = lim(v);
    else if (k === 'AF') cur.freq.push({ v: v, n: cur.name });
    else if (k === 'DP') { const p = ll(v); if (p) cur.poly.push(p); }
    else if (k === 'V ' || k === 'V') { const m = v.match(/X\s*=\s*(.*)/i); if (m) ctr = ll(m[1]); const d = v.match(/D\s*=\s*([+-])/i); if (d) dir = d[1] === '-' ? -1 : 1; }
    else if (k === 'DC' && ctr) { const r = parseFloat(v) * 1852; for (let a = 0; a < 360; a += 6) cur.poly.push(dest(ctr[0], ctr[1], a, r)); }
    else if (k === 'DB' && ctr) { const [p1, p2] = v.split(',').map(ll); if (p1 && p2) cur.poly.push(...arc(ctr, brg(ctr[0], ctr[1], p1[0], p1[1]), brg(ctr[0], ctr[1], p2[0], p2[1]), dist(ctr[0], ctr[1], p1[0], p1[1]), dir)); }
    else if (k === 'DA' && ctr) { const [r, a1, a2] = v.split(',').map(parseFloat); cur.poly.push(...arc(ctr, a1, a2, r * 1852, dir)); }
  });
  push(); return out;
}
function airColor(a) { return /^(R|P|Q|D)$/.test(a.cls) || /restrict|danger|prohib/i.test(a.name) ? css('--restr') : css('--air'); }
function drawAirspaces() { st.airVer = (st.airVer || 0) + 1; }
function inPoly(lat, lon, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [yi, xi] = poly[i], [yj, xj] = poly[j]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c; } return c; }
function edgeDist(lat, lon, poly) { let best = 1e12; for (let i = 0; i < poly.length - 1; i += Math.max(1, Math.floor(poly.length / 200))) { const [x1, y1] = enu(lat, lon, poly[i][0], poly[i][1]); const [x2, y2] = enu(lat, lon, poly[i + 1][0], poly[i + 1][1]); const dx = x2 - x1, dy = y2 - y1; const t = clamp(-(x1 * dx + y1 * dy) / (dx * dx + dy * dy || 1), 0, 1); best = Math.min(best, Math.hypot(x1 + t * dx, y1 + t * dy)); } return best; }
function limM(l, ground) { if (!l) return 0; return l.agl ? (l.gnd ? (ground || 0) : l.m + (ground || 0)) : l.m; }
function airStatus() {
  const f = st.fix, alt = altNow(); if (!f || alt == null) return [];
  const g = st.groundElev || 0;
  return st.airspaces.map((a) => {
    const inside = inPoly(f.lat, f.lon, a.poly), d = inside ? 0 : edgeDist(f.lat, f.lon, a.poly);
    const lo = limM(a.lo, g), hi = limM(a.hi, g); const vert = alt < lo ? 'below' : alt > hi ? 'above' : 'in';
    return { a, inside, d, lo, hi, vert, alt };
  }).filter((x) => x.d < 30000).sort((x, y) => (y.inside && y.vert === 'in') - (x.inside && x.vert === 'in') || x.d - y.d);
}

/* ================= places (OpenStreetMap / Overpass) ================= */
async function loadPlaces(force) {
  const f = st.fix; if (!f) return;
  if (!force && Date.now() - (st.placesErrAt || 0) < 60000) return;
  if (!force && st.placesAt && dist(st.placesAt[0], st.placesAt[1], f.lat, f.lon) < 3000 && st.placesR === S.poiRadius) return;
  st.placesAt = [f.lat, f.lon]; st.placesR = S.poiRadius;
  const R = S.poiRadius * 1000, a = `(around:${R},${f.lat.toFixed(4)},${f.lon.toFixed(4)})`;
  const q = `[out:json][timeout:25];(node["place"~"^(city|town|village)$"]${a};node["aeroway"="aerodrome"]${a};way["aeroway"="aerodrome"]${a};node["natural"="peak"]${a};);out center 300;`;
  st.placesState = 'loading'; markDirty();
  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    st.places = j.elements.map((e) => { const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon; const t = e.tags || {}; const kind = t.aeroway ? 'airport' : t.natural === 'peak' ? 'peak' : 'town'; return { name: t.name || t.icao || (kind === 'peak' ? 'Peak' : 'Unnamed'), kind, sub: t.place || (t.icao ? t.icao : t.ele ? t.ele + ' m' : ''), lat, lon, rank: t.place === 'city' ? 3 : t.place === 'town' ? 2 : 1 }; }).filter((p) => p.lat != null && (p.kind !== 'peak' || p.name !== 'Peak'));
    st.placesState = 'ok'; renderPlaces();
  } catch (e) { st.placesState = 'error: ' + e.message; st.placesErrAt = Date.now(); markDirty(); st.placesAt = null; }
}

/* ================= FAI triangle assistant (S.fai) =================
   Start = the Start point (takeoff); 1st turnpoint = the point of the flight farthest from the start. The 3rd point must lie in
   one of two sectors (left / right of that leg) so that every leg is at least 28 % of the whole triangle (FAI rule). */
const FAI_MIN = 0.28;
function faiLocal(A) { const k = Math.cos(A.lat * D2R); return { xy: (p) => [(p.lon - A.lon) * D2R * RE * k, (p.lat - A.lat) * D2R * RE], ll: (x, y) => [A.lat + y / RE * R2D, A.lon + x / (RE * k) * R2D] }; }
function faiState() {
  if (!S.fai) return null;
  const lg = st.log, sp = startPlace(); let A = sp ? { lat: sp.lat, lon: sp.lon } : null;
  if (!A) { const p0 = lg.find((p) => p.lat != null); if (!p0) return null; A = { lat: p0.lat, lon: p0.lon }; }
  // farthest point from the start, scanned once per new log entry (by time: the log is trimmed at the front on long flights)
  const ak = A.lat.toFixed(5) + ',' + A.lon.toFixed(5); let sc = st.faiScan;
  if (!sc || sc.ak !== ak || (lg.length && lg[lg.length - 1].t < sc.t)) sc = st.faiScan = { ak, t: -Infinity, B: null, d: 0 };
  for (let i = lg.length - 1; i >= 0 && lg[i].t > sc.t; i--) { const p = lg[i]; if (p.lat == null) continue; const d = dist(A.lat, A.lon, p.lat, p.lon); if (d > sc.d) { sc.d = d; sc.B = { lat: p.lat, lon: p.lon }; } }
  if (lg.length) sc.t = lg[lg.length - 1].t;
  return { A, B: sc.B, c: sc.d };
}
// the two sectors as lat/lon rings: walk "leg from start = 28 %", then the largest triangle, then "leg from turnpoint = 28 %"
function faiSectors(A, B) {
  const P = faiLocal(A), [bx, by] = P.xy(B), c = Math.hypot(bx, by); if (c < 500) return [];
  const ux = bx / c, uy = by / c, m = FAI_MIN, mx = 1 - 2 * m, Pmin = c / mx, Pmax = c / m, N = 32;
  const pt = (b, a, sd) => { const ca = clamp((b * b + c * c - a * a) / (2 * b * c), -1, 1), sa = Math.sqrt(1 - ca * ca) * sd; return P.ll(b * (ux * ca - uy * sa), b * (uy * ca + ux * sa)); };
  return [1, -1].map((sd) => { const r = [];
    for (let i = 0; i <= N; i++) { const q = Pmin + (Pmax - Pmin) * i / N; r.push(pt(m * q, q - c - m * q, sd)); }
    for (let i = 1; i < N; i++) { const b = Pmax * (m + (mx - m) * i / N); r.push(pt(b, Pmax - c - b, sd)); }
    for (let i = N; i >= 0; i--) { const q = Pmin + (Pmax - Pmin) * i / N, a = m * q; r.push(pt(q - c - a, a, sd)); }
    return { ring: r, tip: pt(m * Pmin, m * Pmin, sd), Pmin }; });
}
// the calculator: the triangle start → turnpoint → you (closing back to the start)
function faiCalc() {
  const s = faiState(), f = st.fix; if (!s) return null; if (!s.B || !f || s.c < 500) return Object.assign({ ready: false }, s);
  const a = dist(s.B.lat, s.B.lon, f.lat, f.lon), b = dist(s.A.lat, s.A.lon, f.lat, f.lon), P = a + b + s.c, mn = Math.min(a, b, s.c) / P, ok = mn >= FAI_MIN;
  let toSec = 0;
  if (!ok) { const L0 = faiLocal(s.A), [fx, fy] = L0.xy(f); toSec = Infinity;
    faiSectors(s.A, s.B).forEach(({ ring }) => { const q = ring.map((ll) => L0.xy({ lat: ll[0], lon: ll[1] }));
      for (let i = 0; i < q.length; i++) { const [x1, y1] = q[i], [x2, y2] = q[(i + 1) % q.length], dx = x2 - x1, dy = y2 - y1, t = clamp(((fx - x1) * dx + (fy - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1); toSec = Math.min(toSec, Math.hypot(fx - x1 - t * dx, fy - y1 - t * dy)); } }); }
  return Object.assign({ ready: true, a, b, P, mn, ok, toSec }, s);
}
function faiDrawInto(g, s) {
  const col = '#16A34A';
  L.polyline([[s.A.lat, s.A.lon], [s.B.lat, s.B.lon]], { color: col, weight: 3, interactive: false }).addTo(g);
  faiSectors(s.A, s.B).forEach(({ ring, tip, Pmin }) => {
    L.polygon(ring, { color: col, weight: 2, fillColor: col, fillOpacity: 0.14, interactive: false }).addTo(g);
    L.marker(tip, { icon: L.divIcon({ className: 'wpLabel', html: `FAI ≥ ${(Pmin / 1000).toFixed(1)} km`, iconSize: [110, 18], iconAnchor: [55, -4] }), interactive: false }).addTo(g); });
}

/* ================= task / FlyXC ================= */
function decodePolyline(s) { let i = 0, lat = 0, lng = 0; const out = []; while (i < s.length) { for (const k of [0, 1]) { let b, sh = 0, r = 0; do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32 && i <= s.length); const d = r & 1 ? ~(r >> 1) : r >> 1; if (k === 0) lat += d; else lng += d; } out.push([lat / 1e5, lng / 1e5]); } return out; }
function encodePolyline(pts) { let out = '', pl = 0, po = 0; const enc = (v) => { v = v < 0 ? ~(v << 1) : v << 1; let r = ''; while (v >= 0x20) { r += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return r + String.fromCharCode(v + 63); };
  pts.forEach(([a, o]) => { const la = Math.round(a * 1e5), lo = Math.round(o * 1e5); out += enc(la - pl) + enc(lo - po); pl = la; po = lo; }); return out; }
// FlyXC opens its planner when the link carries a route (p=): the current task, or a short starter line at your position
const taskLink = () => (st.task && st.task.pts.length > 1 ? 'https://flyxc.app/?p=' + encodeURIComponent(encodePolyline(st.task.pts.map((q) => [q.lat, q.lon]))) : null);
function flyxcUrl() {
  const t = taskLink(); if (t) return t;
  const f = st.fix || startPlace() || { lat: 63.1, lon: 21.6 }, k = f.lat.toFixed(2) + ',' + f.lon.toFixed(2);
  if (!st.fxStart || st.fxStart.k !== k) st.fxStart = { k, url: 'https://flyxc.app/?p=' + encodeURIComponent(encodePolyline([dest(f.lat, f.lon, 270, 3000), dest(f.lat, f.lon, 90, 3000)])) };
  return st.fxStart.url;
}
async function copyTask() {
  const t = taskLink(); if (!t) { toast('No task loaded to copy'); return; }
  try { await navigator.clipboard.writeText(t); toast(`Task copied as a FlyXC link · ${st.task.pts.length} points · ${(st.task.len / 1000).toFixed(1)} km`); }
  catch (e) { prompt('Copy the task link', t); }
}
function importFlyXC(text, silent) {
  const m = String(text || '').match(/https?:\/\/(?:www\.)?flyxc\.app\/?\S*/i); if (!m) { if (!silent) toast('No flyxc.app link found'); return false; }
  let p; try { p = new URL(m[0]).searchParams.get('p'); } catch (e) { p = null; }
  if (!p) { if (!silent) toast('The link has no route. Draw a route in FlyXC, then copy the link'); return false; }
  if (silent && p === localStorage.getItem('bora.lastRoute')) return false;
  const pts = decodePolyline(p); if (pts.length < 2) { if (!silent) toast('Route has fewer than 2 points'); return false; }
  let len = 0; for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  const d = new Date();
  st.task = { name: 'FlyXC ' + d.getDate() + '.' + (d.getMonth() + 1), len, pts: pts.map((q, i) => ({ lat: q[0], lon: q[1], name: i === 0 ? 'Start' : i === pts.length - 1 ? 'Goal' : 'TP' + i })) };
  const done = taskResume();
  localStorage.setItem('bora.task', JSON.stringify(st.task)); localStorage.setItem('bora.lastRoute', p);
  drawTask();
  toast(`Route imported from FlyXC · ${pts.length} points · ${(len / 1000).toFixed(1)} km${resumeNote(done)}`, [['Show on map', () => showPage('pMap')], ['Undo', () => { clearTask(); }]]);
  return true;
}
// a new or changed task during a flight: replay the flight track through its turnpoints in order, so turnpoints already flown
// through (track inside the cylinder) count as reached and you carry on from the right one. Returns how many were reached.
function taskResume() {
  st.wpHit = st.goalT = null; st.wpSkip = new Set(); const T = st.task; if (!T) { st.nextWp = 0; return 0; }
  const n = T.pts.length, R = S.cylR || 400; let i = n > 1 ? 1 : 0;
  if (st.takeoffT && n > 1) for (const p of st.log) { if (p.lat == null) continue; const w = T.pts[i]; if (dist(p.lat, p.lon, w.lat, w.lon) < R) { if (i < n - 1) i++; else { st.goalT = p.t; break; } } }
  st.nextWp = i; return i - 1 + (st.goalT ? 1 : 0);
}
const resumeNote = (k) => (k > 0 ? ` · ${k} already reached` : '');
// jump to turnpoint i (skip ahead, or go back); turnpoints jumped over are marked as skipped
function goWp(i) {
  const T = st.task; if (!T) return; const n = T.pts.length; i = clamp(i, n > 1 ? 1 : 0, n - 1); if (!st.wpSkip) st.wpSkip = new Set();
  if (i > st.nextWp) for (let k = st.nextWp; k < i; k++) st.wpSkip.add(k); else for (let k = i; k < n; k++) st.wpSkip.delete(k);
  st.nextWp = i; st.goalT = st.wpHit = null; drawTask(); renderWidgets(); toast('Next turnpoint: ' + T.pts[i].name);
}
function clearTask() { st.task = null; st.wpHit = st.goalT = null; localStorage.removeItem('bora.task'); drawTask(); toast('Task removed'); }
async function tryClipboardImport() { if (!S.autoImport || !navigator.clipboard?.readText) return; try { const t = await navigator.clipboard.readText(); if (/flyxc\.app/i.test(t)) importFlyXC(t, true); } catch (e) { /* permission denied */ } }

/* ================= NOTAM (sample) ================= */
let NOTAMS = []; let ntShowAll = false; st.notamAt = 0;
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
function ntTime(s) { const m = /(\d{2})([A-Z]{3})(\d{2})\s+(\d{2})(\d{2})/.exec(s || ''); return m ? Date.UTC(2000 + +m[3], MON[m[2]], +m[1], +m[4], +m[5]) : null; }
function dms(v, degLen) { const n = v.split('.')[0]; const deg = +n.slice(0, degLen), min = +n.slice(degLen, degLen + 2), sec = n.length > degLen + 2 ? +(n.slice(degLen + 2) + (v.includes('.') ? '.' + v.split('.')[1] : '')) : 0; return deg + min / 60 + sec / 3600; }
function ntGeo(txt) {
  const cs = [...txt.matchAll(/(\d{4,6}(?:\.\d+)?)\s?N\s?(\d{5,7}(?:\.\d+)?)\s?E/g)].map((m) => [dms(m[1], 2), dms(m[2], 3)]);
  if (!cs.length) return null;
  const r = /RADIUS\s*([\d.]+)\s*(NM|KM|M)\b/.exec(txt); const rad = r ? +r[1] * (r[2] === 'NM' ? 1852 : r[2] === 'KM' ? 1000 : 1) : 0;
  if (cs.length >= 3 && / - /.test(txt)) return { poly: cs };
  return { pt: cs[0], r: rad };
}
function parseBulletin(html) {
  const text = html.replace(/\r/g, '').replace(/<br\s*\/?>/gi, '\n').replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n@@SEC $1\n').replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n@@AD $1\n')
    .replace(/<\/(tr|table|p|div|li)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ');
  const out = []; let sec = '', ad = ''; const re = /\(([A-Z]\d{4}\/\d{2})\)/g; let last = 0, m;
  while ((m = re.exec(text))) {
    let chunk = text.slice(last, m.index); last = re.lastIndex;
    const sch = /^\s*SCHEDULE:\s*([^\n@]+)/.exec(text.slice(last)); 
    chunk.split('\n').forEach((l) => { const t = l.trim(); if (t.startsWith('@@SEC')) { sec = t.slice(5).trim(); ad = ''; } if (t.startsWith('@@AD')) ad = t.slice(4).trim(); });
    chunk = chunk.replace(/^[\s\S]*@@(SEC|AD)[^\n]*\n/, '').replace(/^\s*SCHEDULE:[^\n]*\n/, '').replace(/^\s*(NIL\s*)+/g, '').trim();
    const body = chunk.replace(/^[+\-*|\s]+/, '');
    const fr = /FROM:\s*([0-9]{2}[A-Z]{3}[0-9]{2}\s+\d{4})\s*TO:\s*([^\n(]+)/.exec(body);
    const lo = /LOWER:\s*([^\n]+?)\s+UPPER:\s*([^\n]+)/.exec(body);
    const e = body.split(/\s*(LOWER:|FROM:)/)[0].replace(/\s*\|\s*/g, ' ').trim();
    if (!fr) continue;
    const toTxt = fr[2].trim();
    out.push({ id: m[1], sec, ad, text: e, from: ntTime(fr[1]), fromTxt: fr[1], to: /PERM/.test(toTxt) ? null : ntTime(toTxt), toTxt, lower: lo ? lo[1].trim() : '', upper: lo ? lo[2].trim().split(/\s{2,}|FROM/)[0] : '', sched: sch ? sch[1].trim() : '', geo: ntGeo(e), codes: [...e.matchAll(/\b(EF[RDP]\d+[A-Z]?)\b/g)].map((x) => x[1]) });
  }
  return out;
}
async function loadNotams(force) {
  if (!force && Date.now() - st.notamAt < 30 * 60000 && NOTAMS.length) return;
  st.ntLoading = true; st.ntMsg = ''; markDirty();
  const urls = ['https://www.ais.fi/bulletins/envfra.htm', 'https://www.ais.fi/bulletins/envfrm.htm'];
  try {
    const all = []; const seen = new Set();
    for (const u of urls) {
      const r = await fetch(S.notamProxy ? S.notamProxy + encodeURIComponent(u) : u);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      parseBulletin(await r.text()).forEach((n) => { if (!seen.has(n.id)) { seen.add(n.id); all.push(n); } });
    }
    NOTAMS = all; st.notamAt = Date.now(); localStorage.setItem('bora.notams', JSON.stringify({ at: st.notamAt, list: all }));
    drawNotamAreas(); renderNotams(); toast(all.length + ' NOTAMs loaded from ais.fi');
  } catch (e) {
    const cached = JSON.parse(localStorage.getItem('bora.notams') || 'null');
    if (cached) { NOTAMS = cached.list; st.notamAt = cached.at; drawNotamAreas(); }
    renderNotams(S.notamProxy ? 'Could not load NOTAMs (' + e.message + '). Check the proxy address in Settings.' : 'The browser blocked loading ais.fi directly. Add a NOTAM proxy address in Settings → Airspace data, or open the bulletin on the Web page.');
  }
}
function ntWhere(n) {
  const f = st.fix; if (!f) return null;
  if (n.geo?.pt) return Math.max(0, dist(f.lat, f.lon, n.geo.pt[0], n.geo.pt[1]) - n.geo.r);
  if (n.geo?.poly) return inPoly(f.lat, f.lon, n.geo.poly) ? 0 : edgeDist(f.lat, f.lon, n.geo.poly.concat([n.geo.poly[0]]));
  const a = st.airspaces.find((x) => n.codes.some((c) => x.name.replace(/\s/g, '').toUpperCase().includes(c)));
  if (a) return inPoly(f.lat, f.lon, a.poly) ? 0 : edgeDist(f.lat, f.lon, a.poly);
  return null;
}
function ntState(n) { const now = Date.now(); if (n.from && now < n.from) return 'later'; if (n.to && now > n.to) return 'over'; return 'active'; }
function fmtZ(t) { if (!t) return 'PERM'; const d = new Date(t); return d.getUTCDate() + ' ' + Object.keys(MON)[d.getUTCMonth()].toLowerCase() + ' ' + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + 'Z'; }
let ntView = [];

/* ================= forecast (Open-Meteo) ================= */
async function loadForecast() {
  const f = st.fix; if (!f) { toast('Waiting for a GPS position'); return; }
  const lv = [1000, 925, 850, 800, 700, 600];
  const vars = ['temperature_2m', 'dew_point_2m'].concat(lv.flatMap((p) => [`temperature_${p}hPa`, `geopotential_height_${p}hPa`]));
  st.fcLoading = true; markDirty();
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${f.lat.toFixed(3)}&longitude=${f.lon.toFixed(3)}&hourly=${vars.join(',')}&forecast_days=1&timezone=auto`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(); const h = j.hourly; const now = new Date(); let idx = h.time.findIndex((t) => new Date(t) > now) - 1; if (idx < 0) idx = 0;
    const elev = j.elevation;
    st.forecast = { t: h.time[idx], elev, T: h.temperature_2m[idx], Td: h.dew_point_2m[idx], prof: lv.map((p) => ({ alt: h[`geopotential_height_${p}hPa`][idx], temp: h[`temperature_${p}hPa`][idx] })).filter((x) => x.alt > elev - 50).sort((a, b) => a.alt - b.alt) };
    st.forecast.prof.unshift({ alt: elev + 2, temp: st.forecast.T });
    st.fcLoading = false; markDirty();
  } catch (e) { st.fcLoading = false; markDirty(); toast('Forecast: ' + e.message); }
}
function thermalTop() {
  const fc = st.forecast; if (!fc) return null; const trig = +(S.trig ?? 2);
  const T0 = fc.T + trig, a0 = fc.elev; const parcel = (alt) => T0 - 0.0098 * (alt - a0);
  const prof = fc.prof; const envAt = (alt) => { for (let i = 1; i < prof.length; i++) if (alt <= prof[i].alt) { const p = prof[i - 1], q = prof[i]; return p.temp + (q.temp - p.temp) * (alt - p.alt) / (q.alt - p.alt); } return prof[prof.length - 1].temp; };
  for (let alt = a0 + 50; alt < (prof[prof.length - 1]?.alt || a0 + 4000); alt += 25) if (parcel(alt) <= envAt(alt)) return alt;
  return null;
}

