'use strict';
/* ================= one widget on several pages (2026-10-21) =================
   The page selector (pgpie) and button widgets get "Show on pages" in their settings: ticking a page puts a linked copy there (same
   cfg.link id), at the same place, or at the nearest free spot when something is in the way (cfg.linkPos false = keeps its own place).
   linkSync() (from 06 saveLayout) copies options (cfg, cfgT) from the page you are editing to every copy, and the place and size to the
   copies that share it. Unticking a page removes that copy (Undo). Deleting asks first (linkDelete): this page only or all pages, and for a
   page selector a note that the ☰ menu is then the way to change pages. */
const LINKABLE = new Set(['pgpie', 'button']);
const LINK_OWN = new Set(['linkPos', 'overlap']); // per copy, never copied over
function linkPages() { return Object.entries(PAGEKEY).map(([pid, k]) => { const t = document.querySelector(`.tab[data-page="${pid}"]`); return [k, t ? t.textContent.trim() : k]; }).filter(([k], i, a) => a.findIndex((x) => x[0] === k) === i && S.layouts[k]); }
const linkName = (k) => (linkPages().find((p) => p[0] === k) || [k, pageTitle(k)])[1];
function linkCopies(W) { const out = []; if (!W.cfg.link) return out; for (const [k, L] of Object.entries(S.layouts)) L.forEach((o) => { if (o !== W && o.cfg.link === W.cfg.link) out.push([k, o]); }); return out; }
function linkRowHTML(W) {
  if (!LINKABLE.has(W.type)) return ''; const here = pageKey(), on = new Set(linkCopies(W).map(([k]) => k));
  return `<div class="opt"><span class="lbl">Show on pages · the same widget, changes follow on all of them</span><div class="row" style="flex-wrap:wrap">${linkPages().map(([k, n]) => `<button class="pill" data-lkp="${k}" aria-pressed="${k === here || on.has(k)}" ${k === here ? 'disabled' : ''}>${k === here ? '✓ ' : ''}${esc(n)}</button>`).join('')}</div></div>`;
}
function linkToggle(W, k) {
  if (!W.cfg.link) W.cfg.link = 'L' + Date.now().toString(36);
  const L = S.layouts[k], have = L.find((o) => o.cfg.link === W.cfg.link);
  if (have) { S.layouts[k] = L.filter((o) => o !== have); saveLayout(); toast('Removed from ' + linkName(k), [['Undo', () => { S.layouts[k].push(have); saveLayout(); }]]); return; }
  const n = JSON.parse(JSON.stringify(W)); n.id = newW(W.type).id; delete n.cfg.linkPos;
  let note = ''; const c0 = wClash(n, n, L);
  if (c0) { const f = wFreeSpot(n, n.x, n.y, n.w, n.h, L); if (f) { n.x = f.x; n.y = f.y; n.cfg.linkPos = false; note = ' (moved to a free spot there)'; } else { n.cfg.overlap = true; note = ' (on top of ' + WT[c0.type].n + ': no free spot there)'; } }
  L.push(n); saveLayout(); toast(WT[W.type].n + ' added to ' + linkName(k) + note);
}
function linkSync() {
  const here = S.layout; if (!Array.isArray(here)) return;
  here.forEach((W) => { if (!W.cfg.link) return; const own = W.cfg.linkPos !== false;
    linkCopies(W).forEach(([, o]) => {
      const keep = {}; LINK_OWN.forEach((k) => { if (o.cfg[k] !== undefined) keep[k] = o.cfg[k]; });
      const c = JSON.parse(JSON.stringify(W.cfg)); LINK_OWN.forEach((k) => delete c[k]); o.cfg = Object.assign(c, keep);
      if (W.cfgT) o.cfgT = JSON.parse(JSON.stringify(W.cfgT)); else delete o.cfgT; o.type = W.type;
      if (own && o.cfg.linkPos !== false) { o.x = W.x; o.y = W.y; o.w = W.w; o.h = W.h; }
    }); });
}
// deleting: ask (this page or all pages; a page selector also says how to change pages without it)
function linkDelete(W, del) {
  const cp = linkCopies(W), sel = W.type === 'pgpie';
  if (!cp.length && !sel) return del([]);
  $('dlgBody').innerHTML = `<div class="row" style="justify-content:space-between"><span class="num" style="font-size:24px">Delete ${esc(WT[W.type].n)}?</span></div>
    ${sel ? '<div class="muted" style="margin:8px 0">Without a page selector you change pages with the ☰ menu button.</div>' : ''}
    ${cp.length ? `<div class="muted" style="margin:8px 0">It is also on: <b>${cp.map(([k]) => esc(linkName(k))).join(', ')}</b>.</div>` : ''}
    <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:10px">${cp.length ? `<button class="btn warn" id="ldHere">Delete on this page only</button><button class="btn warn" id="ldAll">Delete on all ${cp.length + 1} pages</button>` : '<button class="btn warn" id="ldHere">Delete</button>'}<button class="btn primary" id="ldNo">Cancel</button></div>`;
  $('dlg').style.display = 'flex'; st.tapGuard = Date.now(); const close = () => ($('dlg').style.display = 'none');
  $('ldNo').onclick = close; $('ldHere').onclick = () => { close(); del([]); }; if ($('ldAll')) $('ldAll').onclick = () => { close(); del(cp); };
}
