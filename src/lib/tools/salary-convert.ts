// Convert pay between hourly, daily, weekly, every-two-weeks, monthly and yearly. Pure.

export const PERIODS = ['hour', 'day', 'week', 'biweek', 'month', 'year'] as const
export type Period = (typeof PERIODS)[number]
export const PERIOD_LABEL: Record<Period, string> = { hour: 'Hourly', day: 'Daily', week: 'Weekly', biweek: 'Every two weeks', month: 'Monthly', year: 'Yearly' }

export interface Schedule { hoursPerWeek: number; weeksPerYear: number }
export const FULL_TIME: Schedule = { hoursPerWeek: 40, weeksPerYear: 52 }

/** How many of each period fit in a year, for the schedule. A day is a fifth of a working week. */
function perYear(p: Period, s: Schedule): number {
  switch (p) {
    case 'hour': return s.hoursPerWeek * s.weeksPerYear
    case 'day': return 5 * s.weeksPerYear
    case 'week': return s.weeksPerYear
    case 'biweek': return s.weeksPerYear / 2
    case 'month': return 12
    case 'year': return 1
  }
}

export function toYearly(amount: number, from: Period, s: Schedule = FULL_TIME): number {
  return amount * perYear(from, s)
}

export function convertAll(amount: number, from: Period, s: Schedule = FULL_TIME): Record<Period, number> {
  const yearly = toYearly(amount, from, s)
  return Object.fromEntries(PERIODS.map((p) => [p, yearly / perYear(p, s)])) as Record<Period, number>
}

export function validSchedule(s: Schedule): boolean {
  return s.hoursPerWeek > 0 && s.hoursPerWeek <= 100 && s.weeksPerYear > 0 && s.weeksPerYear <= 52
}
