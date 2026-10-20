'use strict';
/* ================= traffic: warnings and the radar widget =================
   All traffic in one list (trafficAll): FLARM-port traffic from the vario ($PFLAA, 02) and adsb.fi (04), the same ICAO address once, each moved on
   to now along its track. Threat level per aircraft (trafficThreat): the FLARM alarm when the sender gives one ($PFLAA alarm, $PFLAU), else from the
   closest approach over the next 30 s with both tracks straight: 3 = urgent (< 300 m within 15 s, < 150 m height apart), 2 = warning (< 600 m within 30 s,
   < 300 m apart), 1 = near (< S.trNear m now, default 2000, < 300 m apart). Warnings (S.trWarn, at level ≥ S.trLvl, default 2): red banner (tap = quiet 60 s),
   an alarm tone (S.trTone) and a voice call (S.vcTraffic, needs voice messages on) with the clock position, distance and height. */
function trafficAll() {
  const f = st.fix; if (!f) return [];
  const now = Date.now(), loc = typeof flarmList === 'function' ? flarmList() : [], have = new Set(loc.map((a) => a.hex));
  return loc.concat((st.traffic || []).filter((a) => !have.has(String(a.hex).toLowerCase()))).map((a) => {
    const age = a.local ? Math.min(5, (now - a.t) / 1000) : Math.min(30, (now - (st.trafficAt || now)) / 1000 + (a.seen || 0));
    const p = a.gs > 5 && a.trk != null ? dest(a.lat, a.lon, a.trk, a.gs * 0.5144 * age) : [a.lat, a.lon];
    const rel = a.local && a.rel != null ? a.rel : f.alt != null && a.altM != null ? a.altM - (altNow() ?? f.alt) : null;
    return { ...a, p, rel, d: dist(f.lat, f.lon, p[0], p[1]), b: brg(f.lat, f.lon, p[0], p[1]) };
  });
}
function trafficThreat(a) {
  const f = st.fix; let lvl = 0, tca = null, cpa = a.d;
  if (a.alarm) lvl = Math.min(3, a.alarm);
  const vOk = (m) => a.rel == null || Math.abs(a.rel) < m;
  if (f) {
    const [rx, ry] = enu(f.lat, f.lon, a.p[0], a.p[1]), ov = f.spd != null && f.trk != null ? [f.spd * Math.sin(f.trk * D2R), f.spd * Math.cos(f.trk * D2R)] : [0, 0];
    const tv = a.gs && a.trk != null ? [a.gs * 0.5144 * Math.sin(a.trk * D2R), a.gs * 0.5144 * Math.cos(a.trk * D2R)] : [0, 0], vx = tv[0] - ov[0], vy = tv[1] - ov[1], vv = vx * vx + vy * vy;
    const t = vv > 0.01 ? clamp(-(rx * vx + ry * vy) / vv, 0, 30) : 0; tca = t; cpa = Math.hypot(rx + vx * t, ry + vy * t);
    if (cpa < 300 && t < 15 && vOk(150)) lvl = Math.max(lvl, 3); else if (cpa < 600 && vOk(300)) lvl = Math.max(lvl, 2); else if (a.d < sN('trNear', 2000) && vOk(300)) lvl = Math.max(lvl, 1);
  }
  return { lvl, tca, cpa };
}
const clockOf = (b) => { const tr = st.fix && st.fix.trk != null ? st.fix.trk : 0, h = Math.round(wrap360(b - tr) / 30) % 12; return h === 0 ? 12 : h; };
// $PFLAU,<rx>,<tx>,<gps>,<power>,<alarm level>,<relative bearing>,<alarm type>,<relative vertical>,<relative distance>,<id>: the sender's most urgent warning
function flarmU(l) { const p = l.split('*')[0].split(','); st.flarmU = { t: Date.now(), alarm: +p[5] || 0, rb: p[6] === '' ? null : +p[6], type: +p[7] || 0, rel: p[8] === '' ? null : +p[8], d: p[9] === '' ? null : +p[9], id: (p[10] || '').trim().toLowerCase() }; }
const VTRAF = { en: (c, d, h) => `Traffic, ${c} o'clock, ${d}${h}`, sv: (c, d, h) => `Trafik, klockan ${c}, ${d}${h}`, fi: (c, d, h) => `Liikennettä, kello ${c}, ${d}${h}` };
const VHI = { en: ['above', 'below', 'same height'], sv: ['över', 'under', 'samma höjd'], fi: ['yläpuolella', 'alapuolella', 'samalla korkeudella'] };
function trafficWarnTick() {
  const bn = $('trafBan'); if (S.trWarn === false || !st.fix) { if (bn) bn.style.display = 'none'; return; }
  let top = null; trafficAll().forEach((a) => { const T = trafficThreat(a); if (T.lvl && (!top || T.lvl > top.T.lvl || (T.lvl === top.T.lvl && a.d < top.a.d))) top = { a, T }; });
  const U = st.flarmU && Date.now() - st.flarmU.t < 4000 && st.flarmU.alarm > 0 && st.flarmU.d != null ? st.flarmU : null;
  if (U && (!top || U.alarm >= top.T.lvl)) { const b = wrap360((st.fix.trk || 0) + (U.rb || 0)); top = { a: { hex: U.id || 'pflau', d: U.d, b, rel: U.rel, call: '' }, T: { lvl: Math.min(3, U.alarm) } }; }
  const min = clamp(sN('trLvl', 2), 1, 3), show = top && top.T.lvl >= min && Date.now() > (st.trQuiet || 0);
  let el = bn; if (!el && show) { el = document.createElement('div'); el.id = 'trafBan'; el.className = 'trafBan'; document.body.appendChild(el); el.onclick = () => { st.trQuiet = Date.now() + 60000; el.style.display = 'none'; toast('Traffic warnings quiet for 60 s'); }; }
  if (!show) { if (el) el.style.display = 'none'; st.trLast = null; return; }
  const a = top.a, lv = top.T.lvl, c = clockOf(a.b), hTxt = a.rel == null ? '' : (a.rel >= 0 ? '+' : '−') + fAlt(Math.abs(a.rel)) + ' ' + S.uAlt;
  el.innerHTML = `<b>⚠ TRAFFIC</b> <span>${c} o'clock · ${fDist(a.d)}${hTxt ? ' · ' + hTxt : ''}${a.call ? ' · ' + esc(a.call) : ''}</span>`; el.dataset.lvl = lv; el.style.display = 'flex';
  // sound and voice: when it starts, gets worse, or every 10 s (urgent: every 4 s)
  const L = st.trLast, now = Date.now(), again = !L || L.id !== a.hex || lv > L.lvl || now - L.t > (lv >= 3 ? 4000 : 10000);
  if (!again) return; st.trLast = { id: a.hex, lvl: lv, t: now };
  if (S.trTone !== false) trafficTone(lv);
  if (S.voice && S.vcTraffic !== false) { const lg = S.voiceLang && VTRAF[S.voiceLang] ? S.voiceLang : (typeof vLang === 'function' ? vLang() : 'en'), V = VTRAF[lg] || VTRAF.en, H = VHI[lg] || VHI.en;
    const dTxt = a.d >= 1000 ? (a.d / 1000).toFixed(1) + ' km' : Math.round(a.d / 50) * 50 + ' m', h = a.rel == null ? '' : Math.abs(a.rel) < 50 ? ', ' + H[2] : ', ' + fAlt(Math.round(Math.abs(a.rel) / 10) * 10) + ' ' + (S.uAlt === 'ft' ? 'ft' : 'm') + ' ' + H[a.rel > 0 ? 0 : 1];
    say(V(c, dTxt, h)); }
}
function trafficTone(lv) {
  try { beep.init(); const x = beep.ctx; if (x.state === 'suspended') x.resume(); const t0 = x.currentTime, o = x.createOscillator(), g = x.createGain(); o.type = 'square'; o.connect(g); g.connect(x.destination);
    const vol = clamp((S.volume ?? 0.5) * 0.35 + 0.1, 0.1, 0.5), n = lv >= 3 ? 6 : lv === 2 ? 3 : 1;
    for (let i = 0; i < n; i++) { const t = t0 + i * 0.22; o.frequency.setValueAtTime(i % 2 ? 1500 : 1100, t); g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(0, t + 0.16); }
    g.gain.setValueAtTime(0, t0); g.gain.setValueAtTime(vol, t0); o.start(t0); o.stop(t0 + n * 0.22 + 0.05); } catch (e) { }
}
setInterval(trafficWarnTick, 1000);

