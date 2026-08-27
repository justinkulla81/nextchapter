// Calibration loop (Market Reality Redesign Part 3) — the one thing
// allowed to move perAttemptProbability/probabilityGrade after
// probability.ts's initial band-midpoint seed. Runs weekly (piggybacked on
// the existing market-reality-snapshot cron), compares each candidate's
// OBSERVED interview rate against the rate their current band's midpoint
// implies, and nudges the estimate — small and gradual by default, faster
// only when corroborated by what similar candidates are seeing at the same
// time. Writes an append-only log row every week (even weeks that don't
// move anything) so the history itself is inspectable.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { BAND_MIDPOINT, PROBABILITY_BANDS } from './probability'
import { computeWeightedAttempts } from './attempts'
import type { Grade } from '@/lib/scoring/grade'

// Estimate — below this many weighted attempts in the rolling window, one
// candidate's observed rate is too noisy to calibrate on at all (a single
// interview or its absence swings the ratio wildly at low N).
export const MIN_SAMPLE_ATTEMPTS = 15

// Estimate — how far observed must diverge from expected before it reads
// as a real gap rather than the normal week-to-week wobble of a ratio.
const UNDER_THRESHOLD_RATIO = 0.7
const OVER_THRESHOLD_RATIO = 1.3

// Estimate — the low end of the master prompt's 3-4-week range. A full
// letter-band cross only happens after the SAME gap direction persists
// this many consecutive weekly checks, unless aggregate corroboration
// fast-paths it (see below).
export const CONSECUTIVE_WEEKS_FOR_BAND_CROSS = 3

// Estimate, same small-cohort-suppression convention as bias-detection.ts —
// a "shared downturn" needs at least this many other candidates in the same
// target-role/location cohort before it counts as corroboration rather than
// a handful of individuals' coincidental variance.
export const MIN_AGGREGATE_COHORT_SIZE = 5

// Estimate — how far the cohort's own trailing posting-count average must
// have moved to count as a real shared shift, not noise in the smoothing
// itself. Same 15%-materiality bar market.ts's own driver text already uses.
const AGGREGATE_SHIFT_THRESHOLD = 0.15

// Estimate — the fraction of the gap toward the observed rate a
// non-crossing week nudges perAttemptProbability, clamped to stay inside
// the current band. Keeps every week honest ("we're already responding to
// what we're seeing") without letting one noisy week alone relabel the grade.
const WITHIN_BAND_NUDGE_FRACTION = 0.15

export type GapDirection = 'UNDER' | 'OVER' | 'ON_TRACK'

export interface CalibrationCheckResult {
  weekStartDate: Date
  weightedAttempts: number
  observedRate: number | null
  expectedRate: number
  gapDirection: GapDirection | null
  aggregateCorroborated: boolean
  adjustmentApplied: boolean
  bandCrossed: boolean
  newProbabilityGrade: Grade | null
  alreadyChecked: boolean
}

const BAND_ORDER: Grade[] = ['F', 'D', 'C', 'B', 'A']

function adjacentBand(current: Grade, direction: 'UNDER' | 'OVER'): Grade {
  const index = BAND_ORDER.indexOf(current)
  const nextIndex = direction === 'UNDER' ? index - 1 : index + 1
  return BAND_ORDER[Math.max(0, Math.min(BAND_ORDER.length - 1, nextIndex))]
}

// Reuses probability.ts's own PROBABILITY_BANDS rather than a second copy
// of the same ranges — A's upper bound is deliberately unbounded there, so
// a nudge toward an even-higher observed rate is only capped by A's floor.
function clampToBand(probability: number, band: Grade): number {
  const { min, max } = PROBABILITY_BANDS[band]
  const clampedMin = Math.max(min, probability)
  return max === null ? clampedMin : Math.min(max, clampedMin)
}

// The lighter cross-candidate proxy the user confirmed in place of real
// WARN Act/Layoffs.fyi ingestion: did OTHER candidates targeting the same
// role+location see a real posting-volume shortfall (or upturn) at the
// same time? Reuses MarketDifficultySnapshot exactly as market.ts already
// writes it — no new data collection, no new smoothing logic.
async function checkAggregateCorroboration(
  targetRoleQuery: string,
  location: string,
  weekOf: Date,
  direction: 'UNDER' | 'OVER'
): Promise<boolean> {
  const cohortSnapshots = await prisma.marketDifficultySnapshot.findMany({
    where: { targetRoleQuery, location, weekOf },
    select: { candidateId: true, postingCount: true },
  })
  // Distinct candidates only — a candidate can't corroborate their own gap.
  const distinctCandidates = new Set(cohortSnapshots.map((s) => s.candidateId))
  if (distinctCandidates.size < MIN_AGGREGATE_COHORT_SIZE) return false

  const priorWeek = new Date(weekOf.getTime() - 7 * 24 * 60 * 60 * 1000)
  const priorSnapshots = await prisma.marketDifficultySnapshot.findMany({
    where: { targetRoleQuery, location, weekOf: priorWeek },
    select: { postingCount: true },
  })
  if (priorSnapshots.length < MIN_AGGREGATE_COHORT_SIZE) return false

  const currentAvg = cohortSnapshots.reduce((sum, s) => sum + s.postingCount, 0) / cohortSnapshots.length
  const priorAvg = priorSnapshots.reduce((sum, s) => sum + s.postingCount, 0) / priorSnapshots.length
  if (priorAvg === 0) return false

  const changeRatio = (currentAvg - priorAvg) / priorAvg
  // UNDER (fewer interviews than expected) is corroborated by a real
  // cohort-wide POSTING decline; OVER by a real cohort-wide increase.
  return direction === 'UNDER' ? changeRatio <= -AGGREGATE_SHIFT_THRESHOLD : changeRatio >= AGGREGATE_SHIFT_THRESHOLD
}

