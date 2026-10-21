// Finances and benefits in the redesign. Money is opt-in (docs/finances-and-benefits.md): the page is the
// member's to turn on or off, and the next paperwork step is the one primary action. Pure.

export type MoneyGate = 'ask' | 'on' | 'off'

/** null means the member has not chosen yet. */
export function moneyGate(moneyHelp: boolean | null | undefined): MoneyGate {
  if (moneyHelp === true) return 'on'
  if (moneyHelp === false) return 'off'
  return 'ask'
}

export interface StepLike {
  id: string
  text: string
}

export interface StepsSummary {
  next: StepLike | null
  done: number
  total: number
}

/** The first step still open, in the order given, and how many are done. */
export function summarizeSteps(items: StepLike[], completedIds: ReadonlySet<string>): StepsSummary {
  const done = items.filter((i) => completedIds.has(i.id)).length
  return { next: items.find((i) => !completedIds.has(i.id)) ?? null, done, total: items.length }
}

/** The first clause of a step (up to a dash), so a row shows the action and the rest opens on demand. */
export function stepHeadline(text: string): string {
  const dash = text.search(/ — | - /)
  const head = (dash > 0 ? text.slice(0, dash) : text).trim()
  if (head.length <= 110) return head.replace(/[.:,;]$/, '')
  const cut = head.lastIndexOf(' ', 107)
  return `${head.slice(0, cut > 0 ? cut : 107).replace(/[.:,;]$/, '')}…`
}
