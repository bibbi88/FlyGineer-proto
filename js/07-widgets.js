'use strict';
/* ================= XCTrack-style widget layout ================= */
const GSC = 4, GC = 24 * GSC, GR = 16 * GSC; // fine grid: quarter-size steps
const U_V = [['', 'App setting'], ['m/s', 'm/s'], ['kt', 'kt'], ['fpm', 'ft/min']], U_A = [['', 'App setting'], ['m', 'm'], ['ft', 'ft']], U_S = [['', 'App setting'], ['km/h', 'km/h'], ['m/s', 'm/s'], ['kt', 'kt']];
const withU = (key, u, fn) => { if (!u) return fn(); const o = S[key]; S[key] = u; try { return fn(); } finally { S[key] = o; } };
const BTN = {
  thermalOn: ['Thermal mode on', 'THERMAL'], thermalOff: ['Thermal mode off', 'GLIDE'], thermalToggle: ['Toggle thermal mode', 'THERMAL'],
  pMap: ['Show Map page', 'MAP'], pThermal: ['Show Thermal page', 'THERMAL PAGE'], pAtmos: ['Show Atmosphere page', 'ATMOSPHERE'], pAir: ['Show Airspace page', 'AIRSPACE'], pPlan: ['Show XC planner', 'PLANNER'], prev: ['Previous page', 'BACK'],
  center: ['Centre maps on me', 'CENTRE'], sound: ['Vario sound on/off', 'SOUND'], mute: ['Mute vario (red while muted)', 'MUTE'], soundOn: ['Vario sound on', 'SOUND ON'], soundOff: ['Vario sound off', 'SOUND OFF'], time: ['Show local and UTC time', 'TIME'], start: ['Set Start here', 'SET START'], pSwitch: ['Switch Map / Thermal page', 'THERMAL'], titles: ['Widget titles on/off', 'TITLES'], fullscreen: ['Full screen on/off', 'FULL SCREEN'], fai: ['FAI triangle on/off', 'FAI'], copyTask: ['Copy task (FlyXC link)', 'COPY TASK'], skipWp: ['Skip to the next turnpoint', 'SKIP TP'], edit: ['Edit widgets', 'EDIT']
};
const WT = {
  vario: { n: 'Vario', d: 'Climb rate as number, bar or dial; averaging in 0.1 s steps', w: 6, h: 3, o: [['mode', 'Display', [['number', 'Number'], ['bar', 'Bar'], ['dial', 'Dial']]], ['barDir', 'Bar direction', [['auto', 'Auto'], ['v', 'Vertical'], ['h', 'Horizontal']]], ['win', 'Averaging', numOpt(0, 120, 0.1, 's', [0, 0.5, 1, 2, 5, 10], { zero: 'None', hint: '0 = no averaging', def: 0, snap: 0.1 })], ['range', 'Bar / dial scale', [[3, '±3 m/s'], [5, '±5 m/s'], [10, '±10 m/s']]], ['units', 'Units', U_V]] },
  varioDial: { n: 'Vario dial', d: 'Needle gauge', w: 5, h: 5, canvas: true, o: [['range', 'Scale', [[5, '±5 m/s'], [10, '±10 m/s']]], ['win', 'Average marker', numOpt(0, 120, 1, 's', [0, 5, 10, 30, 60], { zero: 'Off', hint: '0 = off', def: 0 })]] },
  avg: { n: 'Vario average', d: 'Averaged climb', w: 3, h: 2, o: [['win', 'Average over', numOpt(1, 300, 1, 's', [5, 10, 30, 60, 120], { def: 30 })], ['units', 'Units', U_V]] },
  alt: { n: 'Altitude', d: 'Height above sea', w: 3, h: 2, o: [['src', 'Source', [['auto', 'Vario if connected'], ['gps', 'GPS']]], ['units', 'Units', U_A]] },
  agl: { n: 'AGL', d: 'Height above ground, from terrain data', w: 3, h: 2, o: [['units', 'Units', U_A]] },
  gs: { n: 'Ground speed', d: 'From GPS', w: 3, h: 2, o: [['units', 'Units', U_S]] },
  trk: { n: 'Track', d: 'Direction over ground', w: 3, h: 2, o: [] },
  ld: { n: 'Glide ratio', d: 'Measured on glide', w: 3, h: 2, o: [['win', 'Average over', numOpt(5, 300, 1, 's', [10, 20, 30, 60, 120], { def: 20 })]] },
  reqld: { n: 'Required glide', d: 'To next turnpoint', w: 3, h: 2, o: [] },
  wind: { n: 'Wind', d: 'Measured while circling', w: 3, h: 2, o: [['units', 'Units', U_S]] },
  fai: { n: 'XC flight', d: 'Straight line, out & return or triangle (FAI): distances from the start, progress and what is left; tap = all values, FAI sectors on/off and mode', w: 6, h: 3, def: { tap: 'details', mode: 'auto' }, o: [['mode', 'Mode', XC_MODES], ['away', 'Speed away from the start (line)', [[true, 'Show'], [false, 'Hide']]], ['avg', 'XC average speed', [[true, 'Show'], [false, 'Hide']]]] },
  tow: { n: 'Tow', d: 'Tow launch: time, height gain and average climb; set Show when → Towing', w: 8, h: 3, def: { vis: 'tow', towKeep: 60 }, o: [['units', 'Height units', U_A]] },
  next: { n: 'Next turnpoint', d: 'Distance, bearing, arrival', w: 6, h: 3, o: [['units', 'Height units', U_A]] },
  dist: { n: 'Distance to turnpoint', d: 'Next turnpoint only', w: 3, h: 2, o: [] },
  thermal: { n: 'Thermal average', d: 'Since entering the thermal', w: 3, h: 2, o: [['units', 'Units', U_V]] },
  gain: { n: 'Thermal gain', d: 'Height gained', w: 3, h: 2, o: [['units', 'Units', U_A]] },
  ttime: { n: 'Time in thermal', d: 'Minutes:seconds', w: 3, h: 2, o: [] },
  flight: { n: 'Flight time', d: 'Since takeoff', w: 3, h: 2, o: [] },
  conn: { n: 'Connection & battery', d: 'Vario battery and sensor status; tap for the details (vario, GPS, tablet, internet)', w: 3, h: 2, o: [['look', 'Shows', [['both', 'Vario + tablet battery'], ['bat', 'Vario battery only'], ['dots', 'Vario battery + G B T D']]], ['tab', 'Tablet battery below (single look)', [[true, 'Show'], [false, 'Hide']]]] },
  tclock: { n: 'Time', d: 'Local time (or UTC / flight time); tap: local, UTC, takeoff and flight time', w: 3, h: 2, o: [['show', 'Showing', [['local', 'Local time'], ['utc', 'UTC'], ['flight', 'Flight time']]], ['others', 'The other two below', [[false, 'Hide'], [true, 'Show']]], ['sec', 'Seconds', [[false, 'Hide'], [true, 'Show']]]] },
  time: { n: 'Clock', d: 'Local or UTC', w: 3, h: 2, o: [['zone', 'Time zone', [['local', 'Local'], ['utc', 'UTC']]], ['sec', 'Seconds', [[false, 'Hide'], [true, 'Show']]]] },
  temp: { n: 'Temperature', d: 'From the vario', w: 3, h: 2, o: [] },
  radar: { n: 'Traffic radar', d: 'Air traffic around you (vario FLARM port and adsb.fi), coloured by threat and height', w: 6, h: 6, canvas: true, def: { range: 5, orient: 'track', band: 0, names: true }, o: [['range', 'Range', numOpt(0.5, 50, 0.5, 'km', [], { def: 5 })], ['orient', 'Up is', [['track', 'Track'], ['north', 'North']]], ['band', 'Height band ±', numOpt(0, 5000, 100, 'm', [], { zero: 'All heights', hint: '0 = all heights', def: 0 })], ['names', 'Callsigns', [[true, 'Show'], [false, 'Hide']]]] },
  land: { n: 'Landing', d: 'Nearest landing field you can reach and your arrival height (wind and wing glide); tap: all fields', w: 6, h: 3, o: [] },
  rec: { n: 'Flight recorder', d: 'IGC recording: ● REC and the flight time; tap: logbook', w: 3, h: 2, o: [] },
  baro: { n: 'Pressure', d: 'Air pressure from the vario, hPa', w: 3, h: 2, o: [] },
  battery: { n: 'Battery', d: 'Vario and tablet', w: 3, h: 2, o: [] },
  glide: { n: 'Landing prediction', d: 'Filled and empty dot', w: 6, h: 2, o: [] },
  climb: { n: 'Climb history', d: 'Climb and sink bars over time; time span and scale settable', w: 6, h: 3, canvas: true, o: [['time', 'Time shown', numOpt(10, 3600, 10, 's', [60, 120, 300, 600], { def: 120, hint: 'seconds back' })], ['scale', 'Scale (top of the bars)', numOpt(0.5, 20, 0.5, 'm/s', [3, 5, 8], { def: 5, snap: 0.5, hint: 'sink shown down to 60 %' })]] },
  cloud: { n: 'Cloud base & top', d: 'From the forecast', w: 4, h: 2, o: [['units', 'Units', U_A]] },
  place: { n: 'Nearest place', d: 'For radio calls', w: 6, h: 2, o: [['kind', 'Places', [['any', 'All'], ['start', 'Start only'], ['town', 'Towns'], ['airport', 'Airports']]]] },
  airwarn: { n: 'Airspace warning', d: 'Shows only when needed: inside an airspace, one close at your height, or just under its floor', w: 10, h: 1, def: { showLabel: false, bg: 0, size: 'auto' }, o: [['inside', 'Warn when inside', [[true, 'Yes'], [false, 'No']]], ['near', 'Warn when closer than', numOpt(0, 10000, 100, 'm', [1000, 2000, 5000], { zero: 'App setting', hint: '0 = Settings → Airspace data', def: 0 })], ['under', 'Warn when under the floor by less than', numOpt(0, 1000, 10, 'm', [0, 150, 300], { zero: 'Off', hint: '0 = off', def: 150 })], ['lims', 'Show limits', [[true, 'Show'], [false, 'Hide']]], ['look', 'Look', [['warn', 'Orange frame'], ['solid', 'Red when inside'], ['plain', 'Plain']]], ['idle', 'When nothing to warn about', [['hide', 'Hide'], ['show', 'Show “No airspace warning”']]]] },
  thchip: { n: 'Thermal mode', d: 'THERMAL? when circling is detected (tap to start thermal mode), THERMAL while thermalling (tap: thermal page, hold: leave)', w: 3, h: 1, def: { showLabel: false, bg: 0, size: 'auto' }, o: [['cand', 'Show THERMAL? when circling', [[true, 'Show'], [false, 'Hide']]], ['active', 'Show THERMAL while thermalling', [[true, 'Show'], [false, 'Hide']]], ['idle', 'When gliding', [['hide', 'Hide'], ['show', 'Show GLIDE']]], ['tCand', 'Text when circling', 'TEXT'], ['tOn', 'Text while thermalling', 'TEXT'], ['color', 'Colour', [['orange', 'Orange'], ['blue', 'Blue'], ['dark', 'Dark']]]] },
  air: { n: 'Airspace status', d: 'Nearest airspace', w: 6, h: 2, o: [] },
  airbtn: { n: 'Airspace button', d: 'Compact icon: airspaces near you; tap for the list with radio frequencies', w: 3, h: 2, def: { showLabel: false }, o: [['look', 'Shows', [['count', 'Icon + count'], ['icon', 'Icon only'], ['name', 'Icon + nearest']]], ['radius', 'Nearby within', numOpt(1, 50, 1, 'km', [5, 10, 20], { def: 20 })], ['rows', 'Airspaces in the list', numOpt(3, 50, 1, '', [10, 20, 30], { def: 25 })], ['band', 'List', [['all', 'All nearby'], ['height', 'Only at my height or above me']]], ['radio', 'Radio frequencies', [[true, 'Show'], [false, 'Hide']]]] },
  map: { n: 'Map', d: 'Moving map: track, task, airspace', w: 24, h: 16, canvas: true, def: { layer: S.layer || 'topo', rot: S.rotDefault || 'north', smooth: 'normal', z: 12, follow: true, ret: 0, track: 'plain', trackMin: 15, heading: true, start: true, task: true, air: true, notam: true, places: false, traffic: false, trafficR: 25, trafficA: 1500, gsize: 1, ctl: true, bg: 0, showLabel: false, tap: 'none' }, o: [['layer', 'Map style', [['topo', 'Topo'], ['sat', 'Satellite'], ['light', 'Airspace'], ['night', 'Night'], ['streets', 'Streets']]], ['kk7', 'Thermal map (kk7)', [['off', 'Off'], ['skyways', 'Skyways'], ['thermals', 'Hotspots']]], ['kk7o', 'Thermal map opacity', numOpt(20, 100, 10, '%', [40, 60, 80], { def: 60 })], ['rot', 'Orientation', [['north', 'North up'], ['track', 'Track up'], ['bearing', 'Bearing up']]], ['smooth', 'Rotation smoothing', [['off', 'Off'], ['low', 'Low'], ['normal', 'Normal'], ['strong', 'Strong']]], ['z', 'Zoom', [[10, 'Wide'], [12, 'Normal'], [13, 'Close'], [14, 'Near'], [15, 'Closer'], [16, 'Very close']]], ['follow', 'Follow me', [[true, 'On'], [false, 'Off']]], ['ret', 'Back to me after panning', numOpt(0, 600, 5, 's', [0, 10, 30, 60], { zero: 'Never', hint: '0 = never', def: 0 })], ['track', 'Track line', [['plain', 'Plain'], ['lift', 'Lift colours'], ['off', 'Hide']]], ['trackMin', 'Track length', numOpt(0, 600, 5, 'min', [5, 15, 60, 0], { zero: 'Whole flight', hint: '0 = whole flight', def: 15 })], ['heading', 'Heading line and landing dots', [[true, 'Show'], [false, 'Hide']]], ['start', 'Start flag', [[true, 'Show'], [false, 'Hide']]], ['task', 'Task', [[true, 'Show'], [false, 'Hide']]], ['taskCol', 'Task colour', [['yellow', 'Yellow'], ['orange', 'Orange'], ['magenta', 'Magenta'], ['green', 'Green'], ['blue', 'Blue'], ['black', 'Black'], ['white', 'White']]], ['taskStyle', 'Task line', [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']]], ['taskW', 'Task line thickness', numOpt(1, 16, 1, 'px', [3, 5, 8], { def: 5 })], ['towp', 'Line from you to the next turnpoint', [[true, 'Show'], [false, 'Hide']]], ['towpCol', 'Next turnpoint line colour', [['same', 'As task']].concat([['yellow', 'Yellow'], ['orange', 'Orange'], ['magenta', 'Magenta'], ['green', 'Green'], ['blue', 'Blue'], ['black', 'Black'], ['white', 'White']])], ['towpStyle', 'Next turnpoint line', [['dashed', 'Dashed'], ['solid', 'Solid'], ['dotted', 'Dotted']]], ['towpW', 'Next turnpoint line thickness', numOpt(1, 16, 1, 'px', [2, 4, 6], { def: 4 })], ['home', 'Line back to start', [['fai', 'With the FAI sectors'], ['always', 'Always'], ['off', 'Off']]], ['homeLeg', 'Back-to-start line', [['tri', 'Turnpoint → you → start'], ['start', 'Only you → start']]], ['homeCol', 'Back-to-start line colour', [['green', 'Green'], ['yellow', 'Yellow'], ['orange', 'Orange'], ['magenta', 'Magenta'], ['blue', 'Blue'], ['black', 'Black'], ['white', 'White']]], ['homeStyle', 'Back-to-start line style', [['dashed', 'Dashed'], ['solid', 'Solid'], ['dotted', 'Dotted']]], ['homeW', 'Back-to-start line thickness', numOpt(1, 16, 1, 'px', [2, 3, 5], { def: 3 })], ['homeLab', 'Distance to start on the line', [[true, 'Show'], [false, 'Hide']]], ['air', 'Airspace', [[true, 'Show'], [false, 'Hide']]], ['notam', 'NOTAM areas', [[true, 'Show'], [false, 'Hide']]], ['places', 'Places (airports, towns)', [[false, 'Hide'], [true, 'Show']]], ['plAir', 'Airports', [[true, 'Show'], [false, 'Hide']]], ['plTown', 'Cities and towns', [[true, 'Show'], [false, 'Hide']]], ['plVil', 'Villages', [[false, 'Hide'], [true, 'Show']]], ['plPeak', 'Peaks', [[false, 'Hide'], [true, 'Show']]], ['plSize', 'Place markers', [['m', 'Normal'], ['s', 'Small'], ['l', 'Large']]], ['plLab', 'Place names', [[true, 'Show'], [false, 'Hide']]], ['plEdge', 'Places outside the view: tags around you', [[true, 'Show'], [false, 'Hide']]], ['plEdgeN', 'At most', numOpt(1, 20, 1, '', [3, 6, 10], { def: 6 })], ['plEdgePos', 'Tags for places outside the map', [['edge', 'At the map edge'], ['ring', 'On a ring around you']]], ['plRing', 'Ring: tag distance from you', numOpt(15, 48, 1, '%', [25, 35, 45], { def: 35 })], ['plRel', 'Tapping a place shows', [['me', 'You relative to the place'], ['poi', 'The place relative to you']]], ['reach', 'Glide reach area (where you can glide to, with wind and terrain)', [[false, 'Hide'], [true, 'Show']]], ['reachCol', 'Reach area colour', [['green', 'Green'], ['blue', 'Blue'], ['yellow', 'Yellow'], ['orange', 'Orange'], ['magenta', 'Magenta'], ['black', 'Black'], ['white', 'White']]], ['reachO', 'Reach area fill', numOpt(0, 60, 5, '%', [], { def: 15 })], ['reachStyle', 'Reach area outline', [['dashed', 'Dashed'], ['solid', 'Solid']]], ['lands', 'Landing fields', [[true, 'Show'], [false, 'Hide']]], ['landLine', 'Line to the nearest reachable field', [[true, 'Show'], [false, 'Hide']]], ['traffic', 'Air traffic', [[false, 'Hide'], [true, 'Show']]], ['trafficSrc', 'Traffic from', [['both', 'Internet + vario'], ['net', 'Internet (adsb.fi)'], ['vario', 'Vario only (FLARM port)']]], ['trafficR', 'Traffic range', numOpt(5, 100, 5, 'km', [], { def: 25 })], ['trafficA', 'Traffic height band ±', numOpt(0, 5000, 100, 'm', [], { zero: 'All heights', hint: '0 = all heights', def: 1500 })], ['gsize', 'Glider icon', [[0.8, 'Small'], [1, 'Normal'], [1.35, 'Large']]], ['ctl', 'On-map buttons', [[true, 'Show'], [false, 'Hide']]], ['btnSz', 'On-map button size', numOpt(36, 120, 4, 'px', [44, 56, 72], { def: 56 })], ['me', 'Your position on the map, from the bottom', numOpt(0, 95, 5, '%', [20, 50, 75], { zero: 'Auto', hint: '0 = auto: middle north up, low track up; type any %', def: 0, snap: 1 })], ['ptr', 'Pointer when you move the map', [[true, 'Show'], [false, 'Hide']]], ['windA', 'Wind arrow at you', [[true, 'Show'], [false, 'Hide']]], ['windAShape', 'Wind arrow shape', [['wind', 'Like the Wind widget'], ['arrow', 'Arrow'], ['chevron', 'Chevron'], ['tail', 'Arrow with tail']]], ['windAS', 'Wind arrow size', numOpt(10, 80, 2, 'px', [16, 22, 32], { def: 22 })], ['windAD', 'Wind arrow distance from you', numOpt(0, 160, 2, 'px', [0, 46, 80], { def: 46 })], ['windAC', 'Wind arrow colour', [['blue', 'Blue'], ['cyan', 'Cyan'], ['white', 'White'], ['black', 'Black'], ['orange', 'Orange'], ['magenta', 'Magenta'], ['green', 'Green']]], ['windAO', 'Wind arrow opacity', numOpt(20, 100, 10, '%', [50, 80, 100], { def: 100 })], ['windAT', 'Wind arrow label', [['spd', 'Speed'], ['spddir', 'Speed, unit and direction'], ['none', 'None']]]] },
  button: { n: 'Button', d: 'Tap to switch mode, page and more', w: 4, h: 3, def: { action: 'thermalOn', color: 'orange', bg: 100, showLabel: false, tap: 'none' }, o: [['action', 'Action', Object.entries(BTN).map(([k, v]) => [k, v[0]])], ['color', 'Colour', [['orange', 'Orange'], ['blue', 'Blue'], ['dark', 'Dark'], ['plain', 'Plain']]]] },
  ta: { n: 'Thermal assistant', d: 'Heat map of lift around you', w: 10, h: 11, canvas: true, def: { orient: S.taOrient || 'wind', hist: 120, style: 'trail', bgMap: false, trail: true, legend: true, zoom: 1, bg: 85 }, o: [['orient', 'Orientation', [['wind', 'Wind up'], ['winddown', 'Wind down'], ['north', 'North up'], ['track', 'Track up']]], ['hist', 'History', numOpt(10, 600, 10, 's', [30, 60, 120, 300], { def: 120, extra: [['thermal', 'This thermal'], ['circle', 'Last circle']] })], ['style', 'Track', [['trail', 'Trail + heat'], ['trailonly', 'Trail only'], ['both', 'Dots + heat'], ['dots', 'Dots only'], ['heat', 'Heat only']]], ['ideal', 'Ideal circle', [[true, 'Show'], [false, 'Hide']]], ['taper', 'Older track', [['on', 'Thinner and fainter'], ['off', 'Same width']]], ['bgMap', 'Map behind', [[false, 'Off'], [true, 'On']]], ['trail', 'Track line', [[true, 'Show'], [false, 'Hide']]], ['legend', 'Colour scale', [[true, 'Show'], [false, 'Hide']]], ['tp', 'Next turnpoint direction', [[true, 'Show'], [false, 'Hide']]], ['frame', 'Positions', [['air', 'In the moving air'], ['ground', 'Over the ground']]], ['units', 'Wind units', U_S.concat([['kmh+ms', 'km/h + m/s']])], ['scale', 'Scale', [['fixed', 'Fixed'], ['auto', 'Auto (fit)']]], ['range', 'Radius (fixed scale)', numOpt(50, 2000, 25, 'm', [100, 200, 400], { def: 200 })]] },
  tside: { n: 'Thermal side view', d: 'Your track and lift seen from the side: upwind ↔ downwind', w: 6, h: 11, canvas: true, def: { hist: 180 }, o: [['hist', 'History', numOpt(30, 600, 30, 's', [60, 120, 180, 300, 600], { def: 180 })], ['scale', 'Scale', [['fixed', 'Fixed'], ['auto', 'Auto (fit)']]], ['range', 'Width each side (fixed)', numOpt(50, 3000, 50, 'm', [200, 300, 500], { def: 300 })], ['vspan', 'Height shown (fixed)', numOpt(100, 3000, 50, 'm', [300, 400, 600], { def: 400 })], ['ypos', 'Your height in the view', numOpt(5, 95, 5, '%', [30, 55, 75], { def: 55, hint: 'from the bottom' })], ['keep', 'Keep thermals for', numOpt(1, 30, 1, 'min', [3, 5, 10], { def: 5 })], ['ext', 'Extend thermal upwards', numOpt(0, 1000, 50, 'm', [0, 100, 200, 300], { def: 200 })], ['axTurn', 'Turn with the wind after', numOpt(0, 90, 1, '°', [10, 30, 45], { def: 10, zero: 'Always follow', hint: 'change in wind direction · 0 = follow it all the time' })], ['axTherm', 'Turn during a thermal', [[true, 'Yes'], [false, 'No']]], ['frame', 'Positions', [['ground', 'Over the ground'], ['air', 'In the moving air']]]] },
  t3d: { n: 'Thermal 3D', d: 'Perspective view: track, lift columns, height layers', w: 4, h: 11, canvas: true, def: { cam: 'auto', tilt: 25, hist: 300, layers: 'auto', zoom: 1, yaw: 0 }, o: [['cam', 'Camera', [['auto', 'Auto'], ['behind', 'Behind you'], ['downwind', 'From downwind'], ['north', 'From the south']]], ['tilt', 'Looking down', numOpt(5, 70, 5, '°', [15, 25, 35, 45], { def: 25 })], ['hist', 'History', numOpt(30, 600, 30, 's', [60, 120, 180, 300, 600], { def: 300 })], ['layers', 'Height layers every', [['auto', 'Auto'], [50, '50 m'], [100, '100 m'], [200, '200 m']]], ['scale', 'Scale', [['fixed', 'Fixed'], ['auto', 'Auto (fit)']]], ['range', 'Width each side (fixed)', numOpt(50, 3000, 50, 'm', [150, 250, 400], { def: 250 })], ['vspan', 'Height shown (fixed)', numOpt(100, 3000, 50, 'm', [300, 400, 600], { def: 400 })]] },
  theat: { n: 'Thermal heat map', d: 'Lift map from your recent thermalling, with you in it (no track); core marked', w: 6, h: 6, canvas: true, def: { orient: 'wind', hist: 300, depth: 100, blur: 25, range: 150, zoom: 1, colors: 'rel', bg: 100 }, o: [['orient', 'Orientation', [['wind', 'Wind up'], ['winddown', 'Wind down'], ['north', 'North up'], ['track', 'Track up']]], ['colors', 'Colours', [['rel', 'Relative (core stands out)'], ['fixed', 'Fixed scale (−2…+4 m/s)']]], ['hist', 'History', numOpt(30, 600, 30, 's', [120, 300, 600], { def: 300 })], ['depth', 'Height band (± around you)', numOpt(10, 1000, 10, 'm', [50, 100, 200], { def: 100 })], ['blur', 'Smoothing', numOpt(5, 200, 5, 'm', [15, 25, 40], { def: 25 })], ['frame', 'Positions', [['air', 'In the moving air'], ['ground', 'Over the ground']]], ['range', 'Radius (fixed scale)', numOpt(30, 3000, 10, 'm', [100, 150, 300], { def: 150 })]] },
  tlayer: { n: 'Thermal layer view', d: 'From above: where the lift was from your height down to 100 m below', w: 6, h: 6, canvas: true, def: { orient: 'wind', depth: 100, above: 0, hist: 600, range: 200, zoom: 1 }, o: [['orient', 'Orientation', [['wind', 'Wind up'], ['winddown', 'Wind down'], ['north', 'North up'], ['track', 'Track up']]], ['depth', 'Layer below you', numOpt(20, 1000, 10, 'm', [50, 100, 200, 300], { def: 100 })], ['above', 'Also above you', numOpt(0, 500, 10, 'm', [0, 20, 50], { def: 0 })], ['hist', 'History', numOpt(30, 600, 30, 's', [120, 300, 600], { def: 600 })], ['frame', 'Positions', [['air', 'In the moving air'], ['ground', 'Over the ground']]], ['range', 'Radius (fixed scale)', numOpt(50, 2000, 25, 'm', [100, 200, 400], { def: 200 })]] },
  tcross: { n: 'Thermal front view', d: 'Your track and lift seen from downwind: left ↔ right', w: 6, h: 11, canvas: true, def: { hist: 180 }, o: [['hist', 'History', numOpt(30, 600, 30, 's', [60, 120, 180, 300, 600], { def: 180 })], ['scale', 'Scale', [['fixed', 'Fixed'], ['auto', 'Auto (fit)']]], ['range', 'Width each side (fixed)', numOpt(50, 3000, 50, 'm', [200, 300, 500], { def: 300 })], ['vspan', 'Height shown (fixed)', numOpt(100, 3000, 50, 'm', [300, 400, 600], { def: 400 })], ['ypos', 'Your height in the view', numOpt(5, 95, 5, '%', [30, 55, 75], { def: 55, hint: 'from the bottom' })], ['keep', 'Keep thermals for', numOpt(1, 30, 1, 'min', [3, 5, 10], { def: 5 })], ['ext', 'Extend thermal upwards', numOpt(0, 1000, 50, 'm', [0, 100, 200, 300], { def: 200 })], ['axTurn', 'Turn with the wind after', numOpt(0, 90, 1, '°', [10, 30, 45], { def: 10, zero: 'Always follow', hint: 'change in wind direction · 0 = follow it all the time' })], ['axTherm', 'Turn during a thermal', [[true, 'Yes'], [false, 'No']]], ['frame', 'Positions', [['ground', 'Over the ground'], ['air', 'In the moving air']]]] },
  thead: { n: 'Thermal heading view', d: 'Looking the way you fly: track and thermals ahead, left ↔ right', w: 6, h: 11, canvas: true, def: { hist: 600, ahead: 1000, hold: false }, o: [['ahead', 'Look ahead', numOpt(200, 5000, 100, 'm', [500, 1000, 2000], { def: 1000 })], ['hold', 'While circling', [[false, 'Follow heading'], [true, 'Hold heading']]], ['hist', 'History', numOpt(30, 600, 30, 's', [180, 300, 600], { def: 600 })], ['scale', 'Scale', [['fixed', 'Fixed'], ['auto', 'Auto (fit)']]], ['range', 'Width each side (fixed)', numOpt(50, 3000, 50, 'm', [200, 300, 500], { def: 300 })], ['vspan', 'Height shown (fixed)', numOpt(100, 3000, 50, 'm', [300, 400, 600], { def: 400 })], ['ypos', 'Your height in the view', numOpt(5, 95, 5, '%', [30, 55, 75], { def: 55, hint: 'from the bottom' })], ['keep', 'Keep thermals for', numOpt(1, 30, 1, 'min', [3, 5, 10], { def: 5 })], ['ext', 'Extend thermal upwards', numOpt(0, 1000, 50, 'm', [0, 100, 200, 300], { def: 200 })], ['frame', 'Positions', [['ground', 'Over the ground'], ['air', 'In the moving air']]]] },
  turn: { n: 'Turn radius', d: 'Last circle, min to max', w: 6, h: 5, canvas: true, o: [] },
  core: { n: 'Centering', d: 'Distance and direction to the core', w: 8, h: 2, o: [] },
  compass: { n: 'Compass', d: 'Track, north, turnpoint, wind', w: 4, h: 4, canvas: true, o: [['mode', 'Up is', [['heading', 'Track'], ['north', 'North']]], ['tp', 'Turnpoint marker', [[true, 'Show'], [false, 'Hide']]], ['windm', 'Wind arrow', [['large', 'Large'], ['across', 'Across the dial'], ['small', 'Small'], [false, 'Hide']]], ['windc', 'Wind arrow colour', [['blue', 'Blue'], ['orange', 'Orange'], ['green', 'Green'], ['dark', 'Black']]], ['winds', 'Wind speed on the arrow', [[true, 'Show'], [false, 'Hide']]], ['windsz', 'Wind speed size', numOpt(50, 300, 10, '%', [100, 150, 200], { def: 150 })], ['windu', 'Wind speed unit', [[false, 'Hide'], [true, 'Show'], ['both', 'km/h and m/s']]]] },
  windDir: { n: 'Wind direction', d: 'Arrow, speed, head/tailwind', w: 4, h: 3, canvas: true, o: [['mode', 'Arrow relative to', [['heading', 'Track'], ['north', 'North']]], ['units', 'Units', U_S]] },
  profile: { n: 'Temperature profile', d: 'Measured, forecast and parcel', w: 11, h: 16, canvas: true, o: [['units', 'Height units', U_A]] },
  groundT: { n: 'Ground temp / dew point', d: 'Forecast, 2 m', w: 5, h: 3, o: [] },
  cbase: { n: 'Cloud base', d: 'From the forecast', w: 6, h: 4, o: [['units', 'Units', U_A]] },
  ttop: { n: 'Thermal top', d: 'Where the parcel stops', w: 6, h: 4, o: [['units', 'Units', U_A]] },
  outlook: { n: 'Outlook', d: 'Blue or cumulus day', w: 13, h: 5, o: [['units', 'Height units', U_A]] },
  trigger: { n: 'Parcel start', d: 'Trigger temperature excess', w: 13, h: 3, o: [] },
  asside: { n: 'Airspace side view', d: 'Along your track', w: 13, h: 5, canvas: true, def: { range: 20 }, o: [['range', 'Look ahead', [[10, '10 km'], [20, '20 km'], [40, '40 km']]]] },
  asmap: { n: 'Airspace map', d: 'North up, places and NOTAM', w: 13, h: 6, canvas: true, def: { map: 'light', radius: 0 }, o: [['map', 'Map', [['light', 'Light'], ['topo', 'Topo'], ['sat', 'Satellite'], ['night', 'Night']]], ['radius', 'Radius', [[0, 'Places radius'], [5, '5 km'], [10, '10 km'], [20, '20 km'], [40, '40 km']]]] },
  aslist: { n: 'Airspace list', d: 'Nearest airspaces', w: 13, h: 5, o: [] },
  places: { n: 'Places nearby', d: 'Towns, airports, Start', w: 11, h: 7, o: [] },
  radio: { n: 'Radio', d: 'Frequencies from airspace', w: 11, h: 4, o: [] },
  radiomsg: { n: 'Radio message', d: 'The frequency to use and your position call relative to the nearest place; tap to hear it or change the place', w: 14, h: 4, def: { tap: 'radiopoi' }, o: [['ref', 'Relative to', [['near', 'Nearest town or airport'], ['airport', 'Nearest airport'], ['town', 'Nearest town'], ['start', 'Start']]], ['freq', 'Frequency', [[true, 'Show'], [false, 'Hide']]]] },
  notams: { n: 'NOTAM', d: 'From ais.fi, tap to read', w: 11, h: 5, def: { radius: 50 }, o: [['radius', 'Within', [[25, '25 km'], [50, '50 km'], [100, '100 km']]]] }
};
// airplane seen from above, nose up (Airspace button)
const PLANE_PATH = '<path d="M16 2.5c1.3 0 2.2 1.2 2.2 2.8v7.2l10.3 6.2v3l-10.3-3.1v6.1l3.3 2.5v2.3L16 28.3l-5.5 1.2v-2.3l3.3-2.5v-6.1L3.5 21.7v-3l10.3-6.2V5.3c0-1.6.9-2.8 2.2-2.8z" fill="currentColor"/>';
const TAPG = [['Info', [['details', 'Details'], ['heights', 'Heights m/ft'], ['custom', 'Custom info'], ['time', 'Both times'], ['times', 'All times (local, UTC, takeoff, flight)'], ['airlist', 'Airspace & radio'], ['radiopoi', 'Radio message & place'], ['logbook', 'Flights & logbook'], ['landlist', 'Landing fields']]], ['Go to page', [['pMap', 'Map'], ['pThermal', 'Thermal'], ['pAtmos', 'Atmosphere'], ['pAir', 'Airspace'], ['pPlan', 'Planner']]], ['Action', [['xcmode', 'Next XC mode (XC flight)'], ['chip', 'Thermal mode: start / thermal page'], ['thoff', 'Leave thermal mode'], ['sound', 'Sound on/off'], ['fullscreen', 'Full screen'], ['vmode', 'Switch display (vario)'], ['tcycle', 'Next time (Time widget)'], ['units', 'Switch m / ft (height)'], ['fai', 'FAI triangle on/off']]], ['Nothing', [['none', 'Nothing']]]];
const TAP = TAPG.flatMap(([, l]) => l);
// when held: info is shown only while you hold; actions run once
const HOLDG = [['Show while held', [['details', 'Details'], ['heights', 'Heights m/ft'], ['custom', 'Custom info'], ['time', 'Both times'], ['times', 'All times (local, UTC, takeoff, flight)'], ['airlist', 'Airspace & radio'], ['radiopoi', 'Radio message & place']]], ['Action', [['pages', 'Page menu'], ['chip', 'Thermal mode: start / thermal page'], ['thoff', 'Leave thermal mode'], ['sound', 'Sound on/off'], ['fullscreen', 'Full screen'], ['units', 'Switch m / ft'], ['fai', 'FAI on/off'], ['edit', 'Edit widgets']]], ['Go to page', [['pMap', 'Map'], ['pThermal', 'Thermal'], ['pAtmos', 'Atmosphere'], ['pAir', 'Airspace'], ['pPlan', 'Planner']]], ['Nothing', [['none', 'Nothing']]]];
const HOLD = HOLDG.flatMap(([, l]) => l);
const VIS = [['always', 'Always'], ['thermal', 'Thermalling'], ['glide', 'Stopped thermalling'], ['tow', 'Towing and after release']];
const COMMON = [['vis', 'Show when', VIS], ['towKeep', 'Keep showing after release', numOpt(0, 1800, 10, 's', [30, 60, 300], { zero: 'Hide at release', hint: '0 = hide at release', def: 60 })], ['visDelay', 'Delay before showing', numOpt(0, 300, 1, 's', [0, 3, 5, 10, 30], { zero: 'None', hint: '0 = immediately', def: 0 })], ['tap', 'When tapped', TAP], ['hold', 'When held', HOLD], ['infoItems', 'Custom info shows', 'INFO'], ['infoText', 'Custom info note', 'TEXT'], ['size', 'Text size', [['auto', 'Fit'], [0.7, 'S'], [0.85, 'M'], [1.15, 'L'], [1.35, 'XL']]], ['bg', 'Background', [[0, 'None'], [35, '35%'], [70, '70%'], [100, 'Solid']]], ['ctlShow', 'On-widget buttons', [['auto', 'Hide on small widgets'], ['always', 'Always show'], ['tap', 'Show when tapped']]], ['pad', 'Padding', [['page', 'As set in Display'], [0, 'None'], [2, 'Tight'], [4, 'Small'], [8, 'Normal']]], ['showLabel', 'Title', [[true, 'Show'], [false, 'Hide']]]];
let wid = 1;
function newW(type, x, y, w, h) { return { id: 'w' + Date.now().toString(36) + (wid++), type, x, y, w: w ?? WT[type].w * GSC, h: h ?? WT[type].h * GSC, cfg: Object.assign({ size: 'auto', bg: 70, showLabel: true }, (WT[type] && WT[type].def) || {}) }; }
// default layouts = the owner's own setup (exported 2026-10-18), in fine grid units (GC × GR = 96 × 64): [type, x, y, w, h, cfg]
const DEFS = {
  map: [
    ['map', 15, 0, 73, 56, { bg: 0, showLabel: false, layer: 'sat', rot: 'track', smooth: 'normal', z: 13, follow: true, ret: 0, track: 'lift', trackMin: 0, heading: true, start: true, task: true, air: true, notam: true, places: true, traffic: true, trafficR: 25, trafficA: 1500, gsize: 1, ctl: true, tap: 'none', taskStyle: 'dashed', taskW: 3, towpCol: 'green', towpStyle: 'solid', towpW: 2, windAT: 'spd', windAS: 32, windAD: 52, windAC: 'white', kk7: 'thermals', ctlShow: 'tap' }],
    ['avg', 0, 0, 15, 8, { win: 4 }],
    ['agl', 88, 12, 8, 7, { tap: 'custom' }],
    ['gs', 88, 26, 8, 7, { size: 1.35, label: 'GPS' }],
    ['ld', 8, 8, 7, 6, { win: 5 }],
    ['next', 15, 56, 20, 8],
    ['flight', 88, 19, 8, 7],
    ['button', 88, 56, 8, 8, { bg: 100, showLabel: false, action: 'pSwitch', color: 'plain', tap: 'none' }],
    ['vario', 0, 14, 15, 18, { size: 1.15, bg: 100, showLabel: false, win: 0.6, mode: 'dial', barDir: 'v', range: 5 }],
    ['alt', 88, 5, 8, 7, { src: 'gps' }],
    ['compass', 0, 32, 15, 16, { bg: 100, showLabel: false }],
    ['fai', 51, 56, 21, 8, { tap: 'details', mode: 'line' }],
    ['thchip', 78, 5, 10, 6, { bg: 0, showLabel: false }],
    ['airwarn', 71, 56, 18, 8, { bg: 0, showLabel: false, look: 'warn' }],
    ['avg', 0, 8, 8, 6, { win: 1 }],
    ['button', 88, 33, 8, 7, { bg: 100, showLabel: false, action: 'mute', color: 'orange', tap: 'none' }],
    ['ta', 0, 47, 15, 17, { bg: 85, orient: 'wind', hist: 120, style: 'trail', bgMap: false, trail: true, legend: true, zoom: 1 }],
  ],
  thermal: [
    ['ta', 7, 0, 40, 46, { bg: 85, orient: 'winddown', hist: 180, style: 'trail', bgMap: false, trail: true, legend: true, zoom: 1, range: 200 }],
    ['tside', 47, 1, 20, 38, { hist: 180, frame: 'air', range: 680, scale: 'fixed', axTurn: 5 }],
    ['vario', 0, 0, 7, 46, { mode: 'bar', barDir: 'v' }],
    ['avg', 87, 5, 9, 6, { win: 4 }],
    ['thermal', 87, 11, 9, 6],
    ['gain', 87, 17, 9, 6],
    ['ttime', 87, 23, 9, 6],
    ['wind', 87, 35, 9, 6, { size: 1.35 }],
    ['core', 87, 48, 9, 7],
    ['compass', 0, 46, 14, 18],
    ['alt', 87, 41, 9, 7],
    ['button', 87, 56, 9, 8, { bg: 100, showLabel: false, action: 'pSwitch', color: 'orange', tap: 'none' }],
    ['turn', 14, 46, 19, 18],
    ['tcross', 67, 1, 20, 38, { hist: 600, ahead: 1000, hold: false, frame: 'ground', axTurn: 5, range: 680, scale: 'fixed' }],
    ['theat', 33, 46, 14, 18, { bg: 100, orient: 'wind', hist: 90, depth: 70, blur: 25, range: 150, zoom: 0.51, colors: 'fixed' }],
    ['thchip', 64, 0, 7, 4, { bg: 0, showLabel: false }],
    ['map', 47, 39, 40, 25, { bg: 0, showLabel: false, layer: 'sat', rot: 'north', smooth: 'normal', z: 13, follow: true, ret: 0, track: 'plain', trackMin: 15, heading: true, start: true, task: true, air: true, notam: true, places: false, traffic: false, trafficR: 25, trafficA: 1500, gsize: 1, ctl: true, tap: 'none', kk7: 'thermals', ctlShow: 'tap' }],
    ['gs', 87, 29, 9, 6],
  ],
  atmos: [
    ['profile', 0, 0, 44, 64],
    ['temp', 44, 0, 16, 12],
    ['groundT', 60, 0, 20, 12],
    ['alt', 80, 0, 16, 12],
    ['cbase', 44, 12, 24, 16],
    ['ttop', 68, 12, 28, 16],
    ['outlook', 44, 28, 52, 20],
    ['trigger', 44, 48, 52, 12],
    ['thchip', 64, 0, 7, 4, { bg: 0, showLabel: false }],
  ],
  air: [
    ['asside', 0, 0, 52, 20, { range: 20 }],
    ['aslist', 0, 20, 52, 20],
    ['asmap', 0, 40, 52, 24, { map: 'light', radius: 0 }],
    ['places', 52, 0, 44, 28],
    ['radio', 52, 28, 44, 16],
    ['notams', 52, 44, 44, 20, { radius: 50 }],
    ['thchip', 64, 0, 7, 4, { bg: 0, showLabel: false }],
  ],
};
const PAGEKEY = { pMap: 'map', pThermal: 'thermal', pAtmos: 'atmos', pAir: 'air' };
const LAYERID = { map: 'wLayer', thermal: 'wLayer_thermal', atmos: 'wLayer_atmos', air: 'wLayer_air' };
const pageKey = () => PAGEKEY[curPage] || 'map';
/* own pages (S.pages = [{ id: 'pU…', name }]): widget pages like Map or Thermal; the layout key is the page id; they start empty or as a copy */
const isUserPage = (id) => /^pU[a-z0-9]+$/.test(String(id));
const pageTitle = (pk) => ({ map: 'map', thermal: 'Thermal page', atmos: 'Atmosphere page', air: 'Airspace page' })[pk] || ((S.pages || []).find((p) => p.id === pk) || { name: 'page' }).name;
function pageMount(P) {
  PAGEKEY[P.id] = P.id; LAYERID[P.id] = 'wLayer_' + P.id;
  let sec = $(P.id);
  if (!sec) {
    sec = document.createElement('section'); sec.className = 'page custom'; sec.id = P.id;
    sec.innerHTML = `<div class="wLayer" id="wLayer_${P.id}"></div><div class="emptyHint"><b></b><span>This page has no widgets yet.</span><button class="btn primary">Add widgets</button></div>`;
    sec.querySelector('.emptyHint button').onclick = () => { enterEdit(); openAdd(); };
    $('pPlan').before(sec);
  }
  sec.querySelector('.wLayer').setAttribute('aria-label', P.name + ' widgets'); sec.querySelector('.emptyHint b').textContent = P.name;
  let tab = document.querySelector(`.tab[data-page="${P.id}"]`);
  if (!tab) { tab = document.createElement('button'); tab.className = 'tab'; tab.dataset.page = P.id; tab.onclick = () => showPage(P.id); document.querySelector('.tab[data-page="pPlan"]').before(tab); }
  tab.textContent = P.name;
}
function pageUnmount(id) { delete PAGEKEY[id]; delete LAYERID[id]; const sec = $(id); if (sec) { sec.querySelectorAll('.wg').forEach(disposeW); sec.remove(); } document.querySelector(`.tab[data-page="${id}"]`)?.remove(); }
function pagesOrder() { S.pages.forEach((P) => { const sec = $(P.id), tab = document.querySelector(`.tab[data-page="${P.id}"]`); if (sec) $('pPlan').before(sec); if (tab) document.querySelector('.tab[data-page="pPlan"]').before(tab); }); }
S.pages = (Array.isArray(S.pages) ? S.pages : []).filter((p) => p && isUserPage(p.id) && typeof p.name === 'string').slice(0, 20);
S.pages.forEach(pageMount);
const defLayout = (pk) => isUserPage(pk) ? [] : (DEFS[pk || pageKey()] || DEFS.map).map(([t, x, y, w, h, c]) => { const W = newW(t, x, y, w, h); if (c) Object.assign(W.cfg, c); return W; });
{
  const old = Array.isArray(S.layout) ? S.layout : null; delete S.layout;
  // a fresh install starts with the default layouts as they are: the one-time migrations below are for older stored layouts only
  if (FRESH) Object.assign(S, { mapMigrated: true, navBtnMig: true, tcrossMig: true, t3dMig: true, taTrailMig: true, infoWMig: true, xcMig: true, xcMig2: true, faiBtnMig: true, poiMig: true, radioMig: true, fullBtnMig: true, muteBtnMig: true, avgMig: true, padMig: true });
  if (!S.layouts || typeof S.layouts !== 'object') S.layouts = {};
  if (old && !S.layouts.map) { const k = GSC / (S.layoutGrid || 1); S.layouts.map = old.map((W) => Object.assign({}, W, { x: Math.round(W.x * k), y: Math.round(W.y * k), w: Math.round(W.w * k), h: Math.round(W.h * k) })); }
  Object.keys(LAYERID).forEach((pk) => { if (!Array.isArray(S.layouts[pk]) || !S.layouts[pk].length) S.layouts[pk] = defLayout(pk); S.layouts[pk] = S.layouts[pk].filter((W) => WT[W.type]); });
  // padding: tight by default (2026-10-18); stored values still at the old default 8 / 4 move to 2 / 1 once
  if (!S.padMig) { S.padMig = true; if (+S.wPadX === 8 && +S.wPadY === 4) { S.wPadX = 2; S.wPadY = 1; } }
  // the FAI widget became the XC flight widget (2026-10-16): its tap now switches mode (the FAI button still toggles the map sectors)
  // …and its tap became the info popup with the FAI switch (2026-10-17)
  // radio message settings moved from the map widget to Settings → Radio message (2026-10-17)
  if (!S.radioMig) { S.radioMig = true; Object.keys(LAYERID).forEach((pk) => S.layouts[pk].forEach((W) => { if (W.type !== 'map') return; ['callsign', 'radioAlt', 'radioLang'].forEach((k) => { if (W.cfg[k] && (k !== 'callsign' || !S.callsign || S.callsign === 'Paraglider')) S[k] = W.cfg[k]; delete W.cfg[k]; }); })); }
  if (!S.poiMig) { S.poiMig = true; Object.keys(LAYERID).forEach((pk) => S.layouts[pk].forEach((W) => { if (W.type === 'map' && (W.cfg.places === false || W.cfg.places === 'false')) W.cfg.places = true; })); } // airports and towns on the map (2026-10-17)
  // the global "Default vario average" setting is gone (2026-10-17): Vario average widgets that used it keep its value
  if (!S.avgMig) { S.avgMig = true; Object.keys(LAYERID).forEach((pk) => S.layouts[pk].forEach((W) => { if (W.type === 'avg' && !(+W.cfg.win > 0)) W.cfg.win = +S.avgS || 30; })); }
  if (!S.fullBtnMig) { S.fullBtnMig = true; S.layouts.map = S.layouts.map.filter((W) => !(W.type === 'button' && W.cfg.action === 'fullscreen')); } // full screen is in the hamburger menu now (2026-10-17)
  // a mute button where the Full screen button was (2026-10-17), if that spot is free
  if (!S.muteBtnMig) { S.muteBtnMig = true; const L = S.layouts.map, free = !L.some((W) => W.type !== 'map' && W.x < 96 && W.x + W.w > 87 && W.y < 63 && W.y + W.h > 56); if (free && !L.some((W) => W.type === 'button' && W.cfg.action === 'mute')) { const B = newW('button', 87, 56, 9, 7); Object.assign(B.cfg, { action: 'mute', color: 'plain', bg: 100, showLabel: false, tap: 'none' }); L.push(B); } }
  if (!S.faiBtnMig) { S.faiBtnMig = true; S.layouts.map = S.layouts.map.filter((W) => !(W.type === 'button' && W.cfg.action === 'fai')); } // the FAI switch is in the XC flight popup now
  if (!S.xcMig2) { S.xcMig2 = true; Object.keys(LAYERID).forEach((pk) => S.layouts[pk].forEach((W) => { if (W.type === 'fai' && (W.cfg.tap === 'xcmode' || W.cfg.tap === 'fai')) W.cfg.tap = 'details'; })); }
  if (!S.xcMig) { S.xcMig = true; Object.keys(LAYERID).forEach((pk) => S.layouts[pk].forEach((W) => { if (W.type === 'fai' && W.cfg.tap === 'fai') W.cfg.tap = 'xcmode'; })); }
  // the airspace warning bar and the THERMAL? corner chip became widgets (2026-10-16): put them where they were, once
  if (!S.infoWMig) { S.infoWMig = true; const on = (v) => v !== false && v !== 'false';
    Object.keys(LAYERID).forEach((pk) => { const L = S.layouts[pk]; if (on(S.modeChip) && !L.some((W) => W.type === 'thchip')) L.push(newW('thchip', 64, 0, 7, 4)); if (pk === 'map' && on(S.warnBar) && !L.some((W) => W.type === 'airwarn')) L.push(newW('airwarn', 24, 1, 40, 4)); }); }
  if (!S.mapMigrated) { if (!S.layouts.map.some((W) => W.type === 'map')) S.layouts.map.unshift(newW('map', 0, 0, GC, GR)); S.mapMigrated = true; }
  if (!S.navBtnMig) {
    S.navBtnMig = true;
    [['map', 4, 2], ['thermal', 4, 2]].forEach(([pk, w, h]) => { const L = S.layouts[pk]; if (L.some((W) => W.type === 'button' && ['pSwitch'].includes(W.cfg.action))) return; w *= GSC; h *= GSC;
      const hit = (x, y) => L.some((W) => W.type !== 'map' && x < W.x + W.w && x + w > W.x && y < W.y + W.h && y + h > W.y); let pos = null;
      for (let y = GR - h; y >= 0 && !pos; y -= GSC) for (let x = 0; x <= GC - w && !pos; x += GSC) if (!hit(x, y)) pos = [x, y];
      const B = newW('button', (pos || [0, GR - h])[0], (pos || [0, GR - h])[1], w, h); Object.assign(B.cfg, { action: 'pSwitch', color: 'orange' }); L.push(B); });
  }
  // thermal front view (added 2026-10): put it next to the side view on the thermal page once
  if (!S.tcrossMig) {
    S.tcrossMig = true; const L = S.layouts.thermal;
    if (!L.some((W) => W.type === 'tcross' || W.type === 't3d')) {
      const T = L.find((W) => W.type === 'tside'), ta = T && L.find((W) => W.type === 'ta' && W.x + W.w === T.x && W.y === T.y && W.h === T.h);
      if (T) {
        if (ta && ta.w >= 8 * GSC && T.w < 8 * GSC) { const d = 8 * GSC - T.w; ta.w -= d; T.x -= d; T.w += d; } // make the column 8 wide, taken from the thermal assistant
        const half = Math.round(T.w / 2 / GSC) * GSC || GSC; L.push(newW('tcross', T.x + half, T.y, T.w - half, T.h)); T.w = half;
      } else {
        const w = 4 * GSC, h = 11 * GSC, hit = (x, y) => L.some((W) => x < W.x + W.w && x + w > W.x && y < W.y + W.h && y + h > W.y); let pos = null;
        for (let y = 0; y <= GR - h && !pos; y += GSC) for (let x = 0; x <= GC - w && !pos; x += GSC) if (!hit(x, y)) pos = [x, y];
        L.push(newW('tcross', ...(pos || [GC - w, 0]), w, h));
      }
    }
  }
  // thermal 3D view (added 2026-10): takes the place of the front view on the thermal page, once
  if (!S.t3dMig) {
    S.t3dMig = true; const L = S.layouts.thermal;
    if (!L.some((W) => W.type === 't3d')) {
      const i = L.findIndex((W) => W.type === 'tcross');
      if (i >= 0) { const X = L[i]; L[i] = newW('t3d', X.x, X.y, X.w, X.h); }
      else { const w = 4 * GSC, h = 11 * GSC, hit = (x, y) => L.some((W) => x < W.x + W.w && x + w > W.x && y < W.y + W.h && y + h > W.y); let pos = null;
        for (let y = 0; y <= GR - h && !pos; y += GSC) for (let x = 0; x <= GC - w && !pos; x += GSC) if (!hit(x, y)) pos = [x, y];
        L.push(newW('t3d', ...(pos || [GC - w, 0]), w, h)); }
    }
  }
  // thermal assistant draws a trail instead of dots (2026-10): switch widgets still on the old default
  if (!S.taTrailMig) { S.taTrailMig = true; Object.values(S.layouts).forEach((L) => L.forEach((W) => { if (W.type !== 'ta') return; if (!W.cfg.style || W.cfg.style === 'both') W.cfg.style = 'trail'; if (W.cfgT && W.cfgT.style === 'both') W.cfgT.style = 'trail'; })); }
  S.layoutGrid = GSC; save();
}
Object.defineProperty(S, 'layout', { enumerable: false, configurable: true, get() { return S.layouts[pageKey()]; }, set(v) { S.layouts[pageKey()] = v; } });
let wEdit = false, wSel = null;
// thermal gain and average: live while circling (and during a short break, see S.thJoin), frozen at the result once you left, then the last recorded thermal
function thRes(alt, now) {
  const th = st.thermal, q = st.thermals[st.thermals.length - 1];
  if (th && !th.end && alt != null && th.alt0 != null) { const d = Math.max(1, (now - th.t0) / 1000); return { gain: alt - th.alt0, avg: (alt - th.alt0) / d, s: '' }; }
  if (th && th.end && th.alt1 != null && th.alt0 != null) { const d = Math.max(1, (th.end - th.t0) / 1000); return { gain: th.alt1 - th.alt0, avg: (th.alt1 - th.alt0) / d, s: 'last thermal' }; }
  if (q) return { gain: q.alt1 - q.alt0, avg: q.avg, s: 'last thermal' };
  return null;
}
function wData(W, bx) { bx = bx || { w: 300, h: 150 };
  const c = W.cfg, f = st.fix, alt = altNow(), now = nowT(), u = c.units || '';
  const V = (ms) => withU('uVario', u, () => fVario(ms)), VU = () => withU('uVario', u, uV);
  const A = (m) => withU('uAlt', u, () => fAlt(m)), AU = u || S.uAlt;
  const Sp = (ms) => withU('uSpd', u, () => fSpd(ms)), SU = u || S.uSpd;
  const w = windFromSpd(), th = st.thermal;
  const wp = st.task && st.task.pts[st.nextWp];
  const dwp = f && wp ? dist(f.lat, f.lon, wp.lat, wp.lon) : null;
  switch (W.type) {
    case 'vario': { const win = +c.win || 0; const v = win ? avgVario(win, now) ?? st.vario : st.vario; return { l: win ? 'Vario ' + durS(win) : 'Vario', u: VU(), v: V(v), col: v >= 0 ? css('--climb') : css('--sink'), s: st.varioSrc === 'gps' ? 'from GPS' : '' }; }
    case 'avg': { const win = +c.win || 30; const a = avgVario(win, now); return { l: 'Vario ' + durS(win), u: VU(), v: V(a), col: a == null ? null : a >= 0 ? css('--climb') : css('--sink') }; }
    case 'alt': { const a = c.src === 'gps' ? f?.alt : alt; return { l: 'Altitude', u: AU, v: A(a), s: c.src === 'gps' ? 'GPS' : st.baro ? 'vario' : 'GPS' }; }
    case 'agl': return { l: 'AGL', u: AU, v: st.groundElev != null && alt != null ? A(alt - st.groundElev) : '--', s: st.groundElev != null ? 'ground ' + A(st.groundElev) : 'needs terrain data' };
    case 'gs': return { l: 'Ground speed', u: SU, v: Sp(f?.spd) };
    case 'trk': return { l: 'Track', u: '°', v: f?.trk != null ? pad3(f.trk) : '--', s: f?.trk != null ? compass(f.trk) : '' };
    case 'ld': { const win = +c.win || 20, a = avgVario(win, now), g = avgSpd(win, now); const v = !st.circling && a != null && a < -0.2 && g > 3 ? g / -a : null; return { l: 'Glide ' + win + ' s', u: '', v: v ? v.toFixed(1) : (st.ld ? st.ld.toFixed(1) : '--'), s: v ? '' : st.circling ? 'circling' : '' }; }
    case 'reqld': { const need = dwp != null && alt != null && st.groundElev != null ? dwp / Math.max(1, alt - st.groundElev - S.safety) : null; return { l: 'Req. glide', u: '', v: need && need > 0 ? need.toFixed(1) : '--', s: wp ? 'to ' + wp.name : 'no task' }; }
    case 'wind': return { l: 'Wind', u: SU, v: w ? Sp(w.spd) : '--', s: w ? 'from ' + pad3(w.from) + '° ' + compass(w.from) : 'circle once', arrow: w ? w.to : null };
    case 'dist': return { l: 'To ' + (wp ? wp.name : 'turnpoint'), u: '', v: dwp != null ? fDist(dwp) : '--', s: wp && f ? 'brg ' + pad3(brg(f.lat, f.lon, wp.lat, wp.lon)) + '°' : 'no task' };
    case 'thermal': { const g = thRes(alt, now); return { l: 'Thermal avg', u: VU(), v: g ? V(g.avg) : '--', s: g ? g.s : '' }; }
    case 'gain': { const g = thRes(alt, now); return { l: 'Thermal gain', u: AU, v: g ? (g.gain >= 0 ? '+' : '') + A(g.gain) : '--', s: g ? g.s : '' }; }
    case 'ttime': { const t = th ? Math.floor(((th.end || now) - th.t0) / 1000) : null; return { l: 'In thermal', u: '', v: t != null ? Math.floor(t / 60) + ':' + pad2(t % 60) : '--' }; }
    case 'flight': { const t = st.takeoffT ? Math.floor((now - st.takeoffT) / 1000) : null; return { l: 'Flight time', u: '', v: t != null ? Math.floor(t / 3600) + ':' + pad2(Math.floor(t / 60) % 60) : '--' }; }
    case 'conn': { // compact: the vario battery (red under 20 %), optional status dots like the corner (G = GPS, B = Bora, T = temperature, D = demo/replay); tap: connInfoHTML
      const vb = st.bora && st.bora.batt, pct = vb && vb.pct != null ? vb.pct : null, gOk = st.fix && nowT() - st.fix.t < 4000, low = pct != null && pct < 20;
      const v = vb ? (pct != null ? pct + '%' : vb.v.toFixed(2) + ' V') : st.bora ? '…' : st.sim ? (st.simBat || 90) + '%' : st.replay ? 'IGC' : '--';
      const dot = (k, on) => `<span style="display:inline-block;min-width:1.25em;margin-right:3px;padding:0 3px;border-radius:4px;font-weight:700;${on ? 'background:var(--climb);color:#fff' : 'border:1px solid var(--line);opacity:.6'}">${k}</span>`;
      const tab = c.tab === false || c.tab === 'false' || st.deviceBat == null ? '' : 'tablet ' + st.deviceBat + '%' + (st.deviceChg ? ' ⚡' : '');
      const r = { l: st.bora ? (st.bora.name || 'Bora') : 'Vario', u: '', v, col: low ? css('--restr') : null, s: tab || (st.bora ? '' : 'not connected · tap') };
      if (!c.look || c.look === 'both') { // default: both batteries side by side, each value as large as the box allows
        const tb = st.deviceBat != null ? st.deviceBat + '%' : '--', tLow = st.deviceBat != null && st.deviceBat < 20 && !st.deviceChg, fs = clamp(Math.min(bx.h * 0.42, bx.w / 7.5), 12, 90).toFixed(0);
        const col = (k, val, red, extra) => `<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><span class="ws" style="opacity:.8">${k}</span><span class="num" style="font-size:${fs}px;line-height:1;font-weight:700${red ? ';color:' + css('--restr') : ''}">${esc(val)}${extra || ''}</span></div>`;
        return { l: st.bora ? (st.bora.name || 'Bora') : 'Batteries', html: `<div class="row" style="flex:1;gap:6px;align-items:stretch">${col('Vario', v, low)}${col('Tablet', tb, tLow, st.deviceChg ? '<small style="font-size:.45em"> ⚡</small>' : '')}</div>` }; }
      if (c.look === 'dots') r.s = dot('G', gOk) + dot('B', !!st.bora) + dot('T', st.baro && st.baro.temp != null) + dot('D', !!(st.sim || st.replay)) + (tab ? ' ' + tab : ''), r.sHtml = true;
      return r; }
    case 'tclock': { // local / UTC / flight time, a tap goes to the next (tap action tcycle)
      const sec = c.sec === true || c.sec === 'true', d = new Date(st.replay ? st.replay.vt : Date.now()), hm = (h, m, s) => pad2(h) + ':' + pad2(m) + (sec ? ':' + pad2(s) : '');
      const ft = st.takeoffT ? Math.floor((nowT() - st.takeoffT) / 1000) : null, V = { local: hm(d.getHours(), d.getMinutes(), d.getSeconds()), utc: hm(d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()), flight: ft != null ? Math.floor(ft / 3600) + ':' + pad2(Math.floor(ft / 60) % 60) + (sec ? ':' + pad2(ft % 60) : '') : '--' };
      const N = { local: 'Local', utc: 'UTC', flight: 'Flight' }, cur = N[c.show] ? c.show : 'local', rest = Object.keys(N).filter((k) => k !== cur);
      return { l: { local: 'Local time', utc: 'UTC', flight: 'Flight time' }[cur], u: '', v: V[cur], s: !(c.others === true || c.others === 'true') ? '' : rest.map((k) => N[k] + ' ' + V[k]).join(' · ') }; }
    case 'time': { const d = new Date(c.zone === 'utc' && st.replay ? st.replay.vt : Date.now()); const U = c.zone === 'utc'; const hh = U ? d.getUTCHours() : d.getHours(), mm = U ? d.getUTCMinutes() : d.getMinutes(), ss = U ? d.getUTCSeconds() : d.getSeconds(); return { l: U ? 'UTC' : 'Local time', u: '', v: pad2(hh) + ':' + pad2(mm) + (c.sec ? ':' + pad2(ss) : ''), s: 'tap: both times' }; }
    case 'land': return landWData(W);
    case 'rec': { const R = REC.cur, s = R && R.stats; if (R) return { l: 'Recording', v: '● REC', col: '#C62828', s: fDur(R.pts.length ? (R.pts[R.pts.length - 1][0] - R.t0) / 1000 : 0) + ' · ' + R.pts.length + ' pts' }; return { l: 'Recorder', v: !recOn() ? 'OFF' : st.replay || st.sim ? 'DEMO' : 'READY', s: !recOn() ? 'recording off' : st.replay || st.sim ? 'not recorded' : REC.wait ? 'landed' : 'starts at takeoff' }; }
    case 'baro': { const pa = st.baro && st.baro.pa; return { l: 'Pressure', u: 'hPa', v: pa ? (pa / 100).toFixed(1) : '--', s: pa ? 'QNH ' + (+sN('qnh', 1013.25)).toFixed(1) : st.bora ? 'no pressure in the data' : 'vario not connected' }; }
    case 'temp': return { l: 'Temperature', u: '°C', v: st.baro?.temp != null ? st.baro.temp.toFixed(1) : '--' };
    case 'battery': { const vb = st.bora?.batt; return { l: 'Battery', u: '', v: vb ? (vb.pct != null ? vb.pct + '%' : vb.v.toFixed(2) + ' V') : st.sim ? (st.simBat || 90) + '%' : '--', s: st.deviceBat != null ? 'tablet ' + st.deviceBat + '%' : '' }; }
    case 'glide': { const p = st.pred; return { html: `<div class="ws" style="font-size:14px;color:var(--ink)">● <b>L/D ${p.ldNow ? p.ldNow.toFixed(1) : '--'} now</b> → ${p.now ? fDist(p.now[2]) : '--'}</div><div class="ws" style="font-size:14px;color:var(--ink)">○ <b>L/D ${S.wingLD} wing</b> → ${p.wing ? fDist(p.wing[2]) : st.groundElev == null ? 'needs terrain' : '--'}</div>`, l: 'Landing prediction' }; }
    case 'cloud': { const fc = st.forecast; if (!fc) return { l: 'Cloud base', u: AU, v: '--', s: 'load forecast on Atmosphere' }; const cb = fc.elev + 125 * (fc.T - fc.Td), top = thermalTop(); return { l: 'Cloud base', u: AU, v: A(cb), s: 'thermal top ' + (top ? A(top) : '--') }; }
    case 'place': { if (!f) return { l: 'Nearest place', v: '--' }; const spl = startPlace(); const L0 = c.kind === 'start' ? (spl ? [spl] : []) : st.places.concat(c.kind === 'any' || !c.kind ? (spl ? [spl] : []) : []).filter((p) => c.kind === 'airport' ? p.kind === 'airport' : c.kind === 'town' ? p.kind === 'town' : p.kind !== 'peak'); let b = null, bd = 1e12; L0.forEach((p) => { const d = dist(f.lat, f.lon, p.lat, p.lon); if (d < bd) { bd = d; b = p; } }); return b ? { l: c.kind === 'start' ? 'Start' : 'Nearest place', u: '', v: fDist(bd), s: `${compass(brg(b.lat, b.lon, f.lat, f.lon))} of ${b.name}` } : { l: 'Nearest place', v: '--', s: 'loading places…' }; }
    case 'airwarn': {
      const near = +c.near || +S.warnDist || 2000, under = c.under ?? 150, s = airStatus(), yes = (v) => v !== false && v !== 'false';
      const hit = (yes(c.inside) && s.find((x) => x.inside && x.vert === 'in')) || s.find((x) => x.d < near && x.vert === 'in') || (+under > 0 && s.find((x) => x.inside && x.vert === 'below' && x.lo - x.alt < +under));
      const lim = (a) => (yes(c.lims) ? ` · ${fmtLim(a.lo)} – ${fmtLim(a.hi)}` : '');
      const box = (inner, kind) => { const look = c.look || 'warn', red = look === 'solid' && kind === 'in'; return `<div class="awBox ${look === 'plain' ? '' : red ? 'red' : 'warn'}">${inner}</div>`; };
      if (!hit) return { l: 'Airspace warning', hide: c.idle !== 'show', html: box(wEdit && c.idle !== 'show' ? '<span class="muted">Airspace warning · shows when needed</span>' : '<span>No airspace warning</span>', 'none') };
      const html = hit.inside && hit.vert === 'in' ? `<b>Inside ${esc(hit.a.name)}</b>${lim(hit.a)}` : hit.inside ? `<b>${fAlt(hit.lo - hit.alt)} ${S.uAlt} below ${esc(hit.a.name)}</b> floor` : `<b>${esc(hit.a.name)} in ${fDist(hit.d)}</b>${lim(hit.a)}`;
      return { l: 'Airspace warning', html: box(`<span>${html}</span>`, hit.inside && hit.vert === 'in' ? 'in' : 'near') };
    }
    case 'thchip': {
      const yes = (v) => v !== false && v !== 'false', cand = !st.thermMode && st.circling && st.manual !== 'off';
      const mode = st.thermMode ? (yes(c.active) ? 'on' : '') : cand && yes(c.cand) ? 'cand' : '', col = { orange: 'var(--climb)', blue: 'var(--sink)', dark: 'var(--ink)' }[c.color] || 'var(--climb)';
      const txt = mode === 'on' ? c.tOn || 'THERMAL' : mode === 'cand' ? c.tCand || 'THERMAL?' : 'GLIDE';
      const fs = Math.round(clamp(Math.min(curBox.h * 0.42, (curBox.w - 24) / Math.max(4, txt.length * 0.8)), 10, 40) * (+c.size || 1));
      const html = `<div class="tcBox ${mode || 'idle'}" style="--tc:${col};font-size:${fs}px">${esc(wEdit && !mode && c.idle !== 'show' ? 'THERMAL?' : txt)}</div>`;
      return { l: 'Thermal mode', hide: !mode && c.idle !== 'show', html };
    }
    case 'radiomsg': {
      const p = radioRef(c.ref), fq = radioFreq(), on = (v) => v !== false && v !== 'false', bh = curBox.h, bw = curBox.w;
      const msg = p ? radioCall(p) : st.fix ? 'No place nearby yet (places load from OpenStreetMap)' : 'Waiting for a position';
      const fs = Math.round(clamp(Math.min(bh * 0.2, bw / 26), 13, 30) * (+c.size || 1)), ff = Math.round(clamp(bh * 0.3, 16, 44));
      const top = on(c.freq) ? `<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="num" style="font-size:${ff}px;font-weight:700">📻 ${fq ? esc(fq.v) : '--'}</span><span class="ws" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fq ? esc(fq.n) + (fq.inside ? ' · you are inside' : ' · ' + fDist(fq.d)) : 'no frequency in the airspace data nearby'}</span></div>` : '';
      return { l: 'Radio message', html: `<div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:2px;overflow:hidden">${top}<div style="font-size:${fs}px;line-height:1.25;overflow:hidden">${esc(msg)}</div></div>` };
    }
    case 'airbtn': {
      const R = (+c.radius || 20) * 1000, s = airStatus().filter((x) => x.d <= R), inn = s.filter((x) => x.inside && x.vert === 'in'), warn = !inn.length && s.find((x) => x.d < (+S.warnDist || 2000) && x.vert === 'in');
      const look = c.look || 'count', bw = curBox.w, bh = curBox.h, ic = Math.round(Math.max(22, Math.min(look === 'icon' ? bh - 14 : bh - 18, look === 'icon' ? bw - 16 : bw * 0.42, 72)));
      const big = inn.length ? 'IN' : String(s.length), sub = !st.airspaces.length ? 'no data' : inn.length ? inn[0].a.name : warn ? fDist(warn.d) + ' · ' + warn.a.name : s.length ? (look === 'name' ? s[0].a.name + ' · ' + fDist(s[0].d) : 'within ' + (R / 1000) + ' km') : 'none within ' + (R / 1000) + ' km';
      const icon = `<svg width="${ic}" height="${ic}" viewBox="0 0 32 32" aria-hidden="true" style="flex-shrink:0">${PLANE_PATH}</svg>`;
      const fs = Math.round(Math.max(14, Math.min(bh * 0.5, 44))), txt = look === 'icon' ? '' : `<div style="min-width:0;display:flex;flex-direction:column;line-height:1.05"><span class="num" style="font-size:${fs}px;font-weight:700">${esc(big)}</span>${bh >= 60 ? `<span style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sub)}</span>` : ''}</div>`;
      return { l: 'Airspace', html: `<div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:8px;overflow:hidden" aria-label="Airspace: ${esc(inn.length ? 'inside ' + inn[0].a.name : s.length + ' nearby')}">${icon}${txt}</div>`, bgc: inn.length ? css('--restr') : warn ? css('--warnbg') : null, col: inn.length ? '#fff' : warn ? css('--warn') : null };
    }
    case 'air': { const x = airStatus()[0]; if (!x) return { l: 'Airspace', v: '--', s: st.airspaces.length ? 'none within 30 km' : 'no airspace data' }; return { l: 'Airspace', u: '', v: x.inside && x.vert === 'in' ? 'INSIDE' : fDist(x.d), s: `${x.a.name} · ${fmtLim(x.a.lo)}–${fmtLim(x.a.hi)}`, col: x.inside && x.vert === 'in' ? css('--restr') : null }; }
    case 'fai': {
      const z = xcCalc(c.mode), on = (v) => v !== false && v !== 'false', km = (m) => (m / 1000).toFixed(m < 10000 ? 1 : 0), fz = Math.round(clamp(Math.min(bx.h * 0.26, bx.w / 13), 15, 44));
      const cell = (k, v, u, cl) => `<div style="min-width:0"><div class="ws">${k}</div><div class="num" style="white-space:nowrap;font-size:${fz}px${cl ? ';color:' + cl : ''}">${v}${u ? `<span style="font-size:.45em;font-weight:600"> ${u}</span>` : ''}</div></div>`;
      const name = (XC_MODES.find((x) => x[0] === (z ? z.mode : c.mode)) || XC_MODES[0])[1];
      if (!z || !z.ready) return { l: 'XC · ' + name, v: '--', s: !st.fix ? 'waiting for GPS…' : 'fly away from the start: values appear after 0.5 km' };
      const spd = (ms) => fSpd(ms), U = S.uSpd, row = (h) => `<div class="row" style="gap:14px;flex:1;align-items:center;flex-wrap:wrap">${h}</div>`, title = 'XC · ' + (z.auto ? 'auto: ' : '') + name.toLowerCase();
      const avg = on(c.avg) && z.dur > 300 ? cell('XC average', spd(z.c / z.dur), U) : '';
      if (z.mode === 'line') return { l: title, html: row(cell('From start', km(z.b), 'km') + cell('Farthest', km(z.c), 'km') + (on(c.away) && z.away != null ? cell('Away speed', (z.away >= 0 ? '+' : '') + spd(z.away), U, z.away < 0 ? css('--sink') : '') : '') + avg) + `<div class="ws">heading ${pad3(Math.round(z.brgOut))}° ${compass(z.brgOut)} from the start</div>` };
      if (z.mode === 'oar') { const tot = 2 * z.c, done = z.c + Math.max(0, z.c - z.b);
        return { l: title, html: row(cell('Turnpoint', km(z.c), 'km') + cell('Back to start', km(z.b), 'km') + cell('Out & return', km(tot), 'km') + cell('Done', Math.round(100 * done / tot) + ' %') + avg) + `<div class="ws">start ${pad3(Math.round(z.toStart))}° ${compass(z.toStart)} · turnpoint = your farthest point</div>` }; }
      return { l: z.ok ? title + ' · ✓ FAI' : title, ...(z.ok ? { bgc: '#1F8A4C', col: '#FFFFFF' } : {}), html: row(cell('Triangle', km(z.P), 'km') + cell('Shortest leg', Math.round(z.mn * 100) + ' %', '', z.ok ? '' : css('--sink')) + (z.ok ? '' : cell('To FAI sector', km(z.toSec), 'km')) + cell('Back to start', km(z.b), 'km') + avg) + `<div class="ws">start → TP ${km(z.c)} km · FAI: every leg ≥ 28 %${S.fai ? '' : ' · map sectors off (FAI button)'}</div>` };
    }
    case 'tow': {
      const T = towNow(), mmss = (s) => Math.floor(s / 60) + ':' + pad2(Math.floor(s % 60)), cell = (k, v, u) => `<div><div class="ws">${k}</div><div class="num" style="white-space:nowrap;font-size:${clamp(Math.min(bx.h * 0.3, bx.w / 13), 16, 60).toFixed(0)}px">${v}${u ? `<span style="font-size:.45em;font-weight:600"> ${u}</span>` : ''}</div></div>`;
      if (!T) return { l: 'Tow', v: '--', s: S.towDetect === false ? 'tow detection is off (Settings → Flight modes)' : 'no tow yet' };
      const dur = Math.max(1, (T.t1 - T.t0) / 1000), g = T.alt1 - T.alt0, tot = (st.tows || []).reduce((s0, x) => s0 + (x.alt1 - x.alt0), 0);
      return { l: (T.active ? 'Towing' : 'Tow') + ((st.tows || []).length > 1 ? ' ' + T.n : ''), ...(T.active ? { bgc: '#1E50C8', col: '#FFFFFF' } : {}),
        html: `<div class="row" style="gap:16px;flex:1;align-items:center;justify-content:space-around">${cell('Time', mmss(dur))}${cell('Gain', (g >= 0 ? '+' : '') + A(g), AU)}${cell('Average', V(g / dur), VU())}</div><div class="ws">${T.active ? 'towing…' : 'released at ' + A(T.alt1) + ' ' + AU}${(st.tows || []).length > 1 ? ' · all tows ' + (tot >= 0 ? '+' : '') + A(tot) + ' ' + AU : ''}</div>` };
    }
    case 'next': {
      // no task: open FlyXC on the Web page, or paste a FlyXC link you already have
      if (!st.task) return { l: 'Next turnpoint', html: `<div class="fxW"><div class="row"><input class="fxIn" type="url" inputmode="url" placeholder="Paste a FlyXC link" aria-label="FlyXC link"><button class="wcb fxB" data-act="fximp">Import</button></div><button class="wcb fxB" data-act="fxweb">Plan a route ›</button></div>` };
      if (st.goalT) { const d = new Date(st.goalT); return { l: 'Goal · ' + st.task.name, html: `<div class="wv" style="font-size:${clamp(Math.min(bx.h * 0.4, bx.w / 5), 16, 90).toFixed(0)}px;justify-content:center">✓ GOAL</div><div class="ws" style="text-align:center">reached ${pad2(d.getHours())}:${pad2(d.getMinutes())} · ${(st.task.len / 1000).toFixed(1)} km</div>`, bgc: '#1F8A4C', col: '#FFFFFF' }; }
      if (!wp || !f) return { html: `<div class="ws" style="white-space:normal">Waiting for GPS…</div>`, l: 'Next turnpoint' };
      const need = alt != null && st.groundElev != null ? dwp / Math.max(1, alt - st.groundElev - S.safety) : null, needOk = need && need > 0; const arr = alt != null && st.groundElev != null ? alt - dwp / S.wingLD - st.groundElev : null;
      // for 20 s after a turnpoint: green, "✓ TP1 reached · next TP2"
      const hit = st.wpHit && nowT() - st.wpHit.t < 20000 ? st.wpHit : null;
      return { l: hit ? `✓ ${hit.name} reached · next ${wp.name} (${st.nextWp + 1}/${st.task.pts.length})` : `Next · ${wp.name} (${st.nextWp + 1}/${st.task.pts.length})`, ...(hit ? { bgc: '#1F8A4C', col: '#FFFFFF' } : {}), html: `<div class="row" style="gap:14px;flex:1;align-items:center"><div><div class="ws">Dist</div><div class="num" style="font-size:26px">${fDist(dwp)}</div></div><div><div class="ws">Req L/D</div><div class="num" style="font-size:26px${needOk && !hit && need > S.wingLD ? ';color:var(--restr)' : ''}">${needOk ? need.toFixed(1) : '--'}</div></div><div><div class="ws">ETA</div><div class="num" style="font-size:26px">${f.spd > 2 ? etaStr(dwp / f.spd) : '--'}</div></div></div><div class="ws">${arr != null ? (arr >= 0 ? 'Arrive ' + A(arr) + ' ' + AU + ' above ground' : 'Short by ' + A(-arr) + ' ' + AU) + ' at L/D ' + S.wingLD : ''}</div>` };
    }
    case 'button': { const a = BTN[c.action] || BTN.thermalOn, bgc = { orange: 'var(--climb)', blue: 'var(--sink)', dark: 'var(--ink)' }[c.color || 'orange'], fg = { plain: 'var(--ink)' }[c.color] || (c.color === 'dark' ? 'var(--bg)' : '#FFFFFF'); let lab = c.label || a[1]; if (!c.label) { if (c.action === 'pSwitch') lab = pageKey() === 'thermal' ? 'MAP' : 'THERMAL'; if (c.action === 'fullscreen' && document.fullscreenElement) lab = 'EXIT FULL'; if (c.action === 'fai') lab = S.fai ? 'FAI ON' : 'FAI OFF'; if (c.action === 'mute') lab = S.sound ? '🔊 VARIO' : '🔇 MUTED'; } if (c.action === 'mute' && !S.sound) return { l: '', v: lab, col: '#FFFFFF', bgc: 'var(--restr)', center: true, btn: true }; return { l: '', v: lab, col: fg, bgc, center: true, btn: true }; }
    case 'core': { const k = coreEstimate(); return { l: 'Centering', u: '', v: k ? Math.round(k.d) + ' m' : '--', s: k ? 'to ' + pad3(k.b) + '° ' + compass(k.b) + (st.circling ? '' : ' (last)') : 'start circling' }; }
    case 'groundT': { const fc = st.forecast; return { l: 'Ground T / dew pt', u: '°C', v: fc ? fc.T.toFixed(1) + ' / ' + fc.Td.toFixed(1) : '--', s: fc ? 'forecast 2 m · ' + fc.t.slice(11, 16) : 'load forecast' }; }
    case 'cbase': { const fc = st.forecast, cb = fc ? fc.elev + 125 * (fc.T - fc.Td) : null; return { l: 'Cloud base', u: AU, v: cb != null ? A(cb) : '--', col: css('--sink'), s: 'elev + 125 m × spread' }; }
    case 'ttop': { const t = thermalTop(); return { l: 'Thermal top', u: AU, v: t ? A(t) : '--', col: css('--warn'), s: st.forecast ? 'parcel +' + (+(S.trig ?? 2)).toFixed(1) + ' °C' : 'load forecast' }; }
    case 'outlook': {
      const fc = st.forecast; let txt = 'Load the forecast to estimate cloud base and thermal top.';
      if (fc) { const cb = fc.elev + 125 * (fc.T - fc.Td), top = thermalTop(); txt = top ? (top < cb ? `Blue thermals likely, top around ${A(top)} ${AU}. Cloud base would be ${A(cb)} ${AU}, above the thermal top.` : `Cumulus likely, base around ${A(cb)} ${AU}.`) : 'No clear top found in the forecast profile.'; }
      return { l: 'Outlook', u: fc ? 'forecast ' + fc.t.slice(11, 16) : '', html: `<div style="flex:1;min-height:0;font-size:${curBox.h > 150 ? 18 : 15}px;font-weight:600;overflow:hidden">${esc(txt)}</div><div class="row" style="flex-shrink:0"><button class="wcb wide" data-act="forecast">${st.fcLoading ? 'Loading…' : fc ? 'Refresh forecast' : 'Load forecast'}</button></div>` };
    }
    case 'trigger': { const t = +(S.trig ?? 2); return { l: 'Parcel start', u: 'trigger excess', html: `<div class="row" style="flex:1;justify-content:space-between"><button class="wcb" data-act="trigm" aria-label="Less">−</button><span class="num" style="font-size:34px">+${t.toFixed(1)} °C</span><button class="wcb" data-act="trigp" aria-label="More">+</button></div>` }; }
    case 'places': {
      const f = st.fix, wide = curBox.w > 430, ctlH = wide ? 52 : 100, rows = Math.max(1, Math.floor((curBox.h - 34 - ctlH) / 46));
      const ctl = `<div class="row" style="flex-wrap:wrap;gap:4px;flex-shrink:0"><button class="wcb wide" data-act="rad">${S.poiRadius} km</button>${[['town', 'Towns'], ['airport', 'Airports'], ['peak', 'Peaks']].map(([k, n]) => `<button class="wcb wide" data-act="kind:${k}" aria-pressed="${!!S.poiKinds[k]}">${n}</button>`).join('')}<button class="wcb wide" data-act="start">Start here</button><button class="wcb wide" data-act="refresh" aria-label="Refresh">↻</button></div>`;
      let list = '';
      if (!f) list = '<div class="ws" style="white-space:normal">Waiting for GPS…</div>';
      else {
        const L1 = visiblePlaces().map((p) => ({ ...p, d: dist(f.lat, f.lon, p.lat, p.lon), b: brg(f.lat, f.lon, p.lat, p.lon) })).sort((a, b) => (b.kind === 'start') - (a.kind === 'start') || a.d - b.d).slice(0, rows);
        list = L1.length ? L1.map((p) => `<div class="li" style="min-height:44px;padding:3px 0"><svg width="30" height="30" viewBox="0 0 34 34" aria-hidden="true" style="flex-shrink:0"><circle cx="17" cy="17" r="15" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="1.5"/><g transform="rotate(${p.b} 17 17)"><path d="M17 4l6 12-6-3-6 3z" fill="currentColor"/><line x1="17" y1="13" x2="17" y2="28" stroke="currentColor" stroke-width="2"/></g></svg><div class="grow" style="min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)} <span class="lbl">${esc(p.kind === 'town' || p.kind === 'start' ? p.sub : p.kind)}</span></div><div class="muted" style="font-size:12px">You are ${fDist(p.d)} ${compass(p.b + 180)} of it</div></div><div style="text-align:right"><div class="num" style="font-size:22px;line-height:1">${fDist(p.d)}</div><div class="muted" style="font-size:11px">brg ${pad3(p.b)}°</div></div></div>`).join('')
          : `<div class="ws" style="white-space:normal">${st.placesState === 'loading' ? 'Loading places from OpenStreetMap…' : (st.placesState || '').startsWith('error') ? 'Could not load places: ' + esc(st.placesState.slice(7)) + '. Needs mobile data.' : 'No places of these kinds in range.'}</div>`;
      }
      return { l: `Places within ${S.poiRadius} km`, html: ctl + `<div style="flex:1;min-height:0;overflow:hidden">${list}</div>` };
    }
    case 'aslist': {
      const s = airStatus(), rows = Math.max(1, Math.floor((curBox.h - 30) / 52)), inside = s.filter((x) => x.inside && x.vert === 'in');
      const l = !st.airspaces.length ? 'Airspace · no data loaded' : inside.length ? 'Inside ' + inside.map((x) => x.a.name).join(', ') : 'Not inside any loaded airspace';
      const body = s.slice(0, rows).map((x) => `<div class="li" style="min-height:48px;padding:3px 0"><span style="width:14px;height:14px;border-radius:3px;border:2px solid ${airColor(x.a)};flex-shrink:0"></span><div class="grow" style="min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.a.name)} <span class="muted" style="font-weight:400">· ${fmtLim(x.a.lo)} – ${fmtLim(x.a.hi)}</span></div><div class="muted" style="font-size:12px">${x.inside ? (x.vert === 'in' ? 'You are inside' : x.vert === 'below' ? `Inside the area, ${Math.round(x.lo - x.alt)} m below the floor` : `Inside the area, ${Math.round(x.alt - x.hi)} m above the top`) : `${fDist(x.d)} away · you are ${x.vert === 'below' ? 'below its floor' : x.vert === 'above' ? 'above its top' : 'within its height band'}`}</div></div></div>`).join('') || `<div class="ws" style="white-space:normal">${st.airspaces.length ? 'No airspace within 30 km.' : 'Load airspace in Settings → Airspace data.'}</div>`;
      return { l, html: `<div style="flex:1;min-height:0;overflow:hidden">${body}</div>` };
    }
    case 'radio': {
      const s = airStatus(), fr = []; s.slice(0, 5).forEach((x, i) => x.a.freq.forEach((q) => { if (fr.length < 8 && !fr.find((y) => y.v === q.v)) fr.push({ ...q, on: i === 0 }); }));
      const cols = curBox.w > 520 ? 4 : curBox.w > 330 ? 3 : 2;
      return { l: 'Radio', u: 'from airspace data', html: fr.length ? `<div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:6px;overflow:hidden">${fr.map((q) => `<div class="freq ${q.on ? 'on' : ''}"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(q.n)}</div><div class="num" style="font-size:24px">${esc(q.v)}</div></div>`).join('')}</div>` : '<div class="ws" style="white-space:normal">No frequencies in the loaded airspace data.</div>' };
    }
    case 'notams': {
      const R = (+c.radius || S.notamRadius || 50) * 1000;
      const list = NOTAMS.map((n) => ({ n, d: ntWhere(n), s: ntState(n) })).filter((x) => x.s !== 'over');
      const near = list.filter((x) => x.d != null && x.d <= R).sort((a, b) => (a.s === 'active' ? 0 : 1) - (b.s === 'active' ? 0 : 1) || a.d - b.d), rest = list.filter((x) => !(x.d != null && x.d <= R));
      ntView = ntShowAll ? near.concat(rest) : near;
      const rows = Math.max(1, Math.floor((curBox.h - 96) / 54)), age = st.notamAt ? Math.round((Date.now() - st.notamAt) / 60000) : null;
      const ctl = `<div class="row" style="gap:4px;flex-shrink:0"><button class="wcb wide" data-act="ntrefresh">${st.ntLoading ? 'Loading…' : 'Refresh'}</button>${NOTAMS.length ? `<button class="wcb wide" data-act="ntall">${ntShowAll ? 'Only nearby' : 'Show all ' + list.length}</button>` : ''}<span class="ws" style="margin-left:auto">${age != null ? 'ais.fi · ' + age + ' min ago' : ''}</span></div>`;
      const body = (st.ntMsg ? `<div class="ws" style="white-space:normal">${esc(st.ntMsg)}</div>` : '') + ntView.slice(0, rows).map((x) => `<button class="li" data-act="notam:${esc(x.n.id)}" style="min-height:50px;padding:3px 0"><span class="badge ${x.s === 'active' ? 'act' : ''}">${x.s === 'active' ? 'Active' : fmtZ(x.n.from)}</span><span class="grow" style="font-size:13px;min-width:0;overflow:hidden"><b>${esc(x.n.text.slice(0, 60))}${x.n.text.length > 60 ? '…' : ''}</b><br><span class="muted">${esc(x.n.lower ? x.n.lower + ' – ' + x.n.upper : x.n.ad || x.n.sec)}${x.d != null ? ' · ' + (x.d === 0 ? 'you are inside' : fDist(x.d)) : ''}</span></span><span aria-hidden="true">›</span></button>`).join('') + (!NOTAMS.length && !st.ntMsg ? '<div class="ws" style="white-space:normal">Tap Refresh to load NOTAMs from ais.fi.</div>' : '');
      return { l: NOTAMS.length ? `NOTAM · ${near.length} within ${R / 1000} km` : 'NOTAM', html: ctl + `<div style="flex:1;min-height:0;overflow:hidden">${body}</div>` };
    }
  }
  return { l: W.type, v: '' };
}
// Vario widget in Bar or Dial mode (Number mode is a normal text widget, see wData)
function varioDraw(cv, W, el) {
  withU('uVario', W.cfg.units || '', () => {
    const win = +W.cfg.win || 0, v = win ? avgVario(win) ?? st.vario : st.vario, rg = +W.cfg.range || 5;
    el._sub = uV();
    if (W.cfg.mode === 'dial') { dialDraw(cv, Object.assign({}, W, { cfg: Object.assign({}, W.cfg, { range: rg }) }), v, true); return; }
    // bar: zero in the middle, climb up in orange, sink down in blue; the value beside it
    const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H); const bd = W.cfg.barDir || 'auto', vert = bd === 'v' || (bd !== 'h' && H >= Wd * 0.6), ink = css('--ink'), card = css('--card'), col = v >= 0 ? css('--climb') : css('--sink'), k = clamp(v / rg, -1, 1);
    c.font = '11px Barlow'; c.fillStyle = css('--muted'); c.strokeStyle = css('--line'); c.lineWidth = 1;
    const step = rg <= 3 ? 1 : rg <= 5 ? 1 : 2;
    if (vert) {
      // narrow: value on top and the bar under it; wide: bar on the left, value beside it
      const narrow = Wd < 170, fsN = narrow ? clamp(Math.min(Wd / 3, H * 0.18), 14, 60) : 0;
      const bw = narrow ? clamp(Wd - 34, 16, 90) : clamp(Wd * 0.32, 26, 90), x0 = narrow ? Math.max(22, (Wd - bw) / 2 + 8) : 22, y0 = narrow ? fsN + 10 : 6, y1 = H - 6, ym = (y0 + y1) / 2, hh = (y1 - y0) / 2;
      c.fillStyle = 'rgba(128,128,128,.12)'; c.fillRect(x0, y0, bw, y1 - y0);
      c.fillStyle = col; if (k >= 0) c.fillRect(x0, ym - k * hh, bw, k * hh); else c.fillRect(x0, ym, bw, -k * hh);
      c.fillStyle = css('--muted'); c.textAlign = 'right';
      for (let t = -rg; t <= rg; t += step) { const y = ym - t / rg * hh; c.strokeStyle = t === 0 ? ink : css('--line'); c.lineWidth = t === 0 ? 2 : 1; c.beginPath(); c.moveTo(x0 - 4, y); c.lineTo(x0 + bw, y); c.stroke(); if (H > 120 || t === 0 || Math.abs(t) === rg) c.fillText(String(t), x0 - 6, y + 4); }
      if (narrow) { c.font = `700 ${fsN}px Barlow Condensed`; c.textAlign = 'center'; c.fillStyle = col; c.fillText(fVario(v), Wd / 2, fsN + 2); }
      else { const tx = x0 + bw + 8, fs = clamp(Math.min(H * 0.4, (Wd - tx) / 3.2), 14, 140); c.font = `700 ${fs}px Barlow Condensed`; c.textAlign = 'left'; c.fillStyle = col; c.fillText(fVario(v), tx, ym + fs * 0.35); }
    } else {
      const bh = clamp(H * 0.34, 18, 60), x0 = 8, x1 = Wd - 8, xm = (x0 + x1) / 2, hw = (x1 - x0) / 2, yb = H - bh - 16;
      c.fillStyle = 'rgba(128,128,128,.12)'; c.fillRect(x0, yb, x1 - x0, bh);
      c.fillStyle = col; if (k >= 0) c.fillRect(xm, yb, k * hw, bh); else c.fillRect(xm + k * hw, yb, -k * hw, bh);
      c.fillStyle = css('--muted'); c.textAlign = 'center';
      for (let t = -rg; t <= rg; t += step) { const x = xm + t / rg * hw; c.strokeStyle = t === 0 ? ink : css('--line'); c.lineWidth = t === 0 ? 2 : 1; c.beginPath(); c.moveTo(x, yb - 3); c.lineTo(x, yb + bh + 3); c.stroke(); if (Wd > 220 || t === 0 || Math.abs(t) === rg) c.fillText(String(t), x, H - 3); }
      const fs = clamp(yb - 6, 14, 140); c.font = `700 ${fs}px Barlow Condensed`; c.textAlign = 'center'; c.fillStyle = col; c.fillText(fVario(v), xm, yb - 6);
    }
  });
}
function dialDraw(cv, W, val, noMarker) {
  if (val == null) val = st.vario;
  const [c, Wd, H] = fitCanvas(cv); c.clearRect(0, 0, Wd, H); const cx = Wd / 2, cy = H / 2, R = Math.min(Wd, H) / 2 - 6; const rg = +W.cfg.range || 5;
  const ang = (v) => (180 + clamp(v, -rg, rg) / rg * 150) * D2R; const P = (v, r) => [cx + r * Math.cos(ang(v)), cy + r * Math.sin(ang(v))];
  c.lineWidth = Math.max(4, R * 0.08); c.strokeStyle = css('--climb3'); c.beginPath(); c.arc(cx, cy, R * 0.9, ang(0), ang(rg)); c.stroke(); c.strokeStyle = 'rgba(30,80,200,.25)'; c.beginPath(); c.arc(cx, cy, R * 0.9, ang(-rg), ang(0)); c.stroke();
  if (val > 0) { c.strokeStyle = css('--climb'); c.beginPath(); c.arc(cx, cy, R * 0.9, ang(0), ang(val)); c.stroke(); }
  c.strokeStyle = css('--ink'); c.fillStyle = css('--ink'); c.font = `700 ${Math.max(10, R * 0.16)}px Barlow Condensed`; c.textAlign = 'center';
  for (let i = -rg; i <= rg; i++) { const [x1, y1] = P(i, R * 0.78), [x2, y2] = P(i, R * 0.98); c.lineWidth = i % (rg / 5 * 2) === 0 ? 2.5 : 1.2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); if (i % (rg / 5 * 2) === 0 && (R >= 55 || i === 0 || Math.abs(i) === rg)) { const [tx, ty] = P(i, R * 0.6); c.fillText(String(i), tx, ty + R * 0.06); } } // small: only 0 and the ends
  if (!noMarker && +W.cfg.win) { const a = avgVario(+W.cfg.win); if (a != null) { const [x, y] = P(a, R * 0.9); c.fillStyle = css('--card'); c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, R * 0.07, 0, 7); c.fill(); c.stroke(); } }
  const [nx, ny] = P(val, R * 0.86); c.lineWidth = Math.max(3, R * 0.05); c.lineCap = 'round'; c.strokeStyle = css('--ink'); c.beginPath(); c.moveTo(cx, cy); c.lineTo(nx, ny); c.stroke(); c.beginPath(); c.arc(cx, cy, R * 0.07, 0, 7); c.fill();
  c.fillStyle = val >= 0 ? css('--climb') : css('--sink'); c.font = `700 ${R * 0.3}px Barlow Condensed`; c.fillText(fVario(val), cx + R * 0.3, cy + R * 0.42);
}
function numRow(key, name, spec, cur) {
  const isNum = (typeof cur === 'number' && isFinite(cur)) || (typeof cur === 'string' && cur !== '' && !isNaN(+cur)), v = isNum ? +cur : null;
  const pres = (spec.extra || []).map(([val, l]) => `<button class="pill" data-nv="${key}" data-nval="${val}" aria-pressed="${cur === val}">${l}</button>`).join('');
  return `<div class="opt"><span class="lbl">${name}${spec.hint ? ' · ' + spec.hint : ''}</span><div class="row"><button class="pill step" data-ns="${key}" data-dir="-1" aria-label="Less">−</button><input type="number" class="numin" inputmode="decimal" data-ni="${key}" value="${isNum ? v : ''}" placeholder="${(spec.extra || []).some((x) => x[0] === cur) ? '—' : ''}" min="${spec.min}" max="${spec.max}" step="${spec.snap ?? spec.step}" aria-label="${name}, ${spec.unit}"><span class="unit">${v === 0 && spec.zero ? spec.zero : spec.unit}</span><button class="pill step" data-ns="${key}" data-dir="1" aria-label="More">+</button></div>${pres ? `<div class="row" style="flex-wrap:wrap">${pres}</div>` : ''}</div>`;
}
function snapNum(spec, v) { const g = spec.snap ?? spec.step, d = (String(g).split('.')[1] || '').length; return clamp(+(Math.round(v / g) * g).toFixed(d), spec.min, spec.max); }
function tapRow(key, name, cur, G) {
  const GR0 = G || TAPG, g = GR0.find(([, l]) => l.some((x) => x[0] === cur)) || GR0[0], btn = (v, n, extra) => `<button class="pill ${extra || ''}" data-ok="${key}" data-ov="${v}" aria-pressed="${String(cur) === String(v)}">${n}</button>`;
  return `<div class="opt"><span class="lbl">${name}</span><div class="row">${GR0.map(([n, l]) => `<button class="pill" data-ok="${key}" data-ov="${l[0][0]}" data-grp="${n}" aria-pressed="${g[0] === n}">${n}</button>`).join('')}</div>${g[1].length > 1 ? `<div class="row sub">${g[1].map(([v, n]) => btn(v, n)).join('')}</div>` : ''}</div>`;
}
function optRow(key, name, opts, cur) { if (key === 'tap') return tapRow(key, name, cur, TAPG); if (key === 'hold') return tapRow(key, name, cur, HOLDG);
  if (opts === 'INFO') { const sel = Array.isArray(cur) && cur.length ? cur : ['heights']; return `<div class="opt"><span class="lbl">${name} · tap to add or remove</span><div class="row">${INFO_KEYS().map(([k, n]) => `<button class="pill" data-info="${k}" aria-pressed="${sel.includes(k)}">${esc(n)}</button>`).join('')}</div></div>`; }
  if (opts === 'TEXT') return `<div class="opt"><label class="lbl" for="wsT_${key}">${name}</label><input type="text" id="${key === 'infoText' ? 'wsInfoText' : 'wsT_' + key}" data-txt="${key}" value="${esc(cur || '')}" placeholder="${key === 'infoText' ? 'Optional text shown on top, e.g. radio channel' : 'Leave empty for the default'}"></div>`; if (!Array.isArray(opts)) return numRow(key, name, opts, cur); return `<div class="opt"><span class="lbl">${name}</span><div class="row">${opts.map(([v, n]) => `<button class="pill" data-ok="${key}" data-ov="${v}" aria-pressed="${String(cur) === String(v)}">${n}</button>`).join('')}</div></div>`; }
