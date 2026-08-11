// Compares a candidate's self-reported work-style vector against how their
// references rated them on the same 8 dimensions (via BARS-anchored
// ratings collected on the reference submission form), surfacing dimensions
// where the two disagree meaningfully as "friction surfaces."
//
// Same first-pass-heuristic caveat as assessment-vectors.ts — not validated
// psychometrics.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ASSESSMENT_DIMENSIONS, type AssessmentDimension } from '@/lib/constants/onboarding'
import type { DimensionVectors } from './assessment-vectors'

const FRICTION_DELTA_THRESHOLD = 0.8

// Maps each work-style dimension to its BARS column on the Reference model.
export const BARS_FIELD_BY_DIMENSION: Record<AssessmentDimension, string> = {
  velocity: 'barsVelocity',
  architecture: 'barsArchitecture',
  structure: 'barsStructure',
  communication: 'barsCommunication',
  environment: 'barsEnvironment',
  leadership: 'barsLeadership',
  oversight: 'barsOversight',
  commitment: 'barsCommitment',
  conscientiousness: 'barsConscientiousness',
}

// Assessment Layer spec Part 2.1 merges Architecture+Structure -> Definition
// and Communication+Environment -> Collaboration on the SELF-report side
// (see how-i-work-best-items.ts), and renames Leadership -> Directness,
// Conscientiousness -> Rigor. The reference side still rates all 9 original
// BARS columns separately — no reference-form change, per the founder's
// decision to reconcile this by merging at read time instead. These are the
// new dimension keys a rotationGroup-3 candidate's dimensionVectors uses;
// `calculateReferenceDelta` below is dimension-key-agnostic (it only reads
// whatever keys are actually present in candidateVectors), so emitting both
// the legacy 9 keys AND these new ones into aggregatedRefVectors lets the
// same pure function serve rotationGroup-2 (old keys) and rotationGroup-3
// (new keys) candidates without knowing which rotation produced the response.
const NEW_DIMENSION_BARS_SOURCE: Record<string, string[]> = {
  directness: ['barsLeadership'],
  rigor: ['barsConscientiousness'],
  definition: ['barsArchitecture', 'barsStructure'],
  collaboration: ['barsCommunication', 'barsEnvironment'],
}

export interface ReferenceDeltaResult {
  deltas: Record<string, number>
  frictionSurfaces: string[]
  aggregatedRefVectors: Record<string, number>
}

/**
 * Pure function. `referenceBARS` is one entry per reference that completed
 * BARS-anchored ratings, each a Record<dimension, 1-5>.
 */
export function calculateReferenceDelta(
  candidateVectors: DimensionVectors,
  referenceBARS: Array<{ dimensionScores: Record<string, number> }>
): ReferenceDeltaResult {
  const aggregatedRefVectors: Record<string, number> = {}

  for (const ref of referenceBARS) {
    for (const [dimension, score] of Object.entries(ref.dimensionScores)) {
      aggregatedRefVectors[dimension] = (aggregatedRefVectors[dimension] ?? 0) + (score - 3) / 2
    }
  }
  for (const key of Object.keys(aggregatedRefVectors)) {
    aggregatedRefVectors[key] /= referenceBARS.length
  }

  const frictionSurfaces: string[] = []
  const deltas: Record<string, number> = {}

  for (const [dimension, candidateScore] of Object.entries(candidateVectors)) {
    const refScore = aggregatedRefVectors[dimension] ?? 0
    const delta = Math.abs(candidateScore - refScore)
    deltas[dimension] = delta
    if (delta > FRICTION_DELTA_THRESHOLD) {
      frictionSurfaces.push(dimension)
    }
  }

  return { deltas, frictionSurfaces, aggregatedRefVectors }
}

/**
 * DB-touching orchestrator — finds the candidate's latest assessment
 * response and all their completed, BARS-scored references, and if both
 * exist, computes and persists the delta. No-ops silently if either side
 * is missing (candidate hasn't finished onboarding, or no references with
 * BARS ratings yet) — this is expected, not an error.
 */
export async function syncReferenceDelta(candidateId: string) {
  const [latestResponse, referencesWithBARS] = await Promise.all([
    prisma.candidateAssessmentResponse.findFirst({
      where: { candidateId },
      orderBy: { completedAt: 'desc' },
    }),
    // barsVelocity is set alongside the other 7 BARS columns in the same
    // submitReference update — presence of one implies presence of all.
    prisma.reference.findMany({
      where: { candidateId, status: 'COMPLETED', barsVelocity: { not: null } },
    }),
  ])

  if (!latestResponse || referencesWithBARS.length === 0) return

  const candidateVectors = latestResponse.dimensionVectors as unknown as DimensionVectors
  const referenceBARS = referencesWithBARS.map((ref) => {
    const dimensionScores: Record<string, number> = {}
    for (const dim of ASSESSMENT_DIMENSIONS) {
      const field = BARS_FIELD_BY_DIMENSION[dim.key]
      const score = ref[field as keyof typeof ref] as number | null
      if (score !== null) dimensionScores[dim.key] = score
    }
    // Also emit the new (renamed/merged) dimension keys, averaging when a
    // merge draws on 2 BARS columns — see NEW_DIMENSION_BARS_SOURCE above.
    for (const [newDim, fields] of Object.entries(NEW_DIMENSION_BARS_SOURCE)) {
      const scores = fields
        .map((field) => ref[field as keyof typeof ref] as number | null)
        .filter((s): s is number => s !== null)
      if (scores.length > 0) {
        dimensionScores[newDim] = scores.reduce((sum, s) => sum + s, 0) / scores.length
      }
    }
    return { dimensionScores }
  })

  const { deltas, frictionSurfaces, aggregatedRefVectors } = calculateReferenceDelta(
    candidateVectors,
    referenceBARS
  )

  await prisma.candidateAssessmentResponse.update({
    where: { id: latestResponse.id },
    data: {
      referenceDelta: { deltas, aggregatedRefVectors } as unknown as Prisma.InputJsonValue,
      frictionSurfaces,
    },
  })
}
