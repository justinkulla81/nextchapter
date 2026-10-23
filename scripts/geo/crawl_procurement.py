#!/usr/bin/env python3
"""Polite crawl of workforce boards, EDA districts, local economic development groups and state workforce agencies,
looking for what each one BUYS and WHO to call: open or recent solicitations, procurement policy, the systems and
vendors they name, rapid response and AI/reskilling pages, and published staff contacts.

  python3 scripts/geo/crawl_procurement.py --kind BOARD            (BOARD | EDD | EDO | STATE | ALL)
  python3 scripts/geo/crawl_procurement.py --kind BOARD --limit 10 (try a few first)

Reads data/geo/crawl-targets.json (scripts/geo/export-crawl-targets.ts). Writes one JSON per site into
data/geo/crawl/ and skips sites already done, so it can be stopped and resumed.

Politeness, learned the hard way (a 24-thread probe got our home IP blocked once): at most 6 sites at a time, one
request at a time per host, 1.5 s between requests to a host, robots.txt honoured, at most 9 pages per site, no
retries beyond one, and a host that answers 403/429 twice is dropped.
"""
import argparse, json, os, re, subprocess, sys, threading, time, html as htmllib
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse, urldefrag
from urllib.robotparser import RobotFileParser
from bs4 import BeautifulSoup

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
OUT = 'data/geo/crawl'
HOST_LOCKS: dict = {}
HOST_LAST: dict = {}
HOST_BLOCKS: dict = {}
LOCK = threading.Lock()

