// Wave 5: rankings of job families, industries, job groups and cities on what the postings say: remote and hybrid work, people
// management, emotional intelligence, no-experience and training, entry-level jobs that want AI, and AI exposure and pay.
// Pure: no database. The reads are in wave5-scan.ts. Kept in its own file so the shared engine files change as little as possible.

import { AEI_OBSERVED_EXPOSURE, AEI_SOURCE } from '@/lib/market/aei-observed-exposure'
import { OCCUPATION_TRENDS } from '@/lib/market/occupation-trends-data'
import type { FunctionPremium } from '@/lib/market/ai-pay-premium'
import { MAX_EMPLOYER_SHARE, nf, usdK } from '@/lib/rankings/measures'
import { INDUSTRIES, MIN_RANKED, editionFor, type Spec } from '@/lib/rankings/build-edition'
import { REGIONS, regionById } from '@/lib/rankings/regions'
import { CRAWLER_INDUSTRY_BUCKET, functionPath, industryPath } from '@/lib/seo/topics'
import type { CityStat, MeasureId, PlaceInfo, RankingEdition } from '@/lib/rankings/types'

export interface EntityStat {
  kind: 'function' | 'industry'
  key: string
  n: number
  entry: number
  entryAi: number
  ai: number
  remote: number
  hybrid: number
  mgmt: number
  eq: number
  noexp: number
  training: number
  paid: number
  payMed: number | null
}
export interface ProfileCityRow { st: string; city: string; n: number; entry: number; entryAi: number; noexp: number; hybrid: number }
export interface SocGroupStat { soc: string; n: number; paid: number; payMed: number | null }

