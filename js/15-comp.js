'use strict';
/* ================= competition tasks =================
   A task becomes a competition task when st.task.comp is set: {sss: 'exit'|'enter', race: true (race to goal) | false (elapsed time), gates: [UTC minutes of
   the day], goal: 'cyl'|'line'}; every point may carry type 'takeoff'|'sss'|'tp'|'ess'|'goal' and its own radius r (m; else S.cylR).
   Progress (compProgress, from 02 analyse): the start counts when you cross the SSS cylinder edge in the set direction at or after the first gate
   (each later valid crossing restarts; race: start time = the last gate before the crossing; elapsed: the crossing itself); turnpoints and ESS when
   you are inside; goal cylinder inside, goal line = crossing the line through the goal at right angles to the last leg, within r to the side.
   Distances to go are along the optimised route (optRoute): the shortest line that touches each remaining cylinder.
   Import: XCTrack .xctsk files (version 1 JSON) and "XCTSK:" QR texts (version 2, compact). */
const wpR = (i) => { const p = st.task && st.task.pts[i]; return p && +p.r > 0 ? +p.r : S.cylR || 400; };
const compIdx = (type) => { const T = st.task; if (!T) return -1; return T.pts.findIndex((p) => p.type === type); };
function compKinds() { const T = st.task, n = T.pts.length; let sss = compIdx('sss'), ess = compIdx('ess'); if (sss < 0) sss = T.pts[0] && T.pts[0].type === 'takeoff' ? Math.min(1, n - 1) : 0; if (ess < 0) ess = n - 1; return { sss, ess, goal: n - 1 }; }
function gateTimes() { const C = st.task && st.task.comp; if (!C || !Array.isArray(C.gates) || !C.gates.length) return []; const d = new Date(nowT()), mid = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); return C.gates.map((m) => mid + m * 60000).sort((a, b) => a - b); }
function compReset() { st.comp = { started: null, startAt: null, essT: null, sssIn: null, lineSide: null }; }
function compProgress(f) {
  const T = st.task, C = T.comp, K = compKinds(), n = T.pts.length, now = nowT(); if (!st.comp) compReset(); const S0 = st.comp;
  // start: crossing the SSS edge in the set direction after the first gate
  const sp = T.pts[K.sss], inside = dist(f.lat, f.lon, sp.lat, sp.lon) < wpR(K.sss), G = gateTimes(), open = !G.length || now >= G[0];
  if (S0.sssIn != null && inside !== S0.sssIn && open && st.nextWp <= K.sss + 1 && !S0.essT) {
    const ok = C.sss === 'enter' ? inside : !inside;
    if (ok) { const gate = G.filter((g) => g <= now).pop(); S0.started = now; S0.startAt = C.race !== false && gate ? gate : now; st.nextWp = Math.min(n - 1, K.sss + 1); st.wpHit = { name: 'Start', t: now }; toast('Start · ' + (C.race !== false && gate ? 'gate ' + new Date(gate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'time running')); fireEvent('turnpoint'); }
  }
  S0.sssIn = inside;
  if (!S0.started && st.nextWp <= K.sss) { st.nextWp = K.sss; return; }
  const i = st.nextWp; if (i <= K.sss || st.goalT) return; const wp = T.pts[i];
  let hit = false;
  if (i === K.goal && C.goal === 'line' && n > 1) { // goal line: across the last leg, length 2r
    const pv = T.pts[i - 1], [x, y] = enu(wp.lat, wp.lon, f.lat, f.lon), [px, py] = enu(wp.lat, wp.lon, pv.lat, pv.lon), L0 = Math.hypot(px, py) || 1, along = -(x * px + y * py) / L0, side = Math.abs(x * py - y * px) / L0;
    const s = along >= 0 ? 1 : -1; if (S0.lineSide === -1 && s === 1 && side <= wpR(i)) hit = true; S0.lineSide = s;
  } else hit = dist(f.lat, f.lon, wp.lat, wp.lon) < wpR(i);
  if (!hit) return;
  st.wpHit = { name: wp.name, t: now };
  if (i === K.ess && !S0.essT) { S0.essT = now; toast('ESS · ' + fDur((now - (S0.startAt || now)) / 1000)); }
  if (i < n - 1) { st.nextWp++; toast((wp.name || 'Turnpoint') + ' reached · next ' + T.pts[st.nextWp].name); } else { st.goalT = now; if (!S0.essT) S0.essT = now; toast('Goal reached'); }
  fireEvent('turnpoint');
}
/* optimised route from position `from` [lat, lon] through the cylinders from index i to the goal: touch points (lat, lon) and the length.
   Each touch point is moved to the best place on its circle given its neighbours (20 rounds): where the straight line between them passes through the
   circle it stays on that line, else it goes to the circle point along the bisector of the directions to the neighbours. */
function optRoute(from, i0, exitSss) {
  const T = st.task; if (!T || i0 >= T.pts.length) return { pts: [], len: 0 };
  const o = from, C = T.pts.slice(i0).map((p, k) => { const [x, y] = enu(o[0], o[1], p.lat, p.lon); return { x, y, r: wpR(i0 + k), line: T.comp && T.comp.goal === 'line' && i0 + k === T.pts.length - 1 }; });
  const X = C.map((c) => ({ x: c.x, y: c.y })), P0 = { x: 0, y: 0 };
  for (let it = 0; it < 20; it++) for (let k = 0; k < C.length; k++) {
    const c = C[k], a = k ? X[k - 1] : P0, b = k < C.length - 1 ? X[k + 1] : null, ex = exitSss && k === 0;
    if (!b) { const dx = a.x - c.x, dy = a.y - c.y, d = Math.hypot(dx, dy) || 1; X[k] = d <= c.r ? { x: a.x, y: a.y } : { x: c.x + dx / d * c.r, y: c.y + dy / d * c.r }; continue; }
    if (!ex) { const sx = b.x - a.x, sy = b.y - a.y, ll = sx * sx + sy * sy || 1, t = clamp(((c.x - a.x) * sx + (c.y - a.y) * sy) / ll, 0, 1), qx = a.x + sx * t, qy = a.y + sy * t; if (Math.hypot(qx - c.x, qy - c.y) <= c.r) { X[k] = { x: qx, y: qy }; continue; } }
    const ua = Math.hypot(a.x - c.x, a.y - c.y) || 1, ub = Math.hypot(b.x - c.x, b.y - c.y) || 1; let vx = (a.x - c.x) / ua + (b.x - c.x) / ub, vy = (a.y - c.y) / ua + (b.y - c.y) / ub;
    if (ex) { vx = (b.x - c.x) / ub; vy = (b.y - c.y) / ub; } // exit start: leave the cylinder towards the next point
    const vl = Math.hypot(vx, vy); if (vl < 1e-6) { vx = (b.x - c.x) / ub; vy = (b.y - c.y) / ub; } else { vx /= vl; vy /= vl; }
    X[k] = { x: c.x + vx * c.r, y: c.y + vy * c.r };
  }
  let len = 0, pv = P0; X.forEach((p) => { len += Math.hypot(p.x - pv.x, p.y - pv.y); pv = p; });
  const k0 = Math.cos(o[0] * D2R) * 111320; return { pts: X.map((p) => [o[0] + p.y / 111320, o[1] + p.x / k0]), len };
}
// distances along the optimised route: still to fly (from you), whole speed section, and the task from takeoff
function compDist() {
  const T = st.task, f = st.fix; if (!T || !f) return null; const K = compKinds(), started = st.comp && st.comp.started, i = Math.max(st.nextWp, started ? K.sss + 1 : K.sss);
  const rem = st.goalT ? { len: 0, pts: [] } : optRoute([f.lat, f.lon], i, !started && T.comp && T.comp.sss !== 'enter' && i === K.sss);
  const ss = T.pts[K.sss], toEss = st.comp && st.comp.essT ? 0 : optRoute([f.lat, f.lon], i, !started && T.comp.sss !== 'enter' && i === K.sss).len - (K.ess < T.pts.length - 1 ? optRoute([T.pts[K.ess].lat, T.pts[K.ess].lon], K.ess + 1).len : 0);
  if (!T._opt) { const t0 = T.pts[0]; T._opt = optRoute([t0.lat, t0.lon], 1, T.comp && T.comp.sss !== 'enter' && K.sss === 1); }
  return { rem: rem.len, remPts: rem.pts, toEss: Math.max(0, toEss), whole: T._opt.len, ss, ssLen: ssLen() };
}
// length of the speed section along the optimised task route (SSS touch point to ESS touch point; route point k is task point k + 1)
function ssLen() { const T = st.task; if (!T || !T._opt) return 0; const K = compKinds(), P = T._opt.pts; let L0 = 0; for (let k = Math.max(1, K.sss); k < K.ess; k++) { const a = P[k - 1], b = P[k]; if (a && b) L0 += dist(a[0], a[1], b[0], b[1]); } return L0; }
/* Start gate widget */
function sgateWData(W) {
  const T = st.task; if (!T || !T.comp) return { l: 'Start gate', v: '--', s: 'no competition task · Settings → Task' };
  const now = nowT(), G = gateTimes(), S0 = st.comp || {}, f = st.fix, K = compKinds(), tm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const ms = (s) => { s = Math.max(0, Math.round(s)); return (s >= 3600 ? Math.floor(s / 3600) + ':' : '') + String(Math.floor(s / 60) % 60).padStart(s >= 3600 ? 2 : 1, '0') + ':' + String(s % 60).padStart(2, '0'); };
  if (S0.essT) { const dur = (S0.essT - S0.startAt) / 1000, D = compDist(); return { l: st.goalT ? '✓ Goal' : '✓ ESS', v: fDur(dur), s: D && dur > 0 && D.ssLen ? fSpd(D.ssLen / dur) + ' ' + S.uSpd + ' average · ' + fDist(D.ssLen) : '', bgc: '#1F8A4C', col: '#FFFFFF' }; }
  if (S0.started) { const dur = (now - S0.startAt) / 1000, D = compDist(), done = D ? Math.max(0, D.ssLen - D.toEss) : 0; return { l: 'Started ' + tm(S0.startAt) + (T.comp.race !== false ? ' (gate)' : ''), v: fDur(dur), s: D && dur > 60 ? fSpd(done / dur) + ' ' + S.uSpd + ' · ' + fDist(D.toEss) + ' to ESS' : 'in the speed section' }; }
  const next = G.find((g) => g > now), sp = T.pts[K.sss], d0 = f ? dist(f.lat, f.lon, sp.lat, sp.lon) : null, r = wpR(K.sss), edge = d0 == null ? null : T.comp.sss === 'enter' ? Math.max(0, d0 - r) : Math.max(0, r - d0);
  const where = edge == null ? '' : T.comp.sss === 'enter' ? fDist(edge) + ' to the start cylinder' : d0 > r ? 'outside the start cylinder: go back in' : fDist(edge) + ' to the edge';
  if (next) { const left = (next - now) / 1000, need = edge != null && left > 0 ? edge / left : null;
    return { l: 'Start opens ' + tm(next) + (G.length > 1 ? ' · gate ' + (G.indexOf(next) + 1) + '/' + G.length : ''), v: ms(left), s: where + (need != null && edge > 50 ? ' · needs ' + fSpd(need) + ' ' + S.uSpd : ''), ...(left < 60 ? { bgc: '#E07B00', col: '#FFFFFF' } : {}) }; }
  return { l: 'Start open' + (G.length ? ' since ' + tm(G[G.length - 1]) : ''), v: 'GO', s: where, bgc: '#1F8A4C', col: '#FFFFFF' };
}
function tdistWData(W) {
  const T = st.task; if (!T) return { l: 'Task to go', v: '--', s: 'no task' };
  if (!T.comp) { const f = st.fix; if (!f) return { l: 'Task to go', v: '--' }; const D = optRoute([f.lat, f.lon], st.nextWp); return { l: 'Task to go (optimised)', v: fDist(D.len).replace(/ ?km$/, ''), u: /km$/.test(fDist(D.len)) ? 'km' : 'm', s: (T.pts.length - st.nextWp) + ' points left' }; }
  const D = compDist(); if (!D) return { l: 'Task to go', v: '--' }; const v = fDist(D.rem);
  return { l: st.goalT ? '✓ Goal' : 'Task to go (optimised)', v: v.replace(/ ?(km|m)$/, ''), u: /km$/.test(v) ? 'km' : 'm', s: 'ESS ' + fDist(D.toEss) + ' · task ' + fDist(D.whole) };
}
/* map: optimised route (thin, dashed) and the goal line; called from 04 drawTaskInto */
function compDrawInto(g, C, T0) {
  const T = st.task; if (!T) return; const K = T.comp ? compKinds() : null;
  if (T.comp && T.comp.goal === 'line' && T.pts.length > 1) { const gp = T.pts[T.pts.length - 1], pv = T.pts[T.pts.length - 2], b = brg(pv.lat, pv.lon, gp.lat, gp.lon), r = wpR(T.pts.length - 1);
    L.polyline([dest(gp.lat, gp.lon, b - 90, r), dest(gp.lat, gp.lon, b + 90, r)], { color: '#111418', weight: 7, interactive: false }).addTo(g); L.polyline([dest(gp.lat, gp.lon, b - 90, r), dest(gp.lat, gp.lon, b + 90, r)], { color: T0.col, weight: 4, interactive: false }).addTo(g); }
  if (C.taskOpt !== false && C.taskOpt !== 'false' && T.pts.length > 1) { const t0 = T.pts[0], R = optRoute([t0.lat, t0.lon], 1, K && T.comp.sss !== 'enter' && K.sss === 1); L.polyline([[t0.lat, t0.lon]].concat(R.pts), { color: '#111418', weight: 2, dashArray: '2 6', opacity: 0.85, interactive: false }).addTo(g); }
  if (K) T.pts.forEach((p, i) => { const tag = i === K.sss ? 'SSS ' + (T.comp.sss === 'enter' ? 'in' : 'out') : i === K.ess && i !== T.pts.length - 1 ? 'ESS' : p.type === 'takeoff' ? 'TO' : ''; if (tag) L.marker(dest(p.lat, p.lon, 0, wpR(i)), { icon: L.divIcon({ className: '', html: `<span class="cpTag">${tag}</span>`, iconSize: [0, 0] }), interactive: false }).addTo(g); });
}

/* XCTrack task files */
function parseXctsk(txt) {
  txt = String(txt).trim(); if (/^XCTSK:/i.test(txt)) return parseXctsk2(JSON.parse(txt.slice(6)));
  const j = JSON.parse(txt); if (j.version === 2 || j.t) return parseXctsk2(j);
  const tps = (j.turnpoints || []).map((t) => ({ name: (t.waypoint && (t.waypoint.name || t.waypoint.description)) || 'TP', lat: +t.waypoint.lat, lon: +t.waypoint.lon, r: +t.radius || 400, type: t.type === 'TAKEOFF' ? 'takeoff' : t.type === 'SSS' ? 'sss' : t.type === 'ESS' ? 'ess' : 'tp' }));
  if (tps.length < 2) throw new Error('fewer than 2 turnpoints');
  tps[tps.length - 1].type = tps[tps.length - 1].type === 'ess' ? 'ess' : 'goal';
  const s = j.sss || {}, gates = (s.timeGates || []).map(utcMin).filter((x) => x != null);
  return { pts: tps, comp: { sss: String(s.direction || 'EXIT').toUpperCase() === 'ENTER' ? 'enter' : 'exit', race: String(s.type || 'RACE').toUpperCase() !== 'ELAPSED-TIME', gates, goal: j.goal && String(j.goal.type).toUpperCase() === 'LINE' ? 'line' : 'cyl' } };
}
// version 2 (QR): t = [{z: polyline of lon, lat, alt, radius; n: name; t: 2 SSS / 3 ESS}], s = {g: gates, d: 1 enter / 2 exit, t: 1 race / 2 elapsed}, g = {t: 1 line / 2 cylinder}
function parseXctsk2(j) {
  const dec = (s) => { const out = []; let i = 0; while (i < s.length) { let b, sh = 0, r = 0; do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32 && i <= s.length); out.push(r & 1 ? ~(r >> 1) : r >> 1); } return out; };
  const tps = (j.t || []).map((t, k) => { const v = dec(t.z || ''); return { name: t.n || 'TP' + k, lon: (v[0] || 0) / 1e5, lat: (v[1] || 0) / 1e5, r: v[3] || 400, type: t.t === 2 ? 'sss' : t.t === 3 ? 'ess' : 'tp' }; });
  if (tps.length < 2) throw new Error('fewer than 2 turnpoints');
  if (tps[0].type === 'tp') tps[0].type = 'takeoff'; if (tps[tps.length - 1].type === 'tp') tps[tps.length - 1].type = 'goal';
  const s = j.s || {}; return { pts: tps, comp: { sss: s.d === 1 ? 'enter' : 'exit', race: s.t !== 2, gates: (s.g || []).map(utcMin).filter((x) => x != null), goal: j.g && j.g.t === 1 ? 'line' : 'cyl' } };
}
function utcMin(s) { const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(s)); return m ? +m[1] * 60 + +m[2] : null; }
function setCompTask(X, name) {
  let len = 0; for (let i = 1; i < X.pts.length; i++) len += dist(X.pts[i - 1].lat, X.pts[i - 1].lon, X.pts[i].lat, X.pts[i].lon);
  const old = st.task; st.task = { name: name || 'Competition task', len, pts: X.pts, comp: X.comp }; compReset(); taskResume(); localStorage.setItem('bora.task', JSON.stringify(st.task)); drawTask(); renderWidgets();
  toast(`Competition task set · ${X.pts.length} points · ${fDist(len)}`, [['Show on map', () => showPage('pMap')], ['Undo', () => { st.task = old; compReset(); taskResume(); if (old) localStorage.setItem('bora.task', JSON.stringify(old)); else localStorage.removeItem('bora.task'); drawTask(); renderSettings(); }]]);
}
function taskSave() { if (!st.task) return; delete st.task._opt; localStorage.setItem('bora.task', JSON.stringify(st.task)); drawTask(); renderWidgets(); }
/* Settings → Task: competition card */
function compSecHTML() {
  const T = st.task, C = T && T.comp, loc = (m) => { const d = new Date(); d.setUTCHours(Math.floor(m / 60), m % 60, 0, 0); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  let h = `<div class="card sec"><h2>Competition task</h2><div class="muted">Start cylinder (SSS) with start gates, turnpoints with their own radius, end of speed section (ESS), goal cylinder or line, and distances along the optimised route. Load an XCTrack task file, paste the text of a task QR code (starts with XCTSK:), or turn the current task into a competition task and set it up here.</div>
    <div class="field"><label for="xctFile">XCTrack task file (.xctsk)</label><input type="file" id="xctFile" accept=".xctsk,.json,application/json,text/plain" style="min-height:48px"></div>
    <div class="field"><label for="xctTxt">Task QR text</label><input type="text" id="xctTxt" placeholder="XCTSK:{…}" style="flex:1;min-width:180px"><button class="btn primary" id="xctImp">Load</button></div>`;
  if (!T) return h + '<div class="muted">No task set.</div></div>';
  if (!C) return h + `<div class="field"><span class="k">${esc(T.name)}</span><button class="btn" id="compOn">Make it a competition task</button></div></div>`;
  const G = C.gates || [], n = T.pts.length;
  h += `<div class="field"><span class="k">Start (SSS)</span><span class="row"><button class="pill" data-cmp="sss" data-v="exit" aria-pressed="${C.sss !== 'enter'}">Exit</button><button class="pill" data-cmp="sss" data-v="enter" aria-pressed="${C.sss === 'enter'}">Enter</button></span></div>
    <div class="field"><span class="k">Kind</span><span class="row"><button class="pill" data-cmp="race" data-v="1" aria-pressed="${C.race !== false}">Race to goal</button><button class="pill" data-cmp="race" data-v="0" aria-pressed="${C.race === false}">Elapsed time</button></span></div>
    <div class="field"><span class="k">Goal</span><span class="row"><button class="pill" data-cmp="goal" data-v="cyl" aria-pressed="${C.goal !== 'line'}">Cylinder</button><button class="pill" data-cmp="goal" data-v="line" aria-pressed="${C.goal === 'line'}">Line</button></span></div>
    <div class="field"><label for="gate0">First start gate (local time)</label><input type="time" id="gate0" value="${G.length ? (() => { const d = new Date(); d.setUTCHours(Math.floor(G[0] / 60), G[0] % 60, 0, 0); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); })() : ''}" style="min-height:48px"><span class="muted">${G.length ? G.length + ' gate' + (G.length > 1 ? 's' : '') + ': ' + G.map(loc).join(', ') : 'no gate: the start is open'}</span></div>
    ${numField('gateN')}${numField('gateGap')}
    <h2 style="margin-top:10px">Points</h2>
    ${T.pts.map((p, i) => `<div class="li" style="flex-wrap:wrap;gap:6px;min-height:52px"><b style="min-width:110px">${i + 1}. ${esc(p.name)}</b><span class="row" style="flex-wrap:wrap">${[['takeoff', 'Takeoff'], ['sss', 'SSS'], ['tp', 'TP'], ['ess', 'ESS'], ['goal', 'Goal']].map(([k, nm]) => `<button class="pill" data-cpt="${i}" data-v="${k}" aria-pressed="${(p.type || (i === 0 ? 'takeoff' : i === n - 1 ? 'goal' : 'tp')) === k}">${nm}</button>`).join('')}</span>
      <span class="row" style="margin-left:auto"><button class="btn" data-cpr="${i}" data-v="-1">−</button><b style="min-width:70px;text-align:center">${fDist(wpR(i))}</b><button class="btn" data-cpr="${i}" data-v="1">+</button></span></div>`).join('')}
    <div class="field"><span class="k"></span><button class="btn warn" id="compOff">Back to a plain route</button></div></div>`;
  return h;
}
function compWire(on) {
  on('xctFile', 'onchange', async (e) => { const fl = e.target.files[0]; if (!fl) return; try { setCompTask(parseXctsk(await fl.text()), fl.name.replace(/\.(xctsk|json)$/i, '')); renderSettings(); } catch (err) { toast('Could not read the task: ' + err.message); } e.target.value = ''; });
  on('xctImp', 'onclick', () => { try { setCompTask(parseXctsk($('xctTxt').value), 'QR task'); renderSettings(); } catch (err) { toast('Could not read the task: ' + err.message); } });
  on('compOn', 'onclick', () => { const T = st.task; T.pts.forEach((p, i) => { p.type = p.type || (i === 0 ? 'takeoff' : i === 1 && T.pts.length > 2 ? 'sss' : i === T.pts.length - 1 ? 'goal' : 'tp'); }); T.comp = { sss: 'exit', race: true, gates: [], goal: 'cyl' }; compReset(); taskResume(); taskSave(); renderSettings(); });
  on('compOff', 'onclick', () => { const T = st.task, old = JSON.parse(JSON.stringify(T)); delete T.comp; T.pts.forEach((p) => delete p.type); taskResume(); taskSave(); renderSettings(); toast('Plain route again', [['Undo', () => { st.task = old; compReset(); taskResume(); taskSave(); renderSettings(); }]]); });
  on('gate0', 'onchange', (e) => { compRegates(e.target.value); renderSettings(); });
  document.querySelectorAll('[data-cmp]').forEach((b) => (b.onclick = () => { const C = st.task.comp, k = b.dataset.cmp, v = b.dataset.v; C[k] = k === 'race' ? v === '1' : v; compReset(); taskSave(); renderSettings(); }));
  document.querySelectorAll('[data-cpt]').forEach((b) => (b.onclick = () => { const T = st.task, i = +b.dataset.cpt, v = b.dataset.v; if (v === 'sss' || v === 'ess') T.pts.forEach((p, k) => { if (k !== i && p.type === v) p.type = 'tp'; }); T.pts[i].type = v; compReset(); taskResume(); taskSave(); renderSettings(); }));
  document.querySelectorAll('[data-cpr]').forEach((b) => (b.onclick = () => { const p = st.task.pts[+b.dataset.cpr], r = wpR(+b.dataset.cpr), st0 = r >= 2000 ? 500 : r >= 1000 ? 250 : 100; p.r = clamp(Math.round((r + +b.dataset.v * st0) / 50) * 50, 50, 50000); taskSave(); renderSettings(); }));
}
// start gates from the first one (local time "HH:MM", or the first stored gate), S.gateN gates S.gateGap min apart (06 applySet calls this for those two)
function compRegates(v) {
  const T = st.task, C = T && T.comp; if (!C) return; let m0;
  if (v === '') { C.gates = []; taskSave(); return; }
  if (v) { const [hh, mm] = v.split(':').map(Number), d = new Date(); d.setHours(hh, mm, 0, 0); m0 = d.getUTCHours() * 60 + d.getUTCMinutes(); } else if (C.gates && C.gates.length) m0 = C.gates[0]; else return;
  const N = clamp(sN('gateN', 1), 1, 20), gap = clamp(sN('gateGap', 15), 1, 120); C.gates = Array.from({ length: N }, (_, k) => (m0 + k * gap) % 1440); taskSave();
}
compReset();
