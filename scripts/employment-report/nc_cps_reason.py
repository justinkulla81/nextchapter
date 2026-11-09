#!/usr/bin/env python3
"""Why white-collar workers are unemployed, and whether long spells differ by reason (CPS public-use basic files, Jan-Sep 2026 vs 2025,
PWCMPWGT, not seasonally adjusted). PRUNTYPE: 1 job loser on layoff, 2 other job loser, 3 temporary job ended, 4 job leaver, 5 reentrant, 6 new entrant.
Reports, for unemployed white-collar workers (PRMJOCC1 1,2) overall and ages 55-64: share by reason, and share out 27+ weeks by reason.
Margins: conservative rule (n/5), 90%. usage: DIR out.json"""
import sys, json, math
import pandas as pd
d, out = sys.argv[1], sys.argv[2]
MON = ["jan","feb","mar","apr","may","jun","jul","aug","sep"]
def load(y):
    fr = []
    for m in MON:
        df = pd.read_csv(f"{d}/{m}{y}.csv", usecols=lambda c: c.lower() in ("pemlr","pruntype","prunedur","prmjocc1","prtage","pwcmpwgt"), dtype=str); df.columns = [c.lower() for c in df.columns]
        for c in df.columns: df[c] = pd.to_numeric(df[c], errors="coerce")
        fr.append(df[df.pemlr.isin([3, 4]) & df.prmjocc1.isin([1, 2])])
    return pd.concat(fr)
D = {2025: load(25), 2026: load(26)}
REAS = {"job_loser_or_temp_ended": [1, 2, 3], "job_leaver": [4], "reentrant": [5], "new_entrant": [6]}
res = {}
for gname, f in (("white_collar", lambda x: x.prtage > 0), ("wc_55_64", lambda x: x.prtage.between(55, 64))):
    r = {}
    for y, df in D.items():
        s = df[f(df)]; w = s.pwcmpwgt; tot = w.sum(); r[y] = {"n": len(s)}
        for k, codes in REAS.items():
            m = s.pruntype.isin(codes); wk = w[m]
            r[y][k] = dict(share=round(100 * wk.sum() / tot, 1), n=int(m.sum()), ltu_share=round(100 * w[m & (s.prunedur >= 27)].sum() / wk.sum(), 1) if wk.sum() else None)
    res[gname] = r
    print(gname, {y: r[y]["n"] for y in r})
    for k in REAS:
        a, b = r[2025][k], r[2026][k]
        print(f"  {k:24s} share {a['share']:5.1f} -> {b['share']:5.1f} (n {a['n']}/{b['n']})   27+ share {a['ltu_share']} -> {b['ltu_share']}")
json.dump(res, open(out, "w"), indent=1, default=float)
