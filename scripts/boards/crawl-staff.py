#!/usr/bin/env python3
"""Find the named staff on each workforce board's and job center's own website.

Input : sites.tsv  (kind \t id \t state \t name \t website)   kind = board | center
Output: staff_results.json  [{host, orgKind, orgId, orgName, state, sourceUrl, people:[{name,title,email,phone}]}]

Per host (not per org: many centers share their board's site): read the home page, score its links for staff / team /
leadership / contact words, try a few common paths, fetch the best pages and read people off them. A person is a name next to a
job title, or a mailto link with a name beside it. Generic inboxes (info@, jobs@) are not people and are dropped.
Polite: robots.txt honoured, one request at a time per host, 1 second apart, honest user agent, 12 second timeout, at most 8 pages per host.
"""
import json, re, ssl, sys, threading, time, urllib.request, urllib.robotparser
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

SITES = sys.argv[1]; OUT = sys.argv[2]
UA = 'Mozilla/5.0 (compatible; NextChapterStaffDirectory/1.0; +https://launchyournextchapter.com)'
LINK = re.compile(r'\b(staff|our team|meet|team|leadership|directory|contact|about us|who we are|people|personnel|administration|management|executive)\b', re.I)
STRONG = re.compile(r'\b(staff|our team|meet (the|our)|leadership|directory|team members|staff directory)\b', re.I)
PATHS = ['/staff', '/our-staff', '/staff-directory', '/about/staff', '/about-us/staff', '/about/our-team', '/about-us/our-team', '/our-team', '/team',
         '/meet-the-team', '/about/leadership', '/leadership', '/contact', '/contact-us', '/about-us', '/about']
TITLE = re.compile(r'\b(director|manager|coordinator|specialist|officer|administrator|supervisor|analyst|advisor|counselor|navigator|liaison|representative|'
                   r'chief|president|ceo|deputy|lead|planner|strategist|consultant|associate|assistant|executive|head of|vice president)\b', re.I)
SKIPTITLE = re.compile(r'\b(board (chair|member)|chairman|vice[- ]chair|treasurer|trustee|commissioner|council ?(man|woman|member)|mayor|senator|governor)\b', re.I)
NAME = re.compile(r"^(?:Dr\.? |Mr\.? |Ms\.? |Mrs\.? )?[A-Z][a-zA-Z'’\-]+(?: [A-Z]\.?)?(?: [A-Z][a-zA-Z'’\-]+){1,2}(?:,? (?:Jr|Sr|II|III|MBA|PhD|CPA|MPA|MSW)\.?)*$")
NOTNAME = re.compile(r'\b(workforce|board|center|centre|department|services|office|program|career|county|city|state|contact|about|team|staff|employment|training|development|business|human|resources|director|manager|coordinator|specialist|learn|more|read|view|click|apply|home|news|events|jobs|job|search|email|phone|fax|call|us|the|and|of|for|translate|report|login|log|opportunities|opportunity|engagement|resources|partners|partner|community|programs|regional|commission|annual|employer|employers|job seekers|seekers|youth|adult|support|solutions|initiative|council|committee)\b', re.I)
EMAIL = re.compile(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}')
PHONE = re.compile(r'\(?\b\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b')
GENERIC = re.compile(r'^(info|jobs|contact|admin|office|hr|support|help|careers|employer|business|rapidresponse|webmaster|general|inquiries|infor|reception|service|services|team|staff|communications|media|press|events|training|youth|veterans?|ajc|workforce)@', re.I)
ctx = ssl.create_default_context()
host_locks, glock, robots = {}, threading.Lock(), {}


class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.links = []; s.lines = ['']; s.skip = 0; s._href = None; s._t = []; s.mails = []
    def handle_starttag(s, t, a):
        a = dict(a)
        if t in ('script', 'style', 'noscript', 'svg'): s.skip += 1
        if t == 'a':
            s._href = a.get('href'); s._t = []
            if s._href and s._href.lower().startswith('mailto:'):
                s.mails.append((len(s.lines), s._href[7:].split('?')[0].strip()))
        if t in ('br', 'p', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'td', 'section', 'article'): s.lines.append('')
    def handle_endtag(s, t):
        if t in ('script', 'style', 'noscript', 'svg') and s.skip: s.skip -= 1
        if t == 'a' and s._href is not None: s.links.append((s._href, ' '.join(s._t).strip())); s._href = None
        if t in ('p', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'td', 'section', 'article'): s.lines.append('')
    def handle_data(s, d):
        if s.skip: return
        d = d.strip()
        if d:
            s.lines[-1] = (s.lines[-1] + ' ' + d).strip()
            if s._href is not None: s._t.append(d)


def allowed(url):
    u = urlparse(url); base = f'{u.scheme}://{u.netloc}'
    with glock: rp = robots.get(base)
    if rp is None:
        rp = urllib.robotparser.RobotFileParser()
        try:
            req = urllib.request.Request(base + '/robots.txt', headers={'User-Agent': UA})
            rp.parse(urllib.request.urlopen(req, timeout=8, context=ctx).read().decode('utf-8', 'ignore').splitlines())
        except Exception:
            rp.parse([])
        with glock: robots[base] = rp
    return rp.can_fetch(UA, url)


