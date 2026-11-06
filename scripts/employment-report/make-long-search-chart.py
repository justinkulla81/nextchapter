# Exhibit 1: share of unemployed out 27+ weeks, this year vs last, by group, with BLS-method 90% margins on the change.
# usage: python3 make-long-search-chart.py breakdowns.json out.png margins.json   (margins.json from gvf-long-search-margins.py)
import sys
import json, math
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt, numpy as np
d=json.load(open(sys.argv[1]))
c,p=d['current']['groups'],d['prior']['groups']
groups=[('All workers','all'),('Blue-collar','bluecollar'),('White-collar','wc'),("White-collar,\nno bachelor's",'wc_no_degree'),('Knowledge workers','knowledge_workers'),('White-collar,\nages 55-64','wc_age_55_64')]
gv={r['group']:r for r in json.load(open(sys.argv[3]))}
rows=[]
for lab,k in groups:
    p1,p2=c[k]['ltu_share']/100,p[k]['ltu_share']/100; n1,n2=c[k]['unemployed_respondents'],p[k]['unemployed_respondents']
    g=gv[lab.replace('\n',' ').replace('ages 55-64','ages 55-64')]; moe=g['moe_bls']
    ch=c[k]['ltu_share']-p[k]['ltu_share']; rows.append((lab,p[k]['ltu_share'],c[k]['ltu_share'],ch,moe,ch>moe))
plt.rcParams['font.family']='Inter'
fig,ax=plt.subplots(figsize=(10,5.0),dpi=170)
x=np.arange(len(rows)); w=.36; C25,C26='#9aa5b1','#1d4e89'
ax.bar(x-w/2,[r[1] for r in rows],w,color=C25,label='Jan-Sep 2025'); ax.bar(x+w/2,[r[2] for r in rows],w,color=C26,label='Jan-Sep 2026')
for i,r in enumerate(rows):
    ax.text(x[i]-w/2,r[1]+.6,f'{r[1]:.1f}%',ha='center',fontsize=9,color='#444')
    ax.text(x[i]+w/2,r[2]+.6,f'{r[2]:.1f}%',ha='center',fontsize=9,color=C26,fontweight='bold')
    ax.text(x[i],max(r[1],r[2])+4.2,f'{r[3]:+.1f} pts\n(±{r[4]:.1f})',ha='center',fontsize=9,color='#222')
ax.set_xticks(x); ax.set_xticklabels([r[0] for r in rows],fontsize=9); ax.set_ylim(0,52)
ax.set_ylabel('Share of unemployed out of work 27+ weeks (%)',fontsize=9); ax.spines[['top','right']].set_visible(False); ax.legend(frameon=False,loc='upper left',fontsize=9)
fig.subplots_adjust(bottom=.1,top=.97)
fig.savefig(sys.argv[2])
