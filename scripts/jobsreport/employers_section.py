#!/usr/bin/env python3
"""Renders the "Employers" section of a jobs report from an employer-rankings JSON (database function jobsfeed_employer_rankings).
  python3 scripts/jobsreport/employers_section.py docs/jobs-report/snapshots/employer-rankings-2026-10-national.json > employers.md
Owner rules: no layoffs by employer; staffing and search firms excluded; no month-over-month or year-over-year change per employer
until six or more monthly snapshots exist; figures are labeled "among jobs NextChapter tracks"."""
import json, sys

def table(head, rows):
    return "\n".join(["| " + " | ".join(head) + " |", "|" + "---|" * len(head)] + ["| " + " | ".join(str(c) for c in r) + " |" for r in rows])

def render(d, place=None, top=10, fn_top=5, top_lists="https://launchyournextchapter.com/top-employers"):
    where = place or "the United States"
    n = lambda x: f"{x:,}"
    ent = [(e["name"], n(e["entry"]), n(e["open"])) for e in d["entry"][:top]]
    noe = [(e["name"], n(e["no_exp"]), n(e["entry"])) for e in d["no_exp"][:top] if e["no_exp"] > 0]
    aic = [(e["name"], n(e["ai_skill"]), n(e["open"])) for e in d["ai_count"][:top]]
    ais = [(e["name"], f"{e['share_pct']}%", n(e["open"])) for e in d["ai_share"][:top]]
    out = [f"## Employers\n\nWho is hiring in {where}, among jobs NextChapter tracks ({n(d['total_open'])} open white-collar jobs, {n(d['total_entry'])} of them entry-level). These are counts of openings, not a ranking of employer quality, and the tracked set is not every job in {where}.\n"]
    out += ["### Most entry-level jobs\n", table(["Employer", "Entry-level jobs", "All open jobs"], ent), ""]
    if noe: out += ["### Most jobs where no experience is needed\n", "A narrower count than entry-level: the posting itself says people without experience are welcome.\n", table(["Employer", "No experience needed", "Entry-level jobs"], noe), ""]
    out += ["### Most jobs asking for AI skills\n", table(["Employer", "Jobs asking for AI skills", "All open jobs"], aic), ""]
    if ais: out += ["### Highest share of jobs asking for AI skills\n", "Employers with 25 or more open jobs.\n", table(["Employer", "Share asking for AI skills", "All open jobs"], ais), ""]
    fx = d.get("functions") or []
    if fx:
        out += ["### Top hiring employers by function\n"]
        for f in fx:
            es = f["employers"][:fn_top]
            if es: out.append(f"**{f['function']}** ({n(f['open'])} open): " + "; ".join(f"{e['name']} {n(e['open'])}" for e in es) + "\n")
    out += [f"### Method\n\nEmployer lists exclude staffing and search firms, because they post for other employers. Entry-level means roughly 0 to 3 years of experience, read from the title, the employer and the full posting. Employer names are as listed in postings, so a company that posts under several names can appear more than once. Counts are a snapshot of open jobs on {d['as_of']}; NextChapter began keeping employer history in October 2026, so this report makes no claim about change from a prior month or year for any employer. Full lists: {top_lists}."]
    return "\n".join(out)

if __name__ == "__main__":
    print(render(json.load(open(sys.argv[1]))))
