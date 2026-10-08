'use strict';
/* ================= installable app, offline use, map tile cache (service worker in sw.js) ================= */
const app = { reg: null, version: null, waiting: null, persisted: null };
function swAsk(type) {
  const sw = navigator.serviceWorker && navigator.serviceWorker.controller; if (!sw) return Promise.resolve(null);
  return new Promise((res) => { const ch = new MessageChannel(); ch.port1.onmessage = (e) => res(e.data); sw.postMessage({ type }, [ch.port2]); setTimeout(() => res(null), 4000); });
}
function showUpdate(w) {
  app.waiting = w; if ($('updBar')) return;
  const b = document.createElement('div'); b.id = 'updBar'; b.setAttribute('role', 'status');
  b.innerHTML = '<span>A new version is ready</span><button class="btn primary" id="updGo">Reload</button><button class="btn" id="updLater">Later</button>';
  document.body.appendChild(b);
  $('updGo').onclick = () => { b.remove(); app.waiting.postMessage({ type: 'skipWaiting' }); };
  $('updLater').onclick = () => b.remove();
}
async function swStart() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  try { app.reg = await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('service worker', e); return; }
  const reg = app.reg, hadCtl = !!navigator.serviceWorker.controller;
  // a new version only takes over after "Reload" is tapped; then reload once
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtl && !reloading) { reloading = true; location.reload(); } else swInfo(); });
  if (reg.waiting && hadCtl) showUpdate(reg.waiting);
  reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w); }); });
  // the app may stay open for hours: look for a new version every 30 min and when it comes back to the front
  setInterval(() => reg.update().catch(() => { }), 30 * 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => { }); });
  // ask Chrome to keep stored data (maps, settings) even when the device runs low on space
  try { if (navigator.storage && navigator.storage.persist) app.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist()); } catch (e) { }
  swInfo();
}
async function swInfo() { app.version = await swAsk('version'); if (curPage === 'pSet' && setSec === 'app') renderSettings(); }
function fmtMB(b) { return b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.round(b / 1e6) + ' MB'; }
const TILE_HOST_NAME = { 'tile.opentopomap.org': 'Topo', 'server.arcgisonline.com': 'Satellite', 'basemaps.cartocdn.com': 'Airspace / Night', 'tile.openstreetmap.org': 'Streets' };
function appSection() {
  const ok = 'serviceWorker' in navigator && window.isSecureContext;
  return `<div class="card sec"><h2>App & offline maps</h2>
    <div class="field"><span class="k">Version</span><b>${ok ? esc(app.version || (navigator.serviceWorker.controller ? '…' : 'installing, reload once')) : 'offline use needs https'}</b><button class="btn" id="updCheck">Check for update</button></div>
    <div class="muted">Install it from Chrome's menu: ⋮ → Add to Home screen (or Install app). It then opens full screen from its own icon and works without internet. New versions download in the background and ask before they reload.</div>
    <h2 style="margin-top:8px">Map tiles on this tablet</h2>
    <div class="field"><span class="k">Stored</span><b id="tileStat">…</b></div>
    <div class="field"><span class="k">Storage</span><b id="storeStat">…</b></div>
    <div class="muted">Every map tile you look at is kept on the tablet and used first next time, so areas you have browsed (at the zoom levels you used) also work without mobile data. Tip: before a flight, look over the site on Wi-Fi at the zoom levels you fly with. The oldest tiles are removed after about 15 000 tiles (roughly 300–600 MB).</div>
    <div class="field"><span class="k"></span><button class="btn warn" id="tileClear">Delete stored map tiles</button></div></div>`;
}
async function appSectionFill() {
  const t = await swAsk('tileStats'), s = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate().catch(() => null) : null;
  if ($('tileStat')) $('tileStat').textContent = t ? t.tiles.toLocaleString() + ' tiles' + (t.tiles ? ' · ' + Object.entries(t.hosts).map(([h, n]) => (TILE_HOST_NAME[h] || h) + ' ' + n.toLocaleString()).join(', ') : '') + (t.noCors.length ? ' · not storable: ' + t.noCors.map((h) => TILE_HOST_NAME[h.replace(/^[a-d]\./, '')] || h).join(', ') : '') : 'not available yet';
  if ($('storeStat')) $('storeStat').textContent = s ? fmtMB(s.usage || 0) + ' used of ' + fmtMB(s.quota || 0) + ' available' + (app.persisted ? ' · kept permanently' : app.persisted === false ? ' · may be cleared by Android when space runs low' : '') : 'unknown';
}
function appSectionWire(on) {
  appSectionFill();
  on('updCheck', 'onclick', async () => { if (!app.reg) { toast('Offline use is not active'); return; } try { await app.reg.update(); } catch (e) { toast('Could not check: no connection?'); return; } if (app.reg.waiting) showUpdate(app.reg.waiting); else if (app.reg.installing) toast('Downloading the new version…'); else toast('You have the latest version'); });
  on('tileClear', 'onclick', async () => { if (!confirm('Delete all map tiles stored on this tablet?')) return; await swAsk('clearTiles'); toast('Stored map tiles deleted'); appSectionFill(); });
}
swStart();
