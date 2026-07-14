// Generates the hiring-manager-facing summary of a candidate's Friction
// Delta Profile — the disagreement between a candidate's self-reported
// work-style assessment and how their references described their actual
// on-the-job behavior (see src/lib/scoring/reference-delta.ts).
//
// Per the "never expose raw psychometric scores to employers" product rule
// (see assessment-vectors.ts), this only ever surfaces plain-English BARS
// behavioral anchor text and dimension labels — never dimensionVectors
// numbers, inconsistencyScore deltas, or internal jargon.
//
// HARD RULE: the candidate's Hireability/Employability Score is for the
// candidate only, full stop — it must never appear anywhere in this report
// (or any other employer-facing surface). Employers see work ethic,
// motivation signals, references, work samples, and this self-vs-reference
// consistency data — never the Score itself, nor goals/motivations/comp
// expectations. Do not add an employabilityScore field back to this report.

import { prisma } from '@/lib/prisma'
import { ASSESSMENT_DIMENSIONS, type AssessmentDimension } from '@/lib/constants/onboarding'
import type { DimensionVectors } from '@/lib/scoring/assessment-vectors'

export interface FrictionExample {
  dimension: AssessmentDimension
  dimensionLabel: string
  candidateDescription: string
  referenceDescription: string
}

export interface ProfileConsistencyAlert {
  label: 'Profile Consistency Alert'
  message: string
}

export interface RedFlagsSection {
  label: 'Red Flags'
  summary: string[]
  interviewAuditFocusAreas: string[]
}

export interface HiringManagerReport {
  candidateId: string
  candidateName: string
  profileConsistencyAlert: ProfileConsistencyAlert | null
  redFlags: RedFlagsSection
  frictionExamples: FrictionExample[]
  selfAwarenessScore: number | null
  selfAwarenessLabel: 'High' | 'Moderate' | 'Low' | null
}

// Same calibration anchor as inconsistencyScore's realistic max delta between
// a candidate's self-report and the reference-aggregated vector on a given
// dimension. Distills the (already employer-only) per-dimension deltas
// computed by calculateReferenceDelta into one 0-100 self-awareness score —
// never shown to the candidate.
const SELF_AWARENESS_DELTA_CEILING = 2.0

function computeSelfAwarenessScore(deltas: Record<string, number> | null): number | null {
  if (!deltas || Object.keys(deltas).length === 0) return null
  const avg = Object.values(deltas).reduce((s, d) => s + d, 0) / Object.values(deltas).length
  return Math.round(100 * (1 - Math.min(avg / SELF_AWARENESS_DELTA_CEILING, 1)))
}

function selfAwarenessLabel(score: number | null): 'High' | 'Moderate' | 'Low' | null {
  if (score === null) return null
  if (score >= 75) return 'High'
  if (score >= 50) return 'Moderate'
  return 'Low'
}

// Maps a normalized vector value back to its nearest BARS scale point (1-5)
// so both the candidate's self-report and the reference aggregate can be
// shown as the same kind of concrete behavioral statement. Candidate
// vectors aren't bounded to -1..+1 like reference vectors are (see
// assessment-vectors.ts caveat), so out-of-range values clamp to the
// nearest end of the scale rather than distorting the mapping.
function nearestAnchorText(
  value: number,
  dimension: string,
  anchorsByDimension: Map<string, Map<number, string>>
): string | null {
  const clamped = Math.max(-1, Math.min(1, value))
  const scalePoint = Math.max(1, Math.min(5, Math.round(clamped * 2 + 3)))
  return anchorsByDimension.get(dimension)?.get(scalePoint) ?? null
}

export async function generateHiringManagerReport(candidateId: string): Promise<HiringManagerReport> {
  const [candidate, latestResponse, barsAnchors] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } }),
    prisma.candidateAssessmentResponse.findFirst({
      where: { candidateId },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.bARSAnchor.findMany({ where: { isActive: true } }),
  ])

  const anchorsByDimension = new Map<string, Map<number, string>>()
  for (const anchor of barsAnchors) {
    if (!anchorsByDimension.has(anchor.dimension)) {
      anchorsByDimension.set(anchor.dimension, new Map())
    }
    anchorsByDimension.get(anchor.dimension)!.set(anchor.scalePoint, anchor.anchorText)
  }

  let profileConsistencyAlert: ProfileConsistencyAlert | null = null
  const redFlagsSummary: string[] = []
  let interviewAuditFocusAreas: string[] = []
  let frictionExamples: FrictionExample[] = []

  const referenceDeltaForScore = latestResponse?.referenceDelta as unknown as {
    deltas: Record<string, number>
  } | null
  const selfAwarenessScoreValue = computeSelfAwarenessScore(referenceDeltaForScore?.deltas ?? null)

  if (latestResponse) {
    if (latestResponse.manipulationRiskFlag) {
      profileConsistencyAlert = {
        label: 'Profile Consistency Alert',
        message:
          "This candidate's assessment answers showed meaningful internal contradictions — their quad-block choices and follow-up ratings didn't consistently agree. Treat the self-reported work-style profile as a starting point to probe in interview, not a settled fact.",
      }
    }

    const frictionSurfaces = latestResponse.frictionSurfaces ?? []
    if (frictionSurfaces.length > 0) {
      interviewAuditFocusAreas = frictionSurfaces.map(
        (dim) => ASSESSMENT_DIMENSIONS.find((d) => d.key === dim)?.label ?? dim
      )
      redFlagsSummary.push(
        `References described this candidate's actual day-to-day behavior differently than the candidate described themselves, in ${frictionSurfaces.length} area${frictionSurfaces.length > 1 ? 's' : ''}. See Interview Audit Focus Areas below.`
      )

      const candidateVectors = latestResponse.dimensionVectors as unknown as DimensionVectors
      const referenceDelta = latestResponse.referenceDelta as unknown as {
        aggregatedRefVectors: Record<string, number>
      } | null

      if (referenceDelta) {
        frictionExamples = frictionSurfaces.map((dim) => {
          const dimMeta = ASSESSMENT_DIMENSIONS.find((d) => d.key === dim)
          const candidateDescription = nearestAnchorText(
            candidateVectors[dim as AssessmentDimension],
            dim,
            anchorsByDimension
          )
          const referenceDescription = nearestAnchorText(
            referenceDelta.aggregatedRefVectors[dim] ?? 0,
            dim,
            anchorsByDimension
          )
          return {
            dimension: dim as AssessmentDimension,
            dimensionLabel: dimMeta?.label ?? dim,
            candidateDescription: candidateDescription ?? 'No self-reported behavioral anchor available.',
            referenceDescription: referenceDescription ?? 'No reference behavioral anchor available.',
          }
        })
      }
    }
  }

  if (redFlagsSummary.length === 0) {
    redFlagsSummary.push('No red flags identified from available signals.')
  }

  return {
    candidateId,
    candidateName: candidate.displayName || 'This candidate',
    profileConsistencyAlert,
    redFlags: {
      label: 'Red Flags',
      summary: redFlagsSummary,
      interviewAuditFocusAreas,
    },
    frictionExamples,
    selfAwarenessScore: selfAwarenessScoreValue,
    selfAwarenessLabel: selfAwarenessLabel(selfAwarenessScoreValue),
  }
}
