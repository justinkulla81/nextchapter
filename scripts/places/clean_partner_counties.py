# Cleans LocalPartnerOrg.counties against the real county list of each state (run 2026-11-17; result in
# prisma/manual/2026-11-17_clean_partner_county_lists.sql). Inputs: two JSON exports from the Supabase connector,
# [[state, name, fips], ...] from CountyLabor and [[id, state, counties, countiesText], ...] from LocalPartnerOrg (paths in D below).
# Usage: python3 -I scripts/places/clean_partner_counties.py out.json
import json, re, sys
from functools import lru_cache
D = '/root/.claude/projects/-home-user-nextchapter/ae713ffe-a4e8-52ab-9799-0745baf7dbda/tool-results/'
def load(name):
    s = open(D + name).read()
    i = s.index('[['); j = s.rindex(']]') + 2
    return json.loads(json.loads('"' + s[i:j].replace('"', '\\"') + '"')) if s[i-1] == '\\' else json.loads(s[i:j].replace('\\"', '"'))
counties = load('mcp-Supabase-execute_sql-1794890425668-emn2k8.txt')
rows = load('mcp-Supabase-execute_sql-1794890440630-t40sts.txt')
import unicodedata
def county_key(raw):  # same as countyKey() in src/lib/workforce/places.ts
    k = ''.join(c for c in unicodedata.normalize('NFD', raw) if not unicodedata.combining(c)).lower()
    k = re.sub(r'\s+-\s+.*$', '', k)
    k = re.sub(r'\s*\((?:north|south|east|west|northeast|northwest|southeast|southwest|central|eastern|western|northern|southern)\)$', '', k)
    k = re.sub(r'\s+(county|parish|borough|census area|city and borough|municipality)$', '', k)
    k = re.sub(r'\bsaint\b', 'st', k); k = re.sub(r'\bst\.\s*', 'st ', k)
    k = re.sub(r'[^a-z0-9 ]', '', k); k = re.sub(r'\s+', '', k).strip()
    return {'miamidade': 'dade'}.get(k, k)
norm = county_key
KEYS = {}
for st, name, fips in counties: KEYS.setdefault(st, set()).add(county_key(name))
SKIP = {'CT', 'MA', 'RI', 'AK'}  # towns or boroughs, not counties: left as they are
ADJ = {'AL':'FL GA MS TN','AZ':'CA CO NM NV UT','AR':'LA MO MS OK TN TX','CA':'AZ NV OR','CO':'AZ KS NE NM OK UT WY','CT':'MA NY RI','DE':'MD NJ PA','DC':'MD VA','FL':'AL GA','GA':'AL FL NC SC TN','ID':'MT NV OR UT WA WY','IL':'IN IA KY MO WI','IN':'IL KY MI OH','IA':'IL MN MO NE SD WI','KS':'CO MO NE OK','KY':'IL IN MO OH TN VA WV','LA':'AR MS TX','ME':'NH','MD':'DE PA VA WV DC','MA':'CT NH NY RI VT','MI':'IN OH WI','MN':'IA ND SD WI','MS':'AL AR LA TN','MO':'AR IL IA KS KY NE OK TN','MT':'ID ND SD WY','NE':'CO IA KS MO SD WY','NV':'AZ CA ID OR UT','NH':'MA ME VT','NJ':'DE NY PA','NM':'AZ CO OK TX UT','NY':'CT MA NJ PA VT','NC':'GA SC TN VA','ND':'MN MT SD','OH':'IN KY MI PA WV','OK':'AR CO KS MO NM TX','OR':'CA ID NV WA','PA':'DE MD NJ NY OH WV','RI':'CT MA','SC':'GA NC','SD':'IA MN MT ND NE WY','TN':'AL AR GA KY MO MS NC VA','TX':'AR LA NM OK','UT':'AZ CO ID NM NV WY','VT':'MA NH NY','VA':'KY MD NC TN WV DC','WA':'ID OR','WV':'KY MD OH PA VA','WI':'IA IL MI MN','WY':'CO ID MT NE SD UT'}
ADJ = {k: set(v.split()) for k, v in ADJ.items()}
STATES = {'AL':'alabama','AK':'alaska','AZ':'arizona','AR':'arkansas','CA':'california','CO':'colorado','CT':'connecticut','DE':'delaware','FL':'florida','GA':'georgia','HI':'hawaii','ID':'idaho','IL':'illinois','IN':'indiana','IA':'iowa','KS':'kansas','KY':'kentucky','LA':'louisiana','ME':'maine','MD':'maryland','MA':'massachusetts','MI':'michigan','MN':'minnesota','MS':'mississippi','MO':'missouri','MT':'montana','NE':'nebraska','NV':'nevada','NH':'newhampshire','NJ':'newjersey','NM':'newmexico','NY':'newyork','NC':'northcarolina','ND':'northdakota','OH':'ohio','OK':'oklahoma','OR':'oregon','PA':'pennsylvania','RI':'rhodeisland','SC':'southcarolina','SD':'southdakota','TN':'tennessee','TX':'texas','UT':'utah','VT':'vermont','VA':'virginia','WA':'washington','WV':'westvirginia','WI':'wisconsin','WY':'wyoming','DC':'districtofcolumbia'}
MARK = {v: k for k, v in STATES.items()}
MARK.update({k.lower(): k for k in STATES})  # two-letter markers ("wv", "oh") only inside a run-together token

