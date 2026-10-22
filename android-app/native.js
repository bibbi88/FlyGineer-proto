'use strict';
/* Android app only (Capacitor; copied into www/ by prepare-www.mjs and loaded after js/31): swaps the browser-only parts for native ones.
   - Bluetooth: the Android WebView has no Web Bluetooth → connectBora through @capacitor-community/bluetooth-le (lib/ble.js, BleClient)
   - Voice: the WebView has no speechSynthesis → say() through @capacitor-community/text-to-speech
   - Downloads (IGC, exports, CSV): blob links do nothing in the WebView → the file is written to the cache and shared (save / send / Drive …)
   - XC Guide traffic: js/31 uses the app's own TcpLine plugin by itself (isNative)
   - Settings → App & offline maps: shows this build (build.json) instead of the service worker parts; no service worker in the app. */
(function () {
  if (!isNative()) return;
  document.body.classList.add('native');
  const P = (n) => Capacitor.registerPlugin(n), TTS = P('TextToSpeech'), FS = P('Filesystem'), SH = P('Share');
  const Ble = window.capacitorCommunityBluetoothLe && capacitorCommunityBluetoothLe.BleClient;
  let BUILD = {}; fetch('build.json').then((r) => r.json()).then((j) => (BUILD = j)).catch(() => { });

  // ---- Bluetooth (Bora vario, Nordic UART) ----
  let bleInit = false, bleDev = null;
  connectBora = async function () {
    if (!Ble) { toast('Bluetooth plugin missing in this build'); return; }
    try {
      if (!bleInit) { await Ble.initialize({ androidNeverForLocation: false }); bleInit = true; }
      const dev = await Ble.requestDevice({ optionalServices: [NUS] }); bleDev = dev.deviceId;
      await Ble.connect(dev.deviceId, () => { st.bora = null; bleDev = null; toast('Bora disconnected'); renderSettings(); });
      const dec = new TextDecoder();
      await Ble.startNotifications(dev.deviceId, NUS, NUS_TX, (v) => {
        bleBuf += dec.decode(v); let m; while ((m = /\r\n|\n|\r/.exec(bleBuf))) { parseLine(bleBuf.slice(0, m.index).trim()); bleBuf = bleBuf.slice(m.index + m[0].length); } if (bleBuf.length > 400) bleBuf = '';
      });
      st.bora = { name: dev.name || 'Bora', batt: null }; toast('Connected to ' + st.bora.name); renderSettings();
    } catch (e) { toast('Bluetooth: ' + (e.message || e)); }
  };

  // ---- voice ----
  say = function (text, force, lang) {
    if ((!S.voice && !force) || !text) return;
    const lg = LANGS[lang || S.voiceLang] || navigator.language || 'en-GB';
    TTS.speak({ text: String(text), lang: lg, rate: clamp(+S.voiceRate || 1, 0.5, 2), volume: clamp((S.voiceVol ?? 100) / 100, 0, 1), pitch: 1, queueStrategy: 1 }).catch(() => { });
  };

  // ---- downloads → share sheet ----
  const aClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!this.download || !/^blob:/.test(this.href)) return aClick.call(this);
    const name = this.download.replace(/[\\/:*?"<>|]+/g, '_');
    fetch(this.href).then((r) => r.text()).then(async (txt) => {
      const w = await FS.writeFile({ path: name, data: txt, directory: 'CACHE', encoding: 'utf8' });
      await SH.share({ title: name, files: [w.uri], dialogTitle: 'Save or send ' + name });
    }).catch((e) => { if (!/cancel/i.test(e.message || '')) toast('Could not share the file: ' + (e.message || e)); });
  };

  // ---- Settings → App ----
  appSection = function () {
    return `<div class="card sec"><h2>Android app</h2>
      <div class="field"><span class="k">This build</span><b>${esc(BUILD.app || '?')} · web version ${esc(BUILD.web || '?')} · ${esc(BUILD.commit || '')}</b></div>
      <div class="field"><span class="k">Built</span><span>${BUILD.built ? new Date(BUILD.built).toLocaleString() : '?'}</span></div>
      <div class="muted">The Android app carries its own copy of FlyGineer and never updates by itself: a new version is built only on request and installed from its APK file. The web version in Chrome keeps updating as before. Settings are separate: use Settings → Export & import to move them between the two.</div>
      <div class="muted">Map tiles are kept only in the app's normal web cache here (no offline map store as in the Chrome version).</div></div>`;
  };
})();
