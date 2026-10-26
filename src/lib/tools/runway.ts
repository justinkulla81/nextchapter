// How long money lasts after a layoff: savings, severance and unemployment benefits against monthly spending. Pure.

export interface RunwayInput {
  savings: number
  monthlyExpenses: number
  /** One-time severance after tax (the person enters what they expect to receive). */
  severance: number
  /** Weekly unemployment benefit and the number of weeks it can last; 0 when not counted. */
  weeklyBenefit: number
  benefitWeeks: number
}

export interface RunwayResult {
  monthsWithoutBenefits: number
  monthsWithBenefits: number
  /** Dollars of benefits counted: the benefit paid weekly for its weeks. */
  benefitsTotal: number
  /** The month the money runs out without benefits, if it does within a decade; null when spending is zero. */
  moneyAvailable: number
}

const WEEKS_PER_MONTH = 52 / 12

/**
 * Month-by-month, so benefits that stop partway through are counted exactly: each month spends `monthlyExpenses`
 * and receives the benefit for the weeks still left. Months are fractional in the last month.
 */
export function calculateRunway(i: RunwayInput): RunwayResult {
  const pool = Math.max(0, i.savings) + Math.max(0, i.severance)
  const spend = Math.max(0, i.monthlyExpenses)
  const benefitsTotal = Math.max(0, i.weeklyBenefit) * Math.max(0, i.benefitWeeks)
  if (spend === 0) return { monthsWithoutBenefits: 0, monthsWithBenefits: 0, benefitsTotal, moneyAvailable: pool }
  const withoutBenefits = pool / spend
  let balance = pool
  let weeksLeft = Math.max(0, i.benefitWeeks)
  let months = 0
  for (let m = 0; m < 600; m++) {
    const w = Math.min(WEEKS_PER_MONTH, weeksLeft)
    weeksLeft -= w
    const net = spend - w * Math.max(0, i.weeklyBenefit)
    if (net <= 0) { months += 1; continue }
    if (balance >= net) { balance -= net; months += 1; continue }
    months += balance / net
    return { monthsWithoutBenefits: withoutBenefits, monthsWithBenefits: months, benefitsTotal, moneyAvailable: pool }
  }
  return { monthsWithoutBenefits: withoutBenefits, monthsWithBenefits: months, benefitsTotal, moneyAvailable: pool }
}
