'use strict';
/* ================= UI rendering ================= */
const WIDGETS = {
  vario: { n: 'Vario', big: true },
  avg: { n: 'Vario average' }, alt: { n: 'Altitude' }, agl: { n: 'Height above ground' }, gs: { n: 'Ground speed' },
  ld: { n: 'Glide ratio' }, wind: { n: 'Wind' }, next: { n: 'Next turnpoint', wide: true }, thermal: { n: 'Thermal average' },
  flight: { n: 'Flight time' }, utc: { n: 'Time local / UTC' }, temp: { n: 'Temperature' }
};
function wHtml(id) {
  const f = st.fix, alt = altNow(), now = nowT();
  const w = windFromSpd(), av = avgVario(S.avgS, now);
  switch (id) {
    case 'vario': return `<div class="card w big"><div class="row" style="justify-content:space-between"><span class="lbl">Vario ${uV()}</span><span class="lbl">${st.varioSrc === 'gps' ? 'from GPS' : st.varioSrc}</span></div><div class="v num" style="color:${st.vario >= 0 ? css('--climb') : css('--sink')}">${fVario(st.vario)}</div></div>`;
    case 'avg': return tile('Avg ' + S.avgS + ' s', fVario(av), uV());
    case 'alt': return tile('Altitude', fAlt(alt), S.uAlt, st.baro ? 'baro' : 'GPS');
    case 'agl': return tile('Above ground', st.groundElev != null && alt != null ? fAlt(alt - st.groundElev) : '--', S.uAlt, st.groundElev != null ? 'ground ' + fAlt(st.groundElev) : 'needs data');
    case 'gs': return tile('Ground speed', fSpd(f?.spd), S.uSpd, f?.trk != null ? 'trk ' + pad3(f.trk) + '°' : '');
    case 'ld': return tile('Glide ratio', st.ld ? st.ld.toFixed(1) : '--', '', 'wing ' + S.wingLD);
    case 'wind': return tile('Wind', w ? fSpd(w.spd) : '--', S.uSpd, w ? 'from ' + pad3(w.from) + '° ' + compass(w.from) : 'circle once');
    case 'thermal': return tile('Thermal avg', st.thermal ? fVario((alt - st.thermal.alt0) / Math.max(1, ((st.thermal.end || now) - st.thermal.t0) / 1000)) : '--', uV(), st.thermal ? '+' + fAlt(alt - st.thermal.alt0) + ' ' + S.uAlt : '');
    case 'flight': { const t = st.takeoffT ? Math.floor((now - st.takeoffT) / 1000) : null; return tile('Flight time', t != null ? Math.floor(t / 3600) + ':' + pad2(Math.floor(t / 60) % 60) : '--', '', ''); }
    case 'utc': { const d = new Date(); return tile('Local / UTC', pad2(d.getHours()) + ':' + pad2(d.getMinutes()), '', pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ' UTC'); }
    case 'temp': return tile('Temperature', st.baro?.temp != null ? st.baro.temp.toFixed(1) : '--', '°C', '');
    case 'next': {
      if (!st.task) return `<div class="card w" style="grid-column:1/-1"><div class="lbl">Next turnpoint</div><div class="muted" style="font-size:14px;margin-top:4px">No task. Import a route from FlyXC on the Web page.</div></div>`;
      const wp = st.task.pts[st.nextWp]; if (!f || !wp) return '';
      const d = dist(f.lat, f.lon, wp.lat, wp.lon), b = brg(f.lat, f.lon, wp.lat, wp.lon);
      const need = alt != null && st.groundElev != null ? d / Math.max(1, alt - st.groundElev - S.safety) : null;
      const arr = alt != null && st.groundElev != null ? alt - d / S.wingLD - st.groundElev : null;
      return `<div class="card w" style="grid-column:1/-1;border:2px solid var(--sink)"><div class="row" style="justify-content:space-between"><span class="lbl">Next · ${esc(wp.name)} (${st.nextWp + 1}/${st.task.pts.length})</span><span class="lbl">${f.spd > 2 ? 'ETA ' + etaStr(d / f.spd) : ''}</span></div>
        <div class="row" style="gap:14px"><div><div class="s">Dist</div><div class="num" style="font-size:26px">${fDist(d)}</div></div><div><div class="s">Brg</div><div class="num" style="font-size:26px">${pad3(b)}°</div></div><div><div class="s">Req L/D</div><div class="num" style="font-size:26px">${need && need > 0 ? need.toFixed(1) : '--'}</div></div></div>
        <div class="s">${arr != null ? (arr >= 0 ? 'Arrive ' + fAlt(arr) + ' ' + S.uAlt + ' above ground at L/D ' + S.wingLD : 'Short by ' + fAlt(-arr) + ' ' + S.uAlt + ' at L/D ' + S.wingLD) : ''}</div></div>`;
    }
  }
  return '';
}
const pad3 = (b) => String(Math.round(wrap360(b))).padStart(3, '0');
function etaStr(s) { const d = new Date(nowT() + s * 1000); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function tile(l, v, u, s) { return `<div class="card w"><div class="row" style="justify-content:space-between"><span class="lbl">${l}</span><span class="lbl">${u}</span></div><div class="v num">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`; }
function renderTop() {
  const d = new Date(); $('tLocal').textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes()); $('tUtc').textContent = pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ' UTC';
  const vb = st.bora?.batt; let main = '--', sub = 'no vario';
  if (vb) { main = vb.pct != null ? vb.pct + '%' : vb.v.toFixed(2) + ' V'; sub = 'Bora'; } else if (st.sim) { main = (st.simBat || 90) + '%'; sub = 'demo vario'; } else if (st.replay) { main = 'IGC'; sub = 'replay ' + st.replay.speed + '×'; }
  if (st.deviceBat != null) sub += ' · tab ' + st.deviceBat + '%';
  $('batMain').textContent = main; $('batSub').textContent = sub;
  const gAge = st.fix ? nowT() - st.fix.t : 1e9;
  $('dG').className = 'dot ' + (gAge < 4000 ? 'on' : st.gpsOk ? 'bad' : '');
  $('dB').className = 'dot ' + (st.bora ? 'on' : '');
  $('dT').className = 'dot ' + (st.baro?.temp != null ? 'on' : '');
  $('dD').className = 'dot ' + (st.sim || st.replay ? 'on' : '');
  { const chip = $('modeChip'), show = S.modeChip !== false && S.modeChip !== 'false', cand = !st.thermMode && st.circling && st.manual !== 'off';
    chip.style.display = show && (st.thermMode || cand) ? 'flex' : 'none'; chip.classList.toggle('cand', !st.thermMode);
    const tx = st.thermMode ? 'THERMAL' : 'THERMAL?'; if (chip.textContent !== tx) chip.textContent = tx;
    chip.setAttribute('aria-label', st.thermMode ? 'Thermal mode on. Tap to open the thermal page, hold to leave thermal mode' : 'Circling detected. Tap to start thermal mode'); }
}
function renderWarn() {
  const s = airStatus(), w = $('warnBar');
  const hit = s.find((x) => x.inside && x.vert === 'in') || s.find((x) => x.d < 2000 && x.vert === 'in') || s.find((x) => x.inside && x.vert === 'below' && x.lo - x.alt < 150);
  if (!hit) { w.style.display = 'none'; return; }
  w.style.display = 'block';
  w.innerHTML = hit.inside && hit.vert === 'in' ? `<b>Inside ${esc(hit.a.name)}</b> · ${fmtLim(hit.a.lo)} – ${fmtLim(hit.a.hi)}` : hit.inside ? `<b>${Math.round(hit.lo - hit.alt)} m below ${esc(hit.a.name)}</b> floor` : `<b>${esc(hit.a.name)} in ${fDist(hit.d)}</b> · ${fmtLim(hit.a.lo)} – ${fmtLim(hit.a.hi)}`;
}

/* ---------- canvases ---------- */
// canvas sizes come from a ResizeObserver: measuring every canvas on every update forced a full layout each time
const cvRO = typeof ResizeObserver === 'function' ? new ResizeObserver((es) => { let ch = false; es.forEach((e) => { const o = e.target._r, w = e.contentRect.width, h = e.contentRect.height; if (!o || o.width !== w || o.height !== h) { e.target._r = { width: w, height: h }; ch = ch || (!!o && o.width > 0 && w > 0); } }); if (ch) { clearTimeout(cvROT); cvROT = setTimeout(markDirty, 80); } }) : null;
let cvROT = 0;
function cvSize(cv) { let r = cv._r; if (!r || !r.width) { const b = cv.getBoundingClientRect(); r = { width: b.width, height: b.height }; if (cvRO && cv.closest('.wg')) { if (!cv._r) cvRO.observe(cv); cv._r = r; } } return r; }
function fitCanvas(cv) { const r = cvSize(cv), dpr = window.devicePixelRatio || 1; const w = Math.max(10, r.width), h = Math.max(10, r.height || +cv.getAttribute('height') || 100); if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); } const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, w, h]; }
function climbCol(v) { return v >= 2.5 ? css('--climb') : v >= 1.5 ? css('--climb2') : v >= 0.5 ? css('--climb3') : null; }
function histDraw(cv) {
  const [c, W, H] = fitCanvas(cv); c.clearRect(0, 0, W, H);
  const now = nowT(), bins = 40, bw = W / bins, mid = H * 0.6;
  c.strokeStyle = css('--ink'); c.beginPath(); c.moveTo(0, mid); c.lineTo(W, mid); c.stroke();
  for (let i = 0; i < bins; i++) { const t0 = now - 120000 + i * 3000; const a = st.varioHist.filter((h) => h.t >= t0 && h.t < t0 + 3000); if (!a.length) continue; const v = a.reduce((s, h) => s + h.v, 0) / a.length; const hh = clamp(v, -3, 5) * 9; c.fillStyle = v >= 0 ? (v >= 2 ? css('--climb') : css('--climb3')) : css('--sink'); c.fillRect(i * bw + 1, v >= 0 ? mid - hh : mid, bw - 2, Math.abs(hh)); }
}
function visiblePlaces() { const f = st.fix; if (!f) return []; const sp = startPlace(); return (sp ? [sp] : []).concat(st.places.filter((p) => S.poiKinds[p.kind] && dist(f.lat, f.lon, p.lat, p.lon) <= S.poiRadius * 1000)); }
function openNotam(i) { const x = ntView[i]; if (!x) return; const n = x.n; $('dlgBody').innerHTML = `<div class="row"><span class="badge ${x.s === 'active' ? 'act' : ''}">${x.s === 'active' ? 'Active' : 'Later'}</span><span class="num grow" style="font-size:26px">${esc(n.id)} · ${esc(n.ad || n.sec)}</span><button class="btn primary" id="dlgClose">Close</button></div>
  <div class="wgrid" style="grid-template-columns:repeat(4,1fr)"><div><div class="lbl">From</div><b>${fmtZ(n.from)}</b></div><div><div class="lbl">Until</div><b>${esc(n.to ? fmtZ(n.to) : n.toTxt)}</b></div><div><div class="lbl">Vertical</div><b>${esc(n.lower ? n.lower + ' – ' + n.upper : '–')}</b></div><div><div class="lbl">From you</div><b>${x.d == null ? 'no position' : x.d === 0 ? 'inside' : fDist(x.d)}</b></div></div>
  ${n.sched ? `<div><span class="lbl">Schedule (UTC)</span><br><b>${esc(n.sched)}</b></div>` : ''}
  <div class="lbl">Full text</div><pre class="raw">${esc(n.text)}\n\nFROM ${esc(n.fromTxt)} TO ${esc(n.toTxt)}${n.lower ? '\nLOWER ' + esc(n.lower) + ' UPPER ' + esc(n.upper) : ''}${n.sched ? '\nSCHEDULE ' + esc(n.sched) : ''}</pre>
  <div class="muted" style="font-size:12px">Source: ais.fi pre-flight information bulletin. Always confirm in the official bulletin.</div>`; $('dlg').style.display = 'flex'; $('dlgClose').onclick = () => ($('dlg').style.display = 'none'); }
function drawNotamAreas() { st.ntVer = (st.ntVer || 0) + 1; }


/* ----- lift colours, shared helpers ----- */
const HEAT = [[-3, [28, 52, 140]], [-1.5, [66, 120, 206]], [-0.5, [160, 196, 236]], [0.25, [240, 240, 236]], [0.9, [255, 238, 120]], [1.7, [255, 184, 48]], [2.6, [240, 104, 30]], [3.6, [206, 32, 44]], [5, [130, 0, 120]]];
function heat(v) { if (v <= HEAT[0][0]) return HEAT[0][1]; for (let i = 1; i < HEAT.length; i++) { if (v <= HEAT[i][0]) { const [v0, c0] = HEAT[i - 1], [v1, c1] = HEAT[i]; const t = (v - v0) / (v1 - v0); return c0.map((x, k) => Math.round(x + (c1[k] - x) * t)); } } return HEAT[HEAT.length - 1][1]; }
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
// soft heat dot, pre-rendered once per colour step at the largest size and scaled when drawn (a new gradient for every sample was slow)
const blobC = new Map();
function heatBlob(v) {
  const r = 46, q = Math.round(v * 10) / 10, dpr = window.devicePixelRatio || 1, k = q + '|' + dpr; let b = blobC.get(k); if (b) return b;
  if (blobC.size > 300) blobC.clear();
  b = document.createElement('canvas'); b.width = b.height = Math.ceil(2 * r * dpr); const g = b.getContext('2d'); g.scale(dpr, dpr);
  const col = heat(q), gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, rgba(col, 0.6)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, 2 * r, 2 * r);
  blobC.set(k, b); return b;
}
const fmtDur = (n) => (n < 90 ? Math.round(n) + ' s' : n % 60 === 0 ? n / 60 + ' min' : (n / 60).toFixed(1) + ' min');
const histL = (h) => (h === 'thermal' ? 'Th' : h === 'circle' ? '1c' : h < 90 ? Math.round(h) + 's' : h % 60 === 0 ? h / 60 + 'm' : (h / 60).toFixed(1) + 'm');
const histN = (h) => (h === 'thermal' ? 'this thermal' : h === 'circle' ? 'last circle' : fmtDur(h));
const numOpt = (min, max, step, unit, presets, o) => Object.assign({ num: true, min, max, step, snap: 1, unit, presets }, o || {});
const HIST_O = [30, 60, 120, 180, 300, 'thermal', 'circle'];
function coreEstimate() {
  const f = st.fix; if (!f) return null; const now = f.t, wv = st.wind || { vx: 0, vy: 0 };
  const pts = st.samples.filter((s) => s.t > now - 60000).map((s) => { let [x, y] = enu(f.lat, f.lon, s.lat, s.lon); const dt = (now - s.t) / 1000; x += wv.vx * dt; y += wv.vy * dt; return { x, y, v: s.v }; });
  const good = pts.filter((p) => p.v > 0.3); if (good.length < 5) return null;
  const mn = Math.min(...pts.map((p) => p.v)); let sw = 0, sx = 0, sy = 0; good.forEach((p) => { const k = (p.v - mn) ** 2; sw += k; sx += p.x * k; sy += p.y * k; }); if (!sw) return null;
  const x = sx / sw, y = sy / sw; return { x, y, d: Math.hypot(x, y), b: wrap360(Math.atan2(x, y) * R2D), v: Math.max(...good.map((p) => p.v)) };
}
const hasRot = () => !!(window.L && L.Map && L.Map.prototype.setBearing);
const haloText = (c, t, x, y, fill, halo) => { c.save(); c.lineWidth = 3.5; c.strokeStyle = halo; c.lineJoin = 'round'; c.strokeText(t, x, y); c.restore(); c.fillStyle = fill; c.fillText(t, x, y); };

