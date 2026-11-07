#!/usr/bin/env python3
"""Month-to-month CPS flows for the White Collar Employment Report: do unemployed white-collar workers leave
unemployment more slowly than a year ago, or are more people entering it?

Matches the same person in consecutive months of the CPS public-use basic files (hrhhid + hrhhid2 + pulineno,
months in sample t -> t+1, same sex, age within 1 year), Jan->Feb ... Aug->Sep, 2026 vs 2025, pooled.
Weights: month-t PWCMPWGT (basic composite weight; the longitudinal composite weight is not on the public file),
so levels are approximate. Compare years within this method, not to BLS's published flows.
Margins: conservative (design effect 2.0, pooled transitions counted as 40% independent -> effective n = n/5),
because consecutive transitions share people and BLS publishes no GVF for matched flows.

usage: nc_cps_flows.py DIR_WITH_CSVS out.json   (files like jan25.csv ... sep26.csv from
https://www2.census.gov/programs-surveys/cps/datasets/<YYYY>/basic/<mon><yy>pub.csv)
"""
import sys, json, math
import pandas as pd, numpy as np
MON = ["jan","feb","mar","apr","may","jun","jul","aug","sep"]
COLS = ["hrhhid","hrhhid2","pulineno","hrmis","pemlr","prunedur","prmjocc1","prtage","pesex","pwcmpwgt","gestfips"]
d, out = sys.argv[1], sys.argv[2]

def load(m, y):
    df = pd.read_csv(f"{d}/{m}{y}.csv", usecols=lambda c: c.lower() in COLS, dtype=str)
    df.columns = [c.lower() for c in df.columns]
    for c in ["hrmis","pemlr","prunedur","prmjocc1","prtage","pesex","pwcmpwgt"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["key"] = df.hrhhid.str.strip() + "_" + df.hrhhid2.str.strip() + "_" + df.pulineno.str.strip()
    return df

def pairs(y):
    res = []
    for i in range(len(MON) - 1):
        a, b = load(MON[i], y), load(MON[i + 1], y)
        a = a[a.pemlr.notna() & (a.pemlr > 0)]; b = b[b.pemlr.notna() & (b.pemlr > 0)]
        mg = a.merge(b, on="key", suffixes=("", "_n"))
        mg = mg[(mg.hrmis_n == mg.hrmis + 1) & (mg.pesex == mg.pesex_n) & ((mg.prtage_n - mg.prtage).between(0, 1))]
        res.append(mg)
    return pd.concat(res)

def groups(mg):
    wc = mg.prmjocc1.isin([1, 2]); bc = mg.prmjocc1.isin([7, 8, 9, 10]); age = mg.prtage
    return {"all": mg.pemlr.notna(), "white_collar": wc, "blue_collar": bc,
            "wc_under35": wc & (age < 35), "wc_35_54": wc & age.between(35, 54), "wc_55_64": wc & age.between(55, 64),
            "all_55_64": age.between(55, 64)}

def rate(mg, mask, num):
    w = mg.pwcmpwgt; n = int(mask.sum())
    if n == 0: return None
    p = float((w[mask & num]).sum() / w[mask].sum())
    return dict(rate=round(100 * p, 2), n=n, se=100 * math.sqrt(p * (1 - p) / (n / 5)))

res = {}
for y in (25, 26):
    mg = pairs(y); G = groups(mg)
    emp_n = mg.pemlr_n.isin([1, 2]); unemp_n = mg.pemlr_n.isin([3, 4]); nilf_n = mg.pemlr_n.isin([5, 6, 7])
    unemp = mg.pemlr.isin([3, 4]); emp = mg.pemlr.isin([1, 2]); lt = unemp & (mg.prunedur >= 27)
    r = {"matched_pairs": len(mg)}
    for g, m in G.items():
        r[g] = {"ue_exit_to_employment": rate(mg, m & unemp, emp_n), "ue_exit_to_nilf": rate(mg, m & unemp, nilf_n),
                "longterm_exit_to_employment": rate(mg, m & lt, emp_n), "shortterm_exit_to_employment": rate(mg, m & unemp & ~lt, emp_n),
                "eu_inflow_from_employment": rate(mg, m & emp, unemp_n)}
    res[2000 + y] = r

def diff(a, b):
    if not a or not b: return None
    dd = b["rate"] - a["rate"]; moe = 1.645 * math.sqrt(a["se"] ** 2 + b["se"] ** 2)
    return dict(y2025=a["rate"], y2026=b["rate"], change=round(dd, 2), moe90=round(moe, 2), clears=abs(dd) > moe, n2025=a["n"], n2026=b["n"])
res["change"] = {g: {k: diff(res[2025][g][k], res[2026][g][k]) for k in res[2025][g]} for g in res[2025] if g != "matched_pairs"}
json.dump(res, open(out, "w"), indent=1, default=float)
for g, v in res["change"].items():
    print(g)
    for k, x in v.items():
        if x: print(f"  {k:32s} {x['y2025']:6.2f} -> {x['y2026']:6.2f}  ({x['change']:+.2f} ±{x['moe90']:.2f}{'*' if x['clears'] else ''})  n={x['n2025']}/{x['n2026']}")
print("matched pairs", res[2025]["matched_pairs"], res[2026]["matched_pairs"])
