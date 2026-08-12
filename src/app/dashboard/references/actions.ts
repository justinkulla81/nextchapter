'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { sendReferenceRequestEmail } from '@/lib/email/send-reference-request'
import { captureServerEvent } from '@/lib/posthog/server'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { assignWrittenQuestions } from '@/lib/references/written-question-pool'
import type { ReferenceType } from '@prisma/client'

export type FormState = { error?: string; sent?: boolean } | undefined

const VALID_TYPES: ReferenceType[] = [
  'DIRECT_MANAGER',
  'SKIP_LEVEL_MANAGER',
  'PEER',
  'DIRECT_REPORT',
  'CLIENT',
  'VENDOR',
  'FACULTY_ADVISOR',
  'OTHER',
]

export async function updateKnownFor(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const knownFor = (formData.get('knownFor') as string | null)?.trim()
  if (!knownFor) {
    return { error: 'Please answer this before saving.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { knownFor },
  })

  revalidatePath('/dashboard/profile')
}

export async function requestReference(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const refereeName = (formData.get('refereeName') as string | null)?.trim()
  const refereeEmail = (formData.get('refereeEmail') as string | null)?.trim()
  const relationshipType = formData.get('relationshipType') as ReferenceType | null

  if (!refereeName || !refereeEmail || !relationshipType || !VALID_TYPES.includes(relationshipType)) {
    return { error: 'Please fill in their name, email, and how you worked together.' }
  }

  const yearsWorkedTogether = formData.get('yearsWorkedTogether')

  const profile = await getOrCreateCandidateProfile(user.id)

  if (!profile.assessmentComplete) {
    return {
      error: 'Please complete the How I Work Best assessment before requesting a reference.',
    }
  }

  // Part C written-question assignment happens once, here, at invite time —
  // never recomputed later, so it stays stable even if an earlier reference
  // is removed. inviteSequence is this candidate's Nth reference ever
  // invited (not Nth currently active), matching the spec's "position 1
  // always gets w11+w1" rule to the actual first invite.
  const [existingCount, priorReferences] = await Promise.all([
    prisma.reference.count({ where: { candidateId: profile.id } }),
    prisma.reference.findMany({
      where: { candidateId: profile.id },
      select: { writtenQuestion1Key: true, writtenQuestion2Key: true },
    }),
  ])
  const inviteSequence = existingCount + 1
  const usedKeys = new Set(
    priorReferences.flatMap((r) => [r.writtenQuestion1Key, r.writtenQuestion2Key].filter((k): k is string => !!k))
  )
  const [q1, q2] = assignWrittenQuestions(inviteSequence, relationshipType, usedKeys)

  const reference = await prisma.reference.create({
    data: {
      candidateId: profile.id,
      refereeName,
      refereeEmail,
      refereeTitle: (formData.get('refereeTitle') as string | null) || null,
      refereeCompany: (formData.get('refereeCompany') as string | null) || null,
      relationshipType,
      yearsWorkedTogether: yearsWorkedTogether ? Number(yearsWorkedTogether) : null,
      inviteSequence,
      writtenQuestion1Key: q1.key,
      writtenQuestion1Text: q1.text,
      writtenQuestion2Key: q2.key,
      writtenQuestion2Text: q2.text,
    },
  })

  const candidateName = profile.displayName || 'A NextChapter candidate'

  await sendReferenceRequestEmail({
    refereeEmail: reference.refereeEmail,
    refereeName: reference.refereeName,
    candidateName,
    token: reference.token,
  })

  captureServerEvent(profile.id, 'reference_requested', { referenceId: reference.id, relationshipType })

  // Weekly Sprint credit for sending the request itself — small on purpose.
  // The bigger REFERENCE_ADDED credit fires separately when the reference
  // actually comes back (see submitReference in src/app/ref/[token]/actions.ts).
  // Best-effort, same shape as NETWORKING_LIST's CSV-import credit: no
  // current-week sprint to log it against just means no points this
  // specific time, not a reason to fail the request itself.
  const sprint = await getCurrentWeekSprint(profile.id)
  if (sprint) {
    const effort = estimateActionEffort({ actionType: 'REFERENCE_REQUESTED' })
    await autoCompleteEngagementAction(profile.id, {
      actionType: 'REFERENCE_REQUESTED',
      text: 'Sent a reference request',
      points: effort.points,
      estimatedMinutes: effort.minutes,
    }).catch((error) => console.error('Failed to auto-complete REFERENCE_REQUESTED action:', error))
  }

  revalidatePath('/dashboard/references')
}

export async function disputeReference(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const referenceId = formData.get('referenceId') as string | null
  const note = (formData.get('note') as string | null)?.trim()

  if (!referenceId || !note) {
    return { error: 'Please describe what seems off before submitting.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  const reference = await prisma.reference.findUnique({ where: { id: referenceId } })
  if (!reference || reference.candidateId !== profile.id) {
    return { error: 'Reference not found.' }
  }

  await prisma.reference.update({
    where: { id: referenceId },
    data: { candidateDisputeNote: note, candidateDisputedAt: new Date(), disputeResolvedAt: null },
  })

  captureServerEvent(profile.id, 'reference_disputed', { referenceId })

  revalidatePath('/dashboard/references')
}

// Fired when a candidate clicks "Follow up" on a reference that's been sent
// but hasn't come back yet — real signal (a genuine click on a genuine
// pending reference), not a self-report claim, so it earns Sprint credit
// like the other auto-detected action types. Fire-and-forget from the
// client alongside the actual mailto/Gmail-compose navigation — never
// blocks or redirects, since the email itself is the primary action.
export async function logReferenceFollowUp(referenceId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  const reference = await prisma.reference.findUnique({ where: { id: referenceId } })
  if (!reference || reference.candidateId !== profile.id) return
  if (reference.status !== 'REQUESTED' && reference.status !== 'REMINDER_SENT') return

  await prisma.reference.update({
    where: { id: referenceId },
    data: { lastFollowUpNudgedAt: new Date() },
  })

  captureServerEvent(profile.id, 'reference_followed_up', { referenceId })

  const sprint = await getCurrentWeekSprint(profile.id)
  if (sprint) {
    const effort = estimateActionEffort({ actionType: 'REFERENCE_FOLLOW_UP' })
    await autoCompleteEngagementAction(profile.id, {
      actionType: 'REFERENCE_FOLLOW_UP',
      text: 'Followed up on a pending reference',
      points: effort.points,
      estimatedMinutes: effort.minutes,
    }).catch((error) => console.error('Failed to auto-complete REFERENCE_FOLLOW_UP action:', error))
  }

  revalidatePath('/dashboard/references')
}

// Mandatory candidate-approval gate for a Victoria-drafted reference quote
// (Prompt 48) — nothing becomes Dossier-eligible without this. approve:
// false rejects it permanently; it never resurfaces.
export async function reviewReferenceQuote(quoteId: string, approve: boolean): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  const quote = await prisma.referenceQuote.findUnique({ where: { id: quoteId } })
  if (!quote || quote.candidateId !== profile.id) return

  await prisma.referenceQuote.update({
    where: { id: quoteId },
    data: approve
      ? { approvedByCandidateAt: new Date() }
      : { rejectedAt: new Date() },
  })

  captureServerEvent(profile.id, 'reference_quote_reviewed', { quoteId, approved: approve })

  revalidatePath('/dashboard/references')
}
