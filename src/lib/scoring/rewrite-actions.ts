// Real events that should move a category's baseline directly, because
// they make the candidate objectively more market-ready — not just
// generate weekly effort points. See the Scoring Model 2.0 design doc §7.
//
// These call updateCategoryBaseline (hireability-grade.ts) rather than
// waiting for the bounded weekly nudge, since a landed interview or a
// closed skills gap is a real, discrete change in standing, not a
// gradual behavioral trend.

import 'server-only'
import type { Reference } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { updateCategoryBaseline } from '@/lib/scoring/hireability-grade'
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

// A completed reference is the strongest available third-party evidence
// for the five competency categories — each maps to one reference field
// (see hireability-grade.ts's averageReferenceRating comment for why these
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
}[] = [
  { category: 'leadership', field: 'traitPresenceRating' },
  { category: 'skillsExecution', field: 'overallRating' },
  { category: 'communication', field: 'traitCollaborationRating' },
  { category: 'adaptability', field: 'traitAdaptabilityRating' },
  { category: 'ownership', field: 'traitFollowThroughRating' },
]

const WEAK_BASELINE_THRESHOLD = 70
const STRONG_RATING_THRESHOLD = 4
const MAX_REFERENCE_BUMP = 12

export async function applyReferenceCompletedRewrite(candidateId: string, reference: Reference): Promise<void> {
  for (const { category, field } of REFERENCE_CATEGORY_FIELDS) {
    const rating = reference[field]
    if (rating === null || rating === undefined) continue

    const impliedScore = clamp(((rating - 1) / 4) * 100)
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
