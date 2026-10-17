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

# Place being crawled; set from geos.json by main(). Cities map to county FIPS; a location is "in the
# metro" when it names one of the cities and does not name a different state.
GEO = {"key": "louisville-metro", "cities": {}, "states": [], "search": "", "default": ""}
US_STATES = set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split())

def county_for(location):
    loc = location or ""
    low = loc.lower()
    if not low:
        return None
    tokens = set(re.findall(r"\b([A-Z]{2})\b", loc)) & US_STATES
    if tokens and not (tokens & set(GEO["states"])):
        return None  # names a state outside this metro's states
    for city, fips in GEO["cities"].items():
        if re.search(r"\b" + re.escape(city) + r"\b", low):
            return fips
    return None

def in_metro(location):
    return county_for(location) is not None

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
    pid = f"{source['name']}:{ext_id}" if GEO["key"] == "louisville-metro" else f"{GEO['key']}:{source['name']}:{ext_id}"
    rec = {"posting_id": pid, "source_name": source["name"], "source_type": source["type"], "employer": employer, "geo": GEO["key"]}
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
    """Workday public CxS JSON API. src: tenant, wd (e.g. wd1), site (optional), employer, search.
    List pages are read in order; posting details are fetched 8 at a time."""
    from concurrent.futures import ThreadPoolExecutor
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
    cap = int(src.get("max", 0)) or 10**9

    def detail(site, p):
        path = p.get("externalPath", "")
        try:
            d = json.loads(http(f"{base}/wday/cxs/{tenant}/{site}{path}", method="GET"))
            return p, d.get("jobPostingInfo", {})
        except Exception:
            return p, {}

    kept = 0
    for site in sites:
        api = f"{base}/wday/cxs/{tenant}/{site}/jobs"
        if robots_disallows(base, f"/wday/cxs/{tenant}/{site}/jobs"):
            log(f"  {src['name']}/{site}: disallowed by robots.txt, skipped"); continue
        offset, total = 0, None
        while (total is None or offset < total) and kept < cap:
            page = json.loads(http(api, {"appliedFacets": {}, "limit": 20, "offset": offset,
                                          "searchText": src.get("search", GEO["search"])}))
            if total is None:
                total = page.get("total", 0)  # Workday reports the total on the first page only
            posts = page.get("jobPostings", [])
            if not posts: break
            todo = []
            for p in posts:
                loc = p.get("locationsText", "")
                if not src.get("all_local") and loc and not in_metro(loc) and "locations" not in loc.lower():
                    continue
                todo.append(p)
            with ThreadPoolExecutor(max_workers=8) as ex:
                results = list(ex.map(lambda p: detail(site, p), todo))
            for p, info in results:
                path = p.get("externalPath", "")
                loc = p.get("locationsText", "")
                loc_full = info.get("location") or loc
                addl = info.get("additionalLocations") or []
                if src.get("all_local"):
                    loc_full = f"{loc_full}, {GEO['default']}" if loc_full else GEO["default"]
                elif not (in_metro(loc_full) or any(in_metro(a) for a in addl)):
                    continue
                kept += 1
                yield mk(src, src.get("employer", tenant), info.get("jobReqId") or path.rsplit("_", 1)[-1],
                         title=info.get("title") or p.get("title", ""), req_id=info.get("jobReqId"),
                         url=info.get("externalUrl") or base + "/" + site + path,
                         description=strip_html(info.get("jobDescription", "")), location_raw=loc_full,
                         locations=[loc_full] + list(addl), employment_type=info.get("timeType"),
                         posted_at=info.get("startDate"), posted_precision="date")
            offset += 20
            time.sleep(0.15)

def crawl_greenhouse(src, log):
    data = json.loads(http(f"https://boards-api.greenhouse.io/v1/boards/{src['token']}/jobs?content=true"))
    for j in data.get("jobs", []):
        loc = (j.get("location") or {}).get("name", "")
        if not in_metro(loc): continue
        yield mk(src, src.get("employer", src["token"]), j["id"], title=j.get("title", ""), url=j.get("absolute_url"),
                 description=strip_html(j.get("content", "")), location_raw=loc, locations=[loc],
                 posted_at=j.get("first_published") or j.get("updated_at"), posted_precision="timestamp",
                 source_updated_at=j.get("updated_at"))

