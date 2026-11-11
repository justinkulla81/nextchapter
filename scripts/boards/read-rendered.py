#!/usr/bin/env python3
"""Read people off the pages scripts/boards/render-staff.js saved. Same extractor as crawl-staff.py; writes the same JSON shape.
   python3 read-rendered.py rendered.json staff_results.json"""
import importlib.util, json, sys, os
spec = importlib.util.spec_from_file_location('crawl_staff', os.path.join(os.path.dirname(__file__), 'crawl-staff.py'))
cs = importlib.util.module_from_spec(spec); spec.loader.exec_module(cs)
res = []
for r in json.load(open(sys.argv[1])):
    people = {}
    for pg in r['pages']:
        p = cs.P()
        try: p.feed(pg['html'])
        except Exception: pass
        for pp in cs.people_from(p):
            k = pp['name'].lower()
            if k not in people or (pp['email'] and not people[k]['email']): people[k] = {**pp, 'sourceUrl': pg['url']}
    res.append({'host': r['host'], 'orgs': [{'kind': o['kind'], 'id': o['id'], 'state': o['state'], 'name': o['name'], 'website': o['website']} for o in r['orgs']], 'people': list(people.values()), 'pages': [pg['url'] for pg in r['pages']], **({'error': r['error']} if r.get('error') else {})})
json.dump(res, open(sys.argv[2], 'w')); print(len(res), 'hosts', sum(1 for x in res if x['people']), 'with people', sum(len(x['people']) for x in res), 'people')