const pct0 = (x: number) => `${Math.round(x * 100)}%`
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`
/** Rare signals (no experience, emotional intelligence, training) read better with a decimal. */
const fmtOf = (id: string) => (id === 'pf_eq' || id === 'pf_noexp' || id === 'pf_training' ? pct1 : pct0)
const share = (a: number, b: number) => (b > 0 ? a / b : 0)

interface Metric {
  id: MeasureId
  slug: string
  /** "Functions with the most remote jobs". */
  title: (plural: string) => string
  value: (e: EntityStat) => number
  /** The count behind the share, and the base it is a share of (all openings, or the entry-level ones). */
  count: (e: EntityStat) => number
  base: (e: EntityStat) => number
  minBase: number
  asc?: boolean
  word: string
  what: string
  countLabel: string
  baseLabel: string
}

export const METRICS: Metric[] = [
  { id: 'pf_entry', slug: 'most-entry-level-jobs', title: (p) => `${p} with the most entry-level jobs`, value: (e) => share(e.entry, e.n), count: (e) => e.entry, base: (e) => e.n, minBase: 1000, word: 'are entry-level or early-career', what: 'tagged entry-level or early-career, read from the full posting text', countLabel: 'Entry-level openings', baseLabel: 'All openings' },
  { id: 'pf_ai', slug: 'asking-for-ai-skills-most', title: (p) => `${p} asking for AI skills most`, value: (e) => share(e.ai, e.n), count: (e) => e.ai, base: (e) => e.n, minBase: 1000, word: 'ask for AI skills', what: 'whose posting names at least one AI skill or tool', countLabel: 'AI-skill openings', baseLabel: 'All openings' },
  { id: 'pf_remote', slug: 'most-remote-jobs', title: (p) => `${p} with the most remote jobs`, value: (e) => share(e.remote, e.n), count: (e) => e.remote, base: (e) => e.n, minBase: 1000, word: 'are remote', what: 'whose posting says the work is remote', countLabel: 'Remote openings', baseLabel: 'All openings' },
  { id: 'pf_hybrid', slug: 'most-hybrid-jobs', title: (p) => `${p} with the most hybrid jobs`, value: (e) => share(e.hybrid, e.n), count: (e) => e.hybrid, base: (e) => e.n, minBase: 1000, word: 'are hybrid', what: 'whose posting says the work is hybrid (some days on site, some remote)', countLabel: 'Hybrid openings', baseLabel: 'All openings' },
  { id: 'pf_mgmt', slug: 'most-people-management-roles', title: (p) => `${p} with the most people-management roles`, value: (e) => share(e.mgmt, e.n), count: (e) => e.mgmt, base: (e) => e.n, minBase: 1000, word: 'are manager, director or executive roles', what: 'at manager level or above (manager, senior manager, director, vice president, head-of or C-suite), read from the full posting text', countLabel: 'Management openings', baseLabel: 'All openings' },
  { id: 'pf_lowmgmt', slug: 'fewest-people-management-roles', title: (p) => `${p} with the fewest people-management roles`, value: (e) => share(e.mgmt, e.n), count: (e) => e.mgmt, base: (e) => e.n, minBase: 1000, asc: true, word: 'are manager, director or executive roles', what: 'at manager level or above (manager, senior manager, director, vice president, head-of or C-suite), read from the full posting text', countLabel: 'Management openings', baseLabel: 'All openings' },
  { id: 'pf_eq', slug: 'most-emotional-intelligence-roles', title: (p) => `${p} whose postings stress emotional intelligence most`, value: (e) => share(e.eq, e.n), count: (e) => e.eq, base: (e) => e.n, minBase: 1000, word: 'stress emotional intelligence', what: 'whose posting stresses emotional intelligence, empathy, listening or working with people, a signal read from the posting text', countLabel: 'Openings stressing it', baseLabel: 'All openings' },
  { id: 'pf_noexp', slug: 'most-no-experience-jobs', title: (p) => `${p} with the most jobs that need no experience`, value: (e) => share(e.noexp, e.n), count: (e) => e.noexp, base: (e) => e.n, minBase: 1000, word: 'say no experience is needed', what: 'whose posting says no experience is needed, or welcomes recent graduates or people the employer will train', countLabel: 'No-experience openings', baseLabel: 'All openings' },
  { id: 'pf_entryai', slug: 'entry-level-jobs-that-want-ai', title: (p) => `${p} where entry-level jobs want AI skills`, value: (e) => share(e.entryAi, e.entry), count: (e) => e.entryAi, base: (e) => e.entry, minBase: 200, word: 'ask for AI skills', what: 'whose posting names at least one AI skill or tool', countLabel: 'Entry-level AI openings', baseLabel: 'Entry-level openings' },
  { id: 'pf_training', slug: 'most-on-the-job-training', title: (p) => `${p} offering the most on-the-job training`, value: (e) => share(e.training, e.n), count: (e) => e.training, base: (e) => e.n, minBase: 1000, word: 'say training is provided', what: 'whose posting says training is provided, such as a paid training program, apprenticeship or development program', countLabel: 'Openings offering training', baseLabel: 'All openings' },
]

const NATIONAL = { kind: 'national' as const, id: 'us', name: 'United States' }

export function entitySpecs(): Spec[] {
  const out: Spec[] = []
  for (const m of METRICS) {
    out.push({ slug: `functions-with-${m.slug}`.replace('functions-with-asking-for', 'functions-asking-for').replace('functions-with-entry-level-jobs-that', 'functions-where-entry-level-jobs').replace('functions-with-fewest', 'functions-with-the-fewest').replace('functions-with-most', 'functions-with-the-most'), measure: m.id, scope: { ...NATIONAL, phrase: 'all job families' }, title: m.title('Job families'), family: 'Function profiles', group: 'profile', fn: 'function', minRanked: 6 })
    out.push({ slug: `industries-with-${m.slug}`.replace('industries-with-asking-for', 'industries-asking-for').replace('industries-with-entry-level-jobs-that', 'industries-where-entry-level-jobs').replace('industries-with-fewest', 'industries-with-the-fewest').replace('industries-with-most', 'industries-with-the-most'), measure: m.id, scope: { ...NATIONAL, phrase: 'all industries' }, title: m.title('Industries'), family: 'Industry profiles', group: 'profile', fn: 'industry', minRanked: 6 })
  }
  return out
}

const CITY_METRICS = ['pf_noexp', 'pf_entryai', 'pf_hybrid'] as const
export function cityProfileSpecs(): Spec[] {
  const out: Spec[] = []
  const scopes = [{ ...NATIONAL, phrase: 'the United States' }, ...REGIONS.map((r) => ({ kind: 'region' as const, id: r.id, name: r.name, phrase: r.phrase }))]
  const part = (p: string) => p.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const base: Record<(typeof CITY_METRICS)[number], { title: string; slug: string; family: string }> = {
    pf_noexp: { title: 'Cities with the most jobs that need no experience', slug: 'cities-with-the-most-no-experience-jobs', family: 'Entry-level' },
    pf_entryai: { title: 'Best cities for entry-level jobs that want AI skills', slug: 'best-cities-for-entry-level-ai-jobs', family: 'Entry-level' },
    pf_hybrid: { title: 'Cities with the most hybrid jobs', slug: 'cities-with-the-most-hybrid-jobs', family: 'Work style' },
  }
  for (const m of CITY_METRICS) for (const sc of scopes) {
    const b = base[m]
    const nat = sc.kind === 'national'
    out.push({ slug: nat ? b.slug : `${b.slug}-in-${part(sc.phrase)}`, measure: m, scope: sc, title: nat ? b.title : `${b.title} in ${sc.phrase}`, family: b.family, group: 'profile' })
  }
  return out
}

const SOC_NAMES: Record<string, string> = {
  '11': 'Management', '13': 'Business and financial operations', '15': 'Computer and mathematical', '17': 'Architecture and engineering',
  '19': 'Life, physical and social science', '21': 'Community and social service', '23': 'Legal', '25': 'Education and library',
  '27': 'Arts, design, entertainment and media', '29': 'Healthcare practitioners', '31': 'Healthcare support', '33': 'Protective service',
  '35': 'Food preparation and serving', '37': 'Building and grounds maintenance', '39': 'Personal care and service', '41': 'Sales and related',
  '43': 'Office and administrative support', '45': 'Farming, fishing and forestry', '47': 'Construction and extraction',
  '49': 'Installation, maintenance and repair', '51': 'Production', '53': 'Transportation and material moving',
}

export function aiJobSpecs(): Spec[] {
  const s = (slug: string, measure: MeasureId, title: string, fn: string): Spec => ({ slug, measure, scope: { ...NATIONAL, phrase: 'all job groups' }, title, family: 'AI and jobs', group: 'profile', fn, minRanked: 6 })
  return [
    s('job-groups-most-exposed-to-ai', 'aj_exposed', 'Job groups most exposed to AI', 'exposed'),
    s('job-groups-least-exposed-to-ai', 'aj_least', 'Job groups least exposed to AI', 'least'),
    s('functions-with-the-biggest-ai-pay-premium', 'aj_pay', 'Job families with the biggest AI pay premium', 'pay'),
  ]
}

export const profileSpecs = (): Spec[] => [...entitySpecs(), ...cityProfileSpecs(), ...aiJobSpecs()]

const metricOf = (id: MeasureId) => METRICS.find((m) => m.id === id)

type Ranked = Parameters<typeof editionFor>[1][number]

/** Ranks job families or industries on a share of their openings. */
export function rankEntities(spec: Spec, stats: EntityStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const m = metricOf(spec.measure)
  if (!m) return null
  const kind = spec.fn as 'function' | 'industry'
  const known = new Map(INDUSTRIES.map((i) => [i.code, i]))
  const pool = stats.filter((e) => e.kind === kind && m.base(e) >= m.minBase && (kind === 'function' ? e.key !== '*' : known.has(e.key)))
  const ranked: Ranked[] = pool.map((e) => {
    const name = kind === 'industry' ? CRAWLER_INDUSTRY_BUCKET[e.key] ?? known.get(e.key)?.phrase ?? e.key : e.key
    const v = m.value(e)
    return {
      key: `${kind}:${e.key}`, name, sub: kind === 'function' ? 'Job family' : 'Industry', value: v, valueLabel: fmtOf(m.id)(v), n: m.base(e), employers: [],
      href: kind === 'function' ? functionPath(e.key) : CRAWLER_INDUSTRY_BUCKET[e.key] ? industryPath(CRAWLER_INDUSTRY_BUCKET[e.key]) : null,
      stats: [{ label: m.countLabel, value: nf(m.count(e)) }, { label: m.baseLabel, value: nf(m.base(e)) }, { label: 'Median posted pay', value: e.payMed != null && e.paid >= 20 ? usdK(e.payMed) : 'Not enough pay data' }],
    }
  })
  const base = share(pool.reduce((s, e) => s + m.count(e), 0), pool.reduce((s, e) => s + m.base(e), 0))
  const noun = kind === 'function' ? 'job families' : 'industries'
  return editionFor(spec, ranked, { label: `all ${noun}`, valueLabel: fmtOf(m.id)(base) }, edition, builtAt, prev, {
    minN: m.minBase, minRanked: spec.minRanked ?? MIN_RANKED, noun: kind === 'function' ? 'job families' : 'industries', unit: m.baseLabel.toLowerCase(), sampleUnit: 'openings', asc: m.asc,
    lead: (name, v, scope, b) => `${name} ${m.asc ? 'has the lowest share' : 'leads'}: ${v} of its ${m.id === 'pf_entryai' ? 'entry-level ' : 'professional '}openings ${m.word}${b ? `, against ${b} across ${scope}` : ''}.`,
    method: [
      m.id === 'pf_entryai' ? `A ${kind === 'function' ? 'job family' : 'industry'}'s score is the share of its entry-level and early-career roles ${m.what}.` : `A ${kind === 'function' ? 'job family' : 'industry'}'s score is the share of its open professional roles ${m.what}.`,
      `${kind === 'industry' ? 'The industry is the one our crawler assigns to the employer. ' : 'The job family is the one assigned from the posting title and text. '}Only ${noun} with at least ${nf(m.minBase)} ${m.baseLabel.toLowerCase()} are ranked, and only roles verified on the employer's own career site in the last week are counted.`,
    ],
  })
}

