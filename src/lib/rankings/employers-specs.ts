// Employer hiring lists: which employers have the most open roles overall, at each level and in each job family, and which are
// growing their hiring fastest. Pure: no database. The reads are in employers-scan.ts.
//
// Every list is about hiring, so employers are named only for what they are hiring. Parent brands are combined (Amazon includes AWS
// and Prime Video), placeholders ("Confidential", "Remote") and staffing and recruiting firms are left out, and an employer needs a
// minimum number of open roles to be ranked.

import { FAMILIES, MIN_RANKED, editionFor, type Spec } from '@/lib/rankings/build-edition'
import { nf } from '@/lib/rankings/measures'
import type { MeasureId, RankingEdition } from '@/lib/rankings/types'

/** Open roles for one employer, after parent brands are combined. */
export interface EmployerStat {
  name: string
  n: number
  junior: number
  mid: number
  senior: number
  lead: number
  /** Open roles by job family, keyed by the family's name ("Marketing"). */
  fn: Record<string, number>
  sizeBand: string | null
}

/** One employer's open roles now and twelve weeks ago, from the weekly company signals. */
export interface EmployerGrowth { name: string; open: number; delta12: number; sizeBand: string | null }

import rules from '@/lib/rankings/data/employer-name-rules.json'
import fortune from '@/lib/rankings/data/fortune-100-best-2026.json'
import { normalizeOrgName } from '@/lib/text/org-name-match'

const PARENTS: [RegExp, string][] = rules.parents.map((r) => [new RegExp(r.match, 'i'), r.parent])
const NOT_AN_EMPLOYER = new RegExp(`^(${rules.notEmployerNames})\\b|\\b(${rules.notEmployerWords})\\b`, 'i')

/** The parent brand an employer name belongs to. Explicit list in data/employer-name-rules.json: a name that matches none keeps its own name. */
export function parentOf(name: string): string {
  const n = name.trim()
  for (const [re, parent] of PARENTS) if (re.test(n)) return parent
  return n.replace(/(?<!&),?\s+(llc|inc|corp|corporation|co|company|ltd)\.?$/i, '').trim()
}

/** Names that are not employers: placeholders, and staffing, recruiting and search firms that post for other companies (data/employer-name-rules.json). */
export const isEmployer = (name: string) => !!name.trim() && !NOT_AN_EMPLOYER.test(name.trim())

// ---- Fortune's 100 Best Companies to Work For, 2026 ---------------------------------------------------------------

export const BEST_COMPANIES = { title: fortune.title, publisher: fortune.publisher, source: fortune.source, published: fortune.published }
const BEST_BY_NAME = new Map<string, number>()
for (const c of fortune.companies as { rank: number; name: string; aliases?: string[] }[]) {
  for (const n of [c.name, ...(c.aliases ?? [])]) BEST_BY_NAME.set(normalizeOrgName(parentOf(n)), c.rank)
}

/** The company's rank on Fortune's 2026 list, or null. Matches on the full normalised name only, so an uncertain name is left off rather than guessed. */
export function bestCompanyRank(name: string): number | null {
  return BEST_BY_NAME.get(normalizeOrgName(parentOf(name))) ?? null
}

/** Adds up rows that share a parent brand and drops names that are not employers. */
export function combineEmployers(rows: EmployerStat[]): EmployerStat[] {
  const out = new Map<string, EmployerStat>()
  for (const r of rows) {
    if (!isEmployer(r.name)) continue
    const name = parentOf(r.name)
    if (!isEmployer(name)) continue
    const k = name.toLowerCase()
    const cur = out.get(k)
    if (!cur) { out.set(k, { ...r, name, fn: { ...r.fn } }); continue }
    cur.n += r.n; cur.junior += r.junior; cur.mid += r.mid; cur.senior += r.senior; cur.lead += r.lead
    for (const [f, c] of Object.entries(r.fn)) cur.fn[f] = (cur.fn[f] ?? 0) + c
    cur.sizeBand ??= r.sizeBand
  }
  return [...out.values()]
}

const NATIONAL = { kind: 'national' as const, id: 'us', name: 'United States', phrase: 'the United States' }
const FAMILY = 'Employers hiring'
const SIZE_LABEL: Record<string, string> = { MICRO: 'Under 10 people', SMALL: '10 to 49 people', SMALL_MID: '50 to 199 people', MID: '200 to 999 people', MID_LARGE: '1,000 to 4,999 people', LARGE: '5,000 to 9,999 people', ENTERPRISE: '10,000 to 49,999 people', MEGA: '50,000 people or more' }

