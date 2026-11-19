'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { signInVerifiedEmail } from '@/lib/auth/verified-email-session'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'
import { claimSavedJobs } from '@/lib/leads/claim-saved-jobs'
import { syncCandidateToCrm } from '@/lib/crm/candidate-sync'
import { captureServerEvent } from '@/lib/posthog/server'
import { readAccountToken } from '@/lib/leads/light-account'
import { markJoinedWithResume, startLeadResumeParse } from '@/lib/onboarding/lead-resume'
import type { AccountReadyState } from '@/components/onboarding/light/AccountReadyForm'

const name = (formData: FormData, key: string) => ((formData.get(key) as string | null) ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)

/**
 * Opens a light account (owner decision 2026-11-18). The signed, dated link in our email proves the address is theirs; the press
 * of this button (not the link) opens it, so a mail scanner that follows the link opens nothing. Signs them in with no password
 * (signInVerifiedEmail: an existing account is only entered when its email is already confirmed), stores their name, moves their
 * saved jobs and alerts in, and links the CRM record. Registration (registrationCompletedAt) still waits for the questions.
 */
export async function openLightAccount(_prev: AccountReadyState, formData: FormData): Promise<AccountReadyState> {
  const email = readAccountToken(formData.get('t') as string | null)
  if (!email) return { error: 'This link has expired. Open the newest email from us, or save a job again to get a fresh one.' }
  const firstName = name(formData, 'firstName')
  const lastName = name(formData, 'lastName')
  if (!firstName || !lastName) return { error: 'Enter your first and last name to open your account.' }

  // A full member signs in the usual way; this page never opens a second account for the same person.
  if (await findExistingRegisteredAccount(email, '')) return { error: 'You already have a NextChapter account with this email. Sign in instead.' }

  const signedIn = await signInVerifiedEmail(email, { admin: createAdminClient(), session: await createClient() })
  if (!signedIn.ok) {
    return {
      error:
        signedIn.reason === 'unconfirmed_account'
          ? 'An account for this email is waiting to be confirmed. Use the confirmation link we emailed, or sign in.'
          : 'We could not open your account just now. Try again in a minute.',
    }
  }

  const profile = await getOrCreateCandidateProfile(signedIn.userId)
  if (profile.registrationCompletedAt) redirect('/dashboard')
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { firstName, lastName, email, lightAccountAt: profile.lightAccountAt ?? new Date() },
  })
  const saved = await claimSavedJobs(profile.id, email).catch(() => 0)
  await syncCandidateToCrm(profile.id).catch((e) => console.error('light account CRM sync failed:', e instanceof Error ? e.message : e))
  // One-click membership (owner decision 2026-11-19): someone who already sent us a résumé (the match box) becomes a member as
  // soon as it is read. The résumé fills the profile; the questions are left for later, inside the account. They wait on the
  // reading screen, so registration (and the first report built from the profile) happens only once the résumé is in.
  const sent = await startLeadResumeParse(profile, email).catch(() => 'not_found' as const)
  const oneClick = sent === 'started' || sent === 'running'
  if (oneClick) await markJoinedWithResume(profile.id)
  captureServerEvent(email, 'light_account_opened', { candidateId: profile.id, isNew: signedIn.isNew, returning: !!profile.lightAccountAt, savedJobs: saved, oneClick })
  redirect(oneClick ? '/onboarding/resume' : '/onboarding/your-jobs')
}
