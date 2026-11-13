#!/usr/bin/env python3
"""
Fast career-host finder: for each employer name, try careers.<name>.com and jobs.<name>.com (two name variants), and when the page answers,
name the job system behind it (Workday, Phenom, iCIMS, SuccessFactors, Eightfold, Oracle, Taleo, Greenhouse, Lever, ...). Career hosts only, never the corporate site.
  python3 scripts/jobsreport/career_hosts_fast.py --names names.txt --out out/career-hosts.jsonl --threads 40
"""
import argparse, json, os, re, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from career_site import SYSTEMS, fetch
from workday_discover import variants

def look(name):
    for v in variants(name)[:2]:
        for p in ("careers", "jobs"):
            host = f"{p}.{v}.com"
            code, body = fetch(f"https://{host}")
            if code == 200 and len(body) > 1500:
                systems = {}
                for k, pat in SYSTEMS.items():
                    m = re.search(pat, body)
                    if m: systems[k] = m.group(0)[:100]
                return {"employer": name, "host": host, "systems": systems}
    return {"employer": name, "host": None}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--names", required=True); ap.add_argument("--out", required=True); ap.add_argument("--threads", type=int, default=40)
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
        for r in ex.map(look, todo):
            out.write(json.dumps(r) + "\n"); out.flush(); k += 1
            if k % 500 == 0: print(k, "of", len(todo), file=sys.stderr)

if __name__ == "__main__": main()