/* ----- Thermal assistant: heat map, history, zoom, optional map behind ----- */
function taDraw(cv, W, el) {
  const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H);
  const cfg = W.cfg, f = st.fix, w = windFromSpd();
  const orient = cfg.orient || S.taOrient || 'wind';
  const hist = cfg.hist === 'thermal' || cfg.hist === 'circle' ? cfg.hist : +(cfg.hist ?? 120);
  const style = cfg.style || 'trail', trailSt = style === 'trail' || style === 'trailonly';
  const wantBg = (cfg.bgMap === true || cfg.bgMap === 'true') && hasRot();
  let up = 0, upName = 'north';
  if (orient === 'wind' && w) { up = w.from; upName = 'wind'; } else if (orient === 'track' && f && f.trk != null) { up = f.trk; upName = 'track'; }
  el._sub = upName + ' up · ' + histN(hist) + (orient === 'wind' && !w ? ' · no wind yet' : '');
  const ctlL = `<button class="wcb" data-act="orient" aria-label="Up is ${orient}">${orient === 'wind' ? 'W↑' : orient === 'track' ? 'T↑' : 'N↑'}</button><button class="wcb" data-act="hist" aria-label="History ${histN(hist)}">${histL(hist)}</button><button class="wcb" data-act="bg" aria-pressed="${wantBg}" aria-label="Map behind">Map</button>`;
  const ctlR = '<button class="wcb" data-act="zin" aria-label="Zoom in">+</button><button class="wcb" data-act="zout" aria-label="Zoom out">−</button><button class="wcb" data-act="zfit" aria-label="Fit">Fit</button>';
  const cl = el.querySelector('.wctl.l'), cr = el.querySelector('.wctl.r');
  if (cl._h !== ctlL) { cl.innerHTML = ctlL; cl._h = ctlL; } if (cr._h !== ctlR) { cr.innerHTML = ctlR; cr._h = ctlR; }
  const bgEl = el.querySelector('.wbg'), cx = Wd / 2, cy = H / 2, R = Math.max(30, Math.min(Wd, H) / 2 - 12), dark = document.body.classList.contains('dark');
  if (!f) { bgEl.style.display = 'none'; c.fillStyle = css('--muted'); c.font = '14px Barlow'; c.textAlign = 'center'; c.fillText('Waiting for GPS…', cx, cy); return; }
  const now = f.t;
  const tmin = hist === 'thermal' ? (st.thermal ? st.thermal.t0 : now - 120000) : hist === 'circle' ? now - (st.lastTurn ? st.lastTurn.T * 1000 * 1.05 : 25000) : now - hist * 1000;
  const wv = st.wind || { vx: 0, vy: 0 };
  const loc = st.samples.filter((s) => s.t >= tmin).map((s) => { let [x, y] = enu(f.lat, f.lon, s.lat, s.lon); if (!wantBg) { const dt = (now - s.t) / 1000; x += wv.vx * dt; y += wv.vy * dt; } return { x, y, v: s.v, t: s.t }; });
  const steps = [40, 60, 100, 150, 250, 400, 700, 1000, 1500, 2500, 4000];
  const maxD = Math.max(30, ...loc.map((p) => Math.hypot(p.x, p.y)));
  const zoom = clamp(+cfg.zoom || 1, 0.25, 8);
  // fixed scale (default): the ring radius stays the same; Auto grows it to fit the history
  const sc = R / (cfg.scale === 'auto' ? (steps.find((s) => s >= maxD * 1.05) || 4000) : clamp(+cfg.range || 200, 30, 5000)) * zoom, Rm = R / sc;
  // rotate so that bearing `up` points to the top of the screen
  const a = up * D2R, ca = Math.cos(a), sa = Math.sin(a);
  const tr = (x, y) => [cx + (x * ca - y * sa) * sc, cy - (x * sa + y * ca) * sc];
  if (wantBg) {
    bgEl.style.display = 'block';
    if (!el._tm) el._tm = L.map(bgEl, { zoomControl: false, attributionControl: false, rotate: true, rotateControl: false, touchRotate: false, bearing: 0, dragging: false, scrollWheelZoom: false, touchZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, zoomSnap: 0, zoomAnimation: false, fadeAnimation: false, maxZoom: 22 });
    const m = el._tm, sz = Wd + 'x' + H; if (el._tsz !== sz) { m.invalidateSize(); el._tsz = sz; }
    const lk = LAYERS[cfg.bgLayer] ? cfg.bgLayer : (LAYERS[S.layer] ? S.layer : 'topo');
    if (el._tlk !== lk) { if (el._ttl) m.removeLayer(el._ttl); el._ttl = L.tileLayer(LAYERS[lk].url, Object.assign({}, LAYERS[lk].o, { maxNativeZoom: LAYERS[lk].o.maxZoom, maxZoom: 22 })).addTo(m); el._tlk = lk; }
    const z = clamp(Math.log2(156543.03392 * Math.cos(f.lat * D2R) * sc), 3, 21);
    m.setView([f.lat, f.lon], z, { animate: false }); m.setBearing(-up);
    c.fillStyle = dark ? 'rgba(14,18,22,.30)' : 'rgba(255,255,255,.30)'; c.fillRect(0, 0, Wd, H);
  } else bgEl.style.display = 'none';
  // scale rings
  const RS = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 4000], ringM = RS.find((v) => Rm / v <= 4) || 4000;
  c.lineWidth = 1; c.strokeStyle = wantBg ? 'rgba(17,20,24,.35)' : css('--line'); c.font = '11px Barlow'; c.textAlign = 'left';
  for (let k = 1; k * ringM <= Rm * 1.02; k++) { const r = k * ringM * sc; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke(); const lx = cx + r * 0.7071, ly = cy + r * 0.7071; if (lx < Wd - 34 && ly < H - 8) haloText(c, k * ringM + ' m', lx + 2, ly + 4, css('--muted'), wantBg ? 'rgba(255,255,255,.85)' : css('--card')); }
  // heat blobs
  if (style !== 'dots' && style !== 'trailonly') { const rr = clamp(16 * sc, 12, 46); loc.forEach((p) => { const [x, y] = tr(p.x, p.y); if (x < -rr || x > Wd + rr || y < -rr || y > H + rr) return; c.drawImage(heatBlob(p.v), x - rr, y - rr, 2 * rr, 2 * rr); }); }
  // track line: thin = older, thick = newest
  const newMs = clamp(st.lastTurn ? st.lastTurn.T * 1000 : 15000, 8000, 25000), ink = css('--ink'), card = css('--card');
  if (!trailSt && cfg.trail !== false && cfg.trail !== 'false' && loc.length > 1) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.strokeStyle = wantBg ? 'rgba(17,20,24,.45)' : 'rgba(80,90,100,.35)'; c.lineWidth = 1.5; c.beginPath(); loc.forEach((p, i) => { const [x, y] = tr(p.x, p.y); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
    const rc = loc.filter((p) => now - p.t < newMs);
    if (rc.length > 1) { c.strokeStyle = ink; c.lineWidth = 3; c.beginPath(); rc.forEach((p, i) => { const [x, y] = tr(p.x, p.y); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); }
  }
  // trail: a band along your path coloured by climb, with a thin outline (stronger on the last circle)
  if (trailSt && loc.length > 1) {
    const span = Math.max(1, now - tmin), w = 9, path = (arr) => { c.beginPath(); arr.forEach((p, i) => { const [x, y] = tr(p.x, p.y); i ? c.lineTo(x, y) : c.moveTo(x, y); }); };
    c.lineJoin = 'round'; c.lineCap = 'round';
    path(loc); c.strokeStyle = wantBg ? 'rgba(17,20,24,.7)' : dark ? 'rgba(230,234,238,.5)' : 'rgba(17,20,24,.5)'; c.lineWidth = w + 2.5; c.stroke();
    const rc = loc.filter((p) => now - p.t < newMs); if (rc.length > 1) { path(rc); c.strokeStyle = ink; c.lineWidth = w + 4; c.stroke(); }
    c.lineWidth = w;
    for (let i = 1; i < loc.length; i++) { const a = loc[i - 1], b = loc[i], [x0, y0] = tr(a.x, a.y), [x1, y1] = tr(b.x, b.y); if (Math.max(x0, x1) < -w || Math.min(x0, x1) > Wd + w || Math.max(y0, y1) < -w || Math.min(y0, y1) > H + w) continue;
      c.strokeStyle = rgba(heat((a.v + b.v) / 2), 0.6 + 0.4 * clamp(1 - (now - b.t) / span, 0, 1)); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    const last = loc[loc.length - 1], [lx, ly] = tr(last.x, last.y); c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.arc(lx, ly, 15, 0, 7); c.stroke();
  }
  // dots: outline gets thicker and darker the newer the sample
  if (style === 'both' || style === 'dots') {
    const span = Math.max(1, now - tmin);
    loc.forEach((p) => {
      const [x, y] = tr(p.x, p.y); if (x < -14 || x > Wd + 14 || y < -14 || y > H + 14) return;
      const r = clamp(3.5 + Math.abs(p.v) * 1.6, 3.5, 11), rec = clamp(1 - (now - p.t) / span, 0, 1), isNew = now - p.t < newMs;
      if (isNew) { c.fillStyle = card; c.beginPath(); c.arc(x, y, r + 2.5, 0, 7); c.fill(); }
      c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = rgba(heat(p.v), 1); c.fill();
      c.lineWidth = isNew ? 3 : 0.8 + 1.4 * rec; c.strokeStyle = isNew ? ink : (dark ? `rgba(230,234,238,${0.25 + 0.5 * rec})` : `rgba(17,20,24,${0.25 + 0.5 * rec})`); c.stroke();
    });
    const last = loc[loc.length - 1]; if (last) { const [x, y] = tr(last.x, last.y); c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 15, 0, 7); c.stroke(); }
  }
  // core
  const core = coreEstimate();
  if (core) {
    const [x, y] = tr(core.x, core.y);
    c.save(); c.setLineDash([5, 5]); c.lineWidth = 1.5; c.strokeStyle = ink; c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke(); c.restore();
    c.strokeStyle = card; c.lineWidth = 7; c.beginPath(); c.moveTo(x - 9, y - 9); c.lineTo(x + 9, y + 9); c.moveTo(x + 9, y - 9); c.lineTo(x - 9, y + 9); c.stroke();
    c.strokeStyle = ink; c.lineWidth = 3.5; c.beginPath(); c.moveTo(x - 9, y - 9); c.lineTo(x + 9, y + 9); c.moveTo(x + 9, y - 9); c.lineTo(x - 9, y + 9); c.stroke();
    c.font = '700 13px Barlow'; c.textAlign = 'left'; haloText(c, 'core ' + fVario(core.v), clamp(x + 12, 4, Wd - 80), clamp(y - 8, 14, H - 6), ink, wantBg ? 'rgba(255,255,255,.9)' : card);
  }
  // wind arrow at the rim, pointing the way the wind blows
  if (w) {
    const p1 = tr(Math.sin(w.from * D2R) * Rm * 0.97, Math.cos(w.from * D2R) * Rm * 0.97), p2 = tr(Math.sin(w.from * D2R) * Rm * 0.76, Math.cos(w.from * D2R) * Rm * 0.76), ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const arrow = (col, lw) => { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.stroke(); c.beginPath(); c.moveTo(p2[0] + 4 * Math.cos(ang), p2[1] + 4 * Math.sin(ang)); c.lineTo(p2[0] - 11 * Math.cos(ang - 0.5), p2[1] - 11 * Math.sin(ang - 0.5)); c.lineTo(p2[0] - 11 * Math.cos(ang + 0.5), p2[1] - 11 * Math.sin(ang + 0.5)); c.closePath(); c.fill(); };
    arrow(card, 7); arrow(css('--sink'), 3.5);
    const wtxt = withU('uSpd', cfg.units || '', () => fSpd(w.spd) + ' ' + S.uSpd);
    const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2, nx = -(p2[1] - p1[1]), ny = p2[0] - p1[0], nl = Math.hypot(nx, ny) || 1;
    c.font = '700 14px Barlow'; c.textAlign = 'center'; const tw = c.measureText(wtxt).width / 2 + 8;
    let best = null; [1, -1].forEach((sg) => { const lx = mx + sg * nx / nl * (tw + 10), ly = my + sg * ny / nl * (tw + 10) * 0.35; const ok = lx - tw > 2 && lx + tw < Wd - 2 && ly > 16 && ly < H - 6; if (ok && !best) best = [lx, ly]; });
    if (!best) best = [clamp(mx, tw + 2, Wd - tw - 2), clamp(my + 18, 16, H - 6)];
    haloText(c, wtxt, best[0], best[1] + 5, css('--sink'), wantBg ? 'rgba(255,255,255,.92)' : card);
  }
  // north marker
  { const [nx, ny] = tr(0, Rm * 0.97); c.font = '700 15px Barlow'; c.textAlign = 'center'; haloText(c, 'N', clamp(nx, 10, Wd - 10), clamp(ny + 5, 16, H - 4), '#B42318', wantBg ? 'rgba(255,255,255,.9)' : card); }
  // glider
  c.save(); c.translate(cx, cy); c.rotate(((f.trk ?? up) - up) * D2R); c.fillStyle = ink; c.strokeStyle = card; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -14); c.lineTo(10, 12); c.lineTo(0, 6); c.lineTo(-10, 12); c.closePath(); c.fill(); c.stroke(); c.restore();
  // colour scale
  if (cfg.legend !== false && cfg.legend !== 'false') {
    const lw = Math.min(130, Wd * 0.38), lx = 8, ly = H - 20; c.fillStyle = card; c.fillRect(lx - 4, ly - 6, lw + 8, 28);
    for (let i = 0; i < lw; i++) { c.fillStyle = rgba(heat(-3 + 8 * i / lw), 1); c.fillRect(lx + i, ly, 1.5, 7); }
    c.font = '10px Barlow'; c.fillStyle = css('--muted'); c.textAlign = 'center'; [-2, 0, 2, 4].forEach((v) => c.fillText(fVario(v).replace('+', ''), lx + (v + 3) / 8 * lw, ly + 18)); c.textAlign = 'left';
  }
  if (!loc.length) { c.fillStyle = css('--muted'); c.font = '14px Barlow'; c.textAlign = 'center'; c.fillText('Lift shows here once you are flying', cx, cy + R * 0.55); }
}
/* ----- Thermal side views: your recent track around you, seen from the side ----- */
// view 'along': axis = downwind (you see upwind ← → downwind, i.e. how the thermal leans with the wind)
// view 'cross': axis = 90° right of downwind (you see the thermal from downwind, left ← → right)
function sideAxis(view) {
  const th = st.thermal, w = windFromSpd();
  // keep the axis of the current thermal fixed, so a changing wind estimate cannot swing the picture around
  if (th && th.axis == null && w) th.axis = w.to;
  const base = th && th.axis != null ? th.axis : w ? w.to : null;
  return { ax: wrap360((base ?? 0) + (view === 'cross' ? 90 : 0)), hasWind: base != null };
}
// circle-averaged centres between t0 and t1: averaging over one full turn removes the wobble of circling
function liftCentres(t0, t1, rel) {
  const raw = st.samples.filter((s) => s.t >= t0 && s.t <= t1 && s.alt != null); if (raw.length < 6) return [];
  const T = clamp(st.lastTurn ? st.lastTurn.T : 14, 8, 30) * 1000; if (raw[raw.length - 1].t - raw[0].t < T * 0.95) return [];
  const xy = raw.map((s) => { const [x, y] = rel(s); return { t: s.t, x, y, alt: s.alt, v: s.v }; });
  const out = []; let lo = 0, last = -1e18;
  for (let i = 0; i < xy.length; i++) {
    const t = xy[i].t; if (t - xy[0].t < T * 0.95) continue; if (t - last < 1400 && i < xy.length - 1) continue;
    while (xy[lo].t <= t - T) lo++;
    let sx = 0, sy = 0, sa = 0, sv = 0; const n = i - lo + 1; for (let k = lo; k <= i; k++) { sx += xy[k].x; sy += xy[k].y; sa += xy[k].alt; sv += xy[k].v; }
    out.push({ t, x: sx / n, y: sy / n, alt: sa / n, v: sv / n }); last = t;
  }
  return out;
}
// a finished thermal keeps its shape (circle centres in the moving air, so the column stands as you climbed it)
// anchored where you left it over the ground (q.lat/q.lon): it stays at that place in the side views
function rememberThermal(q) {
  try { const wv = st.wind || { vx: 0, vy: 0 }; q.cLL = liftCentres(q.t0, q.t1, (s) => { const [x, y] = enu(q.lat, q.lon, s.lat, s.lon), dt = (q.t1 - s.t) / 1000; return [x + wv.vx * dt, y + wv.vy * dt]; }); } catch (e) { q.cLL = []; }
}
function leanFit(C) { const n = C.length; if (n < 3) return null; const ma = C.reduce((q, p) => q + p.alt, 0) / n, ms = C.reduce((q, p) => q + p.s, 0) / n; let num = 0, den = 0; C.forEach((p) => { num += (p.alt - ma) * (p.s - ms); den += (p.alt - ma) ** 2; }); return den > 25 && Math.abs(num / den) < 3 ? { k: num / den, at: (a) => ms + (num / den) * (a - ma) } : null; }
function steadyRange(cv, key, lo, hi) { const r = cv._rng || (cv._rng = {}); let [a, b] = r[key] || [lo, hi]; a = lo < a ? lo : a + (lo - a) * 0.08; b = hi > b ? hi : b + (hi - b) * 0.08; r[key] = [a, b]; return [a, b]; }
function sideDraw(cv, W) {
  const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H); const f = st.fix, alt = altNow();
  const view = W.type === 'tcross' ? 'cross' : 'along', hist = clamp(+W.cfg.hist || 180, 30, 600) * 1000;
  if (!f || alt == null) { c.fillStyle = css('--muted'); c.font = '14px Barlow'; c.textAlign = 'center'; c.fillText('Waiting for GPS…', Wd / 2, H / 2); return; }
  const { ax, hasWind } = sideAxis(view), ux = Math.sin(ax * D2R), uy = Math.cos(ax * D2R), now = f.t, th = st.thermal;
  if (cv._ax !== ax) { cv._rng = null; cv._ax = ax; }
  const proj = (x, y) => x * ux + y * uy, wv = st.wind || { vx: 0, vy: 0 };
  // positions relative to you (you are at 0), in the moving air like the thermal assistant: older points move on with the wind,
  // so a column shows its real lean in the air instead of your drift
  const rel = (s) => { const [x, y] = enu(f.lat, f.lon, s.lat, s.lon), dt = (now - s.t) / 1000; return [x + wv.vx * dt, y + wv.vy * dt]; };
  const P = st.samples.filter((s) => s.t >= now - hist && s.alt != null).map((s) => { const [x, y] = rel(s); return { t: s.t, s: proj(x, y), alt: s.alt, v: s.v }; });
  // lifting sections: the current thermal and earlier ones still inside the history window
  const r0 = clamp(st.lastTurn ? st.lastTurn.avg : 40, 20, 90), cols = [];
  // finished thermals stay for `keep` minutes, pinned where they were over the ground (thermals stay over their source)
  const keep = clamp(+W.cfg.keep || 5, 1, 30) * 60000, ext = clamp(W.cfg.ext == null || W.cfg.ext === '' ? 200 : +W.cfg.ext, 0, 1000), live = th && !th.end;
  st.thermals.filter((q) => q.t1 > now - keep && q.avg > 0.2 && !(live && q.t0 === th.t0)).forEach((q) => {
    if (!q.cLL) rememberThermal(q); if (!q.cLL || q.cLL.length < 2) return;
    const [ax0, ay0] = enu(f.lat, f.lon, q.lat, q.lon), C = q.cLL.map((p) => ({ x: ax0 + p.x, y: ay0 + p.y, alt: p.alt, v: p.v, t: p.t })); cols.push({ C, cur: false, mem: true, q, t0: q.t0, t1: q.t1 }); });
  if (live) { const C = liftCentres(th.t0, now, rel); if (C.length) cols.push({ C, cur: true, t0: th.t0, t1: now }); }
  cols.forEach((col) => { col.C.forEach((p) => (p.s = proj(p.x, p.y))); col.lean = leanFit(col.C); });
  // the current column's lean: least squares of position against height
  let lean = null; const cur = cols.find((q) => q.cur);
  if (cur && cur.C.length >= 4) lean = cur.lean;
  const top = thermalTop(), above = cur && st.circling ? ext : 0;
  // ranges: you in the middle horizontally, everything shown vertically
  let span = 150; P.forEach((p) => (span = Math.max(span, Math.abs(p.s) + 30))); cols.filter((q) => !q.mem).forEach((q) => q.C.forEach((p) => (span = Math.max(span, Math.abs(p.s) + r0 + 20))));
  let aLo = alt - 60, aHi = alt + 60 + above; P.forEach((p) => { aLo = Math.min(aLo, p.alt - 30); aHi = Math.max(aHi, p.alt + 30); });
  // fixed scale (default): metres per pixel never change, you stay at the same place and the grid moves; Auto fits everything in
  const fixed = W.cfg.scale !== 'auto', zm = clamp(+W.cfg.zoom || 1, 0.25, 8), vs = clamp(+W.cfg.vspan || 400, 100, 3000) / zm;
  const [smin, smax] = fixed ? [-1, 1].map((k) => k * clamp(+W.cfg.range || 300, 50, 5000) / zm) : steadyRange(cv, 's', -span, span),
    [amin, amax] = fixed ? [alt - vs * 0.55, alt + vs * 0.45] : steadyRange(cv, 'a', aLo, aHi), sr = Math.max(-smin, smax);
  const L0 = 34, X = (v) => L0 + (v + sr) / (2 * sr) * (Wd - L0 - 8), Y = (a) => H - 26 - (a - amin) / (amax - amin) * (H - 46), mpx = (Wd - L0 - 8) / (2 * sr);
  const ink = css('--ink'), card = css('--card'), muted = css('--muted');
  // grid
  c.strokeStyle = css('--line'); c.fillStyle = muted; c.font = '11px Barlow'; c.lineWidth = 1; c.textAlign = 'left';
  const as = niceStep((amax - amin) / 5); for (let a = Math.ceil(amin / as) * as; a < amax; a += as) { c.beginPath(); c.moveTo(L0 - 2, Y(a)); c.lineTo(Wd, Y(a)); c.stroke(); c.fillText(fAlt(a), 0, Y(a) + 4); }
  const ss = niceStep(sr / Math.max(1, Math.floor((Wd - L0) / 110))); c.textAlign = 'center'; for (let v = -Math.floor(sr / ss) * ss; v <= sr; v += ss) { c.beginPath(); c.moveTo(X(v), 14); c.lineTo(X(v), H - 26); c.stroke(); if (Math.abs(X(v) - X(0)) > 4 || v === 0) c.fillText(v === 0 ? '0' : Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + ' km' : Math.round(v) + ' m', X(v), H - 14); }
  // lifting sections, coloured by the climb in each part
  cols.forEach(({ C, cur: isCur, mem, q, lean: ln }) => {
    const fade = mem ? 1 - 0.6 * (now - q.t1) / keep : 1, wa0 = Math.max(9, r0 * mpx), topP = C.reduce((m, p) => (p.alt > m.alt ? p : m), C[0]);
    if (mem) {
      const sMid = C.reduce((m, p) => m + p.s, 0) / C.length;
      if (Math.abs(sMid) > sr * 0.97) { // off to the side: a marker at the edge with direction, distance and climb
        const right = sMid > 0, xe = right ? Wd - 6 : L0 + 2, ye = clamp(Y((topP.alt + C[0].alt) / 2), 30, H - 40), d = Math.hypot(topP.x, topP.y);
        c.fillStyle = rgba(heat(q.avg), 1); c.strokeStyle = ink; c.lineWidth = 1.5; c.beginPath(); c.moveTo(xe, ye); c.lineTo(xe + (right ? -12 : 12), ye - 8); c.lineTo(xe + (right ? -12 : 12), ye + 8); c.closePath(); c.fill(); c.stroke();
        c.font = '700 11px Barlow'; c.textAlign = right ? 'right' : 'left'; haloText(c, `${fVario(q.avg)} · ${d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'}`, xe + (right ? -16 : 16), ye + 4, ink, card);
        return;
      }
    }
    // dashed column where this thermal should continue above its top (the current one: above you)
    if (ln && ext > 0 && (mem || (isCur && above > 0))) { const a0 = mem ? topP.alt : alt, a1 = a0 + ext; c.globalAlpha = fade; c.strokeStyle = ink; c.lineWidth = 1.5; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(X(ln.at(a0)) - wa0, Y(a0)); c.lineTo(X(ln.at(a1)) - wa0, Y(a1)); c.moveTo(X(ln.at(a0)) + wa0, Y(a0)); c.lineTo(X(ln.at(a1)) + wa0, Y(a1)); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
    if (mem) { const age = Math.round((now - q.t1) / 60000); c.font = '700 11px Barlow'; c.textAlign = 'center'; const lx = clamp(X(topP.s), L0 + 30, Wd - 30), ly = clamp(Y(topP.alt + (ln ? ext : 0)) - 6, 44, H - 30); haloText(c, `${fVario(q.avg)} · ${age < 1 ? 'now' : age + ' min'}`, lx, ly, ink, card); }
    c.globalAlpha = (isCur ? 0.55 : 0.35) * fade;
    for (let i = 0; i < C.length - 1; i++) { const a = C[i], b = C[i + 1], wa = Math.max(9, r0 * mpx), col = heat((a.v + b.v) / 2); c.fillStyle = rgba(col, 1); c.beginPath(); c.moveTo(X(a.s) - wa, Y(a.alt)); c.lineTo(X(b.s) - wa, Y(b.alt)); c.lineTo(X(b.s) + wa, Y(b.alt)); c.lineTo(X(a.s) + wa, Y(a.alt)); c.closePath(); c.fill(); }
    if (C.length === 1) { const a = C[0]; c.fillStyle = rgba(heat(a.v), 1); c.beginPath(); c.arc(X(a.s), Y(a.alt), Math.max(9, r0 * mpx), 0, 7); c.fill(); }
    c.globalAlpha = fade;
    if (C.length > 1) { const wa = Math.max(9, r0 * mpx); c.strokeStyle = isCur || mem ? css('--climb') : 'rgba(80,90,100,.5)'; c.lineWidth = isCur ? 1.5 : 1; c.beginPath(); C.forEach((p, i) => (i ? c.lineTo(X(p.s) - wa, Y(p.alt)) : c.moveTo(X(p.s) - wa, Y(p.alt)))); c.stroke(); c.beginPath(); C.forEach((p, i) => (i ? c.lineTo(X(p.s) + wa, Y(p.alt)) : c.moveTo(X(p.s) + wa, Y(p.alt)))); c.stroke(); }
    c.globalAlpha = 1;
  });
  // where the current core should be further up
  if (top && top < amax && top > amin) { c.strokeStyle = css('--warn'); c.lineWidth = 2; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(L0 - 2, Y(top)); c.lineTo(Wd, Y(top)); c.stroke(); c.setLineDash([]); c.fillStyle = css('--warn'); c.textAlign = 'left'; c.fillText('thermal top ' + fAlt(top), L0 + 2, Y(top) - 4); }
  // track: thin line, dots coloured by climb, newest emphasised
  if (P.length > 1) { c.strokeStyle = 'rgba(80,90,100,.45)'; c.lineWidth = 1.2; c.beginPath(); P.forEach((p, i) => (i ? c.lineTo(X(p.s), Y(p.alt)) : c.moveTo(X(p.s), Y(p.alt)))); c.stroke(); }
  const step = Math.max(1, Math.ceil(P.length / 240));
  const inCol = (t) => cols.some((q) => t >= q.t0 && t <= q.t1);
  P.forEach((p, i) => { if (i % step && i !== P.length - 1) return; const isNew = now - p.t < 20000, ic = !isNew && inCol(p.t); c.beginPath(); c.arc(X(p.s), Y(p.alt), ic ? 2 : clamp(2.5 + Math.abs(p.v) * 1.1, 2.5, 7), 0, 7); c.fillStyle = rgba(heat(p.v), ic ? 0.5 : 1); c.fill(); if (isNew) { c.lineWidth = 1.5; c.strokeStyle = ink; c.stroke(); } });
  // you: a glider pointing the way you move along this axis
  const dir = f.trk != null ? Math.cos((f.trk - ax) * D2R) : 1, gx = X(0), gy = Y(alt), sgn = dir >= 0 ? 1 : -1;
  c.fillStyle = ink; c.strokeStyle = card; c.lineWidth = 2; c.beginPath(); c.moveTo(gx + 11 * sgn, gy); c.lineTo(gx - 11 * sgn, gy + 5); c.lineTo(gx - 11 * sgn, gy - 5); c.closePath(); c.fill(); c.stroke();
  // labels
  c.textAlign = 'left'; c.font = '700 12px Barlow';
  const head = cur ? (lean ? `leans ${Math.round(Math.abs(lean.k) * 100)} m/100 m ${view === 'along' ? (lean.k >= 0 ? 'downwind' : 'upwind') : (lean.k >= 0 ? 'right' : 'left')}` : 'thermal · first circles…') : hasWind ? `last ${Math.round(hist / 60000)} min` : 'no wind yet · north–south';
  haloText(c, head, L0 + 2, 12, ink, card);
  c.font = '11px Barlow'; c.fillStyle = muted;
  const lt = !hasWind ? (view === 'along' ? 'S' : 'W') : view === 'along' ? 'upwind' : 'left', rt = !hasWind ? (view === 'along' ? 'N' : 'E') : view === 'along' ? 'downwind' : 'right';
  const nar = Wd < 300; c.textAlign = 'left'; c.fillText(nar ? `← ${pad3(ax + 180)}°` : `← ${lt} ${pad3(ax + 180)}°`, L0, H - 1); c.textAlign = 'right'; c.fillText(nar ? `${pad3(ax)}° →` : `${rt} ${pad3(ax)}° →`, Wd - 4, H - 1);
  if (nar) { c.textAlign = 'center'; c.fillText(view === 'along' ? (hasWind ? 'downwind →' : 'N →') : (hasWind ? 'right →' : 'E →'), X(0), 26); }
}
/* ----- Thermal 3D: perspective view of your track, the lift columns and faint height layers ----- */
// cameras: 'behind' looks the way you fly, 'downwind' sits downwind looking upwind, 'north' sits south looking north,
// 'auto' = behind you while gliding, from downwind while circling (so the picture doesn't spin in a thermal)
const CAM3D = { auto: 'Auto', behind: 'Behind', downwind: 'Downwind', north: 'North' };
function t3dDraw(cv, W, el) {
  const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H); const C = W.cfg, f = st.fix, alt = altNow(), dark = document.body.classList.contains('dark');
  const camSet = CAM3D[C.cam] ? C.cam : 'auto';
  const ctlL = `<button class="wcb wide" data-act="cam3d" aria-label="Camera: ${CAM3D[camSet]}. Tap to change">${CAM3D[camSet]}</button><button class="wcb wide" data-act="reset3d" aria-label="Reset view">Reset</button>`;
  const ctlR = '<button class="wcb" data-act="rotl" aria-label="Turn view left">⟲</button><button class="wcb" data-act="rotr" aria-label="Turn view right">⟳</button><button class="wcb" data-act="zin" aria-label="Zoom in">+</button><button class="wcb" data-act="zout" aria-label="Zoom out">−</button>';
  const cl = el.querySelector('.wctl.l'), cr = el.querySelector('.wctl.r');
  if (cl._h !== ctlL) { cl.innerHTML = ctlL; cl._h = ctlL; } if (cr._h !== ctlR) { cr.innerHTML = ctlR; cr._h = ctlR; }
  if (!f || alt == null) { c.fillStyle = css('--muted'); c.font = '14px Barlow'; c.textAlign = 'center'; c.fillText('Waiting for GPS…', Wd / 2, H / 2); el._sub = ''; return; }
  const now = f.t, hist = clamp(+C.hist || 300, 30, 600) * 1000, wv = st.wind || { vx: 0, vy: 0 }, w = windFromSpd();
  const rel = (s) => { const [x, y] = enu(f.lat, f.lon, s.lat, s.lon), dt = (now - s.t) / 1000; return [x + wv.vx * dt, y + wv.vy * dt]; };
  const P = st.samples.filter((s) => s.t >= now - hist && s.alt != null).map((s) => { const [x, y] = rel(s); return { t: s.t, x, y, z: s.alt, v: s.v }; });
  const r0 = clamp(st.lastTurn ? st.lastTurn.avg : 40, 20, 90), th = st.thermal, cols = [];
  st.thermals.filter((q) => q.t1 > now - hist && !(th && q.t0 === th.t0)).forEach((q) => { const L = liftCentres(Math.max(q.t0, now - hist), q.t1, rel); if (L.length > 1) cols.push({ C: L, cur: false }); });
  if (th) { const L = liftCentres(th.t0, th.end || now, rel); if (L.length) cols.push({ C: L, cur: true }); }
  const cur = cols.find((q) => q.cur); let lean = null;
  if (cur && cur.C.length >= 4) { const L = cur.C, n = L.length, ma = L.reduce((q, p) => q + p.alt, 0) / n, mx = L.reduce((q, p) => q + p.x, 0) / n, my = L.reduce((q, p) => q + p.y, 0) / n; let nx = 0, ny = 0, den = 0; L.forEach((p) => { nx += (p.alt - ma) * (p.x - mx); ny += (p.alt - ma) * (p.y - my); den += (p.alt - ma) ** 2; }); if (den > 25 && Math.hypot(nx, ny) / den < 3) lean = (a) => [mx + nx / den * (a - ma), my + ny / den * (a - ma)]; }
  const top = thermalTop(), above = cur && st.circling ? Math.min(250, top && top > alt ? top - alt : 200) : 0;
  // what to frame: you, the last minute and the current column; older track may leave the view
  let R = 110; P.filter((p) => now - p.t < 60000).forEach((p) => (R = Math.max(R, Math.hypot(p.x, p.y) + 20))); (cur ? cur.C : []).forEach((p) => (R = Math.max(R, Math.hypot(p.x, p.y) + r0 + 20))); R = Math.min(R, 600);
  let zLo = alt - 60, zHi = alt + 40 + above; (cur ? cur.C : []).forEach((p) => (zLo = Math.min(zLo, p.alt - 30))); P.filter((p) => now - p.t < 90000).forEach((p) => { zLo = Math.min(zLo, p.z); zHi = Math.max(zHi, p.z); });
  const fixed = C.scale !== 'auto';
  if (fixed) { R = clamp(+C.range || 250, 50, 3000); const vs = clamp(+C.vspan || 400, 100, 3000); zLo = alt - vs * 0.6; zHi = alt + vs * 0.4; } // fixed scale (default): sizes never change
  else { const [zl, zh] = steadyRange(cv, 'z', zLo, zHi); zLo = zl; zHi = zh; }
  const VX = 1.6, zMid = (zLo + zHi) / 2, Z = (a) => (a - zMid) * VX, ext = Math.max(R, (zHi - zLo) * VX / 2);
  // camera direction, turned smoothly so switching cameras or following your track never jumps
  const mode = camSet === 'auto' ? (st.circling ? 'downwind' : 'behind') : camSet;
  const want = wrap360((mode === 'behind' ? (f.trk ?? (w ? w.from : 0)) : mode === 'downwind' ? (w ? w.from : f.trk ?? 0) : 0) + (+C.yaw || 0));
  const tNow = performance.now(), dtc = el._yt ? Math.min(3, (tNow - el._yt) / 1000) : 10; el._yt = tNow;
  el._yaw = el._yaw == null ? want : wrap360(el._yaw + angDiff(el._yaw, want) * (1 - Math.exp(-dtc / 1.2)));
  el._sub = (camSet === 'auto' ? 'auto · ' : '') + (mode === 'behind' ? 'behind you' : mode === 'downwind' ? (w ? 'from downwind' : 'no wind yet') : 'from the south') + (+C.yaw ? ` ${+C.yaw > 0 ? '+' : ''}${+C.yaw}°` : '');
  const psi = el._yaw * D2R, el3 = clamp(+C.tilt || 25, 5, 70) * D2R;
  const fx = Math.sin(psi), fy = Math.cos(psi), rx = Math.cos(psi), ry = -Math.sin(psi);
  const L = [fx * Math.cos(el3), fy * Math.cos(el3), -Math.sin(el3)], U = [fx * Math.sin(el3), fy * Math.sin(el3), Math.cos(el3)];
  // fit width and height separately, so a tall narrow widget is filled by the column's height
  const zm = clamp(+C.zoom || 1, 0.4, 4), D = ext * 3.2, C0 = [-D * L[0], -D * L[1], -D * L[2]], hz = (zHi - zLo) * VX / 2 * Math.cos(el3) + R * Math.sin(el3);
  const F = zm * D * Math.min(0.42 * Wd / R, 0.4 * (H - 30) / hz), cx = Wd / 2, cy = 16 + (H - 16) * 0.5;
  const pr = (x, y, a) => { const v0 = x - C0[0], v1 = y - C0[1], v2 = Z(a) - C0[2], d = Math.max(1, v0 * L[0] + v1 * L[1] + v2 * L[2]); return [cx + F * (v0 * rx + v1 * ry) / d, cy - F * (v0 * U[0] + v1 * U[1] + v2 * U[2]) / d, d]; };
  const ring = (x0, y0, a, r, n = 24) => { const pts = []; for (let i = 0; i < n; i++) { const t = i / n * 2 * Math.PI; pts.push(pr(x0 + r * Math.sin(t), y0 + r * Math.cos(t), a)); } return pts; };
  const poly = (pts) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); };
  const ink = css('--ink'), muted = css('--muted'), card = css('--card');
  // faint height layers; the one at your height is the clearest
  const step = +C.layers > 0 ? +C.layers : niceStep((zHi - zLo) / 5), Rl = R * 0.95, zb = Math.ceil(zLo / step) * step;
  c.font = '12px Barlow'; c.textAlign = 'left';
  for (let a = zb; a <= zHi + step * 0.5; a += step) {
    const k = Math.exp(-(((a - alt) / (step * 1.6)) ** 2)), pts = ring(0, 0, a, Rl, 40); poly(pts);
    c.fillStyle = dark ? `rgba(160,190,230,${0.02 + 0.06 * k})` : `rgba(40,90,160,${0.015 + 0.05 * k})`; c.fill();
    c.strokeStyle = dark ? `rgba(180,200,230,${0.12 + 0.3 * k})` : `rgba(40,70,120,${0.1 + 0.3 * k})`; c.lineWidth = 1; if (k < 0.5) c.setLineDash([4, 5]); c.stroke(); c.setLineDash([]);
    const lp = pts.reduce((m, p) => (p[0] < m[0] ? p : m)); c.fillStyle = muted; c.globalAlpha = 0.45 + 0.55 * k; c.fillText(fAlt(a) + ' ' + (S.uAlt === 'ft' ? 'ft' : 'm'), clamp(lp[0] + 6, 4, Wd - 50), lp[1] - 3); c.globalAlpha = 1;
  }
  // shadow of the track on the lowest layer
  c.strokeStyle = dark ? 'rgba(200,210,220,.18)' : 'rgba(30,40,50,.15)'; c.lineWidth = 2; c.beginPath(); P.forEach((p, i) => { const q = pr(p.x, p.y, zb); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke();
  // 3D content, drawn far to near
  const prim = [];
  cols.forEach(({ C: L0, cur: isCur }) => L0.forEach((p) => prim.push({ d: pr(p.x, p.y, p.alt)[2], f: () => { poly(ring(p.x, p.y, p.alt, r0)); c.fillStyle = rgba(heat(p.v), isCur ? 0.32 : 0.16); c.fill(); c.strokeStyle = rgba(heat(p.v), isCur ? 0.9 : 0.4); c.lineWidth = 1.2; c.stroke(); } })));
  if (lean && above > 0) for (let a = alt + 40; a <= alt + above; a += 40) { const [x, y] = lean(a); prim.push({ d: pr(x, y, a)[2], f: () => { poly(ring(x, y, a, r0)); c.setLineDash([5, 4]); c.strokeStyle = ink; c.globalAlpha = 0.55; c.lineWidth = 1.2; c.stroke(); c.setLineDash([]); c.globalAlpha = 1; } }); }
  const sk = Math.max(1, Math.ceil(P.length / 400));
  for (let i = sk; i < P.length; i += sk) { const a = P[i - sk], b = P[i], pa = pr(a.x, a.y, a.z), pb = pr(b.x, b.y, b.z); prim.push({ d: (pa[2] + pb[2]) / 2, f: () => { c.strokeStyle = rgba(heat(b.v), 1); c.lineWidth = clamp(3.2 * D / pb[2], 1.5, 5); c.lineCap = 'round'; c.beginPath(); c.moveTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); c.stroke(); } }); }
  const g = pr(0, 0, alt), tr = (f.trk ?? 0) * D2R, gs = Math.max(14, R * 0.12);
  prim.push({ d: g[2] - 1, f: () => {
    const gb = pr(0, 0, zb); c.setLineDash([3, 4]); c.strokeStyle = muted; c.lineWidth = 1; c.beginPath(); c.moveTo(g[0], g[1]); c.lineTo(gb[0], gb[1]); c.stroke(); c.setLineDash([]);
    const sn = Math.sin(tr), cs = Math.cos(tr); poly([pr(gs * sn, gs * cs, alt), pr(-gs * 0.6 * (sn + cs), -gs * 0.6 * (cs - sn), alt), pr(-gs * 0.6 * (sn - cs), -gs * 0.6 * (cs + sn), alt)]); c.fillStyle = ink; c.fill(); c.strokeStyle = card; c.lineWidth = 2; c.stroke(); } });
  prim.sort((p, q) => q.d - p.d).forEach((p) => p.f());
  // north on your layer, wind above
  const n = pr(0, Rl, alt); c.font = '700 14px Barlow'; c.textAlign = 'center'; c.fillStyle = '#B42318'; c.fillText('N', n[0], n[1] + 5);
  if (w) { const a0 = pr(-Rl * 0.75 * Math.sin(w.to * D2R), -Rl * 0.75 * Math.cos(w.to * D2R), zHi), a1 = pr(-Rl * 0.25 * Math.sin(w.to * D2R), -Rl * 0.25 * Math.cos(w.to * D2R), zHi), ang = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]);
    c.strokeStyle = css('--sink'); c.fillStyle = css('--sink'); c.lineWidth = 3; c.beginPath(); c.moveTo(a0[0], a0[1]); c.lineTo(a1[0], a1[1]); c.stroke();
    c.beginPath(); c.moveTo(a1[0] + 4 * Math.cos(ang), a1[1] + 4 * Math.sin(ang)); c.lineTo(a1[0] - 11 * Math.cos(ang - 0.45), a1[1] - 11 * Math.sin(ang - 0.45)); c.lineTo(a1[0] - 11 * Math.cos(ang + 0.45), a1[1] - 11 * Math.sin(ang + 0.45)); c.closePath(); c.fill();
    c.font = '12px Barlow'; haloText(c, fSpd(w.spd) + (S.uSpd === 'kt' ? ' kt' : ' km/h'), a0[0], a0[1] - 6, css('--sink'), card); }
}
/* ----- Thermal layer view: from above, the slice of air from your height down to `depth` below ----- */
// every logged point in that height band, where that air is now (moved on with the wind), coloured by climb;
// shows where the lift was in the air you are flying in, relative to your position
const DEPTH_O = [50, 100, 200, 300];
function layerDraw(cv, W, el) {
  const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H); const cfg = W.cfg, f = st.fix, alt = altNow(), w = windFromSpd(), dark = document.body.classList.contains('dark');
  const orient = cfg.orient || 'wind', depth = clamp(+cfg.depth || 100, 20, 1000), above = clamp(+cfg.above || 0, 0, 500), hist = clamp(+cfg.hist || 600, 30, 600) * 1000;
  let up = 0, upName = 'north'; if (orient === 'wind' && w) { up = w.from; upName = 'wind'; } else if (orient === 'track' && f && f.trk != null) { up = f.trk; upName = 'track'; }
  const ctlL = `<button class="wcb wide" data-act="depth" aria-label="Layer depth ${depth} m. Tap to change">${depth} m</button>`;
  const ctlR = '<button class="wcb" data-act="zin" aria-label="Zoom in">+</button><button class="wcb" data-act="zout" aria-label="Zoom out">−</button>';
  const cl = el.querySelector('.wctl.l'), cr = el.querySelector('.wctl.r');
  if (cl._h !== ctlL) { cl.innerHTML = ctlL; cl._h = ctlL; } if (cr._h !== ctlR) { cr.innerHTML = ctlR; cr._h = ctlR; }
  const cx = Wd / 2, cy = H / 2, R = Math.max(30, Math.min(Wd, H) / 2 - 12);
  if (!f || alt == null) { el._sub = ''; c.fillStyle = css('--muted'); c.font = '14px Barlow'; c.textAlign = 'center'; c.fillText('Waiting for GPS…', cx, cy); return; }
  const now = f.t, wv = st.wind || { vx: 0, vy: 0 }, lo = alt - depth, hi = alt + above, air = cfg.frame !== 'ground';
  el._sub = `${fAlt(lo)}–${fAlt(hi)} ${S.uAlt === 'ft' ? 'ft' : 'm'} · ${upName} up${air ? '' : ' · ground'}`;
  const pts = st.samples.filter((s) => s.t >= now - hist && s.alt != null && s.alt >= lo && s.alt <= hi && now - s.t > 1500)
    .map((s) => { const [x, y] = enu(f.lat, f.lon, s.lat, s.lon), dt = air ? (now - s.t) / 1000 : 0; return { x: x + wv.vx * dt, y: y + wv.vy * dt, v: s.v, dz: alt - s.alt, t: s.t }; });
  const sc = R / clamp(+cfg.range || 200, 30, 5000) * clamp(+cfg.zoom || 1, 0.25, 8), Rm = R / sc;
  const a = up * D2R, ca = Math.cos(a), sa = Math.sin(a), tr = (x, y) => [cx + (x * ca - y * sa) * sc, cy - (x * sa + y * ca) * sc];
  const ink = css('--ink'), card = css('--card'), muted = css('--muted');
  // rings
  const RS = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000], ringM = RS.find((v) => Rm / v <= 4) || 2000;
  c.lineWidth = 1; c.strokeStyle = css('--line'); c.font = '11px Barlow'; c.textAlign = 'left';
  for (let k = 1; k * ringM <= Rm * 1.02; k++) { const r = k * ringM * sc; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke(); const lx = cx + r * 0.7071, ly = cy + r * 0.7071; if (lx < Wd - 34 && ly < H - 8) haloText(c, k * ringM + ' m', lx + 2, ly + 4, muted, card); }
  // north tick, wind arrow
  { const [nx, ny] = tr(0, Rm * 0.93); c.font = '700 13px Barlow'; c.textAlign = 'center'; c.fillStyle = '#B42318'; c.fillText('N', nx, ny + 5); }
  if (w) { const [x0, y0] = tr(-Math.sin(w.to * D2R) * Rm * 0.9, -Math.cos(w.to * D2R) * Rm * 0.9), [x1, y1] = tr(-Math.sin(w.to * D2R) * Rm * 0.62, -Math.cos(w.to * D2R) * Rm * 0.62), ang = Math.atan2(y1 - y0, x1 - x0);
    c.strokeStyle = css('--sink'); c.fillStyle = css('--sink'); c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.beginPath(); c.moveTo(x1 + 3 * Math.cos(ang), y1 + 3 * Math.sin(ang)); c.lineTo(x1 - 10 * Math.cos(ang - 0.45), y1 - 10 * Math.sin(ang - 0.45)); c.lineTo(x1 - 10 * Math.cos(ang + 0.45), y1 - 10 * Math.sin(ang + 0.45)); c.closePath(); c.fill(); }
  // lift glow first, then dots: deeper points are fainter and smaller, points above you are hollow
  const rr = clamp(14 * sc, 10, 40);
  pts.forEach((p) => { if (p.v <= 0.2) return; const [x, y] = tr(p.x, p.y); if (x < -rr || x > Wd + rr || y < -rr || y > H + rr) return; c.globalAlpha = 0.25 + 0.75 * (1 - Math.max(0, p.dz) / depth); c.drawImage(heatBlob(p.v), x - rr, y - rr, 2 * rr, 2 * rr); });
  c.globalAlpha = 1;
  pts.forEach((p) => { const [x, y] = tr(p.x, p.y); if (x < -10 || x > Wd + 10 || y < -10 || y > H + 10) return; const k = 1 - Math.max(0, p.dz) / depth, r = clamp(2.5 + Math.abs(p.v) * 1.3, 2.5, 8) * (0.6 + 0.4 * k);
    c.beginPath(); c.arc(x, y, r, 0, 7); if (p.dz < 0) { c.strokeStyle = rgba(heat(p.v), 1); c.lineWidth = 2; c.stroke(); return; }
    c.fillStyle = rgba(heat(p.v), 0.35 + 0.65 * k); c.fill(); c.lineWidth = 0.8; c.strokeStyle = dark ? `rgba(230,234,238,${0.15 + 0.4 * k})` : `rgba(17,20,24,${0.15 + 0.4 * k})`; c.stroke(); });
  // where the lift was in this layer: the strongest group of rising points (not the average of all, which can fall between two thermals)
  const good = pts.filter((p) => p.v > 0.3), wgt = (p) => p.v * p.v * (1 - 0.5 * Math.max(0, p.dz) / depth) * Math.pow(0.5, (now - p.t) / 300000); // recent lift counts more (half after 5 min)
  let best = null, bs = 0; good.forEach((p) => { let sc0 = 0; good.forEach((q) => { if (Math.hypot(p.x - q.x, p.y - q.y) < 60) sc0 += wgt(q); }); if (sc0 > bs) { bs = sc0; best = p; } });
  const grp = best ? good.filter((q) => Math.hypot(best.x - q.x, best.y - q.y) < 80) : [];
  if (grp.length >= 5) {
    let sw = 0, sx = 0, sy = 0; grp.forEach((p) => { const k = wgt(p); sw += k; sx += p.x * k; sy += p.y * k; });
    const lx = sx / sw, ly = sy / sw, [x, y] = tr(lx, ly), d = Math.hypot(lx, ly), b = wrap360(Math.atan2(lx, ly) * R2D);
    c.save(); c.setLineDash([5, 5]); c.lineWidth = 1.5; c.strokeStyle = ink; c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke(); c.restore();
    c.strokeStyle = card; c.lineWidth = 7; c.beginPath(); c.moveTo(x - 9, y - 9); c.lineTo(x + 9, y + 9); c.moveTo(x + 9, y - 9); c.lineTo(x - 9, y + 9); c.stroke();
    c.strokeStyle = ink; c.lineWidth = 3.5; c.beginPath(); c.moveTo(x - 9, y - 9); c.lineTo(x + 9, y + 9); c.moveTo(x + 9, y - 9); c.lineTo(x - 9, y + 9); c.stroke();
    c.font = '700 13px Barlow'; c.textAlign = 'left'; const gv = grp.reduce((q, p) => q + p.v, 0) / grp.length, age = Math.round((now - grp.reduce((q, p) => q + p.t, 0) / grp.length) / 60000);
    haloText(c, `${fVario(gv)} ${uV()} · ${Math.round(d)} m ${pad3(b)}°${age >= 2 ? ` · ${age} min ago` : ''}`, 8, H - 10, ink, card);
  } else { c.font = '13px Barlow'; c.textAlign = 'left'; haloText(c, pts.length ? 'no lift in this layer yet' : 'no track in this layer yet', 8, H - 10, muted, card); }
  // you
  c.save(); c.translate(cx, cy); c.rotate(((f.trk ?? 0) - up) * D2R); const gs = 13; c.fillStyle = ink; c.strokeStyle = card; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -gs); c.lineTo(gs * 0.7, gs * 0.8); c.lineTo(0, gs * 0.4); c.lineTo(-gs * 0.7, gs * 0.8); c.closePath(); c.fill(); c.stroke(); c.restore();
}
/* ----- Last circle ----- */
function turnDraw(cv, W) {
  const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H); const t = st.lastTurn;
  if (!t) { c.fillStyle = css('--muted'); c.font = '14px Barlow'; c.textAlign = 'center'; c.fillText('needs one full circle', Wd / 2, H / 2); return; }
  const S0 = Math.min(H, Wd * 0.5), cx = S0 / 2, cy = H / 2, sc = (S0 / 2 - 6) / Math.max(15, t.max);
  c.strokeStyle = css('--line'); c.lineWidth = 1.2; c.setLineDash([2, 3]); c.beginPath(); c.arc(cx, cy, t.avg * sc, 0, 7); c.stroke(); c.setLineDash([]);
  c.strokeStyle = css('--climb'); c.lineWidth = 2.5; c.beginPath(); t.pts.forEach((p, i) => { const x = cx + p[0] * sc, y = cy - p[1] * sc; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.stroke();
  const x0 = S0 + 8, fs = clamp(Math.min(H * 0.28, (Wd - x0) / 7), 14, 40); c.textAlign = 'left';
  c.fillStyle = css('--muted'); c.font = '11px Barlow'; c.fillText('R MIN – MAX', x0, 14);
  c.fillStyle = css('--ink'); c.font = `700 ${fs}px Barlow Condensed`; c.fillText(`${Math.round(t.min)} – ${Math.round(t.max)} m`, x0, 18 + fs);
  c.fillStyle = css('--muted'); c.font = '12px Barlow'; c.fillText(`avg ${Math.round(t.avg)} m · ${t.T.toFixed(1)} s/turn`, x0, 22 + fs + 14); c.fillText(`bank ${Math.round(t.bankMin)}–${Math.round(t.bankMax)}°`, x0, 22 + fs + 30);
}
/* ----- Temperature profile ----- */
function profDraw(cv, W) { withU('uAlt', W.cfg.units || '', () => profBody(cv, W)); }
function profBody(cv, W) {
  const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H); const fc = st.forecast, alt = altNow(), trig = +(S.trig ?? 2);
  const pts = st.tempPts.slice(), prof = fc ? fc.prof : [], alts = pts.map((p) => p.alt).concat(prof.map((p) => p.alt));
  if (!alts.length) { c.fillStyle = css('--muted'); c.font = '15px Barlow'; c.textAlign = 'center'; c.fillText('Fly with the vario temperature sensor, or load the forecast', Wd / 2, H / 2); return; }
  const amin = Math.min(...alts) - 100, amax = Math.min(Math.max(...alts) + 300, 6000);
  const temps = pts.map((p) => p.temp).concat(prof.filter((p) => p.alt < amax).map((p) => p.temp)); if (fc) temps.push(fc.Td, fc.T + 3);
  const tmin = Math.floor(Math.min(...temps) - 2), tmax = Math.ceil(Math.max(...temps) + 2);
  const X = (t) => 40 + (t - tmin) / (tmax - tmin) * (Wd - 50), Y = (a) => H - 40 - (a - amin) / (amax - amin) * (H - 54);
  c.strokeStyle = css('--line'); c.fillStyle = css('--muted'); c.font = '11px Barlow'; c.lineWidth = 1; c.textAlign = 'left';
  const astep = amax - amin > 3000 ? 1000 : 500; for (let a = Math.ceil(amin / astep) * astep; a < amax; a += astep) { c.beginPath(); c.moveTo(38, Y(a)); c.lineTo(Wd, Y(a)); c.stroke(); c.fillText(fAlt(a), 0, Y(a) + 4); }
  c.textAlign = 'center'; for (let t = Math.ceil(tmin / 5) * 5; t <= tmax; t += 5) c.fillText(t + '°', X(t), H - 26);
  if (fc) {
    c.strokeStyle = css('--muted'); c.lineWidth = 2; c.beginPath(); prof.forEach((p, i) => i ? c.lineTo(X(p.temp), Y(p.alt)) : c.moveTo(X(p.temp), Y(p.alt))); c.stroke();
    const T0 = fc.T + trig; c.strokeStyle = css('--climb'); c.beginPath(); c.moveTo(X(T0), Y(fc.elev)); c.lineTo(X(T0 - 0.0098 * (amax - fc.elev)), Y(amax)); c.stroke();
    const cb = fc.elev + 125 * (fc.T - fc.Td), top = thermalTop(); c.setLineDash([6, 4]); c.lineWidth = 2;
    if (cb < amax) { c.strokeStyle = css('--sink'); c.beginPath(); c.moveTo(38, Y(cb)); c.lineTo(Wd, Y(cb)); c.stroke(); c.fillStyle = css('--sink'); c.textAlign = 'right'; c.fillText('cloud base', Wd - 4, Y(cb) - 4); }
    if (top) { c.strokeStyle = css('--warn'); c.beginPath(); c.moveTo(38, Y(top)); c.lineTo(Wd, Y(top)); c.stroke(); c.fillStyle = css('--warn'); c.textAlign = 'right'; c.fillText('thermal top', Wd - 4, Y(top) - 4); }
    c.setLineDash([]);
  }
  c.fillStyle = css('--ink'); pts.forEach((p) => { c.beginPath(); c.arc(X(p.temp), Y(p.alt), 2.5, 0, 7); c.fill(); });
  if (alt != null) { c.strokeStyle = css('--ink'); c.setLineDash([2, 3]); c.beginPath(); c.moveTo(38, Y(alt)); c.lineTo(Wd, Y(alt)); c.stroke(); c.setLineDash([]); }
  c.font = '11px Barlow'; c.textAlign = 'left'; let lx = 8; [['● measured', css('--ink')], ['— forecast', css('--muted')], ['— parcel', css('--climb')]].forEach(([t, col]) => { c.fillStyle = col; c.fillText(t, lx, H - 6); lx += c.measureText(t).width + 14; });
}
/* ----- Airspace along the track ----- */
function asSideDraw(cv, W) {
  const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H); const f = st.fix, alt = altNow(); if (!f || alt == null) { c.fillStyle = css('--muted'); c.font = '14px Barlow'; c.textAlign = 'center'; c.fillText('Waiting for position and height', Wd / 2, H / 2); return; }
  const L0 = (+W.cfg.range || 20) * 1000, trk = f.trk || 0, amax = Math.max(3000, alt + 800);
  const X = (d) => 40 + d / L0 * (Wd - 50), Y = (a) => H - 22 - a / amax * (H - 34);
  c.strokeStyle = css('--line'); c.fillStyle = css('--muted'); c.font = '11px Barlow'; c.lineWidth = 1;
  for (let a = 1000; a < amax; a += 1000) { c.beginPath(); c.moveTo(38, Y(a)); c.lineTo(Wd, Y(a)); c.stroke(); c.textAlign = 'left'; c.fillText(fAlt(a), 0, Y(a) + 4); }
  const ks = L0 <= 10000 ? 2 : L0 <= 20000 ? 5 : 10; c.textAlign = 'center'; for (let k = 0; k * 1000 <= L0; k += ks) c.fillText(k + ' km', X(k * 1000), H - 6);
  const g = st.groundElev || 0;
  st.airspaces.forEach((a) => { let start = null; for (let d = 0; d <= L0; d += 250) { const p = dest(f.lat, f.lon, trk, d), inn = inPoly(p[0], p[1], a.poly); if (inn && start == null) start = d; if ((!inn || d === L0) && start != null) { const lo = limM(a.lo, g), hi = Math.min(limM(a.hi, g), amax), col = airColor(a); c.fillStyle = col + '22'; c.strokeStyle = col; c.lineWidth = 2; c.fillRect(X(start), Y(hi), X(d) - X(start), Y(lo) - Y(hi)); c.strokeRect(X(start), Y(hi), X(d) - X(start), Y(lo) - Y(hi)); c.fillStyle = col; c.textAlign = 'left'; c.fillText(a.name.slice(0, 22), X(start) + 4, Y(hi) + 13); start = null; } } });
  c.fillStyle = '#DFE6CF'; c.fillRect(38, Y(g), Wd, H - 22 - Y(g));
  if (st.pred.wing) { const dd = Math.min(L0, st.pred.wing[2]); c.strokeStyle = css('--sink'); c.setLineDash([7, 4]); c.lineWidth = 2.5; c.beginPath(); c.moveTo(X(0), Y(alt)); c.lineTo(X(dd), Y(alt - dd / S.wingLD)); c.stroke(); c.setLineDash([]); }
  c.fillStyle = css('--ink'); c.beginPath(); c.moveTo(X(0) - 2, Y(alt) - 5); c.lineTo(X(0) + 14, Y(alt)); c.lineTo(X(0) - 2, Y(alt) + 5); c.fill();
  c.fillStyle = css('--muted'); c.textAlign = 'right'; c.fillText('track ' + pad3(trk) + '°', Wd - 4, 12);
}
/* ----- Airspace map (north up, own Leaflet map) ----- */
function asMapDraw(cv, W, el, b) {
  cv.style.display = 'none'; const bg = el.querySelector('.wbg'); bg.style.display = 'block';
  if (!el._am) {
    el._am = L.map(bg, { zoomControl: false, attributionControl: false, rotate: false, dragging: false, scrollWheelZoom: false, touchZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, zoomSnap: 0, zoomAnimation: false, fadeAnimation: false, maxZoom: 22 });
    el._ag = L.layerGroup().addTo(el._am);
    el._me = L.circleMarker([0, 0], { radius: 8, color: '#fff', weight: 3, fillColor: '#1E50C8', fillOpacity: 1, interactive: false }).addTo(el._am);
    el._ring = L.circle([0, 0], { radius: 1000, color: '#111418', weight: 1.5, dashArray: '5 5', fill: false, interactive: false }).addTo(el._am);
    el._hd = L.polyline([], { color: '#E0157F', weight: 3.5, interactive: false }).addTo(el._am);
  }
  const m = el._am, sz = Math.round(b.w) + 'x' + Math.round(b.h); if (el._sz !== sz) { m.invalidateSize(); el._sz = sz; }
  const lk = LAYERS[W.cfg.map] ? W.cfg.map : 'light';
  if (el._lk !== lk) { if (el._atl) m.removeLayer(el._atl); el._atl = L.tileLayer(LAYERS[lk].url, Object.assign({}, LAYERS[lk].o, { maxNativeZoom: LAYERS[lk].o.maxZoom, maxZoom: 22 })).addTo(m); el._lk = lk; }
  const f = st.fix; if (!f) return;
  const rad = +W.cfg.radius || S.poiRadius, mpp = rad * 1000 / (Math.max(40, Math.min(b.w, b.h)) / 2 * 0.92), z = clamp(Math.log2(156543.03392 * Math.cos(f.lat * D2R) / mpp), 3, 18);
  // a zoom change reloads every tile (no zoom animation), so keep the zoom until it is clearly off and only pan otherwise
  if (el._z == null || Math.abs(z - el._z) > 0.15) el._z = z;
  const vk = f.lat.toFixed(5) + f.lon.toFixed(5) + el._z; if (el._vk !== vk) { m.setView([f.lat, f.lon], el._z, { animate: false }); el._vk = vk; }
  el._me.setLatLng([f.lat, f.lon]); el._ring.setLatLng([f.lat, f.lon]).setRadius(rad * 1000);
  if (f.trk != null) el._hd.setLatLngs([[f.lat, f.lon], dest(f.lat, f.lon, f.trk, rad * 450)]);
  const key = [st.airVer || 0, st.ntVer || 0, st.placesVer || 0, rad, JSON.stringify(S.poiKinds), Math.round(f.lat * 200) + ',' + Math.round(f.lon * 200)].join('|');
  if (key !== el._okey) {
    el._okey = key; const g = el._ag; g.clearLayers();
    st.airspaces.forEach((a) => L.polygon(a.poly, { color: airColor(a), weight: 2, fillOpacity: 0.1, interactive: false }).addTo(g));
    NOTAMS.filter((n) => n.geo && ntState(n) !== 'over').forEach((n) => { const o = { color: '#9A3D06', weight: 2, dashArray: '6 4', fillOpacity: 0.08, interactive: false }; if (n.geo.poly) L.polygon(n.geo.poly, o).addTo(g); else if (n.geo.r > 0) L.circle(n.geo.pt, Object.assign({ radius: n.geo.r }, o)).addTo(g); else L.circleMarker(n.geo.pt, { radius: 6, color: '#9A3D06', weight: 2, fillOpacity: 0.3, interactive: false }).addTo(g); });
    visiblePlaces().filter((p) => dist(f.lat, f.lon, p.lat, p.lon) <= rad * 1000).forEach((p) => { const mk = L.circleMarker([p.lat, p.lon], { radius: p.kind === 'airport' || p.kind === 'start' ? 7 : 5, color: '#fff', weight: 1.5, fillColor: p.kind === 'start' ? '#2E7D4F' : p.kind === 'airport' ? '#5B2FA6' : p.kind === 'peak' ? '#6B4E2E' : '#111418', fillOpacity: 1, interactive: false }).addTo(g); if (p.rank >= 2 || p.kind === 'airport' || p.kind === 'start') mk.bindTooltip(esc(p.name), { permanent: true, direction: 'right', className: 'wpLabel' }); });
  }
}
/* ----- Compass ----- */
function compassDraw(cv, W) {
  const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H); const f = st.fix, mode = W.cfg.mode || 'heading', hdg = f && f.trk != null ? f.trk : 0, up = mode === 'north' ? 0 : hdg;
  const cx = Wd / 2, cy = H / 2, R = Math.max(20, Math.min(Wd, H) / 2 - 6), ink = css('--ink'), card = css('--card');
  const P = (b, r) => { const a = (b - up) * D2R; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; };
  c.strokeStyle = css('--line'); c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
  c.strokeStyle = ink; for (let b = 0; b < 360; b += 10) { const [x1, y1] = P(b, R), [x2, y2] = P(b, R - (b % 30 === 0 ? 11 : 6)); c.lineWidth = b % 90 === 0 ? 2.5 : 1.2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  c.font = `700 ${Math.max(11, R * 0.2)}px Barlow Condensed`; c.textAlign = 'center';
  [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([t, b]) => { const [x, y] = P(b, R - 24); c.fillStyle = t === 'N' ? '#B42318' : ink; c.fillText(t, x, y + R * 0.07); });
  if (W.cfg.tp !== false && W.cfg.tp !== 'false' && st.task && f) { const wp = st.task.pts[st.nextWp]; if (wp) { const b = brg(f.lat, f.lon, wp.lat, wp.lon), p0 = P(b, R - 1), p1 = P(b + 7, R - 15), p2 = P(b - 7, R - 15); c.fillStyle = '#E0157F'; c.strokeStyle = card; c.lineWidth = 1.5; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.closePath(); c.fill(); c.stroke(); } }
  const w = windFromSpd();
  if (W.cfg.windm !== false && W.cfg.windm !== 'false' && w) { const p1 = P(w.from, R - 2), p2 = P(w.from, R * 0.66), ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]); c.strokeStyle = css('--sink'); c.fillStyle = css('--sink'); c.lineWidth = 3.5; c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.stroke(); c.beginPath(); c.moveTo(p2[0] + 3 * Math.cos(ang), p2[1] + 3 * Math.sin(ang)); c.lineTo(p2[0] - 10 * Math.cos(ang - 0.5), p2[1] - 10 * Math.sin(ang - 0.5)); c.lineTo(p2[0] - 10 * Math.cos(ang + 0.5), p2[1] - 10 * Math.sin(ang + 0.5)); c.closePath(); c.fill(); }
  c.save(); c.translate(cx, cy); c.rotate((hdg - up) * D2R); const gs = R * 0.2; c.fillStyle = ink; c.strokeStyle = card; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -gs); c.lineTo(gs * 0.7, gs * 0.8); c.lineTo(0, gs * 0.4); c.lineTo(-gs * 0.7, gs * 0.8); c.closePath(); c.fill(); c.stroke(); c.restore();
  c.fillStyle = ink; c.font = `700 ${R * 0.27}px Barlow Condensed`; c.textAlign = 'center'; c.fillText(f && f.trk != null ? pad3(hdg) + '°' : '--', cx, cy + R * 0.5);
}
/* ----- Wind direction ----- */
function windDirDraw(cv, W) { withU('uSpd', W.cfg.units || '', () => windDirBody(cv, W)); }
function windDirBody(cv, W) {
  const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H); const f = st.fix, w = windFromSpd(), mode = W.cfg.mode || 'heading', hdg = f && f.trk != null ? f.trk : 0, up = mode === 'north' ? 0 : hdg, ink = css('--ink'), card = css('--card');
  const side = Wd >= H * 1.4, S0 = side ? Math.min(Wd * 0.5, H) : Math.min(Wd, H * 0.62), cx = side ? S0 / 2 : Wd / 2, cy = side ? H / 2 : S0 / 2, R = S0 / 2 - 6;
  const P = (b, r) => { const a = (b - up) * D2R; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; };
  c.strokeStyle = css('--line'); c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
  c.save(); c.translate(cx, cy); c.rotate((hdg - up) * D2R); c.fillStyle = ink; c.strokeStyle = card; c.lineWidth = 1.5; const gs = R * 0.2; c.beginPath(); c.moveTo(0, -gs); c.lineTo(gs * 0.7, gs * 0.8); c.lineTo(0, gs * 0.4); c.lineTo(-gs * 0.7, gs * 0.8); c.closePath(); c.fill(); c.stroke(); c.restore();
  const tx = side ? S0 + 8 : 6, ty = side ? 0 : S0;
  if (!w) { c.fillStyle = css('--muted'); c.font = '13px Barlow'; c.textAlign = 'left'; c.fillText('circle once to measure the wind', tx, ty + (side ? H / 2 : 18)); return; }
  const p1 = P(w.to + 180, R * 0.92), p2 = P(w.to, R * 0.92), ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  c.strokeStyle = css('--sink'); c.fillStyle = css('--sink'); c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0] - 8 * Math.cos(ang), p2[1] - 8 * Math.sin(ang)); c.stroke(); c.beginPath(); c.moveTo(p2[0] + 4 * Math.cos(ang), p2[1] + 4 * Math.sin(ang)); c.lineTo(p2[0] - 12 * Math.cos(ang - 0.5), p2[1] - 12 * Math.sin(ang - 0.5)); c.lineTo(p2[0] - 12 * Math.cos(ang + 0.5), p2[1] - 12 * Math.sin(ang + 0.5)); c.closePath(); c.fill();
  const comp = w.spd * Math.cos((w.to - hdg) * D2R), fs = clamp(side ? Math.min(H * 0.34, (Wd - tx) / 5) : H * 0.2, 16, 46); c.textAlign = 'left';
  c.fillStyle = ink; c.font = `700 ${fs}px Barlow Condensed`; c.fillText(fSpd(w.spd) + ' ' + S.uSpd, tx, ty + fs + 2);
  c.fillStyle = css('--muted'); c.font = '13px Barlow'; c.fillText(`from ${pad3(w.from)}° ${compass(w.from)}`, tx, ty + fs + 20);
  if (f && f.trk != null) c.fillText(`${comp >= 0 ? 'tailwind' : 'headwind'} ${fSpd(Math.abs(comp))} ${S.uSpd}`, tx, ty + fs + 37);
}
const DRAW = { varioDial: (cv, W) => dialDraw(cv, W), climb: (cv) => histDraw(cv), ta: taDraw, tside: sideDraw, tcross: sideDraw, t3d: t3dDraw, tlayer: layerDraw, turn: turnDraw, profile: profDraw, asside: asSideDraw, asmap: asMapDraw, compass: compassDraw, windDir: windDirDraw, map: mapDraw };

