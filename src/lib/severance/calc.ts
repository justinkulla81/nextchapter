// Severance arithmetic that needs the sourced tax and review-period figures (src/lib/severance/rules.ts). Pure, so it is unit-tested
// (src/test/severance-calc.test.ts). Every function states its assumptions; the pages show them.

import { WAIVER, WITHHOLDING } from '@/lib/severance/rules'

export interface NetInput {
  /** The severance, before taxes. */
  gross: number
  /** Pay already earned this year before the severance. Blank is zero. It sets how much of the severance still meets the Social Security wage base. */
  paidThisYear?: number
  /** The state's income tax withholding rate on this payment, as a percent (0 to 20), or blank to leave state tax out. */
  stateRatePercent?: number
}

export interface NetResult {
  gross: number
  federalIncomeTax: number
  socialSecurity: number
  medicare: number
  additionalMedicare: number
  stateIncomeTax: number
  withheld: number
  net: number
  /** A plain-language line per assumption, shown under the numbers. */
  assumptions: string[]
}

const round = (n: number) => Math.round(n)

/**
 * Take-home from a lump-sum severance, under the stated assumptions: the employer withholds federal income tax at the flat
 * supplemental rate (37% on the part of the year's supplemental wages above $1 million), Social Security applies up to the year's wage
 * base, Medicare applies to everything, and the additional Medicare tax applies to wages above $200,000 for the year. This is
 * withholding, not the tax you will owe: it is settled on your return.
 */
export function netSeverance(input: NetInput): NetResult {
  const w = WITHHOLDING
  const gross = Math.max(0, input.gross)
  const prior = Math.max(0, input.paidThisYear ?? 0)
  const belowMillion = Math.max(0, Math.min(gross, w.supplementalThreshold))
  const aboveMillion = gross - belowMillion
  const federalIncomeTax = belowMillion * w.supplementalRate + aboveMillion * w.supplementalRateOver
  const ssRoom = Math.max(0, w.socialSecurityWageBase - prior)
  const socialSecurity = Math.min(gross, ssRoom) * w.socialSecurityRate
  const medicare = gross * w.medicareRate
  const overThreshold = Math.max(0, prior + gross - Math.max(prior, w.additionalMedicareThreshold))
  const additionalMedicare = overThreshold * w.additionalMedicareRate
  const stateRate = Math.min(20, Math.max(0, input.stateRatePercent ?? 0)) / 100
  const stateIncomeTax = gross * stateRate
  const withheld = federalIncomeTax + socialSecurity + medicare + additionalMedicare + stateIncomeTax
  const assumptions = [
    `Federal income tax is withheld at the flat ${Math.round(w.supplementalRate * 100)}% rate for supplemental wages, which is what many employers use for severance. Some withhold by the regular tables instead, so your check can differ.`,
    `Social Security is ${(w.socialSecurityRate * 100).toFixed(1)}% on earnings up to ${w.socialSecurityWageBase.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} for ${w.taxYear}, and Medicare is ${(w.medicareRate * 100).toFixed(2)}%. Pay you already earned this year counts toward the Social Security limit${prior > 0 ? '' : ' (none entered, so none assumed)'}.`,
    input.stateRatePercent ? `State income tax is the ${input.stateRatePercent}% you entered, applied to the whole amount.` : 'State income tax is not included. Enter your state’s withholding rate to include it.',
    'Withholding is not the tax you owe. The difference comes back as a refund or is owed when you file.',
  ]
  return {
    gross: round(gross),
    federalIncomeTax: round(federalIncomeTax),
    socialSecurity: round(socialSecurity),
    medicare: round(medicare),
    additionalMedicare: round(additionalMedicare),
    stateIncomeTax: round(stateIncomeTax),
    withheld: round(withheld),
    net: round(gross - withheld),
    assumptions,
  }
}

const DAY_MS = 86_400_000

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS)
}

export interface AgreementDates {
  /** The last day to decide, if the employee is 40 or older and the law's review period applies. */
  reviewEnds: Date
  /** If signed on `signedOn`, the last day to change your mind. */
  revokeEnds: (signedOn: Date) => Date
  reviewDays: number
}

/**
 * The review period for an offer received on `received` by an employee 40 or older: 21 days for an individual offer, 45 days when it is
 * part of a group exit incentive or termination program (EEOC Q&A). Younger employees are not covered by this rule; a state or the
 * agreement itself may still give time. A material change to the offer restarts the period.
 */
export function agreementDates(received: Date, group: boolean): AgreementDates {
  const reviewDays = group ? WAIVER.considerDaysGroup : WAIVER.considerDays
  return { reviewEnds: addDays(received, reviewDays), revokeEnds: (signedOn) => addDays(signedOn, WAIVER.revokeDays), reviewDays }
}

export type StateTreatment = 'reduces' | 'disqualifies' | 'not_deductible' | 'depends' | null

/** What each treatment means for a person, in one plain sentence. The state's own sourced text is always shown beside it. */
export const TREATMENT_SENTENCE: Record<Exclude<StateTreatment, null>, string> = {
  reduces: 'Severance counts as income that reduces your weekly benefit for the weeks it covers.',
  disqualifies: 'Severance can make you ineligible for benefits for the weeks it applies to. The rule below says which weeks.',
  depends: 'Whether severance affects your benefits depends on how the payment is structured and what the agreement says.',
  not_deductible: 'Severance is not deducted from your benefits.',
}

export const TREATMENT_LABEL: Record<Exclude<StateTreatment, null>, string> = {
  reduces: 'Reduces your benefit',
  disqualifies: 'Can make you ineligible for those weeks',
  depends: 'Depends on how it is paid',
  not_deductible: 'Not deducted',
}

/** A state-count sentence fragment per treatment: "17 states reduce your benefit". */
export const TREATMENT_VERB: Record<Exclude<StateTreatment, null>, string> = {
  not_deductible: 'do not deduct it',
  depends: 'depend on how it is paid',
  reduces: 'reduce your benefit',
  disqualifies: 'can make you ineligible for the weeks it applies to',
}

/** The order the treatments are listed in: best news for the claimant first. */
export const TREATMENT_ORDER: Exclude<StateTreatment, null>[] = ['not_deductible', 'depends', 'reduces', 'disqualifies']
