// Wave 6: support for job seekers, places that want workers, hiring against layoff notices, business conferences, and fractional,
// interim and contract work. Pure: no database. The reads are in wave6-scan.ts. Kept in its own file so the shared engine files
// change as little as possible. Places and industries only; no employer is named.

import { STATE_UI } from '@/lib/data/state-ui'
import { MIN_RANKED, editionFor, type Spec } from '@/lib/rankings/build-edition'
import { nf } from '@/lib/rankings/measures'
import { REGIONS, regionById } from '@/lib/rankings/regions'
import { CRAWLER_INDUSTRY_BUCKET, functionPath, industryPath } from '@/lib/seo/topics'
import { INDUSTRIES } from '@/lib/rankings/build-edition'
import { stateName, stateSlug } from '@/lib/seo/states'
import type { CountyStat, MeasureId, PlaceInfo, RankingEdition } from '@/lib/rankings/types'

export interface StateFact {
  st: string
  programs: number
  training: number
  relocation: number
  ajc: number
  unemployed: number
  openings: number
  noticed: number
}
export interface ConfEvent { st: string; city: string; start: string; major: boolean; industries: string[]; functions: string[] }
export interface FlexStat { kind: 'function' | 'industry'; key: string; n: number; flex: number; contract: number }

const NATIONAL = { kind: 'national' as const, id: 'us', name: 'United States' }
const part = (p: string) => p.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const money = (n: number) => `$${nf(n)}`
type Ranked = Parameters<typeof editionFor>[1][number]
const share = (a: number, b: number) => (b > 0 ? a / b : 0)

// ---- State lists -------------------------------------------------------------------------------------------------

interface StateMetric {
  id: MeasureId
  slug: string
  title: string
  family: string
  asc?: boolean
  /** The value for a state, or null when it is not ranked. */
  value: (s: StateFact) => number | null
  label: (v: number) => string
  stats: (s: StateFact) => { label: string; value: string }[]
  lead: (name: string, v: string) => string
  method: string[]
}

const yesNo = (b: boolean | null | undefined) => (b == null ? 'Not confirmed' : b ? 'Yes' : 'No')
const ui = (st: string) => STATE_UI[st]
const UI_SRC = 'Each state\'s own unemployment insurance agency, as checked on the date shown on the state page.'
const PROGRAMS_NOTE = 'Programs are from our benefits catalog and counted only when open or rolling. The catalog is built by research and is not a complete list of every program, so read the counts as a guide.'

