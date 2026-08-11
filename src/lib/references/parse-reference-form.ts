import { ASSESSMENT_DIMENSIONS } from '@/lib/constants/onboarding'
import { BARS_FIELD_BY_DIMENSION } from '@/lib/scoring/reference-delta'

// The five reference-only traits (Prompt 48) — see prisma/schema.prisma's
// Reference model comment for why these aren't mirrored from Working
// Style. Keys match the form's `trait-${key}` / `traitExample-${key}` field
// names; values match Reference's (and EmployerReferenceSubmission's,
// which duplicates the same columns) typed field names.
export const TRAIT_FIELDS = {
  adaptability: { rating: 'traitAdaptabilityRating', example: 'traitAdaptabilityExample' },
  followThrough: { rating: 'traitFollowThroughRating', example: 'traitFollowThroughExample' },
  presence: { rating: 'traitPresenceRating', example: 'traitPresenceExample' },
  collaboration: { rating: 'traitCollaborationRating', example: 'traitCollaborationExample' },
  composure: { rating: 'traitComposureRating', example: 'traitComposureExample' },
} as const

export interface ParsedReferenceContent {
  overallRating: number
  wouldHireAgain: boolean
  strengthSummary: string
  growthAreaSummary: string | null
  contextNotes: string | null
  bars: Record<string, number>
  traits: Record<string, number | string | null>
  superpowerText: string | null
  underPressureStory: string | null
  definingStory: string | null
  wouldWorkWithAgainReason: string | null
  quotableWithAttribution: boolean
}

// Shared parsing/validation for the Prompt 48 mirrored-trait reference
// instrument — used by both the existing token-based referee flow
// (submitReference) and the Prompt 65 employer-submitted flow
// (submitEmployerReference), so the two never drift on what counts as a
// complete, valid submission.
export function parseReferenceFormData(formData: FormData): { data: ParsedReferenceContent } | { error: string } {
  const overallRating = formData.get('overallRating')
  const wouldHireAgain = formData.get('wouldHireAgain')
  const strengthSummary = (formData.get('strengthSummary') as string | null)?.trim()
  const growthAreaSummary = (formData.get('growthAreaSummary') as string | null)?.trim()

  if (!overallRating || !wouldHireAgain || !strengthSummary) {
    return { error: 'Please complete the overall rating, hire-again question, and strengths.' }
  }

  const bars: Record<string, number> = {}
  for (const dim of ASSESSMENT_DIMENSIONS) {
    const raw = formData.get(`barsScore-${dim.key}`)
    if (raw === null) {
      return { error: 'Please answer every How They Work Best question.' }
    }
    const num = Number(raw)
    if (!Number.isInteger(num) || num < 1 || num > 5) {
      return { error: 'Invalid response received.' }
    }
    bars[BARS_FIELD_BY_DIMENSION[dim.key]] = num
  }

  const traits: Record<string, number | string | null> = {}
  for (const [key, fields] of Object.entries(TRAIT_FIELDS)) {
    const raw = formData.get(`trait-${key}`)
    if (raw === null) {
      return { error: 'Please rate every trait.' }
    }
    const num = Number(raw)
    if (!Number.isInteger(num) || num < 1 || num > 5) {
      return { error: 'Invalid response received.' }
    }
    traits[fields.rating] = num
    traits[fields.example] = (formData.get(`traitExample-${key}`) as string | null)?.trim() || null
  }

  const quotableWithAttribution = formData.get('quotableWithAttribution')
  if (!quotableWithAttribution) {
    return { error: 'Please let us know whether we can quote you by name.' }
  }

  return {
    data: {
      overallRating: Number(overallRating),
      wouldHireAgain: wouldHireAgain === 'yes',
      strengthSummary,
      growthAreaSummary: growthAreaSummary || null,
      contextNotes: (formData.get('contextNotes') as string | null)?.trim() || null,
      bars,
      traits,
      superpowerText: (formData.get('superpowerText') as string | null)?.trim() || null,
      underPressureStory: (formData.get('underPressureStory') as string | null)?.trim() || null,
      definingStory: (formData.get('definingStory') as string | null)?.trim() || null,
      wouldWorkWithAgainReason: (formData.get('wouldWorkWithAgainReason') as string | null)?.trim() || null,
      quotableWithAttribution: quotableWithAttribution === 'yes',
    },
  }
}

