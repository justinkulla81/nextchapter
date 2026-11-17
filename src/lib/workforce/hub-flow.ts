// Pure helpers for the Talent Hub flows: funding application statuses and the outcomes report. No database here.

export const FUNDING_STATUSES = [
  { key: 'CONSIDERING', label: 'Considering' },
  { key: 'DRAFTING', label: 'Drafting' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'AWARDED', label: 'Awarded' },
  { key: 'DECLINED', label: 'Declined' },
  { key: 'CLOSED', label: 'Closed' },
] as const
export type FundingStatus = (typeof FUNDING_STATUSES)[number]['key']
export const FUNDING_STATUS_KEYS: string[] = FUNDING_STATUSES.map((s) => s.key)
export const fundingStatusLabel = (k: string) => FUNDING_STATUSES.find((s) => s.key === k)?.label ?? k
// Still moving: worth a deadline reminder.
export const FUNDING_OPEN: string[] = ['CONSIDERING', 'DRAFTING']

export const MIN_CELL = 5

export type ResponseRow = { id: string; employer: string; seats: number | null; fundingApplicationId: string | null; stepsDone: number }
export type PersonRow = { rapidResponseId: string | null; joined: boolean; landed: boolean }

export type ResponseOutcome = { id: string; employer: string; seats: number; signedUp: number; joined: number; landed: number; stepsDone: number; fundingApplicationId: string | null }

/** One row per response: who signed up, who joined NextChapter, who landed (only people who share their outcome). */
export function responseOutcomes(responses: ResponseRow[], people: PersonRow[]): ResponseOutcome[] {
  return responses.map((r) => {
    const mine = people.filter((p) => p.rapidResponseId === r.id)
    return { id: r.id, employer: r.employer, seats: r.seats ?? 0, signedUp: mine.length, joined: mine.filter((p) => p.joined).length, landed: mine.filter((p) => p.landed).length, stepsDone: r.stepsDone, fundingApplicationId: r.fundingApplicationId }
  })
}

export type FundingRow = { id: string; name: string; funder: string | null; status: string; amountAwarded: number | null; matchRequired: number | null; matchCommitted: number | null }
export type FundingOutcome = FundingRow & { responses: number; signedUp: number; landed: number }

/** Results by funding application: the responses it pays for and their people. */
export function fundingOutcomes(funding: FundingRow[], outcomes: ResponseOutcome[]): FundingOutcome[] {
  return funding.map((f) => {
    const mine = outcomes.filter((o) => o.fundingApplicationId === f.id)
    return { ...f, responses: mine.length, signedUp: mine.reduce((n, o) => n + o.signedUp, 0), landed: mine.reduce((n, o) => n + o.landed, 0) }
  })
}

/** A count for display: under five shows as "<5", so one small group cannot identify a person. */
export const cell = (n: number) => (n > 0 && n < MIN_CELL ? '<5' : n.toLocaleString('en-US'))

export const money = (n: number | null | undefined) => (n == null ? '—' : `$${n.toLocaleString('en-US')}`)

/** Match progress: committed against required, as a whole percent capped at 100, or null with no requirement. */
export function matchPercent(required: number | null | undefined, committed: number | null | undefined): number | null {
  if (!required || required <= 0) return null
  return Math.min(100, Math.round(((committed ?? 0) / required) * 100))
}
