'use strict';
/* ================= XC planner (its own page, pPlan): our own route planner instead of the FlyXC frame =================
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
// XContest scoring as FlyXC does it for a planned route (its optimiser runs over the route points):
// free distance via up to 3 turnpoints ×1.0; flat triangle ×1.2 and FAI triangle ×1.4 (every side ≥ 28 %) score the
// perimeter minus the closing gap, allowed up to 20 % of the perimeter. Brute force over the points (routes are short).
function plScore(P) {
  const n = P.length, D = P.map((a) => P.map((b) => dist(a[0], a[1], b[0], b[1]))), best = { pts: 0, kind: 'none' }; if (n < 2) return best;
  // free distance: the longest path through at most 5 of the points in order (start, 3 TPs, finish)
  let row = new Array(n).fill(0); // row[j] = longest path ending at point j with k legs (any start)
  for (let k = 1; k <= 4; k++) { const nx = new Array(n).fill(-Infinity);
    for (let j = 1; j < n; j++) for (let i = 0; i < j; i++) if (row[i] > -Infinity) nx[j] = Math.max(nx[j], row[i] + D[i][j]);
    nx.forEach((v, j) => { if (v / 1000 > best.pts) Object.assign(best, { pts: v / 1000, kind: 'free', dist: v }); }); row = nx; }
  // triangles: corners i < j < k, closing gap = the closest pair of points before i and after k
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const per = D[i][j] + D[j][k] + D[k][i]; if (per < 1000) continue; let gap = Infinity;
    for (let a = 0; a <= i; a++) for (let b = k; b < n; b++) gap = Math.min(gap, D[a][b]);
    if (gap > 0.2 * per) continue; const fai = Math.min(D[i][j], D[j][k], D[k][i]) / per >= FAI_MIN, v = (per - gap) / 1000 * (fai ? 1.4 : 1.2);
    if (v > best.pts) Object.assign(best, { pts: v, kind: fai ? 'fai' : 'flat', per, gap, tri: [i, j, k] }); }
  return best;
}
const XC_KIND = { none: '', free: 'free distance ×1.0', flat: 'flat triangle ×1.2', fai: 'FAI triangle ×1.4' };
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
    const LS = L.control({ position: 'topleft' }); LS.onAdd = () => { const d = L.DomUtil.create('div', 'plLay'); L.DomEvent.disableClickPropagation(d); d.innerHTML = [['topo', 'Topo'], ['sat', 'Satellite'], ['light', 'Airspace']].map(([k, nm]) => `<button data-pllay="${k}">${nm}</button>`).join(''); d.onclick = (e) => { const b = e.target.closest('[data-pllay]'); if (b) plSetLayer(b.dataset.pllay); }; return d; }; LS.addTo(m);
    PL.air = L.layerGroup().addTo(m); PL.g = L.layerGroup().addTo(m); PL.me = L.marker([0, 0], { icon: gliderIcon(0.8), interactive: false, zIndexOffset: 500 });
    plSetLayer(PL.layer);
    const f = st.fix || startPlace(); if (PL.pts.length) m.fitBounds(L.latLngBounds(PL.pts).pad(0.3)); else m.setView(f ? [f.lat, f.lon] : [63.1, 21.6], 11);
    // your position follows while the planner is open
    setInterval(() => { if (curPage === 'pPlan' && st.fix) PL.me.setLatLng([st.fix.lat, st.fix.lon]).addTo(m); }, 2000);
    m.on('click', (e) => { if (PL.sel >= 0) { PL.sel = -1; plDraw(); return; } plEdit(() => PL.pts.push([+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)])); });
  }
  setTimeout(() => PL.m.invalidateSize(), 0);
  plDraw();
}
function plSetLayer(k) {
  if (!LAYERS[k]) return; PL.layer = k; if (PL.tile) PL.m.removeLayer(PL.tile); PL.tile = L.tileLayer(LAYERS[k].url, LAYERS[k].o).addTo(PL.m); PL.tile.bringToBack(); plSave();
  document.querySelectorAll('[data-pllay]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pllay === k)));
}
function plDraw() {
  if (!PL.m) return; const m = PL.m, P = PL.pts, n = P.length, g = PL.g; g.clearLayers();
  // airspaces (always), your position
  if (PL.airV !== st.airVer) { PL.airV = st.airVer; PL.air.clearLayers(); drawAirInto(PL.air); }
  const f = st.fix; if (f) PL.me.setLatLng([f.lat, f.lon]).addTo(m); else PL.me.remove();
  const A = plAnalyse(P);
  // FAI helper: with two corners set, where a third makes an FAI triangle; with a triangle, for each corner the area it can be
  // moved within (the other two staying put) and still be FAI. The selected corner's area is stronger, the others faint.
  const fill = (ring, k, lab) => { L.polygon(ring, { color: '#1D4ED8', weight: k ? 3 : 2, dashArray: k ? null : '8 6', fillColor: '#2563EB', fillOpacity: k ? 0.32 : 0.16, interactive: false }).addTo(g);
    if (lab) L.marker(ring[Math.floor(ring.length / 2)], { icon: L.divIcon({ className: 'wpLabel', html: lab, iconSize: [90, 18], iconAnchor: [45, 9] }), interactive: false }).addTo(g); };
  const ll = (q) => ({ lat: q[0], lon: q[1] });
  const corners = n === 4 ? [0, 1, 2] : n === 5 ? [1, 2, 3] : n >= 6 ? (plScore(P).tri || null) : null;
  if (n === 2 || n === 3) faiSectors(ll(P[0]), ll(P[1])).forEach(({ ring }) => fill(ring, true));
  else if (corners) {
    const selC = corners.indexOf(PL.sel), anySel = selC >= 0 || (PL.sel === n - 1 && corners[0] === 0);
    corners.forEach((ci, k) => {
      const a = corners[(k + 1) % 3], b = corners[(k + 2) % 3], L0 = faiLocal(ll(P[a])), [bx, by] = L0.xy(ll(P[b])), [cx, cy] = L0.xy(ll(P[ci]));
      const sec = faiSectors(ll(P[a]), ll(P[b])); if (!sec.length) return;
      const side = bx * cy - by * cx > 0 ? 0 : 1; // the sector on the corner's side of the opposite leg (left = first)
      const strong = anySel ? (selC === k || (selC < 0 && ci === 0)) : false;
      fill(sec[side].ring, strong, strong ? 'FAI area ' + plName(ci, n) : '');
    });
  }
  if (n > 1) { L.polyline(P, { color: '#FFFFFF', weight: 8, opacity: 0.8, interactive: false }).addTo(g); L.polyline(P, { color: A.kind === 'fai' ? '#16A34A' : '#111418', weight: 4, interactive: false }).addTo(g); }
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
  // compact: distance + type on one line, one detail line (shortest leg, gap, XContest points), a short hint only when needed
  const tri = A.kind === 'fai' || A.kind === 'flat', sc = plScore(P);
  const det = [tri ? `shortest leg ${Math.round(A.mn * 100)} %` : '', tri && A.gap > 50 ? `gap ${km(A.gap)}` : '', sc.pts ? `<b>${sc.pts.toFixed(1)} pts</b> XContest${sc.kind !== A.kind && !(sc.kind === 'free' && A.kind !== 'fai' && A.kind !== 'flat') ? ' as ' + XC_KIND[sc.kind] : ''}` : ''].filter(Boolean).join(' · ');
  const hint = !n ? 'Tap the map to add the start' : n === 1 ? 'Tap the map for the next point' : n <= 3 ? 'Blue: where a 3rd corner makes it FAI' : tri ? 'Blue: where each corner stays FAI' : '';
  const rows = P.map((p, i) => `<div class="plRow${i === sel ? ' sel' : ''}"><button class="plSel" data-plsel="${i}"><b>${plName(i, n)}</b><span class="muted">${i ? km(A.legs[i - 1]) : ''}</span></button><button class="btn" data-pldel="${i}" aria-label="Delete ${plName(i, n)}">✕</button></div>`).join('');
  $('plSide').innerHTML = `<div class="plHead"><span class="plBig">${n > 1 ? km(tri ? A.per : A.len) : '--'}</span><span class="plKind${A.kind === 'fai' ? ' fai' : ''}">${n > 1 ? PL_KIND[A.kind] : ''}</span></div>
    ${det ? `<div class="plDet">${det}</div>` : ''}${hint ? `<div class="plHint">${hint}</div>` : ''}
    <div class="plList">${rows}</div>
    <div class="plBtns">
      <button class="btn" id="plUndo" ${PL.hist.length ? '' : 'disabled'}>↶ Undo</button>
      <button class="btn" id="plClose" ${n >= 2 ? '' : 'disabled'}>⟲ Close</button>
      <button class="btn" id="plRev" ${n >= 2 ? '' : 'disabled'}>⇄ Reverse</button>
      <button class="btn" id="plStart">⚑ Takeoff</button>
      <button class="btn" id="plFromTask" ${st.task ? '' : 'disabled'}>My task</button>
      <button class="btn warn" id="plClear" ${n ? '' : 'disabled'}>Clear</button>
    </div>
    <div class="row plFxRow"><input type="url" id="plFxIn" class="grow" placeholder="FlyXC link…" aria-label="Paste a FlyXC link to load its route"><button class="btn" id="plFxLoad">Load</button><button class="btn" id="plCopy" ${n >= 2 ? '' : 'disabled'} aria-label="Copy as FlyXC link">Copy</button><button class="btn" id="plFx" ${n >= 2 ? '' : 'disabled'} aria-label="Open in FlyXC">FlyXC ↗</button></div>
    <button class="btn primary" id="plUse" ${n >= 2 ? '' : 'disabled'}>Use as my task</button>`;
  const q = (id, fn) => { const e = $(id); if (e) e.onclick = fn; };
  document.querySelectorAll('[data-plsel]').forEach((b) => (b.onclick = () => { const i = +b.dataset.plsel; PL.sel = PL.sel === i ? -1 : i; if (PL.sel >= 0) PL.m.panTo(P[i]); plDraw(); }));
  document.querySelectorAll('[data-pldel]').forEach((b) => (b.onclick = () => plEdit(() => { P.splice(+b.dataset.pldel, 1); PL.sel = -1; })));
  q('plUndo', () => { const h = PL.hist.pop(); if (h) { PL.pts = JSON.parse(h); PL.sel = -1; plSave(); plDraw(); } });
  q('plClose', () => plEdit(() => P.push(P[0].slice())));
  q('plRev', () => plEdit(() => P.reverse()));
  q('plStart', () => { const s0 = startPlace() || st.fix; if (!s0) { toast('No Start point or GPS position yet'); return; } plEdit(() => { if (P.length && dist(P[0][0], P[0][1], s0.lat, s0.lon) < 50) return; P.unshift([s0.lat, s0.lon]); }); PL.m.panTo([s0.lat, s0.lon]); });
  q('plFromTask', () => { plEdit(() => { PL.pts = st.task.pts.map((p) => [p.lat, p.lon]); PL.sel = -1; }); PL.m.fitBounds(L.latLngBounds(PL.pts).pad(0.3)); });
  q('plClear', () => plEdit(() => { P.length = 0; PL.sel = -1; }));
  q('plUse', () => plUseTask());
  const fxLoad = (t) => { const m0 = String(t || '').match(/https?:\/\/(?:www\.)?flyxc\.app\/?\S*/i); let p = null; try { p = m0 && new URL(m0[0]).searchParams.get('p'); } catch (e) { }
    if (!p) { toast('No FlyXC route in that link'); return false; } const pts = decodePolyline(p); if (pts.length < 2) { toast('That route has fewer than 2 points'); return false; }
    plEdit(() => { PL.pts = pts.map((q0) => [+q0[0].toFixed(6), +q0[1].toFixed(6)]); PL.sel = -1; }); PL.m.fitBounds(L.latLngBounds(PL.pts).pad(0.3)); toast(`FlyXC route loaded · ${pts.length} points`); return true; };
  q('plFxLoad', async () => { let t = $('plFxIn').value; if (!t && navigator.clipboard?.readText) { try { t = await navigator.clipboard.readText(); } catch (e) { } } fxLoad(t); });
  { const i0 = $('plFxIn'); if (i0) i0.oninput = () => { if (/flyxc\.app\/?\S*[?&]p=/i.test(i0.value)) fxLoad(i0.value); }; }
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
