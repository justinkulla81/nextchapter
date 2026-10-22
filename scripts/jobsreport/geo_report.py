#!/usr/bin/env python3
"""
One command, one geo, no database approvals:

  python3 scripts/jobsreport/geo_report.py --geo pittsburgh            # writes out/<geo>/report-data.json and report.md
  python3 scripts/jobsreport/geo_report.py --geo pittsburgh --no-peers

Calls the read-only aggregate endpoint (edge function jobsreport-stats), merges BLS peer figures
from peer_bls.py when its cache exists, and writes a Markdown draft with white-collar (all levels)
as the headline frame. Token: env JOBSREPORT_STATS_TOKEN or out/.stats-token.
"""
import argparse, json, os, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
URL = "https://uvoulytrsrxasqzutlmq.supabase.co/functions/v1/jobsreport-stats"
LEVELS = [("ENTRY", "Entry"), ("MID_IC", "Mid-level"), ("SENIOR_IC", "Senior individual contributor"), ("MANAGER", "Manager"), ("DIRECTOR", "Director"), ("VP_PLUS", "VP and above")]

def token():
    t = os.environ.get("JOBSREPORT_STATS_TOKEN")
    if t: return t.strip()
    p = os.path.join(HERE, "out", ".stats-token")
    return open(p).read().strip() if os.path.exists(p) else sys.exit("no stats token: set JOBSREPORT_STATS_TOKEN")

