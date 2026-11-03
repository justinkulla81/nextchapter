// What each list ranks and how: the value, how it is shown, the three supporting numbers on each row and the plain-words
// method. Pure, so every rule is unit-tested without a database.

import type { CityStat, CountyStat, MeasureId } from '@/lib/rankings/types'

export const nf = (n: number) => Math.round(n).toLocaleString('en-US')
export const pct0 = (x: number) => `${Math.round(x * 100)}%`
export const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`
export const usdK = (n: number) => `$${Math.round(n / 1000).toLocaleString('en-US')}k`
const signedPct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`
const signedN = (n: number) => `${n >= 0 ? '+' : '−'}${nf(Math.abs(n))}`

export type Scope = 'national' | 'region' | 'state'

/** Local price level, United States = 100, and which figure it is. */
export interface Cost { rpp: number; basis: 'metro' | 'state' }
export interface CityCtx { costOf: (c: CityStat) => Cost | null }

export interface CityMeasure {
  id: Exclude<MeasureId, 'growth' | 'infogrowth' | 'aiskills' | 'aitools' | 'aicerts' | 'skillpay' | 'indjunior' | 'indai' | 'indpay'>
  kind: 'city'
  family: string
  /** Openings a city needs, by scope, in the unit the measure counts. */
  min: Record<Scope, number>
  unit: 'openings'
  qualifies: (c: CityStat, min: number, ctx: CityCtx) => boolean
  value: (c: CityStat, ctx: CityCtx) => number
  valueLabel: (v: number) => string
  /** The number the sample behind the figure is counted in. */
  sample: (c: CityStat) => number
  stats: (c: CityStat, ctx: CityCtx) => { label: string; value: string }[]
  baseline: (all: CityStat[], ctx: CityCtx) => { label: string; valueLabel: string } | null
  lead: (name: string, valueLabel: string, scopeLabel: string, baselineLabel: string | null) => string
  method: string[]
  base: { title: string; slug: string }
  scoped: (phrase: string) => { title: string; slug: (id: string) => string }
}

/** A city where one employer posts more than this share of openings is not ranked: one company would decide its score. */
export const MAX_EMPLOYER_SHARE = 0.5
export const CONCENTRATION_NOTE = `A city where one employer posts more than ${Math.round(MAX_EMPLOYER_SHARE * 100)}% of its openings is not ranked, so a single company cannot decide a city's score.`
const diverse = (c: CityStat) => c.topShare <= MAX_EMPLOYER_SHARE

const payOf = (c: CityStat) => (c.payMed != null && c.paid >= 8 ? usdK(c.payMed) : 'Not enough pay data')
const sum = (xs: CityStat[], f: (c: CityStat) => number) => xs.reduce((s, c) => s + f(c), 0)
const share = (num: number, den: number) => (den > 0 ? num / den : 0)

