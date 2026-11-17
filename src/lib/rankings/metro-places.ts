// The best places for white-collar professionals: metro areas ranked on sixteen criteria, each published as its own list, and an
// all-round list that weights them. Every job, pay, growth and layoff figure is read through a white-collar lens (Census major
// occupation groups 1 and 2, the jobs-report definition). Pure: no database, no clock beyond the dates passed in.
//
// A metro is its counties (Census CBSA delineation, 2023, as in metro-compare.json). County figures are added up (counts) or
// averaged by population (rates). A criterion with several parts scores each part as a percentile among the eligible metros
// (100 is best) and averages them by weight; the all-round score averages the criterion scores by weight.

import { AI_EXPOSED_SECTORS, type CountyContextData } from '@/lib/workforce/county-context'
import { KNOWLEDGE_SECTORS } from '@/lib/workforce/sector'
import { payAfterLiving } from '@/lib/rankings/living-cost'
import { percentiles } from '@/lib/rankings/composites'
import { editionFor, type Spec } from '@/lib/rankings/build-edition'
import { REGIONS } from '@/lib/rankings/regions'
import { nf, pct0, usdK } from '@/lib/rankings/measures'
import type { RankComponent, RankingEdition, WhitePlacesMeasureId } from '@/lib/rankings/types'

// ---- Inputs ----

export interface MetroDef { cbsa: string; name: string; counties: string[]; rpp: number | null; housingRpp?: number | null }

/** One county's public figures and the counts we derive for it. */
export interface CountyFacts {
  population: number | null
  laborForce: number | null
  /** Share of workers in white-collar occupations, 0 to 1 (Census ACS). */
  whiteCollarShare: number | null
  /** Estimated white-collar unemployment rate, percent (county rate split by the national white/blue-collar ratio). */
  wcUnemp: number | null
  colleges: number
  enrollment: number
  ajc: number
  /** Public two-year (community and technical) colleges. */
  communityColleges: number
  /** Economic development, workforce and job-training organizations based in the county (IRS nonprofit records). */
  supportOrgs: number
  /** Workers in WARN notices of the last 12 months, blue-collar industries left out; null where the state publishes none. */
  layoffWorkers: number | null
}

/** White-collar openings in one county from the board scan. */
export interface WcCounts {
  n: number
  paid: number
  /** Each city's median posted pay with the number of openings that post pay, for a weighted median. */
  pay: [number, number][]
  flex: number
  /** Median posted pay of openings that ask for AI skills, and of those that do not, by city, with the openings behind each. */
  aiPay: [number, number][]
  plainPay: [number, number][]
  /** Openings with an occupation code, and the sum of their occupation group's observed AI exposure. */
  socN: number
  aiSum: number
}

export interface CommunityDoc { fields: string[]; counties: Record<string, (number | null)[]> }

export interface MetroInputs {
  metros: MetroDef[]
  counties: Map<string, CountyFacts>
  postings: Map<string, WcCounts>
  context: CountyContextData
  community: CommunityDoc
  housing: (cbsa: string) => { rent?: number; home?: number } | null
  /** Open state retraining, job-seeker support and relocation programs, by state code. */
  statePrograms: Map<string, number>
}

// ---- The metro figures ----

export interface MetroStat {
  cbsa: string
  /** "Raleigh-Cary" and "NC": the metro's cities and its states. */
  name: string
  states: string
  st: string
  fullName: string
  counties: string[]
  population: number
  wcWorkers: number
  openings: number
  openingsPer1k: number | null
  wcGrowth: number | null
  payMed: number | null
  payAdj: number | null
  homeToPay: number | null
  rentToPay: number | null
  permitsPer1k: number | null
  wcUnemp: number | null
  layoffsPer1k: number | null
  aiSectorShare: number | null
  aiOpeningExposure: number | null
  ajcPer100k: number | null
  communityCollegesPer100k: number | null
  supportOrgsPer100k: number | null
  statePrograms: number | null
  aiPayPremium: number | null
  enrollPer1k: number | null
  colleges: number
  childCareCost: number | null
  testScore: number | null
  childCareCenters: number | null
  diversity: number | null
  broadband: number | null
  schoolFunding: number | null
  libraries: number | null
  parks: number | null
  longCommute: number | null
  wcShare: number | null
  flexShare: number | null
}

const sumOf = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0)

