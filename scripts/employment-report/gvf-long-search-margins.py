# 90% margins of error on the Jan-Sep year-over-year change in "share of unemployed out 27+ weeks", by BLS generalized variance method
# (PF-12 percent distribution, 27 weeks and over), following the September edition's Appendix B: base y = group's unemployed (persons),
# factor = 9-month average (linear interpolation between quarterly and yearly factors) x (change-in-yearly / yearly average factor).
# usage: python3 gvf-long-search-margins.py breakdowns.json out.json   (needs BLS PF-12 parameters below; update when BLS republishes)
import json, math, sys
A,B=3790.63896835,-1.4058504e-05
fq,fy,fchg_y=0.7244570082,0.4135866746,0.554675168
f9=fq+(fy-fq)*(9-3)/(12-3); f_change=f9*(fchg_y/fy)
d=json.load(open(sys.argv[1])); c,p=d['current']['groups'],d['prior']['groups']
def unemployed_k(g):
    # prefer direct: ltu_thousands / (ltu_share/100); fall back to employed*rate
    return g['ltu_thousands']/(g['ltu_share']/100)
out=[]
for lab,k in [('All workers','all'),('Blue-collar','bluecollar'),('White-collar','wc'),("White-collar, no bachelor's",'wc_no_degree'),('Knowledge workers','knowledge_workers'),('White-collar, ages 55-64','wc_age_55_64')]:
    g=c[k]; y=unemployed_k(g)*1000; pc=g['ltu_share']
    se=math.sqrt(((A+B*y)/y)*pc*(100-pc))*f_change
    moe=1.645*se; ch=g['ltu_share']-p[k]['ltu_share']
    n1,n2=g['unemployed_respondents'],p[k]['unemployed_respondents']; p1,p2=g['ltu_share']/100,p[k]['ltu_share']/100
    cons=1.645*math.sqrt(5*(p1*(1-p1)/n1+p2*(1-p2)/n2))*100
    out.append(dict(group=lab,share_2025=p[k]['ltu_share'],share_2026=g['ltu_share'],change=round(ch,1),unemployed_k=round(y/1000),moe_bls=round(moe,1),moe_conservative=round(cons,1),clears_bls=ch>moe,clears_conservative=ch>cons))
    print(f"{lab:30s} change {ch:+5.1f}  BLS ±{moe:4.1f} ({'clears' if ch>moe else 'within'})   conservative ±{cons:4.1f} ({'clears' if ch>cons else 'within'})   unemployed {y/1000:,.0f}k")
print('factor9',round(f9,4),'change factor',round(f_change,4))
json.dump(out,open(sys.argv[2],'w'),indent=1)
