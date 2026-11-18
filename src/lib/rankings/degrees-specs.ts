// Degree lists: which fields of study, education levels, occupations, job families, industries and cities have the most jobs that
// need a degree, and the most that do not. Pure: no database. The reads are in degrees-scan.ts.
//
// A posting does not say which degree it wants. Every posting carries a standard occupation code (SOC), and the Bureau of Labor
// Statistics publishes the typical entry-level education for each occupation. So "needs a bachelor's degree" here means "its
// occupation typically needs one", never what the posting itself asks for. Places, fields and industries only; no employer is named.

import data from '@/lib/rankings/data/occupation-education.json'
import { MAX_EMPLOYER_SHARE, nf, usdK } from '@/lib/rankings/measures'
import { INDUSTRIES, MIN_RANKED, editionFor, type Spec } from '@/lib/rankings/build-edition'
import { REGIONS, regionById } from '@/lib/rankings/regions'
import { CRAWLER_INDUSTRY_BUCKET, functionPath, industryPath } from '@/lib/seo/topics'
import type { CityStat, MeasureId, PlaceInfo, RankingEdition } from '@/lib/rankings/types'
import { MAJORS, MAJOR_BASE_YEAR, MAJOR_YEAR, fieldMajorsPath, fieldSupply, majorChange, majorPath, type Major } from '@/lib/rankings/majors'

export type EduLevel = 'none' | 'hs' | 'somecollege' | 'postnd' | 'assoc' | 'bach' | 'master' | 'doctoral'
export interface Occupation { t: string; e: EduLevel; x: string | null; tr: string | null; g: number | null; emp: number | null; w: number | null }
export const OCCUPATIONS = data.occupations as Record<string, Occupation>
export const EDUCATION_SOURCE = data.source

export const LEVEL_LABEL: Record<EduLevel, string> = {
  none: 'No formal educational credential', hs: 'High school diploma or equivalent', somecollege: 'Some college, no degree', postnd: 'Postsecondary nondegree award',
  assoc: 'Associate degree', bach: 'Bachelor\'s degree', master: 'Master\'s degree', doctoral: 'Doctoral or professional degree',
}
export const isDegree4 = (e: EduLevel) => e === 'bach' || e === 'master' || e === 'doctoral'

/** The groups the occupation lists are cut by. */
const GROUPS = {
  bach: { label: 'a bachelor\'s degree', phrase: 'a bachelor\'s degree', test: (e: EduLevel) => e === 'bach' },
  master: { label: 'a master\'s degree', phrase: 'a master\'s degree', test: (e: EduLevel) => e === 'master' },
  doctoral: { label: 'a doctoral or professional degree', phrase: 'a doctoral or professional degree', test: (e: EduLevel) => e === 'doctoral' },
  sub: { label: 'an associate degree or a certificate', phrase: 'an associate degree, some college or a postsecondary certificate', test: (e: EduLevel) => e === 'assoc' || e === 'postnd' || e === 'somecollege' },
  none: { label: 'no college degree', phrase: 'no college degree (a high school diploma or less)', test: (e: EduLevel) => e === 'hs' || e === 'none' },
} as const
type GroupId = keyof typeof GROUPS

/** The field of study an occupation is usually reached through: a judgment on the occupation code, for four-year-degree occupations only. */
export function fieldOf(code: string, e: EduLevel): string | null {
  if (!isDegree4(e)) return null
  const starts = (...p: string[]) => p.some((x) => code.startsWith(x))
  if (starts('29-114', '29-115', '29-116', '29-117')) return 'Nursing'
  if (starts('29-')) return 'Health professions and medicine'
  if (starts('11-2011', '11-2021', '11-2022', '11-2032', '13-1161', '27-3')) return 'Marketing and communications'
  if (starts('15-2')) return 'Math and statistics'
  if (starts('15-')) return 'Computer science and IT'
  if (starts('13-2011')) return 'Accounting'
  if (starts('13-2', '11-3031', '19-3011')) return 'Finance and economics'
  if (starts('11-', '13-')) return 'Business administration and management'
  if (starts('17-1', '27-1')) return 'Design and architecture'
  if (starts('17-')) return 'Engineering'
  if (starts('19-1')) return 'Life sciences'
  if (starts('19-2')) return 'Physical sciences'
  if (starts('19-3')) return 'Social sciences and psychology'
  if (starts('21-')) return 'Social work and counseling'
  if (starts('23-')) return 'Law'
  if (starts('25-')) return 'Education'
  return null
}

/** Every BLS occupation with its education level and field, for the scan to join postings to. */
export function educationRows(): { soc: string; lvl: EduLevel; fld: string | null }[] {
  return Object.entries(OCCUPATIONS).map(([soc, o]) => ({ soc, lvl: o.e, fld: fieldOf(soc, o.e) }))
}

// ---- Scan shapes ---------------------------------------------------------------------------------------------------

export interface SocStat { soc: string; n: number; paid: number; payMed: number | null }
/** `stage` rows are keyed `field|stage`, `statefield` rows `ST|field`. */
export interface GroupStat { kind: 'level' | 'field' | 'stage' | 'statefield'; key: string; n: number; paid: number; payMed: number | null }

