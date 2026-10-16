// A member's openness to other fields and, for the big changes, their commitment.
// Stored in journeyDetails.pivot so it survives journey changes (nothing is lost
// when they switch journey) and needs no schema change. Pure and client-safe.
//
// Being a job searcher and a career changer are not exclusive: the journey says
// why they are moving, the stage says how close they are to applying, and this
// says where they are willing to go. Any searching journey can carry it. Changing
// careers becomes the member's journey when they make the change the main goal.

import type { BridgeRoute, PivotTier } from './feasibility'
import { assessPivot, isSearchable } from './feasibility'

export type PivotTarget = {
  function: string
  tier: PivotTier
  // For a change that needs commitment.
  route?: BridgeRoute
  hoursPerWeek?: number
  committedAt?: string // ISO date
  // What they said they will do to get there, in their words.
  how?: string
}

export type PivotDetails = {
  // Other functions they are open to, with feasibility at the time they said it.
  targets: PivotTarget[]
  updatedAt: string
}

export const HOURS_OPTIONS = [2, 5, 10] as const

export function pivotOf(details: unknown): PivotDetails | null {
  const v = (details as { pivot?: unknown } | null)?.pivot as Partial<PivotDetails> | undefined
  if (!v || !Array.isArray(v.targets)) return null
  const targets = v.targets.filter((t): t is PivotTarget => !!t && typeof t.function === 'string' && typeof t.tier === 'string')
  return { targets, updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : '' }
}

export function isCommitted(t: PivotTarget): boolean {
  return !!t.committedAt && !!t.route && (t.hoursPerWeek ?? 0) > 0
}

// Validates what the form sent. A change that needs commitment is saved as
// "exploring" (no committedAt) unless a route and hours were chosen.
export function buildTarget(
  from: string | null,
  to: string,
  input: { route?: string | null; hoursPerWeek?: number | null; commit?: boolean; how?: string | null },
  now: Date,
  seniorLevel = false,
): PivotTarget {
  const a = assessPivot(from, to, { seniorLevel })
  const route = input.route === 'INFORMAL' || input.route === 'FORMAL' ? input.route : undefined
  const hours = HOURS_OPTIONS.includes(input.hoursPerWeek as (typeof HOURS_OPTIONS)[number]) ? (input.hoursPerWeek as number) : undefined
  const committed = a.needsCommitment && input.commit === true && !!route && !!hours
  return {
    function: to,
    tier: a.tier,
    ...(route ? { route } : {}),
    ...(hours ? { hoursPerWeek: hours } : {}),
    ...(committed ? { committedAt: now.toISOString() } : {}),
    ...(input.how?.trim() ? { how: input.how.trim().slice(0, 300) } : {}),
  }
}

// The targets the search and the plan should use now.
export function searchableTargets(p: PivotDetails | null): PivotTarget[] {
  return (p?.targets ?? []).filter((t) => isSearchable(t.tier, isCommitted(t)))
}

// The one function that becomes the member's target function: a committed
// change first, then the first natural move.
export function primaryPivot(p: PivotDetails | null): PivotTarget | null {
  const s = searchableTargets(p)
  return s.find(isCommitted) ?? s[0] ?? null
}

export type PivotPlanItem = { text: string; actionType?: string }

// Plan steps for any searching journey. Committed changes get a weekly learning
// block sized to the hours they promised; natural moves get a conversation; a
// change they have not committed to gets one nudge to decide.
export function pivotPlanItems(p: PivotDetails | null, now = new Date()): PivotPlanItem[] {
  // The nudge to decide comes once a month, not every week.
  const nudgeWeek = Math.floor(now.getTime() / (7 * 86_400_000)) % 4 === 0
  if (!p) return []
  const out: PivotPlanItem[] = []
  for (const t of p.targets) {
    if (t.tier === 'SAME' || t.tier === 'LEVEL_GATED') continue
    if (t.tier === 'ADJACENT') {
      out.push({ text: `Have one conversation with someone in ${t.function} about how your experience maps`, actionType: 'OUTREACH_CALL' })
      continue
    }
    if (isCommitted(t)) {
      const a = assessPivot(null, t.function)
      const step = (t.route === 'FORMAL' ? a.education?.FORMAL[0] : a.education?.INFORMAL[0]) ?? 'Work on your learning plan'
      const weeks = Math.max(0, Math.floor((now.getTime() - new Date(t.committedAt!).getTime()) / (7 * 86_400_000)))
      out.push({ text: `Your ${t.function} plan, week ${weeks + 1}: ${t.hoursPerWeek} hours. ${step}`, actionType: 'LEARNING_MODULE' })
      if (t.route === 'FORMAL' && weeks < 2) out.push({ text: `Compare two ${t.function} programs: cost, length, and whether target employers ask for them` })
      if (t.tier === 'REBUILD' || t.tier === 'LICENSED') out.push({ text: `Decide in writing the level and pay you would accept to start in ${t.function}` })
      out.push({ text: `Have an informational call with someone doing ${t.function} work`, actionType: 'OUTREACH_CALL' })
    } else if (nudgeWeek) {
      out.push({ text: `You said you are open to ${t.function}. It takes real training: pick a route and commit, or take it off your list` })
    }
  }
  return out
}
