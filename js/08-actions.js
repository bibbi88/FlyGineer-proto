'use strict';
/* ================= widget tap actions & detail popups ================= */
function defTap(W) { return W.type === 'time' ? 'time' : W.type === 'map' || W.type === 'button' ? 'none' : 'details'; }
let detT = null, detState = null;
function toggleFull() { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); } catch (e) { toast('Full screen not available here'); } }
document.addEventListener('fullscreenchange', () => { document.querySelectorAll('.wLayer .wg').forEach((e) => (e._last = null)); renderWidgets(); });
const PG_ALL = [['pMap', 'Map'], ['pThermal', 'Thermal'], ['pAtmos', 'Atmosphere'], ['pAir', 'Airspace'], ['pWeb', 'Web'], ['pSet', 'Settings']];
function pageMenu() {
  const m = $('pgMenu'), c = m.firstElementChild; c.innerHTML = '<b>Go to page</b>' + PG_ALL.map(([id, n]) => `<button class="btn" data-pg="${id}" ${curPage === id ? 'style="background:var(--ink);color:var(--bg)"' : ''}>${n}</button>`).join('');
  m.style.display = 'flex'; c.querySelectorAll('[data-pg]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); m.style.display = 'none'; goPage(b.dataset.pg); })); m.onclick = () => (m.style.display = 'none');
}
const isPageBtn = (W) => W.type === 'button' && /^p[A-Z]/.test(effCfg(W).action || '') && !wEdit;
function runAction(a, text) {
  switch (a) {
    case 'message': toast(text || 'Automatic action'); break;
    case 'soundOn': if (!S.sound) applySet('sound', 'true'); toast('Vario sound on'); break;
    case 'soundOff': if (S.sound) applySet('sound', 'false'); toast('Vario sound off'); break;
    case 'thermalOn': enterThermal(); break;
    case 'thermalOff': leaveThermal(); break;
    case 'thermalToggle': st.thermMode ? leaveThermal() : enterThermal(); break;
    case 'pMap': case 'pThermal': case 'pAtmos': case 'pAir': goPage(a); break;
    case 'prev': backPage(); break;
    case 'center': MAPS.forEach((I) => { I.follow = true; I.panAt = 0; }); renderWidgets(); break;
    case 'sound': applySet('sound', String(!S.sound)); toast('Vario sound ' + (S.sound ? 'on' : 'off')); break;
    case 'time': showTime(); break;
    case 'start': setStartHere(); break;
    case 'pSwitch': goPage(pageKey() === 'thermal' ? 'pMap' : 'pThermal'); break;
    case 'fullscreen': toggleFull(); break;
  }
}
function handleTap(W) {
  if (W.type === 'button') return runAction(effCfg(W).action);
  const a = effCfg(W).tap || defTap(W);
  if (a === 'none') return;
  if (a === 'time') return showTime();
  if (a === 'fullscreen') return toggleFull();
  if (a === 'sound') { applySet('sound', String(!S.sound)); toast('Vario sound ' + (S.sound ? 'on' : 'off')); return; }
  if (a[0] === 'p') return showPage(a);
  openDetails(W);
}
const GROUP = { vario: 'vario', avg: 'vario', varioDial: 'vario', thermal: 'vario', gain: 'vario', ttime: 'vario', climb: 'vario', ta: 'vario',
  alt: 'alt', agl: 'alt', cloud: 'alt', gs: 'spd', trk: 'spd', ld: 'glide', glide: 'glide', reqld: 'task', next: 'task', dist: 'task',
  wind: 'wind', flight: 'flight', place: 'place', air: 'air', time: 'flight', temp: 'alt', battery: 'flight', tside: 'vario', tcross: 'vario', thead: 'vario', t3d: 'vario', tlayer: 'vario', turn: 'vario', button: 'flight', core: 'vario', compass: 'spd', windDir: 'wind', profile: 'alt', groundT: 'alt', cbase: 'alt', ttop: 'alt', outlook: 'alt', trigger: 'alt', asside: 'air', asmap: 'air', aslist: 'air', places: 'place', radio: 'air', notams: 'air' };
function closeDetails() { clearInterval(detT); detT = null; detState = null; $('dlg').style.display = 'none'; }
function openDetails(W, range) {
  detState = { W, range: range ?? detState?.range ?? 600 };
  renderDetails(); clearInterval(detT); detT = setInterval(() => { if ($('dlg').style.display === 'none' || !$('detStats')) { clearInterval(detT); detT = null; return; } renderDetails(true); }, 1000);
}
function chartDraw(cv, pts, o) {
  const [c, W, H] = fitCanvas(cv); c.clearRect(0, 0, W, H);
  if (pts.length < 2) { c.fillStyle = css('--muted'); c.font = '15px Barlow'; c.textAlign = 'center'; c.fillText('Not enough data yet', W / 2, H / 2); return; }
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t; let y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
  if (o.zero) { y0 = Math.min(y0, -1); y1 = Math.max(y1, 1); } if (y1 - y0 < 1e-6) { y1 += 1; y0 -= 1; }
  const pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
  const X = (t) => 44 + (t - t0) / Math.max(1, t1 - t0) * (W - 50), Y = (y) => H - 20 - (y - y0) / (y1 - y0) * (H - 30);
  c.font = '11px Barlow'; c.fillStyle = css('--muted'); c.strokeStyle = css('--line'); c.lineWidth = 1; c.textAlign = 'right';
  const step = niceStep((y1 - y0) / 4); for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { c.beginPath(); c.moveTo(44, Y(y)); c.lineTo(W, Y(y)); c.stroke(); c.fillText(o.fmt ? o.fmt(y) : String(+y.toFixed(1)), 40, Y(y) + 4); }
  c.textAlign = 'left'; const d0 = new Date(t0), d1 = new Date(t1); c.fillText(pad2(d0.getHours()) + ':' + pad2(d0.getMinutes()), 44, H - 4); c.textAlign = 'right'; c.fillText(pad2(d1.getHours()) + ':' + pad2(d1.getMinutes()), W - 2, H - 4);
  if (o.zero) { c.strokeStyle = css('--ink'); c.beginPath(); c.moveTo(44, Y(0)); c.lineTo(W, Y(0)); c.stroke(); }
  if (o.bars) { const bw = Math.max(1, (W - 50) / pts.length); pts.forEach((p) => { c.fillStyle = p.y >= 0 ? (p.y >= 2 ? css('--climb') : css('--climb3')) : css('--sink'); const y = Y(p.y), z = Y(0); c.fillRect(X(p.t) - bw / 2, Math.min(y, z), bw, Math.abs(z - y)); }); }
  else { c.strokeStyle = o.color || css('--ink'); c.lineWidth = 2; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(X(p.t), Y(p.y)) : c.moveTo(X(p.t), Y(p.y)))); c.stroke(); }
  (o.marks || []).forEach((m) => { c.fillStyle = 'rgba(181,71,8,.15)'; c.fillRect(X(m.t0), 10, Math.max(2, X(m.t1) - X(m.t0)), H - 30); });
}
function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1e-6)))); const n = x / p; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p; }
function bucket(arr, key, sec) { const out = []; let cur = null; arr.forEach((p) => { const b = Math.floor(p.t / (sec * 1000)); if (!cur || cur.b !== b) { cur = { b, t: p.t, sum: 0, n: 0 }; out.push(cur); } if (p[key] != null) { cur.sum += p[key]; cur.n++; } }); return out.filter((x) => x.n).map((x) => ({ t: x.t, y: x.sum / x.n })); }
function statBox(l, v, s) { return `<div class="card w"><div class="lbl">${l}</div><div class="v num" style="font-size:28px">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`; }
function renderDetails(live) {
  const { W, range } = detState; const g = GROUP[W.type] || 'flight', now = nowT();
  const lg = range ? st.log.filter((p) => p.t >= now - range * 1000) : st.log;
  const ranges = [[120, '2 min'], [600, '10 min'], [1800, '30 min'], [0, 'Flight']];
  const title = { vario: 'Climb and sink', alt: 'Altitude', spd: 'Speed', glide: 'Glide', task: 'Task', wind: 'Wind history', flight: 'This flight', place: 'Places nearby', air: 'Airspace nearby' }[g];
  let chart = null, stats = '', extra = '';
  const th = st.thermals.filter((t) => !range || t.t1 >= now - range * 1000);
  if (g === 'vario') {
    chart = { pts: bucket(lg, 'v', lg.length > 900 ? 10 : lg.length > 300 ? 3 : 1), o: { zero: true, bars: true, marks: th } };
    const vs = lg.map((p) => p.v); const roll = (n) => { let best = -99, worst = 99; for (let i = n; i <= vs.length; i++) { const a = vs.slice(i - n, i).reduce((x, y) => x + y, 0) / n; best = Math.max(best, a); worst = Math.min(worst, a); } return [best, worst]; };
    const [mx, mn] = vs.length >= 5 ? roll(5) : [null, null]; const up = vs.length ? vs.filter((v) => v > 0).length / vs.length * 100 : null;
    const ta = th.length ? th.reduce((x, t) => x + t.avg, 0) / th.length : null; const best = th.reduce((b, t) => (!b || t.avg > b.avg ? t : b), null);
    stats = statBox('Now', fVario(st.vario), uV()) + statBox('Avg 30 s', fVario(avgVario(30, now)), uV()) + statBox('Best 5 s', mx != null ? fVario(mx) : '--', 'strongest climb') + statBox('Worst 5 s', mn != null ? fVario(mn) : '--', 'strongest sink') + statBox('Climbing', up != null ? Math.round(up) + '%' : '--', 'of the time') + statBox('Thermals', th.length, ta != null ? 'avg ' + fVario(ta) + ' ' + uV() : '') + statBox('Best thermal', best ? fVario(best.avg) : '--', best ? '+' + fAlt(best.alt1 - best.alt0) + ' ' + S.uAlt : '') + statBox('Avg ' + (range ? range / 60 + ' min' : 'flight'), vs.length ? fVario(vs.reduce((x, y) => x + y, 0) / vs.length) : '--', uV());
    extra = th.length ? `<div class="lbl">Thermals${range ? ' in this range' : ''}</div>` + th.slice(-6).reverse().map((t) => { const d = new Date(t.t0); return `<div class="li"><b class="num" style="font-size:20px;width:64px">${pad2(d.getHours())}:${pad2(d.getMinutes())}</b><span class="grow">+${fAlt(t.alt1 - t.alt0)} ${S.uAlt} in ${Math.round((t.t1 - t.t0) / 60000)} min</span><b class="num" style="font-size:22px;color:var(--climb)">${fVario(t.avg)}</b></div>`; }).join('') : '';
  }
  if (g === 'alt') {
    chart = { pts: bucket(lg, 'alt', lg.length > 900 ? 10 : 2), o: { color: css('--sink'), marks: th, fmt: (y) => fAlt(y) } };
    const al = lg.map((p) => p.alt).filter((a) => a != null); let climb = 0; for (let i = 1; i < al.length; i++) if (al[i] > al[i - 1]) climb += al[i] - al[i - 1];
    const fc = st.forecast; const cb = fc ? fc.elev + 125 * (fc.T - fc.Td) : null;
    stats = statBox('Now', fAlt(altNow()), S.uAlt) + statBox('Above ground', st.groundElev != null && altNow() != null ? fAlt(altNow() - st.groundElev) : '--', S.uAlt) + statBox('Highest', al.length ? fAlt(Math.max(...al)) : '--', S.uAlt) + statBox('Lowest', al.length ? fAlt(Math.min(...al)) : '--', S.uAlt) + statBox('Total climbed', fAlt(climb), S.uAlt) + statBox('Cloud base', cb ? fAlt(cb) : '--', cb ? 'forecast' : 'load forecast') + statBox('Thermal top', thermalTop() ? fAlt(thermalTop()) : '--', 'forecast') + statBox('Temperature', st.baro?.temp != null ? st.baro.temp.toFixed(1) + ' °C' : '--', '');
  }
  if (g === 'spd') {
    const sp = lg.filter((p) => p.spd != null); chart = { pts: bucket(sp, 'spd', sp.length > 900 ? 10 : 3).map((p) => ({ t: p.t, y: S.uSpd === 'kt' ? p.y * 1.94384 : p.y * 3.6 })), o: { color: css('--ink') } };
    const v = sp.map((p) => p.spd); const f = st.fix;
    stats = statBox('Now', fSpd(f?.spd), S.uSpd) + statBox('Average', v.length ? fSpd(v.reduce((x, y) => x + y, 0) / v.length) : '--', S.uSpd) + statBox('Max', v.length ? fSpd(Math.max(...v)) : '--', S.uSpd) + statBox('Track', f?.trk != null ? pad3(f.trk) + '°' : '--', f?.trk != null ? compass(f.trk) : '') + statBox('Wind', windFromSpd() ? fSpd(windFromSpd().spd) : '--', windFromSpd() ? 'from ' + pad3(windFromSpd().from) + '°' : '') + statBox('Airspeed est.', st.lastTurn ? fSpd(st.lastTurn.tas) : '--', 'from last circle');
  }
  if (g === 'glide') {
    const gl = []; let prev = null; (st.thermals.length ? st.thermals : []).forEach((t) => { if (prev) { const s0 = st.log.find((p) => p.t >= prev.t1), s1 = [...st.log].reverse().find((p) => p.t <= t.t0); if (s0 && s1 && s0.lat != null && s1.lat != null && s0.alt - s1.alt > 20) gl.push({ t: s0.t, d: dist(s0.lat, s0.lon, s1.lat, s1.lon), h: s0.alt - s1.alt }); } prev = t; });
    const p = st.pred; const ld = (win) => { const v = avgVario(win, now), sp = avgSpd(win, now); return !st.circling && v != null && v < -0.2 && sp > 3 ? (sp / -v).toFixed(1) : '--'; };
    stats = statBox('L/D 20 s', ld(20), st.circling ? 'circling now' : '') + statBox('L/D 60 s', ld(60), '') + statBox('Wing L/D', S.wingLD, 'set in Units & glide') + statBox('Lands at L/D now', p.now ? fDist(p.now[2]) : '--', 'filled dot') + statBox('Lands at wing L/D', p.wing ? fDist(p.wing[2]) : '--', 'empty dot') + statBox('Above ground', st.groundElev != null && altNow() != null ? fAlt(altNow() - st.groundElev) : '--', S.uAlt);
    extra = gl.length ? '<div class="lbl">Glides between thermals</div>' + gl.slice(-6).reverse().map((x) => { const d = new Date(x.t); return `<div class="li"><b class="num" style="font-size:20px;width:64px">${pad2(d.getHours())}:${pad2(d.getMinutes())}</b><span class="grow">${fDist(x.d)} for ${fAlt(x.h)} ${S.uAlt}</span><b class="num" style="font-size:22px">L/D ${(x.d / x.h).toFixed(1)}</b></div>`; }).join('') : '<div class="muted">Glides between thermals appear here after two thermals.</div>';
  }
  if (g === 'task') {
    const f = st.fix;
    if (!st.task) extra = '<div class="muted">No task loaded. Import a route from FlyXC on the Web page.</div>';
    else { let rem = 0; extra = '<div class="lbl">' + esc(st.task.name) + ' · ' + (st.task.len / 1000).toFixed(1) + ' km</div>' + st.task.pts.map((w, i) => { const d = f ? dist(f.lat, f.lon, w.lat, w.lon) : null; if (i > st.nextWp && i > 0) rem += dist(st.task.pts[i - 1].lat, st.task.pts[i - 1].lon, w.lat, w.lon); return `<div class="li"><b style="width:64px">${i < st.nextWp ? '✓' : i === st.nextWp ? 'next' : ''}</b><span class="grow"><b>${esc(w.name)}</b></span><span>${d != null ? fDist(d) + ' · ' + pad3(brg(f.lat, f.lon, w.lat, w.lon)) + '°' : ''}</span></div>`; }).join('');
      const wp = st.task.pts[st.nextWp]; const d = f && wp ? dist(f.lat, f.lon, wp.lat, wp.lon) : null;
      stats = statBox('Next', wp ? esc(wp.name) : '--', d != null ? fDist(d) : '') + statBox('Remaining', d != null ? fDist(d + rem) : '--', 'via all turnpoints') + statBox('Req. glide', d != null && st.groundElev != null && altNow() != null ? (d / Math.max(1, altNow() - st.groundElev - S.safety)).toFixed(1) : '--', 'to next') + statBox('ETA next', f?.spd > 2 && d != null ? etaStr(d / f.spd) : '--', 'at current speed'); }
  }
  if (g === 'wind') {
    const ws = st.winds.filter((x) => !range || x.t >= now - range * 1000); chart = ws.length > 1 ? { pts: ws.map((x) => ({ t: x.t, y: S.uSpd === 'kt' ? x.spd * 1.94384 : x.spd * 3.6 })), o: { color: css('--sink') } } : null;
    const w = windFromSpd(); stats = statBox('Now', w ? fSpd(w.spd) : '--', w ? S.uSpd + ' from ' + pad3(w.from) + '° ' + compass(w.from) : 'circle once') + statBox('Measurements', ws.length, 'one per 30 s of circling');
    extra = ws.length ? '<div class="lbl">Wind by height</div>' + ws.slice().sort((a, b) => b.alt - a.alt).slice(0, 10).map((x) => `<div class="li"><b class="num" style="font-size:20px;width:80px">${fAlt(x.alt)} ${S.uAlt}</b><svg width="22" height="22" viewBox="0 0 14 14" aria-hidden="true"><g transform="rotate(${(x.from + 180) % 360} 7 7)"><path d="M7 1l4 8H3z" fill="currentColor"/><line x1="7" y1="8" x2="7" y2="13" stroke="currentColor" stroke-width="2"/></g></svg><span class="grow">from ${pad3(x.from)}° ${compass(x.from)}</span><b class="num" style="font-size:22px">${fSpd(x.spd)} ${S.uSpd}</b></div>`).join('') : '';
  }
  if (g === 'flight') {
    const f = st.fix, tp = st.takeoffPos, dur = st.takeoffT ? (now - st.takeoffT) / 1000 : null; const al = st.log.map((p) => p.alt).filter((a) => a != null);
    let path = 0; for (let i = 1; i < st.log.length; i++) { const a = st.log[i - 1], b = st.log[i]; if (a.lat != null && b.lat != null) path += dist(a.lat, a.lon, b.lat, b.lon); }
    const d0 = st.takeoffT ? new Date(st.takeoffT) : null;
    stats = statBox('Takeoff', d0 ? pad2(d0.getHours()) + ':' + pad2(d0.getMinutes()) : '--', '') + statBox('Duration', dur != null ? Math.floor(dur / 3600) + ':' + pad2(Math.floor(dur / 60) % 60) : '--', 'h:min') + statBox('From takeoff', tp && f ? fDist(dist(tp[0], tp[1], f.lat, f.lon)) : '--', 'straight line') + statBox('Flown', fDist(path), 'track length') + statBox('Highest', al.length ? fAlt(Math.max(...al)) : '--', S.uAlt) + statBox('Thermals', st.thermals.length, st.thermals.length ? 'avg ' + fVario(st.thermals.reduce((x, t) => x + t.avg, 0) / st.thermals.length) : '') + statBox('Vario battery', st.bora?.batt ? (st.bora.batt.pct != null ? st.bora.batt.pct + '%' : st.bora.batt.v.toFixed(2) + ' V') : st.sim ? (st.simBat || 90) + '%' : '--', '') + statBox('Tablet battery', st.deviceBat != null ? st.deviceBat + '%' : '--', '');
    chart = { pts: bucket(st.log, 'alt', st.log.length > 900 ? 10 : 2), o: { color: css('--sink'), marks: st.thermals, fmt: (y) => fAlt(y) } };
  }
  if (g === 'place') { const f = st.fix; extra = f ? visiblePlaces().map((p) => ({ ...p, d: dist(f.lat, f.lon, p.lat, p.lon), b: brg(f.lat, f.lon, p.lat, p.lon) })).sort((a, b) => a.d - b.d).slice(0, 10).map((p) => `<div class="li"><span class="grow"><b>${esc(p.name)}</b> <span class="lbl">${esc(p.kind)}</span><br><span class="muted">You are ${fDist(p.d)} ${compass(p.b + 180)} of it</span></span><b class="num" style="font-size:22px">${fDist(p.d)}</b></div>`).join('') || '<div class="muted">No places loaded yet. Open the Airspace page once with mobile data.</div>' : '<div class="muted">Waiting for GPS.</div>'; }
  if (g === 'air') { extra = airStatus().slice(0, 8).map((x) => `<div class="li"><span class="grow"><b>${esc(x.a.name)}</b> <span class="muted">${fmtLim(x.a.lo)} – ${fmtLim(x.a.hi)}</span></span><b>${x.inside && x.vert === 'in' ? 'inside' : fDist(x.d) + ' · ' + (x.vert === 'below' ? 'below floor' : x.vert === 'above' ? 'above top' : 'in height band')}</b></div>`).join('') || '<div class="muted">No airspace data loaded. See Settings → Airspace data.</div>'; }
  const showRange = ['vario', 'alt', 'spd', 'wind'].includes(g);
  if (!live || !$('detStats')) {
    $('dlgBody').innerHTML = `<div class="row" style="justify-content:space-between"><span class="num" style="font-size:26px">${title}</span><span class="row"><button class="btn" id="detEdit">Edit widget</button><button class="btn primary" id="dlgClose">Close</button></span></div>
      ${showRange ? `<div class="row">${ranges.map(([r, n]) => `<button class="pill grow" data-rg="${r}" aria-pressed="${range === r}">${n}</button>`).join('')}</div>` : ''}
      ${chart ? '<div style="height:200px;position:relative"><canvas id="detCv" style="position:absolute;inset:0;width:100%;height:100%" aria-label="' + title + ' chart"></canvas></div>' : ''}
      <div id="detStats" class="wgrid" style="grid-template-columns:repeat(4,minmax(0,1fr))">${stats}</div><div id="detExtra">${extra}</div>`;
    $('dlg').style.display = 'flex';
    $('dlgClose').onclick = closeDetails;
    $('detEdit').onclick = () => { closeDetails(); enterEdit(W.id); };
    $('dlgBody').querySelectorAll('[data-rg]').forEach((b) => (b.onclick = () => { detState.range = +b.dataset.rg; renderDetails(); }));
  } else { $('detStats').innerHTML = stats; $('detExtra').innerHTML = extra; }
  if (chart && $('detCv')) chartDraw($('detCv'), chart.pts, chart.o);
}


