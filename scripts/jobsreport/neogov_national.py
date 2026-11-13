#!/usr/bin/env python3
"""Every open NEOGOV (governmentjobs.com) posting in the country: federal contractors aside, this is state, county, city,
school-district, special-district and university jobs, all levels. Written to jobsreport_posting like the metro crawl.

The nationwide search (/jobs) lists 10 jobs a page, ~32,000 jobs, ~3,200 pages. Its sort ties reshuffle between requests, so a
single pass repeats some jobs and misses others (about 1% with a title sort, 10% with the date sort). Two passes in opposite
title order, merged, cover nearly all of them; the run reports how many of the posted total it found. A posting missing from two
consecutive runs is closed (crawl.py mark_missed), so a miss in one run costs nothing.

The listing carries title, employer, location, category, type and pay; descriptions are not fetched (32,000 detail pages a day
is too heavy). robots.txt allows only named search engines; the owner approved crawling anyway on 2026-11-13. It identifies
itself (crawl.UA), pauses between pages and backs off on 429/503.

  python3 scripts/jobsreport/neogov_national.py --dry-run --max-pages 20
  python3 scripts/jobsreport/neogov_national.py            # needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
import argparse, html, json, os, re, sys, time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import crawl as c

GEO_KEY = "us-neogov"
SOURCE = {"name": "neogov-national", "adapter": "neogov_national", "type": "public_sector"}
BASE = "https://www.governmentjobs.com/jobs"
PAUSE = 0.35
PAY = re.compile(r"(\$[\d,]+(?:\.\d+)?)(?:\s*-\s*(\$[\d,]+(?:\.\d+)?))?\s*(Hourly|Annually|Monthly|Biweekly|Weekly)")
PERIOD = {"Hourly": "hour", "Annually": "year", "Monthly": "month", "Biweekly": "biweek", "Weekly": "week"}

def attr(block, name):
    m = re.search(r'data-job-%s="([^"]*)"' % name, block)
    return html.unescape(m.group(1)).strip() if m else None

def parse_page(page_html):
    """-> list of records from one /jobs results fragment."""
    out = []
    for block in re.split(r'(?=<li class="job-item" data-job-id=")', page_html):
        m = re.match(r'<li class="job-item" data-job-id="([^"]+)"', block)
        if not m: continue
        jid = m.group(1)
        link = re.search(r'class="job-details-link"[^>]*href="([^"]+)"', block)
        title = attr(block, "title")
        if not link or not title: continue
        loc = attr(block, "location") or ""
        state = next((t for t in re.findall(r"\b([A-Z]{2})\b", loc) if t in c.US_STATES), None)
        city = None if not loc or re.search(r"county", loc.split(",")[0], re.I) else loc.split(",")[0].strip()
        text = c.strip_html(re.sub(r"<[^>]*>", " ", block.split("primaryInfo", 3)[-1]))
        pay = PAY.search(text)
        lo = hi = per = None
        if pay:
            f = lambda t: float(t.replace("$", "").replace(",", ""))
            lo = f(pay.group(1)); hi = f(pay.group(2)) if pay.group(2) else lo
            per = PERIOD[pay.group(3)]
        rec = c.mk(SOURCE, attr(block, "employer") or "Unknown agency", jid, title=title,
                   url="https://www.governmentjobs.com" + html.unescape(link.group(1)), description="",
                   location_raw=loc or None, locations=[loc] if loc else None, city=city, state=state,
                   employment_type=attr(block, "type"), pay_min=lo, pay_max=hi, pay_period=per, pay_stated=lo is not None,
                   posted_at=None, posted_precision="relative", employer_domain=attr(block, "department"))
        rec["county_fips"] = None
        out.append(rec)
    return out

def crawl_pass(descending, max_pages, seen, log):
    """One full pass of the nationwide search in one title order. Adds new records to `seen`. Returns the posted total."""
    total, page, empty = None, 1, 0
    while page <= max_pages and empty < 3:
        url = f"{BASE}?page={page}&sort=PositionTitle&isDescendingSort={'true' if descending else 'false'}"
        try:
            h = c.http(url, headers={"X-Requested-With": "XMLHttpRequest", "Accept": "text/html"})
        except Exception as e:
            log(f"  page {page} failed ({e}); retrying once"); time.sleep(5)
            try: h = c.http(url, headers={"X-Requested-With": "XMLHttpRequest", "Accept": "text/html"})
            except Exception: empty += 1; page += 1; continue
        if total is None:
            t = re.search(r"([\d,]+) jobs found", h)
            total = int(t.group(1).replace(",", "")) if t else None
        recs = parse_page(h)
        empty = empty + 1 if not recs else 0
        for r in recs: seen.setdefault(r["posting_id"], r)
        if page % 200 == 0: log(f"  page {page}: {len(seen)} unique of {total}")
        if total and page * 10 >= total + 10: break
        page += 1; time.sleep(PAUSE)
    return total

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--max-pages", type=int, default=3500)
    ap.add_argument("--out", default=os.path.join(c.HERE, "out", GEO_KEY))
    a = ap.parse_args()
    log = lambda s: print(s, file=sys.stderr, flush=True)
    c.GEO.update({"key": GEO_KEY, "counties": {}, "cities": {}, "states": [], "search": "", "default": ""})
    seen, total = {}, None
    for descending in (False, True):
        total = crawl_pass(descending, a.max_pages, seen, log) or total
        log(f"pass {'desc' if descending else 'asc'}: {len(seen)} unique of {total} posted")
    recs = list(seen.values())
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, SOURCE["name"] + ".jsonl"), "w") as f:
        for r in recs: f.write(json.dumps(r) + "\n")
    share = f"{100 * len(recs) / total:.1f}%" if total else "unknown"
    log(f"{SOURCE['name']}: {len(recs)} postings, {share} of the posted total")
    if a.dry_run: return
    run_id = c.rest("jobsreport_run", [{"geo": GEO_KEY, "source_name": SOURCE["name"], "source_type": SOURCE["type"],
                                         "note": f"posted total {total}"}], prefer="return=representation")[0]["run_id"]
    c.upsert(recs, run_id, SOURCE["name"])
    if total and len(recs) >= 0.9 * total:  # a short crawl must not close real postings
        c.mark_missed(SOURCE["name"], {r["posting_id"] for r in recs}, run_id)
    else:
        log("coverage under 90%: not closing missed postings")
    c.rest(f"jobsreport_run?run_id=eq.{run_id}", {"finished_at": datetime.now(timezone.utc).isoformat(),
           "fetched": len(recs)}, method="PATCH", prefer="return=minimal")

if __name__ == "__main__":
    main()