def fetch_stats(geo_list):
    """Numbers for each geo. With SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: the jobsreport_stats database function
    (no edge function, no model). Otherwise the read-only edge function with a token."""
    base, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    out = []
    for g in geo_list:
        if base and key:
            req = urllib.request.Request(base.rstrip("/") + "/rest/v1/rpc/jobsreport_stats", data=json.dumps({"p_geo": g}).encode(),
                                         headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"})
            out.append(json.load(urllib.request.urlopen(req, timeout=120)))
        else:
            req = urllib.request.Request(URL, data=json.dumps({"geo": g, "peers": []}).encode(),
                                         headers={"Content-Type": "application/json", "x-stats-token": token()})
            d = json.load(urllib.request.urlopen(req, timeout=120))
            if isinstance(d, dict): sys.exit(f"stats error: {d}")
            out.append(d[0])
    return out

def pct(a, b): return f"{100 * a / b:.0f}%" if b else "n/a"
def money(x): return f"${x:,.0f}" if x else "n/a"

def table(head, rows):
    return "\n".join(["| " + " | ".join(head) + " |", "|" + "---|" * len(head)] + ["| " + " | ".join(str(c) for c in r) + " |" for r in rows])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--geo", required=True)
    ap.add_argument("--no-peers", action="store_true"); ap.add_argument("--local", action="store_true", help="use out/<geo>/report-data.json from local_stats.py (no database)")
    a = ap.parse_args()
    geos = json.load(open(os.path.join(HERE, "geos.json")))
    g = geos[a.geo]
    peers = [] if (a.no_peers or a.local) else [p for p in g.get("peers", []) if os.path.exists(os.path.join(HERE, "out", p))]
    data = json.load(open(os.path.join(HERE, "out", a.geo, "report-data.json"))) if a.local else fetch_stats([a.geo] + peers)
    d, peer_data = data[0], data[1:]
    out_dir = os.path.join(HERE, "out", a.geo); os.makedirs(out_dir, exist_ok=True)
    if not a.local: json.dump(data, open(os.path.join(out_dir, "report-data.json"), "w"), indent=1)

    o, s = d["overview"], d["signals"]; wc = o["wc_in_county"]
    lv = {x["level"]: x["n"] for x in d["levels"]}
    emp = d["employers"]; top = emp[0] if emp else None
    L = [f"# {g['label']}: white-collar jobs report (draft)", "",
         f"Source: employers' own career sites, crawled {str(d['crawl']['last_crawl'])[:10]} ({d['crawl']['runs']} source runs). "
         f"Headline frame: all white-collar jobs at every level, entry-level included (Census major groups 1 and 2).", "",
         "## Coverage", "",
         f"{o['postings']:,} postings read from {o['employers']} employers; {o['in_county']:,} in the area; {wc:,} are white-collar "
         f"({pct(wc, o['in_county'])} of in-area postings); {o['unclassified']:,} could not be classified from the title and are excluded.",
         f"Largest employer in the sample: {top['employer']} with {top['n']:,} postings ({pct(top['n'], o['postings'])}). " if top else "",
         "This is a sample of employers whose career systems we can read, not every opening in the area. Employers on other systems are missing, and large health systems and universities are over-weighted where they are readable.", "",
         "## White-collar postings by level", "",
         table(["Level", "Postings", "Share"], [(n, lv.get(k, 0), pct(lv.get(k, 0), wc)) for k, n in LEVELS]), "",
         "## By function", "",
         table(["Function", "Postings", "Entry-level", "Employers", "Median stated annual pay"],
               [(f["function"], f["n"], f["entry"], f["employers"], money(f["median_pay"])) for f in d["functions"]]), "",
         "## Employers in the sample", "",
         table(["Employer", "System type", "All postings", "White-collar", "White-collar entry-level"],
               [(e["employer"], e["source_type"], e["n"], e["wc"], e["wc_entry"]) for e in emp]), "",
         "## Pay, work arrangement and posting age (white-collar)", "",
         f"- Pay stated in {s['pay_stated_pct']}% of postings; median stated annual pay {money(s['median_annual_pay'])}, median hourly {('$%s' % s['median_hourly_pay']) if s['median_hourly_pay'] else 'n/a'}. Medians are used because the parser can pick up bonus or revenue figures.",
         f"- Mentions remote work: {s['remote_mention_pct']}%; mentions hybrid: {s['hybrid_mention_pct']}% (text mentions, not confirmed arrangements).",
         f"- Part-time: {s['part_time_pct']}%. Contract, temporary, fractional or similar words: {s['contract_words_pct']}% (a 1099 signal only, W-2 temporary roles included).",
         f"- Posted more than 90 days ago: {s['older_than_90d_pct']}% of {s['dated']:,} postings with a posted date. Repost and ghost-job analysis needs a second crawl.", "",
         "## AI and non-AI postings (white-collar)", ""]
    ai = {bool(x["ai"]): x for x in d["aiVs"]}
    if True in ai and False in ai:
        L += [f"{s['ai_pct']}% of white-collar postings mention AI, machine learning or similar.", "",
              table(["", "Mention AI", "Do not"], [
                  ("Postings", ai[True]["n"], ai[False]["n"]),
                  ("Median stated annual pay", money(ai[True]["median_pay"]), money(ai[False]["median_pay"])),
                  ("Senior individual contributor and above", f"{ai[True]['senior_plus_pct']}%", f"{ai[False]['senior_plus_pct']}%"),
                  ("Mention remote or hybrid", f"{ai[True]['remote_or_hybrid_pct']}%", f"{ai[False]['remote_or_hybrid_pct']}%")]), ""]
    L += ["## Soft skills named in postings (white-collar)", "",
          table(["Skill", "Postings", "Share"], [(x["skill"], x["n"], pct(x["n"], wc)) for x in d["eq"]]), ""]

    if peer_data:
        L += ["## Peer metros: same career-site method", "",
              "Same crawl and tagging for each metro. Employers differ by metro, so read shares and medians as indicative, not as measures of the whole market.", ""]
        rows = []
        for x in [d] + peer_data:
            ox, sx = x["overview"], x["signals"]; w = ox["wc_in_county"]; l = {y["level"]: y["n"] for y in x["levels"]}
            rows.append((geos[x["geo"]]["label"], f"{w:,}", ox["employers"], pct(l.get("ENTRY", 0), w), pct(l.get("MID_IC", 0), w),
                         pct(sum(l.get(k, 0) for k in ("SENIOR_IC", "MANAGER", "DIRECTOR", "VP_PLUS")), w),
                         money(sx["median_annual_pay"]), f"{sx['ai_pct']}%", f"{sx['remote_mention_pct']}%"))
        L += [table(["Metro", "White-collar postings", "Employers", "Entry", "Mid-level", "Senior IC and above", "Median annual pay", "Mention AI", "Mention remote"], rows), ""]

    bls = os.path.join(HERE, "out", f"peer-bls-{a.geo}.json")
    try:
        subprocess.run([sys.executable, os.path.join(HERE, "peer_bls.py"), "--geo", a.geo, "--out", bls], check=True, capture_output=True, timeout=600)
        b = json.load(open(bls))
        L += [f"## Peer metros: official labor market data (BLS, {b['month']}, not seasonally adjusted)", "",
              table(["Metro", "Unemployment rate", "Year ago", "Change (pts)", "Nonfarm jobs (thousands)", "12-month change"],
                    [(r["label"], f"{r['unemployment_rate']}%", f"{r['unemployment_rate_year_ago']}%", r["unemployment_change_pts"],
                      r["nonfarm_thousands"], f"{r['nonfarm_12m_pct']}%") for r in b["rows"]]), ""]
    except Exception as e:
        L += [f"(BLS peer table not produced: {e})", ""]

    L += ["## Method and limits", "",
          "- Level and function are assigned from the job title by fixed rules (version in the database); roughly one in ten titles cannot be classified and is left out of the white-collar frame.",
          "- AI, remote, hybrid and soft-skill figures are keyword matches in posting text.",
          "- No history yet: functions gaining or losing, reposts, closures and ghost-job risk need at least two crawls. The weekly crawl workflow provides them.",
          "- Postings are not job openings in the BLS sense; one opening can have several postings and some postings are evergreen.", ""]
    open(os.path.join(out_dir, "report.md"), "w").write("\n".join(L))
    print(os.path.join(out_dir, "report.md"))

if __name__ == "__main__":
    main()
