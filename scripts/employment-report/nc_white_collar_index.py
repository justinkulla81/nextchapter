#!/usr/bin/env python3
"""
NextChapter White-Collar Long-Search Index
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
  Published seasonally adjusted, as a 3-month moving average, and as an index
  with the 2019 average = 100.

Seasonal adjustment (the published index):
  Each month's rate is divided by a fixed monthly factor: the average ratio of
  that calendar month to its year's mean, estimated over 2015-2019 and 2022-2025
  (pandemic years 2020-2021 excluded) and normalized to average 1.0. The factors
  are re-estimated once a year (--factors refit prints and uses new ones); the
  fixed table below is the one the published history was built with. The index
  is the 3-month moving average of the adjusted rate over the three latest
  available months (October 2025 does not exist, so it is skipped), divided by
  the 2019 mean of the adjusted rate. This is simpler than X-13ARIMA-SEATS; the
  report also shows the index under X-13, STL and an unadjusted 12-month average.

October 2025 does not exist (the CPS was not collected during the shutdown).

Output (--out) is the file the site reads, public/reports/wc-index.csv:
  month, wc_ltu_rate_pct_nsa, wc_ltu_rate_pct_sa, wc_ltu_rate_3mma_sa,
  wc_index_2019_100, wc_unemployment_rate_pct_nsa, wc_ltu_share_pct_nsa,
  wc45_ltu_share_pct_nsa, all_ltu_share_pct_nsa, wc_median_weeks_nsa
--detail writes every group and measure (not seasonally adjusted) to a second file.

Usage:
  # Rebuild everything from the Census API (needs a key):
  export CENSUS_API_KEY=...        # free: api.census.gov/data/key_signup.html
  python3 nc_white_collar_index.py --start 2015-01 --end 2026-09 --out wc_index.csv

  # Monthly: add the months after the file's last one. Public CPS files need no key:
  # download https://www2.census.gov/programs-surveys/cps/datasets/<YYYY>/basic/<mon><yy>pub.csv
  python3 nc_white_collar_index.py --update public/reports/wc-index.csv --cps-dir DIR
"""
import argparse, csv, json, os, sys, time, urllib.error, urllib.request, urllib.parse
from datetime import date

MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]
VARS = "PWCMPWGT,PEMLR,PRUNEDUR,PRMJOCC1,PRTAGE,PRUNTYPE,PEEDUCA"
GROUPS = ["all", "wc", "wc45", "mgmt", "prof", "ba25"]

# Fixed monthly seasonal factors, January to December (see the docstring). Estimated over FACTOR_YEARS and normalized to mean 1.0,
# kept to five places: the three-place values in the report's methodology (1.104, 1.059, 0.998, ...) are these rounded, and rounding
# them first moves 21 of the 140 published adjusted rates in the third decimal.
SEASONAL_FACTORS = [1.10412, 1.05854, 0.9975, 0.94909, 0.9071, 0.9262, 1.03856, 1.07495, 1.05676, 0.99531, 0.96544, 0.92643]
FACTOR_YEARS = list(range(2015, 2020)) + list(range(2022, 2026))
SITE_COLS = ["month", "wc_ltu_rate_pct_nsa", "wc_ltu_rate_pct_sa", "wc_ltu_rate_3mma_sa", "wc_index_2019_100",
             "wc_unemployment_rate_pct_nsa", "wc_ltu_share_pct_nsa", "wc45_ltu_share_pct_nsa", "all_ltu_share_pct_nsa", "wc_median_weeks_nsa"]

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

def read_cps_file(directory, year, mon):
    """One month from a public CPS basic file (<mon><yy>pub.csv), in the same row layout the API returns. None if the file is absent."""
    path = os.path.join(directory, f"{MONTHS[mon-1]}{str(year)[2:]}pub.csv")
    if not os.path.exists(path):
        return None
    wanted = VARS.split(",")
    with open(path, newline="") as f:
        r = csv.reader(f); head = next(r)
        up = {n.upper(): i for i, n in enumerate(head)}
        cols = [up[v] for v in wanted]
        return [wanted] + [[row[i].strip() for i in cols] for row in r]