/** The median of values, each counted by its weight. */
export function weightedMedian(pairs: [number, number][]): number | null {
  const ok = pairs.filter(([, w]) => w > 0).sort((a, b) => a[0] - b[0])
  const total = sumOf(ok, ([, w]) => w)
  if (!total) return null
  let run = 0
  for (const [v, w] of ok) { run += w; if (run >= total / 2) return v }
  return ok[ok.length - 1][0]
}

/** "Louisville/Jefferson County, KY-IN" → name "Louisville/Jefferson County", states "KY-IN", first state "KY". */
export function splitMetroName(full: string): { name: string; states: string; st: string } {
  const i = full.lastIndexOf(', ')
  const name = i > 0 ? full.slice(0, i) : full
  const states = i > 0 ? full.slice(i + 2) : ''
  return { name, states, st: states.split('-')[0] ?? '' }
}

/** The metro's first-named city ("Raleigh" in "Raleigh-Cary"), for the link to its place page. */
export const principalCity = (name: string) => name.split(/[-–]/)[0].replace(/\/.*$/, '').trim()

export function buildMetroStats(input: MetroInputs): MetroStat[] {
  const { context, community } = input
  const field = (f: string) => community.fields.indexOf(f)
  const F = Object.fromEntries(['homicides', 'childCareCost', 'childCareCenters', 'reading', 'math', 'broadband', 'schoolFunding', 'libraries', 'parks', 'longCommute', 'permitUnits'].map((f) => [f, field(f)]))
  const sectorIdx = context.sectors.map((code, i) => ({ code, i }))
  const out: MetroStat[] = []
  for (const m of input.metros) {
    const cs = m.counties.map((f) => ({ fips: f, c: input.counties.get(f) })).filter((x): x is { fips: string; c: CountyFacts } => !!x.c && (x.c.population ?? 0) > 0)
    if (!cs.length) continue
    const population = sumOf(cs, (x) => x.c.population ?? 0)
    const wcWorkers = sumOf(cs, (x) => (x.c.laborForce ?? 0) * (x.c.whiteCollarShare ?? 0))
    const laborForce = sumOf(cs, (x) => x.c.laborForce ?? 0)
    // A population-weighted mean over the counties that report a figure; null when they hold under half the metro's people.
    const popMean = (get: (fips: string, c: CountyFacts) => number | null | undefined) => {
      let num = 0
      let den = 0
      for (const x of cs) {
        const v = get(x.fips, x.c)
        if (v == null || !Number.isFinite(v)) continue
        num += v * (x.c.population as number)
        den += x.c.population as number
      }
      return den >= population / 2 ? num / den : null
    }
    const comm = (name: string) => (fips: string) => {
      const row = community.counties[fips]
      const i = F[name]
      return row && i >= 0 ? row[i] : null
    }
    // Postings
    const ps = cs.map((x) => input.postings.get(x.fips)).filter((p): p is WcCounts => !!p)
    const openings = sumOf(ps, (p) => p.n)
    const paid = sumOf(ps, (p) => p.paid)
    const payMed = paid >= MIN_PAID ? weightedMedian(ps.flatMap((p) => p.pay)) : null
    const socN = sumOf(ps, (p) => p.socN)
    // QCEW sectors: white-collar growth, AI-exposed share, diversity
    let wcThen = 0, wcNow = 0, total = 0, exposed = 0
    const bySector = new Map<string, number>()
    for (const x of cs) {
      const row = context.counties[x.fips]
      if (!row) continue
      for (const { code, i } of sectorIdx) {
        const a = row.e[2 * i], b = row.e[2 * i + 1]
        if (b >= 0) {
          total += b
          bySector.set(code, (bySector.get(code) ?? 0) + b)
          if (AI_EXPOSED_SECTORS.has(code)) exposed += b
        }
        if (KNOWLEDGE_SECTORS.has(code) && a >= 0 && b >= 0) { wcThen += a; wcNow += b }
      }
    }
    const diversity = total > 0 ? 1 - sumOf([...bySector.values()], (v) => (v / total) ** 2) : null
    const permits = cs.map((x) => comm('permitUnits')(x.fips))
    const housing = input.housing(m.cbsa)
    const { name, states, st } = splitMetroName(m.name.replace(/ (Metro|Micro) Area$/, ''))
    const reading = popMean((f) => comm('reading')(f))
    const math = popMean((f) => comm('math')(f))
    out.push({
      cbsa: m.cbsa, name, states, st, fullName: m.name, counties: m.counties, population, wcWorkers, openings,
      openingsPer1k: wcWorkers > 0 ? (openings / wcWorkers) * 1000 : null,
      wcGrowth: wcThen >= 1000 ? (wcNow - wcThen) / wcThen : null,
      payMed,
      payAdj: payMed != null && m.rpp ? payAfterLiving(payMed, { rpp: m.rpp, housingRpp: m.housingRpp ?? null, home: housing?.home ?? null, rent: housing?.rent ?? null, basis: 'metro' }) : null,
      homeToPay: payMed && housing?.home ? housing.home / payMed : null,
      rentToPay: payMed && housing?.rent ? (housing.rent * 12) / payMed : null,
      permitsPer1k: permits.some((p) => p != null) ? (sumOf(permits, (p) => p ?? 0) / population) * 1000 : null,
      wcUnemp: (() => {
        let num = 0, den = 0
        for (const x of cs) {
          const w = (x.c.laborForce ?? 0) * (x.c.whiteCollarShare ?? 0)
          if (x.c.wcUnemp == null || !w) continue
          num += x.c.wcUnemp * w; den += w
        }
        return den ? num / den : null
      })(),
      layoffsPer1k: (() => {
        const known = cs.filter((x) => x.c.layoffWorkers != null)
        const w = sumOf(known, (x) => (x.c.laborForce ?? 0) * (x.c.whiteCollarShare ?? 0))
        return w > 0 && w >= wcWorkers / 2 ? (sumOf(known, (x) => x.c.layoffWorkers as number) / w) * 1000 : null
      })(),
      aiSectorShare: total > 0 ? exposed / total : null,
      aiOpeningExposure: socN >= 50 ? sumOf(ps, (p) => p.aiSum) / socN : null,
      ajcPer100k: laborForce > 0 ? (sumOf(cs, (x) => x.c.ajc) / laborForce) * 100_000 : null,
      communityCollegesPer100k: (sumOf(cs, (x) => x.c.communityColleges) / population) * 100_000,
      supportOrgsPer100k: (sumOf(cs, (x) => x.c.supportOrgs) / population) * 100_000,
      statePrograms: input.statePrograms.get(st) ?? null,
      aiPayPremium: (() => {
        const ai = ps.flatMap((p) => p.aiPay)
        const plain = ps.flatMap((p) => p.plainPay)
        if (sumOf(ai, ([, n]) => n) < MIN_AI_PAID || sumOf(plain, ([, n]) => n) < MIN_PAID) return null
        const a = weightedMedian(ai), b = weightedMedian(plain)
        return a != null && b ? a / b - 1 : null
      })(),
      enrollPer1k: (sumOf(cs, (x) => x.c.enrollment) / population) * 1000,
      colleges: sumOf(cs, (x) => x.c.colleges),
      childCareCost: popMean((f) => comm('childCareCost')(f)),
      testScore: reading != null && math != null ? (reading + math) / 2 : reading ?? math,
      childCareCenters: popMean((f) => comm('childCareCenters')(f)),
      diversity,
      broadband: popMean((f) => comm('broadband')(f)),
      schoolFunding: popMean((f) => comm('schoolFunding')(f)),
      libraries: popMean((f) => comm('libraries')(f)),
      parks: popMean((f) => comm('parks')(f)),
      longCommute: popMean((f) => comm('longCommute')(f)),
      wcShare: population > 0 ? popMean((_, c) => c.whiteCollarShare) : null,
      flexShare: openings > 0 ? sumOf(ps, (p) => p.flex) / openings : null,
    })
  }
  return out
}

