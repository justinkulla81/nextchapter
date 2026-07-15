import { prisma } from '@/lib/prisma'
import type {
  CandidateProfile,
  JobPosting,
  LinkedInActivityLog,
  Reference,
  VisibilityTier,
  WorkSample,
} from '@prisma/client'
import { MANIPULATION_FLAG_THRESHOLD } from '@/lib/scoring/assessment-vectors'
import {
  COMMUNITY_POINTS_PER_POST,
  COMMUNITY_POINTS_WINDOW_DAYS,
  COMMUNITY_POINTS_CAP,
} from '@/lib/constants/community'
import { LINKEDIN_PRESENCE_POINTS, LINKEDIN_POINTS_PER_LOG, LINKEDIN_POINTS_WINDOW_DAYS, LINKEDIN_POINTS_CAP } from '@/lib/constants/linkedin'
import { INTERVIEW_LANDED_POINTS_PER_JOB, INTERVIEW_LANDED_CAP, OFFER_RECEIVED_POINTS_PER_JOB, OFFER_RECEIVED_CAP, APPLIED_POINTS_PER_JOB, APPLIED_CAP } from '@/lib/constants/job-milestones'
import { NETWORKING_LIST_POINTS, ASK_FOR_HELP_POINTS } from '@/lib/constants/desire-signal'
import { isVagueTargetRole } from '@/lib/constants/onboarding'

// Sub-score ceilings. These are deliberately HIGHER than 100 now — see
// `saturate()` below for why. Each is the sum of its own per-term caps
// (already enforced individually further down), so raising the outer cap
// only raises a finite, derived ceiling — never truly unbounded.
export const SIGNAL_DEPTH_RAW_CAP = 200 // 127 (existing terms) + 8 + 10 + 20 + 30 + 5 (new terms)
export const DESIRE_SIGNAL_RAW_CAP = 140 // 100 (existing terms) + 12 + 8 + 20 (job search intensity, new)

// Theoretical raw maximum with every input maxed: 195*0.3 + 100*0.25 +
// 140*0.25 + 100*0.1 + 100*0.1 = 138.5.
//
// The displayed/stored score stays a saturating (never-100) transform of
// this raw total, like a credit score: 100 * (1 - e^(-raw/K)). K=70 was
// chosen so even the theoretical max (133.5) saturates to ~85, not the
// 94-96 range — deliberately conservative so the top of the range stays
// very unlikely to reach, not just "practically" but structurally, per
// explicit product direction. Earlier growth (small raw) is close to
// linear; increments shrink as raw grows (diminishing returns) with zero
// extra logic beyond the exponential shape.
export const EMPLOYABILITY_SATURATION_K = 70

export function saturate(rawScoreTotal: number): number {
  return 100 * (1 - Math.exp(-rawScoreTotal / EMPLOYABILITY_SATURATION_K))
}

export interface RawScoreBreakdown {
  signalDepth: number // 0-195: authenticated signals
  narrativeClarity: number // 0-100: specificity of profile content
  desireSignal: number // 0-120: evidence of genuine motivation
  consistency: number // 0-100: stated prefs match behavioral signals
  aiFlexibility: number // 0-100: demonstrated AI competency
}

export interface ScoreBreakdown extends RawScoreBreakdown {
  total: number // 0-100, saturated/displayed
}

export type CandidateWithScoringRelations = CandidateProfile & {
  references: Reference[]
  workSamples: WorkSample[]
  peerNominations: { verified: boolean }[]
  learningBadges: { completedAt: Date }[]
  assessmentResults: { assessmentType: string }[]
  assessmentResponses: { inconsistencyScore: number | null }[]
  communityPosts: { createdAt: Date }[]
  linkedInActivityLogs: LinkedInActivityLog[]
  jobPostings: JobPosting[]
}

