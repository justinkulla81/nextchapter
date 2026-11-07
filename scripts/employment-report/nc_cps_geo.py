#!/usr/bin/env python3
"""White-collar employment, unemployment and long spells by Census division and selected states, Jan-Sep 2026 vs 2025
(CPS public-use basic files; PWCMPWGT; white-collar = PRMJOCC1 1,2; long spell PRUNEDUR >= 27). Not seasonally adjusted.
Employment = weighted employed, monthly average. Margins on the long-spell share change: conservative rule (n/5), 90%.
usage: nc_cps_geo.py DIR out.json"""
import sys, json, math
import pandas as pd
d, out = sys.argv[1], sys.argv[2]
MON = ["jan","feb","mar","apr","may","jun","jul","aug","sep"]
DIV = {1:'New England',2:'Middle Atlantic',3:'East North Central',4:'West North Central',5:'South Atlantic',6:'East South Central',7:'West South Central',8:'Mountain',9:'Pacific'}
ST = {6:'California',48:'Texas',36:'New York',12:'Florida',53:'Washington',25:'Massachusetts',17:'Illinois',13:'Georgia',37:'North Carolina',51:'Virginia',8:'Colorado',34:'New Jersey',42:'Pennsylvania',11:'District of Columbia',24:'Maryland',4:'Arizona',39:'Ohio'}
def load(y):
    fr = []
    for m in MON:
        df = pd.read_csv(f"{d}/{m}{y}.csv", usecols=lambda c: c.lower() in ("pemlr","prunedur","prmjocc1","pwcmpwgt","gediv","gestfips"), dtype=str)
        df.columns = [c.lower() for c in df.columns]
        for c in df.columns: df[c] = pd.to_numeric(df[c], errors="coerce")
        fr.append(df[df.pemlr > 0])
    return pd.concat(fr)
def stats(df, mask):
    s = df[mask]; w = s.pwcmpwgt
    emp = w[s.pemlr.isin([1,2])].sum() / 9 / 1000 / 10000  # PWCMPWGT has four implied decimals
    un = s[s.pemlr.isin([3,4])]; n = len(un)
    ur = 100 * un.pwcmpwgt.sum() / (un.pwcmpwgt.sum() + w[s.pemlr.isin([1,2])].sum()) if n else None
    lt = 100 * un.pwcmpwgt[un.prunedur >= 27].sum() / un.pwcmpwgt.sum() if n else None
    return dict(employed_k=round(emp), ur=round(ur, 2) if ur else None, ltu=round(lt, 1) if lt is not None else None, n_unemp=n)
res = {}
D = {2025: load(25), 2026: load(26)}
for kind, key, names in (('division', 'gediv', DIV), ('state', 'gestfips', ST)):
    for code, nm in names.items():
        r = {}
        for y, df in D.items():
            r[y] = stats(df, (df[key] == code) & df.prmjocc1.isin([1, 2]))
            r[f'{y}_all'] = stats(df, df[key] == code)
        a, b = r[2025], r[2026]
        r['emp_change_pct'] = round(100 * (b['employed_k'] / a['employed_k'] - 1), 1)
        if a['ltu'] is not None and b['ltu'] is not None and min(a['n_unemp'], b['n_unemp']) >= 100:
            p1, p2 = b['ltu'] / 100, a['ltu'] / 100
            r['ltu_change'] = round(b['ltu'] - a['ltu'], 1)
            r['ltu_moe_conservative'] = round(1.645 * math.sqrt(5 * (p1 * (1 - p1) / b['n_unemp'] + p2 * (1 - p2) / a['n_unemp'])) * 100, 1)
        res[f'{kind}:{nm}'] = r
json.dump(res, open(out, 'w'), indent=1, default=float)
for k, r in res.items():
    a, b = r[2025], r[2026]
    print(f"{k:34s} wc emp {b['employed_k']:>6,}/{a['employed_k']:>6,} ({r['emp_change_pct']:+5.1f}%)  UR {b['ur']}/{a['ur']}  LTU {b['ltu']}/{a['ltu']} {('chg %+.1f ±%.1f' % (r['ltu_change'], r['ltu_moe_conservative'])) if 'ltu_change' in r else 'n<100'}  n={b['n_unemp']}/{a['n_unemp']}")
