"""Build the NextChapter AEI occupation table from the Anthropic Economic Index release.

Reads (never executes) the raw files under ~/nextchapter-jobs/data/aei/ and O*NET 31.0 task
statements, writes JSON outputs to the out dir given as argv[2]."""
import csv, json, re, sys, collections, statistics
AEI = sys.argv[1]; OUT = sys.argv[2]
ONET = sys.argv[3]
REL = 'release_2026_06_26'
THRESH = float(sys.argv[4]) if len(sys.argv) > 4 else 0.01

def norm(s): return re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()

# O*NET 31.0 tasks
tasks = {}; by_text = collections.defaultdict(list); occ_tasks = collections.defaultdict(list)
for r in csv.DictReader(open(f'{ONET}/Task Statements.txt', encoding='utf-8', errors='replace'), delimiter='\t'):
    tid = r['Task ID']; tasks[tid] = (r['O*NET-SOC Code'], r['Task'], r['Task Type'])
    by_text[norm(r['Task'])].append(tid); occ_tasks[r['O*NET-SOC Code']].append(tid)
occ_title = {}
for r in csv.DictReader(open(f'{ONET}/Occupation Data.txt', encoding='utf-8', errors='replace'), delimiter='\t'):
    occ_title[r['O*NET-SOC Code']] = r['Title']

def load(src):
    t = collections.defaultdict(lambda: collections.defaultdict(dict))   # task -> month -> metric
    s = collections.defaultdict(lambda: collections.defaultdict(dict))   # soc
    names = {}; snames = {}
    for r in csv.DictReader(open(f'{AEI}/{REL}/aei_{src}_2026-06-26.csv')):
        if r['geo_id'] != 'GLOBAL' or r['hierarchy_level'] != '0': continue
        if r['category_name'] == 'onet':
            t[r['node_external_id']][r['date_start']][r['metric_id']] = float(r['value']); names[r['node_external_id']] = r['node_name']
        elif r['category_name'] == 'soc_occupation':
            s[r['node_external_id']][r['date_start']][r['metric_id']] = float(r['value']); snames[r['node_external_id']] = r['node_name']
    return t, s, names, snames

def agg(months):
    """pct averaged over months; automation/augmentation weighted by pct."""
    ms = list(months.values())
    pct = sum(m.get('pct', 0) for m in ms) / len(ms)
    out = {'pct': pct, 'months': len(ms)}
    for k in ('collaboration_bucket_automation_pct', 'collaboration_bucket_augmentation_pct'):
        w = [(m[k], max(m.get('pct', 0), 1e-6)) for m in ms if k in m]
        out[k] = sum(v * x for v, x in w) / sum(x for _, x in w) if w else None
    return out

c_t, c_s, c_names, c_snames = load('claude_ai')
a_t, a_s, a_names, _ = load('1p_api')
months = sorted({m for v in c_t.values() for m in v})

# AEI task -> O*NET 31 task ids (by id, else by text)
def onet_ids(aei_id, name):
    ids = set()
    if aei_id in tasks and norm(tasks[aei_id][1]) == norm(name): ids.add(aei_id)
    ids.update(by_text.get(norm(name), []))
    if not ids and aei_id in tasks: ids.add(aei_id)
    return ids

task_rows = {}   # onet task id -> metrics
unmapped = 0
for src, T, N in (('claude_ai', c_t, c_names), ('1p_api', a_t, a_names)):
    for aid, mm in T.items():
        ids = onet_ids(aid, N[aid])
        if not ids: unmapped += 1; continue
        g = agg(mm)
        for tid in ids:
            row = task_rows.setdefault(tid, {'claude_ai': None, '1p_api': None})
            prev = row[src]
            if prev is None or g['pct'] > prev['pct']: row[src] = g
print('AEI tasks unmapped to O*NET 31:', unmapped, file=sys.stderr)

def covered(tid):
    r = task_rows.get(tid)
    if not r: return False
    return any(r[s] and r[s]['pct'] >= THRESH for s in ('claude_ai', '1p_api'))

# Anthropic observed exposure (labor market impacts, SOC 6-digit)
obs = {r['occ_code']: float(r['observed_exposure']) for r in csv.DictReader(open(f'{AEI}/labor_market_impacts/job_exposure.csv'))}