export function computeRawBreakdown(candidate: CandidateWithScoringRelations): RawScoreBreakdown {
  // ── SIGNAL DEPTH ──────────────────────────────────────────────────────────
  let signalDepth = 0

  const completedRefs = candidate.references.filter((r) => r.status === 'COMPLETED')
  const refScore = Math.min(completedRefs.length * 7, 35)

  const refTypes = new Set(completedRefs.map((r) => r.relationshipType))
  const diversityBonus = Math.min(refTypes.size * 3, 12)

  const recentRefs = completedRefs.filter((r) => {
    const threeYearsAgo = new Date()
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
    return r.completedAt && r.completedAt > threeYearsAgo
  })
  const recencyBonus = Math.min(recentRefs.length * 2, 8)

  signalDepth += refScore + diversityBonus + recencyBonus

  const verifiedSamples = candidate.workSamples.filter((w) => w.verified)
  const unverifiedSamples = candidate.workSamples.filter((w) => !w.verified)
  signalDepth += Math.min(verifiedSamples.length * 5, 15)
  signalDepth += Math.min(unverifiedSamples.length * 2, 6)

  const assessmentTypes = new Set(candidate.assessmentResults.map((a) => a.assessmentType))
  signalDepth += Math.min(assessmentTypes.size * 5, 15)

  const recentBadges = candidate.learningBadges.filter((b) => {
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    return b.completedAt > sixtyDaysAgo
  })
  signalDepth += Math.min(candidate.learningBadges.length * 2, 7)
  signalDepth += Math.min(recentBadges.length * 3, 9)

  const verifiedNominations = candidate.peerNominations.filter((n) => n.verified)
  signalDepth += Math.min(verifiedNominations.length * 4, 9)

  // Community Board participation — decays on a rolling window rather than
  // accumulating forever, so a candidate has to keep posting (not just post
  // once) to maintain the bonus. See src/lib/constants/community.ts.
  const communityWindowStart = new Date()
  communityWindowStart.setDate(communityWindowStart.getDate() - COMMUNITY_POINTS_WINDOW_DAYS)
  const recentCommunityPosts = candidate.communityPosts.filter(
    (p) => p.createdAt > communityWindowStart
  )
  signalDepth += Math.min(recentCommunityPosts.length * COMMUNITY_POINTS_PER_POST, COMMUNITY_POINTS_CAP)

  // LinkedIn presence + rolling-window posting activity (URL-only signal —
  // no content/quality analysis, since LinkedIn can't be scraped).
  if (candidate.linkedInUrl) signalDepth += LINKEDIN_PRESENCE_POINTS

  const linkedInWindowStart = new Date()
  linkedInWindowStart.setDate(linkedInWindowStart.getDate() - LINKEDIN_POINTS_WINDOW_DAYS)
  const recentLinkedInLogs = candidate.linkedInActivityLogs.filter(
    (l) => l.loggedAt > linkedInWindowStart
  )
  signalDepth += Math.min(recentLinkedInLogs.length * LINKEDIN_POINTS_PER_LOG, LINKEDIN_POINTS_CAP)

  // Interview/offer milestones — external validation, same category as
  // references/verified samples.
  const interviewsLanded = candidate.jobPostings.filter((j) => j.interviewLandedAt !== null).length
  signalDepth += Math.min(interviewsLanded * INTERVIEW_LANDED_POINTS_PER_JOB, INTERVIEW_LANDED_CAP)

  const offersReceived = candidate.jobPostings.filter((j) => j.offerReceivedAt !== null).length
  signalDepth += Math.min(offersReceived * OFFER_RECEIVED_POINTS_PER_JOB, OFFER_RECEIVED_CAP)

  const jobsApplied = candidate.jobPostings.filter((j) => j.appliedAt !== null).length
  signalDepth += Math.min(jobsApplied * APPLIED_POINTS_PER_JOB, APPLIED_CAP)

  signalDepth = Math.min(signalDepth, SIGNAL_DEPTH_RAW_CAP)

  // ── NARRATIVE CLARITY (0-100) ─────────────────────────────────────────────
  let narrativeClarity = 0

  if (candidate.part1Complete) narrativeClarity += 20
  if (candidate.part2Complete) narrativeClarity += 20
  if (candidate.part3Complete) narrativeClarity += 20
  if (candidate.part4Complete) narrativeClarity += 20

  if (candidate.knownFor) narrativeClarity += 5

  narrativeClarity = Math.min(narrativeClarity, 100)

  // ── DESIRE SIGNAL ─────────────────────────────────────────────────────────
  let desireSignal = 0

  if (candidate.assessmentComplete) desireSignal += 20

  const hasRankedTradeoffs = candidate.priorityMaxComp !== null
  if (hasRankedTradeoffs) desireSignal += 15

  if (candidate.willingToStartLower) desireSignal += 10
  if (candidate.openToRelocation) desireSignal += 8
  if (candidate.compFlexible) desireSignal += 7

  desireSignal += Math.min(candidate.references.length * 5, 20)

  // Candidate-effort/motivation signals — networking assignment + asking
  // for help, same category as flexibility preferences above.
  if (candidate.networkingListSubmittedAt) desireSignal += NETWORKING_LIST_POINTS
  if (candidate.askedForHelpAt) desireSignal += ASK_FOR_HELP_POINTS

  // "How much do you want to get a job" pre-onboarding slider (0-100) —
  // default 50/neutral for anyone who onboarded before this field existed,
  // so retroactive recalculation doesn't crater their score. "Casually
  // looking" visibly costs real points here, as intended.
  desireSignal += Math.round((candidate.jobSearchIntensity ?? 50) * 0.2)

  // A vague target role ("flexible", "open", etc. instead of an actual
  // title) reads as not having a strong direction yet — a real, if modest,
  // drag on the motivation/clarity signal, combined with the other terms
  // above rather than scored in isolation.
  if (isVagueTargetRole(candidate.targetRoleType)) desireSignal -= 8

  desireSignal = Math.max(0, Math.min(desireSignal, DESIRE_SIGNAL_RAW_CAP))

  // ── CONSISTENCY SCORE (0-100) ─────────────────────────────────────────────
  // Derived from the assessment's Inconsistency Index — the delta between a
  // candidate's quad-block choices and their Likert cross-check answers
  // (see computeInconsistency in assessment-vectors.ts) — rather than
  // reference ratings, so it reflects genuine self-report contradiction
  // rather than how well-liked the candidate was.
  // Below 1.0 -> 90+. Above MANIPULATION_FLAG_THRESHOLD (1.8, same cutoff
  // that sets manipulationRiskFlag) -> 20 or below. Piecewise-linear through
  // both calibration points, reaching 0 at inconsistencyScore's realistic
  // max of 2.0 (mean of only-flagged per-pair deltas, each capped at 2).
  const latestAssessment = candidate.assessmentResponses[0]
  const inconsistencyScore = latestAssessment?.inconsistencyScore ?? null

  let consistency: number
  if (inconsistencyScore === null) {
    consistency = 50 // no assessment completed yet — neutral prior
  } else if (inconsistencyScore <= 1.0) {
    consistency = 100 - inconsistencyScore * 10
  } else if (inconsistencyScore <= MANIPULATION_FLAG_THRESHOLD) {
    consistency =
      90 - ((inconsistencyScore - 1.0) / (MANIPULATION_FLAG_THRESHOLD - 1.0)) * 70
  } else {
    consistency = 20 - (inconsistencyScore - MANIPULATION_FLAG_THRESHOLD) * 100
  }

  consistency = Math.max(0, Math.min(consistency, 100))

  // ── AI FLEXIBILITY (0-100) ───────────────────────────────────────────────
  // aiFlexibilityLevel is now a direct 0-100 confidence slider (Experience
  // page), rather than a derived 1-5 discrete tools/use-cases composite.
  let aiFlexibility = candidate.aiFlexibilityLevel ?? 0

  const aiWorkSamples = candidate.workSamples.filter(
    (w) => w.sampleType === 'code' || w.description.toLowerCase().includes('ai')
  )
  aiFlexibility += Math.min(aiWorkSamples.length * 5, 15)

  aiFlexibility = Math.min(aiFlexibility, 100)

  return { signalDepth, narrativeClarity, desireSignal, consistency, aiFlexibility }
}

