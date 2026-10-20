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

// Where someone is with an idea. Thinking about a change is not a commitment, and most people are
// not there yet: they wonder, then try something small, then plan, then go for it, and some set it
// aside. We keep every step (and how it felt) so we can see the story over time and meet them where they are.
export const PIVOT_STANCES = [
  { key: 'WONDERING', label: 'On my radar', hint: 'Just thinking about it. No decision needed.' },
  { key: 'TRYING', label: 'Trying it out', hint: 'Talking to people, a small project, finding out if I like it.' },
  { key: 'PREPARING', label: 'Getting ready', hint: 'I have chosen a route and hours, and I am learning.' },
  { key: 'GOING_FOR_IT', label: 'Going for it', hint: 'I am applying for roles in this field.' },
  { key: 'SET_ASIDE', label: 'Not for me right now', hint: 'Kept in your history. You can come back to it any time.' },
] as const
export type PivotStance = (typeof PIVOT_STANCES)[number]['key']

export const PIVOT_FEELINGS = [
  { key: 'EXCITED', label: 'Excited' },
  { key: 'CURIOUS', label: 'Curious' },
  { key: 'UNSURE', label: 'Not sure' },
  { key: 'NERVOUS', label: 'Nervous' },
  { key: 'SCARED', label: 'Scared' },
] as const
export type PivotFeeling = (typeof PIVOT_FEELINGS)[number]['key']

export type PivotHistoryEntry = { at: string; stance: PivotStance; feeling?: PivotFeeling; note?: string }

export type PivotTarget = {
  function: string
  tier: PivotTier
  // Where they are with it, how it feels, and when they first told us. Absent on older rows.
  stance?: PivotStance
  feeling?: PivotFeeling
  since?: string
  history?: PivotHistoryEntry[]
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

const isStance = (v: unknown): v is PivotStance => PIVOT_STANCES.some((s) => s.key === v)
const isFeeling = (v: unknown): v is PivotFeeling => PIVOT_FEELINGS.some((f) => f.key === v)

// Where this idea stands now. Older rows have no stance: a commitment means getting ready; otherwise it is on the radar.
export function stanceOf(t: PivotTarget): PivotStance {
  if (t.stance === 'SET_ASIDE') return 'SET_ASIDE'
  if (isCommitted(t)) return t.stance === 'GOING_FOR_IT' ? 'GOING_FOR_IT' : 'PREPARING'
  if (t.stance === 'TRYING' || t.stance === 'WONDERING') return t.stance
  return t.tier === 'ADJACENT' ? 'TRYING' : 'WONDERING'
}

export const stanceLabel = (s: PivotStance) => PIVOT_STANCES.find((x) => x.key === s)!.label

// Record a move in how they feel about an idea, keeping the story. Nothing is overwritten or lost.
export function moveStance(t: PivotTarget, change: { stance?: string | null; feeling?: string | null; note?: string | null }, now: Date): PivotTarget {
  const before = stanceOf(t)
  const stance = isStance(change.stance) ? change.stance : before
  // Getting ready and going for it need a commitment (a route and hours); they are set on Search Strategy.
  const allowed = stance === 'PREPARING' || stance === 'GOING_FOR_IT' ? (isCommitted(t) ? stance : before) : stance
  const feeling = isFeeling(change.feeling) ? change.feeling : t.feeling
  const note = change.note?.trim() ? change.note.trim().slice(0, 200) : undefined
  if (allowed === before && feeling === t.feeling && !note) return t
  const history = [...(t.history ?? []), { at: now.toISOString(), stance: allowed, ...(feeling ? { feeling } : {}), ...(note ? { note } : {}) }].slice(-40)
  return { ...t, stance: allowed, ...(feeling ? { feeling } : {}), history, since: t.since ?? now.toISOString() }
}

// Keep the story when a form saves the same idea again. An idea that was set aside and is picked again
// comes back as something to wonder about; a new commitment is a step forward and is recorded as one.
export function mergeTarget(previous: PivotTarget | undefined, built: PivotTarget, now: Date): PivotTarget {
  const at = now.toISOString()
  if (!previous) return { ...built, since: at, history: [{ at, stance: stanceOf(built) }] }
  // What the form says about the commitment wins (unticking it uncommits), but the original date stays when nothing changed.
  const sameCommitment = !!previous.committedAt && !!built.committedAt && previous.route === built.route && previous.hoursPerWeek === built.hoursPerWeek
  const merged: PivotTarget = {
    ...previous,
    ...built,
    route: built.route,
    hoursPerWeek: built.hoursPerWeek,
    how: built.how,
    committedAt: sameCommitment ? previous.committedAt : built.committedAt,
    since: previous.since ?? at,
    feeling: previous.feeling,
    history: previous.history ?? [],
    stance: previous.stance === 'SET_ASIDE' ? 'WONDERING' : previous.stance,
  }
  const after = stanceOf(merged)
  if (after === stanceOf(previous)) return merged
  return { ...merged, history: [...merged.history!, { at, stance: after, ...(merged.feeling ? { feeling: merged.feeling } : {}) }].slice(-40) }
}

// The ones they have not set aside, which is what the radar shows first.
export const activeTargets = (p: PivotDetails | null): PivotTarget[] => (p?.targets ?? []).filter((t) => stanceOf(t) !== 'SET_ASIDE')

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
  return (p?.targets ?? []).filter((t) => stanceOf(t) !== 'SET_ASIDE' && isSearchable(t.tier, isCommitted(t)))
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
  if (!p) return []
  // Gentle, and not every week: a check-in on how it feels about once a month.
  const checkInWeek = Math.floor(now.getTime() / (7 * 86_400_000)) % 4 === 0
  const out: PivotPlanItem[] = []
  for (const t of p.targets) {
    const stance = stanceOf(t)
    if (t.tier === 'SAME' || t.tier === 'LEVEL_GATED' || stance === 'SET_ASIDE') continue
    // A natural move and a committed change are carried by their learning paths (src/lib/journey/learning-paths.ts), one step at a time.
    if (t.tier === 'ADJACENT' || isCommitted(t)) continue
    if (!checkInWeek) continue
    out.push(
      stance === 'TRYING'
        ? { text: `You are trying out ${t.function}. How does it feel now? Update your radar, or set it aside. Either is fine.` }
        : { text: `You have been wondering about ${t.function}. One small thing this month: talk to someone who does it. No decision needed.`, actionType: 'OUTREACH_CALL' },
    )
  }
  return out
}

// Industries and skills a member is looking into. Lighter than a function: no feasibility, just a place
// to keep the interest so we remember it and can check in. Stored in journeyDetails.pivotInterests.
export type IndustryInterest = { name: string; since: string; setAside?: boolean }
export type PivotInterests = { industries: IndustryInterest[] }

export function pivotInterestsOf(details: unknown): PivotInterests {
  const v = (details as { pivotInterests?: { industries?: unknown } } | null)?.pivotInterests
  const industries = Array.isArray(v?.industries) ? (v!.industries as unknown[]).filter((x): x is IndustryInterest => !!x && typeof (x as IndustryInterest).name === 'string' && typeof (x as IndustryInterest).since === 'string') : []
  return { industries }
}