/* ================= FlyXC: "use this route" ================= */
const appUrl = () => location.origin + location.pathname;
const bookmarklet = () => `javascript:(()=>{const p=new URL(location.href).searchParams.get('p');if(!p){alert('Draw a route in FlyXC first');return;}window.open('${appUrl()}?from=flyxc&p='+encodeURIComponent(p),'bora');})()`;
async function useFlyxcRoute() {
  let txt = '';
  try { txt = await navigator.clipboard.readText(); } catch (e) { txt = ''; }
  if (/flyxc\.app\/?\S*[?&]p=/i.test(txt)) { if (importFlyXC(txt)) return; }
  $('dlgBody').innerHTML = `<div class="row" style="justify-content:space-between"><span class="num" style="font-size:26px">Use my FlyXC route</span><button class="btn primary" id="dlgClose">Close</button></div>
    <div style="font-size:16px;line-height:1.45">FlyXC keeps the planned route in its link. Copy that link in FlyXC, then tap <b>Import</b>. If the link is already copied, it is pasted below.</div>
    <textarea id="fxPaste" rows="3" style="width:100%;border-radius:10px;border:1px solid var(--line);background:var(--bg);padding:10px;font:inherit" placeholder="https://flyxc.app/?p=…">${esc(txt)}</textarea>
    <div class="row"><button class="btn primary" id="fxDo">Import as my task</button><button class="btn" id="fxOpen">Open FlyXC in a browser tab</button></div>
    <div class="muted" style="font-size:14px">Tip: add the "Send to Bora" button to Chrome once (Settings → Task). Then plan in FlyXC in a normal tab and tap the bookmark: the route arrives here automatically.</div>`;
  $('dlg').style.display = 'flex';
  $('dlgClose').onclick = () => ($('dlg').style.display = 'none');
  $('fxDo').onclick = () => { if (importFlyXC($('fxPaste').value)) $('dlg').style.display = 'none'; };
  $('fxOpen').onclick = () => window.open('https://flyxc.app/', '_blank');
}
window.addEventListener('storage', (e) => {
  if (e.key !== 'bora.task') return;
  st.task = JSON.parse(e.newValue || 'null'); st.nextWp = st.task && st.task.pts.length > 1 ? 1 : 0; drawTask();
  if (st.task) toast(`New route from FlyXC · ${st.task.pts.length} points · ${(st.task.len / 1000).toFixed(1)} km`, [['Show on map', () => showPage('pMap')]]);
});


