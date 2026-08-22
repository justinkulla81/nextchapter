// The probability engine — Market Reality Redesign Part 1. Market Reality
// Grade is a real, ongoing probability estimate: the candidate's estimated
// per-attempt likelihood of being pulled from a pile for an interview.
// Real attempts (applications + networking, see attempts.ts) compound
// against that estimate; the calibration loop (calibration.ts, Part 3) is
// the ONLY other thing allowed to move the per-attempt estimate itself.
//
// composite.ts's existing Experience+Resume+Market letter grade is NOT
// replaced or duplicated here — it becomes this module's STARTING BAND
// input (exactly the "background/resume/target-market competitiveness"
// denominator the redesign calls for). `computeProbabilityGrade` is the
// single orchestrator every other surface must call; nothing else may
// recompute or duplicate `probabilityGrade` — it's the one candidate-facing
// value going forward. `composite.ts`'s `grade`/`compositeScore` stay
// exactly as they are, now read only as internal input, never shown
// directly as "the grade" to a candidate again.
//
// Deliberately excludes Blockers and Motivations (CandidateProfile.blockers/
// consistencySelfRating/blockersOpenText/motivations/motivationsElaboration)
// from every input path — those stay private, coach-only signal, same
// exclusion this codebase already enforces for the Executive Dossier (see
// dossier-sections.ts's own "WHAT NEVER APPEARS HERE" header comment, the
// pattern this file follows). This module also never receives or forwards
// its result into any employer-facing report builder — see
// hiring-manager-report.ts / recruiter-report.ts's own hard-rule comments,
// which this file must never contradict.
import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Grade } from '@/lib/scoring/grade'
import { computeMarketRealityCompositeGrade } from './composite'
import { computeWeightedAttempts } from './attempts'

// Every number below is a first-pass estimate, not fit to real usage data —
// this product has too few real interview-outcome data points yet to
// calibrate against. Revisit once there's a meaningful population of
// candidates with real attempts + real interview outcomes to check these
// against. Every UI surface that shows one of these must label it as an
// estimate (see EstimateTag) — never assert it as validated fact.
export const PROBABILITY_BANDS: Record<Grade, { min: number; max: number | null }> = {
  A: { min: 0.08, max: null },
  B: { min: 0.03, max: 0.08 },
  C: { min: 0.01, max: 0.03 }, // matches the real ~2-3% market-average applicant-to-interview benchmark
  D: { min: 0.002, max: 0.01 },
  F: { min: 0, max: 0.002 }, // a real qualification mismatch, not a volume problem — see career-pivoter-redirect.ts
}

// The seed/reference value for each band — where cumulativeProbability
// compounds from until a real calibration check (calibration.ts) adjusts it
// based on this candidate's own observed outcomes.
export const BAND_MIDPOINT: Record<Grade, number> = { A: 0.12, B: 0.05, C: 0.02, D: 0.006, F: 0.001 }

const BAND_ORDER: Grade[] = ['F', 'D', 'C', 'B', 'A']

export function mapProbabilityToBand(perAttemptProbability: number): Grade {
  for (const grade of [...BAND_ORDER].reverse()) {
    if (perAttemptProbability >= PROBABILITY_BANDS[grade].min) return grade
  }
  return 'F'
}

// Cumulative probability of at least one success (interview) after N
// attempts, given a fixed per-attempt probability — the core model.
export function cumulativeProbability(perAttemptProbability: number, attempts: number): number {
  if (attempts <= 0) return 0
  return 1 - Math.pow(1 - perAttemptProbability, attempts)
}

export interface ProbabilityGradeResult {
  probabilityGrade: Grade
  perAttemptProbability: number
  rollingAttempts: number
  cumulativeProbability: number
  startingBand: Grade
  rollingWindowWeeks: number
}

const DEFAULT_ROLLING_WINDOW_WEEKS = 10 // estimate, midpoint of the 8-12 week band

// The single orchestrator. Persists onto MarketRealityComponentScore — the
// same row composite.ts already owns, so there is exactly one place this
// grade lives, never a second parallel score. Returns null exactly when
// composite.ts's starting-band computation returns null (nothing measured
// yet at all) — never grades off zeros.
export async function computeProbabilityGrade(candidateId: string): Promise<ProbabilityGradeResult | null> {
  const composite = await computeMarketRealityCompositeGrade(candidateId)
  if (!composite) return null
  const startingBand = composite.grade

  const existing = await prisma.marketRealityComponentScore.findUnique({
    where: { candidateId },
    select: { rollingWindowWeeks: true, perAttemptProbability: true },
  })
  const rollingWindowWeeks = existing?.rollingWindowWeeks ?? DEFAULT_ROLLING_WINDOW_WEEKS

  const attempts = await computeWeightedAttempts(candidateId, rollingWindowWeeks)

  // Seeded ONCE from the starting band's midpoint, the first time this ever
  // runs for a candidate. After that, only calibration.ts (Part 3) is
  // allowed to move perAttemptProbability — this function just re-persists
  // whatever it currently is, refreshed against the latest attempts count,
  // so a resume edit alone never silently overwrites a real calibrated
  // estimate.
  const perAttemptProbability = existing?.perAttemptProbability ?? BAND_MIDPOINT[startingBand]

  const cumProb = cumulativeProbability(perAttemptProbability, attempts.weightedAttempts)
  const probabilityGrade = mapProbabilityToBand(perAttemptProbability)

  await prisma.marketRealityComponentScore.update({
    where: { candidateId },
    data: {
      startingBand,
      perAttemptProbability,
      rollingAttempts: attempts.weightedAttempts,
      rollingWindowWeeks,
      cumulativeProbability: cumProb,
      probabilityGrade,
      probabilityComputedAt: new Date(),
    },
  })

  return {
    probabilityGrade,
    perAttemptProbability,
    rollingAttempts: attempts.weightedAttempts,
    cumulativeProbability: cumProb,
    startingBand,
    rollingWindowWeeks,
  }
}
