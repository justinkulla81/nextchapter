#!/usr/bin/env python3
"""
Monthly companion metrics for the NextChapter Displacement Report.

1) Senior openings tracker (pilot) from the ncrawl database (public job postings,
   no member data). Compares only sources seen in BOTH months so coverage changes
   don't masquerade as market changes.

2) AI-washing gap: counts SEC 8-K filings that reference Item 2.05 (exit/restructuring
   costs), with and without the phrase "artificial intelligence", via EDGAR full-text
   search. SEC asks automated clients to send a descriptive User-Agent with a contact
   address: set SEC_USER_AGENT, e.g. "NextChapter Research research@yourdomain.com".

Usage:
  python3 nc_openings_and_aiwashing.py --db ~/nextchapter-jobs/data/jobs.db \
      --month 2026-09 --prev 2026-08 --ytd-start 2026-01-01 --end 2026-09-30
"""
import argparse, collections, json, os, sqlite3, urllib.parse, urllib.request

SENIOR_EXEC = {"C_SUITE", "EVP_SVP", "VP", "HEAD", "BOARD", "PARTNER"}

def openings(db, month, prev):
    c = sqlite3.connect(f"file:{os.path.expanduser(db)}?mode=ro", uri=True)
    rows = c.execute("""
        select p.source_id, substr(p.first_seen,1,7) m, j.level, coalesce(j.function,''), j.remote
        from job_provenance p join jobs j using(fingerprint)
        where substr(p.first_seen,1,7) in (?,?)""", (prev, month)).fetchall()
    seen = collections.defaultdict(set)
    for s, m, *_ in rows: seen[s].add(m)
    panel = {s for s, ms in seen.items() if len(ms) == 2}
    R = [r for r in rows if r[0] in panel]
    def count(pred):
        return {m: sum(1 for r in R if r[1] == m and pred(r)) for m in (prev, month)}
    pct = lambda d: round(100 * (d[month] - d[prev]) / d[prev], 1) if d[prev] else None
    total = count(lambda r: True)
    exec_ = count(lambda r: r[2] in SENIOR_EXEC)
    director = count(lambda r: r[2] not in SENIOR_EXEC)
    remote = count(lambda r: bool(r[4]))
    fn = collections.Counter((r[1], r[3]) for r in R)
    fns = sorted({f for _, f in fn})
    return {
        "panel_sources": len(panel),
        "total": total, "total_pct": pct(total),
        "exec": exec_, "exec_pct": pct(exec_),
        "director": director, "director_pct": pct(director),
        "remote_share": {m: round(100 * remote[m] / total[m], 1) if total[m] else None for m in (prev, month)},
        "by_function": {f: {"prev": fn[(prev, f)], "cur": fn[(month, f)]} for f in fns},
    }

def edgar_count(q, start, end, ua):
    url = "https://efts.sec.gov/LATEST/search-index?" + urllib.parse.urlencode(
        {"q": q, "forms": "8-K", "dateRange": "custom", "startdt": start, "enddt": end})
    req = urllib.request.Request(url, headers={"User-Agent": ua})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["hits"]["total"]["value"]

def aiwashing(ytd_start, q_start, end, ua):
    out = {}
    for label, s in (("ytd", ytd_start), ("quarter", q_start)):
        all_ = edgar_count('"Item 2.05"', s, end, ua)
        ai = edgar_count('"Item 2.05" "artificial intelligence"', s, end, ua)
        out[label] = {"restructuring_8k": all_, "mention_ai": ai,
                      "share_pct": round(100 * ai / all_, 1) if all_ else None}
    return out

if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("--db", required=True); a.add_argument("--month", required=True)
    a.add_argument("--prev", required=True); a.add_argument("--ytd-start", required=True)
    a.add_argument("--quarter-start", default=None); a.add_argument("--end", required=True)
    x = a.parse_args()
    result = {"openings": openings(x.db, x.month, x.prev)}
    ua = os.environ.get("SEC_USER_AGENT")
    if ua:
        result["aiwashing"] = aiwashing(x.ytd_start, x.quarter_start or x.ytd_start, x.end, ua)
    else:
        result["aiwashing"] = "skipped: set SEC_USER_AGENT"
    print(json.dumps(result, indent=2))
