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

/** The parent brand an employer name belongs to. Explicit list: a name that matches none keeps its own name. */
const PARENTS: [RegExp, string][] = [
  [/^(amazon|prime video|aws\b|audible|twitch|whole foods|zoox)/i, 'Amazon'],
  [/^(google|youtube|alphabet|waymo|deepmind)/i, 'Alphabet'],
  [/^(rtx|raytheon|collins aerospace|pratt (&|and) whitney)/i, 'RTX'],
  [/^anduril/i, 'Anduril'],
  [/^oracle/i, 'Oracle'],
  [/^(microsoft|linkedin|github|swiftkey)/i, 'Microsoft'],
  [/^(albertsons|safeway|vons\b|jewel-osco)/i, 'Albertsons'],
  [/^(jpmorgan|jp morgan|jpmc\b)/i, 'JPMorgan Chase'],
  [/^capital one/i, 'Capital One'],
  [/^northrop/i, 'Northrop Grumman'],
  [/^(lockheed|sikorsky)/i, 'Lockheed Martin'],
  [/^caci\b/i, 'CACI'],
  [/^l3 ?harris/i, 'L3Harris'],
  [/^spacex/i, 'SpaceX'],
  [/^(omnicom|interpublic)/i, 'Omnicom'],
  [/^(arthur j\.? gallagher|gallagher)/i, 'Gallagher'],
  [/^deloitte/i, 'Deloitte'],
  [/^(pwc|pricewaterhouse)/i, 'PwC'],
  [/^kpmg/i, 'KPMG'],
  [/^maximus/i, 'Maximus'],
]

export function parentOf(name: string): string {
  const n = name.trim()
  for (const [re, parent] of PARENTS) if (re.test(n)) return parent
  return n.replace(/,?\s+(llc|inc|corp|corporation|co|company|ltd)\.?$/i, '').trim()
}

/** Names that are not employers: placeholders, and staffing, recruiting and search firms that post for other companies. */
const NOT_AN_EMPLOYER = /^(remote|confidential|confidential company|clients blackbox|various|n\/a|gpac|yo ai labs|actalent|michael page|jobot|lhh|teksystems|aston carter|robert half|randstad|adecco|kforce|insight global|apex systems|cybercoders|hays|manpower|kelly (services|services)?|spherion|volt|aligned talent|orion ?placement|heidrick|korn ferry|spencer stuart|russell reynolds|hire velocity)\b|\b(staffing|recruiting|recruitment|recruiters|talent acquisition|executive search|placement)\b/i

export const isEmployer = (name: string) => !!name.trim() && !NOT_AN_EMPLOYER.test(name.trim())

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
