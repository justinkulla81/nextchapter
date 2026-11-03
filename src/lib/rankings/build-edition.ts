// Turns counts into a ranked, annotated edition: the rows, the lead sentence, the commentary built from the numbers, the
// FAQ and the method. Pure: no database, no clock beyond the dates passed in.

import { CITY_MEASURES, CONCENTRATION_NOTE, COUNTY_MEASURES, MAX_EMPLOYER_SHARE as MAX_SHARE, MEASURE_SOURCES, nf, pct1, usdK, type CityCtx, type Scope } from '@/lib/rankings/measures'
import { REGIONS, regionById } from '@/lib/rankings/regions'
import { stateName, stateSlug } from '@/lib/seo/states'
import { industryByName, industryPath } from '@/lib/seo/topics'
import { AI_SKILL_ITEMS } from '@/lib/skills/ai-skills'
import { COUNTY_COMPOSITES, CITY_COMPOSITES, countyEligible, describeWeights, scorePool, type Comp } from '@/lib/rankings/composites'
import type { BuildGroup, CityStat, CollegeStat, CountyStat, FnTotal, IndustryStat, MeasureId, PlaceInfo, RankRow, RankingEdition, SkillStat } from '@/lib/rankings/types'

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
  /** One extra sentence for the method box ('Only cities with a college are ranked'). */
  note?: string
}

const NATIONAL = { kind: 'national' as const, id: 'us', name: 'United States', phrase: 'the United States' }

type PlaceMeasure = keyof typeof CITY_MEASURES | keyof typeof COUNTY_MEASURES

