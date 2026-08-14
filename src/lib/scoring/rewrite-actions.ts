// Real events that should move a category's baseline directly, because
// they make the candidate objectively more market-ready — not just
// generate weekly effort points. See the Scoring Model 2.0 design doc §7.
//
// These call updateCategoryBaseline (dossier-competencies.ts) rather than
// waiting for the bounded weekly nudge, since a landed interview or a
// closed skills gap is a real, discrete change in standing, not a
// gradual behavioral trend.

import 'server-only'
import type { Reference } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { updateCategoryBaseline } from '@/lib/scoring/dossier-competencies'
import type { CategoryKey } from '@/lib/scoring/grade'

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

async function currentBaseline(candidateId: string, category: CategoryKey): Promise<number> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })
  const stored = candidate.categoryBaselineScores as Record<string, number> | null
  return stored?.[category] ?? 60
}

// A real interview is external validation the market said yes — the
// single highest-signal event available, and one Target Fit currently has
// no way to reflect on its own.
export async function applyInterviewLandedRewrite(candidateId: string): Promise<void> {
  const current = await currentBaseline(candidateId, 'targetFit')
  await updateCategoryBaseline(candidateId, 'targetFit', clamp(current + 8))
}

// An offer is the same signal, stronger.
export async function applyOfferReceivedRewrite(candidateId: string): Promise<void> {
  const current = await currentBaseline(candidateId, 'targetFit')
  await updateCategoryBaseline(candidateId, 'targetFit', clamp(current + 15))
}

// A second distinct opportunity landing an interview is a different, higher
// signal than the first: one interview could be a fluke of a lax screen,
// but two confirms a real pattern the market is responding to. Since
// JobPosting has no company/title field, distinct-JobPosting-row count is
// used as the practical proxy for "a different opportunity," and this fires
// once, specifically on the 1-to-2 crossing — not on every interview after
// the first, which applyInterviewLandedRewrite (called on every interview,
// unbounded up to the 100 clamp) already covers.
export async function applyInterviewPatternConfirmedRewrite(candidateId: string): Promise<void> {
  const interviewCount = await prisma.jobPosting.count({
    where: { candidateId, interviewLandedAt: { not: null } },
  })
  if (interviewCount !== 2) return

  const current = await currentBaseline(candidateId, 'targetFit')
  await updateCategoryBaseline(candidateId, 'targetFit', clamp(current + 10))
}

// A completed reference is the strongest available third-party evidence
// for the five competency categories — each maps to one reference field
// (see dossier-competencies.ts's averageReferenceRating comment for why these
// specific fields, not the legacy rating* columns). Nudges the mapped
// category whenever the reference is either strong evidence on its own
// (rating >= 4) or rebuts a currently weak baseline (< 70, i.e. C or
// below) — covering both "a great reference lands" and "a reference
// specifically closes a named gap" with one mechanism, rather than trying
// to fuzzy-match reference text against named-reasons copy.
const REFERENCE_CATEGORY_FIELDS: {
  category: CategoryKey
  field: keyof Pick<
    Reference,
    'traitPresenceRating' | 'overallRating' | 'traitCollaborationRating' | 'traitAdaptabilityRating' | 'traitFollowThroughRating'
  >
  // trait-* fields are still the 1-5 RatingScale; overallRating moved to the
  // anchored 1-4 scale (AnchoredOverallScale) — each field's own max, not a
  // shared assumed 5, is what normalizes it to a 0-100 impliedScore below.
  maxScale: number
}[] = [
  { category: 'leadership', field: 'traitPresenceRating', maxScale: 5 },
  { category: 'skillsExecution', field: 'overallRating', maxScale: 4 },
  { category: 'communication', field: 'traitCollaborationRating', maxScale: 5 },
  { category: 'adaptability', field: 'traitAdaptabilityRating', maxScale: 5 },
  { category: 'ownership', field: 'traitFollowThroughRating', maxScale: 5 },
]

const WEAK_BASELINE_THRESHOLD = 70
const STRONG_RATING_THRESHOLD = 4
const MAX_REFERENCE_BUMP = 12

export async function applyReferenceCompletedRewrite(candidateId: string, reference: Reference): Promise<void> {
  for (const { category, field, maxScale } of REFERENCE_CATEGORY_FIELDS) {
    const rating = reference[field]
    if (rating === null || rating === undefined) continue

    const impliedScore = clamp(((rating - 1) / (maxScale - 1)) * 100)
    const current = await currentBaseline(candidateId, category)
    if (impliedScore <= current) continue

    const isStrongRating = rating >= STRONG_RATING_THRESHOLD
    const rebutsWeakBaseline = current < WEAK_BASELINE_THRESHOLD
    if (!isStrongRating && !rebutsWeakBaseline) continue

    const bump = Math.min(MAX_REFERENCE_BUMP, impliedScore - current)
    await updateCategoryBaseline(candidateId, category, clamp(current + bump))
  }
}

