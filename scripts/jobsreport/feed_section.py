#!/usr/bin/env python3
"""Reads the AI-exposure summary of the live job-board feed for a place (database function jobsfeed_exposure) into out/<geo>/feed-exposure.json.
  python3 scripts/jobsreport/feed_section.py --geo san-diego     (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)"""
import argparse, json, os, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--geo", required=True); a = ap.parse_args()
    g = json.load(open(os.path.join(HERE, "geos.json")))[a.geo]
    cities = sorted({c.lower() for c in g["cities"]} | {g["search"].lower()})
    base, key = os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    req = urllib.request.Request(f"{base}/rest/v1/rpc/jobsfeed_exposure", data=json.dumps({"p_states": g["states"], "p_cities": cities}).encode(),
                                 headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"})
    out = json.load(urllib.request.urlopen(req, timeout=300))
    os.makedirs(os.path.join(HERE, "out", a.geo), exist_ok=True)
    json.dump(out, open(os.path.join(HERE, "out", a.geo, "feed-exposure.json"), "w"), indent=1)
    print(f"{a.geo}: {out['live']} live feed postings, {out['white_collar']} white-collar")
if __name__ == "__main__":
    main()
