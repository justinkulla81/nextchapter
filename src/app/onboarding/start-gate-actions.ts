'use server'

import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { applyJourneyChange } from '@/lib/journey/apply'
import { requireCandidateId } from '@/lib/onboarding/require-candidate'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'
import { fileLeadInCrm } from '@/lib/leads/lifecycle/file-lead'
import { START_COOKIE, START_COOKIE_MAX_AGE, isEmail, startDestination } from '@/lib/onboarding/start-gate'

export type StartGateState = { error?: string; existingAccount?: boolean; go?: string } | undefined

// The server side of the email box that opens from a call to action (src/components/onboarding/StartGateHost.tsx).
// It starts the visitor's profile, keeps the email on it (the details step pre-fills it, and the pick-up email in
// abandoned-run.ts reaches them if they leave), files them as a lead, remembers that they were asked, and says where to go.
// On an error nothing is cleared: the box keeps what they typed.
export async function captureStartEmail(_prev: StartGateState, formData: FormData): Promise<StartGateState> {
  // A hidden field only a script fills in: answer as if it worked, store nothing.
  if (String(formData.get('website') ?? '') !== '') return { go: '/onboarding/desire' }

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!isEmail(email)) return { error: 'Enter a valid email address, like name@example.com.' }
  const source = String(formData.get('source') ?? 'unknown').slice(0, 60)
  const href = String(formData.get('href') ?? '')
  const go = startDestination(href, source)

  const candidateId = await requireCandidateId()
  const existing = await findExistingRegisteredAccount(email, candidateId)
  if (existing) return { error: 'That email already has an account. Log in to continue.', existingAccount: true }

  const before = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId }, select: { email: true } })
  // Never overwrite an address already given on a later step.
  if (!before.email) await prisma.candidateProfile.update({ where: { id: candidateId }, data: { email } })
  await applyJourneyChange(candidateId, { details: { startSource: source, startEmailAt: new Date().toISOString() }, source: 'ONBOARDING' })
  await fileLeadInCrm({ email, channel: 'Onboarding started', detail: `start_gate:${source}` })

  const store = await cookies()
  store.set(START_COOKIE, '1', { path: '/', maxAge: START_COOKIE_MAX_AGE, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
  captureServerEvent(candidateId, 'start_email_captured', { candidateId, source, emailWasOnProfile: !!before.email })
  return { go }
}