// Same-direction streak ending at (and including) the check about to be
// written — counts backward through the log until the direction breaks or
// a week is missing (a skipped cron week resets the streak rather than
// silently bridging it, since we can't know what happened in the gap).
async function countConsecutiveMatchingWeeks(
  candidateId: string,
  direction: GapDirection,
  weekStartDate: Date
): Promise<number> {
  const priorChecks = await prisma.marketRealityCalibrationCheck.findMany({
    where: { candidateId, weekStartDate: { lt: weekStartDate } },
    orderBy: { weekStartDate: 'desc' },
    take: CONSECUTIVE_WEEKS_FOR_BAND_CROSS,
    select: { weekStartDate: true, gapDirection: true },
  })

  let streak = 1 // this week's own check counts as the first
  let expectedWeekStart = weekStartDate.getTime() - 7 * 24 * 60 * 60 * 1000
  for (const check of priorChecks) {
    if (check.gapDirection !== direction) break
    if (check.weekStartDate.getTime() !== expectedWeekStart) break
    streak++
    expectedWeekStart -= 7 * 24 * 60 * 60 * 1000
  }
  return streak
}

export async function runWeeklyCalibrationCheck(candidateId: string, weekStartDate: Date): Promise<CalibrationCheckResult> {
  const existing = await prisma.marketRealityCalibrationCheck.findUnique({
    where: { candidateId_weekStartDate: { candidateId, weekStartDate } },
  })
  if (existing) {
    return {
      weekStartDate,
      weightedAttempts: existing.weightedAttempts,
      observedRate: existing.observedRate,
      expectedRate: existing.expectedRate,
      gapDirection: existing.gapDirection as GapDirection | null,
      aggregateCorroborated: existing.aggregateCorroborated,
      adjustmentApplied: existing.adjustmentApplied,
      bandCrossed: existing.bandCrossed,
      newProbabilityGrade: null,
      alreadyChecked: true,
    }
  }

  const [component, candidate] = await Promise.all([
    prisma.marketRealityComponentScore.findUnique({ where: { candidateId } }),
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: { targetRoleType: true, primaryFunction: true, currentCity: true, currentState: true },
    }),
  ])

  // Nothing to calibrate until the probability engine has run at least
  // once (computeProbabilityGrade seeds these on the candidate's first
  // Market Reality Report generation).
  if (!component?.probabilityGrade || component.perAttemptProbability === null) {
    return {
      weekStartDate,
      weightedAttempts: 0,
      observedRate: null,
      expectedRate: 0,
      gapDirection: null,
      aggregateCorroborated: false,
      adjustmentApplied: false,
      bandCrossed: false,
      newProbabilityGrade: null,
      alreadyChecked: false,
    }
  }

  const currentBand = component.probabilityGrade as Grade
  const expectedRate = BAND_MIDPOINT[currentBand]
  const rollingWindowWeeks = component.rollingWindowWeeks
  const attempts = await computeWeightedAttempts(candidateId, rollingWindowWeeks)

  if (attempts.weightedAttempts < MIN_SAMPLE_ATTEMPTS) {
    await prisma.marketRealityCalibrationCheck.create({
      data: {
        candidateId,
        weekStartDate,
        weightedAttempts: attempts.weightedAttempts,
        observedRate: null,
        expectedRate,
        gapDirection: null,
        aggregateCorroborated: false,
        adjustmentApplied: false,
        bandCrossed: false,
      },
    })
    return {
      weekStartDate,
      weightedAttempts: attempts.weightedAttempts,
      observedRate: null,
      expectedRate,
      gapDirection: null,
      aggregateCorroborated: false,
      adjustmentApplied: false,
      bandCrossed: false,
      newProbabilityGrade: null,
      alreadyChecked: false,
    }
  }

  const observedInterviews = await prisma.jobPosting.count({
    where: { candidateId, interviewLandedAt: { gte: attempts.windowStart } },
  })
  const observedRate = observedInterviews / attempts.weightedAttempts

  const gapDirection: GapDirection =
    observedRate < expectedRate * UNDER_THRESHOLD_RATIO
      ? 'UNDER'
      : observedRate > expectedRate * OVER_THRESHOLD_RATIO
        ? 'OVER'
        : 'ON_TRACK'

  let aggregateCorroborated = false
  let adjustmentApplied = false
  let bandCrossed = false
  let newPerAttemptProbability = component.perAttemptProbability
  let newProbabilityGrade: Grade = currentBand

  if (gapDirection !== 'ON_TRACK') {
    const targetRoleQuery = (candidate.targetRoleType || candidate.primaryFunction || '').trim().toLowerCase() || 'general'
    const location = candidate.currentCity
      ? `${candidate.currentCity.trim().toLowerCase()}, ${(candidate.currentState || '').trim().toLowerCase()}`
      : (candidate.currentState || '').trim().toLowerCase() || 'us'

    aggregateCorroborated = await checkAggregateCorroboration(targetRoleQuery, location, weekStartDate, gapDirection)

    const consecutiveWeeks = await countConsecutiveMatchingWeeks(candidateId, gapDirection, weekStartDate)
    const eligibleForBandCross = aggregateCorroborated || consecutiveWeeks >= CONSECUTIVE_WEEKS_FOR_BAND_CROSS

    if (eligibleForBandCross) {
      const targetBand = adjacentBand(currentBand, gapDirection)
      if (targetBand !== currentBand) {
        newProbabilityGrade = targetBand
        newPerAttemptProbability = BAND_MIDPOINT[targetBand]
        bandCrossed = true
        adjustmentApplied = true
      }
    }

    if (!bandCrossed) {
      // Within-band nudge — move partway toward the observed rate, clamped
      // so a noisy single week can never relabel the grade on its own. The
      // grade is pinned to currentBand explicitly here, NOT re-derived via
      // mapProbabilityToBand(newPerAttemptProbability): a band's declared
      // max is the same number mapProbabilityToBand treats as the FLOOR of
      // the next band up (e.g. 0.03 is both C's max and B's min), so a
      // nudge clamped to that exact boundary would silently re-map into
      // the adjacent band — crossing it without ever going through the
      // persistence/corroboration gate above. Pinning the grade is what
      // actually enforces "a nudge never crosses a band on its own."
      const nudged = component.perAttemptProbability + (observedRate - component.perAttemptProbability) * WITHIN_BAND_NUDGE_FRACTION
      newPerAttemptProbability = clampToBand(nudged, currentBand)
      newProbabilityGrade = currentBand
      adjustmentApplied = newPerAttemptProbability !== component.perAttemptProbability
    }
  }

  await prisma.$transaction([
    prisma.marketRealityCalibrationCheck.create({
      data: {
        candidateId,
        weekStartDate,
        weightedAttempts: attempts.weightedAttempts,
        observedRate,
        expectedRate,
        gapDirection,
        aggregateCorroborated,
        adjustmentApplied,
        bandCrossed,
      },
    }),
    ...(adjustmentApplied
      ? [
          prisma.marketRealityComponentScore.update({
            where: { candidateId },
            data: {
              perAttemptProbability: newPerAttemptProbability,
              probabilityGrade: newProbabilityGrade,
              probabilityComputedAt: new Date(),
            },
          }),
        ]
      : []),
  ])

  return {
    weekStartDate,
    weightedAttempts: attempts.weightedAttempts,
    observedRate,
    expectedRate,
    gapDirection,
    aggregateCorroborated,
    adjustmentApplied,
    bandCrossed,
    newProbabilityGrade: adjustmentApplied ? newProbabilityGrade : null,
    alreadyChecked: false,
  }
}

