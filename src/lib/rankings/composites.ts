// The all-round lists: each ranks places on a weighted mix of measures. A place's score on a measure is its percentile among
// the ranked places (100 is first, 0 is last), so no measure swamps another because of its units, and the weights are
// published on the page. Pure: no database.

import type { Cost } from '@/lib/rankings/measures'
import type { CityStat, CountyStat } from '@/lib/rankings/types'

export interface Comp<T> {
  label: string
  weight: number
  /** The raw value, or null when the place has none (it is then not ranked). */
  value: (x: T) => number | null
  /** The value as shown on the row. */
  show: (x: T) => string
  /** False when a lower value is better (unemployment). */
  higherIsBetter?: boolean
}

const pct0 = (x: number) => `${Math.round(x * 100)}%`
const nf = (n: number) => Math.round(n).toLocaleString('en-US')
const usdK = (n: number) => `$${Math.round(n / 1000).toLocaleString('en-US')}k`
const share = (a: number, b: number) => (b > 0 ? a / b : 0)

export interface Scored<T> { item: T; score: number }

/** Percentile of each value among the pool: the share of the others it beats, ties split evenly. */
export function percentiles(values: number[]): number[] {
  const n = values.length
  if (n < 2) return values.map(() => 50)
  const sorted = [...values].sort((a, b) => a - b)
  return values.map((v) => {
    let less = 0
    let equal = 0
    for (const s of sorted) { if (s < v) less++; else if (s === v) equal++ }
    return (100 * (less + (equal - 1) / 2)) / (n - 1)
  })
}

/** Scores every item that has all components, by the weighted average of its percentiles. Items missing any component are left out. */
export function scorePool<T>(items: T[], comps: Comp<T>[]): Scored<T>[] {
  const complete = items.filter((x) => comps.every((c) => c.value(x) != null))
  const totalWeight = comps.reduce((s, c) => s + c.weight, 0)
  const scores = complete.map(() => 0)
  for (const c of comps) {
    const pcts = percentiles(complete.map((x) => c.value(x) as number))
    pcts.forEach((p, i) => { scores[i] += (c.weight * (c.higherIsBetter === false ? 100 - p : p)) / totalWeight })
  }
  return complete.map((item, i) => ({ item, score: scores[i] }))
}

export const describeWeights = (comps: Comp<unknown>[]) => comps.map((c) => `${c.label.toLowerCase()} ${Math.round(c.weight)}%`).join(', ')

export interface CityComposite {
  audience: string
  base: { title: string; slug: string }
  scoped: (phrase: string) => { title: string; slug: (id: string) => string }
  comps: (costOf: (c: CityStat) => Cost | null) => Comp<CityStat>[]
}

const adjPay = (costOf: (c: CityStat) => Cost | null) => (c: CityStat): number | null => {
  const cost = costOf(c)
  return c.paid >= 50 && c.payMed != null && cost ? c.payMed / (cost.rpp / 100) : null
}
const payComp = (costOf: (c: CityStat) => Cost | null, weight: number): Comp<CityStat> => ({ label: 'Pay after cost of living', weight, value: adjPay(costOf), show: (c) => (adjPay(costOf)(c) != null ? usdK(adjPay(costOf)(c) as number) : 'n/a') })

export const CITY_COMPOSITES: Record<'cgrad' | 'cmid' | 'cremote' | 'cai', CityComposite> = {
  cgrad: {
    audience: 'new graduates',
    base: { title: 'Best all-round cities for new graduates', slug: 'best-all-round-cities-for-new-graduates' },
    scoped: (p) => ({ title: `Best all-round cities for new graduates in ${p}`, slug: (id) => `best-all-round-cities-for-new-graduates-in-${id}` }),
    comps: (cost) => [
      { label: 'Entry-level share of openings', weight: 40, value: (c) => share(c.entry, c.n), show: (c) => pct0(share(c.entry, c.n)) },
      payComp(cost, 25),
      { label: 'Entry-level openings', weight: 20, value: (c) => c.entry, show: (c) => nf(c.entry) },
      { label: 'Openings with pay posted', weight: 15, value: (c) => share(c.paid, c.n), show: (c) => pct0(share(c.paid, c.n)) },
    ],
  },
  cmid: {
    audience: 'mid-career professionals',
    base: { title: 'Best all-round cities for mid-career professionals', slug: 'best-all-round-cities-for-mid-career-professionals' },
    scoped: (p) => ({ title: `Best all-round cities for mid-career professionals in ${p}`, slug: (id) => `best-all-round-cities-for-mid-career-professionals-in-${id}` }),
    comps: (cost) => [
      { label: 'Mid-career share of openings', weight: 35, value: (c) => share(c.mid, c.n), show: (c) => pct0(share(c.mid, c.n)) },
      payComp(cost, 30),
      { label: 'Mid-career openings', weight: 20, value: (c) => c.mid, show: (c) => nf(c.mid) },
      { label: 'Director-and-above share', weight: 15, value: (c) => share(c.exec, c.n), show: (c) => pct0(share(c.exec, c.n)) },
    ],
  },
  cremote: {
    audience: 'remote workers',
    base: { title: 'Best all-round cities for remote workers', slug: 'best-all-round-cities-for-remote-workers' },
    scoped: (p) => ({ title: `Best all-round cities for remote workers in ${p}`, slug: (id) => `best-all-round-cities-for-remote-workers-in-${id}` }),
    comps: (cost) => [
      { label: 'Remote share of openings', weight: 40, value: (c) => share(c.remote, c.n), show: (c) => pct0(share(c.remote, c.n)) },
      payComp(cost, 30),
      { label: 'Remote openings', weight: 30, value: (c) => c.remote, show: (c) => nf(c.remote) },
    ],
  },
  cai: {
    audience: 'AI careers',
    base: { title: 'Best all-round cities for AI careers', slug: 'best-all-round-cities-for-ai-careers' },
    scoped: (p) => ({ title: `Best all-round cities for AI careers in ${p}`, slug: (id) => `best-all-round-cities-for-ai-careers-in-${id}` }),
    comps: (cost) => [
      { label: 'AI-skill share of openings', weight: 35, value: (c) => share(c.ai, c.n), show: (c) => pct0(share(c.ai, c.n)) },
      { label: 'AI-skill openings', weight: 30, value: (c) => c.ai, show: (c) => nf(c.ai) },
      { label: 'Median posted pay', weight: 20, value: (c) => (c.paid >= 50 ? c.payMed : null), show: (c) => (c.payMed != null ? usdK(c.payMed) : 'n/a') },
      payComp(cost, 15),
    ],
  },
}

