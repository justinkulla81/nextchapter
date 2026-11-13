#!/usr/bin/env python3
"""
Go direct for the employers that reach us through Jooble and Careerjet.

Input: the result of aggregator_employers.sql (employers with more than one live aggregator job), as a JSON list of
{co, rows_total, jooble, careerjet}. For each employer not already a crawler source, find its CAREER site and job system
(never the corporate site; CLAUDE.md "Employer discovery rule"), and write sources in crawler format.

  python3 scripts/jobsreport/go_direct.py --employers out/aggregator-employers-2026-11-13.json --limit 150
  python3 scripts/jobsreport/go_direct.py --employers ... --offset 150 --limit 150     # next slice, same cycle

Outputs (date-stamped):
  sources/aggregator-direct-<date>.json     high confidence: the board address is the employer's own name, or the career
                                            host links to it. Import these into ncrawl (docs/specs/ncrawl-aggregator-direct-prompt.md).
  out/go-direct-review-<date>.json          a board was found under a shortened name: check the company before use
  out/go-direct-notfound-<date>.json        no readable system yet (custom or unprobed): next adapter to build, by rows
  out/go-direct-skipped-<date>.json         unnamed or junk labels, and employers that already have a source

Skipped on purpose: generic labels ("Confidential", "Remote", "Work at home", ...) and junk boards. Staffing firms and
recruiters are kept (owner decision 2026-11-13: fine when the jobs are real). Public endpoints only, identified user agent.
"""
import argparse, datetime, glob, json, os, re, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from discover import variants, workday, greenhouse, lever, ashby, smartrecruiters, HERE
from career_site import look, to_source

GENERIC = re.compile(r"^(confidential|undisclosed|anonymous|stealth|private employer|our client|client of|remote|work at home|clients? blackbox|gpac|"
                     r"testing site.*|federal government of the united states|clearancejobs|grabjobs|jobot|talent\.com|jobrapido|adzuna|ziprecruiter|learn4good)\b", re.I)

def norm(name):
    s = name.lower().replace("&", " and ")
    s = re.sub(r"\b(inc|llc|ltd|corp|corporation|co|company|the)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def covered():
    """normalized employer names that already have a crawler source."""
    have = set()
    for f in glob.glob(os.path.join(HERE, "sources", "*.json")):
        try:
            for s in json.load(open(f)):
                if s.get("employer"): have.add(norm(s["employer"]))
        except Exception:
            pass
    return have

def key(s):
    return (s["adapter"], s.get("tenant") or s.get("token") or s.get("company") or s.get("host") or s.get("agency"))

def probe(row):
    name = row["co"]
    # 1. the career site and the job-system links on it
    try:
        src = to_source(look(name))
    except Exception:
        src = None
    if src and not src.get("needs_portal"):
        return {**row, "source": src, "confidence": "high", "via": "career-site"}
    # 2. the employer's own name as a board address on the public ATS platforms
    for fn in (greenhouse, lever, ashby, smartrecruiters, workday):
        try:
            r = fn(name, "")
        except Exception:
            r = None
        if r and r.get("hits", 0) > 0:
            tok = r.get("token") or r.get("tenant") or r.get("company")
            full = tok in variants(name)[:2]        # the whole name, not a first-word guess ("general", "air", "maple")
            slug = re.sub(r"[^a-z0-9]+", "-", name).strip("-")
            pre = {"workday": "wd", "greenhouse": "gr", "lever": "lv", "ashby": "ab", "smartrecruiters": "sr"}[r["adapter"]]
            s = {"name": f"{pre}-{slug}", "adapter": r["adapter"], "type": "direct_ats", "employer": name.title()}
            for k in ("tenant", "wd", "site", "token", "company"):
                if k in r: s[k] = r[k]
            return {**row, "source": s, "confidence": "high" if full else "review", "via": "platform-name", "boardJobs": r["hits"]}
    return {**row, "source": None, "confidence": None}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--employers", required=True)
    ap.add_argument("--offset", type=int, default=0)
    ap.add_argument("--limit", type=int, default=150)
    ap.add_argument("--min-rows", type=int, default=2, help="employers with at least this many live aggregator jobs (more than 1 = 2)")
    ap.add_argument("--workers", type=int, default=10)
    a = ap.parse_args()
    rows = json.load(open(a.employers))
    if isinstance(rows, dict): rows = rows.get("top", rows.get("rows", []))
    rows = [r for r in rows if r["rows_total"] >= a.min_rows]
    rows.sort(key=lambda r: -r["rows_total"])
    rows = rows[a.offset:a.offset + a.limit]
    have, todo, skipped = covered(), [], []
    for r in rows:
        if GENERIC.match(r["co"].strip()): skipped.append({**r, "why": "generic or junk label"})
        elif norm(r["co"]) in have: skipped.append({**r, "why": "already a crawler source"})
        else: todo.append(r)
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        res = list(ex.map(probe, todo))
    day = datetime.date.today().isoformat()
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    path = os.path.join(HERE, "sources", f"aggregator-direct-{day}.json")
    cur = json.load(open(path)) if os.path.exists(path) else []
    known = {key(s) for s in cur}
    for f in glob.glob(os.path.join(HERE, "sources", "*.json")):      # one source per board across all files
        if f != path:
            try: known |= {key(s) for s in json.load(open(f)) if "adapter" in s}
            except Exception: pass
    added, review, notfound, dup = [], [], [], []
    for r in res:
        s = r["source"]
        if not s: notfound.append({k: r[k] for k in ("co", "rows_total", "jooble", "careerjet")}); continue
        if key(s) in known: dup.append(r["co"]); continue
        known.add(key(s))
        (added if r["confidence"] == "high" else review).append(r)
    cur += [r["source"] for r in added]
    json.dump(cur, open(path, "w"), indent=2); open(path, "a").write("\n")
    for name, data in (("review", review), ("notfound", notfound), ("skipped", skipped)):
        json.dump(data, open(os.path.join(HERE, "out", f"go-direct-{name}-{day}.json"), "w"), indent=1)
    jobs = lambda xs: sum(x["rows_total"] for x in xs)
    print(f"probed {len(todo)} employers ({jobs(todo)} aggregator jobs); skipped {len(skipped)}")
    print(f"  source found, high confidence: {len(added)} employers, {jobs(added)} aggregator jobs  -> {os.path.relpath(path)}")
    print(f"  source found, review:          {len(review)} employers, {jobs(review)} aggregator jobs")
    print(f"  duplicate of a known board:    {len(dup)}")
    print(f"  not found:                     {len(notfound)} employers, {jobs(notfound)} aggregator jobs")
    for r in added[:25]:
        print(f"    + {r['co']:36} {r['rows_total']:5}  {r['source']['adapter']}  via {r['via']}")

if __name__ == "__main__":
    main()
