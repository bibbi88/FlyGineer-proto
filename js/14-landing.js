'use strict';
/* ================= landing fields: nearest reachable, on the map =================
   Fields = your own (S.lands [{id, name, lat, lon, el?}], added at your position, from the map pointer or a SeeYou .cup file) plus airports from the
   places data (S.landAir, default on). Arrival height per field = height − d · sink / ground speed along the bearing (wing V = S.wingSpd, L/D = S.wingLD,
   with the wind, 02 gsAlong) − field elevation; reachable = arrival ≥ S.safety. That is a straight line: terrain on the way is only checked through the
   glide reach area (02 st.reach) when a map shows it ("terrain ok"). Field elevations come from the .cup file or Open-Meteo (elevCached), once. */
const landOwn = () => (Array.isArray(S.lands) ? S.lands : []);
function landList() {
  const own = landOwn().map((l) => ({ ...l, own: true })), air = S.landAir === false ? [] : (st.places || []).filter((p) => p.kind === 'airport').map((p) => ({ id: 'ap' + p.lat.toFixed(4) + p.lon.toFixed(4), name: p.name + (p.sub && /^[A-Z]{4}$/.test(p.sub) && p.sub !== p.name ? ' ' + p.sub : ''), lat: p.lat, lon: p.lon, el: landElev['ap' + p.lat.toFixed(4) + p.lon.toFixed(4)], air: true }));
  return own.concat(air.filter((a) => !own.some((o) => dist(o.lat, o.lon, a.lat, a.lon) < 500)));
}
const landElev = {}; let landElBusy = false;
async function landElevFill() {
  if (landElBusy || !st.fix) return; const f = st.fix, miss = landList().filter((l) => l.el == null && dist(f.lat, f.lon, l.lat, l.lon) < 80000).slice(0, 100); if (!miss.length) return;
  landElBusy = true;
  try { const el = await elevCached(miss.map((l) => [l.lat, l.lon])); let ch = false;
    miss.forEach((l, i) => { if (el[i] == null) return; if (l.own) { const o = landOwn().find((x) => x.id === l.id); if (o) { o.el = Math.round(el[i]); ch = true; } } else landElev[l.id] = Math.round(el[i]); });
    if (ch) save(); markDirty(); } catch (e) { } finally { landElBusy = false; }
}
function landCalc() {
  const f = st.fix, alt = altNow(); if (!f || alt == null) return [];
  const V = Math.max(5, sN('wingSpd', 37) / 3.6), sink = V / Math.max(2, S.wingLD), safe = +S.safety || 0, R = st.reach;
  return landList().map((l) => {
    const d = dist(f.lat, f.lon, l.lat, l.lon), b = brg(f.lat, f.lon, l.lat, l.lon), G = typeof glideAlong === 'function' ? glideAlong(b) : { gs: gsAlong(b, V), sink }, gs = G.gs, el = l.el ?? null;
    const arr = gs > 0 && el != null ? alt - (d * G.sink) / gs - el : null, need = el != null && alt - el > 0 ? d / (alt - el) : null;
    const terr = R && R.terrain && Date.now() - R.t < 60000 ? inPoly(l.lat, l.lon, R.poly) : null;
    return { l, d, b, gs, arr, need, ok: arr != null && arr >= safe && terr !== false, terr };
  }).filter((x) => x.d < 80000).sort((a, b) => a.d - b.d);
}
function landBest() { const L0 = landCalc(); return { all: L0, best: L0.find((x) => x.ok) || null, near: L0[0] || null }; }
setInterval(landElevFill, 10000);

