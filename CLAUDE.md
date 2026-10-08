# FlyGineer-proto – working notes for Claude

Tablet-first (8", landscape) paragliding flight instrument that runs in the browser, a self-made XCTrack-like app for the owner's **Bora_vario** Bluetooth variometer (https://github.com/bibbi88/Bora_vario). No build step, no framework: plain HTML/CSS/JS, deployed as static files (GitHub Pages, https required for Bluetooth and GPS). Tested on an Android tablet in Chrome.

## Branch rules
- Work on **`dev`**. Commit and push there.
- **Never merge to `main` until the owner explicitly asks.**

## Layout
- `index.html` – markup only, loads the files below in order.
- `css/style.css` – all styles.
- `data/demo-flight.js` – built-in demo flight (real XCTrack flight, delta-encoded). Start with `?demo` or from Settings.
- `js/` – classic scripts, loaded **in this order**, sharing one global scope (top-level `const`/`let`/functions are visible across files). Each file starts with `'use strict'`. Don't reorder; a file may only run top-level code that uses things from earlier files. Functions called later (from events or the main loop) can live anywhere.
  1. `01-core.js` helpers, settings `S` (saved), state `st`, data input
  2. `02-analysis.js` circling/wind/thermal/turn analysis, elevation and glide prediction, Bora over Bluetooth (Nordic UART, `$LK8EX1`), GPS
  3. `03-replay.js` demo simulator, IGC parse/replay (`parseIGC`, `finishIGC`, `demoIGC`, virtual clock `nowT()`), vario sound
  4. `04-map.js` Leaflet map widgets (`mapMount`, `mapDraw`, rotation smoothing, ADS-B traffic overlay)
  5. `05-data-sources.js` airspace, places (Overpass), task/FlyXC, NOTAM, forecast (Open-Meteo)
  6. `06-ui.js` page rendering, events
  7. `07-widgets.js` widget engine: grid, `WT` type table, `COMMON` options, `BTN` button actions, layouts per page, edit sheet (`openSheet`), pointer handling
  8. `08-actions.js` tap actions, detail popups, FlyXC "use this route", Start point, update rate and thermal mode, export/import, automatic actions
  9. `09-main.js` main loop, `boot()`
  10. `10-offline.js` service worker registration, "new version" banner, storage persistence, Settings → App & offline maps
- `sw.js` – service worker: app files cached per `VERSION`, Leaflet/fonts cached, map tiles cached as viewed (cache first, max `MAX_TILES`, oldest out first; fetched with CORS so the quota counts real sizes). Weather, airspace, traffic etc. are never cached.
- `manifest.webmanifest`, `icons/` – installable app (full screen, landscape).

## Releasing a change (PWA)
- **Bump `VERSION` in `sw.js` with every change to app files** (format `YYYY.MM.DD-n`), or installed apps keep the old copy. The tablet then shows "A new version is ready · Reload"; it never reloads by itself.
- New app files must be added to `SHELL` in `sw.js`, or they won't work offline (install fails if a listed file is missing).
- Hosting: GitHub Pages serves the `dev` branch at https://bibbi88.github.io/FlyGineer-proto/.

## Key concepts
- **Widgets**: every element on a page is a widget `{id,type,x,y,w,h,cfg,cfgT?}` on a grid (`GSC=4`, `GC=96`, `GR=64`). Per-page layouts in `S.layouts = {map,thermal,atmos,air}`; `S.layout` is a getter/setter for the current page. Text widgets are produced by `wData(W)`; canvas widgets by the `DRAW` table. `cfgT` holds settings used only while thermalling (`effCfg`/`cfgW`).
- **Adding a widget**: add a `WT` entry (name, description, default size, options), render it in `wData` or `DRAW`, add it to `GROUP` (detail popup) and to `DEFS` if it belongs in a default layout.
- **Button widget**: actions come from `BTN`, run by `runAction`. `pSwitch` toggles Map/Thermal (hold = page menu with all pages); `fullscreen` toggles full screen.
- **Thermal mode**: `updateMode/enterThermal/leaveThermal`, `st.thermMode`; "automatic actions" (`AUTO_EVENTS`, `fireEvent`, `S.autoRules`) run actions on events with optional delay.
- **Conditional visibility** (`VIS`, `visDelay`) and "When tapped" options (`TAPG`, grouped) are in `COMMON` for every widget.
- Settings export/import covers layouts and configuration. Saved layouts from older versions must keep working (add migrations like `S.navBtnMig`, never break stored values).
- Map: Leaflet 1.9.4 + leaflet-rotate 0.2.8 (CDN). Tiles: OpenTopoMap, Esri imagery, Carto, OSM.
- External data: Open-Meteo, Overpass, OpenAIP (optional key or OpenAir file), ais.fi NOTAMs (may need a CORS proxy), FlyXC (route in the link `p=` param), Windy and Flyk embeds, **adsb.fi** open data for air traffic (personal non-commercial use; attribution is shown in the map credit and must stay).

## Testing (no framework yet)
Headless Chromium with Playwright works: `/opt/pw-browsers/chromium`, `playwright` installed globally in the cloud sandbox. The sandbox cannot reach CDNs, so route the Leaflet URLs to local copies (`npm pack leaflet@1.9.4 leaflet-rotate@0.2.8`) and stub or abort other external requests. Useful checks: open `index.html?demo`, no `pageerror`s; tap/hold buttons; open the edit sheet via `enterEdit(); openSheet(id)`; hit-test overlays with real pointer events. jsdom needs many stubs (canvas, layout, `L.Browser.any3d=true`), so prefer Chromium. Headless tests cannot judge how it looks or feels on the tablet; say so honestly.
Run `node --check js/*.js sw.js` after every edit. To test the service worker, route with `context.route` (not `page.route`) and run with `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1`, otherwise the worker's own requests bypass the stubs; stubbed tiles need an `access-control-allow-origin: *` header.

## Product decisions and preferences (from the owner)
- Glove-friendly: large touch targets, no tiny controls. Landscape tablet is the main layout.
- Everything configurable, XCTrack-like: every page, every element a widget, duplicates allowed, small resize steps, blue drag handles on all corners.
- Numeric settings use − / number / + steppers (no preset pills). Option groups should be compact and grouped by function.
- Hamburger menu (top right) opens downward; page tabs auto-hide.
- Flights recorded here would be **unsigned IGC**: XContest accepts them but gives **no points**. The owner uses XCTrack on a separate phone for competition upload. There is no public XContest upload API.

## Known gaps / ideas
- IGC recording and saving from this app is not built yet (would need flight start/stop detection and periodic safety saves; downloading a file is fine).
- Replay bar covers the bottom row of widgets during replay.
- OGN (glider) traffic: no browser-friendly feed found; would need a small relay.
- Unverified: whether adsb.fi allows browser (CORS) requests from the hosted page; Flyk/FlyXC embedding permissions; ais.fi CORS; OpenAIP API details.
