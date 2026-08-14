// Evidence component — spec: "references and assessments." Report Structure
// Spec §3.6 frames third-party corroboration (references) as "the only
// thing that converts self-reported claims into verified ones" — that's why
// references carry most of the weight here; the work-style and skills
// assessments are still self-reported, so they count for less.

import 'server-only'
import { prisma } from '@/lib/prisma'
import type { ComponentComputation } from './types'

const BARS_FIELDS = [
  'ratingReliability',
  'ratingCommunication',
  'ratingConflictNav',
  'ratingTeamLift',
  'ratingWorkEthic',
  'ratingGrowthMindset',
  'ratingPositivity',
] as const

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export async function computeEvidenceComponent(candidateId: string): Promise<ComponentComputation> {
  const [completedReferences, workStyleResponse, workStyleAssessmentResult, candidate] = await Promise.all([
    prisma.reference.findMany({
      where: { candidateId, status: 'COMPLETED' },
      select: { overallRating: true, ...Object.fromEntries(BARS_FIELDS.map((f) => [f, true])) },
    }),
    prisma.candidateAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
    prisma.assessmentResult.findFirst({ where: { candidateId, assessmentType: 'work_style' }, select: { id: true } }),
    prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId }, select: { skillsAssessmentCompletedAt: true } }),
  ])

  // Completion: 3+ completed references is full credit — a saturating curve
  // so a 4th or 5th reference doesn't keep moving the number (diminishing
  // marginal evidentiary value, and it matches the report's own 5-reference
  // unlock, which already treats 3-5 as "plenty").
  const referenceCount = completedReferences.length
  const completionScore = Math.min(100, referenceCount * 33)

  // Quality: average of overallRating + the 7 BARS dimensions across all
  // completed references, normalized 1-5 -> 0-100.
  let qualityScore = 0
  if (referenceCount > 0) {
    const allRatings: number[] = []
    for (const ref of completedReferences) {
      const values = [ref.overallRating, ...BARS_FIELDS.map((f) => ref[f as keyof typeof ref])].filter(
        (v): v is number => typeof v === 'number'
      )
      allRatings.push(...values)
    }
    const avg = allRatings.length > 0 ? allRatings.reduce((s, v) => s + v, 0) / allRatings.length : 3
    qualityScore = clamp(((avg - 1) / 4) * 100)
  }

  const referencesScore = referenceCount === 0 ? 0 : clamp(0.6 * completionScore + 0.4 * qualityScore)

  const workStyleDone = Boolean(workStyleResponse || workStyleAssessmentResult)
  const skillsDone = Boolean(candidate.skillsAssessmentCompletedAt)
  const assessmentsScore = (workStyleDone ? 50 : 0) + (skillsDone ? 50 : 0)

  const score = clamp(0.7 * referencesScore + 0.3 * assessmentsScore)

  const drivers: string[] = []
  if (referenceCount === 0) {
    drivers.push('No completed references yet — everything in the file is currently self-reported.')
  } else {
    const avgDisplay = (qualityScore / 100) * 4 + 1
    drivers.push(
      `${referenceCount} completed reference${referenceCount === 1 ? '' : 's'}, averaging ${avgDisplay.toFixed(1)}/5.`
    )
  }
  if (!workStyleDone && !skillsDone) {
    drivers.push('Neither the work style nor the skills assessment has been completed.')
  } else if (!workStyleDone || !skillsDone) {
    drivers.push(`${workStyleDone ? 'Skills' : 'Work style'} assessment not yet completed.`)
  }

  return { score, drivers }
}
