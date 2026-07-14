'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { recalculateScore } from '@/lib/scoring/recalculate'
import { syncReferenceDelta, BARS_FIELD_BY_DIMENSION } from '@/lib/scoring/reference-delta'
import { REFERENCE_TOKEN_EXPIRY_DAYS } from '@/lib/constants/references'
import { ASSESSMENT_DIMENSIONS } from '@/lib/constants/onboarding'

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
      return { error: 'Please answer every work-style question.' }
    }
    const num = Number(raw)
    if (!Number.isInteger(num) || num < 1 || num > 5) {
      return { error: 'Invalid response received.' }
    }
    barsValues[BARS_FIELD_BY_DIMENSION[dim.key]] = num
  }

  await prisma.reference.update({
    where: { token },
    data: {
      overallRating: Number(overallRating),
      wouldHireAgain: wouldHireAgain === 'yes',
      strengthSummary,
      growthAreaSummary: growthAreaSummary || null,
      contextNotes: (formData.get('contextNotes') as string | null) || null,
      ...barsValues,
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

  redirect(`/ref/${token}/complete`)
}