/* ----- widget element lifecycle ----- */
const HANDLES = '<div class="wh tl" data-c="tl"></div><div class="wh tr" data-c="tr"></div><div class="wh bl" data-c="bl"></div><div class="wh br" data-c="br"></div>';
function wBox(W, el, r) { r = r || el.getBoundingClientRect(); return { x: W.x / GC * r.width, y: W.y / GR * r.height, w: W.w / GC * r.width, h: W.h / GR * r.height }; }
function layerEl() { return $(LAYERID[pageKey()]); }
function disposeW(e) { if (cvRO) e.querySelectorAll('canvas').forEach((c) => cvRO.unobserve(c)); if (e._mi) { MAPS.delete(e._mi); try { e._mi.m.remove(); } catch (x) { } } if (e._tm) { try { e._tm.remove(); } catch (x) { } } if (e._am) { try { e._am.remove(); } catch (x) { } } }
function mkWidget(W, layer) {
  const el = document.createElement('div'); el.className = 'wg'; el.dataset.id = W.id; el.dataset.type = W.type; el.setAttribute('role', W.type === 'button' ? 'button' : 'group'); el.setAttribute('aria-label', WT[W.type].n);
  if (WT[W.type].canvas) el.innerHTML = '<div class="wl"><span></span><span></span></div><div class="wcw"><div class="wbg"></div><canvas></canvas><div class="wctl l"></div><div class="wctl r"></div><div class="wctl b"></div></div>' + HANDLES;
  layer.appendChild(el); return el;
}
let curBox = { x: 0, y: 0, w: 200, h: 100 };
function renderWidgets() {
  const layer = layerEl(); if (!layer || !layer.offsetParent) return;
  const L0 = S.layout, ids = new Set(L0.map((W) => W.id)), lr = layer.getBoundingClientRect();
  layer.querySelectorAll('.wg').forEach((e) => { if (!ids.has(e.dataset.id)) { disposeW(e); e.remove(); } });
  L0.forEach((W, zi) => {
    const T = WT[W.type]; if (!T) return; const E = effW(W), ins = W.type === 'map' ? 0 : 2;
    let el = layer.querySelector(`.wg[data-id="${W.id}"]`);
    if (!el || el.dataset.type !== W.type) { if (el) { disposeW(el); el.remove(); } el = mkWidget(W, layer); }
    const vis = W.cfg.vis || 'always', cond = vis === 'always' || (vis === 'thermal' && !!st.thermMode) || (vis === 'glide' && !st.thermMode), vdl = vis === 'always' ? 0 : +W.cfg.visDelay || 0, since = nowT() - (st.modeSince || 0);
    const shown = cond && (vdl <= 0 || since >= vdl * 1000 || since < 0);
    el.dataset.vis = vis; el.dataset.vd = vdl > 0 ? ' +' + vdl + ' s' : ''; el.classList.toggle('hidnow', !shown && wEdit);
    if (!shown && !wEdit) { if (el.style.display !== 'none') el.style.display = 'none'; el._gone = true; return; }
    if (el._gone || el.style.display === 'none') { el.style.display = ''; el._gone = false; el._tsz = el._sz = null; if (el._mi) el._mi.sz = null; }
    const b = wBox(W, layer, lr); curBox = b;
    const sk = [b.x, b.y, b.w, b.h, zi, +E.cfg.bg].join('|');
    if (el._sk !== sk) { el._sk = sk; el._bgc = null; Object.assign(el.style, el._st = { left: b.x + ins + 'px', top: b.y + ins + 'px', width: b.w - 2 * ins + 'px', height: b.h - 2 * ins + 'px', zIndex: 1 + zi, background: `color-mix(in srgb, var(--card) ${+E.cfg.bg}%, transparent)`, borderColor: +E.cfg.bg ? 'var(--line)' : 'transparent' }); }
    el.classList.toggle('sel', wEdit && wSel === W.id);
    const showL = E.cfg.showLabel !== false && E.cfg.showLabel !== 'false';
    if (T.canvas) {
      const wl = el.querySelector('.wl'); wl.style.display = showL ? '' : 'none';
      const cv = el.querySelector('canvas'); el._sub = '';
      // label first: an empty label row has no height, so the canvas would be measured too tall
      const lt = (E.cfg.label || T.n) + (W.type === 'varioDial' && +E.cfg.win ? ' · Ø ' + E.cfg.win + ' s' : ''); if (wl.children[0].textContent !== lt) wl.children[0].textContent = lt;
      const fn = DRAW[W.type]; if (fn) { try { fn(cv, E, el, b); } catch (err) { console.error(W.type, err); } }
      if (wl.children[1].textContent !== (el._sub || '')) wl.children[1].textContent = el._sub || '';
      return;
    }
    const d = wData(E); const lab = esc(E.cfg.label || d.l || '');
    const mul = E.cfg.size === 'auto' || !E.cfg.size ? 1 : +E.cfg.size;
    let html = showL ? `<div class="wl"><span>${lab}</span><span>${esc(d.u || '')}${d.arrow != null ? ` <svg width="14" height="14" viewBox="0 0 14 14" style="vertical-align:-2px"><g transform="rotate(${d.arrow} 7 7)"><path d="M7 1l4 8H3z" fill="currentColor"/><line x1="7" y1="8" x2="7" y2="13" stroke="currentColor" stroke-width="2"/></g></svg>` : ''}</span></div>` : '';
    if (d.html) html += d.html;
    else {
      const txt = String(d.v ?? '--'); const avail = b.h - 8 - (showL ? 16 : 0) - (d.s ? 16 : 0);
      const fs = Math.max(12, Math.min(avail * 0.95, (b.w - 18) / Math.max(2.2, txt.length * (d.btn ? 0.68 : 0.5))) * mul);
      html += `<div class="wv" style="font-size:${fs.toFixed(0)}px;${d.col ? 'color:' + d.col : ''}${d.center ? ';justify-content:center;text-align:center' : ''}">${esc(txt)}</div>` + (d.s ? `<div class="ws">${esc(d.s)}</div>` : '');
    }
    html += HANDLES;
    const bgc = d.bgc ? d.bgc + '|' + (d.col || '') : null;
    if (el._bgc !== bgc) { if (d.bgc) { el.style.background = d.bgc; el.style.borderColor = 'transparent'; el.style.color = d.col || ''; } else { Object.assign(el.style, el._st); el.style.color = ''; } el._bgc = bgc; }
    if (el._last !== html) { el.innerHTML = html; el._last = html; }
  });
  updateBackOverlay(layer);
}

