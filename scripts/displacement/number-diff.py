#!/usr/bin/env python3
"""Compare every number token in two versions of the report HTML (visible text,
chart data and JSON-LD excluded from neither: chart data is compared separately).
Usage: number-diff.py old.html new.html
Prints numbers that appear in one file and not the other, with counts, and
confirms the inline chart script data arrays are byte-identical."""
import re, sys, html, collections

def text(path):
    t = open(path, encoding='utf-8').read()
    t = re.sub(r'<style.*?</style>', '', t, flags=re.S)
    t = re.sub(r'<script.*?</script>', '', t, flags=re.S)
    t = re.sub(r'<head>.*?</head>', '', t, flags=re.S)
    t = re.sub(r'<[^>]+>', ' ', t)
    return html.unescape(t)

def tokens(t):
    out = collections.Counter()
    for m in re.findall(r'\d[\d,]*(?:\.\d+)?', t):
        out[m.rstrip(',.')] += 1
    return out

def chart_data(path):
    t = open(path, encoding='utf-8').read()
    m = re.findall(r'<script>(.*?)</script>', t, flags=re.S)
    js = m[-1]
    # data arrays/objects only: strip the aria-label and title strings
    return re.sub(r'"aria-label":"[^"]*"', '', js)

a, b = tokens(text(sys.argv[1])), tokens(text(sys.argv[2]))
only_old = sorted(k for k in a if k not in b)
only_new = sorted(k for k in b if k not in a)
fewer = sorted((k, a[k], b[k]) for k in a if k in b and b[k] < a[k])
print('Numbers present in OLD and absent from NEW:', only_old)
print('Numbers present in NEW and absent from OLD:', only_new)
print('Numbers with fewer occurrences in NEW (still present):', [f'{k}: {x}->{y}' for k, x, y in fewer])
same = chart_data(sys.argv[1]) == chart_data(sys.argv[2])
print('Chart data identical (aria-labels excluded):', same)