type BaseId = 'junior' | 'ai' | 'paycost' | 'remote' | 'swe' | 'largest' | 'transparent'
const BASE: Record<BaseId, CityMeasure> = {
  junior: {
    id: 'junior', kind: 'city', family: 'Entry-level', unit: 'openings',
    min: { national: 200, region: 100, state: 100 },
    qualifies: (c, min) => c.n >= min && diverse(c),
    value: (c) => share(c.entry, c.n),
    valueLabel: pct0,
    sample: (c) => c.n,
    stats: (c) => [{ label: 'Entry-level openings', value: nf(c.entry) }, { label: 'All openings', value: nf(c.n) }, { label: 'Openings with pay posted', value: pct0(share(c.paid, c.n)) }],
    baseline: (all) => ({ label: 'all cities in our data', valueLabel: pct0(share(sum(all, (c) => c.entry), sum(all, (c) => c.n))) }),
    lead: (name, v, scope, b) => `${name} leads ${scope} for junior jobs: ${v} of its professional openings are entry-level or early-career${b ? `, against ${b} across all cities in our data` : ''}.`,
    method: [
      'A city\'s score is the share of its open professional roles tagged entry-level or early-career, read from the full posting text.',
      'Only roles verified on the employer\'s own career site in the last week are counted. Internships are left out.',
    ],
    base: { title: 'Best cities for entry-level and junior jobs', slug: 'best-cities-for-junior-jobs' },
    scoped: (p) => ({ title: `Best cities for junior jobs in ${p}`, slug: (id) => `best-cities-for-junior-jobs-in-${id}` }),
  },
  ai: {
    id: 'ai', kind: 'city', family: 'AI', unit: 'openings',
    min: { national: 200, region: 100, state: 100 },
    qualifies: (c, min) => c.n >= min && diverse(c),
    value: (c) => share(c.ai, c.n),
    valueLabel: pct0,
    sample: (c) => c.n,
    stats: (c) => [{ label: 'AI-skill openings', value: nf(c.ai) }, { label: 'All openings', value: nf(c.n) }, { label: 'Median posted pay', value: payOf(c) }],
    baseline: (all) => ({ label: 'all cities in our data', valueLabel: pct0(share(sum(all, (c) => c.ai), sum(all, (c) => c.n))) }),
    lead: (name, v, scope, b) => `${name} leads ${scope} for AI skills: ${v} of its professional openings ask for them${b ? `, against ${b} across all cities in our data` : ''}.`,
    method: [
      'A city\'s score is the share of its open professional roles whose posting names at least one AI skill or tool, found by our AI-skill tagger on the posting text.',
      'The tagger looks for named skills (for example prompt engineering, machine learning, or a named AI tool), not the words "AI-powered" in a company blurb.',
    ],
    base: { title: 'Best cities for AI-skill jobs', slug: 'best-cities-for-ai-jobs' },
    scoped: (p) => ({ title: `Best cities for AI-skill jobs in ${p}`, slug: (id) => `best-cities-for-ai-jobs-in-${id}` }),
  },
  paycost: {
    id: 'paycost', kind: 'city', family: 'Pay', unit: 'openings',
    min: { national: 200, region: 100, state: 100 },
    qualifies: (c, min, ctx) => c.n >= min && diverse(c) && c.paid >= 50 && c.payMed != null && ctx.costOf(c) != null,
    value: (c, ctx) => (c.payMed as number) / ((ctx.costOf(c) as Cost).rpp / 100),
    valueLabel: (v) => usdK(v),
    sample: (c) => c.paid,
    stats: (c, ctx) => {
      const cost = ctx.costOf(c)
      const diff = cost ? cost.rpp / 100 - 1 : 0
      return [
        { label: 'Median posted pay', value: usdK(c.payMed as number) },
        { label: cost?.basis === 'state' ? 'State prices vs US average' : 'Local prices vs US average', value: `${diff >= 0 ? '+' : '−'}${Math.abs(Math.round(diff * 100))}%` },
        { label: 'Openings with pay posted', value: nf(c.paid) },
      ]
    },
    baseline: (all, ctx) => {
      const rows = all.filter((c) => c.paid >= 50 && c.payMed != null && ctx.costOf(c))
      if (!rows.length) return null
      const v = rows.reduce((s, c) => s + (c.payMed as number) / ((ctx.costOf(c) as Cost).rpp / 100), 0) / rows.length
      return { label: 'the typical city in our data', valueLabel: usdK(v) }
    },
    lead: (name, v, scope) => `${name} leads ${scope} for pay after the cost of living: its median posted salary buys what ${v} buys at average US prices.`,
    method: [
      'The score is a city\'s median posted annual salary (the midpoint of each posted range) divided by its local price level, with the United States at 100.',
      'Price levels are the Bureau of Economic Analysis regional price parities for the city\'s metro area, or its state where no metro figure exists. Only cities with at least 50 listings that post a salary are ranked.',
    ],
    base: { title: 'Best cities for pay after cost of living', slug: 'best-cities-for-pay-vs-cost-of-living' },
    scoped: (p) => ({ title: `Best cities for pay after cost of living in ${p}`, slug: (id) => `best-cities-for-pay-vs-cost-of-living-in-${id}` }),
  },
  remote: {
    id: 'remote', kind: 'city', family: 'Work style', unit: 'openings',
    min: { national: 200, region: 100, state: 100 },
    qualifies: (c, min) => c.n >= min && diverse(c),
    value: (c) => share(c.remote, c.n),
    valueLabel: pct0,
    sample: (c) => c.n,
    stats: (c) => [{ label: 'Remote openings', value: nf(c.remote) }, { label: 'All openings', value: nf(c.n) }, { label: 'Median posted pay', value: payOf(c) }],
    baseline: (all) => ({ label: 'all cities in our data', valueLabel: pct0(share(sum(all, (c) => c.remote), sum(all, (c) => c.n))) }),
    lead: (name, v, scope, b) => `${name} leads ${scope} for remote-friendly jobs: ${v} of its professional openings are remote${b ? `, against ${b} across all cities in our data` : ''}.`,
    method: [
      'A city\'s score is the share of its open professional roles whose posting says the work is remote. Hybrid and on-site roles are not counted.',
      'A remote role is attached to the city its posting names, which is usually the employer\'s base, not where the worker lives.',
    ],
    base: { title: 'Best cities for remote-friendly jobs', slug: 'best-cities-for-remote-jobs' },
    scoped: (p) => ({ title: `Best cities for remote-friendly jobs in ${p}`, slug: (id) => `best-cities-for-remote-jobs-in-${id}` }),
  },
  swe: {
    id: 'swe', kind: 'city', family: 'Work style', unit: 'openings',
    min: { national: 50, region: 30, state: 30 },
    qualifies: (c, min) => c.eng >= min && diverse(c),
    value: (c) => c.eng,
    valueLabel: (v) => `${nf(v)} openings`,
    sample: (c) => c.eng,
    stats: (c) => [
      { label: 'Share of all openings', value: pct0(share(c.eng, c.n)) },
      { label: 'Median engineering pay', value: c.engPay != null && c.engPaid >= 8 ? usdK(c.engPay) : 'Not enough pay data' },
      { label: 'All openings', value: nf(c.n) },
    ],
    baseline: (all) => ({ label: 'all cities in our data', valueLabel: pct0(share(sum(all, (c) => c.eng), sum(all, (c) => c.n))) }),
    lead: (name, v, scope, b) => `${name} has the most software and engineering openings in ${scope}: ${v}${b ? `, in a market where engineering is ${b} of openings across all cities in our data` : ''}.`,
    method: [
      'A city is ranked on the number of its open professional roles classed in the engineering function, which includes software, hardware and data engineering.',
      'Median engineering pay uses only listings that post a salary, and is shown only where at least 8 do. Cities need at least the minimum number of engineering openings to be ranked.',
    ],
    base: { title: 'Best cities for software and engineering jobs', slug: 'best-cities-for-software-engineering-jobs' },
    scoped: (p) => ({ title: `Best cities for software and engineering jobs in ${p}`, slug: (id) => `best-cities-for-software-engineering-jobs-in-${id}` }),
  },
  largest: {
    id: 'largest', kind: 'city', family: 'Markets', unit: 'openings',
    min: { national: 200, region: 100, state: 100 },
    qualifies: (c, min) => c.n >= min && diverse(c),
    value: (c) => c.n,
    valueLabel: (v) => `${nf(v)} openings`,
    sample: (c) => c.n,
    stats: (c) => [{ label: 'Entry-level share', value: pct0(share(c.entry, c.n)) }, { label: 'AI-skill share', value: pct0(share(c.ai, c.n)) }, { label: 'Remote share', value: pct0(share(c.remote, c.n)) }],
    baseline: () => null,
    lead: (name, v, scope) => `${name} is the largest professional job market in ${scope} in our data, with ${v}.`,
    method: [
      'A city is ranked on the number of its open professional roles verified on the employer\'s own career site in the last week.',
      'Our data covers professional roles on the career sites of the employers we track, so counts are a floor, not a census of every job.',
    ],
    base: { title: 'Cities with the most professional job openings', slug: 'cities-with-the-most-job-openings' },
    scoped: (p) => ({ title: `Cities with the most professional job openings in ${p}`, slug: (id) => `cities-with-the-most-job-openings-in-${id}` }),
  },
  transparent: {
    id: 'transparent', kind: 'city', family: 'Pay', unit: 'openings',
    min: { national: 200, region: 100, state: 100 },
    qualifies: (c, min) => c.n >= min && diverse(c),
    value: (c) => share(c.paid, c.n),
    valueLabel: pct0,
    sample: (c) => c.n,
    stats: (c) => [{ label: 'Openings with pay posted', value: nf(c.paid) }, { label: 'All openings', value: nf(c.n) }, { label: 'Median posted pay', value: payOf(c) }],
    baseline: (all) => ({ label: 'all cities in our data', valueLabel: pct0(share(sum(all, (c) => c.paid), sum(all, (c) => c.n))) }),
    lead: (name, v, scope, b) => `${name} leads ${scope} for pay transparency: ${v} of its professional openings state a salary${b ? `, against ${b} across all cities in our data` : ''}.`,
    method: [
      'A city\'s score is the share of its open professional roles whose posting states an annual salary range.',
      'Pay laws in some states require a posted range, which lifts the figure there. The list shows how often pay is posted, not how high it is.',
    ],
    base: { title: 'Cities that post pay most often', slug: 'cities-that-post-pay-most-often' },
    scoped: (p) => ({ title: `Cities that post pay most often in ${p}`, slug: (id) => `cities-that-post-pay-most-often-in-${id}` }),
  },
}

