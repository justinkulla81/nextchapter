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
