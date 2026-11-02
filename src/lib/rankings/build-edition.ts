// Turns counts into a ranked, annotated edition: the rows, the lead sentence, the commentary built from the numbers, the
// FAQ and the method. Pure: no database, no clock beyond the dates passed in.

import { CITY_MEASURES, CONCENTRATION_NOTE, COUNTY_MEASURES, MEASURE_SOURCES, nf, pct1, usdK, type CityCtx, type Scope } from '@/lib/rankings/measures'
import { REGIONS, regionById } from '@/lib/rankings/regions'
import { stateName, stateSlug } from '@/lib/seo/states'
import { AI_SKILL_ITEMS } from '@/lib/skills/ai-skills'
import type { BuildGroup, CityStat, CountyStat, FnTotal, MeasureId, PlaceInfo, RankRow, RankingEdition, SkillStat } from '@/lib/rankings/types'

export const MIN_RANKED = 8
export const MAX_ROWS = 100

export interface Spec {
  slug: string
  measure: MeasureId
  scope: { kind: Scope; id: string; name: string; phrase: string }
  title: string
  family: string
  group: BuildGroup
  /** A job family the list is about ("Operations"), for the job-family and skills lists. */
  fn?: string
  minRanked?: number
}

const NATIONAL = { kind: 'national' as const, id: 'us', name: 'United States', phrase: 'the United States' }

