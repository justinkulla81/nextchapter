#!/usr/bin/env python3
"""Builds data/colleges/colleges.json: one record per degree-granting US college from
free federal data (IPEDS HD/IC/Finance/Completions + College Scorecard).
Inputs are in data/colleges/ (downloaded from nces.ed.gov and ed-public-download.scorecard.network)."""
import csv, json, collections, os, re
D = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'colleges')
def rows(path):
    with open(os.path.join(D, path), encoding='utf-8-sig', errors='replace', newline='') as f:
        yield from csv.DictReader(f)
def num(x):
    try:
        v = float(str(x).replace(',', '').strip())
        return v if v == v and v > -1 else None
    except Exception: return None
CIP2 = {'01':'Agriculture','03':'Natural resources','04':'Architecture','05':'Area/ethnic studies','09':'Communication & journalism','10':'Communications technology','11':'Computer & information sciences','12':'Personal & culinary services','13':'Education','14':'Engineering','15':'Engineering technologies','16':'Foreign languages','19':'Family & consumer sciences','22':'Legal studies','23':'English','24':'Liberal arts & general studies','25':'Library science','26':'Biological sciences','27':'Mathematics & statistics','29':'Military technologies','30':'Interdisciplinary studies','31':'Parks, recreation & fitness','38':'Philosophy & religion','39':'Theology','40':'Physical sciences','41':'Science technologies','42':'Psychology','43':'Security & protective services','44':'Public administration & social work','45':'Social sciences','46':'Construction trades','47':'Mechanic & repair trades','48':'Precision production','49':'Transportation','50':'Visual & performing arts','51':'Health professions','52':'Business & management','54':'History','60':'Residency programs'}

hd = {}
for r in rows('HD2023/hd2023.csv'):
    if r['CYACTIVE'] != '1' or r['DEGGRANT'] != '1': continue
    if r['ICLEVEL'] not in ('1', '2'): continue
    hd[r['UNITID']] = dict(unitid=r['UNITID'], name=r['INSTNM'].strip(), city=r['CITY'], state=r['STABBR'], zip=r['ZIP'][:5], countyFips=r['COUNTYCD'].zfill(5) if r['COUNTYCD'].strip().isdigit() else None,
        website=r['WEBADDR'].strip() or None, control={'1':'Public','2':'Private nonprofit','3':'Private for-profit'}.get(r['CONTROL']), level='4-year' if r['ICLEVEL']=='1' else '2-year',
        presidentName=r['CHFNM'].strip() or None, presidentTitle=r['CHFTITLE'].strip() or None, phone=r['GENTELE'].strip() or None, opeid=r['OPEID'].strip() or None)
print('institutions', len(hd))

for r in rows('IC2023_AY/ic2023_ay.csv'):
    u = hd.get(r['UNITID'])
    if u: u.update(tuitionInState=num(r.get('TUITION2')), tuitionOutState=num(r.get('TUITION3')), tuitionInDistrict=num(r.get('TUITION1')))

# enrollment: fall total (all students), EFALEVEL 1 = all students total
for r in rows('EF2023A/ef2023a.csv'):
    u = hd.get(r['UNITID'])
    if u and r['EFALEVEL'] == '1': u['enrollment'] = num(r['EFTOTLT'])

# completions: per-institution total awards and top fields (first major only)
tot = collections.Counter(); byfam = collections.defaultdict(collections.Counter); bach = collections.Counter()
for r in rows('C2023_A/C2023_a.csv'):
    if r['MAJORNUM'] != '1' or r['UNITID'] not in hd: continue
    c = r['CIPCODE'].strip('"'); n = num(r['CTOTALT']) or 0
    if c.startswith('99') or n <= 0: continue
    fam = c.split('.')[0]
    # skip associate-or-below certificates in the "top majors" list for 4-year schools? keep all levels; award level 3+ = associate and up
    tot[r['UNITID']] += n; byfam[r['UNITID']][fam] += n
for uid, u in hd.items():
    if uid in tot:
        u['annualAwards'] = int(tot[uid])
        u['topMajors'] = [{'field': CIP2.get(f, f'CIP {f}'), 'awards': int(n), 'share': round(n / tot[uid], 3)} for f, n in byfam[uid].most_common(5)]

# finance: public (GASB, F1A) and private nonprofit (FASB, F2)
for r in rows('F2223_F1A/f2223_f1a.csv'):
    u = hd.get(r['UNITID'])
    if u: u.update(endowment=num(r.get('F1H02')), revenue=num(r.get('F1D01')), expenses=num(r.get('F1C191')) or num(r.get('F1D02')), gifts=None)
for r in rows('F2223_F2/f2223_f2.csv'):
    u = hd.get(r['UNITID'])
    if u: u.update(endowment=num(r.get('F2H02')), revenue=num(r.get('F2B01')), expenses=num(r.get('F2B02')), gifts=num(r.get('F2D08A')) or num(r.get('F2D08')))

# Scorecard: earnings, employment, net price, completion, backup tuition
for r in rows('scorecard/Most-Recent-Cohorts-Institution.csv'):
    u = hd.get(r['UNITID'])
    if not u: continue
    wne, nwne = num(r.get('COUNT_WNE_P10')), num(r.get('COUNT_NWNE_P10'))
    u.update(earnings6=num(r.get('MD_EARN_WNE_P6')), earnings10=num(r.get('MD_EARN_WNE_P10')), earnAboveHs=num(r.get('GT_THRESHOLD_P10')),
        employedShare10=round(wne / (wne + nwne), 3) if wne is not None and nwne is not None and wne + nwne > 0 else None,
        netPrice=num(r.get('NPT4_PUB')) or num(r.get('NPT4_PRIV')), completionRate=num(r.get('C150_4')) or num(r.get('C150_L4')),
        endowScorecard=num(r.get('ENDOWBEGIN')))
    if u.get('tuitionInState') is None: u['tuitionInState'] = num(r.get('TUITIONFEE_IN'))
    if u.get('tuitionOutState') is None: u['tuitionOutState'] = num(r.get('TUITIONFEE_OUT'))
    if u.get('enrollment') is None: u['enrollment'] = num(r.get('UGDS'))

out = list(hd.values())
json.dump(out, open(os.path.join(D, 'colleges.json'), 'w'), indent=0)
def pct(k): return round(100 * sum(1 for u in out if u.get(k) not in (None, 0)) / len(out))
print({k: pct(k) for k in ['enrollment','tuitionInState','annualAwards','topMajors','endowment','revenue','expenses','gifts','earnings10','employedShare10','presidentName','phone','website','countyFips']})
