#!/usr/bin/env python3
"""Turn workday_discover.py output into a crawler sources file (one source per tenant and site, with how well the tenant matches the name).
  python3 scripts/jobsreport/pack_workday_sources.py found.jsonl sources/workday-<label>.json
"""
import json, re, sys
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from workday_discover import variants
rows = [json.loads(l) for l in open(sys.argv[1])]
seen, out = set(), []
for x in rows:
    if not x.get("site"): continue
    k = (x["tenant"], x["wd"], x["site"])
    if k in seen: continue
    seen.add(k)
    v = variants(x["employer"])
    strength = "strong" if v and x["tenant"] == v[0] else ("medium" if len(v) > 1 and x["tenant"] == v[1] else "weak")
    out.append({"name": "wd-" + re.sub(r"[^a-z0-9]+", "-", (x["tenant"] + "-" + x["site"]).lower()).strip("-"), "adapter": "workday", "tenant": x["tenant"], "wd": x["wd"],
                "site": x["site"], "type": "direct_ats", "employer": x["employer"], "boardTotal": x["total"], "nameMatch": strength})
json.dump(out, open(sys.argv[2], "w"), indent=1)
print(len(rows), "rows;", len({o["tenant"] for o in out}), "tenants;", len(out), "sites;", sum(o["boardTotal"] for o in out), "jobs")