/** Career stages for the degree lists, from a posting's seniority level (the rungs in src/lib/jobs/career-stage.ts). */
export const STAGE_LEVELS = {
  early: ['ENTRY_IC', 'EARLY_IC'],
  mid: ['MID_IC', 'SENIOR_IC', 'MANAGER'],
  late: ['SR_MANAGER', 'PRINCIPAL', 'DIRECTOR', 'HEAD', 'CHIEF_OF_STAFF', 'SCHOOL_LEADER', 'VP', 'PARTNER', 'EVP_SVP', 'C_SUITE', 'BOARD'],
} as const
export type Stage = keyof typeof STAGE_LEVELS
export const STAGE_LABEL: Record<Stage, { name: string; years: string; desc: string }> = {
  early: { name: 'Early career', years: '0 to 5 years', desc: 'entry-level and early-career roles (about 0 to 5 years of experience)' },
  mid: { name: 'Mid-career', years: '5 to 15 years', desc: 'mid-level, senior individual-contributor and manager roles' },
  late: { name: 'Late career', years: '15 years and more', desc: 'senior manager, principal, director, vice president and executive roles' },
}
const STAGES = Object.keys(STAGE_LEVELS) as Stage[]
export interface DegreeEntityStat { kind: 'function' | 'industry'; key: string; coded: number; degree4: number }
export interface DegreeCityRow { st: string; city: string; coded: number; below: number }

const NATIONAL = { kind: 'national' as const, id: 'us', name: 'United States' }
const pct0 = (x: number) => `${Math.round(x * 100)}%`
const share = (a: number, b: number) => (b > 0 ? a / b : 0)
const part = (p: string) => p.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}%`
type Ranked = Parameters<typeof editionFor>[1][number]
const payOf = (s: { paid: number; payMed: number | null }) => (s.payMed != null && s.paid >= 20 ? usdK(s.payMed) : 'Not enough pay data')

const GROWTH_NOTE = 'Projected growth is the Bureau of Labor Statistics\' change in employment from 2025 to 2035 for the occupation, a national forecast and not a promise for any one city.'
/** Workers in a degree field's occupations (Bureau of Labor Statistics employment), for the coverage check. */
export function fieldWorkers(field: string): number {
  let n = 0
  for (const [c, o] of Object.entries(OCCUPATIONS)) if (o.emp && fieldOf(c, o.e) === field) n += o.emp * 1000
  return n
}
/**
 * Our board holds professional roles from the employers we track. In a few fields (nursing, education, health professions, social
 * work) nearly all openings are posted on hospital, school-district and agency sites we do not read, so the board holds under one
 * open job for every 1,000 workers there, against 1.4 to 18 in the rest. Open-job counts, jobs per graduate and posted pay are not
 * shown for those fields: a low count there means we do not see the jobs, not that there are none.
 */
export const MIN_FIELD_COVERAGE = 0.001
export const fieldCovered = (field: string, open: number) => {
  const w = fieldWorkers(field)
  return w > 0 && open / w >= MIN_FIELD_COVERAGE
}
const COVERAGE_NOTE = 'Fields where our job data holds fewer than 1 open job for every 1,000 people working in the field are left out, because their openings are mostly posted on hospital, school-district and agency sites we do not track (nursing, education, health professions and social work): a low count there would mean we do not see the jobs, not that there are none.'

const EDU_NOTE = 'A posting does not state a degree. Each is matched to its standard occupation, and the education shown is what the Bureau of Labor Statistics lists as typical for entering that occupation. Some employers ask for more or less, and about one posting in a hundred has an occupation we could not match, which is left out.'

// ---- Specs ---------------------------------------------------------------------------------------------------------

const dg = (slug: string, measure: MeasureId, title: string, fn: string, phrase: string, extra: Partial<Spec> = {}): Spec => ({
  slug, measure, scope: { ...NATIONAL, phrase }, title, family: 'Degrees', group: 'profile', fn, minRanked: 6, ...extra,
})

export function fieldSpecs(): Spec[] {
  return [
    dg('degree-fields-with-the-most-open-jobs', 'dg_field', 'Degree fields with the most open jobs', 'most', 'all fields'),
    dg('degree-fields-with-the-fewest-open-jobs', 'dg_field', 'Degree fields with the fewest open jobs', 'fewest', 'all fields'),
    dg('degree-fields-with-the-highest-posted-pay', 'dg_fieldpay', 'Degree fields with the highest posted pay', 'pay', 'all fields'),
    dg('degree-fields-projected-to-grow-fastest', 'dg_fieldgrow', 'Degree fields projected to grow fastest', 'fast', 'all fields'),
    dg('degree-fields-projected-to-grow-slowest', 'dg_fieldgrow', 'Degree fields projected to grow slowest', 'slow', 'all fields'),
  ]
}

export function levelSpecs(): Spec[] {
  return [
    dg('education-levels-with-the-most-open-jobs', 'dg_level', 'Education levels with the most open jobs', 'most', 'all education levels', { minRanked: 5 }),
    dg('education-levels-with-the-fewest-open-jobs', 'dg_level', 'Education levels with the fewest open jobs', 'fewest', 'all education levels', { minRanked: 5 }),
    dg('education-levels-with-the-highest-posted-pay', 'dg_levelpay', 'Education levels with the highest posted pay', 'pay', 'all education levels', { minRanked: 5 }),
  ]
}

export function occupationSpecs(): Spec[] {
  const out: Spec[] = []
  const slugs: Record<GroupId, string> = { bach: 'a-bachelors-degree', master: 'a-masters-degree', doctoral: 'a-doctoral-or-professional-degree', sub: 'an-associate-degree-or-certificate', none: 'no-college-degree' }
  for (const g of Object.keys(GROUPS) as GroupId[]) {
    out.push(dg(`occupations-needing-${slugs[g]}-with-the-most-open-jobs`, 'dg_occ', `Occupations needing ${GROUPS[g].label} with the most open jobs`, `open:${g}`, 'all occupations'))
  }
  for (const g of ['bach', 'none'] as GroupId[]) {
    out.push(dg(`occupations-needing-${slugs[g]}-with-the-highest-posted-pay`, 'dg_occpay', `Occupations needing ${GROUPS[g].label} with the highest posted pay`, `pay:${g}`, 'all occupations'))
    out.push(dg(`occupations-needing-${slugs[g]}-projected-to-grow-fastest`, 'dg_occgrow', `Occupations needing ${GROUPS[g].label} projected to grow fastest`, `fast:${g}`, 'all occupations'))
    out.push(dg(`occupations-needing-${slugs[g]}-projected-to-shrink-most`, 'dg_occgrow', `Occupations needing ${GROUPS[g].label} projected to shrink most`, `slow:${g}`, 'all occupations'))
  }
  return out
}

export function shareSpecs(): Spec[] {
  return [
    dg('job-families-where-the-most-jobs-need-a-four-year-degree', 'dg_share', 'Job families where the most jobs need a four-year degree', 'function:most', 'all job families'),
    dg('job-families-where-the-fewest-jobs-need-a-four-year-degree', 'dg_share', 'Job families where the fewest jobs need a four-year degree', 'function:fewest', 'all job families'),
    dg('industries-where-the-most-jobs-need-a-four-year-degree', 'dg_share', 'Industries where the most jobs need a four-year degree', 'industry:most', 'all industries'),
    dg('industries-where-the-fewest-jobs-need-a-four-year-degree', 'dg_share', 'Industries where the fewest jobs need a four-year degree', 'industry:fewest', 'all industries'),
  ]
}

export function cityDegreeSpecs(): Spec[] {
  const out: Spec[] = []
  const scopes = [{ ...NATIONAL, phrase: 'the United States' }, ...REGIONS.map((r) => ({ kind: 'region' as const, id: r.id, name: r.name, phrase: r.phrase }))]
  for (const sc of scopes) {
    const nat = sc.kind === 'national'
    const tail = nat ? '' : ` in ${sc.phrase}`
    const slugTail = nat ? '' : `-in-${part(sc.phrase)}`
    out.push({ slug: `cities-with-the-most-jobs-that-do-not-need-a-four-year-degree${slugTail}`, measure: 'dg_city', scope: sc, title: `Cities with the most jobs that do not need a four-year degree${tail}`, family: 'Degrees', group: 'profile' })
    out.push({ slug: `cities-where-the-most-jobs-do-not-need-a-four-year-degree${slugTail}`, measure: 'dg_cityshare', scope: sc, title: `Cities where the biggest share of jobs do not need a four-year degree${tail}`, family: 'Degrees', group: 'profile' })
  }
  return out
}

const SUPPLY_NOTE = `Degrees awarded are from the federal IPEDS Completions survey for the ${MAJOR_YEAR} school year: first majors at bachelor's level and above, so a double major counts once.`