export const STATE_METRICS: StateMetric[] = [
  {
    id: 'sx_ui', slug: 'states-with-the-strongest-unemployment-benefits', title: 'States with the strongest unemployment benefits', family: 'Support',
    value: (s) => ui(s.st)?.maxWeeklyBenefit.value ?? null, label: (v) => `${money(v)} a week`,
    stats: (s) => [{ label: 'Maximum weeks', value: ui(s.st)?.maxWeeks.value != null ? String(ui(s.st).maxWeeks.value) : 'Not confirmed' }, { label: 'Minimum weekly benefit', value: ui(s.st)?.minWeeklyBenefit.value != null ? money(ui(s.st).minWeeklyBenefit.value as number) : 'Not confirmed' }, { label: 'Waiting week', value: yesNo(ui(s.st)?.waitingWeek.value) }],
    lead: (n, v) => `${n} pays the highest maximum weekly unemployment benefit: ${v}, before any allowance for dependents.`,
    method: ['A state\'s score is the maximum weekly benefit of its regular unemployment insurance program, without dependents\' allowances.', `${UI_SRC} A state whose figure could not be confirmed is left out. The maximum is for people with high past earnings; most people receive less.`],
  },
  {
    id: 'sx_weeks', slug: 'states-with-the-longest-unemployment-benefits', title: 'States with the longest unemployment benefits', family: 'Support',
    value: (s) => ui(s.st)?.maxWeeks.value ?? null, label: (v) => `${v} weeks`,
    stats: (s) => [{ label: 'Maximum weekly benefit', value: ui(s.st)?.maxWeeklyBenefit.value != null ? money(ui(s.st).maxWeeklyBenefit.value as number) : 'Not confirmed' }, { label: 'Duration varies with unemployment', value: yesNo(ui(s.st)?.durationVaries.value) }, { label: 'Waiting week', value: yesNo(ui(s.st)?.waitingWeek.value) }],
    lead: (n, v) => `${n} offers the longest regular unemployment benefits: up to ${v}.`,
    method: ['A state\'s score is the maximum number of weeks of its regular unemployment insurance program.', `${UI_SRC} In some states the number of weeks falls when the state\'s unemployment rate is low, so the figure is the most a person can receive.`],
  },
  {
    id: 'sx_programs', slug: 'states-with-the-most-job-seeker-programs', title: 'States with the most programs for job seekers', family: 'Support',
    value: (s) => (s.programs > 0 ? s.programs : null), label: (v) => `${nf(v)} programs`,
    stats: (s) => [{ label: 'Retraining and tuition', value: nf(s.training) }, { label: 'Relocation incentives', value: nf(s.relocation) }, { label: 'American Job Centers', value: nf(s.ajc) }],
    lead: (n, v) => `${n} has the most open programs for job seekers in our benefits catalog: ${v}.`,
    method: ['A state\'s score is the number of open or rolling programs the state itself offers in our benefits catalog: retraining, relocation, cost relief and more. National programs are not counted for any state.', PROGRAMS_NOTE],
  },
  {
    id: 'sx_training', slug: 'states-with-the-most-retraining-programs', title: 'States with the most retraining programs', family: 'Support',
    value: (s) => (s.training > 0 ? s.training : null), label: (v) => `${nf(v)} programs`,
    stats: (s) => [{ label: 'All state programs', value: nf(s.programs) }, { label: 'Relocation incentives', value: nf(s.relocation) }, { label: 'American Job Centers', value: nf(s.ajc) }],
    lead: (n, v) => `${n} has the most open retraining and tuition programs in our benefits catalog: ${v}.`,
    method: ['A state\'s score is the number of open or rolling retraining and tuition programs the state itself offers in our benefits catalog.', PROGRAMS_NOTE],
  },
  {
    id: 'sx_relocate', slug: 'states-with-the-most-relocation-incentives', title: 'States with the most relocation incentives', family: 'Support',
    value: (s) => (s.relocation > 0 ? s.relocation : null), label: (v) => `${nf(v)} programs`,
    stats: (s) => [{ label: 'All state programs', value: nf(s.programs) }, { label: 'Retraining and tuition', value: nf(s.training) }, { label: 'American Job Centers', value: nf(s.ajc) }],
    lead: (n, v) => `${n} has the most programs that help people move there: ${v} in our relocation catalog.`,
    method: ['A state\'s score is the number of open or rolling programs in the relocation category of our benefits catalog for the state, such as relocation grants, remote-worker incentives and housing help.', `The category also holds local job and housing programs, so it shows where states and communities are trying to attract workers, not that each program pays you to move. ${PROGRAMS_NOTE}`],
  },
  {
    id: 'sx_ajc', slug: 'states-with-the-most-job-centers-per-unemployed-person', title: 'States with the most job centers per unemployed person', family: 'Support',
    value: (s) => (s.ajc > 0 && s.unemployed >= 1000 ? (s.ajc / s.unemployed) * 100_000 : null), label: (v) => `${v.toFixed(1)} per 100,000`,
    stats: (s) => [{ label: 'American Job Centers', value: nf(s.ajc) }, { label: 'People unemployed', value: nf(s.unemployed) }, { label: 'Programs in catalog', value: nf(s.programs) }],
    lead: (n, v) => `${n} has the most American Job Centers for the number of people unemployed: ${v} unemployed people.`,
    method: ['A state\'s score is its American Job Centers (CareerOneStop directory) for every 100,000 people unemployed there (BLS Local Area Unemployment Statistics, not seasonally adjusted).', 'The figure counts places to get help, not how much help each offers or how long the queue is.'],
  },
  {
    id: 'sx_hire', slug: 'states-where-hiring-outpaces-layoff-notices', title: 'States where hiring outpaces layoff notices', family: 'Hiring and layoffs',
    value: (s) => (s.openings >= 500 && s.noticed >= 500 ? (s.openings / s.noticed) * 100 : null), label: (v) => `${nf(v)} openings per 100 workers`,
    stats: (s) => [{ label: 'Our professional openings', value: nf(s.openings) }, { label: 'Workers in layoff notices (12 months)', value: nf(s.noticed) }, { label: 'People unemployed', value: nf(s.unemployed) }],
    lead: (n, v) => `${n} has the most professional openings for the workers named in its layoff notices: ${v}.`,
    method: ['A state\'s score is the number of open professional roles in our data for every 100 workers named in layoff notices (WARN) filed in the last 12 months.', 'WARN notices cover layoffs of 50 or more workers and each state files them differently, and our openings cover professional roles on the career sites we track, so the figure compares states with one another. It is not a count of jobs for the people laid off. Only states with at least 500 openings and 500 workers in notices are ranked.'],
  },
  {
    id: 'sx_need', slug: 'states-where-workforce-help-is-needed-most', title: 'States where workforce help is needed most', family: 'Workforce',
    value: (s) => (s.openings >= 500 && s.noticed >= 500 ? (s.noticed / s.openings) * 100 : null), label: (v) => `${nf(v)} workers per 100 openings`,
    stats: (s) => [{ label: 'Workers in layoff notices (12 months)', value: nf(s.noticed) }, { label: 'Our professional openings', value: nf(s.openings) }, { label: 'American Job Centers', value: nf(s.ajc) }],
    lead: (n, v) => `${n} has the most workers named in layoff notices for the professional openings in our data: ${v}.`,
    method: ['A state\'s score is the number of workers named in layoff notices (WARN) filed in the last 12 months for every 100 open professional roles in our data. It counts notices and workers only; no employer is named.', 'It is a guide for where workforce boards, job centers and training providers have the most to do, not a measure of how a state\'s economy is doing. WARN notices cover layoffs of 50 or more workers and each state files them differently. Only states with at least 500 openings and 500 workers in notices are ranked.'],
  },
]

