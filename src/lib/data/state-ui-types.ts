// Types for the state unemployment insurance facts in state-ui.ts.

/** One published fact with where it came from. `value` is null when official sources disagree or it couldn't be confirmed. */
export interface Sourced<T> {
  value: T | null
  source: string | null
  /** The source's effective or "as of" date, YYYY-MM-DD. */
  asOf: string | null
  note?: string
}

export type PaymentTreatment = 'reduces' | 'disqualifies' | 'not_deductible' | 'depends'

export interface StateUI {
  code: string
  agencyName: Sourced<string>
  /** The state agency's own page for filing an initial claim. */
  fileUrl: Sourced<string>
  /** USD, without dependents' allowances. */
  maxWeeklyBenefit: Sourced<number>
  minWeeklyBenefit: Sourced<number>
  /** Maximum regular-program weeks. */
  maxWeeks: Sourced<number>
  /** Whether the number of weeks depends on the state unemployment rate. */
  durationVaries: Sourced<boolean>
  durationNote: string | null
  waitingWeek: Sourced<boolean>
  severance: Sourced<string> & { treatment: PaymentTreatment | null }
  payInLieuOfNotice: Sourced<string> & { treatment: PaymentTreatment | null }
  workSearch: Sourced<string>
  extendedBenefits: Sourced<'on' | 'off'>
  /** Extra context from the source, e.g. the maximum with dependents. */
  notes: string | null
}
