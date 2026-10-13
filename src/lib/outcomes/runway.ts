// Runway: how long a candidate can plan on before money gets tight. Two
// independent pieces, both estimates:
//  1. State unemployment-insurance weeks left, assuming they filed the week
//     they stopped working (we do not know their real filing date).
//  2. A savings cushion in months, from numbers they type in the browser and
//     that are never stored.

export interface UiWeeksInput {
  maxWeeks: number | null // state maximum regular-program weeks (sourced; null when unconfirmed)
  durationVaries: boolean | null // some states tie weeks to the state unemployment rate
  weeksSinceLastJob: number | null
}

export interface UiWeeksResult {
  known: boolean
  weeksLeft: number | null
  exhausted: boolean
  note: string
}

export function uiWeeksLeft(i: UiWeeksInput): UiWeeksResult {
  if (i.maxWeeks === null || i.weeksSinceLastJob === null) {
    return {
      known: false,
      weeksLeft: null,
      exhausted: false,
      note: i.maxWeeks === null
        ? 'We could not confirm the maximum weeks for your state. Check your state agency.'
        : 'Add your last day worked to estimate how many weeks remain.',
    }
  }
  const left = Math.max(0, i.maxWeeks - i.weeksSinceLastJob)
  const varies = i.durationVaries ? ' This state can change the number of weeks with its unemployment rate, so check the current figure.' : ''
  return {
    known: true,
    weeksLeft: left,
    exhausted: left === 0,
    note: `Assumes you filed the week you stopped working.${varies}`,
  }
}

export interface CushionInput {
  savingsUsd: number
  monthlyExpensesUsd: number
  monthlyIncomeUsd: number // unemployment benefit, severance paid monthly, partner income: anything coming in
}

export interface CushionResult {
  months: number | null // null when expenses are covered by income (no drawdown) or inputs are invalid
  coveredByIncome: boolean
}

export function cushionMonths(i: CushionInput): CushionResult {
  const { savingsUsd, monthlyExpensesUsd, monthlyIncomeUsd } = i
  if (![savingsUsd, monthlyExpensesUsd, monthlyIncomeUsd].every((n) => Number.isFinite(n) && n >= 0) || monthlyExpensesUsd <= 0) {
    return { months: null, coveredByIncome: false }
  }
  const drawdown = monthlyExpensesUsd - monthlyIncomeUsd
  if (drawdown <= 0) return { months: null, coveredByIncome: true }
  return { months: savingsUsd / drawdown, coveredByIncome: false }
}

export const RUNWAY_FACTS = [
  {
    text: 'For federal student loans made on or after July 1, 2027, unemployment and economic-hardship deferment end, and forbearance is capped at 9 months in any 24. Loans made earlier can still be deferred for unemployment.',
    source: 'U.S. Department of Education rules, via the NextChapter White Collar Employment Report, Sept 2026',
  },
  {
    text: 'About 39% of people on unemployment insurance use up their benefits, and claimants drew benefits for 15.8 weeks on average.',
    source: 'U.S. Department of Labor ETA data, via the NextChapter White Collar Employment Report, Sept 2026',
  },
  {
    text: 'Some states delay or offset unemployment benefits while you are paid severance. Check your state’s rule before you file.',
    source: 'NextChapter White Collar Employment Report, Sept 2026',
  },
] as const