/* "Back to me": one button per page, drawn above every widget and above the replay bar, so nothing can cover it */
function updateBackOverlay(layer) {
  const lost = [...MAPS].filter((I) => layer.contains(I.el) && !I.follow && I.el.style.display !== 'none');
  let ov = layer.querySelector(':scope > .backOv');
  if (!lost.length || wEdit) { if (ov) ov.remove(); return; }
  if (!ov) {
    ov = document.createElement('div'); ov.className = 'backOv';
    ov.innerHTML = '<button type="button" aria-label="Back to my position"><svg width="26" height="26" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="11" cy="11" r="2" fill="currentColor"/><path d="M11 1v4M11 17v4M1 11h4M17 11h4" stroke="currentColor" stroke-width="2"/></svg><span>Back to me</span></button>';
    ov.firstChild.addEventListener('click', () => { [...MAPS].forEach((I) => { if (layer.contains(I.el)) { I.follow = true; I.panAt = 0; } }); renderWidgets(); });
    layer.appendChild(ov);
  }
  ov.style.bottom = '18px';
}
function saveLayout() { save(); renderWidgets(); }
const PAGE_NAME = { map: 'map', thermal: 'Thermal page', atmos: 'Atmosphere page', air: 'Airspace page' };
function enterEdit(selId) { wEdit = true; document.body.classList.add('wedit'); wSel = selId || null; $('wbName').textContent = PAGE_NAME[pageKey()]; setNav(false); renderWidgets(); if (selId) openSheet(selId); }
function exitEdit() { wEdit = false; wSel = null; document.body.classList.remove('wedit'); $('wSheet').classList.remove('on'); if (st.sheetForce) { st.force = false; st.sheetForce = false; updateMode(); } sheetFor = null; saveLayout(); }

