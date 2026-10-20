'use strict';
/* ================= cloud sync: Google Drive, Dropbox, pCloud =================
   S.syncProv 'off' | 'gdrive' | 'dropbox' | 'pcloud'; each needs the owner's own free app registration (client id / app key in S.syncId[prov];
   sign-in return address = oauth.html next to the app). Sign-in opens the provider in a popup that comes back to oauth.html, which posts the answer here.
   Tokens live in localStorage bora.syncTok (never in S, so they are not in settings exports).
   - Google Drive: Google Identity Services token client (scope drive.file, + drive.readonly when the Inbox is on, because drive.file cannot see files you
     add yourself); tokens last an hour and cannot be renewed in the background from a web page: the queue then waits for a tap on "Reconnect".
   - Dropbox: OAuth with PKCE and a refresh token (App folder app: everything stays in Apps/<your app>).
   - pCloud: OAuth token flow (tokens do not expire), API host from the sign-in answer (EU or US).
   Folder layout: FlyGineer/Flights, Route books, Settings, Inbox (Dropbox: the app folder is the FlyGineer folder).
   Uploads go through a queue (localStorage bora.syncQ): flights after landing (S.syncFlights), route books when changed (S.syncRb), a settings backup
   once a day (S.syncSet); retried every minute while online. Inbox (S.syncInbox): new files are imported: .routebook.json, .igc/.gpx (as route books),
   .xctsk (task), .cup (landing fields), settings .json (asks first). Done files are remembered in bora.syncSeen. */
const SYNC = { busy: false, err: '', last: 0, gis: null, inboxAt: 0 };
const SYNC_DIRS = { flight: 'Flights', rb: 'Route books', settings: 'Settings', inbox: 'Inbox' };
const SYNC_NAME = { gdrive: 'Google Drive', dropbox: 'Dropbox', pcloud: 'pCloud' };
const syncRedirect = () => new URL('oauth.html', location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '')).href;
const ls = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
const syncTok = () => ls('bora.syncTok', {}), syncTokSet = (p, t) => { const T = syncTok(); if (t) T[p] = t; else delete T[p]; lsSet('bora.syncTok', T); };
const syncProv = () => (SYNC_NAME[S.syncProv] ? S.syncProv : null);
const syncIdOf = (p) => ((S.syncId || {})[p] || '').trim();
const syncOn = () => { const p = syncProv(); return p && syncTok()[p] ? p : null; };
function syncQ() { return ls('bora.syncQ', []); }
function syncQueue(item) { const Q = syncQ().filter((x) => !(x.type === item.type && x.id === item.id)); Q.push({ ...item, at: Date.now() }); lsSet('bora.syncQ', Q.slice(-200)); setTimeout(syncRun, 1500); }

