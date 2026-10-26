#!/usr/bin/env python3
"""Prints the body of a published report (Markdown, no title) from out/<geo>/report-data.json and the BLS peer file.
Run geo_report.py first.  python3 scripts/jobsreport/doc_body.py --geo pittsburgh"""
import argparse, json, os, re
H = os.path.dirname(os.path.abspath(__file__))
LV = [("ENTRY", "Entry"), ("MID_IC", "Mid-level"), ("SENIOR_IC", "Senior individual contributor"), ("MANAGER", "Manager"), ("DIRECTOR", "Director"), ("VP_PLUS", "VP and above")]
pct = lambda a, b: f"{100 * a / b:.0f}%" if b else "n/a"
money = lambda x: f"${x:,.0f}" if x else "not stated"
def table(head, rows): return "\n".join(["| " + " | ".join(head) + " |", "|" + "---|" * len(head)] + ["| " + " | ".join(str(c) for c in r) + " |" for r in rows])
ap = argparse.ArgumentParser(); ap.add_argument("--geo", required=True); ap.add_argument("--strict", action="store_true", help="below the sample minimum, publish only the labor-market section and employer list"); a = ap.parse_args()
geos = json.load(open(f"{H}/geos.json")); data = json.load(open(f"{H}/out/{a.geo}/report-data.json")); bls = json.load(open(f"{H}/out/peer-bls-{a.geo}.json"))
d, peers = data[0], data[1:]; o, s = d["overview"], d["signals"]; wc = o["wc_in_county"]; lv = {x["level"]: x["n"] for x in d["levels"]}
fn = d["functions"]; emp = [e for e in d["employers"] if e["wc"]]; top = max(d["employers"], key=lambda e: e["n"])
hc = next((f for f in fn if f["function"] == "Healthcare practitioners"), {"n": 0}); ent = lv.get("ENTRY", 0)
ai = {bool(x["ai"]): x for x in d["aiVs"]}; me = next(r for r in bls["rows"] if r["geo"] == a.geo)
sr = sum(lv.get(k, 0) for k in ("SENIOR_IC", "MANAGER", "DIRECTOR", "VP_PLUS")); n_emp_entry = sum(1 for e in d["employers"] if e["wc_entry"])
MIN_EMPLOYERS, MAX_TOP_SHARE = 15, 0.40
top_share = (top["n"] / o["postings"]) if o["postings"] else 0
limited = o["employers"] < MIN_EMPLOYERS or top_share > MAX_TOP_SHARE
_src = []
for _f in (f"{H}/sources/{a.geo}.json", f"{H}/sources/{a.geo}.sweep.json"):
    if os.path.exists(_f): _src += [x.get("employer", "") for x in json.load(open(_f))]
read_names = [re.sub(r"[^a-z]", "", n.lower()) for n in [e["employer"] for e in d["employers"]] + _src if n]
cand_path = f"{H}/candidates/{a.geo}.txt"
unread = []
if os.path.exists(cand_path):
    for n in [l.strip() for l in open(cand_path) if l.strip() and not l.startswith("#")]:
        k = re.sub(r"[^a-z]", "", n.lower())
        if k and not any(k in r or r in k for r in read_names): unread.append(n)
notice = ""
if limited:
    why = []
    if o["employers"] < MIN_EMPLOYERS: why.append(f"only {o['employers']} employers were readable (minimum {MIN_EMPLOYERS})")
    if top_share > MAX_TOP_SHARE: why.append(f"{top['employer']} is {top_share:.0%} of all postings (maximum {MAX_TOP_SHARE:.0%})")
    notice = "> **Limited sample.** " + " and ".join(why).capitalize() + ". Treat the shares and pay figures below as describing these employers only, not the local market.\n\n"
if limited and a.strict:
    print(notice + "## Labor market\n\n" + f"Unemployment was {me['unemployment_rate']}% in {bls['month']}, against {me['unemployment_rate_year_ago']}% a year earlier; nonfarm employment changed {me['nonfarm_12m_pct']}% over twelve months.\n\n## Employers read\n\n" + table(["Employer", "Postings"], [(e["employer"], e["n"]) for e in d["employers"]]))
    raise SystemExit
