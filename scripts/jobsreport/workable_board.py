#!/usr/bin/env python3
"""
Harvest every US job on Workable's public job board (jobs.workable.com), which lists the jobs employers post in their own Workable
account. Public JSON API the board itself uses; identified user agent; 20 jobs a page, one request at a time, 0.4 s apart.

  python3 scripts/jobsreport/workable_board.py --out out/workable-us.jsonl            # all US jobs, resumable
  python3 scripts/jobsreport/workable_board.py --out out/workable-us.jsonl --max-pages 5  # a trial

Each line: employer, employerWebsite, title, location (city, state, country), employmentType, workplace, posted, applyUrl (the
jobs.workable.com page; its apply button goes to the employer's apply.workable.com page), description (HTML), department.
The cursor is saved next to the output (.cursor) so a stopped run continues where it stopped.
"""
import argparse, json, os, sys, time, urllib.request, urllib.error, urllib.parse
UA = "NextChapterResearch/1.0 (research@launchyournextchapter.com)"
API = "https://jobs.workable.com/api/v1/jobs"

def fetch(params):
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503, 504): time.sleep(5 * (attempt + 1)); continue
            raise
        except Exception: time.sleep(3 * (attempt + 1))
    raise RuntimeError("giving up: " + url)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--out", required=True); ap.add_argument("--location", default="United States")
    ap.add_argument("--max-pages", type=int, default=0); ap.add_argument("--delay", type=float, default=0.4)
    a = ap.parse_args()
    cursor_path = a.out + ".cursor"
    token = open(cursor_path).read().strip() if os.path.exists(cursor_path) else None
    seen = set()
    if os.path.exists(a.out):
        for line in open(a.out):
            try: seen.add(json.loads(line)["id"])
            except Exception: pass
    out = open(a.out, "a"); pages = 0; total = None
    while True:
        p = {"limit": 20, "location": a.location}
        if token: p["pageToken"] = token
        d = fetch(p); total = d.get("totalSize", total)
        for j in d.get("jobs", []):
            if j["id"] in seen: continue
            seen.add(j["id"]); c = j.get("company") or {}; loc = j.get("location") or {}
            out.write(json.dumps({
                "id": j["id"], "employer": c.get("title"), "employerWebsite": c.get("website"), "title": j.get("title"),
                "city": loc.get("city"), "state": loc.get("subregion"), "country": loc.get("countryName"),
                "employmentType": j.get("employmentType"), "workplace": j.get("workplace"), "department": j.get("department"),
                "posted": j.get("created"), "updated": j.get("updated"), "applyUrl": j.get("url"),
                "description": (j.get("description") or "") + (j.get("requirementsSection") or "") + (j.get("benefitsSection") or ""),
            }) + "\n")
        out.flush(); pages += 1
        token = d.get("nextPageToken")
        open(cursor_path, "w").write(token or "")
        if pages % 50 == 0: print(f"{pages} pages, {len(seen)} jobs of {total}", file=sys.stderr)
        if not token or not d.get("jobs") or (a.max_pages and pages >= a.max_pages): break
        time.sleep(a.delay)
    print(f"done: {len(seen)} jobs of {total}")

if __name__ == "__main__": main()
