'use strict';
/* ================= widget tap actions & detail popups ================= */
// default "When held": the page button opens the page menu, height widgets show heights in feet, maps and buttons nothing, other widgets their details
function defHold(W) { return W.type === 'airbtn' || W.type === 'airwarn' ? 'airlist' : W.type === 'thchip' ? 'thoff' : W.type === 'button' ? (/^p[A-Z]/.test(effCfg(W).action || '') || effCfg(W).action === 'pSwitch' ? 'pages' : 'none') : W.type === 'alt' || W.type === 'agl' ? 'heights' : W.type === 'tclock' ? 'times' : W.type === 'coord' ? 'coordinfo' : W.type === 'map' || W.type === 'pgpie' ? 'none' : 'details'; }
function defTap(W) { return W.type === 'pgpie' ? 'none' : W.type === 'coord' ? 'coordinfo' : W.type === 'airbtn' || W.type === 'airwarn' ? 'airlist' : W.type === 'thchip' ? 'chip' : W.type === 'time' ? 'time' : W.type === 'tclock' ? 'times' : W.type === 'conn' ? 'conninfo' : W.type === 'rec' ? 'logbook' : W.type === 'land' ? 'landlist' : W.type === 'stf' ? 'mc' : W.type === 'tday' ? 'dayinfo' : W.type === 'gmeter' ? 'greset' : W.type === 'xcscore' ? 'scoreinfo' : W.type === 'rbnext' ? 'rblist' : W.type === 'wstation' ? 'stations' : W.type === 'alt' || W.type === 'agl' ? 'heights' : W.type === 'map' || W.type === 'button' ? 'none' : 'details'; }
let detT = null, detState = null;
function toggleFull() { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); } catch (e) { toast('Full screen not available here'); } }
document.addEventListener('fullscreenchange', () => { document.querySelectorAll('.wLayer .wg').forEach((e) => (e._last = null)); renderWidgets(); });
const PG_ALL = [['pMap', 'Map'], ['pThermal', 'Thermal'], ['pAtmos', 'Atmosphere'], ['pAir', 'Airspace'], ['pPlan', 'Planner'], ['pWeb', 'Web'], ['pSet', 'Settings']];
function pageMenu() {
  const m = $('pgMenu'), c = m.firstElementChild; c.innerHTML = '<b>Go to page</b>' + PG_ALL.map(([id, n]) => `<button class="btn" data-pg="${id}" ${curPage === id ? 'style="background:var(--ink);color:var(--bg)"' : ''}>${n}</button>`).join('');
  m.style.display = 'flex'; c.querySelectorAll('[data-pg]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); m.style.display = 'none'; goPage(b.dataset.pg); })); m.onclick = () => (m.style.display = 'none');
}
const isPageBtn = (W) => W.type === 'button' && /^p[A-Z]/.test(effCfg(W).action || '') && !wEdit;
function runAction(a, text) {
  switch (a) {
    case 'message': toast(text || 'Automatic action'); break;
    case 'say': say(text || '', true); break;
    case 'soundOn': if (!S.sound) applySet('sound', 'true'); toast('Vario sound on'); break;
    case 'soundOff': if (S.sound) applySet('sound', 'false'); toast('Vario sound off'); break;
    case 'titles': S.titles = S.titles === 'hide' ? 'each' : 'hide'; save(); renderWidgets(); toast(S.titles === 'hide' ? 'Widget titles hidden' : 'Widget titles shown'); break;
    case 'thermalOn': enterThermal(); break;
    case 'thermalOff': leaveThermal(); break;
    case 'thermalToggle': st.thermMode ? leaveThermal() : enterThermal(); break;
    case 'pMap': case 'pThermal': case 'pAtmos': case 'pAir': case 'pPlan': goPage(a); break;
    case 'prev': backPage(); break;
    case 'center': MAPS.forEach((I) => { I.follow = true; I.panAt = 0; }); renderWidgets(); break;
    case 'sound': case 'mute': applySet('sound', String(!S.sound)); toast('Vario sound ' + (S.sound ? 'on' : 'off')); renderWidgets(); break;
    case 'time': showTime(); break;
    case 'start': setStartHere(); break;
    case 'pSwitch': goPage(pageKey() === 'thermal' ? 'pMap' : 'pThermal'); break;
    case 'fullscreen': toggleFull(); break;
    case 'copyTask': copyTask(); break;
    case 'share': sharePos(); break;
    case 'retrieve': openRetrieve(); break;
    case 'checklist': openChecklist(); break;
    case 'edit': if (PAGEKEY[curPage]) enterEdit(); break;
    default: if (isUserPage(a) && PAGEKEY[a]) goPage(a); break;
    case 'skipWp': if (!st.task) toast('No task loaded'); else if (st.nextWp >= st.task.pts.length - 1) toast('The next point is the goal'); else goWp(st.nextWp + 1); break;
    case 'fai': S.fai = !S.fai; save(); renderWidgets(); toast(S.fai ? 'FAI triangle on: the map shows where the 3rd point must be' : 'FAI triangle off'); break;
  }
}
// height widgets: switch m ↔ ft (a title like "AMSL [m]" follows along)
function switchUnits(W) { const D = cfgW(W), cur = effCfg(W).units || (S.uAlt === 'ft' ? 'ft' : 'm'), nx = cur === 'ft' ? 'm' : 'ft'; D.units = nx;
  if (W.cfg.label) W.cfg.label = W.cfg.label.replace(/\[(m|ft)\]/, '[' + nx + ']').replace(/\((m|ft)\)/, '(' + nx + ')'); saveLayout(); toast(nx === 'ft' ? 'Height in feet' : 'Height in meters'); }
function handleTap(W) {
  if (W.type === 'button') return runAction(effCfg(W).action);
  const a = effCfg(W).tap || defTap(W);
  if (a === 'none') return;
  if (a === 'time') return showTime();
  if (a === 'fullscreen') return toggleFull();
  if (a === 'fai') return runAction('fai');
  if (a === 'heights') return openHeights();
  if (a === 'chip') return chipTap();
  if (a === 'xcmode') { if (W.type !== 'fai') return openDetails(W); const D = cfgW(W), i = XC_MODES.findIndex((x) => x[0] === (effCfg(W).mode || 'auto')); D.mode = XC_MODES[(i + 1) % XC_MODES.length][0]; saveLayout(); toast('XC: ' + XC_MODES.find((x) => x[0] === D.mode)[1]); return; }
  if (a === 'thoff') { if (st.thermMode) leaveThermal(); return; }
  if (a === 'airlist') return openInfo('Airspace near you', () => airListHTML(W), W);
  if (a === 'radiopoi') { const p = radioRef(effCfg(W).ref); if (p) openPoiInfo(p, 'me'); else toast('No place nearby yet'); return; }
  if (a === 'custom') return openInfo(effCfg(W).label || 'Info', () => infoHTML(W));
  // height widgets: switch m ↔ ft (a title like "AMSL [m]" follows along)
  if (a === 'units') { if (!['alt', 'agl', 'tow', 'gain'].includes(W.type)) return openDetails(W); return switchUnits(W); }
  if (a === 'vmode') { if (W.type !== 'vario') return; const o = ['number', 'bar', 'dial'], D = cfgW(W); D.mode = o[(o.indexOf(effCfg(W).mode || 'number') + 1) % 3]; saveLayout(); return; }
  if (a === 'times') return openInfo('Time', timesHTML);
  if (a === 'coordinfo') return openInfo('My position', coordInfoHTML);
  if (a === 'logbook') return openSettings('flights');
  if (a === 'mc') return mcStep();
  if (a === 'greset') return gReset();
  if (a === 'rblist') return openInfo('Route book' + (RB.cur ? ' · ' + RB.cur.name : ''), rbListHTML);
  if (a === 'stations') return openInfo('Weather stations', () => stationsHTML(W), W);
  if (a === 'scoreinfo') { scoreLive(); return openInfo('XC score', () => scoreHTML(st.score)); }
  if (a === 'share') return sharePos();
  if (a === 'retrieve') return openRetrieve();
  if (a === 'checklist') return openChecklist();
  if (a === 'dayinfo') return openInfo('Thermal day', dayHTML);
  if (a === 'landlist') return openInfo('Landing fields', landListHTML);
  if (a === 'conninfo') return openInfo('Connection & battery', connInfoHTML, W);
  if (a === 'tcycle') { if (W.type !== 'tclock') return openDetails(W); const o = ['local', 'utc', 'flight'], D = cfgW(W); D.show = o[(o.indexOf(effCfg(W).show || 'local') + 1) % 3]; saveLayout(); renderWidgets(); return; }
  if (a === 'sound') { applySet('sound', String(!S.sound)); toast('Vario sound ' + (S.sound ? 'on' : 'off')); return; }
  if (a[0] === 'p') return showPage(a);
  openDetails(W);
}
const GROUP = { vario: 'vario', avg: 'vario', varioDial: 'vario', thermal: 'vario', gain: 'vario', ttime: 'vario', climb: 'vario', ta: 'vario',
  alt: 'alt', agl: 'alt', cloud: 'alt', gs: 'spd', trk: 'spd', hdg: 'spd', ld: 'glide', glide: 'glide', reqld: 'task', next: 'task', fai: 'task', dist: 'task',
  wind: 'wind', flight: 'flight', place: 'place', air: 'air', airbtn: 'air', radiomsg: 'air', airwarn: 'air', thchip: 'vario', time: 'flight', tclock: 'flight', conn: 'flight', rec: 'flight', radar: 'flight', land: 'glide', sgate: 'task', tdist: 'task', stf: 'glide', fglide: 'task', tday: 'alt', cbfly: 'alt', gmeter: 'flight', sun: 'flight', coord: 'flight', xcscore: 'task', rbnext: 'task', wstation: 'wind', temp: 'alt', baro: 'alt', battery: 'flight', tside: 'vario', tcross: 'vario', thead: 'vario', t3d: 'vario', tlayer: 'vario', theat: 'vario', turn: 'vario', button: 'flight', core: 'vario', compass: 'spd', windDir: 'wind', profile: 'alt', groundT: 'alt', cbase: 'alt', ttop: 'alt', outlook: 'alt', trigger: 'alt', asside: 'air', asmap: 'air', aslist: 'air', places: 'place', radio: 'air', notams: 'air' };
function closeDetails() { clearInterval(detT); detT = null; detState = null; $('dlg').style.display = 'none'; }
// XC flight widget: all three ways to score the flight at once, the FAI sectors switch and the mode
function xcInfoHTML(W, held) {
  const c = effCfg(W), z = xcCalc(c.mode), km = (m) => (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km', U = S.uSpd;
  const ctl = held ? '' : `<div class="row" style="flex-wrap:wrap;margin-top:10px"><button class="btn ${S.fai ? 'primary' : ''}" data-xc="fai" style="min-height:56px">FAI sectors on the map: ${S.fai ? 'ON' : 'OFF'}</button></div>
    <div class="lbl" style="margin-top:8px">Widget shows</div><div class="row" style="flex-wrap:wrap">${XC_MODES.map(([k, n]) => `<button class="pill" data-xcm="${k}" aria-pressed="${(c.mode || 'auto') === k}">${n}</button>`).join('')}</div>`;
  if (!z || !z.ready) return `<div class="muted" style="font-size:16px">${!st.fix ? 'Waiting for GPS…' : 'Fly away from the start: values appear after 0.5 km.'}</div>` + ctl;
  const sec = (k, title, boxes, note) => `<div class="lbl" style="margin-top:8px">${title}${z.mode === k ? ' · <b style="color:var(--sink)">' + (z.auto ? 'auto picks this now' : 'shown on the widget') + '</b>' : ''}</div><div class="wgrid" style="grid-template-columns:repeat(4,minmax(0,1fr))">${boxes}</div>${note ? `<div class="muted">${note}</div>` : ''}`;
  const tot = 2 * z.c, done = z.c + Math.max(0, z.c - z.b), avg = z.dur > 300 ? fSpd(z.c / z.dur) + ' ' + U : '--';
  return sec('line', 'Straight line', statBox('From start', km(z.b)) + statBox('Farthest', km(z.c)) + statBox('Away speed', z.away != null ? (z.away >= 0 ? '+' : '') + fSpd(z.away) + ' ' + U : '--', 'last minute') + statBox('XC average', avg, 'farthest / flight time'), `heading ${pad3(z.brgOut)}° ${compass(z.brgOut)} from the start`)
    + sec('oar', 'Out & return', statBox('Turnpoint', km(z.c), 'your farthest point') + statBox('Back to start', km(z.b), pad3(z.toStart) + '° ' + compass(z.toStart)) + statBox('Total', km(tot), 'when home') + statBox('Done', Math.round(100 * done / tot) + ' %'))
    + sec('tri', 'Triangle', statBox('Triangle', km(z.P), 'start → TP → you → start') + statBox('Shortest leg', Math.round(z.mn * 100) + ' %', 'FAI needs ≥ 28 %') + statBox(z.ok ? 'FAI' : 'To FAI sector', z.ok ? '✓' : km(z.toSec)) + statBox('Back to start', km(z.b)))
    + ctl;
}
function openXcInfo(W) {
  openInfo('XC flight', () => xcInfoHTML(W), W);
  $('hBody').onclick = (e) => { const b = e.target.closest('[data-xc],[data-xcm]'); if (!b) return; if (b.dataset.xc) runAction('fai'); else { cfgW(W).mode = b.dataset.xcm; saveLayout(); } $('hBody').innerHTML = xcInfoHTML(W); };
}
function openDetails(W, range) {
  if (W.type === 'fai') return openXcInfo(W);
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
    stats = statBox('Now', fAlt(altNow()), S.uAlt) + statBox('AGL', st.groundElev != null && altNow() != null ? fAlt(altNow() - st.groundElev) : '--', S.uAlt) + statBox('Highest', al.length ? fAlt(Math.max(...al)) : '--', S.uAlt) + statBox('Lowest', al.length ? fAlt(Math.min(...al)) : '--', S.uAlt) + statBox('Total climbed', fAlt(climb), S.uAlt) + statBox('Cloud base', cb ? fAlt(cb) : '--', cb ? 'forecast' : 'load forecast') + statBox('Thermal top', thermalTop() ? fAlt(thermalTop()) : '--', 'forecast') + statBox('Temperature', st.baro?.temp != null ? st.baro.temp.toFixed(1) + ' °C' : '--', '');
  }
  if (g === 'spd') {
    const sp = lg.filter((p) => p.spd != null); chart = { pts: bucket(sp, 'spd', sp.length > 900 ? 10 : 3).map((p) => ({ t: p.t, y: p.y * spdK() })), o: { color: css('--ink') } };
    const v = sp.map((p) => p.spd); const f = st.fix;
    stats = statBox('Now', fSpd(f?.spd), S.uSpd) + statBox('Average', v.length ? fSpd(v.reduce((x, y) => x + y, 0) / v.length) : '--', S.uSpd) + statBox('Max', v.length ? fSpd(Math.max(...v)) : '--', S.uSpd) + statBox('Track', f?.trk != null ? pad3(f.trk) + '°' : '--', f?.trk != null ? compass(f.trk) : '') + statBox('Wind', windFromSpd() ? fSpd(windFromSpd().spd) : '--', windFromSpd() ? 'from ' + pad3(windFromSpd().from) + '°' : '') + statBox('Airspeed est.', st.lastTurn ? fSpd(st.lastTurn.tas) : '--', 'from last circle');
  }
  if (g === 'glide') {
    const gl = []; let prev = null; (st.thermals.length ? st.thermals : []).forEach((t) => { if (prev) { const s0 = st.log.find((p) => p.t >= prev.t1), s1 = [...st.log].reverse().find((p) => p.t <= t.t0); if (s0 && s1 && s0.lat != null && s1.lat != null && s0.alt - s1.alt > 20) gl.push({ t: s0.t, d: dist(s0.lat, s0.lon, s1.lat, s1.lon), h: s0.alt - s1.alt }); } prev = t; });
    const p = st.pred; const ld = (win) => { const v = avgVario(win, now), sp = avgSpd(win, now); return !st.circling && v != null && v < -0.2 && sp > 3 ? (sp / -v).toFixed(1) : '--'; };
    stats = statBox('L/D 20 s', ld(20), st.circling ? 'circling now' : '') + statBox('L/D 60 s', ld(60), '') + statBox('Wing L/D', S.wingLD, 'set in Units & glide') + statBox('Lands at L/D now', p.now ? fDist(p.now[2]) : '--', 'filled dot') + statBox('Lands at wing L/D', p.wing ? fDist(p.wing[2]) : '--', 'empty dot') + statBox('AGL', st.groundElev != null && altNow() != null ? fAlt(altNow() - st.groundElev) : '--', S.uAlt);
    extra = gl.length ? '<div class="lbl">Glides between thermals</div>' + gl.slice(-6).reverse().map((x) => { const d = new Date(x.t); return `<div class="li"><b class="num" style="font-size:20px;width:64px">${pad2(d.getHours())}:${pad2(d.getMinutes())}</b><span class="grow">${fDist(x.d)} for ${fAlt(x.h)} ${S.uAlt}</span><b class="num" style="font-size:22px">L/D ${(x.d / x.h).toFixed(1)}</b></div>`; }).join('') : '<div class="muted">Glides between thermals appear here after two thermals.</div>';
  }
  if (g === 'task') {
    const f = st.fix;
    if (!st.task) extra = '<div class="muted">No task loaded. Import a route from FlyXC, or plan one.</div><div class="row" style="margin-top:8px"><button class="btn primary" data-plopen="1" style="min-height:56px">🗺 Open the planner</button></div>';
    else { let rem = 0; extra = '<div class="lbl">' + esc(st.task.name) + ' · ' + (st.task.len / 1000).toFixed(1) + ' km</div>' + st.task.pts.map((w, i) => { const d = f ? dist(f.lat, f.lon, w.lat, w.lon) : null; if (i > st.nextWp && i > 0) rem += dist(st.task.pts[i - 1].lat, st.task.pts[i - 1].lon, w.lat, w.lon); const skipped = st.wpSkip && st.wpSkip.has(i) && i < st.nextWp; return `<div class="li"><b style="width:78px">${skipped ? '⤼ skip' : i < st.nextWp ? '✓' : i === st.nextWp ? (st.goalT ? '✓' : 'next') : ''}</b><span class="grow"><b>${esc(w.name)}</b></span><span>${d != null ? fDist(d) + ' · ' + pad3(brg(f.lat, f.lon, w.lat, w.lon)) + '°' : ''}</span>${i > 0 && i !== st.nextWp ? `<button class="btn" data-wpgo="${i}" style="margin-left:10px">Go to</button>` : ''}</div>`; }).join('');
      const n0 = st.task.pts.length; extra = `<div class="row" style="gap:8px"><button class="btn grow" data-plopen="1">🗺 Open in planner</button><button class="btn warn" data-taskdel="1">Remove task</button></div><div class="row" style="gap:8px"><button class="btn primary grow" data-wpgo="${st.nextWp + 1}" ${st.nextWp >= n0 - 1 ? 'disabled' : ''}>⏭ Skip ${esc(st.task.pts[st.nextWp]?.name || '')}</button><button class="btn grow" data-wpgo="${st.nextWp - 1}" ${st.nextWp <= 1 ? 'disabled' : ''}>⏮ Back one</button></div>` + extra;
      const wp = st.task.pts[st.nextWp]; const d = f && wp ? dist(f.lat, f.lon, wp.lat, wp.lon) : null;
      stats = statBox('Next', wp ? esc(wp.name) : '--', d != null ? fDist(d) : '') + statBox('Remaining', d != null ? fDist(d + rem) : '--', 'via all turnpoints') + statBox('Req. glide', d != null && st.groundElev != null && altNow() != null ? (d / Math.max(1, altNow() - st.groundElev - S.safety)).toFixed(1) : '--', 'to next') + statBox('ETA next', f?.spd > 2 && d != null ? etaStr(d / f.spd) : '--', 'at current speed'); }
  }
  if (g === 'wind') {
    const ws = st.winds.filter((x) => !range || x.t >= now - range * 1000); chart = ws.length > 1 ? { pts: ws.map((x) => ({ t: x.t, y: x.spd * spdK() })), o: { color: css('--sink') } } : null;
    const w = windFromSpd(), kmh = (v) => Math.round(v * 3.6), ms = (v) => v.toFixed(1); // wind in both km/h and m/s
    stats = statBox('Now', w ? `${kmh(w.spd)}<small style="font-size:.5em"> km/h</small>` : '--', w ? 'from ' + pad3(w.from) + '° ' + compass(w.from) : 'circle once') + statBox('Now', w ? `${ms(w.spd)}<small style="font-size:.5em"> m/s</small>` : '--', w ? (w.spd * 1.94384).toFixed(0) + ' kt' : '') + statBox('Measurements', ws.length, 'one per 30 s of circling');
    extra = ws.length ? '<div class="lbl">Wind by height</div>' + ws.slice().sort((a, b) => b.alt - a.alt).slice(0, 10).map((x) => `<div class="li"><b class="num" style="font-size:20px;width:80px">${fAlt(x.alt)} ${S.uAlt}</b><svg width="22" height="22" viewBox="0 0 14 14" aria-hidden="true"><g transform="rotate(${(x.from + 180) % 360} 7 7)"><path d="M7 1l4 8H3z" fill="currentColor"/><line x1="7" y1="8" x2="7" y2="13" stroke="currentColor" stroke-width="2"/></g></svg><span class="grow">from ${pad3(x.from)}° ${compass(x.from)}</span><b class="num" style="font-size:22px">${kmh(x.spd)} km/h</b><span class="num" style="font-size:18px;width:84px;text-align:right">${ms(x.spd)} m/s</span></div>`).join('') : '';
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
  $('fxOpen').onclick = () => window.open(flyxcUrl(), '_blank');
}
window.addEventListener('storage', (e) => {
  if (e.key !== 'bora.task') return;
  st.task = JSON.parse(e.newValue || 'null'); const done = taskResume(); drawTask();
  if (st.task) toast(`New route from FlyXC · ${st.task.pts.length} points · ${(st.task.len / 1000).toFixed(1)} km${resumeNote(done)}`, [['Show on map', () => showPage('pMap')]]);
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
  if (st.replay || st.sim) { st.takeoffPos = [f.lat, f.lon, altNow()]; if (st.replay) st.replay.launch = st.takeoffPos.slice(); toast('Start set for this replay'); }
  else { localStorage.setItem('bora.start', JSON.stringify({ lat: f.lat, lon: f.lon, t: Date.now(), manual: true })); toast('Start set at your position'); }
  renderPlaces(); drawMiniPlaces();
}

/* ================= update rate, thermal mode, export / import ================= */
let loopT = null;
function rateNow() { const r = st.thermMode && +S.rateT > 0 ? +S.rateT : +S.rate; return Math.max(typeof saverOn === 'function' && saverOn() ? 2 : 0, clamp(r || 0.4, 0.1, 5)); } // battery saver (18): at most every 2 s
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
  else if (st.circling) { st.gliSince = 0; st.cirSince = st.cirSince || t; want = !!st.thermMode || (t - st.cirSince >= (+S.modeEnter || 6) * 1000 && (!(S.modeClimbOn === true || S.modeClimbOn === 'true') || (avgVario((t - st.cirSince) / 1000, t) ?? -99) >= sN('modeClimb', 0.3))); }
  else { st.cirSince = 0; if (st.thermMode) { st.gliSince = st.gliSince || t; want = t - st.gliSince < (+S.modeHold || 20) * 1000; } else want = false; }
  if (want !== !!st.thermMode) setMode(want);
}
function setMode(on) {
  st.thermMode = on; if (!on) st.gliSince = 0;
  if (!wEdit && !st.force) {
    // entering: show the thermal page (from any widget page); leaving: if you are still on the thermal page, go back (S.thermBack: true = the page
    // you used before, a page id = that page, false = stay). Changing pages during the thermal no longer cancels this (it used to).
    if (on) st.preTh = PAGEKEY[curPage] && curPage !== S.thermPage ? curPage : st.lastWPage || 'pMap'; // where you were when the thermal started
    if (on && S.thermPage && S.thermPage !== 'off' && PAGEKEY[curPage] && curPage !== S.thermPage) { st.prevPage = curPage; st.autoSwitched = true; st.autoNav = true; showPage(S.thermPage); st.autoNav = false; }
    else if (!on && S.thermPage && S.thermPage !== 'off' && curPage === S.thermPage && S.thermBack !== false && S.thermBack !== 'false') {
      const tb = S.thermBack, to = tb === true || tb === 'true' || tb == null ? st.preTh || st.lastWPage || 'pMap' : tb;
      if (PAGEKEY[to] && to !== curPage) { st.autoNav = true; showPage(to); st.autoNav = false; } st.autoSwitched = false; }
  }
  if (!on && !(st.autoSwitched && curPage === S.thermPage)) st.autoSwitched = false;
  st.modeSince = nowT();
  renderTop(); renderWidgets(); clearTimeout(loopT); loopT = setTimeout(loop, rateNow() * 1000);
  fireEvent(on ? 'thermalStart' : 'thermalStop');
}
const NO_EXPORT = new Set(['openaipKey', 'notamProxy', 'layouts', 'layout', 'layoutGrid', 'widgets', 'hidden', 'mapMigrated']);
const IMPORT_OK = new Set(['titles', 'radioLang', 'radioTpl', 'callsign', 'radioAlt', 'airMaxAlt', 'warnBar', 'warnDist', 'uVario', 'uAlt', 'uSpd', 'avgS', 'wingLD', 'rotDefault', 'taOrient', 'layer', 'poiRadius', 'poiKinds', 'cylR', 'safety', 'theme', 'navMode', 'trig', 'flykUrl', 'notamRadius', 'sound', 'volume', 'wake', 'autoImport', 'customUrl', 'webPages', 'webCur', 'qnh', 'rate', 'rateT', 'cornerPos', 'cornerXY', 'ctlSmall', 'baroTau', 'baroNoise', 'wGap', 'wPadX', 'wPadY', 'wLab', 'wRad', 'modeAuto', 'modeEnter', 'modeHold', 'modeClimbOn', 'modeClimb', 'toSpd', 'toTime', 'cirRate', 'cirWin', 'cirSpd', 'thRec', 'thJoin', 'windAvg', 'towWin', 'towRelV', 'towRelT', 'xcOut', 'xcBack', 'xcTri', 'thermPage', 'thermBack', 'modeChip', 'autoRules', 'volPct', 'vLift', 'vSinkOn', 'vSink', 'vF0', 'vFk', 'vRate', 'vWave', 'vBuzz', 'vDamp', 'voice', 'voiceVol', 'voiceRate', 'voiceLang', 'vcTherm', 'vcSum', 'vcTp', 'vcAir', 'vcAlt', 'vcTow', 'towDetect', 'towMin', 'corner']);
function downloadJSON(obj, name) { const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function buildExport(scope) {
  const o = { app: 'bora-flight', version: 1, exported: new Date().toISOString(), layoutGrid: GSC, layouts: JSON.parse(JSON.stringify(S.layouts)), pages: S.pages.map((p) => ({ id: p.id, name: p.name })), routes: plRoutes() };
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
  const pg = (Array.isArray(o.pages) ? o.pages : o.settings && Array.isArray(o.settings.pages) ? o.settings.pages : []).filter((p) => p && isUserPage(p.id) && typeof p.name === 'string').slice(0, 20).map((p) => ({ id: p.id, name: p.name.slice(0, 24) }));
  [...new Set(Object.keys(LAYERID).concat(pg.map((p) => p.id)))].forEach((pk) => { const a = o.layouts && o.layouts[pk]; if (Array.isArray(a)) { lay[pk] = a.map(cleanW(k)).filter(Boolean); nW += lay[pk].length; } });
  const sets = {}; if (o.settings && typeof o.settings === 'object') Object.keys(o.settings).forEach((key) => { const v = o.settings[key]; if (!IMPORT_OK.has(key)) return; if (key === 'autoRules') { sets[key] = cleanRules(v); return; } const d = DEF[key]; if (d !== undefined && typeof d !== typeof v) return; if (v !== null && typeof v === 'object' && key !== 'poiKinds') return; sets[key] = key === 'poiKinds' ? cleanCfg(v) : v; });
  const routes = (Array.isArray(o.routes) ? o.routes : []).filter((r) => r && typeof r.name === 'string' && Array.isArray(r.pts) && r.pts.length > 1 && r.pts.every((q) => Array.isArray(q) && isFinite(q[0]) && isFinite(q[1]))).slice(0, 60).map((r) => ({ id: String(r.id || 'r' + Math.random().toString(36).slice(2, 8)), name: r.name.slice(0, 40), pts: r.pts.map((q) => [+q[0], +q[1]]), kind: String(r.kind || 'open'), len: +r.len || 0, t: +r.t || Date.now() }));
  return { lay, sets, pg, routes, nW, pages: Object.keys(lay).length, nSets: Object.keys(sets).length, date: o.exported };
}
function applyImport(P) {
  const backup = { layouts: JSON.parse(JSON.stringify(S.layouts)), settings: {}, pages: S.pages.map((p) => ({ ...p })) }; Object.keys(P.sets).forEach((k) => (backup.settings[k] = S[k]));
  const oldRoutes = plRoutes(); if (P.routes && P.routes.length) { const have = new Set(oldRoutes.map((r) => r.id)); plRoutesSave(oldRoutes.concat(P.routes.filter((r) => !have.has(r.id))).slice(0, 60)); } // saved routes from the file are added
  if (P.pg.length) pagesSet(S.pages.filter((p) => !P.pg.some((q) => q.id === p.id)).concat(P.pg)); // pages from the file are added (same id: renamed)
  const apply = (lay, sets) => { Object.assign(S.layouts, lay); Object.assign(S, sets); S.mapMigrated = true; save(); document.body.classList.toggle('dark', S.theme === 'dark'); document.body.classList.toggle('pinned', S.navMode === 'pinned'); drawTask(); loop(); renderWidgets(); if (curPage === 'pSet') renderSettings(); };
  apply(P.lay, P.sets);
  toast(`Imported ${P.nW} widgets on ${P.pages} pages${P.nSets ? ' and ' + P.nSets + ' settings' : ''}`, [['Undo', () => { pagesSet(backup.pages); plRoutesSave(oldRoutes); apply(backup.layouts, backup.settings); toast('Import undone'); }]]);
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
const AUTO_EVENTS = [['thermalStart', 'Started thermalling'], ['thermalStop', 'Stopped thermalling'], ['takeoff', 'Takeoff'], ['turnpoint', 'Turnpoint reached'], ['towStart', 'Tow started'], ['towEnd', 'Released from tow']];
const RULE_ACTS = ['pThermal', 'pMap', 'pAtmos', 'pAir', 'prev', 'center', 'soundOn', 'soundOff', 'time', 'start', 'message', 'say'];
// own pages in every page list: tabs/menu (PG_ALL), tap and hold "Go to page", button actions (BTN), automatic actions
const PG_BASE = PG_ALL.slice(), RULE_BASE = RULE_ACTS.slice();
function pagesLists() {
  const U = S.pages.map((p) => [p.id, p.name]);
  [TAPG, HOLDG].forEach((G) => { const g = G.find((x) => x[0] === 'Go to page'); if (g) g[1] = g[1].filter((x) => !isUserPage(x[0])).concat(U); });
  TAP.length = 0; TAP.push(...TAPG.flatMap(([, l]) => l)); HOLD.length = 0; HOLD.push(...HOLDG.flatMap(([, l]) => l));
  Object.keys(BTN).filter(isUserPage).forEach((k) => delete BTN[k]); S.pages.forEach((p) => (BTN[p.id] = ['Show ' + p.name + ' page', p.name.toUpperCase()]));
  const ao = WT.button.o.find((o) => o[0] === 'action')[2]; ao.length = 0; ao.push(...Object.entries(BTN).map(([k, v]) => [k, v[0]]));
  PG_ALL.length = 0; PG_ALL.push(...PG_BASE.slice(0, 4), ...U, ...PG_BASE.slice(4));
  RULE_ACTS.length = 0; RULE_ACTS.push(...RULE_BASE.slice(0, 4), ...U.map(([id]) => id), ...RULE_BASE.slice(4));
}
function pageAdd(name, from) {
  const P = { id: 'pU' + Math.random().toString(36).slice(2, 8), name: String(name || '').trim().slice(0, 24) || 'Page ' + (S.pages.length + 1) };
  const src = from && S.layouts[from]; S.layouts[P.id] = src ? JSON.parse(JSON.stringify(src)).map((W) => Object.assign(W, { id: newW(W.type).id })) : [];
  S.pages.push(P); pageMount(P); pagesLists(); save(); return P;
}
function pagesSet(list) { S.pages.forEach((p) => { if (!list.some((q) => q.id === p.id)) pageUnmount(p.id); }); S.pages = list; list.forEach(pageMount); pagesOrder(); pagesLists(); save(); }
function pageRename(id, name) { const P = S.pages.find((p) => p.id === id); if (!P) return; P.name = String(name || '').trim().slice(0, 24) || P.name; pageMount(P); pagesLists(); save(); }
function pageMove(id, d) { const i = S.pages.findIndex((p) => p.id === id), j = i + d; if (i < 0 || j < 0 || j >= S.pages.length) return; [S.pages[i], S.pages[j]] = [S.pages[j], S.pages[i]]; pagesOrder(); pagesLists(); save(); }
function pageDelete(id) {
  const i = S.pages.findIndex((p) => p.id === id); if (i < 0) return; const P = S.pages[i], lay = S.layouts[id];
  if (curPage === id) showPage('pMap'); S.pages.splice(i, 1); delete S.layouts[id]; pageUnmount(id); pagesLists(); save();
  toast(`Page “${P.name}” deleted`, [['Undo', () => { S.pages.splice(i, 0, P); S.layouts[id] = lay; pageMount(P); pagesOrder(); pagesLists(); save(); if (curPage === 'pSet') renderSettings(); }]]);
}
const ruleActLabel = (a) => (a === 'message' ? 'Show a message' : a === 'say' ? 'Say a message (voice)' : (BTN[a] || [a])[0]);
const evLabel = (e) => (AUTO_EVENTS.find((x) => x[0] === e) || [e, e])[1];
st.autoQ = [];
function ruleSummary(r) { return `When ${evLabel(r.event).toLowerCase()}${+r.delay > 0 ? ', after ' + r.delay + ' s' : ''} → ${ruleActLabel(r.action).toLowerCase()}${(r.action === 'message' || r.action === 'say') && r.text ? ': “' + r.text + '”' : ''}`; }
function execRule(r) {
  const nav = /^p[A-Z]/.test(r.action) || r.action === 'prev';
  if (nav && (wEdit || !PAGEKEY[curPage])) return;                                                                          // never pull you out of Settings, Web or the widget editor
  const t = nowT(); st.autoLast = st.autoLast || {}; if (t - (st.autoLast[r.id] || -1e15) < 1000) return; st.autoLast[r.id] = t;   // never twice within a second
  runAction(r.action, r.text);
}
function scheduleAuto(sec) { setTimeout(runAutoPending, sec * 1000 / (st.replay ? st.replay.speed : 1) + 40); }
function fireEvent(ev) {
  if (st.force) return;
  voiceEvent(ev);                                                                                                     // the thermal-tab preview never triggers anything
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
    ${r.action === 'message' || r.action === 'say' ? `<div class="opt"><label class="lbl" for="arT${i}">${r.action === 'say' ? 'Words to say' : 'Message'}</label><input type="text" id="arT${i}" data-ari="${i}" data-artx="1" value="${esc(r.text || '')}" placeholder="Text to show" style="height:48px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--bg);width:100%"></div>` : ''}
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


document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-taskdel]'); if (!b) return; const old = st.task; closeDetails(); clearTask(); renderWidgets(); toast('Task removed', [['Undo', () => { st.task = old; taskResume(); localStorage.setItem('bora.task', JSON.stringify(old)); drawTask(); renderWidgets(); }]]); });
// task popup: open the task in the XC planner (replaces the planner draft; Undo there brings the draft back)
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-plopen]'); if (!b) return; closeDetails(); plOpenTask(); });
// turnpoint popup: Skip / Back one / Go to (re-renders the popup)
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-wpgo]'); if (!b || b.disabled) return; goWp(+b.dataset.wpgo); if (detState) openDetails(detState.W); });

/* ================= voice messages for events (Display & sound → Voice messages) ================= */
function voiceEvent(ev) {
  if (!S.voice) return; const T = vt();
  if (ev === 'thermalStart' && S.vcTherm) say(T.therm);
  if (ev === 'thermalStop' && S.vcSum !== false && st.thermal) { const th = st.thermal, a = altNow(), dur = (nowT() - th.t0) / 1000;
    if (a != null && th.alt0 != null && dur > 30) { const g = a - th.alt0, m = Math.floor(dur / 60), sec = Math.round(dur % 60); say(T.sum(sayV(g / dur), sayAlt(g), m ? `${m} min ${sec} s` : `${sec} s`)); } }
  if (ev === 'towEnd' && S.vcTow !== false) { const T = towNow(); if (T) { const d = Math.max(1, (T.t1 - T.t0) / 1000); say(T_tow(T.alt1 - T.alt0, d)); } }
  if (ev === 'turnpoint' && S.vcTp !== false && st.task) say(st.goalT ? T.goal : T.tp(st.wpHit ? st.wpHit.name : '', st.task.pts[st.nextWp] ? st.task.pts[st.nextWp].name : ''));
}
// airspace warnings (when the warning changes) and the altitude every few minutes
setInterval(() => {
  if (!S.voice) return; const T = vt();
  if (S.vcAir !== false) { const s = airStatus(), inn = s.find((x) => x.inside && x.vert === 'in'), near = !inn && s.find((x) => x.d < (+S.warnDist || 2000) && x.vert === 'in'), key = inn ? 'in:' + inn.a.name : near ? 'near:' + near.a.name : '';
    if (key && key !== st.airSaid) say(inn ? T.airIn(inn.a.name) : T.airNear(near.a.name, fDist(near.d).replace('km', 'kilometers').replace(' m', ' meters'))); st.airSaid = key; }
  const every = +S.vcAlt || 0, a = altNow();
  if (every > 0 && st.takeoffT && a != null && nowT() - (st.altSaidT || 0) >= every * 60000) { st.altSaidT = nowT(); say(T.alt(sayAlt(a), st.groundElev != null ? sayAlt(a - st.groundElev) : '')); }
}, 5000);
// spoken tow summary
const T_tow = (g, d) => { const L = { en: ['Released. Tow gain', 'average'], sv: ['Släppt. Bogsering vann', 'medel'], fi: ['Irrotettu. Hinauksen nousu', 'keskiarvo'] }[S.voiceLang] || ['Released. Tow gain', 'average']; return `${L[0]} ${sayAlt(g)}, ${L[1]} ${sayV(g / d)}`; };

/* ================= heights in m and ft: tap a height widget (popup that stays), hold it (shown while held) ================= */
function heightsHTML() {
  const a = altNow(), g = st.groundElev, agl = a != null && g != null ? a - g : null, ft = (m) => Math.round(m * 3.28084).toLocaleString('en').replace(/,/g, ' '), mm = (m) => Math.round(m).toLocaleString('en').replace(/,/g, ' ');
  const row = (k, m, sub) => `<div class="hRow"><span class="lbl">${k}</span><span class="hFt num">${m != null ? ft(m) : '--'}<small> ft</small></span><span class="hM num">${m != null ? mm(m) + ' m' : sub}</span></div>`;
  return row('AMSL', a, 'no altitude') + row('AGL', agl, 'needs terrain data');
}
// a popup that stays (tap) and refreshes every second
// Connection & battery widget popup (live, redrawn every second by openInfo): vario, GPS, tablet, internet
function connInfoHTML() {
  const row = (k, v, ok) => `<div class="li" style="min-height:40px;justify-content:space-between;gap:12px"><span class="muted">${k}</span><b style="text-align:right${ok === false ? ';color:var(--restr)' : ''}">${v}</b></div>`;
  const vb = st.bora && st.bora.batt, bs = typeof baroStats === 'function' ? baroStats() : {}, f = st.fix, gAge = f ? (nowT() - f.t) / 1000 : null;
  let h = '<h3 style="margin:6px 0 2px">Vario</h3>';
  if (st.bora) {
    h += row('Connected', esc(st.bora.name || 'Bora')) + row('Battery', vb ? (vb.pct != null ? vb.pct + ' %' : vb.v.toFixed(2) + ' V') : 'not reported yet', vb && vb.pct != null ? vb.pct >= 20 : undefined);
    h += row('Readings', bs.last ? bs.rate.toFixed(1) + ' per second' + (bs.age > 2 ? ' · last ' + bs.age.toFixed(0) + ' s ago' : '') : 'none yet', bs.last ? bs.age <= 2 : false);
    if (bs.last && bs.last.pa) h += row('Pressure', (bs.last.pa / 100).toFixed(2) + ' hPa · QNH ' + (+sN('qnh', 1013.25)).toFixed(1));
    if (st.baro && st.baro.temp != null) h += row('Temperature', st.baro.temp.toFixed(0) + ' °C');
    if (st.flarmAt) { const n = flarmList().length, ag = (Date.now() - st.flarmAt) / 1000; h += row('Traffic ($PFLAA)', n + ' aircraft' + (ag > 5 ? ' · last ' + ag.toFixed(0) + ' s ago' : '')); }
  } else h += row('Status', st.sim ? 'demo vario' : st.replay ? 'IGC replay (' + esc(st.replay.name || '') + ')' : 'not connected', st.sim || st.replay ? undefined : false) + `<div class="row" style="margin:6px 0"><button class="btn primary" onclick="connectBora()">Connect over Bluetooth</button></div>`;
  h += '<h3 style="margin:10px 0 2px">GPS</h3>' + row('Position', f ? (gAge < 4 ? 'fix' : 'last fix ' + gAge.toFixed(0) + ' s ago') + (f.acc ? ' · ±' + Math.round(f.acc) + ' m' : '') : 'waiting for position', f ? gAge < 4 : false);
  { const g = gpsRate(); h += row('Tablet GPS updates', g.hz ? g.hz.toFixed(1) + ' per second (' + g.dt.toFixed(1) + ' s apart)' : 'none in the last seconds'); }
  if (st.replay || st.sim) h += row('Real GPS', st.gpsPos ? '±' + Math.round(st.gpsPos.acc || 0) + ' m, ' + Math.round((Date.now() - st.gpsPos.t) / 1000) + ' s ago' : 'none');
  { const [tx, ok] = trafficStatus(); h += '<h3 style="margin:10px 0 2px">Air traffic</h3>' + row('Internet', tx, ok); if (st.trafficErrs && st.trafficErrs.length && !st.trafficErr) h += row('Skipped', esc(st.trafficErrs.join(' · '))); if (!st.bora && st.flarmAt) h += row('Traffic ($PFLAA)', flarmList().length + ' aircraft'); }
  h += '<h3 style="margin:10px 0 2px">Tablet</h3>' + row('Battery', st.deviceBat != null ? st.deviceBat + ' %' + (st.deviceChg ? ' · charging' : '') : 'not available', st.deviceBat == null || st.deviceBat >= 20 || st.deviceChg) + row('Internet', navigator.onLine ? 'online' : 'offline', navigator.onLine);
  return h + `<div class="row" style="margin-top:10px"><button class="btn" onclick="$('dlg').style.display='none';openSettings('data')">Vario & GPS settings</button></div>`;
}
function openInfo(title, fn, W) { // W: adds a Settings button that opens this widget's settings
  const draw = () => { const b = document.getElementById('hBody'); if (b) b.innerHTML = fn(); };
  const close = () => { $('dlg').style.display = 'none'; clearInterval(detT); detT = null; };
  $('dlgBody').innerHTML = `<div class="row" style="justify-content:space-between"><span class="num" style="font-size:26px">${esc(title)}</span><span class="row">${W ? '<button class="btn" id="infoSet">Settings</button>' : ''}<button class="btn primary" id="dlgClose">Close</button></span></div><div id="hBody" style="max-height:calc(100dvh - 160px);overflow-y:auto">${fn()}</div>`;
  $('dlg').style.display = 'flex'; $('dlgClose').onclick = close; if (W) $('infoSet').onclick = () => { close(); enterEdit(W.id); };
  clearInterval(detT); detT = setInterval(() => { if ($('dlg').style.display === 'none') { clearInterval(detT); detT = null; return; } draw(); }, 1000);
}
// airspaces near you (within the widget's radius, default 10 km) and their radio frequencies
function airListHTML(W) {
  const c = W ? effCfg(W) : {}, R = (+c.radius || 20) * 1000, all = airStatus(), near = all.filter((x) => x.d <= R && (c.band !== 'height' || x.vert !== 'above')), s = near.slice(0, clamp(+c.rows || 25, 3, 50));
  if (!st.airspaces.length) return '<div class="muted">No airspace data loaded · Settings → Airspace data</div>';
  if (!st.fix) return '<div class="muted">Waiting for a position</div>';
  const st2 = (x) => x.inside ? (x.vert === 'in' ? '<b style="color:var(--restr)">INSIDE</b>' : x.vert === 'below' ? `<b>${fAlt(x.lo - x.alt)} ${S.uAlt}</b> below floor` : 'above top') : `<b>${fDist(x.d)}</b> · ${x.vert === 'below' ? 'below floor' : x.vert === 'above' ? 'above top' : 'at your height'}`;
  const rows = s.map((x) => `<div class="li" style="min-height:52px"><span style="width:16px;height:16px;border-radius:4px;border:3px solid ${airColor(x.a)};flex-shrink:0"></span><span class="grow" style="min-width:0"><b>${esc(x.a.name)}</b> <span class="muted">${fmtLim(x.a.lo)} – ${fmtLim(x.a.hi)}</span>${x.a.freq && x.a.freq.length ? `<br><span class="num" style="font-size:15px">📻 ${x.a.freq.map((q) => esc(q.v)).join(' · ')}</span>` : ''}</span><span style="text-align:right;white-space:nowrap">${st2(x)}</span></div>`).join('');
  const fr = []; s.forEach((x) => (x.a.freq || []).forEach((q) => { if (!fr.find((y) => y.v === q.v)) fr.push({ v: q.v, n: q.n || x.a.name, on: x.inside && x.vert === 'in' }); }));
  const radio = fr.length ? `<div class="lbl" style="margin-top:10px">Radio</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px">${fr.slice(0, 12).map((q) => `<div class="freq ${q.on ? 'on' : ''}"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(q.n)}</div><div class="num" style="font-size:26px">${esc(q.v)}</div></div>`).join('')}</div>` : '<div class="muted" style="margin-top:10px">No radio frequencies in the airspace data nearby.</div>';
  return `<div class="muted">Within ${R / 1000} km · ${near.length} airspace${near.length === 1 ? '' : 's'}${near.length > s.length ? ', nearest ' + s.length + ' shown' : ''}${c.band === 'height' ? ' · at your height or above' : ''}</div>` + (rows || '<div class="muted">None nearby</div>') + (c.radio === false || c.radio === 'false' ? '' : radio);
}
/* a place tapped on the map: where you are relative to it (for radio calls) or where it is from you, and a ready radio message */
// radio message words per language (cfg.radioLang): directions, units, phrases; Finnish avoids inflecting the place name ("paikasta X")
const RADIO_TXT = {
  en: { km: 'kilometres', dir: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'], at: (km, d, n) => `${km} kilometres ${d} of ${n}`, over: (n) => `overhead ${n}`, ft: 'feet', m: 'metres', th: 'thermalling', dec: '.' },
  sv: { km: 'kilometer', dir: ['norr', 'nordost', 'öster', 'sydost', 'söder', 'sydväst', 'väster', 'nordväst'], at: (km, d, n) => `${km} kilometer ${d} om ${n}`, over: (n) => `över ${n}`, ft: 'fot', m: 'meter', th: 'i termik', dec: ',' },
  fi: { km: 'kilometriä', dir: ['pohjoiseen', 'koilliseen', 'itään', 'kaakkoon', 'etelään', 'lounaaseen', 'länteen', 'luoteeseen'], at: (km, d, n) => `paikasta ${n} ${km} kilometriä ${d}`, over: (n) => `${n} yllä`, ft: 'jalkaa', m: 'metriä', th: 'termiikissä', dec: ',' } };
const radioLang = () => { const l = S.radioLang || 'en'; return l === 'voice' ? (RADIO_TXT[S.voiceLang] ? S.voiceLang : (navigator.language || 'en').slice(0, 2)) : l; };
// the radio message: S.radioTpl with {callsign} {where} {dist} {km} {dir} {place} {alt} {ft} {m} {thermal}; empty = the default for the language
const RADIO_TPL = '{callsign}, {where}, {alt}{thermal}.';
function radioParts(p) {
  const T = RADIO_TXT[radioLang()] || RADIO_TXT.en, f = st.fix, a = altNow(); if (!f) return null;
  const d = dist(p.lat, p.lon, f.lat, f.lon), b = brg(p.lat, p.lon, f.lat, f.lon), km = (d < 3000 ? (Math.round(d / 100) / 10).toFixed(1) : String(Math.round(d / 1000))).replace('.', T.dec), dir = T.dir[Math.round(wrap360(b) / 45) % 8];
  const ft = a != null ? Math.round(a * 3.28084 / 100) * 100 + ' ' + T.ft : '', m = a != null ? Math.round(a / 10) * 10 + ' ' + T.m : '', alU = S.radioAlt || 'ft';
  return { callsign: S.callsign || 'Paraglider', where: d < 500 ? T.over(p.name) : T.at(km, dir, p.name), dist: km + ' ' + T.km, km, dir, place: p.name, ft, m, alt: alU === 'm' ? m : alU === 'both' ? ft + ', ' + m : ft, thermal: st.thermMode ? ', ' + T.th : '' };
}
// the place a radio call refers to (Radio message widget): nearest town or airport (or only airports / towns), or the Start
function radioRef(ref) {
  const f = st.fix; if (!f) return null; if (ref === 'start') return startPlace();
  const L0 = st.places.filter((p) => (ref === 'airport' ? p.kind === 'airport' : ref === 'town' ? p.kind === 'town' && p.rank >= 2 : p.kind === 'airport' || (p.kind === 'town' && p.rank >= 2)));
  let b = null, bd = Infinity; L0.forEach((p) => { const d = dist(f.lat, f.lon, p.lat, p.lon); if (d < bd) { bd = d; b = p; } }); return b || (ref ? null : startPlace());
}
// the frequency to use: the airspace you are inside, else the nearest one at your height, that has a frequency
function radioFreq() {
  const s = airStatus(), w = (x) => x.a.freq && x.a.freq.length, x = s.find((y) => w(y) && y.inside && y.vert === 'in') || s.find((y) => w(y) && y.vert !== 'above' && y.d < 30000) || s.find(w);
  return x ? { v: x.a.freq[0].v, n: x.a.freq[0].n || x.a.name, d: x.d, inside: x.inside && x.vert === 'in' } : null;
}
function radioCall(p) { const P = radioParts(p); if (!P) return ''; return (S.radioTpl || RADIO_TPL).replace(/\{(\w+)\}/g, (x, k) => (k in P ? P[k] : x)).replace(/,\s*,/g, ',').replace(/,\s*\./g, '.').replace(/\s+/g, ' ').trim(); }
function poiInfoHTML(p, rel) {
  const f = st.fix; if (!f) return '<div class="muted">Waiting for a position</div>';
  const d = dist(f.lat, f.lon, p.lat, p.lon), toP = brg(f.lat, f.lon, p.lat, p.lon), fromP = wrap360(toP + 180);
  const me = `You are <b>${fDist(d)} ${compass(fromP)}</b> of ${esc(p.name)}`, it = `${esc(p.name)} is <b>${fDist(d)} ${compass(toP)}</b> of you`;
  return `<div style="font-size:24px;line-height:1.3">${rel === 'poi' ? it : me}</div><div class="muted" style="font-size:15px;margin-top:4px">${rel === 'poi' ? me : it} · to it ${pad3(toP)}°${p.sub ? ' · ' + esc(p.sub) : ''}</div>
    <div class="lbl" style="margin-top:12px">Radio message</div><div class="card" style="font-size:20px;line-height:1.35;padding:12px 14px">${esc(radioCall(p))}</div>
    <div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn" data-poi="say" style="min-height:56px">🔊 Say it</button><button class="btn" data-poi="rel" style="min-height:56px">${rel === 'poi' ? 'Show me relative to it' : 'Show it relative to me'}</button></div>
    <div class="muted" style="margin-top:6px">Callsign, language and wording: Settings → Radio message.</div>`;
}
function openPoiInfo(p, rel) {
  let r = rel === 'poi' ? 'poi' : 'me';
  openInfo(p.name, () => poiInfoHTML(p, r));
  $('hBody').onclick = (e) => { const b = e.target.closest('[data-poi]'); if (!b) return; if (b.dataset.poi === 'say') say(radioCall(p), true, radioLang()); else r = r === 'poi' ? 'me' : 'poi'; $('hBody').innerHTML = poiInfoHTML(p, r); };
}
function openHeights() { openInfo('Height', heightsHTML); }
// custom info: the chosen values (any text widget's value, or heights in m and ft) and an optional note
const INFO_KEYS = () => [['heights', 'Heights m/ft']].concat(Object.keys(WT).filter((k) => !WT[k].canvas && !['button', 'map', 'next', 'fai'].includes(k)).map((k) => [k, WT[k].n]));
function infoHTML(W) {
  const c = effCfg(W), items = Array.isArray(c.infoItems) && c.infoItems.length ? c.infoItems : ['heights'];
  let h = c.infoText ? `<div class="infoTxt">${esc(c.infoText)}</div>` : '';
  items.forEach((k) => {
    if (k === 'heights') { h += heightsHTML(); return; } if (!WT[k]) return;
    let d; try { d = wData({ id: 'info', type: k, cfg: { size: 'auto' } }, { w: 400, h: 110 }); } catch (e) { return; }
    h += `<div class="hRow"><span class="lbl">${esc(d.l || WT[k].n)}</span>${d.html ? `<span style="grid-column:2/4">${d.html}</span>` : `<span class="hFt num">${esc(String(d.v ?? '--'))}<small> ${esc(d.u || '')}</small></span><span class="hM">${esc(d.s || '')}</span>`}</div>`;
  });
  return h;
}
const timeHTML = () => { const d = new Date(); return `<div class="hRow"><span class="lbl">Local</span><span class="hFt num">${pad2(d.getHours())}:${pad2(d.getMinutes())}</span><span class="hM"></span></div><div class="hRow"><span class="lbl">UTC</span><span class="hFt num">${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}</span><span class="hM"></span></div>`; };
// Time widget popup: local, UTC, takeoff (local and UTC) and flight time; follows the replay clock during a replay
const timesHTML = () => {
  const d = new Date(nowT()), hm = (x, u) => pad2(u ? x.getUTCHours() : x.getHours()) + ':' + pad2(u ? x.getUTCMinutes() : x.getMinutes()), hms = (x, u) => hm(x, u) + '<small>:' + pad2(u ? x.getUTCSeconds() : x.getSeconds()) + '</small>';
  const off = -d.getTimezoneOffset() / 60, to = st.takeoffT ? new Date(st.takeoffT) : null, ft = to ? Math.floor((nowT() - st.takeoffT) / 1000) : null;
  const row = (k, v, s) => `<div class="hRow"><span class="lbl">${k}</span><span class="hFt num">${v}</span><span class="hM">${s || ''}</span></div>`;
  return row('Local', hms(d), 'UTC' + (off >= 0 ? '+' : '') + off) + row('UTC', hms(d, true)) + row('Takeoff', to ? hm(to) : '--', to ? hm(to, true) + ' UTC' : 'not flying yet') + row('Flight time', ft != null ? Math.floor(ft / 3600) + ':' + pad2(Math.floor(ft / 60) % 60) + '<small>:' + pad2(ft % 60) + '</small>' : '--');
};
// "When held": info shown while held (returns how to hide it), or an action run once
function runHold(W, a) {
  if (a === 'none') return null;
  if (a === 'heights') { holdPop(true, heightsHTML); return 'pop'; }
  if (a === 'custom') { holdPop(true, () => infoHTML(W)); return 'pop'; }
  if (a === 'airlist') { holdPop(true, () => airListHTML(W)); return 'pop'; }
  if (a === 'radiopoi') { const p = radioRef(effCfg(W).ref); if (!p) return null; holdPop(true, () => poiInfoHTML(p, 'me')); return 'pop'; }
  if (a === 'time') { holdPop(true, timeHTML); return 'pop'; }
  if (a === 'times') { holdPop(true, timesHTML); return 'pop'; }
  if (a === 'coordinfo') { holdPop(true, coordInfoHTML); return 'pop'; }
  if (a === 'details') { if (W.type === 'button') return null; if (W.type === 'fai') { holdPop(true, () => '<b style="font-size:22px">XC flight</b>' + xcInfoHTML(W, true)); return 'pop'; } openDetails(W); return 'dlg'; }
  if (a === 'pages') { pageMenu(); return null; }
  if (a === 'chip') { chipTap(); return null; }
  if (a === 'thoff') { if (st.thermMode) leaveThermal(); return null; }
  if (a === 'edit') { enterEdit(W.id); return null; }
  if (a === 'units') { if (['alt', 'agl', 'tow', 'gain'].includes(W.type)) switchUnits(W); return null; }
  if (a === 'sound' || a === 'fullscreen' || a === 'fai' || /^p[A-Z]/.test(a)) { runAction(a === 'sound' ? 'sound' : a); return null; }
  return null;
}
function endHold(shown) { if (shown === 'pop') holdPop(false); if (shown === 'dlg') closeDetails(); }
let holdT = null;
function holdPop(on, fn) {
  fn = fn || heightsHTML;
  let p = document.getElementById('holdPop');
  if (!on) { if (p) p.style.display = 'none'; clearInterval(holdT); holdT = null; return; }
  if (!p) { p = document.createElement('div'); p.id = 'holdPop'; p.className = 'card'; document.body.appendChild(p); }
  p.innerHTML = fn(); p.style.display = 'flex'; clearInterval(holdT); holdT = setInterval(() => { p.innerHTML = fn(); }, 500);
}
pagesLists();
