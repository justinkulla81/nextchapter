import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Reference } from '@prisma/client'
import { ASSESSMENT_DIMENSIONS } from '@/lib/constants/onboarding'
import { BARS_FIELD_BY_DIMENSION } from '@/lib/scoring/reference-delta'
import { DIMENSION_FIELDS as PERFORMANCE_DIMENSION_FIELDS } from '@/lib/references/aggregate-performance'
import { TRAIT_FIELDS } from '@/lib/references/parse-reference-form'

// Coaching Notes' "full breakdown" — every completed reference's answers,
// pooled by category/section rather than grouped by reviewer, so a coach
// can read everything a candidate's references said without any answer
// being traceable back to a specific person (see the candidate's own
// standing privacy expectation when they invite a reference — never told
// who said what, just that references were asked).

export interface RatingSummary {
  label: string
  mean: number | null // null when nobody answered
  n: number
}

export interface CategoricalSummary {
  label: string
  counts: { optionLabel: string; count: number }[]
  answeredCount: number
}

export interface TraitBreakdown {
  label: string
  mean: number | null
  n: number
  examples: string[]
}

export interface WrittenQuestionBreakdown {
  question: string
  answers: string[]
}

export interface VerificationBreakdown {
  label: string
  confirmedCount: number
  flaggedCount: number
  corrections: string[]
}

export interface ReferenceBreakdown {
  completedCount: number
  performance: RatingSummary[]
  overallRating: RatingSummary
  workingStyle: RatingSummary[]
  comparative: CategoricalSummary[]
  strengths: string[]
  growthAreas: string[]
  traits: TraitBreakdown[]
  writtenResponses: WrittenQuestionBreakdown[]
  otherStories: { label: string; texts: string[] }[]
  verification: VerificationBreakdown[]
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
}

function nonEmpty(texts: (string | null)[]): string[] {
  return texts.filter((t): t is string => !!t && t.trim().length > 0)
}

const COMP_RELATIVE_RANK_LABELS: Record<string, string> = {
  BOTTOM_HALF: 'Bottom half',
  TOP_HALF: 'Top half',
  TOP_25: 'Top 25%',
  TOP_10: 'Top 10%',
  TOP_1: 'Top 1%',
}

const COMP_WOULD_HIRE_AGAIN_LABELS: Record<string, string> = {
  NO: 'No',
  PROBABLY_NOT: 'Probably not',
  PROBABLY: 'Probably',
  DEFINITELY: 'Definitely',
}

const COMP_WOULD_TAKE_AGAIN_LABELS: Record<string, string> = {
  NO: 'No',
  MAYBE: 'Maybe, depending on the need',
  YES: 'Yes',
  YES_FIRST_CALL: 'Yes, first call',
}

const COMP_TRUSTED_SCOPE_LABELS: Record<string, string> = {
  SAME: 'Same scope they had',
  SOMEWHAT_MORE: 'Somewhat more',
  MEANINGFULLY_MORE: 'Meaningfully more',
  STEP_CHANGE: 'A step change beyond anything they’ve done',
}

function buildCategoricalSummary(
  label: string,
  values: (string | null)[],
  labelMap: Record<string, string>
): CategoricalSummary {
  const answered = values.filter((v): v is string => v !== null)
  const counts = new Map<string, number>()
  for (const v of answered) counts.set(v, (counts.get(v) ?? 0) + 1)
  return {
    label,
    answeredCount: answered.length,
    counts: Object.keys(labelMap).map((key) => ({
      optionLabel: labelMap[key],
      count: counts.get(key) ?? 0,
    })),
  }
}

const VERIFICATION_FIELDS: { label: string; correctField: keyof Reference; correctionField: keyof Reference }[] = [
  { label: 'Job title', correctField: 'verifiedTitleCorrect', correctionField: 'correctedTitle' },
  { label: 'Company', correctField: 'verifiedCompanyCorrect', correctionField: 'correctedCompany' },
  { label: 'Resume achievement', correctField: 'verifiedBulletCorrect', correctionField: 'correctedBullet' },
  { label: 'Dates worked together', correctField: 'verifiedDatesCorrect', correctionField: 'correctedDates' },
  { label: 'Reporting relationship', correctField: 'verifiedReportingCorrect', correctionField: 'correctedReporting' },
  { label: 'Scope (team size, budget, etc.)', correctField: 'verifiedScopeCorrect', correctionField: 'correctedScope' },
]

