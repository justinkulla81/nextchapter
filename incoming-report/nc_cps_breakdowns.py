#!/usr/bin/env python3
"""
NextChapter CPS breakdowns for the monthly Displacement Report.

Compares two pooled periods (default: Jan..latest month of this year vs the same
months last year) from Census CPS basic monthly microdata and reports, for each group:
  unemployment rate, share of unemployed out 27+ weeks, median weeks unemployed,
  how long the long-term unemployed have been out (27-51 wks, 1-2 yrs, 2+ yrs),
  average long-term duration, and the unweighted count of unemployed respondents.

Groups: all workers; white-collar; white-collar 50+; blue-collar (PRMJOCC1 7-10);
recent graduates 22-27 with a bachelor's+ and 22-27 with high school only; participation and
self-employment (PEIO1COW 6-7) for all, 55+ and 65+; (PRMJOCC1 in 1,2); detailed occupation of last job
(PRDTOCC1); industry of last job (PRMJIND1), all and white-collar; age groups, all and
white-collar.  Not seasonally adjusted.  PRUNEDUR is top-coded at 119 weeks.
Suppress any group with fewer than ~100 unemployed respondents in a period.

Usage:
  export CENSUS_API_KEY=...
  python3 nc_cps_breakdowns.py --year 2026 --through 8 --out breakdowns.json
"""
import argparse, json, os, urllib.parse, urllib.request
MON = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]
VARS = "PWCMPWGT,PEMLR,PRUNEDUR,PRMJOCC1,PRDTOCC1,PRMJIND1,PRTAGE,PEEDUCA,PEIO1COW"

def fetch(y, m, key):
    q = urllib.parse.urlencode({"get": VARS, "key": key})
    try:
        with urllib.request.urlopen(f"https://api.census.gov/data/{y}/cps/basic/{MON[m-1]}?{q}", timeout=120) as r:
            body = r.read().decode()
            return json.loads(body) if body.startswith("[") else None
    except urllib.error.HTTPError:
        return None

def age_bucket(a, wc):
    if wc:
        return "wc_age_" + ("under35" if a < 35 else "35_44" if a < 45 else "45_54" if a < 55 else "55_64" if a < 65 else "65plus")
    return "age_" + ("16_24" if a < 25 else "25_34" if a < 35 else "35_44" if a < 45 else "45_54" if a < 55 else "55_64" if a < 65 else "65plus")

def accumulate(acc, rows):
    h = rows[0]; ix = {n: h.index(n) for n in h}
    for r in rows[1:]:
        try:
            w = float(r[ix["PWCMPWGT"]]); l = int(r[ix["PEMLR"]])
        except ValueError:
            continue
        if w <= 0 or l < 1:
            continue
        age = int(r[ix["PRTAGE"]]); edu = int(r[ix["PEEDUCA"]]); cow = int(r[ix["PEIO1COW"]])
        # Population-based measures (labor force participation, self-employment) use everyone 16+.
        for k in (["pop_55plus"] if age >= 55 else []) + (["pop_65plus"] if age >= 65 else []) + ["pop_all"]:
            pa = acc.setdefault(k, dict(pop=0.0, lf=0.0, emp=0.0, se=0.0))
            pa["pop"] += w
            if l <= 4: pa["lf"] += w
            if l <= 2:
                pa["emp"] += w
                if cow in (6, 7): pa["se"] += w
        if l > 4:
            continue
        un = l >= 3; dur = int(r[ix["PRUNEDUR"]])
        occ = int(r[ix["PRMJOCC1"]]); docc = int(r[ix["PRDTOCC1"]]); ind = int(r[ix["PRMJIND1"]])
        wc = occ in (1, 2)
        keys = ["all", age_bucket(age, False)]
        if 7 <= occ <= 10: keys.append("bluecollar")
        if 22 <= age <= 27 and edu >= 43: keys.append("grads_22_27_ba")
        if 22 <= age <= 27 and edu == 39: keys.append("hs_22_27")
        if wc and age >= 50: keys.append("wc_50plus")
        if docc > 0: keys.append(f"occ_{docc}")
        if ind > 0: keys.append(f"ind_{ind}")
        if wc:
            keys += ["wc", age_bucket(age, True)]
            if ind > 0: keys.append(f"wc_ind_{ind}")
        for k in keys:
            a = acc.setdefault(k, dict(lf=0.0, u=0.0, ltu=0.0, b1=0.0, b2=0.0, b3=0.0, ltusum=0.0, durs=[], n=0))
            a["lf"] += w
            if un:
                a["u"] += w; a["n"] += 1; a["durs"].append((dur, w))
                if dur >= 27:
                    a["ltu"] += w; a["ltusum"] += dur * w
                    a["b1" if dur < 52 else "b2" if dur < 104 else "b3"] += w

def summarize(acc, months):
    out = {}
    for k, a in acc.items():
        if "pop" in a:
            out[k] = dict(participation_rate=round(100*a["lf"]/a["pop"], 1),
                          self_employed_share=round(100*a["se"]/a["emp"], 1) if a["emp"] else None)
            continue
        if not a["u"]:
            continue
        a["durs"].sort(); c = 0; med = None
        for d, w in a["durs"]:
            c += w
            if c >= a["u"] / 2:
                med = d; break
        ltu = a["ltu"] or 1e-9
        out[k] = dict(unemployment_rate=round(100*a["u"]/a["lf"], 2), ltu_share=round(100*a["ltu"]/a["u"], 1),
                      median_weeks=med, ltu_27_51=round(100*a["b1"]/ltu, 1), ltu_1_2yrs=round(100*a["b2"]/ltu, 1),
                      ltu_2yrs_plus=round(100*a["b3"]/ltu, 1), ltu_avg_weeks=round(a["ltusum"]/ltu, 1),
                      ltu_thousands=round(a["ltu"]/months/1000), unemployed_respondents=a["n"],
                      reliable=a["n"] >= 100)
    return out

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--year", type=int, required=True); p.add_argument("--through", type=int, required=True)
    p.add_argument("--out", default="breakdowns.json")
    a = p.parse_args(); key = os.environ["CENSUS_API_KEY"]
    result = {}
    for label, y in (("current", a.year), ("prior", a.year - 1)):
        acc = {}; n = 0
        for m in range(1, a.through + 1):
            rows = fetch(y, m, key)
            if rows: accumulate(acc, rows); n += 1
        result[label] = {"year": y, "months": n, "groups": summarize(acc, max(n, 1))}
    json.dump(result, open(a.out, "w"), indent=1)
    print(f"wrote {a.out}")