def estimate_factors(nsa):
    """Monthly factors from a {YYYY-MM: rate} series: each calendar month's average ratio to its year's mean (over FACTOR_YEARS,
    using the months that exist that year), normalized to average 1.0."""
    ratios = [[] for _ in range(12)]
    for y in FACTOR_YEARS:
        ks = [f"{y}-{m:02d}" for m in range(1, 13) if f"{y}-{m:02d}" in nsa]
        if not ks:
            continue
        mean = sum(nsa[k] for k in ks) / len(ks)
        for k in ks:
            ratios[int(k[5:7]) - 1].append(nsa[k] / mean)
    if any(not r for r in ratios):
        raise SystemExit("Not enough history to estimate seasonal factors (need months in 2015-2019 and 2022-2025)")
    f = [sum(r) / len(r) for r in ratios]
    mu = sum(f) / 12
    return [x / mu for x in f]

def adjusted(nsa, factors):
    """Seasonally adjusted rate for each month: the rate divided by its calendar month's factor."""
    return {k: v / factors[int(k[5:7]) - 1] for k, v in nsa.items()}

def index_base(sa):
    """The 2019 mean of the adjusted rate (the index is 100 at this level). None unless all twelve 2019 months are present."""
    y19 = [v for k, v in sa.items() if k.startswith("2019-")]
    return sum(y19) / len(y19) if len(y19) == 12 else None

def moving_avg(sa, keys, i):
    """3-month average of the adjusted rate over the three latest available months ending at keys[i] (a missing month is skipped)."""
    win = [sa[x] for x in keys[max(0, i - 2):i + 1]]
    return sum(win) / len(win)

def site_row(k, m, sa, ma, base):
    f = lambda v, n: "" if v is None else round(v, n)
    return [k, f(m["ltu_rate"], 3), f(sa, 3), f(ma, 3), f(100 * ma / base, 1) if base else "",
            f(m.get("ur"), 2), f(m.get("ltu_share"), 1), f(m.get("wc45_ltu_share"), 1), f(m.get("all_ltu_share"), 1),
            "" if m.get("median_wks") is None else int(m["median_wks"])]

def monthly_from_summary(g):
    """The site's per-month values from summarize()'s output."""
    wc = g["wc"]
    return dict(ltu_rate=wc["ltu_rate"], ur=wc["ur"], ltu_share=wc["ltu_share"], median_wks=wc["median_wks"],
                wc45_ltu_share=g.get("wc45", {}).get("ltu_share"), all_ltu_share=g.get("all", {}).get("ltu_share"))

def read_site_csv(path):
    """An existing site file as (header, rows, {month: values}); numbers stay as written so old rows are not re-rounded."""
    with open(path, newline="") as f:
        rows = list(csv.reader(f))
    head, body = rows[0], rows[1:]
    if head != SITE_COLS:
        sys.exit(f"{path}: expected the site columns {SITE_COLS}")
    num = lambda v: float(v) if v != "" else None
    monthly = {r[0]: dict(ltu_rate=num(r[1]), ur=num(r[5]), ltu_share=num(r[6]), wc45_ltu_share=num(r[7]), all_ltu_share=num(r[8]), median_wks=num(r[9])) for r in body}
    return body, monthly

