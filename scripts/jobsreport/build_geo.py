#!/usr/bin/env python3
"""
One command from nothing to a finished leave-behind for any U.S. metro. No model in the loop.

  python3 scripts/jobsreport/build_geo.py --name "Nashville, TN"        # new place: adds it, sweeps, crawls, tags, publishes
  python3 scripts/jobsreport/build_geo.py --geo nashville               # existing place: refresh and republish
  ... --discover    also verify employers listed in candidates/<geo>.txt (see suggest_employers.py)
  ... --no-crawl    only regenerate the report from what is already loaded

Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (crawl writes straight to the database; tagging and statistics are database functions).
Outputs scripts/jobsreport/out/<geo>/report.html and report.pdf.
"""
import argparse, json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
def run(*args, check=True):
    print("+", " ".join(args), flush=True)
    return subprocess.run([PY, os.path.join(HERE, args[0]), *args[1:]], check=check)
def rpc(fn, body):
    import urllib.request
    base, key = os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    req = urllib.request.Request(f"{base}/rest/v1/rpc/{fn}", data=json.dumps(body).encode(), headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=300))
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--name"); ap.add_argument("--geo"); ap.add_argument("--peers", default="")
    ap.add_argument("--discover", action="store_true"); ap.add_argument("--no-crawl", action="store_true"); ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()
    geos = json.load(open(os.path.join(HERE, "geos.json")))
    geo = a.geo
    if a.name:
        before = set(geos); run("add_geo.py", "--name", a.name, *( ["--peers", a.peers] if a.peers else []))
        geo = next(k for k in json.load(open(os.path.join(HERE, "geos.json"))) if k not in before) if True else geo
    if not geo: sys.exit("give --geo or --name")
    if not a.no_crawl:
        if a.discover: run("discover.py", "--geo", geo)
        run("sweep.py", "--rebuild"); run("sweep.py", "--geo", geo)
        own = os.path.join(HERE, "louisville_sources.json" if geo == "louisville-metro" else f"sources/{geo}.json")
        jobs = []
        for path in [own, os.path.join(HERE, "sources", f"{geo}.sweep.json")]:
            if os.path.exists(path): jobs += [(path, s["name"]) for s in json.load(open(path))]
        def one(j): return subprocess.run([PY, os.path.join(HERE, "crawl.py"), "--geo", geo, "--sources", j[0], "--name", j[1]], capture_output=True, text=True, timeout=3600)
        with ThreadPoolExecutor(max_workers=a.workers) as ex:
            for j, r in zip(jobs, ex.map(one, jobs)):
                print((r.stdout.strip().splitlines() or ["(no output)"])[-1] if r.returncode == 0 else f"{j[1]}: FAILED {r.stderr.strip().splitlines()[-1:]}", flush=True)
        print("tagged rows:", rpc("jobsreport_classify", {"p_all": False}))
    run("peer_bls.py", "--geo", geo, "--out", os.path.join(HERE, "out", f"peer-bls-{geo}.json"), check=False)
    run("feed_section.py", "--geo", geo, check=False)
    run("geo_report.py", "--geo", geo); run("publish.py", "--geo", geo)
if __name__ == "__main__":
    main()
