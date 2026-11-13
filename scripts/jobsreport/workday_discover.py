#!/usr/bin/env python3
"""
Find the Workday career site (tenant, cluster, site) of many employers from their names, and its job count.

A real Workday tenant answers HTTP 404 on a wrong site name; a name that is not a tenant answers 422. So a tenant is found without a
site name, then the site name is guessed (External, Careers, <Tenant>, <Tenant>Careers ...). Public JSON endpoint (/wday/cxs/<tenant>/<site>/jobs),
identified user agent. Output: one JSON line per employer found, resumable.

  python3 scripts/jobsreport/workday_discover.py --names names.txt --out out/workday-found.jsonl --threads 24
names.txt: one employer name per line.
"""
import argparse, json, os, re, sys, urllib.request, urllib.error, time
from concurrent.futures import ThreadPoolExecutor
UA = "NextChapterResearch/1.0 (research@launchyournextchapter.com)"
CLUSTERS = ["wd1", "wd5", "wd3", "wd12", "wd2", "wd501", "wd503", "wd102", "wd103", "wd10", "wd115"]
DROP = {"inc", "incorporated", "corp", "corporation", "company", "co", "ltd", "limited", "plc", "llc", "lp", "the", "holdings", "holding", "group", "international", "intl", "sa", "nv", "ag", "se", "de", "cv", "of", "and"}
SITES = ["External", "external", "Careers", "careers", "External_Career", "ExternalCareerSite", "External_Careers", "{t}", "{T}", "{t}careers", "{T}Careers", "{T}_Careers", "{t}_careers",
         "Careers_External", "jobs", "Jobs", "search", "Search", "External_Site", "ExternalSite", "{T}External", "{t}External", "{T}_External", "{T}CareerSite", "{T}_Career", "careersite", "CareerSite", "Global", "global", "US", "USA", "en-US"]

GENERIC = {"university", "college", "colleges", "hospital", "hospitals", "medical", "center", "centers", "health", "healthcare", "system", "systems", "foundation", "institute", "school", "schools",
           "regional", "community", "memorial", "general", "childrens", "children", "association", "society", "county", "city", "state", "national", "american", "united", "services", "service"}

def variants(name):
    s = re.sub(r"\(.*?\)", " ", name.lower().replace("&", " and ").replace("'", ""))
    toks = [t for t in re.findall(r"[a-z0-9]+", s)]
    core = [t for t in toks if t not in DROP] or toks
    out = []
    def add(v):
        if v and len(v) >= 3 and v not in out and v not in GENERIC and v not in DROP: out.append(v)
    add("".join(core)); add("".join(core[:2])); add(core[0] if core else "")
    if len(core) >= 3: add("".join(w[0] for w in core))
    # universities, hospitals, nonprofits: tenants usually drop the generic words ("University of Michigan" -> umich, michigan)
    plain = [t for t in core if t not in GENERIC]
    if plain and plain != core:
        add("".join(plain)); add("".join(plain[:2])); add(plain[0])
        if "university" in core or "college" in core: add("u" + plain[0])
    return out[:7]

def call(t, c, site, timeout=12):
    body = json.dumps({"limit": 1, "offset": 0, "searchText": "", "appliedFacets": {}}).encode()
    req = urllib.request.Request(f"https://{t}.{c}.myworkdayjobs.com/wday/cxs/{t}/{site}/jobs", data=body, headers={"Content-Type": "application/json", "User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(3 * (attempt + 1)); continue
            return e.code, None
        except urllib.error.URLError: return 0, None   # no DNS record: the tenant is not on this cluster
        except Exception: time.sleep(1)
    return 0, None

def robots_sites(t, c):
    """Every career site the tenant publishes: its robots.txt lists a siteMap.xml per site."""
    try:
        with urllib.request.urlopen(urllib.request.Request(f"https://{t}.{c}.myworkdayjobs.com/robots.txt", headers={"User-Agent": UA}), timeout=12) as r:
            txt = r.read().decode("utf-8", "replace")
    except Exception:
        return []
    out = []
    for m in re.finditer(r"(?im)^sitemap:\s*https://[^/]+/([^/\s]+)/siteMap\.xml", txt):
        if m.group(1) not in out: out.append(m.group(1))
    return out

def probe(name):
    found = []
    for t in variants(name):
        for c in CLUSTERS:
            if call(t, c, "zzzz")[0] != 404: continue
            T = t.capitalize()
            sites = robots_sites(t, c) or [x.replace("{t}", t).replace("{T}", T) for x in SITES]
            for site in sites:
                code, d = call(t, c, site)
                if code == 200 and d and d.get("total"):
                    found.append({"employer": name, "tenant": t, "wd": c, "site": site, "total": d["total"]})
                    if len(found) >= 12: break
            if not found: found.append({"employer": name, "tenant": t, "wd": c, "site": None, "total": None})
            break
        if found and found[-1]["site"]: break
    return found

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--names", required=True); ap.add_argument("--out", required=True); ap.add_argument("--threads", type=int, default=24)
    a = ap.parse_args()
    names = [l.strip() for l in open(a.names) if l.strip()]
    done = set()
    if os.path.exists(a.out):
        for l in open(a.out):
            try: done.add(json.loads(l)["employer"])
            except Exception: pass
    todo = [n for n in names if n not in done]
    out = open(a.out, "a"); n_done = 0
    with ThreadPoolExecutor(a.threads) as ex:
        for name, res in zip(todo, ex.map(probe, todo)):
            for r in res: out.write(json.dumps(r) + "\n")
            if not res: out.write(json.dumps({"employer": name, "tenant": None}) + "\n")
            out.flush(); n_done += 1
            if n_done % 200 == 0: print(n_done, "of", len(todo), file=sys.stderr)

if __name__ == "__main__": main()
