#!/usr/bin/env python3
"""
Like-for-like peer metro comparison from BLS bulk data files: for one month and one basis,
the same series for every metro. No API key and no daily request limit.

  python3 scripts/jobsreport/peer_bls.py --geo louisville-metro
  python3 scripts/jobsreport/peer_bls.py --geo louisville-metro --out scripts/jobsreport/out/peer-bls.json
  python3 scripts/jobsreport/peer_bls.py --geo louisville-metro --api     # BLS public API instead (needs BLS_API_KEY)

Series (20 characters, verified against the BLS files):
  LAUS unemployment rate, not seasonally adjusted:  LAUMT + state(2) + CBSA(5) + 00000003
  LAUS labor force:                                  LAUMT + state(2) + CBSA(5) + 00000006
  CES total nonfarm (thousands), not seasonally adjusted: SMU + state(2) + CBSA(5) + 0000000001
Metro series are not seasonally adjusted, so every metro is on the same basis.
Files: download.bls.gov/pub/time.series/la/la.data.60.Metro and sm/sm.data.54.TotalNonFarm.All
(about 40 MB each, cached in out/bls-cache/).
"""
import argparse, json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UA = "NextChapterResearch/1.0 (research@launchyournextchapter.com)"  # BLS asks for a contact in the user agent
FILES = {"la": "https://download.bls.gov/pub/time.series/la/la.data.60.Metro",
         "sm": "https://download.bls.gov/pub/time.series/sm/sm.data.54.TotalNonFarm.All"}

def series_ids(g):
    base = f"{g['stateFips']}{g['cbsa']}"
    return {"unemployment_rate": f"LAUMT{base}00000003", "labor_force": f"LAUMT{base}00000006",
            "nonfarm": f"SMU{base}0000000001"}

def cached(name, url, refresh=False):
    d = os.path.join(HERE, "out", "bls-cache"); os.makedirs(d, exist_ok=True)
    path = os.path.join(d, name)
    if refresh or not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=300) as r, open(path, "wb") as f:
            while chunk := r.read(1 << 20): f.write(chunk)
    return path

def read_series(path, wanted):
    out = {s: {} for s in wanted}
    with open(path, encoding="utf-8", errors="replace") as f:
        next(f)
        for line in f:
            sid = line[:20].strip()
            if sid in out:
                p = line.split("\t")
                if p[2].strip().startswith("M") and p[2].strip() != "M13" and p[3].strip() not in ("", "-"):
                    out[sid][f"{p[1].strip()}-{p[2].strip()[1:]}"] = float(p[3])
    return out

def read_api(wanted):
    key = os.environ.get("BLS_API_KEY")
    if not key: sys.exit("--api needs BLS_API_KEY (free at https://data.bls.gov/registrationEngine/)")
    from datetime import date
    body = {"seriesid": list(wanted), "startyear": str(date.today().year - 2), "endyear": str(date.today().year), "registrationkey": key}
    req = urllib.request.Request("https://api.bls.gov/publicAPI/v2/timeseries/data/", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    out = json.load(urllib.request.urlopen(req, timeout=60))
    if out.get("status") != "REQUEST_SUCCEEDED": sys.exit(f"BLS: {out.get('message')}")
    return {s["seriesID"]: {f"{d['year']}-{d['period'][1:]}": float(d["value"].replace(",", "")) for d in s["data"] if d["period"].startswith("M")} for s in out["Results"]["series"]}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--geo", default="louisville-metro")
    ap.add_argument("--out")
    ap.add_argument("--api", action="store_true")
    ap.add_argument("--refresh", action="store_true", help="re-download the cached BLS files")
    a = ap.parse_args()
    geos = json.load(open(os.path.join(HERE, "geos.json")))
    keys = [a.geo] + geos[a.geo].get("peers", [])
    metros = {k: geos[k] for k in keys if geos[k].get("cbsa") and geos[k].get("stateFips")}
    ids = {k: series_ids(g) for k, g in metros.items()}
    la_ids = [s for d in ids.values() for m, s in d.items() if s.startswith("LAU")]
    sm_ids = [s for d in ids.values() for m, s in d.items() if s.startswith("SMU")]
    if a.api:
        data = read_api(la_ids + sm_ids)
    else:
        data = read_series(cached("la.data.60.Metro", FILES["la"], a.refresh), la_ids)
        data.update(read_series(cached("sm.data.54.TotalNonFarm.All", FILES["sm"], a.refresh), sm_ids))
    missing = [s for s, v in data.items() if not v]
    if missing: print("no data for series:", ", ".join(missing), file=sys.stderr)
    common = None
    for k in metros:
        months = set(data.get(ids[k]["unemployment_rate"], {}))
        common = months if common is None else common & months
    if not common: sys.exit("no month common to every metro's unemployment series")
    latest = max(common)
    ago = f"{int(latest[:4]) - 1}-{latest[5:]}"
    rows = []
    for k, g in metros.items():
        ur, nf, lf = (data.get(ids[k][m], {}) for m in ("unemployment_rate", "nonfarm", "labor_force"))
        rows.append({"geo": k, "label": g["label"], "month": latest,
                     "unemployment_rate": ur.get(latest), "unemployment_rate_year_ago": ur.get(ago),
                     "unemployment_change_pts": round(ur[latest] - ur[ago], 1) if latest in ur and ago in ur else None,
                     "nonfarm_thousands": nf.get(latest), "nonfarm_12m_pct": round(100 * (nf[latest] / nf[ago] - 1), 1) if latest in nf and ago in nf else None,
                     "nonfarm_latest_month": max(nf) if nf else None, "labor_force_thousands": round(lf[latest] / 1000, 1) if latest in lf else None})
    result = {"basis": "not seasonally adjusted", "month": latest, "rows": rows}
    print(json.dumps(result, indent=2))
    if a.out:
        os.makedirs(os.path.dirname(a.out), exist_ok=True)
        json.dump(result, open(a.out, "w"), indent=2)

if __name__ == "__main__":
    main()