export async function getAnonymizedReferenceBreakdown(candidateId: string): Promise<ReferenceBreakdown | null> {
  const completedReferences = await prisma.reference.findMany({
    where: { candidateId, status: 'COMPLETED' },
  })

  if (completedReferences.length === 0) return null

  const performance: RatingSummary[] = Object.entries(PERFORMANCE_DIMENSION_FIELDS).map(([dimension, fields]) => {
    const scores = completedReferences.flatMap((ref) =>
      fields.map((f) => ref[f]).filter((v): v is number => typeof v === 'number')
    )
    return { label: dimension, mean: mean(scores), n: scores.length }
  })

  const overallScores = completedReferences
    .map((r) => r.overallRating)
    .filter((v): v is number => typeof v === 'number')
  const overallRating: RatingSummary = { label: 'Overall rating', mean: mean(overallScores), n: overallScores.length }

  const workingStyle: RatingSummary[] = ASSESSMENT_DIMENSIONS.map((dim) => {
    const field = BARS_FIELD_BY_DIMENSION[dim.key] as keyof Reference
    const scores = completedReferences.map((r) => r[field]).filter((v): v is number => typeof v === 'number')
    return { label: dim.label, mean: mean(scores), n: scores.length }
  })

  const comparative: CategoricalSummary[] = [
    buildCategoricalSummary(
      'Where they rank versus peers',
      completedReferences.map((r) => r.compRelativeRank),
      COMP_RELATIVE_RANK_LABELS
    ),
    buildCategoricalSummary(
      'Would hire again',
      completedReferences.map((r) => r.compWouldHireAgain),
      COMP_WOULD_HIRE_AGAIN_LABELS
    ),
    buildCategoricalSummary(
      'Would take them on a new team tomorrow',
      completedReferences.map((r) => r.compWouldTakeAgain),
      COMP_WOULD_TAKE_AGAIN_LABELS
    ),
    buildCategoricalSummary(
      'Scope they’d trust them with today',
      completedReferences.map((r) => r.compTrustedScope),
      COMP_TRUSTED_SCOPE_LABELS
    ),
  ]

  const strengths = nonEmpty(completedReferences.map((r) => r.strengthSummary))
  const growthAreas = nonEmpty(completedReferences.map((r) => r.growthAreaSummary))

  const traits: TraitBreakdown[] = Object.entries(TRAIT_FIELDS).map(([, fields]) => {
    const ratingField = fields.rating as keyof Reference
    const exampleField = fields.example as keyof Reference
    const scores = completedReferences.map((r) => r[ratingField]).filter((v): v is number => typeof v === 'number')
    const examples = nonEmpty(completedReferences.map((r) => r[exampleField] as string | null))
    return {
      label: TRAIT_LABELS[fields.rating] ?? fields.rating,
      mean: mean(scores),
      n: scores.length,
      examples,
    }
  })

  const writtenByQuestion = new Map<string, string[]>()
  for (const r of completedReferences) {
    if (r.writtenQuestion1Text && r.writtenResponse1Text) {
      writtenByQuestion.set(r.writtenQuestion1Text, [
        ...(writtenByQuestion.get(r.writtenQuestion1Text) ?? []),
        r.writtenResponse1Text,
      ])
    }
    if (r.writtenQuestion2Text && r.writtenResponse2Text) {
      writtenByQuestion.set(r.writtenQuestion2Text, [
        ...(writtenByQuestion.get(r.writtenQuestion2Text) ?? []),
        r.writtenResponse2Text,
      ])
    }
  }
  const writtenResponses: WrittenQuestionBreakdown[] = Array.from(writtenByQuestion.entries()).map(
    ([question, answers]) => ({ question, answers })
  )

  const otherStories = [
    { label: 'What’s their superpower', texts: nonEmpty(completedReferences.map((r) => r.superpowerText)) },
    { label: 'Under real pressure', texts: nonEmpty(completedReferences.map((r) => r.underPressureStory)) },
    { label: 'A defining story', texts: nonEmpty(completedReferences.map((r) => r.definingStory)) },
    {
      label: 'Why (or why not) they’d work with them again',
      texts: nonEmpty(completedReferences.map((r) => r.wouldWorkWithAgainReason)),
    },
    { label: 'Other context', texts: nonEmpty(completedReferences.map((r) => r.contextNotes)) },
  ].filter((s) => s.texts.length > 0)

  const verification: VerificationBreakdown[] = VERIFICATION_FIELDS.map(({ label, correctField, correctionField }) => {
    const answered = completedReferences.filter((r) => r[correctField] !== null)
    return {
      label,
      confirmedCount: answered.filter((r) => r[correctField] === true).length,
      flaggedCount: answered.filter((r) => r[correctField] === false).length,
      corrections: nonEmpty(answered.map((r) => r[correctionField] as string | null)),
    }
  }).filter((v) => v.confirmedCount > 0 || v.flaggedCount > 0)

  return {
    completedCount: completedReferences.length,
    performance,
    overallRating,
    workingStyle,
    comparative,
    strengths,
    growthAreas,
    traits,
    writtenResponses,
    otherStories,
    verification,
  }
}

// Human-readable labels for TRAIT_FIELDS' rating column names — kept local
// since TRAIT_FIELDS itself is keyed for form field names, not display.
const TRAIT_LABELS: Record<string, string> = {
  traitAdaptabilityRating: 'Adaptability',
  traitFollowThroughRating: 'Follow-through',
  traitPresenceRating: 'Presence',
  traitCollaborationRating: 'Collaboration',
  traitComposureRating: 'Composure',
}
