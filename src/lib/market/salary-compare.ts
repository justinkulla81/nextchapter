// Wording for "how this pay compares with your last salary", shown where it explains a comparison (a job's pay range,
// a pivot role's typical pay). Pure: the server loads the member's last salary and home costs once per page and passes
// them in. Plain statements of the arithmetic, never a verdict or a prediction; the base place is always named.

import type { ExclusiveJobPosting } from '@prisma/client'
import { resolveArea, type AreaCatalog } from '@/lib/careers/area'
import { AREA_COSTS_SOURCE, costsFor, pctDiff, shortName, valueInHomeDollars, type AreaCosts } from '@/lib/market/area-costs'
import { annualizePay } from '@/lib/pay/market-pay'
import { classifyWorkType, compensationKind, payComparison, payPeriodOf } from '@/lib/jobs/work-type'

const usd = (n: number) => `$${n.toLocaleString('en-US')}`

/** What a page knows about the member once: their last salary and where they live now. */
export interface SalaryContext {
  lastSalary: number | null
  /** Costs for the member's home metro area; null when we cannot place them in one. */
  home: AreaCosts | null
}

/** What the client renders under a pay line. Serializable. */
export type SalaryView =
  | { kind: 'line'; line: string; note: string }
  | { kind: 'ask'; homeName: string | null }

/** "X% more than your last salary of $Y", from a figure already in the member's own dollars. Null when it cannot be said. */
function against(pay: number, lastSalary: number, atLeast = false): string | null {
  const d = pctDiff(lastSalary, pay)
  if (d === null) return null
  if (atLeast) return d > 0 ? `at least ${d}% more than your last salary of ${usd(lastSalary)}` : null
  return d === 0 ? `about the same as your last salary of ${usd(lastSalary)}` : `${Math.abs(d)}% ${d > 0 ? 'more' : 'less'} than your last salary of ${usd(lastSalary)}`
}

export const ROLE_SALARY_NOTE = 'Typical pay is the Bureau of Labor Statistics median, before taxes. Your last salary is what you told us; only you see it.'

/** Same-place wording for a role's typical pay. `areaName` is the place the pay is for ("Raleigh, NC", or "nationwide"). */
export function roleVsLastSalaryLine(input: { pay: number; atLeast: boolean; lastSalary: number; areaName: string }): string | null {
  const rel = against(input.pay, input.lastSalary, input.atLeast)
  if (!rel) return null
  const where = input.areaName === 'nationwide' ? 'nationwide' : `in ${input.areaName}`
  return `Typical pay for this role ${where} is ${usd(input.pay)}${input.atLeast ? ' or more' : ''}, ${input.atLeast ? '' : 'which is '}${rel}.`
}

/** The annual midpoint of a posting's pay range (hourly figures times 2,080 hours), or null when there is no comparable figure. */
export function postingAnnualMid(p: { salaryMin?: number | null; salaryMax?: number | null; salaryCurrency?: string | null; payPeriod?: string | null }): number | null {
  const period = payPeriodOf(p)
  if (period !== 'year' && period !== 'hour') return null
  const lo = p.salaryMin && p.salaryMin > 0 ? p.salaryMin : null
  const hi = p.salaryMax && p.salaryMax > 0 ? p.salaryMax : null
  if (lo === null && hi === null) return null
  if (period === 'hour') return annualizePay(lo, hi, p.salaryCurrency ?? 'USD')?.mid ?? null
  if (p.salaryCurrency && p.salaryCurrency.toUpperCase() !== 'USD') return null
  return Math.round(((lo ?? hi!) + (hi ?? lo!)) / 2)
}

/**
 * The one line under a job's pay: the posting's midpoint against the member's last salary. The same place, or no way to
 * tell, compares dollars as posted. A different metro area with price parity at both ends compares what the pay buys at home.
 */
export function jobVsLastSalary(input: {
  mid: number
  lastSalary: number
  home: AreaCosts | null
  there: AreaCosts | null
  /** The job is in a named place we could not place in a metro area with price parity. */
  placeNotAdjusted?: boolean
}): { line: string; note: string } | null {
  const { mid, lastSalary, home, there } = input
  const sameMetro = !!home && !!there && home.name === there.name
  const worth = !sameMetro ? valueInHomeDollars(mid, home, there) : null
  if (worth !== null && home && there) {
    const rel = against(worth, lastSalary)
    if (!rel) return null
    return {
      line: `Midpoint ${usd(mid)} in ${shortName(there.name)} covers about what ${usd(worth)} does in ${shortName(home.name)}, ${rel}.`,
      note: `Pay range from the employer's posting. Last salary is what you told us; only you see it. Prices: ${AREA_COSTS_SOURCE}.`,
    }
  }
  const rel = against(mid, lastSalary)
  if (!rel) return null
  return {
    line: `Midpoint ${usd(mid)} is ${rel}${input.placeNotAdjusted ? ', before adjusting for prices where the job is' : ''}.`,
    note: "Pay range from the employer's posting. Last salary is what you told us; only you see it.",
  }
}

/** The view for one posting from the page-level context and area catalog. Null when no comparable annual pay is shown. */
export function jobSalaryView(posting: ExclusiveJobPosting, ctx: SalaryContext, catalog: AreaCatalog): SalaryView | null {
  if (!payComparison(classifyWorkType(posting), compensationKind(posting), payPeriodOf(posting)).compare) return null
  const mid = postingAnnualMid(posting)
  if (mid === null) return null
  if (!ctx.lastSalary) return { kind: 'ask', homeName: ctx.home ? shortName(ctx.home.name) : null }
  let there: AreaCosts | null = null
  let named = false
  if (posting.locationCity && posting.locationState) {
    const metro = resolveArea({ city: posting.locationCity, state: posting.locationState }, catalog).metro
    const c = metro ? costsFor({ metroCode: metro.code }) : null
    // costsFor falls back to the nation when a metro has no row of its own; only a metro with its own parity counts.
    if (metro && c?.rpp && c.name !== 'United States') there = c
    else named = true
  }
  const r = jobVsLastSalary({ mid, lastSalary: ctx.lastSalary, home: ctx.home, there, placeNotAdjusted: named && !!ctx.home })
  return r ? { kind: 'line', ...r } : null
}
