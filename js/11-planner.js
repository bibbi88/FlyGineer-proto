'use strict';
/* ================= XC planner (Web page → "XC planner"): our own route planner instead of the FlyXC frame =================
   Tap the map to add a point, drag a point to move it, tap a "+" on a leg to insert one, tap a point to select it.
   Airspaces, turnpoint cylinders and your position are always shown. The draft is kept in localStorage 'bora.plan'.
   Route types: open distance, out & return, flat / FAI triangle (3 corners, closed within 20 % of the triangle). */
const PL = { m: null, pts: null, sel: -1, layer: null, g: null, hist: [] };
function plLoad() {
  if (PL.pts) return;
  try { const d = JSON.parse(localStorage.getItem('bora.plan') || 'null'); if (d && Array.isArray(d.pts)) { PL.pts = d.pts; PL.layer = d.layer; } } catch (e) { }
  if (!PL.pts) PL.pts = st.task ? st.task.pts.map((p) => [p.lat, p.lon]) : [];
  if (!LAYERS[PL.layer]) PL.layer = S.layer && LAYERS[S.layer] ? S.layer : 'topo';
}
function plSave() { try { localStorage.setItem('bora.plan', JSON.stringify({ pts: PL.pts, layer: PL.layer })); } catch (e) { } }
function plEdit(fn) { PL.hist.push(JSON.stringify(PL.pts)); if (PL.hist.length > 50) PL.hist.shift(); fn(); plSave(); plDraw(); }
const plName = (i, n) => (i === 0 ? 'Start' : i === n - 1 && n > 1 ? 'Goal' : 'TP' + i);
// what kind of flight the route is, and its length as it would be flown
function plAnalyse(P) {
  const n = P.length, d = (a, b) => dist(a[0], a[1], b[0], b[1]); let len = 0; for (let i = 1; i < n; i++) len += d(P[i - 1], P[i]);
  const r = { n, len, kind: n < 2 ? 'none' : 'open', legs: P.slice(1).map((p, i) => d(P[i], p)) };
  if (n >= 3 && d(P[0], P[n - 1]) <= Math.max(400, 0.05 * len)) r.kind = 'or';            // back where it started
  // triangle: 3 corners, closed (start/finish anywhere on it, gap within 20 % of the triangle)
  const tri = n === 4 ? [P[0], P[1], P[2]] : n === 5 ? [P[1], P[2], P[3]] : null;
  if (tri) { const a = d(tri[0], tri[1]), b = d(tri[1], tri[2]), c = d(tri[2], tri[0]), per = a + b + c, gap = d(P[0], P[n - 1]);
    if (gap <= 0.2 * per) { const mn = Math.min(a, b, c) / per; Object.assign(r, { kind: mn >= FAI_MIN ? 'fai' : 'flat', per, gap, mn, tri: [a, b, c] }); } }
  return r;
}
const PL_KIND = { none: 'Tap the map to add the start', open: 'Open distance', or: 'Out & return', flat: 'Flat triangle', fai: 'FAI triangle' };
function plIcon(i, n, sel, loop) {
  if (loop && i === 0) return L.divIcon({ className: '', html: `<div class="plPt${sel ? ' sel' : ''}" style="background:linear-gradient(135deg,#2E7D4F 50%,#B42318 50%);font-size:14px">S/G</div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
  const lab = i === 0 ? 'S' : i === n - 1 && n > 1 ? 'G' : String(i), bg = i === 0 ? '#2E7D4F' : i === n - 1 && n > 1 ? '#B42318' : '#1E50C8';
  return L.divIcon({ className: '', html: `<div class="plPt${sel ? ' sel' : ''}" style="background:${bg}">${lab}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
}
function plMount() {
  plLoad();
  const box = $('planArea');
  if (!PL.m) {
    box.innerHTML = `<div id="plMap"></div><div id="plSide" class="card"></div>`;
    const m = PL.m = L.map('plMap', { zoomControl: false, attributionControl: true, zoomSnap: 0.5, rotateControl: false });
    L.control.zoom({ position: 'bottomleft' }).addTo(m); L.control.scale({ metric: true, imperial: false, position: 'bottomright' }).addTo(m);
    PL.tile = L.tileLayer(LAYERS[PL.layer].url, LAYERS[PL.layer].o).addTo(m);
    PL.air = L.layerGroup().addTo(m); PL.g = L.layerGroup().addTo(m); PL.me = L.marker([0, 0], { icon: gliderIcon(0.8), interactive: false, zIndexOffset: 500 });
    const f = st.fix || startPlace(); if (PL.pts.length) m.fitBounds(L.latLngBounds(PL.pts).pad(0.3)); else m.setView(f ? [f.lat, f.lon] : [63.1, 21.6], 11);
    // your position follows while the planner is open
    setInterval(() => { if (curPage === 'pWeb' && webCur === 'plan' && st.fix) PL.me.setLatLng([st.fix.lat, st.fix.lon]).addTo(m); }, 2000);
    m.on('click', (e) => { if (PL.sel >= 0) { PL.sel = -1; plDraw(); return; } plEdit(() => PL.pts.push([+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)])); });
  }
  setTimeout(() => PL.m.invalidateSize(), 0);
  plDraw();
}
function plDraw() {
  if (!PL.m) return; const m = PL.m, P = PL.pts, n = P.length, g = PL.g; g.clearLayers();
  // airspaces (always), your position
  if (PL.airV !== st.airVer) { PL.airV = st.airVer; PL.air.clearLayers(); drawAirInto(PL.air); }
  const f = st.fix; if (f) PL.me.setLatLng([f.lat, f.lon]).addTo(m); else PL.me.remove();
  // FAI helper: with the first two corners set, show where the third must go
  const A = plAnalyse(P);
  if (n === 2 || n === 3) faiSectors({ lat: P[0][0], lon: P[0][1] }, { lat: P[1][0], lon: P[1][1] }).forEach(({ ring }) => L.polygon(ring, { color: '#16A34A', weight: 1.5, fillColor: '#16A34A', fillOpacity: 0.1, interactive: false }).addTo(g));
  if (n > 1) { L.polyline(P, { color: '#FFFFFF', weight: 8, opacity: 0.8, interactive: false }).addTo(g); L.polyline(P, { color: A.kind === 'fai' ? '#16A34A' : '#1E50C8', weight: 4, interactive: false }).addTo(g); }
  // closed loop: start and goal share one marker (S/G) that moves both
  const loop = n >= 3 && dist(P[0][0], P[0][1], P[n - 1][0], P[n - 1][1]) < 60;
  P.forEach((p, i) => {
    if (loop && i === n - 1) { L.marker([(p[0] + P[i - 1][0]) / 2, (p[1] + P[i - 1][1]) / 2], { icon: L.divIcon({ className: '', html: '<div class="plAdd">+</div>', iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: 900 }).on('click', () => plEdit(() => { P.splice(i, 0, [(p[0] + P[i - 1][0]) / 2, (p[1] + P[i - 1][1]) / 2]); PL.sel = i; })).addTo(g); return; }
    L.circle(p, { radius: S.cylR, color: '#111418', weight: 1.5, fill: false, interactive: false }).addTo(g);
    const mk = L.marker(p, { icon: plIcon(i, n, i === PL.sel, loop), draggable: true, zIndexOffset: 1000 }).addTo(g);
    mk.on('dragstart', () => PL.hist.push(JSON.stringify(PL.pts)));
    mk.on('dragend', (e) => { const ll = e.target.getLatLng(); P[i] = [+ll.lat.toFixed(6), +ll.lng.toFixed(6)]; if (loop && i === 0) P[n - 1] = P[0].slice(); PL.sel = i; plSave(); plDraw(); });
    mk.on('click', () => { PL.sel = PL.sel === i ? -1 : i; plDraw(); });
    // "+" in the middle of each leg inserts a point there
    if (i > 0) { const q = P[i - 1], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      L.marker(mid, { icon: L.divIcon({ className: '', html: '<div class="plAdd">+</div>', iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: 900 }).on('click', () => plEdit(() => { P.splice(i, 0, mid); PL.sel = i; })).addTo(g); }
  });
  plSide(A);
}
function plSide(A) {
  const P = PL.pts, n = P.length, sel = PL.sel, km = (v) => fDist(v);
  const info = A.kind === 'fai' || A.kind === 'flat' ? `<div class="plBig">${km(A.per)}</div><div class="muted">${PL_KIND[A.kind]} · shortest leg ${Math.round(A.mn * 100)} %${A.kind === 'flat' ? ` (FAI needs ${Math.round(FAI_MIN * 100)} %)` : ''} · closing gap ${km(A.gap)}</div>`
    : `<div class="plBig">${n > 1 ? km(A.len) : '--'}</div><div class="muted">${PL_KIND[A.kind]}${n === 2 || n === 3 ? ' · green: where a 3rd corner makes an FAI triangle' : ''}</div>`;
  const rows = P.map((p, i) => `<div class="plRow${i === sel ? ' sel' : ''}"><button class="plSel" data-plsel="${i}"><b>${plName(i, n)}</b><span class="muted">${i ? km(A.legs[i - 1]) : 'start'}</span></button><button class="btn" data-pldel="${i}" aria-label="Delete ${plName(i, n)}">✕</button></div>`).join('');
  $('plSide').innerHTML = `<div class="row" style="justify-content:space-between"><b style="font-size:20px">XC planner</b><button class="btn" id="plLayer">${LAYERS[PL.layer].name}</button></div>
    ${info}
    <div class="plList">${rows || '<div class="muted">Tap the map to add points. Drag a point to move it, tap ＋ on a leg to add one in between.</div>'}</div>
    <div class="plBtns">
      <button class="btn" id="plUndo" ${PL.hist.length ? '' : 'disabled'}>↶ Undo</button>
      <button class="btn" id="plClose" ${n >= 2 ? '' : 'disabled'}>Close loop</button>
      <button class="btn" id="plRev" ${n >= 2 ? '' : 'disabled'}>Reverse</button>
      <button class="btn" id="plStart">Start at takeoff</button>
      <button class="btn" id="plFromTask" ${st.task ? '' : 'disabled'}>Load my task</button>
      <button class="btn warn" id="plClear" ${n ? '' : 'disabled'}>Clear</button>
    </div>
    <button class="btn primary" id="plUse" ${n >= 2 ? '' : 'disabled'} style="min-height:56px">Use as my task</button>
    <div class="row"><button class="btn grow" id="plCopy" ${n >= 2 ? '' : 'disabled'}>Copy link</button><button class="btn grow" id="plFx" ${n >= 2 ? '' : 'disabled'}>Open in FlyXC</button></div>`;
  const q = (id, fn) => { const e = $(id); if (e) e.onclick = fn; };
  document.querySelectorAll('[data-plsel]').forEach((b) => (b.onclick = () => { const i = +b.dataset.plsel; PL.sel = PL.sel === i ? -1 : i; if (PL.sel >= 0) PL.m.panTo(P[i]); plDraw(); }));
  document.querySelectorAll('[data-pldel]').forEach((b) => (b.onclick = () => plEdit(() => { P.splice(+b.dataset.pldel, 1); PL.sel = -1; })));
  q('plUndo', () => { const h = PL.hist.pop(); if (h) { PL.pts = JSON.parse(h); PL.sel = -1; plSave(); plDraw(); } });
  q('plClose', () => plEdit(() => P.push(P[0].slice())));
  q('plRev', () => plEdit(() => P.reverse()));
  q('plStart', () => { const s0 = startPlace() || st.fix; if (!s0) { toast('No Start point or GPS position yet'); return; } plEdit(() => { if (P.length && dist(P[0][0], P[0][1], s0.lat, s0.lon) < 50) return; P.unshift([s0.lat, s0.lon]); }); PL.m.panTo([s0.lat, s0.lon]); });
  q('plFromTask', () => { plEdit(() => { PL.pts = st.task.pts.map((p) => [p.lat, p.lon]); PL.sel = -1; }); PL.m.fitBounds(L.latLngBounds(PL.pts).pad(0.3)); });
  q('plClear', () => plEdit(() => { P.length = 0; PL.sel = -1; }));
  q('plLayer', () => { const ks = Object.keys(LAYERS); PL.layer = ks[(ks.indexOf(PL.layer) + 1) % ks.length]; PL.m.removeLayer(PL.tile); PL.tile = L.tileLayer(LAYERS[PL.layer].url, LAYERS[PL.layer].o).addTo(PL.m); PL.tile.bringToBack(); plSave(); plDraw(); });
  q('plUse', () => plUseTask());
  q('plCopy', async () => { const t = 'https://flyxc.app/?p=' + encodeURIComponent(encodePolyline(P)); try { await navigator.clipboard.writeText(t); toast('Route copied as a FlyXC link'); } catch (e) { prompt('Copy the route link', t); } });
  q('plFx', () => window.open('https://flyxc.app/?p=' + encodeURIComponent(encodePolyline(P)), '_blank'));
}
function plUseTask() {
  const P = PL.pts, n = P.length; if (n < 2) return; const A = plAnalyse(P), d = new Date(), old = st.task;
  st.task = { name: 'Plan ' + d.getDate() + '.' + (d.getMonth() + 1), len: A.len, pts: P.map((p, i) => ({ lat: p[0], lon: p[1], name: plName(i, n) })) };
  st.nextWp = n > 1 ? 1 : 0; st.wpHit = st.goalT = null;
  localStorage.setItem('bora.task', JSON.stringify(st.task)); drawTask(); renderWidgets();
  toast(`Task set · ${n} points · ${fDist(A.len)}${A.kind === 'fai' ? ' · FAI triangle' : ''}`, [['Show on map', () => showPage('pMap')], ['Undo', () => { st.task = old; if (old) localStorage.setItem('bora.task', JSON.stringify(old)); else localStorage.removeItem('bora.task'); drawTask(); renderWidgets(); }]]);
}
