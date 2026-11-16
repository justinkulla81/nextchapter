#!/usr/bin/env python3
"""Builds src/lib/rankings/data/county-community.json: the county figures behind the safety, family, community-investment and
housing-supply criteria of the "best places for white-collar professionals" rankings (src/lib/rankings/metro-places.ts).

Two public files, downloaded by hand and passed as arguments (nothing is fetched here):
  County Health Rankings & Roadmaps 2025 analytic data (CDC, Census, NCES and other federal sources, compiled by the University of
  Wisconsin Population Health Institute):
    https://www.countyhealthrankings.org/sites/default/files/media/document/analytic_data2025_v2.csv
  Census Bureau Building Permits Survey, annual county file:
    https://www2.census.gov/econ/bps/County/co2025a.txt

  python3 -I scripts/rankings/build-county-community.py analytic_data2025_v2.csv co2025a.txt

Each county row is a fixed-order array (FIELDS); a figure the source does not publish for a county is null.
"""
import csv
import json
import os
import sys

# CHR variable code -> our short name. Units as published by CHR.
CHR = {
    'v015_rawvalue': 'homicides',        # homicide deaths per 100,000 people (CDC NVSS, 7-year)
    'v171_rawvalue': 'childCareCost',    # child care cost for two children as a share of median household income
    'v172_rawvalue': 'childCareCenters', # child care centers per 1,000 children under 5
    'v159_rawvalue': 'reading',          # average grade-level performance of 3rd graders in reading (Stanford Education Data Archive)
    'v160_rawvalue': 'math',             # the same, in math
    'v166_rawvalue': 'broadband',        # share of households with a broadband connection (ACS)
    'v169_rawvalue': 'schoolFunding',    # school funding adequacy: dollars per student above (+) or below (-) what is needed
    'v181_rawvalue': 'libraries',        # library locations per 10,000 people
    'v179_rawvalue': 'parks',            # share of people living within half a mile of a park
    'v137_rawvalue': 'longCommute',      # share of workers who drive alone and commute more than 30 minutes
}
FIELDS = list(CHR.values()) + ['permitUnits']


def num(s):
    s = (s or '').strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def main(chr_path, bps_path):
    out = {}
    with open(chr_path, encoding='latin-1', newline='') as f:
        r = csv.reader(f)
        next(r)
        codes = next(r)
        idx = {name: codes.index(code) for code, name in CHR.items()}
        fips_i = codes.index('fipscode')
        for row in r:
            fips = row[fips_i].strip().zfill(5)
            if len(fips) != 5 or fips.endswith('000'):
                continue  # national and state rows
            out[fips] = {name: num(row[i]) for name, i in idx.items()}
    # Building permits: total housing units authorised in the year (1-unit, 2-unit, 3-4 and 5+ columns, imputed figures).
    with open(bps_path, encoding='latin-1', newline='') as f:
        r = csv.reader(f)
        for row in r:
            if len(row) < 18 or not row[1].strip().isdigit() or not row[2].strip().isdigit():
                continue
            fips = row[1].strip().zfill(2) + row[2].strip().zfill(3)
            units = sum(int(float(row[i] or 0)) for i in (7, 10, 13, 16))
            out.setdefault(fips, {})['permitUnits'] = units
    year = os.path.basename(bps_path)[2:6]
    rows = {k: [None if v.get(f) is None else round(v[f], 4) for f in FIELDS] for k, v in sorted(out.items())}
    doc = {
        'fields': FIELDS,
        'sources': {
            'chr': 'County Health Rankings & Roadmaps 2025 (University of Wisconsin Population Health Institute), from CDC, Census, NCES and other federal data',
            'bps': f'Census Bureau Building Permits Survey, {year} annual county estimates',
        },
        'counties': rows,
    }
    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'lib', 'rankings', 'data', 'county-community.json')
    with open(dest, 'w') as f:
        json.dump(doc, f, separators=(',', ':'))
    print(f'{len(rows)} counties -> {os.path.normpath(dest)}', file=sys.stderr)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
