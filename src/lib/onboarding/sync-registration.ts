import 'server-only'
import type { User } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import type { CandidateProfile } from '@prisma/client'
import { captureServerEvent } from '@/lib/posthog/server'

// Registration completes the moment the candidate's Supabase auth user
// stops being anonymous — whether via clicking the "create your account"
// confirmation link, clicking a reminder-email magic link, Google OAuth, or
// classic email+password signup. Rather than hook every one of those entry
// points individually, we opportunistically sync the cached
// `registrationCompletedAt` flag (used for fast dashboard/report gating)
// against the live session's `is_anonymous` value wherever a profile is
// fetched for an authenticated request. Returns whether this call just
// transitioned the profile to registered, so the caller can trigger
// one-time side effects (report generation).
export async function syncRegistrationCompletion(
  user: User,
  profile: CandidateProfile
): Promise<{ profile: CandidateProfile; justRegistered: boolean }> {
  // Google identity linking (SecureAccountForm's "Connect Google instead")
  // redirects straight to the OAuth provider, so there's no reliable moment
  // in that flow to stamp passwordSetAt directly — catch it here instead,
  // the same opportunistic way registrationCompletedAt itself is caught.
  if (!profile.passwordSetAt && user.identities?.some((i) => i.provider === 'google')) {
    profile = await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { passwordSetAt: new Date() },
    })
  }

  if (user.is_anonymous || profile.registrationCompletedAt) {
    return { profile, justRegistered: false }
  }

  const updated = await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { registrationCompletedAt: new Date() },
  })

  captureServerEvent(updated.id, 'account_created', { email: updated.email ?? undefined })

  return { profile: updated, justRegistered: true }
}
