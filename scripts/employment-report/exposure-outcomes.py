# Outcomes by AI exposure (version 1.4): mean AEI observed exposure by SOC major group vs CPS PRDTOCC1 occupation group outcomes.
# usage: python3 exposure-outcomes.py data/aei/vintages/exposure-2026-10-22.csv cps-breakdowns-2026-01-to-09.json
# PRDTOCC1 1..22 map to SOC major groups 11,13,15,...,53 in order. Exposure is a simple (unweighted) mean over detailed occupations.
import csv, json, sys, collections
ex = collections.defaultdict(list)
for r in csv.DictReader(open(sys.argv[1])): ex[r['occ_code'][:2]].append(float(r['observed_exposure']))
soc = dict(zip(range(1, 23), ['11','13','15','17','19','21','23','25','27','29','31','33','35','37','39','41','43','45','47','49','51','53']))
d = json.load(open(sys.argv[2])); c, p = d['current']['groups'], d['prior']['groups']
HI, MID = [3,16,7,17,2,9], [8,5,1]; LO = [k for k in range(1, 23) if k not in HI + MID]
def agg(ks):
    out = {}
    for lab, G in (('2026', c), ('2025', p)):
        emp = sum(G[f'occ_{k}']['employed_thousands'] for k in ks)
        un = sum(G[f'occ_{k}']['employed_thousands'] * G[f'occ_{k}']['unemployment_rate'] / (100 - G[f'occ_{k}']['unemployment_rate']) for k in ks)
        out[lab] = dict(employed_k=round(emp), ur=round(un / (emp + un) * 100, 2), ltu_share=round(sum(G[f'occ_{k}']['ltu_thousands'] for k in ks) / un * 100, 1))
    return out
for n, ks in (('exposure 0.14+', HI), ('exposure 0.10-0.13', MID), ('exposure under 0.10', LO)):
    print(n, [round(sum(ex[soc[k]]) / len(ex[soc[k]]), 2) for k in ks], agg(ks))