export interface CountyComposite {
  audience: string
  base: { title: string; slug: string }
  scoped: (phrase: string) => { title: string; slug: (id: string) => string }
  comps: Comp<CountyStat>[]
}

const perUnemployed = (c: CountyStat) => (c.openings != null && c.unemployed ? (c.openings / c.unemployed) * 100 : null)
const jobGrowth = (c: CountyStat) => (c.jobsThen > 0 ? (c.jobsNow - c.jobsThen) / c.jobsThen : null)
const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`

const PER: Comp<CountyStat> = { label: 'Openings per 100 unemployed', value: perUnemployed, show: (c) => `${(perUnemployed(c) ?? 0).toFixed(0)}`, weight: 0 }
const RATE: Comp<CountyStat> = { label: 'Unemployment rate', weight: 0, higherIsBetter: false, value: (c) => c.rate ?? null, show: (c) => (c.rate != null ? `${c.rate.toFixed(1)}%` : 'n/a') }
const DROP: Comp<CountyStat> = { label: 'Change in unemployment over a year', weight: 0, higherIsBetter: false, value: (c) => (c.rate != null && c.rateYearAgo != null ? c.rate - c.rateYearAgo : null), show: (c) => (c.rate != null && c.rateYearAgo != null ? `${(c.rate - c.rateYearAgo >= 0 ? '+' : '−')}${Math.abs(c.rate - c.rateYearAgo).toFixed(1)} points` : 'n/a') }
const GROWTH: Comp<CountyStat> = { label: 'Private-sector job growth since 2022', weight: 0, value: jobGrowth, show: (c) => (jobGrowth(c) != null ? signed(jobGrowth(c) as number) : 'n/a') }
const POP: Comp<CountyStat> = { label: 'Population growth since 2020', weight: 0, value: (c) => c.populationChangePct ?? null, show: (c) => (c.populationChangePct != null ? signed(c.populationChangePct / 100) : 'n/a') }
const AJC: Comp<CountyStat> = { label: 'American Job Centers', weight: 0, value: (c) => Math.min(c.ajc ?? 0, 3), show: (c) => String(c.ajc ?? 0) }
const w = (c: Comp<CountyStat>, weight: number): Comp<CountyStat> => ({ ...c, weight })

export const COUNTY_COMPOSITES: Record<'claidoff' | 'coverall', CountyComposite> = {
  coverall: {
    audience: 'job seekers',
    base: { title: 'Best county job markets for job seekers', slug: 'best-county-job-markets' },
    scoped: (p) => ({ title: `Best county job markets for job seekers in ${p}`, slug: (id) => `best-county-job-markets-in-${id}` }),
    comps: [w(PER, 30), w(RATE, 25), w(GROWTH, 25), w(POP, 20)],
  },
  claidoff: {
    audience: 'laid-off professionals',
    base: { title: 'Best counties for laid-off professionals', slug: 'best-counties-for-laid-off-professionals' },
    scoped: (p) => ({ title: `Best counties for laid-off professionals in ${p}`, slug: (id) => `best-counties-for-laid-off-professionals-in-${id}` }),
    comps: [w(PER, 40), w(AJC, 20), w(DROP, 20), w(GROWTH, 20)],
  },
}

/** A county is ranked in the all-round lists only if its numbers are large enough to mean something. */
export const countyEligible = (c: CountyStat) =>
  (c.laborForce ?? 0) >= 20_000 && c.jobsThen >= 20_000 && (c.openings ?? 0) >= 100 && (c.unemployed ?? 0) >= 500 && (c.population ?? 0) >= 50_000