PROC = re.compile(r'\b(rfp|rfq|rfi|ifb|rfa|nofa|nofo|procure|solicitation|bid|bids|bidding|vendor|contract opportunit|request for (proposal|qualification|quote|information|application)|funding opportunit|grant opportunit|work with us|doing business|partner with us|etpl|eligible training provider|service provider|provider)', re.I)
CONTACT = re.compile(r'\b(contact|staff|leadership|our team|team|directory|about|board of directors|who we are)\b', re.I)
MEET = re.compile(r'\b(meeting|agenda|minutes|board meeting)', re.I)
RR = re.compile(r'\b(rapid response|layoff|dislocated|business services|employer services|for employers|hire)', re.I)
SOLIC = re.compile(r'\b(rfp|rfq|rfi|ifb|rfa|nofa|nofo|solicitation|request for (proposal|qualification|quote|information|application)|invitation for bid|funding opportunit|notice of funding|bid|procurement)\b', re.I)
SKIP_EXT = re.compile(r'\.(jpg|jpeg|png|gif|svg|zip|mp4|mp3|css|js|ico|webp|docx?|xlsx?|pptx?)(\?|$)', re.I)
EMAIL = re.compile(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}')
PHONE = re.compile(r'(?<!\d)(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}(?!\d)')
DATE = re.compile(r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+20\d{2}\b|\b\d{1,2}/\d{1,2}/(?:20)?\d{2}\b|\b20\d{2}-\d{2}-\d{2}\b', re.I)
TITLE = re.compile(r'\b(executive director|chief executive officer|ceo|president|director|deputy director|manager|coordinator|chief|vice president|vp|administrator|specialist|officer|rapid response|business services|procurement|contracts?|finance|fiscal)\b', re.I)
TOPICS = {
    'ai': r'\b(artificial intelligence|\bAI\b|ai-?ready|generative)\b',
    'reskilling': r'\b(reskill|upskill|retrain)',
    'career_exploration': r'\b(career (exploration|pathway|navigation|coaching|assessment)|explore careers)',
    'rapid_response': r'\brapid response\b',
    'layoff': r'\b(layoff|lay-off|dislocated worker|plant closing|WARN)\b',
    'outplacement': r'\boutplacement\b',
    'ita_etpl': r'\b(individual training account|\bITA\b|eligible training provider|\bETPL\b)',
    'incumbent_worker': r'\b(incumbent worker|on-the-job training|\bOJT\b)',
    'wioa': r'\bWIOA\b',
    'rfp_policy': r'\b(procurement policy|sole source|small purchase|micro-?purchase|informal quote)',
}
SYSTEMS = ['Geographic Solutions', 'Virtual One-Stop', 'VOS', 'Salesforce', 'Lightcast', 'Emsi', 'Burning Glass', 'FutureFit', 'WIN Learning',
           'Eightfold', 'Coursera', 'Guild', 'Skillsoft', 'LinkedIn Learning', 'Career Builder', 'CareerBuilder', 'Monster', 'Indeed',
           'JobScout', 'Workday', 'Unqork', 'OSOS', 'EmployIndy', 'CareerOneStop', 'Metrix Learning', 'Alison', 'Udemy', 'Pluralsight', 'Google Career Certificates']


# Where a vendor shows up even when its name is not printed: outbound links, embedded frames and scripts.
VENDOR_DOMAINS = {
    'Geographic Solutions': r'geographicsolutions\.com|/vosnet|virtualonestop|vos\.[a-z0-9.-]+\.(gov|org|us)',
    'FutureFit': r'futurefit\.(ai|co)',
    'Lightcast': r'lightcast\.(io|com)|economicmodeling\.com|emsicc|emsiengage',
    'WIN Learning': r'winlearning\.com|wincareerready|winlearning',
    'Eightfold': r'eightfold\.ai',
    'Coursera': r'coursera\.org',
    'Skillsoft': r'skillsoft\.com|percipio',
    'Metrix Learning': r'metrixlearning\.com',
    'Salesforce': r'salesforce\.com|force\.com|my\.site\.com|salesforce-sites',
    'Social Solutions (ETO)': r'socialsolutions\.com|etosoftware',
    'CaseWorthy': r'caseworthy\.com',
    'Unqork': r'unqork\.',
    'Burning Glass Institute': r'burningglassinstitute\.org',
    'Jobs for the Future': r'jff\.org',
    'JobScout': r'jobscout',
    'Monster Government': r'monstergovernmentsolutions',
    'CareerBuilder': r'careerbuilder\.com',
    'Indeed': r'indeed\.com/(hire|employers)',
    'Google Career Certificates': r'grow\.google|careercertificates',
    'LinkedIn Learning': r'linkedin\.com/learning',
}
MEETING_LINK = re.compile(r'(agenda|minutes|board packet|meeting packet|board meeting)', re.I)


def host_lock(host):
    with LOCK:
        return HOST_LOCKS.setdefault(host, threading.Lock())


def fetch(url, timeout=20):
    """One request at a time per host with a pause between requests. Returns (status, body, final_url)."""
    host = urlparse(url).netloc.lower()
    if HOST_BLOCKS.get(host, 0) >= 2:
        return 0, '', url
    with host_lock(host):
        wait = 1.5 - (time.time() - HOST_LAST.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        try:
            r = subprocess.run(['curl', '-sL', '-m', str(timeout), '--max-filesize', '3000000', '-A', UA, '-H', 'Accept: text/html,application/xhtml+xml',
                                '-w', '\n%{http_code} %{url_effective} %{content_type}', url], capture_output=True)
        except Exception:
            return 0, '', url
        HOST_LAST[host] = time.time()
    raw = r.stdout.decode('utf8', 'replace')
    body, _, tail = raw.rpartition('\n')
    parts = tail.split(' ', 2)
    code = int(parts[0]) if parts and parts[0].isdigit() else 0
    final = parts[1] if len(parts) > 1 else url
    ctype = parts[2] if len(parts) > 2 else ''
    if code in (403, 429):
        HOST_BLOCKS[host] = HOST_BLOCKS.get(host, 0) + 1
    if 'html' not in ctype.lower() and 'text' not in ctype.lower():
        return code, '', final
    return code, body, final


def robots_ok(base, cache={}):
    host = urlparse(base).netloc.lower()
    if host not in cache:
        rp = RobotFileParser()
        code, body, _ = fetch(f'{urlparse(base).scheme}://{host}/robots.txt', timeout=10)
        try:
            rp.parse(body.splitlines() if code == 200 else [])
        except Exception:
            rp.parse([])
        cache[host] = rp
    return lambda u: cache[host].can_fetch('*', u)


def same_site(a, b):
    ha, hb = urlparse(a).netloc.lower().split(':')[0], urlparse(b).netloc.lower().split(':')[0]
    strip = lambda h: h[4:] if h.startswith('www.') else h
    ha, hb = strip(ha), strip(hb)
    return ha == hb or ha.endswith('.' + hb) or hb.endswith('.' + ha)


def text_of(soup):
    for t in soup(['script', 'style', 'noscript', 'svg']):
        t.decompose()
    return re.sub(r'[ \t\r\f\v]+', ' ', soup.get_text('\n')).strip()


def links_of(soup, base):
    out = []
    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        if href.startswith(('mailto:', 'tel:', 'javascript:', '#')):
            continue
        u = urldefrag(urljoin(base, href))[0]
        if not u.startswith('http'):
            continue
        label = re.sub(r'\s+', ' ', a.get_text(' ')).strip()[:140]
        out.append((u, label))
    return out


def rank(links, base, pattern, limit):
    seen, scored = set(), []
    for u, label in links:
        if u in seen or SKIP_EXT.search(u) or not same_site(u, base):
            continue
        seen.add(u)
        hit = pattern.search(label) or pattern.search(urlparse(u).path)
        if hit:
            s = (3 if pattern.search(label) else 1) + (2 if re.search(r'rfp|procure|solicit|bid', u, re.I) else 0) - min(len(u), 200) / 400
            scored.append((s, u))
    scored.sort(reverse=True)
    return [u for _, u in scored[:limit]]


def around(text, pos, w=160):
    return re.sub(r'\s+', ' ', text[max(0, pos - w):pos + w])


def analyse_page(url, kind, body):
    soup = BeautifulSoup(body, 'lxml')
    emails = {e.lower() for e in EMAIL.findall(htmllib.unescape(body)) if not re.search(r'\.(png|jpg|gif|svg)$', e, re.I)}
    emails |= {a['href'][7:].split('?')[0].lower() for a in soup.find_all('a', href=True) if a['href'].lower().startswith('mailto:')}
    links = links_of(soup, url)
    title = (soup.title.string or '').strip()[:140] if soup.title and soup.title.string else ''
    txt = text_of(soup)
    solicits = []
    for u, label in links:
        if SOLIC.search(label) or re.search(r'rfp|rfq|solicit|nofo|nofa|bid', urlparse(u).path, re.I):
            if len(label) < 4:
                label = urlparse(u).path.rsplit('/', 1)[-1][:100]
            pos = txt.find(label[:40]) if label else -1
            ctx = around(txt, pos) if pos >= 0 else ''
            dates = DATE.findall(ctx)
            solicits.append({'label': label, 'url': u, 'dates': dates[:3], 'context': ctx[:240], 'pdf': u.lower().split('?')[0].endswith('.pdf')})
    people = []
    lines = [l.strip() for l in txt.split('\n') if l.strip()]
    for i, l in enumerate(lines):
        if TITLE.search(l) and len(l) < 90 and i > 0 and 3 < len(lines[i - 1]) < 50 and re.match(r"^[A-Z][A-Za-z.'\- ]+( [A-Z][A-Za-z.'\-]+){1,3}(,? [A-Z.]{2,6})?$", lines[i - 1]):
            window = ' '.join(lines[i - 1:i + 4])
            people.append({'name': lines[i - 1], 'title': l, 'email': (EMAIL.findall(window) or [None])[0], 'phone': (PHONE.findall(window) or [None])[0]})
    policy = []
    for m in re.finditer(r'[^.\n]{0,160}(sole source|small purchase|micro-?purchase|informal quote|competitive (bid|proposal|procurement))[^.\n]{0,200}', txt, re.I):
        policy.append(re.sub(r'\s+', ' ', m.group(0))[:300])
        if len(policy) >= 3:
            break
    return {
        'url': url, 'title': title, 'emails': sorted(emails)[:12], 'phones': sorted(set(PHONE.findall(txt)))[:8], 'solicitations': solicits[:25],
        'people': people[:12], 'policy': policy, 'topics': {k: bool(re.search(v, txt, re.I)) for k, v in TOPICS.items()},
        'systems': sorted({s for s in SYSTEMS if re.search(r'\b' + re.escape(s) + r'\b', txt)}), 'chars': len(txt),
        'vendor_hits': sorted({v for v, pat in VENDOR_DOMAINS.items() if re.search(pat, body, re.I)}),
        'meeting_links': [{'label': l, 'url': u} for u, l in links if (MEETING_LINK.search(l) or MEETING_LINK.search(urlparse(u).path)) and u.lower().split('?')[0].endswith(('.pdf', '.htm', '.html', '/'))][:12],
        'rr_snippet': next((around(txt, m.start(), 200) for m in re.finditer(r'rapid response', txt, re.I)), ''),
    }, links


def crawl(target):
    base = target['website'].strip()
    if not base.startswith('http'):
        base = 'https://' + base
    res = {'target': target, 'crawledAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'status': None, 'pages': [], 'rapid_response': [], 'error': None}
    allowed = robots_ok(base)
    code, body, final = fetch(base)
    res['status'] = code
    if not body:
        res['error'] = f'home {code}'
        return res
    home, links = analyse_page(final, target['kind'], body)
    res['pages'].append(home)
    queue = []
    queue += [('procurement', u) for u in rank(links, final, PROC, 4)]
    queue += [('contact', u) for u in rank(links, final, CONTACT, 2)]
    queue += [('meetings', u) for u in rank(links, final, MEET, 1)]
    queue += [('business', u) for u in rank(links, final, RR, 2)]
    seen = {final}
    fetched = 0
    for role, u in queue:
        if u in seen or fetched >= 8 or not allowed(u):
            continue
        seen.add(u)
        c, b, f = fetch(u)
        fetched += 1
        if not b:
            continue
        page, plinks = analyse_page(f, target['kind'], b)
        page['role'] = role
        res['pages'].append(page)
        if role == 'procurement' and fetched <= 6:
            for u2 in rank(plinks, f, PROC, 2):  # one level into a procurement landing page
                if u2 not in seen and fetched < 8 and allowed(u2) and not u2.lower().endswith('.pdf'):
                    seen.add(u2)
                    c2, b2, f2 = fetch(u2)
                    fetched += 1
                    if b2:
                        p2, _ = analyse_page(f2, target['kind'], b2)
                        p2['role'] = 'procurement'
                        res['pages'].append(p2)
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--kind', default='BOARD')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--workers', type=int, default=6)
    ap.add_argument('--refresh', action='store_true', help='also redo sites crawled before vendor fingerprints existed')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    targets = json.load(open('data/geo/crawl-targets.json'))
    if a.kind != 'ALL':
        targets = [t for t in targets if t['kind'] == a.kind]
    def stale(t):
        fp = f"{OUT}/{t['kind']}-{t['id']}.json"
        if not os.path.exists(fp):
            return True
        if not a.refresh:
            return False
        try:
            r = json.load(open(fp))
        except Exception:
            return True
        return bool(r.get('pages')) and 'vendor_hits' not in r['pages'][0]
    todo = [t for t in targets if stale(t)]
    if a.limit:
        todo = todo[:a.limit]
    print(f'{len(todo)} to crawl ({len(targets) - len(todo)} already done)', flush=True)
    done = 0
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(crawl, t): t for t in todo}
        for f in as_completed(futs):
            t = futs[f]
            try:
                r = f.result()
            except Exception as e:
                r = {'target': t, 'error': f'exception {e}', 'pages': []}
            json.dump(r, open(f"{OUT}/{t['kind']}-{t['id']}.json", 'w'))
            done += 1
            if done % 25 == 0 or done == len(todo):
                print(f'{done}/{len(todo)}', flush=True)


if __name__ == '__main__':
    main()
