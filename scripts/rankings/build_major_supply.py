#!/usr/bin/env python3
"""Builds src/lib/rankings/data/major-supply.json: degrees awarded by major (CIP 4-digit series) from the federal IPEDS
Completions survey, for the supply side of the degree lists and the major pages.

Inputs (free, nces.ed.gov/ipeds/datacenter/data/<name>.zip), unzipped into one folder passed as the first argument:
  C2024_a.csv  completions, July 2023 to June 2024 (latest)
  c2021_a.csv  completions, July 2020 to June 2021 (base for the three-year change; same CIP 2020 codes)
  HD2024.csv   institution directory (name, state)
  CIPCode2020.csv  (nces.ed.gov/ipeds/cipcode/Files/CIPCode2020.csv) program titles

Counts first majors only (MAJORNUM 1), so a double major is one degree, and only degrees at bachelor's level and above
(AWLEVEL 5 bachelor's, 7 master's, 17/18/19 doctoral), plus associate degrees (3) kept apart for reference.
Also writes src/lib/rankings/data/college-majors/<ST>.json: each college's majors (up to 40, most degrees first) as
[cip series, bachelor's, master's, doctoral, bachelor's and above in the base year], for the college pages and the portal's
Academic Affairs workspace; and src/lib/rankings/data/college-index.json: every college with degrees at bachelor's level and
above as [name, state, control, degrees, base-year degrees, {degree field: degrees}], for its state's supply and its peers.
Run: python3 -I scripts/rankings/build_major_supply.py <folder>
"""
import csv, collections, json, os, re, sys

D = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'lib', 'rankings', 'data', 'major-supply.json')


def rows(name):
    with open(os.path.join(D, name), encoding='utf-8-sig', errors='replace', newline='') as f:
        yield from csv.DictReader(f)


def n(x):
    try:
        return int(float(x or 0))
    except ValueError:
        return 0


LEVEL = {'3': 'a', '5': 'b', '7': 'm', '17': 'd', '18': 'd', '19': 'd'}

# The field of study each major leads into, matched to the occupation groups in degrees-specs.ts (fieldOf), so a field's
# graduates and its open jobs are counted over the same grouping. Most specific prefix wins. Unlisted majors (English,
# history, the arts, liberal studies, ...) lead into many kinds of work and belong to no one field.
FIELD = [
    ('51.38', 'Nursing'), ('51.39', 'Nursing'), ('51.15', 'Social work and counseling'), ('51', 'Health professions and medicine'),
    ('52.03', 'Accounting'), ('52.08', 'Finance and economics'), ('52.06', 'Finance and economics'), ('45.06', 'Finance and economics'),
    ('52.14', 'Marketing and communications'), ('52.18', 'Marketing and communications'), ('09', 'Marketing and communications'),
    ('10', 'Marketing and communications'), ('52', 'Business administration and management'), ('44.04', 'Business administration and management'),
    ('30.70', 'Math and statistics'), ('30.71', 'Math and statistics'), ('27', 'Math and statistics'),
    ('30.08', 'Computer science and IT'), ('11', 'Computer science and IT'),
    ('04', 'Design and architecture'), ('50.04', 'Design and architecture'),
    ('14', 'Engineering'), ('15', 'Engineering'),
    ('26', 'Life sciences'), ('01', 'Life sciences'), ('03', 'Life sciences'),
    ('40', 'Physical sciences'), ('41', 'Physical sciences'),
    ('42', 'Social sciences and psychology'), ('44.05', 'Social sciences and psychology'), ('45', 'Social sciences and psychology'),
    ('44', 'Social work and counseling'), ('22', 'Law'), ('13', 'Education'),
]


def field_of(series):
    best = None
    for p, f in FIELD:
        if series.startswith(p) and (best is None or len(p) > len(best[0])):
            best = (p, f)
    return best[1] if best else None


def clean(t):
    t = t.strip().rstrip('.')
    return re.sub(r'\s+', ' ', t)


titles, fam_titles = {}, {}
for r in rows('CIPCode2020.csv'):
    code = r['CIPCode'].strip('="')
    if re.fullmatch(r'\d\d\.\d\d', code):
        titles[code] = clean(r['CIPTitle'])
    elif re.fullmatch(r'\d\d', code):
        fam_titles[code] = clean(r['CIPTitle']).title().replace(' And ', ' and ').replace(' Of ', ' of ').replace(' In ', ' in ')

hd = {r['UNITID']: (r['INSTNM'].strip(), r['STABBR'].strip()) for r in rows('HD2024.csv')}
control = {r['UNITID']: {'1': 'Public', '2': 'Private nonprofit', '3': 'Private for-profit'}.get(r['CONTROL'].strip()) for r in rows('HD2024.csv')}


