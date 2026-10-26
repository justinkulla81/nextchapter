"""Rebuilds src/lib/market/aei-observed-exposure.ts from the Anthropic Economic Index job_exposure.csv.
Download first: https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/labor_market_impacts/job_exposure.csv
Usage: python3 scripts/seo/build-aei-exposure.py job_exposure.csv > src/lib/market/aei-observed-exposure.ts
(The committed file also carries the header comment; keep it when regenerating.)"""
import csv, collections, sys
g = collections.defaultdict(list)
for r in csv.DictReader(open(sys.argv[1])):
    g[r["occ_code"][:2]].append(float(r["observed_exposure"]))
for k, v in sorted(g.items()):
    print("  '%s': { exposure: %s, occupations: %d }," % (k, round(sum(v) / len(v), 3), len(v)))
