#!/usr/bin/env python3
"""
Like-for-like peer metro comparison from the BLS public API: for one month and one
seasonal-adjustment basis, the same series for every metro.

  python3 scripts/jobsreport/peer_bls.py --geo louisville-metro --months 14
  python3 scripts/jobsreport/peer_bls.py --geo louisville-metro --out scripts/jobsreport/out/peer-bls.json

Series (BLS series IDs; 20 characters):
  LAUS unemployment rate, not seasonally adjusted: LAUMT + state(2) + CBSA(5) + 000000 + 03
  LAUS labor force:                                 ... + 06
  CES total nonfarm, not seasonally adjusted:       SMU + state(2) + CBSA(5) + 00000000 + 01
Metro-area LAUS and CES series are published not seasonally adjusted, so every metro here is
compared on the same basis. Pass BLS_API_KEY for the v2 API (higher limits); without one the v1
limits apply (25 series, 10 years).

Reads metro definitions from geos.json ("cbsa", "stateFips"). Status: written without network
access to api.bls.gov (blocked in the authoring environment); not yet run. Series IDs follow the
documented BLS formats and must be confirmed on first run (the script prints any series BLS
reports as not found).
"""
import argparse, json, os, sys, urllib.request
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
API = "https://api.bls.gov/publicAPI/v2/timeseries/data/"

def series_ids(g):
    base = f"{g['stateFips']}{g['cbsa']}"
    return {"unemployment_rate": f"LAUMT{base}000000003", "labor_force": f"LAUMT{base}000000006",
            "nonfarm": f"SMU{base}00000000001"}

def fetch(ids, start, end):
    body = {"seriesid": ids, "startyear": str(start), "endyear": str(end)}
    key = os.environ.get("BLS_API_KEY")
    if key: body["registrationkey"] = key
    req = urllib.request.Request(API, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        out = json.load(r)
    if out.get("status") != "REQUEST_SUCCEEDED":
        print("BLS:", out.get("message"), file=sys.stderr)
    for m in out.get("message", []):
        print("BLS note:", m, file=sys.stderr)
    return {s["seriesID"]: {f"{d['year']}-{d['period'][1:]}": float(d["value"].replace(",", "")) for d in s["data"] if d["period"].startswith("M")}
            for s in out.get("Results", {}).get("series", [])}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--geo", default="louisville-metro")
    ap.add_argument("--months", type=int, default=14)
    ap.add_argument("--out")
    a = ap.parse_args()
    geos = json.load(open(os.path.join(HERE, "geos.json")))
    keys = [a.geo] + [p for p in geos[a.geo].get("peers", [])]
    metros = {k: geos[k] for k in keys if geos[k].get("cbsa") and geos[k].get("stateFips")}
    missing = [k for k in keys if k not in metros]
    if missing: print("no cbsa/stateFips in geos.json for:", ", ".join(missing), file=sys.stderr)
    ids = {k: series_ids(g) for k, g in metros.items()}
    flat = [s for d in ids.values() for s in d.values()]
    this_year = date.today().year
    data = {}
    for i in range(0, len(flat), 25):
        data.update(fetch(flat[i:i + 25], this_year - 2, this_year))
    # latest month present for every metro's unemployment rate
    common = None
    for k in metros:
        months = set(data.get(ids[k]["unemployment_rate"], {}))
        common = months if common is None else common & months
    latest = max(common) if common else None
    rows = []
    for k, g in metros.items():
        ur, nf = data.get(ids[k]["unemployment_rate"], {}), data.get(ids[k]["nonfarm"], {})
        yo = lambda s, m: (round(100 * (s[m] / s[f"{int(m[:4]) - 1}-{m[5:]}"] - 1), 1)
                           if m in s and f"{int(m[:4]) - 1}-{m[5:]}" in s else None)
        rows.append({"geo": k, "label": g["label"], "month": latest,
                     "unemployment_rate": ur.get(latest), "unemployment_rate_year_ago": ur.get(f"{int(latest[:4]) - 1}-{latest[5:]}") if latest else None,
                     "nonfarm_thousands": nf.get(latest), "nonfarm_12m_pct": yo(nf, latest) if latest else None})
    result = {"basis": "not seasonally adjusted", "month": latest, "rows": rows}
    print(json.dumps(result, indent=2))
    if a.out:
        os.makedirs(os.path.dirname(a.out), exist_ok=True)
        json.dump(result, open(a.out, "w"), indent=2)

if __name__ == "__main__":
    main()
