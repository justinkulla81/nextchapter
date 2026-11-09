#!/usr/bin/env python3
"""Second jobs and side businesses (CPS public-use basic files, Jan-Sep 2026 vs 2025, employed people, PWCMPWGT, not seasonally adjusted):
share with more than one job (PEMJOT = 1), and share whose second job is self-employment (PEIO2COW 6 or 7), all workers and white-collar (PRMJOCC1 1,2),
by age. The CPS asks about jobs in the reference week; it misses side income not reported as a job. Margins: conservative (n/5), 90%.
usage: nc_cps_sidework.py DIR out.json"""
import sys, json, math
import pandas as pd
d, out = sys.argv[1], sys.argv[2]
MON = ["jan","feb","mar","apr","may","jun","jul","aug","sep"]
def load(y):
    fr = []
    for m in MON:
        df = pd.read_csv(f"{d}/{m}{y}.csv", usecols=lambda c: c.lower() in ("pemlr","pemjot","peio2cow","prmjocc1","prtage","pwcmpwgt"), dtype=str); df.columns = [c.lower() for c in df.columns]
        for c in df.columns: df[c] = pd.to_numeric(df[c], errors="coerce")
        fr.append(df[df.pemlr.isin([1, 2])])
    return pd.concat(fr)
D = {2025: load(25), 2026: load(26)}; res = {}
GROUPS = {"all": lambda x: x.pemlr > 0, "white_collar": lambda x: x.prmjocc1.isin([1, 2]), "wc_under35": lambda x: x.prmjocc1.isin([1, 2]) & (x.prtage < 35),
          "wc_35_54": lambda x: x.prmjocc1.isin([1, 2]) & x.prtage.between(35, 54), "wc_55_64": lambda x: x.prmjocc1.isin([1, 2]) & x.prtage.between(55, 64)}
for g, f in GROUPS.items():
    r = {}
    for y, df in D.items():
        s = df[f(df)]; w = s.pwcmpwgt; n = len(s)
        mj = float(w[s.pemjot == 1].sum() / w.sum()); sb = float(w[(s.pemjot == 1) & s.peio2cow.isin([6, 7])].sum() / w.sum())
        r[y] = dict(multiple_jobs=round(100 * mj, 2), second_job_self_employed=round(100 * sb, 2), n=n)
    a, b = r[2025], r[2026]
    for k in ("multiple_jobs", "second_job_self_employed"):
        p1, p2 = b[k] / 100, a[k] / 100
        moe = 1.645 * 100 * math.sqrt(5 * (p1 * (1 - p1) / b["n"] + p2 * (1 - p2) / a["n"]))
        r[f"{k}_change"] = dict(change=round(b[k] - a[k], 2), moe90=round(moe, 2))
        print(f"{g:13s} {k:26s} {a[k]:5.2f} -> {b[k]:5.2f} ({b[k]-a[k]:+.2f} ±{moe:.2f}) n={a['n']}/{b['n']}")
    res[g] = r
json.dump(res, open(out, "w"), indent=1, default=float)