// Level lists and job-family lists are built from the same city counts.
const share2 = (a: number, b: number) => (b > 0 ? a / b : 0)
const MID: CityMeasure = {
  id: 'midcareer', kind: 'city', family: 'Levels', unit: 'openings',
  min: { national: 200, region: 100, state: 100 },
  qualifies: (c, min) => c.n >= min && diverse(c),
  value: (c) => share2(c.mid, c.n),
  valueLabel: pct0,
  sample: (c) => c.n,
  stats: (c) => [{ label: 'Mid-career openings', value: nf(c.mid) }, { label: 'All openings', value: nf(c.n) }, { label: 'Median posted pay', value: payOf(c) }],
  baseline: (all) => ({ label: 'all cities in our data', valueLabel: pct0(share2(sum(all, (c) => c.mid), sum(all, (c) => c.n))) }),
  lead: (name, v, scope, b) => `${name} leads ${scope} for mid-career professionals: ${v} of its professional openings are mid-level, senior or manager roles${b ? `, against ${b} across all cities in our data` : ''}.`,
  method: [
    'A city\'s score is the share of its open professional roles at mid-level, senior individual-contributor or manager level, read from the full posting text.',
    'Only roles verified on the employer\'s own career site in the last week are counted. Internships are left out.',
  ],
  base: { title: 'Best cities for mid-career professionals', slug: 'best-cities-for-mid-career-jobs' },
  scoped: (p) => ({ title: `Best cities for mid-career professionals in ${p}`, slug: (id) => `best-cities-for-mid-career-jobs-in-${id}` }),
}
const LEAD: CityMeasure = {
  id: 'leadership', kind: 'city', family: 'Levels', unit: 'openings',
  min: { national: 200, region: 100, state: 100 },
  qualifies: (c, min) => c.n >= min && diverse(c),
  value: (c) => share2(c.exec, c.n),
  valueLabel: pct0,
  sample: (c) => c.n,
  stats: (c) => [{ label: 'Director and above', value: nf(c.exec) }, { label: 'All openings', value: nf(c.n) }, { label: 'Median posted pay', value: payOf(c) }],
  baseline: (all) => ({ label: 'all cities in our data', valueLabel: pct0(share2(sum(all, (c) => c.exec), sum(all, (c) => c.n))) }),
  lead: (name, v, scope, b) => `${name} leads ${scope} for director and executive jobs: ${v} of its professional openings are director level or above${b ? `, against ${b} across all cities in our data` : ''}.`,
  method: [
    'A city\'s score is the share of its open professional roles at director, senior manager, vice president, head-of or C-suite level, read from the full posting text.',
    'Only roles verified on the employer\'s own career site in the last week are counted.',
  ],
  base: { title: 'Best cities for director and executive jobs', slug: 'best-cities-for-director-and-executive-jobs' },
  scoped: (p) => ({ title: `Best cities for director and executive jobs in ${p}`, slug: (id) => `best-cities-for-director-and-executive-jobs-in-${id}` }),
}
/** Openings in one job family by city. The spec supplies the title and slug; stats carry the family's counts in `n`, and `cityN` is the whole city. */
const FNOPEN: CityMeasure = {
  ...BASE.largest, id: 'fnopen', family: 'Job families',
  qualifies: (c, min) => c.n >= min && diverse(c),
  stats: (c) => [{ label: 'Share of the city\'s openings', value: pct0(share2(c.n, c.cityN ?? c.n)) }, { label: 'Median posted pay', value: payOf(c) }, { label: 'All openings in the city', value: nf(c.cityN ?? c.n) }],
  baseline: () => null,
  lead: (name, v, scope) => `${name} has the most openings in this job family in ${scope}: ${v}.`,
  method: [
    'A city is ranked on the number of its open professional roles in this job family, as classed from the posting title and text. Median pay uses only listings that post a salary, shown where at least 8 do.',
    'Only roles verified on the employer\'s own career site in the last week are counted.',
  ],
  min: { national: 50, region: 30, state: 30 },
}
const FNPAY: CityMeasure = {
  ...BASE.paycost, id: 'fnpay', family: 'Job families',
  qualifies: (c, min, ctx) => c.n >= min && diverse(c) && c.paid >= 20 && c.payMed != null && ctx.costOf(c) != null,
  lead: (name, v, scope) => `${name} leads ${scope} for pay after the cost of living in this job family: its median posted salary buys what ${v} buys at average US prices.`,
  method: [
    'The score is the median posted annual salary (the midpoint of each posted range) for this job family in a city, divided by its local price level, with the United States at 100.',
    'Price levels are the Bureau of Economic Analysis regional price parities for the city\'s metro area, or its state where no metro figure exists. Only cities with at least 20 listings in the family that post a salary are ranked.',
  ],
  min: { national: 30, region: 30, state: 30 },
}

