// Real attempts in the candidate's own rolling search window — the
// "numerator" side of the probability engine (probability.ts). Applications
// and networking outreach are ATTEMPTS against a fixed per-attempt
// probability, not scored effort — this module counts them, it never
// grades them.
//
// Deliberately reuses the existing Job Fit infrastructure
// (src/lib/jobs/job-fit-bucket.ts's STRONG_FIT_THRESHOLD) rather than
// building new relevance-detection logic. A posting only gets excluded
// when there's REAL positive evidence it was a poor-fit application
// (fitScore already computed and below threshold) — a posting the
// candidate applied to without ever running Job Fit analysis counts by
// default rather than fabricating a relevance judgment for it. This keeps
// the count honest without a live fallback scoring pass over every
// never-analyzed posting on every recompute.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { STRONG_FIT_THRESHOLD } from '@/lib/jobs/job-fit-bucket'

// Estimate — real research on referral/network-driven placement suggests
// networking outreach converts meaningfully better than a cold application,
// especially at senior levels. 4 is the midpoint of the 3-5x estimate
// range; labeled as an estimate everywhere it's shown, never asserted as
// validated fact.
export const NETWORKING_WEIGHT = 4

export interface WeightedAttemptsResult {
  weightedAttempts: number
  rawApplications: number
  qualityFilteredApplications: number // real applications minus confirmed-poor-fit ones
  poorFitApplications: number // excluded from the count — the real-time feedback trigger uses this too
  networkingActions: number
  windowStart: Date
}

// Pure weighting math, kept separate from the Prisma-calling wrapper below
// so it's directly unit-testable with no DB/mocking involved (same
// separation composite.ts's pure helpers get from computeMarketRealityCompositeGrade).
export function weightApplicationsAndNetworking(
  fitScores: (number | null)[],
  networkingActionCount: number
): Omit<WeightedAttemptsResult, 'windowStart'> {
  const rawApplications = fitScores.length
  const poorFitApplications = fitScores.filter((score) => score !== null && score < STRONG_FIT_THRESHOLD).length
  const qualityFilteredApplications = rawApplications - poorFitApplications
  const weightedAttempts = qualityFilteredApplications + networkingActionCount * NETWORKING_WEIGHT

  return { weightedAttempts, rawApplications, qualityFilteredApplications, poorFitApplications, networkingActions: networkingActionCount }
}

export async function computeWeightedAttempts(candidateId: string, windowWeeks: number): Promise<WeightedAttemptsResult> {
  const windowStart = new Date(Date.now() - windowWeeks * 7 * 24 * 60 * 60 * 1000)

  const [applications, networkingActions] = await Promise.all([
    prisma.jobPosting.findMany({
      where: { candidateId, appliedAt: { gte: windowStart } },
      select: { fitScore: true },
    }),
    prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: windowStart } } }),
  ])

  return { ...weightApplicationsAndNetworking(applications.map((a) => a.fitScore), networkingActions), windowStart }
}

// Real-time feedback trigger for markApplied — a posting counts as a poor
// fit for this purpose only when Job Fit has already been run on it and
// came back below the strong-fit threshold (same signal as the count
// above, checked for one posting instead of a whole window).
export function isPoorFitApplication(fitScore: number | null): boolean {
  return fitScore !== null && fitScore < STRONG_FIT_THRESHOLD
}