export function majorSpecs(): Spec[] {
  return [
    dg('college-majors-with-the-most-graduates', 'dg_major', 'College majors with the most graduates', 'most', 'all majors'),
    dg('college-majors-with-the-fewest-graduates', 'dg_major', 'College majors with the fewest graduates', 'fewest', 'all majors'),
    dg('college-majors-offered-at-the-most-colleges', 'dg_majorschools', 'College majors offered at the most colleges', 'most', 'all majors'),
    dg('college-majors-offered-at-the-fewest-colleges', 'dg_majorschools', 'College majors offered at the fewest colleges', 'fewest', 'all majors'),
    dg('college-majors-with-the-fastest-growing-number-of-graduates', 'dg_majorgrow', 'College majors with the fastest-growing number of graduates', 'fast', 'all majors'),
    dg('college-majors-with-the-fastest-shrinking-number-of-graduates', 'dg_majorgrow', 'College majors with the fastest-shrinking number of graduates', 'slow', 'all majors'),
  ]
}

export function ratioSpecs(): Spec[] {
  return [
    dg('degree-fields-with-the-most-open-jobs-per-graduate', 'dg_fieldratio', 'Degree fields with the most open jobs per graduate', 'most', 'all fields'),
    dg('degree-fields-with-the-fewest-open-jobs-per-graduate', 'dg_fieldratio', 'Degree fields with the fewest open jobs per graduate', 'fewest', 'all fields'),
  ]
}

const STAGE_SLUG: Record<Stage, string> = { early: 'early-career', mid: 'mid-career', late: 'late-career' }
export function stageSpecs(): Spec[] {
  return STAGES.flatMap((st) => [
    dg(`degree-fields-with-the-most-${STAGE_SLUG[st]}-jobs`, 'dg_stage', `Degree fields with the most ${STAGE_LABEL[st].name.toLowerCase()} jobs`, st, 'all fields'),
    dg(`degree-fields-with-the-highest-${STAGE_SLUG[st]}-pay`, 'dg_stagepay', `Degree fields with the highest ${STAGE_LABEL[st].name.toLowerCase()} pay`, st, 'all fields'),
  ])
}

export const degreeSpecs = (): Spec[] => [...fieldSpecs(), ...levelSpecs(), ...occupationSpecs(), ...shareSpecs(), ...cityDegreeSpecs(), ...majorSpecs(), ...ratioSpecs(), ...stageSpecs()]

/** The slugs of the degree-field lists, for the major and field pages to link to. */
export const FIELD_LIST_SLUGS = {
  open: 'degree-fields-with-the-most-open-jobs', pay: 'degree-fields-with-the-highest-posted-pay', grow: 'degree-fields-projected-to-grow-fastest',
  ratio: 'degree-fields-with-the-most-open-jobs-per-graduate', early: 'degree-fields-with-the-most-early-career-jobs', mid: 'degree-fields-with-the-most-mid-career-jobs',
  late: 'degree-fields-with-the-most-late-career-jobs', earlyPay: 'degree-fields-with-the-highest-early-career-pay', midPay: 'degree-fields-with-the-highest-mid-career-pay',
  latePay: 'degree-fields-with-the-highest-late-career-pay', majors: 'college-majors-with-the-most-graduates', schools: 'college-majors-offered-at-the-most-colleges',
  majorGrow: 'college-majors-with-the-fastest-growing-number-of-graduates',
} as const

