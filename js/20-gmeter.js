'use strict';
/* ================= G-meter and spiral warning =================
   The tablet's accelerometer (devicemotion, accelerationIncludingGravity, ~60/s): G = |a| / 9.81, the same load the pilot feels whatever way the tablet
   is mounted. Smoothed for showing (~0.4 s) and over 1 s for warnings; the peak of the flight is kept (st.gPeak, reset at takeoff and by tapping the widget;
   the recorder stores it as F.gMax). Spiral warning (S.gWarnOn, default on): 1 s G at or above S.gWarn (2.5) for 2 s, or sinking faster than S.spSink m/s
   (−8) while turning more than 40 °/s for 3 s → red banner #gBan, tone and voice; it clears below 1.8 G. Replays and the demo have no G (it is not in IGC). */
const G = { v: null, s: null, s1: null, t: 0, hi: 0, sp: 0, on: false, log: [] };
window.addEventListener('devicemotion', (e) => {
  const a = e.accelerationIncludingGravity; if (!a || a.x == null) return;
  const g = Math.hypot(a.x, a.y, a.z) / 9.81, now = Date.now(), dt = G.t ? clamp((now - G.t) / 1000, 0, 0.5) : 0.016; G.t = now; G.v = g;
  G.s = G.s == null ? g : G.s + (g - G.s) * (1 - Math.exp(-dt / 0.4)); G.s1 = G.s1 == null ? g : G.s1 + (g - G.s1) * (1 - Math.exp(-dt / 1));
  if (st.takeoffT && !st.replay && !st.sim) { if (st.gPeak == null || G.s > st.gPeak) st.gPeak = G.s; if (REC && REC.cur && (REC.cur.gMax == null || G.s > REC.cur.gMax)) REC.cur.gMax = +G.s.toFixed(2); }
  const L0 = G.log, last = L0[L0.length - 1]; if (!last || now - last.t >= 200) { L0.push({ t: now, g: G.s }); while (L0.length && L0[0].t < now - 60000) L0.shift(); }
});
const gNow = () => (G.t && Date.now() - G.t < 2000 ? G.s : null);
const VSPIRAL = { en: (g) => `Spiral, ${g} G`, sv: (g) => `Spiral, ${g} G`, fi: (g) => `Spiraali, ${g} G` };
setInterval(() => {
  const g = G.t && Date.now() - G.t < 2000 ? G.s1 : null, now = Date.now(), warnG = sN('gWarn', 2.5), v = avgVario(2), tr = Math.abs(st.turnRate || 0);
  G.hi = g != null && g >= warnG ? G.hi || now : 0;
  G.sp = v != null && v < sN('spSink', -8) && tr > 40 ? G.sp || now : 0;
  const want = S.gWarnOn !== false && !st.replay && !st.sim && ((G.hi && now - G.hi >= 2000) || (G.sp && now - G.sp >= 3000));
  let b = $('gBan');
  if (want && !G.on) { G.on = true; G.said = 0; }
  if (G.on && !want && (g == null || g < 1.8) && !(G.sp && now - G.sp >= 3000)) G.on = false;
  if (!G.on) { if (b) b.style.display = 'none'; return; }
  if (!b) { b = document.createElement('div'); b.id = 'gBan'; b.className = 'trafBan'; b.dataset.lvl = '3'; document.body.appendChild(b); }
  b.innerHTML = `<b>⚠ SPIRAL</b> <span>${g != null ? g.toFixed(1) + ' G' : ''}${v != null ? ' · ' + fVario(v) + ' ' + S.uVario : ''}</span>`; b.style.display = 'flex'; b.style.top = '80px';
  if (now - (G.said || 0) > 5000) { G.said = now; if (typeof trafficTone === 'function') trafficTone(3); if (S.voice) { const lg = VSPIRAL[S.voiceLang] ? S.voiceLang : (navigator.language || 'en').slice(0, 2); say((VSPIRAL[lg] || VSPIRAL.en)(g != null ? g.toFixed(1) : '')); } }
}, 250);
function gWData(W) {
  const g = gNow(), pk = st.gPeak, warn = sN('gWarn', 2.5);
  if (g == null) return { l: 'G-meter', v: '--', u: 'G', s: st.replay || st.sim ? 'no G in a replay' : 'no motion sensor data' };
  return { l: 'G-meter', v: g.toFixed(1), u: 'G', s: 'max ' + (pk != null ? pk.toFixed(1) + ' G' : '--') + ' · tap to reset', ...(g >= warn ? { bgc: '#C62828', col: '#FFFFFF' } : g >= warn * 0.8 ? { col: '#E07B00' } : {}) };
}
function gReset() { st.gPeak = null; toast('G peak reset'); renderWidgets(); }