export function stateSpecs(): Spec[] {
  return STATE_METRICS.map((m) => ({ slug: m.slug, measure: m.id, scope: { ...NATIONAL, phrase: 'the United States' }, title: m.title, family: m.family, group: 'support' }))
}

export function rankStates(spec: Spec, facts: StateFact[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const m = STATE_METRICS.find((x) => x.id === spec.measure)
  if (!m) return null
  const ranked: Ranked[] = []
  for (const s of facts) {
    const v = m.value(s)
    if (v == null) continue
    ranked.push({ key: s.st, name: stateName(s.st), sub: '', href: `/places/${stateSlug(s.st)}`, value: v, valueLabel: m.label(v), n: 0, employers: [], stats: m.stats(s) })
  }
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: 0, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'states', unit: 'states', sampleUnit: 'jobs', asc: m.asc,
    lead: (name, v) => m.lead(name, v), method: m.method,
  })
}

// ---- County job centers ------------------------------------------------------------------------------------------

const regionStates = (spec: Spec) => (spec.scope.kind === 'national' ? null : new Set(regionById(spec.scope.id)?.states ?? []))

export function countySupportSpecs(): Spec[] {
  const scopes = [{ ...NATIONAL, phrase: 'the United States' }, ...REGIONS.map((r) => ({ kind: 'region' as const, id: r.id, name: r.name, phrase: r.phrase }))]
  return scopes.map((sc) => ({
    slug: sc.kind === 'national' ? 'counties-with-the-most-job-centers-per-unemployed-person' : `counties-with-the-most-job-centers-per-unemployed-person-in-${part(sc.phrase)}`,
    measure: 'kx_ajc' as MeasureId, scope: sc, title: sc.kind === 'national' ? 'Counties with the most job centers per unemployed person' : `Counties with the most job centers per unemployed person in ${sc.phrase}`, family: 'Support', group: 'support',
  }))
}

