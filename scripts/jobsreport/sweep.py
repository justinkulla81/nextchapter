#!/usr/bin/env python3
"""
National employer registry sweep: the same employers' job systems searched for any place, so a new geo needs no hand-built list.

  python3 scripts/jobsreport/sweep.py --rebuild            # registry.json from every sources file (employers that hire in many places)
  python3 scripts/jobsreport/sweep.py --geo nashville      # sources/<geo>.sweep.json = registry minus what the geo already lists

Only systems that can be searched by place are included (Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Jibe, Phenom,
Oracle, UKG, Taleo, Cornerstone, Breezy, ApplicantPro, Amazon). Local-only systems (NEOGOV agencies, school-district boards,
one-city hospitals' portals) stay in each geo's own sources file.
"""
import argparse, glob, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
SEARCHABLE = {"workday", "greenhouse", "lever", "ashby", "smartrecruiters", "jibe", "phenom", "oracle", "amazon"}
def key(s): return (s["adapter"], s.get("tenant") or s.get("token") or s.get("company") or s.get("host") or s.get("agency") or s["name"], s.get("site"))
def load(p): return json.load(open(p)) if os.path.exists(p) else []
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--rebuild", action="store_true"); ap.add_argument("--geo")
    a = ap.parse_args(); reg_path = os.path.join(HERE, "registry.json")
    if a.rebuild:
        reg = {}
        for p in [os.path.join(HERE, "louisville_sources.json")] + sorted(glob.glob(os.path.join(HERE, "sources", "*.json"))):
            if p.endswith(".sweep.json"): continue
            for s in load(p):
                if s["adapter"] in SEARCHABLE and not s.get("all_local") and s.get("type") != "public_sector":
                    s = {k: v for k, v in s.items() if k not in ("search", "queries", "location")}
                    reg.setdefault(key(s), s)
        json.dump(sorted(reg.values(), key=lambda s: s["employer"]), open(reg_path, "w"), indent=2); print(len(reg), "employers in the registry")
    if a.geo:
        geos = json.load(open(os.path.join(HERE, "geos.json"))); g = geos[a.geo]
        own = load(os.path.join(HERE, "louisville_sources.json" if a.geo == "louisville-metro" else f"sources/{a.geo}.json"))
        have = {key(s) for s in own}
        out = []
        for s in load(reg_path):
            if key(s) in have: continue
            s = dict(s); s["name"] = "sw-" + s["name"].split("-", 1)[-1]
            if s["adapter"] == "amazon":   # Amazon wants "City, State name, USA" for the principal city
                from add_geo import ABBR
                full = {v: k for k, v in ABBR.items()}
                s["queries"] = [f"{g['search']}, {full[g['states'][0]]}, USA"]
            out.append(s)
        json.dump(out, open(os.path.join(HERE, "sources", f"{a.geo}.sweep.json"), "w"), indent=2)
        print(f"{len(out)} sweep sources for {a.geo}")
if __name__ == "__main__":
    main()