// Any work history added during what would otherwise read as a gap —
// fractional, consulting, board, volunteer, not just a "real" full-time
// job — is real evidence the candidate stayed engaged, narrowing the
// experience gap Target Fit reflects. Generalizes the interim-job case to
// any non-full-time engagement, rather than special-casing employment type.
export async function applyWorkHistoryDuringGapRewrite(candidateId: string, engagementType: string): Promise<void> {
  if (engagementType === 'FULL_TIME') return
  const current = await currentBaseline(candidateId, 'targetFit')
  await updateCategoryBaseline(candidateId, 'targetFit', clamp(current + 6))
}

// A learning credential that specifically addresses a self-identified
// barrier closes a named, real gap — distinct from ordinary weekly
// learning points. Only fires when the candidate named "skills_gap" as a
// barrier during onboarding; otherwise a completed course is just weekly
// effort, not a structural change.
export async function applyLearningClosesBarrierRewrite(candidateId: string): Promise<void> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { biggestBarriers: true },
  })
  if (!candidate.biggestBarriers.includes('skills_gap')) return

  const current = await currentBaseline(candidateId, 'skillsExecution')
  await updateCategoryBaseline(candidateId, 'skillsExecution', clamp(current + 8))
}

// A verified work sample is tangible, inspectable proof of ability —
// stronger evidence than a self-rated confidence slider, and a real,
// discrete addition rather than a recurring weekly action.
export async function applyWorkSampleUploadedRewrite(candidateId: string): Promise<void> {
  const current = await currentBaseline(candidateId, 'skillsExecution')
  await updateCategoryBaseline(candidateId, 'skillsExecution', clamp(current + 5))
}

interface ResumeScoreSnapshot {
  atsScore: number | null
  resultsScore: number | null
  experienceScore: number | null
}

const MEANINGFUL_RESUME_IMPROVEMENT = 15
const RESUME_IMPROVEMENT_BUMP = 6

// A resume re-upload that meaningfully raises how clearly it communicates
// (ATS readability + quantified results) or how well the underlying
// experience reads against the candidate's target is real, inspectable
// evidence of improvement — not just weekly effort. Also fires on a first
// resume with a decent score, the same "first real evidence" treatment as
// a first reference (see applyReferenceCompletedRewrite). atsScore and
// resultsScore feed Communication & Collaboration; experienceScore feeds
// Target Fit — matching how dossier-competencies.ts's computeCategoryGrades
// now uses these three fields.
export async function applyResumeImprovedRewrite(
  candidateId: string,
  previous: ResumeScoreSnapshot | null,
  current: ResumeScoreSnapshot
): Promise<void> {
  const presentationBefore = averageOf(previous?.atsScore, previous?.resultsScore)
  const presentationAfter = averageOf(current.atsScore, current.resultsScore)
  if (presentationAfter !== null && isMeaningfulGain(presentationBefore, presentationAfter)) {
    const baseline = await currentBaseline(candidateId, 'communication')
    await updateCategoryBaseline(candidateId, 'communication', clamp(baseline + RESUME_IMPROVEMENT_BUMP))
  }

  if (current.experienceScore !== null && isMeaningfulGain(previous?.experienceScore ?? null, current.experienceScore)) {
    const baseline = await currentBaseline(candidateId, 'targetFit')
    await updateCategoryBaseline(candidateId, 'targetFit', clamp(baseline + RESUME_IMPROVEMENT_BUMP))
  }
}

function averageOf(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null) return null
  return (a + b) / 2
}

function isMeaningfulGain(before: number | null, after: number): boolean {
  if (before === null) return after >= 60 // first real score, decent on its own
  return after - before >= MEANINGFUL_RESUME_IMPROVEMENT
}

const DIRECTIVE_RESOLVED_BUMP = 10

// A coach directly observing that a directive was followed through on is
// the strongest available evidence for a category — a real human watched
// it happen over time, stronger than a reference's point-in-time read.
export async function applyDirectiveResolvedRewrite(candidateId: string, category: CategoryKey): Promise<void> {
  const current = await currentBaseline(candidateId, category)
  await updateCategoryBaseline(candidateId, category, clamp(current + DIRECTIVE_RESOLVED_BUMP))
}