export function rankCountySupport(spec: Spec, counties: CountyStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const states = regionStates(spec)
  const pool = counties.filter((c) => (!states || states.has(c.st)) && (c.ajc ?? 0) >= 1 && (c.unemployed ?? 0) >= 1000)
  const ranked: Ranked[] = pool.map((c) => {
    const v = ((c.ajc as number) / (c.unemployed as number)) * 10_000
    return {
      key: c.fips, name: c.name, sub: c.st, href: c.href, value: v, valueLabel: `${v.toFixed(1)} per 10,000`, n: c.unemployed as number, employers: [],
      stats: [{ label: 'American Job Centers', value: nf(c.ajc as number) }, { label: 'People unemployed', value: nf(c.unemployed as number) }, { label: 'Unemployment rate', value: c.rate != null ? `${c.rate.toFixed(1)}%` : 'Not available' }],
    }
  })
  const totalA = pool.reduce((s, c) => s + (c.ajc as number), 0)
  const totalU = pool.reduce((s, c) => s + (c.unemployed as number), 0)
  return editionFor(spec, ranked, totalU > 0 ? { label: 'all ranked counties', valueLabel: `${((totalA / totalU) * 10_000).toFixed(1)} per 10,000` } : null, edition, builtAt, prev, {
    minN: 1000, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'counties', unit: 'people unemployed', sampleUnit: 'jobs',
    lead: (name, v, scope, b) => `${name} has the most American Job Centers for the number of people unemployed in ${scope}: ${v}${b ? `, against ${b} across all ranked counties` : ''}.`,
    method: ['A county\'s score is its American Job Centers (CareerOneStop directory) for every 10,000 people unemployed there (BLS Local Area Unemployment Statistics, not seasonally adjusted).', 'The figure counts places to get help, not how much help each offers. Only counties with at least one job center and 1,000 unemployed people are ranked; a center serves its surrounding area, so a county with none may be served by a neighbour.'],
  })
}

// ---- Conferences -------------------------------------------------------------------------------------------------

export const CONF_INDUSTRIES = ['Technology & Software', 'Education & EdTech', 'Healthcare & Hospital Systems', 'Government & Public Sector', 'Financial Services & Banking', 'Legal Services', 'Construction & Real Estate', 'Manufacturing & Industrial', 'Accounting & Audit', 'Energy & Utilities', 'Advertising, Marketing & PR', 'Staffing & Human Capital']
export const CONF_FUNCTIONS = ['Operations', 'Executive Leadership', 'Finance', 'Engineering', 'Data & Analytics', 'Marketing', 'Human Resources', 'Legal', 'Sales', 'Product']

export function conferenceSpecs(): Spec[] {
  const out: Spec[] = []
  const nat = { ...NATIONAL, phrase: 'the United States' }
  out.push({ slug: 'cities-hosting-the-most-business-conferences', measure: 'cf_all', scope: nat, title: 'Cities hosting the most business conferences', family: 'Conferences', group: 'support' })
  for (const r of REGIONS) out.push({ slug: `cities-hosting-the-most-business-conferences-in-${part(r.phrase)}`, measure: 'cf_all', scope: { kind: 'region', id: r.id, name: r.name, phrase: r.phrase }, title: `Cities hosting the most business conferences in ${r.phrase}`, family: 'Conferences', group: 'support' })
  for (const i of CONF_INDUSTRIES) out.push({ slug: `cities-hosting-the-most-${part(i)}-conferences`, measure: 'cf_ind', scope: nat, title: `Cities hosting the most ${i.toLowerCase()} conferences`, family: 'Conferences', group: 'support', fn: i, minRanked: 6 })
  for (const f of CONF_FUNCTIONS) out.push({ slug: `cities-hosting-the-most-${part(f)}-conferences`, measure: 'cf_fn', scope: nat, title: `Cities hosting the most ${f.toLowerCase()} conferences`, family: 'Conferences', group: 'support', fn: f, minRanked: 6 })
  return out
}

