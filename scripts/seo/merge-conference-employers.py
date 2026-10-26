"""Merges the per-batch employer lists (out-NN.json: [{conferenceId, name, role, year, sourceUrl}]) into
src/lib/events/conference-employers.json, {conferenceId: [{name, role, year, sourceUrl}]}.
Only keeps rows for published catalog conferences, https source pages, plain organization-looking names. Existing
entries for other conferences are kept; a conference present in the new files is replaced.
Usage: python3 scripts/seo/merge-conference-employers.py <dir with out*.json>"""
import glob, json, re, sys, os

catalog = {x["id"] for x in json.load(open("src/lib/events/catalog.json"))["rows"] if x["published"]}
dest = "src/lib/events/conference-employers.json"
data = json.load(open(dest)) if os.path.exists(dest) else {}
ROLES = {"SPONSOR", "EXHIBITOR", "SPEAKER", "ATTENDEE"}
# Pages that list an association-wide partner program or past speakers, not this event's own sponsors.
EXCLUDE = {"nsa-annual-conference", "assp-safety-conference", "conference-board-chro-summit", "assessment-institute-indianapolis"}
new = {}
for f in sorted(glob.glob(os.path.join(sys.argv[1], "out*.json"))):
    try:
        rows = json.load(open(f))
    except Exception as e:
        print("skip", f, e); continue
    for r in rows:
        cid, name, role = r.get("conferenceId"), (r.get("name") or "").strip(), r.get("role")
        url = r.get("sourceUrl") or ""
        if cid in EXCLUDE or cid not in catalog or role not in ROLES or not url.startswith("https://"): continue
        if not (2 <= len(name) <= 80) or re.fullmatch(r"[\d\W]+", name) or len(name.split()) > 8: continue
        year = r.get("year") if isinstance(r.get("year"), int) and 2024 <= r["year"] <= 2028 else None
        new.setdefault(cid, {})[(name.lower(), role)] = {"name": name, "role": role, "year": year, "sourceUrl": url}
for cid, rows in new.items():
    data[cid] = list(rows.values())[:60]
json.dump(data, open(dest, "w"), indent=0, ensure_ascii=False)
print(len(data), "conferences,", sum(len(v) for v in data.values()), "rows")
