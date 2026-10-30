"""Rebuilds src/lib/ai-check/occupations.json (sitemap + popular jobs for /tools/ai-job-check) from the exposure CSV.
Usage: python3 scripts/seo/build-ai-check-index.py docs/data/ai_exposure_by_occupation_2026-10-22.csv > src/lib/ai-check/occupations.json
Keeps occupations with at least MIN_POSTINGS live postings, drops catch-all "All Other" titles, sorted by postings."""
import csv, json, sys
MIN_POSTINGS = 50
rows = []
for r in csv.DictReader(open(sys.argv[1])):
    if "All Other" in r["title_anthropic"] or int(r["live_postings"]) < MIN_POSTINGS:
        continue
    rows.append({"soc": r["soc"], "title": r["title_anthropic"], "postings": int(r["live_postings"])})
rows.sort(key=lambda x: -x["postings"])
json.dump(rows, sys.stdout, indent=1, ensure_ascii=False)
print()
