#!/usr/bin/env python3
"""Build a standalone, September-styled HTML edition from a markdown draft (pandoc + the report CSS), for
nc_build_pdf.js to print. Chapter labels, exhibit titles and the cover are edition config below.

usage: build-report-html.py draft.md chart.png out.html [--release] [--fonts-dir DIR] [--ts-out FILE --chart-url URL]
  --release     strip draft markings (cover eyebrow, "not published" line, <title> suffix)
  --fonts-dir   folder with source-serif-4-latin-400-normal.woff2 and ...-600-normal.woff2 (npm i @fontsource/source-serif-4)
  --ts-out      also write a TypeScript module exporting the body HTML (chart by URL, no embedded fonts) for a dev-preview page
Requires: pandoc, python3 with beautifulsoup4."""
import sys, re, base64, subprocess, html, os, argparse
from bs4 import BeautifulSoup
ap = argparse.ArgumentParser()
ap.add_argument('md'); ap.add_argument('chart'); ap.add_argument('out')
ap.add_argument('--release', action='store_true'); ap.add_argument('--fonts-dir'); ap.add_argument('--ts-out'); ap.add_argument('--chart-url')
args = ap.parse_args()
md, chart, out = args.md, args.chart, args.out
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
css_ts = open(f'{REPO}/src/app/reports/white-collar-employment-report-september-2026/report-styles.ts').read()
REPORT_CSS = css_ts[css_ts.index('`')+1: css_ts.rindex('`')]
PRINT_CSS = open(f'{REPO}/scripts/employment-report/print-compact.css').read()
text = open(md).read()
text = re.sub(r'^# .*\n+\*Draft.*\n+', '', text, count=1)          # title + draft line go on the cover
text = text.replace('![Share of the unemployed out of work 27 or more weeks, January to September 2025 and 2026, by group](chart-long-search-shares.png)', '\n\n@@CHART@@\n\n')
frag = subprocess.run(['pandoc','-f','markdown','-t','html5','--section-divs','--wrap=none'], input=text, capture_output=True, text=True, check=True).stdout
soup = BeautifulSoup(frag, 'html.parser')
labels = ['Executive summary','Chapter 01 · Who we mean','Chapter 02 · The middle class','Chapter 03 · What changed','Chapter 04 · Bright spots','Chapter 05 · Clouds','Chapter 06 · Layoffs and voluntary exits','Chapter 07 · Employers','Chapter 08 · AI exposure and open jobs','Chapter 09 · The new Congress','Appendix']
secs = soup.find_all('section', recursive=False)
assert len(secs)==len(labels), len(secs)
toc=[]
for i,(sec,lab) in enumerate(zip(secs,labels)):
    h2 = sec.find('h2'); title = h2.get_text()
    sid = f'c{i}'; sec['id']=sid; sec['class']=[]
    head = soup.new_tag('div', **{'class':'chapter-head'})
    eb = soup.new_tag('div', **{'class':'eyebrow'}); eb.string = lab
    h2.extract(); h2['id']='h-'+sid
    head.append(eb); head.append(h2); sec.insert(0, head)
    toc.append((sid, lab.split(' · ')[-1] if i else 'Executive summary', title))
    if i==0:
        nxt = head.find_next_sibling('p'); nxt['class']=['lead']
# tables -> exhibits
titles = ['Employed people by group, January–September 2026 monthly average','Unemployment and long spells by group, January–September 2026 vs 2025','Bright spots: October jobs data and related measures','Clouds: pay, sectors, hiring and costs','Employers with the most entry-level jobs, October 26, 2026','Employers asking for AI skills, October 26, 2026','Top employers by function, October 26, 2026','AI exposure of matched open postings, November 6, 2026']
tables = soup.find_all('table'); assert len(tables)==len(titles), len(tables)
n=2
for idx,(t,ti) in enumerate(zip(tables,titles)):
    if idx in (2,3,6): t['class']=['txt']
    if idx==4: t['class']=['emp2']
    if idx==5: t['class']=['emp1']
    ex = soup.new_tag('div', **{'class':'exhibit'})
    lab = soup.new_tag('span', **{'class':'ex-label'}); lab.string=f'Exhibit {n}'; n+=1
    tt = soup.new_tag('span', **{'class':'ex-title'}); tt.string=ti
    wrap = soup.new_tag('div', **{'class':'tbl'})
    t.wrap(wrap); wrap.wrap(ex); ex.insert(0,tt); ex.insert(0,lab)
# chart
RELEASE = args.release
img = base64.b64encode(open(chart,'rb').read()).decode()
img_src = f'data:image/png;base64,{img}'
fig = BeautifulSoup(f'<figure class="exhibit chart" style="margin:0"><span class="ex-label">Exhibit 1</span><span class="ex-title">Among the unemployed, long spells are more common than a year ago, most for white-collar workers</span><img alt="Share of the unemployed out of work 27+ weeks, Jan–Sep 2025 and 2026, by group" style="width:100%;height:auto;max-width:100%" src="{img_src}"><span class="ex-note">Share of unemployed people out of work 27 or more weeks. Change shown with its 90% margin of error (BLS generalized-variance method, as in the September edition). All six changes clear that margin; all but blue-collar also clear a more conservative approximation (design effect 2.0, pooled months counted as 40% independent). Not seasonally adjusted; spells in progress. Source: NextChapter calculation from Census CPS basic monthly microdata.</span></figure>','html.parser')
for p in soup.find_all('p'):
    if p.get_text().strip()=='@@CHART@@': p.replace_with(fig)
