// The client side of "Great pay" / "Great benefits": the filter's URL parameter
// and which pay / benefits badge a job card shows, from plain data computed on
// the server (great-employers.ts). Kept apart from the curated list so the
// client bundle doesn't carry it.

export const GREAT_FILTERS = ['pay', 'benefits'] as const
export type GreatFilter = (typeof GREAT_FILTERS)[number]

export const GREAT_FILTER_LABEL: Record<GreatFilter, string> = { pay: 'Great pay', benefits: 'Great benefits' }

/** The `great` URL parameter ("pay", "benefits", "pay,benefits"); unknown values are dropped. */
export function parseGreatParam(v: string | null | undefined): GreatFilter[] {
  if (!v) return []
  const parts = new Set(v.split(',').map((s) => s.trim()))
  return GREAT_FILTERS.filter((f) => parts.has(f))
}

export function greatParam(filters: readonly GreatFilter[]): string {
  return GREAT_FILTERS.filter((f) => filters.includes(f)).join(',')
}

/** What a job card knows about the employer — plain data, passed to a client component. */
export interface EmployerSignals {
  /** Posted pay across its jobs runs above market (hiring index). */
  payHigh: boolean
  /** On the curated list: what for, and the sources in one line. */
  topEmployer: { pay: boolean; benefits: boolean; knownFor: string; sources: string } | null
}

export type PayBadge = 'employer_above_market' | 'known_for_pay' | null
export type BenefitsBadge = 'strong_benefits' | 'known_for_benefits' | null

/**
 * The card's employer pay badge. The job's own verdict, when the card shows one,
 * is the more specific fact and already has its badge — so nothing is added.
 * Otherwise "Pays above market" when the employer's posted pay supports it,
 * and "Known for pay" when only the curated list does.
 */
export function payBadgeFor(opts: { jobVerdictShown: boolean; signals: EmployerSignals | undefined }): PayBadge {
  if (opts.jobVerdictShown || !opts.signals) return null
  if (opts.signals.payHigh) return 'employer_above_market'
  if (opts.signals.topEmployer?.pay) return 'known_for_pay'
  return null
}

/** "Strong benefits" from the posting's own benefits; "Known for benefits" from the curated list only. */
export function benefitsBadgeFor(opts: { strongBenefits: boolean; signals: EmployerSignals | undefined }): BenefitsBadge {
  if (opts.strongBenefits) return 'strong_benefits'
  if (opts.signals?.topEmployer?.benefits) return 'known_for_benefits'
  return null
}

export const PAY_BADGE_LABEL: Record<Exclude<PayBadge, null>, string> = {
  employer_above_market: 'Pays above market',
  known_for_pay: 'Known for pay',
}

export const BENEFITS_BADGE_LABEL: Record<Exclude<BenefitsBadge, null>, string> = {
  strong_benefits: 'Strong benefits',
  known_for_benefits: 'Known for benefits',
}
