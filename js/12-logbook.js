'use strict';
/* ================= flight recorder (IGC) and logbook =================
   Records real flights only (no demo, replay or test flight): starts at takeoff (st.takeoffT, plus the 30 s before it), one B record per second,
   ends after 60 s standing still on the ground (ground speed < 1.5 m/s, height steady within 3 m, below 60 m AGL when the ground is known) or by hand.
   The flight in progress is saved to IndexedDB every 30 s and when the app goes to the background; after a reload within 10 min it carries on.
   Files are unsigned IGC: fine for your own records and replays, XContest gives no points for them. */
const REC = { cur: null, list: [], wait: false, still: 0, saved: 0, moving: 0 };
let logDB = null;
function logOpen() {
  if (logDB) return Promise.resolve(logDB);
  return new Promise((ok, no) => { const q = indexedDB.open('bora-log', 1); q.onupgradeneeded = () => q.result.createObjectStore('flights', { keyPath: 'id' }); q.onsuccess = () => { logDB = q.result; ok(logDB); }; q.onerror = () => no(q.error); });
}
async function logTx(mode, fn) { const db = await logOpen(); return new Promise((ok, no) => { const tx = db.transaction('flights', mode), s = tx.objectStore('flights'), r = fn(s); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => no(tx.error); }); }
const logPut = (F) => logTx('readwrite', (s) => s.put(F)), logDel = (id) => logTx('readwrite', (s) => s.delete(id)), logGet = (id) => logTx('readonly', (s) => s.get(id));
const logAll = () => logTx('readonly', (s) => s.getAll());
const recOn = () => S.igcRec !== false;
const flightMeta = (F) => ({ id: F.id, t0: F.t0, t1: F.t1, n: F.pts.length, open: F.open, stats: F.stats, name: F.name });
// pressure altitude for the IGC file: standard atmosphere (1013.25 hPa), not your QNH
function stdAlt() { const B = st.baroLog, b = B && B[B.length - 1]; return b && b.pa && Date.now() - b.t < 3000 ? 44330.8 * (1 - Math.pow(b.pa / 101325, 0.190263)) : null; }
function recFix(f) {
  if (!recOn() || st.replay || st.sim || f.sim) return;
  const R = REC.cur;
  if (!R) {
    // after a landing, a new flight starts once you move at takeoff speed for 10 s again
    if (REC.wait) { if (f.spd > sN('toSpd', 14.4) / 3.6) { REC.moving = REC.moving || f.t; if (f.t - REC.moving > 10000) { REC.wait = false; recStart(REC.moving - 30000); } } else REC.moving = 0; return; }
    if (st.takeoffT) recStart(st.takeoffT - 30000);
    return;
  }
  const last = R.pts[R.pts.length - 1];
  if (!last || f.t - last[0] >= 1000) R.pts.push([f.t, +f.lat.toFixed(6), +f.lon.toFixed(6), f.alt != null ? Math.round(f.alt) : null, (() => { const p = stdAlt(); return p != null ? Math.round(p) : null; })()]);
  // landed?
  const a = altNow(), old = R.pts.find((p) => p[0] >= f.t - 20000), agl = st.groundElev != null && a != null ? a - st.groundElev : null;
  const still = f.spd != null && f.spd < 1.5 && old && a != null && Math.abs((old[4] ?? old[3] ?? a) - (R.pts[R.pts.length - 1][4] ?? R.pts[R.pts.length - 1][3] ?? a)) < 3 && (agl == null || agl < 60);
  REC.still = still ? REC.still || f.t : 0;
  if (REC.still && f.t - REC.still > 60000 && f.t - R.t0 > 120000) { recStop('landed'); return; }
  if (Date.now() - REC.saved > 30000) recSave();
}
function recStart(from) {
  const pts = st.fixes.filter((x) => x.t >= from && !x.sim).map((x) => [x.t, +x.lat.toFixed(6), +x.lon.toFixed(6), x.alt != null ? Math.round(x.alt) : null, null]);
  const t0 = pts.length ? pts[0][0] : Date.now();
  REC.cur = { id: 'f' + t0, t0, t1: t0, pts, open: true, pilot: S.pilot || '', glider: S.gliderName || '', ver: (typeof app !== 'undefined' && app.version) || '' };
  REC.still = 0; recSave(); toast('Recording the flight (IGC)'); markDirty();
}
async function recSave() {
  const R = REC.cur; if (!R) return; REC.saved = Date.now(); R.t1 = R.pts.length ? R.pts[R.pts.length - 1][0] : R.t0; R.stats = flightStats(R.pts);
  try { await logPut(R); logListSet(flightMeta(R)); } catch (e) { if (!REC.saveErr) toast('Could not save the flight: ' + (e.message || e)); REC.saveErr = true; }
}
async function recStop(why) {
  const R = REC.cur; if (!R) return; R.open = false; await recSave(); REC.cur = null; REC.wait = true; REC.moving = 0;
  const s = R.stats || {}; toast((why === 'landed' ? 'Landed · ' : 'Flight saved · ') + fDur(s.dur) + ' · ' + fDist(s.far || 0) + ' from start', [['Logbook', () => openSettings('flights')]]);
  if (typeof renderSettings === 'function' && curPage === 'pSet') renderSettings(); markDirty();
}
function logListSet(m) { const i = REC.list.findIndex((x) => x.id === m.id); if (i >= 0) REC.list[i] = m; else REC.list.unshift(m); REC.list.sort((a, b) => b.t0 - a.t0); }
const fDur = (s) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0'); };
function flightStats(P) {
  if (!P.length) return { dur: 0 };
  const A = (p) => p[4] ?? p[3]; let len = 0, far = 0, maxA = -1e9, minA = 1e9, climb = 0;
  for (let i = 0; i < P.length; i++) { const p = P[i]; if (i) len += dist(P[i - 1][1], P[i - 1][2], p[1], p[2]); far = Math.max(far, dist(P[0][1], P[0][2], p[1], p[2])); const a = A(p); if (a != null) { maxA = Math.max(maxA, a); minA = Math.min(minA, a); }
    const j = i - 20; if (j >= 0 && A(p) != null && A(P[j]) != null && p[0] - P[j][0] > 0) climb = Math.max(climb, (A(p) - A(P[j])) / ((p[0] - P[j][0]) / 1000)); }
  const l = P[P.length - 1];
  return { dur: (l[0] - P[0][0]) / 1000, len, far, line: dist(P[0][1], P[0][2], l[1], l[2]), maxA: maxA > -1e9 ? maxA : null, gain: maxA > -1e9 ? maxA - A(P[0]) : null, climb };
}
// IGC text from the stored points (times in UTC)
function igcText(F) {
  const d = new Date(F.t0), z = (n, w) => String(Math.abs(Math.round(n))).padStart(w, '0'), dd = z(d.getUTCDate(), 2) + z(d.getUTCMonth() + 1, 2) + z(d.getUTCFullYear() % 100, 2);
  const ll = (v, w, pos, neg) => { const a = Math.abs(v), deg = Math.floor(a), m = Math.round((a - deg) * 60000); return z(deg + (m >= 60000 ? 1 : 0), w) + z(m >= 60000 ? 0 : m, 5) + (v >= 0 ? pos : neg); };
  const al = (v) => v == null ? '00000' : v < 0 ? '-' + z(v, 4) : z(v, 5);
  const L = ['AXFGFlyGineer', 'HFDTEDATE:' + dd + ',01', 'HFPLTPILOTINCHARGE:' + (F.pilot || ''), 'HFGTYGLIDERTYPE:' + (F.glider || ''), 'HFGIDGLIDERID:', 'HFDTMGPSDATUM:WGS84', 'HFRFWFIRMWAREVERSION:' + (F.ver || ''), 'HFFTYFRTYPE:FlyGineer browser app (unsigned)', 'HFGPSRECEIVER:device GPS', 'HFPRSPRESSALTSENSOR:' + (F.pts.some((p) => p[4] != null) ? 'Bora vario' : 'none'), 'HFALGALTGPS:GEO', 'HFALPALTPRESSURE:ISA'];
  F.pts.forEach((p) => { const t = new Date(p[0]); L.push('B' + z(t.getUTCHours(), 2) + z(t.getUTCMinutes(), 2) + z(t.getUTCSeconds(), 2) + ll(p[1], 2, 'N', 'S') + ll(p[2], 3, 'E', 'W') + (p[3] != null ? 'A' : 'V') + al(p[4]) + al(p[3])); });
  return L.join('\r\n') + '\r\n';
}
const igcName = (F) => { const d = new Date(F.t0); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '-FlyGineer-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '.igc'; };
async function logDownload(id) {
  const F = REC.cur && REC.cur.id === id ? REC.cur : await logGet(id); if (!F) return;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([igcText(F)], { type: 'application/octet-stream' })); a.download = igcName(F); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
async function logReplay(id) { const F = await logGet(id); if (!F) return; try { startReplay(parseIGC(igcText(F)), flightTitle(F)); showPage('pMap'); } catch (e) { toast('Could not replay: ' + e.message); } }
async function logRemove(id) {
  const F = await logGet(id); if (!F) return; await logDel(id); REC.list = REC.list.filter((x) => x.id !== id); renderSettings();
  toast('Flight deleted', [['Undo', async () => { await logPut(F); logListSet(flightMeta(F)); renderSettings(); }]]);
}
const flightTitle = (F) => { const d = new Date(F.t0); return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
// on start: the list (without points), and a flight that was still open: carry on if it was recording within 10 min, else close it
async function logBoot() {
  if (!window.indexedDB) return;
  try {
    const all = await logAll(); REC.list = all.map(flightMeta).sort((a, b) => b.t0 - a.t0);
    const open = all.filter((F) => F.open);
    for (const F of open) { if (!REC.cur && Date.now() - F.t1 < 600000 && recOn()) { REC.cur = F; toast('Carrying on recording the flight'); } else { F.open = false; F.stats = flightStats(F.pts); await logPut(F); logListSet(flightMeta(F)); } }
  } catch (e) { REC.err = e.message || String(e); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden && REC.cur) recSave(); });
setTimeout(logBoot, 500);

/* Settings → Flights & logbook */
function flightsSecHTML() {
  const R = REC.cur, s = R && R.stats;
  let h = `<div class="card sec"><h2>Flight recorder</h2>
    <div class="field"><span class="k">Record flights (IGC)</span><span class="row"><button class="pill" data-set="igcRec" data-val="true" aria-pressed="${recOn()}">On</button><button class="pill" data-set="igcRec" data-val="false" aria-pressed="${!recOn()}">Off</button></span></div>
    <div class="muted">Starts by itself at takeoff and stops 60 s after landing; saved every 30 s, so a crash or a flat battery loses at most half a minute. Demo, replays and the test flight are never recorded. The files are unsigned: good for your own records, XContest gives no points for them.</div>
    <div class="field"><span class="k">Now</span><b>${R ? `● Recording since ${new Date(R.t0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${fDur(s ? s.dur : 0)} · ${R.pts.length} points` : st.replay || st.sim ? 'Not recording (demo / replay)' : recOn() ? (REC.wait ? 'Landed · waiting for the next takeoff' : 'Waiting for takeoff') : 'Off'}</b></div>
    <div class="field"><span class="k"></span>${R ? '<button class="btn warn" id="recEnd">End flight now</button>' : `<button class="btn" id="recGo" ${st.replay || st.sim || !st.fix ? 'disabled' : ''}>Start recording now</button>`}</div>
    <div class="field"><label for="pilotName">Pilot (in the file)</label><input type="text" id="pilotName" maxlength="40" value="${esc(S.pilot || '')}" placeholder="Your name"></div>
    <div class="field"><label for="gliderName">Glider (in the file)</label><input type="text" id="gliderName" maxlength="40" value="${esc(S.gliderName || '')}" placeholder="e.g. Ozone Rush 6"></div></div>`;
  h += `<div class="card sec"><h2>Logbook</h2>${REC.err ? '<div class="muted">Storage not available: ' + esc(REC.err) + '</div>' : ''}`;
  if (!REC.list.length) h += '<div class="muted">No flights recorded yet.</div>';
  else { const tot = REC.list.reduce((a, F) => a + ((F.stats && F.stats.dur) || 0), 0); h += `<div class="muted">${REC.list.length} flights · ${fDur(tot)} in the air</div>`; }
  REC.list.forEach((F) => { const x = F.stats || {};
    h += `<div class="li" style="flex-wrap:wrap;gap:8px;min-height:56px"><div style="flex:1;min-width:220px"><b>${esc(flightTitle(F))}</b>${F.open ? ' <span style="color:var(--restr)">● recording</span>' : ''}<div class="muted" style="margin:0">${fDur(x.dur)} · farthest ${fDist(x.far || 0)} · track ${fDist(x.len || 0)} · max ${x.maxA != null ? fAlt(x.maxA) + ' ' + S.uAlt : '--'} · best climb ${x.climb ? x.climb.toFixed(1) : '--'} m/s</div></div>
      <span class="row"><button class="btn" data-lgplay="${F.id}" ${F.open ? 'disabled' : ''}>▶ Replay</button><button class="btn" data-lgdl="${F.id}">⬇ IGC</button><button class="btn warn" data-lgdel="${F.id}" ${F.open ? 'disabled' : ''}>✕</button></span></div>`; });
  return h + '</div>';
}
function flightsWire(on) {
  on('recEnd', 'onclick', () => recStop('hand'));
  on('recGo', 'onclick', () => { REC.wait = false; recStart(Date.now() - 30000); renderSettings(); });
  on('pilotName', 'onchange', (e) => { S.pilot = e.target.value.trim(); save(); if (REC.cur) REC.cur.pilot = S.pilot; });
  on('gliderName', 'onchange', (e) => { S.gliderName = e.target.value.trim(); save(); if (REC.cur) REC.cur.glider = S.gliderName; });
  document.querySelectorAll('[data-lgplay]').forEach((b) => (b.onclick = () => logReplay(b.dataset.lgplay)));
  document.querySelectorAll('[data-lgdl]').forEach((b) => (b.onclick = () => logDownload(b.dataset.lgdl)));
  document.querySelectorAll('[data-lgdel]').forEach((b) => (b.onclick = () => logRemove(b.dataset.lgdel)));
}
