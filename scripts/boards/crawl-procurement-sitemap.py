#!/usr/bin/env python3
"""Find each workforce board's procurement / RFP page.

Input : boards.tsv  (id \t state \t website)
Output: procurement_results2.json, procurement_results2.csv

For every board: read the site's page, score its links for procurement words, try a few common paths on the
same host, fetch the best candidates, and record the best page plus any open-solicitation lines found.
Polite: one request at a time per host, 1 second apart, honest user agent, 12 second timeout, at most 10 requests per board.
"""
import csv, json, re, sys, threading, time, urllib.request, urllib.error, ssl
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

HERE = sys.argv[1] if len(sys.argv) > 1 else '.'
UA = 'Mozilla/5.0 (compatible; NextChapterBenefitsCheck/1.0; +https://launchyournextchapter.com)'
WORDS = re.compile(r'procure|\brfp|\brfq|\brfi\b|\bbids?\b|solicitation|request(s)? for (proposal|quote|qualification|information)|contract(ing)? opportunit|vendor|funding opportunit|notice of funding|nofo|open (bids|solicitations)|doing business', re.I)
STRONG = re.compile(r'procure|\brfp|\brfq|solicitation|request(s)? for (proposal|quote|qualification)|\bbids?\b', re.I)
PATHS = ['/procurement', '/rfp', '/rfps', '/bids', '/solicitations', '/business/procurement', '/about/procurement', '/about-us/procurement',
         '/doing-business', '/vendors', '/funding-opportunities', '/request-for-proposals', '/procurement-opportunities', '/opportunities']
ITEM = re.compile(r'^(.{8,160}?(RFP|RFQ|RFI|Request for (Proposal|Quote|Qualification|Information)|Invitation for Bid|Notice of Funding)[^\n]{0,160})$', re.I | re.M)
DATE = re.compile(r'(\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2},? 20\d\d|\b\d{1,2}/\d{1,2}/(20)?\d\d\b|20\d\d-\d\d-\d\d)', re.I)
ctx = ssl.create_default_context()
host_locks, glock = {}, threading.Lock()


class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.links = []; s.text = []; s.skip = 0; s._href = None; s._t = []
    def handle_starttag(s, t, a):
        if t in ('script', 'style', 'noscript', 'svg'): s.skip += 1
        if t == 'a': s._href = dict(a).get('href'); s._t = []
        if t in ('br', 'p', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'div'): s.text.append('\n')
    def handle_endtag(s, t):
        if t in ('script', 'style', 'noscript', 'svg') and s.skip: s.skip -= 1
        if t == 'a' and s._href: s.links.append((s._href, ' '.join(s._t).strip())); s._href = None
    def handle_data(s, d):
        if s.skip: return
        if d.strip():
            s.text.append(d.strip() + ' ')
            if s._href is not None: s._t.append(d.strip())