_fp = f"{H}/out/{a.geo}/feed-exposure.json"
feed_block = ""
if os.path.exists(_fp):
    fx = json.load(open(_fp)); wcn = fx["white_collar"]; ex = {x["level"]: x["n"] for x in fx["exposure"]}; exn = {x["level"]: x["n"] for x in fx["exposure_entry"]}
    lvl = {x["level"]: x["n"] for x in fx["by_level"]}; src = {x["category"]: x["n"] for x in fx["by_source"]}
    entry_total = sum(exn.values())
    feed_block = f"""## Job-board feed: more openings, and exposure to AI

The NextChapter job-board feed holds {fx['live']:,} live postings in the area, {wcn:,} of them white-collar ({pct(wcn, fx['live'])}). That is a wider net than the employer career sites above, and it includes aggregator and search-firm postings ({pct(src.get('aggregator', 0) + src.get('search_firm', 0), fx['live'])} of the feed), so it is shown as its own frame and never added to the career-site numbers. Each posting carries an occupation code matched to Anthropic's Economic Index; {fx['soc_from_title_pct']}% were matched from the job title and the rest from the job function.

| White-collar postings in the feed | Postings | Share |
|---|---|---|
| Entry and early career | {lvl.get('entry and early', 0):,} | {pct(lvl.get('entry and early', 0), wcn)} |
| Individual contributor | {lvl.get('individual contributor', 0):,} | {pct(lvl.get('individual contributor', 0), wcn)} |
| Management and above | {lvl.get('management and above', 0):,} | {pct(lvl.get('management and above', 0), wcn)} |

## Jobs at risk: AI exposure of the openings

Anthropic rates each occupation's observed exposure to AI, which weighs real usage and automated uses more heavily than hypothetical capability. In this feed {pct(ex.get('high', 0), wcn)} of white-collar openings are in highly exposed occupations, {pct(ex.get('medium', 0), wcn)} in medium and {pct(ex.get('low', 0), wcn)} in low. Among entry and early-career openings, {pct(exn.get('high', 0), entry_total)} are in highly exposed occupations. Exposure is not a forecast of job loss: Anthropic found no systematic rise in unemployment for exposed workers so far, with early signs that hiring of younger workers has slowed in exposed occupations.

{table(['Most-posted occupations', 'Postings', 'AI exposure'], [(x['title'], f"{x['n']:,}", x['exposure']) for x in fx['top_occupations']])}

{table(['Highly exposed occupations with the most openings', 'Postings'], [(x['title'], f"{x['n']:,}") for x in fx['top_high_exposure'][:8]])}

Directional only. Retraining paths (related occupations with lower exposure and stronger projected growth) are the next addition."""
_er = f"{H}/out/{a.geo}/employer-rankings.json"
if os.path.exists(_er):
    from employers_section import render as _render_emp
    feed_block += "\n\n" + _render_emp(json.load(open(_er)), place=d.get("place") or a.geo.replace("-", " ").title())
entry_block = ""
_p = f"{H}/out/{a.geo}/entry-sample.json"
if os.path.exists(_p):
    _e = json.load(open(_p)); seen = set(); rows = []
    for x in _e:
        k = (x["employer"], x["title"])
        if k in seen: continue
        seen.add(k); rows.append(x)
    import random; random.Random(7).shuffle(rows)
    if rows:
        entry_block = "## Entry-level openings, a sample\n\n" + table(["Employer", "Role", "Location"], [(x["employer"], (f"[{x['title']}]({x['url']})" if x.get("url") else x["title"]), x.get("location") or "") for x in rows[:15]])
print(notice + f"""## Summary

The sample is {wc:,} white-collar postings from {o['employers']} employers' own career sites. {pct(hc['n'], wc)} are health care, {pct(ent, wc)} are entry-level, {pct(sr, wc)} are senior individual contributor or above, and median stated pay is {money(s['median_annual_pay'])} a year.

- **Labor market:** unemployment was {me['unemployment_rate']}% in {bls['month']}, against {me['unemployment_rate_year_ago']}% a year earlier; nonfarm employment changed {me['nonfarm_12m_pct']}% over twelve months.
- **Entry-level:** {ent} white-collar postings across {n_emp_entry} employers.
- **AI:** {s['ai_pct']}% of white-collar postings mention AI; those pay a median of {money(ai[True]['median_pay']) if True in ai else 'n/a'} against {money(ai[False]['median_pay'])} for the rest.
- **Concentration:** {top['employer']} alone is {pct(top['n'], o['postings'])} of all postings, so the mix reflects the largest readable employers more than the whole market.

## Coverage

{o['in_county']:,} postings in the area were read from {o['employers']} employers, and {wc:,} of them are white-collar ({pct(wc, o['in_county'])}). Another {o['unclassified']:,} could not be classified from the title and are left out. The frame is every white-collar job at every level, entry-level included (Census major groups 1 and 2).

Employers on career systems we cannot read are missing, so read these figures as describing the employers listed, not every opening in the area.

{('Large employers we looked for and could not read: ' + ', '.join(unread[:14]) + '.') if unread else ''}

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

{entry_block}

{feed_block}

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