// ---- Rankers -------------------------------------------------------------------------------------------------------

/** Employment-weighted projected growth for a set of BLS occupations. */
function weightedGrowth(codes: string[]): number | null {
  let w = 0
  let s = 0
  for (const c of codes) {
    const o = OCCUPATIONS[c]
    if (o?.g == null || !o.emp) continue
    w += o.emp
    s += o.g * o.emp
  }
  return w > 0 ? s / w : null
}

const fieldCodes = (field: string) => Object.entries(OCCUPATIONS).filter(([c, o]) => fieldOf(c, o.e) === field).map(([c]) => c)

export function rankFields(spec: Spec, groups: GroupStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const fields = groups.filter((g) => g.kind === 'field' && g.key)
  const total = fields.reduce((s, g) => s + g.n, 0)
  const measure = spec.measure
  const mode = spec.fn as string
  // Projected growth is a federal forecast and holds for every field; counts and pay need our board to see the field's jobs.
  const pool = fields.filter((g) => g.n >= 300 && (measure === 'dg_fieldgrow' || fieldCovered(g.key, g.n)) && (measure !== 'dg_fieldpay' || (g.paid >= 50 && g.payMed != null)))
  const ranked: Ranked[] = pool.flatMap((g): Ranked[] => {
    const growth = weightedGrowth(fieldCodes(g.key))
    const v = measure === 'dg_fieldpay' ? (g.payMed as number) : measure === 'dg_fieldgrow' ? growth : g.n
    return v == null ? [] : [{
      key: `field:${g.key}`, name: g.key, sub: 'Field of study', href: fieldMajorsPath(g.key), value: v, n: g.n, employers: [],
      valueLabel: measure === 'dg_fieldpay' ? usdK(v) : measure === 'dg_fieldgrow' ? signed(v) : `${nf(v)} jobs`,
      stats: [{ label: 'Open jobs', value: nf(g.n) }, { label: 'Share of four-year-degree jobs', value: `${(share(g.n, total) * 100).toFixed(1)}%` }, { label: 'Median posted pay', value: payOf(g) }, { label: 'Projected growth to 2035', value: growth != null ? signed(growth) : 'Not available' }],
    }]
  })
  const asc = mode === 'fewest' || mode === 'slow'
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: 300, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'degrees', unit: 'open jobs', sampleUnit: 'openings', asc,
    lead: (name, v) => measure === 'dg_fieldpay' ? `${name} has the highest median posted pay of the degree fields: ${v} a year.`
      : measure === 'dg_fieldgrow' ? `${name} is ${asc ? 'projected to grow slowest' : 'projected to grow fastest'} of the degree fields: ${v} in employment from 2025 to 2035.`
      : `${name} has the ${asc ? 'fewest' : 'most'} open jobs of the degree fields: ${v} in our data.`,
    method: [
      `A degree field is a group of occupations that are usually reached through the same kind of study, such as Nursing, Engineering or Accounting. The grouping is our own judgment on the occupation code, and only occupations that typically need a bachelor's, master's or doctoral degree are included. ${measure === 'dg_fieldpay' ? 'A field\'s score is the median advertised annual salary of its roles that post a salary range.' : measure === 'dg_fieldgrow' ? 'A field\'s score is the Bureau of Labor Statistics\' projected change in employment from 2025 to 2035, averaged across its occupations and weighted by their employment.' : 'A field\'s score is the number of its open professional roles.'}`,
      `${EDU_NOTE} ${measure === 'dg_fieldgrow' ? GROWTH_NOTE : ''} Only fields with at least 300 open jobs${measure === 'dg_fieldpay' ? ' and 50 that post pay' : ''} are ranked.${measure === 'dg_fieldgrow' ? '' : ` ${COVERAGE_NOTE}`}`.trim(),
    ],
  })
}

export function rankLevels(spec: Spec, groups: GroupStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const levels = groups.filter((g) => g.kind === 'level' && (LEVEL_LABEL as Record<string, string>)[g.key])
  const total = levels.reduce((s, g) => s + g.n, 0)
  const pay = spec.measure === 'dg_levelpay'
  const asc = spec.fn === 'fewest'
  const ranked: Ranked[] = levels.filter((g) => g.n >= 300 && (!pay || (g.paid >= 50 && g.payMed != null))).map((g) => {
    const occ = Object.values(OCCUPATIONS).filter((o) => o.e === g.key).length
    const v = pay ? (g.payMed as number) : g.n
    return {
      key: `level:${g.key}`, name: LEVEL_LABEL[g.key as EduLevel], sub: 'Typical entry education', href: null, value: v, n: g.n, employers: [], valueLabel: pay ? usdK(v) : `${nf(v)} jobs`,
      stats: [{ label: 'Open jobs', value: nf(g.n) }, { label: 'Share of coded jobs', value: pct0(share(g.n, total)) }, { label: 'Median posted pay', value: payOf(g) }, { label: 'Occupations at this level', value: nf(occ) }],
    }
  })
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: 300, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'degrees', unit: 'open jobs', sampleUnit: 'openings', asc,
    lead: (name, v) => pay ? `${name} has the highest median posted pay of the education levels: ${v} a year.` : `${name} has the ${asc ? 'fewest' : 'most'} open jobs of the education levels: ${v} in our data.`,
    method: [
      `An education level is the typical entry-level education the Bureau of Labor Statistics lists for an occupation. A level's score is ${pay ? 'the median advertised annual salary of its roles that post a salary range' : 'the number of open professional roles in occupations at that level'}.`,
      `${EDU_NOTE} Our board is professional roles, so it holds far more jobs that need a four-year degree than the economy as a whole. Only levels with at least 300 open jobs${pay ? ' and 50 that post pay' : ''} are ranked.`,
    ],
  })
}

