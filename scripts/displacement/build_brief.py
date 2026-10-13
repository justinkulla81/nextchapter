import re, sys
from bs4 import BeautifulSoup
# Usage: python3 build_brief.py <report.html> <brief.html>
FULL='https://launchyournextchapter.com/reports/displacement-report-september-2026'
s=open(sys.argv[1]).read()
b=BeautifulSoup(s,'html.parser')
main=b.find('main')
keep={'reframe','disclosure','limits','summary','index','layoffs','concentrated','longterm','older','context','q3','outlook','about'}
for sec in main.find_all('section',recursive=False):
    if sec.get('id') not in keep: sec.decompose()
def kids(sid): return b.find('section',id=sid).find_all(recursive=False)
def drop_after(sid, keep_n):  # keep first n direct children
    for c in kids(sid)[keep_n:]: c.decompose()
def ex_label(c):
    e=c.select_one('.ex-label'); return e.text.strip() if e else ''
# index: drop robustness exhibit (Exhibit 3) but keep h3+p sentence
for c in kids('index'):
    if ex_label(c)=='Exhibit 3': c.decompose()
# jobs dropped. layoffs: keep head, lead, then from AI h3 onward; drop two-charts and tech paragraph
L=kids('layoffs')
for c in L[2:4]: c.decompose()
# concentrated: keep head, lead, Exhibit 11
drop_after('concentrated',3)
# longterm: keep head, lead, then Age h3, p, Exhibit 14 ; drop Exhibit 13 and items
L=kids('longterm')
L[2].decompose()
for c in L[6:]: c.decompose()
# older: head, lead, exhibit, h3, p (what happens after layoff)
drop_after('older',5)
# context: head, lead, Exhibit 23, h3 grads, p
drop_after('context',5)
# q3: keep head, lead(shortened), Exhibit 25 scorecard? keep: RPE first table + its paragraph
q=b.find('section',id='q3')
ch=q.find_all(recursive=False)
keepq=[]
for c in ch:
    t=c.get_text(' ',strip=True)
    if 'chapter-head' in (c.get('class') or []): keepq.append(c); continue
    if c.name=='h3' and 'Revenue per employee' in t: keepq.append(c); continue
    if c.name=='p' and t.startswith('Can large companies grow'): keepq.append(c); continue
    if ex_label(c).startswith('Exhibit') and 'Revenue grew 40%' in t: keepq.append(c); continue
for c in ch:
    if c not in keepq: c.decompose()
# trim RPE exhibit: remove the long company table (second .tbl)
rpe=[c for c in q.find_all('div',class_='exhibit')][0]
tbls=rpe.find_all('div',class_='tbl')
if len(tbls)>1: tbls[1].decompose()
q.find('h3').string='Q3 addendum: revenue per employee at large white-collar employers'
p=BeautifulSoup('<p>The full report\'s Q3 addendum also covers what firms expected versus what they did, how AI appears in restructuring filings, the labor-market services economy, AI services firms remaking organizations, and reemployment after layoffs.</p>','html.parser')
q.append(p)
# outlook: keep head, intro p, first watch list only + frontier watch list
o=kids('outlook')
for c in o:
    if c.name in ('h3','ul') or 'lbl-row' in (c.get('class') or []): c.decompose()
# exhibit notes in RPE: keep
# chapter renumber
n=0
for sec in main.find_all('section',recursive=False):
    eb=sec.select_one('.chapter-head .eyebrow')
    if eb and eb.text.startswith('Chapter'):
        n+=1; eb.string=f'{n:02d}'
    if sec.get('id')=='q3': sec.select_one('.chapter-head .eyebrow').string='Q3 2026'
    if sec.get('id')=='q3': sec.select_one('.chapter-head h2').string='Growth without hiring at large employers'