# takeaways and notes
for p in soup.find_all('p'):
    if p.get_text().startswith('Note:'): p['class']=['note']
for p in soup.find_all('p'):
    em = p.find('em')
    if em and p.contents and p.contents[0]==em:
        if em.get_text().startswith('What it means for a job seeker'):
            em.extract(); box = soup.new_tag('div', **{'class':'box'})
            eb = soup.new_tag('div', **{'class':'eyebrow'}); eb.string='What this may mean for a job seeker'
            body = soup.new_tag('p'); body.extend(list(p.contents))
            from bs4 import NavigableString
            for node in body.descendants:
                if isinstance(node, NavigableString) and node.strip():
                    t = str(node); i0 = len(t) - len(t.lstrip())
                    node.replace_with(t[:i0] + t[i0:i0+1].upper() + t[i0+1:]); break
            box.append(eb); box.append(body); p.replace_with(box)
        elif em.get_text().startswith('Method note'):
            p['class']=['note']
cover = f'''<header class="cover"><div class="cover-in">
<div class="cover-top"><div class="brand-wrap"><span class="wordmark">NextChapter</span><span class="brand-sub">Research</span></div><div class="eyebrow">Monthly labor market report{"" if RELEASE else " · DRAFT"}</div></div>
<div class="eyebrow">The NextChapter White Collar Employment Report · October 2026</div>
<h1>Hiring improved in October, but more unemployed white-collar workers are in long spells than a year ago</h1>
<p class="dek">Unemployment among white-collar workers is low, but 28.5% of the unemployed had been out of work 27 weeks or more in January to September 2026, up from 23.2%. For knowledge workers it is 29.6%; for white-collar workers aged 55 to 64, 39.1%.</p>
<div class="cover-stats">
<div><span class="v">+165K</span><span class="l">Jobs added in October 2026 (BLS, seasonally adjusted); unemployment 4.1%</span></div>
<div><span class="v">28.5%</span><span class="l">Of unemployed white-collar workers out 27+ weeks, Jan–Sep 2026 (23.2% in 2025)</span></div>
<div><span class="v">39.1%</span><span class="l">Same measure, white-collar workers aged 55–64 (27.0% in 2025)</span></div>
<div><span class="v">153</span><span class="l">White-Collar Long-Search Index, Sep 2026 (2019 = 100, seasonally adjusted; 135 a year earlier)</span></div>
</div>
<div class="cover-meta"><span>Covers October 2026 data; to be published November 2026</span><span>Census CPS microdata through September 2026</span>{'' if RELEASE else '<span>Draft 8: not published</span>'}<span>Justin Kulla, Founder and CEO · jkulla@launchyournextchapter.com</span></div>
</div></header>'''
FONTS = ''
if args.fonts_dir:
    FONTS = ''.join('@font-face{font-family:"Source Serif 4";font-weight:%s;font-style:normal;font-display:swap;src:url(data:font/woff2;base64,%s) format("woff2")}' % (w, base64.b64encode(open(os.path.join(args.fonts_dir, 'source-serif-4-latin-%s-normal.woff2' % w),'rb').read()).decode()) for w in ('400','600'))
tocol = '<nav class="toc" aria-label="Contents"><div class="eyebrow">Contents</div><ol>'+''.join(f'<li><a href="#{a}"><span class="n">—</span>{html.escape(b)}</a></li>' for a,b,c in toc)+'</ol></nav>'
doc = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>October 2026 White Collar Employment Report{'' if RELEASE else ' (draft)'}</title><style>{FONTS}{REPORT_CSS}.ncr table.emp1 th:first-child,.ncr table.emp1 td:first-child,.ncr table.emp2 th:nth-child(2),.ncr table.emp2 td:nth-child(2){{text-align:left!important}}.ncr{{--font-inter:"Inter";--font-source-serif:"Source Serif 4"}}</style></head><body style="margin:0"><div class="ncr">{cover}<div class="wrap"><div class="grid">{tocol}<main>{soup.decode()}</main></div></div></div></body></html>'''
open(out,'w').write(doc)
print('wrote',out,len(doc))

if args.ts_out:
    body = cover + '<div class="wrap"><div class="grid">' + tocol + '<main>' + soup.decode() + '</main></div></div>'
    if args.chart_url: body = body.replace(img_src, args.chart_url)
    body = body.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')
    open(args.ts_out, 'w').write('// GENERATED by scripts/employment-report/build-report-html.py. Do not edit by hand.\nexport const REPORT_BODY_HTML = `' + body + '`\n')
    print('wrote', args.ts_out)
