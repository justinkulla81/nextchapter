#!/usr/bin/env python3
"""
Builds the geography + economic-development lead dataset from free federal
sources. No LLM calls, no paid APIs. Output goes to data/geo/*.json, which
scripts/geo/import-geo.ts then loads into the database.

  python3 scripts/geo/build_geo.py            # everything
  python3 scripts/geo/build_geo.py --only orgs

Sources
  Census ACS 5-year 2023   population, median household income, per-capita
                           income, occupation mix (white-collar share)
  BLS LAUS (API)           county unemployment rate + labor force, latest month
  NCES IPEDS HD2023        degree-granting colleges by county
  OpenStreetMap Overpass   data centers (telecom=data_center / building=data_center)
  Census geocoder          data-center coordinate -> county
  IRS Exempt Org BMF       economic development orgs, chambers, workforce nonprofits
  Census ZCTA-county file  org ZIP -> county

White- vs blue-collar unemployment is MODELED, not measured: no agency
publishes it by county. We take the county's measured unemployment rate and
its white-collar share (ACS management/business/science/arts), then split the
rate using the national white/blue-collar ratio from our own CPS work
(nextchapter-displacement-report). Counties with a high white-collar share and
low overall unemployment are where this is least reliable. It is labeled as an
estimate everywhere it appears.
"""
import csv, io, json, os, re, sys, time, zipfile
import urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'data', 'geo')
os.makedirs(OUT, exist_ok=True)
UA = 'NextChapter research (justin@launchyournextchapter.com)'


def env(name):
    if os.environ.get(name):
        return os.environ[name]
    for line in open(os.path.join(ROOT, '.env.local')):
        if line.startswith(name + '='):
            return line.split('=', 1)[1].strip().strip('"').strip("'")
    raise SystemExit(f'{name} missing')


