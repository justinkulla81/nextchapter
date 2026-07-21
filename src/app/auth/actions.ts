'use server'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'

export type EmailAvailability = { blocked: false } | { blocked: true; needsPassword: boolean }

// Called by CreateAccountForm before it asks Supabase to send a
// confirmation link to the entered email — a fast, pre-emptive check so a
// candidate who types an email they already registered with sees "log in
// instead" immediately, rather than waiting on an email that would only
// dead-end anyway. The authoritative version of this same check lives in
// syncRegistrationCompletion, which every registration path (including
// Google-linking, which never reaches this form) funnels through.
export async function checkEmailAvailableForSignup(email: string): Promise<EmailAvailability> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { blocked: false }

  const profile = await getOrCreateCandidateProfile(user.id)
  const existing = await findExistingRegisteredAccount(email, profile.id)
  if (!existing) return { blocked: false }

  return { blocked: true, needsPassword: !existing.passwordSetAt }
}

// Called once a password or Google identity is attached to the account —
// registrationCompletedAt alone (stamped the instant the email-confirmation
// link is clicked) doesn't mean the account has a durable way back in, which
// is what left candidates stuck at a duplicate-account "log in" dead end
// with no password to log in with.
export async function markPasswordSet() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { passwordSetAt: new Date() },
  })
}
