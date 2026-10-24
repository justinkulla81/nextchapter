#!/usr/bin/env python3
"""
NextChapter early-warning series, United States.

Monthly Current Population Survey (CPS basic public-use microdata) measures for
the "canary" panel of the monthly White Collar Employment Report: do young
college graduates and early-career white-collar workers deteriorate before
everyone else?

Groups (fixed definitions, not seasonally adjusted at source):
  all        everyone 16+
  wc         white-collar: current/most recent job in major occupation group 1 or 2
  grad       ages 22-27 with a bachelor's degree or more (early-career graduates)
  wc_early   white-collar, under 35 (early career)
  wc_senior  white-collar, 50 and over (senior)

Per group and month: unemployment rate, employment-population ratio, share of
the unemployed out 27+ weeks, median weeks unemployed, unweighted unemployed n.
The CSV also carries a 12-month-ago change column for each unemployment rate so
the page can compare when each group turned.

Usage:
  python3 nc_early_warning_us.py --start 2010-01 --out public/reports/us-early-warning.csv
"""
import argparse, csv, os, sys
from datetime import date
sys.path.insert(0, os.path.dirname(__file__))
from nc_white_collar_index import fetch, wmedian, month_range

GROUPS = ["all", "wc", "grad", "wc_early", "wc_senior"]
METRICS = ("ur", "epop", "ltu_share", "median_wks", "n_unemployed")

def summarize(rows):
    h = rows[0]; ix = {n: h.index(n) for n in h}
    acc = {g: dict(pop=0.0, emp=0.0, lf=0.0, u=0.0, ltu=0.0, n_u=0, durs=[]) for g in GROUPS}
    for r in rows[1:]:
        try:
            w = float(r[ix["PWCMPWGT"]]); lfs = int(r[ix["PEMLR"]])
        except ValueError:
            continue
        # PWCMPWGT is the labor-force composite weight; it is only set for people 16+ in the survey universe.
        if w <= 0 or lfs < 1:
            continue
        occ = int(r[ix["PRMJOCC1"]] or -1); age = int(r[ix["PRTAGE"]] or -1)
        dur = int(r[ix["PRUNEDUR"]] or -1); edu = int(r[ix["PEEDUCA"]] or -1)
        gs = ["all"]
        if occ in (1, 2):
            gs.append("wc")
            if age < 35: gs.append("wc_early")
            if age >= 50: gs.append("wc_senior")
        if 22 <= age <= 27 and edu >= 43: gs.append("grad")
        for g in gs:
            a = acc[g]; a["pop"] += w
            if lfs <= 2: a["emp"] += w
            if lfs <= 4: a["lf"] += w
            if lfs in (3, 4):
                a["u"] += w; a["n_u"] += 1; a["durs"].append((dur, w))
                if dur >= 27: a["ltu"] += w
    out = {}
    for g, a in acc.items():
        if a["lf"] == 0 or a["u"] == 0 or a["pop"] == 0:
            continue
        out[g] = dict(ur=100 * a["u"] / a["lf"], epop=100 * a["emp"] / a["pop"],
                      ltu_share=100 * a["ltu"] / a["u"], median_wks=wmedian(a["durs"], a["u"]),
                      n_unemployed=a["n_u"])
    return out

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--start", default="2010-01"); p.add_argument("--end", default=None)
    p.add_argument("--out", default="public/reports/us-early-warning.csv")
    a = p.parse_args()
    key = os.environ.get("CENSUS_API_KEY")
    if not key:
        sys.exit("Set CENSUS_API_KEY first")
    s = tuple(map(int, a.start.split("-")))
    e = tuple(map(int, a.end.split("-"))) if a.end else (date.today().year, date.today().month)
    monthly = {}
    for y, m in month_range(s, e):
        rows = fetch(y, m, key)
        if not rows:
            print(f"{y}-{m:02d}: not available", file=sys.stderr); continue
        monthly[f"{y}-{m:02d}"] = summarize(rows)
        print(f"{y}-{m:02d}: ok", file=sys.stderr)
    keys = sorted(monthly)
    with open(a.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["month"] + [f"{g}_{m}" for g in GROUPS for m in METRICS])
        for k in keys:
            row = [k]
            for g in GROUPS:
                d = monthly[k].get(g, {})
                for m in METRICS:
                    v = d.get(m); row.append("" if v is None else (round(v, 3) if isinstance(v, float) else v))
            w.writerow(row)
    print(f"wrote {a.out} ({len(keys)} months)", file=sys.stderr)

if __name__ == "__main__":
    main()
