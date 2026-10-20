'use strict';
/* ================= wing polar, speed to fly, final glide =================
   Polar: S.polar = [[km/h, sink m/s] × 3] (min sink, trim, accelerated), fitted as sink = a·v² + b·v + c (least squares, v in m/s); S.usePolar on =
   the glide reach area, landing fields and final glide fly the speed that gives the best glide over the ground in each direction (into wind faster);
   off = trim speed S.wingSpd and S.wingLD everywhere (the old way).
   Speed to fly (MacCready, S.mc m/s): the speed that maximises (v + tailwind) / (sink(v) − netto + MC); netto = vario + polar sink at your airspeed,
   airspeed = |ground velocity − wind|. Final glide: height you need along the rest of the task (optimised route, each leg with its own wind component,
   MacCready speed per leg) to arrive S.safety above the goal (goal elevation from Open-Meteo). */
const POLAR_DEF = [[30, 1.05], [37, 1.15], [52, 1.95]];
function polarPts() { const P = Array.isArray(S.polar) && S.polar.length >= 2 ? S.polar : POLAR_DEF; return P.map(([v, s]) => [+v / 3.6, +s]).filter(([v, s]) => v > 2 && s > 0).sort((a, b) => a[0] - b[0]); }
let polarK = null, polarKey = '';
function polarFit() {
  const P = polarPts(), k = JSON.stringify(P); if (polarK && polarKey === k) return polarK; polarKey = k;
  if (P.length < 3) { const [[v1, s1], [v2, s2]] = P.length === 2 ? P : [[8, 1.05], [14, 1.9]]; const a = (s2 - s1) / (v2 * v2 - v1 * v1); polarK = { a, b: 0, c: s1 - a * v1 * v1, vmin: P[0][0], vmax: P[P.length - 1][0] }; return polarK; }
  // least squares through all points: [Σv⁴ Σv³ Σv²; Σv³ Σv² Σv; Σv² Σv n] [a b c] = [Σv²s Σvs Σs]
  let S4 = 0, S3 = 0, S2 = 0, S1 = 0, n = P.length, T2 = 0, T1 = 0, T0 = 0; P.forEach(([v, s]) => { S4 += v ** 4; S3 += v ** 3; S2 += v * v; S1 += v; T2 += v * v * s; T1 += v * s; T0 += s; });
  const M = [[S4, S3, S2, T2], [S3, S2, S1, T1], [S2, S1, n, T0]];
  for (let i = 0; i < 3; i++) { let p = i; for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r; [M[i], M[p]] = [M[p], M[i]]; for (let r = 0; r < 3; r++) if (r !== i) { const q = M[r][i] / M[i][i]; for (let c = i; c < 4; c++) M[r][c] -= q * M[i][c]; } }
  polarK = { a: M[0][3] / M[0][0], b: M[1][3] / M[1][1], c: M[2][3] / M[2][2], vmin: P[0][0], vmax: P[P.length - 1][0] };
  if (!(polarK.a > 0)) { const [v1, s1] = P[0], [v2, s2] = P[P.length - 1], a = (s2 - s1) / (v2 * v2 - v1 * v1); polarK = { a, b: 0, c: s1 - a * v1 * v1, vmin: v1, vmax: v2 }; }
  return polarK;
}
const sinkAt = (v) => { const K = polarFit(); return Math.max(0.3, K.a * v * v + K.b * v + K.c); };
const usePolar = () => S.usePolar === true;
// the speed to fly along bearing b: best glide over the ground (+ MacCready mc, netto n), and what it gives
function glideAlong(b, mc, n) {
  if (!usePolar()) { const V = Math.max(5, sN('wingSpd', 37) / 3.6), gs = gsAlong(b, V); return { v: V, gs, sink: V / Math.max(2, S.wingLD) }; }
  const K = polarFit(), m = mc || 0, nn = n || 0; let best = null;
  for (let v = K.vmin; v <= K.vmax + 1e-6; v += 0.25) { const gs = gsAlong(b, v), s = sinkAt(v) - nn; if (gs <= 0 || s + m <= 0) continue; const q = gs / (s + m); if (!best || q > best.q) best = { v, gs, sink: Math.max(0.05, s), q }; }
  return best || { v: K.vmax, gs: 0, sink: sinkAt(K.vmax) };
}
// your airspeed and the netto (air mass) climb
function airNow() {
  const f = st.fix; if (!f || f.spd == null || f.trk == null) return null; const w = st.wind || { vx: 0, vy: 0 };
  const ax = f.spd * Math.sin(f.trk * D2R) - w.vx, ay = f.spd * Math.cos(f.trk * D2R) - w.vy, tas = Math.hypot(ax, ay), v = avgVario(3);
  return { tas, hd: wrap360(Math.atan2(ax, ay) * R2D), netto: v != null ? v + sinkAt(clamp(tas, polarFit().vmin, polarFit().vmax)) : null };
}
function stfWData(W) {
  const A = airNow(), mc = +S.mc || 0, f = st.fix; if (!A) return { l: 'Speed to fly · MC ' + mc.toFixed(1), v: '--', s: 'waiting for GPS' };
  const wp = st.task && st.task.pts[st.nextWp] && !st.goalT ? st.task.pts[st.nextWp] : null, b = wp ? brg(f.lat, f.lon, wp.lat, wp.lon) : f.trk;
  const K = polarFit(), nn = st.circling ? 0 : clamp(A.netto ?? 0, -3, 3); let best = null;
  for (let v = K.vmin; v <= K.vmax + 1e-6; v += 0.25) { const gs = gsAlong(b, v), s = sinkAt(v) - nn + mc; if (gs <= 0 || s <= 0) continue; const q = gs / s; if (!best || q > best.q) best = { v, q }; }
  if (!best) return { l: 'Speed to fly · MC ' + mc.toFixed(1), v: 'MAX', u: S.uSpd, s: 'cannot make way · netto ' + (A.netto ?? 0).toFixed(1) };
  const d = (best.v - A.tas) * 3.6, hint = Math.abs(d) < 3 ? 'on speed' : d > 0 ? '▲ faster ' + fSpd(best.v - A.tas) : '▼ slower ' + fSpd(A.tas - best.v);
  return { l: 'Speed to fly · MC ' + mc.toFixed(1) + (wp ? ' · to ' + wp.name : ''), v: fSpd(best.v), u: S.uSpd, s: hint + ' · air ' + fSpd(A.tas) + ' · netto ' + (A.netto != null ? (A.netto >= 0 ? '+' : '') + A.netto.toFixed(1) : '--'), ...(Math.abs(d) >= 3 ? { col: d > 0 ? '#1565C0' : '#B26A00' } : {}) };
}
const fgElev = {};
function finalGlide() {
  const T = st.task, f = st.fix, alt = altNow(); if (!T || !f || alt == null || st.goalT) return null;
  const route = T.comp && typeof compDist === 'function' ? compDist().remPts : optRoute([f.lat, f.lon], st.nextWp).pts; if (!route || !route.length) return null;
  const g = T.pts[T.pts.length - 1], k = g.lat.toFixed(4) + ',' + g.lon.toFixed(4);
  if (fgElev[k] === undefined) { fgElev[k] = null; elevCached([[g.lat, g.lon]]).then((e) => { fgElev[k] = e[0]; markDirty(); }).catch(() => { delete fgElev[k]; }); }
  const ge = fgElev[k] ?? (st.groundElev ?? null); let need = 0, len = 0, prev = [f.lat, f.lon], ok = true;
  route.forEach((p) => { const d = dist(prev[0], prev[1], p[0], p[1]), b = brg(prev[0], prev[1], p[0], p[1]), G = glideAlong(b, +S.mc || 0); if (G.gs <= 0) ok = false; else need += d * G.sink / G.gs; len += d; prev = p; });
  if (!ok) return { len, arr: null, ge };
  return { len, need, ge, arr: ge != null ? alt - need - ge : null, ld: ge != null && alt - ge > 0 ? len / (alt - ge) : null };
}
function fglideWData(W) {
  if (!st.task) return { l: 'Final glide', v: '--', s: 'no task' }; if (st.goalT) return { l: '✓ Goal', v: '--' };
  const F = finalGlide(); if (!F) return { l: 'Final glide', v: '--', s: 'waiting for GPS' };
  if (F.arr == null) return { l: 'Final glide · ' + fDist(F.len), v: '--', s: F.ge == null ? 'goal elevation not known yet' : 'cannot make way into the wind' };
  const safe = +S.safety || 0, m = F.arr - safe, A = fAlt(Math.abs(m));
  return { l: 'Final glide · ' + fDist(F.len) + ' to goal', v: (m >= 0 ? '+' : '−') + A, u: S.uAlt, s: (m >= 0 ? 'above glide · ' : 'below glide · ') + 'needs L/D ' + (F.ld ? F.ld.toFixed(1) : '--') + ' · MC ' + (+S.mc || 0).toFixed(1) + (safe ? ' · incl. ' + fAlt(safe) + ' ' + S.uAlt + ' safety' : ''), ...(m >= 0 ? { bgc: '#1F8A4C', col: '#FFFFFF' } : {}) };
}
function mcStep() { const v = Math.round(((+S.mc || 0) + 0.5) * 2) / 2; S.mc = v > 3 ? 0 : v; save(); toast('MacCready ' + S.mc.toFixed(1) + ' m/s'); renderWidgets(); }
/* Settings → Units & glide: polar card */
function polarSecHTML() {
  const P = Array.isArray(S.polar) && S.polar.length >= 2 ? S.polar : POLAR_DEF, K = polarFit(), bestLD = (() => { let b = 0, bv = 0; for (let v = K.vmin; v <= K.vmax; v += 0.25) { const q = v / sinkAt(v); if (q > b) { b = q; bv = v; } } return [b, bv]; })();
  return `<div class="card sec"><h2>Wing polar & speed to fly</h2>
    <div class="muted">Three points from your wing's polar: minimum sink, trim and full speed bar (speed in km/h, sink in m/s). With the polar on, the glide reach area, landing fields and final glide fly the best speed for the wind in each direction; off, they use the glide ratio and trim speed above.</div>
    ${seg('usePolar', [[false, 'Off'], [true, 'On']], 'Use the polar')}
    ${['Minimum sink', 'Trim', 'Full speed bar'].map((n, i) => `<div class="field"><span class="k">${n}</span><span class="row"><input type="number" class="numin" data-pol="${i}" data-pk="0" value="${P[i] ? P[i][0] : ''}" step="1" min="15" max="90" aria-label="${n} speed"><span class="unit">km/h</span><input type="number" class="numin" data-pol="${i}" data-pk="1" value="${P[i] ? P[i][1] : ''}" step="0.05" min="0.5" max="5" aria-label="${n} sink"><span class="unit">m/s</span></span></div>`).join('')}
    <div class="muted">Best glide in still air: ${bestLD[0].toFixed(1)} at ${fSpd(bestLD[1])} ${S.uSpd}.</div>
    ${numField('mc', 'tap the Speed to fly widget to step it')}
    <div class="field"><span class="k"></span><button class="btn" id="polReset">Default polar</button></div></div>`;
}
function polarWire(on) {
  document.querySelectorAll('[data-pol]').forEach((e) => (e.onchange = () => { const P = (Array.isArray(S.polar) && S.polar.length >= 2 ? S.polar : POLAR_DEF).map((r) => r.slice()); const i = +e.dataset.pol, k = +e.dataset.pk, v = +e.value; if (!isFinite(v) || v <= 0) return; P[i][k] = v; S.polar = P; save(); st.reach = null; renderSettings(); }));
  on('polReset', 'onclick', () => { const old = S.polar; S.polar = POLAR_DEF.map((r) => r.slice()); save(); st.reach = null; renderSettings(); toast('Default polar', [['Undo', () => { S.polar = old; save(); renderSettings(); }]]); });
}
/* heading = where the nose points. S.hdgSrc 'wind' (default): the bearing corrected for the measured wind (airNow); 'compass': the tablet's compass
   (deviceorientationabsolute, smoothed ~0.5 s): S.hdgMount 'upright' = the back of the tablet faces forward (screen towards you), 'flat' = screen up,
   its top edge forward; S.hdgOff ° adds how the tablet sits. The compass falls back to the wind method when it gives no reading (2 s). */
