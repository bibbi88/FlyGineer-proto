'use strict';
/* ================= select several widgets while editing (2026-10-21) =================
   Edit bar "☐ Select" (MS.on, body class wmulti): taps pick widgets instead of opening their settings; the first one picked is the
   reference (class manchor, the others msel). The bar #wMultiBar: align left / right / top / bottom with it, same width / height as it,
   row / column = side by side edge to edge from the reference (the others in their left-to-right / top-to-bottom order), Undo (MS.undo,
   one snapshot of the page per step). Dragging a picked widget moves all picked ones together (07 pointer handler, drag.grp). Frozen
   widgets (cfg.lock) are never moved or resized by these. Overlap is not checked here: you asked for that arrangement. */
const MS = { on: false, ids: [], undo: [] };
function msSel() { return MS.ids.map((id) => S.layout.find((w) => w.id === id)).filter(Boolean); }
function msToggle(on) {
  MS.on = on; MS.ids = []; MS.undo = []; document.body.classList.toggle('wmulti', on);
  $('wMulti').setAttribute('aria-pressed', String(on)); $('wMulti').textContent = on ? '☑ Select' : '☐ Select';
  if (on) { $('wSheet').classList.remove('on'); wSel = null; }
  msBar(); renderWidgets();
}
function msTap(W) { const i = MS.ids.indexOf(W.id); if (i >= 0) MS.ids.splice(i, 1); else MS.ids.push(W.id); msBar(); renderWidgets(); }
function msBar() {
  const b = $('wMultiBar'), n = msSel().length; b.classList.toggle('on', MS.on); b.classList.toggle('top', $('wBanner').classList.contains('bottom'));
  $('msInfo').textContent = !n ? 'Tap widgets to pick them' : n === 1 ? '1 picked (the reference) · pick more' : n + ' picked · the first (thick outline) is the reference';
  b.querySelectorAll('[data-ma]').forEach((x) => (x.disabled = x.dataset.ma === 'undo' ? !MS.undo.length : x.dataset.ma === 'none' ? !n : n < 2));
}
function msDo(a) {
  const L0 = S.layout;
  if (a === 'undo') { const s = MS.undo.pop(); if (s) L0.forEach((W) => { if (s[W.id]) [W.x, W.y, W.w, W.h] = s[W.id]; }); saveLayout(); renderWidgets(); msBar(); return; }
  if (a === 'none') { MS.ids = []; msBar(); renderWidgets(); return; }
  const P = msSel(); if (P.length < 2) return; const ref = P[0], mv = P.slice(1).filter((W) => !W.cfg.lock);
  const snap = {}; L0.forEach((W) => (snap[W.id] = [W.x, W.y, W.w, W.h])); MS.undo.push(snap); if (MS.undo.length > 30) MS.undo.shift();
  const fit = (W) => { W.w = clamp(W.w, 6, GC); W.h = clamp(W.h, 4, GR); W.x = clamp(W.x, 0, GC - W.w); W.y = clamp(W.y, 0, GR - W.h); };
  if (a === 'left') mv.forEach((W) => (W.x = ref.x));
  if (a === 'right') mv.forEach((W) => (W.x = ref.x + ref.w - W.w));
  if (a === 'top') mv.forEach((W) => (W.y = ref.y));
  if (a === 'bottom') mv.forEach((W) => (W.y = ref.y + ref.h - W.h));
  if (a === 'sameW') mv.forEach((W) => (W.w = ref.w));
  if (a === 'sameH') mv.forEach((W) => (W.h = ref.h));
  if (a === 'row') { let x = ref.x + ref.w; mv.slice().sort((p, q) => p.x - q.x || p.y - q.y).forEach((W) => { W.x = x; W.y = ref.y; x += W.w; }); }
  if (a === 'col') { let y = ref.y + ref.h; mv.slice().sort((p, q) => p.y - q.y || p.x - q.x).forEach((W) => { W.y = y; W.x = ref.x; y += W.h; }); }
  mv.forEach(fit); saveLayout(); renderWidgets(); msBar();
  if (P.length - 1 > mv.length) toast('Frozen widgets were left where they are');
}
$('wMulti').onclick = () => msToggle(!MS.on);
$('wMultiBar').addEventListener('click', (e) => { const t = e.target.closest('[data-ma]'); if (t && !t.disabled) msDo(t.dataset.ma); if (e.target.closest('#msDone')) msToggle(false); });
