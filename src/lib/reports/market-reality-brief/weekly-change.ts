// The weekly "what changed" note: this week's Market Reality read set against
// the last one saved. Pure. Deterministic wording over the two states, so the
// note can only say what actually moved, and says "nothing moved" when that is
// true instead of inventing progress. Movement is celebrated over level
// (Report Structure Spec §5.3), and a row that slips is named plainly, never
// as a verdict on the person.

import type { Grade } from '@/lib/scoring/grade'
import type { HiringReason, HiringStatus } from './hiring-case'

/** What is saved each week. Keep it small and additive: old rows must still read. */
export interface ReadState {
  v: 1
  /** hiring-case key -> status */
  statuses: Record<string, HiringStatus>
  known: number
  total: number
  openRoles: number | null
  marketPrompt: string | null
  applicationsPerWeek: number | null
  conversationsPerWeek: number | null
  neededApplications: number | null
  neededConversations: number | null
  grade: Grade | null
}

export interface ReadStateSource {
  hiringCase: HiringReason[]
  sharpen: { known: boolean }[]
  market: { openRoles: number; prompt: string } | null
  effort: { plan: { pace: { applicationsPerWeek: number; conversationsPerWeek: number; activityObserved: boolean }; routes: { key: string; applicationsPerWeek: number; conversationsPerWeek: number }[] } } | null
  summary: { grade: Grade | null }
}

export function readStateOf(b: ReadStateSource): ReadState {
  const balanced = b.effort?.plan.routes.find((r) => r.key === 'balanced')
  return {
    v: 1,
    statuses: Object.fromEntries(b.hiringCase.map((r) => [r.key, r.status])),
    known: b.sharpen.filter((i) => i.known).length,
    total: b.sharpen.length,
    openRoles: b.market?.openRoles ?? null,
    marketPrompt: b.market?.prompt ?? null,
    applicationsPerWeek: b.effort ? b.effort.plan.pace.applicationsPerWeek : null,
    conversationsPerWeek: b.effort ? b.effort.plan.pace.conversationsPerWeek : null,
    neededApplications: balanced?.applicationsPerWeek ?? null,
    neededConversations: balanced?.conversationsPerWeek ?? null,
    grade: b.summary.grade,
  }
}

export type MoveKind = 'up' | 'down' | 'learned'

export interface RowMove {
  key: string
  reason: string
  from: HiringStatus
  to: HiringStatus
  kind: MoveKind
  /** One plain line: "References: now in place." */
  line: string
}

export interface WeeklyChange {
  /** The saved read this is measured against. */
  since: string
  hasChange: boolean
  headline: string
  moves: RowMove[]
  market: string | null
  activity: string | null
  grade: { from: Grade; to: Grade } | null
  inputsKnown: { from: number; to: number; total: number } | null
}

const RANK: Record<HiringStatus, number> = { missing: 0, issue: 1, unknown: 1, in_place: 2 }
function moveLine(reason: string, kind: MoveKind, to: HiringStatus): string {
  if (kind === 'up') return to === 'in_place' ? `${reason}: now in place.` : `${reason}: started, and still needs work.`
  if (kind === 'learned') return `${reason}: now known${to === 'issue' ? ', and it needs fixing' : to === 'missing' ? ', and it does not exist yet' : ''}.`
  return `${reason}: slipped, ${to === 'missing' ? 'now not yet built' : to === 'issue' ? 'now needs fixing' : 'no longer known'}.`
}