/* ----- actions from buttons inside widgets ----- */
function openNotamById(id) { const n = NOTAMS.find((x) => x.id === id); if (!n) return; ntView = [{ n, d: ntWhere(n), s: ntState(n) }]; openNotam(0); }
function widgetAct(W, act) {
  const i = act.indexOf(':'), a = i < 0 ? act : act.slice(0, i), arg = i < 0 ? '' : act.slice(i + 1);
  const C = effCfg(W), D = cfgW(W), I = W.type === 'map' ? instOf(W) : null;
  switch (a) {
    case 'orient': { const o = ['wind', 'north', 'track'], cur = C.orient || S.taOrient || 'wind'; D.orient = o[(o.indexOf(cur) + 1) % 3]; break; }
    case 'hist': { const cur = C.hist === 'thermal' || C.hist === 'circle' ? C.hist : +(C.hist ?? 120); D.hist = typeof cur === 'number' && HIST_O.indexOf(cur) < 0 ? (HIST_O.find((p) => typeof p === 'number' && p > cur) ?? HIST_O[0]) : HIST_O[(HIST_O.indexOf(cur) + 1) % HIST_O.length]; break; }
    case 'bg': if (!hasRot()) { toast('The map rotation library did not load'); return; } D.bgMap = !(C.bgMap === true || C.bgMap === 'true'); break;
    case 'zin': D.zoom = clamp((+C.zoom || 1) * 1.4, 0.25, 8); break;
    case 'zout': D.zoom = clamp((+C.zoom || 1) / 1.4, 0.25, 8); break;
    case 'zfit': D.zoom = 1; break;
    case 'cam3d': { const o = Object.keys(CAM3D); D.cam = o[(o.indexOf(CAM3D[C.cam] ? C.cam : 'auto') + 1) % o.length]; D.yaw = 0; break; }
    case 'rotl': D.yaw = ((+C.yaw || 0) - 30 + 540) % 360 - 180; break;
    case 'rotr': D.yaw = ((+C.yaw || 0) + 30 + 540) % 360 - 180; break;
    case 'depth': { const cur = +C.depth || 100; D.depth = DEPTH_O.find((v) => v > cur) ?? DEPTH_O[0]; break; }
    case 'reset3d': D.yaw = 0; D.zoom = 1; break;
    case 'mmenu': if (I) I.menu = !I.menu; renderWidgets(); return;
    case 'mlayer': D.layer = arg; if (I) I.menu = false; if (S.layer !== arg) { S.layer = arg; } break;
    case 'mrot': { const o = ['north', 'track', 'bearing']; let nx = o[(o.indexOf(C.rot || 'north') + 1) % 3]; if (nx === 'bearing' && !st.task) nx = 'north'; D.rot = nx; toast(ROT[nx]); break; }
    case 'mzin': if (I) I.m.zoomIn(); return;
    case 'mzout': if (I) I.m.zoomOut(); return;
    case 'mfollow': if (I) { I.follow = true; I.panAt = 0; } renderWidgets(); return;
    case 'forecast': loadForecast(); return;
    case 'trigm': S.trig = Math.max(0, +((S.trig ?? 2) - 0.5).toFixed(1)); break;
    case 'trigp': S.trig = Math.min(8, +((S.trig ?? 2) + 0.5).toFixed(1)); break;
    case 'rad': { const o = [5, 10, 20, 40]; S.poiRadius = o[(o.indexOf(S.poiRadius) + 1) % 4] ?? 20; loadPlaces(true); break; }
    case 'kind': S.poiKinds[arg] = !S.poiKinds[arg]; st.placesVer = (st.placesVer || 0) + 1; break;
    case 'start': setStartHere(); return;
    case 'refresh': loadPlaces(true); return;
    case 'ntrefresh': loadNotams(true); return;
    case 'ntall': ntShowAll = !ntShowAll; break;
    case 'notam': openNotamById(arg); return;
    default: return;
  }
  saveLayout();
}
/* shims so older code paths keep working */
function markDirty() { if (typeof renderWidgets === 'function' && PAGEKEY[curPage]) renderWidgets(); }
function renderPlaces() { st.placesVer = (st.placesVer || 0) + 1; markDirty(); }
function drawMiniPlaces() { }
function renderNotams(msg) { st.ntLoading = false; st.ntMsg = msg || ''; markDirty(); }

