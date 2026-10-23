#!/usr/bin/env python3
"""Turn crawl-procurement.py output into src/lib/boards/procurement.json (the bundle the CRM loads).
Usage: python3 scripts/boards/results-to-json.py path/to/procurement_results.json"""
import json, sys, datetime, os
res = json.load(open(sys.argv[1]))
rows = [{'id': r['id'], 'url': r['procurementUrl'], 'kind': r['kind'],
         'items': [{'title': i['title'][:140], 'date': i['date']} for i in r['items'][:4]]} for r in res]
out = os.path.join(os.path.dirname(__file__), '../../src/lib/boards/procurement.json')
json.dump({'builtAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'rows': rows}, open(out, 'w'))
print(len(rows), 'boards;', sum(1 for r in rows if r['url']), 'with a procurement page;', sum(1 for r in rows if r['items']), 'listing items')