export const CITY_MEASURES: Record<CityMeasure['id'], CityMeasure> = { ...BASE, midcareer: MID, leadership: LEAD, fnopen: FNOPEN, fnpay: FNPAY }

export interface CountyMeasure {
  id: 'growth' | 'infogrowth'
  kind: 'county'
  family: string
  min: Record<Scope, number>
  unit: 'jobs'
  qualifies: (c: CountyStat, min: number) => boolean
  value: (c: CountyStat) => number
  valueLabel: (v: number) => string
  sample: (c: CountyStat) => number
  stats: (c: CountyStat) => { label: string; value: string }[]
  baseline: (all: CountyStat[]) => { label: string; valueLabel: string } | null
  lead: (name: string, valueLabel: string, scopeLabel: string, baselineLabel: string | null) => string
  method: string[]
  base: { title: string; slug: string }
  scoped: (phrase: string) => { title: string; slug: (id: string) => string }
}

const popOf = (c: CountyStat) => (c.populationChangePct != null ? signedPct(c.populationChangePct / 100) : 'Not available')
const sumC = (xs: CountyStat[], f: (c: CountyStat) => number) => xs.reduce((s, c) => s + f(c), 0)

export const COUNTY_MEASURES: Record<CountyMeasure['id'], CountyMeasure> = {
  growth: {
    id: 'growth', kind: 'county', family: 'Growth', unit: 'jobs',
    min: { national: 20_000, region: 20_000, state: 20_000 },
    qualifies: (c, min) => c.jobsThen >= min && c.jobsNow > 0 && (c.population ?? 100_000) >= 100_000,
    value: (c) => (c.jobsNow - c.jobsThen) / c.jobsThen,
    valueLabel: (v) => signedPct(v),
    sample: (c) => c.jobsNow,
    stats: (c) => [{ label: 'Private-sector jobs, 2025', value: nf(c.jobsNow) }, { label: 'Jobs added since 2022', value: signedN(c.jobsNow - c.jobsThen) }, { label: 'Population since 2020', value: popOf(c) }],
    baseline: (all) => {
      const then = sumC(all, (c) => c.jobsThen)
      return then > 0 ? { label: 'all large counties', valueLabel: signedPct((sumC(all, (c) => c.jobsNow) - then) / then) } : null
    },
    lead: (name, v, scope, b) => `${name} leads ${scope} for job growth: private-sector jobs are ${v} since 2022${b ? `, against ${b} across all large counties` : ''}.`,
    method: [
      'A county\'s score is the change in private-sector jobs from 2022 to 2025, from the Bureau of Labor Statistics Quarterly Census of Employment and Wages.',
      'Only counties with at least 20,000 private-sector jobs in 2022 and 100,000 residents are ranked, so small counties do not swing the list. Sectors a county suppresses for confidentiality are left out of that county\'s total.',
    ],
    base: { title: 'Fastest-growing job markets', slug: 'fastest-growing-job-markets' },
    scoped: (p) => ({ title: `Fastest-growing job markets in ${p}`, slug: (id) => `fastest-growing-job-markets-in-${id}` }),
  },
  infogrowth: {
    id: 'infogrowth', kind: 'county', family: 'Growth', unit: 'jobs',
    min: { national: 2_000, region: 2_000, state: 2_000 },
    qualifies: (c, min) => c.infoThen >= min && c.infoNow > 0,
    value: (c) => (c.infoNow - c.infoThen) / c.infoThen,
    valueLabel: (v) => signedPct(v),
    sample: (c) => c.infoNow,
    stats: (c) => [{ label: 'Information-sector jobs, 2025', value: nf(c.infoNow) }, { label: 'Jobs added since 2022', value: signedN(c.infoNow - c.infoThen) }, { label: 'All private jobs, since 2022', value: c.jobsThen > 0 ? signedPct((c.jobsNow - c.jobsThen) / c.jobsThen) : 'Not available' }],
    baseline: (all) => {
      const then = sumC(all, (c) => c.infoThen)
      return then > 0 ? { label: 'all counties with a sizable sector', valueLabel: signedPct((sumC(all, (c) => c.infoNow) - then) / then) } : null
    },
    lead: (name, v, scope, b) => `${name} leads ${scope} for tech and information jobs: the sector grew ${v} since 2022${b ? `, against ${b} across all counties with a sizable sector` : ''}.`,
    method: [
      'A county\'s score is the change in jobs in the Information sector (software publishing, data processing, telecommunications and media) from 2022 to 2025, from BLS Quarterly Census of Employment and Wages.',
      'Only counties with at least 2,000 Information-sector jobs in 2022 are ranked. The sector is the closest public measure of software and tech employment.',
    ],
    base: { title: 'Fastest-growing tech and information job markets', slug: 'fastest-growing-tech-job-markets' },
    scoped: (p) => ({ title: `Fastest-growing tech and information job markets in ${p}`, slug: (id) => `fastest-growing-tech-job-markets-in-${id}` }),
  },
}

