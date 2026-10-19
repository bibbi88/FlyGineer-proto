'use strict';
/* ================= thermal day forecast, cloud base in flight, hotspots from your own flights =================
   Thermal day (loadDay, Open-Meteo, 2 days hourly at your position, refreshed hourly when a Thermal day widget exists): per hour the thermal top
   = where a parcel S.trig °C warmer than the 2 m temperature, rising dry-adiabatically, meets the forecast temperature profile (as 05 thermalTop),
   capped by the cloud base (elevation + 125 m × spread); strength w* ≈ (g/T · H/(ρ·cp) · depth)^⅓ with the sensible heat H taken as 30 % of the
   sunshine (shortwave radiation) — a rough guide, not a soaring forecast. Usable hour: w* ≥ 1 m/s and top ≥ 600 m above ground, little rain.
   Cloud base in flight (cloudBaseNow): from the vario's temperature at your height and the forecast dew point (lapse 0.8 °C per 100 m spread), else
   the forecast. Hotspots (map option `hot`): climbs found in your logbook flights (flightThermals: ≥ 40 m gain at ≥ 0.6 m/s while turning). */
const DAY_LV = [1000, 925, 850, 800, 700, 600];
async function loadDay() {
  const f = st.fix; if (!f || st.dayBusy) return; st.dayBusy = true; st.dayTry = Date.now();
  const vars = ['temperature_2m', 'dew_point_2m', 'shortwave_radiation', 'cloud_cover', 'precipitation_probability', 'wind_speed_10m', 'wind_direction_10m'].concat(DAY_LV.flatMap((p) => [`temperature_${p}hPa`, `geopotential_height_${p}hPa`]));
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${f.lat.toFixed(2)}&longitude=${f.lon.toFixed(2)}&hourly=${vars.join(',')}&forecast_days=2&timezone=auto&wind_speed_unit=ms`);
    if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(), h = j.hourly, elev = j.elevation, trig = +(S.trig ?? 2);
    const hours = h.time.map((t, i) => {
      const T = h.temperature_2m[i], Td = h.dew_point_2m[i], prof = DAY_LV.map((p) => ({ alt: h[`geopotential_height_${p}hPa`][i], temp: h[`temperature_${p}hPa`][i] })).filter((x) => x.alt != null && x.temp != null && x.alt > elev - 50).sort((a, b) => a.alt - b.alt);
      prof.unshift({ alt: elev + 2, temp: T });
      const env = (a) => { for (let k = 1; k < prof.length; k++) if (a <= prof[k].alt) { const p = prof[k - 1], q = prof[k]; return p.temp + (q.temp - p.temp) * (a - p.alt) / (q.alt - p.alt); } return prof[prof.length - 1].temp; };
      let top = elev; if (T != null) for (let a = elev + 50; a < (prof[prof.length - 1].alt || elev + 4000); a += 25) { if (T + trig - 0.0098 * (a - elev) <= env(a)) break; top = a; }
      const cb = T != null && Td != null ? elev + 125 * (T - Td) : null, cu = cb != null && cb < top, tp = cu ? cb : top, depth = Math.max(0, tp - elev);
      const sw = h.shortwave_radiation[i] || 0, Hs = 0.3 * sw, ws = depth > 50 && Hs > 5 ? Math.cbrt(9.81 / (273.15 + (T ?? 10)) * Hs / 1200 * depth) : 0;
      return { t: new Date(t).getTime(), T, Td, top: tp, cb, cu, depth, w: ws, cc: h.cloud_cover[i], pp: h.precipitation_probability ? h.precipitation_probability[i] : null, wind: h.wind_speed_10m[i], wdir: h.wind_direction_10m[i] };
    });
    st.day = { at: Date.now(), lat: f.lat, lon: f.lon, elev, hours }; markDirty();
  } catch (e) { st.dayErr = e.message; } finally { st.dayBusy = false; }
}
const dayUsable = (x) => x.w >= 1 && x.depth >= 600 && !(x.pp >= 60);
function daySummary() {
  const D = st.day; if (!D) return null; const now = Date.now(), d0 = new Date(now); d0.setHours(0, 0, 0, 0); const today = D.hours.filter((x) => x.t >= d0.getTime() && x.t < d0.getTime() + 86400000);
  const use = today.filter(dayUsable), best = today.reduce((b, x) => (!b || x.w > b.w ? x : b), null), hh = (t) => new Date(t).getHours();
  return { today, use, best, from: use.length ? hh(use[0].t) : null, to: use.length ? hh(use[use.length - 1].t) + 1 : null };
}
function tdayDraw(cv, W, el) {
  const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H); const D = st.day, small = Math.min(Wd, H) < 200;
  if (!D) { c.fillStyle = css('--muted'); c.font = '14px Barlow'; c.textAlign = 'center'; c.fillText(st.fix ? (st.dayErr ? 'Forecast: ' + st.dayErr : 'Loading the forecast…') : 'Waiting for GPS…', Wd / 2, H / 2); return; }
  const now = Date.now(), span = clamp(+W.cfg.hours || 12, 6, 36), t0 = now - 3600000, hrs = D.hours.filter((x) => x.t >= t0 && x.t <= t0 + span * 3600000);
  if (!hrs.length) return; const top = Math.max(1500, ...hrs.map((x) => x.top - D.elev), ...hrs.map((x) => (x.cb || 0) - D.elev)) * 1.1, L0 = small ? 4 : 34, B = small ? 16 : 30, X = (i) => L0 + (i + 0.5) * (Wd - L0 - 4) / hrs.length, bw = Math.max(3, (Wd - L0 - 4) / hrs.length - 3), Y = (agl) => H - B - agl / top * (H - B - (small ? 6 : 18));
  if (!small) { c.strokeStyle = css('--line'); c.fillStyle = css('--muted'); c.font = '11px Barlow'; c.textAlign = 'right'; const stp = niceStep(top / 4); for (let a = stp; a < top; a += stp) { c.beginPath(); c.moveTo(L0, Y(a)); c.lineTo(Wd, Y(a)); c.stroke(); c.fillText(fAlt(a), L0 - 3, Y(a) + 4); } }
  hrs.forEach((x, i) => { const col = x.w >= 2.5 ? css('--climb') : x.w >= 1.5 ? css('--climb2') : x.w >= 1 ? css('--climb3') : '#B0B6BD'; c.fillStyle = col; c.globalAlpha = x.pp >= 60 ? 0.35 : 1; c.fillRect(X(i) - bw / 2, Y(x.depth), bw, Y(0) - Y(x.depth)); c.globalAlpha = 1;
    if (x.cu) { c.fillStyle = '#FFFFFF'; c.strokeStyle = '#6B7280'; c.lineWidth = 1; c.beginPath(); c.ellipse(X(i), Y(x.depth) - 4, bw / 2 + 2, 5, 0, 0, 7); c.fill(); c.stroke(); }
    if (!small || i % 3 === 0) { c.fillStyle = Math.abs(x.t - now) < 1800000 ? css('--ink') : css('--muted'); c.font = `${Math.abs(x.t - now) < 1800000 ? '700 ' : ''}${small ? 10 : 12}px Barlow`; c.textAlign = 'center'; c.fillText(String(new Date(x.t).getHours()), X(i), H - (small ? 3 : 16)); }
    if (!small && bw > 22 && x.w > 0.3) { c.fillStyle = css('--ink'); c.font = '700 11px Barlow Condensed'; c.fillText(x.w.toFixed(1), X(i), Y(x.depth) - (x.cu ? 12 : 4)); } });
  if (!small) { const s = daySummary(); c.fillStyle = css('--muted'); c.font = '12px Barlow'; c.textAlign = 'left'; c.fillText('bars: thermal top above ground · m/s ≈ strength · ☁ = cumulus', L0, H - 2); el && (el._sub = s && s.from != null ? `usable ${s.from}–${s.to} · best ${s.best.w.toFixed(1)} m/s at ${new Date(s.best.t).getHours()}` : 'no usable hours today'); }
}
function dayHTML() {
  const D = st.day; if (!D) return '<div class="muted">No forecast yet.</div>'; const now = Date.now(), A = (m) => fAlt(m) + ' ' + S.uAlt;
  return `<table style="width:100%;border-collapse:collapse;font-size:15px"><tr class="muted"><th align="left">Hour</th><th>Top AGL</th><th>Cloud base</th><th>≈ m/s</th><th>Cloud %</th><th>Rain %</th><th>Wind</th></tr>${D.hours.filter((x) => x.t >= now - 3600000 && x.t < now + 18 * 3600000).map((x) => `<tr style="border-top:1px solid var(--line)${dayUsable(x) ? ';font-weight:700' : ''}"><td>${new Date(x.t).getHours()}:00</td><td align="center">${A(x.depth)}</td><td align="center">${x.cb != null ? A(x.cb) + (x.cu ? ' ☁' : '') : '--'}</td><td align="center">${x.w.toFixed(1)}</td><td align="center">${x.cc ?? '--'}</td><td align="center">${x.pp ?? '--'}</td><td align="center">${x.wind != null ? fSpd(x.wind) + ' ' + COMPASS16[Math.round(x.wdir / 22.5) % 16] : '--'}</td></tr>`).join('')}</table><div class="muted" style="margin-top:6px">Open-Meteo at ${D.lat.toFixed(2)}, ${D.lon.toFixed(2)} (ground ${A(D.elev)}). Bold = usable (≈ 1 m/s or more, top 600 m above ground). The strength is a rough estimate from sunshine and thermal depth.</div>`;
}
// cloud base now: your height + spread / 0.8 °C per 100 m, with the vario's temperature and the forecast dew point at your height
function cloudBaseNow() {
  const D = st.day, fc = st.forecast, a = altNow(); const src = D ? D.hours.reduce((b, x) => (!b || Math.abs(x.t - Date.now()) < Math.abs(b.t - Date.now()) ? x : b), null) : null;
  const Td0 = src ? src.Td : fc ? fc.Td : null, el = D ? D.elev : fc ? fc.elev : null; if (Td0 == null || el == null) return null;
  const T = st.baro && st.baro.temp != null && Date.now() - st.baro.t < 10000 ? st.baro.temp : null;
  if (T != null && a != null) { const Td = Td0 - 0.0018 * (a - el); return { alt: a + Math.max(0, T - Td) / 0.008, src: 'vario' }; }
  const T0 = src ? src.T : fc.T; return { alt: el + 125 * (T0 - Td0), src: 'forecast' };
}
/* hotspots: climbs in a stored flight (points [t, lat, lon, gpsAlt, pressAlt]): 30 s windows climbing ≥ 0.6 m/s with ≥ 270° of turn, merged per climb */
function flightThermals(P) {
  const out = [], A = (p) => p[4] ?? p[3]; let cur = null;
  for (let i = 30; i < P.length; i += 5) { const a = P[i - 30], b = P[i]; if (A(a) == null || A(b) == null) continue; const dt = (b[0] - a[0]) / 1000; if (dt <= 0 || dt > 60) continue; const v = (A(b) - A(a)) / dt;
    let turn = 0; for (let k = i - 28; k <= i; k += 2) { const p0 = P[k - 2], p1 = P[k]; if (!p0 || !p1) continue; const h0 = brg(p0[1], p0[2], p1[1], p1[2]); if (k > i - 28) { const p00 = P[k - 4]; if (p00) turn += angDiff(brg(p00[1], p00[2], p0[1], p0[2]), h0); } }
    if (v >= 0.6 && Math.abs(turn) >= 270) { if (!cur) cur = { t0: a[0], a0: A(a), n: 0, la: 0, lo: 0 }; cur.t1 = b[0]; cur.a1 = A(b); cur.n++; cur.la += b[1]; cur.lo += b[2]; }
    else if (cur) { if (cur.a1 - cur.a0 >= 40) out.push({ lat: +(cur.la / cur.n).toFixed(5), lon: +(cur.lo / cur.n).toFixed(5), v: +((cur.a1 - cur.a0) / ((cur.t1 - cur.t0) / 1000)).toFixed(2), g: Math.round(cur.a1 - cur.a0), a: Math.round(cur.a0) }); cur = null; } }
  if (cur && cur.a1 - cur.a0 >= 40) out.push({ lat: +(cur.la / cur.n).toFixed(5), lon: +(cur.lo / cur.n).toFixed(5), v: +((cur.a1 - cur.a0) / ((cur.t1 - cur.t0) / 1000)).toFixed(2), g: Math.round(cur.a1 - cur.a0), a: Math.round(cur.a0) });
  return out;
}
let HOT = null, hotBusy = false;
async function hotLoad() { if (hotBusy || typeof logAll !== 'function') return; hotBusy = true; try { const all = await logAll(); const H = []; for (const F of all) { if (!F.therms && !F.open) { F.therms = flightThermals(F.pts); await logPut(F); } (F.therms || []).forEach((x) => H.push({ ...x, f: F.id, t: F.t0 })); } HOT = H; st.hotVer = (st.hotVer || 0) + 1; markDirty(); } catch (e) { HOT = []; } finally { hotBusy = false; } }
function drawHotInto(I, C) {
  const on = C.hot === true || C.hot === 'true'; if (!I.g.hot) I.g.hot = L.layerGroup().addTo(I.m); const g = I.g.hot;
  if (!on) { if (I.hotK) { g.clearLayers(); I.hotK = null; } return; }
  if (!HOT) { hotLoad(); return; } const k = st.hotVer + '|' + (st.thermals || []).length; if (I.hotK === k) return; I.hotK = k; g.clearLayers();
  const live = st.replay || st.sim ? [] : (st.thermals || []).filter((q) => q.lat != null).map((q) => ({ lat: q.lat, lon: q.lon, v: q.avg || 0, g: (q.alt1 || 0) - (q.alt0 || 0) }));
  HOT.concat(live).forEach((x) => { const col = x.v >= 2.5 ? '#C2410C' : x.v >= 1.5 ? '#EA7A12' : '#F2C200';
    L.circleMarker([x.lat, x.lon], { radius: clamp(5 + x.v * 3, 6, 16), color: '#fff', weight: 1.5, fillColor: col, fillOpacity: 0.75, interactive: true }).bindTooltip(`${x.v.toFixed(1)} m/s · +${fAlt(x.g)} ${S.uAlt}${x.t ? ' · ' + new Date(x.t).toLocaleDateString() : ' · today'}`).addTo(g); });
}
// refresh: the thermal day once an hour (or after moving 20 km) while a Thermal day widget or the cloud-base option needs it
setInterval(() => {
  if (!st.fix) return; const need = Object.values(S.layouts).some((L0) => L0.some((W) => W.type === 'tday' || W.type === 'cbfly' || (['tside', 'tcross', 'thead'].includes(W.type) && W.cfg.cb !== false && W.cfg.cb !== 'false'))); if (!need) return;
  const D = st.day; if (!D || Date.now() - D.at > 3600000 || dist(D.lat, D.lon, st.fix.lat, st.fix.lon) > 20000) { if (Date.now() - (st.dayTry || 0) > 120000) loadDay(); }
}, 10000);
DRAW.tday = tdayDraw;
['tside', 'tcross', 'thead'].forEach((k) => { if (WT[k] && !WT[k].o.some((o) => o[0] === 'cb')) WT[k].o.push(['cb', 'Cloud base line', [[true, 'Show'], [false, 'Hide']]]); });