interface Measure {
  id: MeasureId
  slug: string
  title: string
  /** Openings of this kind an employer needs to be ranked. */
  min: number
  value: (e: EmployerStat) => number
  /** The kind of role, for the lead and the method ("entry-level and junior"). */
  what: string
}

const LEVELS: Measure[] = [
  { id: 'em_all', slug: 'employers-with-the-most-open-jobs', title: 'Employers with the most open jobs', min: 50, value: (e) => e.n, what: 'open' },
  { id: 'em_junior', slug: 'employers-with-the-most-entry-level-and-junior-jobs', title: 'Employers with the most entry-level and junior jobs', min: 15, value: (e) => e.junior, what: 'entry-level and junior' },
  { id: 'em_mid', slug: 'employers-with-the-most-mid-level-jobs', title: 'Employers with the most mid-level jobs', min: 15, value: (e) => e.mid, what: 'mid-level' },
  { id: 'em_senior', slug: 'employers-with-the-most-senior-jobs', title: 'Employers with the most senior jobs', min: 15, value: (e) => e.senior, what: 'senior and principal' },
  { id: 'em_lead', slug: 'employers-with-the-most-manager-and-leadership-jobs', title: 'Employers with the most manager and leadership jobs', min: 15, value: (e) => e.lead, what: 'manager and leadership' },
]

/** Every employer list: five by level, one for each job family, and growth. */
export function employerSpecs(): Spec[] {
  const spec = (slug: string, measure: MeasureId, title: string, fn?: string): Spec => ({ slug, measure, scope: NATIONAL, title, family: FAMILY, group: 'support', fn, minRanked: 6 })
  return [
    ...LEVELS.map((m) => spec(m.slug, m.id, m.title)),
    spec('best-companies-to-work-for-that-are-hiring-now', 'em_best', 'Fortune 100 Best Companies to Work For that are hiring now'),
    spec('best-companies-to-work-for-hiring-entry-level-and-junior', 'em_bestjr', 'Fortune 100 Best Companies to Work For hiring entry-level and junior roles'),
    ...FAMILIES.map((f) => spec(`employers-with-the-most-${f.slug}-jobs`, 'em_fn', `Employers with the most ${f.phrase} jobs`, f.fn)),
    spec('employers-growing-their-hiring-fastest', 'em_growth', 'Employers growing their hiring fastest'),
  ]
}

const SCOPE_NOTE = 'Employers are ranked on the open roles we verified on their own career sites in the last 14 days. The list shows what our crawler covers, which leans toward larger employers in technology, finance, defense and professional services, so it is not a count of every job in the market.'
const COMBINE_NOTE = 'Parent brands are combined, so Amazon includes AWS and Prime Video and Alphabet includes Google and YouTube. Hourly roles, roles posted by staffing and recruiting firms, and placeholder names are left out.'

type Ranked = Parameters<typeof editionFor>[1][number]

const statsOf = (e: EmployerStat) => [
  { label: 'Open roles', value: nf(e.n) },
  { label: 'Entry-level and junior', value: nf(e.junior) },
  { label: 'Mid-level', value: nf(e.mid) },
  { label: 'Senior', value: nf(e.senior) },
  { label: 'Manager and above', value: nf(e.lead) },
  ...(e.sizeBand && SIZE_LABEL[e.sizeBand] ? [{ label: 'Company size', value: SIZE_LABEL[e.sizeBand] }] : []),
]

export interface EmployerData {
  employers: EmployerStat[]
  growth: EmployerGrowth[]
  /** The employer page for a name, when it has one. */
  href: (name: string) => string | null
}

