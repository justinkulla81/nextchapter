#!/usr/bin/env python3
"""
Full-text signals from crawled postings (out/*.jsonl): the same measures as local_report.sql,
computed locally so they can run before the data is loaded into Supabase.

  python3 scripts/jobsreport/analyze_jsonl.py                 # all files in out/
  python3 scripts/jobsreport/analyze_jsonl.py out/wd-papa-johns.jsonl
"""
import glob, json, os, re, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
SIGNALS = {
    "AI named": r"\b(ai|artificial intelligence|machine learning|generative|llm|llms|copilot|chatgpt)\b",
    "Remote": r"\b(remote|work from home|telecommut\w*)\b",
    "Hybrid": r"\bhybrid\b",
    "On-site": r"\b(on-?site|in-?office|in office)\b",
    "401(k)": r"401\(?k",
    "Health insurance": r"\b(health|medical) (insurance|benefits|coverage|plan)",
    "Paid time off": r"\b(pto|paid time off|vacation)\b",
    "Tuition help": r"\b(tuition|education assistance)",
    "Parental leave": r"\b(parental|maternity|paternity) leave",
    "Equity": r"\b(equity|stock|rsu)\b",
    "Leadership": r"\b(leadership|lead a team|leading teams)",
    "Teamwork or collaboration": r"\b(collaborat|teamwork|team player|cross-functional)",
    "Creativity or innovation": r"\b(creativ|innovat)",
    "Communication": r"communicat",
    "Empathy, EQ, adaptability": r"\b(empath|emotional intelligence|adaptab)",
    "Problem solving": r"problem[- ]solving",
    "Intense language": r"(fast-paced|fast paced|high-pressure|hustle|thrive under pressure)",
    "Balance language": r"(work-life balance|work/life balance|flexib\w+ schedule|flexible work)",
    "SQL": r"\bsql\b", "Python": r"\bpython\b", "Excel": r"\bexcel\b",
    "Cloud": r"\b(aws|azure|gcp|google cloud)\b", "Compliance": r"\b(compliance|regulatory|audit)\b",
    "Supply chain": r"\b(supply chain|logistics|procurement|inventory)\b",
    "Contract / 1099 / freelance": r"(1099|independent contractor|freelanc|contract-to-hire|\bcontractor\b)",
    "Part-time / temporary": r"(part-time|part time|per diem|temporary)",
}

def load(paths):
    rows = []
    for p in paths:
        for line in open(p):
            if line.strip(): rows.append(json.loads(line))
    return rows

def main():
    paths = sys.argv[1:] or sorted(glob.glob(os.path.join(HERE, "out", "*.jsonl")))
    rows = load(paths)
    n = len(rows)
    if not n: sys.exit("no rows")
    text = [((r.get("title") or "") + " " + (r.get("description") or "")).lower() for r in rows]
    print(f"{n} postings, {len({r['employer'] for r in rows})} employers, avg text length {sum(len(t) for t in text)//n} chars")
    pay = [r for r in rows if r.get("pay_min")]
    print(f"stated pay: {len(pay)} ({100*len(pay)/n:.1f}%)")
    if pay:
        yr = [r for r in pay if r.get("pay_period") == "year"]
        if yr: print(f"  annual: n={len(yr)} avg low ${sum(r['pay_min'] for r in yr)/len(yr):,.0f} avg high ${sum(r['pay_max'] for r in yr)/len(yr):,.0f}")
    print("arrangement:", dict(Counter(r.get("arrangement") for r in rows)))
    print("by employer:", dict(Counter(r["employer"] for r in rows)))
    print(f"{'signal':32}{'postings':>9}{'share':>8}")
    for name, rx in SIGNALS.items():
        c = sum(1 for t in text if re.search(rx, t))
        print(f"{name:32}{c:>9}{100*c/n:>7.1f}%")

if __name__ == "__main__":
    main()