occs = []
for code, tids in occ_tasks.items():
    n = len(tids); cov = [t for t in tids if covered(t)]
    s = c_s.get(code)
    g = agg(s) if s else None
    # automation / augmentation: the AEI occupation row; else the usage-weighted mean of its tasks
    auto = aug = None; basis = None
    if g and g['collaboration_bucket_automation_pct'] is not None:
        auto, aug, basis = g['collaboration_bucket_automation_pct'], g['collaboration_bucket_augmentation_pct'], 'occupation'
    else:
        w = [(task_rows[t]['claude_ai'], task_rows[t]['claude_ai']['pct']) for t in cov if task_rows[t]['claude_ai'] and task_rows[t]['claude_ai']['collaboration_bucket_automation_pct'] is not None]
        tw = sum(x for _, x in w)
        if tw > 0:
            auto = sum(m['collaboration_bucket_automation_pct'] * x for m, x in w) / tw
            aug = sum(m['collaboration_bucket_augmentation_pct'] * x for m, x in w) / tw
            basis = 'tasks'
    top = sorted(((task_rows[t]['claude_ai']['pct'] if task_rows[t]['claude_ai'] else 0) + (task_rows[t]['1p_api']['pct'] if task_rows[t]['1p_api'] else 0) * 0, t) for t in cov)
    top = sorted(cov, key=lambda t: -((task_rows[t]['claude_ai'] or {}).get('pct', 0) or 0) - ((task_rows[t]['1p_api'] or {}).get('pct', 0) or 0) * 0.5)[:5]
    occs.append({
        'socCode': code, 'title': occ_title.get(code, ''), 'taskCount': n, 'tasksUsed': len(cov),
        'taskCoveragePct': round(100 * len(cov) / n, 1) if n else None,
        'convSharePct': round(g['pct'], 3) if g else None,
        'apiSharePct': round(agg(a_s[code])['pct'], 3) if code in a_s else None,
        'automationPct': round(auto, 1) if auto is not None else None,
        'augmentationPct': round(aug, 1) if aug is not None else None, 'collabBasis': basis,
        'observedExposure': obs.get(code[:7]),
        'topTasks': [{'taskId': int(t), 'text': tasks[t][1], 'pct': round(((task_rows[t]['claude_ai'] or {}).get('pct') or 0), 3),
                      'automationPct': (lambda m: round(m['collaboration_bucket_automation_pct'], 1) if m and m['collaboration_bucket_automation_pct'] is not None else None)(task_rows[t]['claude_ai'])} for t in top],
    })
for o in occs: o['basis'] = 'tasks'
have = {o['socCode']: o for o in occs if o['taskCount']}
def mean(v):
    v = [x for x in v if x is not None]
    return round(sum(v) / len(v), 1) if v else None
for code, title in occ_title.items():
    if code in have: continue
    for k in (7, 6, 5):   # same detailed SOC, then broad occupation, then minor group
        sib = [o for c, o in have.items() if c[:k] == code[:k]]
        if sib: break
    if not sib: continue
    occs = [o for o in occs if o['socCode'] != code]
    occs.append({'socCode': code, 'title': title, 'taskCount': 0, 'tasksUsed': 0,
        'taskCoveragePct': mean([o['taskCoveragePct'] for o in sib]), 'convSharePct': None, 'apiSharePct': None,
        'automationPct': mean([o['automationPct'] for o in sib]), 'augmentationPct': mean([o['augmentationPct'] for o in sib]),
        'collabBasis': 'related', 'observedExposure': obs.get(code[:7]), 'topTasks': [], 'basis': 'related:' + ','.join(sorted(o['socCode'] for o in sib))[:200]})
json.dump({'release': REL, 'months': months, 'threshold': THRESH, 'occupations': occs}, open(f'{OUT}/aei_occupations.json', 'w'))
# task-level output for skill links
tl = []
for tid, r in task_rows.items():
    c = r['claude_ai'] or {}; a = r['1p_api'] or {}
    tl.append({'taskId': int(tid), 'socCode': tasks[tid][0], 'text': tasks[tid][1], 'claudePct': c.get('pct'), 'apiPct': a.get('pct'),
               'automationPct': c.get('collaboration_bucket_automation_pct') if c else a.get('collaboration_bucket_automation_pct'),
               'augmentationPct': c.get('collaboration_bucket_augmentation_pct') if c else a.get('collaboration_bucket_augmentation_pct'),
               'covered': covered(tid)})
json.dump(tl, open(f'{OUT}/aei_tasks.json', 'w'))
cv = [o['taskCoveragePct'] for o in occs if o['taskCoveragePct'] is not None]
print('occs', len(occs), 'with conv', sum(1 for o in occs if o['convSharePct'] is not None), 'collab', sum(1 for o in occs if o['automationPct'] is not None), file=sys.stderr)
print('coverage quantiles', statistics.quantiles(cv, n=10), file=sys.stderr)
