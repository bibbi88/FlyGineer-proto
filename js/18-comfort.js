'use strict';
/* ================= share your position, retrieve help, battery saver, pre-flight check =================
   Share (action `share`): the Android share sheet (SMS, WhatsApp, …) with a map link, height and time; without it the text goes to the clipboard.
   There is no live tracking: that needs a server that takes positions (XContest live has no open API).
   Retrieve (action `retrieve`, offered on landing): where you are, the nearest town and road (Overpass), distance back to takeoff, and buttons to
   share it, open it in Google Maps (for the driver) and copy the coordinates.
   Battery saver (S.saver 'auto' (default: tablet below S.saverAt %, 25, and not charging) / 'on' / 'off'): screen updates at most every 2 s, adsb.fi
   every 30 s, the glide reach area every minute. Pre-flight check (header button, action `checklist`): automatic checks plus your own items (S.checkItems),
   ticked per day (localStorage bora.check). */
const posLink = (lat, lon) => `https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}`;
function posText() {
  const f = st.fix || st.gpsPos; if (!f) return null; const a = altNow(), t = new Date();
  return `${S.pilot ? S.pilot + ': ' : ''}my position ${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${posLink(f.lat, f.lon)}${a != null && !REC.wait ? ' · ' + fAlt(a) + ' ' + S.uAlt : ''} (${f.lat.toFixed(5)}, ${f.lon.toFixed(5)})`;
}
async function sharePos() {
  if (st.replay || st.sim) { toast('Demo or replay: that is not your real position'); }
  const txt = posText(); if (!txt) { toast('No position yet'); return; }
  try { if (navigator.share) { await navigator.share({ title: 'My position', text: txt }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(txt); toast('Position copied: paste it into a message'); } catch (e) { toast(txt); }
}
/* retrieve */
let retrieveRoad = null;
async function retrieveLoad(f) {
  retrieveRoad = { busy: true }; const q = `[out:json][timeout:15];way(around:3000,${f.lat.toFixed(5)},${f.lon.toFixed(5)})[highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track)$"];out geom 60;`;
  for (const u of OVERPASS) { try { const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json();
    let best = null; (j.elements || []).forEach((w) => (w.geometry || []).forEach((g) => { const d = dist(f.lat, f.lon, g.lat, g.lon); if (!best || d < best.d) best = { d, lat: g.lat, lon: g.lon, name: (w.tags && (w.tags.name || w.tags.ref)) || '', kind: w.tags && w.tags.highway }; }));
    retrieveRoad = best || { none: true }; markDirty(); return; } catch (e) { } }
  retrieveRoad = { fail: true };
}
function retrieveHTML() {
  const f = st.fix || st.gpsPos; if (!f) return '<div class="muted">No position yet.</div>';
  const town = (st.places || []).filter((p) => p.kind === 'town').map((p) => ({ p, d: dist(f.lat, f.lon, p.lat, p.lon) })).sort((a, b) => a.d - b.d)[0], tk = st.takeoffPos, R = retrieveRoad;
  const row = (k, v) => `<div class="li" style="justify-content:space-between;gap:10px;min-height:44px"><span class="muted">${k}</span><b style="text-align:right">${v}</b></div>`;
  const road = !R || R.busy ? 'looking…' : R.fail ? 'could not load (offline?)' : R.none ? 'none within 3 km' : `${fDist(R.d)} ${COMPASS16[Math.round(brg(f.lat, f.lon, R.lat, R.lon) / 22.5) % 16]}${R.name ? ' · ' + esc(R.name) : ''}${R.kind === 'track' ? ' (track)' : ''}`;
  return row('Position', `${f.lat.toFixed(5)}, ${f.lon.toFixed(5)}`) + row('Nearest town', town ? `${esc(town.p.name)} · ${fDist(town.d)} ${COMPASS16[Math.round(brg(town.p.lat, town.p.lon, f.lat, f.lon) / 22.5) % 16]} of it` : 'not known (places not loaded)')
    + row('Nearest road', road) + (tk ? row('Back to takeoff', `${fDist(dist(f.lat, f.lon, tk[0], tk[1]))} · ${String(Math.round(brg(f.lat, f.lon, tk[0], tk[1]))).padStart(3, '0')}°`) : '')
    + `<div class="row" style="flex-wrap:wrap;gap:8px;margin-top:10px"><button class="btn primary" data-rt="share">Share my position</button><button class="btn" data-rt="maps">Open in Google Maps</button><button class="btn" data-rt="copy">Copy coordinates</button>${R && !R.busy && !R.fail && !R.none ? '<button class="btn" data-rt="road">Road point in Maps</button>' : ''}</div>`;
}
function openRetrieve() {
  const f = st.fix || st.gpsPos; if (f && (!retrieveRoad || retrieveRoad.fail || (retrieveRoad.at && dist(retrieveRoad.at[0], retrieveRoad.at[1], f.lat, f.lon) > 300))) { retrieveLoad(f).then(() => { if (retrieveRoad) retrieveRoad.at = [f.lat, f.lon]; }); }
  openInfo('Retrieve', retrieveHTML);
  $('hBody').onclick = (e) => { const b = e.target.closest('[data-rt]'); if (!b) return; const p = st.fix || st.gpsPos; if (!p) return; const k = b.dataset.rt;
    if (k === 'share') sharePos(); else if (k === 'maps') window.open(posLink(p.lat, p.lon), '_blank'); else if (k === 'road' && retrieveRoad) window.open(posLink(retrieveRoad.lat, retrieveRoad.lon), '_blank');
    else navigator.clipboard?.writeText(`${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`).then(() => toast('Coordinates copied'), () => toast(`${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`)); };
}
/* battery saver */
function saverOn() { const m = S.saver || 'auto'; if (m === 'on') return true; if (m === 'off') return false; return st.deviceBat != null && !st.deviceChg && st.deviceBat < sN('saverAt', 25); }
setInterval(() => { const on = saverOn(); if (on !== st.saverWas) { if (st.saverWas != null) toast(on ? 'Battery saver on: slower screen updates' : 'Battery saver off'); st.saverWas = on; document.body.classList.toggle('saver', on); } }, 5000);
/* pre-flight check */
const CHECK_DEF = ['Helmet on, chin strap closed', 'Leg straps and chest strap closed', 'Reserve handle and pin checked', 'Lines and brakes free', 'Radio on, channel set'];
const checkItems = () => (Array.isArray(S.checkItems) ? S.checkItems : CHECK_DEF);
function checkDone() { try { const c = JSON.parse(localStorage.getItem('bora.check') || '{}'); return c.day === new Date().toDateString() ? c.done || {} : {}; } catch (e) { return {}; } }
function checkSet(i, v) { const d = checkDone(); d[i] = v; try { localStorage.setItem('bora.check', JSON.stringify({ day: new Date().toDateString(), done: d })); } catch (e) { } }
function autoChecks() {
  const f = st.gpsPos || st.fix, bs = typeof baroStats === 'function' ? baroStats() : {}, vb = st.bora && st.bora.batt;
  return [
    ['Vario connected', st.bora ? (bs.last && bs.age <= 2 ? 'ok · ' + bs.rate.toFixed(0) + ' readings/s' : 'connected, no readings') : 'not connected', st.bora && bs.last && bs.age <= 2, st.bora ? null : 'connect'],
    ['Vario battery', vb ? (vb.pct != null ? vb.pct + ' %' : vb.v.toFixed(2) + ' V') : '--', vb ? (vb.pct != null ? vb.pct >= 30 : vb.v >= 3.6) : null],
    ['GPS', f ? (f.acc ? '±' + Math.round(f.acc) + ' m' : 'position (demo / replay)') : 'no position', f ? (f.acc ? f.acc <= 30 : null) : false],
    ['Tablet battery', st.deviceBat != null ? st.deviceBat + ' %' + (st.deviceChg ? ' · charging' : '') : '--', st.deviceBat == null ? null : st.deviceBat >= 50 || st.deviceChg],
    ['Vario sound', S.sound ? 'on · ' + (S.volPct ?? 50) + ' %' : 'off', !!S.sound, 'sound'],
    ['Flight recorder', recOn() ? 'on' : 'off', recOn()],
    ['Airspace', (st.airspaces || []).length ? airShown().length + ' areas shown' : 'none loaded', (st.airspaces || []).length > 0],
    ['NOTAMs', typeof NOTAMS !== 'undefined' && NOTAMS.length ? NOTAMS.length + ' loaded' : 'none loaded', null],
    ['Internet', navigator.onLine ? 'online' : 'offline', navigator.onLine],
    ['Task', st.task ? esc(st.task.name) + ' · ' + st.task.pts.length + ' points' : 'none', null]];
}
function checkHTML() {
  const A = autoChecks(), D = checkDone(), I = checkItems(), mk = (ok) => (ok === true ? '<b style="color:#1F8A4C">✓</b>' : ok === false ? '<b style="color:var(--restr)">✕</b>' : '<b class="muted">·</b>');
  return '<h3 style="margin:4px 0">Instrument</h3>' + A.map(([k, v, ok, act]) => `<div class="li" style="justify-content:space-between;gap:10px;min-height:44px"><span>${mk(ok)} ${k}</span><span class="row"><b>${v}</b>${act === 'connect' ? '<button class="btn primary" data-ck="connect">Connect</button>' : ''}${act === 'sound' ? '<button class="btn" data-ck="test">Test</button>' : ''}</span></div>`).join('')
    + `<h3 style="margin:10px 0 4px">Your checks</h3>` + I.map((t, i) => `<button class="li" data-cki="${i}" style="width:100%;justify-content:flex-start;gap:12px;min-height:52px;font-size:17px;background:none;border:0;border-top:1px solid var(--line);text-align:left"><span style="font-size:24px">${D[i] ? '☑' : '☐'}</span>${esc(t)}</button>`).join('')
    + `<div class="row" style="margin-top:8px;gap:8px"><button class="btn" data-ck="reset">Untick all</button><button class="btn" data-ck="edit">Edit the list</button></div><div class="muted">Ticks reset every day.</div>`;
}
function openChecklist() {
  openInfo('Pre-flight check', checkHTML);
  $('hBody').onclick = (e) => { const b = e.target.closest('[data-cki],[data-ck]'); if (!b) return;
    if (b.dataset.cki != null) { const i = +b.dataset.cki; checkSet(i, !checkDone()[i]); }
    else if (b.dataset.ck === 'connect') connectBora(); else if (b.dataset.ck === 'test') beep.testRate(2, 2);
    else if (b.dataset.ck === 'reset') { try { localStorage.removeItem('bora.check'); } catch (er) { } }
    else if (b.dataset.ck === 'edit') { const t = prompt('Your checks, one per line', checkItems().join('\n')); if (t != null) { S.checkItems = t.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 30); save(); } }
    $('hBody').innerHTML = checkHTML(); };
}
if ($('chkBtn')) $('chkBtn').onclick = () => { setNav(false); openChecklist(); };
