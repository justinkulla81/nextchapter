#!/usr/bin/env python3
"""
Crawl public job postings for the Louisville (Jefferson County, KY) metro and load
them into the jobsreport_* tables in Supabase.

Adapters: workday, greenhouse, lever, usajobs. Sources come from
louisville_sources.json. Uses only the standard library.

  python3 scripts/jobsreport/crawl_louisville.py --dry-run            # fetch, write JSONL, no DB
  python3 scripts/jobsreport/crawl_louisville.py --only workday       # one adapter
  python3 scripts/jobsreport/crawl_louisville.py                      # fetch and upsert

Env (for upsert): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
Env (usajobs): USAJOBS_API_KEY, USAJOBS_USER_AGENT (the account email).

Keeps every level (entry-level and hourly included) and stores raw description
text; filtering by level happens in the report, not here. Honors robots.txt
Disallow rules for the paths it requests. Status: written without network
access; untested against live sites.
"""
import argparse, hashlib, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
UA = "NextChapterResearch/1.0 (+https://launchyournextchapter.com/reports)"

# County FIPS for the Louisville metro (verify metro membership before publishing).
METRO_COUNTIES = {"21111": "Jefferson KY", "21029": "Bullitt KY", "21103": "Henry KY", "21163": "Meade KY",
                  "21179": "Nelson KY", "21185": "Oldham KY", "21211": "Shelby KY", "21215": "Spencer KY",
                  "21223": "Trimble KY", "18019": "Clark IN", "18043": "Floyd IN", "18061": "Harrison IN",
                  "18143": "Scott IN", "18175": "Washington IN"}
CITY_COUNTY = {
    "louisville": "21111", "jeffersontown": "21111", "shively": "21111", "st. matthews": "21111",
    "saint matthews": "21111", "middletown": "21111", "anchorage": "21111", "prospect": "21111",
    "fern creek": "21111", "valley station": "21111", "okolona": "21111", "pleasure ridge park": "21111",
    "shepherdsville": "21029", "mount washington": "21029", "la grange": "21185", "pewee valley": "21185",
    "shelbyville": "21211", "new albany": "18043", "jeffersonville": "18019", "clarksville": "18019",
    "sellersburg": "18019", "charlestown": "18019", "floyds knobs": "18043",
}

def county_for(location):
    loc = (location or "").lower()
    if not loc:
        return None
    in_ky = bool(re.search(r"\b(ky|kentucky)\b", loc)) or "louisville" in loc
    in_in = bool(re.search(r"\b(in|indiana)\b", loc))
    for city, fips in CITY_COUNTY.items():
        if city in loc:
            if fips.startswith("21") and in_in and not in_ky:
                continue
            if fips.startswith("18") and in_ky and not in_in:
                continue
            return fips
    return None

def in_metro(location):
    if re.search(r"louisville,?\s*(co|colorado|ne|nebraska|oh|ohio|ms|mississippi|tn|ga)\b", (location or "").lower()):
        return False
    return county_for(location) in METRO_COUNTIES

MONEY = re.compile(r"\$\s?([\d,]+(?:\.\d+)?)\s*(k)?(?:\s*/\s*(?:hour|hr|year|yr))?(?:\s*(?:-|–|to)\s*\$?\s?([\d,]+(?:\.\d+)?)\s*(k)?)?", re.I)

def parse_pay(text):
    """Pay range stated in the text. Returns (min, max, period) or (None, None, None)."""
    m = MONEY.search(text or "")
    if not m:
        return None, None, None
    def val(num, k):
        v = float(num.replace(",", ""))
        return v * 1000 if k else v
    lo = val(m.group(1), m.group(2)); hi = val(m.group(3), m.group(4)) if m.group(3) else lo
    if hi < lo:
        lo, hi = hi, lo
    if hi < 200:
        period = "hour"
    elif hi < 20000:
        return None, None, None
    else:
        period = "year"
    ctx = (text or "")[max(0, m.start() - 40): m.end() + 40].lower()
    if period == "year" and ("per hour" in ctx or "/hr" in ctx or "hourly" in ctx):
        return None, None, None
    return lo, hi, period

def arrangement_from(text, flag=None):
    t = (text or "").lower()
    if flag:
        f = flag.lower()
        if "remote" in f: return "remote"
        if "hybrid" in f: return "hybrid"
        if "site" in f or "office" in f: return "onsite"
    if re.search(r"\bhybrid\b", t): return "hybrid"
    if re.search(r"\b(fully remote|100% remote|work from home|remote position|this is a remote)\b", t): return "remote"
    if re.search(r"\b(on-?site|in-?office|in office)\b", t): return "onsite"
    return "unspecified"

