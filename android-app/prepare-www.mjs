// Copies the web app (repo root) into www/ for the Android build: Leaflet from node_modules instead of the CDN (offline without the
// service worker), the Capacitor runtime + plugin scripts, native.js (Bluetooth, voice, TCP, downloads) and build.json.
// Run from android-app/: node prepare-www.mjs   (VERSION_NAME / GITHUB_SHA from the CI build, else from git)
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process';
const ROOT = path.resolve(import.meta.dirname, '..'), WWW = path.join(import.meta.dirname, 'www'), NM = path.join(import.meta.dirname, 'node_modules');
const cp = (from, to) => fs.cpSync(from, to, { recursive: true });
fs.rmSync(WWW, { recursive: true, force: true }); fs.mkdirSync(path.join(WWW, 'lib'), { recursive: true });
for (const f of ['index.html', 'oauth.html', 'manifest.webmanifest', 'css', 'js', 'data', 'icons']) cp(path.join(ROOT, f), path.join(WWW, f)); // sw.js left out on purpose
cp(path.join(NM, 'leaflet/dist/leaflet.js'), path.join(WWW, 'lib/leaflet.js'));
cp(path.join(NM, 'leaflet/dist/leaflet.css'), path.join(WWW, 'lib/leaflet.css'));
cp(path.join(NM, 'leaflet/dist/images'), path.join(WWW, 'lib/images'));
cp(path.join(NM, 'leaflet-rotate/dist/leaflet-rotate.js'), path.join(WWW, 'lib/leaflet-rotate.js'));
cp(path.join(NM, '@capacitor/core/dist/capacitor.js'), path.join(WWW, 'lib/capacitor.js'));
cp(path.join(NM, '@capacitor-community/bluetooth-le/dist/plugin.js'), path.join(WWW, 'lib/ble.js'));
cp(path.join(import.meta.dirname, 'native.js'), path.join(WWW, 'native.js'));
let h = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
const swap = (re, to) => { if (!re.test(h)) throw new Error('index.html: not found ' + re); h = h.replace(re, to); };
swap(/<link rel="stylesheet" href="https:\/\/cdnjs[^"]*leaflet[^"]*\.css">/, '<link rel="stylesheet" href="lib/leaflet.css">');
swap(/<script src="https:\/\/cdnjs[^"]*leaflet[^"]*\.js"><\/script>/, '<script src="lib/leaflet.js"></script>');
swap(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/leaflet-rotate[^"]*"><\/script>/, '<script src="lib/leaflet-rotate.js"></script>');
swap(/<link rel="manifest"[^>]*>\n?/, '');
// before the app: the Capacitor runtime and no service worker (the files are in the app; a worker would keep serving an old copy)
swap(/(<script src="data\/demo-flight\.js"><\/script>)/, '<script>if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error("not used in the Android app"));</script>\n<script src="lib/capacitor.js"></script>\n<script src="lib/ble.js"></script>\n$1');
const last = [...h.matchAll(/<script src="js\/[^"]+"><\/script>/g)].pop(); h = h.slice(0, last.index + last[0].length) + '\n<script src="native.js"></script>' + h.slice(last.index + last[0].length);
fs.writeFileSync(path.join(WWW, 'index.html'), h);
const git = (c) => { try { return execSync('git ' + c, { cwd: ROOT }).toString().trim(); } catch (e) { return ''; } };
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/VERSION = '([^']+)'/);
const info = { app: process.env.VERSION_NAME || 'local build', web: sw ? sw[1] : '', commit: (process.env.GITHUB_SHA || git('rev-parse HEAD')).slice(0, 7), built: new Date().toISOString() };
fs.writeFileSync(path.join(WWW, 'build.json'), JSON.stringify(info));
console.log('www ready:', JSON.stringify(info));
