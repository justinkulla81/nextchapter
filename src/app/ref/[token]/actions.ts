'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { recalculateScore } from '@/lib/scoring/recalculate'
import { syncReferenceDelta, BARS_FIELD_BY_DIMENSION } from '@/lib/scoring/reference-delta'
import { REFERENCE_TOKEN_EXPIRY_DAYS } from '@/lib/constants/references'
import { ASSESSMENT_DIMENSIONS } from '@/lib/constants/onboarding'
import { generateReferenceQuotes } from '@/lib/references/testimony-processing'

// The five reference-only traits (Prompt 48) — see prisma/schema.prisma's
// Reference model comment for why these aren't mirrored from Working
// Style. Keys match the form's `trait-${key}` / `traitExample-${key}` field
// names; values match the Reference model's typed columns.
const TRAIT_FIELDS = {
  adaptability: { rating: 'traitAdaptabilityRating', example: 'traitAdaptabilityExample' },
  followThrough: { rating: 'traitFollowThroughRating', example: 'traitFollowThroughExample' },
  presence: { rating: 'traitPresenceRating', example: 'traitPresenceExample' },
  collaboration: { rating: 'traitCollaborationRating', example: 'traitCollaborationExample' },
  composure: { rating: 'traitComposureRating', example: 'traitComposureExample' },
} as const

export type FormState = { error?: string } | undefined

export async function submitReference(_prevState: FormState, formData: FormData): Promise<FormState> {
  const token = formData.get('token') as string | null
  if (!token) {
    return { error: 'Missing reference token.' }
  }

  const reference = await prisma.reference.findUnique({ where: { token } })

  if (!reference) {
    return { error: 'This reference link is not valid.' }
  }

  if (reference.status === 'COMPLETED') {
    return { error: 'This reference has already been submitted.' }
  }

  const expiresAt = new Date(reference.requestedAt)
  expiresAt.setDate(expiresAt.getDate() + REFERENCE_TOKEN_EXPIRY_DAYS)
  if (new Date() > expiresAt) {
    await prisma.reference.update({ where: { token }, data: { status: 'EXPIRED' } })
    return { error: 'This reference link has expired.' }
  }

  const overallRating = formData.get('overallRating')
  const wouldHireAgain = formData.get('wouldHireAgain')
  const strengthSummary = (formData.get('strengthSummary') as string | null)?.trim()
  const growthAreaSummary = (formData.get('growthAreaSummary') as string | null)?.trim()

  if (!overallRating || !wouldHireAgain || !strengthSummary) {
    return { error: 'Please complete the overall rating, hire-again question, and strengths.' }
  }

  const barsValues: Record<string, number> = {}
  for (const dim of ASSESSMENT_DIMENSIONS) {
    const raw = formData.get(`barsScore-${dim.key}`)
    if (raw === null) {
      return { error: 'Please answer every How They Work Best question.' }
    }
    const num = Number(raw)
    if (!Number.isInteger(num) || num < 1 || num > 5) {
      return { error: 'Invalid response received.' }
    }
    barsValues[BARS_FIELD_BY_DIMENSION[dim.key]] = num
  }

  const traitValues: Record<string, number | string | null> = {}
  for (const [key, fields] of Object.entries(TRAIT_FIELDS)) {
    const raw = formData.get(`trait-${key}`)
    if (raw === null) {
      return { error: 'Please rate every trait.' }
    }
    const num = Number(raw)
    if (!Number.isInteger(num) || num < 1 || num > 5) {
      return { error: 'Invalid response received.' }
    }
    traitValues[fields.rating] = num
    traitValues[fields.example] = (formData.get(`traitExample-${key}`) as string | null)?.trim() || null
  }

  const quotableWithAttribution = formData.get('quotableWithAttribution')
  if (!quotableWithAttribution) {
    return { error: 'Please let us know whether we can quote you by name.' }
  }

  const updatedReference = await prisma.reference.update({
    where: { token },
    data: {
      overallRating: Number(overallRating),
      wouldHireAgain: wouldHireAgain === 'yes',
      strengthSummary,
      growthAreaSummary: growthAreaSummary || null,
      contextNotes: (formData.get('contextNotes') as string | null) || null,
      ...barsValues,
      ...traitValues,
      superpowerText: (formData.get('superpowerText') as string | null)?.trim() || null,
      underPressureStory: (formData.get('underPressureStory') as string | null)?.trim() || null,
      definingStory: (formData.get('definingStory') as string | null)?.trim() || null,
      wouldWorkWithAgainReason: (formData.get('wouldWorkWithAgainReason') as string | null)?.trim() || null,
      quotableWithAttribution: quotableWithAttribution === 'yes',
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  })

  await recalculateScore(reference.candidateId, 'reference_completed')

  // Must never block the referee's submission from succeeding.
  try {
    await syncReferenceDelta(reference.candidateId)
  } catch (error) {
    console.error('Failed to sync reference delta after reference completion:', error)
  }

  try {
    await generateReferenceQuotes(updatedReference)
  } catch (error) {
    console.error('Failed to generate reference quotes after reference completion:', error)
  }

  redirect(`/ref/${token}/complete`)
}
