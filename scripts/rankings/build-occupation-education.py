#!/usr/bin/env python3
"""Builds src/lib/rankings/data/occupation-education.json from the BLS Employment Projections workbook (occupation.xlsx,
Table 1.2, "Occupational projections, 2025-35, and worker characteristics, 2025"). Free public data.

  python3 scripts/rankings/build-occupation-education.py /path/to/occupation.xlsx

Download: https://www.bls.gov/emp/tables/occupational-projections-and-characteristics.htm (occupation.xlsx).
One entry per detailed occupation, keyed by 6-digit SOC code: title, typical entry education, work experience, on-the-job
training, projected employment change 2025-35 (percent) and median annual wage."""
import json, re, sys, zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
EDU = {
    'No formal educational credential': 'none',
    'High school diploma or equivalent': 'hs',
    'Some college, no degree': 'somecollege',
    'Postsecondary nondegree award': 'postnd',
    "Associate's degree": 'assoc',
    "Bachelor's degree": 'bach',
    "Master's degree": 'master',
    'Doctoral or professional degree': 'doctoral',
}

def main(path: str) -> None:
    z = zipfile.ZipFile(path)
    ss = [''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])) for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)]
    names = [s.get('name') for s in ET.fromstring(z.read('xl/workbook.xml')).find('m:sheets', NS)]
    sheet = names.index('Table 1.2') + 1
    out = {}
    header = None
    for row in ET.fromstring(z.read(f'xl/worksheets/sheet{sheet}.xml')).iter('{%s}row' % NS['m']):
        cells = {}
        for c in row.findall('m:c', NS):
            v = c.find('m:v', NS)
            if v is None:
                continue
            cells[re.sub(r'\d', '', c.get('r'))] = ss[int(v.text)] if c.get('t') == 's' else v.text
        if cells.get('M') == 'Typical education needed for entry':
            header = cells
            continue
        if not header or cells.get('C') != 'Line item':
            continue
        edu = EDU.get(cells.get('M', ''))
        code = cells.get('B', '')
        if not edu or not re.fullmatch(r'\d\d-\d{4}', code):
            continue
        num = lambda k: float(cells[k]) if cells.get(k) not in (None, '—', '') else None
        out[code] = {'t': cells['A'].strip(), 'e': edu, 'x': cells.get('N'), 'tr': cells.get('O'), 'g': num('I'), 'emp': num('D'), 'w': num('L')}
    dest = 'src/lib/rankings/data/occupation-education.json'
    json.dump({'source': 'U.S. Bureau of Labor Statistics, Employment Projections, 2025-35 (Table 1.2)', 'occupations': out}, open(dest, 'w'), separators=(',', ':'))
    print(len(out), 'occupations written to', dest)

main(sys.argv[1])