export function rankOccupations(spec: Spec, socs: SocStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const [mode, gid] = (spec.fn as string).split(':') as [string, GroupId]
  const group = GROUPS[gid]
  if (!group) return null
  const open = mode === 'open'
  const pay = mode === 'pay'
  const min = gid === 'master' || gid === 'doctoral' ? 30 : open ? 100 : pay ? 100 : 200
  const asc = mode === 'slow'
  const pool = socs.filter((s) => {
    const o = OCCUPATIONS[s.soc]
    if (!o || !group.test(o.e) || s.n < min) return false
    if (pay) return s.paid >= 30 && s.payMed != null
    if (!open) return o.g != null
    return true
  })
  const ranked: Ranked[] = pool.map((s) => {
    const o = OCCUPATIONS[s.soc]
    const v = pay ? (s.payMed as number) : open ? s.n : (o.g as number)
    return {
      key: `soc:${s.soc}`, name: o.t, sub: LEVEL_LABEL[o.e], href: null, value: v, n: s.n, employers: [],
      valueLabel: pay ? usdK(v) : open ? `${nf(v)} jobs` : signed(v),
      stats: [{ label: 'Open jobs', value: nf(s.n) }, { label: 'Median posted pay', value: payOf(s) }, { label: 'Projected growth to 2035', value: o.g != null ? signed(o.g) : 'Not available' }, { label: 'Workers in the occupation', value: o.emp ? `${nf(o.emp * 1000)}` : 'Not available' }],
    }
  })
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: min, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'occupations', unit: 'open jobs', sampleUnit: 'openings', asc,
    lead: (name, v) => open ? `${name} has the most open jobs of the occupations that typically need ${group.phrase}: ${v} in our data.`
      : pay ? `${name} has the highest median posted pay of the occupations that typically need ${group.phrase}: ${v} a year.`
      : `${name} is ${asc ? 'projected to shrink most' : 'projected to grow fastest'} of the occupations that typically need ${group.phrase}: ${v} in employment from 2025 to 2035.`,
    method: [
      `An occupation is a standard occupation (SOC) code, and the group is the typical entry-level education the Bureau of Labor Statistics lists for it: here, ${group.phrase}. ${open ? 'An occupation\'s score is the number of its open professional roles.' : pay ? 'An occupation\'s score is the median advertised annual salary of its roles that post a salary range.' : 'An occupation\'s score is the projected change in its employment from 2025 to 2035.'}`,
      `${EDU_NOTE} ${open ? '' : mode === 'pay' ? '' : GROWTH_NOTE} Only occupations with at least ${nf(min)} open jobs${pay ? ' and 30 that post pay' : ''} are ranked.`.replace(/\s+/g, ' ').trim(),
    ],
  })
}

export function rankDegreeShare(spec: Spec, stats: DegreeEntityStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const [kind, mode] = (spec.fn as string).split(':') as ['function' | 'industry', string]
  const asc = mode === 'fewest'
  const known = new Map(INDUSTRIES.map((i) => [i.code, i]))
  const pool = stats.filter((e) => e.kind === kind && e.coded >= 1000 && (kind === 'function' ? e.key !== '*' : known.has(e.key)))
  const ranked: Ranked[] = pool.map((e) => {
    const bucket = CRAWLER_INDUSTRY_BUCKET[e.key]
    const v = share(e.degree4, e.coded)
    return {
      key: `${kind}:${e.key}`, name: kind === 'industry' ? bucket ?? known.get(e.key)?.phrase ?? e.key : e.key, sub: kind === 'function' ? 'Job family' : 'Industry',
      href: kind === 'function' ? functionPath(e.key) : bucket ? industryPath(bucket) : null, value: v, valueLabel: pct0(v), n: e.coded, employers: [],
      stats: [{ label: 'Jobs that need a four-year degree', value: nf(e.degree4) }, { label: 'Jobs that do not', value: nf(e.coded - e.degree4) }, { label: 'Jobs matched to an occupation', value: nf(e.coded) }],
    }
  })
  const base = share(pool.reduce((s, e) => s + e.degree4, 0), pool.reduce((s, e) => s + e.coded, 0))
  const noun = kind === 'function' ? 'job families' : 'industries'
  return editionFor(spec, ranked, { label: `all ${noun}`, valueLabel: pct0(base) }, edition, builtAt, prev, {
    minN: 1000, minRanked: spec.minRanked ?? MIN_RANKED, noun, unit: 'jobs matched to an occupation', sampleUnit: 'openings', asc,
    lead: (name, v, scope, b) => `${name} ${asc ? 'has the lowest share' : 'leads'}: ${v} of its jobs are in occupations that typically need a four-year degree${b ? `, against ${b} across ${scope}` : ''}.`,
    method: [
      `A ${kind === 'function' ? 'job family' : 'industry'}'s score is the share of its open professional roles, among those we could match to an occupation, whose occupation typically needs a bachelor's, master's or doctoral degree (Bureau of Labor Statistics).`,
      `${EDU_NOTE} ${kind === 'industry' ? 'The industry is the one our crawler assigns to the employer. ' : 'The job family is the one assigned from the posting title and text. '}Only ${noun} with at least 1,000 matched jobs are ranked. Our board is professional roles, so every share is high compared with the whole economy.`,
    ],
  })
}