def strip_html(s):
    s = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</h\d>", "\n", s or "")
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"&nbsp;", " ", s)
    s = re.sub(r"&amp;", "&", s)
    s = re.sub(r"&lt;", "<", s); s = re.sub(r"&gt;", ">", s); s = re.sub(r"&#39;|&apos;", "'", s); s = re.sub(r"&quot;", '"', s)
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n\n", s)).strip()

def http(url, data=None, headers=None, method=None, timeout=30):
    h = {"User-Agent": UA, "Accept": "application/json, text/html;q=0.8"}
    h.update(headers or {})
    body = json.dumps(data).encode() if data is not None else None
    if body: h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=h, method=method or ("POST" if body else "GET"))
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < 2:
                time.sleep(2 * (attempt + 1)); continue
            raise
        except urllib.error.URLError:
            if attempt < 2:
                time.sleep(2 * (attempt + 1)); continue
            raise

def robots_disallows(base, path):
    try:
        txt = http(urllib.parse.urljoin(base, "/robots.txt"), headers={"Accept": "text/plain"}, timeout=15)
    except Exception:
        return False
    applies = False
    for line in txt.splitlines():
        line = line.split("#")[0].strip()
        if line.lower().startswith("user-agent:"):
            applies = line.split(":", 1)[1].strip() == "*"
        elif applies and line.lower().startswith("disallow:"):
            p = line.split(":", 1)[1].strip()
            if p and path.startswith(p):
                return True
    return False

def mk(source, employer, ext_id, **kw):
    rec = {"posting_id": f"{source['name']}:{ext_id}", "source_name": source["name"], "source_type": source["type"],
           "employer": employer}
    rec.update(kw)
    d = rec.get("description") or ""
    rec["desc_hash"] = hashlib.sha1(d.encode()).hexdigest() if d else None
    rec["county_fips"] = county_for(rec.get("location_raw"))
    if rec.get("pay_min") is None:
        lo, hi, per = parse_pay(d)
        rec["pay_min"], rec["pay_max"], rec["pay_period"] = lo, hi, per
        rec["pay_stated"] = lo is not None
    rec["arrangement"] = arrangement_from(d, rec.get("arrangement"))
    return rec

# ---- adapters -------------------------------------------------------------

def crawl_workday(src, log):
    """Workday public CxS JSON API. src: tenant, wd (e.g. wd1), site (optional), employer, search."""
    tenant, wd = src["tenant"], src.get("wd", "wd1")
    base = f"https://{tenant}.{wd}.myworkdayjobs.com"
    sites = [src["site"]] if src.get("site") else []
    if not sites:
        try:
            robots = http(base + "/robots.txt", headers={"Accept": "text/plain"}, timeout=15)
            sites = list(dict.fromkeys(re.findall(r"Sitemap:\s*https?://[^/]+/([^/]+)/siteMap\.xml", robots)))
        except Exception as e:
            log(f"  {src['name']}: site discovery failed: {e}"); return
        if not sites:
            log(f"  {src['name']}: no Workday site found in robots.txt; set \"site\" in the sources file"); return
    for site in sites:
        api = f"{base}/wday/cxs/{tenant}/{site}/jobs"
        if robots_disallows(base, f"/wday/cxs/{tenant}/{site}/jobs"):
            log(f"  {src['name']}/{site}: disallowed by robots.txt, skipped"); continue
        offset, total = 0, None
        while total is None or offset < total:
            page = json.loads(http(api, {"appliedFacets": {}, "limit": 20, "offset": offset,
                                          "searchText": src.get("search", "Louisville")}))
            if total is None:
                total = page.get("total", 0)  # Workday reports the total on the first page only
            posts = page.get("jobPostings", [])
            if not posts: break
            for p in posts:
                loc = p.get("locationsText", "")
                if not src.get("all_local") and loc and not in_metro(loc) and "locations" not in loc.lower():
                    continue
                path = p.get("externalPath", "")
                try:
                    d = json.loads(http(f"{base}/wday/cxs/{tenant}/{site}{path}", method="GET"))
                    info = d.get("jobPostingInfo", {})
                except Exception:
                    info = {}
                loc_full = info.get("location") or loc
                addl = info.get("additionalLocations") or []
                if src.get("all_local"):
                    loc_full = f"{loc_full}, Louisville, KY" if loc_full else "Louisville, KY"
                elif not (in_metro(loc_full) or any(in_metro(a) for a in addl)):
                    continue
                yield mk(src, src.get("employer", tenant), info.get("jobReqId") or path.rsplit("_", 1)[-1],
                         title=info.get("title") or p.get("title", ""), req_id=info.get("jobReqId"),
                         url=info.get("externalUrl") or base + "/" + site + path,
                         description=strip_html(info.get("jobDescription", "")), location_raw=loc_full,
                         locations=[loc_full] + list(addl), employment_type=info.get("timeType"),
                         posted_at=info.get("startDate"), posted_precision="date")
            offset += 20
            time.sleep(0.3)