const statesOfScope = (spec: Spec): Set<string> | null => (spec.scope.kind === 'national' ? null : new Set(regionById(spec.scope.id)?.states ?? []))

/** Ranks cities on a share of their openings: no-experience, entry-level jobs that want AI, or hybrid. */
export function rankProfileCities(
  spec: Spec, rows: ProfileCityRow[], base: (r: ProfileCityRow) => CityStat | undefined, info: (c: CityStat) => PlaceInfo, edition: string, builtAt: string, prev: Map<string, number> | null,
): RankingEdition | null {
  const m = metricOf(spec.measure)
  if (!m) return null
  const states = statesOfScope(spec)
  const min = spec.scope.kind === 'national' ? 200 : 100
  const minEntry = spec.scope.kind === 'national' ? 80 : 40
  const pick = (r: ProfileCityRow) => (m.id === 'pf_noexp' ? r.noexp : m.id === 'pf_hybrid' ? r.hybrid : r.entryAi)
  const denom = (r: ProfileCityRow) => (m.id === 'pf_entryai' ? r.entry : r.n)
  const ranked: Ranked[] = []
  for (const r of rows) {
    if (states && !states.has(r.st)) continue
    const c = base(r)
    if (!c || c.topShare > MAX_EMPLOYER_SHARE || r.n < min || denom(r) < (m.id === 'pf_entryai' ? minEntry : min)) continue
    const p = info(c)
    const v = share(pick(r), denom(r))
    ranked.push({
      key: `${c.st}|${c.city}`, name: p.name, sub: c.st, href: p.href, value: v, valueLabel: fmtOf(m.id)(v), n: denom(r), employers: c.employers,
      stats: [{ label: m.countLabel, value: nf(pick(r)) }, { label: m.baseLabel, value: nf(denom(r)) }, { label: 'All openings', value: nf(r.n) }],
    })
  }
  const tot = rows.filter((r) => !states || states.has(r.st))
  const baseline = { label: 'all cities in our data', valueLabel: fmtOf(m.id)(share(tot.reduce((s, r) => s + pick(r), 0), tot.reduce((s, r) => s + denom(r), 0))) }
  return editionFor(spec, ranked, baseline, edition, builtAt, prev, {
    minN: m.id === 'pf_entryai' ? minEntry : min, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'cities', unit: m.id === 'pf_entryai' ? 'entry-level openings' : 'openings', sampleUnit: 'openings',
    lead: (name, v, scope, b) => `${name} leads ${scope}: ${v} of its ${m.id === 'pf_entryai' ? 'entry-level ' : 'professional '}openings ${m.word}${b ? `, against ${b} across all cities in our data` : ''}.`,
    method: [m.id === 'pf_entryai' ? `A city's score is the share of its entry-level and early-career roles ${m.what}.` : `A city's score is the share of its open professional roles ${m.what}.`, 'Only roles verified on the employer\'s own career site in the last week are counted. A city where one employer posts at least half the openings is not ranked, so a single company cannot decide a city\'s score.'],
  })
}