def get(url, data=None, headers=None, timeout=90, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers={'User-Agent': UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            if i == retries - 1:
                raise
            time.sleep(2 * (i + 1))


def cached(name, fn):
    p = os.path.join(OUT, name)
    if os.path.exists(p):
        return json.load(open(p))
    v = fn()
    json.dump(v, open(p, 'w'))
    return v


STATE_ABBR = {
    '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC',
    '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
    '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT',
    '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
    '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
    '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY',
}
ABBR_FIPS = {v: k for k, v in STATE_ABBR.items()}


def num(x):
    try:
        v = float(x)
        return None if v < 0 else v
    except (TypeError, ValueError):
        return None


# ───────────────────────── national white/blue-collar ratio ─────────────────
def national_wc_ratio():
    """u_wc / u_bc from our CPS aggregates (latest year with both)."""
    p = os.path.join(ROOT, '..', 'nextchapter-displacement-report', 'data', 'cps_aggregates_jan_aug_2019_2025_2026.json')
    d = json.load(open(p))
    for yr in ('2026', '2025'):
        g = d[yr]['G']
        if 'wc' in g and 'blue' in g:
            lf_w, un_w = g['wc'][0], g['wc'][1]
            lf_b, un_b = g['blue'][0], g['blue'][1]
            return (un_w / lf_w) / (un_b / lf_b), yr, un_w / lf_w, un_b / lf_b
    raise SystemExit('no wc/blue in displacement data')


# ───────────────────────── Census ACS ────────────────────────────────────────
def acs():
    k = env('CENSUS_API_KEY')
    base = 'https://api.census.gov/data/2023/acs/acs5'
    a = json.loads(get(f'{base}?get=NAME,B01003_001E,B19013_001E,B19301_001E&for=county:*&in=state:*&key={k}'))
    b = json.loads(get(f'{base}/subject?get=S2401_C01_001E,S2401_C01_002E&for=county:*&in=state:*&key={k}'))
    sa = json.loads(get(f'{base}?get=NAME,B01003_001E,B19013_001E,B19301_001E&for=state:*&key={k}'))
    sb = json.loads(get(f'{base}/subject?get=S2401_C01_001E,S2401_C01_002E&for=state:*&key={k}'))
    occ = {tuple(r[-2:]): r[:2] for r in b[1:]}
    socc = {(r[-1],): r[:2] for r in sb[1:]}
    out = {}
    for r in a[1:]:
        st, co = r[4], r[5]
        if st not in STATE_ABBR:
            continue
        o = occ.get((st, co), [None, None])
        name = r[0].split(',')[0]
        out[st + co] = dict(fips=st + co, level='COUNTY', state=STATE_ABBR[st], name=name,
                            population=num(r[1]), medianHouseholdIncome=num(r[2]), perCapitaIncome=num(r[3]),
                            employed=num(o[0]), wcEmployed=num(o[1]))
    for r in sa[1:]:
        st = r[4]
        if st not in STATE_ABBR:
            continue
        o = socc.get((st,), [None, None])
        out[st] = dict(fips=st, level='STATE', state=STATE_ABBR[st], name=r[0],
                       population=num(r[1]), medianHouseholdIncome=num(r[2]), perCapitaIncome=num(r[3]),
                       employed=num(o[0]), wcEmployed=num(o[1]))
    return out


# ───────────────────────── BLS LAUS ──────────────────────────────────────────
def laus(fips_list):
    key = env('BLS_API_KEY')
    ids = []
    for f in fips_list:
        if len(f) == 5:
            ids += [f'LAUCN{f}0000000003', f'LAUCN{f}0000000006']
        else:
            ids += [f'LASST{f}0000000000003', f'LASST{f}0000000000006']
    out = {}
    for i in range(0, len(ids), 50):
        chunk = ids[i:i + 50]
        body = json.dumps({'seriesid': chunk, 'startyear': '2025', 'endyear': '2026', 'registrationkey': key}).encode()
        for attempt in range(4):
            res = json.loads(get('https://api.bls.gov/publicAPI/v2/timeseries/data/', data=body,
                                 headers={'Content-type': 'application/json'}, timeout=120))
            if res.get('status') == 'REQUEST_SUCCEEDED':
                break
            print('  BLS', res.get('message'), file=sys.stderr)
            time.sleep(5)
        else:
            raise SystemExit('BLS failed: ' + str(res.get('message')))
        for s in res['Results']['series']:
            sid = s['seriesID']
            kind = sid[-2:]
            fips = sid[5:10] if sid.startswith('LAUCN') else sid[5:7]
            months = {(d['year'], d['period']): num(d['value']) for d in s['data'] if d['period'].startswith('M')}
            if not months:
                continue
            latest = max(months)
            prior = (str(int(latest[0]) - 1), latest[1])
            rec = out.setdefault(fips, {})
            if kind == '03':
                rec['unemploymentRate'] = months[latest]
                rec['unemploymentRatePrior'] = months.get(prior)
                rec['unemploymentAsOf'] = f'{latest[0]}-{latest[1][1:]}'
            else:
                rec['laborForce'] = months[latest]
        print(f'  BLS {min(i + 50, len(ids))}/{len(ids)}', file=sys.stderr)
    return out


# ───────────────────────── IPEDS ─────────────────────────────────────────────
SIZE = {'1': 'under 1,000', '2': '1,000-4,999', '3': '5,000-9,999', '4': '10,000-19,999', '5': '20,000+'}
SIZE_MID = {'1': 500, '2': 3000, '3': 7500, '4': 15000, '5': 28000}


def ipeds():
    raw = get('https://nces.ed.gov/ipeds/datacenter/data/HD2023.zip')
    z = zipfile.ZipFile(io.BytesIO(raw))
    name = [n for n in z.namelist() if n.lower().endswith('.csv')][0]
    rows = csv.DictReader(io.TextIOWrapper(z.open(name), encoding='latin-1'))
    by = {}
    for r in rows:
        r = {k.lstrip('﻿').replace('ï»¿', ''): v for k, v in r.items()}
        if r.get('DEGGRANT') != '1' or r.get('CYACTIVE') != '1':
            continue
        c = (r.get('COUNTYCD') or '').zfill(5)
        if len(c) != 5 or c == '00000':
            continue
        by.setdefault(c, []).append(dict(name=r['INSTNM'], control={'1': 'Public', '2': 'Private nonprofit', '3': 'For-profit'}.get(r['CONTROL'], '?'),
                                         level='4-year' if r['ICLEVEL'] == '1' else '2-year' if r['ICLEVEL'] == '2' else '<2-year',
                                         size=SIZE.get(r['INSTSIZE']), est=SIZE_MID.get(r['INSTSIZE'], 0), web=r.get('WEBADDR') or None))
    return by


# ───────────────────────── data centers ──────────────────────────────────────
def data_centers():
    q = ('[out:json][timeout:100];area["ISO3166-1"="US"][admin_level=2]->.us;'
         '(nwr["telecom"="data_center"](area.us);nwr["building"="data_center"](area.us););out center tags;')
    d = json.loads(get('https://overpass-api.de/api/interpreter', data=urllib.parse.urlencode({'data': q}).encode(), timeout=180))
    pts = []
    for e in d['elements']:
        lat = e.get('lat') or (e.get('center') or {}).get('lat')
        lon = e.get('lon') or (e.get('center') or {}).get('lon')
        if lat is None:
            continue
        t = e.get('tags', {})
        pts.append(dict(id=f"{e['type']}/{e['id']}", lat=lat, lon=lon, name=t.get('name') or t.get('operator') or 'Unnamed data center', operator=t.get('operator')))

    def county(p):
        u = f"https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x={p['lon']}&y={p['lat']}&benchmark=Public_AR_Current&vintage=Current_Current&format=json"
        try:
            g = json.loads(get(u, timeout=40))['result']['geographies']['Counties'][0]
            return g['GEOID']
        except Exception:
            return None
    with ThreadPoolExecutor(8) as ex:
        for p, c in zip(pts, ex.map(county, pts)):
            p['county'] = c
    return pts


# ───────────────────────── IRS orgs ──────────────────────────────────────────
ECON_RE = re.compile(r'ECONOMIC DEVELOPMENT|ECONOMIC ALLIANCE|ECONOMIC PARTNERSHIP|ECONOMIC COUNCIL|ECONOMIC GROWTH|INDUSTRIAL DEVELOPMENT|INDUSTRIAL (AUTHORITY|FOUNDATION)|DEVELOPMENT ALLIANCE|DEVELOPMENT PARTNERSHIP|DEVELOPMENT AUTHORITY|DEVELOPMENT COUNCIL|(AREA|REGIONAL|METRO|COUNTY|CITY) DEVELOPMENT (CORP|FOUNDATION|GROUP|COMMISSION)|BUSINESS DEVELOPMENT (CORP|FOUNDATION|COUNCIL)|PARTNERSHIP FOR (PROGRESS|PROSPERITY|GROWTH)|GROWTH (ALLIANCE|PARTNERSHIP)')
ECON_EXCL = re.compile(r'WORKFORCE (INVESTMENT|DEVELOPMENT|BOARD)|STAND TOGETHER|AMERICANS FOR|BEVERAGE|INVITATIONAL|LEADERSHIP|FUND$|HOUSING|CHURCH|MINISTR|COMMUNITY DEVELOPMENT CORP|NEIGHBORHOOD|HABITAT|YOUTH|SCHOLARSHIP|CHILD|HEALTH|HOSPITAL|REAL ESTATE|CEMETER')
CHAMBER_RE = re.compile(r'CHAMBER OF COMMERCE|\bCHAMBER\b|BOARD OF TRADE|COMMERCE (ASSOCIATION|COUNCIL)')
CHAMBER_EXCL = re.compile(r'YOUNG PROFESSIONAL|FOUNDATION|SCHOLARSHIP|WOMEN|AFRICAN|BLACK|HISPANIC|LATIN|ASIAN|MUSIC|ORCHESTRA|CHORAL|CHAMBER (MUSIC|PLAYERS|ORCHESTRA|CHOIR|SINGERS|ENSEMBLE|OPERA|SYMPHONY)|CHURCH')
WORK_RE = re.compile(r'WORKFORCE|JOB TRAINING|EMPLOYMENT TRAINING|CAREER (CENTER|SERVICES|DEVELOPMENT|PATHWAY)|EMPLOYMENT (SERVICES|SOLUTIONS)|JOBS? (FOR|CORPS|PARTNERSHIP)|TALENT (ALLIANCE|PARTNERSHIP|DEVELOPMENT)|WORK ?FORCE')
WORK_EXCL = re.compile(r'TRUST|APPRENTICE|JOINT|TRAINING FUND|LOCAL \d|UNION|FOUNDATION FOR POPS|HOPE INITIATIVE|WORKFORCE (INVESTMENT|DEVELOPMENT) (BOARD|AREA|COUNCIL)|WORKFORCE BOARD|JOBSOHIO|CHAMBER|CHURCH|MINISTR|VETERAN HOME|HOUSING|HOSPITAL|SCHOLARSHIP|CHAMBER OF COMMERCE')


def classify(name, ntee, sub):
    n = name.upper()
    t = (ntee or '').upper()
    if CHAMBER_RE.search(n) and not CHAMBER_EXCL.search(n) and not re.search(r'UNITED STATES|STAND TOGETHER', n) and (sub == '06' or t.startswith('S4')):
        return 'CHAMBER'
    if (ECON_RE.search(n) or (t[:3] in ('S30', 'S31', 'S32') and re.search(r'DEVELOPMENT|ECONOMIC|ALLIANCE|PARTNERSHIP|AUTHORITY', n))) and not ECON_EXCL.search(n):
        return 'ECON_DEV'
    if (t[:3] in ('J20', 'J21', 'J22') or WORK_RE.search(n)) and not WORK_EXCL.search(n):
        return 'WORKFORCE'
    return None


def titlecase(s):
    small = {'of', 'and', 'for', 'the', 'inc', 'in', 'to', 'at', 'on'}
    words = s.lower().split()
    out = []
    for i, w in enumerate(words):
        out.append(w if (w in small and i) else w.capitalize())
    t = ' '.join(out)
    return re.sub(r'\b(Llc|Llp|Inc|Edc|Eda|Csu|Uk|Ky|Usa)\b', lambda m: m.group(1).upper(), t)


def irs_orgs(min_revenue=100_000):
    z2c = {}
    raw = get('https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt', timeout=180).decode('utf-8-sig')
    best = {}
    for r in csv.DictReader(io.StringIO(raw), delimiter='|'):
        z, c, a = r['GEOID_ZCTA5_20'], r['GEOID_COUNTY_20'], num(r['AREALAND_PART']) or 0
        if z and c and a >= best.get(z, (0, ))[0]:
            best[z] = (a, c)
    z2c = {z: c for z, (a, c) in best.items()}
    out = []
    for st in sorted(ABBR_FIPS):
        try:
            raw = get(f'https://www.irs.gov/pub/irs-soi/eo_{st.lower()}.csv', timeout=180).decode('latin-1')
        except Exception as e:
            print('  IRS', st, 'failed', e, file=sys.stderr)
            continue
        for r in csv.DictReader(io.StringIO(raw)):
            if r['STATUS'] != '01':
                continue
            kind = classify(r['NAME'], r['NTEE_CD'], r['SUBSECTION'])
            if not kind:
                continue
            rev = num(r['REVENUE_AMT']) or num(r['INCOME_AMT']) or 0
            if rev < min_revenue:
                continue
            z = r['ZIP'][:5]
            out.append(dict(ein=r['EIN'], name=titlecase(r['NAME']), kind=kind, city=titlecase(r['CITY']), state=r['STATE'], zip=z,
                            county=z2c.get(z), revenue=rev, assets=num(r['ASSET_AMT']) or 0, ntee=r['NTEE_CD'] or None,
                            subsection=r['SUBSECTION'], taxPeriod=r['TAX_PERIOD'], street=titlecase(r['STREET'])))
        print('  IRS', st, len(out), file=sys.stderr)
    return out


# ───────────────────────── assemble ──────────────────────────────────────────
def main():
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    ratio, ryear, uw, ub = national_wc_ratio()
    print(f'national WC/BC unemployment ratio {ratio:.3f} ({ryear}: WC {uw:.2%}, BC {ub:.2%})', file=sys.stderr)
    areas = cached('acs.json', acs)
    print('ACS areas', len(areas), file=sys.stderr)
    lz = cached('laus.json', lambda: laus(sorted(areas)))
    ip = cached('ipeds.json', ipeds)
    dcs = cached('datacenters.json', data_centers)
    orgs = cached('orgs.json', irs_orgs)

    dc_by = {}
    for p in dcs:
        if p['county']:
            dc_by.setdefault(p['county'], []).append(dict(name=p['name'], operator=p['operator'], id=p['id']))

    out = []
    for fips, a in areas.items():
        l = lz.get(fips, {})
        s = (a['wcEmployed'] / a['employed']) if a.get('employed') and a.get('wcEmployed') is not None else None
        u = l.get('unemploymentRate')
        wcu = bcu = None
        if s is not None and u is not None and 0 < s < 1:
            bcu = u / (s * ratio + 1 - s)
            wcu = bcu * ratio
        colleges = ip.get(fips, []) if a['level'] == 'COUNTY' else [c for k, v in ip.items() if k.startswith(fips) for c in v]
        colleges = sorted(colleges, key=lambda c: -c['est'])
        dcc = dc_by.get(fips, []) if a['level'] == 'COUNTY' else [d for k, v in dc_by.items() if k.startswith(fips) for d in v]
        out.append(dict(
            **{k: a[k] for k in ('fips', 'level', 'state', 'name', 'population', 'medianHouseholdIncome', 'perCapitaIncome')},
            laborForce=l.get('laborForce'), unemploymentRate=u, unemploymentRatePrior=l.get('unemploymentRatePrior'),
            unemploymentAsOf=l.get('unemploymentAsOf'),
            whiteCollarShare=round(s, 4) if s is not None else None,
            wcUnemploymentEst=round(wcu, 2) if wcu is not None else None, bcUnemploymentEst=round(bcu, 2) if bcu is not None else None,
            higherEdCount=len(colleges), higherEdEnrollmentEst=sum(c['est'] for c in colleges),
            higherEd=[{k: c[k] for k in ('name', 'control', 'level', 'size', 'web')} for c in colleges[:12]],
            dataCenterCount=len(dcc), dataCenters=dcc[:25],
        ))
    json.dump(dict(builtAt=time.strftime('%Y-%m-%d'), wcRatio=ratio, wcRatioYear=ryear, areas=out), open(os.path.join(OUT, 'areas.json'), 'w'))
    print('areas', len(out), 'orgs', len(orgs), file=sys.stderr)


if __name__ == '__main__':
    main()