// ---- Criteria ----

const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`
const one = (x: number) => x.toFixed(1)
const two = (x: number) => x.toFixed(2)
const usd = (x: number) => `${x < 0 ? '−' : '+'}$${nf(Math.abs(x))}`

interface Part { label: string; weight: number; value: (m: MetroStat) => number | null; show: (v: number) => string; lowerIsBetter?: boolean }

export interface Criterion {
  id: Exclude<WhitePlacesMeasureId, 'wp_all'>
  /** Short name, for the all-round list's breakdown. */
  label: string
  title: string
  slug: string
  weight: number
  /** What the criterion measures, in one sentence. */
  what: string
  parts: Part[]
  lead: (name: string, value: string, scope: string) => string
}

/** Metros below this many people, or with fewer white-collar openings than MIN_OPENINGS, are not ranked. */
export const MIN_POPULATION = 150_000
export const MIN_OPENINGS = 100
/** Openings that post a salary a metro needs before its median pay (and the pay and housing criteria built on it) is shown. */
export const MIN_PAID = 25
/** Openings that ask for AI skills and post a salary a metro needs for its AI pay premium. */
export const MIN_AI_PAID = 10

export const CRITERIA: Criterion[] = [
  {
    id: 'wp_open', label: 'White-collar job openings', weight: 12,
    title: 'Metros with the most white-collar job openings per worker', slug: 'metros-with-the-most-white-collar-job-openings',
    what: 'Open white-collar roles per 1,000 white-collar workers who live there, so a small metro with a busy market can beat a big one.',
    parts: [{ label: 'Openings per 1,000 white-collar workers', weight: 1, value: (m) => m.openingsPer1k, show: one }],
    lead: (n, v, s) => `${n} has the most white-collar openings per worker in ${s}: ${v} open roles for every 1,000 white-collar workers.`,
  },
  {
    id: 'wp_grow', label: 'White-collar job growth', weight: 10,
    title: 'Metros with the fastest white-collar job growth', slug: 'metros-with-the-fastest-white-collar-job-growth',
    what: 'The change in private-sector jobs in the white-collar sectors (information, finance and insurance, professional and technical services, management of companies) from 2022 to 2025.',
    parts: [{ label: 'White-collar sector jobs, 2022 to 2025', weight: 1, value: (m) => m.wcGrowth, show: signed }],
    lead: (n, v, s) => `${n} grew its white-collar sector jobs fastest in ${s}: ${v} from 2022 to 2025.`,
  },
  {
    id: 'wp_pay', label: 'White-collar pay after cost of living', weight: 11,
    title: 'Metros with the best white-collar pay after cost of living', slug: 'metros-with-the-best-white-collar-pay-after-cost-of-living',
    what: 'The median salary posted on white-collar openings, minus a year of owning the median home, with everything else priced locally (BEA price parity with housing taken out), so it reads as what the pay leaves you.',
    parts: [{ label: 'Median white-collar pay after housing and local prices', weight: 1, value: (m) => m.payAdj, show: usdK }],
    lead: (n, v, s) => `White-collar pay goes furthest in ${n}: after a year of owning the median home, the median posted salary leaves what ${v} buys at national prices, the best in ${s}.`,
  },
  {
    id: 'wp_house', label: 'Housing costs against salaries', weight: 7,
    title: 'Metros where housing is most affordable on a white-collar salary', slug: 'metros-with-the-most-affordable-housing-for-white-collar-salaries',
    what: 'The median home value and a year of median rent, each divided by the median posted white-collar salary.',
    parts: [
      { label: 'Median home value ÷ median white-collar pay', weight: 60, value: (m) => m.homeToPay, show: (v) => `${one(v)}×`, lowerIsBetter: true },
      { label: 'A year of median rent ÷ median white-collar pay', weight: 40, value: (m) => m.rentToPay, show: pct0, lowerIsBetter: true },
    ],
    lead: (n, v, s) => `Housing is most affordable on a white-collar salary in ${n}, with a score of ${v} among metros in ${s}.`,
  },
  {
    id: 'wp_supply', label: 'Housing supply', weight: 3,
    title: 'Metros building the most new housing', slug: 'metros-building-the-most-new-housing',
    what: 'New housing units permitted in the latest year per 1,000 residents: where housing stock is growing, prices are under less pressure.',
    parts: [{ label: 'New homes permitted per 1,000 residents', weight: 1, value: (m) => m.permitsPer1k, show: one }],
    lead: (n, v, s) => `${n} is adding housing fastest in ${s}: ${v} new homes permitted for every 1,000 residents in a year.`,
  },
  {
    id: 'wp_unemp', label: 'White-collar unemployment', weight: 6,
    title: 'Metros with the lowest white-collar unemployment', slug: 'metros-with-the-lowest-white-collar-unemployment',
    what: 'The estimated unemployment rate of white-collar workers: each county\'s BLS rate, split by its white-collar share and the national white- to blue-collar unemployment ratio from the Current Population Survey.',
    parts: [{ label: 'White-collar unemployment (estimated)', weight: 1, value: (m) => m.wcUnemp, show: (v) => `${one(v)}%`, lowerIsBetter: true }],
    lead: (n, v, s) => `${n} has the lowest estimated white-collar unemployment in ${s}, at ${v}.`,
  },
  {
    id: 'wp_layoff', label: 'Fewest white-collar layoffs', weight: 8,
    title: 'Metros with the fewest white-collar layoffs', slug: 'metros-with-the-fewest-white-collar-layoffs',
    what: 'Workers named in WARN layoff notices over the last 12 months per 1,000 white-collar workers. Notices in blue-collar industries (manufacturing, construction, retail, warehousing, hotels and food) are left out; a notice that names no county or city is shared across its state by white-collar workers.',
    parts: [{ label: 'Workers laid off per 1,000 white-collar workers', weight: 1, value: (m) => m.layoffsPer1k, show: one, lowerIsBetter: true }],
    lead: (n, v, s) => `${n} had the fewest white-collar layoffs in ${s}: ${v} workers in layoff notices per 1,000 white-collar workers over the last year.`,
  },
  {
    id: 'wp_ai', label: 'Least exposed to AI', weight: 6,
    title: 'Metros whose jobs and industries are least exposed to AI', slug: 'metros-least-exposed-to-ai',
    what: 'Half the share of private-sector jobs in the industries most exposed to AI (information, finance, professional services, management of companies, admin and staffing), half the average observed AI exposure of the metro\'s open white-collar jobs by occupation (Anthropic Economic Index).',
    parts: [
      { label: 'Jobs in AI-exposed industries', weight: 50, value: (m) => m.aiSectorShare, show: pct0, lowerIsBetter: true },
      { label: 'AI exposure of open white-collar jobs', weight: 50, value: (m) => m.aiOpeningExposure, show: (v) => `${(v * 100).toFixed(1)}%`, lowerIsBetter: true },
    ],
    lead: (n, v, s) => `${n}'s jobs and industries are the least exposed to AI among metros in ${s}, with a score of ${v}.`,
  },
  {
    id: 'wp_aipay', label: 'Pay premium for AI skills', weight: 5,
    title: 'Metros where AI skills pay the most', slug: 'metros-where-ai-skills-pay-the-most',
    what: 'How much higher the median posted salary is for white-collar openings that ask for AI skills than for those that do not, in the same metro.',
    parts: [{ label: 'Posted pay premium for AI skills', weight: 1, value: (m) => m.aiPayPremium, show: (v) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))}%` }],
    lead: (n, v, s) => `AI skills pay the most in ${n}: white-collar openings that ask for them post a median salary ${v} against those that do not, the highest in ${s}.`,
  },
  {
    id: 'wp_train', label: 'Retraining and local job support', weight: 8,
    title: 'Metros with the most retraining and local job support', slug: 'metros-with-the-most-retraining-and-job-help',
    what: 'American Job Centers (the public offices that fund and arrange retraining) per 100,000 workers, public community and technical colleges per 100,000 residents, workforce development, job-training and economic development organizations per 100,000 residents, and the open state retraining, job-seeker support and relocation programs in the metro\'s state.',
    parts: [
      { label: 'American Job Centers per 100,000 workers', weight: 25, value: (m) => m.ajcPer100k, show: one },
      { label: 'Community and technical colleges per 100,000 residents', weight: 25, value: (m) => m.communityCollegesPer100k, show: two },
      { label: 'Workforce and economic development organizations per 100,000 residents', weight: 25, value: (m) => m.supportOrgsPer100k, show: one },
      { label: 'Open state retraining and support programs', weight: 25, value: (m) => m.statePrograms, show: nf },
    ],
    lead: (n, v, s) => `${n} offers the most retraining and local job support in ${s}, with a score of ${v}.`,
  },
  {
    id: 'wp_edu', label: 'Higher education for upskilling', weight: 5,
    title: 'Metros with the most higher education for upskilling', slug: 'metros-with-the-most-higher-education-for-upskilling',
    what: 'College enrollment per 1,000 residents and the number of colleges and universities in the metro, a measure of the courses and degrees within reach.',
    parts: [
      { label: 'College students per 1,000 residents', weight: 50, value: (m) => m.enrollPer1k, show: (v) => nf(v) },
      { label: 'Colleges and universities', weight: 50, value: (m) => m.colleges, show: nf },
    ],
    lead: (n, v, s) => `${n} has the most higher education within reach in ${s}, with a score of ${v}.`,
  },
  {
    id: 'wp_family', label: 'Family friendly', weight: 5,
    title: 'Best metros for professionals with families', slug: 'best-metros-for-professionals-with-families',
    what: 'The cost of child care for two children as a share of household income, third-grade reading and math scores against the national grade level, and child care centers per 1,000 young children.',
    parts: [
      { label: 'Child care cost, share of income', weight: 40, value: (m) => m.childCareCost, show: pct0, lowerIsBetter: true },
      { label: 'School test scores (grade level)', weight: 40, value: (m) => m.testScore, show: two },
      { label: 'Child care centers per 1,000 children under 5', weight: 20, value: (m) => m.childCareCenters, show: one },
    ],
    lead: (n, v, s) => `${n} is the best metro for professionals with families in ${s}, with a score of ${v}.`,
  },
  {
    id: 'wp_diverse', label: 'Diverse industries', weight: 5,
    title: 'Metros with the most diverse economies', slug: 'metros-with-the-most-diverse-economies',
    what: 'How evenly private-sector jobs are spread across 19 industry sectors (one minus the sum of squared sector shares). A metro that leans on one industry is more exposed when that industry cuts.',
    parts: [{ label: 'Industry diversity (0 to 1)', weight: 1, value: (m) => m.diversity, show: (v) => v.toFixed(3) }],
    lead: (n, v, s) => `${n} has the most diverse economy in ${s}, scoring ${v} on industry diversity.`,
  },
  {
    id: 'wp_invest', label: 'Community investment and infrastructure', weight: 4,
    title: 'Metros with the strongest community investment and infrastructure', slug: 'metros-with-the-strongest-community-investment',
    what: 'Household broadband, school funding against what the schools need, the share of commuters who drive more than 30 minutes alone, libraries per resident and access to parks.',
    parts: [
      { label: 'Households with broadband', weight: 30, value: (m) => m.broadband, show: pct0 },
      { label: 'School funding per student vs. need', weight: 30, value: (m) => m.schoolFunding, show: usd },
      { label: 'Long solo commutes', weight: 20, value: (m) => m.longCommute, show: pct0, lowerIsBetter: true },
      { label: 'Libraries per 10,000 people', weight: 10, value: (m) => m.libraries, show: one },
      { label: 'People near a park', weight: 10, value: (m) => m.parks, show: pct0 },
    ],
    lead: (n, v, s) => `${n} has the strongest community investment and infrastructure in ${s}, with a score of ${v}.`,
  },
  {
    id: 'wp_peers', label: 'Professional community', weight: 2,
    title: 'Metros with the largest share of white-collar workers', slug: 'metros-with-the-largest-share-of-white-collar-workers',
    what: 'The share of workers in white-collar occupations (Census), the size of the professional network you join.',
    parts: [{ label: 'Workers in white-collar occupations', weight: 1, value: (m) => m.wcShare, show: pct0 }],
    lead: (n, v, s) => `${n} has the largest professional community in ${s}: ${v} of its workers are in white-collar occupations.`,
  },
  {
    id: 'wp_flex', label: 'Remote and hybrid options', weight: 3,
    title: 'Metros with the most remote and hybrid white-collar jobs', slug: 'metros-with-the-most-remote-and-hybrid-white-collar-jobs',
    what: 'The share of white-collar openings in the metro that are remote or hybrid.',
    parts: [{ label: 'White-collar openings that are remote or hybrid', weight: 1, value: (m) => m.flexShare, show: pct0 }],
    lead: (n, v, s) => `${n} has the most flexible white-collar jobs in ${s}: ${v} of its openings are remote or hybrid.`,
  },
]

export const ALL_ROUND = {
  slug: 'best-places-for-white-collar-professionals',
  title: 'Best places for white-collar professionals',
  scopedTitle: (phrase: string) => `Best places for white-collar professionals in ${phrase}`,
  scopedSlug: (id: string) => `best-places-for-white-collar-professionals-in-${id}`,
}

export const FAMILY = 'Best places for professionals'

// ---- Scoring ----

export const eligible = (m: MetroStat) => m.population >= MIN_POPULATION && m.openings >= MIN_OPENINGS

/** Percentile (100 best) of each eligible metro on each part, then each criterion's weighted score. A part a metro lacks is
 * left out of its criterion score; a criterion with no parts for the metro is null. */
export function criterionScores(pool: MetroStat[]): Map<string, Record<string, number | null>> {
  const out = new Map<string, Record<string, number | null>>(pool.map((m) => [m.cbsa, {}]))
  for (const c of CRITERIA) {
    const partPct = c.parts.map((p) => {
      const have = pool.filter((m) => p.value(m) != null)
      const pcts = percentiles(have.map((m) => p.value(m) as number))
      return new Map(have.map((m, i) => [m.cbsa, p.lowerIsBetter ? 100 - pcts[i] : pcts[i]]))
    })
    const totalW = sumOf(c.parts, (p) => p.weight)
    for (const m of pool) {
      let num = 0, w = 0
      c.parts.forEach((p, i) => {
        const v = partPct[i].get(m.cbsa)
        if (v != null) { num += v * p.weight; w += p.weight }
      })
      // Every part is needed: a metro missing one has no score on the criterion (and is left out of its list).
      ;(out.get(m.cbsa) as Record<string, number | null>)[c.id] = w === totalW ? num / w : null
    }
  }
  return out
}

/** The all-round score: criterion scores averaged by weight. A metro missing more than 20% of the weight is not scored. */
export function allRoundScore(scores: Record<string, number | null>): number | null {
  // A metro must have every criterion: one it has no figure for leaves it out of the list rather than being guessed.
  let num = 0
  for (const c of CRITERIA) {
    const v = scores[c.id]
    if (v == null) return null
    num += v * c.weight
  }
  return num / totalWeight()
}

export const totalWeight = () => sumOf(CRITERIA, (c) => c.weight)

// ---- Lists ----

const NATIONAL = { kind: 'national' as const, id: 'us', name: 'United States', phrase: 'the United States' }
const slugPart = (phrase: string) => phrase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function whitePlacesSpecs(): Spec[] {
  const out: Spec[] = [{ slug: ALL_ROUND.slug, measure: 'wp_all', scope: NATIONAL, title: ALL_ROUND.title, family: 'Best overall', group: 'metro' }]
  for (const r of REGIONS) {
    out.push({ slug: ALL_ROUND.scopedSlug(slugPart(r.phrase)), measure: 'wp_all', scope: { kind: 'region', id: r.id, name: r.name, phrase: r.phrase }, title: ALL_ROUND.scopedTitle(r.phrase), family: 'Best overall', group: 'metro', minRanked: 5 })
  }
  for (const c of CRITERIA) out.push({ slug: c.slug, measure: c.id, scope: NATIONAL, title: c.title, family: FAMILY, group: 'metro' })
  return out
}

export const COMPONENTS: RankComponent[] = CRITERIA.map((c) => ({ label: c.label, weight: c.weight, slug: c.slug, title: c.title, what: c.what }))

export interface MetroLink { href: string | null }

const METHOD_COMMON = [
  `Places are metro areas (Census core-based statistical areas, 2023 delineation) with at least ${nf(MIN_POPULATION)} residents and ${nf(MIN_OPENINGS)} open white-collar roles. County figures are added up, or averaged by population for rates.`,
  'White-collar means Census major occupation groups 1 and 2 (management, business and financial; professional and related). An opening counts when its occupation code is in those groups, or, where it has no code, when its job family is a professional one (sales, customer success and administrative support are left out).',
]


/** Builds one list. `link` gives a metro's page (its principal city, else its biggest county). */
export function rankWhitePlaces(spec: Spec, stats: MetroStat[], link: (m: MetroStat) => string | null, edition: string, builtAt: string, prev: Map<string, number> | null): RankingEdition | null {
  const pool = stats.filter(eligible)
  const scores = criterionScores(pool)
  const regionStates = spec.scope.kind === 'region' ? new Set(REGIONS.find((r) => r.id === spec.scope.id)?.states ?? []) : null
  const inScope = regionStates ? pool.filter((m) => regionStates.has(m.st)) : pool
  const base = (m: MetroStat) => ({ key: `cbsa:${m.cbsa}`, name: m.name, sub: m.states, href: link(m), employers: [] as string[], n: m.openings })
  const def = { minN: MIN_OPENINGS, minRanked: spec.minRanked ?? 8, noun: 'metro areas' as const, unit: 'white-collar openings', sampleUnit: 'openings' as const }

  if (spec.measure === 'wp_all') {
    const ranked = inScope.flatMap((m) => {
      const s = scores.get(m.cbsa) as Record<string, number | null>
      const score = allRoundScore(s)
      if (score == null) return []
      const show = (id: string) => { const c = CRITERIA.find((x) => x.id === id) as Criterion; const v = c.parts[0].value(m); return v == null ? 'n/a' : c.parts[0].show(v) }
      return [{
        ...base(m), value: score, valueLabel: `${Math.round(score)} / 100`,
        stats: [
          { label: 'Openings per 1,000 white-collar workers', value: show('wp_open') },
          { label: 'Pay after cost of living', value: show('wp_pay') },
          { label: 'White-collar job growth', value: show('wp_grow') },
          { label: 'Home value ÷ pay', value: show('wp_house') },
          { label: 'Laid off per 1,000 white-collar workers', value: show('wp_layoff') },
          { label: 'AI pay premium', value: show('wp_aipay') },
        ],
      }]
    })
    const ed = editionFor(spec, ranked, null, edition, builtAt, prev, {
      ...def,
      lead: (name, v, scope) => `${name} is the best place for white-collar professionals in ${scope}, scoring ${v} across ${CRITERIA.length} measures of jobs, pay, housing, layoffs, AI, retraining, schools and community.`,
      method: [
        `A metro's score is the weighted average of its scores on ${CRITERIA.length} criteria. Each criterion scores a metro by its percentile among the ranked metros nationwide (100 is best), averaging the parts of a criterion that has several. The weights: ${CRITERIA.map((c) => `${c.label.toLowerCase()} ${c.weight}%`).join(', ')}.`,
        'A metro is ranked only if it has a figure for every criterion. Every criterion has its own ranking, linked from this page.',
        ...METHOD_COMMON,
      ],
    })
    if (!ed) return null
    ed.components = COMPONENTS
    ed.faq.splice(1, 0,
      { q: 'What makes a place good for white-collar professionals?', a: `We weigh ${CRITERIA.length} things: ${CRITERIA.map((c) => c.label.toLowerCase()).join(', ')}. Jobs, pay, layoffs and AI exposure are measured for white-collar work only.` },
      { q: 'Why metro areas and not cities?', a: 'People live in one county and work in another. A metro area is the market you job-hunt in, and cost of living is published for metros, not for every city.' },
    )
    return ed
  }

  const c = CRITERIA.find((x) => x.id === spec.measure)
  if (!c) return null
  const single = c.parts.length === 1
  const ranked = inScope.flatMap((m) => {
    const score = (scores.get(m.cbsa) as Record<string, number | null>)[c.id]
    const raw = c.parts[0].value(m)
    const value = single ? raw : score
    if (value == null) return []
    const partStats = c.parts.map((p) => { const v = p.value(m); return { label: p.label, value: v == null ? 'n/a' : p.show(v) } })
    return [{
      ...base(m), value, valueLabel: single ? c.parts[0].show(value) : `${Math.round(value)} / 100`,
      stats: [...partStats, { label: 'White-collar openings', value: nf(m.openings) }, { label: 'Residents', value: nf(m.population) }].slice(0, single ? 3 : Math.max(3, partStats.length)),
    }]
  })
  const asc = single && !!c.parts[0].lowerIsBetter
  const vals = ranked.map((r) => r.value).sort((a, b) => a - b)
  const median = vals.length ? vals[Math.floor(vals.length / 2)] : null
  const ed = editionFor(spec, ranked, single && median != null ? { label: 'the median ranked metro area', valueLabel: c.parts[0].show(median) } : null, edition, builtAt, prev, {
    ...def, asc,
    lead: (name, v, scope) => c.lead(name, v, scope),
    method: [
      c.what,
      ...(single ? [] : [`The score averages each part's percentile among the ranked metros (100 is best), weighted: ${c.parts.map((p) => `${p.label.toLowerCase()} ${p.weight}%`).join(', ')}.`]),
      `This is one of the ${CRITERIA.length} criteria in the ranking of the best places for white-collar professionals, where it carries ${c.weight}% of the score.`,
      ...METHOD_COMMON,
    ],
  })
  if (!ed) return null
  ed.partOf = { slug: ALL_ROUND.slug, title: ALL_ROUND.title, weight: c.weight, criteria: CRITERIA.length }
  return ed
}

