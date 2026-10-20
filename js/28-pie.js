'use strict';
/* ================= page selector (pie menu) =================
   Widget `pgpie`: press it and the pages appear in a ring around it; slide to one and let go = that page. A tap (let go without leaving the middle)
   keeps the ring up for cfg.keep s (4) so you can tap a page; a tap outside closes it. The ring is centred where you press; near an edge or in a corner it becomes a fan over the open side (pieLayout). Pages = the visible page tabs (cfg.pset 'all', default, also
   Settings) or only widget pages ('widget'). The 07 pointer handler hands the press over (pieOpen) instead of its tap / hold handling. */
const PIE = { el: null, W: null, items: [], cx: 0, cy: 0, hot: -1, mode: null, t: null, id: null };
function piePages(C) {
  const tabs = [...document.querySelectorAll('#tabs .tab')].filter((b) => b.style.display !== 'none').map((b) => [b.dataset.page, b.textContent.trim()]);
  const L0 = C.pset === 'widget' ? tabs.filter(([p]) => PAGEKEY[p]) : tabs.concat([['pSet', 'Settings']]);
  return L0.filter(([p], i) => L0.findIndex((x) => x[0] === p) === i);
}
function pieWData(W) {
  const t = document.querySelector(`.tab[data-page="${curPage}"]`);
  return { l: 'Pages', v: (t ? t.textContent.trim() : curPage === 'pSet' ? 'Settings' : '--'), s: 'hold & slide · or tap', center: true };
}
// where the ring fits: centred on your finger; near an edge or in a corner the pages spread over the widest open arc (a fan away from the
// corner), with the radius grown (and the buttons shrunk down to 64 px) until they fit side by side
function pieLayout(cx, cy, n, sz0) {
  const fits = (a, r, sz) => { const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a), m = sz / 2 + 6; return x >= m && x <= innerWidth - m && y >= m && y <= innerHeight - m; };
  for (let sz = sz0; sz >= 64; sz -= 8) {
    for (let r = sz * 1.45; r <= Math.max(innerWidth, innerHeight); r += 12) {
      const N = 72, ok = []; for (let k = 0; k < N; k++) ok.push(fits((k / N) * 2 * Math.PI, r, sz));
      if (ok.every(Boolean)) { if (r * 2 * Math.PI >= n * (sz + 24)) return { r, sz, a0: -Math.PI / 2, span: 2 * Math.PI, full: true }; continue; }
      let best = 0, bs = 0; for (let k = 0; k < N; k++) { if (!ok[k] || ok[(k + N - 1) % N]) continue; let j = 0; while (j < N && ok[(k + j) % N]) j++; if (j > best) { best = j; bs = k; } } // longest run of free directions
      const span = ((best - 1) / N) * 2 * Math.PI; if (best >= 2 && (n < 2 || r * span >= (n - 1) * (sz + 16))) return { r, sz, a0: (bs / N) * 2 * Math.PI, span, full: false };
    }
  }
  return null;
}
function pieOpen(W, e) {
  pieClose(); const C = effCfg(W), P = piePages(C); if (!P.length) return;
  const n = P.length, cx = clamp(e.clientX, 4, innerWidth - 4), cy = clamp(e.clientY, 4, innerHeight - 4), Lr = pieLayout(cx, cy, n, clamp(+C.isz || 96, 64, 160)); if (!Lr) return;
  PIE.cx = cx; PIE.cy = cy; PIE.W = W; PIE.mode = 'press'; PIE.id = e.pointerId; PIE.hot = -1; PIE.r = Lr.r;
  const step = Lr.full ? (2 * Math.PI) / n : n > 1 ? Lr.span / (n - 1) : 0, a1 = Lr.full ? Lr.a0 : Lr.a0 + (n > 1 ? 0 : Lr.span / 2);
  PIE.tol = Math.max(step * 0.75, 0.45); // slide towards nothing (into the corner): no page
  PIE.items = P.map(([id, name], i) => { const a = a1 + i * step; return { id, name, a, x: cx + Lr.r * Math.cos(a), y: cy + Lr.r * Math.sin(a) }; });
  const el = document.createElement('div'); el.className = 'pie'; el.style.setProperty('--isz', Lr.sz + 'px');
  el.innerHTML = `<div class="pieC" style="left:${cx}px;top:${cy}px">✕</div>` + PIE.items.map((it, i) => `<button class="pieI${it.id === curPage ? ' on' : ''}" data-pi="${i}" style="left:${it.x}px;top:${it.y}px">${esc(it.name)}</button>`).join('');
  el.addEventListener('pointerdown', (ev) => { if (PIE.mode !== 'tap') return; ev.preventDefault(); const b = ev.target.closest('.pieI'); if (b) pieGo(+b.dataset.pi); else pieClose(); });
  document.body.appendChild(el); PIE.el = el;
}
function pieHot(i) { if (PIE.hot === i || !PIE.el) return; PIE.hot = i; PIE.el.querySelectorAll('.pieI').forEach((b, j) => b.classList.toggle('hot', j === i)); }
function piePick(x, y) { // the item in the direction you slid, once you are out of the middle
  const dx = x - PIE.cx, dy = y - PIE.cy; if (Math.hypot(dx, dy) < Math.min(48, PIE.r * 0.4)) return -1;
  const a = Math.atan2(dy, dx); let best = -1, bd = 9; PIE.items.forEach((it, i) => { const d = Math.abs(Math.atan2(Math.sin(a - it.a), Math.cos(a - it.a))); if (d < bd) { bd = d; best = i; } }); return bd <= PIE.tol ? best : -1;
}
function pieGo(i) { const it = PIE.items[i]; pieClose(); if (it) { goPage(it.id); st.tapGuard = Date.now(); } }
function pieClose() { clearTimeout(PIE.t); if (PIE.el) PIE.el.remove(); PIE.el = null; PIE.mode = null; }
addEventListener('pointermove', (e) => { if (PIE.mode !== 'press' || e.pointerId !== PIE.id) return; pieHot(piePick(e.clientX, e.clientY)); }, true);
const pieUp = (e) => {
  if (PIE.mode !== 'press' || e.pointerId !== PIE.id) return; const i = piePick(e.clientX, e.clientY);
  if (i >= 0 && e.type === 'pointerup') return pieGo(i);
  if (e.type === 'pointercancel') return pieClose();
  PIE.mode = 'tap'; pieHot(-1); PIE.t = setTimeout(pieClose, clamp(+effCfg(PIE.W).keep || 4, 1, 30) * 1000); // a tap: stays up a few seconds
};
addEventListener('pointerup', pieUp, true); addEventListener('pointercancel', pieUp, true);