def crawl_greenhouse(src, log):
    data = json.loads(http(f"https://boards-api.greenhouse.io/v1/boards/{src['token']}/jobs?content=true"))
    for j in data.get("jobs", []):
        loc = (j.get("location") or {}).get("name", "")
        if not in_metro(loc): continue
        yield mk(src, src.get("employer", src["token"]), j["id"], title=j.get("title", ""), url=j.get("absolute_url"),
                 description=strip_html(j.get("content", "")), location_raw=loc, locations=[loc],
                 posted_at=j.get("first_published") or j.get("updated_at"), posted_precision="timestamp",
                 source_updated_at=j.get("updated_at"))

def crawl_lever(src, log):
    data = json.loads(http(f"https://api.lever.co/v0/postings/{src['token']}?mode=json"))
    for j in data:
        cats = j.get("categories", {})
        loc = cats.get("location", "") or ""
        if not in_metro(loc): continue
        ts = j.get("createdAt")
        yield mk(src, src.get("employer", src["token"]), j["id"], title=j.get("text", ""), url=j.get("hostedUrl"),
                 description=j.get("descriptionPlain") or strip_html(j.get("description", "")),
                 location_raw=loc, locations=[loc], employment_type=cats.get("commitment"),
                 arrangement=j.get("workplaceType"),
                 posted_at=datetime.fromtimestamp(ts / 1000, timezone.utc).isoformat() if ts else None,
                 posted_precision="timestamp")

def crawl_usajobs(src, log):
    key, ua = os.environ.get("USAJOBS_API_KEY"), os.environ.get("USAJOBS_USER_AGENT")
    if not key or not ua:
        log("  usajobs: USAJOBS_API_KEY / USAJOBS_USER_AGENT not set, skipped"); return
    page = 1
    while True:
        q = urllib.parse.urlencode({"LocationName": src.get("location", "Louisville, Kentucky"), "Radius": 25,
                                    "ResultsPerPage": 500, "Page": page})
        d = json.loads(http("https://data.usajobs.gov/api/search?" + q,
                            headers={"Authorization-Key": key, "User-Agent": ua, "Host": "data.usajobs.gov"}))
        items = d["SearchResult"]["SearchResultItems"]
        for it in items:
            m = it["MatchedObjectDescriptor"]
            locs = [l.get("LocationName", "") for l in m.get("PositionLocation", [])]
            if not any(in_metro(l) for l in locs): continue
            rem = (m.get("PositionRemuneration") or [{}])[0]
            per = (rem.get("RateIntervalCode") or "").lower()
            yield mk(src, m.get("OrganizationName", "U.S. Government"), it["MatchedObjectId"], title=m.get("PositionTitle", ""),
                     url=m.get("PositionURI"), req_id=(m.get("PositionID")), location_raw=locs[0] if locs else None,
                     locations=locs, description=strip_html((m.get("UserArea", {}).get("Details", {}) or {}).get("JobSummary", "")),
                     pay_min=float(rem["MinimumRange"]) if rem.get("MinimumRange") else None,
                     pay_max=float(rem["MaximumRange"]) if rem.get("MaximumRange") else None,
                     pay_period="year" if per == "pa" else "hour" if per == "ph" else per or None, pay_stated=True,
                     employment_type=",".join(s.get("Name", "") for s in m.get("PositionSchedule", [])),
                     posted_at=m.get("PublicationStartDate"), posted_precision="date")
        if page * 500 >= int(d["SearchResult"]["SearchResultCountAll"]): break
        page += 1

