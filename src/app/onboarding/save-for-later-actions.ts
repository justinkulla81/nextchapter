'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { applyJourneyChange } from '@/lib/journey/apply'
import { requireCandidateId } from '@/lib/onboarding/require-candidate'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'
import { fileLeadInCrm } from '@/lib/leads/lifecycle/file-lead'

export type SaveForLaterState = { error?: string; existingAccount?: boolean; savedEmail?: string } | undefined

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// "Not ready? Email me a link to finish later", under the first question. It is the earliest moment we can keep someone:
// the email goes on their profile (the details step then pre-fills it), they are filed as a lead, and the "pick up where you
// left off" email goes to them within about half an hour (src/lib/onboarding/abandoned-run.ts). It asks for nothing else.
export async function saveForLater(_prev: SaveForLaterState, formData: FormData): Promise<SaveForLaterState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email)) return { error: 'Enter a valid email address, like name@example.com.' }
  const source = String(formData.get('source') ?? 'first_question').slice(0, 40)

  const candidateId = await requireCandidateId()
  const existing = await findExistingRegisteredAccount(email, candidateId)
  if (existing) return { error: 'That email already has an account. Log in to pick up where you were.', existingAccount: true }

  const before = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId }, select: { email: true, registrationCompletedAt: true } })
  // Never overwrite an address the member already gave on a later step.
  if (!before.email) await prisma.candidateProfile.update({ where: { id: candidateId }, data: { email } })
  await applyJourneyChange(candidateId, { details: { saveForLaterAt: new Date().toISOString() }, source: 'ONBOARDING' })
  await fileLeadInCrm({ email, channel: 'Onboarding started', detail: `save_for_later:${source}` })

  captureServerEvent(candidateId, 'onboarding_save_for_later', { candidateId, source, emailWasOnProfile: !!before.email })
  revalidatePath('/onboarding', 'layout')
  return { savedEmail: email }
}
