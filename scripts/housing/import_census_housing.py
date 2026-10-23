#!/usr/bin/env python3
"""Build src/lib/market/area-costs.json: what it costs to live in each area, from two public sources.

  python3 -I scripts/housing/import_census_housing.py CENSUS_DIR BEA_DIR

CENSUS_DIR holds acsdt5y2024-b25064.dat (median gross rent), acsdt5y2024-b25077.dat (median home value) and
Geos20245YR.txt, from https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/ (ACS 2020-2024).
BEA_DIR holds MARPP_MSA_2008_2024.csv and SARPP_STATE_2008_2024.csv, the Bureau of Economic Analysis regional price
parities (all items, United States = 100), from https://apps.bea.gov/regional/zip/MARPP.zip and SARPP.zip.
Keys are "METRO:<CBSA code>" (the code OccupationWage uses), "STATE:<FIPS>" and "NATIONAL:US". A figure a source did not
publish for an area is left out, never filled in.
"""
import csv, json, sys, pathlib, datetime

CENSUS_YEAR, BEA_YEAR = 2024, '2024'
LEVELS = {'010': 'NATIONAL', '040': 'STATE', '310': 'METRO'}

def table(path, col):
    out = {}
    with open(path, encoding='utf-8') as f:
        head = f.readline().rstrip('\n').split('|')
        i = head.index(col)
        for line in f:
            p = line.rstrip('\n').split('|')
            out[p[0]] = p[i]
    return out

def num(v):
    try:
        n = int(float(v))
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None  # the Bureau uses negative sentinels for "not available"

def rpp(path, kind):
    out = {}
    with open(path, encoding='latin-1', newline='') as f:
        for r in csv.DictReader(f):
            if (r.get('Description') or '').strip() != 'RPPs: All items':
                continue
            fips = (r['GeoFIPS'] or '').strip().strip('"')
            try:
                v = float(r[BEA_YEAR])
            except (TypeError, ValueError):
                continue
            if fips == '00000':
                out['NATIONAL:US'] = v
            elif kind == 'STATE' and fips.endswith('000') and len(fips) == 5:
                out[f'STATE:{fips[:2]}'] = v
            elif kind == 'METRO' and fips != '00999':
                out[f'METRO:{fips}'] = v
    return out

def main(census, bea):
    c, b = pathlib.Path(census), pathlib.Path(bea)
    rent = table(c / 'acsdt5y2024-b25064.dat', 'B25064_E001')
    home = table(c / 'acsdt5y2024-b25077.dat', 'B25077_E001')
    parity = {**rpp(b / 'SARPP_STATE_2008_2024.csv', 'STATE'), **rpp(b / 'MARPP_MSA_2008_2024.csv', 'METRO')}
    areas = {}
    with open(c / 'Geos20245YR.txt', encoding='utf-8', errors='replace') as f:
        head = f.readline().rstrip('\n').split('|')
        ix = {k: head.index(k) for k in ('SUMLEVEL', 'COMPONENT', 'STATE', 'CBSA', 'GEO_ID', 'NAME')}
        for line in f:
            p = line.rstrip('\n').split('|')
            if len(p) < len(head) or p[ix['SUMLEVEL']] not in LEVELS or p[ix['COMPONENT']] != '00':
                continue
            kind, gid = LEVELS[p[ix['SUMLEVEL']]], p[ix['GEO_ID']]
            code = {'NATIONAL': 'US', 'STATE': p[ix['STATE']], 'METRO': p[ix['CBSA']]}[kind]
            if not code:
                continue
            e = {'name': p[ix['NAME']]}
            r, h, q = num(rent.get(gid)), num(home.get(gid)), parity.get(f'{kind}:{code}')
            if r: e['rent'] = r
            if h: e['home'] = h
            if q: e['rpp'] = round(q, 1)
            if len(e) > 1:
                areas[f'{kind}:{code}'] = e
    doc = {
        'source': f'Census Bureau American Community Survey 5-year {CENSUS_YEAR - 4}-{CENSUS_YEAR} (median gross rent B25064, median home value B25077); BEA regional price parities {BEA_YEAR} (all items, US = 100)',
        'fetchedAt': datetime.date.today().isoformat(),
        'areas': dict(sorted(areas.items())),
    }
    dest = pathlib.Path(__file__).resolve().parents[2] / 'src/lib/market/area-costs.json'
    dest.write_text(json.dumps(doc, separators=(',', ':'), ensure_ascii=False) + '\n')
    n = lambda k: sum(1 for a in areas.values() if k in a)
    print(len(areas), 'areas; rent', n('rent'), 'home', n('home'), 'price parity', n('rpp'))

main(*sys.argv[1:3])