const statesOfScope = (spec: Spec): Set<string> | null => (spec.scope.kind === 'national' ? null : new Set(regionById(spec.scope.id)?.states ?? []))

export function rankDegreeCities(
  spec: Spec, rows: DegreeCityRow[], base: (r: DegreeCityRow) => CityStat | undefined, info: (c: CityStat) => PlaceInfo, edition: string, builtAt: string, prev: Map<string, number> | null,
): RankingEdition | null {
  const states = statesOfScope(spec)
  const byShare = spec.measure === 'dg_cityshare'
  const nat = spec.scope.kind === 'national'
  const minBelow = byShare ? (nat ? 20 : 12) : nat ? 60 : 15
  const minCoded = byShare ? (nat ? 200 : 80) : nat ? 100 : 60
  const ranked: Ranked[] = []
  for (const r of rows) {
    if (states && !states.has(r.st)) continue
    const c = base(r)
    if (!c || c.topShare > MAX_EMPLOYER_SHARE || r.coded < minCoded || r.below < minBelow) continue
    const p = info(c)
    const v = byShare ? share(r.below, r.coded) : r.below
    ranked.push({
      key: `${c.st}|${c.city}`, name: p.name, sub: c.st, href: p.href, value: v, valueLabel: byShare ? pct0(v) : `${nf(v)} jobs`, n: r.coded, employers: c.employers,
      stats: [{ label: 'Jobs that do not need a four-year degree', value: nf(r.below) }, { label: 'Share of the city\'s jobs', value: pct0(share(r.below, r.coded)) }, { label: 'Jobs matched to an occupation', value: nf(r.coded) }],
    })
  }
  const tot = rows.filter((r) => !states || states.has(r.st))
  const baseline = byShare ? { label: 'all cities in our data', valueLabel: pct0(share(tot.reduce((s, r) => s + r.below, 0), tot.reduce((s, r) => s + r.coded, 0))) } : null
  return editionFor(spec, ranked, baseline, edition, builtAt, prev, {
    minN: minCoded, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'cities', unit: 'jobs matched to an occupation', sampleUnit: 'openings',
    lead: (name, v, scope, b) => byShare ? `${name} leads ${scope}: ${v} of its jobs are in occupations that do not typically need a four-year degree${b ? `, against ${b} across all cities in our data` : ''}.`
      : `${name} has the most jobs that do not need a four-year degree in ${scope}: ${v} in our data.`,
    method: [
      `A city's score is ${byShare ? 'the share of' : 'the number of'} its open professional roles whose occupation typically needs less than a bachelor's degree: an associate degree, a postsecondary certificate, some college, a high school diploma or no formal credential (Bureau of Labor Statistics).`,
      `${EDU_NOTE} Only cities with at least ${nf(minBelow)} such jobs${byShare || true ? ` and ${nf(minCoded)} matched jobs` : ''} are ranked, and a city where one employer posts at least half the openings is not ranked, so a single company cannot decide a city's score. Our board is professional roles, so these are a small share everywhere.`,
    ],
  })
}

const fieldStats = (field: string, groups: GroupStat[]) => {
  const g = groups.find((x) => x.kind === 'field' && x.key === field)
  return g ? [{ label: 'Open jobs', value: nf(g.n) }, { label: 'Median posted pay', value: payOf(g) }] : []
}

/** Majors by degrees awarded, by colleges offering them, or by the change in degrees awarded. Federal data only: no board read. */
export function rankMajors(spec: Spec, groups: GroupStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const m = spec.measure
  const asc = spec.fn === 'fewest' || spec.fn === 'slow'
  const grow = m === 'dg_majorgrow'
  const schools = m === 'dg_majorschools'
  // "Fewest" lists keep to majors that are real programs, not a code a handful of colleges report.
  const min = grow ? 1000 : asc ? (schools ? 200 : 300) : 0
  const minSchools = asc ? 5 : 0
  const pool = MAJORS.filter((x) => x.total >= Math.max(min, 1) && x.schools >= minSchools && (!grow || majorChange(x, 1000) != null))
  const total = MAJORS.reduce((s, x) => s + x.total, 0)
  const ranked: Ranked[] = pool.map((x: Major) => {
    const ch = majorChange(x, 1000)
    const v = grow ? (ch as number) : schools ? x.schools : x.total
    return {
      key: `major:${x.cip}`, name: x.title, sub: x.field ?? 'Leads to many kinds of work', href: majorPath(x), value: v, n: x.total, employers: [],
      valueLabel: grow ? signed(v) : schools ? `${nf(v)} colleges` : `${nf(v)} degrees`,
      stats: [
        { label: `Degrees awarded, ${MAJOR_YEAR}`, value: nf(x.total) },
        { label: 'Share of all degrees', value: `${(share(x.total, total) * 100).toFixed(1)}%` },
        { label: 'Colleges awarding it', value: nf(x.schools) },
        { label: `Change since ${MAJOR_BASE_YEAR}`, value: ch != null ? signed(ch) : 'Too small to say' },
        ...(x.field ? fieldStats(x.field, groups).map((s) => ({ ...s, label: `${s.label} in ${x.field}` })) : []),
      ],
    }
  })
  const what = grow ? (asc ? 'the fastest-shrinking number of graduates' : 'the fastest-growing number of graduates') : schools ? `is offered at the ${asc ? 'fewest' : 'most'} colleges` : `the ${asc ? 'fewest' : 'most'} graduates`
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: Math.max(min, 1), minRanked: spec.minRanked ?? MIN_RANKED, noun: 'majors', unit: 'degrees awarded', sampleUnit: 'degrees', asc,
    lead: (name, v) => grow ? `${name} has ${what} of the college majors: ${v} in degrees awarded from ${MAJOR_BASE_YEAR} to ${MAJOR_YEAR}.`
      : schools ? `${name} ${what} of the college majors: ${v} award degrees in it.` : `${name} has ${what} of the college majors: ${v} awarded in ${MAJOR_YEAR}.`,
    method: [
      `A major is a federal program code series (CIP), such as Computer Science or Registered Nursing. ${grow ? `A major's score is the change in its degrees awarded at bachelor's level and above from ${MAJOR_BASE_YEAR} to ${MAJOR_YEAR}.` : schools ? "A major's score is the number of colleges that awarded at least one degree in it at bachelor's level and above." : "A major's score is the number of degrees awarded in it at bachelor's level and above."}`,
      `${SUPPLY_NOTE} ${min > 0 ? `Only majors with at least ${nf(min)} degrees a year${minSchools ? ` at ${minSchools} or more colleges` : ''} are ranked.` : ''} The degree field beside each major is the kind of work its graduates usually enter; the open jobs and pay shown for it come from our job data.`.trim(),
    ],
  })
}