/* ---- sign-in ---- */
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rnd = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));
function oauthPopup(url) {
  return new Promise((ok, no) => {
    const w = window.open(url, 'flygineerAuth', 'width=520,height=720'); if (!w) { no(new Error('the browser blocked the sign-in window')); return; }
    const done = (href) => { clearInterval(iv); window.removeEventListener('message', onMsg); ok(href); };
    const onMsg = (e) => { if (e.origin === location.origin && e.data && e.data.flygineerOauth) done(e.data.flygineerOauth); };
    window.addEventListener('message', onMsg);
    const iv = setInterval(() => { const r = ls('bora.oauthRet', null); if (r && Date.now() - r.t < 120000) { localStorage.removeItem('bora.oauthRet'); done(r.href); } else if (w.closed) { clearInterval(iv); window.removeEventListener('message', onMsg); no(new Error('sign-in window closed')); } }, 500);
  });
}
const qsOf = (href) => { const u = new URL(href), q = new URLSearchParams(u.search); new URLSearchParams(u.hash.slice(1)).forEach((v, k) => q.set(k, v)); return q; };
async function syncConnect(p) {
  const id = syncIdOf(p); if (!id) throw new Error('enter the ' + (p === 'dropbox' ? 'app key' : 'client ID') + ' first');
  if (p === 'dropbox') {
    const ver = rnd(48), ch = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ver))), state = rnd(12);
    const href = await oauthPopup(`https://www.dropbox.com/oauth2/authorize?client_id=${encodeURIComponent(id)}&response_type=code&code_challenge=${ch}&code_challenge_method=S256&token_access_type=offline&state=${state}&redirect_uri=${encodeURIComponent(syncRedirect())}`);
    const q = qsOf(href); if (q.get('error')) throw new Error(q.get('error_description') || q.get('error')); if (q.get('state') !== state) throw new Error('sign-in answer did not match');
    const r = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', body: new URLSearchParams({ code: q.get('code'), grant_type: 'authorization_code', client_id: id, code_verifier: ver, redirect_uri: syncRedirect() }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error_description || j.error || 'HTTP ' + r.status);
    syncTokSet(p, { at: j.access_token, rt: j.refresh_token, exp: Date.now() + (j.expires_in || 14400) * 1000 - 60000 });
  } else if (p === 'pcloud') {
    const state = rnd(12), href = await oauthPopup(`https://my.pcloud.com/oauth2/authorize?client_id=${encodeURIComponent(id)}&response_type=token&state=${state}&redirect_uri=${encodeURIComponent(syncRedirect())}`);
    const q = qsOf(href); if (q.get('error')) throw new Error(q.get('error')); if (!q.get('access_token')) throw new Error('no token in the answer');
    syncTokSet(p, { at: q.get('access_token'), host: q.get('hostname') || (q.get('locationid') === '2' ? 'eapi.pcloud.com' : 'api.pcloud.com') });
  } else {
    await gisLoad(); const scope = 'https://www.googleapis.com/auth/drive.file' + (S.syncInbox !== false ? ' https://www.googleapis.com/auth/drive.readonly' : '');
    const t = await new Promise((ok, no) => { const c = google.accounts.oauth2.initTokenClient({ client_id: id, scope, callback: (r) => (r.error ? no(new Error(r.error_description || r.error)) : ok(r)), error_callback: (e) => no(new Error(e.message || e.type || 'sign-in failed')) }); c.requestAccessToken({ prompt: syncTok().gdrive ? '' : 'consent' }); });
    syncTokSet(p, { at: t.access_token, exp: Date.now() + (+t.expires_in || 3600) * 1000 - 60000 }); SYNC.dirs = null;
  }
  SYNC.err = ''; toast(SYNC_NAME[p] + ' connected'); try { await P[p].prep(); } catch (e) { SYNC.err = 'folders: ' + (e.message || e); } syncRun(); syncInbox(true);
}
function gisLoad() { return SYNC.gis || (SYNC.gis = new Promise((ok, no) => { if (window.google && google.accounts && google.accounts.oauth2) return ok(); const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => ok(); s.onerror = () => { SYNC.gis = null; no(new Error('could not load Google sign-in (offline?)')); }; document.head.appendChild(s); })); }
// a valid access token, renewed when the provider allows it from here
async function syncToken(p) {
  const T = syncTok()[p]; if (!T) throw new Error('not connected');
  if (p === 'dropbox' && T.exp && Date.now() > T.exp) { const r = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: T.rt, client_id: syncIdOf(p) }) }); const j = await r.json(); if (!r.ok) throw new Error('Dropbox sign-in expired: connect again'); syncTokSet(p, { ...T, at: j.access_token, exp: Date.now() + (j.expires_in || 14400) * 1000 - 60000 }); return j.access_token; }
  if (p === 'gdrive' && T.exp && Date.now() > T.exp) { const e = new Error('Google sign-in expired: tap Reconnect'); e.reauth = true; throw e; }
  return T.at;
}
/* ---- provider calls: put(dir, name, text), list(dir) → [{name, id, mod}], get(entry) → text ---- */
const enc = (o) => JSON.stringify(o).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const P = {
  dropbox: {
    async put(dir, name, text) { const t = await syncToken('dropbox'); const r = await fetch('https://content.dropboxapi.com/2/files/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Dropbox-API-Arg': enc({ path: `/${dir}/${name}`, mode: 'overwrite', mute: true }), 'Content-Type': 'application/octet-stream' }, body: text }); if (!r.ok) throw new Error('Dropbox upload: HTTP ' + r.status); },
    async list(dir) { const t = await syncToken('dropbox'); const r = await fetch('https://api.dropboxapi.com/2/files/list_folder', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/' + dir }) }); if (r.status === 409) return []; if (!r.ok) throw new Error('Dropbox list: HTTP ' + r.status); return (await r.json()).entries.filter((e) => e['.tag'] === 'file').map((e) => ({ name: e.name, id: e.path_lower, mod: e.server_modified + '|' + e.rev })); },
    async prep() { const t = await syncToken('dropbox'); for (const d of Object.values(SYNC_DIRS)) await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/' + d, autorename: false }) }).catch(() => {}); },
    async get(e) { const t = await syncToken('dropbox'); const r = await fetch('https://content.dropboxapi.com/2/files/download', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Dropbox-API-Arg': enc({ path: e.id }) } }); if (!r.ok) throw new Error('Dropbox download: HTTP ' + r.status); return r.text(); },
  },
  pcloud: {
    async call(m, q, body) { const T = syncTok().pcloud; if (!T) throw new Error('not connected'); const u = new URL(`https://${T.host}/${m}`); Object.entries(q || {}).forEach(([k, v]) => u.searchParams.set(k, v)); u.searchParams.set('access_token', T.at); const r = await fetch(u, body ? { method: 'POST', body } : {}); const j = await r.json(); if (j.result && j.result !== 0) { const e = new Error('pCloud: ' + (j.error || 'error ' + j.result)); e.code = j.result; throw e; } return j; },
    async dir(dir) { await this.call('createfolderifnotexists', { path: '/FlyGineer' }); return this.call('createfolderifnotexists', { path: '/FlyGineer/' + dir }); },
    async prep() { for (const d of Object.values(SYNC_DIRS)) await this.dir(d); },
    async put(dir, name, text) { await this.dir(dir); const fd = new FormData(); fd.append('file', new Blob([text]), name); await this.call('uploadfile', { path: '/FlyGineer/' + dir, filename: name, nopartial: 1, renameifexists: 0 }, fd); },
    async list(dir) { try { const j = await this.call('listfolder', { path: '/FlyGineer/' + dir }); return (j.metadata.contents || []).filter((e) => !e.isfolder).map((e) => ({ name: e.name, id: e.fileid, mod: e.modified + '|' + e.hash })); } catch (e) { if (e.code === 2005) return []; throw e; } },
    async get(e) { const j = await this.call('getfilelink', { fileid: e.id }); const r = await fetch('https://' + j.hosts[0] + j.path); if (!r.ok) throw new Error('pCloud download: HTTP ' + r.status); return r.text(); },
  },
  gdrive: {
    async api(url, opt) { const t = await syncToken('gdrive'); const r = await fetch(url, { ...(opt || {}), headers: { Authorization: 'Bearer ' + t, ...((opt && opt.headers) || {}) } }); if (r.status === 401) { const T = syncTok().gdrive; if (T) syncTokSet('gdrive', { ...T, exp: 1 }); const e = new Error('Google sign-in expired: tap Reconnect'); e.reauth = true; throw e; } if (!r.ok) throw new Error('Google Drive: HTTP ' + r.status); return r; },
    async find(name, parent, folder) { const q = [`name = '${name.replace(/'/g, "\\'")}'`, 'trashed = false', parent ? `'${parent}' in parents` : `'root' in parents`]; if (folder) q.push("mimeType = 'application/vnd.google-apps.folder'"); const r = await this.api('https://www.googleapis.com/drive/v3/files?fields=files(id,name)&spaces=drive&q=' + encodeURIComponent(q.join(' and '))); return ((await r.json()).files || [])[0] || null; },
    async folder(name, parent) { const f = await this.find(name, parent, true); if (f) return f.id; const r = await this.api('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parent ? { parents: [parent] } : {}) }) }); return (await r.json()).id; },
    async dir(dir) { const D = SYNC.dirs || (SYNC.dirs = {}); if (D[dir]) return D[dir]; D.root = D.root || (await this.folder('FlyGineer')); D[dir] = await this.folder(dir, D.root); return D[dir]; },
    async prep() { for (const d of Object.values(SYNC_DIRS)) await this.dir(d); },
    async put(dir, name, text) {
      const pid = await this.dir(dir), ex = await this.find(name, pid);
      if (ex) { await this.api(`https://www.googleapis.com/upload/drive/v3/files/${ex.id}?uploadType=media`, { method: 'PATCH', body: text }); return; }
      const b = 'fg' + rnd(8), body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [pid] })}\r\n--${b}\r\nContent-Type: application/octet-stream\r\n\r\n${text}\r\n--${b}--`;
      await this.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body });
    },
    async list(dir) { const pid = await this.dir(dir); const r = await this.api('https://www.googleapis.com/drive/v3/files?fields=files(id,name,modifiedTime,mimeType)&pageSize=100&q=' + encodeURIComponent(`'${pid}' in parents and trashed = false`)); return ((await r.json()).files || []).filter((f) => f.mimeType !== 'application/vnd.google-apps.folder').map((f) => ({ name: f.name, id: f.id, mod: f.modifiedTime })); },
    async get(e) { const r = await this.api(`https://www.googleapis.com/drive/v3/files/${e.id}?alt=media`); return r.text(); },
  },
};
/* ---- the upload queue ---- */
const safeName = (s) => String(s || 'file').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
async function syncItem(p, it) {
  if (it.type === 'flight') { const F = REC.cur && REC.cur.id === it.id ? null : await logGet(it.id); if (!F) return 'skip'; await P[p].put(SYNC_DIRS.flight, igcName(F), igcText(F)); return 'ok'; }
  if (it.type === 'rb') { const B = RB.list.find((b) => b.id === it.id); if (!B) return 'skip'; await P[p].put(SYNC_DIRS.rb, safeName(B.name) + '.routebook.json', JSON.stringify(B)); return 'ok'; }
  if (it.type === 'settings') { const d = new Date(); await P[p].put(SYNC_DIRS.settings, `bora-settings-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`, JSON.stringify(buildExport('all'), null, 1)); S.syncSetAt = Date.now(); save(); return 'ok'; }
  return 'skip';
}
async function syncRun() {
  const p = syncOn(); if (!p || SYNC.busy || !navigator.onLine) return; SYNC.busy = true;
  try { let Q = syncQ(); for (const it of Q.slice()) { await syncItem(p, it); Q = syncQ().filter((x) => !(x.type === it.type && x.id === it.id && x.at === it.at)); lsSet('bora.syncQ', Q); if (it.type === 'flight') toast('Flight uploaded to ' + SYNC_NAME[p]); }
    SYNC.err = ''; SYNC.last = Date.now(); }
  catch (e) { SYNC.err = e.message || String(e); SYNC.reauth = !!e.reauth; } finally { SYNC.busy = false; if (curPage === 'pSet' && typeof setSec !== 'undefined' && setSec === 'sync') renderSettings(); }
}
/* ---- the Inbox: files you put into the cloud folder come into the app ---- */
async function syncInbox(force) {
  const p = syncOn(); if (!p || S.syncInbox === false || !navigator.onLine || SYNC.inBusy) return; if (!force && Date.now() - SYNC.inboxAt < 10 * 60000) return; SYNC.inBusy = true; SYNC.inboxAt = Date.now();
  let n = 0;
  try {
    const seen = ls('bora.syncSeen', {}), files = await P[p].list(SYNC_DIRS.inbox);
    for (const e of files) { const k = p + '|' + e.name; if (seen[k] === e.mod) continue; const txt = await P[p].get(e); const r = syncImport(e.name, txt); seen[k] = e.mod; lsSet('bora.syncSeen', seen); if (r) { n++; toast('From ' + SYNC_NAME[p] + ': ' + r); } }
    SYNC.err = '';
  } catch (e) { SYNC.err = e.message || String(e); SYNC.reauth = !!e.reauth; } finally { SYNC.inBusy = false; }
  return n;
}
function syncImport(name, txt) {
  const nm = name.toLowerCase(), base = name.replace(/\.(routebook\.json|json|igc|gpx|xctsk|cup)$/i, '');
  try {
    if (/\.routebook\.json$/.test(nm) || (/\.json$/.test(nm) && /"notes"\s*:/.test(txt) && /"pts"\s*:/.test(txt))) { const B = JSON.parse(txt); if (!Array.isArray(B.pts)) return null; B.id = 'rb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); RB.list.unshift(B); rbSave(); return 'route book ' + (B.name || base); }
    if (/\.(igc|gpx)$/.test(nm)) { const B = rbFromTrack(txt, base); RB.list.unshift(B); rbSave(); return 'route book from ' + name + ' (' + B.notes.length + ' notes)'; }
    if (/\.xctsk$/.test(nm)) { setCompTask(parseXctsk(txt), base); return 'task ' + base; }
    if (/\.cup$/.test(nm)) { const pts = parseCup(txt).filter((x) => x.land); pts.forEach((x) => { if (!landOwn().some((o) => dist(o.lat, o.lon, x.lat, x.lon) < 100)) landAdd(x.name, x.lat, x.lon, x.el); }); return pts.length + ' landing fields from ' + name; }
    if (/\.json$/.test(nm)) { toast('Settings file in the Inbox: ' + name, [['Import…', () => openImport(txt, name)]]); return null; }
  } catch (err) { toast('Could not import ' + name + ': ' + err.message); }
  return null;
}
// every minute: the queue, the daily settings backup, the Inbox every 10 min
setInterval(() => {
  const p = syncOn(); if (!p) return;
  if (S.syncSet !== false && Date.now() - (S.syncSetAt || 0) > 86400000 && !syncQ().some((x) => x.type === 'settings')) syncQueue({ type: 'settings', id: 'all' });
  syncRun(); syncInbox(false);
}, 60000);
window.addEventListener('online', () => setTimeout(syncRun, 3000));
setTimeout(() => { syncRun(); syncInbox(true); }, 8000);
/* ---- Settings → Cloud sync ---- */
const SYNC_HELP = {
  gdrive: ['Google Cloud Console → new project → APIs & Services: enable the Google Drive API → OAuth consent screen: External, Testing, add your Google account as a test user → Credentials: OAuth client ID, type Web application, Authorised JavaScript origins:', 'Copy the Client ID here.', 'https://console.cloud.google.com/apis/credentials'],
  dropbox: ['Dropbox App Console → Create app → Scoped access, App folder → Permissions: files.content.write and files.content.read (Submit) → Settings: add this Redirect URI:', 'Copy the App key here.', 'https://www.dropbox.com/developers/apps'],
  pcloud: ['pCloud → My applications (docs.pcloud.com) → create an application → Redirect URIs: add', 'Copy the Client ID here.', 'https://docs.pcloud.com/my_apps/'],
};
function syncSecHTML() {
  const p = syncProv(), conn = p && syncTok()[p], Q = syncQ(), H = p && SYNC_HELP[p], origin = location.origin;
  let h = `<div class="card sec"><h2>Cloud sync</h2><div class="muted">Your flights, route books and a settings backup go to a FlyGineer folder in your own cloud storage, and files you put into its <b>Inbox</b> folder (route books, IGC/GPX tracklogs, XCTrack .xctsk tasks, SeeYou .cup fields, settings) come into the app. Each service needs a free app registration in your own account (once, about 10 minutes).</div>
    <div class="field"><span class="k">Sync with</span><span class="row" style="flex-wrap:wrap">${[['off', 'Off'], ['gdrive', 'Google Drive'], ['dropbox', 'Dropbox'], ['pcloud', 'pCloud']].map(([k, n]) => `<button class="pill" data-set="syncProv" data-val="${k}" aria-pressed="${(S.syncProv || 'off') === k}">${n}</button>`).join('')}</span></div>`;
  if (!p) return h + '</div>';
  h += `<div class="muted" style="line-height:1.5"><b>Set up ${SYNC_NAME[p]}:</b> ${H[0]} <code>${esc(p === 'gdrive' ? origin : syncRedirect())}</code>${p === 'gdrive' ? '' : ''} ${H[1]} <a href="${H[2]}" target="_blank" rel="noopener">Open the console</a></div>
    <div class="field"><label for="syncId">${p === 'dropbox' ? 'App key' : 'Client ID'}</label><input type="text" id="syncId" value="${esc(syncIdOf(p))}" placeholder="${p === 'gdrive' ? '1234-abc.apps.googleusercontent.com' : 'paste it here'}" style="flex:1;min-width:220px" autocomplete="off" spellcheck="false"></div>
    <div class="field"><span class="k">Status</span><b style="${SYNC.err ? 'color:var(--restr)' : ''}">${conn ? (SYNC.err ? esc(SYNC.err) : 'connected' + (SYNC.last ? ' · last sync ' + new Date(SYNC.last).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')) : 'not connected'}</b>
      <span class="row">${conn ? `${SYNC.reauth ? '<button class="btn primary" id="syncConn">Reconnect</button>' : ''}<button class="btn" id="syncNow">Sync now</button><button class="btn warn" id="syncOff">Disconnect</button>` : '<button class="btn primary" id="syncConn">Connect</button>'}</span></div>
    ${p === 'gdrive' ? '<div class="muted">Google sign-ins last an hour and a web page cannot renew them in the background: uploads then wait in the queue until you tap Reconnect (a later app version can stay signed in).</div>' : ''}
    ${seg('syncFlights', [[true, 'On'], [false, 'Off']], 'Upload each flight (IGC) after landing')}${seg('syncRb', [[true, 'On'], [false, 'Off']], 'Upload route books when they change')}${seg('syncSet', [[true, 'Daily'], [false, 'Off']], 'Settings backup')}${seg('syncInbox', [[true, 'On'], [false, 'Off']], 'Bring in files from the Inbox folder')}
    <div class="field"><span class="k">Waiting to upload</span><b>${Q.length ? Q.map((x) => x.type === 'flight' ? 'flight' : x.type === 'rb' ? 'route book' : 'settings').join(', ') : 'nothing'}</b>${conn ? `<span class="row"><button class="btn" id="syncAllF">Upload all logbook flights</button><button class="btn" id="syncIn">Check the Inbox</button></span>` : ''}</div></div>`;
  return h;
}
function syncWire(on) {
  const p = syncProv(); if (!p) return;
  on('syncId', 'onchange', (e) => { S.syncId = { ...(S.syncId || {}), [p]: e.target.value.trim() }; save(); });
  on('syncConn', 'onclick', async () => { try { await syncConnect(p); } catch (e) { SYNC.err = e.message || String(e); toast(SYNC_NAME[p] + ': ' + SYNC.err); } renderSettings(); });
  on('syncOff', 'onclick', () => { syncTokSet(p, null); SYNC.err = ''; SYNC.dirs = null; renderSettings(); toast(SYNC_NAME[p] + ' disconnected'); });
  on('syncNow', 'onclick', async () => { await syncRun(); const n = await syncInbox(true); renderSettings(); toast(SYNC.err ? SYNC.err : 'Synced' + (n ? ' · ' + n + ' files in' : '')); });
  on('syncIn', 'onclick', async () => { const n = await syncInbox(true); renderSettings(); toast(SYNC.err ? SYNC.err : n ? n + ' files brought in' : 'Nothing new in the Inbox'); });
  on('syncAllF', 'onclick', () => { REC.list.filter((F) => !F.open).forEach((F) => syncQueue({ type: 'flight', id: F.id })); renderSettings(); });
}
