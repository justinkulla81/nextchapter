// The severance calculator: the common "weeks of pay per year of service" formula, shown as a range. An agreement,
// contract or company plan sets the real amount; this only turns the common formula into numbers.

export interface SeveranceInput {
  /** Annual base pay in dollars. */
  annualPay: number
  /** Whole and partial years of service. */
  yearsOfService: number
  /** Weeks of pay per year of service the offer uses; the range shown is 1 to 2 when this is null. */
  weeksPerYear?: number | null
  /** Months of employer-paid health coverage in the offer. */
  coverageMonths?: number
  /** Monthly COBRA premium for the family or individual plan, if known. */
  cobraMonthly?: number
}

export interface SeveranceResult {
  weeklyPay: number
  lowWeeks: number
  highWeeks: number
  low: number
  high: number
  coverageValue: number
}

export const COMMON_LOW_WEEKS_PER_YEAR = 1
export const COMMON_HIGH_WEEKS_PER_YEAR = 2

export function calculateSeverance(i: SeveranceInput): SeveranceResult {
  const weeklyPay = i.annualPay / 52
  const lowRate = i.weeksPerYear ?? COMMON_LOW_WEEKS_PER_YEAR
  const highRate = i.weeksPerYear ?? COMMON_HIGH_WEEKS_PER_YEAR
  const lowWeeks = i.yearsOfService * lowRate
  const highWeeks = i.yearsOfService * highRate
  return {
    weeklyPay,
    lowWeeks,
    highWeeks,
    low: Math.round(weeklyPay * lowWeeks),
    high: Math.round(weeklyPay * highWeeks),
    coverageValue: Math.round((i.coverageMonths ?? 0) * (i.cobraMonthly ?? 0)),
  }
}
