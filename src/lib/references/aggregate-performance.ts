import 'server-only'
import type { Reference } from '@prisma/client'
import { meanToAnchorLabel } from './anchored-scale'
import { referenceCountToTier } from './reference-count-tier'
import { CONFIDENCE_LABEL, type ConfidenceLevel } from '@/lib/scoring/grade'

// Reference Check Part A aggregation (spec §5.8) — never a numeric mean
// shown to the candidate, only the anchor label the mean rounds to, with n
// alongside. "Didn't see this" (null) is excluded from both the mean and n
// entirely, not coerced to a score.
export const DIMENSION_FIELDS = {
  Execution: ['perfExecutionDelivered', 'perfExecutionQuality', 'perfExecutionAutonomy'],
  Judgment: ['perfJudgmentDecisionQuality', 'perfJudgmentEscalation', 'perfJudgmentSituationalRead'],
  Composure: ['perfComposureSteadiness', 'perfComposureFeedbackResponse', 'perfComposureEffectOnOthers'],
  Influence: ['perfInfluenceOutcomes', 'perfInfluenceCredibility', 'perfInfluenceDirectness'],
} as const satisfies Record<string, (keyof Reference)[]>

export interface DimensionSummary {
  dimension: string
  label: string | null // e.g. "Notably strong" — null if nobody has answered yet
  n: number
}

export interface PerformanceAggregate {
  dimensions: DimensionSummary[]
  completedReferenceCount: number
  confidenceTier: ConfidenceLevel
  confidenceLabel: string
}

export function aggregatePerformance(
  completedReferences: Pick<Reference, (typeof DIMENSION_FIELDS)[keyof typeof DIMENSION_FIELDS][number]>[]
): PerformanceAggregate {
  const dimensions: DimensionSummary[] = Object.entries(DIMENSION_FIELDS).map(([dimension, fields]) => {
    const scores = completedReferences.flatMap((ref) =>
      fields.map((f) => ref[f]).filter((v): v is number => typeof v === 'number')
    )
    if (scores.length === 0) return { dimension, label: null, n: 0 }
    const mean = scores.reduce((sum, v) => sum + v, 0) / scores.length
    return { dimension, label: meanToAnchorLabel(mean), n: scores.length }
  })

  const completedReferenceCount = completedReferences.length
  const confidenceTier = referenceCountToTier(completedReferenceCount)

  return {
    dimensions,
    completedReferenceCount,
    confidenceTier,
    confidenceLabel: CONFIDENCE_LABEL[confidenceTier],
  }
}
