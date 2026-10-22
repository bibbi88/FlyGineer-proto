'use strict';
/* ================= main loop ================= */
let lastSlow = 0;
function allTypes() { const t = new Set(); Object.values(S.layouts).forEach((L0) => L0.forEach((W) => t.add(W.type))); return t; }
function tick() {
  updateMode(); runAutoPending(); renderTop();
  if (PAGEKEY[curPage]) renderWidgets();
  if (curPage === 'pMap') renderWarn();
  const now = Date.now();
  if (now - (st.lastPredFetch || 0) > 3000) updatePrediction(); // returns at once unless you turned or moved enough
  if (now - lastSlow > 5000) {
    lastSlow = now; updateGround(); updatePrediction(); updateReach(); const ty = allTypes();
    if (ty.has('place') || ty.has('places') || ty.has('asmap') || ty.has('radiomsg') || Object.values(S.layouts).some((L0) => L0.some((W) => W.type === 'map' && (W.cfg.places === true || W.cfg.places === 'true')))) loadPlaces();
    if (['cloud', 'cbase', 'ttop', 'outlook', 'groundT', 'profile'].some((t) => ty.has(t)) && !st.forecast && st.fix && !st.fcLoading && now - (st.fcTry || 0) > 60000) { st.fcTry = now; loadForecast(); }
    if (ty.has('notams') && !NOTAMS.length && now - (st.ntTry || 0) > 300000) { st.ntTry = now; loadNotams(); }
  }
}
function boot() {
  if (S.theme === 'dark') document.body.classList.add('dark');
  if (S.navMode === 'pinned') document.body.classList.add('pinned');
  if (!S.navCMig) { const cw = innerWidth / 96, ch = innerHeight / 64; if (+S.navSz !== 52 || S.navH != null) { S.navCw = clamp(Math.round(sN('navSz', 52) / cw), 3, 17); S.navCh = clamp(Math.round(sN('navH', sN('navSz', 52)) / ch), 3, 10); } S.navCMig = true; save(); } // menu button size in grid cells (2026-10-21), was px
  if (!S.radMig) { if (+S.wRad === 10) S.wRad = 4; S.radMig = true; save(); } // smaller default corner rounding (2026-10-20); an own value stays
  if (!S.sbMig) { if (S.corner === 'menu') S.sbShow = false; S.sbMig = true; save(); } // "menu only" before: the status bar stays hidden
  cornerMode(); wStyle(); placeCorner(); placeSbar();
  try { const c = JSON.parse(localStorage.getItem('bora.notams') || 'null'); if (c) { NOTAMS = c.list; st.notamAt = c.at; } } catch (e) { }
  try { st.airspaces = JSON.parse(localStorage.getItem('bora.air') || '[]'); } catch (e) { st.airspaces = []; }
  if (!S.airManMig) { if (!xcFile() && st.airspaces.length) S.airOld = true; delete S.openaipKey; delete S.airCountries; delete S.airSrc; S.airManMig = true; save(); } // 2026-10-22: airspace only from your own file; stored airspace stays until you load one
  setTimeout(airBoot, 1500);
  if (typeof L === 'undefined') { document.querySelector('main').innerHTML = '<div style="padding:30px;font-size:18px">The map library could not load. Connect to the internet and reload.</div>'; return; }
  drawNotamAreas(); renderNotams();
  startGPS();
  const qp = new URLSearchParams(location.search); if (qp.get('p')) { importFlyXC('https://flyxc.app/?p=' + encodeURIComponent(qp.get('p'))); history.replaceState(null, '', location.pathname + (qp.has('demo') ? '?demo' : '')); }
  if (qp.has('demo')) startDemoFlight(qp.get('demo') === '2' ? 2 : 1); // ?demo or ?demo=2
  loop();
}
boot();