def get(url):
    host = urlparse(url).netloc
    with glock: lk = host_locks.setdefault(host, threading.Lock())
    with lk:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,*/*'})
            with urllib.request.urlopen(req, timeout=12, context=ctx) as r:
                ct = r.headers.get('Content-Type', '')
                raw = r.read(700000)
                final = r.geturl(); code = r.status
            time.sleep(1.0)
            if 'html' not in ct and 'pdf' not in ct and ct: return code, final, None, None
            if 'pdf' in ct: return code, final, '', []
            p = P(); p.feed(raw.decode('utf-8', 'ignore'))
            return code, final, re.sub(r'[ \t]+', ' ', ''.join(p.text)), p.links
        except urllib.error.HTTPError as e:
            time.sleep(1.0); return e.code, url, None, None
        except Exception as e:
            time.sleep(0.5); return None, url, None, None


def score(href, text, base_host):
    s = 0
    blob = f'{href} {text}'
    if STRONG.search(blob): s += 5
    elif WORDS.search(blob): s += 2
    if urlparse(href).netloc and urlparse(href).netloc != base_host: s -= 1
    if re.search(r'\.(pdf|docx?)$', href, re.I): s -= 2
    return s


def work(row):
    bid, state, site = row
    out = {'id': bid, 'state': state, 'website': site, 'procurementUrl': None, 'kind': 'none', 'items': [], 'notes': '', 'requests': 0}
    if not site.startswith('http'): site = 'https://' + site
    code, final, text, links = get(site); out['requests'] += 1
    if code is None or code >= 400:
        out['notes'] = f'site not reachable ({code})'; return out
    host = urlparse(final).netloc
    cands = []
    for href, t in (links or []):
        if not href or href.startswith(('mailto:', 'tel:', 'javascript:', '#')): continue
        url = urljoin(final, href)
        sc = score(url, t, host)
        if sc > 0: cands.append((sc, url, t))
    cands.sort(key=lambda x: -x[0])
    seen, picks = set(), []
    for sc, url, t in cands:
        u = url.split('#')[0]
        if u in seen: continue
        seen.add(u); picks.append(u)
        if len(picks) >= 4: break
    base = f'{urlparse(final).scheme}://{host}'
    if not any(STRONG.search(u) for u in picks):
        for sm in ('/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml', '/page-sitemap.xml'):
            c2, f2, t2, lk2 = get(base + sm); out['requests'] += 1
            if c2 and c2 < 400 and t2:
                urls = re.findall(r'https?://[^\s<>"]+', t2)
                hits = [u for u in urls if STRONG.search(u) and not re.search(r'\.(pdf|docx?|xlsx?|jpg|png)$', u, re.I)]
                picks += hits[:3]
                if hits: break
        for pth in PATHS[:6]: picks.append(base + pth)
    best = None
    for u in picks[:9]:
        if out['requests'] >= 10: break
        c, f, t, lk = get(u); out['requests'] += 1
        if c is None or c >= 400 or t is None: continue
        strong_hits = len(STRONG.findall(t)); word_hits = len(WORDS.findall(t))
        items = []
        for m in ITEM.finditer(t):
            line = re.sub(r'\s+', ' ', m.group(1)).strip()
            d = DATE.search(t[m.start(): m.start() + 400])
            items.append({'title': line[:150], 'date': d.group(0) if d else None})
            if len(items) >= 6: break
        sc = strong_hits * 3 + word_hits + len(items) * 2 + (4 if STRONG.search(f) else 0)
        if best is None or sc > best[0]: best = (sc, f, strong_hits, items)
    if best and best[0] >= 6:
        out['procurementUrl'] = best[1]; out['items'] = best[3]
        out['kind'] = 'solicitations' if best[3] else 'procurement_page'
    else:
        out['notes'] = 'no procurement page found'
    return out


def main():
    rows = [l.rstrip('\n').split('\t') for l in open(f'{HERE}/boards_retry.tsv') if l.strip()]
    rows = [r[:3] for r in rows if len(r) >= 4 and r[3] == 'no procurement page found']
    done = {}
    try: done = {r['id']: r for r in json.load(open(f'{HERE}/procurement_results2.json'))}
    except Exception: pass
    todo = [r for r in rows if r[0] not in done]
    print(len(rows), 'boards;', len(todo), 'to do', flush=True)
    res = list(done.values())
    with ThreadPoolExecutor(14) as ex:
        for i, r in enumerate(ex.map(work, todo), 1):
            res.append(r)
            if i % 40 == 0:
                json.dump(res, open(f'{HERE}/procurement_results2.json', 'w')); print(i, 'done', flush=True)
    json.dump(res, open(f'{HERE}/procurement_results2.json', 'w'))
    with open(f'{HERE}/procurement_results2.csv', 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['id', 'state', 'website', 'kind', 'procurementUrl', 'open_items', 'notes'])
        for r in res: w.writerow([r['id'], r['state'], r['website'], r['kind'], r['procurementUrl'] or '', len(r['items']), r['notes']])
    from collections import Counter
    print(Counter(r['kind'] for r in res), flush=True)


main()