export function rawTotal(raw: RawScoreBreakdown): number {
  return (
    raw.signalDepth * 0.3 +
    raw.narrativeClarity * 0.25 +
    raw.desireSignal * 0.25 +
    raw.consistency * 0.1 +
    raw.aiFlexibility * 0.1
  )
}

export function displayedTotal(raw: RawScoreBreakdown): number {
  return Math.round(saturate(rawTotal(raw)))
}

export async function calculateEmployabilityScore(candidateId: string): Promise<ScoreBreakdown> {
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: {
      references: true,
      workSamples: true,
      peerNominations: true,
      learningBadges: true,
      assessmentResults: true,
      workHistory: true,
      assessmentResponses: {
        orderBy: { completedAt: 'desc' },
        take: 1,
      },
      communityPosts: { where: { isActive: true } },
      linkedInActivityLogs: true,
      jobPostings: true,
    },
  })

  if (!candidate) throw new Error('Candidate not found')

  const raw = computeRawBreakdown(candidate)
  return { total: displayedTotal(raw), ...raw }
}

export function scoreToVisibilityTier(score: number): VisibilityTier {
  if (score >= 75) return 'SPOTLIGHT'
  if (score >= 50) return 'VERIFIED'
  if (score >= 25) return 'SIGNAL'
  return 'EMERGING'
}

// Marginal point-gain for a hypothetical action — the same action yields
// fewer displayed points the higher the candidate's current raw total
// already is (diminishing returns), so this must be computed dynamically
// rather than using a fixed constant per action.
export function marginalPointGain(
  currentRaw: RawScoreBreakdown,
  hypotheticalRaw: RawScoreBreakdown
): number {
  return Math.round(displayedTotal(hypotheticalRaw) - displayedTotal(currentRaw))
}

export interface NextStep {
  action: string
  pointGain: number | null // null = negligible (<1pt) — UI omits the "+N pts" badge
  effort: 'low' | 'medium' | 'high'
}

function gainOrNull(currentRaw: RawScoreBreakdown, hypotheticalRaw: RawScoreBreakdown): number | null {
  const gain = marginalPointGain(currentRaw, hypotheticalRaw)
  return gain >= 1 ? gain : null
}