function specFor(measure: PlaceMeasure, scope: Spec['scope']): Spec {
  const m = measure in COUNTY_MEASURES ? COUNTY_MEASURES[measure as keyof typeof COUNTY_MEASURES] : CITY_MEASURES[measure as keyof typeof CITY_MEASURES]
  if (scope.kind === 'national') return { slug: m.base.slug, measure, scope, title: m.base.title, family: m.family, group: 'places' }
  const s = m.scoped(scope.kind === 'region' ? scope.phrase : scope.name)
  const part = (scope.kind === 'region' ? scope.phrase : scope.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return { slug: s.slug(part), measure, scope, title: s.title, family: m.family, group: 'places' }
}

/** Wave 1: nine national lists, four per region, two per big state. `topStates` are the states with the most openings. */
export function wave1Specs(topStates: string[]): Spec[] {
  const out: Spec[] = (['junior', 'ai', 'paycost', 'remote', 'swe', 'largest', 'transparent', 'growth', 'infogrowth'] as PlaceMeasure[]).map((m) => specFor(m, NATIONAL))
  for (const r of REGIONS) for (const m of ['junior', 'ai', 'paycost', 'growth'] as PlaceMeasure[]) out.push(specFor(m, { kind: 'region', id: r.id, name: r.name, phrase: r.phrase }))
  for (const code of topStates.slice(0, 10)) for (const m of ['junior', 'paycost'] as PlaceMeasure[]) out.push(specFor(m, { kind: 'state', id: stateSlug(code), name: stateName(code), phrase: stateName(code) }))
  return out
}

const NATIONAL_SCOPE = { kind: 'national' as const, id: 'us', name: 'United States', phrase: 'the United States' }

/** Wave 2, places: regional engineering lists and the two level lists, nationally and for each region. */
export function wave2PlaceSpecs(): Spec[] {
  const out: Spec[] = [specFor('midcareer', NATIONAL_SCOPE), specFor('leadership', NATIONAL_SCOPE)]
  for (const r of REGIONS) {
    const scope = { kind: 'region' as const, id: r.id, name: r.name, phrase: r.phrase }
    for (const m of ['swe', 'midcareer', 'leadership'] as PlaceMeasure[]) out.push(specFor(m, scope))
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

/** The industry pay list: industries ranked on median posted pay. (Entry-level, AI-skill and remote lists by industry are the industry group's.) It builds with the skills group. */
export function industrySpecs(): Spec[] {
  const scope = { kind: 'national' as const, id: 'us', name: 'United States', phrase: 'all industries' }
  const spec = (slug: string, measure: MeasureId, title: string): Spec => ({ slug, measure, scope, title, family: 'Industries', group: 'skills', minRanked: 6 })
  return [spec('industries-with-the-highest-posted-pay', 'indpay', 'Industries with the highest posted pay')]
}

/** Wave 3, workforce and research: four county lists, nationally and for each region. Places and economies only; no employer is named. */
export function workforceSpecs(): Spec[] {
  const out: Spec[] = []
  for (const m of ['lowunemp', 'unempdrop', 'whitecollar', 'aiexposed'] as PlaceMeasure[]) {
    out.push({ ...specFor(m, NATIONAL_SCOPE), group: 'workforce' })
    for (const r of REGIONS) out.push({ ...specFor(m, { kind: 'region', id: r.id, name: r.name, phrase: r.phrase }), group: 'workforce' })
  }
  return out.map((s) => ({ ...s, family: s.family }))
}

const COLLEGE_NOTE = 'Earnings are the median earnings of students who received federal financial aid, ten years after they first enrolled, as published in the Department of Education College Scorecard. They describe past students, not a promise for future ones.'

/** Wave 3, higher education: earnings outcomes for four-year and two-year colleges, by region and by state, and college towns for junior jobs. */
export function collegeSpecs(states: string[]): Spec[] {
  const out: Spec[] = []
  const base = (slug: string, title: string, scope: Spec['scope'], level?: string): Spec => ({ slug, measure: 'collegepay', scope, title, family: 'Higher education', group: 'college', fn: level })
  out.push(base('colleges-with-the-highest-earnings', 'Colleges with the highest earnings 10 years after enrolling', NATIONAL_SCOPE))
  out.push(base('four-year-colleges-with-the-highest-earnings', 'Four-year colleges with the highest earnings 10 years after enrolling', NATIONAL_SCOPE, '4-year'))
  out.push(base('two-year-colleges-with-the-highest-earnings', 'Community and two-year colleges with the highest earnings 10 years after enrolling', NATIONAL_SCOPE, '2-year'))
  for (const r of REGIONS) out.push(base(`colleges-with-the-highest-earnings-in-${r.phrase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, `Colleges with the highest earnings 10 years after enrolling in ${r.phrase}`, { kind: 'region', id: r.id, name: r.name, phrase: r.phrase }))
  for (const code of states) out.push(base(`colleges-with-the-highest-earnings-in-${stateSlug(code)}`, `Colleges with the highest earnings 10 years after enrolling in ${stateName(code)}`, { kind: 'state', id: stateSlug(code), name: stateName(code), phrase: stateName(code) }))
  const town = 'Only cities that have a college or university in the Department of Education directory are ranked.'
  out.push({ slug: 'best-college-towns-for-junior-jobs', measure: 'junior', scope: NATIONAL_SCOPE, title: 'Best college towns for entry-level and junior jobs', family: 'Higher education', group: 'college', note: town })
  for (const r of REGIONS) out.push({ slug: `best-college-towns-for-junior-jobs-in-${r.phrase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, measure: 'junior', scope: { kind: 'region', id: r.id, name: r.name, phrase: r.phrase }, title: `Best college towns for junior jobs in ${r.phrase}`, family: 'Higher education', group: 'college', note: town })
  return out
}

/** The industries the crawler assigns to an employer, with the words and address used for them. */
export const INDUSTRIES: { code: string; phrase: string; slug: string }[] = [
  { code: 'technology', phrase: 'technology', slug: 'technology' },
  { code: 'healthcare', phrase: 'healthcare', slug: 'healthcare' },
  { code: 'financial_services', phrase: 'financial services', slug: 'financial-services' },
  { code: 'professional_services', phrase: 'professional services', slug: 'professional-services' },
  { code: 'industrial', phrase: 'manufacturing and industrial', slug: 'manufacturing-and-industrial' },
  { code: 'consumer', phrase: 'consumer and retail', slug: 'consumer-and-retail' },
  { code: 'life_sciences', phrase: 'life sciences and biotech', slug: 'life-sciences-and-biotech' },
  { code: 'aerospace_defense', phrase: 'aerospace and defense', slug: 'aerospace-and-defense' },
  { code: 'education', phrase: 'education', slug: 'education' },
  { code: 'government', phrase: 'government', slug: 'government' },
  { code: 'energy', phrase: 'energy and utilities', slug: 'energy-and-utilities' },
  { code: 'media', phrase: 'media and entertainment', slug: 'media-and-entertainment' },
  { code: 'nonprofit', phrase: 'nonprofit', slug: 'nonprofit' },
  { code: 'logistics', phrase: 'logistics and transportation', slug: 'logistics-and-transportation' },
  { code: 'real_estate', phrase: 'construction and real estate', slug: 'construction-and-real-estate' },
  { code: 'telecom', phrase: 'telecommunications', slug: 'telecommunications' },
  { code: 'agriculture', phrase: 'agriculture and food', slug: 'agriculture-and-food' },
]

/** Wave 4, industries: each industry's best cities for openings and for pay. (The lists that rank the industries themselves are industrySpecs.) */
export function industryCitySpecs(): Spec[] {
  const out: Spec[] = []
  for (const i of INDUSTRIES) {
    out.push({ slug: `best-cities-for-${i.slug}-jobs`, measure: 'icopen', scope: NATIONAL_SCOPE, title: `Best cities for ${i.phrase} jobs`, family: 'Industry markets', group: 'industry', fn: i.code })
    out.push({ slug: `best-cities-for-${i.slug}-pay-vs-cost-of-living`, measure: 'icpay', scope: NATIONAL_SCOPE, title: `Best cities for ${i.phrase} pay after cost of living`, family: 'Industry markets', group: 'industry', fn: i.code })
  }
  return out
}

/** Wave 4, all-round: four audience lists for cities, and three county lists, nationally and for each region. Built with the place lists. */
export function compositeSpecs(): Spec[] {
  const out: Spec[] = []
  const scopes = [NATIONAL_SCOPE, ...REGIONS.map((r) => ({ kind: 'region' as const, id: r.id, name: r.name, phrase: r.phrase }))]
  const slugPart = (sc: Spec['scope']) => (sc.kind === 'national' ? '' : (sc.phrase).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  for (const m of ['cgrad', 'cmid', 'cremote', 'cai'] as const) {
    for (const sc of scopes) {
      const t = sc.kind === 'national' ? CITY_COMPOSITES[m].base : CITY_COMPOSITES[m].scoped(sc.phrase)
      out.push({ slug: sc.kind === 'national' ? CITY_COMPOSITES[m].base.slug : (t as ReturnType<typeof CITY_COMPOSITES.cgrad.scoped>).slug(slugPart(sc)), measure: m, scope: sc, title: t.title, family: 'Best overall', group: 'places' })
    }
  }
  for (const m of ['coverall', 'claidoff'] as const) {
    for (const sc of scopes) {
      const t = sc.kind === 'national' ? COUNTY_COMPOSITES[m].base : COUNTY_COMPOSITES[m].scoped(sc.phrase)
      out.push({ slug: sc.kind === 'national' ? COUNTY_COMPOSITES[m].base.slug : (t as ReturnType<typeof COUNTY_COMPOSITES.coverall.scoped>).slug(slugPart(sc)), measure: m, scope: sc, title: t.title, family: 'Best overall', group: 'places' })
    }
  }
  for (const sc of scopes) out.push({ ...specFor('perunemp', sc), group: 'places' })
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
const byValueAsc = (a: Ranked, b: Ranked) => a.value - b.value || b.n - a.n || a.name.localeCompare(b.name)

/** The bar length of each ranked row, 0 to 1, longest for the leader whichever way the list is ordered. */
function bars(ranked: Ranked[], asc: boolean): number[] {
  const vals = ranked.map((r) => r.value)
  const anyNeg = vals.some((v) => v < 0)
  const maxAbs = Math.max(...vals.map(Math.abs), 1e-9)
  const positive = vals.filter((v) => v > 0)
  const minPos = positive.length ? Math.min(...positive) : 1
  return vals.map((v) => (anyNeg ? Math.abs(v) / maxAbs : asc ? (v > 0 ? minPos / v : 1) : v / maxAbs))
}

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
  sampleUnit: 'openings' | 'jobs' | 'students'
  extraMethod?: string[]
  /** Lowest value ranks first. */
  asc?: boolean
}

export function editionFor(spec: Spec, ranked: Ranked[], baseline: { label: string; valueLabel: string } | null, edition: string, builtAt: string, prev: Map<string, number> | null, d: Def): RankingEdition | null {
  if (ranked.length < d.minRanked) return null
  const sorted = ranked.sort(d.asc ? byValueAsc : byValue)
  const rows = toRows(sorted, prev)
  const barOf = bars(sorted.slice(0, MAX_ROWS), !!d.asc)
  rows.forEach((r, i) => { r.bar = barOf[i] })
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
  const placeWord = d.noun === 'job families' ? 'job family' : d.noun === 'industries' ? 'industry' : d.noun === 'cities' ? 'city' : d.noun === 'counties' ? 'county' : d.noun === 'skills' ? 'skill' : d.noun === 'tools' ? 'tool' : 'certification'
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
    minN: min, minRanked: spec.minRanked ?? MIN_RANKED, lead: m.lead, method: m.method, extraMethod: [CONCENTRATION_NOTE, ...(spec.note ? [spec.note] : [])], noun: 'cities',
    unit: spec.measure === 'swe' ? 'engineering openings' : spec.measure === 'paycost' || spec.measure === 'fnpay' || spec.measure === 'icpay' ? 'openings with pay posted' : 'openings', sampleUnit: 'openings',
  })
}

export function rankCounties(spec: Spec, stats: CountyStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const m = COUNTY_MEASURES[spec.measure as keyof typeof COUNTY_MEASURES]
  const states = statesOf(spec.scope)
  const inScope = states ? stats.filter((c) => states.has(c.st)) : stats
  const min = m.min[spec.scope.kind]
  const ranked: Ranked[] = inScope.filter((c) => m.qualifies(c, min)).map((c) => {
    const v = m.value(c)
    return { key: c.fips, name: c.name, sub: c.st, href: c.href, value: v, valueLabel: m.valueLabel(v), stats: m.stats(c), employers: [], n: m.sample(c) }
  })
  return editionFor(spec, ranked, m.baseline(inScope), edition, builtAt, prev, {
    minN: min, minRanked: spec.minRanked ?? MIN_RANKED, lead: m.lead, method: m.method, noun: 'counties', unit: spec.measure === 'lowunemp' || spec.measure === 'unempdrop' || spec.measure === 'whitecollar' ? 'people in the labor force' : spec.measure === 'perunemp' ? 'openings' : 'jobs', sampleUnit: spec.measure === 'perunemp' ? 'openings' : 'jobs', asc: m.order === 'asc',
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

/** Ranks industries on median posted pay. */
export function rankIndustries(spec: Spec, stats: IndustryStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const min = 30
  const ranked: Ranked[] = stats.filter((r) => r.paid >= min && r.payMed != null).map((r) => {
    const value = r.payMed as number
    return {
      key: `industry:${r.name}`, name: r.name, sub: '', href: industryByName(r.name) ? industryPath(r.name) : null, value,
      valueLabel: usdK(value), n: r.paid, employers: [],
      stats: [
        { label: 'Open roles', value: nf(r.n) },
        { label: 'Openings with pay posted', value: nf(r.paid) },
        { label: 'Median posted pay', value: usdK(value) },
      ],
    }
  })
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: min, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'industries', unit: 'openings with pay posted', sampleUnit: 'openings',
    lead: (name, v) => `${name} has the highest median posted pay of any industry: ${v} a year across its openings that state a salary.`,
    method: ["An industry's score is the median posted annual salary of its open professional roles on employer career sites, verified in the last week. A posting's industry is read into the same groups the industry pages use.", `Only industries with at least ${min} openings that post a salary are ranked.`],
  })
}

const control = (c: CollegeStat) => c.control ?? 'College'

/** Ranks colleges on the median earnings of their former students ten years after enrolling. `spec.fn` is "4-year" or "2-year" to limit the level. */
export function rankColleges(spec: Spec, colleges: CollegeStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const states = statesOf(spec.scope)
  const MIN_ENROLLED = spec.scope.kind === 'national' ? 1000 : 500
  const inScope = colleges.filter((c) => (!states || states.has(c.st)) && (!spec.fn || c.level === spec.fn) && c.enrollment >= MIN_ENROLLED)
  const ranked: Ranked[] = inScope.map((c) => ({
    key: `college:${c.unitid}`, name: c.name, sub: c.st, href: c.href, value: c.earnings10, valueLabel: usdK(c.earnings10), n: c.enrollment, employers: [],
    stats: [
      { label: 'Completion rate', value: c.completionRate != null ? `${Math.round(c.completionRate * 100)}%` : 'Not available' },
      { label: 'Net price a year', value: c.netPrice != null ? `$${nf(c.netPrice)}` : 'Not available' },
      { label: control(c), value: `${nf(c.enrollment)} students` },
    ],
  }))
  const all = inScope.map((c) => c.earnings10)
  const baseline = all.length ? { label: 'the typical college in this list', valueLabel: usdK(all.reduce((s, x) => s + x, 0) / all.length) } : null
  const levelWord = spec.fn === '4-year' ? 'four-year colleges' : spec.fn === '2-year' ? 'community and two-year colleges' : 'colleges'
  return editionFor(spec, ranked, baseline, edition, builtAt, prev, {
    minN: MIN_ENROLLED, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'colleges', unit: 'students enrolled', sampleUnit: 'students',
    lead: (name, v, scope, b) => `${name} leads ${scope} among ${levelWord} for earnings: its former students earn a median of ${v} ten years after enrolling${b ? `, against ${b} for the typical college in this list` : ''}.`,
    method: [COLLEGE_NOTE, `Only ${levelWord} with at least ${nf(MIN_ENROLLED)} students and published earnings are ranked. A college's earnings reflect who enrolls and what they study as much as what the college teaches.`],
  })
}

const cityKey = (c: CityStat) => `${c.st}|${c.city}`

/** Ranks cities on an all-round score for one audience. */
export function rankCityComposite(spec: Spec, stats: CityStat[], info: (c: CityStat) => PlaceInfo, ctx: CityCtx, edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const def = CITY_COMPOSITES[spec.measure as keyof typeof CITY_COMPOSITES]
  if (!def) return null
  const states = statesOf(spec.scope)
  const min = spec.scope.kind === 'national' ? 200 : 100
  const comps = def.comps(ctx.costOf)
  const pool = stats.filter((c) => (!states || states.has(c.st)) && c.n >= min && c.topShare <= MAX_SHARE)
  const scored = scorePool(pool, comps)
  const ranked: Ranked[] = scored.map(({ item: c, score }) => ({
    key: cityKey(c), name: info(c).name, sub: c.st, href: info(c).href, value: score, valueLabel: `${Math.round(score)} / 100`, n: c.n, employers: c.employers,
    stats: comps.slice(0, 3).map((k) => ({ label: k.label, value: k.show(c) })),
  }))
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: min, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'cities', unit: 'openings', sampleUnit: 'openings',
    lead: (name, v, scope) => `${name} is the best all-round city for ${def.audience} in ${scope}, with a score of ${v}.`,
    method: [
      `A city\'s score is the weighted average of its percentile rank on each measure among the ranked cities (100 is first, 0 is last): ${describeWeights(comps as Comp<unknown>[])}.`,
      'A score of 100 would mean first on every measure and 50 is the middle of the pack. The measures and weights are fixed in advance and shown here; they are a judgment about what matters to this reader, so use the single-measure rankings when one thing matters most.',
      'Only cities with enough openings and pay data are ranked.',
    ],
    extraMethod: [CONCENTRATION_NOTE],
  })
}

/** Ranks counties on an all-round score for one audience. */
export function rankCountyComposite(spec: Spec, counties: CountyStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const def = COUNTY_COMPOSITES[spec.measure as keyof typeof COUNTY_COMPOSITES]
  if (!def) return null
  const states = statesOf(spec.scope)
  const pool = counties.filter((c) => (!states || states.has(c.st)) && countyEligible(c))
  const scored = scorePool(pool, def.comps)
  const ranked: Ranked[] = scored.map(({ item: c, score }) => ({
    key: c.fips, name: c.name, sub: c.st, href: c.href, value: score, valueLabel: `${Math.round(score)} / 100`, n: c.openings ?? 0, employers: [],
    stats: def.comps.slice(0, 3).map((k) => ({ label: k.label, value: k.show(c) })),
  }))
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: 100, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'counties', unit: 'openings', sampleUnit: 'openings',
    lead: (name, v, scope) => `${name} is the best all-round county for ${def.audience} in ${scope}, with a score of ${v}.`,
    method: [
      `A county\'s score is the weighted average of its percentile rank on each measure among the ranked counties (100 is first, 0 is last): ${describeWeights(def.comps as Comp<unknown>[])}.`,
      'Openings are our professional roles placed in the county of the city their posting names; unemployment is BLS Local Area Unemployment Statistics, not seasonally adjusted; jobs and sectors are BLS Quarterly Census of Employment and Wages; population is Census; American Job Centers are from CareerOneStop. The measures and weights are fixed in advance and shown here.',
      'Only counties with at least 20,000 people in the labor force, 100 openings, 500 unemployed people and 50,000 residents are ranked.',
    ],
  })
}