def crawl_neogov(src, log):
    """NEOGOV / governmentjobs.com agency pages (HTML). src: agency slug, employer."""
    agency = src["agency"]
    base = f"https://www.governmentjobs.com/careers/{agency}"
    page, seen, total, empty = 1, set(), None, 0
    while empty < 3 and page <= 40:
        html = http(f"{base}?page={page}", headers={"X-Requested-With": "XMLHttpRequest", "Accept": "text/html"})
        if total is None:
            t = re.search(r'job-postings-number">\s*(\d+)', html)
            total = int(t.group(1)) if t else None
        parts = re.split(r'(?=<li class="list-item" data-job-id=")', html)
        items = [(re.search(r'data-job-id="(\d+)"', b).group(1), b) for b in parts if b.startswith('<li class="list-item"')]
        items = [(i, b) for i, b in items if i not in seen]
        empty = empty + 1 if not items else 0
        if total is not None and len(seen) >= total: break
        for jid, block in items:
            seen.add(jid)
            m = re.search(r'class="item-details-link"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', block, re.S)
            if not m: continue
            href, title = m.group(1), strip_html(m.group(2))
            loc = (re.search(r'<ul class="list-meta">\s*<li>(.*?)</li>', block, re.S) or [None, ""])[1]
            loc = strip_html(loc)
            sched = re.search(r"(Full_Time|Part_Time|Temporary|Seasonal|Per_Diem)", block)
            pay = re.search(r"(\$[\d,]+(?:\.\d+)?)(?:\s*-\s*(\$[\d,]+(?:\.\d+)?))?\s*(Hourly|Annually|Monthly|Biweekly)", block)
            dept = re.search(r'data-department-name="([^"]*)"', block)
            posted = strip_html((re.search(r'list-entry-starts"><span>(.*?)</span>', block, re.S) or [None, ""])[1])
            try:
                detail = http("https://www.governmentjobs.com" + href, headers={"Accept": "text/html"})
                body = re.search(r'id="details-info"[^>]*>(.*?)id="details-benefits"', detail, re.S)
                desc = strip_html(body.group(1)) if body else strip_html((re.search(r'list-entry">(.*?)</div>', block, re.S) or [None, ""])[1])
            except Exception:
                desc = strip_html((re.search(r'list-entry">(.*?)</div>', block, re.S) or [None, ""])[1])
            lo = hi = per = None
            if pay:
                f = lambda t: float(t.replace("$", "").replace(",", ""))
                lo = f(pay.group(1)); hi = f(pay.group(2)) if pay.group(2) else lo
                per = {"Hourly": "hour", "Annually": "year", "Monthly": "month", "Biweekly": "biweek"}[pay.group(3)]
            rec = mk(src, src.get("employer", agency), jid, title=title, url="https://www.governmentjobs.com" + href,
                     description=desc, location_raw=loc or "Louisville, KY", locations=[loc] if loc else None,
                     employment_type=sched.group(1) if sched else None, pay_min=lo, pay_max=hi, pay_period=per,
                     pay_stated=lo is not None, posted_at=None, posted_precision="relative",
                     employer_domain=dept.group(1) if dept else None)
            rec["county_fips"] = rec["county_fips"] or src.get("county_fips", "21111")  # city-government postings
            yield rec
            time.sleep(0.2)
        page += 1
        if page > 60: break

def crawl_jibe(src, log):
    """Jibe (iCIMS) public jobs API: https://<tenant>.jibeapply.com/api/jobs. src: tenant, employer."""
    base = f"https://{src['tenant']}.jibeapply.com/api/jobs"
    page, got, total = 1, 0, None
    while total is None or got < total:
        d = json.loads(http(f"{base}?page={page}&limit=100", headers={"Accept": "application/json"}))
        total = d.get("totalCount", 0)
        jobs = d.get("jobs", [])
        if not jobs: break
        for j in jobs:
            got += 1
            x = j.get("data", {})
            loc = x.get("full_location") or ", ".join(v for v in (x.get("city"), x.get("state")) if v)
            if not in_metro(loc) and not in_metro(f"{x.get('city','')}, {x.get('state','')}"):
                continue
            desc = strip_html(" ".join(filter(None, [x.get("description"), x.get("responsibilities"), x.get("qualifications")])))
            lo, hi = x.get("salary_min_value"), x.get("salary_max_value")
            lo = float(lo) if lo and float(lo) > 0 else None
            hi = float(hi) if hi and float(hi) > 0 else lo
            cats = x.get("categories")
            yield mk(src, x.get("hiring_organization") or src.get("employer", src["tenant"]), x.get("req_id") or x.get("slug"),
                     title=x.get("title", ""), req_id=x.get("req_id"), url=x.get("apply_url"), description=desc,
                     location_raw=loc, city=x.get("city"), state=x.get("state"), locations=[loc],
                     employment_type=x.get("employment_type"), pay_min=lo, pay_max=hi, pay_period="year" if lo else None,
                     pay_stated=lo is not None, posted_at=x.get("posted_date"), posted_precision="timestamp",
                     source_updated_at=x.get("update_date"))
        page += 1
        time.sleep(0.3)

