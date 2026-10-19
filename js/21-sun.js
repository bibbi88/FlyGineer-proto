'use strict';
/* ================= sunset and last light =================
   sunTimes(date, lat, lon): sunrise, sunset (zenith 90.833°) and civil dusk (96°) by the NOAA formulas (accurate to a minute or two; polar day/night
   give null). Widget `sun`: time left to sunset, then to civil dusk ("dark in"), then "after dark"; orange within S.sunWarn min (30) of dusk, red within 10.
   Voice (S.voice and S.vcSun): once at S.sunWarn minutes before dusk and once at 10. Uses your position and the replay clock during a replay. */
function sunTimes(t, lat, lon) {
  const d = new Date(t), y0 = Date.UTC(d.getUTCFullYear(), 0, 0), N = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - y0) / 86400000);
  const calc = (zen, rise) => {
    const lh = lon / 15, T = N + ((rise ? 6 : 18) - lh) / 24, M = 0.9856 * T - 3.289;
    let Ls = wrap360(M + 1.916 * Math.sin(M * D2R) + 0.020 * Math.sin(2 * M * D2R) + 282.634);
    let RA = wrap360(Math.atan(0.91764 * Math.tan(Ls * D2R)) * R2D); RA += Math.floor(Ls / 90) * 90 - Math.floor(RA / 90) * 90; RA /= 15;
    const sd = 0.39782 * Math.sin(Ls * D2R), cd = Math.cos(Math.asin(sd)), ch = (Math.cos(zen * D2R) - sd * Math.sin(lat * D2R)) / (cd * Math.cos(lat * D2R));
    if (ch > 1 || ch < -1) return null; let H = rise ? 360 - Math.acos(ch) * R2D : Math.acos(ch) * R2D; H /= 15;
    let UT = (H + RA - 0.06571 * T - 6.622 - lh) % 24; if (UT < 0) UT += 24;
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + UT * 3600000;
  };
  let set = calc(90.833, false), dusk = calc(96, false), rise = calc(90.833, true);
  // the UTC day can cut the local evening: take the event that lies after the morning of this day
  const fix = (x) => (x != null && rise != null && x < rise ? x + 86400000 : x); set = fix(set); dusk = fix(dusk);
  return { rise, set, dusk };
}
function sunWData(W) {
  const f = st.fix || st.gpsPos; if (!f) return { l: 'Sunset', v: '--', s: 'waiting for GPS' };
  const now = nowT(), S0 = sunTimes(now, f.lat, f.lon), hm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), dur = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); };
  if (S0.set == null) return { l: 'Sunset', v: '--', s: 'no sunset today (midnight sun / polar night)' };
  if (S0.dusk == null) return now < S0.set ? { l: 'Sunset ' + hm(S0.set), v: dur(S0.set - now), s: 'light all night (no civil dusk)' } : { l: 'Sun set ' + hm(S0.set), v: '☀', s: 'light all night (no civil dusk)' };
  const warn = sN('sunWarn', 30) * 60000, left = S0.dusk - now, tint = left <= 600000 ? { bgc: '#C62828', col: '#FFFFFF' } : left <= warn ? { bgc: '#E07B00', col: '#FFFFFF' } : {};
  if (now < S0.set) return { l: 'Sunset ' + hm(S0.set), v: dur(S0.set - now), s: 'dark (civil dusk) ' + hm(S0.dusk) + ' · in ' + dur(left), ...tint };
  if (now < S0.dusk) return { l: 'Dark in · dusk ' + hm(S0.dusk), v: dur(left), s: 'sun set ' + hm(S0.set), ...tint };
  return { l: 'After dark', v: '!', s: 'civil dusk was ' + hm(S0.dusk), bgc: '#C62828', col: '#FFFFFF' };
}
const VSUN = { en: (m) => `${m} minutes to darkness`, sv: (m) => `${m} minuter till mörker`, fi: (m) => `${m} minuuttia pimeään` };
setInterval(() => {
  if (!S.voice || S.vcSun === false || !st.takeoffT) return; const f = st.fix; if (!f) return; const now = nowT(), S0 = sunTimes(now, f.lat, f.lon); if (S0.dusk == null) return;
  const left = (S0.dusk - now) / 60000, day = new Date(now).toDateString();
  [sN('sunWarn', 30), 10].forEach((m) => { const k = day + '|' + m; if (left <= m && left > m - 2 && st.sunSaid !== k && !(st.sunSaidAll || []).includes(k)) { (st.sunSaidAll = st.sunSaidAll || []).push(k); const lg = VSUN[S.voiceLang] ? S.voiceLang : (navigator.language || 'en').slice(0, 2); say((VSUN[lg] || VSUN.en)(Math.round(left))); } });
}, 20000);
