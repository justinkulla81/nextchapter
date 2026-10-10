import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'

// What a company actually posts it pays, by level and function — from the salary ranges
// on its own live postings. Pure, tested in src/test/company-intel-panels.test.ts.
//
// Only what was posted: no estimate, no model, no scraped "salary survey". A range is
// shown with how many postings it comes from, so one posting reads as one posting.

export interface PayPosting {
  title: string
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
}

export interface PayGroup {
  level: string
  function: string | null
  postings: number
  /** Median of the posted minimums and maximums. */
  medianMin: number
  medianMax: number
  lowest: number
  highest: number
}

const LEVEL_ORDER = ['C-Suite', 'VP', 'Director', 'Manager', 'IC']
// A posted range outside this is a data error or not an annual salary (hourly, monthly,
// or a stray digit). Excluded rather than shown.
const MIN_ANNUAL = 25_000
const MAX_ANNUAL = 2_500_000

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

export function isPlausibleAnnualRange(p: PayPosting): boolean {
  if (p.salaryMin === null || p.salaryMax === null) return false
  if (p.salaryCurrency && p.salaryCurrency.toUpperCase() !== 'USD') return false
  return p.salaryMin >= MIN_ANNUAL && p.salaryMax <= MAX_ANNUAL && p.salaryMax >= p.salaryMin
}

export function summarizePay(postings: PayPosting[]): PayGroup[] {
  const groups = new Map<string, { level: string; fn: string | null; mins: number[]; maxs: number[] }>()
  for (const p of postings) {
    if (!isPlausibleAnnualRange(p)) continue
    const level = inferLevelFromTitle(p.title)
    const fn = inferFunctionFromTitle(p.title)
    const key = `${level}|${fn ?? ''}`
    const g = groups.get(key) ?? { level, fn, mins: [], maxs: [] }
    g.mins.push(p.salaryMin!)
    g.maxs.push(p.salaryMax!)
    groups.set(key, g)
  }
  return [...groups.values()]
    .map((g) => ({
      level: g.level,
      function: g.fn,
      postings: g.mins.length,
      medianMin: median(g.mins),
      medianMax: median(g.maxs),
      lowest: Math.min(...g.mins),
      highest: Math.max(...g.maxs),
    }))
    .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || b.postings - a.postings)
}
