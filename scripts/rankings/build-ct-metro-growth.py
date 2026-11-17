#!/usr/bin/env python3
"""Builds src/lib/rankings/data/ct-metro-growth.json: white-collar sector jobs in Connecticut's metro areas, 2022 and 2024, for the
"white-collar job growth" criterion of the best-places rankings (src/lib/rankings/metro-places.ts).

The county figures behind that criterion (county-context.json) have no 2022 jobs for Connecticut: BLS moved the state from its
counties to its planning regions, and publishes the regions from 2024 only. BLS QCEW also publishes each metro area as a whole,
for both years, so Connecticut's metros use that: private-sector jobs in information, finance and insurance, professional and
technical services and management of companies (NAICS 51, 52, 54, 55), annual averages. 2025 metro sector figures are not
published yet, so Connecticut's window is 2022 to 2024.

Download each metro's file into one folder (nothing is fetched here), named <year>-<area>.csv:
  https://data.bls.gov/cew/data/api/{2022,2024}/a/area/{C1486,C2554,C3530,C3598}.csv
  python3 -I scripts/rankings/build-ct-metro-growth.py <folder>
"""
import csv
import json
import os
import sys

METROS = {'C1486': '14860', 'C2554': '25540', 'C3598': '35980'}
# New Haven and Waterbury-Shelton are left out: the 2023 delineation split the old New Haven-Milford metro (New Haven County) and
# moved towns from Fairfield and Litchfield counties into Waterbury-Shelton, so neither has a 2022 figure for the same area.
SECTORS = {'51', '52', '54', '55'}


def jobs(path):
    total = 0
    with open(path, newline='') as f:
        for r in csv.DictReader(f):
            if r['own_code'] == '5' and r['agglvl_code'] == '44' and r['industry_code'] in SECTORS:
                if r['disclosure_code'] == 'N':
                    return None
                total += int(r['annual_avg_emplvl'])
    return total or None


def main(folder):
    out = {}
    for area, cbsa in METROS.items():
        then = jobs(os.path.join(folder, f'2022-{area}.csv'))
        now = jobs(os.path.join(folder, f'2024-{area}.csv'))
        if then and now:
            out[cbsa] = [then, now]
    doc = {'years': [2022, 2024], 'source': 'BLS Quarterly Census of Employment and Wages, metro areas, annual averages, private sector, NAICS 51, 52, 54 and 55', 'metros': out}
    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'lib', 'rankings', 'data', 'ct-metro-growth.json')
    with open(dest, 'w') as f:
        json.dump(doc, f, indent=1)
    print(json.dumps(out), file=sys.stderr)


if __name__ == '__main__':
    main(sys.argv[1])