export interface CalibrationMessage {
  headline: string
  body: string
}

// Two framings, never conflated: an aggregate-corroborated downward move is
// externally caused and says so plainly; an individual-level move never
// blames a market shift that isn't actually happening. Upward calibration
// (either case) gets the same warm, matter-of-fact tone as other genuinely
// good news in the product (e.g. unlocking Candidate+).
export function getCalibrationMessage(
  check: Pick<CalibrationCheckResult, 'bandCrossed' | 'aggregateCorroborated'>,
  direction: 'UNDER' | 'OVER',
  targetRoleLabel: string
): CalibrationMessage | null {
  if (!check.bandCrossed) return null

  if (direction === 'OVER') {
    return {
      headline: 'Your grade just moved up.',
      body: "Your search is converting better than we estimated, so we're updating your grade up to reflect that. Nice work.",
    }
  }

  if (check.aggregateCorroborated) {
    return {
      headline: 'Your grade updated to reflect the market.',
      body: `The job market for ${targetRoleLabel} has gotten tougher recently — we're updating your estimate to reflect that, not something about you.`,
    }
  }

  return {
    headline: 'Your grade updated.',
    body: "We're refining our estimate based on what we're actually seeing in your search — this isn't the market shifting, it's us getting a more accurate read.",
  }
}
