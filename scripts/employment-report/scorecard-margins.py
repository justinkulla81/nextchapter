# Scorecard: white-collar vs all workers by industry of last job and age, Jan-Sep 2026 vs 2025 (NSA, pooled).
# Margins: 90% BLS-GVF on the change in the 27+ week share (same method as gvf-long-search-margins.py).
# Cells with fewer than 100 unemployed person-month observations in either year are suppressed.
# usage: python3 scorecard-margins.py breakdowns.json out.json
import json, math, sys
A,B=3790.63896835,-1.4058504e-05
fq,fy,fchg_y=0.7244570082,0.4135866746,0.554675168
f9=fq+(fy-fq)*6/9; fc=f9*(fchg_y/fy)
d=json.load(open(sys.argv[1])); c,p=d['current']['groups'],d['prior']['groups']
IND={7:'Information',8:'Financial activities',9:'Professional and business services',10:'Education and health',13:'Public administration'}
AGE=[('under35','Under 35'),('35_44','35-44'),('45_54','45-54'),('55_64','55-64')]
rows=[]
def cell(k):
    g,q=c.get(k),p.get(k)
    if not g or not q: return None
    n1,n2=g['unemployed_respondents'],q['unemployed_respondents']
    r=dict(unemp_rate_2026=g['unemployment_rate'],unemp_rate_2025=q['unemployment_rate'],n_2026=n1,n_2025=n2)
    if min(n1,n2)<100 or not g.get('ltu_share') or not q.get('ltu_share'):
        r.update(suppressed=True); return r
    y=g['ltu_thousands']/(g['ltu_share']/100)*1000; pc=g['ltu_share']
    moe=1.645*math.sqrt(((A+B*y)/y)*pc*(100-pc))*fc
    ch=g['ltu_share']-q['ltu_share']
    r.update(suppressed=False,share_2025=q['ltu_share'],share_2026=pc,change=round(ch,1),moe=round(moe,1),clears=abs(ch)>moe); return r
for code,name in IND.items():
    rows.append(dict(section='Industry of last job',label=name,wc=cell(f'wc_ind_{code}'),all=cell(f'ind_{code}')))
for k,name in AGE:
    rows.append(dict(section='Age',label=name,wc=cell(f'wc_age_{k}'),all=cell({'under35':'age_25_34'}.get(k,f'age_{k}')) if k!='under35' else None))
rows.insert(0,dict(section='Total',label='All',wc=cell('wc'),all=cell('all')))
for r in rows:
    f=lambda x: 'n/a' if not x else ('suppressed(n=%d/%d)'%(x['n_2026'],x['n_2025']) if x['suppressed'] else f"UR {x['unemp_rate_2025']}->{x['unemp_rate_2026']}  27+ {x['share_2025']}->{x['share_2026']} ({x['change']:+}, ±{x['moe']}{'*' if x['clears'] else ''}) n={x['n_2026']}")
    print(f"{r['label'][:28]:28s} WC: {f(r['wc'])}\n{'':28s} ALL: {f(r['all'])}")
json.dump(rows,open(sys.argv[2],'w'),indent=1)
