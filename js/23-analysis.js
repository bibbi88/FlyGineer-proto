'use strict';
/* ================= flight analysis (a logbook flight) =================
   openAnalysis(id): full-screen pane #anaPane over everything: key figures, a map with the track coloured by climb, the thermals numbered and the
   XC score route, a height/vario chart over time (thermals shaded; touching the chart moves a marker on the map), and tables of thermals and glides.
   segFlight(P) splits the track: circling = heading turning > 8 °/s on average over 20 s for at least 30 s, of which the climbing part (lowest to highest point, ≥ 30 m) is the thermal; the rest glides; per thermal
   time, gain, average climb, top; per glide distance, time, speed, glide ratio. */
const AV = (p) => p[4] ?? p[3];
function segFlight(P) {
  const n = P.length, hd = new Array(n).fill(null), turn = new Array(n).fill(0);
  for (let i = 2; i < n; i++) { const a = P[i - 2], b = P[i]; if (dist(a[1], a[2], b[1], b[2]) > 3) hd[i] = brg(a[1], a[2], b[1], b[2]); }
  for (let i = 1; i < n; i++) { let j = i - 1; while (j > 0 && hd[j] == null) j--; if (hd[i] != null && hd[j] != null) turn[i] = angDiff(hd[j], hd[i]) / Math.max(1, (P[i][0] - P[j][0]) / 1000); }
  const circ = new Array(n).fill(false); let sum = 0; const W = 20;
  for (let i = 0; i < n; i++) { sum += Math.abs(turn[i]); if (i >= W) sum -= Math.abs(turn[i - W]); circ[i] = i >= W && sum / W > 8; }
  const T = []; let s = -1;
  for (let i = 0; i <= n; i++) { const c = i < n && circ[i]; if (c && s < 0) s = Math.max(0, i - W); if (!c && s >= 0) { const e = i - 1; if ((P[e][0] - P[s][0]) / 1000 >= 30) T.push([s, e]); s = -1; } }
  // merge thermals less than 30 s apart
  for (let k = T.length - 1; k > 0; k--) if ((P[T[k][0]][0] - P[T[k - 1][1]][0]) / 1000 < 30) { T[k - 1][1] = T[k][1]; T.splice(k, 1); }
  // each circling stretch keeps only its climbing part (lowest point before the highest point); circling without 30 m gain is no thermal
  const T2 = T.map(([a, b]) => { let lo = a, best = [a, a, 0]; for (let i = a; i <= b; i++) { const h = AV(P[i]); if (h == null) continue; if (AV(P[lo]) == null || h < AV(P[lo])) lo = i; const g = h - AV(P[lo]); if (g > best[2]) best = [lo, i, g]; } return best; }).filter((x) => x[2] >= 30).map(([a, b]) => [a, b]);
  T.length = 0; T.push(...T2);
  const therms = T.map(([a, b], k) => { let top = -1e9, la = 0, lo = 0; for (let i = a; i <= b; i++) { if (AV(P[i]) != null) top = Math.max(top, AV(P[i])); la += P[i][1]; lo += P[i][2]; } const g = (AV(P[b]) ?? 0) - (AV(P[a]) ?? 0), dur = (P[b][0] - P[a][0]) / 1000; return { k: k + 1, a, b, t0: P[a][0], dur, gain: g, avg: dur > 0 ? g / dur : 0, top, lat: la / (b - a + 1), lon: lo / (b - a + 1) }; });
  const glides = []; let prev = 0; therms.concat([{ a: n - 1 }]).forEach((t) => { const a = prev, b = t.a; if (b - a > 20) { let d = 0; for (let i = a + 1; i <= b; i++) d += dist(P[i - 1][1], P[i - 1][2], P[i][1], P[i][2]); const dur = (P[b][0] - P[a][0]) / 1000, lost = (AV(P[a]) ?? 0) - (AV(P[b]) ?? 0); glides.push({ a, b, t0: P[a][0], d, dur, spd: dur > 0 ? d / dur : 0, ld: lost > 5 ? d / lost : null, sink: dur > 0 ? -lost / dur : 0 }); } prev = t.b != null ? t.b : prev; });
  return { therms, glides };
}
function varioOf(P, i, w = 5) { let j = i; while (j > 0 && P[i][0] - P[j][0] < w * 1000) j--; const a = AV(P[j]), b = AV(P[i]), dt = (P[i][0] - P[j][0]) / 1000; return a != null && b != null && dt > 0 ? (b - a) / dt : 0; }
let anaMap = null;
async function openAnalysis(id) {
  const F = REC.cur && REC.cur.id === id ? REC.cur : await logGet(id); if (!F || F.pts.length < 30) { toast('Too few points to analyse'); return; }
  const P = F.pts, sx = flightStats(P), seg = segFlight(P), sc = trackScore(P.map((p) => [p[1], p[2]])), tm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let pane = $('anaPane'); if (!pane) { pane = document.createElement('div'); pane.id = 'anaPane'; document.body.appendChild(pane); }
  const A = (m) => (m == null ? '--' : fAlt(m) + ' ' + S.uAlt), box = (l, v, s) => statBox(l, v, s);
  const totT = seg.therms.reduce((a, t) => a + t.dur, 0), avgT = totT > 0 ? seg.therms.reduce((a, t) => a + t.gain, 0) / totT : null;
  pane.innerHTML = `<div class="anaHead"><span class="num" style="font-size:24px">${esc(flightTitle(F))}</span><span class="row"><button class="btn" id="anaIgc">⬇ IGC</button><button class="btn primary" id="anaClose">Close</button></span></div>
    <div class="anaBody"><div class="wgrid anaStats">${box('Flight time', fDur(sx.dur), tm(F.t0) + ' – ' + tm(F.t1))}${box('Max height', A(sx.maxA), 'gain ' + A(sx.gain))}${box('Farthest', fDist(sx.far || 0), 'track ' + fDist(sx.len || 0))}${box('XC score', sc.best ? sc.best.pts.toFixed(1) + ' pts' : '--', sc.best ? SCORE_NAME[sc.best.kind] + ' ' + sc.best.km.toFixed(1) + ' km' : '')}${box('Thermals', seg.therms.length, avgT != null ? 'average ' + fVario(avgT) + ' ' + S.uVario + ' · ' + fDur(totT) : '')}${box('Best climb', sx.climb ? fVario(sx.climb) + ' ' + S.uVario : '--', F.gMax ? 'max ' + F.gMax.toFixed(1) + ' G' : '20 s')}</div>
    <div class="anaRow"><div id="anaMap" class="anaMap"></div><div class="anaChartBox"><canvas id="anaChart"></canvas><div class="muted" id="anaCur">Touch the chart to see that moment on the map.</div></div></div>
    <div class="anaRow"><div class="anaTbl"><h3>Thermals</h3><table><tr class="muted"><th>#</th><th>Start</th><th>Time</th><th>Gain</th><th>Average</th><th>Top</th></tr>${seg.therms.map((t) => `<tr data-ana="${t.a}"><td><b>${t.k}</b></td><td>${tm(t.t0)}</td><td>${fDur(t.dur).replace(/^0:/, '') + (t.dur < 3600 ? ' min' : '')}</td><td>${A(t.gain)}</td><td>${fVario(t.avg)} ${S.uVario}</td><td>${A(t.top)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">no thermals found</td></tr>'}</table></div>
    <div class="anaTbl"><h3>Glides</h3><table><tr class="muted"><th>Start</th><th>Distance</th><th>Speed</th><th>L/D</th><th>Sink</th></tr>${seg.glides.map((g) => `<tr data-ana="${g.a}"><td>${tm(g.t0)}</td><td>${fDist(g.d)}</td><td>${fSpd(g.spd)} ${S.uSpd}</td><td>${g.ld ? g.ld.toFixed(1) : '--'}</td><td>${fVario(g.sink)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">none</td></tr>'}</table></div></div>
    <div class="muted" style="margin:8px 0 20px">Thermals = circling for at least 30 s. The score is the XContest way, on a thinned track; this file is unsigned, so XContest gives it no points.</div></div>`;
  pane.style.display = 'flex';
  $('anaClose').onclick = () => { pane.style.display = 'none'; if (anaMap) { anaMap.remove(); anaMap = null; } };
  $('anaIgc').onclick = () => logDownload(id);
  // map
  if (anaMap) { anaMap.remove(); anaMap = null; }
  const m = anaMap = L.map('anaMap', { zoomControl: true, attributionControl: true }), Ls = LAYERS[S.layer] || LAYERS.topo;
  (Ls.mk ? Ls.mk() : L.tileLayer(Ls.url || Ls, Ls.o || {})).addTo(m);
  const col = (v) => (v >= 2.5 ? '#C2410C' : v >= 1.5 ? '#EA7A12' : v >= 0.5 ? '#F2C200' : v > -0.5 ? '#6B7280' : '#1E50C8');
  let run = [], rc = null; const step = Math.max(1, Math.floor(P.length / 1500));
  for (let i = 0; i < P.length; i += step) { const c = col(varioOf(P, i, 10)); const pt = [P[i][1], P[i][2]]; if (c !== rc && run.length) { run.push(pt); L.polyline(run, { color: rc, weight: 4, opacity: 0.95 }).addTo(m); run = []; } rc = c; run.push(pt); }
  if (run.length > 1) L.polyline(run, { color: rc, weight: 4 }).addTo(m);
  seg.therms.forEach((t) => L.marker([t.lat, t.lon], { icon: L.divIcon({ className: '', html: `<span class="anaT">${t.k}</span>`, iconSize: [0, 0] }) }).bindTooltip(`Thermal ${t.k}: +${fAlt(t.gain)} ${S.uAlt} at ${fVario(t.avg)} ${S.uVario}`).addTo(m));
  if (sc.best) { const line = sc.best.kind === 'free' ? sc.best.path : sc.best.tri.concat([sc.best.tri[0]]); L.polyline(line, { color: '#7B1FA2', weight: 2.5, dashArray: '8 6' }).addTo(m); }
  L.circleMarker([P[0][1], P[0][2]], { radius: 7, color: '#fff', weight: 2, fillColor: '#2E7D4F', fillOpacity: 1 }).bindTooltip('Takeoff').addTo(m);
  L.circleMarker([P[P.length - 1][1], P[P.length - 1][2]], { radius: 7, color: '#fff', weight: 2, fillColor: '#B42318', fillOpacity: 1 }).bindTooltip('Landing').addTo(m);
  const cur = L.circleMarker([P[0][1], P[0][2]], { radius: 9, color: '#111', weight: 3, fillColor: '#fff', fillOpacity: 1 });
  m.fitBounds(L.latLngBounds(P.map((p) => [p[1], p[2]])).pad(0.08));
  // chart
  const cv = $('anaChart'), draw = (sel) => {
    const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H); const t0 = P[0][0], t1 = P[P.length - 1][0], al = P.map(AV).filter((x) => x != null), lo = Math.min(...al), hi = Math.max(...al), L0 = 44, X = (t) => L0 + (t - t0) / (t1 - t0) * (Wd - L0 - 6), Hh = H * 0.68, Y = (a) => 8 + (hi - a) / Math.max(1, hi - lo) * (Hh - 16);
    c.fillStyle = 'rgba(234,122,18,.14)'; seg.therms.forEach((t) => c.fillRect(X(P[t.a][0]), 0, Math.max(2, X(P[t.b][0]) - X(P[t.a][0])), Hh));
    c.strokeStyle = css('--line'); c.fillStyle = css('--muted'); c.font = '11px Barlow'; c.textAlign = 'right'; const as = niceStep((hi - lo) / 4 || 100); for (let a = Math.ceil(lo / as) * as; a <= hi; a += as) { c.beginPath(); c.moveTo(L0, Y(a)); c.lineTo(Wd, Y(a)); c.stroke(); c.fillText(fAlt(a), L0 - 3, Y(a) + 4); }
    c.strokeStyle = css('--ink'); c.lineWidth = 1.6; c.beginPath(); let f = true; for (let i = 0; i < P.length; i += step) { const a = AV(P[i]); if (a == null) continue; f ? c.moveTo(X(P[i][0]), Y(a)) : c.lineTo(X(P[i][0]), Y(a)); f = false; } c.stroke();
    const vb = Hh + 6, vh = H - vb - 14, V0 = vb + vh / 2, vs = vh / 2 / 4; c.strokeStyle = css('--line'); c.beginPath(); c.moveTo(L0, V0); c.lineTo(Wd, V0); c.stroke();
    const bins = Math.min(400, Wd - L0); for (let k = 0; k < bins; k++) { const i = Math.floor(k / bins * (P.length - 1)), v = clamp(varioOf(P, i, 10), -4, 4); c.fillStyle = v >= 0 ? col(v) : '#1E50C8'; const x = L0 + k / bins * (Wd - L0 - 6); c.fillRect(x, v >= 0 ? V0 - v * vs : V0, Math.max(1, (Wd - L0) / bins), Math.abs(v) * vs); }
    c.fillStyle = css('--muted'); c.textAlign = 'right'; c.fillText('+4', L0 - 3, vb + 8); c.fillText('−4', L0 - 3, vb + vh); c.textAlign = 'center'; for (let k = 0; k <= 4; k++) { const t = t0 + (t1 - t0) * k / 4; c.fillText(tm(t), X(t), H - 2); }
    if (sel != null) { const x = X(P[sel][0]); c.strokeStyle = '#C62828'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H - 14); c.stroke(); }
    cv._X = (px) => { const t = t0 + (px - L0) / (Wd - L0 - 6) * (t1 - t0); let i = 0; while (i < P.length - 1 && P[i][0] < t) i++; return i; };
  };
  const pick = (i) => { i = clamp(i, 0, P.length - 1); draw(i); cur.setLatLng([P[i][1], P[i][2]]).addTo(m); $('anaCur').textContent = `${tm(P[i][0])} · ${A(AV(P[i]))} · ${fVario(varioOf(P, i, 10))} ${S.uVario} (10 s)`; };
  const pe = (e) => { const r = cv.getBoundingClientRect(); pick(cv._X(e.clientX - r.left)); };
  cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); pe(e); }; cv.onpointermove = (e) => { if (e.buttons) pe(e); };
  pane.querySelectorAll('[data-ana]').forEach((r) => (r.onclick = () => pick(+r.dataset.ana)));
  requestAnimationFrame(() => { m.invalidateSize(); draw(null); });
}
