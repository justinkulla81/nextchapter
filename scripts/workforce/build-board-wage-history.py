#!/usr/bin/env python3
"""
Private-sector employment and average annual pay by NAICS sector, 2015 to the latest year, for each workforce board's area.

Source (public, BLS Quarterly Census of Employment and Wages, free to reuse): the annual single-file downloads
  https://data.bls.gov/cew/data/files/<year>/csv/<year>_annual_singlefile.zip     (one zip a year, 60 to 85 MB)
and the area titles
  https://data.bls.gov/cew/doc/titles/area/area_titles.csv
Boards come from the WorkforceBoard table (id, state, statewide, counties as lower-case names without "County"/"Parish"), exported
to a JSON list beforehand (boards.json). A board's value is the sum over its counties: employment = sum of annual average
employment; average pay = sum of total annual wages / sum of employment (employment-weighted, not an average of county averages).
A county is left out of a year when BLS withholds it (disclosure code N) or reports zero employment for that sector; the board's
figure then covers the counties reported, and `n` says how many of the board's counties each year's figure rests on.
Connecticut: BLS replaced its eight counties with nine planning regions in recent files, so Connecticut boards are not built.

  python3 scripts/workforce/build-board-wage-history.py --dir <folder with <year>.zip and area_titles.csv> \
      --boards <boards.json> --out src/lib/workforce/data/board-wage-history.json
Reads each zip once as a stream; takes a few minutes. Not run on a request path: the output is bundled.
"""
import argparse, json, re, subprocess, sys

SECTORS = {
    "10": "All private industries", "23": "Construction", "31-33": "Manufacturing", "44-45": "Retail trade",
    "51": "Information", "52": "Finance and insurance", "54": "Professional, scientific and technical services",
    "55": "Management of companies", "56": "Administrative and waste services", "61": "Educational services",
    "62": "Health care and social assistance", "72": "Accommodation and food services",
}
NAME_FIX = {"dade": "miamidade", "stlouiscity": "stlouiscity"}

def norm(s):
    s = s.lower()
    s = re.sub(r"\b(county|parish|borough|census area|municipality)\b", "", s)
    return re.sub(r"[^a-z]", "", s)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True); ap.add_argument("--boards", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--from-year", type=int, default=2015); ap.add_argument("--to-year", type=int, required=True)
    a = ap.parse_args()
    years = list(range(a.from_year, a.to_year + 1))

    # county fips by state + normalized name, from the BLS area titles ("Autauga County, Alabama")
    import csv
    ABBR = {"Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE","District of Columbia":"DC","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"}
    counties = {}  # (state, normname) -> fips
    by_state = {}  # state -> [fips]
    for r in csv.DictReader(open(f"{a.dir}/area_titles.csv", encoding="utf-8", errors="ignore")):
        f, t = r["area_fips"], r["area_title"]
        if not re.fullmatch(r"\d{5}", f) or f.endswith("000") or "," not in t: continue
        name, st = t.rsplit(",", 1); st = ABBR.get(st.strip())
        if not st: continue
        counties[(st, norm(name))] = f; by_state.setdefault(st, []).append(f)

    boards = json.load(open(a.boards))
    board_fips, skipped = {}, []
    for b in boards:
        st = b["state"]
        if st == "CT": skipped.append((b["id"], "CT geography changed")); continue
        if b.get("statewide"): fl = list(by_state.get(st, []))
        else:
            fl = []
            for c in b.get("counties") or []:
                k = NAME_FIX.get(norm(c), norm(c)); f = counties.get((st, k)) or counties.get((st, k + "city"))
                if f: fl.append(f)
        if fl: board_fips[b["id"]] = sorted(set(fl))
        else: skipped.append((b["id"], "no counties matched"))
    need = {f for fl in board_fips.values() for f in fl}
    print(f"{len(board_fips)} boards, {len(need)} counties needed, {len(skipped)} skipped", file=sys.stderr)

    # county x sector x year -> (employment, wages)
    data = {}
    for y in years:
        p = subprocess.Popen(["unzip", "-p", f"{a.dir}/{y}.zip"], stdout=subprocess.PIPE, text=True, bufsize=1 << 20)
        n = 0
        for line in p.stdout:
            if not line.startswith('"'): continue
            f = line.split('","', 4)
            fips = f[0][1:]
            if fips not in need: continue
            own, ind = f[1], f[2]
            if own != "5" and not (own == "5"): continue
            if ind not in SECTORS: continue
            cols = line.rstrip("\n").split(",")
            # columns: 0 fips 1 own 2 industry 3 agglvl 4 size 5 year 6 qtr 7 disclosure 8 estabs 9 emplvl 10 total wages
            if cols[4].strip('"') != "0" or cols[7].strip('"') == "N": continue
            try: e, w = int(cols[9]), int(cols[10])
            except ValueError: continue
            if e <= 0: continue
            data[(fips, ind, y)] = (e, w); n += 1
        p.wait(); print(y, n, "rows kept", file=sys.stderr)

    out = {"source": "BLS Quarterly Census of Employment and Wages, annual averages, private ownership; built from the public annual single files",
           "years": years, "sectors": SECTORS, "boards": {}}
    for bid, fl in board_fips.items():
        series = {}
        for ind in SECTORS:
            e_l, p_l, n_l = [], [], []
            for y in years:
                es = ws = k = 0
                for f in fl:
                    v = data.get((f, ind, y))
                    if v: es += v[0]; ws += v[1]; k += 1
                e_l.append(es or None); p_l.append(round(ws / es) if es else None); n_l.append(k)
            if any(e_l): series[ind] = {"e": e_l, "p": p_l, "n": n_l}
        if series: out["boards"][bid] = {"counties": len(fl), "s": series}
    json.dump(out, open(a.out, "w"), separators=(",", ":"))
    json.dump(skipped, open(a.out + ".skipped.json", "w"))
    print(f"wrote {a.out}: {len(out['boards'])} boards", file=sys.stderr)

main()