const CMP = { x: 0, y: 0, t: 0, hd: null };
window.addEventListener('deviceorientationabsolute', (e) => {
  if (e.alpha == null) return; const r = D2R, a = e.alpha * r, b = (e.beta || 0) * r, g = (e.gamma || 0) * r, cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
  // device → earth (x east, y north, z up), W3C rotation Z(α)·X(β)·Y(γ): the forward vector is −z (upright) or +y (flat)
  const flat = S.hdgMount === 'flat', E = flat ? -cB * sA : -(cG * sA * sB + cA * sG), N = flat ? cA * cB : -(sA * sG - cA * cG * sB); if (Math.hypot(E, N) < 0.2) return;
  const h = wrap360(Math.atan2(E, N) * R2D + (+S.hdgOff || 0)), now = Date.now(), dt = CMP.t ? clamp((now - CMP.t) / 1000, 0, 1) : 1, k = 1 - Math.exp(-dt / 0.5);
  CMP.x += (Math.sin(h * D2R) - CMP.x) * k; CMP.y += (Math.cos(h * D2R) - CMP.y) * k; CMP.t = now; CMP.hd = wrap360(Math.atan2(CMP.x, CMP.y) * R2D);
});
function hdgNow() {
  if (S.hdgSrc === 'compass' && CMP.hd != null && Date.now() - CMP.t < 2000) return { hd: CMP.hd, src: 'compass' };
  const A = airNow(); if (A && A.tas > 2 && st.wind) return { hd: A.hd, src: 'wind' };
  return st.fix && st.fix.trk != null ? { hd: st.fix.trk, src: 'bearing' } : null;
}
