'use strict';
/* ================= measured wind at weather stations (FMI open data, Finland) =================
   loadStations(): FMI's open WFS (opendata.fmi.fi, free, no key; stored query fmi::observations::weather::simple) for the last 40 min within ~45 km:
   wind speed, gust, direction and temperature per station, the newest value of each. Refreshed every 10 min while a Station wind widget exists.
   Widget `wstation`: the nearest station to you (or to the Start point, cfg.near 'start'); tap: all stations nearby. The simple query gives no station
   names, so stations are named by distance and direction. FMI covers Finland; browser access (CORS) from the hosted page was not checked from here. */
const STN = { list: [], at: 0, busy: false, err: null, c: null };
async function loadStations(c) {
  if (STN.busy || !c) return; STN.busy = true; STN.err = null;
  const t0 = new Date(Date.now() - 40 * 60000).toISOString().slice(0, 19) + 'Z', bb = [(c[1] - 0.8).toFixed(2), (c[0] - 0.4).toFixed(2), (c[1] + 0.8).toFixed(2), (c[0] + 0.4).toFixed(2)].join(',');
  try {
    const r = await fetch(`https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::simple&bbox=${bb}&parameters=windspeedms,windgust,winddirection,temperature&starttime=${t0}&timestep=10`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const x = new DOMParser().parseFromString(await r.text(), 'text/xml'), byPos = new Map();
    [...x.getElementsByTagNameNS('*', 'BsWfsElement')].forEach((e) => {
      const g = (n) => { const el = e.getElementsByTagNameNS('*', n)[0]; return el ? el.textContent.trim() : null; };
      const pos = g('pos'), t = Date.parse(g('Time')), k = g('ParameterName'), v = parseFloat(g('ParameterValue')); if (!pos || !k || !isFinite(v)) return;
      const [lat, lon] = pos.split(/\s+/).map(Number); let s = byPos.get(pos); if (!s) { s = { lat, lon, v: {}, t: {} }; byPos.set(pos, s); }
      if (!s.t[k] || t > s.t[k]) { s.v[k] = v; s.t[k] = t; }
    });
    STN.list = [...byPos.values()].filter((s) => s.v.windspeedms != null).map((s) => ({ lat: s.lat, lon: s.lon, spd: s.v.windspeedms, gust: s.v.windgust ?? null, dir: s.v.winddirection ?? null, temp: s.v.temperature ?? null, t: s.t.windspeedms }));
    STN.at = Date.now(); STN.c = c; markDirty();
  } catch (e) { STN.err = e.message || 'blocked'; STN.at = Date.now(); } finally { STN.busy = false; }
}
function stnCentre(W) { const c = W && effCfg(W).near === 'start' && typeof startPlace === 'function' ? startPlace() : null; if (c) return [c.lat, c.lon]; const f = st.gpsPos || st.fix; return f ? [f.lat, f.lon] : null; }
function stnSorted(c) { return STN.list.map((s) => ({ ...s, d: dist(c[0], c[1], s.lat, s.lon), b: brg(c[0], c[1], s.lat, s.lon) })).sort((a, b) => a.d - b.d); }
setInterval(() => {
  const ws = Object.values(S.layouts).flat().filter((W) => W.type === 'wstation'); if (!ws.length) return; const c = stnCentre(ws[0]); if (!c) return;
  if (Date.now() - STN.at > (STN.err ? 120000 : 600000) || (STN.c && dist(STN.c[0], STN.c[1], c[0], c[1]) > 15000)) loadStations(c);
}, 5000);
const stnName = (s) => fDist(s.d) + ' ' + COMPASS16[Math.round(s.b / 22.5) % 16];
function wstationWData(W) {
  const c = stnCentre(W); if (!c) return { l: 'Station wind', v: '--', s: 'waiting for GPS' };
  if (!STN.list.length) return { l: 'Station wind (FMI)', v: '--', s: STN.err ? 'not available: ' + STN.err : STN.busy || !STN.at ? 'loading…' : 'no station nearby (FMI covers Finland)' };
  const s = stnSorted(c)[0], age = Math.round((Date.now() - s.t) / 60000);
  return { l: 'Station wind · ' + stnName(s) + (effCfg(W).near === 'start' ? ' of start' : ''), v: fSpd(s.spd), u: S.uSpd, s: (s.gust != null ? 'gust ' + fSpd(s.gust) : '') + (s.dir != null ? ' · from ' + String(Math.round(s.dir)).padStart(3, '0') + '° ' + COMPASS16[Math.round(s.dir / 22.5) % 16] : '') + ' · ' + age + ' min ago', ...(s.gust != null && s.gust >= sN('stnGust', 8) ? { col: '#C62828' } : {}) };
}
function stationsHTML(W) {
  const c = stnCentre(W); if (!c || !STN.list.length) return `<div class="muted">${STN.err ? 'FMI data not available: ' + esc(STN.err) : 'No stations yet.'}</div>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:16px"><tr class="muted"><th align="left">Station</th><th>Wind</th><th>Gust</th><th>From</th><th>Temp</th><th>Age</th></tr>${stnSorted(c).slice(0, 12).map((s) => `<tr style="border-top:1px solid var(--line)"><td>${stnName(s)}</td><td align="center"><b>${fSpd(s.spd)}</b></td><td align="center">${s.gust != null ? fSpd(s.gust) : '--'}</td><td align="center">${s.dir != null ? String(Math.round(s.dir)).padStart(3, '0') + '° ' + COMPASS16[Math.round(s.dir / 22.5) % 16] : '--'}</td><td align="center">${s.temp != null ? s.temp.toFixed(1) + ' °C' : '--'}</td><td align="center">${Math.round((Date.now() - s.t) / 60000)} min</td></tr>`).join('')}</table><div class="muted" style="margin-top:6px">Measured 10-min means from the Finnish Meteorological Institute (open data, CC BY 4.0). Speeds in ${S.uSpd}; stations named by distance and direction from ${effCfg(W).near === 'start' ? 'the Start point' : 'you'}.</div>`;
}
