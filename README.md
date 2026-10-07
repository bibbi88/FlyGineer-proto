# FlyGineer-proto

Tablet-first paragliding flight instrument that runs in the browser. A single self-contained page (`index.html`) that works with the Bora vario over Bluetooth.

## Run
Serve it over https (GitHub Pages: Settings → Pages → Deploy from branch `main`, folder `/`). Bluetooth and GPS only work on https. Open it in Chrome on the tablet. Add `?demo` to the address to replay the built-in demo flight.

## Features
- Configurable widget pages (map, thermal, atmosphere, airspace) with export/import of the layout
- Real maps (Leaflet), airspace, NOTAM, places, FlyXC route import, Windy/Flyk pages
- Thermal mode with thermal assistant, side view and automatic actions
- IGC replay/demo
- Optional ADS-B air traffic overlay

## Data and credits
- Air traffic: [adsb.fi open data](https://github.com/adsbfi/opendata), personal non-commercial use only, attribution required (shown on the map).
- Maps: OpenStreetMap, OpenTopoMap, Esri, Carto. Elevation and weather: Open-Meteo.

## Notes
- Flights recorded by this app would not earn XContest points (no signed IGC). Use XCTrack for competition flights.