/* radar widget: you in the middle, traffic within cfg.range km (rings at ⅓ and ⅔), track up or north up */
function radarDraw(cv, W, el) {
  const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H); const C = W.cfg, f = st.fix, cx = Wd / 2, cy = H / 2, R = Math.max(30, Math.min(Wd, H) / 2 - 8), small = Math.min(Wd, H) < 200;
  const km = clamp(+C.range || 5, 0.5, 50), north = C.orient === 'north', band = C.band === undefined ? 0 : +C.band;
  if (el) { const cr = el.querySelector('.wctl.r'), cl = el.querySelector('.wctl.l'), hr = `<button class="wcb" data-act="rin" aria-label="Closer">+</button><button class="wcb" data-act="rout" aria-label="Farther">−</button>`, hl = `<button class="wcb" data-act="rorient" aria-label="Orientation">${north ? 'N↑' : 'B↑'}</button>`;
    if (cr && cr._h !== hr) { cr.innerHTML = hr; cr._h = hr; } if (cl && cl._h !== hl) { cl.innerHTML = hl; cl._h = hl; } }
  const up = north || !f || f.trk == null ? 0 : f.trk, sc = R / (km * 1000);
  c.strokeStyle = css('--line'); c.lineWidth = 1; [1 / 3, 2 / 3, 1].forEach((k) => { c.beginPath(); c.arc(cx, cy, R * k, 0, 7); c.stroke(); });
  c.fillStyle = css('--muted'); c.font = `${small ? 11 : 13}px Barlow`; c.textAlign = 'left'; c.fillText((km >= 3 ? km.toFixed(0) : km.toFixed(1)) + ' km', cx + R * 0.71 + 2, cy - R * 0.71);
  // north mark
  { const a = (0 - up) * D2R; c.fillStyle = '#C62828'; c.font = `700 ${small ? 12 : 15}px Barlow`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', cx + Math.sin(a) * (R - 9), cy - Math.cos(a) * (R - 9)); c.textBaseline = 'alphabetic'; }
  // you
  c.fillStyle = css('--ink'); c.beginPath(); const ya = (north && f && f.trk != null ? f.trk : 0) * D2R, pt = (r, a) => [cx + Math.sin(ya + a) * r, cy - Math.cos(ya + a) * r];
  [[11, 0], [9, 2.5], [4, Math.PI], [9, -2.5]].forEach(([r, a], i) => { const [x, y] = pt(r, a); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.fill();
  if (!f) { c.fillStyle = css('--muted'); c.textAlign = 'center'; c.fillText('Waiting for GPS…', cx, cy + R / 2); return; }
  const list = trafficAll().filter((a) => a.d <= km * 1000 * 1.02 && (band <= 0 || a.rel == null || Math.abs(a.rel) <= band)).map((a) => ({ a, T: trafficThreat(a) })).sort((x, y) => x.T.lvl - y.T.lvl);
  el && (el._sub = list.length ? list.length + ' aircraft' : 'no traffic');
  list.forEach(({ a, T }) => {
    const r = Math.min(R, a.d * sc), ang = (a.b - up) * D2R, x = cx + Math.sin(ang) * r, y = cy - Math.cos(ang) * r, col = T.lvl >= 2 ? '#C62828' : T.lvl === 1 || (a.rel != null && Math.abs(a.rel) <= 300) ? '#E07B00' : css('--ink');
    const hd = ((a.trk ?? 0) - up) * D2R, s = small ? 7 : 9; c.save(); c.translate(x, y);
    if (T.lvl >= 3) { c.strokeStyle = '#C62828'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, s + 6 + 3 * Math.sin(Date.now() / 120), 0, 7); c.stroke(); }
    c.rotate(hd); c.fillStyle = col; c.strokeStyle = css('--card'); c.lineWidth = 2; c.beginPath();
    if (a.trk == null) c.arc(0, 0, s * 0.7, 0, 7); else { c.moveTo(0, -s * 1.3); c.lineTo(s, s); c.lineTo(0, s * 0.45); c.lineTo(-s, s); c.closePath(); }
    c.stroke(); c.fill(); c.restore();
    if (a.d > km * 1000) { c.strokeStyle = col; c.setLineDash([3, 3]); c.beginPath(); c.arc(x, y, s + 3, 0, 7); c.stroke(); c.setLineDash([]); }
    if (!small || T.lvl) { c.fillStyle = col; c.font = `700 ${small ? 11 : 13}px Barlow Condensed`; c.textAlign = 'center';
      const lab = (a.rel == null ? '' : (a.rel >= 0 ? '+' : '−') + fAlt(Math.abs(a.rel))) + (a.climb != null && Math.abs(a.climb) >= 0.5 ? (a.climb > 0 ? '↑' : '↓') : '');
      c.fillText(lab, x, y + s + (small ? 11 : 14)); if (!small && C.names !== false && a.call) { c.font = `${11}px Barlow`; c.fillText(String(a.call).slice(0, 10), x, y - s - 6); } }
  });
  if (!list.length && !small) { c.fillStyle = css('--muted'); c.font = '13px Barlow'; c.textAlign = 'center'; c.fillText(trafficSrcNote(), cx, cy + R * 0.5); }
}
function trafficSrcNote() { const n = typeof trafficStatus === 'function' ? trafficStatus()[0] : ''; return st.flarmAt && Date.now() - st.flarmAt < 15000 ? 'no traffic nearby' : /aircraft/.test(n) ? 'no traffic nearby' : 'no traffic data'; }
DRAW.radar = radarDraw;
// adsb.fi is also fetched for a radar widget on the page shown (04 loadTraffic)
function radarKm() { const L0 = PAGEKEY[curPage] && S.layouts[PAGEKEY[curPage]]; const r = (L0 || []).filter((W) => W.type === 'radar').map((W) => +effCfg(W).range || 5); return r.length ? Math.max(...r) : 0; }
