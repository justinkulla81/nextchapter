#!/usr/bin/env python3
"""Self-employment (CPS public-use basic files, Jan-Sep 2026 vs 2025): (1) self-employed share of employed white-collar workers by age,
(2) among people unemployed in month t, the share who are self-employed in month t+1 (matched months, as nc_cps_flows.py), all and white-collar.
PEIO1COW 6 = self-employed incorporated, 7 = unincorporated. Composite weight of month t. Margins: conservative (n/5), 90%. usage: DIR out.json"""
import sys, json, math
import pandas as pd
d, out = sys.argv[1], sys.argv[2]
MON = ["jan","feb","mar","apr","may","jun","jul","aug","sep"]
COLS = ["hrhhid","hrhhid2","pulineno","hrmis","pemlr","prmjocc1","prtage","pesex","pwcmpwgt","peio1cow","peeduca"]
def load(m, y):
    df = pd.read_csv(f"{d}/{m}{y}.csv", usecols=lambda c: c.lower() in COLS, dtype=str); df.columns = [c.lower() for c in df.columns]
    for c in ["hrmis","pemlr","prmjocc1","prtage","pesex","pwcmpwgt","peio1cow","peeduca"]: df[c] = pd.to_numeric(df[c], errors="coerce")
    df["key"] = df.hrhhid.str.strip() + "_" + df.hrhhid2.str.strip() + "_" + df.pulineno.str.strip(); return df
def band(a): return "under35" if a < 35 else "35-54" if a < 55 else "55-64" if a < 65 else "65+"
res = {}
for y in (25, 26):
    fr = []; share = {}; pairs = []
    for i, m in enumerate(MON):
        a = load(m, y); a = a[a.pemlr > 0]; fr.append(a)
        if i + 1 < len(MON):
            b = load(MON[i + 1], y); b = b[b.pemlr > 0]
            mg = a.merge(b, on="key", suffixes=("", "_n"))
            pairs.append(mg[(mg.hrmis_n == mg.hrmis + 1) & (mg.pesex == mg.pesex_n) & ((mg.prtage_n - mg.prtage).between(0, 1))])
    A = pd.concat(fr); P = pd.concat(pairs); r = {}
    for nm, msk in (("all", A.pemlr.isin([1, 2])), ("white_collar", A.pemlr.isin([1, 2]) & A.prmjocc1.isin([1, 2])),
                    ("wc_under35", A.pemlr.isin([1, 2]) & A.prmjocc1.isin([1, 2]) & (A.prtage < 35)), ("wc_35_54", A.pemlr.isin([1, 2]) & A.prmjocc1.isin([1, 2]) & A.prtage.between(35, 54)),
                    ("wc_55_64", A.pemlr.isin([1, 2]) & A.prmjocc1.isin([1, 2]) & A.prtage.between(55, 64))):
        s = A[msk]; w = s.pwcmpwgt; r[f"selfemp_share_{nm}"] = dict(pct=round(100 * w[s.peio1cow.isin([6, 7])].sum() / w.sum(), 2), incorporated_pct=round(100 * w[s.peio1cow == 6].sum() / w.sum(), 2), n=len(s))
    for nm, msk in (("all", P.pemlr.isin([3, 4])), ("white_collar", P.pemlr.isin([3, 4]) & P.prmjocc1.isin([1, 2]))):
        s = P[msk]; w = s.pwcmpwgt; se = s.pemlr_n.isin([1, 2]) & s.peio1cow_n.isin([6, 7])
        p = float(w[se].sum() / w.sum()); n = len(s)
        r[f"unemployed_to_selfemployed_{nm}"] = dict(pct=round(100 * p, 2), n=n, se=100 * math.sqrt(p * (1 - p) / (n / 5)))
    res[2000 + y] = r
res["change"] = {}
for k in res[2025]:
    a, b = res[2025][k], res[2026][k]
    if "se" in a: moe = 1.645 * math.sqrt(a["se"] ** 2 + b["se"] ** 2)
    else:
        pa, pb = a["pct"] / 100, b["pct"] / 100; moe = 1.645 * 100 * math.sqrt(5 * (pa * (1 - pa) / a["n"] + pb * (1 - pb) / b["n"]))
    res["change"][k] = dict(y2025=a["pct"], y2026=b["pct"], change=round(b["pct"] - a["pct"], 2), moe90=round(moe, 2), n=f'{a["n"]}/{b["n"]}')
    print(f"{k:40s} {a['pct']:6.2f} -> {b['pct']:6.2f}  ({b['pct']-a['pct']:+.2f} ±{moe:.2f})  n={a['n']}/{b['n']}")
json.dump(res, open(out, "w"), indent=1, default=float)