/* ================= Start point (takeoff) ================= */
function savedStart() { try { return JSON.parse(localStorage.getItem('bora.start') || 'null'); } catch (e) { return null; } }
function startPlace() {
  let p = null;
  if (st.replay || st.sim) { if (st.takeoffPos) p = { lat: st.takeoffPos[0], lon: st.takeoffPos[1], sub: st.replay ? 'replay takeoff' : 'demo takeoff' }; }
  else { const s0 = savedStart(); if (s0) p = { lat: s0.lat, lon: s0.lon, sub: s0.manual ? 'set by you' : 'takeoff' }; }
  return p ? { name: 'Start', kind: 'start', rank: 9, ...p } : null;
}
function autoStart() {
  if (st.replay || st.sim || !st.takeoffPos) return;
  const s0 = savedStart(); if (s0 && s0.manual && Date.now() - s0.t < 12 * 3600000) return; // keep a recent manual start
  localStorage.setItem('bora.start', JSON.stringify({ lat: st.takeoffPos[0], lon: st.takeoffPos[1], t: Date.now(), manual: false }));
}
function setStartHere() {
  const f = st.fix; if (!f) { toast('Waiting for a GPS position'); return; }
  if (st.replay || st.sim) { st.takeoffPos = [f.lat, f.lon, altNow()]; toast('Start set for this replay'); }
  else { localStorage.setItem('bora.start', JSON.stringify({ lat: f.lat, lon: f.lon, t: Date.now(), manual: true })); toast('Start set at your position'); }
  renderPlaces(); drawMiniPlaces();
}