/* web */
let webCur = 'windy';
function renderWeb() {
  document.querySelectorAll('[data-web]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.web === webCur)));
  const f = st.fix || { lat: 63.1, lon: 21.6 }; const area = $('webArea'); $('webExtra').innerHTML = '';
  let url = '', html = '';
  if (webCur === 'windy') url = `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=%C2%B0C&metricWind=km%2Fh&zoom=9&overlay=wind&product=ecmwf&level=surface&lat=${f.lat.toFixed(3)}&lon=${f.lon.toFixed(3)}&detailLat=${f.lat.toFixed(3)}&detailLon=${f.lon.toFixed(3)}&marker=true`;
  if (webCur === 'flyxc') { url = 'https://flyxc.app/'; $('webExtra').innerHTML = `<button class="pill" id="impAuto" aria-pressed="${S.autoImport}">Auto-import: ${S.autoImport ? 'on' : 'off'}</button>`; }
  if (webCur === 'flyk') url = S.flykUrl || 'https://flyk.com/map?lang=en';
  if (webCur === 'ais') url = 'https://www.ais.fi/bulletins/envfra.htm';
  if (webCur === 'custom') { if (S.customUrl) url = S.customUrl; else html = `<div class="webMsg"><div class="card"><b style="font-size:18px">Add your own page</b><span class="muted">Set any web address in Settings → Web pages, for example a Flyk or club page.</span><button class="btn primary" onclick="openSettings('web')">Open settings</button></div></div>`; }
  const cur = area.querySelector('iframe');
  if (url) { if (!cur || cur.dataset.src !== url) area.innerHTML = `<iframe data-src="${esc(url)}" src="${esc(url)}" allow="geolocation; fullscreen; clipboard-write" referrerpolicy="no-referrer-when-downgrade"></iframe>`; }
  else area.innerHTML = html;
  const ob = $('fxUse'); if (ob) ob.remove();
  if (webCur === 'flyxc') { const b = document.createElement('button'); b.id = 'fxUse'; b.className = 'btn primary'; b.innerHTML = '<span style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.15"><span><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style="vertical-align:-5px;margin-right:6px"><path d="M11 3v11M6 9l5 5 5-5M4 18h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>Use this route as my task</span><small style="font-weight:500;font-size:12px;opacity:.85">first: Share → copy link in FlyXC</small></span>'; b.style.cssText = 'position:absolute;right:16px;bottom:24px;z-index:5;height:64px;padding:0 20px;font-size:17px;box-shadow:0 6px 18px rgba(0,0,0,.3)'; b.onclick = useFlyxcRoute; area.appendChild(b); }
  $('webOpen').onclick = () => { if (url) window.open(url, '_blank');  };
  if (false) $('impPaste').onclick = async () => { try { importFlyXC(await navigator.clipboard.readText()); } catch (e) { const t = prompt('Paste the FlyXC link'); if (t) importFlyXC(t); } };
  if ($('impAuto')) $('impAuto').onclick = () => { S.autoImport = !S.autoImport; save(); renderWeb(); };
}

/* settings */
const SECS = [['data', 'Vario & GPS'], ['widgets', 'Map widgets'], ['units', 'Units & glide'], ['air', 'Airspace data'], ['task', 'Task'], ['web', 'Web pages'], ['display', 'Display & sound'], ['modes', 'Update & thermal mode'], ['auto', 'Automatic actions'], ['backup', 'Export & import'], ['app', 'App & offline maps']];
let setSec = 'data';
function openSettings(sec) { if (sec) setSec = sec; showPage('pSet'); }
function seg(key, opts, label) { return `<div class="field"><span class="k">${label}</span><span class="row" style="flex-wrap:wrap">${opts.map(([v, n]) => `<button class="pill" data-set="${key}" data-val="${v}" aria-pressed="${String(S[key]) === String(v)}">${n}</button>`).join('')}</span></div>`; }
const SNUM = { avgS: [1, 300, 1, 's', 'Default vario average'], modeEnter: [1, 60, 1, 's', 'After circling for'], modeHold: [3, 300, 1, 's', 'Back to gliding after'], rate: [0.1, 5, 0.1, 's', 'Update every'], rateT: [0, 5, 0.1, 's', 'Update every, when thermaling'] };
function numField(key, hint) { const [min, max, step, unit, label] = SNUM[key]; return `<div class="field"><span class="k">${label}${hint ? ' · ' + hint : ''}</span><span class="row"><button class="pill step" data-sn="${key}" data-sdir="-1" aria-label="Less">−</button><input type="number" class="numin" inputmode="decimal" data-sni="${key}" value="${S[key]}" min="${min}" max="${max}" step="${step}" aria-label="${label}, ${unit}"><span class="unit">${unit}</span><button class="pill step" data-sn="${key}" data-sdir="1" aria-label="More">+</button></span></div>`; }
function setNum(key, v) { const [min, max, step] = SNUM[key], d = (String(step).split('.')[1] || '').length; if (!isFinite(v)) return; applySet(key, String(clamp(+(Math.round(v / step) * step).toFixed(d), min, max))); renderSettings(); }
function renderSettings() {
  $('setNav').innerHTML = SECS.map(([k, n]) => `<button data-sec="${k}" aria-current="${k === setSec}">${n}</button>`).join('');
  let h = '';
  if (setSec === 'data') h = `<div class="card sec"><h2>Vario & GPS</h2>
    <div class="field"><span class="k">Bora vario</span>${st.bora ? `<b>Connected: ${esc(st.bora.name)}</b>` : `<button class="btn primary" id="bleBtn">Connect over Bluetooth</button>`}</div>
    <div class="muted">Reads $LK8EX1 from the Nordic UART service: pressure, altitude, vario, temperature, battery. Works in Chrome on Android when this page is opened over https.</div>
    <div class="field"><span class="k">GPS</span><b>${st.fix ? (st.sim ? 'demo position' : `fix, accuracy ${Math.round(st.fix.acc || 0)} m`) : 'waiting for position'}</b></div>
    <div class="field"><label for="igcFile">Replay an IGC flight</label><input type="file" id="igcFile" accept=".igc,.IGC,text/plain" style="min-height:48px">${st.replay ? '<button class="btn warn" id="igcStop">Stop replay</button>' : ''}</div>
    <div class="muted">Plays a recorded flight through every page: vario from the logged altitude, wind and thermals from the circles, glide and airspace along the track.${st.replay ? ' Now playing: ' + esc(st.replay.name) + '.' : ''}</div>
    <div class="field"><span class="k">Demo flight</span>${isDemo() ? `<button class="btn warn" id="demoBtn">Stop demo flight</button>` : `<button class="btn primary" id="demoBtn">Start demo flight</button>`}</div>
    <div class="muted">A real paraglider flight recorded with XCTrack on 19 June 2026: 52 minutes, a climb to 1000 m and three long thermals. It plays through every page with your own layouts and settings; use the bar on the map to pause, jump or change speed.</div>
    <div class="field"><span class="k">Synthetic test flight</span>${st.sim ? `<button class="btn warn" id="simBtn">Stop test flight</button>` : `<button class="btn" id="simBtn">Start test flight</button>`}</div>
    <div class="muted">Simulated thermals with 12 km/h wind from 250°, for testing.</div>
    <div class="field"><label for="qnh">QNH for pressure only (hPa)</label><input type="number" id="qnh" value="${S.qnh || 1013.25}" step="0.25"></div></div>`;
  if (setSec === 'widgets') h = `<div class="card sec"><h2>Page layouts</h2><div class="muted">Map, Thermal, Atmosphere and Airspace are built from widgets you can move, resize, duplicate and configure. Long-press any widget, or choose a page here.</div>
    <div class="field"><span class="k">Edit layout of</span><span class="row" style="flex-wrap:wrap"><button class="btn" data-edit="pMap">Map</button><button class="btn" data-edit="pThermal">Thermal</button><button class="btn" data-edit="pAtmos">Atmosphere</button><button class="btn" data-edit="pAir">Airspace</button></span></div>
    <div class="field"><span class="k">Defaults</span><button class="btn warn" data-reset="all">Reset all page layouts</button></div>
    ${numField('avgS')}</div>`;
  if (setSec === 'units') h = `<div class="card sec"><h2>Units & glide</h2>${seg('uVario', [['m/s', 'm/s'], ['kt', 'kt'], ['fpm', 'ft/min']], 'Vario')}${seg('uAlt', [['m', 'm'], ['ft', 'ft']], 'Altitude')}${seg('uSpd', [['km/h', 'km/h'], ['kt', 'kt']], 'Speed')}
    <div class="field"><label for="wingLD">Wing glide ratio (empty dot)</label><input type="number" id="wingLD" value="${S.wingLD}" step="0.1" min="3" max="20"></div>
    <div class="field"><label for="safety">Arrival safety height (m)</label><input type="number" id="safety" value="${S.safety}" step="10"></div>
    ${seg('rotDefault', [['north', 'North up'], ['track', 'Track up'], ['bearing', 'Bearing up']], 'New map widgets start in')}${seg('taOrient', [['wind', 'Wind up'], ['north', 'North up']], 'Thermal assistant')}</div>`;
  if (setSec === 'air') h = `<div class="card sec"><h2>Airspace data</h2>
    <div class="field"><label for="oaKey">OpenAIP API key</label><input type="password" id="oaKey" value="${esc(S.openaipKey)}" placeholder="from openaip.net → API clients"></div>
    <div class="field"><span class="k"></span><button class="btn primary" id="oaLoad">Load airspace around me</button></div>
    <div class="field"><label for="oaFile">Or an OpenAir file</label><input type="file" id="oaFile" accept=".txt,.air,.openair,text/plain" style="min-height:48px"></div>
    <div class="field"><span class="k">Loaded</span><b>${st.airspaces.length} airspaces</b>${st.airspaces.length ? '<button class="btn" id="oaClear">Clear</button>' : ''}</div>
    <h2 style="margin-top:8px">NOTAM from ais.fi</h2>
    <div class="field"><label for="ntProxy">Proxy address (optional)</label><input type="url" id="ntProxy" value="${esc(S.notamProxy)}" placeholder="https://your-worker.workers.dev/?url="></div>
    <div class="muted">Browsers only let a page read ais.fi if ais.fi allows it. If loading fails, put a small proxy in front: a free Cloudflare Worker with this code, then paste its address ending in ?url= above.</div>
    <pre class="raw">export default { async fetch(req) {
  const u = new URL(req.url).searchParams.get('url');
  if (!u || !u.startsWith('https://www.ais.fi/')) return new Response('no', { status: 400 });
  const r = await fetch(u);
  return new Response(await r.text(), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
} };</pre>
    ${seg('notamRadius', [[25, '25 km'], [50, '50 km'], [100, '100 km']], 'Show NOTAMs within')}
    <div class="field"><span class="k"></span><button class="btn primary" id="ntLoad">Load NOTAMs now</button></div></div>`;
  if (setSec === 'task') h = `<div class="card sec"><h2>Task</h2><div class="field"><span class="k">Current</span><b>${st.task ? esc(st.task.name) + ' · ' + st.task.pts.length + ' points · ' + (st.task.len / 1000).toFixed(1) + ' km' : 'none'}</b>${st.task ? '<button class="btn" id="taskClear">Remove</button>' : ''}</div>
    <div class="field"><label for="fxUrl">FlyXC link</label><input type="url" id="fxUrl" placeholder="https://flyxc.app/?p=…"><button class="btn primary" id="fxImp">Import</button></div>
    <div class="field"><label for="cylR">Turnpoint radius (m)</label><input type="number" id="cylR" value="${S.cylR}" step="50"></div>
    ${seg('autoImport', [[true, 'On'], [false, 'Off']], 'Auto-import copied FlyXC links')}<div class="muted">When on, a FlyXC link you copy is imported as soon as you come back to this page.</div></div>
    <h2 style="margin-top:8px">"Send to Bora" button for FlyXC</h2>
    <div class="muted" style="line-height:1.45">Plan in FlyXC in a normal Chrome tab, then tap this bookmark to send the route here as your task. Set it up once: copy the code, bookmark any page, edit the bookmark, name it <b>Send to Bora</b> and paste the code as its address. To use it, type "Send to Bora" in the address bar while FlyXC is open and pick the bookmark.</div>
    <pre class="raw" id="bmCode" style="word-break:break-all">${esc(bookmarklet())}</pre>
    <div class="field"><span class="k"></span><button class="btn primary" id="bmCopy">Copy bookmark code</button></div>`;
  if (setSec === 'web') h = `<div class="card sec"><h2>Web pages</h2><div class="field"><label for="fUrl">Flyk page address</label><input type="url" id="fUrl" value="${esc(S.flykUrl)}" placeholder="https://flyk.com/map?lang=en"></div>
<div class="field"><label for="cUrl">My page address</label><input type="url" id="cUrl" value="${esc(S.customUrl)}" placeholder="https://…"></div><div class="muted">Pages can use your location once you allow it for this app. Some sites refuse to be shown inside another page; use Open in browser for those.</div></div>`;
  if (setSec === 'display') h = `<div class="card sec"><h2>Display & sound</h2>${seg('theme', [['light', 'Day'], ['dark', 'Night']], 'Colours')}${seg('navMode', [['auto', 'Hide automatically'], ['pinned', 'Always show']], 'Page tabs')}${seg('sound', [[true, 'On'], [false, 'Off']], 'Vario sound')}
    <div class="field"><label for="vol">Volume</label><input type="range" id="vol" min="0" max="1" step="0.1" value="${S.volume}" style="flex:1;height:40px"></div>
    ${seg('wake', [[true, 'On'], [false, 'Off']], 'Keep screen on')}<div class="field"><span class="k">Full screen</span><button class="btn" id="fsBtn">Go full screen</button></div></div>`;
  if (setSec === 'modes') h = `<div class="card sec"><h2>Display update</h2>
    ${numField('rate')}
    <div class="muted">Faster is smoother on the map and dials, slower saves battery. Sound and measurements always run at full speed.</div></div>
    <div class="card sec"><h2>Thermal mode</h2>
    ${seg('modeAuto', [[true, 'On'], [false, 'Off']], 'Detect thermaling')}
    ${numField('modeEnter')}
    ${numField('modeHold')}
    ${numField('rateT', '0 = same')}
    ${seg('thermPage', [['off', 'Stay'], ['pThermal', 'Thermal'], ['pMap', 'Map'], ['pAtmos', 'Atmosphere'], ['pAir', 'Airspace']], 'Show page when thermaling')}
    ${seg('thermBack', [[true, 'Yes'], [false, 'No']], 'Go back when gliding again')}
    ${seg('modeChip', [[true, 'Show'], [false, 'Hide']], 'THERMAL button in the corner')}
    <div class="field"><span class="k">Try it now</span><button class="btn ${st.force ? 'warn' : ''}" id="modeTest">${st.force ? 'Stop test' : 'Test thermal mode'}</button><b>${st.thermMode ? 'Thermal mode is ON' : 'Normal mode'}</b></div>
    <div class="muted">The corner button shows <b>THERMAL?</b> when circling is seen (tap to start thermal mode now) and <b>THERMAL</b> while it's on (tap for the thermal page, tap again to go back, hold to leave thermal mode). Any widget can be shown only while thermalling or only after it stopped, and the <b>Button</b> widget can switch mode or page. Each widget can have its own settings while thermaling: long-press a widget, then open the <b>When thermaling</b> tab. For example a closer, north-up map and a shorter vario average.</div></div>`;
  if (setSec === 'backup') h = `<div class="card sec"><h2>Export and import</h2>
    <div class="muted">Save widget placement and configuration to a file, as a backup or to copy to another tablet.</div>
    <div class="field"><span class="k">Export</span><span class="row" style="flex-wrap:wrap"><button class="btn primary" id="expAll">Layouts and settings</button><button class="btn" id="expLay">Layouts only</button></span></div>
    <div class="field"><label for="impFile">Import a file</label><input type="file" id="impFile" accept=".json,application/json" style="min-height:48px"></div>
    <div class="muted">The file holds every widget on all four pages with its position, size and settings, including the thermal-mode settings. API keys and proxy addresses are never saved to it.</div></div>`;
  if (setSec === 'auto') h = autoSection();
  if (setSec === 'app') h = appSection();
  $('setBody').innerHTML = h;
  const on = (id, ev, fn) => { const e = $(id); if (e) e[ev] = fn; };
  on('bleBtn', 'onclick', connectBora);
  if (setSec === 'app') appSectionWire(on);
  on('modeTest', 'onclick', () => { st.force = !st.force; st.sheetForce = false; updateMode(); renderSettings(); });
  on('expAll', 'onclick', () => exportSettings('all')); on('expLay', 'onclick', () => exportSettings('layouts'));
  on('impFile', 'onchange', async (e) => { const fl = e.target.files[0]; if (fl) openImport(await fl.text(), fl.name); e.target.value = ''; });
  on('wEditBtn', 'onclick', () => { showPage('pMap'); setTimeout(() => enterEdit(), 80); });
  on('igcFile', 'onchange', async (e) => { const fl = e.target.files[0]; if (!fl) return; try { startReplay(parseIGC(await fl.text()), fl.name.replace(/\.igc$/i, '')); } catch (err) { toast('Could not read the IGC file: ' + err.message); } });
  on('igcStop', 'onclick', () => { stopReplay(); renderSettings(); }); on('simBtn', 'onclick', () => { st.sim ? stopSim() : startSim(); renderSettings(); }); on('demoBtn', 'onclick', () => { isDemo() ? stopReplay() : startDemoFlight(); renderSettings(); });
  on('qnh', 'onchange', (e) => { S.qnh = +e.target.value; save(); });
  on('wingLD', 'onchange', (e) => { S.wingLD = +e.target.value; save(); st.lastPredFetch = 0; });
  on('safety', 'onchange', (e) => { S.safety = +e.target.value; save(); });
  on('oaKey', 'onchange', (e) => { S.openaipKey = e.target.value.trim(); save(); });
  on('oaLoad', 'onclick', async () => { S.openaipKey = $('oaKey').value.trim(); save(); await loadOpenAIP(); renderSettings(); });
  on('oaFile', 'onchange', async (e) => { const fl = e.target.files[0]; if (!fl) return; const a = parseOpenAir(await fl.text()); st.airspaces = a; localStorage.setItem('bora.air', JSON.stringify(a)); drawAirspaces(); toast(a.length + ' airspaces loaded from file'); renderSettings(); });
  on('ntProxy', 'onchange', (e) => { S.notamProxy = e.target.value.trim(); save(); });
  on('ntLoad', 'onclick', async () => { S.notamProxy = $('ntProxy').value.trim(); save(); await loadNotams(true); });
  on('oaClear', 'onclick', () => { st.airspaces = []; localStorage.removeItem('bora.air'); drawAirspaces(); renderSettings(); });
  on('taskClear', 'onclick', () => { clearTask(); renderSettings(); });
  on('fxImp', 'onclick', () => { if (importFlyXC($('fxUrl').value)) renderSettings(); });
  on('bmCopy', 'onclick', async () => { try { await navigator.clipboard.writeText(bookmarklet()); toast('Bookmark code copied'); } catch (e) { toast('Select the code above and copy it'); } });
  on('cylR', 'onchange', (e) => { S.cylR = +e.target.value; save(); drawTask(); });
  on('cUrl', 'onchange', (e) => { S.customUrl = e.target.value.trim(); save(); });
  on('fUrl', 'onchange', (e) => { S.flykUrl = e.target.value.trim(); save(); });
  on('vol', 'oninput', (e) => { S.volume = +e.target.value; save(); });
  on('fsBtn', 'onclick', () => document.documentElement.requestFullscreen?.());
}
function applySet(key, raw) {
  const v = raw === 'true' ? true : raw === 'false' ? false : isNaN(+raw) ? raw : +raw;
  S[key] = v; save();
  if (key === 'theme') document.body.classList.toggle('dark', v === 'dark');
  if (key === 'navMode') { document.body.classList.toggle('pinned', v === 'pinned'); setNav(false); setTimeout(() => MAPS.forEach((I) => I.m.invalidateSize()), 250); }
  if (key === 'sound' && v) beep.init();
  if (key === 'wake') wake();
  if (key === 'rate' || key === 'rateT') loop();
  if (key === 'autoImport' || key === 'taOrient') { /* stored */ }
}

/* misc UI */
let toastT;
function toast(msg, actions) {
  const t = $('toast'); t.innerHTML = `<span style="font-size:15px">${esc(msg)}</span>` + (actions || []).map((a, i) => `<button class="btn ${i === 0 ? 'primary' : ''}" data-ta="${i}">${esc(a[0])}</button>`).join('');
  t.style.display = 'flex'; (actions || []).forEach((a, i) => (t.querySelector(`[data-ta="${i}"]`).onclick = () => { a[1](); t.style.display = 'none'; }));
  clearTimeout(toastT); toastT = setTimeout(() => (t.style.display = 'none'), actions ? 8000 : 3500);
}
let timeT;
function showTime() { const d = new Date(); const off = -d.getTimezoneOffset() / 60; $('toLocalL').textContent = 'LOCAL · UTC' + (off >= 0 ? '+' : '') + off; $('toLocal').innerHTML = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + '<small>:' + pad2(d.getSeconds()) + '</small>'; $('toUtc').innerHTML = pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + '<small>:' + pad2(d.getUTCSeconds()) + '</small>'; $('timeOv').style.display = 'flex'; clearTimeout(timeT); timeT = setTimeout(() => ($('timeOv').style.display = 'none'), 3000); }
let wl = null; async function wake() { try { if (S.wake && navigator.wakeLock && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => (wl = null)); } else if (!S.wake && wl) { wl.release(); wl = null; } } catch (e) { } }
let curPage = 'pMap';
let navT;
function setNav(open) {
  if (S.navMode === 'pinned') open = false;
  document.body.classList.toggle('navOpen', open); $('navBtn').setAttribute('aria-expanded', String(open));
  $('navBtn').setAttribute('aria-label', open ? 'Hide pages' : 'Show pages');
  $('navIco').innerHTML = open ? '<path d="M6 6l14 14M20 6L6 20" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' : '<path d="M4 7h18M4 13h18M4 19h18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>';
  clearTimeout(navT); if (open) navT = setTimeout(() => setNav(false), 6000);
}
let pageRaf = 0;
function showPage(id) {
  if (!st.autoNav) st.autoSwitched = false;
  setNav(false); if (wEdit) exitEdit();
  curPage = id; document.querySelectorAll('.page').forEach((p) => p.classList.toggle('on', p.id === id));
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-current', t.dataset.page === id ? 'page' : 'false'));
  $('setBtn').setAttribute('aria-current', id === 'pSet' ? 'page' : 'false');
  // draw the new page once, right after the switch has been painted, so the tap answers at once
  cancelAnimationFrame(pageRaf); if (PAGEKEY[id]) pageRaf = requestAnimationFrame(() => setTimeout(() => { if (curPage !== id) return; MAPS.forEach((I) => I.m.invalidateSize()); loop(); }, 0));
  if (id === 'pAir') { loadPlaces(); loadNotams(); }
  if (id === 'pWeb') renderWeb(); if (id === 'pSet') renderSettings(); if (id === 'pAtmos' && !st.forecast && st.fix) loadForecast();
}