def lev(a, b):
    p = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        c = [i]
        for j, cb in enumerate(b, 1): c.append(min(p[j] + 1, c[j-1] + 1, p[j-1] + (ca != cb)))
        p = c
    return p[-1]

def segment(tok, ctx):
    """Split a run-together token into (state, county) pieces; state markers switch the state. Fewest pieces wins; None if impossible."""
    @lru_cache(None)
    def go(i, st):
        if i == len(tok): return (0, (), st)
        best = None
        for j in range(i + 2, len(tok) + 1):
            w = tok[i:j]
            if w in KEYS.get(st, ()):
                r = go(j, st)
                if r and (best is None or r[0] + 1 < best[0]): best = (r[0] + 1, ((st, w),) + r[1], r[2])
            if w in MARK and (len(w) > 2 or i > 0):
                r = go(j, MARK[w])
                if r and (best is None or r[0] + 1 < best[0]): best = (r[0] + 1, r[1], r[2])
        return best
    return go(0, ctx)

changes, unresolved = [], []
SPECIAL = {('NV', 'carson'): 'carsoncity', ('NM', 'donaana'): 'donaana'}
for rid, st, toks, text in rows:
    if st in SKIP: continue
    own = KEYS.get(st, set())
    # "Lewis and Clark", "King and Queen": a county with "and" in its name that the source split at the comma.
    joined, i = [], 0
    while i < len(toks):
        if i + 1 < len(toks) and norm(toks[i]) + 'and' + norm(toks[i+1]) in own: joined.append(norm(toks[i]) + 'and' + norm(toks[i+1])); i += 2
        else: joined.append(toks[i]); i += 1
    out, ctx, notes = [], st, []
    for raw in joined:
        t = norm(raw)
        if (st, t) in SPECIAL: out.append(SPECIAL[(st, t)]); notes.append(f'{raw}->{SPECIAL[(st, t)]}'); continue
        if t not in own and t + 'city' in own: out.append(t + 'city'); notes.append(f'{raw}->{t}city'); continue
        if t.startswith('cityof') and t[6:] + 'city' in own: out.append(t[6:] + 'city'); notes.append(f'{raw}->{t[6:]}city'); continue
        if ctx == st and t in own:
            out.append(t)
            if t != raw: notes.append(f'{raw}->{t}')
            continue
        if t.endswith('partial') and t[:-7] in own: out.append(t[:-7]); notes.append(f'{raw}->{t[:-7]}'); continue
        seg = segment(t, ctx)
        if seg and (seg[0] > 1 or seg[2] != ctx or ctx != st):
            ctx = seg[2]
            keep = [w for s, w in seg[1] if s == st]
            out += keep; notes.append(f'{raw}->{keep}' + (f' (dropped {[w for s, w in seg[1] if s != st]})' if any(s != st for s, _ in seg[1]) else ''))
            continue
        if ctx != st and t in KEYS.get(ctx, ()): notes.append(f'{raw}: other state, dropped'); continue
        near = [k for k in own if lev(t, k) <= (1 if len(t) < 6 else 2)]
        if len(t) >= 4 and len(near) == 1: out.append(near[0]); notes.append(f'{raw}->{near[0]} (spelling)'); continue
        nb = [o for o in ADJ.get(st, ()) if t in KEYS.get(o, ())]
        if nb: notes.append(f'{raw}: a county in {"/".join(sorted(nb))}, dropped'); continue
        out.append(raw); unresolved.append((st, rid, raw))
    dedup = list(dict.fromkeys(out))
    if dedup != toks: changes.append((rid, st, toks, dedup, notes))

json.dump({'changes': changes, 'unresolved': unresolved}, open(sys.argv[1], 'w'), indent=1)
print('records changed', len(changes), '| names left unresolved', len(unresolved))
for c in changes:
    if c[0] in ('edd-254', 'edo-KY-kentuckianaregionalplanninganddevelopmen') or 'clarkfloydscott' in c[2]: print(c)
