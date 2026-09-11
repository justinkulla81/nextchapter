import type { CrmLeadQuality, CrmEligibility } from '@prisma/client'

/**
 * Priority scoring.
 *
 * Lead QUALITY is your judgement of fit — set by hand, rarely changes.
 * Lead PRIORITY is how much something deserves attention this week, and it
 * depends on things that move on their own: deadlines approaching,
 * conversations going cold. Conflating the two is why the `Priority` column
 * in the source spreadsheets went stale — a number typed in July can't know a
 * window closed in September.
 *
 * Recomputed nightly by scripts/crm/recompute-scores.ts.
 */

export const QUALITY_WEIGHT: Record<CrmLeadQuality, number> = {
  A: 1.0,
  B: 0.7,
  C: 0.4,
  D: 0.1,
  // Not zero: an ungraded lead should still surface for triage, otherwise
  // nothing you haven't already judged ever reaches the queue.
  UNGRADED: 0.3,
}

/**
 * Applied as a MULTIPLIER, not a subtraction.
 *
 * A subtraction lets an ineligible funder with a deadline in nine days climb
 * the queue on urgency alone. At x0.1 nothing NextChapter cannot actually
 * receive money from can outrank something winnable, whatever else is true
 * about it — while still being kept and searchable.
 */
export const ELIGIBILITY_MULTIPLIER: Record<CrmEligibility, number> = {
  FOR_PROFIT_ELIGIBLE: 1.0,
  PARTNER_OR_RESEARCH: 0.5,
  UNKNOWN: 0.8,
  NONPROFIT_ONLY: 0.1,
  NOT_APPLICABLE: 1.0,
}

export interface ScoreInput {
  quality: CrmLeadQuality
  eligibility: CrmEligibility
  /** Strength of the best known route in: 1 direct, 0.6 routed, 0.2 cold. */
  warmPath: number
  /** Soonest real deadline, or null. Prose-only deadlines contribute nothing. */
  nextDueAt: Date | null
  /** A date promised to another person — outranks an internal reminder. */
  committedFollowUpAt: Date | null
  /** 0-1 position through the pipeline. */
  stageProgress: number
  /** Most recent touch of any kind, or null if never contacted. */
  lastTouchedAt: Date | null
  /** Used as the staleness floor when nothing has ever been logged. */
  createdAt: Date
  now?: Date
}

export interface ScoreBreakdown {
  score: number
  quality: number
  warmPath: number
  deadline: number
  momentum: number
  staleness: number
  multiplier: number
}

const DAY = 86_400_000

/** 1.0 inside 14 days, 0.5 inside 60, 0 beyond. Past-due counts as maximum. */
export function deadlineUrgency(due: Date | null, now: Date): number {
  if (!due) return 0
  const days = (due.getTime() - now.getTime()) / DAY
  if (days <= 14) return 1
  if (days <= 60) return 0.5
  return 0
}

/**
 * Staleness rises with days since the last touch, capped at 90.
 *
 * Never-contacted deliberately measures from when the record was created, not
 * from zero: a lead sitting untouched for two months is stale whether or not
 * anyone has written to it. The Microsoft outplacement lead sat 67 days.
 */
export function staleness(lastTouchedAt: Date | null, createdAt: Date, now: Date): number {
  const from = lastTouchedAt ?? createdAt
  const days = Math.max(0, (now.getTime() - from.getTime()) / DAY)
  return Math.min(days, 90) / 90
}

export function computePriority(input: ScoreInput): ScoreBreakdown {
  const now = input.now ?? new Date()

  // A promise made to a person is treated as a deadline in its own right, and
  // a broken one is worse than a missed opportunity — so it takes the higher
  // of the two urgencies rather than averaging them away.
  const urgency = Math.max(
    deadlineUrgency(input.nextDueAt, now),
    deadlineUrgency(input.committedFollowUpAt, now)
  )

  const quality = 35 * (QUALITY_WEIGHT[input.quality] ?? 0.3)
  const warmPath = 20 * clamp01(input.warmPath)
  const deadline = 20 * urgency
  const momentum = 15 * clamp01(input.stageProgress)
  const stale = 10 * staleness(input.lastTouchedAt, input.createdAt, now)

  const base = quality + warmPath + deadline + momentum - stale
  const multiplier = ELIGIBILITY_MULTIPLIER[input.eligibility] ?? 1
  const score = Math.max(0, Math.round(base * multiplier * 10) / 10)

  return { score, quality, warmPath, deadline, momentum, staleness: stale, multiplier }
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

/**
 * Warm-path strength from what we actually know today.
 *
 * Phase 6 replaces this with the strongest live CrmIntroPath. Until those
 * exist, a person you are connected to on LinkedIn is the best available
 * signal of a real route in — `connectedAt` is only ever set from your own
 * export, so it means a genuine first-degree connection rather than a guess.
 */
export function warmPathFromContacts(contacts: { connectedAt: Date | null }[]): number {
  if (contacts.length === 0) return 0.2
  return contacts.some((c) => c.connectedAt) ? 1 : 0.6
}