/* map: own fields and airports as "L" squares, green when reachable, with the arrival height; dashed line to the nearest reachable one */
function drawLandsInto(I, C) {
  const g = I.g.lands; if (!g) return; const want = C.lands !== false && C.lands !== 'false' && st.fix;
  if (!want) { if (I.landK) { g.clearLayers(); I.landK = ''; } if (I.landLn) I.landLn.remove(); return; }
  const B = landBest(), k = B.all.map((x) => x.l.id + (x.ok ? 1 : 0) + (x.arr != null ? Math.round(x.arr / 10) : '')).join('|') + S.uAlt;
  if (I.landK !== k) { I.landK = k; g.clearLayers();
    B.all.filter((x) => x.l.own || x.d < 40000).forEach((x) => { const col = x.ok ? '#1F8A4C' : x.arr != null ? '#9AA0A6' : '#6B7280', lab = x.arr == null ? '' : (x.arr >= 0 ? '+' : '−') + fAlt(Math.abs(x.arr));
      const mk = L.marker([x.l.lat, x.l.lon], { icon: L.divIcon({ className: 'lfMk', html: `<span class="lfSq" style="background:${col}">L</span><span class="lfT">${esc(x.l.name)}${lab ? ' <b style="color:' + (x.ok ? '#1F8A4C' : '#C62828') + '">' + lab + '</b>' : ''}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }), interactive: true, zIndexOffset: 400 }).addTo(g);
      mk.on('click', (e) => { L.DomEvent.stopPropagation(e); st.tapGuard = Date.now(); openLandInfo(x.l.id); }); }); }
  const tgt = B.best; if (tgt && C.landLine !== false && C.landLine !== 'false') { const ll = [[st.fix.lat, st.fix.lon], [tgt.l.lat, tgt.l.lon]]; if (!I.landLn) I.landLn = L.polyline([], { color: '#1F8A4C', weight: 3, dashArray: '4 8', opacity: 0.9, interactive: false }); I.landLn.setLatLngs(ll); if (!I.m.hasLayer(I.landLn)) I.landLn.addTo(I.m); }
  else if (I.landLn) I.landLn.remove();
}

/* the Landing widget: the nearest field you can reach and how high you arrive */
function landWData(W) {
  const B = landBest(), A = (m) => fAlt(Math.abs(m)), dir = (x) => clockOf(x.b) + " o'clock";
  if (!st.fix || altNow() == null) return { l: 'Landing', v: '--', s: 'waiting for GPS' };
  if (!B.all.length) return { l: 'Landing', v: '--', s: landOwn().length || S.landAir !== false ? 'no field within 80 km' : 'add fields: Settings → Landing fields' };
  const x = B.best; if (x) return { l: 'Landing · ' + x.l.name, v: '+' + A(x.arr), u: S.uAlt, s: fDist(x.d) + ' · ' + dir(x) + (x.terr ? ' · terrain ok' : '') + ' · ' + (B.all.filter((y) => y.ok).length - 1 > 0 ? (B.all.filter((y) => y.ok).length - 1) + ' more' : 'only one'), col: '#1F8A4C' };
  const n = B.all.filter((y) => y.arr != null).sort((p, q) => q.arr - p.arr)[0] || B.near;
  return { l: 'Landing · none reachable', v: n.arr != null ? '−' + A(Math.max(0, (+S.safety || 0) - n.arr)) : '--', u: S.uAlt, s: n.l.name + ' ' + fDist(n.d) + ' · ' + dir(n) + (n.arr != null ? ' · short' : ''), bgc: '#C62828', col: '#FFFFFF' };
}
function landListHTML() {
  const B = landBest(); if (!B.all.length) return '<div class="muted">No landing fields within 80 km. Add your own: Settings → Landing fields, or move the map and tap “+ Landing field here”.</div>';
  return B.all.slice(0, 25).map((x) => `<div class="li" style="justify-content:space-between;gap:10px;min-height:46px" data-lfid="${x.l.id}"><span><b>${esc(x.l.name)}</b>${x.l.air ? ' <span class="muted">airport</span>' : ''}<br><span class="muted">${fDist(x.d)} · ${clockOf(x.b)} o'clock · ${String(Math.round(x.b)).padStart(3, '0')}°${x.need ? ' · needs L/D ' + x.need.toFixed(1) : ''}${x.l.el != null ? ' · field ' + fAlt(x.l.el) + ' ' + S.uAlt : ''}</span></span><b style="font-size:20px;color:${x.ok ? '#1F8A4C' : '#C62828'}">${x.arr == null ? (x.gs > 0 ? '…' : 'into wind ✕') : (x.arr >= 0 ? '+' : '−') + fAlt(Math.abs(x.arr)) + ' ' + S.uAlt}</b></div>`).join('') + `<div class="muted" style="margin-top:6px">Arrival heights in a straight line with L/D ${S.wingLD} at ${sN('wingSpd', 37)} km/h and the wind; green = at least ${fAlt(+S.safety || 0)} ${S.uAlt} above the field. Terrain on the way is only checked when a map shows the glide reach area.</div>`;
}
function openLandInfo(id) { const x = landCalc().find((y) => y.l.id === id); if (!x) return; openInfo(x.l.name, () => { const y = landCalc().find((z) => z.l.id === id) || x; return `<div class="wgrid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${statBox('Arrival', y.arr == null ? '--' : (y.arr >= 0 ? '+' : '−') + fAlt(Math.abs(y.arr)), S.uAlt + (y.ok ? ' · reachable' : ' · not reachable'))}${statBox('Distance', fDist(y.d), clockOf(y.b) + " o'clock · " + String(Math.round(y.b)).padStart(3, '0') + '°')}${statBox('Needs L/D', y.need ? y.need.toFixed(1) : '--', 'wing ' + S.wingLD)}${statBox('Field', y.l.el != null ? fAlt(y.l.el) : '--', S.uAlt + ' AMSL')}</div>`; }); }
function landAdd(name, lat, lon, el) { const L0 = landOwn().slice(); L0.push({ id: 'lf' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: name || 'Field ' + (L0.length + 1), lat: +lat.toFixed(6), lon: +lon.toFixed(6), ...(el != null ? { el: Math.round(el) } : {}) }); S.lands = L0; save(); markDirty(); setTimeout(landElevFill, 100); }
// SeeYou .cup waypoints: name,code,country,lat,lon,elev,style,…; styles 2–5 are landable (grass/outlanding/gliding/paved airfields)
function parseCup(txt) {
  const out = [], ll = (s, deg) => { const m = /^(\d+)(\d\d\.\d+)([NSEW])$/i.exec(s.trim()); if (!m) return null; let v = +m[1] + +m[2] / 60; if (/[SW]/i.test(m[3])) v = -v; return v; };
  for (const line of txt.split(/\r?\n/)) { if (/^-----Related Tasks/i.test(line)) break; const p = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g); if (!p || p.length < 7) continue;
    const c = p.map((x) => x.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()), lat = ll(c[3], 2), lon = ll(c[4], 3); if (lat == null || lon == null) continue;
    const style = +c[6] || 0, em = /^(-?[\d.]+)\s*(m|ft)?$/i.exec(c[5] || ''); const el = em ? (/ft/i.test(em[2] || '') ? +em[1] * 0.3048 : +em[1]) : null;
    out.push({ name: c[0] || c[1] || 'Field', lat, lon, el, land: style >= 2 && style <= 5 }); }
  return out;
}
/* Settings → Landing fields */
function landsSecHTML() {
  const L0 = landOwn(), f = st.fix;
  return `<div class="card sec"><h2>Landing fields</h2>
    <div class="muted">The Landing widget shows the nearest field you can reach and the height you arrive with (wing L/D and trim speed in Units & glide, with the wind). Maps show the fields as L squares, green when reachable, and a dashed line to the nearest one you can reach.</div>
    ${seg('landAir', [[true, 'Include'], [false, 'Leave out']], 'Airports from the places data')}
    <div class="field"><label for="lfName">Add a field at your position</label><input type="text" id="lfName" maxlength="40" placeholder="Name, e.g. Ylistaro field" style="flex:1;min-width:180px"><button class="btn primary" id="lfHere" ${f ? '' : 'disabled'}>Add here</button></div>
    <div class="muted">Or move a map away from you and tap “+ Landing field here” under the crosshair.</div>
    <div class="field"><label for="lfCup">Import a SeeYou .cup file</label><input type="file" id="lfCup" accept=".cup,.CUP,text/plain" style="min-height:48px"></div>
    <div class="field"><span class="k">From the file take</span><span class="row"><button class="pill" data-lfcup="land" aria-pressed="${st.lfCupAll !== true}">Landable points only</button><button class="pill" data-lfcup="all" aria-pressed="${st.lfCupAll === true}">All points</button></span></div>
    <h2 style="margin-top:14px">Your fields (${L0.length})</h2>${L0.length ? '' : '<div class="muted">None yet.</div>'}
    ${L0.map((l) => `<div class="li" style="justify-content:space-between;gap:8px;min-height:50px"><span><b>${esc(l.name)}</b><br><span class="muted">${l.lat.toFixed(5)}, ${l.lon.toFixed(5)}${l.el != null ? ' · ' + fAlt(l.el) + ' ' + S.uAlt : ''}${f ? ' · ' + fDist(dist(f.lat, f.lon, l.lat, l.lon)) + ' from you' : ''}</span></span><span class="row"><button class="btn" data-lfren="${l.id}">Rename</button><button class="btn warn" data-lfdel="${l.id}">✕</button></span></div>`).join('')}
    ${L0.length ? '<div class="field"><span class="k"></span><button class="btn warn" id="lfClear">Remove all your fields</button></div>' : ''}</div>`;
}
function landsWire(on) {
  on('lfHere', 'onclick', () => { const f = st.fix; if (!f) return; landAdd($('lfName').value.trim(), f.lat, f.lon); toast('Landing field added'); renderSettings(); });
  on('lfCup', 'onchange', async (e) => { const fl = e.target.files[0]; if (!fl) return; try { const P = parseCup(await fl.text()).filter((p) => st.lfCupAll === true || p.land); if (!P.length) { toast('No ' + (st.lfCupAll ? '' : 'landable ') + 'points in the file'); return; }
    const old = landOwn().slice(); P.forEach((p) => { if (!landOwn().some((o) => dist(o.lat, o.lon, p.lat, p.lon) < 100)) landAdd(p.name, p.lat, p.lon, p.el); }); renderSettings(); toast(P.length + ' points read', [['Undo', () => { S.lands = old; save(); renderSettings(); }]]); } catch (err) { toast('Could not read the file: ' + err.message); } e.target.value = ''; });
  document.querySelectorAll('[data-lfcup]').forEach((b) => (b.onclick = () => { st.lfCupAll = b.dataset.lfcup === 'all'; renderSettings(); }));
  document.querySelectorAll('[data-lfdel]').forEach((b) => (b.onclick = () => { const old = landOwn().slice(); S.lands = old.filter((l) => l.id !== b.dataset.lfdel); save(); markDirty(); renderSettings(); toast('Field removed', [['Undo', () => { S.lands = old; save(); markDirty(); renderSettings(); }]]); }));
  document.querySelectorAll('[data-lfren]').forEach((b) => (b.onclick = () => { const l = landOwn().find((x) => x.id === b.dataset.lfren); if (!l) return; const n = prompt('Field name', l.name); if (n && n.trim()) { l.name = n.trim().slice(0, 40); save(); markDirty(); renderSettings(); } }));
  on('lfClear', 'onclick', () => { const old = landOwn().slice(); S.lands = []; save(); markDirty(); renderSettings(); toast('All your fields removed', [['Undo', () => { S.lands = old; save(); markDirty(); renderSettings(); }]]); });
}
