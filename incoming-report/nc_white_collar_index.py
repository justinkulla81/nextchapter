#!/usr/bin/env python3
"""
NextChapter White-Collar Displacement Index
-------------------------------------------
Builds monthly white-collar labor-market measures from the Census Bureau's
Current Population Survey (CPS) basic monthly public-use microdata.

Definitions (keep these fixed month to month):
  White-collar  = labor-force members whose current or most recent job is in
                  major occupation group 1 (Management, business & financial)
                  or 2 (Professional & related)  -> CPS variable PRMJOCC1 in (1,2)
  Labor force   = PEMLR in 1..4 (employed at work, employed absent, unemployed on
                  layoff, unemployed looking)
  Unemployed    = PEMLR in (3,4)
  Long-term     = PRUNEDUR >= 27 weeks
  Weight        = PWCMPWGT (composite weight; BLS uses it for labor-force estimates)

Headline measure:
  WC long-term unemployment rate = WC unemployed 27+ weeks / WC labor force
  Published as a 3-month moving average (single months are noisy) and as an index
  with the 2019 average = 100.

All figures are NOT seasonally adjusted. Compare a month with the same month a
year earlier, or use the 3-month average. October 2025 does not exist (the CPS
was not collected during the shutdown); the moving average skips it.

Usage:
  export CENSUS_API_KEY=...        # free: api.census.gov/data/key_signup.html
  python3 nc_white_collar_index.py --start 2015-01 --end 2026-09 --out wc_index.csv
"""
import argparse, csv, json, os, sys, time, urllib.request, urllib.parse
from datetime import date

MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]
VARS = "PWCMPWGT,PEMLR,PRUNEDUR,PRMJOCC1,PRTAGE,PRUNTYPE,PEEDUCA"
GROUPS = ["all", "wc", "wc45", "mgmt", "prof", "ba25"]

def fetch(year, mon, key):
    q = urllib.parse.urlencode({"get": VARS, "key": key})
    url = f"https://api.census.gov/data/{year}/cps/basic/{MONTHS[mon-1]}?{q}"
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                if r.status != 200:
                    return None
                body = r.read().decode()
                if not body.startswith("["):
                    raise RuntimeError("Census returned a non-JSON page (check the API key)")
                return json.loads(body)
        except urllib.error.HTTPError as e:
            if e.code in (204, 404):
                return None          # month not published / not collected
            time.sleep(3 * (attempt + 1))
        except Exception:
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))
    return None

def wmedian(pairs, total):
    pairs.sort()
    c = 0.0
    for d, w in pairs:
        c += w
        if c >= total / 2:
            return d
    return None

def summarize(rows):
    h = rows[0]; ix = {n: h.index(n) for n in h}
    acc = {g: dict(lf=0.0, u=0.0, ltu=0.0, n_u=0, los=0.0, lea=0.0, durs=[]) for g in GROUPS}
    for r in rows[1:]:
        try:
            w = float(r[ix["PWCMPWGT"]]); lfs = int(r[ix["PEMLR"]])
        except ValueError:
            continue
        if w <= 0 or lfs < 1 or lfs > 4:
            continue
        occ = int(r[ix["PRMJOCC1"]] or -1); age = int(r[ix["PRTAGE"]] or -1)
        dur = int(r[ix["PRUNEDUR"]] or -1); typ = int(r[ix["PRUNTYPE"]] or -1)
        edu = int(r[ix["PEEDUCA"]] or -1)
        gs = ["all"]
        if occ in (1, 2):
            gs.append("wc")
            if age >= 45: gs.append("wc45")
        if occ == 1: gs.append("mgmt")
        if occ == 2: gs.append("prof")
        if edu >= 43 and age >= 25: gs.append("ba25")
        un = lfs in (3, 4)
        for g in gs:
            a = acc[g]; a["lf"] += w
            if un:
                a["u"] += w; a["n_u"] += 1; a["durs"].append((dur, w))
                if dur >= 27: a["ltu"] += w
                if 1 <= typ <= 3: a["los"] += w
                elif typ == 4: a["lea"] += w
    out = {}
    for g, a in acc.items():
        if a["lf"] == 0 or a["u"] == 0:
            continue
        out[g] = dict(
            ur=100 * a["u"] / a["lf"],
            ltu_share=100 * a["ltu"] / a["u"],
            ltu_rate=100 * a["ltu"] / a["lf"],
            median_wks=wmedian(a["durs"], a["u"]),
            mean_wks=sum(d * w for d, w in a["durs"]) / a["u"],
            losers_share=100 * a["los"] / a["u"],
            leavers_share=100 * a["lea"] / a["u"],
            n_unemployed=a["n_u"],
        )
    return out

def month_range(start, end):
    y, m = start
    while (y, m) <= end:
        yield y, m
        m += 1
        if m == 13: y, m = y + 1, 1

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--start", default="2015-01"); p.add_argument("--end", default=None)
    p.add_argument("--out", default="wc_index.csv")
    a = p.parse_args()
    key = os.environ.get("CENSUS_API_KEY")
    if not key:
        sys.exit("Set CENSUS_API_KEY first (free at api.census.gov/data/key_signup.html)")
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
    # 3-month moving average of the headline, skipping missing months
    base = [monthly[k]["wc"]["ltu_rate"] for k in keys if k.startswith("2019-")]
    base = sum(base) / len(base) if base else None
    with open(a.out, "w", newline="") as f:
        w = csv.writer(f)
        cols = ["month"] + [f"{g}_{m}" for g in GROUPS for m in
                ("ur","ltu_share","ltu_rate","median_wks","mean_wks","losers_share","leavers_share","n_unemployed")]
        cols += ["wc_ltu_rate_3mma", "wc_index_2019_100"]
        w.writerow(cols)
        for i, k in enumerate(keys):
            row = [k]
            for g in GROUPS:
                d = monthly[k].get(g, {})
                for m in ("ur","ltu_share","ltu_rate","median_wks","mean_wks","losers_share","leavers_share","n_unemployed"):
                    v = d.get(m); row.append("" if v is None else (round(v, 3) if isinstance(v, float) else v))
            win = [monthly[x]["wc"]["ltu_rate"] for x in keys[max(0, i-2):i+1]]
            ma = sum(win) / len(win)
            row += [round(ma, 3), round(100 * ma / base, 1) if base else ""]
            w.writerow(row)
    print(f"wrote {a.out} ({len(keys)} months)", file=sys.stderr)

if __name__ == "__main__":
    main()
