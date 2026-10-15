# FlyGineer widgets – defaults

How to use: **bold** = default. To change a default, move the bold (or write the new value). Add notes anywhere (e.g. "→ make this 3 s"). Send the file back and I will apply it.

Size = default size when added, in grid cells (the page is 24 × 16 cells). "On" = pages where the default layout has it.

## Options every widget has
- Show when: **Always** · Thermalling · Stopped thermalling · Towing and after release
- Keep showing after release: **60 s** (0–1800 s, step 10) (only for Show when = Towing)
- Delay before showing: **None** (0–300 s) (not for Always)
- When tapped: **Details** (Heights for Altitude/AGL, Both times for Clock, nothing for Map/Button). Choices: Details · Heights m/ft · Custom info · Both times · Map · Thermal · Atmosphere · Airspace · Planner · Sound on/off · Full screen · Switch display (vario) · Switch m / ft (height) · FAI triangle on/off · Nothing
- When held: **Details** (Heights for Altitude/AGL, nothing for Map/Button; page buttons → Page menu). Choices: Details · Heights m/ft · Custom info · Both times · Page menu · Sound on/off · Full screen · Switch m / ft · FAI on/off · Edit widgets · Map · Thermal · Atmosphere · Airspace · Planner · Nothing
- Custom info shows: **Heights** (any text widgets; only when tap or hold = Custom info)
- Custom info note: **(empty)**
- Text size: **Fit** · S · M · L · XL
- Background: None · 35% · **70%** · Solid
- Title: **Show** · Hide

## Flight data

### Vario · 6×3 · on: Map, Thermal
Climb rate as number, bar or dial; averaging in 0.1 s steps
- Display: **Number** · Bar · Dial
- Bar direction: **Auto** · Vertical · Horizontal
- Averaging: **None** (0–120 s, step 0.1)
- Bar / dial scale: **±3 m/s** · ±5 m/s · ±10 m/s
- Units: **App setting** · m/s · kt · ft/min

### Vario dial · 5×5 · on: –
Needle gauge
- Scale: **±5 m/s** · ±10 m/s
- Average marker: **Off** (0–120 s)

### Vario average · 3×2 · on: Map, Thermal
Averaged climb
- Average over: **30 s** (1–300 s)
- Units: **App setting** · m/s · kt · ft/min

### Altitude · 3×2 · on: Map, Thermal, Atmosphere
Height above sea
- Source: **Vario if connected** · GPS
- Units: **App setting** · m · ft

### AGL · 3×2 · on: Map
Height above ground, from terrain data
- Units: **App setting** · m · ft

### Ground speed · 3×2 · on: Map
From GPS
- Units: **App setting** · km/h · m/s · kt

### Track · 3×2 · on: –
Direction over ground

### Glide ratio · 3×2 · on: Map
Measured on glide
- Average over: **20 s** (5–300 s)

### Required glide · 3×2 · on: –
To next turnpoint

### Wind · 3×2 · on: Map, Thermal
Measured while circling
- Units: **App setting** · km/h · m/s · kt

### Flight time · 3×2 · on: Map
Since takeoff

### Clock · 3×2 · on: –
Local or UTC
- Time zone: **Local** · UTC
- Seconds: **Hide** · Show

### Temperature · 3×2 · on: Atmosphere
From the vario

### Battery · 3×2 · on: –
Vario and tablet

### Landing prediction · 6×2 · on: Map
Filled and empty dot

### Climb history · 6×3 · on: Thermal
Climb and sink bars over time; time span and scale settable
- Time shown: **120 s** (10–3600 s, step 10)
- Scale (top of the bars): **5 m/s** (0.5–20 m/s, step 0.5)

### Cloud base & top · 4×2 · on: –
From the forecast
- Units: **App setting** · m · ft

### Nearest place · 6×2 · on: –
For radio calls
- Places: **All** · Start only · Towns · Airports

### Airspace status · 6×2 · on: –
Nearest airspace

## Task & navigation