/** Open four-year-degree jobs in a field for every 100 degrees the field's majors award a year. */
export function rankFieldRatio(spec: Spec, groups: GroupStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const supply = fieldSupply()
  const asc = spec.fn === 'fewest'
  const fields = groups.filter((g) => g.kind === 'field' && supply.has(g.key) && g.n >= 300 && (supply.get(g.key)?.total ?? 0) >= 5000 && fieldCovered(g.key, g.n))
  const ranked: Ranked[] = fields.map((g) => {
    const sup = supply.get(g.key)!
    const v = (g.n / sup.total) * 100
    return {
      key: `field:${g.key}`, name: g.key, sub: 'Field of study', href: fieldMajorsPath(g.key), value: v, n: g.n, employers: [], valueLabel: `${v.toFixed(1)} per 100`,
      stats: [{ label: 'Open jobs', value: nf(g.n) }, { label: `Degrees awarded, ${MAJOR_YEAR}`, value: nf(sup.total) }, { label: 'Majors that lead to it', value: nf(sup.majors) }, { label: 'Median posted pay', value: payOf(g) }],
    }
  })
  const jobs = fields.reduce((s, g) => s + g.n, 0)
  const grads = fields.reduce((s, g) => s + supply.get(g.key)!.total, 0)
  return editionFor(spec, ranked, { label: 'all fields', valueLabel: `${((jobs / Math.max(grads, 1)) * 100).toFixed(1)} per 100` }, edition, builtAt, prev, {
    minN: 300, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'degrees', unit: 'open jobs', sampleUnit: 'openings', asc,
    lead: (name, v, _s, b) => `${name} has the ${asc ? 'fewest' : 'most'} open jobs for each new graduate of the degree fields: ${v} graduates a year${b ? `, against ${b} across all fields` : ''}.`,
    method: [
      "A field's score is the number of its open professional roles for every 100 degrees awarded a year in the majors that lead to it. Open jobs are the roles on our board today whose occupation typically needs a bachelor's, master's or doctoral degree; graduates are a year of new degrees. The figure compares fields with each other: it is not the chance that any one graduate is hired.",
      `${SUPPLY_NOTE} Each major is matched to the field its graduates usually enter, our own judgment on the program code, and majors such as English, history or the arts that lead to many kinds of work are left out. ${EDU_NOTE} Only fields with at least 300 open jobs and 5,000 degrees a year are ranked. ${COVERAGE_NOTE}`,
    ],
  })
}

/** Fields by open jobs or posted pay at one career stage. */
export function rankFieldStage(spec: Spec, groups: GroupStat[], edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const st = spec.fn as Stage
  const pay = spec.measure === 'dg_stagepay'
  const label = STAGE_LABEL[st]
  const rows = groups.filter((g) => g.kind === 'stage' && g.key.endsWith(`|${st}`))
  const all = new Map(groups.filter((g) => g.kind === 'field').map((g) => [g.key, g]))
  const pool = rows.filter((g) => g.n >= 100 && fieldCovered(g.key.split('|')[0], all.get(g.key.split('|')[0])?.n ?? 0) && (!pay || (g.paid >= 30 && g.payMed != null)))
  const ranked: Ranked[] = pool.map((g) => {
    const field = g.key.split('|')[0]
    const v = pay ? (g.payMed as number) : g.n
    const others = STAGES.filter((x) => x !== st).map((x) => groups.find((y) => y.kind === 'stage' && y.key === `${field}|${x}`))
    return {
      key: `field:${field}`, name: field, sub: 'Field of study', href: fieldMajorsPath(field), value: v, n: g.n, employers: [], valueLabel: pay ? usdK(v) : `${nf(v)} jobs`,
      stats: [
        { label: `${label.name} jobs`, value: nf(g.n) },
        { label: `Share of the field's jobs`, value: pct0(share(g.n, all.get(field)?.n ?? 0)) },
        { label: `${label.name} median pay`, value: payOf(g) },
        ...STAGES.filter((x) => x !== st).map((x, i) => ({ label: `${STAGE_LABEL[x].name} median pay`, value: others[i] ? payOf(others[i]!) : 'Not enough pay data' })),
      ],
    }
  })
  return editionFor(spec, ranked, null, edition, builtAt, prev, {
    minN: 100, minRanked: spec.minRanked ?? MIN_RANKED, noun: 'degrees', unit: `${label.name.toLowerCase()} open jobs`, sampleUnit: 'openings',
    lead: (name, v) => pay ? `${name} has the highest median posted pay for ${label.name.toLowerCase()} roles of the degree fields: ${v} a year.` : `${name} has the most ${label.name.toLowerCase()} open jobs of the degree fields: ${v} in our data.`,
    method: [
      `A career stage comes from each posting's seniority level. ${label.name} covers ${label.desc}. ${pay ? `A field's score is the median advertised annual salary of its ${label.name.toLowerCase()} roles that post a salary range.` : `A field's score is the number of its open ${label.name.toLowerCase()} professional roles.`}`,
      `A degree field is a group of occupations usually reached through the same kind of study, and only occupations that typically need a bachelor's, master's or doctoral degree are included. ${EDU_NOTE} Only fields with at least 100 such jobs${pay ? ' and 30 that post pay' : ''} are ranked. ${COVERAGE_NOTE}`,
    ],
  })
}

