#!/usr/bin/env python3
"""
Find the public job-board source for each company in a CSV (company column), on Greenhouse, Lever and Ashby.
Strict: only the full normalised company name (and its no-suffix form) is tried as a board address, never the first word,
and a Greenhouse board's own name must match. Writes sources/<out>.json (crawl.py format) and out/<out>-report.json.

  python3 scripts/jobsreport/unicorn_probe.py --csv us_unicorns.csv --out unicorns-us
Public endpoints only; requests identify NextChapter Research.
"""
import argparse, csv, json, os, re, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from discover import get, HERE

SUFFIX = r"\b(inc|incorporated|corp|corporation|company|co|llc|ltd|labs|technologies|technology|holdings|systems|group|the)\b"

def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()

def tokens(name):
    base = norm(re.sub(r"\(.*?\)", "", name))
    short = norm(re.sub(SUFFIX, " ", base))
    out = []
    for b in (base, short):
        for t in (b.replace(" ", ""), b.replace(" ", "-")):
            if t and t not in out: out.append(t)
    return out

def same(a, b):
    a, b = norm(re.sub(SUFFIX, " ", norm(a))), norm(re.sub(SUFFIX, " ", norm(b)))
    return a == b or a.replace(" ", "") == b.replace(" ", "")

def jload(url):
    code, body = get(url)
    if code != 200: return None
    try: return json.loads(body)
    except Exception: return None

def probe(name):
    for t in tokens(name):
        d = jload(f"https://boards-api.greenhouse.io/v1/boards/{t}")
        if d and d.get("name") and same(d["name"], name):
            j = jload(f"https://boards-api.greenhouse.io/v1/boards/{t}/jobs")
            n = len(j.get("jobs", [])) if j else 0
            if n: return {"platform": "greenhouse", "token": t, "jobs": n, "boardName": d["name"]}
    for t in tokens(name):
        d = jload(f"https://api.lever.co/v0/postings/{t}?mode=json")
        if isinstance(d, list) and d:
            org = (d[0].get("company") or d[0].get("categories", {}).get("team") or "")
            return {"platform": "lever", "token": t, "jobs": len(d), "verified": bool(org and same(org, name))}
    for t in tokens(name):
        d = jload(f"https://api.ashbyhq.com/posting-api/job-board/{t}")
        if d and d.get("jobs"):
            return {"platform": "ashby", "token": t, "jobs": len(d["jobs"]), "verified": False}
    return None

def source(name, r):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    base = {"type": "direct_ats", "employer": name}
    if r["platform"] == "greenhouse": return {"name": f"gr-{slug}", "adapter": "greenhouse", "token": r["token"], **base}
    if r["platform"] == "lever": return {"name": f"lv-{slug}", "adapter": "lever", "token": r["token"], **base}
    return {"name": f"ab-{slug}", "adapter": "ashby", "token": r["token"], **base}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--csv", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args()
    names = [r["company"] for r in csv.DictReader(open(a.csv))]
    with ThreadPoolExecutor(max_workers=10) as ex: res = list(ex.map(probe, names))
    rep, srcs = [], []
    for n, r in zip(names, res):
        rep.append({"employer": n, **(r or {"platform": None})})
        if r and r["platform"] != "ashby" or (r and r["platform"] == "ashby"): srcs.append(source(n, r))
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    json.dump(rep, open(os.path.join(HERE, "out", f"{a.out}-report.json"), "w"), indent=1)
    json.dump(srcs, open(os.path.join(HERE, "sources", f"{a.out}.json"), "w"), indent=2)
    found = [r for r in rep if r["platform"]]
    print(f"{len(names)} companies, {len(found)} with a board, {sum(r['jobs'] for r in found)} jobs (all countries)")
    by = {}
    for r in found: by[r["platform"]] = by.get(r["platform"], 0) + 1
    print(by)

if __name__ == "__main__": main()