/* edit sheet layout: the widget's own options first, then related ones in folding sections (closed until opened, remembered while
   the app runs: st.sheetOpen), and runs of on/off options merged into one row of toggle chips. Every option stays reachable. */
const SHEET_SEC = [[/^(track|trackMin|heading|start|gsize)$/, 'Track and glider'], [/^(task|taskCol|taskStyle|taskW|towp|towpCol|towpStyle|towpW)$/, 'Task'],
  [/^home/, 'Line back to start'], [/^(air|notam)$/, 'Airspace'], [/^(places|pl[A-Z])/, 'Places'], [/^traffic/, 'Air traffic'], [/^reach/, 'Glide reach'], [/^land/, 'Landing fields'], [/^windA/, 'Wind arrow at you'],
  [/^(ctl|btnSz|ctlShow|me|ptr)$/, 'Buttons and position'], [/^(vis|towKeep|visDelay)$/, 'When shown'], [/^(tap|hold|infoItems|infoText)$/, 'Tap and hold'], [/^(size|bg|pad|showLabel)$/, 'Look']];
const isBoolOpt = (o) => Array.isArray(o) && o.length === 2 && o.every((x) => typeof x[0] === 'boolean');
function optRows(list) { // list of [key, name, opts, current]
  let h = '';
  for (let i = 0; i < list.length;) {
    let j = i; while (j < list.length && isBoolOpt(list[j][2])) j++;
    if (j - i >= 2) { // two or more on/off options in a row: one row of toggles
      h += `<div class="opt"><span class="lbl">On / off · tap to switch</span><div class="row">${list.slice(i, j).map(([k, n, , cur]) => { const on = cur === true || cur === 'true'; return `<button class="pill tog" data-ok="${k}" data-ov="${!on}" aria-pressed="${on}">${on ? '✓ ' : ''}${esc(n)}</button>`; }).join('')}</div></div>`;
      i = j; continue; }
    const [k, n, o, cur] = list[i]; h += optRow(k, n, o, cur); i++;
  }
  return h;
}
function sheetGroups(list) {
  const main = [], secs = SHEET_SEC.map(([, t]) => [t, []]);
  list.forEach((r) => { const i = SHEET_SEC.findIndex(([re]) => re.test(r[0])); (i < 0 ? main : secs[i][1]).push(r); });
  const open = st.sheetOpen || (st.sheetOpen = new Set());
  return optRows(main) + secs.filter(([, l]) => l.length).map(([t, l]) => `<details class="wsSec" data-sec="${esc(t)}"${open.has(t) ? ' open' : ''}><summary>${esc(t)} <span class="muted">${l.length}</span></summary>${optRows(l)}</details>`).join('');
}
let sheetMode = 'normal', sheetFor = null;
function sheetSide(W) { const side = S.sheetSide || ((W.x + W.w / 2) / GC > 0.5 ? 'left' : 'right'); $('wSheet').classList.toggle('left', side === 'left'); }
function closeSheet() { $('wSheet').classList.remove('on'); wSel = null; if (st.force && st.sheetForce) { st.force = false; st.sheetForce = false; updateMode(); } sheetFor = null; renderWidgets(); }
function openSheet(id) {
  const W = S.layout.find((x) => x.id === id); if (!W) return; if (sheetFor !== id) { sheetMode = 'normal'; sheetFor = id; if (st.sheetForce) { st.force = false; st.sheetForce = false; updateMode(); } } wSel = id; const T = WT[W.type];
  const tm = sheetMode === 'thermal', hasT = !!W.cfgT, D = tm && hasT ? W.cfgT : W.cfg;
  const read = (k, d) => { const v = tm && hasT && W.cfgT[k] !== undefined ? W.cfgT[k] : W.cfg[k]; return v ?? d; };
  const dflt = (k, o) => (T.def && T.def[k] !== undefined ? T.def[k] : k === 'tap' ? defTap(W) : k === 'hold' ? defHold(W) : k === 'infoItems' ? ['heights'] : k === 'infoText' || o === 'TEXT' ? '' : Array.isArray(o) ? o[0][0] : o.def ?? o.presets[0]);
  const opts = T.o.concat(COMMON).filter(([k]) => !(tm && (k === 'vis' || k === 'visDelay' || k === 'towKeep')) && !(k === 'towKeep' && W.cfg.vis !== 'tow') && !((k === 'infoItems' || k === 'infoText') && read('tap', defTap(W)) !== 'custom' && read('hold', defHold(W)) !== 'custom') && !(!tm && k === 'showLabel') && !(k === 'ctlShow' && !T.canvas) && !(k === 'visDelay' && (W.cfg.vis || 'always') === 'always')).map(([k, n, o]) => [k, n, o, read(k, dflt(k, o))]); const optsH = sheetGroups(opts);
  const typeOpts = Object.entries(WT).map(([k, t]) => `<option value="${k}" ${k === W.type ? 'selected' : ''}>${t.n}</option>`).join('');
  const tabs = `<div class="row"><button class="pill grow" data-sm="normal" aria-pressed="${!tm}">Normal${hasT && !tm ? ' •' : ''}</button><button class="pill grow" data-sm="thermal" aria-pressed="${tm}">When thermaling${hasT ? ' •' : ''}</button></div>`;
  let body;
  if (!tm) body = `<div class="opt"><label class="lbl" for="wsType">Widget</label><select id="wsType">${typeOpts}</select></div>
    <div class="opt"><label class="lbl" for="wsLabel">Title</label><div class="row wsTitle"><input type="text" id="wsLabel" value="${esc(W.cfg.label || '')}" placeholder="${esc(T.n)}"><button class="pill" data-ok="showLabel" data-ov="true" aria-pressed="${W.cfg.showLabel !== false && W.cfg.showLabel !== 'false'}">Show</button><button class="pill" data-ok="showLabel" data-ov="false" aria-pressed="${!(W.cfg.showLabel !== false && W.cfg.showLabel !== 'false')}">Hide</button></div></div>
    ${optsH}
    <div class="opt"><span class="lbl">Size · grid cells, drag the widget to move it</span>${[['w', 'Width'], ['h', 'Height']].map(([k, n]) => `<div class="row wsSize"><span class="wsK">${n}</span><button class="pill step" data-wsz="${k}-" aria-label="${n} less">−</button><input type="number" class="numin" inputmode="decimal" data-wsi="${k}" value="${+(W[k] / GSC).toFixed(2)}" step="0.5" aria-label="${n}, grid cells"><button class="pill step" data-wsz="${k}+" aria-label="${n} more">+</button></div>`).join('')}</div>
    <div class="row" style="flex-wrap:wrap;margin-top:6px"><button class="btn" id="wsDup">Duplicate</button><button class="btn" id="wsFront">Bring to front</button><button class="btn warn" id="wsDel">Delete</button></div>`;
  else body = `<div class="muted" style="line-height:1.4">Shown live on the page now. These settings replace the normal ones only while thermaling is detected; everything you leave alone stays as in Normal.</div>
    <div class="opt"><span class="lbl">Different settings when thermaling</span><div class="row"><button class="pill" data-tm="off" aria-pressed="${!hasT}">Off</button><button class="pill" data-tm="on" aria-pressed="${hasT}">On</button></div></div>${hasT ? optsH + '<div class="row"><button class="btn" data-tm="clear">Clear thermal changes</button></div>' : ''}`;
  $('wSheet').innerHTML = `<div class="row wsHead" id="wsHead"><span class="grip" aria-hidden="true">⠿</span><h2>${T.n}</h2><button class="btn" id="wsFlip" aria-label="Move settings to the other side">⇄</button><button class="btn primary" id="wsClose">Close</button></div>${tabs}${body}`;
  $('wSheet').querySelectorAll('details.wsSec').forEach((d) => d.addEventListener('toggle', () => { const o = st.sheetOpen || (st.sheetOpen = new Set()); d.open ? o.add(d.dataset.sec) : o.delete(d.dataset.sec); }));
  sheetSide(W); $('wSheet').classList.add('on'); renderWidgets(); bannerAvoid(document.querySelector(`.wg[data-id="${W.id}"]`));
  { const sh0 = $('wSheet'), hd = $('wsHead'); $('wsFlip').onclick = () => { S.sheetSide = sh0.classList.contains('left') ? 'right' : 'left'; save(); sheetSide(W); };
    hd.onpointerdown = (e) => { if (e.target.closest('button')) return; hd.setPointerCapture(e.pointerId); const sx = e.clientX; let dx = 0; sh0.style.transition = 'none';
      hd.onpointermove = (m) => { dx = m.clientX - sx; sh0.style.transform = `translateX(${dx}px)`; };
      hd.onpointerup = hd.onpointercancel = (u) => { hd.onpointermove = hd.onpointerup = hd.onpointercancel = null; sh0.style.transform = ''; if (Math.abs(dx) > 24) { S.sheetSide = u.clientX < innerWidth / 2 ? 'left' : 'right'; save(); } sheetSide(W); }; }; }
  $('wsClose').onclick = closeSheet;
  const sh = $('wSheet'), q = (sel, fn) => sh.querySelectorAll(sel).forEach(fn);
  q('[data-sm]', (b) => (b.onclick = () => { sheetMode = b.dataset.sm; if (sheetMode === 'thermal') { st.force = true; st.sheetForce = true; } else if (st.sheetForce) { st.force = false; st.sheetForce = false; } updateMode(); renderWidgets(); openSheet(id); }));
  q('[data-tm]', (b) => (b.onclick = () => { const a = b.dataset.tm; if (a === 'on' && !W.cfgT) W.cfgT = {}; if (a === 'off') delete W.cfgT; if (a === 'clear') W.cfgT = {}; saveLayout(); openSheet(id); }));
  if ($('wsType')) $('wsType').onchange = (e) => { W.type = e.target.value; saveLayout(); openSheet(W.id); };
  if ($('wsLabel')) $('wsLabel').oninput = (e) => { W.cfg.label = e.target.value; saveLayout(); };
  if ($('wsDup')) $('wsDup').onclick = () => { const n = JSON.parse(JSON.stringify(W)); n.id = newW(W.type).id; n.x = Math.min(GC - n.w, n.x + GSC); n.y = Math.min(GR - n.h, n.y + GSC); S.layout.push(n); saveLayout(); openSheet(n.id); toast('Widget duplicated · drag the copy where you want it'); };
  if ($('wsFront')) $('wsFront').onclick = () => { S.layout = S.layout.filter((x) => x !== W).concat(W); saveLayout(); };
  if ($('wsDel')) $('wsDel').onclick = () => { S.layout = S.layout.filter((x) => x !== W); closeSheet(); saveLayout(); toast('Widget deleted', [['Undo', () => { S.layout.push(W); saveLayout(); }]]); };
  const spec = (k) => (T.o.find((x) => x[0] === k) || [])[2];
  q('[data-nv]', (b) => (b.onclick = () => { const raw = b.dataset.nval; D[b.dataset.nv] = raw !== '' && !isNaN(+raw) ? +raw : raw; saveLayout(); openSheet(W.id); }));
  q('[data-ns]', (b) => (b.onclick = () => { const k = b.dataset.ns, sp = spec(k), c = D[k] ?? W.cfg[k] ?? dflt(k, sp), base = typeof c === 'number' ? c : sp.def ?? sp.min; D[k] = snapNum(sp, base + (+b.dataset.dir) * sp.step); saveLayout(); openSheet(W.id); }));
  q('[data-ni]', (i) => (i.onchange = () => { const k = i.dataset.ni, v = parseFloat(String(i.value).replace(',', '.')); if (isFinite(v)) D[k] = snapNum(spec(k), v); saveLayout(); openSheet(W.id); }));
  q('[data-info]', (b) => (b.onclick = () => { const k = b.dataset.info, cur = Array.isArray(D.infoItems) ? D.infoItems.slice() : (Array.isArray(W.cfg.infoItems) ? W.cfg.infoItems.slice() : ['heights']); const i = cur.indexOf(k); if (i >= 0) cur.splice(i, 1); else cur.push(k); D.infoItems = cur; saveLayout(); openSheet(W.id); }));
  q('[data-txt]', (e) => (e.oninput = () => { D[e.dataset.txt] = e.value.slice(0, 120); saveLayout(); }));
  q('[data-ok]', (b) => (b.onclick = () => { const raw = b.dataset.ov; D[b.dataset.ok] = raw === 'true' ? true : raw === 'false' ? false : raw !== '' && !isNaN(+raw) ? +raw : raw; saveLayout(); openSheet(W.id); }));
  q('[data-wsz]', (b) => (b.onclick = () => { const k = b.dataset.wsz; if (k === 'w+') W.w = Math.min(GC - W.x, W.w + 2); if (k === 'w-') W.w = Math.max(6, W.w - 2); if (k === 'h+') W.h = Math.min(GR - W.y, W.h + 2); if (k === 'h-') W.h = Math.max(4, W.h - 2); saveLayout(); openSheet(W.id); }));
  q('[data-wsi]', (i) => (i.onchange = () => { const k = i.dataset.wsi, v = parseFloat(String(i.value).replace(',', '.')); if (isFinite(v)) { const n = Math.round(v * GSC / 2) * 2; if (k === 'w') W.w = clamp(n, 6, GC - W.x); else W.h = clamp(n, 4, GR - W.y); } saveLayout(); openSheet(W.id); }));
}
// the Add widget list, grouped by topic; thermal widgets near the top
const ADD_BTN = { 'button:pSwitch': ['Map / Thermal button', 'Switch page, hold for all pages'], 'button:fullscreen': ['Full screen button', 'Toggle full screen'], 'button:fai': ['FAI triangle button', 'FAI sectors on the map on/off'], 'button:copyTask': ['Copy task button', 'Copies the current task as a FlyXC link'], 'button:mute': ['Mute vario button', 'Vario sound on/off, red while muted'] };
const ADD_NEW = ['land', 'radar', 'rec', 'conn', 'tclock', 'baro', 'button:mute', 'radiomsg', 'thchip', 'airwarn', 'airbtn', 'tow', 'button:copyTask', 'theat', 'fai', 'button:fai', 'thead', 'tlayer', 't3d'];
const ADD_GROUPS = [
  ['Thermal', ['thchip', 'ta', 'theat', 'tlayer', 't3d', 'tside', 'tcross', 'thead', 'core', 'turn', 'climb', 'thermal', 'gain', 'ttime']],
  ['Vario & height', ['vario', 'varioDial', 'avg', 'alt', 'agl', 'tow', 'temp', 'baro']],
  ['Speed, wind & glide', ['land', 'gs', 'trk', 'compass', 'wind', 'windDir', 'ld', 'reqld', 'glide']],
  ['Map & task', ['map', 'radar', 'next', 'dist', 'fai', 'button:fai', 'button:copyTask']],
  ['Buttons', ['button:mute', 'button:pSwitch', 'button:fullscreen', 'button']],
  ['Weather', ['profile', 'cloud', 'cbase', 'ttop', 'outlook', 'groundT', 'trigger']],
  ['Airspace & places', ['radiomsg', 'airwarn', 'airbtn', 'air', 'asside', 'asmap', 'aslist', 'notams', 'radio', 'place', 'places']],
  ['Flight & tablet', ['rec', 'conn', 'tclock', 'flight', 'time', 'battery']]];