/** One degree field's figures for the majors pages, written with each monthly build so a page never scans the board. */
export interface DegreeFieldFigure {
  field: string
  open: number
  /** False when our board sees too few of the field's jobs to report it (fieldCovered); its pay and jobs per graduate are then null. Missing on rows built before 2026-11-18. */
  covered?: boolean
  /** Median posted pay, or null when fewer than 20 roles post pay. */
  pay: number | null
  growth: number | null
  /** Degrees awarded a year in its majors, and open jobs per 100 of them. */
  grads: number
  perHundred: number | null
  stages: Record<Stage, { open: number; pay: number | null }>
}
export interface DegreeFieldFigures {
  edition: string
  fields: DegreeFieldFigure[]
  /** Open jobs and median posted pay by state, for the fields our board covers: state -> field -> [open jobs, pay or null]. Missing on rows built before 2026-11-18. */
  states?: Record<string, Record<string, [number, number | null]>>
}

/** A stored row as the pages read it: a field our board does not cover shows no pay or jobs per graduate, whenever it was built. */
export function withCoverage(f: DegreeFieldFigures): DegreeFieldFigures {
  return {
    ...f,
    fields: f.fields.map((x) => {
      const covered = x.covered ?? fieldCovered(x.field, x.open)
      if (covered) return { ...x, covered }
      const stages = Object.fromEntries(Object.entries(x.stages).map(([k, v]) => [k, { ...v, pay: null }])) as DegreeFieldFigure['stages']
      return { ...x, covered, pay: null, perHundred: null, stages }
    }),
  }
}

export function degreeFieldFigures(groups: GroupStat[], edition: string): DegreeFieldFigures {
  const supply = fieldSupply()
  const payOrNull = (g: GroupStat | undefined) => (g && g.payMed != null && g.paid >= 20 ? Math.round(g.payMed) : null)
  const fields = groups.filter((g) => g.kind === 'field').map((g): DegreeFieldFigure => {
    const grads = supply.get(g.key)?.total ?? 0
    const st = (x: Stage) => groups.find((y) => y.kind === 'stage' && y.key === `${g.key}|${x}`)
    const cov = fieldCovered(g.key, g.n)
    return {
      field: g.key, open: g.n, covered: cov, pay: cov ? payOrNull(g) : null, growth: weightedGrowth(fieldCodes(g.key)), grads, perHundred: cov && grads >= 1000 ? Math.round((g.n / grads) * 1000) / 10 : null,
      stages: Object.fromEntries(STAGES.map((x) => [x, { open: st(x)?.n ?? 0, pay: cov ? payOrNull(st(x)) : null }])) as DegreeFieldFigure['stages'],
    }
  })
  const covered = new Set(fields.filter((f) => f.covered).map((f) => f.field))
  const states: NonNullable<DegreeFieldFigures['states']> = {}
  for (const g of groups) {
    if (g.kind !== 'statefield') continue
    const [st, field] = g.key.split('|')
    if (!covered.has(field) || !/^[A-Z]{2}$/.test(st)) continue
    ;(states[st] ??= {})[field] = [g.n, g.payMed != null && g.paid >= 20 ? Math.round(g.payMed) : null]
  }
  return { edition, fields: fields.sort((a, b) => b.open - a.open), states }
}

/** Dispatches one degree spec to its ranker. */
export function rankDegrees(
  spec: Spec,
  data: { socs: SocStat[]; groups: GroupStat[]; entities: DegreeEntityStat[]; cityRows: DegreeCityRow[]; base: (r: DegreeCityRow) => CityStat | undefined; info: (c: CityStat) => PlaceInfo },
  edition: string, builtAt: string, prev: Map<string, number> | null,
): RankingEdition | null {
  const m = spec.measure
  if (m === 'dg_major' || m === 'dg_majorschools' || m === 'dg_majorgrow') return rankMajors(spec, data.groups, edition, builtAt, prev)
  if (m === 'dg_fieldratio') return rankFieldRatio(spec, data.groups, edition, builtAt, prev)
  if (m === 'dg_stage' || m === 'dg_stagepay') return rankFieldStage(spec, data.groups, edition, builtAt, prev)
  if (m === 'dg_field' || m === 'dg_fieldpay' || m === 'dg_fieldgrow') return rankFields(spec, data.groups, edition, builtAt, prev)
  if (m === 'dg_level' || m === 'dg_levelpay') return rankLevels(spec, data.groups, edition, builtAt, prev)
  if (m === 'dg_occ' || m === 'dg_occpay' || m === 'dg_occgrow') return rankOccupations(spec, data.socs, edition, builtAt, prev)
  if (m === 'dg_share') return rankDegreeShare(spec, data.entities, edition, builtAt, prev)
  return rankDegreeCities(spec, data.cityRows, data.base, data.info, edition, builtAt, prev)
}
