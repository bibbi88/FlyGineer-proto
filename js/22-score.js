'use strict';
/* ================= XContest-style score of the flown track =================
   trackScore(P [[lat, lon], …]) the way XContest's world rules score a paraglider flight (approximately: the track is thinned to ~250 points for free
   distance and ~120 for triangles, so results can be a little under XContest's own): free distance over up to 3 turnpoints (5 points in order) ×1.0;
   triangles: 3 corners in order, closing gap = the closest pair of points before the 1st and after the 3rd corner, allowed up to 20 % of the perimeter,
   distance = perimeter − gap; flat ×1.2, FAI (every leg ≥ 28 %) ×1.4. Returns the best of each kind and the overall best (with the points used).
   Live (scoreLive, every 20 s while flying or replaying, from st.log), the widget `xcscore`, map option `scoreLine`, and each logbook flight (F.score). */
function thin(P, n) { if (P.length <= n) return P.slice(); const out = []; for (let i = 0; i < n; i++) out.push(P[Math.round(i * (P.length - 1) / (n - 1))]); return out; }
function trackScore(P0) {
  const res = { free: null, flat: null, fai: null, best: null }; if (!P0 || P0.length < 5) return res;
  // free distance: dynamic programming over 4 legs
  { const P = thin(P0, 250), n = P.length, d = (i, j) => dist(P[i][0], P[i][1], P[j][0], P[j][1]); let row = new Array(n).fill(0), from = [];
    for (let k = 1; k <= 4; k++) { const nx = new Array(n).fill(-Infinity), fr = new Array(n).fill(-1);
      for (let j = 1; j < n; j++) for (let i = 0; i < j; i++) if (row[i] > -Infinity) { const v = row[i] + d(i, j); if (v > nx[j]) { nx[j] = v; fr[j] = i; } }
      from.push(fr); row = nx; }
    let bj = 0; row.forEach((v, j) => { if (v > row[bj]) bj = j; }); const idx = [bj]; for (let k = 3; k >= 0; k--) idx.unshift(from[k][idx[0]]);
    if (row[bj] > 0) res.free = { kind: 'free', km: row[bj] / 1000, pts: row[bj] / 1000, path: idx.filter((i) => i >= 0).map((i) => P[i]) }; }
  // triangles
  { const P = thin(P0, 120), n = P.length, D = P.map((a) => P.map((b) => dist(a[0], a[1], b[0], b[1])));
    // G[i][k] = the closest pair a ≤ i, b ≥ k (built from the corners outwards)
    const G = Array.from({ length: n }, () => new Float64Array(n).fill(Infinity)), GA = Array.from({ length: n }, () => new Int32Array(n)), GB = Array.from({ length: n }, () => new Int32Array(n));
    for (let i = 0; i < n; i++) for (let k = n - 1; k >= i; k--) { let g = D[i][k], a = i, b = k;
      if (i > 0 && G[i - 1][k] < g) { g = G[i - 1][k]; a = GA[i - 1][k]; b = GB[i - 1][k]; } if (k < n - 1 && G[i][k + 1] < g) { g = G[i][k + 1]; a = GA[i][k + 1]; b = GB[i][k + 1]; }
      G[i][k] = g; GA[i][k] = a; GB[i][k] = b; }
    for (let i = 0; i < n; i++) for (let k = i + 2; k < n; k++) { const gap = G[i][k], dik = D[k][i]; if (gap > 0.2 * (dik * 3)) continue;
      for (let j = i + 1; j < k; j++) { const a = D[i][j], b = D[j][k], per = a + b + dik; if (per < 1000 || gap > 0.2 * per) continue;
        const km = (per - gap) / 1000, fai = Math.min(a, b, dik) / per >= 0.28, kind = fai ? 'fai' : 'flat', pts = km * (fai ? 1.4 : 1.2);
        if (!res[kind] || pts > res[kind].pts) res[kind] = { kind, km, pts, per: per / 1000, gap: gap / 1000, tri: [P[i], P[j], P[k]], close: [P[GA[i][k]], P[GB[i][k]]] }; } } }
  res.best = ['free', 'flat', 'fai'].map((k) => res[k]).filter(Boolean).sort((a, b) => b.pts - a.pts)[0] || null;
  return res;
}
const SCORE_NAME = { free: 'Free distance', flat: 'Flat triangle', fai: 'FAI triangle' };
let scoreT = 0;
function scoreLive() {
  if (!st.takeoffT) { st.score = null; return; } const now = Date.now(); if (now - scoreT < 20000 && st.score) return; scoreT = now;
  const P = (st.log || []).filter((p) => p.lat != null && p.t >= st.takeoffT).map((p) => [p.lat, p.lon]); if (P.length < 30) return;
  st.score = trackScore(P); st.scoreVer = (st.scoreVer || 0) + 1; markDirty();
}
setInterval(scoreLive, 5000);
function xcscoreWData(W) {
  const R = st.score, b = R && R.best; if (!b) return { l: 'XC score', v: '--', u: 'pts', s: st.takeoffT ? 'after a few minutes of flying' : 'after takeoff' };
  return { l: 'XC score · ' + SCORE_NAME[b.kind], v: b.pts.toFixed(1), u: 'pts', s: b.km.toFixed(1) + ' km' + (b.kind !== 'free' && R.free ? ' · free ' + R.free.km.toFixed(1) + ' km' : '') + (b.kind === 'flat' && R.fai ? ' · FAI ' + R.fai.km.toFixed(1) : '') };
}
function scoreHTML(R) {
  if (!R || !R.best) return '<div class="muted">Not enough track yet.</div>';
  const box = (k) => { const x = R[k]; return statBox(SCORE_NAME[k] + (R.best === x ? ' ★' : ''), x ? x.pts.toFixed(1) + ' pts' : '--', x ? x.km.toFixed(2) + ' km' + (x.gap ? ' · gap ' + x.gap.toFixed(2) + ' km' : '') + ' · ×' + (k === 'free' ? '1.0' : k === 'flat' ? '1.2' : '1.4') : ''); };
  return `<div class="wgrid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${box('free')}${box('flat')}${box('fai')}</div><div class="muted" style="margin-top:6px">Scored like XContest (free distance via up to 3 turnpoints; triangles with a closing gap up to 20 % of the perimeter, FAI = every leg at least 28 %), on a thinned track: close to XContest's own result, usually a little under it. Recorded here the flight is unsigned, so XContest gives it no points.</div>`;
}
// map: the scoring route of the best result (cfg.scoreLine)
function drawScoreInto(I, C) {
  const on = C.scoreLine === true || C.scoreLine === 'true'; if (!I.g.score) I.g.score = L.layerGroup().addTo(I.m); const g = I.g.score;
  if (!on || !st.score || !st.score.best) { if (I.scK) { g.clearLayers(); I.scK = null; } return; }
  if (I.scK === st.scoreVer) return; I.scK = st.scoreVer; g.clearLayers(); const b = st.score.best;
  const line = b.kind === 'free' ? b.path : b.tri.concat([b.tri[0]]), o = { color: '#7B1FA2', weight: 3, dashArray: '8 6', interactive: false };
  L.polyline(line, { ...o, color: '#fff', weight: 6, dashArray: null, opacity: 0.6 }).addTo(g); L.polyline(line, o).addTo(g);
  (b.kind === 'free' ? b.path : b.tri).forEach((p) => L.circleMarker(p, { radius: 6, color: '#fff', weight: 2, fillColor: '#7B1FA2', fillOpacity: 1, interactive: false }).addTo(g));
  if (b.close) L.polyline(b.close, { color: '#7B1FA2', weight: 2, dashArray: '2 4', interactive: false }).addTo(g);
}
