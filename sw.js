'use strict';
/* Service worker: makes the app work offline and keeps map tiles on the device.
   - App files are stored per VERSION. Bump VERSION on every change to the app files,
     otherwise installed apps keep running the old copy. A new version waits until the
     user taps "Reload" in the update banner (never reloads by itself mid-flight).
   - Map tiles are kept as they are viewed (cache first), up to MAX_TILES, oldest out first. */
const VERSION = '2026.10.08-3';
const APP = 'app-' + VERSION, LIBS = 'libs-v1', TILES = 'tiles-v1', MAX_TILES = 15000;
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css', 'data/demo-flight.js',
  'js/01-core.js', 'js/02-analysis.js', 'js/03-replay.js', 'js/04-map.js', 'js/05-data-sources.js',
  'js/06-ui.js', 'js/07-widgets.js', 'js/08-actions.js', 'js/09-main.js', 'js/10-offline.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'];
const LIB_URLS = ['https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdn.jsdelivr.net/npm/leaflet-rotate@0.2.8/dist/leaflet-rotate.js'];
const LIB_HOST = /^(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;
const TILE_HOST = /(^|\.)(tile\.opentopomap\.org|server\.arcgisonline\.com|basemaps\.cartocdn\.com|tile\.openstreetmap\.org)$/;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(APP);
    await c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })));
    const l = await caches.open(LIBS);
    await Promise.allSettled(LIB_URLS.map(async (u) => { if (!(await l.match(u))) { const r = await fetch(u, { mode: 'cors' }); if (r.ok) await l.put(u, r); } }));
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('app-') && k !== APP) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'skipWaiting') self.skipWaiting();
  else if (d.type === 'version') e.ports[0]?.postMessage(VERSION);
  else if (d.type === 'tileStats') e.waitUntil(tileStats().then((s) => e.ports[0]?.postMessage(s)));
  else if (d.type === 'clearTiles') e.waitUntil(caches.delete(TILES).then(() => { putCount = 0; e.ports[0]?.postMessage(true); }));
});

self.addEventListener('fetch', (e) => {
  const q = e.request; if (q.method !== 'GET') return;
  const u = new URL(q.url);
  if (u.origin === self.location.origin) e.respondWith(appFile(q));
  else if (TILE_HOST.test(u.hostname)) e.respondWith(tile(q));
  else if (LIB_HOST.test(u.hostname)) e.respondWith(lib(q));
  // everything else (weather, airspace, traffic, places …) goes straight to the network
});

async function appFile(q) {
  const c = await caches.open(APP);
  const hit = q.mode === 'navigate' ? await c.match('index.html') : await c.match(q, { ignoreSearch: true });
  return hit || fetch(q);
}
async function lib(q) {
  const c = await caches.open(LIBS), hit = await c.match(q.url); if (hit) return hit;
  let r; try { r = await fetch(q.url, { mode: 'cors' }); } catch (err) { return fetch(q); }
  if (r.ok) c.put(q.url, r.clone());
  return r;
}

/* Tiles are fetched with CORS so the cache stores their real size; an opaque (no-CORS) response
   would count as several MB each against the storage quota. Hosts without CORS are not stored. */
const noCors = new Set(); let putCount = 0;
async function tile(q) {
  const c = await caches.open(TILES), hit = await c.match(q.url); if (hit) return hit;
  const host = new URL(q.url).hostname;
  if (noCors.has(host)) return fetch(q);
  let r; try { r = await fetch(q.url, { mode: 'cors', credentials: 'omit' }); } catch (err) { noCors.add(host); return fetch(q); }
  if (r.ok) { await c.put(q.url, r.clone()); if (++putCount % 200 === 0) trimTiles(c); }
  return r;
}
async function trimTiles(c) {
  const keys = await c.keys(); // oldest first
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}
async function tileStats() {
  const c = await caches.open(TILES), keys = await c.keys(), hosts = {};
  keys.forEach((k) => { const h = new URL(k.url).hostname.replace(/^[a-d]\./, ''); hosts[h] = (hosts[h] || 0) + 1; });
  return { tiles: keys.length, max: MAX_TILES, hosts, noCors: [...noCors] };
}
