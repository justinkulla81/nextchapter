'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { applyJourneyChange } from '@/lib/journey/apply'
import { requireCandidateId } from '@/lib/onboarding/require-candidate'
import { checkDetails } from '@/lib/onboarding/details'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'
import { maybeNotifyAdminOfNewCandidate } from '@/lib/email/send-admin-new-candidate-account'
import { syncCandidateToCrm } from '@/lib/crm/candidate-sync'

export type DetailsFormState = { error?: string; existingAccount?: boolean } | undefined

// The details step: a name and an email for everyone, LinkedIn if they have it. Runs for a visitor who skipped the
// résumé, whose résumé held no name or email, or a registered member who has no name on file. Marks the résumé step done
// (skipping it is allowed) and goes back to the hub, which sends them to whatever comes next.
export async function saveContactDetails(_prev: DetailsFormState, formData: FormData): Promise<DetailsFormState> {
  const candidateId = await requireCandidateId()
  const check = checkDetails({
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    email: String(formData.get('email') ?? ''),
    linkedInUrl: String(formData.get('linkedInUrl') ?? ''),
  })
  if (!check.ok) return { error: check.message }
  const { firstName, lastName, email, linkedInUrl } = check.value

  // Someone else's registered account already owns this email: say so and offer the log-in, as the résumé upload does.
  const existing = await findExistingRegisteredAccount(email, candidateId)
  if (existing) return { error: 'That email already has an account. Log in instead of starting a new one.', existingAccount: true }

  const before = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { registrationCompletedAt: true, _count: { select: { resumes: true } } },
  })
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { firstName, lastName, email, ...(linkedInUrl ? { linkedInUrl } : {}), resumeStepComplete: true },
  })
  if (before._count.resumes === 0) {
    await applyJourneyChange(candidateId, { details: { resumeSkippedAt: new Date().toISOString() }, source: 'ONBOARDING' })
  }
  captureServerEvent(candidateId, 'onboarding_details_saved', {
    candidateId,
    hadResume: before._count.resumes > 0,
    gaveLinkedIn: !!linkedInUrl,
    registered: before.registrationCompletedAt !== null,
  })

  // The first moment a name and an email are both known for a skipped-résumé visitor (see setCandidateEmail).
  maybeNotifyAdminOfNewCandidate(candidateId).catch(() => {})
  syncCandidateToCrm(candidateId).catch(() => {})

  revalidatePath('/onboarding', 'layout')
  redirect('/onboarding')
}
