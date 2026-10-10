#!/usr/bin/env python3
"""Exports search firms from the ncrawl crawler as JSON for import.ts.

Reads, from ~/nextchapter-jobs (override with NCRAWL_DIR):
  - sources.yaml: every `sf:` source (name, homepage)
  - data/jobs.db: each source's live search count and sample titles
  - data/search_firms/firms.csv, when present: the bulk firm list
    (columns name, domain, homepage/website, and optionally segment/type/model)

Usage: python3 scripts/search-firms/export-firms.py > firms.json
"""
import csv, json, os, re, sqlite3, sys
import yaml

ROOT = os.path.expanduser(os.environ.get("NCRAWL_DIR", "~/nextchapter-jobs"))


def domain_of(url):
    if not url:
        return None
    host = re.sub(r"^[a-z]+://", "", url.strip().lower()).split("/")[0]
    host = re.sub(r"^www\.", "", host)
    return host if "." in host else None


src = yaml.safe_load(open(os.path.join(ROOT, "sources.yaml")))
src = src if isinstance(src, list) else src.get("sources", [])
firms = {}
for s in src:
    sid = str(s.get("id", ""))
    if not sid.startswith("sf:"):
        continue
    home = s.get("homepage") or s.get("url")
    firms[sid] = {"sourceKey": sid, "name": s.get("name") or sid[3:], "website": home,
                  "domain": domain_of(home), "segmentHint": None, "liveSearchCount": 0, "sampleTitles": []}

db = sqlite3.connect(os.path.join(ROOT, "data", "jobs.db"))
rows = db.execute(
    "select source_id, source_name, title from jobs where active=1 and source_category='search_firm' "
    "order by source_id, coalesce(level_rank,0) desc, last_seen desc"
).fetchall()
for sid, sname, title in rows:
    f = firms.setdefault(sid, {"sourceKey": sid, "name": sname, "website": None, "domain": None,
                               "segmentHint": None, "liveSearchCount": 0, "sampleTitles": []})
    f["liveSearchCount"] += 1
    if title and len(f["sampleTitles"]) < 5 and title not in f["sampleTitles"]:
        f["sampleTitles"].append(title)

csv_path = os.path.join(ROOT, "data", "search_firms", "firms.csv")
csv_rows = 0
if os.path.exists(csv_path):
    known_domains = {f["domain"] for f in firms.values() if f["domain"]}
    for r in csv.DictReader(open(csv_path, newline="", encoding="utf-8", errors="ignore")):
        r = {(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
        name = r.get("name") or r.get("firm") or r.get("firm_name")
        if not name:
            continue
        home = r.get("homepage") or r.get("website") or r.get("url")
        dom = (r.get("domain") or domain_of(home) or "").lower() or None
        if dom and dom in known_domains:
            continue  # already an ncrawl source
        key = f"csv:{dom or re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')}"
        firms[key] = {"sourceKey": key, "name": name, "website": home or (f"https://{dom}" if dom else None),
                      "domain": dom, "segmentHint": r.get("segment") or r.get("type") or r.get("model") or r.get("category"),
                      "liveSearchCount": int(live) if (live := r.get("live_searches") or r.get("live_jobs") or "0").isdigit() else 0,
                      "sampleTitles": [t for t in (r.get("sample_titles") or "").split("|") if t][:5]}
        csv_rows += 1
        if dom:
            known_domains.add(dom)

print(json.dumps(sorted(firms.values(), key=lambda f: (-f["liveSearchCount"], f["name"])), indent=1))
print(f"{len(firms)} firms ({csv_rows} from firms.csv, {sum(1 for f in firms.values() if f['liveSearchCount'])} with live searches)", file=sys.stderr)
