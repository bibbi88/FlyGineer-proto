"""Fetch country airspace files (OpenAir) listed in XCSoar's data repository into data/airspace/.

XCSoar's repository (https://download.xcsoar.org/repository) is a plain text list of entries:
name=..., uri=..., type=airspace, area=fi, update=YYYY-MM-DD. The app reads data/airspace/index.json.
Entries marked "manual": true in index.json (files the owner downloaded, e.g. from airspace.xcontest.org) are kept as they are.
"""
import json, os, sys, urllib.request, datetime

REPO = 'https://download.xcsoar.org/repository'
# repository area -> (key and file name in data/airspace, name shown in the app); 'fi' is the owner's XContest file (manual)
AREAS = {'fi': ('fi_oaip', 'Finland (OpenAIP)'), 'se': ('se', 'Sweden'), 'no': ('no', 'Norway'), 'ee': ('ee', 'Estonia')}
OUT = 'data/airspace'

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'FlyGineer-proto airspace sync (github.com/bibbi88/FlyGineer-proto)'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

entries, cur = [], None
for line in get(REPO).decode('utf-8', 'replace').splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    k, v = k.strip(), v.strip()
    if k == 'name':
        cur = {'name': v}
        entries.append(cur)
    elif cur is not None:
        cur[k] = v

air = [e for e in entries if e.get('type') == 'airspace']
print(f'{len(entries)} repository entries, {len(air)} airspace files')
for e in air:
    print('  ', e.get('area'), e.get('name'), e.get('update'), e.get('uri'))

os.makedirs(OUT, exist_ok=True)
ipath = os.path.join(OUT, 'index.json')
old = json.load(open(ipath)) if os.path.exists(ipath) else {}
idx = {'source': 'XCSoar data repository (download.xcsoar.org) + manual files', 'countries': {k: v for k, v in old.get('countries', {}).items() if v.get('manual')}}
for area, (key, cname) in AREAS.items():
    cand = [e for e in air if (e.get('area') or '').lower() == area and e.get('uri')]
    if not cand:
        print(f'!! no airspace file for {area}')
        if key in old.get('countries', {}):
            idx['countries'][key] = old['countries'][key]
        continue
    e = sorted(cand, key=lambda e: e.get('update', ''))[-1]
    try:
        raw = get(e['uri'])
    except Exception as err:
        print(f'!! {area}: {err}')
        if key in old.get('countries', {}):
            idx['countries'][key] = old['countries'][key]
        continue
    try:
        txt = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        txt = raw.decode('latin-1')
    n = sum(1 for l in txt.splitlines() if l.strip().upper().startswith('AC '))
    if n < 3:
        print(f'!! {area}: only {n} airspaces in {e["uri"]}, skipped')
        continue
    with open(os.path.join(OUT, key + '.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(txt)
    idx['countries'][key] = {'name': cname, 'file': key + '.txt', 'airspaces': n, 'update': e.get('update') or datetime.date.today().isoformat(), 'from': e['uri']}
    print(f'ok {area}: {n} airspaces, update {e.get("update")}')

if not idx['countries']:
    sys.exit('no airspace files found')
with open(ipath, 'w') as f:
    json.dump(idx, f, indent=1)
    f.write('\n')
