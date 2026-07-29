'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { syncReferenceDelta } from '@/lib/scoring/reference-delta'
import { REFERENCE_TOKEN_EXPIRY_DAYS } from '@/lib/constants/references'
import { generateReferenceQuotes } from '@/lib/references/testimony-processing'
import { applyReferenceCompletedRewrite } from '@/lib/scoring/rewrite-actions'
import { parseReferenceFormData } from '@/lib/references/parse-reference-form'

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

  const parsed = parseReferenceFormData(formData)
  if ('error' in parsed) {
    return { error: parsed.error }
  }
  const content = parsed.data

  const updatedReference = await prisma.reference.update({
    where: { token },
    data: {
      overallRating: content.overallRating,
      wouldHireAgain: content.wouldHireAgain,
      strengthSummary: content.strengthSummary,
      growthAreaSummary: content.growthAreaSummary,
      contextNotes: content.contextNotes,
      ...content.bars,
      ...content.traits,
      superpowerText: content.superpowerText,
      underPressureStory: content.underPressureStory,
      definingStory: content.definingStory,
      wouldWorkWithAgainReason: content.wouldWorkWithAgainReason,
      quotableWithAttribution: content.quotableWithAttribution,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  })


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

  try {
    await applyReferenceCompletedRewrite(reference.candidateId, updatedReference)
  } catch (error) {
    console.error('Failed to apply reference-completed baseline rewrite:', error)
  }

  redirect(`/ref/${token}/complete`)
}