/* ================= update rate, thermal mode, export / import ================= */
let loopT = null;
function rateNow() { const r = st.thermMode && +S.rateT > 0 ? +S.rateT : +S.rate; return clamp(r || 0.4, 0.1, 5); }
function loop() { clearTimeout(loopT); try { tick(); } catch (e) { console.error(e); } loopT = setTimeout(loop, rateNow() * 1000); }
function enterThermal() { st.manual = 'on'; updateMode(); }
function leaveThermal() { st.manual = 'off'; st.offAt = 0; updateMode(); toast('Thermal mode off · starts again when you next circle'); }
function goPage(id) { if (curPage !== id) { st.prevPage = curPage; showPage(id); } }
function backPage() { if (st.prevPage && st.prevPage !== curPage) { const p = st.prevPage; st.prevPage = curPage; showPage(p); } }
function chipTap() {
  if (!st.thermMode) { enterThermal(); return; }
  const target = S.thermPage && S.thermPage !== 'off' ? S.thermPage : 'pThermal';
  if (curPage !== target) goPage(target); else backPage();
}
function updateMode() {
  const t = nowT(); let want;
  if (st.force) want = true;
  else if (st.manual === 'on') { want = true; if (st.circling) st.manual = null; }
  else if (st.manual === 'off') { want = false; if (!st.circling) { st.offAt = st.offAt || t; if (t - st.offAt > 3000) { st.manual = null; st.offAt = 0; } } else st.offAt = 0; }
  else if (S.modeAuto === false || S.modeAuto === 'false') want = false;
  else if (st.circling) { st.gliSince = 0; st.cirSince = st.cirSince || t; want = !!st.thermMode || t - st.cirSince >= (+S.modeEnter || 6) * 1000; }
  else { st.cirSince = 0; if (st.thermMode) { st.gliSince = st.gliSince || t; want = t - st.gliSince < (+S.modeHold || 20) * 1000; } else want = false; }
  if (want !== !!st.thermMode) setMode(want);
}
function setMode(on) {
  st.thermMode = on; if (!on) st.gliSince = 0;
  if (!wEdit && !st.force) {
    if (on && S.thermPage && S.thermPage !== 'off' && PAGEKEY[curPage] && curPage !== S.thermPage) { st.prevPage = curPage; st.autoSwitched = true; st.autoNav = true; showPage(S.thermPage); st.autoNav = false; }
    else if (!on && st.autoSwitched && S.thermBack !== false && S.thermBack !== 'false' && curPage === S.thermPage && st.prevPage) { st.autoNav = true; showPage(st.prevPage); st.autoNav = false; st.autoSwitched = false; }
  }
  if (!on && !(st.autoSwitched && curPage === S.thermPage)) st.autoSwitched = false;
  st.modeSince = nowT();
  renderTop(); renderWidgets(); clearTimeout(loopT); loopT = setTimeout(loop, rateNow() * 1000);
  fireEvent(on ? 'thermalStart' : 'thermalStop');
}
const NO_EXPORT = new Set(['openaipKey', 'notamProxy', 'layouts', 'layout', 'layoutGrid', 'widgets', 'hidden', 'mapMigrated']);
const IMPORT_OK = new Set(['uVario', 'uAlt', 'uSpd', 'avgS', 'wingLD', 'rotDefault', 'taOrient', 'layer', 'poiRadius', 'poiKinds', 'cylR', 'safety', 'theme', 'navMode', 'trig', 'flykUrl', 'notamRadius', 'sound', 'volume', 'wake', 'autoImport', 'customUrl', 'qnh', 'rate', 'rateT', 'modeAuto', 'modeEnter', 'modeHold', 'thermPage', 'thermBack', 'modeChip', 'autoRules']);
function downloadJSON(obj, name) { const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function buildExport(scope) {
  const o = { app: 'bora-flight', version: 1, exported: new Date().toISOString(), layoutGrid: GSC, layouts: JSON.parse(JSON.stringify(S.layouts)) };
  if (scope === 'all') { o.settings = {}; Object.keys(S).forEach((k) => { if (!NO_EXPORT.has(k)) o.settings[k] = S[k]; }); }
  return o;
}
function exportSettings(scope) {
  const d = new Date(), name = `bora-${scope === 'all' ? 'settings' : 'layouts'}-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}.json`;
  downloadJSON(buildExport(scope), name); toast('Saved ' + name);
}
function cleanCfg(o) { const out = {}; if (o && typeof o === 'object') Object.keys(o).slice(0, 40).forEach((k) => { const v = o[k]; if (typeof v === 'number' ? isFinite(v) : typeof v === 'boolean') out[k] = v; else if (typeof v === 'string') out[k] = v.slice(0, 80); }); return out; }
function cleanW(k) {
  return (W) => {
    if (!W || typeof W !== 'object' || !WT[W.type]) return null;
    const w = clamp(Math.round((+W.w || WT[W.type].w * GSC) * k), 6, GC), h = clamp(Math.round((+W.h || WT[W.type].h * GSC) * k), 4, GR);
    const r = { id: newW(W.type).id, type: W.type, x: clamp(Math.round((+W.x || 0) * k), 0, GC - w), y: clamp(Math.round((+W.y || 0) * k), 0, GR - h), w, h, cfg: Object.assign({ size: 'auto', bg: 70, showLabel: true }, cleanCfg(W.cfg)) };
    if (W.cfgT && typeof W.cfgT === 'object') r.cfgT = cleanCfg(W.cfgT);
    return r;
  };
}
function parseImport(txt) {
  let o; try { o = JSON.parse(txt); } catch (e) { return { err: 'That file is not valid JSON.' }; }
  if (!o || o.app !== 'bora-flight') return { err: 'This is not a Bora Flight settings file.' };
  const k = GSC / (+o.layoutGrid || GSC), lay = {}; let nW = 0;
  Object.keys(LAYERID).forEach((pk) => { const a = o.layouts && o.layouts[pk]; if (Array.isArray(a)) { lay[pk] = a.map(cleanW(k)).filter(Boolean); nW += lay[pk].length; } });
  const sets = {}; if (o.settings && typeof o.settings === 'object') Object.keys(o.settings).forEach((key) => { const v = o.settings[key]; if (!IMPORT_OK.has(key)) return; if (key === 'autoRules') { sets[key] = cleanRules(v); return; } const d = DEF[key]; if (d !== undefined && typeof d !== typeof v) return; if (v !== null && typeof v === 'object' && key !== 'poiKinds') return; sets[key] = key === 'poiKinds' ? cleanCfg(v) : v; });
  return { lay, sets, nW, pages: Object.keys(lay).length, nSets: Object.keys(sets).length, date: o.exported };
}
function applyImport(P) {
  const backup = { layouts: JSON.parse(JSON.stringify(S.layouts)), settings: {} }; Object.keys(P.sets).forEach((k) => (backup.settings[k] = S[k]));
  const apply = (lay, sets) => { Object.assign(S.layouts, lay); Object.assign(S, sets); S.mapMigrated = true; save(); document.body.classList.toggle('dark', S.theme === 'dark'); document.body.classList.toggle('pinned', S.navMode === 'pinned'); drawTask(); loop(); renderWidgets(); if (curPage === 'pSet') renderSettings(); };
  apply(P.lay, P.sets);
  toast(`Imported ${P.nW} widgets on ${P.pages} pages${P.nSets ? ' and ' + P.nSets + ' settings' : ''}`, [['Undo', () => { apply(backup.layouts, backup.settings); toast('Import undone'); }]]);
}
function openImport(txt, fname) {
  const P = parseImport(txt); if (P.err) { toast(P.err); return; }
  $('dlgBody').innerHTML = `<div class="row" style="justify-content:space-between"><span class="num" style="font-size:26px">Import settings</span><button class="btn" id="dlgClose">Cancel</button></div>
    <div style="font-size:16px;line-height:1.45">${esc(fname || 'File')}${P.date ? ' · saved ' + esc(String(P.date).slice(0, 10)) : ''}<br><b>${P.nW} widgets</b> on <b>${P.pages} pages</b>${P.nSets ? ` and <b>${P.nSets} settings</b> (units, glide ratio, update rate, thermal mode …)` : ''}.</div>
    <div class="muted">This replaces the layout of the pages in the file. You can undo right after.</div>
    <div class="row"><button class="btn primary" id="impGo">Import and replace</button></div>`;
  $('dlg').style.display = 'flex'; $('dlgClose').onclick = () => ($('dlg').style.display = 'none'); $('impGo').onclick = () => { $('dlg').style.display = 'none'; applyImport(P); };
}

/* ================= automatic actions: when an event happens, optionally after a delay, do something ================= */
const AUTO_EVENTS = [['thermalStart', 'Started thermalling'], ['thermalStop', 'Stopped thermalling'], ['takeoff', 'Takeoff'], ['turnpoint', 'Turnpoint reached']];
const RULE_ACTS = ['pThermal', 'pMap', 'pAtmos', 'pAir', 'prev', 'center', 'soundOn', 'soundOff', 'time', 'start', 'message'];
const ruleActLabel = (a) => (a === 'message' ? 'Show a message' : (BTN[a] || [a])[0]);
const evLabel = (e) => (AUTO_EVENTS.find((x) => x[0] === e) || [e, e])[1];
st.autoQ = [];
function ruleSummary(r) { return `When ${evLabel(r.event).toLowerCase()}${+r.delay > 0 ? ', after ' + r.delay + ' s' : ''} → ${ruleActLabel(r.action).toLowerCase()}${r.action === 'message' && r.text ? ': “' + r.text + '”' : ''}`; }
function execRule(r) {
  const nav = /^p[A-Z]/.test(r.action) || r.action === 'prev';
  if (nav && (wEdit || !PAGEKEY[curPage])) return;                                                                          // never pull you out of Settings, Web or the widget editor
  const t = nowT(); st.autoLast = st.autoLast || {}; if (t - (st.autoLast[r.id] || -1e15) < 1000) return; st.autoLast[r.id] = t;   // never twice within a second
  runAction(r.action, r.text);
}
function scheduleAuto(sec) { setTimeout(runAutoPending, sec * 1000 / (st.replay ? st.replay.speed : 1) + 40); }
function fireEvent(ev) {
  if (st.force) return;                                                                                                     // the thermal-tab preview never triggers anything
  if (ev === 'thermalStop') st.autoQ = st.autoQ.filter((p) => p.ev !== 'thermalStart'); if (ev === 'thermalStart') st.autoQ = st.autoQ.filter((p) => p.ev !== 'thermalStop');
  (S.autoRules || []).forEach((r) => { if (r.on === false || r.event !== ev) return; const d = +r.delay || 0; if (d <= 0) execRule(r); else { st.autoQ.push({ ev, rule: r, due: nowT() + d * 1000 }); scheduleAuto(d); } });
}
function runAutoPending() { if (!st.autoQ.length) return; const t = nowT(), due = st.autoQ.filter((p) => p.due <= t || p.due - t > 3600000); if (!due.length) return; st.autoQ = st.autoQ.filter((p) => !due.includes(p)); due.forEach((p) => { if (p.due <= t) execRule(p.rule); }); }
function cleanRules(a) { if (!Array.isArray(a)) return []; return a.slice(0, 30).filter((r) => r && typeof r === 'object' && AUTO_EVENTS.some((e) => e[0] === r.event) && RULE_ACTS.includes(r.action)).map((r) => ({ id: 'ar' + Math.random().toString(36).slice(2, 8), on: r.on !== false, event: r.event, delay: clamp(Math.round(+r.delay || 0), 0, 600), action: r.action, text: String(r.text || '').slice(0, 80) })); }
function ruleCard(r, i) {
  const ev = AUTO_EVENTS.map(([k, n]) => `<button class="pill" data-ari="${i}" data-arf="event" data-arv="${k}" aria-pressed="${r.event === k}">${n}</button>`).join('');
  const acts = RULE_ACTS.map((a) => `<option value="${a}" ${r.action === a ? 'selected' : ''}>${esc(ruleActLabel(a))}</option>`).join('');
  return `<div class="card sec" style="${r.on === false ? 'opacity:.6' : ''}">
    <div class="row" style="justify-content:space-between"><b style="font-size:17px">Action ${i + 1}</b><span class="row"><button class="pill" data-ari="${i}" data-aron="1" aria-pressed="${r.on !== false}">${r.on !== false ? 'On' : 'Off'}</button><button class="pill" data-ari="${i}" data-arrun="1">Run now</button><button class="pill" data-ari="${i}" data-ardel="1" aria-label="Delete action">Delete</button></span></div>
    <div class="opt"><span class="lbl">When</span><div class="row" style="flex-wrap:wrap">${ev}</div></div>
    <div class="opt"><span class="lbl">After · 0 = immediately</span><div class="row"><button class="pill step" data-ari="${i}" data-arst="-1" aria-label="Less">−</button><input type="number" class="numin" inputmode="decimal" data-ari="${i}" data-arn="delay" value="${r.delay || 0}" min="0" max="600" step="1" aria-label="Delay in seconds"><span class="unit">s</span><button class="pill step" data-ari="${i}" data-arst="1" aria-label="More">+</button></div></div>
    <div class="opt"><label class="lbl" for="arA${i}">Do</label><select id="arA${i}" data-ari="${i}" data-arsel="action" style="height:48px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--bg);width:100%">${acts}</select></div>
    ${r.action === 'message' ? `<div class="opt"><label class="lbl" for="arT${i}">Message</label><input type="text" id="arT${i}" data-ari="${i}" data-artx="1" value="${esc(r.text || '')}" placeholder="Text to show" style="height:48px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--bg);width:100%"></div>` : ''}
    <div class="muted" style="font-size:14px">${esc(ruleSummary(r))}</div></div>`;
}
function autoSection() {
  const rules = S.autoRules || [];
  return `<div class="card sec"><h2>Automatic actions</h2>
    <div class="muted" style="line-height:1.45">Do something by itself when an event happens, optionally after a delay. A delayed action is cancelled if the opposite event comes first (for example thermalling stops before the delay is over). Pages are never changed while you are in Settings, Web or editing widgets.</div></div>
    ${rules.map(ruleCard).join('') || '<div class="card sec"><div class="muted">No automatic actions yet. Example: <b>When started thermalling → show Thermal page</b>, and <b>When stopped thermalling, after 20 s → previous page</b>.</div></div>'}
    <div class="card sec"><button class="btn primary" id="arAdd">+ Add action</button></div>`;
}
function ruleEdit(i, field, val) { const r = (S.autoRules || [])[i]; if (!r) return; if (field === 'delay') r.delay = clamp(Math.round(+val) || 0, 0, 600); else r[field] = val; save(); renderSettings(); }

