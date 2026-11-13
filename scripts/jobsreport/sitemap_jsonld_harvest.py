#!/usr/bin/env python3
"""
Read every job page listed in a sitemap and keep the schema.org JobPosting JSON-LD on it (the data Google for Jobs requires of an employer's job page).
One line of JSON per job: source URL, title, employer, city, state, country, employment type, posted, valid through, description length and text.
Public pages, identified user agent, polite rate; resumable (a restarted run skips URLs already written).

  python3 scripts/jobsreport/sitemap_jsonld_harvest.py --sitemap https://www.governmentjobs.com/sitemap.xml --match "/jobs/" --out out/governmentjobs.jsonl --threads 8
  python3 scripts/jobsreport/sitemap_jsonld_harvest.py --sitemap https://www.edjoin.org/sitemap/jobs/1 --out out/edjoin.jsonl --sample 500
"""
import argparse, gzip, json, os, random, re, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
UA = "NextChapterResearch/1.0 (research@launchyournextchapter.com)"

def get(url, timeout=30):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"}), timeout=timeout) as r:
                b = r.read()
                if b[:2] == b"\x1f\x8b": b = gzip.decompress(b)
                return b.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (429, 503): time.sleep(4 * (attempt + 1)); continue
            return ""
        except Exception: time.sleep(2)
    return ""

def locs(xml): return re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml)

def urls_from(sitemap, match):
    out, queue, seen = [], [sitemap], set()
    while queue:
        sm = queue.pop(0)
        if sm in seen: continue
        seen.add(sm)
        for u in locs(get(sm)):
            if u.endswith((".xml", ".xml.gz")) or "/sitemap" in u.split("//", 1)[-1] and not match: queue.append(u)
            elif not match or match in u: out.append(u)
    return list(dict.fromkeys(out))

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

def place(jp):
    loc = jp.get("jobLocation")
    if isinstance(loc, list) and loc: loc = loc[0]
    a = (loc or {}).get("address") if isinstance(loc, dict) else None
    a = a if isinstance(a, dict) else {}
    country = a.get("addressCountry"); country = country.get("name") if isinstance(country, dict) else country
    return a.get("addressLocality"), a.get("addressRegion"), country

def one(url):
    jp = jobposting(get(url))
    if not jp: return {"url": url, "ok": False}
    org = jp.get("hiringOrganization"); org = org.get("name") if isinstance(org, dict) else org
    city, state, country = place(jp)
    desc = jp.get("description") or ""
    return {"url": url, "ok": True, "title": jp.get("title"), "employer": org, "city": city, "state": state, "country": country,
            "employmentType": jp.get("employmentType"), "posted": jp.get("datePosted"), "validThrough": jp.get("validThrough"), "descLen": len(desc), "description": desc}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--sitemap", required=True); ap.add_argument("--match", default=""); ap.add_argument("--out", required=True)
    ap.add_argument("--threads", type=int, default=8); ap.add_argument("--sample", type=int, default=0)
    a = ap.parse_args()
    urls = urls_from(a.sitemap, a.match)
    print(len(urls), "job URLs in the sitemap", file=sys.stderr)
    if a.sample: random.seed(1); urls = random.sample(urls, min(a.sample, len(urls)))
    done = set()
    if os.path.exists(a.out):
        for l in open(a.out):
            try: done.add(json.loads(l)["url"])
            except Exception: pass
    todo = [u for u in urls if u not in done]
    out = open(a.out, "a"); k = 0
    with ThreadPoolExecutor(a.threads) as ex:
        for r in ex.map(one, todo):
            out.write(json.dumps(r) + "\n"); k += 1
            if k % 200 == 0: out.flush(); print(k, "of", len(todo), file=sys.stderr)

if __name__ == "__main__": main()
