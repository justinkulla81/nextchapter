#!/usr/bin/env python3
"""
Check that a board found by name really belongs to the employer (guessing a platform address from a name collides:
"city of new york", "new york state", "general", "air"). For each Workday, Greenhouse, Lever, Ashby and SmartRecruiters source
it reads the board's name or a few postings and requires the employer's distinctive word(s) in them.

  python3 scripts/jobsreport/verify_sources.py sources/aggregator-direct-2026-11-13.json

Writes the file back with only verified sources, and out/go-direct-rejected-<date>.json with the rest and why.
Sources on other systems (Jibe, Oracle, Taleo, ...) came from the employer's own career host and are kept.
"""
import datetime, json, os, re, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from discover import get, HERE

STOP = {"inc", "corp", "corporation", "company", "co", "the", "group", "holdings", "llc", "ltd", "plc", "and", "of", "systems", "services",
        "international", "global", "solutions", "technologies", "technology", "health", "healthcare", "partners", "consulting", "staffing",
        "state", "city", "university", "united", "american", "national", "new", "york", "for", "usa", "us"}

def words(name):
    w = [x for x in re.findall(r"[a-z0-9]+", name.lower()) if x not in STOP and len(x) > 2]
    return w

def hit(text, name):
    """every distinctive word of the name appears in the text (whole words)."""
    t = (text or "").lower()
    flat = re.sub(r"[^a-z0-9]", "", t)
    allw = re.findall(r"[a-z0-9]+", name.lower())
    w = words(name)
    if not w:                     # a name of only common words ("city of new york"): the whole name must appear
        return bool(allw) and "".join(allw) in flat
    if "".join(allw) in flat:     # the whole name, any spacing ("Goodwin Recruiting" / "goodwinrecruiting")
        return True
    return all(re.search(r"\b" + re.escape(x) + r"\b", t) for x in w)

def board_match(board, emp):
    """a board's own name vs the employer: the same distinctive words, or the board name (2+ words) inside the employer's.
    One shared word is not enough ("Apex Eye" is not "Apex Systems")."""
    b, e = set(words(board)), set(words(emp))
    if not b or not e: return False
    return b == e or (len(b) >= 2 and b <= e) or (len(e) >= 2 and e <= b) or "".join(re.findall(r"[a-z0-9]+", board.lower())) == "".join(re.findall(r"[a-z0-9]+", emp.lower()))

def jget(url, data=None):
    c, b = get(url, data)
    try: return c, json.loads(b)
    except Exception: return c, None

def check(s):
    """Board belongs to the employer? Names where the system gives one; otherwise the name in several postings, a board big enough
    to be real, and (Workday) US postings. Heuristic: the crawler dry run must still confirm the company on each board."""
    a, emp = s["adapter"], s.get("employer", "")
    if a == "greenhouse":
        c, d = jget(f"https://boards-api.greenhouse.io/v1/boards/{s['token']}")
        return bool(d) and board_match(d.get("name", ""), emp), f"board name {(d or {}).get('name')}"
    if a == "smartrecruiters":
        c, d = jget(f"https://api.smartrecruiters.com/v1/companies/{s['company']}/postings?limit=3")
        names = " ".join((x.get("company") or {}).get("name", "") for x in (d or {}).get("content", []))
        return hit(names, emp), f"company {names[:40]}"
    if a == "lever":
        c, d = jget(f"https://api.lever.co/v0/postings/{s['token']}?mode=json")
        jobs = d if isinstance(d, list) else []
        n = sum(hit((j.get("descriptionPlain") or "")[:4000], emp) for j in jobs[:5])
        return len(jobs) >= 5 and n >= 2, f"{len(jobs)} jobs, name in {n} of 5"
    if a == "ashby":
        c, d = jget(f"https://api.ashbyhq.com/posting-api/job-board/{s['token']}")
        jobs = (d or {}).get("jobs", [])
        n = sum(hit((j.get("descriptionPlain") or "")[:4000], emp) for j in jobs[:5])
        return len(jobs) >= 5 and n >= 2, f"{len(jobs)} jobs, name in {n} of 5"
    if a == "workday":
        t, wd, site = s["tenant"], s["wd"], s["site"]
        c, d = jget(f"https://{t}.{wd}.myworkdayjobs.com/wday/cxs/{t}/{site}/jobs", {"appliedFacets": {}, "limit": 10, "offset": 0, "searchText": ""})
        posts = (d or {}).get("jobPostings", [])
        locs = [p.get("locationsText", "") or "" for p in posts]
        coded = [m.group(1) for l in locs for m in [re.match(r"([A-Z]{2})-", l)] if m]       # "IN-HYD-SAR1": country-coded sites
        us = sum(c == "US" for c in coded) >= sum(c != "US" for c in coded)                   # "5 Locations" tells nothing: not held against it
        n = 0
        for p in posts[:5]:
            c2, d2 = jget(f"https://{t}.{wd}.myworkdayjobs.com/wday/cxs/{t}/{site}{p.get('externalPath','')}")
            i = ((d2 or {}).get("jobPostingInfo") or {})
            n += hit((i.get("jobDescription") or "")[:4000] + " " + ((d2 or {}).get("hiringOrganization") or {}).get("name", ""), emp)
        return us and n >= 2, f"US postings {us}, name in {n} of 5"
    return True, "career-host system"

def main():
    path = os.path.abspath(sys.argv[1])
    src = json.load(open(path))
    with ThreadPoolExecutor(max_workers=16) as ex:
        res = list(ex.map(lambda s: check(s), src))
    ok = [s for s, (g, _) in zip(src, res) if g]
    bad = [{**s, "why": w} for s, (g, w) in zip(src, res) if not g]
    json.dump(ok, open(path, "w"), indent=2); open(path, "a").write("\n")
    out = os.path.join(HERE, "out"); os.makedirs(out, exist_ok=True)
    json.dump(bad, open(os.path.join(out, f"go-direct-rejected-{datetime.date.today().isoformat()}.json"), "w"), indent=1)
    print(f"verified {len(ok)} of {len(src)}; rejected {len(bad)} (name collisions or unverifiable)")
    for b in bad[:40]: print("  -", b["employer"], b["adapter"], b.get("token") or b.get("tenant") or b.get("company"), "|", b["why"])

if __name__ == "__main__":
    main()
