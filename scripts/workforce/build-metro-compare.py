#!/usr/bin/env python3
"""
Builds src/lib/workforce/data/metro-compare.json for the Compare places page:
every metropolitan area with its counties and its regional price parities.

Inputs (downloaded by hand, not committed):
  - Census CBSA delineation, July 2023 (list1_2023.xlsx):
    https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx
  - BEA Regional Price Parities by metro (MARPP.zip, MARPP_MSA_2008_2024.csv):
    https://apps.bea.gov/regional/zip/MARPP.zip

Usage: python3 scripts/workforce/build-metro-compare.py <list1_2023.xlsx> <MARPP_MSA_2008_2024.csv>

RPP is a price level with the U.S. at 100 (BEA, 2024). Stored as
[all items, goods, housing, utilities, other services] in that order.
"""
import csv, json, sys, os
import openpyxl

xlsx, rpp_csv = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'lib', 'workforce', 'data', 'metro-compare.json')

counties: dict[str, list[str]] = {}
names: dict[str, str] = {}
for row in openpyxl.load_workbook(xlsx, read_only=True).active.iter_rows(min_row=4, values_only=True):
    cbsa, _, _, title, kind, _, _, _, _, st, co, _ = row
    if not cbsa or kind != 'Metropolitan Statistical Area':
        continue
    counties.setdefault(cbsa, []).append(f'{st}{co}')
    names[cbsa] = title

rpp: dict[str, dict[int, float]] = {}
with open(rpp_csv, newline='', encoding='utf-8-sig') as fh:
    for r in csv.DictReader(fh):
        try:
            code = r['GeoFIPS'].strip().strip('"')
            rpp.setdefault(code, {})[int(r['LineCode'])] = float(r['2024'])
        except (TypeError, ValueError, AttributeError):
            pass  # footer notes and suppressed values

metros = []
for cbsa, fips in sorted(counties.items(), key=lambda kv: names[kv[0]]):
    p = rpp.get(cbsa)
    if not p or 1 not in p:
        continue
    metros.append({
        'c': cbsa,
        'n': names[cbsa],
        'f': sorted(set(fips)),
        'r': [p.get(i) for i in (1, 2, 3, 4, 5)],
    })

with open(OUT, 'w') as fh:
    json.dump({'year': 2024, 'metros': metros}, fh, separators=(',', ':'))
print(f'{len(metros)} metros, {sum(len(m["f"]) for m in metros)} counties -> {OUT}')