export function rankConferences(
  spec: Spec, events: ConfEvent[], place: (st: string, city: string) => { key: string; info: PlaceInfo }, edition: string, builtAt: string, prev: Map<string, number> | null, now = Date.now(),
): RankingEdition | null {
  const states = regionStates(spec)
  const sliced = events.filter((e) => (!states || states.has(e.st)) && (spec.measure === 'cf_ind' ? e.industries.includes(spec.fn as string) : spec.measure === 'cf_fn' ? e.functions.includes(spec.fn as string) : true))
  const by = new Map<string, { st: string; name: string; href: string | null; n: number; soon: number; major: number }>()
  for (const e of sliced) {
    const p = place(e.st, e.city)
    const cur = by.get(p.key) ?? { st: e.st, name: p.info.name, href: p.info.href, n: 0, soon: 0, major: 0 }
    cur.n++
    if (e.major) cur.major++
    const d = new Date(e.start).getTime()
    if (d >= now && d <= now + 90 * 86_400_000) cur.soon++
    by.set(p.key, cur)
  }
  const min = spec.measure === 'cf_all' ? (spec.scope.kind === 'national' ? 5 : 3) : 2
  const total = sliced.length
  const ranked: Ranked[] = [...by.entries()].filter(([, c]) => c.n >= min).map(([key, c]) => ({
    key, name: c.name, sub: c.st, href: c.href, value: c.n, valueLabel: `${nf(c.n)} conferences`, n: 0, employers: [],
    stats: [{ label: 'In the next 90 days', value: nf(c.soon) }, { label: 'Top-rated events', value: nf(c.major) }, { label: 'Share of the total', value: `${(share(c.n, total) * 100).toFixed(1)}%` }],
  }))
  const slice = spec.measure === 'cf_ind' ? `${(spec.fn as string).toLowerCase()} ` : spec.measure === 'cf_fn' ? `${(spec.fn as string).toLowerCase()} ` : 'business '
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: min, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'cities', unit: 'conferences', sampleUnit: 'jobs',
    lead: (name, v, scope) => `${name} hosts the most ${slice}conferences in ${scope}: ${v} in our catalog over the next twelve months.`,
    method: [
      'A city\'s score is the number of conferences and trade shows in our events catalog held there from 30 days ago to twelve months ahead. Our catalog is built by research and covers U.S. business, professional and trade events with a public page; it is not every event.',
      `${spec.measure === 'cf_all' ? '' : 'An event counts for an industry or job family when its catalog entry names it; events listed for every industry are not counted in a single-industry or single-function list. '}Only cities with at least ${min} conferences are ranked. "Top-rated events" are those the catalog rates in its highest tier.`,
    ],
  })
}

// ---- Fractional, interim and contract work -----------------------------------------------------------------------

export function flexSpecs(): Spec[] {
  const s = (slug: string, measure: MeasureId, title: string, fn: string): Spec => ({ slug, measure, scope: { ...NATIONAL, phrase: fn === 'function' ? 'all job families' : 'all industries' }, title, family: 'Work arrangements', group: 'support', fn, minRanked: 6 })
  return [
    s('job-families-with-the-most-fractional-and-interim-roles', 'ef_flex', 'Job families with the most fractional and interim roles', 'function'),
    s('industries-with-the-most-fractional-and-interim-roles', 'ef_flex', 'Industries with the most fractional and interim roles', 'industry'),
    s('job-families-with-the-most-contract-roles', 'ef_contract', 'Job families with the most contract roles', 'function'),
    s('industries-with-the-most-contract-roles', 'ef_contract', 'Industries with the most contract roles', 'industry'),
  ]
}

