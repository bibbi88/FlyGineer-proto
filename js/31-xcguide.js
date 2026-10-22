'use strict';
/* ================= XC Guide traffic (2026-10-22) =================
   XC Guide (Android app) collects traffic from OGN, SafeSky, FANET, Livetrack24, OpenSky ADS-B and other live-tracking networks and, with
   Settings → System → Localhost server ("Flarm protocol to XCTrack", port 10110), sends it on as FLARM lines ($PFLAA / $PFLAU) over TCP to
   apps on the same tablet. The lines go through the same parser as the vario's FLARM port (02 flarmLine / 13 flarmU), so the aircraft show
   on the maps, the radar and in the traffic warnings.
   A web page cannot open TCP, only WebSockets: in Chrome a small bridge (Termux: websockify 10111 127.0.0.1:10110) turns it into
   ws://127.0.0.1:10111 (S.xcgUrl). The Android app (Capacitor, android-app/) opens the TCP port itself through its own TcpLine plugin
   (S.xcgPort). S.xcgOn turns it on; reconnects every 5 s; nothing is used during a demo / replay (positions are relative to your own). */
const XCG = { ws: null, sub: [], state: 'off', err: '', lines: 0, at: 0, upAt: 0, t: null, buf: '', gen: 0 };
const isNative = () => !!(window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform());
let tcpPlug = null;
const nativeTcp = () => { if (!isNative()) return null; if (!tcpPlug && Capacitor.registerPlugin) tcpPlug = Capacitor.registerPlugin('TcpLine'); return tcpPlug; };
function xcgLine(l) {
  l = l.trim(); if (!l) return; XCG.lines++; XCG.at = Date.now();
  if (st.replay || st.sim) return; // relative positions: only meaningful around your real position
  if (l.startsWith('$PFLAA')) flarmLine(l); else if (l.startsWith('$PFLAU') && typeof flarmU === 'function') flarmU(l);
}
function xcgData(s) {
  XCG.buf += s; let m; while ((m = /\r\n|\n|\r/.exec(XCG.buf))) { xcgLine(XCG.buf.slice(0, m.index)); XCG.buf = XCG.buf.slice(m.index + m[0].length); }
  if (XCG.buf.length > 2000) XCG.buf = '';
}
function xcgStop() {
  XCG.gen++; clearTimeout(XCG.t); XCG.buf = '';
  if (XCG.ws) { try { XCG.ws.onclose = null; XCG.ws.close(); } catch (e) { } XCG.ws = null; }
  XCG.sub.forEach((h) => { try { h.remove(); } catch (e) { } }); XCG.sub = [];
  const T = nativeTcp(); if (T) T.disconnect().catch(() => { });
  XCG.state = 'off';
}
function xcgRetry(g, err) { if (g !== XCG.gen) return; XCG.state = 'retry'; XCG.err = err || XCG.err; clearTimeout(XCG.t); XCG.t = setTimeout(() => { if (g === XCG.gen) xcgStart(); }, 5000); }
async function xcgStart() {
  xcgStop(); if (!S.xcgOn) return;
  const g = XCG.gen, T = nativeTcp(); XCG.state = 'connecting';
  if (T) { // Android app: straight to XC Guide's TCP port
    try {
      XCG.sub.push(await T.addListener('line', (e) => { if (g === XCG.gen && e && e.line != null) xcgLine(String(e.line)); }));
      XCG.sub.push(await T.addListener('closed', (e) => { if (g === XCG.gen) xcgRetry(g, (e && e.error) || 'closed by XC Guide'); }));
      await T.connect({ host: '127.0.0.1', port: clamp(+S.xcgPort || 10110, 1, 65535) });
      if (g === XCG.gen) { XCG.state = 'up'; XCG.upAt = Date.now(); XCG.err = ''; }
    } catch (e) { xcgRetry(g, e.message || 'cannot connect'); }
    return;
  }
  let ws; try { ws = new WebSocket(S.xcgUrl || 'ws://127.0.0.1:10111'); } catch (e) { XCG.state = 'error'; XCG.err = e.message; return; }
  ws.binaryType = 'arraybuffer'; XCG.ws = ws; const dec = new TextDecoder();
  ws.onopen = () => { if (g === XCG.gen) { XCG.state = 'up'; XCG.upAt = Date.now(); XCG.err = ''; } };
  ws.onmessage = (e) => { if (g === XCG.gen) xcgData(typeof e.data === 'string' ? e.data : dec.decode(e.data, { stream: true })); };
  ws.onerror = () => { XCG.err = 'no bridge at ' + ws.url; };
  ws.onclose = () => xcgRetry(g);
}
// start XC Guide (package indysoft.xc_guide): the Android app through TcpLine.launchApp, Chrome through an intent: link (needs a tap);
// also turns the traffic input on. XC Guide comes to the front: switch back with the recent-apps button.
const XCG_PKG = 'indysoft.xc_guide';
async function xcgLaunch() {
  if (!S.xcgOn) { S.xcgOn = true; save(); xcgStart(); }
  const T = nativeTcp();
  if (T) { try { await T.launchApp({ pkg: XCG_PKG }); toast('XC Guide started · come back with the recent-apps button'); } catch (e) { toast('XC Guide: ' + (e.message || 'not installed')); } return; }
  location.href = 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=' + XCG_PKG + ';end';
}
// [text, ok] for the status rows
function xcgStatus() {
  if (!S.xcgOn) return ['off', undefined];
  if (XCG.state === 'up') {
    const ag = XCG.at ? (Date.now() - XCG.at) / 1000 : null, n = flarmList().length;
    if (st.replay || st.sim) return ['connected · paused during demo / replay', undefined];
    return [ag == null ? 'connected · nothing received yet (XC Guide localhost server on?)' : `connected · ${n} aircraft · last line ${ag.toFixed(0)} s ago${typeof trafficMapNote === 'function' ? trafficMapNote() : ''}`, ag != null && ag < 30];
  }
  if (XCG.state === 'connecting') return ['connecting…', undefined];
  return ['not connected' + (XCG.err ? ': ' + esc(XCG.err) : '') + ' · retrying', false];
}
function xcgSecHTML() {
  const nat = isNative(), [tx, ok] = xcgStatus();
  return `<div class="card sec"><h2>XC Guide traffic</h2>
    <div class="muted">OGN, SafeSky, FANET, Livetrack24, ADS-B and the other networks XC Guide follows, shown here like FLARM traffic (maps, radar, warnings). XC Guide must run on this tablet. Internet traffic is often 10 s or more old: for awareness only, never to see and avoid.</div>
    <div class="field"><span class="k">Use XC Guide traffic</span><span class="row"><button class="pill" data-set="xcgOn" data-val="true" aria-pressed="${!!S.xcgOn}">On</button><button class="pill" data-set="xcgOn" data-val="false" aria-pressed="${!S.xcgOn}">Off</button></span></div>
    ${nat ? `<div class="field"><label for="xcgPort">XC Guide port</label><input type="number" id="xcgPort" value="${esc(String(S.xcgPort || 10110))}" min="1" max="65535" style="max-width:160px"></div>`
      : `<div class="field"><label for="xcgUrl">Bridge address</label><input type="text" id="xcgUrl" value="${esc(S.xcgUrl || 'ws://127.0.0.1:10111')}" spellcheck="false" autocapitalize="off"></div>`}
    <div class="field"><span class="k">Status</span><b id="xcgLive" style="${ok === false ? 'color:var(--restr)' : ''}">${tx}</b></div>
    <div class="field"><span class="k"></span><button class="btn primary" id="xcgGo">▶ Start XC Guide</button></div>
    <div class="muted">Opens XC Guide (and turns this on). Switch back with the recent-apps button. Also as a button widget: Add widget → Buttons → Start XC Guide button. Or let XC Guide start by itself: its Settings → System → Start on boot up + Start Minimized, and set its battery use to Unrestricted so Android does not stop it in flight.</div>
    <h2 style="margin-top:8px">Setting it up</h2>
    <div class="muted"><b>In XC Guide:</b> Settings → System → <b>Localhost server</b> on, “Flarm protocol to XCTrack”, Flarm emulation port <b>10110</b>. Choose the networks you want under Livetracking (OGN, SafeSky, OpenSky ADS-B …). Keep XC Guide running in the background while you fly.</div>
    ${nat ? '<div class="muted"><b>This app</b> connects to port 10110 on the tablet by itself; nothing else is needed.</div>'
      : `<div class="muted"><b>In Chrome</b> a page cannot open the TCP port, so a small bridge is needed (or use the Android app version, which needs none). Install <b>Termux</b> (from F-Droid), then type once:<pre class="raw">pkg install python
pip install websockify</pre>and before each flight:<pre class="raw">websockify 10111 127.0.0.1:10110</pre>Leave Termux running. Chrome may ask once to allow access to devices on your local network: allow it.</div>`}
  </div>`;
}
function xcgWire(on) {
  on('xcgGo', 'onclick', () => xcgLaunch());
  on('xcgUrl', 'onchange', (e) => { S.xcgUrl = e.target.value.trim() || 'ws://127.0.0.1:10111'; save(); xcgStart(); });
  on('xcgPort', 'onchange', (e) => { S.xcgPort = clamp(Math.round(+e.target.value) || 10110, 1, 65535); save(); xcgStart(); });
}
setInterval(() => { const e = $('xcgLive'); if (!e || curPage !== 'pSet') return; const [tx, ok] = xcgStatus(); e.innerHTML = tx; e.style.color = ok === false ? 'var(--restr)' : ''; }, 1000);
if (S.xcgOn) setTimeout(xcgStart, 1500);