def crawl_mcloud(src, log):
    """Radancy/TMP "CWS" career sites (e.g. UPMC) on the m-cloud Google search API. src: company (companies/<uuid>), employer, api.
    The API returns 10 jobs a page; pages are read 8 at a time and filtered to the metro."""
    from concurrent.futures import ThreadPoolExecutor
    api = src.get("api", "https://jobsapi-google.m-cloud.io/api/job/search")
    def page(off):
        q = urllib.parse.urlencode({"CompanyName": src["company"], "Limit": 10, "offset": off})
        for _ in range(3):
            try: return json.loads(http(f"{api}?{q}", timeout=60))
            except Exception: time.sleep(2)
        return {"searchResults": []}
    first = page(1)
    total = first.get("totalHits", 0)
    log(f"  {src['name']}: {total} postings on the site")
    pages = [first] + list(ThreadPoolExecutor(max_workers=8).map(page, range(11, total + 1, 10)))
    seen = set()
    for pg in pages:
        for r in pg.get("searchResults", []):
            j = r["job"]
            loc = ", ".join(x for x in (j.get("primary_city"), j.get("primary_state")) if x)
            if j["id"] in seen or not in_metro(loc): continue
            seen.add(j["id"])
            body = strip_html(j.get("description", ""))
            yield mk(src, src.get("employer", "UPMC"), j["id"], title=j.get("title", ""), url=j.get("url"),
                     description=(body + (" Salary: " + j["salary"] if j.get("salary") else "")).strip(), req_id=str(j.get("ref") or ""),
                     location_raw=loc, locations=[loc], employment_type=j.get("employment_type"),
                     arrangement=(j.get("location_type") or "").lower() or None, posted_at=j.get("open_date"), posted_precision="timestamp",
                     source_updated_at=j.get("open_date"))

def crawl_taleo(src, log):
    """Oracle Taleo career sections (e.g. University of Pittsburgh). src: host, sections [{name, portal}], employer.
    The list comes from the careersection REST search; each posting's detail page carries the text and location."""
    from concurrent.futures import ThreadPoolExecutor
    host = src["host"]
    def unesc(p): return urllib.parse.unquote(p.encode().decode("unicode_escape", "ignore"))
    def detail(args):
        sec, jid = args
        try: h = http(f"https://{host}/careersection/{sec['name']}/jobdetail.ftl?job={jid}&lang=en", timeout=40)
        except Exception: return None
        m = re.search(r"api\.fillList\(\s*['\"]requisitionDescriptionInterface['\"]\s*,\s*['\"]descRequisition['\"]\s*,\s*\[(.*?)\]\s*\)", h, re.S)
        if not m: return None
        return [unesc(p) for p in re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(1))]
    body = lambda n: ({"multilineEnabled": False, "sortingSelection": {"sortBySelectionParam": "3", "ascendingSortingOrder": "false"},
        "fieldData": {"fields": {"KEYWORD": "", "LOCATION": ""}, "valid": True},
        "filterSelectionParam": {"searchFilterSelections": [{"id": i, "selectedValues": []} for i in ("POSTING_DATE", "LOCATION", "JOB_FIELD", "JOB_TYPE", "JOB_SCHEDULE")]},
        "advancedSearchFiltersSelectionParam": {"searchFilterSelections": [{"id": i, "selectedValues": []} for i in ("ORGANIZATION", "LOCATION", "JOB_FIELD", "JOB_NUMBER", "URGENT_JOB", "EMPLOYEE_STATUS", "STUDY_LEVEL", "WILL_TRAVEL", "JOB_SHIFT")]},
        "pageNo": n})
    for sec in src["sections"]:
        ids, n = [], 1
        while n < 200:
            hdr = {"Content-Type": "application/json", "tz": "GMT-05:00", "X-Requested-With": "XMLHttpRequest",
                   "Referer": f"https://{host}/careersection/{sec['name']}/jobsearch.ftl"}
            try: pg = json.loads(http(f"https://{host}/careersection/rest/jobboard/searchjobs?lang=en&portal={sec['portal']}", data=body(n), headers=hdr, timeout=40))
            except Exception as e:
                log(f"  {src['name']}/{sec['name']}: list page {n} failed: {e}"); break
            rows = pg.get("requisitionList", [])
            new = [r["jobId"] for r in rows if r["jobId"] not in ids]
            if not new: break
            ids += new; n += 1
        log(f"  {src['name']}/{sec['name']}: {len(ids)} postings listed")
        for d in ThreadPoolExecutor(max_workers=6).map(detail, [(sec, i) for i in ids]):
            if not d or len(d) < 24: continue
            st, _, city = (d[11] or "").partition("-")
            loc = f"{city}, {'PA' if st.strip() == 'Pennsylvania' else st}" if city else ""
            if not in_metro(loc): continue
            text = strip_html(" ".join(x[3:] for x in d[13:23] if x.startswith("!*!")))
            yield mk(src, src.get("employer", src["name"]), d[0] + "-" + sec["name"], title=d[9], url=f"https://{host}/careersection/{sec['name']}/jobdetail.ftl?job={d[0]}",
                     description=text, req_id=d[12], location_raw=loc, locations=[loc], employment_type=d[23])

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
                     description=desc, location_raw=loc or GEO["default"], locations=[loc] if loc else None,
                     employment_type=sched.group(1) if sched else None, pay_min=lo, pay_max=hi, pay_period=per,
                     pay_stated=lo is not None, posted_at=None, posted_precision="relative",
                     employer_domain=dept.group(1) if dept else None)
            rec["county_fips"] = rec["county_fips"] or src.get("county_fips") or (list(GEO["cities"].values())[0] if GEO["cities"] else None)  # city-government postings
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
                 description=body[:8000], location_raw=src.get("location", GEO["default"]), employer_domain=category,
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

