import catalog from './catalog.json'
import { GOAL_OF, isMemberProgram, parseAmount, publicShowable, type Goal } from './match'
import { CATEGORY_LABELS, type BenefitProgramRow } from './types'

// The numbers and examples the public pages quote, computed from the catalog bundled with the app so the
// pages are static and never touch the database. Only verified, open, unrestricted programs are named.

const rows = (catalog as unknown as { rows: (Omit<BenefitProgramRow, 'checkedAt'> & { checkedAt: string | null })[] }).rows.map((r) => ({
  ...r,
  checkedAt: r.checkedAt ? new Date(r.checkedAt) : null,
})) as BenefitProgramRow[]

const live = rows.filter(isMemberProgram)

export interface FundingExample {
  name: string
  where: string
  amount: string
  goal: Goal
  categoryLabel: string
}

const GOAL_COPY: Record<Goal, string> = { move: 'Money to move', retrain: 'Tuition and training money', tax: 'Tax credits and deductions', learn: 'Free courses' }

function firstClause(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  const cut = t.split(/;|\. |, plus | \(/)[0]
  return cut.length > 90 ? `${cut.slice(0, 87)}…` : cut
}

function examplesFor(goal: Goal, n: number): FundingExample[] {
  const pool = live
    .filter((r) => GOAL_OF[r.category] === goal && publicShowable(r) && r.amount && parseAmount(r.amount) !== null && (r.status === 'OPEN' || r.status === 'ROLLING'))
    .sort((a, b) => (parseAmount(b.amount) ?? 0) - (parseAmount(a.amount) ?? 0))
  const seenState = new Set<string>()
  const out: FundingExample[] = []
  for (const r of pool) {
    const key = r.state ?? 'US'
    if (seenState.has(key)) continue
    seenState.add(key)
    const amount = firstClause(r.amount!)
    if (!/\$|free|tuition/i.test(amount)) continue
    out.push({ name: r.name.replace(/\s*\(.*$/, ''), where: r.state ? `${r.locality ? `${r.locality.replace(/\s*\(.*?\)/g, '')}, ` : ''}${r.state}` : 'Nationwide', amount, goal, categoryLabel: CATEGORY_LABELS[r.category] })
    if (out.length === n) break
  }
  return out
}

// Free courses have no dollar amount, so name the ones a hiring manager recognizes, if they are in the verified set.
const LEARN_PICKS = [/^ibm skillsbuild$/i, /^harvard cs50/i, /^microsoft learn$/i, /^mit opencourseware$/i]
function learnExamples(): FundingExample[] {
  const pool = live.filter((r) => r.category === 'COURSES' && publicShowable(r))
  const out: FundingExample[] = []
  for (const re of LEARN_PICKS) {
    const r = pool.find((x) => re.test(x.name.replace(/\s*\(.*$/, '').trim()))
    if (r && r.amount && !/\$\s?\d/.test(r.amount)) out.push({ name: r.name.replace(/\s*\(.*$/, ''), where: 'Nationwide', amount: /free audit/i.test(r.amount) ? 'Free to audit' : 'Free', goal: 'learn', categoryLabel: CATEGORY_LABELS[r.category] })
  }
  return out.slice(0, 3)
}

const TAX_PICKS = [/^premium tax credit/i, /^earned income/i, /^student loan interest/i]
function taxExamples(): FundingExample[] {
  const pool = live.filter((r) => r.category === 'TAX' && publicShowable(r))
  const out: FundingExample[] = []
  for (const re of TAX_PICKS) {
    const r = pool.find((x) => re.test(x.name.trim()))
    if (r && r.amount) out.push({ name: r.name, where: 'Nationwide', amount: firstClause(r.amount), goal: 'tax', categoryLabel: CATEGORY_LABELS[r.category] })
  }
  return out
}

const count = (goal: Goal) => live.filter((r) => GOAL_OF[r.category] === goal).length

export const FUNDING_STATS = {
  tracked: rows.length,
  verifiedLive: live.length,
  states: new Set(live.filter((r) => r.scope === 'STATE' && r.state).map((r) => r.state)).size,
  byGoal: { move: count('move'), retrain: count('retrain'), tax: count('tax'), learn: count('learn') } as Record<Goal, number>,
  examples: { move: examplesFor('move', 3), retrain: examplesFor('retrain', 3), tax: taxExamples(), learn: learnExamples() } as Record<Goal, FundingExample[]>,
  goalCopy: GOAL_COPY,
}