export function rankEmployers(spec: Spec, data: EmployerData, edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  if (spec.measure === 'em_growth') return rankGrowth(spec, data, edition, builtAt, prev)
  if (spec.measure === 'em_best' || spec.measure === 'em_bestjr') return rankBest(spec, data, edition, builtAt, prev)
  const fnName = spec.measure === 'em_fn' ? spec.fn : undefined
  const family = fnName ? FAMILIES.find((f) => f.fn === fnName) : undefined
  const m: Measure | undefined = fnName && family
    ? { id: 'em_fn', slug: spec.slug, title: spec.title, min: 10, value: (e) => e.fn[fnName] ?? 0, what: `${family.phrase}` }
    : LEVELS.find((x) => x.id === spec.measure)
  if (!m) return null
  const ranked: Ranked[] = []
  for (const e of data.employers) {
    const v = m.value(e)
    if (v < m.min) continue
    ranked.push({ key: e.name.toLowerCase(), name: e.name, sub: '', href: data.href(e.name), value: v, valueLabel: `${nf(v)} ${m.id === 'em_all' ? 'open roles' : 'roles'}`, n: v, employers: [], stats: statsOf(e) })
  }
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: m.min, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'employers', unit: 'openings', sampleUnit: 'openings',
    lead: (name, v) => `${name} has the most ${m.what} roles open in our data: ${v}.`,
    method: [
      `An employer's score is its number of ${m.id === 'em_all' ? 'open' : m.what} roles in our data, counted on the day the edition is built. ${m.id === 'em_junior' ? 'Entry-level and junior means the roles we classify as entry-level or early-career individual contributor roles.' : m.id === 'em_mid' ? 'Mid-level means the roles we classify as mid-level individual contributor roles.' : m.id === 'em_senior' ? 'Senior means the roles we classify as senior or principal individual contributor roles.' : m.id === 'em_lead' ? 'Manager and leadership means manager, senior manager, director, head of, vice president and executive roles.' : fnName ? `A role counts when its job family is ${family?.phrase}.` : 'Every role counts once.'}`,
      SCOPE_NOTE,
      COMBINE_NOTE,
    ],
  })
}

function rankGrowth(spec: Spec, data: EmployerData, edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const ranked: Ranked[] = []
  for (const g of data.growth) {
    const before = g.open - g.delta12
    if (g.open < 40 || before < 20 || g.delta12 <= 0 || !isEmployer(g.name)) continue
    const pct = (g.delta12 / before) * 100
    ranked.push({
      key: g.name.toLowerCase(), name: g.name, sub: '', href: data.href(g.name), value: pct, valueLabel: `+${Math.round(pct)}%`, n: g.open, employers: [],
      stats: [{ label: 'Open roles now', value: nf(g.open) }, { label: 'Open roles 12 weeks ago', value: nf(before) }, ...(g.sizeBand && SIZE_LABEL[g.sizeBand] ? [{ label: 'Company size', value: SIZE_LABEL[g.sizeBand] }] : [])],
    })
  }
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: 40, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'employers', unit: 'openings', sampleUnit: 'openings',
    lead: (name, v) => `${name} has grown its open roles the most over the last 12 weeks: ${v}.`,
    method: [
      'An employer\'s score is the change in its open roles over the last 12 weeks as a share of the roles it had open 12 weeks ago, from our weekly company signals.',
      'It measures growth against the employer\'s own starting point, not against its headcount, because we do not yet hold company size for most employers. An employer needs at least 40 open roles now and 20 twelve weeks ago to be ranked, so a very small team adding a few roles does not top the list. Company size is shown where we have it.',
      SCOPE_NOTE,
    ],
  })
}

/** Fortune's 100 Best Companies to Work For (2026) that are hiring now, ranked on their open roles. A list of two sources: the published ranking and our board. */
function rankBest(spec: Spec, data: EmployerData, edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const junior = spec.measure === 'em_bestjr'
  const min = junior ? 3 : 10
  const ranked: Ranked[] = []
  for (const e of data.employers) {
    const rank = bestCompanyRank(e.name)
    const v = junior ? e.junior : e.n
    if (rank == null || v < min) continue
    ranked.push({
      key: e.name.toLowerCase(), name: e.name, sub: '', href: data.href(e.name), value: v, valueLabel: `${nf(v)} ${junior ? 'entry-level and junior roles' : 'open roles'}`, n: v, employers: [],
      stats: [{ label: 'Fortune 100 Best rank, 2026', value: `#${rank}` }, ...statsOf(e)],
    })
  }
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: min, minRanked: 4, noun: 'employers', unit: 'openings', sampleUnit: 'openings',
    lead: (name, v) => `${name} has the most ${junior ? 'entry-level and junior roles' : 'open roles'} of the Fortune 100 Best Companies to Work For: ${v}.`,
    method: [
      `The employers are the companies on ${BEST_COMPANIES.title}, published by ${BEST_COMPANIES.publisher} on ${BEST_COMPANIES.published} (${BEST_COMPANIES.source}). Each is ranked on its number of ${junior ? 'entry-level and junior' : 'open'} roles in our data. Its Fortune rank is shown beside it.`,
      'A company is matched to the Fortune list only on its full name, so a company whose name we could not match with certainty is left off. A company with fewer open roles than the bar is not ranked, and many companies on the Fortune list do not post on the career sites we track.',
      SCOPE_NOTE,
      COMBINE_NOTE,
    ],
  })
}