// Part A performance items — field name -> Prisma column. "Didn't see
// this" submits an empty string (rendered as its own radio option, see
// ReferencePerformanceScale), which must parse to null and be excluded
// from any aggregation, never coerced to 0 or skipped as "unanswered."
export const PERFORMANCE_ITEM_FIELDS = {
  a1: 'perfExecutionDelivered',
  a2: 'perfExecutionQuality',
  a3: 'perfExecutionAutonomy',
  a4: 'perfJudgmentDecisionQuality',
  a5: 'perfJudgmentEscalation',
  a6: 'perfJudgmentSituationalRead',
  a7: 'perfComposureSteadiness',
  a8: 'perfComposureFeedbackResponse',
  a9: 'perfComposureEffectOnOthers',
  a10: 'perfInfluenceOutcomes',
  a11: 'perfInfluenceCredibility',
  a12: 'perfInfluenceDirectness',
} as const

export interface ParsedReferenceCheckExtension {
  performance: Record<string, number | null>
  compRelativeRank: string | null
  compWouldHireAgain: string | null
  compDepartureContext: string | null
  compWouldTakeAgain: string | null
  compTrustedScope: string | null
  writtenResponse1: string | null
  writtenResponse2: string | null
  verifiedTitleCorrect: boolean | null
  correctedTitle: string | null
  verifiedDatesCorrect: boolean | null
  correctedDates: string | null
  verifiedReportingCorrect: boolean | null
  correctedReporting: string | null
  verifiedScopeCorrect: boolean | null
  correctedScope: string | null
  verificationConfidence: number | null
}

function parseYesNo(raw: FormDataEntryValue | null): boolean | null {
  if (raw === 'yes') return true
  if (raw === 'no') return false
  return null
}

// Assessment Layer Reference Check Parts A-D — kept as a separate parser
// (rather than folded into parseReferenceFormData above) so the original
// Prompt 48 instrument's required-field contract doesn't change: every
// field here is optional at the parse layer, since Part A explicitly
// allows "Didn't see this," Part B/D questions are audience-gated
// (manager-only items don't render for a peer), and this extension can
// roll out to the submission form incrementally without breaking existing
// in-flight reference links.
export function parseReferenceCheckExtension(formData: FormData): ParsedReferenceCheckExtension {
  const performance: Record<string, number | null> = {}
  for (const [itemKey, field] of Object.entries(PERFORMANCE_ITEM_FIELDS)) {
    const raw = formData.get(`perf-${itemKey}`)
    performance[field] = raw && raw !== '' ? Number(raw) : null
  }

  const verificationConfidenceRaw = formData.get('verificationConfidence')

  return {
    performance,
    compRelativeRank: (formData.get('compRelativeRank') as string | null) || null,
    compWouldHireAgain: (formData.get('compWouldHireAgain') as string | null) || null,
    compDepartureContext: (formData.get('compDepartureContext') as string | null) || null,
    compWouldTakeAgain: (formData.get('compWouldTakeAgain') as string | null) || null,
    compTrustedScope: (formData.get('compTrustedScope') as string | null) || null,
    writtenResponse1: (formData.get('writtenResponse1') as string | null)?.trim() || null,
    writtenResponse2: (formData.get('writtenResponse2') as string | null)?.trim() || null,
    verifiedTitleCorrect: parseYesNo(formData.get('verifiedTitleCorrect')),
    correctedTitle: (formData.get('correctedTitle') as string | null)?.trim() || null,
    verifiedDatesCorrect: parseYesNo(formData.get('verifiedDatesCorrect')),
    correctedDates: (formData.get('correctedDates') as string | null)?.trim() || null,
    verifiedReportingCorrect: parseYesNo(formData.get('verifiedReportingCorrect')),
    correctedReporting: (formData.get('correctedReporting') as string | null)?.trim() || null,
    verifiedScopeCorrect: parseYesNo(formData.get('verifiedScopeCorrect')),
    correctedScope: (formData.get('correctedScope') as string | null)?.trim() || null,
    verificationConfidence: verificationConfidenceRaw ? Number(verificationConfidenceRaw) : null,
  }
}