export function scoreToNextSteps(
  candidate: CandidateProfile & {
    references: Reference[]
    workSamples: WorkSample[]
    jobPostings: JobPosting[]
    linkedInActivityLogs: LinkedInActivityLog[]
  },
  currentRaw: RawScoreBreakdown
): NextStep[] {
  const steps: NextStep[] = []

  const completedRefs = candidate.references.filter((r) => r.status === 'COMPLETED')

  if (completedRefs.length < 2) {
    const addedRefs = 2 - completedRefs.length
    const newCompletedCount = completedRefs.length + addedRefs
    const refScore = Math.min(newCompletedCount * 7, 35)
    const diversityBonus = Math.min(new Set(completedRefs.map((r) => r.relationshipType)).size * 3, 12)
    const recencyBonus = Math.min(completedRefs.length * 2, 8)
    const hypotheticalSignalDepth = Math.min(
      currentRaw.signalDepth - (Math.min(completedRefs.length * 7, 35) + diversityBonus + recencyBonus) + refScore + diversityBonus + recencyBonus,
      SIGNAL_DEPTH_RAW_CAP
    )
    steps.push({
      action: `Add ${addedRefs} reference${addedRefs > 1 ? 's' : ''}`,
      pointGain: gainOrNull(currentRaw, { ...currentRaw, signalDepth: hypotheticalSignalDepth }),
      effort: 'medium',
    })
  }
  if (candidate.workSamples.length === 0) {
    const hypotheticalSignalDepth = Math.min(currentRaw.signalDepth + 2, SIGNAL_DEPTH_RAW_CAP)
    steps.push({
      action: 'Upload a work sample',
      pointGain: gainOrNull(currentRaw, { ...currentRaw, signalDepth: hypotheticalSignalDepth }),
      effort: 'low',
    })
  }
  if (!candidate.part4Complete) {
    const hypotheticalNarrativeClarity = Math.min(currentRaw.narrativeClarity + 20, 100)
    steps.push({
      action: 'Complete Goals section',
      pointGain: gainOrNull(currentRaw, { ...currentRaw, narrativeClarity: hypotheticalNarrativeClarity }),
      effort: 'low',
    })
  }
  if (!candidate.willingToStartLower && !candidate.compFlexible && !candidate.openToRelocation) {
    const hypotheticalDesireSignal = Math.min(currentRaw.desireSignal + 10, DESIRE_SIGNAL_RAW_CAP)
    steps.push({
      action: 'Add flexibility preferences',
      pointGain: gainOrNull(currentRaw, { ...currentRaw, desireSignal: hypotheticalDesireSignal }),
      effort: 'low',
    })
  }
  if (!candidate.linkedInUrl) {
    const hypotheticalSignalDepth = Math.min(currentRaw.signalDepth + LINKEDIN_PRESENCE_POINTS, SIGNAL_DEPTH_RAW_CAP)
    steps.push({
      action: 'Add your LinkedIn URL',
      pointGain: gainOrNull(currentRaw, { ...currentRaw, signalDepth: hypotheticalSignalDepth }),
      effort: 'low',
    })
  } else {
    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - LINKEDIN_POINTS_WINDOW_DAYS)
    const recentLogs = candidate.linkedInActivityLogs.filter((l) => l.loggedAt > windowStart)
    if (recentLogs.length * LINKEDIN_POINTS_PER_LOG < LINKEDIN_POINTS_CAP) {
      const hypotheticalSignalDepth = Math.min(
        currentRaw.signalDepth + LINKEDIN_POINTS_PER_LOG,
        SIGNAL_DEPTH_RAW_CAP
      )
      steps.push({
        action: 'Post on LinkedIn today',
        pointGain: gainOrNull(currentRaw, { ...currentRaw, signalDepth: hypotheticalSignalDepth }),
        effort: 'low',
      })
    }
  }
  if (!candidate.networkingListSubmittedAt) {
    const hypotheticalDesireSignal = Math.min(currentRaw.desireSignal + NETWORKING_LIST_POINTS, DESIRE_SIGNAL_RAW_CAP)
    steps.push({
      action: 'Submit your networking list',
      pointGain: gainOrNull(currentRaw, { ...currentRaw, desireSignal: hypotheticalDesireSignal }),
      effort: 'medium',
    })
  }
  if (!candidate.askedForHelpAt) {
    const hypotheticalDesireSignal = Math.min(currentRaw.desireSignal + ASK_FOR_HELP_POINTS, DESIRE_SIGNAL_RAW_CAP)
    steps.push({
      action: 'Ask someone for help',
      pointGain: gainOrNull(currentRaw, { ...currentRaw, desireSignal: hypotheticalDesireSignal }),
      effort: 'low',
    })
  }

  return steps.sort((a, b) => (b.pointGain ?? -1) - (a.pointGain ?? -1)).slice(0, 3)
}
