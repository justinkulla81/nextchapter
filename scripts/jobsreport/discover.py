#!/usr/bin/env python3
"""
Find readable career sites for a list of employers in one place, and write a sources file for crawl.py.

  python3 scripts/jobsreport/discover.py --geo pittsburgh                 # uses candidates/<geo>.txt
  python3 scripts/jobsreport/discover.py --geo pittsburgh --names "UPMC,PNC,PPG"

For each employer name it tries likely Workday tenants (name variants x Workday clusters), then
Greenhouse and Lever board tokens, and keeps boards that return jobs for the place's main city.
Employers on other systems (Taleo, iCIMS, Oracle, SuccessFactors, Eightfold, custom) are listed as
"not found" so they can be added by hand. Output: sources/<geo>.json (merged with any existing file).
Public endpoints only; requests identify NextChapter Research.
"""
import argparse, json, os, re, sys, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
UA = "NextChapterResearch/1.0 (research@launchyournextchapter.com)"
CLUSTERS = ["wd1", "wd5", "wd3", "wd12", "wd2", "wd501", "wd503", "wd115", "wd102", "wd103", "wd10"]
DROP = {"inc", "corp", "corporation", "company", "co", "the", "group", "holdings", "llc", "ltd", "plc", "and", "of", "systems", "services", "bancorp", "financial"}

def get(url, data=None, accept="application/json", timeout=12):
    h = {"User-Agent": UA, "Accept": accept}
    body = None
    if data is not None:
        body = json.dumps(data).encode(); h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        return 0, ""

def variants(name):
    words = [w for w in re.findall(r"[a-z0-9]+", name.lower())]
    core = [w for w in words if w not in DROP] or words
    v = ["".join(words), "".join(core), core[0], "".join(core[:2]), "".join(w[0] for w in core) if len(core) > 1 else None]
    if len(core) > 1:
        v += [core[0] + core[1][:4]]
    out = []
    for x in v:
        if x and 2 < len(x) < 30 and x not in out:
            out.append(x)
    return out

def site_guesses(t, name):
    cap = t[:1].upper() + t[1:]
    words = re.findall(r"[A-Za-z0-9]+", name)
    return [f"{cap}", t, f"{cap}Careers", f"{t}_careers", f"{cap}_Careers", f"{cap}CareerSite", "External", "ExternalSite", "External_Career_Site",
            "Careers", "careers", "Jobs", f"{cap}_External", f"{cap}External", "".join(w.capitalize() for w in words)]

def workday(name, city):
    for t in variants(name):
        for wd in CLUSTERS:
            code, txt = get(f"https://{t}.{wd}.myworkdayjobs.com/robots.txt", accept="text/plain")
            sites = list(dict.fromkeys(re.findall(r"Sitemap:\s*https?://[^/]+/([^/]+)/siteMap\.xml", txt))) if code == 200 else []
            if not sites:
                root, _ = get(f"https://{t}.{wd}.myworkdayjobs.com/", accept="text/html")
                if root in (406, 200, 403, 302):   # the tenant exists but publishes no sitemap: guess its site name
                    sites = [x for x in site_guesses(t, name)
                             if get(f"https://{t}.{wd}.myworkdayjobs.com/wday/cxs/{t}/{x}/jobs", {"appliedFacets": {}, "limit": 1, "offset": 0, "searchText": ""})[0] == 200][:2]
            if sites:
                best = None
                for site in sites[:4]:
                    c, body = get(f"https://{t}.{wd}.myworkdayjobs.com/wday/cxs/{t}/{site}/jobs",
                                  {"appliedFacets": {}, "limit": 1, "offset": 0, "searchText": city})
                    if c == 200:
                        try:
                            total = json.loads(body).get("total", 0)
                        except Exception:
                            total = 0
                        if best is None or total > best[1]:
                            best = (site, total)
                if best:
                    return {"adapter": "workday", "tenant": t, "wd": wd, "site": best[0], "hits": best[1]}
    return None

