# FlyGineer Android app (Capacitor)

The same FlyGineer as the web version, packed into an Android app. It carries **its own copy** of the web files and
**never updates by itself**: a new version is built only on request.

## Getting a new version (on request)
Push a tag `android-v<N>` (e.g. `android-v2`) on the commit you want; GitHub Actions (`.github/workflows/android.yml`)
builds the APK and attaches it to a release named "FlyGineer Android <N>". On the tablet: open the release page, tap the
`.apk`, allow installing from that source. It installs over the previous one and keeps settings and flights (same key).
Nothing else (pushes to `dev`, the web version's updates) changes the installed app.

## What differs from Chrome
- Bluetooth (Bora): `@capacitor-community/bluetooth-le` (the Android WebView has no Web Bluetooth).
- Voice: `@capacitor-community/text-to-speech` (no speechSynthesis in the WebView).
- XC Guide traffic: straight to XC Guide's TCP port 10110 with the app's own `TcpLine` plugin (no Termux bridge).
- Files (IGC, exports, CSV): written to the cache and offered through the Android share sheet.
- Screen always on, full screen, landscape.
- No service worker: app files are inside the APK; map tiles only in the normal web cache (no offline tile store).
- Settings are separate from Chrome's: move them with Settings → Export & import.
- Not expected to work here: cloud sync sign-in (popup windows).

## Files
- `prepare-www.mjs` copies the web app (repo root) into `www/` with Leaflet from `node_modules`, the Capacitor runtime,
  the BLE plugin script, `native.js` and `build.json` (shown in Settings → App).
- `native.js` the native replacements listed above.
- `android/` the Capacitor Android project; own code in `app/src/main/java/io/github/bibbi88/flygineer/`
  (`MainActivity`, `TcpLinePlugin`); fixed signing key `app/flygineer.keystore` (personal side-loaded app only).

## Local build (needs Android Studio / SDK)
```
cd android-app && npm ci && node prepare-www.mjs && npx cap sync android
cd android && ./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk
```