def get(url):
    host = urlparse(url).netloc
    with glock: lk = host_locks.setdefault(host, threading.Lock())
    with lk:
        try:
            if not allowed(url): return None
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,*/*'})
            r = urllib.request.urlopen(req, timeout=12, context=ctx)
            if 'html' not in (r.headers.get('Content-Type') or ''): return None
            body = r.read(1_500_000).decode(r.headers.get_content_charset() or 'utf-8', 'ignore'); final = r.geturl()
        except Exception:
            return None
        finally:
            time.sleep(1)
    p = P()
    try: p.feed(body)
    except Exception: pass
    return final, p


def people_from(p):
    out = {}
    lines = [re.sub(r'\s+', ' ', l).strip() for l in p.lines]
    idx = [i for i, l in enumerate(lines) if l]
    mails = [(i, m) for i, m in p.mails if EMAIL.fullmatch(m or '')]
    def nearby_email(i):
        best = None
        for j, m in mails:
            if abs(j - i) <= 6 and not GENERIC.match(m) and (best is None or abs(j - i) < best[0]): best = (abs(j - i), m)
        return best[1].lower() if best else None
    def nearby_phone(i):
        for k in range(max(0, i - 2), min(len(lines), i + 6)):
            m = PHONE.search(lines[k])
            if m: return m.group(0)
    for pos, i in enumerate(idx):
        l = lines[i]
        if len(l) > 110 or not TITLE.search(l) or SKIPTITLE.search(l) or re.search(r'\b(login|log in|sign in|apply now|click|read more)\b', l, re.I): continue
        # name on the same line ("Jane Doe, Director") or the nearest line above or below
        cand = []
        m = re.match(r'^(.{4,40}?)\s*[,\-–—|:]\s*(.+)$', l)
        if m and NAME.match(m.group(1)) and not NOTNAME.search(m.group(1)): cand.append((m.group(1), m.group(2)))
        m = re.match(r'^(.+?)\s*[,\-–—|:]\s*(.{4,40})$', l)
        if m and NAME.match(m.group(2)) and not NOTNAME.search(m.group(2)) and TITLE.search(m.group(1)): cand.append((m.group(2), m.group(1)))
        if not cand:
            for d in (-1, 1, -2):
                q = pos + d
                if 0 <= q < len(idx):
                    nm = lines[idx[q]]
                    if len(nm) <= 40 and NAME.match(nm) and not NOTNAME.search(nm): cand.append((nm, l)); break
        for name, title in cand[:1]:
            key = name.lower()
            if key in out: continue
            email = nearby_email(i)
            if EMAIL.search(l) and not email:
                e = EMAIL.search(l).group(0).lower(); email = e if not GENERIC.match(e) else None
            out[key] = {'name': name.strip(), 'title': title.strip()[:120], 'email': email, 'phone': nearby_phone(i)}
    return list(out.values())


def crawl(host, orgs):
    start = orgs[0]['website']
    first = get(start)
    if not first: first = get(f'https://{host}/')
    if not first: return {'host': host, 'orgs': orgs, 'error': 'unreachable', 'people': [], 'pages': []}
    final, home = first
    cands = {}
    for href, text in home.links:
        if not href or href.startswith(('mailto:', 'tel:', '#', 'javascript:')): continue
        u = urljoin(final, href).split('#')[0]
        if urlparse(u).netloc.replace('www.', '') != urlparse(final).netloc.replace('www.', ''): continue
        score = (3 if STRONG.search(text) else 1 if LINK.search(text) else 0) + (2 if STRONG.search(u) else 0)
        if score: cands[u] = max(score, cands.get(u, 0))
    base = f'{urlparse(final).scheme}://{urlparse(final).netloc}'
    for pth in PATHS: cands.setdefault(base + pth, 0.5)
    ordered = sorted(cands, key=lambda u: -cands[u])[:8]
    people, pages, seen = {}, [], {final}
    for pp in people_from(home): people[pp['name'].lower()] = {**pp, 'sourceUrl': final}
    for u in ordered:
        if u in seen: continue
        seen.add(u)
        r = get(u)
        if not r: continue
        fu, pg = r
        found = people_from(pg)
        if found: pages.append(fu)
        for pp in found:
            k = pp['name'].lower()
            if k not in people or (pp['email'] and not people[k]['email']): people[k] = {**pp, 'sourceUrl': fu}
    return {'host': host, 'orgs': orgs, 'people': list(people.values()), 'pages': pages}


def main():
    by_host = {}
    for line in open(SITES, encoding='utf-8').read().splitlines():
        k, i, st, nm, w = line.split('\t')
        by_host.setdefault(urlparse(w).netloc.lower(), []).append({'kind': k, 'id': i, 'state': st, 'name': nm, 'website': w})
    hosts = sorted(by_host, key=lambda h: (by_host[h][0]['kind'] != 'board', h))
    if len(sys.argv) > 3: hosts = hosts[:int(sys.argv[3])]
    done = 0
    results = []
    def work(h):
        nonlocal done
        try: r = crawl(h, by_host[h])
        except Exception as e: r = {'host': h, 'orgs': by_host[h], 'error': str(e)[:100], 'people': [], 'pages': []}
        done += 1
        if done % 25 == 0: print(done, '/', len(hosts), flush=True)
        return r
    with ThreadPoolExecutor(16) as ex: results = list(ex.map(work, hosts))
    json.dump(results, open(OUT, 'w'))
    n = sum(len(r['people']) for r in results)
    print(len(results), 'hosts', sum(1 for r in results if r['people']), 'with people', n, 'people', sum(1 for r in results for p in r['people'] if p['email']), 'with email')

main()
