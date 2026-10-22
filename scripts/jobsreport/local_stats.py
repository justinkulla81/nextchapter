#!/usr/bin/env python3
"""
Same numbers as the jobsreport_stats() database function, computed from the crawl files in out/<geo>/*.jsonl,
so a report can be built with no database. The tagging rules are read from classify.sql (the single source of truth)
and translated to Python regexes.

  python3 scripts/jobsreport/local_stats.py --geo san-diego      # writes out/<geo>/report-data.json (this geo only)
"""
import argparse, glob, json, os, re, statistics
HERE = os.path.dirname(os.path.abspath(__file__))
def R(pat, t): return re.search(pat.replace(r"\m", r"\b").replace(r"\M", r"\b"), t) is not None
def rules():
    sql = open(os.path.join(HERE, "classify.sql")).read()
    sql = sql[sql.index("select posting_id,"):]
    lvl, fn = sql.split("end as level,")
    def conv(cond):
        cond = re.sub(r"t !~ '((?:[^']|'')*)'", lambda m: f"(not R({m.group(1)!r}, t))", cond)
        cond = re.sub(r"t ~ '((?:[^']|'')*)'", lambda m: f"R({m.group(1)!r}, t)", cond)
        return cond.replace("\n", " ")
    def parse(block):
        out = []
        for m in re.finditer(r"when (.*?) then '([^']+)'", block, re.S): out.append((conv(m.group(1)), m.group(2)))
        return out
    return parse(lvl), parse(fn.split("end as fn")[0])
LV, FN = rules()
def classify(title):
    t = (title or "").lower(); env = {"R": R, "t": t}
    level = next((lab for c, lab in LV if eval(c, env)), "MID_IC")
    fn = next((lab for c, lab in FN if eval(c, env)), "Unclassified")
    wc = False if fn in ("Non-white-collar occupations", "Sales (not white-collar)") else (None if fn == "Unclassified" else True)
    return level, fn, wc
