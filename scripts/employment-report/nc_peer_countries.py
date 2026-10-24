#!/usr/bin/env python3
"""
NextChapter early-warning series, peer countries.

Pulls like-for-like advanced-economy comparisons for the monthly White Collar
Employment Report. Public sources only, no keys:

  OECD  monthly unemployment rate, seasonally adjusted, ages 15-24 and 15+
        (DF_IALFS_UNE_M), plus annual unemployment by education for ages 25-34
        (DF_LSO_NEAC_UNEMP) and the share of the unemployed out 12+ months (DF_DUR_D)
  IMF   real GDP growth, annual, World Economic Outlook (NGDP_RPCH)
  Eurostat  share of enterprises with 10+ staff using AI (isoc_eb_ai, EU only)

Peer set: US, UK, Canada, Australia, Japan, Germany, France, Italy, Spain,
Netherlands, Sweden. Writes one JSON file read by /reports/early-warning.

Usage:
  python3 nc_peer_countries.py --out public/reports/early-warning-peers.json
"""
import argparse, csv, io, json, time, urllib.request
from datetime import datetime, timezone

# ISO3 for OECD/IMF, ISO2 for Eurostat
PEERS = {"USA": "US", "GBR": "UK", "CAN": "CA", "AUS": "AU", "JPN": "JP",
         "DEU": "DE", "FRA": "FR", "ITA": "IT", "ESP": "ES", "NLD": "NL", "SWE": "SE"}
NAMES = {"USA": "United States", "GBR": "United Kingdom", "CAN": "Canada", "AUS": "Australia",
         "JPN": "Japan", "DEU": "Germany", "FRA": "France", "ITA": "Italy", "ESP": "Spain",
         "NLD": "Netherlands", "SWE": "Sweden"}
OECD = "https://sdmx.oecd.org/public/rest/data/"

def get(url, tries=3):
    # The IMF API returns 403 to custom and browser-style User-Agents but serves
    # the default one; the OECD API does the opposite. Pick per host.
    headers = {} if "imf.org" in url else {"User-Agent": "NextChapter Research"}
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read().decode()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(3 * (i + 1))

def rows(url):
    return list(csv.DictReader(io.StringIO(get(url))))

def num(v):
    try: return float(v)
    except (TypeError, ValueError): return None

def monthly_unemployment(start):
    keys = "+".join(PEERS)
    url = (f"{OECD}OECD.SDD.TPS,DSD_LFS@DF_IALFS_UNE_M,1.0/{keys}.UNE_LF_M.PT_LF_SUB._Z.Y._T."
           f"Y15T24+Y_GE15._Z.M?startPeriod={start}&format=csvfile")
    out = {}
    for r in rows(url):
        v = num(r["OBS_VALUE"])
        if v is None: continue
        d = out.setdefault(r["REF_AREA"], {}).setdefault(r["TIME_PERIOD"], {})
        d["youth" if r["AGE"] == "Y15T24" else "total"] = round(v, 2)
    return {c: [dict(month=m, **v) for m, v in sorted(s.items()) if "youth" in v and "total" in v]
            for c, s in out.items()}

def education_unemployment():
    rs = rows(f"{OECD}OECD.EDU.IMEP,DSD_EAG_LSO_EA@DF_LSO_NEAC_UNEMP,1.0/all?startPeriod=2019&format=csvfile")
    pick = {}
    for r in rs:
        if (r["REF_AREA"] in PEERS and r["SEX"] == "_T" and r["AGE"] == "Y25T34"
                and r["EDUCATION_FIELD"] == "_T" and r["STATISTICAL_OPERATION"] == "OBS"
                and r["MEASURE"] == "UNEMPLOYMENT" and r["ATTAINMENT_LEV"] in ("ISCED11A_5T8", "ISCED11A_3_4")):
            v = num(r["OBS_VALUE"])
            if v is not None:
                pick.setdefault(r["REF_AREA"], {}).setdefault(r["TIME_PERIOD"], {})[
                    "tertiary" if r["ATTAINMENT_LEV"] == "ISCED11A_5T8" else "upper_secondary"] = round(v, 2)
    return {c: [dict(year=y, **v) for y, v in sorted(s.items()) if len(v) == 2] for c, s in pick.items()}

