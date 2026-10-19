#!/usr/bin/env python3
"""
Find an employer's CAREER site (not its corporate website) and the job system behind it.

Rule: discovery never judges an employer by its corporate site. Companies block bots on marketing pages but publish
jobs openly, so we look only at career hosts (careers.<domain>, jobs.<domain>, ...) and at the job-system links they
contain (Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Jibe/iCIMS, Oracle, Taleo, NEOGOV, Phenom, UKG, ...).

  python3 scripts/jobsreport/career_site.py --geo pittsburgh --file candidates/pittsburgh-wide.txt
  python3 scripts/jobsreport/career_site.py --names "Heritage Valley Health System,Duquesne University"

Writes out/career-sites-<geo>.json (every career host found and the systems it uses) and merges readable systems into
sources/<geo>.json. Identified requests only (NextChapter Research user agent).
"""
import argparse, json, os, re, sys, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from discover import variants, get, UA, HERE

PREFIXES = ["careers", "jobs", "employment", "apply", "work", "recruiting", "joinus", "talent", "hr"]
TLDS = ["com", "org", "edu", "net", "us"]
SYSTEMS = {
    "workday": r"https?://([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com/(?:[a-z]{2}-[A-Z]{2}/)?([A-Za-z0-9_-]+)",
    "greenhouse": r"(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io/(?:embed/job_board(?:/js)?\?for=)?([a-z0-9_-]+)",
    "lever": r"jobs\.lever\.co/([a-z0-9-]+)",
    "ashby": r"jobs\.ashbyhq\.com/([A-Za-z0-9._-]+)",
    "smartrecruiters": r"(?:jobs|careers)\.smartrecruiters\.com/([A-Za-z0-9_-]+)",
    "neogov": r"governmentjobs\.com/careers/([a-z0-9-]+)",
    "taleo": r"https?://([a-z0-9-]+\.taleo\.net)/careersection/([A-Za-z0-9_]+)",
    "oracle": r"https?://([a-z0-9.-]+\.oraclecloud\.com)/hcmUI/CandidateExperience/[a-z]+/sites/([A-Za-z0-9_]+)",
    "icims": r"https?://([a-z0-9-]+\.icims\.com)",
    "ukg": r"https?://(recruiting\d*\.ultipro\.com)/([A-Z0-9]+)/JobBoard/([0-9a-f-]+)",
    "successfactors": r"https?://([a-z0-9.-]*(?:successfactors\.(?:com|eu)|sapsf\.com))",
    "dayforce": r"https?://([a-z0-9-]+\.dayforcehcm\.com)/CandidatePortal/[a-z-]+/([A-Za-z0-9_-]+)",
    "adp": r"(recruiting\.adp\.com|workforcenow\.adp\.com)",
    "paylocity": r"recruiting\.paylocity\.com/recruiting/jobs/All/([0-9a-f-]+)",
    "avature": r"https?://([a-z0-9.-]+\.avature\.net)",
    "eightfold": r"https?://([a-z0-9-]+\.eightfold\.ai)",
    "jobvite": r"jobs\.jobvite\.com/([a-z0-9-]+)",
    "brassring": r"https?://([a-z0-9.]*brassring\.com)",
    "phenom": r"phenompeople|cdn\.phenompeople|phApp\.",
    "radancy_mcloud": r"m-cloud\.io|tmpwebeng|radancy",
    "jibe": r"jibeapply\.com|/api/jobs\?",
    "applitrack": r"applitrack\.com/([a-z0-9]+)",
    "tyler_ess": r"https?://([a-z0-9.-]+)/ess/[Ee]mployment[Oo]pportunities",
    "peopleadmin": r"https?://([a-z0-9.-]+\.peopleadmin\.com)",
}

def domains(name):
    out = []
    for v in variants(name)[:4]:
        for t in TLDS:
            out.append(f"{v}.{t}")
    return out

def fetch(url):
    code, body = get(url, accept="text/html", timeout=10)
    return code, body