function classify(from: HiringStatus, to: HiringStatus): MoveKind | null {
  if (from === to) return null
  if (to === 'in_place') return 'up'
  if (from === 'in_place') return 'down'
  if (from === 'unknown') return 'learned'
  if (from === 'missing' && to === 'issue') return 'up'
  if (from === 'issue' && to === 'missing') return 'down'
  return RANK[to] > RANK[from] ? 'up' : 'learned'
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const rnd = (n: number) => Math.round(n * 10) / 10

export function buildWeeklyChange(prev: ReadState, curr: ReadState, reasons: { key: string; reason: string }[], sinceIso: string): WeeklyChange {
  const label = (key: string) => reasons.find((r) => r.key === key)?.reason ?? key

  const moves: RowMove[] = []
  for (const [key, to] of Object.entries(curr.statuses)) {
    const from = prev.statuses[key]
    if (!from) continue
    const kind = classify(from, to)
    if (!kind) continue
    const reason = label(key)
    moves.push({
      key,
      reason,
      from,
      to,
      kind,
      line: moveLine(reason, kind, to),
    })
  }
  const order: Record<MoveKind, number> = { up: 0, learned: 1, down: 2 }
  moves.sort((a, b) => order[a.kind] - order[b.kind])

  // Market: a real move in the number of roles, or a change of kind.
  let market: string | null = null
  if (prev.openRoles !== null && curr.openRoles !== null && prev.openRoles !== curr.openRoles) {
    const pct = prev.openRoles > 0 ? Math.round(((curr.openRoles - prev.openRoles) / prev.openRoles) * 100) : null
    if (prev.marketPrompt !== curr.marketPrompt && curr.marketPrompt) {
      market = `Open roles that fit you went from ${prev.openRoles.toLocaleString()} to ${curr.openRoles.toLocaleString()}${curr.marketPrompt === 'healthy' ? ', which is now a workable market' : curr.marketPrompt === 'too_few' ? ', which is still thin' : ''}.`
    } else if (pct !== null && Math.abs(pct) >= 10) {
      market = `Open roles that fit you ${pct > 0 ? 'rose' : 'fell'} from ${prev.openRoles.toLocaleString()} to ${curr.openRoles.toLocaleString()} (${pct > 0 ? '+' : '−'}${Math.abs(pct)}%).`
    }
  }

  // Activity: conversations and applications a week against what the market calls for.
  let activity: string | null = null
  const bits: string[] = []
  if (curr.conversationsPerWeek !== null && prev.conversationsPerWeek !== null && Math.abs(curr.conversationsPerWeek - prev.conversationsPerWeek) >= 0.5) {
    bits.push(`conversations ${rnd(prev.conversationsPerWeek)} to ${rnd(curr.conversationsPerWeek)} a week${curr.neededConversations ? ` (the market calls for about ${curr.neededConversations})` : ''}`)
  }
  if (curr.applicationsPerWeek !== null && prev.applicationsPerWeek !== null && Math.abs(curr.applicationsPerWeek - prev.applicationsPerWeek) >= 1) {
    bits.push(`applications ${rnd(prev.applicationsPerWeek)} to ${rnd(curr.applicationsPerWeek)} a week${curr.neededApplications ? ` (about ${curr.neededApplications} needed)` : ''}`)
  }
  if (bits.length > 0) activity = `Your pace moved: ${bits.join('; ')}.`

  const grade = prev.grade && curr.grade && prev.grade !== curr.grade ? { from: prev.grade, to: curr.grade } : null
  const inputsKnown = curr.known !== prev.known ? { from: prev.known, to: curr.known, total: curr.total } : null

  const up = moves.filter((m) => m.kind === 'up').length
  const down = moves.filter((m) => m.kind === 'down').length
  const hasChange = moves.length > 0 || !!market || !!activity || !!grade || !!inputsKnown
  let headline: string
  if (!hasChange) headline = 'Nothing in your read moved this week.'
  else if (up > 0 && down === 0) headline = `${plural(up, 'thing')} moved in your favor this week.`
  else if (up > 0 && down > 0) headline = `${plural(up, 'thing')} moved in your favor and ${down} slipped.`
  else if (down > 0) headline = `${plural(down, 'thing')} slipped this week.`
  else headline = 'Your read got more specific this week.'

  return { since: sinceIso, hasChange, headline, moves, market, activity, grade, inputsKnown }
}