def long_term_share():
    keys = "+".join(PEERS)
    rs = rows(f"{OECD}OECD.ELS.SAE,DSD_DUR@DF_DUR_D,1.0/{keys}......?startPeriod=2019&format=csvfile")
    lv = {}
    for r in rs:
        if r["SEX"] == "_T" and r["AGE"] == "_T" and r["DURATION"] in ("Y_GE1", "TOTD"):
            v = num(r["OBS_VALUE"])
            if v is not None: lv.setdefault(r["REF_AREA"], {}).setdefault(r["TIME_PERIOD"], {})[r["DURATION"]] = v
    return {c: [dict(year=y, share_12m_plus=round(100 * d["Y_GE1"] / d["TOTD"], 1))
                for y, d in sorted(s.items()) if "Y_GE1" in d and d.get("TOTD")] for c, s in lv.items()}

def gdp_growth():
    import json as j
    raw = j.loads(get("https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH/" + "/".join(PEERS)))
    vals = raw["values"]["NGDP_RPCH"]
    return {c: {y: round(v, 2) for y, v in vals.get(c, {}).items() if int(y) >= 2015} for c in PEERS}

def ai_adoption():
    # Eurostat ignores most filter parameters on this dataset, so filter on the columns.
    url = ("https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/isoc_eb_ai?format=SDMX-CSV"
           "&startPeriod=2021")
    inv = {"DE": "DEU", "FR": "FRA", "IT": "ITA", "ES": "ESP", "NL": "NLD", "SE": "SWE"}
    out = {}
    for r in rows(url):
        if (r["size_emp"] == "GE10" and r["nace_r2"] == "C10-S951_X_K" and r["indic_is"] == "E_AI_TANY"
                and r["unit"] == "PC_ENT" and r["geo"] in inv):
            v = num(r["OBS_VALUE"])
            if v is not None: out.setdefault(inv[r["geo"]], {})[r["TIME_PERIOD"]] = round(v, 1)
    return out

def us_ai_use():
    """Share of US businesses using AI in the last two weeks, Census Business Trends and
    Outlook Survey (biweekly). Needs openpyxl; skipped (empty list) without it."""
    try:
        import openpyxl, tempfile
    except ImportError:
        return []
    req = urllib.request.Request("https://www.census.gov/hfp/btos/downloads/National.xlsx",
                                 headers={"User-Agent": "NextChapter Research"})
    with tempfile.NamedTemporaryFile(suffix=".xlsx") as tf:
        tf.write(urllib.request.urlopen(req, timeout=120).read()); tf.flush()
        wb = openpyxl.load_workbook(tf.name, read_only=True, data_only=True)
        ends = {str(r[3]): r[5] for r in wb["Collection and Reference Dates"].iter_rows(min_row=2, values_only=True)
                if r[3] and r[5]}
        rs = list(wb["Response Estimates"].iter_rows(values_only=True))
    head = rs[0]
    row = next(r for r in rs[1:] if r[0] == 7 and r[2] == 1)
    out = []
    for h, v in zip(head[4:], row[4:]):
        if h is None or not isinstance(v, str) or not v.endswith("%") or str(h) not in ends: continue
        out.append(dict(period_end=ends[str(h)].strftime("%Y-%m-%d"), pct=round(float(v[:-1]), 1)))
    return sorted(out, key=lambda x: x["period_end"])

def main():
    p = argparse.ArgumentParser(); p.add_argument("--start", default="2015-01")
    p.add_argument("--out", default="public/reports/early-warning-peers.json")
    a = p.parse_args()
    data = dict(
        generated=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        names=NAMES,
        sources=dict(
            unemployment="OECD Short-Term Labour Market Statistics (monthly, seasonally adjusted)",
            education="OECD Education at a Glance, unemployment by attainment, ages 25-34",
            duration="OECD unemployment by duration (12+ months)",
            gdp="IMF World Economic Outlook, real GDP growth (latest-year values are IMF estimates)",
            ai_us="US Census Bureau Business Trends and Outlook Survey, share of businesses using AI in the last two weeks",
            ai="Eurostat isoc_eb_ai, enterprises with 10+ staff using any AI technology (EU only)"),
        unemployment=monthly_unemployment(a.start),
        education=education_unemployment(),
        long_term=long_term_share(),
        gdp=gdp_growth(),
        ai_adoption=ai_adoption(),
        us_ai_use=us_ai_use(),
    )
    with open(a.out, "w") as f:
        json.dump(data, f, indent=1)
    print({k: len(v) for k, v in data.items() if isinstance(v, dict)})

if __name__ == "__main__":
    main()