ADAPTERS = {"jibe": crawl_jibe, "applitrack": crawl_applitrack, "csod": crawl_csod, "neogov": crawl_neogov, "workday": crawl_workday, "greenhouse": crawl_greenhouse, "mcloud": crawl_mcloud, "taleo": crawl_taleo, "lever": crawl_lever, "usajobs": crawl_usajobs}

# ---- loading --------------------------------------------------------------

COLS = ["posting_id", "geo", "source_name", "source_type", "employer", "employer_domain", "title", "req_id", "url", "description",
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
    rows = rest(f"jobsreport_posting?source_name=eq.{urllib.parse.quote(src_name)}&geo=eq.{urllib.parse.quote(GEO['key'])}&closed_at=is.null&select=posting_id,missed_runs",
                method="GET") or []
    for r in rows:
        if r["posting_id"] in seen_ids: continue
        m = (r["missed_runs"] or 0) + 1
        patch = {"missed_runs": m}
        if m >= close_after: patch["closed_at"] = datetime.now(timezone.utc).isoformat()
        rest(f"jobsreport_posting?posting_id=eq.{urllib.parse.quote(r['posting_id'])}", patch, method="PATCH", prefer="return=minimal")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--geo", default="louisville-metro", help="place key in geos.json")
    ap.add_argument("--sources", help="sources file (default: louisville_sources.json or sources/<geo>.json)")
    ap.add_argument("--only")
    ap.add_argument("--name", help="run only the source with this name")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--out")
    a = ap.parse_args()
    log = lambda s: print(s, file=sys.stderr, flush=True)
    g = json.load(open(os.path.join(HERE, "geos.json")))[a.geo]
    GEO.update({"key": a.geo, "cities": g["cities"], "states": g["states"], "search": g["search"], "default": g["defaultLocation"]})
    if not a.sources:
        legacy = os.path.join(HERE, "louisville_sources.json")
        a.sources = legacy if a.geo == "louisville-metro" else os.path.join(HERE, "sources", f"{a.geo}.json")
    a.out = a.out or os.path.join(HERE, "out", a.geo)
    sources = [s for s in json.load(open(a.sources)) if (not a.only or s["adapter"] == a.only) and (not a.name or s["name"] == a.name)]
    os.makedirs(a.out, exist_ok=True)
    for src in sources:
        fn = ADAPTERS.get(src["adapter"])
        if not fn: log(f"{src['name']}: no adapter '{src['adapter']}'"); continue
        recs, failed = [], 0
        run_id = None
        try:
            if not a.dry_run:
                run_id = rest("jobsreport_run", [{"geo": a.geo, "source_name": src["name"],
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