AI = r"\m(artificial intelligence|machine learning|generative ai|genai|llm|large language model|copilot|chatgpt|ai[- ]powered|ai tools?)\M"
def med(xs): return int(statistics.median(xs)) if xs else None
def mid(r): return (r["pay_min"] + (r["pay_max"] or r["pay_min"])) / 2
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--geo", required=True); a = ap.parse_args()
    rows = []
    for f in glob.glob(os.path.join(HERE, "out", a.geo, "*.jsonl")):
        for l in open(f):
            if l.strip():
                r = json.loads(l)
                if r.get("county_fips"):
                    r["level"], r["function"], r["white_collar"] = classify(r["title"]); rows.append(r)
    w = [r for r in rows if r["white_collar"]]
    for r in w: r["d"] = (r.get("description") or "").lower()
    def pay(rs, per): return [mid(r) for r in rs if r.get("pay_min") and r.get("pay_period") == per and (20000 <= r["pay_min"] <= 1000000 if per == "year" else 8 <= r["pay_min"] <= 300)]
    n = len(w) or 1
    isai = lambda r: R(AI, r["d"]) or re.search(r"(^|[^a-z])ai([^a-z]|$)", r["d"]) is not None
    funcs = {}
    for r in w: funcs.setdefault(r["function"], []).append(r)
    emps = {}
    for r in rows: emps.setdefault((r["employer"], r["source_type"]), []).append(r)
    pc = lambda k: round(100 * k / n, 1)
    ai_rows = [r for r in w if isai(r)]; no_rows = [r for r in w if not isai(r)]
    def aistat(flag, rs):
        return {"ai": flag, "n": len(rs), "median_pay": med(pay(rs, "year")), "senior_plus_pct": round(100 * sum(r["level"] in ("SENIOR_IC", "MANAGER", "DIRECTOR", "VP_PLUS") for r in rs) / len(rs), 1) if rs else 0,
                "remote_or_hybrid_pct": round(100 * sum(R(r"\m(remote|hybrid)\M", r["d"]) for r in rs) / len(rs), 1) if rs else 0}
    skills = {"communication": r"communicat", "collaboration": r"\m(collaborat\w*|teamwork|team player|cross-functional)\M", "leadership": r"\mleadership\M",
              "problem solving": r"\m(problem[- ]solving|critical thinking)\M", "adaptability": r"\m(adaptab\w+|flexib\w+)\M",
              "empathy": r"\m(empath\w+|emotional intelligence|compassion\w*)\M", "creativity": r"\mcreativ\w+", "named tools": r"\m(sql|python|excel|tableau|power bi|sap|salesforce|epic)\M"}
    dated = [r for r in w if r.get("posted_at")]
    from datetime import datetime, timezone, timedelta
    def when(v):
        v = str(v)[:19].replace("/", "-")
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%m-%d-%Y"):
            try: return datetime.strptime(v[:len(datetime.now().strftime(fmt))] if fmt != "%Y-%m-%dT%H:%M:%S" else v, fmt).replace(tzinfo=timezone.utc)
            except Exception: pass
        return None
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    dts = [x for x in (when(r["posted_at"]) for r in dated) if x]; dated = dts; old = sum(1 for x in dts if x < cutoff)
    out = {"geo": a.geo,
           "overview": {"postings": len(rows), "white_collar": len(w), "unclassified": sum(r["white_collar"] is None for r in rows), "employers": len(emps), "in_county": len(rows), "wc_in_county": len(w)},
           "levels": sorted([{"level": k, "n": sum(r["level"] == k for r in w)} for k in {r["level"] for r in w}], key=lambda x: -x["n"]),
           "functions": sorted([{"function": k, "n": len(v), "entry": sum(r["level"] == "ENTRY" for r in v), "employers": len({r["employer"] for r in v}), "median_pay": med(pay(v, "year"))} for k, v in funcs.items()], key=lambda x: -x["n"]),
           "employers": sorted([{"employer": k[0], "source_type": k[1], "n": len(v), "wc": sum(bool(r["white_collar"]) for r in v), "wc_entry": sum(bool(r["white_collar"]) and r["level"] == "ENTRY" for r in v)} for k, v in emps.items()], key=lambda x: -x["n"])[:40],
           "signals": {"n": len(w), "ai_pct": pc(len(ai_rows)), "remote_mention_pct": pc(sum(R(r"\mremote\M", r["d"]) or r.get("arrangement") == "remote" for r in w)),
                       "hybrid_mention_pct": pc(sum(R(r"\mhybrid\M", r["d"]) or r.get("arrangement") == "hybrid" for r in w)), "part_time_pct": pc(sum("part" in (r.get("employment_type") or "").lower() for r in w)),
                       "contract_words_pct": pc(sum(R(r"\m(contract|contractor|1099|temporary|temp-to-hire|fractional|interim|freelance)\M", r["d"]) for r in w)),
                       "pay_stated_pct": pc(sum(bool(r.get("pay_min")) for r in w)), "median_annual_pay": med(pay(w, "year")),
                       "median_hourly_pay": round(statistics.median(pay(w, "hour")), 2) if pay(w, "hour") else None, "dated": len(dated), "older_than_90d_pct": round(100 * old / len(dated), 1) if dated else None},
           "aiVs": [aistat(True, ai_rows), aistat(False, no_rows)] if ai_rows else [aistat(False, no_rows)],
           "eq": sorted([{"skill": k, "n": sum(R(p, r["d"]) for r in w)} for k, p in skills.items()], key=lambda x: -x["n"]),
           "crawl": {"first_crawl": None, "last_crawl": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "runs": len(glob.glob(os.path.join(HERE, "out", a.geo, "*.jsonl")))}}
    os.makedirs(os.path.join(HERE, "out", a.geo), exist_ok=True)
    json.dump([out], open(os.path.join(HERE, "out", a.geo, "report-data.json"), "w"), indent=1)
    entry = [{"employer": r["employer"], "title": r["title"], "location": r.get("location_raw"), "url": r.get("url")} for r in w if r["level"] == "ENTRY"]
    json.dump(entry, open(os.path.join(HERE, "out", a.geo, "entry-sample.json"), "w"), indent=1)
    print(f"{a.geo}: {len(rows)} postings, {len(w)} white-collar, {len(emps)} employers")
if __name__ == "__main__":
    main()
