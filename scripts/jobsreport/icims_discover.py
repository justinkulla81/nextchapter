#!/usr/bin/env python3
"""
Find iCIMS career portals from employer names and estimate how many jobs each lists.

An iCIMS portal answers HTTP 200 on https://careers-<name>.icims.com/jobs/search?ss=1&in_iframe=1 (or jobs-<name>, <name>); an unknown portal answers 404 "gone".
The page says "Page 1 of N" and lists the job ids on it, so jobs is about N times the rows on page one. Public pages, identified user agent.
  python3 scripts/jobsreport/icims_discover.py --names names.txt --out out/icims-found.jsonl --threads 80
"""
import argparse, json, os, re, sys, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from workday_discover import variants
UA = "NextChapterResearch/1.0 (research@launchyournextchapter.com)"

def get(host):
    url = f"https://{host}.icims.com/jobs/search?ss=1&in_iframe=1"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=15) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e: return e.code, ""
    except Exception: return 0, ""

def probe(name):
    for i, v in enumerate(variants(name)[:4]):
        hosts = [f"careers-{v}", f"jobs-{v}"] + ([v] if i == 0 else [])
        for h in hosts:
            code, body = get(h)
            if code == 200 and len(body) > 5000:
                m = re.search(r"Page \d+ of (\d+)", body)
                pages = int(m.group(1)) if m else 1
                ids = set(re.findall(r"/jobs/(\d{3,8})/", body))
                return {"employer": name, "host": f"{h}.icims.com", "pages": pages, "rowsPage1": len(ids), "estJobs": pages * max(len(ids), 1)}
    return {"employer": name, "host": None}

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
        for r in ex.map(probe, todo):
            out.write(json.dumps(r) + "\n"); out.flush(); k += 1
            if k % 500 == 0: print(k, "of", len(todo), file=sys.stderr)

if __name__ == "__main__": main()
