#!/usr/bin/env python3
"""Thin-page audit: a stand-in for 'will Google see this page as thin or duplicate'.

Samples pages from each page family of a running site, strips what every page in the family shares (header, footer,
boilerplate), and reports per family: median own words, median numbers, the share of pages whose text is a near copy of a
sibling, and how many pages pass the bar. Google publishes no threshold; these are proxies. The real signal is Search
Console: Pages > 'Crawled - currently not indexed' and 'Duplicate without user-selected canonical'.

usage: page-quality.py BASE_URL [SAMPLE=12]    e.g. page-quality.py http://localhost:3112
"""
import html, json, random, re, statistics, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = sys.argv[1].rstrip('/')
SAMPLE = int(sys.argv[2]) if len(sys.argv) > 2 else 12
BAR = {'own_words': 150, 'numbers': 5, 'max_similarity': 0.85}

FAMILIES = {  # name: (sitemap path, path regex)
    'layoffs/state': ('/sitemap.xml', r'^/layoffs/[a-z-]+$'),
    'layoffs/company': ('/sitemap.xml', r'^/layoffs/company/'),
    'network/company': ('/sitemap.xml', r'^/network/company/'),
    'unemployment/state': ('/sitemap.xml', r'^/unemployment-benefits/[a-z-]+$'),
    'rapid-response/state': ('/sitemap.xml', r'^/rapid-response/[a-z-]+$'),
    'higher-education/state': ('/sitemap.xml', r'^/higher-education/[a-z-]+$'),
    'workforce-boards/state': ('/sitemap.xml', r'^/workforce-boards/[a-z-]+$'),
    'workforce-boards/board': ('/sitemap.xml', r'^/workforce-boards/[a-z-]+/[a-z0-9-]+$'),
    'places/county': ('/places/sitemap.xml', r'/places/[a-z-]+/county/'),
    'places/city': ('/places/sitemap.xml', r'/places/[a-z-]+/city/'),
    'employers': ('/employers/sitemap/0.xml', r'/employers/'),
    'jobs': ('/jobs/sitemap/0.xml', r'/jobs/'),
    'salaries': ('/salaries/sitemap.xml', r'/salaries/.+'),
    'jobs/title': ('/salaries/sitemap.xml', r'/jobs/title/.+'),
}

def get(url):
    try:
        with urllib.request.urlopen(url, timeout=180) as r:
            return r.read().decode('utf8', 'ignore')
    except Exception as e:
        return ''

def urls(sitemap, rx):
    out = re.findall(r'<loc>([^<]+)</loc>', get(BASE + sitemap))
    paths = [re.sub(r'^https?://[^/]+', '', u) for u in out]
    return [p for p in paths if re.search(rx, p)]

def main_text(h):
    m = re.search(r'<main.*?</main>', h, re.S)
    h = m.group(0) if m else h
    h = re.sub(r'<(script|style|nav).*?</\1>', ' ', h, flags=re.S)
    return html.unescape(re.sub(r'<[^>]+>', ' ', h))

def words(t): return re.findall(r"[A-Za-z][A-Za-z'-]+", t.lower())
def shingles(ws, n=5): return {' '.join(ws[i:i+n]) for i in range(max(0, len(ws) - n + 1))}

def audit(name, paths):
    random.seed(7)
    picks = random.sample(paths, min(SAMPLE, len(paths)))
    with ThreadPoolExecutor(2) as ex:
        pages = list(ex.map(lambda p: (p, get(BASE + p)), picks))
    pages = [(p, h) for p, h in pages if h]
    texts = {p: main_text(h) for p, h in pages}
    ws = {p: words(t) for p, t in texts.items()}
    # words that appear on >= 70% of the family's pages are template; the rest are the page's own
    from collections import Counter
    df = Counter(w for p in ws for w in set(ws[p]))
    common = {w for w, c in df.items() if c >= 0.7 * len(ws)} if len(ws) >= 4 else set()
    rows = []
    for p in ws:
        own = [w for w in ws[p] if w not in common]
        nums = len(re.findall(r'\d[\d,.]*', texts[p]))
        sh = shingles(ws[p])
        sim = max((len(sh & shingles(ws[q])) / max(1, len(sh | shingles(ws[q]))) for q in ws if q != p), default=0)
        rows.append((p, len(ws[p]), len(own), nums, sim))
    ok = [r for r in rows if r[2] >= BAR['own_words'] and r[3] >= BAR['numbers'] and r[4] < BAR['max_similarity']]
    med = lambda i: int(statistics.median(r[i] for r in rows)) if rows else 0
    print(f"{name:26} pages={len(paths):6} sampled={len(rows):2} words={med(1):5} own={med(2):5} numbers={med(3):4} max_sim={max((r[4] for r in rows), default=0):.2f} pass={len(ok)}/{len(rows)}")
    for r in rows:
        if r not in ok: print(f"    thin/duplicate: {r[0]} words={r[1]} own={r[2]} numbers={r[3]} sim={r[4]:.2f}")

if __name__ == '__main__':
    only = sys.argv[3:] 
    cache = {}
    for name, (sm, rx) in FAMILIES.items():
        if only and name not in only: continue
        paths = urls(sm, rx)
        if not paths: print(f"{name:26} (no pages found in {sm})"); continue
        audit(name, paths)
