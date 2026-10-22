#!/usr/bin/env python3
"""
Optional, cheap: ask the smallest model for a metro's largest employers, then let discover.py verify each one against real career
systems (a wrong name simply fails discovery). One call, a few thousand tokens, a fraction of a cent.

  ANTHROPIC_API_KEY=... python3 scripts/jobsreport/suggest_employers.py --geo nashville [--n 80]
"""
import argparse, json, os, sys, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get("SUGGEST_MODEL", "claude-haiku-5-5")
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--geo", required=True); ap.add_argument("--n", type=int, default=80); a = ap.parse_args()
    key = os.environ.get("ANTHROPIC_API_KEY") or sys.exit("set ANTHROPIC_API_KEY")
    g = json.load(open(os.path.join(HERE, "geos.json")))[a.geo]
    prompt = (f"List the {a.n} largest employers (headquartered or with large operations) in the {g['label']} metropolitan area: hospitals and health systems, "
              "universities and colleges, banks, insurers, tech and engineering firms, manufacturers, utilities, government bodies and school districts. "
              "Return only a JSON array of short employer names, no commentary.")
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=json.dumps({"model": MODEL, "max_tokens": 2000, "messages": [{"role": "user", "content": prompt}]}).encode(),
                                 headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    text = json.load(urllib.request.urlopen(req, timeout=120))["content"][0]["text"]
    names = json.loads(text[text.index("["): text.rindex("]") + 1])
    path = os.path.join(HERE, "candidates", f"{a.geo}.txt"); os.makedirs(os.path.dirname(path), exist_ok=True)
    have = [l.strip() for l in open(path)] if os.path.exists(path) else []
    seen = {x.lower() for x in have}
    with open(path, "w") as f: f.write("\n".join(have + [n for n in names if n.lower() not in seen]) + "\n")
    print(f"{len(names)} suggested; wrote {path}")
if __name__ == "__main__":
    main()