def crawl_applitrack(src, log):
    """Frontline / AppliTrack school-district postings. src: district (slug), employer, location."""
    root = f"https://www.applitrack.com/{src['district']}/onlineapp"
    raw = http(f"{root}/jobpostings/Output.asp?all=1", headers={"Accept": "text/html"}, timeout=90)
    raw = raw.replace("\\'", "'").replace('\\"', '"')  # the listing is a document.write() script with escaped quotes
    jobs = re.findall(r"id='wrapword'[^>]*>(.*?)</td>.*?JobID:\s*(\d+).*?applyFor\('\d+','([^']*)'", raw, re.S)
    seen = set()
    for title, jid, category in jobs:
        if jid in seen: continue
        seen.add(jid)
        title = strip_html(title.split("');")[0])
        try:
            detail = http(f"{root}/jobpostings/Output.asp?AppliTrackJobId={jid}&AppliTrackLayoutMode=detail&AppliTrackViewPosting=1", headers={"Accept": "text/html"})
            detail = detail.replace("\\'", "'").replace('\\"', '"')
            body = strip_html(re.sub(r"(?is)<script.*?</script>|<style.*?</style>", " ", detail))
            k = body.find("JobID:")
            body = body[k:] if k >= 0 else body
            body = body.replace("&nbsp;", " ").replace("&nbsp", " ")
        except Exception:
            body = ""
        posted = re.search(r"Date Posted:\s*([0-9/]+)", body)
        yield mk(src, src.get("employer", src["district"]), jid, title=title,
                 url=f"{root}/default.aspx?AppliTrackJobId={jid}&AppliTrackLayoutMode=detail&AppliTrackViewPosting=1",
                 description=body[:8000], location_raw=src.get("location", "Louisville, KY"), employer_domain=category,
                 posted_at=posted.group(1) if posted else None, posted_precision="date")
        time.sleep(0.2)

def crawl_csod(src, log):
    """Cornerstone career site search API (state government). src: site_id, host, employer. Statewide; keeps Louisville metro."""
    home = http(f"https://{src['host']}/ux/ats/careersite/{src['site_id']}/home?c={src['corp']}", headers={"Accept": "text/html"})
    tok = re.search(r'"token"\s*:\s*"([^"]+)"', home)
    if not tok: log(f"  {src['name']}: no API token on the career site page"); return
    H = {"Authorization": "Bearer " + tok.group(1), "Accept": "application/json"}
    page, total, got = 1, None, 0
    while total is None or got < total:
        body = {"careerSiteId": src["site_id"], "careerSitePageId": src["site_id"], "pageNumber": page, "pageSize": 25, "cultureId": 1,
                "searchText": "", "cultureName": "en-US", "states": [], "countryCodes": [], "cities": [], "placeID": "", "radius": None,
                "unit": None, "postingsWithinDays": None, "customFieldCheckboxKeys": [], "customFieldDropdowns": [], "customFieldRadios": []}
        d = json.loads(http("https://us.api.csod.com/rec-job-search/external/jobs", body, headers=H))["data"]
        total = d.get("totalCount", 0)
        reqs = d.get("requisitions", [])
        if not reqs: break
        for q in reqs:
            got += 1
            locs = [f"{l.get('city','')}, {l.get('state','')}" for l in q.get("locations", [])]
            if not any(in_metro(l) for l in locs): continue
            yield mk(src, src.get("employer", "Commonwealth of Kentucky"), q["requisitionId"], title=q.get("displayJobTitle", ""),
                     url=f"https://{src['host']}/ux/ats/careersite/{src['site_id']}/home/requisition/{q['requisitionId']}?c={src['corp']}",
                     description=strip_html(q.get("externalDescription", "")), location_raw=locs[0], locations=locs,
                     posted_at=q.get("postingEffectiveDate"), posted_precision="date")
        page += 1
        time.sleep(0.3)