def greenhouse(name, city):
    for t in variants(name)[:3]:
        code, body = get(f"https://boards-api.greenhouse.io/v1/boards/{t}/jobs?content=false")
        if code == 200:
            try:
                jobs = json.loads(body).get("jobs", [])
            except Exception:
                continue
            hits = sum(1 for j in jobs if city.lower() in (j.get("location", {}).get("name", "")).lower())
            return {"adapter": "greenhouse", "token": t, "hits": hits}
    return None

def lever(name, city):
    for t in variants(name)[:3]:
        code, body = get(f"https://api.lever.co/v0/postings/{t}?mode=json")
        if code == 200:
            try:
                jobs = json.loads(body)
            except Exception:
                continue
            hits = sum(1 for j in jobs if city.lower() in ((j.get("categories") or {}).get("location") or "").lower())
            return {"adapter": "lever", "token": t, "hits": hits}
    return None

def ashby(name, city):
    for t in variants(name)[:3]:
        code, body = get(f"https://api.ashbyhq.com/posting-api/job-board/{t}")
        if code == 200:
            try: jobs = json.loads(body).get("jobs", [])
            except Exception: continue
            hits = sum(1 for j in jobs if city.lower() in (j.get("location") or "").lower() or any(city.lower() in (x.get("location") or "").lower() for x in j.get("secondaryLocations", [])))
            return {"adapter": "ashby", "token": t, "hits": hits}
    return None

def smartrecruiters(name, city):
    for t in variants(name)[:3]:
        code, body = get(f"https://api.smartrecruiters.com/v1/companies/{t}/postings?q={city}&limit=1")
        if code == 200:
            try: n = json.loads(body).get("totalFound", 0)
            except Exception: continue
            return {"adapter": "smartrecruiters", "company": t, "hits": n}
    return None

def find(name, city):
    for fn in (workday, greenhouse, lever, ashby, smartrecruiters):
        r = fn(name, city)
        if r and r["hits"] > 0:
            return {"employer": name, **r}
    return {"employer": name, "adapter": None, "hits": 0}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--geo", required=True)
    ap.add_argument("--names")
    ap.add_argument("--file", help="candidate file path (default candidates/<geo>.txt)")
    a = ap.parse_args()
    geos = json.load(open(os.path.join(HERE, "geos.json")))
    city = geos[a.geo]["search"]
    if a.names:
        names = [n.strip() for n in a.names.split(",") if n.strip()]
    else:
        names = [l.strip() for l in open(a.file or os.path.join(HERE, "candidates", f"{a.geo}.txt")) if l.strip() and not l.startswith("#")]
    with ThreadPoolExecutor(max_workers=10) as ex:
        results = list(ex.map(lambda n: find(n, city), names))
    os.makedirs(os.path.join(HERE, "sources"), exist_ok=True)
    path = os.path.join(HERE, "sources", f"{a.geo}.json")
    existing = json.load(open(path)) if os.path.exists(path) else []
    have = {s["employer"] for s in existing}
    for r in results:
        if r["adapter"] and r["employer"] not in have:
            slug = re.sub(r"[^a-z0-9]+", "-", r["employer"].lower()).strip("-")
            src = {"name": f"{r['adapter'][:2] if r['adapter'] != 'workday' else 'wd'}-{slug}", "adapter": r["adapter"], "type": "direct_ats", "employer": r["employer"]}
            for k in ("tenant", "wd", "site", "token", "company"):
                if k in r: src[k] = r[k]
            existing.append(src)
    json.dump(existing, open(path, "w"), indent=2); open(path, "a").write("\n")
    for r in results:
        print(f"{r['employer']:38} {r['adapter'] or 'NOT FOUND':11} hits={r['hits']}")
    print(f"\n{sum(1 for r in results if r['adapter'])}/{len(results)} readable; wrote {path}", file=sys.stderr)

if __name__ == "__main__":
    main()
