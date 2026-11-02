// Turns counts into a ranked, annotated edition: the rows, the lead sentence, the commentary built from the numbers, the
// FAQ and the method. Pure: no database, no clock beyond the dates passed in.

import { CITY_MEASURES, CONCENTRATION_NOTE, COUNTY_MEASURES, MEASURE_SOURCES, nf, type CityCtx, type Scope } from '@/lib/rankings/measures'
import { REGIONS, regionById } from '@/lib/rankings/regions'
import { stateName, stateSlug } from '@/lib/seo/states'
import type { CityStat, CountyStat, MeasureId, PlaceInfo, RankRow, RankingEdition } from '@/lib/rankings/types'

export const MIN_RANKED = 8
export const MAX_ROWS = 100

export interface Spec {
  slug: string
  measure: MeasureId
  scope: { kind: Scope; id: string; name: string; phrase: string }
  title: string
  family: string
}

const NATIONAL = { kind: 'national' as const, id: 'us', name: 'United States', phrase: 'the United States' }

function specFor(measure: MeasureId, scope: Spec['scope']): Spec {
  const m = measure === 'growth' || measure === 'infogrowth' ? COUNTY_MEASURES[measure] : CITY_MEASURES[measure]
  if (scope.kind === 'national') return { slug: m.base.slug, measure, scope, title: m.base.title, family: m.family }
  const s = m.scoped(scope.kind === 'region' ? scope.phrase : scope.name)
  const part = (scope.kind === 'region' ? scope.phrase : scope.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return { slug: s.slug(part), measure, scope, title: s.title, family: m.family }
}

/** Wave 1: nine national lists, four per region, two per big state. `topStates` are the states with the most openings. */
export function wave1Specs(topStates: string[]): Spec[] {
  const out: Spec[] = (['junior', 'ai', 'paycost', 'remote', 'swe', 'largest', 'transparent', 'growth', 'infogrowth'] as MeasureId[]).map((m) => specFor(m, NATIONAL))
  for (const r of REGIONS) for (const m of ['junior', 'ai', 'paycost', 'growth'] as MeasureId[]) out.push(specFor(m, { kind: 'region', id: r.id, name: r.name, phrase: r.phrase }))
  for (const code of topStates.slice(0, 10)) for (const m of ['junior', 'paycost'] as MeasureId[]) out.push(specFor(m, { kind: 'state', id: stateSlug(code), name: stateName(code), phrase: stateName(code) }))
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

export function editionFor(spec: Spec, ranked: Ranked[], baseline: { label: string; valueLabel: string } | null, edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  if (ranked.length < MIN_RANKED) return null
  const county = spec.measure === 'growth' || spec.measure === 'infogrowth'
  const m = county ? COUNTY_MEASURES[spec.measure as 'growth' | 'infogrowth'] : CITY_MEASURES[spec.measure as keyof typeof CITY_MEASURES]
  const rows = toRows(ranked.sort(byValue), prev)
  const scopeLabel = spec.scope.phrase
  const minN = m.min[spec.scope.kind]
  const noun = county ? 'counties' : 'cities'
  const unit = spec.measure === 'swe' ? 'engineering openings' : spec.measure === 'paycost' ? 'openings with pay posted' : county ? 'jobs' : 'openings'
  const first = rows[0]
  const lead = m.lead(first.name, first.valueLabel, scopeLabel, baseline?.valueLabel ?? null)
  const label = editionLabel(edition)
  const keyFacts = [
    ...rows.slice(0, 3).map((r) => `#${r.rank} ${r.name}, ${r.sub}: ${r.valueLabel}`),
    `${rows.length} ${noun} ranked in ${scopeLabel}`,
    `Data as of ${label}`,
  ]
  const placeWord = county ? 'county' : 'city'
  return {
    slug: spec.slug, edition, title: spec.title, h1: spec.title, measure: spec.measure, family: spec.family,
    scope: { kind: spec.scope.kind, id: spec.scope.id, name: spec.scope.name },
    builtAt, minN, unit: county ? 'jobs' : 'openings', placeNoun: noun, baseline, lead, keyFacts,
    commentary: commentary(spec, rows, unit, noun, minN),
    faq: [
      { q: `Which ${placeWord} ranks first for ${spec.title.replace(/^(Best|Fastest-growing|Cities with the most|Cities that post) /, '').toLowerCase()}?`, a: lead },
      { q: `How many ${noun} are ranked?`, a: `${rows.length} ${noun} in ${scopeLabel} have at least ${nf(minN)} ${unit}, so the list has ${rows.length} entries.` },
      { q: 'How is the ranking calculated?', a: (county ? m.method : [...m.method, CONCENTRATION_NOTE]).join(' ') },
      { q: 'How often is it updated?', a: `Every month. This is the ${label} edition. Older editions stay on this site at their own dated addresses.` },
    ],
    method: county ? m.method : [...m.method, CONCENTRATION_NOTE], sources: MEASURE_SOURCES[spec.measure], rows,
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
  return editionFor(spec, ranked, m.baseline(inScope, ctx), edition, builtAt, prev)
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
  return editionFor(spec, ranked, m.baseline(inScope), edition, builtAt, prev)
}
