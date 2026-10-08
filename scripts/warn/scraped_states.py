"""
Reads the WARN notices of the states our own fetchers cannot (PDFs,
dashboards, search forms) with Big Local News's open-source scrapers, and
posts each state's standardized notices to NextChapter.

  warn-scraper      reads the state's own page          (Apache 2.0, Stanford)
  warn-transformer  standardizes it: company, location, dates, jobs

Each state runs on its own: a state whose site changed fails alone and is
reported, and the rest still import. Kept in step with SCRAPED_STATES in
src/lib/warn/sources.ts.

Run:  python scripts/warn/scraped_states.py [--dry] [STATE ...]
Env:  NEXTCHAPTER_URL, CRON_SECRET (not needed with --dry)
"""

import datetime
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from importlib import import_module
from pathlib import Path

STATES = ["CT", "GA", "HI", "IL", "KY", "LA", "MO", "MT", "ND", "NM", "NY", "OK", "PA", "SC", "TN", "VA", "WA"]
# Matches MAX_AGE_DAYS in src/lib/warn/sync.ts — older notices would be skipped there anyway.
MAX_AGE_DAYS = 540


def iso(v):
    if v is None:
        return None
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()[:10]
    return str(v)[:10]


def recent(n, since):
    d = iso(n.get("notice_date")) or iso(n.get("effective_date"))
    return d is not None and d >= since


DATE_FORMATS = ["%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%m-%d-%Y", "%Y/%m/%d"]


def parse_date(v):
    v = (v or "").strip()
    if not v:
        return None
    # "Beginning: January 23, 2023; Ending: ..." → the first date in it.
    v = v.split(";")[0].replace("Beginning:", "").strip()
    for f in DATE_FORMATS:
        try:
            d = datetime.datetime.strptime(v[:30].strip(), f).date()
            return d.isoformat() if 1990 <= d.year <= datetime.date.today().year + 2 else None
        except ValueError:
            continue
    return None


def pick(header, *words):
    """The first column whose name contains one of the words, in the order given."""
    low = {h: (h or "").lower() for h in header}
    for w in words:
        for h, l in low.items():
            if w in l:
                return h
    return None


def raw_fallback(state, data_dir):
    """
    When a state's transformer fails on one bad row (a mistyped date, a
    renamed column), read the scraper's raw CSV by column names instead of
    losing the whole state.
    """
    import csv
    with open(data_dir / f"{state.lower()}.csv", newline="", encoding="utf-8", errors="replace") as fh:
        rows = list(csv.DictReader(fh))
    if not rows:
        return []
    header = list(rows[0].keys())
    c_company = pick(header, "company", "employer", "business name", "legal name", "organization", "business", "title")
    if not c_company:
        # A bare "name" column, but never a county, city, notice or contact name.
        c_company = next((h for h in header if "name" in (h or "").lower()
                          and not any(x in (h or "").lower() for x in ("county", "city", "notice", "contact", "lwda", "lwia", "region"))), None)
    c_notice = pick(header, "notice date", "date of notice", "received", "warn date", "date posted", "date filed", "notice")
    c_effective = pick(header, "effective", "separation", "layoff date", "closure date", "impact date", "start")
    if not c_notice and not c_effective:
        c_notice = next((h for h in header if "date" in (h or "").lower()), None)
    c_jobs = pick(header, "affected", "employees", "workers", "jobs", "number", "total")
    c_city = pick(header, "city", "location", "address", "site")
    # Shown in the job log, so a wrong pick is visible rather than silent.
    print(f"{state}: raw columns {header}; using company={c_company!r} notice={c_notice!r} "
          f"effective={c_effective!r} jobs={c_jobs!r} place={c_city!r}", file=sys.stderr, flush=True)
    out = []
    for r in rows:
        try:
            jobs = int(float(str(r.get(c_jobs) or "").replace(",", "").strip())) if c_jobs else None
        except ValueError:
            jobs = None
        out.append({
            "company": (r.get(c_company) or "").strip() if c_company else None,
            "location": (r.get(c_city) or "").strip() or None if c_city else None,
            "notice_date": parse_date(r.get(c_notice)) if c_notice else None,
            "effective_date": parse_date(r.get(c_effective)) if c_effective else None,
            "jobs": jobs,
        })
    return out


def post(state, notices):
    url = os.environ["NEXTCHAPTER_URL"].rstrip("/") + "/api/admin/warn/import-rows"
    req = urllib.request.Request(
        url,
        data=json.dumps({"state": state, "notices": notices}).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {os.environ['CRON_SECRET']}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as res:
        return json.loads(res.read().decode())


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry" in sys.argv
    states = [a.upper() for a in args] or STATES
    since = (datetime.date.today() - datetime.timedelta(days=MAX_AGE_DAYS)).isoformat()
    if not dry and not (os.environ.get("NEXTCHAPTER_URL") and os.environ.get("CRON_SECRET")):
        sys.exit("NEXTCHAPTER_URL and CRON_SECRET must be set (or pass --dry).")

    data_dir = Path(tempfile.mkdtemp(prefix="warn-"))
    failed, imported = [], []
    for state in states:
        try:
            subprocess.run(
                ["warn-scraper", state.lower(), "--data-dir", str(data_dir), "--cache-dir", str(data_dir / "cache"), "-l", "WARNING"],
                check=True, timeout=600,
            )
            try:
                rows = import_module(f"warn_transformer.transformers.{state.lower()}").Transformer(data_dir).transform()
            except Exception as e:
                print(f"{state}: transformer failed ({str(e)[:120]}); reading the raw file by column names", file=sys.stderr, flush=True)
                rows = raw_fallback(state, data_dir)
            notices = [
                {
                    "company": r.get("company"),
                    "location": r.get("location"),
                    "notice_date": iso(r.get("notice_date")),
                    "effective_date": iso(r.get("effective_date")),
                    "jobs": r.get("jobs"),
                    "is_closure": r.get("is_closure"),
                    "is_temporary": r.get("is_temporary"),
                    "is_amendment": r.get("is_amendment"),
                }
                for r in rows
                if recent(r, since)
            ]
            if dry:
                print(f"{state}: {len(rows)} notices, {len(notices)} since {since}", flush=True)
                for n in notices[:2]:
                    print("   ", json.dumps(n)[:220], flush=True)
                continue
            if not notices:
                raise RuntimeError(f"no notices since {since} — the source may have changed")
            result = post(state, notices)
            print(f"{state}: sent {len(notices)} → {json.dumps(result)[:200]}", flush=True)
            if result.get("error"):
                failed.append(state)
            else:
                imported.append(state)
        except Exception as e:  # one state failing must not stop the others
            print(f"{state}: FAILED — {str(e)[:300]}", file=sys.stderr, flush=True)
            failed.append(state)

    print(f"done: {len(imported)} imported, {len(failed)} failed {' '.join(failed)}", flush=True)
    # Fail the job only when every state failed — that is our problem, not one state's site.
    if failed and not imported and not dry:
        sys.exit(1)


if __name__ == "__main__":
    main()
