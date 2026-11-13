#!/usr/bin/env python3
"""
Find an employer's board on four public job systems used by mid-size and small employers, from its name, and count the jobs:
BambooHR   https://<name>.bamboohr.com/careers/list           JSON {"meta":{"totalCount":N},"result":[...]}  (an unknown name redirects to bamboohr.com)
SmartRecruiters  https://api.smartrecruiters.com/v1/companies/<Name>/postings?limit=1   totalFound
Recruitee  https://<name>.recruitee.com/api/offers/           JSON {"offers":[...]}  (404 if unknown)
Breezy     https://<name>.breezy.hr/json                      JSON list  (404 if unknown)
Public endpoints, identified user agent.
  python3 scripts/jobsreport/smb_ats_discover.py --names names.txt --out out/smb-ats-found.jsonl --threads 80
"""
import argparse, json, os, re, sys, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from workday_discover import variants
UA = "NextChapterResearch/1.0 (research@launchyournextchapter.com)"

def get_json(url, timeout=15):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"}), timeout=timeout) as r:
            if not r.geturl().startswith(url.split("/")[0] + "//" + url.split("/")[2]): return None   # redirected away
            return json.load(r)
    except Exception: return None

def probe(name):
    found = []
    for v in variants(name)[:3]:
        d = get_json(f"https://{v}.bamboohr.com/careers/list")
        if isinstance(d, dict) and d.get("meta", {}).get("totalCount"): found.append({"system": "bamboohr", "slug": v, "jobs": d["meta"]["totalCount"]})
        d = get_json(f"https://{v}.recruitee.com/api/offers/")
        if isinstance(d, dict) and d.get("offers"): found.append({"system": "recruitee", "slug": v, "jobs": len(d["offers"])})
        d = get_json(f"https://{v}.breezy.hr/json")
        if isinstance(d, list) and d: found.append({"system": "breezy", "slug": v, "jobs": len(d)})
        for ident in {v.capitalize(), v, v.upper()}:
            d = get_json(f"https://api.smartrecruiters.com/v1/companies/{ident}/postings?limit=1")
            if isinstance(d, dict) and d.get("totalFound"): found.append({"system": "smartrecruiters", "slug": ident, "jobs": d["totalFound"]}); break
        if found: break
    return [{"employer": name, **f} for f in found] or [{"employer": name, "system": None}]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--names", required=True); ap.add_argument("--out", required=True); ap.add_argument("--threads", type=int, default=80)
    a = ap.parse_args()
    names = [l.strip() for l in open(a.names) if l.strip()]
    done = set()
    if os.path.exists(a.out):
        for l in open(a.out):
            try: done.add(json.loads(l)["employer"])
            except Exception: pass
    todo = [n for n in names if n not in done]
    out = open(a.out, "a"); k = 0
    with ThreadPoolExecutor(a.threads) as ex:
        for rs in ex.map(probe, todo):
            for r in rs: out.write(json.dumps(r) + "\n")
            out.flush(); k += 1
            if k % 500 == 0: print(k, "of", len(todo), file=sys.stderr)

if __name__ == "__main__": main()