### Next turnpoint · 6×3 · on: Map
Distance, bearing, arrival
- Height units: **App setting** · m · ft

### Distance to turnpoint · 3×2 · on: –
Next turnpoint only

### FAI triangle · 6×3 · on: –
FAI calculator: triangle size, shortest leg, way to the FAI sector; tap = on/off
- Also: tap: FAI triangle on/off

### Compass · 4×4 · on: Map, Thermal
Track, north, turnpoint, wind
- Up is: **Track** · North
- Turnpoint marker: **Show** · Hide
- Wind arrow: **Large** · Across the dial · Small · Hide
- Wind arrow colour: **Blue** · Orange · Green · Black
- Wind speed on the arrow: **Show** · Hide

### Wind direction · 4×3 · on: –
Arrow, speed, head/tailwind
- Arrow relative to: **Track** · North
- Units: **App setting** · km/h · m/s · kt

## Thermal

### Thermal average · 3×2 · on: Thermal
Since entering the thermal
- Units: **App setting** · m/s · kt · ft/min

### Thermal gain · 3×2 · on: Thermal
Height gained
- Units: **App setting** · m · ft

### Time in thermal · 3×2 · on: Thermal
Minutes:seconds

### Tow · 8×3 · on: –
Tow launch: time, height gain and average climb; set Show when → Towing
- Height units: **App setting** · m · ft
- Show when: **Towing and after release**

### Thermal assistant · 10×11 · on: Thermal
Heat map of lift around you
- Orientation: **Wind up** · Wind down · North up · Track up
- History: **120 s** (10–600 s, step 10)
- Track: **Trail + heat** · Trail only · Dots + heat · Dots only · Heat only
- Map behind: **Off** · On
- Track line: **Show** · Hide
- Colour scale: **Show** · Hide
- Next turnpoint direction: **Show** · Hide
- Positions: **In the moving air** · Over the ground
- Wind units: **App setting** · km/h · m/s · kt · km/h + m/s
- Scale: **Fixed** · Auto (fit)
- Radius (fixed scale): **200 m** (50–2000 m, step 25)
- Also: Background: 85

### Thermal side view · 6×11 · on: Thermal
Your track and lift seen from the side: upwind ↔ downwind
- History: **180 s** (30–600 s, step 30)
- Scale: **Fixed** · Auto (fit)
- Width each side (fixed): **300 m** (50–3000 m, step 50)
- Height shown (fixed): **400 m** (100–3000 m, step 50)
- Your height in the view: **55 %** (5–95 %, step 5)
- Keep thermals for: **5 min** (1–30 min)
- Extend thermal upwards: **200 m** (0–1000 m, step 50)
- Positions: **Over the ground** · In the moving air

### Thermal front view · 6×11 · on: –
Your track and lift seen from downwind: left ↔ right
- History: **180 s** (30–600 s, step 30)
- Scale: **Fixed** · Auto (fit)
- Width each side (fixed): **300 m** (50–3000 m, step 50)
- Height shown (fixed): **400 m** (100–3000 m, step 50)
- Your height in the view: **55 %** (5–95 %, step 5)
- Keep thermals for: **5 min** (1–30 min)
- Extend thermal upwards: **200 m** (0–1000 m, step 50)
- Positions: **Over the ground** · In the moving air

### Thermal heading view · 6×11 · on: Thermal
Looking the way you fly: track and thermals ahead, left ↔ right
- Look ahead: **1000 m** (200–5000 m, step 100)
- While circling: **Follow heading** · Hold heading
- History: **600 s** (30–600 s, step 30)
- Scale: **Fixed** · Auto (fit)
- Width each side (fixed): **300 m** (50–3000 m, step 50)
- Height shown (fixed): **400 m** (100–3000 m, step 50)
- Your height in the view: **55 %** (5–95 %, step 5)
- Keep thermals for: **5 min** (1–30 min)
- Extend thermal upwards: **200 m** (0–1000 m, step 50)
- Positions: **Over the ground** · In the moving air