function specFor(measure: MeasureId, scope: Spec['scope']): Spec {
  const m = measure === 'growth' || measure === 'infogrowth' ? COUNTY_MEASURES[measure] : CITY_MEASURES[measure]
  if (scope.kind === 'national') return { slug: m.base.slug, measure, scope, title: m.base.title, family: m.family, group: 'places' }
  const s = m.scoped(scope.kind === 'region' ? scope.phrase : scope.name)
  const part = (scope.kind === 'region' ? scope.phrase : scope.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return { slug: s.slug(part), measure, scope, title: s.title, family: m.family, group: 'places' }
}

/** Wave 1: nine national lists, four per region, two per big state. `topStates` are the states with the most openings. */
export function wave1Specs(topStates: string[]): Spec[] {
  const out: Spec[] = (['junior', 'ai', 'paycost', 'remote', 'swe', 'largest', 'transparent', 'growth', 'infogrowth'] as MeasureId[]).map((m) => specFor(m, NATIONAL))
  for (const r of REGIONS) for (const m of ['junior', 'ai', 'paycost', 'growth'] as MeasureId[]) out.push(specFor(m, { kind: 'region', id: r.id, name: r.name, phrase: r.phrase }))
  for (const code of topStates.slice(0, 10)) for (const m of ['junior', 'paycost'] as MeasureId[]) out.push(specFor(m, { kind: 'state', id: stateSlug(code), name: stateName(code), phrase: stateName(code) }))
  return out
}

const NATIONAL_SCOPE = { kind: 'national' as const, id: 'us', name: 'United States', phrase: 'the United States' }

/** Wave 2, places: regional engineering lists and the two level lists, nationally and for each region. */
export function wave2PlaceSpecs(): Spec[] {
  const out: Spec[] = [specFor('midcareer', NATIONAL_SCOPE), specFor('leadership', NATIONAL_SCOPE)]
  for (const r of REGIONS) {
    const scope = { kind: 'region' as const, id: r.id, name: r.name, phrase: r.phrase }
    for (const m of ['swe', 'midcareer', 'leadership'] as MeasureId[]) out.push(specFor(m, scope))
  }
  return out
}

/** Job families that get their own city lists and skills lists: phrase for titles, slug for addresses. */
export const FAMILIES: { fn: string; phrase: string; slug: string }[] = [
  { fn: 'Engineering', phrase: 'engineering', slug: 'engineering' },
  { fn: 'Operations', phrase: 'operations', slug: 'operations' },
  { fn: 'Sales', phrase: 'sales', slug: 'sales' },
  { fn: 'Finance', phrase: 'finance', slug: 'finance' },
  { fn: 'Data & Analytics', phrase: 'data and analytics', slug: 'data-and-analytics' },
  { fn: 'Human Resources', phrase: 'HR', slug: 'hr' },
  { fn: 'Marketing', phrase: 'marketing', slug: 'marketing' },
  { fn: 'Legal', phrase: 'legal', slug: 'legal' },
  { fn: 'Clinical', phrase: 'clinical', slug: 'clinical' },
  { fn: 'Product', phrase: 'product', slug: 'product' },
  { fn: 'Security', phrase: 'security', slug: 'security' },
  { fn: 'Design', phrase: 'design', slug: 'design' },
  { fn: 'Customer Success', phrase: 'customer success', slug: 'customer-success' },
]

/** Wave 2, job families: the cities with the most openings in a family, and where its pay goes furthest. Engineering's openings list is the software and engineering ranking. */
export function functionSpecs(): Spec[] {
  const out: Spec[] = []
  for (const f of FAMILIES) {
    if (f.fn !== 'Engineering') out.push({ slug: `best-cities-for-${f.slug}-jobs`, measure: 'fnopen', scope: NATIONAL_SCOPE, title: `Best cities for ${f.phrase} jobs`, family: 'Job families', group: 'functions', fn: f.fn })
    out.push({ slug: `best-cities-for-${f.slug}-pay-vs-cost-of-living`, measure: 'fnpay', scope: NATIONAL_SCOPE, title: `Best cities for ${f.phrase} pay after cost of living`, family: 'Job families', group: 'functions', fn: f.fn })
  }
  return out
}

/** Wave 2, AI skills: the skills and tools postings name most, for every family and for twelve of them, plus the AI skills that pay most. */
export function skillSpecs(): Spec[] {
  const out: Spec[] = []
  const slice = (f?: { fn: string; phrase: string }) => ({ kind: 'national' as const, id: 'us', name: 'United States', phrase: f ? `${f.phrase} jobs` : 'all job families' })
  for (const f of [undefined, ...FAMILIES.filter((x) => x.fn !== 'Customer Success')]) {
    const slug = f ? FAMILIES.find((x) => x.fn === f.fn)!.slug : ''
    out.push({ slug: f ? `ai-skills-most-requested-in-${slug}-jobs` : 'most-requested-ai-skills', measure: 'aiskills', scope: slice(f), title: f ? `Most requested AI skills in ${f.phrase} jobs` : 'Most requested AI skills in job postings', family: 'AI skills', group: 'skills', fn: f?.fn, minRanked: 6 })
    out.push({ slug: f ? `ai-tools-named-in-${slug}-jobs` : 'ai-tools-named-most-often', measure: 'aitools', scope: slice(f), title: f ? `AI tools named most often in ${f.phrase} jobs` : 'AI tools named most often in job postings', family: 'AI skills', group: 'skills', fn: f?.fn, minRanked: 6 })
  }
  out.push({ slug: 'ai-skills-that-pay-the-most', measure: 'skillpay', scope: slice(), title: 'AI skills that pay the most', family: 'AI skills', group: 'skills', minRanked: 6 })
  return out
}

/** The states a scope covers, or null for the whole country. */
function statesOf(scope: Spec['scope']): Set<string> | null {
  if (scope.kind === 'national') return null
  if (scope.kind === 'region') return new Set(regionById(scope.id)?.states ?? [])
  const code = Object.keys(STATE_BY_SLUG).find((c) => STATE_BY_SLUG[c] === scope.id)
  return new Set(code ? [code] : [])
}
const STATE_BY_SLUG: Record<string, string> = Object.fromEntries(
  ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].map((c) => [c, stateSlug(c)]),
)

