'use strict';
/* ================= main loop ================= */
let lastSlow = 0;
function allTypes() { const t = new Set(); Object.values(S.layouts).forEach((L0) => L0.forEach((W) => t.add(W.type))); return t; }
function tick() {
  updateMode(); runAutoPending(); renderTop();
  if (PAGEKEY[curPage]) renderWidgets();
  if (curPage === 'pMap') renderWarn();
  const now = Date.now();
  if (now - lastSlow > 5000) {
    lastSlow = now; updateGround(); updatePrediction(); const ty = allTypes();
    if (ty.has('place') || ty.has('places') || ty.has('asmap')) loadPlaces();
    if (['cloud', 'cbase', 'ttop', 'outlook', 'groundT', 'profile'].some((t) => ty.has(t)) && !st.forecast && st.fix && !st.fcLoading && now - (st.fcTry || 0) > 60000) { st.fcTry = now; loadForecast(); }
    if (ty.has('notams') && !NOTAMS.length && now - (st.ntTry || 0) > 300000) { st.ntTry = now; loadNotams(); }
  }
}
function boot() {
  if (S.theme === 'dark') document.body.classList.add('dark');
  if (S.navMode === 'pinned') document.body.classList.add('pinned');
  try { const c = JSON.parse(localStorage.getItem('bora.notams') || 'null'); if (c) { NOTAMS = c.list; st.notamAt = c.at; } } catch (e) { }
  try { st.airspaces = JSON.parse(localStorage.getItem('bora.air') || '[]'); } catch (e) { st.airspaces = []; }
  if (typeof L === 'undefined') { document.querySelector('main').innerHTML = '<div style="padding:30px;font-size:18px">The map library could not load. Connect to the internet and reload.</div>'; return; }
  drawNotamAreas(); renderNotams();
  startGPS();
  const qp = new URLSearchParams(location.search); if (qp.get('p')) { importFlyXC('https://flyxc.app/?p=' + encodeURIComponent(qp.get('p'))); history.replaceState(null, '', location.pathname + (qp.has('demo') ? '?demo' : '')); }
  if (qp.has('demo')) startDemoFlight();
  loop();
}
boot();