/** Ranks job groups by AI exposure (Anthropic Economic Index), or job families by the AI pay premium. */
export function rankAiJobs(spec: Spec, groups: SocGroupStat[], premiums: FunctionPremium[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  if (spec.measure === 'aj_pay') {
    const rows = premiums.filter((p) => p.withAi >= 30 && p.premiumPct != null)
    const ranked: Ranked[] = rows.map((p) => ({
      key: `function:${p.function}`, name: p.function, sub: 'Job family', href: functionPath(p.function), value: p.premiumPct as number,
      valueLabel: `${(p.premiumPct as number) >= 0 ? '+' : '−'}${Math.abs(Math.round(p.premiumPct as number))}%`, n: p.withAi, employers: [],
      stats: [{ label: 'Openings naming AI', value: nf(p.withAi) }, { label: 'Median pay with AI', value: p.medianWithAi != null ? usdK(p.medianWithAi) : 'Not available' }, { label: 'Median pay without', value: p.medianWithoutAi != null ? usdK(p.medianWithoutAi) : 'Not available' }],
    }))
    return editionFor(spec, ranked, null, edition, builtAt, prev, {
      minN: 30, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'job families', unit: 'openings naming AI', sampleUnit: 'openings',
      lead: (name, v) => `${name} has the biggest AI pay premium: roles that name AI skills advertise ${v} more than similar roles that do not, after adjusting for level.`,
      method: ['A job family\'s score is the level-adjusted difference between the median advertised pay of roles that name an AI skill and those that do not, among roles that post a salary.', 'Only job families with at least 30 AI-skill roles that post a salary are ranked. The gap shows what employers advertise, not that AI skills cause the pay.'],
    })
  }
  const most = spec.measure === 'aj_exposed'
  const trend = new Map(OCCUPATION_TRENDS.map((t) => [t.socGroup, t]))
  const ranked: Ranked[] = groups.filter((g) => g.n >= 300 && AEI_OBSERVED_EXPOSURE[g.soc] && SOC_NAMES[g.soc]).map((g) => {
    const x = AEI_OBSERVED_EXPOSURE[g.soc].exposure
    const t = trend.get(g.soc)
    return {
      key: `soc:${g.soc}`, name: SOC_NAMES[g.soc], sub: 'Job group', href: null, value: x, valueLabel: pct0(x), n: g.n, employers: [],
      stats: [
        { label: 'Our open roles', value: nf(g.n) },
        { label: 'Median posted pay', value: g.payMed != null && g.paid >= 20 ? usdK(g.payMed) : 'Not enough pay data' },
        { label: 'Employment, 2022 to 2026', value: t ? `${t.employmentChangePct >= 0 ? '+' : '−'}${Math.abs(t.employmentChangePct).toFixed(1)}%` : 'Not available' },
      ],
    }
  })
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: 300, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'job families', unit: 'open roles', sampleUnit: 'openings', asc: !most,
    lead: (name, v) => `${name} ${most ? 'is the job group most exposed to AI' : 'is the job group least exposed to AI'}: ${v} of its tasks are ones an AI model could speed up and that show work-related use.`,
    method: [
      `A job group's score is its observed AI exposure from the ${AEI_SOURCE.title} (${AEI_SOURCE.published}): the share of its tasks that an AI model could speed up and that show work-related use. The figure is the average across the occupations in the group.`,
      'Exposure measures coverage of tasks, not job loss; it does not say a job will disappear. Only job groups with at least 300 of our open roles are ranked.',
    ],
  })
}

/** Dispatches one profile spec to its ranker. */
export function rankProfile(
  spec: Spec,
  data: { entities: EntityStat[]; cityRows: ProfileCityRow[]; socGroups: SocGroupStat[]; premiums: FunctionPremium[]; base: (r: ProfileCityRow) => CityStat | undefined; info: (c: CityStat) => PlaceInfo },
  edition: string, builtAt: string, prev: Map<string, number> | null,
): RankingEdition | null {
  if (spec.measure === 'aj_exposed' || spec.measure === 'aj_least' || spec.measure === 'aj_pay') return rankAiJobs(spec, data.socGroups, data.premiums, edition, builtAt, prev)
  if (spec.fn === 'function' || spec.fn === 'industry') return rankEntities(spec, data.entities, edition, builtAt, prev)
  return rankProfileCities(spec, data.cityRows, data.base, data.info, edition, builtAt, prev)
}