export const editionLabel = (edition: string) => {
  const [y, m] = edition.split('-')
  return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

interface Ranked { key: string; name: string; sub: string; href: string | null; value: number; valueLabel: string; stats: RankRow['stats']; employers: string[]; n: number }

function toRows(ranked: Ranked[], prev: Map<string, number> | null): RankRow[] {
  return ranked.slice(0, MAX_ROWS).map((r, i) => ({
    rank: i + 1, key: r.key, name: r.name, sub: r.sub, href: r.href, value: r.value, valueLabel: r.valueLabel, stats: r.stats, employers: r.employers,
    change: prev && prev.has(r.key) ? (prev.get(r.key) as number) - (i + 1) : null, n: r.n,
  }))
}

const byValue = (a: Ranked, b: Ranked) => b.value - a.value || b.n - a.n || a.name.localeCompare(b.name)

function commentary(spec: Spec, rows: RankRow[], unit: string, noun: string, minN: number): string[] {
  const out: string[] = []
  const top = rows.slice(0, 10)
  const first = rows[0]
  const tenth = rows[9]
  if (first && tenth && first.value > 0 && tenth.value > 0) {
    const ratio = first.value / tenth.value
    out.push(ratio >= 1.6 ? `The lead is wide: ${first.name} (${first.valueLabel}) is well clear of ${tenth.name} at #10 (${tenth.valueLabel}).` : `The top ten is tightly packed: ${first.name} leads on ${first.valueLabel}, and #10 ${tenth.name} is at ${tenth.valueLabel}.`)
  }
  const ns = top.map((r) => r.n).sort((a, b) => a - b)
  const median = ns.length ? ns[Math.floor(ns.length / 2)] : 0
  const small = top.filter((r) => r.n < median * 0.5).sort((a, b) => a.n - b.n)[0]
  if (small) out.push(`${small.name} reaches #${small.rank} on a sample of ${nf(small.n)} ${unit}, a smaller market than most of the top ten, so its rank can move more from month to month.`)
  const big = [...top].sort((a, b) => b.n - a.n)[0]
  if (big && big !== small && top.length >= 5) out.push(`${big.name} is the largest market in the top ten, with ${nf(big.n)} ${unit} behind its figure.`)
  const climbers = rows.filter((r) => r.change != null && r.change >= 3).sort((a, b) => (b.change as number) - (a.change as number))
  if (climbers[0]) out.push(`Biggest climber: ${climbers[0].name} moved up ${climbers[0].change} places to #${climbers[0].rank} since last month.`)
  const fresh = rows.filter((r, i) => i < 10 && r.change === null && rows.some((x) => x.change !== null))
  if (fresh[0]) out.push(`New in the top ten: ${fresh[0].name} (#${fresh[0].rank}).`)
  out.push(`${noun[0].toUpperCase()}${noun.slice(1)} with fewer than ${nf(minN)} ${unit} are not ranked, and small differences between neighbouring ranks are not meaningful.`)
  return out
}

interface Def {
  minN: number
  minRanked: number
  lead: (name: string, valueLabel: string, scopeLabel: string, baselineLabel: string | null) => string
  method: string[]
  noun: RankingEdition['placeNoun']
  unit: string
  sampleUnit: 'openings' | 'jobs'
  extraMethod?: string[]
}

export function editionFor(spec: Spec, ranked: Ranked[], baseline: { label: string; valueLabel: string } | null, edition: string, builtAt: string, prev: Map<string, number> | null, d: Def): RankingEdition | null {
  if (ranked.length < d.minRanked) return null
  const rows = toRows(ranked.sort(byValue), prev)
  const scopeLabel = spec.scope.phrase
  const first = rows[0]
  const lead = d.lead(first.name, first.valueLabel, scopeLabel, baseline?.valueLabel ?? null)
  const label = editionLabel(edition)
  const method = [...d.method, ...(d.extraMethod ?? [])]
  const keyFacts = [
    ...rows.slice(0, 3).map((r) => `#${r.rank} ${r.name}${r.sub ? `, ${r.sub}` : ''}: ${r.valueLabel}`),
    `${rows.length} ${d.noun} ranked${d.noun === 'cities' || d.noun === 'counties' ? ` in ${scopeLabel}` : ` across ${scopeLabel}`}`,
    `Data as of ${label}`,
  ]
  const placeWord = d.noun === 'cities' ? 'city' : d.noun === 'counties' ? 'county' : d.noun === 'skills' ? 'skill' : d.noun === 'tools' ? 'tool' : 'certification'
  return {
    slug: spec.slug, edition, title: spec.title, h1: spec.title, measure: spec.measure, family: spec.family,
    scope: { kind: spec.scope.kind, id: spec.scope.id, name: spec.scope.name },
    builtAt, minN: d.minN, unit: d.sampleUnit, placeNoun: d.noun, baseline, lead, keyFacts,
    commentary: commentary(spec, rows, d.unit, d.noun, d.minN),
    faq: [
      { q: `Which ${placeWord} ranks first: ${spec.title.toLowerCase()}?`, a: lead },
      { q: `How many ${d.noun} are ranked?`, a: `${rows.length} ${d.noun} have at least ${nf(d.minN)} ${d.unit}, so the list has ${rows.length} entries.` },
      { q: 'How is the ranking calculated?', a: method.join(' ') },
      { q: 'How often is it updated?', a: `Every month. This is the ${label} edition. Older editions stay on this site at their own dated addresses.` },
    ],
    method, sources: MEASURE_SOURCES[spec.measure], rows,
  }
}

/** Ranks the cities of a scope on a city measure. `info` names a city and links it to its place page. */
export function rankCities(spec: Spec, stats: CityStat[], info: (c: CityStat) => PlaceInfo, ctx: CityCtx, edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const m = CITY_MEASURES[spec.measure as keyof typeof CITY_MEASURES]
  const states = statesOf(spec.scope)
  const inScope = states ? stats.filter((c) => states.has(c.st)) : stats
  const min = m.min[spec.scope.kind]
  const ranked: Ranked[] = inScope.filter((c) => m.qualifies(c, min, ctx)).map((c) => {
    const place = info(c)
    const v = m.value(c, ctx)
    return { key: `${c.st}|${c.city}`, name: place.name, sub: c.st, href: place.href, value: v, valueLabel: m.valueLabel(v), stats: m.stats(c, ctx), employers: c.employers, n: m.sample(c) }
  })
  return editionFor(spec, ranked, m.baseline(inScope, ctx), edition, builtAt, prev, {
    minN: min, minRanked: spec.minRanked ?? MIN_RANKED, lead: m.lead, method: m.method, extraMethod: [CONCENTRATION_NOTE], noun: 'cities',
    unit: spec.measure === 'swe' ? 'engineering openings' : spec.measure === 'paycost' || spec.measure === 'fnpay' ? 'openings with pay posted' : 'openings', sampleUnit: 'openings',
  })
}

export function rankCounties(spec: Spec, stats: CountyStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const m = COUNTY_MEASURES[spec.measure as 'growth' | 'infogrowth']
  const states = statesOf(spec.scope)
  const inScope = states ? stats.filter((c) => states.has(c.st)) : stats
  const min = m.min[spec.scope.kind]
  const ranked: Ranked[] = inScope.filter((c) => m.qualifies(c, min)).map((c) => {
    const v = m.value(c)
    return { key: c.fips, name: c.name, sub: c.st, href: c.href, value: v, valueLabel: m.valueLabel(v), stats: m.stats(c), employers: [], n: m.sample(c) }
  })
  return editionFor(spec, ranked, m.baseline(inScope), edition, builtAt, prev, {
    minN: min, minRanked: spec.minRanked ?? MIN_RANKED, lead: m.lead, method: m.method, noun: 'counties', unit: 'jobs', sampleUnit: 'jobs',
  })
}

/** A share of openings: one decimal, two when it is under one percent. */
const share = (x: number) => (x < 0.01 ? `${(x * 100).toFixed(2)}%` : pct1(x))
const GROUP_LABEL: Record<string, string> = { applied: 'Using AI in your work', leadership: 'Leading AI', builder: 'Building AI systems' }
const ITEM = new Map(AI_SKILL_ITEMS.map((i) => [i.id, i]))
const tidyName = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Ranks the AI skills, tools or certifications named in one job family's postings (every family when `spec.fn` is unset). */
export function rankSkills(spec: Spec, stats: SkillStat[], totals: FnTotal[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const fn = spec.fn ?? '*'
  const total = totals.find((t) => t.fn === fn)
  const all = totals.find((t) => t.fn === '*')
  if (!total || total.n < 500) return null
  const kind = spec.measure === 'aitools' ? 'tool' : spec.measure === 'aicerts' ? 'cert' : 'skill'
  const pay = spec.measure === 'skillpay'
  const MIN = pay ? 20 : 30
  const noun: RankingEdition['placeNoun'] = kind === 'tool' ? 'tools' : kind === 'cert' ? 'certifications' : 'skills'
  const fnLabel = spec.fn ? FAMILIES.find((f) => f.fn === spec.fn)?.phrase ?? spec.fn.toLowerCase() : 'all job families'
  const ranked: Ranked[] = stats.filter((r) => r.fn === fn && r.kind === kind && (pay ? r.paid >= MIN && r.payMed != null : r.n >= MIN)).map((r) => {
    const item = kind === 'skill' ? ITEM.get(r.key) : null
    const name = tidyName(item?.label ?? r.key)
    const sub = kind === 'skill' ? GROUP_LABEL[item?.group ?? ''] ?? 'AI skill' : kind === 'tool' ? 'AI tool' : 'Certification'
    const premium = r.payMed != null && total.payMed ? r.payMed / total.payMed - 1 : null
    const value = pay ? (r.payMed as number) : r.n / total.n
    return {
      key: `${kind}:${r.key}`, name, sub, href: null, value, valueLabel: pay ? usdK(value) : share(value), n: pay ? r.paid : r.n, employers: [],
      stats: [
        { label: 'Openings naming it', value: nf(r.n) },
        { label: 'Median posted pay with it', value: r.payMed != null && r.paid >= 20 ? usdK(r.payMed) : 'Not enough pay data' },
        { label: premium != null && r.paid >= 20 ? (spec.fn ? `Pay against all ${fnLabel} openings` : 'Pay against all openings') : 'Share of openings', value: premium != null && r.paid >= 20 ? `${premium >= 0 ? '+' : '−'}${Math.abs(Math.round(premium * 100))}%` : share(r.n / total.n) },
      ],
    }
  })
  const word = kind === 'skill' ? 'AI skill' : kind === 'tool' ? 'AI tool' : 'AI certification'
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: MIN, minRanked: spec.minRanked ?? MIN_RANKED, noun, unit: pay ? 'openings with pay posted' : 'openings', sampleUnit: 'openings',
    lead: pay
      ? (name, v) => `${name} is the AI skill with the highest median posted pay: ${v} across the openings that name it${all?.payMed ? `, against ${usdK(all.payMed)} for all openings in our data` : ''}.`
      : (name, v) => `${name} is the most requested ${word} ${spec.fn ? `in ${fnLabel} jobs` : 'in job postings across all job families'}: it is named in ${v} of openings.`,
    method: pay
      ? ['A skill\'s score is the median posted annual salary of the open professional roles whose posting names it, read by our AI-skill tagger from the full posting text across 24 AI skills in three groups.', `Only skills named in at least ${MIN} openings that post a salary are ranked. A higher median means those roles pay more, not that the skill causes the pay.`]
      : [`A ${word}\'s score is the share of ${spec.fn ? `${fnLabel} ` : ''}open professional roles whose posting names it, read by our AI-skill tagger from the full posting text${kind === 'skill' ? ' across 24 AI skills in three groups: using AI in your work, leading AI, and building AI systems' : ''}.`, `Only ${noun} named in at least ${MIN} openings are ranked.`],
  })
}
