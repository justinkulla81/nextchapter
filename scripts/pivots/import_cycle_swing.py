#!/usr/bin/env python3
"""Build src/lib/pivots/occupation-cycle.json from four BLS OEWS national files (public domain).

  python3 -I scripts/pivots/import_cycle_swing.py nat_M2007.xls nat_M2010.xls nat_M2019.xlsx nat_M2020.xlsx

Arguments are the national estimate files (the 'national_M20XX_dl' or 'national_dl' sheet) for May 2007, May 2010,
May 2019 and May 2020, in that order. An occupation is kept only when its 6-digit code appears in both files of a
pair, so a code that changed meaning between SOC editions is dropped rather than guessed at. Episodes:
2007 to 2010 (the Great Recession) and 2019 to 2020 (the pandemic).
"""
import json, sys, datetime, pathlib

def read(path):
    import openpyxl
    if str(path).lower().endswith('.xls'):
        raise SystemExit('Convert .xls to .xlsx first (libreoffice --headless --convert-to xlsx).')
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    head = [str(c or '').strip().lower() for c in next(rows)]
    col = lambda *names: next(head.index(n) for n in names if n in head)
    code, emp = col('occ_code'), col('tot_emp')
    grp = next((head.index(n) for n in ('o_group', 'occ_group', 'group') if n in head), None)
    out, total = {}, None
    for r in rows:
        c = str(r[code] or '').strip()
        try:
            e = float(str(r[emp]).replace(',', ''))
        except (TypeError, ValueError):
            continue
        if c == '00-0000':
            total = e
        elif c.endswith('0000') or c.endswith('000'):
            continue  # major and minor groups
        elif grp is None or str(r[grp] or '').strip().lower() in ('detailed', ''):
            out[c] = e
    if not total or not out:
        raise SystemExit(f'No total or detailed rows found in {path}')
    return total, out

def main(paths):
    if len(paths) != 4:
        raise SystemExit(__doc__)
    t07, a07 = read(paths[0]); t10, a10 = read(paths[1]); t19, a19 = read(paths[2]); t20, a20 = read(paths[3])
    pct = lambda a, b: round((b - a) / a * 100, 1)
    episodes = [
        {'label': '2007 to 2010', 'allJobsPct': pct(t07, t10)},
        {'label': '2019 to 2020', 'allJobsPct': pct(t19, t20)},
    ]
    occ = {}
    for c in set(a07) & set(a10) & set(a19) & set(a20):
        if min(a07[c], a19[c]) < 5000:
            continue  # too small for a stable change
        occ[c] = {'pct': [pct(a07[c], a10[c]), pct(a19[c], a20[c])]}
    doc = {
        'source': 'BLS Occupational Employment and Wage Statistics, national estimates, May 2007, 2010, 2019 and 2020',
        'fetchedAt': datetime.date.today().isoformat(),
        'episodes': episodes,
        'occupations': dict(sorted(occ.items())),
    }
    dest = pathlib.Path(__file__).resolve().parents[2] / 'src/lib/pivots/occupation-cycle.json'
    dest.write_text(json.dumps(doc, indent=1) + '\n')
    print(f'{len(occ)} occupations; episodes {episodes}')

main(sys.argv[1:])