def load(name):
    deg = collections.defaultdict(collections.Counter)  # series -> level -> n
    by_school = collections.defaultdict(collections.Counter)  # series -> unitid -> bachelor's and above
    school_levels = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))  # unitid -> series -> level -> n
    for r in rows(name):
        if r['MAJORNUM'] != '1':
            continue
        lvl = LEVEL.get(r['AWLEVEL'].strip().lstrip('0'))
        cip = r['CIPCODE'].strip('="')
        if not lvl or not re.fullmatch(r'\d\d\.\d{4}', cip) or cip.startswith('99'):
            continue
        k = n(r['CTOTALT'])
        if k <= 0:
            continue
        s = cip[:5]
        deg[s][lvl] += k
        if lvl != 'a':
            by_school[s][r['UNITID']] += k
            school_levels[r['UNITID']][s][lvl] += k
    return deg, by_school, school_levels


now, schools, per_college = load('C2024_a.csv')
base, _, per_college0 = load('c2021_a.csv')

majors = {}
for s in sorted(now):
    c = now[s]
    four = c['b'] + c['m'] + c['d']
    if four <= 0 or s not in titles:
        continue
    b0 = base.get(s, collections.Counter())
    top = sorted(schools[s].items(), key=lambda kv: (-kv[1], kv[0]))[:10]
    majors[s] = {
        't': titles[s], 'fam': s[:2], 'fld': field_of(s),
        'b': c['b'], 'm': c['m'], 'd': c['d'], 'a': c['a'],
        'b0': b0['b'], 'all0': b0['b'] + b0['m'] + b0['d'],
        's': len(schools[s]),
        'top': [[u, hd.get(u, ('', ''))[0], hd.get(u, ('', ''))[1], k] for u, k in top if u in hd],
    }

out = {
    'source': 'U.S. Department of Education, IPEDS Completions survey: degrees awarded July 2023 to June 2024, with July 2020 to June 2021 for change',
    'year': '2023-24', 'baseYear': '2020-21',
    'families': {f: fam_titles.get(f, f) for f in sorted({m['fam'] for m in majors.values()})},
    'majors': majors,
}
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'), ensure_ascii=False)
# Each college's majors, one file per state so a college page loads only its state's.
cdir = os.path.join(os.path.dirname(OUT), 'college-majors')
os.makedirs(cdir, exist_ok=True)
for old in os.listdir(cdir):
    os.remove(os.path.join(cdir, old))
by_state = collections.defaultdict(dict)
for u, ms in per_college.items():
    if u not in hd:
        continue
    then = per_college0.get(u, {})
    rows_ = sorted(((s_, c['b'], c['m'], c['d'], sum(then.get(s_, {}).get(l, 0) for l in 'bmd')) for s_, c in ms.items() if s_ in majors), key=lambda x: (-(x[1] + x[2] + x[3]), x[0]))[:40]
    if rows_:
        by_state[hd[u][1]][u] = [list(x) for x in rows_]
for st, d in by_state.items():
    with open(os.path.join(cdir, f'{st}.json'), 'w') as f:
        json.dump(d, f, separators=(',', ':'))
index = {}
for u, ms in per_college.items():
    if u not in hd:
        continue
    tot = sum(c['b'] + c['m'] + c['d'] for c in ms.values())
    if tot <= 0:
        continue
    tot0 = sum(sum(c.get(l, 0) for l in 'bmd') for c in per_college0.get(u, {}).values())
    mix = collections.Counter()
    for s_, c in ms.items():
        f = majors.get(s_, {}).get('fld')
        if f:
            mix[f] += c['b'] + c['m'] + c['d']
    index[u] = [hd[u][0], hd[u][1], control.get(u), tot, tot0, dict(mix)]
with open(os.path.join(os.path.dirname(OUT), 'college-index.json'), 'w') as f:
    json.dump(index, f, separators=(',', ':'), ensure_ascii=False)
print('college index', len(index), 'bytes', os.path.getsize(os.path.join(os.path.dirname(OUT), 'college-index.json')))
print('college files', len(by_state), 'colleges', sum(len(d) for d in by_state.values()), 'bytes', sum(os.path.getsize(os.path.join(cdir, x)) for x in os.listdir(cdir)))
tot = sum(m['b'] for m in majors.values())
print('majors', len(majors), "bachelor's", tot, 'bytes', os.path.getsize(OUT))
unmapped = collections.Counter()
for m in majors.values():
    if not m['fld']:
        unmapped[m['fam']] += m['b'] + m['m'] + m['d']
print('unmapped share', round(sum(unmapped.values()) / sum(m['b'] + m['m'] + m['d'] for m in majors.values()), 3), unmapped.most_common(8))
