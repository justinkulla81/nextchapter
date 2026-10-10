#!/usr/bin/env python3
"""American Job Centers from CareerOneStop's public locator, one request per state.
Writes data/geo/ajc.json. Fields: id,name,type,state,street,city,zip,phone,hours,emails(by role),detailsUrl."""
import re, json, time, html, sys, subprocess
STATES="AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split()
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0'
BASE='https://www.careeronestop.org/LocalHelp/AmericanJobCenters/find-american-job-centers.aspx'
def get(u):
    for i in range(3):
        r=subprocess.run(['curl','-sL','-m','60','-A',UA,'-w','\\n%{http_code}',u],capture_output=True)
        body,_,code=r.stdout.decode('utf8','replace').rpartition('\n')
        if code=='200' and body: return body
        time.sleep(3*(i+1))
    raise RuntimeError(u)
def txt(s): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',s))).strip()
out=[]; report={}
for st in STATES:
    h=get(f'{BASE}?location={st}&radius=25&ct=0&y=0&w=0&e=0&sortcolumns=Location&sortdirections=ASC&curPage=1&pagesize=500')
    m=re.search(r'id="recordNumber"[^>]*>(\d+)<',h); expected=int(m.group(1)) if m else None
    tb=re.search(r'<div id="AJCTable">.*?<tbody>(.*?)</tbody>',h,re.S)
    rows=re.findall(r'<tr>(.*?)</tr>',tb.group(1),re.S) if tb else []
    n=0
    for r in rows:
        link=re.search(r'<a class=\'notranslate\' href="([^"]*centerID=(\d+)[^"]*)"[^>]*>(.*?)</a><br><span class=\'notranslate\'>(.*?)</span>',r,re.S)
        if not link: continue
        cid=link.group(2)
        loc=re.search(r'<span class="notranslate">(.*?)</span>',r,re.S)
        parts=[txt(p) for p in re.split(r'<br\s*/?>|</br>',loc.group(1))] if loc else []
        parts=[p for p in parts if p]
        csz=parts[-1] if parts else ''
        mm=re.match(r'(.*),\s*([A-Z]{2})\s+(\d{5})',csz)
        em=lambda k:(re.search(r'data-%s="([^"]*)"'%k,r) or [None,''])[1]
        phone=re.search(r'href="tel:([^"]+)"',r)
        hours=re.search(r'Hours:\s*(.*?)<br',r,re.S)
        out.append(dict(id=f'{st}-{cid}',centerId=cid,name=txt(link.group(3)),type=txt(link.group(4)),
            state=mm.group(2) if mm else st,street=', '.join(parts[:-1]) or None,city=mm.group(1) if mm else None,zip=mm.group(3) if mm else None,
            phone=phone.group(1) if phone else None,hours=txt(hours.group(1)) if hours else None,
            generalEmail=em('generalemail') or None,businessEmail=em('busemail') or None,veteranEmail=em('vetemail') or None,youthEmail=em('yscemail') or None,
            detailsUrl='https://www.careeronestop.org'+html.unescape(link.group(1)).split('&')[0]+f'&centerID={cid}'))
        n+=1
    report[st]=(n,expected); print(st,n,expected,flush=True); time.sleep(1)
json.dump(out,open('data/geo/ajc.json','w'),indent=1)
print('total',len(out),'short states',{k:v for k,v in report.items() if v[0]!=v[1]})
