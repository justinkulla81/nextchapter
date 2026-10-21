#!/usr/bin/env python3
"""Prints the body of a published report (Markdown, no title) from out/<geo>/report-data.json and the BLS peer file.
Run geo_report.py first.  python3 scripts/jobsreport/doc_body.py --geo pittsburgh"""
import argparse, json, os
H = os.path.dirname(os.path.abspath(__file__))
LV = [("ENTRY", "Entry"), ("MID_IC", "Mid-level"), ("SENIOR_IC", "Senior individual contributor"), ("MANAGER", "Manager"), ("DIRECTOR", "Director"), ("VP_PLUS", "VP and above")]
pct = lambda a, b: f"{100 * a / b:.0f}%" if b else "n/a"
money = lambda x: f"${x:,.0f}" if x else "not stated"
def table(head, rows): return "\n".join(["| " + " | ".join(head) + " |", "|" + "---|" * len(head)] + ["| " + " | ".join(str(c) for c in r) + " |" for r in rows])
ap = argparse.ArgumentParser(); ap.add_argument("--geo", required=True); a = ap.parse_args()
geos = json.load(open(f"{H}/geos.json")); data = json.load(open(f"{H}/out/{a.geo}/report-data.json")); bls = json.load(open(f"{H}/out/peer-bls-{a.geo}.json"))
d, peers = data[0], data[1:]; o, s = d["overview"], d["signals"]; wc = o["wc_in_county"]; lv = {x["level"]: x["n"] for x in d["levels"]}
fn = d["functions"]; emp = [e for e in d["employers"] if e["wc"]]; top = max(d["employers"], key=lambda e: e["n"])
hc = next((f for f in fn if f["function"] == "Healthcare practitioners"), {"n": 0}); ent = lv.get("ENTRY", 0)
ai = {bool(x["ai"]): x for x in d["aiVs"]}; me = next(r for r in bls["rows"] if r["geo"] == a.geo)
sr = sum(lv.get(k, 0) for k in ("SENIOR_IC", "MANAGER", "DIRECTOR", "VP_PLUS")); n_emp_entry = sum(1 for e in d["employers"] if e["wc_entry"])
print(f"""## Summary

The sample is {wc:,} white-collar postings from {o['employers']} employers' own career sites. {pct(hc['n'], wc)} are health care, {pct(ent, wc)} are entry-level, {pct(sr, wc)} are senior individual contributor or above, and median stated pay is {money(s['median_annual_pay'])} a year.

- **Labor market:** unemployment was {me['unemployment_rate']}% in {bls['month']}, against {me['unemployment_rate_year_ago']}% a year earlier; nonfarm employment changed {me['nonfarm_12m_pct']}% over twelve months.
- **Entry-level:** {ent} white-collar postings across {n_emp_entry} employers.
- **AI:** {s['ai_pct']}% of white-collar postings mention AI; those pay a median of {money(ai[True]['median_pay']) if True in ai else 'n/a'} against {money(ai[False]['median_pay'])} for the rest.
- **Concentration:** {top['employer']} alone is {pct(top['n'], o['postings'])} of all postings, so the mix reflects the largest readable employers more than the whole market.

## Coverage

{o['in_county']:,} postings in the area were read from {o['employers']} employers, and {wc:,} of them are white-collar ({pct(wc, o['in_county'])}). Another {o['unclassified']:,} could not be classified from the title and are left out. The frame is every white-collar job at every level, entry-level included (Census major groups 1 and 2).

Employers on career systems we cannot read are missing, so read these figures as describing the employers listed, not every opening in the area.

## Levels and functions

{table(['Level','Postings','Share'], [(n, f"{lv.get(k,0):,}", pct(lv.get(k,0), wc)) for k, n in LV])}

{table(['Function','Postings','Entry-level','Employers','Median stated annual pay'], [(f['function'], f"{f['n']:,}", f['entry'], f['employers'], money(f['median_pay'])) for f in fn])}

## Employers, pay, AI and skills

Pay is stated in {s['pay_stated_pct']}% of white-collar postings, with a median of {money(s['median_annual_pay'])} a year or ${s['median_hourly_pay']} an hour.

{table(['Employer','All postings','White-collar','White-collar entry-level'], [(e['employer'], f"{e['n']:,}", f"{e['wc']:,}", e['wc_entry']) for e in sorted(emp, key=lambda e: -e['wc'])])}

**AI.** {ai[True]['n'] if True in ai else 0} postings ({s['ai_pct']}%) mention AI or machine learning. {('They pay a median of ' + money(ai[True]['median_pay']) + ' against ' + money(ai[False]['median_pay']) + ' for the rest, ' + str(round(float(ai[True]['senior_plus_pct']))) + '% are senior individual contributor or above (' + str(round(float(ai[False]['senior_plus_pct']))) + '% for the rest), and ' + str(round(float(ai[True]['remote_or_hybrid_pct']))) + '% mention remote or hybrid work (' + str(round(float(ai[False]['remote_or_hybrid_pct']))) + '% for the rest).') if True in ai else ''}

**Work arrangement and type.** {s['remote_mention_pct']}% mention remote work and {s['hybrid_mention_pct']}% hybrid. {s['part_time_pct']}% are part-time. {s['contract_words_pct']}% use contract, temporary, fractional or similar words, a W-2 and 1099 signal combined.

**Posting age.** {s['older_than_90d_pct']}% of postings with a posted date went up more than 90 days ago. Reposts and ghost-job risk need a second crawl.

{table(['Soft skill named','Share of white-collar postings'], [(x['skill'].capitalize(), pct(x['n'], wc)) for x in d['eq']])}

## Peer metros

{table([f"Metro (BLS, {bls['month']})",'Unemployment rate','Year ago','Change (pts)','Nonfarm jobs (thousands)','12-month change'], [(r['label'], f"{r['unemployment_rate']}%", f"{r['unemployment_rate_year_ago']}%", f"{r['unemployment_change_pts']:+.1f}", f"{r['nonfarm_thousands']:,}", f"{r['nonfarm_12m_pct']:+.1f}%") for r in sorted(bls['rows'], key=lambda r: -r['unemployment_rate'])])}

BLS figures cover the whole metro. Posting comparisons use the same crawl and tagging in each metro but different employers, so read them as indicative.

{table(['Metro (career-site postings)','White-collar postings','Employers','Entry','Mid-level','Senior and above','Median annual pay','Mention AI','Mention remote'], [(geos[x['geo']]['label'], f"{x['overview']['wc_in_county']:,}", x['overview']['employers'], pct({y['level']:y['n'] for y in x['levels']}.get('ENTRY',0), x['overview']['wc_in_county']), pct({y['level']:y['n'] for y in x['levels']}.get('MID_IC',0), x['overview']['wc_in_county']), pct(sum(y['n'] for y in x['levels'] if y['level'] in ('SENIOR_IC','MANAGER','DIRECTOR','VP_PLUS')), x['overview']['wc_in_county']), money(x['signals']['median_annual_pay']), f"{x['signals']['ai_pct']}%", f"{x['signals']['remote_mention_pct']}%") for x in [d] + peers])}

## Method and limits

- Source: employers' own career sites, crawled {str(d['crawl']['last_crawl'])[:10]}, tagged by job title with fixed rules; titles that cannot be classified are excluded.
- AI, remote, hybrid and soft-skill figures are keyword matches in posting text; pay medians use only postings that state pay.
- Postings are not BLS job openings: one opening can have several postings and some are always open.
- There is no history yet. Functions gaining or losing, reposts and ghost-job risk need at least two crawls.
- Labor market data: BLS Local Area Unemployment Statistics and Current Employment Statistics bulk files, not seasonally adjusted.""")
