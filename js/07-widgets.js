'use strict';
/* ================= XCTrack-style widget layout ================= */
const GSC = 4, GC = 24 * GSC, GR = 16 * GSC; // fine grid: quarter-size steps
const U_V = [['', 'App setting'], ['m/s', 'm/s'], ['kt', 'kt'], ['fpm', 'ft/min']], U_A = [['', 'App setting'], ['m', 'm'], ['ft', 'ft']], U_S = [['', 'App setting'], ['km/h', 'km/h'], ['kt', 'kt']];
const withU = (key, u, fn) => { if (!u) return fn(); const o = S[key]; S[key] = u; try { return fn(); } finally { S[key] = o; } };
const BTN = {
  thermalOn: ['Thermal mode on', 'THERMAL'], thermalOff: ['Thermal mode off', 'GLIDE'], thermalToggle: ['Toggle thermal mode', 'THERMAL'],
  pMap: ['Show Map page', 'MAP'], pThermal: ['Show Thermal page', 'THERMAL PAGE'], pAtmos: ['Show Atmosphere page', 'ATMOSPHERE'], pAir: ['Show Airspace page', 'AIRSPACE'], prev: ['Previous page', 'BACK'],
  center: ['Centre maps on me', 'CENTRE'], sound: ['Vario sound on/off', 'SOUND'], soundOn: ['Vario sound on', 'SOUND ON'], soundOff: ['Vario sound off', 'SOUND OFF'], time: ['Show local and UTC time', 'TIME'], start: ['Set Start here', 'SET START'], pSwitch: ['Switch Map / Thermal page', 'THERMAL'], fullscreen: ['Full screen on/off', 'FULL SCREEN']
};
const WT = {
  vario: { n: 'Vario', d: 'Climb rate, optionally averaged', w: 6, h: 3, o: [['win', 'Averaging', numOpt(0, 120, 1, 's', [0, 1, 3, 5, 10, 30], { zero: 'None', hint: '0 = no averaging', def: 0 })], ['units', 'Units', U_V]] },
  varioDial: { n: 'Vario dial', d: 'Needle gauge', w: 5, h: 5, canvas: true, o: [['range', 'Scale', [[5, '±5 m/s'], [10, '±10 m/s']]], ['win', 'Average marker', numOpt(0, 120, 1, 's', [0, 5, 10, 30, 60], { zero: 'Off', hint: '0 = off', def: 0 })]] },
  avg: { n: 'Vario average', d: 'Averaged climb', w: 3, h: 2, o: [['win', 'Average over', numOpt(1, 300, 1, 's', [5, 10, 30, 60, 120], { def: 30 })], ['units', 'Units', U_V]] },
  alt: { n: 'Altitude', d: 'Height above sea', w: 3, h: 2, o: [['src', 'Source', [['auto', 'Vario if connected'], ['gps', 'GPS']]], ['units', 'Units', U_A]] },
  agl: { n: 'Height above ground', d: 'From terrain data', w: 3, h: 2, o: [['units', 'Units', U_A]] },
  gs: { n: 'Ground speed', d: 'From GPS', w: 3, h: 2, o: [['units', 'Units', U_S]] },
  trk: { n: 'Track', d: 'Direction over ground', w: 3, h: 2, o: [] },
  ld: { n: 'Glide ratio', d: 'Measured on glide', w: 3, h: 2, o: [['win', 'Average over', numOpt(5, 300, 1, 's', [10, 20, 30, 60, 120], { def: 20 })]] },
  reqld: { n: 'Required glide', d: 'To next turnpoint', w: 3, h: 2, o: [] },
  wind: { n: 'Wind', d: 'Measured while circling', w: 3, h: 2, o: [['units', 'Units', U_S]] },
  next: { n: 'Next turnpoint', d: 'Distance, bearing, arrival', w: 6, h: 3, o: [['units', 'Height units', U_A]] },
  dist: { n: 'Distance to turnpoint', d: 'Next turnpoint only', w: 3, h: 2, o: [] },
  thermal: { n: 'Thermal average', d: 'Since entering the thermal', w: 3, h: 2, o: [['units', 'Units', U_V]] },
  gain: { n: 'Thermal gain', d: 'Height gained', w: 3, h: 2, o: [['units', 'Units', U_A]] },
  ttime: { n: 'Time in thermal', d: 'Minutes:seconds', w: 3, h: 2, o: [] },
  flight: { n: 'Flight time', d: 'Since takeoff', w: 3, h: 2, o: [] },
  time: { n: 'Clock', d: 'Local or UTC', w: 3, h: 2, o: [['zone', 'Time zone', [['local', 'Local'], ['utc', 'UTC']]], ['sec', 'Seconds', [[false, 'Hide'], [true, 'Show']]]] },
  temp: { n: 'Temperature', d: 'From the vario', w: 3, h: 2, o: [] },
  battery: { n: 'Battery', d: 'Vario and tablet', w: 3, h: 2, o: [] },
  glide: { n: 'Landing prediction', d: 'Filled and empty dot', w: 6, h: 2, o: [] },
  climb: { n: 'Climb history', d: 'Last 2 minutes', w: 6, h: 3, canvas: true, o: [] },
  cloud: { n: 'Cloud base & top', d: 'From the forecast', w: 4, h: 2, o: [['units', 'Units', U_A]] },
  place: { n: 'Nearest place', d: 'For radio calls', w: 6, h: 2, o: [['kind', 'Places', [['any', 'All'], ['start', 'Start only'], ['town', 'Towns'], ['airport', 'Airports']]]] },
  air: { n: 'Airspace status', d: 'Nearest airspace', w: 6, h: 2, o: [] },
  map: { n: 'Map', d: 'Moving map: track, task, airspace', w: 24, h: 16, canvas: true, def: { layer: S.layer || 'topo', rot: S.rotDefault || 'north', smooth: 'normal', z: 12, follow: true, ret: 0, track: 'plain', trackMin: 15, heading: true, start: true, task: true, air: true, notam: true, places: false, traffic: false, trafficR: 25, trafficA: 1500, gsize: 1, ctl: true, bg: 0, showLabel: false, tap: 'none' }, o: [['layer', 'Map style', [['topo', 'Topo'], ['sat', 'Satellite'], ['light', 'Airspace'], ['night', 'Night'], ['streets', 'Streets']]], ['rot', 'Orientation', [['north', 'North up'], ['track', 'Track up'], ['bearing', 'Bearing up']]], ['smooth', 'Rotation smoothing', [['off', 'Off'], ['low', 'Low'], ['normal', 'Normal'], ['strong', 'Strong']]], ['z', 'Zoom', [[10, 'Wide'], [12, 'Normal'], [13, 'Close'], [14, 'Near'], [15, 'Closer'], [16, 'Very close']]], ['follow', 'Follow me', [[true, 'On'], [false, 'Off']]], ['ret', 'Back to me after panning', numOpt(0, 600, 5, 's', [0, 10, 30, 60], { zero: 'Never', hint: '0 = never', def: 0 })], ['track', 'Track line', [['plain', 'Plain'], ['lift', 'Lift colours'], ['off', 'Hide']]], ['trackMin', 'Track length', numOpt(0, 600, 5, 'min', [5, 15, 60, 0], { zero: 'Whole flight', hint: '0 = whole flight', def: 15 })], ['heading', 'Heading line and landing dots', [[true, 'Show'], [false, 'Hide']]], ['start', 'Start flag', [[true, 'Show'], [false, 'Hide']]], ['task', 'Task', [[true, 'Show'], [false, 'Hide']]], ['air', 'Airspace', [[true, 'Show'], [false, 'Hide']]], ['notam', 'NOTAM areas', [[true, 'Show'], [false, 'Hide']]], ['places', 'Place names', [[false, 'Hide'], [true, 'Show']]], ['traffic', 'Air traffic (ADS-B)', [[false, 'Hide'], [true, 'Show']]], ['trafficR', 'Traffic range', numOpt(5, 100, 5, 'km', [], { def: 25 })], ['trafficA', 'Traffic height band ±', numOpt(0, 5000, 100, 'm', [], { zero: 'All heights', hint: '0 = all heights', def: 1500 })], ['gsize', 'Glider icon', [[0.8, 'Small'], [1, 'Normal'], [1.35, 'Large']]], ['ctl', 'On-map buttons', [[true, 'Show'], [false, 'Hide']]]] },
  button: { n: 'Button', d: 'Tap to switch mode, page and more', w: 4, h: 3, def: { action: 'thermalOn', color: 'orange', bg: 100, showLabel: false, tap: 'none' }, o: [['action', 'Action', Object.entries(BTN).map(([k, v]) => [k, v[0]])], ['color', 'Colour', [['orange', 'Orange'], ['blue', 'Blue'], ['dark', 'Dark'], ['plain', 'Plain']]]] },
  ta: { n: 'Thermal assistant', d: 'Heat map of lift around you', w: 10, h: 11, canvas: true, def: { orient: S.taOrient || 'wind', hist: 120, style: 'both', bgMap: false, trail: true, legend: true, zoom: 1, bg: 85 }, o: [['orient', 'Up is', [['wind', 'Wind'], ['north', 'North'], ['track', 'Track']]], ['hist', 'History', numOpt(10, 600, 10, 's', [30, 60, 120, 300], { def: 120, extra: [['thermal', 'This thermal'], ['circle', 'Last circle']] })], ['style', 'Colours', [['both', 'Heat + dots'], ['heat', 'Heat only'], ['dots', 'Dots only']]], ['bgMap', 'Map behind', [[false, 'Off'], [true, 'On']]], ['trail', 'Track line', [[true, 'Show'], [false, 'Hide']]], ['legend', 'Colour scale', [[true, 'Show'], [false, 'Hide']]], ['units', 'Wind units', U_S]] },
  tside: { n: 'Thermal side view', d: 'Your track and lift seen from the side: upwind ↔ downwind', w: 6, h: 11, canvas: true, def: { hist: 180 }, o: [['hist', 'History', numOpt(30, 600, 30, 's', [60, 120, 180, 300, 600], { def: 180 })]] },
  tcross: { n: 'Thermal front view', d: 'Your track and lift seen from downwind: left ↔ right', w: 6, h: 11, canvas: true, def: { hist: 180 }, o: [['hist', 'History', numOpt(30, 600, 30, 's', [60, 120, 180, 300, 600], { def: 180 })]] },
  turn: { n: 'Turn radius', d: 'Last circle, min to max', w: 6, h: 5, canvas: true, o: [] },
  core: { n: 'Centering', d: 'Distance and direction to the core', w: 8, h: 2, o: [] },
  compass: { n: 'Compass', d: 'Track, north, turnpoint, wind', w: 4, h: 4, canvas: true, o: [['mode', 'Up is', [['heading', 'Track'], ['north', 'North']]], ['tp', 'Turnpoint marker', [[true, 'Show'], [false, 'Hide']]], ['windm', 'Wind marker', [[true, 'Show'], [false, 'Hide']]]] },
  windDir: { n: 'Wind direction', d: 'Arrow, speed, head/tailwind', w: 4, h: 3, canvas: true, o: [['mode', 'Arrow relative to', [['heading', 'Track'], ['north', 'North']]], ['units', 'Units', U_S]] },
  profile: { n: 'Temperature profile', d: 'Measured, forecast and parcel', w: 11, h: 16, canvas: true, o: [['units', 'Height units', U_A]] },
  groundT: { n: 'Ground temp / dew point', d: 'Forecast, 2 m', w: 5, h: 3, o: [] },
  cbase: { n: 'Cloud base', d: 'From the forecast', w: 6, h: 4, o: [['units', 'Units', U_A]] },
  ttop: { n: 'Thermal top', d: 'Where the parcel stops', w: 6, h: 4, o: [['units', 'Units', U_A]] },
  outlook: { n: 'Outlook', d: 'Blue or cumulus day', w: 13, h: 5, o: [['units', 'Height units', U_A]] },
  trigger: { n: 'Parcel start', d: 'Trigger temperature excess', w: 13, h: 3, o: [] },
  asside: { n: 'Airspace side view', d: 'Along your track', w: 13, h: 5, canvas: true, def: { range: 20 }, o: [['range', 'Look ahead', [[10, '10 km'], [20, '20 km'], [40, '40 km']]]] },
  asmap: { n: 'Airspace map', d: 'North up, places and NOTAM', w: 13, h: 6, canvas: true, def: { map: 'light', radius: 0 }, o: [['map', 'Map', [['light', 'Light'], ['topo', 'Topo'], ['sat', 'Satellite'], ['night', 'Night']]], ['radius', 'Radius', [[0, 'Places radius'], [5, '5 km'], [10, '10 km'], [20, '20 km'], [40, '40 km']]]] },
  aslist: { n: 'Airspace list', d: 'Nearest airspaces', w: 13, h: 5, o: [] },
  places: { n: 'Places nearby', d: 'Towns, airports, Start', w: 11, h: 7, o: [] },
  radio: { n: 'Radio', d: 'Frequencies from airspace', w: 11, h: 4, o: [] },
  notams: { n: 'NOTAM', d: 'From ais.fi, tap to read', w: 11, h: 5, def: { radius: 50 }, o: [['radius', 'Within', [[25, '25 km'], [50, '50 km'], [100, '100 km']]]] }
};
const TAPG = [['Info', [['details', 'Details'], ['time', 'Both times']]], ['Go to page', [['pMap', 'Map'], ['pThermal', 'Thermal'], ['pAtmos', 'Atmosphere'], ['pAir', 'Airspace']]], ['Action', [['sound', 'Sound on/off'], ['fullscreen', 'Full screen']]], ['Nothing', [['none', 'Nothing']]]];
const TAP = TAPG.flatMap(([, l]) => l);
const VIS = [['always', 'Always'], ['thermal', 'Thermalling'], ['glide', 'Stopped thermalling']];
const COMMON = [['vis', 'Show when', VIS], ['visDelay', 'Delay before showing', numOpt(0, 300, 1, 's', [0, 3, 5, 10, 30], { zero: 'None', hint: '0 = immediately', def: 0 })], ['tap', 'When tapped', TAP], ['size', 'Text size', [['auto', 'Fit'], [0.7, 'S'], [0.85, 'M'], [1.15, 'L'], [1.35, 'XL']]], ['bg', 'Background', [[0, 'None'], [35, '35%'], [70, '70%'], [100, 'Solid']]], ['showLabel', 'Title', [[true, 'Show'], [false, 'Hide']]]];
const DEF_LAYOUT = [['vario', 18, 2, 6, 3], ['avg', 18, 5, 3, 2], ['alt', 21, 5, 3, 2], ['agl', 18, 7, 3, 2], ['gs', 21, 7, 3, 2], ['ld', 18, 9, 3, 2], ['wind', 21, 9, 3, 2], ['next', 18, 11, 6, 3], ['thermal', 18, 14, 3, 2], ['flight', 21, 14, 3, 2], ['glide', 0, 14, 6, 2]];
let wid = 1;
function newW(type, x, y, w, h) { return { id: 'w' + Date.now().toString(36) + (wid++), type, x, y, w: w ?? WT[type].w * GSC, h: h ?? WT[type].h * GSC, cfg: Object.assign({ size: 'auto', bg: 70, showLabel: true }, (WT[type] && WT[type].def) || {}) }; }
const DEFS = {
  map: [['map', 0, 0, 24, 16]].concat(DEF_LAYOUT, [['button', 6, 14, 4, 2, { action: 'pSwitch', color: 'orange' }]]),
  thermal: [['ta', 0, 0, 10, 11], ['tside', 10, 0, 6, 11], ['vario', 16, 0, 8, 3], ['avg', 16, 3, 4, 2], ['thermal', 20, 3, 4, 2], ['gain', 16, 5, 4, 2], ['ttime', 20, 5, 4, 2], ['wind', 16, 7, 4, 3], ['windDir', 20, 7, 4, 3], ['core', 16, 10, 8, 2], ['compass', 16, 12, 4, 4], ['alt', 20, 12, 4, 2], ['button', 20, 14, 4, 2, { action: 'pSwitch', color: 'orange' }], ['climb', 0, 11, 10, 5], ['turn', 10, 11, 6, 5]],
  atmos: [['profile', 0, 0, 11, 16], ['temp', 11, 0, 4, 3], ['groundT', 15, 0, 5, 3], ['alt', 20, 0, 4, 3], ['cbase', 11, 3, 6, 4], ['ttop', 17, 3, 7, 4], ['outlook', 11, 7, 13, 5], ['trigger', 11, 12, 13, 3]],
  air: [['asside', 0, 0, 13, 5], ['aslist', 0, 5, 13, 5], ['asmap', 0, 10, 13, 6], ['places', 13, 0, 11, 7], ['radio', 13, 7, 11, 4], ['notams', 13, 11, 11, 5]]
};
const PAGEKEY = { pMap: 'map', pThermal: 'thermal', pAtmos: 'atmos', pAir: 'air' };
const LAYERID = { map: 'wLayer', thermal: 'wLayer_thermal', atmos: 'wLayer_atmos', air: 'wLayer_air' };
const pageKey = () => PAGEKEY[curPage] || 'map';
const defLayout = (pk) => (DEFS[pk || pageKey()] || DEFS.map).map(([t, x, y, w, h, c]) => { const W = newW(t, x * GSC, y * GSC, w * GSC, h * GSC); if (c) Object.assign(W.cfg, c); return W; });
{
  const old = Array.isArray(S.layout) ? S.layout : null; delete S.layout;
  if (!S.layouts || typeof S.layouts !== 'object') S.layouts = {};
  if (old && !S.layouts.map) { const k = GSC / (S.layoutGrid || 1); S.layouts.map = old.map((W) => Object.assign({}, W, { x: Math.round(W.x * k), y: Math.round(W.y * k), w: Math.round(W.w * k), h: Math.round(W.h * k) })); }
  Object.keys(LAYERID).forEach((pk) => { if (!Array.isArray(S.layouts[pk]) || !S.layouts[pk].length) S.layouts[pk] = defLayout(pk); S.layouts[pk] = S.layouts[pk].filter((W) => WT[W.type]); });
  if (!S.mapMigrated) { if (!S.layouts.map.some((W) => W.type === 'map')) S.layouts.map.unshift(newW('map', 0, 0, GC, GR)); S.mapMigrated = true; }
  if (!S.navBtnMig) {
    S.navBtnMig = true;
    [['map', 4, 2], ['thermal', 4, 2]].forEach(([pk, w, h]) => { const L = S.layouts[pk]; if (L.some((W) => W.type === 'button' && ['pSwitch'].includes(W.cfg.action))) return; w *= GSC; h *= GSC;
      const hit = (x, y) => L.some((W) => W.type !== 'map' && x < W.x + W.w && x + w > W.x && y < W.y + W.h && y + h > W.y); let pos = null;
      for (let y = GR - h; y >= 0 && !pos; y -= GSC) for (let x = 0; x <= GC - w && !pos; x += GSC) if (!hit(x, y)) pos = [x, y];
      const B = newW('button', (pos || [0, GR - h])[0], (pos || [0, GR - h])[1], w, h); Object.assign(B.cfg, { action: 'pSwitch', color: 'orange' }); L.push(B); });
  }
  S.layoutGrid = GSC; save();
}
Object.defineProperty(S, 'layout', { enumerable: false, configurable: true, get() { return S.layouts[pageKey()]; }, set(v) { S.layouts[pageKey()] = v; } });
let wEdit = false, wSel = null;
function wData(W) {
  const c = W.cfg, f = st.fix, alt = altNow(), now = nowT(), u = c.units || '';
  const V = (ms) => withU('uVario', u, () => fVario(ms)), VU = () => withU('uVario', u, uV);
  const A = (m) => withU('uAlt', u, () => fAlt(m)), AU = u || S.uAlt;
  const Sp = (ms) => withU('uSpd', u, () => fSpd(ms)), SU = u || S.uSpd;
  const w = windFromSpd(), th = st.thermal;
  const wp = st.task && st.task.pts[st.nextWp];
  const dwp = f && wp ? dist(f.lat, f.lon, wp.lat, wp.lon) : null;
  switch (W.type) {
    case 'vario': { const win = +c.win || 0; const v = win ? avgVario(win, now) ?? st.vario : st.vario; return { l: 'Vario', u: VU() + (win ? ' · Ø ' + win + ' s' : ''), v: V(v), col: v >= 0 ? css('--climb') : css('--sink'), s: st.varioSrc === 'gps' ? 'from GPS' : '' }; }
    case 'avg': { const win = +c.win || S.avgS; const a = avgVario(win, now); return { l: 'Vario average', u: VU() + ' · Ø ' + fmtDur(win), v: V(a), col: a == null ? null : a >= 0 ? css('--climb') : css('--sink') }; }
    case 'alt': { const a = c.src === 'gps' ? f?.alt : alt; return { l: 'Altitude', u: AU, v: A(a), s: c.src === 'gps' ? 'GPS' : st.baro ? 'vario' : 'GPS' }; }
    case 'agl': return { l: 'Above ground', u: AU, v: st.groundElev != null && alt != null ? A(alt - st.groundElev) : '--', s: st.groundElev != null ? 'ground ' + A(st.groundElev) : 'needs terrain data' };
    case 'gs': return { l: 'Ground speed', u: SU, v: Sp(f?.spd) };
    case 'trk': return { l: 'Track', u: '°', v: f?.trk != null ? pad3(f.trk) : '--', s: f?.trk != null ? compass(f.trk) : '' };
    case 'ld': { const win = +c.win || 20, a = avgVario(win, now), g = avgSpd(win, now); const v = !st.circling && a != null && a < -0.2 && g > 3 ? g / -a : null; return { l: 'Glide ' + win + ' s', u: '', v: v ? v.toFixed(1) : (st.ld ? st.ld.toFixed(1) : '--'), s: v ? '' : st.circling ? 'circling' : '' }; }
    case 'reqld': { const need = dwp != null && alt != null && st.groundElev != null ? dwp / Math.max(1, alt - st.groundElev - S.safety) : null; return { l: 'Req. glide', u: '', v: need && need > 0 ? need.toFixed(1) : '--', s: wp ? 'to ' + wp.name : 'no task' }; }
    case 'wind': return { l: 'Wind', u: SU, v: w ? Sp(w.spd) : '--', s: w ? 'from ' + pad3(w.from) + '° ' + compass(w.from) : 'circle once', arrow: w ? w.to : null };
    case 'dist': return { l: 'To ' + (wp ? wp.name : 'turnpoint'), u: '', v: dwp != null ? fDist(dwp) : '--', s: wp && f ? 'brg ' + pad3(brg(f.lat, f.lon, wp.lat, wp.lon)) + '°' : 'no task' };
    case 'thermal': return { l: 'Thermal avg', u: VU(), v: th && alt != null ? V((alt - th.alt0) / Math.max(1, ((th.end || now) - th.t0) / 1000)) : '--' };
    case 'gain': return { l: 'Thermal gain', u: AU, v: th && alt != null ? (alt - th.alt0 >= 0 ? '+' : '') + A(alt - th.alt0) : '--' };
    case 'ttime': { const t = th ? Math.floor(((th.end || now) - th.t0) / 1000) : null; return { l: 'In thermal', u: '', v: t != null ? Math.floor(t / 60) + ':' + pad2(t % 60) : '--' }; }
    case 'flight': { const t = st.takeoffT ? Math.floor((now - st.takeoffT) / 1000) : null; return { l: 'Flight time', u: '', v: t != null ? Math.floor(t / 3600) + ':' + pad2(Math.floor(t / 60) % 60) : '--' }; }
    case 'time': { const d = new Date(c.zone === 'utc' && st.replay ? st.replay.vt : Date.now()); const U = c.zone === 'utc'; const hh = U ? d.getUTCHours() : d.getHours(), mm = U ? d.getUTCMinutes() : d.getMinutes(), ss = U ? d.getUTCSeconds() : d.getSeconds(); return { l: U ? 'UTC' : 'Local time', u: '', v: pad2(hh) + ':' + pad2(mm) + (c.sec ? ':' + pad2(ss) : ''), s: 'tap: both times' }; }
    case 'temp': return { l: 'Temperature', u: '°C', v: st.baro?.temp != null ? st.baro.temp.toFixed(1) : '--' };
    case 'battery': { const vb = st.bora?.batt; return { l: 'Battery', u: '', v: vb ? (vb.pct != null ? vb.pct + '%' : vb.v.toFixed(2) + ' V') : st.sim ? (st.simBat || 90) + '%' : '--', s: st.deviceBat != null ? 'tablet ' + st.deviceBat + '%' : '' }; }
    case 'glide': { const p = st.pred; return { html: `<div class="ws" style="font-size:14px;color:var(--ink)">● <b>L/D ${p.ldNow ? p.ldNow.toFixed(1) : '--'} now</b> → ${p.now ? fDist(p.now[2]) : '--'}</div><div class="ws" style="font-size:14px;color:var(--ink)">○ <b>L/D ${S.wingLD} wing</b> → ${p.wing ? fDist(p.wing[2]) : st.groundElev == null ? 'needs terrain' : '--'}</div>`, l: 'Landing prediction' }; }
    case 'cloud': { const fc = st.forecast; if (!fc) return { l: 'Cloud base', u: AU, v: '--', s: 'load forecast on Atmosphere' }; const cb = fc.elev + 125 * (fc.T - fc.Td), top = thermalTop(); return { l: 'Cloud base', u: AU, v: A(cb), s: 'thermal top ' + (top ? A(top) : '--') }; }
    case 'place': { if (!f) return { l: 'Nearest place', v: '--' }; const spl = startPlace(); const L0 = c.kind === 'start' ? (spl ? [spl] : []) : st.places.concat(c.kind === 'any' || !c.kind ? (spl ? [spl] : []) : []).filter((p) => c.kind === 'airport' ? p.kind === 'airport' : c.kind === 'town' ? p.kind === 'town' : p.kind !== 'peak'); let b = null, bd = 1e12; L0.forEach((p) => { const d = dist(f.lat, f.lon, p.lat, p.lon); if (d < bd) { bd = d; b = p; } }); return b ? { l: c.kind === 'start' ? 'Start' : 'Nearest place', u: '', v: fDist(bd), s: `${compass(brg(b.lat, b.lon, f.lat, f.lon))} of ${b.name}` } : { l: 'Nearest place', v: '--', s: 'loading places…' }; }
    case 'air': { const x = airStatus()[0]; if (!x) return { l: 'Airspace', v: '--', s: st.airspaces.length ? 'none within 30 km' : 'no airspace data' }; return { l: 'Airspace', u: '', v: x.inside && x.vert === 'in' ? 'INSIDE' : fDist(x.d), s: `${x.a.name} · ${fmtLim(x.a.lo)}–${fmtLim(x.a.hi)}`, col: x.inside && x.vert === 'in' ? css('--restr') : null }; }
    case 'next': {
      if (!wp || !f) return { html: `<div class="ws" style="white-space:normal">No task. Import a FlyXC route on the Web page.</div>`, l: 'Next turnpoint' };
      const b = brg(f.lat, f.lon, wp.lat, wp.lon); const arr = alt != null && st.groundElev != null ? alt - dwp / S.wingLD - st.groundElev : null;
      return { l: `Next · ${wp.name} (${st.nextWp + 1}/${st.task.pts.length})`, html: `<div class="row" style="gap:14px;flex:1;align-items:center"><div><div class="ws">Dist</div><div class="num" style="font-size:26px">${fDist(dwp)}</div></div><div><div class="ws">Brg</div><div class="num" style="font-size:26px">${pad3(b)}°</div></div><div><div class="ws">ETA</div><div class="num" style="font-size:26px">${f.spd > 2 ? etaStr(dwp / f.spd) : '--'}</div></div></div><div class="ws">${arr != null ? (arr >= 0 ? 'Arrive ' + A(arr) + ' ' + AU + ' above ground' : 'Short by ' + A(-arr) + ' ' + AU) + ' at L/D ' + S.wingLD : ''}</div>` };
    }
    case 'button': { const a = BTN[c.action] || BTN.thermalOn, bgc = { orange: 'var(--climb)', blue: 'var(--sink)', dark: 'var(--ink)' }[c.color || 'orange'], fg = { plain: 'var(--ink)' }[c.color] || (c.color === 'dark' ? 'var(--bg)' : '#FFFFFF'); let lab = c.label || a[1]; if (!c.label) { if (c.action === 'pSwitch') lab = pageKey() === 'thermal' ? 'MAP' : 'THERMAL'; if (c.action === 'fullscreen' && document.fullscreenElement) lab = 'EXIT FULL'; } return { l: '', v: lab, col: fg, bgc, center: true, btn: true }; }
    case 'core': { const k = coreEstimate(); return { l: 'Centering', u: '', v: k ? Math.round(k.d) + ' m' : '--', s: k ? 'to ' + pad3(k.b) + '° ' + compass(k.b) + (st.circling ? '' : ' (last)') : 'start circling' }; }
    case 'groundT': { const fc = st.forecast; return { l: 'Ground T / dew pt', u: '°C', v: fc ? fc.T.toFixed(1) + ' / ' + fc.Td.toFixed(1) : '--', s: fc ? 'forecast 2 m · ' + fc.t.slice(11, 16) : 'load forecast' }; }
    case 'cbase': { const fc = st.forecast, cb = fc ? fc.elev + 125 * (fc.T - fc.Td) : null; return { l: 'Cloud base', u: AU, v: cb != null ? A(cb) : '--', col: css('--sink'), s: 'elev + 125 m × spread' }; }
    case 'ttop': { const t = thermalTop(); return { l: 'Thermal top', u: AU, v: t ? A(t) : '--', col: css('--warn'), s: st.forecast ? 'parcel +' + (+(S.trig ?? 2)).toFixed(1) + ' °C' : 'load forecast' }; }
    case 'outlook': {
      const fc = st.forecast; let txt = 'Load the forecast to estimate cloud base and thermal top.';
      if (fc) { const cb = fc.elev + 125 * (fc.T - fc.Td), top = thermalTop(); txt = top ? (top < cb ? `Blue thermals likely, top around ${A(top)} ${AU}. Cloud base would be ${A(cb)} ${AU}, above the thermal top.` : `Cumulus likely, base around ${A(cb)} ${AU}.`) : 'No clear top found in the forecast profile.'; }
      return { l: 'Outlook', u: fc ? 'forecast ' + fc.t.slice(11, 16) : '', html: `<div style="flex:1;min-height:0;font-size:${curBox.h > 150 ? 18 : 15}px;font-weight:600;overflow:hidden">${esc(txt)}</div><div class="row" style="flex-shrink:0"><button class="wcb wide" data-act="forecast">${st.fcLoading ? 'Loading…' : fc ? 'Refresh forecast' : 'Load forecast'}</button></div>` };
    }
    case 'trigger': { const t = +(S.trig ?? 2); return { l: 'Parcel start', u: 'trigger excess', html: `<div class="row" style="flex:1;justify-content:space-between"><button class="wcb" data-act="trigm" aria-label="Less">−</button><span class="num" style="font-size:34px">+${t.toFixed(1)} °C</span><button class="wcb" data-act="trigp" aria-label="More">+</button></div>` }; }
    case 'places': {
      const f = st.fix, wide = curBox.w > 430, ctlH = wide ? 52 : 100, rows = Math.max(1, Math.floor((curBox.h - 34 - ctlH) / 46));
      const ctl = `<div class="row" style="flex-wrap:wrap;gap:4px;flex-shrink:0"><button class="wcb wide" data-act="rad">${S.poiRadius} km</button>${[['town', 'Towns'], ['airport', 'Airports'], ['peak', 'Peaks']].map(([k, n]) => `<button class="wcb wide" data-act="kind:${k}" aria-pressed="${!!S.poiKinds[k]}">${n}</button>`).join('')}<button class="wcb wide" data-act="start">Start here</button><button class="wcb wide" data-act="refresh" aria-label="Refresh">↻</button></div>`;
      let list = '';
      if (!f) list = '<div class="ws" style="white-space:normal">Waiting for GPS…</div>';
      else {
        const L1 = visiblePlaces().map((p) => ({ ...p, d: dist(f.lat, f.lon, p.lat, p.lon), b: brg(f.lat, f.lon, p.lat, p.lon) })).sort((a, b) => (b.kind === 'start') - (a.kind === 'start') || a.d - b.d).slice(0, rows);
        list = L1.length ? L1.map((p) => `<div class="li" style="min-height:44px;padding:3px 0"><svg width="30" height="30" viewBox="0 0 34 34" aria-hidden="true" style="flex-shrink:0"><circle cx="17" cy="17" r="15" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="1.5"/><g transform="rotate(${p.b} 17 17)"><path d="M17 4l6 12-6-3-6 3z" fill="currentColor"/><line x1="17" y1="13" x2="17" y2="28" stroke="currentColor" stroke-width="2"/></g></svg><div class="grow" style="min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)} <span class="lbl">${esc(p.kind === 'town' || p.kind === 'start' ? p.sub : p.kind)}</span></div><div class="muted" style="font-size:12px">You are ${fDist(p.d)} ${compass(p.b + 180)} of it</div></div><div style="text-align:right"><div class="num" style="font-size:22px;line-height:1">${fDist(p.d)}</div><div class="muted" style="font-size:11px">brg ${pad3(p.b)}°</div></div></div>`).join('')
          : `<div class="ws" style="white-space:normal">${st.placesState === 'loading' ? 'Loading places from OpenStreetMap…' : (st.placesState || '').startsWith('error') ? 'Could not load places: ' + esc(st.placesState.slice(7)) + '. Needs mobile data.' : 'No places of these kinds in range.'}</div>`;
      }
      return { l: `Places within ${S.poiRadius} km`, html: ctl + `<div style="flex:1;min-height:0;overflow:hidden">${list}</div>` };
    }
    case 'aslist': {
      const s = airStatus(), rows = Math.max(1, Math.floor((curBox.h - 30) / 52)), inside = s.filter((x) => x.inside && x.vert === 'in');
      const l = !st.airspaces.length ? 'Airspace · no data loaded' : inside.length ? 'Inside ' + inside.map((x) => x.a.name).join(', ') : 'Not inside any loaded airspace';
      const body = s.slice(0, rows).map((x) => `<div class="li" style="min-height:48px;padding:3px 0"><span style="width:14px;height:14px;border-radius:3px;border:2px solid ${airColor(x.a)};flex-shrink:0"></span><div class="grow" style="min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.a.name)} <span class="muted" style="font-weight:400">· ${fmtLim(x.a.lo)} – ${fmtLim(x.a.hi)}</span></div><div class="muted" style="font-size:12px">${x.inside ? (x.vert === 'in' ? 'You are inside' : x.vert === 'below' ? `Inside the area, ${Math.round(x.lo - x.alt)} m below the floor` : `Inside the area, ${Math.round(x.alt - x.hi)} m above the top`) : `${fDist(x.d)} away · you are ${x.vert === 'below' ? 'below its floor' : x.vert === 'above' ? 'above its top' : 'within its height band'}`}</div></div></div>`).join('') || `<div class="ws" style="white-space:normal">${st.airspaces.length ? 'No airspace within 30 km.' : 'Load airspace in Settings → Airspace data.'}</div>`;
      return { l, html: `<div style="flex:1;min-height:0;overflow:hidden">${body}</div>` };
    }
    case 'radio': {
      const s = airStatus(), fr = []; s.slice(0, 5).forEach((x, i) => x.a.freq.forEach((q) => { if (fr.length < 8 && !fr.find((y) => y.v === q.v)) fr.push({ ...q, on: i === 0 }); }));
      const cols = curBox.w > 520 ? 4 : curBox.w > 330 ? 3 : 2;
      return { l: 'Radio', u: 'from airspace data', html: fr.length ? `<div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:6px;overflow:hidden">${fr.map((q) => `<div class="freq ${q.on ? 'on' : ''}"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(q.n)}</div><div class="num" style="font-size:24px">${esc(q.v)}</div></div>`).join('')}</div>` : '<div class="ws" style="white-space:normal">No frequencies in the loaded airspace data.</div>' };
    }
    case 'notams': {
      const R = (+c.radius || S.notamRadius || 50) * 1000;
      const list = NOTAMS.map((n) => ({ n, d: ntWhere(n), s: ntState(n) })).filter((x) => x.s !== 'over');
      const near = list.filter((x) => x.d != null && x.d <= R).sort((a, b) => (a.s === 'active' ? 0 : 1) - (b.s === 'active' ? 0 : 1) || a.d - b.d), rest = list.filter((x) => !(x.d != null && x.d <= R));
      ntView = ntShowAll ? near.concat(rest) : near;
      const rows = Math.max(1, Math.floor((curBox.h - 96) / 54)), age = st.notamAt ? Math.round((Date.now() - st.notamAt) / 60000) : null;
      const ctl = `<div class="row" style="gap:4px;flex-shrink:0"><button class="wcb wide" data-act="ntrefresh">${st.ntLoading ? 'Loading…' : 'Refresh'}</button>${NOTAMS.length ? `<button class="wcb wide" data-act="ntall">${ntShowAll ? 'Only nearby' : 'Show all ' + list.length}</button>` : ''}<span class="ws" style="margin-left:auto">${age != null ? 'ais.fi · ' + age + ' min ago' : ''}</span></div>`;
      const body = (st.ntMsg ? `<div class="ws" style="white-space:normal">${esc(st.ntMsg)}</div>` : '') + ntView.slice(0, rows).map((x) => `<button class="li" data-act="notam:${esc(x.n.id)}" style="min-height:50px;padding:3px 0"><span class="badge ${x.s === 'active' ? 'act' : ''}">${x.s === 'active' ? 'Active' : fmtZ(x.n.from)}</span><span class="grow" style="font-size:13px;min-width:0;overflow:hidden"><b>${esc(x.n.text.slice(0, 60))}${x.n.text.length > 60 ? '…' : ''}</b><br><span class="muted">${esc(x.n.lower ? x.n.lower + ' – ' + x.n.upper : x.n.ad || x.n.sec)}${x.d != null ? ' · ' + (x.d === 0 ? 'you are inside' : fDist(x.d)) : ''}</span></span><span aria-hidden="true">›</span></button>`).join('') + (!NOTAMS.length && !st.ntMsg ? '<div class="ws" style="white-space:normal">Tap Refresh to load NOTAMs from ais.fi.</div>' : '');
      return { l: NOTAMS.length ? `NOTAM · ${near.length} within ${R / 1000} km` : 'NOTAM', html: ctl + `<div style="flex:1;min-height:0;overflow:hidden">${body}</div>` };
    }
  }
  return { l: W.type, v: '' };
}
function dialDraw(cv, W) {
  const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H); const cx = Wd / 2, cy = H / 2, R = Math.min(Wd, H) / 2 - 6; const rg = +W.cfg.range || 5;
  const ang = (v) => (180 + clamp(v, -rg, rg) / rg * 150) * D2R; const P = (v, r) => [cx + r * Math.cos(ang(v)), cy + r * Math.sin(ang(v))];
  c.lineWidth = Math.max(4, R * 0.08); c.strokeStyle = css('--climb3'); c.beginPath(); c.arc(cx, cy, R * 0.9, ang(0), ang(rg)); c.stroke(); c.strokeStyle = 'rgba(30,80,200,.25)'; c.beginPath(); c.arc(cx, cy, R * 0.9, ang(-rg), ang(0)); c.stroke();
  if (st.vario > 0) { c.strokeStyle = css('--climb'); c.beginPath(); c.arc(cx, cy, R * 0.9, ang(0), ang(st.vario)); c.stroke(); }
  c.strokeStyle = css('--ink'); c.fillStyle = css('--ink'); c.font = `700 ${Math.max(10, R * 0.16)}px Barlow Condensed`; c.textAlign = 'center';
  for (let i = -rg; i <= rg; i++) { const [x1, y1] = P(i, R * 0.78), [x2, y2] = P(i, R * 0.98); c.lineWidth = i % (rg / 5 * 2) === 0 ? 2.5 : 1.2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); if (i % (rg / 5 * 2) === 0) { const [tx, ty] = P(i, R * 0.6); c.fillText(String(i), tx, ty + R * 0.06); } }
  if (+W.cfg.win) { const a = avgVario(+W.cfg.win); if (a != null) { const [x, y] = P(a, R * 0.9); c.fillStyle = css('--card'); c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, R * 0.07, 0, 7); c.fill(); c.stroke(); } }
  const [nx, ny] = P(st.vario, R * 0.86); c.lineWidth = Math.max(3, R * 0.05); c.lineCap = 'round'; c.strokeStyle = css('--ink'); c.beginPath(); c.moveTo(cx, cy); c.lineTo(nx, ny); c.stroke(); c.beginPath(); c.arc(cx, cy, R * 0.07, 0, 7); c.fill();
  c.fillStyle = st.vario >= 0 ? css('--climb') : css('--sink'); c.font = `700 ${R * 0.3}px Barlow Condensed`; c.fillText(fVario(st.vario), cx + R * 0.3, cy + R * 0.42);
}
function numRow(key, name, spec, cur) {
  const isNum = (typeof cur === 'number' && isFinite(cur)) || (typeof cur === 'string' && cur !== '' && !isNaN(+cur)), v = isNum ? +cur : null;
  const pres = (spec.extra || []).map(([val, l]) => `<button class="pill" data-nv="${key}" data-nval="${val}" aria-pressed="${cur === val}">${l}</button>`).join('');
  return `<div class="opt"><span class="lbl">${name}${spec.hint ? ' · ' + spec.hint : ''}</span><div class="row"><button class="pill step" data-ns="${key}" data-dir="-1" aria-label="Less">−</button><input type="number" class="numin" inputmode="decimal" data-ni="${key}" value="${isNum ? v : ''}" placeholder="${(spec.extra || []).some((x) => x[0] === cur) ? '—' : ''}" min="${spec.min}" max="${spec.max}" step="${spec.snap ?? spec.step}" aria-label="${name}, ${spec.unit}"><span class="unit">${v === 0 && spec.zero ? spec.zero : spec.unit}</span><button class="pill step" data-ns="${key}" data-dir="1" aria-label="More">+</button></div>${pres ? `<div class="row" style="flex-wrap:wrap">${pres}</div>` : ''}</div>`;
}
function snapNum(spec, v) { const g = spec.snap ?? spec.step, d = (String(g).split('.')[1] || '').length; return clamp(+(Math.round(v / g) * g).toFixed(d), spec.min, spec.max); }
function tapRow(key, name, cur) {
  const g = TAPG.find(([, l]) => l.some((x) => x[0] === cur)) || TAPG[0], btn = (v, n, extra) => `<button class="pill ${extra || ''}" data-ok="${key}" data-ov="${v}" aria-pressed="${String(cur) === String(v)}">${n}</button>`;
  return `<div class="opt"><span class="lbl">${name}</span><div class="row">${TAPG.map(([n, l]) => `<button class="pill" data-ok="${key}" data-ov="${l[0][0]}" data-grp="${n}" aria-pressed="${g[0] === n}">${n}</button>`).join('')}</div>${g[1].length > 1 ? `<div class="row sub">${g[1].map(([v, n]) => btn(v, n)).join('')}</div>` : ''}</div>`;
}
function optRow(key, name, opts, cur) { if (key === 'tap') return tapRow(key, name, cur); if (!Array.isArray(opts)) return numRow(key, name, opts, cur); return `<div class="opt"><span class="lbl">${name}</span><div class="row">${opts.map(([v, n]) => `<button class="pill" data-ok="${key}" data-ov="${v}" aria-pressed="${String(cur) === String(v)}">${n}</button>`).join('')}</div></div>`; }
let sheetMode = 'normal', sheetFor = null;
function sheetSide(W) { const side = S.sheetSide || ((W.x + W.w / 2) / GC > 0.5 ? 'left' : 'right'); $('wSheet').classList.toggle('left', side === 'left'); }
function closeSheet() { $('wSheet').classList.remove('on'); wSel = null; if (st.force && st.sheetForce) { st.force = false; st.sheetForce = false; updateMode(); } sheetFor = null; renderWidgets(); }
function openSheet(id) {
  const W = S.layout.find((x) => x.id === id); if (!W) return; if (sheetFor !== id) { sheetMode = 'normal'; sheetFor = id; if (st.sheetForce) { st.force = false; st.sheetForce = false; updateMode(); } } wSel = id; const T = WT[W.type];
  const tm = sheetMode === 'thermal', hasT = !!W.cfgT, D = tm && hasT ? W.cfgT : W.cfg;
  const read = (k, d) => { const v = tm && hasT && W.cfgT[k] !== undefined ? W.cfgT[k] : W.cfg[k]; return v ?? d; };
  const dflt = (k, o) => (T.def && T.def[k] !== undefined ? T.def[k] : k === 'tap' ? defTap(W) : Array.isArray(o) ? o[0][0] : o.def ?? o.presets[0]);
  const opts = T.o.concat(COMMON).filter(([k]) => !(tm && (k === 'vis' || k === 'visDelay')) && !(k === 'visDelay' && (W.cfg.vis || 'always') === 'always')).map(([k, n, o]) => optRow(k, n, o, read(k, dflt(k, o)))).join('');
  const typeOpts = Object.entries(WT).map(([k, t]) => `<option value="${k}" ${k === W.type ? 'selected' : ''}>${t.n}</option>`).join('');
  const tabs = `<div class="row"><button class="pill grow" data-sm="normal" aria-pressed="${!tm}">Normal${hasT && !tm ? ' •' : ''}</button><button class="pill grow" data-sm="thermal" aria-pressed="${tm}">When thermaling${hasT ? ' •' : ''}</button></div>`;
  let body;
  if (!tm) body = `<div class="opt"><label class="lbl" for="wsType">Widget</label><select id="wsType">${typeOpts}</select></div>
    <div class="opt"><label class="lbl" for="wsLabel">Title text</label><input type="text" id="wsLabel" value="${esc(W.cfg.label || '')}" placeholder="${esc(T.n)}"></div>
    ${opts}
    <div class="opt"><span class="lbl">Size and place</span><div class="row"><button class="pill" data-wsz="w-">Narrower</button><button class="pill" data-wsz="w+">Wider</button><button class="pill" data-wsz="h-">Lower</button><button class="pill" data-wsz="h+">Taller</button></div></div>
    <div class="row" style="flex-wrap:wrap;margin-top:6px"><button class="btn" id="wsDup">Duplicate</button><button class="btn" id="wsFront">Bring to front</button><button class="btn warn" id="wsDel">Delete</button></div>`;
  else body = `<div class="muted" style="line-height:1.4">Shown live on the page now. These settings replace the normal ones only while thermaling is detected; everything you leave alone stays as in Normal.</div>
    <div class="opt"><span class="lbl">Different settings when thermaling</span><div class="row"><button class="pill" data-tm="off" aria-pressed="${!hasT}">Off</button><button class="pill" data-tm="on" aria-pressed="${hasT}">On</button></div></div>${hasT ? opts + '<div class="row"><button class="btn" data-tm="clear">Clear thermal changes</button></div>' : ''}`;
  $('wSheet').innerHTML = `<div class="row wsHead" id="wsHead"><span class="grip" aria-hidden="true">⠿</span><h2>${T.n}</h2><button class="btn" id="wsFlip" aria-label="Move settings to the other side">⇄</button><button class="btn primary" id="wsClose">Close</button></div>${tabs}${body}`;
  sheetSide(W); $('wSheet').classList.add('on'); renderWidgets();
  { const sh0 = $('wSheet'), hd = $('wsHead'); $('wsFlip').onclick = () => { S.sheetSide = sh0.classList.contains('left') ? 'right' : 'left'; save(); sheetSide(W); };
    hd.onpointerdown = (e) => { if (e.target.closest('button')) return; hd.setPointerCapture(e.pointerId); const sx = e.clientX; let dx = 0; sh0.style.transition = 'none';
      hd.onpointermove = (m) => { dx = m.clientX - sx; sh0.style.transform = `translateX(${dx}px)`; };
      hd.onpointerup = hd.onpointercancel = (u) => { hd.onpointermove = hd.onpointerup = hd.onpointercancel = null; sh0.style.transform = ''; if (Math.abs(dx) > 24) { S.sheetSide = u.clientX < innerWidth / 2 ? 'left' : 'right'; save(); } sheetSide(W); }; }; }
  $('wsClose').onclick = closeSheet;
  const sh = $('wSheet'), q = (sel, fn) => sh.querySelectorAll(sel).forEach(fn);
  q('[data-sm]', (b) => (b.onclick = () => { sheetMode = b.dataset.sm; if (sheetMode === 'thermal') { st.force = true; st.sheetForce = true; } else if (st.sheetForce) { st.force = false; st.sheetForce = false; } updateMode(); renderWidgets(); openSheet(id); }));
  q('[data-tm]', (b) => (b.onclick = () => { const a = b.dataset.tm; if (a === 'on' && !W.cfgT) W.cfgT = {}; if (a === 'off') delete W.cfgT; if (a === 'clear') W.cfgT = {}; saveLayout(); openSheet(id); }));
  if ($('wsType')) $('wsType').onchange = (e) => { W.type = e.target.value; saveLayout(); openSheet(W.id); };
  if ($('wsLabel')) $('wsLabel').oninput = (e) => { W.cfg.label = e.target.value; saveLayout(); };
  if ($('wsDup')) $('wsDup').onclick = () => { const n = JSON.parse(JSON.stringify(W)); n.id = newW(W.type).id; n.x = Math.min(GC - n.w, n.x + GSC); n.y = Math.min(GR - n.h, n.y + GSC); S.layout.push(n); saveLayout(); openSheet(n.id); toast('Widget duplicated · drag the copy where you want it'); };
  if ($('wsFront')) $('wsFront').onclick = () => { S.layout = S.layout.filter((x) => x !== W).concat(W); saveLayout(); };
  if ($('wsDel')) $('wsDel').onclick = () => { S.layout = S.layout.filter((x) => x !== W); closeSheet(); saveLayout(); toast('Widget deleted', [['Undo', () => { S.layout.push(W); saveLayout(); }]]); };
  const spec = (k) => (T.o.find((x) => x[0] === k) || [])[2];
  q('[data-nv]', (b) => (b.onclick = () => { const raw = b.dataset.nval; D[b.dataset.nv] = raw !== '' && !isNaN(+raw) ? +raw : raw; saveLayout(); openSheet(W.id); }));
  q('[data-ns]', (b) => (b.onclick = () => { const k = b.dataset.ns, sp = spec(k), c = D[k] ?? W.cfg[k] ?? dflt(k, sp), base = typeof c === 'number' ? c : sp.def ?? sp.min; D[k] = snapNum(sp, base + (+b.dataset.dir) * sp.step); saveLayout(); openSheet(W.id); }));
  q('[data-ni]', (i) => (i.onchange = () => { const k = i.dataset.ni, v = parseFloat(String(i.value).replace(',', '.')); if (isFinite(v)) D[k] = snapNum(spec(k), v); saveLayout(); openSheet(W.id); }));
  q('[data-ok]', (b) => (b.onclick = () => { const raw = b.dataset.ov; D[b.dataset.ok] = raw === 'true' ? true : raw === 'false' ? false : raw !== '' && !isNaN(+raw) ? +raw : raw; saveLayout(); openSheet(W.id); }));
  q('[data-wsz]', (b) => (b.onclick = () => { const k = b.dataset.wsz; if (k === 'w+') W.w = Math.min(GC - W.x, W.w + 2); if (k === 'w-') W.w = Math.max(6, W.w - 2); if (k === 'h+') W.h = Math.min(GR - W.y, W.h + 2); if (k === 'h-') W.h = Math.max(4, W.h - 2); saveLayout(); }));
}
function openAdd() {
  $('dlgBody').innerHTML = `<div class="row" style="justify-content:space-between"><span class="num" style="font-size:26px">Add widget</span><button class="btn primary" id="dlgClose">Close</button></div><div class="addGrid">${[['button:pSwitch', 'Map / Thermal button', 'Switch page, hold for all pages'], ['button:fullscreen', 'Full screen button', 'Toggle full screen']].map(([k, n, d]) => `<button data-add="${k}">${n}<small>${d}</small></button>`).join('')}${Object.entries(WT).map(([k, t]) => `<button data-add="${k}">${t.n}<small>${t.d}</small></button>`).join('')}</div>`;
  $('dlg').style.display = 'flex'; $('dlgClose').onclick = () => ($('dlg').style.display = 'none');
  $('dlgBody').querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => { const [t, pre] = b.dataset.add.split(':'), T = WT[t]; const W = newW(t, Math.round((GC - T.w * GSC) / 2), Math.round((GR - T.h * GSC) / 2)); if (pre) W.cfg.action = pre; S.layout.push(W); saveLayout(); $('dlg').style.display = 'none'; openSheet(W.id); }));
}
/* pointer handling on every page layer: long-press to edit, drag to move, corners to resize, pinch/wheel zoom on the thermal assistant */
(function wPointer() {
  let drag = null, lp = null, pinch = null; const ptrs = new Map();
  document.querySelectorAll('.wLayer').forEach((layer) => {
    layer.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.wg'); if (!el) return; const W = S.layout.find((x) => x.id === el.dataset.id); if (!W) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, id: W.id });
      if (!wEdit) {
        if (ptrs.size >= 2) { if (lp) { clearTimeout(lp.t); lp = null; } if (ptrs.size === 2 && W.type === 'ta') { const [p, q] = [...ptrs.values()]; if (p.id === q.id) pinch = { W, d0: Math.hypot(p.x - q.x, p.y - q.y) || 1, z0: +effCfg(W).zoom || 1 }; } return; }
        if (pinch) return;
        const ae = e.target.closest('[data-act]');
        lp = { x: e.clientX, y: e.clientY, W, act: ae ? ae.dataset.act : null, t: setTimeout(() => { lp = null; if (isPageBtn(W)) pageMenu(); else enterEdit(W.id); }, ae ? 900 : 600) };
        return;
      }
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      drag = { W, el, mode: e.target.classList.contains('wh') ? 'size' : 'move', c: e.target.dataset.c || 'br', sx: e.clientX, sy: e.clientY, ox: W.x, oy: W.y, ow: W.w, oh: W.h, moved: false };
    });
    layer.addEventListener('pointermove', (e) => {
      const pp = ptrs.get(e.pointerId); if (pp) { pp.x = e.clientX; pp.y = e.clientY; }
      if (pinch && ptrs.size >= 2) { const [p, q] = [...ptrs.values()]; cfgW(pinch.W).zoom = clamp(pinch.z0 * Math.hypot(p.x - q.x, p.y - q.y) / pinch.d0, 0.25, 8); renderWidgets(); return; }
      if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) { clearTimeout(lp.t); lp = null; }
      if (!drag) return; const r = layer.getBoundingClientRect(); const dx = (e.clientX - drag.sx) / r.width * GC, dy = (e.clientY - drag.sy) / r.height * GR;
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 8) drag.moved = true; if (!drag.moved) return;
      const W = drag.W;
      if (drag.mode === 'move') { W.x = clamp(Math.round(drag.ox + dx), 0, GC - W.w); W.y = clamp(Math.round(drag.oy + dy), 0, GR - W.h); }
      else {
        const MW = 6, MH = 4, c = drag.c;
        if (c.includes('r')) W.w = clamp(Math.round(drag.ow + dx), MW, GC - drag.ox);
        else { const nx = clamp(Math.round(drag.ox + dx), 0, drag.ox + drag.ow - MW); W.w = drag.ow + (drag.ox - nx); W.x = nx; }
        if (c.includes('b')) W.h = clamp(Math.round(drag.oh + dy), MH, GR - drag.oy);
        else { const ny = clamp(Math.round(drag.oy + dy), 0, drag.oy + drag.oh - MH); W.h = drag.oh + (drag.oy - ny); W.y = ny; }
      }
      renderWidgets();
    });
    const up = (e) => {
      ptrs.delete(e.pointerId);
      if (pinch) { if (ptrs.size < 2) { save(); pinch = null; } return; }
      if (lp) { clearTimeout(lp.t); const l1 = lp; lp = null; if (l1.act) widgetAct(l1.W, l1.act); else handleTap(l1.W); return; }
      if (!drag) return; const d = drag; drag = null; if (!d.moved) openSheet(d.W.id); else saveLayout();
    };
    layer.addEventListener('pointerup', up);
    layer.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); if (lp) clearTimeout(lp.t); lp = null; drag = null; if (ptrs.size < 2) pinch = null; });
    layer.addEventListener('contextmenu', (e) => e.preventDefault());
    layer.addEventListener('wheel', (e) => { if (wEdit) return; const el = e.target.closest('.wg[data-type="ta"]'); if (!el) return; const W = S.layout.find((x) => x.id === el.dataset.id); if (!W) return; e.preventDefault(); cfgW(W).zoom = clamp((+effCfg(W).zoom || 1) * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.25, 8); renderWidgets(); clearTimeout(window._zt); window._zt = setTimeout(save, 400); }, { passive: false });
  });
})();
$('wDone').onclick = exitEdit; $('wAdd').onclick = openAdd;
$('editBtn').onclick = () => { setNav(false); if (!PAGEKEY[curPage]) showPage('pMap'); setTimeout(() => enterEdit(), 80); };
$('wReset').onclick = () => { const pk = pageKey(), old = S.layouts[pk]; S.layouts[pk] = defLayout(pk); saveLayout(); toast('Layout reset', [['Undo', () => { S.layouts[pk] = old; save(); renderWidgets(); }]]); };
window.addEventListener('resize', () => { document.querySelectorAll('.wLayer .wg').forEach((e) => (e._last = null)); renderWidgets(); });