def look(name):
    """Returns {employer, hosts:[{url, systems:{...}}]} for the career hosts that answer."""
    found = []
    for d in domains(name):
        for p in PREFIXES:
            url = f"https://{p}.{d}"
            code, body = fetch(url)
            if code == 200 and len(body) > 1500:
                found.append((url, body))
        if found: break
    hosts = []
    for url, body in found:
        systems = {}
        for k, pat in SYSTEMS.items():
            m = re.search(pat, body)
            if m: systems[k] = m.group(0)[:120] if k in ("phenom", "radancy_mcloud", "jibe") else [g for g in m.groups() if g] or m.group(0)[:120]
        hosts.append({"url": url, "systems": systems})
    return {"employer": name, "hosts": hosts}

def to_source(r):
    """A crawl.py source for the first career host whose system we can read, else None."""
    for h in r["hosts"]:
        s = h["systems"]; base = {"type": "direct_ats", "employer": r["employer"]}
        slug = re.sub(r"[^a-z0-9]+", "-", r["employer"].lower()).strip("-")
        if "workday" in s: t, wd, site = s["workday"]; return {"name": f"wd-{slug}", "adapter": "workday", "tenant": t, "wd": wd, "site": site, **base}
        if "greenhouse" in s: return {"name": f"gr-{slug}", "adapter": "greenhouse", "token": s["greenhouse"][0], **base}
        if "lever" in s: return {"name": f"lv-{slug}", "adapter": "lever", "token": s["lever"][0], **base}
        if "ashby" in s: return {"name": f"ab-{slug}", "adapter": "ashby", "token": s["ashby"][0], **base}
        if "smartrecruiters" in s: return {"name": f"sr-{slug}", "adapter": "smartrecruiters", "company": s["smartrecruiters"][0], **base}
        if "neogov" in s: return {"name": f"neogov-{slug}", "adapter": "neogov", "agency": s["neogov"][0], "type": "public_sector", "employer": r["employer"]}
        if "taleo" in s: return {"name": f"taleo-{slug}", "adapter": "taleo", "host": s["taleo"][0], "sections": [{"name": s["taleo"][1], "portal": ""}], **base, "needs_portal": True}
        if "oracle" in s: return {"name": f"oracle-{slug}", "adapter": "oracle", "host": s["oracle"][0], "site": s["oracle"][1], **base}
        if "jibe" in s: return {"name": f"jibe-{slug}", "adapter": "jibe", "host": h["url"].split("//")[1], **base}
    return None

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--geo", default="pittsburgh"); ap.add_argument("--names"); ap.add_argument("--file")
    a = ap.parse_args()
    names = [n.strip() for n in a.names.split(",")] if a.names else [l.strip() for l in open(a.file or os.path.join(HERE, "candidates", f"{a.geo}.txt")) if l.strip() and not l.startswith("#")]
    with ThreadPoolExecutor(max_workers=12) as ex: res = list(ex.map(look, names))
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    json.dump(res, open(os.path.join(HERE, "out", f"career-sites-{a.geo}.json"), "w"), indent=1)
    path = os.path.join(HERE, "sources", f"{a.geo}.json"); cur = json.load(open(path)) if os.path.exists(path) else []
    have = {(s["adapter"], s.get("tenant") or s.get("token") or s.get("company") or s.get("host") or s.get("agency")) for s in cur}
    added = []
    for r in res:
        s = to_source(r)
        if s and not s.get("needs_portal"):
            k = (s["adapter"], s.get("tenant") or s.get("token") or s.get("company") or s.get("host") or s.get("agency"))
            if k not in have: have.add(k); cur.append(s); added.append(s["name"])
        print(f"{r['employer']:40} {r['hosts'][0]['url'] if r['hosts'] else 'no career host':42} " + (", ".join(r['hosts'][0]['systems']) if r['hosts'] else ""))
    json.dump(cur, open(path, "w"), indent=2); open(path, "a").write("\n")
    print("\nadded sources:", added, file=sys.stderr)

if __name__ == "__main__":
    main()