function openAdd() {
  const btn = (k, n, d, g) => `<button data-add="${k}" data-q="${esc((n + ' ' + d).toLowerCase())}">${ADD_NEW.includes(k) ? '<span class="newTag">New</span>' : ''}${n}<small>${d}</small></button>`, seen = new Set();
  const groups = ADD_GROUPS.map(([g, ks]) => [g, ks.filter((k) => WT[k.split(':')[0]])]);
  groups.forEach(([, ks]) => ks.forEach((k) => seen.add(k)));
  const rest = Object.keys(WT).filter((k) => !seen.has(k)); if (rest.length) groups.push(['Other', rest]);
  $('dlgBody').innerHTML = `<div class="row" style="justify-content:space-between"><span class="num" style="font-size:26px">Add widget</span><button class="btn primary" id="dlgClose">Close</button></div>`
    + `<div class="row addSearch"><input type="search" id="addQ" placeholder="Search widgets, e.g. wind, thermal, compass" aria-label="Search widgets" autocomplete="off"><button class="btn" id="addQx" aria-label="Clear search">✕</button></div><div id="addNone" class="muted" style="display:none">No widget matches.</div>`
    + groups.map(([g, ks]) => `<div class="addGroup"><h3 class="addH">${g}</h3><div class="addGrid">${ks.map((k) => (ADD_BTN[k] ? btn(k, ...ADD_BTN[k], g) : btn(k, WT[k].n, WT[k].d, g))).join('')}</div></div>`).join('');
  // search: every word must appear in the name or description
  const filt = () => { const ws = $('addQ').value.toLowerCase().split(/\s+/).filter(Boolean); let any = false;
    $('dlgBody').querySelectorAll('.addGroup').forEach((gr) => { let n = 0; gr.querySelectorAll('[data-add]').forEach((b) => { const ok = ws.every((w) => b.dataset.q.includes(w)); b.style.display = ok ? '' : 'none'; if (ok) n++; }); gr.style.display = n ? '' : 'none'; any = any || n > 0; });
    $('addNone').style.display = any ? 'none' : 'block'; };
  $('addQ').oninput = filt; $('addQx').onclick = () => { $('addQ').value = ''; filt(); };
  $('dlg').style.display = 'flex'; $('dlgClose').onclick = () => ($('dlg').style.display = 'none');
  $('dlgBody').querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => { const [t, pre] = b.dataset.add.split(':'), T = WT[t]; const W = newW(t, Math.round((GC - T.w * GSC) / 2), Math.round((GR - T.h * GSC) / 2)); if (pre) W.cfg.action = pre; S.layout.push(W); saveLayout(); $('dlg').style.display = 'none'; openSheet(W.id); }));
}
/* pointer handling on every page layer: long-press to edit, drag to move, corners to resize, pinch/wheel zoom on the thermal assistant */
(function wPointer() {
  let drag = null, lp = null, pinch = null; const ptrs = new Map();
  document.querySelectorAll('.wLayer').forEach((layer) => {
    layer.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.wg'); if (!el) return; const W = S.layout.find((x) => x.id === el.dataset.id); if (!W) return;
      if (!wEdit && e.target.closest('input')) return; // typing / pasting into a field inside a widget: no tap, no long-press edit
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, id: W.id });
      if (!wEdit) {
        if (ptrs.size >= 2) { if (lp) { clearTimeout(lp.t); lp = null; } if (ptrs.size === 2 && W.type === 'ta') { const [p, q] = [...ptrs.values()]; if (p.id === q.id) pinch = { W, d0: Math.hypot(p.x - q.x, p.y - q.y) || 1, z0: +effCfg(W).zoom || 1 }; } return; }
        if (pinch) return;
        // hold = the widget's "When held" behaviour (info shown while held, or an action); editing is in the menu
        const ae = e.target.closest('[data-act]'), ha = ae ? 'none' : effCfg(W).hold || defHold(W), me = { x: e.clientX, y: e.clientY, W, act: ae ? ae.dataset.act : null, ha };
        me.t = setTimeout(() => { if (lp !== me) return; me.held = true; me.shown = runHold(W, ha); }, 400); lp = me;
        return;
      }
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      drag = { W, el, mode: e.target.classList.contains('wh') ? 'size' : 'move', c: e.target.dataset.c || 'br', sx: e.clientX, sy: e.clientY, ox: W.x, oy: W.y, ow: W.w, oh: W.h, moved: false };
    });
    layer.addEventListener('pointermove', (e) => {
      const pp = ptrs.get(e.pointerId); if (pp) { pp.x = e.clientX; pp.y = e.clientY; }
      if (pinch && ptrs.size >= 2) { const [p, q] = [...ptrs.values()]; cfgW(pinch.W).zoom = clamp(pinch.z0 * Math.hypot(p.x - q.x, p.y - q.y) / pinch.d0, 0.25, 8); renderWidgets(); return; }
      if (lp && !lp.held && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) { clearTimeout(lp.t); lp = null; }
      if (!drag) return; const r = layer.getBoundingClientRect(); const dx = (e.clientX - drag.sx) / r.width * GC, dy = (e.clientY - drag.sy) / r.height * GR;
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 8) drag.moved = true; if (!drag.moved) return;
      const W = drag.W;
      if (drag.mode === 'move') { W.x = clamp(Math.round(drag.ox + dx), 0, GC - W.w); W.y = clamp(Math.round(drag.oy + dy), 0, GR - W.h); }
      else {
        const MW = 6, MH = 4, c = drag.c;
        if (c.includes('r')) W.w = clamp(Math.round(drag.ow + dx), MW, GC - drag.ox);
        else { const nx = clamp(Math.round(drag.ox + dx), 0, drag.ox + drag.ow - MW); W.w = drag.ow + (drag.ox - nx); W.x = nx; }
        if (c.includes('b')) W.h = clamp(Math.round(drag.oh + dy), MH, GR - drag.oy);
        else { const ny = clamp(Math.round(drag.oy + dy), 0, drag.oy + drag.oh - MH); W.h = drag.oh + (drag.oy - ny); W.y = ny; }
      }
      renderWidgets(); bannerAvoid(drag.el);
    });
    const up = (e) => {
      ptrs.delete(e.pointerId);
      if (pinch) { if (ptrs.size < 2) { save(); pinch = null; } return; }
      if (lp) { clearTimeout(lp.t); const l1 = lp; lp = null; if (l1.held) { endHold(l1.shown); return; } st.tapGuard = Date.now();
        const we = layer.querySelector(`.wg[data-id="${l1.W.id}"]`), hid = we && we.classList.contains('ctlOff') && we.querySelector('.wctl .wcb');
        if (hid && !l1.act) { we._ctlUntil = Date.now() + 6000; renderWidgets(); return; } // buttons hidden on a small widget: the first tap shows them
        if (we && l1.act && we._ctlUntil) we._ctlUntil = Date.now() + 6000; // pressing one keeps them a while longer
        if (l1.act) widgetAct(l1.W, l1.act); else handleTap(l1.W); return; }
      if (!drag) return; const d = drag; drag = null; if (!d.moved) openSheet(d.W.id); else saveLayout();
    };
    layer.addEventListener('pointerup', up);
    // a popup shown while holding covers the widget, so the release lands on it: end the hold wherever the finger lifts
    if (!window._holdEnd) { window._holdEnd = true; const endIt = () => { if (lp && lp.held) { const l1 = lp; lp = null; clearTimeout(l1.t); endHold(l1.shown); ptrs.clear(); } }; window.addEventListener('pointerup', endIt, true); window.addEventListener('pointercancel', endIt, true); }
    layer.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); if (lp) { clearTimeout(lp.t); if (lp.held) endHold(lp.shown); } lp = null; drag = null; if (ptrs.size < 2) pinch = null; });
    layer.addEventListener('contextmenu', (e) => e.preventDefault());
    layer.addEventListener('wheel', (e) => { if (wEdit) return; const el = e.target.closest('.wg[data-type="ta"]'); if (!el) return; const W = S.layout.find((x) => x.id === el.dataset.id); if (!W) return; e.preventDefault(); cfgW(W).zoom = clamp((+effCfg(W).zoom || 1) * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.25, 8); renderWidgets(); clearTimeout(window._zt); window._zt = setTimeout(save, 400); }, { passive: false });
  });
})();
$('wDone').onclick = exitEdit; $('wAdd').onclick = openAdd; $('wFlip').onclick = () => $('wBanner').classList.toggle('bottom');
// the edit bar moves to the other edge (top / bottom) when the widget you move, resize or configure is under it, if that edge is free
function bannerAvoid(el) {
  const b = $('wBanner'); if (!b || !el || !document.body.classList.contains('wedit')) return; const r = el.getBoundingClientRect(), br = b.getBoundingClientRect();
  const over = (y0, y1) => r.left < br.right && r.right > br.left && r.top < y1 && r.bottom > y0;
  if (!over(br.top, br.bottom)) return; const h = br.height, bottom = b.classList.contains('bottom'), y0 = bottom ? 8 : innerHeight - 8 - h;
  if (!over(y0, y0 + h)) b.classList.toggle('bottom');
}
// hamburger menu: full screen on/off (the label follows the state)
$('fullBtn').onclick = () => { setNav(false); toggleFull(); };
document.addEventListener('fullscreenchange', () => { const on = !!document.fullscreenElement; $('fullBtn').setAttribute('aria-pressed', String(on)); $('fullLbl').textContent = on ? 'Exit full screen' : 'Full screen'; });
$('editBtn').onclick = () => { setNav(false); if (!PAGEKEY[curPage]) showPage('pMap'); setTimeout(() => enterEdit(), 80); };
$('wReset').onclick = () => { const pk = pageKey(), old = S.layouts[pk]; S.layouts[pk] = defLayout(pk); saveLayout(); toast('Layout reset', [['Undo', () => { S.layouts[pk] = old; save(); renderWidgets(); }]]); };
window.addEventListener('resize', () => { document.querySelectorAll('.wLayer .wg').forEach((e) => (e._last = null)); renderWidgets(); });


