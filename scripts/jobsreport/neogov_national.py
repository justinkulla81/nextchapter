#!/usr/bin/env python3
"""Relevant open NEOGOV (governmentjobs.com) postings, nationwide: state, county, city, school and special districts,
universities. White-collar jobs at every level (Census groups 1 and 2), with full descriptions, into jobsreport_posting.

How, without paging 10 jobs at a time:
  1. /sitemap.xml lists every open job URL (~41,000) in one request; the URL carries the id and a title slug.
  2. The title slug is screened (RELEVANT): clearly non-white-collar jobs (custodian, mechanic, driver, police officer,
     lifeguard ...) are never fetched. Ambiguous titles are kept; classify.sql makes the final white-collar call after load.
  3. Jobs already in the table (open, with a description) are only touched (last_seen), not fetched again.
  4. New relevant jobs are fetched from their own page, which carries schema.org JobPosting data: full description, date
     posted, employer, location, pay, closing date. A few requests at a time.
A job missing from the sitemap on two consecutive runs is closed (crawl.mark_missed). robots.txt allows only named search
engines; the owner approved crawling anyway on 2026-11-13. It identifies itself (crawl.UA) and backs off on 429/503.

  python3 scripts/jobsreport/neogov_national.py --dry-run --limit 40
  python3 scripts/jobsreport/neogov_national.py            # needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
import argparse, html, json, os, re, sys, time, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import crawl as c

GEO_KEY = "us-neogov"
SOURCE = {"name": "neogov-national", "adapter": "neogov_national", "type": "public_sector"}
SITEMAP = "https://www.governmentjobs.com/sitemap.xml"
WORKERS = 6
MIN_SITEMAP_JOBS = 20000  # a short or broken sitemap must not close real postings

# Titles that are clearly not white-collar (service, trades, protective, labor, drivers, food, clerical-only). A title with a
# white-collar word is kept even if it also has one of these ("Maintenance Planner", "Police Records Analyst").
EXCLUDE = re.compile(r"\b(custodian|janitor\w*|housekeep\w*|groundskeeper|laborer|maintenance (worker|mechanic|technician|tech|man)|"
    r"mechanic|welder|carpenter|painter|plumber|electrician|hvac|lineman|lineworker|equipment operator|heavy equipment|truck driver|"
    r"bus driver|driver|chauffeur|operator|refuse|sanitation|landfill|crew (leader|member|chief)|tree trimmer|arborist|"
    r"firefighter|fire fighter|police officer|patrol officer|deputy sheriff|sheriff.s deputy|correctional officer|corrections officer|"
    r"detention officer|jailer|dispatcher|telecommunicator|lifeguard|life guard|cook|food service|cashier|server|bartender|"
    r"recreation (leader|aide|attendant)|camp counselor|seasonal|crossing guard|bus (aide|monitor|attendant)|"
    r"teacher.s aide|instructional aide|paraeducator|paraprofessional|substitute|nursing assistant|cna|medical assistant|"
    r"patient care (tech|assistant)|orderly|attendant|aide|clerk|receptionist|secretary|typist|data entry|mail (clerk|carrier)|"
    r"warehouse|stock(er| clerk)|courier|trades?worker|tradesperson|utility worker|maintenance (i|ii|iii)|"
    r"equipment mechanic|service worker|general (laborer|maintenance)|facility attendant|parking (attendant|enforcement)|"
    r"administrative (assistant|aide)|office (assistant|aide)|recreation assistant|pipe ?layer|correctional deputy|public safety officer|student (worker|assistant)|"
    r"clerical|collector|locksmith|construction worker|police (recruit|cadet)|facilit(y|ies) tech|lift station|trades ?worker|"
    r"meter reader|animal (care|control) (officer|attendant)|kennel|dietary|food|cafeteria|usher|referee|umpire|scorekeeper)\b", re.I)
KEEP = re.compile(r"\b(analyst|engineer|manager|director|supervisor|administrator|accountant|auditor|planner|coordinator|specialist|"
    r"architect|attorney|counsel|paralegal|nurse|physician|therapist|social worker|counselor|librarian|teacher|professor|instructor|"
    r"programmer|developer|scientist|economist|buyer|buyer|inspector|superintendent|principal|officer|chief|executive|assistant (city|county|"
    r"town|district)|budget|finance|financial|human resources|hr|it|information|technology|communications|public information|"
    r"grant|contract|procurement|purchasing|appraiser|assessor|surveyor|designer|researcher|investigator|case ?manager|"
    r"program|project|policy|compliance|risk|legal|records analyst)\b", re.I)

def relevant(title):
    return not EXCLUDE.search(title) or bool(KEEP.search(title)) and not re.search(
        r"\b(police|fire|correctional|corrections|detention|deputy|public safety) officer\b|\b(driver|operator|custodian|mechanic|assistant|aide|clerk)\b", title, re.I)

def sitemap_jobs(log):
    xml = c.http(SITEMAP, headers={"Accept": "application/xml"}, timeout=120)
    jobs = {}
    for m in re.finditer(r"<loc>(https://www\.governmentjobs\.com/jobs/(\d+-\d+)/([^<]*))</loc>", xml):
        jobs[m.group(2)] = (m.group(1), m.group(3).replace("-", " "))
    log(f"sitemap: {len(jobs)} open jobs")
    return jobs

def existing_ids(log):
    """Open us-neogov postings already stored with a description; selects the id column only, 1,000 rows a request."""
    have, off = set(), 0
    while True:
        rows = c.rest(f"jobsreport_posting?geo=eq.{GEO_KEY}&source_name=eq.{SOURCE['name']}&closed_at=is.null&description=neq.&select=posting_id"
                      f"&order=posting_id&limit=1000&offset={off}", method="GET") or []
        have.update(r["posting_id"] for r in rows)
        if len(rows) < 1000: break
        off += 1000
    log(f"already stored: {len(have)}")
    return have

PERIOD = {"HOUR": "hour", "YEAR": "year", "MONTH": "month", "WEEK": "week", "DAY": "day"}

def parse_detail(url, jid, page):
    """JobPosting JSON-LD from a job page -> record, or None."""
    posting = None
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', page, re.S):
        try: d = json.loads(m.group(1))
        except ValueError: continue
        if isinstance(d, dict) and d.get("@type") == "JobPosting": posting = d; break
    if not posting or not posting.get("title"): return None
    addr = (posting.get("jobLocation") or {})
    addr = (addr[0] if isinstance(addr, list) and addr else addr).get("address", {}) if addr else {}
    state = addr.get("addressRegion") or None
    city = (addr.get("addressLocality") or "").split(",")[0].strip() or None
    if city and re.search(r"\d{5}", city): city = None
    loc = ", ".join(x for x in (city, state) if x) or None
    sal = (posting.get("baseSalary") or {}).get("value") or {}
    lo, hi = sal.get("minValue"), sal.get("maxValue")
    per = PERIOD.get(str(sal.get("unitText", "")).upper())
    lo = float(lo) if lo else None
    hi = float(hi) if hi else lo
    desc = c.strip_html(html.unescape(posting.get("description") or ""))
    rec = c.mk(SOURCE, (posting.get("hiringOrganization") or {}).get("name") or "Unknown agency", jid,
               title=html.unescape(posting["title"]).strip(), url=url, description=desc, location_raw=loc,
               locations=[loc] if loc else None, city=city, state=state if state in c.US_STATES else None,
               employment_type=posting.get("employmentType"), pay_min=lo, pay_max=hi, pay_period=per if lo else None,
               pay_stated=lo is not None, posted_at=posting.get("datePosted"), posted_precision="date")
    rec["county_fips"] = None
    return rec

def fetch_one(args):
    jid, url = args
    for attempt in range(3):
        try:
            return parse_detail(url, jid, c.http(url, headers={"Accept": "text/html"}))
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, help="fetch at most this many new jobs")
    ap.add_argument("--out", default=os.path.join(c.HERE, "out", GEO_KEY))
    a = ap.parse_args()
    log = lambda s: print(s, file=sys.stderr, flush=True)
    c.GEO.update({"key": GEO_KEY, "counties": {}, "cities": {}, "states": [], "search": "", "default": ""})
    jobs = sitemap_jobs(log)
    keep = {j: v for j, v in jobs.items() if relevant(v[1])}
    log(f"relevant by title: {len(keep)} of {len(jobs)}")
    have = set() if a.dry_run and not os.environ.get("SUPABASE_URL") else existing_ids(log)
    pid = lambda j: f"{GEO_KEY}:{SOURCE['name']}:{j}"
    new = [(j, v[0]) for j, v in keep.items() if pid(j) not in have]
    if a.limit: new = new[:a.limit]
    log(f"to fetch: {len(new)} new")
    recs = []
    with ThreadPoolExecutor(WORKERS) as ex:
        for i, r in enumerate(ex.map(fetch_one, new), 1):
            if r: recs.append(r)
            if i % 500 == 0: log(f"  fetched {i}/{len(new)}")
    log(f"{SOURCE['name']}: {len(recs)} new postings with descriptions")
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, SOURCE["name"] + ".jsonl"), "w") as f:
        for r in recs: f.write(json.dumps(r) + "\n")
    if a.dry_run: return
    run_id = c.rest("jobsreport_run", [{"geo": GEO_KEY, "source_name": SOURCE["name"], "source_type": SOURCE["type"],
                                         "note": f"sitemap {len(jobs)}, relevant {len(keep)}, new {len(recs)}"}],
                    prefer="return=representation")[0]["run_id"]
    c.upsert(recs, run_id, SOURCE["name"])
    seen = {pid(j) for j in keep}  # everything in the sitemap and relevant counts as seen, fetched now or earlier
    if len(jobs) >= MIN_SITEMAP_JOBS:
        c.mark_missed(SOURCE["name"], seen, run_id)
    else:
        log("sitemap looks short: not closing missed postings")
    c.rest(f"jobsreport_run?run_id=eq.{run_id}", {"finished_at": datetime.now(timezone.utc).isoformat(),
           "fetched": len(recs)}, method="PATCH", prefer="return=minimal")

if __name__ == "__main__":
    main()