/* ================= events ================= */
document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => showPage(t.dataset.page)));
$('navBtn').onclick = () => { if (S.navMode === 'pinned') { openSettings('display'); return; } setNav(!document.body.classList.contains('navOpen')); };
$('top').addEventListener('pointerdown', () => { if (document.body.classList.contains('navOpen')) setNav(true); });
document.querySelector('main').addEventListener('pointerdown', () => { if (document.body.classList.contains('navOpen')) setNav(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setNav(false); $('dlg').style.display = 'none'; } });
{ let lp = null, held = false; const chip = $('modeChip');
  chip.addEventListener('pointerdown', () => { held = false; lp = setTimeout(() => { held = true; if (st.thermMode) leaveThermal(); }, 700); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => chip.addEventListener(ev, () => clearTimeout(lp)));
  chip.addEventListener('click', () => { if (held) { held = false; return; } chipTap(); }); }
$('rpPlay').onclick = () => { const r = st.replay; if (!r) return; if (r.i >= r.pts.length) { seekReplay(0); return; } r.playing = !r.playing; renderReplayBar(); };
$('rpStop').onclick = () => stopReplay();
$('rpSpeeds').onclick = (e) => { const b = e.target.closest('[data-sp]'); if (b && st.replay) { st.replay.speed = +b.dataset.sp; renderReplayBar(); } };
$('rpSeek').oninput = () => { if (st.replay) { st.replay.dragging = true; const r = st.replay, a = r.pts[0].t, b = r.pts[r.pts.length - 1].t; const d = new Date(a + $('rpSeek').value / 1000 * (b - a)); $('rpTime').textContent = pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + 'Z'; } };
$('rpSeek').onchange = () => { if (st.replay) { st.replay.dragging = false; $('rpTime')._t = $('rpSeek')._v = null; seekReplay($('rpSeek').value / 1000); } };
$('setBtn').onclick = () => openSettings(); $('statusBtn').onclick = () => openSettings('data'); $('timeBtn').onclick = showTime;
$('dlg').onclick = (e) => { if (e.target.id === 'dlg') { $('dlg').style.display = 'none'; clearInterval(detT); detT = null; } };
document.querySelectorAll('[data-web]').forEach((b) => (b.onclick = () => { webCur = b.dataset.web; renderWeb(); }));
$('setNav').onclick = (e) => { const b = e.target.closest('[data-sec]'); if (b) { setSec = b.dataset.sec; renderSettings(); } };
$('setBody').addEventListener('change', (e) => {
  const i = e.target.closest('[data-sni]'); if (i) setNum(i.dataset.sni, parseFloat(String(i.value).replace(',', '.')));
  const a = e.target.closest('[data-ari]'); if (!a || a.tagName === 'BUTTON') return; const n = +a.dataset.ari;
  if (a.dataset.arn) ruleEdit(n, 'delay', parseFloat(String(a.value).replace(',', '.'))); else if (a.dataset.arsel) ruleEdit(n, 'action', a.value); else if (a.dataset.artx) { const r = S.autoRules[n]; if (r) { r.text = a.value.slice(0, 80); save(); renderSettings(); } }
});
$('setBody').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'arAdd') { (S.autoRules = S.autoRules || []).push({ id: 'ar' + Math.random().toString(36).slice(2, 8), on: true, event: 'thermalStart', delay: 0, action: 'pThermal', text: '' }); save(); renderSettings(); return; }
  if (b.dataset.ari !== undefined) { const n = +b.dataset.ari, r = (S.autoRules || [])[n]; if (!r) return;
    if (b.dataset.arf) ruleEdit(n, b.dataset.arf, b.dataset.arv); else if (b.dataset.aron) ruleEdit(n, 'on', r.on === false); else if (b.dataset.ardel) { S.autoRules.splice(n, 1); save(); renderSettings(); toast('Action deleted', [['Undo', () => { S.autoRules.splice(n, 0, r); save(); renderSettings(); }]]); }
    else if (b.dataset.arrun) { const keep = st.autoLast; st.autoLast = {}; runAction(r.action, r.text); st.autoLast = keep; } else if (b.dataset.arst) ruleEdit(n, 'delay', (+r.delay || 0) + (+b.dataset.arst)); return; }
  if (b.dataset.sn) { setNum(b.dataset.sn, +S[b.dataset.sn] + (+b.dataset.sdir) * SNUM[b.dataset.sn][2]); return; }
  if (b.dataset.set) { applySet(b.dataset.set, b.dataset.val); renderSettings(); return; }
  if (b.dataset.edit) { showPage(b.dataset.edit); setTimeout(() => enterEdit(), 80); return; }
  if (b.dataset.reset) { Object.keys(LAYERID).forEach((pk) => (S.layouts[pk] = defLayout(pk))); save(); toast('All page layouts reset'); return; }
  if (b.dataset.wup) { const i = +b.dataset.wup; if (i > 0) [S.widgets[i - 1], S.widgets[i]] = [S.widgets[i], S.widgets[i - 1]]; save(); renderSettings(); }
  if (b.dataset.wdn) { const i = +b.dataset.wdn; if (i < S.widgets.length - 1) [S.widgets[i + 1], S.widgets[i]] = [S.widgets[i], S.widgets[i + 1]]; save(); renderSettings(); }
  if (b.dataset.wtog) { const w = b.dataset.wtog; S.hidden = S.hidden.includes(w) ? S.hidden.filter((x) => x !== w) : S.hidden.concat(w); save(); renderSettings(); }
};
window.addEventListener('focus', () => { if (S.autoImport && curPage === 'pWeb' && webCur === 'flyxc') tryClipboardImport(); });
$('webBar').addEventListener('pointerdown', () => { if (webCur === 'flyxc') tryClipboardImport(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tryClipboardImport(); wake(); } });
document.addEventListener('pointerdown', () => { wake(); if (S.sound) beep.init(); }, { once: true });
navigator.getBattery?.().then((b) => { const u = () => (st.deviceBat = Math.round(b.level * 100)); u(); b.addEventListener('levelchange', u); });


