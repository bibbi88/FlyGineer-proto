'use strict';
/* ================= remote buttons (Bluetooth clickers, page turners, keyboards) =================
   A Bluetooth remote pairs with Android as a keyboard; its presses arrive as key events. S.keys = {code: action}: any BTN action, nextPage / prevPage
   (through the page tabs in order) or sayAlt (speaks height and climb). Keys typed into a text field are left alone. Settings → Remote buttons:
   learn a button (the next key press is captured), pick its action, remove it. Android volume keys normally go to the system, not the browser. */
const KEY_DEF = { ArrowRight: 'nextPage', ArrowLeft: 'prevPage', PageDown: 'nextPage', PageUp: 'prevPage', MediaTrackNext: 'nextPage', MediaTrackPrevious: 'prevPage', MediaPlayPause: 'mute', Enter: 'sayAlt' };
const KEY_EXTRA = { nextPage: 'Next page', prevPage: 'Previous page', sayAlt: 'Speak height and climb' };
const keyMap = () => (S.keys && typeof S.keys === 'object' ? S.keys : KEY_DEF);
const keyActs = () => Object.entries(KEY_EXTRA).concat(Object.entries(BTN).map(([k, v]) => [k, v[0]])).concat([['none', 'Nothing']]);
const keyCode = (e) => e.code && e.code !== 'Unidentified' ? e.code : e.key;
function keyPage(dir) {
  const tabs = [...document.querySelectorAll('#tabs .tab')].filter((b) => b.offsetParent !== null || b.style.display !== 'none').map((b) => b.dataset.page).filter((p) => PAGEKEY[p]);
  if (!tabs.length) return; const i = tabs.indexOf(curPage), n = tabs[(i < 0 ? 0 : i + dir + tabs.length) % tabs.length]; goPage(n); const tb = document.querySelector(`.tab[data-page="${n}"]`); toast(tb ? tb.textContent : n);
}
function keyRun(a) {
  if (a === 'nextPage') return keyPage(1); if (a === 'prevPage') return keyPage(-1);
  if (a === 'sayAlt') { const h = altNow(), v = avgVario(5); say((h != null ? sayAlt(h) : '') + (v != null ? ', ' + sayV(v) : ''), true); return; }
  if (a && a !== 'none') runAction(a);
}
document.addEventListener('keydown', (e) => {
  const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  const k = keyCode(e), m = e.key;
  if (st.keyLearn) { if (m === 'Escape') { st.keyLearn = false; renderSettings(); return; } e.preventDefault(); st.keyLearn = false; const K = { ...keyMap() }; if (!K[k]) K[k] = 'nextPage'; S.keys = K; save(); toast('Button learned: ' + k); renderSettings(); return; }
  if (typing || e.repeat || wEdit) return;
  const M = keyMap(), a = M[k] ?? M[m]; if (!a) return;
  e.preventDefault(); keyRun(a);
}, true);
function keysSecHTML() {
  const M = keyMap();
  return `<div class="card sec"><h2>Remote buttons</h2>
    <div class="muted">Pair a Bluetooth remote (page turner, camera shutter, ring remote, small keyboard) with the tablet in Android's Bluetooth settings; it works as a keyboard. Then give each of its buttons an action here. Android's volume keys usually stay with the system.</div>
    <div class="field"><span class="k">Add a button</span>${st.keyLearn ? '<b style="color:var(--sink)">Press the button on the remote now…</b> <button class="btn" id="keyStop">Cancel</button>' : '<button class="btn primary" id="keyLearn">Learn a button</button>'}</div>
    ${Object.entries(M).map(([k, a]) => `<div class="field"><span class="k"><b>${esc(k)}</b></span><span class="row"><select data-keyset="${esc(k)}" style="min-height:48px;font-size:16px">${keyActs().map(([v, n]) => `<option value="${v}"${v === a ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select><button class="btn warn" data-keydel="${esc(k)}">✕</button></span></div>`).join('')}
    <div class="field"><span class="k"></span><button class="btn" id="keyReset">Default buttons</button></div></div>`;
}
function keysWire(on) {
  on('keyLearn', 'onclick', () => { st.keyLearn = true; renderSettings(); }); on('keyStop', 'onclick', () => { st.keyLearn = false; renderSettings(); });
  on('keyReset', 'onclick', () => { const old = S.keys; S.keys = { ...KEY_DEF }; save(); renderSettings(); toast('Default buttons', [['Undo', () => { S.keys = old; save(); renderSettings(); }]]); });
  document.querySelectorAll('[data-keyset]').forEach((s) => (s.onchange = () => { const K = { ...keyMap() }; K[s.dataset.keyset] = s.value; S.keys = K; save(); }));
  document.querySelectorAll('[data-keydel]').forEach((b) => (b.onclick = () => { const old = { ...keyMap() }, K = { ...old }; delete K[b.dataset.keydel]; S.keys = K; save(); renderSettings(); toast('Button removed', [['Undo', () => { S.keys = old; save(); renderSettings(); }]]); }));
}
