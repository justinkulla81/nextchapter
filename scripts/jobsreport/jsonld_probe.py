#!/usr/bin/env python3
"""
Universal fallback for an employer whose job system has no adapter: read the career host's sitemap(s), fetch job pages,
and parse the schema.org JobPosting JSON-LD that Google for Jobs requires. Public pages only, identified user agent.

  python3 scripts/jobsreport/jsonld_probe.py jobs.exxonmobil.com jobs.walgreens.com
Prints, per host: sitemap files found, job-looking URLs, and how many of a sample parse as JobPosting (title, location, date).
"""
import json, re, sys, urllib.request, urllib.error, gzip
from concurrent.futures import ThreadPoolExecutor
UA = "NextChapterResearch/1.0 (research@launchyournextchapter.com)"
JOBISH = re.compile(r"/(job|jobs|position|positions|requisition|opening|career|careers|vacanc)[^/]*/|/\d{4,}", re.I)

def get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*", "Accept-Encoding": "gzip"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            b = r.read()
            if r.headers.get("Content-Encoding") == "gzip" or b[:2] == b"\x1f\x8b": b = gzip.decompress(b)
            return r.status, b.decode("utf-8", "replace")
    except urllib.error.HTTPError as e: return e.code, ""
    except Exception: return 0, ""

def locs(xml): return re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml)

def sitemaps(host):
    out = []
    code, robots = get(f"https://{host}/robots.txt")
    for m in re.findall(r"(?im)^sitemap:\s*(\S+)", robots): out.append(m)
    for p in ("/sitemap.xml", "/sitemap_index.xml", "/sitemap1.xml"):
        if not out:
            c, body = get(f"https://{host}{p}")
            if c == 200 and "<loc>" in body: out.append(f"https://{host}{p}")
    return out

def job_urls(host, cap=20000):
    urls, seen, queue = [], set(), sitemaps(host)[:12]
    while queue and len(urls) < cap:
        sm = queue.pop(0)
        if sm in seen: continue
        seen.add(sm)
        c, body = get(sm)
        if c != 200: continue
        for u in locs(body):
            if u.endswith((".xml", ".xml.gz")) or "sitemap" in u.lower().split("/")[-1]: queue.append(u)
            elif JOBISH.search(u): urls.append(u)
    return urls, list(seen)

def jobposting(html):
    for m in re.finditer(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, re.S | re.I):
        try: d = json.loads(m.group(1))
        except Exception: continue
        stack = d if isinstance(d, list) else [d]
        while stack:
            x = stack.pop()
            if isinstance(x, dict):
                if x.get("@graph"): stack += x["@graph"]
                t = x.get("@type")
                if t == "JobPosting" or (isinstance(t, list) and "JobPosting" in t): return x
    return None

def probe(host):
    urls, sms = job_urls(host)
    sample = urls[:: max(1, len(urls) // 8)][:8] if urls else []
    ok = 0; first = None
    for u in sample:
        c, h = get(u)
        jp = jobposting(h) if c == 200 else None
        if jp:
            ok += 1; first = first or (jp.get("title"), (jp.get("jobLocation") or {}) if isinstance(jp.get("jobLocation"), dict) else "list", jp.get("datePosted"))
    return {"host": host, "sitemaps": len(sms), "jobUrls": len(urls), "sampled": len(sample), "jobPostingJsonLd": ok, "example": first}

if __name__ == "__main__":
    with ThreadPoolExecutor(6) as ex:
        for r in ex.map(probe, sys.argv[1:]): print(json.dumps(r, default=str)[:400])
