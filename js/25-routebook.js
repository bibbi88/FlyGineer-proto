'use strict';
/* ================= route book: follow someone else's flight and their advice =================
   A route book = a reference flight (IGC or GPX, thinned to one point per 5 s: [t, lat, lon, alt]) + notes along it ({id, t, lat, lon, alt, text, kind
   'auto' | 'own', r m}). Auto notes come from 23 segFlight: each thermal (where, climb, top) and each glide after it (leave height, distance, direction,
   L/D). Own notes: typed in the editor, or pasted as "mm:ss text" / "h:mm:ss text" video timestamps, placed by "video time at takeoff" (works while the
   video runs at real speed; each note can be moved along the track by ±10 s / ±1 min afterwards). Stored in localStorage bora.rbs (list, max 8) and
   S.rbActive. In flight: your nearest point on the reference track (searched near the last match) gives the reference height there; the next note ahead is
   the first one later on the track; within its radius (S.rbR, 800 m) it is spoken once (voice messages on). Widget `rbnext`, map option `rb`. */
const RB = { list: [], cur: null, idx: 0, said: new Set() };
function rbLoad() { try { RB.list = JSON.parse(localStorage.getItem('bora.rbs') || '[]'); } catch (e) { RB.list = []; } RB.cur = RB.list.find((b) => b.id === S.rbActive) || null; RB.idx = 0; RB.said = new Set(); }
function rbSave() { try { localStorage.setItem('bora.rbs', JSON.stringify(RB.list.slice(0, 8))); } catch (e) { toast('Route books: storage full (' + e.message + ')'); } st.rbVer = (st.rbVer || 0) + 1; markDirty(); }
function rbSetActive(id) { S.rbActive = id; save(); RB.cur = RB.list.find((b) => b.id === id) || null; RB.idx = 0; RB.said = new Set(); st.rbVer = (st.rbVer || 0) + 1; markDirty(); }
function parseGPX(txt) {
  const x = new DOMParser().parseFromString(txt, 'text/xml'), pts = [];
  [...x.getElementsByTagNameNS('*', 'trkpt')].forEach((p) => { const t = Date.parse((p.getElementsByTagNameNS('*', 'time')[0] || {}).textContent || ''), e = parseFloat((p.getElementsByTagNameNS('*', 'ele')[0] || {}).textContent); if (isFinite(t)) pts.push({ t, lat: +p.getAttribute('lat'), lon: +p.getAttribute('lon'), alt: isFinite(e) ? e : null }); });
  if (pts.length < 10) throw new Error('no track points with times found'); return { pts, hdr: {} };
}
// a reference flight from IGC/GPX text: thinned points [t, lat, lon, alt] and the automatic notes
function rbFromTrack(txt, name) {
  const I = /^\s*</.test(txt) ? parseGPX(txt) : parseIGC(txt), raw = I.pts, launch = replayLaunch(raw);
  const P = []; raw.forEach((p) => { const a = p.valt ?? p.alt; if (!P.length || p.t - P[P.length - 1][0] >= 5000) P.push([p.t, +p.lat.toFixed(5), +p.lon.toFixed(5), a != null ? Math.round(a) : null]); });
  const seg = segFlight(P.map((p) => [p[0], p[1], p[2], p[3], p[3]])), notes = [], id = () => 'n' + Math.random().toString(36).slice(2, 9), A = (m) => Math.round(m) + ' m';
  const ti = P.findIndex((p) => dist(p[1], p[2], launch[0], launch[1]) < 50) ; const t0 = P[Math.max(0, ti)][0];
  notes.push({ id: id(), kind: 'auto', t: t0, lat: P[Math.max(0, ti)][1], lon: P[Math.max(0, ti)][2], alt: P[Math.max(0, ti)][3], text: 'Takeoff' + (I.hdr && I.hdr.pilot ? ' · reference pilot ' + I.hdr.pilot : '') });
  // thermals with at least S.rbMinGain m (100) become notes; each "leave" note measures the glide to the next such thermal (or the landing)
  const K = seg.therms.filter((t) => t.gain >= sN('rbMinGain', 100));
  K.forEach((t, k) => {
    const pa = P[t.a], pb = P[t.b], nx = K[k + 1], pe = nx ? P[nx.a] : P[P.length - 1], d = dist(pb[1], pb[2], pe[1], pe[2]), b = brg(pb[1], pb[2], pe[1], pe[2]), lost = (pb[3] ?? 0) - (pe[3] ?? 0);
    notes.push({ id: id(), kind: 'auto', t: pa[0], lat: t.lat, lon: t.lon, alt: pa[3], text: `Thermal ${k + 1}: from ${A(pa[3])} up to ${A(t.top)} (+${Math.round(t.gain)} m, average ${t.avg.toFixed(1)} m/s, ${Math.max(1, Math.round(t.dur / 60))} min)` });
    notes.push({ id: id(), kind: 'auto', t: pb[0], lat: pb[1], lon: pb[2], alt: pb[3], text: `Leave at ${A(pb[3])}: ${(d / 1000).toFixed(1)} km ${COMPASS16[Math.round(b / 22.5) % 16]} to ${nx ? 'the next thermal' : 'the landing'}${lost > 20 ? ' (L/D ' + (d / lost).toFixed(0) + ')' : ''}, arrive ${A(pe[3])}` });
  });
  const L0 = P[P.length - 1]; notes.push({ id: id(), kind: 'auto', t: L0[0], lat: L0[1], lon: L0[2], alt: L0[3], text: 'Landing of the reference flight' });
  notes.forEach((n) => (n.r = 800));
  return { id: 'rb' + Date.now().toString(36), name: name || 'Route book', pilot: I.hdr && I.hdr.pilot || '', glider: I.hdr && I.hdr.glider || '', t0, pts: P, notes: notes.sort((a, b) => a.t - b.t), vTo: null };
}
// track point at time t (nearest index)
function rbAt(B, t) { const P = B.pts; let lo = 0, hi = P.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] < t) lo = m; else hi = m; } return Math.abs(P[lo][0] - t) <= Math.abs(P[hi][0] - t) ? lo : hi; }
const vSec = (s) => { const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(String(s).trim()); return m ? (+(m[1] || 0)) * 3600 + +m[2] * 60 + +m[3] : null; };
// video time → flight time: piecewise through the sync points B.anchors [[video s, flight ms]] (edited videos), else takeoff + (video − B.vTo)
function rbVideoT(B, s) {
  const A = (B.anchors || []).slice().sort((a, b) => a[0] - b[0]); if (A.length >= 2) { if (s <= A[0][0]) return A[0][1]; for (let i = 1; i < A.length; i++) if (s <= A[i][0]) { const [s0, t0] = A[i - 1], [s1, t1] = A[i]; return t0 + (t1 - t0) * (s - s0) / Math.max(1, s1 - s0); } return A[A.length - 1][1]; }
  return B.vTo != null ? B.t0 + (s - B.vTo) * 1000 : null;
}
// pasted lines: "12:34 text" → a note where the pilot was at that video moment; "sync 10:56 = 15:42" → a sync point (video m:ss = flight time UTC hh:mm)
function rbPaste(B, text) {
  let n = 0;
  text.split(/\r?\n/).forEach((l) => { const sy = /^\s*sync\s+((?:\d+:)?\d{1,2}:\d{2})\s*=\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/i.exec(l); if (!sy) return; const d = new Date(B.t0); const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), +sy[2], +sy[3], +(sy[4] || 0)); (B.anchors = B.anchors || []).push([vSec(sy[1]), t]); });
  if (rbVideoT(B, 0) == null) { toast('Set the video time at takeoff (or sync points) first'); return 0; }
  text.split(/\r?\n/).forEach((l) => { if (/^\s*sync\s/i.test(l)) return; const m = /^\s*\[?((?:\d+:)?\d{1,2}:\d{2})\]?\s*[-–:·]?\s*(.+)$/.exec(l); if (!m) return; const s = vSec(m[1]); if (s == null) return; const t = rbVideoT(B, s), i = rbAt(B, t), p = B.pts[i];
    B.notes.push({ id: 'n' + Math.random().toString(36).slice(2, 9), kind: 'own', t: p[0], lat: p[1], lon: p[2], alt: p[3], text: m[2].trim().slice(0, 300), r: sN('rbR', 800), v: s }); n++; });
  B.notes.sort((a, b) => a.t - b.t); return n;
}
/* in flight: where you are along the reference flight */
function rbWhere() {
  const B = RB.cur, f = st.fix; if (!B || !f) return null; const P = B.pts; let best = -1, bd = Infinity;
  const scan = (a, b) => { for (let i = Math.max(0, a); i < Math.min(P.length, b); i++) { const d = dist(f.lat, f.lon, P[i][1], P[i][2]); if (d < bd) { bd = d; best = i; } } };
  scan(RB.idx - 60, RB.idx + 400); if (bd > 3000) scan(0, P.length); if (best < 0) return null; RB.idx = best;
  const p = P[best], next = B.notes.find((n) => (n.kind !== 'auto' || S.rbAuto !== false) && n.t > p[0] - 20000 && !(RB.said.has(n.id) && n.t < p[0])) || null, a = altNow();
  return { i: best, off: bd, ref: p, dAlt: a != null && p[3] != null ? a - p[3] : null, next, nd: next ? dist(f.lat, f.lon, next.lat, next.lon) : null };
}
setInterval(() => {
  const w = RB.cur && st.fix ? rbWhere() : null; if (!w || !w.next) return; const n = w.next;
  if (w.nd < (n.r || sN('rbR', 800)) && !RB.said.has(n.id)) { RB.said.add(n.id); if (S.voice && S.vcRb !== false) say(n.text, false); toast('📖 ' + n.text); }
}, 3000);
function rbWData(W) {
  const B = RB.cur; if (!B) return { l: 'Route book', v: '--', s: 'load one: Settings → Route book' };
  const w = rbWhere(); if (!w) return { l: 'Route book · ' + B.name, v: '--', s: 'waiting for GPS' };
  const far = w.off > 2000, dA = w.dAlt == null ? '' : (w.dAlt >= 0 ? '+' : '−') + fAlt(Math.abs(w.dAlt)) + ' ' + S.uAlt + ' vs reference';
  if (!w.next) return { l: 'Route book · ' + B.name, v: '✓', s: 'no more notes · ' + dA };
  return { l: (far ? 'Route book · ' + fDist(w.off) + ' off the route' : 'Next advice · ' + fDist(w.nd)), html: `<div class="ws" style="font-size:17px;line-height:1.25;color:var(--ink);white-space:normal">${esc(w.next.text)}</div><div class="ws">${dA}${w.next.alt != null ? ' · reference there ' + fAlt(w.next.alt) + ' ' + S.uAlt : ''}</div>` };
}
function rbListHTML() {
  const B = RB.cur; if (!B) return '<div class="muted">No route book active.</div>'; const w = rbWhere(), cur = w ? w.ref[0] : 0;
  return B.notes.map((n, k) => `<div class="li" style="justify-content:space-between;gap:10px;min-height:44px${cur && n.t < cur ? ';opacity:.5' : ''}"><span><b>${k + 1}.</b> ${esc(n.text)}</span><span class="muted" style="white-space:nowrap">${n.alt != null ? fAlt(n.alt) + ' ' + S.uAlt : ''}${st.fix ? ' · ' + fDist(dist(st.fix.lat, st.fix.lon, n.lat, n.lon)) : ''}</span></div>`).join('');
}
/* map: the reference track (thin, orange) and the notes as numbered flags (the next one highlighted) */
function drawRbInto(I, C) {
  if (!I.g.rb) I.g.rb = L.layerGroup().addTo(I.m); const g = I.g.rb, B = RB.cur, on = C.rb !== false && C.rb !== 'false';
  if (!on || !B) { if (I.rbK) { g.clearLayers(); I.rbK = null; } return; }
  const w = st.fix ? rbWhere() : null, nx = w && w.next ? w.next.id : '', k = B.id + '|' + st.rbVer + '|' + nx; if (I.rbK === k) return; I.rbK = k; g.clearLayers();
  L.polyline(B.pts.map((p) => [p[1], p[2]]), { color: '#fff', weight: 5, opacity: 0.6, interactive: false }).addTo(g);
  L.polyline(B.pts.map((p) => [p[1], p[2]]), { color: '#E8590C', weight: 2.5, dashArray: '6 5', interactive: false }).addTo(g);
  B.notes.forEach((n, i) => { if (n.kind === 'auto' && S.rbAuto === false) return; const mk = L.marker([n.lat, n.lon], { icon: L.divIcon({ className: '', html: `<span class="rbFlag${n.id === nx ? ' next' : ''}">${i + 1}</span>`, iconSize: [0, 0] }), interactive: true, zIndexOffset: n.id === nx ? 600 : 350 }).addTo(g);
    mk.on('click', (e) => { L.DomEvent.stopPropagation(e); st.tapGuard = Date.now(); openInfo('Note ' + (i + 1), () => `<div style="font-size:19px;line-height:1.35">${esc(n.text)}</div><div class="muted" style="margin-top:8px">Reference height here ${n.alt != null ? fAlt(n.alt) + ' ' + S.uAlt : '--'} · ${new Date(n.t).toISOString().slice(11, 16)} UTC on the reference flight${n.kind === 'own' ? ' · your note' : ''}</div>`); }); });
}
/* Settings → Route book */
function rbSecHTML() {
  const B = RB.cur, fmtV = (s) => s == null ? '' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  let h = `<div class="card sec"><h2>Route book</h2><div class="muted">Fly someone else's flight with their advice: load their tracklog (IGC or GPX). The app finds their thermals and glides and turns them into notes along the route (where, how high, when they left). Add the video's advice as your own notes. In flight the Route advice widget shows the next note and your height against theirs, maps show the route and the notes, and each note is spoken once as you reach it (with voice messages on).</div>
    <div class="field"><label for="rbFile">Load a tracklog (IGC / GPX)</label><input type="file" id="rbFile" accept=".igc,.IGC,.gpx,.GPX,text/plain,application/gpx+xml" style="min-height:48px"></div>
    ${RB.list.length ? `<div class="field"><span class="k">Route books</span><span class="row" style="flex-wrap:wrap">${RB.list.map((b) => `<button class="pill" data-rbon="${b.id}" aria-pressed="${B && B.id === b.id}">${esc(b.name)}</button>`).join('')}<button class="pill" data-rbon="" aria-pressed="${!B}">None</button></span></div>` : ''}
    ${seg('rbAuto', [[true, 'Show'], [false, 'Hide']], 'Automatic thermal and glide notes')}${numField('rbR', 'how close a note counts as reached')}${numField('rbMinGain', 'gain; smaller climbs are left out')}${seg('vcRb', [[true, 'On'], [false, 'Off']], 'Speak the notes (with voice messages on)')}</div>`;
  if (!B) return h;
  h += `<div class="card sec"><h2>${esc(B.name)}</h2><div class="muted">${B.pilot ? esc(B.pilot) + ' · ' : ''}${B.glider ? esc(B.glider) + ' · ' : ''}${new Date(B.t0).toLocaleDateString()} · ${B.pts.length} points · ${B.notes.length} notes</div>
    <div class="field"><label for="rbName">Name</label><input type="text" id="rbName" maxlength="40" value="${esc(B.name)}"></div>
    <h2 style="margin-top:10px">Advice from the video</h2><div class="muted">Find the moment of takeoff in the video and type its video time. Then paste lines like <b>12:34 Leave the ridge at 1500 m, head for the village</b>: each becomes a note where the pilot was at that moment. If the video is cut or sped up, add sync points: lines like <b>sync 10:56 = 15:42</b> (video time = flight time UTC) between which notes are spread, or move a note along the route with the ◀ ▶ buttons.${(B.anchors || []).length ? ` · ${B.anchors.length} sync points <button class="btn" id="rbClrSync">Clear sync points</button>` : ''}</div>
    <div class="field"><label for="rbVto">Video time at takeoff (m:ss)</label><input type="text" id="rbVto" inputmode="numeric" placeholder="e.g. 1:05" value="${fmtV(B.vTo)}" style="max-width:160px"></div>
    <div class="field" style="align-items:flex-start"><label for="rbPaste">Video notes</label><textarea id="rbPaste" rows="5" style="flex:1;min-width:220px;font-size:16px" placeholder="12:34 Leave at 1500 m towards the antenna&#10;18:02 Strong core on the sunny side"></textarea></div>
    <div class="field"><span class="k"></span><button class="btn primary" id="rbAdd">Add these notes</button></div>
    <h2 style="margin-top:10px">Notes</h2>
    ${B.notes.map((n, i) => `<div class="li" style="flex-wrap:wrap;gap:6px;min-height:52px"><span style="flex:1;min-width:240px"><b>${i + 1}.</b> ${esc(n.text)}<br><span class="muted">${new Date(n.t).toISOString().slice(11, 19)} UTC${n.v != null ? ' · video ' + fmtV(n.v) : ''} · ref ${n.alt != null ? fAlt(n.alt) + ' ' + S.uAlt : '--'}${n.kind === 'auto' ? ' · automatic' : ''}</span></span><span class="row"><button class="btn" data-rbmv="${n.id}" data-d="-60">◀◀</button><button class="btn" data-rbmv="${n.id}" data-d="-10">◀</button><button class="btn" data-rbmv="${n.id}" data-d="10">▶</button><button class="btn" data-rbmv="${n.id}" data-d="60">▶▶</button><button class="btn" data-rbed="${n.id}">Edit</button><button class="btn warn" data-rbdel="${n.id}">✕</button></span></div>`).join('')}
    <div class="field"><span class="k"></span><span class="row"><button class="btn" id="rbExp">Export</button><button class="btn" id="rbReplay">▶ Replay the reference flight</button><button class="btn warn" id="rbRemove">Remove this route book</button></span></div>
    <div class="field"><label for="rbImp">Import a route book (.json)</label><input type="file" id="rbImp" accept=".json,application/json" style="min-height:48px"></div></div>`;
  return h;
}
function rbWire(on) {
  const B = RB.cur, redo = () => { rbSave(); renderSettings(); };
  on('rbFile', 'onchange', async (e) => { const fl = e.target.files[0]; if (!fl) return; try { const nb = rbFromTrack(await fl.text(), fl.name.replace(/\.(igc|gpx)$/i, '')); RB.list.unshift(nb); rbSave(); rbSetActive(nb.id); renderSettings(); toast(`Route book made · ${nb.notes.length} notes from the flight`); } catch (err) { toast('Could not read the tracklog: ' + err.message); } e.target.value = ''; });
  on('rbImp', 'onchange', async (e) => { const fl = e.target.files[0]; if (!fl) return; try { const nb = JSON.parse(await fl.text()); if (!Array.isArray(nb.pts) || !Array.isArray(nb.notes)) throw new Error('not a route book'); nb.id = 'rb' + Date.now().toString(36); RB.list.unshift(nb); rbSave(); rbSetActive(nb.id); renderSettings(); } catch (err) { toast('Could not read: ' + err.message); } e.target.value = ''; });
  document.querySelectorAll('[data-rbon]').forEach((b) => (b.onclick = () => { rbSetActive(b.dataset.rbon || null); renderSettings(); }));
  if (!B) return;
  on('rbName', 'onchange', (e) => { B.name = e.target.value.trim() || B.name; redo(); });
  on('rbVto', 'onchange', (e) => { const s = vSec(e.target.value); if (s == null && e.target.value.trim()) { toast('Use m:ss, e.g. 1:05'); return; } B.vTo = s; rbSave(); });
  on('rbClrSync', 'onclick', () => { const old = B.anchors; B.anchors = []; redo(); toast('Sync points cleared', [['Undo', () => { B.anchors = old; redo(); }]]); });
  on('rbAdd', 'onclick', () => { const n = rbPaste(B, $('rbPaste').value); if (n) { redo(); toast(n + ' notes added'); } else if (B.vTo != null) toast('No lines like "12:34 text" found'); });
  document.querySelectorAll('[data-rbmv]').forEach((b) => (b.onclick = () => { const n = B.notes.find((x) => x.id === b.dataset.rbmv); if (!n) return; const p = B.pts[rbAt(B, n.t + +b.dataset.d * 1000)]; Object.assign(n, { t: p[0], lat: p[1], lon: p[2], alt: p[3] }); B.notes.sort((a, c) => a.t - c.t); redo(); }));
  document.querySelectorAll('[data-rbed]').forEach((b) => (b.onclick = () => { const n = B.notes.find((x) => x.id === b.dataset.rbed); if (!n) return; const t = prompt('Note', n.text); if (t != null && t.trim()) { n.text = t.trim().slice(0, 300); n.kind = 'own'; redo(); } }));
  document.querySelectorAll('[data-rbdel]').forEach((b) => (b.onclick = () => { const old = B.notes.slice(); B.notes = B.notes.filter((x) => x.id !== b.dataset.rbdel); redo(); toast('Note removed', [['Undo', () => { B.notes = old; redo(); }]]); }));
  on('rbExp', 'onclick', () => downloadJSON(B, (B.name || 'route-book').replace(/[^\w-]+/g, '_') + '.routebook.json'));
  on('rbReplay', 'onclick', () => { const I = { pts: B.pts.map((p) => ({ t: p[0], lat: p[1], lon: p[2], alt: p[3], valt: p[3], galt: p[3], palt: p[3] })), hdr: {} }; startReplay(I, B.name); showPage('pMap'); });
  on('rbRemove', 'onclick', () => { const old = RB.list.slice(), act = S.rbActive; RB.list = RB.list.filter((x) => x.id !== B.id); rbSave(); rbSetActive(null); renderSettings(); toast('Route book removed', [['Undo', () => { RB.list = old; rbSave(); rbSetActive(act); renderSettings(); }]]); });
}
rbLoad();