# full-report pointer box before about
ptr=BeautifulSoup(f'''<section id="full" aria-label="Full report and methods"><div class="box"><div class="eyebrow">This is the monthly brief</div>
<p>The <a href="{FULL}">full report</a> (about 50 pages) adds jobs and hiring, what leading researchers are finding, applying in 2026, skills and retraining, how jobs are changing, new businesses, Chapter 13A on what public programs, funding and technology are adding, states, benefits and retraining, blue-collar work, the complete Q3 addendum, two features (the history of automation; remote work), the future research agenda, the FAQ, full methodology with margins of error and seasonal-adjustment checks, sources and the revision audit. Replication code and data: <a href="https://launchyournextchapter.com/reports/replication">launchyournextchapter.com/reports/replication</a>.</p></div></section>''','html.parser')
b.find('section',id='about').insert_before(ptr)
html=str(b)
# exhibits renumber
labs=list(re.finditer(r'<span class="ex-label">Exhibit (\d+)</span>',html))
emap={m.group(1):str(i+1) for i,m in enumerate(labs)}
html=re.sub(r'(?<!ex-label">)Exhibit (\d+)\b',lambda m:('Exhibit '+emap[m.group(1)]) if m.group(1) in emap else ('Exhibit '+m.group(1)+' of the full report'),html)
c=[0]
def fe(m): c[0]+=1; return f'<span class="ex-label">Exhibit {c[0]}</span>'
html=re.sub(r'<span class="ex-label">Exhibit \d+</span>',fe,html)
# chapter refs in summary links e.g. Ch. 06 -> anchors still valid for kept ones; point missing anchors to full report
for anc in ['#jobs','#research','#applying','#skills','#jobsfuture','#newbiz','#geography','#safetynet','#feature-history','#feature-remote','#agenda','#faq','#pilot','#method','#sources','#audit','#evidence','#subscribe']:
    html=html.replace(f'href="{anc}"',f'href="{FULL}{anc}"')
html=html.replace('Chapter 0','Section 0').replace('Ch. 01','Index').replace('Ch. 06','Age').replace('Ch. 14','Grads')
# cover
html=html.replace('<div class="eyebrow">The NextChapter Employment Report · September 2026</div>','<div class="eyebrow">The NextChapter Employment Report · September 2026 · Monthly brief</div>')
html=html.replace('download="NextChapter-Displacement-Report-September-2026.pdf"','download="NextChapter-Displacement-Report-September-2026-Brief.pdf"')
html=html.replace('href="displacement-report-2026-09.pdf"','href="displacement-report-2026-09-brief.pdf"',1)
html=html.replace('Download PDF</a>','Download brief (PDF)</a>\n      <a class="btn ghost" href="'+FULL+'">Full report (50 pages)</a>',1)
# hidden chart stubs so the chart script runs
stubs=''.join(f'<figure class="exhibit chart" id="{i}" style="display:none"><div class="plot"></div></figure>' for i in ['fig-payrolls','fig-industry','fig-reasons','fig-cutstates'] if f'id="{i}"' not in html)
html=html.replace('</main>',stubs+'</main>',1)
# TOC rebuild
bb=BeautifulSoup(html,'html.parser'); toc=bb.select_one('nav.toc ol'); toc.clear()
names={'disclosure':'About this report','limits':'What this report does not establish','summary':'Executive summary','reframe':'About Version 1.8','index':'Long-Search Index','layoffs':'Job cuts and AI attribution','concentrated':'Search length by occupation','longterm':'Age','older':'Older workers','context':'New graduates','q3':'Q3: growth without hiring','outlook':'What to watch','full':'Full report and methods','about':'About NextChapter'}
for sec in bb.find('main').find_all('section',recursive=False):
    sid=sec.get('id')
    if sid in names:
        eb=sec.select_one('.chapter-head .eyebrow'); num=eb.text if eb and re.match(r'^\d\d$',eb.text) else '—'
        toc.append(BeautifulSoup(f'<li><a href="#{sid}"><span class="n">{num}</span>{names[sid]}</a></li>','html.parser'))
html=str(bb)
html=html.replace('<title>NextChapter Employment Report — September 2026</title>','<title>NextChapter Employment Report — September 2026 (Brief)</title>',1)
open(sys.argv[2],'w').write(html); print('ok exhibits',c[0])
