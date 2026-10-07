'use strict';
/* ================= map ================= */
const LAYERS = {
  topo: { name: 'Topo', sw: ['#DFE6CF', '#5E95C2'], url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', o: { maxZoom: 17, subdomains: 'abc', attribution: '© OpenStreetMap, SRTM · © OpenTopoMap (CC-BY-SA)' } },
  sat: { name: 'Satellite', sw: ['#3B4631', '#1C3549'], url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', o: { maxZoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' } },
  light: { name: 'Airspace', sw: ['#FFFFFF', '#5B2FA6'], url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', o: { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap © CARTO' } },
  night: { name: 'Night', sw: ['#12161B', '#B794F6'], url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', o: { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap © CARTO' } },
  streets: { name: 'Streets', sw: ['#F2EFE9', '#E8A05A'], url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', o: { maxZoom: 19, attribution: '© OpenStreetMap contributors' } }
};
/* ================= map widgets (any number of maps, each with its own settings) ================= */
const ROT = { north: 'North up', track: 'Track up', bearing: 'Bearing up' };
const MAPS = new Set();
const HCOL = '#E0157F';
const findW = (id) => { for (const k of Object.keys(S.layouts)) { const w = S.layouts[k].find((x) => x.id === id); if (w) return w; } return null; };
const instOf = (W) => { const el = document.querySelector(`.wg[data-id="${W.id}"]`); return el && el._mi; };
const effCfg = (W) => (st.thermMode && W.cfgT ? Object.assign({}, W.cfg, W.cfgT) : W.cfg);
const cfgW = (W) => (st.thermMode && W.cfgT ? W.cfgT : W.cfg);
const effW = (W) => Object.assign({}, W, { cfg: effCfg(W), W0: W });
function drawTask() { st.taskVer = (st.taskVer || 0) + 1; }
const gliderIcon = (k) => L.divIcon({ className: '', html: '<svg viewBox="0 0 40 40" style="width:100%;height:100%;display:block"><g class="glg"><path d="M20 4 L31 34 L20 27 L9 34 Z" fill="#111418" stroke="#fff" stroke-width="2.5"/></g></svg>', iconSize: [40 * k, 40 * k], iconAnchor: [20 * k, 20 * k] });
const startIcon = () => L.divIcon({ className: '', html: '<svg width="34" height="40" viewBox="0 0 34 40" style="margin:-38px 0 0 -4px"><path d="M5 38V4" stroke="#111418" stroke-width="3" stroke-linecap="round"/><path d="M6 4h22l-5 6 5 6H6z" fill="#2E7D4F" stroke="#fff" stroke-width="1.5"/><text x="9" y="14" font-size="8" font-weight="700" fill="#fff" font-family="Barlow">START</text></svg>', iconSize: [0, 0] });
function drawTaskInto(g) {
  if (!st.task) return; const pts = st.task.pts.map((p) => [p.lat, p.lon]);
  L.polyline(pts, { color: '#1E50C8', weight: 3, dashArray: '8 6', interactive: false }).addTo(g);
  st.task.pts.forEach((p, i) => { L.circle([p.lat, p.lon], { radius: S.cylR, color: i === st.nextWp ? '#1E50C8' : '#111418', weight: i === st.nextWp ? 4 : 2, fill: false, interactive: false }).addTo(g); L.marker([p.lat, p.lon], { icon: L.divIcon({ className: 'wpLabel', html: esc(p.name), iconSize: [80, 16], iconAnchor: [-8, 8] }), interactive: false }).addTo(g); });
}
function drawAirInto(g) { st.airspaces.forEach((a) => L.polygon(a.poly, { color: airColor(a), weight: 2, fillOpacity: 0.08 }).bindTooltip(`${esc(a.name)} · ${fmtLim(a.lo)} – ${fmtLim(a.hi)}`).addTo(g)); }
function drawNotamInto(g) { NOTAMS.filter((n) => n.geo && ntState(n) !== 'over').forEach((n) => { const o = { color: '#9A3D06', weight: 2, dashArray: '6 4', fillOpacity: 0.08 }; const lay = n.geo.poly ? L.polygon(n.geo.poly, o) : n.geo.r > 0 ? L.circle(n.geo.pt, Object.assign({ radius: n.geo.r }, o)) : L.circleMarker(n.geo.pt, { radius: 6, color: '#9A3D06', weight: 2, fillOpacity: 0.3 }); lay.bindTooltip(esc(n.id + ' ' + n.text.slice(0, 60))).addTo(g); }); }
function drawPlacesInto(g, f) { visiblePlaces().filter((p) => dist(f.lat, f.lon, p.lat, p.lon) <= S.poiRadius * 1000).forEach((p) => { const mk = L.circleMarker([p.lat, p.lon], { radius: p.kind === 'airport' || p.kind === 'start' ? 7 : 5, color: '#fff', weight: 1.5, fillColor: p.kind === 'start' ? '#2E7D4F' : p.kind === 'airport' ? '#5B2FA6' : p.kind === 'peak' ? '#6B4E2E' : '#111418', fillOpacity: 1, interactive: false }).addTo(g); if (p.rank >= 2 || p.kind === 'airport' || p.kind === 'start') mk.bindTooltip(esc(p.name), { permanent: true, direction: 'right', className: 'wpLabel' }); }); }
/* ADS-B traffic (adsb.fi open data, personal non-commercial use, attribution required) */
st.traffic = []; st.trafficAt = 0;
const HELI_T = /^(R22|R44|R66|EC\d|H\d{2,3}|AS\d|B06|B407|B412|B429|A109|A119|A139|A169|AW\d|S76|S92|S61|MD5|MD6|EH10|NH90|KA\d|BK17|B105|H60|H47|CH47|UH|AH6|MI\d|G2CA|GAZL|LAMA|TIGR|EXEC|SCOU|ALO\d)/i, BIG_T = /^(A3\d\d|A2\d\d|A4\d\d|B7\d\d|B3\d\d|B38|E1\d\d|E2\d\d|E75|CRJ|DH8D|AT7|MD8|MD9|C17|C130|A400|IL76|AN\d)/i;
function trafficKind(a) { const c = a.category || '', t = a.t || ''; if (c === 'A7' || HELI_T.test(t)) return 'heli'; if (/^A[3-6]$/.test(c)) return 'big'; if (!c && BIG_T.test(t)) return 'big'; return 'small'; }
const trafficOn = (C) => C.traffic === true || C.traffic === 'true';
async function loadTraffic() {
  const f = st.fix; if (!f || document.hidden || st.replay || st.trafficBusy) return;
  const ws = [...MAPS].map((I) => findW(I.id)).filter((W) => W && trafficOn(effCfg(W))); if (!ws.length) return;
  const km = Math.max(...ws.map((W) => +effCfg(W).trafficR || 25)), nm = Math.min(250, Math.max(3, Math.ceil(km / 1.852)));
  st.trafficBusy = true;
  try {
    const r = await fetch(`https://opendata.adsb.fi/api/v3/lat/${f.lat.toFixed(4)}/lon/${f.lon.toFixed(4)}/dist/${nm}`); if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(); const arr = j.aircraft || j.ac || [];
    st.traffic = arr.filter((a) => a.lat != null && a.lon != null && a.alt_baro !== 'ground' && typeof a.alt_baro === 'number').map((a) => ({ hex: a.hex, call: (a.flight || '').trim() || a.r || a.hex, lat: a.lat, lon: a.lon, altM: a.alt_baro * 0.3048, gs: a.gs || 0, trk: a.track != null ? a.track : (a.true_heading ?? 0), kind: trafficKind(a), type: a.t || '', seen: a.seen_pos || 0 }));
    st.trafficAt = Date.now(); st.trafficErr = false; markDirty();
  } catch (e) { st.traffic = []; if (!st.trafficErr) toast('Air traffic not available (' + (e.message || 'blocked') + '). adsb.fi may refuse requests from this page.'); st.trafficErr = true; }
  st.trafficBusy = false;
}
setInterval(loadTraffic, 8000);
const TR_SVG = { small: '<path d="M20 3 L22 14 L36 22 L36 25 L22 21 L22 31 L27 34 L27 36.5 L20 35 L13 36.5 L13 34 L18 31 L18 21 L4 25 L4 22 L18 14 Z"/>', big: '<path d="M20 1 L22.5 11 L38 24 L38 28 L22.5 23 L22 31 L27.5 35 L27.5 38 L20 36.5 L12.5 38 L12.5 35 L18 31 L17.5 23 L2 28 L2 24 L17.5 11 Z"/><circle cx="12" cy="22" r="2" fill="#fff" stroke="none"/><circle cx="28" cy="22" r="2" fill="#fff" stroke="none"/>', heli: '<ellipse cx="20" cy="18" rx="5.5" ry="8"/><path d="M18.8 25 H21.2 V35 H18.8Z"/><path d="M15 36 H25" fill="none" stroke-width="3" stroke-linecap="round"/><path d="M4 18 H36 M20 2 V34" fill="none" stroke-width="2" stroke-linecap="round" opacity=".85"/>' };
const trafficIcon = (kind, col, lab) => L.divIcon({ className: '', html: `<div style="width:60px;text-align:center;font:700 12px Barlow Condensed,sans-serif;color:${col};text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff"><svg viewBox="0 0 40 40" width="${kind === 'big' ? 50 : 42}" height="${kind === 'big' ? 50 : 42}" style="display:block;margin:0 auto;overflow:visible"><g class="trg" fill="${col}" stroke="#fff" stroke-width="2" stroke-linejoin="round">${TR_SVG[kind]}</g></svg>${esc(lab)}</div>`, iconSize: [60, 66], iconAnchor: [30, 25] });
function trafficDraw(I, C, mb, f) {
  const g = I.g.traffic, tm = I.tmk || (I.tmk = new Map());
  { const ATTR = 'Air traffic: <a href="https://adsb.fi" target="_blank" rel="noopener">adsb.fi</a>', want = trafficOn(C); if (!!I.trAttr !== want) { I.trAttr = want; const ac = I.m.attributionControl; if (ac) want ? ac.addAttribution(ATTR) : ac.removeAttribution(ATTR); } }
  if (!trafficOn(C) || !f) { if (tm.size) { g.clearLayers(); tm.clear(); } return; }
  const R = (+C.trafficR || 25) * 1000, band = C.trafficA === undefined ? 1500 : +C.trafficA, now = Date.now(), seen = new Set();
  st.traffic.forEach((a) => {
    const age = Math.min(30, (now - st.trafficAt) / 1000 + a.seen), p = a.gs > 5 ? dest(a.lat, a.lon, a.trk, a.gs * 0.5144 * age) : [a.lat, a.lon];
    const rel = f.alt != null ? a.altM - f.alt : null; if (dist(f.lat, f.lon, p[0], p[1]) > R || (band > 0 && rel != null && Math.abs(rel) > band)) return;
    const col = rel == null ? '#4A5058' : Math.abs(rel) <= 300 ? '#C62828' : Math.abs(rel) <= 800 ? '#E07B00' : '#4A5058';
    const lab = (rel == null ? fAlt(a.altM) : (rel >= 0 ? '+' : '−') + fAlt(Math.abs(rel))) + ' ' + (a.call || ''), sig = a.kind + col + lab; seen.add(a.hex);
    let mk = tm.get(a.hex); if (!mk) { mk = L.marker(p, { icon: trafficIcon(a.kind, col, lab), interactive: false, zIndexOffset: 500 }).addTo(g); mk._sig = sig; tm.set(a.hex, mk); } else { mk.setLatLng(p); if (mk._sig !== sig) { mk.setIcon(trafficIcon(a.kind, col, lab)); mk._sig = sig; } }
    const el = mk.getElement(), gg = el && el.querySelector('.trg'); if (gg) gg.setAttribute('transform', `rotate(${a.trk + mb} 20 20)`);
  });
  tm.forEach((mk, k) => { if (!seen.has(k)) { g.removeLayer(mk); tm.delete(k); } });
}
function mapLive(I, on) { if (I.live === on) return; I.live = on; const m = I.m; ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom', 'boxZoom', 'keyboard'].forEach((h) => { if (m[h]) on ? m[h].enable() : m[h].disable(); }); I.box.classList.toggle('live', on); }
function mapMount(el, E) {
  const box = el.querySelector('.wbg'); box.style.display = 'block'; box.classList.add('live');
  const m = L.map(box, { zoomControl: false, rotate: hasRot(), rotateControl: false, touchRotate: false, bearing: 0, attributionControl: true });
  const f = st.fix; m.setView(f ? [f.lat, f.lon] : [63.10, 21.62], +E.cfg.z || 12);
  L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(m);
  const I = { id: E.id, el, m, box, live: true, menu: false, follow: true, panAt: 0, g: {}, k: {} };
  I.replayL = L.polyline([], { color: '#6B7280', weight: 2, opacity: 0.6, interactive: false }).addTo(m);
  I.trackHalo = L.polyline([], { color: '#FFFFFF', weight: 8, opacity: 0.7, lineCap: 'round', interactive: false });
  I.trackL = L.polyline([], { color: css('--climb'), weight: 3, interactive: false });
  I.trackG = L.layerGroup().addTo(m);
  ['task', 'air', 'notam', 'places', 'traffic'].forEach((k) => (I.g[k] = L.layerGroup().addTo(m)));
  I.headHalo = L.polyline([], { color: '#FFFFFF', weight: 9, opacity: 0.85, lineCap: 'round', interactive: false });
  I.headL = L.polyline([], { color: HCOL, weight: 4.5, dashArray: '1 10', lineCap: 'round', interactive: false });
  I.predNow = L.circleMarker([0, 0], { radius: 10, color: '#FFFFFF', weight: 3, fillColor: HCOL, fillOpacity: 1, interactive: false });
  I.predWing = L.circleMarker([0, 0], { radius: 11, color: HCOL, weight: 4, fillColor: '#FFFFFF', fillOpacity: 0.9, interactive: false });
  I.start = L.marker([0, 0], { icon: startIcon(), interactive: false });
  I.glider = L.marker(f ? [f.lat, f.lon] : [63.10, 21.62], { icon: gliderIcon(1), interactive: false, zIndexOffset: 1000 }).addTo(m);
  m.on('dragstart', () => { I.follow = false; I.panAt = Date.now(); });
  m.on('dragend', () => { I.panAt = Date.now(); });
  m.on('zoomend', () => { const W0 = findW(I.id); if (!W0) return; cfgW(W0).z = +m.getZoom().toFixed(2); clearTimeout(I.zt); I.zt = setTimeout(save, 600); });
  m.on('click', () => { if (I.menu) { I.menu = false; renderWidgets(); } });
  MAPS.add(I); return I;
}

/* rotation smoothing: [deadband deg, time constant s, max deg/s, max deg per update] */
const SMOOTH = { low: [4, 2, 60, 40], normal: [8, 4, 30, 20], strong: [15, 8, 15, 10] };
function smoothUp(I, rot, target, level, dWp) {
  const now = Date.now(), dt = I.tUp ? clamp((now - I.tUp) / 1000, 0, 5) : 0; I.tUp = now;
  if (I.up === undefined || level === 'off') { I.up = wrap360(target); I.mov = false; return I.up; }
  if (rot === 'bearing' && dWp < 250) return I.up;                     // the bearing is meaningless right at the turnpoint
  const [db0, tau, maxR, maxS] = SMOOTH[level] || SMOOTH.normal, db = rot === 'north' ? 0.5 : db0, diff = angDiff(I.up, target);
  if (!I.mov) { if (Math.abs(diff) <= db) return I.up; I.mov = true; }  // small deviations are accepted: the map holds still
  if (Math.abs(diff) <= db * 0.35) { I.mov = false; return I.up; }       // settled
  let step = diff * (1 - Math.exp(-dt / tau)); const lim = Math.min(maxS, maxR * Math.max(dt, 0.05)); step = clamp(step, -lim, lim);
  I.up = wrap360(I.up + step); return I.up;
}
function trackPts(len) { const now = nowT(); let a = st.log.filter((p) => p.lat != null && (!len || p.t > now - len * 60000)); const step = Math.max(1, Math.ceil(a.length / 500)); return a.filter((p, i) => i % step === 0 || i === a.length - 1); }
const LAYER_ICON = '<svg width="24" height="24" viewBox="0 0 26 26" aria-hidden="true"><path d="M13 3l11 6-11 6L2 9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M2 13.5l11 6 11-6M2 18l11 6 11-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
function mapCtl(I, lk, rot, mb) {
  const name = LAYERS[lk].name, r5 = Math.round(mb / 5) * 5;
  const menu = I.menu ? `<div class="mmenu" role="listbox">${Object.entries(LAYERS).map(([k, l]) => `<button class="mi" role="option" data-act="mlayer:${k}" aria-selected="${k === lk}"><span class="sw" style="background:${l.sw[0]};border-color:${l.sw[1]}"></span>${l.name}</button>`).join('')}</div>` : '';
  const left = `<div class="row"><button class="wcb big wide" data-act="mmenu" aria-haspopup="listbox" aria-expanded="${I.menu}" aria-label="Map style: ${name}">${LAYER_ICON}<span style="margin-left:8px;font-size:15px">${name}</span></button><button class="wcb big" data-act="mrot" aria-label="Orientation: ${ROT[rot]}. Tap to change"><svg width="32" height="32" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" stroke-width="2"/><g transform="rotate(${r5} 18 18)"><path d="M18 4l5 14H13z" fill="#B42318"/><path d="M18 32l5-14H13z" fill="currentColor" opacity=".45"/></g></svg><b class="rbadge">${{ north: 'N', track: 'T', bearing: 'B' }[rot]}</b></button></div>${menu}`;
  const right = `<button class="wcb big" data-act="mzin" aria-label="Zoom in">+</button><button class="wcb big" data-act="mzout" aria-label="Zoom out">−</button><button class="wcb big" data-act="mfollow" aria-pressed="${I.follow}" aria-label="Follow my position"><svg width="24" height="24" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="11" cy="11" r="2" fill="currentColor"/><path d="M11 1v4M11 17v4M1 11h4M17 11h4" stroke="currentColor" stroke-width="2"/></svg></button>`;
  return [left, right];
}
function mapDraw(cv, E, el, b) {
  cv.style.display = 'none'; const C = E.cfg;
  const I = el._mi || (el._mi = mapMount(el, E)), m = I.m, f = st.fix, on = (v) => v !== false && v !== 'false';
  const sz = Math.round(b.w) + 'x' + Math.round(b.h); if (I.sz !== sz) { m.invalidateSize(); I.sz = sz; }
  mapLive(I, !wEdit);
  const lk = LAYERS[C.layer] ? C.layer : 'topo';
  if (I.lk !== lk) { if (I.tile) m.removeLayer(I.tile); I.tile = L.tileLayer(LAYERS[lk].url, LAYERS[lk].o).addTo(m); I.tile.bringToBack(); I.lk = lk; }
  if (I.cf !== C.follow) { I.cf = C.follow; I.follow = on(C.follow); }
  const th = !!st.thermMode; if (I.mode !== th) { if (I.mode !== undefined && +C.z) m.setZoom(+C.z, { animate: false }); I.mode = th; }
  if (!I.follow && +C.ret > 0 && I.panAt && Date.now() - I.panAt > C.ret * 1000) { I.follow = true; I.panAt = 0; }
  // overlays only redraw when their data changed
  const ov = (key, g, fn, vk) => { const k = on(C[key]) ? vk : 'off'; if (I.k[key] !== k) { I.k[key] = k; g.clearLayers(); if (k !== 'off') fn(g); } };
  ov('task', I.g.task, drawTaskInto, [st.taskVer, S.cylR, st.nextWp].join('|'));
  ov('air', I.g.air, drawAirInto, 'a' + (st.airVer || 0));
  ov('notam', I.g.notam, drawNotamInto, 'n' + (st.ntVer || 0));
  { const pl = C.places === true || C.places === 'true'; const k = pl ? [st.placesVer, S.poiRadius, JSON.stringify(S.poiKinds), f ? Math.round(f.lat * 100) + ',' + Math.round(f.lon * 100) : ''].join('|') : 'off'; if (I.k.places !== k) { I.k.places = k; I.g.places.clearLayers(); if (pl && f) drawPlacesInto(I.g.places, f); } }
  { const k = st.replay ? 'r' + st.replayVer : 'off'; if (I.k.rp !== k) { I.k.rp = k; I.replayL.setLatLngs(st.replay ? st.replay.pts.map((p) => [p.lat, p.lon]) : []); } }
  // own track, plain or coloured by lift
  { const tm = C.track || 'plain', len = C.trackMin === undefined ? 15 : +C.trackMin, lg = st.log, k = tm + '|' + len + '|' + lg.length + '|' + (lg.length ? lg[lg.length - 1].t : 0);
    if (I.k.trk !== k) {
      I.k.trk = k; I.trackG.clearLayers();
      if (tm === 'off') { I.trackL.remove(); I.trackHalo.remove(); }
      else {
        const pts = trackPts(len), co = pts.map((p) => [p.lat, p.lon]);
        if (tm === 'lift') {
          I.trackL.remove(); I.trackHalo.setLatLngs(co).addTo(m);
          const bk = (v) => (v < -1 ? 0 : v < 0.3 ? 1 : v < 1.2 ? 2 : v < 2.2 ? 3 : 4), BV = [-2, -0.2, 0.7, 1.7, 3]; let cur = null, run = [];
          const flush = () => { if (run.length > 1) L.polyline(run.map((q) => [q.lat, q.lon]), { color: `rgb(${heat(BV[cur]).join(',')})`, weight: 4.5, lineCap: 'round', interactive: false }).addTo(I.trackG); };
          pts.forEach((p) => { const kk = bk(p.v || 0); if (cur === null) { cur = kk; run = [p]; return; } if (kk !== cur) { run.push(p); flush(); cur = kk; run = [p]; } else run.push(p); }); flush();
        } else { I.trackHalo.remove(); I.trackL.setLatLngs(co).addTo(m); }
      }
    } }
  let rot = C.rot || 'north', up = 0, mb = m.getBearing ? m.getBearing() : 0;
  if (f) {
    const ll = [f.lat, f.lon]; I.glider.setLatLng(ll);
    const gk = +C.gsize || 1; if (I.gk !== gk) { I.gk = gk; I.glider.setIcon(gliderIcon(gk)); }
    const wp = st.task && st.task.pts[st.nextWp];
    if (rot === 'bearing' && !wp) rot = 'north'; if (rot === 'track' && f.trk == null) rot = 'north';
    const tgt = rot === 'track' ? f.trk : rot === 'bearing' ? brg(f.lat, f.lon, wp.lat, wp.lon) : 0;
    up = smoothUp(I, rot, tgt, C.smooth || 'normal', rot === 'bearing' ? dist(f.lat, f.lon, wp.lat, wp.lon) : 1e9);
    const want = -up; if (m.setBearing && Math.abs(angDiff(mb, want)) > 0.2) m.setBearing(want); mb = m.getBearing ? m.getBearing() : 0;
    const ge = I.glider.getElement(), gg = ge && ge.querySelector('.glg'); if (gg) gg.setAttribute('transform', `rotate(${(f.trk || 0) + mb} 20 20)`);
    trafficDraw(I, C, mb, f);
    const p = st.pred;
    if (on(C.heading) && f.trk != null) { const len = p.now ? p.now[2] : p.wing ? p.wing[2] : 3000, end = p.now ? [p.now[0], p.now[1]] : dest(f.lat, f.lon, f.trk, len); I.headL.setLatLngs([ll, end]); I.headHalo.setLatLngs([ll, end]); if (!m.hasLayer(I.headL)) { I.headHalo.addTo(m); I.headL.addTo(m); } p.now ? I.predNow.setLatLng([p.now[0], p.now[1]]).addTo(m) : I.predNow.remove(); p.wing ? I.predWing.setLatLng([p.wing[0], p.wing[1]]).addTo(m) : I.predWing.remove(); }
    else { I.headL.remove(); I.headHalo.remove(); I.predNow.remove(); I.predWing.remove(); }
    const sp = on(C.start) ? startPlace() : null; if (sp) I.start.setLatLng([sp.lat, sp.lon]).addTo(m); else I.start.remove();
    if (I.follow) {
      let c = ll; if (rot !== 'north') { const h = m.getSize().y, mpp = 156543.03 * Math.cos(f.lat * D2R) / Math.pow(2, m.getZoom()); c = dest(f.lat, f.lon, up, h * 0.28 * mpp); }
      const cur = m.getCenter(); if (Math.abs(cur.lat - c[0]) > 1e-7 || Math.abs(cur.lng - c[1]) > 1e-7) m.setView(c, m.getZoom(), { animate: false });
    }
  }
  const ctl = on(C.ctl) ? mapCtl(I, lk, rot, mb) : ['', ''], cl = el.querySelector('.wctl.l'), cr = el.querySelector('.wctl.r');
  if (cl._h !== ctl[0]) { cl.innerHTML = ctl[0]; cl._h = ctl[0]; } if (cr._h !== ctl[1]) { cr.innerHTML = ctl[1]; cr._h = ctl[1]; }
  el._sub = '';
}

