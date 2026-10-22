#!/usr/bin/env python3
"""
Add any U.S. metro to geos.json from public Census and GeoNames data. No model involved.

  python3 scripts/jobsreport/add_geo.py --name "Nashville, TN"            # finds the metro area by its principal city
  python3 scripts/jobsreport/add_geo.py --cbsa 34980 --key nashville --label "Nashville, TN"

Writes the metro's counties, its cities (each mapped to a county FIPS) and the BLS metro series code. Peers default to
metros you name with --peers (keys already in geos.json); without peers the report simply has no peer tables.
Sources: Census CBSA delineation file (July 2023), GeoNames US places, BLS LAUS metro series.
"""
import argparse, io, json, os, re, sys, urllib.request, zipfile
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "out", "census-cache"); os.makedirs(CACHE, exist_ok=True)
UA = "NextChapterResearch/1.0 (research@launchyournextchapter.com)"
DELIN = "https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx"
GEONAMES = "https://download.geonames.org/export/dump/US.zip"
ABBR = {"Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE","District of Columbia":"DC","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"}

def cached(name, url):
    p = os.path.join(CACHE, name)
    if not os.path.exists(p):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=300) as r, open(p, "wb") as f:
            while chunk := r.read(1 << 20): f.write(chunk)
    return p

def delineation():
    import openpyxl
    rows = []
    ws = openpyxl.load_workbook(cached("list1_2023.xlsx", DELIN), read_only=True).active
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i >= 3 and r and r[0] and r[4] and str(r[4]).startswith("Metropolitan"):
            rows.append({"cbsa": str(r[0]), "title": r[3], "county": str(r[7]), "state": r[8], "st": str(r[9]), "co": str(r[10])})
    return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", help='principal city and state, e.g. "Nashville, TN"'); ap.add_argument("--cbsa"); ap.add_argument("--key"); ap.add_argument("--label")
    ap.add_argument("--peers", default=""); ap.add_argument("--min-pop", type=int, default=0)
    a = ap.parse_args()
    rows = delineation()
    if a.cbsa: cbsa = a.cbsa
    else:
        city, st = [x.strip() for x in a.name.split(",")]
        hit = [r for r in rows if r["title"].split(",")[0].split("-")[0].lower() == city.lower() and st.upper() in r["title"].split(",")[1]]
        hit = hit or [r for r in rows if city.lower() in r["title"].split(",")[0].lower() and st.upper() in r["title"].split(",")[1]]
        if not hit: sys.exit(f"no metropolitan area found for {a.name}")
        cbsa = hit[0]["cbsa"]
    members = [r for r in rows if r["cbsa"] == cbsa]
    if not members: sys.exit(f"CBSA {cbsa} not found")
    title = members[0]["title"]; principal = title.split(",")[0].split("-")[0]
    states = sorted({ABBR[r["state"]] for r in members}); first_state = title.split(",")[1].strip().split("-")[0]
    state_fips = next(r["st"] for r in members if ABBR[r["state"]] == first_state)
    counties = {f"{r['st']}{r['co']}": r["county"] for r in members}
    by_state_co = {(r["st"], r["co"]): f"{r['st']}{r['co']}" for r in members}
    st_of_fips = {r["st"]: ABBR[r["state"]] for r in members}
    cities = {}
    with zipfile.ZipFile(cached("US.zip", GEONAMES)) as z, z.open("US.txt") as f:
        for line in f:
            p = line.decode("utf-8", "replace").split("\t")
            if p[6] != "P" or p[10] not in states: continue
            fips = next((v for (s, c), v in by_state_co.items() if st_of_fips[s] == p[10] and c == p[11]), None)
            if not fips: continue
            if int(p[14] or 0) < a.min_pop and p[1].lower() != principal.lower(): continue
            cities.setdefault(p[1].lower(), fips)
    for r in members:   # a county named in a posting ("Williamson County, TN") resolves exactly
        pass
    key = a.key or re.sub(r"[^a-z0-9]+", "-", principal.lower()).strip("-")
    geos = json.load(open(os.path.join(HERE, "geos.json")))
    entry = {"label": a.label or f"{principal}, {first_state}", "include": principal.lower(), "exclude": "^$",
             "countyFips": sorted(counties), "stateFips": state_fips, "cbsa": cbsa,
             "peers": [p for p in a.peers.split(",") if p], "cities": dict(sorted(cities.items())),
             "counties": {re.sub(r" county$| parish$| borough$", "", n.lower()): f for f, n in counties.items()},
             "states": states, "search": principal, "defaultLocation": f"{principal}, {first_state}"}
    geos[key] = entry
    json.dump(geos, open(os.path.join(HERE, "geos.json"), "w"), indent=2)
    print(f"added {key}: {title}; {len(counties)} counties, {len(cities)} places, states {states}")

if __name__ == "__main__":
    main()