def write_csv(path, header, rows):
    with open(path, "w", newline="") as f:
        w = csv.writer(f); w.writerow(header); w.writerows(rows)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--start", default="2015-01"); p.add_argument("--end", default=None)
    p.add_argument("--out", default="wc_index.csv", help="the site file (default wc_index.csv)")
    p.add_argument("--update", metavar="CSV", help="add the months after this site file's last month, keeping its rows; writes to --out, or in place if --out is not given")
    p.add_argument("--cps-dir", metavar="DIR", help="read public CPS files (<mon><yy>pub.csv) from DIR instead of the Census API; no key needed")
    p.add_argument("--factors", choices=["fixed", "refit"], default="fixed", help="fixed: the published monthly factors; refit: estimate them from the series (the yearly re-estimate)")
    p.add_argument("--detail", metavar="CSV", help="also write every group and measure, not seasonally adjusted")
    a = p.parse_args()
    key = os.environ.get("CENSUS_API_KEY")
    if not key and not a.cps_dir:
        sys.exit("Set CENSUS_API_KEY first (free at api.census.gov/data/key_signup.html), or pass --cps-dir with public CPS files")

    def load(y, m):
        return read_cps_file(a.cps_dir, y, m) if a.cps_dir else fetch(y, m, key)

    detail, kept, monthly = {}, [], {}
    if a.update:
        kept, monthly = read_site_csv(a.update)
        last = max(monthly)
        s = (int(last[:4]), int(last[5:7])); s = (s[0], s[1] + 1) if s[1] < 12 else (s[0] + 1, 1)
        e = tuple(map(int, a.end.split("-"))) if a.end else (date.today().year, date.today().month)
        out_path = a.out if a.out != "wc_index.csv" else a.update
    else:
        s = tuple(map(int, a.start.split("-")))
        e = tuple(map(int, a.end.split("-"))) if a.end else (date.today().year, date.today().month)
        out_path = a.out
    new = []
    for y, m in month_range(s, e):
        rows = load(y, m)
        if not rows:
            print(f"{y}-{m:02d}: not available", file=sys.stderr); continue
        g = summarize(rows); k = f"{y}-{m:02d}"
        detail[k] = g; monthly[k] = monthly_from_summary(g); new.append(k)
        print(f"{k}: ok", file=sys.stderr)
    if a.update and not new:
        print("nothing to add", file=sys.stderr); return

    nsa = {k: v["ltu_rate"] for k, v in monthly.items()}
    factors = estimate_factors(nsa) if a.factors == "refit" else SEASONAL_FACTORS
    if a.factors == "refit":
        print("seasonal factors (refit):", [round(x, 3) for x in factors], file=sys.stderr)
    sa = adjusted(nsa, factors)
    base = index_base(sa)
    if base is None:
        print("warning: 2019 is incomplete, so no index is written", file=sys.stderr)
    keys = sorted(monthly)
    if a.update and a.factors == "fixed":
        # Keep the old rows exactly as they are; only the new months are computed (adjusted from the rate, averaged with the two before).
        out_rows = [r for r in kept] + [site_row(k, monthly[k], sa[k], moving_avg(sa, keys, keys.index(k)), base) for k in new]
    else:
        out_rows = [site_row(k, monthly[k], sa[k], moving_avg(sa, keys, i), base) for i, k in enumerate(keys)]
    write_csv(out_path, SITE_COLS, out_rows)
    print(f"wrote {out_path} ({len(out_rows)} months)", file=sys.stderr)

    if a.detail and detail:
        cols = ["month"] + [f"{g}_{m}" for g in GROUPS for m in
                ("ur", "ltu_share", "ltu_rate", "median_wks", "mean_wks", "losers_share", "leavers_share", "n_unemployed")]
        rows = []
        for k in sorted(detail):
            row = [k]
            for g in GROUPS:
                d = detail[k].get(g, {})
                for mm in ("ur", "ltu_share", "ltu_rate", "median_wks", "mean_wks", "losers_share", "leavers_share", "n_unemployed"):
                    v = d.get(mm); row.append("" if v is None else (round(v, 3) if isinstance(v, float) else v))
            rows.append(row)
        write_csv(a.detail, cols, rows)
        print(f"wrote {a.detail} ({len(rows)} months)", file=sys.stderr)

if __name__ == "__main__":
    main()