export function rankFlex(spec: Spec, stats: FlexStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const kind = spec.fn as 'function' | 'industry'
  const flex = spec.measure === 'ef_flex'
  const known = new Map(INDUSTRIES.map((i) => [i.code, i]))
  const pool = stats.filter((e) => e.kind === kind && e.n >= 1000 && (flex ? e.flex : e.contract) >= 20 && (kind === 'function' ? e.key !== '*' : known.has(e.key)))
  const count = (e: FlexStat) => (flex ? e.flex : e.contract)
  const pct2 = (x: number) => `${(x * 100).toFixed(2)}%`
  const ranked: Ranked[] = pool.map((e) => {
    const bucket = CRAWLER_INDUSTRY_BUCKET[e.key]
    return {
      key: `${kind}:${e.key}`, name: kind === 'industry' ? bucket ?? known.get(e.key)?.phrase ?? e.key : e.key, sub: kind === 'function' ? 'Job family' : 'Industry',
      href: kind === 'function' ? functionPath(e.key) : bucket ? industryPath(bucket) : null, value: share(count(e), e.n), valueLabel: pct2(share(count(e), e.n)), n: e.n, employers: [],
      stats: [{ label: flex ? 'Fractional and interim openings' : 'Contract openings', value: nf(count(e)) }, { label: 'All openings', value: nf(e.n) }, { label: flex ? 'Contract openings' : 'Fractional and interim', value: nf(flex ? e.contract : e.flex) }],
    }
  })
  const base = share(pool.reduce((s, e) => s + count(e), 0), pool.reduce((s, e) => s + e.n, 0))
  const noun = kind === 'function' ? 'job families' : 'industries'
  return editionFor(spec, ranked, { label: `all ${noun}`, valueLabel: pct2(base) }, edition, builtAt, prev, {
    minN: 1000, minRanked: spec.minRanked ?? MIN_RANKED, noun: kind === 'function' ? 'job families' : 'industries', unit: 'openings', sampleUnit: 'openings',
    lead: (name, v, scope, b) => `${name} leads: ${v} of its professional openings are ${flex ? 'fractional or interim roles' : 'contract roles'}${b ? `, against ${b} across ${scope}` : ''}.`,
    method: [
      `A ${kind === 'function' ? 'job family' : 'industry'}'s score is the share of its open professional roles that the posting describes as ${flex ? 'fractional (part-time executive or specialist work for several employers) or interim (a temporary leadership or specialist stand-in)' : 'contract (a fixed-term engagement rather than an employee role)'}.`,
      `Only ${noun} with at least 1,000 openings and 20 such roles are ranked. These roles are a small part of the board (about 0.5% for fractional and interim), so shares are small and move with a few postings. Only roles verified on the employer's own career site in the last week are counted.`,
    ],
  })
}

export const supportSpecs = (): Spec[] => [...stateSpecs(), ...countySupportSpecs(), ...conferenceSpecs(), ...flexSpecs()]

export function rankSupport(
  spec: Spec,
  data: { states: StateFact[]; counties: CountyStat[]; events: ConfEvent[]; flex: FlexStat[]; place: (st: string, city: string) => { key: string; info: PlaceInfo } },
  edition: string, builtAt: string, prev: Map<string, number> | null,
): RankingEdition | null {
  if (spec.measure.startsWith('sx_')) return rankStates(spec, data.states, edition, builtAt, prev)
  if (spec.measure === 'kx_ajc') return rankCountySupport(spec, data.counties, edition, builtAt, prev)
  if (spec.measure.startsWith('cf_')) return rankConferences(spec, data.events, data.place, edition, builtAt, prev)
  return rankFlex(spec, data.flex, edition, builtAt, prev)
}
