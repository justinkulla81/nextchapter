#!/usr/bin/env python3
"""Build src/lib/pivots/occupation-cycle.json from four BLS OEWS national files (public domain).

  python3 -I scripts/pivots/import_cycle_swing.py nat_2007.xlsx nat_2010.xlsx nat_2019.xlsx nat_2020.xlsx \\
      soc_2000_to_2010_crosswalk.xlsx soc_2010_to_2018_crosswalk.xlsx

Arguments are the national estimate files (the 'national_M20XX_dl' or 'national_dl' sheet) for May 2007, May 2010,
May 2019 and May 2020, in that order, then the BLS SOC crosswalks 2000 to 2010 and 2010 to 2018 (.xls converted to .xlsx).
May 2007 is in SOC 2000, May 2010 in SOC 2010, and May 2019 and 2020 in SOC 2018 with BLS's own combined codes (for
example 13-2098 for financial analysts, risk specialists and other financial specialists). The app uses 2018 codes.
Codes are linked through the crosswalks and the combined codes into groups. A group is kept only when every code in it
is in its year's file, it is small (at most 6 codes per edition, 5 in 2018) and its change is plausible. When a group
holds more than one 2018 code, the history is for those jobs together and the file says which (field 'group').
Episodes: 2007 to 2010 (the Great Recession) and 2019 to 2020 (the pandemic).
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
    code, emp, ttl = col('occ_code'), col('tot_emp'), col('occ_title')
    grp = next((head.index(n) for n in ('o_group', 'occ_group', 'group') if n in head), None)
    naics = head.index('naics') if 'naics' in head else None
    own = head.index('own_code') if 'own_code' in head else None
    out, total, titles = {}, None, {}
    for r in rows:
        if naics is not None and str(r[naics]).strip() != '000000':
            continue  # 2019 and later files carry one row per industry; keep cross-industry
        if own is not None and str(r[own]).strip() != '1235':
            continue
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
            titles[c] = str(r[ttl] or '')
    if not total or not out:
        raise SystemExit(f'No total or detailed rows found in {path}')
    return total, out, titles

# OEWS combined codes that are not broad groups (those end in 0 and take every 2018 code sharing their first 6 characters).
COMBINED = {
    '11-9198': ['11-9072', '11-9179', '11-9199'],
    '13-1198': ['13-1082', '13-1199'],
    '13-2098': ['13-2051', '13-2054', '13-2099'],
    '15-1245': ['15-1242', '15-1243'],
    '15-1256': ['15-1252', '15-1253'],
    '15-1257': ['15-1254', '15-1255'],
    '15-2098': ['15-2051', '15-2099'],
}

TITLES = {}  # 2018 code to title, from the crosswalk

# Codes BLS redefined between editions so that neither alone is comparable; their sum is.
MERGE = [('43-6011', '43-6014')]  # executive secretaries and administrative assistants, and other secretaries

def crosswalk(path):
    import openpyxl
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    pairs = []
    for r in ws.iter_rows(values_only=True):
        a, b = (str(r[0] or '').strip(), str(r[2] or '').strip())
        if len(a) == 7 and a[2] == '-' and len(b) == 7 and b[2] == '-':
            pairs.append((a, b))
            TITLES[b] = str(r[3] or '').replace('(##)', '').strip()
    if not pairs:
        raise SystemExit(f'No code pairs found in {path}')
    return pairs

def main(paths):
    if len(paths) != 6:
        raise SystemExit(__doc__)
    t07, a07, _ = read(paths[0]); t10, a10, _ = read(paths[1]); t19, a19, _ = read(paths[2]); t20, a20, _ = read(paths[3])
    x0010, x1018 = crosswalk(paths[4]), crosswalk(paths[5])
    real18 = {b for _, b in x1018}
    parent = {}
    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    def union(a, b):
        parent[find(a)] = find(b)
    # nodes are tagged by edition so the same string in two editions stays separate
    for a, b in x0010: union('00:' + a, '10:' + b)
    for a, b in x1018: union('10:' + a, '18:' + b)
    combined_in = {}  # combined code -> members, for combined codes present in the 2019/2020 files
    for c in set(a19) | set(a20):
        if c in real18:
            continue
        members = COMBINED.get(c) or [m for m in real18 if c.endswith('0') and m[:6] == c[:6]]
        members = [m for m in members if m in real18]
        for m in members:
            union('18:' + c, '18:' + m)
        combined_in[c] = set(members)
    for a, b in MERGE:
        union('18:' + a, '18:' + b)
    groups = {}
    for n in list(parent):
        groups.setdefault(find(n), {'00': set(), '10': set(), '18': set()})[n[:2]].add(n[3:])
    pct = lambda a, b: round((b - a) / a * 100, 1)
    episodes = [
        {'label': '2007 to 2010', 'allJobsPct': pct(t07, t10)},
        {'label': '2019 to 2020', 'allJobsPct': pct(t19, t20)},
    ]
    occ = {}
    for g in groups.values():
        real = {c for c in g['18'] if c in real18}
        if not real or not g['00'] or not g['10'] or len(g['00']) > 6 or len(g['10']) > 6 or len(real) > 5:
            continue
        if not (all(c in a07 for c in g['00']) and all(c in a10 for c in g['10'])):
            continue
        present = [c for c in g['18'] if c in a19 and c in a20]
        covered = {c for c in present if c in real} | {m for c in present for m in combined_in.get(c, ())}
        if not present or real - covered or any(c in a19 and c not in a20 for c in g['18']):
            continue
        s07, s10 = sum(a07[c] for c in g['00']), sum(a10[c] for c in g['10'])
        s19, s20 = sum(a19[c] for c in present), sum(a20[c] for c in present)
        if min(s07, s19) < 5000:
            continue  # too small for a stable change
        change = [pct(s07, s10), pct(s19, s20)]
        if max(abs(x) for x in change) > 35:
            continue  # a swing this large over a few years is a reclassification, not the economy
        entry = {'pct': change}
        if len(real) > 1:
            entry['group'] = sorted(TITLES.get(c, c) for c in real)  # the history is for this set of jobs together
        for c in real:
            occ[c] = entry
    doc = {
        'source': 'BLS Occupational Employment and Wage Statistics, national estimates, May 2007, 2010, 2019 and 2020, linked to 2018 SOC through the BLS crosswalks',
        'fetchedAt': datetime.date.today().isoformat(),
        'episodes': episodes,
        'occupations': dict(sorted(occ.items())),
    }
    dest = pathlib.Path(__file__).resolve().parents[2] / 'src/lib/pivots/occupation-cycle.json'
    dest.write_text(json.dumps(doc, indent=1) + '\n')
    print(f'{len(occ)} occupations; episodes {episodes}')

main(sys.argv[1:])