ADAPTERS = {"jibe": crawl_jibe, "applitrack": crawl_applitrack, "csod": crawl_csod, "neogov": crawl_neogov, "workday": crawl_workday, "greenhouse": crawl_greenhouse, "lever": crawl_lever, "usajobs": crawl_usajobs}

# ---- loading --------------------------------------------------------------

COLS = ["posting_id", "source_name", "source_type", "employer", "employer_domain", "title", "req_id", "url", "description",
        "desc_hash", "location_raw", "city", "state", "county_fips", "locations", "level", "arrangement", "employment_type",
        "pay_min", "pay_max", "pay_period", "pay_stated", "posted_at", "posted_precision", "source_updated_at"]

def rest(path, rows=None, method="POST", prefer=None):
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/" + path
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    h = {"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"}
    if prefer: h["Prefer"] = prefer
    req = urllib.request.Request(url, data=json.dumps(rows).encode() if rows is not None else None, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=60) as r:
        t = r.read().decode()
        return json.loads(t) if t else None

def upsert(recs, run_id, src_name):
    now = datetime.now(timezone.utc).isoformat()
    for i in range(0, len(recs), 200):
        batch = [{**{c: r.get(c) for c in COLS}, "last_seen": now, "last_run_id": run_id, "missed_runs": 0, "closed_at": None}
                 for r in recs[i:i + 200]]
        rest("jobsreport_posting?on_conflict=posting_id", batch, prefer="resolution=merge-duplicates,return=minimal")
        vers = [{"posting_id": r["posting_id"], "desc_hash": r["desc_hash"], "title": r.get("title"),
                 "description": r.get("description"), "pay_min": r.get("pay_min"), "pay_max": r.get("pay_max")}
                for r in recs[i:i + 200] if r.get("desc_hash")]
        if vers:
            rest("jobsreport_posting_version?on_conflict=posting_id,desc_hash", vers,
                 prefer="resolution=ignore-duplicates,return=minimal")

def mark_missed(src_name, seen_ids, run_id, close_after=2):
    """Postings of this source not seen this run: bump missed_runs; close after N consecutive misses."""
    rows = rest(f"jobsreport_posting?source_name=eq.{urllib.parse.quote(src_name)}&closed_at=is.null&select=posting_id,missed_runs",
                method="GET") or []
    for r in rows:
        if r["posting_id"] in seen_ids: continue
        m = (r["missed_runs"] or 0) + 1
        patch = {"missed_runs": m}
        if m >= close_after: patch["closed_at"] = datetime.now(timezone.utc).isoformat()
        rest(f"jobsreport_posting?posting_id=eq.{urllib.parse.quote(r['posting_id'])}", patch, method="PATCH", prefer="return=minimal")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", default=os.path.join(HERE, "louisville_sources.json"))
    ap.add_argument("--only")
    ap.add_argument("--name", help="run only the source with this name")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--out", default=os.path.join(HERE, "out"))
    a = ap.parse_args()
    log = lambda s: print(s, file=sys.stderr, flush=True)
    sources = [s for s in json.load(open(a.sources)) if (not a.only or s["adapter"] == a.only) and (not a.name or s["name"] == a.name)]
    os.makedirs(a.out, exist_ok=True)
    for src in sources:
        fn = ADAPTERS.get(src["adapter"])
        if not fn: log(f"{src['name']}: no adapter '{src['adapter']}'"); continue
        recs, failed = [], 0
        run_id = None
        try:
            if not a.dry_run:
                run_id = rest("jobsreport_run", [{"geo": "louisville-metro", "source_name": src["name"],
                                                  "source_type": src["type"]}], prefer="return=representation")[0]["run_id"]
            for r in fn(src, log):
                recs.append(r)
        except Exception as e:
            failed = 1; log(f"{src['name']}: failed: {e}")
        log(f"{src['name']}: {len(recs)} metro postings" + (" (FAILED)" if failed else ""))
        with open(os.path.join(a.out, f"{src['name']}.jsonl"), "w") as f:
            for r in recs: f.write(json.dumps(r) + "\n")
        if not a.dry_run:
            upsert(recs, run_id, src["name"])
            if not failed: mark_missed(src["name"], {r["posting_id"] for r in recs}, run_id)
            rest(f"jobsreport_run?run_id=eq.{run_id}", {"finished_at": datetime.now(timezone.utc).isoformat(),
                                                         "fetched": len(recs), "failed": failed}, method="PATCH", prefer="return=minimal")

if __name__ == "__main__":
    main()
