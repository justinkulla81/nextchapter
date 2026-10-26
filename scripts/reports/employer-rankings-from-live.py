#!/usr/bin/env python3
"""
Snapshot of the public employer rankings (https://launchyournextchapter.com/top-employers and each function page) as JSON
and Markdown tables, for the monthly report. Reads only the public pages, so it works where scripts/reports/employer-rankings-snapshot.ts
cannot run (no database connection). The page tables are the same queries as that script, cut at the page's length (25 on the hub,
15 per function).

  python3 scripts/reports/employer-rankings-from-live.py data/employer-rankings
Writes <outDir>/<yyyy-mm-dd>.json (the as-of date on the page) and <outDir>/<yyyy-mm-dd>.md.
Save every month's file: the rankings have no history before October 2026, so no change claim is possible until there are 6+ snapshots.
"""
import html, json, os, re, sys, time, urllib.request

BASE = "https://launchyournextchapter.com/top-employers"
UA = {"User-Agent": "NextChapter Research (justin@launchyournextchapter.com)"}
NAMES = {"data-and-analytics": "Data and analytics", "customer-success": "Customer success", "executive-leadership": "Executive leadership",
         "fundraising-and-development": "Fundraising and development", "human-resources": "Human resources"}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf-8", "replace")

def clean(x):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", x))).strip()

def tables(h):
    out = []
    for t in re.findall(r"<table.*?</table>", h, re.S):
        head = [clean(c) for c in re.findall(r"<th[^>]*>(.*?)</th>", t, re.S)]
        rows = [[clean(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", r, re.S)] for r in re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S)]
        out.append({"head": head, "rows": [r for r in rows if r]})
    return out

def md_table(t, n, cols):
    lines = ["| # | Employer | " + " | ".join(t["head"][i] for i in cols) + " |", "|---|---|" + "|".join("---:" for _ in cols) + "|"]
    lines += ["| " + r[0] + " | " + r[1] + " | " + " | ".join(r[i] for i in cols) + " |" for r in t["rows"][:n]]
    return "\n".join(lines)

def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "data/employer-rankings"
    hub = get(BASE)
    text = clean(re.sub(r"<script.*?</script>|<style.*?</style>", " ", hub, flags=re.S))
    m = re.search(r"Counted from ([\d,]+) verified open jobs on ([A-Za-z]+) (\d+), (\d{4}); ([\d,]+) \((\d+)%\) are entry-level", text)
    if not m:
        sys.exit("Could not read the totals line on the hub page; the page layout changed.")
    months = "January February March April May June July August September October November December".split()
    as_of = f"{m.group(4)}-{months.index(m.group(2)) + 1:02d}-{int(m.group(3)):02d}"
    hub_tables = tables(hub)
    if len(hub_tables) < 4:
        sys.exit("Expected four ranking tables on the hub page.")
    slugs = sorted(set(re.findall(r'href="/top-employers/([a-z0-9-]+)"', hub)))
    fns = {}
    for s in slugs:
        h = get(f"{BASE}/{s}")
        tx = clean(re.sub(r"<script.*?</script>|<style.*?</style>", " ", h, flags=re.S))
        mm = re.search(r"([\d,]+) verified open ", tx)
        ts = tables(h)
        fns[s] = {"total_open": mm.group(1) if mm else None, "table": ts[0] if ts else None}
        time.sleep(0.3)
    data = {"as_of": as_of, "source": "public pages " + BASE, "total_open": m.group(1), "entry_total": m.group(5), "entry_pct": m.group(6),
            "entry": hub_tables[0], "no_experience": hub_tables[1], "ai_share": hub_tables[2], "ai_count": hub_tables[3], "functions": fns}
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, f"{as_of}.json"), "w") as f:
        json.dump(data, f, indent=1); f.write("\n")
    md = [f"# Employer rankings, {as_of}", f"{m.group(1)} verified open jobs; {m.group(5)} entry-level or early-career. Staffing and search firms excluded.",
          "## Most entry-level jobs", md_table(hub_tables[0], 25, [2, 3]), "## Most jobs needing no experience", md_table(hub_tables[1], 25, [2, 3, 4]),
          "## Highest share asking for AI skills", md_table(hub_tables[2], 25, [2, 3, 4]), "## Most jobs asking for AI skills", md_table(hub_tables[3], 25, [2, 3, 4])]
    for s, v in fns.items():
        if v["table"]:
            md += [f"## {NAMES.get(s, s.replace('-', ' ').capitalize())}: most open jobs ({v['total_open']} total)", md_table(v["table"], 15, [2, 3, 4])]
    with open(os.path.join(out_dir, f"{as_of}.md"), "w") as f:
        f.write("\n\n".join(md) + "\n")
    print(f"Wrote {out_dir}/{as_of}.json and .md ({len(fns)} functions)")

main()
