#!/usr/bin/env python3
"""Bachelor's-degree holders (PEEDUCA >= 43, any occupation) by age band: unemployment rate, share of unemployed out 27+ weeks,
Jan-Sep 2026 vs 2025 (CPS public-use basic files, PWCMPWGT, not seasonally adjusted). Long-spell change margin: conservative rule (n/5), 90%.
Also prints the same for people without a bachelor's for comparison. usage: nc_cps_degree_age.py DIR out.json"""
import sys, json, math
import pandas as pd
d, out = sys.argv[1], sys.argv[2]
MON = ["jan","feb","mar","apr","may","jun","jul","aug","sep"]
BANDS = [("22-27", 22, 27), ("28-34", 28, 34), ("35-44", 35, 44), ("45-54", 45, 54), ("55-64", 55, 64)]
def load(y):
    fr = []
    for m in MON:
        df = pd.read_csv(f"{d}/{m}{y}.csv", usecols=lambda c: c.lower() in ("pemlr","prunedur","peeduca","prtage","pwcmpwgt"), dtype=str)
        df.columns = [c.lower() for c in df.columns]
        for c in df.columns: df[c] = pd.to_numeric(df[c], errors="coerce")
        fr.append(df[df.pemlr.isin([1, 2, 3, 4])])
    return pd.concat(fr)
def st(df, m):
    s = df[m]; e = s.pwcmpwgt[s.pemlr.isin([1, 2])].sum(); u = s[s.pemlr.isin([3, 4])]
    return dict(ur=round(100 * u.pwcmpwgt.sum() / (u.pwcmpwgt.sum() + e), 2), ltu=round(100 * u.pwcmpwgt[u.prunedur >= 27].sum() / u.pwcmpwgt.sum(), 1), n=len(u))
D = {2025: load(25), 2026: load(26)}; res = {}
for grp, cond in (("bachelors_plus", lambda df: df.peeduca >= 43), ("no_bachelors", lambda df: df.peeduca < 43)):
    for nm, lo, hi in BANDS:
        r = {y: st(df, cond(df) & df.prtage.between(lo, hi)) for y, df in D.items()}
        a, b = r[2025], r[2026]; p1, p2 = b["ltu"] / 100, a["ltu"] / 100
        r["ltu_change"] = round(b["ltu"] - a["ltu"], 1)
        r["ltu_moe_conservative"] = round(1.645 * math.sqrt(5 * (p1 * (1 - p1) / b["n"] + p2 * (1 - p2) / a["n"])) * 100, 1)
        res[f"{grp}:{nm}"] = r
        print(f"{grp:15s} {nm:6s} UR {b['ur']}/{a['ur']}  LTU {b['ltu']}/{a['ltu']} ({r['ltu_change']:+.1f} ±{r['ltu_moe_conservative']})  n={b['n']}/{a['n']}")
json.dump(res, open(out, "w"), indent=1, default=float)
