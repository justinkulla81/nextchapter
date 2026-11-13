#!/usr/bin/env python3
"""Relevant open NEOGOV (governmentjobs.com) postings, nationwide: state, county, city, school and special districts,
universities. White-collar jobs at every level (Census groups 1 and 2), with full descriptions, into jobsreport_posting.

How, without paging 10 jobs at a time:
  1. /sitemap.xml lists every open job URL (~41,000) in one request; the URL carries the id and a title slug.
  2. The title slug is screened (relevant()): only professional and management titles pass; trades, service, protective,
     clerical, part-time and pool titles are never fetched. Quality over volume; classify.sql makes the final tag after load.
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

# The screen is positive: a title must name a professional or management role (PROFESSIONAL) and must not be a trade, service,
# protective, clerical or labor role (NOT_WHITE_COLLAR), however it is worded. Quality over volume: a white-collar job with an
# unusual title is skipped rather than risk a blue-collar one getting in. classify.sql makes the final tag after load.
NOT_WHITE_COLLAR = re.compile(r"\b(custodi\w+|janitor\w*|housekeep\w*|groundskeep\w*|labor\w*|mechanic\w*|welder|carpent\w*|painter|plumb\w*|"
    r"electrician|hvac|line ?(man|worker|crew)|operator|operations? (aide|assistant)|heavy equipment|driver|chauffeur|refuse|sanitation|"
    r"landfill|solid waste|crew|tree|arborist|forest(er)? (tech|aide)|firefighter|fire ?fighter|police|patrol|deputy|sheriff|"
    r"correction\w*|detention|jail\w*|dispatch\w*|telecommunicator|lifeguard|cook|chef|baker|food|dietary|cafeteria|cashier|server|"
    r"bartender|usher|seasonal|temporary|part[- ]time|substitute|sub|crossing guard|aide|attendant|assistant|clerk|clerical|"
    r"receptionist|secretary|typist|data entry|mail|warehouse|stock\w*|courier|trades?|utility|maintenance|repair\w*|facilit\w*|"
    r"custody|guard|security|ranger|lookout|laundry|meter|kennel|animal (care|control|shelter)|field (tech|worker|aide)|"
    r"technician|tech|installer|inspector aide|worker|helper|apprentice|trainee|intern|student|volunteer|pool|on call|on-call|"
    r"parking|gym|fitness|activities|pt|extra help|stipend|coach|referee|umpire|scorekeeper|paraprofessional|paraeducator|nursing assistant|cna|lpn|"
    r"medical (assistant|records)|patient (care|support)|orderly|phlebotom\w*|pharmacy tech\w*|radiologic tech\w*|sterile)\b", re.I)
PROFESSIONAL = re.compile(r"\b(analyst|engineer\w*|manager|director|administrator|accountant|accounting|auditor|actuary|economist|"
    r"statistician|planner|coordinator|specialist|architect|attorney|counsel|paralegal|legal|judge|magistrate|nurse|physician|"
    r"psychiatrist|psychologist|pharmacist|dentist|veterinarian|therapist|dietitian|epidemiologist|social worker|counselor|clinician|"
    r"librarian|archivist|curator|teacher|professor|lecturer|faculty|instructor|dean|provost|principal|superintendent|programmer|"
    r"developer|software|devops|cyber\w*|network|database|gis|data|web|systems?|scientist|biologist|chemist|geologist|hydrologist|"
    r"researcher|research|investigator|appraiser|assessor|surveyor|designer|writer|editor|producer|buyer|procurement|purchasing|"
    r"contract\w*|grants?|budget|fiscal|finance|financial|treasurer|controller|payroll|human resources|hr|recruiter|"
    r"compliance|risk|policy|program|project|consultant|advisor|adviser|liaison|executive|chief|president|vice president|"
    r"administrator|supervisor|officer|communications?|public information|marketing|outreach|public health|health educator|"
    r"caseworker|case manager|probation|parole|registrar|recorder|commissioner|ombudsman|strategist|strategy|operations)\b", re.I)

def relevant(title):
    t = title.lower()
    if NOT_WHITE_COLLAR.search(t) and not re.search(r"\b(director|manager|chief|superintendent|attorney|counsel|engineer\w*|analyst|"
            r"administrator|principal|dean|professor|teacher|librarian|accountant|physician|nurse)\b", t):
        return False
    if re.search(r"\b(police|fire|correction\w*|detention|jail\w*|sheriff|deputy|custodi\w+|mechanic\w*|maintenance|operator|"
                 r"driver|laborer|assistant)\b.*\b(officer|supervisor|technician|worker|specialist|aide|assistant|operator)\b", t):
        return False  # a protective, trade or support role even when it carries a manager-sounding noun
    return bool(PROFESSIONAL.search(t))

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