### Thermal 3D · 4×11 · on: –
Perspective view: track, lift columns, height layers
- Camera: **Auto** · Behind you · From downwind · From the south
- Looking down: **25 °** (5–70 °, step 5)
- History: **300 s** (30–600 s, step 30)
- Height layers every: **Auto** · 50 m · 100 m · 200 m
- Scale: **Fixed** · Auto (fit)
- Width each side (fixed): **250 m** (50–3000 m, step 50)
- Height shown (fixed): **400 m** (100–3000 m, step 50)

### Thermal heat map · 6×6 · on: Thermal
Lift map from your recent thermalling, with you in it (no track); core marked
- Orientation: **Wind up** · Wind down · North up · Track up
- Colours: **Relative (core stands out)** · Fixed scale (−2…+4 m/s)
- History: **300 s** (30–600 s, step 30)
- Height band (± around you): **100 m** (10–1000 m, step 10)
- Smoothing: **25 m** (5–200 m, step 5)
- Positions: **In the moving air** · Over the ground
- Radius (fixed scale): **150 m** (30–3000 m, step 10)
- Also: Background: Solid

### Thermal layer view · 6×6 · on: –
From above: where the lift was from your height down to 100 m below
- Orientation: **Wind up** · Wind down · North up · Track up
- Layer below you: **100 m** (20–1000 m, step 10)
- Also above you: **0 m** (0–500 m, step 10)
- History: **600 s** (30–600 s, step 30)
- Positions: **In the moving air** · Over the ground
- Radius (fixed scale): **200 m** (50–2000 m, step 25)

### Turn radius · 6×5 · on: Thermal
Last circle, min to max

### Centering · 8×2 · on: Thermal
Distance and direction to the core

## Map & buttons

### Map · 24×16 · on: Map
Moving map: track, task, airspace
- Map style: Topo · **Satellite** · Airspace · Night · Streets
- Orientation: **North up** · Track up · Bearing up
- Rotation smoothing: Off · Low · **Normal** · Strong
- Zoom: Wide · **Normal** · Close · Near · Closer · Very close
- Follow me: **On** · Off
- Back to me after panning: **Never** (0–600 s, step 5)
- Track line: **Plain** · Lift colours · Hide
- Track length: **15 min** (0–600 min, step 5)
- Heading line and landing dots: **Show** · Hide
- Start flag: **Show** · Hide
- Task: **Show** · Hide
- Task colour: **Yellow** · Orange · Magenta · Green · Blue · Black · White
- Task line: **Solid** · Dashed · Dotted
- Task line thickness: **5 px** (1–16 px)
- Line from you to the next turnpoint: **Show** · Hide
- Next turnpoint line colour: **As task** · Yellow · Orange · Magenta · Green · Blue · Black · White
- Next turnpoint line: **Dashed** · Solid · Dotted
- Next turnpoint line thickness: **4 px** (1–16 px)
- Airspace: **Show** · Hide
- NOTAM areas: **Show** · Hide
- Place names: **Hide** · Show
- Air traffic (ADS-B): **Hide** · Show
- Traffic range: **25 km** (5–100 km, step 5)
- Traffic height band ±: **1500 m** (0–5000 m, step 100)
- Glider icon: Small · **Normal** · Large
- On-map buttons: **Show** · Hide
- Also: Background: None, Title: Hide, tap: Nothing

### Button · 4×3 · on: Map, Thermal
Tap to switch mode, page and more
- Action: **Thermal mode on** · Thermal mode off · Toggle thermal mode · Show Map page · Show Thermal page · Show Atmosphere page · Show Airspace page · Show XC planner · Previous page · Centre maps on me · Vario sound on/off · Vario sound on · Vario sound off · Show local and UTC time · Set Start here · Switch Map / Thermal page · Widget titles on/off · Full screen on/off · FAI triangle on/off · Copy task (FlyXC link) · Skip to the next turnpoint · Edit widgets
- Colour: **Orange** · Blue · Dark · Plain
- Also: Background: Solid, Title: Hide, tap: Nothing