const POSTINGS = ['NextChapter job data: open professional roles on employer career sites, verified in the last week']
export const MEASURE_SOURCES: Record<MeasureId, string[]> = {
  indjunior: POSTINGS, indai: POSTINGS, midcareer: POSTINGS, leadership: POSTINGS, fnopen: POSTINGS, aiskills: POSTINGS, aitools: POSTINGS, aicerts: POSTINGS, skillpay: POSTINGS,
  indpay: ['NextChapter job data: posted annual salary ranges'],
  fnpay: ['NextChapter job data: posted annual salary ranges', 'Bureau of Economic Analysis regional price parities 2024 (metro areas and states)'],
  junior: ['NextChapter job data: open professional roles on employer career sites, verified in the last week'],
  ai: ['NextChapter job data: open professional roles on employer career sites, verified in the last week'],
  remote: ['NextChapter job data: open professional roles on employer career sites, verified in the last week'],
  swe: ['NextChapter job data: open professional roles on employer career sites, verified in the last week'],
  largest: ['NextChapter job data: open professional roles on employer career sites, verified in the last week'],
  transparent: ['NextChapter job data: open professional roles on employer career sites, verified in the last week'],
  paycost: ['NextChapter job data: posted annual salary ranges', 'Bureau of Economic Analysis regional price parities 2024 (metro areas and states)'],
  growth: ['Bureau of Labor Statistics, Quarterly Census of Employment and Wages, 2022 to 2025', 'Census Bureau population estimates, 2020 to 2025'],
  infogrowth: ['Bureau of Labor Statistics, Quarterly Census of Employment and Wages, Information sector, 2022 to 2025'],
}
