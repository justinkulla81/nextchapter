// A rough unemployment benefit from recent pay and a state's published maximum and minimum. Pure.
//
// Every state sets its own formula (a share of wages in the highest-paid quarter, a share of annual wages, an indexed
// table). Many land near half of the prior weekly wage up to the state maximum, so that is the rule of thumb used here,
// and the page says so. It is an upper-bound planning figure, not the amount the state will pay.

export interface UiEstimateInput {
  annualPay: number
  maxWeekly: number | null
  minWeekly: number | null
  maxWeeks: number | null
}

export interface UiEstimate {
  /** Half of the weekly wage, held between the state minimum and maximum. */
  weekly: number
  weeks: number | null
  total: number | null
  cappedAtMax: boolean
}

export function estimateUi(i: UiEstimateInput): UiEstimate | null {
  if (!(i.annualPay > 0)) return null
  const half = i.annualPay / 52 / 2
  let weekly = half
  let cappedAtMax = false
  if (i.maxWeekly != null && weekly > i.maxWeekly) { weekly = i.maxWeekly; cappedAtMax = true }
  if (i.minWeekly != null && weekly < i.minWeekly) weekly = i.minWeekly
  weekly = Math.round(weekly)
  return { weekly, weeks: i.maxWeeks, total: i.maxWeeks != null ? weekly * i.maxWeeks : null, cappedAtMax }
}