## Atmosphere

### Temperature profile · 11×16 · on: Atmosphere
Measured, forecast and parcel
- Height units: **App setting** · m · ft

### Ground temp / dew point · 5×3 · on: Atmosphere
Forecast, 2 m

### Cloud base · 6×4 · on: Atmosphere
From the forecast
- Units: **App setting** · m · ft

### Thermal top · 6×4 · on: Atmosphere
Where the parcel stops
- Units: **App setting** · m · ft

### Outlook · 13×5 · on: Atmosphere
Blue or cumulus day
- Height units: **App setting** · m · ft

### Parcel start · 13×3 · on: Atmosphere
Trigger temperature excess

## Airspace

### Airspace side view · 13×5 · on: Airspace
Along your track
- Look ahead: 10 km · **20 km** · 40 km

### Airspace map · 13×6 · on: Airspace
North up, places and NOTAM
- Map: **Light** · Topo · Satellite · Night
- Radius: **Places radius** · 5 km · 10 km · 20 km · 40 km

### Airspace list · 13×5 · on: Airspace
Nearest airspaces

### Places nearby · 11×7 · on: Airspace
Towns, airports, Start

### Radio · 11×4 · on: Airspace
Frequencies from airspace

### NOTAM · 11×5 · on: Airspace
From ais.fi, tap to read
- Within: 25 km · **50 km** · 100 km

## Default pages (position x,y and size w×h in small steps: page = 96 × 64)

**Map**
- Map 0,0 96×64 – Zoom: Near
- Vario 0,40 9×24 – Text size: L, Title: Hide, Averaging: 1 s, Display: Bar, Bar direction: Vertical, Bar / dial scale: ±5 m/s
- Vario average 87,5 9×8
- Altitude 87,20 9×7 – title "AMSL [m]"
- AGL 87,49 9×7
- Ground speed 87,26 9×8
- Glide ratio 27,55 9×7
- Wind 87,34 9×7
- Next turnpoint 81,41 15×8
- Flight time 0,0 12×7
- Landing prediction 39,56 24×8
- Button 87,56 9×8 – Action: Switch Map / Thermal page
- Vario 9,48 15×16 – Text size: L, Title: Hide, Averaging: 0.6 s, Display: Dial, Bar direction: Vertical, Bar / dial scale: ±5 m/s
- Altitude 87,13 9×7 – title "AMSL [m]"
- Altitude 2,32 9×7 – Units: ft, title "AMSL [ft]"
- Compass 73,49 14×15

**Thermal**
- Thermal assistant 0,0 40×46 – History: 30 s
- Thermal side view 47,1 20×45
- Vario 40,0 7×46 – Display: Bar, Bar direction: Vertical
- Vario average 86,5 10×8
- Thermal average 86,13 10×8
- Thermal gain 86,21 10×8
- Time in thermal 32,46 9×7
- Wind 87,34 9×7
- Centering 86,47 10×9
- Compass 0,46 16×18
- Altitude 87,41 9×7
- Button 85,56 11×8 – Action: Switch Map / Thermal page
- Climb history 59,46 20×8
- Turn radius 16,46 16×18
- Thermal heading view 67,1 19×45
- Thermal heat map 32,46 18×18 – History: 90 s, Height band (± around you): 70 m, Colours: Fixed scale (−2…+4 m/s)

**Atmosphere**
- Temperature profile 0,0 44×64
- Temperature 44,0 16×12
- Ground temp / dew point 60,0 20×12
- Altitude 80,0 16×12
- Cloud base 44,12 24×16
- Thermal top 68,12 28×16
- Outlook 44,28 52×20
- Parcel start 44,48 52×12

**Airspace**
- Airspace side view 0,0 52×20
- Airspace list 0,20 52×20
- Airspace map 0,40 52×24
- Places nearby 52,0 44×28
- Radio 52,28 44×16
- NOTAM 52,44 44×20
